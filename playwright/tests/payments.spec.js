// @ts-check
const {test, expect} = require('../support/fixtures.js');
const {waitForJQueryIdle} = require('../../lib/pkp/playwright/support/jquery.js');
const submissionPublished = require('../fixtures/scenarios/submission-published.js');

/**
 * Payments — docs/e2e/plans/payments.md rows 2–5.
 *
 * Row 1 (Distribution → Payments enable + Manual plugin + currency +
 * instructions persist) is backed by the absorbed test in
 * playwright/tests/subscription-config.spec.js ("manager configures
 * Payments via Distribution > Payments tab"); it stays there this wave
 * to avoid colliding with the subscriptions-management refit.
 *
 * Coverage here:
 *   - Row 2: /payments → Payment Types form (PaymentTypesForm): the four
 *     fee fields save and re-populate. NOTE the legacy
 *     `purchaseArticleFeeEnabled` / `purchaseIssueFeeEnabled` settings
 *     declared in PaymentTypesForm.php#38-40 have NO form fields
 *     (templates/payments/paymentTypesForm.tpl renders only the fee text
 *     inputs + restrictOnlyPdf) and no consumer — the actual fee gates
 *     are `fee > 0` (OJSPaymentManager.php#156-199).
 *   - Row 3: fee wall — logged-in non-subscriber requesting a restricted
 *     galley on a subscription-mode journal gets the Manual plugin's
 *     payment page (fee amount + instructions); the notify action sends
 *     ManualPaymentNotify to the journal contact and renders the
 *     confirmation page.
 *   - Row 4: a publication-fee payment recorded through the product REST
 *     endpoint (PUT /api/v1/_submissions/{id}/payment — the editor-side
 *     record-payment API, not a test seed) appears in the /payments →
 *     Payments tab grid with payer, type and amount. The planned
 *     "details action" half is dropped: PaymentsGridHandler::viewPayment
 *     is an empty `// FIXME` stub (PaymentsGridHandler.php#139-142) and
 *     the grid attaches no row actions, so no details surface exists.
 *   - Row 5: PayPal config surface — fields render once payments are
 *     enabled + the plugin selected, persist on reload, and no browser
 *     request leaves for paypal.com (route guard). Server-side egress is
 *     separately firewalled by config.test.inc.php (patterns rule 6).
 *
 * All journal-level mutations happen on per-test scratch journals; the
 * fee/payment-settings forms are driven through the UI per the plan (the
 * forms are part of the surface under test). publicknowledge stays
 * untouched/open-access.
 */

/**
 * Worker- and run-scoped tag. journals.path is derived as
 * 'j-' + alnum(tag) and must fit varchar(32); the random suffix keeps
 * re-runs on a long-lived DB from colliding on the journal path.
 */
function uniqueTag(suffix) {
	const rand = Math.random().toString(36).slice(2, 8);
	return `pay-w${test.info().parallelIndex}-${suffix}-${rand}`;
}

/**
 * Enable payments on a scratch journal through Distribution → Payments
 * (PKPPaymentSettingsForm + paymethod-plugin field groups). Mirrors the
 * absorbed subscription-config.spec.js flow without re-asserting it.
 *
 * @param {import('@playwright/test').Page} page authenticated manager page
 * @param {string} journalPath
 * @param {{plugin?: string, currency?: string, manualInstructions?: string}} opts
 * @returns {Promise<import('@playwright/test').Locator>} the settings form
 */
async function enablePaymentsViaUI(
	page,
	journalPath,
	{plugin = 'Manual Fee Payment', currency = 'Canadian Dollar', manualInstructions} = {},
) {
	await page.goto(
		`/index.php/${journalPath}/management/settings/distribution#payments`,
	);
	await page.locator('#payments-button').click();

	const form = page
		.locator('form', {
			has: page.locator('label', {hasText: 'Payments will be enabled'}),
		})
		.first();
	await expect(form).toBeVisible({timeout: 15_000});

	await form
		.locator('label', {hasText: 'Payments will be enabled'})
		.first()
		.click();

	const pluginSelect = form.locator(
		'select#paymentSettings-paymentPluginName-control',
	);
	await expect(pluginSelect).toBeVisible({timeout: 15_000});
	await pluginSelect.selectOption({label: plugin});

	await form
		.locator('select#paymentSettings-currency-control')
		.selectOption({label: currency});

	if (manualInstructions !== undefined) {
		const instrTextarea = form.locator(
			'textarea#paymentSettings-manualInstructions-control',
		);
		await expect(instrTextarea).toBeVisible({timeout: 15_000});
		await instrTextarea.fill(manualInstructions);
	}

	return form;
}

