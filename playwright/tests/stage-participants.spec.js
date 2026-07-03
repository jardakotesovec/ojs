// @ts-check
const {test, expect} = require('../support/fixtures.js');
const {
	ParticipantManagerPage,
} = require('../../lib/pkp/playwright/pages/ParticipantManagerPage.js');

/**
 * Stage participants (the workflow Participants panel) — one test per
 * canonical scenario of docs/product/specs/stage-participants.md (9
 * scenarios), landed as 8 tests: scenarios 1 + 7 are MERGED into a
 * single "assign — notified and silent" test, since scenario 7's
 * notified sub-flow IS scenario 1's assign-and-notify and its silent
 * sub-flow only differs by leaving the message blank — one submission,
 * two assigns, exercises both.
 *
 * Placement: OJS root — the flow leans on the publicknowledge journal
 * (its sections, its stage-scoped user groups, the OJS WorkflowPageOJS
 * shell the panel renders inside), even though the ParticipantManager +
 * the legacy StageParticipantGridHandler forms ship from pkp-lib. The
 * driving POM (ParticipantManagerPage) is the shared lib/pkp one.
 *
 * The panel is a Vue read-manager over a LEGACY jQuery write grid: every
 * mutation (Assign / Remove / Notify) hands off to
 * StageParticipantGridHandler via a reka-ui-hosted fbv form. Actions are
 * driven through those real modals (group filter → user search → radio →
 * OK; TinyMCE message); assertions read the resulting state back through
 * the REST API (participants, stage tasks/discussions) and Mailpit
 * rather than toasts.
 *
 * Known deviations respected (spec + e2e ledger):
 *   - NOTIF-editor-assign is DEAD (ledger row 73): the assign-notify path
 *     still sends the discussion EMAIL and opens the discussion, but no
 *     EDITOR_ASSIGN notification fires — so tests assert the email +
 *     discussion reality, never that notification.
 *   - Re-assigning an existing participant silently no-ops and drops
 *     modal flags (ledger row 74): no test re-assigns to change flags.
 *
 * Parallel-safety: tags are single hyphenless alphanumeric tokens riding
 * in every notify message; Mailpit reads are recipient+tag scoped (never
 * clearAll); every submission is per-test via the scenario API.
 */

// Workflow stages (PKPApplication WORKFLOW_STAGE_ID_*).
const STAGE_SUBMISSION = 1;
const STAGE_COPYEDITING = 4; // EDITING

// Role ids (PKP\security\Role::ROLE_ID_*).
const ROLE_ID_MANAGER = 16;
const ROLE_ID_SUB_EDITOR = 17;
const ROLE_ID_ASSISTANT = 4097;

// The workflow shell's refusal shown to a user with no submission access.
const ROLE_DENIED = 'The current role does not have access to this operation.';

// Seeded users (full display names + their @mailinator addresses).
const USER = {
	dbarnes: {name: 'Daniel Barnes', email: 'dbarnes@mailinator.com'},
	dbuskins: {name: 'David Buskins', email: 'dbuskins@mailinator.com'},
	sberardo: {name: 'Stephanie Berardo', email: 'sberardo@mailinator.com'},
	minoue: {name: 'Minoti Inoue', email: 'minoue@mailinator.com'},
	svogt: {name: 'Sarah Vogt', email: 'svogt@mailinator.com'},
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
	return `spart${workerLetter}${suffix.slice(0, 6)}`;
}

/**
 * A stage-1 submission on publicknowledge (legacy shape — no submit
 * event, so no auto-assigned section editors beyond `participants`).
 *
 * @param {{tag: string, title: string, participants?: object[]}} opts
 */
function stage1Spec({tag, title, participants = []}) {
	return {
		tag,
		journal: 'publicknowledge',
		submitter: 'atester',
		section: 'ART',
		locale: 'en',
		participants,
		publications: [{metadata: {title: {en: title}}}],
	};
}

/**
 * A copyediting-stage submission (submitted → skipExternalReview). The
 * submit fires AssignEditors, so the ART section's editors are
 * auto-assigned in addition to `participants`; `decidedBy` records the
 * skip decision.
 *
 * @param {{tag: string, title: string, participants?: object[], decidedBy?: string}} opts
 */
