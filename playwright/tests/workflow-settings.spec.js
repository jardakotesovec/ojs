// @ts-check
const path = require('path');
const {test, expect} = require('../support/fixtures.js');
const {
	setTinyMceContent,
} = require('../../lib/pkp/playwright/support/tinymce.js');
const {
	waitForJQueryIdle,
} = require('../../lib/pkp/playwright/support/jquery.js');
const {
	WorkflowSettingsPage,
} = require('../../lib/pkp/playwright/pages/WorkflowSettingsPage.js');
const {
	SubmissionWizardPage,
} = require('../../lib/pkp/playwright/pages/SubmissionWizardPage.js');
const {
	ReviewerManagerPage,
} = require('../../lib/pkp/playwright/pages/ReviewerManagerPage.js');
const {
	ReviewerSubmissionPage,
} = require('../../lib/pkp/playwright/pages/ReviewerSubmissionPage.js');

/**
 * Workflow settings — Settings → Workflow: the page and the settings
 * surfaces it owns (author guidance, metadata require-flip, the
 * file-components/genres manager, review setup, reviewer guidance, the
 * reviewer-recommendation vocabulary, and the Emails notification config).
 * One test per canonical scenario of docs/product/specs/workflow-settings.md
 * (8 named, 8 tests, 1:1).
 *
 * WHAT IS DRIVEN LIVE:
 *   - The REAL Vue pkp-forms on the page: submissionGuidanceSettings
 *     (Author Guidelines / Before-you-begin / Submission Checklist TinyMCE),
 *     Metadata (keyword require radio), Review Setup (defaultReviewMode radio
 *     + numWeeks text), Reviewer Guidance (reviewGuidelines + competingInterests
 *     TinyMCE), Emails (submissionAcknowledgement radio, copySubmissionAckAddress,
 *     the emailSignature prepared-content editor). Every save is ONE PUT to the
 *     journal-settings API (tunnelled POST + X-Http-Method-Override), confirmed
 *     by the "Saved" badge.
 *   - The legacy Components (genres) grid: add a custom component, duplicate-key
 *     rejection, rename a factory component (key read-only), the in-use delete
 *     alert (Article Text), soft-delete of an unused one, and Restore Defaults.
 *   - The Vue reviewer-recommendation manager: add a custom option; plus the
 *     recommendations API for status/delete and the in-use 406 locks.
 *   - Downstream effect-links (the spec verifies wiring, one live link per group):
 *     the wizard start page (checklist + before-you-begin) and About → Submissions
 *     (guidelines + checklist); the Details/Review keyword require-block; the
 *     wizard file-type list (custom genre offered + required-Article-Text block);
 *     the Add-Reviewer form defaults (method + due dates) and the created
 *     assignment; the reviewer's step-1 CI declaration + step-2 guidelines; the
 *     reviewer step-3 recommendation dropdown; and the submission-ack email
 *     (author + Bcc + signature marker) via Mailpit.
 *
 * KNOWN LEDGER ROWS asserted AS DOCUMENTED (feedback discipline — assert reality):
 *   - Row 124: the recommendations endpoints admit ROLE_ID_SUB_EDITOR and skip
 *     the settings gate, so a section editor the page turns away can still
 *     `POST reviewers/recommendations` → 200 and the option appears in the
 *     manager's list. Test 8 asserts the documented 200 + option creation — it
 *     does NOT flag it as a fix.
 *   - Row 125: the reminder-threshold 0–14 bound is client-side only (the schema
 *     enforces ≥ 0). NOT asserted as a server max anywhere in this suite.
 *
 * AUTH: `test.use({user: 'dbarnes'})` — dbarnes is manager of each test's OWN
 * scratch journal. Authors/reviewers/section-editors reach the scratch journals
 * via `asUser` (site-wide sessions). Public reads use explicit anonymous contexts.
 *
 * PARALLEL + isolation: every test seeds its OWN scratch journal (unique
 * hyphenless `wft…` tag) and mutates guidance / metadata / genres / review
 * defaults / recommendations / email config ONLY there — publicknowledge's
 * workflow settings are load-bearing suite-wide and are NEVER touched. Mailpit
 * reads are scoped by recipient + tag (test 7). Fully parallel at the flat root.
 */

const MANAGER = 'dbarnes';
const ARTICLE_FIXTURE = path.resolve(
	__dirname,
	'../../lib/pkp/playwright/fixtures/files/default-article.pdf',
);

// The role-denied JSONMessage a legacy grid returns to a non-manager
// (RoleBasedHandlerOperationPolicy) — spec footnote b / scenario 8.
const ROLE_DENIED = 'The current role does not have access to this operation.';

// The genre grid's DOM id (PKPHandler::setupBackendPage: component path,
// Handler dropped, lowercased/dashed).
const GENRE_GRID = 'component-grid-settings-genre-genregrid';

/** A unique, hyphenless, lowercased alphanumeric token (parallel + re-run isolation). */
function uniqueTag(prefix = 'wft') {
	const workerIndex = test.info().parallelIndex;
	const rand = Math.random().toString(36).slice(2, 8);
	return `${prefix}${workerIndex}x${rand}`;
}

/** Seed a scratch journal (dbarnes as manager + spec passthrough) → context. */
async function seedJournal(pkpApi, tag, extra = {}) {
	const {context} = await pkpApi.createJournal({
		tag,
		users: [{username: MANAGER, roles: ['manager']}, ...(extra.users ?? [])],
		...Object.fromEntries(
			Object.entries(extra).filter(([k]) => k !== 'users'),
		),
	});
	return context;
}

/** Read the session CSRF token from a loaded backend page (window.pkp / meta). */
async function csrfToken(page) {
	await page.waitForFunction(
		() =>
			!!window.pkp?.currentUser?.csrfToken ||
			!!document.querySelector('meta[name="csrf-token"]'),
		null,
		{timeout: 15_000},
	);
	return page.evaluate(
		() =>
			window.pkp?.currentUser?.csrfToken ||
			document
				.querySelector('meta[name="csrf-token"]')
				?.getAttribute('content'),
	);
}

