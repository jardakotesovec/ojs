// @ts-check
const {test, expect} = require('../support/fixtures.js');

/**
 * Distribution settings — Settings → Distribution: the journal-wide
 * license/copyright defaults, SEO metadata, publishing mode (+ delayed
 * open access + OAI toggle), LOCKSS/CLOCKSS archiving flags with their
 * public gateway manifests, and the payments-enable boundary. One test
 * per canonical scenario of docs/product/specs/distribution-settings.md
 * (6 named, 6 tests, 1:1).
 *
 * WHAT IS DRIVEN LIVE:
 *   - The REAL Vue pkp-forms on the page (tab id map: #license (default)
 *     · #dois · #indexing · #payments · #access · #archive → side tab
 *     #lockss): License (copyrightHolderType/licenseUrl radios + the OJS
 *     copyrightYearBasis radio), Search Indexing (searchDescription +
 *     customHeaders), Access (publishingMode radios + the showWhen
 *     delayedOpenAccessDuration select), Archiving → "LOCKSS and
 *     CLOCKSS" (both flag checkboxes, labels embedding the live manifest
 *     links), and Payments (enable checkbox + showWhen currency/method
 *     selects → the dedicated PUT _payments endpoint).
 *   - Downstream effect-links, one per group (the engines live in other
 *     features): the publish-time license snapshot + public landing-page
 *     CC badge/copyright line (publication-license owns the mechanics);
 *     the issue-vs-article copyright-year discriminator (issue backdated
 *     through the REAL back-issue grid form); <head> meta tags read
 *     anonymously (description on home ONLY, custom tag everywhere);
 *     the publishing-mode reader-surface matrix (nav items, homepage
 *     issue, sitemap pruning, the OjsJournalMustPublishPolicy login
 *     bounce for anonymous vs manager pass-through); the flag-gated
 *     gateway manifests (302-to-home when off, public Publisher
 *     Manifest with the issue list when on, plus the site-level
 *     all-journals list); the manager-sidebar Payments entry injected
 *     on form success without a reload.
 *
 * KNOWN LEDGER ROW respected (feedback discipline — assert reality):
 *   - Row 126: the Delayed Open Access 1–60 months bound is CLIENT-ONLY
 *     (the schema has no bounds; the API accepts 999/-5). Test 4 asserts
 *     the UI bound (61 options, Disabled + 1..60) exactly where the spec
 *     asserts UI, and asserts NO server-side max anywhere.
 *
 * AUTH: `test.use({user: 'dbarnes'})` — dbarnes is manager of each
 * test's OWN scratch journal. The permission probe uses
 * `asUser('dbuskins')` (section editor). All public/manifest/meta reads
 * use explicit empty-state anonymous contexts (patterns.md item 8).
 *
 * PARALLEL + isolation: every test seeds its OWN scratch journal
 * (unique hyphenless `dtt…` tag) and mutates license defaults /
 * publishing mode / SEO / archiving flags / payments ONLY there —
 * publicknowledge's distribution settings (open access + OAI on + no
 * default license) are load-bearing suite-wide and are NEVER touched.
 * The one site-level read (the /index/gateway/lockss all-journals list)
 * is read-only and only inspects OUR journal's entry. No Mailpit: no
 * form on this page emails, notifies or writes the event log (spec Side
 * effects). Fully parallel at the flat root.
 */

const MANAGER = 'dbarnes';

// Journal::PUBLISHING_MODE_{OPEN,SUBSCRIPTION,NONE}
const MODE_OPEN = '0';
const MODE_SUBSCRIPTION = '1';
const MODE_NONE = '2';

// The CC option values the License radio group offers
// (PKPApplication::getCCLicenseOptions() — no trailing slash).
const CC_BY = 'https://creativecommons.org/licenses/by/4.0';

// The CC badge footer text rendered on the landing page for CC_BY
// (submission.license.cc.by4.footer).
const CC_BY_BADGE_TEXT =
	'Creative Commons Attribution 4.0 International License';

// The gateway manifests' permission statements (gateway/{lockss,clockss}.tpl
// — deliberately unlocalized upstream).
const LOCKSS_PERMISSION =
	'LOCKSS system has permission to collect, preserve, and serve this Archival Unit';
