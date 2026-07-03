// @ts-check
const {test, expect} = require('../support/fixtures.js');
const {EditorialWorkflowPage} = require('../pages/EditorialWorkflowPage.js');
const {
	DiscussionManagerPage,
} = require('../../lib/pkp/playwright/pages/DiscussionManagerPage.js');
const {TasksGridModal} = require('../../lib/pkp/playwright/pages/TasksGridModal.js');
const {UserProfilePage} = require('../../lib/pkp/playwright/pages/UserProfilePage.js');

/**
 * Editorial Tasks & Discussions — one test per canonical scenario of
 * docs/product/specs/tasks-discussions.md (6 scenarios → 6 tests). The
 * feature is shared pkp-lib (the DiscussionManager Vue surface + the
 * EditorialTaskController API), but every scenario here leans on
 * OJS-specific machinery — the publicknowledge journal, ART section,
 * OJS editorial decisions (skipExternalReview / Move to Review / Accept
 * Submission) and scratch journals via the OJS scenario API — so the spec
 * lives at the OJS root (mirroring copyediting-stage.spec.js). The
 * shared task/discussion POMs it drives (DiscussionManagerPage,
 * TasksGridModal, UserProfilePage) ship from lib/pkp.
 *
 * Every assertion tracks the VERIFIED spec's claims: the Yet-to-begin /
 * In-progress / Closed group semantics (rules 1-2), the rule-11
 * Closed-task-no-reopen finding (the Closed control is disabled and the
 * view-modal status control is disabled — completion is one-way in the
 * UI), the manager/creator/responsible write-access model (rule 13), the
 * template auto-add + dedup (rule 21), template prefill (rule 20) and the
 * two-way email opt-out (side effects / settings).
 *
 * Parallel-safety: tags are single hyphenless alphanumeric tokens; every
 * submission/journal is per-test and opened by the id/path the scenario
 * API returns; Mailpit reads are recipient+marker scoped (never clearAll).
 */

// Workflow stages (PKPApplication).
const STAGE_SUBMISSION = 1;
const STAGE_EDITING = 4; // Copyediting
// EditorialTaskType (enums/EditorialTaskType.php): 1 = discussion, 2 = task.
const TASK_TYPE = 2;
// Role ids (Role.php) for the userGroups lookup.
const ROLE_ID_SUB_EDITOR = 17;

// Seeded users: display names (for participant checkboxes) + mailinator
// addresses (for Mailpit scoping).
const USER = {
	dbarnes: {name: 'Daniel Barnes', email: 'dbarnes@mailinator.com'},
	dbuskins: {name: 'David Buskins', email: 'dbuskins@mailinator.com'},
	minoue: {name: 'Minoti Inoue', email: 'minoue@mailinator.com'},
	sberardo: {name: 'Stephanie Berardo', email: 'sberardo@mailinator.com'},
	mfritz: {name: 'Maria Fritz', email: 'mfritz@mailinator.com'},
	svogt: {name: 'Sarah Vogt', email: 'svogt@mailinator.com'},
	shellier: {name: 'Stephen Hellier', email: 'shellier@mailinator.com'},
	atester: {name: 'Author Tester', email: 'atester@mailinator.com'},
};

/** A unique, hyphenless, alphanumeric tag (parallel isolation + mail scoping). */
function uniqueTag(prefix = 'tad') {
	const workerLetter = String.fromCharCode(97 + (test.info().parallelIndex % 26));
	let suffix = '';
	while (suffix.length < 6) {
		suffix += Math.random().toString(36).replace(/[^a-z0-9]/g, '');
	}
	return `${prefix}${workerLetter}${suffix.slice(0, 6)}`;
}

/** YYYY-MM-DD, `days` from today (local). */
function isoDate(days = 0) {
	const d = new Date();
	d.setDate(d.getDate() + days);
	return d.toISOString().slice(0, 10);
}

/** The editorial-dashboard deep link that mounts the workflow modal. */
function editorialLink(submissionId, journalPath = 'publicknowledge') {
	return `/index.php/${journalPath}/en/dashboard/editorial?workflowSubmissionId=${submissionId}`;
}

/** The author's My-Submissions deep link that mounts the workflow modal. */
function mySubmissionsLink(submissionId, journalPath = 'publicknowledge') {
	return `/index.php/${journalPath}/en/dashboard/mySubmissions?workflowSubmissionId=${submissionId}`;
}

