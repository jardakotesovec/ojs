// @ts-check
const {test, expect} = require('../../support/fixtures.js');
const {setTinyMceContent} = require('../../../lib/pkp/playwright/support/tinymce.js');
const path = require('path');

/**
 * Site settings — the site administrator's configuration of the installation
 * itself: Administration → Site Settings (site identity, information,
 * appearance, security policy, statistics ceiling) and the public/journal
 * surfaces each field ripples onto. One test per canonical scenario of
 * docs/product/specs/site-settings.md (4 scenarios → 4 tests, 1:1).
 *
 * WHY SERIAL: every mutation here hits the ONE global Site row — there are no
 * scratch sites. Site title / contact / appearance / password policy are read
 * by every parallel worker (backend header, login, registration), so a flip
 * mid-suite could corrupt other workers' assertions. This spec runs in the
 * single-worker `serial` project (after the parallel `ojs` project), and every
 * test SNAPSHOTS the fields it touches and RESTORES them in a `finally`, so
 * the site is pristine even when an assertion throws.
 *
 * NEVER TOUCHED (global-breaking, probed read-only / code-verified instead):
 * the journal redirect (`redirectContextId` — setting it re-routes every
 * site-level URL, incl. this suite's own API calls), force_ssl (config file),
 * the site primary locale and installed locales (owned by languages-locales).
 *
 * KNOWN LEDGER ROWS asserted AS-BUILT:
 *   - ⚠ Row 149 (tests 1+2): PKPSiteService::validate() passes the PUBLICATION
 *     schema's required-prop list instead of the site schema's, so the API
 *     accepts blanking the site's own required fields (contactName → 200,
 *     empty persisted; restored immediately). The UI's client-side gate still
 *     refuses ("This field is required.") — both faces asserted.
 *   - Row 150: the single-journal collapse hides the only Journal-redirect UI.
 *     Not reproducible in this 200+-journal env — code-verified only
 *     (AdminHandler::siteSettingsAvailability(), getCount() !== 1).
 *   - Row 151 (test 3): (a) PKPSiteController::getTheme() misses a `return` on
 *     its theme-not-found branch (500 instead of 404) — code-verified only,
 *     driving it would strand the site on a dead theme; (b) the page renders
 *     TWO elements with id="setup" (Site Setup outer tab + Appearance → Setup
 *     inner tab) — asserted as-built, and all Appearance locators are scoped
 *     through the #appearance panel to dodge the strict-mode violation.
 *
 * SPEC CORRECTIONS MADE (as-built contradicted the draft; spec updated):
 *   - The site style sheet is linked on EVERY page — journal pages included —
 *     not just site-level pages (OJS TemplateManager::initialize() adds
 *     `siteStylesheet` before the context branch). Test 3 asserts as-built.
 *   - Registration ENFORCES the minimum password length but shows no hint;
 *     the hint renders on the change/reset-password forms only
 *     (userRegister.tpl has no passwordLengthRestriction; changePassword.tpl/
 *     userPasswordReset.tpl do). Test 4 asserts enforcement + the error
 *     message (which displays the new minimum).
 *
 * AUTH: test.use admin — the site administrator is the only legitimate actor.
 * The permission boundary uses dbarnes (journal manager, read-only probes —
 * never enrolled anywhere new). Public reads use explicit empty-state
 * anonymous contexts. The rate-limit lock probe uses a DEDICATED throwaway
 * user on a scratch journal (the lock is keyed IP + username, so no shared
 * account is ever locked).
 */

const SITE_ADMIN_URL = '/index.php/index/admin/settings';
const SITE_API = '/index.php/index/api/v1/site';
const PNG_FIXTURE = path.join(
	__dirname,
	'../../../lib/pkp/playwright/fixtures/files/dependent-image.png',
);
const CSS_FIXTURE = path.join(
	__dirname,
	'../../fixtures/files/journal-stylesheet.css',
);

test.use({user: 'admin'});

/** A unique, hyphenless, lowercased alphanumeric token. */
function uniqueTag(prefix = 'sset') {
	let suffix = '';
	while (suffix.length < 6) {
		suffix += Math.random().toString(36).replace(/[^a-z0-9]/g, '');
	}
	return `${prefix}${suffix.slice(0, 6)}`;
}

