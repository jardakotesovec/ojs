// @ts-check
const {test, expect} = require('../support/fixtures.js');
const {InvitationPage} = require('../../lib/pkp/playwright/pages/InvitationPage.js');
const {LoginPage} = require('../../lib/pkp/playwright/pages/LoginPage.js');

/**
 * User invitations — the 3.6 invitation framework: a manager invites a new
 * email or an existing user to a role; the invitee accepts through a real
 * multi-step wizard (a new person's account is CREATED there) or declines via
 * the emailed link. One test per canonical scenario of
 * docs/product/specs/user-invitations.md (8 named), landed at 7 here by
 * folding the OQ2 magic-link probe into the invite-existing test, the
 * "compose the email" content assertions + the Open-Q5 empty-body observation
 * into one email test, and the used/expired soft-landing + expiry-window
 * (scenarios 6 + 7) into one dead-ends test; the row-115 privilege escalation
 * and the permission boundary (scenario 8) share one test.
 *
 * WHAT IS DRIVEN LIVE (a WRITE + auth flow — the point):
 *   - The REAL accept WIZARD in the browser: a NEW invitee fills
 *     username/password/consent → name/country → review → accept, and their
 *     account is CREATED, enabled and role-assigned (verified via the users
 *     API + a real login); an EXISTING user accepts the 1-step review and the
 *     role is ADDED (no re-creation).
 *   - The REAL send wizard page (VUE-user-invitation-page) mounted, then its
 *     create-side API (add → populate → getMailable → populate emailComposer →
 *     invite) — the exact calls the wizard store POSTs. The emailComposer step
 *     is required for the mail to carry the accept/decline URLs (Open-Q5).
 *   - The REAL decline confirmation page → POST confirm-decline.
 *   - The REAL pending-invitation manager list + row-menu Cancel + confirm
 *     dialog.
 *   - The invitation email in Mailpit (from the inviter's own address, both
 *     accept + decline URLs), the created account + role, the used/cancelled
 *     link "Invitation Unavailable" soft-landing, and the ⚠ row-115
 *     over-permission.
 *
 * ⚠ ROW 115 (asserted): a SECTION EDITOR (dbuskins) CAN mint a brand-new
 * account as JOURNAL MANAGER via the invite path — the create-side routes admit
 * sub-editor/assistant and nothing checks the inviter may grant that role — a
 * privilege escalation strictly wider than the manager/admin-only direct-create
 * path. A REVIEWER (jjanssen) is refused (401). Asserted in test 7.
 *
 * OQ2 (probed + reported): following an existing-user accept link does NOT hand
 * the holder a browsable session — the `receive` auto-login (registerUserSession)
 * is per-invitation-request only; the accept page itself never logs you in. So
 * a leaked link lets someone ACCEPT the invitation but is NOT a magic-link into
 * the account (API self → 401, /user/profile bounces to /login). Asserted in
 * test 2. This is safer than the spec's OQ2 feared — a spec contradiction with
 * Rule 5 ("auto-logs that user in"), reported.
 *
 * AUTH: `test.use({user:'dbarnes'})` — the default page is the journal MANAGER
 * (enrolled as manager of each test's own scratch journal, so the create-side
 * gate + `page.request` session both hold). Invitees drive the accept/decline
 * wizard in a FRESH anonymous context (empty storageState). Row-115 uses
 * `asUser('dbuskins')` (section editor) + `asUser('jjanssen')` (reviewer).
 *
 * PARALLEL + isolation: every test seeds its OWN scratch journal (unique tag)
 * with dbarnes-as-manager + UNIQUE throwaway emails; created accounts and
 * invitations PERSIST on the long-lived DB, so a per-run random suffix keeps
 * re-runs collision-free. The invitation mail is sent synchronously in-request
 * → reaches Mailpit immediately (scoped by the unique recipient, never
 * clearAll). The expiry WINDOW is asserted from the invite response (now+3d) —
 * the daily RemoveExpiredInvitations job is NOT run — so this file is
 * parallel-safe at the flat root.
 */