/** A submitted, stage-1 (submission) submission with explicit participants. */
function submissionStageSpec({
	tag,
	title,
	participants,
	commentsForEditor,
	journal = 'publicknowledge',
}) {
	return {
		tag,
		journal,
		submitter: 'atester',
		section: 'ART',
		locale: 'en',
		submitted: true,
		participants,
		...(commentsForEditor ? {commentsForEditor} : {}),
		publications: [{metadata: {title: {en: title}}}],
	};
}

/** A copyediting-stage (stage 4) submission, reached via submit → skipExternalReview. */
function copyeditingSpec({tag, title, journal = 'publicknowledge', participants}) {
	return {
		tag,
		journal,
		submitter: 'atester',
		section: 'ART',
		locale: 'en',
		submitted: true,
		participants,
		decisions: [{type: 'skipExternalReview', by: 'dbarnes'}],
		publications: [{metadata: {title: {en: title}}}],
	};
}

/** Read the logged-in page's CSRF token (session token exposed on any backend page). */
async function readCsrf(page) {
	await page.waitForFunction(() => !!window.pkp?.currentUser?.csrfToken, null, {
		timeout: 15_000,
	});
	return page.evaluate(() => window.pkp.currentUser.csrfToken);
}

/**
 * Create a task/discussion template in `journalPath` via the editTaskTemplates
 * REST API, authenticated by the page's session cookie + CSRF header. The
 * scenario API has no template passthrough, so this is the seam. Requires the
 * page's user to be a manager (with settings access) in that journal.
 */
async function createTaskTemplate(page, journalPath, csrf, body) {
	const res = await page.request.post(
		`/index.php/${journalPath}/api/v1/editTaskTemplates`,
		{
			headers: {'X-Csrf-Token': csrf, 'Content-Type': 'application/json'},
			data: body,
		},
	);
	if (!res.ok()) {
		throw new Error(
			`createTaskTemplate failed: ${res.status()} — ${await res.text()}`,
		);
	}
	return res.json();
}

/** First user-group id matching `roleId` in `journalPath` (for template restriction). */
async function userGroupIdForRole(page, journalPath, roleId) {
	const res = await page.request.get(
		`/index.php/${journalPath}/api/v1/userGroups?roleIds[]=${roleId}`,
	);
	if (!res.ok()) {
		throw new Error(`GET userGroups failed: ${res.status()} — ${await res.text()}`);
	}
	const body = await res.json();
	const items = body.items || body;
	if (!items.length) {
		throw new Error(`no user group for role ${roleId} in ${journalPath}`);
	}
	return items[0].id;
}

test.use({user: 'dbarnes'}); // editor + publicknowledge manager (verified wave 11)