/** Read the session CSRF token from a loaded backend page. */
async function csrfToken(page) {
	await page.waitForFunction(
		() =>
			// @ts-ignore pkp global
			!!window.pkp?.currentUser?.csrfToken ||
			!!document.querySelector('meta[name="csrf-token"]'),
		null,
		{timeout: 15_000},
	);
	return page.evaluate(
		() =>
			// @ts-ignore pkp global
			window.pkp?.currentUser?.csrfToken ||
			document
				.querySelector('meta[name="csrf-token"]')
				?.getAttribute('content'),
	);
}

/**
 * Read the CSRF token of an authenticated BrowserContext by scraping the
 * <meta name="csrf-token"> off the site-level profile page.
 */
async function csrfFor(ctx) {
	const res = await ctx.request.get('/index.php/index/user/profile');
	const m = (await res.text()).match(/name="csrf-token" content="([^"]+)"/);
	if (!m) throw new Error(`csrf meta tag not found (${res.url()})`);
	return m[1];
}

/** GET the full site record (site-admin session required). */
async function getSite(requestCtx) {
	const res = await requestCtx.get(SITE_API);
	expect(res.ok(), `GET site ${res.status()}`).toBeTruthy();
	return res.json();
}

/** PUT site settings (callers assert the status — some probes EXPECT refusal). */
async function putSite(requestCtx, data, csrf) {
	return requestCtx.put(SITE_API, {
		headers: {'X-Csrf-Token': csrf, 'Content-Type': 'application/json'},
		data,
	});
}

/**
 * Restore payload for a multilingual field: every site locale explicitly
 * null (SiteDAO deletes null-valued locale rows) overlaid with whatever the
 * snapshot held — so a restore reproduces the exact pre-test row set.
 */
function localesOrNull(value) {
	return {en: null, fr_CA: null, ...(value ?? {})};
}

/**
 * Save the pkp-form in a panel and wait for the site API write + the
 * user-visible "Saved" badge. useFetch tunnels PUT via POST + override.
 */
async function saveSiteForm(page, panel) {
	const [response] = await Promise.all([
		page.waitForResponse(
			(r) =>
				r.url().split('?')[0].endsWith('/api/v1/site') &&
				['POST', 'PUT'].includes(r.request().method()),
			{timeout: 20_000},
		),
		panel
			.locator('form')
			.first()
			.getByRole('button', {name: 'Save', exact: true})
			.click(),
	]);
	expect(response.status()).toBe(200);
	await expect(
		panel.locator('[role="status"]', {hasText: 'Saved'}),
	).toBeVisible({timeout: 15_000});
	return response;
}

/** A fresh anonymous browser context (explicit empty storage state). */
async function newAnonContext(browser, baseURL) {
	return browser.newContext({
		baseURL,
		storageState: {cookies: [], origins: []},
	});
}

/** Open publicknowledge's Distribution → Statistics tab (manager page). */
async function openJournalStatsPanel(mgrPage) {
	await mgrPage.goto(
		'/index.php/publicknowledge/management/settings/distribution',
	);
	await mgrPage.locator('#statistics-button').click();
	const panel = mgrPage.locator('#statistics');
	await expect(panel.locator('form').first()).toBeVisible({timeout: 20_000});
	return panel;
}

