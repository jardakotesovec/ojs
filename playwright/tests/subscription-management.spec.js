// @ts-check
const {test, expect} = require('../support/fixtures.js');
const {waitForJQueryIdle} = require('../../lib/pkp/playwright/support/jquery.js');
const {
	SubscriptionManagementPage,
	enableManualPayments,
	isoDateOffset,
} = require('../pages/SubscriptionManagementPage.js');

/**
 * Subscriptions management — rows 5–9 of
 * docs/e2e/plans/subscriptions-management.md (wave 11). Rows 1–4 live in
 * the sibling subscription-config.spec.js.
 *
 * Every test runs on its own scratch journal (publicknowledge stays open
 * access and READ-ONLY). Rows 5–7 drive the legacy /payments grids — the
 * grids ARE the behavior under test; rows 8–9 are reader-facing pages
 * whose preconditions come from the `subscriptions[]` journal-scenario
 * seed (built in wave 1; classes/testing/bootstrap/Processor/
 * SubscriptionProcessor.php) plus targeted setup.
 *
 * Surfaces verified against source before writing:
 *   - Types grid row actions: SubscriptionTypesGridRow.php#54-79 (edit =
 *     AjaxModal reopening subscriptionTypeForm; institutional radios are
 *     DISABLED on edit — typeForm.tpl `disabled=$typeId`).
 *   - Individual/Institutional grids: SubscriptionsGridRow.php#56-101
 *     (edit AjaxModal + delete RemoteActionConfirmationModal; confirm
 *     string manager.po#147 "Are you sure you wish to delete this
 *     subscription?").
 *   - The institutional subscription form has NO IP-range field — it
 *     references an institution (select[name=institutionId]) managed at
 *     Settings → Institutions (PKPInstitutionForm: name + ipRanges
 *     textarea; InstitutionsListPanel.vue), and
 *     InstitutionalSubscriptionForm::validate#174-179 requires the
 *     institution to carry a domain or ≥1 IP range for online formats.
 *     Row 7 therefore creates the institution through the Institutions
 *     list panel first and round-trips the IP range THERE (the plan's
 *     "edit round-trips the IP range" — the range lives on the
 *     institution).
 *   - /about/subscriptions (AboutHandler::subscriptions#40-45) requires
 *     paymentsEnabled && paymentManager->isConfigured() — otherwise it
 *     302s to the journal index. Row 8 configures ManualPayment through
 *     the same PUT /api/v1/_payments call the Distribution → Payments
 *     form makes (the form UI itself is covered by
 *     subscription-config.spec.js).
 *   - /user/subscriptions (UserHandler::subscriptions#41-97) requires
 *     login + publishingMode=1 + ≥1 subscription type; renders
 *     userSubscriptions.tpl with "Expires: {dateEnd|date_format:Y-m-d}".
 */

