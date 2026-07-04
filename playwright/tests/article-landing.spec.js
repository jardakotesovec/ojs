// @ts-check
const {test, expect} = require('../support/fixtures.js');
const {ArticlePage} = require('../pages/ArticlePage.js');

/**
 * Article landing page — the reader-facing ARTICLE abstract page
 * (`/article/view/{id}`). One test per canonical scenario of
 * docs/product/specs/article-landing.md (11 scenarios), landed at 10 by
 * merging the PDF-view + galley-download scenarios (2 + 3-download) into a
 * single reader test.
 *
 * This spec OWNS the page and its reader render: the metadata block, the
 * reader galley LINKS (view/download), the license/copyright/DOI display, the
 * plugin-injected how-to-cite block, the version view + outdated notice, the
 * data-availability statement, and the DC/Google-Scholar indexer meta tags.
 * The galley DOWNLOAD stream + pdf.js render plugin are owned by `galleys`
 * (re-touched here only as the boundary smoke the article link hands off to).
 *
 * SEEDING (the spec author's blocker): the fresh TEST DB has 0 published
 * articles, so every test SEEDS its own rich published article on the TEST DB
 * via the scenario API and drives the anonymous reader page. publicknowledge's
 * bootstrap already: enables the citationStyleLanguage plugin (how-to-cite),
 * auto-mints a DOI on publish (enableDois + publicationCreationTime), and ships
 * dublinCoreMeta + googleScholar on by default (the meta tags). The author
 * ORCID, license/copyright, keywords and data-availability statement are seeded
 * per-publication through the `metadata` passthrough (+ the `author` orcid
 * passthrough) — which is what let this spec close the blocks the spec author
 * could not drive live (how-to-cite / license / DOI / ORCID / data-availability
 * / meta tags), all live-verified rendering during authoring.
 *
 * ANONYMITY: every reader assertion runs in a fresh browser context with an
 * explicit empty storageState — an editor session can PREVIEW unpublished
 * content, turning expected 404s into 200s (patterns.md item 8). The file's
 * default user (dbarnes) is only used for the editor-preview contrast in the
 * published-only test.
 *
 * publicknowledge is never mutated: only fresh submissions are added, and its
 * published issue (Vol 1 No 2 2014) is published INTO but never changed. The
 * subscription-gate test runs on a per-test scratch journal.
 */

// ---- status constants (verified against source) ---------------------------
const PUB_STATUS_PUBLISHED = 3; // PKPPublication::STATUS_PUBLISHED

// ---- reader-side notice strings (locale/en) -------------------------------
const OUTDATED_NOTICE = 'This is an outdated version';

// ---- seeded license / ORCID (recognised CC-BY 4.0 → a badge is computed) ---
const CC_BY_URL = 'https://creativecommons.org/licenses/by/4.0/';
const ORCID_URL = 'https://orcid.org/0000-0002-1825-0097';

// ---- subscription-gate constants (verified) --------------------------------
// APP\journal\Journal: PUBLISHING_MODE_OPEN=0, PUBLISHING_MODE_SUBSCRIPTION=1.
const PUBLISHING_MODE_SUBSCRIPTION = 1;
// APP\issue\Issue: ISSUE_ACCESS_OPEN=1, ISSUE_ACCESS_SUBSCRIPTION=2.
const ISSUE_ACCESS_SUBSCRIPTION = 2;

/** A unique, hyphenless, alphanumeric tag (parallel isolation). */
function uniqueTag() {
	const workerIndex = test.info().parallelIndex;
	const suffix = Math.random().toString(36).slice(2, 8);
	return `al${workerIndex}x${suffix}`;
}

/** A fresh anonymous browser context (explicit empty storage state). */
async function newAnonContext(browser, baseURL) {
	return browser.newContext({
		baseURL,
		storageState: {cookies: [], origins: []},
	});
}

