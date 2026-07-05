// @ts-check
const {test, expect} = require('../support/fixtures.js');
const {RegistrationPage} = require('../../lib/pkp/playwright/pages/RegistrationPage.js');
const {LoginPage} = require('../../lib/pkp/playwright/pages/LoginPage.js');
const {getPassword} = require('../../lib/pkp/playwright/data/users.js');

/**
 * Registration & login — public self-registration + sign-in / sign-out.
 * One test per canonical scenario of docs/product/specs/registration-login.md
 * (10 named), landed at 8 here by merging login-redirect + logout (scenarios
 * 7 + 10) into one lifecycle test and folding the row-108 ⚠ affiliation
 * deviation into the register-a-reader test as a sub-assertion. The tenth
 * scenario — email validation + activation (scenario 6) — needs `require_
 * validation` flipped ON in config.test.inc.php (a GLOBAL config value, not a
 * per-context setting), so it lives in the SERIAL project
 * (playwright/tests/serial/registration-login-activation.spec.js) where it can
 * mutate + restore config with no parallel neighbours.
 *
 * WHAT IS DRIVEN LIVE (this is the front-door WRITE + auth flow — the point):
 *   - The REAL register form: fill identity + credentials + consent, submit,
 *     land on "Registration complete", auto-logged-in (require_validation off).
 *   - Reviewer opt-in via the real `reviewerGroup[16]` checkbox.
 *   - Server-side consent enforcement (submit without ticking → error).
 *   - Duplicate email / username rejection against a seeded user.
 *   - The row-108 ⚠ off-UI POST that omits affiliation (created anyway).
 *   - The REAL login form: reader → journal home, sign-out → /login,
 *     wrong password → error + no session, remember-me cookie.
 *   - Registration closed on a scratch journal (disableUserReg).
 * Created accounts are asserted through the users REST API (as admin) — the
 * same endpoint the Users grid uses — plus the browser-observable session
 * (profile reachable / login-gated), redirect, and error surfaces.
 *
 * AUTH: this file sets NO `test.use({user})`, so the default `page` is a fresh
 * ANONYMOUS context per test — correct for the register/login drives (a
 * registration auto-creates a session, so reusing a logged-in context would
 * short-circuit the form). Extra contexts (remember-me A/B) are explicit
 * empty-storageState. Role/existence checks open a throwaway admin context via
 * `asUser('admin')` (its `.request` shares the session cookie).
 *
 * PARALLEL: every test uses UNIQUE usernames/emails (accounts PERSIST on the
 * long-lived test DB — a per-run random suffix stops "username taken" on
 * re-runs). No test mutates publicknowledge (only fresh accounts added) or
 * clears Mailpit. require_validation stays OFF here, so no validate-email is
 * sent (spec rule 6 — live-verified) and there is no mail queue to drain →
 * this file is parallel-safe at the flat root. The scratch-journal
 * registration-closed test seeds its own per-test journal.
 */

const JOURNAL = 'publicknowledge';
const REVIEWER_GROUP_ID = 16; // publicknowledge External Reviewer (permitSelfRegistration)
const ROLE_ID_REVIEWER = 4096;
const ROLE_ID_READER = 1048576;
const PW = 'Register-Pass-123'; // > site minimum length; used for every new account

/** A unique, hyphenless, lowercased alphanumeric token (parallel + re-run isolation). */
function uniqueTag(prefix = 'rl') {
	const workerIndex = test.info().parallelIndex;
	const rand = Math.random().toString(36).slice(2, 8);
	return `${prefix}${workerIndex}x${rand}`;
}

/** Fresh unique credentials for a throwaway registrant. */
function newCreds(prefix = 'reader') {
	const tag = uniqueTag(prefix);
	return {username: tag, email: `${tag}@example.test`, password: PW, tag};
}

/** A fresh anonymous browser context (explicit empty storage state). */
async function newAnonContext(browser, baseURL) {
	return browser.newContext({baseURL, storageState: {cookies: [], origins: []}});
}

