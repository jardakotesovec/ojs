// @ts-check
const {test, expect} = require('../support/fixtures.js');
const {AdminContextsPage} = require('../pages/AdminContextsPage.js');
const {
	setTinyMceContent,
	getTinyMceContent,
} = require('../../lib/pkp/playwright/support/tinymce.js');
const {
	waitForJQueryIdle,
} = require('../../lib/pkp/playwright/support/jquery.js');

/**
 * Site administration — docs/e2e/plans/site-administration.md rows
 * 2, 3, 5, 6, 7, 8. Sibling spec to admin-add-journal.spec.js (plan
 * row 1) and multiple-contexts.spec.js (plan row 4) — those absorbed
 * specs stay where they are; this file extends the same surface in the
 * OJS tree because every row here drives OJS journal creation or
 * journal-scoped admin UI.
 *
 * Parallel-safety adjudication (plan header): every row that mutates
 * the hosted-journals list operates ONLY on journals this spec created
 * itself (via the admin UI or the journal scenario endpoint). The
 * maintenance actions (cache clears, expire-sessions) are excluded —
 * serial-project territory per principle 9; row 8 keeps only the
 * read-only System Information page and triggers NO maintenance
 * action (and never passes ?versionCheck=1, which would attempt an
 * external — firewalled — HTTP call).
 *
 * Reauthentication note: AdminHandler wraps every admin op in
 * ReauthenticationRequiredPolicy, but config.test.inc.php leaves
 * `password_timeout` unset so Validation::isReauthenticationRequired()
 * is false and the admin session is always elevated
 * (PKPSessionGuard::isElevatedSessionActive, lines 331-334).
 *
 * Row 3's "granted via the journal's Users & Roles UI" surface is the
 * invitation wizard: probing during wave work established OJS exposes
 * NO non-invite role-grant path (see user-role-assignment.spec.js
 * header). The journal-scoped /api/v1/users search can't see a site
 * user who has no role in the journal yet (PKPUserController.php:157
 * forces contextId), so inviting dbarnes by email goes through the
 * "new email" branch; on opening the accept link,
 * UserRoleAssignmentInviteRedirectController::acceptHandle calls
 * changeInvitationUserIdUsingUserEmail() which re-links the invitation
 * to the existing account, the receive controller auto-logs the
 * invitation's user in (UserRoleAssignmentReceiveController.php:56-60)
 * and AcceptInvitationStep::getSteps collapses to the single review
 * step for a known user. This existing-user acceptance branch is not
 * covered by user-invitation.spec.js (new-user branch) nor
 * user-role-assignment.spec.js (stops at the pending invitation).
 */

test.use({user: 'admin'});

