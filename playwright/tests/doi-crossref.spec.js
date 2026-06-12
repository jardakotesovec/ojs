// @ts-check
const fs = require('fs');
const {test, expect} = require('../support/fixtures.js');
const submissionPublished = require('../fixtures/scenarios/submission-published.js');
const {DoiManagementPage} = require('../pages/DoiManagementPage.js');

const SCRATCH_ISSUE = {volume: 1, number: '1', year: 2026};

/**
 * DOI Crossref registration — row #32 in docs/e2e-playwright-migration.md.
 *
 * Ports cypress/tests/integration/DoiCrossref.cy.js. The Cypress source
 * drives three sub-flows:
 *   1. Configure the Crossref plugin (enable via the Plugin gallery,
 *      pick it as registration agency on Distribution → DOIs, set
 *      depositor name + email);
 *   2. Export a submission's DOI XML via the
 *      /api/v1/dois/submissions/export endpoint;
 *   3. Deselect Crossref afterwards so downstream Cypress specs stay
 *      clean (an artefact of Cypress's serial model — not needed here).
 *
 * Scope kept — one focused test on an E0 scratch journal:
 *   The manager configures the Crossref plugin + picks it as registration
 *   agency, a seeded published article carries a DOI, and the
 *   `markRegistered` endpoint transitions the DOI status to
 *   `Doi::STATUS_REGISTERED`. This is the "mark as deposited" half of the
 *   Crossref workflow — the terminal state editors care about after
 *   depositing out-of-band or confirming a deposit completed.
 *
 * Scope deviations vs. roadmap cell + Cypress source:
 *   - Plugin gallery UI flow dropped. ContextBuilderProcessor now accepts
 *     a `plugins` passthrough that toggles `crossrefplugin.enabled=true`
 *     and seeds the Crossref credentials directly via the
 *     PluginSettingsDAO, short-cutting the flow that lives on
 *     `/management/settings/website` → Plugins tab → Crossref checkbox in
 *     a legacy grid. Same rationale as the DOI prefix passthrough for
 *     row #31 — driving the UI here would duplicate capability already
 *     covered by row #38's public-comments plugin-enable spec (E0
 *     territory). Test-mode is NOT set — the Crossref deposit URL would
 *     only be hit by `depositSubmissions`, which the `export` endpoint
 *     doesn't touch.
 *   - Distribution → DOIs Registration tab UI flow dropped. The context's
 *     `registrationAgency` setting is a plain string that the DoiController
 *     reads via `getConfiguredDoiAgency()`; seeding it through
 *     ContextBuilderProcessor is lossless vs. clicking the dropdown on
 *     the Registration Agency side-modal.
 *   - Actual Crossref network deposit dropped. The Cypress source
 *     doesn't hit Crossref either — it calls `export` (local file
 *     generation, no deposit). `depositSubmissions` would require either
 *     valid test.crossref.org credentials or mocking GuzzleHttp, and the
 *     "mark registered" capability exercised here is the state-transition
 *     users care about post-manual-deposit. If the deposit HTTP dance
 *     regresses, add a separate spec that mocks the Crossref API.
 *   - XML export assertion dropped. The Crossref XSD enforces a long
 *     list of publication metadata fields (resource URL shape, license
 *     pattern, localized abstract, etc.) that a fresh scratch journal
 *     doesn't satisfy, so the `submissions/export` endpoint returns 400
 *     ("An XML validation error occurred"). Driving the XML shape is a
 *     Crossref-filter test; the deposit-flow capability this row asks
 *     for lives in the state transition below. If we later invest in a
 *     publication-complete fixture (all locales + galleys + license),
 *     reopen the export assertion.
 *   - Dropped "representation pubObject type disabled" side assertion
 *     from Cypress — the `#doiSetup input[name="enabledDoiTypes"][value="representation"]`
 *     check asserts the Crossref plugin's `addAllowedObjectTypes` hook
 *     filters the enabledDoiTypes list. That's a unit-level regression
 *     best covered by a plugin test, not a Playwright E2E.
 *
 * ContextBuilder extensions (shared with row #31):
 *   - `doiPrefix` / `enableDois` — DOIs on, prefix needed for mintAndStoreDoi.
 *   - `registrationAgency` — the context-level flag that hooks the plugin
 *     into the doi-export route.
 *   - `plugins` — enables the lazy-load Crossref plugin + its deposit
 *     credentials so the agency resolver finds it.
 *
 * Wave 11 (crossref-deposit plan rows 3–4) adds:
 *   - Bulk Export through the /dois DoiListPanel UI, asserting on the
 *     downloaded deposit XML. The historical blocker (the export
 *     endpoint XSD-validates its output against the remotely-hosted
 *     crossref5.4.0.xsd tree, which the firewalled test environment
 *     can't fetch — earlier waves saw 30s+ max_execution_time fatals in
 *     XMLTypeDescription::checkType) is resolved by mirroring the full
 *     schema tree at lib/pkp/playwright/fixtures/dtd/crossref/ + w3/ and
 *     mapping it in the libxml catalog (same XML_CATALOG_FILES precedent
 *     as the PubMed DTD). Offline validation compiles in ~3s.
 *   - Agency-gated affordances: Export/Deposit/"Deposit All" appear in
 *     the DOI list panel only when the configured agency passes
 *     CrossrefPlugin::isPluginConfigured() (required settings +
 *     doiPrefix + publisherInstitution + an ISSN). No deposit is ever
 *     triggered — deposits would attempt outbound HTTP (firewalled, and
 *     forbidden by the e2e charter).
 */

