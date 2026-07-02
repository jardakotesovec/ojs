// @ts-check
const path = require('path');
const {test, expect} = require('../support/fixtures.js');
const {
	SubmissionWizardPage,
} = require('../../lib/pkp/playwright/pages/SubmissionWizardPage.js');
const {
	WorkflowSettingsPage,
} = require('../../lib/pkp/playwright/pages/WorkflowSettingsPage.js');
const {
	ReviewerManagerPage,
} = require('../../lib/pkp/playwright/pages/ReviewerManagerPage.js');
const {
	EditorialWorkflowPage,
} = require('../pages/EditorialWorkflowPage.js');
const {
	setTinyMceContent,
} = require('../../lib/pkp/playwright/support/tinymce.js');

/**
 * Reviewer suggestions — one test per canonical scenario of
 * docs/product/specs/reviewer-suggestions.md (6 scenarios).
 *
 * Placement: OJS root (publicknowledge sections, scratch journals and
 * the Settings → Workflow → Review surface are journal concepts), even
 * though the suggestion feature itself ships from pkp-lib.
 *
 * Seeding notes:
 *   - publicknowledge has reviewerSuggestionEnabled ON (bootstrap
 *     enrichment) — scenarios 1 and 3 drive the wizard step directly.
 *   - The toggle flip (scenario 2) lives on a per-test scratch journal;
 *     publicknowledge settings are read-only shared state.
 *   - Editor-consumption scenarios (4–6) start from the submission
 *     scenario's `reviewerSuggestions[]` passthrough (suggestions
 *     attached at submit parity, submission already in external review
 *     with an empty round 1) — re-driving the six-step wizard for each
 *     would only repeat what scenarios 1/3 already prove.
 *   - Scenario 6's role-less account is minted via a throwaway scratch
 *     journal's users[] (an author role there = a site account with no
 *     role on publicknowledge).
 *
 * Suggestion CRUD is deliberately quiet (no mails, no notifications) —
 * no Mailpit assertions in this file.
 *
 * Parallel-safety: tags are single hyphenless alphanumeric tokens, all
 * suggested names/emails embed the tag, and list assertions are scoped
 * to per-test submissions.
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

const COMPLETED_RESTRICTION =
	'Add, update or delete of reviewer suggestion for completed submission is restricted.';
const ROLE_DENIED = 'The current role does not have access to this operation.';

function uniqueTag() {
	const workerIndex = test.info().parallelIndex;
	const suffix = Math.random().toString(36).slice(2, 8);
	return `rsg${workerIndex}x${suffix}`;
}

/**
 * Submitted submission in external review (round 1, no reviewers
 * assigned yet) on publicknowledge, with reviewer suggestions attached
 * at submit parity. dbarnes is the deciding editor.
 *
 * @param {{tag: string, title: string, suggestions: object[]}} opts
 */
function inReviewWithSuggestionsSpec({tag, title, suggestions}) {
	return {
		tag,
		journal: 'publicknowledge',
		submitter: 'atester',
		section: 'ART',
		locale: 'en',
		participants: [{user: 'dbarnes', role: 'editor'}],
		decisions: [{type: 'sendExternalReview', by: 'dbarnes'}],
		reviewRounds: [{reviewers: []}],
		reviewerSuggestions: suggestions,
		publications: [{metadata: {title: {en: title}}}],
	};
}

/**
 * The suggestions REST collection as seen by the page's session.
 *
 * @param {import('@playwright/test').Page} page
 * @param {number} submissionId
 * @returns {Promise<object[]>}
 */
