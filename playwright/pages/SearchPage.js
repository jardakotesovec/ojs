// @ts-check
const {BasePage} = require('../../lib/pkp/playwright/pages/BasePage.js');

/**
 * Reader-side POM for the public article search page
 * (`/{journalPath}/[{locale}/]search` + its `/search/search` results op),
 * driven by `templates/frontend/pages/search.tpl`. OJS-specific: the
 * journal-scoped reader URL + locale-prefix rules mirror ArticlePage.
 *
 * The whole surface is a plain `GET` form (query box + advanced-filters
 * fieldset: a published-date range and — only at the SITE level, `journalPath:
 * 'index'` — a journal picker) whose results render server-side as a
 * `ul.search_results` of `article_summary.tpl` rows, each an `h3.title a`
 * linking to the article landing page. An empty result set renders a single
 * "No Results" notice with no pagination.
 *
 * Anonymity is the caller's job: search is public, so tests just drive the
 * default anonymous `page` (no `test.use({user})`); this POM never logs in.
 *
 * Reader-URL locale rule (patterns.md item 9): publicknowledge + the site-wide
 * `/index` search take the `/en/` prefix; single-locale scratch journals take
 * the bare URL. Pass `locale: ''` for a scratch journal.
 */
exports.SearchPage = class SearchPage extends BasePage {
	/**
	 * @param {import('@playwright/test').Page} page
	 * @param {{journalPath?: string, locale?: string}} [opts]
	 *   `journalPath: 'index'` selects the site-wide (cross-journal) search.
	 */
	constructor(page, {journalPath = 'publicknowledge', locale = 'en'} = {}) {
		super(page);
		this.journalPath = journalPath;
		this.locale = locale;

		this.queryInput = page.locator('input#query');
		this.searchButton = page.locator('form.cmp_form button[type="submit"]');

		// Advanced filters.
		this.journalPicker = page.locator('select#searchContext');

		// Results + no-results.
		this.results = page.locator('ul.search_results > li');
		this.resultTitleLinks = page.locator(
			'ul.search_results .obj_article_summary h3.title a',
		);
		this.noResults = page
			.locator('[role="status"]')
			.filter({hasText: 'No Results'});
		this.pagination = page.locator('.cmp_pagination');
	}

	/** The search page URL (the form + advanced filters). */
	pageUrl() {
		const localeSeg = this.locale ? `/${this.locale}` : '';
		return `/index.php/${this.journalPath}${localeSeg}/search`;
	}

	/**
	 * The results URL (the `search/search` op) with the query + filters as GET
	 * params — searches are bookmarkable, so the URL is the honest interface.
	 *
	 * @param {{query?: string, dateFrom?: {year:number|string, month:number|string, day:number|string}, dateTo?: {year:number|string, month:number|string, day:number|string}, searchContext?: number|string}} [params]
	 */
	resultsUrl({query, dateFrom, dateTo, searchContext} = {}) {
		const p = new URLSearchParams();
		if (query != null) p.set('query', query);
		if (dateFrom) {
			p.set('dateFromYear', String(dateFrom.year));
			p.set('dateFromMonth', String(dateFrom.month));
			p.set('dateFromDay', String(dateFrom.day));
		}
		if (dateTo) {
			p.set('dateToYear', String(dateTo.year));
			p.set('dateToMonth', String(dateTo.month));
			p.set('dateToDay', String(dateTo.day));
		}
		if (searchContext != null) p.set('searchContext', String(searchContext));
		const qs = p.toString();
		return `${this.pageUrl()}/search${qs ? `?${qs}` : ''}`;
	}

	/** Open the search page (form + filters, no query yet). */
	async open() {
		return this.page.goto(this.pageUrl());
	}

	/** Navigate straight to a results set by URL params. */
	async gotoResults(params = {}) {
		return this.page.goto(this.resultsUrl(params));
	}

	/**
	 * Type a query into the box and submit the GET form, waiting for the
	 * results navigation (the faithful reader flow).
	 *
	 * @param {string} query
	 */
	async submitQuery(query) {
		await this.queryInput.fill(query);
		await this.searchButton.click();
		await this.page.waitForURL((url) => url.searchParams.has('query'), {
			waitUntil: 'commit',
		});
	}

	/**
	 * The result link for an article whose title contains `text` (a unique
	 * per-test token keeps this unambiguous).
	 *
	 * @param {string|RegExp} text
	 */
	resultByTitle(text) {
		return this.resultTitleLinks.filter({hasText: text});
	}

	/**
	 * The result link pointing at a specific submission id. Anchored with
	 * ends-with so `/article/view/13` never matches `/article/view/130`.
	 *
	 * @param {number|string} submissionId
	 */
	resultForSubmission(submissionId) {
		return this.page.locator(
			`ul.search_results .obj_article_summary h3.title a[href$="/article/view/${submissionId}"]`,
		);
	}

	/**
	 * The ordered list of submission ids in the current results (scraped from
	 * the result links' hrefs) — used to assert insertion (submission-id)
	 * order, i.e. that the DatabaseEngine does NOT relevance-rank.
	 *
	 * @returns {Promise<number[]>}
	 */
	async resultSubmissionIds() {
		const hrefs = await this.resultTitleLinks.evaluateAll((links) =>
			links.map((a) => a.getAttribute('href') || ''),
		);
		return hrefs
			.map((h) => {
				const m = h.match(/\/article\/view\/(\d+)/);
				return m ? Number(m[1]) : null;
			})
			.filter((id) => id != null);
	}
};
