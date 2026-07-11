// @ts-check
const path = require('path');
const {test, expect} = require('../support/fixtures.js');
const {
	SubmissionWizardPage,
} = require('../../lib/pkp/playwright/pages/SubmissionWizardPage.js');
const {
	WorkflowSettingsPage,
} = require('../../lib/pkp/playwright/pages/WorkflowSettingsPage.js');
const {EditorialWorkflowPage} = require('../pages/EditorialWorkflowPage.js');
const {
	setTinyMceContent,
	getTinyMceContent,
} = require('../../lib/pkp/playwright/support/tinymce.js');

/**
 * Submission wizard metadata — one test per canonical scenario of
 * docs/product/specs/submission-wizard-metadata.md (8 scenarios → 8
 * tests). The settings dial + For the Editors step are shared pkp-lib,
 * but every scenario leans on OJS machinery (the scenario journal API,
 * OJS categories, the publicknowledge journal), so the spec lives at
 * the OJS root — mirroring submission-wizard.spec.js.
 *
 * As-built deviations the spec documents (do NOT "fix" these to intent):
 *  - Vocabulary suggestions are not journal-scoped (spec Known
 *    deviations #1; ControlledVocab::scopeWithContextId's uncorrelated
 *    LIMIT-1 subquery): ONE arbitrary "winner" journal — in practice
 *    the bootstrap publicknowledge journal, whose vocab rows are
 *    physically first — receives every journal's terms as suggestions
 *    while every other journal receives none, not even its own.
 *    Scenario 3 therefore drives the type-ahead on publicknowledge's
 *    Keywords field (rule 4 names Keywords as the same shared
 *    primitive; Subjects can't be enabled on publicknowledge without
 *    mutating shared settings) and asserts the leak itself at the API.
 *  - "Require" Data Citations never blocks a submission (spec Known
 *    deviations #2; validateSubmit()'s array-to-string cast): scenario
 *    4 seeds dataCitations=require alongside subjects=require and
 *    asserts the submission completes while "Data citations are
 *    required." is still painted on the Review step.
 *
 * Parallel-safety: every settings matrix runs on a per-test scratch
 * journal (the established pattern for context-settings mutation —
 * publicknowledge stays read-only + additive, so nothing here needs
 * the serial project and no settings restore is ever required). Tags
 * are single hyphenless alphanumeric tokens; Mailpit is untouched (the
 * feature has no mail side effects).
 */

const PDF = path.resolve(
	__dirname,
	'../../lib/pkp/playwright/fixtures/files/dummy.pdf',
);

/** The one section every scratch journal here needs: abstracts waived. */
const ART_SECTION = {
	abbrev: {en: 'ART'},
	title: {en: 'Articles'},
	abstractsNotRequired: true,
};

/** A unique, hyphenless, alphanumeric tag (parallel isolation). */
function uniqueTag(prefix = 'swm') {
	const workerLetter = String.fromCharCode(97 + (test.info().parallelIndex % 26));
	let suffix = '';
	while (suffix.length < 6) {
		suffix += Math.random().toString(36).replace(/[^a-z0-9]/g, '');
	}
	return `${prefix}${workerLetter}${suffix.slice(0, 6)}`;
}

/** The wizard address for a given submission. */
function wizardUrl(submissionId, journalPath = 'publicknowledge') {
	return `/index.php/${journalPath}/submission?id=${submissionId}`;
}

/** Read the logged-in page's CSRF token (exposed on any backend page). */
async function readCsrf(page) {
	await page.waitForFunction(() => !!window.pkp?.currentUser?.csrfToken, null, {
		timeout: 15_000,
	});
	return page.evaluate(() => window.pkp.currentUser.csrfToken);
}

/**
 * Walk the wizard forward with Continue until `stepName` is the current
 * step (step counts differ per journal — Reviewer Suggestions is
 * conditional — so walk by name, not by count).
 */
async function walkTo(wizard, stepName, max = 7) {
	const current = wizard.page.locator('.pkpSteps__step__label--current');
	const done = new RegExp(
		stepName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*$',
	);
	for (let i = 0; i < max; i++) {
		const label = ((await current.textContent()) ?? '').trim();
		if (done.test(label)) {
			return;
		}
		await wizard.continueStep();
	}
	await wizard.expectStep(stepName);
}

/**
 * Wait out the Review step's transient "Checking your submission"
 * state (the entry validation call).
 */
async function awaitReviewCheck(page) {
	await expect(page.getByText('Checking your submission')).toBeHidden({
		timeout: 30_000,
	});
}

