// @ts-check
const {test, expect} = require('../support/fixtures.js');
const submissionPublished = require('../fixtures/scenarios/submission-published.js');
const submissionInReview = require('../fixtures/scenarios/submission-in-review.js');

/**
 * Site search — docs/e2e/plans/site-search.md rows 1–6.
 *
 * Every assertion runs as an ANONYMOUS reader (explicit empty
 * storageState — patterns.md "Parallel-load lessons" item 8) against
 * per-test seeded content.
 *
 * Indexing model (code-verified, see the plan's scenario notes):
 * publish fires PublicationPublished → UpdateSubmissionInSearchIndex →
 * DatabaseEngine::update() → UpdateSubmissionSearchJob queued on the DB
 * queue, which the end-of-request job runner executes — so the
 * `submissions_fulltext` row lags the scenario POST by ≤1 web request.
 * Tests therefore POLL by re-submitting the query (each poll iteration
 * is itself a web request that drives the job runner) until the seeded
 * record appears, and only THEN make negative assertions.
 *
 * Tokenizer constraints: search tokens are unique pure-alphanumeric
 * strings (≥4 chars, NO hyphens) embedded in seeded titles — hyphenated
 * tags get split by the fulltext tokenizer (MySQL FULLTEXT and Postgres
 * tsvector alike), so the [tag] suffix is never used as a query.
 *
 * Search surface map (grep-verified):
 *   - lib/pkp/pages/search/SearchHandler.php — journal + site-level
 *     ops; site level (`/index/search`) assigns `searchableContexts`
 *     which renders the `#searchContext` dropdown (search.tpl:68-80).
 *   - PKP\search\SubmissionSearchResult::builderFromRequest reads
 *     `query`, `dateFrom*`/`dateTo*` (via getUserDateVar — year+month+
 *     day must ALL be supplied or the filter is dropped, see
 *     PKPRequest.php:664-668) and `searchContext` (only effective when
 *     no journal context).
 *   - DatabaseEngine::buildQuery FROMs `submissions_fulltext`, matches
 *     whereFullText([title, abstract, body, authors]) — author names
 *     are searched through the same single `query` field (the default
 *     theme exposes no separate authors input) — and brackets dates
 *     with `whereDate(date_published) >= dateFrom` / `< dateTo`.
 *   - Results render article_summary.tpl rows inside ul.search_results;
 *     zero results render the `search.noResults` notice ("No Results")
 *     via frontend/components/notification.tpl (.cmp_notification.notice).
 */

