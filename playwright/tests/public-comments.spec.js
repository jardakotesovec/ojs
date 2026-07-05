// @ts-check
const {test, expect} = require('../support/fixtures.js');
const {ArticlePage} = require('../pages/ArticlePage.js');

/**
 * Public comments (reader comments on articles) — the 3.6 reader-comment
 * stack. One test per canonical scenario of docs/product/specs/public-comments.md
 * (7 named), landed at 6 by merging the report-moderation scenario (5) into the
 * reporting test (4). This is the campaign's FIRST reader-WRITE flow: a
 * logged-in reader POSTs a comment, moderators approve/hide/delete, readers
 * report abuse.
 *
 * The spec owns the whole comment stack — the reader posting/reading island
 * (`<pkp-comments>`, lib/pkp), the moderation approve/hide/delete + report REST
 * API, the enable setting. article-landing owns the article page the island
 * mounts on; this file REUSES that page (ArticlePage), extended with the comment
 * accessors.
 *
 * WHAT IS DRIVEN LIVE (reader-WRITE authenticity — the point of this pass):
 *   - POST: a logged-in reader types in the compose box and submits (test 1).
 *   - Anonymous gate: the "Log in to comment" button + no compose box (test 2).
 *   - Approved comment renders to the anonymous reader (test 3).
 *   - Report: a reader reports via the comment card's dropdown + reason dialog
 *     (test 4).
 *   - Owner delete: the author deletes via the comment card's dropdown + confirm
 *     dialog (test 5).
 *   - Enable/disable: the ContentCommentsForm checkbox in Settings → Website →
 *     Content → Comments toggles the reader section (test 6).
 * Moderator mutations (approve/hide, report review, the two ⚠ deviations) are
 * driven through the moderator REST API — exactly the endpoints the moderation
 * Vue page calls — asserting the reader-facing effect in the browser.
 *
 * AUTH: posters are logged-in NON-moderators (atester = author, jjanssen/phudson
 * = reviewers). The moderator is dbarnes, whose publicknowledge `editor` role
 * maps to the Journal-editor group = ROLE_ID_MANAGER, so `isModerator()` is true
 * (Repository::isModerator). Anonymous = a fresh empty-storageState context.
 *
 * PARALLEL: the comment-posted / -reported notifications are synchronous DB rows
 * (NotificationManager::createNotification — no Mailpit, no queue drain), so this
 * file is parallel-safe and lives at the flat root (playwright/tests/). Each test
 * seeds its OWN published article (unique tag → unique publicationId), so its
 * comments are scoped to a brand-new publication and never collide across
 * re-runs, even though comment rows persist. publicknowledge is never mutated
 * (only fresh submissions added, published INTO its 2014 issue); the
 * enable/disable test runs on a per-test scratch journal.
 */

// ---- publication status constant (verified) -------------------------------
const PUB_STATUS_PUBLISHED = 3; // PKPPublication::STATUS_PUBLISHED

// ---- reader-island copy (locale/en) ---------------------------------------
const AWAITING_NOTICE = 'Your comment will be visible when the editor approves it';
const LOGIN_BUTTON = 'Log in to comment';
const ENABLE_CHECKBOX = 'Enable Public Comments'; // manager.userComment.enableComments

/** A unique, hyphenless, alphanumeric tag (parallel isolation). */
function uniqueTag() {
	const workerIndex = test.info().parallelIndex;
	const suffix = Math.random().toString(36).slice(2, 8);
	return `pc${workerIndex}x${suffix}`;
}

/** A fresh anonymous browser context (explicit empty storage state). */
async function newAnonContext(browser, baseURL) {
	return browser.newContext({baseURL, storageState: {cookies: [], origins: []}});
}

/**
 * A VoR-published submission (atester author, dbarnes editor) assigned to a
 * published issue, with optional pre-seeded reader comments via the scenario
 * `userComments` passthrough.
 *
 * @param {object} opts
 * @param {string} opts.tag
 * @param {string} opts.title
 * @param {string} [opts.journal='publicknowledge']
 * @param {object} [opts.issue={volume:1,number:2,year:2014}]
 * @param {boolean} [opts.orcid=false]
 * @param {Array<{user:string,text:string,approved?:boolean}>} [opts.userComments]
 */
