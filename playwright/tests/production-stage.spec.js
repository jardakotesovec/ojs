// @ts-check
const {test, expect} = require('../support/fixtures.js');
const {EditorialWorkflowPage} = require('../pages/EditorialWorkflowPage.js');
const {
	ParticipantManagerPage,
} = require('../../lib/pkp/playwright/pages/ParticipantManagerPage.js');
const {
	FileStagePanel,
	fixtureFilePath,
} = require('../../lib/pkp/playwright/pages/FileStagePanel.js');

/**
 * Production stage (the stage-5 workspace) — one test per canonical
 * scenario of docs/product/specs/production-stage.md (7 scenarios, landed
 * as 7 tests). The stage-5 EXITS' decision mechanics (the Move To
 * Copyediting transition + author email, the Schedule/publish authority)
 * are owned by editorial-decisions / publication-publish-flow; this spec
 * asserts only that they are OFFERED and, for Schedule For Publication,
 * that its navigation lands on the Publication tab (no decision recorded).
 *
 * THE distinctive job of this spec (per the task brief): the spec author
 * code-verified most claims and browser-drove the editor + layout-editor
 * views only on subs 421/422. These tests are the LIVE browser
 * verification of the FULL cast — every pane, affordance and status prompt
 * is asserted against the real rendered workspace, INCLUDING the author's
 * discussion-only view (which the spec author did NOT probe).
 *
 * Scope discipline (don't duplicate sibling coverage):
 *   - The Move To Copyediting transition/author-email/file-move-back are
 *     editorial-decisions' turf — no decision is ever recorded here (only
 *     its availability + the Schedule navigation are asserted).
 *   - The Participants assign/notify MECHANICS + per-stage role picker are
 *     stage-participants' turf; this spec drives an assign only to exercise
 *     the production-specific "Ready for Production" (LAYOUT_REQUEST) notify
 *     and the editor status-prompt flip that hangs off it.
 *   - Galley CRUD + proofing are galleys' (feature 26) turf; this spec adds
 *     ONE galley through the grid only to verify the production-stage
 *     CONSEQUENCE — the "create galleys" status prompt clearing (rule 5).
 *   - The generic FileManager / upload wizard is submission-files' turf;
 *     this spec drives an upload only to land a Production Ready file and
 *     read back the stage-5 file exchange.
 *
 * Seeding note (a spec finding — see rule 2): the production status prompt
 * is created by the SEND_TO_PRODUCTION notification recompute only (there
 * is NO other entry into stage 5), so every submission is seeded via
 * sendExternalReview → accept → sendToProduction — a real Send-To-Production
 * decision, which is what seeds "Assign a user to create galleys". That
 * decision does NOT carry promote files here, so the Production Ready Files
 * grid arrives empty ("No Items"), matching the spec's live probe on sub 421.
 *
 * Scenario-seeded galleys are deliberately NOT used to clear the prompt:
 * per the spec, a Repo-path galley (scenario seed) BYPASSES the status-prompt
 * recompute; only a galley added through the galley grid (ArticleGalleyGrid-
 * Handler) recomputes it. So the milestone test (scenario 4) adds its galley
 * through the UI grid.
 *
 * Placement: OJS root — leans on the publicknowledge journal, the OJS
 * stage-5 pane config (workflowConfigEditorialOJS / workflowConfigAuthorOJS),
 * the OJS decision set and the OJS-hosted galley grid, though the
 * FileManager / Discussion / Participant managers ship from pkp-lib.
 *
 * Parallel-safety: tags are single hyphenless alphanumeric tokens; every
 * submission is per-test and opened by the id the scenario API returns;
 * Mailpit reads are recipient+tag scoped (never clearAll).
 */

// Workflow stage / status constants (PKPApplication / PKPSubmission).
const STAGE_PRODUCTION = 5; // WORKFLOW_STAGE_ID_PRODUCTION
const STATUS_QUEUED = 1;

// The only stage-5 exit decision id (PKP\decision\Decision::BACK_FROM_PRODUCTION).
const DECISION_BACK_FROM_PRODUCTION = 29;

// The two inline status-prompt strings the workspace renders for the
// assigned editors (PKPEditingProductionStatusNotificationManager →
// notification.type.assignProductionUser / .awaitingRepresentations).
const PROMPT_ASSIGN_PRODUCTION =
	'Assign a user to create galleys using the Assign link in the Participants list.';