const MANAGER = 'dbarnes';
const MANAGER_EMAIL = 'dbarnes@mailinator.com';
const SECTION_EDITOR = 'dbuskins';
const REVIEWER = 'jjanssen';
const ROLE_ID_MANAGER = 16;
const ROLE_ID_REVIEWER = 4096;
const ROLE_ID_AUTHOR = 65536;
const EMAIL_SUBJECT = 'You are invited to new roles';
const PW = 'Invite-Accept-123'; // > site minimum length; used for accepted accounts

/** A unique, hyphenless, lowercased alphanumeric token (parallel + re-run isolation). */
function uniqueTag(prefix = 'inv') {
	const workerIndex = test.info().parallelIndex;
	const rand = Math.random().toString(36).slice(2, 8);
	return `${prefix}${workerIndex}x${rand}`;
}

/**
 * Seed a scratch journal with dbarnes-as-manager plus any extra throwaway
 * users, and return `{path, users}` where `users` is the tag-scoped users
 * feed (for reading role → userGroupId and existing userIds).
 */
async function seedJournal(pkpApi, page, tag, extraUsers = []) {
	const {context} = await pkpApi.createJournal({
		tag,
		users: [{username: MANAGER, roles: ['manager']}, ...extraUsers],
	});
	return {path: context.path};
}

/** Look a user up on a journal's `/users` feed by exact username. */
async function userByName(page, path, username) {
	const res = await page.request.get(
		`/index.php/${path}/api/v1/users?searchPhrase=${encodeURIComponent(username)}&status=all&count=50`,
	);
	expect(res.ok(), `users feed ${res.status()}`).toBeTruthy();
	const body = await res.json();
	return (
		(body.items || []).find(
			(u) => String(u.userName).toLowerCase() === username.toLowerCase(),
		) || null
	);
}

/** The userGroupId of a role in `user.groups[]`. */
function gidForRole(user, roleId) {
	return (user?.groups || []).find((g) => g.roleId === roleId)?.id;
}

/** The role ids a user is enrolled in. */
function roleIdsOf(user) {
	return (user?.groups || []).map((g) => g.roleId);
}

/** A fresh anonymous browser context (explicit empty storage state). */
async function anonContext(browser, baseURL) {
	return browser.newContext({baseURL, storageState: {cookies: [], origins: []}});
}

/** The full HTML body of the (single) invitation mail to `to`. */
async function invitationEmailHtml(pkpMail, to) {
	const [msg] = await pkpMail.find({to, contains: EMAIL_SUBJECT, timeoutMs: 15_000});
	return {msg, html: (await pkpMail.fullMessage(msg.ID)).HTML || ''};
}

test.use({user: MANAGER});

