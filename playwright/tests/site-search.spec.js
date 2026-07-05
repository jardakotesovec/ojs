// @ts-check
const {test, expect} = require('../support/fixtures.js');
const {SearchPage} = require('../pages/SearchPage.js');

/**
 * Reader-facing article SEARCH — the PARALLEL half: the pieces of the `/search`
 * page (SearchHandler + templates/frontend/pages/search.tpl) that do NOT depend
 * on the async fulltext index, so they are safe to run in the parallel `ojs`
 * project. Everything that must SEE a seeded article indexed — the title/
 * abstract/date/published-only/site-wide result scenarios and the async
 * round-trip — lives in the serial sibling
 * (playwright/tests/serial/site-search.spec.js), which drains the queue.
 *
 * WHY THE SPLIT ISN'T EVEN: indexing is ASYNC (spec rule 8). Publishing only
 * DISPATCHES an UpdateSubmissionSearchJob; a freshly-seeded article is not
 * searchable until a queue worker runs it. The test env's end-of-request
 * JobRunner (`[queues] job_runner = On`) is supposed to drain it, but under
 * parallel load the cross-request lock + FIFO backlog make that non-deterministic
 * (a fresh article can stay unindexed for tens of seconds). So any test that
 * must find a seeded article needs an EXPLICIT `php lib/pkp/tools/jobs.php run`
 * drain — which races with parallel neighbours and therefore belongs in the
 * single-worker serial project. This file keeps only the index-free assertions:
 * the search page renders, and a no-match query shows the "No Results" notice.
 *
 * Search is PUBLIC + anonymous → no `test.use({user})`; the default `page` is
 * an anonymous reader.
 *
 * NOTE (contradicts the task brief, matches the spec): the test DB is
 * PostgreSQL (`ojs_test`), not MySQL — see the serial file's row-102 assertion.
 */

test.describe('Site search — page + no-results (anonymous, index-independent)', () => {
	// Canonical scenario 4 (+ rule 1) — The search page renders the query box
	// and the advanced date-range filters, and a query no article can match
	// shows a single "No Results" notice with no result list and no pagination.
	// Neither half touches the fulltext index, so this is parallel-safe.
	test(
		'the search page renders its form and a no-match query shows the No Results notice',
		{tag: ['@smoke', '@regression']},
		async ({page}) => {
			const searchPage = new SearchPage(page);

			// The page renders: query box + the advanced date-range selectors.
			await searchPage.open();
			await expect(searchPage.queryInput).toBeVisible();
			await expect(page.locator('select[name="dateFromYear"]')).toBeVisible();
			await expect(page.locator('select[name="dateToYear"]')).toBeVisible();

			// A gibberish query → the "No Results" notice, no list, no pagination.
			await searchPage.submitQuery(`zznomatch${Date.now()}qxv`);
			await expect(searchPage.noResults).toBeVisible();
			await expect(searchPage.results).toHaveCount(0);
			await expect(searchPage.pagination).toHaveCount(0);
		},
	);
});
