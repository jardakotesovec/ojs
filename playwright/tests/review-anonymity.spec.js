// @ts-check
const {test, expect} = require('../support/fixtures.js');
const {
	ReviewerSubmissionPage,
} = require('../../lib/pkp/playwright/pages/ReviewerSubmissionPage.js');
const {
	ReviewerManagerPage,
} = require('../../lib/pkp/playwright/pages/ReviewerManagerPage.js');

/**
 * Review anonymity — one test per canonical scenario of
 * docs/product/specs/review-anonymity.md (11 scenarios → 10 tests).
 *
 * This feature IS the cross-party visibility matrix: who may see whom
 * (reviewer↔author, reviewer↔reviewer, editor, public reader) under each
 * of the three review methods (double-anonymous / anonymous / open). Every
 * assertion drives the matrix AS THE PARTY — a real browser/API read as
 * the reviewer, the author, the editor, or the anonymous public — and
 * checks BOTH the rendered UI (redacted labels/avatars, the "View All
 * Submission Details" modal, the author's redacted Reviewers panel) AND
 * the server API read as that party (identity fields blanked server-side,
 * not merely hidden by a Vue v-if — spec rule 4).
 *
 * The redaction is method-scoped and driven off `review_method` alone:
 *   - Author → reviewer  hidden unless that review is OPEN (rule 3).
 *   - Reviewer → author  hidden only under DOUBLE-ANONYMOUS (rule 2).
 * Live-verified against the same shape the spec author probed
 * (publicknowledge submission with jjanssen double-anon, phudson anon,
 * amccrae open).
 *
 * Scenario → test mapping (see per-test comments):
 *   1        → double-anonymous hides the author from the reviewer
 *   2 + 3    → anonymous & open disclose the author to the reviewer
 *              (MERGED: both non-double-anon methods disclose the author;
 *              the single difference from double-anon is asserted once,
 *              parametrised over the anon + open reviewers — this is the
 *              pair-merge that lands the file at exactly 10 tests)
 *   4        → double-anonymous & anonymous hide the reviewer from the author
 *   5        → open reveals the reviewer to the author
 *   6        → the author's Reviewers panel lists only open + completed reviews
 *   7        → a reviewer sees a co-reviewer only when that co-review is open
 *   8        → the editor sees everything, always
 *   9        → only viewable comments, anonymously attributed, reach the author
 *   10       → public open-review display reveals a reviewer only when open
 *   11       → editor switches the method and the matrix follows
 *
 * Avoiding duplication with siblings (spec "owns the rule" boundary):
 *   - reviewer-response.spec.js owns the reviewer's SUBMISSION mechanics
 *     (accept/decline/complete); here we assert VISIBILITY on that surface,
 *     not the submission flow.
 *   - assign-and-manage-reviewers.spec.js owns the editor Reviewers grid and
 *     picking the Review Type; here we assert what each type REVEALS.
 *   - review-rounds-and-revisions.spec.js owns the round object + the
 *     author's round view; here we assert the redacted-Reviewers-panel rule
 *     it defers to this matrix (rule 5).
 *
 * Seeding (cost control): every test seeds ONE submission carrying all
 * three methods at once (double-anon jjanssen, anon phudson, open amccrae)
 * via the scenario API, then drives several matrix cells as different
 * parties against that single submission — mirroring the spec's "submission
 * 1 with three reviewers". The tag rides in the title for parallel
 * isolation. Reviewer status is chosen per test: `invited` where the
 * reviewer's own step-1 view (the natural author-visibility surface) must
 * render; `completed` where the author's open+completed panel and the
 * public/editor-confirmed reads require it.
 */

// ReviewAssignment::SUBMISSION_REVIEW_METHOD_* (review_method column values).
const METHOD = {ANONYMOUS: 1, DOUBLE_ANON: 2, OPEN: 3};

// ReviewAssignment::REVIEW_ASSIGNMENT_STATUS_COMPLETE (getStatus()).
const STATUS_COMPLETE = 8;

