// @ts-check
const {test, expect} = require('../support/fixtures.js');
const {CatalogPage} = require('../pages/CatalogPage.js');

/**
 * Browse by category — the anonymous reader's browse-by-category surface:
 * the Browse sidebar block (a category tree) and the category landing page
 * (`/{journal}/catalog/category/{path}`, PKPCatalogHandler::category →
 * templates/frontend/pages/catalogCategory.tpl). One test per canonical
 * scenario of docs/product/specs/browse-category-section.md (6 named → 6
 * tests; scenario 6 merges the 404 + Sort-by-ignored + orderBy behaviours).
 *
 * It is a read-only, fully public surface — every assertion runs in a fresh
 * ANONYMOUS context (explicit empty storageState; patterns.md "Parallel-load
 * lessons" item 8). This file sets no `test.use({user})`.
 *
 * SEEDING — the article↔category assignment (the spec author's blocker):
 *   The scenario API seeds categories (journal `categories[]`) but had NO
 *   way to assign a PUBLISHED article to a category, so this work added a
 *   `publications[].categories` passthrough (a list of category paths →
 *   Repo::publication()->assignCategoriesToPublication, the same call the
 *   Publication → Issue tab makes) plus, on the journal side, a category-id
 *   echo in the scenario response (cover ops take an `id`) and a category
 *   `sortOption` passthrough (to seed the "Sort by" setting rule 6 ignores).
 *   All three are additive lib/pkp test-infra (committed separately).
 *
 * INDEX DEPENDENCY (spec rule 5): the listing runs through the shared search
 * builder → DatabaseEngine (a JOIN on submissions_fulltext), so an article is
 * listable only once its async UpdateSubmissionSearchJob has run. The test
 * env's end-of-request JobRunner drains it, but non-deterministically under
 * parallel load — so listing assertions RELOAD the category page until the
 * count settles (`pollUntilItems`; each reload's end-of-request runner drains
 * more of the queue). No CLI queue-drain → these stay in the parallel `ojs`
 * project, not the serial one.
 *
 * As-built realities driven live (match the spec):
 *   - Rule 4: NO parent roll-up — a child-only article shows on the child
 *     ("1 Items") but not the parent ("0 Items").
 *   - Rule 6 / ledger row 103: the category's "Sort by" is IGNORED — the list
 *     falls to submission-id order regardless (test 6).
 *   - Rule 6 / ledger row 102 (PostgreSQL): `?orderBy=datePublished` → 500,
 *     `?orderBy=title` → 200 (test 6).
 *   - Rule 8: cover ops serve `type=category` only (200 even with no image;
 *     404 for a missing id; `type=monograph` → 500).
 *
 * Reader-URL locale rule (patterns.md item 9): these run on single-locale
 * scratch journals → BARE urls (CatalogPage defaults `locale: ''`).
 */

const PUB_STATUS_PUBLISHED = 3; // PKPPublication::STATUS_PUBLISHED
const PUB_STATUS_QUEUED = 1; // PKPPublication::STATUS_QUEUED

/** A unique, hyphenless, alphanumeric token (parallel isolation). */
function uniq() {
	const workerLetter = String.fromCharCode(97 + (test.info().parallelIndex % 26));
	let suffix = '';
	while (suffix.length < 6) {
		suffix += Math.random().toString(36).replace(/[^a-z0-9]/g, '');
	}
	return `${workerLetter}${suffix.slice(0, 6)}`;
}

/** A fresh anonymous browser context (explicit empty storage state). */
async function newAnonContext(browser, baseURL) {
	return browser.newContext({baseURL, storageState: {cookies: [], origins: []}});
}

/**
 * The HTTP status of a URL, read from the RESPONSE HEADERS only (never the
 * body). The cover ops for a category with no uploaded image answer 200 but
 * then stream a never-terminating directory "download" (the handler attempts
 * `downloadByPath` on an empty path — spec rule 8), which hangs any body read;
 * `fetch` resolves on headers, so we grab the status and cancel the body.
 */
