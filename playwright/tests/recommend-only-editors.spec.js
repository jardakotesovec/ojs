// @ts-check
const {test, expect} = require('../support/fixtures.js');
const {EditorialWorkflowPage} = require('../pages/EditorialWorkflowPage.js');

/**
 * Recommend-only editors (the advise-don't-decide ROLE) — tests for the
 * canonical scenarios of docs/product/specs/recommend-only-editors.md.
 *
 * This spec owns what the recommend_only FLAG DOES to an editor's
 * experience. It deliberately does NOT re-drive the recommendation act,
 * its RecommendationNotifyEditors email, or the requiredDecidingEditor
 * backend guard — those transitions are owned and verified by
 * editorial-decisions.spec.js (scenario 11). Setting the flag is owned by
 * stage-participants; managing reviewers by assign-and-manage-reviewers.
 *
 * Scenario mapping (6 canonical → 6 tests):
 *   2 → the action pane shows Recommend, not Decide   (test 1)
 *   3 → no deciding editor → no recommendation        (test 2)
 *   4 → the recommendation surfaces to the decider    (test 3)
 *   5 → latest recommendation per editor              (test 4)
 *   6 → a recommend-only editor still runs the review (test 5)
 *   1 → recommend-then-decider-acts is fully owned by editorial-decisions
 *       (scenario 11); its distinctive residue — that the recorded
 *       recommendation surfaces — is folded into test 3. Its budget slot
 *       is repurposed to the spec's Open Question 4: what a recommend-only
 *       editor sees at the SUBMISSION stage                (test 6/OQ4).
 *
 * How duplication with editorial-decisions is avoided: recommendations
 * needed as preconditions (tests 3 & 4) are established by a lightweight
 * DIRECT POST to the decisions API (no wizard, no notify email — the
 * un-skippable notify step is a wizard constraint, not an API one), then
 * this spec asserts only the ROLE-specific SURFACING/affordances the
 * decision engine doesn't cover. Every affordance claim (which buttons a
 * given actor sees) is driven live in the browser as that actor.
 *
 * Placement: OJS root — leans on the publicknowledge journal, its
 * sections and the OJS WorkflowPageOJS action bar (the recommend-only
 * controls are wired by workflowConfigEditorialOJS.js), even though the
 * role's map logic ships from pkp-lib.
 *
 * Parallel-safety: tags are single hyphenless alphanumeric tokens; every
 * submission (and scratch journal) is per-test. No Mailpit assertions
 * (the notify email is editorial-decisions' concern).
 */

// Workflow stages (PKPApplication WORKFLOW_STAGE_ID_*).
const STAGE_SUBMISSION = 1;
const STAGE_REVIEW = 3;

// Submission status (PKPSubmission STATUS_*).
const STATUS_QUEUED = 1;

// Decision constants (PKP\decision\Decision::*).
const DECISION_EXTERNAL_REVIEW = 3;
const DECISION_RECOMMEND_ACCEPT = 9;
const DECISION_RECOMMEND_DECLINE = 12;

// Recommend-only UI strings (locale en).
const RECOMMEND_ACCEPT = 'Recommend Accept';
const RECOMMEND_REVISIONS = 'Recommend Revisions';
const RECOMMEND_DECLINE = 'Recommend Decline';
// The finalizing review-stage decision buttons a deciding editor sees.
const DECIDE_ACCEPT = 'Accept Submission';
const DECIDE_REQUEST_REVISIONS = 'Request Revisions';
const DECIDE_DECLINE = 'Decline Submission';
// Submission-stage finalizing buttons.
const SUBMIT_SEND_FOR_REVIEW = 'Send for Review';
const SUBMIT_SKIP_REVIEW = 'Accept and Skip Review';
// A recorded Recommend-Accept surfaces phrased as the recommended
// decision; a Recommend-Decline as "Decline Submission".
const RECOMMENDATION_LABEL_ACCEPT = 'Accept Submission';
const RECOMMENDATION_LABEL_DECLINE = 'Decline Submission';
const NO_DECIDING_EDITORS =
	'You can not make a recommendation until an editor is assigned with permission to record a decision.';
