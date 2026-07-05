// @ts-check
const {test, expect} = require('../support/fixtures.js');
const {LoginPage} = require('../../lib/pkp/playwright/pages/LoginPage.js');
const {getPassword} = require('../../lib/pkp/playwright/data/users.js');
const {
	UserManagementPage,
} = require('../../lib/pkp/playwright/pages/UserManagementPage.js');

/**
 * Log in as — admin/manager IMPERSONATION (docs/product/specs/login-as.md).
 * One test per canonical scenario (6 named), landed at 5 here by folding the
 * affordance + return-control scenario (5) into the manager-in-scope grid drive
 * (2) and the header assertion, and folding the no-reauth ⚠ (6) into BOTH the
 * admin round-trip (no confirm-password on signInAsUser) and a dedicated
 * reauth-gate test (the Administration area opens with no prompt on the default
 * config — the gate is a SEPARATE control, not an impersonation gate).
 *
 * WHAT IS DRIVEN LIVE (this is the session-switching auth core):
 *   - The REAL signInAsUser flow: the session stashes the ORIGINAL user
 *     (`signedInAs`) + swaps identity to the target — you are now acting AS the
 *     target; signOutAsUser pops the stash and returns you.
 *   - The REAL Users-grid "Login As" row action (canLoginAs affordance) for a
 *     manager over an in-scope user, plus the header "return to your account"
 *     control (`signOutAsUser`) rendered while impersonating.
 *   - The WHO-CAN-WHOM security guard (getAdministrationLevel == FULL, run with
 *     NO context): admin → anyone but a site admin; manager → FULL only when
 *     EVERY journal the target has a role in is one the manager manages. A
 *     site-admin target and an out-of-scope cross-journal target are both
 *     REFUSED (error page, no session switch), and their grid affordance is
 *     absent (canLoginAs=false).
 *   - The no-reauth ⚠: signInAsUser asks for NO password (one-click); the
 *     reauth gate (config-gated, default OFF) guards the Administration area,
 *     not impersonation.
 * Identity is asserted on the ACTING session via `window.pkp.currentUser`
 * ({id, username, isUserLoggedInAs, loggedInAsUser}) which every backend page
 * emits (PKPTemplateManager), plus the users REST feed's canLoginAs flag and
 * the grid DOM.
 *
 * AUTH — CAREFUL: impersonation MIGRATES + destroys the session (signInAs /
 * signOutAs), which invalidates any cached storage-state. So this file sets NO
 * `test.use({user})` and NEVER reuses the shared asUser cache for an
 * impersonating session: every impersonator (admin, dbarnes) LOGS IN FRESH into
 * a dedicated empty-storage context (`freshLogin`). asUser('admin') is used
 * ONLY for read-only user-id lookups in a journal the impersonator cannot see
 * (never impersonated in that context, so the cache stays valid).
 *
 * PARALLEL + isolation: every test seeds its OWN scratch journal(s) (unique
 * tag) with dbarnes-as-manager + UNIQUE throwaway impersonation targets, so the
 * impersonation only ever acts AS a throwaway account and never mutates a
 * seeded user (impersonation is session-only anyway — it mutates nothing on the
 * target). The only shared user touched is `admin`, and only as a PROHIBITED
 * target of a BLOCKED attempt (no switch happens) → read-only. Fresh contexts
 * per test → parallel-safe at the flat root.
 */

const MANAGER = 'dbarnes';
const ROLE_ID_SITE_ADMIN = 1;

/** A unique, hyphenless, lowercased alphanumeric token (parallel + re-run isolation). */
function uniqueTag(prefix = 'la') {
	const workerIndex = test.info().parallelIndex;
	const rand = Math.random().toString(36).slice(2, 8);
	return `${prefix}${workerIndex}x${rand}`;
}

/**
 * A throwaway user spec for the context scenario (a NEW account, created
 * because it carries a `password`). Username/email are tag-unique.
 */
