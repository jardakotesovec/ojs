// @ts-check
const {test, expect} = require('../support/fixtures.js');
const {
	RolesSettingsPage,
} = require('../../lib/pkp/playwright/pages/RolesSettingsPage.js');

/**
 * Roles & permissions — the user-group DEFINITIONS + the per-group permission
 * matrix + the AUTHZ role gate. One test per canonical scenario of
 * docs/product/specs/roles-permissions.md (12 named), landed at 9 here by
 * folding scenario 3 (self-registration) + scenario 7 (edit role-locked) into
 * the create test (T2), and scenario 11 (AUTHZ base gate) into the permission
 * boundary (T9); the toggle allow-lists (constraint halves of scenarios 3/4/9)
 * get one dedicated matrix test (T3).
 *
 * WHAT IS DRIVEN LIVE (this is the role/group DEFINITION surface — a LEGACY
 * jQuery AJAX grid, `grid.settings.roles.UserGroupGridHandler`, the ONLY live
 * surface for role definitions in 3.6; there is no Vue roles-manager):
 *   - The REAL Roles grid (Settings → Users & Roles → Roles): the seeded user
 *     groups + their role "From" mappings, the Add-Role modal, per-row
 *     Edit/Remove actions, and the per-stage assign/unassign checkboxes — driven
 *     through the RolesSettingsPage POM (lib/pkp).
 *   - The REAL create/edit form (`#userGroupForm` in an AjaxModal): role select
 *     (locked on edit), the five permission toggles and their client-side
 *     role-gated disabled states, and stage checkboxes.
 *   - The same UserGroupGridHandler ops via the `$$$call$$$` legacy path
 *     (page.request + CSRF — the user-management pattern) for deterministic
 *     create/read of the toggle persistence (the /userGroups REST list does NOT
 *     expose the toggles — see the ⚠ contradiction below).
 *   - The Tools → Permissions RESET (`management/tools/resetPermissions`) — which
 *     ⚠ resets article COPYRIGHT/LICENCE, not role permissions.
 *   - The AUTHZ base gate: the roles-grid op is `[MANAGER, SITE_ADMIN]`-only
 *     while the read-only `GET /userGroups` list is deliberately wider.
 *
 * ⚠ SPEC-vs-API contradiction asserted here (NOT a product bug): the read-only
 * `GET /userGroups` resource (UserGroupResource) exposes ONLY {id, roleId,
 * isDefault, name} — it does NOT surface the five permission toggles or the
 * stage ids. So toggle PERSISTENCE cannot be asserted via that API (as a naive
 * reading of the plan suggests); it is asserted via the group's own edit form
 * (initData re-loads the stored toggles), which is the real read-back path.
 *
 * ⚠ KNOWN DEVIATION asserted (T8): the Tools → "Permissions" tool resets every
 * publication's copyright/licence to the journal defaults — it touches NO role,
 * group or per-group toggle despite the "Permissions" label (spec Known
 * deviations). T8 proves the reality: a sentinel-overridden publication's
 * copyright/licence is reset to the journal defaults while a custom user group
 * (and the whole role matrix) survives untouched.
 *
 * AUTH: `test.use({user:'dbarnes'})` — dbarnes is enrolled as `manager` of each
 * test's OWN scratch journal (the default "Journal manager" group carries
 * permitSettings), which is what grants him the Roles grid + Tools. The
 * boundary test opens non-manager contexts (jjanssen reviewer, atester author)
 * via `asUser`, read-only on publicknowledge.
 *
 * PARALLEL + isolation: every mutating test seeds its OWN scratch journal
 * (unique hyphenless tag) — all group create/edit/delete/stage-toggle and the
 * copyright reset touch throwaway groups/publications only, never the shared
 * publicknowledge journal (the boundary test only READS it). No Mailpit. No
 * global config. Fully parallel at the flat root.
 */

