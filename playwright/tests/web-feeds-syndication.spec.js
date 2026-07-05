// @ts-check
const {test, expect} = require('../support/fixtures.js');

/**
 * Web feeds & syndication — the machine-facing, ANONYMOUS surfaces that let the
 * outside world track a journal without scraping HTML or logging in: the core
 * XML sitemap, the webFeed (RSS 1.0 / RSS 2.0 / Atom) and the announcementFeed
 * (RSS 1.0 / RSS 2.0 / Atom). One test per canonical scenario of
 * docs/product/specs/web-feeds-syndication.md (6 scenarios), merged to 5.
 *
 * Every request here is an unauthenticated machine call, so these tests drive
 * the endpoints with `request.get` + XML string/regex assertions rather than a
 * browser DOM (the same pattern as oai-pmh.spec.js). No file-level
 * `test.use({user})` — the `request` fixture stays anonymous.
 *
 * As-built, live-verified via curl during authoring (feedback discipline —
 * assert reality, don't edit the spec):
 *   - Sitemap: `/{journal}/sitemap` 302s to `…/en/sitemap` (request.get follows)
 *     → 200 application/xml <urlset>; `/index/sitemap` → 200 <sitemapindex>.
 *   - The bootstrap seeds NO published submissions in publicknowledge, so every
 *     test that needs webFeed/sitemap CONTENT seeds its own published article
 *     into the current issue (issue:'current' → Repo::issue()->getCurrent(),
 *     exactly what the issue-mode webFeed reads).
 *   - webFeed is ENABLED BY DEFAULT (rule 5): all three formats HTTP 200 at
 *     `/{journal}/gateway/plugin/WebFeedGatewayPlugin/{rss|rss2|atom}` with no
 *     setup. publicknowledge's webFeed is in ISSUE mode (displayItems=issue) —
 *     NB the spec's "the env DB has displayItems=1 (recent mode)" note is stale;
 *     a fresh reset carries the corrected `issue` value. Either mode surfaces a
 *     published article seeded into the current issue.
 *   - There is NO legacy `/feed/rss` alias — it 404s (asserted).
 *   - announcementFeed is DISABLED BY DEFAULT (rule 9): all three formats 404 on
 *     publicknowledge. Enabling it on a scratch journal (plugins passthrough) +
 *     enableAnnouncements + a seeded announcement → 200.
 *   - ⚠ Row 107 deviation (Known deviations): the announcementFeed atom.tpl and
 *     rss.tpl (RSS 1.0) emit MALFORMED dates via obsolete strftime `%` codes —
 *     `<updated>%2026-%07-%05UTC%UTC%185</updated>`, `<dc:date>%2026-%07-%05</dc:date>`.
 *     The announcementFeed RSS 2.0 pubDate and ALL webFeed dates are correct.
 *     Asserted as a contrast: announcementFeed atom `<updated>` contains a
 *     literal `%`; webFeed atom `<updated>` is valid RFC3339.
 *
 * Parallel-safety: unique hyphenless tags/paths; each announcementFeed test
 * seeds its own scratch journal; published-article seeds are additive (they add
 * items to publicknowledge's shared current issue, never removing any) and each
 * test asserts only on its own tagged title.
 */

/** A well-formed RFC3339 timestamp prefix, e.g. 2026-07-05T04:55:40+00:00. */
const RFC3339 = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;

/** A unique, hyphenless, alphanumeric tag (parallel isolation). */
function uniqueTag() {
	const workerIndex = test.info().parallelIndex;
	const suffix = Math.random().toString(36).slice(2, 8);
	return `feed${workerIndex}x${suffix}`;
}

/** A unique, hyphenless, alphanumeric journal path (≤32, parallel isolation). */
function uniquePath(prefix = 'feed') {
	const workerLetter = String.fromCharCode(97 + (test.info().parallelIndex % 26));
	let suffix = '';
	while (suffix.length < 6) {
		suffix += Math.random().toString(36).replace(/[^a-z0-9]/g, '');
	}
	return `${prefix}${workerLetter}${suffix.slice(0, 6)}`;
}

/** GET a feed/sitemap as an anonymous machine call. request.get follows the
 * `/sitemap` → `/en/sitemap` (and gateway) 302s by default. */
async function fetchXml(request, path) {
	const res = await request.get(path);
	return {
		status: res.status(),
		ctype: res.headers()['content-type'] || '',
		body: await res.text(),
	};
}

/** The text content of the first `<name>…</name>` element (name may contain a
 * namespace prefix such as `dc:date`), or null. */
function firstElement(body, name) {
	const m = body.match(new RegExp(`<${name}[^>]*>([^<]*)</${name}>`));
	return m ? m[1] : null;
}