const PROMPT_AWAITING_GALLEYS = 'Awaiting Galleys.';

// The workflow shell's refusal shown to a user with no stage-5 access.
const ROLE_DENIED =
	'The current role does not have access to this operation.';

// Production Ready Files panel copy (useFileManagerConfig →
// editor.submission.production.productionReadyFiles /
// fileManager.productionReadyFilesDescription — the Vue FileManager uses the
// pkp-lib description key, not the legacy OJS override).
const PANEL_PRODUCTION_READY = 'Production Ready Files';
const PANEL_PRODUCTION_READY_DESC =
	'These are the files that will be sent for publication';

// The direct-upload wizard title on Production Ready Files
// (PRODUCTION_READY_FILES.wizardTitleKey = submission.upload.productionReady).
const WIZARD_PRODUCTION_READY = 'Upload a Production Ready File';

// Seeded users (full display names + their @mailinator addresses).
const USER = {
	dbarnes: {name: 'Daniel Barnes', email: 'dbarnes@mailinator.com'},
	gcox: {name: 'Graham Cox', email: 'gcox@mailinator.com'},
	shellier: {name: 'Stephen Hellier', email: 'shellier@mailinator.com'},
	atester: {name: 'Author Tester', email: 'atester@mailinator.com'},
};

/** A unique, hyphenless, alphanumeric tag (parallel isolation + mail scoping). */
function uniqueTag() {
	const workerLetter = String.fromCharCode(97 + (test.info().parallelIndex % 26));
	let suffix = '';
	while (suffix.length < 6) {
		suffix += Math.random().toString(36).replace(/[^a-z0-9]/g, '');
	}
	return `prod${workerLetter}${suffix.slice(0, 6)}`;
}

/**
 * A production-stage (stage 5, Queued) submission on publicknowledge,
 * reached via sendExternalReview → accept → sendToProduction — i.e. a
 * manuscript sent to production (the only entry into stage 5). The
 * SEND_TO_PRODUCTION recompute seeds the "Assign a user to create galleys"
 * editor status prompt (see the seeding note above). `submitted: true`
 * fires the real submit so the ART section editors are auto-assigned and
 * dbarnes is the deciding editor with manager scope; atester is the author.
 * Every seeded submission carries a real Article Text file.
 *
 * @param {{tag: string, title: string, participants?: object[]}} opts
 */
function productionSpec({
	tag,
	title,
	participants = [{user: 'dbarnes', role: 'editor'}],
}) {
	return {
		tag,
		journal: 'publicknowledge',
		submitter: 'atester',
		section: 'ART',
		locale: 'en',
		submitted: true,
		participants,
		decisions: [
			{type: 'sendExternalReview', by: 'dbarnes'},
			{type: 'accept', by: 'dbarnes'},
			{type: 'sendToProduction', by: 'dbarnes'},
		],
		reviewRounds: [{reviewers: []}],
		publications: [{metadata: {title: {en: title}}}],
	};
}

/** The editorial-dashboard deep link that mounts the workflow modal. */
function editorialLink(submissionId, journalPath = 'publicknowledge') {
	return `/index.php/${journalPath}/en/dashboard/editorial?workflowSubmissionId=${submissionId}`;
}

/** The author's My-Submissions deep link that mounts the workflow modal. */
function mySubmissionsLink(submissionId, journalPath = 'publicknowledge') {
	return `/index.php/${journalPath}/en/dashboard/mySubmissions?workflowSubmissionId=${submissionId}`;
}

/** The workflow side modal (outer wrapper reports visibility:hidden — scope only). */
function activeModal(page) {
	return page.locator('[data-cy="active-modal"]').first();
}

/** Stage-5 decision ids currently OFFERED to the requesting user (from the submission GET). */
function offeredDecisionIds(submission, stageId = STAGE_PRODUCTION) {
	return (submission.availableEditorialDecisions || [])
		.filter((d) => d.stageId === stageId)
		.map((d) => d.id);
}

test.use({user: 'dbarnes'}); // the deciding editor (manager scope)

