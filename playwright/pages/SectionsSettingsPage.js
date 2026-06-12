// @ts-check
const {expect} = require('@playwright/test');
const {BasePage} = require('../../lib/pkp/playwright/pages/BasePage.js');
const {waitForJQueryIdle} = require('../../lib/pkp/playwright/support/jquery.js');

/**
 * POM for the Sections tab of the journal settings page
 * (/management/settings/context#sections) — the legacy
 * `pkp_controllers_linkAction` jQuery grid driven by OJS's
 * SectionGridHandler. OJS-only (sections are an OJS concept), hence
 * playwright/pages/.
 *
 * Consolidates the helpers that playwright/tests/sections.spec.js,
 * browse-category-section.spec.js and issue-archive-toc.spec.js have
 * been duplicating (open tab, open add/edit form, save form) and adds
 * the ordering + delete surfaces for the sections plan's row 6:
 *
 *   - Reorder: the grid mounts OrderGridItemsFeature. Clicking the
 *     grid-level "Order" action toggles jQuery-UI sortable mode on
 *     `tr.orderable` rows; "Done" POSTs the serialized row order to
 *     SectionGridHandler::saveSequence. The component router
 *     kebab-cases op names, so the POST lands on `.../save-sequence`
 *     (patterns.md rule 11).
 *   - Delete: row action -> RemoteActionConfirmationModal
 *     (`[data-cy="dialog"]` with OK/Cancel) -> POST `.../delete-section`.
 *     Both the success and the two refusal paths (section has
 *     submissions; last active section) respond with a
 *     DataChangedEvent, so callers assert on row presence afterwards —
 *     the POM only guarantees the POST settled.
 *
 * Self-contained and additive: existing specs keep their local
 * helpers; new specs should prefer this POM.
 */
