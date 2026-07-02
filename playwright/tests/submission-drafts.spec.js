// @ts-check
const {test, expect} = require('../support/fixtures.js');
const {
	SubmissionWizardPage,
} = require('../../lib/pkp/playwright/pages/SubmissionWizardPage.js');
const {
	DashboardPage,
} = require('../../lib/pkp/playwright/pages/DashboardPage.js');

/**
 * Submission drafts — one test per canonical scenario of
 * docs/product/specs/submission-drafts.md (6 scenarios).
 *
 * Placement: OJS root (publicknowledge sections and the journal
 * dashboards are journal concepts), even though save-for-later itself
 * ships from pkp-lib.
 *
 * Seeding notes:
 *   - Wizard-resumable drafts come from the scenario endpoint with an
 *     explicit `submitted: false` (submissionProgress = 'start', no
 *     dateSubmitted) and `participants: []`.
 *   - The "submitted" shape (scenario 6) omits the `submitted` key with
 *     no decisions/reviewRounds — dateSubmitted stamped, progress ''.
 *   - Titles are ALWAYS locale maps ({en: ...}) — plain strings corrupt
 *     the dashboard views.
 *
 * The API-only un-submit hazard (ledger row 65) is deliberately NOT
 * exercised here — scenario 6 asserts the UI-level reality only.
 *
 * Parallel-safety: tags are single hyphenless alphanumeric tokens, the
 * saved-for-later email to the shared atester inbox is scoped with
 * pkpMail.find({to, contains: tag}) (the tag rides in the draft title,
 * which the mail body quotes), and list assertions are tag-scoped
 * presence/absence, never counts.
 */

const ROLE_DENIED =
	'The current role does not have access to this operation.';
const NOT_FOUND = 'The requested resource was not found.';
const BULK_DELETE_LABEL = 'Delete Incomplete Submissions';

function uniqueTag() {
	const workerIndex = test.info().parallelIndex;
	const suffix = Math.random().toString(36).slice(2, 8);
	return `sdr${workerIndex}x${suffix}`;
}

/**
 * Wizard-resumable draft owned by atester on publicknowledge with no
 * assigned participants (submissionProgress = 'start').
 *
 * @param {{tag: string, title: string}} opts
 */
function draftSpec({tag, title}) {
	return {
		tag,
		journal: 'publicknowledge',
		submitter: 'atester',
		section: 'ART',
		locale: 'en',
		submitted: false,
		participants: [],
		publications: [{metadata: {title: {en: title}}}],
	};
}

/**
 * Submitted-shaped stage-1 submission by atester (dateSubmitted set,
 * submissionProgress '') — the scenario endpoint's legacy shape when
 * the `submitted` key is omitted with no decisions/reviewRounds.
 *
 * @param {{tag: string, title: string}} opts
 */
function submittedSpec({tag, title}) {
	return {
		tag,
		journal: 'publicknowledge',
		submitter: 'atester',
		section: 'ART',
		locale: 'en',
		participants: [],
		publications: [{metadata: {title: {en: title}}}],
	};
}

/**
 * The current user's CSRF token, read from any mounted backend page.
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
 * Fetch a submission via REST with the page's session; returns the
 * response (callers assert ok/status themselves).
 *
 * @param {import('@playwright/test').Page} page
 * @param {number} submissionId
 */
function fetchSubmission(page, submissionId) {
	return page.request.get(
		`/index.php/publicknowledge/api/v1/submissions/${submissionId}`,
	);
}

/**
 * Enable the dashboard's bulk-delete selection mode: More Actions →
 * Delete Incomplete Submissions. Selection resets whenever the view /
 * search / filters change, so call this AFTER scoping the list.
 *
 * @param {import('@playwright/test').Page} page
 */
async function enableBulkDeleteSelection(page) {
	await page
		.getByRole('button', {name: 'More Actions', exact: true})
		.click();
	await page.getByRole('menuitem', {name: BULK_DELETE_LABEL}).click();
}

/**
 * Tick a row's bulk-delete checkbox. The Checkbox input is sr-only
 * (styled via a sibling span), so actionability's visible check never
 * passes — force the check and assert the state instead.
 *
 * @param {import('@playwright/test').Locator} row
 */
async function tickBulkDeleteCheckbox(row) {
	const checkbox = row.getByRole('checkbox');
	await expect(checkbox).toBeAttached({timeout: 10_000});
	await checkbox.check({force: true});
	await expect(checkbox).toBeChecked();
}