test.describe('Subscriptions management (rows 5-9)', () => {
	// Row 5 — edit a subscription type via row controls.
	test(
		'manager edits a subscription type (name and cost)',
		{tag: '@regression'},
		async ({pkpApi, asUser}) => {
			const tag = uniqueTag(test.info(), 'sty');
			const {context} = await pkpApi.createJournal({
				tag,
				name: {en: `Type Edit ${tag}`},
				users: [{username: 'dbarnes', roles: ['manager']}],
			});

			const ctx = await asUser('dbarnes');
			const page = await ctx.newPage();
			const subs = new SubscriptionManagementPage(page, context.path);

			const name = `Yearly ${tag}`;
			const renamed = `Renamed ${tag}`;
			await subs.gotoTypesTab();
			await subs.createType({name, cost: '20', duration: '12'});
			await expect(subs.typeRow(name)).toBeVisible();

			// Edit reopens the form with stored values.
			const editLink = await subs.rowAction(subs.typeRow(name), 'edit');
			await editLink.click();
			await expect(subs.typeForm).toBeVisible({timeout: 10_000});
			await waitForJQueryIdle(page);
			await expect(
				subs.typeForm.locator('input[name="name[en]"]'),
			).toHaveValue(name);
			// SubscriptionTypeForm::initData round-trips the float cost;
			// Smarty renders 20.0 as "20".
			await expect(subs.typeForm.locator('input[name="cost"]')).toHaveValue(
				/^20([.,]0{1,2})?$/,
			);

			// Change name + cost; save closes the AjaxModal on success.
			await subs.typeForm.locator('input[name="name[en]"]').fill(renamed);
			await subs.typeForm.locator('input[name="cost"]').fill('75');
			await subs.saveLegacyForm(subs.typeForm);

			// The grid refreshes in place and reflects both changes.
			await expect(subs.typeRow(renamed)).toBeVisible({timeout: 15_000});
			await expect(subs.typeRow(renamed)).toContainText('75.00 (CAD)');
			await expect(subs.typeRow(name)).toHaveCount(0);
		},
	);

	// Row 6 — individual subscription lifecycle: create, edit, delete.
	test(
		'individual subscription lifecycle in the grid (create, extend, delete)',
		{tag: '@regression'},
		async ({pkpApi, asUser}) => {
			const tag = uniqueTag(test.info(), 'ind');
			const {context} = await pkpApi.createJournal({
				tag,
				name: {en: `Indiv Subs ${tag}`},
				users: [
					{username: 'dbarnes', roles: ['manager']},
					// phudson surfaces in SubscriberSelectGrid only with a
					// user_user_groups row on THIS journal.
					{username: 'phudson', roles: ['reader']},
				],
			});

			const ctx = await asUser('dbarnes');
			const page = await ctx.newPage();
			const subs = new SubscriptionManagementPage(page, context.path);

			const typeName = `Yearly ${tag}`;
			await subs.gotoTypesTab();
			await subs.createType({name: typeName, cost: '50', duration: '12'});

			// CREATE through the "Create New Subscription" AjaxModal.
			await subs.gotoIndividualTab();
			await subs.individualAddAction().click();
			await expect(subs.individualForm).toBeVisible({timeout: 10_000});
			// Settle the embedded SubscriberSelect grid load AND the
			// datepicker init (which renames the visible date inputs).
			await waitForJQueryIdle(page);
			await subs.pickSubscriber('Hudson', 'Paul Hudson');
			await subs.selectOnlyType(subs.individualForm);
			await subs.individualForm
				.locator('select[name="status"]')
				.selectOption({label: 'Active'});
			// Start YESTERDAY (≥1 day of Node-vs-PHP timezone slack — see
			// the near-midnight rationale in subscription-access.spec.js).
			const dateStart = isoDateOffset(-1);
			const dateEnd = isoDateOffset(365);
			await subs.fillDatepicker(
				'form#individualSubscriptionForm',
				'dateStart',
				dateStart,
			);
			await subs.fillDatepicker(
				'form#individualSubscriptionForm',
				'dateEnd',
				dateEnd,
			);
			await subs.saveLegacyForm(subs.individualForm);

			const row = subs.individualGrid.locator('tr.gridRow', {
				hasText: 'Paul Hudson',
			});
			await expect(row).toBeVisible({timeout: 15_000});
			await expect(row).toContainText(typeName);
			await expect(row).toContainText(dateEnd);

			// EDIT — extend the end date by a year. The edit form reopens
			// with the SubscriberSelect grid pre-filtered to the subscriber
			// (SubscriberSelectGridHandler#177-183) and the radio
			// pre-checked; wait for that async grid before saving so the
			// serialized POST carries userId.
			const editLink = await subs.rowAction(row, 'edit');
			await editLink.click();
			await expect(subs.individualForm).toBeVisible({timeout: 10_000});
			await waitForJQueryIdle(page);
			await expect(
				page.locator(
					'#subscriberSelectGridContainer input[name="userId"]:checked',
				),
			).toBeAttached({timeout: 15_000});
			const extendedEnd = isoDateOffset(730);
			await subs.fillDatepicker(
				'form#individualSubscriptionForm',
				'dateEnd',
				extendedEnd,
			);
			await subs.saveLegacyForm(subs.individualForm);
			await expect(row).toBeVisible({timeout: 15_000});
			await expect(row).toContainText(extendedEnd);

			// DELETE — RemoteActionConfirmationModal; row leaves the grid.
			await subs.confirmRowAction(row, 'delete', {
				dialogText: 'delete this subscription',
			});
			await expect(row).toHaveCount(0, {timeout: 15_000});
		},
	);

	// Row 7 — institutional subscription: institution (name + IP range)
	// via Settings → Institutions, then the institutional grid; the edit
	// modals round-trip the IP range / mailing address.
	test(
		'institutional subscription with institution and IP range',
		{tag: '@regression'},
		async ({pkpApi, asUser}) => {
			const tag = uniqueTag(test.info(), 'ins');
			const ipRange = '142.58.100.0/24';
			const {context} = await pkpApi.createJournal({
				tag,
				name: {en: `Inst Subs ${tag}`},
				users: [
					{username: 'dbarnes', roles: ['manager']},
					// Contact user for the subscription's SubscriberSelect.
					{username: 'phudson', roles: ['reader']},
				],
			});

			const ctx = await asUser('dbarnes');
			const page = await ctx.newPage();
			const subs = new SubscriptionManagementPage(page, context.path);

			// 1. Institution with an IP range via Settings → Institutions
			//    (Vue list panel + side-modal PKPInstitutionForm).
			const instName = `Institution ${tag}`;
			await page.goto(
				`/index.php/${context.path}/management/settings/institutions`,
			);
			await page
				.getByRole('button', {name: 'Add Institution', exact: true})
				.click();
			const nameField = page.locator('#institution-name-control-en');
			await expect(nameField).toBeVisible({timeout: 15_000});
			await nameField.fill(instName);
			await page.locator('#institution-ipRanges-control').fill(ipRange);
			await Promise.all([
				page.waitForResponse(
					(res) =>
						/\/api\/v1\/institutions/.test(res.url()) &&
						res.request().method() === 'POST' &&
						res.ok(),
					{timeout: 15_000},
				),
				page
					.locator('[data-cy="active-modal"]')
					.getByRole('button', {name: 'Save', exact: true})
					.click(),
			]);
			await expect(
				page.locator('.listPanel__item', {hasText: instName}),
			).toBeVisible({timeout: 15_000});

			// 2. Institutional subscription type.
			const typeName = `InstYearly ${tag}`;
			await subs.gotoTypesTab();
			await subs.createType({
				name: typeName,
				cost: '100',
				duration: '12',
				institutional: true,
			});

			// 3. Institutional subscription: contact user, type, dates,
			//    institution, mailing address.
			const mailingAddress = `12 Main Street ${tag}`;
			await subs.gotoInstitutionalTab();
			await subs.institutionalAddAction().click();
			await expect(subs.institutionalForm).toBeVisible({timeout: 10_000});
			await waitForJQueryIdle(page);
			await subs.pickSubscriber('Hudson', 'Paul Hudson');
			await subs.selectOnlyType(subs.institutionalForm);
			await subs.institutionalForm
				.locator('select[name="status"]')
				.selectOption({label: 'Active'});
			await subs.fillDatepicker(
				'form#institutionalSubscriptionForm',
				'dateStart',
				isoDateOffset(-1),
			);
			await subs.fillDatepicker(
				'form#institutionalSubscriptionForm',
				'dateEnd',
				isoDateOffset(365),
			);
			await subs.institutionalForm
				.locator('select[name="institutionId"]')
				.selectOption({label: instName});
			await subs.institutionalForm
				.locator('textarea[name="institutionMailingAddress"]')
				.fill(mailingAddress);
			await subs.saveLegacyForm(subs.institutionalForm);

			// Row shows the institution name (grid name column =
			// institution's localized name) + the type.
			const row = subs.institutionalGrid.locator('tr.gridRow', {
				hasText: instName,
			});
			await expect(row).toBeVisible({timeout: 15_000});
			await expect(row).toContainText(typeName);

			// 4a. Subscription edit round-trips institution + mailing address.
			const editLink = await subs.rowAction(row, 'edit');
			await editLink.click();
			await expect(subs.institutionalForm).toBeVisible({timeout: 10_000});
			await waitForJQueryIdle(page);
			await expect(
				subs.institutionalForm.locator(
					'select[name="institutionId"] option:checked',
				),
			).toHaveText(instName);
			await expect(
				subs.institutionalForm.locator(
					'textarea[name="institutionMailingAddress"]',
				),
			).toHaveValue(mailingAddress);

			// 4b. The IP range round-trips on the institution itself
			//     (InstitutionsListPanel edit modal re-fills ipRanges).
			await page.goto(
				`/index.php/${context.path}/management/settings/institutions`,
			);
			await page
				.locator('.listPanel__item', {hasText: instName})
				.getByRole('button', {name: 'Edit', exact: true})
				.click();
			const ipField = page.locator('#institution-ipRanges-control');
			await expect(ipField).toBeVisible({timeout: 15_000});
			await expect(ipField).toHaveValue(new RegExp(escapeRegex(ipRange)));
		},
	);

	// Row 8 — anonymous /about/subscriptions renders the policies contact
	// and the active type with cost/duration.
	test(
		'anonymous reader sees subscription types and contact on /about/subscriptions',
		{tag: '@regression'},
		async ({pkpApi, asUser, browser, baseURL}) => {
			const tag = uniqueTag(test.info(), 'abt');
			const typeName = `Premium ${tag}`;
			const {context} = await pkpApi.createJournal({
				tag,
				name: {en: `About Subs ${tag}`},
				publishingMode: 1, // PUBLISHING_MODE_SUBSCRIPTION
				users: [{username: 'dbarnes', roles: ['manager']}],
				// subscriptions[] seed (wave-1 build): one item = one TYPE +
				// one subscription row. The type display is the
				// precondition here; the granted row (held by the manager)
				// is irrelevant to the anonymous page.
				subscriptions: [
					{
						type: {
							name: typeName,
							duration: 12,
							cost: 75,
							currency: 'CAD',
						},
						user: 'dbarnes',
					},
				],
			});

			const ctx = await asUser('dbarnes');
			const page = await ctx.newPage();
			const subs = new SubscriptionManagementPage(page, context.path);

			// Subscription policies contact via the legacy form (no seed
			// passthrough exists; the form stays mounted on success). ALL
			// THREE contact fields are required=true — leaving the mailing
			// address empty fails validation and nothing persists.
			const contactName = `Contact ${tag}`;
			const contactEmail = `contact-${tag}@example.test`;
			const contactAddress = `123 Contact St ${tag}`;
			await subs.gotoPoliciesTab();
			await subs.policiesForm
				.locator('input[id^="subscriptionName"]')
				.fill(contactName);
			await subs.policiesForm
				.locator('input[id^="subscriptionEmail"]')
				.fill(contactEmail);
			await subs.policiesForm
				.locator('textarea[id^="subscriptionMailingAddress"]')
				.fill(contactAddress);
			// Race the save POST: waitForJQueryIdle alone can sample the
			// click→AJAX gap, and the follow-up page.goto would abort an
			// in-flight save. (Page-router op URLs keep camelCase, but
			// strip dashes defensively — patterns lesson 11.)
			await Promise.all([
				page.waitForResponse(
					(res) =>
						/savesubscriptionpolicies/i.test(
							res.url().replace(/-/g, ''),
						) && res.request().method() === 'POST',
					{timeout: 15_000},
				),
				subs.policiesForm
					.getByRole('button', {name: 'Save', exact: true})
					.click(),
			]);
			await waitForJQueryIdle(page);
			// AjaxFormHandler keeps the policies form mounted either way;
			// prove the save PERSISTED (not just POSTed) before leaning on
			// it: reload the tab and check the round-trip, mirroring
			// subscription-config.spec.js's policies test.
			await subs.gotoPoliciesTab();
			await expect(
				subs.policiesForm.locator('input[id^="subscriptionName"]'),
			).toHaveValue(contactName);

			// /about/subscriptions 302s to the journal index unless
			// payments are configured (AboutHandler::subscriptions#40-45).
			await enableManualPayments(page, context.path);

			// Anonymous reader (explicit empty storage state — patterns
			// rule 8).
			const anonCtx = await browser.newContext({
				baseURL,
				storageState: {cookies: [], origins: []},
			});
			try {
				const anon = await anonCtx.newPage();
				const resp = await anon.goto(
					`/index.php/${context.path}/about/subscriptions`,
				);
				expect(resp?.status()).toBe(200);
				await expect(anon).toHaveURL(/about\/subscriptions/);
				await expect(
					anon.getByRole('heading', {name: 'Subscriptions', exact: true}),
				).toBeVisible();
				// Policies contact (subscriptionContact.tpl).
				await expect(
					anon.getByRole('heading', {name: 'Subscriptions Contact'}),
				).toBeVisible();
				await expect(anon.getByText(contactName)).toBeVisible();
				await expect(
					anon.getByRole('link', {name: contactEmail}),
				).toBeVisible();
				// Active individual type with duration + cost. The cost
				// cell renders "75.00&nbsp;(CAD)" — \s matches the nbsp.
				await expect(
					anon.getByRole('heading', {name: 'Individual Subscriptions'}),
				).toBeVisible();
				const typeCell = anon.locator('td', {hasText: typeName});
				await expect(typeCell).toBeVisible();
				const typeTableRow = anon.locator('tr', {hasText: typeName});
				await expect(typeTableRow).toContainText('1 year');
				await expect(typeTableRow).toContainText(/75\.00\s*\(CAD\)/);
			} finally {
				await anonCtx.close();
			}
		},
	);

	// Row 9 — a seeded individual subscription shows up on the reader's
	// profile Subscriptions tab with type name + expiry.
	test(
		'subscriber sees their subscription in their profile',
		{tag: '@regression'},
		async ({pkpApi, asUser}) => {
			const tag = uniqueTag(test.info(), 'prf');
			const typeName = `Yearly ${tag}`;
			// Explicit dates: dateStart yesterday (timezone slack), dateEnd
			// ~8 months out — the exact string the profile page must echo.
			const dateStart = isoDateOffset(-1);
			const dateEnd = isoDateOffset(240);
			const {context} = await pkpApi.createJournal({
				tag,
				name: {en: `Profile Subs ${tag}`},
				publishingMode: 1, // /user/subscriptions 302s to index otherwise
				users: [{username: 'phudson', roles: ['reader']}],
				subscriptions: [
					{
						type: {name: typeName, duration: 12, cost: 50, currency: 'CAD'},
						user: 'phudson',
						dateStart,
						dateEnd,
					},
				],
			});

			// phudson holds no editorial role on the scratch journal — a
			// plain reader viewing their own profile tab
			// (UserHandler::subscriptions → userSubscriptions.tpl).
			const readerCtx = await asUser('phudson');
			const readerPage = await readerCtx.newPage();
			const resp = await readerPage.goto(
				`/index.php/${context.path}/user/subscriptions`,
			);
			expect(resp?.status()).toBe(200);
			await expect(readerPage).toHaveURL(/user\/subscriptions/);
			await expect(
				readerPage.getByRole('heading', {name: 'My Subscriptions'}),
			).toBeVisible();

			const individualSection = readerPage.locator(
				'.my_subscription_individual',
			);
			await expect(individualSection).toBeVisible();
			await expect(individualSection).toContainText(typeName);
			// Active + expiring → "Expires: YYYY-MM-DD"
			// (user.subscriptions.expires; dateFormatShort is Y-m-d in the
			// test config).
			await expect(individualSection).toContainText(`Expires: ${dateEnd}`);
			await expect(
				individualSection.locator('.subscription_active'),
			).toBeVisible();
		},
	);
});

/**
 * Worker- and run-scoped tag (journals.path is varchar(32); the scenario
 * derives `j-` + sanitised tag). Random suffix keeps re-runs on a
 * long-lived DB from colliding.
 *
 * @param {import('@playwright/test').TestInfo} info
 * @param {string} suffix
 */
function uniqueTag(info, suffix) {
	const rand = Math.random().toString(36).slice(2, 8);
	return `w${info.parallelIndex}-${suffix}-${rand}`;
}

/**
 * Escape a string for inclusion in a RegExp.
 *
 * @param {string} s
 */
function escapeRegex(s) {
	return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