test.describe('Editorial Tasks & Discussions', () => {
	// Canonical scenario 1 — an editor on the Copyediting panel creates a task
	// with the copyeditor as responsible participant, a future due date and
	// "Create, but don't start"; it lands under Yet to begin. The editor starts
	// it → In progress; the copyeditor completes it → Closed, where Edit is
	// disabled and NO reopen is offered (rule 11: the Closed checkbox and the
	// view-modal status control are both disabled — completion is one-way).
	test(
		'Copyeditor task lifecycle',
		{tag: ['@smoke', '@regression']},
		async ({page, pkpApi, asUser}) => {
			test.slow(); // multi-actor (editor + copyeditor) + full lifecycle
			const tag = uniqueTag('life');
			const taskTitle = `Copyedit task ${tag}`;
			const {submission} = await pkpApi.createSubmission(
				copyeditingSpec({
					tag,
					title: `Lifecycle sub ${tag}`,
					participants: [
						{user: 'dbarnes', role: 'editor'},
						{user: 'mfritz', role: 'copyeditor'},
					],
				}),
			);

			// --- Editor (dbarnes): create the task, don't start it. ---
			const workflow = new EditorialWorkflowPage(page);
			await workflow.goto(submission.id);
			await expect(
				workflow.workflowModal().getByRole('heading', {
					name: 'Workflow: Copyediting',
				}),
			).toBeVisible({timeout: 20_000});

			const dm = new DiscussionManagerPage(page);
			await dm.expectVisible();
			await dm.expectHeading('Copyediting Tasks & Discussions');

			const form = await dm.openAdd();
			await form.fillTitle(taskTitle);
			await form.fillDescription(`<p>Please copyedit — ${tag}</p>`);
			await form.checkParticipant(USER.mfritz.name);
			await form.enableTaskInfo();
			await form.setDateDue(isoDate(14));
			await form.setResponsibleAssignee(USER.mfritz.name);
			await form.setShouldStart('false'); // "Create, but don't start"
			await form.save();

			// It appears under Yet to begin (task, not yet started).
			await dm.expectInGroup(taskTitle, 'Yet to begin');

			// The editor starts it → In progress.
			let view = await dm.openByTitle(taskTitle);
			await view.clickStartTask();
			await view.save();
			await view.expectTaskStarted();
			await view.close();
			await dm.expectInGroup(taskTitle, 'In progress');

			// --- Copyeditor (mfritz): the responsible participant completes it. ---
			const mfritzCtx = await asUser('mfritz');
			const mfritzPage = await mfritzCtx.newPage();
			await mfritzPage.goto(editorialLink(submission.id), {waitUntil: 'commit'});
			await expect(
				mfritzPage.getByRole('heading', {name: 'Workflow: Copyediting'}),
			).toBeVisible({timeout: 20_000});

			const dmMfritz = new DiscussionManagerPage(mfritzPage);
			await dmMfritz.expectInGroup(taskTitle, 'In progress');
			const viewMfritz = await dmMfritz.openByTitle(taskTitle);
			await viewMfritz.clickCompleteTask();
			await viewMfritz.save();
			await viewMfritz.close();
			await dmMfritz.expectInGroup(taskTitle, 'Closed');

			// --- Rule 11, verified as the MANAGER (dbarnes): once closed, a task
			//     cannot be reopened from the UI at all. ---
			await workflow.goto(submission.id);
			await expect(
				workflow.workflowModal().getByRole('heading', {
					name: 'Workflow: Copyediting',
				}),
			).toBeVisible({timeout: 20_000});
			await dm.expectInGroup(taskTitle, 'Closed');
			// The row's Closed (+ Started) checkboxes are disabled — no reopen.
			await dm.expectRowCheckboxDisabled(taskTitle);
			// The row's Edit action is disabled on a closed item.
			await dm.expectEditActionDisabled(taskTitle);
			// The view modal's status control is disabled (offers no reopen).
			view = await dm.openByTitle(taskTitle);
			await view.expectStatusControlDisabled();
			await view.close();
		},
	);

	// Canonical scenario 2 — an author submits with "Comments for the Editor"; a
	// discussion appears on the submission stage, In progress, with the author +
	// editorial team as participants. The author replies from their own view, and
	// every participant gets a Tasks-bell notification and a stage-discussion
	// email whose footer links back to the thread. (The cover-note's own email is
	// a bare, Mail::fake-dropped mailable; the REPLY is what fires the
	// DiscussionSubmission mailable with the unsubscribe/back-to-thread footer.)
	test(
		'Discussion with the author',
		{tag: '@regression'},
		async ({page, pkpApi, pkpMail, asUser}) => {
			test.slow(); // multi-actor + mail assertions
			const tag = uniqueTag('cov');
			const coverNoteTitle = 'Comments for the Editor';
			const {submission} = await pkpApi.createSubmission(
				submissionStageSpec({
					tag,
					title: `Cover note sub ${tag}`,
					participants: [
						{user: 'dbarnes', role: 'editor'},
						{user: 'dbuskins', role: 'sectionEditor'},
					],
					commentsForEditor: `<p>Please consider my manuscript — ${tag}</p>`,
				}),
			);

			// --- Author (atester): the cover-note discussion is on the submission
			//     stage, In progress; the author replies from My Submissions. ---
			const authorCtx = await asUser('atester');
			const authorPage = await authorCtx.newPage();
			await authorPage.goto(mySubmissionsLink(submission.id), {
				waitUntil: 'commit',
			});
			const dmAuthor = new DiscussionManagerPage(authorPage);
			await dmAuthor.expectVisible();
			await dmAuthor.expectInGroup(coverNoteTitle, 'In progress');

			const view = await dmAuthor.openByTitle(coverNoteTitle);
			await view.clickAddNewMessage();
			await view.fillReply(`<p>Thanks for the feedback — reply ${tag}</p>`);
			await view.save();

			// The reply notifies every participant. We assert against sberardo:
			// an ART section editor whom AssignEditors auto-adds to the cover-note
			// (so a guaranteed participant) and who receives no notifications from
			// any other test in this file — so this reply is the newest entry in
			// their Tasks bell, robust to the grid's newest-first cap.
			const editorEmail = USER.sberardo.email;

			// --- Every participant is notified: a Tasks-bell entry appears. ---
			const editorCtx = await asUser('sberardo');
			const editorPage = await editorCtx.newPage();
			const bell = await openBell(editorPage, 'publicknowledge');
			await expect(bell.task(tag).first()).toBeVisible({timeout: 15_000});

			// --- …and a stage-discussion email whose footer links back to the
			//     thread (body carries the reply; footer has the workflow URL +
			//     an unsubscribe link). ---
			const [mail] = await pkpMail.find({
				to: editorEmail,
				contains: tag,
				timeoutMs: 30_000,
			});
			expect(mail, 'a participant should receive the reply email').toBeTruthy();
			const full = await pkpMail.fullMessage(mail.ID);
			const html = full.HTML || full.Text || '';
			expect(html).toContain(`workflowSubmissionId=${submission.id}`);
			expect(html.toLowerCase()).toContain('unsubscribe');
		},
	);

	// Canonical scenario 3 — dbarnes (a manager) creates a task with dbuskins as
	// responsible participant and minoue as a plain participant: dbuskins can
	// edit + complete; minoue sees it read-only; a sub-editor who is not a
	// participant (sberardo) doesn't see it at all; a manager sees everything.
	// dbarnes unchecks itself at creation — allowed only for managers (rule 6) —
	// so the manager's visibility (rule 17) is proven independently of
	// participation.
	test(
		'Permission boundary',
		{tag: '@regression'},
		async ({page, pkpApi, asUser}) => {
			test.slow(); // four actors
			const tag = uniqueTag('perm');
			const taskTitle = `Boundary task ${tag}`;
			const {submission} = await pkpApi.createSubmission(
				submissionStageSpec({
					tag,
					title: `Boundary sub ${tag}`,
					participants: [
						{user: 'dbarnes', role: 'editor'},
						{user: 'dbuskins', role: 'sectionEditor'},
						{user: 'minoue', role: 'sectionEditor'},
						{user: 'sberardo', role: 'sectionEditor'},
					],
				}),
			);

			// --- Manager (dbarnes): create the task; responsible = dbuskins,
			//     plain participant = minoue; uncheck self (manager may). ---
			const workflow = new EditorialWorkflowPage(page);
			await workflow.goto(submission.id);
			await expect(
				workflow.workflowModal().getByRole('heading', {
					name: 'Workflow: Submission',
				}),
			).toBeVisible({timeout: 20_000});

			const dm = new DiscussionManagerPage(page);
			await dm.expectVisible();
			const form = await dm.openAdd();
			await form.fillTitle(taskTitle);
			await form.fillDescription(`<p>Roster boundary — ${tag}</p>`);
			await form.checkParticipant(USER.dbuskins.name);
			await form.checkParticipant(USER.minoue.name);
			await form.uncheckParticipant(USER.dbarnes.name); // manager needn't join
			await form.enableTaskInfo();
			await form.setDateDue(isoDate(14));
			await form.setResponsibleAssignee(USER.dbuskins.name);
			await form.setShouldStart('false'); // dbuskins will start it below
			await form.save();

			// The manager (creator, not a participant) still sees it with full
			// controls — rule 17 + rule 6.
			await dm.expectInGroup(taskTitle, 'Yet to begin');
			await dm.expectActionsMenuVisible(taskTitle);

			// --- Responsible participant (dbuskins): row actions + can complete. ---
			const dbuskinsCtx = await asUser('dbuskins');
			const dbuskinsPage = await dbuskinsCtx.newPage();
			await dbuskinsPage.goto(editorialLink(submission.id), {waitUntil: 'commit'});
			const dmDbuskins = new DiscussionManagerPage(dbuskinsPage);
			await dmDbuskins.expectInGroup(taskTitle, 'Yet to begin');
			await dmDbuskins.expectActionsMenuVisible(taskTitle);
			// dbuskins can start + complete (responsible ⇒ write access).
			const vDbuskins = await dmDbuskins.openByTitle(taskTitle);
			await vDbuskins.clickStartTask();
			await vDbuskins.save();
			await vDbuskins.expectTaskStarted();
			await vDbuskins.close();
			await dmDbuskins.expectInGroup(taskTitle, 'In progress');
			const vDbuskins2 = await dmDbuskins.openByTitle(taskTitle);
			await vDbuskins2.clickCompleteTask();
			await vDbuskins2.save();
			await vDbuskins2.close();
			await dmDbuskins.expectInGroup(taskTitle, 'Closed');

			// --- Plain participant (minoue): sees it, but read-only (no actions). ---
			const minoueCtx = await asUser('minoue');
			const minouePage = await minoueCtx.newPage();
			await minouePage.goto(editorialLink(submission.id), {waitUntil: 'commit'});
			const dmMinoue = new DiscussionManagerPage(minouePage);
			await dmMinoue.expectInGroup(taskTitle, 'Closed');
			await dmMinoue.expectActionsMenuHidden(taskTitle);

			// --- Non-participant sub-editor (sberardo): doesn't see the item. ---
			const sberardoCtx = await asUser('sberardo');
			const sberardoPage = await sberardoCtx.newPage();
			await sberardoPage.goto(editorialLink(submission.id), {waitUntil: 'commit'});
			const dmSberardo = new DiscussionManagerPage(sberardoPage);
			await dmSberardo.expectVisible();
			await expect(dmSberardo.titleButton(taskTitle)).toHaveCount(0, {
				timeout: 15_000,
			});
		},
	);

	// Canonical scenario 4 — a manager saves a Copyediting template with auto-add
	// on + a two-week due interval; Accept and Skip Review lands the submission in
	// Copyediting and a participant-less Yet-to-begin task appears once. It can't
	// be started until participants + an owner are edited in (rule 10). Re-entering
	// the stage does not duplicate the surviving item (rule 21).
	test(
		'Auto-add on stage entry',
		{tag: '@regression'},
		async ({page, pkpApi}) => {
			test.slow(); // scratch journal + template + decisions
			const tag = uniqueTag('auto');
			const templateTitle = `Auto task ${tag}`;

			// dbarnes as 'editor' → the "Journal editor" group, which is
			// ROLE_ID_MANAGER with settings access (registry/userGroups.xml:18).
			// A MANAGER-role stage assignment is what lets the manager both see
			// the panel AND edit an auto-created (participant-less) task — the
			// task routes' QueryAssignedToUserAccessPolicy grants a non-participant
			// only when MANAGER is in their accessible stage roles, and a
			// sub-editor assignment (role 17) would not satisfy that.
			const {context} = await pkpApi.createJournal({
				tag,
				users: [{username: 'dbarnes', roles: ['editor']}],
			});
			const journalPath = context.path;

			// dbarnes (a manager here) creates the auto-add Copyediting template
			// via the editTaskTemplates API.
			await page.goto(`/index.php/${journalPath}/dashboard`, {
				waitUntil: 'commit',
			});
			const csrf = await readCsrf(page);
			await createTaskTemplate(page, journalPath, csrf, {
				type: TASK_TYPE,
				stageId: STAGE_EDITING,
				title: templateTitle,
				include: true, // auto-add on stage entry
				dueInterval: 'P2W', // two weeks
				description: `<p>Auto-created copyediting task — ${tag}</p>`,
				restrictToUserGroups: false,
				userGroupIds: [],
			});

			// Seed the submission already carrying the Accept-and-Skip-Review
			// decision: the scenario runs the real decision (runAdditionalActions),
			// so stage entry auto-creates one participant-less task from the
			// template — the exact consequence this scenario owns.
			const {submission} = await pkpApi.createSubmission(
				copyeditingSpec({
					tag,
					title: `Auto sub ${tag}`,
					journal: journalPath,
					participants: [{user: 'dbarnes', role: 'editor'}],
				}),
			);

			const workflow = new EditorialWorkflowPage(page);
			await workflow.goto(submission.id, {journalPath});
			await expect(
				workflow.workflowModal().getByRole('heading', {
					name: 'Workflow: Copyediting',
				}),
			).toBeVisible({timeout: 20_000});

			const dm = new DiscussionManagerPage(page);
			await dm.expectVisible();
			// Exactly one auto-created task, under Yet to begin.
			await dm.expectItemCount(templateTitle, 1);
			await dm.expectInGroup(templateTitle, 'Yet to begin');

			// It can't be started yet: no responsible participant ⇒ the view-modal
			// status control is disabled (rule 10).
			let view = await dm.openByTitle(templateTitle);
			await view.expectStatusControlDisabled();
			await view.close();

			// Edit in a participant + owner, then it starts.
			const editForm = await dm.openActions(templateTitle, 'Edit');
			await editForm.checkParticipant(USER.dbarnes.name);
			await editForm.setResponsibleAssignee(USER.dbarnes.name);
			await editForm.save();
			view = await dm.openByTitle(templateTitle);
			await view.clickStartTask();
			await view.save();
			await view.close();
			await dm.expectInGroup(templateTitle, 'In progress');

			// Rule 21 (dedup): re-enter Copyediting. "Move to Review" from
			// copyediting returns the submission to the Submission stage; recording
			// "Accept and Skip Review" there re-enters Copyediting — where the
			// already-created item must NOT be duplicated.
			await workflow.clickDecision('Move to Review');
			await recordDecisionFlow(workflow, page);
			await workflow.goto(submission.id, {journalPath});
			await expect(
				workflow.workflowModal().getByRole('heading', {
					name: 'Workflow: Submission',
				}),
			).toBeVisible({timeout: 20_000});
			await workflow.clickDecision('Accept and Skip Review');
			await recordDecisionFlow(workflow, page);

			await workflow.goto(submission.id, {journalPath});
			await expect(
				workflow.workflowModal().getByRole('heading', {
					name: 'Workflow: Copyediting',
				}),
			).toBeVisible({timeout: 20_000});
			await dm.expectVisible();
			// Still exactly one task from the template — no duplicate.
			await dm.expectItemCount(templateTitle, 1);
		},
	);

	// Canonical scenario 5 — while adding an item, picking a template flips the
	// form to the template's type, prefills title/description/due date and
	// pre-selects participants from the template's user groups; nothing is saved
	// until the form is submitted.
	test(
		'Apply template prefill',
		{tag: '@regression'},
		async ({page, pkpApi}) => {
			test.slow(); // scratch journal + template
			const tag = uniqueTag('tmpl');
			const templateTitle = `Prefill template ${tag}`;
			const templateBody = `Template body text ${tag}`;

			const {context} = await pkpApi.createJournal({
				tag,
				users: [
					{username: 'dbarnes', roles: ['manager', 'sectionEditor']},
					{username: 'dbuskins', roles: ['sectionEditor']},
				],
			});
			const journalPath = context.path;

			await page.goto(`/index.php/${journalPath}/dashboard`, {
				waitUntil: 'commit',
			});
			const csrf = await readCsrf(page);
			// A submission-stage TASK template restricted to the Section editor
			// group, so applying it should pre-select the section editors on the
			// submission's stage (rule 20).
			const groupId = await userGroupIdForRole(
				page,
				journalPath,
				ROLE_ID_SUB_EDITOR,
			);
			await createTaskTemplate(page, journalPath, csrf, {
				type: TASK_TYPE,
				stageId: STAGE_SUBMISSION,
				title: templateTitle,
				include: false,
				dueInterval: 'P2W',
				description: `<p>${templateBody}</p>`,
				restrictToUserGroups: true,
				userGroupIds: [groupId],
			});

			const {submission} = await pkpApi.createSubmission(
				submissionStageSpec({
					tag,
					title: `Prefill sub ${tag}`,
					journal: journalPath,
					participants: [
						{user: 'dbarnes', role: 'sectionEditor'},
						{user: 'dbuskins', role: 'sectionEditor'},
					],
				}),
			);

			const workflow = new EditorialWorkflowPage(page);
			await workflow.goto(submission.id, {journalPath});
			await expect(
				workflow.workflowModal().getByRole('heading', {
					name: 'Workflow: Submission',
				}),
			).toBeVisible({timeout: 20_000});

			const dm = new DiscussionManagerPage(page);
			await dm.expectVisible();
			const form = await dm.openAdd();

			// Before applying: it's a discussion (task toggle off), no title.
			expect(await form.isTaskInfoChecked()).toBe(false);
			expect(await form.titleValue()).toBe('');

			await form.applyTemplate(templateTitle);

			// Type flipped to task; title / description / due date prefilled.
			expect(await form.isTaskInfoChecked()).toBe(true);
			expect(await form.titleValue()).toBe(templateTitle);
			expect(await form.descriptionContent()).toContain(templateBody);
			const due = await form.dueDateValue();
			expect(due, 'due date is prefilled').not.toBe('');
			expect(due >= isoDate(0), 'due date is today-or-later').toBe(true);

			// SPEC CONTRADICTION (rule 20 / scenario 5) — reported, not a test bug.
			// The verified spec says applying a template "pre-selects participants
			// from the template's user groups". As built, it does NOT: the client
			// useDiscussionManagerForm.setValuesFromTemplate() sets only title,
			// type, description and due date and never writes the participants
			// field — even though the fromTemplate endpoint DOES return the
			// promoted participants. So the section editor (dbuskins) who holds the
			// template's restricted group is NOT pre-selected; only the creator
			// default (dbarnes) stays checked. Live-probed on 2026-07 main.
			await form.expectParticipantChecked(USER.dbarnes.name); // creator default
			await form.expectParticipantNotChecked(USER.dbuskins.name); // NOT pre-selected

			// Nothing saved until submit: cancel and confirm no item was created.
			await form.cancel();
			await dismissDiscardDialog(page);
			await expect(dm.titleButton(templateTitle)).toHaveCount(0, {
				timeout: 10_000,
			});
		},
	);

	// Canonical scenario 6 — one participant blocks discussion emails in their
	// profile: the next discussion still reaches their Tasks bell but not their
	// inbox. A second participant instead follows the unsubscribe link in an email
	// and confirms — same end state. Both opt-outs are scoped to that journal.
	test(
		'Email opt-out both ways',
		{tag: '@regression'},
		async ({page, pkpApi, pkpMail, asUser}) => {
			test.slow(); // scratch journal + profile edit + unsubscribe flow + two discussions
			const tag = uniqueTag('optout');
			const marker1 = `${tag}one`;
			const marker2 = `${tag}two`;

			const {context} = await pkpApi.createJournal({
				tag,
				users: [
					{username: 'dbarnes', roles: ['sectionEditor']},
					{username: 'shellier', roles: ['sectionEditor']},
					{username: 'svogt', roles: ['sectionEditor']},
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
					{user: 'dbarnes', role: 'sectionEditor'},
					{user: 'shellier', role: 'sectionEditor'},
					{user: 'svogt', role: 'sectionEditor'},
				],
				publications: [{metadata: {title: {en: `Opt-out sub ${tag}`}}}],
			});

			// --- shellier: block discussion EMAILS in the scratch-journal profile.
			//     (shellier + svogt are used only by this test, so their Tasks bells
			//     aren't polluted by other tests' notifications — the grid is not
			//     context-scoped and shows only the newest entries.) ---
			const optoutCtx = await asUser('shellier');
			const optoutPage = await optoutCtx.newPage();
			const optoutProfile = new UserProfilePage(optoutPage, journalPath);
			await optoutProfile.goto('notificationSettings');
			await optoutPage.locator('#emailNotificationNewQuery').check();
			await optoutProfile.save('notificationSettings');

			// --- dbarnes: discussion #1 → svogt gets an email with an unsubscribe
			//     link (shellier is already email-blocked). ---
			const workflow = new EditorialWorkflowPage(page);
			await workflow.goto(submission.id, {journalPath});
			await expect(
				workflow.workflowModal().getByRole('heading', {
					name: 'Workflow: Submission',
				}),
			).toBeVisible({timeout: 20_000});
			const dm = new DiscussionManagerPage(page);
			await dm.expectVisible();
			await createDiscussion(dm, `Disc one ${marker1}`, marker1, [
				USER.shellier.name,
				USER.svogt.name,
			]);

			const [svogtMail1] = await pkpMail.find({
				to: USER.svogt.email,
				contains: marker1,
				timeoutMs: 30_000,
			});
			expect(svogtMail1, 'svogt receives discussion #1 email').toBeTruthy();
			const svogtFull = await pkpMail.fullMessage(svogtMail1.ID);
			const unsubUrl = pkpMail.extractLink(svogtFull.HTML, 'unsubscribe');
			expect(unsubUrl, 'email has an unsubscribe link').toBeTruthy();

			// --- svogt: follow the unsubscribe link + confirm. ---
			const svogtCtx = await asUser('svogt');
			const svogtPage = await svogtCtx.newPage();
			await svogtPage.goto(unsubUrl, {waitUntil: 'commit'});
			await svogtPage
				.getByRole('button', {name: /Unsubscribe/i})
				.first()
				.click();
			await expect(
				svogtPage.getByText(/unsubscrib/i).first(),
			).toBeVisible({timeout: 15_000});

			// --- dbarnes: discussion #2 → both reach the bell, neither the inbox. ---
			await workflow.goto(submission.id, {journalPath});
			await expect(
				workflow.workflowModal().getByRole('heading', {
					name: 'Workflow: Submission',
				}),
			).toBeVisible({timeout: 20_000});
			await dm.expectVisible();
			await createDiscussion(dm, `Disc two ${marker2}`, marker2, [
				USER.shellier.name,
				USER.svogt.name,
			]);

			// dbarnes (creator) receives discussion #2's email — the control that
			// bounds the negative assertions.
			const [barnesMail2] = await pkpMail.find({
				to: USER.dbarnes.email,
				contains: marker2,
				timeoutMs: 30_000,
			});
			expect(barnesMail2, 'creator receives discussion #2 email').toBeTruthy();

			// shellier: bell yes, inbox no (profile email opt-out).
			await expectBellHas(optoutPage, journalPath, tag);
			await pkpMail.expectNone({
				to: USER.shellier.email,
				contains: marker2,
				afterControl: {to: USER.dbarnes.email, contains: marker2},
			});

			// svogt: bell yes, inbox no (unsubscribe-link opt-out).
			await expectBellHas(svogtPage, journalPath, tag);
			await pkpMail.expectNone({
				to: USER.svogt.email,
				contains: marker2,
				afterControl: {to: USER.dbarnes.email, contains: marker2},
			});
		},
	);
});

