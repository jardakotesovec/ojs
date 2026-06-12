// @ts-check
const {test, expect} = require('../support/fixtures.js');
const submissionPublished = require('../fixtures/scenarios/submission-published.js');

/**
 * Distribution settings — docs/e2e/plans/distribution-settings.md
 * (rows 1–5).
 *
 * The feature under test is the Distribution settings page
 * (`management/settings/distribution`): the License, Access, Indexing,
 * Payments and Archive tabs, and the downstream surfaces those settings
 * gate (publication license defaults, the anonymous homepage <head>,
 * the manager sidebar nav, the LOCKSS/CLOCKSS gateway manifests).
 *
 * Ownership splits (per plan — do not duplicate):
 *   - publishingMode flip PERSISTENCE is owned by subscriptions-management
 *     (subscription-config.spec.js test 5). Row 2 here covers ONLY the
 *     client-side showWhen reveal of delayedOpenAccessDuration and never
 *     saves the Access form (a REST read at the end proves no mutation).
 *   - Payments-settings PERSISTENCE is owned by payments
 *     (subscription-config.spec.js test 4). Row 4 here asserts ONLY the
 *     sidebar nav gating (Payments + Institutions entries appear/disappear
 *     with paymentsEnabled); enabling via the form is setup, not subject.
 *   - DOIs tabs → doi-management; Statistics tab → round 2; reader-side
 *     license block → article-landing / publication-identifiers-license.
 *
 * Every test runs on its own scratch journal (journal-level mutations are
 * the behavior under test; publicknowledge is read-only).
 *
 * UI notes:
 *   - PkpTabs buttons are id-anchored: `#license-button`, `#access-button`,
 *     `#indexing-button`, `#payments-button`, `#archive-button`; the
 *     Archive tab nests side tabs (`#pln-button`, `#lockss-button`). Tab
 *     panels carry the tab id (`#license`, `#access`, ...).
 *   - Vue form controls: ids are `{formId}-{field}-control[-locale]`;
 *     radio/checkbox inputs carry `name="{field}"` (FieldOptions /
 *     FieldRadioInput), multilingual text inputs `name="{field}-{locale}"`.
 *   - License/Access/Indexing/ArchivingLockss forms PUT the contexts API;
 *     the Payments form PUTs `/api/v1/_payments`.
 *
 * Anonymous-probe notes:
 *   - Scratch journals are single-locale (en), so front-end URLs are NOT
 *     locale-prefixed: `/index.php/{path}/gateway/lockss` serves directly
 *     (verified live: the `/en/`-prefixed form 302s BACK to the bare
 *     form — the publicknowledge pattern from patterns.md #9 does not
 *     apply to single-locale journals). A refused manifest is a 302 to
 *     `/{path}/index` (GatewayHandler.php:85,149  redirect when the
 *     enableLockss/enableClockss flag is off).
 *   - All anonymous probes use a fresh APIRequestContext with an explicit
 *     empty storageState — the file-level `test.use({user})` would
 *     otherwise leak dbarnes' session into `request`-fixture probes.
 */

/** Scratch-journal issue (seeded `published: true`). */
const SCRATCH_ISSUE = {volume: 1, number: '1', year: 2026};

const CC_BY_4 = 'https://creativecommons.org/licenses/by/4.0';

test.use({user: 'dbarnes'});

function uniqueTag(prefix) {
	const workerIndex = test.info().parallelIndex;
	const suffix = Math.random().toString(36).slice(2, 8);
	return `${prefix}-w${workerIndex}-${suffix}`;
}

/**
 * Open the Distribution settings page and activate a tab.
 * Returns the tab's panel locator.
 *
 * @param {import('@playwright/test').Page} page
 * @param {string} journalPath
 * @param {string} tabId one of license|dois|indexing|payments|access|archive
 */
async function gotoDistributionTab(page, journalPath, tabId) {
	await page.goto(
		`/index.php/${journalPath}/management/settings/distribution`,
	);
	await page.locator(`#${tabId}-button`).click();
	const panel = page.locator(`#${tabId}`);
	await expect(panel).toBeVisible({timeout: 15_000});
	return panel;
}

/**
 * Save a Distribution-tab context form and wait for the settings write
 * to land. The license/access/indexing/lockss forms PUT
 * `/api/v1/contexts/{id}`; the payments form PUTs `/api/v1/_payments`.
 * useFetch tunnels PUT via POST + X-Http-Method-Override, so accept
 * either verb (patterns.md, wave-2 lessons).
 *
 * @param {import('@playwright/test').Page} page
 * @param {import('@playwright/test').Locator} form
 */