// The three seeded reviewers, one per method (matches the spec's sub 1).
// `method` is the scenario-spec string; `methodId` the review_method value.
const REVIEWERS = {
	doubleAnon: {user: 'jjanssen', method: 'doubleAnonymous', methodId: METHOD.DOUBLE_ANON, name: 'Julie Janssen'},
	anon: {user: 'phudson', method: 'anonymous', methodId: METHOD.ANONYMOUS, name: 'Paul Hudson'},
	open: {user: 'amccrae', method: 'open', methodId: METHOD.OPEN, name: 'Aisla McCrae'},
};

const AUTHOR = 'atester';
const AUTHOR_STRING = 'Author Tester'; // getAuthorString() substring
const EDITOR = 'dbarnes';

// Review Type labels (en) — editor.submissionReview.* keys, rendered as the
// sr-only span in ReviewMethodIcons and on the reviewer's own step-1 page.
const TYPE_LABEL = {
	[METHOD.DOUBLE_ANON]: 'Anonymous Reviewer/Anonymous Author',
	[METHOD.ANONYMOUS]: 'Anonymous Reviewer/Disclosed Author',
	[METHOD.OPEN]: 'Open',
};

// Default logged-in user for the `page` fixture: the deciding editor +
// API reader. Multi-actor cells open their own contexts via asUser.
test.use({user: EDITOR});

/** Unique, hyphenless alphanumeric tag (parallel isolation). */
function uniqueTag() {
	const workerIndex = test.info().parallelIndex;
	const suffix = Math.random().toString(36).slice(2, 8);
	return `ranon${workerIndex}x${suffix}`;
}

/**
 * A submitted submission in external review (round 1) on publicknowledge
 * carrying all three review methods at once. dbarnes is the editor,
 * atester the author.
 *
 * @param {object} opts
 * @param {string} opts.tag
 * @param {string} opts.title
 * @param {'invited'|'accepted'|'completed'} [opts.status='completed']
 * @param {string[]} [opts.only]  seed only these reviewer keys (default all three)
 * @param {Object<string,{toAuthor?:string,toEditor?:string}>} [opts.comments]  per reviewer-key comments (completed only)
 */
function matrixSpec({tag, title, status = 'completed', only, comments = {}}) {
	const keys = only ?? ['doubleAnon', 'anon', 'open'];
	const reviewers = keys.map((key) => {
		const r = REVIEWERS[key];
		/** @type {any} */
		const row = {user: r.user, method: r.method, status};
		if (status === 'completed') {
			row.recommendation = 'accept';
			if (comments[key]) {
				row.comments = comments[key];
			}
		}
		return row;
	});
	return {
		tag,
		journal: 'publicknowledge',
		submitter: AUTHOR,
		section: 'ART',
		locale: 'en',
		participants: [{user: EDITOR, role: 'editor'}],
		decisions: [{type: 'sendExternalReview', by: EDITOR}],
		reviewRounds: [{reviewers}],
		publications: [{metadata: {title: {en: title}}}],
	};
}

/**
 * Read a submission through the given request context, returning the full
 * schema map (publications[].authorsString + reviewAssignments[] with the
 * per-party anonymize gate already applied server-side).
 *
 * @param {import('@playwright/test').APIRequestContext} request
 * @param {number} submissionId
 */
async function fetchSubmissionAs(request, submissionId) {
	const res = await request.get(
		`/index.php/publicknowledge/api/v1/submissions/${submissionId}`,
	);
	if (!res.ok()) {
		throw new Error(
			`GET submission ${submissionId} failed: ${res.status()} ${await res.text()}`,
		);
	}
	return res.json();
}

/** The single reviewAssignment row for a given review_method value. */
function rowByMethod(submissionJson, method) {
	const rows = submissionJson.reviewAssignments || [];
	const row = rows.find((r) => r.reviewMethod === method);
	if (!row) {
		throw new Error(
			`No reviewAssignment with reviewMethod=${method}; got ${JSON.stringify(
				rows.map((r) => r.reviewMethod),
			)}`,
		);
	}
	return row;
}