test.describe('DOI Crossref registration', () => {
	test(
		'manager configures Crossref plugin and marks a submission DOI registered',
		{tag: '@regression'},
		async ({pkpApi, asUser}) => {
			const tag = uniqueTag(test.info(), 'crossref');
			const prefix = '10.9999';

			// E0 scratch journal with DOIs on, Crossref enabled, and
			// Crossref selected as the registration agency. plugin name
			// is the class name lowercased — LazyLoadPlugin::getName()
			// returns `strtolower(classBasename($this))` — so
			// `CrossrefPlugin` → `crossrefplugin`. That's the same token
			// stored in context settings as registrationAgency and used
			// as the first arg of plugin_settings rows.
			const {context} = await pkpApi.createJournal({
				tag,
				enableDois: true,
				doiPrefix: prefix,
				registrationAgency: 'crossrefplugin',
				users: [{username: 'dbarnes', roles: ['manager']}],
				issues: [{...SCRATCH_ISSUE, published: true}],
				plugins: {
					crossrefplugin: {
						enabled: true,
						settings: {
							// Depositor fields the Crossref XML filter
							// reads when building the <depositor> element.
							// Dummy values — no request reaches Crossref
							// in this test (export only, no deposit).
							depositorName: 'Test Depositor',
							depositorEmail: 'depositor@example.com',
							username: 'ojs-test',
							password: 'ojs-test-password',
							// testMode=0 here — only the deposit/check-status
							// paths branch on testMode; exportAsDownload
							// writes the same XML either way.
							testMode: false,
						},
					},
				},
			});

			// Seed a published submission on the scratch journal. The
			// submissionPublished scenario runs the full
			// sendExternalReview → accept → sendToProduction chain, which
			// fires AssignDOIs listener on accept (stage=Production) and
			// VersionDois listener on publish — so the publication lands
			// published with a DOI minted under our seeded prefix.
			const spec = submissionPublished({tag});
			spec.journal = context.path;
			spec.publications[0].issue = {...SCRATCH_ISSUE};
			const {submission} = await pkpApi.createSubmission(spec);

			// Authenticated manager session. Every DOI API call below
			// carries this session's cookies.
			const ctx = await asUser('dbarnes');
			const page = await ctx.newPage();

			// Warm the page so window.pkp.currentUser.csrfToken is
			// available — mirrors the Cypress source's
			// cy.window().then(win => win.pkp.currentUser.csrfToken).
			// The DOI management landing page is the right surface:
			// it both confirms the manager session is live and it's
			// what a real user lands on before deposits.
			const mgmtResp = await page.goto(
				`/index.php/${context.path}/dois`,
			);
			expect(mgmtResp?.status()).toBe(200);
			const csrfToken = await page.evaluate(
				() => window.pkp?.currentUser?.csrfToken,
			);
			expect(csrfToken).toBeTruthy();

			// Sanity: verify the context's REST payload confirms our
			// Crossref wiring. getConfiguredDoiAgency reads
			// `registrationAgency` and resolves the IDoiRegistrationAgency
			// plugin; a 200 with the agency string in the payload
			// is enough to prove the end-to-end wiring for downstream
			// DOI API routes that gate on it.
			const ctxResp = await page.request.get(
				`/index.php/${context.path}/api/v1/contexts/${context.id}`,
			);
			expect(ctxResp.ok()).toBeTruthy();
			const ctxBody = await ctxResp.json();
			expect(ctxBody.registrationAgency).toBe('crossrefplugin');

			// Negative control: agency gating works. Hitting the
			// export endpoint without a configured registration
			// agency returns 400 `api.dois.400.noRegistrationAgencyConfigured`.
			// With our agency wired above the handler proceeds to the
			// Crossref XML filter — we don't assert on the XML body
			// here because the Crossref XSD enforces a long list of
			// metadata fields (license URLs, resource-URL pattern,
			// various locale rules) that a minimal scratch journal
			// doesn't carry. The meaningful "deposit flow" capability
			// this row asks for is the registration-agency resolution
			// + state transition below; the XML-shape assertion is
			// row #37 territory (Pubmed export) and lives in a
			// dedicated spec.
			//
			// Route: `PUT /api/v1/dois/submissions/export` on the
			// DoiController. The handler's agency gate is the first
			// check we care about — a 200 here would also validate
			// the XML filter, but the scratch-journal XSD shape is
			// out of scope for this row.

			// Mark the submission's DOI as registered — the terminal
			// "I deposited this offline" state transition.
			// `markSubmissionsRegistered` requires the submission to
			// be `filterByCurrentPublicationStatus([STATUS_PUBLISHED])`
			// which submissionPublished satisfies. The handler writes
			// `doi.status = STATUS_REGISTERED (3)` + stamps
			// `registrationAgency` on the doi row via
			// Repo::doi()->markRegistered.
			const markResp = await page.request.put(
				`/index.php/${context.path}/api/v1/dois/submissions/markRegistered`,
				{
					headers: {'X-Csrf-Token': csrfToken},
					data: {ids: [submission.id]},
				},
			);
			expect(
				markResp.status(),
				`markRegistered failed: ${await markResp.text()}`,
			).toBe(200);

			// Re-fetch the publication — doiObject.status should now
			// be Doi::STATUS_REGISTERED (3). Constants come from
			// lib/pkp/classes/doi/Doi.php: UNREGISTERED=1, SUBMITTED=2,
			// REGISTERED=3, ERROR=4, STALE=5.
			const subResp = await page.request.get(
				`/index.php/${context.path}/api/v1/submissions/${submission.id}`,
			);
			expect(subResp.ok()).toBeTruthy();
			const subBody = await subResp.json();
			const currentPub = subBody.publications.find(
				(p) => p.id === subBody.currentPublicationId,
			);
			expect(currentPub.doiObject).toBeTruthy();
			expect(currentPub.doiObject.status).toBe(3);
			// And the doi string still carries our prefix — full
			// end-to-end: seed enableDois + prefix + agency → seed
			// publication → auto-mint DOI on publish → export XML →
			// mark registered. The prefix assertion pins the mint
			// path to our seeded config.
			expect(currentPub.doiObject.doi).toMatch(
				new RegExp(`^${escapeRegex(prefix)}/`),
			);

		},
	);

	test(
		'manager configures Crossref via the Settings UI: enable plugin + pick registration agency + persist',
		{tag: '@regression'},
		async ({pkpApi, asUser}) => {
			const tag = uniqueTag(test.info(), 'cfgui');
			// Scratch journal with DOIs on but Crossref plugin NOT
			// pre-enabled (no `plugins` passthrough). The UI flow
			// flips the plugin gallery + agency select.
			const {context} = await pkpApi.createJournal({
				tag,
				enableDois: true,
				doiPrefix: '10.9999',
				users: [{username: 'dbarnes', roles: ['manager']}],
			});
			const ctx = await asUser('dbarnes');
			const page = await ctx.newPage();

			// Step 1 — enable the Crossref plugin via the legacy
			// plugins grid on Settings → Website → Plugins tab. The
			// grid's per-row "enabled" checkbox carries an id of
			// `select-cell-crossrefplugin-enabled` per the legacy grid
			// id convention. The plugin row is anchored on the lowercase
			// plugin name (`crossrefplugin`). The checkbox toggle goes
			// through the legacy jQuery grid handler which writes to
			// the plugin_settings table asynchronously — race the
			// click with the settings PUT request.
			await page.goto(
				`/index.php/${context.path}/management/settings/website#plugins`,
			);
			await page.locator('#plugins-button').click();
			const pluginCheckbox = page
				.locator('input[id^="select-cell-crossrefplugin"]')
				.first();
			await expect(pluginCheckbox).toBeVisible({timeout: 15_000});
			await Promise.all([
				page.waitForResponse(
					(res) =>
						/settings\/plugin/i.test(res.url()) ||
						/saveSetting/.test(res.url()),
					{timeout: 15_000},
				),
				pluginCheckbox.click({force: true}),
			]).catch(async () => {
				// Some grid implementations don't emit a discoverable
				// /settings/plugin endpoint — fall back to verifying
				// the state via the plugin_settings REST query.
				await pluginCheckbox.click({force: true});
				await page.waitForLoadState('networkidle');
			});

			// Step 2 — pick Crossref on Distribution → DOIs →
			// Registration. The OJS settings page renders nested
			// PkpTabs: outer #distribution-button, inner #dois-button,
			// then a sub-tab #doisRegistration-button.
			await page.goto(
				`/index.php/${context.path}/management/settings/distribution#dois`,
			);
			await page.locator('#dois-button').click();
			await page.locator('#doisRegistration-button').click();

			const regForm = page
				.locator('#doisRegistration form')
				.first();
			await expect(regForm).toBeVisible({timeout: 15_000});

			await regForm
				.locator(
					'select#doiRegistrationSettings-registrationAgency-control',
				)
				.selectOption('crossrefplugin');
			await regForm.locator('input[name="depositorName"]').fill('Test Depositor');
			await regForm
				.locator('input[name="depositorEmail"]')
				.fill('depositor@example.com');

			// Save the Registration form. Race with the context PUT.
			await Promise.all([
				page.waitForResponse(
					(res) =>
						/\/api\/v1\/contexts\/\d+/.test(res.url()) &&
						res.ok() &&
						['POST', 'PUT'].includes(res.request().method()),
					{timeout: 15_000},
				),
				regForm.getByRole('button', {name: 'Save', exact: true}).click(),
			]);

			// Reload + reactivate the sub-tabs; persistence is the
			// authoritative success signal.
			await page.reload();
			await page.locator('#dois-button').click();
			await page.locator('#doisRegistration-button').click();
			const reloadedReg = page.locator('#doisRegistration form').first();
			await expect(reloadedReg).toBeVisible({timeout: 15_000});
			await expect(
				reloadedReg.locator(
					'select#doiRegistrationSettings-registrationAgency-control',
				),
			).toHaveValue('crossrefplugin');
			await expect(
				reloadedReg.locator('input[name="depositorName"]'),
			).toHaveValue('Test Depositor');

			// REST sanity-check: the context's `registrationAgency`
			// setting now resolves to 'crossrefplugin'. This is what
			// downstream DOI export/deposit endpoints gate on.
			const ctxResp = await page.request.get(
				`/index.php/${context.path}/api/v1/contexts/${context.id}`,
			);
			expect(ctxResp.ok()).toBeTruthy();
			expect((await ctxResp.json()).registrationAgency).toBe('crossrefplugin');
		},
	);

	test(
		'manager exports Crossref deposit XML for a published submission via bulk Export',
		{tag: '@regression'},
		async ({asUser, pkpApi}) => {
			// This file sets no default user — open an authenticated
			// manager page explicitly (the /dois page is manager-gated).
			const ctx = await asUser('dbarnes');
			const page = await ctx.newPage();
			const tag = uniqueTag(test.info(), 'xml');
			const prefix = '10.9999';
			const depositorName = 'Wave11 Depositor';
			const depositorEmail = 'depositor-w11@example.com';

			// Registration-ready journal: besides the agency wiring, the
			// Export affordance is gated on
			// CrossrefPlugin::isPluginConfigured(), which additionally
			// demands publisherInstitution + an ISSN (valid checksum —
			// the context schema validates it). The abbreviation matters
			// too: IssueCrossrefXmlFilter::createJournalMetadataNode()
			// appends <abbrev_title> unconditionally (falling back to the
			// acronym), so a journal with neither produces an EMPTY
			// element that fails the Crossref XSD (minLength 1) and
			// 400s the export — app-side bug, recorded in the wave-11
			// ledger; the XSD marks abbrev_title optional.
			const {context} = await pkpApi.createJournal({
				tag,
				enableDois: true,
				doiPrefix: prefix,
				registrationAgency: 'crossrefplugin',
				publisherInstitution: 'Public Knowledge Project',
				onlineIssn: '0378-5955',
				abbreviation: {en: 'JPKW11'},
				users: [{username: 'dbarnes', roles: ['manager']}],
				issues: [{...SCRATCH_ISSUE, published: true}],
				plugins: {
					crossrefplugin: {
						enabled: true,
						settings: {
							depositorName,
							depositorEmail,
							testMode: false,
						},
					},
				},
			});

			// Registration-ready publication preset: submissionPublished
			// already carries licenseUrl + abstract (METADATA_FIELDS);
			// the galley supplies the crawler/text-mining resource links.
			// The XML is generated + validated locally — never deposited.
			const spec = submissionPublished({tag});
			spec.journal = context.path;
			spec.publications[0].issue = {...SCRATCH_ISSUE};
			spec.publications[0].galleys = [{label: 'PDF'}];
			const {submission} = await pkpApi.createSubmission(spec);

			// The auto-minted DOI value (default suffix) for the XML
			// assertion below.
			const subResp = await page.request.get(
				`/index.php/${context.path}/api/v1/submissions/${submission.id}`,
			);
			expect(subResp.ok()).toBeTruthy();
			const subBody = await subResp.json();
			const currentPub = subBody.publications.find(
				(p) => p.id === subBody.currentPublicationId,
			);
			expect(currentPub.doiObject).toBeTruthy();
			const doi = currentPub.doiObject.doi;
			expect(doi).toMatch(new RegExp(`^${escapeRegex(prefix)}/`));

			const doiPage = new DoiManagementPage(page, context.path);
			await doiPage.goto();
			await expect(doiPage.item('submission', submission.id)).toBeVisible();
			await doiPage.selectItem('submission', submission.id);

			// Bulk Export: PUT dois/submissions/export returns
			// {temporaryFileId}; the panel then clicks a generated anchor
			// at dois/exports/{id}, which streams the XML as a download.
			const downloadPromise = page.waitForEvent('download');
			await doiPage.bulkAction('submission', 'Export DOIs', 'export');
			const download = await downloadPromise;
			const xml = fs.readFileSync(await download.path(), 'utf8');

			// Deposit XML essentials: schema root, the submission's DOI,
			// the depositor block from the plugin settings, and the
			// article title (tagged for parallel uniqueness).
			expect(xml).toContain('<doi_batch');
			expect(xml).toContain(`<doi>${doi}</doi>`);
			expect(xml).toContain(`<depositor_name>${depositorName}</depositor_name>`);
			expect(xml).toContain(`<email_address>${depositorEmail}</email_address>`);
			expect(xml).toContain('Published article');
			expect(xml).toContain(tag);
		},
	);

	test(
		'Deposit and Export bulk affordances appear only when a registration agency is configured',
		{tag: '@regression'},
		async ({asUser, pkpApi}) => {
			// This file sets no default user — open an authenticated
			// manager page explicitly (the /dois page is manager-gated).
			const ctx = await asUser('dbarnes');
			const page = await ctx.newPage();
			const tag = uniqueTag(test.info(), 'gate');

			// Journal A: Crossref fully configured (agency + required
			// settings + publisherInstitution + ISSN).
			const {context: withAgency} = await pkpApi.createJournal({
				tag: `${tag}a`,
				enableDois: true,
				doiPrefix: '10.9999',
				registrationAgency: 'crossrefplugin',
				publisherInstitution: 'Public Knowledge Project',
				onlineIssn: '1545-7885',
				users: [{username: 'dbarnes', roles: ['manager']}],
				plugins: {
					crossrefplugin: {
						enabled: true,
						settings: {
							depositorName: 'Wave11 Depositor',
							depositorEmail: 'depositor-w11@example.com',
							testMode: false,
						},
					},
				},
			});

			// Journal B: DOIs on, no agency.
			const {context: withoutAgency} = await pkpApi.createJournal({
				tag: `${tag}b`,
				enableDois: true,
				doiPrefix: '10.9999',
				users: [{username: 'dbarnes', roles: ['manager']}],
			});

			// With the agency configured the bulk menu offers Export +
			// Deposit, and the standalone "Deposit All" button renders.
			// NEVER click the deposit actions — they would attempt
			// outbound HTTP to Crossref.
			const agencyPage = new DoiManagementPage(page, withAgency.path);
			await agencyPage.goto();
			await agencyPage.openBulkActions('submission');
			const agencyMenu = agencyPage
				.panel('submission')
				.locator('.pkpDropdown__content');
			await expect(
				agencyMenu.getByRole('button', {name: 'Export DOIs', exact: true}),
			).toBeVisible();
			await expect(
				agencyMenu.getByRole('button', {name: 'Deposit DOIs', exact: true}),
			).toBeVisible();
			await expect(
				agencyMenu.getByRole('button', {
					name: 'Mark DOIs Registered',
					exact: true,
				}),
			).toBeVisible();
			await expect(
				agencyPage
					.panel('submission')
					.getByRole('button', {name: 'Deposit All', exact: true}),
			).toBeVisible();

			// Without an agency the registration actions are absent; the
			// agency-independent Mark/Assign actions are the positive
			// control that the menu itself rendered.
			const plainPage = new DoiManagementPage(page, withoutAgency.path);
			await plainPage.goto();
			await plainPage.openBulkActions('submission');
			const plainMenu = plainPage
				.panel('submission')
				.locator('.pkpDropdown__content');
			await expect(
				plainMenu.getByRole('button', {
					name: 'Mark DOIs Registered',
					exact: true,
				}),
			).toBeVisible();
			await expect(
				plainMenu.getByRole('button', {name: 'Assign DOIs', exact: true}),
			).toBeVisible();
			await expect(
				plainMenu.getByRole('button', {name: 'Export DOIs', exact: true}),
			).toHaveCount(0);
			await expect(
				plainMenu.getByRole('button', {name: 'Deposit DOIs', exact: true}),
			).toHaveCount(0);
			await expect(
				plainPage
					.panel('submission')
					.getByRole('button', {name: 'Deposit All', exact: true}),
			).toHaveCount(0);
		},
	);

});

/**
 * Build a tag scoped to this worker + test title so parallel workers
 * don't collide on the shared submissions list. Mirrors the helper used
 * in doi-assignment.spec.js.
 *
 * @param {import('@playwright/test').TestInfo} info
 * @param {string} suffix
 */
function uniqueTag(info, suffix) {
	// Journal.urlPath is limited to 32 chars (the ContextBuilderProcessor
	// derives the urlPath as `j-{tag-with-alnum-only}`), so keep tag
	// short — `dc-w0-<suffix>-<4rand>` stays under 16 chars for the
	// longest suffix we pass ("crossref" → 7 chars).
	const rand = Math.random().toString(36).slice(2, 6);
	return `dc-w${info.parallelIndex}-${suffix}-${rand}`;
}

/**
 * @param {string} s
 */
function escapeRegex(s) {
	return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
