// @ts-check
const path = require('path');
const {test, expect} = require('../support/fixtures.js');
const {UserProfilePage} = require('../../lib/pkp/playwright/pages/UserProfilePage.js');
const {LoginPage} = require('../../lib/pkp/playwright/pages/LoginPage.js');

/**
 * User profile — self-service account management.
 * One test per canonical scenario of docs/product/specs/user-profile.md
 * (8 named), landed at 7 here: scenarios 5 (reviewer interests) and 5-roles
 * (self-service roles) are merged into one Roles-tab test, everything else
 * maps 1:1. Every test drives the REAL legacy `ProfileTabHandler` tabset at
 * `/{journal}/user/profile` end-to-end — there is no self-service `/users`
 * REST endpoint (that API is manager-gated, owned by user-management).
 *
 * WHAT IS DRIVEN LIVE (this is the logged-in WRITE + auth flow — the point):
 *   - Identity: preferredPublicName + avatar initials → save → persist on reload.
 *   - Contact: affiliation/country/phone/working-language written IMMEDIATELY;
 *     an email change is DEFERRED — the stored email stays put, the field goes
 *     read-only with a "pending change" notice, and a "Confirm account contact
 *     email change request" mail is delivered to the CURRENT (old) address
 *     (Mailpit, scoped by the throwaway recipient).
 *   - Public profile: biography + homepage URL persist; an invalid URL is
 *     rejected (client-side FBV url validator, no POST); a ≤150×150 profile
 *     image uploads and renders.
 *   - Roles: the self-registerable Author group is self-granted here (broader
 *     than the register form — spec Rule 5) and verified through the users REST
 *     API (user_user_groups); a reviewing-interest tag persists.
 *   - Notifications: an on-screen + email preference toggle rewrites the
 *     blocked/emailed subscription sets and persists.
 *   - Password (the STRONGER, auth-gated form — contrast password-flows'
 *     anonymous /login/changePassword): a wrong current password and a
 *     new==old password are BOTH rejected inline; a valid change succeeds and
 *     the NEW password then logs in while the old one no longer does.
 *   - API key: Generate produces a JWT-encoded token; the Delete action clears
 *     it (native confirm() accepted).
 *
 * AUTH: this file sets NO `test.use({user})`, so the default `page` is a fresh
 * ANONYMOUS context per test; each test logs in via the real login form as its
 * OWN throwaway user. The profile requires auth. The roles test additionally
 * opens a throwaway admin context (`asUser('admin')`) to read the users API.
 *
 * PARALLEL: every test seeds its own scratch journal + a UNIQUE throwaway user
 * via the scenario API (a seeded user's identity/password/email is NEVER
 * touched — those mutations would break the cached auth state siblings rely
 * on). The email-change confirmation mail is sent SYNCHRONOUSLY
 * (Invitation::invite → Mail::send, not queued), so no queue drain is needed;
 * Mailpit reads are scoped by the unique throwaway recipient (never clearAll).
 * Nothing flips a global config → this file is parallel-safe at the flat root.
 */

const ROLE_ID_AUTHOR = 65536;
const IMAGE_FIXTURE = path.resolve(
	__dirname,
	'../../lib/pkp/playwright/fixtures/files/dependent-image.png',
);

/** A unique, hyphenless, lowercased alphanumeric token (parallel + re-run
 *  isolation; also a valid <=32-char journal urlPath and username). */
function uniqueTag(prefix = 'up') {
	const workerIndex = test.info().parallelIndex;
	const rand = Math.random().toString(36).slice(2, 8);
	return `${prefix}${workerIndex}x${rand}`;
}

/**
 * Seed a scratch journal (default groups → Reader/Author/External Reviewer all
 * permit self-registration) with one throwaway user carrying a known password.
 * Returns the credentials + journal path. The scenario `users[]` passthrough
 * creates the user when the username is new — no seeded user is touched.
 *
 * @returns {Promise<{journal: string, username: string, email: string, password: string}>}
 */
async function seedUser(pkpApi, {prefix = 'up', roles = ['reader']} = {}) {
	const tag = uniqueTag(prefix);
	const email = `${tag}@example.test`;
	const password = 'Initial-Pass-123';
	await pkpApi.createJournal({
		tag,
		path: tag,
		name: {en: `UP ${tag}`},
		primaryLocale: 'en',
		supportedLocales: ['en'],
		users: [{username: tag, password, email, roles}],
	});
	return {journal: tag, username: tag, email, password};
}

