// @ts-check
const {expect} = require('@playwright/test');
const {BasePage} = require('../../lib/pkp/playwright/pages/BasePage.js');
const {waitForJQueryIdle} = require('../../lib/pkp/playwright/support/jquery.js');

/**
 * POM for the OJS subscriptions management page (`/{path}/payments`) —
 * the legacy jQuery TabHandler page hosting the Subscription Types,
 * Individual/Institutional Subscriptions and Subscription Policies
 * grids/forms (pages/payments/PaymentsHandler.php). OJS-only.
 *
 * Wave 11. Conventions inherited from subscription-config.spec.js /
 * subscription-access.spec.js (which predate this POM and drive the
 * same surfaces inline — those specs are read-only history; new tests
 * use this POM):
 *
 *   - Tabs are `a[name="<op>"]` anchors driven by
 *     $.pkp.controllers.TabHandler; each tab load is an AJAX fetch, so
 *     every tab switch waits on `waitForJQueryIdle`.
 *   - Grid row actions hide in a `tr.row_controls` sibling until the
 *     row's settings glyph (`a.show_extras`) is clicked; action link ids
 *     are prefixed with the row's own id
 *     (`component-grid-subscriptions-…-row-{id}-{action}-button-…`) —
 *     same pattern as IssuePage#rowAction.
 *   - The legacy fbv datepicker fields render TWO inputs sharing a name
 *     (visible text + hidden alt-field); FormHandler.js#75 renames the
 *     visible one to `{name}-removed` on init. `fillDatepicker` writes
 *     BOTH names via JS + change events so the value lands correctly
 *     whether or not the init has run (see the long rationale in
 *     subscription-access.spec.js's subscriber test).
 */
