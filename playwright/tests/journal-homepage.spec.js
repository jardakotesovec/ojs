// @ts-check
const {test, expect} = require('../support/fixtures.js');
const {
	setTinyMceContent,
} = require('../../lib/pkp/playwright/support/tinymce.js');
const submissionPublished = require('../fixtures/scenarios/submission-published.js');

/**
 * Journal homepage — docs/e2e/plans/journal-homepage.md.
 *
 * Reader-facing coverage of the journal index page and the
 * configuration surfaces that shape it:
 *
 *   1. (plan row 1) Journal index renders the current-issue section
 *      with a published article — bootstrap publicknowledge,
 *      read-only.
 *   2. (issue-archive-toc plan row 1) Issue archive lists the
 *      bootstrapped published issue. Absorbed here historically; the
 *      issue-archive-toc plan records the split.
 *   3. (plan row 2) Announcements block: scratch journal with
 *      enableAnnouncements seeded, announcement created via the
 *      management UI, numAnnouncementsHomepage set on the
 *      announcement-settings form; anonymous homepage renders the
 *      block (announcements_list.tpl → section.cmp_announcements)
 *      with the title linking to the announcement detail page.
 *   4. (plan row 3) Sidebar blocks: scratch journal; Information +
 *      "Make a Submission" blocks enabled via Website → Appearance →
 *      Setup `sidebar` FieldOptions; anonymous homepage renders both
 *      blocks in .pkp_structure_sidebar and their links resolve.
 *      The Information block renders because new journals get default
 *      reader/author/librarian information texts
 *      (lib/pkp/schemas/context.json readerInformation
 *      defaultLocaleKey).
 *   5. (plan row 4) Recent-publications organization: scratch journal
 *      WITH a published (empty) issue, two submissions published
 *      ISSUELESS with distinct past datePublished values; theme
 *      option journalContentOrganization flipped to Recent Published
 *      only; anonymous homepage renders .latest_articles with both
 *      titles (newest datePublished first) and NO
 *      section.current_issue despite a current issue existing.
 *   6. (plan row 5) Default primary navigation links resolve —
 *      bootstrap publicknowledge, read-only.
 *
 * Ordering caveat for test 5: IndexHandler's recent-published
 * collector (pages/index/IndexHandler.php:89-92) never sets orderBy,
 * so the listing inherits the collector default — date_submitted DESC
 * (lib/pkp/classes/submission/Collector.php:61/517-519), NOT
 * date_published. The test seeds the older-datePublished submission
 * first so both orderings agree; the newest-first assertion holds
 * either way. Flagged as an app-bug candidate in the wave report.
 */
