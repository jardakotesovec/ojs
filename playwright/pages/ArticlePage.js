// @ts-check
const {BasePage} = require('../../lib/pkp/playwright/pages/BasePage.js');

/**
 * Reader-side POM for the public article landing page
 * (`/{journalPath}/[{locale}/]article/view/{idOrUrlPath}[/version/{publicationId}]`).
 * OJS-specific (galleys, issues, DOIs are journal concepts).
 *
 * Wave 7 — created for docs/e2e/plans/article-landing.md; wave 6's
 * galley specs wished for this POM. All locators map 1:1 onto the
 * default theme's templates/frontend/objects/article_details.tpl
 * markup (the flexible `.item` layout pattern documented in that
 * template's header).
 *
 * Anonymity is the caller's job: reader tests must open their own
 * browser context with an explicit empty storageState
 * (`{cookies: [], origins: []}`) — see patterns.md "Parallel-load
 * lessons" item 8 — and then construct this POM on a page from that
 * context. The POM never logs in or out.
 */
exports.ArticlePage = class ArticlePage extends BasePage {
	/**
	 * @param {import('@playwright/test').Page} page
	 * @param {{journalPath?: string}} [opts]
	 */
	constructor(page, {journalPath = 'publicknowledge'} = {}) {
		super(page);
		this.journalPath = journalPath;

		// -- Headline block -------------------------------------------------
		this.title = page.locator('h1.page_title');
		this.subtitle = page.locator('h2.subtitle');

		// -- Main entry column ----------------------------------------------
		// `.authors` also names the author-bios list; scope to the authors
		// section ("item authors") to keep the locator unambiguous.
		this.authorNames = page.locator(
			'section.item.authors ul.authors li .name',
		);
		this.doiSection = page.locator('section.item.doi');
		this.doiLink = page.locator('section.item.doi .value a');
		this.keywords = page.locator('section.item.keywords .value');

		// -- Entry details column ---------------------------------------------
		// Primary galleys only — the JATS representation renders its own
		// `a.obj_galley_link.xml` OUTSIDE ul.galleys_links (`.item.jats`).
		this.galleyList = page.locator('ul.galleys_links');
		this.versionsSection = page.locator('section.versions');
		this.versionEntries = page.locator('section.versions ul.value > li');
		this.versionLinks = page.locator('section.versions ul.value a');
		this.issueLink = page.locator('.item.issue a.title');
		this.sectionName = page
			.locator('.item.issue section.sub_item')
			.filter({has: page.getByRole('heading', {name: 'Section', exact: true})})
			.locator('.value');
		this.licenseBlock = page.locator('.item.copyright');
		// Data Availability Statement section (article_details.tpl renders it
		// whenever the publication carries a `dataAvailability` value; there is
		// NO data-citation counterpart — data citations have no reader display).
		this.dataAvailabilitySection = page.locator(
			'section.item.dataAvailability#data-availability-statement',
		);

		// -- Plugin-injected reader blocks ----------------------------------
		// How-to-cite block: the citationStyleLanguage plugin's server-rendered
		// Blade `citation-block`, injected at the Templates::Article::Details
		// hook (a `<div class="item citation">`). Present only when the plugin
		// is enabled for the journal (publicknowledge enables it in bootstrap).
		this.citationBlock = page.locator('.item.citation');
		this.citationOutput = page.locator('.item.citation #citationOutput');
		// Author ORCID links — raw template markup (`$author->getData('orcid')`),
		// NOT the PkpOrcidDisplay Vue component (as-built note in the spec).
		this.orcidLinks = page.locator(
			'section.item.authors ul.authors li .orcid a',
		);
		// Crossmark button Vue island (crossref plugin, Crossmark option) — off
		// by default, so absent on a stock journal.
		this.crossmarkButton = page.locator('pkp-crossmark-button');
	}

	/**
	 * A citation-export download link inside the how-to-cite block, matched by
	 * its export op (`citationstylelanguage/download/{format}`), e.g. 'bibtex'
	 * or 'ris'.
	 *
	 * @param {string} format
	 */
	citationDownloadLink(format) {
		return this.citationBlock.locator(
			`a[href*="citationstylelanguage/download/${format}"]`,
		);
	}

	/**
	 * Build the landing-page URL. `locale` is optional — the bare URL
	 * 302s onto the locale-prefixed form (patterns.md item 9), which
	 * page.goto follows transparently; pass it explicitly when the test
	 * asserts per-locale rendering or probes with maxRedirects: 0.
	 *
	 * @param {number|string} idOrUrlPath  submission id or publication urlPath
	 * @param {{locale?: string, version?: number}} [opts]
	 */
	url(idOrUrlPath, {locale, version} = {}) {
		const localeSegment = locale ? `/${locale}` : '';
		const versionSegment = version ? `/version/${version}` : '';
		return `/index.php/${this.journalPath}${localeSegment}/article/view/${idOrUrlPath}${versionSegment}`;
	}

	/**
	 * Navigate to the landing page and return the response (callers
	 * assert on `resp?.status()`).
	 *
	 * @param {number|string} idOrUrlPath
	 * @param {{locale?: string, version?: number}} [opts]
	 */
	async goto(idOrUrlPath, opts = {}) {
		return await this.page.goto(this.url(idOrUrlPath, opts));
	}

	/**
	 * The download URL for a galley, locale-prefixed so that
	 * `request.get(..., {maxRedirects: 0})` probes see the 200 instead
	 * of the locale 302 (patterns.md item 9).
	 *
	 * @param {number|string} idOrUrlPath
	 * @param {number|string} galleyIdOrUrlPath
	 * @param {string} [locale='en']
	 */
	downloadUrl(idOrUrlPath, galleyIdOrUrlPath, locale = 'en') {
		return `/index.php/${this.journalPath}/${locale}/article/download/${idOrUrlPath}/${galleyIdOrUrlPath}`;
	}

	/**
	 * A primary-galley link matched by its EXACT label (substring
	 * filters would conflate "PDF" with "V2PDF" — same rationale as
	 * galleys.spec.js#readerGalleyLink).
	 *
	 * @param {string} label
	 */
	galleyLink(label) {
		const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
		return this.galleyList
			.locator('a.obj_galley_link')
			.filter({hasText: new RegExp(`^\\s*${escaped}\\s*$`)});
	}

	/**
	 * An abstract-pattern section (`section.item.abstract`) selected by
	 * its heading. The plain-language summary reuses the same classes as
	 * the abstract — only the label distinguishes them.
	 *
	 * @param {string} [heading='Abstract']  pass the localized label on
	 *   non-English pages ('Résumé'), or 'Plain Language Summary'.
	 */
	abstractSection(heading = 'Abstract') {
		return this.page
			.locator('section.item.abstract')
			.filter({
				has: this.page.getByRole('heading', {name: heading, exact: true}),
			});
	}
};