function publishedSpec({
	tag,
	title,
	journal = 'publicknowledge',
	issue = {volume: 1, number: 2, year: 2014},
	orcid = false,
	userComments,
}) {
	return {
		tag,
		journal,
		submitter: 'atester',
		section: 'ART',
		locale: 'en',
		...(orcid ? {author: {orcid: 'https://orcid.org/0000-0002-1825-0097', orcidIsVerified: true}} : {}),
		participants: [{user: 'dbarnes', role: 'editor', canChangeMetadata: true}],
		decisions: [
			{type: 'skipExternalReview', by: 'dbarnes'},
			{type: 'sendToProduction', by: 'dbarnes'},
		],
		publications: [
			{
				versionStage: 'VoR',
				metadata: {title: {en: title}},
				issue,
				published: true,
			},
		],
		...(userComments ? {userComments} : {}),
	};
}

/**
 * CSRF token from a loaded OJS page. window.pkp boots async under
 * waitUntil:'commit', so wait for the token before reading it. (Same helper
 * shape as data-availability-citations.spec.js.)
 */
async function getCsrf(page) {
	await page.waitForFunction(() => !!window.pkp?.currentUser?.csrfToken, null, {
		timeout: 20_000,
	});
	return page.evaluate(() => window.pkp.currentUser.csrfToken);
}

// ---- comment REST API helpers ---------------------------------------------
// The comment routes live under the journal context (not locale-prefixed).

const commentsBase = (journal) => `/index.php/${journal}/api/v1/comments`;

/** Public read (unauthenticated): only approved (+ caller's own pending). */
async function publicListComments(reqCtx, journal, publicationId) {
	const res = await reqCtx.get(
		`${commentsBase(journal)}/public?publicationIds=${publicationId}`,
	);
	expect(res.ok(), `GET comments/public: ${res.status()}`).toBeTruthy();
	return (await res.json()).data ?? [];
}

/** Moderator read of the queue (GET /comments), with optional filters. */
async function moderatorListComments(reqCtx, journal, {publicationIds, isApproved, isReported} = {}) {
	const params = new URLSearchParams();
	if (publicationIds != null) params.set('publicationIds', String(publicationIds));
	if (isApproved != null) params.set('isApproved', isApproved ? 'true' : 'false');
	if (isReported != null) params.set('isReported', isReported ? 'true' : 'false');
	const res = await reqCtx.get(`${commentsBase(journal)}?${params.toString()}`);
	expect(res.ok(), `GET comments (moderator): ${res.status()}`).toBeTruthy();
	return (await res.json()).data ?? [];
}

/** Moderator reports read (GET /comments/{id}/reports). */
async function moderatorListReports(reqCtx, journal, commentId) {
	const res = await reqCtx.get(`${commentsBase(journal)}/${commentId}/reports`);
	expect(res.ok(), `GET reports: ${res.status()}`).toBeTruthy();
	return (await res.json()).data ?? [];
}

/**
 * A logged-in/moderator write. usePkpFetch tunnels PUT/DELETE through POST +
 * X-Http-Method-Override (usePkpFetch.js:122-125); mirror that exactly for
 * maximum server compatibility.
 */
function apiWrite(reqCtx, method, url, {csrf, data} = {}) {
	const headers = {};
	if (csrf) headers['X-Csrf-Token'] = csrf;
	if (data !== undefined) headers['Content-Type'] = 'application/json';
	if (method !== 'POST') headers['X-Http-Method-Override'] = method;
	return reqCtx.post(url, {headers, ...(data !== undefined ? {data} : {})});
}

/** Find a seeded/posted comment by a text marker in the moderator queue. */
function byMarker(comments, marker) {
	return comments.find((c) => (c.commentText || '').includes(marker));
}

// ---- waitForResponse predicates (path-based; POST-tunnelled writes) --------

/** POST /comments (the compose submit — a real POST). */
function isSubmitPost(r) {
	return new URL(r.url()).pathname.endsWith('/comments') && r.request().method() === 'POST';
}
/** POST /comments/{id}/reports (the report submit — a real POST). */
function isReportPost(r) {
	return new URL(r.url()).pathname.endsWith('/reports') && r.request().method() === 'POST';
}
/** DELETE /comments/{id} (owner delete — tunnelled as POST). */
function isCommentDelete(r, commentId) {
	return (
		new URL(r.url()).pathname.endsWith(`/comments/${commentId}`) &&
		r.request().method() === 'POST'
	);
}

