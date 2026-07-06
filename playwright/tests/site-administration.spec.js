// @ts-check
const fs = require('fs');
const path = require('path');
const {execFileSync} = require('child_process');
const {test, expect} = require('../support/fixtures.js');
const {AdminContextsPage} = require('../pages/AdminContextsPage.js');
const {LoginPage} = require('../../lib/pkp/playwright/pages/LoginPage.js');
const {setTinyMceContent} = require('../../lib/pkp/playwright/support/tinymce.js');
const {
	waitForJQueryIdle,
} = require('../../lib/pkp/playwright/support/jquery.js');

/**
 * Site administration (hosted journals) — the site admin's journal
 * roster: the Administration index, the Hosted Journals grid
 * (create / edit / reorder / delete / enable), the per-journal Settings
 * Wizard, and multi-journal navigation (site index + backend Journals
 * switcher). One test per canonical scenario of
 * docs/product/specs/site-administration.md (7 scenarios → 7 tests, 1:1).
 *
 * PARALLEL + ISOLATION (hard rules of this campaign):
 *   - Every journal this suite creates carries a UNIQUE hyphenless
 *     `admt…` path and is DELETED in a `finally` (via the admin-only
 *     site-level DELETE contexts/{id}) — an enabled scratch journal left
 *     behind would pollute the shared site index for other workers.
 *   - SITE-INDEX-SET assertions are scoped to this test's OWN journal
 *     (its unique path/name appears/disappears) — NEVER the exact full
 *     journal set, which races with other workers' scratch journals.
 *     NB with exactly ONE enabled journal the site index auto-redirects
 *     to it (PKPHandler::getTargetContext) — the contains/not-contains
 *     probes hold on both the list page and the redirected journal home.
 *   - publicknowledge is never disabled, deleted, edited or reordered
 *     ABOVE anything (test 5 reorders the suite's own two journals
 *     relative to each other only; saveSequence re-writes seq values but
 *     preserves every other journal's relative order).
 *   - NO shared seeded user is enrolled anywhere new. admin is the
 *     inherently site-global actor; dbarnes (manager of publicknowledge)
 *     supplies the permission boundary READ-ONLY; multi-journal switcher
 *     actors are DEDICATED throwaway users on the suite's own journals.
 *   - Switcher assertions open the header dropdown first (its content is
 *     v-if'd out of the DOM until opened) and check only this test's
 *     journals (+ publicknowledge absence for throwaways).
 *
 * KNOWN LEDGER ROWS asserted AS-BUILT:
 *   - ⚠ Row 153 (test 2): the Create Journal modal cannot be submitted
 *     with the Country select untouched — the server 400s with "This is
 *     not a valid string." although the field carries no required mark.
 *   - ⚠ Row 120 (test 7): POST contexts enforces no schema-required
 *     props — a nameless journal is created, and the DB default makes it
 *     enabled:true, listed blank (by path) on the public site index.
 *     (Deleted right after; the UI's own default is disabled — test 2.)
 *   - ⚠ Row 154 (test 6): deleting a journal orphans its two provisioned
 *     contributor_roles rows — asserted as the one surviving residue of
 *     the cascade. (These orphans are app behavior, not test leakage.)
 *   - Row 118 (manager PUT of admin-only props) is owned/driven by
 *     site-access-restrictions — referenced, not re-driven.
 *
 * DB READS: read-only psql against the shared Postgres test DB pins the
 * provisioning bundle (rule 3) and the delete cascade (rule 8) — the
 * spec's own live-verified counts.
 *
 * AUTH: test.use admin — the site administrator is the only legitimate
 * actor. Public reads use explicit empty-state anonymous contexts.
 */

const REFUSAL = 'The current role does not have access to this operation.';
const SITE_CONTEXTS_API = '/index.php/index/api/v1/contexts';

test.use({user: 'admin'});

/** Unique hyphenless alphanumeric tag; doubles as the scratch urlPath. */
function uniqueTag(prefix = 'admt') {
	const workerLetter = String.fromCharCode(
		97 + (test.info().parallelIndex % 26),
	);
	let suffix = '';
	while (suffix.length < 6) {
		suffix += Math.random().toString(36).replace(/[^a-z0-9]/g, '');
	}
	return `${prefix}${workerLetter}${suffix.slice(0, 6)}`;
}

/** Read the session CSRF token from a loaded backend page. */
async function csrfToken(page) {
	await page.waitForFunction(
		() =>
			// @ts-ignore pkp global
			!!window.pkp?.currentUser?.csrfToken ||
			!!document.querySelector('meta[name="csrf-token"]'),
		null,
		{timeout: 15_000},
	);
	return page.evaluate(
		() =>
			// @ts-ignore pkp global
			window.pkp?.currentUser?.csrfToken ||
			document
				.querySelector('meta[name="csrf-token"]')
				?.getAttribute('content'),
	);
}

/** Read a context's CSRF token off the site-level profile page. */
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

/** A fresh anonymous browser context (explicit empty storage state). */
async function newAnonContext(browser, baseURL) {
	return browser.newContext({
		baseURL,
		storageState: {cookies: [], origins: []},
	});
}