const CLOCKSS_PERMISSION =
	'CLOCKSS system has permission to ingest, preserve, and serve this Archival Unit';

/** A unique, hyphenless, lowercased alphanumeric token (parallel + re-run isolation). */
function uniqueTag(prefix = 'dtt') {
	const workerIndex = test.info().parallelIndex;
	const rand = Math.random().toString(36).slice(2, 8);
	return `${prefix}${workerIndex}x${rand}`;
}

/** Seed a scratch journal (dbarnes as manager + spec passthrough) → context. */
async function seedJournal(pkpApi, tag, extra = {}) {
	const {context} = await pkpApi.createJournal({
		tag,
		users: [{username: MANAGER, roles: ['manager']}, ...(extra.users ?? [])],
		...Object.fromEntries(
			Object.entries(extra).filter(([k]) => k !== 'users'),
		),
	});
	return context;
}

/** Read the session CSRF token from a loaded backend page (window.pkp / meta). */
async function csrfToken(page) {
	await page.waitForFunction(
		() =>
			!!window.pkp?.currentUser?.csrfToken ||
			!!document.querySelector('meta[name="csrf-token"]'),
		null,
		{timeout: 15_000},
	);
	return page.evaluate(
		() =>
			window.pkp?.currentUser?.csrfToken ||
			document
				.querySelector('meta[name="csrf-token"]')
				?.getAttribute('content'),
	);
}

/** Read another context's CSRF token off the site-level profile page. */
const csrfCache = new WeakMap();
async function csrfFor(ctx) {
	if (csrfCache.has(ctx)) return csrfCache.get(ctx);
	const res = await ctx.request.get('/index.php/index/user/profile');
	const html = await res.text();
	const m = html.match(/name="csrf-token" content="([^"]+)"/);
	if (!m) throw new Error(`csrf meta tag not found (${res.url()})`);
	csrfCache.set(ctx, m[1]);
	return m[1];
}

/** GET the journal's settings JSON (manager session required). */
async function getContext(requestCtx, ctxPath, contextId) {
	const res = await requestCtx.get(
		`/index.php/${ctxPath}/api/v1/contexts/${contextId}`,
	);
	expect(res.ok(), `GET context ${res.status()}`).toBeTruthy();
	return res.json();
}

/** A fresh anonymous browser context (explicit empty storage state). */
async function newAnonContext(browser, baseURL) {
	return browser.newContext({
		baseURL,
		storageState: {cookies: [], origins: []},
	});
}

/** Open Settings → Distribution and wait for the (default) License tab. */
async function gotoDistribution(page, ctxPath) {
	await page.goto(`/index.php/${ctxPath}/management/settings/distribution`);
	await expect(
		page.getByRole('heading', {name: 'Distribution Settings'}),
	).toBeVisible({timeout: 15_000});
	const panel = page.locator('#license');
	await expect(panel.locator('form').first()).toBeVisible({timeout: 15_000});
	return panel;
}

/** Open a top-level Distribution tab (`#{id}-button`) → its panel. */
async function openTab(page, tabId) {
	await page.locator(`#${tabId}-button`).click();
	const panel = page.locator(`#${tabId}`);
	await expect(panel.locator('form').first()).toBeVisible({timeout: 15_000});
	return panel;
}

/**
 * Save a distribution pkp-form: Save click → its endpoint (the Vue form
 * tunnels PUT as POST + X-Http-Method-Override) → the Saved badge.
 * Returns the response so callers can assert the echoed settings.
 */
async function saveForm(page, panel, endpoint = /\/api\/v1\/contexts\/\d+/) {
	const [response] = await Promise.all([
		page.waitForResponse(
			(res) =>
				endpoint.test(res.url()) &&
				res.ok() &&
				['POST', 'PUT'].includes(res.request().method()),
			{timeout: 15_000},
		),
		panel
			.locator('form')
			.first()
			.getByRole('button', {name: 'Save', exact: true})
			.click(),
	]);
	await expect(
		panel.locator('[role="status"]', {hasText: 'Saved'}),
	).toBeVisible({timeout: 15_000});
	return response;
}