/** A gateway feed URL. */
function webFeedUrl(fmt, journal = 'publicknowledge') {
	return `/index.php/${journal}/gateway/plugin/WebFeedGatewayPlugin/${fmt}`;
}
function announcementFeedUrl(fmt, journal) {
	return `/index.php/${journal}/gateway/plugin/AnnouncementFeedGatewayPlugin/${fmt}`;
}

/**
 * A VoR-published article in publicknowledge's current issue (Vol 1 No 2 2014),
 * with one PDF galley. Appears immediately as a webFeed item / sitemap URL (the
 * feeds read publications directly, no async index). `issue:'current'` resolves
 * to Repo::issue()->getCurrent() — the exact issue the issue-mode webFeed lists.
 */
function publishedSpec({tag, title, journal = 'publicknowledge', issue = 'current'}) {
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
				metadata: {title: {en: title}, abstract: {en: `<p>Abstract ${tag}</p>`}},
				issue,
				published: true,
				galleys: [{label: 'PDF', file: 'default-article.pdf'}],
			},
		],
	};
}

/** An UNPUBLISHED submission (no issue, published:false → STATUS_QUEUED). Used
 * to prove the published-only filter: it must never surface in the webFeed. */
function unpublishedSpec({tag, title, journal = 'publicknowledge'}) {
	return {
		tag,
		journal,
		submitter: 'atester',
		section: 'ART',
		locale: 'en',
		submitted: true,
		participants: [{user: 'dbarnes', role: 'editor', canChangeMetadata: true}],
		publications: [
			{versionStage: 'AO', metadata: {title: {en: title}}, published: false},
		],
	};
}

/** Create a single-locale (en) scratch journal with the announcementFeed plugin
 * enabled, announcements turned on, and the given announcements seeded. */
async function createAnnouncementFeedJournal(pkpApi, announcements) {
	const path = uniquePath('afeed');
	await pkpApi.createJournal({
		tag: path,
		path,
		primaryLocale: 'en',
		supportedLocales: ['en'],
		name: {en: `Feeds Journal ${path}`},
		enableAnnouncements: true,
		numAnnouncementsHomepage: 5,
		plugins: {announcementfeedplugin: {enabled: true}},
		announcements,
	});
	return path;
}