test.describe('Public comments (reader comments on articles)', () => {
	// Canonical scenario 1 — A logged-in reader posts a comment → moderation
	// queue. The reader opens a published article, types in the compose box and
	// submits; the comment is born HIDDEN (isApproved:false). The author sees
	// their own pending comment tagged "awaiting approval"; an anonymous reader
	// does not; and the moderator sees it in the queue (GET /comments).
	test(
		'logged-in reader posts a comment → moderation queue (author sees own pending, others do not)',
		{tag: ['@smoke', '@regression']},
		async ({pkpApi, asUser, browser, baseURL}) => {
			const tag = uniqueTag();
			const {submission, publications} = await pkpApi.createSubmission(
				publishedSpec({tag, title: `Post ${tag}`}),
			);
			expect(publications[0].status).toBe(PUB_STATUS_PUBLISHED);
			const pubId = publications[0].id;
			const commentText = `A thoughtful comment ${tag}`;

			// A logged-in NON-moderator reader (atester) opens the article.
			const readerCtx = await asUser('atester');
			const reader = await readerCtx.newPage();
			const article = new ArticlePage(reader);
			await article.goto(submission.id, {locale: 'en'});

			// The compose box renders for the logged-in reader — NOT the login gate.
			await expect(article.commentsSection).toBeVisible();
			await expect(article.commentComposeBox).toBeVisible();
			await expect(article.commentLoginButton).toHaveCount(0);

			// Type + submit; the POST returns the born-hidden comment.
			await article.commentComposeBox.fill(commentText);
			const [postResp] = await Promise.all([
				reader.waitForResponse(isSubmitPost, {timeout: 20_000}),
				article.commentSubmitButton.click(),
			]);
			expect(postResp.status(), await postResp.text()).toBe(200);
			expect((await postResp.json()).isApproved).toBe(false);

			// The author now sees their own pending comment + the awaiting notice.
			await expect(article.commentCard(commentText)).toBeVisible();
			await expect(article.awaitingApprovalNotice).toBeVisible();

			// An anonymous reader does NOT see the pending comment.
			const anon = await newAnonContext(browser, baseURL);
			try {
				const pub = await publicListComments(anon.request, 'publicknowledge', pubId);
				expect(pub.some((c) => c.commentText.includes(tag))).toBe(false);
			} finally {
				await anon.close();
			}

			// The moderator sees it in the queue (isApproved=false).
			const modCtx = await asUser('dbarnes');
			const queue = await moderatorListComments(modCtx.request, 'publicknowledge', {
				publicationIds: pubId,
				isApproved: false,
			});
			const mine = byMarker(queue, tag);
			expect(mine, 'pending comment visible in the moderator queue').toBeTruthy();
			expect(mine.isApproved).toBe(false);
		},
	);

	// Canonical scenario 2 — The anonymous reader is gated. An anonymous visitor
	// sees the comments section and the already-approved comment, but in place of
	// the compose box a "Log in to comment" button; a direct POST is rejected 403.
	test(
		'anonymous reader is gated: login button, no compose box, POST → 403',
		{tag: ['@smoke', '@regression']},
		async ({pkpApi, browser, baseURL}) => {
			const tag = uniqueTag();
			const approvedText = `Approved and public ${tag}`;
			const {submission, publications} = await pkpApi.createSubmission(
				publishedSpec({
					tag,
					title: `Anon gate ${tag}`,
					userComments: [{user: 'atester', text: approvedText, approved: true}],
				}),
			);
			const pubId = publications[0].id;

			const anon = await newAnonContext(browser, baseURL);
			try {
				const reader = await anon.newPage();
				const article = new ArticlePage(reader);
				await article.goto(submission.id, {locale: 'en'});

				// The section renders with the approved comment…
				await expect(article.commentsSection).toBeVisible();
				await expect(article.commentCard(approvedText)).toBeVisible();
				// …but the compose box is replaced by the login gate.
				await expect(article.commentLoginButton).toBeVisible();
				await expect(article.commentComposeBox).toHaveCount(0);

				// A direct anonymous POST is rejected (behind has.user → 403).
				const post = await anon.request.post(commentsBase('publicknowledge'), {
					headers: {'Content-Type': 'application/json'},
					data: {publicationId: pubId, commentText: `Sneaky ${tag}`},
				});
				expect(post.status(), 'anonymous POST rejected').toBe(403);

				// The rejection held: still exactly the one approved comment public.
				const pub = await publicListComments(anon.request, 'publicknowledge', pubId);
				expect(pub.filter((c) => c.commentText.includes(tag))).toHaveLength(1);
			} finally {
				await anon.close();
			}
		},
	);

	// Canonical scenario 3 — A manager approves then hides a comment. A pending
	// comment is invisible to the public; the moderator approves it (setApproval
	// true) → it renders to the anonymous reader; the moderator hides it
	// (setApproval false) → it disappears. ⚠ Row 104: hiding leaves a STALE
	// "approved by X" stamp — the moderator API still returns approvedByUserName.
	test(
		'manager approves then hides a comment (anon sees approved, hidden removed) + row-104 stale stamp',
		{tag: ['@smoke', '@regression']},
		async ({pkpApi, asUser, browser, baseURL}) => {
			const tag = uniqueTag();
			const pendingText = `Awaiting moderation ${tag}`;
			const {submission, publications} = await pkpApi.createSubmission(
				publishedSpec({
					tag,
					title: `Approve hide ${tag}`,
					userComments: [{user: 'atester', text: pendingText, approved: false}],
				}),
			);
			const pubId = publications[0].id;

			const modCtx = await asUser('dbarnes');
			const modPage = await modCtx.newPage();
			await modPage.goto('/index.php/publicknowledge/en/dashboard/editorial', {
				waitUntil: 'commit',
			});
			const csrf = await getCsrf(modPage);

			// The comment is queued (hidden) — find its id.
			const queue = await moderatorListComments(modCtx.request, 'publicknowledge', {
				publicationIds: pubId,
			});
			const comment = byMarker(queue, tag);
			expect(comment, 'seeded pending comment present').toBeTruthy();
			expect(comment.isApproved).toBe(false);

			// Anonymous does not see it yet.
			const anon = await newAnonContext(browser, baseURL);
			try {
				expect(
					(await publicListComments(anon.request, 'publicknowledge', pubId)).length,
					'no public comments before approval',
				).toBe(0);

				// --- Approve → public ---
				const appr = await apiWrite(
					modCtx.request,
					'PUT',
					`${commentsBase('publicknowledge')}/${comment.id}/setApproval`,
					{csrf, data: {approved: true}},
				);
				expect(appr.status(), await appr.text()).toBe(200);
				expect((await appr.json()).isApproved).toBe(true);

				// The anonymous reader now sees it — public API + rendered page.
				const pubAfter = await publicListComments(anon.request, 'publicknowledge', pubId);
				expect(pubAfter.some((c) => c.commentText.includes(tag))).toBe(true);

				const reader = await anon.newPage();
				const article = new ArticlePage(reader);
				await article.goto(submission.id, {locale: 'en'});
				await expect(article.commentCard(pendingText)).toBeVisible();

				// --- Hide → removed ---
				const hide = await apiWrite(
					modCtx.request,
					'PUT',
					`${commentsBase('publicknowledge')}/${comment.id}/setApproval`,
					{csrf, data: {approved: false}},
				);
				expect(hide.status(), await hide.text()).toBe(200);
				expect((await hide.json()).isApproved).toBe(false);

				// Gone from the public API and the rendered page (after reload).
				expect(
					(await publicListComments(anon.request, 'publicknowledge', pubId)).length,
				).toBe(0);
				await reader.reload();
				await expect(article.commentsSection).toBeVisible();
				await expect(article.commentCard(pendingText)).toHaveCount(0);
			} finally {
				await anon.close();
			}

			// ⚠ Row 104 — after hiding, the moderator API STILL leaks the approver
			// stamp: setApproval{approved:false} nulls the fields but the shared
			// non-multilingual settings writer won't clear them via null, so
			// approvedByUserName survives though isApproved is now false.
			const single = await modCtx.request.get(
				`${commentsBase('publicknowledge')}/${comment.id}`,
			);
			expect(single.ok(), `GET comment ${comment.id}: ${single.status()}`).toBeTruthy();
			const body = await single.json();
			expect(body.isApproved).toBe(false);
			expect(
				body.approvedByUserName,
				'row 104: stale approver stamp survives hiding',
			).toBeTruthy();
		},
	);

	// Canonical scenarios 4 + 5 (MERGED) — A reader reports an abusive comment,
	// and the manager moderates the reports. A logged-in reader (jjanssen, not the
	// author) reports an approved comment through the card's dropdown + reason
	// dialog; the report is recorded, the comment flips isReported, and the
	// moderator sees it under the Reported filter and in the reports list. Then a
	// SECOND report is added and the report-deletion endpoints are exercised —
	// including ⚠ Row 105: bulk DELETE /reports 500s (deletes nothing) with 2+
	// reports, single-delete 200s, and bulk with 1 report coerces to 200.
	test(
		'reader reports a comment; manager moderates the reports + row-105 bulk-delete bug',
		{tag: ['@smoke', '@regression']},
		async ({pkpApi, asUser}) => {
			const tag = uniqueTag();
			const commentText = `Reportable comment ${tag}`;
			const {submission, publications} = await pkpApi.createSubmission(
				publishedSpec({
					tag,
					title: `Report ${tag}`,
					userComments: [{user: 'atester', text: commentText, approved: true}],
				}),
			);
			const pubId = publications[0].id;

			// Moderator resolves the comment id + a CSRF token for report writes.
			const modCtx = await asUser('dbarnes');
			const modPage = await modCtx.newPage();
			await modPage.goto('/index.php/publicknowledge/en/dashboard/editorial', {
				waitUntil: 'commit',
			});
			const modCsrf = await getCsrf(modPage);
			const comment = byMarker(
				await moderatorListComments(modCtx.request, 'publicknowledge', {publicationIds: pubId}),
				tag,
			);
			expect(comment, 'seeded approved comment present').toBeTruthy();
			const commentId = comment.id;

			// --- Reader (jjanssen) reports it through the UI ---
			const readerCtx = await asUser('jjanssen');
			const reader = await readerCtx.newPage();
			const article = new ArticlePage(reader);
			await article.goto(submission.id, {locale: 'en'});
			await expect(article.commentCard(commentText)).toBeVisible();

			// Open the comment card's "More Options" menu → Report.
			await article.commentActionsTrigger(commentText).click();
			await reader.getByRole('menuitem', {name: 'Report'}).click();

			// The report dialog: enter the required reason and submit.
			const reportDialog = reader
				.getByRole('dialog')
				.filter({hasText: 'Report Comment'});
			await expect(reportDialog).toBeVisible();
			const reason = `Off-topic spam ${tag}`;
			await reportDialog.locator('textarea').fill(reason);
			const [reportResp] = await Promise.all([
				reader.waitForResponse(isReportPost, {timeout: 20_000}),
				reportDialog.getByRole('button', {name: 'Submit', exact: true}).click(),
			]);
			expect(reportResp.status(), await reportResp.text()).toBe(200);

			// The moderator sees the report (reporter reason) + the comment surfaces
			// under the Reported filter.
			const reports1 = await moderatorListReports(modCtx.request, 'publicknowledge', commentId);
			expect(reports1.some((r) => (r.note || '').includes(tag))).toBe(true);
			const reported = await moderatorListComments(modCtx.request, 'publicknowledge', {
				isReported: true,
				publicationIds: pubId,
			});
			expect(reported.some((c) => c.id === commentId)).toBe(true);

			// --- Add a SECOND report (phudson) to set up the 2-report state ---
			const ph = await asUser('phudson');
			const phPage = await ph.newPage();
			await phPage.goto('/index.php/publicknowledge/en/dashboard', {waitUntil: 'commit'});
			const phCsrf = await getCsrf(phPage);
			const r2 = await apiWrite(
				ph.request,
				'POST',
				`${commentsBase('publicknowledge')}/${commentId}/reports`,
				{csrf: phCsrf, data: {note: `Abusive language ${tag}`}},
			);
			expect(r2.status(), await r2.text()).toBe(200);
			const reports2 = await moderatorListReports(modCtx.request, 'publicknowledge', commentId);
			expect(reports2).toHaveLength(2);

			// ⚠ Row 105 — bulk DELETE /comments/{id}/reports with 2 reports 500s
			// (double-wrapped id array → nested whereIn) and deletes NOTHING.
			const bulk2 = await apiWrite(
				modCtx.request,
				'DELETE',
				`${commentsBase('publicknowledge')}/${commentId}/reports`,
				{csrf: modCsrf},
			);
			expect(bulk2.status(), 'row 105: bulk delete of 2+ reports 500s').toBe(500);
			expect(
				(await moderatorListReports(modCtx.request, 'publicknowledge', commentId)).length,
				'row 105: nothing deleted on the 500',
			).toBe(2);

			// Single-report delete works (200) → one report remains.
			const del1 = await apiWrite(
				modCtx.request,
				'DELETE',
				`${commentsBase('publicknowledge')}/${commentId}/reports/${reports2[0].id}`,
				{csrf: modCsrf},
			);
			expect(del1.status(), await del1.text()).toBe(200);
			expect(
				(await moderatorListReports(modCtx.request, 'publicknowledge', commentId)).length,
			).toBe(1);

			// With ONE report the bulk endpoint happens to coerce and 200s (row 105).
			const bulk1 = await apiWrite(
				modCtx.request,
				'DELETE',
				`${commentsBase('publicknowledge')}/${commentId}/reports`,
				{csrf: modCsrf},
			);
			expect(bulk1.status(), 'row 105: bulk delete of 1 report 200s').toBe(200);
			expect(
				(await moderatorListReports(modCtx.request, 'publicknowledge', commentId)).length,
			).toBe(0);
		},
	);

	// Canonical scenario 6 — The author deletes their own comment; a stranger
	// cannot. A different non-moderator user is refused (403); the author deletes
	// their own comment from the reader card (dropdown → confirm) → 200, gone.
	test(
		'owner-only delete: a stranger is refused (403); the author deletes their own comment',
		{tag: ['@smoke', '@regression']},
		async ({pkpApi, asUser}) => {
			const tag = uniqueTag();
			const commentText = `Deletable comment ${tag}`;
			const {submission, publications} = await pkpApi.createSubmission(
				publishedSpec({
					tag,
					title: `Delete ${tag}`,
					userComments: [{user: 'atester', text: commentText, approved: true}],
				}),
			);
			const pubId = publications[0].id;

			// Resolve the comment id via the moderator queue.
			const modCtx = await asUser('dbarnes');
			const comment = byMarker(
				await moderatorListComments(modCtx.request, 'publicknowledge', {publicationIds: pubId}),
				tag,
			);
			expect(comment).toBeTruthy();
			const commentId = comment.id;

			// --- Stranger (jjanssen, not owner, not moderator) DELETE → 403 ---
			const strangerCtx = await asUser('jjanssen');
			const strangerPage = await strangerCtx.newPage();
			await strangerPage.goto(
				`/index.php/publicknowledge/en/article/view/${submission.id}`,
				{waitUntil: 'commit'},
			);
			const strangerCsrf = await getCsrf(strangerPage);
			const forbidden = await apiWrite(
				strangerCtx.request,
				'DELETE',
				`${commentsBase('publicknowledge')}/${commentId}`,
				{csrf: strangerCsrf},
			);
			expect(forbidden.status(), 'stranger delete refused').toBe(403);
			// The comment survived.
			expect(
				(await moderatorListComments(modCtx.request, 'publicknowledge', {publicationIds: pubId}))
					.some((c) => c.id === commentId),
			).toBe(true);

			// --- Owner (atester) deletes their own via the reader card ---
			const ownerCtx = await asUser('atester');
			const owner = await ownerCtx.newPage();
			const article = new ArticlePage(owner);
			await article.goto(submission.id, {locale: 'en'});
			await expect(article.commentCard(commentText)).toBeVisible();

			await article.commentActionsTrigger(commentText).click();
			await owner.getByRole('menuitem', {name: 'Delete Comment'}).click();
			const confirm = owner.getByRole('dialog').filter({hasText: 'Delete Comment'});
			await expect(confirm).toBeVisible();
			const [delResp] = await Promise.all([
				owner.waitForResponse((r) => isCommentDelete(r, commentId), {timeout: 20_000}),
				confirm.getByRole('button', {name: 'Delete', exact: true}).click(),
			]);
			expect(delResp.status(), await delResp.text()).toBe(200);

			// Gone from the rendered page and from the moderator list.
			await expect(article.commentCard(commentText)).toHaveCount(0);
			expect(
				(await moderatorListComments(modCtx.request, 'publicknowledge', {publicationIds: pubId}))
					.some((c) => c.id === commentId),
			).toBe(false);
		},
	);

	// Canonical scenario 7 — Enabling and disabling comments. On a scratch journal
	// with comments OFF (the default) a published article shows NO comments
	// section; a manager ticks "Enable Public Comments" in Settings → Website →
	// Content → Comments and the reader section appears; unticking hides it again.
	test(
		'enabling comments shows the reader section; disabling hides it',
		{tag: '@regression'},
		async ({pkpApi, asUser, browser, baseURL}) => {
			test.slow();
			const tag = uniqueTag();
			// Scratch journal, comments OFF by default (enablePublicComments omitted).
			const {context} = await pkpApi.createJournal({
				tag,
				users: [
					{username: 'dbarnes', roles: ['manager']},
					{username: 'atester', roles: ['author']},
				],
				issues: [{volume: 1, number: 1, year: 2024, published: true}],
			});
			const journalPath = context.path;
			const {submission, publications} = await pkpApi.createSubmission(
				publishedSpec({
					tag: `${tag}s`,
					title: `Toggle ${tag}`,
					journal: journalPath,
					issue: {volume: 1, number: 1, year: 2024},
				}),
			);
			expect(publications[0].status).toBe(PUB_STATUS_PUBLISHED);

			// A single-locale scratch journal serves the bare reader URL.
			const readSection = async () => {
				const anon = await newAnonContext(browser, baseURL);
				try {
					const reader = await anon.newPage();
					const article = new ArticlePage(reader, {journalPath});
					const resp = await article.goto(submission.id);
					expect(resp?.status(), 'article page reachable').toBeLessThan(400);
					return await article.commentsSection.count();
				} finally {
					await anon.close();
				}
			};

			// Open Settings → Website → Content → Comments and drive the
			// ContentCommentsForm checkbox. The settings SPA resets its active
			// tab after a save, so re-open the tab fresh for each toggle.
			const mgrCtx = await asUser('dbarnes');
			const mgr = await mgrCtx.newPage();
			const openCommentsTab = async () => {
				await mgr.goto(`/index.php/${journalPath}/management/settings/website`, {
					waitUntil: 'commit',
				});
				await mgr.locator('#content-button').click();
				await mgr.locator('#publicComments-button').click();
				const checkbox = mgr.getByRole('checkbox', {name: ENABLE_CHECKBOX});
				await expect(checkbox).toBeVisible({timeout: 20_000});
				return {checkbox, form: mgr.locator('form', {has: checkbox})};
			};
			const saveForm = async (form) => {
				const [resp] = await Promise.all([
					mgr.waitForResponse(
						(r) =>
							/\/api\/v1\/contexts\/\d+/.test(r.url()) &&
							r.request().method() === 'POST',
						{timeout: 20_000},
					),
					form.getByRole('button', {name: 'Save', exact: true}).click(),
				]);
				return resp;
			};
			const pollIntervals = [1000, 2000, 3000];

			// OFF (default): no comments section.
			expect(await readSection(), 'section absent when disabled').toBe(0);

			// Enable + Save (context update).
			let {checkbox, form} = await openCommentsTab();
			await checkbox.check();
			expect((await saveForm(form)).status(), 'enable save').toBeLessThan(400);

			// ON: the reader section now appears.
			await expect
				.poll(readSection, {
					timeout: 25_000,
					intervals: pollIntervals,
					message: 'section present when enabled',
				})
				.toBe(1);

			// Disable + Save (re-open the tab fresh; it reflects the saved state).
			({checkbox, form} = await openCommentsTab());
			await expect(checkbox).toBeChecked();
			await checkbox.uncheck();
			expect((await saveForm(form)).status(), 'disable save').toBeLessThan(400);

			// OFF again: the reader section disappears.
			await expect
				.poll(readSection, {
					timeout: 25_000,
					intervals: pollIntervals,
					message: 'section hidden when disabled again',
				})
				.toBe(0);
		},
	);
});