/**
 * Save the payment-settings form and wait for the PUT to settle.
 * PKPPaymentSettingsForm posts to the `_payments` API route
 * (ManagementHandler.php), kept broad for robustness.
 *
 * @param {import('@playwright/test').Page} page
 * @param {import('@playwright/test').Locator} form
 */
async function savePaymentSettings(page, form) {
	const saveBtn = form.getByRole('button', {name: 'Save', exact: true});
	await saveBtn.scrollIntoViewIfNeeded();
	await expect(saveBtn).toBeEnabled();
	await Promise.all([
		page.waitForResponse(
			(res) =>
				/\/api\/v1\/(_payments|contexts\/\d+)/.test(res.url()) &&
				res.ok() &&
				['POST', 'PUT'].includes(res.request().method()),
			{timeout: 15_000},
		),
		saveBtn.click(),
	]);
}

/**
 * Open a legacy TabHandler tab on the /payments page and let the jQuery
 * fetchAjax chain settle. Tab anchors carry stable `name` attributes
 * matching their PaymentsHandler ops (templates/payments/index.tpl).
 *
 * @param {import('@playwright/test').Page} page
 * @param {string} journalPath
 * @param {string} tabName paymentTypes | payments | subscriptionTypes | ...
 */
async function openPaymentsTab(page, journalPath, tabName) {
	await page.goto(`/index.php/${journalPath}/payments`);
	await page.locator(`a[name="${tabName}"]`).click();
	await waitForJQueryIdle(page);
}

/**
 * Fill + save the Payment Types form (legacy AjaxFormHandler). The form
 * stays mounted on success (savePaymentTypes returns JSONMessage(true));
 * waitForJQueryIdle bounds the POST + notification chain.
 *
 * @param {import('@playwright/test').Page} page
 * @param {Partial<Record<'publicationFee'|'purchaseIssueFee'|'purchaseArticleFee'|'membershipFee', string>>} fees
 */
async function savePaymentTypesViaUI(page, fees) {
	const form = page.locator('form#paymentTypesForm');
	await expect(form).toBeVisible({timeout: 15_000});
	for (const [name, value] of Object.entries(fees)) {
		await form.locator(`input[name="${name}"]`).fill(value);
	}
	await form.locator('button[type="submit"]').click();
	await waitForJQueryIdle(page);
}

test.use({user: 'dbarnes'});

