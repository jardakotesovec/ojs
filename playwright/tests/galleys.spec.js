// @ts-check
const path = require('path');
const {test, expect} = require('../support/fixtures.js');
const {EditorialWorkflowPage} = require('../pages/EditorialWorkflowPage.js');
const submissionPublished = require('../fixtures/scenarios/submission-published.js');

/**
 * Galleys — row #51 in docs/e2e-playwright-migration.md.
 *
 * Ports the galley-creation slice of cypress/tests/data/60-content/
 * AmwandengaSubmission.cy.js (lines 363–380, plus the reader-side
 * `cy.checkViewableGalley('PDF')` at line 429). Galleys live on top
 * of a published publication, so each test seeds the canonical
 * `submissionPublished({tag})` scenario and drives the Publication →
 * Galleys panel as dbarnes.
 *
 * Wave 7 marker — this is the first row to exercise the bundled
 * default Article Text file that every seeded submission now ships
 * with (Step 2 of the scenario-extensions plan; see
 * lib/pkp/playwright/tests/scenario-default-file.spec.js). The Add
 * Galley UI accepts any file via `<input type=file>`; we re-use the
 * same `default-article.pdf` fixture for the galley source so we
 * keep one PDF blob across the suite.
 *
 * Scope vs. Cypress:
 *   - One PDF galley + reader download link (the row's primary
 *     capability assertion).
 *   - One delete cycle (the row's CRUD coverage; subsumes the
 *     Cypress edit + URL-path round-trips, which exercise the same
 *     fbv form a second time).
 *   - Drop the "PDF + HTML" two-format variant — the upload wizard
 *     is genre-agnostic, so a single PDF run is sufficient evidence
 *     the file pipeline works. Re-add an HTML variant if a future
 *     row exercises a galley-format-specific surface (e.g. inline
 *     HTML rendering on the article page).
 *   - Drop the legacy `articleGalleyForm`-error / `wait(1000)` /
 *     "wait for jQuery" idioms — the POM's per-step `expect(...
 *     visible)` waits replace them deterministically.
 *
 * Wave 6 — rows 3–8 of docs/e2e/plans/galleys.md. Rows 3, 5, 6 use the
 * `publications[].galleys[]` scenario seed (built in wave 1) as setup
 * so the UI work in each test is only the behavior under test; rows 4
 * and 7 keep the UI creation path as the behavior under test; row 8
 * seeds a published v1 + draft v2 and exercises version-scoped galley
 * visibility.
 *
 * UI realities encoded below (all grep-verified against the live
 * sources):
 *   - The GalleyManager row menu labels the edit action "View" on a
 *     PUBLISHED publication and "Edit" on a draft
 *     (useGalleyManagerConfig.js#130-138), but either way it opens the
 *     same fully-editable legacy ArticleGalleyForm — `_isEditable` is
 *     user-stage-access only (ArticleGalleyGridHandler#canEdit).
 *   - Both the edit modal and the change-file wizard reuse the side
 *     modal title "Upload a File Ready for Publication"
 *     (useGalleyManagerActions.js: t('submission.upload.proof')), so
 *     edit-flow waits anchor on `form#articleGalleyForm`, not on the
 *     dialog title.
 *   - After the "Create New Galley" form saves, the Vue galleyAdd
 *     action ALWAYS chains into the file-upload wizard — even for a
 *     remotely hosted galley (useGalleyManagerActions.js#28-41 keys on
 *     closeData.dataChanged[0], which updateGalley always returns).
 *     The remote-galley test dismisses the wizard via the legacy
 *     `a#cancelButton`.
 *   - The reader link for a remote galley is the LOCAL
 *     `article/view/{id}/{galleyId}` route; the redirect to the remote
 *     URL happens server-side (ArticleHandler.php#366-368). The test
 *     asserts the redirect's Location header with `maxRedirects: 0`
 *     so nothing ever leaves the host (egress is firewalled).
 *   - Sort mode replaces each row's actions cell with two UNLABELLED
 *     icon buttons (TableCellOrder.vue — up first, down second; no
 *     aria-label, so they're located positionally).
 *   - Seeded galleys all carry seq=0 (same as UI-created ones —
 *     neither Repo::galley()->add caller assigns seq), so the baseline
 *     order between two fresh galleys is a DB tie. The reorder test
 *     derives the baseline from the manager instead of assuming it.
 */
