// @ts-check
const {test, expect} = require('../support/fixtures.js');
const {EditorialWorkflowPage} = require('../pages/EditorialWorkflowPage.js');
const {fixtureFilePath} = require('../../lib/pkp/playwright/pages/FileStagePanel.js');

/**
 * Galleys — the publication's published-format files (Publication → Galleys
 * tab) + the reader galley view/download. One test per canonical scenario of
 * docs/product/specs/galleys.md (11 scenarios; DOI-seam merged into the edit
 * test → 10 tests).
 *
 * Surfaces under test:
 *   - The Vue GalleyManager (managers/GalleyManager, data-cy="galley-manager")
 *     that lists publication.galleys and orchestrates every mutation through
 *     the legacy ArticleGalleyGridHandler (Add/Edit/Change-File/Order/Delete)
 *     — rule 1.
 *   - The reader ArticleHandler view/download and the pdfJsViewer render
 *     plugin (rules 11-13).
 *
 * THE two gaps the spec author left for the tests to drive live (per the
 * task brief):
 *   1. The reader galley download + pdf.js render (scenario 7) and the
 *      access gate (scenario 8) — no seeded published PDF galley existed, so
 *      these seed one and drive the READER side (anon render/download + the
 *      unpublished-galley 404 gate, editor-preview bypass).
 *   2. The published-lock ⚠ (scenario 9 / rule 9 / OQ1): GalleyManager.vue
 *      ignores canEditPublication, so on a PUBLISHED article the manager still
 *      offers Add galley (beside the "this version has been published" banner)
 *      and the row's edit action reads "View" yet opens an editable,
 *      Save-enabled form. Scenario-8 test drives the label edit to Save and
 *      asserts whether it PERSISTS — the live confirmation of the ⚠.
 *
 * Scope discipline (don't duplicate sibling coverage):
 *   - The file-upload wizard mechanics belong to submission-files; this spec
 *     drives Change File only to land the galley's proof file and read back
 *     the galley→file association.
 *   - The DOI value/minting/deposit belong to publication-identifiers; this
 *     spec owns only the Identifiers-tab PRESENCE on the galley edit modal
 *     (rule 7 seam) — asserted as the negative branch on publicknowledge
 *     (no galley pub-id enabled → the edit modal is metadata-only).
 *   - The subscription/payment gate belongs to subscriptions/payments; the
 *     reader access-gate test uses the unpublished-galley 404 gate (rule 12).
 *
 * Placement: OJS root — reader ArticleHandler + the four OJS render plugins +
 * the OJS-hosted ArticleGalleyGridHandler are OJS-only (the Galley entity and
 * the Vue GalleyManager ship from pkp-lib, but the surfaces driven here are
 * OJS).
 *
 * Parallel-safety: tags are single hyphenless alphanumeric tokens; every
 * submission is per-test and opened by the id the scenario API returns;
 * anonymous reader contexts pass an explicit empty storageState (the file's
 * dbarnes state would otherwise let an editor preview unpublished galleys).
 */

const STATUS_PUBLISHED = 3; // PKPSubmission::STATUS_PUBLISHED
const STATUS_QUEUED = 1;

// The shared "published version" warning banner (publication.editorEditWarning)
// prepended to every publication panel — including Galleys — on a published
// version (PublicationConfig.common.getPrimaryItems).
const PUBLISHED_BANNER =
	'Warning: This version has been published. Editing it may impact the published content.';

/** A unique, hyphenless, alphanumeric tag (parallel isolation). */
function uniqueTag() {
	const workerLetter = String.fromCharCode(97 + (test.info().parallelIndex % 26));
	let suffix = '';
	while (suffix.length < 6) {
		suffix += Math.random().toString(36).replace(/[^a-z0-9]/g, '');
	}
	return `gal${workerLetter}${suffix.slice(0, 6)}`;
}

/**
 * A production-stage (stage 5, Queued) submission on publicknowledge, reached
 * via skipExternalReview → sendToProduction. dbarnes is the assigned editor
 * (production access → full galley actions); atester is the submitting author.
 * Optional `galleys` are seeded on the (unpublished) current publication.
 *
 * @param {{tag: string, title: string, submitter?: string, galleys?: object[]}} opts
 */