test.describe('Production stage — the stage-5 workspace', () => {
	// Canonical scenario 1 — an editor opens a submission just handed to
	// production on the Production pane: the workspace stacks an "Assign a
	// user to create galleys" status prompt, a Production Ready Files grid
	// (the galley-bound files, "sent for publication"), a Production Tasks &
	// Discussions panel and a Participants list with a Layout-Editor-capable
	// Assign picker; the action bar offers Schedule For Publication + Move To
	// Copyediting.
	test(
		'editor opens the production workspace',
		{tag: ['@smoke', '@regression']},
		async ({page, pkpApi}) => {
			const tag = uniqueTag();
			const {submission} = await pkpApi.createSubmission(
				productionSpec({tag, title: `Production workspace ${tag}`}),
			);

			const workflow = new EditorialWorkflowPage(page);
			await workflow.goto(submission.id);
			const modal = workflow.workflowModal();

			// The stage-5 pane opened on the Production stage.
			await expect(
				modal.getByRole('heading', {name: 'Workflow: Production'}),
			).toBeVisible({timeout: 20_000});

			// Status prompt (WorkflowNotificationDisplay) — "Assign a user to
			// create galleys" (seeded by the Send-To-Production decision).
			await expect(modal.getByText(PROMPT_ASSIGN_PRODUCTION)).toBeVisible({
				timeout: 20_000,
			});

			// Production Ready Files grid — title + description (galley-bound
			// files "sent for publication").
			await expect(
				modal.getByRole('heading', {name: PANEL_PRODUCTION_READY, exact: true}),
			).toBeVisible();
			await expect(
				modal.getByText(PANEL_PRODUCTION_READY_DESC),
			).toBeVisible();

			// Production Tasks & Discussions panel.
			await expect(modal.locator('[data-cy="discussion-manager"]')).toBeVisible();
			await expect(
				modal.getByRole('heading', {name: 'Production Tasks & Discussions'}),
			).toBeVisible();

			// Participants list (right rail) with a Layout-Editor-capable Assign
			// picker.
			const participants = modal.locator('[data-cy="participant-manager"]');
			await expect(participants).toBeVisible();
			await expect(
				participants.getByRole('button', {name: 'Assign', exact: true}),
			).toBeVisible();

			// Action bar offers Schedule For Publication + Move To Copyediting.
			const actions = workflow.actionItems();
			await expect(
				actions.getByRole('button', {
					name: 'Schedule For Publication',
					exact: true,
				}),
			).toBeVisible();
			await expect(
				actions.getByRole('button', {name: 'Move To Copyediting', exact: true}),
			).toBeVisible();

			// Server truth: stage 5 / Queued, and Back-From-Production (29) is the
			// sole offered stage-5 decision (spec rule 7).
			const s = await workflow.fetchSubmission(submission.id);
			expect(s.stageId).toBe(STAGE_PRODUCTION);
			expect(s.status).toBe(STATUS_QUEUED);
			expect(offeredDecisionIds(s)).toEqual([DECISION_BACK_FROM_PRODUCTION]);
		},
	);

	// Canonical scenario 2 — the editor assigns a Layout Editor and notifies
	// them with the retained "Ready for Production" (LAYOUT_REQUEST) template:
	// the layout editor receives the layout-request email and the editor's
	// status prompt flips from "Assign a user to create galleys" to "Awaiting
	// Galleys". (Rule 6: only the non-default Ready-for-Production template
	// raises the layout task notification + writes LAYOUT_NOTIFY_EDITOR — the
	// email here is that template's delivery.)
	test(
		'assign a layout editor and request production',
		{tag: ['@smoke', '@regression']},
		async ({page, pkpApi, pkpMail}) => {
			const tag = uniqueTag();
			const {submission} = await pkpApi.createSubmission(
				productionSpec({tag, title: `Request production ${tag}`}),
			);

			const workflow = new EditorialWorkflowPage(page);
			await workflow.goto(submission.id);
			const modal = workflow.workflowModal();

			// Before assigning: the editor sees "Assign a user to create galleys".
			await expect(modal.getByText(PROMPT_ASSIGN_PRODUCTION)).toBeVisible({
				timeout: 20_000,
			});

			// Assign gcox as Layout Editor and notify with the Ready for
			// Production template (tag woven into the message so the email is
			// Mailpit-scopable).
			const pm = new ParticipantManagerPage(page);
			await pm.expectVisible();
			await pm.assignParticipant({
				userGroup: 'Layout Editor',
				nameSearch: 'Cox',
				fullName: USER.gcox.name,
				notify: {
					template: 'Ready for Production',
					message: `<p>Please prepare the galleys — ${tag}</p>`,
				},
			});

			// The layout editor received the layout-request email.
			const [mail] = await pkpMail.find({
				to: USER.gcox.email,
				contains: tag,
				timeoutMs: 30_000,
			});
			expect(mail).toBeTruthy();

			// The status prompt flips: the notified assign opened a production
			// discussion, so the manager now keys "awaiting galleys".
			await workflow.goto(submission.id);
			const modalAfter = workflow.workflowModal();
			await expect(modalAfter.getByText(PROMPT_AWAITING_GALLEYS)).toBeVisible({
				timeout: 20_000,
			});
			await expect(
				modalAfter.getByText(PROMPT_ASSIGN_PRODUCTION),
			).toHaveCount(0);
		},
	);

	// Canonical scenario 3 — the production-ready file exchange. The layout
	// editor opens the Production Ready Files grid and UPLOADS the source to
	// be turned into galleys. On this Send-To-Production path the grid arrived
	// empty (no promote files), so the layout editor uploads via the panel's
	// direct "Upload" wizard (FILE_UPLOAD → "Upload a Production Ready File").
	// Also verifies the layout editor's upload permission on this grid.
	test(
		'the layout editor uploads a production-ready file',
		{tag: '@regression'},
		async ({page, pkpApi, asUser}) => {
			test.slow(); // second actor (layout editor) + a real upload
			const tag = uniqueTag();
			const {submission} = await pkpApi.createSubmission(
				productionSpec({
					tag,
					title: `Production files ${tag}`,
					participants: [
						{user: 'dbarnes', role: 'editor'},
						{user: 'gcox', role: 'layoutEditor'},
					],
				}),
			);

			// --- Editor (dbarnes): the grid arrives empty on this path. ---
			const workflow = new EditorialWorkflowPage(page);
			await workflow.goto(submission.id);
			const editorGrid = new FileStagePanel(page, PANEL_PRODUCTION_READY);
			await editorGrid.expectVisible();
			await expect(
				workflow.workflowModal().getByText('No Items'),
			).toBeVisible({timeout: 20_000});

			// --- Layout editor (gcox): uploads a production-ready file. ---
			const gcoxCtx = await asUser('gcox');
			const gcoxPage = await gcoxCtx.newPage();
			await gcoxPage.goto(editorialLink(submission.id), {waitUntil: 'commit'});
			await expect(
				gcoxPage.getByRole('heading', {name: 'Workflow: Production'}),
			).toBeVisible({timeout: 20_000});

			const displayName = `galley-source-${tag}.pdf`;
			const gcoxGrid = new FileStagePanel(gcoxPage, PANEL_PRODUCTION_READY);
			await gcoxGrid.expectVisible();
			// Production Ready Files uses the direct "Upload" button (FILE_UPLOAD),
			// NOT the Upload/Select flow — the layout editor has the assistant
			// upload permission on this grid.
			await expect(
				gcoxGrid.root().getByRole('button', {name: 'Upload', exact: true}),
			).toBeVisible();
			const wizard = await gcoxGrid.openDirectUploadWizard(WIZARD_PRODUCTION_READY);
			await gcoxGrid.driveUploadWizard(wizard, {
				filePath: fixtureFilePath(),
				displayName,
			});
			await expect(gcoxGrid.row(displayName)).toBeVisible({timeout: 20_000});

			// --- Editor (dbarnes): the uploaded file now shows in the grid. ---
			await workflow.goto(submission.id);
			await expect(editorGrid.row(displayName)).toBeVisible({timeout: 20_000});
		},
	);

	// Canonical scenario 4 — the production milestone. A galley added through
	// the galley grid (Publication → Galleys) recomputes the editor's status
	// prompt: the instant a representation exists, the "create galleys" prompt
	// CLEARS (rule 5). The seed shows the "Assign a user to create galleys"
	// card (discussion-keyed — no production discussion yet, rule 2); adding
	// the galley clears the whole production status prompt (both cards).
	test(
		'adding a galley clears the production status prompt',
		{tag: '@regression'},
		async ({page, pkpApi}) => {
			test.slow(); // a full Add-Galley → Upload wizard drive
			const tag = uniqueTag();
			const {submission} = await pkpApi.createSubmission(
				productionSpec({tag, title: `Galley milestone ${tag}`}),
			);

			const workflow = new EditorialWorkflowPage(page);
			await workflow.goto(submission.id);

			// Before the galley: the production status prompt is present.
			await expect(
				workflow.workflowModal().getByText(PROMPT_ASSIGN_PRODUCTION),
			).toBeVisible({timeout: 20_000});

			// Add the first galley through the galley grid (Publication → Galleys).
			await workflow.openPublicationPanel('Galleys');
			await workflow.addGalley({
				label: `PDF ${tag}`,
				filePath: fixtureFilePath(),
			});

			// Back on the Production pane: a representation now exists, so BOTH
			// production status cards are gone (rule 5 — the galley-grid recompute).
			await workflow.goto(submission.id);
			const modalAfter = workflow.workflowModal();
			await expect(
				modalAfter.getByRole('heading', {name: 'Workflow: Production'}),
			).toBeVisible({timeout: 20_000});
			await expect(
				modalAfter.getByText(PROMPT_ASSIGN_PRODUCTION),
			).toHaveCount(0);
			await expect(
				modalAfter.getByText(PROMPT_AWAITING_GALLEYS),
			).toHaveCount(0);
		},
	);

	// Canonical scenarios 5 + 6 (both stage-5 exits) — Schedule For Publication
	// is a navigation shortcut that jumps the menu to Publication → Title &
	// Abstract (recording nothing), and Move To Copyediting is the sole stage-5
	// decision (Back From Production = 29), OFFERED but left to
	// editorial-decisions to record. Neither transition is driven here.
	test(
		'Schedule For Publication navigates to publication; Move To Copyediting is offered',
		{tag: '@regression'},
		async ({page, pkpApi}) => {
			const tag = uniqueTag();
			const seeded = await pkpApi.createSubmission(
				productionSpec({tag, title: `Stage-5 exits ${tag}`}),
			);
			const submission = seeded.submission;
			const publicationId = seeded.publications[0].id;

			const workflow = new EditorialWorkflowPage(page);
			await workflow.goto(submission.id);
			const actions = workflow.actionItems();

			// Both stage-5 exits are offered in the action bar…
			await expect(
				actions.getByRole('button', {
					name: 'Schedule For Publication',
					exact: true,
				}),
			).toBeVisible({timeout: 20_000});
			await expect(
				actions.getByRole('button', {name: 'Move To Copyediting', exact: true}),
			).toBeVisible();
			// …and Back-From-Production (29) is the sole offered stage-5 decision.
			const s = await workflow.fetchSubmission(submission.id);
			expect(offeredDecisionIds(s)).toEqual([DECISION_BACK_FROM_PRODUCTION]);

			// Schedule For Publication jumps the menu to Publication → Title &
			// Abstract (recording no decision).
			await actions
				.getByRole('button', {name: 'Schedule For Publication', exact: true})
				.click();
			await expect(
				workflow
					.workflowModal()
					.getByRole('heading', {name: 'Publication: Title & Abstract'}),
			).toBeVisible({timeout: 20_000});
			await expect(page).toHaveURL(
				new RegExp(
					`workflowMenuKey=publication_${publicationId}_titleAbstract(?:&|$)`,
				),
			);

			// It recorded nothing — still Queued at production.
			const after = await workflow.fetchSubmission(submission.id);
			expect(after.stageId).toBe(STAGE_PRODUCTION);
			expect(after.status).toBe(STATUS_QUEUED);
		},
	);

	// Canonical scenario 7 (part) — the layout editor's production view. gcox
	// opens the same submission: the Production pane fully renders and they may
	// Upload production-ready files, but the Participants panel is read-only
	// (no Assign), there is NO status prompt and NO Move To Copyediting
	// decision — though they DO see the Schedule For Publication navigation
	// button, and the header drops the editor-only Activity Log (spec footnote a).
	test(
		'layout editor gets an upload-capable pane, no decisions, no status prompt',
		{tag: '@regression'},
		async ({page, pkpApi, asUser}) => {
			test.slow(); // second actor (layout editor)
			const tag = uniqueTag();
			const {submission} = await pkpApi.createSubmission(
				productionSpec({
					tag,
					title: `Layout view ${tag}`,
					participants: [
						{user: 'dbarnes', role: 'editor'},
						{user: 'gcox', role: 'layoutEditor'},
					],
				}),
			);

			const gcoxCtx = await asUser('gcox');
			const gcoxPage = await gcoxCtx.newPage();
			await gcoxPage.goto(editorialLink(submission.id), {waitUntil: 'commit'});
			const modal = activeModal(gcoxPage);
			await expect(
				modal.getByRole('heading', {name: 'Workflow: Production'}),
			).toBeVisible({timeout: 20_000});
			await expect(gcoxPage.getByText(ROLE_DENIED)).toHaveCount(0);

			// Production Ready Files renders WITH the Upload affordance.
			const grid = new FileStagePanel(gcoxPage, PANEL_PRODUCTION_READY);
			await grid.expectVisible();
			await expect(
				grid.root().getByRole('button', {name: 'Upload', exact: true}),
			).toBeVisible();

			// Participants roster renders but is read-only (no Assign).
			const participants = modal.locator('[data-cy="participant-manager"]');
			await expect(participants).toBeVisible();
			await expect(participants).toContainText(USER.gcox.name);
			await expect(
				participants.getByRole('button', {name: 'Assign', exact: true}),
			).toHaveCount(0);

			// No status prompt (editor-only), and no Move To Copyediting decision…
			await expect(modal.getByText(PROMPT_ASSIGN_PRODUCTION)).toHaveCount(0);
			await expect(modal.getByText(PROMPT_AWAITING_GALLEYS)).toHaveCount(0);
			await expect(
				modal.getByRole('button', {name: 'Move To Copyediting', exact: true}),
			).toHaveCount(0);

			// …but the Schedule For Publication navigation button IS shown.
			await expect(
				modal.getByRole('button', {
					name: 'Schedule For Publication',
					exact: true,
				}),
			).toBeVisible();

			// Header composition: Preview is offered (proves the header rendered
			// + stage access), but the editor-only Activity Log button is dropped.
			await expect(
				modal.getByRole('button', {name: 'Preview', exact: true}),
			).toBeVisible();
			await expect(
				modal.getByRole('button', {name: 'Activity Log', exact: true}),
			).toHaveCount(0);

			// Server truth: an assistant is offered NO editorial decisions.
			const gcoxView = await new EditorialWorkflowPage(gcoxPage).fetchSubmission(
				submission.id,
			);
			expect(offeredDecisionIds(gcoxView)).toEqual([]);
		},
	);

	// Canonical scenario 7 (part) — the author's discussion-only view and the
	// unassigned-assistant boundary. The author opens their own submission at
	// production on My Submissions and sees ONLY the Production Tasks &
	// Discussions panel (no production files, no participants, no action bar —
	// rule 9, which the spec author did NOT probe). An unassigned Layout Editor
	// is refused the stage entirely.
	test(
		"author sees production discussions only; an unassigned layout editor is refused",
		{tag: '@regression'},
		async ({pkpApi, asUser}) => {
			test.slow(); // two extra actors (author + unassigned layout editor)
			const tag = uniqueTag();
			const {submission} = await pkpApi.createSubmission(
				productionSpec({tag, title: `Author view ${tag}`}),
			);

			// --- Author (atester) on My Submissions: discussion-only. ---
			const authorCtx = await asUser('atester');
			const authorPage = await authorCtx.newPage();
			await authorPage.goto(mySubmissionsLink(submission.id), {
				waitUntil: 'commit',
			});
			const authorModal = activeModal(authorPage);

			// The Production Tasks & Discussions panel is shown…
			await expect(
				authorModal.locator('[data-cy="discussion-manager"]'),
			).toBeVisible({timeout: 20_000});
			await expect(
				authorModal.getByRole('heading', {
					name: 'Production Tasks & Discussions',
				}),
			).toBeVisible();

			// …and nothing else: no Production Ready Files, no participants, no
			// action bar, no status prompt.
			await expect(
				authorModal.getByRole('heading', {
					name: PANEL_PRODUCTION_READY,
					exact: true,
				}),
			).toHaveCount(0);
			await expect(
				authorModal.locator('[data-cy="participant-manager"]'),
			).toHaveCount(0);
			await expect(
				authorModal.locator('[data-cy="workflow-action-items"]'),
			).toHaveCount(0);
			await expect(
				authorModal.getByText(PROMPT_ASSIGN_PRODUCTION),
			).toHaveCount(0);

			// --- Unassigned Layout Editor (shellier): refused the stage. ---
			const shellierCtx = await asUser('shellier');
			const shellierPage = await shellierCtx.newPage();
			await shellierPage.goto(editorialLink(submission.id), {
				waitUntil: 'commit',
			});
			await expect(shellierPage.getByText(ROLE_DENIED)).toBeVisible({
				timeout: 20_000,
			});
		},
	);
});
