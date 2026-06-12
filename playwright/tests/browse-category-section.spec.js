// @ts-check
const {test, expect} = require('../support/fixtures.js');
const {EditorialWorkflowPage} = require('../pages/EditorialWorkflowPage.js');
const {setTinyMceContent} = require('../../lib/pkp/playwright/support/tinymce.js');
const submissionPublished = require('../fixtures/scenarios/submission-published.js');

/**
 * Browse: categories & section policies —
 * docs/e2e/plans/browse-category-section.md rows 1–4.
 *
 * Reader assertions run ANONYMOUSLY (explicit empty storageState —
 * patterns.md rule 8). Every test seeds its own scratch journal:
 * categories and sections are journal-level state and publicknowledge
 * is read-only (charter principle 1). Scratch journals are
 * single-locale, so their front-end URLs carry NO locale prefix
 * (probe-verified: the /en/ form 302s BACK to the bare form — the
 * inverse of multilingual publicknowledge).
 *
 * Row 1 is the adjudicated UI-FALLBACK: `publications[].categories` is
 * deliberately NOT a Processor capability, so the editor assigns the
 * category through the workflow's Publication Settings panel
 * (IssueEntryForm's `categoryIds` FieldAutosuggestPreset —
 * classes/components/forms/publication/IssueEntryForm.php:106) on a
 * seeded-but-unpublished publication and then publishes via the UI.
 * `catalog/category/{path}` resolves articles through the search index
 * (PKPCatalogHandler::category builds a SubmissionSearchResult FROM
 * submissions_fulltext filtered by categoryIds), so the listing lags
 * the publish by ≤1 web request — row 1 owns the poll-until-indexed
 * loop.
 *
 * Row 3 empty-state reality (probe-verified): catalogCategory.tpl:68's
 * `{if empty($results)}` branch is dead code — `$results` is a
 * LengthAwarePaginator object, never empty() — so the
 * `catalog.category.noItems` message cannot render; an empty category
 * shows its heading, a "0 Items" article_count and an empty
 * ul.cmp_article_list. The test asserts that real rendering (heading +
 * zero entries) rather than the unreachable locale string.
 *
 * Row 4: section `policy` is not a SectionProcessor field — both
 * sections get their policy text through the legacy sections grid UI
 * (jQuery AjaxModal; helpers duplicated from
 * playwright/tests/sections.spec.js — no Sections POM exists and POMs
 * are wave-frozen). /about/submissions renders one `.section_policy`
 * block per policy-bearing section (templates/frontend/pages/
 * submissions.tpl:11-24), excludes editorRestricted sections for
 * non-editor visitors (AboutContextHandler::submissions →
 * excludeEditorOnly), and renders the submit-to-section link only for
 * logged-in users (`{if $isUserLoggedIn}`) — hence the third actor
 * (atester: logged in, no roles on the scratch journal).
 */

