// @ts-check
const {test, expect} = require('../support/fixtures.js');
const path = require('path');
const {
	ReviewerSubmissionPage,
} = require('../../lib/pkp/playwright/pages/ReviewerSubmissionPage.js');
const {
	ReviewerManagerPage,
} = require('../../lib/pkp/playwright/pages/ReviewerManagerPage.js');

/**
 * Reviewer response — one test per canonical scenario of
 * docs/product/specs/reviewer-response.md (11 scenarios → 10 tests).
 *
 * The *reviewer's* side of peer review: reaching the assignment, accept /
 * decline, and the four-step legacy wizard (Request → Guidelines →
 * Download & Review → Completion) where the reviewer writes comments or a
 * review form, picks a recommendation, attaches files, and submits. The
 * wizard is a server-rendered legacy Smarty + jQuery-UI surface mounted
 * inside the Vue backend shell (spec rule 1); we drive it via the shared
 * ReviewerSubmissionPage POM (lib/pkp/playwright/pages) and assert on the
 * resulting review_assignments state, the review content (via the editor's
 * Read-Review modal), and Mailpit — never on toasts (spec rules 4/5/9).
 *
 * Scenario mapping (see per-test comments):
 *   1 + 7 → accept, complete & submit, with a Save-for-Later checkpoint
 *           (MERGED: save-for-later is a natural mid-flow step of the
 *           accept→submit journey — the draft is proven to persist WITHOUT
 *           completing, then the same step-3 form is submitted for real.
 *           This is the pair-merge that lands the file at exactly 10 tests.)
 *   2  → decline with a reason
 *   3  → pick a recommendation (required in OJS)
 *   4  → split the comments (viewable vs editor-only)
 *   5  → fill a structured review form
 *   6  → attach a file
 *   8  → one-click access from the invitation email
 *   9  → cannot edit after submitting
 *   10 → permission boundary — not-my-assignment
 *   11 → read a prior round's review
 *
 * Seeding: reviewers are seeded directly in the needed state via the
 * submission scenario endpoint (reviewRounds[].reviewers[].status =
 * invited / accepted / completed), never by driving prior UI. The tag
 * rides in the submission title, which every reviewer email interpolates
 * via {$submissionTitle}, so Mailpit assertions scope by recipient +
 * `contains: tag` and stay parallel-safe. Scenarios 5 and 8 need journal
 * config the bootstrap journal must not carry (an active review form; the
 * reviewer-access-keys toggle), so they seed a scratch journal.
 */

const REVIEWER = 'jjanssen'; // default reviewer (baseline seeded user)

// ReviewAssignment::REVIEW_ASSIGNMENT_STATUS_* (getStatus()).
const STATUS = {
	AWAITING_RESPONSE: 0,
	DECLINED: 1,
	ACCEPTED: 5,
	RECEIVED: 7, // reviewer submitted, editor not yet confirmed (live submit)
	COMPLETE: 8, // editor-confirmed (seeded 'completed' state)
};

const EMAIL = {
	dbarnes: 'dbarnes@mailinator.com',
	jjanssen: 'jjanssen@mailinator.com',
	agallego: 'agallego@mailinator.com',
};

// Reviewer-email subject fragments (locale en). Stable substrings of the
// dynamic subjects (emails.reviewConfirm/reviewComplete.subject).
const SUBJECT = {
	accepted: 'Review accepted',
	complete: 'Review complete',
};

const MAIL_TIMEOUT = 30_000;

const REVIEW_ATTACHMENT = path.resolve(
	__dirname,
	'../../lib/pkp/playwright/fixtures/files/default-article.pdf',
);

/** Unique, hyphenless alphanumeric tag — safe for Mailpit `contains`. */
function uniqueTag() {
	const workerIndex = test.info().parallelIndex;
	const suffix = Math.random().toString(36).slice(2, 8);
	return `rvr${workerIndex}x${suffix}`;
}

/**
 * A submitted submission in external review (round 1) on publicknowledge,
 * with the tag woven into the title so it reaches every reviewer-email
 * body. dbarnes is the deciding + notified editor; atester is the author.
 *
 * @param {{tag: string, title: string, reviewers?: object[]}} opts
 */