test.describe('User invitations — invite / accept / decline / manage', () => {
	// ── Scenario 1 — invite a NEW user → account created on accept ──────────
	// The manager mounts the real send wizard, invites a fresh email to the
	// Reviewer role, and the invitee drives the real 3-step accept wizard:
	// their account is CREATED, enabled and role-assigned, and the chosen
	// password logs in. Re-opening the (now accepted) link lands softly.
	test(
		'invites a new user who accepts the wizard: account created, enabled, role-assigned, can log in',
		{tag: '@smoke'},
		async ({page, pkpApi, pkpMail, browser, baseURL}) => {
			const tag = uniqueTag('invnew');
			const revSeed = {username: `${tag}rev`, password: `${tag}seedpw1`, email: `${tag}rev@mailinator.com`, givenName: 'Rev', familyName: 'Seed', roles: ['reviewer']};
			const {path} = await seedJournal(pkpApi, page, tag, [revSeed]);
			const reviewerGid = gidForRole(await userByName(page, path, revSeed.username), ROLE_ID_REVIEWER);

			const inviteeEmail = `${uniqueTag('newee')}@mailinator.com`;
			const manager = new InvitationPage(page, path);
			await manager.gotoCreate();
			const {invitation} = await manager.createInvitation({inviteeEmail, userGroupId: reviewerGid});

			// The invite created a PENDING invitation with a ~3-day expiry.
			expect(invitation.status).toBe('PENDING');
			expect(invitation.email).toBe(inviteeEmail);

			// The invitation mail — from the inviter's own address — carries the
			// accept link.
			const {msg, html} = await invitationEmailHtml(pkpMail, inviteeEmail);
			expect(msg.From.Address).toBe(MANAGER_EMAIL);
			expect(msg.Subject).toContain(EMAIL_SUBJECT);
			const acceptUrl = InvitationPage.extractAcceptUrl(html);

			// The invitee drives the real accept wizard in a fresh anon context.
			const ctx = await anonContext(browser, baseURL);
			const inviteePage = await ctx.newPage();
			const invitee = new InvitationPage(inviteePage, path);
			const newUsername = uniqueTag('acct');
			await invitee.gotoAccept(acceptUrl);
			await invitee.acceptAsNewUser({username: newUsername, password: PW, country: 'US'});

			// The account now exists — enabled, holding the Reviewer role, with no
			// activation/must-change step (the invitee set their own password).
			const created = await userByName(page, path, newUsername);
			expect(created, 'invited account should exist').not.toBeNull();
			expect(created.email).toBe(inviteeEmail);
			expect(created.disabled).toBe(false);
			expect(roleIdsOf(created)).toContain(ROLE_ID_REVIEWER);

			// The chosen password logs in (immediately usable).
			const loginPage = await ctx.newPage();
			const login = new LoginPage(loginPage);
			await login.login(newUsername, PW, path);
			await loginPage.waitForURL((u) => !u.pathname.includes('/login'), {waitUntil: 'commit'});
			await expect(loginPage).not.toHaveURL(/\/login/);

			// The used (accepted) link now lands softly, not on a 404/crash.
			const usedPage = await ctx.newPage();
			await usedPage.goto(acceptUrl);
			await expect(usedPage.getByRole('heading', {name: 'Invitation Unavailable'})).toBeVisible();
			await ctx.close();
		},
	);

	// ── Scenario 2 (+ OQ2 magic-link) — invite an EXISTING user → role added ─
	// The manager invites an existing author to the Reviewer role. Following
	// the accept link does NOT grant a browsable session (OQ2: the receive
	// auto-login is per-request only — API self 401, profile bounces to login);
	// accepting the 1-step review ADDS the role with NO account re-creation.
	test(
		'invites an existing user who accepts: role added, no re-creation; the accept link is not a magic-link (OQ2)',
		{tag: '@smoke'},
		async ({page, pkpApi, pkpMail, browser, baseURL}) => {
			const tag = uniqueTag('invex');
			const existing = {username: `${tag}au`, password: `${tag}aupw1`, email: `${tag}au@mailinator.com`, givenName: 'Auth', familyName: 'Or', roles: ['author']};
			const revSeed = {username: `${tag}rev`, password: `${tag}seedpw1`, email: `${tag}rev@mailinator.com`, givenName: 'Rev', familyName: 'Seed', roles: ['reviewer']};
			const {path} = await seedJournal(pkpApi, page, tag, [existing, revSeed]);
			const existingUser = await userByName(page, path, existing.username);
			const reviewerGid = gidForRole(await userByName(page, path, revSeed.username), ROLE_ID_REVIEWER);
			expect(roleIdsOf(existingUser)).toEqual([ROLE_ID_AUTHOR]);

			const manager = new InvitationPage(page, path);
			await manager.gotoCreate();
			await manager.createInvitation({userId: existingUser.id, userGroupId: reviewerGid});

			// Mail went to the existing user's address; extract the accept link.
			const {html} = await invitationEmailHtml(pkpMail, existing.email);
			const acceptUrl = InvitationPage.extractAcceptUrl(html);

			const ctx = await anonContext(browser, baseURL);
			const inviteePage = await ctx.newPage();
			const invitee = new InvitationPage(inviteePage, path);

			// Load the accept link and wait for the receive call (which, per spec,
			// auto-logs-in the existing user for that request).
			const receiveResp = inviteePage.waitForResponse(
				(r) => /\/invitations\/\d+\/key\//.test(r.url()) && r.request().method() === 'GET',
				{timeout: 20_000},
			);
			await invitee.gotoAccept(acceptUrl);
			await receiveResp;

			// OQ2: the emailed key does NOT grant a browsable session. The context
			// stays anonymous — the users API self-read is unauthorized and a
			// login-gated page bounces to /login.
			const self = await ctx.request.get(`/index.php/${path}/api/v1/users/${existingUser.id}`);
			expect(self.status(), 'accept link is not a magic-link into the account').toBe(401);
			const gated = await ctx.newPage();
			await gated.goto(`/index.php/${path}/user/profile`);
			await expect(gated).toHaveURL(/\/login/);
			await gated.close();

			// Accept the 1-step review → the role is added.
			await invitee.acceptAsExistingUser();

			const after = await userByName(page, path, existing.username);
			expect(after.id, 'no account re-creation').toBe(existingUser.id);
			expect(roleIdsOf(after)).toEqual(expect.arrayContaining([ROLE_ID_AUTHOR, ROLE_ID_REVIEWER]));
			await ctx.close();
		},
	);

	// ── Scenario 3 — compose & send the invitation email ────────────────────
	// The composed mailable (getMailable) and the delivered mail both come
	// from the inviter's own address, subject "You are invited to new roles",
	// listing the added role, and carrying BOTH an accept and a decline link.
	// Open-Q5 observation: an invite sent with NO email composer produces an
	// empty body (no accept link) — the UI always fills the composer.
	test(
		'composes & sends the invitation email from the inviter with accept + decline links',
		{tag: '@regression'},
		async ({page, pkpApi, pkpMail}) => {
			const tag = uniqueTag('invmail');
			const revSeed = {username: `${tag}rev`, password: `${tag}seedpw1`, email: `${tag}rev@mailinator.com`, givenName: 'Rev', familyName: 'Seed', roles: ['reviewer']};
			const {path} = await seedJournal(pkpApi, page, tag, [revSeed]);
			const reviewerGid = gidForRole(await userByName(page, path, revSeed.username), ROLE_ID_REVIEWER);

			const inviteeEmail = `${uniqueTag('mailee')}@mailinator.com`;
			const manager = new InvitationPage(page, path);
			await manager.gotoCreate();
			const {mailable} = await manager.createInvitation({inviteeEmail, userGroupId: reviewerGid});

			// The composed mailable: from the inviter, correct subject, the added
			// Reviewer role listed.
			expect(mailable.from[0].address).toBe(MANAGER_EMAIL);
			expect(mailable.subject).toBe(EMAIL_SUBJECT);
			expect(mailable.viewData.rolesAdded).toMatch(/Reviewer/);

			// The delivered mail: from the inviter, both action links present.
			const {msg, html} = await invitationEmailHtml(pkpMail, inviteeEmail);
			expect(msg.From.Address).toBe(MANAGER_EMAIL);
			const acceptUrl = InvitationPage.extractAcceptUrl(html);
			const declineUrl = InvitationPage.extractDeclineUrl(html);
			expect(acceptUrl).toMatch(/invitation\/accept\?id=\d+&key=/);
			expect(declineUrl).toMatch(/invitation\/decline\?id=\d+&key=/);

			// Open-Q5: sending WITHOUT the composer step yields an empty body (no
			// accept URL). Drive the raw create API skipping emailComposer.
			const csrf = await manager.csrf();
			const headers = {'X-Csrf-Token': csrf, 'Content-Type': 'application/json'};
			const api = `/index.php/${path}/api/v1/invitations`;
			const bareEmail = `${uniqueTag('bare')}@mailinator.com`;
			const {invitationId} = await (await manager.add({inviteeEmail: bareEmail, csrf})).json();
			await page.request.put(`${api}/${invitationId}/populate`, {
				headers,
				data: {invitationData: {userGroupsToAdd: [{userGroupId: reviewerGid, dateStart: new Date().toISOString().slice(0, 10), dateEnd: null, masthead: false}], givenName: {en: 'Bare'}, familyName: {en: 'Body'}}},
			});
			await page.request.put(`${api}/${invitationId}/invite`, {headers, data: {}});
			const {html: bareHtml} = await invitationEmailHtml(pkpMail, bareEmail);
			expect(bareHtml, 'no composer → empty body → no accept link (Open-Q5)').not.toMatch(/invitation\/accept/);
		},
	);

	// ── Scenario 4 — decline an invitation ──────────────────────────────────
	// The invitee opens the decline link, sees the confirmation page, and
	// confirms (a POST) → the invitation is Declined and they land on login. No
	// account is created. A decline attempt on the (now handled) invitation is
	// refused: the link lands on the "no longer available" page.
	test(
		'declines an invitation via the confirm page; no account; a handled link lands softly',
		{tag: '@regression'},
		async ({page, pkpApi, pkpMail, browser, baseURL}) => {
			const tag = uniqueTag('invdec');
			const revSeed = {username: `${tag}rev`, password: `${tag}seedpw1`, email: `${tag}rev@mailinator.com`, givenName: 'Rev', familyName: 'Seed', roles: ['reviewer']};
			const {path} = await seedJournal(pkpApi, page, tag, [revSeed]);
			const reviewerGid = gidForRole(await userByName(page, path, revSeed.username), ROLE_ID_REVIEWER);

			const inviteeEmail = `${uniqueTag('decee')}@mailinator.com`;
			const manager = new InvitationPage(page, path);
			await manager.gotoCreate();
			await manager.createInvitation({inviteeEmail, userGroupId: reviewerGid});
			const {html} = await invitationEmailHtml(pkpMail, inviteeEmail);
			const declineUrl = InvitationPage.extractDeclineUrl(html);
			const acceptUrl = InvitationPage.extractAcceptUrl(html);

			const ctx = await anonContext(browser, baseURL);
			const inviteePage = await ctx.newPage();
			const invitee = new InvitationPage(inviteePage, path);

			// The decline confirmation page → confirm (POST) → redirected to login.
			await invitee.gotoDecline(declineUrl);
			await expect(invitee.declineHeading).toBeVisible();
			await invitee.confirmDecline();
			await inviteePage.waitForURL(/\/login/, {waitUntil: 'commit'});
			await expect(inviteePage).toHaveURL(/\/login/);

			// No account was created for the invitee email.
			expect(await userByName(page, path, inviteeEmail.split('@')[0]), 'no account on decline').toBeNull();

			// The now-handled invitation is refused: the accept link lands softly.
			const usedPage = await ctx.newPage();
			await usedPage.goto(acceptUrl);
			await expect(usedPage.getByRole('heading', {name: 'Invitation Unavailable'})).toBeVisible();
			await ctx.close();
		},
	);

	// ── Scenario 5 — manage pending invitations: cancel ─────────────────────
	// On the Users & Roles page the manager sees the pending-invitation list
	// with the invite (its role + "Invited" date), opens the row menu, and
	// Cancels it through the confirm dialog; the row drops off the list and the
	// now-cancelled accept link lands softly.
	test(
		'lists the pending invitation and cancels it through the manager UI',
		{tag: '@regression'},
		async ({page, pkpApi, pkpMail, browser, baseURL}) => {
			const tag = uniqueTag('invcan');
			const revSeed = {username: `${tag}rev`, password: `${tag}seedpw1`, email: `${tag}rev@mailinator.com`, givenName: 'Rev', familyName: 'Seed', roles: ['reviewer']};
			const {path} = await seedJournal(pkpApi, page, tag, [revSeed]);
			const reviewerGid = gidForRole(await userByName(page, path, revSeed.username), ROLE_ID_REVIEWER);

			const inviteeEmail = `${uniqueTag('canee')}@mailinator.com`;
			const manager = new InvitationPage(page, path);
			await manager.gotoCreate();
			await manager.createInvitation({inviteeEmail, userGroupId: reviewerGid});
			const {html} = await invitationEmailHtml(pkpMail, inviteeEmail);
			const acceptUrl = InvitationPage.extractAcceptUrl(html);

			// The pending list shows the invitation (email, Reviewer role).
			await manager.gotoManager();
			const row = manager.invitationRow(inviteeEmail).first();
			await expect(row).toBeVisible();
			await expect(row).toContainText('Reviewer');
			await expect(row).toContainText(/Invited/);

			// Cancel it through the real row-menu → confirm dialog.
			await manager.cancelInvitation(inviteeEmail);
			await expect(manager.invitationRow(inviteeEmail)).toHaveCount(0);

			// The still-active feed no longer contains it.
			const feed = await (await page.request.get(`/index.php/${path}/api/v1/invitations/userRoleAssignment?count=30`)).json();
			expect((feed.items || []).some((i) => i.email === inviteeEmail)).toBe(false);

			// The cancelled accept link lands softly, not on a 404/crash.
			const ctx = await anonContext(browser, baseURL);
			const p = await ctx.newPage();
			await p.goto(acceptUrl);
			await expect(p.getByRole('heading', {name: 'Invitation Unavailable'})).toBeVisible();
			await ctx.close();
		},
	);

	// ── Scenarios 6 + 7 — dead-end links + the expiry window ────────────────
	// The expiry is fixed at send time to now+3 days (the daily
	// RemoveExpiredInvitations job — wired in the scheduler — sweeps past it;
	// not run here). A link whose id/key don't match any invitation is a plain
	// 404; a handled (cancelled) invitation's link lands on the friendly
	// "Invitation Unavailable" page and its public receive API is refused.
	test(
		'sets a 3-day expiry; bogus links 404 while a handled link lands softly and the receive API is refused',
		{tag: '@regression'},
		async ({page, pkpApi, pkpMail, browser, baseURL}) => {
			const tag = uniqueTag('invexp');
			const revSeed = {username: `${tag}rev`, password: `${tag}seedpw1`, email: `${tag}rev@mailinator.com`, givenName: 'Rev', familyName: 'Seed', roles: ['reviewer']};
			const {path} = await seedJournal(pkpApi, page, tag, [revSeed]);
			const reviewerGid = gidForRole(await userByName(page, path, revSeed.username), ROLE_ID_REVIEWER);

			const inviteeEmail = `${uniqueTag('expee')}@mailinator.com`;
			const manager = new InvitationPage(page, path);
			await manager.gotoCreate();
			const {invitationId, invitation} = await manager.createInvitation({inviteeEmail, userGroupId: reviewerGid});

			// Expiry window: fixed at send time to ~now + 3 days.
			const days = (new Date(invitation.expiryDate).getTime() - Date.now()) / 86_400_000;
			expect(days).toBeGreaterThan(2.5);
			expect(days).toBeLessThan(3.5);

			const {html} = await invitationEmailHtml(pkpMail, inviteeEmail);
			const acceptUrl = InvitationPage.extractAcceptUrl(html);
			const {key} = InvitationPage.parseIdKey(acceptUrl);

			const ctx = await anonContext(browser, baseURL);
			const p = await ctx.newPage();

			// A non-existent id/key → a plain 404.
			const bogus = await p.goto(`/index.php/${path}/invitation/accept?id=99999999&key=deadbeef`);
			expect(bogus?.status()).toBe(404);

			// A real id with the WRONG key → also a plain 404 (no soft landing).
			const wrongKey = await p.goto(`/index.php/${path}/invitation/accept?id=${invitationId}&key=wrongkey`);
			expect(wrongKey?.status()).toBe(404);

			// Cancel the invitation (via the create-side API), making it handled.
			const cancelled = await manager.cancelViaApi(invitationId);
			expect(cancelled.ok()).toBeTruthy();

			// The handled invitation's own link now lands softly (login/register).
			await p.goto(acceptUrl);
			await expect(p.getByRole('heading', {name: 'Invitation Unavailable'})).toBeVisible();
			await expect(p.getByRole('link', {name: 'Login'})).toBeVisible();
			await expect(p.getByRole('link', {name: 'Register'})).toBeVisible();

			// The public receive API rejects the non-pending invitation.
			const receive = await ctx.request.get(`/index.php/${path}/api/v1/invitations/${invitationId}/key/${key}`);
			expect(receive.status(), 'receive on a handled invitation is refused').toBeGreaterThanOrEqual(400);
			await ctx.close();
		},
	);

	// ── Scenario 8 (+ ⚠ ROW 115) — permission: escalation & boundary ────────
	// ⚠ A SECTION EDITOR (dbuskins) — who cannot create a user at all via the
	// manager/admin-only direct add-user form — CAN mint a brand-new account as
	// JOURNAL MANAGER through the invite path (add/populate/invite all succeed):
	// a privilege escalation, strictly wider than direct-create. A REVIEWER
	// (jjanssen) is refused (401 at the API, authorizationDenied at the page).
	// Anonymous cannot reach the create page (→ login) or the API (403).
	test(
		'row-115: a section editor can invite a new user as Journal manager; a reviewer/anonymous cannot',
		{tag: '@smoke'},
		async ({page, pkpApi, asUser, browser, baseURL}) => {
			const tag = uniqueTag('invperm');
			const {path} = await seedJournal(pkpApi, page, tag, [
				{username: SECTION_EDITOR, roles: ['sectionEditor']},
				{username: REVIEWER, roles: ['reviewer']},
			]);
			// The Journal-manager user group id (read from dbarnes's own roles).
			const managerGid = gidForRole(await userByName(page, path, MANAGER), ROLE_ID_MANAGER);

			// ⚠ Section editor CAN mint a new Journal-manager account.
			const seCtx = await asUser(SECTION_EDITOR);
			const sePage = await seCtx.newPage();
			const seManager = new InvitationPage(sePage, path);
			await seManager.gotoCreate(); // the create page is reachable for a section editor
			const seEmail = `${uniqueTag('escal')}@mailinator.com`;
			const {status, invitation} = await seManager.createInvitation({
				inviteeEmail: seEmail,
				userGroupId: managerGid,
				request: seCtx.request,
				givenName: 'Escalated',
				familyName: 'Manager',
			});
			expect(status, 'section editor invite succeeds').toBe(200);
			expect(invitation.status).toBe('PENDING');
			// The Journal-manager invite shows up on the pending list.
			const pending = await (await seCtx.request.get(`/index.php/${path}/api/v1/invitations/userRoleAssignment?count=30`)).json();
			expect((pending.items || []).some((i) => i.email === seEmail)).toBe(true);
			// (Cancel the escalation probe artifact.)
			const invId = (pending.items.find((i) => i.email === seEmail)).id;
			await seManager.cancelViaApi(invId, {request: seCtx.request, csrf: await seManager.csrf()});

			// A reviewer is refused at the API and bounced at the page.
			const revCtx = await asUser(REVIEWER);
			const revPage = await revCtx.newPage();
			await revPage.goto(`/index.php/${path}/dashboard`, {waitUntil: 'commit'});
			const revManager = new InvitationPage(revPage, path);
			const revAdd = await revManager.add({
				inviteeEmail: `${uniqueTag('revtry')}@mailinator.com`,
				request: revCtx.request,
				csrf: await revManager.csrf(),
			});
			expect(revAdd.status(), 'a reviewer cannot invite').toBe(401);
			await revPage.goto(`/index.php/${path}/invitation/create/userRoleAssignment`, {waitUntil: 'commit'});
			await expect(revPage).toHaveURL(/authorizationDenied/i);

			// Anonymous cannot reach the create page or the create API.
			const anonCtx = await anonContext(browser, baseURL);
			const anonPage = await anonCtx.newPage();
			await anonPage.goto(`/index.php/${path}/invitation/create/userRoleAssignment`, {waitUntil: 'commit'});
			await expect(anonPage).toHaveURL(/\/login/);
			const anonAdd = await anonCtx.request.post(`/index.php/${path}/api/v1/invitations/add/userRoleAssignment`, {
				headers: {'Content-Type': 'application/json'},
				data: {invitationData: {inviteeEmail: 'anon@example.test'}},
			});
			expect([401, 403]).toContain(anonAdd.status());
			await anonCtx.close();
		},
	);
});