test.describe('Browse: categories & section policies', () => {
	// Row 1 — category browse page lists a published article.
	test(
		'category browse page lists a published article in that category',
		{tag: '@regression'},
		async ({pkpApi, asUser, browser, baseURL}) => {
			// Seed + workflow UI + publish + poll-until-indexed stack up;
			// give the default 60s cap some headroom.
			test.setTimeout(120_000);

			const tag = scratchTag('cat1');
			const issueRef = {volume: 1, number: 1, year: 2026};
			const {context} = await pkpApi.createJournal({
				tag,
				users: [{username: 'dbarnes', roles: ['manager', 'editor']}],
				issues: [{...issueRef, published: true}],
				categories: [{path: 'dinosaurs', title: {en: 'Dinosaurs'}}],
			});

			// Unpublished VoR pre-assigned to the issue: published
			// publications lock their forms, so the category is assigned
			// while STATUS_QUEUED and the publish itself happens in the UI
			// (the row's UI-FALLBACK adjudication).
			const spec = submissionPublished({
				tag,
				journal: context.path,
				issue: issueRef,
			});
			spec.publications[0].metadata.title = {en: 'Category browse target'};
			spec.publications[0].published = false;
			const {submission, publications} = await pkpApi.createSubmission(spec);
			const publicationId = publications[0].id;
			const listedTitle = `Category browse target [${tag}]`;

			// --- Editor: assign the category on Publication Settings ---
			const editorCtx = await asUser('dbarnes');
			const editorPage = await editorCtx.newPage();
			const workflow = new EditorialWorkflowPage(editorPage);
			await workflow.goto(submission.id, {journalPath: context.path});
			await workflow.openPublicationPanel('Publication Settings');
			await expect(
				workflow
					.workflowModal()
					.getByRole('heading', {name: /Publication Settings/}),
			).toBeVisible({timeout: 15_000});

			// The panel's Issue select is a REQUIRED field and the seeded
			// queued publication carries no issueId yet (the scenario only
			// stores the issue ref for the publish step) — leaving it
			// empty fails client-side validation on Save ("Go to Issue:
			// This field is required", run-verified). Assigning placement
			// here is the same gesture a real editor makes on this panel.
			await editorPage
				.locator('select#issueEntry-issueId-control')
				.selectOption({
					label: `Vol. ${issueRef.volume} No. ${issueRef.number} (${issueRef.year})`,
				});

			// FieldAutosuggestPreset's vocabulary picker (same control the
			// wizard uses — see lib/pkp categories.spec.js).
			await workflow
				.workflowModal()
				.getByRole('button', {name: 'Select Categories'})
				.click();
			const picker = editorPage.locator('[data-cy="active-modal"]').filter({
				has: editorPage.getByRole('heading', {name: 'Select Categories'}),
			});
			await expect(
				picker.getByRole('heading', {name: 'Select Categories'}),
			).toBeVisible({timeout: 15_000});
			await picker.locator('label', {hasText: 'Dinosaurs'}).first().click();
			await picker.getByRole('button', {name: 'Save'}).click();
			await expect(
				editorPage.getByRole('heading', {name: 'Select Categories'}),
			).toHaveCount(0, {timeout: 10_000});

			// Save the form; anchor on the publication PUT (useFetch may
			// tunnel it as POST + method override) instead of the toast —
			// dbarnes is shared across parallel workers.
			await Promise.all([
				editorPage.waitForResponse(
					(res) =>
						['PUT', 'POST'].includes(res.request().method()) &&
						res.url().includes(`/publications/${publicationId}`) &&
						res.ok(),
					{timeout: 20_000},
				),
				workflow
					.workflowModal()
					.getByRole('button', {name: 'Save', exact: true})
					.click(),
			]);

			// Publish from the same panel (the publish entry button renders
			// on every publication sub-panel).
			await workflow.publishCurrentPanel({
				issueLabel: `Vol. ${issueRef.volume} No. ${issueRef.number} (${issueRef.year})`,
			});

			// --- Anonymous reader: category browse page ---
			const anon = await anonContext(browser, baseURL);
			try {
				const reader = await anon.newPage();
				const categoryUrl = `/index.php/${context.path}/catalog/category/dinosaurs`;

				// Category browse resolves through the search index — poll
				// until the publish-triggered index job has run.
				await expect
					.poll(
						async () => {
							const resp = await reader.goto(categoryUrl);
							expect(resp?.status()).toBe(200);
							return await categoryEntry(reader, listedTitle).count();
						},
						{
							message: `category browse never listed "${listedTitle}"`,
							timeout: 30_000,
						},
					)
					.toBeGreaterThan(0);

				// Category title heading.
				await expect(reader.locator('h1').first()).toHaveText(/^\s*Dinosaurs\s*$/);

				// The entry links to the article landing page.
				const entryLink = categoryEntry(reader, listedTitle).locator('.title a');
				await expect(entryLink).toHaveAttribute(
					'href',
					new RegExp(`/article/view/${submission.id}$`),
				);
				await entryLink.click();
				await reader.waitForURL(new RegExp(`/article/view/${submission.id}$`), {
					waitUntil: 'commit',
				});
				await expect(reader.locator('h1.page_title')).toContainText(listedTitle);
			} finally {
				await anon.close();
			}
		},
	);

	// Row 2 — nested categories link parent and children.
	test(
		'nested categories link parent and children',
		{tag: '@regression'},
		async ({pkpApi, browser, baseURL}) => {
			const tag = scratchTag('cat2');
			const {context} = await pkpApi.createJournal({
				tag,
				categories: [
					{
						path: 'animals',
						title: {en: 'Animals'},
						children: [
							{path: 'birds', title: {en: 'Birds'}},
							{path: 'reptiles', title: {en: 'Reptiles'}},
						],
					},
				],
			});

			const anon = await anonContext(browser, baseURL);
			try {
				const reader = await anon.newPage();
				const resp = await reader.goto(
					`/index.php/${context.path}/catalog/category/animals`,
				);
				expect(resp?.status()).toBe(200);
				await expect(reader.locator('h1').first()).toHaveText(/^\s*Animals\s*$/);

				// Parent page lists its subcategories as links.
				const subnav = reader.locator('nav.subcategories');
				await expect(
					subnav.getByRole('heading', {name: 'Subcategories'}),
				).toBeVisible();
				await expect(subnav.locator('ul li a')).toHaveCount(2);
				const birdsLink = subnav.getByRole('link', {name: 'Birds'});
				await expect(birdsLink).toHaveAttribute(
					'href',
					/\/catalog\/category\/birds$/,
				);
				await expect(subnav.getByRole('link', {name: 'Reptiles'})).toHaveAttribute(
					'href',
					/\/catalog\/category\/reptiles$/,
				);

				// Child page links back up to the parent via the catalog
				// breadcrumb (breadcrumbs_catalog.tpl renders the parent as
				// the intermediate crumb).
				await birdsLink.click();
				await reader.waitForURL(/\/catalog\/category\/birds$/, {
					waitUntil: 'commit',
				});
				await expect(reader.locator('h1').first()).toHaveText(/^\s*Birds\s*$/);
				const parentCrumb = reader
					.locator('nav.cmp_breadcrumbs_catalog')
					.getByRole('link', {name: 'Animals'});
				await expect(parentCrumb).toHaveAttribute(
					'href',
					/\/catalog\/category\/animals$/,
				);
				await parentCrumb.click();
				await reader.waitForURL(/\/catalog\/category\/animals$/, {
					waitUntil: 'commit',
				});
				await expect(reader.locator('h1').first()).toHaveText(/^\s*Animals\s*$/);
			} finally {
				await anon.close();
			}
		},
	);

	// Row 3 — empty category shows the empty state; unknown path 404s.
	test(
		'empty category renders its empty state and an unknown category path 404s',
		{tag: '@regression'},
		async ({pkpApi, browser, baseURL}) => {
			const tag = scratchTag('cat3');
			const {context} = await pkpApi.createJournal({
				tag,
				categories: [{path: 'silentcat', title: {en: 'Quiet Corner'}}],
			});

			const anon = await anonContext(browser, baseURL);
			try {
				const reader = await anon.newPage();
				const resp = await reader.goto(
					`/index.php/${context.path}/catalog/category/silentcat`,
				);
				expect(resp?.status()).toBe(200);

				// Heading + zero-entry listing. NOTE: the noItems branch
				// ({if empty($results)} — catalogCategory.tpl:68) is dead
				// code against a paginator object, so the real empty state
				// is the "0 Items" count and an entry-less list (see spec
				// header); the zero-count assertion below holds for either
				// branch.
				await expect(reader.locator('h1').first()).toHaveText(
					/^\s*Quiet Corner\s*$/,
				);
				await expect(reader.locator('.article_count')).toHaveText(
					/^\s*0 Items\s*$/,
				);
				await expect(
					reader.locator('.cmp_article_list .obj_article_summary'),
				).toHaveCount(0);

				// Unknown category path → NotFoundHttpException → 404.
				const missing = await reader.goto(
					`/index.php/${context.path}/catalog/category/does-not-exist`,
				);
				expect(missing?.status()).toBe(404);
			} finally {
				await anon.close();
			}
		},
	);

	// Row 4 — section policies on /about/submissions; editor-restricted
	// section hidden from non-editors.
	test(
		'section policies render on the public submissions page and the editor-restricted section stays hidden',
		{tag: '@regression'},
		async ({pkpApi, asUser, browser, baseURL}) => {
			test.setTimeout(90_000);

			const tag = scratchTag('sec4');
			const openTitle = 'Open Research';
			const restrictedTitle = 'Editor Picks';
			const openPolicy = `Open Research welcomes general submissions ${tag}`;
			const restrictedPolicy = `Editor Picks is curated by the editors ${tag}`;
			const {context} = await pkpApi.createJournal({
				tag,
				users: [{username: 'dbarnes', roles: ['manager']}],
				sections: [
					{abbrev: {en: 'OPN'}, title: {en: openTitle}},
					{
						abbrev: {en: 'EDP'},
						title: {en: restrictedTitle},
						editorRestricted: true,
					},
				],
			});

			// --- Manager: set policy text on BOTH sections via the grid UI.
			// The restricted section needs policy too — without it, its
			// absence on the public page would prove nothing (the template
			// skips policy-less sections altogether).
			const managerCtx = await asUser('dbarnes');
			const managerPage = await managerCtx.newPage();
			await setSectionPolicyViaUi(managerPage, context.path, openTitle, openPolicy);
			await setSectionPolicyViaUi(
				managerPage,
				context.path,
				restrictedTitle,
				restrictedPolicy,
			);

			const aboutUrl = `/index.php/${context.path}/about/submissions`;

			// --- Anonymous: open section's policy block renders; the
			// restricted section is absent (excludeEditorOnly); no
			// submit-to-section link without a login.
			const anon = await anonContext(browser, baseURL);
			try {
				const reader = await anon.newPage();
				const resp = await reader.goto(aboutUrl);
				expect(resp?.status()).toBe(200);

				const openBlock = policyBlock(reader, openTitle);
				await expect(openBlock).toHaveCount(1);
				await expect(openBlock).toContainText(openPolicy);
				// Submit-to-section link is login-gated ({if $isUserLoggedIn}).
				await expect(openBlock.getByRole('link')).toHaveCount(0);

				await expect(policyBlock(reader, restrictedTitle)).toHaveCount(0);
				await expect(reader.locator('.page')).not.toContainText(
					restrictedPolicy,
				);
			} finally {
				await anon.close();
			}

			// --- Logged-in non-editor (atester holds no role on this
			// scratch journal): the open block now carries the
			// submit-to-section link; the restricted section is still
			// hidden (canSubmitAll stays false without manager/editor
			// roles).
			const readerCtx = await asUser('atester');
			const readerPage = await readerCtx.newPage();
			const resp = await readerPage.goto(aboutUrl);
			expect(resp?.status()).toBe(200);

			const openBlock = policyBlock(readerPage, openTitle);
			await expect(openBlock).toHaveCount(1);
			await expect(openBlock).toContainText(openPolicy);
			const submitLink = openBlock.getByRole('link', {name: openTitle});
			await expect(submitLink).toBeVisible();
			await expect(submitLink).toHaveAttribute(
				'href',
				/\/submission\?sectionId=\d+$/,
			);

			await expect(policyBlock(readerPage, restrictedTitle)).toHaveCount(0);
		},
	);
});