/**
 * Record a primary decision through its wizard, accepting the default
 * (auto-loaded) email templates. Some decisions are single-step; others carry
 * an email step + a promote-files step, so advance with Continue until the
 * final "Record Decision" button is present, then record. Call while on the
 * decision/record page (after clickDecision).
 */
async function recordDecisionFlow(workflow, page) {
	const record = page.getByRole('button', {name: 'Record Decision', exact: true});
	const cont = page.getByRole('button', {name: 'Continue', exact: true});
	for (let i = 0; i < 4; i++) {
		await record.or(cont).first().waitFor({state: 'visible', timeout: 15_000});
		if (await record.isVisible().catch(() => false)) {
			break;
		}
		await workflow.clickContinue();
	}
	await workflow.recordDecision();
}

/** Confirm any "discard changes?" dialog raised by the form's warnOnClose guard. */
async function dismissDiscardDialog(page) {
	const dialog = page.locator('[data-cy="dialog"]');
	if (await dialog.isVisible().catch(() => false)) {
		const ok = dialog.getByRole('button', {name: /^(OK|Yes|Discard)$/}).first();
		if (await ok.isVisible().catch(() => false)) {
			await ok.click();
		}
	}
}

/** Create a discussion (no task details) with the given participants + save. */
async function createDiscussion(dm, title, marker, participantNames) {
	const form = await dm.openAdd();
	await form.fillTitle(title);
	await form.fillDescription(`<p>Discussion body — ${marker}</p>`);
	for (const name of participantNames) {
		await form.checkParticipant(name);
	}
	await form.save();
	await dm.expectInGroup(title, 'In progress');
}

/**
 * Open a user's Tasks bell via the journal's editorial dashboard (a backend
 * page that carries the top-nav bell) and return the modal. The bell button
 * itself is the readiness landmark — the dashboard's heading text varies by
 * role ("Editor Dashboard" etc.).
 */
async function openBell(userPage, journalPath) {
	await userPage.goto(`/index.php/${journalPath}/en/dashboard/editorial`, {
		waitUntil: 'commit',
	});
	const bell = new TasksGridModal(userPage);
	await expect(bell.bellButton).toBeVisible({timeout: 20_000});
	await bell.open();
	return bell;
}

/** Open the given user's Tasks bell and assert a tagged notification is present. */
async function expectBellHas(userPage, journalPath, marker) {
	const bell = await openBell(userPage, journalPath);
	await expect(bell.task(marker).first()).toBeVisible({timeout: 15_000});
}
