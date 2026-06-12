// @ts-check
const {test, expect} = require('../support/fixtures.js');
const {ArticlePage} = require('../pages/ArticlePage.js');
const submissionPublished = require('../fixtures/scenarios/submission-published.js');

/**
 * Article landing — docs/e2e/plans/article-landing.md rows 1, 2, 4, 5,
 * 6 and 10 (rows 8–9 live in the sibling article-dc-metadata.spec.js;
 * rows 3 and 7 are dropped to their owning plans).
 *
 * Every test asserts as an ANONYMOUS reader against a per-test seeded
 * published submission on publicknowledge. Contexts are opened with an
 * explicit empty storageState (patterns.md "Parallel-load lessons"
 * item 8) so the assertions can never ride a logged-in session's
 * preview privileges.
 *
 * Seeding notes (grep-verified against live sources):
 *   - `publications[].galleys[]` (wave-1 build) seeds a PDF galley at
 *     galley-grid parity with a PROOF-stage default-article.pdf —
 *     PublicationsProcessor#seedGalleys. The scenario response echoes
 *     `publications[i].galleys[i].id`.
 *   - Bootstrap enrichment auto-assigns DOIs on publish (enableDois +
 *     doiPrefix 10.1234 + doiCreationTime publicationCreationTime in
 *     playwright/fixtures/bootstrap.js). The resolving URL points at
 *     doi.org — asserted as a rendered href, NEVER followed (egress is
 *     firewalled; patterns.md item 6).
 *   - Multi-version seeding: publications[] entry i>0 goes through
 *     Repo::publication()->version() (clones title incl. the appended
 *     [tag]); per-entry `published: true` publishes it, moving the
 *     current-publication pointer to the latest published version.
 *
 * Template realities (templates/frontend/objects/article_details.tpl):
 *   - `pages` does NOT render on the landing page in the default theme
 *     — only the issue TOC's article_summary.tpl shows it (`div.pages`).
 *     Row 1 therefore asserts pages on the TOC reached through the
 *     issue-identification link, which the row asserts anyway.
 *   - The plain-language summary reuses the abstract's
 *     `section.item.abstract` classes; only the heading differs.
 *   - In the `.versions` list the version being VIEWED renders as plain
 *     text; the current version links to the canonical URL and older
 *     versions link to `/article/view/{id}/version/{publicationId}`
 *     (article_details.tpl lines 386-397). "Each entry links" is
 *     therefore asserted across two page loads: current → v1 link,
 *     v1 page → canonical link back.
 *   - pdfJsViewer ships enabled (settings.xml) and hooks
 *     ArticleHandler::view::galley; its display.tpl fills
 *     `#pdfCanvasContainer > iframe` src with
 *     `{pluginUrl}/pdf.js/web/viewer.html?file={encodeURIComponent(downloadUrl)}`
 *     on document-ready (toHaveAttribute auto-retries past the JS).
 */