/** Read another context's CSRF token off the site-level profile page. */
const csrfCache = new WeakMap();
async function csrfFor(ctx) {
	if (csrfCache.has(ctx)) return csrfCache.get(ctx);
	const res = await ctx.request.get('/index.php/index/user/profile');
	const html = await res.text();
	const m = html.match(/name="csrf-token" content="([^"]+)"/);
	if (!m) throw new Error(`csrf meta tag not found (${res.url()})`);
	csrfCache.set(ctx, m[1]);
	return m[1];
}

/** PUT journal settings through the same journal-settings API the forms use. */
async function putContext(requestCtx, ctxPath, contextId, data, csrf) {
	return requestCtx.put(`/index.php/${ctxPath}/api/v1/contexts/${contextId}`, {
		headers: {'X-Csrf-Token': csrf, 'Content-Type': 'application/json'},
		data,
	});
}

/** Fetch a submission's current publication (session request) — autosave anchor. */
async function fetchCurrentPublication(requestCtx, ctxPath, submissionId) {
	const subRes = await requestCtx.get(
		`/index.php/${ctxPath}/api/v1/submissions/${submissionId}`,
	);
	if (!subRes.ok()) return null;
	const sub = await subRes.json();
	if (!sub.currentPublicationId) return null;
	const pubRes = await requestCtx.get(
		`/index.php/${ctxPath}/api/v1/submissions/${submissionId}/publications/${sub.currentPublicationId}`,
	);
	if (!pubRes.ok()) return null;
	return pubRes.json();
}

/** GET the journal's settings JSON (manager session required). */
async function getContext(requestCtx, ctxPath, contextId) {
	const res = await requestCtx.get(
		`/index.php/${ctxPath}/api/v1/contexts/${contextId}`,
	);
	expect(res.ok(), `GET context ${res.status()}`).toBeTruthy();
	return res.json();
}

/** A fresh anonymous browser context (explicit empty storage state). */
async function newAnonContext(browser, baseURL) {
	return browser.newContext({
		baseURL,
		storageState: {cookies: [], origins: []},
	});
}

/**
 * Walk forward through the wizard (footer Continue) until the named step is
 * current — the only way to REACH an unstarted step (gotoStep can jump only to
 * already-started ones). Robust to how many steps the journal's config yields.
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
 * Resolve a live TinyMCE editor id from a stable control-id prefix, then set
 * its content. Handles the case where a field's multilingual flag toggles
 * whether the control id carries a locale suffix (emailSignature).
 */
async function setTinyMceByPrefix(page, idPrefix, html) {
	const handle = await page.waitForFunction(
		(prefix) => {
			const list =
				(typeof window.tinymce?.get === 'function'
					? window.tinymce.get()
					: null) ?? [];
			const editor = list.find(
				(e) => e.id.startsWith(prefix) && e.initialized,
			);
			return editor ? editor.id : false;
		},
		idPrefix,
		{timeout: 15_000},
	);
	const editorId = /** @type {string} */ (await handle.jsonValue());
	await setTinyMceContent(page, editorId, html);
}

// ── Genre-grid helpers (the legacy jQuery Components grid) ───────────────────
const genreGrid = (page) => page.locator('#genresGridContainer');

/** Open Settings → Workflow → Submission → Components and wait for the grid. */
async function openComponentsTab(page) {
	await page.locator('#submission-button').click();
	await page.locator('#components-button').click();
	await expect(
		page.locator(`a[id^="${GENRE_GRID}-addGenre-button-"]`),
	).toBeVisible({timeout: 20_000});
	await waitForJQueryIdle(page);
}

/**
 * Reload the Components tab from a clean page load. The legacy grid's Add/Edit
 * AjaxModals leave a Vue DialogOverlay open after a save that intercepts
 * subsequent grid clicks; a full navigation is the reliable reset between the
 * mutating phases.
 */
async function reopenComponents(page, settings) {
	await settings.goto();
	await openComponentsTab(page);
}

/** The grid row (`tr.gridRow`) whose text contains `name`. */
function genreRow(page, name) {
	return genreGrid(page).locator(
		`tr.gridRow[id^="${GENRE_GRID}-row-"]`,
		{hasText: name},
	);
}

/** Resolve a genre row's DOM id, or throw. */
async function genreRowId(page, name) {
	const id = await genreRow(page, name).first().getAttribute('id');
	if (!id) throw new Error(`genre row for '${name}' not found`);
	return id;
}

/** Expand a genre row's hidden action controls (`a.show_extras`). */
async function expandGenreRow(page, rowId) {
	const showExtras = page.locator(`tr#${rowId} a.show_extras`);
	if (await showExtras.count()) {
		await showExtras.first().click();
	}
}

/**
 * Open the Add-a-Component modal form (`form#genreForm`). A click landing
 * during the grid's post-save re-render is swallowed without opening the
 * AjaxModal (same hazard as the review-forms element grid), so retry the
 * click until the form actually appears.
 */
async function openAddGenreForm(page) {
	await waitForJQueryIdle(page);
	const link = page.locator(`a[id^="${GENRE_GRID}-addGenre-button-"]`);
	const form = page.locator('form#genreForm').last();
	for (let attempt = 0; ; attempt++) {
		try {
			await link.click({timeout: 5_000});
			await expect(form).toBeVisible({timeout: 5_000});
			return form;
		} catch (err) {
			if (await form.isVisible().catch(() => false)) return form;
			if (attempt >= 3) throw err;
			await waitForJQueryIdle(page);
		}
	}
}

/** Open a genre row's Edit modal form (`form#genreForm`), retrying swallowed clicks. */
async function openEditGenreForm(page, rowId) {
	await waitForJQueryIdle(page);
	const form = page.locator('form#genreForm').last();
	for (let attempt = 0; ; attempt++) {
		try {
			await expandGenreRow(page, rowId);
			await page
				.locator(`a[id^="${rowId}-editGenre-button-"]`)
				.click({timeout: 5_000});
			await expect(form).toBeVisible({timeout: 5_000});
			return form;
		} catch (err) {
			if (await form.isVisible().catch(() => false)) return form;
			if (attempt >= 3) throw err;
			await waitForJQueryIdle(page);
		}
	}
}

/** Save a legacy AjaxForm and wait for its modal to dismiss (success). */
async function saveGenreFormOk(page, form) {
	await form.getByRole('button', {name: 'Save', exact: true}).click();
	await expect(form).toBeHidden({timeout: 15_000});
	await waitForJQueryIdle(page);
}