function copyeditingSpec({
	tag,
	title,
	participants = [{user: 'dbarnes', role: 'editor'}],
	decidedBy = 'dbarnes',
}) {
	return {
		tag,
		journal: 'publicknowledge',
		submitter: 'atester',
		section: 'ART',
		locale: 'en',
		submitted: true,
		participants,
		decisions: [{type: 'skipExternalReview', by: decidedBy}],
		publications: [{metadata: {title: {en: title}}}],
	};
}

/**
 * The submission's per-stage participant roster via the REST API, using
 * the page's session cookies, flattened one entry per stage assignment.
 *
 * @param {import('@playwright/test').Page} page
 * @param {number} submissionId
 * @param {number} stageId
 * @param {string} [journalPath='publicknowledge']
 * @returns {Promise<{userId: number, fullName: string, userName: string, roleName: string, roleId: number, recommendOnly: boolean}[]>}
 */
async function fetchParticipants(page, submissionId, stageId, journalPath = 'publicknowledge') {
	const res = await page.request.get(
		`/index.php/${journalPath}/api/v1/submissions/${submissionId}/participants/${stageId}`,
	);
	if (!res.ok()) {
		throw new Error(
			`GET participants ${submissionId}/${stageId} failed: ${res.status()} ${await res.text()}`,
		);
	}
	const users = await res.json();
	const list = [];
	for (const user of users) {
		for (const sa of user.stageAssignments || []) {
			list.push({
				userId: user.id,
				fullName: user.fullName,
				userName: user.userName,
				roleName: sa.stageAssignmentUserGroup?.name,
				roleId: sa.stageAssignmentUserGroup?.roleId,
				recommendOnly: sa.recommendOnly,
			});
		}
	}
	return list;
}

/**
 * The stage's editorial tasks/discussions via the REST API (a manager
 * sees all of them). Each task carries its head/reply notes.
 *
 * @param {import('@playwright/test').Page} page
 * @param {number} submissionId
 * @param {number} stageId
 * @param {string} [journalPath='publicknowledge']
 * @returns {Promise<object[]>}
 */
async function fetchStageTasks(page, submissionId, stageId, journalPath = 'publicknowledge') {
	const res = await page.request.get(
		`/index.php/${journalPath}/api/v1/submissions/${submissionId}/stages/${stageId}/tasks`,
	);
	if (!res.ok()) {
		throw new Error(
			`GET stage tasks ${submissionId}/${stageId} failed: ${res.status()} ${await res.text()}`,
		);
	}
	const body = await res.json();
	return body.items || body;
}

/** The workflow side modal (outer wrapper reports visibility:hidden — scope only). */
function workflowModal(page) {
	return page.locator('[data-cy="active-modal"]').first();
}

/** The editorial-dashboard deep link that mounts the workflow modal. */
function deepLink(submissionId, journalPath = 'publicknowledge') {
	return `/index.php/${journalPath}/en/dashboard/editorial?workflowSubmissionId=${submissionId}`;
}

test.use({user: 'dbarnes'}); // manager-scope editor (Journal editor group = ROLE_ID_MANAGER)

