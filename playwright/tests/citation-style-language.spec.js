// @ts-check
const fs = require('fs');
const {test, expect} = require('../support/fixtures.js');
const {ArticlePage} = require('../pages/ArticlePage.js');
const {CitationBlock} = require('../pages/CitationBlock.js');
const {WebsitePluginsPage} = require('../pages/WebsitePluginsPage.js');
const submissionPublished = require('../fixtures/scenarios/submission-published.js');

/**
 * Citation Style Language — docs/e2e/plans/citation-style-language.md
 * rows 1–6. This plan OWNS the how-to-cite block coverage on the
 * article landing page (article-landing dropped its duplicate row).
 *
 * Rows 1–4 run against publicknowledge, where bootstrap enrichment has
 * the CSL plugin ON and DOIs auto-assigned on publish — each test seeds
 * its own published submission and asserts as an ANONYMOUS reader
 * (explicit empty storageState; patterns.md "Parallel-load lessons"
 * item 8). Rows 5–6 mutate plugin configuration/enable-state, so each
 * builds its own scratch journal via the journal scenario's
 * `plugins: {citationstylelanguageplugin: {...}}` passthrough.
 *
 * Live-verified realities this spec leans on:
 *   - The CSL handler is a PAGE handler (CitationStyleLanguagePlugin::
 *     setPageHandler), NOT a component route — ops appear verbatim:
 *     `/{journal}/[{locale}/]citationstylelanguage/{get|download}/
 *     {styleId}?submissionId=&publicationId=&issueId=[&return=json]`.
 *     The kebab-case rule (patterns.md item 11) does not apply.
 *   - BibTeX bodies render `title={...}` with NO spaces around `=`
 *     (citeproc renders the bibtex.csl style) — the plan row's
 *     `title = {` spelling is matched tolerantly as /title=\{/.
 *   - RIS PY/Y2 dates render malformed (`PY  - %2026/%06/%12`):
 *     templates/citation-styles/ris.blade:45,48 calls
 *     Carbon->format('%Y/%m/%d') — strftime placeholders fed to
 *     DateTime::format, where `%` is a literal. Reported as an app
 *     bug; row 3 asserts the TY/TI/JF records, which are unaffected.
 *   - Scratch journals are single-locale: bare front-end URLs serve
 *     directly (patterns.md item 9 inversion) — ArticlePage.goto with
 *     no locale handles both shapes transparently.
 *   - The rendered citation links the DOI as a resolving
 *     https://doi.org/ URL. Asserted as text/href only — doi.org is
 *     off-host and egress is firewalled (patterns.md item 6).
 *   - Toggling/configuring a generic plugin from the Website → Plugins
 *     grid writes context-scoped plugin_settings rows only — a scratch
 *     journal mutation never touches publicknowledge's CSL state, so
 *     these tests stay in the parallel project (charter principle 9
 *     covers SITE-level toggles, which this is not).
 */

/** Scratch-journal issue (seeded `published: true`). */
const SCRATCH_ISSUE = {volume: 1, number: '1', year: 2026};

const CSL_PLUGIN = 'citationstylelanguageplugin';
const CSL_SETTINGS_FORM = 'form#citationStyleLanguageSettingsForm';