test.describe('Site administration', () => {
	test(
		'journal created through the admin wizard UI is publicly reachable and listed in grid + REST',
		{tag: '@regression'},
		async ({page, browser, baseURL}) => {
			// Plan row 2. The admin UI creation is the surface under
			// test (scenario-endpoint parity for the same state is
			// owned by test-infrastructure row 1).
			const token = scratchTag('sadm2');
			const path = token; // 15-16 chars, fits journals.path varchar(32)
			const name = `SADM2 Journal ${token}`;
			const acronym = `S2${token.slice(-6)}`;

			const contexts = new AdminContextsPage(page);
			await contexts.goto();
			const {id} = await contexts.createJournal({name, acronym, path});
			expect(id).toBeGreaterThan(0);

			// Contexts grid lists the new journal (name + urlPath
			// columns).
			await contexts.goto();
			const row = contexts.rowFor(path);
			await expect(row).toBeVisible({timeout: 15_000});
			await expect(row).toContainText(name);

			// REST contexts list (admin-scoped site endpoint). Context
			// searchPhrase matches acronym/description/abbreviation,
			// NOT urlPath or name (PKPContextQueryBuilder) — search by
			// the unique acronym.
			const apiResp = await page.request.get(
				`/index.php/index/api/v1/contexts?searchPhrase=${acronym}`,
			);
			expect(apiResp.ok()).toBe(true);
			const body = await apiResp.json();
			expect(
				body.items.some((c) => c.urlPath === path && c.id === id),
			).toBe(true);

			// Anonymous reader resolves the derived URL (no 404) and
			// sees the journal homepage — NOT the login bounce a
			// disabled journal produces (the login page still renders
			// the journal name in its banner, so the name assertion
			// alone would be a false positive; the not-/login URL check
			// is the load-bearing "publicly reachable" assertion).
			const anon = await anonContext(browser, baseURL);
			try {
				const reader = await anon.newPage();
				const resp = await reader.goto(`/index.php/${path}/`);
				expect(resp?.status()).toBe(200);
				await expect(reader).not.toHaveURL(/\/login/);
				await expect(reader.getByText(name).first()).toBeVisible({
					timeout: 15_000,
				});
			} finally {
				await anon.close();
			}
		},
	);

	test(
		'manager granted through the admin UI reaches the new journal settings without redirect',
		{tag: '@regression'},
		async ({page, browser, baseURL, asUser, pkpMail}) => {
			// Plan row 3 — long multi-actor flow (UI journal creation +
			// invitation wizard + email click-through + acceptance).
			test.slow();

			const token = scratchTag('sadm3');
			const path = token;
			// The invitation email body interpolates {$contextName}
			// (emails.userRoleAssignmentInvitationNotify.body), so the
			// whitespace-free token inside the journal name doubles as
			// the Mailpit `contains` scope (principle 8 — the shared
			// dbarnes@mailinator.com inbox is never wiped).
			const name = `SADM3 Journal ${token}`;
			const acronym = `S3${token.slice(-6)}`;

			const contexts = new AdminContextsPage(page);
			await contexts.goto();
			await contexts.createJournal({name, acronym, path});

			// --- Admin drives the new journal's Users & Roles UI ---
			await page.goto(`/index.php/${path}/management/settings/access`);
			await expect(
				page.getByRole('heading', {name: 'Users & Roles'}),
			).toBeVisible({timeout: 15_000});
			await page
				.getByRole('button', {name: 'Invite to a role', exact: true})
				.click();

			// Step 1 — Search User. dbarnes holds no role in the
			// freshly created journal, so the journal-scoped user
			// search cannot find him; his email falls into the
			// new-email branch (inviteeEmail on the wizard payload).
			await expect(
				page.getByRole('heading', {name: /STEP 1 - Search User/i}),
			).toBeVisible({timeout: 15_000});
			await page
				.locator('input[name="search"]')
				.fill('dbarnes@mailinator.com');
			await page
				.getByRole('button', {name: 'Search User', exact: true})
				.click();

			// Step 2 — Enter details + role table. Names are required
			// for the refine validation but ignored at finalize for an
			// existing account (the re-linked user keeps his own).
			await expect(
				page.getByRole('heading', {
					name: /STEP 2 - Enter details and invite for roles/i,
				}),
			).toBeVisible({timeout: 15_000});
			await page.locator('input[name="givenName-en"]').fill('Daniel');
			await page.locator('input[name="familyName-en"]').fill('Barnes');

			// One empty role row is pre-rendered. "Journal manager" is
			// the default manager user group installed on the
			// UI-created journal (default.groups.name.manager).
			await page
				.locator('select[name="userGroupId"]')
				.selectOption({label: 'Journal manager'});
			const today = new Date().toISOString().split('T')[0];
			await page.locator('input[name="dateStart"]').fill(today);
			// Manager is not a reviewer role, so the masthead select
			// renders (reviewer roles auto-appear and omit it).
			await page
				.locator('select[name="masthead"]')
				.last()
				.selectOption({label: 'Appear on the masthead'});

			await page
				.getByRole('button', {name: 'Save And Continue', exact: true})
				.click();

			// Step 3 — email composer; the seeded
			// UserRoleAssignmentInvitationNotify body is auto-loaded.
			await expect(
				page.getByRole('button', {
					name: 'Invite user to the role',
					exact: true,
				}),
			).toBeVisible({timeout: 15_000});
			await page
				.getByRole('button', {name: 'Invite user to the role', exact: true})
				.click();
			const sentDialog = page.getByRole('dialog', {
				name: 'Invitation Sent',
			});
			await expect(sentDialog).toBeVisible({timeout: 15_000});
			await expect(sentDialog).toContainText('dbarnes@mailinator.com');

			// --- Email side (scoped: recipient + unique token) ---
			const messages = await pkpMail.find({
				to: 'dbarnes@mailinator.com',
				contains: token,
				timeoutMs: 20_000,
			});
			const full = await pkpMail.fullMessage(messages[0].ID);
			const acceptUrl = extractAcceptUrl(full.HTML || '');

			// --- dbarnes accepts via the email link ---
			// Fresh empty-state context (patterns.md rule 8) — the
			// accept flow re-links the invitation to dbarnes's existing
			// account by email match and auto-logs him in, so the
			// wizard collapses to the single review step.
			const inviteeCtx = await anonContext(browser, baseURL);
			try {
				const inviteePage = await inviteeCtx.newPage();
				await inviteePage.goto(acceptUrl);

				// Review step lists the role being added.
				await expect(
					inviteePage.getByText(/Journal manager/i).first(),
				).toBeVisible({timeout: 20_000});
				// OJS overrides the next-button label to "Accept And
				// Continue to OJS"; anchor on the invariant prefix.
				await inviteePage
					.getByRole('button', {name: /^Accept And Continue/i})
					.click();

				const successDialog = inviteePage.getByRole('dialog');
				await expect(successDialog).toBeVisible({timeout: 20_000});
				await expect(successDialog).toContainText(/new role/i);
			} finally {
				await inviteeCtx.close();
			}

			// REST: dbarnes now holds the Journal manager group on the
			// wizard-created journal (admin session for the GET).
			const usersResp = await page.request.get(
				`/index.php/${path}/api/v1/users?searchPhrase=dbarnes`,
			);
			expect(usersResp.ok()).toBe(true);
			const usersBody = await usersResp.json();
			const dbarnes = usersBody.items.find(
				(u) => u.email === 'dbarnes@mailinator.com',
			);
			expect(dbarnes, 'dbarnes enrolled in the new journal').toBeTruthy();
			const groupNames = (dbarnes.groups || []).map((g) =>
				typeof g.name === 'string'
					? g.name
					: g.name?.en || Object.values(g.name || {})[0],
			);
			expect(
				groupNames.some((n) => /journal manager/i.test(String(n))),
				`manager group present (got ${JSON.stringify(groupNames)})`,
			).toBe(true);

			// --- The load-bearing assertion: dbarnes reaches the new
			// journal's settings without a /login redirect ---
			const dbarnesCtx = await asUser('dbarnes');
			const dbarnesPage = await dbarnesCtx.newPage();
			const resp = await dbarnesPage.goto(
				`/index.php/${path}/management/settings/context`,
			);
			expect(resp?.status()).toBe(200);
			await expect(dbarnesPage).not.toHaveURL(/\/login/);
			await expect(
				dbarnesPage.getByRole('heading', {
					name: 'Journal Settings',
					level: 1,
				}),
			).toBeVisible({timeout: 15_000});
		},
	);

	test(
		'site admin edits a hosted journal from the contexts grid and the rename renders publicly',
		{tag: '@regression'},
		async ({page, browser, baseURL, pkpApi}) => {
			// Plan row 5. Scratch journal via the scenario endpoint —
			// the surface under test is the grid's Edit action, not
			// journal creation. acronym is seeded because the edit
			// ContextForm requires it (isRequired) and the scenario
			// default leaves it empty, which would block the save.
			const token = scratchTag('sadm5');
			const origName = `SADM5 Journal ${token}`;
			const newName = `SADM5 Renamed ${token}`;
			const {context} = await pkpApi.createJournal({
				tag: token,
				name: {en: origName},
				acronym: {en: `S5${token.slice(-4)}`},
			});

			const contexts = new AdminContextsPage(page);
			await contexts.goto();
			const form = await contexts.openEditForm(context.path);

			// The edit modal pre-fills the current name.
			await expect(form.locator('input[name="name-en"]')).toHaveValue(
				origName,
			);
			await form.locator('input[name="name-en"]').fill(newName);

			await Promise.all([
				page.waitForResponse(
					(res) =>
						/\/api\/v1\/contexts\/\d+(\?|$)/.test(res.url()) &&
						res.ok() &&
						['POST', 'PUT'].includes(res.request().method()),
					{timeout: 15_000},
				),
				form.getByRole('button', {name: 'Save', exact: true}).click(),
			]);
			// Edit mode keeps the modal open and surfaces the canonical
			// form-save confirmation (patterns.md pitfall 13).
			await expect(
				form.locator('[role="status"]', {hasText: 'Saved'}),
			).toBeVisible({timeout: 15_000});

			// The rename persists in the grid across a reload.
			await contexts.goto();
			await expect(contexts.rowFor(context.path)).toContainText(newName);

			// Anonymous: site index listing + journal homepage header.
			const anon = await anonContext(browser, baseURL);
			try {
				const reader = await anon.newPage();
				const indexResp = await reader.goto('/index.php/index');
				expect(indexResp?.status()).toBe(200);
				await expect(
					reader.locator('.journals a[rel="bookmark"]', {
						hasText: newName,
					}),
				).toBeVisible({timeout: 15_000});

				const homeResp = await reader.goto(
					`/index.php/${context.path}/`,
				);
				expect(homeResp?.status()).toBe(200);
				// Default skin renders the journal name as the text
				// site-name anchor (no logo on a scratch journal).
				await expect(
					reader.locator('.pkp_site_name a.is_text'),
				).toContainText(newName, {timeout: 15_000});
			} finally {
				await anon.close();
			}
		},
	);

	test(
		'site admin deletes a hosted journal and it disappears from grid, site index and its URL',
		{tag: '@regression'},
		async ({page, browser, baseURL, pkpApi}) => {
			// Plan row 6. Mutates only the scratch journal this test
			// created (parallel-safety adjudication in the plan header).
			const token = scratchTag('sadm6');
			const name = `SADM6 Journal ${token}`;
			const {context} = await pkpApi.createJournal({
				tag: token,
				name: {en: name},
				acronym: {en: `S6${token.slice(-4)}`},
			});

			// Positive controls before deletion: listed on the site
			// index and the public URL serves the journal.
			const anon = await anonContext(browser, baseURL);
			try {
				const reader = await anon.newPage();
				const preIndex = await reader.goto('/index.php/index');
				expect(preIndex?.status()).toBe(200);
				await expect(
					reader
						.locator(`.journals a[href*="/${context.path}"]`)
						.first(),
				).toBeVisible({timeout: 15_000});
				const preHome = await reader.goto(
					`/index.php/${context.path}/`,
				);
				expect(preHome?.status()).toBe(200);

				// Delete via the contexts grid with confirmation.
				const contexts = new AdminContextsPage(page);
				await contexts.goto();
				await contexts.deleteJournal(context.path);

				// Row gone from the grid (the dataChanged event removed
				// it without a reload)…
				await expect(contexts.rowFor(context.path)).toHaveCount(0, {
					timeout: 15_000,
				});
				// …and stays gone across a reload.
				await contexts.goto();
				await expect(contexts.rowFor(context.path)).toHaveCount(0);

				// Gone from the anonymous site index.
				const postIndex = await reader.goto('/index.php/index');
				expect(postIndex?.status()).toBe(200);
				await expect(
					reader.locator(`.journals a[href*="/${context.path}"]`),
				).toHaveCount(0);

				// The public URL no longer serves the journal.
				const postHome = await reader.goto(
					`/index.php/${context.path}/`,
				);
				expect(postHome?.status()).toBe(404);
			} finally {
				await anon.close();
			}
		},
	);

	test(
		'settings wizard configures a fresh journal across its context, appearance, languages and indexing tabs',
		{tag: '@regression'},
		async ({page, pkpApi}) => {
			// Plan row 7. Journal via the scenario endpoint (the plan
			// allows either seed); each tab's save is re-asserted on a
			// wizard reload. Tab order matters: the context tab changes
			// the urlPath, and the wizard's API URLs embed the path at
			// page render (AdminHandler::wizard), so the page is
			// reloaded after that save before driving the other tabs.
			test.slow();
			const token = scratchTag('sadm7');
			const origName = `SADM7 Journal ${token}`;
			const {context} = await pkpApi.createJournal({
				tag: token,
				name: {en: origName},
				acronym: {en: `S7${token.slice(-4)}`},
			});

			const wizardUrl = `/index.php/index/admin/wizard/${context.id}`;
			const newName = `SADM7 Configured ${token}`;
			const description = `Wizard description marker ${token}`;
			const newPath = `${context.path}r`;
			const searchDescription = `Search indexing marker ${token}`;

			// --- Tab 1: context form (name / description / path) ---
			const resp = await page.goto(wizardUrl);
			expect(resp?.status()).toBe(200);
			await expect(
				page.getByRole('heading', {name: /Settings Wizard/i, level: 1}),
			).toBeVisible({timeout: 15_000});

			const contextPanel = page.locator('#context');
			await expect(
				contextPanel.locator('input[name="name-en"]'),
			).toHaveValue(origName, {timeout: 15_000});
			await contextPanel.locator('input[name="name-en"]').fill(newName);
			await setTinyMceContent(
				page,
				'context-description-control-en',
				`<p>${description}</p>`,
			);
			await contextPanel.locator('input[name="urlPath"]').fill(newPath);
			await Promise.all([
				page.waitForResponse(
					(res) =>
						/\/api\/v1\/contexts\/\d+(\?|$)/.test(res.url()) &&
						res.ok() &&
						['POST', 'PUT'].includes(res.request().method()),
					{timeout: 15_000},
				),
				contextPanel
					.getByRole('button', {name: 'Save', exact: true})
					.click(),
			]);
			await expect(
				contextPanel.locator('[role="status"]', {hasText: 'Saved'}),
			).toBeVisible({timeout: 15_000});

			// Reload: saved values round-trip (and the page regenerates
			// its API URLs against the new path).
			await page.goto(wizardUrl);
			await expect(
				contextPanel.locator('input[name="name-en"]'),
			).toHaveValue(newName, {timeout: 15_000});
			await expect(
				contextPanel.locator('input[name="urlPath"]'),
			).toHaveValue(newPath);
			expect(
				await getTinyMceContent(page, 'context-description-control-en'),
			).toContain(description);

			// --- Tab 2: appearance (theme form) persists the selection ---
			await page.locator('#appearance-button').click();
			const appearancePanel = page.locator('#appearance');
			// Only the default theme ships with the test install, so
			// the persisted "selection" is the default theme's
			// typography option (a real theme-form save against
			// /contexts/{id}/theme) plus the theme select itself.
			await expect(
				appearancePanel.locator('select[name="themePluginPath"]'),
			).toHaveValue('default', {timeout: 15_000});
			const typography = appearancePanel.locator(
				'input[name="typography"][value="notoSerif"]',
			);
			await typography.check();
			await Promise.all([
				page.waitForResponse(
					(res) =>
						/\/api\/v1\/contexts\/\d+\/theme/.test(res.url()) &&
						res.ok() &&
						['POST', 'PUT'].includes(res.request().method()),
					{timeout: 15_000},
				),
				appearancePanel
					.getByRole('button', {name: 'Save', exact: true})
					.click(),
			]);
			await expect(
				appearancePanel.locator('[role="status"]', {hasText: 'Saved'}),
			).toBeVisible({timeout: 15_000});

			await page.goto(wizardUrl);
			await page.locator('#appearance-button').click();
			await expect(
				appearancePanel.locator(
					'input[name="typography"][value="notoSerif"]',
				),
			).toBeChecked({timeout: 15_000});

			// --- Tab 3: languages grid lists installed locales with
			// their toggles (read-only — toggling fr_CA on would
			// install journal locale data, which isn't this row's
			// behavior) ---
			await page.locator('#languages-button').click();
			const langGrid = page.locator('#languageGridContainer');
			await expect(langGrid).toBeVisible({timeout: 15_000});
			await waitForJQueryIdle(page);
			// Management columns (ManageLanguageGridHandler:97-100):
			// Locale / Code / Primary / UI / Forms.
			await expect(
				langGrid.getByText('Primary locale', {exact: true}),
			).toBeVisible();
			await expect(langGrid.getByText('UI', {exact: true})).toBeVisible();
			await expect(
				langGrid.getByText('Forms', {exact: true}),
			).toBeVisible();
			const enRow = langGrid.locator('tr.gridRow', {hasText: 'English'});
			const frRow = langGrid.locator('tr.gridRow', {hasText: 'fr_CA'});
			await expect(enRow).toBeVisible();
			await expect(frRow).toBeVisible();
			// en is the journal's primary locale: radio checked; both
			// rows expose their toggle checkboxes.
			await expect(
				enRow.locator('input[type="radio"]').first(),
			).toBeChecked();
			expect(
				await frRow.locator('input[type="checkbox"]').count(),
			).toBeGreaterThan(0);
			// The submission-languages grid renders alongside.
			await expect(
				page.locator('#submissionLanguageGridContainer'),
			).toBeVisible();

			// --- Tab 4: search-indexing form round-trips ---
			await page.locator('#indexing-button').click();
			const indexingPanel = page.locator('#indexing');
			const searchDescInput = indexingPanel.locator(
				'input[name="searchDescription-en"]',
			);
			await expect(searchDescInput).toBeVisible({timeout: 15_000});
			await searchDescInput.fill(searchDescription);
			await Promise.all([
				page.waitForResponse(
					(res) =>
						/\/api\/v1\/contexts\/\d+(\?|$)/.test(res.url()) &&
						res.ok() &&
						['POST', 'PUT'].includes(res.request().method()),
					{timeout: 15_000},
				),
				indexingPanel
					.getByRole('button', {name: 'Save', exact: true})
					.click(),
			]);
			await expect(
				indexingPanel.locator('[role="status"]', {hasText: 'Saved'}),
			).toBeVisible({timeout: 15_000});

			await page.goto(wizardUrl);
			await page.locator('#indexing-button').click();
			await expect(
				indexingPanel.locator('input[name="searchDescription-en"]'),
			).toHaveValue(searchDescription, {timeout: 15_000});
		},
	);

	test(
		'system information page renders version, server and configuration sections read-only',
		{tag: '@regression'},
		async ({page}) => {
			// Plan row 8 — strictly read-only. No maintenance action is
			// triggered (cache clears / expire-sessions are serial-
			// project territory, principle 9) and the version-check
			// link (?versionCheck=1 → external HTTP) is never followed.
			const resp = await page.goto('/index.php/index/admin/systemInfo');
			expect(resp?.status()).toBe(200);

			await expect(
				page.getByRole('heading', {name: 'System Information', level: 1}),
			).toBeVisible({timeout: 15_000});

			// Application version block + version history table.
			await expect(
				page.getByRole('heading', {name: /Current version/i}),
			).toBeVisible();
			const versionHistory = page.getByRole('heading', {
				name: /Version history/i,
			});
			await expect(versionHistory).toBeVisible();

			// Server information section lists platform/PHP/database
			// rows with non-empty values.
			await expect(
				page.getByRole('heading', {name: 'Server Information'}),
			).toBeVisible();
			const platformRow = page.locator('tr', {
				hasText: 'OS platform',
			});
			await expect(platformRow.first()).toBeVisible();
			await expect(
				page.locator('tr', {hasText: 'PHP version'}).first(),
			).toBeVisible();

			// Configuration section dumps config.inc.php data grouped
			// by section; `general` carries base_url on every install.
			await expect(
				page.getByRole('heading', {name: /Configuration/i}),
			).toBeVisible();
			await expect(page.getByText('base_url').first()).toBeVisible();

			// The phpinfo link renders but is NOT followed (it would
			// open a separate page; row 8 is render-only).
			await expect(
				page.getByRole('link', {name: /Extended PHP Information/i}),
			).toBeVisible();

			// Read-only guarantee: still on systemInfo, no redirect to
			// any maintenance op.
			expect(page.url()).toContain('/admin/systemInfo');
		},
	);
});