/**
 * A `.section_policy` block on /about/submissions selected by its
 * section-title heading (templates/frontend/pages/submissions.tpl:13).
 *
 * @param {import('@playwright/test').Page} page
 * @param {string} sectionTitle
 */
function policyBlock(page, sectionTitle) {
	return page.locator('.section_policy').filter({
		has: page.getByRole('heading', {name: sectionTitle, exact: true}),
	});
}

/**
 * An entry in the category browse listing matched by its title
 * (catalogCategory.tpl renders article_summary rows inside
 * ul.cmp_article_list).
 *
 * @param {import('@playwright/test').Page} page
 * @param {string} title
 */
function categoryEntry(page, title) {
	return page
		.locator('.cmp_article_list .obj_article_summary')
		.filter({hasText: title});
}

/**
 * Open the legacy Sections grid, edit the named section and set its
 * policy rich-text. Grid/form driving duplicated from
 * playwright/tests/sections.spec.js (spec-local there too — no
 * Sections POM exists and existing POMs are wave-frozen).
 *
 * The policy field is an fbv multilingual rich textarea; on a
 * single-locale scratch journal its TinyMCE id collapses to
 * `policy-{uniqId}` (no locale segment). The id is resolved at runtime
 * against editors whose backing element is still attached — sequential
 * edits in the same page can leave the previous dialog's editor
 * registered with TinyMCE after its DOM is gone.
 *
 * @param {import('@playwright/test').Page} page
 * @param {string} journalPath
 * @param {string} sectionTitle
 * @param {string} policyText  plain text; wrapped in <p> for TinyMCE
 */