/**
 * A VoR-published submission on publicknowledge assigned to the published
 * issue (Vol 1 No 2 2014 — open access). Rich reader content is seeded through
 * the `metadata` passthrough; the submitting author carries a verified ORCID.
 *
 * @param {object} opts
 * @param {string} opts.tag
 * @param {string} opts.title
 * @param {string} [opts.journal='publicknowledge']
 * @param {object} [opts.issue={volume:1,number:2,year:2014}]
 * @param {object} [opts.metadata] extra publication metadata (merged)
 * @param {object[]} [opts.galleys] galley specs (default: one PDF galley)
 * @param {boolean} [opts.orcid=true] seed the author ORCID
 * @param {object[]} [opts.publications] override the publications array wholesale
 */
function publishedSpec({
	tag,
	title,
	journal = 'publicknowledge',
	issue = {volume: 1, number: 2, year: 2014},
	metadata = {},
	galleys = [{label: 'PDF', file: 'default-article.pdf'}],
	orcid = true,
	publications,
}) {
	return {
		tag,
		journal,
		submitter: 'atester',
		section: 'ART',
		locale: 'en',
		...(orcid ? {author: {orcid: ORCID_URL, orcidIsVerified: true}} : {}),
		participants: [{user: 'dbarnes', role: 'editor', canChangeMetadata: true}],
		decisions: [
			{type: 'skipExternalReview', by: 'dbarnes'},
			{type: 'sendToProduction', by: 'dbarnes'},
		],
		publications: publications ?? [
			{
				versionStage: 'VoR',
				metadata: {title: {en: title}, ...metadata},
				issue,
				published: true,
				...(galleys ? {galleys} : {}),
			},
		],
	};
}

test.use({user: 'dbarnes'}); // manager on publicknowledge (editor-preview contrast only)

