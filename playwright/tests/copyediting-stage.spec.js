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
 * Copyediting stage (the stage-4 workspace) — one test per canonical
 * scenario of docs/product/specs/copyediting-stage.md (7 scenarios,
 * landed as 6 tests: scenarios 5 (Send To Production) and 6 (Move to
 * Review) are MERGED into one "stage-4 exits" test, since both are
 * copyediting-stage exits whose decision MECHANICS — transitions, author
 * email, file promotion — are owned by editorial-decisions; this spec
 * asserts only that they are OFFERED and, for Send To Production, that
 * the copyedited files are its promote-files source — the one stage-4-
 * specific slice — then cancels without recording).
 *
 * THE distinctive job of this spec (per the spec's own note): the spec
 * author could NOT drive the panes in a browser (a login-autofill issue)
 * and code-verified the pane rendering. These tests are the LIVE browser
 * verification the spec asked for — every pane, affordance and status
 * prompt below is asserted against the real rendered workspace.
 *
 * Scope discipline (don't duplicate sibling coverage):
 *   - The stage-4 exits' transitions/emails/file-promotion are
 *     editorial-decisions' turf — no decision is ever recorded here (the
 *     Send To Production wizard is opened only to inspect its promote
 *     source, then cancelled).
 *   - The Participants assign/notify MECHANICS + per-stage role picker are
 *     stage-participants' turf; this spec drives an assign only to exercise
 *     the copyedit-specific "Request Copyedit" notify and the editor
 *     status-prompt flip that hangs off it.
 *   - The generic FileManager / upload wizard is submission-files' turf;
 *     this spec drives an upload only to land a file in the COPYEDITED /
 *     Draft file stages and read back the stage-4 consequences.
 *
 * Seeding note (a spec finding — see the report): the "Assign a
 * copyeditor" editor status prompt is created by the ACCEPT (and
 * SEND_TO_PRODUCTION) notification recompute only — NOT by
 * SKIP_EXTERNAL_REVIEW (PKPEditingProductionStatusNotificationManager is
 * invoked from decision/Repository.php::getSubmissionNotificationTypes,
 * which lists only ACCEPT + SEND_TO_PRODUCTION). So every status-prompt
 * test seeds copyediting via sendExternalReview → accept ("an accepted
 * manuscript", scenario 1), NOT via Accept-and-Skip-Review. A skip-review
 * submission at stage 4 shows NO status prompt (verified live, see report).
 *
 * Placement: OJS root — leans on the publicknowledge journal, the OJS
 * stage-4 pane config (workflowConfigEditorialOJS / workflowConfigAuthorOJS)
 * and the OJS decision set, though the FileManager / Discussion /
 * Participant managers and the copyedit grid handlers ship from pkp-lib.
 *
 * Parallel-safety: tags are single hyphenless alphanumeric tokens; every
 * submission is per-test and opened by the id the scenario API returns;
 * Mailpit reads are recipient+tag scoped (never clearAll).
 */

// Workflow stage / status constants (PKPApplication / PKPSubmission).
const STAGE_COPYEDITING = 4; // EDITING
const STATUS_QUEUED = 1;

// Stage-4 exit decision ids (PKP\decision\Decision::*).
const DECISION_SEND_TO_PRODUCTION = 7;
const DECISION_BACK_FROM_COPYEDITING = 30;

// The two inline status-prompt strings the workspace renders for the
// assigned editors (PKPEditingProductionStatusNotificationManager →
// notification.type.assignCopyeditors / .awaitingCopyedits).
const PROMPT_ASSIGN_COPYEDITOR =
	'Assign a copyeditor using the Assign link in the Participants list.';
const PROMPT_AWAITING_COPYEDITS = 'Awaiting Copyedits.';

// The workflow shell's refusal shown to a user with no stage-4 access.
const ROLE_DENIED =
	'The current role does not have access to this operation.';

// Seeded users (full display names + their @mailinator addresses).
const USER = {
	dbarnes: {name: 'Daniel Barnes', email: 'dbarnes@mailinator.com'},
	mfritz: {name: 'Maria Fritz', email: 'mfritz@mailinator.com'},
	atester: {name: 'Author Tester', email: 'atester@mailinator.com'},
};

/** A unique, hyphenless, alphanumeric tag (parallel isolation + mail scoping). */
function uniqueTag() {
	const workerLetter = String.fromCharCode(97 + (test.info().parallelIndex % 26));
	let suffix = '';
	while (suffix.length < 6) {
		suffix += Math.random().toString(36).replace(/[^a-z0-9]/g, '');
	}
	return `copy${workerLetter}${suffix.slice(0, 6)}`;
}

/**
 * A copyediting-stage (stage 4, Queued) submission on publicknowledge,
 * reached via sendExternalReview → accept — i.e. an *accepted* manuscript
 * (scenario 1). The ACCEPT recompute creates the "Assign a copyeditor"
 * editor status prompt (see the seeding note above). `submitted: true`
 * fires the real submit so the ART section editors are auto-assigned and
 * dbarnes is the deciding editor with manager scope; atester is the
 * author. Every seeded submission carries a real Article Text file.
 *
 * @param {{tag: string, title: string, participants?: object[]}} opts
 */
function acceptedSpec({
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

/** Stage-4 decision ids currently OFFERED to the requesting user (from the submission GET). */
function offeredDecisionIds(submission, stageId = STAGE_COPYEDITING) {
	return (submission.availableEditorialDecisions || [])
		.filter((d) => d.stageId === stageId)
		.map((d) => d.id);
}

test.use({user: 'dbarnes'}); // the deciding editor (manager scope)

test.describe('Copyediting stage — the stage-4 workspace', () => {
	// Canonical scenario 1 — an editor opens an accepted manuscript on the
	// Copyediting pane: the workspace stacks an "Assign a copyeditor" status
	// prompt, a Draft Files grid, a Copyediting Tasks & Discussions panel and
	// a Copyedited Files grid; the right rail shows a Participants list with
	// an Assign picker; the action bar offers both stage-4 exits.
	test(
		'editor opens the copyediting workspace',
		{tag: ['@smoke', '@regression']},
		async ({page, pkpApi}) => {
			const tag = uniqueTag();
			const {submission} = await pkpApi.createSubmission(
				acceptedSpec({tag, title: `Copyedit workspace ${tag}`}),
			);

			const workflow = new EditorialWorkflowPage(page);
			await workflow.goto(submission.id);
			const modal = workflow.workflowModal();

			// The stage-4 pane opened on the Copyediting stage.
			await expect(
				modal.getByRole('heading', {name: 'Workflow: Copyediting'}),
			).toBeVisible({timeout: 20_000});

			// Status prompt (WorkflowNotificationDisplay) — "Assign a copyeditor".
			await expect(modal.getByText(PROMPT_ASSIGN_COPYEDITOR)).toBeVisible({
				timeout: 20_000,
			});

			// Draft Files grid — title + description (the accepted files to copyedit).
			await expect(
				modal.getByRole('heading', {name: 'Draft Files', exact: true}),
			).toBeVisible();
			await expect(
				modal.getByText(
					'These are files from the review stage which are to be copyedited',
				),
			).toBeVisible();

			// Copyediting Tasks & Discussions panel.
			await expect(modal.locator('[data-cy="discussion-manager"]')).toBeVisible();
			await expect(
				modal.getByRole('heading', {name: 'Copyediting Tasks & Discussions'}),
			).toBeVisible();

			// Copyedited Files grid — title + description (the copyeditor's output).
			await expect(
				modal.getByRole('heading', {name: 'Copyedited Files', exact: true}),
			).toBeVisible();
			await expect(
				modal.getByText(
					'These are edited files that will be taken to the production stage',
				),
			).toBeVisible();

			// Participants list (right rail) with a Copyeditor-capable Assign picker.
			const participants = modal.locator('[data-cy="participant-manager"]');
			await expect(participants).toBeVisible();
			await expect(
				participants.getByRole('button', {name: 'Assign', exact: true}),
			).toBeVisible();

			// Action bar offers both stage-4 exits.
			const actions = workflow.actionItems();
			await expect(
				actions.getByRole('button', {name: 'Send To Production', exact: true}),
			).toBeVisible();
			await expect(
				actions.getByRole('button', {name: 'Move to Review', exact: true}),
			).toBeVisible();

			// Server truth: stage 4 / Queued, and the two exits are the offered
			// decisions (ids 7 + 30 at stage 4 — spec footnote a).
			const s = await workflow.fetchSubmission(submission.id);
			expect(s.stageId).toBe(STAGE_COPYEDITING);
			expect(s.status).toBe(STATUS_QUEUED);
			expect(offeredDecisionIds(s)).toEqual(
				expect.arrayContaining([
					DECISION_SEND_TO_PRODUCTION,
					DECISION_BACK_FROM_COPYEDITING,
				]),
			);
		},
	);

	// Canonical scenario 2 — the editor assigns a Copyeditor and notifies them
	// with the retained "Request Copyedit" template: the copyeditor receives
	// the copyedit-request email and the editor's status prompt flips from
	// "Assign a copyeditor" to "Awaiting Copyedits". (Rule 8: only the
	// non-default Request Copyedit template raises the copyedit task
	// notification + writes COPYEDIT_NOTIFY_COPYEDITOR — the email here is that
	// template's delivery.)
	test(
		'assign a copyeditor and request the copyedit',
		{tag: ['@smoke', '@regression']},
		async ({page, pkpApi, pkpMail}) => {
			const tag = uniqueTag();
			const {submission} = await pkpApi.createSubmission(
				acceptedSpec({tag, title: `Request copyedit ${tag}`}),
			);

			const workflow = new EditorialWorkflowPage(page);
			await workflow.goto(submission.id);
			const modal = workflow.workflowModal();

			// Before assigning: the editor sees "Assign a copyeditor".
			await expect(modal.getByText(PROMPT_ASSIGN_COPYEDITOR)).toBeVisible({
				timeout: 20_000,
			});

			// Assign mfritz as Copyeditor and notify with the Request Copyedit
			// template (tag woven into the message so the email is Mailpit-scopable).
			const pm = new ParticipantManagerPage(page);
			await pm.expectVisible();
			await pm.assignParticipant({
				userGroup: 'Copyeditor',
				nameSearch: 'Fritz',
				fullName: USER.mfritz.name,
				notify: {
					template: 'Request Copyedit',
					message: `<p>Please copyedit this manuscript — ${tag}</p>`,
				},
			});

			// The copyeditor received the copyedit-request email.
			const [mail] = await pkpMail.find({
				to: USER.mfritz.email,
				contains: tag,
				timeoutMs: 30_000,
			});
			expect(mail).toBeTruthy();

			// The status prompt flips: opening a copyediting discussion (the
			// notified assign) makes the manager key "awaiting copyedits".
			await workflow.goto(submission.id);
			const modalAfter = workflow.workflowModal();
			await expect(modalAfter.getByText(PROMPT_AWAITING_COPYEDITS)).toBeVisible({
				timeout: 20_000,
			});
			await expect(
				modalAfter.getByText(PROMPT_ASSIGN_COPYEDITOR),
			).toHaveCount(0);
		},
	);

	// Canonical scenario 3 — the copyedited-files exchange. The copyeditor
	// opens the Copyedited Files grid and uploads the cleaned-up manuscript;
	// once a copyedited file exists, the editor's status prompt clears (both
	// "Assign a copyeditor" and "Awaiting Copyedits" are removed by the
	// copyedit-file recompute). Also verifies the copyeditor's upload
	// permission on Copyedited Files (an assistant may upload).
	test(
		'the copyedited-files exchange clears the editor status prompt',
		{tag: '@regression'},
		async ({page, pkpApi, asUser}) => {
			test.slow(); // second actor (copyeditor) + a real upload
			const tag = uniqueTag();
			const {submission} = await pkpApi.createSubmission(
				acceptedSpec({
					tag,
					title: `Copyedit exchange ${tag}`,
					participants: [
						{user: 'dbarnes', role: 'editor'},
						{user: 'mfritz', role: 'copyeditor'},
					],
				}),
			);

			// --- Editor (dbarnes): status prompt is present before any copyedit. ---
			const workflow = new EditorialWorkflowPage(page);
			await workflow.goto(submission.id);
			await expect(
				workflow.workflowModal().getByText(PROMPT_ASSIGN_COPYEDITOR),
			).toBeVisible({timeout: 20_000});

			// --- Copyeditor (mfritz): uploads a copyedited file. ---
			const mfritzCtx = await asUser('mfritz');
			const mfritzPage = await mfritzCtx.newPage();
			await mfritzPage.goto(editorialLink(submission.id), {waitUntil: 'commit'});
			await expect(
				mfritzPage.getByRole('heading', {name: 'Workflow: Copyediting'}),
			).toBeVisible({timeout: 20_000});

			const displayName = `copyedited-${tag}.pdf`;
			const copyedited = new FileStagePanel(mfritzPage, 'Copyedited Files');
			await copyedited.expectVisible();
			await copyedited.uploadViaUploadSelect({
				selectTitle: 'Upload Review File', // COPYEDITED uploadSelectTitleKey
				wizardTitle: 'Upload Copyedited File', // AddFileLinkAction (copyedited)
				filePath: fixtureFilePath(),
				displayName,
			});

			// --- Editor (dbarnes): the prompt clears; the copyedited file shows. ---
			await workflow.goto(submission.id);
			const modalAfter = workflow.workflowModal();
			const editorCopyedited = new FileStagePanel(page, 'Copyedited Files');
			await expect(editorCopyedited.row(displayName)).toBeVisible({
				timeout: 20_000,
			});
			await expect(
				modalAfter.getByText(PROMPT_ASSIGN_COPYEDITOR),
			).toHaveCount(0);
			await expect(
				modalAfter.getByText(PROMPT_AWAITING_COPYEDITS),
			).toHaveCount(0);
		},
	);

	// Canonical scenario 4 — the author-check. The author opens their own
	// submission at copyediting on My Submissions and sees a read-mostly
	// composition: the Copyediting Discussions and the Copyedited Files grid
	// (list/download only) — no Draft Files, no participants, no action bar,
	// and files they can view/download but not upload, edit or delete.
	test(
		'the author checks the copyedited files, list-only',
		{tag: '@regression'},
		async ({page, pkpApi, asUser}) => {
			test.slow(); // editor upload + second actor (author)
			const tag = uniqueTag();
			const {submission} = await pkpApi.createSubmission(
				acceptedSpec({tag, title: `Author check ${tag}`}),
			);

			// --- Editor (dbarnes): land a copyedited file for the author to check. ---
			const workflow = new EditorialWorkflowPage(page);
			await workflow.goto(submission.id);
			await expect(
				workflow.workflowModal().getByRole('heading', {
					name: 'Workflow: Copyediting',
				}),
			).toBeVisible({timeout: 20_000});

			const displayName = `authorcheck-${tag}.pdf`;
			const editorCopyedited = new FileStagePanel(page, 'Copyedited Files');
			await editorCopyedited.expectVisible();
			await editorCopyedited.uploadViaUploadSelect({
				selectTitle: 'Upload Review File',
				wizardTitle: 'Upload Copyedited File',
				filePath: fixtureFilePath(),
				displayName,
			});

			// --- Author (atester) on My Submissions. ---
			const authorCtx = await asUser('atester');
			const authorPage = await authorCtx.newPage();
			await authorPage.goto(mySubmissionsLink(submission.id), {
				waitUntil: 'commit',
			});
			const authorModal = activeModal(authorPage);

			// Copyediting Discussions + Copyedited Files (with the file) are shown…
			await expect(
				authorModal.locator('[data-cy="discussion-manager"]'),
			).toBeVisible({timeout: 20_000});
			await expect(
				authorModal.getByRole('heading', {
					name: 'Copyediting Tasks & Discussions',
				}),
			).toBeVisible();

			const authorCopyedited = new FileStagePanel(authorPage, 'Copyedited Files');
			await authorCopyedited.expectVisible();
			// The author may view/download the copyedited file (a download link)…
			await expect(authorCopyedited.fileLink(displayName)).toBeVisible({
				timeout: 15_000,
			});
			// …but the grid is list-only: no add (Upload/Select) and no per-row
			// actions menu (no edit/delete — the More Actions dropdown only
			// renders when the role has item actions; the author has none).
			await expect(
				authorCopyedited
					.root()
					.getByRole('button', {name: 'Upload/Select Files', exact: true}),
			).toHaveCount(0);
			await expect(
				authorCopyedited
					.row(displayName)
					.getByRole('button', {name: /More Actions/i}),
			).toHaveCount(0);

			// …and the read-mostly composition: no Draft Files, no participants,
			// no action bar.
			await expect(
				authorModal.getByRole('heading', {name: 'Draft Files', exact: true}),
			).toHaveCount(0);
			await expect(
				authorModal.locator('[data-cy="participant-manager"]'),
			).toHaveCount(0);
			await expect(
				authorModal.locator('[data-cy="workflow-action-items"]'),
			).toHaveCount(0);
		},
	);

	// Canonical scenarios 5 + 6 (MERGED) — the two stage-4 exits. Both are
	// OFFERED at copyediting (Send To Production id 7, Move to Review id 30);
	// Send To Production's promote-files step draws its source from the
	// Copyedited files (the production hand-off source — spec rule 6). The
	// transitions / author emails / file promotion themselves are owned by
	// editorial-decisions, so nothing is recorded: the Send To Production
	// wizard is opened only far enough to inspect the promote source, then
	// cancelled.
	test(
		'both stage-4 exits are offered; Send To Production promotes the copyedited files',
		{tag: '@regression'},
		async ({page, pkpApi}) => {
			test.slow(); // an upload + a wizard drive
			const tag = uniqueTag();
			const {submission} = await pkpApi.createSubmission(
				acceptedSpec({tag, title: `Stage-4 exits ${tag}`}),
			);

			const workflow = new EditorialWorkflowPage(page);
			await workflow.goto(submission.id);
			await expect(
				workflow.workflowModal().getByRole('heading', {
					name: 'Workflow: Copyediting',
				}),
			).toBeVisible({timeout: 20_000});

			// Land a copyedited file — the source Send To Production promotes.
			const displayName = `handoff-${tag}.pdf`;
			const copyedited = new FileStagePanel(page, 'Copyedited Files');
			await copyedited.expectVisible();
			await copyedited.uploadViaUploadSelect({
				selectTitle: 'Upload Review File',
				wizardTitle: 'Upload Copyedited File',
				filePath: fixtureFilePath(),
				displayName,
			});

			// Both exits are offered in the action bar…
			const actions = workflow.actionItems();
			await expect(
				actions.getByRole('button', {name: 'Send To Production', exact: true}),
			).toBeVisible();
			await expect(
				actions.getByRole('button', {name: 'Move to Review', exact: true}),
			).toBeVisible();
			// …and are the offered decisions server-side (ids 7 + 30 at stage 4).
			const s = await workflow.fetchSubmission(submission.id);
			expect(offeredDecisionIds(s)).toEqual(
				expect.arrayContaining([
					DECISION_SEND_TO_PRODUCTION,
					DECISION_BACK_FROM_COPYEDITING,
				]),
			);

			// Send To Production → Notify Authors → Select Files: the promote
			// source carries the copyedited file. Then cancel — the transition
			// is editorial-decisions' turf.
			await workflow.clickDecision('Send To Production');
			await workflow.setDecisionEmailBody(
				'notifyAuthors',
				`<p>Off to production — ${tag}</p>`,
			);
			await workflow.clickContinue(); // Notify Authors → Select Files
			await expect(page.getByText('Select Files').first()).toBeVisible({
				timeout: 20_000,
			});
			// The copyedited file is offered (pre-selected) to carry forward.
			await expect(page.getByText(displayName).first()).toBeVisible({
				timeout: 15_000,
			});

			await workflow.cancelDecision();
			await expect(page).toHaveURL(
				new RegExp(`workflowSubmissionId=${submission.id}(?:&|$)`),
			);

			// No decision recorded — still at copyediting, Queued.
			const after = await workflow.fetchSubmission(submission.id);
			expect(after.stageId).toBe(STAGE_COPYEDITING);
			expect(after.status).toBe(STATUS_QUEUED);
		},
	);

	// Canonical scenario 7 — the permission boundary. An assigned copyeditor
	// opens the same submission: the Copyediting pane fully renders and they
	// get the copyedited/draft file upload affordances, but the Participants
	// panel is read-only (no Assign) and there is NO decision action bar; a
	// non-manager with no stage-4 assignment cannot open the stage at all.
	test(
		'copyeditor gets a read-only roster and no decisions; the unassigned are refused',
		{tag: '@regression'},
		async ({page, pkpApi, asUser}) => {
			test.slow(); // two extra actors
			const tag = uniqueTag();
			const {submission} = await pkpApi.createSubmission(
				acceptedSpec({
					tag,
					title: `Copyedit boundary ${tag}`,
					participants: [
						{user: 'dbarnes', role: 'editor'},
						{user: 'mfritz', role: 'copyeditor'},
					],
				}),
			);

			// --- Copyeditor (mfritz): pane renders, files writable, roster
			//     read-only, no decisions. ---
			const mfritzCtx = await asUser('mfritz');
			const mfritzPage = await mfritzCtx.newPage();
			await mfritzPage.goto(editorialLink(submission.id), {waitUntil: 'commit'});
			const mfritzModal = activeModal(mfritzPage);
			await expect(
				mfritzModal.getByRole('heading', {name: 'Workflow: Copyediting'}),
			).toBeVisible({timeout: 20_000});
			await expect(mfritzPage.getByText(ROLE_DENIED)).toHaveCount(0);

			// The copyeditor may add to BOTH file grids (Upload/Select Files).
			const mfritzDraft = new FileStagePanel(mfritzPage, 'Draft Files');
			await mfritzDraft.expectVisible();
			await expect(
				mfritzDraft
					.root()
					.getByRole('button', {name: 'Upload/Select Files', exact: true}),
			).toBeVisible();
			const mfritzCopyedited = new FileStagePanel(mfritzPage, 'Copyedited Files');
			await mfritzCopyedited.expectVisible();
			await expect(
				mfritzCopyedited
					.root()
					.getByRole('button', {name: 'Upload/Select Files', exact: true}),
			).toBeVisible();

			// The Participants roster renders but is read-only (no Assign)…
			const mfritzParticipants = mfritzModal.locator(
				'[data-cy="participant-manager"]',
			);
			await expect(mfritzParticipants).toBeVisible();
			await expect(mfritzParticipants).toContainText(USER.mfritz.name);
			await expect(
				mfritzParticipants.getByRole('button', {name: 'Assign', exact: true}),
			).toHaveCount(0);

			// …and there is NO decision action bar (no stage-4 exits offered).
			await expect(
				mfritzModal.getByRole('button', {
					name: 'Send To Production',
					exact: true,
				}),
			).toHaveCount(0);
			await expect(
				mfritzModal.getByRole('button', {name: 'Move to Review', exact: true}),
			).toHaveCount(0);
			// Server truth: an assistant is offered NO editorial decisions.
			const mfritzView = await new EditorialWorkflowPage(mfritzPage).fetchSubmission(
				submission.id,
			);
			expect(offeredDecisionIds(mfritzView)).toEqual([]);

			// --- Unassigned copyeditor (svogt): refused the stage entirely. ---
			const svogtCtx = await asUser('svogt');
			const svogtPage = await svogtCtx.newPage();
			await svogtPage.goto(editorialLink(submission.id), {waitUntil: 'commit'});
			await expect(svogtPage.getByText(ROLE_DENIED)).toBeVisible({
				timeout: 20_000,
			});
		},
	);
});
