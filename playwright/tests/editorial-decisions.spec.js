// @ts-check
const path = require('path');
const {test, expect} = require('../support/fixtures.js');
const {EditorialWorkflowPage} = require('../pages/EditorialWorkflowPage.js');

/**
 * Editorial decisions (the decision engine) — one test per canonical
 * scenario of docs/product/specs/editorial-decisions.md (14 scenarios,
 * landed as 13 tests: scenarios 4 + 5 — desk-reject-and-revert and
 * decline-in-review-and-revert — are MERGED into a single
 * decline/revert test, since both exercise the identical
 * decline→Declined / revert→Queued mechanism and differ only in the
 * stage they run from).
 *
 * Placement: OJS root — the flow leans on the publicknowledge journal
 * (sections, issues, the OJS decision type SET and the OJS
 * WorkflowPageOJS action bar), even though the decision engine ships
 * from pkp-lib.
 *
 * Seeding strategy (cost control): every submission is seeded DIRECTLY
 * into the stage/round the decision under test is offered from (via the
 * scenario API's decisions/reviewRounds passthroughs), then the ONE
 * decision the scenario is about is driven through the real Record
 * Decision wizard. Prior decisions are never re-driven through the UI.
 *
 * Assertions read the transition machine back through the REST API
 * (submission stageId / status, reviewRounds[].statusId, the decision
 * history) rather than UI chrome, and the NotifyAuthor / NotifyReviewer
 * / RecommendationNotifyEditors emails through Mailpit — scoped by
 * recipient + the test's unique tag (embedded in the composed body),
 * with the generous 30s timeout the end-of-request mail runner needs.
 *
 * Parallel-safety: tags are single hyphenless alphanumeric tokens; mail
 * reads are recipient+tag scoped (never clearAll); every submission is
 * per-test.
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
const STAGE_COPYEDITING = 4; // EDITING
const STAGE_PRODUCTION = 5;
const STAGE_DONE = 6;

// Submission status (PKPSubmission STATUS_*).
const STATUS_QUEUED = 1;
const STATUS_PUBLISHED = 3;
const STATUS_DECLINED = 4;

// Review-round status (ReviewRound REVIEW_ROUND_STATUS_*).
const ROUND_REVISIONS_REQUESTED = 1;
const ROUND_RESUBMIT_FOR_REVIEW = 2;
const ROUND_ACCEPTED = 4;
const ROUND_DECLINED = 5;
const ROUND_PENDING_REVIEWERS = 6;

// Decision constants (APP\decision\Decision::*).
const DECISION_ACCEPT = 2;
const DECISION_EXTERNAL_REVIEW = 3;
const DECISION_PENDING_REVISIONS = 4;
const DECISION_RESUBMIT = 5;
const DECISION_SEND_TO_PRODUCTION = 7;
const DECISION_INITIAL_DECLINE = 8;
const DECISION_RECOMMEND_ACCEPT = 9;
const DECISION_DECLINE = 6;
const DECISION_NEW_EXTERNAL_ROUND = 14;
const DECISION_REVERT_DECLINE = 15;
const DECISION_REVERT_INITIAL_DECLINE = 16;
const DECISION_SKIP_EXTERNAL_REVIEW = 17;
const DECISION_BACK_FROM_PRODUCTION = 29;
const DECISION_BACK_FROM_COPYEDITING = 30;
const DECISION_CANCEL_REVIEW_ROUND = 31;
const DECISION_MOVE_TO_DONE = 33;
const DECISION_RETURN_TO_WORKFLOW = 34;

const AUTHOR_EMAIL = 'atester@mailinator.com';
const DBARNES_EMAIL = 'dbarnes@mailinator.com';

/** A unique, hyphenless, alphanumeric tag (parallel isolation + mail scoping). */
function uniqueTag() {
	const workerLetter = String.fromCharCode(97 + (test.info().parallelIndex % 26));
	let suffix = '';
	while (suffix.length < 6) {
		suffix += Math.random().toString(36).replace(/[^a-z0-9]/g, '');
	}
	return `eddec${workerLetter}${suffix.slice(0, 6)}`;
}

/**
 * A submitted, stage-1 submission on publicknowledge. `submitted: true`
 * fires the real submit (so the submission is complete for the decision
 * gate and the section's editors are auto-assigned); dbarnes is the
 * deciding editor and atester the assigned author.
 *
 * @param {{tag: string, title: string, participants?: object[]}} opts
 */