async function fetchSuggestions(page, submissionId) {
	const res = await page.request.get(
		`/index.php/publicknowledge/api/v1/submissions/${submissionId}/reviewers/suggestions`,
	);
	if (!res.ok()) {
		throw new Error(`GET suggestions failed: ${res.status()}`);
	}
	return (await res.json()).items;
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
 * Fill the wizard's Add/Edit Reviewer Suggestion side-modal. Field
 * control ids follow the PkpForm convention
 * `{formId}-{field}-control[-{locale}]` with formId `reviewerSuggestions`.
 * Does NOT save — callers choose the save flavour (valid, empty,
 * duplicate) themselves.
 *
 * @param {import('@playwright/test').Page} page
 * @param {{givenName?: string, familyName?: string, email?: string, affiliation?: string, reason?: string}} values
 * @returns {Promise<import('@playwright/test').Locator>} the modal
 */
async function fillSuggestionModal(page, values = {}) {
	const modal = page.locator('[data-cy="active-modal"]');
	// The side-modal wrapper reports `visibility: hidden` during its
	// open transition — anchor readiness on a control every suggestion
	// form renders.
	await expect(
		modal.locator('#reviewerSuggestions-email-control'),
	).toBeVisible({timeout: 10_000});
	if (values.givenName !== undefined) {
		await modal
			.locator('#reviewerSuggestions-givenName-control-en')
			.fill(values.givenName);
	}
	if (values.familyName !== undefined) {
		await modal
			.locator('#reviewerSuggestions-familyName-control-en')
			.fill(values.familyName);
	}
	if (values.email !== undefined) {
		await modal
			.locator('#reviewerSuggestions-email-control')
			.fill(values.email);
	}
	if (values.affiliation !== undefined) {
		await modal
			.locator('#reviewerSuggestions-affiliation-control-en')
			.fill(values.affiliation);
	}
	if (values.reason !== undefined) {
		await setTinyMceContent(
			page,
			'reviewerSuggestions-suggestionReason-control-en',
			values.reason,
		);
	}
	return modal;
}

/**
 * Save the open suggestion modal expecting success: waits for the
 * suggestions API write and for the modal to close.
 *
 * @param {import('@playwright/test').Page} page
 * @param {import('@playwright/test').Locator} modal
 */
async function saveSuggestionModal(page, modal) {
	await Promise.all([
		page.waitForResponse(
			(res) =>
				/\/api\/v1\/submissions\/\d+\/reviewers\/suggestions/.test(
					res.url(),
				) && res.ok(),
			{timeout: 15_000},
		),
		modal.getByRole('button', {name: 'Save', exact: true}).click(),
	]);
	await expect(modal).toHaveCount(0, {timeout: 10_000});
}

/**
 * Walk forward through the wizard (footer Continue) until the named
 * step is current — robust to how many steps the journal produces and
 * to which step a freshly (re)loaded wizard opens on. Mirrors the
 * submission-wizard-metadata sibling.
 *
 * @param {import('@playwright/test').Page} page
 * @param {SubmissionWizardPage} wizard
 * @param {string} stepName
 */
async function walkToStep(page, wizard, stepName) {
	const current = page.locator('.pkpSteps__step__label--current');
	await expect(current).toBeVisible({timeout: 20_000});
	const target = new RegExp(
		stepName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*$',
	);
	for (let i = 0; i < 8; i++) {
		const label = ((await current.textContent()) ?? '').trim();
		if (target.test(label)) {
			await wizard.expectStep(stepName);
			return;
		}
		await wizard.continueStep();
		await expect(current).not.toHaveText(label, {timeout: 20_000});
	}
	throw new Error(`walkToStep: never reached "${stepName}"`);
}

test.use({user: 'atester'});

test.describe('Reviewer suggestions', () => {
	// Canonical scenario 1 — atester on publicknowledge (feature on by
	// default): the "5 Reviewer Suggestions" step sits between For the
	// Editors and Review; empty save flags the four required fields; a
	// valid save lists the person (affiliation badge, email, Edit,
	// Delete); a duplicate email is refused; Delete (after the
	// cannot-be-undone dialog) removes the row; the Review step mirrors
	// the list, or warns without blocking Submit.
	test(
		'author manages suggestions in the wizard',
		{tag: ['@smoke', '@regression']},
		async ({page}) => {
			test.slow(); // full wizard walk + modal round-trips
			const tag = uniqueTag();
			const family = `Keeplesse${tag}`;
			const email = `alice.${tag}@mailinator.com`;

			const wizard = new SubmissionWizardPage(page);
			await wizard.goto();
			// Reviews section: abstracts not required on publicknowledge,
			// so title + file is a fully valid draft for the Submit gate.
			await wizard.start({
				title: `Sugmanage ${tag}`,
				locale: 'English',
				section: 'Reviews',
			});

			// The rail shows "5 Reviewer Suggestions" between For the
			// Editors and Review.
			await expect(page.locator('.pkpSteps__step__label')).toHaveText([
				/Upload Files\s*$/,
				/Details\s*$/,
				/Contributors\s*$/,
				/For the Editors\s*$/,
				/^5\s*Reviewer Suggestions\s*$/,
				/^6\s*Review\s*$/,
			]);

			// Make the draft valid while we're on step 1 (Submit-enabled
			// is asserted at the end).
			await wizard.expectStep('Upload Files');
			const fileItem = await wizard.uploadFile(ARTICLE_FIXTURE);
			await wizard.assignPrimaryGenre(fileItem, 'Article Text');

			// Walk forward — unstarted steps don't render as clickable
			// rail pills.
			await wizard.continueStep();
			await wizard.expectStep('Details');
			await wizard.continueStep();
			await wizard.expectStep('Contributors');
			await wizard.continueStep();
			await wizard.expectStep('For the Editors');
			await wizard.continueStep();
			await wizard.expectStep('Reviewer Suggestions');
			const panel = page.locator('.reviewerSuggestionsListPanel');
			await expect(panel).toBeVisible({timeout: 10_000});

			// "Add Reviewer Suggestion" opens the same-named side modal;
			// saving it empty flags the four required fields (Given Name,
			// Email, Affiliation, Reasons — Family Name is optional).
			await panel
				.getByRole('button', {name: 'Add Reviewer Suggestion'})
				.click();
			const modal = await fillSuggestionModal(page, {});
			await expect(
				modal.getByRole('heading', {name: 'Add Reviewer Suggestion'}),
			).toBeVisible();
			await modal.getByRole('button', {name: 'Save', exact: true}).click();
			await expect(
				modal.locator('.pkpFieldError__message', {
					hasText: 'This field is required.',
				}),
			).toHaveCount(4, {timeout: 10_000});

			// A valid save lists the person with the affiliation badge,
			// the email underneath, and Edit + Delete buttons.
			await fillSuggestionModal(page, {
				givenName: 'Alice',
				familyName: family,
				email,
				affiliation: `AffOne ${tag}`,
				reason: `Reason ${tag} subject-matter expert`,
			});
			await saveSuggestionModal(page, modal);
			const itemA = panel
				.locator('.listPanel__item')
				.filter({hasText: family})
				.first();
			await expect(itemA).toBeVisible({timeout: 10_000});
			await expect(itemA.locator('.pkpBadge')).toContainText(
				`AffOne ${tag}`,
			);
			await expect(itemA).toContainText(email);
			await expect(itemA.getByRole('button', {name: 'Edit'})).toBeVisible();
			await expect(
				itemA.getByRole('button', {name: 'Delete'}),
			).toBeVisible();

			// A second suggestion with the same email is refused.
			await panel
				.getByRole('button', {name: 'Add Reviewer Suggestion'})
				.click();
			await fillSuggestionModal(page, {
				givenName: 'Bob',
				familyName: `Duply${tag}`,
				email, // duplicate
				affiliation: `AffTwo ${tag}`,
				reason: `Reason ${tag} duplicate email`,
			});
			await Promise.all([
				page.waitForResponse(
					(res) =>
						/\/api\/v1\/submissions\/\d+\/reviewers\/suggestions/.test(
							res.url(),
						) && !res.ok(),
					{timeout: 15_000},
				),
				modal.getByRole('button', {name: 'Save', exact: true}).click(),
			]);
			await expect(
				modal.locator('.pkpFieldError__message', {
					hasText: 'The email has already been taken.',
				}),
			).toBeVisible({timeout: 10_000});
			await modal.getByRole('button', {name: 'Close'}).click();
			await expect(modal).toHaveCount(0, {timeout: 10_000});

			// The Review step's read-only panel mirrors the list…
			await wizard.continueStep();
			await wizard.expectStep('Review');
			const reviewPanel = wizard.reviewPanel('Reviewer Suggestions');
			await expect(reviewPanel).toBeVisible({timeout: 15_000});
			await expect(reviewPanel).toContainText(`Alice ${family}`);
			await expect(reviewPanel).toContainText(email);
			await expect(reviewPanel).toContainText(`AffOne ${tag}`);

			// …with an Edit link back to the step.
			await reviewPanel.getByRole('button', {name: 'Edit'}).click();
			await wizard.expectStep('Reviewer Suggestions');

			// Delete asks for confirmation ("…can not be undone") and
			// removes the row.
			await itemA.getByRole('button', {name: 'Delete'}).click();
			const dialog = page.getByRole('dialog', {
				name: 'Delete Reviewer Suggestion',
			});
			await expect(dialog).toBeVisible({timeout: 10_000});
			await expect(dialog).toContainText(
				'Are you sure you want to remove this suggestion? This action can not be undone.',
			);
			await Promise.all([
				page.waitForResponse(
					(res) =>
						/\/api\/v1\/submissions\/\d+\/reviewers\/suggestions\/\d+/.test(
							res.url(),
						) && res.ok(),
					{timeout: 15_000},
				),
				dialog
					.getByRole('button', {name: 'Delete Reviewer Suggestion'})
					.click(),
			]);
			await expect(itemA).toHaveCount(0, {timeout: 10_000});

			// An empty list warns on Review — without blocking Submit.
			await wizard.continueStep();
			await wizard.expectStep('Review');
			await expect(
				reviewPanel.getByText(
					'No reviewers have been suggested for this submission.',
				),
			).toBeVisible({timeout: 15_000});
			await expect(wizard.reviewErrorsBanner).toHaveCount(0);
			await expect(wizard.footerSubmit).toBeEnabled({timeout: 20_000});
		},
	);

	// Canonical scenario 2 — on a scratch journal the wizard has 5 steps;
	// the manager ticks "Allow authors to suggest potential reviewers at
	// submission process" (Settings → Workflow → Review) and the same
	// in-flight draft gains the step (with the default guidance text) on
	// next load.
	test(
		'the journal toggle controls the step',
		{tag: '@regression'},
		async ({page, pkpApi, asUser}) => {
			test.slow(); // scratch journal + settings save + two wizard opens
			const tag = uniqueTag();

			const {context} = await pkpApi.createJournal({
				tag,
				users: [
					{username: 'atester', roles: ['author']},
					{username: 'dbarnes', roles: ['manager']},
				],
			});
			const {submission} = await pkpApi.createSubmission({
				tag,
				journal: context.path,
				submitter: 'atester',
				section: 'ART',
				locale: 'en',
				submitted: false,
				participants: [],
				publications: [{metadata: {title: {en: `Toggled ${tag}`}}}],
			});
			const wizardUrl = `/index.php/${context.path}/submission?id=${submission.id}`;

			// Toggle off (a fresh journal's default): 5 steps, no Reviewer
			// Suggestions.
			await page.goto(wizardUrl);
			await expect(page.locator('.submissionWizard')).toBeVisible({
				timeout: 20_000,
			});
			const rail = page.locator('.pkpSteps__step__label');
			await expect(rail).toHaveText([
				/Upload Files\s*$/,
				/Details\s*$/,
				/Contributors\s*$/,
				/For the Editors\s*$/,
				/^5\s*Review\s*$/,
			]);

			// The manager ticks the checkbox in Settings → Workflow →
			// Review → Setup and saves.
			const managerCtx = await asUser('dbarnes');
			const managerPage = await managerCtx.newPage();
			const settings = new WorkflowSettingsPage(managerPage, context.path);
			await settings.goto();
			const panel = await settings.openReviewSetupTab();
			const toggle = panel.locator(
				'input[name="reviewerSuggestionEnabled"]',
			);
			await expect(
				panel.getByText(
					'Allow authors to suggest potential reviewers at submission process',
				),
			).toBeVisible();
			await expect(toggle).not.toBeChecked();
			await toggle.check();
			await settings.saveForm(panel);

			// Reloading the same in-flight draft now shows 6 steps…
			await page.goto(wizardUrl);
			await expect(page.locator('.submissionWizard')).toBeVisible({
				timeout: 20_000,
			});
			await expect(rail).toHaveText([
				/Upload Files\s*$/,
				/Details\s*$/,
				/Contributors\s*$/,
				/For the Editors\s*$/,
				/^5\s*Reviewer Suggestions\s*$/,
				/^6\s*Review\s*$/,
			]);

			// …with the stock guidance text atop the new step.
			const wizard = new SubmissionWizardPage(page, context.path);
			await walkToStep(page, wizard, 'Reviewer Suggestions');
			await expect(
				page.getByText(
					/you have the option to suggest several potential reviewers/,
				),
			).toBeVisible({timeout: 15_000});
			await expect(
				page.locator('.reviewerSuggestionsListPanel'),
			).toBeVisible();
		},
	);

	// Canonical scenario 3 — atester submits with a suggestion attached;
	// dbarnes sees "Reviewers Suggested by Author" at the Submission
	// stage (no actions) and on Review Round 1 (with the actions menu);
	// mutations are now refused for author AND editor with the
	// completed-submission restriction; a reviewer's read is refused
	// outright; the author's dashboard has no suggestion panel.
	test(
		'suggestions survive submit, reach the editor, and freeze',
		{tag: ['@smoke', '@regression']},
		async ({page, asUser}) => {
			test.slow(); // wizard submit + editor decision + 3 actors
			const tag = uniqueTag();
			const family = `Throughton${tag}`;
			const email = `carla.${tag}@mailinator.com`;
			const title = `Sugsubmit ${tag}`;

			// The author submits with one suggestion attached (Reviews
			// section: title + file are the only submit gates).
			const wizard = new SubmissionWizardPage(page);
			await wizard.goto();
			await wizard.start({title, locale: 'English', section: 'Reviews'});
			const submissionId = wizard.currentSubmissionId();
			expect(submissionId).toBeTruthy();

			await wizard.expectStep('Upload Files');
			const fileItem = await wizard.uploadFile(ARTICLE_FIXTURE);
			await wizard.assignPrimaryGenre(fileItem, 'Article Text');
			await wizard.continueStep();
			await wizard.expectStep('Details');
			await wizard.continueStep();
			await wizard.expectStep('Contributors');
			await wizard.continueStep();
			await wizard.expectStep('For the Editors');
			await wizard.continueStep();
			await wizard.expectStep('Reviewer Suggestions');
			await page
				.locator('.reviewerSuggestionsListPanel')
				.getByRole('button', {name: 'Add Reviewer Suggestion'})
				.click();
			const modal = await fillSuggestionModal(page, {
				givenName: 'Carla',
				familyName: family,
				email,
				affiliation: `Affsubmit ${tag}`,
				reason: `Reason ${tag} survives submit`,
			});
			await saveSuggestionModal(page, modal);

			await wizard.continueStep();
			await wizard.expectStep('Review');
			const submitDialog = await wizard.openSubmitDialog();
			await submitDialog
				.getByRole('button', {name: 'Submit', exact: true})
				.click();
			await expect(
				page.getByRole('heading', {name: 'Submission complete'}),
			).toBeVisible({timeout: 30_000});

			// dbarnes (auto-assigned Reviews section editor) sees the
			// panel at the Submission stage — read-only, no actions menu.
			const editorCtx = await asUser('dbarnes');
			const editorPage = await editorCtx.newPage();
			const workflow = new EditorialWorkflowPage(editorPage);
			await workflow.goto(Number(submissionId));
			const suggestionManager = editorPage.locator(
				'[data-cy="reviewer-suggestion-manager"]',
			);
			await expect(suggestionManager).toBeVisible({timeout: 20_000});
			await expect(suggestionManager).toContainText(
				'Reviewers Suggested by Author',
			);
			await expect(suggestionManager).toContainText(`Carla ${family}`);
			await expect(suggestionManager).toContainText(`Affsubmit ${tag}`);
			await expect(suggestionManager).toContainText(
				`Reason ${tag} survives submit`,
			);
			await expect(
				suggestionManager.getByRole('button', {name: /More Actions/}),
			).toHaveCount(0);

			// Send for Review → Review Round 1: the actions menu appears.
			await workflow.clickDecision('Send for Review');
			await workflow.clickContinue(); // notify-authors email step
			await workflow.recordDecision();
			await workflow.viewSubmissionFromCompletionDialog(
				Number(submissionId),
			);
			await expect(suggestionManager).toBeVisible({timeout: 20_000});
			await expect(
				suggestionManager.getByRole('button', {
					name: `Carla ${family} More Actions`,
				}),
			).toBeVisible({timeout: 20_000});

			// The list is frozen: the author's add is refused…
			await page.goto(
				`/index.php/publicknowledge/en/dashboard/mySubmissions?workflowSubmissionId=${submissionId}`,
			);
			// …and the author's dashboard shows no suggestion panel.
			await expect(page.getByText(title).first()).toBeVisible({
				timeout: 20_000,
			});
			await expect(
				page.locator('[data-cy="reviewer-suggestion-manager"]'),
			).toHaveCount(0);

			const suggestionsUrl = `/index.php/publicknowledge/api/v1/submissions/${submissionId}/reviewers/suggestions`;
			const authorAdd = await page.request.post(suggestionsUrl, {
				headers: {'X-Csrf-Token': await csrfToken(page)},
				data: {
					givenName: {en: 'Late'},
					familyName: {en: `Comer${tag}`},
					email: `late.${tag}@mailinator.com`,
					affiliation: {en: `Afflate ${tag}`},
					suggestionReason: {en: `<p>Too late ${tag}</p>`},
				},
			});
			expect(authorAdd.ok()).toBeFalsy();
			expect(await authorAdd.text()).toContain(COMPLETED_RESTRICTION);

			// …the editor's read works, but their delete is refused too.
			const [frozen] = await fetchSuggestions(
				editorPage,
				Number(submissionId),
			);
			expect(frozen.email).toBe(email);
			const editorDelete = await editorPage.request.delete(
				`${suggestionsUrl}/${frozen.id}`,
				{headers: {'X-Csrf-Token': await csrfToken(editorPage)}},
			);
			expect(editorDelete.ok()).toBeFalsy();
			expect(await editorDelete.text()).toContain(COMPLETED_RESTRICTION);

			// A reviewer's read is refused outright (role never allowed).
			const reviewerCtx = await asUser('jjanssen');
			const reviewerPage = await reviewerCtx.newPage();
			const reviewerRead = await reviewerPage.request.get(suggestionsUrl);
			expect(reviewerRead.ok()).toBeFalsy();
			expect(await reviewerRead.text()).toContain(ROLE_DENIED);
		},
	);

	// Canonical scenario 4 — suggestion email matches no account: "Add
	// Reviewer" on the suggestion opens Create New Reviewer pre-filled
	// with the suggested name, email and affiliation; completing it
	// assigns the reviewer, stamps the suggestion approved/linked, and
	// it leaves the round's panel.
	test(
		'approve a suggestion into a brand-new reviewer',
		{tag: '@regression'},
		async ({pkpApi, asUser}) => {
			const tag = uniqueTag();
			const family = `Newbright${tag}`;
			const email = `nova.${tag}@mailinator.com`;
			const {submission} = await pkpApi.createSubmission(
				inReviewWithSuggestionsSpec({
					tag,
					title: `Sugcreate ${tag}`,
					suggestions: [
						{
							givenName: 'Nova',
							familyName: family,
							email,
							affiliation: `Affcreate ${tag}`,
							suggestionReason: `Reason ${tag} new to the journal`,
						},
					],
				}),
			);

			const ctx = await asUser('dbarnes');
			const page = await ctx.newPage();
			const reviewerManager = new ReviewerManagerPage(page);
			await reviewerManager.gotoWorkflow(submission.id);

			const suggestionManager = page.locator(
				'[data-cy="reviewer-suggestion-manager"]',
			);
			await expect(suggestionManager).toBeVisible({timeout: 20_000});
			await suggestionManager
				.getByRole('button', {name: `Nova ${family} More Actions`})
				.click();
			await page.getByRole('menuitem', {name: 'Add Reviewer'}).click();

			// No account behind the email → Create New Reviewer, pre-filled
			// from the suggestion (username left to complete).
			const modal = page.getByRole('dialog', {
				name: 'Add Reviewer',
				exact: true,
			});
			await expect(modal).toBeVisible({timeout: 15_000});
			const createForm = modal.locator('#createReviewerForm').last();
			await expect(createForm).toBeVisible({timeout: 20_000});
			await expect(
				createForm.locator('input[name="givenName[en]"]'),
			).toHaveValue('Nova');
			await expect(
				createForm.locator('input[name="familyName[en]"]'),
			).toHaveValue(family);
			await expect(createForm.locator('input[name="email"]')).toHaveValue(
				email,
			);
			await expect(
				createForm.locator('input[name="affiliation[en]"]'),
			).toHaveValue(`Affcreate ${tag}`);

			// Complete what the suggestion can't provide: the username
			// (and the form's colliding default due dates).
			await createForm
				.locator('input[name="username"]')
				.fill(`rev${tag}`);
			const userGroupSelect = createForm.locator(
				'select[name="userGroupId"]',
			);
			if (await userGroupSelect.isVisible().catch(() => false)) {
				await userGroupSelect.selectOption({label: 'Reviewer'});
			}
			await reviewerManager.ensureDueDatesOrdered(createForm);
			await reviewerManager.submitLegacyForm(
				createForm,
				'Add Reviewer',
				modal,
			);

			// Assigned to the round…
			await expect(reviewerManager.manager).toContainText(
				`Nova ${family}`,
				{timeout: 20_000},
			);
			// …and the suggestion left the round's panel live (sole
			// suggestion → the whole panel unmounts).
			await expect(suggestionManager).toHaveCount(0, {timeout: 20_000});

			// DB round-trip: approved and linked to the new account.
			const suggestions = await fetchSuggestions(page, submission.id);
			const approved = suggestions.find((item) => item.email === email);
			expect(approved.approvedAt).toBeTruthy();
			expect(approved.reviewerId).toBeTruthy();
		},
	);

	// Canonical scenario 5 — suggestion email = jjanssen's account:
	// "Add Reviewer" skips straight to the assignment form with
	// "Selected Reviewer: Julie Janssen" (the ACCOUNT name — matching is
	// by email only, the author typed "Jennifer"); completing it assigns
	// her, stamps approvedAt + reviewerId = her account, and the panel
	// refreshes without her.
	test(
		'approve a suggestion matching an existing reviewer',
		{tag: '@regression'},
		async ({pkpApi, asUser}) => {
			const tag = uniqueTag();
			const fillerFamily = `Stillhere${tag}`;
			const {submission} = await pkpApi.createSubmission(
				inReviewWithSuggestionsSpec({
					tag,
					title: `Sugexisting ${tag}`,
					suggestions: [
						{
							// The author typed a DIFFERENT name for jjanssen's
							// email — the form must show the account's name.
							givenName: 'Jennifer',
							familyName: 'Janssen',
							email: 'jjanssen@mailinator.com',
							affiliation: 'Utrecht University',
							suggestionReason: `Reason ${tag} has reviewed before`,
						},
						{
							// Filler so the panel survives the approval and the
							// live refresh is observable.
							givenName: 'Frida',
							familyName: fillerFamily,
							email: `frida.${tag}@mailinator.com`,
							affiliation: `Afffiller ${tag}`,
							suggestionReason: `Reason ${tag} stays pending`,
						},
					],
				}),
			);

			const ctx = await asUser('dbarnes');
			const page = await ctx.newPage();
			const reviewerManager = new ReviewerManagerPage(page);
			await reviewerManager.gotoWorkflow(submission.id);

			const suggestionManager = page.locator(
				'[data-cy="reviewer-suggestion-manager"]',
			);
			await expect(suggestionManager).toBeVisible({timeout: 20_000});
			await expect(suggestionManager).toContainText('Jennifer Janssen');
			await suggestionManager
				.getByRole('button', {name: 'Jennifer Janssen More Actions'})
				.click();
			await page.getByRole('menuitem', {name: 'Add Reviewer'}).click();

			// Straight to the assignment form: "Selected Reviewer" shows
			// the account name matched by email; no create fields.
			const modal = page.getByRole('dialog', {
				name: 'Add Reviewer',
				exact: true,
			});
			await expect(modal).toBeVisible({timeout: 15_000});
			const regularForm = modal.locator('#regularReviewerForm').last();
			await expect(regularForm).toBeVisible({timeout: 20_000});
			await expect(
				regularForm.locator('#selectedReviewerName'),
			).toContainText('Julie Janssen');
			await expect(modal.locator('#createReviewerForm')).toHaveCount(0);

			const assignForm = regularForm.locator(
				'#advancedSearchReviewerForm',
			);
			await reviewerManager.ensureDueDatesOrdered(assignForm);
			await reviewerManager.submitLegacyForm(
				assignForm,
				'Add Reviewer',
				modal,
			);

			// Assigned; the panel refreshes live — Julie leaves, the
			// filler stays, no reload.
			await expect(reviewerManager.manager).toContainText(
				'Julie Janssen',
				{timeout: 20_000},
			);
			await expect(suggestionManager).toContainText(
				`Frida ${fillerFamily}`,
				{timeout: 20_000},
			);
			await expect(suggestionManager).not.toContainText('Janssen');

			// approvedAt stamped, reviewerId = the matched account.
			const suggestions = await fetchSuggestions(page, submission.id);
			const approved = suggestions.find(
				(item) => item.email === 'jjanssen@mailinator.com',
			);
			expect(approved.approvedAt).toBeTruthy();
			expect(approved.reviewerId).toBe(approved.existingUserId);
			const filler = suggestions.find(
				(item) => item.email === `frida.${tag}@mailinator.com`,
			);
			expect(filler.approvedAt).toBeFalsy();
		},
	);

	// Canonical scenario 6 — the standalone Add Reviewer dialog lists
	// pending suggestions above "Locate a Reviewer"; ignoring them and
	// assigning the matching account from the regular list still
	// auto-approves the suggestion; a suggestion whose email belongs to
	// a role-less account routes to Enroll Existing User as Reviewer
	// pre-selected, and completing it enrolls + assigns.
	test(
		'standalone Add Reviewer meets the suggestions and email match auto-approves',
		{tag: '@regression'},
		async ({pkpApi, asUser}) => {
			test.slow(); // two Add-Reviewer dialog round-trips + reloads
			const tag = uniqueTag();
			const family = `Norole${tag}`;
			const username = `nr${tag}`.slice(0, 30);
			const email = `${username}@mailinator.com`;

			// Existing SITE account with no role on publicknowledge:
			// seeded as an author on a throwaway scratch journal.
			await pkpApi.createJournal({
				tag,
				users: [
					{
						username,
						password: `pw${tag}`,
						givenName: 'Nadia',
						familyName: family,
						roles: ['author'],
					},
				],
			});

			const {submission} = await pkpApi.createSubmission(
				inReviewWithSuggestionsSpec({
					tag,
					title: `Suglist ${tag}`,
					suggestions: [
						{
							givenName: 'Julie',
							familyName: 'Janssen',
							email: 'jjanssen@mailinator.com',
							affiliation: 'Utrecht University',
							suggestionReason: `Reason ${tag} ignored but matched`,
						},
						{
							givenName: 'Nadia',
							familyName: family,
							email,
							affiliation: `Afflist ${tag}`,
							suggestionReason: `Reason ${tag} enroll path`,
						},
					],
				}),
			);

			const ctx = await asUser('dbarnes');
			const page = await ctx.newPage();
			const reviewerManager = new ReviewerManagerPage(page);
			await reviewerManager.gotoWorkflow(submission.id);

			// The selection step offers the pending suggestions FIRST,
			// above the regular Locate a Reviewer list.
			let modal = await reviewerManager.openAddReviewerModal();
			const panels = modal.locator('.listPanel--selectReviewer');
			await expect(panels).toHaveCount(2, {timeout: 15_000});
			await expect(
				panels
					.first()
					.getByRole('heading', {
						name: 'Select a Reviewer from Reviewer Suggestions',
					}),
			).toBeVisible();
			await expect(
				panels.last().getByRole('heading', {name: 'Locate a Reviewer'}),
			).toBeVisible();
			await expect(panels.first()).toContainText('Julie Janssen');
			await expect(panels.first()).toContainText(`Nadia ${family}`);

			// Ignore the suggestions: pick Julie Janssen from the REGULAR
			// list. Completing the assignment must auto-approve her
			// pending suggestion by email match alone.
			await reviewerManager.searchSelectPanel(modal, 'jjanssen');
			const assignForm = await reviewerManager.selectReviewer(
				modal,
				'Julie Janssen',
			);
			await reviewerManager.ensureDueDatesOrdered(assignForm);
			await reviewerManager.submitLegacyForm(
				assignForm,
				'Add Reviewer',
				modal,
			);
			await expect(reviewerManager.manager).toContainText(
				'Julie Janssen',
				{timeout: 20_000},
			);
			await expect
				.poll(
					async () => {
						const suggestions = await fetchSuggestions(
							page,
							submission.id,
						);
						const julie = suggestions.find(
							(item) => item.email === 'jjanssen@mailinator.com',
						);
						return Boolean(julie?.approvedAt && julie?.reviewerId);
					},
					{timeout: 20_000},
				)
				.toBe(true);

			// Round 2 of the dialog: only Nadia's suggestion remains;
			// selecting it routes to Enroll Existing User as Reviewer with
			// the account pre-selected and the reviewer group pre-chosen.
			await page.reload();
			await expect(reviewerManager.manager).toBeVisible({
				timeout: 20_000,
			});
			modal = await reviewerManager.openAddReviewerModal();
			const suggestionsPanel = modal
				.locator('.listPanel--selectReviewer')
				.first();
			await expect(suggestionsPanel).toContainText(`Nadia ${family}`, {
				timeout: 15_000,
			});
			await expect(suggestionsPanel).not.toContainText('Julie Janssen');
			// NOTE: the per-suggestion button's ACCESSIBLE name renders as
			// "Select undefined" (known a11y bug — app-changes.md §2 row
			// 52), so match the visible label instead of the role name.
			await suggestionsPanel
				.locator('button', {hasText: 'Select Reviewer'})
				.first()
				.click();

			const enrollForm = modal
				.locator('#enrollExistingReviewerForm')
				.last();
			await expect(
				enrollForm.getByRole('heading', {
					name: 'Enroll an Existing User as Reviewer',
				}),
			).toBeVisible({timeout: 20_000});
			await expect(
				enrollForm.getByRole('textbox', {name: /Search By Name/}),
			).toHaveValue(new RegExp(family), {timeout: 20_000});
			await expect(
				enrollForm.locator('select[name="userGroupId"] option:checked'),
			).toHaveText(/Reviewer/);

			// Submit with the prefilled (equal) due dates — bumping them
			// refreshes the legacy form and wipes the user selection.
			await expect(
				enrollForm.locator('input[name="responseDueDate"]').last(),
			).toHaveValue(/\d{4}-\d{2}-\d{2}/, {timeout: 15_000});
			const submitButton = enrollForm.getByRole('button', {
				name: 'Add Reviewer',
				exact: true,
			});
			await expect(submitButton).toBeEnabled({timeout: 20_000});
			const [enrollResponse] = await Promise.all([
				page.waitForResponse(
					(res) =>
						res.url().includes('enroll-reviewer') &&
						res.request().method() === 'POST',
					{timeout: 20_000},
				),
				submitButton.click(),
			]);
			expect(enrollResponse.status()).toBe(200);
			expect((await enrollResponse.json()).status).toBe(true);

			// The standalone-enroll path pops back to the selection step
			// without live-refreshing the managers (known quirk — ledger
			// §2 row 52): reload and assert the end state.
			await page.reload();
			await expect(reviewerManager.manager).toContainText(
				`Nadia ${family}`,
				{timeout: 20_000},
			);
			await expect(
				page.locator('[data-cy="reviewer-suggestion-manager"]'),
			).toHaveCount(0, {timeout: 20_000});

			const suggestions = await fetchSuggestions(page, submission.id);
			const enrolled = suggestions.find((item) => item.email === email);
			expect(enrolled.approvedAt).toBeTruthy();
			expect(enrolled.reviewerId).toBeTruthy();
		},
	);
});