/**
 * Click the Delete Incomplete Submissions button, confirm the
 * "…cannot be undone" dialog and wait for the bulk DELETE to land
 * (useFetch tunnels DELETE via POST + X-Http-Method-Override).
 *
 * @param {import('@playwright/test').Page} page
 */
async function confirmBulkDelete(page) {
	await page
		.getByRole('button', {name: BULK_DELETE_LABEL, exact: true})
		.click();
	const dialog = page
		.getByRole('dialog')
		.filter({hasText: 'Confirm Delete of Incomplete Submissions'});
	await expect(dialog).toContainText(
		'Are you sure you want to delete the selected items? This action cannot be undone.',
	);
	await Promise.all([
		page.waitForResponse(
			(res) =>
				res.url().includes('/api/v1/_submissions') &&
				['POST', 'DELETE'].includes(res.request().method()) &&
				res.ok(),
			{timeout: 20_000},
		),
		dialog.getByRole('button', {name: 'Confirm', exact: true}).click(),
	]);
	await expect(dialog).toHaveCount(0, {timeout: 10_000});
}

/**
 * Search the dashboard list and wait for the tag-scoped fetch to land,
 * bounding subsequent absence assertions deterministically.
 *
 * @param {import('@playwright/test').Page} page
 * @param {DashboardPage} dashboard
 * @param {string} token
 */
async function searchAndSettle(page, dashboard, token) {
	await Promise.all([
		page.waitForResponse(
			(res) =>
				res.url().includes('/api/v1/_submissions') &&
				res.url().includes(`searchPhrase=${token}`) &&
				res.ok(),
			{timeout: 20_000},
		),
		dashboard.search(token),
	]);
}

test.use({user: 'atester'});