/** Assert a reviewAssignment row is IDENTITY-BLANKED (redacted, rule 3). */
function expectRedacted(row) {
	expect(row.reviewerFullName).toBe('');
	expect(row.reviewerId).toBeNull();
	expect(row.reviewerDisplayInitials).toBe('');
	expect(row.reviewerHasOrcid).toBe(false);
}

/** Assert a reviewAssignment row is NAMED (identity disclosed). */
function expectNamed(row, fullName) {
	expect(row.reviewerFullName).toBe(fullName);
	expect(row.reviewerId).toBeGreaterThan(0);
	expect(row.reviewerDisplayInitials).not.toBe('');
}

/**
 * Open the reviewer's "View All Submission Details" modal on their own
 * step-1 view and return the metadata content container. Under
 * double-anonymous the author `<h4>` is omitted server-side
 * (ViewSubmissionMetadataHandler); under anonymous/open it is present.
 *
 * @param {import('@playwright/test').Page} page
 * @param {number} submissionId
 */
async function openReviewerMetadataModal(page, submissionId) {
	const rp = new ReviewerSubmissionPage(page);
	await rp.goto(submissionId);
	await expect(rp.step1Form).toBeVisible({timeout: 20_000});
	await page
		.getByRole('link', {name: 'View All Submission Details', exact: true})
		.click();
	const modal = page.getByRole('dialog', {name: 'View All Submission Details'});
	await expect(modal).toBeVisible({timeout: 15_000});
	// The modal body loads async; anchor on the metadata content div.
	const content = modal.locator('#viewSubmissionMetadata');
	await expect(content).toBeVisible({timeout: 15_000});
	return content;
}

