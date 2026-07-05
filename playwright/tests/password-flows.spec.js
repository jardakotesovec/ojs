// @ts-check
const {test, expect} = require('../support/fixtures.js');
const {LoginPage} = require('../../lib/pkp/playwright/pages/LoginPage.js');
const {PasswordFlowsPage} = require('../../lib/pkp/playwright/pages/PasswordFlowsPage.js');

/**
 * Password flows — the "I can't get in / must change this" front door.
 * One test per canonical scenario of docs/product/specs/password-flows.md
 * (6 named), landed at 6 here: each scenario drives the REAL LoginHandler
 * forms (lib/pkp) end-to-end. The password-rules scenario (6) is split across
 * the two forms it governs — the reset-form min-length rides along in the
 * round-trip (test 1), the change-form length + mismatch rules get their own
 * test (test 6).
 *
 * WHAT IS DRIVEN LIVE (this is a WRITE + auth flow — the point):
 *   - The REAL lost-password form → the PASSWORD_RESET_CONFIRM email in Mailpit
 *     (from the SITE contact, raw-URL reset link) → the REAL reset form → a new
 *     password that logs in while the old one is rejected and the used link dies.
 *   - Tampered / unknown reset links → the invalid-hash error page / a redirect.
 *   - No account enumeration: an unknown email → the same confirmation page and
 *     ZERO mail (bounded by a positive control that DOES arrive).
 *   - The forced-change interception: a must_change_password login is bounced to
 *     the change screen with NO session, changes the password, the flag clears,
 *     and a later login proceeds normally.
 *   - The standalone change form (⚠ ROW 111 — anonymous-reachable, username-
 *     driven): wrong current password refused, correct current password succeeds.
 *   - Password rules: min length 6 + new/repeat mismatch on both forms.
 *
 * ⚠ ROW 110 (code-level, not driven here): the forced/standalone
 * `LoginChangePasswordForm` validates LENGTH ONLY (`FormValidatorLength`) and
 * SKIPS the compromised-password breach check that `ResetPasswordForm` + the
 * profile change form apply (`FormValidatorPassword`->uncompromised()). It is
 * only observable when the site `passwordUncompromisedEnabled` setting is ON
 * (off by default; a no-op verifier is swapped in when off), which needs a
 * global config flip + a real breached password — so it is asserted at the
 * spec/code level, not in the browser here. The length rule IS driven (test 6).
 *
 * AUTH: this file sets NO `test.use({user})`, so the default `page` is a fresh
 * ANONYMOUS context per test — correct for these anonymous LoginHandler flows.
 * The forced-change + self-service tests create sessions on that per-test
 * context; each test's context is isolated.
 *
 * PARALLEL: every test seeds its own scratch journal + UNIQUE throwaway
 * user(s) via the scenario API — a seeded user's password is NEVER touched
 * (that would break the cached auth state other tests rely on). The reset
 * email is sent SYNCHRONOUSLY (LoginHandler::requestResetPassword → Mail::send,
 * not queued), so no queue drain is needed; Mailpit reads are scoped by the
 * unique recipient (never clearAll). The min-length uses the site default (6) —
 * no global-config mutation — so this file is parallel-safe at the flat root.
 */

/** A unique, hyphenless, lowercased alphanumeric token (parallel + re-run
 *  isolation; also a valid <=32-char journal urlPath and username). */
function uniqueTag(prefix = 'pw') {
	const workerIndex = test.info().parallelIndex;
	const rand = Math.random().toString(36).slice(2, 8);
	return `${prefix}${workerIndex}x${rand}`;
}

/**
 * Seed a scratch journal with one throwaway user carrying a known password
 * (and optionally the must_change_password flag). Returns the credentials +
 * journal path. The scenario `users[]` passthrough creates the user with the
 * given password when the username is not already on the DB
 * (UserAssignmentProcessor::resolveOrCreate) — no seeded user is touched.
 *
 * @returns {Promise<{journal: string, username: string, email: string, password: string}>}
 */
