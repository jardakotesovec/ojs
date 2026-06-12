// @ts-check
const {expect} = require('../support/fixtures.js');

/**
 * POM for the DOI management page (`/index.php/<journal>/dois`,
 * pages/dois/DoisHandler.php → templates/management/dois.tpl).
 *
 * The page renders up to two tabs, each holding one DoiListPanel
 * (lib/ui-library DoiListPanelOJS):
 *   - #submission-doi-management ("Articles", submissionDoiListPanel) —
 *     present when any of publication/representation/peerReview/
 *     authorResponse DOI types are enabled;
 *   - #issue-doi-management ("Issues", issueDoiListPanel) — present when
 *     the issue DOI type is enabled.
 *
 * Parallel-safety contract (doi-management plan row 4): the submission
 * panel on the shared `publicknowledge` journal is a SHARED surface —
 * parallel tests keep minting DOIs into it. Never assert whole-list
 * composition; always narrow with `search(tag)` first and assert only
 * on the per-test item (`item('submission', id)`).
 *
 * List items carry the stable DOM id `#list-item-<type>-<id>`
 * (DoiListItem.vue) with <type> = the panel's itemType ('submission' |
 * 'issue') and <id> = submissionId/issueId. Expanded items expose one
 * text input per DOI-enabled pubObject, id'd `<itemId>-article-<pubId>`
 * for publications and `<itemId>-issue` for issues (DoiListPanelOJS
 * addDoiObjects()).
 */