function productionSpec({tag, title, submitter = 'atester', galleys}) {
	return {
		tag,
		journal: 'publicknowledge',
		submitter,
		section: 'ART',
		locale: 'en',
		submitted: true,
		participants: [{user: 'dbarnes', role: 'editor'}],
		decisions: [
			{type: 'skipExternalReview', by: 'dbarnes'},
			{type: 'sendToProduction', by: 'dbarnes'},
		],
		publications: [
			{
				metadata: {title: {en: title}},
				...(galleys ? {galleys} : {}),
			},
		],
	};
}

/**
 * A VoR-published submission assigned to the published issue (Vol 1, No 2,
 * 2014 — open access on publicknowledge), optionally carrying seeded galleys
 * on the published publication.
 *
 * @param {{tag: string, title: string, submitter?: string, galleys?: object[]}} opts
 */
function publishedSpec({tag, title, submitter = 'atester', galleys}) {
	return {
		tag,
		journal: 'publicknowledge',
		submitter,
		section: 'ART',
		locale: 'en',
		submitted: true,
		participants: [{user: 'dbarnes', role: 'editor', canChangeMetadata: true}],
		decisions: [
			{type: 'skipExternalReview', by: 'dbarnes'},
			{type: 'sendToProduction', by: 'dbarnes'},
		],
		publications: [
			{
				versionStage: 'VoR',
				metadata: {title: {en: title}},
				issue: {volume: 1, number: 2, year: 2014},
				published: true,
				...(galleys ? {galleys} : {}),
			},
		],
	};
}

/** Deep-link the editorial workflow straight onto Publication → Galleys. */
function galleysLink(submissionId, pubId, journalPath = 'publicknowledge') {
	return (
		`/index.php/${journalPath}/en/dashboard/editorial` +
		`?workflowSubmissionId=${submissionId}` +
		`&workflowMenuKey=publication_${pubId}_galleys`
	);
}

/** The author's My-Submissions deep link onto Publication → Galleys. */
function authorGalleysLink(submissionId, pubId, journalPath = 'publicknowledge') {
	return (
		`/index.php/${journalPath}/en/dashboard/mySubmissions` +
		`?workflowSubmissionId=${submissionId}` +
		`&workflowMenuKey=publication_${pubId}_galleys`
	);
}

/** The Vue GalleyManager panel (PkpTable data-cy="galley-manager"). */
function galleyPanel(page) {
	return page.locator('[data-cy="galley-manager"]');
}

/** A galley row, located by its (unique-tagged) label text. */
function galleyRow(page, label) {
	return galleyPanel(page).getByRole('row').filter({hasText: label});
}

/** Open the Galleys panel and wait for the Vue manager to mount. */
async function openGalleys(page, submissionId, pubId) {
	await page.goto(galleysLink(submissionId, pubId), {waitUntil: 'commit'});
	await expect(galleyPanel(page)).toBeVisible({timeout: 20_000});
}

/** Read a publication's galleys array via the REST API (page session). */
async function fetchGalleys(page, submissionId, pubId, journalPath = 'publicknowledge') {
	const res = await page.request.get(
		`/index.php/${journalPath}/api/v1/submissions/${submissionId}/publications/${pubId}`,
	);
	expect(res.ok(), `GET publication ${pubId}: ${res.status()}`).toBeTruthy();
	return (await res.json()).galleys ?? [];
}

/** Open a galley row's More-Actions menu and click a named menu item. */
async function clickRowAction(page, label, itemName) {
	await galleyRow(page, label)
		.getByRole('button', {name: 'More Actions'})
		.click();
	await page.getByRole('menuitem', {name: itemName, exact: true}).click();
}

test.use({user: 'dbarnes'}); // the assigned editor (production access)