/** Scenario spec for a resumable wizard draft (submitted: false). */
function draftSpec({tag, title, journal = 'publicknowledge', section = 'ART', submitter = 'author.alex', metadata = {}}) {
	return {
		tag,
		journal,
		submitter,
		section,
		locale: 'en',
		submitted: false,
		publications: [{metadata: {title: {en: title}, ...metadata}}],
	};
}

/**
 * Build a context-settings setter bound to an admin page on the given
 * journal (scratch journals auto-enroll `admin` as a Journal manager,
 * patterns.md §parallel-load #13). Mode changes take effect on the
 * author's next page load (spec rule 2).
 */
async function makeContextSetter(asUser, journalPath, contextId) {
	const adminCtx = await asUser('admin');
	const adminPage = await adminCtx.newPage();
	await adminPage.goto(`/index.php/${journalPath}/dashboard/editorial`, {
		waitUntil: 'commit',
	});
	const csrf = await readCsrf(adminPage);
	return async (data) => {
		const res = await adminPage.request.put(
			`/index.php/${journalPath}/api/v1/contexts/${contextId}`,
			{
				headers: {
					'X-Csrf-Token': csrf,
					'Content-Type': 'application/json',
				},
				data,
			},
		);
		expect(
			res.ok(),
			`context settings update: ${res.status()} ${await res.text()}`,
		).toBe(true);
	};
}

test.use({user: 'author.alex'}); // the default actor: a pure-author account