test.describe('Article landing', () => {
	// Row 1 — core metadata renders on the article landing page.
	test(
		'core metadata renders on the article landing page',
		{tag: '@smoke'},
		async ({pkpApi, browser, baseURL}) => {
			const tag = uniqueTag(test.info(), 'core');
			const spec = submissionPublished({tag});
			spec.publications[0].metadata.subtitle = {
				en: 'A scenario-driven subtitle',
			};
			spec.publications[0].metadata.plainLanguageSummary = {
				en: '<p>Plain words summarizing the article for everyone.</p>',
			};
			const {submission} = await pkpApi.createSubmission(spec);

			const reader = await openArticlePageAnonymously(browser, baseURL);
			const resp = await reader.goto(submission.id);
			expect(resp?.status()).toBe(200);

			// Title + subtitle heading.
			await expect(reader.title).toContainText(`Published article [${tag}]`);
			await expect(reader.subtitle).toHaveText('A scenario-driven subtitle');

			// Author list — the submitter (rvaca) is the sole seeded author.
			await expect(reader.authorNames).toHaveCount(1);
			await expect(reader.authorNames).toHaveText(/Ramiro\s+Vaca/);

			// Abstract + plain-language summary render as separate sections.
			const abstract = reader.abstractSection('Abstract');
			await expect(abstract).toContainText(
				'A fully-processed, published article in scenario form.',
			);
			const summary = reader.abstractSection('Plain Language Summary');
			await expect(summary).toContainText(
				'Plain words summarizing the article for everyone.',
			);

			// Keywords (fixture defaults).
			await expect(reader.keywords).toContainText('testing');
			await expect(reader.keywords).toContainText('published');

			// Section name.
			await expect(reader.sectionName).toHaveText('Articles');

			// DOI block — auto-assigned on publish (bootstrap enrichment);
			// both the href and the visible text are the resolving URL.
			// Never followed: doi.org is off-host and egress is firewalled.
			// The text regex is unanchored: toHaveText matches regexes
			// against the raw element text incl. template whitespace.
			await expect(reader.doiLink).toHaveAttribute(
				'href',
				/^https:\/\/doi\.org\/10\.1234\/.+/,
			);
			await expect(reader.doiLink).toHaveText(
				/https:\/\/doi\.org\/10\.1234\/\S+/,
			);

			// Issue identification links to the issue TOC…
			await expect(reader.issueLink).toHaveText('Vol. 1 No. 2 (2014)');
			await expect(reader.issueLink).toHaveAttribute(
				'href',
				/\/issue\/view\/\d+/,
			);
			await reader.issueLink.click();
			await reader.page.waitForURL(/\/issue\/view\/\d+/, {
				waitUntil: 'commit',
			});

			// …where this article's summary carries the seeded pages range
			// (the default theme renders pages only on the TOC summary, not
			// on the landing page itself — see spec header).
			const tocSummary = reader.page
				.locator('.obj_article_summary')
				.filter({hasText: `[${tag}]`});
			await expect(tocSummary).toHaveCount(1);
			await expect(tocSummary.locator('.pages')).toHaveText('1-10');
		},
	);

	// Row 2 — license and copyright block.
	test(
		'license and copyright block displays for anonymous readers',
		{tag: '@regression'},
		async ({pkpApi, browser, baseURL}) => {
			const tag = uniqueTag(test.info(), 'license');
			// Fixture defaults already carry the row's seed: licenseUrl
			// CC-BY 4.0, copyrightHolder 'The Author', copyrightYear 2026.
			const spec = submissionPublished({tag});
			const {submission} = await pkpApi.createSubmission(spec);

			const reader = await openArticlePageAnonymously(browser, baseURL);
			const resp = await reader.goto(submission.id);
			expect(resp?.status()).toBe(200);

			await expect(
				reader.licenseBlock.getByRole('heading', {
					name: 'License',
					exact: true,
				}),
			).toBeVisible();

			// Copyright statement substitutes holder + year
			// (submission.copyrightStatement locale key).
			await expect(reader.licenseBlock).toContainText(
				'Copyright (c) 2026 The Author',
			);

			// CC-BY 4.0 badge (getCCLicenseBadge → submission.license.cc
			// .by4.footer): a rel=license image link plus a text link, both
			// at the canonical license URL. The badge <img> loads from
			// i.creativecommons.org which is firewalled, so assert element
			// presence/attributes, not image visibility.
			const ccUrl = 'https://creativecommons.org/licenses/by/4.0/';
			await expect(
				reader.licenseBlock.locator(
					'a[rel="license"] img[alt="Creative Commons License"]',
				),
			).toHaveCount(1);
			const textLink = reader.licenseBlock.getByRole('link', {
				name: 'Creative Commons Attribution 4.0 International License',
			});
			await expect(textLink).toBeVisible();
			await expect(textLink).toHaveAttribute('href', ccUrl);
		},
	);

	// Row 4 — seeded PDF galley listed, viewable and downloadable.
	test(
		'seeded PDF galley is listed, viewable and downloadable by anonymous readers',
		{tag: '@smoke'},
		async ({pkpApi, browser, baseURL}) => {
			const tag = uniqueTag(test.info(), 'galley');
			const spec = submissionPublished({tag});
			spec.publications[0].galleys = [{label: 'PDF'}];
			const {submission, publications} = await pkpApi.createSubmission(spec);
			const galley = publications[0].galleys[0];

			const reader = await openArticlePageAnonymously(browser, baseURL);
			const resp = await reader.goto(submission.id);
			expect(resp?.status()).toBe(200);

			// Listed in galleys_links, recognized as a PDF galley, linking
			// to the public view route.
			const link = reader.galleyLink('PDF');
			await expect(link).toHaveCount(1);
			await expect(link).toHaveClass(/\bpdf\b/);
			await expect(link).toHaveAttribute(
				'href',
				new RegExp(`/article/view/${submission.id}/${galley.id}$`),
			);

			// The galley view URL loads (pdfJsViewer's display template —
			// its internals are row 10's job).
			const href = await link.getAttribute('href');
			const viewResp = await reader.page.goto(String(href));
			expect(viewResp?.status()).toBe(200);

			// Download responds 200 with PDF content. Locale-prefixed URL:
			// a maxRedirects:0 probe of the bare form would see the locale
			// 302 instead (patterns.md item 9).
			const dl = await reader.page.request.get(
				reader.downloadUrl(submission.id, galley.id),
				{maxRedirects: 0},
			);
			expect(dl.status()).toBe(200);
			expect(dl.headers()['content-type'] ?? '').toContain('application/pdf');
		},
	);

	// Row 5 — versions list with an entry per published version.
	test(
		'versions list shows every published version and links each version URL',
		{tag: '@regression'},
		async ({pkpApi, browser, baseURL}) => {
			const tag = uniqueTag(test.info(), 'versions');
			const spec = submissionPublished({tag});
			// v2: published minor VoR bump (1.1). version() clones v1's
			// metadata (title keeps the [tag]); the issue assignment is set
			// explicitly because publish targets it.
			spec.publications.push({
				versionStage: 'VoR',
				versionIsMinor: true,
				published: true,
				issue: {volume: 1, number: 2, year: 2014},
			});
			const {submission, publications} = await pkpApi.createSubmission(spec);
			const [v1, v2] = publications;
			expect(v1.status).toBe(3); // STATUS_PUBLISHED
			expect(v2.status).toBe(3);

			const reader = await openArticlePageAnonymously(browser, baseURL);

			// Canonical URL serves the current version (v2): two entries,
			// the viewed version is plain text, the superseded v1 links to
			// its own version URL. (The outdated-version notice on v1's
			// page is publication-versioning row 1's territory.)
			const resp = await reader.goto(submission.id);
			expect(resp?.status()).toBe(200);
			await expect(reader.versionsSection).toBeVisible();
			await expect(reader.versionEntries).toHaveCount(2);
			await expect(reader.versionLinks).toHaveCount(1);
			await expect(reader.versionLinks).toHaveAttribute(
				'href',
				new RegExp(`/article/view/${submission.id}/version/${v1.id}$`),
			);

			// v1's version URL renders with the same two-entry list, now
			// linking back to the canonical URL of the current version.
			const respV1 = await reader.goto(submission.id, {version: v1.id});
			expect(respV1?.status()).toBe(200);
			await expect(reader.versionEntries).toHaveCount(2);
			await expect(reader.versionLinks).toHaveCount(1);
			await expect(reader.versionLinks).toHaveAttribute(
				'href',
				new RegExp(`/article/view/${submission.id}$`),
			);
		},
	);

	// Row 6 — multilingual metadata on the secondary-locale page.
	test(
		'secondary-locale URL renders French title and abstract; en URL keeps English',
		{tag: '@regression'},
		async ({pkpApi, browser, baseURL}) => {
			const tag = uniqueTag(test.info(), 'frca');
			const spec = submissionPublished({tag});
			spec.publications[0].metadata.title = {
				en: 'Published article',
				fr_CA: 'Article publié',
			};
			spec.publications[0].metadata.abstract = {
				en: '<p>An English abstract for locale routing.</p>',
				fr_CA: '<p>Un résumé français pour le routage des locales.</p>',
			};
			const {submission} = await pkpApi.createSubmission(spec);

			const reader = await openArticlePageAnonymously(browser, baseURL);

			// fr_CA URL: French title (the seeding tag is appended to every
			// title locale) and French abstract. The abstract section is
			// matched by content, not by its localized heading, so the
			// assertion doesn't double as a UI-translation test.
			const respFr = await reader.goto(submission.id, {locale: 'fr_CA'});
			expect(respFr?.status()).toBe(200);
			await expect(reader.title).toContainText(`Article publié [${tag}]`);
			await expect(reader.title).not.toContainText('Published article');
			await expect(
				reader.page
					.locator('section.item.abstract')
					.filter({hasText: 'Un résumé français pour le routage des locales.'}),
			).toBeVisible();

			// en URL keeps English on the same submission.
			const respEn = await reader.goto(submission.id, {locale: 'en'});
			expect(respEn?.status()).toBe(200);
			await expect(reader.title).toContainText(`Published article [${tag}]`);
			await expect(reader.title).not.toContainText('Article publié');
			await expect(
				reader.page
					.locator('section.item.abstract')
					.filter({hasText: 'An English abstract for locale routing.'}),
			).toBeVisible();
			await expect(
				reader.page
					.locator('section.item.abstract')
					.filter({hasText: 'Un résumé français pour le routage des locales.'}),
			).toHaveCount(0);
		},
	);

	// Row 10 — pdfJsViewer smoke: galley link opens the inline viewer.
	test(
		'pdfJsViewer smoke: galley link opens the inline PDF viewer',
		{tag: '@regression'},
		async ({pkpApi, browser, baseURL}) => {
			const tag = uniqueTag(test.info(), 'viewer');
			const spec = submissionPublished({tag});
			spec.publications[0].galleys = [{label: 'PDF'}];
			const {submission, publications} = await pkpApi.createSubmission(spec);
			const galley = publications[0].galleys[0];

			const reader = await openArticlePageAnonymously(browser, baseURL);
			const resp = await reader.goto(submission.id);
			expect(resp?.status()).toBe(200);

			// Follow the galley link the way a reader does.
			await reader.galleyLink('PDF').click();
			await reader.page.waitForURL(
				new RegExp(`/article/view/${submission.id}/${galley.id}$`),
				{waitUntil: 'commit'},
			);

			// The plugin's display template fills the iframe src on
			// document-ready: {pluginUrl}/pdf.js/web/viewer.html?file=
			// {encodeURIComponent(absolute download URL)} — the encoded
			// http%3A%2F%2F prefix proves the URL went through
			// encodeURIComponent.
			const iframe = reader.page.locator('#pdfCanvasContainer > iframe');
			await expect(iframe).toHaveAttribute(
				'src',
				/\/pdf\.js\/web\/viewer\.html\?file=http%3A%2F%2F/,
			);

			// The embedded download URL targets this galley and serves the
			// PDF (on-host; redirects, if any, stay on the loopback host).
			const src = String(await iframe.getAttribute('src'));
			const fileUrl = new URL(src).searchParams.get('file');
			expect(String(fileUrl)).toContain(
				`/article/download/${submission.id}/${galley.id}`,
			);
			const dl = await reader.page.request.get(String(fileUrl));
			expect(dl.status()).toBe(200);
			expect(dl.headers()['content-type'] ?? '').toContain('application/pdf');
		},
	);
});

