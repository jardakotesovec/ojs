// @ts-check
const {expect} = require('../support/fixtures.js');

/**
 * Settings → Journal → Categories — the Vue table manager
 * (`lib/ui-library/src/managers/CategoryManager/`, mounted by
 * `templates/management/context.tpl` on `management/settings/context`).
 * One of the few settings surfaces already off legacy grids: the tree
 * renders as a PkpTable (accessible name "Categories") of recursive
 * `CategoryTreeRow`s, all mutation goes through the `editCategory`
 * side-modal form (POST/PUT `/api/v1/{context}/categories[/{id}]`) and
 * the row-level DropdownActions menu (Add / Edit / Delete Category).
 *
 * OJS-root placement mirrors SectionsSettingsPage: the manager component
 * is shared pkp-lib/ui-library, but the settings page and the journal
 * context it manages are app-level.
 *
 * Waiting strategy: every save/delete is anchored on its API response
 * (the store re-fetches the tree afterwards; row assertions auto-wait on
 * the re-render). No hard-coded waits.
 */
exports.CategoriesSettingsPage = class CategoriesSettingsPage {
	/**
	 * @param {import('@playwright/test').Page} page
	 * @param {string} journalPath
	 */
	constructor(page, journalPath) {
		this.page = page;
		this.journalPath = journalPath;

		/** The manager's PkpTable (aria-labelledby its "Categories" label). */
		this.table = page.getByRole('table', {name: 'Categories'});
		this.rows = this.table.locator('tbody tr');
		/**
		 * Data rows only — an empty tree renders a single "No Items"
		 * placeholder row; real category rows carry a More Actions menu.
		 */
		this.dataRows = this.rows.filter({
			has: page.getByRole('button', {name: 'More Actions'}),
		});
		/** The empty-state placeholder cell. */
		this.noItemsCell = this.table.getByRole('cell', {name: 'No Items'});
		this.addCategoryButton = page.getByRole('button', {
			name: 'Add Category',
			exact: true,
		});

		// The editCategory side-modal form's controls (ids are unique
		// page-wide; the form renders inside the active side modal).
		// Name is multilingual (locale-suffixed); Path is not.
		this.nameInput = page.locator('#editCategory-title-control-en');
		this.pathInput = page.locator('#editCategory-path-control');
		this.formModal = page
			.locator('[data-cy="active-modal"]')
			.filter({has: page.locator('#editCategory-title-control-en')});
	}

	/** The categories REST collection URL (tree read + create). */
	apiUrl() {
		return `/index.php/${this.journalPath}/api/v1/categories`;
	}

	/** Open Settings → Journal and switch to the Categories tab. */
	async goto() {
		await this.page.goto(
			`/index.php/${this.journalPath}/management/settings/context`,
		);
		await this.page
			.getByRole('tab', {name: 'Categories', exact: true})
			.click();
		await expect(this.addCategoryButton).toBeVisible({timeout: 20_000});
		await expect(this.table).toBeVisible({timeout: 20_000});
	}

	/**
	 * A row by its (unique) category name.
	 *
	 * @param {string} name
	 */
	rowByName(name) {
		return this.dataRows.filter({hasText: name});
	}

	/** All row names in render order (the name cell is the first td). */
	async rowNamesInOrder() {
		return (await this.dataRows.locator('td:first-child').allInnerTexts()).map(
			(t) => t.replace(/\s+/g, ' ').trim(),
		);
	}

	/**
	 * A row's expand/collapse toggle (`TableCellTreeExpand`; the chevron
	 * icon only renders on rows that have children).
	 *
	 * @param {string} name
	 */
	expandToggle(name) {
		return this.rowByName(name)
			.locator('[data-cy="category-manager-toggle-sub-categories"]')
			.first();
	}

	/**
	 * Open a row's More Actions menu and click one of its items
	 * ('Add' | 'Edit' | 'Delete Category').
	 *
	 * @param {string} name    row's category name
	 * @param {string} action  the menu item label
	 */
	async openRowAction(name, action) {
		await this.rowByName(name)
			.getByRole('button', {name: 'More Actions'})
			.first()
			.click();
		await this.page.getByRole('menuitem', {name: action, exact: true}).click();
	}

	/** Click the top Add Category button and wait for the form modal. */
	async openAddForm() {
		await this.addCategoryButton.click();
		await expect(this.nameInput).toBeVisible({timeout: 15_000});
	}

	/**
	 * Open a row's Add (sub-category) or Edit form via More Actions.
	 *
	 * @param {string} name
	 * @param {'Add'|'Edit'} action
	 */
	async openRowForm(name, action) {
		await this.openRowAction(name, action);
		await expect(this.nameInput).toBeVisible({timeout: 15_000});
	}

	/**
	 * Fill the form's Name + Path fields (single-locale journals: `en`).
	 *
	 * @param {{name?: string, path?: string}} values
	 */
	async fillForm({name, path}) {
		if (name !== undefined) await this.nameInput.fill(name);
		if (path !== undefined) await this.pathInput.fill(path);
	}

	/**
	 * Submit the open form and wait for its API verdict. On success
	 * (2xx) also waits for the side modal to close (the store refetches
	 * the tree and re-renders). Returns the response.
	 *
	 * Note: PUT/DELETE are tunneled as POST + X-Http-Method-Override by
	 * the UI's fetch layer (pkp/pkp-lib#5981), so the wire method for
	 * every save is POST.
	 *
	 * @param {{expectError?: boolean}} [opts] expectError: the save is
	 *   expected to be refused (4xx) and the modal to stay open.
	 */
	async saveForm({expectError = false} = {}) {
		const [response] = await Promise.all([
			this.page.waitForResponse(
				(res) =>
					/\/api\/v1\/categories(\/\d+)?(\?|$)/.test(res.url()) &&
					res.request().method() === 'POST',
				{timeout: 20_000},
			),
			this.formModal
				.getByRole('button', {name: 'Save', exact: true})
				.click(),
		]);
		if (expectError) {
			expect(response.status()).toBeGreaterThanOrEqual(400);
			await expect(this.nameInput).toBeVisible();
		} else {
			expect(response.status(), await response.text()).toBeLessThan(300);
			await expect(this.nameInput).toHaveCount(0, {timeout: 15_000});
		}
		return response;
	}

	/**
	 * The manager's tree via the REST API (the page's manager session).
	 * Returns the JSON array of top-level categories with nested
	 * `subCategories`.
	 */
	async fetchTree() {
		const res = await this.page.request.get(this.apiUrl());
		if (!res.ok()) {
			throw new Error(`GET categories failed: ${res.status()}`);
		}
		return await res.json();
	}
};
