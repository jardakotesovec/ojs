// @ts-check
const path = require('path');
const {test, expect} = require('../support/fixtures.js');
const {EditorialWorkflowPage} = require('../pages/EditorialWorkflowPage.js');
const {ReviewRoundPanel} = require('../../lib/pkp/playwright/pages/ReviewRoundPanel.js');

/**
 * Review rounds and revisions — the round *object* and its own lifecycle
 * on the External Review stage. One test per canonical scenario of
 * docs/product/specs/review-rounds-and-revisions.md (12 scenarios → 11
 * tests).
 *
 * Scenario → test mapping (see per-test comments):
 *   1  → author revises in place (REVISIONS_REQUESTED → REVISIONS_SUBMITTED)
 *   2  → resubmit for review, author uploads (RESUBMIT_FOR_REVIEW → …_SUBMITTED)
 *   3 + 6 (MERGED) → open a 2nd round + browse the prior round: both are the
 *        round-selector / round-history surface. editorial-decisions already
 *        owns the "New Round opens round 2" transition; this test asserts the
 *        ROUND-navigation effects (menu lists both rounds, past round has no
 *        decision bar, current round does) + the ⚠ round-1 status recompute.
 *   4  → cancel a review round (round-object deletion, round-lifecycle)
 *   5  → round status tracks its reviewers (computed PENDING_REVIEWS / REVIEWS_COMPLETED)
 *   7  → editor requests a written author response
 *   8  → author submits the written response; editor sees View/Delete
 *   9  → only one response per round (409)
 *   10 → author's read-mostly round view (round-object surfaces + ⚠ editor-phrasing deviation)
 *   11 → permission boundary (reviewer / author gates + 422 before reviews complete)
 *   12 → files carry into the round (review_round_files scoping)
 *
 * Avoiding duplication with siblings:
 *   - editorial-decisions.spec.js OWNS the decision TRANSITIONS
 *     (RequestRevisions / Resubmit / NewRound / CancelRound → stored round
 *     status). Here the decisions are SEEDED via the scenario API and each
 *     test asserts the ROUND-side effect the decision spec does not: the
 *     AUTHOR-upload status flip, the round-status LABEL in the panel, the
 *     round-history navigation, the author-response cycle, review_round_files.
 *   - author-dashboard.spec.js owns the broad author read-mostly tracking
 *     view; test 10 here covers only the round-object surfaces + the
 *     status-label editor-phrasing deviation it does not assert.
 *   - reviewer-response.spec.js owns the reviewer's own journey.
 *
 * Seeding (cost control): rounds/reviewers/decisions are seeded directly in
 * the needed state via the scenario API; only the DISTINCTIVE round mechanics
 * (author revision upload, author-response request/submit) are driven through
 * the UI. The tag rides in the submission title (reaching every email body)
 * AND is woven into composed subjects; Mailpit reads are recipient+tag scoped
 * (never clearAll).
 */

const ARTICLE_FIXTURE = path.resolve(
	__dirname,
	'..',
	'..',
	'lib',
	'pkp',
	'playwright',
	'fixtures',
	'files',
	'default-article.pdf',
);

// Workflow stages (PKPApplication WORKFLOW_STAGE_ID_*).
const STAGE_SUBMISSION = 1;
const STAGE_REVIEW = 3;

// Review-round status (ReviewRound REVIEW_ROUND_STATUS_*).
const ROUND_REVISIONS_REQUESTED = 1;
const ROUND_RESUBMIT_FOR_REVIEW = 2;
const ROUND_PENDING_REVIEWS = 7;
const ROUND_REVIEWS_COMPLETED = 9;
const ROUND_REVISIONS_SUBMITTED = 11;
const ROUND_RESUBMIT_FOR_REVIEW_SUBMITTED = 15;

// Submission file stage (SubmissionFile SUBMISSION_FILE_REVIEW_REVISION).
const FILE_STAGE_REVIEW_REVISION = 15;

// Decision constants (APP\decision\Decision::*).
const DECISION_NEW_EXTERNAL_ROUND = 14;

// Round-status labels (en) — live-verified in the spec.
const LABEL_REVISIONS_REQUESTED = 'Revisions have been requested.';
const LABEL_REVISIONS_SUBMITTED =
	'Revisions have been submitted and a decision is needed.';