test.describe('Site search', () => {
	// Row 1 — title-word search finds the seeded article.
	test(
		'search by title word finds the published article and links to its landing page',
		{tag: '@smoke'},
		async ({pkpApi, browser, baseURL}) => {
			const tag = scratchTag('ss1');
			const token = searchToken();
			const spec = submissionPublished({tag});
			spec.publications[0].metadata.title = {en: `Search target ${token}`};
			const {submission} = await pkpApi.createSubmission(spec);
			const listedTitle = `Search target ${token} [${tag}]`;

			const anon = await anonContext(browser, baseURL);
			try {
				const page = await anon.newPage();

				// Poll the query URL until the index job has run (each
				// attempt is a web request that drives the job runner).
				await pollUntilListed(page, searchUrl('publicknowledge', {query: token}), listedTitle);

				// Now drive the actual search form once, end-to-end: the
				// result is deterministic because the index has settled.
				await page.goto('/index.php/publicknowledge/search');
				await page.locator('input#query').fill(token);
				await searchSubmit(page).click();

				const row = resultRow(page, listedTitle);
				await expect(row).toHaveCount(1);
				// Author column (rvaca is the fixture's submitter/author).
				await expect(row.locator('.authors')).toContainText('Ramiro Vaca');

				// Click-through to the article landing page.
				await row.locator('.title a').click();
				await page.waitForURL(new RegExp(`/article/view/${submission.id}$`), {
					waitUntil: 'commit',
				});
				await expect(page.locator('h1.page_title')).toContainText(listedTitle);
			} finally {
				await anon.close();
			}
		},
	);

	// Row 2 — author family-name search. The family name itself must be
	// unique: the `authors` fulltext column matches the bare query, and
	// a shared name like "Vaca" hits every fixture-seeded submission on
	// the long-lived DB (probe-verified). A scratch journal plus a
	// scenario-created author user with a unique family name keeps the
	// assertion scoped without losing the behavior under test.
	test(
		'search by author family name finds the published article',
		{tag: '@regression'},
		async ({pkpApi, browser, baseURL}) => {
			const tag = scratchTag('ss2');
			const familyName = `Fam${randomToken()}`;
			const username = `au${randomToken()}`;
			const issueRef = {volume: 1, number: 1, year: 2026};

			const {context} = await pkpApi.createJournal({
				tag,
				users: [
					{username: 'dbarnes', roles: ['manager', 'editor']},
					{
						username,
						// Password marks the user for creation (scenario
						// processors refuse to mint users without one). The
						// test never logs in as this user.
						password: 'searchTest123',
						givenName: 'Avery',
						familyName,
						roles: ['author'],
					},
				],
				issues: [{...issueRef, published: true}],
			});

			const spec = submissionPublished({
				tag,
				journal: context.path,
				submitter: username,
				issue: issueRef,
			});
			await pkpApi.createSubmission(spec);
			const listedTitle = `Published article [${tag}]`;

			const anon = await anonContext(browser, baseURL);
			try {
				const page = await anon.newPage();
				await pollUntilListed(page, searchUrl(context.path, {query: familyName}), listedTitle);

				const row = resultRow(page, listedTitle);
				await expect(row).toHaveCount(1);
				await expect(row.locator('.authors')).toContainText(`Avery ${familyName}`);
			} finally {
				await anon.close();
			}
		},
	);

	// Row 3 — gibberish query renders the no-results notice.
	test(
		'no-results query shows the empty-result notice',
		{tag: '@regression'},
		async ({browser, baseURL}) => {
			const gibberish = `zzqx${randomToken()}`;

			const anon = await anonContext(browser, baseURL);
			try {
				const page = await anon.newPage();
				await page.goto('/index.php/publicknowledge/search');
				await page.locator('input#query').fill(gibberish);
				await searchSubmit(page).click();

				await expect(noResultsNotice(page)).toBeVisible();
				await expect(
					page.locator('ul.search_results .obj_article_summary'),
				).toHaveCount(0);
			} finally {
				await anon.close();
			}
		},
	);

	// Row 4 — publication-date range filter includes and excludes.
	// The seed pins datePublished (survives `published: true` per the
	// scenario contract) so the brackets are deterministic; URL-driven
	// queries are used because the form's year <select> is bounded by
	// the journal's min/max published years (Repo::publication()->
	// getDateBoundaries), which other parallel seeds shift — the GET
	// form's public surface IS its URL params. getUserDateVar drops the
	// filter unless year+month+day are all present, so all three are
	// always passed.
	test(
		'publication-date range filter includes and excludes results',
		{tag: '@regression'},
		async ({pkpApi, browser, baseURL}) => {
			const tag = scratchTag('ss4');
			const token = searchToken();
			const spec = submissionPublished({tag});
			spec.publications[0].metadata.title = {en: `Dated target ${token}`};
			spec.publications[0].metadata.datePublished = '2024-05-10';
			await pkpApi.createSubmission(spec);
			const listedTitle = `Dated target ${token} [${tag}]`;

			const anon = await anonContext(browser, baseURL);
			try {
				const page = await anon.newPage();

				// Wide range (2020 → 2031) — poll until indexed; this is
				// simultaneously the "wide range includes" assertion and
				// the positive control bounding the excludes below.
				await pollUntilListed(
					page,
					searchUrl('publicknowledge', {
						query: token,
						dateFromYear: 2020, dateFromMonth: 1, dateFromDay: 1,
						dateToYear: 2031, dateToMonth: 12, dateToDay: 31,
					}),
					listedTitle,
				);

				// Tight range bracketing the pinned datePublished still
				// includes — proves the filter brackets the publication
				// date rather than passing everything through.
				await page.goto(
					searchUrl('publicknowledge', {
						query: token,
						dateFromYear: 2024, dateFromMonth: 1, dateFromDay: 1,
						dateToYear: 2024, dateToMonth: 12, dateToDay: 31,
					}),
				);
				await expect(resultRow(page, listedTitle)).toHaveCount(1);

				// Future dateFrom excludes (whereDate >= 2031-01-01).
				await page.goto(
					searchUrl('publicknowledge', {
						query: token,
						dateFromYear: 2031, dateFromMonth: 1, dateFromDay: 1,
					}),
				);
				await expect(noResultsNotice(page)).toBeVisible();
				await expect(resultRow(page, listedTitle)).toHaveCount(0);

				// Past dateTo excludes too (whereDate < 2023-12-31).
				await page.goto(
					searchUrl('publicknowledge', {
						query: token,
						dateToYear: 2023, dateToMonth: 12, dateToDay: 31,
					}),
				);
				await expect(noResultsNotice(page)).toBeVisible();
				await expect(resultRow(page, listedTitle)).toHaveCount(0);
			} finally {
				await anon.close();
			}
		},
	);

	// Row 5 — unpublished submissions are not searchable. The negative
	// is bounded by a positive control seeded AFTER the in-review
	// submission: once the control is findable, the index pipeline has
	// processed everything queued before it — the in-review token's
	// absence is then meaningful, not an unindexed-yet artifact. (An
	// in-review submission never dispatches UpdateSubmissionSearchJob —
	// only PublicationPublished does — and DatabaseEngine additionally
	// joins on STATUS_PUBLISHED publications.)
	test(
		'unpublished submission is not searchable',
		{tag: '@regression'},
		async ({pkpApi, browser, baseURL}) => {
			const reviewTag = scratchTag('ss5r');
			const reviewToken = searchToken();
			const reviewSpec = submissionInReview({tag: reviewTag, reviewers: []});
			reviewSpec.publications[0].metadata.title = {
				en: `Unsearchable draft ${reviewToken}`,
			};
			await pkpApi.createSubmission(reviewSpec);

			const controlTag = scratchTag('ss5c');
			const controlToken = searchToken();
			const controlSpec = submissionPublished({tag: controlTag});
			controlSpec.publications[0].metadata.title = {
				en: `Search control ${controlToken}`,
			};
			await pkpApi.createSubmission(controlSpec);

			const anon = await anonContext(browser, baseURL);
			try {
				const page = await anon.newPage();

				// Positive control bounds the wait.
				await pollUntilListed(
					page,
					searchUrl('publicknowledge', {query: controlToken}),
					`Search control ${controlToken} [${controlTag}]`,
				);

				// The unpublished token finds nothing.
				await page.goto(searchUrl('publicknowledge', {query: reviewToken}));
				await expect(noResultsNotice(page)).toBeVisible();
				await expect(
					page.locator('ul.search_results .obj_article_summary'),
				).toHaveCount(0);
			} finally {
				await anon.close();
			}
		},
	);

	// Row 6 — site-wide search spans journals; the searchContext
	// dropdown narrows to one. Both seeds share the SAME token so one
	// query returns hits from both journals; the titles differ so each
	// row is attributable. At site level article_summary renders the
	// owning journal's name as the row's span.subtitle (no
	// $currentContext branch).
	test(
		'site-wide search spans journals and the context filter narrows it',
		{tag: '@regression'},
		async ({pkpApi, browser, baseURL}) => {
			const tag = scratchTag('ss6');
			const token = searchToken();
			const issueRef = {volume: 2, number: 1, year: 2026};
			const journalName = `Search Span ${tag}`;

			const {context} = await pkpApi.createJournal({
				tag,
				name: {en: journalName},
				users: [{username: 'dbarnes', roles: ['manager', 'editor']}],
				issues: [{...issueRef, published: true}],
			});

			const scratchSpec = submissionPublished({
				tag,
				journal: context.path,
				issue: issueRef,
			});
			scratchSpec.publications[0].metadata.title = {
				en: `Crossjournal alpha ${token}`,
			};
			await pkpApi.createSubmission(scratchSpec);

			const pkSpec = submissionPublished({tag});
			pkSpec.publications[0].metadata.title = {
				en: `Crossjournal beta ${token}`,
			};
			await pkpApi.createSubmission(pkSpec);

			const alphaTitle = `Crossjournal alpha ${token}`;
			const betaTitle = `Crossjournal beta ${token}`;
			const siteSearchUrl = searchUrl('index', {query: token});

			const anon = await anonContext(browser, baseURL);
			try {
				const page = await anon.newPage();

				// Poll until BOTH journals' hits are indexed.
				await expect
					.poll(
						async () => {
							await page.goto(siteSearchUrl);
							const alpha = await resultRow(page, alphaTitle).count();
							const beta = await resultRow(page, betaTitle).count();
							return alpha + beta;
						},
						{
							message: `site search never returned both seeded articles for "${token}"`,
							timeout: 30_000,
						},
					)
					.toBe(2);

				// Each row is attributed to its journal (subtitle span).
				await expect(resultRow(page, alphaTitle)).toContainText(journalName);
				await expect(resultRow(page, betaTitle)).toContainText(
					'Journal of Public Knowledge',
				);

				// Narrow to the scratch journal via the searchContext
				// dropdown (only rendered at site level) and re-submit.
				await page
					.locator('select#searchContext')
					.selectOption(String(context.id));
				await searchSubmit(page).click();

				await expect(resultRow(page, alphaTitle)).toHaveCount(1);
				await expect(resultRow(page, betaTitle)).toHaveCount(0);
			} finally {
				await anon.close();
			}
		},
	);
});

