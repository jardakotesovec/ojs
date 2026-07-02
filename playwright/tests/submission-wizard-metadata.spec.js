// @ts-check
const {test, expect} = require('../support/fixtures.js');
const {
	SubmissionWizardPage,
} = require('../../lib/pkp/playwright/pages/SubmissionWizardPage.js');
const {
	WorkflowSettingsPage,
} = require('../../lib/pkp/playwright/pages/WorkflowSettingsPage.js');
const {
	setTinyMceContent,
} = require('../../lib/pkp/playwright/support/tinymce.js');

/**
 * Submission wizard — metadata ("For the Editors" questions). One test
 * per canonical scenario of
 * docs/product/specs/submission-wizard-metadata.md (7 scenarios).
 *
 * Placement: OJS root (scratch journals, journal sections and the OJS
 * settings surface are journal concepts), even though the wizard forms
 * themselves are shared.
 *
 * Seeding notes:
 *   - Metadata modes (subjects/type/disciplines/dataAvailability …)
 *     are journal settings: every mode flip lives on a per-test
 *     scratch journal — publicknowledge is read-only shared state and
 *     only its DEFAULTS (keywords on ask) are asserted here.
 *   - The context scenario's metadata-mode passthrough was extended
 *     (schema/context.json + ContextBuilderProcessor) to cover the
 *     full PKPMetadataSettingsForm family, mirroring the existing
 *     keywords/citations keys.
 *   - Drafts are wizard-resumable scenario submissions (`submitted:
 *     false`, `participants: []`); title + abstract are seeded so a
 *     require-mode metadata field is the ONLY thing blocking Review.
 *
 * Known app bug honoured (ledger row 62 / spec "Known deviations"):
 * controlled-vocab chip *suggestions* are mis-scoped by journal
 * (uncorrelated subquery — empty on most journals, cross-journal leak
 * on one). No assertion here depends on which stored terms are
 * suggested; chips are entered free-text (always offered as the raw
 * typed text), which is unaffected.
 *
 * Parallel-safety: tags are single hyphenless alphanumeric tokens,
 * every assertion is scoped to per-test scratch journals or per-test
 * drafts, and no shared journal settings are mutated.
 */

function uniqueTag() {
	const workerIndex = test.info().parallelIndex;
	const suffix = Math.random().toString(36).slice(2, 8);
	return `swm${workerIndex}x${suffix}`;
}

const DENIED_MESSAGE =
	'The current role does not have access to this operation.';

/**
 * Wizard-resumable draft owned by atester with no assigned
 * participants. Title (and optional abstract) seeded so walking to
 * Review only trips over the metadata mode under test.
 *
 * @param {Object} opts
 * @param {string} opts.tag
 * @param {string} opts.journal  journal urlPath
 * @param {string} opts.title
 * @param {string} [opts.abstract]
 */
function draftSpec({tag, journal, title, abstract}) {
	return {
		tag,
		journal,
		submitter: 'atester',
		section: 'ART',
		locale: 'en',
		submitted: false,
		participants: [],
		publications: [
			{
				metadata: {
					title: {en: title},
					...(abstract ? {abstract: {en: abstract}} : {}),
				},
			},
		],
	};
}

/**
 * Fetch the submission's current publication via REST with the page's
 * session — the deterministic "the autosave has landed" anchor used
 * before reloads and before Review re-validates stored state.
 *
 * @param {import('@playwright/test').Page} page
 * @param {number} submissionId
 * @param {string} journalPath
 * @returns {Promise<object|null>}
 */
async function fetchCurrentPublication(page, submissionId, journalPath) {
	const subRes = await page.request.get(
		`/index.php/${journalPath}/api/v1/submissions/${submissionId}`,
	);
	if (!subRes.ok()) return null;
	const sub = await subRes.json();
	if (!sub.currentPublicationId) return null;
	const pubRes = await page.request.get(
		`/index.php/${journalPath}/api/v1/submissions/${submissionId}/publications/${sub.currentPublicationId}`,
	);
	if (!pubRes.ok()) return null;
	return await pubRes.json();
}

