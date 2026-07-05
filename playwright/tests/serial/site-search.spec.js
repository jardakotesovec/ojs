// @ts-check
const {test, expect} = require('../../support/fixtures.js');
const {SearchPage} = require('../../pages/SearchPage.js');
const {execFileSync} = require('child_process');
const path = require('path');

/**
 * Site search — the SERIAL half: every scenario that must SEE a seeded article
 * in the fulltext index, plus the async round-trip + CLI rebuild. All of these
 * DRAIN the job queue via `php lib/pkp/tools/jobs.php run` (the issue-management
 * pattern) to index their seeds deterministically, which races with parallel
 * seeding under `[queues] job_runner = On` — so they live in the single-worker
 * `serial` project (which also runs AFTER the parallel `ojs` project, so no read
 * test queries the shared index while the last test flushes it). The
 * index-free page/no-results checks are the parallel sibling at
 * playwright/tests/site-search.spec.js.
 *
 * WHY SEED+DRAIN AND NOT JUST READ THE CORPUS: indexing is async (spec rule 8) —
 * publishing only DISPATCHES an UpdateSubmissionSearchJob. Reading the existing
 * corpus would be non-deterministic (empty on a fresh DB; races the passive
 * end-of-request runner otherwise). Each test seeds its own uniquely-tokened
 * published article, drains the queue, then asserts against the anonymous search
 * page — deterministic on any DB state. Search is public → no `test.use({user})`.
 *
 * As-built realities DRIVEN LIVE (matching the spec, and one correcting the task):
 *   - NOT RELEVANCE-RANKED (rule 6): the DatabaseEngine groups by submission_id
 *     with no relevance ORDER BY → results come back in submission-id order. Test
 *     1 proves it against a deliberately "more relevant" later article.
 *   - GALLEY BODY NOT INDEXED: `pdftotext` is commented out in
 *     config.test.inc.php, so proof-PDF text never reaches `body` (rule 7); the
 *     "beyond the title" proof (test 2) rides on the ABSTRACT column.
 *   - ⚠ THE TEST DB IS POSTGRESQL, not MySQL as the task brief stated (the spec
 *     had it right: "ojs_test, PostgreSQL"). So row 102 / rule 6 —
 *     `orderBy=datePublished` throwing HTTP 500 (a non-aggregated ORDER BY under
 *     GROUP BY) — IS reproducible here and is asserted in the last test (500),
 *     alongside `orderBy=title` → 200.
 */

const PUB_STATUS_PUBLISHED = 3; // PKPPublication::STATUS_PUBLISHED
const PUB_STATUS_QUEUED = 1; // PKPPublication::STATUS_QUEUED
const REPO_ROOT = path.resolve(__dirname, '../../..');

/** Run an OJS CLI tool under the test environment. */
function runCli(args) {
	execFileSync('php', args, {
		cwd: REPO_ROOT,
		env: {...process.env, APPLICATION_ENV: 'test'},
		stdio: 'ignore',
	});
}

/** Drain the job queue — runs every pending UpdateSubmissionSearchJob. */
function drainQueue() {
	try {
		runCli(['lib/pkp/tools/jobs.php', 'run']);
	} catch {
		// A malformed sibling job can exit non-zero; the index jobs still ran.
	}
}

/**
 * CLI re-index (scenario 7): flush the fulltext index and re-queue a job per
 * submission. Does NOT drain — the index stays empty until the queue runs.
 * There is no UI equivalent.
 */
function rebuildIndex(journalPath) {
	runCli(['tools/rebuildSearchIndex.php', journalPath]);
}

let seq = 0;
/** A unique, hyphenless, letters-only token (clean Postgres tsvector match). */
function unique() {
	seq += 1;
	let letters = '';
	while (letters.length < 6) {
		letters += Math.random().toString(36).replace(/[^a-z]/g, '');
	}
	return {tag: `ssz${seq}${letters.slice(0, 4)}`, token: `srchz${letters.slice(0, 6)}`};
}

/**
 * A VoR-published article on publicknowledge's open-access published issue
 * (Vol 1 No 2 2014). dbarnes edits; atester authors (so every result carries
 * author "Author Tester").
 */
function publishedSpec({tag, title, metadata = {}, journal = 'publicknowledge'}) {
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
				metadata: {title, ...metadata},
				issue: {volume: 1, number: 2, year: 2014},
				published: true,
			},
		],
	};
}

/** A submitted-but-unpublished stage-1 submission (never indexed). */
function unpublishedSpec({tag, title}) {
	return {
		tag,
		journal: 'publicknowledge',
		submitter: 'atester',
		section: 'ART',
		locale: 'en',
		submitted: true,
		participants: [{user: 'dbarnes', role: 'editor'}],
		publications: [{metadata: {title}}],
	};
}

