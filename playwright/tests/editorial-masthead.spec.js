// @ts-check
const {test, expect} = require('../support/fixtures.js');
const {
	MastheadAppearancePage,
} = require('../../lib/pkp/playwright/pages/MastheadAppearancePage.js');

/**
 * Editorial masthead — the CONFIGURATION that decides what the public
 * `/about/editorialMasthead` page shows. One test per canonical scenario of
 * docs/product/specs/editorial-masthead.md (5 named), landed at 4 here by
 * folding the reviewer-section-is-automatic scenario (4) into the update-notify
 * boundary test (5) as its reviewer-400 half.
 *
 * WHAT IS DRIVEN LIVE (this feature owns TWO config knobs; the public render is
 * `about-pages`', the per-user PUT is `user-management`'s — both are exercised
 * here as the config's observable effects):
 *   - The REAL appearance form (Settings → Website → Editorial Masthead,
 *     `PKPAppearanceMastheadForm`): the orderable `mastheadUserGroupIds` list
 *     renders the masthead-eligible NON-reviewer groups (Reviewer excluded) plus
 *     the display-only reviewer note; a reorder driven through the Orderer
 *     up-arrow persists (MastheadAppearancePage POM, lib/pkp).
 *   - The per-user masthead PUT (`/users/{id}/masthead/{userUserGroupId}`): the
 *     flag that populates the public roster — SETTING it makes a user appear
 *     under their role heading (the empty seed → populated headline), and a
 *     REORDER of the groups re-sequences the public role headings.
 *   - The update-notify mail (`UserRoleMastheadUpdateNotify`): a flip delivers
 *     one email (Mailpit, scoped to the throwaway recipient); a no-op PUT sends
 *     none; a Reviewer-role assignment is refused (400) before any send.
 *
 * As-built realities asserted (feedback discipline — assert reality):
 *   - Reviewers are AUTO-listed with NO opt-in: the Reviewer group is excluded
 *     from the order form, and a reviewer masthead PUT 400s (spec Rule 4).
 *   - The public masthead is EMPTY until a user carries the per-assignment flag
 *     (the two-level opt-in; spec Rule 3 / about-pages' empty-seed finding).
 *
 * AUTH: `test.use({user:'dbarnes'})` — the default page is a journal MANAGER
 * (dbarnes), enrolled as `manager` of each test's OWN scratch journal so the
 * per-user PUT + the settings form are permitted; `page.request` shares his
 * session, CSRF read from the loaded backend page. The public masthead is read
 * ANONYMOUSLY (a fresh empty-state context).
 *
 * PARALLEL + isolation: every test seeds its OWN scratch journal (unique tag) +
 * UNIQUE throwaway users; all flag/reorder/config touch throwaway state only,
 * never a seeded user nor the shared publicknowledge journal. Every email is
 * scoped to a unique throwaway recipient; no test clears Mailpit. The
 * update-notify mail is sent synchronously in-request → reaches Mailpit
 * immediately → parallel-safe at the flat root.
 */

const ROLE_ID_MANAGER = 16; // the "Journal editor" masthead group
const ROLE_ID_SUB_EDITOR = 17; // the "Section editor" masthead group
const ROLE_ID_REVIEWER = 4096; // the "Reviewer" group — excluded from the masthead config
const MANAGER = 'dbarnes';
const MANAGER_EMAIL = 'dbarnes@mailinator.com';

/** A unique, hyphenless, lowercased alphanumeric token (parallel + re-run isolation). */
function uniqueTag(prefix = 'em') {
	const workerIndex = test.info().parallelIndex;
	const rand = Math.random().toString(36).slice(2, 8);
	return `${prefix}${workerIndex}x${rand}`;
}

/** A throwaway user spec (created because it carries a `password`). */
function throwaway(tag, name, roles, extra = {}) {
	const username = `${tag}${name}`;
	return {
		username,
		password: username + username,
		email: `${username}@mailinator.com`,
		givenName: name.charAt(0).toUpperCase() + name.slice(1),
		familyName: `T${tag}`,
		roles,
		...extra,
	};
}

