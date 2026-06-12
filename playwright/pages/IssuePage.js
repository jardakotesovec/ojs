// @ts-check
const {expect} = require('@playwright/test');
const {BasePage} = require('../../lib/pkp/playwright/pages/BasePage.js');
const {waitForJQueryIdle} = require('../../lib/pkp/playwright/support/jquery.js');

/**
 * POM for the OJS issue management page (`/{path}/manageIssues`).
 * OJS-specific.
 *
 * The page is a Vue tab shell ("Future Issues" / "Back Issues") wrapping
 * two legacy pkp_controllers jQuery grids — FutureIssueGrid and
 * BackIssueGrid. Row actions (Edit, Publish Issue, …) hide inside a
 * per-row `tr.row_controls` sibling that only becomes visible after the
 * row's settings glyph (`a.show_extras`) is clicked; action link ids are
 * prefixed with the gridRow's own id
 * (`component-grid-issues-futureissuegrid-row-{issueId}-{action}-button-…`).
 *
 * The Edit action opens a jQuery-UI tabset (`#editIssueTabs`: Table of
 * Contents / Issue Data / Issue Galleys). The first tab auto-loads the
 * TOC category grid into `#issueTocGridContainer` — sections as category
 * rows, one row per published OR scheduled article
 * (`Repo::submission()->getInSections` filters by
 * [STATUS_PUBLISHED, STATUS_SCHEDULED]).
 *
 * All legacy-grid interactions wait on `waitForJQueryIdle` after AJAX
 * chains (tab loads, form saves) — see patterns.md "Wait on jQuery to
 * settle".
 */