test.describe('Site search — indexed reads + async round-trip (serial)', () => {
	// Canonical scenario 1 (+ rule 6 not-ranked) — Reader searches a title word;
	// results link to the article. A second, deliberately "more relevant" article
	// (same token in title + thrice in abstract, seeded LATER → higher submission
	// id) comes back AFTER the first, proving submission-id (not relevance) order.
	// The corpus-wide author surname "Tester" is also indexed (author column).
	test(
		'reader searches a title word: results link to the article, in submission-id (not relevance) order',
		{tag: ['@smoke', '@regression', '@slow']},
		async ({page, pkpApi}) => {
			test.slow();
			const {tag, token} = unique();

			const {submission: subA, publications: pubsA} = await pkpApi.createSubmission(
				publishedSpec({tag: `${tag}a`, title: {en: `${token} alpha study`}}),
			);
			expect(pubsA[0].status).toBe(PUB_STATUS_PUBLISHED);

			const {submission: subB} = await pkpApi.createSubmission(
				publishedSpec({
					tag: `${tag}b`,
					title: {en: `${token} bravo study`},
					metadata: {abstract: {en: `<p>${token} ${token} ${token} deep dive.</p>`}},
				}),
			);
			expect(subB.id).toBeGreaterThan(subA.id);
			drainQueue();

			const searchPage = new SearchPage(page);

			// Drive the query through the real GET form (the reader flow).
			await searchPage.open();
			await searchPage.submitQuery(token);

			// A's summary links to its article landing page.
			const linkA = searchPage.resultForSubmission(subA.id);
			await expect(linkA).toBeVisible();
			await expect(linkA).toContainText(token);
			await expect(searchPage.resultForSubmission(subB.id)).toBeVisible();

			// Both seeded articles match this unique token, and A (lower id) is
			// listed BEFORE B — even though B is the "more relevant" match. That is
			// submission-id order, i.e. the DatabaseEngine does NOT relevance-rank.
			const ids = await searchPage.resultSubmissionIds();
			expect(ids).toContain(subA.id);
			expect(ids).toContain(subB.id);
			expect(
				ids.indexOf(subA.id),
				'results are in submission-id order, not relevance order',
			).toBeLessThan(ids.indexOf(subB.id));

			// Author-surname dimension: "Tester" (every seeded article's author) is
			// indexed in the `authors` column.
			await searchPage.gotoResults({query: 'Tester'});
			await expect(searchPage.results.first()).toBeVisible();
		},
	);

	// Canonical scenario 2 — Reader finds an article by a word that appears only
	// in its ABSTRACT (not the title). The fulltext index spans title/abstract/
	// body/authors, so an abstract-only term matches — search reaches beyond
	// titles. (Galley BODY text is not indexed here — pdftotext disabled — so the
	// abstract is the "beyond the title" proof.)
	test(
		'reader finds an article by a word only in its abstract',
		{tag: ['@smoke', '@regression', '@slow']},
		async ({page, pkpApi}) => {
			const {tag, token} = unique();
			const {submission} = await pkpApi.createSubmission(
				publishedSpec({
					tag,
					title: {en: 'Plainheadline field report'}, // no token in the title
					metadata: {abstract: {en: `<p>The findings mention ${token} explicitly.</p>`}},
				}),
			);
			drainQueue();

			const searchPage = new SearchPage(page);
			await searchPage.gotoResults({query: token});

			// The one match links to the seeded article; its title carries no token
			// (the hit came purely from the abstract column).
			const link = searchPage.resultForSubmission(submission.id);
			await expect(link).toBeVisible();
			await expect(link).not.toContainText(token);
		},
	);

	// Canonical scenario 3 — Reader narrows by a publication DATE RANGE. The
	// article is published 2015-06-15; a "published after 2020" filter drops it,
	// while the same query with no date filter keeps it — proving the date filter
	// actually narrows (not merely always-empty).
	test(
		'reader filters by a publication date range',
		{tag: ['@smoke', '@regression', '@slow']},
		async ({page, pkpApi}) => {
			const {tag, token} = unique();
			const {submission} = await pkpApi.createSubmission(
				publishedSpec({
					tag,
					title: {en: `${token} dated study`},
					metadata: {datePublished: '2015-06-15'},
				}),
			);
			drainQueue();

			const searchPage = new SearchPage(page);

			// Control: no date filter → the article is found.
			await searchPage.gotoResults({query: token});
			await expect(searchPage.resultForSubmission(submission.id)).toBeVisible();

			// "Published after 2020-01-01" excludes the 2015 article → No Results.
			await searchPage.gotoResults({
				query: token,
				dateFrom: {year: 2020, month: 1, day: 1},
			});
			await expect(searchPage.resultForSubmission(submission.id)).toHaveCount(0);
			await expect(searchPage.noResults).toBeVisible();
		},
	);

	// Canonical scenario 6 (published-only half) — Only PUBLISHED articles appear.
	// A published article's token is found; an unpublished (submitted, never
	// published) submission's token is absent — never indexed, and the query's
	// published gate would drop it anyway (rule 3).
	test(
		'only published articles appear; an unpublished submission is absent',
		{tag: ['@smoke', '@regression', '@slow']},
		async ({page, pkpApi}) => {
			test.slow();
			const {tag, token} = unique();
			const pubToken = `${token}pub`;
			const draftToken = `${token}drf`;

			const {submission: published, publications} = await pkpApi.createSubmission(
				publishedSpec({tag: `${tag}p`, title: {en: `${pubToken} live article`}}),
			);
			expect(publications[0].status).toBe(PUB_STATUS_PUBLISHED);

			const {submission: draft, publications: draftPubs} = await pkpApi.createSubmission(
				unpublishedSpec({tag: `${tag}d`, title: {en: `${draftToken} hidden draft`}}),
			);
			expect(draftPubs[0].status).toBe(PUB_STATUS_QUEUED);
			drainQueue();

			const searchPage = new SearchPage(page);

			// The published article is findable…
			await searchPage.gotoResults({query: pubToken});
			await expect(searchPage.resultForSubmission(published.id)).toBeVisible();

			// …and the unpublished one is not.
			await searchPage.gotoResults({query: draftToken});
			await expect(searchPage.resultForSubmission(draft.id)).toHaveCount(0);
			await expect(searchPage.noResults).toBeVisible();
		},
	);

	// Canonical scenario 5 — Site-wide (cross-journal) search. At the SITE level
	// (`/index/search`, no journal in the URL) the page shows a journal picker and
	// returns cross-journal results; inside a single journal the query is already
	// scoped and no picker appears.
	test(
		'site-wide search shows a journal picker and returns cross-journal results; journal-scoped search has none',
		{tag: ['@smoke', '@regression', '@slow']},
		async ({page, pkpApi}) => {
			const {tag, token} = unique();
			const {submission} = await pkpApi.createSubmission(
				publishedSpec({tag, title: {en: `${token} crossjournal study`}}),
			);
			drainQueue();

			// Site-wide surface: the journal picker is present…
			const siteSearch = new SearchPage(page, {journalPath: 'index'});
			await siteSearch.open();
			await expect(siteSearch.journalPicker).toBeVisible();

			// …and the query returns the publicknowledge article from the site level.
			await siteSearch.gotoResults({query: token});
			await expect(siteSearch.resultForSubmission(submission.id)).toBeVisible();

			// Inside the journal context the same query is already scoped — no picker.
			const journalSearch = new SearchPage(page, {journalPath: 'publicknowledge'});
			await journalSearch.open();
			await expect(journalSearch.journalPicker).toHaveCount(0);
		},
	);

	// Canonical scenarios 6 (async) + 7 (admin rebuilds the index) — merged: THE
	// HEADLINE async round-trip. Publishing only queues an index job; the fulltext
	// rows exist only because a worker ran it. The CLI rebuild
	// (tools/rebuildSearchIndex.php, rule 9) flushes the index and re-queues a job
	// per submission WITHOUT running them, letting us observe the genuinely-
	// unindexed state on demand:
	//   drain → FINDABLE   ·   rebuild → ABSENT   ·   drain → FINDABLE again.
	test(
		'index rebuild flushes the article until the queue drains (async round-trip + CLI rebuild)',
		{tag: ['@smoke', '@regression', '@slow']},
		async ({page, pkpApi}) => {
			test.slow();
			const {tag, token} = unique();
			const {submission, publications} = await pkpApi.createSubmission(
				publishedSpec({tag, title: {en: `${token} async index article`}}),
			);
			expect(publications[0].status).toBe(PUB_STATUS_PUBLISHED);

			const searchPage = new SearchPage(page);
			const link = searchPage.resultForSubmission(submission.id);

			// --- Baseline: drain the queue → the article is FINDABLE. ---
			drainQueue();
			await searchPage.gotoResults({query: token});
			await expect(link).toBeVisible();
			await expect(link).toContainText(token);

			// --- Rebuild (CLI, scenario 7): flush the index + re-queue every
			// submission's index job WITHOUT running them → the fulltext rows are
			// gone and the job is only PENDING, so the article is ABSENT (the
			// genuinely-unindexed state, rule 8). The rendered results reflect the
			// flushed index; a finally guarantees the shared corpus is drained back
			// even if this assertion throws. ---
			try {
				rebuildIndex('publicknowledge');
				await searchPage.gotoResults({query: token});
				await expect(searchPage.noResults).toBeVisible();
				await expect(link).toHaveCount(0);
			} finally {
				drainQueue();
			}

			// --- After the drain the worker rebuilt the rows → FINDABLE again. ---
			await searchPage.gotoResults({query: token});
			await expect(link).toBeVisible();
			await expect(link).toContainText(token);

			// ⚠ Row 102 / rule 6 — the test DB is PostgreSQL, so the non-aggregated
			// `orderBy=datePublished` ORDER BY under GROUP BY throws HTTP 500 (the
			// task brief's "MySQL tolerates it" is wrong for this env). The
			// supported `orderBy=title` branch stays 200.
			const byDate = await page.request.get(
				searchPage.resultsUrl({query: token}) + '&orderBy=datePublished',
			);
			expect(byDate.status(), 'orderBy=datePublished 500s on PostgreSQL (row 102)').toBe(500);
			const byTitle = await page.request.get(
				searchPage.resultsUrl({query: token}) + '&orderBy=title',
			);
			expect(byTitle.status(), 'orderBy=title is supported → 200').toBe(200);
		},
	);
});