test.describe('Journal homepage', () => {
	test(
		'journal index renders the current-issue section with the expected headings',
		async ({pkpApi, browser, baseURL}) => {
			// Seed a published submission so the current-issue section on
			// the homepage has at least one entry in its TOC include. The
			// submission's metadata isn't asserted here — landing-page
			// rendering is the capability under test.
			const tag = uniqueTag(test.info(), 'home-index');
			await pkpApi.createSubmission(submissionPublished({tag}));

			const ctx = await browser.newContext({baseURL});
			try {
				const page = await ctx.newPage();
				const resp = await page.goto('/index.php/publicknowledge/');
				expect(resp?.status()).toBe(200);

				// <title> is built from the journal's localized name
				// (templates/frontend/components/header.tpl passes
				// pageTitleTranslated=$currentJournal->getLocalizedName()).
				await expect(page).toHaveTitle(/Journal of Public Knowledge/);

				// The h1 on the index renders the journal name via
				// header.tpl's page-header include; asserting that the
				// page has any visible h1 at all is theme-independent.
				// (The default theme also places `.current_issue` with a
				// "Current Issue" h2 when an issue is published — that's
				// the landmark we care about.)
				const h1 = page.locator('h1').first();
				await expect(h1).toBeVisible();

				// Default-theme landmark: the "Current Issue" h2 inside
				// `section.current_issue`. indexJournal.tpl renders this
				// unconditionally when there's a current issue. Use a
				// forgiving substring on the localized string so minor
				// translation tweaks don't break us.
				const currentIssueHeading = page
					.locator('h2')
					.filter({hasText: /Current Issue/i})
					.first();
				await expect(currentIssueHeading).toBeVisible();

				// The current issue (Vol. 1 No. 2 (2014)) is seeded by
				// bootstrap; its identifying string must appear somewhere
				// on the homepage (either in the title block or in the
				// TOC).
				await expect(
					page.getByText(/Vol\. 1 No\. 2 \(2014\)/),
				).toBeVisible();
			} finally {
				await ctx.close();
			}
		},
	);

	test(
		'issue archive lists the bootstrapped published issue',
		async ({browser, baseURL}) => {
			const ctx = await browser.newContext({baseURL});
			try {
				const page = await ctx.newPage();
				const resp = await page.goto(
					'/index.php/publicknowledge/issue/archive',
				);
				expect(resp?.status()).toBe(200);

				// issueArchive.tpl wraps the page in
				// `.page.page_issue_archive`. Its h1 is the localized
				// `archive.archives` string ("Archives" in en).
				const archiveWrapper = page.locator('.page_issue_archive');
				await expect(archiveWrapper).toBeVisible();
				await expect(archiveWrapper.locator('h1').first()).toContainText(
					/Archives/i,
				);

				// Bootstrap publishes Vol. 1 No. 2 (2014); the issue
				// summary include renders that identification string in
				// every theme.
				const archiveList = page.locator('ul.issues_archive');
				await expect(archiveList).toBeVisible();
				await expect(archiveList).toContainText('Vol. 1 No. 2 (2014)');
			} finally {
				await ctx.close();
			}
		},
	);

	test(
		'announcements block on the homepage lists a recent announcement linking to its detail page',
		{tag: '@regression'},
		async ({pkpApi, asUser, browser, baseURL}) => {
			// Plan row 2. enableAnnouncements is seeded via the journal
			// scenario (the UI toggle round-trip is owned by
			// lib/pkp/playwright/tests/announcements.spec.js test 2); the
			// announcement itself and numAnnouncementsHomepage are
			// configured through the UI — they're the one-off journal-level
			// states this row exercises.
			const tag = scratchTag('hpan');
			const {context} = await pkpApi.createJournal({
				tag,
				name: {en: `Homepage announcements ${tag}`},
				enableAnnouncements: true,
				users: [{username: 'dbarnes', roles: ['manager']}],
			});

			const ctx = await asUser('dbarnes');
			const page = await ctx.newPage();

			// --- Create the announcement via the management listPanel ---
			await page.goto(
				`/index.php/${context.path}/management/settings/announcements`,
			);
			await expect(
				page.getByRole('button', {name: 'Add Announcement'}),
			).toBeVisible({timeout: 15_000});
			await page.getByRole('button', {name: 'Add Announcement'}).click();
			const dialog = page.getByRole('dialog');
			const annTitle = `Homepage CFP ${tag}`;
			const annTeaser = `Homepage teaser ${tag}`;
			await dialog.locator('#announcement-title-control-en').fill(annTitle);
			await setTinyMceContent(
				page,
				'announcement-descriptionShort-control-en',
				`<p>${annTeaser}</p>`,
			);
			await dialog.getByRole('button', {name: 'Save', exact: true}).click();
			await expect(
				page.locator('#announcements .listPanel__itemSummary', {
					hasText: annTitle,
				}),
			).toBeVisible({timeout: 15_000});

			// --- Set numAnnouncementsHomepage on the announcement-settings
			// form (Website → Setup → Announcements). The field only
			// renders when enableAnnouncements is on (showWhen), which the
			// scenario seeded. ---
			await page.goto(
				`/index.php/${context.path}/management/settings/website`,
			);
			await page.locator('#setup-button').click();
			await page.locator('#announcements-button').click();
			const numField = page.locator(
				'#announcements input[name="numAnnouncementsHomepage"]',
			);
			await expect(numField).toBeVisible({timeout: 15_000});
			await numField.fill('2');
			await Promise.all([
				page.waitForResponse(
					(res) =>
						/\/api\/v1\/contexts\/\d+/.test(res.url()) &&
						res.ok() &&
						['POST', 'PUT'].includes(res.request().method()),
					{timeout: 15_000},
				),
				page
					.locator('#announcements form')
					.first()
					.getByRole('button', {name: 'Save', exact: true})
					.click(),
			]);

			// --- Anonymous homepage shows the announcements block ---
			const anon = await anonContext(browser, baseURL);
			try {
				const reader = await anon.newPage();
				const resp = await reader.goto(`/index.php/${context.path}/`);
				expect(resp?.status()).toBe(200);

				const block = reader.locator('section.cmp_announcements');
				await expect(block).toBeVisible();
				await expect(block.locator('h2').first()).toContainText(
					/Announcements/i,
				);

				// The first (most recent) announcement renders through
				// announcement_summary.tpl: linked title + descriptionShort.
				const summary = block.locator('.obj_announcement_summary', {
					hasText: annTitle,
				});
				await expect(summary.first()).toBeVisible();
				await expect(summary.first()).toContainText(annTeaser);

				// Title links to the announcement detail page.
				await summary
					.first()
					.getByRole('link', {name: annTitle})
					.first()
					.click();
				await reader.waitForURL(/\/announcement\/view\//, {
					waitUntil: 'commit',
				});
				const detail = reader.locator('.page_announcement');
				await expect(detail).toBeVisible();
				await expect(detail.getByText(annTitle).first()).toBeVisible();
			} finally {
				await anon.close();
			}
		},
	);

	test(
		'configured sidebar blocks render on the homepage and their links resolve',
		{tag: '@regression'},
		async ({pkpApi, asUser, browser, baseURL}) => {
			// Plan row 3. Sidebar block selection lives in the `sidebar`
			// FieldOptions on Website → Appearance → Setup
			// (PKPAppearanceSetupForm.php:87-92); values are the block
			// plugins' LazyLoadPlugin names (lowercased class names).
			//
			// The "Make a Submission" block plugin ships DISABLED on new
			// journals (unlike the Information block, it has no
			// settings.xml seeding `enabled`), and both the appearance
			// form's option list and the reader-side sidebar render only
			// enabled blocks (PluginRegistry::loadCategory('blocks', true)).
			// Enabling a plugin is plugin-management territory, not this
			// row's behavior, so the scenario seeds the enabled flag and
			// the test drives only the sidebar configuration.
			const tag = scratchTag('hpsb');
			const {context} = await pkpApi.createJournal({
				tag,
				name: {en: `Homepage sidebar ${tag}`},
				users: [{username: 'dbarnes', roles: ['manager']}],
				plugins: {makesubmissionblockplugin: {enabled: true}},
			});

			const ctx = await asUser('dbarnes');
			const page = await ctx.newPage();
			await page.goto(
				`/index.php/${context.path}/management/settings/website`,
			);
			await page.locator('#appearance-button').click();
			await page.locator('#appearance-setup-button').click();

			const infoOption = page.locator(
				'#appearance-setup input[name="sidebar"][value="informationblockplugin"]',
			);
			await expect(infoOption).toBeVisible({timeout: 15_000});
			await infoOption.check();
			await page
				.locator(
					'#appearance-setup input[name="sidebar"][value="makesubmissionblockplugin"]',
				)
				.check();

			await Promise.all([
				page.waitForResponse(
					(res) =>
						/\/api\/v1\/contexts\/\d+(\?|$)/.test(res.url()) &&
						res.ok() &&
						['POST', 'PUT'].includes(res.request().method()),
					{timeout: 15_000},
				),
				page
					.locator('#appearance-setup form')
					.first()
					.getByRole('button', {name: 'Save', exact: true})
					.click(),
			]);

			// --- Anonymous homepage renders the sidebar with both blocks ---
			const anon = await anonContext(browser, baseURL);
			try {
				const reader = await anon.newPage();
				const resp = await reader.goto(`/index.php/${context.path}/`);
				expect(resp?.status()).toBe(200);

				// header.tpl adds `has_sidebar` to the content wrapper when
				// the journal's sidebar setting is non-empty.
				await expect(
					reader.locator('.pkp_structure_content.has_sidebar'),
				).toHaveCount(1);
				const sidebar = reader.locator('.pkp_structure_sidebar');
				await expect(sidebar).toBeVisible();

				// Information block — renders because new journals carry the
				// default for-readers/authors/librarians texts.
				const infoBlock = sidebar.locator('.block_information');
				await expect(infoBlock).toBeVisible();
				await expect(infoBlock.locator('h2').first()).toContainText(
					'Information',
				);
				const forReaders = infoBlock.getByRole('link', {
					name: 'For Readers',
				});
				await expect(forReaders).toBeVisible();
				const readersHref = await forReaders.getAttribute('href');
				expect(readersHref).toContain('/information/readers');

				// "Make a Submission" block links to about/submissions.
				const makeSubmission = sidebar
					.locator('.block_make_submission')
					.getByRole('link', {name: 'Make a Submission'});
				await expect(makeSubmission).toBeVisible();
				const submissionsHref = await makeSubmission.getAttribute('href');
				expect(submissionsHref).toContain('/about/submissions');

				// Both links resolve to their pages.
				const readersResp = await reader.goto(String(readersHref));
				expect(readersResp?.status()).toBe(200);
				await expect(
					reader.locator('.page_information h1').first(),
				).toContainText(/Readers/i);

				const submissionsResp = await reader.goto(
					String(submissionsHref),
				);
				expect(submissionsResp?.status()).toBe(200);
				await expect(reader.locator('h1').first()).toContainText(
					/Submissions/i,
				);
			} finally {
				await anon.close();
			}
		},
	);

	test(
		'recent-publications homepage organization lists issueless articles newest-first without the current-issue block',
		{tag: '@regression'},
		async ({pkpApi, asUser, browser, baseURL}) => {
			// Plan row 4. The scratch journal gets a published (empty)
			// issue ON PURPOSE: with an issue present the default theme's
			// journalContentOrganization default is Issue TOC
			// (JournalContentOption::default), so the UI flip to Recent
			// Published is real work, and the later absence of
			// section.current_issue proves the option took effect rather
			// than "no issue existed".
			const tag = scratchTag('hprp');
			const {context} = await pkpApi.createJournal({
				tag,
				name: {en: `Homepage recent ${tag}`},
				users: [{username: 'dbarnes', roles: ['manager']}],
				issues: [{volume: 1, number: 1, year: 2026, published: true}],
			});

			// Two submissions published ISSUELESS (filterByLatestPublished
			// only includes issueless / unpublished-issue publications) with
			// distinct, clearly-past datePublished values. Seed the OLDER
			// one first: the listing orders by date_submitted DESC (see
			// header comment), so seed order must agree with datePublished
			// order for a deterministic newest-first assertion.
			//
			// date_submitted has SECOND resolution and back-to-back
			// scenario POSTs routinely land in the same second — observed
			// live: two seeds both stamped 2026-06-12 10:55:56, and
			// Postgres returned the ORDER BY tie in insertion order,
			// older first. Crossing a wall-clock second boundary between
			// the two seeds guarantees distinct date_submitted values
			// (Node and PHP share the host clock; the first seed's
			// timestamp is stamped strictly before its response returns).
			const olderTitle = `Recent older ${tag}`;
			const newerTitle = `Recent newer ${tag}`;
			const older = submissionPublished({tag, journal: context.path});
			delete older.publications[0].issue;
			older.publications[0].metadata.title = {en: olderTitle};
			older.publications[0].metadata.datePublished = isoDaysAgo(10);
			await pkpApi.createSubmission(older);

			await waitForNextWallClockSecond();

			const newer = submissionPublished({tag, journal: context.path});
			delete newer.publications[0].issue;
			newer.publications[0].metadata.title = {en: newerTitle};
			newer.publications[0].metadata.datePublished = isoDaysAgo(5);
			await pkpApi.createSubmission(newer);

			// PublicationsProcessor appends " [tag]" to every title locale.
			const olderListed = `${olderTitle} [${tag}]`;
			const newerListed = `${newerTitle} [${tag}]`;

			// --- Theme option: Recent Published only (Issue TOC off) ---
			const ctx = await asUser('dbarnes');
			const page = await ctx.newPage();
			await page.goto(
				`/index.php/${context.path}/management/settings/website`,
			);
			await page.locator('#appearance-button').click();
			// The theme sub-tab is the default-active one; the option
			// checkboxes carry name=journalContentOrganization with values
			// 1 (Issue TOC), 2 (Recent Published), 3 (Category listing).
			const recentOption = page.locator(
				'#theme input[name="journalContentOrganization"][value="2"]',
			);
			await expect(recentOption).toBeVisible({timeout: 15_000});
			await recentOption.check();
			await page
				.locator(
					'#theme input[name="journalContentOrganization"][value="1"]',
				)
				.uncheck();
			await Promise.all([
				page.waitForResponse(
					(res) =>
						/\/api\/v1\/contexts\/\d+\/theme/.test(res.url()) &&
						res.ok() &&
						['POST', 'PUT'].includes(res.request().method()),
					{timeout: 15_000},
				),
				page
					.locator('#theme form')
					.first()
					.getByRole('button', {name: 'Save', exact: true})
					.click(),
			]);

			// --- Anonymous homepage: latest_articles block, newest first,
			// no current-issue section ---
			const anon = await anonContext(browser, baseURL);
			try {
				const reader = await anon.newPage();
				const resp = await reader.goto(`/index.php/${context.path}/`);
				expect(resp?.status()).toBe(200);

				const latest = reader.locator('.latest_articles');
				await expect(latest).toBeVisible();
				await expect(latest.locator('h2').first()).toContainText(
					/Latest Publications/i,
				);

				const list = latest.locator('ul.cmp_article_list');
				await expect(list).toContainText(newerListed);
				await expect(list).toContainText(olderListed);

				// Newest datePublished listed first.
				const listText = await list.innerText();
				expect(listText.indexOf(newerListed)).toBeGreaterThanOrEqual(0);
				expect(listText.indexOf(newerListed)).toBeLessThan(
					listText.indexOf(olderListed),
				);

				// Issue TOC organization is off → no current-issue block,
				// even though the journal HAS a published current issue.
				await expect(
					reader.locator('section.current_issue'),
				).toHaveCount(0);
			} finally {
				await anon.close();
			}
		},
	);

	test(
		'default homepage navigation links resolve',
		{tag: '@regression'},
		async ({browser, baseURL}) => {
			// Plan row 5 — bootstrap publicknowledge, read-only. The
			// primary nav is the default NavigationMenu seeded from
			// registry/navigationMenus.xml (Current / Archives /
			// Announcements / About); Search is the dedicated header link
			// (lib/pkp header.tpl .pkp_navigation_search_wrapper) rather
			// than a menu item — the registry defines NMI_TYPE_SEARCH but
			// doesn't attach it to the primary menu.
			const ctx = await anonContext(browser, baseURL);
			try {
				const page = await ctx.newPage();
				const resp = await page.goto('/index.php/publicknowledge/');
				expect(resp?.status()).toBe(200);

				const nav = page.locator('#navigationPrimary');
				await expect(nav).toBeVisible();

				const current = nav.getByRole('link', {
					name: 'Current',
					exact: true,
				});
				const archives = nav.getByRole('link', {
					name: 'Archives',
					exact: true,
				});
				// The top-level "About" menu item has children, so the
				// navigation-menu renderer emits it as a dropdown toggle
				// with href="#"; the real /about target lives on its
				// "About the Journal" child. The submenu is CSS-hidden
				// until hover, which removes it from the accessibility
				// tree — getByRole can't see it, so a CSS locator (which
				// matches hidden nodes) fetches the href.
				const about = nav
					.getByRole('link', {name: 'About', exact: true})
					.first();
				const aboutChild = nav
					.locator('a', {hasText: 'About the Journal'})
					.first();
				const search = page
					.locator('.pkp_navigation_search_wrapper')
					.getByRole('link', {name: 'Search'});

				await expect(current).toBeVisible();
				await expect(archives).toBeVisible();
				await expect(about).toBeVisible();
				await expect(search).toBeVisible();

				const targets = [
					{
						href: await current.getAttribute('href'),
						path: '/issue/current',
						// Bootstrap's current issue — its identification
						// renders as the page h1.
						landmark: /Vol\. 1 No\. 2 \(2014\)/,
					},
					{
						href: await archives.getAttribute('href'),
						path: '/issue/archive',
						landmark: /Archives/i,
					},
					{
						href: await aboutChild.getAttribute('href'),
						path: '/about',
						landmark: /About the Journal/i,
					},
					{
						href: await search.getAttribute('href'),
						path: '/search',
						landmark: /Search/i,
					},
				];

				for (const {href, path, landmark} of targets) {
					expect(href, `nav href for ${path}`).toContain(path);
					const navResp = await page.goto(String(href));
					expect(
						navResp?.status(),
						`status for ${path}`,
					).toBe(200);
					await expect(
						page.locator('h1').first(),
						`landmark for ${path}`,
					).toContainText(landmark);
				}
			} finally {
				await ctx.close();
			}
		},
	);
});