test.describe('Review anonymity — the cross-party visibility matrix', () => {
	// ── Canonical scenario 1 ──────────────────────────────────────────────
	// Double-anonymous hides the author from the reviewer. As jjanssen (the
	// double-anon reviewer) the author is blank everywhere: the submission
	// API returns authorsString='' and empty authors, and the on-page "View
	// All Submission Details" modal shows the title but NO author name. The
	// reviewer's own step-1 view also names their method (rule 2).
	test(
		'double-anonymous hides the author from the reviewer',
		{tag: ['@smoke', '@regression']},
		async ({pkpApi, asUser}) => {
			test.slow();
			const tag = uniqueTag();
			const {submission} = await pkpApi.createSubmission(
				matrixSpec({tag, title: `RANON dblauthor ${tag}`, status: 'invited'}),
			);

			const reviewerCtx = await asUser(REVIEWERS.doubleAnon.user);

			// Server-side: the reviewer's own read blanks the author string.
			const asReviewer = await fetchSubmissionAs(reviewerCtx.request, submission.id);
			expect(asReviewer.publications[0].authorsString).toBe('');

			// UI: the metadata modal omits the author <h4>.
			const reviewerPage = await reviewerCtx.newPage();
			const content = await openReviewerMetadataModal(reviewerPage, submission.id);
			await expect(content).not.toContainText(AUTHOR_STRING);
			await expect(content.locator('h4')).toHaveCount(0);

			// The reviewer's own method label confirms which method redacted them.
			await expect(
				reviewerPage.locator('form#reviewStep1Form'),
			).toContainText(TYPE_LABEL[METHOD.DOUBLE_ANON]);
		},
	);

	// ── Canonical scenarios 2 + 3 (MERGED) ────────────────────────────────
	// Anonymous AND open both disclose the author to the reviewer — the one
	// difference from double-anonymous. One test, driven as BOTH the anon
	// reviewer (phudson) and the open reviewer (amccrae) against the same
	// submission: each reads the author via the submission API (authorsString
	// present) AND sees the author name in the "View All Submission Details"
	// modal. This is the pair-merge that lands the file at exactly 10 tests.
	test(
		'anonymous and open both disclose the author to the reviewer',
		{tag: '@regression'},
		async ({pkpApi, asUser}) => {
			test.slow();
			const tag = uniqueTag();
			const {submission} = await pkpApi.createSubmission(
				matrixSpec({tag, title: `RANON discloses ${tag}`, status: 'invited'}),
			);

			for (const key of ['anon', 'open']) {
				const {user} = REVIEWERS[key];
				const reviewerCtx = await asUser(user);

				// Server-side: the non-double-anon reviewer sees the author.
				const asReviewer = await fetchSubmissionAs(reviewerCtx.request, submission.id);
				expect(asReviewer.publications[0].authorsString).toContain(AUTHOR_STRING);

				// UI: the metadata modal names the author.
				const reviewerPage = await reviewerCtx.newPage();
				const content = await openReviewerMetadataModal(reviewerPage, submission.id);
				await expect(content).toContainText(AUTHOR_STRING);
				await reviewerPage.close();
			}
		},
	);

	// ── Canonical scenario 4 ──────────────────────────────────────────────
	// Double-anonymous & anonymous hide the reviewer from the author. As
	// atester (author) the submission API blanks the double-anon and anon
	// reviewers' identity server-side (reviewerFullName='', reviewerId=null,
	// no initials, no orcid), so the author cannot tell who reviewed. The
	// open reviewer stays named (asserted in sc5).
	test(
		'double-anonymous & anonymous hide the reviewer from the author',
		{tag: ['@smoke', '@regression']},
		async ({pkpApi, asUser}) => {
			const tag = uniqueTag();
			const {submission} = await pkpApi.createSubmission(
				matrixSpec({tag, title: `RANON authorblind ${tag}`}),
			);

			const authorCtx = await asUser(AUTHOR);
			const asAuthor = await fetchSubmissionAs(authorCtx.request, submission.id);

			// Both non-open reviews come back identity-blanked.
			expectRedacted(rowByMethod(asAuthor, METHOD.DOUBLE_ANON));
			expectRedacted(rowByMethod(asAuthor, METHOD.ANONYMOUS));

			// The author's own metadata is NOT blanked (they are not a reviewer).
			expect(asAuthor.publications[0].authorsString).toContain(AUTHOR_STRING);
		},
	);

	// ── Canonical scenario 5 ──────────────────────────────────────────────
	// Open reveals the reviewer to the author. For the same author read, the
	// open review (amccrae) is named server-side — full name + initials +
	// reviewerId — and the author's redacted Reviewers panel lists her (with
	// a Read Review action). The redacted panel is the mainline author UI
	// surface where a reviewer's identity reaches the author.
	test(
		'open reveals the reviewer to the author',
		{tag: ['@smoke', '@regression']},
		async ({pkpApi, asUser}) => {
			test.slow();
			const tag = uniqueTag();
			const {submission} = await pkpApi.createSubmission(
				matrixSpec({tag, title: `RANON openreveal ${tag}`}),
			);

			const authorCtx = await asUser(AUTHOR);

			// Server-side: the open review carries the reviewer's identity.
			const asAuthor = await fetchSubmissionAs(authorCtx.request, submission.id);
			const openRow = rowByMethod(asAuthor, METHOD.OPEN);
			expectNamed(openRow, REVIEWERS.open.name);
			expect(openRow.reviewerDisplayInitials).toBe('AM');

			// UI: the author's redacted panel lists the open reviewer with a
			// Read Review action.
			const authorPage = await authorCtx.newPage();
			const rm = new ReviewerManagerPage(authorPage);
			await rm.gotoAuthorWorkflow(submission.id);
			await expect(rm.row(REVIEWERS.open.name)).toContainText(REVIEWERS.open.name);
			await expect(
				rm.row(REVIEWERS.open.name).getByRole('button', {name: 'Read Review'}),
			).toBeVisible();
		},
	);

	// ── Canonical scenario 6 ──────────────────────────────────────────────
	// The author's Reviewers panel lists ONLY open + completed reviews.
	// Although all three reviews are completed, the author's redacted
	// ReviewerManager shows a single row (the open reviewer); the
	// double-anon and anon completed reviews never appear as rows at all
	// (rule 5). This is the redacted-listing rule review-rounds defers here.
	test(
		'the author Reviewers panel lists only open and completed reviews',
		{tag: '@regression'},
		async ({pkpApi, asUser}) => {
			test.slow();
			const tag = uniqueTag();
			const {submission} = await pkpApi.createSubmission(
				matrixSpec({tag, title: `RANON onlyopen ${tag}`}),
			);

			const authorCtx = await asUser(AUTHOR);
			const authorPage = await authorCtx.newPage();
			const rm = new ReviewerManagerPage(authorPage);
			await rm.gotoAuthorWorkflow(submission.id);

			// Exactly one row: the open reviewer.
			await expect(rm.row(REVIEWERS.open.name)).toBeVisible();
			await expect(rm.manager.locator('tbody tr')).toHaveCount(1);

			// The two non-open (yet completed) reviews are absent as rows.
			await expect(rm.row(REVIEWERS.doubleAnon.name)).toHaveCount(0);
			await expect(rm.row(REVIEWERS.anon.name)).toHaveCount(0);
		},
	);

	// ── Canonical scenario 7 ──────────────────────────────────────────────
	// A reviewer sees a co-reviewer only when that co-review is OPEN — and a
	// reviewer's OWN method does not change what co-reviewers they can see.
	// As jjanssen (double-anon) and as phudson (anon), each sees their own
	// row named + the open co-reviewer (amccrae) named, while the other
	// non-open co-review is blanked (rule 3).
	test(
		'a reviewer sees a co-reviewer only when that co-review is open',
		{tag: '@regression'},
		async ({pkpApi, asUser}) => {
			test.slow();
			const tag = uniqueTag();
			const {submission} = await pkpApi.createSubmission(
				matrixSpec({tag, title: `RANON coreviewer ${tag}`}),
			);

			// As the double-anonymous reviewer.
			const janssenCtx = await asUser(REVIEWERS.doubleAnon.user);
			const asJanssen = await fetchSubmissionAs(janssenCtx.request, submission.id);
			const janssenOwn = rowByMethod(asJanssen, METHOD.DOUBLE_ANON);
			expect(janssenOwn.isCurrentUserAssigned).toBe(true);
			expectNamed(janssenOwn, REVIEWERS.doubleAnon.name); // own row un-redacted
			expectNamed(rowByMethod(asJanssen, METHOD.OPEN), REVIEWERS.open.name);
			expectRedacted(rowByMethod(asJanssen, METHOD.ANONYMOUS)); // non-open co blanked

			// As the anonymous reviewer — own method differs, but the co-review
			// visibility is identical (keyed on the CO-review's method).
			const hudsonCtx = await asUser(REVIEWERS.anon.user);
			const asHudson = await fetchSubmissionAs(hudsonCtx.request, submission.id);
			const hudsonOwn = rowByMethod(asHudson, METHOD.ANONYMOUS);
			expect(hudsonOwn.isCurrentUserAssigned).toBe(true);
			expectNamed(hudsonOwn, REVIEWERS.anon.name);
			expectNamed(rowByMethod(asHudson, METHOD.OPEN), REVIEWERS.open.name);
			expectRedacted(rowByMethod(asHudson, METHOD.DOUBLE_ANON));
		},
	);

	// ── Canonical scenario 8 ──────────────────────────────────────────────
	// The editor sees everything, always. On the same submission the editor
	// reads all three reviewers' real names AND the author via the API (no
	// anonymize flag on any editorial read path), and the editor Reviewers
	// grid lists all three by name with their Review Type label (rule 6).
	test(
		'the editor sees everything, always',
		{tag: ['@smoke', '@regression']},
		async ({page, pkpApi}) => {
			test.slow();
			const tag = uniqueTag();
			const {submission} = await pkpApi.createSubmission(
				matrixSpec({tag, title: `RANON editorall ${tag}`}),
			);

			// Server-side: every reviewer named, author present (page is dbarnes).
			const asEditor = await fetchSubmissionAs(page.request, submission.id);
			expectNamed(rowByMethod(asEditor, METHOD.DOUBLE_ANON), REVIEWERS.doubleAnon.name);
			expectNamed(rowByMethod(asEditor, METHOD.ANONYMOUS), REVIEWERS.anon.name);
			expectNamed(rowByMethod(asEditor, METHOD.OPEN), REVIEWERS.open.name);
			expect(asEditor.publications[0].authorsString).toContain(AUTHOR_STRING);

			// UI: the editor grid lists all three by name + their Type label.
			const rm = new ReviewerManagerPage(page);
			await rm.gotoWorkflow(submission.id);
			for (const key of ['doubleAnon', 'anon', 'open']) {
				const {name, methodId} = REVIEWERS[key];
				await expect(rm.row(name)).toContainText(name);
				await expect(rm.reviewTypeLabel(name, TYPE_LABEL[methodId])).toBeVisible();
			}
		},
	);

	// ── Canonical scenario 9 ──────────────────────────────────────────────
	// Only VIEWABLE comments, anonymously attributed, reach the author. The
	// open reviewer (the only review the author can open — rule 5) submits a
	// "For author and editor" comment and a "For editor" comment; the
	// author's Read-Review modal surfaces the viewable one and NOT the
	// editor-only one (rule 8a), attributed by the open reviewer's name.
	test(
		'only viewable comments reach the author',
		{tag: '@regression'},
		async ({pkpApi, asUser}) => {
			test.slow();
			const tag = uniqueTag();
			const shared = `Shared with author ${tag}`;
			const editorOnly = `Editor eyes only ${tag}`;
			const {submission} = await pkpApi.createSubmission(
				matrixSpec({
					tag,
					title: `RANON comments ${tag}`,
					comments: {open: {toAuthor: shared, toEditor: editorOnly}},
				}),
			);

			const authorCtx = await asUser(AUTHOR);
			const authorPage = await authorCtx.newPage();
			const rm = new ReviewerManagerPage(authorPage);
			await rm.gotoAuthorWorkflow(submission.id);

			// The author opens the open review (the only one listed to them).
			await rm
				.row(REVIEWERS.open.name)
				.getByRole('button', {name: 'Read Review'})
				.click();
			const modal = authorPage.getByRole('dialog', {name: /Review:/});
			await expect(modal).toBeVisible({timeout: 15_000});

			// The viewable comment reaches the author; the editor-only one never
			// does (viewable-only filter).
			await expect(modal).toContainText(shared, {timeout: 15_000});
			await expect(modal).not.toContainText(editorOnly);
		},
	);

	// ── Canonical scenario 10 ─────────────────────────────────────────────
	// Public open-review display reveals a reviewer only when OPEN. With the
	// double-anon and open reviews both marked publicly visible + accepted +
	// editor-confirmed, the public peer-review API names the open reviewer
	// (full name + reviewerId) but keeps the double-anon review anonymous
	// (isReviewOpen=false, reviewerFullName=null) — it appears, but unnamed
	// (rule 10). The publicly-visible flag is set through the editor's real
	// Edit Review modal ("Publicly Show Reviewer Comments").
	test(
		'public open-review display reveals a reviewer only when open',
		{tag: '@regression'},
		async ({page, pkpApi, browser}) => {
			test.slow();
			const tag = uniqueTag();
			const {submission} = await pkpApi.createSubmission(
				matrixSpec({
					tag,
					title: `RANON public ${tag}`,
					only: ['doubleAnon', 'open'],
				}),
			);
			const editorView = await fetchSubmissionAs(page.request, submission.id);
			const publicationId = editorView.publications[0].id;

			// Editor marks both reviews publicly visible via the Edit modal.
			const rm = new ReviewerManagerPage(page);
			await rm.gotoWorkflow(submission.id);
			for (const key of ['doubleAnon', 'open']) {
				const {modal, form} = await rm.openEditReviewModal(REVIEWERS[key].name);
				await form.locator('#isReviewPubliclyVisible').check();
				await rm.ensureDueDatesOrdered(form);
				await rm.submitLegacyForm(form, 'OK', modal);
			}

			// A fresh anonymous public context reads the open peer-review API.
			const anonCtx = await browser.newContext({
				storageState: {cookies: [], origins: []},
			});
			const res = await anonCtx.request.get(
				`/index.php/publicknowledge/api/v1/peerReviews/open/publications/${publicationId}`,
			);
			expect(res.ok()).toBeTruthy();
			const reviews = ((await res.json()).reviewRounds || []).flatMap(
				(r) => r.reviews || [],
			);
			const openReview = reviews.find((r) => r.isReviewOpen === true);
			const closedReview = reviews.find((r) => r.isReviewOpen === false);

			// The open review names its reviewer.
			expect(openReview).toBeTruthy();
			expect(openReview.reviewerFullName).toBe(REVIEWERS.open.name);
			expect(openReview.reviewerId).toBeGreaterThan(0);

			// The double-anon review appears publicly but stays anonymous.
			expect(closedReview).toBeTruthy();
			expect(closedReview.reviewerFullName).toBeNull();
			expect(closedReview.reviewerId).toBeNull();

			await anonCtx.close();
		},
	);

	// ── Canonical scenario 11 ─────────────────────────────────────────────
	// The editor switches the method and the matrix follows — no snapshot.
	// The editor changes jjanssen's Review Type from double-anonymous to
	// open through the real Edit Review modal; on the NEXT read every cell
	// for that reviewer re-shapes: the author now sees the reviewer named
	// (was blanked) AND the reviewer now sees the author (authorsString was
	// blank, now disclosed).
	test(
		'editor switches the method and the matrix follows',
		{tag: '@regression'},
		async ({page, pkpApi, asUser}) => {
			test.slow();
			const tag = uniqueTag();
			// Accepted (not completed): method is editable before completion.
			const {submission} = await pkpApi.createSubmission(
				matrixSpec({
					tag,
					title: `RANON switch ${tag}`,
					status: 'accepted',
					only: ['doubleAnon'],
				}),
			);

			const authorCtx = await asUser(AUTHOR);
			const reviewerCtx = await asUser(REVIEWERS.doubleAnon.user);

			// BEFORE — double-anonymous: reviewer blanked to author; author
			// blanked to reviewer.
			const authorBefore = await fetchSubmissionAs(authorCtx.request, submission.id);
			expectRedacted(rowByMethod(authorBefore, METHOD.DOUBLE_ANON));
			const reviewerBefore = await fetchSubmissionAs(reviewerCtx.request, submission.id);
			expect(reviewerBefore.publications[0].authorsString).toBe('');

			// The editor flips the Review Type double-anonymous → open.
			const rm = new ReviewerManagerPage(page);
			await rm.gotoWorkflow(submission.id);
			const {modal, form} = await rm.openEditReviewModal(REVIEWERS.doubleAnon.name);
			await rm.reviewMethodRadio(form, METHOD.OPEN).check();
			await rm.ensureDueDatesOrdered(form);
			await rm.submitLegacyForm(form, 'OK', modal);

			// Persisted as open.
			await expect
				.poll(async () => rowByMethod(await fetchSubmissionAs(page.request, submission.id), METHOD.OPEN)?.reviewMethod)
				.toBe(METHOD.OPEN);

			// AFTER — open: both axes re-shape on the next read, no snapshot.
			const authorAfter = await fetchSubmissionAs(authorCtx.request, submission.id);
			expectNamed(rowByMethod(authorAfter, METHOD.OPEN), REVIEWERS.doubleAnon.name);
			const reviewerAfter = await fetchSubmissionAs(reviewerCtx.request, submission.id);
			expect(reviewerAfter.publications[0].authorsString).toContain(AUTHOR_STRING);
		},
	);
});