/**
 * Look up a user by exact username via the users REST API using an admin
 * context. Returns the user object (with `groups`, `disabled`, `affiliation`,
 * …) or null if no such account exists.
 */
async function findUser(adminRequest, username) {
	const res = await adminRequest.get(
		`/index.php/${JOURNAL}/api/v1/users?searchPhrase=${encodeURIComponent(username)}&count=10`,
	);
	if (!res.ok()) {
		throw new Error(`users API failed: ${res.status()} ${await res.text()}`);
	}
	const body = await res.json();
	return (
		(body.items || []).find(
			(u) => String(u.userName || '').toLowerCase() === username.toLowerCase(),
		) || null
	);
}

/** The role ids a user is enrolled in, from the users-API `groups` array. */
function roleIdsOf(user) {
	return (user?.groups || []).map((g) => g.roleId);
}

test.describe('Registration & login — the public front door', () => {
	// ── Scenario 1 + row-108 ⚠ ────────────────────────────────────────────
	// Register as a reader (default account). An anonymous visitor fills the
	// real register form on publicknowledge — name, affiliation, country,
	// email, username, password + the required privacy consent — and submits.
	// require_validation being off, they are logged straight in and shown
	// "Registration complete"; a READER account exists; the completion page
	// offers NO "View Submissions" (reader has no editorial role). Then the
	// row-108 deviation: an off-UI POST that OMITS affiliation still creates
	// the account, because RegistrationForm has no server-side affiliation
	// validator even though the template marks it required.
	test(
		'registers a reader (auto-login, Reader role) and accepts an off-UI POST with no affiliation (row 108)',
		{tag: '@smoke'},
		async ({page, asUser, browser, baseURL}) => {
			const reg = new RegistrationPage(page);
			const reader = newCreds('reader');

			await reg.goto(JOURNAL);
			await expect(reg.form).toBeVisible();
			await reg.fill({
				givenName: 'Rhoda',
				familyName: 'Reader',
				affiliation: 'Test University',
				country: 'US',
				email: reader.email,
				username: reader.username,
				password: reader.password,
			});
			await reg.acceptConsent();
			await reg.submitForm();

			// Auto-logged-in success page.
			await expect(
				page.getByRole('heading', {name: 'Registration complete'}),
			).toBeVisible();
			// Reader has no editorial role → no "manage submissions" affordance.
			await expect(page.locator('li.view_submissions')).toHaveCount(0);

			// Session is live: a login-gated page is reachable without a bounce.
			await page.goto(`/index.php/${JOURNAL}/user/profile`);
			await expect(page).not.toHaveURL(/\/login/);

			// The account exists with the READER role (and not Reviewer).
			const adminCtx = await asUser('admin');
			const created = await findUser(adminCtx.request, reader.username);
			expect(created, 'reader account should exist').not.toBeNull();
			expect(created.email).toBe(reader.email);
			expect(roleIdsOf(created)).toContain(ROLE_ID_READER);
			expect(roleIdsOf(created)).not.toContain(ROLE_ID_REVIEWER);

			// ── row 108 ⚠ — off-UI POST omitting affiliation is accepted ──
			// Drive a scripted POST (what a no-JS / API client would send):
			// every server-required field + consent, but NO affiliation. The
			// UI marks affiliation required; the backend does not validate it.
			const noAffil = newCreds('noaffil');
			// Load the form in a fresh anon context to mint a matching CSRF
			// token (the token is bound to that context's session cookie).
			const ctx = await newAnonContext(browser, baseURL);
			const p2 = await ctx.newPage();
			const reg2 = new RegistrationPage(p2);
			await reg2.goto(JOURNAL);
			const csrf = await reg2.csrfToken();
			// POST to the exact (locale-prefixed) form action — the bare
			// `/{journal}/user/register` path 302s to `/en/…` and drops the
			// POST body, so target the resolved URL the form renders.
			const postUrl = await reg2.form.getAttribute('action');
			const postRes = await ctx.request.post(
				postUrl ?? `/index.php/${JOURNAL}/en/user/register`,
				{
					form: {
						csrfToken: csrf,
						givenName: 'NoAffil',
						familyName: 'User',
						country: 'US',
						email: noAffil.email,
						username: noAffil.username,
						password: noAffil.password,
						password2: noAffil.password,
						privacyConsent: '1',
						// affiliation intentionally omitted
					},
					maxRedirects: 0,
				},
			);
			// A valid registration redirects (302) to the completion page.
			expect(postRes.status(), 'off-UI register should be accepted').toBe(302);
			const offUiUser = await findUser(adminCtx.request, noAffil.username);
			expect(
				offUiUser,
				'account created despite missing affiliation (row 108)',
			).not.toBeNull();
			await ctx.close();
		},
	);

	// ── Scenario 2 ────────────────────────────────────────────────────────
	// Register and opt into reviewing. The registrant additionally ticks the
	// reviewer sign-up box (reviewerGroup[16]) and types reviewing interests;
	// the new account is enrolled in the reviewer group and the completion
	// page now offers "View Submissions" (an editorial affordance). As-built:
	// ticking reviewer routes through UserFormHelper::saveRoleContent, which
	// assigns Reviewer but NOT the default Reader (execute()'s Reader branch
	// only runs when no reviewer box is ticked) — asserted below.
	test(
		'registers with the reviewer opt-in and gets the Reviewer role',
		{tag: '@regression'},
		async ({page, asUser}) => {
			const reg = new RegistrationPage(page);
			const rev = newCreds('rev');

			await reg.goto(JOURNAL);
			await reg.fill({
				givenName: 'Ravi',
				familyName: 'Reviewer',
				affiliation: 'Test Institute',
				country: 'CA',
				email: rev.email,
				username: rev.username,
				password: rev.password,
			});
			await reg.acceptConsent();
			await reg.reviewerOptin(REVIEWER_GROUP_ID).check();
			await reg.interests.fill('machine learning, ethics');
			await reg.submitForm();

			await expect(
				page.getByRole('heading', {name: 'Registration complete'}),
			).toBeVisible();
			// Reviewer holds an editorial-type role → the manage-submissions link.
			await expect(page.locator('li.view_submissions')).toBeVisible();

			const adminCtx = await asUser('admin');
			const created = await findUser(adminCtx.request, rev.username);
			expect(created, 'reviewer account should exist').not.toBeNull();
			expect(roleIdsOf(created)).toContain(ROLE_ID_REVIEWER);
		},
	);

	// ── Scenario 4 ────────────────────────────────────────────────────────
	// Privacy consent is enforced (server-side). publicknowledge has a privacy
	// statement, so the consent checkbox renders and binds. Submitting WITHOUT
	// ticking it fails with "You must agree to the terms of the privacy
	// statement." and creates no account; ticking it then lets the same
	// registration through.
	test(
		'enforces the privacy-consent checkbox server-side',
		{tag: '@regression'},
		async ({page, asUser}) => {
			const reg = new RegistrationPage(page);
			const cand = newCreds('consent');

			await reg.goto(JOURNAL);
			await reg.fill({
				givenName: 'Connie',
				familyName: 'Consent',
				affiliation: 'Test College',
				country: 'US',
				email: cand.email,
				username: cand.username,
				password: cand.password,
			});
			// Deliberately DO NOT tick privacy consent.
			await reg.submitForm();

			await expect(reg.errorSummary).toBeVisible();
			await expect(reg.errorSummary).toContainText(
				/agree to the terms of the privacy statement/i,
			);

			const adminCtx = await asUser('admin');
			expect(
				await findUser(adminCtx.request, cand.username),
				'no account created when consent is missing',
			).toBeNull();

			// Positive path: tick consent (form preserves the other fields) and
			// re-submit — passwords are not re-populated, so refill them.
			await reg.acceptConsent();
			await reg.password.fill(cand.password);
			await reg.password2.fill(cand.password);
			await reg.submitForm();
			await expect(
				page.getByRole('heading', {name: 'Registration complete'}),
			).toBeVisible();
			expect(
				await findUser(adminCtx.request, cand.username),
				'account created once consent is given',
			).not.toBeNull();
		},
	);

	// ── Scenario 5 ────────────────────────────────────────────────────────
	// Duplicate email or username is rejected. Registering with a seeded
	// user's email → "email already in use"; with a seeded username →
	// "username already in use". No account is created either way.
	test(
		'rejects a duplicate email and a duplicate username',
		{tag: '@regression'},
		async ({page, asUser}) => {
			const reg = new RegistrationPage(page);

			// (a) Duplicate EMAIL — reuse dbarnes's seeded address, fresh username.
			const dupEmailUser = uniqueTag('dupe');
			await reg.goto(JOURNAL);
			await reg.fill({
				givenName: 'Dupe',
				familyName: 'Email',
				affiliation: 'Test Org',
				country: 'US',
				email: 'dbarnes@mailinator.com',
				username: dupEmailUser,
				password: PW,
			});
			await reg.acceptConsent();
			await reg.submitForm();
			await expect(reg.errorSummary).toBeVisible();
			await expect(reg.errorSummary).toContainText(
				/email address is already in use/i,
			);

			// (b) Duplicate USERNAME — reuse 'dbarnes', fresh email.
			const freshEmail = `${uniqueTag('dupu')}@example.test`;
			await reg.goto(JOURNAL);
			await reg.fill({
				givenName: 'Dupe',
				familyName: 'Username',
				affiliation: 'Test Org',
				country: 'US',
				email: freshEmail,
				username: 'dbarnes',
				password: PW,
			});
			await reg.acceptConsent();
			await reg.submitForm();
			await expect(reg.errorSummary).toBeVisible();
			await expect(reg.errorSummary).toContainText(
				/username is already in use/i,
			);

			// Neither attempt created an account.
			const adminCtx = await asUser('admin');
			expect(await findUser(adminCtx.request, dupEmailUser)).toBeNull();
		},
	);

	// ── Scenarios 7 + 10 ──────────────────────────────────────────────────
	// Log in and land in the right place, then log out. A freshly-registered
	// reader signs out (→ /login, session gone), signs back in through the
	// real login form, and — holding no editorial role and giving no source —
	// is returned to the journal HOME (not the dashboard). Signing out again
	// destroys the session.
	test(
		'reader signs out, signs back in to the journal home, and signs out again',
		{tag: '@smoke'},
		async ({page}) => {
			const reg = new RegistrationPage(page);
			const reader = newCreds('login');

			// Create the account (auto-logged-in).
			await reg.goto(JOURNAL);
			await reg.fill({
				givenName: 'Lena',
				familyName: 'Login',
				affiliation: 'Test University',
				country: 'US',
				email: reader.email,
				username: reader.username,
				password: reader.password,
			});
			await reg.acceptConsent();
			await reg.submitForm();
			await expect(
				page.getByRole('heading', {name: 'Registration complete'}),
			).toBeVisible();

			// Sign out → back to /login.
			await page.goto(`/index.php/${JOURNAL}/login/signOut`);
			await expect(page).toHaveURL(/\/login/);
			// Session gone: a login-gated page bounces to /login.
			await page.goto(`/index.php/${JOURNAL}/user/profile`);
			await expect(page).toHaveURL(/\/login/);

			// Log in via the real form; a plain reader lands on the journal HOME.
			const login = new LoginPage(page);
			await login.login(reader.username, reader.password, JOURNAL);
			await page.waitForURL((u) => !u.pathname.includes('/login'), {
				waitUntil: 'commit',
			});
			await expect(page).not.toHaveURL(/\/login/);
			await expect(page).not.toHaveURL(/dashboard/);
			await expect(page).toHaveURL(new RegExp(`/${JOURNAL}(/|$|\\?)`));
			// Confirm the live session (profile reachable, no bounce).
			await page.goto(`/index.php/${JOURNAL}/user/profile`);
			await expect(page).not.toHaveURL(/\/login/);

			// Sign out again → /login, session destroyed.
			await page.goto(`/index.php/${JOURNAL}/login/signOut`);
			await expect(page).toHaveURL(/\/login/);
			await page.goto(`/index.php/${JOURNAL}/user/profile`);
			await expect(page).toHaveURL(/\/login/);
		},
	);

	// ── Scenario 9 ────────────────────────────────────────────────────────
	// Failed login. A wrong password for a real account shows the generic
	// "invalid username/email or password" error, grants no session, and
	// preserves the typed username in the form.
	test(
		'rejects a wrong password with a generic error and no session',
		{tag: '@regression'},
		async ({page}) => {
			const login = new LoginPage(page);
			await login.login('dbarnes', 'definitely-the-wrong-password', JOURNAL);

			await expect(login.error).toBeVisible();
			await expect(login.error).toContainText(
				/invalid username\/email or password/i,
			);
			// The username the user typed is preserved for a retry.
			await expect(login.username).toHaveValue('dbarnes');

			// No session was granted.
			await page.goto(`/index.php/${JOURNAL}/user/profile`);
			await expect(page).toHaveURL(/\/login/);
		},
	);

	// ── Scenario 8 ────────────────────────────────────────────────────────
	// Keep me logged in. Ticking "Keep me logged in" issues the persistent
	// Laravel `remember_web_*` cookie; leaving it unticked does not. NB the
	// login template renders the checkbox with a stray `checked="$remember"`
	// attribute that never interpolates, so the box is CHECKED BY DEFAULT in
	// the browser — asserted here as an as-built reality.
	test(
		'issues a remember_web cookie only when "Keep me logged in" is ticked',
		{tag: '@regression'},
		async ({browser, baseURL}) => {
			const hasRemember = (cookies) =>
				cookies.some((c) => c.name.startsWith('remember_web'));

			// A — default (checkbox checked) → remember cookie is set.
			const ctxA = await newAnonContext(browser, baseURL);
			const pageA = await ctxA.newPage();
			const loginA = new LoginPage(pageA);
			await loginA.goto(JOURNAL);
			// As-built quirk: the box arrives pre-checked.
			await expect(loginA.remember).toBeChecked();
			await loginA.submitCredentials('jjanssen', getPassword('jjanssen'));
			await pageA.waitForURL((u) => !u.pathname.includes('/login'), {
				waitUntil: 'commit',
			});
			expect(hasRemember(await ctxA.cookies())).toBe(true);
			await ctxA.close();

			// B — unticked → no remember cookie.
			const ctxB = await newAnonContext(browser, baseURL);
			const pageB = await ctxB.newPage();
			const loginB = new LoginPage(pageB);
			await loginB.goto(JOURNAL);
			await loginB.remember.uncheck();
			await loginB.submitCredentials('jjanssen', getPassword('jjanssen'));
			await pageB.waitForURL((u) => !u.pathname.includes('/login'), {
				waitUntil: 'commit',
			});
			expect(hasRemember(await ctxB.cookies())).toBe(false);
			await ctxB.close();
		},
	);

	// ── Scenario 3 ────────────────────────────────────────────────────────
	// Registration blocked when the journal is closed. On a scratch journal
	// with "Allow user registration" turned off (disableUserReg), opening
	// /user/register shows the "registration disabled" error and renders no
	// register form.
	test(
		'blocks registration on a journal with user registration disabled',
		{tag: '@regression'},
		async ({page, pkpApi}) => {
			const path = uniqueTag('closed');
			await pkpApi.createJournal({
				tag: path,
				path,
				name: {en: `Closed Journal ${path}`},
				primaryLocale: 'en',
				supportedLocales: ['en'],
				disableUserReg: true,
			});

			await page.goto(`/index.php/${path}/user/register`);

			await expect(
				page.getByText(/not accepting user registrations/i),
			).toBeVisible();
			// No register form is rendered.
			await expect(page.locator('form#register')).toHaveCount(0);
		},
	);
});