/**
 * Open a seeded draft's wizard and wait for it to mount.
 *
 * @param {import('@playwright/test').Page} page
 * @param {string} journalPath
 * @param {number} submissionId
 */
async function openWizard(page, journalPath, submissionId) {
	await page.goto(`/index.php/${journalPath}/submission?id=${submissionId}`);
	await expect(page.locator('.submissionWizard')).toBeVisible({
		timeout: 20_000,
	});
}

/**
 * Walk forward through the wizard (footer Continue) until the named
 * step is current. Robust to how many steps the journal's config
 * produces and to which step a freshly (re)loaded wizard opens on.
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

/**
 * Assert that element A precedes element B in DOM order (e.g. Keywords
 * after Title in Details; the data availability section below the
 * metadata form).
 *
 * @param {import('@playwright/test').Page} page
 * @param {string} selectorA
 * @param {string} selectorB
 */
async function expectPrecedes(page, selectorA, selectorB) {
	const precedes = await page.evaluate(
		([a, b]) => {
			const ea = document.querySelector(a);
			const eb = document.querySelector(b);
			if (!ea || !eb) return `missing element: ${!ea ? a : b}`;
			return !!(
				ea.compareDocumentPosition(eb) & Node.DOCUMENT_POSITION_FOLLOWING
			);
		},
		[selectorA, selectorB],
	);
	expect(precedes, `${selectorA} should precede ${selectorB}`).toBe(true);
}

test.use({user: 'atester'});

