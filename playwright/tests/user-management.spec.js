// @ts-check
const {test, expect} = require('../support/fixtures.js');
const {
	UserManagementPage,
} = require('../../lib/pkp/playwright/pages/UserManagementPage.js');

/**
 * User management — the MANAGER side of user administration (Settings →
 * Users & Roles). One test per canonical scenario of
 * docs/product/specs/user-management.md (11 named), landed at 10 here by
 * folding masthead-toggle (scenario 10) into the remove-role test (both are
 * the invitation-page `/users` PUTs) and the mass-notify tab (scenario 8) into
 * the grid test as a "Notify tab absent" sub-assertion (bulk emails off by
 * default → hidden, spec Rule 9).
 *
 * WHAT IS DRIVEN LIVE (this is the manager WRITE + auth surface):
 *   - The REAL Vue user-access-manager grid: it lists the journal's users,
 *     the search box narrows it, and the per-row More-Actions menu offers
 *     Email / Disable / Remove / Merge.
 *   - The REAL legacy AjaxModal row actions: Disable + reason / Enable, and
 *     Remove-from-journal (confirm dialog) driven through the actual UI.
 *   - The classic add-user + edit forms (UserDetailsForm, no Vue button in
 *     3.6 — the create path is the invitation flow) driven at the legacy grid
 *     endpoint the manager UI's row actions POST to (`update-user`), plus the
 *     second-step role form (`update-user-roles`).
 *   - The `/users` REST endpoints this feature owns: endRole (+ removal mail),
 *     masthead (Author→200+mail, Reviewer→400), report CSV, and the read feed
 *     with role/status filters.
 *   - The two ⚠ Known deviations: row 112 (emailing a DISABLED user 500s — the
 *     Email action is still offered on the disabled row) and row 113 (the users
 *     report is API-only — a valid CSV with no UI download control).
 * Effects are asserted through the users REST API (roleIds/disabled/deleted),
 * Mailpit (welcome / removal / masthead / direct emails, scoped by the unique
 * throwaway recipient), the 500s, and the CSV.
 *
 * AUTH: `test.use({user:'dbarnes'})` — the default page is the journal MANAGER
 * (dbarnes), who is enrolled as `manager` of each test's own scratch journal so
 * the administration-scope guard grants him FULL rights over its throwaway
 * users. `page.request` shares his session cookie for the authenticated HTTP
 * ops; CSRF is read from the loaded page. The permission-boundary test opens
 * non-manager contexts (jjanssen reviewer, atester author) via `asUser`.
 *
 * PARALLEL + isolation: every test seeds its OWN scratch journal (unique tag)
 * with dbarnes-as-manager + UNIQUE throwaway users, so ALL destructive ops
 * (disable / remove-role / remove-user / merge) touch throwaway accounts only,
 * never a seeded user, and never the shared publicknowledge journal (the
 * boundary test only READS publicknowledge). Every email is scoped to a unique
 * throwaway recipient; no test clears Mailpit. The row-action mail is sent
 * synchronously in-request → reaches Mailpit immediately → parallel-safe at the
 * flat root.
 */

const ROLE_ID_MANAGER = 16;
const ROLE_ID_REVIEWER = 4096;
const ROLE_ID_AUTHOR = 65536;
const MANAGER = 'dbarnes';
const MANAGER_EMAIL = 'dbarnes@mailinator.com';

/** A unique, hyphenless, lowercased alphanumeric token (parallel + re-run isolation). */
function uniqueTag(prefix = 'um') {
	const workerIndex = test.info().parallelIndex;
	const rand = Math.random().toString(36).slice(2, 8);
	return `${prefix}${workerIndex}x${rand}`;
}

/**
 * A throwaway user spec for the context scenario (a NEW account created because
 * it carries a `password`). Username/email are tag-unique so destructive ops
 * and mail scoping never collide across parallel workers or re-runs.
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
 * Seed a scratch journal with dbarnes-as-manager + throwaway users and return
 * its context ({id, path, ...}). dbarnes managing the journal is what grants
 * him FULL administration scope over the throwaway users.
 */
async function seedJournal(pkpApi, tag, throwaways) {
	const {context} = await pkpApi.createJournal({
		tag,
		users: [{username: MANAGER, roles: ['manager']}, ...throwaways],
	});
	return context;
}

