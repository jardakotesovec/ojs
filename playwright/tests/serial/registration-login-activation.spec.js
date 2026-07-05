// @ts-check
const {test, expect} = require('../../support/fixtures.js');
const {RegistrationPage} = require('../../../lib/pkp/playwright/pages/RegistrationPage.js');
const {LoginPage} = require('../../../lib/pkp/playwright/pages/LoginPage.js');
const fs = require('fs');
const path = require('path');

/**
 * Registration & login — the SERIAL half: email validation + activation
 * (docs/product/specs/registration-login.md canonical scenario 6). It is the
 * ONE scenario that cannot run in the parallel project: turning it on requires
 * `[email] require_validation = On` — a GLOBAL value in config.test.inc.php,
 * NOT a per-context setting — so the whole server behaves differently while it
 * is set. Flipping it must therefore happen with NO parallel neighbours: this
 * spec lives in the single-worker `serial` project (which also runs AFTER the
 * parallel `ojs` project), flips the config to On for the duration of the one
 * test, and restores it to Off in a `finally` (plus an afterAll safety net) so
 * a crash can never leave every future registration test seeing "pending
 * validation". `php -S` re-reads config on each request, so the flip takes
 * effect on the very next HTTP call.
 *
 * The full lifecycle is driven end-to-end:
 *   register (require_validation on) → account created DISABLED, NO auto-login,
 *   a "Validate Your Account" email lands in Mailpit → a login attempt is
 *   refused ("account disabled") → open the emailed activation link → confirm
 *   on the activation page → account enabled → log in successfully.
 *
 * The validate-email is sent SYNCHRONOUSLY inside the register request
 * (ValidateRegisteredEmail listener → Mail::send, not queued), so no queue
 * drain is needed; Mailpit reads are scoped to the throwaway unique recipient
 * (never clearAll).
 */

const JOURNAL = 'publicknowledge';
const PW = 'Activate-Pass-123';
const CONFIG_PATH = path.resolve(process.cwd(), 'config.test.inc.php');
const REQUIRE_VALIDATION_RE = /^require_validation = (On|Off)$/m;

/** Flip `[email] require_validation` in config.test.inc.php. */
function setRequireValidation(on) {
	const content = fs.readFileSync(CONFIG_PATH, 'utf8');
	if (!REQUIRE_VALIDATION_RE.test(content)) {
		throw new Error(
			`require_validation line not found in ${CONFIG_PATH} — cannot toggle it.`,
		);
	}
	fs.writeFileSync(
		CONFIG_PATH,
		content.replace(REQUIRE_VALIDATION_RE, `require_validation = ${on ? 'On' : 'Off'}`),
	);
}

function currentRequireValidation() {
	const m = fs.readFileSync(CONFIG_PATH, 'utf8').match(REQUIRE_VALIDATION_RE);
	return m ? m[1] : null;
}

function uniqueTag(prefix = 'act') {
	const rand = Math.random().toString(36).slice(2, 8);
	return `${prefix}${rand}`;
}

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

test.describe('Registration & login — email validation + activation (serial)', () => {
	// Safety net: whatever happens, config.test.inc.php must end with
	// require_validation Off (the shipped default the rest of the suite
	// assumes). The in-test finally restores it; this catches a hard crash.
	test.afterAll(() => {
		if (currentRequireValidation() !== 'Off') {
			setRequireValidation(false);
		}
	});

	test(
		'validation-on: registration creates a disabled account, mails an activation link, and activation enables login',
		{tag: ['@regression', '@slow']},
		async ({browser, baseURL, asUser, pkpMail}) => {
			// Sanity: we expect to start from the shipped default.
			expect(currentRequireValidation(), 'config precondition').toBe('Off');

			const tag = uniqueTag();
			const username = `activate${tag}`;
			const email = `activate-${tag}@example.test`;
			const adminCtx = await asUser('admin');

			setRequireValidation(true);
			try {
				// ── Register (validation ON) ──────────────────────────────
				const ctx = await browser.newContext({
					baseURL,
					storageState: {cookies: [], origins: []},
				});
				const page = await ctx.newPage();
				const reg = new RegistrationPage(page);
				await reg.goto(JOURNAL);
				await expect(reg.form).toBeVisible();
				await reg.fill({
					givenName: 'Val',
					familyName: 'Idation',
					affiliation: 'Test University',
					country: 'US',
					email,
					username,
					password: PW,
				});
				await reg.acceptConsent();
				await reg.submitForm();

				// Pending-validation message, NOT auto-login.
				await expect(
					page.getByRole('heading', {name: /awaiting verification/i}),
				).toBeVisible();
				await expect(
					page.getByText(/sent a confirmation email/i),
				).toBeVisible();
				await page.goto(`/index.php/${JOURNAL}/user/profile`);
				await expect(page).toHaveURL(/\/login/); // no session

				// Account exists but is DISABLED.
				const created = await findUser(adminCtx.request, username);
				expect(created, 'account created').not.toBeNull();
				expect(created.disabled, 'account disabled pending validation').toBe(true);

				// ── Login is refused before activation ────────────────────
				const login = new LoginPage(page);
				await login.login(username, PW, JOURNAL);
				await expect(login.error).toBeVisible();
				await expect(page).toHaveURL(/\/login/);

				// ── The activation email + link ───────────────────────────
				const messages = await pkpMail.find({
					to: email,
					contains: 'Validate',
					timeoutMs: 15_000,
				});
				expect(messages.length).toBeGreaterThan(0);
				const full = await pkpMail.fullMessage(messages[0].ID);
				const bodyText = `${full.Text || ''}\n${full.HTML || ''}`;
				const linkMatch = bodyText.match(
					/https?:\/\/[^\s"'<>]*\/invitation\/accept\?[^\s"'<>]*/i,
				);
				expect(linkMatch, 'activation link present in the email').not.toBeNull();
				const activationLink = linkMatch[0].replace(/&amp;/g, '&');

				// ── Open the link → confirm → activated ───────────────────
				await page.goto(activationLink);
				const activateBtn = page.getByRole('link', {name: /Activate Account/i});
				await expect(activateBtn).toBeVisible();
				await activateBtn.click();
				await expect(
					page.getByText(/Thank you for activating your account/i),
				).toBeVisible();

				// Account is now enabled.
				const activated = await findUser(adminCtx.request, username);
				expect(activated.disabled, 'account enabled after activation').toBe(false);

				// ── Login now succeeds ────────────────────────────────────
				await login.login(username, PW, JOURNAL);
				await page.waitForURL((u) => !u.pathname.includes('/login'), {
					waitUntil: 'commit',
				});
				await expect(page).not.toHaveURL(/\/login/);
				await page.goto(`/index.php/${JOURNAL}/user/profile`);
				await expect(page).not.toHaveURL(/\/login/); // live session

				await ctx.close();
			} finally {
				setRequireValidation(false);
			}
		},
	);
});