test.describe('Galleys', () => {
	test(
		'editor adds a PDF galley to a published article; reader sees the download link',
		async ({pkpApi, asUser, browser, baseURL}) => {
			const tag = uniqueTag(test.info(), 'add');
			const spec = submissionPublished({tag});
			const {submission} = await pkpApi.createSubmission(spec);

			const ctx = await asUser('dbarnes');
			const page = await ctx.newPage();
			const workflow = new EditorialWorkflowPage(page);
			await workflow.goto(submission.id);

			await workflow.openPublicationPanel('Galleys');
			await workflow.addGalley({
				label: 'PDF',
				filePath: galleyFixturePath(),
				urlPath: `pdf-${tag}`,
			});

			// Reader side — anonymous context, no storageState. The galley
			// renders as `a.obj_galley_link` whose href points at the
			// publicly resolvable URL (urlPath when set, galley id otherwise).
			await expectReaderShowsGalley({
				browser,
				baseURL,
				submissionId: submission.id,
				label: 'PDF',
				urlPathFragment: `pdf-${tag}`,
			});
		},
	);

	test(
		'editor deletes a galley; reader no longer sees the download link',
		async ({pkpApi, asUser, browser, baseURL}) => {
			const tag = uniqueTag(test.info(), 'delete');
			const spec = submissionPublished({tag});
			const {submission} = await pkpApi.createSubmission(spec);

			const ctx = await asUser('dbarnes');
			const page = await ctx.newPage();
			const workflow = new EditorialWorkflowPage(page);
			await workflow.goto(submission.id);

			// Create the galley first so we have something to delete.
			await workflow.openPublicationPanel('Galleys');
			await workflow.addGalley({
				label: 'PDF',
				filePath: galleyFixturePath(),
				urlPath: `pdf-${tag}`,
			});

			// Reader sees the link before delete (sanity baseline).
			await expectReaderShowsGalley({
				browser,
				baseURL,
				submissionId: submission.id,
				label: 'PDF',
				urlPathFragment: `pdf-${tag}`,
			});

			await workflow.deleteGalley('PDF');

			// Reader: the PDF galley link is gone. Note: the seeded
			// `submissionPublished` fixture also publishes a JATS XML
			// representation (`a.obj_galley_link.xml`) so we filter on
			// the PDF label rather than asserting zero galley links.
			await expectReaderHasNoGalley({
				browser,
				baseURL,
				submissionId: submission.id,
				label: 'PDF',
			});
		},
	);

	// Row 3 — edit label + urlPath on a seeded galley.
	test(
		'editor edits a galley label and urlPath; manager row and reader link update',
		async ({pkpApi, asUser, browser, baseURL}) => {
			const tag = uniqueTag(test.info(), 'edit');
			const spec = submissionPublished({tag});
			spec.publications[0].galleys = [{label: 'PDF'}];
			const {submission, publications} = await pkpApi.createSubmission(spec);
			const galleyId = publications[0].galleys[0].id;
			const newUrlPath = `pdf-${tag}-x`;

			const ctx = await asUser('dbarnes');
			const page = await ctx.newPage();
			const workflow = new EditorialWorkflowPage(page);
			await workflow.goto(submission.id);
			await workflow.openPublicationPanel('Galleys');

			// Seeded row is present before we touch anything.
			await expect(
				workflow.workflowModal().getByRole('cell', {name: 'PDF', exact: true}),
			).toBeVisible({timeout: 15_000});

			// Reader baseline: without a urlPath the link targets the
			// numeric galley id.
			{
				const reader = await gotoArticleAnonymously(
					browser,
					baseURL,
					submission.id,
				);
				const link = readerGalleyLink(reader, 'PDF');
				await expect(link).toHaveCount(1);
				await expect(link).toHaveAttribute(
					'href',
					new RegExp(`/article/view/${submission.id}/${galleyId}$`),
				);
			}

			// Edit: the row menu's edit entry is labelled "View" because the
			// publication is published (label-only quirk; the form is fully
			// editable — see header comment).
			const form = await openGalleyEditForm(page, workflow, 'PDF', 'View');
			await form.locator('input[name=label]').fill('Revised PDF');
			await form.locator('input[name=urlPath]').fill(newUrlPath);
			await form.locator('button[name=submitFormButton]').click();
			await expect(form).toHaveCount(0, {timeout: 15_000});

			// Manager row updated in place.
			await expect(
				workflow
					.workflowModal()
					.getByRole('cell', {name: 'Revised PDF', exact: true}),
			).toBeVisible({timeout: 15_000});
			await expect(
				workflow.workflowModal().getByRole('cell', {name: 'PDF', exact: true}),
			).toHaveCount(0);

			// Reader: link text and href both follow the edit.
			{
				const reader = await gotoArticleAnonymously(
					browser,
					baseURL,
					submission.id,
				);
				const link = readerGalleyLink(reader, 'Revised PDF');
				await expect(link).toHaveCount(1);
				await expect(link).toHaveAttribute(
					'href',
					new RegExp(
						`/article/view/${submission.id}/${escapeRegex(newUrlPath)}$`,
					),
				);
			}
		},
	);

	// Row 4 — remotely hosted galley created through the UI.
	test(
		'editor creates a remotely hosted galley; reader link redirects to the remote URL',
		async ({pkpApi, asUser, browser, baseURL}) => {
			const tag = uniqueTag(test.info(), 'remote');
			const spec = submissionPublished({tag});
			const {submission} = await pkpApi.createSubmission(spec);
			// Dummy off-host URL — never followed from the browser (egress
			// is firewalled); only the redirect header is asserted.
			const remoteUrl = `https://example.com/g-${tag}`;

			const ctx = await asUser('dbarnes');
			const page = await ctx.newPage();
			const workflow = new EditorialWorkflowPage(page);
			await workflow.goto(submission.id);
			await workflow.openPublicationPanel('Galleys');

			await workflow
				.workflowModal()
				.getByRole('button', {name: 'Add galley', exact: true})
				.click();
			const galleyForm = page
				.getByRole('dialog', {name: 'Create New Galley'})
				.first();
			await expect(galleyForm).toBeVisible({timeout: 10_000});
			await galleyForm.locator('input[name=label]').fill('Remote PDF');
			await galleyForm.locator('select[name=locale]').selectOption('en');
			// "This galley will be available at a separate website." —
			// checking it reveals the urlRemote field and hides/clears the
			// urlPath section (RepresentationFormHandler.js#toggleRemote_).
			await galleyForm.locator('input#remotelyHostedContent').check();
			await galleyForm.locator('input[name=urlRemote]').fill(remoteUrl);
			await galleyForm.locator('button[name=submitFormButton]').click();

			// The Vue galleyAdd action chains into the file-upload wizard
			// even for a remote galley (it keys on dataChanged[0] alone) —
			// dismiss it; the galley row already exists.
			const wizard = page
				.locator('[role=dialog]')
				.filter({hasText: 'Upload a File Ready for Publication'})
				.first();
			await expect(wizard).toBeVisible({timeout: 15_000});
			await wizard.locator('a#cancelButton').click();
			await expect(wizard).toBeHidden({timeout: 10_000});

			// Row appears after the manager refresh.
			await expect(
				workflow
					.workflowModal()
					.getByRole('cell', {name: 'Remote PDF', exact: true}),
			).toBeVisible({timeout: 15_000});

			// Reader: the landing-page link targets the LOCAL galley route…
			const readerCtx = await browser.newContext({baseURL});
			const readerPage = await readerCtx.newPage();
			const resp = await readerPage.goto(
				`/index.php/publicknowledge/article/view/${submission.id}`,
			);
			expect(resp?.status()).toBe(200);
			const link = readerGalleyLink(readerPage, 'Remote PDF');
			await expect(link).toHaveCount(1);
			const href = await link.getAttribute('href');
			expect(href).toMatch(
				new RegExp(`/article/view/${submission.id}/\\d+$`),
			);

			// …and GETting that route (on-host, redirects not followed)
			// answers with a redirect AT the remote URL.
			const redirect = await readerCtx.request.get(String(href), {
				maxRedirects: 0,
			});
			expect(redirect.status()).toBeGreaterThanOrEqual(300);
			expect(redirect.status()).toBeLessThan(400);
			expect(redirect.headers()['location']).toBe(remoteUrl);
		},
	);

	// Row 5 — reorder two seeded galleys; the reader page follows.
	test(
		'editor reorders galleys; reader page lists them in the new order',
		async ({pkpApi, asUser, browser, baseURL}) => {
			const tag = uniqueTag(test.info(), 'order');
			const spec = submissionPublished({tag});
			spec.publications[0].galleys = [{label: 'Alpha'}, {label: 'Beta'}];
			const {submission} = await pkpApi.createSubmission(spec);

			const ctx = await asUser('dbarnes');
			const page = await ctx.newPage();
			const workflow = new EditorialWorkflowPage(page);
			await workflow.goto(submission.id);
			await workflow.openPublicationPanel('Galleys');

			const manager = workflow
				.workflowModal()
				.locator('[data-cy="galley-manager"]');
			const rows = manager.locator('tbody tr');
			await expect(rows).toHaveCount(2, {timeout: 15_000});

			// Fresh galleys all carry seq=0, so their relative order is a DB
			// tie — derive the baseline instead of assuming it, then move
			// whichever label is second up to the top.
			const firstRowText = await rows.first().innerText();
			const [first, second] = firstRowText.includes('Alpha')
				? ['Alpha', 'Beta']
				: ['Beta', 'Alpha'];

			await manager.getByRole('button', {name: 'Order', exact: true}).click();
			// Sort mode swaps the actions cell for two unlabelled icon
			// buttons: up first, down second (TableCellOrder.vue).
			const secondRow = rows.filter({hasText: second});
			await secondRow.locator('button').first().click();
			await expect(rows.first()).toContainText(second);

			await Promise.all([
				page.waitForResponse(
					(r) => r.url().includes('save-sequence') && r.ok(),
					{timeout: 15_000},
				),
				manager
					.getByRole('button', {name: 'Save Order', exact: true})
					.click(),
			]);
			// Sort mode exits (button reverts to "Order") and the persisted
			// order survives the manager's refetch.
			await expect(
				manager.getByRole('button', {name: 'Order', exact: true}),
			).toBeVisible({timeout: 15_000});
			await expect(rows.first()).toContainText(second, {timeout: 15_000});
			await expect(rows.last()).toContainText(first);

			// Reader page lists the primary galleys in the saved sequence.
			const reader = await gotoArticleAnonymously(
				browser,
				baseURL,
				submission.id,
			);
			await expect(
				reader.locator('ul.galleys_links a.obj_galley_link'),
			).toHaveText([
				new RegExp(escapeRegex(second)),
				new RegExp(escapeRegex(first)),
			]);
		},
	);

	// Row 6 — change-file on a seeded galley.
	test(
		'editor replaces the file behind a galley; label and link survive and the new file is served',
		async ({pkpApi, asUser, browser, baseURL}) => {
			const tag = uniqueTag(test.info(), 'chfile');
			const spec = submissionPublished({tag});
			spec.publications[0].galleys = [{label: 'PDF'}];
			const {submission, publications} = await pkpApi.createSubmission(spec);
			const galley = publications[0].galleys[0];
			// Locale-prefixed: the bare /article/... route answers with a
			// 302 onto /en/article/... (multilingual journal), which a
			// maxRedirects:0 request would mistake for a failure.
			const downloadUrl = `/index.php/publicknowledge/en/article/download/${submission.id}/${galley.id}`;

			// Reader baseline: the seeded default-article.pdf is served.
			const readerCtx = await browser.newContext({baseURL});
			{
				const dl = await readerCtx.request.get(downloadUrl, {
					maxRedirects: 0,
				});
				expect(dl.status()).toBe(200);
				expect(dl.headers()['content-disposition'] ?? '').toContain(
					'default-article',
				);
			}

			const ctx = await asUser('dbarnes');
			const page = await ctx.newPage();
			const workflow = new EditorialWorkflowPage(page);
			await workflow.goto(submission.id);
			await workflow.openPublicationPanel('Galleys');

			// Change File on the seeded row. Because the galley already has
			// a file, the wizard runs in revision mode (use case 1 in
			// fileUploadForm.tpl): no genre selector, the current file named
			// in a "Current file" section, upload widget only.
			const row = workflow
				.workflowModal()
				.locator('tr', {
					has: page.getByRole('cell', {name: 'PDF', exact: true}),
				})
				.first();
			await row.getByRole('button', {name: 'More Actions'}).click();
			await page
				.getByRole('menuitem', {name: 'Change File', exact: true})
				.click();

			const wizard = page
				.locator('[role=dialog]')
				.filter({hasText: 'Upload a File Ready for Publication'})
				.first();
			await expect(wizard).toBeVisible({timeout: 10_000});
			await expect(wizard.getByText('Current file')).toBeVisible({
				timeout: 10_000,
			});
			await wizard
				.locator('input[type=file]')
				.setInputFiles(dummyFixturePath());
			// Upload settled once the widget flips to its change-file state.
			await expect(wizard.getByText('Change File').first()).toBeVisible({
				timeout: 15_000,
			});
			await wizard.locator('button#continueButton').click();

			// Step 2 — metadata (name now reflects the replacement upload).
			await expect(
				wizard.locator('label[for$="-name-control-en"]'),
			).toBeVisible({timeout: 10_000});
			await wizard.locator('button#continueButton').click();

			// Step 3 — confirm.
			await expect(wizard.getByText('File Added')).toBeVisible({
				timeout: 10_000,
			});
			await wizard.locator('button#continueButton').click();
			await expect(wizard).toBeHidden({timeout: 15_000});

			// Label unchanged in the manager.
			await expect(
				workflow.workflowModal().getByRole('cell', {name: 'PDF', exact: true}),
			).toBeVisible({timeout: 15_000});

			// The galley still points at the SAME submission-file row (the
			// upload was a revision, not a new file), whose name now carries
			// the replacement basename.
			const filesRes = await page.request.get(
				`/index.php/publicknowledge/api/v1/submissions/${submission.id}/files?fileStages[]=10`,
			);
			expect(filesRes.ok(), `GET files: ${filesRes.status()}`).toBe(true);
			const filesBody = await filesRes.json();
			const fileItems = filesBody.items || filesBody;
			const proofFile = fileItems.find(
				(f) => f.id === galley.submissionFileId,
			);
			expect(
				proofFile,
				'galley submission file should survive the change-file revision',
			).toBeTruthy();
			expect(JSON.stringify(proofFile.name)).toContain('dummy');

			// Reader: link unchanged and still resolving; the download now
			// serves the replacement file.
			const reader = await gotoArticleAnonymously(
				browser,
				baseURL,
				submission.id,
			);
			const link = readerGalleyLink(reader, 'PDF');
			await expect(link).toHaveCount(1);
			await expect(link).toHaveAttribute(
				'href',
				new RegExp(`/article/view/${submission.id}/${galley.id}$`),
			);
			{
				const dl = await readerCtx.request.get(downloadUrl, {
					maxRedirects: 0,
				});
				expect(dl.status()).toBe(200);
				expect(dl.headers()['content-disposition'] ?? '').toContain('dummy');
			}
		},
	);

	// Row 7 — layout editor (assistant role) manages galleys end-to-end.
	test(
		'layout editor manages galleys as a production participant',
		async ({pkpApi, asUser, browser, baseURL}) => {
			const tag = uniqueTag(test.info(), 'layout');
			const spec = submissionPublished({
				tag,
				participants: [
					{user: 'dbarnes', role: 'editor'},
					{user: 'gcox', role: 'layoutEditor'},
				],
			});
			const {submission} = await pkpApi.createSubmission(spec);

			// gcox (assistant) reaches the editorial workflow page and gets
			// the Publication → Galleys panel with the Add galley action
			// (GalleyManagerConfiguration permits ROLE_ID_ASSISTANT all
			// galley actions when assigned to the production stage).
			const ctx = await asUser('gcox');
			const page = await ctx.newPage();
			const workflow = new EditorialWorkflowPage(page);
			await workflow.goto(submission.id);
			await workflow.openPublicationPanel('Galleys');
			await expect(
				workflow
					.workflowModal()
					.getByRole('button', {name: 'Add galley', exact: true}),
			).toBeVisible({timeout: 15_000});

			await workflow.addGalley({
				label: 'PDF',
				filePath: galleyFixturePath(),
				urlPath: `pdf-${tag}`,
			});

			// The assistant-created galley is live for readers.
			await expectReaderShowsGalley({
				browser,
				baseURL,
				submissionId: submission.id,
				label: 'PDF',
				urlPathFragment: `pdf-${tag}`,
			});
		},
	);

	// Row 8 — galley on a draft v2 stays off the public v1 page until
	// v2 publishes.
	test(
		'galley added on a draft v2 stays off the published v1 page until v2 publishes',
		async ({pkpApi, asUser, browser, baseURL}) => {
			// Seed (2 publications) + add-galley wizard + full publish flow
			// + two reader loads legitimately exceed the 60s cap under
			// parallel load.
			test.slow();
			const tag = uniqueTag(test.info(), 'v2');
			const spec = submissionPublished({tag});
			spec.publications[0].galleys = [{label: 'PDF'}];
			// Draft v2 — created via Repo::publication()->version(), which
			// clones v1's galleys (APP\publication\Repository::version), so
			// v2 starts with a copy of "PDF" and the new galley below is
			// the version-discriminating signal.
			spec.publications.push({versionStage: 'VoR'});
			const {submission} = await pkpApi.createSubmission(spec);
			const v2UrlPath = `v2-${tag}`;

			const ctx = await asUser('dbarnes');
			const page = await ctx.newPage();
			const workflow = new EditorialWorkflowPage(page);
			await workflow.goto(submission.id);

			// Add the galley under v2's Galleys panel (last version in the
			// side-nav).
			await workflow.openPublicationPanel('Galleys', {version: 'last'});
			await workflow.addGalley({
				label: 'V2PDF',
				filePath: galleyFixturePath(),
				urlPath: v2UrlPath,
			});

			// Public page still serves v1: its own PDF galley renders
			// (positive control bounding the negative), the v2-only galley
			// does not.
			{
				const reader = await gotoArticleAnonymously(
					browser,
					baseURL,
					submission.id,
				);
				await expect(readerGalleyLink(reader, 'PDF')).toHaveCount(1);
				await expect(readerGalleyLink(reader, 'V2PDF')).toHaveCount(0);
			}

			// Publish v2 (publish flow lives on the publication sub-panels).
			await workflow.openPublicationPanel('Title & Abstract', {
				version: 'last',
			});
			await workflow.publishCurrentPanel();

			// The public page now serves v2: the new galley is live at its
			// urlPath, alongside the galley cloned from v1.
			{
				const reader = await gotoArticleAnonymously(
					browser,
					baseURL,
					submission.id,
				);
				const v2Link = readerGalleyLink(reader, 'V2PDF');
				await expect(v2Link).toHaveCount(1);
				await expect(v2Link).toHaveAttribute(
					'href',
					new RegExp(
						`/article/view/${submission.id}/${escapeRegex(v2UrlPath)}$`,
					),
				);
				await expect(readerGalleyLink(reader, 'PDF')).toHaveCount(1);
			}
		},
	);
});