test.describe('Payments', () => {
	// Plan row 2
	test(
		'manager configures reader and author fees and they re-populate on reload',
		{tag: '@regression'},
		async ({pkpApi, asUser}) => {
			const tag = uniqueTag('fees');
			const {context} = await pkpApi.createJournal({
				tag,
				users: [{username: 'dbarnes', roles: ['manager']}],
			});
			const ctx = await asUser('dbarnes');
			const page = await ctx.newPage();

			await openPaymentsTab(page, context.path, 'paymentTypes');
			await savePaymentTypesViaUI(page, {
				publicationFee: '150',
				purchaseIssueFee: '25',
				purchaseArticleFee: '9.99',
				membershipFee: '60',
			});

			// Re-open the tab from scratch; PaymentTypesForm::initData()
			// re-reads the four settings from the journal row.
			await openPaymentsTab(page, context.path, 'paymentTypes');
			const form = page.locator('form#paymentTypesForm');
			await expect(form).toBeVisible({timeout: 15_000});
			await expect(form.locator('input[name="publicationFee"]')).toHaveValue(
				'150',
			);
			await expect(form.locator('input[name="purchaseIssueFee"]')).toHaveValue(
				'25',
			);
			await expect(
				form.locator('input[name="purchaseArticleFee"]'),
			).toHaveValue('9.99');
			await expect(form.locator('input[name="membershipFee"]')).toHaveValue(
				'60',
			);
		},
	);

	// Plan row 3
	test(
		'reader hits the article fee wall and notifies payment via the Manual plugin',
		{tag: '@regression'},
		async ({pkpApi, pkpMail, asUser}) => {
			const tag = uniqueTag('wall');
			const contactEmail = `contact-${tag}@example.test`;
			const {context} = await pkpApi.createJournal({
				tag,
				name: {en: `Fee Wall ${tag}`},
				publishingMode: 1, // Journal::PUBLISHING_MODE_SUBSCRIPTION
				contact: {name: `Contact ${tag}`, email: contactEmail},
				users: [
					{username: 'dbarnes', roles: ['manager']},
					// phudson is a plain reader here: no editorial role on
					// the scratch journal, so canPreview() never bypasses
					// the gate for him.
					{username: 'phudson', roles: ['reader']},
				],
				issues: [
					{
						volume: 1,
						number: 1,
						year: 2026,
						published: true,
						accessStatus: 2, // Issue::ISSUE_ACCESS_SUBSCRIPTION
					},
				],
			});

			// Published submission with a real PDF galley — the galley
			// view URL is what ArticleHandler::userCanViewGalley gates
			// (ArticleHandler.php#625-669).
			const spec = submissionPublished({
				tag,
				journal: context.path,
				issue: {volume: 1, number: 1, year: 2026},
			});
			spec.publications[0].galleys = [{label: 'PDF'}];
			const {submission, publications} = await pkpApi.createSubmission(spec);
			const galleyId = publications[0].galleys[0].id;

			// Manager wires up the Manual plugin + article purchase fee
			// through the UI (the payment config forms are product
			// surface, not seedable state).
			const instructions = `Wire the fee to account 555-${tag}.`;
			const managerCtx = await asUser('dbarnes');
			const managerPage = await managerCtx.newPage();
			const settingsForm = await enablePaymentsViaUI(
				managerPage,
				context.path,
				{manualInstructions: instructions},
			);
			await savePaymentSettings(managerPage, settingsForm);
			await openPaymentsTab(managerPage, context.path, 'paymentTypes');
			await savePaymentTypesViaUI(managerPage, {
				purchaseArticleFee: '9.99',
			});

			// Logged-in non-subscriber requests the restricted galley.
			// purchaseArticleEnabled() short-circuits the subscription
			// redirect into a queued PURCHASE_ARTICLE payment + the
			// Manual plugin's paymentForm.tpl (fee + instructions).
			// Scratch journals are single-locale: probe the bare URL
			// (patterns rule 9, inverted form).
			const readerCtx = await asUser('phudson');
			const readerPage = await readerCtx.newPage();
			const resp = await readerPage.goto(
				`/index.php/${context.path}/article/view/${submission.id}/${galleyId}`,
			);
			expect(resp?.status()).toBe(200);

			await expect(
				readerPage.getByRole('heading', {name: 'Manual Fee Payment'}),
			).toBeVisible();
			// Item being purchased + fee amount, rendered by
			// plugins/paymethod/manual/templates/paymentForm.tpl.
			await expect(readerPage.locator('.page_payment_form')).toContainText(
				'Purchase Article Fee',
			);
			await expect(readerPage.locator('.page_payment_form')).toContainText(
				'9.99 (CAD)',
			);
			await expect(readerPage.getByText(instructions)).toBeVisible();

			// Notify action → ManualPaymentPlugin::handle('notify'):
			// sends ManualPaymentNotify to the journal contact and
			// renders the message.tpl confirmation.
			await readerPage
				.getByRole('link', {name: 'Send notification of payment'})
				.click();
			await expect(
				readerPage.getByRole('heading', {name: 'Payment Notification'}),
			).toBeVisible();
			await expect(
				readerPage.getByText('Payment notification sent'),
			).toBeVisible();
			await expect(
				readerPage.getByRole('link', {name: 'Continue'}),
			).toBeVisible();

			// Mail assertion scoped by the tag-unique contact recipient +
			// tag marker (journal name carries the tag) — principle 8.
			const [message] = await pkpMail.find({
				to: contactEmail,
				contains: tag,
			});
			expect(message.Subject).toBe('Manual Payment Notification');
			const full = await pkpMail.fullMessage(message.ID);
			expect(full.HTML || full.Text).toContain('Purchase Article Fee');
			expect(full.HTML || full.Text).toContain('phudson');
		},
	);

	// Plan row 4
	test(
		'publication-fee payment recorded via the REST endpoint appears in the payments grid',
		{tag: '@regression'},
		async ({pkpApi, asUser}) => {
			const tag = uniqueTag('grid');
			const {context} = await pkpApi.createJournal({
				tag,
				users: [{username: 'dbarnes', roles: ['manager']}],
				issues: [{volume: 1, number: 1, year: 2026, published: true}],
			});

			// rvaca (the fixture's default submitter) holds the author
			// stage assignment — the endpoint attributes the payment to
			// him (BackendSubmissionsController.php#142-153).
			const spec = submissionPublished({
				tag,
				journal: context.path,
				issue: {volume: 1, number: 1, year: 2026},
			});
			const {submission} = await pkpApi.createSubmission(spec);

			// Publication fee must be enabled before the endpoint accepts
			// the record: publicationEnabled() = paymentsEnabled + plugin
			// configured + publicationFee > 0.
			const managerCtx = await asUser('dbarnes');
			const page = await managerCtx.newPage();
			const settingsForm = await enablePaymentsViaUI(page, context.path, {
				manualInstructions: `Manual instructions ${tag}.`,
			});
			await savePaymentSettings(page, settingsForm);
			await openPaymentsTab(page, context.path, 'paymentTypes');
			await savePaymentTypesViaUI(page, {publicationFee: '150'});

			// Record the payment through the product REST API. CSRF comes
			// from the loaded backend page's state, same as the app's own
			// fetch wrapper uses.
			const csrfToken = await page.evaluate(
				// @ts-expect-error window.pkp is the app's global state
				() => window.pkp?.currentUser?.csrfToken,
			);
			expect(csrfToken, 'backend page must expose csrfToken').toBeTruthy();
			const putResp = await page.request.put(
				`/index.php/${context.path}/api/v1/_submissions/${submission.id}/payment`,
				{
					headers: {'X-Csrf-Token': csrfToken},
					data: {publicationFeeStatus: 'paid'},
				},
			);
			expect(putResp.status()).toBe(200);

			// /payments → Payments tab grid (PaymentsGridHandler) lists
			// the completed payment with payer, type and amount.
			await openPaymentsTab(page, context.path, 'payments');
			const row = page.locator('#paymentsGridContainer tr.gridRow', {
				hasText: 'Ramiro Vaca',
			});
			await expect(row).toBeVisible({timeout: 15_000});
			await expect(row).toContainText('Publication Fee');
			// decimal(8,2) column → "150.00" + currency code
			// (PaymentsGridCellProvider.php#65-66).
			await expect(row).toContainText(/150(\.00)? CAD/);

			// Planned "details action" intentionally not asserted:
			// PaymentsGridHandler::viewPayment is an empty FIXME stub and
			// the grid registers no row actions — recorded in the plan.
		},
	);

	// Plan row 5
	test(
		'PayPal configuration surface renders, persists, and never calls paypal.com',
		{tag: '@regression'},
		async ({pkpApi, asUser}) => {
			const tag = uniqueTag('pp');
			const {context} = await pkpApi.createJournal({
				tag,
				users: [{username: 'dbarnes', roles: ['manager']}],
			});
			const ctx = await asUser('dbarnes');
			const page = await ctx.newPage();

			// Routing guard: any browser-side request to paypal.com fails
			// the test. (Server-side egress is firewalled separately by
			// config.test.inc.php.) Installed before first navigation.
			/** @type {string[]} */
			const paypalRequests = [];
			await page.route(/paypal\.com/i, (route) => {
				paypalRequests.push(route.request().url());
				return route.abort();
			});

			// Selecting "Paypal Fee Payment" with payments enabled
			// surfaces the plugin's field group
			// (PaypalPaymentPlugin::addSettings).
			const form = await enablePaymentsViaUI(page, context.path, {
				plugin: 'Paypal Fee Payment',
			});

			const accountName = form.locator(
				'input#paymentSettings-accountName-control',
			);
			const clientId = form.locator('input#paymentSettings-clientId-control');
			const secret = form.locator('input#paymentSettings-secret-control');
			const testMode = form.locator('input[type="checkbox"][name="testMode"]');
			await expect(accountName).toBeVisible({timeout: 15_000});
			await expect(clientId).toBeVisible();
			await expect(secret).toBeVisible();
			// The secret is a password input (inputType: 'password',
			// PaypalPaymentPlugin.php#124-130).
			await expect(secret).toHaveAttribute('type', 'password');
			await expect(testMode).toBeVisible();

			await accountName.fill(`Account ${tag}`);
			await clientId.fill(`client-${tag}`);
			await secret.fill(`secret-${tag}`);
			await testMode.check();

			await savePaymentSettings(page, form);

			// Reload + reactivate the tab; with payments enabled the
			// cascade fields render on first paint.
			await page.reload();
			await page.locator('#payments-button').click();
			const reloaded = page
				.locator('form', {
					has: page.locator('label', {hasText: 'Payments will be enabled'}),
				})
				.first();
			await expect(reloaded).toBeVisible({timeout: 15_000});
			await expect(
				reloaded.locator('select#paymentSettings-paymentPluginName-control'),
			).toHaveValue('PaypalPayment');
			await expect(
				reloaded.locator('input#paymentSettings-accountName-control'),
			).toHaveValue(`Account ${tag}`);
			await expect(
				reloaded.locator('input#paymentSettings-clientId-control'),
			).toHaveValue(`client-${tag}`);
			await expect(
				reloaded.locator('input#paymentSettings-secret-control'),
			).toHaveValue(`secret-${tag}`);
			await expect(
				reloaded.locator('input[type="checkbox"][name="testMode"]'),
			).toBeChecked();

			expect(
				paypalRequests,
				'no browser request may leave for paypal.com during config',
			).toEqual([]);
		},
	);
});
