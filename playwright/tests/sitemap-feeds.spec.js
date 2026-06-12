// @ts-check
const {test, expect} = require('../support/fixtures.js');
const submissionPublished = require('../fixtures/scenarios/submission-published.js');

/**
 * Journal sitemap & web feeds — rows 4–5 of
 * docs/e2e/plans/oai-sitemap-feeds.md. Rows 1–3 (the shared OAI
 * endpoint) live in lib/pkp/playwright/tests/oai-dc.spec.js; the plan's
 * Absorbs note records the split. These two rows are OJS-specific
 * (issues, the journal front end), hence playwright/tests/.
 *
 * Both tests are anonymous API probes: the sitemap and the feed
 * gateway are sessionless reader surfaces, and `request` here carries
 * no storageState (this file sets no `test.use({user})`).
 *
 * App-fix dependency (row 4): pages/sitemap/SitemapHandler.php used
 * `filterByLatestPublished(true)` (regression in da7c68874e /
 * pkp/pkp-lib#12245), which is the continuous-publication filter —
 * current publication issueless or attached to an UNpublished issue
 * (classes/submission/Collector.php getQueryBuilder). Combined with
 * `filterByIssueIds([$publishedIssue])` the predicate was
 * self-contradictory, so the sitemap emitted ZERO article/galley URLs.
 * Fixed in this wave by restoring filterByStatus([STATUS_PUBLISHED]);
 * see docs/e2e/app-changes.md.
 *
 * Known app quirk (row 5, not asserted): webFeed's settings.xml
 * declared displayItems as type="bool" with value "issue", which
 * installs as boolean true while WebFeedGatewayPlugin::fetch compares
 * `$displayItems === 'issue'` — fresh contexts silently served the
 * "recent items" branch instead of the intended current-issue branch.
 * Fixed this wave (type="string"); the assertion below is robust to
 * either branch because the seeded article is both in the current
 * issue and the most recently modified.
 */
test.describe('Journal sitemap and web feeds', () => {
	test(
		'journal sitemap XML lists issue and article URLs',
		async ({pkpApi, request}) => {
			// Seed a published submission assigned to the bootstrap's
			// published current issue (Vol 1 No 2, 2014) so the sitemap's
			// per-issue article loop has a row this test owns.
			const tag = uniqueTag(test.info(), 'smap');
			const created = await pkpApi.createSubmission(
				submissionPublished({tag}),
			);
			const submissionId = created.submission.id;
			const issueId = created.publications[0].issueId;
			expect(issueId).toBeGreaterThan(0);

			// `request.get` follows the locale-prefix 302
			// (/sitemap → /en/sitemap) to the XML document.
			const res = await request.get('/index.php/publicknowledge/sitemap');
			expect(res.status()).toBe(200);
			expect(res.headers()['content-type']).toMatch(/application\/xml/i);

			const xml = await res.text();
			expect(xml).toContain('<urlset');

			// Standing issue routes (SitemapHandler::_createContextSitemap
			// appends them whenever publishingMode != NONE).
			expect(xml).toMatch(/<loc>[^<]*\/issue\/current<\/loc>/);
			expect(xml).toMatch(/<loc>[^<]*\/issue\/archive<\/loc>/);

			// The seeded issue view URL and the seeded article URL. The
			// <loc> values are locale-prefixed absolute URLs; match on the
			// route suffix. The article URL uses getBestId() — the plain
			// submission id, since the fixture sets no publication urlPath.
			expect(xml).toMatch(
				new RegExp(`<loc>[^<]*/issue/view/${issueId}</loc>`),
			);
			expect(xml).toMatch(
				new RegExp(`<loc>[^<]*/article/view/${submissionId}</loc>`),
			);
		},
	);

	test(
		'homepage advertises web feeds and the atom gateway serves the journal feed',
		async ({pkpApi, request}) => {
			// The webFeed plugin ships enabled with displayPage=homepage
			// (plugins/generic/webFeed/settings.xml), so the journal index
			// carries <link rel="alternate"> head entries and the gateway
			// route serves the feed — no per-test configuration needed.
			const tag = uniqueTag(test.info(), 'feed');
			const created = await pkpApi.createSubmission(
				submissionPublished({tag}),
			);
			const submissionId = created.submission.id;

			// --- Homepage <head> advertises all three feed flavours.
			// Server-rendered (TemplateManager::addHeader on
			// frontend-index), so a plain GET sees them.
			const homeRes = await request.get('/index.php/publicknowledge/');
			expect(homeRes.status()).toBe(200);
			const html = await homeRes.text();

			const linkFor = (mimeType) => {
				const match = html.match(
					new RegExp(
						`<link rel="alternate" type="${escapeRegex(mimeType)}" href="([^"]+)"`,
					),
				);
				return match?.[1];
			};
			const atomHref = linkFor('application/atom+xml');
			const rssHref = linkFor('application/rdf+xml');
			const rss2Href = linkFor('application/rss+xml');
			expect(atomHref, 'atom <link rel="alternate"> in head').toBeTruthy();
			expect(rssHref, 'rss <link rel="alternate"> in head').toBeTruthy();
			expect(rss2Href, 'rss2 <link rel="alternate"> in head').toBeTruthy();
			expect(atomHref).toContain('/gateway/plugin/WebFeedGatewayPlugin/atom');
			expect(rssHref).toContain('/gateway/plugin/WebFeedGatewayPlugin/rss');
			expect(rss2Href).toContain('/gateway/plugin/WebFeedGatewayPlugin/rss2');

			// --- The advertised atom URL serves feed XML with the journal
			// title and the seeded current-issue article entry.
			const feedRes = await request.get(String(atomHref));
			expect(feedRes.status()).toBe(200);
			expect(feedRes.headers()['content-type']).toContain(
				'application/atom+xml',
			);
			const feed = await feedRes.text();
			expect(feed).toContain('<feed xmlns="http://www.w3.org/2005/Atom">');
			expect(feed).toContain(
				'<title>Journal of Public Knowledge</title>',
			);

			// Our seeded article appears as an entry (tag-scoped — the
			// PublicationsProcessor appends " [tag]" to the title) and its
			// alternate link resolves to the article view route.
			expect(feed).toMatch(
				new RegExp(
					`<title>[^<]*Published article[^<]*${escapeRegex(tag)}[^<]*</title>`,
				),
			);
			expect(feed).toMatch(
				new RegExp(
					`<link rel="alternate" href="[^"]*/article/view/${submissionId}"`,
				),
			);
		},
	);
});

/**
 * Build a tag scoped to this worker + test title so parallel workers
 * don't collide on the shared submissions list. Mirrors the helper
 * used in journal-homepage.spec.js / oai-dc.spec.js.
 *
 * @param {import('@playwright/test').TestInfo} info
 * @param {string} suffix
 */
function uniqueTag(info, suffix) {
	const slug = info.title
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.slice(0, 16);
	return `t-w${info.parallelIndex}-${suffix}-${slug}`;
}

/**
 * Escape a string for inclusion in a RegExp.
 *
 * @param {string} s
 */
function escapeRegex(s) {
	return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