/**
 * A VoR-published submission in the scratch journal's issue — license
 * fields left EMPTY so the publish-time snapshot computes the journal
 * defaults (rule 3; mechanics owned by publication-license).
 */
function publishedSpec({tag, title, journal, issue, metadata = {}}) {
	return {
		tag,
		journal,
		submitter: 'atester',
		section: 'ART',
		locale: 'en',
		participants: [
			{user: MANAGER, role: 'manager', canChangeMetadata: true},
		],
		decisions: [
			{type: 'skipExternalReview', by: MANAGER},
			{type: 'sendToProduction', by: MANAGER},
		],
		publications: [
			{
				versionStage: 'VoR',
				metadata: {title: {en: title}, ...metadata},
				issue,
				published: true,
			},
		],
	};
}

/** GET a submission's publication as JSON (manager session). */
async function fetchPublication(page, ctxPath, submissionId, pubId) {
	const res = await page.request.get(
		`/index.php/${ctxPath}/api/v1/submissions/${submissionId}/publications/${pubId}`,
	);
	expect(res.ok(), `GET publication ${pubId}: ${res.status()}`).toBeTruthy();
	return res.json();
}

/** GET an issue as JSON (manager session — the issues API is role-gated). */
async function fetchIssue(page, ctxPath, issueId) {
	const res = await page.request.get(
		`/index.php/${ctxPath}/api/v1/issues/${issueId}`,
	);
	expect(res.ok(), `GET issue ${issueId}: ${res.status()}`).toBeTruthy();
	return res.json();
}

test.use({user: MANAGER});