async function saveContextForm(page, form) {
	const saveButton = form.getByRole('button', {name: 'Save', exact: true});
	await expect(saveButton).toBeEnabled();
	await Promise.all([
		page.waitForResponse(
			(res) =>
				/\/api\/v1\/(_payments|contexts\/\d+)/.test(res.url()) &&
				['PUT', 'POST'].includes(res.request().method()) &&
				res.ok(),
			{timeout: 20_000},
		),
		saveButton.click(),
	]);
}

/**
 * Fresh anonymous APIRequestContext (explicit empty storageState — the
 * file-level test.use({user}) must not leak into reader-side probes).
 * Caller disposes.
 *
 * @param {import('@playwright/test').Playwright} playwright
 * @param {string} baseURL
 */
async function anonymousRequest(playwright, baseURL) {
	return playwright.request.newContext({
		baseURL,
		storageState: {cookies: [], origins: []},
	});
}

/**
 * Fetch the submission's current publication JSON via the REST API as
 * the page's session user (same shape as
 * publication-identifiers-license.spec.js).
 *
 * @param {import('@playwright/test').Page} page
 * @param {number} submissionId
 * @param {string} journalPath
 */
async function fetchCurrentPublication(page, submissionId, journalPath) {
	const subRes = await page.request.get(
		`/index.php/${journalPath}/api/v1/submissions/${submissionId}`,
	);
	if (!subRes.ok()) {
		throw new Error(
			`GET submission ${submissionId} failed: ${subRes.status()} ${await subRes.text()}`,
		);
	}
	const sub = await subRes.json();
	const pubRes = await page.request.get(
		`/index.php/${journalPath}/api/v1/submissions/${submissionId}/publications/${sub.currentPublicationId}`,
	);
	if (!pubRes.ok()) {
		throw new Error(
			`GET publication ${sub.currentPublicationId} failed: ${pubRes.status()} ${await pubRes.text()}`,
		);
	}
	return pubRes.json();
}

