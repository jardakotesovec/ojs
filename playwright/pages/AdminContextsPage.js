// @ts-check
const {expect} = require('@playwright/test');
const {BasePage} = require('../../lib/pkp/playwright/pages/BasePage.js');
const {waitForJQueryIdle} = require('../../lib/pkp/playwright/support/jquery.js');

/**
 * POM for the site admin Hosted Journals page
 * (`/index.php/index/admin/contexts`). OJS-located because the create
 * flow drives OJS journal creation (the page itself is shared pkp-lib
 * admin UI; OMP/OPS would want their own labels).
 *
 * The page is a legacy pkp_controllers jQuery grid
 * (`ContextGridHandler`, lib/pkp/controllers/grid/admin/context/). Grid
 * shape:
 *   - container `#contextGridContainer`, rows `tr.gridRow` with ids
 *     `component-grid-admin-context-contextgrid-row-{contextId}`
 *   - columns: localized name + urlPath
 *   - grid action "Create Journal" → AjaxModal loading
 *     admin/editContext.tpl (`#editContext` mounts `<add-context-form>`)
 *   - row actions (hidden behind the per-row `a.show_extras` glyph,
 *     link ids `{rowId}-{action}-button-…`): edit (AjaxModal, same
 *     `#editContext` container but a plain `<pkp-form>`), delete
 *     (RemoteActionConfirmationModal → `deleteContext` op), wizard
 *     (redirect to /admin/wizard/{id}).
 *
 * The create form is the Vue ContextForm
 * (APP\components\forms\context\ContextForm): FieldText names follow
 * the FieldBase convention — multilingual `name-en` / `acronym-en`,
 * plain `urlPath` / `contactName` / `contactEmail`, `select[name=
 * "country"]`, and (only when the site has >1 installed locale)
 * `supportedLocales` checkboxes + `primaryLocale` radios. On success
 * the AddContextForm component navigates to `/admin/wizard/{newId}`
 * (the Settings Wizard).
 */