test.describe('Citation Style Language', () => {
	// Row 1 — how-to-cite block renders the primary (APA) citation.
	test(
		'how-to-cite block renders the primary APA citation on the article page',
		{tag: '@smoke'},
		async ({pkpApi, browser, baseURL}) => {
			const tag = uniqueTag(test.info(), 'block');
			const spec = submissionPublished({tag});
			const {submission} = await pkpApi.createSubmission(spec);

			const {article, citation} = await openArticleAnonymously(
				browser,
				baseURL,
			);
			const resp = await article.goto(submission.id);
			expect(resp?.status()).toBe(200);

			// Block + heading (submission.howToCite).
			await expect(citation.block).toBeVisible();
			await expect(citation.heading).toHaveText('How to Cite');

			// Primary citation is APA (bootstrap leaves the plugin's
			// defaults: apa carries isPrimary): author family name in
			// APA shape, full title incl. the seeding tag, journal name.
			await expect(citation.output).toContainText(/Vaca, R\. \(\d{4}\)\./);
			await expect(citation.output).toContainText(
				`Published article [${tag}]`,
			);
			await expect(citation.output).toContainText(
				'Journal of Public Knowledge',
			);

			// "More Citation Formats" toggle + list: default-enabled
			// styles and both download formats are offered. Existence,
			// not counts — the exact default set is the plugin's, not
			// this row's, concern.
			await expect(citation.moreFormatsButton).toHaveText(
				/More Citation Formats/,
			);
			await citation.expandFormats();
			await expect(citation.styleLink('APA')).toBeVisible();
			await expect(citation.styleLink('Vancouver')).toBeVisible();
			await expect(citation.downloadLink('BibTeX')).toBeVisible();
			await expect(
				citation.downloadLink('Endnote/Zotero/Mendeley (RIS)'),
			).toBeVisible();
		},
	);

	// Row 2 — switching the citation format re-renders via the CSL
	// handler's `get` op (return=json) and replaces the citation text.
	test(
		'reader switches citation format and the citation re-renders',
		{tag: '@regression'},
		async ({pkpApi, browser, baseURL}) => {
			const tag = uniqueTag(test.info(), 'switch');
			const spec = submissionPublished({tag});
			const {submission} = await pkpApi.createSubmission(spec);

			const {article, citation} = await openArticleAnonymously(
				browser,
				baseURL,
			);
			const resp = await article.goto(submission.id);
			expect(resp?.status()).toBe(200);

			// Server-rendered primary: APA shape.
			await expect(citation.output).toContainText(/Vaca, R\. \(\d{4}\)\./);

			// Pick Vancouver — switchToStyle waits on the handler's
			// `get/vancouver` JSON response, then articleCitation.js
			// writes its `content` into #citationOutput.
			await citation.switchToStyle('vancouver', 'Vancouver');

			// Vancouver shape: "Vaca R." (no comma) + the style's
			// "Available from:" URL phrase; the APA shape is gone.
			await expect(citation.output).toContainText('Vaca R.');
			await expect(citation.output).toContainText('Available from:');
			await expect(citation.output).not.toContainText('Vaca, R. (');
			await expect(citation.output).toContainText(
				`Published article [${tag}]`,
			);
		},
	);

	// Row 3 — BibTeX and RIS downloads deliver well-formed records.
	test(
		'reader downloads BibTeX and RIS citations',
		{tag: '@regression'},
		async ({pkpApi, browser, baseURL}) => {
			const tag = uniqueTag(test.info(), 'dl');
			const spec = submissionPublished({tag});
			const {submission} = await pkpApi.createSubmission(spec);

			const {article, citation} = await openArticleAnonymously(
				browser,
				baseURL,
			);
			const resp = await article.goto(submission.id);
			expect(resp?.status()).toBe(200);
			await citation.expandFormats();

			// Capture the RIS href BEFORE clicking BibTeX:
			// articleCitation.js collapses the dropdown on ANY link
			// click inside it, and aria-hidden=true drops the links out
			// of the accessibility tree (getByRole stops matching).
			const risHref = await citation
				.downloadLink('Endnote/Zotero/Mendeley (RIS)')
				.getAttribute('href');

			// BibTeX — exercised as a real link click: the handler's
			// `download` op answers Content-Disposition: attachment,
			// which Playwright surfaces as a download event.
			const downloadPromise = article.page.waitForEvent('download');
			await citation.downloadLink('BibTeX').click();
			const download = await downloadPromise;
			expect(download.suggestedFilename()).toMatch(/\.bib$/);
			const bibtex = fs.readFileSync(String(await download.path()), 'utf8');
			expect(bibtex).toContain('@article{');
			// citeproc's bibtex.csl renders `title={...}` (no spaces
			// around `=`) — see spec header.
			expect(bibtex).toMatch(
				new RegExp(`title=\\{Published article \\[${tag}\\]\\}`),
			);

			// RIS — probed via the link's own href (absolute, already
			// locale-prefixed server-side, so no redirect ambiguity).
			const risResp = await article.page.request.get(String(risHref), {
				maxRedirects: 0,
			});
			expect(risResp.status()).toBe(200);
			expect(risResp.headers()['content-type'] ?? '').toContain(
				'application/x-Research-Info-Systems',
			);
			const ris = await risResp.text();
			expect(ris).toMatch(/^TY {2}- JOUR/);
			expect(ris).toContain(`TI  - Published article [${tag}]`);
			expect(ris).toContain('JF  - Journal of Public Knowledge');
			expect(ris).toMatch(/ER {2}-\s*$/);
		},
	);

	// Row 4 — the citation carries the auto-assigned DOI as a
	// resolving https://doi.org/ URL (bootstrap: doiCreationTime =
	// publicationCreationTime under prefix 10.1234).
	test(
		'citation includes the DOI URL for a DOI-assigned article',
		{tag: '@regression'},
		async ({pkpApi, browser, baseURL}) => {
			const tag = uniqueTag(test.info(), 'doi');
			const spec = submissionPublished({tag});
			const {submission} = await pkpApi.createSubmission(spec);

			const {article, citation} = await openArticleAnonymously(
				browser,
				baseURL,
			);
			const resp = await article.goto(submission.id);
			expect(resp?.status()).toBe(200);

			// The landing page's own DOI block is the source of truth
			// for what was auto-assigned (its text IS the resolving URL).
			await expect(article.doiLink).toHaveText(
				/https:\/\/doi\.org\/10\.1234\/\S+/,
			);
			const doiUrl = String(await article.doiLink.textContent()).trim();

			// The APA citation embeds the same resolving URL, as both
			// href and visible text (additionalMarkup linkifies it).
			// Never followed: doi.org is off-host, egress is firewalled.
			await expect(citation.outputDoiLink).toHaveAttribute('href', doiUrl);
			await expect(citation.outputDoiLink).toHaveText(doiUrl);
			expect(doiUrl).toMatch(/^https:\/\/doi\.org\/10\.1234\/\S+$/);
		},
	);

	// Row 5 — manager configures primary style + offered styles and
	// downloads; values persist on reopen; the article page reflects
	// exactly the configured subset.
	test(
		'manager configures primary style and offered styles/downloads; front end reflects it',
		{tag: '@regression'},
		async ({pkpApi, asUser, browser, baseURL}) => {
			const tag = uniqueTag(test.info(), 'cfg');
			const {context} = await pkpApi.createJournal({
				tag,
				name: {en: `CSL settings ${tag}`},
				users: [{username: 'dbarnes', roles: ['manager']}],
				issues: [{...SCRATCH_ISSUE, published: true}],
				plugins: {[CSL_PLUGIN]: {enabled: true}},
			});
			const spec = submissionPublished({
				tag,
				journal: context.path,
				issue: {...SCRATCH_ISSUE},
			});
			const {submission} = await pkpApi.createSubmission(spec);

			const managerCtx = await asUser('dbarnes');
			const managerPage = await managerCtx.newPage();
			const pluginsGrid = new WebsitePluginsPage(managerPage, {
				journalPath: context.path,
			});
			await pluginsGrid.goto();

			// --- Configure via the Settings AjaxModal -------------------
			const form = await pluginsGrid.openPluginSettings(
				CSL_PLUGIN,
				CSL_SETTINGS_FORM,
			);
			// fbv inputs: radios name="primaryCitationStyle" (value =
			// style id), checkboxes name="enabledCitationStyles[]" /
			// "enabledCitationDownloads[]" (FormBuilderVocabulary
			// defaults name to the template's id param).
			await form
				.locator('input[name="primaryCitationStyle"][value="vancouver"]')
				.check();
			await setCheckedByValue(form, 'enabledCitationStyles[]', [
				'apa',
				'vancouver',
			]);
			await setCheckedByValue(form, 'enabledCitationDownloads[]', [
				'bibtex',
			]);
			await pluginsGrid.saveAjaxForm(form);

			// --- Persistence: reopen and read the saved state -----------
			const reopened = await pluginsGrid.openPluginSettings(
				CSL_PLUGIN,
				CSL_SETTINGS_FORM,
			);
			await expect(
				reopened.locator(
					'input[name="primaryCitationStyle"][value="vancouver"]',
				),
			).toBeChecked();
			await expect(
				reopened.locator('input[name="enabledCitationStyles[]"][value="apa"]'),
			).toBeChecked();
			await expect(
				reopened.locator(
					'input[name="enabledCitationStyles[]"][value="vancouver"]',
				),
			).toBeChecked();
			await expect(
				reopened.locator(
					'input[name="enabledCitationStyles[]"][value="ieee"]',
				),
			).not.toBeChecked();
			await expect(
				reopened.locator(
					'input[name="enabledCitationDownloads[]"][value="bibtex"]',
				),
			).toBeChecked();
			await expect(
				reopened.locator(
					'input[name="enabledCitationDownloads[]"][value="ris"]',
				),
			).not.toBeChecked();

			// --- Front end: new primary + ONLY the enabled subset -------
			const {article, citation} = await openArticleAnonymously(
				browser,
				baseURL,
				context.path,
			);
			const resp = await article.goto(submission.id);
			expect(resp?.status()).toBe(200);

			// Vancouver primary: "Vaca R." + "Available from:" — and not
			// the APA author shape.
			await expect(citation.output).toContainText('Vaca R.');
			await expect(citation.output).toContainText('Available from:');
			await expect(citation.output).not.toContainText('Vaca, R. (');

			// Offered lists collapse to exactly the configured subset.
			// Counts are safe: the journal is per-test, so no cross-run
			// leakage can inflate them.
			await citation.expandFormats();
			await expect(citation.styleLinks).toHaveCount(2);
			await expect(citation.styleLink('APA')).toBeVisible();
			await expect(citation.styleLink('Vancouver')).toBeVisible();
			await expect(citation.downloadLinks).toHaveCount(1);
			await expect(citation.downloadLink('BibTeX')).toBeVisible();
			await expect(
				citation.downloadLink('Endnote/Zotero/Mendeley (RIS)'),
			).toHaveCount(0);
		},
	);

	// Row 6 — disabling the plugin removes the how-to-cite block and
	// kills the citation download route.
	test(
		'disabling the CSL plugin removes the how-to-cite block and downloads',
		{tag: '@regression'},
		async ({pkpApi, asUser, browser, baseURL}) => {
			const tag = uniqueTag(test.info(), 'off');
			const {context} = await pkpApi.createJournal({
				tag,
				name: {en: `CSL disable ${tag}`},
				users: [{username: 'dbarnes', roles: ['manager']}],
				issues: [{...SCRATCH_ISSUE, published: true}],
				plugins: {[CSL_PLUGIN]: {enabled: true}},
			});
			const spec = submissionPublished({
				tag,
				journal: context.path,
				issue: {...SCRATCH_ISSUE},
			});
			const {submission} = await pkpApi.createSubmission(spec);

			// --- While enabled: block present, download serves ----------
			const {article, citation} = await openArticleAnonymously(
				browser,
				baseURL,
				context.path,
			);
			const resp = await article.goto(submission.id);
			expect(resp?.status()).toBe(200);
			await expect(citation.block).toBeVisible();
			await citation.expandFormats();
			const bibtexHref = String(
				await citation.downloadLink('BibTeX').getAttribute('href'),
			);
			const enabledDl = await article.page.request.get(bibtexHref, {
				maxRedirects: 0,
			});
			expect(enabledDl.status()).toBe(200);
			expect(enabledDl.headers()['content-type'] ?? '').toContain(
				'application/x-bibtex',
			);

			// --- Manager unchecks the plugin in the Plugins grid --------
			const managerCtx = await asUser('dbarnes');
			const managerPage = await managerCtx.newPage();
			const pluginsGrid = new WebsitePluginsPage(managerPage, {
				journalPath: context.path,
			});
			await pluginsGrid.goto();
			await pluginsGrid.disablePlugin(CSL_PLUGIN);
			// The grid row refreshes server-side; the replaced checkbox
			// reports the new state.
			await expect(pluginsGrid.enabledCheckbox(CSL_PLUGIN)).not.toBeChecked({
				timeout: 15_000,
			});

			// --- Block and downloads are gone from the front end --------
			const reloaded = await article.goto(submission.id);
			expect(reloaded?.status()).toBe(200);
			// The article page itself still renders…
			await expect(article.title).toContainText(
				`Published article [${tag}]`,
			);
			// …but the how-to-cite block is gone…
			await expect(citation.block).toHaveCount(0);
			await expect(citation.output).toHaveCount(0);
			// …and the citationstylelanguage page route no longer exists
			// (setPageHandler only routes while enabled) — the captured
			// download URL now 404s.
			const disabledDl = await article.page.request.get(bibtexHref, {
				maxRedirects: 0,
			});
			expect(disabledDl.status()).toBe(404);
		},
	);
});

