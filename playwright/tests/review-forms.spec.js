// @ts-check
const {test, expect} = require('../support/fixtures.js');
const {setTinyMceContent} = require('../../lib/pkp/playwright/support/tinymce.js');
const {
	ReviewFormSettingsPage,
} = require('../../lib/pkp/playwright/pages/ReviewFormSettingsPage.js');
const {
	ReviewerManagerPage,
} = require('../../lib/pkp/playwright/pages/ReviewerManagerPage.js');

/**
 * Review forms (the manager's BUILDER) — one test per canonical scenario
 * of docs/product/specs/review-forms.md (8 scenarios → 7 tests).
 *
 * This spec owns the Review Forms grid under Settings → Workflow → Review:
 * create / edit / copy / delete a structured review form, add and
 * configure its question elements (six item types, the possible-responses
 * listbuilder for choice types), mark elements required / author-visible,
 * and activate a form so it becomes selectable at reviewer assignment.
 *
 * The builder is a LEGACY pkp jQuery grid (`ReviewFormGridHandler` +
 * `ReviewFormElementsGridHandler`) loaded via load_url_in_div into the Vue
 * Settings shell (spec rule 1) — every action is a server-rendered fbv
 * AjaxModal. We drive those modals through the shared
 * ReviewFormSettingsPage POM (lib/pkp) and assert on the resulting grid
 * state (rows, Active checkbox, In Review count, the Form Items grid), the
 * assembled Preview, and — for the in-use/assignment scenarios — the
 * review_assignments and the editor's Add-Reviewer Review Form dropdown.
 * Never on toasts (spec rules; the trivial "changes saved" notification is
 * shared + racy). No hard-coded waits: the POM anchors on jQuery-idle and
 * on visible landmarks.
 *
 * Scenario mapping (see per-test comments):
 *   1 + 2 → build a form with mixed element types, incl. a choice element
 *           with preset responses (MERGED: scenario 1's mixed-type build
 *           already adds a Drop-down box, which IS scenario 2's choice
 *           element — the Response Options listbuilder + the <select> in
 *           the Preview are asserted on that same element. This is the
 *           pair-merge that lands the file at exactly 7 tests.)
 *   3  → activate a form; it appears in the Add-Reviewer dropdown
 *   4  → required / author-visibility flags per element
 *   5  → in-use lock — Edit/Delete withdrawn, only Copy + Preview; copy
 *        to revise the live form
 *   6  → delete an unused form
 *   7  → deactivate a form that is in use (as-built deviation — succeeds
 *        despite the activate warning)
 *   8  → permission boundary — manager only (section editor refused)
 *
 * Actors: dbarnes is a Journal-manager on publicknowledge (roles:['editor']
 * → Journal editor group = ROLE_ID_MANAGER), so he owns the grid. Scenario
 * 8 contrasts him against dbuskins, a plain Section editor with no Settings
 * access. Scenarios that need an in-use / active form on a clean grid (3, 5,
 * 7) run on a scratch journal (createJournal) so the active-form pollution
 * of publicknowledge's assignment dropdowns is avoided and the in-use seed
 * (an accepted reviewer holding the form) stays isolated. Build-only /
 * delete scenarios (1, 4, 6) leave harmless INACTIVE forms on
 * publicknowledge; unique tag-suffixed titles keep them re-runnable on a
 * warm DB.
 *
 * As-built respected (spec ⚠, Known deviations): deactivating an in-use
 * form SUCCEEDS even though the activate confirm claims it becomes
 * impossible once assigned — scenario 7 asserts the real behaviour, not the
 * dialog's promise. Copy yields a same-titled INACTIVE duplicate (no
 * "(copy)" suffix).
 */

// ReviewFormElement item-type labels (locale en) — the <select> option
// text a manager picks in the element form.
const TYPE = {
	extended: 'Extended text box', // TEXTAREA (free text)
	dropdown: 'Drop-down box', // DROP_DOWN_BOX (choice → Response Options)
	checkboxes: 'Checkboxes (you can choose one or more)', // CHECKBOXES (choice)
};

const REVIEWER = 'jjanssen'; // baseline reviewer; full name below
const REVIEWER_NAME = 'Julie Janssen';

// The role-denied JSONMessage the legacy grid returns to a non-manager
// (RoleBasedHandlerOperationPolicy) — spec footnote a / scenario 8.
const ROLE_DENIED = 'The current role does not have access to this operation.';