test.describe('Article landing page (anonymous reader)', () => {
	// Canonical scenario 1 — Reader opens a published article. The abstract page
	// renders the full metadata block: title, authors (name + verified ORCID
	// link), abstract, keywords, the journal section, the published date + the
	// single-version list, and lists the article's PDF galley in the sidebar.
	test(
		'reader opens a published article and sees its metadata',
		{tag: ['@smoke', '@regression']},
		async ({pkpApi, browser, baseURL}) => {
			const tag = uniqueTag();
			const {submission, publications} = await pkpApi.createSubmission(
				publishedSpec({
					tag,
					title: `Reader metadata ${tag}`,
					metadata: {
						abstract: {en: `<p>Abstract body for ${tag}.</p>`},
						keywords: [`Climate ${tag}`, 'Open data'],
					},
				}),
			);
			expect(publications[0].status).toBe(PUB_STATUS_PUBLISHED);

			const anon = await newAnonContext(browser, baseURL);
			try {
				const reader = await anon.newPage();
				const article = new ArticlePage(reader);

				const resp = await article.goto(submission.id, {locale: 'en'});
				expect(resp?.status()).toBe(200);

				// Title (carries the tag).
				await expect(article.title).toContainText(tag);

				// Authors — the submitting author, with a verified ORCID link.
				await expect(article.authorNames.first()).toBeVisible();
				await expect(article.orcidLinks.first()).toHaveAttribute(
					'href',
					new RegExp(ORCID_URL.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
				);

				// Abstract, keywords, section.
				await expect(article.abstractSection('Abstract')).toContainText(
					`Abstract body for ${tag}`,
				);
				await expect(article.keywords).toContainText(`Climate ${tag}`);
				await expect(article.sectionName).toContainText('Articles');

				// Published date + the single-version list.
				await expect(reader.locator('.item.published')).toBeVisible();
				await expect(article.versionEntries).toHaveCount(1);

				// The PDF galley link is listed in the sidebar.
				await expect(article.galleyLink('PDF')).toBeVisible();
			} finally {
				await anon.close();
			}
		},
	);

	// Canonical scenario 2 (+ 3-download) — Reader downloads the PDF galley via
	// pdf.js. The galley LINK on the article page is open-access (not restricted);
	// clicking it hands off to the pdfJsViewer plugin, which renders the file in
	// the embedded pdf.js viewer (#pdfCanvasContainer → pdf.js/web/viewer.html);
	// the raw download streams the PDF bytes. (The render plugin + download stream
	// are owned by `galleys`; this owns the reader link that reaches them.)
	test(
		'reader opens the PDF galley in the pdf.js viewer and downloads it',
		{tag: ['@smoke', '@regression']},
		async ({pkpApi, browser, baseURL}) => {
			const tag = uniqueTag();
			const {submission, publications} = await pkpApi.createSubmission(
				publishedSpec({tag, title: `Reader PDF ${tag}`}),
			);
			const galleyId = publications[0].galleys[0].id;

			const anon = await newAnonContext(browser, baseURL);
			try {
				const reader = await anon.newPage();
				const article = new ArticlePage(reader);
				await article.goto(submission.id, {locale: 'en'});

				// The galley link is present and NOT restricted (open access default).
				const link = article.galleyLink('PDF');
				await expect(link).toBeVisible();
				await expect(link).not.toHaveClass(/restricted/);

				// Clicking the reader link hands off to the pdfJsViewer render.
				await link.click();
				await expect(reader.locator('#pdfCanvasContainer')).toBeVisible({
					timeout: 20_000,
				});
				const viewer = reader.locator('#pdfCanvasContainer iframe');
				await expect(viewer).toBeVisible();
				await expect
					.poll(() => viewer.getAttribute('src'), {timeout: 15_000})
					.toContain('pdf.js/web/viewer.html');

				// The raw galley download streams the PDF bytes.
				const dl = await reader.request.get(
					article.downloadUrl(submission.id, galleyId),
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

	// Canonical scenario 7 — Reader sees the license, copyright and DOI. A CC-BY
	// 4.0 license + copyright statement are seeded onto the publication; the DOI
	// is auto-minted on publish (publicknowledge). The sidebar shows the CC badge
	// (a `rel="license"` link to the CC URL) + the copyright statement, and the
	// DOI as a resolving link.
	test(
		'reader sees the license, copyright and DOI',
		{tag: ['@smoke', '@regression']},
		async ({pkpApi, browser, baseURL}) => {
			const tag = uniqueTag();
			const {submission, publications} = await pkpApi.createSubmission(
				publishedSpec({
					tag,
					title: `License DOI ${tag}`,
					metadata: {
						licenseUrl: CC_BY_URL,
						copyrightHolder: {en: `Authors ${tag}`},
						copyrightYear: 2024,
					},
				}),
			);
			expect(publications[0].status).toBe(PUB_STATUS_PUBLISHED);

			const anon = await newAnonContext(browser, baseURL);
			try {
				const reader = await anon.newPage();
				const article = new ArticlePage(reader);
				await article.goto(submission.id, {locale: 'en'});

				// License block: copyright statement + the CC-BY badge link.
				await expect(article.licenseBlock).toBeVisible();
				await expect(article.licenseBlock).toContainText(`Authors ${tag}`);
				await expect(article.licenseBlock).toContainText('2024');
				// The CC badge renders as a `rel="license"` link to the CC URL
				// (both the badge image and the footer text link, hence >= 1).
				await expect(
					article.licenseBlock
						.locator(
							'a[rel="license"][href*="creativecommons.org/licenses/by/4.0"]',
						)
						.first(),
				).toBeVisible();

				// DOI: the auto-minted resolving link (prefix 10.1234).
				await expect(article.doiSection).toBeVisible();
				await expect(article.doiLink).toHaveAttribute(
					'href',
					/doi\.org\/10\.1234\//,
				);
			} finally {
				await anon.close();
			}
		},
	);

	// Canonical scenario 6 — Reader reads the how-to-cite block and grabs a
	// BibTeX file. citationStyleLanguage is enabled on publicknowledge, so the
	// article page carries a server-rendered "How to Cite" block: the article
	// formatted in the primary style (APA), a citation-formats dropdown, and
	// export downloads. The BibTeX download link streams a BibTeX file.
	test(
		'reader reads the how-to-cite block and downloads a BibTeX citation',
		{tag: ['@smoke', '@regression']},
		async ({pkpApi, browser, baseURL}) => {
			const tag = uniqueTag();
			const {submission} = await pkpApi.createSubmission(
				publishedSpec({tag, title: `How to cite ${tag}`}),
			);

			const anon = await newAnonContext(browser, baseURL);
			try {
				const reader = await anon.newPage();
				const article = new ArticlePage(reader);
				await article.goto(submission.id, {locale: 'en'});

				// The how-to-cite block renders with a non-empty formatted citation.
				await expect(article.citationBlock).toBeVisible();
				await expect(
					article.citationBlock.getByRole('heading', {name: 'How to Cite'}),
				).toBeVisible();
				await expect(article.citationOutput).toContainText(/\w/);

				// The citation-formats control and a BibTeX export link are offered.
				await expect(
					article.citationBlock.getByRole('button', {name: /Citation Formats/i}),
				).toBeVisible();
				const bibtex = article.citationDownloadLink('bibtex');
				await expect(bibtex).toHaveCount(1);

				// Fetching the BibTeX link streams a BibTeX file (not an HTML page).
				const href = await bibtex.getAttribute('href');
				expect(href, 'bibtex download href').toBeTruthy();
				const res = await reader.request.get(/** @type {string} */ (href));
				expect(res.ok(), `bibtex download ${res.status()}`).toBeTruthy();
				expect(res.headers()['content-type']).toContain('bibtex');
			} finally {
				await anon.close();
			}
		},
	);

	// Canonical scenario 4 — Reader views an older version and sees the "outdated"
	// notice. A two-version article: the plain URL serves the current version
	// (no notice, indexable); `/version/{oldPubId}` serves the old version WITH
	// the outdated-version notice, a `<meta name="robots" content="noindex">`
	// header, and a `<link rel="canonical">` to the latest.
	test(
		'reader views an older version and sees the outdated notice + noindex/canonical',
		{tag: ['@smoke', '@regression']},
		async ({pkpApi, browser, baseURL}) => {
			const tag = uniqueTag();
			const {submission, publications} = await pkpApi.createSubmission(
				publishedSpec({
					tag,
					title: `Versioned ${tag}`,
					publications: [
						{
							versionStage: 'VoR',
							metadata: {title: {en: `Versioned v1 ${tag}`}},
							issue: {volume: 1, number: 2, year: 2014},
							published: true,
						},
						{
							versionStage: 'VoR',
							versionIsMinor: true,
							metadata: {title: {en: `Versioned v2 ${tag}`}},
							issue: {volume: 1, number: 2, year: 2014},
							published: true,
						},
					],
				}),
			);
			expect(publications).toHaveLength(2);
			const v1Id = publications[0].id;

			const anon = await newAnonContext(browser, baseURL);
			try {
				const reader = await anon.newPage();
				const article = new ArticlePage(reader);

				// Current version: no outdated notice, and the head is NOT noindex'd.
				await article.goto(submission.id, {locale: 'en'});
				await expect(reader.getByText(OUTDATED_NOTICE)).toHaveCount(0);
				await expect(article.versionEntries).toHaveCount(2);
				const currentHtml = await (
					await anon.request.get(article.url(submission.id, {locale: 'en'}))
				).text();
				expect(currentHtml).not.toContain('name="robots" content="noindex"');

				// Old version: outdated notice shown + noindex + canonical to latest.
				await article.goto(submission.id, {locale: 'en', version: v1Id});
				await expect(reader.getByText(OUTDATED_NOTICE)).toBeVisible();
				await expect(article.title).toContainText(`v1 ${tag}`);

				const oldHtml = await (
					await anon.request.get(
						article.url(submission.id, {locale: 'en', version: v1Id}),
					)
				).text();
				expect(oldHtml).toContain('<meta name="robots" content="noindex">');
				expect(oldHtml).toMatch(/<link rel="canonical" href="[^"]*article\/view\//);
			} finally {
				await anon.close();
			}
		},
	);

	// Canonical scenario 8 — Reader reads the data-availability statement. A
	// statement seeded on the publication renders in its own section
	// (#data-availability-statement) on the reader page (row 98's "statement
	// shows" half; the structured data citations have no reader display — that
	// negative is owned + covered by data-availability-citations.spec.js).
	test(
		'reader reads the data-availability statement',
		{tag: ['@smoke', '@regression']},
		async ({pkpApi, browser, baseURL}) => {
			const tag = uniqueTag();
			const statement = `Raw data archived at Dryad ${tag}`;
			const {submission} = await pkpApi.createSubmission(
				publishedSpec({
					tag,
					title: `Data availability ${tag}`,
					metadata: {dataAvailability: {en: `<p>${statement}</p>`}},
				}),
			);

			const anon = await newAnonContext(browser, baseURL);
			try {
				const reader = await anon.newPage();
				const article = new ArticlePage(reader);
				await article.goto(submission.id, {locale: 'en'});

				await expect(article.dataAvailabilitySection).toBeVisible();
				await expect(article.dataAvailabilitySection).toContainText(statement);
			} finally {
				await anon.close();
			}
		},
	);

	// Canonical scenario 9 — Indexer crawls the DC / Google-Scholar meta tags.
	// The default-on dublinCoreMeta + googleScholar plugins inject machine-
	// readable Dublin Core (`DC.*`) and Google Scholar (`citation_*`, incl.
	// `citation_pdf_url` for the PDF galley) meta tags into the page head. A raw
	// HTTP crawl of the page finds both families.
	test(
		'indexer crawls the Dublin Core / Google Scholar meta tags',
		{tag: ['@smoke', '@regression']},
		async ({pkpApi, browser, baseURL}) => {
			const tag = uniqueTag();
			const {submission} = await pkpApi.createSubmission(
				publishedSpec({
					tag,
					title: `Meta tags ${tag}`,
					metadata: {keywords: [`Indexing ${tag}`]},
				}),
			);

			const anon = await newAnonContext(browser, baseURL);
			try {
				const article = new ArticlePage(await anon.newPage());
				const res = await anon.request.get(
					article.url(submission.id, {locale: 'en'}),
				);
				expect(res.ok(), `article page ${res.status()}`).toBeTruthy();
				const html = await res.text();

				// Dublin Core family.
				expect(html).toContain('<link rel="schema.DC"');
				expect(html).toContain('name="DC.Title"');
				expect(html).toContain('name="DC.Creator.PersonalName"');
				expect(html).toContain('name="DC.Identifier.DOI"');

				// Google Scholar family (incl. the PDF url for the galley).
				expect(html).toContain('name="citation_title"');
				expect(html).toContain('name="citation_author"');
				expect(html).toContain('name="citation_doi"');
				expect(html).toContain('name="citation_pdf_url"');
			} finally {
				await anon.close();
			}
		},
	);

	// Canonical scenario 5 — Published-only public visibility. An unpublished
	// article (and a non-existent id) is NOT-FOUND to the anonymous reader (404,
	// never a login wall); the same unpublished article is previewable by an
	// editorial user (canPreview → 200). Rule 2 — the core gate.
	test(
		'unpublished / non-existent articles are 404 to the public but previewable by staff',
		{tag: ['@smoke', '@regression']},
		async ({page, pkpApi, browser, baseURL}) => {
			const tag = uniqueTag();
			// A submitted but unpublished stage-1 submission (no publish).
			const {submission} = await pkpApi.createSubmission({
				tag,
				journal: 'publicknowledge',
				submitter: 'atester',
				section: 'ART',
				locale: 'en',
				submitted: true,
				participants: [{user: 'dbarnes', role: 'editor'}],
				publications: [{metadata: {title: {en: `Unpublished ${tag}`}}}],
			});

			const anon = await newAnonContext(browser, baseURL);
			try {
				const article = new ArticlePage(await anon.newPage());
				// Unpublished → 404 anonymous.
				const unpub = await anon.request.get(
					article.url(submission.id, {locale: 'en'}),
				);
				expect(unpub.status(), 'unpublished anon 404').toBe(404);
				// Non-existent id → 404 anonymous.
				const missing = await anon.request.get(
					article.url(99999999, {locale: 'en'}),
				);
				expect(missing.status(), 'non-existent anon 404').toBe(404);
			} finally {
				await anon.close();
			}

			// The editorial user (dbarnes, manager → canPreview) sees the same
			// unpublished article: a preview 200, not a 404.
			const preview = await page.request.get(
				`/index.php/publicknowledge/en/article/view/${submission.id}`,
			);
			expect(preview.status(), 'editor preview 200').toBe(200);
		},
	);

	// Canonical scenario 3 — Reader hits a subscription gate on a galley. On a
	// SUBSCRIPTION journal with a subscription-access issue, a published
	// article's abstract page stays readable (200), but its galley link is drawn
	// `restricted` (with subscription-access screen-reader text), and opening the
	// galley routes the anonymous reader to the login/subscribe flow instead of
	// the file. Driven on a per-test scratch subscription journal (single-locale
	// → bare reader URLs, patterns.md item 9). The download stream + payment gate
	// themselves are owned by `subscriptions`/`payments`.
	test(
		'reader hits a subscription gate: abstract open, galley link restricted, view routes to login',
		{tag: '@regression'},
		async ({pkpApi, browser, baseURL}) => {
			const tag = uniqueTag();

			// Scratch SUBSCRIPTION journal with a published subscription-access issue.
			const {context} = await pkpApi.createJournal({
				tag,
				publishingMode: PUBLISHING_MODE_SUBSCRIPTION,
				users: [
					{username: 'dbarnes', roles: ['manager']},
					{username: 'atester', roles: ['author']},
				],
				issues: [
					{
						volume: 1,
						number: 1,
						year: 2024,
						published: true,
						accessStatus: ISSUE_ACCESS_SUBSCRIPTION,
					},
				],
			});
			const journalPath = context.path;

			const {submission, publications} = await pkpApi.createSubmission(
				publishedSpec({
					tag: `${tag}s`,
					title: `Subscription ${tag}`,
					journal: journalPath,
					issue: {volume: 1, number: 1, year: 2024},
					orcid: false,
				}),
			);
			expect(publications[0].status).toBe(PUB_STATUS_PUBLISHED);
			const galleyId = publications[0].galleys[0].id;

			const anon = await newAnonContext(browser, baseURL);
			try {
				const reader = await anon.newPage();
				// Single-locale scratch journal → bare URL (no /en/ prefix).
				const article = new ArticlePage(reader, {journalPath});

				// The abstract page is still readable to the public.
				const resp = await article.goto(submission.id);
				expect(resp?.status()).toBe(200);
				await expect(article.title).toContainText(tag);

				// The galley link is drawn `restricted` with subscription-access
				// text. (A restricted link carries an extra screen-reader span, so
				// the exact-label filter would miss it — locate the sole galley.)
				const link = article.galleyList.locator('a.obj_galley_link').first();
				await expect(link).toBeVisible();
				await expect(link).toHaveClass(/restricted/);
				await expect(
					link.locator('.pkp_screen_reader'),
				).toContainText(/subscription/i);

				// Opening the galley view routes the anon reader to login, not the file.
				const view = await anon.request.get(
					`/index.php/${journalPath}/article/view/${submission.id}/${galleyId}`,
					{maxRedirects: 0},
				);
				expect(view.status(), 'gated galley view redirects').toBe(302);
				expect(view.headers()['location']).toContain('login');
			} finally {
				await anon.close();
			}
		},
	);

	// Canonical scenarios 10 + 11 (negative default) — Recommend-by + Crossmark
	// are plugin-gated and OFF by default: neither the recommend-by footer blocks
	// (recommendByAuthor / recommendBySimilarity) nor the Crossmark button
	// (crossref's Crossmark option) appears on a stock published article. Their
	// enabled render is owned by `article-recommendations` / `doi-deposit`; this
	// asserts the default-absent state on the page they would ride on.
	test(
		'recommend-by and Crossmark blocks are absent on a stock published article',
		{tag: '@regression'},
		async ({pkpApi, browser, baseURL}) => {
			const tag = uniqueTag();
			const {submission} = await pkpApi.createSubmission(
				publishedSpec({tag, title: `Default plugins ${tag}`}),
			);

			const anon = await newAnonContext(browser, baseURL);
			try {
				const reader = await anon.newPage();
				const article = new ArticlePage(reader);
				const resp = await article.goto(submission.id, {locale: 'en'});
				expect(resp?.status()).toBe(200);
				await expect(article.title).toContainText(tag);

				// The Crossmark Vue island is not mounted (crossref Crossmark off).
				await expect(article.crossmarkButton).toHaveCount(0);
				// No recommend-by "readers also read" / "similar articles" footer.
				await expect(
					reader.getByText(/other articles by this author/i),
				).toHaveCount(0);
				await expect(
					reader.getByText(/similar articles/i),
				).toHaveCount(0);
			} finally {
				await anon.close();
			}
		},
	);
});
