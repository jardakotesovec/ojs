// @ts-check
const {execFileSync} = require('child_process');
const {test, expect} = require('../support/fixtures.js');
const {
	PluginsGridPage,
} = require('../../lib/pkp/playwright/pages/PluginsGridPage.js');
const {LoginPage} = require('../../lib/pkp/playwright/pages/LoginPage.js');

/**
 * Plugin management — the Installed Plugins grids (journal + site), the
 * enable/disable + Settings mechanism, plugin scope (site vs journal), the
 * Plugin Gallery, and the gateway dispatch that publishes plugin endpoints.
 * One test per canonical scenario of docs/product/specs/plugin-management.md
 * (6 scenarios). Scenarios 1, 2, 3, 5, 6 live here (parallel-safe); scenario
 * 4 — the SITE grid toggle — lives in
 * playwright/tests/serial/plugin-management-site.spec.js because charter
 * principle 9 (and the config-factory comment on the serial project) bans
 * site-level plugin toggles from the parallel project: a site-scope enable
 * writes the shared NULL-context plugin_settings row that every worker's
 * site-level requests read.
 *
 * PLUGIN-SCOPE ISOLATION (the hard rules of this suite):
 *   - Journal-scope toggles happen ONLY on per-test scratch journals
 *     (unique hyphenless `plgt…` paths), and every scratch journal is
 *     DELETED in a `finally` via the admin-only site-level DELETE
 *     contexts/{id} — plugin state is otherwise shared/global.
 *   - The only plugins toggled are the demo Plugin Template
 *     (`plugintemplateplugin`, disabled by default, no side effects), the
 *     Publication Facts Label (`pflplugin`, same) and Web Feed
 *     (`webfeedplugin`) — the latter only on a scratch journal it is
 *     default-enabled on. NEVER tinymce (locked — asserted), the default
 *     theme, OAI formats, googleScholar or anything publicknowledge
 *     depends on. publicknowledge's plugin state is never written.
 *   - No shared seeded user is enrolled anywhere new: dbarnes is only ever
 *     the manager of this suite's OWN scratch journals; scenario-1's toast
 *     actor and scenario-5's stripped manager are DEDICATED throwaway
 *     users (the trivial-notification toast queue is per-user, so shared
 *     users' toasts race across workers — a throwaway makes the spec's
 *     canonical toast text assertable deterministically).
 *   - Scenario 5 needs a site admin who is NOT the journal's manager, but
 *     the scenario seeder auto-enrolls admin as every scratch journal's
 *     first manager (PKPContextService::add), so the test deletes admin's
 *     membership in ITS OWN scratch journal's groups (scoped SQL, verified
 *     rowcount) — the journal itself is deleted in `finally`, so nothing
 *     outlives the test; admin's site-admin role is untouched.
 *
 * KNOWN LEDGER ROWS asserted AS-BUILT:
 *   - ⚠ Row 157 (scenario 5): a pure site admin on a journal grid is shown
 *     active toggles, but every click on a journal-level plugin is refused
 *     with the raw untranslated key `##user.authorization.pluginLevel##`
 *     (the locale string does not exist).
 *   - ⚠ Row 156 (scenario 6): with the gallery feed unreachable (this test
 *     env is firewalled) the Plugin Gallery tab hard-fails — the fetch-grid
 *     op answers an empty-body HTTP 500 at BOTH levels instead of an empty
 *     list. No live install is attempted (network egress is blocked); the
 *     admin-only gating of installPlugin is asserted at the operation
 *     level instead (manager → role refusal; admin → past the role gate).
 *
 * AUTH: test.use dbarnes (manager of each test's own scratch journal);
 * asUser('admin') for site-grid reads/cleanup; anonymous contexts for
 * public/gateway effects.
 */

const MANAGER = 'dbarnes';
const REFUSAL = 'The current role does not have access to this operation.';
const RAW_PLUGIN_LEVEL_KEY = '##user.authorization.pluginLevel##';
const SITE_CONTEXTS_API = '/index.php/index/api/v1/contexts';

test.use({user: MANAGER});