test.describe('Submission wizard metadata', () => {
	// Canonical scenario 1 — configuring the dial: each metadata type is
	// an "Enable … metadata" checkbox; ticking reveals three radios
	// preselected on "Do not request…"; the manager sets Subjects to
	// require, Coverage to ask, ticks Type on the default, leaves Rights
	// off, and the page confirms the save.
	test('Configuring the dial', {tag: '@regression'}, async ({pkpApi, asUser}) => {
		test.slow(); // scratch journal + settings form
		const tag = uniqueTag('m1');
		const {context} = await pkpApi.createJournal({
			tag,
			users: [{username: 'manager.maya', roles: ['manager']}],
		});

		const mgrCtx = await asUser('manager.maya');
		const page = await mgrCtx.newPage();
		const settings = new WorkflowSettingsPage(page, context.path);
		await settings.goto();
		const panel = await settings.openMetadataTab();

		// Subjects: unticked, radios not in the DOM.
		const subjects = settings.metadataFieldset(panel, 'Enable subject metadata');
		await expect(settings.enableCheckbox(subjects)).not.toBeChecked();
		await expect(subjects.locator('input[type="radio"]')).toHaveCount(0);

		// Ticking reveals the three choices, preselected on "Do not
		// request…" (the enabled-editors-only mode).
		await settings.enableCheckbox(subjects).check();
		await expect(subjects.locator('input[type="radio"]')).toHaveCount(3);
		await expect(
			settings.modeRadio(
				subjects,
				'Do not request subjects from the author during submission.',
			),
		).toBeChecked();
		await settings
			.modeRadio(
				subjects,
				'Require the author to provide subjects before accepting their submission.',
			)
			.check();

		// Coverage: tick + "Ask the author…".
		const coverage = settings.metadataFieldset(panel, 'Enable coverage metadata');
		await settings.enableCheckbox(coverage).check();
		await settings
			.modeRadio(
				coverage,
				'Ask the author to suggest coverage metadata during submission.',
			)
			.check();

		// Type: tick but leave the default "Do not request…".
		const type = settings.metadataFieldset(panel, 'Enable type metadata');
		await settings.enableCheckbox(type).check();
		await expect(
			settings.modeRadio(
				type,
				'Do not request the type from the author during submission.',
			),
		).toBeChecked();

		// Rights: left unticked.
		const rights = settings.metadataFieldset(panel, 'Enable rights metadata');
		await expect(settings.enableCheckbox(rights)).not.toBeChecked();

		// Save: the POM waits for the contexts API write + the "Saved"
		// badge; the response body carries the persisted modes.
		const response = await settings.saveForm(panel);
		const saved = await response.json();
		expect(saved.subjects).toBe('require');
		expect(saved.coverage).toBe('request');
		expect(saved.type).toBe('enable');
		expect(String(saved.rights ?? 0)).toBe('0');
	});

	// Canonical scenario 2 — the wizard mirrors the configuration:
	// Subjects=require appears first with a visible description and the
	// required marker, Coverage=ask appears unmarked, Type (enable-only)
	// and Rights (off) are absent, Categories sits before the always-on
	// Comments box; with everything turned off the step reduces to the
	// comments box under the step's intro text.
	test(
		'The wizard mirrors the configuration',
		{tag: '@regression'},
		async ({page, pkpApi, asUser}) => {
			test.slow(); // scratch journal + wizard walk + settings flip + reload
			const tag = uniqueTag('m2');
			const {context} = await pkpApi.createJournal({
				tag,
				subjects: 'require',
				coverage: 'request',
				type: 'enable',
				submitWithCategories: true,
				categories: [
					{
						path: `par${tag}`,
						title: {en: `Parent ${tag}`},
						children: [{path: `chi${tag}`, title: {en: `Child ${tag}`}}],
					},
				],
				sections: [ART_SECTION],
				users: [{username: 'author.alex', roles: ['author']}],
			});
			const journalPath = context.path;

			const wizard = new SubmissionWizardPage(page, journalPath);
			await wizard.goto();
			await wizard.start({title: `Mirror ${tag}`});
			const submissionId = wizard.currentSubmissionId();
			await walkTo(wizard, 'For the Editors');

			// Subjects: first metadata field, required marker, visible
			// description (the workflow page shows the same text as a
			// tooltip instead — scenario 5's business).
			await expect(
				wizard.fieldControl('forTheEditors', 'subjects', 'en'),
			).toBeVisible();
			await expect(
				wizard.fieldRequiredMarker('forTheEditors', 'subjects', 'en'),
			).toBeVisible();
			await expect(
				page.getByText(
					'Subjects will be keywords, key phrases or classification codes that describe a topic of the submission.',
				),
			).toBeVisible();
			const fteForm = page.locator('form.pkpForm', {
				has: wizard.fieldControl('forTheEditors', 'subjects', 'en'),
			});
			await expect(fteForm.locator('.pkpFormField').first()).toContainText(
				'Subjects',
			);

			// Coverage: present, NOT marked required.
			await expect(
				wizard.fieldControl('forTheEditors', 'coverage', 'en'),
			).toBeVisible();
			await expect(
				wizard.fieldRequiredMarker('forTheEditors', 'coverage', 'en'),
			).toHaveCount(0);

			// Type (enable-only) and Rights (off): absent from the wizard.
			await expect(
				wizard.fieldControl('forTheEditors', 'type', 'en'),
			).toHaveCount(0);
			await expect(
				wizard.fieldControl('forTheEditors', 'rights', 'en'),
			).toHaveCount(0);

			// Categories (setting on + a non-empty tree) and the always-on
			// comments box close the step.
			await expect(
				page.getByRole('button', {name: 'Select Categories'}),
			).toBeVisible();
			await expect(
				page.locator('#commentsForTheEditors-commentsForTheEditors-control'),
			).toBeAttached();

			// The manager turns every type off and sets Categories to "No…":
			// on the author's next load the step is just the comments box.
			const setContext = await makeContextSetter(asUser, journalPath, context.id);
			await setContext({
				subjects: '0', // the contexts API validates these as strings
				coverage: '0',
				type: '0',
				submitWithCategories: false,
			});

			await page.goto(wizardUrl(submissionId, journalPath));
			await expect(page.locator('.submissionWizard')).toBeVisible({
				timeout: 20_000,
			});
			await walkTo(wizard, 'For the Editors');
			// The step's introductory help text still renders…
			await expect(
				page.getByText(
					'When entering metadata, provide entries that you think would be most helpful',
				),
			).toBeVisible();
			// …above a step reduced to the comments box.
			await expect(
				wizard.fieldControl('forTheEditors', 'subjects', 'en'),
			).toHaveCount(0);
			await expect(
				wizard.fieldControl('forTheEditors', 'coverage', 'en'),
			).toHaveCount(0);
			await expect(
				page.getByRole('button', {name: 'Select Categories'}),
			).toHaveCount(0);
			await expect(
				page.locator('#commentsForTheEditors-commentsForTheEditors-control'),
			).toBeAttached();
		},
	);

	// Canonical scenario 3 — typing terms with suggestions: a term
	// already stored on another submission of the same journal is
	// offered while typing a lowercase mid-substring; picking it adds a
	// removable chip; a never-seen term free-types into a chip; the
	// already-chosen term is re-offered and re-selecting duplicates the
	// chip; removing a chip deletes just that term.
	//
	// ⚠ As-built the suggestion pool is NOT journal-scoped (spec Known
	// deviations #1): only the arbitrary scopeWithContextId "winner" —
	// in practice publicknowledge, whose vocab rows are physically first
	// — gets suggestions at all. The scenario's Subjects field can't be
	// enabled on publicknowledge without mutating shared settings, so
	// the UI leg drives Keywords (rule 4: the same shared type-ahead
	// primitive, Details step) on publicknowledge, and the leak itself
	// is asserted at the API against a scratch journal.
	test(
		'Typing subjects with suggestions',
		{tag: '@regression'},
		async ({page, pkpApi}) => {
			test.slow(); // two seeded submissions + scratch journal + wizard walk
			const tag = uniqueTag('m3');
			const seededTerm = `Genetics${tag}`;

			// Another submission of the same journal already carries the term.
			await pkpApi.createSubmission(
				draftSpec({
					tag: `${tag}src`,
					title: `Vocab source ${tag}`,
					submitter: 'author.bea',
					metadata: {keywords: {en: [seededTerm]}},
				}),
			);
			const {submission} = await pkpApi.createSubmission(
				draftSpec({tag, title: `Vocab typing ${tag}`}),
			);

			const wizard = new SubmissionWizardPage(page);
			await page.goto(wizardUrl(submission.id));
			await expect(page.locator('.submissionWizard')).toBeVisible({
				timeout: 20_000,
			});
			await walkTo(wizard, 'Details');

			const input = wizard.fieldControl('titleAbstract', 'keywords', 'en');

			// Typing a lowercase mid-substring offers the stored term
			// (matching anywhere in the term, ignoring case).
			await input.click();
			await input.pressSequentially(`etics${tag}`, {delay: 20});
			const suggestion = page
				.locator('.autosuggest__results-item', {hasText: seededTerm})
				.first();
			await expect(suggestion).toBeVisible({timeout: 10_000});
			await suggestion.click();
			await expect(
				wizard.vocabChip('titleAbstract', 'keywords', seededTerm),
			).toBeVisible();

			// A term the journal has never seen free-types into a chip.
			const newTerm = `Genomic${tag}`;
			await wizard.addVocabChip('titleAbstract', 'keywords', newTerm);

			// The already-chosen term is re-offered; re-selecting adds a
			// second, identical chip — nothing guards against duplicates.
			await input.click();
			await input.pressSequentially(`etics${tag}`, {delay: 20});
			await expect(suggestion).toBeVisible({timeout: 10_000});
			await suggestion.click();
			const seededChips = page
				.locator('.pkpAutosuggest', {has: input})
				.locator('.pkpAutosuggest__selection', {hasText: seededTerm});
			await expect(seededChips).toHaveCount(2);

			// Removing a chip via its control deletes just that term.
			await seededChips
				.first()
				.getByRole('button', {name: `Remove ${seededTerm}`})
				.click();
			await expect(seededChips).toHaveCount(1);
			await expect(
				wizard.vocabChip('titleAbstract', 'keywords', newTerm),
			).toBeVisible();

			// ⚠ As-built leak (spec Known deviations #1), asserted at the
			// API: a term saved only on a scratch journal is offered on
			// publicknowledge, while the scratch journal itself gets no
			// suggestions at all — not even its own term.
			const leakTerm = `Leak${tag}`;
			const {context} = await pkpApi.createJournal({
				tag: `${tag}x`,
				sections: [ART_SECTION],
				users: [{username: 'author.alex', roles: ['author']}],
			});
			await pkpApi.createSubmission(
				draftSpec({
					tag: `${tag}xs`,
					title: `Leak source ${tag}`,
					journal: context.path,
					metadata: {keywords: {en: [leakTerm]}},
				}),
			);
			const scratchRes = await page.request.get(
				`/index.php/${context.path}/api/v1/vocabs?vocab=submissionKeyword&term=leak${tag}&locale=en`,
			);
			expect(scratchRes.ok()).toBe(true);
			expect(JSON.stringify(await scratchRes.json())).not.toContain(leakTerm);
			const pkRes = await page.request.get(
				`/index.php/publicknowledge/api/v1/vocabs?vocab=submissionKeyword&term=leak${tag}&locale=en`,
			);
			expect(pkRes.ok()).toBe(true);
			expect(JSON.stringify(await pkRes.json())).toContain(leakTerm);
		},
	);

	// Canonical scenario 4 — required metadata blocks the submission:
	// with Subjects on require and everything else complete, the Review
	// step paints the problems banner, "This field is required." on the
	// For the Editors panel, and a disabled Submit; the panel's Edit
	// returns to the step; after adding a subject the warning clears and
	// Submit confirms + completes.
	//
	// ⚠ The same journal seeds dataCitations=require to encode spec
	// Known deviations #2: "Data citations are required." stays painted
	// on the Details panel, yet no problems banner appears for it and
	// the submission completes anyway (validateSubmit()'s
	// array-to-string cast makes the require check a no-op).
	test(
		'Required metadata blocks the submission',
		{tag: '@regression'},
		async ({page, pkpApi}) => {
			test.slow(); // scratch journal + wizard walk + two Review validations
			const tag = uniqueTag('m4');
			const {context} = await pkpApi.createJournal({
				tag,
				subjects: 'require',
				dataCitations: 'require',
				sections: [ART_SECTION],
				users: [{username: 'author.alex', roles: ['author']}],
			});

			const wizard = new SubmissionWizardPage(page, context.path);
			await wizard.goto();
			await wizard.start({title: `Blocked ${tag}`});
			await wizard.expectStep('Upload Files');
			const item = await wizard.uploadFile(PDF);
			await wizard.assignPrimaryGenre(item, 'Article Text');

			// Everything complete but Subjects: the Review step flags it.
			await walkTo(wizard, 'Review');
			await awaitReviewCheck(page);
			await expect(wizard.reviewErrorsBanner).toBeVisible();
			await expect(wizard.reviewErrorsBanner).toContainText(
				'There are one or more problems that need to be fixed before you can submit',
			);
			const ftePanel = wizard.reviewPanel(/For the Editors/);
			await expect(
				wizard.reviewPanelItem(/For the Editors/, 'Subjects'),
			).toContainText('This field is required.');
			await expect(wizard.footerSubmit).toBeDisabled();

			// ⚠ As-built: the empty require-mode Data Citations only gets an
			// item-level message on the Details panel — it never feeds the
			// aggregate problems gate.
			await expect(wizard.reviewPanel(/^Details/)).toContainText(
				'Data citations are required.',
			);

			// The panel's Edit button returns to the For the Editors step.
			await ftePanel.getByRole('button', {name: 'Edit'}).click();
			await wizard.expectStep('For the Editors');
			await wizard.addVocabChip('forTheEditors', 'subjects', `Subject ${tag}`);

			// Back on Review: banner + error gone, Submit enabled…
			await wizard.gotoStep('Review');
			await awaitReviewCheck(page);
			await expect(wizard.footerSubmit).toBeEnabled({timeout: 20_000});
			await expect(wizard.reviewErrorsBanner).toBeHidden();
			await expect(ftePanel).not.toContainText('This field is required.');
			// ⚠ …while the data-citations message is still painted.
			await expect(wizard.reviewPanel(/^Details/)).toContainText(
				'Data citations are required.',
			);

			// Submit asks for confirmation, then completes — ⚠ despite the
			// require-mode Data Citations being empty.
			const dialog = await wizard.openSubmitDialog();
			await expect(dialog).toContainText('will be submitted to');
			await dialog.getByRole('button', {name: 'Submit'}).click();
			await expect(
				page.getByRole('heading', {name: 'Submission complete'}),
			).toBeVisible({timeout: 20_000});
		},
	);

	// Canonical scenario 5 — workflow-only metadata: with Type on "Do
	// not request…" the author's wizard never mentions Type; after
	// submission a Section Editor finds Type — with Keywords, Subjects
	// and the other enabled types — under the version's Metadata entry,
	// fills it in and saves; nothing there is marked required, even for
	// require-mode types.
	test(
		'Workflow-only metadata',
		{tag: '@regression'},
		async ({page, pkpApi, asUser}) => {
			test.slow(); // scratch journal + wizard walk + second actor
			const tag = uniqueTag('m5');
			const {context} = await pkpApi.createJournal({
				tag,
				type: 'enable',
				subjects: 'require',
				sections: [ART_SECTION],
				users: [
					{username: 'author.alex', roles: ['author']},
					{username: 'sectioneditor.ana', roles: ['sectionEditor']},
				],
			});
			const journalPath = context.path;

			// The author's wizard never mentions Type (enable = workflow
			// only) — neither on For the Editors nor anywhere else.
			const {submission: draft} = await pkpApi.createSubmission(
				draftSpec({
					tag: `${tag}d`,
					title: `Wizard silent ${tag}`,
					journal: journalPath,
				}),
			);
			const wizard = new SubmissionWizardPage(page, journalPath);
			await page.goto(wizardUrl(draft.id, journalPath));
			await expect(page.locator('.submissionWizard')).toBeVisible({
				timeout: 20_000,
			});
			await walkTo(wizard, 'For the Editors');
			await expect(
				wizard.fieldControl('forTheEditors', 'subjects', 'en'),
			).toBeVisible();
			await expect(
				wizard.fieldControl('forTheEditors', 'type', 'en'),
			).toHaveCount(0);

			// A submitted sibling: the Section Editor opens its Metadata
			// entry and finds the whole enabled set.
			const {submission} = await pkpApi.createSubmission({
				tag,
				journal: journalPath,
				submitter: 'author.alex',
				section: 'ART',
				locale: 'en',
				submitted: true,
				participants: [{user: 'sectioneditor.ana', role: 'sectionEditor'}],
				publications: [
					{
						metadata: {
							title: {en: `Workflow metadata ${tag}`},
							subjects: {en: [`Seeded subject ${tag}`]},
						},
					},
				],
			});

			const anaCtx = await asUser('sectioneditor.ana');
			const anaPage = await anaCtx.newPage();
			const workflow = new EditorialWorkflowPage(anaPage);
			await workflow.goto(submission.id, {journalPath});
			await expect(
				anaPage.getByRole('heading', {name: 'Workflow: Submission'}),
			).toBeVisible({timeout: 20_000});
			await workflow.openPublicationPanel('Metadata');

			const typeControl = anaPage.locator('#metadata-type-control-en');
			await expect(typeControl).toBeVisible({timeout: 20_000});
			await expect(
				anaPage.locator('#metadata-keywords-control-en'),
			).toBeVisible();
			await expect(
				anaPage.locator('#metadata-subjects-control-en'),
			).toBeVisible();

			// No required markers on the workflow variant — not even for
			// the require-mode Subjects.
			await expect(
				anaPage.locator(
					'label[for="metadata-subjects-control-en"] .pkpFormFieldLabel__required',
				),
			).toHaveCount(0);
			await expect(
				anaPage.locator(
					'label[for="metadata-type-control-en"] .pkpFormFieldLabel__required',
				),
			).toHaveCount(0);

			// Fill Type and save.
			await typeControl.fill(`Case study ${tag}`);
			const metadataForm = anaPage.locator('form.pkpForm', {has: typeControl});
			await Promise.all([
				anaPage.waitForResponse(
					(res) =>
						/\/publications\/\d+/.test(res.url()) &&
						['POST', 'PUT'].includes(res.request().method()) &&
						res.ok(),
					{timeout: 20_000},
				),
				metadataForm.getByRole('button', {name: 'Save', exact: true}).click(),
			]);
			await expect(
				metadataForm.locator('[role="status"]', {hasText: 'Saved'}),
			).toBeVisible({timeout: 15_000});
		},
	);

	// Canonical scenario 6 — categories at submission: with the setting
	// on and a nested tree, the For the Editors step gains a Categories
	// field whose "Select Categories" chooser lists children indented
	// under parents; a saved choice shows as a removable chip with the
	// full path, mirrored on the Review step ("None selected" before);
	// with the setting on but no categories, the field is absent.
	test(
		'Categories at submission',
		{tag: '@regression'},
		async ({page, pkpApi}) => {
			test.slow(); // two scratch journals + two wizard walks
			const tag = uniqueTag('m6');
			const parent = `Parent ${tag}`;
			const child = `Child ${tag}`;
			const {context} = await pkpApi.createJournal({
				tag,
				submitWithCategories: true,
				categories: [
					{
						path: `par${tag}`,
						title: {en: parent},
						children: [{path: `chi${tag}`, title: {en: child}}],
					},
				],
				sections: [ART_SECTION],
				users: [{username: 'author.alex', roles: ['author']}],
			});

			const wizard = new SubmissionWizardPage(page, context.path);
			await wizard.goto();
			await wizard.start({title: `Categories ${tag}`});
			await walkTo(wizard, 'For the Editors');
			await expect(
				page.getByText(
					'Select only the categories that are appropriate for your submission.',
				),
			).toBeVisible();

			// Skipping the field shows "None selected" on Review.
			await walkTo(wizard, 'Review');
			await awaitReviewCheck(page);
			await expect(
				wizard.reviewPanelItem(/For the Editors/, 'Categories'),
			).toContainText('None selected');

			// Back to the step: the chooser lists the tree, children
			// indented under their parents (depth-based padding).
			await wizard.gotoStep('For the Editors');
			await page.getByRole('button', {name: 'Select Categories'}).click();
			const modal = page.locator('[data-cy="active-modal"]');
			await expect(
				modal.getByRole('heading', {name: 'Select Categories'}),
			).toBeVisible({timeout: 15_000});
			const parentLabel = modal.locator('label', {hasText: parent}).first();
			const childLabel = modal.locator('label', {hasText: child}).first();
			await expect(parentLabel).toBeVisible();
			await expect(childLabel).toBeVisible();

			// Tick the child and save: a removable chip with the full path.
			await childLabel.locator('input[type="checkbox"]').check();
			await modal.getByRole('button', {name: 'Save', exact: true}).click();
			await expect(
				modal.getByRole('heading', {name: 'Select Categories'}),
			).toHaveCount(0, {timeout: 10_000});
			const chip = page
				.locator('.pkpAutosuggest__selection', {
					hasText: `${parent} > ${child}`,
				})
				.first();
			await expect(chip).toBeVisible();
			await expect(chip.getByRole('button')).toBeVisible(); // the remove control

			// The Review step lists the same full path.
			await wizard.gotoStep('Review');
			await awaitReviewCheck(page);
			await expect(
				wizard.reviewPanelItem(/For the Editors/, 'Categories'),
			).toContainText(`${parent} > ${child}`);

			// Setting on but no categories defined: no field at all.
			const {context: bare} = await pkpApi.createJournal({
				tag: `${tag}b`,
				submitWithCategories: true,
				sections: [ART_SECTION],
				users: [{username: 'author.alex', roles: ['author']}],
			});
			const wizardB = new SubmissionWizardPage(page, bare.path);
			await wizardB.goto();
			await wizardB.start({title: `No categories ${tag}`});
			await walkTo(wizardB, 'For the Editors');
			await expect(
				page.locator('#commentsForTheEditors-commentsForTheEditors-control'),
			).toBeAttached();
			await expect(
				page.getByRole('button', {name: 'Select Categories'}),
			).toHaveCount(0);
		},
	);

	// Canonical scenario 7 — data availability statement, asked vs
	// required: on "ask" the rich-text section renders and an empty
	// statement submits fine; flipped to "require" the same empty field
	// becomes a Review-step error until a statement is written; after
	// submission the statement is editable under the version's "Data"
	// entry, not under "Metadata".
	test(
		'Data availability statement asked vs required',
		{tag: '@regression'},
		async ({page, pkpApi, asUser}) => {
			test.slow(); // scratch journal + settings flip + reload + workflow side
			const tag = uniqueTag('m7');
			const {context} = await pkpApi.createJournal({
				tag,
				dataAvailability: 'request',
				sections: [ART_SECTION],
				users: [{username: 'author.alex', roles: ['author']}],
			});
			const journalPath = context.path;

			const wizard = new SubmissionWizardPage(page, journalPath);
			await wizard.goto();
			await wizard.start({title: `Data availability ${tag}`});
			const submissionId = wizard.currentSubmissionId();
			await wizard.expectStep('Upload Files');
			const item = await wizard.uploadFile(PDF);
			await wizard.assignPrimaryGenre(item, 'Article Text');

			// Ask mode: the section renders, unmarked; empty submits fine.
			await walkTo(wizard, 'For the Editors');
			await expect(
				wizard.fieldControl('dataAvailability', 'dataAvailability', 'en'),
			).toBeAttached();
			await expect(
				wizard.fieldRequiredMarker('dataAvailability', 'dataAvailability', 'en'),
			).toHaveCount(0);
			await walkTo(wizard, 'Review');
			await awaitReviewCheck(page);
			await expect(wizard.reviewErrorsBanner).toBeHidden();
			await expect(wizard.footerSubmit).toBeEnabled({timeout: 20_000});

			// Flip to require: on reload the same empty field blocks.
			const setContext = await makeContextSetter(asUser, journalPath, context.id);
			await setContext({dataAvailability: 'require'});
			await page.goto(wizardUrl(submissionId, journalPath));
			await expect(page.locator('.submissionWizard')).toBeVisible({
				timeout: 20_000,
			});
			await walkTo(wizard, 'Review');
			await awaitReviewCheck(page);
			await expect(wizard.reviewErrorsBanner).toBeVisible();
			await expect(
				wizard.reviewPanelItem(/For the Editors/, 'Data Availability Statement'),
			).toContainText('This field is required.');
			await expect(wizard.footerSubmit).toBeDisabled();

			// Write the statement (now marked required) and submit.
			await wizard.gotoStep('For the Editors');
			await expect(
				wizard.fieldRequiredMarker('dataAvailability', 'dataAvailability', 'en'),
			).toBeVisible();
			const statement = `Data for ${tag} is available on request.`;
			await setTinyMceContent(
				page,
				'dataAvailability-dataAvailability-control-en',
				statement,
			);
			await wizard.gotoStep('Review');
			await awaitReviewCheck(page);
			await expect(wizard.reviewErrorsBanner).toBeHidden();
			await wizard.submit();

			// Workflow side: the statement lives under the version's "Data"
			// entry, not under "Metadata".
			const adminCtx = await asUser('admin');
			const adminPage = await adminCtx.newPage();
			const workflow = new EditorialWorkflowPage(adminPage);
			await workflow.goto(submissionId, {journalPath});
			await expect(
				adminPage.getByRole('heading', {name: 'Workflow: Submission'}),
			).toBeVisible({timeout: 20_000});
			await workflow.openPublicationPanel('Data');
			// The rich-text control's backing textarea is aria-hidden
			// (TinyMCE renders the visible editor) — assert attachment and
			// read the content through the editor itself.
			await expect(
				adminPage.locator('#dataAvailability-dataAvailability-control-en'),
			).toBeAttached({timeout: 20_000});
			await expect
				.poll(
					() =>
						getTinyMceContent(
							adminPage,
							'dataAvailability-dataAvailability-control-en',
						),
					{timeout: 20_000},
				)
				.toContain(statement);
			await workflow.openPublicationPanel('Metadata');
			await expect(
				adminPage.locator('#metadata-keywords-control-en'),
			).toBeVisible({timeout: 20_000});
			await expect(
				adminPage.locator('#metadata-dataAvailability-control-en'),
			).toHaveCount(0);
		},
	);

	// Canonical scenario 8 — two languages, one requirement: a button
	// named for the other language expands each multilingual field with
	// a second input, each field carries an N/2 languages-completed
	// counter, the Review step shows one For the Editors panel per
	// language, and require-mode Subjects is satisfied by the submission
	// language alone — the French panel just reads "None provided".
	test(
		'Two languages one requirement',
		{tag: '@regression'},
		async ({page, pkpApi}) => {
			test.slow(); // multilingual scratch journal + full wizard walk
			const tag = uniqueTag('m8');
			const {context} = await pkpApi.createJournal({
				tag,
				primaryLocale: 'en',
				supportedLocales: ['en', 'fr_CA'],
				subjects: 'require',
				coverage: 'request',
				sections: [ART_SECTION],
				users: [{username: 'author.alex', roles: ['author']}],
			});

			const wizard = new SubmissionWizardPage(page, context.path);
			await wizard.goto();
			await wizard.start({title: `Bilingual ${tag}`, locale: 'English'});
			await wizard.expectStep('Upload Files');
			const item = await wizard.uploadFile(PDF);
			await wizard.assignPrimaryGenre(item, 'Article Text');

			await walkTo(wizard, 'For the Editors');

			// The other language's inputs are collapsed until the form-top
			// toggle (named for that language) expands them.
			await expect(
				wizard.fieldControl('forTheEditors', 'coverage', 'fr_CA'),
			).not.toBeVisible();
			await wizard.toggleFormLocale(
				'forTheEditors',
				'coverage',
				'French (Canada)',
			);
			await expect(
				wizard.fieldControl('forTheEditors', 'coverage', 'fr_CA'),
			).toBeVisible();
			await expect(
				page.locator('label[for="forTheEditors-coverage-control-fr_CA"]'),
			).toContainText('French (Canada)');

			// The per-field languages-completed counter ticks up as values
			// are entered.
			const coverageField = page.locator('.pkpFormField', {
				has: wizard.fieldControl('forTheEditors', 'coverage', 'en'),
			});
			await expect(
				coverageField.getByText('0/2 languages completed'),
			).toBeVisible();
			await wizard
				.fieldControl('forTheEditors', 'coverage', 'en')
				.fill(`Arctic Canada ${tag}`);
			await expect(
				coverageField.getByText('1/2 languages completed'),
			).toBeVisible();

			// Require-mode Subjects: fill the submission language only.
			await wizard.addVocabChip('forTheEditors', 'subjects', `Subj ${tag}`);

			// Review: one For the Editors panel per language; the French
			// panel simply shows "None provided"; the check is satisfied.
			await walkTo(wizard, 'Review');
			await awaitReviewCheck(page);
			await expect(
				wizard.reviewPanel(/^For the Editors \(English\)/),
			).toBeVisible();
			const frPanel = wizard.reviewPanel(/^For the Editors \(French \(Canada\)\)/);
			await expect(frPanel).toBeVisible();
			await expect(
				wizard.reviewPanelItem(
					/^For the Editors \(French \(Canada\)\)/,
					'Subjects',
				),
			).toContainText('None provided');
			await expect(wizard.reviewErrorsBanner).toBeHidden();
			await expect(wizard.footerSubmit).toBeEnabled({timeout: 20_000});
			await wizard.submit();
		},
	);
});