/**
 * The public site index HTML, read anonymously (follows the locale — and,
 * when only one journal is enabled, the single-journal — redirect; both
 * final pages are valid surfaces for the scoped contains/not-contains
 * probes this suite makes).
 */
async function siteIndexHtml(anon) {
	const res = await anon.request.get('/index.php/index/en');
	expect(res.ok(), `site index ${res.status()}`).toBeTruthy();
	return res.text();
}

/** POST a journal through the admin-only site-level contexts API. */
async function apiCreate(requestCtx, csrf, data) {
	return requestCtx.post(SITE_CONTEXTS_API, {
		headers: {'X-Csrf-Token': csrf, 'Content-Type': 'application/json'},
		data,
	});
}

/** DELETE a journal through the admin-only site-level contexts API. */
async function apiDelete(requestCtx, csrf, id) {
	return requestCtx.delete(`${SITE_CONTEXTS_API}/${id}`, {
		headers: {'X-Csrf-Token': csrf},
	});
}

/**
 * `finally`-safe scratch-journal removal: tolerate an id that was never
 * assigned (early failure) or a journal already deleted by the test body.
 */
async function cleanupJournal(requestCtx, csrf, id) {
	if (!csrf || !id) return;
	const res = await apiDelete(requestCtx, csrf, id);
	expect(
		[200, 404].includes(res.status()),
		`scratch journal ${id} cleaned (${res.status()})`,
	).toBeTruthy();
}

/** The full valid create payload the admin API/service expects. */
function createPayload(tag, overrides = {}) {
	return {
		name: {en: `Journal ${tag}`},
		acronym: {en: tag.slice(-6).toUpperCase()},
		contactName: `Contact ${tag}`,
		contactEmail: `${tag}@example.test`,
		country: 'CA',
		urlPath: tag,
		supportedLocales: ['en'],
		primaryLocale: 'en',
		enabled: false,
		...overrides,
	};
}

/** Seed a scratch journal via the test scenario API (enabled, en-only). */
async function seedJournal(pkpApi, tag, users = []) {
	const {context} = await pkpApi.createJournal({
		tag,
		path: tag,
		name: {en: `Journal ${tag}`},
		// Without an acronym the grid Edit modal is un-saveable — the
		// client-side required mark on Journal initials blocks the form
		// (the schema itself is lenient: row 119's acronym gap).
		acronym: {en: tag.slice(-6).toUpperCase()},
		primaryLocale: 'en',
		supportedLocales: ['en'],
		users,
	});
	return context;
}

/** Read-only query against the shared Postgres test DB (psql -tAc). */
function dbQuery(sql) {
	return execFileSync(
		'psql',
		[
			'-h', process.env.OJS_DB_HOST || 'localhost',
			'-U', process.env.OJS_DB_USER || process.env.USER || 'postgres',
			'-d', process.env.OJS_DB_NAME || 'ojs_test',
			'-tAc', sql,
		],
		{
			encoding: 'utf8',
			env: {...process.env, PGPASSWORD: process.env.OJS_DB_PASSWORD || ''},
		},
	).trim();
}

/**
 * Labelled per-table counts for a journal id, as one UNION ALL query →
 * {label: count}. Labels/tables mirror the spec's rule-3/rule-8 lists.
 */
function dbJournalCounts(id) {
	const n = Number(id);
	const out = dbQuery(
		`SELECT 'journals', count(*) FROM journals WHERE journal_id=${n}` +
			` UNION ALL SELECT 'sections', count(*) FROM sections WHERE journal_id=${n}` +
			` UNION ALL SELECT 'genres', count(*) FROM genres WHERE context_id=${n}` +
			` UNION ALL SELECT 'user_groups', count(*) FROM user_groups WHERE context_id=${n}` +
			` UNION ALL SELECT 'navigation_menus', count(*) FROM navigation_menus WHERE context_id=${n}` +
			` UNION ALL SELECT 'contributor_roles', count(*) FROM contributor_roles WHERE context_id=${n}` +
			` UNION ALL SELECT 'reviewer_recommendations', count(*) FROM reviewer_recommendations WHERE context_id=${n}`,
	);
	const counts = {};
	for (const line of out.split('\n')) {
		const [label, value] = line.split('|');
		counts[label] = Number(value);
	}
	return counts;
}

/** The journal's on-disk files tree (OJS_FILES_DIR is repo-root-relative). */
function journalFilesDir(id) {
	return path.resolve(
		__dirname,
		'../..',
		process.env.OJS_FILES_DIR || '../files-test',
		'journals',
		String(id),
	);
}

/** Open the backend header's Journals switcher; returns its link list. */
async function openSwitcher(page) {
	const switcher = page.locator('.app__contexts');
	await expect(switcher).toBeVisible({timeout: 15_000});
	await switcher.locator('button').first().click();
	const links = switcher.locator('a.pkpDropdown__action');
	await expect(links.first()).toBeVisible({timeout: 10_000});
	return links;
}

