// @ts-check
const {expect} = require('@playwright/test');
const {BasePage} = require('../../lib/pkp/playwright/pages/BasePage.js');

/**
 * Component POM for the Citation Style Language plugin's "How to Cite"
 * block on the public article landing page. OJS-specific spelling of a
 * plugin surface (the block hooks Templates::Article::Details), owned
 * by docs/e2e/plans/citation-style-language.md.
 *
 * Markup map (live-verified against
 * plugins/generic/citationStyleLanguage/templates/citation-block.blade):
 *   - wrapper `div.item.citation` > `section.sub_item.citation_display`
 *     with an h2.label "How to Cite";
 *   - `#citationOutput` holds the rendered primary citation (server-
 *     rendered on load, replaced client-side on style switch by
 *     js/articleCitation.js via fetch of the link's data-json-href);
 *   - the "More Citation Formats" `button.citation_formats_button`
 *     toggles `#cslCitationFormats` via aria-hidden — the plugin CSS
 *     hides `[aria-hidden="true"]`, so links inside are unclickable
 *     until expanded;
 *   - style links carry `data-load-citation` (JS-intercepted); download
 *     links don't (normal browser download of the handler's
 *     `op=download` response, Content-Disposition: attachment).
 *
 * URL shape note: the CSL handler is a PAGE handler
 * (`/{journal}/[{locale}/]citationstylelanguage/{get|download}/{styleId}
 * ?submissionId=&publicationId=&issueId=[&return=json]`) — the
 * kebab-case component-router rule (patterns.md item 11) does NOT apply;
 * ops appear verbatim in the path.
 *
 * Anonymity is the caller's job (same contract as ArticlePage): build
 * this POM on a page from an explicit empty-storageState context.
 */
exports.CitationBlock = class CitationBlock extends BasePage {
	/** @param {import('@playwright/test').Page} page */
	constructor(page) {
		super(page);
		this.block = page.locator('.item.citation');
		this.heading = this.block.locator('h2.label', {hasText: 'How to Cite'});
		this.output = page.locator('#citationOutput');
		// The DOI (when assigned) renders inside the citation as a
		// resolving link — additionalMarkup in
		// CitationStyleLanguagePlugin::getCitation wraps it in an <a>.
		this.outputDoiLink = this.output.locator('a[href^="https://doi.org/"]');
		this.moreFormatsButton = this.block.locator(
			'button.citation_formats_button',
		);
		this.formatsList = page.locator('#cslCitationFormats');
		this.styleLinks = this.formatsList.locator('a[data-load-citation]');
		this.downloadLinks = this.formatsList.locator(
			'a:not([data-load-citation])',
		);
	}

	/**
	 * A citation-format link by its EXACT visible title ('APA',
	 * 'Vancouver', …). Exact: 'ACM' must not match inside other labels.
	 *
	 * @param {string} title
	 */
	styleLink(title) {
		return this.formatsList.getByRole('link', {name: title, exact: true});
	}

	/**
	 * A download link by visible title — 'BibTeX' or
	 * 'Endnote/Zotero/Mendeley (RIS)'. Substring match: the RIS label
	 * is long and carries a fa-download icon span.
	 *
	 * @param {string} title
	 */
	downloadLink(title) {
		return this.formatsList.getByRole('link', {name: title});
	}

	/**
	 * Expand the "More Citation Formats" dropdown if collapsed. The
	 * toggle is pure JS (articleCitation.js flips aria-expanded /
	 * aria-hidden); by the time page.goto resolves ('load') the
	 * DOMContentLoaded handler has attached, so a single click sticks.
	 */
	async expandFormats() {
		if ((await this.moreFormatsButton.getAttribute('aria-expanded')) !== 'true') {
			await this.moreFormatsButton.click();
		}
		await expect(this.formatsList).toBeVisible();
	}

	/**
	 * Pick another citation format from the dropdown and wait for the
	 * CSL page handler's `get` op (return=json) to land — that response
	 * is what articleCitation.js writes into #citationOutput.
	 *
	 * @param {string} styleId  e.g. 'vancouver'
	 * @param {string} title    visible link label, e.g. 'Vancouver'
	 */
	async switchToStyle(styleId, title) {
		await this.expandFormats();
		const responsePromise = this.page.waitForResponse(
			(res) =>
				res.url().includes(`/citationstylelanguage/get/${styleId}`) &&
				res.url().includes('return=json') &&
				res.ok(),
			{timeout: 20_000},
		);
		await this.styleLink(title).click();
		await responsePromise;
	}
};
