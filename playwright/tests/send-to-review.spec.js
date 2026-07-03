// @ts-check
const {test, expect} = require('../support/fixtures.js');
const {EditorialWorkflowPage} = require('../pages/EditorialWorkflowPage.js');

/**
 * Send to review — the Submission-stage (stage 1) WORKSPACE. One test per
 * canonical scenario of docs/product/specs/send-to-review.md (7 scenarios,
 * landed as 6 tests: scenarios 2 (send to review) and 3 (accept and skip)
 * are MERGED into a single "review exits" workspace-actions test, since
 * both are stage-1 exits whose decision MECHANICS — transitions, author
 * email, round creation — are already exhaustively covered by
 * editorial-decisions.spec.js).
 *
 * Scope discipline (avoid duplicating editorial-decisions coverage):
 *   - This spec owns the stage-1 WORKSPACE UX, not the decision engine.
 *     It asserts what panels/files/actions the editor sees at stage 1
 *     BEFORE deciding (incoming files + genres, Desk Review Discussions,
 *     Participants, the "before any reviewer" blank status), the file
 *     affordance matrix, the author's read-mostly view, and — for the
 *     three exits — the stage-1 pre-state + that the action is OFFERED.
 *   - NO decision is ever recorded here. Where a scenario is about an
 *     exit, the transition is either left un-driven (Send for Review is
 *     opened only to inspect its promote-files source, then cancelled) or
 *     SEEDED via the scenario API (the declined state in scenario 4),
 *     never driven through the Record Decision wizard — that machinery is
 *     editorial-decisions' turf.
 *   - The one stage-1-specific slice of Send for Review this spec DOES
 *     assert is the promote-files SOURCE list (spec rule 5): the Select
 *     Files step draws from the arrival Submission Files.
 *
 * Placement: OJS root — leans on the publicknowledge journal, the OJS
 * stage-1 pane config (workflowConfigEditorialOJS / workflowConfigAuthorOJS)
 * and the OJS decision set, even though the FileManager/Discussion/
 * Participant managers ship from pkp-lib.
 *
 * Parallel-safety: tags are single hyphenless alphanumeric tokens; every
 * submission is per-test and opened by the id the scenario API returns;
 * read-only workspace — no Mailpit use.
 */

// Workflow stage / status constants (PKPApplication / PKPSubmission).
const STAGE_SUBMISSION = 1;
const STATUS_QUEUED = 1;
const STATUS_DECLINED = 4;

/** A unique, hyphenless, alphanumeric tag (parallel isolation). */
function uniqueTag() {
	const workerLetter = String.fromCharCode(97 + (test.info().parallelIndex % 26));
	let suffix = '';
	while (suffix.length < 6) {
		suffix += Math.random().toString(36).replace(/[^a-z0-9]/g, '');
	}
	return `str${workerLetter}${suffix.slice(0, 6)}`;
}

/**
 * A submitted, stage-1 (Queued) submission on publicknowledge. `submitted:
 * true` fires the real submit, so the submission is complete for the
 * decision gate and the section's editors are auto-assigned; atester is the
 * author, dbarnes (seeded as the `editor` group = ROLE_ID_MANAGER) the
 * deciding editor with manager scope. Every seeded submission carries a
 * real Article Text file (default-article.pdf) out of the box.
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

/** The author's My-Submissions deep link that mounts the workflow modal. */
function mySubmissionsLink(submissionId) {
	return `/index.php/publicknowledge/en/dashboard/mySubmissions?workflowSubmissionId=${submissionId}`;
}

/** The workflow side modal (outer wrapper reports visibility:hidden — scope only). */
function activeModal(page) {
	return page.locator('[data-cy="active-modal"]').first();
}

test.use({user: 'dbarnes'}); // the deciding editor (manager scope)