/**
 * Reader-side assertion — anonymous browser context navigates to the
 * canonical numeric article URL, expects 200, and asserts a single
 * `a.obj_galley_link` whose text is the galley label and whose href
 * contains the urlPath fragment (galley download/view route).
 *
 * @param {{
 *   browser: import('@playwright/test').Browser,
 *   baseURL?: string,
 *   submissionId: number,
 *   label: string,
 *   urlPathFragment: string,
 * }} opts
 */
async function expectReaderShowsGalley({
	browser,
	baseURL,
	submissionId,
	label,
	urlPathFragment,
}) {
	const ctx = await browser.newContext({baseURL});	const page = await ctx.newPage();
	const resp = await page.goto(
		`/index.php/publicknowledge/article/view/${submissionId}`,
	);
	expect(resp?.status()).toBe(200);
	const link = page
		.locator('a.obj_galley_link')
		.filter({hasText: label});
	await expect(link).toHaveCount(1);
	await expect(link).toHaveAttribute(
		'href',
		new RegExp(`/article/view/${submissionId}/${escapeRegex(urlPathFragment)}`),
	);

}

/**
 * Reader-side assertion — after delete, the article page renders but
 * the named galley link is gone. We match by visible label rather than
 * counting all `a.obj_galley_link` elements because the seeded fixture
 * also publishes a JATS XML representation (its own
 * `a.obj_galley_link.xml`) regardless of whether the deleted PDF is
 * present.
 *
 * @param {{
 *   browser: import('@playwright/test').Browser,
 *   baseURL?: string,
 *   submissionId: number,
 *   label: string,
 * }} opts
 */