test.describe('Site settings — Administration → Site Settings (serial)', () => {
	// ── Scenario 1 — Admin configures the site front door; a manager is refused ──
	// The admin renames the site on Site Setup → Settings: one Save, one PUT;
	// the new name reaches the backend header and the anonymous site index. The
	// Journal-redirect select offers blank + exactly the ENABLED journals (the
	// field is probed READ-ONLY — setting it would re-route every site-level
	// URL). Blanking the required Site Name is refused by the client-side form
	// gate ("This field is required.", nothing saved — the API-side hole is row
	// 149, driven in test 2 on contactName). The manager boundary: dbarnes has
	// no Administration menu entry, the page bounces him, and the site API
	// refuses GET (401) and PUT (403) — the title survives untouched.
	test(
		'front door: rename reaches header + site index; redirect roster = enabled journals; blank name refused in-form; manager refused',
		{tag: ['@smoke', '@regression']},
		async ({page, browser, baseURL, asUser}) => {
			test.slow();
			const tag = uniqueTag();
			const newName = `Site Renamed ${tag}`;
			const snap = await getSite(page.request);
			let csrf;
			try {
				await page.goto(SITE_ADMIN_URL);
				csrf = await csrfToken(page);
				await page.locator('#settings-button').click();
				const panel = page.locator('#settings');
				await expect(
					panel.locator('#siteConfig-title-control-en'),
				).toBeVisible({timeout: 20_000});

				// The redirect select: blank first option + one option per
				// ENABLED journal (disabled journals excluded) — compared
				// against the contexts API's own enabled count.
				const enabledRes = await page.request.get(
					'/index.php/index/api/v1/contexts?isEnabled=true&count=1',
				);
				expect(enabledRes.ok()).toBeTruthy();
				const {itemsMax} = await enabledRes.json();
				const options = panel.locator(
					'#siteConfig-redirectContextId-control option',
				);
				await expect(options).toHaveCount(itemsMax + 1);
				await expect(options.first()).toHaveText('');
				await expect(
					options.filter({hasText: 'Journal of Public Knowledge'}).first(),
				).toBeAttached();
				// NEVER set the redirect on this shared site (spec rule 3 note).

				// Rename the site — one Save, one PUT, echoed back.
				await panel.locator('#siteConfig-title-control-en').fill(newName);
				const saveRes = await saveSiteForm(page, panel);
				expect((await saveRes.json()).title.en).toBe(newName);

				// Backend header (site-level backend pages) shows the new name…
				await page.goto(SITE_ADMIN_URL);
				await expect(page.locator('.app__contextTitle')).toHaveText(newName);

				// …and the anonymous site index carries it as <title> + header.
				const anon = await newAnonContext(browser, baseURL);
				try {
					const pub = await anon.newPage();
					await pub.goto('/index.php/index');
					await expect(pub).toHaveTitle(new RegExp(tag));
					await expect(
						pub.locator('.pkp_site_name a.is_text'),
					).toHaveText(newName);
				} finally {
					await anon.close();
				}

				// Blank Site Name: the client-side gate refuses — no request
				// fires, nothing is stored (the server would accept it: row 149).
				await page.locator('#settings-button').click();
				await panel.locator('#siteConfig-title-control-en').fill('');
				await panel
					.locator('form')
					.first()
					.getByRole('button', {name: 'Save', exact: true})
					.click();
				await expect(
					panel.getByText('This field is required.').first(),
				).toBeVisible();
				expect((await getSite(page.request)).title.en).toBe(newName);

				// The manager boundary: no menu entry, page refused, API refused.
				const mgr = await asUser('dbarnes');
				const mgrPage = await mgr.newPage();
				await mgrPage.goto('/index.php/publicknowledge/dashboard/editorial');
				const mgrNav = mgrPage.locator('nav#app-nav');
				await expect(
					mgrNav.getByText('Settings', {exact: true}),
				).toBeVisible();
				await expect(
					mgrNav.getByText('Administration', {exact: true}),
				).toHaveCount(0);
				const deniedPage = await mgr.request.get(SITE_ADMIN_URL);
				expect(await deniedPage.text()).toContain(
					'The current role does not have access to this operation',
				);
				const apiGet = await mgr.request.get(SITE_API);
				expect(apiGet.status(), 'manager GET site → 401').toBe(401);
				// With a VALID session CSRF the refusal is the role gate's 401
				// (the spec draft's "PUT → 403" was the CSRF refusal — spec
				// corrected; without the token the CSRF middleware 403s first).
				const apiPut = await putSite(
					mgr.request,
					{title: {en: `Hijacked ${tag}`}},
					await csrfFor(mgr),
				);
				expect(apiPut.status(), 'manager PUT site → 401').toBe(401);
				expect((await getSite(page.request)).title.en).toBe(newName);
			} finally {
				if (csrf) {
					const res = await putSite(
						page.request,
						{title: localesOrNull(snap.title)},
						csrf,
					);
					expect(res.status(), 'title restored').toBe(200);
				}
			}
		},
	);

	// ── Scenario 2 — Site information surfaces publicly ──────────────────────
	// The admin fills About-the-site, principal contact and Privacy Statement
	// on Site Setup → Information (one PUT). The about text renders on the
	// multi-journal front page and /about/privacy serves the statement — which
	// 404s while empty (asserted before the save and re-proven after restore).
	// ⚠ Row 149, both faces, on contactName: the UI refuses blanking it
	// in-form, while the API happily persists the empty value (the validate()
	// publication-schema mixup) — restored immediately.
	test(
		'site information: about on the front page, privacy statement gates /about/privacy; row 149 API-vs-UI on contactName',
		{tag: ['@smoke', '@regression']},
		async ({page, browser, baseURL}) => {
			test.slow();
			const tag = uniqueTag();
			const aboutText = `About this site ${tag}`;
			const privacyText = `Site privacy statement ${tag}`;
			const contactName = `Site Contact ${tag}`;
			const contactEmail = `sitecontact.${tag}@example.test`;
			const snap = await getSite(page.request);
			// This suite restores the statement to its baseline (empty) — the
			// 404-while-empty rule is only provable from that baseline.
			expect(snap.privacyStatement?.en ?? null).toBeFalsy();
			const anon = await newAnonContext(browser, baseURL);
			let csrf;
			try {
				// While EMPTY: the site privacy page is not found (rule 4).
				const before = await anon.request.get(
					'/index.php/index/about/privacy',
				);
				expect(before.status(), 'empty statement → privacy page 404').toBe(
					404,
				);

				await page.goto(SITE_ADMIN_URL);
				csrf = await csrfToken(page);
				await page.locator('#info-button').click();
				const panel = page.locator('#info');
				await expect(
					panel.locator('#siteInfo-contactName-control-en'),
				).toBeVisible({timeout: 20_000});
				await setTinyMceContent(
					page,
					'siteInfo-about-control-en',
					`<p>${aboutText}</p>`,
				);
				await panel
					.locator('#siteInfo-contactName-control-en')
					.fill(contactName);
				await panel
					.locator('#siteInfo-contactEmail-control-en')
					.fill(contactEmail);
				await setTinyMceContent(
					page,
					'siteInfo-privacyStatement-control-en',
					`<p>${privacyText}</p>`,
				);
				const saveRes = await saveSiteForm(page, panel);
				const echoed = await saveRes.json();
				expect(echoed.about.en).toContain(aboutText);
				expect(echoed.contactName.en).toBe(contactName);
				expect(echoed.contactEmail.en).toBe(contactEmail);

				// Public surfacing, anonymously: the about text tops the
				// journal list on the site front page…
				const pub = await anon.newPage();
				await pub.goto('/index.php/index');
				await expect(pub.locator('.about_site')).toContainText(aboutText);
				// …and the site privacy page now serves the statement.
				await pub.goto('/index.php/index/about/privacy');
				await expect(pub.getByText(privacyText)).toBeVisible();

				// ⚠ Row 149 — UI face: blanking the required contact name is
				// refused by the client-side gate; nothing is stored.
				await page.locator('#info-button').click();
				await panel.locator('#siteInfo-contactName-control-en').fill('');
				await panel
					.locator('form')
					.first()
					.getByRole('button', {name: 'Save', exact: true})
					.click();
				await expect(
					panel.getByText('This field is required.').first(),
				).toBeVisible();
				expect((await getSite(page.request)).contactName.en).toBe(
					contactName,
				);

				// ⚠ Row 149 — API face: the endpoint validates required props
				// against SCHEMA_PUBLICATION, so the same blank goes through
				// and PERSISTS. Restored immediately.
				const blank = await putSite(
					page.request,
					{contactName: {en: ''}},
					csrf,
				);
				expect(
					blank.status(),
					'row 149: API accepts a blank site contact name',
				).toBe(200);
				expect((await getSite(page.request)).contactName.en).toBe('');
				const reset = await putSite(
					page.request,
					{contactName: {en: contactName}},
					csrf,
				);
				expect(reset.status()).toBe(200);
			} finally {
				if (csrf) {
					const res = await putSite(
						page.request,
						{
							about: localesOrNull(snap.about),
							privacyStatement: localesOrNull(snap.privacyStatement),
							contactName: localesOrNull(snap.contactName),
							contactEmail: localesOrNull(snap.contactEmail),
						},
						csrf,
					);
					expect(res.status(), 'information fields restored').toBe(200);
				}
				await anon.close();
			}

			// Restore proven: the statement is empty again → privacy page 404.
			const after = await page.request.get('/index.php/index/about/privacy');
			expect(after.status()).toBe(404);
		},
	);

	// ── Scenario 3 — Site appearance is independent of journal appearance ────
	// The admin uploads a site logo and style sheet, writes a footer and places
	// the Language Toggle block in the site sidebar (Appearance → Setup — the
	// duplicate-id twin of the Site Setup tab, row 151b). Site-level pages
	// restyle; the journal's pages keep their own header/footer. The site theme
	// is its own setting saved through /site/theme — this env ships a single
	// installed theme ("default"), so the round-trip re-saves it rather than
	// switching (getTheme's 500-on-missing-theme, row 151a, stays code-verified).
	// ⚠ SPEC CORRECTION asserted here: the site STYLE SHEET is linked on every
	// page, journal pages included (OJS TemplateManager adds it before the
	// context branch) — logo/footer/sidebar are site-level-only as specced.
	test(
		'site appearance: logo, footer, sidebar block + style sheet restyle site pages; journal keeps its own face; theme round-trips',
		{tag: '@regression'},
		async ({page, browser, baseURL}) => {
			test.slow();
			const tag = uniqueTag();
			const footerText = `Site footer ${tag}`;
			const snap = await getSite(page.request);
			// Baseline: no site logo/stylesheet — the finally clears back to that.
			expect(snap.pageHeaderTitleImage?.en ?? null).toBeFalsy();
			expect(snap.styleSheet ?? null).toBeFalsy();
			const anon = await newAnonContext(browser, baseURL);
			let csrf;
			try {
				await page.goto(SITE_ADMIN_URL);
				csrf = await csrfToken(page);

				// Row 151(b) as-built: TWO id="setup" tab panels (Site Setup +
				// Appearance → Setup) — invalid DOM; scope through #appearance.
				await expect(page.locator('#setup')).toHaveCount(2);
				await page.getByRole('tab', {name: 'Appearance', exact: true}).click();
				await page.locator('#appearance #setup-button').click();
				const panel = page.locator('#appearance').locator('#setup');
				await expect(panel.locator('form').first()).toBeVisible({
					timeout: 20_000,
				});

				// Logo (FieldUploadImage dropzone — drive the hidden input; the
				// visible button would open a real OS dialog).
				const logoInput = page.locator(
					'#siteAppearance-pageHeaderTitleImage-hiddenFileId-en',
				);
				await logoInput.waitFor({state: 'attached', timeout: 15_000});
				const logoUploaded = page.waitForResponse(
					(r) =>
						/\/api\/v1\/temporaryFiles/.test(r.url()) &&
						r.ok() &&
						r.request().method() === 'POST',
					{timeout: 20_000},
				);
				await logoInput.setInputFiles(PNG_FIXTURE);
				await logoUploaded;
				const altText = page.locator(
					'#siteAppearance-pageHeaderTitleImage-altText-en',
				);
				await expect(altText).toBeVisible({timeout: 15_000});
				await altText.fill(`Site logo ${tag}`);

				// Footer + sidebar (site-level block roster).
				await setTinyMceContent(
					page,
					'siteAppearance-pageFooter-control-en',
					`<p>${footerText}</p>`,
				);
				const sidebarBox = panel.locator(
					'input[name="sidebar"][value="languagetoggleblockplugin"]',
				);
				await expect(sidebarBox).toBeVisible();
				if (!(await sidebarBox.isChecked())) {
					await sidebarBox.check();
				}

				// Style sheet (.css FieldUpload, not localized).
				const cssInput = page.locator(
					'#siteAppearance-styleSheet-hiddenFileId',
				);
				await cssInput.waitFor({state: 'attached', timeout: 15_000});
				const cssUploaded = page.waitForResponse(
					(r) =>
						/\/api\/v1\/temporaryFiles/.test(r.url()) &&
						r.ok() &&
						r.request().method() === 'POST',
					{timeout: 20_000},
				);
				await cssInput.setInputFiles(CSS_FIXTURE);
				await cssUploaded;

				const saveRes = await saveSiteForm(page, panel);
				const echoed = await saveRes.json();
				expect(echoed.pageHeaderTitleImage.en.uploadName).toBe(
					'pageHeaderTitleImage_en.png',
				);
				expect(echoed.styleSheet.uploadName).toBe('styleSheet.css');
				expect(echoed.sidebar).toContain('languagetoggleblockplugin');

				// The SITE THEME is its own record, saved via /site/theme. One
				// installed theme in this env → round-trip 'default' (a switch
				// is not drivable; a bogus theme is refused by validate()).
				const themeGet = await page.request.get(`${SITE_API}/theme`);
				expect(themeGet.status()).toBe(200);
				expect((await themeGet.json()).themePluginPath).toBe('default');
				const themePut = await page.request.put(`${SITE_API}/theme`, {
					headers: {'X-Csrf-Token': csrf, 'Content-Type': 'application/json'},
					data: {themePluginPath: 'default'},
				});
				expect(themePut.status(), 'site theme re-save → 200').toBe(200);
				// The theme select offers exactly the installed theme(s): one.
				await page.locator('#appearance #theme-button').click();
				await expect(
					page.locator('#theme-themePluginPath-control option'),
				).toHaveCount(1);

				// Site-level pages restyle, read anonymously.
				const pub = await anon.newPage();
				await pub.goto('/index.php/index');
				const siteHtml = await pub.content();
				expect(siteHtml).toContain('pageHeaderTitleImage_en.png'); // logo
				expect(siteHtml).toContain('site/styleSheet.css'); // custom CSS
				await expect(pub.locator('.pkp_footer_content')).toContainText(
					footerText,
				);
				await expect(pub.locator('.block_language')).toBeVisible(); // sidebar
				// The linked file really serves our upload.
				const cssHref = await pub
					.locator('link[href*="styleSheet.css"]')
					.getAttribute('href');
				const cssBody = await (await anon.request.get(cssHref || '')).text();
				expect(cssBody).toContain('wat-custom-css-marker');

				// The JOURNAL keeps its own face: no site logo, no site footer…
				await pub.goto('/index.php/publicknowledge/en');
				const journalHtml = await pub.content();
				expect(journalHtml).not.toContain('pageHeaderTitleImage_en.png');
				expect(journalHtml).not.toContain(footerText);
				// …⚠ but the site style sheet IS linked on journal pages too —
				// as-built (spec corrected): TemplateManager adds it globally.
				expect(journalHtml).toContain('site/styleSheet.css');
			} finally {
				if (csrf) {
					const res = await putSite(
						page.request,
						{
							pageFooter: localesOrNull(snap.pageFooter),
							// null (not []) deletes the setting row entirely —
							// the baseline had no sidebar row.
							sidebar: snap.sidebar?.length ? snap.sidebar : null,
							pageHeaderTitleImage: {en: null, fr_CA: null},
							styleSheet: null,
						},
						csrf,
					);
					expect(res.status(), 'appearance fields restored').toBe(200);
				}
				await anon.close();
			}
		},
	);

	// ── Scenario 4 — Security and statistics policy ripple down ──────────────
	// The admin raises the minimum password length and enables rate limiting on
	// Site Setup → Security: journal registration now ENFORCES the new minimum
	// (the refusal message displays it; the standing hint lives on the change/
	// reset-password forms — spec corrected), and three failed logins lock the
	// window so hard that even the CORRECT password is refused (with the
	// deliberately generic error) until the limiter is turned back off. On
	// Statistics, the geo ceiling drops to "country" and the SUSHI API goes
	// private: the journal's statistics form now offers at most country-level
	// collection (and loses its SUSHI opt-out), and the journal's COUNTER
	// endpoints go dark (401) for the public. The lock probe uses a THROWAWAY
	// user on a scratch journal — the limiter keys IP + username, so no shared
	// account is ever locked.
	test(
		'security + statistics ripple: password minimum enforced at registration, rate limit locks correct password, geo ceiling + SUSHI gate reach the journal',
		{tag: ['@smoke', '@regression']},
		async ({page, pkpApi, browser, baseURL, asUser}) => {
			test.slow();
			const tag = uniqueTag();
			const throwaway = `au${tag}`;
			const snap = await getSite(page.request);
			// The ripple baselines below assume the shipped defaults.
			expect(snap.enableGeoUsageStats).toBe('disabled');
			expect(snap.isSushiApiPublic).toBe(true);
			expect(snap.rateLimitEnabled ?? false).toBe(false);
			const anon = await newAnonContext(browser, baseURL);
			let csrf;
			try {
				// Baseline 1: SUSHI public → the journal COUNTER endpoint is
				// anonymous-reachable.
				const sushiBefore = await anon.request.get(
					'/index.php/publicknowledge/api/v1/stats/sushi/status',
				);
				expect(sushiBefore.status()).toBe(200);

				// Baseline 2: the journal statistics form hides geo entirely
				// (site "don't collect") and offers the SUSHI opt-out (site
				// public) — dbarnes reads publicknowledge, never writes.
				const mgr = await asUser('dbarnes');
				const mgrPage = await mgr.newPage();
				let statsPanel = await openJournalStatsPanel(mgrPage);
				await expect(
					statsPanel.locator('input[name="enableGeoUsageStats"]'),
				).toHaveCount(0);
				await expect(
					statsPanel.locator('input[name="isSushiApiPublic"]'),
				).toHaveCount(1);

				// Scratch journal + throwaway user for the login-lock probe.
				const {context: scratch} = await pkpApi.createJournal({
					tag,
					path: tag,
					primaryLocale: 'en',
					supportedLocales: ['en'],
					users: [
						{
							username: throwaway,
							password: throwaway + throwaway,
							roles: ['author'],
						},
					],
				});

				// Security form: minimum 14 + rate limiting 3 attempts / 60s.
				await page.goto(SITE_ADMIN_URL);
				csrf = await csrfToken(page);
				await page.locator('#security-button').click();
				const sec = page.locator('#security');
				const minLength = sec.locator(
					'#siteSecurity-minPasswordLength-control',
				);
				await expect(minLength).toBeVisible({timeout: 20_000});
				await minLength.fill('14');
				await sec.locator('input[name="rateLimitEnabled"]').check();
				// The two dependent fields reveal via showWhen.
				const maxAttempts = sec.locator(
					'#siteSecurity-rateLimitMaxAttempts-control',
				);
				await expect(maxAttempts).toBeVisible();
				await maxAttempts.fill('3');
				await sec
					.locator('#siteSecurity-rateLimitDecaySeconds-control')
					.fill('60');
				const secRes = await saveSiteForm(page, sec);
				const secEcho = await secRes.json();
				expect(secEcho.minPasswordLength).toBe(14);
				expect(secEcho.rateLimitEnabled).toBe(true);
				expect(secEcho.rateLimitMaxAttempts).toBe(3);
				expect(secEcho.rateLimitDecaySeconds).toBe(60);

				// Registration on a journal ENFORCES the new minimum: a short
				// password is refused with the message showing "14".
				const regPage = await anon.newPage();
				await regPage.goto('/index.php/publicknowledge/user/register');
				await regPage.locator('#givenName').fill(`Reg${tag}`);
				await regPage.locator('#familyName').fill('Probe');
				await regPage.locator('#affiliation').fill('Policy University');
				await regPage.locator('#country').selectOption('IS');
				await regPage.locator('#email').fill(`reg.${tag}@example.test`);
				await regPage.locator('#username').fill(`reg${tag}`);
				await regPage.locator('#password').fill('short12');
				await regPage.locator('#password2').fill('short12');
				const consent = regPage.locator('input[name="privacyConsent"]');
				if (await consent.count()) {
					await consent.check();
				}
				await regPage.getByRole('button', {name: 'Register'}).click();
				await expect(
					regPage.getByText('The password must be at least 14 characters.'),
				).toBeVisible();

				// Rate limiting (keyed IP + username): 3 wrong passwords fill
				// the window, then even the CORRECT password is refused — the
				// blocked branch answers BEFORE credential validation, with the
				// deliberately generic login error (rule 6).
				const loginBase = `/index.php/${scratch.path}`;
				const loginHtml = await (
					await anon.request.get(`${loginBase}/login`)
				).text();
				const m = loginHtml.match(/name="csrfToken" value="([^"]+)"/);
				if (!m) throw new Error('login csrfToken not found');
				const attempt = (password) =>
					anon.request.post(`${loginBase}/login/signIn`, {
						form: {
							csrfToken: m[1],
							username: throwaway,
							password,
							source: '',
							remember: '',
						},
						maxRedirects: 0,
					});
				for (let i = 1; i <= 3; i++) {
					const res = await attempt('definitely-wrong');
					expect(res.status(), `failed attempt ${i} re-renders`).toBe(200);
				}
				const locked = await attempt(throwaway + throwaway);
				expect(
					locked.status(),
					'correct password refused while locked (no 302)',
				).toBe(200);

				// Statistics: ceiling → country, SUSHI → private. One Save.
				await page.locator('#statistics-button').click();
				const stats = page.locator('#statistics');
				await expect(
					stats.locator('input[name="enableGeoUsageStats"]'),
				).toHaveCount(4);
				await stats
					.locator('input[name="enableGeoUsageStats"][value="country"]')
					.check();
				await stats
					.locator('input[name="isSushiApiPublic"][value="false"]')
					.check();
				const statsRes = await saveSiteForm(page, stats);
				const statsEcho = await statsRes.json();
				expect(statsEcho.enableGeoUsageStats).toBe('country');
				expect(statsEcho.isSushiApiPublic).toBe(false);

				// The journal statistics form now offers at most COUNTRY (the
				// region/city options are gone) and loses the SUSHI opt-out.
				statsPanel = await openJournalStatsPanel(mgrPage);
				await expect(
					statsPanel.locator('input[name="enableGeoUsageStats"]'),
				).toHaveCount(2); // "do not collect" + country
				await expect(
					statsPanel.getByText("Collect the visitor's country and region"),
				).toHaveCount(0);
				await expect(
					statsPanel.locator('input[name="isSushiApiPublic"]'),
				).toHaveCount(0);

				// The COUNTER endpoint goes dark for the public (has.user gate).
				const sushiAfter = await anon.request.get(
					'/index.php/publicknowledge/api/v1/stats/sushi/status',
				);
				expect(sushiAfter.status(), 'private SUSHI → anonymous 401').toBe(
					401,
				);

				// Turn the limiter back off — the SAME correct password now
				// signs in (302), proving the earlier refusal was the limiter.
				const relax = await putSite(
					page.request,
					{rateLimitEnabled: false},
					csrf,
				);
				expect(relax.status()).toBe(200);
				const unlocked = await attempt(throwaway + throwaway);
				expect(
					unlocked.status(),
					'limiter off → same credentials sign in',
				).toBe(302);
			} finally {
				if (csrf) {
					const res = await putSite(
						page.request,
						{
							minPasswordLength: snap.minPasswordLength,
							rateLimitEnabled: snap.rateLimitEnabled ?? false,
							rateLimitMaxAttempts: snap.rateLimitMaxAttempts,
							rateLimitDecaySeconds: snap.rateLimitDecaySeconds,
							enableGeoUsageStats: snap.enableGeoUsageStats,
							isSushiApiPublic: snap.isSushiApiPublic,
						},
						csrf,
					);
					expect(res.status(), 'security + statistics restored').toBe(200);
				}
				await anon.close();
			}

			// Restore proven: public SUSHI is reachable again.
			const sushiRestored = await page.request.get(
				'/index.php/publicknowledge/api/v1/stats/sushi/status',
			);
			expect(sushiRestored.status()).toBe(200);
		},
	);
});