exports.SectionsSettingsPage = class SectionsSettingsPage extends BasePage {
	/**
	 * @param {import('@playwright/test').Page} page
	 * @param {string} journalPath  the journal's urlPath
	 */
	constructor(page, journalPath) {
		super(page);
		this.journalPath = journalPath;
		this.gridContainer = page.locator('#sectionsGridContainer');
		this.addSectionAction = page.locator(
			'a[id^="component-grid-settings-sections-sectiongrid-addSection-button-"]',
		);
		this.orderAction = page.locator(
			'a[id^="component-grid-settings-sections-sectiongrid-orderItems-button-"]',
		);
		this.form = page.locator('form#sectionForm');
	}

	/**
	 * Navigate to the journal settings page and open the Sections tab.
	 * Waits for the async-loaded grid (load_url_in_div) to render its
	 * "Create Section" action before returning.
	 */
	async goto() {
		await this.page.goto(
			`/index.php/${this.journalPath}/management/settings/context`,
		);
		const tabButton = this.page.locator('#sections-button');
		await expect(tabButton).toBeVisible({timeout: 30_000});
		await tabButton.click();
		await expect(this.addSectionAction).toBeVisible({timeout: 30_000});
	}

	/**
	 * Locator for the data row (`tr.gridRow`) whose title cell matches.
	 *
	 * @param {string} title
	 */
	rowByTitle(title) {
		return this.gridContainer.locator(
			'tr.gridRow[id^="component-grid-settings-sections-sectiongrid-row-"]',
			{hasText: title},
		);
	}

	/**
	 * Section titles in current grid DOM order. The title is the text of
	 * the first column's `span.gridCellContainer` (gridCell.tpl); the
	 * surrounding td also carries the screen-reader "Settings" text of
	 * the `a.show_extras` toggle, so scope to the cell container.
	 *
	 * @returns {Promise<string[]>}
	 */
	async rowTitlesInOrder() {
		const rows = this.gridContainer.locator(
			'tr.gridRow[id^="component-grid-settings-sections-sectiongrid-row-"]',
		);
		await expect(rows.first()).toBeVisible({timeout: 15_000});
		const texts = await rows
			.locator('td:first-child span.gridCellContainer')
			.allTextContents();
		return texts.map((t) => t.trim());
	}

	/**
	 * Reveal a row's control row (Edit/Delete link actions). Legacy
	 * grids hide `tr.row_controls` until the row's `a.show_extras`
	 * toggle is clicked (patterns.md rule 9).
	 *
	 * @param {string} title
	 * @returns {Promise<{row: import('@playwright/test').Locator, rowId: string, controlRow: import('@playwright/test').Locator}>}
	 */
	async openRowControls(title) {
		const row = this.rowByTitle(title).first();
		await expect(row).toBeVisible({timeout: 15_000});
		const rowId = await row.getAttribute('id');
		if (!rowId) {
			throw new Error(`Section row "${title}" has no id attribute`);
		}
		const controlRow = this.page.locator(`tr[id="${rowId}-control-row"]`);
		if (!(await controlRow.isVisible())) {
			await row.locator('a.show_extras').click();
			await expect(controlRow).toBeVisible({timeout: 10_000});
		}
		return {row, rowId, controlRow};
	}

	/**
	 * Open the Create Section dialog. Returns the form locator.
	 */
	async openAddForm() {
		await this.addSectionAction.click();
		await expect(this.form).toBeVisible({timeout: 15_000});
		return this.form;
	}

	/**
	 * Open the Edit dialog for the section matching `title`. Returns
	 * the form locator.
	 *
	 * @param {string} title
	 */
	async openEditForm(title) {
		const {rowId} = await this.openRowControls(title);
		await this.page
			.locator(`a[id^="${rowId}-editSection-button-"]`)
			.first()
			.click();
		await expect(this.form).toBeVisible({timeout: 15_000});
		return this.form;
	}

	/**
	 * Submit the open section form and wait for AjaxFormHandler to close
	 * the dialog (its success path) and for the grid refresh to settle.
	 */
	async saveForm() {
		await this.form.getByRole('button', {name: 'Save'}).click();
		await expect(this.form).toHaveCount(0, {timeout: 15_000});
		await waitForJQueryIdle(this.page);
	}

	/**
	 * Enter the grid's ordering mode (jQuery-UI sortable on rows).
	 */
	async startOrdering() {
		await this.orderAction.click();
		// The order finish controls ("Done" / "Cancel ordering") become
		// visible once ordering mode is active.
		await expect(
			this.gridContainer.locator('.order_finish_controls a.saveButton'),
		).toBeVisible({timeout: 10_000});
	}

	/**
	 * Drag one grid row to sit above another via raw mouse events.
	 * jQuery-UI sortable needs real mousemove sequences — Playwright's
	 * dragTo issues too few moves for the sortable to re-sort reliably.
	 * Mirrors IssuePage#dragRowAbove (TOC grid, same sortable plumbing).
	 * Only meaningful while ordering mode is active (`startOrdering`).
	 *
	 * @param {import('@playwright/test').Locator} source  row to move
	 * @param {import('@playwright/test').Locator} target  row to land above
	 */
	async dragRowAbove(source, target) {
		await source.hover(); // auto-waits for visibility + stability
		const sourceBox = await source.boundingBox();
		const targetBox = await target.boundingBox();
		if (!sourceBox || !targetBox) {
			throw new Error('dragRowAbove: row has no bounding box');
		}
		const startX = sourceBox.x + sourceBox.width / 2;
		const startY = sourceBox.y + sourceBox.height / 2;
		await this.page.mouse.move(startX, startY);
		await this.page.mouse.down();
		// First small move exceeds the sortable's start distance…
		await this.page.mouse.move(startX, startY - 5);
		// …then walk to just inside the target's top edge so the
		// placeholder inserts BEFORE it (tolerance: 'pointer').
		await this.page.mouse.move(
			targetBox.x + targetBox.width / 2,
			targetBox.y + 3,
			{steps: 12},
		);
		await this.page.mouse.up();
	}

	/**
	 * Commit the new order: click the finish-controls "Done" link, which
	 * POSTs the serialized row order to SectionGridHandler::saveSequence
	 * (`…/save-sequence`, kebab-cased by the component router). Resolves
	 * once the POST returns and jQuery settles.
	 */
	async finishOrdering() {
		const saved = this.page.waitForResponse(
			(res) =>
				/save-sequence/i.test(res.url()) &&
				res.request().method() === 'POST',
			{timeout: 15_000},
		);
		await this.gridContainer
			.locator('.order_finish_controls a.saveButton')
			.click();
		await saved;
		await waitForJQueryIdle(this.page);
	}

	/**
	 * Click Delete on the section matching `title` and confirm the
	 * RemoteActionConfirmationModal. Waits for the `delete-section` POST
	 * to settle. Makes NO claim about the outcome — SectionGridHandler
	 * responds with a DataChangedEvent for the success AND both refusal
	 * paths (non-empty section / last active section); callers assert
	 * row presence (and the error toast, when the test owns the user's
	 * notification queue) afterwards.
	 *
	 * @param {string} title
	 */
	async deleteSection(title) {
		const {rowId} = await this.openRowControls(title);
		await this.page
			.locator(`a[id^="${rowId}-deleteSection-button-"]`)
			.first()
			.click();
		const dialog = this.page
			.locator('[data-cy="dialog"]')
			.filter({
				hasText: 'Are you sure you want to permanently delete this section?',
			})
			.first();
		await expect(dialog).toBeVisible({timeout: 10_000});
		const deleted = this.page.waitForResponse(
			(res) =>
				/delete-section/i.test(res.url()) &&
				res.request().method() === 'POST',
			{timeout: 15_000},
		);
		await dialog.getByRole('button', {name: 'OK', exact: true}).click();
		await deleted;
		await expect(dialog).toBeHidden({timeout: 10_000});
		await waitForJQueryIdle(this.page);
	}
};