/** Seed a scratch journal with dbarnes-as-manager + throwaway users → context. */
async function seedJournal(pkpApi, tag, throwaways = []) {
	const {context} = await pkpApi.createJournal({
		tag,
		users: [{username: MANAGER, roles: ['manager']}, ...throwaways],
	});
	return context;
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

/** Look a user up on a journal's `/users` feed by exact username. */
async function apiUserByName(page, path, username) {
	const res = await page.request.get(
		`/index.php/${path}/api/v1/users?searchPhrase=${encodeURIComponent(
			username,
		)}&status=all&includePermissions=true&count=50`,
	);
	expect(res.ok(), `users feed ${res.status()}`).toBeTruthy();
	const body = await res.json();
	return (
		(body.items || []).find(
			(u) => String(u.userName).toLowerCase() === username.toLowerCase(),
		) || null
	);
}

/** The `groups[]` entry (assignment) for a role id — carries `userUserGroupId`. */
function groupByRole(user, roleId) {
	return (user?.groups || []).find((g) => g.roleId === roleId);
}

/** PUT the per-user masthead flag for one role assignment. */
function putMasthead(page, path, userId, userUserGroupId, value, csrf) {
	return page.request.put(
		`/index.php/${path}/api/v1/users/${userId}/masthead/${userUserGroupId}`,
		{
			headers: {'X-Csrf-Token': csrf, 'Content-Type': 'application/json'},
			data: {masthead: value},
		},
	);
}

/** A fresh anonymous browser context (explicit empty storage state). */
async function newAnonContext(browser, baseURL) {
	return browser.newContext({baseURL, storageState: {cookies: [], origins: []}});
}

/**
 * Read the public Editorial Masthead ANONYMOUSLY (scratch journal → bare path)
 * and return {headings, body}: the ordered role-group headings (the <h2>s) and
 * the full page text (for name / affiliation assertions).
 */
async function readMasthead(browser, baseURL, path) {
	const ctx = await newAnonContext(browser, baseURL);
	try {
		const p = await ctx.newPage();
		await p.goto(`/index.php/${path}/about/editorialMasthead`);
		await expect(
			p.getByRole('heading', {level: 1, name: 'Editorial Masthead'}),
		).toBeVisible();
		const masthead = p.locator('.page_masthead');
		const headings = (await masthead.locator('h2').allTextContents()).map((t) =>
			t.trim(),
		);
		const body = (await masthead.textContent()) || '';
		return {headings, body};
	} finally {
		await ctx.close();
	}
}

test.use({user: MANAGER});

test.describe('Editorial masthead — the public-roster configuration', () => {
	// ── Scenario 1 — Configure the masthead role order ────────────────────────
	// The manager opens Settings → Website → Editorial Masthead: the orderable
	// list shows exactly the masthead-eligible NON-reviewer groups (Journal
	// editor / Section editor / Editorial Board Member), in role order, with the
	// Reviewer group EXCLUDED and a display-only reviewer note. Dragging a group
	// up (via the Orderer arrow) and saving persists the new order.
	test(
		'the appearance form lists the eligible groups (Reviewer excluded) and persists a reorder',
		{tag: ['@smoke', '@regression']},
		async ({page, pkpApi}) => {
			const tag = uniqueTag();
			const ctx = await seedJournal(pkpApi, tag);

			const pom = new MastheadAppearancePage(page, ctx.path);
			await pom.goto();

			// Exactly the three masthead-eligible non-reviewer groups, in role-id
			// order; the Reviewer group is excluded from the sortable list.
			await expect(pom.options).toHaveCount(3);
			expect(await pom.optionOrder()).toEqual([
				'Journal editor',
				'Section editor',
				'Editorial Board Member',
			]);
			await expect(pom.optionFor('Reviewer')).toHaveCount(0);
			// The display-only reviewer note renders (not a toggle).
			await expect(pom.reviewerNote).toBeVisible();

			// Reorder: move Section editor to the top, save.
			await pom.moveUp('Section editor');
			expect(await pom.optionOrder()).toEqual([
				'Section editor',
				'Journal editor',
				'Editorial Board Member',
			]);
			await pom.save();

			// Persisted: reopening the tab shows the saved order.
			await pom.goto();
			expect(await pom.optionOrder()).toEqual([
				'Section editor',
				'Journal editor',
				'Editorial Board Member',
			]);
		},
	);

	// ── Scenario 2 — Flag a user → they appear on the public page + are emailed ─
	// THE HEADLINE. On a scratch journal the public masthead is EMPTY (no user
	// carries the per-assignment flag → no role headings). Turning a throwaway
	// section-editor's masthead flag on (the per-user PUT) makes them appear
	// under the Section editor heading — with name + affiliation — and delivers
	// the "masthead visibility updated" email to their address.
	test(
		'flagging a user populates the public masthead (empty → populated) and emails them',
		{tag: ['@smoke', '@regression']},
		async ({page, pkpApi, pkpMail, browser, baseURL}) => {
			const tag = uniqueTag();
			const ed = throwaway(tag, 'edna', ['sectionEditor'], {
				affiliation: `Institute ${tag}`,
			});
			const ctx = await seedJournal(pkpApi, tag, [ed]);

			// Empty seed: no flagged user → no role headings render at all.
			const before = await readMasthead(browser, baseURL, ctx.path);
			expect(before.headings).toEqual([]);
			expect(before.body).not.toContain(ed.familyName);

			// Flip the section-editor assignment onto the masthead (per-user PUT).
			await page.goto(`/index.php/${ctx.path}/management/settings/access`);
			const csrf = await csrfToken(page);
			const user = await apiUserByName(page, ctx.path, ed.username);
			const secGroup = groupByRole(user, ROLE_ID_SUB_EDITOR);
			const res = await putMasthead(
				page,
				ctx.path,
				user.id,
				secGroup.userUserGroupId,
				true,
				csrf,
			);
			expect(res.status(), await res.text()).toBe(200);

			// The public page now lists the editor under the Section editor
			// heading, with their full name + affiliation.
			const after = await readMasthead(browser, baseURL, ctx.path);
			expect(after.headings).toEqual(['Section editor']);
			expect(after.body).toContain(ed.familyName);
			expect(after.body).toContain(ed.givenName);
			expect(after.body).toContain(`Institute ${tag}`);

			// The update-notify email arrives, from the acting manager.
			const [mail] = await pkpMail.find({
				to: ed.email,
				contains: 'masthead visibility',
			});
			expect(mail.From.Address).toBe(MANAGER_EMAIL);
			expect(mail.Subject).toMatch(/masthead visibility/i);
		},
	);

	// ── Scenario 3 — Reorder the groups → the public page order changes ────────
	// Two flagged users in two different masthead groups (a Journal editor + a
	// Section editor). With the saved order [Journal editor, Section editor] the
	// public role headings render in that sequence; swapping the order in the
	// REAL appearance form (Section editor up) re-sequences the public headings
	// to match.
	test(
		'reordering the groups in the appearance form flips the public role-heading order',
		{tag: '@regression'},
		async ({page, pkpApi, browser, baseURL}) => {
			const tag = uniqueTag();
			const je = throwaway(tag, 'jeff', ['editor']); // Journal editor group
			const se = throwaway(tag, 'sara', ['sectionEditor']); // Section editor group
			const ctx = await seedJournal(pkpApi, tag, [je, se]);

			const pom = new MastheadAppearancePage(page, ctx.path);
			await pom.goto();
			const csrf = await csrfToken(page);

			// Flag both users onto the masthead (their own role groups).
			const jeUser = await apiUserByName(page, ctx.path, je.username);
			const seUser = await apiUserByName(page, ctx.path, se.username);
			const jeFlip = await putMasthead(
				page,
				ctx.path,
				jeUser.id,
				groupByRole(jeUser, ROLE_ID_MANAGER).userUserGroupId,
				true,
				csrf,
			);
			expect(jeFlip.status(), await jeFlip.text()).toBe(200);
			const seFlip = await putMasthead(
				page,
				ctx.path,
				seUser.id,
				groupByRole(seUser, ROLE_ID_SUB_EDITOR).userUserGroupId,
				true,
				csrf,
			);
			expect(seFlip.status(), await seFlip.text()).toBe(200);

			// Save the default order [Journal editor, Section editor, …] explicitly.
			expect(await pom.optionOrder()).toEqual([
				'Journal editor',
				'Section editor',
				'Editorial Board Member',
			]);
			await pom.save();

			// Public page: both populated headings, Journal editor first.
			const first = await readMasthead(browser, baseURL, ctx.path);
			expect(first.headings).toEqual(['Journal editor', 'Section editor']);

			// Swap the order in the form: move Section editor above Journal editor.
			await pom.goto();
			await pom.moveUp('Section editor');
			expect(await pom.optionOrder()).toEqual([
				'Section editor',
				'Journal editor',
				'Editorial Board Member',
			]);
			await pom.save();

			// Public page re-sequences to match the new saved order.
			const second = await readMasthead(browser, baseURL, ctx.path);
			expect(second.headings).toEqual(['Section editor', 'Journal editor']);
		},
	);

	// ── Scenario 5 (+ 4) — the update-notify boundary + the reviewer refusal ───
	// The per-user PUT's mail rules: a Reviewer-role assignment is REFUSED (400,
	// no send — Rule 4, reviewers are auto-listed and never masthead-toggled); a
	// NO-OP PUT (setting the flag to its current value) sends NOTHING (bounded by
	// a control flip on a second user that DOES email); a real FLIP delivers
	// exactly one "masthead visibility updated" email from the acting manager.
	test(
		'update-notify: reviewer assignment 400s, a no-op sends no mail, a flip sends one',
		{tag: '@regression'},
		async ({page, pkpApi, pkpMail}) => {
			const tag = uniqueTag();
			const rhea = throwaway(tag, 'rhea', ['sectionEditor', 'reviewer']);
			const cody = throwaway(tag, 'cody', ['sectionEditor']); // control recipient
			const ctx = await seedJournal(pkpApi, tag, [rhea, cody]);

			await page.goto(`/index.php/${ctx.path}/management/settings/access`);
			const csrf = await csrfToken(page);

			const user = await apiUserByName(page, ctx.path, rhea.username);
			const secGroup = groupByRole(user, ROLE_ID_SUB_EDITOR);
			const reviewerGroup = groupByRole(user, ROLE_ID_REVIEWER);
			const ctrlUser = await apiUserByName(page, ctx.path, cody.username);
			const ctrlSec = groupByRole(ctrlUser, ROLE_ID_SUB_EDITOR);

			// Reviewer assignment cannot be masthead-toggled → 400 (Rule 4).
			const revRes = await putMasthead(
				page,
				ctx.path,
				user.id,
				reviewerGroup.userUserGroupId,
				true,
				csrf,
			);
			expect(revRes.status()).toBe(400);
			expect((await revRes.json()).error).toMatch(/reviewer/i);

			// No-op: setting the flag to its current value (false) sends nothing.
			// Bound the negative with a real flip on the control user (which DOES
			// email them).
			const noop = await putMasthead(
				page,
				ctx.path,
				user.id,
				secGroup.userUserGroupId,
				false,
				csrf,
			);
			expect(noop.status()).toBe(200);
			const ctrlFlip = await putMasthead(
				page,
				ctx.path,
				ctrlUser.id,
				ctrlSec.userUserGroupId,
				true,
				csrf,
			);
			expect(ctrlFlip.status(), await ctrlFlip.text()).toBe(200);
			await pkpMail.expectNone({
				to: rhea.email,
				contains: 'masthead visibility',
				afterControl: {to: cody.email, contains: 'masthead visibility'},
			});

			// A real flip (false → true) sends exactly the update-notify email.
			const flip = await putMasthead(
				page,
				ctx.path,
				user.id,
				secGroup.userUserGroupId,
				true,
				csrf,
			);
			expect(flip.status(), await flip.text()).toBe(200);
			const [mail] = await pkpMail.find({
				to: rhea.email,
				contains: 'masthead visibility',
			});
			expect(mail.From.Address).toBe(MANAGER_EMAIL);
			expect(mail.Subject).toMatch(/masthead visibility/i);
		},
	);
});
