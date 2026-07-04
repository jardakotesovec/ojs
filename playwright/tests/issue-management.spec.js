// @ts-check
const {test, expect} = require('../support/fixtures.js');
const {IssuePage} = require('../pages/IssuePage.js');
const {waitForJQueryIdle} = require('../../lib/pkp/playwright/support/jquery.js');
const {fixtureFilePath} = require('../../lib/pkp/playwright/pages/FileStagePanel.js');
const {execFileSync} = require('child_process');
const path = require('path');

/**
 * Issue management — the editorial issue lifecycle (the Issues page:
 * ManageIssuesHandler + the legacy Future/Back/TOC/IssueGalley grids).
 * One test per canonical scenario of docs/product/specs/issue-management.md
 * (11 scenarios; the two publish scenarios 5 "publish + notify" and 6
 * "publish without notifying" are MERGED into one two-issue test → 10 tests).
 *
 * The whole surface is LEGACY jQuery grids + AjaxModals, MANAGER/SITE-ADMIN
 * only. dbarnes is a manager on every scratch journal seeded here (and on
 * publicknowledge). All mutation tests run on their own SCRATCH journal so
 * publishing/deleting never leaks into the shared publicknowledge issue list
 * or sprays the shared Mailpit inbox; only the permission-boundary test reads
 * the (read-only) publicknowledge surface.
 *
 * As-built realities these tests DRIVE LIVE + spec deltas they surfaced:
 *   - ⚠ SPEC CONTRADICTION (Fields & validation table): the spec claims a new
 *     issue defaults *Show Title OFF*. As-built, IssueForm::initData() seeds
 *     showTitle => 1 (all four toggles ON), so leaving Title empty on a new
 *     issue is REFUSED with "Title is required". Test 1 therefore unchecks
 *     Show Title to create with just Volume/Number/Year (scenario 1's intent).
 *   - Publishing an issue flips its SCHEDULED articles to Published + makes
 *     the issue current + (opt-in) emails readers. The reader email is queued
 *     via Bus::batch; the test env's end-of-request JobRunner does NOT drain a
 *     batched mail job promptly (cross-request lock), so the publish-notify
 *     test drains the queue via `php lib/pkp/tools/jobs.php run` (real mailer,
 *     no Mail::fake) and then asserts on Mailpit. (This is why a matching
 *     assertion is impractical in the seeding path, which fakes mail.)
 *   - unpublish ≠ delete: unpublish returns a Published article to SCHEDULED
 *     (issueId kept); delete resets it to issueId=null / QUEUED. Tests 6 & 7
 *     assert the state difference the spec's Open questions call out.
 *
 * Parallel-safety: tags are single hyphenless alphanumeric tokens; every
 * journal/issue/submission is per-test (scratch); anon reader contexts pass an
 * explicit empty storageState; Mailpit reads are scoped by recipient + tag and
 * never cleared. Scratch journals are single-locale → reader probes use BARE
 * URLs (patterns.md item 9).
 */

// ---- publication / submission status constants (verified against source) ---
const PUB_STATUS_QUEUED = 1; // Publication::STATUS_QUEUED
const PUB_STATUS_PUBLISHED = 3; // Publication::STATUS_PUBLISHED
const PUB_STATUS_SCHEDULED = 5; // Publication::STATUS_SCHEDULED
const SUB_STATUS_QUEUED = 1; // PKPSubmission::STATUS_QUEUED
const SUB_STATUS_PUBLISHED = 3; // PKPSubmission::STATUS_PUBLISHED

// ---- form-refusal sentences (locale/en, lib/pkp/locale/en) -----------------
// (The "Issue identification is required" message is delivered via the user
// notification queue, which parallel same-user tests drain — test 1 asserts the
// refusal deterministically instead of on that text.)
const URLPATH_IS_NUMBER = /The URL path can not be a number/i;
const CONFIRM_PUBLISH = 'Are you sure you want to publish the new issue?';
const CONFIRM_UNPUBLISH = /Are you sure you want to unpublish this published issue/i;
const CONFIRM_DELETE = /Are you sure you wish to delete this item/i;
const CONFIRM_SET_CURRENT = /Are you sure you want to set this issue as current/i;
const CONFIRM_REMOVE_ARTICLE = /Are you sure you wish to remove this article from the issue/i;

const REPO_ROOT = path.resolve(__dirname, '../..');