async function headerStatus(url) {
	const ctrl = new AbortController();
	const timer = setTimeout(() => ctrl.abort(), 10_000);
	try {
		const res = await fetch(url, {signal: ctrl.signal, redirect: 'manual'});
		const status = res.status;
		res.body?.cancel().catch(() => {});
		return status;
	} finally {
		clearTimeout(timer);
	}
}

/**
 * Create a single-locale scratch journal with a category tree, an "ART"
 * section and a published issue to publish into. Returns the journal path +
 * the flat {categoryPath: id} map the scenario response now echoes.
 *
 * @param {object} pkpApi
 * @param {object} opts
 * @param {string} opts.path
 * @param {object[]} opts.categories  journal `categories[]` spec
 * @param {boolean} [opts.browseBlock] enable + sidebar-place the Browse block
 */
async function createBrowseJournal(pkpApi, {path, categories, browseBlock = false}) {
	const spec = {
		tag: path,
		path,
		primaryLocale: 'en',
		supportedLocales: ['en'],
		name: {en: `Browse Cat ${path}`},
		sections: [{abbrev: {en: 'ART'}, title: {en: 'Articles'}}],
		categories,
		issues: [{volume: 1, number: 1, year: 2024, published: true}],
		...(browseBlock
			? {plugins: {browseblockplugin: {enabled: true}}, sidebar: ['browseblockplugin']}
			: {}),
	};
	const res = await pkpApi.createJournal(spec);
	return {path: res.context.path, categoryIds: res.categories ?? {}};
}

/**
 * A VoR-published article on a scratch journal, assigned to one or more
 * categories (by path) through the new `categories` passthrough.
 *
 * @param {object} opts
 * @param {string} opts.tag
 * @param {string} opts.journal
 * @param {string} opts.title
 * @param {string[]} opts.categories  category paths to assign
 * @param {object} [opts.metadata]    extra publication metadata (merged)
 */
function publishedInCategorySpec({tag, journal, title, categories, metadata = {}}) {
	return {
		tag,
		journal,
		submitter: 'atester',
		section: 'ART',
		locale: 'en',
		participants: [{user: 'dbarnes', role: 'editor', canChangeMetadata: true}],
		decisions: [
			{type: 'skipExternalReview', by: 'dbarnes'},
			{type: 'sendToProduction', by: 'dbarnes'},
		],
		publications: [
			{
				versionStage: 'VoR',
				metadata: {title: {en: title}, ...metadata},
				issue: {volume: 1, number: 1, year: 2024},
				categories,
				published: true,
			},
		],
	};
}

/**
 * Reload the category page until its "N Items" count settles at `count` — the
 * async index (rule 5) makes a just-published article listable only once its
 * job runs, and each reload's end-of-request JobRunner drains more of it.
 */
async function pollUntilItems(catalog, path, count) {
	await expect
		.poll(
			async () => {
				await catalog.gotoCategory(path);
				return (await catalog.itemCount.innerText()).replace(/\s+/g, ' ').trim();
			},
			{timeout: 45_000, intervals: [1000, 2000, 3000, 5000]},
		)
		.toContain(`${count} Items`);
}