test.describe('Distribution settings', () => {
	// Row 1
	test('license defaults persist and apply to a publication published afterwards', {tag: '@smoke'}, async ({page, pkpApi}) => {
		// Scratch journal + UI form drive + scenario seed + API reads —
		// give it the slow budget under parallel load.
		test.slow();
		const tag = uniqueTag('dst1');
		const holder = `Holder ${tag}`;
		const {context} = await pkpApi.createJournal({
			tag,
			publishingMode: 0,
			users: [{username: 'dbarnes', roles: ['manager', 'editor']}],
			issues: [{...SCRATCH_ISSUE, published: true}],
		});

		// --- Distribution > License: copyright holder "Other" + custom
		// name, CC BY license, copyrightYearBasis = submission.
		const panel = await gotoDistributionTab(page, context.path, 'license');
		const form = panel.locator('form').first();
		await form
			.locator('input[name="copyrightHolderType"][value="other"]')
			.check();
		// showWhen reveal: the custom-name field only renders for "other".
		const holderOther = form.locator('input[name="copyrightHolderOther-en"]');
		await expect(holderOther).toBeVisible({timeout: 10_000});
		await holderOther.fill(holder);
		await form.locator(`input[name="licenseUrl"][value="${CC_BY_4}"]`).check();
		await form
			.locator('input[name="copyrightYearBasis"][value="submission"]')
			.check();
		await saveContextForm(page, form);

		// --- Reload: the form re-renders the persisted values.
		await page.reload();
		await page.locator('#license-button').click();
		const reloaded = page.locator('#license form').first();
		await expect(reloaded).toBeVisible({timeout: 15_000});
		await expect(
			reloaded.locator('input[name="copyrightHolderType"]:checked'),
		).toHaveValue('other');
		await expect(
			reloaded.locator('input[name="copyrightHolderOther-en"]'),
		).toHaveValue(holder);
		await expect(
			reloaded.locator('input[name="licenseUrl"]:checked'),
		).toHaveValue(CC_BY_4);
		await expect(
			reloaded.locator('input[name="copyrightYearBasis"]:checked'),
		).toHaveValue('submission');

		// --- A submission published AFTER the settings save picks up the
		// journal defaults. The submission-published fixture hard-codes
		// copyrightHolder/copyrightYear/licenseUrl metadata (it models an
		// article that carries its own license), and the publish backfill
		// only fills EMPTY fields (lib/pkp/classes/publication/
		// Repository.php:580,602) — so strip them from the spec to leave
		// the defaults room to apply.
		const spec = submissionPublished({
			tag,
			journal: context.path,
			issue: SCRATCH_ISSUE,
		});
		delete spec.publications[0].metadata.copyrightHolder;
		delete spec.publications[0].metadata.copyrightYear;
		delete spec.publications[0].metadata.licenseUrl;
		const {submission} = await pkpApi.createSubmission(spec);

		const pub = await fetchCurrentPublication(
			page,
			submission.id,
			context.path,
		);
		expect(pub.licenseUrl).toBe(CC_BY_4);
		expect(pub.copyrightHolder?.en).toBe(holder);
	});

	// Row 2
	test('subscription mode reveals the delayed-open-access duration field without saving', {tag: '@regression'}, async ({page, pkpApi}) => {
		const tag = uniqueTag('dst2');
		const {context} = await pkpApi.createJournal({
			tag,
			users: [{username: 'dbarnes', roles: ['manager']}],
		});

		const panel = await gotoDistributionTab(page, context.path, 'access');
		const form = panel.locator('form').first();
		await expect(
			form.locator('input[name="publishingMode"]').first(),
		).toBeVisible({timeout: 15_000});

		// Fresh journals leave publishingMode unset, so the duration
		// select (showWhen: publishingMode == 1) starts hidden.
		const duration = form.locator(
			'select#access-delayedOpenAccessDuration-control',
		);
		await expect(duration).not.toBeVisible();

		// Selecting subscription mode reveals it; a duration is selectable.
		await form.locator('input[name="publishingMode"][value="1"]').check();
		await expect(duration).toBeVisible({timeout: 10_000});
		await duration.selectOption('12');
		await expect(duration).toHaveValue('12');

		// Switching back to open access hides it again.
		await form.locator('input[name="publishingMode"][value="0"]').check();
		await expect(duration).not.toBeVisible();

		// Deliberately NO save — publishingMode persistence is owned by
		// subscriptions-management row 4. REST read proves the journal
		// was not flipped to subscription mode by this test.
		const ctxRes = await page.request.get(
			`/index.php/${context.path}/api/v1/contexts/${context.id}`,
		);
		expect(ctxRes.ok()).toBeTruthy();
		expect((await ctxRes.json()).publishingMode).not.toBe(1);
	});

	// Row 3
	test('search-indexing metadata lands in the anonymous homepage head', {tag: '@regression'}, async ({page, pkpApi, playwright, baseURL}) => {
		const tag = uniqueTag('dst3');
		const description = `Search description ${tag}`;
		const customHeader = `<meta name="custom-${tag}" content="wave10-custom-header" />`;
		const {context} = await pkpApi.createJournal({
			tag,
			publishingMode: 0,
			users: [{username: 'dbarnes', roles: ['manager']}],
		});

		const panel = await gotoDistributionTab(page, context.path, 'indexing');
		const form = panel.locator('form').first();
		const descriptionInput = form.locator(
			'input[name="searchDescription-en"]',
		);
		await expect(descriptionInput).toBeVisible({timeout: 15_000});
		await descriptionInput.fill(description);
		await form.locator('textarea[name="customHeaders-en"]').fill(customHeader);
		await saveContextForm(page, form);

		// Persistence: reload re-renders the saved values.
		await page.reload();
		await page.locator('#indexing-button').click();
		const reloaded = page.locator('#indexing form').first();
		await expect(reloaded).toBeVisible({timeout: 15_000});
		await expect(
			reloaded.locator('input[name="searchDescription-en"]'),
		).toHaveValue(description);
		await expect(
			reloaded.locator('textarea[name="customHeaders-en"]'),
		).toHaveValue(customHeader);

		// Anonymous homepage <head>: PKPTemplateManager registers the
		// meta-description header only on the journal index page
		// (PKPTemplateManager.php:316) and appends customHeaders verbatim
		// (:329). Server-rendered, so a plain GET sees both.
		const anon = await anonymousRequest(playwright, baseURL);
		try {
			const res = await anon.get(`/index.php/${context.path}/`);
			expect(res.status()).toBe(200);
			const html = await res.text();
			expect(html).toContain(
				`<meta name="description" content="${description}" />`,
			);
			expect(html).toContain(customHeader);
		} finally {
			await anon.dispose();
		}
	});

	// Row 4
	test('enabling payments gates the Payments and Institutions nav entries', {tag: '@regression'}, async ({page, pkpApi}) => {
		// Three full page loads (baseline / enabled / disabled) on a
		// scratch journal — slow budget.
		test.slow();
		const tag = uniqueTag('dst4');
		const {context} = await pkpApi.createJournal({
			tag,
			users: [{username: 'dbarnes', roles: ['manager']}],
		});

		const nav = page.locator('nav#app-nav');
		const paymentsLink = nav.getByRole('link', {
			name: 'Payments',
			exact: true,
		});
		const institutionsLink = nav.getByRole('link', {
			name: 'Institutions',
			exact: true,
		});

		// Baseline: with payments off, neither nav entry exists. Bound
		// the negative on the always-present Settings entry (SideMenu
		// renders submenu parents as links too).
		let panel = await gotoDistributionTab(page, context.path, 'payments');
		await expect(
			nav.getByRole('link', {name: 'Settings', exact: true}),
		).toBeVisible({timeout: 15_000});
		await expect(paymentsLink).toHaveCount(0);
		await expect(institutionsLink).toHaveCount(0);

		// Enable payments (+ currency and a pay method — setup only; the
		// settings PERSISTENCE assertions live in the payments plan via
		// subscription-config.spec.js test 4).
		let form = panel
			.locator('form')
			.filter({has: page.locator('input[name="paymentsEnabled"]')})
			.first();
		await form.locator('input[name="paymentsEnabled"]').check();
		const currency = form.locator(
			'select#paymentSettings-currency-control',
		);
		await expect(currency).toBeVisible({timeout: 15_000});
		await currency.selectOption('CAD');
		await form
			.locator('select#paymentSettings-paymentPluginName-control')
			.selectOption({label: 'Manual Fee Payment'});
		await saveContextForm(page, form);

		// The sidebar is server-rendered page state — reload to pick it
		// up. Both entries appear for the manager (TemplateManager.php:189-217).
		await page.reload();
		await expect(paymentsLink).toBeVisible({timeout: 15_000});
		await expect(institutionsLink).toBeVisible();

		// Disable again: both entries disappear.
		await page.locator('#payments-button').click();
		form = page
			.locator('#payments form')
			.filter({has: page.locator('input[name="paymentsEnabled"]')})
			.first();
		await expect(
			form.locator('input[name="paymentsEnabled"]'),
		).toBeChecked();
		await form.locator('input[name="paymentsEnabled"]').uncheck();
		await saveContextForm(page, form);

		await page.reload();
		await expect(
			nav.getByRole('link', {name: 'Settings', exact: true}),
		).toBeVisible({timeout: 15_000});
		await expect(paymentsLink).toHaveCount(0);
		await expect(institutionsLink).toHaveCount(0);
	});

	// Row 5
	test('LOCKSS and CLOCKSS enablement gates the gateway manifests', {tag: '@regression'}, async ({page, pkpApi, playwright, baseURL}) => {
		test.slow();
		const tag = uniqueTag('dst5');
		const {context} = await pkpApi.createJournal({
			tag,
			publishingMode: 0,
			users: [{username: 'dbarnes', roles: ['manager']}],
			issues: [{...SCRATCH_ISSUE, published: true}],
		});
		const lockssUrl = `/index.php/${context.path}/gateway/lockss`;
		const clockssUrl = `/index.php/${context.path}/gateway/clockss`;

		const anon = await anonymousRequest(playwright, baseURL);
		try {
			// Flags off (fresh-journal default): both manifests are
			// refused — GatewayHandler 302s to the journal index.
			for (const url of [lockssUrl, clockssUrl]) {
				const refused = await anon.get(url, {maxRedirects: 0});
				expect(refused.status(), `${url} with flags off`).toBe(302);
				expect(refused.headers()['location']).toContain(
					`/${context.path}/index`,
				);
			}

			// Enable LOCKSS + CLOCKSS on Distribution > Archive > LOCKSS.
			await gotoDistributionTab(page, context.path, 'archive');
			await page.locator('#lockss-button').click();
			const form = page.locator('#lockss form').first();
			await expect(form).toBeVisible({timeout: 15_000});
			await form.locator('input[name="enableLockss"]').check();
			await form.locator('input[name="enableClockss"]').check();
			await saveContextForm(page, form);

			// Persistence: reload + reopen the nested tab; both stay checked.
			await page.reload();
			await page.locator('#archive-button').click();
			await page.locator('#lockss-button').click();
			const reloaded = page.locator('#lockss form').first();
			await expect(reloaded).toBeVisible({timeout: 15_000});
			await expect(
				reloaded.locator('input[name="enableLockss"]'),
			).toBeChecked();
			await expect(
				reloaded.locator('input[name="enableClockss"]'),
			).toBeChecked();

			// Anonymous manifests now render (publisher manifest +
			// permission statement + the seeded issue's archive listing).
			const lockssRes = await anon.get(lockssUrl, {maxRedirects: 0});
			expect(lockssRes.status()).toBe(200);
			const lockss = await lockssRes.text();
			expect(lockss).toContain('LOCKSS Publisher Manifest');
			expect(lockss).toContain(
				'LOCKSS system has permission to collect, preserve, and serve this Archival Unit.',
			);
			expect(lockss).toContain('Archive of Published Issues: 2026');

			const clockssRes = await anon.get(clockssUrl, {maxRedirects: 0});
			expect(clockssRes.status()).toBe(200);
			const clockss = await clockssRes.text();
			expect(clockss).toContain('CLOCKSS Publisher Manifest');
			expect(clockss).toContain(
				'CLOCKSS system has permission to ingest, preserve, and serve this Archival Unit.',
			);
			expect(clockss).toContain('Archive of Published Issues: 2026');
		} finally {
			await anon.dispose();
		}
	});
});