/**
 * A search-result row (article summary inside ul.search_results)
 * matched by its listed title.
 *
 * @param {import('@playwright/test').Page} page
 * @param {string} title
 */
function resultRow(page, title) {
	return page
		.locator('ul.search_results .obj_article_summary')
		.filter({hasText: title});
}

/**
 * The `search.noResults` notice ("No Results") rendered when the result
 * count is zero (search.tpl:116-119 via notification.tpl).
 *
 * @param {import('@playwright/test').Page} page
 */
function noResultsNotice(page) {
	return page.locator('.cmp_notification.notice', {hasText: 'No Results'});
}

/**
 * The search form's submit button. The default theme decorates it with
 * a CSS pseudo-element icon glyph that leaks into the computed
 * accessible name ("Search " + glyph), so an `exact: true` role match
 * finds nothing — substring matching scoped to the form is the stable
 * form (aria-snapshot-verified).
 *
 * @param {import('@playwright/test').Page} page
 */
function searchSubmit(page) {
	return page
		.locator('form.cmp_form')
		.getByRole('button', {name: 'Search'});
}

/**
 * Build a search URL. Pass `'index'` as journalPath for the site-wide
 * search. Bare (locale-less) URLs are used throughout — page.goto
 * follows the locale 302 transparently (patterns.md item 9) and
 * single-locale scratch journals don't prefix at all.
 *
 * @param {string} journalPath
 * @param {Record<string, string|number>} params
 */