/**
 * Build a tag scoped to this worker + test title so parallel workers
 * don't collide on the shared submissions list. Mirrors the helper
 * used in lib/pkp/playwright/tests/versioning.spec.js and
 * publish-unpublish.spec.js.
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
 * Short worker-scoped tag with a random suffix for scratch-journal
 * tests. The journal scenario derives the journal path as
 * `j-<alnum(tag)>` (PKPContextScenarioController.php:83-84) and
 * journals.path is varchar(32), so tags stay short; the random suffix
 * keeps re-runs against the long-lived local DB from colliding on the
 * path. Mirrors lib/pkp/playwright/tests/announcements.spec.js.
 *
 * @param {string} prefix
 */
function scratchTag(prefix) {
	const workerIndex = test.info().parallelIndex;
	const suffix = Math.random().toString(36).slice(2, 8);
	return `${prefix}-w${workerIndex}-${suffix}`;
}

/**
 * Resolve once the wall clock has entered a NEW second. Not a UI wait
 * (charter principle 5 targets those): this aligns the DATA clock —
 * `submissions.date_submitted` has second resolution and the
 * recent-published listing orders by it, so two same-second seeds tie
 * and Postgres returns ties in arbitrary order. Bounded at ~1s.
 */
async function waitForNextWallClockSecond() {
	const ms = 1000 - (Date.now() % 1000) + 20;
	await new Promise((resolve) => {
		setTimeout(resolve, ms);
	});
}

/**
 * `YYYY-MM-DD` for a date `days` ago — the format the publication
 * schema's datePublished validator (`date_format:Y-m-d`) expects.
 * Callers use clearly-past offsets (≥1 day of slack) so server/client
 * timezone offsets can't push the date into the future.
 *
 * @param {number} days
 */
function isoDaysAgo(days) {
	const d = new Date();
	d.setDate(d.getDate() - days);
	const y = d.getFullYear();
	const m = String(d.getMonth() + 1).padStart(2, '0');
	const day = String(d.getDate()).padStart(2, '0');
	return `${y}-${m}-${day}`;
}

/**
 * Fresh anonymous browser context. The explicit empty storageState
 * guards against inheriting a logged-in session if this file ever
 * gains a `test.use({user})` (patterns.md rule 8).
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