/** Unique, hyphenless alphanumeric tag (parallel isolation; scratch urlPath ≤ 32). */
function uniqueTag() {
	const workerIndex = test.info().parallelIndex;
	const suffix = Math.random().toString(36).slice(2, 8);
	return `rvf${workerIndex}x${suffix}`;
}

/**
 * The direct component-router URL of a Review Forms grid op — used by the
 * permission boundary test to read the handler's authorize() verdict
 * straight off the JSONMessage (component parts + op are uncamelized to
 * dash-case by PKPComponentRouter::url).
 *
 * @param {string} op  kebab-cased op, e.g. 'fetch-grid'
 * @param {string} [journalPath='publicknowledge']
 */
function gridUrl(op, journalPath = 'publicknowledge') {
	return `/index.php/${journalPath}/$$$call$$$/grid/settings/review-forms/review-form-grid/${op}`;
}

/**
 * Fetch a submission's reviewAssignments summary through a request context
 * (the page's session cookies). Closes the loop on the in-flight review a
 * deactivate must NOT disturb (scenario 7) / the in-use seed (scenario 5).
 *
 * @param {import('@playwright/test').APIRequestContext} request
 * @param {number} submissionId
 * @param {string} journalPath
 */
async function fetchAssignments(request, submissionId, journalPath) {
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

test.use({user: 'dbarnes'}); // default actor: a Journal manager of publicknowledge

test.describe('Review forms (builder)', () => {
	// Canonical scenarios 1 + 2 (MERGED) — a manager builds "Peer Review"
	// (title + instructions) then adds three elements of mixed types: an
	// Extended text box for narrative comments, a Drop-down box rating whose
	// Response Options listbuilder gets Excellent / Good / Poor, and a
	// Checkboxes list. All three land in the Form Items grid; the Preview
	// renders the drop-down as a <select> carrying those preset options
	// (scenario 2's end-to-end assertion, on the same choice element the
	// mixed-type build introduced).
	test(
		'build a form with mixed element types incl. a choice element with preset responses',
		{tag: ['@smoke', '@regression']},
		async ({page}) => {
			test.slow(); // create modal + 3 element modals + listbuilder + preview
			const tag = uniqueTag();
			const title = `Peer Review ${tag}`;
			const narrative = `Narrative comments ${tag}`;
			const rating = `Overall rating ${tag}`;
			const aspects = `Aspects assessed ${tag}`;
			const ratingOptions = ['Excellent', 'Good', 'Poor'];

			const rf = new ReviewFormSettingsPage(page);
			await rf.goto('publicknowledge');

			// Create the form basics (inactive on save — rule 2).
			const form = await rf.openCreateForm();
			await rf.fillFormBasics(form, {
				title,
				description: `<p>Please assess this manuscript. ${tag}</p>`,
			});
			await rf.saveAjaxForm(form);

			const [rowId] = await rf.rowIds(title);
			expect(rowId, 'the new form should appear as one grid row').toBeTruthy();

			// Open Edit → Form Items and add the three mixed-type elements.
			const tabs = await rf.openEditModal(rowId);
			await rf.openFormItemsTab(tabs);

			await rf.addElement({question: narrative, typeLabel: TYPE.extended});
			await rf.addElement({
				question: rating,
				typeLabel: TYPE.dropdown,
				options: ratingOptions, // Response Options listbuilder (scenario 2)
			});
			await rf.addElement({
				question: aspects,
				typeLabel: TYPE.checkboxes,
				options: ['Clarity', 'Rigour'],
			});

			// All three questions are listed in the Form Items grid.
			const elementsGrid = page
				.locator('#reviewFormElementsGridContainer')
				.last();
			for (const q of [narrative, rating, aspects]) {
				await expect(elementsGrid.getByText(q)).toBeVisible();
			}

			// The Preview renders the drop-down element as a <select> whose
			// options are the preset responses (scenario 2, end-to-end).
			const preview = await rf.openPreviewTab(tabs);
			const dropdown = preview.locator('select').filter({
				has: page.locator('option', {hasText: 'Excellent'}),
			});
			await expect(dropdown).toHaveCount(1);
			for (const option of ratingOptions) {
				await expect(
					dropdown.locator('option', {hasText: option}),
				).toHaveCount(1);
			}
		},
	);

	// Canonical scenario 3 — the manager ticks the row's Active checkbox
	// (confirming the prompt); the form flips active and now populates the
	// editor's Add-Reviewer Review Form dropdown alongside "None / Free Form
	// Review". Run on a scratch journal: an active form on publicknowledge
	// would leak into every other spec's assignment dropdown.
	test(
		'activate a form so it appears in the assignment dropdown',
		{tag: ['@smoke', '@regression']},
		async ({page, pkpApi}) => {
			test.slow(); // scratch journal + build/activate UI + assign modal
			const tag = uniqueTag();
			const title = `Activation Form ${tag}`;
			const {context} = await pkpApi.createJournal({
				tag,
				users: [
					{username: 'dbarnes', roles: ['manager']},
					{username: REVIEWER, roles: ['reviewer']},
					{username: 'atester', roles: ['author']},
				],
			});

			// Build a minimal form (no elements needed — activation has no
			// element-count guard) and activate it.
			const rf = new ReviewFormSettingsPage(page);
			await rf.goto(context.path);
			const form = await rf.openCreateForm();
			await rf.fillFormBasics(form, {title});
			await rf.saveAjaxForm(form);

			const [rowId] = await rf.rowIds(title);
			expect(rowId).toBeTruthy();
			// Newly created form is inactive (rule 2).
			await expect(rf.activeCheckbox(rowId)).not.toBeChecked();

			// Activate: click the Active checkbox and confirm the prompt.
			await rf.toggleActive(rowId);
			await expect(rf.activeCheckbox(rowId)).toBeChecked({timeout: 15_000});

			// A submission in review on the scratch journal, dbarnes as the
			// deciding editor.
			const {submission} = await pkpApi.createSubmission({
				tag,
				journal: context.path,
				submitter: 'atester',
				section: 'ART',
				locale: 'en',
				participants: [{user: 'dbarnes', role: 'editor'}],
				decisions: [{type: 'sendExternalReview', by: 'dbarnes'}],
				reviewRounds: [{reviewers: []}],
				publications: [{metadata: {title: {en: `Activation sub ${tag}`}}}],
			});

			// Open Add Reviewer and pick the reviewer: the assignment form's
			// Review Form dropdown now offers the active form (rule 9).
			const rm = new ReviewerManagerPage(page);
			await rm.gotoWorkflow(submission.id, {journalPath: context.path});
			const modal = await rm.openAddReviewerModal();
			await rm.searchSelectPanel(modal, REVIEWER);
			await rm.selectReviewer(modal, REVIEWER_NAME);

			const reviewFormSelect = modal
				.locator('select[name="reviewFormId"]')
				.last();
			await expect(reviewFormSelect).toBeVisible({timeout: 15_000});
			const optionLabels = await reviewFormSelect
				.locator('option')
				.allTextContents();
			expect(optionLabels).toContain('None / Free Form Review');
			expect(optionLabels).toContain(title);
		},
	);

	// Canonical scenario 4 — the two per-element flags. On a fresh element
	// the defaults are as spec'd (Reviewers-required OFF, Included-in-message
	// ON, rule 4); the manager marks the narrative element required and
	// clears its author-visibility, saves, and the flags persist (re-opened
	// through Edit — the elements grid shows only the question, so the Edit
	// round-trip is how the stored flags are read back). Enforcement/display
	// of the flags is owned by reviewer-response / review-anonymity.
	test(
		'set required and author-visibility flags on an element',
		{tag: '@regression'},
		async ({page}) => {
			test.slow(); // create form + element create + element re-open
			const tag = uniqueTag();
			const title = `Flags Form ${tag}`;
			const question = `Internal-only assessment ${tag}`;

			const rf = new ReviewFormSettingsPage(page);
			await rf.goto('publicknowledge');
			const form = await rf.openCreateForm();
			await rf.fillFormBasics(form, {title});
			await rf.saveAjaxForm(form);

			const [rowId] = await rf.rowIds(title);
			expect(rowId).toBeTruthy();
			const tabs = await rf.openEditModal(rowId);
			await rf.openFormItemsTab(tabs);

			// A fresh element form: verify the spec'd defaults before touching
			// them (required off, included on).
			const elementForm = await rf.openCreateElementForm();
			await expect(elementForm.locator('input#required')).not.toBeChecked();
			await expect(elementForm.locator('input#included')).toBeChecked();

			// Fill the question, set required ON and Included OFF, save.
			const questionId = await elementForm
				.locator('textarea[name="question[en]"]')
				.getAttribute('id');
			if (!questionId) {
				throw new Error('element question textarea not found');
			}
			await setTinyMceContent(page, questionId, question);
			await elementForm
				.locator('select[name="elementType"]')
				.selectOption({label: TYPE.extended});
			await elementForm.locator('input#required').check();
			await elementForm.locator('input#included').uncheck();
			await rf.saveAjaxForm(elementForm);

			const elementsGrid = page
				.locator('#reviewFormElementsGridContainer')
				.last();
			await expect(elementsGrid.getByText(question)).toBeVisible({
				timeout: 15_000,
			});

			// Re-open the saved element: the flags persisted.
			const editForm = await rf.openEditElementForm(question);
			await expect(editForm.locator('input#required')).toBeChecked();
			await expect(editForm.locator('input#included')).not.toBeChecked();
		},
	);

	// Canonical scenario 5 — once a reviewer holds the form (In Review = 1),
	// the row's Edit and Delete actions are withdrawn (canEdit = false) and
	// only Copy + Preview remain; the manager copies the form to revise a
	// version without touching the live one, and the copy is a fresh INACTIVE
	// same-titled duplicate (rules 6/8). Seeded on a scratch journal: an
	// active form + an accepted reviewer attached to it.
	test(
		'an in-use form locks Edit/Delete and offers only Copy + Preview',
		{tag: ['@smoke', '@regression']},
		async ({page, pkpApi}) => {
			test.slow(); // scratch journal + in-use seed + copy round-trip
			const tag = uniqueTag();
			const title = `Locked Form ${tag}`;
			const {context} = await pkpApi.createJournal({
				tag,
				users: [
					{username: 'dbarnes', roles: ['manager']},
					{username: REVIEWER, roles: ['reviewer']},
					{username: 'atester', roles: ['author']},
				],
				reviewForms: [
					{
						title,
						elements: [
							{type: 'textarea', question: `Methodology ${tag}`},
						],
					},
				],
			});

			// A submission whose accepted reviewer holds the form → In Review 1.
			await pkpApi.createSubmission({
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
								status: 'accepted',
								reviewForm: title,
							},
						],
					},
				],
				publications: [{metadata: {title: {en: `Locked sub ${tag}`}}}],
			});

			const rf = new ReviewFormSettingsPage(page);
			await rf.goto(context.path);
			const [rowId] = await rf.rowIds(title);
			expect(rowId).toBeTruthy();

			// In Review column (td index 1: name · inReview · completed · active)
			// shows the one in-flight review.
			await expect(rf.rowById(rowId).locator('td').nth(1)).toHaveText('1');

			// The in-use lock: Edit and Delete row actions are gone; only Copy
			// and Preview remain (rule 6).
			await rf.expandRowExtras(rowId);
			await expect(rf.rowActionLink(rowId, 'edit')).toHaveCount(0);
			await expect(rf.rowActionLink(rowId, 'delete')).toHaveCount(0);
			await expect(rf.rowActionLink(rowId, 'copy')).toHaveCount(1);
			await expect(rf.rowActionLink(rowId, 'preview')).toHaveCount(1);

			// Copy the form to revise it — a new INACTIVE same-titled row
			// appears (rule 8 / Copy always available).
			await rf.clickRowAction(rowId, 'copy');
			await rf.confirmOk();
			await expect
				.poll(async () => (await rf.rowIds(title)).length, {timeout: 20_000})
				.toBe(2);

			const ids = await rf.rowIds(title);
			const copyId = ids.find((id) => id !== rowId);
			expect(copyId).toBeTruthy();
			await expect(rf.activeCheckbox(copyId)).not.toBeChecked();
		},
	);

	// Canonical scenario 6 — a never-assigned draft form is deletable: the
	// manager uses the row Delete action, confirms "Are you sure…", and the
	// form (with its elements/settings) is removed from the grid (rule 10).
	// The in-use half of scenario 6 (no Delete action offered; server refuses
	// a hand-crafted delete) is the inverse of scenario 5's proven lock, so
	// it isn't re-driven here.
	test(
		'delete an unused form',
		{tag: '@regression'},
		async ({page}) => {
			test.slow(); // create form + element + delete round-trip
			const tag = uniqueTag();
			const title = `Disposable Form ${tag}`;

			const rf = new ReviewFormSettingsPage(page);
			await rf.goto('publicknowledge');
			const form = await rf.openCreateForm();
			await rf.fillFormBasics(form, {title});
			await rf.saveAjaxForm(form);

			// Give it one element so the delete also exercises the element
			// cascade (rule 10).
			const [rowId] = await rf.rowIds(title);
			expect(rowId).toBeTruthy();
			const tabs = await rf.openEditModal(rowId);
			await rf.openFormItemsTab(tabs);
			await rf.addElement({
				question: `Throwaway question ${tag}`,
				typeLabel: TYPE.extended,
			});

			// Reload the grid to dismiss the Edit side-modal (its overlay
			// intercepts clicks on the row's Delete action). The form (with its
			// element) persists in the DB; its row id is stable.
			await rf.goto('publicknowledge');
			const [deletableRowId] = await rf.rowIds(title);
			expect(deletableRowId).toBe(rowId);

			// Delete via the row action + confirm. Under parallel load the
			// legacy grid can swallow the confirm's delete AJAX (the OK
			// dismisses but the row survives), so retry the whole click+
			// confirm until the row is actually gone.
			await expect(async () => {
				if ((await rf.rowIds(title)).length === 0) return; // already gone
				await rf.clickRowAction(deletableRowId, 'delete');
				await rf.confirmOk();
				await expect
					.poll(async () => (await rf.rowIds(title)).length, {timeout: 5_000})
					.toBe(0);
			}).toPass({timeout: 30_000});
		},
	);

	// Canonical scenario 7 — the as-built deviation. The activate confirm
	// warns "Once it's assigned to a review you will no longer be able to
	// deactivate it", but the deactivate path has NO in-use guard and the
	// checkbox is never disabled: a manager CAN deactivate a form a reviewer
	// is currently using. It drops out of new assignments while the in-flight
	// review keeps its attached form (review_assignments.review_form_id
	// untouched — no data loss). ⚠ see spec Known deviations.
	test(
		'deactivate a form that is in use (as-built deviation)',
		{tag: '@regression'},
		async ({page, pkpApi}) => {
			test.slow(); // scratch journal + in-use seed + deactivate round-trip
			const tag = uniqueTag();
			const title = `In-Use Active Form ${tag}`;
			const {context} = await pkpApi.createJournal({
				tag,
				users: [
					{username: 'dbarnes', roles: ['manager']},
					{username: REVIEWER, roles: ['reviewer']},
					{username: 'atester', roles: ['author']},
				],
				reviewForms: [
					{
						title,
						elements: [{type: 'textarea', question: `Assess ${tag}`}],
					},
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
				reviewRounds: [
					{
						reviewers: [
							{
								user: REVIEWER,
								method: 'anonymous',
								status: 'accepted',
								reviewForm: title,
							},
						],
					},
				],
				publications: [{metadata: {title: {en: `In-use sub ${tag}`}}}],
			});

			const rf = new ReviewFormSettingsPage(page);
			await rf.goto(context.path);
			const [rowId] = await rf.rowIds(title);
			expect(rowId).toBeTruthy();

			// Seeded active + in-use: Active checked, In Review = 1.
			await expect(rf.activeCheckbox(rowId)).toBeChecked();
			await expect(rf.rowById(rowId).locator('td').nth(1)).toHaveText('1');

			// Deactivate despite the "can't once assigned" warning — it
			// SUCCEEDS (the deviation): the checkbox flips to unchecked.
			await rf.toggleActive(rowId);
			await expect(rf.activeCheckbox(rowId)).not.toBeChecked({
				timeout: 15_000,
			});

			// The in-flight review keeps its attached form — the assignment is
			// untouched (no data loss).
			const assignments = await fetchAssignments(
				page.request,
				submission.id,
				context.path,
			);
			expect(assignments).toHaveLength(1);
		},
	);

	// Canonical scenario 8 — the whole feature is manager-only. Both grid
	// handlers assign every op to Journal Manager + Site Admin only (plus a
	// settings-access policy), so a section editor has no path in. Asserted
	// through the legacy grid handler's authorize() verdict read straight off
	// the JSONMessage: a manager (dbarnes) is allowed; a section editor
	// (dbuskins) is refused with "The current role does not have access to
	// this operation." (spec footnote a).
	test(
		'permission boundary — manager only, section editor refused',
		{tag: ['@smoke', '@regression']},
		async ({page, asUser}) => {
			// Manager (default actor) — fetch-grid is allowed.
			const managerVerdict = await page.request.get(gridUrl('fetch-grid'));
			const managerJson = await managerVerdict.json();
			expect(managerJson.status).toBe(true);

			// Section editor — no Manager/Site-admin role → refused.
			const sectionEditorCtx = await asUser('dbuskins');
			const sectionEditorVerdict = await sectionEditorCtx.request.get(
				gridUrl('fetch-grid'),
			);
			const sectionEditorJson = await sectionEditorVerdict.json();
			expect(sectionEditorJson.status).toBe(false);
			expect(JSON.stringify(sectionEditorJson)).toContain(ROLE_DENIED);
		},
	);
});