test.describe('Send to review — the stage-1 workspace', () => {
	// Canonical scenario 1 — an editor opens a freshly-submitted manuscript
	// on the Submission pane: the workspace shows the incoming Submission
	// Files ("Files uploaded at the time of submission", with genres), the
	// Desk Review Tasks & Discussions panel and the Participants list, a
	// blank status area (no reviewers yet), and an action bar offering the
	// three stage-1 exits plus a Schedule For Publication shortcut.
	test(
		'editor triages an incoming submission',
		{tag: ['@smoke', '@regression']},
		async ({page, pkpApi}) => {
			const tag = uniqueTag();
			const {submission} = await pkpApi.createSubmission(
				submittedSpec({tag, title: `Triage ${tag}`}),
			);

			const workflow = new EditorialWorkflowPage(page);
			await workflow.goto(submission.id);
			const modal = workflow.workflowModal();

			// The stage-1 pane opened on the Submission stage.
			await expect(
				modal.getByRole('heading', {name: 'Workflow: Submission'}),
			).toBeVisible({timeout: 20_000});

			// Incoming Submission Files grid: title, description, and the
			// arrival file carrying its genre in the Type column.
			await expect(
				modal.getByRole('heading', {name: 'Submission Files', exact: true}),
			).toBeVisible();
			await expect(
				modal.getByText('Files uploaded at the time of submission'),
			).toBeVisible();
			const fileRow = modal
				.getByRole('row')
				.filter({hasText: 'default-article.pdf'});
			await expect(fileRow).toBeVisible();
			await expect(fileRow.getByText('Article Text')).toBeVisible();

			// Desk Review Tasks & Discussions panel.
			await expect(
				modal.locator('[data-cy="discussion-manager"]'),
			).toBeVisible();
			await expect(
				modal.getByRole('heading', {name: 'Desk Review Tasks & Discussions'}),
			).toBeVisible();

			// Participants list (right rail / secondary column).
			await expect(
				modal.locator('[data-cy="participant-manager"]'),
			).toBeVisible();

			// "Before any reviewer" — no review round, no reviewer panel yet.
			await expect(
				modal.locator(
					'[data-cy="workflow-primary-items"] [data-cy="reviewer-manager"]',
				),
			).toHaveCount(0);

			// The action bar offers the three exits + the Schedule shortcut,
			// and NOT the post-decline Revert/Delete (submission is Queued).
			const actions = workflow.actionItems();
			await expect(
				actions.getByRole('button', {
					name: 'Schedule For Publication',
					exact: true,
				}),
			).toBeVisible();
			await expect(
				actions.getByRole('button', {name: 'Send for Review', exact: true}),
			).toBeVisible();
			await expect(
				actions.getByRole('button', {
					name: 'Accept and Skip Review',
					exact: true,
				}),
			).toBeVisible();
			await expect(
				actions.getByRole('button', {name: 'Decline Submission', exact: true}),
			).toBeVisible();
			await expect(
				actions.getByRole('button', {name: 'Revert Decline', exact: true}),
			).toHaveCount(0);
			await expect(
				actions.getByRole('button', {name: 'Delete', exact: true}),
			).toHaveCount(0);

			// The workspace pre-state, read back through the API.
			const s = await workflow.fetchSubmission(submission.id);
			expect(s.stageId).toBe(STAGE_SUBMISSION);
			expect(s.status).toBe(STATUS_QUEUED);
		},
	);

	// Canonical scenarios 2 + 3 (MERGED) — the two review exits are OFFERED
	// at stage 1, and Send for Review's Select Files step draws its
	// promote-files source from the arrival Submission Files (spec rule 5).
	// The exits' transitions/emails/rounds are editorial-decisions' turf, so
	// nothing is recorded here: the Send-for-Review wizard is opened only far
	// enough to inspect the promote list, then cancelled.
	test(
		'the review exits are offered and Send for Review promotes the arrival files',
		{tag: ['@smoke', '@regression']},
		async ({page, pkpApi}) => {
			const tag = uniqueTag();
			const {submission} = await pkpApi.createSubmission(
				submittedSpec({tag, title: `Send ${tag}`}),
			);

			const workflow = new EditorialWorkflowPage(page);
			await workflow.goto(submission.id);
			const actions = workflow.actionItems();

			// Both review exits are offered while Queued at stage 1.
			await expect(
				actions.getByRole('button', {name: 'Send for Review', exact: true}),
			).toBeVisible({timeout: 20_000});
			await expect(
				actions.getByRole('button', {
					name: 'Accept and Skip Review',
					exact: true,
				}),
			).toBeVisible();

			// Send for Review → its Select Files step promotes from the
			// stage-1 Submission Files: the arrival file is offered to carry
			// forward into review as a review file.
			await workflow.clickDecision('Send for Review');
			await workflow.setDecisionEmailBody(
				'notifyAuthors',
				`<p>Off to review — ${tag}</p>`,
			);
			await workflow.clickContinue(); // Notify Authors → Select Files
			await expect(page.getByText('Select Files').first()).toBeVisible({
				timeout: 20_000,
			});
			// The promote list is labelled "Submission Files" and carries the
			// arrival file.
			await expect(page.getByText('Submission Files').first()).toBeVisible();
			await expect(
				page.getByText('default-article.pdf').first(),
			).toBeVisible();

			// Do NOT record — leave the transition to editorial-decisions.
			await workflow.cancelDecision();
			await expect(page).toHaveURL(
				new RegExp(`workflowSubmissionId=${submission.id}(?:&|$)`),
			);
		},
	);

	// Canonical scenario 4 — a desk-declined submission: the bar swaps to
	// Revert Decline, and a hard Delete appears only for a manager/admin.
	// The Initial Decline is SEEDED via the scenario API (its transition is
	// editorial-decisions' turf); this test owns the resulting stage-1
	// action-bar composition and the Delete-gating rule (spec rules 7–8):
	// dbarnes (manager scope) sees Delete, dbuskins (section editor,
	// non-manager) does not — though both may Revert.
	test(
		'desk-decline swaps the bar and gates Delete behind decline + manager role',
		{tag: '@regression'},
		async ({page, pkpApi, asUser}) => {
			test.slow(); // second actor (section editor)
			const tag = uniqueTag();
			const {submission} = await pkpApi.createSubmission({
				...submittedSpec({
					tag,
					title: `Declined ${tag}`,
					participants: [
						{user: 'dbarnes', role: 'editor'}, // ROLE_ID_MANAGER
						{user: 'dbuskins', role: 'sectionEditor'}, // ROLE_ID_SUB_EDITOR
					],
				}),
				decisions: [{type: 'initialDecline', by: 'dbarnes'}],
			});

			const workflow = new EditorialWorkflowPage(page);

			// Seeded state: Declined, still at stage 1 (no stage change).
			const s = await workflow.fetchSubmission(submission.id);
			expect(s.status).toBe(STATUS_DECLINED);
			expect(s.stageId).toBe(STAGE_SUBMISSION);

			// Manager (dbarnes): Decline is gone; Revert Decline + a hard
			// Delete are offered.
			await workflow.goto(submission.id);
			const managerActions = workflow.actionItems();
			await expect(
				managerActions.getByRole('button', {
					name: 'Revert Decline',
					exact: true,
				}),
			).toBeVisible({timeout: 20_000});
			await expect(
				managerActions.getByRole('button', {name: 'Delete', exact: true}),
			).toBeVisible();
			await expect(
				managerActions.getByRole('button', {
					name: 'Decline Submission',
					exact: true,
				}),
			).toHaveCount(0);
			await expect(
				managerActions.getByRole('button', {
					name: 'Send for Review',
					exact: true,
				}),
			).toHaveCount(0);

			// Section editor (dbuskins, non-manager): Revert Decline is
			// offered, but the hard Delete is withheld.
			const subCtx = await asUser('dbuskins');
			const subPage = await subCtx.newPage();
			const subWorkflow = new EditorialWorkflowPage(subPage);
			await subWorkflow.goto(submission.id);
			const subActions = subWorkflow.actionItems();
			await expect(
				subActions.getByRole('button', {name: 'Revert Decline', exact: true}),
			).toBeVisible({timeout: 20_000});
			await expect(
				subActions.getByRole('button', {name: 'Delete', exact: true}),
			).toHaveCount(0);
		},
	);

	// Canonical scenario 5 — the incoming-files affordance matrix. An editor
	// may add (Upload), download all, and per-file edit / view notes /
	// delete; the author on the same submission may only download all and
	// edit an existing file's metadata — never upload or delete (spec Actors
	// table, footnote c). No file is actually uploaded/deleted here (the grid
	// mechanics are submission-files' turf) — only which actions are OFFERED.
	test(
		'editor may add and delete incoming files; the author may only edit and download',
		{tag: '@regression'},
		async ({page, pkpApi, asUser}) => {
			test.slow(); // second actor (author)
			const tag = uniqueTag();
			const {submission} = await pkpApi.createSubmission(
				submittedSpec({tag, title: `Files ${tag}`}),
			);

			// --- Editor (dbarnes) ---
			const workflow = new EditorialWorkflowPage(page);
			await workflow.goto(submission.id);
			const modal = workflow.workflowModal();
			await expect(
				modal.getByRole('heading', {name: 'Submission Files', exact: true}),
			).toBeVisible({timeout: 20_000});

			// Add-files (Upload) + Download All affordances present.
			await expect(
				modal.getByRole('button', {name: 'Upload', exact: true}),
			).toBeVisible();
			await expect(
				modal.getByRole('button', {name: 'Download All Files', exact: true}),
			).toBeVisible();

			// Per-file menu: editor may Update, view notes, and Delete.
			await modal
				.getByRole('row')
				.filter({hasText: 'default-article.pdf'})
				.getByRole('button', {name: 'More Actions'})
				.click();
			await expect(
				page.getByRole('menuitem', {name: 'Update File Details', exact: true}),
			).toBeVisible({timeout: 10_000});
			await expect(
				page.getByRole('menuitem', {name: 'More Information', exact: true}),
			).toBeVisible();
			await expect(
				page.getByRole('menuitem', {name: 'Delete', exact: true}),
			).toBeVisible();

			// --- Author (atester) on My Submissions ---
			const authorCtx = await asUser('atester');
			const authorPage = await authorCtx.newPage();
			await authorPage.goto(mySubmissionsLink(submission.id), {
				waitUntil: 'commit',
			});
			const authorModal = activeModal(authorPage);
			await expect(
				authorModal.getByRole('heading', {
					name: 'Submission Files',
					exact: true,
				}),
			).toBeVisible({timeout: 20_000});

			// The author may download all but cannot add files.
			await expect(
				authorModal.getByRole('button', {
					name: 'Download All Files',
					exact: true,
				}),
			).toBeVisible();
			await expect(
				authorModal.getByRole('button', {name: 'Upload', exact: true}),
			).toHaveCount(0);

			// Per-file menu: Update only — no Delete.
			await authorModal
				.getByRole('row')
				.filter({hasText: 'default-article.pdf'})
				.getByRole('button', {name: 'More Actions'})
				.click();
			await expect(
				authorPage.getByRole('menuitem', {
					name: 'Update File Details',
					exact: true,
				}),
			).toBeVisible({timeout: 10_000});
			await expect(
				authorPage.getByRole('menuitem', {name: 'Delete', exact: true}),
			).toHaveCount(0);
		},
	);

	// Canonical scenario 6 — the author opens their own just-submitted
	// manuscript on My Submissions and sees the same Submission Files +
	// Desk Review Discussions, read-mostly: no participant list, no decision
	// action bar, no Schedule shortcut (author variant — workflowConfigAuthorOJS).
	test(
		"author's stage-1 view is read-mostly on My Submissions",
		{tag: '@regression'},
		async ({pkpApi, asUser}) => {
			const tag = uniqueTag();
			const {submission} = await pkpApi.createSubmission(
				submittedSpec({tag, title: `Author view ${tag}`}),
			);

			const authorCtx = await asUser('atester');
			const authorPage = await authorCtx.newPage();
			await authorPage.goto(mySubmissionsLink(submission.id), {
				waitUntil: 'commit',
			});
			const modal = activeModal(authorPage);

			// Same Submission Files + Desk Review Discussions the editor sees…
			await expect(
				modal.getByRole('heading', {name: 'Submission Files', exact: true}),
			).toBeVisible({timeout: 20_000});
			await expect(modal.getByText('default-article.pdf')).toBeVisible();
			await expect(
				modal.locator('[data-cy="discussion-manager"]'),
			).toBeVisible();

			// …but read-mostly: no participants list, no action bar, no
			// decision buttons, no Schedule shortcut.
			await expect(
				modal.locator('[data-cy="participant-manager"]'),
			).toHaveCount(0);
			await expect(
				modal.locator('[data-cy="workflow-action-items"]'),
			).toHaveCount(0);
			await expect(
				modal.getByRole('button', {name: 'Send for Review', exact: true}),
			).toHaveCount(0);
			await expect(
				modal.getByRole('button', {
					name: 'Schedule For Publication',
					exact: true,
				}),
			).toHaveCount(0);
		},
	);

	// Canonical scenario 7 — instead of sending to review, the editor clicks
	// Schedule For Publication, which navigates the workflow menu straight to
	// Publication → Title & Abstract (recording no review decision).
	test(
		'Schedule For Publication jumps to the publication tab without deciding',
		{tag: '@regression'},
		async ({page, pkpApi}) => {
			const tag = uniqueTag();
			const seeded = await pkpApi.createSubmission(
				submittedSpec({tag, title: `Schedule ${tag}`}),
			);
			const submission = seeded.submission;
			const publicationId = seeded.publications[0].id;

			const workflow = new EditorialWorkflowPage(page);
			await workflow.goto(submission.id);

			await workflow
				.actionItems()
				.getByRole('button', {name: 'Schedule For Publication', exact: true})
				.click();

			// The menu jumped to Publication → Title & Abstract; the URL
			// records the pane key and the pane heading changes.
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

			// It recorded no review decision — still Queued at stage 1.
			const s = await workflow.fetchSubmission(submission.id);
			expect(s.stageId).toBe(STAGE_SUBMISSION);
			expect(s.status).toBe(STATUS_QUEUED);
		},
	);
});