/** A unique, hyphenless, alphanumeric tag (parallel isolation). */
function uniqueTag() {
	const workerLetter = String.fromCharCode(97 + (test.info().parallelIndex % 26));
	let suffix = '';
	while (suffix.length < 6) {
		suffix += Math.random().toString(36).replace(/[^a-z0-9]/g, '');
	}
	return `ism${workerLetter}${suffix.slice(0, 6)}`;
}

/**
 * Drain the OJS job queue via the CLI (real mailer — no Mail::fake), looping
 * until a message matching {to, contains} appears in Mailpit. The batched
 * publish-notify job is not drained by the test env's end-of-request runner
 * (cross-request lock), so the test drives it deterministically.
 *
 * @returns {Promise<Array<object>>} the matching Mailpit messages
 */
async function drainUntilMail(pkpMail, {to, contains}, {tries = 18} = {}) {
	for (let i = 0; i < tries; i++) {
		try {
			execFileSync('php', ['lib/pkp/tools/jobs.php', 'run'], {
				cwd: REPO_ROOT,
				env: {...process.env, APPLICATION_ENV: 'test'},
				stdio: 'ignore',
			});
		} catch {
			// A malformed sibling job can exit non-zero; keep polling.
		}
		const found = await pkpMail
			.find({to, contains, timeoutMs: 1200})
			.catch(() => null);
		if (found) return found;
	}
	throw new Error(`mail to ${to} containing "${contains}" never arrived after draining`);
}

/** Drain the queue once (no assertion) — used to flush the no-notify path. */
function pumpQueue() {
	try {
		execFileSync('php', ['lib/pkp/tools/jobs.php', 'run'], {
			cwd: REPO_ROOT,
			env: {...process.env, APPLICATION_ENV: 'test'},
			stdio: 'ignore',
		});
	} catch {
		/* best effort */
	}
}

/** GET the journal's issues filtered by publish state (page/context session). */
async function fetchIssues(ctx, journalPath, isPublished, {orderBy} = {}) {
	const orderParam = orderBy ? `&orderBy=${orderBy}` : '';
	const res = await ctx.request.get(
		`/index.php/${journalPath}/api/v1/issues?isPublished=${isPublished}&count=100${orderParam}`,
	);
	expect(res.ok(), `GET issues isPublished=${isPublished}: ${res.status()}`).toBeTruthy();
	return (await res.json()).items;
}

/** The first issue matching a publish state. */
async function firstIssue(ctx, journalPath, isPublished) {
	const items = await fetchIssues(ctx, journalPath, isPublished);
	expect(items.length, `>=1 issue isPublished=${isPublished}`).toBeGreaterThan(0);
	return items[0];
}

/** Find an issue by its (unique) number string, across both publish states. */
async function issueByNumber(ctx, journalPath, number) {
	for (const state of [0, 1]) {
		const items = await fetchIssues(ctx, journalPath, state);
		const hit = items.find((i) => String(i.number) === String(number));
		if (hit) return hit;
	}
	throw new Error(`no issue with number ${number} on ${journalPath}`);
}

/** GET one issue by id. */
async function fetchIssue(ctx, journalPath, id) {
	const res = await ctx.request.get(`/index.php/${journalPath}/api/v1/issues/${id}`);
	expect(res.ok(), `GET issue ${id}: ${res.status()}`).toBeTruthy();
	return res.json();
}

/** GET the journal's current issue (or null). */
async function fetchCurrentIssue(ctx, journalPath) {
	const res = await ctx.request.get(`/index.php/${journalPath}/api/v1/issues/current`);
	if (res.status() === 404) return null;
	expect(res.ok(), `GET current issue: ${res.status()}`).toBeTruthy();
	return res.json();
}

/** GET a submission JSON. */
async function fetchSubmission(ctx, journalPath, submissionId) {
	const res = await ctx.request.get(
		`/index.php/${journalPath}/api/v1/submissions/${submissionId}`,
	);
	expect(res.ok(), `GET submission ${submissionId}: ${res.status()}`).toBeTruthy();
	return res.json();
}

/** GET one publication JSON. */
async function fetchPublication(ctx, journalPath, submissionId, pubId) {
	const res = await ctx.request.get(
		`/index.php/${journalPath}/api/v1/submissions/${submissionId}/publications/${pubId}`,
	);
	expect(res.ok(), `GET publication ${pubId}: ${res.status()}`).toBeTruthy();
	return res.json();
}