exports.IssuePage = class IssuePage extends BasePage {
	/** @param {import('@playwright/test').Page} page */
	constructor(page) {
		super(page);
		this.futureGrid = page.locator('#futureIssuesGridContainer');
		this.backGrid = page.locator('#backIssuesGridContainer');
		this.addIssueLink = page.locator(
			'a[id^="component-grid-issues-futureissuegrid-addIssue-button-"]',
		);
		this.editIssueTabs = page.locator('#editIssueTabs');
		this.tocGridContainer = page.locator('#issueTocGridContainer');
	}

	/**
	 * The identification string the grids render for an issue without a
	 * shown title, e.g. "Vol. 2 No. 1 (2015)".
	 *
	 * @param {{volume: number|string, number: number|string, year: number|string}} issue
	 */
	identification({volume, number, year}) {
		return `Vol. ${volume} No. ${number} (${year})`;
	}

	/**
	 * Open the issue management page. Lands on the Future Issues tab;
	 * waits for the future grid's Create Issue action so follow-up row
	 * lookups don't race the initial grid load.
	 *
	 * @param {string} [contextPath='publicknowledge']
	 */
	async goto(contextPath = 'publicknowledge') {
		await this.page.goto(`/index.php/${contextPath}/manageIssues`);
		await expect(this.addIssueLink).toBeVisible({timeout: 15_000});
		await waitForJQueryIdle(this.page);
	}

	/**
	 * Locate a future-issue grid row by its identification text.
	 *
	 * @param {{volume: number|string, number: number|string, year: number|string}} issue
	 */
	futureRow(issue) {
		return this.futureGrid.locator('tr.gridRow', {
			hasText: this.identification(issue),
		});
	}

	/**
	 * Locate a back-issue grid row by its identification text. The Back
	 * Issues tab must be open (see `openBackTab`) before interacting.
	 *
	 * @param {{volume: number|string, number: number|string, year: number|string}} issue
	 */
	backRow(issue) {
		return this.backGrid.locator('tr.gridRow', {
			hasText: this.identification(issue),
		});
	}

	/**
	 * Switch to the Back Issues tab. The Vue tab shell lazy-loads the
	 * legacy BackIssueGrid through a load_url_in_div fetch — wait for
	 * jQuery to settle so row lookups don't race the grid render.
	 */
	async openBackTab() {
		await this.page.locator('#back-button').click();
		await expect(this.backGrid).toBeVisible({timeout: 15_000});
		await waitForJQueryIdle(this.page);
	}

	/**
	 * Switch to the Future Issues tab (the landing tab; useful after
	 * `openBackTab`). Same load_url_in_div rationale as `openBackTab`.
	 */
	async openFutureTab() {
		await this.page.locator('#future-button').click();
		await expect(this.addIssueLink).toBeVisible({timeout: 15_000});
		await waitForJQueryIdle(this.page);
	}

	/**
	 * Expand a grid row's hidden `tr.row_controls` sibling by clicking the
	 * row's settings glyph. No-op when the row is already expanded (the
	 * glyph's class flips to `hide_extras` after one click). Pure
	 * client-side toggle — no AJAX involved.
	 *
	 * @param {import('@playwright/test').Locator} row  a tr.gridRow locator
	 */
	async expandRow(row) {
		const toggle = row.first().locator('a.show_extras');
		if ((await toggle.count()) > 0) {
			await toggle.first().click();
		}
	}

	/**
	 * Resolve a row-action link (`a[id^="{rowId}-{action}-button-"]`) for
	 * a given grid row, expanding the row controls first.
	 *
	 * @param {import('@playwright/test').Locator} row  a tr.gridRow locator
	 * @param {string} action  e.g. 'edit', 'publish', 'unpublish'
	 */
	async rowAction(row, action) {
		await expect(row.first()).toBeVisible({timeout: 15_000});
		await this.expandRow(row);
		const rowId = await row.first().getAttribute('id');
		if (!rowId) {
			throw new Error('issue grid row has no id attribute');
		}
		return this.page.locator(`a[id^="${rowId}-${action}-button-"]`);
	}

	/**
	 * Open the Edit Issue modal for a future issue and wait for its
	 * Table of Contents tab (the default first tab) to finish loading the
	 * TOC grid. Read-only navigation — nothing is saved.
	 *
	 * Callers assert on `this.tocGridContainer` afterwards, e.g.
	 *   await expect(issuePage.tocGridContainer).toContainText(title);
	 *   await expect(issuePage.tocEntry(title)).toHaveCount(0);
	 *
	 * @param {{volume: number|string, number: number|string, year: number|string}} issue
	 */
	async openFutureIssueToc(issue) {
		await this.openIssueToc(this.futureRow(issue));
	}

	/**
	 * Open the Edit Issue modal for any grid row (future or back) and
	 * wait for the Table of Contents tab to finish loading. Generalized
	 * body of `openFutureIssueToc` — back-issue TOCs pass
	 * `issuePage.backRow(issue)` after `openBackTab()`.
	 *
	 * @param {import('@playwright/test').Locator} row  a tr.gridRow locator
	 */
	async openIssueToc(row) {
		const editLink = await this.rowAction(row, 'edit');
		await editLink.click();
		await expect(this.editIssueTabs).toBeVisible({timeout: 15_000});
		// jQuery-UI tabs auto-load the first tab (Table of Contents) via
		// AJAX; the grid then arrives through a nested load_url_in_div.
		await expect(this.tocGridContainer).toBeVisible({timeout: 15_000});
		await waitForJQueryIdle(this.page);
	}

	/**
	 * Article rows of the loaded TOC grid, in display order. Category
	 * (section) header rows also carry `gridRow` — they SHOULD be
	 * distinguishable by a `category` class, but gridRow.tpl's
	 * `{if is_a($row, 'GridCategoryRow')}` checks the pre-namespacing
	 * class name and never matches `PKP\controllers\grid\GridCategoryRow`,
	 * so the class is missing (app-side cosmetic bug; see wave-7 report).
	 * Discriminate structurally instead: only article rows carry the
	 * per-row Settings toggle (`a.show_extras`).
	 */
	tocArticleRows() {
		// The toggle's class flips show_extras → hide_extras once a row is
		// expanded, so match either state.
		return this.tocGridContainer.locator(
			'tr.gridRow:has(a.show_extras), tr.gridRow:has(a.hide_extras)',
		);
	}

	/**
	 * A TOC-grid article row matching the given (tagged, unique) title.
	 * Use with `rowAction`/`confirmRowAction` (e.g. the removeArticle
	 * action).
	 *
	 * @param {string} articleTitle
	 */
	tocArticleRow(articleTitle) {
		return this.tocArticleRows().filter({hasText: articleTitle});
	}

	/**
	 * Enter the TOC grid's ordering mode (OrderCategoryGridItemsFeature).
	 * The grid-level "Order" action toggles drag mode: section tbodys and
	 * article rows become jQuery-UI sortables and the Done/Cancel finish
	 * controls slide down. Waits for the Done control so subsequent
	 * boundingBox reads don't race the 300ms slideDown.
	 */
	async startTocOrdering() {
		await this.tocGridContainer
			.locator('a.pkp_linkaction_orderItems')
			.click();
		await expect(
			this.tocGridContainer.locator('.order_finish_controls a.saveButton'),
		).toBeVisible({timeout: 15_000});
	}

	/**
	 * Drag one grid row to sit above another via raw mouse events.
	 * jQuery-UI sortable needs real mousemove sequences (Playwright's
	 * dragTo issues too few moves for nested sortables to re-sort
	 * reliably). `hover()` first — it auto-waits for the row to stop
	 * moving (the ordering-mode toggles animate).
	 *
	 * Only meaningful while ordering mode is active (`startTocOrdering`).
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
	 * POSTs the serialized category+row order to TocGridHandler::
	 * saveSequence. Resolves once the POST returns and jQuery settles.
	 */
	async finishTocOrdering() {
		// The component router hyphenates camelCase ops in URLs:
		// TocGridHandler::saveSequence is POSTed to
		// `$$$call$$$/grid/toc/toc-grid/save-sequence`.
		const saved = this.page.waitForResponse(
			(res) =>
				/save-?sequence/i.test(res.url()) &&
				res.request().method() === 'POST',
			{timeout: 15_000},
		);
		await this.tocGridContainer
			.locator('.order_finish_controls a.saveButton')
			.click();
		await saved;
		await waitForJQueryIdle(this.page);
	}

	/**
	 * Open the Edit Issue modal on the given row and switch to the
	 * "Issue Data" tab (lazy-loaded IssueForm). Returns the form locator.
	 *
	 * @param {import('@playwright/test').Locator} row  a tr.gridRow locator
	 * @returns {Promise<import('@playwright/test').Locator>} form#issueForm
	 */
	async openIssueDataTab(row) {
		const editLink = await this.rowAction(row, 'edit');
		await editLink.click();
		await expect(this.editIssueTabs).toBeVisible({timeout: 15_000});
		await this.editIssueTabs
			.locator('a', {hasText: 'Issue Data'})
			.click();
		const form = this.page.locator('form#issueForm');
		await expect(form.locator('input[name="volume"]')).toBeAttached({
			timeout: 15_000,
		});
		await waitForJQueryIdle(this.page);
		return form;
	}

	/**
	 * Submit the Issue Data form and wait for the save to land.
	 * AjaxFormHandler closes the whole Edit side-modal on success, so
	 * the tabset detaching is the canonical "saved" signal (a validation
	 * failure re-renders the form instead and this times out — which is
	 * the failure we want surfaced).
	 */
	async saveIssueForm() {
		const form = this.page.locator('form#issueForm');
		await form.locator('button[id^="submitFormButton"]').click();
		await expect(this.editIssueTabs).toHaveCount(0, {timeout: 15_000});
		await waitForJQueryIdle(this.page);
	}

	/**
	 * Upload a cover image into the open Issue Data form's plupload
	 * widget. The HTML5 runtime appends its real `<input type=file>`
	 * inside a `div.moxie-shim` at document body; `setInputFiles` on it
	 * feeds plupload directly (clicking the styled button would open a
	 * native OS dialog). Upload completion is signalled by
	 * FileUploadFormHandler writing the returned id into the hidden
	 * `#temporaryFileId` — the value the subsequent save consumes.
	 *
	 * @param {string} filePath  absolute path to a jpg/png/svg fixture
	 */
	async uploadCoverImage(filePath) {
		const form = this.page.locator('form#issueForm');
		await this.page
			.locator('.moxie-shim input[type=file]')
			.last()
			.setInputFiles(filePath);
		await expect(form.locator('input#temporaryFileId')).not.toHaveValue(
			'',
			{timeout: 20_000},
		);
	}

	/**
	 * Open the Edit Issue modal on the given row and switch to the
	 * "Issue Galleys" tab; waits for the lazy-loaded IssueGalleyGrid's
	 * "Create New Issue Galley" action.
	 *
	 * @param {import('@playwright/test').Locator} row  a tr.gridRow locator
	 */
	async openIssueGalleysTab(row) {
		const editLink = await this.rowAction(row, 'edit');
		await editLink.click();
		await expect(this.editIssueTabs).toBeVisible({timeout: 15_000});
		await this.editIssueTabs
			.locator('a', {hasText: 'Issue Galleys'})
			.click();
		await expect(
			this.page.locator('#issueGalleysGridContainer a.pkp_linkaction_add'),
		).toBeVisible({timeout: 15_000});
		await waitForJQueryIdle(this.page);
	}

	/**
	 * Create an issue galley from the open Issue Galleys tab: the add
	 * action opens the IssueGalleyForm AjaxModal (label + locale +
	 * plupload upload to IssueGalleyGridHandler::upload). A new galley
	 * REQUIRES a file (temporaryFileId is a required form check). The
	 * modal closes and the grid refreshes on successful save.
	 *
	 * @param {{label: string, filePath: string, locale?: string}} opts
	 */
	async addIssueGalley({label, filePath, locale = 'en'}) {
		await this.page
			.locator('#issueGalleysGridContainer a.pkp_linkaction_add')
			.click();
		const form = this.page.locator('form#issueGalleyForm');
		await expect(form.locator('input[name="label"]')).toBeAttached({
			timeout: 15_000,
		});
		await form.locator('input[name="label"]').fill(label);
		await form.locator('select[name="galleyLocale"]').selectOption(locale);
		await this.page
			.locator('.moxie-shim input[type=file]')
			.last()
			.setInputFiles(filePath);
		await expect(form.locator('input#temporaryFileId')).not.toHaveValue(
			'',
			{timeout: 20_000},
		);
		await form.locator('button[id^="submitFormButton"]').click();
		await expect(form).toHaveCount(0, {timeout: 15_000});
		await waitForJQueryIdle(this.page);
	}

	/**
	 * Run a row action that opens a RemoteActionConfirmationModal
	 * (delete, unpublish, setCurrentIssue, the TOC grid's removeArticle)
	 * and confirm it. Waits for the dialog to close and the chained grid
	 * refresh to settle.
	 *
	 * @param {import('@playwright/test').Locator} row  a tr.gridRow locator
	 * @param {string} action  e.g. 'delete', 'unpublish', 'removeArticle'
	 * @param {{dialogText: string}} opts  distinctive confirmation text
	 */
	async confirmRowAction(row, action, {dialogText}) {
		const link = await this.rowAction(row, action);
		await link.click();
		const dialog = this.page.locator('[role="dialog"]', {
			hasText: dialogText,
		});
		await expect(dialog).toBeVisible({timeout: 15_000});
		await dialog.getByRole('button', {name: 'OK'}).click();
		await expect(dialog).toHaveCount(0, {timeout: 15_000});
		await waitForJQueryIdle(this.page);
	}

	/**
	 * A TOC-grid entry matching the given (tagged, unique) article title.
	 * Use `expect(...).toBeVisible()` for presence and `toHaveCount(0)`
	 * for bounded absence — `openFutureIssueToc` has already waited for
	 * the grid to finish loading.
	 *
	 * @param {string} articleTitle
	 */
	tocEntry(articleTitle) {
		return this.tocGridContainer.getByText(articleTitle);
	}

	/**
	 * Publish a future issue via its per-row "Publish Issue" action.
	 * The action opens the AssignPublicIdentifiersForm AjaxModal whose
	 * submit confirms the publish; `sendIssueNotification` defaults OFF
	 * here (the template renders it checked) so parallel specs don't
	 * spray "issue published" mail at the shared Mailpit inbox — pass
	 * `{sendNotification: true}` from tests that assert on that email.
	 *
	 * Server side (IssueGridHandler::publishIssue): flips the issue
	 * published, stamps datePublished, promotes it to current via
	 * Repo::issue::updateCurrent, and publishes every publication
	 * scheduled into it.
	 *
	 * @param {{volume: number|string, number: number|string, year: number|string}} issue
	 * @param {{sendNotification?: boolean}} [opts]
	 */
	async publishIssue(issue, {sendNotification = false} = {}) {
		const publishLink = await this.rowAction(this.futureRow(issue), 'publish');
		await publishLink.click();

		const publishForm = this.page.locator('form#assignPublicIdentifierForm');
		await expect(publishForm).toBeVisible({timeout: 15_000});
		// No {force: true}: force bypasses the stability wait and a click
		// mid-modal-transition can land on stale coordinates (see
		// issues.spec.js fillIssueForm rationale).
		const checkbox = publishForm.locator('input#sendIssueNotification');
		if (sendNotification) {
			await checkbox.check();
		} else {
			await checkbox.uncheck();
		}
		await publishForm.locator('button[id^="submitFormButton"]').click();
		await expect(publishForm).toHaveCount(0, {timeout: 15_000});
		// AjaxFormHandler chains close + grid refresh; settle before the
		// caller's next grid interaction or navigation.
		await waitForJQueryIdle(this.page);
	}
};
