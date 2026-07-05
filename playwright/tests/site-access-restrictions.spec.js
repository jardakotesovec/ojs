// @ts-check
const {test, expect} = require('../support/fixtures.js');
const {LoginPage} = require('../../lib/pkp/playwright/pages/LoginPage.js');
const {
	RegistrationPage,
} = require('../../lib/pkp/playwright/pages/RegistrationPage.js');
const {getPassword} = require('../../lib/pkp/playwright/data/users.js');

/**
 * Site access restrictions — the three Users & Roles → Site Access Options
 * toggles (login wall / gated full text / closed registration) + disabled-
 * journal visibility. One test per canonical scenario of
 * docs/product/specs/site-access-restrictions.md (6 named, 6 tests, 1:1).
 *
 * WHAT IS DRIVEN LIVE (this is an ANONYMOUS-GATING feature — the point is
 * what a visitor with no session can and cannot reach):
 *   - The REAL Site Access Options tab (Vue `userAccess` pkp-form on
 *     Settings → Users & Roles): the manager sees the three fields, flips
 *     all three and Saves (one PUT to the journal-settings API), the values
 *     read back; a reviewer is bounced off the page AND their direct PUT is
 *     refused 401 (HasRoles middleware) with the value unchanged.
 *   - The login wall (RestrictedSiteAccessPolicy): anonymous requests to
 *     home/about/search/issue-archive AND the machine endpoints (OAI,
 *     sitemap) all land on the journal login with a `source` return-to;
 *     login/lostPassword/register stay reachable; signing in through the
 *     redirect lands BACK on the requested page; a logged-in account with
 *     NO roles in the journal browses freely; publicknowledge is untouched
 *     (per-journal policy).
 *   - The register-pierces-the-wall interplay (rules 4+6): a stranger
 *     self-registers THROUGH the wall via the exempt register page and
 *     immediately reads the walled site; closing User Registration seals it.
 *   - Closed registration (disableUserReg): the "not accepting user
 *     registrations" page (no form), the navbar Register link hidden, the
 *     SITE-WIDE register page dropping the journal's role opt-ins (while
 *     still listing its name — the documented cosmetic deviation); then
 *     re-enabling restores all three surfaces.
 *   - The galley gate (ArticleHandler::userCanViewGalley +
 *     restrictArticleAccess) on an OPEN-ACCESS journal: abstract + issue
 *     TOC stay public, galley view/download bounce to login with return-to,
 *     any logged-in account (no roles there) reads the PDF.
 *   - Disabled-journal visibility (PKPPageRouter::route): every anonymous
 *     page — register INCLUDED, and with NO return-to — redirects to the
 *     journal login; the journal drops off the site index; a roleless
 *     logged-in account still browses fully; the admin keeps the backend;
 *     re-enabling restores public access.
 *
 * AUTH: no `test.use({user})` — the default `page` is a fresh ANONYMOUS
 * context per test, which is the actor most of this feature gates. Manager/
 * admin/roleless-account probes open contexts via `asUser`. Setting flips
 * outside test 1 (which drives the real form) go through the same
 * journal-settings API the form uses (PUT /api/v1/contexts/{id} with the
 * session CSRF scraped from the <meta name="csrf-token"> tag).
 *
 * PARALLEL + isolation: every test seeds its OWN scratch journal (unique
 * `sara…` tag) and flips toggles only there; all three toggles are
 * journal-level (no site-level equivalent — spec rule 1), and the disabled
 * flag is flipped on a scratch journal only, so nothing touches
 * publicknowledge (read-only wall-control probe) or site state. The
 * site-index assertion only checks OUR journal's absence (other workers'
 * scratch journals may appear — harmless). No Mailpit (changing the
 * toggles produces no mail — spec Side effects). Fully parallel at the
 * flat root.
 */

const MANAGER = 'dbarnes';
const ROLELESS = 'jjanssen'; // seeded user with NO roles in any scratch journal

/** A unique, hyphenless, lowercased alphanumeric token (parallel + re-run isolation). */
function uniqueTag(prefix = 'sara') {
	const workerIndex = test.info().parallelIndex;
	const rand = Math.random().toString(36).slice(2, 8);
	return `${prefix}${workerIndex}x${rand}`;
}

/** Seed a scratch journal; returns its context ({id, path, ...}). */
async function seedJournal(pkpApi, tag, users = [], extra = {}) {
	const {context} = await pkpApi.createJournal({tag, users, ...extra});
	return context;
}