/** Anonymous reader status for a scratch-journal article (BARE url). */
async function readerStatus(browser, baseURL, journalPath, submissionId) {
	const anon = await browser.newContext({baseURL, storageState: {cookies: [], origins: []}});
	try {
		const res = await anon.request.get(
			`/index.php/${journalPath}/article/view/${submissionId}`,
		);
		return res.status();
	} finally {
		await anon.close();
	}
}

/**
 * A VoR submission "scheduled into" a (future) issue: published:true against
 * an unpublished issue lands the publication at STATUS_SCHEDULED. dbarnes is
 * the managing editor; atester the author.
 */
function scheduledIntoIssueSpec({tag, title, journal, volume, number, year}) {
	return {
		tag,
		journal,
		submitter: 'atester',
		section: 'ART',
		locale: 'en',
		participants: [{user: 'dbarnes', role: 'editor', canChangeMetadata: true}],
		decisions: [
			{type: 'skipExternalReview', by: 'dbarnes'},
			{type: 'sendToProduction', by: 'dbarnes'},
		],
		publications: [
			{
				versionStage: 'VoR',
				metadata: {title: {en: title}},
				issue: {volume, number, year},
				published: true,
			},
		],
	};
}

/** Create a scratch journal with dbarnes(manager)+atester(author) and issues. */
async function scratchJournal(pkpApi, {tag, issues, extraUsers = []}) {
	const {context} = await pkpApi.createJournal({
		tag,
		users: [
			{username: 'dbarnes', roles: ['manager']},
			{username: 'atester', roles: ['author']},
			...extraUsers,
		],
		issues,
	});
	return context.path;
}

test.use({user: 'dbarnes'}); // a manager on every scratch journal + publicknowledge