async function expectReaderHasNoGalley({browser, baseURL, submissionId, label}) {
	const ctx = await browser.newContext({baseURL});	const page = await ctx.newPage();
	const resp = await page.goto(
		`/index.php/publicknowledge/article/view/${submissionId}`,
	);
	expect(resp?.status()).toBe(200);
	await expect(
		page.locator('a.obj_galley_link').filter({hasText: label}),
	).toHaveCount(0);

}

/**
 * Open the public article landing page in a fresh anonymous context
 * and return the page after asserting a 200. Context auto-closes at
 * test teardown.
 *
 * @param {import('@playwright/test').Browser} browser
 * @param {string|undefined} baseURL
 * @param {number} submissionId
 * @returns {Promise<import('@playwright/test').Page>}
 */
async function gotoArticleAnonymously(browser, baseURL, submissionId) {
	const ctx = await browser.newContext({baseURL});
	const page = await ctx.newPage();
	const resp = await page.goto(
		`/index.php/publicknowledge/article/view/${submissionId}`,
	);
	expect(resp?.status()).toBe(200);
	return page;
}

/**
 * Locator for a reader-side galley link matched by its EXACT label.
 * Exactness matters when labels nest ("PDF" vs "V2PDF") — the
 * substring filter used by expectReaderShowsGalley would match both.
 * The link's text is the label plus surrounding template whitespace
 * (no extra spans on an open-access journal).
 *
 * @param {import('@playwright/test').Page} page
 * @param {string} label
 */