/**
 * Short worker-scoped tag with a per-run random suffix. Doubles as the
 * journal urlPath for UI-created journals (journals.path is
 * varchar(32)) and as the whitespace-free Mailpit/content scope token,
 * so it must stay short and contain no whitespace (patterns.md tag
 * conventions).
 *
 * @param {string} prefix
 */
function scratchTag(prefix) {
	const workerIndex = test.info().parallelIndex;
	const suffix = Math.random().toString(36).slice(2, 8);
	return `${prefix}-w${workerIndex}-${suffix}`;
}

/**
 * Fresh anonymous browser context. The explicit empty storageState is
 * required because this file sets `test.use({user: 'admin'})` — a bare
 * `browser.newContext()` would inherit the admin session
 * (patterns.md rule 8).
 *
 * @param {import('@playwright/test').Browser} browser
 * @param {string} [baseURL]
 */
async function anonContext(browser, baseURL) {
	return browser.newContext({
		baseURL,
		storageState: {cookies: [], origins: []},
	});
}

/**
 * Pull the `<a href='…' class='btn btn-accept'>` URL out of the
 * userRoleAssignmentInvitationNotify HTML body. The shared
 * `pkpMail.extractLink` requires double-quoted hrefs and contiguous
 * link text — the invitation template ships single quotes and a class
 * attribute, so this stays local (same shape as
 * lib/pkp/playwright/tests/user-invitation.spec.js).
 *
 * @param {string} html
 */
function extractAcceptUrl(html) {
	const re =
		/<a[^>]+href=['"]([^'"]+)['"][^>]*class=['"][^'"]*btn-accept[^'"]*['"][^>]*>/i;
	const match = html.match(re);
	if (!match) {
		throw new Error('Accept Invitation link not found in mail body');
	}
	return match[1].replace(/&amp;/g, '&');
}