test.describe('Issue management — the Issues page (legacy grids, manager-only)', () => {
	// Canonical scenario 1 — Create a future issue + identification-required
	// refusal. NOTE the spec delta: a new issue's form defaults *Show Title ON*
	// (IssueForm::initData showTitle=>1), contradicting the spec's "Show Title
	// off" claim — so creating with just Volume/Number/Year requires unchecking
	// Show Title first, else "Title is required" blocks the save.
	test(
		'create a future issue; leaving all four Show toggles off is refused',
		{tag: ['@smoke', '@regression']},
		async ({page, pkpApi}) => {
			test.slow();
			const tag = uniqueTag();
			const journalPath = await scratchJournal(pkpApi, {tag, issues: []});

			const issuePage = new IssuePage(page);
			await issuePage.goto(journalPath);
			await issuePage.addIssueLink.click();
			const form = page.locator('form#issueForm');
			await expect(form.locator('input[name="volume"]')).toBeVisible({timeout: 15_000});

			// --- Refusal FIRST (same modal session, no grid-refresh race): all
			// four Show toggles off is rejected ("Issue identification is
			// required"). That message is delivered via the user notification
			// queue, which parallel dbarnes tests drain (patterns.md item 2), so
			// we assert the deterministic refusal signal instead: the modal stays
			// open (a successful save would close it) and NO issue is created. ---
			for (const name of ['showVolume', 'showNumber', 'showYear', 'showTitle']) {
				const cb = form.locator(`input[name="${name}"]`);
				await cb.uncheck();
				await expect(cb, `${name} unchecked before submit`).not.toBeChecked();
			}
			await Promise.all([
				page.waitForResponse(
					(r) => /update-?issue/i.test(r.url()) && r.request().method() === 'POST',
					{timeout: 15_000},
				),
				form.locator('button[id^="submitFormButton"]').click(),
			]);
			await waitForJQueryIdle(page);
			// Give the AjaxFormHandler a beat to either close (success) or
			// re-render (refusal), then assert it stayed open and created nothing.
			await expect(form, 'form stays open — save refused').toHaveCount(1);
			await expect(form.locator('input[name="volume"]')).toBeVisible();
			expect(
				(await fetchIssues(page, journalPath, 0)).length,
				'no issue created by the refused save',
			).toBe(0);

			// --- Then create Volume 10 / Number 1 / Year 2027 (Show V/N/Y, not
			// Title) in the re-rendered form; the save closes the modal. ---
			for (const name of ['showVolume', 'showNumber', 'showYear']) {
				const cb = form.locator(`input[name="${name}"]`);
				await cb.check();
				await expect(cb, `${name} checked`).toBeChecked();
			}
			await form.locator('input[name="showTitle"]').uncheck();
			await form.locator('input[name="volume"]').fill('10');
			await form.locator('input[name="number"]').fill('1');
			await form.locator('input[name="year"]').fill('2027');
			await form.locator('button[id^="submitFormButton"]').click();
			await expect(form).toHaveCount(0, {timeout: 15_000});
			await waitForJQueryIdle(page);

			// The issue appears in the Future Issues list + server truth.
			await expect(
				issuePage.futureRow({volume: 10, number: 1, year: 2027}),
			).toBeVisible({timeout: 15_000});
			const created = (await fetchIssues(page, journalPath, 0)).find(
				(i) => String(i.volume) === '10' && String(i.number) === '1',
			);
			expect(created, 'created future issue present via API').toBeTruthy();
			expect(created.published).toBe(false);
		},
	);

	// Canonical scenario 2 — Edit issue data: a shown Title, a custom URL Path
	// and a Cover Image; an all-digit URL path is refused.
	test(
		'edit issue data: title, cover image, URL path; all-digit URL path refused',
		{tag: ['@smoke', '@regression']},
		async ({page, pkpApi}) => {
			test.slow();
			const tag = uniqueTag();
			const journalPath = await scratchJournal(pkpApi, {
				tag,
				issues: [{volume: 5, number: 1, year: 2026, published: false}],
			});
			const issue = await firstIssue(page, journalPath, 0);

			const issuePage = new IssuePage(page);
			await issuePage.goto(journalPath);
			const form = await issuePage.openIssueDataTab(
				issuePage.futureRow({volume: 5, number: 1, year: 2026}),
			);

			// Title (turns Show Title on).
			await form.locator('input[name="showTitle"]').check();
			await form.locator('input[name="title[en]"]').fill(`Winter ${tag}`);

			// An all-digit URL path is refused (form stays open).
			await form.locator('input[name="urlPath"]').fill('99999');
			await form.locator('button[id^="submitFormButton"]').click();
			await waitForJQueryIdle(page);
			await expect(page.getByText(URLPATH_IS_NUMBER).first()).toBeVisible({timeout: 10_000});
			await expect(form, 'refused — form still open').toHaveCount(1);

			// Fix to a valid slug. Upload the cover LAST — the refusal re-render
			// resets the hidden temporaryFileId, so it must be re-populated
			// immediately before the successful save (IssueForm::execute copies
			// the cover only when temporaryFileId is present at save time).
			const slug = `winter-${tag}`;
			await form.locator('input[name="urlPath"]').fill(slug);
			await issuePage.uploadCoverImage(fixtureFilePath('dependent-image.png'));
			await issuePage.saveIssueForm();

			// Server truth: title, url path and cover image all persisted.
			const saved = await fetchIssue(page, journalPath, issue.id);
			expect(saved.title.en).toContain(tag);
			expect(saved.urlPath).toBe(slug);
			expect(saved.coverImage?.en, 'cover image stored on the issue').toBeTruthy();
		},
	);

	// Canonical scenario 3 — Order the Back Issues list. Dragging a back issue
	// above another writes the per-journal custom order (custom_issue_orders)
	// and it persists across a reload, overriding the default date order.
	test(
		'order the Back Issues list: the custom order persists',
		{tag: '@regression'},
		async ({page, pkpApi}) => {
			test.slow();
			const tag = uniqueTag();
			const journalPath = await scratchJournal(pkpApi, {
				tag,
				issues: [
					{volume: 1, number: 1, year: 2020, published: true},
					{volume: 1, number: 2, year: 2021, published: true},
				],
			});
			const issuePage = new IssuePage(page);
			const identA = issuePage.identification({volume: 1, number: 1, year: 2020});
			const identB = issuePage.identification({volume: 1, number: 2, year: 2021});

			await issuePage.goto(journalPath);
			await issuePage.openBackTab();

			const rowA = issuePage.backRow({volume: 1, number: 1, year: 2020});
			const rowB = issuePage.backRow({volume: 1, number: 2, year: 2021});
			await expect(rowA).toBeVisible();
			await expect(rowB).toBeVisible();

			// Drag issue A above issue B.
			await issuePage.startBackOrdering();
			await issuePage.dragRowAbove(rowA, rowB);
			await issuePage.finishBackOrdering();

			// Custom order now lists A before B — and survives a page reload.
			await issuePage.goto(journalPath);
			await issuePage.openBackTab();
			const order = await issuePage.backRowIdentifications();
			const posA = order.findIndex((t) => t.includes(identA));
			const posB = order.findIndex((t) => t.includes(identB));
			expect(posA, `A (${identA}) present`).toBeGreaterThanOrEqual(0);
			expect(posB, `B (${identB}) present`).toBeGreaterThanOrEqual(0);
			expect(posA, 'custom order places A above B').toBeLessThan(posB);
		},
	);

	// Canonical scenario 4 — Build the table of contents. Reorder two articles
	// within a section, then remove one — the removed article's in-issue
	// publication is unpublished (back to draft) and it drops off the TOC.
	test(
		'build the TOC: reorder two articles, then remove one',
		{tag: ['@smoke', '@regression']},
		async ({page, pkpApi}) => {
			test.slow();
			const tag = uniqueTag();
			const journalPath = await scratchJournal(pkpApi, {
				tag,
				issues: [{volume: 2, number: 1, year: 2028, published: false}],
			});
			const titleA = `Alpha ${tag}`;
			const titleB = `Bravo ${tag}`;
			const {submission: subA} = await pkpApi.createSubmission(
				scheduledIntoIssueSpec({tag: `${tag}a`, title: titleA, journal: journalPath, volume: 2, number: 1, year: 2028}),
			);
			const {submission: subB, publications: pubsB} = await pkpApi.createSubmission(
				scheduledIntoIssueSpec({tag: `${tag}b`, title: titleB, journal: journalPath, volume: 2, number: 1, year: 2028}),
			);

			const issuePage = new IssuePage(page);
			await issuePage.goto(journalPath);
			await issuePage.openIssueToc(issuePage.futureRow({volume: 2, number: 1, year: 2028}));

			// Both scheduled articles are TOC rows.
			await expect(issuePage.tocArticleRows()).toHaveCount(2, {timeout: 15_000});
			const orderBefore = await issuePage.tocArticleRows().allInnerTexts();
			const idxA0 = orderBefore.findIndex((t) => t.includes(titleA));
			const idxB0 = orderBefore.findIndex((t) => t.includes(titleB));

			// Reorder: drag the second-listed article above the first.
			const [firstTitle, secondTitle] = idxA0 < idxB0 ? [titleA, titleB] : [titleB, titleA];
			await issuePage.startTocOrdering();
			await issuePage.dragRowAbove(
				issuePage.tocArticleRow(secondTitle),
				issuePage.tocArticleRow(firstTitle),
			);
			await issuePage.finishTocOrdering();

			// The order flipped (reload the TOC to read the persisted sequence).
			await issuePage.goto(journalPath);
			await issuePage.openIssueToc(issuePage.futureRow({volume: 2, number: 1, year: 2028}));
			await expect(issuePage.tocArticleRows()).toHaveCount(2, {timeout: 15_000});
			const orderAfter = await issuePage.tocArticleRows().allInnerTexts();
			expect(
				orderAfter.findIndex((t) => t.includes(secondTitle)),
				'the dragged article is now first',
			).toBeLessThan(orderAfter.findIndex((t) => t.includes(firstTitle)));

			// Remove article B from the issue → it drops off the TOC…
			await issuePage.confirmRowAction(issuePage.tocArticleRow(titleB), 'removeArticle', {
				dialogText: CONFIRM_REMOVE_ARTICLE,
			});
			await expect(issuePage.tocArticleRow(titleB)).toHaveCount(0, {timeout: 15_000});
			await expect(issuePage.tocArticleRow(titleA)).toBeVisible();

			// …and its in-issue publication is no longer Scheduled (unpublished).
			await expect
				.poll(
					async () =>
						(await fetchPublication(page, journalPath, subB.id, pubsB[0].id)).status,
					{timeout: 15_000},
				)
				.not.toBe(PUB_STATUS_SCHEDULED);
		},
	);

	// Canonical scenarios 5 + 6 (merged) — Publish an issue. THE headline
	// side-effect: publishing flips every SCHEDULED article to Published +
	// reader-visible + into the issue TOC, makes the issue current, and (Send
	// an email CHECKED BY DEFAULT) emails subscribed readers the "Just
	// published: …" notice. A second issue published with the box UNCHECKED
	// flips its article the same way but sends NO reader email.
	test(
		'publish → scheduled articles go live + readers emailed; publish-without-notify sends nothing',
		{tag: ['@smoke', '@regression']},
		async ({page, pkpApi, pkpMail, browser, baseURL}) => {
			test.slow();
			const tag = uniqueTag();
			const numQuiet = `${tag}q`;
			const numLoud = `${tag}l`;
			const readerEmail = `reader.${tag}@mailinator.com`;
			const journalPath = await scratchJournal(pkpApi, {
				tag,
				issues: [
					{volume: 9, number: numQuiet, year: 2099, published: false},
					{volume: 9, number: numLoud, year: 2099, published: false},
				],
				extraUsers: [
					{username: `rd${tag}`, password: `rd${tag}rd${tag}`, email: readerEmail, roles: ['reader']},
				],
			});
			const issueQuiet = await issueByNumber(page, journalPath, numQuiet);
			const issueLoud = await issueByNumber(page, journalPath, numLoud);

			const {submission: subQuiet, publications: pubsQ} = await pkpApi.createSubmission(
				scheduledIntoIssueSpec({tag: `${tag}sq`, title: `Quiet ${tag}`, journal: journalPath, volume: 9, number: numQuiet, year: 2099}),
			);
			const {submission: subLoud, publications: pubsL} = await pkpApi.createSubmission(
				scheduledIntoIssueSpec({tag: `${tag}sl`, title: `Loud ${tag}`, journal: journalPath, volume: 9, number: numLoud, year: 2099}),
			);
			expect(pubsQ[0].status).toBe(PUB_STATUS_SCHEDULED);
			expect(pubsL[0].status).toBe(PUB_STATUS_SCHEDULED);

			const issuePage = new IssuePage(page);
			await issuePage.goto(journalPath);

			// --- (a) Publish the QUIET issue WITHOUT notifying ---
			await issuePage.publishIssue(
				{volume: 9, number: numQuiet, year: 2099},
				{sendNotification: false},
			);
			await expect
				.poll(async () => (await fetchPublication(page, journalPath, subQuiet.id, pubsQ[0].id)).status, {timeout: 20_000})
				.toBe(PUB_STATUS_PUBLISHED);
			expect(
				await readerStatus(browser, baseURL, journalPath, subQuiet.id),
				'quiet article reader-visible',
			).toBe(200);

			// --- (b) Publish the LOUD issue WITH notify (assert modal defaults) ---
			const publishLink = await issuePage.rowAction(
				issuePage.futureRow({volume: 9, number: numLoud, year: 2099}),
				'publish',
			);
			await publishLink.click();
			const pform = page.locator('form#assignPublicIdentifierForm');
			await expect(pform).toBeVisible({timeout: 15_000});
			await expect(pform.getByText(CONFIRM_PUBLISH)).toBeVisible();
			await expect(
				pform.locator('input#sendIssueNotification'),
				'Send an email is CHECKED by default',
			).toBeChecked();
			await pform.locator('button[id^="submitFormButton"]').click();
			await expect(pform).toHaveCount(0, {timeout: 15_000});
			await waitForJQueryIdle(page);

			// The loud issue's scheduled article flips to Published + current.
			await expect
				.poll(async () => (await fetchPublication(page, journalPath, subLoud.id, pubsL[0].id)).status, {timeout: 20_000})
				.toBe(PUB_STATUS_PUBLISHED);
			expect((await fetchSubmission(page, journalPath, subLoud.id)).status).toBe(SUB_STATUS_PUBLISHED);
			const current = await fetchCurrentIssue(page, journalPath);
			expect(current?.id, 'publishing made the issue current').toBe(issueLoud.id);

			// Reader-visible + listed in the published issue's TOC page.
			expect(await readerStatus(browser, baseURL, journalPath, subLoud.id)).toBe(200);
			const anon = await browser.newContext({baseURL, storageState: {cookies: [], origins: []}});
			try {
				const reader = await anon.newPage();
				await reader.goto(`/index.php/${journalPath}/issue/view/${issueLoud.id}`);
				await expect(
					reader.getByRole('link', {name: new RegExp(`Loud ${tag}`)}),
				).toBeVisible({timeout: 15_000});
			} finally {
				await anon.close();
			}

			// --- Email: the LOUD notice arrives; the QUIET one never does ---
			const loud = await drainUntilMail(pkpMail, {to: readerEmail, contains: numLoud});
			expect(loud[0].Subject).toContain('Just published');
			expect(loud[0].Subject).toContain(numLoud);
			// Bounded negative: the loud email (published LATER) is the control;
			// once it is in, a quiet notice would be too — assert there is none.
			pumpQueue();
			await pkpMail.expectNone({
				to: readerEmail,
				contains: numQuiet,
				afterControl: {to: readerEmail, contains: numLoud},
			});
		},
	);

	// Canonical scenario 7 — Unpublish an issue. A Published article in the
	// issue returns to SCHEDULED (issueId KEPT); the issue leaves Back Issues.
	test(
		'unpublish an issue returns its Published articles to Scheduled (issue kept)',
		{tag: ['@smoke', '@regression']},
		async ({page, pkpApi}) => {
			test.slow();
			const tag = uniqueTag();
			const journalPath = await scratchJournal(pkpApi, {
				tag,
				issues: [{volume: 4, number: 1, year: 2024, published: true}],
			});
			const issue = await firstIssue(page, journalPath, 1);
			// A VoR published into the (now published) issue → STATUS_PUBLISHED.
			const {submission, publications} = await pkpApi.createSubmission(
				scheduledIntoIssueSpec({tag: `${tag}s`, title: `Unpub ${tag}`, journal: journalPath, volume: 4, number: 1, year: 2024}),
			);
			const pubId = publications[0].id;
			expect(publications[0].status).toBe(PUB_STATUS_PUBLISHED);

			const issuePage = new IssuePage(page);
			await issuePage.goto(journalPath);
			await issuePage.openBackTab();
			await issuePage.confirmRowAction(
				issuePage.backRow({volume: 4, number: 1, year: 2024}),
				'unpublish',
				{dialogText: CONFIRM_UNPUBLISH},
			);

			// The issue is now unpublished (a Future issue again)…
			await expect
				.poll(async () => (await fetchIssue(page, journalPath, issue.id)).published, {timeout: 15_000})
				.toBe(false);
			// …and its article is back to SCHEDULED, still assigned to the issue.
			const pub = await fetchPublication(page, journalPath, submission.id, pubId);
			expect(pub.status, 'article returned to Scheduled (not Queued)').toBe(PUB_STATUS_SCHEDULED);
			expect(pub.issueId, 'issue assignment kept').toBe(issue.id);
		},
	);

	// Canonical scenario 8 — Delete an issue. Its articles reset to no-issue /
	// Queued and return to the editing workflow (contrast with unpublish).
	test(
		'delete an issue returns its articles to the queue (no issue)',
		{tag: ['@smoke', '@regression']},
		async ({page, pkpApi}) => {
			test.slow();
			const tag = uniqueTag();
			const journalPath = await scratchJournal(pkpApi, {
				tag,
				issues: [{volume: 6, number: 1, year: 2029, published: false}],
			});
			const {submission, publications} = await pkpApi.createSubmission(
				scheduledIntoIssueSpec({tag: `${tag}s`, title: `Delete ${tag}`, journal: journalPath, volume: 6, number: 1, year: 2029}),
			);
			const pubId = publications[0].id;
			expect(publications[0].status).toBe(PUB_STATUS_SCHEDULED);

			const issuePage = new IssuePage(page);
			await issuePage.goto(journalPath);
			await issuePage.confirmRowAction(
				issuePage.futureRow({volume: 6, number: 1, year: 2029}),
				'delete',
				{dialogText: CONFIRM_DELETE},
			);

			// The issue is gone…
			await expect
				.poll(async () => (await fetchIssues(page, journalPath, 0)).length, {timeout: 15_000})
				.toBe(0);
			// …and its article is back in the queue with no issue.
			const pub = await fetchPublication(page, journalPath, submission.id, pubId);
			expect(pub.issueId, 'issue assignment cleared').toBeNull();
			expect(pub.status).toBe(PUB_STATUS_QUEUED);
			expect((await fetchSubmission(page, journalPath, submission.id)).status).toBe(SUB_STATUS_QUEUED);
		},
	);

	// Canonical scenario 9 — Set the current issue. Seeding two back issues
	// leaves the LAST as current; setting the earlier one current moves the
	// journal's current pointer to it.
	test(
		'set the current issue moves the journal current pointer',
		{tag: '@regression'},
		async ({page, pkpApi}) => {
			test.slow();
			const tag = uniqueTag();
			const journalPath = await scratchJournal(pkpApi, {
				tag,
				issues: [
					{volume: 7, number: 1, year: 2022, published: true},
					{volume: 7, number: 2, year: 2023, published: true},
				],
			});
			const older = (await fetchIssues(page, journalPath, 1)).find(
				(i) => String(i.number) === '1',
			);
			// The last-published issue is current; the older one is not.
			expect((await fetchCurrentIssue(page, journalPath))?.id).not.toBe(older.id);

			const issuePage = new IssuePage(page);
			await issuePage.goto(journalPath);
			await issuePage.openBackTab();
			await issuePage.confirmRowAction(
				issuePage.backRow({volume: 7, number: 1, year: 2022}),
				'setCurrentIssue',
				{dialogText: CONFIRM_SET_CURRENT},
			);

			await expect
				.poll(async () => (await fetchCurrentIssue(page, journalPath))?.id, {timeout: 15_000})
				.toBe(older.id);
		},
	);

	// Canonical scenario 10 — Add an issue galley. On the Issue Galleys tab,
	// Add → label "PDF" + upload a full-issue file; the galley is stored.
	test(
		'add an issue galley (a full-issue file)',
		{tag: '@regression'},
		async ({page, pkpApi}) => {
			test.slow();
			const tag = uniqueTag();
			const journalPath = await scratchJournal(pkpApi, {
				tag,
				issues: [{volume: 8, number: 1, year: 2030, published: false}],
			});
			const issue = await firstIssue(page, journalPath, 0);
			const label = `PDF ${tag}`;

			const issuePage = new IssuePage(page);
			await issuePage.goto(journalPath);
			await issuePage.openIssueGalleysTab(
				issuePage.futureRow({volume: 8, number: 1, year: 2030}),
			);
			await issuePage.addIssueGalley({label, filePath: fixtureFilePath('default-article.pdf')});

			// The galley row shows in the grid…
			await expect(
				page.locator('#issueGalleysGridContainer').getByText(label),
			).toBeVisible({timeout: 15_000});
			// …and server truth: the issue carries a galley with that label.
			await expect
				.poll(
					async () =>
						((await fetchIssue(page, journalPath, issue.id)).galleys ?? []).map((g) => g.label),
					{timeout: 15_000},
				)
				.toContain(label);
		},
	);

	// Canonical scenario 11 — Permission boundary (managers only). A section
	// editor who CAN place an article into a published issue nonetheless cannot
	// reach the Issues page, cannot run its grid ops, and cannot list
	// unpublished issues over the API — while the manager can. Read-only against
	// publicknowledge (its seeded Future/Back issues; no mutation).
	test(
		'section editor cannot manage issues (page, grid op, unpublished-issue API)',
		{tag: ['@smoke', '@regression']},
		async ({page, asUser}) => {
			// --- Manager (dbarnes) reaches the surface ---
			await page.goto('/index.php/publicknowledge/manageIssues');
			await expect(
				page.locator('a[id^="component-grid-issues-futureissuegrid-addIssue-button-"]'),
			).toBeVisible({timeout: 15_000});
			const mgrApi = await page.request.get(
				'/index.php/publicknowledge/api/v1/issues?isPublished=0&count=10',
			);
			expect(mgrApi.status(), 'manager lists unpublished issues').toBe(200);

			// --- Section editor (dbuskins) is refused end to end ---
			const editorCtx = await asUser('dbuskins');

			// (a) The page bounces to access-denied (no Create Issue affordance).
			const editorPage = await editorCtx.newPage();
			await editorPage.goto('/index.php/publicknowledge/manageIssues');
			await expect(
				editorPage.locator('a[id^="component-grid-issues-futureissuegrid-addIssue-button-"]'),
			).toHaveCount(0);
			await expect(editorPage.getByText(/does not have access|not authorized|Access Denied/i).first())
				.toBeVisible({timeout: 15_000});

			// (b) The grid op itself returns the in-band JSON refusal.
			const gridRes = await editorCtx.request.get(
				'/index.php/publicknowledge/$$$call$$$/grid/issues/future-issue-grid/fetch-grid',
			);
			expect(await gridRes.text()).toContain(
				'The current role does not have access to this operation.',
			);

			// (c) The API refuses the unpublished-issue list with 403.
			const apiRes = await editorCtx.request.get(
				'/index.php/publicknowledge/api/v1/issues?isPublished=0&count=10',
			);
			expect(apiRes.status(), 'section editor unpublished issues').toBe(403);
			expect(await apiRes.text()).toContain(
				'You do not have permission to view unpublished issues.',
			);
		},
	);
});