async function seedUser(pkpApi, {prefix = 'pw', mustChange = false, roles = ['author']} = {}) {
	const tag = uniqueTag(prefix);
	const username = tag;
	const email = `${tag}@example.test`;
	const password = 'Initial-Pass-123';
	await pkpApi.createJournal({
		tag,
		path: tag,
		name: {en: `PW ${tag}`},
		primaryLocale: 'en',
		supportedLocales: ['en'],
		users: [{username, password, email, roles, mustChangePassword: mustChange}],
	});
	return {journal: tag, username, email, password};
}

const CONFIRMATION = /confirmation has been sent to your email/i;
const INVALID_HASH = /expired or is not valid/i;

test.describe('Password flows — reset, forced change, standalone change', () => {
	// ── Scenario 1 (+ scenario 6, reset form) ──────────────────────────────
	// Lost-password round trip. An anonymous visitor requests a reset, gets the
	// PASSWORD_RESET_CONFIRM email (from the site contact, raw-URL link), opens
	// the link, is rejected for a too-short password (min 6, reset-form half of
	// scenario 6), then sets a valid new password. The old password no longer
	// logs in, the new one does, and the used link is now dead (single-use).
	test(
		'lost-password round trip: email link sets a new password; old rejected, link dies',
		{tag: '@smoke'},
		async ({page, pkpApi, pkpMail}) => {
			const {journal, username, email, password} = await seedUser(pkpApi, {prefix: 'pwrt'});
			const pw = new PasswordFlowsPage(page);

			// Request the reset → generic confirmation page.
			await pw.requestReset(journal, email);
			await expect(page.getByText(CONFIRMATION)).toBeVisible();

			// The reset email: from the SITE contact, raw-URL reset link.
			const [msg] = await pkpMail.find({to: email, contains: 'Reset', timeoutMs: 15_000});
			expect(msg.From.Address, 'reset mail is from the site contact').toBe('admin@test.local');
			expect(msg.Subject).toMatch(/Password Reset/i);
			const full = await pkpMail.fullMessage(msg.ID);
			const resetPath = PasswordFlowsPage.extractResetPath(`${full.Text || ''}\n${full.HTML || ''}`);
			expect(resetPath).toContain(`/login/resetPassword/${username}`);
			expect(resetPath).toMatch(/confirm=[0-9a-f]{64}(%3A|:)\d+/i);

			// Open the link → the new-password form (hash validated).
			await page.goto(resetPath);
			await expect(pw.resetForm).toBeVisible();

			// Scenario 6 (reset form): a too-short new password is rejected.
			await pw.submitNewPassword('ab');
			await expect(pw.formErrors).toContainText(/at least 6 characters/i);

			// Set a valid new password → "password updated".
			const NEW = 'Reset-New-123';
			await expect(pw.resetForm).toBeVisible();
			await pw.submitNewPassword(NEW);
			await expect(page.getByText(/updated successfully/i)).toBeVisible();

			// The reused link is now dead (password changed → hash no longer
			// verifies), asserted anonymously (updateResetPassword grants no
			// session, so resetPassword shows the error rather than sending home).
			await page.goto(resetPath);
			await expect(page.getByText(INVALID_HASH)).toBeVisible();

			// The old password is rejected; the new one logs in.
			const login = new LoginPage(page);
			await login.login(username, password, journal);
			await expect(login.error).toBeVisible();

			await login.login(username, NEW, journal);
			await page.waitForURL((u) => !u.pathname.includes('/login'), {waitUntil: 'commit'});
			await expect(page).not.toHaveURL(/\/login/);
		},
	);

	// ── Scenario 2 ─────────────────────────────────────────────────────────
	// Invalid reset links. A tampered confirm hash → the "expired or is not
	// valid" error page (with a back link to Reset Password); a link naming an
	// unknown username → 302 straight to Reset Password. No password changes.
	test(
		'invalid reset link: tampered hash hits the error page, unknown username redirects',
		{tag: '@regression'},
		async ({page, pkpApi}) => {
			const {journal, username} = await seedUser(pkpApi, {prefix: 'pwbad'});

			// Tampered hash → the invalid/expired error page + back link.
			await page.goto(
				`/index.php/${journal}/login/resetPassword/${username}?confirm=deadbeef%3A9999999999`,
			);
			await expect(page.getByText(INVALID_HASH)).toBeVisible();
			await expect(
				page.getByRole('link', {name: /Reset Password/i}),
			).toBeVisible();

			// Unknown username in the link → 302 to lostPassword.
			const resp = await page.goto(
				`/index.php/${journal}/login/resetPassword/nosuchuser_zzz?confirm=deadbeef%3A9999999999`,
			);
			await expect(page).toHaveURL(/\/login\/lostPassword/);
			expect(resp?.request().redirectedFrom(), 'reached via a redirect').not.toBeNull();
		},
	);

	// ── Scenario 3 ─────────────────────────────────────────────────────────
	// No account enumeration. An unknown email shows the SAME "confirmation
	// sent" page as a real one, and sends NO mail — a caller cannot tell whether
	// the address exists. The negative is bounded by a positive control: a real
	// reset for a throwaway user whose mail DOES arrive.
	test(
		'no account enumeration: an unknown email yields the same page and no mail',
		{tag: '@regression'},
		async ({page, pkpApi, pkpMail}) => {
			const {journal, email: controlEmail} = await seedUser(pkpApi, {prefix: 'pwenum'});
			const unknownEmail = `${uniqueTag('nobody')}@example.test`;
			const pw = new PasswordFlowsPage(page);

			// Unknown email → the generic confirmation page (no reveal).
			await pw.requestReset(journal, unknownEmail);
			await expect(page.getByText(CONFIRMATION)).toBeVisible();

			// Positive control: a real reset whose mail WILL arrive.
			await pw.requestReset(journal, controlEmail);
			await expect(page.getByText(CONFIRMATION)).toBeVisible();

			// No mail to the unknown address, bounded by the control's arrival.
			await pkpMail.expectNone({
				to: unknownEmail,
				contains: 'Reset',
				afterControl: {to: controlEmail, contains: 'Reset'},
			});
		},
	);

	// ── Scenario 4 ─────────────────────────────────────────────────────────
	// Forced change on first login. A must_change_password account logs in with
	// the right credentials and is bounced to the change screen with NO session
	// (the dashboard/profile stay unreachable). After saving a new password the
	// flag clears: a later login proceeds normally and the old password fails.
	test(
		'forced change on first login: intercepted with no session, then flag clears',
		{tag: '@smoke'},
		async ({page, pkpApi}) => {
			const {journal, username, password} = await seedUser(pkpApi, {
				prefix: 'pwmc',
				mustChange: true,
			});
			const login = new LoginPage(page);
			const pw = new PasswordFlowsPage(page);
			const NEW = 'Forced-New-123';

			// Login is intercepted → the change screen for this username.
			await login.login(username, password, journal);
			await page.waitForURL(/\/login\/changePassword/, {waitUntil: 'commit'});
			await expect(pw.changeForm).toBeVisible();

			// No session was granted: a login-gated page bounces to /login.
			await page.goto(`/index.php/${journal}/user/profile`);
			await expect(page).toHaveURL(/\/login/);

			// Back on the forced screen (username pre-filled from the URL),
			// change the password → savePassword logs in + sends home.
			await pw.gotoChangePassword(journal, username);
			await expect(pw.changeUsername).toHaveValue(username);
			await pw.submitChange({username, oldPassword: password, newPassword: NEW});
			await page.waitForURL((u) => !u.pathname.includes('/login'), {waitUntil: 'commit'});
			await expect(page).not.toHaveURL(/\/login/);

			// The flag is cleared: sign out, then a later login is NOT
			// re-intercepted and the old password no longer works.
			await page.goto(`/index.php/${journal}/login/signOut`);
			await login.login(username, password, journal); // old password
			await expect(login.error).toBeVisible();

			await login.login(username, NEW, journal); // new password
			await page.waitForURL((u) => !u.pathname.includes('/login'), {waitUntil: 'commit'});
			await expect(page).not.toHaveURL(/\/login\/changePassword/);
			await expect(page).not.toHaveURL(/\/login/);
		},
	);

	// ── Scenario 5 (+ ⚠ ROW 111) ───────────────────────────────────────────
	// Standalone change. The change screen is ⚠ ANONYMOUS-reachable (200) and
	// username-driven — no session, gated only by the account's current
	// password (row 111). A wrong current password is refused; the correct one
	// succeeds, and afterwards only the new password logs in.
	test(
		'standalone change (row 111 anonymous): wrong current password refused, correct succeeds',
		{tag: '@regression'},
		async ({page, pkpApi}) => {
			const {journal, username, password} = await seedUser(pkpApi, {prefix: 'pwss'});
			const pw = new PasswordFlowsPage(page);
			const NEW = 'Self-New-123';

			// ⚠ ROW 111: anonymous GET renders the form (200, not 404), with no
			// session — the change surface is reachable by any anonymous visitor.
			const resp = await page.goto(`/index.php/${journal}/login/changePassword`, {
				waitUntil: 'commit',
			});
			expect(resp?.status(), 'changePassword is anonymously reachable (row 111)').toBe(200);
			await expect(pw.changeForm).toBeVisible();

			// Wrong current password → refused, nothing changes.
			await pw.submitChange({username, oldPassword: 'totally-wrong', newPassword: NEW});
			await expect(pw.formErrors).toContainText(/current password you entered was incorrect/i);

			// Correct current password → succeeds (savePassword logs in + home).
			await pw.gotoChangePassword(journal);
			await pw.submitChange({username, oldPassword: password, newPassword: NEW});
			await page.waitForURL((u) => !u.pathname.includes('/login'), {waitUntil: 'commit'});
			await expect(page).not.toHaveURL(/\/login/);

			// Afterwards only the new password logs in.
			await page.goto(`/index.php/${journal}/login/signOut`);
			const login = new LoginPage(page);
			await login.login(username, password, journal); // old
			await expect(login.error).toBeVisible();

			await login.login(username, NEW, journal); // new
			await page.waitForURL((u) => !u.pathname.includes('/login'), {waitUntil: 'commit'});
			await expect(page).not.toHaveURL(/\/login/);
		},
	);

	// ── Scenario 6 (change form) ────────────────────────────────────────────
	// Password rules on the change form. A new password shorter than the site
	// minimum (6) is rejected; a new/repeat mismatch is rejected; in both cases
	// the password is left unchanged (the original still logs in). ⚠ ROW 110:
	// this form's length check is `FormValidatorLength` (length only) — the
	// breach check the reset/profile forms apply is absent (code-level, see the
	// header note); the length rule itself is exercised here.
	test(
		'password rules on the change form: too-short and mismatch rejected, password unchanged',
		{tag: '@regression'},
		async ({page, pkpApi}) => {
			const {journal, username, password} = await seedUser(pkpApi, {prefix: 'pwrule'});
			const pw = new PasswordFlowsPage(page);

			// Too short (< 6) → length error.
			await pw.gotoChangePassword(journal, username);
			await pw.submitChange({username, oldPassword: password, newPassword: 'ab', repeat: 'ab'});
			await expect(pw.formErrors).toContainText(/at least 6 characters/i);

			// New/repeat mismatch → "passwords do not match".
			await pw.gotoChangePassword(journal, username);
			await pw.submitChange({
				username,
				oldPassword: password,
				newPassword: 'Mismatch-123',
				repeat: 'Different-456',
			});
			await expect(pw.formErrors).toContainText(/passwords do not match/i);

			// Nothing changed: the original password still logs in.
			const login = new LoginPage(page);
			await login.login(username, password, journal);
			await page.waitForURL((u) => !u.pathname.includes('/login'), {waitUntil: 'commit'});
			await expect(page).not.toHaveURL(/\/login/);
		},
	);
});