test.use({user: MANAGER});

test.describe('Workflow settings — page + owned settings surfaces', () => {
	// ── Scenario 1 — Author guidance reaches the author ────────────────────────
	// The manager edits Author Guidelines, Before-you-begin and Submission
	// Checklist (Submission → Author Guidance), saves. An author starting a
	// submission sees Before-you-begin + the Checklist confirmation gate on the
	// wizard start page; the public About → Submissions page shows the
	// guidelines and checklist (rule 4).
	test(
		'author guidance reaches the wizard start and About → Submissions',
		{tag: ['@smoke', '@regression']},
		async ({page, pkpApi, asUser, browser, baseURL}) => {
			test.slow();
			const tag = uniqueTag();
			const guidelines = `Author guideline body ${tag}`;
			const beforeBegin = `Before you begin ${tag}`;
			const checklist = `Checklist requirement ${tag}`;
			const ctx = await seedJournal(pkpApi, tag, {
				primaryLocale: 'en',
				supportedLocales: ['en'],
				users: [{username: 'atester', roles: ['author']}],
			});

			// The REAL Author Guidance form (Submission → Author Guidance).
			const settings = new WorkflowSettingsPage(page, ctx.path);
			await settings.goto();
			await page.locator('#submission-button').click();
			await page.locator('#instructions-button').click();
			const panel = page.locator('#instructions');
			await expect(panel.locator('form').first()).toBeVisible({
				timeout: 15_000,
			});
			await setTinyMceByPrefix(
				page,
				'submissionGuidanceSettings-authorGuidelines-control',
				`<p>${guidelines}</p>`,
			);
			await setTinyMceByPrefix(
				page,
				'submissionGuidanceSettings-beginSubmissionHelp-control',
				`<p>${beforeBegin}</p>`,
			);
			await setTinyMceByPrefix(
				page,
				'submissionGuidanceSettings-submissionChecklist-control',
				`<p>${checklist}</p>`,
			);
			const saveRes = await settings.saveForm(panel);
			const echoed = await saveRes.json();
			expect(echoed.authorGuidelines.en).toContain(guidelines);
			expect(echoed.submissionChecklist.en).toContain(checklist);

			// The author's wizard start page shows Before-you-begin + the single
			// mandatory checklist confirmation (rule 4 — one HTML block gating start).
			const authorCtx = await asUser('atester');
			const authorPage = await authorCtx.newPage();
			const wizard = new SubmissionWizardPage(authorPage, ctx.path);
			await wizard.goto();
			await expect(
				authorPage.getByRole('heading', {name: 'Make a Submission'}),
			).toBeVisible({timeout: 20_000});
			await expect(authorPage.getByText(beforeBegin).first()).toBeVisible();
			await expect(authorPage.getByText(checklist).first()).toBeVisible();
			await expect(
				authorPage.getByText(
					'Yes, my submission meets all of these requirements.',
				),
			).toBeVisible();

			// About → Submissions (anonymous): guidelines + checklist render.
			const anon = await newAnonContext(browser, baseURL);
			const pub = await anon.newPage();
			await pub.goto(`/index.php/${ctx.path}/about/submissions`);
			await expect(
				pub.getByRole('heading', {level: 1, name: 'Submissions'}),
			).toBeVisible();
			await expect(pub.locator('#authorGuidelines')).toContainText(guidelines);
			await expect(
				pub.locator('.submission_checklist'),
			).toContainText(checklist);
			await anon.close();
		},
	);

	// ── Scenario 2 — Metadata require-flip bites in the wizard ─────────────────
	// The manager sets Keywords to "Require…" on the Metadata tab. The author's
	// Details step marks Keywords required and the Review step blocks submit
	// with "This field is required." until a keyword is entered (full matrix
	// owned by submission-wizard-metadata).
	test(
		'metadata keywords require-flip blocks the wizard at Review',
		{tag: '@regression'},
		async ({page, pkpApi, asUser}) => {
			test.slow();
			const tag = uniqueTag();
			const ctx = await seedJournal(pkpApi, tag, {
				primaryLocale: 'en',
				supportedLocales: ['en'],
				users: [{username: 'atester', roles: ['author']}],
			});

			// The REAL Metadata form: flip Keywords to Require and save.
			const settings = new WorkflowSettingsPage(page, ctx.path);
			await settings.goto();
			const panel = await settings.openMetadataTab();
			const keywordsFieldset = settings.metadataFieldset(
				panel,
				'Enable keyword metadata',
			);
			// Keywords ships enabled (schema default 'request') → radios visible.
			await expect(
				settings.enableCheckbox(keywordsFieldset),
			).toBeChecked();
			await settings
				.modeRadio(
					keywordsFieldset,
					'Require the author to suggest keywords before accepting their submission.',
				)
				.check();
			const saveRes = await settings.saveForm(panel);
			expect((await saveRes.json()).keywords).toBe('require');

			// A wizard-resumable draft (title + abstract seeded so Keywords is
			// the only gap), owned by atester.
			const {submission} = await pkpApi.createSubmission({
				tag,
				journal: ctx.path,
				submitter: 'atester',
				section: 'ART',
				locale: 'en',
				submitted: false,
				participants: [],
				publications: [
					{
						metadata: {
							title: {en: `Keyrequire ${tag}`},
							abstract: {en: `Abstract ${tag}.`},
						},
					},
				],
			});

			const authorCtx = await asUser('atester');
			const authorPage = await authorCtx.newPage();
			const wizard = new SubmissionWizardPage(authorPage, ctx.path);
			await authorPage.goto(
				`/index.php/${ctx.path}/submission?id=${submission.id}`,
			);
			await expect(authorPage.locator('.submissionWizard')).toBeVisible({
				timeout: 20_000,
			});

			// Details marks Keywords required (Keywords rides in the Details step).
			await wizard.expectStep('Upload Files');
			await wizard.continueStep();
			await wizard.expectStep('Details');
			await expect(
				wizard.fieldRequiredMarker('titleAbstract', 'keywords'),
			).toBeVisible();

			// Review blocks submit with the required-field error until answered.
			await walkToStep(authorPage, wizard, 'Review');
			await expect(wizard.reviewErrorsBanner).toBeVisible({timeout: 20_000});
			const keywordsItem = wizard.reviewPanelItem(/^Details/, 'Keywords');
			await expect(
				keywordsItem.getByText('This field is required.'),
			).toBeVisible();
			await expect(wizard.footerSubmit).toBeDisabled();
		},
	);

	// ── Scenario 3 — Component lifecycle ───────────────────────────────────────
	// The manager adds "Video Abstract" (supplementary, custom key; duplicate
	// key rejected), renames a factory component (key read-only), is refused on
	// an in-use one (Article Text — alert), soft-deletes an unused one
	// (Transcripts), then Restore Defaults — the factory set reverts while the
	// custom component survives. The author's next upload offers Video Abstract
	// among the file types; a submission whose only file is Video Abstract is
	// blocked at Review for the missing required Article Text (rules 5/6/7).
	test(
		'component lifecycle: add/dup-key/rename/in-use-alert/soft-delete/restore + wizard effect',
		{tag: '@regression'},
		async ({page, pkpApi, asUser}) => {
			test.slow();
			const tag = uniqueTag();
			const videoName = `Video Abstract ${tag}`;
			const videoKey = `videoabstract${tag}`; // ≤30 chars, alphanumeric
			const renamed = `Renamed DataSet ${tag}`;
			const ctx = await seedJournal(pkpApi, tag, {
				primaryLocale: 'en',
				supportedLocales: ['en'],
				users: [{username: 'atester', roles: ['author']}],
			});

			// Seed a submission so its Article Text file makes that component
			// in-use (blocks its deletion — rule 6).
			await pkpApi.createSubmission({
				tag,
				journal: ctx.path,
				submitter: 'atester',
				section: 'ART',
				locale: 'en',
				submitted: false,
				participants: [],
				publications: [{metadata: {title: {en: `Inuse sub ${tag}`}}}],
			});

			const settings = new WorkflowSettingsPage(page, ctx.path);
			await settings.goto();
			await openComponentsTab(page);

			// Phase A — add a custom supplementary component with a custom key.
			let form = await openAddGenreForm(page);
			await form.locator('input[name="name[en]"]').fill(videoName);
			await form.locator('input#supplementary').check();
			// fbv text inputs carry a runtime uniqId suffix on their id → key by name.
			await form.locator('input[name="key"]').fill(videoKey);
			await saveGenreFormOk(page, form);
			await expect(genreRow(page, videoName)).toBeVisible({timeout: 15_000});

			// The read-only genres lookup API (the wizard/file-managers' lookup)
			// now offers the custom component with its stored key.
			const lookup = await page.request.get(
				`/index.php/${ctx.path}/api/v1/genres?count=100`,
			);
			expect(lookup.ok(), `GET genres ${lookup.status()}`).toBeTruthy();
			const lookupItems = (await lookup.json()).items;
			expect(
				lookupItems.find((g) => g.key === videoKey),
				'custom component key stored + offered by the lookup API',
			).toBeTruthy();

			// Phase B — a duplicate key is rejected; the re-rendered form shows
			// the "key already exists" error inline and nothing is added.
			form = await openAddGenreForm(page);
			await form.locator('input[name="name[en]"]').fill(`Dupe ${tag}`);
			await form.locator('input[name="key"]').fill(videoKey);
			await form.getByRole('button', {name: 'Save', exact: true}).click();
			await expect(
				page.getByText('The key already exists.'),
			).toBeVisible({timeout: 15_000});
			// Dismiss the still-open modal by reloading the grid.
			await settings.goto();
			await openComponentsTab(page);
			await expect(genreRow(page, `Dupe ${tag}`)).toHaveCount(0);

			// Phase C — rename a factory component; its Key is read-only (rule:
			// keyReadOnly for the 12 factory components).
			let rowId = await genreRowId(page, 'Data Set');
			form = await openEditGenreForm(page, rowId);
			await expect(form.locator('input[name="key"]')).toHaveAttribute(
				'readonly',
				/.*/,
			);
			await form.locator('input[name="name[en]"]').fill(renamed);
			await saveGenreFormOk(page, form);
			await reopenComponents(page, settings);
			await expect(genreRow(page, renamed)).toBeVisible({timeout: 15_000});

			// Phase D — deleting an in-use component (Article Text) is refused
			// with the alert; the row survives (rule 6, as-built).
			rowId = await genreRowId(page, 'Article Text');
			await expandGenreRow(page, rowId);
			await page.locator(`a[id^="${rowId}-deleteGenre-button-"]`).click();
			let dialog = page
				.locator('[data-cy="dialog"]')
				.filter({hasText: 'Are you sure'});
			await expect(dialog).toBeVisible({timeout: 10_000});
			const [refuseRes] = await Promise.all([
				page.waitForResponse(
					(res) => /delete-genre/.test(res.url()),
					{timeout: 20_000},
				),
				dialog.getByRole('button', {name: 'OK', exact: true}).click(),
			]);
			expect(await refuseRes.text()).toContain(
				'associate all related submission files',
			);
			await waitForJQueryIdle(page);
			await expect(genreRow(page, 'Article Text')).toBeVisible();

			// Phase E — soft-delete an UNUSED factory component (Transcripts):
			// the row leaves the grid.
			await reopenComponents(page, settings);
			rowId = await genreRowId(page, 'Transcripts');
			await expandGenreRow(page, rowId);
			await page.locator(`a[id^="${rowId}-deleteGenre-button-"]`).click();
			dialog = page
				.locator('[data-cy="dialog"]')
				.filter({hasText: 'Are you sure'});
			await expect(dialog).toBeVisible({timeout: 10_000});
			const [deleteRes] = await Promise.all([
				page.waitForResponse(
					(res) => /delete-genre/.test(res.url()),
					{timeout: 20_000},
				),
				dialog.getByRole('button', {name: 'OK', exact: true}).click(),
			]);
			expect(deleteRes.status()).toBe(200);
			await waitForJQueryIdle(page);
			await expect(genreRow(page, 'Transcripts')).toHaveCount(0, {
				timeout: 15_000,
			});

			// Phase F — Restore Defaults: the factory set reverts (Transcripts
			// back, Data Set renamed→default) while the custom component survives
			// (rule 7).
			await reopenComponents(page, settings);
			await page.locator(`a[id^="${GENRE_GRID}-restoreGenres-button-"]`).click();
			dialog = page
				.locator('[data-cy="dialog"]')
				.filter({hasText: 'Are you sure'});
			await expect(dialog).toBeVisible({timeout: 10_000});
			await Promise.all([
				page.waitForResponse(
					(res) => /restore-genres/.test(res.url()),
					{timeout: 20_000},
				),
				dialog.getByRole('button', {name: 'OK', exact: true}).click(),
			]);
			await waitForJQueryIdle(page);
			await expect(genreRow(page, 'Transcripts')).toBeVisible({timeout: 15_000});
			await expect(genreRow(page, 'Data Set')).toBeVisible();
			await expect(genreRow(page, renamed)).toHaveCount(0);
			await expect(genreRow(page, videoName)).toBeVisible();

			// Phase G — the author's next upload offers Video Abstract in the
			// file-type list; a submission whose only file is Video Abstract is
			// blocked at Review for the missing required Article Text (rule 7).
			const authorCtx = await asUser('atester');
			const authorPage = await authorCtx.newPage();
			const wizard = new SubmissionWizardPage(authorPage, ctx.path);
			await wizard.goto();
			await wizard.start({title: `Videoonly ${tag}`});
			await wizard.expectStep('Upload Files');
			const fileItem = await wizard.uploadFile(ARTICLE_FIXTURE);
			// The supplementary custom genre is offered in the "Other" file-type
			// picker (dependent components would be hidden — rule Fields table).
			const genreForm = await wizard.openFileGenreForm(fileItem);
			await expect(
				genreForm.locator('label', {hasText: videoName}),
			).toBeVisible();
			await wizard.saveFileGenre(genreForm, fileItem, videoName);

			// Walk to Review — the required Article Text component is unmet.
			await walkToStep(authorPage, wizard, 'Review');
			await expect(
				authorPage.getByText(
					'You must upload at least one Article Text file.',
				),
			).toBeVisible({timeout: 20_000});
			await expect(wizard.footerSubmit).toBeDisabled();
		},
	);

	// ── Scenario 4 — Review defaults flow into a new assignment ────────────────
	// The manager sets Open review, 2-week response, 5-week completion; saves
	// (negative weeks and out-of-range mode are rejected on the endpoint). Add
	// Reviewer on a review-stage submission opens pre-set to Open with due dates
	// +2w/+5w; the created assignment carries them (rule 8).
	test(
		'review setup defaults pre-fill the Add-Reviewer form and the created assignment',
		{tag: ['@smoke', '@regression']},
		async ({page, pkpApi}) => {
			test.slow();
			const tag = uniqueTag();
			const ctx = await seedJournal(pkpApi, tag, {
				primaryLocale: 'en',
				supportedLocales: ['en'],
				users: [
					{username: 'jjanssen', roles: ['reviewer']},
					{username: 'atester', roles: ['author']},
				],
			});

			// The REAL Review Setup form: Open + 2w response + 5w completion.
			const settings = new WorkflowSettingsPage(page, ctx.path);
			await settings.goto();
			const panel = await settings.openReviewSetupTab();
			await panel
				.locator('input[name="defaultReviewMode"][value="3"]')
				.check();
			await panel.locator('#reviewSetup-numWeeksPerResponse-control').fill('2');
			await panel.locator('#reviewSetup-numWeeksPerReview-control').fill('5');
			const saveRes = await settings.saveForm(panel);
			const echoed = await saveRes.json();
			expect(echoed.defaultReviewMode).toBe(3);
			expect(echoed.numWeeksPerResponse).toBe(2);
			expect(echoed.numWeeksPerReview).toBe(5);

			// The endpoint rejects a negative deadline and an out-of-range mode.
			const csrf = await csrfToken(page);
			const badWeeks = await putContext(
				page.request,
				ctx.path,
				ctx.id,
				{numWeeksPerResponse: -1},
				csrf,
			);
			expect(badWeeks.status()).toBe(400);
			expect(await badWeeks.text()).toContain('at least 0');
			const badMode = await putContext(
				page.request,
				ctx.path,
				ctx.id,
				{defaultReviewMode: 9},
				csrf,
			);
			expect(badMode.status()).toBe(400);

			// A submission in external review (round 1), dbarnes deciding.
			const {submission} = await pkpApi.createSubmission({
				tag,
				journal: ctx.path,
				submitter: 'atester',
				section: 'ART',
				locale: 'en',
				participants: [{user: MANAGER, role: 'editor'}],
				decisions: [{type: 'sendExternalReview', by: MANAGER}],
				reviewRounds: [{reviewers: []}],
				publications: [{metadata: {title: {en: `Review defaults ${tag}`}}}],
			});

			// Add Reviewer: the assignment form opens pre-set to Open with due
			// dates +2w/+5w.
			const rm = new ReviewerManagerPage(page);
			await rm.gotoWorkflow(submission.id, {journalPath: ctx.path});
			const modal = await rm.openAddReviewerModal();
			await rm.searchSelectPanel(modal, 'jjanssen');
			const form = await rm.selectReviewer(modal, 'Julie Janssen');

			// Default review method = Open (3) is pre-checked (rule 8).
			await expect(
				form.locator('input[name="reviewMethod"][value="3"]').last(),
			).toBeChecked();

			// Response/completion due dates pre-fill +2w/+5w → a 21-day gap
			// (5w − 2w), TZ-independent.
			const responseDue = await form
				.locator('input[name="responseDueDate"]')
				.last()
				.inputValue();
			const reviewDue = await form
				.locator('input[name="reviewDueDate"]')
				.last()
				.inputValue();
			expect(responseDue).toMatch(/^\d{4}-\d{2}-\d{2}$/);
			expect(reviewDue).toMatch(/^\d{4}-\d{2}-\d{2}$/);
			const gapDays =
				(Date.parse(`${reviewDue}T00:00:00Z`) -
					Date.parse(`${responseDue}T00:00:00Z`)) /
				86_400_000;
			expect(gapDays).toBe(21);

			await rm.awaitRichTextContains(form, 'personalMessage', tag);
			await rm.submitLegacyForm(form, 'Add Reviewer', modal);
			await expect(rm.row('Julie Janssen')).toContainText('Request Sent', {
				timeout: 20_000,
			});

			// The created assignment carries the defaults: Open method, and
			// server-side dates anchored +14/+35 days from assignment.
			const assignments = await rm.fetchReviewAssignments(
				submission.id,
				ctx.path,
			);
			expect(assignments).toHaveLength(1);
			const a = assignments[0];
			expect(a.reviewMethod).toBe(3);
			const dayGap = (from, to) =>
				(Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) /
				86_400_000;
			expect(dayGap(a.dateAssigned, a.dateResponseDue)).toBe(14);
			expect(dayGap(a.dateAssigned, a.dateDue)).toBe(35);
		},
	);

	// ── Scenario 5 — Reviewer guidance reaches the reviewer ────────────────────
	// The manager writes Review Guidelines and a Competing Interests policy. The
	// reviewer's step 1 now demands a CI declaration (policy readable from the
	// link) and step 2 shows the guidelines verbatim (Fields table + rule).
	test(
		'reviewer guidance + competing interests reach the reviewer wizard steps',
		{tag: '@regression'},
		async ({page, pkpApi, asUser}) => {
			test.slow();
			const tag = uniqueTag();
			const guidelines = `Reviewer guideline body ${tag}`;
			const ciPolicy = `Competing interests policy ${tag}`;
			const ctx = await seedJournal(pkpApi, tag, {
				primaryLocale: 'en',
				supportedLocales: ['en'],
				users: [
					{username: 'jjanssen', roles: ['reviewer']},
					{username: 'atester', roles: ['author']},
				],
			});

			// The REAL Reviewer Guidance form.
			const settings = new WorkflowSettingsPage(page, ctx.path);
			await settings.goto();
			await page.locator('#review-button').click();
			await page.locator('#reviewerGuidance-button').click();
			const panel = page.locator('#reviewerGuidance');
			await expect(panel.locator('form').first()).toBeVisible({
				timeout: 15_000,
			});
			await setTinyMceByPrefix(
				page,
				'reviewerGuidance-reviewGuidelines-control',
				`<p>${guidelines}</p>`,
			);
			await setTinyMceByPrefix(
				page,
				'reviewerGuidance-competingInterests-control',
				`<p>${ciPolicy}</p>`,
			);
			const saveRes = await settings.saveForm(panel);
			const echoed = await saveRes.json();
			expect(echoed.reviewGuidelines.en).toContain(guidelines);
			expect(echoed.competingInterests.en).toContain(ciPolicy);

			// A submission in external review with jjanssen invited.
			const {submission} = await pkpApi.createSubmission({
				tag,
				journal: ctx.path,
				submitter: 'atester',
				section: 'ART',
				locale: 'en',
				participants: [{user: MANAGER, role: 'editor'}],
				decisions: [{type: 'sendExternalReview', by: MANAGER}],
				reviewRounds: [
					{reviewers: [{user: 'jjanssen', method: 'anonymous', status: 'invited'}]},
				],
				publications: [{metadata: {title: {en: `Reviewer guidance ${tag}`}}}],
			});

			// The reviewer's step 1 now demands a CI declaration, with the policy
			// behind the "Competing Interests" link.
			const reviewerCtx = await asUser('jjanssen');
			const reviewerPage = await reviewerCtx.newPage();
			const rp = new ReviewerSubmissionPage(reviewerPage);
			await rp.goto(submission.id, {journalPath: ctx.path});
			await expect(rp.step1Form).toBeVisible({timeout: 15_000});
			await expect(
				rp.step1Form.locator('input[name="competingInterestOption"]'),
			).toHaveCount(2);
			await expect(
				reviewerPage.getByText('I do not have any competing interests'),
			).toBeVisible();
			await expect(
				rp.step1Form.getByRole('link', {name: 'Competing Interests'}),
			).toBeVisible();

			// Step 2 shows the review guidelines verbatim.
			await rp.acceptInvitation();
			await expect(rp.step2Form).toContainText(guidelines, {timeout: 15_000});
		},
	);

	// ── Scenario 6 — Recommendation vocabulary round-trip ──────────────────────
	// On a journal with the six seeded options and one already-used ("Accept
	// Submission" — from a completed review), the manager adds "Fast-Track
	// Accept" (Approved), deactivates "See Comments", deletes "Resubmit
	// Elsewhere"; the in-use option refuses edit/delete (406) but toggles status
	// (rule 11). A reviewer completing a review picks from exactly the four
	// remaining defaults plus Fast-Track Accept (rule 12).
	test(
		'recommendation vocabulary round-trip: custom in / deactivated out / in-use lock',
		{tag: '@regression'},
		async ({page, pkpApi, asUser}) => {
			test.slow();
			const tag = uniqueTag();
			const customTitle = `Fast-Track Accept ${tag}`;
			const ctx = await seedJournal(pkpApi, tag, {
				primaryLocale: 'en',
				supportedLocales: ['en'],
				users: [
					{username: 'agallego', roles: ['reviewer']},
					{username: 'jjanssen', roles: ['reviewer']},
					{username: 'atester', roles: ['author']},
				],
			});

			// A submission with one completed review holding "Accept Submission"
			// (→ that option becomes in-use/non-removable) and one invited
			// reviewer we drive to the step-3 dropdown afterward.
			const {submission} = await pkpApi.createSubmission({
				tag,
				journal: ctx.path,
				submitter: 'atester',
				section: 'ART',
				locale: 'en',
				participants: [{user: MANAGER, role: 'editor'}],
				decisions: [{type: 'sendExternalReview', by: MANAGER}],
				reviewRounds: [
					{
						reviewers: [
							{
								user: 'agallego',
								method: 'anonymous',
								status: 'completed',
								recommendation: 'accept',
							},
							{user: 'jjanssen', method: 'anonymous', status: 'invited'},
						],
					},
				],
				publications: [{metadata: {title: {en: `Recs ${tag}`}}}],
			});

			// Add "Fast-Track Accept" (Approved) through the REAL Vue manager.
			const settings = new WorkflowSettingsPage(page, ctx.path);
			await settings.goto();
			await page.locator('#review-button').click();
			await page.locator('#reviewerRecommendations-button').click();
			const manager = page.locator(
				'[data-cy="reviewer-recommendation-manager"]',
			);
			await expect(manager).toBeVisible({timeout: 15_000});
			await manager
				.getByRole('button', {name: 'Add Recommendation'})
				.click();
			const addModal = page.locator('[data-cy="active-modal"]');
			await expect(
				addModal.locator('#reviewerRecommendation-title-control-en'),
			).toBeVisible({timeout: 15_000});
			await addModal
				.locator('#reviewerRecommendation-title-control-en')
				.fill(customTitle);
			await addModal
				.locator('#reviewerRecommendation-type-control')
				.selectOption({label: 'Approved'});
			await Promise.all([
				page.waitForResponse(
					(res) =>
						/\/reviewers\/recommendations$/.test(res.url()) &&
						res.request().method() === 'POST' &&
						res.ok(),
					{timeout: 20_000},
				),
				addModal.getByRole('button', {name: 'Save', exact: true}).click(),
			]);
			await expect(manager.getByText(customTitle)).toBeVisible({
				timeout: 15_000,
			});

			// Read the recommendation ids from the API (manager session).
			const recApi = `/index.php/${ctx.path}/api/v1/reviewers/recommendations`;
			const recById = async () => {
				const res = await page.request.get(recApi);
				expect(res.ok(), `GET recommendations ${res.status()}`).toBeTruthy();
				const items = (await res.json()).items;
				const map = {};
				for (const it of items) map[it.title.en] = it;
				return map;
			};
			let recs = await recById();
			const accept = recs['Accept Submission'];
			const seeComments = recs['See Comments'];
			const resubmitElsewhere = recs['Resubmit Elsewhere'];
			expect(accept, 'Accept Submission seeded').toBeTruthy();
			expect(accept.removable, 'Accept Submission is in-use').toBe(false);

			const csrf = await csrfToken(page);
			// Deactivate "See Comments" (status PUT → 200).
			const deact = await page.request.put(`${recApi}/${seeComments.id}/status`, {
				headers: {'X-Csrf-Token': csrf, 'Content-Type': 'application/json'},
				data: {status: 0},
			});
			expect(deact.status()).toBe(200);
			// Delete "Resubmit Elsewhere" (unused → hard delete, 200).
			const del = await page.request.delete(`${recApi}/${resubmitElsewhere.id}`, {
				headers: {'X-Csrf-Token': csrf, 'Content-Type': 'application/json'},
			});
			expect(del.status()).toBe(200);

			// The in-use option refuses edit AND delete (406) but allows a
			// status toggle (rule 11).
			const editInUse = await page.request.put(`${recApi}/${accept.id}`, {
				headers: {'X-Csrf-Token': csrf, 'Content-Type': 'application/json'},
				data: {title: {en: 'Hijack Accept'}, status: 1, type: 1},
			});
			expect(editInUse.status(), 'in-use edit refused').toBe(406);
			const deleteInUse = await page.request.delete(`${recApi}/${accept.id}`, {
				headers: {'X-Csrf-Token': csrf, 'Content-Type': 'application/json'},
			});
			expect(deleteInUse.status(), 'in-use delete refused').toBe(406);
			const statusInUse = await page.request.put(`${recApi}/${accept.id}/status`, {
				headers: {'X-Csrf-Token': csrf, 'Content-Type': 'application/json'},
				data: {status: 1},
			});
			expect(statusInUse.status(), 'in-use status toggle allowed').toBe(200);

			// Manager list reflects the state: See Comments present but inactive,
			// Resubmit Elsewhere gone, Accept Submission has no row menu (in-use).
			await settings.goto();
			await page.locator('#review-button').click();
			await page.locator('#reviewerRecommendations-button').click();
			await expect(manager).toBeVisible({timeout: 15_000});
			await expect(manager.getByText('See Comments')).toBeVisible();
			await expect(
				manager
					.locator('tr')
					.filter({hasText: 'See Comments'})
					.locator('input[type="checkbox"]'),
			).not.toBeChecked();
			await expect(manager.getByText('Resubmit Elsewhere')).toHaveCount(0);
			await expect(
				manager
					.locator('tr')
					.filter({hasText: 'Accept Submission'})
					.getByRole('button', {name: 'More Actions'}),
			).toHaveCount(0);

			// A reviewer completing a review picks from exactly the active set:
			// the four remaining defaults plus Fast-Track Accept.
			const reviewerCtx = await asUser('jjanssen');
			const reviewerPage = await reviewerCtx.newPage();
			const rp = new ReviewerSubmissionPage(reviewerPage);
			await rp.goto(submission.id, {journalPath: ctx.path});
			await rp.acceptInvitation();
			await rp.continueToStep3();
			const optionLabels = (
				await rp.step3Form
					.locator('select#reviewerRecommendationId option')
					.evaluateAll((opts) =>
						opts
							.filter((o) => o.value !== '')
							.map((o) => o.textContent.trim()),
					)
			).sort();
			expect(optionLabels).toEqual(
				[
					'Accept Submission',
					'Decline Submission',
					customTitle,
					'Resubmit for Review',
					'Revisions Required',
				].sort(),
			);
		},
	);

	// ── Scenario 7 — Acknowledgement routing and signature ─────────────────────
	// The manager sets Submission Confirmation to "all authors", a Notify-Anyone
	// address, and a signature. A real submission produces one ack email to the
	// author with the extra address in Bcc and the signature in the body. Bounce
	// Address stays a note (allow_envelope_sender off in this env). (rule 13.)
	test(
		'acknowledgement routing: author + Bcc + signature marker; bounce stays a note',
		{tag: ['@smoke', '@regression']},
		async ({page, pkpApi, asUser, pkpMail}) => {
			test.slow();
			const tag = uniqueTag();
			const bccAddress = `wftbcc${tag}@mailinator.com`;
			const signature = `Signature marker ${tag}`;
			const ctx = await seedJournal(pkpApi, tag, {
				primaryLocale: 'en',
				supportedLocales: ['en'],
				users: [{username: 'atester', roles: ['author']}],
			});

			// The REAL Emails form: all-authors ack, a Notify-Anyone Bcc, a
			// signature. Bounce Address renders as a NOTE (config-gated off).
			const settings = new WorkflowSettingsPage(page, ctx.path);
			await settings.goto();
			await page.locator('#emails-button').click();
			const panel = page.locator('#emails');
			await expect(panel.locator('form').first()).toBeVisible({
				timeout: 15_000,
			});
			await panel
				.locator('input[name="submissionAcknowledgement"][value="allAuthors"]')
				.check();
			await panel
				.locator('#emailSetup-copySubmissionAckAddress-control')
				.fill(bccAddress);
			await setTinyMceByPrefix(
				page,
				'emailSetup-emailSignature-control',
				`<p>${signature}</p>`,
			);
			// Bounce Address is a note, not an input, unless allow_envelope_sender.
			await expect(
				panel.getByText('allow_envelope_sender', {exact: false}),
			).toBeVisible();
			const saveRes = await settings.saveForm(panel);
			const echoed = await saveRes.json();
			expect(echoed.submissionAcknowledgement).toBe('allAuthors');
			expect(echoed.copySubmissionAckAddress).toBe(bccAddress);

			// A REAL submission (scenario seeding fakes mail — the ack fires only
			// on a genuine UI submit).
			const authorCtx = await asUser('atester');
			const authorPage = await authorCtx.newPage();
			const wizard = new SubmissionWizardPage(authorPage, ctx.path);
			await wizard.goto();
			await wizard.start({title: `Ackflow ${tag}`});
			const submissionId = wizard.currentSubmissionId();
			await wizard.expectStep('Upload Files');
			const fileItem = await wizard.uploadFile(ARTICLE_FIXTURE);
			await wizard.assignPrimaryGenre(fileItem, 'Article Text');
			await wizard.continueStep();
			await wizard.expectStep('Details');
			await wizard.setDetailsField('abstract', `<p>Ack abstract ${tag}.</p>`);
			// Anchor the abstract autosave before Review validates stored state.
			await wizard.continueStep();
			await expect
				.poll(
					async () =>
						(
							await fetchCurrentPublication(
								authorPage.request,
								ctx.path,
								submissionId,
							)
						)?.abstract?.en ?? '',
					{timeout: 20_000},
				)
				.toContain(tag);
			await walkToStep(authorPage, wizard, 'Review');
			const dialog = await wizard.openSubmitDialog();
			await dialog.getByRole('button', {name: 'Submit', exact: true}).click();
			await expect(
				authorPage.getByRole('heading', {name: 'Submission complete'}),
			).toBeVisible({timeout: 30_000});

			// One ack email to the author, carrying the signature marker.
			const [ack] = await pkpMail.find({
				to: 'atester@mailinator.com',
				contains: tag,
				subject: 'Thank you for your submission',
				timeoutMs: 30_000,
			});
			expect(ack).toBeTruthy();
			const full = await pkpMail.fullMessage(ack.ID);
			expect(`${full.HTML}${full.Text}`).toContain(signature);

			// The Notify-Anyone address rides the SAME message as a Bcc (rule 13).
			const bccList = (full.Bcc ?? []).map((r) => r.Address);
			expect(bccList).toContain(bccAddress);
		},
	);

	// ── Scenario 8 — Permission boundary ───────────────────────────────────────
	// Section editor: Settings → Workflow → denied; a genre-grid URL → role
	// denial; PUT contexts/{id} → denied. ⚠ But POST reviewers/recommendations
	// → 200 and the option appears in the manager's list — the API-only hole of
	// Known deviations (ledger row 124). Manager-without-settings-flag behaves
	// per the verified Area 6 gate (referenced, not re-proven).
	test(
		'permission boundary: page + PUT + genre grid walled; recommendations API hole (row 124)',
		{tag: ['@smoke', '@regression']},
		async ({page, pkpApi, asUser}) => {
			test.slow();
			const tag = uniqueTag();
			const ctx = await seedJournal(pkpApi, tag, {
				primaryLocale: 'en',
				supportedLocales: ['en'],
				users: [{username: 'dbuskins', roles: ['sectionEditor']}],
			});

			// Positive control: the manager gets the workflow page.
			const settings = new WorkflowSettingsPage(page, ctx.path);
			await settings.goto();
			await expect(page.locator('#submission-button')).toBeVisible();

			const seCtx = await asUser('dbuskins');

			// The section editor is refused the page…
			const pageRes = await seCtx.request.get(
				`/index.php/${ctx.path}/management/settings/workflow`,
			);
			expect(pageRes.url()).toMatch(/authorizationDenied/);

			// …the settings PUT (401)…
			const seCsrf = await csrfFor(seCtx);
			const sePut = await putContext(
				seCtx.request,
				ctx.path,
				ctx.id,
				{numWeeksPerResponse: 3},
				seCsrf,
			);
			expect(sePut.status(), 'settings PUT refused').toBe(401);

			// …and the genre grid (role-denied JSONMessage).
			const gridRes = await seCtx.request.get(
				`/index.php/${ctx.path}/$$$call$$$/grid/settings/genre/genre-grid/fetch-grid`,
			);
			const gridJson = await gridRes.json();
			expect(gridJson.status).toBe(false);
			expect(JSON.stringify(gridJson)).toContain(ROLE_DENIED);

			// ⚠ Row 124: the recommendations endpoints admit the section-editor
			// role and skip the settings gate — the page-denied section editor
			// can still create an option by direct call.
			const holeTitle = `SE hole ${tag}`;
			const post = await seCtx.request.post(
				`/index.php/${ctx.path}/api/v1/reviewers/recommendations`,
				{
					headers: {
						'X-Csrf-Token': seCsrf,
						'Content-Type': 'application/json',
					},
					data: {title: {en: holeTitle}, status: true, type: 1},
				},
			);
			expect(post.status(), 'row 124: section editor POST admitted').toBe(200);
			expect((await post.json()).title.en).toBe(holeTitle);

			// The option appears in the journal's vocabulary (manager GET).
			const listRes = await page.request.get(
				`/index.php/${ctx.path}/api/v1/reviewers/recommendations`,
			);
			const titles = (await listRes.json()).items.map((it) => it.title.en);
			expect(titles).toContain(holeTitle);

			// Nothing the section editor was refused actually changed.
			const current = await getContext(page.request, ctx.path, ctx.id);
			expect(current.numWeeksPerResponse).not.toBe(3);
		},
	);
});