function submittedSpec({tag, title, participants = [{user: 'dbarnes', role: 'editor'}]}) {
	return {
		tag,
		journal: 'publicknowledge',
		submitter: 'atester',
		section: 'ART',
		locale: 'en',
		submitted: true,
		participants,
		publications: [{metadata: {title: {en: title}}}],
	};
}

/**
 * In external review, round 1, seeded via a sendExternalReview decision.
 * `reviewers` defaults to empty (a bare round, status Pending Reviewers);
 * pass a completed reviewer to exercise the Notify Reviewers step.
 *
 * @param {{tag: string, title: string, reviewers?: object[], participants?: object[]}} opts
 */
function inReviewSpec({
	tag,
	title,
	reviewers = [],
	participants = [{user: 'dbarnes', role: 'editor'}],
}) {
	return {
		...submittedSpec({tag, title, participants}),
		decisions: [{type: 'sendExternalReview', by: 'dbarnes'}],
		reviewRounds: [{reviewers}],
	};
}

/** The current (last) review round from a submission GET payload. */
function currentRound(submission) {
	const rounds = submission.reviewRounds || [];
	return rounds[rounds.length - 1];
}

/** The list of decision constants recorded on a submission. */
function decisionConstants(decisions) {
	return decisions.map((d) => d.decision);
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
 * Open a page in the given context on the always-accessible site-level
 * user profile (any logged-in user can reach it — auth.js probes it)
 * and return {page, token} for API POSTs that need CSRF. The token is
 * session-scoped, so it is valid for requests against any context.
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

test.use({user: 'dbarnes'}); // the deciding editor

test.describe('Editorial decisions', () => {
	// Canonical scenario 1 — an editor on a submission-stage manuscript
	// clicks Send for Review, composes the author email, and records: the
	// submission moves to the Review stage, review round 1 opens (Pending
	// Reviewers), and the author receives the send-to-review email.
	test(
		'send a submission for review',
		{tag: ['@smoke', '@regression']},
		async ({page, pkpApi, pkpMail}) => {
			const tag = uniqueTag();
			const {submission} = await pkpApi.createSubmission(
				submittedSpec({tag, title: `Send for review ${tag}`}),
			);

			const workflow = new EditorialWorkflowPage(page);
			await workflow.goto(submission.id);
			await workflow.clickDecision('Send for Review');
			await workflow.setDecisionEmailBody(
				'notifyAuthors',
				`<p>Your manuscript is going to review — ${tag}</p>`,
			);
			await workflow.clickContinue(); // Notify Authors → Select Files
			await workflow.recordDecision('has been sent to the review stage');

			const after = await workflow.fetchSubmission(submission.id);
			expect(after.stageId).toBe(STAGE_REVIEW);
			expect(after.reviewRounds).toHaveLength(1);
			expect(currentRound(after).statusId).toBe(ROUND_PENDING_REVIEWERS);

			const decisions = await workflow.fetchDecisions(submission.id);
			expect(decisionConstants(decisions)).toContain(DECISION_EXTERNAL_REVIEW);

			const [mail] = await pkpMail.find({
				to: AUTHOR_EMAIL,
				contains: tag,
				timeoutMs: 30_000,
			});
			expect(mail).toBeTruthy();
		},
	);

	// Canonical scenario 2 — from the submission stage the editor picks
	// Accept and Skip Review; the submission jumps straight to
	// Copyediting with no review round (the APC payment step is only
	// offered when publication payments are configured — off on
	// publicknowledge).
	test(
		'accept and skip review',
		{tag: '@regression'},
		async ({page, pkpApi, pkpMail}) => {
			const tag = uniqueTag();
			const {submission} = await pkpApi.createSubmission(
				submittedSpec({tag, title: `Skip review ${tag}`}),
			);

			const workflow = new EditorialWorkflowPage(page);
			await workflow.goto(submission.id);
			await workflow.clickDecision('Accept and Skip Review');
			await workflow.setDecisionEmailBody(
				'notifyAuthors',
				`<p>Accepted without review — ${tag}</p>`,
			);
			await workflow.clickContinue(); // Notify Authors → Select Files
			await workflow.recordDecision();

			const after = await workflow.fetchSubmission(submission.id);
			expect(after.stageId).toBe(STAGE_COPYEDITING);
			expect(after.reviewRounds).toHaveLength(0); // no round created

			const decisions = await workflow.fetchDecisions(submission.id);
			expect(decisionConstants(decisions)).toContain(
				DECISION_SKIP_EXTERNAL_REVIEW,
			);

			const [mail] = await pkpMail.find({
				to: AUTHOR_EMAIL,
				contains: tag,
				timeoutMs: 30_000,
			});
			expect(mail).toBeTruthy();
		},
	);

	// Canonical scenario 3 — with a completed reviewer the editor clicks
	// Accept Submission and steps through Notify Authors → Notify
	// Reviewers → Select Files: the submission moves to Copyediting, the
	// round is marked Accepted, and the author receives the acceptance
	// email. (Scenario 13's compose affordances are exercised in the
	// dedicated compose test; the Select Files step here carries no
	// review-revision files because the scenario API seeds none.)
	test(
		'accept from review and carry files forward',
		{tag: ['@smoke', '@regression']},
		async ({page, pkpApi, pkpMail}) => {
			const tag = uniqueTag();
			const {submission} = await pkpApi.createSubmission(
				inReviewSpec({
					tag,
					title: `Accept from review ${tag}`,
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

			const workflow = new EditorialWorkflowPage(page);
			await workflow.goto(submission.id);
			await workflow.clickDecision('Accept Submission');
			await workflow.setDecisionEmailBody(
				'notifyAuthors',
				`<p>Your submission has been accepted — ${tag}</p>`,
			);
			await workflow.clickContinue(); // Notify Authors → Notify Reviewers
			await workflow.clickContinue(); // Notify Reviewers → Select Files
			await workflow.recordDecision('has been accepted for publication');

			const after = await workflow.fetchSubmission(submission.id);
			expect(after.stageId).toBe(STAGE_COPYEDITING);
			expect(currentRound(after).statusId).toBe(ROUND_ACCEPTED);

			const decisions = await workflow.fetchDecisions(submission.id);
			expect(decisionConstants(decisions)).toContain(DECISION_ACCEPT);

			const [mail] = await pkpMail.find({
				to: AUTHOR_EMAIL,
				contains: tag,
				timeoutMs: 30_000,
			});
			expect(mail).toBeTruthy();
		},
	);

	// Canonical scenarios 4 + 5 (MERGED) — decline is revertible from both
	// faces. At the submission stage a Decline records Initial Decline
	// (status Declined, stage unchanged) and the Revert Decline button
	// returns it to Queued. In a review round a Decline records Decline
	// (status Declined, round Declined) and Revert Decline returns it to
	// Queued while recalculating the round back to Pending Reviewers. The
	// submission never leaves its stage across decline/revert.
	test(
		'decline and revert at the submission and review stages',
		{tag: '@regression'},
		async ({page, pkpApi}) => {
			test.slow(); // four decisions across two submissions
			const tag = uniqueTag();
			const workflow = new EditorialWorkflowPage(page);

			// --- Submission stage: desk-reject then revert ---
			const {submission: desk} = await pkpApi.createSubmission(
				submittedSpec({tag, title: `Desk reject ${tag}`}),
			);
			await workflow.goto(desk.id);
			await workflow.clickDecision('Decline Submission');
			await workflow.recordDecision('has been declined'); // one step (Notify Authors)
			await workflow.viewSubmissionFromCompletionDialog(desk.id);

			let s = await workflow.fetchSubmission(desk.id);
			expect(s.status).toBe(STATUS_DECLINED);
			expect(s.stageId).toBe(STAGE_SUBMISSION);
			expect(decisionConstants(await workflow.fetchDecisions(desk.id))).toContain(
				DECISION_INITIAL_DECLINE,
			);

			await workflow.clickDecision('Revert Decline');
			await workflow.recordDecision();
			await workflow.viewSubmissionFromCompletionDialog(desk.id);

			s = await workflow.fetchSubmission(desk.id);
			expect(s.status).toBe(STATUS_QUEUED);
			expect(s.stageId).toBe(STAGE_SUBMISSION);
			expect(decisionConstants(await workflow.fetchDecisions(desk.id))).toContain(
				DECISION_REVERT_INITIAL_DECLINE,
			);

			// --- Review round: decline then revert ---
			const {submission: rev} = await pkpApi.createSubmission(
				inReviewSpec({tag, title: `Review decline ${tag}`, reviewers: []}),
			);
			await workflow.goto(rev.id);
			await workflow.clickDecision('Decline Submission');
			await workflow.recordDecision('has been declined');
			await workflow.viewSubmissionFromCompletionDialog(rev.id);

			let r = await workflow.fetchSubmission(rev.id);
			expect(r.status).toBe(STATUS_DECLINED);
			expect(r.stageId).toBe(STAGE_REVIEW);
			expect(currentRound(r).statusId).toBe(ROUND_DECLINED);
			expect(decisionConstants(await workflow.fetchDecisions(rev.id))).toContain(
				DECISION_DECLINE,
			);

			await workflow.clickDecision('Revert Decline');
			await workflow.recordDecision();
			await workflow.viewSubmissionFromCompletionDialog(rev.id);

			r = await workflow.fetchSubmission(rev.id);
			expect(r.status).toBe(STATUS_QUEUED);
			expect(r.stageId).toBe(STAGE_REVIEW);
			expect(currentRound(r).statusId).toBe(ROUND_PENDING_REVIEWERS);
			expect(decisionConstants(await workflow.fetchDecisions(rev.id))).toContain(
				DECISION_REVERT_DECLINE,
			);
		},
	);

	// Canonical scenario 6 — the editor clicks Request Revisions, keeps the
	// default "no new round" option, and records: the submission stays in
	// Review and the round is marked Revisions Requested.
	test(
		'request revisions without a new round',
		{tag: '@regression'},
		async ({page, pkpApi, pkpMail}) => {
			const tag = uniqueTag();
			const {submission} = await pkpApi.createSubmission(
				inReviewSpec({tag, title: `Request revisions ${tag}`, reviewers: []}),
			);

			const workflow = new EditorialWorkflowPage(page);
			await workflow.goto(submission.id);
			await workflow.clickRequestRevisions({newRound: false});
			await workflow.setDecisionEmailBody(
				'notifyAuthors',
				`<p>Please revise in this round — ${tag}</p>`,
			);
			await workflow.recordDecision(); // one step (Notify Authors)

			const after = await workflow.fetchSubmission(submission.id);
			expect(after.stageId).toBe(STAGE_REVIEW);
			expect(currentRound(after).statusId).toBe(ROUND_REVISIONS_REQUESTED);

			const decisions = await workflow.fetchDecisions(submission.id);
			expect(decisionConstants(decisions)).toContain(DECISION_PENDING_REVISIONS);

			await pkpMail.find({to: AUTHOR_EMAIL, contains: tag, timeoutMs: 30_000});
		},
	);

	// Canonical scenario 7 — same button, but the editor picks Resubmit for
	// Review; the round is marked Resubmit For Review, seeding the next
	// round once the author uploads.
	test(
		'resubmit for review starts a new round on revisions',
		{tag: '@regression'},
		async ({page, pkpApi, pkpMail}) => {
			const tag = uniqueTag();
			const {submission} = await pkpApi.createSubmission(
				inReviewSpec({tag, title: `Resubmit ${tag}`, reviewers: []}),
			);

			const workflow = new EditorialWorkflowPage(page);
			await workflow.goto(submission.id);
			await workflow.clickRequestRevisions({newRound: true});
			await workflow.setDecisionEmailBody(
				'notifyAuthors',
				`<p>Please resubmit for a new round — ${tag}</p>`,
			);
			await workflow.recordDecision(); // one step (Notify Authors)

			const after = await workflow.fetchSubmission(submission.id);
			expect(after.stageId).toBe(STAGE_REVIEW);
			expect(currentRound(after).statusId).toBe(ROUND_RESUBMIT_FOR_REVIEW);

			const decisions = await workflow.fetchDecisions(submission.id);
			expect(decisionConstants(decisions)).toContain(DECISION_RESUBMIT);

			await pkpMail.find({to: AUTHOR_EMAIL, contains: tag, timeoutMs: 30_000});
		},
	);

	// Canonical scenario 8 — Create New Review Round adds round 2 (Pending
	// Reviewers) with the submission still in Review; the round menu grows a
	// "Review Round 2".
	test(
		'open a second review round',
		{tag: '@regression'},
		async ({page, pkpApi}) => {
			const tag = uniqueTag();
			const {submission} = await pkpApi.createSubmission(
				inReviewSpec({tag, title: `New round ${tag}`, reviewers: []}),
			);

			const workflow = new EditorialWorkflowPage(page);
			await workflow.goto(submission.id);
			await workflow.clickDecision('Create New Review Round');
			await workflow.setDecisionEmailBody(
				'notifyAuthors',
				`<p>Opening a fresh round — ${tag}</p>`,
			);
			await workflow.clickContinue(); // Notify Authors → Select Files
			await workflow.recordDecision();
			await workflow.viewSubmissionFromCompletionDialog(submission.id);

			// The round menu grows a second round entry (live affordance).
			await expect(
				workflow
					.workflowModal()
					.locator('nav')
					.getByText('Review Round 2', {exact: true}),
			).toBeVisible({timeout: 20_000});

			const after = await workflow.fetchSubmission(submission.id);
			expect(after.stageId).toBe(STAGE_REVIEW);
			expect(after.reviewRounds).toHaveLength(2);
			expect(currentRound(after).round).toBe(2);
			expect(currentRound(after).statusId).toBe(ROUND_PENDING_REVIEWERS);

			const decisions = await workflow.fetchDecisions(submission.id);
			expect(decisionConstants(decisions)).toContain(DECISION_NEW_EXTERNAL_ROUND);
		},
	);

	// Canonical scenario 9 — Cancel Review Round retracts the current round,
	// deletes it and its in-round decisions, and (it being the only round)
	// drops the submission back to the Submission stage. The cancel decision
	// itself vanishes from the history; the pre-round submission-stage
	// decision survives.
	test(
		'cancel a review round',
		{tag: '@regression'},
		async ({page, pkpApi}) => {
			const tag = uniqueTag();
			const {submission} = await pkpApi.createSubmission(
				inReviewSpec({tag, title: `Cancel round ${tag}`, reviewers: []}),
			);

			const workflow = new EditorialWorkflowPage(page);
			await workflow.goto(submission.id);
			await workflow.clickDecision('Cancel Review Round');
			await workflow.setDecisionEmailBody(
				'notifyAuthors',
				`<p>Cancelling this round — ${tag}</p>`,
			);
			await workflow.recordDecision(); // one step (Notify Authors)
			await workflow.viewSubmissionFromCompletionDialog(submission.id);

			const after = await workflow.fetchSubmission(submission.id);
			expect(after.stageId).toBe(STAGE_SUBMISSION); // back to submission
			expect(after.reviewRounds).toHaveLength(0); // round deleted

			const decisions = await workflow.fetchDecisions(submission.id);
			// The cancel decision was retracted with the round…
			expect(decisionConstants(decisions)).not.toContain(
				DECISION_CANCEL_REVIEW_ROUND,
			);
			// …but the pre-round send-to-review decision remains.
			expect(decisionConstants(decisions)).toContain(DECISION_EXTERNAL_REVIEW);
		},
	);

	// Canonical scenario 10 — Send To Production moves Copyediting→Production;
	// Move To Copyediting moves it back; Move to Review from copyediting
	// returns the submission toward review (to the Submission stage, since no
	// review round exists) — none changing status.
	test(
		'hand off through copyediting and production',
		{tag: '@regression'},
		async ({page, pkpApi}) => {
			test.slow(); // three decisions in sequence
			const tag = uniqueTag();
			const {submission} = await pkpApi.createSubmission({
				...submittedSpec({tag, title: `Copyediting handoff ${tag}`}),
				decisions: [{type: 'skipExternalReview', by: 'dbarnes'}],
			});

			const workflow = new EditorialWorkflowPage(page);
			await workflow.goto(submission.id);

			// Copyediting → Production
			await workflow.clickDecision('Send To Production');
			await workflow.clickContinue(); // Notify Authors → Select Files
			await workflow.recordDecision();
			await workflow.viewSubmissionFromCompletionDialog(submission.id);
			let s = await workflow.fetchSubmission(submission.id);
			expect(s.stageId).toBe(STAGE_PRODUCTION);
			expect(s.status).toBe(STATUS_QUEUED);

			// Production → Copyediting
			await workflow.clickDecision('Move To Copyediting');
			await workflow.recordDecision(); // one step (Notify Authors)
			await workflow.viewSubmissionFromCompletionDialog(submission.id);
			s = await workflow.fetchSubmission(submission.id);
			expect(s.stageId).toBe(STAGE_COPYEDITING);
			expect(s.status).toBe(STATUS_QUEUED);

			// Copyediting → Submission (Move to Review, no round exists)
			await workflow.clickDecision('Move to Review');
			await workflow.recordDecision(); // one step (Notify Authors)
			await workflow.viewSubmissionFromCompletionDialog(submission.id);
			s = await workflow.fetchSubmission(submission.id);
			expect(s.stageId).toBe(STAGE_SUBMISSION);
			expect(s.status).toBe(STATUS_QUEUED);

			const decisions = decisionConstants(
				await workflow.fetchDecisions(submission.id),
			);
			expect(decisions).toContain(DECISION_SEND_TO_PRODUCTION);
			expect(decisions).toContain(DECISION_BACK_FROM_PRODUCTION);
			expect(decisions).toContain(DECISION_BACK_FROM_COPYEDITING);
		},
	);

	// Canonical scenario 11 — a recommend-only section editor sees only
	// Recommend Accept / Decline / Revisions (verified live), records a
	// recommendation that changes no state but emails the deciding editor;
	// the deciding editor still holds the finalizing power.
	test(
		'a recommend-only editor recommends',
		{tag: '@regression'},
		async ({page, pkpApi, pkpMail, asUser}) => {
			test.slow(); // second actor (recommend-only editor)
			const tag = uniqueTag();
			const {submission} = await pkpApi.createSubmission({
				...inReviewSpec({
					tag,
					title: `Recommendation ${tag}`,
					reviewers: [],
					participants: [
						{user: 'dbarnes', role: 'editor'},
						{user: 'minoue', role: 'sectionEditor', recommendOnly: true},
					],
				}),
			});

			// minoue (recommend-only) sees only the Recommend buttons.
			const minoueCtx = await asUser('minoue');
			const minouePage = await minoueCtx.newPage();
			const minoueWorkflow = new EditorialWorkflowPage(minouePage);
			await minoueWorkflow.goto(submission.id);
			await expect(
				minouePage.getByRole('button', {
					name: 'Recommend Accept',
					exact: true,
				}),
			).toBeVisible({timeout: 20_000});
			await expect(
				minouePage.getByRole('button', {
					name: 'Accept Submission',
					exact: true,
				}),
			).toHaveCount(0);

			await minoueWorkflow.clickDecision('Recommend Accept');
			await minoueWorkflow.setDecisionEmailBody(
				'discussion',
				`<p>I recommend acceptance — ${tag}</p>`,
			);
			await minoueWorkflow.recordDecision(); // one step (Notify Editors, cannot skip)

			// No state change: still in review.
			const workflow = new EditorialWorkflowPage(page);
			const after = await workflow.fetchSubmission(submission.id);
			expect(after.stageId).toBe(STAGE_REVIEW);
			expect(after.status).toBe(STATUS_QUEUED);

			const decisions = await workflow.fetchDecisions(submission.id);
			expect(decisionConstants(decisions)).toContain(DECISION_RECOMMEND_ACCEPT);

			// The deciding editor is emailed the recommendation.
			await pkpMail.find({to: DBARNES_EMAIL, contains: tag, timeoutMs: 30_000});
		},
	);

	// Canonical scenario 12 — publishing the first Version of Record
	// auto-records Move to Done (stage Done, status Published); unpublishing
	// the last VoR auto-records Return to Workflow (back to Production,
	// Queued); an unassigned manager (manager scope) can manually Return to
	// Done a submission that has Done history.
	//
	// The ⚠ suspected returnToDone-500 for an *assigned* editor is NOT
	// asserted here (per the feature brief): only the SUPPORTED unassigned-
	// manager path is driven.
	test(
		'publish flips the submission to Done, unpublish returns it',
		{tag: '@regression'},
		async ({page, pkpApi, asUser}) => {
			test.slow(); // publish listener + UI unpublish + manager return
			const tag = uniqueTag();
			const title = `Done stage ${tag}`;
			const {submission} = await pkpApi.createSubmission({
				...submittedSpec({tag, title}),
				decisions: [
					{type: 'skipExternalReview', by: 'dbarnes'},
					{type: 'sendToProduction', by: 'dbarnes'},
				],
				publications: [
					{
						versionStage: 'VoR',
						metadata: {title: {en: title}},
						issue: {volume: 1, number: 2, year: 2014}, // published back issue
						published: true,
					},
				],
			});

			const workflow = new EditorialWorkflowPage(page);

			// Seeding the published VoR fired the publish event, whose
			// ApplyDoneWorkflowStage listener auto-recorded Move to Done.
			const done = await workflow.fetchSubmission(submission.id);
			expect(done.stageId).toBe(STAGE_DONE);
			expect(done.status).toBe(STATUS_PUBLISHED);
			expect(
				decisionConstants(await workflow.fetchDecisions(submission.id)),
			).toContain(DECISION_MOVE_TO_DONE);

			// Unpublish → Return to Workflow (Done → Production, Queued).
			await workflow.goto(submission.id);
			await workflow.openPublicationPanel('Title & Abstract');
			await workflow.unpublishCurrentPanel();
			await expect
				.poll(
					async () => (await workflow.fetchSubmission(submission.id)).stageId,
					{timeout: 20_000},
				)
				.toBe(STAGE_PRODUCTION);
			const returned = await workflow.fetchSubmission(submission.id);
			expect(returned.status).toBe(STATUS_QUEUED);
			expect(
				decisionConstants(await workflow.fetchDecisions(submission.id)),
			).toContain(DECISION_RETURN_TO_WORKFLOW);

			// Manual Return to Done by an unassigned manager (site admin =
			// manager scope) — the supported audience.
			const adminCtx = await asUser('admin');
			const {page: adminPage, token: adminToken} = await openWithCsrf(adminCtx);
			const returnResp = await adminPage.request.post(
				`/index.php/publicknowledge/api/v1/submissions/${submission.id}/returnToDone`,
				{headers: {'X-Csrf-Token': adminToken}},
			);
			expect(returnResp.ok()).toBeTruthy();
			await expect
				.poll(
					async () => (await workflow.fetchSubmission(submission.id)).stageId,
					{timeout: 20_000},
				)
				.toBe(STAGE_DONE);
		},
	);

	// Canonical scenario 13 — on a notifying decision the editor can edit
	// subject/body, reveal CC/BCC, attach an uploaded file, or click Skip
	// this email to record with no email sent. Two sub-flows: a composed
	// Send-for-Review email (edited subject/body + CC + attachment reaches
	// the author and the CC address) and a skipped Accept-and-Skip email
	// (the decision records, no author email).
	test(
		'compose the author email — CC/BCC, attach, or skip',
		{tag: '@regression'},
		async ({page, pkpApi, pkpMail}) => {
			test.slow(); // two decisions + an upload
			const tag = uniqueTag();
			const cc = `cc${tag}@mailinator.com`;
			const skipMarker = `Skipnomail${tag}`; // in the (never-sent) skip email

			const workflow = new EditorialWorkflowPage(page);

			// --- Skip sub-flow FIRST: its (absent) mail is enqueued before
			// the CC control the negative assertion waits on. ---
			const {submission: skipSub} = await pkpApi.createSubmission(
				submittedSpec({tag, title: skipMarker}),
			);
			await workflow.goto(skipSub.id);
			await workflow.clickDecision('Accept and Skip Review');
			// Skipping Notify Authors auto-advances to the Select Files step.
			await workflow.skipDecisionEmail();
			await workflow.recordDecision();
			await workflow.viewSubmissionFromCompletionDialog(skipSub.id);
			expect((await workflow.fetchSubmission(skipSub.id)).stageId).toBe(
				STAGE_COPYEDITING,
			);
			expect(
				decisionConstants(await workflow.fetchDecisions(skipSub.id)),
			).toContain(DECISION_SKIP_EXTERNAL_REVIEW);

			// --- Compose sub-flow: edit subject/body, add CC, attach a file. ---
			const {submission: composeSub} = await pkpApi.createSubmission(
				submittedSpec({tag, title: `Compose mail ${tag}`}),
			);
			await workflow.goto(composeSub.id);
			await workflow.clickDecision('Send for Review');
			await workflow.setDecisionEmailSubject(
				'notifyAuthors',
				`Composed subject ${tag}`,
			);
			await workflow.setDecisionEmailBody(
				'notifyAuthors',
				`<p>Composed body — ${tag}</p>`,
			);
			await workflow.addCcBccToDecisionEmail('notifyAuthors', {cc});
			await workflow.attachDecisionEmailUpload(ARTICLE_FIXTURE);
			await workflow.clickContinue(); // Notify Authors → Select Files
			await workflow.recordDecision();

			// The author received the composed email (edited subject/body)…
			const [authorMail] = await pkpMail.find({
				to: AUTHOR_EMAIL,
				contains: tag,
				subject: `Composed subject ${tag}`,
				timeoutMs: 30_000,
			});
			expect(authorMail).toBeTruthy();
			// …with the CC recipient on the Cc header. (Mailpit's `to:` search
			// matches the To header only, so assert the header directly.)
			const composed = await pkpMail.fullMessage(authorMail.ID);
			expect((composed.Cc || []).map((addr) => addr.Address)).toContain(cc);

			// The skipped decision sent NO author email — bounded by the
			// composed author email as the positive control (which arrived
			// after the skip decision was recorded).
			await pkpMail.expectNone({
				to: AUTHOR_EMAIL,
				contains: skipMarker,
				afterControl: {to: AUTHOR_EMAIL, contains: tag},
				timeoutMs: 30_000,
			});
		},
	);

	// Canonical scenario 14 — permission boundaries. An assistant
	// (copyeditor) never sees or can record a decision (the decision page is
	// closed to them and the write policy denies them); an unassigned
	// section editor is refused; an unassigned manager may decide anyway
	// (manager scope). (A recommend-only editor's confinement to
	// recommendations is covered by the recommendation test above.)
	test(
		'permission boundaries on recording a decision',
		{tag: '@regression'},
		async ({page, pkpApi, asUser}) => {
			test.slow(); // three actors
			const tag = uniqueTag();
			const {submission} = await pkpApi.createSubmission({
				...submittedSpec({
					tag,
					title: `Permissions ${tag}`,
					participants: [
						{user: 'dbarnes', role: 'editor'},
						{user: 'mfritz', role: 'copyeditor'},
					],
				}),
				decisions: [{type: 'skipExternalReview', by: 'dbarnes'}],
			});
			const decisionsUrl = `/index.php/publicknowledge/api/v1/submissions/${submission.id}/decisions`;

			// --- Assistant (mfritz, assigned copyeditor on the current stage) ---
			const mfritzCtx = await asUser('mfritz');
			const mfritzPage = await mfritzCtx.newPage();
			const mfritzWorkflow = new EditorialWorkflowPage(mfritzPage);
			await mfritzWorkflow.goto(submission.id);
			// The copyediting pane renders, but with no decision buttons.
			await expect(
				mfritzPage.getByRole('heading', {name: 'Workflow: Copyediting'}),
			).toBeVisible({timeout: 20_000});
			await expect(
				mfritzPage.getByRole('button', {
					name: 'Send To Production',
					exact: true,
				}),
			).toHaveCount(0);
			const mfritzToken = await csrfToken(mfritzPage);

			// The write policy denies the assistant. (Unauthorized API calls
			// surface as 401, not 403 — useFetch.js quirk, patterns.md §UI
			// realities wave 2.)
			const mfritzPost = await mfritzPage.request.post(decisionsUrl, {
				headers: {'X-Csrf-Token': mfritzToken},
				data: {decision: DECISION_SEND_TO_PRODUCTION},
			});
			expect(mfritzPost.ok()).toBeFalsy();
			expect([401, 403]).toContain(mfritzPost.status());

			// The decision page itself is closed to assistants (role list).
			await mfritzPage.goto(
				`/index.php/publicknowledge/en/decision/record/${submission.id}?decision=${DECISION_SEND_TO_PRODUCTION}`,
				{waitUntil: 'commit'},
			);
			await mfritzPage.waitForURL(/authorizationDenied/, {
				timeout: 20_000,
				waitUntil: 'commit',
			});

			// --- Unassigned section editor (minoue, not on this submission) ---
			const minoueCtx = await asUser('minoue');
			const {page: minouePage, token: minoueToken} =
				await openWithCsrf(minoueCtx);
			const minouePost = await minouePage.request.post(decisionsUrl, {
				headers: {'X-Csrf-Token': minoueToken},
				data: {decision: DECISION_SEND_TO_PRODUCTION},
			});
			expect(minouePost.ok()).toBeFalsy();
			expect([401, 403]).toContain(minouePost.status());

			// --- Unassigned manager (site admin = manager scope) may decide ---
			const adminCtx = await asUser('admin');
			const {page: adminPage, token: adminToken} = await openWithCsrf(adminCtx);
			const adminPost = await adminPage.request.post(decisionsUrl, {
				headers: {'X-Csrf-Token': adminToken},
				data: {decision: DECISION_SEND_TO_PRODUCTION},
			});
			expect(adminPost.ok()).toBeTruthy();
			await expect
				.poll(
					async () => (await new EditorialWorkflowPage(page).fetchSubmission(
						submission.id,
					)).stageId,
					{timeout: 20_000},
				)
				.toBe(STAGE_PRODUCTION);
		},
	);
});