exports.AdminContextsPage = class AdminContextsPage extends BasePage {
	/** @param {import('@playwright/test').Page} page */
	constructor(page) {
		super(page);
		this.gridContainer = page.locator('#contextGridContainer');
		this.editContextForm = page.locator('#editContext');
	}

	/**
	 * Open /admin/contexts and wait for the grid (loaded via
	 * load_url_in_div, i.e. a jQuery AJAX fetch) to land.
	 */
	async goto() {
		const resp = await this.page.goto('/index.php/index/admin/contexts');
		expect(resp?.status()).toBe(200);
		await expect(this.gridContainer).toBeVisible({timeout: 15_000});
		await waitForJQueryIdle(this.page);
	}

	/**
	 * The grid row containing the given unique text (use the journal's
	 * unique urlPath or tagged name — the grid lists every hosted
	 * journal, including other workers' scratch journals).
	 *
	 * @param {string|RegExp} text
	 */
	rowFor(text) {
		return this.gridContainer
			.locator('tr.gridRow', {hasText: text})
			.first();
	}

	/**
	 * Expand a row's hidden controls (if collapsed) and return the
	 * action link. Legacy grids hide row controls until the row's
	 * `a.show_extras` glyph is clicked; the class flips to
	 * `hide_extras` once expanded (patterns.md pitfall 9).
	 *
	 * @param {import('@playwright/test').Locator} row a tr.gridRow locator
	 * @param {string} action 'edit' | 'delete' | 'wizard'
	 */
	async rowAction(row, action) {
		await expect(row).toBeVisible({timeout: 15_000});
		const showExtras = row.locator('a.show_extras');
		if ((await showExtras.count()) > 0) {
			await showExtras.click();
		}
		const rowId = await row.getAttribute('id');
		if (!rowId) {
			throw new Error('context grid row has no id attribute');
		}
		return this.page.locator(`a[id^="${rowId}-${action}-button-"]`);
	}

	/**
	 * Trigger the grid's "Create Journal" action and wait for the Vue
	 * form to mount inside the AjaxModal.
	 *
	 * @returns {Promise<import('@playwright/test').Locator>} the #editContext form scope
	 */
	async openCreateForm() {
		await this.gridContainer
			.locator('a[id*="createContext"]')
			.first()
			.click();
		await expect(this.editContextForm).toBeVisible({timeout: 15_000});
		await expect(
			this.editContextForm.locator('input[name="name-en"]'),
		).toBeVisible({timeout: 15_000});
		return this.editContextForm;
	}

	/**
	 * Full UI create-journal flow a production site admin performs:
	 * open the grid's Create Journal modal, fill the required fields,
	 * save, and wait for the redirect into the Settings Wizard.
	 *
	 * @param {{
	 *   name: string,
	 *   acronym: string,
	 *   path: string,
	 *   contactName?: string,
	 *   contactEmail?: string,
	 *   countryLabel?: string,
	 * }} details
	 * @returns {Promise<{id: number}>} the new journal's context id (parsed
	 *   from the /admin/wizard/{id} landing URL)
	 */
	async createJournal({
		name,
		acronym,
		path,
		contactName = 'Site Admin Tester',
		contactEmail = 'sadm-contact@mailinator.com',
		countryLabel = 'Canada',
	}) {
		const form = await this.openCreateForm();

		await form.locator('input[name="name-en"]').fill(name);
		await form.locator('input[name="acronym-en"]').fill(acronym);
		await form.locator('input[name="contactName"]').fill(contactName);
		await form.locator('input[name="contactEmail"]').fill(contactEmail);
		// Country runs the `country` Laravel validator server-side; the
		// FieldSelect's empty default fails it, so always pick one.
		await form
			.locator('select[name="country"]')
			.selectOption({label: countryLabel});
		await form.locator('input[name="urlPath"]').fill(path);

		// supportedLocales/primaryLocale render only when the site has
		// more than one installed locale (the test installer adds fr_CA
		// — tools/installTest.php). Both are required when present.
		if (await form.locator('input[name="supportedLocales"]').count()) {
			await form
				.locator('input[name="supportedLocales"][value="en"]')
				.check();
			await form
				.locator('input[name="primaryLocale"][value="en"]')
				.check();
		}

		// "Enable this journal to appear publicly on the site": the
		// OJS ContextForm defaults `enabled` to FALSE for new journals
		// (classes/components/forms/context/ContextForm.php:41) — a
		// journal created without ticking it is created DISABLED, and
		// every anonymous front-end URL (including invitation-accept
		// links) bounces to the journal login page. Mirrors the legacy
		// Cypress flow (20-CreateContext.cy.js).
		await form.locator('input[name="enabled"]').check();

		await form.getByRole('button', {name: /Save/i}).click();
		await this.page.waitForURL(/\/admin\/wizard\/\d+/, {timeout: 30_000});
		await expect(
			this.page.getByRole('heading', {name: /Settings Wizard/i, level: 1}),
		).toBeVisible({timeout: 15_000});

		const match = this.page.url().match(/\/admin\/wizard\/(\d+)/);
		if (!match) {
			throw new Error(`could not parse context id from ${this.page.url()}`);
		}
		return {id: parseInt(match[1], 10)};
	}

	/**
	 * Open the per-row Edit modal (same #editContext container as the
	 * create flow, but a plain pkp-form that stays open and shows a
	 * "Saved" [role=status] after a successful PUT).
	 *
	 * @param {string|RegExp} rowText unique text identifying the row
	 * @returns {Promise<import('@playwright/test').Locator>} the #editContext form scope
	 */
	async openEditForm(rowText) {
		const row = this.rowFor(rowText);
		const editLink = await this.rowAction(row, 'edit');
		await editLink.click();
		await expect(this.editContextForm).toBeVisible({timeout: 15_000});
		await expect(
			this.editContextForm.locator('input[name="name-en"]'),
		).toBeVisible({timeout: 15_000});
		return this.editContextForm;
	}

	/**
	 * Delete a journal via its row action + the
	 * RemoteActionConfirmationModal ("Are you sure you want to
	 * permanently delete {name}…" with an OK button — patterns.md
	 * pitfall 7). Waits for the remote `deleteContext` call to succeed
	 * and the chained grid refresh to settle.
	 *
	 * @param {string|RegExp} rowText unique text identifying the row
	 */
	async deleteJournal(rowText) {
		const row = this.rowFor(rowText);
		const deleteLink = await this.rowAction(row, 'delete');
		await deleteLink.click();

		const dialog = this.page.locator('[role="dialog"]', {
			hasText: /permanently delete/i,
		});
		await expect(dialog).toBeVisible({timeout: 15_000});

		// The component router kebab-cases the op in the URL:
		// .../context-grid/delete-context?rowId=N
		const deleted = this.page.waitForResponse(
			(res) => res.url().includes('delete-context') && res.ok(),
			{timeout: 30_000},
		);
		await dialog.getByRole('button', {name: 'OK'}).click();
		await deleted;
		await expect(dialog).toHaveCount(0, {timeout: 15_000});
		await waitForJQueryIdle(this.page);
	}
};