function legacyOp(path, op) {
	return `/index.php/${path}/$$$call$$$/grid/settings/user/user-grid/${op}`;
}

function usersApi(path, query = '') {
	return `/index.php/${path}/api/v1/users${query ? `?${query}` : ''}`;
}

/** Read the session CSRF token from a loaded backend page. */
async function csrfToken(page) {
	await page.waitForFunction(
		() =>
			!!window.pkp?.currentUser?.csrfToken ||
			!!document.querySelector('meta[name="csrf-token"]'),
		null,
		{timeout: 15_000},
	);
	return page.evaluate(
		() =>
			window.pkp?.currentUser?.csrfToken ||
			document
				.querySelector('meta[name="csrf-token"]')
				?.getAttribute('content'),
	);
}

/** POST url-encoded fields to a legacy user-grid op (adds csrfToken). */
async function postLegacy(page, path, op, csrf, fields) {
	const res = await page.request.post(legacyOp(path, op), {
		form: {csrfToken: csrf, ...fields},
	});
	const text = await res.text();
	let json = null;
	try {
		json = JSON.parse(text);
	} catch {
		/* non-JSON (error page) — leave json null */
	}
	return {status: res.status(), ok: res.ok(), json, text};
}

/** Look a user up on a journal's `/users` feed by exact username. */
async function apiUserByName(page, path, username) {
	const res = await page.request.get(
		usersApi(
			path,
			`searchPhrase=${encodeURIComponent(username)}&status=all&includePermissions=true&count=50`,
		),
	);
	expect(res.ok(), `users feed ${res.status()}`).toBeTruthy();
	const body = await res.json();
	return (
		(body.items || []).find(
			(u) => String(u.userName).toLowerCase() === username.toLowerCase(),
		) || null
	);
}

/** GET a single user; returns {status, body}. (404s for disabled users.) */
async function apiUserById(page, path, id) {
	const res = await page.request.get(`/index.php/${path}/api/v1/users/${id}`);
	return {status: res.status(), body: res.ok() ? await res.json() : null};
}

/** The `groups[]` entry for a role id (id=userGroupId, userUserGroupId, dateEnd, masthead). */
function groupByRole(user, roleId) {
	return (user?.groups || []).find((g) => g.roleId === roleId);
}

const usernamesOf = (feed) => (feed.items || []).map((u) => u.userName);

test.use({user: MANAGER});