const LABEL_AWAITING_REVIEWERS = 'Awaiting responses from reviewers.';
const LABEL_REVIEWS_COMPLETED =
	'All reviews are confirmed and a decision is needed.';

const AUTHOR_EMAIL = 'atester@mailinator.com';
const ATESTER_NAME = 'Author Tester';
const MAIL_TIMEOUT = 30_000;

/** A unique, hyphenless, alphanumeric tag (parallel isolation + mail scoping). */
function uniqueTag() {
	const workerLetter = String.fromCharCode(97 + (test.info().parallelIndex % 26));
	const suffix = Math.random().toString(36).slice(2, 8);
	return `rrr${workerLetter}${suffix}`;
}

/**
 * A submitted submission in external review (round 1) on publicknowledge,
 * with the tag woven into the title. dbarnes is the deciding editor and
 * atester the assigned author. Extend with `decisions` / `reviewers`.
 *
 * @param {object} opts
 * @param {string} opts.tag
 * @param {string} opts.title
 * @param {object[]} [opts.decisions]  decisions AFTER sendExternalReview
 * @param {object[]} [opts.reviewers]  round-1 reviewers
 */
function inReviewSpec({tag, title, decisions = [], reviewers = []}) {
	return {
		tag,
		journal: 'publicknowledge',
		submitter: 'atester',
		section: 'ART',
		locale: 'en',
		participants: [{user: 'dbarnes', role: 'editor'}],
		decisions: [{type: 'sendExternalReview', by: 'dbarnes'}, ...decisions],
		reviewRounds: [{reviewers}],
		publications: [{metadata: {title: {en: title}}}],
	};
}

/** The current (last) review round from a submission GET payload. */
function currentRound(submission) {
	const rounds = submission.reviewRounds || [];
	return rounds[rounds.length - 1];
}

/**
 * Fetch a submission as JSON through the given request context.
 *
 * @param {import('@playwright/test').APIRequestContext} request
 * @param {number} submissionId
 */