exports.DoiManagementPage = class DoiManagementPage {
	/**
	 * @param {import('@playwright/test').Page} page
	 * @param {string} journalPath journal urlPath, e.g. 'publicknowledge'
	 */
	constructor(page, journalPath) {
		this.page = page;
		this.journalPath = journalPath;
		this.heading = page.getByRole('heading', {name: 'DOIs', exact: true});
		this.submissionsTabButton = page.locator(
			'#submission-doi-management-button',
		);
		this.issuesTabButton = page.locator('#issue-doi-management-button');
		this.submissionsPanel = page.locator('#submission-doi-management');
		this.issuesPanel = page.locator('#issue-doi-management');
	}

	async goto() {
		await this.page.goto(`/index.php/${this.journalPath}/dois`);
		await expect(this.heading).toBeVisible();
	}

	/**
	 * The list panel root for an item type.
	 *
	 * @param {'submission'|'issue'} type
	 */
	panel(type) {
		return type === 'submission' ? this.submissionsPanel : this.issuesPanel;
	}

	/**
	 * Activate the Issues tab (only rendered when issue DOIs are enabled).
	 */
	async gotoIssuesTab() {
		await this.issuesTabButton.click();
		await expect(this.issuesPanel).toBeVisible();
	}

	/**
	 * Narrow a panel's list to the test's unique tag. The Search component
	 * reacts to keyup only (debounced 250ms), so the phrase must be typed,
	 * not fill()ed. Resolves once the panel's filtered GET returns.
	 *
	 * @param {'submission'|'issue'} type
	 * @param {string} phrase whitespace-free unique tag
	 */
	async search(type, phrase) {
		const apiPath = type === 'submission' ? 'submissions' : 'issues';
		const responsePromise = this.page.waitForResponse(
			(res) =>
				res.url().includes(`/api/v1/${apiPath}`) &&
				res.url().includes(`searchPhrase=${encodeURIComponent(phrase)}`) &&
				res.ok(),
		);
		await this.panel(type)
			.locator('input[type="search"]')
			.pressSequentially(phrase);
		await responsePromise;
	}

	/**
	 * Toggle a sidebar filter by its visible title and wait for the
	 * re-fetch it triggers. Filter titles overlap as substrings
	 * ("Registered" ⊂ "Unregistered"), hence exact matching.
	 *
	 * @param {'submission'|'issue'} type
	 * @param {string} title e.g. 'Needs DOI', 'DOI Assigned', 'Unregistered', 'Registered'
	 */
	async toggleFilter(type, title) {
		const apiPath = type === 'submission' ? 'submissions' : 'issues';
		const responsePromise = this.page.waitForResponse(
			(res) => res.url().includes(`/api/v1/${apiPath}`) && res.ok(),
		);
		await this.panel(type)
			.locator('.pkpFilter')
			.getByRole('button', {name: title, exact: true})
			.click();
		await responsePromise;
	}

	/**
	 * The list item root for a seeded pubObject.
	 *
	 * @param {'submission'|'issue'} type
	 * @param {number} id submissionId or issueId
	 */
	item(type, id) {
		return this.page.locator(`#list-item-${type}-${id}`);
	}

	/**
	 * The status Badge on a (collapsed or expanded) list item.
	 *
	 * @param {'submission'|'issue'} type
	 * @param {number} id
	 */
	badge(type, id) {
		return this.item(type, id).locator('.doiListItem__itemMetadata--badge');
	}

	/**
	 * Tick the item's bulk-selection checkbox.
	 *
	 * @param {'submission'|'issue'} type
	 * @param {number} id
	 */
	async selectItem(type, id) {
		await this.item(type, id)
			.locator(`input[type="checkbox"][value="${id}"]`)
			.check();
	}

	/**
	 * Expand an item to reveal its per-pubObject DOI table.
	 *
	 * @param {'submission'|'issue'} type
	 * @param {number} id
	 */
	async expandItem(type, id) {
		const item = this.item(type, id);
		await item.locator('button.expander').click();
		await expect(item.locator('.listPanel__itemExpanded')).toBeVisible();
	}

	/**
	 * The DOI text input for a publication inside an expanded submission
	 * item (id convention from DoiListPanelOJS: `<subId>-article-<pubId>`).
	 *
	 * @param {number} submissionId
	 * @param {number} publicationId
	 */
	publicationDoiInput(submissionId, publicationId) {
		// [id=...] instead of #...: the id starts with a digit, which the
		// CSS #-selector grammar rejects.
		return this.page.locator(`[id="${submissionId}-article-${publicationId}"]`);
	}

	/**
	 * The DOI text input inside an expanded issue item
	 * (id convention: `<issueId>-issue`).
	 *
	 * @param {number} issueId
	 */
	issueDoiInput(issueId) {
		return this.page.locator(`[id="${issueId}-issue"]`);
	}

	/**
	 * Open the panel's "Bulk Actions" dropdown (idempotent — leaves it open).
	 *
	 * State-aware on purpose: the Dropdown toggles on click and only
	 * closes on blur, so after a previous bulk action it may still be
	 * open (the blur from the confirmation dialog's focus grab races the
	 * dialog teardown). A blind click would then toggle it CLOSED.
	 * The toPass retry also absorbs a click landing mid-close.
	 *
	 * @param {'submission'|'issue'} type
	 */
	async openBulkActions(type) {
		const panel = this.panel(type);
		const button = panel.getByRole('button', {name: 'Bulk Actions'});
		const content = panel.locator('.pkpDropdown__content');
		await expect(async () => {
			if (!(await content.isVisible())) {
				await button.click();
			}
			await expect(content).toBeVisible({timeout: 2_000});
		}).toPass();
	}

	/**
	 * Close the panel's "Bulk Actions" dropdown if it is open. Needed
	 * after dialog-driven bulk actions: the dialog restores focus to its
	 * trigger (the action button inside the dropdown) on close, so the
	 * dropdown never blurs shut and its content keeps overlaying — and
	 * intercepting pointer events for — the first list items.
	 *
	 * @param {'submission'|'issue'} type
	 */
	async closeBulkActions(type) {
		const panel = this.panel(type);
		const button = panel.getByRole('button', {name: 'Bulk Actions'});
		const content = panel.locator('.pkpDropdown__content');
		await expect(async () => {
			if (await content.isVisible()) {
				await button.click();
			}
			await expect(content).toBeHidden({timeout: 2_000});
		}).toPass();
	}

	/**
	 * Run a bulk action against the currently-selected items: opens the
	 * Bulk Actions dropdown, picks the action, confirms the dialog, and
	 * waits for both the action call and the list re-fetch that
	 * onBulkActionComplete() fires. Selection is cleared by the panel
	 * afterwards, and the dropdown is closed so it can't overlay the
	 * refreshed list.
	 *
	 * NEVER pass a Deposit action here — deposits would attempt outbound
	 * HTTP to Crossref (firewalled in the test environment, and forbidden
	 * by the e2e charter).
	 *
	 * @param {'submission'|'issue'} type
	 * @param {string} actionLabel menu/dialog label, e.g. 'Mark DOIs Registered',
	 *   'Assign DOIs', 'Export DOIs'
	 * @param {string} apiAction API route suffix the action calls, e.g.
	 *   'markRegistered', 'assignDois', 'export'
	 */
	async bulkAction(type, actionLabel, apiAction) {
		const apiPath = type === 'submission' ? 'submissions' : 'issues';
		await this.openBulkActions(type);
		await this.panel(type)
			.locator('.pkpDropdown__content')
			.getByRole('button', {name: actionLabel, exact: true})
			.click();

		const dialog = this.page
			.locator('[data-cy="dialog"]')
			.filter({hasText: actionLabel});
		await expect(dialog).toBeVisible();

		const actionResponse = this.page.waitForResponse(
			(res) =>
				res.url().includes(`/api/v1/dois/${apiPath}/${apiAction}`) &&
				res.ok(),
		);
		// onBulkActionComplete() refreshes the list after the action.
		const refreshResponse = this.page.waitForResponse(
			(res) =>
				res.url().includes(`/api/v1/${apiPath}`) &&
				res.request().method() === 'GET' &&
				res.ok(),
		);
		await dialog
			.getByRole('button', {name: actionLabel, exact: true})
			.click();
		await actionResponse;
		await refreshResponse;
		await expect(dialog).toBeHidden();
		await this.closeBulkActions(type);
	}
};