/** Log in through the real login form inside the user's own journal context. */
async function loginAs(page, {journal, username, password}) {
	const login = new LoginPage(page);
	await login.login(username, password, journal);
	await page.waitForURL((u) => !u.pathname.includes('/login'), {
		waitUntil: 'commit',
		timeout: 15_000,
	});
}

/** Look up a user by exact username via the users REST API (admin context). */
async function findUser(adminRequest, journal, username) {
	const res = await adminRequest.get(
		`/index.php/${journal}/api/v1/users?searchPhrase=${encodeURIComponent(username)}&count=10`,
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

test.describe('User profile — self-service account management', () => {
	// ── Scenario 1 ──────────────────────────────────────────────────────────
	// Edit identity. The user changes Preferred Public Name (and avatar
	// initials) on the Identity tab and saves; both persist on reload. First
	// name stays required in the primary locale (multilingual `[en]` fields).
	test(
		'edits identity — preferred public name + avatar initials persist',
		{tag: '@smoke'},
		async ({page, pkpApi}) => {
			const creds = await seedUser(pkpApi, {prefix: 'upid'});
			await loginAs(page, creds);
			const profile = new UserProfilePage(page, creds.journal);
			const publicName = `PrefName ${creds.username}`;

			await profile.goto('identity');
			await profile.fillField('identity', 'preferredPublicName[en]', publicName);
			await profile.fillField('identity', 'preferredAvatarInitials', 'pk'); // upper-cased on save
			await profile.save('identity');

			await profile.reload('identity');
			await expect(
				profile.field('identity', 'preferredPublicName[en]'),
			).toHaveValue(publicName);
			// Avatar initials are upper-cased server-side (Str::upper on save).
			await expect(
				profile.field('identity', 'preferredAvatarInitials'),
			).toHaveValue('PK');
			// First name remains present + required in the primary locale.
			await expect(profile.field('identity', 'givenName[en]')).not.toHaveValue('');
		},
	);

	// ── Scenarios 2 + 3 ─────────────────────────────────────────────────────
	// Edit contact + the DEFERRED email change. Affiliation / country / phone /
	// a working language are written immediately; the email change is held
	// pending — the stored email is unchanged, the field is read-only with a
	// "pending change" notice + Cancel, and a "Confirm account contact email
	// change request" mail lands at the CURRENT (old) address (spec Rule 4).
	test(
		'edits contact details, and an email change is deferred with a confirmation mail to the old address',
		{tag: '@smoke'},
		async ({page, pkpApi, pkpMail}) => {
			const creds = await seedUser(pkpApi, {prefix: 'upct'});
			await loginAs(page, creds);
			const profile = new UserProfilePage(page, creds.journal);
			const affiliation = `Contact University ${creds.username}`;
			const phone = '+1-555-0142';
			const newEmail = `${creds.username}-new@example.test`;

			await profile.goto('contact');
			await profile.fillField('contact', 'affiliation[en]', affiliation);
			await profile.fillField('contact', 'phone', phone);
			await profile.selectField('contact', 'country', 'US');
			// Add a working language (site supports en + fr_CA).
			await profile.form('contact').locator('#locales-fr_CA').check();
			// Change the email in the SAME save — the deferred-email trigger.
			await profile.fillField('contact', 'email', newEmail);
			await profile.save('contact');

			// Contact fields persisted immediately.
			await profile.reload('contact');
			await expect(profile.field('contact', 'affiliation[en]')).toHaveValue(affiliation);
			await expect(profile.field('contact', 'phone')).toHaveValue(phone);
			await expect(profile.field('contact', 'country')).toHaveValue('US');
			await expect(profile.form('contact').locator('#locales-fr_CA')).toBeChecked();

			// Email is DEFERRED: stored value unchanged, field read-only, pending
			// notice + Cancel action rendered.
			await expect(profile.field('contact', 'email')).toHaveValue(creds.email);
			await expect(profile.field('contact', 'email')).toHaveAttribute('readonly', /.*/);
			await expect(profile.form('contact')).toContainText(/requested a change of your email/i);
			await expect(
				profile.form('contact').locator('button[value="cancelPendingEmail"]'),
			).toBeVisible();

			// The confirmation mail went to the CURRENT (old) address; the new
			// address appears in the body (scoped marker), not as a recipient.
			const [msg] = await pkpMail.find({
				to: creds.email,
				contains: newEmail,
				timeoutMs: 15_000,
			});
			expect(msg.Subject).toMatch(/Confirm account contact email change request/i);
		},
	);

	// ── Scenario 4 ──────────────────────────────────────────────────────────
	// Public profile & photo. Biography + a valid homepage URL persist; an
	// invalid URL is rejected (client-side FBV url validator — no POST fires);
	// a ≤150×150 profile image uploads and renders (Delete affordance appears).
	test(
		'public profile — biography + URL persist, an invalid URL is rejected, and an image uploads',
		{tag: '@regression'},
		async ({page, pkpApi}) => {
			const creds = await seedUser(pkpApi, {prefix: 'uppub'});
			await loginAs(page, creds);
			const profile = new UserProfilePage(page, creds.journal);
			const bio = `Bio of ${creds.username} — researcher.`;

			// Invalid URL → rejected client-side; no save round-trip.
			await profile.goto('publicProfile');
			await profile.fillField('publicProfile', 'userUrl', 'not a valid url');
			await profile.clickSaveExpectingClientError('publicProfile');
			await expect(profile.form('publicProfile')).toContainText(/enter a valid URL/i);

			// Valid biography + URL persist.
			await profile.goto('publicProfile');
			await profile.setRichField('publicProfile', 'biography[en]', `<p>${bio}</p>`);
			await profile.fillField('publicProfile', 'userUrl', 'https://example.org/me');
			await profile.save('publicProfile');

			await profile.reload('publicProfile');
			await expect(profile.field('publicProfile', 'userUrl')).toHaveValue(
				'https://example.org/me',
			);
			expect(await profile.getRichField('publicProfile', 'biography[en]')).toContain(bio);

			// A ≤150×150 profile image uploads and renders (own upload op).
			await profile.uploadProfileImage(IMAGE_FIXTURE);
			await expect(profile.profileImage()).toBeVisible();
			await expect(page.locator('#deleteProfileImageForm')).toHaveCount(1);
		},
	);

	// ── Scenario 5 ──────────────────────────────────────────────────────────
	// Reviewer interests & self-service roles. The user self-grants the
	// self-registerable AUTHOR group (broader than the register form — spec
	// Rule 5) and adds a reviewing-interest tag; both persist, and the author
	// enrolment is confirmed through the users REST API (user_user_groups).
	test(
		'roles — self-grants the Author role and adds a reviewing interest',
		{tag: '@regression'},
		async ({page, pkpApi, asUser}) => {
			const creds = await seedUser(pkpApi, {prefix: 'uprl', roles: ['reader']});
			await loginAs(page, creds);
			const profile = new UserProfilePage(page, creds.journal);
			const interest = `reviewinterest-${creds.username}`;

			await profile.goto('roles');
			// Author is NOT yet held (created as a reader).
			await expect(profile.roleCheckbox('author')).not.toBeChecked();
			await profile.roleCheckbox('author').check();
			await profile.addInterest(interest);
			await profile.save('roles');

			// Persisted in-browser: the author box is now ticked, the interest tag
			// is present.
			await profile.reload('roles');
			await expect(profile.roleCheckbox('author')).toBeChecked();
			await expect(profile.interestsWidget()).toContainText(interest);

			// Authoritative: the users API shows the AUTHOR role enrolment.
			const adminCtx = await asUser('admin');
			const user = await findUser(adminCtx.request, creds.journal, creds.username);
			expect(user, 'throwaway user should exist').not.toBeNull();
			expect((user.groups || []).map((g) => g.roleId)).toContain(ROLE_ID_AUTHOR);
		},
	);

	// ── Scenario 6 ──────────────────────────────────────────────────────────
	// Notification preferences. The two switches per type rewrite the emailed
	// and blocked subscription sets respectively; both persist on reload. NB an
	// as-built coupling: unticking a type's on-screen box DISABLES its email box
	// (`enableDisablePairs`), so "blocked on-screen + emailed" is unreachable —
	// the emailed set is exercised on one type (email opt-in, on-screen kept)
	// and the blocked set on another (on-screen blocked).
	test(
		'notification preferences — email opt-in and on-screen block persist',
		{tag: '@regression'},
		async ({page, pkpApi}) => {
			const creds = await seedUser(pkpApi, {prefix: 'upnt'});
			await loginAs(page, creds);
			const profile = new UserProfilePage(page, creds.journal);
			// Type A: opt into email (blocked_emailed set), keep it on-screen.
			const emailA = profile.field('notificationSettings', 'emailNotificationReviewerComment');
			// Type B: block on-screen (blocked_notification set).
			const onScreenB = profile.field('notificationSettings', 'notificationNewQuery');

			await profile.goto('notificationSettings');
			await expect(emailA).not.toBeChecked();
			await expect(onScreenB).toBeChecked();
			await emailA.check();
			await onScreenB.uncheck();
			await profile.save('notificationSettings');

			await profile.reload('notificationSettings');
			// On-screen for type A is still allowed; its email is now opted in.
			await expect(
				profile.field('notificationSettings', 'notificationReviewerComment'),
			).toBeChecked();
			await expect(
				profile.field('notificationSettings', 'emailNotificationReviewerComment'),
			).toBeChecked();
			// Type B is blocked on-screen.
			await expect(
				profile.field('notificationSettings', 'notificationNewQuery'),
			).not.toBeChecked();
		},
	);

	// ── Scenario 7 ──────────────────────────────────────────────────────────
	// Change password (the auth-gated, STRONGER form). A wrong current password
	// and a new==old password are BOTH rejected inline (distinct from
	// password-flows: session-bound, no free-text username, forbids reuse); a
	// valid change succeeds and the NEW password then logs in while the old one
	// no longer does.
	test(
		'password tab — wrong-old and new==old rejected, a valid change logs in with the new password',
		{tag: '@smoke'},
		async ({page, pkpApi}) => {
			const creds = await seedUser(pkpApi, {prefix: 'uppw'});
			await loginAs(page, creds);
			const profile = new UserProfilePage(page, creds.journal);
			const NEW = 'Valid-New-999';

			// Wrong current password → rejected, nothing changes.
			await profile.goto('changePassword');
			await profile.fillField('changePassword', 'oldPassword', 'totally-wrong');
			await profile.fillField('changePassword', 'password', 'BrandNew-123');
			await profile.fillField('changePassword', 'password2', 'BrandNew-123');
			await profile.save('changePassword');
			await expect(profile.form('changePassword')).toContainText(
				/current password you entered was incorrect/i,
			);

			// New password equal to the old → rejected (passwordSameAsOld).
			await profile.goto('changePassword');
			await profile.fillField('changePassword', 'oldPassword', creds.password);
			await profile.fillField('changePassword', 'password', creds.password);
			await profile.fillField('changePassword', 'password2', creds.password);
			await profile.save('changePassword');
			await expect(profile.form('changePassword')).toContainText(
				/new password is the same as your old password/i,
			);

			// Valid change → succeeds.
			await profile.goto('changePassword');
			await profile.fillField('changePassword', 'oldPassword', creds.password);
			await profile.fillField('changePassword', 'password', NEW);
			await profile.fillField('changePassword', 'password2', NEW);
			await profile.save('changePassword');

			// The new password logs in; the old one no longer does.
			await page.goto(`/index.php/${creds.journal}/login/signOut`);
			const login = new LoginPage(page);
			await login.login(creds.username, creds.password, creds.journal); // old
			await expect(login.error).toBeVisible();

			await login.login(creds.username, NEW, creds.journal); // new
			await page.waitForURL((u) => !u.pathname.includes('/login'), {
				waitUntil: 'commit',
			});
			await expect(page).not.toHaveURL(/\/login/);
		},
	);

	// ── Scenario 8 ──────────────────────────────────────────────────────────
	// Generate / reset an API key. Generate produces a JWT-encoded token (the
	// value pasted into Authorization / ?apiToken=); the Delete action clears
	// it (guarded by a native confirm(), accepted here).
	test(
		'API key — generate yields a JWT token, and reset clears it',
		{tag: '@regression'},
		async ({page, pkpApi}) => {
			const creds = await seedUser(pkpApi, {prefix: 'upak'});
			await loginAs(page, creds);
			const profile = new UserProfilePage(page, creds.journal);

			await profile.goto('apiSettings');
			// No key yet: the field shows the "None" placeholder.
			await expect(profile.apiKeyField()).toHaveValue('None');

			// Generate → a JWT-encoded token (three dot-separated base64url parts,
			// header starts "eyJ").
			await profile.submitApiKeyAction('Create API Key');
			const token = await profile.apiKeyField().inputValue();
			expect(token).toMatch(/^eyJ[\w-]+\.[\w-]+\.[\w-]+$/);
			await expect(
				profile.form('apiSettings').getByRole('button', {name: 'Delete', exact: true}),
			).toBeVisible();

			// Reset → the Delete action (native confirm accepted) clears the key.
			page.once('dialog', (d) => d.accept());
			await profile.submitApiKeyAction('Delete');
			await expect(profile.apiKeyField()).toHaveValue('None');
			await expect(
				profile.form('apiSettings').getByRole('button', {name: 'Create API Key', exact: true}),
			).toBeVisible();
		},
	);
});