function throwaway(tag, name, roles) {
	const username = `${tag}${name}`;
	return {
		username,
		password: username + username,
		email: `${username}@mailinator.com`,
		givenName: name.charAt(0).toUpperCase() + name.slice(1),
		familyName: `T${tag}`,
		roles,
	};
}

/**
 * Seed a scratch journal and return its context ({id, path, ...}). Pass extra
 * seeded users (throwaways, or dbarnes-as-manager) via `users`.
 */
async function seedJournal(pkpApi, tag, users) {
	const {context} = await pkpApi.createJournal({tag, users});
	return context;
}

/**
 * Log in FRESH into a dedicated empty-storage context (never touches the shared
 * asUser cache — critical because impersonation migrates/destroys the session).
 *
 * @returns {Promise<{ctx: import('@playwright/test').BrowserContext, page: import('@playwright/test').Page}>}
 */
async function freshLogin(browser, baseURL, username, password, contextPath = 'index') {
	const ctx = await browser.newContext({
		baseURL,
		storageState: {cookies: [], origins: []},
	});
	const page = await ctx.newPage();
	await new LoginPage(page).login(username, password, contextPath);
	await page.waitForURL((u) => !u.pathname.includes('/login'), {
		timeout: 15_000,
		waitUntil: 'commit',
	});
	return {ctx, page};
}

/** The direct impersonation entry point (Users-grid "Login As" issues the same URL). */
function signInAsUrl(journalPath, userId) {
	return `/index.php/${journalPath}/login/signInAsUser/${userId}`;
}

function signOutAsUrl(journalPath) {
	return `/index.php/${journalPath}/login/signOutAsUser`;
}

/**
 * Read the ACTING identity from a rendered backend page's `window.pkp.currentUser`
 * (emitted by PKPTemplateManager on every backend display). Navigates to the
 * journal profile page first (reachable by any logged-in user, incl. an
 * impersonated one).
 *
 * @returns {Promise<{id:number, username:string, isUserLoggedInAs:boolean, loggedInAsUser:{username:string,initials:string}|null}>}
 */
async function whoami(page, journalPath) {
	await page.goto(`/index.php/${journalPath}/user/profile`);
	await page.waitForFunction(() => !!window.pkp?.currentUser, null, {
		timeout: 15_000,
	});
	return page.evaluate(() => ({
		id: window.pkp.currentUser.id,
		username: window.pkp.currentUser.username,
		isUserLoggedInAs: window.pkp.currentUser.isUserLoggedInAs,
		loggedInAsUser: window.pkp.currentUser.loggedInAsUser,
	}));
}

/** Fetch the users feed WITH permissions (populates canLoginAs), scoped by phrase. */
async function usersWithPermissions(request, journalPath, searchPhrase) {
	const res = await request.get(
		`/index.php/${journalPath}/api/v1/users?includePermissions=true&status=all&count=50` +
			`&searchPhrase=${encodeURIComponent(searchPhrase)}`,
	);
	expect(res.ok(), `users feed ${res.status()}`).toBeTruthy();
	return ((await res.json()).items || []);
}

/** Look a user up by exact username; returns the feed row (with id, canLoginAs). */
async function userByName(request, journalPath, username) {
	const items = await usersWithPermissions(request, journalPath, username);
	return (
		items.find(
			(u) => String(u.userName).toLowerCase() === username.toLowerCase(),
		) || null
	);
}