/**
 * Open the article landing POM on a page from a fresh ANONYMOUS
 * context. The empty storageState is explicit (patterns.md
 * "Parallel-load lessons" item 8): a bare newContext() would inherit
 * any test.use({user}) session and editors can preview unpublished
 * content, silently weakening every anonymous assertion. The context
 * closes with the browser at worker teardown; tests that navigate a
 * lot reuse the one page.
 *
 * @param {import('@playwright/test').Browser} browser
 * @param {string|undefined} baseURL
 * @returns {Promise<import('../pages/ArticlePage.js').ArticlePage>}
 */
async function openArticlePageAnonymously(browser, baseURL) {
	const ctx = await browser.newContext({
		baseURL,
		storageState: {cookies: [], origins: []},
	});
	const page = await ctx.newPage();
	return new ArticlePage(page);
}

/**
 * Worker-scoped unique tag (whitespace-free; see patterns.md tag
 * conventions). Unlike the worker+title-only helper in galleys.spec.js
 * this one adds a per-run random suffix (the versioning-states.spec.js
 * shape): the test DB is long-lived, so re-runs of the SAME test leave
 * identically-tagged published articles on the shared issue TOC —
 * row 1 counts tag matches there and would collide with its own
 * previous runs.
 *
 * @param {import('@playwright/test').TestInfo} info
 * @param {string} suffix
 */
function uniqueTag(info, suffix) {
	const rand = Math.random().toString(36).slice(2, 8);
	return `al-w${info.parallelIndex}-${suffix}-${rand}`;
}