exports.SubscriptionManagementPage = class SubscriptionManagementPage extends (
	BasePage
) {
	/**
	 * @param {import('@playwright/test').Page} page
	 * @param {string} journalPath  scratch journal urlPath
	 */
	constructor(page, journalPath) {
		super(page);
		this.journalPath = journalPath;
		this.typesGrid = page.locator('#subscriptionTypesGridContainer');
		this.individualGrid = page.locator(
			'#individualSubscriptionsGridContainer',
		);
		this.institutionalGrid = page.locator(
			'#institutionalSubscriptionsGridContainer',
		);
		this.typeForm = page.locator('form#subscriptionTypeForm');
		this.individualForm = page.locator('form#individualSubscriptionForm');
		this.institutionalForm = page.locator(
			'form#institutionalSubscriptionForm',
		);
		this.policiesForm = page.locator('form#subscriptionPolicies');
	}

	/**
	 * Open /payments and switch to the Subscription Types tab.
	 */
	async gotoTypesTab() {
		await this.page.goto(`/index.php/${this.journalPath}/payments`);
		await this.page.locator('a[name="subscriptionTypes"]').click();
		await waitForJQueryIdle(this.page);
		await expect(
			this.page.locator('a.pkp_linkaction_addSubscriptionType'),
		).toBeVisible({timeout: 15_000});
	}

	/**
	 * Open /payments and switch to the Individual Subscriptions tab.
	 * Waits for the grid's "Create New Subscription" action.
	 */
	async gotoIndividualTab() {
		await this.page.goto(`/index.php/${this.journalPath}/payments`);
		await this.page.locator('a[name="individualSubscription"]').click();
		await waitForJQueryIdle(this.page);
		await expect(this.individualAddAction()).toBeVisible({timeout: 15_000});
	}

	/**
	 * Open /payments and switch to the Institutional Subscriptions tab.
	 */
	async gotoInstitutionalTab() {
		await this.page.goto(`/index.php/${this.journalPath}/payments`);
		await this.page.locator('a[name="institutionalSubscriptions"]').click();
		await waitForJQueryIdle(this.page);
		await expect(this.institutionalAddAction()).toBeVisible({
			timeout: 15_000,
		});
	}

	/**
	 * Open /payments and switch to the Subscription Policies tab.
	 */
	async gotoPoliciesTab() {
		await this.page.goto(`/index.php/${this.journalPath}/payments`);
		await this.page.locator('a[name="subscriptionPolicies"]').click();
		await waitForJQueryIdle(this.page);
		await expect(this.policiesForm).toBeVisible({timeout: 15_000});
	}

	/**
	 * Grid-level "Create New Subscription" actions. PKPHandler#setId chops
	 * the trailing "Handler" off the component id and lowercases the rest,
	 * so the stable id prefixes are
	 * `component-grid-subscriptions-{in,…}subscriptionsgrid-addSubscription-button-`.
	 */
	individualAddAction() {
		return this.page.locator(
			'a[id^="component-grid-subscriptions-individualsubscriptionsgrid-addSubscription-button-"]',
		);
	}

	institutionalAddAction() {
		return this.page.locator(
			'a[id^="component-grid-subscriptions-institutionalsubscriptionsgrid-addSubscription-button-"]',
		);
	}

	/**
	 * Create a subscription type through the "Create New Subscription Type"
	 * AjaxModal. Mirrors the (pre-POM) helper in subscription-config.spec.js.
	 *
	 * @param {object} opts
	 * @param {string} opts.name
	 * @param {string} opts.cost
	 * @param {string} opts.duration  months
	 * @param {string} [opts.currency='CAD']
	 * @param {boolean} [opts.institutional=false]
	 */
	async createType({name, cost, duration, currency = 'CAD', institutional = false}) {
		await this.page.locator('a.pkp_linkaction_addSubscriptionType').click();
		const form = this.typeForm;
		await expect(form).toBeVisible({timeout: 10_000});
		await form.locator('input[name="name[en]"]').fill(name);
		await form.locator('select#currency').selectOption(currency);
		await form.locator('input[name="cost"]').fill(cost);
		// SUBSCRIPTION_TYPE_FORMAT_ONLINE is the first $validFormats option.
		await form.locator('select#format').selectOption({index: 0});
		await form.locator('input[name="duration"]').fill(duration);
		// fbv radios are styled — force past the overlay.
		await form
			.locator(institutional ? 'input#institutional' : 'input#individual')
			.check({force: true});
		await this.saveLegacyForm(form);
	}

	/**
	 * A types-grid row by (tag-unique) type name.
	 *
	 * @param {string} name
	 */
	typeRow(name) {
		return this.typesGrid.locator('tr.gridRow', {hasText: name});
	}

	/**
	 * Resolve a row-action link (`a[id^="{rowId}-{action}-button-"]`),
	 * expanding the row's hidden controls first. Mirrors
	 * IssuePage#rowAction. The expand glyph's class flips show_extras →
	 * hide_extras once expanded, so the toggle click is skipped when the
	 * row is already open.
	 *
	 * @param {import('@playwright/test').Locator} row  a tr.gridRow locator
	 * @param {string} action  LinkAction id: 'edit' | 'delete' | 'renew'
	 */
	async rowAction(row, action) {
		await expect(row.first()).toBeVisible({timeout: 15_000});
		const toggle = row.first().locator('a.show_extras');
		if ((await toggle.count()) > 0) {
			await toggle.first().click();
		}
		const rowId = await row.first().getAttribute('id');
		if (!rowId) {
			throw new Error('subscription grid row has no id attribute');
		}
		return this.page.locator(`a[id^="${rowId}-${action}-button-"]`);
	}

	/**
	 * Run a row action that opens a RemoteActionConfirmationModal (delete,
	 * renew) and confirm it; waits for the chained grid refresh.
	 *
	 * @param {import('@playwright/test').Locator} row
	 * @param {string} action
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
	 * Pick a user in the SubscriberSelect grid embedded in the
	 * individual/institutional subscription forms (load_url_in_div →
	 * form#userSearchForm + radio rows). Call after the host form is
	 * visible AND jQuery is idle (the embedded grid loads async).
	 *
	 * @param {string} searchTerm  e.g. family name 'Hudson'
	 * @param {string} fullName    row text to match, e.g. 'Paul Hudson'
	 */
	async pickSubscriber(searchTerm, fullName) {
		const userSearch = this.page.locator('form#userSearchForm');
		await expect(userSearch).toBeVisible({timeout: 10_000});
		await userSearch.locator('input[name="search"]').fill(searchTerm);
		await userSearch
			.getByRole('button', {name: 'Search', exact: true})
			.click();
		await waitForJQueryIdle(this.page);
		const row = this.page.locator(
			'#subscriberSelectGridContainer tr.gridRow',
			{hasText: fullName},
		);
		await expect(row).toBeVisible({timeout: 15_000});
		await row.locator('input[type="radio"][name="userId"]').check({
			force: true,
		});
	}

	/**
	 * Select the FIRST non-empty option of the form's `typeId` select.
	 * Unambiguous on scratch journals where the test created exactly one
	 * type of the matching institutional flag.
	 *
	 * @param {import('@playwright/test').Locator} form
	 */
	async selectOnlyType(form) {
		const typeSelect = form.locator('select[name="typeId"]');
		const typeValue = await typeSelect
			.locator('option:not([value=""])')
			.first()
			.getAttribute('value');
		if (!typeValue) {
			throw new Error('typeId select is empty — type creation failed');
		}
		await typeSelect.selectOption(typeValue);
	}

	/**
	 * Write a `YYYY-MM-DD` value into a legacy fbv datepicker field —
	 * see the module-level `fillLegacyDatepicker`.
	 *
	 * @param {string} formSelector  e.g. 'form#individualSubscriptionForm'
	 * @param {string} fieldName     e.g. 'dateEnd' | 'openAccessDate'
	 * @param {string} isoDate       'YYYY-MM-DD'
	 */
	async fillDatepicker(formSelector, fieldName, isoDate) {
		await exports.fillLegacyDatepicker(
			this.page,
			formSelector,
			fieldName,
			isoDate,
		);
	}

	/**
	 * Submit a legacy AjaxFormHandler form and wait for the success chain
	 * (POST + close modal + grid refresh). A validation failure re-renders
	 * the form inline, so the modal-closed assertion times out — which is
	 * the failure signal we want.
	 *
	 * Click by accessible name, NOT `button[type=submit]`: the
	 * subscription forms embed the SubscriberSelect grid (load_url_in_div
	 * inserts its nested `form#userSearchForm` into the host form's DOM
	 * subtree), so the first submit-typed descendant is the grid's
	 * "Search" button — clicking it refreshes the grid and silently
	 * clears the picked radio instead of saving.
	 *
	 * @param {import('@playwright/test').Locator} form
	 */
	async saveLegacyForm(form) {
		await form.getByRole('button', {name: 'Save', exact: true}).click();
		await waitForJQueryIdle(this.page);
		await expect(form).toHaveCount(0, {timeout: 15_000});
	}
};

