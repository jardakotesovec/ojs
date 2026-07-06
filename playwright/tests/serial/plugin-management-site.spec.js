// @ts-check
const {execFileSync} = require('child_process');
const {test, expect} = require('../../support/fixtures.js');
const {
	PluginsGridPage,
} = require('../../../lib/pkp/playwright/pages/PluginsGridPage.js');

/**
 * Plugin management — canonical scenario 4 of
 * docs/product/specs/plugin-management.md: the site admin on the SITE
 * Installed Plugins grid (Administration → Site Settings → Plugins),
 * including ledger row 48(f).
 *
 * WHY SERIAL: this is the one plugin-management scenario that flips a
 * SITE-scope enabled flag — the shared NULL-context `plugin_settings` row
 * that every worker's site-level requests read. Charter principle 9 (and
 * the config-factory serial-project comment) bans site-level plugin
 * toggles from the parallel project, so this test runs here, alone, after
 * the parallel suite. The other five scenarios are parallel-safe and live
 * in playwright/tests/plugin-management.spec.js.
 *
 * ISOLATION: the only plugin toggled is the demo Plugin Template
 * (`plugintemplateplugin` — disabled by default, no side effects, nothing
 * else depends on it). The test snapshots the NULL-context plugin_settings
 * rows before touching anything and the `finally` disables the plugin,
 * deletes its NULL-context residue (a disable leaves an enabled=0 row
 * behind) and verifies the snapshot matches again, so the six site rows
 * the bootstrap installs are byte-identical after the run. The scratch
 * journal (`plgtsite…`) is deleted through the admin contexts API.
 * publicknowledge plugin state is READ only (its grid must show the
 * journal-level plugin unaffected by the site toggle — row 48f).
 */

const SITE_CONTEXTS_API = '/index.php/index/api/v1/contexts';

test.use({user: 'admin'});

/** Unique hyphenless alphanumeric tag; doubles as the scratch urlPath. */
function uniqueTag(prefix = 'plgtsite') {
	let suffix = '';
	while (suffix.length < 6) {
		suffix += Math.random().toString(36).replace(/[^a-z0-9]/g, '');
	}
	return `${prefix}${suffix.slice(0, 6)}`;
}

/** psql against the shared Postgres test DB. */
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