test.describe('Log in as — admin/manager impersonation', () => {
	// ── Scenario 1 (+ 6 no-reauth, + 2 session stash) ─────────────────────────
	// A SITE ADMIN impersonates a user and returns. Fresh admin login (not the
	// cached session), whoami = admin; hit signInAsUser on a throwaway reviewer
	// → the session stashes admin + switches to the target (whoami = target,
	// isUserLoggedInAs, loggedInAsUser = admin) with NO confirm-password page on
	// the way (one-click, no reauth); signOutAsUser pops the stash → whoami =
	// admin again (isUserLoggedInAs false, loggedInAsUser null).
	test(
		'admin impersonates a user and returns (round-trip + session stash + no reauth)',
		{tag: '@smoke'},
		async ({browser, baseURL, pkpApi}) => {
			const tag = uniqueTag();
			const target = throwaway(tag, 'rev', ['reviewer']);
			const ctx = await seedJournal(pkpApi, tag, [target]);

			const {ctx: adminCtx, page} = await freshLogin(
				browser,
				baseURL,
				'admin',
				getPassword('admin'),
			);
			try {
				const targetRow = await userByName(adminCtx.request, ctx.path, target.username);
				expect(targetRow, 'target seeded').not.toBeNull();

				// Before: the acting identity is the admin.
				const before = await whoami(page, ctx.path);
				expect(before.isUserLoggedInAs).toBe(false);
				const adminId = before.id;
				expect(before.username).toBe('admin');

				// Impersonate — a single GET, no form/password in between.
				await page.goto(signInAsUrl(ctx.path, targetRow.id));
				// No re-authentication gate fired (⚠): we never hit confirmAccess,
				// and no password field was interposed.
				await expect(page).not.toHaveURL(/confirmAccess/i);

				// After: the session is acting AS the target, with admin stashed.
				const acting = await whoami(page, ctx.path);
				expect(acting.id).toBe(targetRow.id);
				expect(acting.username).toBe(target.username);
				expect(acting.isUserLoggedInAs).toBe(true);
				expect(acting.loggedInAsUser?.username).toBe('admin');

				// Return — pop the stash, restore the admin.
				await page.goto(signOutAsUrl(ctx.path));
				const restored = await whoami(page, ctx.path);
				expect(restored.id).toBe(adminId);
				expect(restored.username).toBe('admin');
				expect(restored.isUserLoggedInAs).toBe(false);
				expect(restored.loggedInAsUser).toBeNull();
			} finally {
				await adminCtx.close();
			}
		},
	);

	// ── Scenario 2 (+ 5 affordance + return control) ──────────────────────────
	// A journal MANAGER impersonates an IN-SCOPE user via the real Users-grid
	// "Login As" row action, is dropped into the target's session, sees the
	// header "return to your account" control (routing to signOutAsUser) while
	// impersonating, and returns. dbarnes managing the scratch journal is what
	// grants him FULL scope over its throwaway users.
	test(
		'manager impersonates an in-scope user via the grid affordance and returns',
		{tag: '@smoke'},
		async ({browser, baseURL, pkpApi}) => {
			const tag = uniqueTag();
			const target = throwaway(tag, 'rev', ['reviewer']);
			const ctx = await seedJournal(pkpApi, tag, [
				{username: MANAGER, roles: ['manager']},
				target,
			]);

			const {ctx: mgrCtx, page} = await freshLogin(
				browser,
				baseURL,
				MANAGER,
				getPassword(MANAGER),
				ctx.path,
			);
			try {
				const pom = new UserManagementPage(page, ctx.path);
				await pom.goto();

				// The affordance is present for the in-scope target (canLoginAs true).
				const row = pom.rowFor(target.email);
				await expect(row).toBeVisible();
				const labels = await pom.rowActionLabels(row);
				expect(labels).toContain('Login As');
				await pom.closeRowMenu();

				// Drive the real grid row action → a confirm dialog → OK →
				// navigates through signInAsUser to the target's home.
				await pom.clickRowAction(row, 'Login As');
				const ok = page.getByRole('button', {name: 'OK', exact: true});
				await expect(ok).toBeVisible();
				await ok.click();
				await page.waitForURL(
					(u) =>
						!u.pathname.includes('/settings/access') &&
						!u.pathname.includes('/signInAsUser'),
					{timeout: 15_000, waitUntil: 'commit'},
				);
				await expect(page).not.toHaveURL(/confirmAccess/i);

				// Acting as the target, with the manager stashed.
				const acting = await whoami(page, ctx.path);
				expect(acting.username).toBe(target.username);
				expect(acting.isUserLoggedInAs).toBe(true);
				expect(acting.loggedInAsUser?.username).toBe(MANAGER);

				// On the target's dashboard the impersonating header carries the
				// return control: opening the user-nav menu, the normal logout is
				// swapped to "Logout as {target}" routing to signOutAsUser (the
				// Dropdown panel mounts only once opened).
				await page.goto(`/index.php/${ctx.path}/dashboard`);
				const userNav = page.locator('[data-cy="app-user-nav"]');
				await userNav.locator('button').first().click();
				const returnControl = userNav.locator('a[href*="signOutAsUser"]');
				await expect(returnControl.first()).toBeVisible();
				await expect(returnControl.first()).toContainText(
					new RegExp(`Logout as ${target.username}`, 'i'),
				);

				// Return to the manager.
				await page.goto(signOutAsUrl(ctx.path));
				const restored = await whoami(page, ctx.path);
				expect(restored.username).toBe(MANAGER);
				expect(restored.isUserLoggedInAs).toBe(false);
			} finally {
				await mgrCtx.close();
			}
		},
	);

	// ── Scenario 3 (+ 5 affordance absent) ────────────────────────────────────
	// A manager CANNOT impersonate a SITE ADMIN. On the scratch journal `admin`
	// is auto-enrolled as a manager (so appears in the grid), but the "Login As"
	// affordance is ABSENT on the admin row (canLoginAs=false) while present on
	// an in-scope user; hitting signInAsUser on the admin id yields the "no
	// administrative rights … site administrator" error page and NO session
	// switch (still the manager).
	test(
		'manager cannot impersonate a site administrator (affordance absent + handler refuses)',
		{tag: '@smoke'},
		async ({browser, baseURL, pkpApi}) => {
			const tag = uniqueTag();
			const inScope = throwaway(tag, 'rev', ['reviewer']);
			const ctx = await seedJournal(pkpApi, tag, [
				{username: MANAGER, roles: ['manager']},
				inScope,
			]);

			const {ctx: mgrCtx, page} = await freshLogin(
				browser,
				baseURL,
				MANAGER,
				getPassword(MANAGER),
				ctx.path,
			);
			try {
				// API: canLoginAs true for the in-scope user, false for the site admin.
				const inScopeRow = await userByName(mgrCtx.request, ctx.path, inScope.username);
				const adminRow = await userByName(mgrCtx.request, ctx.path, 'admin');
				expect(inScopeRow?.canLoginAs).toBe(true);
				expect(adminRow, 'admin auto-enrolled on scratch journal').not.toBeNull();
				expect(adminRow.canLoginAs).toBe(false);
				expect((adminRow.groups || []).map((g) => g.roleId)).not.toContain(
					undefined,
				);

				const pom = new UserManagementPage(page, ctx.path);
				await pom.goto();

				// The grid affordance matches: present in-scope, absent for the admin.
				const inScopeLabels = await pom.rowActionLabels(pom.rowFor(inScope.email));
				expect(inScopeLabels).toContain('Login As');
				await pom.closeRowMenu();

				const adminLabels = await pom.rowActionLabels(pom.rowFor('admin'));
				expect(adminLabels).not.toContain('Login As');
				await pom.closeRowMenu();

				// The handler refuses the direct URL — error page, no switch.
				await page.goto(signInAsUrl(ctx.path, adminRow.id));
				await expect(
					page.getByText(/do not have administrative rights over this user/i),
				).toBeVisible();
				await expect(page.getByText(/site administrator/i)).toBeVisible();

				// Still the manager — the session did NOT switch.
				const acting = await whoami(page, ctx.path);
				expect(acting.username).toBe(MANAGER);
				expect(acting.isUserLoggedInAs).toBe(false);
			} finally {
				await mgrCtx.close();
			}
		},
	);

	// ── Scenario 4 — out-of-scope cross-journal user ──────────────────────────
	// A manager cannot impersonate a user who holds a role in a journal the
	// manager does NOT manage. Seed TWO scratch journals: A (dbarnes = manager)
	// and B (a user with a role ONLY in B). getAdministrationLevel drops below
	// FULL (a conflicting context, run with no context → PROHIBITED), so
	// signInAsUser on the journal-B user refuses with the "active in journals
	// you do not manage" error and NO session switch — even though dbarnes could
	// impersonate his own in-scope user (asserted as the contrast).
	test(
		'manager cannot impersonate an out-of-scope cross-journal user',
		{tag: '@regression'},
		async ({browser, baseURL, pkpApi, asUser}) => {
			const tagA = uniqueTag('laa');
			const tagB = uniqueTag('lab');
			const local = throwaway(tagA, 'rev', ['reviewer']);
			const crossUser = throwaway(tagB, 'rev', ['reviewer']);
			const journalA = await seedJournal(pkpApi, tagA, [
				{username: MANAGER, roles: ['manager']},
				local,
			]);
			const journalB = await seedJournal(pkpApi, tagB, [crossUser]);

			// The journal-B user id — dbarnes cannot see journal B, so read it via
			// a (read-only, non-impersonating) admin context. admin is auto-enrolled
			// as a manager of journal B, so its users feed is reachable.
			const adminCtx = await asUser('admin');
			const crossRow = await userByName(adminCtx.request, journalB.path, crossUser.username);
			expect(crossRow, 'journal-B user seeded').not.toBeNull();

			const {ctx: mgrCtx, page} = await freshLogin(
				browser,
				baseURL,
				MANAGER,
				getPassword(MANAGER),
				journalA.path,
			);
			try {
				// Contrast: dbarnes CAN impersonate his own in-scope user (FULL).
				const localRow = await userByName(mgrCtx.request, journalA.path, local.username);
				expect(localRow?.canLoginAs).toBe(true);

				// The cross-journal user is refused (PROHIBITED, no context) — the
				// handler renders the "journals you do not manage" error, no switch.
				await page.goto(signInAsUrl(journalA.path, crossRow.id));
				await expect(
					page.getByText(/do not have administrative rights over this user/i),
				).toBeVisible();
				await expect(
					page.getByText(/active in journals you do not manage/i),
				).toBeVisible();

				const acting = await whoami(page, journalA.path);
				expect(acting.username).toBe(MANAGER);
				expect(acting.isUserLoggedInAs).toBe(false);
			} finally {
				await mgrCtx.close();
			}
		},
	);

	// ── Scenario 6 — the reauth gate is a SEPARATE Administration control ──────
	// Impersonation asks for NO password (one-click). The reauthentication gate
	// (`admin/confirmAccess`) guards the Administration AREA, not login-as, and
	// is config-gated (security.password_timeout, default 0/off). On the default
	// install a site admin opens the Administration page with NO confirm-access
	// prompt; and signInAsUser likewise interposes no password.
	test(
		'the reauth gate is off by default (Administration opens, impersonation asks no password)',
		{tag: '@regression'},
		async ({browser, baseURL, pkpApi}) => {
			const tag = uniqueTag();
			const target = throwaway(tag, 'rev', ['reviewer']);
			const ctx = await seedJournal(pkpApi, tag, [target]);

			const {ctx: adminCtx, page} = await freshLogin(
				browser,
				baseURL,
				'admin',
				getPassword('admin'),
			);
			try {
				// The Administration area opens with NO reauth prompt (gate off).
				await page.goto('/index.php/index/admin');
				await expect(page).not.toHaveURL(/confirmAccess/i);
				await expect(
					page.getByRole('heading', {name: 'Administration'}),
				).toBeVisible();
				// No confirm-password field was interposed.
				await expect(page.locator('form#confirmPasswordForm')).toHaveCount(0);

				// Impersonation is likewise one-click: signInAsUser switches the
				// session without any password re-entry.
				const targetRow = await userByName(adminCtx.request, ctx.path, target.username);
				await page.goto(signInAsUrl(ctx.path, targetRow.id));
				await expect(page).not.toHaveURL(/confirmAccess/i);
				const acting = await whoami(page, ctx.path);
				expect(acting.username).toBe(target.username);
				expect(acting.isUserLoggedInAs).toBe(true);
				expect(acting.loggedInAsUser?.username).toBe('admin');
			} finally {
				await adminCtx.close();
			}
		},
	);
});