/**
 * Open the article landing + citation-block POMs on a page from a
 * fresh ANONYMOUS context (explicit empty storageState — patterns.md
 * "Parallel-load lessons" item 8). The context closes at worker
 * teardown; tests that navigate repeatedly reuse the one page.
 *
 * @param {import('@playwright/test').Browser} browser
 * @param {string|undefined} baseURL
 * @param {string} [journalPath='publicknowledge']
 * @returns {Promise<{article: import('../pages/ArticlePage.js').ArticlePage,
 *   citation: import('../pages/CitationBlock.js').CitationBlock}>}
 */
async function openArticleAnonymously(
	browser,
	baseURL,
	journalPath = 'publicknowledge',
) {
	const ctx = await browser.newContext({
		baseURL,
		storageState: {cookies: [], origins: []},
	});
	const page = await ctx.newPage();
	return {
		article: new ArticlePage(page, {journalPath}),
		citation: new CitationBlock(page),
	};
}

/**
 * Set every checkbox of an fbv checkbox group to a wanted-values
 * whitelist: check members, uncheck everything else. Used to restrict
 * the CSL settings' enabled styles/downloads, which default to
 * all-checked.
 *
 * @param {import('@playwright/test').Locator} form
 * @param {string} name  e.g. 'enabledCitationStyles[]'
 * @param {string[]} wanted  style/download ids to leave checked
 */
async function setCheckedByValue(form, name, wanted) {
	const boxes = form.locator(`input[name="${name}"]`);
	const count = await boxes.count();
	if (count === 0) {
		throw new Error(`no checkboxes named ${name} found in the form`);
	}
	for (let i = 0; i < count; i++) {
		const box = boxes.nth(i);
		const value = String(await box.getAttribute('value'));
		if (wanted.includes(value)) {
			await box.check();
		} else {
			await box.uncheck();
		}
	}
}

/**
 * Worker-scoped unique tag with a per-run random component
 * (patterns.md tag conventions + item 10): scratch-journal urlPaths
 * derive from the tag and journals.urlPath is varchar(32), so re-runs
 * on the long-lived test DB must never collide.
 *
 * @param {import('@playwright/test').TestInfo} info
 * @param {string} suffix
 */
function uniqueTag(info, suffix) {
	const rand = Math.random().toString(36).slice(2, 8);
	return `csl-w${info.parallelIndex}-${suffix}-${rand}`;
}