const ROLE_ID_MANAGER = 16;
const ROLE_ID_SUB_EDITOR = 17;
const ROLE_ID_ASSISTANT = 4097;
const ROLE_ID_REVIEWER = 4096;
const ROLE_ID_AUTHOR = 65536;
const ROLE_ID_READER = 1048576;
const ROLE_ID_SUBSCRIPTION_MANAGER = 2097152;

const STATUS_PUBLISHED = 3; // PKPSubmission::STATUS_PUBLISHED
const STAGE_REVIEW = 3; // WORKFLOW_STAGE_ID_EXTERNAL_REVIEW

const MANAGER = 'dbarnes';

/** A unique, hyphenless, lowercased alphanumeric token (parallel + re-run isolation). */
function uniqueTag(prefix = 'rp') {
	const workerIndex = test.info().parallelIndex;
	const rand = Math.random().toString(36).slice(2, 8);
	return `${prefix}${workerIndex}x${rand}`;
}

/** Seed a scratch journal with dbarnes-as-manager (+ any extra users) → context. */
async function seedJournal(pkpApi, tag, extraUsers = [], extra = {}) {
	const {context} = await pkpApi.createJournal({
		tag,
		users: [{username: MANAGER, roles: ['manager']}, ...extraUsers],
		...extra,
	});
	return context;
}

/** The legacy user-group grid op URL ($$$call$$$ component path, kebab op). */
function gridOp(path, op) {
	return `/index.php/${path}/$$$call$$$/grid/settings/roles/user-group-grid/${op}`;
}

/** GET /userGroups items for a journal (read-only REST list). */
async function userGroups(request, path) {
	const res = await request.get(`/index.php/${path}/api/v1/userGroups`);
	expect(res.ok(), `GET /userGroups ${res.status()}`).toBeTruthy();
	return (await res.json()).items;
}

/** Find one /userGroups item by its localized (en) name. */
function groupByName(items, name) {
	return items.find((g) => g.name === name) || null;
}

/** Read the session CSRF token from a loaded backend page (window.pkp / meta). */
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

/** POST a group create/update to the legacy grid op (adds csrfToken). */
async function postGroup(page, path, csrf, fields) {
	const res = await page.request.post(gridOp(path, 'update-user-group'), {
		form: {csrfToken: csrf, ...fields},
	});
	const text = await res.text();
	let json = null;
	try {
		json = JSON.parse(text);
	} catch {
		/* non-JSON error page — leave null */
	}
	return {status: res.status(), json, text};
}

/**
 * Create a custom group via the legacy grid handler and return its real id
 * (resolved off the /userGroups list by its unique name). Exercises the exact
 * UserGroupForm::execute() the Add-Role modal drives.
 */
async function createGroup(page, path, csrf, {roleId, name, abbrev, options = {}}) {
	const created = await postGroup(page, path, csrf, {
		roleId: String(roleId),
		'name[en]': name,
		'abbrev[en]': abbrev,
		...options, // e.g. {permitSelfRegistration: '1', masthead: '1'}
	});
	expect(created.json?.status, `create "${name}": ${created.text}`).toBe(true);
	const found = groupByName(await userGroups(page.request, path), name);
	expect(found, `created group "${name}" absent from /userGroups`).not.toBeNull();
	return found.id;
}

/** Fetch a group's edit-form HTML (initData re-loads the stored toggles/stages). */
async function editFormHtml(page, path, id) {
	const res = await page.request.get(
		`${gridOp(path, 'edit-user-group')}?userGroupId=${id}`,
	);
	expect(res.ok(), `edit-user-group ${id}: ${res.status()}`).toBeTruthy();
	return (await res.json()).content || '';
}

/** Is the named checkbox rendered `checked` in a user-group form HTML blob? */
function toggleChecked(html, inputId) {
	const m = html.match(new RegExp(`<input[^>]*id="${inputId}"[^>]*>`));
	if (!m) throw new Error(`toggle "${inputId}" not found in form`);
	return /checked/.test(m[0]);
}

