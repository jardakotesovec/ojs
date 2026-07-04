// @ts-check
const {test, expect} = require('../support/fixtures.js');

/**
 * Publication — Issue assignment & scheduling (the workflow Publication → Issue
 * tab, labelled "Publication Settings"). One test per canonical scenario of
 * docs/product/specs/publication-issue-assignment.md (6 scenarios; scenarios
 * 4 "section + categories" and 5 "cover/pages/URL path" merged into one
 * placement-fields test → 5 tests).
 *
 * As-built reality these tests DRIVE LIVE (the spec author verified the backend
 * via the API but never rendered the Issue-tab controls; these tests render the
 * radio + picker in a real browser):
 *   - The Issue tab (OJS IssueEntryForm, PHP form id `issueEntry`) has a REQUIRED
 *     "Issue Assignment" radio INJECTED client-side by the shared composable
 *     useWorkflowPublicationFormIssue (only when the journal has ≥1 issue). Its
 *     four options come from GET /issues/assignmentOptions, filtered to those an
 *     issue exists for:
 *       (1) "Don't Assign To An Issue"                         → no picker, status 6
 *       (2) "Assign To Future Issue and Publish Immediately"   → unpublished picker, status 6
 *       (3) "Assign To Future Issue and Schedule Only"         → unpublished picker, status 7
 *       (4) "Assign To Current/Back Issue"                     → published picker, status 6
 *     publicknowledge has both a published (Vol 1 No 2 2014) and an unpublished
 *     (Vol 2 No 1 2015) issue, so all four render.
 *   - The Issue picker (#issueEntry-issueId-control, a FieldSelect) is required
 *     when an issue-requiring option is chosen; its options are the journal's
 *     issues filtered to the option's publish state (GET /issues?isPublished=0|1).
 *   - Section (#issueEntry-sectionId-control), Categories (FieldAutosuggestPreset
 *     driven through the "Select Categories" side-modal checkboxes), Pages
 *     (#issueEntry-pages-control) and URL Path (#issueEntry-urlPath-control) all
 *     save on the shared publication PUT. categoryIds persists despite a
 *     `readOnly` schema flag (a deliberate publication-DAO special-case).
 *   - The tab is editorial/production-only: an author never sees it and the form
 *     endpoint refuses the author (live 401 — the campaign-wide
 *     authenticated-but-unauthorized-role baseline). The form HONOURS the
 *     published-lock: a manager/editor is warn-not-locked on a published version.
 *
 * ⚠ THE row-94 deviation this spec probes live (spec rule 11 / Known deviations):
 *   The assignment radio's options are filtered by issue existence, NOT by role,
 *   so a section editor / assistant is OFFERED the two "Assign To Future Issue…"
 *   options — but the picker that fulfils them fetches GET /issues?isPublished=0,
 *   which restricts unpublished issues to managers/site-admins (403
 *   "You do not have permission to view unpublished issues."). Test 2 drives BOTH
 *   sides: (a) a MANAGER (dbarnes → Journal-editor group = ROLE_ID_MANAGER)
 *   completes a future-issue schedule; (b) a SECTION EDITOR (dbuskins →
 *   ROLE_ID_SUB_EDITOR) sees the future option, picks it, and gets a network-error
 *   dialog + an empty, un-fillable picker — the assignment cannot be completed.
 *
 * Placement: OJS root — issues, the IssueEntryForm, the IssueAssignment enum and
 * the /issues assignment-options + list endpoints are all OJS concepts (the host
 * publication form + edit endpoint are pkp-lib, but the placement surface is OJS).
 *
 * Parallel-safety: tags are single hyphenless alphanumeric tokens; publicknowledge
 * stays read-only (only fresh submissions are added — never a mutated issue/user);
 * every persistence assertion reads the value back through the publication REST
 * API (issueId, status, categoryIds, pages, urlPath, sectionId). No Mailpit use.
 */

const STATUS_PUBLISHED = 3; // PKPSubmission::STATUS_PUBLISHED
const STATUS_READY_TO_PUBLISH = 6; // Publication::STATUS_READY_TO_PUBLISH
const STATUS_READY_TO_SCHEDULE = 7; // Publication::STATUS_READY_TO_SCHEDULE