test.describe('Web feeds & syndication (sitemap + RSS/Atom, anonymous)', () => {
	// Canonical scenario 1 — Crawl the journal sitemap. A search engine GETs
	// `/{journal}/sitemap` and receives an application/xml <urlset> of the
	// journal's public URLs (home, login, register, search, current/archive
	// issue, published issues and — for each — the published article + galley
	// URLs). GETting `/index/sitemap` instead returns a <sitemapindex> pointing
	// at every journal's sitemap. Always available, no login.
	test(
		'the journal sitemap is a urlset of public URLs; the site sitemap is an index',
		{tag: ['@smoke', '@regression']},
		async ({request, pkpApi}) => {
			// Seed a published article + galley so the article/galley URLs exist
			// (the bootstrap publishes nothing in publicknowledge).
			const tag = uniqueTag();
			const {submission} = await pkpApi.createSubmission(
				publishedSpec({tag, title: `Sitemap Article ${tag}`}),
			);
			const id = submission.id;

			// Journal scope → a <urlset> (NOT a <sitemapindex>). The /sitemap →
			// /en/sitemap 302 is followed by request.get.
			const journal = await fetchXml(request, '/index.php/publicknowledge/sitemap');
			expect(journal.status).toBe(200);
			expect(journal.ctype).toContain('xml');
			expect(journal.body).toContain('<urlset');
			expect(journal.body).not.toContain('<sitemapindex');

			// Stable public URLs are always listed.
			for (const op of ['/login', '/user/register', '/search', '/issue/current', '/issue/archive']) {
				expect(journal.body, `sitemap lists ${op}`).toContain(
					`/publicknowledge/en${op}`,
				);
			}
			// My freshly published article's abstract URL + its galley URL.
			expect(journal.body).toContain(`/publicknowledge/en/article/view/${id}`);
			expect(journal.body, 'galley URL present').toMatch(
				new RegExp(`/publicknowledge/en/article/view/${id}/\\d+`),
			);

			// Site scope → a <sitemapindex> whose <loc>s point at each journal's
			// own /sitemap (spanning journals), including publicknowledge.
			const site = await fetchXml(request, '/index.php/index/sitemap');
			expect(site.status).toBe(200);
			expect(site.ctype).toContain('xml');
			expect(site.body).toContain('<sitemapindex');
			expect(site.body).not.toContain('<urlset');
			expect(site.body).toContain('/publicknowledge/en/sitemap');
		},
	);

	// Canonical scenario 2 — Subscribe to the web feed (all three formats,
	// enabled by default). A feed reader GETs the webFeed gateway with no setup:
	// because the plugin is on for every journal (rule 5), rss2 (RSS 2.0), atom
	// (Atom 1.0) and rss (RSS 1.0 / RDF) all return 200 with their own MIME type,
	// each listing the current issue's published articles. A seeded published
	// article surfaces as an item/entry, and the Atom date is well-formed RFC3339.
	test(
		'the webFeed serves RSS 2.0, Atom and RSS 1.0 by default with a seeded article and a valid Atom date',
		{tag: ['@smoke', '@regression']},
		async ({request, pkpApi}) => {
			const tag = uniqueTag();
			const title = `WebFeed Article ${tag}`;
			await pkpApi.createSubmission(publishedSpec({tag, title}));

			// RSS 2.0 — <rss version="2.0"> / <channel> / my <item> with a valid
			// RFC822 pubDate.
			const rss2 = await fetchXml(request, webFeedUrl('rss2'));
			expect(rss2.status).toBe(200);
			expect(rss2.ctype).toContain('application/rss+xml');
			expect(rss2.body).toContain('<rss version="2.0"');
			expect(rss2.body).toContain('<channel>');
			expect(rss2.body).toContain('Journal of Public Knowledge');
			expect(rss2.body).toContain('<item>');
			expect(rss2.body, 'my article is an item').toContain(title);
			expect(rss2.body).toMatch(/<pubDate>[A-Z][a-z]{2}, \d{2} [A-Z][a-z]{2} \d{4}/);

			// Atom 1.0 — <feed xmlns=atom> / my <entry> / a valid RFC3339 <updated>.
			const atom = await fetchXml(request, webFeedUrl('atom'));
			expect(atom.status).toBe(200);
			expect(atom.ctype).toContain('application/atom+xml');
			expect(atom.body).toContain('<feed xmlns="http://www.w3.org/2005/Atom">');
			expect(atom.body).toContain('<entry>');
			expect(atom.body).toContain(title);
			const atomUpdated = firstElement(atom.body, 'updated');
			expect(atomUpdated, 'webFeed atom <updated> present').toBeTruthy();
			expect(
				atomUpdated,
				'webFeed atom date is valid RFC3339',
			).toMatch(RFC3339);
			expect(atomUpdated).not.toContain('%');

			// RSS 1.0 — an RDF document.
			const rss = await fetchXml(request, webFeedUrl('rss'));
			expect(rss.status).toBe(200);
			expect(rss.ctype).toContain('application/rdf+xml');
			expect(rss.body).toContain('<rdf:RDF');
			expect(rss.body).toContain(title);
		},
	);

	// Canonical scenario 6 — Published-only content + no legacy alias. The
	// webFeed emits only STATUS_PUBLISHED submissions (rule 6): a published
	// article surfaces, an unpublished one never does. And there is no `/feed/rss`
	// alias — that path 404s (as-built; the only feed door is the gateway URL).
	test(
		'the webFeed lists only published articles; the legacy /feed/rss path 404s',
		{tag: '@regression'},
		async ({request, pkpApi}) => {
			const pubTag = uniqueTag();
			const draftTag = uniqueTag();
			const publishedTitle = `Published In Feed ${pubTag}`;
			const draftTitle = `Draft Not In Feed ${draftTag}`;

			await pkpApi.createSubmission(
				publishedSpec({tag: pubTag, title: publishedTitle}),
			);
			await pkpApi.createSubmission(
				unpublishedSpec({tag: draftTag, title: draftTitle}),
			);

			const rss2 = await fetchXml(request, webFeedUrl('rss2'));
			expect(rss2.status).toBe(200);
			expect(rss2.body, 'the published article appears').toContain(publishedTitle);
			expect(
				rss2.body,
				'the unpublished submission is filtered out (published-only)',
			).not.toContain(draftTitle);

			// No legacy /feed/rss alias — neither bare nor locale-prefixed.
			const legacy = await request.get('/index.php/publicknowledge/feed/rss');
			expect(legacy.status()).toBe(404);
			const legacyEn = await request.get('/index.php/publicknowledge/en/feed/rss');
			expect(legacyEn.status()).toBe(404);
		},
	);

	// Canonical scenario 4 — The announcement feed is off until enabled. On a
	// default journal all three announcementFeed formats 404 (disabled by
	// default, rule 9). On a scratch journal with the plugin enabled +
	// announcements turned on + two seeded announcements, the same gateway serves
	// the announcements (title + reader URL + description).
	test(
		'the announcementFeed 404s by default and serves announcements once enabled on a scratch journal',
		{tag: ['@smoke', '@regression']},
		async ({request, pkpApi}) => {
			// Disabled by default on publicknowledge → all three formats 404.
			for (const fmt of ['rss', 'rss2', 'atom']) {
				const res = await request.get(
					announcementFeedUrl(fmt, 'publicknowledge'),
				);
				expect(res.status(), `announcementFeed ${fmt} 404s by default`).toBe(404);
			}

			// Enabled on a scratch journal with two announcements.
			const tag = uniqueTag();
			const first = `Call For Papers ${tag}`;
			const second = `Editorial Board Update ${tag}`;
			const journalPath = await createAnnouncementFeedJournal(pkpApi, [
				{title: first, descriptionShort: 'Submissions now open', description: 'Full CFP text.'},
				{title: second, descriptionShort: 'New members', description: 'Board changes.'},
			]);

			const rss2 = await fetchXml(request, announcementFeedUrl('rss2', journalPath));
			expect(rss2.status).toBe(200);
			expect(rss2.ctype).toContain('application/rss+xml');
			expect(rss2.body).toContain('<rss version="2.0"');
			expect(rss2.body).toContain('<channel>');
			expect(rss2.body).toContain('<item>');
			expect(rss2.body, 'first announcement listed').toContain(first);
			expect(rss2.body, 'second announcement listed').toContain(second);
			// Items link at the announcement reader page.
			expect(rss2.body).toContain('announcement/view');
		},
	);

	// Known-deviation row 107 — The announcementFeed Atom & RSS 1.0 templates
	// emit MALFORMED dates (obsolete strftime `%` codes), while the
	// announcementFeed RSS 2.0 date and ALL webFeed dates are correct. Asserted
	// as a contrast on a scratch announcementFeed journal + publicknowledge's
	// webFeed: the announcement Atom <updated>/RSS-1.0 <dc:date> contain a
	// literal `%` and are NOT RFC3339, whereas the announcement RSS 2.0 <pubDate>
	// and the webFeed Atom <updated> are well-formed.
	test(
		'the announcementFeed Atom/RSS-1.0 dates are malformed (literal %) while the webFeed Atom date is valid RFC3339',
		{tag: '@regression'},
		async ({request, pkpApi}) => {
			const tag = uniqueTag();
			const journalPath = await createAnnouncementFeedJournal(pkpApi, [
				{
					title: `Dated Announcement ${tag}`,
					descriptionShort: 'A dated notice',
					description: 'Body text.',
				},
			]);

			// announcementFeed Atom — <updated> is garbage (literal %), NOT RFC3339.
			const annAtom = await fetchXml(request, announcementFeedUrl('atom', journalPath));
			expect(annAtom.status).toBe(200);
			const annAtomUpdated = firstElement(annAtom.body, 'updated');
			expect(annAtomUpdated, 'announcement atom <updated> present').toBeTruthy();
			expect(
				annAtomUpdated,
				'announcement Atom date is malformed (contains a literal %)',
			).toContain('%');
			expect(
				annAtomUpdated,
				'announcement Atom date is NOT valid RFC3339',
			).not.toMatch(RFC3339);

			// announcementFeed RSS 1.0 — <dc:date> is also malformed (literal %).
			const annRss = await fetchXml(request, announcementFeedUrl('rss', journalPath));
			expect(annRss.status).toBe(200);
			const annDcDate = firstElement(annRss.body, 'dc:date');
			expect(annDcDate, 'announcement rss1.0 <dc:date> present').toBeTruthy();
			expect(
				annDcDate,
				'announcement RSS 1.0 dc:date is malformed (contains a literal %)',
			).toContain('%');

			// announcementFeed RSS 2.0 — the correct branch: a valid RFC822
			// pubDate with no stray %.
			const annRss2 = await fetchXml(request, announcementFeedUrl('rss2', journalPath));
			expect(annRss2.status).toBe(200);
			const annPubDate = firstElement(annRss2.body, 'pubDate');
			expect(annPubDate, 'announcement rss2 <pubDate> present').toBeTruthy();
			expect(annPubDate).not.toContain('%');
			expect(annPubDate).toMatch(/^[A-Z][a-z]{2}, \d{2} [A-Z][a-z]{2} \d{4}/);

			// CONTRAST — the webFeed Atom date IS valid RFC3339. Seed a published
			// article so publicknowledge's issue-mode webFeed has content + a date.
			await pkpApi.createSubmission(
				publishedSpec({tag: `${tag}w`, title: `WebFeed Dated ${tag}`}),
			);
			const webAtom = await fetchXml(request, webFeedUrl('atom'));
			expect(webAtom.status).toBe(200);
			const webAtomUpdated = firstElement(webAtom.body, 'updated');
			expect(webAtomUpdated, 'webFeed atom <updated> present').toBeTruthy();
			expect(
				webAtomUpdated,
				'webFeed Atom date is valid RFC3339 (the correct-date contrast)',
			).toMatch(RFC3339);
			expect(webAtomUpdated).not.toContain('%');
		},
	);
});