/** Is the role select rendered `disabled` (locked) in a user-group form HTML blob? */
function roleSelectDisabled(html) {
	const m = html.match(/<select[^>]*name="roleId"[^>]*>/);
	if (!m) throw new Error('roleId select not found in form');
	return /disabled/.test(m[0]);
}

test.use({user: MANAGER});

test.describe('Roles & permissions — user-group definitions + AUTHZ gate', () => {
	// ── Scenario 1 — Browse the Roles list ────────────────────────────────────
	// The manager opens Settings → Users & Roles → Roles and sees the seeded user
	// groups: the legacy grid renders with Add-Role + per-row Edit/Remove actions,
	// and the read-only /userGroups list carries each group's role "From" mapping
	// — INCLUDING the naming trap ("Journal editor" → MANAGER, not sub-editor).
	test(
		'lists the seeded user groups with their role mappings (grid + API)',
		{tag: '@smoke'},
		async ({page, pkpApi}) => {
			const tag = uniqueTag();
			const ctx = await seedJournal(pkpApi, tag);

			const pom = new RolesSettingsPage(page);
			await pom.goto(ctx.path);

			// The real grid rendered: Add-Role button + representative seeded rows.
			await expect(pom.createButton).toBeVisible();
			await expect(pom.rowByName('Journal manager')).toBeVisible();
			await expect(pom.rowByName('Reviewer')).toBeVisible();
			await expect(pom.rowByName('Author')).toBeVisible();
			// A seeded row carries its Edit/Remove actions (row id keyed by real
			// user_group_id → non-empty → actions render).
			const reviewerRowId = await pom.resolveActionableRowId('Reviewer');
			await pom.expandRowExtras(reviewerRowId);
			await expect(
				pom.rowActionLink(reviewerRowId, 'editUserGroup'),
			).toHaveCount(1);
			await expect(
				pom.rowActionLink(reviewerRowId, 'removeUserGroup'),
			).toHaveCount(1);

			// The /userGroups list feed: the seeded default groups + role mappings.
			const items = await userGroups(page.request, ctx.path);
			const roleOf = (name) => groupByName(items, name)?.roleId;
			expect(roleOf('Journal manager')).toBe(ROLE_ID_MANAGER);
			expect(roleOf('Section editor')).toBe(ROLE_ID_SUB_EDITOR);
			expect(roleOf('Copyeditor')).toBe(ROLE_ID_ASSISTANT);
			expect(roleOf('Reviewer')).toBe(ROLE_ID_REVIEWER);
			expect(roleOf('Author')).toBe(ROLE_ID_AUTHOR);
			expect(roleOf('Reader')).toBe(ROLE_ID_READER);
			expect(roleOf('Subscription Manager')).toBe(ROLE_ID_SUBSCRIPTION_MANAGER);
			// ⚠ Naming trap: the "Journal editor" group is a MANAGER-role group.
			expect(roleOf('Journal editor')).toBe(ROLE_ID_MANAGER);
			// All seeded groups are default (installed from the registry).
			expect(items.every((g) => g.isDefault === true)).toBe(true);
		},
	);

	// ── Scenario 2 (+ 3, 7) — Create a custom group; toggles persist; role locked
	// The manager clicks Add Role in the REAL grid, picks Author, names it, turns
	// Self-registration + Show-on-masthead on, and saves. The new group appears in
	// the grid + /userGroups as a NON-default group; reopening its Edit form shows
	// the role select DISABLED (role locked, scenario 7) and both toggles still
	// checked (persistence; self-registration is offered for Author, scenario 3).
	test(
		'creates a custom group via the real form; toggles persist; role locked on edit',
		{tag: '@smoke'},
		async ({page, pkpApi}) => {
			test.slow();
			const tag = uniqueTag();
			const ctx = await seedJournal(pkpApi, tag);

			const pom = new RolesSettingsPage(page);
			await pom.goto(ctx.path);

			const name = `Data Curator ${tag}`;
			const form = await pom.openCreateForm();
			await pom.fillRoleForm(form, {
				permissionLevel: 'Author',
				name,
				abbrev: `DC${tag}`,
				options: {permitSelfRegistration: true, masthead: true},
			});
			await pom.saveForm(form);

			// Appears in the grid as a new row…
			await pom.goto(ctx.path);
			await expect(pom.rowByName(name)).toBeVisible();
			// …and in /userGroups as a NON-default Author-role group.
			const created = groupByName(await userGroups(page.request, ctx.path), name);
			expect(created).not.toBeNull();
			expect(created.roleId).toBe(ROLE_ID_AUTHOR);
			expect(created.isDefault).toBe(false);

			// Reopen the Edit modal: role select LOCKED + toggles round-tripped.
			const rowId = await pom.resolveActionableRowId(name);
			const editForm = await pom.openEditForm(rowId);
			await expect(editForm.locator('select[name="roleId"]')).toBeDisabled();
			await expect(
				editForm.locator('input[name="permitSelfRegistration"]'),
			).toBeChecked();
			await expect(editForm.locator('input[name="masthead"]')).toBeChecked();
			// Self-registration is OFFERED (enabled) for the Author role.
			await expect(
				editForm.locator('input[name="permitSelfRegistration"]'),
			).toBeEnabled();
		},
	);

	// ── Scenarios 3/4/9 (constraint halves) — the permission-option allow-lists ─
	// Each toggle is only OFFERED for its role types (the client disables — not
	// hides — the checkbox for any other role). Driven on one Add-Role form by
	// switching the role select and asserting the enabled/disabled matrix:
	//   selfRegistration → Reviewer/Author/Reader · recommendOnly → Manager/SubEd
	//   permitSettings → Manager · permitMetadataEdit → forced-on for Manager.
	test('permission toggles are offered only for their allowed roles', async ({
		page,
		pkpApi,
	}) => {
		test.slow();
		const tag = uniqueTag();
		const ctx = await seedJournal(pkpApi, tag);

		const pom = new RolesSettingsPage(page);
		await pom.goto(ctx.path);
		const form = await pom.openCreateForm();
		const opt = (n) => form.locator(`input[name="${n}"]`);
		const selectRole = (label) =>
			form.locator('select[name="roleId"]').selectOption({label});

		// Author: self-reg + metadata offered; recommendOnly + settings not.
		await selectRole('Author');
		await expect(opt('permitSelfRegistration')).toBeEnabled();
		await expect(opt('permitMetadataEdit')).toBeEnabled();
		await expect(opt('recommendOnly')).toBeDisabled();
		await expect(opt('permitSettings')).toBeDisabled();

		// Reviewer: self-reg offered; recommendOnly + settings not.
		await selectRole('Reviewer');
		await expect(opt('permitSelfRegistration')).toBeEnabled();
		await expect(opt('recommendOnly')).toBeDisabled();
		await expect(opt('permitSettings')).toBeDisabled();

		// Section editor: recommendOnly offered; self-reg + settings not.
		await selectRole('Section Editor');
		await expect(opt('recommendOnly')).toBeEnabled();
		await expect(opt('permitSelfRegistration')).toBeDisabled();
		await expect(opt('permitSettings')).toBeDisabled();

		// Journal manager: recommendOnly + settings offered; metadata FORCED on
		// (disabled + checked); self-reg not offered.
		await selectRole('Journal Manager');
		await expect(opt('recommendOnly')).toBeEnabled();
		await expect(opt('permitSettings')).toBeEnabled();
		await expect(opt('permitMetadataEdit')).toBeDisabled();
		await expect(opt('permitMetadataEdit')).toBeChecked();
		await expect(opt('permitSelfRegistration')).toBeDisabled();
	});

	// ── Scenario 4 (+ 9) — recommendOnly + permitSettings persist; server gating ─
	// The two role-gated toggles round-trip through the real handler: a Section-
	// editor group keeps recommendOnly, a Manager group keeps permitSettings. And
	// the server ENFORCES the allow-list even if a client bypasses the disabled
	// UI: an Author group submitted with recommendOnly + permitSettings drops both.
	test('recommendOnly + permitSettings persist and are server-gated by role', async ({
		page,
		pkpApi,
	}) => {
		test.slow();
		const tag = uniqueTag();
		const ctx = await seedJournal(pkpApi, tag);

		const pom = new RolesSettingsPage(page);
		await pom.goto(ctx.path);
		const csrf = await csrfToken(page);

		// Section editor + recommendOnly → persists.
		const secEd = await createGroup(page, ctx.path, csrf, {
			roleId: ROLE_ID_SUB_EDITOR,
			name: `Recommender ${tag}`,
			abbrev: `RC${tag}`,
			options: {recommendOnly: '1'},
		});
		expect(toggleChecked(await editFormHtml(page, ctx.path, secEd), 'recommendOnly')).toBe(true);

		// Manager + permitSettings → persists.
		const mgr = await createGroup(page, ctx.path, csrf, {
			roleId: ROLE_ID_MANAGER,
			name: `Settings Manager ${tag}`,
			abbrev: `SM${tag}`,
			options: {permitSettings: '1'},
		});
		expect(toggleChecked(await editFormHtml(page, ctx.path, mgr), 'permitSettings')).toBe(true);

		// Author submitted WITH recommendOnly + permitSettings → both dropped
		// (execute() &&-gates each against the role allow-list).
		const author = await createGroup(page, ctx.path, csrf, {
			roleId: ROLE_ID_AUTHOR,
			name: `Gated Author ${tag}`,
			abbrev: `GA${tag}`,
			options: {recommendOnly: '1', permitSettings: '1'},
		});
		const authorHtml = await editFormHtml(page, ctx.path, author);
		expect(toggleChecked(authorHtml, 'recommendOnly')).toBe(false);
		expect(toggleChecked(authorHtml, 'permitSettings')).toBe(false);
	});

	// ── Scenario 5 — permitMetadataEdit: forced-on for Manager, free otherwise ──
	// The metadata-edit flag is FORCED true for the Manager role (regardless of
	// what is submitted) and freely toggled for every other role. (The downstream
	// propagation to existing stage_assignments.can_change_metadata is owned by
	// the submission/publication features — asserted there, not here.)
	test('permitMetadataEdit is forced on for Manager and freely toggled otherwise', async ({
		page,
		pkpApi,
	}) => {
		test.slow();
		const tag = uniqueTag();
		const ctx = await seedJournal(pkpApi, tag);

		const pom = new RolesSettingsPage(page);
		await pom.goto(ctx.path);
		const csrf = await csrfToken(page);

		// Manager group submitted with metadata-edit OFF → stored ON (forced).
		const mgr = await createGroup(page, ctx.path, csrf, {
			roleId: ROLE_ID_MANAGER,
			name: `Forced Editor ${tag}`,
			abbrev: `FE${tag}`,
			options: {}, // permitMetadataEdit intentionally omitted
		});
		expect(toggleChecked(await editFormHtml(page, ctx.path, mgr), 'permitMetadataEdit')).toBe(true);

		// Assistant group with metadata-edit OFF → stays OFF (freely toggled).
		const asst = await createGroup(page, ctx.path, csrf, {
			roleId: ROLE_ID_ASSISTANT,
			name: `Free Assistant ${tag}`,
			abbrev: `FA${tag}`,
			options: {},
		});
		expect(toggleChecked(await editFormHtml(page, ctx.path, asst), 'permitMetadataEdit')).toBe(false);

		// Flip it on for the assistant → persists.
		const flipped = await postGroup(page, ctx.path, csrf, {
			userGroupId: String(asst),
			roleId: String(ROLE_ID_ASSISTANT),
			'name[en]': `Free Assistant ${tag}`,
			'abbrev[en]': `FA${tag}`,
			permitMetadataEdit: '1',
		});
		expect(flipped.json?.status).toBe(true);
		expect(toggleChecked(await editFormHtml(page, ctx.path, asst), 'permitMetadataEdit')).toBe(true);
	});

	// ── Scenario 6 — Stage assignments + the per-role guard-rails ──────────────
	// The manager toggles which workflow stages a group works in, via the grid's
	// per-cell assign/unassign checkboxes (an immediate AjaxAction). An Author
	// group freely gains/loses the Review stage; the guard-rails hold — a Reviewer
	// group's non-review stage cells are DISABLED, a Manager group's cells are all
	// disabled (locked on).
	test('assigns/unassigns a stage on the grid; per-role stage guard-rails hold', async ({
		page,
		pkpApi,
	}) => {
		test.slow();
		const tag = uniqueTag();
		const ctx = await seedJournal(pkpApi, tag);

		const pom = new RolesSettingsPage(page);
		await pom.goto(ctx.path);
		const csrf = await csrfToken(page);

		// A custom Author group starts with NO stage assignments (all enabled).
		const name = `Stage Author ${tag}`;
		await createGroup(page, ctx.path, csrf, {
			roleId: ROLE_ID_AUTHOR,
			name,
			abbrev: `SA${tag}`,
		});
		await pom.goto(ctx.path);

		const authorRow = pom.rowByName(name);
		await expect(pom.stageCheckbox(authorRow, STAGE_REVIEW)).not.toBeChecked();

		// Assign the Review stage → persists across a reload.
		await pom.toggleStage(authorRow, STAGE_REVIEW);
		await pom.goto(ctx.path);
		await expect(
			pom.stageCheckbox(pom.rowByName(name), STAGE_REVIEW),
		).toBeChecked();

		// Unassign it again → persists off.
		await pom.toggleStage(pom.rowByName(name), STAGE_REVIEW);
		await pom.goto(ctx.path);
		await expect(
			pom.stageCheckbox(pom.rowByName(name), STAGE_REVIEW),
		).not.toBeChecked();

		// Guard-rails (role-derived, independent of assignment):
		// Reviewer group — only the Review stage cell is enabled.
		const reviewerRow = pom.rowByName('Reviewer');
		await expect(pom.stageCheckbox(reviewerRow, STAGE_REVIEW)).toBeEnabled();
		await expect(pom.stageCheckbox(reviewerRow, 1)).toBeDisabled(); // Submission
		await expect(pom.stageCheckbox(reviewerRow, 4)).toBeDisabled(); // Copyediting
		await expect(pom.stageCheckbox(reviewerRow, 5)).toBeDisabled(); // Production

		// Manager group — every stage cell is locked (disabled): the manager role
		// is forbidden from ALL cell toggles (RoleDAO::getForbiddenStages) since
		// its stages are always forced on at save time, never hand-toggled.
		const managerRow = pom.rowByName('Journal manager');
		for (const stageId of RolesSettingsPage.STAGE_COLUMNS) {
			await expect(pom.stageCheckbox(managerRow, stageId)).toBeDisabled();
		}
	});

	// ── Scenario 8 — Delete a group: custom works, default blocked ─────────────
	// A custom, unused group is removed from the grid and disappears; a DEFAULT
	// group (Reviewer) survives the delete attempt (isDefault → "can't remove
	// default" notice, no delete).
	test('deletes a custom group but refuses a default group', async ({
		page,
		pkpApi,
	}) => {
		test.slow();
		const tag = uniqueTag();
		const ctx = await seedJournal(pkpApi, tag);

		const pom = new RolesSettingsPage(page);
		await pom.goto(ctx.path);
		const csrf = await csrfToken(page);

		// Custom empty group → delete succeeds.
		const name = `Disposable ${tag}`;
		await createGroup(page, ctx.path, csrf, {
			roleId: ROLE_ID_AUTHOR,
			name,
			abbrev: `DZ${tag}`,
		});
		await pom.goto(ctx.path);
		const rowId = await pom.resolveActionableRowId(name);
		await pom.deleteRole(rowId);
		await pom.goto(ctx.path);
		await expect(pom.rowByName(name)).toHaveCount(0);
		expect(groupByName(await userGroups(page.request, ctx.path), name)).toBeNull();

		// Default group (Reviewer) → delete refused, group survives.
		const defaultRowId = await pom.resolveActionableRowId('Reviewer');
		await pom.deleteRole(defaultRowId);
		await pom.goto(ctx.path);
		await expect(pom.rowByName('Reviewer')).toBeVisible();
		expect(
			groupByName(await userGroups(page.request, ctx.path), 'Reviewer'),
		).not.toBeNull();
	});

	// ── Scenario 10 — Reset "Permissions" ⚠ resets COPYRIGHT/LICENCE, not roles ─
	// Under Tools → Permissions, "Reset Article Permissions" rewrites EVERY
	// publication's copyright/licence to the journal defaults — it touches no role
	// or group. Proven on a scratch journal: a published article whose copyright/
	// licence is overridden to sentinels is reset back to the journal defaults,
	// while a custom user group (and the whole role matrix) is left untouched.
	test(
		'the "Permissions" reset tool resets article copyright/licence, NOT roles (⚠)',
		{tag: '@regression'},
		async ({page, pkpApi}) => {
			test.slow();
			const tag = uniqueTag();
			const defaultLicense = 'https://creativecommons.org/licenses/by/4.0/';
			const ctx = await seedJournal(
				pkpApi,
				tag,
				[{username: 'atester', roles: ['author']}],
				{
					licenseUrl: defaultLicense,
					copyrightYearBasis: 'issue',
					issues: [{volume: 1, number: 1, year: 2025, published: true}],
				},
			);

			// A published article inherits the journal defaults at publish.
			const {submission, publications} = await pkpApi.createSubmission({
				tag,
				journal: ctx.path,
				submitter: 'atester',
				section: 'ART',
				locale: 'en',
				participants: [
					{user: MANAGER, role: 'manager', canChangeMetadata: true},
				],
				decisions: [
					{type: 'skipExternalReview', by: MANAGER},
					{type: 'sendToProduction', by: MANAGER},
				],
				publications: [
					{
						versionStage: 'VoR',
						metadata: {title: {en: `Reset article ${tag}`}},
						issue: {volume: 1, number: 1, year: 2025},
						published: true,
					},
				],
			});
			const subId = submission.id;
			const pubId = publications[0].id;
			expect(publications[0].status).toBe(STATUS_PUBLISHED);

			const pubUrl = `/index.php/${ctx.path}/api/v1/submissions/${subId}/publications/${pubId}`;
			const fetchPub = async () => (await page.request.get(pubUrl)).json();

			// Capture the journal-default copyright/licence snapshot.
			const before = await fetchPub();
			expect(before.licenseUrl).toBe(defaultLicense);

			// A custom user group whose survival proves roles are NOT reset.
			await page.goto(`/index.php/${ctx.path}/management/settings/access`);
			const csrf = await csrfToken(page);
			const guardName = `Reset Guard ${tag}`;
			await createGroup(page, ctx.path, csrf, {
				roleId: ROLE_ID_AUTHOR,
				name: guardName,
				abbrev: `RG${tag}`,
				options: {masthead: '1'},
			});

			// Override the publication's copyright/licence to sentinels.
			const sentinelHolder = `Sentinel Holder ${tag}`;
			const sentinelUrl = `https://example.org/${tag}`;
			const put = await page.request.put(pubUrl, {
				headers: {
					'X-Csrf-Token': csrf,
					'Content-Type': 'application/json',
				},
				data: {
					copyrightHolder: {en: sentinelHolder},
					copyrightYear: 1899,
					licenseUrl: sentinelUrl,
				},
			});
			expect(put.status(), await put.text()).toBe(200);
			const overridden = await fetchPub();
			expect(overridden.copyrightHolder.en).toBe(sentinelHolder);
			expect(overridden.licenseUrl).toBe(sentinelUrl);

			// Run Tools → Permissions → Reset Article Permissions.
			const reset = await page.request.post(
				`/index.php/${ctx.path}/management/tools/resetPermissions`,
				{form: {csrfToken: csrf}},
			);
			expect(reset.status(), await reset.text()).toBe(200);

			// ⚠ The article's copyright/licence is reset to the journal defaults…
			const after = await fetchPub();
			expect(after.licenseUrl).toBe(defaultLicense);
			expect(after.licenseUrl).not.toBe(sentinelUrl);
			expect(after.copyrightHolder.en).toBe(before.copyrightHolder.en);
			expect(after.copyrightHolder.en).not.toBe(sentinelHolder);
			expect(String(after.copyrightYear)).toBe(String(before.copyrightYear));
			expect(String(after.copyrightYear)).not.toBe('1899');

			// …while the role definitions are UNTOUCHED (the custom group survives).
			expect(
				groupByName(await userGroups(page.request, ctx.path), guardName),
			).not.toBeNull();
		},
	);

	// ── Scenarios 11 + 12 — Permission boundary + the AUTHZ base role gate ─────
	// The Roles grid op is gated to [MANAGER, SITE_ADMIN]: a reviewer and an
	// author are refused ("current role does not have access"), while the manager
	// passes. The read-only GET /userGroups list is DELIBERATELY wider (also
	// section-editor/assistant/reviewer/author). And a non-manager is bounced off
	// the Users & Roles management page entirely. Read-only on publicknowledge.
	test(
		'roles grid denies non-managers; /userGroups list is deliberately wider',
		{tag: '@smoke'},
		async ({page, pkpApi, asUser}) => {
			const journal = 'publicknowledge';

			// Manager (dbarnes on his own scratch journal) — grid op permitted.
			const tag = uniqueTag();
			const ctx = await seedJournal(pkpApi, tag);
			const mgrGrid = await page.request.get(gridOp(ctx.path, 'fetch-grid'));
			expect(mgrGrid.status()).toBe(200);
			const mgrBody = await mgrGrid.text();
			// The manager gets the real grid, not the access-denied JSON.
			expect(mgrBody).not.toContain('does not have access');
			expect(mgrBody).toContain('usergroupgrid'); // the grid component DOM id

			// Reviewer (jjanssen) — grid op DENIED, but the list feed is allowed.
			const reviewerCtx = await asUser('jjanssen');
			const revGrid = await reviewerCtx.request.get(
				gridOp(journal, 'fetch-grid'),
			);
			const revGridBody = await revGrid.json();
			expect(revGridBody.status).toBe(false);
			expect(revGridBody.content).toMatch(/does not have access/i);
			const revList = await reviewerCtx.request.get(
				`/index.php/${journal}/api/v1/userGroups`,
			);
			expect(revList.status()).toBe(200); // deliberately wider read

			// Reviewer — the Users & Roles management page bounces to denied.
			const revPage = await reviewerCtx.newPage();
			await revPage.goto(`/index.php/${journal}/management/settings/access`);
			await expect(revPage).toHaveURL(/authorizationDenied|AccessDenied/i);

			// Author (atester) — grid op DENIED, list feed still allowed.
			const authorCtx = await asUser('atester');
			const authGrid = await authorCtx.request.get(
				gridOp(journal, 'fetch-grid'),
			);
			expect((await authGrid.json()).status).toBe(false);
			const authList = await authorCtx.request.get(
				`/index.php/${journal}/api/v1/userGroups`,
			);
			expect(authList.status()).toBe(200);
		},
	);
});