// IssueAssignment enum labels (locale/en/submission.po). getByRole('radio', …).
const ASSIGN_NONE = "Don't Assign To An Issue";
const ASSIGN_FUTURE_PUBLISH = 'Assign To Future Issue and Publish Immediately';
const ASSIGN_FUTURE_SCHEDULE = 'Assign To Future Issue and Schedule Only';
const ASSIGN_CURRENT_BACK = 'Assign To Current/Back Issue';

// The 403 the unpublished-issue list returns to a non-manager (row 94). Rendered
// by useFetch's network-error dialog when the section editor picks a future option.
const UNPUBLISHED_ISSUES_FORBIDDEN =
	'You do not have permission to view unpublished issues.';

// EDITORIAL published-version banner (warn-not-lock) — prepended to every
// publication panel on a published version.
const EDITOR_EDIT_WARNING =
	'Warning: This version has been published. Editing it may impact the published content.';

/** A unique, hyphenless, alphanumeric tag (parallel isolation). */
function uniqueTag() {
	const workerIndex = test.info().parallelIndex;
	const suffix = Math.random().toString(36).slice(2, 8);
	return `pia${workerIndex}x${suffix}`;
}

/** The workflow side modal (outer wrapper reports visibility:hidden — scope only). */
function workflowModal(page) {
	return page.locator('[data-cy="active-modal"]').first();
}

/**
 * A submitted stage-1 submission. `dbarnes` (Journal-editor group =
 * ROLE_ID_MANAGER) is the default deciding editor; extra participants can be
 * added (e.g. a section editor for the row-94 probe).
 */
function submittedSpec({
	tag,
	title,
	journal = 'publicknowledge',
	submitter = 'atester',
	participants = [{user: 'dbarnes', role: 'editor'}],
}) {
	return {
		tag,
		journal,
		submitter,
		section: 'ART',
		locale: 'en',
		participants,
		publications: [{metadata: {title: {en: title}}}],
	};
}

/**
 * A VoR-published submission assigned to publicknowledge's published issue
 * (Vol 1 No 2 2014). dbarnes edits it as a manager (canChangeMetadata).
 */
function publishedSpec({
	tag,
	title,
	journal = 'publicknowledge',
	issue = {volume: 1, number: 2, year: 2014},
	participants = [{user: 'dbarnes', role: 'editor', canChangeMetadata: true}],
}) {
	return {
		tag,
		journal,
		submitter: 'atester',
		section: 'ART',
		locale: 'en',
		participants,
		decisions: [
			{type: 'skipExternalReview', by: 'dbarnes'},
			{type: 'sendToProduction', by: 'dbarnes'},
		],
		publications: [
			{
				versionStage: 'VoR',
				metadata: {title: {en: title}},
				issue,
				published: true,
			},
		],
	};
}

/** Resolve the current publication id for a submission (page session). */
async function currentPublicationId(page, submissionId, journalPath) {
	const res = await page.request.get(
		`/index.php/${journalPath}/api/v1/submissions/${submissionId}`,
	);
	expect(res.ok(), `GET submission ${submissionId}`).toBeTruthy();
	return (await res.json()).currentPublicationId;
}

/** GET a submission's publication as JSON (page session). */
async function fetchPublication(page, submissionId, pubId, journalPath) {
	const res = await page.request.get(
		`/index.php/${journalPath}/api/v1/submissions/${submissionId}/publications/${pubId}`,
	);
	expect(res.ok(), `GET publication ${pubId}: ${res.status()}`).toBeTruthy();
	return res.json();
}

/**
 * GET the issues list filtered by publish state (page/context session). Managers
 * get 200 for both states; non-managers 403 on isPublished=0 (row 94).
 */
async function fetchIssuesList(ctx, journalPath, isPublished) {
	return ctx.request.get(
		`/index.php/${journalPath}/api/v1/issues?isPublished=${isPublished}&count=100`,
	);
}

/** The first issue matching a publish state, as the manager sees it. */
async function firstIssue(page, journalPath, isPublished) {
	const res = await fetchIssuesList(page, journalPath, isPublished);
	expect(res.ok(), `GET issues isPublished=${isPublished}: ${res.status()}`).toBeTruthy();
	const items = (await res.json()).items;
	expect(items.length, `≥1 issue with isPublished=${isPublished}`).toBeGreaterThan(0);
	return items[0];
}

