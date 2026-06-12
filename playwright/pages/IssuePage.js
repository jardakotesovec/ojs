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
		const editLink = await this.rowAction(this.futureRow(issue), 'edit');
		await editLink.click();
		await expect(this.editIssueTabs).toBeVisible({timeout: 15_000});
		// jQuery-UI tabs auto-load the first tab (Table of Contents) via
		// AJAX; the grid then arrives through a nested load_url_in_div.
		await expect(this.tocGridContainer).toBeVisible({timeout: 15_000});
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