test.describe('Galleys — publication galley manager + reader', () => {
	// Canonical scenario 1 — Editor adds a file galley: Add galley → "PDF"
	// label + language → the create form saves, then the auto-chained Change
	// File wizard uploads the PDF as its proof file. The galley appears in the
	// manager and carries a submissionFileId (the proof file) — driven through
	// the same legacy grid the manager delegates to (rule 1).
	test(
		'editor adds a file galley',
		{tag: ['@smoke', '@regression']},
		async ({page, pkpApi}) => {
			test.slow(); // full Add-Galley → Upload wizard drive
			const tag = uniqueTag();
			const {submission, publications} = await pkpApi.createSubmission(
				productionSpec({tag, title: `Add file galley ${tag}`}),
			);
			const pubId = publications[0].id;

			await openGalleys(page, submission.id, pubId);

			const label = `PDF ${tag}`;
			const workflow = new EditorialWorkflowPage(page);
			await workflow.addGalley({label, filePath: fixtureFilePath()});

			// The galley row is present in the manager…
			await expect(galleyRow(page, label)).toBeVisible();

			// …and server truth: the galley exists with a proof file attached.
			const galleys = await fetchGalleys(page, submission.id, pubId);
			const galley = galleys.find((g) => g.label === label);
			expect(galley, 'seeded galley present via API').toBeTruthy();
			expect(galley.submissionFileId, 'proof file attached').toBeTruthy();
			expect(galley.urlRemote).toBeFalsy();
		},
	);

	// Canonical scenario 2 — Editor adds a remote-URL galley: Add galley →
	// tick "This galley will be available at a separate website" → external URL
	// + label, save. The galley needs no uploaded file; server truth confirms
	// urlRemote is set and no proof file is attached. Rule 11/12: opening the
	// galley redirects the reader out — verified via the editor-preview
	// download (302 → the external URL) on the still-unpublished article.
	test(
		'editor adds a remote-URL galley',
		{tag: '@regression'},
		async ({page, pkpApi}) => {
			const tag = uniqueTag();
			const {submission, publications} = await pkpApi.createSubmission(
				productionSpec({tag, title: `Remote galley ${tag}`}),
			);
			const pubId = publications[0].id;

			await openGalleys(page, submission.id, pubId);

			const label = `External HTML ${tag}`;
			const remoteUrl = `https://example.org/remote-${tag}`;

			await galleyPanel(page)
				.getByRole('button', {name: 'Add galley', exact: true})
				.click();

			const form = page.getByRole('dialog', {name: 'Create New Galley'}).first();
			await expect(form).toBeVisible({timeout: 10_000});
			await form.locator('input[name=label]').fill(label);
			await form.locator('select[name=locale]').selectOption('en');
			// Ticking the checkbox reveals the remote-URL field (#remote div).
			await form
				.getByLabel('This galley will be available at a separate website.')
				.check();
			const remoteInput = form.locator('input[name=urlRemote]');
			await expect(remoteInput).toBeVisible({timeout: 10_000});
			await remoteInput.fill(remoteUrl);

			// Submit the create form (posts to updateGalley → the galley is
			// created). The Vue galleyAdd callback then chains straight into the
			// Change File wizard (a new galley id always triggers it); a remote
			// galley needs no file, so rather than fight that stacked wizard we
			// re-open the panel fresh — the galley already persists.
			await Promise.all([
				page.waitForResponse(
					(r) => /update-galley/.test(r.url()) && r.status() === 200,
					{timeout: 20_000},
				),
				form.locator('button[name=submitFormButton]').click(),
			]);

			await openGalleys(page, submission.id, pubId);
			await expect(galleyRow(page, label)).toBeVisible({timeout: 15_000});

			// Server truth: urlRemote set, no proof file.
			const galleys = await fetchGalleys(page, submission.id, pubId);
			const galley = galleys.find((g) => g.label === label);
			expect(galley, 'remote galley present via API').toBeTruthy();
			expect(galley.urlRemote).toBe(remoteUrl);
			expect(galley.submissionFileId).toBeFalsy();

			// Reader-side rule 11/12: the download entry redirects straight to
			// the external URL. Driven as the editor (canPreview) since the
			// article is unpublished; the redirect branch precedes the gate.
			const res = await page.request.get(
				`/index.php/publicknowledge/en/article/download/${submission.id}/${galley.id}`,
				{maxRedirects: 0},
			);
			expect(res.status(), 'remote galley download 302').toBe(302);
			expect(res.headers()['location']).toContain(remoteUrl);
		},
	);

	// Canonical scenario 3 (+ 5, merged) — Editor edits a galley's label /
	// locale via the row's Edit action; the change persists. Merged with the
	// DOI/Identifiers-tab seam (scenario 5, rule 7): on publicknowledge no
	// galley pub-id is enabled, so the galley edit modal is METADATA-ONLY —
	// the Identifiers tab is absent (the seam's negative branch).
	test(
		'editor edits a galley label/locale; edit modal is metadata-only (no Identifiers tab)',
		{tag: ['@smoke', '@regression']},
		async ({page, pkpApi}) => {
			const tag = uniqueTag();
			const {submission, publications} = await pkpApi.createSubmission(
				productionSpec({
					tag,
					title: `Edit galley ${tag}`,
					galleys: [{label: `PDF ${tag}`, file: 'default-article.pdf'}],
				}),
			);
			const pubId = publications[0].id;
			const originalLabel = `PDF ${tag}`;
			const newLabel = `Full Text PDF ${tag}`;

			await openGalleys(page, submission.id, pubId);
			await expect(galleyRow(page, originalLabel)).toBeVisible();

			// Open the row's Edit action (unpublished → labelled "Edit").
			await clickRowAction(page, originalLabel, 'Edit');

			// The legacy editFormat.tpl tabset: an "Edit Metadata" tab, and —
			// with no galley pub-id enabled — NO "Identifiers" tab (rule 7 seam).
			const tabs = page.locator('#editArticleGalleyMetadataTabs');
			await expect(tabs).toBeVisible({timeout: 15_000});
			await expect(tabs).toContainText('Edit Metadata');
			await expect(tabs).not.toContainText('Identifiers');

			// The metadata form loads into the first tab (AJAX).
			const galleyForm = page.locator('form#articleGalleyForm');
			const labelInput = galleyForm.locator('input[name=label]');
			await expect(labelInput).toBeVisible({timeout: 15_000});

			await labelInput.fill(newLabel);

			// The locale select offers the submission's publication languages
			// (rule 3). Switch to a different offered locale when available so
			// the persistence check covers the locale field too.
			const localeSelect = galleyForm.locator('select[name=locale]');
			const localeValues = await localeSelect
				.locator('option')
				.evaluateAll((opts) => opts.map((o) => o.value).filter(Boolean));
			const currentLocale = await localeSelect.inputValue();
			const otherLocale = localeValues.find((v) => v !== currentLocale);
			const targetLocale = otherLocale ?? currentLocale;
			if (otherLocale) {
				await localeSelect.selectOption(otherLocale);
			}

			await Promise.all([
				page.waitForResponse(
					(r) => /update-galley/.test(r.url()) && r.status() === 200,
					{timeout: 20_000},
				),
				galleyForm.locator('button[name=submitFormButton]').click(),
			]);

			// The edited label shows on the row, and server truth confirms both
			// the label and (when changed) the locale persisted.
			await expect(galleyRow(page, newLabel)).toBeVisible({timeout: 15_000});
			const galleys = await fetchGalleys(page, submission.id, pubId);
			const galley = galleys.find((g) => g.label === newLabel);
			expect(galley, 'renamed galley present via API').toBeTruthy();
			expect(galley.locale).toBe(targetLocale);
		},
	);

	// Canonical scenario 4 — Reorder: with two galleys the editor clicks Order,
	// moves the second galley above the first via the row arrows, and Saves;
	// the new sequence (seq) drives every galley list. Seeded galleys arrive in
	// insertion order; after the reorder the API returns them swapped.
	test(
		'editor reorders galleys',
		{tag: '@regression'},
		async ({page, pkpApi}) => {
			const tag = uniqueTag();
			const labelA = `AAA ${tag}`;
			const labelB = `BBB ${tag}`;
			const {submission, publications} = await pkpApi.createSubmission(
				productionSpec({
					tag,
					title: `Reorder galleys ${tag}`,
					galleys: [
						{label: labelA, file: 'default-article.pdf'},
						{label: labelB, file: 'default-article.pdf'},
					],
				}),
			);
			const pubId = publications[0].id;

			await openGalleys(page, submission.id, pubId);

			// Initial order: A then B.
			const before = await fetchGalleys(page, submission.id, pubId);
			expect(before.map((g) => g.label)).toEqual([labelA, labelB]);

			// Enter sort mode (the "Order" button is shown when galleys exist).
			await galleyPanel(page)
				.getByRole('button', {name: 'Order', exact: true})
				.click();

			// Row A's order cell exposes an up + down arrow (icon-only buttons).
			// Move A DOWN so the list becomes B, A.
			const rowAButtons = galleyRow(page, labelA).getByRole('button');
			await rowAButtons.nth(1).click(); // down

			// Save the new order (button relabels to "Save Order").
			await Promise.all([
				page.waitForResponse(
					(r) => /save-sequence/.test(r.url()) && r.status() === 200,
					{timeout: 20_000},
				),
				galleyPanel(page)
					.getByRole('button', {name: 'Save Order', exact: true})
					.click(),
			]);

			// Server truth: the sequence is now B, A.
			await expect(async () => {
				const after = await fetchGalleys(page, submission.id, pubId);
				expect(after.map((g) => g.label)).toEqual([labelB, labelA]);
			}).toPass({timeout: 15_000});
		},
	);

	// Canonical scenario 6 — Delete: the editor deletes a galley from the row
	// menu and confirms; the galley (and its cascaded proof file) is removed.
	test(
		'editor deletes a galley',
		{tag: '@regression'},
		async ({page, pkpApi}) => {
			const tag = uniqueTag();
			const label = `PDF ${tag}`;
			const {submission, publications} = await pkpApi.createSubmission(
				productionSpec({
					tag,
					title: `Delete galley ${tag}`,
					galleys: [{label, file: 'default-article.pdf'}],
				}),
			);
			const pubId = publications[0].id;

			await openGalleys(page, submission.id, pubId);
			await expect(galleyRow(page, label)).toBeVisible();

			// Delete via the POM helper (row menu → Delete → confirm OK).
			const workflow = new EditorialWorkflowPage(page);
			await workflow.deleteGalley(label);

			// Server truth: the galley is gone from the publication.
			await expect(async () => {
				const galleys = await fetchGalleys(page, submission.id, pubId);
				expect(galleys.find((g) => g.label === label)).toBeFalsy();
			}).toPass({timeout: 15_000});
		},
	);

	// Canonical scenario 7 — Reader downloads a galley (pdf.js render). A
	// published article's PDF galley: an anonymous reader opens the galley view
	// and the pdfJsViewer plugin renders it in the embedded pdf.js viewer (the
	// #pdfCanvasContainer iframe + a one-click Download link); the raw download
	// streams the PDF file. (Render plugins ship enabled by default — rule 13.)
	test(
		'reader views a PDF galley in the pdf.js viewer and downloads it',
		{tag: ['@smoke', '@regression']},
		async ({pkpApi, browser, baseURL}) => {
			const tag = uniqueTag();
			const {submission, publications} = await pkpApi.createSubmission(
				publishedSpec({
					tag,
					title: `Reader PDF ${tag}`,
					galleys: [{label: 'PDF', file: 'default-article.pdf'}],
				}),
			);
			const galleyId = publications[0].galleys[0].id;
			expect(publications[0].status).toBe(STATUS_PUBLISHED);

			// Anonymous reader — explicit empty storage state (the file's
			// dbarnes session would otherwise preview unpublished content).
			const anon = await browser.newContext({
				baseURL,
				storageState: {cookies: [], origins: []},
			});
			try {
				const reader = await anon.newPage();

				// Galley view → the pdfJsViewer render surface.
				await reader.goto(
					`/index.php/publicknowledge/en/article/view/${submission.id}/${galleyId}`,
				);
				await expect(reader.locator('#pdfCanvasContainer')).toBeVisible({
					timeout: 20_000,
				});
				const viewer = reader.locator('#pdfCanvasContainer iframe');
				await expect(viewer).toBeVisible();
				// The JS sets the iframe src to the pdf.js viewer once ready.
				await expect
					.poll(() => viewer.getAttribute('src'), {timeout: 15_000})
					.toContain('pdf.js/web/viewer.html');
				// A one-click raw-download link is offered in the viewer header.
				await expect(
					reader.locator('#pdfCanvasContainer, header')
						.getByRole('link', {name: /download/i})
						.first(),
				).toBeVisible();

				// The raw galley download streams the PDF bytes.
				const dl = await reader.request.get(
					`/index.php/publicknowledge/en/article/download/${submission.id}/${galleyId}`,
				);
				expect(dl.ok(), `download ${dl.status()}`).toBeTruthy();
				expect(dl.headers()['content-type']).toContain('application/pdf');
				const body = await dl.body();
				expect(body.subarray(0, 5).toString()).toBe('%PDF-');
			} finally {
				await anon.close();
			}
		},
	);

	// Canonical scenario 8 — Reader access gate. On an UNPUBLISHED article an
	// anonymous reader is refused the galley (view + download 404 — rule 12 /
	// initialize()'s published-status check); an editorial user (canPreview)
	// may still fetch it. The subscription/payment gate on published articles
	// is owned by subscriptions/payments.
	test(
		'unpublished galley is gated from the public but previewable by the editor',
		{tag: '@regression'},
		async ({page, pkpApi, browser, baseURL}) => {
			const tag = uniqueTag();
			const {submission, publications} = await pkpApi.createSubmission(
				productionSpec({
					tag,
					title: `Gated galley ${tag}`,
					galleys: [{label: 'PDF', file: 'default-article.pdf'}],
				}),
			);
			const galleyId = publications[0].galleys[0].id;

			// Anonymous reader: both the galley view and download 404 (the
			// publication is not published and there is no previewing user).
			const anon = await browser.newContext({
				baseURL,
				storageState: {cookies: [], origins: []},
			});
			try {
				const readerReq = anon.request;
				const view = await readerReq.get(
					`/index.php/publicknowledge/en/article/view/${submission.id}/${galleyId}`,
				);
				expect(view.status(), 'anon galley view gated').toBe(404);
				const dl = await readerReq.get(
					`/index.php/publicknowledge/en/article/download/${submission.id}/${galleyId}`,
				);
				expect(dl.status(), 'anon galley download gated').toBe(404);
			} finally {
				await anon.close();
			}

			// Editor (dbarnes, canPreview) fetches the same galley file.
			const editorDl = await page.request.get(
				`/index.php/publicknowledge/en/article/download/${submission.id}/${galleyId}`,
			);
			expect(editorDl.ok(), `editor preview download ${editorDl.status()}`).toBeTruthy();
			expect(editorDl.headers()['content-type']).toContain('application/pdf');
		},
	);

	// Canonical scenario 9 — Galley CRUD on a PUBLISHED article (the ⚠, rule
	// 9). GalleyManager.vue ignores canEditPublication, so on a published
	// publication: (a) the "this version has been published" banner and Add
	// galley render together; (b) the row's edit action reads "View" (not
	// "Edit"); (c) opening it yields a Save-ENABLED form whose label edit
	// PERSISTS. This test drives (c) live — the confirmation the spec author
	// could not: a "View"-labelled action over an editable, persisting form.
	test(
		'published article: galleys stay editable — "View" label over a persisting edit (⚠)',
		{tag: '@regression'},
		async ({page, pkpApi}) => {
			const tag = uniqueTag();
			const originalLabel = `PDF ${tag}`;
			const {submission, publications} = await pkpApi.createSubmission(
				publishedSpec({
					tag,
					title: `Published galleys ${tag}`,
					galleys: [{label: originalLabel, file: 'default-article.pdf'}],
				}),
			);
			const pubId = publications[0].id;
			expect(publications[0].status).toBe(STATUS_PUBLISHED);

			await openGalleys(page, submission.id, pubId);

			// (a) The published-version banner and Add galley render together.
			await expect(page.getByText(PUBLISHED_BANNER)).toBeVisible({
				timeout: 20_000,
			});
			await expect(
				galleyPanel(page).getByRole('button', {name: 'Add galley', exact: true}),
			).toBeVisible();

			// (b) The row's edit action reads "View" (not "Edit").
			await galleyRow(page, originalLabel)
				.getByRole('button', {name: 'More Actions'})
				.click();
			await expect(
				page.getByRole('menuitem', {name: 'View', exact: true}),
			).toBeVisible();
			await expect(
				page.getByRole('menuitem', {name: 'Edit', exact: true}),
			).toHaveCount(0);

			// (c) "View" opens the editable, Save-enabled metadata form.
			await page.getByRole('menuitem', {name: 'View', exact: true}).click();
			const galleyForm = page.locator('form#articleGalleyForm');
			const labelInput = galleyForm.locator('input[name=label]');
			await expect(labelInput).toBeVisible({timeout: 15_000});
			await expect(labelInput).toBeEnabled();

			const editedLabel = `Corrected PDF ${tag}`;
			await labelInput.fill(editedLabel);
			await Promise.all([
				page.waitForResponse(
					(r) => /update-galley/.test(r.url()) && r.status() === 200,
					{timeout: 20_000},
				),
				galleyForm.locator('button[name=submitFormButton]').click(),
			]);

			// The label edit PERSISTS on the published publication (the ⚠).
			await expect(galleyRow(page, editedLabel)).toBeVisible({timeout: 15_000});
			const galleys = await fetchGalleys(page, submission.id, pubId);
			const galley = galleys.find((g) => g.label === editedLabel);
			expect(
				galley,
				'published galley label edit persisted via the manager (⚠ rule 9)',
			).toBeTruthy();
		},
	);

	// Canonical scenario 10 — Author boundary. The submitting author opens
	// their own Galleys tab and sees the galley list (Name/Language)
	// read-only: no Add galley, no Order, no per-row More-Actions menu (author
	// config → GALLEY_LIST only).
	test(
		'author sees the galley list read-only (no add/order/row actions)',
		{tag: '@regression'},
		async ({pkpApi, asUser}) => {
			const tag = uniqueTag();
			const label = `PDF ${tag}`;
			const {submission, publications} = await pkpApi.createSubmission(
				productionSpec({
					tag,
					title: `Author view galleys ${tag}`,
					galleys: [{label, file: 'default-article.pdf'}],
				}),
			);
			const pubId = publications[0].id;

			const authorCtx = await asUser('atester');
			const authorPage = await authorCtx.newPage();
			await authorPage.goto(authorGalleysLink(submission.id, pubId), {
				waitUntil: 'commit',
			});

			// The list renders with the seeded galley…
			await expect(galleyPanel(authorPage)).toBeVisible({timeout: 20_000});
			await expect(galleyRow(authorPage, label)).toBeVisible();

			// …but no management affordances: no Add galley, no Order, no
			// per-row More Actions menu.
			await expect(
				galleyPanel(authorPage).getByRole('button', {name: 'Add galley', exact: true}),
			).toHaveCount(0);
			await expect(
				galleyPanel(authorPage).getByRole('button', {name: 'Order', exact: true}),
			).toHaveCount(0);
			await expect(
				galleyRow(authorPage, label).getByRole('button', {name: 'More Actions'}),
			).toHaveCount(0);
		},
	);

	// Canonical scenario 11 — Permission boundary (no production access). A
	// user with no production-stage assignment on the submission is refused the
	// legacy grid's galley operations: the ArticleGalleyGridHandler's
	// WorkflowStageAccessPolicy(PRODUCTION) rejects the request with a
	// stage-access refusal (canEdit()/canUserAccessStage gate — rule 8/11).
	// Driven at the grid seam because an unassigned editorial user cannot reach
	// the Galleys UI at all.
	test(
		'a user without production access is refused the galley grid ops',
		{tag: '@regression'},
		async ({page, pkpApi, asUser}) => {
			const tag = uniqueTag();
			const {submission, publications} = await pkpApi.createSubmission(
				productionSpec({
					tag,
					title: `No-access galley ${tag}`,
					galleys: [{label: `PDF ${tag}`, file: 'default-article.pdf'}],
				}),
			);
			const pubId = publications[0].id;

			// mfritz (copyeditor) is NOT a participant on this submission → no
			// production-stage access. The grid write op is refused.
			const mfritzCtx = await asUser('mfritz');
			const gridUrl =
				`/index.php/publicknowledge/$$$call$$$/grid/article-galleys/` +
				`article-galley-grid/add-galley` +
				`?submissionId=${submission.id}&publicationId=${pubId}`;
			const refused = await mfritzCtx.request.get(gridUrl);
			const refusedBody = await refused.text();
			expect(refusedBody).toContain('access to that stage of the workflow');

			// Control: the assigned editor (dbarnes) is granted the same op
			// (the grid returns the Create-New-Galley form, not a refusal).
			const granted = await page.request.get(gridUrl);
			const grantedBody = await granted.text();
			expect(grantedBody).not.toContain('access to that stage of the workflow');
			expect(grantedBody).toContain('articleGalleyForm');
		},
	);
});