/** The Issue-tab form config (to read section / category option ids + assignment options). */
async function issueFormConfig(page, submissionId, pubId, journalPath) {
	const res = await page.request.get(
		`/index.php/${journalPath}/api/v1/submissions/${submissionId}/publications/${pubId}/_components/issue`,
	);
	expect(res.status(), 'issue form GET').toBe(200);
	return res.json();
}

/** Read one field's config off the issue form. */
function issueField(formConfig, name) {
	return (formConfig.fields ?? []).find((f) => f.name === name);
}

/**
 * CSRF token from a loaded OJS page. window.pkp boots asynchronously under
 * `waitUntil:'commit'`, so wait for it before reading.
 */
async function getCsrf(page) {
	await page.waitForFunction(() => !!window.pkp?.currentUser?.csrfToken, null, {
		timeout: 20_000,
	});
	const token = await page.evaluate(() => window.pkp?.currentUser?.csrfToken);
	expect(token, 'csrf token from page').toBeTruthy();
	return token;
}

/** PUT a publication (tunnelled as POST + override, matching useFetch). */
async function putPublication(ctx, journalPath, submissionId, pubId, data, csrf) {
	return ctx.request.post(
		`/index.php/${journalPath}/api/v1/submissions/${submissionId}/publications/${pubId}`,
		{
			headers: {
				'X-Csrf-Token': csrf,
				'X-Http-Method-Override': 'PUT',
				'Content-Type': 'application/json',
			},
			data,
		},
	);
}

/** Deep-link the workflow onto a Publication pane (issue | metadata). */
function pubLink(journalPath, submissionId, pubId, name, author = false) {
	const dash = author ? 'mySubmissions' : 'editorial';
	return (
		`/index.php/${journalPath}/en/dashboard/${dash}` +
		`?workflowSubmissionId=${submissionId}` +
		`&workflowMenuKey=publication_${pubId}_${name}`
	);
}

/** The Issue-tab form (IssueEntryForm). */
function issueForm(page) {
	return page.locator('form.pkpForm', {
		has: page.locator('#issueEntry-sectionId-control'),
	});
}

/** The injected assignment radio, by option label. */
function assignmentRadio(page, name) {
	return page.getByRole('radio', {name, exact: true});
}

/** The injected issue picker (shown only for issue-requiring options). */
function issuePicker(page) {
	return page.locator('#issueEntry-issueId-control');
}

/** Open the Issue pane and wait for the injected radio + section field to mount. */
async function openIssueTab(page, journalPath, submissionId, pubId) {
	await page.goto(pubLink(journalPath, submissionId, pubId, 'issue'), {
		waitUntil: 'commit',
	});
	await expect(page.locator('#issueEntry-sectionId-control')).toBeVisible({
		timeout: 20_000,
	});
	// The radio is injected by the composable (issueCount > 0) — its presence is
	// the signal that the OJS placement surface rendered.
	await expect(assignmentRadio(page, ASSIGN_NONE)).toBeVisible({timeout: 20_000});
}

/** Pick a specific issue in the picker (waits for the option to load first). */
async function pickIssue(page, issueId) {
	await expect(
		issuePicker(page).locator(`option[value="${issueId}"]`),
	).toHaveCount(1, {timeout: 20_000});
	await issuePicker(page).selectOption(String(issueId));
}

/**
 * Click the Issue form's Save and wait for the publication PUT (tunnelled as
 * POST). Returns the response so the caller can assert the status.
 */
async function saveIssueForm(page, pubId) {
	const [response] = await Promise.all([
		page.waitForResponse(
			(res) =>
				new RegExp(`/publications/${pubId}(?:\\?|$)`).test(res.url()) &&
				res.request().method() === 'POST',
			{timeout: 20_000},
		),
		issueForm(page).getByRole('button', {name: 'Save', exact: true}).click(),
	]);
	return response;
}

test.use({user: 'dbarnes'}); // the assigned editor — a manager on publicknowledge