/** The NULL-context (site-scope) plugin_settings rows, canonical order. */
function siteRowsSnapshot() {
	return dbQuery(
		"SELECT plugin_name || '|' || setting_name || '|' || setting_value" +
			' FROM plugin_settings WHERE context_id IS NULL' +
			' ORDER BY plugin_name, setting_name',
	);
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

test.describe('Plugin management — the site grid (serial: site-scope toggle)', () => {
	// ── Scenario 4 — Site admin runs the site grid ───────────────────────────
	// Administration → Site Settings → Plugins: all categories render
	// including the site-wide plugins (Usage Event appears, locked — rule 3);
	// rows carry Delete and Upgrade, and the grid header offers Upload A New
	// Plugin (site-admin file ops, install mode `on`). Toggling a
	// JOURNAL-level plugin here flips only the site-scope state: the write
	// lands in the NULL-context row, no journal-context row appears, no
	// journal grid changes, and the journal-scope API surface stays dead —
	// journals never read the site row (⚠ row 48f, canonical in rule 7).
	test(
		'site grid anatomy (locked Usage Event, upload/delete/upgrade); site toggle of a journal-level plugin governs nothing journals see (row 48f)',
		{tag: ['@smoke', '@regression']},
		async ({page, pkpApi}) => {
			test.slow();
			const tag = uniqueTag();
			const before = siteRowsSnapshot();
			expect(before, 'bootstrap site rows present').not.toBe('');
			// Plugin Template must start with NO site-scope row (rule 6) —
			// anything else is residue from a broken previous run.
			expect(before).not.toContain('plugintemplateplugin');
			let journalId;
			try {
				const {context: ctx} = await pkpApi.createJournal({
					tag,
					path: tag,
					name: {en: `Site Plugin Journal ${tag}`},
					primaryLocale: 'en',
					supportedLocales: ['en'],
				});
				journalId = ctx.id;
				// The journal-context enabled rows for the demo plugin, before
				// and after the site toggle — row 48f says this set must not
				// change (the site grid writes ONLY the NULL-context row).
				const contextRows = () =>
					dbQuery(
						'SELECT context_id FROM plugin_settings' +
							" WHERE plugin_name='plugintemplateplugin'" +
							" AND setting_name='enabled' AND context_id IS NOT NULL" +
							' ORDER BY context_id',
					);
				const contextRowsBefore = contextRows();

				const grid = new PluginsGridPage(page);
				await grid.gotoAdminGrid();

				// Anatomy: category groups render (one labelled tbody per
				// category), including the site-wide Usage Event row managers
				// never see — locked (can be neither enabled nor disabled,
				// rule 3).
				await expect(
					grid.container.locator(
						'tbody.category_grid_body[id$="-category-generic"]',
					),
				).toContainText('Generic Plugins');
				const usageEvent = grid.enabledCheckbox('usageeventplugin');
				await expect(usageEvent).toBeVisible();
				await expect(usageEvent).toBeDisabled();
				// TinyMCE is locked here too — enabled, not disable-able.
				const tinymce = grid.enabledCheckbox('tinymceplugin');
				await expect(tinymce).toBeChecked();
				await expect(tinymce).toBeDisabled();

				// File-level operations: the header offers Upload A New Plugin
				// (install mode `on`), and a row's expander reveals Delete +
				// Upgrade (site-admin row actions).
				await expect(
					grid.container
						.locator('a[id*="-upload-button-"]')
						.filter({hasText: 'Upload A New Plugin'})
						.first(),
				).toBeVisible();
				const row = grid.row('plugintemplateplugin');
				await expect(row).toBeVisible();
				const rowId = await row.getAttribute('id');
				const expander = row.locator('a.show_extras');
				if (await expander.count()) {
					await expander.click();
				}
				await expect(
					page.locator(`a[id^="${rowId}-delete-button-"]`),
				).toBeVisible();
				await expect(
					page.locator(`a[id^="${rowId}-upgrade-button-"]`),
				).toBeVisible();

				// The 48f probe: enable the JOURNAL-level demo plugin on the
				// SITE grid…
				expect(await grid.isEnabled('plugintemplateplugin')).toBe(false);
				await grid.enable('plugintemplateplugin');

				// …the write landed in the NULL-context (site) row ONLY…
				expect(
					dbQuery(
						'SELECT setting_value FROM plugin_settings' +
							" WHERE plugin_name='plugintemplateplugin'" +
							" AND setting_name='enabled' AND context_id IS NULL",
					),
				).toBe('1');
				expect(contextRows()).toBe(contextRowsBefore);

				// …no journal grid changed: the scratch journal (admin is its
				// auto-manager) and publicknowledge (READ only) both still
				// show the plugin disabled…
				await grid.gotoJournalGrid(ctx.path);
				expect(await grid.isEnabled('plugintemplateplugin')).toBe(false);
				await grid.gotoJournalGrid('publicknowledge');
				expect(await grid.isEnabled('plugintemplateplugin')).toBe(false);

				// …and the journal-scope surface stays DEAD: in a journal
				// context the plugin reads the journal's own row (absent), so
				// its settings API never registers — the site row governs
				// nothing journals or readers see.
				expect(
					(
						await page.request.get(
							`/index.php/${ctx.path}/api/v1/plugins/plugintemplateplugin/settings`,
						)
					).status(),
				).toBe(404);

				// Disable back on the site grid (confirm modal) — the toggle
				// round-trips at site scope like any other.
				await grid.gotoAdminGrid();
				await grid.disable('plugintemplateplugin');
			} finally {
				// Restore PRISTINE site scope: a disable leaves an enabled=0
				// NULL-context row behind — remove the demo plugin's site
				// residue and prove the snapshot matches the bootstrap state.
				dbQuery(
					'WITH gone AS (DELETE FROM plugin_settings' +
						" WHERE plugin_name='plugintemplateplugin'" +
						' AND context_id IS NULL RETURNING plugin_name)' +
						' SELECT count(*) FROM gone',
				);
				expect(siteRowsSnapshot(), 'site rows pristine').toBe(before);
				// Remove the scratch journal through the admin contexts API.
				if (journalId) {
					const res = await page.request.delete(
						`${SITE_CONTEXTS_API}/${journalId}`,
						{headers: {'X-Csrf-Token': await csrfToken(page)}},
					);
					expect(
						[200, 404].includes(res.status()),
						`scratch journal ${journalId} cleaned (${res.status()})`,
					).toBeTruthy();
				}
			}
		},
	);
});