test.describe('Submission drafts', () => {
	// Canonical scenario 1 — atester starts a submission, advances to
	// Details, clicks Save for Later: the Saved-for-Later page repeats
	// the link and names the email address; the progress marker records
	// 'details'; the "Resume your submission" email arrives from the
	// journal contact; its link reopens the wizard at Details.
	test(
		'save for later, get the email, resume where you left off',
		{tag: ['@smoke', '@regression']},
		async ({page, pkpMail}) => {
			const tag = uniqueTag();
			const title = `Parked ${tag}`;

			const wizard = new SubmissionWizardPage(page);
			await wizard.goto();
			await wizard.start({title, locale: 'English', section: 'Articles'});
			const submissionId = wizard.currentSubmissionId();
			expect(submissionId).toBeTruthy();

			// Advance to the Details step, then park the draft.
			await wizard.expectStep('Upload Files');
			await wizard.continueStep();
			await wizard.expectStep('Details');
			await wizard.saveForLater();

			// The Saved for Later page shows the email used and repeats
			// the resume link (author short string — title).
			await expect(
				page.getByText(
					'We have emailed a copy of this link to you at atester@mailinator.com.',
				),
			).toBeVisible();
			await expect(
				page.getByRole('link', {name: new RegExp(tag)}),
			).toHaveAttribute(
				'href',
				new RegExp(`/submission\\?id=${submissionId}$`),
			);

			// Save for Later stamped the last-started step.
			const subRes = await fetchSubmission(page, Number(submissionId));
			expect(subRes.ok()).toBeTruthy();
			expect((await subRes.json()).submissionProgress).toBe('details');

			// The resume email: to the saver, from the journal contact.
			const [message] = await pkpMail.find({
				to: 'atester@mailinator.com',
				contains: tag,
				subject: 'Resume your submission',
				timeoutMs: 30_000,
			});
			expect(message.Subject).toBe(
				'Resume your submission to Journal of Public Knowledge',
			);
			expect(message.From.Address).toBe('rvaca@mailinator.com');
			expect(message.From.Name).toBe('Ramiro Vaca');

			// Its link (anchor text quotes the tagged title) reopens the
			// wizard at the saved Details step.
			const full = await pkpMail.fullMessage(message.ID);
			const resumeLink = pkpMail.extractLink(full.HTML, tag);
			expect(resumeLink).toContain(`/submission?id=${submissionId}`);
			await page.goto(resumeLink);
			await expect(page.locator('.submissionWizard')).toBeVisible({
				timeout: 20_000,
			});
			await wizard.expectStep('Details');
			await expect(page).toHaveURL(/#details$/);
		},
	);

	// Canonical scenario 2 — a seeded draft waits under Incomplete
	// submissions with the "Incomplete" stage and a Complete-submission
	// action (no View button); the action reopens the wizard at the
	// saved step (progress 'start' → the first step).
	test(
		'the draft waits in the Incomplete list and reopens from there',
		{tag: '@regression'},
		async ({page, pkpApi}) => {
			const tag = uniqueTag();
			const title = `Waiting ${tag}`;
			const {submission} = await pkpApi.createSubmission(
				draftSpec({tag, title}),
			);

			const dashboard = new DashboardPage(page);
			await dashboard.gotoMySubmissions({view: 'incomplete-submissions'});
			await expect(
				dashboard.viewHeading(/Incomplete submissions/),
			).toBeVisible({timeout: 20_000});
			await dashboard.search(tag);

			// Its own stage — "Incomplete" — with the Complete-submission
			// action instead of stage activity, and no workflow View
			// button (a draft has no workflow yet).
			const row = dashboard.row(title).first();
			await expect(row).toBeVisible({timeout: 20_000});
			await expect(row.getByText('Incomplete', {exact: true})).toBeVisible();
			const completeButton = row.getByRole('button', {
				name: 'Complete submission',
			});
			await expect(completeButton).toBeVisible();
			await expect(
				row.getByRole('button', {name: 'View', exact: true}),
			).toHaveCount(0);

			// Complete submission routes to /submission?id=N and the
			// wizard reopens at the recorded step ('start' → step 1).
			await completeButton.click();
			await page.waitForURL(
				new RegExp(`/submission\\?id=${submission.id}`),
				{timeout: 20_000, waitUntil: 'commit'},
			);
			await expect(page.locator('.submissionWizard')).toBeVisible({
				timeout: 20_000,
			});
			const wizard = new SubmissionWizardPage(page);
			await wizard.expectStep('Upload Files');
		},
	);

	// Canonical scenario 3 — the author's own bulk tool: More Actions →
	// Delete Incomplete Submissions, tick one draft, confirm the
	// cannot-be-undone dialog; the row disappears, the sibling draft
	// stays, and the deleted draft's wizard URL 404s (cascade delete).
	test(
		'author deletes their own abandoned draft (bulk tool)',
		{tag: '@regression'},
		async ({page, pkpApi}) => {
			const tag = uniqueTag();
			const goneTitle = `Bulkgone ${tag}`;
			const keepTitle = `Bulkkeep ${tag}`;
			const {submission: gone} = await pkpApi.createSubmission(
				draftSpec({tag, title: goneTitle}),
			);
			await pkpApi.createSubmission(draftSpec({tag, title: keepTitle}));

			const dashboard = new DashboardPage(page);
			await dashboard.gotoMySubmissions({view: 'incomplete-submissions'});
			await dashboard.search(tag);
			await expect(dashboard.row(goneTitle)).toBeVisible({
				timeout: 20_000,
			});
			await expect(dashboard.row(keepTitle)).toBeVisible({
				timeout: 20_000,
			});

			// Enable selection mode AFTER scoping — a search change resets
			// the selection.
			await enableBulkDeleteSelection(page);
			await tickBulkDeleteCheckbox(dashboard.row(goneTitle));
			await confirmBulkDelete(page);

			// The deleted draft leaves the list; its sibling stays.
			await expect(dashboard.row(goneTitle)).toHaveCount(0, {
				timeout: 20_000,
			});
			await expect(dashboard.row(keepTitle)).toBeVisible();

			// Deletion is permanent — the old wizard URL is a 404.
			const res = await page.request.get(
				`/index.php/publicknowledge/submission?id=${gone.id}`,
			);
			expect(res.status()).toBe(404);
		},
	);

	// Canonical scenario 4 — dbarnes (manager-level editor) meets the
	// draft in the editorial Active view (stage Incomplete) and deletes
	// it through the bulk tool; dbuskins (plain section editor) neither
	// sees the unassigned draft nor gets the affordance, and the
	// endpoint refuses him at the door.
	test(
		'manager clears any draft; section editor cannot',
		{tag: '@regression'},
		async ({pkpApi, asUser}) => {
			const tag = uniqueTag();
			const title = `Managerbait ${tag}`;
			const {submission} = await pkpApi.createSubmission(
				draftSpec({tag, title}),
			);
			const bulkDeleteUrl = `/index.php/publicknowledge/api/v1/_submissions?ids[]=${submission.id}`;

			// dbuskins: the unassigned draft is invisible in his Active
			// view and no bulk-delete affordance renders for sub-editors.
			const seCtx = await asUser('dbuskins');
			const sePage = await seCtx.newPage();
			const seDashboard = new DashboardPage(sePage);
			await seDashboard.gotoEditorial({view: 'active'});
			await expect(seDashboard.viewHeading(/Active/)).toBeVisible({
				timeout: 20_000,
			});
			await searchAndSettle(sePage, seDashboard, tag);
			await expect(seDashboard.row(tag)).toHaveCount(0);
			await expect(
				sePage.getByRole('button', {name: 'More Actions', exact: true}),
			).toHaveCount(0);

			// …and the endpoint refuses the role outright (unauthorized
			// API calls answer 401, not 403 — patterns.md wave-2 note).
			const denied = await sePage.request.delete(bulkDeleteUrl, {
				headers: {'X-Csrf-Token': await csrfToken(sePage)},
			});
			expect(denied.status()).toBe(401);
			expect(await denied.text()).toContain(ROLE_DENIED);

			// dbarnes: the draft is folded into Active with the Incomplete
			// stage and Complete-submission action…
			const edCtx = await asUser('dbarnes');
			const edPage = await edCtx.newPage();
			const edDashboard = new DashboardPage(edPage);
			await edDashboard.gotoEditorial({view: 'active'});
			await edDashboard.search(tag);
			const row = edDashboard.row(title).first();
			await expect(row).toBeVisible({timeout: 20_000});
			await expect(row.getByText('Incomplete', {exact: true})).toBeVisible();
			await expect(
				row.getByRole('button', {name: 'Complete submission'}),
			).toBeVisible();

			// …and the manager deletes another user's draft.
			await enableBulkDeleteSelection(edPage);
			await tickBulkDeleteCheckbox(row);
			await confirmBulkDelete(edPage);
			await expect(edDashboard.row(title)).toHaveCount(0, {
				timeout: 20_000,
			});

			// Gone for real.
			const after = await edPage.request.get(
				`/index.php/publicknowledge/api/v1/submissions/${submission.id}`,
			);
			expect(after.status()).toBe(404);
		},
	);

	// Canonical scenario 5 — Save for Later on the Reviewer Suggestions
	// step writes 'reviewerSuggestions' (a value OUTSIDE the schema
	// whitelist; a normal edit with the same value is rejected) and
	// resume still reopens on that step.
	test(
		'resume-at-saved-step across steps (whitelist bypass)',
		{tag: '@regression'},
		async ({page}) => {
			const tag = uniqueTag();
			const title = `Stepsaver ${tag}`;

			const wizard = new SubmissionWizardPage(page);
			await wizard.goto();
			await wizard.start({title, locale: 'English', section: 'Articles'});
			const submissionId = wizard.currentSubmissionId();
			expect(submissionId).toBeTruthy();

			// Walk to Reviewer Suggestions (step 5 of 6 on publicknowledge)
			// — validation only bites at Review, so no fields needed.
			await wizard.expectStep('Upload Files');
			await wizard.continueStep();
			await wizard.expectStep('Details');
			await wizard.continueStep();
			await wizard.expectStep('Contributors');
			await wizard.continueStep();
			await wizard.expectStep('For the Editors');
			await wizard.continueStep();
			await wizard.expectStep('Reviewer Suggestions');

			// Grab the CSRF token while the backend page is mounted.
			const token = await csrfToken(page);
			await wizard.saveForLater();

			// The step token is stored verbatim…
			const subRes = await fetchSubmission(page, Number(submissionId));
			expect(subRes.ok()).toBeTruthy();
			expect((await subRes.json()).submissionProgress).toBe(
				'reviewerSuggestions',
			);

			// …even though the schema whitelist rejects the same value on
			// a normal edit (the save-for-later seam, spec rule 2).
			const put = await page.request.put(
				`/index.php/publicknowledge/api/v1/submissions/${submissionId}`,
				{
					headers: {'X-Csrf-Token': token},
					data: {submissionProgress: 'reviewerSuggestions'},
				},
			);
			expect(put.status()).toBe(400);
			expect(await put.text()).toContain('submissionProgress');

			// Resume reopens on the Reviewer Suggestions step.
			await page.goto(
				`/index.php/publicknowledge/submission?id=${submissionId}`,
			);
			await expect(page.locator('.submissionWizard')).toBeVisible({
				timeout: 20_000,
			});
			await wizard.expectStep('Reviewer Suggestions');
			await expect(page).toHaveURL(/#reviewerSuggestions$/);
		},
	);

	// Canonical scenario 6 — a submitted submission is out of reach: not
	// in the Incomplete list, no Complete-submission action (real stage,
	// not "Incomplete"), the bulk tool's menu item is disabled when the
	// view holds nothing deletable, its wizard URL routes to the
	// complete screen, and the endpoint 404s it — alone or mixed into a
	// batch with a real draft (which survives).
	test(
		'submitted submissions are out of reach',
		{tag: '@regression'},
		async ({page, pkpApi}) => {
			const tag = uniqueTag();
			// Single-token titles: `Done${tag}` scopes a search to ONLY the
			// submitted row (the bulk menu item's disabled state is
			// computed over the rows in view).
			const doneTitle = `Done${tag}`;
			const openTitle = `Open${tag}`;
			const {submission: done} = await pkpApi.createSubmission(
				submittedSpec({tag, title: doneTitle}),
			);
			const {submission: open} = await pkpApi.createSubmission(
				draftSpec({tag, title: openTitle}),
			);

			const dashboard = new DashboardPage(page);

			// Not offered in the Incomplete list (the control draft bounds
			// the absence assertion).
			await dashboard.gotoMySubmissions({view: 'incomplete-submissions'});
			await searchAndSettle(page, dashboard, tag);
			await expect(dashboard.row(openTitle)).toBeVisible({
				timeout: 20_000,
			});
			await expect(dashboard.row(doneTitle)).toHaveCount(0);

			// In Active submissions its row is a real submission: no
			// "Incomplete" stage, no Complete-submission action.
			await dashboard.gotoMySubmissions({view: 'active'});
			await expect(
				dashboard.viewHeading(/Active submissions/),
			).toBeVisible({timeout: 20_000});
			await dashboard.search(doneTitle);
			const doneRow = dashboard.row(doneTitle).first();
			await expect(doneRow).toBeVisible({timeout: 20_000});
			await expect(
				doneRow.getByText('Incomplete', {exact: true}),
			).toHaveCount(0);
			await expect(
				doneRow.getByRole('button', {name: 'Complete submission'}),
			).toHaveCount(0);

			// With only the submitted row in view, the bulk tool has
			// nothing deletable — the menu item is disabled.
			await page
				.getByRole('button', {name: 'More Actions', exact: true})
				.click();
			await expect(
				page.getByRole('menuitem', {name: BULK_DELETE_LABEL}),
			).toBeDisabled();
			await page.keyboard.press('Escape');

			// The endpoint refuses it: alone (not found among incomplete
			// drafts) and as part of a mixed batch (whole batch refused).
			const token = await csrfToken(page);
			const apiBase = '/index.php/publicknowledge/api/v1/_submissions';
			const aloneRes = await page.request.delete(
				`${apiBase}?ids[]=${done.id}`,
				{headers: {'X-Csrf-Token': token}},
			);
			expect(aloneRes.status()).toBe(404);
			expect(await aloneRes.text()).toContain(NOT_FOUND);

			const mixedRes = await page.request.delete(
				`${apiBase}?ids[]=${done.id}&ids[]=${open.id}`,
				{headers: {'X-Csrf-Token': token}},
			);
			expect(mixedRes.status()).toBe(404);

			// Nothing was deleted — not even the eligible draft in the
			// refused batch.
			expect((await fetchSubmission(page, done.id)).ok()).toBeTruthy();
			expect((await fetchSubmission(page, open.id)).ok()).toBeTruthy();

			// The wizard URL routes to the "Submission complete" screen,
			// never back into the wizard.
			await page.goto(
				`/index.php/publicknowledge/submission?id=${done.id}`,
			);
			await expect(
				page.getByRole('heading', {name: 'Submission complete'}),
			).toBeVisible({timeout: 20_000});
			await expect(page.locator('.submissionWizard')).toHaveCount(0);
		},
	);
});