test.describe('Distribution settings — license/SEO/access/archiving/payments', () => {
	// ── Scenario 1 — Journal license defaults flow into a published article ────
	// The manager sets Copyright Holder = Author and License = CC Attribution
	// 4.0 on the License tab and saves (one PUT to the journal-settings API).
	// A newly published submission snapshots the defaults: copyrightHolder =
	// the author string, licenseUrl = CC-BY, copyrightYear = the issue's
	// publish year (default issue basis). The public landing page renders the
	// CC badge and the "Copyright (c) <year> <author> (Author)" line (rule 3).
	test(
		'license defaults (Author + CC BY 4.0) snapshot onto a published article and its landing page',
		{tag: ['@smoke', '@regression']},
		async ({page, pkpApi, browser, baseURL}) => {
			test.slow();
			const tag = uniqueTag();
			const ctx = await seedJournal(pkpApi, tag, {
				primaryLocale: 'en',
				supportedLocales: ['en'],
				users: [{username: 'atester', roles: ['author']}],
				issues: [{volume: 1, number: 1, year: 2026, published: true}],
			});

			// The REAL License form (the page's default-active tab).
			const panel = await gotoDistribution(page, ctx.path);
			await panel
				.locator('input[name="copyrightHolderType"][value="author"]')
				.check();
			await panel.locator(`input[name="licenseUrl"][value="${CC_BY}"]`).check();
			const saveRes = await saveForm(page, panel);
			const echoed = await saveRes.json();
			expect(echoed.copyrightHolderType).toBe('author');
			expect(echoed.licenseUrl).toBe(CC_BY);

			// Publish a new submission with all license fields left empty —
			// the publish snapshot computes the journal defaults (rule 3).
			const {submission, publications} = await pkpApi.createSubmission(
				publishedSpec({
					tag,
					title: `License defaults ${tag}`,
					journal: ctx.path,
					issue: {volume: 1, number: 1, year: 2026},
				}),
			);
			const pub = await fetchPublication(
				page,
				ctx.path,
				submission.id,
				publications[0].id,
			);
			// Holder = the author string "<name> (Author)" (atester's record).
			expect(pub.copyrightHolder?.en).toBe('Author Tester (Author)');
			// License = the journal default CC-BY.
			expect(pub.licenseUrl).toBe(CC_BY);
			// Year = the ISSUE's publish year (default issue basis; the seeded
			// issue's datePublished is stamped today, so read it back).
			const issue = await fetchIssue(page, ctx.path, pub.issueId);
			const issueYear = String(issue.datePublished).slice(0, 4);
			expect(String(pub.copyrightYear)).toBe(issueYear);

			// The public landing page shows the CC badge + copyright line.
			const anon = await newAnonContext(browser, baseURL);
			const pub2 = await anon.newPage();
			await pub2.goto(
				`/index.php/${ctx.path}/article/view/${submission.id}`,
			);
			const licenseBlock = pub2.locator('.item.copyright');
			await expect(licenseBlock).toBeVisible();
			await expect(licenseBlock).toContainText(
				`Copyright (c) ${pub.copyrightYear} Author Tester (Author)`,
			);
			await expect(licenseBlock).toContainText(CC_BY_BADGE_TEXT);
			await anon.close();
		},
	);

	// ── Scenario 2 — Copyright-year basis: issue date vs article date ──────────
	// With the issue's publication date backdated to 2025 (through the REAL
	// back-issue grid form), an article published today under the default
	// "Use the issue's publication date" snapshots year 2025; the manager
	// flips the License tab's Copyright Year radio to "Use the article's
	// publication date" and a second article snapshots its own (current)
	// publish year (rule 4).
	test(
		'copyright-year basis discriminates: backdated issue year vs article publish year',
		{tag: '@regression'},
		async ({page, pkpApi}) => {
			test.slow();
			const tag = uniqueTag();
			const ctx = await seedJournal(pkpApi, tag, {
				primaryLocale: 'en',
				supportedLocales: ['en'],
				users: [{username: 'atester', roles: ['author']}],
				issues: [{volume: 1, number: 1, year: 2025, published: true}],
			});

			// The License form (needed later) + the session CSRF for the grid.
			const panel = await gotoDistribution(page, ctx.path);
			const csrf = await csrfToken(page);

			// Backdate the issue's publication DATE to 2025-03-01 through the
			// legacy back-issue grid's update-issue form (the manager's real
			// issue-edit path; the year LABEL alone does not drive the year).
			const issuesRes = await page.request.get(
				`/index.php/${ctx.path}/api/v1/issues?count=10`,
			);
			expect(issuesRes.ok()).toBeTruthy();
			const issueId = (await issuesRes.json()).items[0].id;
			const backdate = await page.request.post(
				`/index.php/${ctx.path}/$$$call$$$/grid/issues/back-issue-grid/update-issue`,
				{
					form: {
						csrfToken: csrf,
						issueId: String(issueId),
						volume: '1',
						number: '1',
						year: '2025',
						showVolume: '1',
						showNumber: '1',
						showYear: '1',
						datePublished: '2025-03-01',
					},
				},
			);
			expect(backdate.ok(), `update-issue ${backdate.status()}`).toBeTruthy();
			const backdated = await fetchIssue(page, ctx.path, issueId);
			expect(String(backdated.datePublished)).toMatch(/^2025-03-01/);

			// Article A published today under the DEFAULT issue basis → 2025.
			const a = await pkpApi.createSubmission(
				publishedSpec({
					tag: `${tag}a`,
					title: `Issue basis ${tag}`,
					journal: ctx.path,
					issue: {volume: 1, number: 1, year: 2025},
				}),
			);
			const pubA = await fetchPublication(
				page,
				ctx.path,
				a.submission.id,
				a.publications[0].id,
			);
			expect(String(pubA.copyrightYear)).toBe('2025');

			// Flip the basis on the REAL License form: the default "issue"
			// radio is pre-checked; select "submission" and save.
			await expect(
				panel.locator('input[name="copyrightYearBasis"][value="issue"]'),
			).toBeChecked();
			await panel
				.locator('input[name="copyrightYearBasis"][value="submission"]')
				.check();
			const saveRes = await saveForm(page, panel);
			expect((await saveRes.json()).copyrightYearBasis).toBe('submission');

			// Article B published today under the article basis → its own
			// publish year (today's), not the issue's 2025.
			const b = await pkpApi.createSubmission(
				publishedSpec({
					tag: `${tag}b`,
					title: `Article basis ${tag}`,
					journal: ctx.path,
					issue: {volume: 1, number: 1, year: 2025},
				}),
			);
			const pubB = await fetchPublication(
				page,
				ctx.path,
				b.submission.id,
				b.publications[0].id,
			);
			const articleYear = String(b.publications[0].datePublished).slice(0, 4);
			expect(String(pubB.copyrightYear)).toBe(articleYear);
			expect(String(pubB.copyrightYear)).not.toBe('2025');
		},
	);

	// ── Scenario 3 — SEO metadata reaches the reader pages ─────────────────────
	// The manager sets Description + a Custom Tag on Search Indexing. An
	// anonymous read finds <meta name="description"> on the journal homepage
	// — and ONLY there — while the custom tag lands verbatim in the <head>
	// of every journal page (rule 5).
	test(
		'search-indexing description hits the homepage head only; custom tag hits every page',
		{tag: '@regression'},
		async ({page, pkpApi, browser, baseURL}) => {
			test.slow();
			const tag = uniqueTag();
			const description = `Search engines read this ${tag}`;
			const customTag = `<meta name="dttprobe" content="${tag}">`;
			const ctx = await seedJournal(pkpApi, tag, {
				primaryLocale: 'en',
				supportedLocales: ['en'],
			});

			// The REAL Search Indexing form.
			await gotoDistribution(page, ctx.path);
			const panel = await openTab(page, 'indexing');
			await panel
				.locator('#searchIndexing-searchDescription-control-en')
				.fill(description);
			await panel
				.locator('#searchIndexing-customHeaders-control-en')
				.fill(customTag);
			const saveRes = await saveForm(page, panel);
			const echoed = await saveRes.json();
			expect(echoed.searchDescription.en).toBe(description);
			expect(echoed.customHeaders.en).toBe(customTag);

			// Anonymous <head> reads: description on the homepage…
			const anon = await newAnonContext(browser, baseURL);
			const homeHtml = await (
				await anon.request.get(`/index.php/${ctx.path}`)
			).text();
			expect(homeHtml).toContain(
				`<meta name="description" content="${description}"`,
			);
			expect(homeHtml).toContain(`name="dttprobe" content="${tag}"`);

			// …and NOT on another journal page, where the custom tag still
			// lands (issue archive — a public non-index page).
			const archiveHtml = await (
				await anon.request.get(`/index.php/${ctx.path}/issue/archive`)
			).text();
			expect(archiveHtml).not.toContain('<meta name="description"');
			expect(archiveHtml).toContain(`name="dttprobe" content="${tag}"`);
			await anon.close();
		},
	);

	// ── Scenario 4 — Publishing-mode lifecycle ─────────────────────────────────
	// A fresh journal shows NO mode selected and the site behaves open;
	// Subscription reveals the Delayed Open Access select (Disabled + 1–60 —
	// the CLIENT-side bound, ledger row 126) and saves both; "OJS will not
	// be used to publish" removes Current/Archives from the reader nav, the
	// current issue from the homepage and issues/articles from the sitemap,
	// and anonymous readers hitting issue/article URLs bounce to login while
	// the manager still sees them; returning to Open restores the reader
	// site (and the delayed-OA value survived, hidden not cleared).
	test(
		'publishing mode: unset behaves open, subscription reveals delayed OA, NONE gates readers, open restores',
		{tag: ['@smoke', '@regression']},
		async ({page, pkpApi, browser, baseURL}) => {
			test.slow();
			const tag = uniqueTag();
			const ctx = await seedJournal(pkpApi, tag, {
				primaryLocale: 'en',
				supportedLocales: ['en'],
				users: [{username: 'atester', roles: ['author']}],
				issues: [{volume: 1, number: 1, year: 2026, published: true}],
			});
			const {submission} = await pkpApi.createSubmission(
				publishedSpec({
					tag,
					title: `Mode probe ${tag}`,
					journal: ctx.path,
					issue: {volume: 1, number: 1, year: 2026},
				}),
			);

			// Baseline, anonymously: NO mode saved yet, the site behaves open —
			// reader pages serve, the homepage shows the current issue, the nav
			// offers Current/Archives, the sitemap lists issue + article URLs.
			const anon = await newAnonContext(browser, baseURL);
			const reader = await anon.newPage();
			const archiveRes = await anon.request.get(
				`/index.php/${ctx.path}/issue/archive`,
			);
			expect(archiveRes.status()).toBe(200);
			expect(archiveRes.url()).not.toMatch(/\/login/);
			await reader.goto(`/index.php/${ctx.path}`);
			await expect(reader.locator('.current_issue')).toBeVisible();
			const nav = reader.locator('#navigationPrimary');
			await expect(
				nav.getByRole('link', {name: 'Current', exact: true}),
			).toBeVisible();
			await expect(
				nav.getByRole('link', {name: 'Archives', exact: true}),
			).toBeVisible();
			let sitemap = await (
				await anon.request.get(`/index.php/${ctx.path}/sitemap`)
			).text();
			expect(sitemap).toContain('/issue/view/');
			expect(sitemap).toContain(`/article/view/${submission.id}`);

			// The Access form: a fresh journal has NO radio selected.
			await gotoDistribution(page, ctx.path);
			const panel = await openTab(page, 'access');
			await expect(
				panel.locator('input[name="publishingMode"]:checked'),
			).toHaveCount(0);

			// Subscription reveals the Delayed Open Access select: Disabled +
			// 1–60 months — the documented UI bound (row 126: client-only; no
			// server max is asserted anywhere in this suite). Save both.
			const delayed = panel.locator(
				'#access-delayedOpenAccessDuration-control',
			);
			await expect(delayed).toHaveCount(0);
			await panel
				.locator(`input[name="publishingMode"][value="${MODE_SUBSCRIPTION}"]`)
				.check();
			await expect(delayed).toBeVisible();
			const optionValues = await delayed
				.locator('option')
				.evaluateAll((opts) => opts.map((o) => /** @type {HTMLOptionElement} */ (o).value));
			expect(optionValues).toHaveLength(61);
			expect(optionValues[0]).toBe('0'); // Disabled
			expect(optionValues[1]).toBe('1');
			expect(optionValues[60]).toBe('60');
			await delayed.selectOption('12');
			let saveRes = await saveForm(page, panel);
			let echoed = await saveRes.json();
			expect(echoed.publishingMode).toBe(1);
			expect(echoed.delayedOpenAccessDuration).toBe(12);

			// "OJS will not be used to publish" — save mode NONE.
			await panel
				.locator(`input[name="publishingMode"][value="${MODE_NONE}"]`)
				.check();
			saveRes = await saveForm(page, panel);
			expect((await saveRes.json()).publishingMode).toBe(2);

			// Anonymous under NONE: the homepage still serves but drops the
			// current issue and the Current/Archives nav items…
			await reader.goto(`/index.php/${ctx.path}`);
			await expect(reader.locator('.current_issue')).toHaveCount(0);
			await expect(
				nav.getByRole('link', {name: 'Current', exact: true}),
			).toHaveCount(0);
			await expect(
				nav.getByRole('link', {name: 'Archives', exact: true}),
			).toHaveCount(0);
			// …the sitemap prunes every issue/article URL (search survives)…
			sitemap = await (
				await anon.request.get(`/index.php/${ctx.path}/sitemap`)
			).text();
			expect(sitemap).not.toContain('/issue/view/');
			expect(sitemap).not.toContain('/article/view/');
			expect(sitemap).toContain('/search');
			// …and issue/article URLs bounce anonymous readers to login
			// (OjsJournalMustPublishPolicy).
			const anonIssue = await anon.request.get(
				`/index.php/${ctx.path}/issue/archive`,
			);
			expect(anonIssue.url()).toMatch(/\/login/);
			const anonArticle = await anon.request.get(
				`/index.php/${ctx.path}/article/view/${submission.id}`,
			);
			expect(anonArticle.url()).toMatch(/\/login/);

			// The manager still sees published content (policy role bypass).
			const mgrIssue = await page.request.get(
				`/index.php/${ctx.path}/issue/archive`,
			);
			expect(mgrIssue.status()).toBe(200);
			expect(mgrIssue.url()).not.toMatch(/\/login/);
			const mgrArticle = await page.request.get(
				`/index.php/${ctx.path}/article/view/${submission.id}`,
			);
			expect(mgrArticle.status()).toBe(200);
			expect(mgrArticle.url()).not.toMatch(/\/login/);

			// Returning to Open restores the reader site…
			await panel
				.locator(`input[name="publishingMode"][value="${MODE_OPEN}"]`)
				.check();
			saveRes = await saveForm(page, panel);
			expect((await saveRes.json()).publishingMode).toBe(0);
			const restored = await anon.request.get(
				`/index.php/${ctx.path}/issue/archive`,
			);
			expect(restored.status()).toBe(200);
			expect(restored.url()).not.toMatch(/\/login/);
			await reader.goto(`/index.php/${ctx.path}`);
			await expect(reader.locator('.current_issue')).toBeVisible();

			// …and the delayed-OA duration survived the mode round-trip
			// (hidden while not in subscription mode, never cleared).
			const current = await getContext(page.request, ctx.path, ctx.id);
			expect(current.delayedOpenAccessDuration).toBe(12);
			await anon.close();
		},
	);

	// ── Scenario 5 — LOCKSS/CLOCKSS manifests go live with the flags ───────────
	// With the flags off, each gateway manifest URL 302s to the journal home
	// (not a 404). The manager enables both checkboxes on Archiving →
	// "LOCKSS and CLOCKSS" (whose labels link the live manifest pages); the
	// anonymous manifests then render the permission statement + the
	// published-issue list, and the site-level manifest lists the journal
	// (rule 9).
	test(
		'gateway manifests: 302 to home while off; public Publisher Manifest with issues when on',
		{tag: '@regression'},
		async ({page, pkpApi, browser, baseURL}) => {
			test.slow();
			const tag = uniqueTag();
			const name = `Dtt Preserved Journal ${tag}`;
			const ctx = await seedJournal(pkpApi, tag, {
				primaryLocale: 'en',
				supportedLocales: ['en'],
				name: {en: name},
				issues: [{volume: 1, number: 1, year: 2026, published: true}],
			});

			// Flags off: both manifests 302 to the journal home (not 404).
			const anon = await newAnonContext(browser, baseURL);
			for (const op of ['lockss', 'clockss']) {
				const res = await anon.request.get(
					`/index.php/${ctx.path}/gateway/${op}`,
					{maxRedirects: 0},
				);
				expect(res.status(), `${op} off → 302`).toBe(302);
				const location = res.headers()['location'] ?? '';
				expect(location).toContain(`/index.php/${ctx.path}`);
				expect(location).not.toContain('gateway');
			}

			// The REAL Archiving → "LOCKSS and CLOCKSS" side-tab form; the
			// checkbox labels embed this journal's manifest links.
			await gotoDistribution(page, ctx.path);
			await page.locator('#archive-button').click();
			await page.locator('#lockss-button').click();
			const panel = page.locator('#lockss');
			await expect(panel.locator('form').first()).toBeVisible({
				timeout: 15_000,
			});
			await expect(
				panel.locator(`a[href*="${ctx.path}/gateway/lockss"]`),
			).toBeVisible();
			await expect(
				panel.locator(`a[href*="${ctx.path}/gateway/clockss"]`),
			).toBeVisible();
			await panel.locator('input[name="enableLockss"]').check();
			await panel.locator('input[name="enableClockss"]').check();
			const saveRes = await saveForm(page, panel);
			const echoed = await saveRes.json();
			expect(echoed.enableLockss).toBe(true);
			expect(echoed.enableClockss).toBe(true);

			// The anonymous manifests render: permission statement + the
			// published-issue list for the latest year with issues.
			const lockssHtml = await (
				await anon.request.get(`/index.php/${ctx.path}/gateway/lockss`)
			).text();
			expect(lockssHtml).toContain(LOCKSS_PERMISSION);
			expect(lockssHtml).toContain('Archive of Published Issues');
			expect(lockssHtml).toContain('Vol. 1 No. 1');
			const clockssHtml = await (
				await anon.request.get(`/index.php/${ctx.path}/gateway/clockss`)
			).text();
			expect(clockssHtml).toContain(CLOCKSS_PERMISSION);
			expect(clockssHtml).toContain('Vol. 1 No. 1');

			// The site-level manifest lists every flag-on journal — ours now
			// appears, linking its own manifest (read-only site surface).
			const siteHtml = await (
				await anon.request.get('/index.php/index/gateway/lockss')
			).text();
			expect(siteHtml).toContain(name);
			expect(siteHtml).toContain(`/${ctx.path}/gateway/lockss`);
			await anon.close();
		},
	);

	// ── Scenario 6 — Payments enable + the settings boundary ───────────────────
	// The manager checks Enable on the Payments tab (Currency + Payment
	// Plugins appear), picks CAD + Manual Fee Payment and saves — one PUT to
	// the dedicated _payments endpoint; the manager-sidebar Payments entry
	// appears immediately, without a reload (rule 11). A section editor
	// requesting the Distribution page gets the standard settings denial and
	// their direct _payments PUT is refused with nothing changed (Area 6
	// gate + the payments endpoint's manager/admin-only middleware).
	test(
		'payments enable: currency/method appear, _payments PUT, sidebar entry injected; section editor denied',
		{tag: ['@smoke', '@regression']},
		async ({page, pkpApi, asUser}) => {
			test.slow();
			const tag = uniqueTag();
			const ctx = await seedJournal(pkpApi, tag, {
				primaryLocale: 'en',
				supportedLocales: ['en'],
				users: [{username: 'dbuskins', roles: ['sectionEditor']}],
			});

			// The REAL Payments form: Currency/Payment Plugins hidden until
			// Enable is checked (showWhen), no sidebar Payments entry yet.
			await gotoDistribution(page, ctx.path);
			const sidebar = page.locator('nav#app-nav');
			await expect(
				sidebar.getByRole('link', {name: 'Payments', exact: true}),
			).toHaveCount(0);
			const panel = await openTab(page, 'payments');
			const currency = panel.locator('#paymentSettings-currency-control');
			const method = panel.locator(
				'#paymentSettings-paymentPluginName-control',
			);
			await expect(currency).toHaveCount(0);
			await expect(method).toHaveCount(0);
			await panel.locator('input[name="paymentsEnabled"]').check();
			await expect(currency).toBeVisible();
			await expect(method).toBeVisible();
			await currency.selectOption('CAD');
			await method.selectOption({label: 'Manual Fee Payment'});

			// ONE save → the dedicated _payments endpoint (NOT the journal-
			// settings API), echoing the new settings.
			const saveRes = await saveForm(page, panel, /\/api\/v1\/_payments/);
			const echoed = await saveRes.json();
			expect(Boolean(echoed.paymentsEnabled)).toBe(true);
			expect(echoed.currency).toBe('CAD');
			expect(echoed.paymentPluginName).toBe('ManualPayment');

			// The sidebar gains the Payments entry immediately — no reload
			// (SettingsPage.vue injects it on form success).
			await expect(
				sidebar.getByRole('link', {name: 'Payments', exact: true}),
			).toBeVisible();

			// Persisted on the journal.
			const saved = await getContext(page.request, ctx.path, ctx.id);
			expect(saved.paymentsEnabled).toBe(true);
			expect(saved.currency).toBe('CAD');
			expect(saved.paymentPluginName).toBe('ManualPayment');

			// The boundary: a section editor is bounced off the Distribution
			// page (the Area 6 settings gate)…
			const seCtx = await asUser('dbuskins');
			const sePage = await seCtx.request.get(
				`/index.php/${ctx.path}/management/settings/distribution`,
			);
			expect(sePage.url()).toMatch(/authorizationDenied/);

			// …and refused on the _payments endpoint (manager/admin only),
			// with the stored settings unchanged.
			const sePut = await seCtx.request.put(
				`/index.php/${ctx.path}/api/v1/_payments`,
				{
					headers: {
						'X-Csrf-Token': await csrfFor(seCtx),
						'Content-Type': 'application/json',
					},
					data: {paymentsEnabled: false},
				},
			);
			expect(sePut.status(), 'section editor _payments PUT refused').toBe(401);
			const after = await getContext(page.request, ctx.path, ctx.id);
			expect(after.paymentsEnabled, 'unchanged by the refusal').toBe(true);
		},
	);
});