/** Unique hyphenless alphanumeric tag; doubles as the scratch urlPath. */
function uniqueTag(prefix = 'plgt') {
	const workerLetter = String.fromCharCode(
		97 + (test.info().parallelIndex % 26),
	);
	let suffix = '';
	while (suffix.length < 6) {
		suffix += Math.random().toString(36).replace(/[^a-z0-9]/g, '');
	}
	return `${prefix}${workerLetter}${suffix.slice(0, 6)}`;
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
 * A browser context signed in as a freshly-seeded throwaway user (password
 * = username+username, the seeder/asUser convention) at the given journal.
 * asUser() is for baseline users only — its storage-state cache assumes a
 * stable roster — so throwaways log in through the REAL login form (the
 * signIn op enforces the session CSRF token, so a bare request POST cannot
 * authenticate). The context MUST start from an explicit empty storage
 * state: newContext inherits the file-level test.use storageState
 * (dbarnes) otherwise, and signIn on a live session is a no-op redirect.
 */
async function newThrowawayContext(browser, baseURL, contextPath, username) {
	const ctx = await browser.newContext({
		baseURL,
		storageState: {cookies: [], origins: []},
	});
	const page = await ctx.newPage();
	const login = new LoginPage(page);
	await login.login(username, `${username}${username}`, contextPath);
	// Success navigates away from the signIn op; failure re-renders it.
	await expect(
		page,
		`throwaway ${username} signs in`,
	).not.toHaveURL(/login\/signIn/, {timeout: 15_000});
	await page.close();
	return ctx;
}

/** Seed a scratch journal (single-locale en; users passthrough). */
async function seedJournal(pkpApi, tag, users = []) {
	const {context} = await pkpApi.createJournal({
		tag,
		path: tag,
		name: {en: `Plugin Journal ${tag}`},
		primaryLocale: 'en',
		supportedLocales: ['en'],
		users,
	});
	return context;
}

/**
 * `finally`-safe scratch-journal removal through the admin-only site-level
 * contexts API (an enabled scratch journal left behind pollutes the shared
 * site index AND leaks its plugin_settings rows).
 */
async function cleanupJournal(asUser, id) {
	if (!id) return;
	const adminCtx = await asUser('admin');
	const res = await adminCtx.request.delete(`${SITE_CONTEXTS_API}/${id}`, {
		headers: {'X-Csrf-Token': await csrfFor(adminCtx)},
	});
	expect(
		[200, 404].includes(res.status()),
		`scratch journal ${id} cleaned (${res.status()})`,
	).toBeTruthy();
}

/** Read-only-by-default psql against the shared Postgres test DB. */
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

/** The journal-scope plugin-settings REST endpoint (modern modals, rule 8). */
function pluginSettingsApi(contextPath, pluginName) {
	return `/index.php/${contextPath}/api/v1/plugins/${pluginName}/settings`;
}

/** A webFeed gateway URL on a journal (rule 12 dispatch). */
function webFeedUrl(contextPath, fmt) {
	return `/index.php/${contextPath}/gateway/plugin/WebFeedGatewayPlugin/${fmt}`;
}

/** Count the `<link rel="alternate">` webFeed autodiscovery tags on a page. */
async function feedLinkCount(anon, url) {
	const res = await anon.request.get(url);
	expect(res.ok(), `GET ${url} → ${res.status()}`).toBeTruthy();
	const html = await res.text();
	return (
		html.match(
			/<link rel="alternate"[^>]*WebFeedGatewayPlugin[^>]*>/g,
		) ?? []
	).length;
}

/** Component-router URLs for the three grids this spec drives. */
function journalGridUrl(contextPath, op) {
	return `/index.php/${contextPath}/$$$call$$$/grid/settings/plugins/settings-plugin-grid/${op}`;
}
function galleryGridUrl(contextPath, op) {
	return `/index.php/${contextPath}/$$$call$$$/grid/plugins/plugin-gallery-grid/${op}`;
}
const ADMIN_GRID_FETCH =
	'/index.php/index/$$$call$$$/grid/admin/plugins/admin-plugin-grid/fetch-grid';

test.describe('Plugin management — installed-plugins grids, settings, scope, gallery', () => {
	// ── Scenario 1 — Manager toggles a plugin and its public surfaces follow ──
	// On a scratch journal the Installed Plugins grid shows the category
	// groups; TinyMCE renders locked-on (rule 3: no supported way to plain
	// textareas) and site-wide plugins are filtered from the manager's view.
	// Web Feed is on by default (rule 6) and the journal home page carries
	// its three feed autodiscovery links. The manager disables it (confirm
	// modal) → "has been disabled" toast, checkbox clears and survives
	// reload, the links vanish and the feed gateway URL 404s (rules 4 + 12);
	// re-enabling restores all of it. Actor: a DEDICATED throwaway manager,
	// so the per-user toast queue can't be drained by another worker's
	// dbarnes page (the suite-wide no-shared-toast rule).
	test(
		'manager toggles Web Feed: confirm modal, toasts, autodiscovery links and gateway follow',
		{tag: ['@smoke', '@regression']},
		async ({pkpApi, asUser, browser, baseURL}) => {
			test.slow();
			const tag = uniqueTag();
			const mgrUser = `m${tag}`;
			let journalId;
			let mgrCtx;
			let anon;
			try {
				const ctx = await seedJournal(pkpApi, tag, [
					{
						username: mgrUser,
						password: mgrUser + mgrUser,
						roles: ['manager'],
					},
				]);
				journalId = ctx.id;
				const homeUrl = `/index.php/${ctx.path}/`;

				mgrCtx = await newThrowawayContext(
					browser,
					baseURL,
					ctx.path,
					mgrUser,
				);
				const mgrPage = await mgrCtx.newPage();
				const grid = new PluginsGridPage(mgrPage);
				await grid.gotoJournalGrid(ctx.path);

				// The grid renders per-category groups (rule 1): one labelled
				// tbody per plugin category.
				const genericGroup = grid.container.locator(
					'tbody.category_grid_body[id$="-category-generic"]',
				);
				const blocksGroup = grid.container.locator(
					'tbody.category_grid_body[id$="-category-blocks"]',
				);
				await expect(genericGroup).toContainText('Generic Plugins');
				await expect(blocksGroup).toContainText('Block Plugins');
				// …TinyMCE is locked enabled (rule 3: cannot be disabled)…
				const tinymce = grid.enabledCheckbox('tinymceplugin');
				await expect(tinymce).toBeChecked();
				await expect(tinymce).toBeDisabled();
				// …and the site-wide Usage Event plugin is filtered out of a
				// manager's journal grid (actors note c).
				await expect(grid.row('usageeventplugin')).toHaveCount(0);

				// Web Feed: enabled by default on a fresh journal (rule 6),
				// with the three autodiscovery links + a live gateway.
				expect(await grid.isEnabled('webfeedplugin')).toBe(true);
				anon = await newAnonContext(browser, baseURL);
				expect(await feedLinkCount(anon, homeUrl)).toBe(3);
				expect(
					(await anon.request.get(webFeedUrl(ctx.path, 'atom'))).status(),
				).toBe(200);

				// Disable (confirm modal inside grid.disable) → the canonical
				// toast, and the checkbox stays cleared across a reload.
				await grid.disable('webfeedplugin');
				await expect(
					mgrPage
						.locator('.app__notifications')
						.getByText(/has been disabled/),
				).toBeVisible({timeout: 10_000});
				await grid.gotoJournalGrid(ctx.path);
				expect(await grid.isEnabled('webfeedplugin')).toBe(false);

				// The public surfaces are GONE: no autodiscovery links, and
				// the gateway 404s (disabled plugins never register — rule 4).
				expect(await feedLinkCount(anon, homeUrl)).toBe(0);
				for (const fmt of ['atom', 'rss2', 'rss']) {
					expect(
						(await anon.request.get(webFeedUrl(ctx.path, fmt))).status(),
						`${fmt} gateway 404s while disabled`,
					).toBe(404);
				}

				// Re-enable → toast, links and gateway restored.
				await grid.enable('webfeedplugin');
				await expect(
					mgrPage
						.locator('.app__notifications')
						.getByText(/has been enabled/),
				).toBeVisible({timeout: 10_000});
				expect(await feedLinkCount(anon, homeUrl)).toBe(3);
				expect(
					(await anon.request.get(webFeedUrl(ctx.path, 'atom'))).status(),
				).toBe(200);
			} finally {
				await anon?.close();
				await mgrCtx?.close();
				await cleanupJournal(asUser, journalId);
			}
		},
	);

	// ── Scenario 2 — Manager configures a plugin through its Settings modal ──
	// dbarnes enables the Plugin Template demo → a Settings action appears
	// under the row's expander, opening the MODERN Vue form modal backed by
	// the plugin's own REST endpoint (rule 8). The modal saves a value;
	// reopening shows it persisted. Disabling removes the Settings action
	// AND the API endpoint (404 — rule 4), but the saved value survives a
	// disable/enable round-trip (rule 5).
	test(
		'Plugin Template settings modal round-trips; API exists only while enabled; settings survive disable',
		{tag: ['@smoke', '@regression']},
		async ({page, pkpApi, asUser}) => {
			test.slow();
			const tag = uniqueTag();
			const statement = `Statement ${tag}`;
			let journalId;
			try {
				const ctx = await seedJournal(pkpApi, tag, [
					{username: MANAGER, roles: ['manager']},
				]);
				journalId = ctx.id;
				const apiUrl = pluginSettingsApi(ctx.path, 'plugintemplateplugin');
				const settingsLink = page.locator(
					'a[id*="-row-plugintemplateplugin-settings-button-"]',
				);

				const grid = new PluginsGridPage(page);
				await grid.gotoJournalGrid(ctx.path);

				// Disabled by default (rule 6: no settings file → no row), and
				// while disabled there is no Settings action and no API.
				expect(await grid.isEnabled('plugintemplateplugin')).toBe(false);
				await expect(settingsLink).toHaveCount(0);
				expect((await page.request.get(apiUrl)).status()).toBe(404);

				// Enable → the Settings row action appears (getActions gate).
				await grid.enable('plugintemplateplugin');
				const control = page.locator(
					'#pluginTemplateSettings-publicationStatement-control',
				);
				await grid.openSettingsModal('plugintemplateplugin', control);

				// Save a value through the REAL Vue form → PUT to the plugin's
				// own endpoint (the ui-library sends PUT as POST with an
				// X-Http-Method-Override header — pkp/pkp-lib#5981); success
				// closes the modal.
				await control.fill(statement);
				const form = page
					.locator('form.pkpForm')
					.filter({has: control});
				const [putRes] = await Promise.all([
					page.waitForResponse(
						(res) =>
							res.url().includes('/api/v1/plugins/plugintemplateplugin/settings') &&
							['PUT', 'POST'].includes(res.request().method()),
						{timeout: 20_000},
					),
					form.getByRole('button', {name: 'Save', exact: true}).click(),
				]);
				expect(putRes.status()).toBe(200);
				expect((await putRes.json()).publicationStatement).toBe(statement);
				await expect(control).toBeHidden({timeout: 10_000});

				// Reopen: the modal re-fetches from the GET endpoint and shows
				// the persisted value.
				await grid.openSettingsModal('plugintemplateplugin', control);
				await expect(control).toHaveValue(statement, {timeout: 15_000});

				// Disable (a page reload clears the modal first): the Settings
				// action vanishes and the API endpoint is GONE (404) — but the
				// setting itself survives in the store.
				await grid.gotoJournalGrid(ctx.path);
				await grid.disable('plugintemplateplugin');
				await expect(settingsLink).toHaveCount(0);
				expect((await page.request.get(apiUrl)).status()).toBe(404);

				// Re-enable → the endpoint is back and still carries the value
				// saved before the disable (rule 5).
				await grid.enable('plugintemplateplugin');
				const getRes = await page.request.get(apiUrl);
				expect(getRes.status()).toBe(200);
				expect((await getRes.json()).publicationStatement).toBe(statement);
			} finally {
				await cleanupJournal(asUser, journalId);
			}
		},
	);

	// ── Scenario 3 — Plugin enablement is journal-scoped ─────────────────────
	// Enabling Publication Facts Label on journal A only: journal B's grid
	// and the SITE grid still show it disabled, and the settings store holds
	// exactly one enabled row — journal A's (rule 2). pflplugin ships no
	// default-enabled settings file, so B and the site scope have NO row at
	// all, not a false row.
	test(
		'enabling a plugin on journal A leaves journal B, the site grid and the settings store untouched',
		{tag: '@regression'},
		async ({page, pkpApi, asUser}) => {
			test.slow();
			const tagA = uniqueTag();
			const tagB = uniqueTag();
			let idA;
			let idB;
			try {
				const ctxA = await seedJournal(pkpApi, tagA, [
					{username: MANAGER, roles: ['manager']},
				]);
				const ctxB = await seedJournal(pkpApi, tagB, [
					{username: MANAGER, roles: ['manager']},
				]);
				idA = ctxA.id;
				idB = ctxB.id;
				const scopedRows = () =>
					dbQuery(
						"SELECT context_id FROM plugin_settings WHERE plugin_name='pflplugin'" +
							" AND setting_name='enabled'" +
							` AND (context_id IN (${idA}, ${idB}) OR context_id IS NULL)` +
							' ORDER BY context_id',
					);

				// Baseline: no enabled row anywhere in this test's scopes.
				expect(scopedRows()).toBe('');

				// Enable on journal A through the real grid checkbox.
				const grid = new PluginsGridPage(page);
				await grid.gotoJournalGrid(ctxA.path);
				expect(await grid.isEnabled('pflplugin')).toBe(false);
				await grid.enable('pflplugin');

				// Journal B's grid still shows it disabled…
				await grid.gotoJournalGrid(ctxB.path);
				expect(await grid.isEnabled('pflplugin')).toBe(false);

				// …the SITE grid (admin, read-only) still shows it disabled…
				const adminCtx = await asUser('admin');
				const adminPage = await adminCtx.newPage();
				const adminGrid = new PluginsGridPage(adminPage);
				await adminGrid.gotoAdminGrid();
				expect(await adminGrid.isEnabled('pflplugin')).toBe(false);

				// …and the store holds exactly journal A's row: no site
				// (NULL-context) row, no journal-B row (rule 2, live-verified
				// in the spec).
				expect(scopedRows()).toBe(String(idA));
			} finally {
				await cleanupJournal(asUser, idA);
				await cleanupJournal(asUser, idB);
			}
		},
	);

	// Scenario 4 (site admin runs the SITE grid, incl. ledger row 48f) lives
	// in playwright/tests/serial/plugin-management-site.spec.js — site-scope
	// plugin toggles are banned from the parallel project (charter
	// principle 9: they write shared NULL-context state all workers read).

	// ── Scenario 5 — Permission boundaries ───────────────────────────────────
	// dbarnes requesting the site grid is refused (page redirect + grid-op
	// refusal). A site admin who is NOT a manager of the journal still sees
	// ACTIVE toggles on the journal grid, but every click on a journal-level
	// plugin is refused with the raw `##user.authorization.pluginLevel##`
	// message (⚠ row 157 — the locale key does not exist), and nothing is
	// written. A manager whose role loses the settings permission gets
	// nothing at all: page, plugin grid and gallery all refuse.
	test(
		'boundaries: manager refused site grid; pure site admin gets raw pluginLevel key (row 157); stripped manager gets nothing',
		{tag: '@regression'},
		async ({page, pkpApi, asUser, browser, baseURL}) => {
			test.slow();
			const tag = uniqueTag();
			const mgrUser = `m${tag}`;
			let journalId;
			let strippedCtx;
			try {
				const ctx = await seedJournal(pkpApi, tag, [
					{
						username: mgrUser,
						password: mgrUser + mgrUser,
						roles: ['manager'],
					},
				]);
				journalId = ctx.id;

				// The scenario seeder auto-enrolls admin as the journal's first
				// manager (PKPContextService::add). Remove that membership —
				// scoped strictly to THIS scratch journal's groups — so admin
				// is a PURE site admin here (the row-157 precondition). The
				// journal is deleted in `finally`, so nothing to restore; the
				// removal is verified to have touched exactly this context.
				const deleted = dbQuery(
					'WITH gone AS (DELETE FROM user_user_groups uug' +
						" USING user_groups ug, users u" +
						' WHERE uug.user_group_id = ug.user_group_id' +
						` AND ug.context_id = ${journalId}` +
						" AND uug.user_id = u.user_id AND u.username = 'admin'" +
						' RETURNING uug.user_id) SELECT count(*) FROM gone',
				);
				expect(Number(deleted)).toBeGreaterThanOrEqual(1);
				expect(
					dbQuery(
						'SELECT count(*) FROM user_user_groups uug' +
							' JOIN user_groups ug ON ug.user_group_id = uug.user_group_id' +
							' JOIN users u ON u.user_id = uug.user_id' +
							` WHERE ug.context_id = ${journalId} AND u.username = 'admin'`,
					),
				).toBe('0');

				// dbarnes (journal manager) is refused the SITE grid: the page
				// redirects to the denial screen carrying the canonical
				// refusal text (actors note d), and the raw admin grid op
				// refuses too. As-built the op's message is one of two denial
				// layers ("Access denied." from the router / the role
				// policy's "current role does not have access") depending on
				// session state — either way status:false and no grid.
				await page.goto('/index.php/index/admin/settings');
				await expect(page).toHaveURL(/authorizationDenied/, {
					timeout: 15_000,
				});
				await expect(page.getByText(REFUSAL)).toBeVisible();
				const mgrFetch = await page.request.get(ADMIN_GRID_FETCH);
				const mgrFetchJson = await mgrFetch.json();
				expect(mgrFetchJson.status).toBe(false);
				expect(mgrFetchJson.content).toMatch(
					/Access denied\.|The current role does not have access to this operation\./,
				);

				// The PURE site admin on the journal grid: the grid renders —
				// including the site-wide row managers never see — with ACTIVE
				// (not locked) toggles…
				const adminCtx = await asUser('admin');
				const adminPage = await adminCtx.newPage();
				const adminGrid = new PluginsGridPage(adminPage);
				await adminGrid.gotoJournalGrid(ctx.path);
				await expect(adminGrid.row('usageeventplugin')).toBeVisible();
				const checkbox = adminGrid.enabledCheckbox('plugintemplateplugin');
				await expect(checkbox).toBeVisible();
				await expect(checkbox).toBeEnabled();
				// …but the click is refused with the RAW untranslated key
				// (⚠ row 157: manage-mode denies site admins on journal-level
				// plugins and user.authorization.pluginLevel exists in no
				// locale file).
				const [enableRes] = await Promise.all([
					adminPage.waitForResponse(
						(res) => /\/enable(\?|$)/.test(res.url()),
						{timeout: 15_000},
					),
					checkbox.click(),
				]);
				expect(await enableRes.text()).toContain(RAW_PLUGIN_LEVEL_KEY);
				// Nothing was written: a reload shows the toggle still off.
				await adminGrid.gotoJournalGrid(ctx.path);
				expect(
					await adminGrid.isEnabled('plugintemplateplugin'),
				).toBe(false);

				// Strip "permit settings" from this journal's manager group
				// (admin, through the real roles-grid endpoint — omitting the
				// checkbox saves it off)…
				const groupsRes = await adminCtx.request.get(
					`/index.php/${ctx.path}/api/v1/userGroups`,
				);
				expect(groupsRes.ok()).toBeTruthy();
				const mgrGroup = (await groupsRes.json()).items.find(
					(g) => g.name === 'Journal manager',
				);
				expect(mgrGroup, 'Journal manager group found').toBeTruthy();
				const flip = await adminCtx.request.post(
					`/index.php/${ctx.path}/$$$call$$$/grid/settings/roles/user-group-grid/update-user-group`,
					{
						form: {
							csrfToken: await csrfFor(adminCtx),
							userGroupId: String(mgrGroup.id),
							roleId: '16',
							'name[en]': mgrGroup.name,
							'abbrev[en]': mgrGroup.abbrev || 'JM',
						},
					},
				);
				expect(flip.status()).toBe(200);
				expect((await flip.json()).status).toBe(true);

				// …and the stripped manager gets NOTHING: the Website page,
				// the plugin grid and the gallery grid all refuse
				// (CanAccessSettingsPolicy on both grid handlers).
				strippedCtx = await newThrowawayContext(
					browser,
					baseURL,
					ctx.path,
					mgrUser,
				);
				const pageRes = await strippedCtx.request.get(
					`/index.php/${ctx.path}/management/settings/website`,
				);
				expect(pageRes.url()).toMatch(/authorizationDenied/);
				for (const url of [
					journalGridUrl(ctx.path, 'fetch-grid'),
					galleryGridUrl(ctx.path, 'fetch-grid'),
				]) {
					const res = await strippedCtx.request.get(url);
					const json = await res.json();
					expect(json.status, `refused: ${url}`).toBe(false);
					expect(json.content).toMatch(
						/Access denied\.|The current role does not have access to this operation\./,
					);
				}
			} finally {
				await strippedCtx?.close();
				await cleanupJournal(asUser, journalId);
			}
		},
	);

	// ── Scenario 6 — Plugin Gallery, render and gating ───────────────────────
	// The Gallery tab renders at both levels (managers and admins), but this
	// env is firewalled, so the grid fetch hard-fails with an EMPTY-BODY
	// HTTP 500 instead of an empty list (⚠ row 156 — asserted as-built at
	// both levels; no live install is attempted). The install operation is
	// site-admin-only: a manager's install call dies on the role gate; the
	// admin's passes it (and then fails on the unreachable feed, never on
	// the role). All reads are on publicknowledge — the gallery ops write
	// nothing.
	test(
		'plugin gallery: tab renders at both levels, firewalled fetch 500s empty (row 156), install is admin-gated',
		{tag: '@regression'},
		async ({page, asUser}) => {
			// The manager sees the Gallery tab on the journal side…
			await page.goto(
				'/index.php/publicknowledge/management/settings/website',
			);
			await page.locator('#plugins-button').click();
			const galleryTab = page.locator('#pluginGallery-button');
			await expect(galleryTab).toBeVisible({timeout: 15_000});
			// …but opening it renders NO grid: the load_url_in_div fetch dies
			// (row 156) and the container stays empty.
			await galleryTab.click();
			await expect(
				page.locator('#pluginGalleryGridContainer .pkp_controllers_grid'),
			).toHaveCount(0);

			// The fetch op is an empty-body 500 at the JOURNAL level…
			const journalFetch = await page.request.get(
				galleryGridUrl('publicknowledge', 'fetch-grid'),
			);
			expect(journalFetch.status(), 'journal gallery 500s').toBe(500);
			expect((await journalFetch.text()).trim()).toBe('');

			// …and at the SITE level (admin's Administration → Site Settings
			// carries the same second tab).
			const adminCtx = await asUser('admin');
			const adminPage = await adminCtx.newPage();
			await adminPage.goto('/index.php/index/admin/settings');
			await adminPage.locator('#plugins-button').click();
			await expect(
				adminPage.locator('#pluginGallery-button'),
			).toBeVisible({timeout: 15_000});
			const siteFetch = await adminCtx.request.get(
				'/index.php/index/$$$call$$$/grid/plugins/plugin-gallery-grid/fetch-grid',
			);
			expect(siteFetch.status(), 'site gallery 500s').toBe(500);
			expect((await siteFetch.text()).trim()).toBe('');

			// Gating: installPlugin is registered site-admin-only. The manager
			// is stopped by the ROLE gate…
			const mgrInstall = await page.request.post(
				galleryGridUrl('publicknowledge', 'install-plugin'),
				{form: {csrfToken: await csrfFor(page.context())}},
			);
			const mgrInstallJson = await mgrInstall.json();
			expect(mgrInstallJson.status).toBe(false);
			expect(mgrInstallJson.content).toContain(REFUSAL);
			// …while the admin passes it and fails only on the unreachable
			// gallery feed (no live install possible in this env — row 156's
			// boundary, NOT a role refusal).
			const adminInstall = await adminCtx.request.post(
				'/index.php/index/$$$call$$$/grid/plugins/plugin-gallery-grid/install-plugin',
				{form: {csrfToken: await csrfFor(adminCtx)}},
			);
			expect(await adminInstall.text()).not.toContain(REFUSAL);
		},
	);
});