/**
 * Read the session CSRF token of an authenticated BrowserContext by
 * scraping the <meta name="csrf-token"> tag (emitted on every installed
 * page — PKPTemplateManager). Uses the SITE-level profile page so it works
 * regardless of any journal's wall/disabled state. Cached per context.
 */
const csrfCache = new WeakMap();
async function csrfFor(ctx) {
	if (csrfCache.has(ctx)) return csrfCache.get(ctx);
	const res = await ctx.request.get('/index.php/index/user/profile');
	const html = await res.text();
	const m = html.match(/name="csrf-token" content="([^"]+)"/);
	if (!m) throw new Error(`csrf meta tag not found (${res.url()})`);
	csrfCache.set(ctx, m[1]);
	return m[1];
}

/**
 * PUT journal settings through the same journal-settings API the Site
 * Access Options form saves to. Returns the APIResponse (callers assert
 * the status — the reviewer probe EXPECTS a refusal).
 */
async function putContextSettings(ctx, path, contextId, data) {
	return ctx.request.put(`/index.php/${path}/api/v1/contexts/${contextId}`, {
		headers: {
			'X-Csrf-Token': await csrfFor(ctx),
			'Content-Type': 'application/json',
		},
		data,
	});
}

/** GET the journal's settings JSON (manager/admin context). */
async function getContextSettings(ctx, path, contextId) {
	const res = await ctx.request.get(
		`/index.php/${path}/api/v1/contexts/${contextId}`,
	);
	expect(res.ok(), `GET context ${res.status()}`).toBeTruthy();
	return res.json();
}

/** Flip settings and assert the API accepted them (seeding helper). */
async function flipSettings(ctx, path, contextId, data) {
	const res = await putContextSettings(ctx, path, contextId, data);
	expect(res.status(), `PUT ${JSON.stringify(data)}: ${await res.text()}`).toBe(200);
	return res.json();
}

/** A fresh anonymous browser context (explicit empty storage state). */
async function newAnonContext(browser, baseURL) {
	return browser.newContext({baseURL, storageState: {cookies: [], origins: []}});
}

/** Open Settings → Users & Roles and switch to the Site Access Options tab. */
async function openSiteAccessTab(page, path) {
	await page.goto(`/index.php/${path}/management/settings/access`);
	await page.getByRole('tab', {name: 'Site Access Options'}).click();
	const panel = page.locator('#access');
	await expect(panel).toBeVisible();
	return panel;
}