test.describe('Publication — Issue assignment & scheduling (Publication Settings tab)', () => {
	// Canonical scenario 1 — Assign to a current/back (published) issue. On a
	// queued submission the injected radio pre-selects "Assign To Current/Back
	// Issue" (rule 4); the manager selects the journal's published issue in the
	// picker and saves. The publication's issueId is set and its status staged
	// READY_TO_PUBLISH (6). A later Publish (publish-flow) makes it live in that
	// issue.
	test(
		'manager assigns to a current/back issue; issueId + ready-to-publish persist',
		{tag: ['@smoke', '@regression']},
		async ({page, pkpApi}) => {
			test.slow();
			const tag = uniqueTag();
			const {submission} = await pkpApi.createSubmission(
				submittedSpec({tag, title: `Current/Back ${tag}`}),
			);
			const pubId = await currentPublicationId(page, submission.id, 'publicknowledge');
			const publishedIssue = await firstIssue(page, 'publicknowledge', 1);

			await openIssueTab(page, 'publicknowledge', submission.id, pubId);

			// The radio pre-selects Current/Back (rule 4: queued + issues exist).
			await expect(assignmentRadio(page, ASSIGN_CURRENT_BACK)).toBeChecked();

			// The picker offers the published issue; select it explicitly.
			await pickIssue(page, publishedIssue.id);
			await expect(issuePicker(page)).toHaveValue(String(publishedIssue.id));

			const saveRes = await saveIssueForm(page, pubId);
			expect(saveRes.status(), await saveRes.text()).toBe(200);

			// issueId persisted + status staged ready-to-publish.
			await expect
				.poll(
					async () =>
						(await fetchPublication(page, submission.id, pubId, 'publicknowledge'))
							.issueId,
					{timeout: 20_000},
				)
				.toBe(publishedIssue.id);
			const pub = await fetchPublication(page, submission.id, pubId, 'publicknowledge');
			expect(pub.status).toBe(STATUS_READY_TO_PUBLISH);
		},
	);

	// Canonical scenario 2 (+ row-94 ⚠) — Schedule into a future issue. A MANAGER
	// picks "Assign To Future Issue and Schedule Only"; the picker now offers only
	// unpublished (future) issues; selecting one and saving stages status
	// READY_TO_SCHEDULE (7). Then the row-94 probe: a SECTION EDITOR sees the same
	// future option (assignment-options are role-blind) but the picker that fulfils
	// it (GET /issues?isPublished=0) is manager/admin-only → 403, so the section
	// editor gets an empty, un-fillable picker + a network-error dialog and cannot
	// complete the assignment.
	test(
		'manager schedules into a future issue; section editor sees the option but the picker is unfulfillable (row 94)',
		{tag: ['@smoke', '@regression']},
		async ({page, pkpApi, asUser}) => {
			test.slow();
			const tag = uniqueTag();
			// Submission A — the manager schedules it into a future issue.
			const {submission: subA} = await pkpApi.createSubmission(
				submittedSpec({tag, title: `Future issue ${tag}`}),
			);
			// Submission B — a FRESH (un-scheduled) submission the section editor can
			// reach; kept separate so the section editor's composable is not hitting
			// the future-issue 403 on load (only when they pick the option).
			const {submission: subB} = await pkpApi.createSubmission(
				submittedSpec({
					tag: `${tag}b`,
					title: `Future issue editor ${tag}`,
					participants: [
						{user: 'dbarnes', role: 'editor'},
						{user: 'dbuskins', role: 'sectionEditor', canChangeMetadata: true},
					],
				}),
			);
			const pubA = await currentPublicationId(page, subA.id, 'publicknowledge');
			const pubB = await currentPublicationId(page, subB.id, 'publicknowledge');
			const futureIssue = await firstIssue(page, 'publicknowledge', 0);

			// --- (a) Manager completes the future-issue schedule ---
			await openIssueTab(page, 'publicknowledge', subA.id, pubA);
			// Let the initial placement settle (Current/Back pre-selected + its picker
			// populated) BEFORE switching. The composable only stages the chosen
			// option's status once its initial-data-load pass has completed, so
			// switching too early leaves the status at ready-to-publish instead of
			// ready-to-schedule.
			await expect(assignmentRadio(page, ASSIGN_CURRENT_BACK)).toBeChecked();
			await expect(issuePicker(page).locator('option')).not.toHaveCount(0, {
				timeout: 20_000,
			});
			await assignmentRadio(page, ASSIGN_FUTURE_SCHEDULE).check();
			// The picker now lists the unpublished issue; select it.
			await pickIssue(page, futureIssue.id);
			const saveRes = await saveIssueForm(page, pubA);
			expect(saveRes.status(), await saveRes.text()).toBe(200);

			await expect
				.poll(
					async () =>
						(await fetchPublication(page, subA.id, pubA, 'publicknowledge'))
							.issueId,
					{timeout: 20_000},
				)
				.toBe(futureIssue.id);
			const pub = await fetchPublication(page, subA.id, pubA, 'publicknowledge');
			expect(pub.status).toBe(STATUS_READY_TO_SCHEDULE);

			// --- (b) Section editor: offered the option, but cannot fulfil it ---
			const editorCtx = await asUser('dbuskins');

			// The cross-surface disagreement, at the API: assignment options list all
			// four (incl. both future options) but the unpublished-issue list 403s.
			const optsRes = await editorCtx.request.get(
				`/index.php/publicknowledge/api/v1/issues/assignmentOptions`,
			);
			expect(optsRes.status(), 'section editor assignmentOptions').toBe(200);
			const optionLabels = (await optsRes.json()).map((o) => o.label);
			expect(optionLabels).toContain(ASSIGN_FUTURE_SCHEDULE);
			expect(optionLabels).toContain(ASSIGN_FUTURE_PUBLISH);

			const unpubRes = await fetchIssuesList(editorCtx, 'publicknowledge', 0);
			expect(unpubRes.status(), 'section editor unpublished issues').toBe(403);
			expect(await unpubRes.text()).toContain(UNPUBLISHED_ISSUES_FORBIDDEN);
			// …while the published-issue list is allowed.
			const pubRes = await fetchIssuesList(editorCtx, 'publicknowledge', 1);
			expect(pubRes.status(), 'section editor published issues').toBe(200);

			// The live UI consequence: the section editor opens the Issue tab, SEES
			// the future option, picks it, and gets the 403 network-error dialog +
			// an empty required picker — the assignment is un-completable.
			const editorPage = await editorCtx.newPage();
			await openIssueTab(editorPage, 'publicknowledge', subB.id, pubB);

			// The affordance is present (options are not role-filtered).
			await expect(assignmentRadio(editorPage, ASSIGN_FUTURE_SCHEDULE)).toBeVisible();
			await assignmentRadio(editorPage, ASSIGN_FUTURE_SCHEDULE).check();

			// The 403 surfaces as a network-error dialog…
			await expect(
				editorPage.getByText(UNPUBLISHED_ISSUES_FORBIDDEN),
			).toBeVisible({timeout: 20_000});
			// …and the required Issue picker has zero options (un-fillable).
			await expect(issuePicker(editorPage).locator('option')).toHaveCount(0, {
				timeout: 20_000,
			});
		},
	);

	// Canonical scenario 3 — Don't assign to an issue. Starting from an article
	// already assigned to the published issue, the editor picks "Don't Assign To
	// An Issue": the issue picker disappears and saving clears issueId (staging
	// ready-to-publish). Publishing then makes the article live with no issue
	// association (issue-less/continuous publication, owned by publish-flow).
	test(
		"don't assign to an issue clears issueId",
		{tag: ['@smoke', '@regression']},
		async ({page, pkpApi}) => {
			test.slow();
			const tag = uniqueTag();
			const {submission} = await pkpApi.createSubmission(
				submittedSpec({tag, title: `Issue-less ${tag}`}),
			);
			const pubId = await currentPublicationId(page, submission.id, 'publicknowledge');
			const publishedIssue = await firstIssue(page, 'publicknowledge', 1);

			// Seed the assigned state via the API so the UI test is purely about the
			// clear path.
			await page.goto('/index.php/publicknowledge/en/dashboard/editorial', {
				waitUntil: 'commit',
			});
			const csrf = await getCsrf(page);
			const seedRes = await putPublication(
				page,
				'publicknowledge',
				submission.id,
				pubId,
				{issueId: publishedIssue.id, status: STATUS_READY_TO_PUBLISH},
				csrf,
			);
			expect(seedRes.status(), await seedRes.text()).toBe(200);

			await openIssueTab(page, 'publicknowledge', submission.id, pubId);
			// The radio reflects the current placement (assigned → Current/Back) and
			// the picker shows the assigned issue.
			await expect(assignmentRadio(page, ASSIGN_CURRENT_BACK)).toBeChecked();
			await expect(issuePicker(page)).toHaveValue(String(publishedIssue.id));

			// Switch to Don't Assign — the picker disappears.
			await assignmentRadio(page, ASSIGN_NONE).check();
			await expect(issuePicker(page)).toBeHidden();

			const saveRes = await saveIssueForm(page, pubId);
			expect(saveRes.status(), await saveRes.text()).toBe(200);

			// issueId cleared; status staged ready-to-publish.
			await expect
				.poll(
					async () =>
						(await fetchPublication(page, submission.id, pubId, 'publicknowledge'))
							.issueId,
					{timeout: 20_000},
				)
				.toBeNull();
			const pub = await fetchPublication(page, submission.id, pubId, 'publicknowledge');
			expect(pub.status).toBe(STATUS_READY_TO_PUBLISH);
		},
	);

	// Canonical scenarios 4 + 5 (merged) — Placement fields. The editor sets the
	// Section, picks a Category through the "Select Categories" side-modal
	// checkboxes, and sets Pages + a custom URL Path, then saves. All persist on
	// the version — notably categoryIds persists despite its `readOnly` schema flag
	// (the DAO special-case). (Cover image is on this form too but its
	// upload/crop widget is not driven here — see file note in the return.)
	test(
		'assign section + categories (categoryIds persists despite readOnly) + pages + URL path',
		{tag: ['@smoke', '@regression']},
		async ({page, pkpApi}) => {
			test.slow();
			const tag = uniqueTag();
			const {submission} = await pkpApi.createSubmission(
				submittedSpec({tag, title: `Placement ${tag}`}),
			);
			const pubId = await currentPublicationId(page, submission.id, 'publicknowledge');

			// Resolve the section + category option ids off the live form config.
			const formConfig = await issueFormConfig(page, submission.id, pubId, 'publicknowledge');
			const sectionField = issueField(formConfig, 'sectionId');
			const artSectionId = sectionField.value; // the seeded ART section
			expect(artSectionId, 'section pre-set').toBeTruthy();
			const categoryField = issueField(formConfig, 'categoryIds');
			expect(categoryField, 'categoryIds field present (journal has categories)').toBeTruthy();
			const appliedScience = categoryField.options.find(
				(o) => o.label === 'Applied Science',
			);
			expect(appliedScience, 'Applied Science category option').toBeTruthy();

			await openIssueTab(page, 'publicknowledge', submission.id, pubId);

			// No issue needed for a placement-only save — satisfy the required radio.
			await assignmentRadio(page, ASSIGN_NONE).check();

			// Section: re-select the journal section explicitly (required field).
			await page
				.locator('#issueEntry-sectionId-control')
				.selectOption(String(artSectionId));

			// Categories: open the "Select Categories" side-modal, check a top-level
			// category, save the modal.
			await issueForm(page)
				.getByRole('button', {name: 'Select Categories'})
				.click();
			const catModal = page.getByRole('dialog', {name: 'Select Categories'});
			await expect(catModal).toBeVisible({timeout: 20_000});
			await catModal.getByRole('checkbox', {name: 'Applied Science'}).check();
			await catModal.getByRole('button', {name: 'Save', exact: true}).click();
			await expect(catModal).toBeHidden({timeout: 20_000});

			// Pages + URL Path.
			const pages = '12-24';
			const slug = `placement-${tag}`;
			await page.locator('#issueEntry-pages-control').fill(pages);
			await page.locator('#issueEntry-urlPath-control').fill(slug);

			const saveRes = await saveIssueForm(page, pubId);
			expect(saveRes.status(), await saveRes.text()).toBe(200);

			// All placement values persist on the version (server truth).
			await expect
				.poll(
					async () =>
						(await fetchPublication(page, submission.id, pubId, 'publicknowledge'))
							.pages,
					{timeout: 20_000},
				)
				.toBe(pages);
			const pub = await fetchPublication(page, submission.id, pubId, 'publicknowledge');
			expect(pub.urlPath).toBe(slug);
			expect(pub.sectionId).toBe(artSectionId);
			// categoryIds persisted despite the schema `readOnly` flag (rule 7).
			expect(pub.categoryIds).toContain(appliedScience.value);
		},
	);

	// Canonical scenario 6 — Published-lock (HONOURED, unlike Galleys) + author
	// boundary. On a PUBLISHED version a manager is warn-not-locked: the yellow
	// warning shows yet the assignment radio / picker / pages stay editable and an
	// edit persists behind the banner. An author never sees the Issue tab: the
	// form + assignment-status endpoints refuse the author (live 401) and the
	// author's Publication menu has no "Publication Settings" item.
	test(
		'published version: manager warn-not-locked (pages edit persists); author 401 + no Publication Settings tab',
		{tag: ['@smoke', '@regression']},
		async ({page, pkpApi, asUser}) => {
			test.slow();
			const tag = uniqueTag();
			const {submission, publications} = await pkpApi.createSubmission(
				publishedSpec({tag, title: `Published placement ${tag}`}),
			);
			const pubId = publications[0].id;
			expect(publications[0].status).toBe(STATUS_PUBLISHED);

			// --- Manager: warned, not locked ---
			await openIssueTab(page, 'publicknowledge', submission.id, pubId);
			await expect(
				workflowModal(page).getByText(EDITOR_EDIT_WARNING),
			).toBeVisible({timeout: 20_000});

			// The Issue controls stay editable behind the warning: the radio
			// reflects the published placement (Current/Back), the picker is enabled,
			// pages is editable and Save is enabled.
			await expect(assignmentRadio(page, ASSIGN_CURRENT_BACK)).toBeChecked();
			await expect(issuePicker(page)).toBeEnabled();
			await expect(page.locator('#issueEntry-pages-control')).toBeEnabled();
			await expect(
				issueForm(page).getByRole('button', {name: 'Save', exact: true}),
			).toBeEnabled();

			// A pages edit persists on the published version (warn-not-lock — the
			// Issue form HONOURS the lock, opposite of the Galleys manager).
			const pages = `77-88-${tag}`.slice(0, 20);
			await page.locator('#issueEntry-pages-control').fill(pages);
			const saveRes = await saveIssueForm(page, pubId);
			expect(saveRes.status(), await saveRes.text()).toBe(200);
			await expect
				.poll(
					async () =>
						(await fetchPublication(page, submission.id, pubId, 'publicknowledge'))
							.pages,
					{timeout: 20_000},
				)
				.toBe(pages);

			// --- Author: hard-locked out of the Issue tab entirely ---
			const authorCtx = await asUser('atester');
			// The form + assignment-status endpoints exclude ROLE_ID_AUTHOR — OJS
			// answers an authenticated-but-unauthorized role with 401 (patterns.md).
			const authorFormRes = await authorCtx.request.get(
				`/index.php/publicknowledge/api/v1/submissions/${submission.id}/publications/${pubId}/_components/issue`,
			);
			expect([401, 403]).toContain(authorFormRes.status());
			const authorStatusRes = await authorCtx.request.get(
				`/index.php/publicknowledge/api/v1/submissions/${submission.id}/publications/${pubId}/issueAssignmentStatus`,
			);
			expect([401, 403]).toContain(authorStatusRes.status());

			// And the author's Publication menu has no "Publication Settings" item.
			// Open the author-reachable Metadata pane so the nav renders.
			const authorPage = await authorCtx.newPage();
			await authorPage.goto(
				pubLink('publicknowledge', submission.id, pubId, 'metadata', true),
				{waitUntil: 'commit'},
			);
			const authorNav = workflowModal(authorPage).locator('nav');
			await expect(
				authorNav.getByText('Metadata', {exact: true}).first(),
			).toBeVisible({timeout: 20_000});
			await expect(
				authorNav.getByText('Publication Settings', {exact: true}),
			).toHaveCount(0);
		},
	);
});