async function fetchSubmission(request, submissionId) {
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

/**
 * The current user's CSRF token, read from a mounted backend page.
 *
 * @param {import('@playwright/test').Page} page
 */
async function csrfToken(page) {
	const token = await page.evaluate(
		// @ts-ignore pkp is a page global on backend pages
		() => window.pkp?.currentUser?.csrfToken,
	);
	if (!token) {
		throw new Error('No csrf token on this page — is a backend page loaded?');
	}
	return token;
}

/**
 * Open a page in the given context on the always-accessible user profile
 * and return {page, token} for API POSTs that need CSRF.
 *
 * @param {import('@playwright/test').BrowserContext} ctx
 */
async function openWithCsrf(ctx) {
	const page = await ctx.newPage();
	await page.goto('/index.php/index/en/user/profile');
	await expect
		.poll(
			() =>
				page.evaluate(
					// @ts-ignore pkp is a page global on backend pages
					() => window.pkp?.currentUser?.csrfToken ?? null,
				),
			{timeout: 20_000},
		)
		.not.toBeNull();
	return {page, token: await csrfToken(page)};
}

test.use({user: 'dbarnes'}); // the deciding editor + API reader

test.describe('Review rounds and revisions', () => {
	// Canonical scenario 1 — the editor's Request-Revisions decision leaves
	// the round REVISIONS_REQUESTED (seeded); the AUTHOR opens their round
	// view, uses "Upload revisions", and the round recomputes to
	// REVISIONS_SUBMITTED. This is the distinctive author-upload half of the
	// revision cycle (editorial-decisions owns only the decision→status-1
	// transition; the flip to status 11 is asserted nowhere else).
	test(
		'request revisions, author revises in place',
		{tag: ['@smoke', '@regression']},
		async ({page, pkpApi, asUser}) => {
			test.slow(); // author round-trip + legacy upload wizard
			const tag = uniqueTag();
			const {submission} = await pkpApi.createSubmission(
				inReviewSpec({
					tag,
					title: `Revise in place ${tag}`,
					decisions: [{type: 'requestRevisions', by: 'dbarnes'}],
					reviewers: [
						{
							user: 'jjanssen',
							method: 'anonymous',
							status: 'completed',
							recommendation: 'pendingRevisions',
						},
					],
				}),
			);

			// Seeded state: round is REVISIONS_REQUESTED.
			let after = await fetchSubmission(page.request, submission.id);
			expect(currentRound(after).statusId).toBe(ROUND_REVISIONS_REQUESTED);

			// The author opens their read-mostly round view and uploads a
			// revision through the "Upload revisions" wizard.
			const authorCtx = await asUser('atester');
			const authorPage = await authorCtx.newPage();
			const round = new ReviewRoundPanel(authorPage);
			await round.gotoAuthor(submission.id);

			// The round-status label shows the revisions-requested phrasing.
			await round.expectRoundStatus(1, LABEL_REVISIONS_REQUESTED);

			await round.uploadRevision({
				filePath: ARTICLE_FIXTURE,
				displayName: `Revised manuscript ${tag}`,
			});

			// Uploading a revision recomputes the round to REVISIONS_SUBMITTED,
			// end-to-end (spec rule 4 / sub 172).
			await expect
				.poll(
					async () =>
						currentRound(await fetchSubmission(page.request, submission.id))
							.statusId,
					{timeout: 20_000},
				)
				.toBe(ROUND_REVISIONS_SUBMITTED);

			// …and the author's own Status card reflects the new label.
			await round.expectRoundStatus(1, LABEL_REVISIONS_SUBMITTED);
		},
	);

	// Canonical scenario 2 — the same revision cycle, but the decision was
	// Resubmit For Review: the round is RESUBMIT_FOR_REVIEW (seeded), and the
	// author's upload advances it to RESUBMIT_FOR_REVIEW_SUBMITTED by the same
	// predicate (the editor is then expected to open a fresh round).
	test(
		'resubmit for review, author uploads a revision',
		{tag: '@regression'},
		async ({page, pkpApi, asUser}) => {
			test.slow();
			const tag = uniqueTag();
			const {submission} = await pkpApi.createSubmission(
				inReviewSpec({
					tag,
					title: `Resubmit upload ${tag}`,
					decisions: [{type: 'resubmit', by: 'dbarnes'}],
					reviewers: [
						{
							user: 'jjanssen',
							method: 'anonymous',
							status: 'completed',
							recommendation: 'resubmitHere',
						},
					],
				}),
			);

			let after = await fetchSubmission(page.request, submission.id);
			expect(currentRound(after).statusId).toBe(ROUND_RESUBMIT_FOR_REVIEW);

			const authorCtx = await asUser('atester');
			const authorPage = await authorCtx.newPage();
			const round = new ReviewRoundPanel(authorPage);
			await round.gotoAuthor(submission.id);
			await expect(round.statusHeading(1)).toBeVisible({timeout: 20_000});

			await round.uploadRevision({
				filePath: ARTICLE_FIXTURE,
				displayName: `Resubmission ${tag}`,
			});

			await expect
				.poll(
					async () =>
						currentRound(await fetchSubmission(page.request, submission.id))
							.statusId,
					{timeout: 20_000},
				)
				.toBe(ROUND_RESUBMIT_FOR_REVIEW_SUBMITTED);
		},
	);

	// Canonical scenarios 3 + 6 (MERGED) — the round selector IS the history.
	// A two-round submission (seeded) lists Review Round 1 + 2 in the menu;
	// selecting the PAST round 1 re-scopes the panel and shows NO decision
	// buttons, while the current round 2 keeps the full decision bar. The ⚠
	// side-effect: opening round 2 reset round 1's stored REVISIONS_REQUESTED,
	// so round 1's label recomputes from its (completed) reviewer to
	// REVIEWS_COMPLETED, not a revisions status.
	test(
		'open a second round and browse the prior round',
		{tag: '@regression'},
		async ({page, pkpApi}) => {
			test.slow();
			const tag = uniqueTag();
			const {submission} = await pkpApi.createSubmission({
				tag,
				journal: 'publicknowledge',
				submitter: 'atester',
				section: 'ART',
				locale: 'en',
				participants: [{user: 'dbarnes', role: 'editor'}],
				decisions: [
					{type: 'sendExternalReview', by: 'dbarnes'},
					{type: 'requestRevisions', by: 'dbarnes'},
					{type: 'newExternalRound', by: 'dbarnes'},
				],
				reviewRounds: [
					{
						reviewers: [
							{
								user: 'phudson',
								method: 'anonymous',
								status: 'completed',
								recommendation: 'pendingRevisions',
							},
						],
					},
					{reviewers: [{user: 'jjanssen', method: 'anonymous', status: 'invited'}]},
				],
				publications: [{metadata: {title: {en: `Two rounds ${tag}`}}}],
			});

			const after = await fetchSubmission(page.request, submission.id);
			expect(after.reviewRounds).toHaveLength(2);
			const round1Id = after.reviewRounds[0].id;
			const round2Id = after.reviewRounds[1].id;
			expect(after.reviewRounds[1].round).toBe(2);
			// ⚠ Deviation: round 1's stored REVISIONS_REQUESTED was wiped by
			// opening round 2 — it recomputes from its completed reviewer.
			expect(after.reviewRounds[0].statusId).toBe(ROUND_REVIEWS_COMPLETED);

			const workflow = new EditorialWorkflowPage(page);
			await workflow.goto(submission.id);

			const nav = workflow.workflowModal().locator('nav');
			await expect(
				nav.getByText('Review Round 1', {exact: true}),
			).toBeVisible({timeout: 20_000});
			await expect(
				nav.getByText('Review Round 2', {exact: true}),
			).toBeVisible();

			// Current round 2 carries the decision bar.
			await workflow.openReviewRoundPanel(2);
			await page.waitForURL(
				new RegExp(`workflowMenuKey=workflow_3_${round2Id}`),
				{timeout: 20_000, waitUntil: 'commit'},
			);
			await expect(
				workflow.workflowModal().getByRole('button', {
					name: 'Request Revisions',
					exact: true,
				}),
			).toBeVisible({timeout: 20_000});

			// The PAST round 1 re-scopes the panel and drops the decision bar.
			await workflow.openReviewRoundPanel(1);
			await page.waitForURL(
				new RegExp(`workflowMenuKey=workflow_3_${round1Id}`),
				{timeout: 20_000, waitUntil: 'commit'},
			);
			// Anchor on the past-round Status card (generic "Status" heading),
			// then assert the decision buttons are gone.
			await expect(
				workflow.workflowModal().getByRole('heading', {name: 'Status', exact: true}),
			).toBeVisible({timeout: 20_000});
			for (const decision of ['Request Revisions', 'Accept Submission', 'Decline']) {
				await expect(
					workflow.workflowModal().getByRole('button', {
						name: decision,
						exact: true,
					}),
				).toHaveCount(0);
			}
		},
	);

	// Canonical scenario 4 — Cancel Review Round deletes the round object.
	// editorial-decisions owns the stage/decision-history effects; here the
	// ROUND-lifecycle assertion is that the round row (the only one) is gone
	// afterwards and the submission drops back to Submission.
	test(
		'cancel a review round deletes the round',
		{tag: '@regression'},
		async ({page, pkpApi}) => {
			const tag = uniqueTag();
			const {submission} = await pkpApi.createSubmission(
				inReviewSpec({tag, title: `Cancel round ${tag}`, reviewers: []}),
			);

			let before = await fetchSubmission(page.request, submission.id);
			expect(before.reviewRounds).toHaveLength(1);

			const workflow = new EditorialWorkflowPage(page);
			await workflow.goto(submission.id);
			await workflow.clickDecision('Cancel Review Round');
			await workflow.setDecisionEmailBody(
				'notifyAuthors',
				`<p>Cancelling this round — ${tag}</p>`,
			);
			await workflow.recordDecision(); // one step (Notify Authors)
			await workflow.viewSubmissionFromCompletionDialog(submission.id);

			const after = await fetchSubmission(page.request, submission.id);
			expect(after.reviewRounds).toHaveLength(0); // round object deleted
			expect(after.stageId).toBe(STAGE_SUBMISSION); // only round → back to Submission
		},
	);

	// Canonical scenario 5 — the round status is computed from its reviewers
	// and recomputes on every reviewer event. Two seeds pin the endpoints of
	// that machine: a round with an invited reviewer reads PENDING_REVIEWS
	// ("Awaiting responses from reviewers."); a round whose reviewer completed
	// reads REVIEWS_COMPLETED ("All reviews are confirmed…"). No editor action
	// touches the round itself.
	test(
		'round status tracks its reviewers',
		{tag: '@regression'},
		async ({page, pkpApi}) => {
			const tag = uniqueTag();
			const {submission: pending} = await pkpApi.createSubmission(
				inReviewSpec({
					tag,
					title: `Awaiting ${tag}`,
					reviewers: [{user: 'jjanssen', method: 'anonymous', status: 'invited'}],
				}),
			);
			const {submission: done} = await pkpApi.createSubmission(
				inReviewSpec({
					tag,
					title: `Confirmed ${tag}`,
					reviewers: [
						{
							user: 'jjanssen',
							method: 'anonymous',
							status: 'completed',
							recommendation: 'accept',
						},
					],
				}),
			);

			// Computed statuses read straight off the round machine.
			expect(
				currentRound(await fetchSubmission(page.request, pending.id)).statusId,
			).toBe(ROUND_PENDING_REVIEWS);
			expect(
				currentRound(await fetchSubmission(page.request, done.id)).statusId,
			).toBe(ROUND_REVIEWS_COMPLETED);

			// The label surfaces in the editor's Round Status card.
			const workflow = new EditorialWorkflowPage(page);
			await workflow.goto(pending.id);
			await expect(
				workflow.workflowModal().getByRole('heading', {name: 'Round 1 Status'}),
			).toBeVisible({timeout: 20_000});
			await expect(
				workflow.workflowModal().getByText(LABEL_AWAITING_REVIEWERS),
			).toBeVisible();

			await workflow.goto(done.id);
			await expect(
				workflow.workflowModal().getByRole('heading', {name: 'Round 1 Status'}),
			).toBeVisible({timeout: 20_000});
			await expect(
				workflow.workflowModal().getByText(LABEL_REVIEWS_COMPLETED),
			).toBeVisible();
		},
	);

	// Canonical scenario 7 — on a round with completed reviews the editor's
	// Request Response button is enabled; composing and sending flips the
	// round's isAuthorResponseRequested flag and emails the assigned author
	// the RequestReviewRoundAuthorResponse mailable.
	test(
		'editor requests a written author response',
		{tag: '@regression'},
		async ({page, pkpApi, pkpMail}) => {
			test.slow(); // compose page + Mailpit
			const tag = uniqueTag();
			const {submission} = await pkpApi.createSubmission(
				inReviewSpec({
					tag,
					title: `Request response ${tag}`,
					reviewers: [
						{
							user: 'jjanssen',
							method: 'anonymous',
							status: 'completed',
							recommendation: 'accept',
						},
					],
				}),
			);

			const round = new ReviewRoundPanel(page);
			await round.gotoEditor(submission.id);
			// The Request Response button is enabled (reviews are complete).
			const requestButton = round
				.modal()
				.getByRole('button', {name: 'Request Response', exact: true});
			await expect(requestButton).toBeEnabled({timeout: 20_000});

			await round.requestAuthorResponse(tag);

			// The round's isAuthorResponseRequested flag flipped true.
			await expect
				.poll(
					async () =>
						currentRound(await fetchSubmission(page.request, submission.id))
							.isAuthorResponseRequested,
					{timeout: 20_000},
				)
				.toBeTruthy();

			// The author received the request email (tagged subject).
			const [mail] = await pkpMail.find({
				to: AUTHOR_EMAIL,
				contains: tag,
				timeoutMs: MAIL_TIMEOUT,
			});
			expect(mail).toBeTruthy();
		},
	);

	// Canonical scenario 8 — the author opens the Author Response form (shown
	// because the round is Revisions-Requested), writes a reply on behalf of a
	// contributor, and submits: the round's single response row is created and
	// shown back to the editor with View/Delete controls.
	test(
		'author submits the written response',
		{tag: ['@smoke', '@regression']},
		async ({page, pkpApi, asUser}) => {
			test.slow(); // author form + editor read-back
			const tag = uniqueTag();
			const {submission} = await pkpApi.createSubmission(
				inReviewSpec({
					tag,
					title: `Author response ${tag}`,
					decisions: [{type: 'requestRevisions', by: 'dbarnes'}],
					reviewers: [
						{
							user: 'jjanssen',
							method: 'anonymous',
							status: 'completed',
							recommendation: 'pendingRevisions',
						},
					],
				}),
			);

			// The author submits a response via the round's Author Response form.
			const authorCtx = await asUser('atester');
			const authorPage = await authorCtx.newPage();
			const authorRound = new ReviewRoundPanel(authorPage);
			await authorRound.submitAuthorResponse({
				submissionId: submission.id,
				responseHtml: `<p>Here is our point-by-point reply ${tag}</p>`,
				authorName: ATESTER_NAME,
			});

			// The round now carries exactly one response, on behalf of the author.
			const after = await fetchSubmission(page.request, submission.id);
			const response = currentRound(after).authorResponse;
			expect(response).toBeTruthy();
			expect(response.submittedByUser.fullName).toBe(ATESTER_NAME);

			// The editor sees the submitted response with View/Delete actions.
			const editorRound = new ReviewRoundPanel(page);
			await editorRound.gotoEditor(submission.id);
			const responseRow = editorRound
				.modal()
				.getByRole('row')
				.filter({hasText: `A response was submitted by ${ATESTER_NAME}`});
			await expect(responseRow).toBeVisible({timeout: 20_000});
			await responseRow
				.getByRole('button', {name: 'More Actions', exact: true})
				.click();
			// The menu portals to the document root (page-scoped menuitems).
			await expect(
				page.getByRole('menuitem', {name: 'View', exact: true}),
			).toBeVisible({timeout: 10_000});
			await expect(
				page.getByRole('menuitem', {name: 'Delete', exact: true}),
			).toBeVisible();
		},
	);

	// Canonical scenario 9 — exactly one response per round. With a response
	// already submitted, a second Request-Response attempt is refused (409).
	test(
		'only one response per round',
		{tag: '@regression'},
		async ({page, pkpApi, asUser}) => {
			test.slow();
			const tag = uniqueTag();
			const {submission} = await pkpApi.createSubmission(
				inReviewSpec({
					tag,
					title: `One response ${tag}`,
					decisions: [{type: 'requestRevisions', by: 'dbarnes'}],
					reviewers: [
						{
							user: 'jjanssen',
							method: 'anonymous',
							status: 'completed',
							recommendation: 'pendingRevisions',
						},
					],
				}),
			);
			const round = currentRound(
				await fetchSubmission(page.request, submission.id),
			);
			const roundId = round.id;

			// The publication's first author (the on-behalf-of contributor),
			// read through the editor's session.
			const pubRes = await page.request.get(
				`/index.php/publicknowledge/api/v1/submissions/${submission.id}/publications/${round.publicationId}`,
			);
			expect(pubRes.ok()).toBeTruthy();
			const authorId = (await pubRes.json()).authors[0].id;

			// The author submits the round's single response via the API.
			const authorCtx = await asUser('atester');
			const {page: authorPage, token: authorTok} = await openWithCsrf(authorCtx);
			const submitRes = await authorPage.request.post(
				`/index.php/publicknowledge/api/v1/reviews/${submission.id}/${roundId}/authorResponse`,
				{
					headers: {'X-Csrf-Token': authorTok},
					data: {
						submissionId: submission.id,
						reviewRoundId: roundId,
						authorResponse: {en: `<p>Our reply ${tag}</p>`},
						associatedAuthorIds: [authorId],
					},
				},
			);
			expect(submitRes.ok()).toBeTruthy();

			// A second Request-Response on the same round conflicts (409).
			const {page: editorPage, token: editorTok} = await openWithCsrf(
				await asUser('dbarnes'),
			);
			const conflict = await editorPage.request.post(
				`/index.php/publicknowledge/api/v1/reviews/${submission.id}/${roundId}/authorResponse/requestResponse`,
				{
					headers: {'X-Csrf-Token': editorTok},
					data: {
						submissionId: submission.id,
						reviewRoundId: roundId,
						subject: `x ${tag}`,
						body: `<p>y ${tag}</p>`,
						locale: 'en',
					},
				},
			);
			expect(conflict.status()).toBe(409);
		},
	);

	// Canonical scenario 10 — the author's read-mostly round view. The broad
	// tracking view is owned by author-dashboard; this test covers the
	// round-object surfaces it does not: the Author Response affordance
	// (offered while the round is Revisions-Requested) and the ⚠ deviation
	// that the round-status label shows the EDITOR phrasing even on the
	// author's own view. No files-for-review, no participant management.
	test(
		"author's read-mostly round view",
		{tag: '@regression'},
		async ({pkpApi, asUser}) => {
			const tag = uniqueTag();
			const {submission} = await pkpApi.createSubmission(
				inReviewSpec({
					tag,
					title: `Read mostly ${tag}`,
					decisions: [{type: 'requestRevisions', by: 'dbarnes'}],
					reviewers: [
						{
							user: 'jjanssen',
							method: 'anonymous',
							status: 'completed',
							recommendation: 'pendingRevisions',
						},
					],
				}),
			);

			const authorCtx = await asUser('atester');
			const authorPage = await authorCtx.newPage();
			const round = new ReviewRoundPanel(authorPage);
			await round.gotoAuthor(submission.id);

			// ⚠ The author sees the EDITOR-phrasing status label (schema map
			// builds `status` without the $isAuthor flag).
			await round.expectRoundStatus(1, LABEL_REVISIONS_REQUESTED);

			// The Author Response affordance is offered to the author.
			await expect(
				round.modal().getByRole('button', {name: 'Submit Response', exact: true}),
			).toBeVisible({timeout: 20_000});
			// Their own Revisions Uploaded panel is present and writable.
			await expect(
				round.modal().getByRole('heading', {name: 'Revisions Uploaded'}),
			).toBeVisible();

			// Read-mostly: no editor "Files for Review" panel, no participant
			// manager, no decision buttons.
			await expect(
				round.modal().getByRole('heading', {name: 'Files for Review'}),
			).toHaveCount(0);
			await expect(
				round.modal().locator('[data-cy="participant-manager"]'),
			).toHaveCount(0);
			await expect(
				round.modal().getByRole('button', {name: 'Request Revisions', exact: true}),
			).toHaveCount(0);
		},
	);

	// Canonical scenario 11 — the round surfaces are gated. A reviewer cannot
	// read the round (submission API refuses the reviewer role); an author
	// cannot request an author response, nor open a new review round; and
	// requesting a response before reviews are complete is refused (422).
	test(
		'permission boundaries on the round surfaces',
		{tag: '@regression'},
		async ({page, pkpApi, asUser}) => {
			test.slow(); // three actors
			const tag = uniqueTag();
			const {submission} = await pkpApi.createSubmission(
				inReviewSpec({
					tag,
					title: `Round authz ${tag}`,
					// Only an INVITED reviewer — reviews are NOT complete.
					reviewers: [{user: 'jjanssen', method: 'anonymous', status: 'invited'}],
				}),
			);
			const roundId = currentRound(
				await fetchSubmission(page.request, submission.id),
			).id;
			const reviewsBase = `/index.php/publicknowledge/api/v1/reviews/${submission.id}/${roundId}/authorResponse`;
			const decisionsUrl = `/index.php/publicknowledge/api/v1/submissions/${submission.id}/decisions`;

			// A reviewer cannot act on the round panel — the round-panel
			// author-response action refuses the reviewer role.
			const {page: reviewerPage, token: reviewerTok} = await openWithCsrf(
				await asUser('jjanssen'),
			);
			const fullRequestBody = {
				submissionId: submission.id,
				reviewRoundId: roundId,
				subject: `s ${tag}`,
				body: `<p>b ${tag}</p>`,
				locale: 'en',
			};
			const reviewerAct = await reviewerPage.request.post(
				`${reviewsBase}/requestResponse`,
				{headers: {'X-Csrf-Token': reviewerTok}, data: fullRequestBody},
			);
			expect(reviewerAct.ok()).toBeFalsy();
			expect([401, 403]).toContain(reviewerAct.status());

			// The editor's Request-Response is refused while reviews are
			// incomplete (422) — the round's only reviewer is still invited.
			const {page: editorPage, token: editorTok} = await openWithCsrf(
				await asUser('dbarnes'),
			);
			const early = await editorPage.request.post(`${reviewsBase}/requestResponse`, {
				headers: {'X-Csrf-Token': editorTok},
				data: fullRequestBody,
			});
			expect(early.status()).toBe(422);

			// The author cannot request an author response…
			const {page: authorPage, token: authorTok} = await openWithCsrf(
				await asUser('atester'),
			);
			const authorRequest = await authorPage.request.post(
				`${reviewsBase}/requestResponse`,
				{headers: {'X-Csrf-Token': authorTok}, data: fullRequestBody},
			);
			expect(authorRequest.ok()).toBeFalsy();
			expect([401, 403]).toContain(authorRequest.status());

			// …nor open a new review round.
			const authorNewRound = await authorPage.request.post(decisionsUrl, {
				headers: {'X-Csrf-Token': authorTok},
				data: {decision: DECISION_NEW_EXTERNAL_ROUND, reviewRoundId: roundId},
			});
			expect(authorNewRound.ok()).toBeFalsy();
			expect([401, 403]).toContain(authorNewRound.status());
		},
	);

	// Canonical scenario 12 — files carry into the round. On a two-round
	// submission the author's revision (uploaded into the current round 2)
	// lands as a round-scoped file (review_round_files,
	// SUBMISSION_FILE_REVIEW_REVISION assoc'd to that round): a listing scoped
	// to round 2 returns it, while the SAME listing scoped to the prior round 1
	// does not — switching rounds shows each round's own files.
	test(
		'files carry into the round (review_round_files)',
		{tag: '@regression'},
		async ({page, pkpApi, asUser}) => {
			test.slow(); // author upload wizard on a two-round submission
			const tag = uniqueTag();
			const {submission} = await pkpApi.createSubmission({
				tag,
				journal: 'publicknowledge',
				submitter: 'atester',
				section: 'ART',
				locale: 'en',
				participants: [{user: 'dbarnes', role: 'editor'}],
				// round 1 closes; round 2 opens and is put into revisions-requested
				// so the author can upload into it.
				decisions: [
					{type: 'sendExternalReview', by: 'dbarnes'},
					{type: 'requestRevisions', by: 'dbarnes'},
					{type: 'newExternalRound', by: 'dbarnes'},
					{type: 'requestRevisions', by: 'dbarnes'},
				],
				reviewRounds: [
					{
						reviewers: [
							{
								user: 'phudson',
								method: 'anonymous',
								status: 'completed',
								recommendation: 'pendingRevisions',
							},
						],
					},
					{reviewers: []},
				],
				publications: [{metadata: {title: {en: `Round files ${tag}`}}}],
			});
			const seeded = await fetchSubmission(page.request, submission.id);
			expect(seeded.reviewRounds).toHaveLength(2);
			const round1Id = seeded.reviewRounds[0].id;
			const round2Id = seeded.reviewRounds[1].id;
			expect(seeded.reviewRounds[1].statusId).toBe(ROUND_REVISIONS_REQUESTED);

			// The author uploads a revision into the current round (round 2).
			const authorCtx = await asUser('atester');
			const authorPage = await authorCtx.newPage();
			const round = new ReviewRoundPanel(authorPage);
			await round.gotoAuthor(submission.id);
			await round.uploadRevision({
				filePath: ARTICLE_FIXTURE,
				displayName: `Round-scoped revision ${tag}`,
			});
			await expect
				.poll(
					async () =>
						currentRound(await fetchSubmission(page.request, submission.id))
							.statusId,
					{timeout: 20_000},
				)
				.toBe(ROUND_REVISIONS_SUBMITTED);

			const filesUrl = (rid) =>
				`/index.php/publicknowledge/api/v1/submissions/${submission.id}/files?fileStages[]=${FILE_STAGE_REVIEW_REVISION}&reviewRoundIds[]=${rid}`;

			// Round 2 (where the author uploaded) carries the revision…
			const inRoundRes = await page.request.get(filesUrl(round2Id));
			expect(inRoundRes.ok()).toBeTruthy();
			const inRoundItems = (await inRoundRes.json()).items || [];
			expect(inRoundItems.length).toBeGreaterThan(0);
			for (const f of inRoundItems) {
				expect(f.fileStage).toBe(FILE_STAGE_REVIEW_REVISION);
			}

			// …while the prior round 1 shows none of it (per-round scoping).
			const otherRes = await page.request.get(filesUrl(round1Id));
			expect(otherRes.ok()).toBeTruthy();
			const otherItems = (await otherRes.json()).items || [];
			expect(otherItems.length).toBe(0);
		},
	);
});