test.describe('Site administration — hosted journals', () => {
	// ── Scenario 1 — Admin reaches the roster; a manager is refused ────────
	// The admin's left nav carries Administration → the index page's Site
	// Management panel links Hosted Journals + Site Settings (maintenance
	// panels owned by site-maintenance); the grid lists publicknowledge
	// with name + path and Edit / Remove / Settings wizard row actions
	// under Create Journal / Order top actions. dbarnes (journal manager):
	// no Administration nav entry, the access-denied page on index /
	// contexts / wizard, and 401 on every site-level contexts API call
	// (GET, enabled-only GET, POST, DELETE — with a valid session CSRF, so
	// the refusal is the role gate, not the CSRF middleware).
	test(
		'admin index + hosted journals grid anatomy; manager refused on pages, API and nav',
		{tag: ['@smoke', '@regression']},
		async ({page, asUser}) => {
			test.slow();

			// The admin's backend nav carries the Administration entry.
			await page.goto('/index.php/publicknowledge/dashboard/editorial');
			const nav = page.locator('nav#app-nav');
			const adminLink = nav.getByRole('link', {name: 'Administration'});
			await expect(adminLink).toBeVisible({timeout: 20_000});
			await adminLink.click();

			// Administration index: heading + the Site Management panel's two
			// buttons (the system panels belong to site-maintenance).
			await expect(
				page.getByRole('heading', {name: 'Administration', level: 1}),
			).toBeVisible({timeout: 15_000});
			await expect(
				page.getByRole('heading', {name: 'Site Management'}),
			).toBeVisible();
			await expect(
				page.getByRole('link', {name: 'Site Settings'}),
			).toBeVisible();
			const hostedLink = page.getByRole('link', {name: 'Hosted Journals'});
			await expect(hostedLink).toBeVisible();
			await hostedLink.click();

			// Hosted Journals grid: publicknowledge row (name + path cells),
			// Create Journal + Order top actions, Edit / Remove / Settings
			// wizard row actions (opened read-only — nothing clicked).
			const admin = new AdminContextsPage(page);
			await expect(admin.gridContainer).toBeVisible({timeout: 15_000});
			await waitForJQueryIdle(page);
			const pkRow = admin.rowFor('publicknowledge');
			await expect(pkRow).toBeVisible();
			await expect(pkRow).toContainText('Journal of Public Knowledge');
			await expect(
				admin.gridContainer.locator('a[id*="-createContext-button-"]'),
			).toBeVisible();
			await expect(
				admin.gridContainer.locator('a[id*="-orderItems-button-"]'),
			).toBeVisible();
			for (const action of ['edit', 'delete', 'wizard']) {
				await expect(await admin.rowAction(pkRow, action)).toBeVisible();
			}

			// The manager boundary: dbarnes — READ-ONLY probes only.
			const mgr = await asUser('dbarnes');
			const mgrPage = await mgr.newPage();
			await mgrPage.goto('/index.php/publicknowledge/dashboard/editorial');
			const mgrNav = mgrPage.locator('nav#app-nav');
			await expect(mgrNav.getByText('Settings', {exact: true})).toBeVisible({
				timeout: 20_000,
			});
			await expect(
				mgrNav.getByText('Administration', {exact: true}),
			).toHaveCount(0);

			// Every admin PAGE refuses him.
			for (const url of [
				'/index.php/index/admin',
				'/index.php/index/admin/contexts',
				'/index.php/index/admin/wizard/1',
			]) {
				const res = await mgr.request.get(url);
				expect(await res.text(), `${url} refused`).toContain(REFUSAL);
			}

			// Every site-level contexts API call → 401 (valid session CSRF,
			// so the refusal is the role gate; the DELETE probe targets a
			// nonexistent id — authorization runs before existence).
			const mgrCsrf = await csrfFor(mgr);
			const getAll = await mgr.request.get(SITE_CONTEXTS_API);
			expect(getAll.status(), 'manager GET contexts → 401').toBe(401);
			const getEnabled = await mgr.request.get(
				`${SITE_CONTEXTS_API}?isEnabled=true`,
			);
			expect(getEnabled.status(), 'manager enabled-only GET → 401').toBe(401);
			const post = await apiCreate(mgr.request, mgrCsrf, {
				urlPath: uniqueTag() + 'x',
			});
			expect(post.status(), 'manager POST contexts → 401').toBe(401);
			const del = await apiDelete(mgr.request, mgrCsrf, 99999999);
			expect(del.status(), 'manager DELETE contexts → 401').toBe(401);
		},
	);

	// ── Scenario 2 — Create a journal end-to-end ───────────────────────────
	// The real Create Journal modal: every *-marked field filled (title,
	// initials, abbreviation, contacts, description, path, languages +
	// primary), Enable left unchecked, Country left untouched → the save
	// 400s with "This is not a valid string." (⚠ row 153's as-built toll,
	// no required mark on the field). Picking a Country lets the same
	// modal through → redirect to the new journal's Settings Wizard. DB
	// pins the full provisioning bundle (rule 3) incl. the admin's
	// auto-enrollment as Journal manager; the grid lists it; disabled →
	// absent from the public site index and anonymous visitors bounce to
	// its login page.
	test(
		'create journal: row-153 country toll, wizard landing, full provisioning, disabled by default',
		{tag: ['@smoke', '@regression']},
		async ({page, browser, baseURL}) => {
			test.slow();
			const tag = uniqueTag();
			const admin = new AdminContextsPage(page);
			await admin.goto();
			const csrf = await csrfToken(page);
			let id;
			try {
				const form = await admin.openCreateForm();
				await form.locator('input[name="name-en"]').fill(`Journal ${tag}`);
				await form
					.locator('input[name="acronym-en"]')
					.fill(tag.slice(-6).toUpperCase());
				await form.locator('input[name="abbreviation-en"]').fill(`J${tag}`);
				await form.locator('input[name="contactName"]').fill(`Contact ${tag}`);
				await form
					.locator('input[name="contactEmail"]')
					.fill(`${tag}@example.test`);
				await setTinyMceContent(
					page,
					'context-description-control-en',
					`<p>Description ${tag}</p>`,
				);
				await form.locator('input[name="urlPath"]').fill(tag);
				// Languages block renders because the site has 2 locales:
				// roster limited to site locales; primary must be checked.
				await form
					.locator('input[name="supportedLocales"][value="en"]')
					.check();
				await form.locator('input[name="primaryLocale"][value="en"]').check();
				// Enable stays UNCHECKED — a new journal starts hidden (rule 7).
				await expect(form.locator('input[name="enabled"]')).not.toBeChecked();

				// ⚠ Row 153: Country untouched (no blank option to return to,
				// no required mark) → the save is refused with the schema's
				// string error, surfaced inline on the field.
				const [refused] = await Promise.all([
					page.waitForResponse(
						(r) =>
							r.url().split('?')[0].endsWith('/api/v1/contexts') &&
							r.request().method() === 'POST',
						{timeout: 30_000},
					),
					form.getByRole('button', {name: 'Save', exact: true}).click(),
				]);
				expect(refused.status(), 'row 153: country blocks create').toBe(400);
				expect(await refused.json()).toMatchObject({
					country: expect.arrayContaining(['This is not a valid string.']),
				});
				await expect(
					form.getByText('This is not a valid string.').first(),
				).toBeVisible();

				// Pick a Country → the same modal saves and the browser lands
				// on the new journal's Settings Wizard (rule 2).
				await form.locator('select[name="country"]').selectOption('CA');
				await form.getByRole('button', {name: 'Save', exact: true}).click();
				await page.waitForURL(/\/admin\/wizard\/\d+/, {timeout: 60_000});
				await expect(
					page.getByRole('heading', {name: 'Settings Wizard', level: 1}),
				).toBeVisible({timeout: 15_000});
				id = parseInt(
					// @ts-ignore matched by waitForURL above
					page.url().match(/\/admin\/wizard\/(\d+)/)[1],
					10,
				);

				// Rule 3 — the provisioning bundle, pinned in the DB (the
				// spec's live-verified counts) + the admin's auto-enrollment.
				const counts = dbJournalCounts(id);
				expect(counts).toEqual({
					journals: 1,
					sections: 1,
					genres: 12,
					user_groups: 18,
					navigation_menus: 2,
					contributor_roles: 2,
					reviewer_recommendations: 6,
				});
				expect(
					dbQuery(
						`SELECT ss.setting_value FROM section_settings ss` +
							` JOIN sections s ON s.section_id = ss.section_id` +
							` WHERE s.journal_id = ${id}` +
							` AND ss.setting_name = 'title' AND ss.locale = 'en'`,
					),
				).toBe('Articles');
				expect(
					Number(
						dbQuery(
							`SELECT count(*) FROM user_groups ug` +
								` JOIN user_user_groups uug ON ug.user_group_id = uug.user_group_id` +
								` JOIN users u ON u.user_id = uug.user_id` +
								` WHERE ug.context_id = ${id} AND ug.role_id = 16` +
								` AND u.username = 'admin'`,
						),
					),
					'creating admin auto-enrolled as Journal manager',
				).toBe(1);

				// The grid lists the new journal (name + path).
				await admin.goto();
				await expect(admin.rowFor(tag)).toBeVisible();
				await expect(admin.rowFor(tag)).toContainText(`Journal ${tag}`);

				// Enable unchecked → not on the public site index; anonymous
				// visitors to the journal bounce to its login page.
				const anon = await newAnonContext(browser, baseURL);
				try {
					expect(await siteIndexHtml(anon)).not.toContain(tag);
					const bounce = await anon.request.get(`/index.php/${tag}`, {
						maxRedirects: 0,
					});
					expect(bounce.status()).toBe(302);
					expect(bounce.headers()['location']).toContain(`/${tag}/login`);
				} finally {
					await anon.close();
				}
			} finally {
				await cleanupJournal(page.request, csrf, id);
			}
		},
	);

	// ── Scenario 3 — Enable and staff the new journal ──────────────────────
	// A journal created through the admin site-level API (same service
	// path as the modal, enabled:false) is enabled on the wizard's Journal
	// form → it appears on the installation front page and its home serves
	// anonymously. The wizard's Users tab lists the auto-enrolled admin
	// and offers Add User; the backend Journals switcher now offers the
	// journal, deep-linking the admin to the SAME page on switch-safe
	// pages (rule 10).
	test(
		'enable via wizard Journal form: site index + Users tab + switcher deep-link',
		{tag: ['@smoke', '@regression']},
		async ({page, browser, baseURL}) => {
			test.slow();
			const tag = uniqueTag();
			await page.goto('/index.php/index/admin/contexts');
			const csrf = await csrfToken(page);
			let id;
			try {
				const created = await apiCreate(
					page.request,
					csrf,
					createPayload(tag),
				);
				expect(created.status(), 'admin POST contexts → 200').toBe(200);
				const journal = await created.json();
				id = journal.id;
				expect(journal.enabled).toBe(false);

				// The Settings Wizard's Journal form: tick Enable, save (one
				// PUT to the journal-scoped contexts API), Saved badge.
				await page.goto(`/index.php/index/admin/wizard/${id}`);
				await expect(
					page.getByRole('heading', {name: 'Settings Wizard', level: 1}),
				).toBeVisible({timeout: 20_000});
				const journalPanel = page.locator('#context');
				const enabledBox = journalPanel.locator('input[name="enabled"]');
				await expect(enabledBox).toBeVisible({timeout: 20_000});
				await expect(enabledBox).not.toBeChecked();
				await enabledBox.check();
				const [saved] = await Promise.all([
					page.waitForResponse(
						(r) =>
							r.url().split('?')[0].endsWith(`/api/v1/contexts/${id}`) &&
							['PUT', 'POST'].includes(r.request().method()),
						{timeout: 30_000},
					),
					journalPanel
						.locator('form')
						.first()
						.getByRole('button', {name: 'Save', exact: true})
						.click(),
				]);
				expect(saved.status()).toBe(200);
				expect((await saved.json()).enabled).toBe(true);
				await expect(
					journalPanel.locator('[role="status"]', {hasText: 'Saved'}),
				).toBeVisible({timeout: 15_000});

				// Public side: listed on the front page (own entry only —
				// other workers' journals may coexist), home serves anon.
				const anon = await newAnonContext(browser, baseURL);
				try {
					const html = await siteIndexHtml(anon);
					expect(html).toContain(`Journal ${tag}`);
					expect(html).toContain(`/${tag}`);
					const home = await anon.request.get(`/index.php/${tag}`);
					expect(home.status()).toBe(200);
				} finally {
					await anon.close();
				}

				// Users tab: the auto-enrolled admin is the first user; Add
				// User is the staffing affordance (grid rules owned by
				// user-management).
				await page.locator('#users-button').click();
				const userGrid = page.locator('#userGridContainer');
				await expect(
					userGrid.locator('a[id*="-addUser-button-"]'),
				).toBeVisible({timeout: 20_000});
				await expect(userGrid).toContainText('admin');

				// The switcher offers the journal, deep-linked to the SAME
				// page from a switch-safe page (management).
				await page.goto(
					'/index.php/publicknowledge/management/settings/context',
				);
				const links = await openSwitcher(page);
				const target = links.filter({hasText: `Journal ${tag}`});
				await expect(target).toBeVisible();
				expect(await target.getAttribute('href')).toMatch(
					new RegExp(`/${tag}/(en/)?management/settings/context`),
				);
			} finally {
				await cleanupJournal(page.request, csrf, id);
			}
		},
	);

	// ── Scenario 4 — Edit identity and path ────────────────────────────────
	// Grid row → Edit: renaming name + path applies immediately (old URL
	// 404s, the journal serves under the new slug — rule 6); the same
	// modal flips Enable off, dropping the journal from the site index
	// while it stays manageable in the grid (rule 7).
	test(
		'edit modal: path rename re-homes instantly; Enable off drops the index entry, grid keeps it',
		{tag: '@regression'},
		async ({page, pkpApi, browser, baseURL}) => {
			test.slow();
			const tagA = uniqueTag();
			const tagB = uniqueTag();
			const ctx = await seedJournal(pkpApi, tagA);
			await page.goto('/index.php/index/admin/contexts');
			const csrf = await csrfToken(page);
			const anon = await newAnonContext(browser, baseURL);
			try {
				// Baseline: the seeded journal is enabled and serves.
				expect((await anon.request.get(`/index.php/${tagA}`)).status()).toBe(
					200,
				);

				const admin = new AdminContextsPage(page);
				await admin.goto();
				let form = await admin.openEditForm(tagA);
				await expect(form.locator('input[name="urlPath"]')).toHaveValue(tagA);
				await form
					.locator('input[name="name-en"]')
					.fill(`Renamed Journal ${tagB}`);
				await form.locator('input[name="urlPath"]').fill(tagB);
				const [saved] = await Promise.all([
					page.waitForResponse(
						(r) =>
							r.url().split('?')[0].endsWith(`/api/v1/contexts/${ctx.id}`) &&
							['PUT', 'POST'].includes(r.request().method()),
						{timeout: 30_000},
					),
					form.getByRole('button', {name: 'Save', exact: true}).click(),
				]);
				expect(saved.status()).toBe(200);
				const echoed = await saved.json();
				expect(echoed.urlPath).toBe(tagB);
				expect(echoed.name.en).toBe(`Renamed Journal ${tagB}`);

				// Rule 6: the rename re-homes instantly — old path 404, new
				// path serving, and the site index carries the new slug only.
				expect(
					(await anon.request.get(`/index.php/${tagA}`)).status(),
					'old path 404s',
				).toBe(404);
				expect(
					(await anon.request.get(`/index.php/${tagB}`)).status(),
					'new path serves',
				).toBe(200);
				let html = await siteIndexHtml(anon);
				expect(html).toContain(tagB);
				expect(html).not.toContain(tagA);

				// Fresh grid: the row shows the new identity, the old is gone.
				await admin.goto();
				await expect(admin.rowFor(tagB)).toBeVisible();
				await expect(
					admin.gridContainer.locator('tr.gridRow', {hasText: tagA}),
				).toHaveCount(0);

				// Same modal, Enable off → off the index, still in the grid.
				form = await admin.openEditForm(tagB);
				const enabledBox = form.locator('input[name="enabled"]');
				await expect(enabledBox).toBeChecked();
				await enabledBox.uncheck();
				const [disabled] = await Promise.all([
					page.waitForResponse(
						(r) =>
							r.url().split('?')[0].endsWith(`/api/v1/contexts/${ctx.id}`) &&
							['PUT', 'POST'].includes(r.request().method()),
						{timeout: 30_000},
					),
					form.getByRole('button', {name: 'Save', exact: true}).click(),
				]);
				expect(disabled.status()).toBe(200);
				expect((await disabled.json()).enabled).toBe(false);

				html = await siteIndexHtml(anon);
				expect(html, 'disabled journal off the site index').not.toContain(
					tagB,
				);
				await admin.goto();
				await expect(
					admin.rowFor(tagB),
					'disabled journal stays in the grid',
				).toBeVisible();
			} finally {
				await anon.close();
				await cleanupJournal(page.request, csrf, ctx.id);
			}
		},
	);

	// ── Scenario 5 — Reorder the front page ────────────────────────────────
	// Order → drag the suite's OWN second journal above its first → Done;
	// the sequence persists (DB) and the public site index re-lists the
	// two in the new relative order. Only the two scratch rows' RELATIVE
	// order is asserted — the full set/order races with other workers.
	test(
		'reorder: drag + Done persists sequence; site index follows',
		{tag: '@regression'},
		async ({page, pkpApi, browser, baseURL}) => {
			test.slow();
			const tagA = uniqueTag();
			const tagB = uniqueTag();
			const ctxA = await seedJournal(pkpApi, tagA);
			const ctxB = await seedJournal(pkpApi, tagB);
			await page.goto('/index.php/index/admin/contexts');
			const csrf = await csrfToken(page);
			const anon = await newAnonContext(browser, baseURL);
			try {
				// Baseline: created-in order — A before B, on the index too.
				const before = await siteIndexHtml(anon);
				expect(before.indexOf(`/${tagA}`)).toBeGreaterThan(-1);
				expect(before.indexOf(`/${tagA}`)).toBeLessThan(
					before.indexOf(`/${tagB}`),
				);

				const admin = new AdminContextsPage(page);
				await admin.goto();
				const rowIdA = `component-grid-admin-context-contextgrid-row-${ctxA.id}`;
				const rowIdB = `component-grid-admin-context-contextgrid-row-${ctxB.id}`;

				// Drag B above A (jQuery-UI sortable needs real mouse walks;
				// retried — the sortable occasionally ignores a walk).
				let reordered = false;
				for (let attempt = 0; attempt < 3 && !reordered; attempt++) {
					await admin.startOrdering();
					await admin.dragRowAbove(
						page.locator(`tr#${rowIdB}`),
						page.locator(`tr#${rowIdA}`),
					);
					await admin.finishOrdering();
					const ids = await admin.rowIdsInOrder();
					reordered =
						ids.includes(rowIdA) &&
						ids.includes(rowIdB) &&
						ids.indexOf(rowIdB) < ids.indexOf(rowIdA);
				}
				expect(reordered, 'grid re-lists B above A').toBe(true);

				// Sequence persisted…
				const seqs = dbQuery(
					`SELECT journal_id, seq FROM journals` +
						` WHERE journal_id IN (${ctxA.id}, ${ctxB.id})`,
				)
					.split('\n')
					.map((l) => l.split('|').map(Number));
				const seqOf = Object.fromEntries(seqs);
				expect(seqOf[ctxB.id]).toBeLessThan(seqOf[ctxA.id]);

				// …and the public site index re-lists in the new order.
				const after = await siteIndexHtml(anon);
				expect(after.indexOf(`/${tagB}`)).toBeGreaterThan(-1);
				expect(after.indexOf(`/${tagB}`)).toBeLessThan(
					after.indexOf(`/${tagA}`),
				);
			} finally {
				await anon.close();
				await cleanupJournal(page.request, csrf, ctxA.id);
				await cleanupJournal(page.request, csrf, ctxB.id);
			}
		},
	);

	// ── Scenario 6 — Delete a journal ──────────────────────────────────────
	// Grid row → Remove → the confirmation names the journal and warns
	// "and all of its contents"; after OK the journal, its content tables,
	// role groups + every user's assignment in them, and its files tree
	// are gone while user accounts survive; grid, site index and switcher
	// no longer show it. ⚠ Row 154: the two provisioned contributor_roles
	// rows are the one as-built residue.
	test(
		'delete: confirmation, full cascade (DB + files), user accounts survive; row-154 residue',
		{tag: '@regression'},
		async ({page, pkpApi, browser, baseURL}) => {
			test.slow();
			const tag = uniqueTag();
			const throwaway = `us${tag}`;
			const ctx = await seedJournal(pkpApi, tag, [
				{username: throwaway, password: throwaway + throwaway, roles: ['author']},
			]);
			await page.goto('/index.php/index/admin/contexts');
			const csrf = await csrfToken(page);
			let deleted = false;
			try {
				// Snapshot: provisioned world + the throwaway's assignment +
				// the on-disk files tree.
				const before = dbJournalCounts(ctx.id);
				expect(before.journals).toBe(1);
				expect(before.sections).toBe(1);
				expect(before.user_groups).toBe(18);
				const groupIds = dbQuery(
					`SELECT string_agg(user_group_id::text, ',')` +
						` FROM user_groups WHERE context_id = ${ctx.id}`,
				);
				expect(groupIds.length).toBeGreaterThan(0);
				expect(
					Number(
						dbQuery(
							`SELECT count(*) FROM user_user_groups uug` +
								` JOIN users u ON u.user_id = uug.user_id` +
								` WHERE u.username = '${throwaway}'` +
								` AND uug.user_group_id IN (${groupIds})`,
						),
					),
					'throwaway enrolled before delete',
				).toBe(1);
				expect(fs.existsSync(journalFilesDir(ctx.id))).toBe(true);

				// Grid → Remove → the confirmation names the journal + warns.
				const admin = new AdminContextsPage(page);
				await admin.goto();
				const row = admin.rowFor(tag);
				const removeLink = await admin.rowAction(row, 'delete');
				await removeLink.click();
				const dialog = page.locator('[role="dialog"]', {
					hasText: 'permanently delete',
				});
				await expect(dialog).toBeVisible({timeout: 15_000});
				await expect(dialog).toContainText(`Journal ${tag}`);
				await expect(dialog).toContainText('all of its contents');
				const [delRes] = await Promise.all([
					page.waitForResponse(
						(r) => r.url().includes('delete-context') && r.ok(),
						{timeout: 60_000},
					),
					dialog.getByRole('button', {name: 'OK', exact: true}).click(),
				]);
				expect(delRes.status()).toBe(200);
				deleted = true;
				await expect(dialog).toHaveCount(0, {timeout: 15_000});
				await waitForJQueryIdle(page);
				await expect(
					admin.gridContainer.locator('tr.gridRow', {hasText: tag}),
				).toHaveCount(0);

				// The cascade, pinned in the DB: everything gone EXCEPT the
				// two contributor_roles rows (⚠ row 154, as-built residue).
				const after = dbJournalCounts(ctx.id);
				expect(after).toEqual({
					journals: 0,
					sections: 0,
					genres: 0,
					user_groups: 0,
					navigation_menus: 0,
					contributor_roles: 2, // ⚠ row 154
					reviewer_recommendations: 0,
				});
				// Every assignment in the journal's groups is gone…
				expect(
					Number(
						dbQuery(
							`SELECT count(*) FROM user_user_groups` +
								` WHERE user_group_id IN (${groupIds})`,
						),
					),
				).toBe(0);
				// …while the user ACCOUNT survives untouched.
				expect(
					Number(
						dbQuery(
							`SELECT count(*) FROM users WHERE username = '${throwaway}'`,
						),
					),
				).toBe(1);
				// The files tree is removed.
				expect(fs.existsSync(journalFilesDir(ctx.id))).toBe(false);

				// Gone from the public site index and the admin's switcher
				// (fresh page load; own journal only — other workers' scratch
				// journals may legitimately populate both).
				const anon = await newAnonContext(browser, baseURL);
				try {
					expect(await siteIndexHtml(anon)).not.toContain(tag);
				} finally {
					await anon.close();
				}
				await page.goto('/index.php/index/admin/contexts');
				const links = await openSwitcher(page);
				await expect(links.filter({hasText: `Journal ${tag}`})).toHaveCount(
					0,
				);
			} finally {
				if (!deleted) {
					await cleanupJournal(page.request, csrf, ctx.id);
				}
			}
		},
	);

	// ── Scenario 7 — Multi-journal navigation boundaries + row 120 ─────────
	// A throwaway manager with roles in several scratch journals sees
	// exactly the right switcher roster (disabled journal only where
	// manager, links to /submissions); a single-journal user gets no
	// button; the admin's switcher lists everything including the
	// disabled journal. ⚠ Row 120: the API-only nameless-journal POST is
	// the standing validation-boundary probe — created live+blank on the
	// site index, then deleted.
	test(
		'switcher rosters per role; no button on one journal; admin sees disabled; row-120 nameless journal',
		{tag: '@regression'},
		async ({page, pkpApi, browser, baseURL}) => {
			test.slow();
			const tag = uniqueTag();
			const userX = `mn${tag}`; // manager of A (enabled) + B (disabled), author of C, D
			const userY = `sg${tag}`; // author of C only
			const pw = (u) => u + u;
			await page.goto('/index.php/index/admin/contexts');
			const csrf = await csrfToken(page);
			const ids = [];
			let namelessId;
			try {
				const journals = {};
				for (const [key, users] of [
					['a', [{username: userX, password: pw(userX), roles: ['manager']}]],
					['b', [{username: userX, password: pw(userX), roles: ['manager']}]],
					[
						'c',
						[
							{username: userX, password: pw(userX), roles: ['author']},
							{username: userY, password: pw(userY), roles: ['author']},
						],
					],
					['d', [{username: userX, password: pw(userX), roles: ['author']}]],
				]) {
					journals[key] = await seedJournal(pkpApi, `${tag}${key}`, users);
					ids.push(journals[key].id);
				}
				// Disable B and D (admin, journal-scoped PUT — the admin-side
				// enabled control; manager-side hole = row 118, owned by
				// site-access-restrictions).
				for (const key of ['b', 'd']) {
					const res = await page.request.put(
						`/index.php/${tag}${key}/api/v1/contexts/${journals[key].id}`,
						{
							headers: {
								'X-Csrf-Token': csrf,
								'Content-Type': 'application/json',
							},
							data: {enabled: false},
						},
					);
					expect(res.status(), `disable ${key} → 200`).toBe(200);
				}

				// userX on journal A's backend: the switcher lists B (manager
				// of the DISABLED journal) and C (any role, enabled) — both
				// linked to /submissions — but NOT D (author of a disabled
				// journal), NOT A (current), NOT publicknowledge (no role).
				const xCtx = await newAnonContext(browser, baseURL);
				try {
					const xPage = await xCtx.newPage();
					const login = new LoginPage(xPage);
					await login.login(userX, pw(userX), `${tag}a`);
					await xPage.waitForURL((u) => !u.pathname.includes('/login'), {
						waitUntil: 'commit',
						timeout: 15_000,
					});
					await xPage.goto(`/index.php/${tag}a/dashboard/editorial`);
					const xLinks = await openSwitcher(xPage);
					const linkB = xLinks.filter({hasText: `Journal ${tag}b`});
					const linkC = xLinks.filter({hasText: `Journal ${tag}c`});
					await expect(linkB).toBeVisible();
					await expect(linkC).toBeVisible();
					expect(await linkB.getAttribute('href')).toContain('/submissions');
					expect(await linkC.getAttribute('href')).toContain('/submissions');
					await expect(
						xLinks.filter({hasText: `Journal ${tag}d`}),
					).toHaveCount(0);
					await expect(
						xLinks.filter({hasText: `Journal ${tag}a`}),
					).toHaveCount(0);
					await expect(
						xLinks.filter({hasText: 'Journal of Public Knowledge'}),
					).toHaveCount(0);
				} finally {
					await xCtx.close();
				}

				// userY (roles in ONE journal): the button doesn't render.
				const yCtx = await newAnonContext(browser, baseURL);
				try {
					const yPage = await yCtx.newPage();
					const login = new LoginPage(yPage);
					await login.login(userY, pw(userY), `${tag}c`);
					await yPage.waitForURL((u) => !u.pathname.includes('/login'), {
						waitUntil: 'commit',
						timeout: 15_000,
					});
					await yPage.goto(`/index.php/${tag}c/dashboard/mySubmissions`);
					await expect(
						yPage.locator('.app__contextTitle'),
					).toHaveText(`Journal ${tag}c`, {timeout: 20_000});
					await expect(yPage.locator('.app__contexts')).toHaveCount(0);
				} finally {
					await yCtx.close();
				}

				// The ADMIN's switcher lists everything he isn't on — incl.
				// the DISABLED journal B (own journals asserted only).
				await page.goto('/index.php/index/admin/contexts');
				const adminLinks = await openSwitcher(page);
				await expect(
					adminLinks.filter({hasText: `Journal ${tag}b`}),
					'admin sees the disabled journal',
				).toBeVisible();
				await expect(
					adminLinks.filter({hasText: `Journal ${tag}d`}),
				).toBeVisible();

				// ⚠ Row 120 — the standing validation-boundary probe: POST
				// with nothing but a urlPath → 200; the journal is nameless,
				// contact-less and (DB default) LIVE, listed blank-but-linked
				// on the public site index. Deleted immediately.
				const nTag = `${tag}n`;
				const nameless = await apiCreate(page.request, csrf, {
					urlPath: nTag,
				});
				expect(
					nameless.status(),
					'row 120: nameless journal minted via API',
				).toBe(200);
				const namelessJson = await nameless.json();
				namelessId = namelessJson.id;
				expect(namelessJson.enabled, 'row 120: API default is LIVE').toBe(
					true,
				);
				expect(namelessJson.name?.en ?? '').toBe('');
				const anon = await newAnonContext(browser, baseURL);
				try {
					expect(
						await siteIndexHtml(anon),
						'row 120: blank entry linked by path on the site index',
					).toContain(`/${nTag}`);
					const delRes = await apiDelete(page.request, csrf, namelessId);
					expect(delRes.status()).toBe(200);
					namelessId = undefined;
					expect(await siteIndexHtml(anon)).not.toContain(`/${nTag}`);
				} finally {
					await anon.close();
				}
			} finally {
				await cleanupJournal(page.request, csrf, namelessId);
				for (const id of ids) {
					await cleanupJournal(page.request, csrf, id);
				}
			}
		},
	);
});