test.describe('Submission wizard metadata', () => {
	// Canonical scenario 1 — scratch journal with Subjects required and
	// Type asked: required markers, free-text chips with Remove buttons,
	// the French (Canada) sub-field behind the form's language toggle,
	// and autosave persistence across a reload.
	test(
		'author answers the For-the-Editors questions (chips + multilingual)',
		{tag: '@regression'},
		async ({page, pkpApi}) => {
			test.slow(); // scratch journal + wizard walk + reload walk
			const tag = uniqueTag();
			const enTerm = `case studies ${tag}`;
			const frTerm = `études de cas ${tag}`;

			const {context} = await pkpApi.createJournal({
				tag,
				primaryLocale: 'en',
				supportedLocales: ['en', 'fr_CA'],
				users: [{username: 'atester', roles: ['author']}],
				subjects: 'require',
				type: 'request',
			});
			const {submission} = await pkpApi.createSubmission(
				draftSpec({
					tag,
					journal: context.path,
					title: `Chips ${tag}`,
					abstract: `Chips abstract ${tag}.`,
				}),
			);

			const wizard = new SubmissionWizardPage(page, context.path);
			await openWizard(page, context.path, submission.id);
			await walkToStep(page, wizard, 'For the Editors');

			// Subjects is marked "* Required"; Type is asked but unmarked.
			await expect(
				wizard.fieldRequiredMarker('forTheEditors', 'subjects'),
			).toBeVisible();
			await expect(
				wizard.fieldControl('forTheEditors', 'type'),
			).toBeVisible();
			await expect(
				wizard.fieldRequiredMarker('forTheEditors', 'type'),
			).toHaveCount(0);

			// Type + Enter makes a removable chip (free text — never
			// dependent on stored vocabulary suggestions, see header note).
			await wizard.addVocabChip('forTheEditors', 'subjects', enTerm);
			await expect(
				page.getByRole('button', {name: `Remove ${enTerm}`}),
			).toBeVisible();

			// The form's language toggle reveals the French sub-field,
			// labelled "Subjects in French (Canada)", for separate chips.
			await wizard.toggleFormLocale(
				'forTheEditors',
				'subjects',
				'French (Canada)',
			);
			await expect(
				wizard.fieldControl('forTheEditors', 'subjects', 'fr_CA'),
			).toBeVisible();
			await expect(
				page.getByText('Subjects in French (Canada)'),
			).toBeAttached();
			await wizard.addVocabChip('forTheEditors', 'subjects', frTerm, 'fr_CA');

			// Wizard autosaves flush on step change (currentStepIndex
			// watch → addAutosaves) — step forward, then anchor the saves
			// for both locales before reloading.
			await wizard.continueStep();
			await expect
				.poll(
					async () =>
						JSON.stringify(
							(await fetchCurrentPublication(page, submission.id, context.path))
								?.subjects ?? {},
						),
					{timeout: 20_000},
				)
				.toContain(enTerm);
			await expect
				.poll(
					async () =>
						JSON.stringify(
							(await fetchCurrentPublication(page, submission.id, context.path))
								?.subjects ?? {},
						),
					{timeout: 20_000},
				)
				.toContain(frTerm);

			// Values survive a full reload.
			await openWizard(page, context.path, submission.id);
			await walkToStep(page, wizard, 'For the Editors');
			await expect(
				wizard.vocabChip('forTheEditors', 'subjects', enTerm),
			).toBeVisible();
			await wizard.toggleFormLocale(
				'forTheEditors',
				'subjects',
				'French (Canada)',
			);
			await expect(
				wizard.vocabChip('forTheEditors', 'subjects', frTerm, 'fr_CA'),
			).toBeVisible();
		},
	);

	// Canonical scenario 2 — Subjects required + Type/Data Availability
	// asked: empty Subjects paints the problems banner and the
	// "This field is required." row on the ENGLISH For the Editors panel
	// only, ask-mode rows say "None provided" without errors, Submit is
	// disabled; one chip clears it all.
	test(
		'require blocks Submit, ask does not',
		{tag: ['@smoke', '@regression']},
		async ({page, pkpApi}) => {
			test.slow(); // scratch journal + two Review entries
			const tag = uniqueTag();
			const enTerm = `case studies ${tag}`;

			const {context} = await pkpApi.createJournal({
				tag,
				primaryLocale: 'en',
				supportedLocales: ['en', 'fr_CA'],
				users: [{username: 'atester', roles: ['author']}],
				subjects: 'require',
				type: 'request',
				dataAvailability: 'request',
			});
			const {submission} = await pkpApi.createSubmission(
				draftSpec({
					tag,
					journal: context.path,
					title: `Blocked ${tag}`,
					abstract: `Blocked abstract ${tag}.`,
				}),
			);

			const wizard = new SubmissionWizardPage(page, context.path);
			await openWizard(page, context.path, submission.id);
			await walkToStep(page, wizard, 'Review');

			// Problems banner + the required error on the English panel's
			// Subjects row; the French panel carries no error (required
			// means the submission language only).
			await expect(wizard.reviewErrorsBanner).toBeVisible({
				timeout: 20_000,
			});
			const subjectsItem = wizard.reviewPanelItem(
				/^For the Editors \(English\)/,
				'Subjects',
			);
			await expect(
				subjectsItem.getByText('This field is required.'),
			).toBeVisible();
			const frSubjectsItem = wizard.reviewPanelItem(
				/^For the Editors \(French \(Canada\)\)/,
				'Subjects',
			);
			await expect(frSubjectsItem).toBeVisible();
			await expect(
				frSubjectsItem.getByText('This field is required.'),
			).toHaveCount(0);

			// Ask-mode fields never block: "None provided", no errors.
			const typeItem = wizard.reviewPanelItem(
				/^For the Editors \(English\)/,
				'Type',
			);
			await expect(typeItem).toContainText('None provided');
			await expect(
				typeItem.getByText('This field is required.'),
			).toHaveCount(0);
			const dataItem = wizard.reviewPanelItem(
				/^For the Editors \(English\)/,
				'Data Availability Statement',
			);
			await expect(dataItem).toContainText('None provided');
			await expect(
				dataItem.getByText('This field is required.'),
			).toHaveCount(0);

			await expect(wizard.footerSubmit).toBeDisabled();

			// A single chip suffices; re-entering Review clears the banner
			// and enables Submit.
			await wizard.gotoStep('For the Editors');
			await wizard.addVocabChip('forTheEditors', 'subjects', enTerm);
			// Autosaves flush on step change; anchor from a neutral step so
			// Review's validation can't race the in-flight save.
			await wizard.gotoStep('Contributors');
			await expect
				.poll(
					async () =>
						JSON.stringify(
							(await fetchCurrentPublication(page, submission.id, context.path))
								?.subjects ?? {},
						),
					{timeout: 20_000},
				)
				.toContain(enTerm);

			await wizard.gotoStep('Review');
			await expect(wizard.footerSubmit).toBeEnabled({timeout: 20_000});
			await expect(wizard.reviewErrorsBanner).toHaveCount(0);
			await expect(
				subjectsItem.getByText('This field is required.'),
			).toHaveCount(0);
		},
	);

	// Canonical scenario 3 — Keywords live in the Details step: asked
	// and unmarked on publicknowledge (the default), required-marked and
	// Review-flagged on a require-mode scratch journal, absent entirely
	// on a collect-but-don't-ask journal.
	test(
		'keywords ride in the Details step',
		{tag: '@regression'},
		async ({page, pkpApi}) => {
			test.slow(); // publicknowledge walk + two scratch journals
			const tag = uniqueTag();

			// publicknowledge default: Keywords on ask — the chip field
			// renders in Details after Title, unmarked.
			const {submission: pkDraft} = await pkpApi.createSubmission(
				draftSpec({
					tag,
					journal: 'publicknowledge',
					title: `Keydefault ${tag}`,
				}),
			);
			const pkWizard = new SubmissionWizardPage(page);
			await openWizard(page, 'publicknowledge', pkDraft.id);
			await walkToStep(page, pkWizard, 'Details');
			await expect(
				pkWizard.fieldControl('titleAbstract', 'keywords'),
			).toBeVisible();
			await expect(
				pkWizard.fieldRequiredMarker('titleAbstract', 'keywords'),
			).toHaveCount(0);
			await expectPrecedes(
				page,
				'#titleAbstract-title-control-en',
				'#titleAbstract-keywords-control-en',
			);

			// Require mode marks the field and flags an empty walk to
			// Review (title + abstract seeded so Keywords is the only gap).
			// Each scratch journal needs its own tag — the journal path is
			// derived from it.
			const requireTag = uniqueTag();
			const {context: requireJournal} = await pkpApi.createJournal({
				tag: requireTag,
				users: [{username: 'atester', roles: ['author']}],
				keywords: 'require',
			});
			const {submission: requireDraft} = await pkpApi.createSubmission(
				draftSpec({
					tag,
					journal: requireJournal.path,
					title: `Keyrequire ${tag}`,
					abstract: `Keyrequire abstract ${tag}.`,
				}),
			);
			const requireWizard = new SubmissionWizardPage(
				page,
				requireJournal.path,
			);
			await openWizard(page, requireJournal.path, requireDraft.id);
			await walkToStep(page, requireWizard, 'Details');
			await expect(
				requireWizard.fieldRequiredMarker('titleAbstract', 'keywords'),
			).toBeVisible();
			await walkToStep(page, requireWizard, 'Review');
			await expect(requireWizard.reviewErrorsBanner).toBeVisible({
				timeout: 20_000,
			});
			const keywordsItem = requireWizard.reviewPanelItem(
				/^Details/,
				'Keywords',
			);
			await expect(
				keywordsItem.getByText('This field is required.'),
			).toBeVisible();
			await expect(requireWizard.footerSubmit).toBeDisabled();

			// Collect-but-don't-ask removes the field from Details.
			const quietTag = uniqueTag();
			const {context: quietJournal} = await pkpApi.createJournal({
				tag: quietTag,
				users: [{username: 'atester', roles: ['author']}],
				keywords: 'enable',
			});
			const {submission: quietDraft} = await pkpApi.createSubmission(
				draftSpec({
					tag,
					journal: quietJournal.path,
					title: `Keyquiet ${tag}`,
				}),
			);
			const quietWizard = new SubmissionWizardPage(page, quietJournal.path);
			await openWizard(page, quietJournal.path, quietDraft.id);
			await walkToStep(page, quietWizard, 'Details');
			// The title control is a TinyMCE-backed textarea (kept hidden by
			// the editor) — attached proves the Details form rendered.
			await expect(
				quietWizard.fieldControl('titleAbstract', 'title'),
			).toBeAttached();
			await expect(
				quietWizard.fieldControl('titleAbstract', 'keywords'),
			).toHaveCount(0);
		},
	);

	// Canonical scenario 4 — the manager drives Settings → Workflow →
	// Submission → Metadata and the author's wizard follows: ticking
	// "Enable subject metadata" reveals radios defaulting to "Do not
	// request…" (collect-only keeps the field out of the wizard), ask
	// mode brings the metadata form in, unticking every box leaves only
	// Comments for the Editor.
	test(
		'manager reconfigures the panel and the wizard follows',
		{tag: '@regression'},
		async ({page, pkpApi, asUser}) => {
			test.slow(); // three author walks + three panel saves
			const tag = uniqueTag();

			// Scratch journal at defaults: no For-the-Editors metadata
			// field collected at all.
			const {context} = await pkpApi.createJournal({
				tag,
				users: [
					{username: 'atester', roles: ['author']},
					{username: 'dbarnes', roles: ['manager']},
				],
			});
			const {submission} = await pkpApi.createSubmission(
				draftSpec({tag, journal: context.path, title: `Panel ${tag}`}),
			);
			const commentsLabel = page.locator(
				'label[for="commentsForTheEditors-commentsForTheEditors-control"]',
			);

			// Author baseline: For the Editors is Comments-only.
			const wizard = new SubmissionWizardPage(page, context.path);
			await openWizard(page, context.path, submission.id);
			await walkToStep(page, wizard, 'For the Editors');
			await expect(commentsLabel).toBeVisible();
			await expect(page.locator('[id^="forTheEditors-"]')).toHaveCount(0);

			// Manager: tick "Enable subject metadata" — radios appear,
			// defaulting to "Do not request…".
			const managerCtx = await asUser('dbarnes');
			const managerPage = await managerCtx.newPage();
			const settings = new WorkflowSettingsPage(managerPage, context.path);
			await settings.goto();
			const panel = await settings.openMetadataTab();
			const subjectsFieldset = settings.metadataFieldset(
				panel,
				'Enable subject metadata',
			);
			await expect(settings.enableCheckbox(subjectsFieldset)).not.toBeChecked();
			await expect(
				subjectsFieldset.locator('input[type="radio"]'),
			).toHaveCount(0);
			await settings.enableCheckbox(subjectsFieldset).check();
			await expect(
				settings.modeRadio(
					subjectsFieldset,
					'Do not request subjects from the author during submission.',
				),
			).toBeChecked();
			await settings.saveForm(panel);

			// Collect-only: the field stays out of the author's wizard.
			await openWizard(page, context.path, submission.id);
			await walkToStep(page, wizard, 'For the Editors');
			await expect(commentsLabel).toBeVisible();
			await expect(page.locator('[id^="forTheEditors-"]')).toHaveCount(0);

			// Ask mode: the metadata form (Subjects) appears.
			await subjectsFieldset
				.locator('label', {
					hasText: 'Ask the author to provide subjects during submission.',
				})
				.click();
			await settings.saveForm(panel);
			await openWizard(page, context.path, submission.id);
			await walkToStep(page, wizard, 'For the Editors');
			await expect(
				wizard.fieldControl('forTheEditors', 'subjects'),
			).toBeVisible();

			// Untick every metadata box: the metadata form vanishes — only
			// Comments for the Editor remains.
			await settings.enableCheckbox(subjectsFieldset).uncheck();
			await settings.saveForm(panel);
			await openWizard(page, context.path, submission.id);
			await walkToStep(page, wizard, 'For the Editors');
			await expect(commentsLabel).toBeVisible();
			await expect(page.locator('[id^="forTheEditors-"]')).toHaveCount(0);
		},
	);

	// Canonical scenario 5 — settings bind at submit time: with the
	// author parked on a fully valid Review page, the manager flips
	// Disciplines to require; the Submit click is refused server-side
	// (banner returns, Submit disables) and a reload reveals the new
	// required Disciplines field.
	test(
		'mid-flight require-flip binds at submit time',
		{tag: '@regression'},
		async ({page, pkpApi, asUser}) => {
			test.slow(); // wizard walk + settings flip + refused submit
			const tag = uniqueTag();

			const {context} = await pkpApi.createJournal({
				tag,
				users: [
					{username: 'atester', roles: ['author']},
					{username: 'dbarnes', roles: ['manager']},
				],
			});
			const {submission} = await pkpApi.createSubmission(
				draftSpec({
					tag,
					journal: context.path,
					title: `Midflight ${tag}`,
					abstract: `Midflight abstract ${tag}.`,
				}),
			);

			// Author reaches a fully valid Review page.
			const wizard = new SubmissionWizardPage(page, context.path);
			await openWizard(page, context.path, submission.id);
			await walkToStep(page, wizard, 'Review');
			await expect(wizard.footerSubmit).toBeEnabled({timeout: 20_000});
			await expect(wizard.reviewErrorsBanner).toHaveCount(0);

			// Manager flips Disciplines to require while that page is open.
			const managerCtx = await asUser('dbarnes');
			const managerPage = await managerCtx.newPage();
			const settings = new WorkflowSettingsPage(managerPage, context.path);
			await settings.goto();
			const panel = await settings.openMetadataTab();
			const disciplinesFieldset = settings.metadataFieldset(
				panel,
				'Enable disciplines metadata',
			);
			await settings.enableCheckbox(disciplinesFieldset).check();
			await disciplinesFieldset
				.locator('label', {
					hasText:
						'Require the author to provide disciplines before accepting their submission.',
				})
				.click();
			await settings.saveForm(panel);

			// The stale page's Submit is refused server-side: the PUT
			// (tunnelled via POST) 4xxes, the banner re-appears and Submit
			// disables. (The stale page has no Disciplines row to paint
			// the field error on — spec rule 4.)
			const dialog = await wizard.openSubmitDialog();
			const [submitResponse] = await Promise.all([
				page.waitForResponse(
					(res) =>
						/\/api\/v1\/submissions\/\d+\/submit/.test(res.url()) &&
						res.request().method() === 'POST',
					{timeout: 20_000},
				),
				dialog.getByRole('button', {name: 'Submit', exact: true}).click(),
			]);
			expect(submitResponse.status()).toBe(400);
			await expect(wizard.reviewErrorsBanner).toBeVisible({
				timeout: 20_000,
			});
			await expect(wizard.footerSubmit).toBeDisabled();

			// Reloading the wizard reveals the new required field.
			await openWizard(page, context.path, submission.id);
			await walkToStep(page, wizard, 'For the Editors');
			await expect(
				wizard.fieldControl('forTheEditors', 'disciplines'),
			).toBeVisible();
			await expect(
				wizard.fieldRequiredMarker('forTheEditors', 'disciplines'),
			).toBeVisible();
		},
	);

	// Canonical scenario 6 — the Data Availability Statement on ask: its
	// rich-text section renders below the metadata form, the entered
	// statement persists (autosave + reload) and shows on the For the
	// Editors review panel.
	test(
		'data availability statement collected at intake',
		{tag: '@regression'},
		async ({page, pkpApi}) => {
			test.slow(); // scratch journal + reload + review walk
			const tag = uniqueTag();
			const statement = `Data are available on request ${tag}.`;

			const {context} = await pkpApi.createJournal({
				tag,
				users: [{username: 'atester', roles: ['author']}],
				subjects: 'request',
				dataAvailability: 'request',
			});
			const {submission} = await pkpApi.createSubmission(
				draftSpec({
					tag,
					journal: context.path,
					title: `Datastatement ${tag}`,
					abstract: `Datastatement abstract ${tag}.`,
				}),
			);

			const wizard = new SubmissionWizardPage(page, context.path);
			await openWizard(page, context.path, submission.id);
			await walkToStep(page, wizard, 'For the Editors');

			// Its own rich-text section, below the metadata form.
			await expect(
				wizard.fieldControl('forTheEditors', 'subjects'),
			).toBeVisible();
			await expect(
				page.locator(
					'label[for="dataAvailability-dataAvailability-control-en"]',
				),
			).toBeVisible();
			await expect(
				wizard.fieldControl('dataAvailability', 'dataAvailability'),
			).toBeAttached();
			await expectPrecedes(
				page,
				'#forTheEditors-subjects-control-en',
				'#dataAvailability-dataAvailability-control-en',
			);

			// Enter the statement; step forward to flush the autosave
			// (autosaves fire on step change), then anchor it.
			await setTinyMceContent(
				page,
				'dataAvailability-dataAvailability-control-en',
				`<p>${statement}</p>`,
			);
			await wizard.continueStep();
			await expect
				.poll(
					async () =>
						(await fetchCurrentPublication(page, submission.id, context.path))
							?.dataAvailability?.en ?? '',
					{timeout: 20_000},
				)
				.toContain(tag);

			// Persists across a reload and shows on the review panel.
			await openWizard(page, context.path, submission.id);
			await walkToStep(page, wizard, 'Review');
			const dataItem = wizard.reviewPanelItem(
				/^For the Editors/,
				'Data Availability Statement',
			);
			await expect(dataItem).toContainText(statement);
		},
	);

	// Canonical scenario 7 — only managers configure the panel: the
	// author and a section editor are refused Settings → Workflow with
	// the standard denial; the journal manager reaches the Metadata
	// panel and their save confirms with "Saved".
	test(
		'only managers configure the panel',
		{tag: '@regression'},
		async ({page, pkpApi, asUser}) => {
			const tag = uniqueTag();

			const {context} = await pkpApi.createJournal({
				tag,
				users: [
					{username: 'atester', roles: ['author']},
					{username: 'dbuskins', roles: ['sectionEditor']},
					{username: 'dbarnes', roles: ['manager']},
				],
			});
			const settingsUrl = `/index.php/${context.path}/management/settings/workflow`;

			// The author is denied.
			await page.goto(settingsUrl);
			await expect(page).toHaveURL(/authorizationDenied/);
			await expect(page.getByText(DENIED_MESSAGE)).toBeVisible();

			// A section editor is denied too.
			const sectionEditorCtx = await asUser('dbuskins');
			const sectionEditorPage = await sectionEditorCtx.newPage();
			await sectionEditorPage.goto(settingsUrl);
			await expect(sectionEditorPage).toHaveURL(/authorizationDenied/);
			await expect(
				sectionEditorPage.getByText(DENIED_MESSAGE),
			).toBeVisible();

			// The journal manager gets the panel; saving confirms "Saved"
			// (scratch journal — publicknowledge settings stay untouched).
			const managerCtx = await asUser('dbarnes');
			const managerPage = await managerCtx.newPage();
			const settings = new WorkflowSettingsPage(managerPage, context.path);
			await settings.goto();
			const panel = await settings.openMetadataTab();
			const subjectsFieldset = settings.metadataFieldset(
				panel,
				'Enable subject metadata',
			);
			await expect(subjectsFieldset).toBeVisible();
			await settings.enableCheckbox(subjectsFieldset).check();
			await settings.saveForm(panel);
		},
	);
});