function readerGalleyLink(page, label) {
	return page
		.locator('a.obj_galley_link')
		.filter({hasText: new RegExp(`^\\s*${escapeRegex(label)}\\s*$`)});
}

/**
 * Open the legacy galley edit form from a galley row's More Actions
 * menu and return the form locator (visible, ready to fill).
 *
 * Missing-POM note: EditorialWorkflowPage has addGalley/deleteGalley
 * but no editGalley — POMs are frozen for this wave, so the helper
 * lives spec-local. The row menu's edit entry is labelled "View" on a
 * published publication and "Edit" on a draft
 * (useGalleyManagerConfig.js#130-138); the side modal it opens is
 * titled "Upload a File Ready for Publication" (same title as the
 * change-file wizard), so the wait anchors on `form#articleGalleyForm`
 * — loaded async by the jQuery-UI tabset in editFormat.tpl — rather
 * than on the dialog name.
 *
 * @param {import('@playwright/test').Page} page
 * @param {import('../pages/EditorialWorkflowPage.js').EditorialWorkflowPage} workflow
 * @param {string} label         galley row label (exact cell match)
 * @param {'View'|'Edit'} menuItemName
 * @returns {Promise<import('@playwright/test').Locator>} the form
 */
async function openGalleyEditForm(page, workflow, label, menuItemName) {
	const row = workflow
		.workflowModal()
		.locator('tr', {has: page.getByRole('cell', {name: label, exact: true})})
		.first();
	await row.getByRole('button', {name: 'More Actions'}).click();
	await page
		.getByRole('menuitem', {name: menuItemName, exact: true})
		.click();
	const form = page.locator('form#articleGalleyForm');
	await expect(form).toBeVisible({timeout: 15_000});
	return form;
}

