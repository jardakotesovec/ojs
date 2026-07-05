// @ts-check
const {BasePage} = require('../../lib/pkp/playwright/pages/BasePage.js');

/**
 * Reader-side POM for the public browse-by-category surface: the category
 * landing page (`/{journalPath}/[{locale}/]catalog/category/{path}[/{page}]`,
 * `PKPCatalogHandler::category()` → `templates/frontend/pages/catalogCategory.tpl`)
 * plus the Browse sidebar block (`plugins/blocks/browse` → `block.tpl`) that
 * renders on every themed frontend page (home + the category page itself).
 * OJS-specific (the reader templates are OJS-owned).
 *
 * The whole surface is public + anonymous — this POM never logs in; the caller
 * opens an empty-storageState context (patterns.md "Parallel-load lessons"
 * item 8) and constructs the POM on a page from it.
 *
 * Reader-URL locale rule (patterns.md item 9): publicknowledge takes the `/en/`
 * prefix; single-locale scratch journals serve the BARE path (the `/en/` form
 * 302s back). These tests run on scratch journals, so `locale` defaults to ''
 * (bare) — pass `locale: 'en'` only for publicknowledge.
 *
 * Listing selectors map 1:1 onto catalogCategory.tpl: the `.article_count`
 * ("N Items", `catalog.browseTitles`), the `ul.cmp_article_list.articles`
 * summaries (each an `a#article-{submissionId}` from article_summary.tpl), the
 * `nav.subcategories` links, the `.about_section .cover/.description`, and the
 * `nav.cmp_breadcrumbs_catalog` (Home → parent → current). Block selectors map
 * onto block.tpl: `.pkp_block.block_browse`, the `.category_header` label, the
 * recursive `.categories_list` (nested entries get `is_sub`), and the styled
 * non-clickable `a.current` for the category currently being viewed.
 */
exports.CatalogPage = class CatalogPage extends BasePage {
	/**
	 * @param {import('@playwright/test').Page} page
	 * @param {{journalPath: string, locale?: string}} opts
	 */
	constructor(page, {journalPath, locale = ''} = /** @type {any} */ ({})) {
		super(page);
		this.journalPath = journalPath;
		this.locale = locale;

		// -- Category landing page ------------------------------------------
		this.container = page.locator('.page_catalog_category');
		this.heading = this.container.locator('h1');
		this.itemCount = page.locator('.article_count');
		this.articleList = page.locator('ul.cmp_article_list.articles');
		this.articleItems = page.locator('ul.cmp_article_list.articles > li');
		this.coverLink = page.locator('.about_section .cover');
		this.description = page.locator('.about_section .description');
		this.subcategoryNav = page.locator('nav.subcategories');

		// -- Catalog breadcrumb (Home → parent → current) -------------------
		this.breadcrumb = page.locator('nav.cmp_breadcrumbs_catalog');
		this.breadcrumbCurrent = this.breadcrumb.locator(
			'li.current [aria-current="page"]',
		);

		// -- Browse sidebar block -------------------------------------------
		this.browseBlock = page.locator('.pkp_block.block_browse');
		this.browseBlockTitle = this.browseBlock.locator('h2.title');
		this.browseCategoryHeader = this.browseBlock.locator('.category_header');
		this.browseCategoryList = this.browseBlock.locator('ul.categories_list');
		this.browseBlockLinks = this.browseBlock.locator('nav.content a');
	}

	// -- URL builders -------------------------------------------------------

	/** The category landing-page URL. `page` is the optional page-number arg. */
	categoryUrl(path, {page} = {}) {
		const localeSeg = this.locale ? `/${this.locale}` : '';
		const pageSeg = page ? `/${page}` : '';
		return `/index.php/${this.journalPath}${localeSeg}/catalog/category/${path}${pageSeg}`;
	}

	/** The journal home page (where the Browse block also renders). */
	homeUrl() {
		const localeSeg = this.locale ? `/${this.locale}` : '';
		return `/index.php/${this.journalPath}${localeSeg}/`;
	}

	/**
	 * A cover-image op URL. `op` is 'fullSize' | 'thumbnail'.
	 *
	 * @param {{op: string, type?: string, id: number|string}} opts
	 */
	coverUrl({op, type = 'category', id}) {
		const localeSeg = this.locale ? `/${this.locale}` : '';
		return `/index.php/${this.journalPath}${localeSeg}/catalog/${op}?type=${type}&id=${id}`;
	}

	/** Navigate to a category page; returns the response (assert `.status()`). */
	async gotoCategory(path, opts = {}) {
		return this.page.goto(this.categoryUrl(path, opts));
	}

	/** Navigate to the journal home page (Browse block in the sidebar). */
	async gotoHome() {
		return this.page.goto(this.homeUrl());
	}

	// -- Listing locators ---------------------------------------------------

	/**
	 * An article summary link on the listing, pinned to a submission id
	 * (`a#article-{id}` from article_summary.tpl). Precise + reorder-safe.
	 *
	 * @param {number|string} submissionId
	 */
	articleLink(submissionId) {
		return this.articleList.locator(`a#article-${submissionId}`);
	}

	/** The ordered list of submission ids as rendered in the listing. */
	async listedSubmissionIds() {
		return this.articleList
			.locator('a[id^="article-"]')
			.evaluateAll((els) =>
				els.map((e) => Number(e.id.replace('article-', ''))),
			);
	}

	// -- Nav locators -------------------------------------------------------

	/** A subcategory nav link by category path. */
	subcategoryLink(path) {
		return this.subcategoryNav.locator(`a[href*="category/${path}"]`);
	}

	/** The breadcrumb link back up to a parent category by path. */
	breadcrumbParentLink(path) {
		return this.breadcrumb.locator(`a[href*="category/${path}"]`);
	}

	// -- Browse-block locators ---------------------------------------------

	/** A Browse-block category link by path (any depth). */
	browseBlockLink(path) {
		return this.browseBlock.locator(`a[href*="catalog/category/${path}"]`);
	}

	/** The Browse-block nested list-item for a category id (`is_sub` when a child). */
	browseBlockItem(categoryId) {
		return this.browseBlock.locator(`li.category_${categoryId}`);
	}

	/** The Browse-block entry marked current (styled, non-clickable). */
	get browseBlockCurrent() {
		return this.browseBlock.locator('a.current');
	}
};