test.describe('Site access restrictions — wall, registration, full text, disabled', () => {
	// ── Scenario 1 — Configure Site Access Options + permission boundary ──────
	// A journal manager opens Settings → Users & Roles → Site Access Options,
	// sees the three fields (Site Access, View Article Content, User
	// Registration — OJS inserts the middle one), flips all three and Saves
	// (ONE PUT through the journal-settings API saves the whole form); the
	// values read back in the reopened form and the context API. A reviewer
	// can neither open the page (authorization denied) nor save through the
	// API (HasRoles 401, value unchanged).
	test(
		'manager saves the three toggles; reviewer is refused both ways',
		{tag: '@smoke'},
		async ({pkpApi, asUser}) => {
			const tag = uniqueTag();
			const ctx = await seedJournal(pkpApi, tag, [
				{username: MANAGER, roles: ['manager']},
				{username: ROLELESS, roles: ['reviewer']},
			]);

			const mgrCtx = await asUser(MANAGER);
			const page = await mgrCtx.newPage();
			const panel = await openSiteAccessTab(page, ctx.path);

			// The three fields, with their exact labels (Fields & validation).
			await expect(panel.getByText('Site Access', {exact: true})).toBeVisible();
			await expect(panel.getByText('View Article Content')).toBeVisible();
			await expect(panel.getByText('User Registration')).toBeVisible();
			const wallBox = panel.getByRole('checkbox', {
				name: 'Users must be registered and log in to view the journal site.',
			});
			const galleyBox = panel.getByRole('checkbox', {
				name: 'Users must be registered and log in to view open access content.',
			});
			const closedRadio = panel.getByRole('radio', {
				name: /The Journal Manager will register all user accounts/,
			});
			// A fresh journal: fully public, open registration (all off).
			await expect(wallBox).not.toBeChecked();
			await expect(galleyBox).not.toBeChecked();
			await expect(closedRadio).not.toBeChecked();

			// Flip each toggle and Save — the form saves through the journal-
			// settings API (the Vue pkp-form tunnels the PUT as a POST with
			// X-Http-Method-Override: PUT, so match on the URL, not the verb).
			await wallBox.check();
			await galleyBox.check();
			await closedRadio.check();
			const putPromise = page.waitForResponse(
				(r) =>
					r.url().includes(`/api/v1/contexts/${ctx.id}`) &&
					['PUT', 'POST'].includes(r.request().method()),
			);
			await panel.getByRole('button', {name: 'Save'}).click();
			const putRes = await putPromise;
			expect(putRes.status()).toBe(200);
			// The response echoes the new values (rule 2, live-verified claim).
			const echoed = await putRes.json();
			expect(echoed.restrictSiteAccess).toBe(true);
			expect(echoed.restrictArticleAccess).toBe(true);
			expect(echoed.disableUserReg).toBe(true);

			// The saved values read back: reopened form + context API.
			const panel2 = await openSiteAccessTab(page, ctx.path);
			await expect(
				panel2.getByRole('checkbox', {
					name: 'Users must be registered and log in to view the journal site.',
				}),
			).toBeChecked();
			await expect(
				panel2.getByRole('checkbox', {
					name: 'Users must be registered and log in to view open access content.',
				}),
			).toBeChecked();
			await expect(
				panel2.getByRole('radio', {
					name: /The Journal Manager will register all user accounts/,
				}),
			).toBeChecked();
			const saved = await getContextSettings(mgrCtx, ctx.path, ctx.id);
			expect(saved.restrictSiteAccess).toBe(true);
			expect(saved.restrictArticleAccess).toBe(true);
			expect(saved.disableUserReg).toBe(true);

			// Boundary: the reviewer is bounced off the page…
			const revCtx = await asUser(ROLELESS);
			const revPage = await revCtx.newPage();
			await revPage.goto(`/index.php/${ctx.path}/management/settings/access`);
			await expect(revPage).toHaveURL(/authorizationDenied|AccessDenied/i);

			// …and their save attempt is refused (HasRoles → 401), unchanged.
			const revPut = await putContextSettings(revCtx, ctx.path, ctx.id, {
				restrictSiteAccess: false,
			});
			expect(revPut.status(), 'reviewer PUT refused').toBe(401);
			const after = await getContextSettings(mgrCtx, ctx.path, ctx.id);
			expect(after.restrictSiteAccess, 'setting unchanged by refusal').toBe(true);
		},
	);

	// ── Scenario 2 — The login wall ────────────────────────────────────────────
	// With Site Access on, an anonymous visitor is redirected from every
	// reader page — home, about, search, issue archive — AND the machine
	// endpoints (OAI, sitemap) to the journal's login with a `source`
	// return-to; login and lost-password stay reachable. Signing in through
	// the redirect lands back on the requested page, and the signed-in
	// account (NO roles in this journal) browses freely. publicknowledge is
	// untouched throughout (the policy is per-journal — rule 5).
	test(
		'login wall bounces anonymous visitors to login and back after sign-in',
		{tag: '@smoke'},
		async ({page, pkpApi, asUser}) => {
			const tag = uniqueTag();
			const ctx = await seedJournal(pkpApi, tag);
			const adminCtx = await asUser('admin');
			await flipSettings(adminCtx, ctx.path, ctx.id, {restrictSiteAccess: true});

			// Anonymous: every reader page + OAI + sitemap ends on login?source=…
			for (const p of ['', '/about', '/search', '/issue/archive', '/oai?verb=Identify', '/sitemap']) {
				const res = await page.request.get(`/index.php/${ctx.path}${p}`);
				expect(res.url(), `${p || '/'} should bounce to login`).toMatch(/\/login/);
				expect(res.url(), `${p || '/'} carries a return-to`).toContain('source=');
			}

			// The exempt pages stay reachable (login, lost password, register).
			for (const p of ['/login', '/login/lostPassword', '/user/register']) {
				const res = await page.request.get(`/index.php/${ctx.path}${p}`);
				expect(res.status(), `${p} reachable through the wall`).toBe(200);
				expect(res.url()).toContain(p.split('/').pop());
				expect(res.url(), `${p} not bounced`).not.toContain('source=');
			}

			// Per-journal, not site-wide: publicknowledge stays public.
			const pkn = await page.request.get('/index.php/publicknowledge');
			expect(pkn.status()).toBe(200);
			expect(pkn.url()).not.toMatch(/\/login/);

			// The round-trip: request /about anonymously, sign in on the login
			// page the wall served (its hidden `source` field carries the
			// return-to), land back on /about — as a user with NO roles here.
			await page.goto(`/index.php/${ctx.path}/about`);
			await expect(page).toHaveURL(/\/login/);
			await expect(page).toHaveURL(/source=/);
			const login = new LoginPage(page);
			await login.submitCredentials(ROLELESS, getPassword(ROLELESS));
			await page.waitForURL((u) => u.pathname.includes('/about'), {
				waitUntil: 'commit',
			});
			await expect(page).not.toHaveURL(/\/login/);

			// Any logged-in account — no roles in the journal — browses freely.
			for (const p of ['', '/search', '/issue/archive']) {
				await page.goto(`/index.php/${ctx.path}${p}`);
				await expect(page, `${p || '/'} open when logged in`).not.toHaveURL(
					/\/login/,
				);
			}
		},
	);

	// ── Scenario 3 — Self-registration pierces the wall ───────────────────────
	// On a login-walled journal with registration open, an anonymous visitor
	// still reaches the (exempt) register page, creates an account and —
	// auto-logged-in — immediately reads the walled site: the wall tests
	// login, never membership (rules 4+6). Closing User Registration seals
	// the path: the register page then refuses (while staying reachable).
	test(
		'stranger registers through the wall and reads the site; closing registration seals it',
		{tag: '@regression'},
		async ({page, pkpApi, asUser, browser, baseURL}) => {
			const tag = uniqueTag();
			const name = `Walled Journal ${tag}`;
			const ctx = await seedJournal(pkpApi, tag, [], {name: {en: name}});
			const adminCtx = await asUser('admin');
			await flipSettings(adminCtx, ctx.path, ctx.id, {restrictSiteAccess: true});

			// The wall is up: home bounces the anonymous visitor…
			await page.goto(`/index.php/${ctx.path}`);
			await expect(page).toHaveURL(/\/login/);

			// …but the register page is exempt and serves the FULL form.
			const reg = new RegistrationPage(page);
			await reg.goto(ctx.path);
			await expect(page).not.toHaveURL(/\/login/);
			await expect(reg.form).toBeVisible();

			// Register a throwaway account (scratch journals carry the default
			// privacy statement, so the consent checkbox renders and binds).
			const username = uniqueTag('sarreg');
			await reg.fill({
				givenName: 'Wanda',
				familyName: 'Wallpiercer',
				affiliation: 'Test University',
				country: 'US',
				email: `${username}@example.test`,
				username,
				password: 'Wall-Pierce-Pass-123',
			});
			await reg.acceptConsent();
			await reg.submitForm();
			await expect(
				page.getByRole('heading', {name: 'Registration complete'}),
			).toBeVisible();

			// Auto-logged-in, the fresh account reads the walled site at once.
			await page.goto(`/index.php/${ctx.path}`);
			await expect(page).not.toHaveURL(/\/login/);
			await expect(page.getByText(name).first()).toBeVisible();

			// Sealing the path: close User Registration — the (still exempt)
			// register page now refuses with the closed message and no form.
			await flipSettings(adminCtx, ctx.path, ctx.id, {disableUserReg: true});
			const anon = await newAnonContext(browser, baseURL);
			try {
				const anonPage = await anon.newPage();
				await anonPage.goto(`/index.php/${ctx.path}/user/register`);
				await expect(anonPage).not.toHaveURL(/\/login/);
				await expect(
					anonPage.getByText(/not accepting user registrations/i),
				).toBeVisible();
				await expect(anonPage.locator('form#register')).toHaveCount(0);
			} finally {
				await anon.close();
			}
		},
	);

	// ── Scenario 4 — Registration closed ───────────────────────────────────────
	// With User Registration set to "the Journal Manager will register all
	// user accounts": the register page shows the closed message with a
	// Login link and NO form; the navbar Register link disappears (Login
	// stays); and the SITE-WIDE register page stops offering the journal's
	// reader/reviewer opt-ins — while still listing its name with nothing
	// under it (the documented cosmetic deviation). Re-enabling restores
	// all three. publicknowledge's opt-ins remain throughout (read-only).
	test(
		'closed registration: message page, hidden navbar link, dropped site-wide opt-ins — all restored on re-enable',
		{tag: '@regression'},
		async ({page, pkpApi, asUser}) => {
			const tag = uniqueTag();
			const name = `Closed Reg Journal ${tag}`;
			const ctx = await seedJournal(pkpApi, tag, [], {
				name: {en: name},
				disableUserReg: true,
			});

			// The register page refuses: message + Login link, no form.
			await page.goto(`/index.php/${ctx.path}/user/register`);
			await expect(
				page.getByText('This journal is currently not accepting user registrations.'),
			).toBeVisible();
			await expect(page.locator('form#register')).toHaveCount(0);
			await expect(
				page.getByRole('link', {name: 'Login', exact: true}).first(),
			).toBeVisible();

			// The navbar Register item is hidden (Login proves the nav rendered).
			await page.goto(`/index.php/${ctx.path}`);
			await expect(
				page.getByRole('link', {name: 'Login', exact: true}).first(),
			).toBeVisible();
			await expect(
				page.getByRole('link', {name: 'Register', exact: true}),
			).toHaveCount(0);

			// Site-wide register page: the closed journal's name still renders
			// (cosmetic deviation) but its reader/reviewer opt-ins are dropped;
			// publicknowledge keeps its own.
			const roleOptins = (li) =>
				li.locator(
					'input[name^="readerGroup"], input[name^="reviewerGroup"], input[name^="authorGroup"]',
				);
			await page.goto('/index.php/index/user/register');
			const closedLi = page.locator('li.context').filter({hasText: name});
			await expect(closedLi).toHaveCount(1);
			await expect(roleOptins(closedLi)).toHaveCount(0);
			const pknLi = page
				.locator('li.context')
				.filter({hasText: 'Journal of Public Knowledge'});
			expect(await roleOptins(pknLi).count()).toBeGreaterThan(0);

			// Re-enable registration (the same journal-settings API the form
			// uses) — form, navbar link and site-wide opt-ins all come back.
			const adminCtx = await asUser('admin');
			await flipSettings(adminCtx, ctx.path, ctx.id, {disableUserReg: false});

			await page.goto(`/index.php/${ctx.path}/user/register`);
			await expect(page.locator('form#register')).toBeVisible();
			await page.goto(`/index.php/${ctx.path}`);
			await expect(
				page.getByRole('link', {name: 'Register', exact: true}).first(),
			).toBeVisible();
			await page.goto('/index.php/index/user/register');
			const reopenedLi = page.locator('li.context').filter({hasText: name});
			expect(await roleOptins(reopenedLi).count()).toBeGreaterThan(0);
		},
	);

	// ── Scenario 5 — Login-only full text on an open-access journal ───────────
	// With View Article Content on, the gate fires only when a GALLEY is
	// addressed: the article landing (abstract) and issue TOC stay public,
	// while a galley view or download bounces an anonymous visitor to login
	// with a return-to; any logged-in account — no roles in the journal —
	// then reads the PDF. On this open-access journal the toggle is the
	// ONLY thing between an anonymous reader and the PDF (rule 9).
	test(
		'restrictArticleAccess gates galleys but not abstract/TOC; any account reads',
		{tag: '@smoke'},
		async ({page, pkpApi, asUser}) => {
			const tag = uniqueTag();
			const title = `Gated fulltext ${tag}`;
			const ctx = await seedJournal(
				pkpApi,
				tag,
				[
					{username: MANAGER, roles: ['manager']},
					{username: 'atester', roles: ['author']},
				],
				{issues: [{volume: 1, number: 1, year: 2025, published: true}]},
			);
			const {submission, publications} = await pkpApi.createSubmission({
				tag,
				journal: ctx.path,
				submitter: 'atester',
				section: 'ART',
				locale: 'en',
				submitted: true,
				participants: [{user: MANAGER, role: 'manager', canChangeMetadata: true}],
				decisions: [
					{type: 'skipExternalReview', by: MANAGER},
					{type: 'sendToProduction', by: MANAGER},
				],
				publications: [
					{
						versionStage: 'VoR',
						metadata: {title: {en: title}},
						issue: {volume: 1, number: 1, year: 2025},
						published: true,
						galleys: [{label: 'PDF', file: 'default-article.pdf'}],
					},
				],
			});
			const galleyId = publications[0].galleys[0].id;
			const adminCtx = await asUser('admin');
			await flipSettings(adminCtx, ctx.path, ctx.id, {
				restrictArticleAccess: true,
			});

			// Anonymous: abstract and issue TOC stay public.
			await page.goto(`/index.php/${ctx.path}/article/view/${submission.id}`);
			await expect(page).not.toHaveURL(/\/login/);
			await expect(page.getByText(title).first()).toBeVisible();
			await page.goto(`/index.php/${ctx.path}/issue/current`);
			await expect(page).not.toHaveURL(/\/login/);
			await expect(page.getByText(title).first()).toBeVisible();

			// Anonymous: the galley view bounces to login with a return-to…
			await page.goto(
				`/index.php/${ctx.path}/article/view/${submission.id}/${galleyId}`,
			);
			await expect(page).toHaveURL(/\/login/);
			await expect(page).toHaveURL(/source=/);
			// …and so does the raw download.
			const anonDl = await page.request.get(
				`/index.php/${ctx.path}/article/download/${submission.id}/${galleyId}`,
			);
			expect(anonDl.url()).toMatch(/\/login/);
			expect(anonDl.url()).toContain('source=');

			// Any logged-in account (no roles in this journal) reads the PDF.
			const readerCtx = await asUser(ROLELESS);
			const readerPage = await readerCtx.newPage();
			await readerPage.goto(
				`/index.php/${ctx.path}/article/view/${submission.id}/${galleyId}`,
			);
			await expect(readerPage).not.toHaveURL(/\/login/);
			await expect(readerPage.locator('#pdfCanvasContainer')).toBeVisible({
				timeout: 20_000,
			});
			const dl = await readerCtx.request.get(
				`/index.php/${ctx.path}/article/download/${submission.id}/${galleyId}`,
			);
			expect(dl.ok(), `logged-in download ${dl.status()}`).toBeTruthy();
			expect(dl.headers()['content-type']).toContain('application/pdf');
			expect((await dl.body()).subarray(0, 5).toString()).toBe('%PDF-');
		},
	);

	// ── Scenario 6 — Disabled-journal visibility ───────────────────────────────
	// Admin disables a journal (the site-administration control, driven here
	// through the same context API): every anonymous page — register
	// INCLUDED, no exemptions, and with NO return-to — redirects to the
	// journal's login (which itself stays reachable); the journal drops off
	// the site's journal index; any logged-in account (zero roles there)
	// still browses the full reader site; the admin keeps the backend.
	// Re-enabling restores public access.
	test(
		'disabled journal turns anonymous visitors away but stays open to any account',
		{tag: '@regression'},
		async ({page, pkpApi, asUser}) => {
			const tag = uniqueTag();
			const name = `Disabled Journal ${tag}`;
			const ctx = await seedJournal(pkpApi, tag, [], {name: {en: name}});
			const adminCtx = await asUser('admin');
			await flipSettings(adminCtx, ctx.path, ctx.id, {enabled: false});

			// Anonymous: home, about AND register all redirect to the journal
			// login — no exemptions and no `source` return-to (router-level).
			for (const p of ['', '/about', '/user/register']) {
				const res = await page.request.get(`/index.php/${ctx.path}${p}`);
				expect(res.url(), `${p || '/'} redirects to login`).toMatch(/\/login/);
				expect(res.url(), `${p || '/'} has no return-to`).not.toContain(
					'source=',
				);
			}
			// The login page itself renders (the only page that doesn't bounce).
			const loginRes = await page.request.get(
				`/index.php/${ctx.path}/login`,
			);
			expect(loginRes.status()).toBe(200);

			// The site index omits the disabled journal (publicknowledge shows).
			await page.goto('/index.php/index');
			await expect(
				page.getByText('Journal of Public Knowledge').first(),
			).toBeVisible();
			await expect(page.getByText(name)).toHaveCount(0);

			// Any logged-in account — no roles in this journal — browses fully.
			const readerCtx = await asUser(ROLELESS);
			const readerPage = await readerCtx.newPage();
			await readerPage.goto(`/index.php/${ctx.path}`);
			await expect(readerPage).not.toHaveURL(/\/login/);
			await expect(readerPage.getByText(name).first()).toBeVisible();

			// The admin retains the backend.
			const adminPage = await adminCtx.newPage();
			await adminPage.goto(`/index.php/${ctx.path}/management/settings/access`);
			await expect(
				adminPage.getByRole('heading', {name: 'Users & Roles'}),
			).toBeVisible();

			// Re-enabling restores public access.
			await flipSettings(adminCtx, ctx.path, ctx.id, {enabled: true});
			await page.goto(`/index.php/${ctx.path}`);
			await expect(page).not.toHaveURL(/\/login/);
			await expect(page.getByText(name).first()).toBeVisible();
		},
	);
});