/**
 * Resolve the bundled lib/pkp default-article.pdf fixture. We re-use
 * the same PDF that the scenario-default-file flow uploads so a galley
 * source doesn't grow into its own fixture.
 */
function galleyFixturePath() {
	return path.resolve(
		__dirname,
		'../../lib/pkp/playwright/fixtures/files/default-article.pdf',
	);
}

/**
 * Resolve the bundled dummy.pdf fixture — same bytes as
 * default-article.pdf but a different basename, which is exactly what
 * the change-file test needs: the served filename (Content-Disposition)
 * is the replacement-detection signal, not the content.
 */
function dummyFixturePath() {
	return path.resolve(
		__dirname,
		'../../lib/pkp/playwright/fixtures/files/dummy.pdf',
	);
}

/** Escape a string for use inside a RegExp literal. */
function escapeRegex(s) {
	return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Build a worker-scoped tag so parallel runs don't collide. Trailing
 * hyphens are trimmed because tags feed galley urlPaths, whose
 * validator (/^[a-zA-Z0-9]+([\.\-_][a-zA-Z0-9]+)*$/) rejects a
 * trailing separator — the 16-char slug slice can land on one.
 *
 * @param {import('@playwright/test').TestInfo} info
 * @param {string} suffix
 */
function uniqueTag(info, suffix) {
	const slug = info.title
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.slice(0, 16)
		.replace(/-+$/, '');
	return `g-w${info.parallelIndex}-${suffix}-${slug}`;
}