const CHANGE_RECOMMENDATION = 'Change decision';

/** A unique, hyphenless, alphanumeric tag (parallel isolation). */
function uniqueTag() {
	const workerLetter = String.fromCharCode(97 + (test.info().parallelIndex % 26));
	let suffix = '';
	while (suffix.length < 6) {
		suffix += Math.random().toString(36).replace(/[^a-z0-9]/g, '');
	}
	return `roed${workerLetter}${suffix.slice(0, 6)}`;
}

/**
 * A submitted, in-external-review submission on publicknowledge. Because
 * the real submit fires AssignEditors, the ART section's editors
 * (dbarnes, dbuskins, sberardo) are auto-assigned as DECIDING editors in
 * addition to `participants` — fine for tests that just need a deciding
 * editor present. `minoue` is a Reviews-section editor, NOT auto-assigned
 * to an ART submission, so a `recommendOnly` flag on her sticks.
 *
 * @param {{tag: string, title: string, participants?: object[], reviewers?: object[]}} opts
 */
function reviewSpec({
	tag,
	title,
	participants = [{user: 'dbarnes', role: 'editor'}],
	reviewers = [],
}) {
	return {
		tag,
		journal: 'publicknowledge',
		submitter: 'atester',
		section: 'ART',
		locale: 'en',
		submitted: true,
		participants,
		decisions: [{type: 'sendExternalReview', by: 'dbarnes'}],
		reviewRounds: [{reviewers}],
		publications: [{metadata: {title: {en: title}}}],
	};
}

/**
 * A submitted, stage-1 (Submission stage) submission on publicknowledge —
 * no decisions, so it rests in the Submission stage. Used for the OQ4
 * submission-stage affordance test.
 *
 * @param {{tag: string, title: string, participants?: object[]}} opts
 */