test.describe('Stage participants', () => {
	// Canonical scenarios 1 + 7 (MERGED) — a manager opens the Participants
	// panel and assigns two section editors: one SILENTLY (blank message —
	// no email, no discussion) and one NOTIFIED (a message that is emailed
	// and opened as a submission discussion). Both appear in the roster; the
	// notified assignee gets the stage email and a discussion carrying the
	// message; the silent assignee gets neither. (The dead EDITOR_ASSIGN
	// notification, ledger row 73, is deliberately NOT asserted.)
	test(
		'assign a section editor — silently, then with a notification',
		{tag: ['@smoke', '@regression']},
		async ({page, pkpApi, pkpMail}) => {
			const tag = uniqueTag();
			const {submission} = await pkpApi.createSubmission(
				stage1Spec({
					tag,
					title: `Assign notify ${tag}`,
					participants: [{user: 'dbarnes', role: 'editor'}],
				}),
			);

			const pm = new ParticipantManagerPage(page);
			await pm.gotoWorkflow(submission.id);
			await pm.expectVisible();

			// Silent assign FIRST (no message) so the notified email below is a
			// clean lower bound for the silent-absence assertion.
			await pm.assignParticipant({
				userGroup: 'Section editor',
				nameSearch: 'Berardo',
				fullName: USER.sberardo.name,
			});

			// Notified assign SECOND — a message (carrying the tag) is emailed
			// and opened as a discussion.
			await pm.assignParticipant({
				userGroup: 'Section editor',
				nameSearch: 'Inoue',
				fullName: USER.minoue.name,
				notify: {message: `<p>Please help with this submission — ${tag}</p>`},
			});

			// Both are in the roster as Section editors (server truth).
			const participants = await fetchParticipants(page, submission.id, STAGE_SUBMISSION);
			const sectionEditors = participants.filter((p) => p.roleId === ROLE_ID_SUB_EDITOR);
			expect(sectionEditors.map((p) => p.fullName)).toEqual(
				expect.arrayContaining([USER.sberardo.name, USER.minoue.name]),
			);
			expect(sectionEditors.every((p) => p.roleName === 'Section editor')).toBe(true);

			// The notified assignee received the stage discussion email…
			const [mail] = await pkpMail.find({
				to: USER.minoue.email,
				contains: tag,
				timeoutMs: 30_000,
			});
			expect(mail).toBeTruthy();

			// …and the message opened a submission discussion (the head note
			// carries the message body, tag and all).
			const tasks = await fetchStageTasks(page, submission.id, STAGE_SUBMISSION);
			const discussion = tasks.find((t) =>
				(t.notes || []).some((n) => (n.contents || '').includes(tag)),
			);
			expect(discussion).toBeTruthy();

			// The silent assignee got no email — bounded by the notified email
			// as the positive control (it was enqueued after the silent add).
			await pkpMail.expectNone({
				to: USER.sberardo.email,
				contains: tag,
				afterControl: {to: USER.minoue.email, contains: tag},
				timeoutMs: 30_000,
			});
		},
	);

	// Canonical scenario 2 — the Assign picker's role filter offers the
	// stage's non-reviewer user groups, and the set is genuinely
	// stage-specific: Submission lists Journal editor / Section editor /
	// Guest editor / Funding coordinator / Author / Translator; Copyediting
	// swaps in Production editor / Copyeditor / Marketing and sales
	// coordinator (and drops the submission-only Funding coordinator) —
	// never a reviewer group.
	test(
		'the picker offers stage-appropriate roles',
		{tag: '@regression'},
		async ({page, pkpApi}) => {
			const tag = uniqueTag();

			const submission = await pkpApi.createSubmission(
				stage1Spec({
					tag,
					title: `Roles submission ${tag}`,
					participants: [{user: 'dbarnes', role: 'editor'}],
				}),
			);
			const copyediting = await pkpApi.createSubmission(
				copyeditingSpec({tag, title: `Roles copyediting ${tag}`}),
			);

			const pm = new ParticipantManagerPage(page);

			/** Read the role-filter option labels from a freshly opened Assign modal. */
			async function roleOptions(submissionId) {
				await pm.gotoWorkflow(submissionId);
				await pm.expectVisible();
				const {form} = await pm.openAssignForm();
				const select = form.locator('select[name="filterUserGroupId"]');
				await expect(select).toBeVisible({timeout: 15_000});
				const labels = (await select.locator('option').allTextContents()).map((s) =>
					s.trim(),
				);
				return labels.sort();
			}

			const submissionRoles = await roleOptions(submission.submission.id);
			expect(submissionRoles).toEqual(
				[
					'Author',
					'Funding coordinator',
					'Guest editor',
					'Journal editor',
					'Section editor',
					'Translator',
				].sort(),
			);
			expect(submissionRoles.some((label) => /review/i.test(label))).toBe(false);

			const copyeditingRoles = await roleOptions(copyediting.submission.id);
			expect(copyeditingRoles).toEqual(
				[
					'Author',
					'Copyeditor',
					'Guest editor',
					'Journal editor',
					'Marketing and sales coordinator',
					'Production editor',
					'Section editor',
					'Translator',
				].sort(),
			);
			expect(copyeditingRoles.some((label) => /review/i.test(label))).toBe(false);
		},
	);

	// Canonical scenario 3 — the two flag checkboxes surface conditionally by
	// the selected role (live-verified toggle): a Section-editor selection
	// reveals Recommend only; a Journal-editor (manager) selection reveals
	// Recommend only but HIDES Can change metadata (managers always may); a
	// Copyeditor selection HIDES Recommend only and reveals Can change
	// metadata. Driven on a Copyediting submission (the one stage whose
	// picker offers all three role families).
	test(
		'flags surface only for the right roles',
		{tag: '@regression'},
		async ({page, pkpApi}) => {
			const tag = uniqueTag();
			// dbuskins is the assigned deciding editor here so that dbarnes
			// (this test's actor) stays UNassigned in the Journal-editor group
			// and is therefore selectable in that filter.
			const {submission} = await pkpApi.createSubmission(
				copyeditingSpec({
					tag,
					title: `Flags ${tag}`,
					participants: [{user: 'dbuskins', role: 'sectionEditor'}],
					decidedBy: 'dbuskins',
				}),
			);

			const pm = new ParticipantManagerPage(page);
			await pm.gotoWorkflow(submission.id);
			await pm.expectVisible();
			const {modal, form} = await pm.openAssignForm();

			const recommendOnly = form.locator('.recommendOnlyWrapper');
			const canChangeMetadata = form.locator('.submissionEditMetadataPermit');

			// Section editor → Recommend only shown (and Can change metadata
			// shown — a sub-editor is not a manager).
			await pm.selectUser({modal, form}, {
				userGroup: 'Section editor',
				nameSearch: 'Inoue',
				fullName: USER.minoue.name,
			});
			await expect(recommendOnly).toBeVisible();
			await expect(canChangeMetadata).toBeVisible();

			// Journal editor (manager role) → Recommend only shown, Can change
			// metadata HIDDEN (managers are implicitly permitted).
			await pm.selectUser({modal, form}, {
				userGroup: 'Journal editor',
				nameSearch: 'Barnes',
				fullName: USER.dbarnes.name,
			});
			await expect(recommendOnly).toBeVisible();
			await expect(canChangeMetadata).toBeHidden();

			// Copyeditor (assistant role) → Recommend only HIDDEN, Can change
			// metadata shown.
			await pm.selectUser({modal, form}, {
				userGroup: 'Copyeditor',
				nameSearch: 'Vogt',
				fullName: USER.svogt.name,
			});
			await expect(recommendOnly).toBeHidden();
			await expect(canChangeMetadata).toBeVisible();
		},
	);

	// Canonical scenario 4 — assigning an assistant grants them role-scoped
	// stage access (the point of the panel). A copyeditor who cannot open a
	// copyediting submission before being assigned CAN open it — and only
	// that stage — once a manager assigns them as Copyeditor.
	test(
		'assign an assistant, scoped to their stage',
		{tag: '@regression'},
		async ({page, pkpApi, asUser}) => {
			test.slow(); // second actor + before/after access probes
			const tag = uniqueTag();
			const {submission} = await pkpApi.createSubmission(
				copyeditingSpec({tag, title: `Assistant access ${tag}`}),
			);

			// Before assignment: mfritz (unassigned copyeditor) is refused.
			const mfritzCtx = await asUser('mfritz');
			const mfritzPage = await mfritzCtx.newPage();
			await mfritzPage.goto(deepLink(submission.id), {waitUntil: 'commit'});
			await expect(mfritzPage.getByText(ROLE_DENIED)).toBeVisible({timeout: 20_000});

			// The manager assigns mfritz as Copyeditor on the copyediting pane.
			const pm = new ParticipantManagerPage(page);
			await pm.gotoWorkflow(submission.id);
			await pm.expectVisible();
			await pm.assignParticipant({
				userGroup: 'Copyeditor',
				nameSearch: 'Fritz',
				fullName: USER.mfritz.name,
			});
			const assigned = await fetchParticipants(page, submission.id, STAGE_COPYEDITING);
			expect(
				assigned.find((p) => p.fullName === USER.mfritz.name && p.roleId === ROLE_ID_ASSISTANT),
			).toBeTruthy();

			// After assignment: mfritz can now open the Copyediting pane.
			await mfritzPage.goto(deepLink(submission.id), {waitUntil: 'commit'});
			await expect(
				workflowModal(mfritzPage).getByRole('heading', {name: 'Workflow: Copyediting'}),
			).toBeVisible({timeout: 20_000});
			await expect(
				workflowModal(mfritzPage).locator('[data-cy="participant-manager"]'),
			).toBeVisible({timeout: 20_000});
			await expect(mfritzPage.getByText(ROLE_DENIED)).toHaveCount(0);
		},
	);

	// Canonical scenario 5 — an ASSIGNED section editor (not a manager)
	// administers the panel: dbuskins, holding a Section-editor assignment,
	// sees the Assign button, adds a participant, and removes one. The
	// removal deletes the stage assignment.
	test(
		'an assigned section editor administers the panel',
		{tag: '@regression'},
		async ({pkpApi, asUser}) => {
			test.slow(); // second actor + add + remove round-trips
			const tag = uniqueTag();
			const {submission} = await pkpApi.createSubmission(
				stage1Spec({
					tag,
					title: `Section editor admin ${tag}`,
					participants: [{user: 'dbuskins', role: 'sectionEditor'}],
				}),
			);

			// dbuskins is a plain section editor (no manager role) whose only
			// authority here is the Section-editor assignment.
			const ctx = await asUser('dbuskins');
			const page = await ctx.newPage();
			const pm = new ParticipantManagerPage(page);
			await pm.gotoWorkflow(submission.id);
			await pm.expectVisible();

			// The Assign button is present for the assigned section editor.
			await expect(pm.assignButton).toBeVisible({timeout: 15_000});

			// Add a participant.
			await pm.assignParticipant({
				userGroup: 'Section editor',
				nameSearch: 'Berardo',
				fullName: USER.sberardo.name,
			});
			let participants = await fetchParticipants(page, submission.id, STAGE_SUBMISSION);
			expect(participants.some((p) => p.fullName === USER.sberardo.name)).toBe(true);

			// Remove the one just added — the assignment is deleted.
			await pm.removeParticipant(USER.sberardo.name);
			participants = await fetchParticipants(page, submission.id, STAGE_SUBMISSION);
			expect(participants.some((p) => p.fullName === USER.sberardo.name)).toBe(false);
		},
	);

	// Canonical scenario 6 — an assistant sees the roster read-only: mfritz,
	// assigned as Copyeditor, opens the submission and sees the full
	// Participants list but NO Assign button, and each row's ⋯ menu offers
	// only Notify (no Edit, no Remove).
	test(
		'an assistant sees the roster read-only',
		{tag: '@regression'},
		async ({pkpApi, asUser}) => {
			const tag = uniqueTag();
			const {submission} = await pkpApi.createSubmission(
				copyeditingSpec({
					tag,
					title: `Assistant read-only ${tag}`,
					participants: [
						{user: 'dbarnes', role: 'editor'},
						{user: 'mfritz', role: 'copyeditor'},
					],
				}),
			);

			const ctx = await asUser('mfritz');
			const page = await ctx.newPage();
			const pm = new ParticipantManagerPage(page);
			await pm.gotoWorkflow(submission.id);
			await pm.expectVisible();

			// The roster renders (mfritz appears on it) but with no Assign.
			await expect(pm.participantRow(USER.mfritz.name)).toBeVisible({timeout: 15_000});
			await expect(pm.assignButton).toHaveCount(0);

			// A row's ⋯ menu offers Notify only — no Edit, no Remove.
			await pm.openMoreActions(USER.mfritz.name);
			await expect(pm.menuItem('Notify')).toBeVisible({timeout: 10_000});
			await expect(pm.menuItem('Remove')).toHaveCount(0);
			await expect(pm.menuItem('Edit')).toHaveCount(0);
		},
	);

	// Canonical scenario 8 — removing a participant revokes their access.
	// mfritz (assigned Copyeditor) can open the Copyediting pane; after a
	// manager removes them, the stage assignment is gone and mfritz can no
	// longer open the submission at all.
	test(
		'remove revokes access',
		{tag: '@regression'},
		async ({page, pkpApi, asUser}) => {
			test.slow(); // second actor + before/after access probes
			const tag = uniqueTag();
			const {submission} = await pkpApi.createSubmission(
				copyeditingSpec({
					tag,
					title: `Remove revokes ${tag}`,
					participants: [
						{user: 'dbarnes', role: 'editor'},
						{user: 'mfritz', role: 'copyeditor'},
					],
				}),
			);

			// Before removal: mfritz can open the Copyediting pane.
			const mfritzCtx = await asUser('mfritz');
			const mfritzPage = await mfritzCtx.newPage();
			await mfritzPage.goto(deepLink(submission.id), {waitUntil: 'commit'});
			await expect(
				workflowModal(mfritzPage).getByRole('heading', {name: 'Workflow: Copyediting'}),
			).toBeVisible({timeout: 20_000});

			// The manager removes mfritz from the panel.
			const pm = new ParticipantManagerPage(page);
			await pm.gotoWorkflow(submission.id);
			await pm.expectVisible();
			await pm.removeParticipant(USER.mfritz.name);

			// The stage assignment is gone…
			const participants = await fetchParticipants(page, submission.id, STAGE_COPYEDITING);
			expect(participants.some((p) => p.fullName === USER.mfritz.name)).toBe(false);

			// …and mfritz's access to the submission is revoked.
			await mfritzPage.goto(deepLink(submission.id), {waitUntil: 'commit'});
			await expect(mfritzPage.getByText(ROLE_DENIED)).toBeVisible({timeout: 20_000});
			await expect(
				workflowModal(mfritzPage).getByRole('heading', {name: 'Workflow: Copyediting'}),
			).toHaveCount(0);
		},
	);

	// Canonical scenario 9 — auto-assignment at submission time. When a
	// manuscript is submitted to a section that has configured section
	// editors (publicknowledge ART → dbuskins, sberardo, …), they are
	// auto-assigned as Section-editor participants from
	// subeditor_submission_group; when a section has NO editor mapped (a
	// fresh scratch journal), the submission carries only its author.
	test(
		'auto-assignment at submission',
		{tag: '@regression'},
		async ({page, pkpApi, asUser}) => {
			test.slow(); // publicknowledge submit + scratch journal + submit
			const tag = uniqueTag();

			// Positive: ART on publicknowledge maps section editors, which the
			// submit-time AssignEditors listener auto-assigns.
			const {submission} = await pkpApi.createSubmission({
				tag,
				journal: 'publicknowledge',
				submitter: 'atester',
				section: 'ART',
				locale: 'en',
				submitted: true,
				participants: [],
				publications: [{metadata: {title: {en: `Auto assign ${tag}`}}}],
			});

			const seeded = await fetchParticipants(page, submission.id, STAGE_SUBMISSION);
			const seededEditors = seeded
				.filter((p) => p.roleId === ROLE_ID_SUB_EDITOR)
				.map((p) => p.fullName);
			// dbuskins + sberardo are pure Section editors mapped to ART.
			expect(seededEditors).toEqual(
				expect.arrayContaining([USER.dbuskins.name, USER.sberardo.name]),
			);
			// The author is always on the roster too.
			expect(seeded.some((p) => p.fullName === USER.atester.name)).toBe(true);

			// Negative: a fresh scratch journal's default section has no
			// mapped editor, so the submit auto-assigns none.
			const {context} = await pkpApi.createJournal({
				tag,
				users: [{username: 'atester', roles: ['author']}],
			});
			const {submission: orphan} = await pkpApi.createSubmission({
				tag,
				journal: context.path,
				submitter: 'atester',
				section: 'ART',
				locale: 'en',
				submitted: true,
				participants: [],
				publications: [{metadata: {title: {en: `No editor ${tag}`}}}],
			});

			// dbarnes has no role on the scratch journal; admin is auto-enrolled
			// there as Journal manager (scratch-journal parity) and can read it.
			const adminCtx = await asUser('admin');
			const adminPage = await adminCtx.newPage();
			const orphanParticipants = await fetchParticipants(
				adminPage,
				orphan.id,
				STAGE_SUBMISSION,
				context.path,
			);
			// No editor/manager was auto-assigned — only the author is present.
			expect(
				orphanParticipants.some(
					(p) => p.roleId === ROLE_ID_SUB_EDITOR || p.roleId === ROLE_ID_MANAGER,
				),
			).toBe(false);
			expect(orphanParticipants.some((p) => p.fullName === USER.atester.name)).toBe(true);
		},
	);
});