function inReviewSpec({tag, title, reviewers = []}) {
	return {
		tag,
		journal: 'publicknowledge',
		submitter: 'atester',
		section: 'ART',
		locale: 'en',
		participants: [{user: 'dbarnes', role: 'editor'}],
		decisions: [{type: 'sendExternalReview', by: 'dbarnes'}],
		reviewRounds: [{reviewers}],
		publications: [{metadata: {title: {en: title}}}],
	};
}

/**
 * Fetch a submission's reviewAssignments summary through an
 * editor-authenticated request context (the reviewer role can't read the
 * submission API). Returns the hand-rolled summary rows (statusId + dates).
 *
 * @param {import('@playwright/test').APIRequestContext} request
 * @param {number} submissionId
 * @param {string} [journalPath='publicknowledge']
 */
async function fetchAssignments(request, submissionId, journalPath = 'publicknowledge') {
	const res = await request.get(
		`/index.php/${journalPath}/api/v1/submissions/${submissionId}`,
	);
	if (!res.ok()) {
		throw new Error(
			`GET submission ${submissionId} failed: ${res.status()} ${await res.text()}`,
		);
	}
	return (await res.json()).reviewAssignments || [];
}

test.describe('Reviewer response', () => {
	// Canonical scenario 1 (+ 7 folded) — the assigned reviewer opens the
	// submission, accepts (ticking privacy consent), advances through the
	// guidelines, writes a comment, picks a recommendation, and SAVES FOR
	// LATER (scenario 7): the draft persists as an ACCEPTED (not completed)
	// assignment — nothing is submitted or notified. Then the same step-3
	// form is submitted for real (scenario 1): the wizard shows "Review
	// Submitted", the editors got the accept + complete emails (the latter
	// naming the recommendation), and the assignment is RECEIVED.
	test(
		'accept, save for later, then complete and submit',
		{tag: ['@smoke', '@regression']},
		async ({pkpApi, pkpMail, asUser}) => {
			test.slow(); // full 4-step wizard + save + submit + 2 Mailpit reads
			const tag = uniqueTag();
			const {submission} = await pkpApi.createSubmission(
				inReviewSpec({
					tag,
					title: `RVR accept ${tag}`,
					reviewers: [{user: REVIEWER, method: 'anonymous', status: 'invited'}],
				}),
			);

			const reviewerCtx = await asUser(REVIEWER);
			const reviewerPage = await reviewerCtx.newPage();
			const rp = new ReviewerSubmissionPage(reviewerPage);
			await rp.goto(submission.id);

			// Step 1 → accept (sends ReviewConfirm to the editor) → guidelines
			// → step 3.
			await rp.acceptInvitation();
			await rp.continueToStep3();

			// Fill a comment + recommendation, then SAVE FOR LATER (scenario 7).
			await rp.fillStep3Comments({toAuthor: `Draft comment ${tag}`});
			await rp.selectRecommendation('Accept Submission');
			await rp.saveForLater();

			const editorCtx = await asUser('dbarnes');
			// The accept email fired on step 1; its arrival also proves the
			// mail pipeline for the later negative reasoning.
			await pkpMail.find({
				to: EMAIL.dbarnes,
				contains: tag,
				subject: SUBJECT.accepted,
				timeoutMs: MAIL_TIMEOUT,
			});

			// Save-for-later drafted the review WITHOUT completing it (rule 11):
			// the assignment is still ACCEPTED, not RECEIVED/COMPLETE.
			let assignments = await fetchAssignments(editorCtx.request, submission.id);
			expect(assignments).toHaveLength(1);
			expect(assignments[0].statusId).toBe(STATUS.ACCEPTED);

			// Now submit for real (scenario 1).
			await rp.submitReview();

			// The completed assignment is RECEIVED (dateCompleted set, editor
			// not yet confirmed).
			assignments = await fetchAssignments(editorCtx.request, submission.id);
			expect(assignments[0].statusId).toBe(STATUS.RECEIVED);

			// The review-complete email reached the editor, naming the
			// recommendation (rule 9 / emails.reviewComplete.subject).
			const [complete] = await pkpMail.find({
				to: EMAIL.dbarnes,
				contains: tag,
				subject: SUBJECT.complete,
				timeoutMs: MAIL_TIMEOUT,
			});
			expect(complete.Subject).toContain('Accept Submission');
		},
	);

	// Canonical scenario 2 — from step 1 the reviewer clicks Decline Review
	// Request, edits the pre-filled reason, and submits: the editors get the
	// decline email carrying the reason, the assignment is marked declined,
	// and the reviewer is bounced off the review page and can no longer
	// reopen it (rule 5 + the access gate, rule 12).
	test(
		'decline with a reason',
		{tag: ['@smoke', '@regression']},
		async ({pkpApi, pkpMail, asUser}) => {
			test.slow();
			const tag = uniqueTag();
			const {submission} = await pkpApi.createSubmission(
				inReviewSpec({
					tag,
					title: `RVR decline ${tag}`,
					reviewers: [{user: REVIEWER, method: 'anonymous', status: 'invited'}],
				}),
			);

			const reviewerCtx = await asUser(REVIEWER);
			const reviewerPage = await reviewerCtx.newPage();
			const rp = new ReviewerSubmissionPage(reviewerPage);
			await rp.goto(submission.id);

			await rp.declineInvitation(`<p>Sorry, I must decline. ${tag}</p>`);

			// The decline email reached the editor with the tagged reason.
			await pkpMail.find({
				to: EMAIL.dbarnes,
				contains: tag,
				timeoutMs: MAIL_TIMEOUT,
			});

			// Assignment is declined.
			const editorCtx = await asUser('dbarnes');
			const assignments = await fetchAssignments(editorCtx.request, submission.id);
			expect(assignments[0].statusId).toBe(STATUS.DECLINED);

			// The access gate now refuses the reviewer: reopening the review
			// page no longer renders step 1.
			await rp.goto(submission.id);
			await expect(rp.step1Form).toHaveCount(0);
			await expect(reviewerPage.locator('body')).toContainText(
				/not assigned as a reviewer|not authorized to view/i,
			);
		},
	);

	// Canonical scenario 3 — the recommendation is required in OJS. On step
	// 3 the reviewer writes a comment but submits WITHOUT choosing a
	// recommendation: the submit is refused and the wizard stays on step 3.
	// After choosing one, the submit completes.
	test(
		'pick a recommendation (required)',
		{tag: '@regression'},
		async ({pkpApi, pkpMail, asUser}) => {
			test.slow();
			const tag = uniqueTag();
			const {submission} = await pkpApi.createSubmission(
				inReviewSpec({
					tag,
					title: `RVR recommend ${tag}`,
					reviewers: [{user: REVIEWER, method: 'anonymous', status: 'invited'}],
				}),
			);

			const reviewerCtx = await asUser(REVIEWER);
			const reviewerPage = await reviewerCtx.newPage();
			const rp = new ReviewerSubmissionPage(reviewerPage);
			await rp.goto(submission.id);
			await rp.acceptInvitation();
			await rp.continueToStep3();

			// A non-empty review, but no recommendation chosen → refused.
			await rp.fillStep3Comments({toAuthor: `Comment ${tag}`});
			await rp.submitAndExpectBlocked();

			// A blocked submit consumes the legacy confirm-button handler, so
			// reopen step 3 for a clean submit.
			await reviewerPage.goto(
				`/index.php/publicknowledge/en/reviewer/submission/${submission.id}?step=3`,
			);
			await expect(rp.step3Form).toBeVisible({timeout: 15_000});

			// Choose the recommendation → submit succeeds.
			await rp.fillStep3Comments({toAuthor: `Comment ${tag}`});
			await rp.selectRecommendation('Accept Submission');
			await rp.submitReview();

			// The completion email names the chosen recommendation.
			const [complete] = await pkpMail.find({
				to: EMAIL.dbarnes,
				contains: tag,
				subject: SUBJECT.complete,
				timeoutMs: MAIL_TIMEOUT,
			});
			expect(complete.Subject).toContain('Accept Submission');
		},
	);

	// Canonical scenario 4 — the reviewer fills BOTH free-text boxes: "For
	// author and editor" (stored viewable) and "For editor only" (stored
	// non-viewable). The editor's Read-Review modal surfaces the first under
	// the author-shareable heading and the second under the editor-only
	// heading — the split the reviewer made (rule 8).
	test(
		'split the comments — author-and-editor vs editor-only',
		{tag: '@regression'},
		async ({pkpApi, asUser}) => {
			test.slow();
			const tag = uniqueTag();
			const {submission} = await pkpApi.createSubmission(
				inReviewSpec({
					tag,
					title: `RVR split ${tag}`,
					reviewers: [{user: REVIEWER, method: 'anonymous', status: 'invited'}],
				}),
			);

			const reviewerCtx = await asUser(REVIEWER);
			const reviewerPage = await reviewerCtx.newPage();
			const rp = new ReviewerSubmissionPage(reviewerPage);
			await rp.goto(submission.id);
			await rp.acceptInvitation();
			await rp.continueToStep3();

			await rp.fillStep3Comments({
				toAuthor: `Shared with author ${tag}`,
				toEditor: `Editor eyes only ${tag}`,
			});
			await rp.selectRecommendation('Accept Submission');
			await rp.submitReview();

			// The editor reads the review: both streams present, under their
			// respective viewable / non-viewable headings.
			const editorCtx = await asUser('dbarnes');
			const editorPage = await editorCtx.newPage();
			const rm = new ReviewerManagerPage(editorPage);
			await rm.gotoWorkflow(submission.id);
			const modal = await rm.openReviewDetails('Julie Janssen');

			// The Read-Review modal groups the reviewer's two comment streams:
			// the viewable one under "For author and editor", the editor-only
			// one under its own heading. Both tagged texts present proves the
			// split was recorded (viewable vs non-viewable submission_comments).
			await expect(modal).toContainText('Reviewer Comments', {
				timeout: 15_000,
			});
			await expect(modal).toContainText('For author and editor');
			await expect(modal).toContainText(`Shared with author ${tag}`);
			await expect(modal).toContainText(`Editor eyes only ${tag}`);
		},
	);

	// Canonical scenario 5 — with a review form attached to the assignment,
	// the two free-text boxes are REPLACED by the form's elements; a required
	// element must be answered (submitting it empty is refused), and the
	// answer is stored as a review-form response the editor can read (rule 7
	// / rule 8). Needs a scratch journal that owns an active review form.
	test(
		'fill a structured review form',
		{tag: '@regression'},
		async ({pkpApi, asUser}) => {
			test.slow(); // scratch journal + review form + full wizard + editor read
			const tag = uniqueTag();
			const formTitle = `RF ${tag}`;
			const question = `Assess the methodology ${tag}`;
			const {context, reviewForms} = await pkpApi.createJournal({
				tag,
				users: [
					{username: REVIEWER, roles: ['reviewer']},
					{username: 'dbarnes', roles: ['manager']},
					{username: 'atester', roles: ['author']},
				],
				reviewForms: [
					{
						title: formTitle,
						elements: [
							{type: 'textarea', question, required: true},
						],
					},
				],
			});
			const requiredElementId = reviewForms[0].elementIds[0];

			const {submission} = await pkpApi.createSubmission({
				tag,
				journal: context.path,
				submitter: 'atester',
				section: 'ART',
				locale: 'en',
				participants: [{user: 'dbarnes', role: 'editor'}],
				decisions: [{type: 'sendExternalReview', by: 'dbarnes'}],
				reviewRounds: [
					{
						reviewers: [
							{
								user: REVIEWER,
								method: 'anonymous',
								status: 'invited',
								reviewForm: formTitle,
							},
						],
					},
				],
				publications: [{metadata: {title: {en: `RVR form ${tag}`}}}],
			});

			const reviewerCtx = await asUser(REVIEWER);
			const reviewerPage = await reviewerCtx.newPage();
			const rp = new ReviewerSubmissionPage(reviewerPage);
			await rp.goto(submission.id, {journalPath: context.path});
			await rp.acceptInvitation();
			await rp.continueToStep3();

			// The review-form element replaces the default free-text boxes.
			await expect(rp.reviewFormTextResponse(requiredElementId)).toBeVisible();
			await expect(
				rp.step3Form.locator('textarea[id^="comments-"]'),
			).toHaveCount(0);

			// Required element empty + a recommendation chosen → still refused.
			await rp.selectRecommendation('Accept Submission');
			await rp.submitAndExpectBlocked();

			// A blocked submit consumes the legacy confirm-button handler, so
			// reopen step 3 for a clean submit, then answer the required
			// element → submit completes.
			await reviewerPage.goto(
				`/index.php/${context.path}/en/reviewer/submission/${submission.id}?step=3`,
			);
			await expect(rp.step3Form).toBeVisible({timeout: 15_000});
			await rp.reviewFormTextResponse(requiredElementId).fill(
				`Methodology is sound ${tag}`,
			);
			await rp.selectRecommendation('Accept Submission');
			await rp.submitReview();

			// The editor reads the stored review-form response.
			const editorCtx = await asUser('dbarnes');
			const editorPage = await editorCtx.newPage();
			const rm = new ReviewerManagerPage(editorPage);
			await rm.gotoWorkflow(submission.id, {journalPath: context.path});
			const modal = await rm.openReviewDetails('Julie Janssen');
			await expect(modal).toContainText(question);
			await expect(modal).toContainText(`Methodology is sound ${tag}`);
		},
	);

	// Canonical scenario 6 — the reviewer uploads an attachment on step 3
	// (an annotated manuscript); it is stored as a review-attachment file
	// and survives submission (rule 7, the Upload File grid).
	test(
		'attach a file',
		{tag: '@regression'},
		async ({pkpApi, asUser}) => {
			test.slow(); // legacy upload wizard + full submit
			const tag = uniqueTag();
			const {submission} = await pkpApi.createSubmission(
				inReviewSpec({
					tag,
					title: `RVR attach ${tag}`,
					reviewers: [{user: REVIEWER, method: 'anonymous', status: 'invited'}],
				}),
			);

			const reviewerCtx = await asUser(REVIEWER);
			const reviewerPage = await reviewerCtx.newPage();
			const rp = new ReviewerSubmissionPage(reviewerPage);
			await rp.goto(submission.id);
			await rp.acceptInvitation();
			await rp.continueToStep3();

			// Upload the attachment (the POM asserts the grid gains the row).
			await rp.uploadAttachment(REVIEW_ATTACHMENT, 'default-article.pdf');

			await rp.selectRecommendation('Accept Submission');
			await rp.submitReview();

			// The attachment persisted to the completed review — the editor's
			// Read-Review modal lists it.
			const editorCtx = await asUser('dbarnes');
			const editorPage = await editorCtx.newPage();
			const rm = new ReviewerManagerPage(editorPage);
			await rm.gotoWorkflow(submission.id);
			const modal = await rm.openReviewDetails('Julie Janssen');
			await expect(modal).toContainText('default-article.pdf');
		},
	);

	// Canonical scenario 8 — with reviewer access keys enabled, the secure
	// link in the invitation email signs the reviewer in as themselves and
	// drops them on step 1, no password typed (rule 13). We enable the keys
	// on a scratch journal, have the editor assign the reviewer through the
	// real Add-Reviewer UI (which mints the per-invitation key and sends the
	// request email), extract the link, and follow it from a fresh,
	// signed-out browser context.
	test(
		'one-click access from the invitation email',
		{tag: '@regression'},
		async ({pkpApi, pkpMail, asUser, browser}) => {
			test.slow(); // scratch journal + editor assign UI + Mailpit + fresh nav
			const tag = uniqueTag();
			const {context} = await pkpApi.createJournal({
				tag,
				reviewerAccessKeysEnabled: true,
				users: [
					{username: REVIEWER, roles: ['reviewer']},
					{username: 'dbarnes', roles: ['manager']},
					{username: 'atester', roles: ['author']},
				],
			});
			const {submission} = await pkpApi.createSubmission({
				tag,
				journal: context.path,
				submitter: 'atester',
				section: 'ART',
				locale: 'en',
				participants: [{user: 'dbarnes', role: 'editor'}],
				decisions: [{type: 'sendExternalReview', by: 'dbarnes'}],
				reviewRounds: [{reviewers: []}],
				publications: [{metadata: {title: {en: `RVR oneclick ${tag}`}}}],
			});

			// The editor assigns the reviewer through the UI — this is what
			// mints the ReviewerAccessInvite key and sends the request email
			// carrying the one-click link.
			const editorCtx = await asUser('dbarnes');
			const editorPage = await editorCtx.newPage();
			const rm = new ReviewerManagerPage(editorPage);
			await rm.gotoWorkflow(submission.id, {journalPath: context.path});
			const modal = await rm.openAddReviewerModal();
			await rm.searchSelectPanel(modal, REVIEWER);
			const form = await rm.selectReviewer(modal, 'Julie Janssen');
			await rm.awaitRichTextContains(form, 'personalMessage', tag);
			await rm.ensureDueDatesOrdered(form);
			await rm.submitLegacyForm(form, 'Add Reviewer', modal);
			await expect(rm.row('Julie Janssen')).toContainText('Request Sent', {
				timeout: 20_000,
			});

			// Pull the one-click access link out of the invitation email.
			const [message] = await pkpMail.find({
				to: EMAIL.jjanssen,
				contains: tag,
				timeoutMs: MAIL_TIMEOUT,
			});
			const full = await pkpMail.fullMessage(message.ID);
			const body = `${full.HTML || ''}\n${full.Text || ''}`;
			const linkMatch = body.match(
				/https?:\/\/[^"'\s>]*\/invitation\/accept\?[^"'\s>]*key=[^"'\s>]+/i,
			);
			if (!linkMatch) {
				throw new Error(
					`One-click access link not found in invitation email body:\n${body.slice(0, 600)}`,
				);
			}
			const oneClickUrl = linkMatch[0].replace(/&amp;/g, '&');

			// A fresh, signed-out context follows the link — the key must log
			// the reviewer in and land them on the review page (step 1).
			const anonCtx = await browser.newContext({
				storageState: {cookies: [], origins: []},
			});
			const anonPage = await anonCtx.newPage();
			await anonPage.goto(oneClickUrl);
			// The key accepts the invitation and redirects to the reviewer
			// page (query-param form: reviewer/submission?submissionId=…).
			await anonPage.waitForURL(/\/reviewer\/submission(\?|\/)/, {
				timeout: 20_000,
				waitUntil: 'commit',
			});
			const anonRp = new ReviewerSubmissionPage(anonPage);
			await expect(anonRp.step1Form).toBeVisible({timeout: 15_000});
			// Signed in as the reviewer, without a manual login.
			const currentUser = await anonPage.evaluate(
				() => window.pkp?.currentUser?.username,
			);
			expect(currentUser).toBe(REVIEWER);
			await anonCtx.close();
		},
	);

	// Canonical scenario 9 — a reviewer who has already submitted reopens the
	// page and finds the review read-only: the recommendation and comment
	// fields render disabled and Submit Review is disabled; further saves are
	// refused (rule 10). Seeded directly in the completed state.
	test(
		'cannot edit after submitting',
		{tag: '@regression'},
		async ({pkpApi, asUser}) => {
			test.slow();
			const tag = uniqueTag();
			const {submission} = await pkpApi.createSubmission(
				inReviewSpec({
					tag,
					title: `RVR readonly ${tag}`,
					reviewers: [
						{
							user: REVIEWER,
							method: 'anonymous',
							status: 'completed',
							recommendation: 'accept',
						},
					],
				}),
			);

			const reviewerCtx = await asUser(REVIEWER);
			const reviewerPage = await reviewerCtx.newPage();
			const rp = new ReviewerSubmissionPage(reviewerPage);

			// The default view of a completed assignment is the read-only
			// completion confirmation.
			await rp.goto(submission.id);
			await expect(rp.completedHeading).toBeVisible({timeout: 15_000});

			// Revisiting step 3 shows the review, but read-only: both action
			// buttons (Submit Review, Save for Later) are disabled and the
			// comment editors are non-editable (spec rule 10 / reviewIsClosed).
			// NB: the recommendation <select> is NOT disabled on a closed
			// review — an as-built quirk (reviewerRecommendations.tpl keys its
			// disabled state on an unset $readOnly, while the comments/buttons
			// use $reviewIsClosed). See the return notes.
			await reviewerPage.goto(
				`/index.php/publicknowledge/en/reviewer/submission/${submission.id}?step=3`,
			);
			await expect(rp.step3Form).toBeVisible({timeout: 15_000});
			await expect(
				rp.step3Form.getByRole('button', {name: /^Submit Review$/i}),
			).toBeDisabled();
			await expect(
				rp.step3Form.getByRole('button', {name: 'Save for Later', exact: true}),
			).toBeDisabled();
		},
	);

	// Canonical scenario 10 — the access gate is per-assignment. A reviewer
	// who is NOT on this submission is refused the review page with "not
	// assigned as a reviewer for the requested document" (rule 12).
	test(
		'permission boundary — not-my-assignment',
		{tag: ['@smoke', '@regression']},
		async ({pkpApi, asUser}) => {
			const tag = uniqueTag();
			const {submission} = await pkpApi.createSubmission(
				inReviewSpec({
					tag,
					title: `RVR authz ${tag}`,
					// jjanssen is the only assigned reviewer; agallego is not.
					reviewers: [{user: REVIEWER, method: 'anonymous', status: 'invited'}],
				}),
			);

			const strangerCtx = await asUser('agallego');
			const strangerPage = await strangerCtx.newPage();
			const rp = new ReviewerSubmissionPage(strangerPage);
			await rp.goto(submission.id);

			// Denied: no step-1 form, and the authorization message shows.
			await expect(rp.step1Form).toHaveCount(0);
			await expect(strangerPage.locator('body')).toContainText(
				/not assigned as a reviewer|not authorized to view/i,
			);
		},
	);

	// Canonical scenario 11 — a reviewer invited again in a later round sees
	// a "Previous Reviews" history banner and can open a read-only view of
	// the review they submitted in the earlier round (rule 11, the Vue
	// round-history banner + modal).
	test(
		"read a prior round's review",
		{tag: '@regression'},
		async ({pkpApi, asUser}) => {
			test.slow(); // two review rounds seeded via the decision chain
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
						// Round 1: the reviewer completed a review (the one the
						// banner later surfaces).
						reviewers: [
							{
								user: REVIEWER,
								method: 'anonymous',
								status: 'completed',
								recommendation: 'pendingRevisions',
								comments: {toAuthor: `Round one note ${tag}`},
							},
						],
					},
					{
						// Round 2: the same reviewer is invited again.
						reviewers: [
							{user: REVIEWER, method: 'anonymous', status: 'invited'},
						],
					},
				],
				publications: [{metadata: {title: {en: `RVR history ${tag}`}}}],
			});

			const reviewerCtx = await asUser(REVIEWER);
			const reviewerPage = await reviewerCtx.newPage();
			const rp = new ReviewerSubmissionPage(reviewerPage);
			await rp.goto(submission.id);

			// The round-history banner (Vue) offers a read link for round 1.
			await expect(
				reviewerPage.getByRole('heading', {name: 'Previous Reviews'}),
			).toBeVisible({timeout: 15_000});
			const readLink = reviewerPage.getByRole('button', {
				name: /Read Round 1 Review/i,
			});
			await expect(readLink).toBeVisible();
			await readLink.click();

			// The read-only round-history modal shows what the reviewer
			// submitted in round 1.
			const historyModal = reviewerPage.getByRole('dialog', {
				name: /Round 1 Review submitted by you for/i,
			});
			await expect(historyModal).toBeVisible({timeout: 15_000});
			await expect(historyModal).toContainText(`Round one note ${tag}`);
		},
	);
});