function searchUrl(journalPath, params) {
	const qs = new URLSearchParams(
		Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])),
	).toString();
	return `/index.php/${journalPath}/search?${qs}`;
}

/**
 * Re-submit the query URL until the row with the given title appears —
 * the canonical poll-until-indexed loop (each goto is a web request
 * that drives the end-of-request job runner forward).
 *
 * @param {import('@playwright/test').Page} page
 * @param {string} url
 * @param {string} title
 */
async function pollUntilListed(page, url, title) {
	await expect
		.poll(
			async () => {
				await page.goto(url);
				return await resultRow(page, title).count();
			},
			{
				message: `search index never picked up "${title}" at ${url}`,
				timeout: 30_000,
			},
		)
		.toBeGreaterThan(0);
}

/**
 * Pure-alphanumeric unique token for fulltext queries: no hyphens (the
 * tokenizer splits them), ≥4 chars, per-run random (patterns.md rule 10).
 */
function searchToken() {
	return `tok${randomToken()}`;
}

/** 8 random base-36 chars. */
function randomToken() {
	return Math.random().toString(36).slice(2, 10);
}

/**
 * Worker-scoped unique tag with a per-run random component
 * (patterns.md tag conventions; journals.path is varchar(32) and the
 * journal scenario derives `j-<alnum(tag)>`).
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
 * (patterns.md rule 8) so reader checks can never ride a logged-in
 * session's preview privileges.
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
