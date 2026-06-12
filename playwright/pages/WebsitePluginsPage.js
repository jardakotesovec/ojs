// @ts-check
const {expect} = require('@playwright/test');
const {BasePage} = require('../../lib/pkp/playwright/pages/BasePage.js');
const {waitForJQueryIdle} = require('../../lib/pkp/playwright/support/jquery.js');

/**
 * POM for the installed-plugins grid at Settings → Website → Plugins →
 * Installed Plugins — a legacy Smarty/jQuery CategoryGrid
 * (`grid.settings.plugins.SettingsPluginGridHandler`, loaded via
 * load_url_in_div into `#pluginGridContainer`;
 * lib/pkp/templates/management/website.tpl:113-118).
 *
 * Sits in playwright/pages (OJS) because only OJS specs drive it so
 * far; the grid itself ships from pkp-lib, so this is a candidate to
 * lift into lib/pkp/playwright/pages when OMP/OPS need it.
 *
 * Legacy-grid realities (ReviewFormSettingsPage conventions):
 *  - Row DOM ids carry the category segment:
 *    `component-grid-settings-plugins-settingsplugingrid-category-
 *    {category}-row-{pluginName}` — matched by suffix here so the
 *    category never needs hardcoding.
 *  - Row link actions (the plugin's own getActions, e.g. Settings)
 *    hide inside the sibling `tr.row_controls` until `a.show_extras`
 *    is clicked (patterns.md pitfall 9); their anchors are
 *    `{rowDomId}-{actionId}-button-{uniq}`.
 *  - The Enabled column is a selectStatusCell checkbox
 *    (`input[id^="select-cell-{pluginName}"]`). Disabling an enabled
 *    plugin routes through a RemoteActionConfirmationModal (OK /
 *    Cancel) — PluginGridCellProvider::getCellActions; enabling is a
 *    plain AjaxAction. Either way the row refreshes from the server,
 *    so post-toggle state must be re-asserted via the page-level
 *    locator, never a captured element.
 *  - Everything rides jQuery AJAX → waitForJQueryIdle after each
 *    mutation (the jQuery-idle dance).
 *
 * NOTE: this POM toggles plugins at JOURNAL (context) level only —
 * plugin_settings rows scoped to the current journal. Site-level
 * plugin toggles are serial-project territory (charter principle 9).
 */
exports.WebsitePluginsPage = class WebsitePluginsPage extends BasePage {
	/**
	 * @param {import('@playwright/test').Page} page
	 * @param {{journalPath: string}} opts
	 */
	constructor(page, {journalPath}) {
		super(page);
		this.journalPath = journalPath;
		this.gridContainer = page.locator('#pluginGridContainer');
	}

	/**
	 * Open Settings → Website, activate the Plugins tab (Installed
	 * Plugins side tab is active by default) and wait for the legacy
	 * grid to land.
	 */
	async goto() {
		await this.page.goto(
			`/index.php/${this.journalPath}/management/settings/website`,
		);
		await this.page.locator('#plugins-button').click();
		await expect(
			this.gridContainer.locator('tr.gridRow').first(),
		).toBeVisible({timeout: 20_000});
		await waitForJQueryIdle(this.page);
	}

	/**
	 * The grid row for a plugin. `pluginName` is the lowercased class
	 * name (LazyLoadPlugin::getName()), e.g.
	 * 'citationstylelanguageplugin'.
	 *
	 * @param {string} pluginName
	 */
	pluginRow(pluginName) {
		return this.gridContainer.locator(`tr.gridRow[id$="-row-${pluginName}"]`);
	}

	/**
	 * The Enabled-column checkbox (selectStatusCell.tpl renders
	 * `select-cell-{pluginName}{uniqid}` ids — same anchor
	 * doi-crossref.spec.js uses).
	 *
	 * @param {string} pluginName
	 */
	enabledCheckbox(pluginName) {
		return this.gridContainer.locator(
			`input[id^="select-cell-${pluginName}"]`,
		);
	}

	/**
	 * Expand the row's hidden controls. No-op when already expanded
	 * (the glyph class flips to `hide_extras`).
	 *
	 * @param {string} pluginName
	 */
	async expandRowExtras(pluginName) {
		const showExtras = this.pluginRow(pluginName).locator('a.show_extras');
		if ((await showExtras.count()) > 0) {
			await showExtras.click();
		}
	}

	/**
	 * Open a plugin's Settings AjaxModal (the LinkAction the plugin
	 * contributes via getActions) and return the legacy form inside,
	 * located by its form id. `.last()` — modal stacking accumulates
	 * DOM copies of legacy form ids.
	 *
	 * Bounded retry: a click landing while the grid re-renders (e.g.
	 * right after a settings save refreshes the row / drains the
	 * trivial-notification queue) is swallowed without opening the
	 * AjaxModal — the same race ReviewFormSettingsPage documents on
	 * its elements grid. Observed deterministically on the REOPEN
	 * after a save.
	 *
	 * @param {string} pluginName
	 * @param {string} formSelector e.g. 'form#citationStyleLanguageSettingsForm'
	 * @returns {Promise<import('@playwright/test').Locator>}
	 */
	async openPluginSettings(pluginName, formSelector) {
		const row = this.pluginRow(pluginName);
		await expect(row).toBeVisible({timeout: 20_000});
		const rowDomId = await row.getAttribute('id');
		const form = this.page.locator(formSelector).last();
		for (let attempt = 0; ; attempt++) {
			try {
				await this.expandRowExtras(pluginName);
				await this.page
					.locator(`a[id^="${rowDomId}-settings-button-"]`)
					.first()
					.click({timeout: 5_000});
				await expect(form).toBeVisible({timeout: 5_000});
				break;
			} catch (err) {
				// The click may also have opened the modal late — accept it.
				if (await form.isVisible().catch(() => false)) {
					break;
				}
				if (attempt >= 2) {
					throw err;
				}
				await waitForJQueryIdle(this.page);
			}
		}
		await waitForJQueryIdle(this.page);
		return form;
	}

	/**
	 * Submit a legacy AjaxFormHandler settings form via its
	 * fbvFormButtons submit button and wait for the hosting AjaxModal
	 * to close (a still-open form means server-side validation failed),
	 * then for jQuery to settle. Anchored on the stable
	 * `button.submitFormButton` class, NOT the label: fbvFormButtons
	 * defaults the label to "OK" (common.ok) unless the template passes
	 * submitText — plugin settings forms typically don't.
	 *
	 * @param {import('@playwright/test').Locator} form
	 */
	async saveAjaxForm(form) {
		await form.locator('button.submitFormButton').click();
		await expect(form).toBeHidden({timeout: 15_000});
		await waitForJQueryIdle(this.page);
	}

	/**
	 * Disable an ENABLED plugin: click its Enabled checkbox (which only
	 * opens the RemoteActionConfirmationModal), confirm with OK, and
	 * wait for the grid row refresh. Callers re-assert the checkbox
	 * state afterwards — the input element is replaced by the refresh.
	 *
	 * @param {string} pluginName
	 */
	async disablePlugin(pluginName) {
		const checkbox = this.enabledCheckbox(pluginName);
		await expect(checkbox).toBeChecked();
		await checkbox.click();
		const okButton = this.page
			.getByRole('button', {name: 'OK', exact: true})
			.last();
		await expect(okButton).toBeVisible({timeout: 10_000});
		await okButton.click();
		await waitForJQueryIdle(this.page);
	}
};