test.describe('User management — manager-side administration', () => {
	// ── Scenario 1 (+ 8) — search / filter the users list ─────────────────────
	// The manager opens Users & Roles, the Vue grid lists the journal's users,
	// the search box narrows it to one, and the API role/status filters narrow
	// the feed. The Notify tab is absent (bulk emails off by default → Rule 9).
	test(
		'lists, searches and filters the users grid (Notify tab absent)',
		{tag: '@smoke'},
		async ({page, pkpApi}) => {
			const tag = uniqueTag();
			const alice = throwaway(tag, 'alice', ['author', 'reviewer']);
			const bob = throwaway(tag, 'bob', ['author']);
			const ctx = await seedJournal(pkpApi, tag, [alice, bob]);

			const pom = new UserManagementPage(page, ctx.path);
			await pom.goto();

			// Vue grid lists the throwaway users.
			await expect(pom.rowFor(alice.email)).toBeVisible();
			await expect(pom.rowFor(bob.email)).toBeVisible();

			// Mass-notify tab hidden while bulk emails are off (scenario 8).
			await expect(pom.notifyTab).toHaveCount(0);

			// Search box narrows to the one match (name/email/username phrase).
			await pom.search(alice.username);
			await expect(pom.rowFor(alice.email)).toBeVisible();
			await expect(pom.rowFor(bob.email)).toHaveCount(0);

			// API role filter narrows to reviewers only…
			const reviewers = await (
				await page.request.get(usersApi(ctx.path, `roleIds=${ROLE_ID_REVIEWER}&status=all`))
			).json();
			expect(usernamesOf(reviewers)).toContain(alice.username);
			expect(usernamesOf(reviewers)).not.toContain(bob.username);

			// …and authors include both throwaways.
			const authors = await (
				await page.request.get(usersApi(ctx.path, `roleIds=${ROLE_ID_AUTHOR}&status=all`))
			).json();
			expect(usernamesOf(authors)).toEqual(
				expect.arrayContaining([alice.username, bob.username]),
			);

			// Status filter: nobody disabled yet.
			const disabled = await (
				await page.request.get(usersApi(ctx.path, 'status=disabled'))
			).json();
			expect(disabled.itemsMax).toBe(0);
		},
	);

	// ── Scenario 2 — create a user + the welcome email ────────────────────────
	// The classic add-user form (UserDetailsForm) has no Vue button in 3.6, so
	// the manager UI drives its legacy `update-user` endpoint: it creates the
	// account, returns the second-step role form, and — Send-notification on —
	// delivers the "Journal Registration" welcome mail from the manager's own
	// address. New accounts default to must-change-password.
	test(
		'creates a user (welcome email) and assigns a role',
		{tag: '@smoke'},
		async ({page, pkpApi, pkpMail}) => {
			const tag = uniqueTag();
			const seed = throwaway(tag, 'seed', ['author']);
			const ctx = await seedJournal(pkpApi, tag, [seed]);

			const pom = new UserManagementPage(page, ctx.path);
			await pom.goto();
			const csrf = await csrfToken(page);

			// The Author user-group id for this scratch journal.
			const authorGid = groupByRole(
				await apiUserByName(page, ctx.path, seed.username),
				ROLE_ID_AUTHOR,
			).id;

			const username = `${tag}newton`;
			const email = `${username}@mailinator.com`;
			const created = await postLegacy(page, ctx.path, 'update-user', csrf, {
				username,
				password: `${username}pw1`,
				password2: `${username}pw1`,
				'givenName[en]': 'Newton',
				'familyName[en]': `T${tag}`,
				email,
				country: 'US',
				sendNotify: '1',
				mustChangePassword: '1',
			});
			expect(created.ok).toBeTruthy();
			expect(created.json?.status).toBe(true);

			// The welcome mail — "Journal Registration", from the manager.
			const [welcome] = await pkpMail.find({
				to: email,
				contains: 'Journal Registration',
			});
			expect(welcome.Subject).toContain('Journal Registration');
			expect(welcome.From.Address).toBe(MANAGER_EMAIL);

			// Second step: assign the Author role from the returned role form.
			const newId = created.json.content.match(
				/name="userId"[^>]*value="(\d+)"/,
			)[1];
			const roled = await postLegacy(page, ctx.path, 'update-user-roles', csrf, {
				userId: newId,
				'userGroupIds[]': authorGid,
			});
			expect(roled.json?.status).toBe(true);

			// The account now surfaces on the grid feed with the Author role and
			// the must-change-password default.
			const user = await apiUserByName(page, ctx.path, username);
			expect(user).not.toBeNull();
			expect((user.groups || []).map((g) => g.roleId)).toContain(ROLE_ID_AUTHOR);
			const single = await apiUserById(page, ctx.path, Number(newId));
			expect(single.body.mustChangePassword).toBe(true);
		},
	);

	// ── Scenario 3 — edit another user's details ──────────────────────────────
	// The manager loads UserDetailsForm on a throwaway and changes their profile
	// (family name + affiliation); the edit persists on the users record.
	test('edits another user\'s details (persists)', async ({page, pkpApi}) => {
		const tag = uniqueTag();
		const ed = throwaway(tag, 'edith', ['author']);
		const ctx = await seedJournal(pkpApi, tag, [ed]);

		const pom = new UserManagementPage(page, ctx.path);
		await pom.goto();
		const csrf = await csrfToken(page);

		const user = await apiUserByName(page, ctx.path, ed.username);
		const authorGid = groupByRole(user, ROLE_ID_AUTHOR).id;
		const newFamily = `Edited${tag}`;
		const newAffiliation = `Institute ${tag}`;

		const res = await postLegacy(page, ctx.path, 'update-user', csrf, {
			userId: user.id,
			'givenName[en]': 'Edith',
			'familyName[en]': newFamily,
			'affiliation[en]': newAffiliation,
			email: ed.email,
			country: 'CA',
			'userGroupIds[]': authorGid,
		});
		expect(res.status).toBe(200);

		const after = await apiUserById(page, ctx.path, user.id);
		expect(after.body.familyName.en).toBe(newFamily);
		expect(after.body.country).toBe('CA');
		expect(after.body.affiliation.en).toContain(tag);
	});

	// ── Scenario 4 — disable then re-enable an account (+ reason) ──────────────
	// Driven through the REAL grid row action → legacy AjaxModal. Disabling with
	// a reason persists (the user surfaces under status=disabled); re-enabling
	// clears the disabled flag but RETAINS the stored reason.
	test(
		'disables (with reason) then re-enables a user via the grid modal',
		{tag: '@smoke'},
		async ({page, pkpApi}) => {
			const tag = uniqueTag();
			const dan = throwaway(tag, 'dan', ['author', 'reviewer']);
			const ctx = await seedJournal(pkpApi, tag, [dan]);
			const user = await apiUserByName(page, ctx.path, dan.username);

			const pom = new UserManagementPage(page, ctx.path);
			await pom.goto();

			const reason = `Disabled for ${tag}`;
			await pom.disableUser(pom.rowFor(dan.email), reason);

			// A disabled user 404s on GET /users/{id}; assert via the status filter.
			const disabledFeed = await (
				await page.request.get(
					usersApi(ctx.path, `status=disabled&searchPhrase=${dan.username}`),
				)
			).json();
			expect(disabledFeed.itemsMax).toBe(1);
			expect(disabledFeed.items[0].disabled).toBe(true);

			// Re-enable (row menu now offers "Enable User").
			await pom.enableUser(pom.rowFor(dan.email));
			const after = await apiUserById(page, ctx.path, user.id);
			expect(after.body.disabled).toBe(false);
			expect(after.body.disabledReason).toContain(tag); // reason retained
		},
	);

	// ── Scenario 5 (+ 10) — remove one role (+ notify) and toggle masthead ─────
	// The invitation-page `/users` PUTs this feature owns: endRole end-dates one
	// assignment (other roles untouched) and emails "removed from a role";
	// masthead toggles an Author assignment (200 + mail) but rejects a Reviewer
	// assignment (400).
	test('ends one role (+ removal email) and toggles masthead (Author 200 / Reviewer 400)', async ({
		page,
		pkpApi,
		pkpMail,
	}) => {
		const tag = uniqueTag();
		const ray = throwaway(tag, 'ray', ['author', 'reviewer']);
		const ctx = await seedJournal(pkpApi, tag, [ray]);

		const pom = new UserManagementPage(page, ctx.path);
		await pom.goto();
		const csrf = await csrfToken(page);

		const user = await apiUserByName(page, ctx.path, ray.username);
		const authorGroup = groupByRole(user, ROLE_ID_AUTHOR);
		const reviewerGroup = groupByRole(user, ROLE_ID_REVIEWER);
		const put = (url, data) =>
			page.request.put(url, {
				headers: {'X-Csrf-Token': csrf, 'Content-Type': 'application/json'},
				data,
			});
		const base = `/index.php/${ctx.path}/api/v1/users/${user.id}`;

		// Masthead: Author assignment toggles on → 200 + mail.
		const mAuthor = await put(`${base}/masthead/${authorGroup.userUserGroupId}`, {
			masthead: true,
		});
		expect(mAuthor.status()).toBe(200);
		const [mastheadMail] = await pkpMail.find({
			to: ray.email,
			contains: 'masthead visibility',
		});
		expect(mastheadMail.From.Address).toBe(MANAGER_EMAIL);

		// Masthead: Reviewer assignment cannot be changed → 400.
		const mReviewer = await put(
			`${base}/masthead/${reviewerGroup.userUserGroupId}`,
			{masthead: true},
		);
		expect(mReviewer.status()).toBe(400);
		expect((await mReviewer.json()).error).toMatch(/reviewer/i);

		// End the Author role → 200, removal mail, Reviewer role untouched.
		const ended = await page.request.put(`${base}/endRole/${authorGroup.id}`, {
			headers: {'X-Csrf-Token': csrf},
		});
		expect(ended.status()).toBe(200);
		const [removalMail] = await pkpMail.find({
			to: ray.email,
			contains: 'removed from a role',
		});
		expect(removalMail.From.Address).toBe(MANAGER_EMAIL);

		const after = await apiUserById(page, ctx.path, user.id);
		expect(groupByRole(after.body, ROLE_ID_AUTHOR).dateEnd).not.toBeNull();
		expect(groupByRole(after.body, ROLE_ID_REVIEWER).dateEnd).toBeNull();
	});

	// ── Scenario 6 — remove a user from the journal (all roles, no email) ──────
	// Driven through the REAL grid Remove action + confirm dialog: it end-dates
	// EVERY active role at once and sends NO email (distinct from single-role
	// endRole). The account survives with no active role here.
	test('removes a user from the journal via the grid (all roles ended, no email)', async ({
		page,
		pkpApi,
		pkpMail,
	}) => {
		const tag = uniqueTag();
		const rem = throwaway(tag, 'remy', ['author', 'reviewer']);
		const ctrl = throwaway(tag, 'ctrl', ['author']);
		const ctx = await seedJournal(pkpApi, tag, [rem, ctrl]);
		const remUser = await apiUserByName(page, ctx.path, rem.username);
		const ctrlUser = await apiUserByName(page, ctx.path, ctrl.username);

		const pom = new UserManagementPage(page, ctx.path);
		await pom.goto();
		const csrf = await csrfToken(page);

		await pom.removeUserFromJournal(pom.rowFor(rem.email));

		// Account survives (not deleted); every role is end-dated.
		const after = await apiUserById(page, ctx.path, remUser.id);
		expect(after.status).toBe(200);
		const active = (after.body.groups || []).filter((g) => g.dateEnd === null);
		expect(active).toHaveLength(0);

		// No mail was sent for the removal — bound the negative with a control
		// direct-email to a different throwaway that we DO send afterwards.
		const marker = `ctrlmail${tag}`;
		const control = await postLegacy(page, ctx.path, 'send-email', csrf, {
			userId: ctrlUser.id,
			subject: `Control ${marker}`,
			message: `Control body ${marker}`,
		});
		expect(control.json?.status).toBe(true);
		await pkpMail.expectNone({
			to: rem.email,
			afterControl: {to: ctrl.email, contains: marker},
		});
	});

	// ── Scenario 7 (+ row 112 ⚠) — email one user; disabled target 500s ────────
	// Emailing an ENABLED user delivers from the manager's own address. The
	// Email row action is STILL offered on a DISABLED account (verified on the
	// live row menu), but UserEmailForm loads the recipient without allowDisabled
	// → null → HTTP 500 on both opening (edit-email) and sending (send-email).
	test(
		'emails an enabled user (delivered) but 500s on a disabled user (row 112)',
		{tag: '@smoke'},
		async ({page, pkpApi, pkpMail}) => {
			const tag = uniqueTag();
			const en = throwaway(tag, 'ella', ['author']);
			const dis = throwaway(tag, 'dora', ['author']);
			const ctx = await seedJournal(pkpApi, tag, [en, dis]);
			const enUser = await apiUserByName(page, ctx.path, en.username);
			const disUser = await apiUserByName(page, ctx.path, dis.username);

			const pom = new UserManagementPage(page, ctx.path);
			await pom.goto();
			const csrf = await csrfToken(page);

			// Disable `dora`, then reload so the grid reflects it.
			const disabled = await postLegacy(page, ctx.path, 'disable-user', csrf, {
				userId: disUser.id,
				enable: '',
				disableReason: `off ${tag}`,
			});
			expect(disabled.json?.status).toBe(true);
			await pom.goto();

			// The Email action is OFFERED even on the disabled row (row 112 premise),
			// which the menu confirms is a disabled account ("Enable User" present).
			const disLabels = await pom.rowActionLabels(pom.rowFor(dis.email));
			expect(disLabels).toContain('Email');
			expect(disLabels).toContain('Enable User');
			await pom.closeRowMenu();

			// Email the ENABLED user → delivered from the manager's own address.
			const sent = await postLegacy(page, ctx.path, 'send-email', csrf, {
				userId: enUser.id,
				subject: `Hello ${tag}`,
				message: `A direct message ${tag}`,
			});
			expect(sent.json?.status).toBe(true);
			const [msg] = await pkpMail.find({to: en.email, contains: tag});
			expect(msg.From.Address).toBe(MANAGER_EMAIL);

			// Row 112: emailing the DISABLED user 500s on both endpoints.
			const editDisabled = await page.request.get(
				`${legacyOp(ctx.path, 'edit-email')}?rowId=${disUser.id}`,
			);
			expect(editDisabled.status()).toBe(500);
			const sendDisabled = await postLegacy(page, ctx.path, 'send-email', csrf, {
				userId: disUser.id,
				subject: 'x',
				message: 'y',
			});
			expect(sendDisabled.status).toBe(500);
		},
	);

	// ── Scenario 9 — merge two accounts (destructive, two-step) ───────────────
	// The two-step merge: the first call re-renders the grid as a "merge into
	// user" picker; confirming reassigns the source's work to the target and
	// DELETES the source (404 after). Throwaway accounts only.
	test('merges one account into another (source deleted)', async ({page, pkpApi}) => {
		const tag = uniqueTag();
		const src = throwaway(tag, 'src', ['author']);
		const tgt = throwaway(tag, 'tgt', ['author']);
		const ctx = await seedJournal(pkpApi, tag, [src, tgt]);
		const srcUser = await apiUserByName(page, ctx.path, src.username);
		const tgtUser = await apiUserByName(page, ctx.path, tgt.username);

		const pom = new UserManagementPage(page, ctx.path);
		await pom.goto();
		const csrf = await csrfToken(page);

		// Step 1: pick a target — the op re-renders the user grid as the picker.
		const picker = await postLegacy(page, ctx.path, 'merge-users', csrf, {
			oldUserId: srcUser.id,
		});
		expect(picker.status).toBe(200);

		// Step 2: confirm — reassigns + deletes the source.
		const merged = await postLegacy(page, ctx.path, 'merge-users', csrf, {
			oldUserId: srcUser.id,
			newUserId: tgtUser.id,
		});
		expect(merged.json?.status).toBe(true);

		// Source is gone (404); target survives.
		expect((await apiUserById(page, ctx.path, srcUser.id)).status).toBe(404);
		expect((await apiUserById(page, ctx.path, tgtUser.id)).status).toBe(200);
	});

	// ── Scenario 12 / row 113 ⚠ — the users report is API-only ────────────────
	// GET /users/report streams a valid CSV (per-role Yes/No columns) but NO UI
	// control surfaces it anywhere in the 3.6 users manager.
	test('serves the users report CSV at the API with no UI download control (row 113)', async ({
		page,
		pkpApi,
	}) => {
		const tag = uniqueTag();
		const rep = throwaway(tag, 'reba', ['author']);
		const ctx = await seedJournal(pkpApi, tag, [rep]);

		const pom = new UserManagementPage(page, ctx.path);
		await pom.goto();

		// No template/manager references /users/report → no UI download control.
		await expect(page.locator('a[href*="users/report"]')).toHaveCount(0);

		const res = await page.request.get(
			`/index.php/${ctx.path}/api/v1/users/report`,
		);
		expect(res.status()).toBe(200);
		expect(res.headers()['content-type']).toContain('application/force-download');
		expect(res.headers()['content-disposition']).toContain('.csv');
		const csv = await res.text();
		expect(csv).toContain(','); // comma-separated
		expect(csv).toContain(rep.email); // the throwaway user is in the report
	});

	// ── Scenario 11 — permission boundary ─────────────────────────────────────
	// A non-manager cannot reach the users feed or the management page. A
	// reviewer and an author both get denied at the `/users` API, and the
	// management page bounces to the authorization-denied screen. Read-only on
	// the shared publicknowledge journal (no mutation, parallel-safe).
	test('denies non-managers the users feed and the management page', async ({
		asUser,
	}) => {
		const journal = 'publicknowledge';

		// Reviewer (jjanssen) — API denied.
		const reviewerCtx = await asUser('jjanssen');
		const revApi = await reviewerCtx.request.get(usersApi(journal, 'status=all'));
		expect([401, 403]).toContain(revApi.status());

		// Reviewer — the management page bounces to authorizationDenied.
		const revPage = await reviewerCtx.newPage();
		await revPage.goto(`/index.php/${journal}/management/settings/access`);
		await expect(revPage).toHaveURL(/authorizationDenied|AccessDenied/i);

		// Author (atester) — API denied too.
		const authorCtx = await asUser('atester');
		const authApi = await authorCtx.request.get(usersApi(journal, 'status=all'));
		expect([401, 403]).toContain(authApi.status());
	});
});