function submissionStageSpec({tag, title, participants}) {
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

/** Find the stage entry (by numeric id) in a submission GET payload. */
function stageById(submission, stageId) {
	const stages = submission.stages;
	const list = Array.isArray(stages) ? stages : Object.values(stages || {});
	return list.find((s) => s.id === stageId);
}

/** The current (last) review round's id from a submission GET payload. */
function currentReviewRoundId(submission) {
	const rounds = submission.reviewRounds || [];
	return rounds[rounds.length - 1]?.id;
}

/**
 * Fetch a submission as JSON through a page's session cookies. The
 * recommend-only props (currentUserCanRecommendOnly, editorAssigned,
 * recommendations, currentUserRecommendation) are computed per-viewer, so
 * WHICH actor's page issues the GET matters.
 *
 * @param {import('@playwright/test').Page} requestor
 * @param {number} submissionId
 * @param {string} [journalPath='publicknowledge']
 */
async function fetchSubmission(requestor, submissionId, journalPath = 'publicknowledge') {
	const res = await requestor.request.get(
		`/index.php/${journalPath}/api/v1/submissions/${submissionId}`,
	);
	if (!res.ok()) {
		throw new Error(
			`GET submission ${submissionId} failed: ${res.status()} ${await res.text()}`,
		);
	}
	return res.json();
}

/**
 * The current user's CSRF token from a mounted backend page (needed for
 * the decisions API POST). Session-scoped, valid across contexts.
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
	const token = await page.evaluate(
		// @ts-ignore
		() => window.pkp?.currentUser?.csrfToken,
	);
	return {page, token};
}

/**
 * Establish a recommendation precondition by POSTing it directly to the
 * decisions API as the recommend-only editor — the lightweight
 * alternative to re-driving editorial-decisions' Record-Decision wizard.
 * A bare POST (no `actions`) records the recommendation without sending
 * the notify-editors email (that's the wizard's un-skippable step, not an
 * API requirement). The endpoint's DecisionAllowedPolicy permits a
 * recommend-only editor to make recommendations.
 *
 * @param {import('@playwright/test').BrowserContext} ctx  the recommending editor's context
 * @param {{submissionId: number, reviewRoundId: number, decision: number, journalPath?: string}} opts
 */
async function recordRecommendation(
	ctx,
	{submissionId, reviewRoundId, decision, journalPath = 'publicknowledge'},
) {
	const {page, token} = await openWithCsrf(ctx);
	const res = await page.request.post(
		`/index.php/${journalPath}/api/v1/submissions/${submissionId}/decisions`,
		{
			headers: {'X-Csrf-Token': token},
			data: {decision, reviewRoundId},
		},
	);
	if (!res.ok()) {
		throw new Error(
			`recommendation POST (decision ${decision}) failed: ${res.status()} ${await res.text()}`,
		);
	}
	return res;
}

test.use({user: 'dbarnes'}); // the deciding editor / default actor

test.describe('Recommend-only editors', () => {
	// Canonical scenario 2 — on the same review-stage submission the
	// recommend-only editor's action pane swaps DECIDE for RECOMMEND: minoue
	// sees Recommend Revisions / Accept / Decline and NOT the finalizing
	// Accept Submission / Request Revisions / Decline, while the deciding
	// editor (dbarnes) on the identical submission sees the finalizing
	// buttons and none of the Recommend buttons. Driven live as each actor
	// (the affordance-accuracy class); the per-user server flags
	// (currentUserCanRecommendOnly, editorAssigned) are cross-checked.
	test(
		'the action pane shows Recommend, not Decide',
		{tag: ['@smoke', '@regression']},
		async ({page, pkpApi, asUser}) => {
			test.slow(); // two actors
			const tag = uniqueTag();
			const {submission} = await pkpApi.createSubmission(
				reviewSpec({
					tag,
					title: `Action pane ${tag}`,
					participants: [
						{user: 'dbarnes', role: 'editor'},
						{user: 'minoue', role: 'sectionEditor', recommendOnly: true},
					],
				}),
			);

			// --- The recommend-only editor (minoue) ---
			const minoueCtx = await asUser('minoue');
			const minouePage = await minoueCtx.newPage();
			const minoueWorkflow = new EditorialWorkflowPage(minouePage);
			await minoueWorkflow.goto(submission.id);

			// She sees the three Recommend buttons…
			await expect(
				minouePage.getByRole('button', {name: RECOMMEND_ACCEPT, exact: true}),
			).toBeVisible({timeout: 20_000});
			await expect(
				minouePage.getByRole('button', {name: RECOMMEND_REVISIONS, exact: true}),
			).toBeVisible();
			await expect(
				minouePage.getByRole('button', {name: RECOMMEND_DECLINE, exact: true}),
			).toBeVisible();
			// …and NONE of the finalizing decision buttons.
			await expect(
				minouePage.getByRole('button', {name: DECIDE_ACCEPT, exact: true}),
			).toHaveCount(0);
			await expect(
				minouePage.getByRole('button', {name: DECIDE_REQUEST_REVISIONS, exact: true}),
			).toHaveCount(0);
			await expect(
				minouePage.getByRole('button', {name: DECIDE_DECLINE, exact: true}),
			).toHaveCount(0);

			// Server truth for minoue's view.
			const minoueSub = await fetchSubmission(minouePage, submission.id);
			expect(stageById(minoueSub, STAGE_REVIEW).currentUserCanRecommendOnly).toBe(
				true,
			);
			expect(minoueSub.editorAssigned).toBe(true); // dbarnes is a deciding editor

			// --- The deciding editor (dbarnes, default page) sees the inverse ---
			const dbarnesWorkflow = new EditorialWorkflowPage(page);
			await dbarnesWorkflow.goto(submission.id);
			await expect(
				page.getByRole('button', {name: DECIDE_ACCEPT, exact: true}),
			).toBeVisible({timeout: 20_000});
			await expect(
				page.getByRole('button', {name: DECIDE_REQUEST_REVISIONS, exact: true}),
			).toBeVisible();
			// dbarnes gets no Recommend buttons.
			await expect(
				page.getByRole('button', {name: RECOMMEND_ACCEPT, exact: true}),
			).toHaveCount(0);

			const dbarnesSub = await fetchSubmission(page, submission.id);
			expect(
				stageById(dbarnesSub, STAGE_REVIEW).currentUserCanRecommendOnly,
			).toBeFalsy();
		},
	);

	// Canonical scenario 3 — a recommendation requires a deciding editor.
	// When the only editor on a submission is recommend-only, the pane shows
	// a "no deciding editors" message and offers no Recommend buttons
	// (editorAssigned=false); a sibling submission on the same journal that
	// DOES carry a deciding editor lights the buttons back up
	// (editorAssigned=true). A scratch journal is used because every
	// publicknowledge section auto-assigns a section editor on submit, which
	// would prevent a genuine no-deciding-editor state.
	test(
		'no deciding editor → message, a deciding editor lights it up',
		{tag: '@regression'},
		async ({pkpApi, asUser}) => {
			test.slow(); // scratch journal + two submissions + a second actor
			const tag = uniqueTag();

			// A scratch journal whose default ART section maps NO section
			// editors, so submit auto-assigns none — only the participants we
			// name are assigned.
			const {context} = await pkpApi.createJournal({
				tag,
				users: [
					{username: 'atester', roles: ['author']},
					{username: 'minoue', roles: ['sectionEditor']},
					{username: 'dbuskins', roles: ['sectionEditor']},
				],
			});
			const journalPath = context.path;

			const inReviewOn = (title, participants) => ({
				tag,
				journal: journalPath,
				submitter: 'atester',
				section: 'ART',
				locale: 'en',
				submitted: true,
				participants,
				decisions: [{type: 'sendExternalReview', by: participants[0].user}],
				reviewRounds: [{reviewers: []}],
				publications: [{metadata: {title: {en: title}}}],
			});

			// Sub A: minoue is the ONLY editor, and she is recommend-only.
			const {submission: lonely} = await pkpApi.createSubmission(
				inReviewOn(`No decider ${tag}`, [
					{user: 'minoue', role: 'sectionEditor', recommendOnly: true},
				]),
			);
			// Sub B: a plain deciding section editor (dbuskins) sits alongside
			// the recommend-only minoue.
			const {submission: withDecider} = await pkpApi.createSubmission(
				inReviewOn(`Has decider ${tag}`, [
					{user: 'dbuskins', role: 'sectionEditor'},
					{user: 'minoue', role: 'sectionEditor', recommendOnly: true},
				]),
			);

			const minoueCtx = await asUser('minoue');
			const minouePage = await minoueCtx.newPage();
			const workflow = new EditorialWorkflowPage(minouePage);

			// --- Sub A: no deciding editor → the withheld state ---
			await workflow.goto(lonely.id, {journalPath});
			await expect(minouePage.getByText(NO_DECIDING_EDITORS)).toBeVisible({
				timeout: 20_000,
			});
			await expect(
				minouePage.getByRole('button', {name: RECOMMEND_ACCEPT, exact: true}),
			).toHaveCount(0);
			const lonelySub = await fetchSubmission(minouePage, lonely.id, journalPath);
			expect(lonelySub.editorAssigned).toBe(false);
			// She is still recognised as a recommend-only editor on the stage…
			expect(stageById(lonelySub, STAGE_REVIEW).currentUserCanRecommendOnly).toBe(
				true,
			);

			// --- Sub B: a deciding editor is present → the buttons light up ---
			await workflow.goto(withDecider.id, {journalPath});
			await expect(
				minouePage.getByRole('button', {name: RECOMMEND_ACCEPT, exact: true}),
			).toBeVisible({timeout: 20_000});
			await expect(minouePage.getByText(NO_DECIDING_EDITORS)).toHaveCount(0);
			const decidedSub = await fetchSubmission(
				minouePage,
				withDecider.id,
				journalPath,
			);
			expect(decidedSub.editorAssigned).toBe(true);
		},
	);

	// Canonical scenario 4 (+ scenario 1's surfacing residue) — after a
	// recommendation is recorded, the DECIDING editor's review pane lists it
	// as the advised decision ("Accept Submission"), while the RECOMMENDING
	// editor sees their OWN recommendation echoed with a "Change decision"
	// link (which reopens the Recommend buttons). The recommendation itself
	// is seeded by a direct API POST as minoue (not the wizard — owned by
	// editorial-decisions).
	test(
		'the recommendation surfaces to the decider',
		{tag: '@regression'},
		async ({page, pkpApi, asUser}) => {
			test.slow(); // seed + recommendation POST + two actor views
			const tag = uniqueTag();
			const {submission} = await pkpApi.createSubmission(
				reviewSpec({
					tag,
					title: `Surfaces ${tag}`,
					participants: [
						{user: 'dbarnes', role: 'editor'},
						{user: 'minoue', role: 'sectionEditor', recommendOnly: true},
					],
				}),
			);

			const roundId = currentReviewRoundId(
				await fetchSubmission(page, submission.id),
			);
			expect(roundId).toBeTruthy();

			// minoue records a Recommend Accept (direct API — no wizard/email).
			const minoueCtx = await asUser('minoue');
			await recordRecommendation(minoueCtx, {
				submissionId: submission.id,
				reviewRoundId: roundId,
				decision: DECISION_RECOMMEND_ACCEPT,
			});

			// Recording a recommendation changes no submission state.
			const afterRec = await fetchSubmission(page, submission.id);
			expect(afterRec.stageId).toBe(STAGE_REVIEW);
			expect(afterRec.status).toBe(STATUS_QUEUED);

			// --- The deciding editor (dbarnes) sees the recommendation listed. ---
			const dbarnesWorkflow = new EditorialWorkflowPage(page);
			await dbarnesWorkflow.goto(submission.id);
			// The listing component renders a "Recommendation" heading over the
			// advised decision label.
			await expect(
				page.getByText(RECOMMENDATION_LABEL_ACCEPT).first(),
			).toBeVisible({timeout: 20_000});
			// Server truth: grouped, latest-per-editor, labelled as the decision.
			const dbarnesStage = stageById(afterRec, STAGE_REVIEW);
			expect(dbarnesStage.recommendations).toEqual([
				expect.objectContaining({
					decision: DECISION_RECOMMEND_ACCEPT,
					label: RECOMMENDATION_LABEL_ACCEPT,
				}),
			]);

			// --- The recommending editor (minoue) sees her OWN echo + change link. ---
			const minouePage = await minoueCtx.newPage();
			const minoueWorkflow = new EditorialWorkflowPage(minouePage);
			await minoueWorkflow.goto(submission.id);
			await expect(
				minouePage.getByRole('button', {name: CHANGE_RECOMMENDATION, exact: true}),
			).toBeVisible({timeout: 20_000});
			// Her recorded recommendation is echoed back…
			await expect(
				minouePage.getByText(RECOMMENDATION_LABEL_ACCEPT).first(),
			).toBeVisible();
			// …and the Recommend buttons are collapsed until she clicks Change.
			await expect(
				minouePage.getByRole('button', {name: RECOMMEND_ACCEPT, exact: true}),
			).toHaveCount(0);

			const minoueSub = await fetchSubmission(minouePage, submission.id);
			expect(
				stageById(minoueSub, STAGE_REVIEW).currentUserRecommendation,
			).toEqual(
				expect.objectContaining({
					decision: DECISION_RECOMMEND_ACCEPT,
					label: RECOMMENDATION_LABEL_ACCEPT,
				}),
			);
			// A recommending editor is NOT shown the deciding-editor listing.
			expect(
				stageById(minoueSub, STAGE_REVIEW).recommendations,
			).toBeFalsy();

			// Clicking "Change decision" reopens the Recommend buttons.
			await minouePage
				.getByRole('button', {name: CHANGE_RECOMMENDATION, exact: true})
				.click();
			await expect(
				minouePage.getByRole('button', {name: RECOMMEND_ACCEPT, exact: true}),
			).toBeVisible({timeout: 10_000});
		},
	);

	// Canonical scenario 5 — recommendations are grouped by editor and only
	// the latest per editor is kept: a recommend-only editor who re-records
	// supersedes their prior recommendation, and several recommending
	// editors each contribute exactly one line. A round-level
	// "recommendations are in" signal marks the round once (some) recommending
	// editors have weighed in. Asserted through the map (the deciding
	// editor's submission GET + the listing UI) after seeding the
	// recommendations by direct API POST.
	test(
		'latest recommendation per editor, and multiple editors',
		{tag: '@regression'},
		async ({page, pkpApi, asUser}) => {
			test.slow(); // scratch journal + three recommendation POSTs
			const tag = uniqueTag();

			// A scratch journal so two recommend-only editors' flags stick
			// cleanly (no ART auto-assign collision).
			const {context} = await pkpApi.createJournal({
				tag,
				users: [
					{username: 'atester', roles: ['author']},
					{username: 'dbarnes', roles: ['sectionEditor']},
					{username: 'minoue', roles: ['sectionEditor']},
					{username: 'dbuskins', roles: ['sectionEditor']},
				],
			});
			const journalPath = context.path;

			const {submission} = await pkpApi.createSubmission({
				tag,
				journal: journalPath,
				submitter: 'atester',
				section: 'ART',
				locale: 'en',
				submitted: true,
				participants: [
					{user: 'dbarnes', role: 'sectionEditor'}, // deciding editor
					{user: 'minoue', role: 'sectionEditor', recommendOnly: true},
					{user: 'dbuskins', role: 'sectionEditor', recommendOnly: true},
				],
				decisions: [{type: 'sendExternalReview', by: 'dbarnes'}],
				reviewRounds: [{reviewers: []}],
				publications: [{metadata: {title: {en: `Latest per editor ${tag}`}}}],
			});

			const roundId = currentReviewRoundId(
				await fetchSubmission(page, submission.id, journalPath),
			);
			expect(roundId).toBeTruthy();

			const minoueCtx = await asUser('minoue');
			const dbuskinsCtx = await asUser('dbuskins');

			// minoue recommends Accept first.
			await recordRecommendation(minoueCtx, {
				submissionId: submission.id,
				reviewRoundId: roundId,
				decision: DECISION_RECOMMEND_ACCEPT,
				journalPath,
			});

			// Midpoint: with one of two recommending editors weighed in, the
			// round's "recommendations are in" signal is active (READY), and
			// the decider sees exactly minoue's Accept.
			let decider = await fetchSubmission(page, submission.id, journalPath);
			expect(decider.recommendationsIn).toBe(true);
			expect(stageById(decider, STAGE_REVIEW).recommendations).toEqual([
				expect.objectContaining({label: RECOMMENDATION_LABEL_ACCEPT}),
			]);

			// minoue re-recommends Decline (supersedes her Accept); dbuskins
			// recommends Accept.
			await recordRecommendation(minoueCtx, {
				submissionId: submission.id,
				reviewRoundId: roundId,
				decision: DECISION_RECOMMEND_DECLINE,
				journalPath,
			});
			await recordRecommendation(dbuskinsCtx, {
				submissionId: submission.id,
				reviewRoundId: roundId,
				decision: DECISION_RECOMMEND_ACCEPT,
				journalPath,
			});

			// The decider now sees exactly two lines — one per editor. minoue's
			// earlier Accept was superseded by her Decline (so only ONE Accept
			// remains, dbuskins's), proving latest-per-editor + one-line-each.
			decider = await fetchSubmission(page, submission.id, journalPath);
			const labels = stageById(decider, STAGE_REVIEW).recommendations.map(
				(r) => r.label,
			);
			expect(labels).toHaveLength(2);
			expect(labels).toContain(RECOMMENDATION_LABEL_DECLINE); // minoue's latest
			expect(
				labels.filter((l) => l === RECOMMENDATION_LABEL_ACCEPT),
			).toHaveLength(1); // only dbuskins's Accept survives

			// The deciding editor's listing UI joins both advised decisions.
			const workflow = new EditorialWorkflowPage(page);
			await workflow.goto(submission.id, {journalPath});
			await expect(
				page.getByText(RECOMMENDATION_LABEL_DECLINE).first(),
			).toBeVisible({timeout: 20_000});
			await expect(
				page.getByText(RECOMMENDATION_LABEL_ACCEPT).first(),
			).toBeVisible();
		},
	);

	// Canonical scenario 6 — the flag narrows ONLY decision authority: a
	// recommend-only editor still runs the review. Thin pointer (the reviewer
	// grid mechanics are owned/verified by assign-and-manage-reviewers): as
	// minoue, the Reviewers manager renders with the seeded reviewer and an
	// enabled Add Reviewer affordance.
	test(
		'a recommend-only editor still runs the review',
		{tag: '@regression'},
		async ({pkpApi, asUser}) => {
			const tag = uniqueTag();
			const {submission} = await pkpApi.createSubmission(
				reviewSpec({
					tag,
					title: `Runs review ${tag}`,
					participants: [
						{user: 'dbarnes', role: 'editor'},
						{user: 'minoue', role: 'sectionEditor', recommendOnly: true},
					],
					reviewers: [
						{user: 'jjanssen', method: 'anonymous', status: 'accepted'},
					],
				}),
			);

			const minoueCtx = await asUser('minoue');
			const minouePage = await minoueCtx.newPage();
			const workflow = new EditorialWorkflowPage(minouePage);
			await workflow.goto(submission.id);

			// The Reviewers manager renders for the recommend-only editor…
			const reviewerManager = minouePage.locator('[data-cy="reviewer-manager"]');
			await expect(reviewerManager).toBeVisible({timeout: 20_000});
			// …showing the seeded reviewer…
			await expect(reviewerManager).toContainText('Julie Janssen', {
				timeout: 20_000,
			});
			// …and offering the (enabled) Add Reviewer affordance — she runs the
			// review even though she can only advise on the decision.
			const addReviewer = reviewerManager.getByRole('button', {
				name: 'Add Reviewer',
				exact: true,
			});
			await expect(addReviewer).toBeVisible();
			await expect(addReviewer).toBeEnabled();
		},
	);

	// Open Question 4 (spec) — the SUBMISSION-stage recommend-only affordance.
	// The recommend-only controls render ONLY at the review stage; at the
	// Submission stage a recommending user may finalize the one decision
	// getDecisionTypesMadeByRecommendingUsers() grants them: Send for Review.
	// This test asserts the app's REAL behavior — minoue sees the finalizing
	// "Send for Review" button (and can effectively decide that step) but NOT
	// Accept-and-Skip-Review, NOT Decline, and NO Recommend buttons — and
	// pins it to server truth (availableEditorialDecisions).
	test(
		'the submission-stage affordance is a finalizing Send-for-Review only (OQ4)',
		{tag: '@regression'},
		async ({pkpApi, asUser}) => {
			const tag = uniqueTag();
			const {submission} = await pkpApi.createSubmission(
				submissionStageSpec({
					tag,
					title: `Submission stage ${tag}`,
					participants: [
						{user: 'dbarnes', role: 'editor'},
						{user: 'minoue', role: 'sectionEditor', recommendOnly: true},
					],
				}),
			);

			const minoueCtx = await asUser('minoue');
			const minouePage = await minoueCtx.newPage();
			const workflow = new EditorialWorkflowPage(minouePage);
			await workflow.goto(submission.id);

			// She DOES see the finalizing Send-for-Review button…
			await expect(
				minouePage.getByRole('button', {name: SUBMIT_SEND_FOR_REVIEW, exact: true}),
			).toBeVisible({timeout: 20_000});
			// …but NOT the other finalizing submission-stage decisions…
			await expect(
				minouePage.getByRole('button', {name: SUBMIT_SKIP_REVIEW, exact: true}),
			).toHaveCount(0);
			await expect(
				minouePage.getByRole('button', {name: DECIDE_DECLINE, exact: true}),
			).toHaveCount(0);
			// …and NO Recommend buttons (the recommend-only controls do not
			// render at the Submission stage — only the review stage).
			await expect(
				minouePage.getByRole('button', {name: RECOMMEND_ACCEPT, exact: true}),
			).toHaveCount(0);

			// Server truth: the ONLY editorial decision offered to the
			// recommend-only editor at the Submission stage is Send for Review.
			const sub = await fetchSubmission(minouePage, submission.id);
			expect(sub.stageId).toBe(STAGE_SUBMISSION);
			const labels = (sub.availableEditorialDecisions || []).map((d) => d.label);
			expect(labels).toEqual([SUBMIT_SEND_FOR_REVIEW]);
		},
	);
});