/**
 * Write a `YYYY-MM-DD` value into a legacy fbv datepicker field by
 * setting BOTH the canonical hidden alt-field (`name={field}`) and the
 * visible text input (renamed `{field}-removed` by FormHandler.js#75 on
 * init) via JS + change events. Safe whether or not the init has run.
 * Standalone export so non-/payments legacy forms (e.g. the issue
 * Access tab's `openAccessDate`) can reuse it.
 *
 * @param {import('@playwright/test').Page} page
 * @param {string} formSelector  e.g. 'form#issueAccessForm'
 * @param {string} fieldName     e.g. 'dateEnd' | 'openAccessDate'
 * @param {string} isoDate       'YYYY-MM-DD'
 */
exports.fillLegacyDatepicker = async function fillLegacyDatepicker(
	page,
	formSelector,
	fieldName,
	isoDate,
) {
	await page.evaluate(
		({formSelector, fieldName, isoDate}) => {
			for (const name of [fieldName, `${fieldName}-removed`]) {
				document
					.querySelectorAll(`${formSelector} input[name="${name}"]`)
					.forEach((el) => {
						/** @type {HTMLInputElement} */ (el).value = isoDate;
						el.dispatchEvent(new Event('change', {bubbles: true}));
					});
			}
		},
		{formSelector, fieldName, isoDate},
	);
};

/**
 * Enable + configure payments on a scratch journal through the
 * `PUT /api/v1/_payments` REST endpoint (the same call the Distribution →
 * Payments Vue form makes), using the page's session cookies and the
 * backend-page CSRF token. Setup-grade: the Payments-form UI itself is
 * covered by subscription-config.spec.js's payments test.
 *
 * Gotcha (PKPBackendPaymentsSettingsController::edit#100-103): the
 * controller string-compares `paymentsEnabled === 'true'`, so the value
 * MUST be the string 'true' — a JSON boolean silently disables payments.
 *
 * ManualPaymentPlugin::isConfigured additionally requires a non-empty
 * `manualInstructions` plugin setting (saved through the
 * API::payments::settings::edit hook), so it is always sent.
 *
 * @param {import('@playwright/test').Page} page  authenticated as a journal manager
 * @param {string} journalPath
 */
exports.enableManualPayments = async function enableManualPayments(
	page,
	journalPath,
) {
	// Any backend page exposes the session CSRF token on
	// window.pkp.currentUser (same pattern as native-xml-submission.spec.js).
	await page.goto(`/index.php/${journalPath}/payments`);
	const csrfToken = await page.evaluate(
		// @ts-ignore - pkp global injected by the backend template
		() => window.pkp?.currentUser?.csrfToken,
	);
	if (!csrfToken) {
		throw new Error('enableManualPayments: no csrfToken on backend page');
	}
	const res = await page.request.put(
		`/index.php/${journalPath}/api/v1/_payments`,
		{
			headers: {'X-Csrf-Token': csrfToken},
			data: {
				paymentsEnabled: 'true', // string — see gotcha above
				currency: 'CAD',
				paymentPluginName: 'ManualPayment',
				manualInstructions: 'Contact the journal to arrange payment.',
			},
		},
	);
	if (!res.ok()) {
		throw new Error(
			`enableManualPayments failed: ${res.status()} ${await res.text()}`,
		);
	}
	const body = await res.json();
	if (body.paymentsEnabled !== true) {
		throw new Error(
			`enableManualPayments: paymentsEnabled did not persist (${JSON.stringify(body)})`,
		);
	}
};

/**
 * `YYYY-MM-DD` for today + offsetDays (local clock). Offsets passed by
 * tests keep ≥1 day of slack so a Node-vs-PHP timezone gap can never flip
 * which side of "now" the date lands on.
 *
 * @param {number} offsetDays
 */
exports.isoDateOffset = function isoDateOffset(offsetDays) {
	const d = new Date();
	d.setDate(d.getDate() + offsetDays);
	const y = d.getFullYear();
	const m = String(d.getMonth() + 1).padStart(2, '0');
	const day = String(d.getDate()).padStart(2, '0');
	return `${y}-${m}-${day}`;
};