async function setSectionPolicyViaUi(page, journalPath, sectionTitle, policyText) {
	// Open the Sections tab; the grid loads async via load_url_in_div.
	await page.goto(`/index.php/${journalPath}/management/settings/context`);
	await page.locator('#sections-button').click();
	await expect(
		page.locator(
			'a[id^="component-grid-settings-sections-sectiongrid-addSection-button-"]',
		),
	).toBeVisible();

	// Locate the data row by title and expand ITS row controls — each
	// gridRow carries its own `a.show_extras` toggle (clicking another
	// row's toggle, e.g. `.first()`, leaves this row's Edit action
	// hidden; the anchor's class flips to hide_extras once expanded —
	// patterns.md pitfall 9).
	const row = page
		.locator(
			'tr.gridRow[id^="component-grid-settings-sections-sectiongrid-row-"]',
			{hasText: sectionTitle},
		)
		.first();
	await expect(row).toBeVisible();
	const rowId = await row.getAttribute('id');
	if (!rowId) {
		throw new Error(`Section row "${sectionTitle}" not found`);
	}
	const expander = row.locator('a.show_extras');
	if (await expander.count()) {
		await expander.click();
	}
	await page.locator(`a[id^="${rowId}-editSection-button-"]`).first().click();
	const form = page.locator('form#sectionForm');
	await expect(form).toBeVisible();

	// Resolve the live policy editor id (see helper docblock).
	await page.waitForFunction(
		() =>
			(window.tinymce?.get() ?? []).some(
				(e) =>
					e.id.startsWith('policy') &&
					e.initialized &&
					document.getElementById(e.id),
			),
		{timeout: 15_000},
	);
	const editorId = await page.evaluate(
		() =>
			window.tinymce
				.get()
				.find(
					(e) =>
						e.id.startsWith('policy') &&
						e.initialized &&
						document.getElementById(e.id),
				).id,
	);
	await setTinyMceContent(page, editorId, `<p>${policyText}</p>`);

	// Save; AjaxFormHandler closes the dialog on success.
	await form.getByRole('button', {name: 'Save'}).click();
	await expect(form).toHaveCount(0, {timeout: 15_000});
}

/**
 * Worker-scoped unique tag with a per-run random component
 * (patterns.md tag conventions; the journal scenario derives
 * `j-<alnum(tag)>` and journals.path is varchar(32)).
 *
 * @param {string} prefix
 */
function scratchTag(prefix) {
	const workerIndex = test.info().parallelIndex;
	const suffix = Math.random().toString(36).slice(2, 8);
	return `${prefix}-w${workerIndex}-${suffix}`;
}

/**
 * Fresh anonymous browser context with an explicit empty storageState
 * (patterns.md rule 8).
 *
 * @param {import('@playwright/test').Browser} browser
 * @param {string} [baseURL]
 */
async function anonContext(browser, baseURL) {
	return browser.newContext({
		baseURL,
		storageState: {cookies: [], origins: []},
	});
}