test.describe('Browse by category (anonymous reader)', () => {
	// Canonical scenario 1 — Reader opens the Browse block and picks a category.
	// A scratch journal whose sidebar includes the (enabled) Browse block shows a
	// Browse panel listing the category tree (root categories with subcategories
	// nested, `is_sub`). The block is CATEGORY-ONLY (rule 1 — its docblock's
	// by-issue/series links are stale; the 3.6 code emits none). Clicking a
	// category navigates to its landing page; on that page the block marks the
	// current category link `current` (styled, non-clickable).
	test(
		'the Browse block renders a category-only tree whose links navigate',
		{tag: ['@smoke', '@regression']},
		async ({pkpApi, browser, baseURL}) => {
			const s = uniq();
			const parentPath = `phys${s}`;
			const childPath = `opt${s}`;
			const siblingPath = `chem${s}`;
			const {path, categoryIds} = await createBrowseJournal(pkpApi, {
				path: `bcb${s}`,
				browseBlock: true,
				categories: [
					{
						path: parentPath,
						title: {en: `Physics ${s}`},
						children: [{path: childPath, title: {en: `Optics ${s}`}}],
					},
					{path: siblingPath, title: {en: `Chemistry ${s}`}},
				],
			});

			const anon = await newAnonContext(browser, baseURL);
			try {
				const reader = await anon.newPage();
				const catalog = new CatalogPage(reader, {journalPath: path});
				await catalog.gotoHome();

				// The block renders with its "Browse" heading + the "Category" submenu.
				await expect(catalog.browseBlock).toBeVisible();
				await expect(catalog.browseBlockTitle).toHaveText('Browse');
				await expect(catalog.browseCategoryHeader).toHaveText('Categories');

				// The tree: both roots + the nested child, each linking to a
				// /catalog/category/{path} landing page.
				await expect(catalog.browseBlockLink(parentPath)).toBeVisible();
				await expect(catalog.browseBlockLink(siblingPath)).toBeVisible();
				await expect(catalog.browseBlockLink(childPath)).toBeVisible();

				// Nesting: the child list-item carries `is_sub`; a root does not.
				await expect(catalog.browseBlockItem(categoryIds[childPath])).toHaveClass(
					/is_sub/,
				);
				await expect(
					catalog.browseBlockItem(categoryIds[parentPath]),
				).not.toHaveClass(/is_sub/);

				// CATEGORY-ONLY (rule 1): every link in the block is a category link —
				// no by-issue / by-author / by-title entries.
				const hrefs = await catalog.browseBlockLinks.evaluateAll((els) =>
					els.map((e) => e.getAttribute('href') || ''),
				);
				expect(hrefs.length).toBeGreaterThan(0);
				for (const href of hrefs) {
					expect(href, `block link ${href} is a category link`).toContain(
						'catalog/category/',
					);
				}

				// Clicking a category link navigates to its landing page…
				await catalog.browseBlockLink(childPath).click();
				await reader.waitForURL(new RegExp(`catalog/category/${childPath}`));
				await expect(catalog.heading).toHaveText(`Optics ${s}`);

				// …and there the block marks that category `current` (rule 1).
				await expect(catalog.browseBlockCurrent).toHaveText(`Optics ${s}`);
			} finally {
				await anon.close();
			}
		},
	);

	// Canonical scenario 2 — Reader browses a category and sees its published
	// articles. The category landing page shows the title, an "N Items" count and
	// a list of the category's published articles as summaries, each linking to
	// its article landing page. Two published articles assigned to the category →
	// "2 Items" with both summaries present.
	test(
		'the category page lists its published articles as summaries',
		{tag: ['@smoke', '@regression']},
		async ({pkpApi, browser, baseURL}) => {
			test.slow(); // two published seeds + the async index poll
			const s = uniq();
			const catPath = `area${s}`;
			const {path} = await createBrowseJournal(pkpApi, {
				path: `bcl${s}`,
				categories: [{path: catPath, title: {en: `Research Area ${s}`}}],
			});

			const {submission: subA} = await pkpApi.createSubmission(
				publishedInCategorySpec({
					tag: `${path}a`,
					journal: path,
					title: `Alpha paper ${s}`,
					categories: [catPath],
				}),
			);
			const {submission: subB, publications: pubsB} = await pkpApi.createSubmission(
				publishedInCategorySpec({
					tag: `${path}b`,
					journal: path,
					title: `Bravo paper ${s}`,
					categories: [catPath],
				}),
			);
			expect(pubsB[0].status).toBe(PUB_STATUS_PUBLISHED);

			const anon = await newAnonContext(browser, baseURL);
			try {
				const reader = await anon.newPage();
				const catalog = new CatalogPage(reader, {journalPath: path});

				// Reload until both articles index in → "2 Items".
				await pollUntilItems(catalog, catPath, 2);

				// The heading is the category title.
				await expect(catalog.heading).toHaveText(`Research Area ${s}`);

				// Both articles are listed, each a link to its article landing page.
				const linkA = catalog.articleLink(subA.id);
				const linkB = catalog.articleLink(subB.id);
				await expect(linkA).toBeVisible();
				await expect(linkB).toBeVisible();
				await expect(linkA).toHaveAttribute('href', /article\/view\//);
				await expect(catalog.articleItems).toHaveCount(2);

				// The summary link reaches the article landing page (boundary smoke).
				await linkA.click();
				await reader.waitForURL(/article\/view\//);
				await expect(reader.locator('h1.page_title')).toContainText(`Alpha paper ${s}`);
			} finally {
				await anon.close();
			}
		},
	);

	// Canonical scenario 3 — Nested categories: subcategory nav, breadcrumb, and
	// no parent roll-up. On a parent category page the reader sees its
	// subcategories as links + a breadcrumb to Home; the child page breadcrumbs
	// back up to the parent. An article assigned ONLY to the child shows on the
	// child ("1 Items") but NOT on the parent ("0 Items") — rule 4, no roll-up.
	test(
		'nested categories: subcategory nav + breadcrumb + no parent roll-up',
		{tag: ['@smoke', '@regression']},
		async ({pkpApi, browser, baseURL}) => {
			test.slow(); // published seed + the async index poll
			const s = uniq();
			const parentPath = `phys${s}`;
			const childPath = `opt${s}`;
			const {path} = await createBrowseJournal(pkpApi, {
				path: `bcn${s}`,
				categories: [
					{
						path: parentPath,
						title: {en: `Physics ${s}`},
						children: [{path: childPath, title: {en: `Optics ${s}`}}],
					},
				],
			});

			const {submission} = await pkpApi.createSubmission(
				publishedInCategorySpec({
					tag: `${path}c`,
					journal: path,
					title: `Child-only paper ${s}`,
					categories: [childPath], // assigned ONLY to the child
				}),
			);

			const anon = await newAnonContext(browser, baseURL);
			try {
				const reader = await anon.newPage();
				const catalog = new CatalogPage(reader, {journalPath: path});

				// Parent page: subcategory nav lists the child; breadcrumb shows the
				// parent as the current crumb + a Home link.
				await catalog.gotoCategory(parentPath);
				await expect(catalog.heading).toHaveText(`Physics ${s}`);
				await expect(catalog.subcategoryLink(childPath)).toBeVisible();
				await expect(catalog.subcategoryLink(childPath)).toHaveText(`Optics ${s}`);
				await expect(catalog.breadcrumbCurrent).toHaveText(`Physics ${s}`);
				await expect(
					catalog.breadcrumb.getByRole('link', {name: 'Home'}),
				).toBeVisible();

				// NO roll-up (rule 4): the child-only article is absent on the parent.
				await expect(catalog.itemCount).toContainText('0 Items');
				await expect(catalog.articleLink(submission.id)).toHaveCount(0);

				// Child page: the article IS listed once indexed ("1 Items")…
				await pollUntilItems(catalog, childPath, 1);
				await expect(catalog.articleLink(submission.id)).toBeVisible();

				// …and its breadcrumb links back UP to the parent.
				await expect(catalog.breadcrumbCurrent).toHaveText(`Optics ${s}`);
				const upLink = catalog.breadcrumbParentLink(parentPath);
				await expect(upLink).toBeVisible();
				await expect(upLink).toHaveText(`Physics ${s}`);
			} finally {
				await anon.close();
			}
		},
	);

	// Canonical scenario 4 — Only published, indexed articles appear. A published
	// article assigned to the category is listed; an unpublished (submitted,
	// never published) submission assigned to the SAME category is not — the
	// published-only gate (rule 5). The count reflects only the published one.
	test(
		'an unpublished article assigned to the category is not listed',
		{tag: '@regression'},
		async ({pkpApi, browser, baseURL}) => {
			test.slow(); // published seed + the async index poll
			const s = uniq();
			const catPath = `pub${s}`;
			const {path} = await createBrowseJournal(pkpApi, {
				path: `bcp${s}`,
				categories: [{path: catPath, title: {en: `Published-only ${s}`}}],
			});

			const {submission: published} = await pkpApi.createSubmission(
				publishedInCategorySpec({
					tag: `${path}p`,
					journal: path,
					title: `Live paper ${s}`,
					categories: [catPath],
				}),
			);

			// A submitted-but-unpublished submission assigned to the same category.
			const {submission: draft, publications: draftPubs} = await pkpApi.createSubmission({
				tag: `${path}d`,
				journal: path,
				submitter: 'atester',
				section: 'ART',
				locale: 'en',
				submitted: true,
				participants: [{user: 'dbarnes', role: 'editor'}],
				publications: [{metadata: {title: {en: `Hidden draft ${s}`}}, categories: [catPath]}],
			});
			expect(draftPubs[0].status).toBe(PUB_STATUS_QUEUED);

			const anon = await newAnonContext(browser, baseURL);
			try {
				const reader = await anon.newPage();
				const catalog = new CatalogPage(reader, {journalPath: path});

				// The published article is listed; the count is exactly 1.
				await pollUntilItems(catalog, catPath, 1);
				await expect(catalog.articleLink(published.id)).toBeVisible();

				// The unpublished submission is absent (never indexed + the query's
				// published gate would drop it anyway).
				await expect(catalog.articleLink(draft.id)).toHaveCount(0);
				await expect(reader.getByText(`Hidden draft ${s}`)).toHaveCount(0);
			} finally {
				await anon.close();
			}
		},
	);

	// Canonical scenario 5 — Category cover images. A populated cover was not
	// seedable via the scenario API, so this drives the cover OPS (rule 8): for a
	// real category id `fullSize`/`thumbnail` with `type=category` respond 200
	// (even with no image uploaded); a missing id → 404; an invalid `type` (the
	// OMP-only `monograph`) → 500. The category page itself renders no cover
	// element when no image is set.
	test(
		'category cover ops respond for type=category (200/404/500)',
		{tag: '@regression'},
		async ({pkpApi, browser, baseURL}) => {
			const s = uniq();
			const catPath = `cover${s}`;
			const {path, categoryIds} = await createBrowseJournal(pkpApi, {
				path: `bcc${s}`,
				categories: [{path: catPath, title: {en: `Cover Cat ${s}`}}],
			});
			const catId = categoryIds[catPath];
			expect(catId, 'category id echoed by the scenario response').toBeTruthy();

			const anon = await newAnonContext(browser, baseURL);
			try {
				const reader = await anon.newPage();
				const catalog = new CatalogPage(reader, {journalPath: path});
				const coverUrl = (opts) => baseURL + catalog.coverUrl(opts);

				// A real category (no image) still answers 200 for both cover ops
				// (status read from headers — the empty-path download never ends).
				expect(
					await headerStatus(coverUrl({op: 'fullSize', id: catId})),
					'fullSize type=category → 200',
				).toBe(200);
				expect(
					await headerStatus(coverUrl({op: 'thumbnail', id: catId})),
					'thumbnail type=category → 200',
				).toBe(200);

				// A non-existent category id → 404 (existence/ownership check).
				expect(
					await headerStatus(coverUrl({op: 'fullSize', id: 99999999})),
					'fullSize missing id → 404',
				).toBe(404);

				// An invalid type (OMP-only `monograph`) → 500.
				expect(
					await headerStatus(coverUrl({op: 'fullSize', type: 'monograph', id: catId})),
					'type=monograph → 500',
				).toBe(500);

				// The category page renders no cover element (no image seeded).
				await catalog.gotoCategory(catPath);
				await expect(catalog.heading).toHaveText(`Cover Cat ${s}`);
				await expect(catalog.coverLink).toHaveCount(0);
			} finally {
				await anon.close();
			}
		},
	);

	// Canonical scenario 6 — A missing category 404s; the "Sort by" setting has no
	// effect. Requesting an unknown path → 404 (rule 3). A category whose "Sort
	// by" is set to title-ASC still lists its articles in SUBMISSION-ID order —
	// the reader ignores both the configured sort AND the default date-desc
	// (rule 6 / ledger row 103). And on PostgreSQL `?orderBy=datePublished` → 500
	// while `?orderBy=title` → 200 (ledger row 102).
	test(
		'missing category 404s; Sort-by is ignored (row 103); orderBy=datePublished 500s (row 102)',
		{tag: '@regression'},
		async ({pkpApi, browser, baseURL}) => {
			test.slow(); // two published seeds + the async index poll
			const s = uniq();
			const catPath = `sort${s}`;
			const {path} = await createBrowseJournal(pkpApi, {
				path: `bcs${s}`,
				// Seed the "Sort by" setting the reader page is meant to honour.
				categories: [
					{path: catPath, title: {en: `Sorted ${s}`}, sortOption: 'title-ASC'},
				],
			});

			// A: seeded FIRST (lower submission id), title "Zzz", EARLIER date.
			const {submission: subA} = await pkpApi.createSubmission(
				publishedInCategorySpec({
					tag: `${path}a`,
					journal: path,
					title: `Zzz first ${s}`,
					categories: [catPath],
					metadata: {datePublished: '2024-01-01'},
				}),
			);
			// B: seeded SECOND (higher submission id), title "Aaa", LATER date.
			const {submission: subB} = await pkpApi.createSubmission(
				publishedInCategorySpec({
					tag: `${path}b`,
					journal: path,
					title: `Aaa second ${s}`,
					categories: [catPath],
					metadata: {datePublished: '2024-12-01'},
				}),
			);
			expect(subB.id).toBeGreaterThan(subA.id);

			const anon = await newAnonContext(browser, baseURL);
			try {
				const reader = await anon.newPage();
				const catalog = new CatalogPage(reader, {journalPath: path});

				// Missing category → 404 (rule 3).
				const missing = await anon.request.get(
					catalog.categoryUrl(`doesnotexist${s}`),
				);
				expect(missing.status(), 'unknown category path → 404').toBe(404);

				// Sort-by IGNORED (row 103): with sortOption=title-ASC, a title sort
				// would put "Aaa" (B) first and a date-desc sort would put B (later)
				// first — but the reader lists them in submission-id order, so A
				// (lower id, "Zzz", earlier date) comes FIRST.
				await pollUntilItems(catalog, catPath, 2);
				const ids = await catalog.listedSubmissionIds();
				expect(ids).toEqual([subA.id, subB.id]);
				expect(
					ids.indexOf(subA.id),
					'submission-id order, not the configured title/date sort',
				).toBeLessThan(ids.indexOf(subB.id));

				// orderBy inheritance (row 102, PostgreSQL): datePublished → 500,
				// title → 200.
				const byDate = await anon.request.get(
					catalog.categoryUrl(catPath) + '?orderBy=datePublished',
				);
				expect(byDate.status(), 'orderBy=datePublished → 500 (row 102)').toBe(500);
				const byTitle = await anon.request.get(
					catalog.categoryUrl(catPath) + '?orderBy=title',
				);
				expect(byTitle.status(), 'orderBy=title → 200').toBe(200);
			} finally {
				await anon.close();
			}
		},
	);
});
