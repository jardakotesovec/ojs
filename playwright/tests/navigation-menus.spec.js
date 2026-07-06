// @ts-check
const {test, expect} = require('../support/fixtures.js');
const {
	waitForJQueryIdle,
} = require('../../lib/pkp/playwright/support/jquery.js');
const {
	setTinyMceContent,
} = require('../../lib/pkp/playwright/support/tinymce.js');

/**
 * Navigation menus — Settings → Website → Setup → Navigation: the menus +
 * menu-items grids, the Vue menu editor (drag-drop, areas), the legacy item
 * modal (typed items, custom pages, remote URLs), and the reader header the
 * whole feature projects into. One test per canonical scenario of
 * docs/product/specs/navigation-menus.md (7 named scenarios → 7 tests, 1:1).
 *
 * WHAT IS DRIVEN LIVE:
 *   - The REAL hybrid manager surface (spec rule 11): legacy grids, the
 *     NavigationMenuManagerFormModal Vue side modal (title / area select /
 *     the two MenuTreePanel drag-drop panels saving through the
 *     navigationMenus REST API) and the legacy NavigationMenuItemsForm
 *     AjaxModal (type select swapping per-type fields, TinyMCE content,
 *     the Preview popup).
 *   - REAL pragmatic-dnd drags (mouse-driven HTML5 drag): pool→assigned,
 *     reorder-above (top-edge drop), make-child (center drop), the refused
 *     depth-3 drag, and assigned→pool unplacing.
 *   - Every rendered outcome is read ANONYMOUSLY off the scratch journal's
 *     header strips (ul#navigationPrimary / ul#navigationUser) or the
 *     custom-page renderer — bare URLs (single-locale journals).
 *
 * KNOWN LEDGER ROWS asserted as documented (feedback discipline):
 *   - Row 130: the navigationMenus API misses the *Permit settings* gate —
 *     a stripped manager is refused the page and the grids but keeps API
 *     GET/POST/PUT (test 2 asserts the documented split, not a wish).
 *   - Row 131: the OJS item types are invisible to the API/Vue surface —
 *     the Current item shows NO conditional icon in the editor although
 *     the front end hides it under publishingMode=NONE (test 6 asserts
 *     both halves).
 *   - Row 132: (a) the About item's editor icon warns about an About-text
 *     condition that does not exist — the front-end About link renders
 *     with empty About text (test 6); (c) an anonymous forged preview
 *     POST dies with a raw 500 (test 4).
 *   - Row 133: the depth-2 nesting cap is client-side only — the API
 *     stores a 3-level tree (200) whose grandchild the header silently
 *     drops (test 7).
 *
 * NOT asserted: the legacy item form's refusal MESSAGES (pathRegEx /
 * duplicatePath / customUrlError). Form::validate() surfaces them through a
 * trivial FORM_ERROR notification drained by /notification/fetchNotification
 * — a per-user queue shared across parallel workers (patterns.md
 * parallel-load lesson 2), so the deterministic refusal observables are the
 * grid POST's {status:false} + the modal staying open + no row appearing.
 *
 * AUTH: test.use dbarnes — manager of each test's OWN scratch journal.
 * Anonymous reads use explicit empty-state contexts (patterns.md item 8).
 * publicknowledge navigation is NEVER touched (its header is load-bearing
 * across the reader-page suite); every mutation lands on a per-test scratch
 * journal (unique hyphenless `nmt…` path). No Mailpit: no menu/item
 * operation emails or writes the event log (spec Side effects).
 */

const MANAGER = 'dbarnes';
const PRIMARY_UL = 'ul#navigationPrimary';
const USER_UL = 'ul#navigationUser';

test.use({user: MANAGER});

/** A unique, hyphenless, lowercased alphanumeric journal path (≤32). */
function uniqueTag(prefix = 'nmt') {
	const workerLetter = String.fromCharCode(
		97 + (test.info().parallelIndex % 26),
	);
	let suffix = '';
	while (suffix.length < 6) {
		suffix += Math.random().toString(36).replace(/[^a-z0-9]/g, '');
	}
	return `${prefix}${workerLetter}${suffix.slice(0, 6)}`;
}

/** Seed a scratch journal (dbarnes as manager + passthrough) → context. */
async function seedJournal(pkpApi, tag, extra = {}) {
	const {context} = await pkpApi.createJournal({
		tag,
		path: tag,
		primaryLocale: 'en',
		supportedLocales: ['en'],
		users: [{username: MANAGER, roles: ['manager']}, ...(extra.users ?? [])],
		...Object.fromEntries(Object.entries(extra).filter(([k]) => k !== 'users')),
	});
	return context;
}

/** A fresh anonymous browser context (explicit empty storage state). */
async function newAnonContext(browser, baseURL) {
	return browser.newContext({
		baseURL,
		storageState: {cookies: [], origins: []},
	});
}

/** Read a context's CSRF token off the site-level profile page. */
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

/** PUT journal settings through the journal-settings API (rule-6 flips). */
async function putContext(requestCtx, ctxPath, contextId, data, csrf) {
	return requestCtx.put(`/index.php/${ctxPath}/api/v1/contexts/${contextId}`, {
		headers: {'X-Csrf-Token': csrf, 'Content-Type': 'application/json'},
		data,
	});
}

/** GET from the navigationMenus API (manager/admin session required). */
async function navGet(requestCtx, ctxPath, suffix = '') {
	const res = await requestCtx.get(
		`/index.php/${ctxPath}/api/v1/navigationMenus${suffix}`,
	);
	expect(res.status(), `GET navigationMenus${suffix}`).toBe(200);
	return res.json();
}

/** Convert an assigned-items tree (API shape) to the flat menuTree payload. */
function toMenuTree(nodes, parentId = null) {
	const out = [];
	(nodes || []).forEach((n, i) => {
		out.push({menuItemId: n.menuItemId, seq: i, parentId});
		out.push(...toMenuTree(n.children, n.menuItemId));
	});
	return out;
}

/**
 * Normalized texts of all links in a header strip (works on CSS-hidden
 * dropdown items, which getByRole would skip). Root-level only via
 * `> li > a`; all levels via ` a`.
 */
async function stripTexts(pub, selector) {
	return pub
		.locator(selector)
		.evaluateAll((els) =>
			els.map((e) => (e.textContent || '').replace(/\s+/g, ' ').trim()),
		);
}

/** href of the strip link whose normalized text equals `text` (else null). */
async function stripHref(pub, ulSelector, text) {
	return pub.locator(`${ulSelector} a`).evaluateAll(
		(els, t) =>
			els
				.find((e) => (e.textContent || '').replace(/\s+/g, ' ').trim() === t)
				?.getAttribute('href') ?? null,
		text,
	);
}

/** Open Settings → Website → Setup → Navigation; wait for both grids. */
async function openNavigationTab(page, ctxPath) {
	await page.goto(`/index.php/${ctxPath}/management/settings/website`);
	await page.locator('#setup-button').click();
	await page.locator('#navigationMenus-button').click();
	const menusGrid = page.locator('#navigationMenuGridContainer');
	const itemsGrid = page.locator('#navigationMenuItemsGridContainer');
	await expect(
		menusGrid.locator('a[id*="-addNavigationMenu-button-"]'),
	).toBeVisible({timeout: 20_000});
	await expect(
		itemsGrid.locator('a[id*="-addNavigationMenuItem-button-"]'),
	).toBeVisible({timeout: 20_000});
	await waitForJQueryIdle(page);
	return {menusGrid, itemsGrid};
}

/** A legacy grid row by its visible title. */
function gridRow(grid, title) {
	return grid.locator('tr.gridRow').filter({hasText: title}).first();
}

/**
 * Click a legacy grid row action (`edit` / `remove`), expanding the row's
 * hidden controls first when needed (patterns.md pitfall 9).
 */
async function clickRowAction(page, grid, title, action) {
	const row = gridRow(grid, title);
	await expect(row).toBeVisible({timeout: 15_000});
	const rowId = await row.getAttribute('id');
	const link = page.locator(`a[id^="${rowId}-${action}-button-"]`);
	if (!(await link.isVisible())) {
		await row.locator('a.show_extras').click();
	}
	await link.click();
}

/**
 * Wait for the NavigationMenuManagerFormModal to be fully loaded: title
 * field mounted, the theme areas fetched into the select, and the item
 * panels populated (menu-items fetch finished).
 */
async function awaitMenuModal(page) {
	const modal = page.locator('[data-cy="active-modal"]');
	await expect(modal.locator('input[id$="-title-control"]')).toBeVisible({
		timeout: 20_000,
	});
	await expect(
		modal.locator('select[id$="-areaName-control"] option[value="primary"]'),
	).toHaveCount(1, {timeout: 20_000});
	await expect(
		modal.locator('[data-cy^="panel-content-"] [data-cy^="menu-item-"]').first(),
	).toBeVisible({timeout: 20_000});
	return modal;
}

/** Save the Vue menu modal and return the navigationMenus API response. */
async function saveMenuModal(page, modal) {
	const [res] = await Promise.all([
		page.waitForResponse(
			(r) =>
				r.url().includes('/api/v1/navigationMenus') &&
				r.request().method() === 'POST', // create POST + tunnelled PUT
			{timeout: 20_000},
		),
		modal.getByRole('button', {name: 'Save', exact: true}).click(),
	]);
	return res;
}

/**
 * Mouse-driven HTML5 drag for the pragmatic-dnd menu editor. dragTo issues
 * too few moves for the tree-item hitbox to settle on an instruction, so
 * this walks the pointer in steps and jiggles at the target (the same
 * lesson as SectionsSettingsPage/IssuePage, adapted to native DnD).
 *
 * targetPoint: offsets INSIDE the target box; ratios (0..1) or px (>1).
 */
async function dragItemTo(page, source, target, targetPoint = {}) {
	await source.scrollIntoViewIfNeeded();
	await target.scrollIntoViewIfNeeded();
	const src = await source.boundingBox();
	if (!src) throw new Error('dragItemTo: source not visible');
	const resolve = (v, size, fallback) => {
		if (v === undefined) return fallback;
		return v > 1 ? v : v * size;
	};
	const from = {x: src.x + src.width / 2, y: src.y + src.height / 2};
	await page.mouse.move(from.x, from.y);
	await page.mouse.down();
	await page.mouse.move(from.x + 6, from.y + 6, {steps: 3});
	// Walk to the target, RE-MEASURING it as we hover: the editor inserts
	// drop-ghost previews mid-drag, which shift the layout under a fixed
	// coordinate. Loop until the target box stops moving.
	let to = null;
	for (let i = 0; i < 6; i++) {
		const dst = await target.boundingBox();
		if (!dst) throw new Error('dragItemTo: target not visible');
		const next = {
			x: dst.x + resolve(targetPoint.x, dst.width, dst.width / 2),
			y: dst.y + resolve(targetPoint.y, dst.height, dst.height / 2),
		};
		const settled =
			to && Math.abs(next.x - to.x) < 2 && Math.abs(next.y - to.y) < 2;
		to = next;
		await page.mouse.move(to.x, to.y, {steps: i === 0 ? 14 : 4});
		if (settled) break;
	}
	await page.mouse.move(to.x + 1, to.y, {steps: 2});
	await page.mouse.move(to.x, to.y, {steps: 2});
	await page.mouse.up();
}

/** Titles of the assigned panel's ROOT items, in visual order. */
async function assignedRootTitles(modal) {
	return modal
		.locator(
			'[data-cy="panel-content-assigned"] > [data-cy^="menu-item-"] > div[data-menu-item-title]',
		)
		.evaluateAll((els) => els.map((e) => e.getAttribute('data-menu-item-title')));
}

/** Open the legacy Add-item modal and return the form locator. */
async function openAddItemModal(page, itemsGrid) {
	await itemsGrid.locator('a[id*="-addNavigationMenuItem-button-"]').click();
	const form = page.locator('form#navigationMenuItemsForm');
	await expect(form.locator('input[name="title[en]"]')).toBeVisible({
		timeout: 20_000,
	});
	return form;
}

/** Submit the legacy item form; returns the update op's JSON body. */
async function saveItemForm(page, form) {
	const [res] = await Promise.all([
		page.waitForResponse(
			(r) => r.url().includes('update-navigation-menu-item'),
			{timeout: 20_000},
		),
		form.getByRole('button', {name: 'Save', exact: true}).click(),
	]);
	expect(res.status()).toBe(200);
	const body = await res.json();
	await waitForJQueryIdle(page);
	return body;
}

/**
 * Place an existing pool item into the Primary Navigation Menu through the
 * REAL editor: edit modal → drag from the unassigned panel to the assigned
 * panel root → Save (tests 4 + 5 share this closing step).
 */
async function placeItemInPrimaryMenu(page, menusGrid, itemTitle) {
	await clickRowAction(page, menusGrid, 'Primary Navigation Menu', 'edit');
	const modal = await awaitMenuModal(page);
	const source = modal.locator(
		`[data-cy="panel-content-unassigned"] div[data-menu-item-title="${itemTitle}"]`,
	);
	await expect(source).toBeVisible({timeout: 15_000});
	const assignedPanel = modal.locator('[data-cy="panel-content-assigned"]');
	// Drop into the panel's bottom padding → append at root level.
	const box = await assignedPanel.boundingBox();
	await dragItemTo(page, source, assignedPanel, {y: box.height - 25});
	await expect(
		modal.locator(
			`[data-cy="panel-content-assigned"] > [data-cy^="menu-item-"] > div[data-menu-item-title="${itemTitle}"]`,
		),
	).toBeVisible({timeout: 10_000});
	const res = await saveMenuModal(page, modal);
	expect(res.status()).toBe(200);
	await expect(modal).toHaveCount(0, {timeout: 15_000});
	await waitForJQueryIdle(page);
}

test.describe('Navigation menus — menus, items, areas and the reader header', () => {
	// ── Scenario 1 — Out-of-the-box header ─────────────────────────────────────
	// A fresh journal already renders the seeded default menus (rule 3):
	// anonymous primary strip Current / Archives / About ▸ five children —
	// Announcements hidden while announcements are off (rule 6) — with the
	// system types resolving their fixed URLs (rule 8); the user strip is
	// Register + Login; the Search item exists in the pool but renders in no
	// strip; the multi-journal site's journal list renders the site user
	// menu (and no site primary menu). Logging in swaps the user strip to
	// the username's dropdown (Dashboard / View Profile / Logout) — plus
	// Administration for a SITE ADMIN only (manager dbarnes does not see it).
	test(
		'a fresh journal renders the default header strips; login swaps the user menu; Administration is admin-only',
		{tag: ['@smoke', '@regression']},
		async ({page, pkpApi, asUser, browser, baseURL}) => {
			test.slow();
			const tag = uniqueTag();
			const ctx = await seedJournal(pkpApi, tag);
			const homeUrl = `/index.php/${ctx.path}/`;

			// Anonymous reader: the default primary strip.
			const anon = await newAnonContext(browser, baseURL);
			const pub = await anon.newPage();
			await pub.goto(homeUrl);
			await expect(pub.locator(PRIMARY_UL)).toBeVisible();
			const rootTexts = await stripTexts(pub, `${PRIMARY_UL} > li > a`);
			expect(rootTexts).toEqual(['Current', 'Archives', 'About']);
			const allPrimary = await stripTexts(pub, `${PRIMARY_UL} a`);
			// About's five children (rule 3) — all displayed: the scratch
			// journal has a contact name and a default privacy statement.
			for (const child of [
				'About the Journal',
				'Submissions',
				'Editorial Masthead',
				'Privacy Statement',
				'Contact',
			]) {
				expect(allPrimary).toContain(child);
			}
			// Announcements is seeded but hidden while announcements are off.
			expect(allPrimary).not.toContain('Announcements');
			// System types resolve their fixed URLs (rule 8).
			expect(await stripHref(pub, PRIMARY_UL, 'Current')).toContain(
				'/issue/current',
			);
			expect(await stripHref(pub, PRIMARY_UL, 'Archives')).toContain(
				'/issue/archive',
			);
			// The About PARENT is a dropdown toggle at desktop widths: the
			// default theme's script swaps a parent-with-submenu's href for
			// '#' (main.js toggleDropdowns — the editor's "link may not be
			// followable on all devices" notice made real). The /about URL
			// lives on the About the Journal CHILD.
			await expect
				.poll(() => stripHref(pub, PRIMARY_UL, 'About'), {timeout: 10_000})
				.toBe('#');
			expect(
				await stripHref(pub, PRIMARY_UL, 'About the Journal'),
			).toContain('/about');
			expect(
				await stripHref(pub, PRIMARY_UL, 'Editorial Masthead'),
			).toContain('/about/editorialMasthead');

			// The anonymous user strip: Register + Login, nothing else.
			const userTexts = await stripTexts(pub, `${USER_UL} a`);
			expect(userTexts).toContain('Register');
			expect(userTexts).toContain('Login');
			expect(userTexts).not.toContain('Dashboard');
			expect(await stripHref(pub, USER_UL, 'Register')).toContain(
				'/user/register',
			);
			expect(await stripHref(pub, USER_UL, 'Login')).toContain('/login');

			// Search: in the pool (API read as the journal's manager)…
			const items = await navGet(page.request, ctx.path, '/items');
			expect(items.unassigned.map((i) => i.title)).toContain('Search');
			// …but rendered in NEITHER strip (the header's search icon link is
			// journal-homepage chrome, not a menu item — scoped to the uls).
			expect(allPrimary).not.toContain('Search');
			expect(userTexts).not.toContain('Search');

			// The multi-journal site's journal list renders the SITE user menu
			// (rule 3's site="1" subset) and no site primary menu.
			await pub.goto('/index.php/index');
			await expect(pub.locator(USER_UL)).toBeVisible();
			const siteUserTexts = await stripTexts(pub, `${USER_UL} a`);
			expect(siteUserTexts).toContain('Register');
			expect(siteUserTexts).toContain('Login');
			await expect(pub.locator(PRIMARY_UL)).toHaveCount(0);
			await anon.close();

			// Logged in as the journal MANAGER (not a site admin): the user
			// strip becomes the username dropdown; Administration stays hidden.
			await page.goto(homeUrl);
			await expect(page.locator(USER_UL)).toBeVisible();
			const mgrTexts = await stripTexts(page, `${USER_UL} a`);
			// The username parent AND the Dashboard child (both
			// NMI_TYPE_USER_DASHBOARD) carry the unread-task count suffix
			// (dashboardMenuItem.tpl) — match by prefix.
			expect(mgrTexts.some((t) => t.startsWith(MANAGER))).toBe(true);
			expect(mgrTexts.some((t) => t.startsWith('Dashboard'))).toBe(true);
			expect(mgrTexts).toContain('View Profile');
			expect(mgrTexts).toContain('Logout');
			expect(mgrTexts).not.toContain('Register');
			expect(mgrTexts).not.toContain('Login');
			expect(mgrTexts).not.toContain('Administration');

			// The SITE ADMIN additionally sees Administration (rule 6).
			const adminCtx = await asUser('admin');
			const adminPage = await adminCtx.newPage();
			await adminPage.goto(homeUrl);
			await expect(adminPage.locator(USER_UL)).toBeVisible();
			const adminTexts = await stripTexts(adminPage, `${USER_UL} a`);
			expect(adminTexts).toContain('Administration');
			expect(await stripHref(adminPage, USER_UL, 'Administration')).toContain(
				'/admin',
			);
		},
	);

	// ── Scenario 2 — Only settings-holders manage menus ────────────────────────
	// Section editor: the Website page bounces to authorizationDenied, the
	// grid answers a role denial, the API 401s; anonymous API 401s too. A
	// manager and the site admin both reach the Navigation tab (grids + the
	// theme's two areas over the API). ⚠ Row 130 asserted as documented:
	// after stripping *Permit settings* from the journal's manager group,
	// the manager loses the page AND the grids but KEEPS full API access —
	// GET 200, POST 201, PUT 200.
	test(
		'settings gate: section editor/anonymous refused, manager+admin in; stripped manager keeps API access (row 130)',
		{tag: '@regression'},
		async ({page, pkpApi, asUser, browser, baseURL}) => {
			test.slow();
			const tag = uniqueTag();
			const ctx = await seedJournal(pkpApi, tag, {
				users: [{username: 'dbuskins', roles: ['sectionEditor']}],
			});
			const gridFetchUrl = `/index.php/${ctx.path}/$$$call$$$/grid/navigation-menus/navigation-menus-grid/fetch-grid`;
			const apiUrl = `/index.php/${ctx.path}/api/v1/navigationMenus`;

			// The manager reaches the Navigation tab: both grids load.
			const {menusGrid, itemsGrid} = await openNavigationTab(page, ctx.path);
			await expect(gridRow(menusGrid, 'Primary Navigation Menu')).toBeVisible();
			await expect(gridRow(itemsGrid, 'Search')).toBeVisible();

			// The site admin reaches it too, and the areas endpoint lists the
			// active theme's two areas (rule 1).
			const adminCtx = await asUser('admin');
			const adminPageRes = await adminCtx.request.get(
				`/index.php/${ctx.path}/management/settings/website`,
			);
			expect(adminPageRes.status()).toBe(200);
			expect(adminPageRes.url()).not.toMatch(/authorizationDenied/);
			const areas = await navGet(adminCtx.request, ctx.path, '/areas');
			expect(areas.areas).toEqual(
				expect.arrayContaining(['primary', 'user']),
			);

			// Section editor: page refused…
			const seCtx = await asUser('dbuskins');
			const sePage = await seCtx.newPage();
			await sePage.goto(`/index.php/${ctx.path}/management/settings/website`);
			await expect(sePage).toHaveURL(/authorizationDenied/, {timeout: 15_000});
			// …grid refused (component router answers a status:false JSON with
			// the role denial — HTTP 200 by design)…
			const seGrid = await seCtx.request.get(gridFetchUrl);
			const seGridJson = await seGrid.json();
			expect(seGridJson.status).toBe(false);
			expect(seGridJson.content).toContain(
				'The current role does not have access to this operation.',
			);
			// …API refused.
			const seApi = await seCtx.request.get(`${apiUrl}/items`);
			expect(seApi.status()).toBe(401);

			// Anonymous API: 401 as well.
			const anon = await newAnonContext(browser, baseURL);
			const anonApi = await anon.request.get(`${apiUrl}/items`);
			expect(anonApi.status()).toBe(401);
			await anon.close();

			// ⚠ Row 130 — strip Permit settings from the scratch journal's
			// manager group (as admin, through the roles grid; omitting the
			// checkbox saves it off — same idiom as journal-masthead-settings).
			const groupsRes = await adminCtx.request.get(
				`/index.php/${ctx.path}/api/v1/userGroups`,
			);
			expect(groupsRes.ok()).toBeTruthy();
			const mgrGroup = (await groupsRes.json()).items.find(
				(g) => g.name === 'Journal manager',
			);
			expect(mgrGroup, 'Journal manager group found').toBeTruthy();
			const flip = await adminCtx.request.post(
				`/index.php/${ctx.path}/$$$call$$$/grid/settings/roles/user-group-grid/update-user-group`,
				{
					form: {
						csrfToken: await csrfFor(adminCtx),
						userGroupId: String(mgrGroup.id),
						roleId: '16',
						'name[en]': mgrGroup.name,
						'abbrev[en]': mgrGroup.abbrev || 'JM',
					},
				},
			);
			expect(flip.status()).toBe(200);
			expect((await flip.json()).status).toBe(true);

			// The stripped manager: page refused…
			await page.goto(`/index.php/${ctx.path}/management/settings/website`);
			await expect(page).toHaveURL(/authorizationDenied/, {timeout: 15_000});
			// …grid refused (the settings policy's "Access denied.")…
			const mgrGrid = await page.request.get(gridFetchUrl);
			const mgrGridJson = await mgrGrid.json();
			expect(mgrGridJson.status).toBe(false);
			expect(mgrGridJson.content).toContain('Access denied.');
			// …but the API stays wide open — read, create AND edit (as-built;
			// do NOT green-flag this as intended behavior).
			const mgrRead = await page.request.get(`${apiUrl}/items`);
			expect(mgrRead.status(), 'row 130: API read kept').toBe(200);
			const csrf = await csrfFor(page.context());
			const created = await page.request.post(apiUrl, {
				headers: {'X-Csrf-Token': csrf, 'Content-Type': 'application/json'},
				data: {title: `Row130 ${tag}`, areaName: ''},
			});
			expect(created.status(), 'row 130: API create kept').toBe(201);
			const createdMenu = await created.json();
			const edited = await page.request.put(`${apiUrl}/${createdMenu.id}`, {
				headers: {'X-Csrf-Token': csrf, 'Content-Type': 'application/json'},
				data: {title: `Row130b ${tag}`},
			});
			expect(edited.status(), 'row 130: API edit kept').toBe(200);
			expect((await edited.json()).title).toBe(`Row130b ${tag}`);
		},
	);

	// ── Scenario 3 — Compose and mount a menu ──────────────────────────────────
	// Add Menu: a duplicate title is refused (422 + inline message), an
	// occupied area is refused (422 + inline message); saved with area None
	// + the pool's Search item dragged in, the menu is parked — nothing
	// renders. Parking the default user menu empties the `user` strip, and
	// mounting our menu there makes the header follow the assignment
	// (rules 1–2 + 9).
	test(
		'compose a menu: duplicate title + occupied area refused; None parks it; area assignment mounts it in the header',
		{tag: ['@smoke', '@regression']},
		async ({page, pkpApi, browser, baseURL}) => {
			test.slow();
			const tag = uniqueTag();
			const menuTitle = `Nmt Menu ${tag}`;
			const ctx = await seedJournal(pkpApi, tag);
			const homeUrl = `/index.php/${ctx.path}/`;

			const {menusGrid} = await openNavigationTab(page, ctx.path);
			await menusGrid.locator('a[id*="-addNavigationMenu-button-"]').click();
			const modal = await awaitMenuModal(page);
			const titleInput = modal.locator('input[id$="-title-control"]');
			const areaSelect = modal.locator('select[id$="-areaName-control"]');

			// Duplicate title → 422 + the exact message.
			await titleInput.fill('Primary Navigation Menu');
			let res = await saveMenuModal(page, modal);
			expect(res.status()).toBe(422);
			await expect(
				modal
					.getByText('This title already exists for another navigation menu.')
					.first(),
			).toBeVisible();

			// Unique title but an OCCUPIED area → 422 + the exact message.
			await titleInput.fill(menuTitle);
			await areaSelect.selectOption('primary');
			res = await saveMenuModal(page, modal);
			expect(res.status()).toBe(422);
			await expect(
				modal
					.getByText('A navigation menu is already assigned to this area.')
					.first(),
			).toBeVisible();

			// Area None + drag Search from the pool into the (empty) assigned
			// panel → 201. The grid picks the new row up via dataChanged.
			await areaSelect.selectOption('');
			const searchItem = modal.locator(
				'[data-cy="panel-content-unassigned"] div[data-menu-item-title="Search"]',
			);
			await expect(searchItem).toBeVisible();
			await dragItemTo(
				page,
				searchItem,
				modal.locator('[data-cy="panel-content-assigned"]'),
			);
			await expect(
				modal.locator(
					'[data-cy="panel-content-assigned"] div[data-menu-item-title="Search"]',
				),
			).toBeVisible({timeout: 10_000});
			res = await saveMenuModal(page, modal);
			expect(res.status()).toBe(201);
			await expect(modal).toHaveCount(0, {timeout: 15_000});
			await waitForJQueryIdle(page);
			await expect(gridRow(menusGrid, menuTitle)).toBeVisible({
				timeout: 15_000,
			});

			// Parked (area None): nothing renders anywhere (rule 2).
			const anon = await newAnonContext(browser, baseURL);
			const pub = await anon.newPage();
			await pub.goto(homeUrl);
			await expect(pub.locator(PRIMARY_UL)).toBeVisible();
			expect(await stripTexts(pub, `${PRIMARY_UL} a`)).not.toContain('Search');
			expect(await stripTexts(pub, `${USER_UL} a`)).not.toContain('Search');

			// Park the default User Navigation Menu → the user strip vanishes.
			await clickRowAction(page, menusGrid, 'User Navigation Menu', 'edit');
			let editModal = await awaitMenuModal(page);
			await editModal.locator('select[id$="-areaName-control"]').selectOption('');
			res = await saveMenuModal(page, editModal);
			expect(res.status()).toBe(200);
			await expect(editModal).toHaveCount(0, {timeout: 15_000});
			await pub.goto(homeUrl);
			await expect(pub.locator(PRIMARY_UL)).toBeVisible();
			await expect(pub.locator(USER_UL)).toHaveCount(0);

			// Mount OUR menu on the freed `user` area → the header follows:
			// the strip now renders our Search item (with its system URL).
			await waitForJQueryIdle(page);
			await clickRowAction(page, menusGrid, menuTitle, 'edit');
			editModal = await awaitMenuModal(page);
			await editModal
				.locator('select[id$="-areaName-control"]')
				.selectOption('user');
			res = await saveMenuModal(page, editModal);
			expect(res.status()).toBe(200);
			await expect(editModal).toHaveCount(0, {timeout: 15_000});
			await pub.goto(homeUrl);
			await expect(pub.locator(USER_UL)).toBeVisible();
			const userTexts = await stripTexts(pub, `${USER_UL} a`);
			expect(userTexts).toContain('Search');
			expect(userTexts).not.toContain('Register');
			expect(await stripHref(pub, USER_UL, 'Search')).toContain('/search');
			await anon.close();
		},
	);

	// ── Scenario 4 — Publish a custom page ─────────────────────────────────────
	// The Custom Page item: a malformed path is refused, the unsaved
	// title/content preview in a new tab, the page is served anonymously at
	// /{path} the moment the item saves — before ANY placement (rule 7,
	// with the contactName placeholder substituted); a duplicate path is
	// refused; dragging the item into the primary menu links it from the
	// header. ⚠ Row 132(c): an anonymous forged preview POST → raw 500.
	test(
		'custom page: bad/duplicate path refused, preview, served pre-placement, header links after drag-in',
		{tag: '@regression'},
		async ({page, pkpApi, browser, baseURL}) => {
			test.slow();
			const tag = uniqueTag();
			const ctx = await seedJournal(pkpApi, tag);
			const itemTitle = `Team ${tag}`;
			const pagePath = `team${tag}`;
			const marker = `custompagemarker${tag}`;

			const {menusGrid, itemsGrid} = await openNavigationTab(page, ctx.path);
			let form = await openAddItemModal(page, itemsGrid);
			await form.locator('input[name="title[en]"]').fill(itemTitle);
			await form.locator('select#menuItemType').selectOption('NMI_TYPE_CUSTOM');
			await expect(form.locator('#NMI_TYPE_CUSTOM')).toBeVisible();
			// Query params are a system-type field — hidden for Custom Page.
			await expect(form.locator('#queryParamsSection')).toBeHidden();

			// A malformed path is refused: {status:false}, the modal stays
			// open, no row appears. (The message itself travels the shared
			// notification channel — not asserted; see file header.)
			await form.locator('input[name="path"]').fill('bad path!');
			let saveBody = await saveItemForm(page, form);
			expect(saveBody.status, 'pathRegEx refusal').toBe(false);
			await expect(form).toBeVisible();

			// Fix the path, write rich-text content (with a substitutable
			// placeholder), preview the UNSAVED item in its popup tab.
			await form.locator('input[name="path"]').fill(pagePath);
			const contentId = await form
				.locator('textarea[name="content[en]"]')
				.getAttribute('id');
			await setTinyMceContent(
				page,
				String(contentId),
				`<p>${marker} maintained by {$contactName}</p>`,
			);
			const [preview] = await Promise.all([
				page.waitForEvent('popup'),
				form.locator('#previewButton').click(),
			]);
			await expect(preview.getByText(marker)).toBeVisible({timeout: 15_000});
			await expect(
				preview.getByRole('heading', {name: itemTitle}),
			).toBeVisible();
			await preview.close();

			// Save → the item lands in the pool grid.
			saveBody = await saveItemForm(page, form);
			expect(saveBody.status).toBe(true);
			await expect(form).toHaveCount(0, {timeout: 15_000});
			await expect(gridRow(itemsGrid, itemTitle)).toBeVisible({
				timeout: 15_000,
			});

			// Served ANONYMOUSLY at /{path} immediately — in no menu yet —
			// with the journal-contact placeholder substituted (rule 7).
			const anon = await newAnonContext(browser, baseURL);
			const pub = await anon.newPage();
			const view = await pub.goto(`/index.php/${ctx.path}/${pagePath}`);
			expect(view?.status()).toBe(200);
			await expect(
				pub.getByRole('heading', {name: itemTitle}),
			).toBeVisible();
			await expect(pub.getByText(marker)).toBeVisible();
			await expect(
				pub.getByText('maintained by Test Contact'),
			).toBeVisible();
			// The header does NOT link it yet.
			await pub.goto(`/index.php/${ctx.path}/`);
			await expect(pub.locator(PRIMARY_UL)).toBeVisible();
			expect(await stripTexts(pub, `${PRIMARY_UL} a`)).not.toContain(itemTitle);

			// ⚠ Row 132(c): an anonymous forged preview request → raw 500.
			const forged = await anon.request.post(
				`/index.php/${ctx.path}/navigationMenu/preview`,
				{form: {'title[en]': 'x', 'content[en]': 'y'}},
			);
			expect(forged.status(), 'row 132c: anonymous preview 500s').toBe(500);

			// A duplicate path is refused on a second item; a unique path
			// then saves cleanly.
			form = await openAddItemModal(page, itemsGrid);
			await form.locator('input[name="title[en]"]').fill(`Dup ${tag}`);
			await form.locator('select#menuItemType').selectOption('NMI_TYPE_CUSTOM');
			await form.locator('input[name="path"]').fill(pagePath);
			saveBody = await saveItemForm(page, form);
			expect(saveBody.status, 'duplicatePath refusal').toBe(false);
			await expect(form).toBeVisible();
			await form.locator('input[name="path"]').fill(`${pagePath}b`);
			saveBody = await saveItemForm(page, form);
			expect(saveBody.status).toBe(true);
			await expect(form).toHaveCount(0, {timeout: 15_000});

			// Drag the item into the primary menu → the header links the page.
			await placeItemInPrimaryMenu(page, menusGrid, itemTitle);
			await pub.goto(`/index.php/${ctx.path}/`);
			await expect(pub.locator(PRIMARY_UL)).toBeVisible();
			expect(await stripTexts(pub, `${PRIMARY_UL} a`)).toContain(itemTitle);
			expect(await stripHref(pub, PRIMARY_UL, itemTitle)).toContain(
				`/${pagePath}`,
			);
			await anon.close();
		},
	);

	// ── Scenario 5 — External link ──────────────────────────────────────────────
	// A Remote URL item: an invalid URL is refused ({status:false}); a valid
	// one saves; placed in the primary menu it renders as a PLAIN external
	// href in the header (rule 7's remote branch).
	test(
		'remote URL item: invalid URL refused; the header renders a plain external link',
		{tag: '@regression'},
		async ({page, pkpApi, browser, baseURL}) => {
			test.slow();
			const tag = uniqueTag();
			const ctx = await seedJournal(pkpApi, tag);
			const itemTitle = `Partner ${tag}`;
			const remoteUrl = `https://example.org/nmt/${tag}`;

			const {menusGrid, itemsGrid} = await openNavigationTab(page, ctx.path);
			const form = await openAddItemModal(page, itemsGrid);
			await form.locator('input[name="title[en]"]').fill(itemTitle);
			await form
				.locator('select#menuItemType')
				.selectOption('NMI_TYPE_REMOTE_URL');
			await expect(form.locator('#NMI_TYPE_REMOTE_URL')).toBeVisible();
			// Query params are hidden for Remote URL too (Fields table).
			await expect(form.locator('#queryParamsSection')).toBeHidden();

			// Invalid URL → refused, form stays open, no row.
			await form.locator('input[name="remoteUrl[en]"]').fill('not-a-url');
			let saveBody = await saveItemForm(page, form);
			expect(saveBody.status, 'customUrlError refusal').toBe(false);
			await expect(form).toBeVisible();
			await expect(gridRow(itemsGrid, itemTitle)).toHaveCount(0);

			// Valid URL → saved into the pool.
			await form.locator('input[name="remoteUrl[en]"]').fill(remoteUrl);
			saveBody = await saveItemForm(page, form);
			expect(saveBody.status).toBe(true);
			await expect(form).toHaveCount(0, {timeout: 15_000});
			await expect(gridRow(itemsGrid, itemTitle)).toBeVisible({
				timeout: 15_000,
			});

			// Place it, then read the header anonymously: a plain external href.
			await placeItemInPrimaryMenu(page, menusGrid, itemTitle);
			const anon = await newAnonContext(browser, baseURL);
			const pub = await anon.newPage();
			await pub.goto(`/index.php/${ctx.path}/`);
			await expect(pub.locator(PRIMARY_UL)).toBeVisible();
			expect(await stripTexts(pub, `${PRIMARY_UL} a`)).toContain(itemTitle);
			expect(await stripHref(pub, PRIMARY_UL, itemTitle)).toBe(remoteUrl);
			await anon.close();
		},
	);

	// ── Scenario 6 — Conditional links follow journal state ────────────────────
	// On one scratch journal, each settings flip lands on the next anonymous
	// load (rules 6 + 9): enabling announcements ADDS the Announcements
	// link; disabling registration REMOVES Register (Login stays); blanking
	// the privacy statement REMOVES Privacy Statement; publishingMode=NONE
	// hides Current + Archives (the OJS types' front-end condition). In the
	// editor, info icons announce the conditions — with the documented gaps:
	// ⚠ row 131 (Current carries NO icon though the front end hides it) and
	// ⚠ row 132a (About warns about an About-text condition that does not
	// exist — the About link renders with empty About text throughout).
	test(
		'conditional display: announcements/register/privacy/publishing flips land anonymously; editor icons show rows 131+132a gaps',
		{tag: '@regression'},
		async ({page, pkpApi, browser, baseURL}) => {
			test.slow();
			const tag = uniqueTag();
			const ctx = await seedJournal(pkpApi, tag);
			const homeUrl = `/index.php/${ctx.path}/`;
			const csrf = await csrfFor(page.context());

			const anon = await newAnonContext(browser, baseURL);
			const pub = await anon.newPage();

			// Baseline: no Announcements; Register + Login; Privacy Statement
			// shown (default statement seeded); About shown with EMPTY About
			// text (row 132a's front-end half).
			await pub.goto(homeUrl);
			await expect(pub.locator(PRIMARY_UL)).toBeVisible();
			let primary = await stripTexts(pub, `${PRIMARY_UL} a`);
			expect(primary).not.toContain('Announcements');
			expect(primary).toContain('About');
			expect(primary).toContain('Privacy Statement');
			let user = await stripTexts(pub, `${USER_UL} a`);
			expect(user).toContain('Register');
			expect(user).toContain('Login');

			// Enable announcements → the link appears on the next load.
			let res = await putContext(
				page.request,
				ctx.path,
				ctx.id,
				{enableAnnouncements: true},
				csrf,
			);
			expect(res.status(), await res.text()).toBe(200);
			await pub.goto(homeUrl);
			await expect(pub.locator(PRIMARY_UL)).toBeVisible();
			primary = await stripTexts(pub, `${PRIMARY_UL} a`);
			expect(primary).toContain('Announcements');
			expect(await stripHref(pub, PRIMARY_UL, 'Announcements')).toContain(
				'/announcement',
			);

			// Disable user registration → Register goes, Login stays.
			res = await putContext(
				page.request,
				ctx.path,
				ctx.id,
				{disableUserReg: true},
				csrf,
			);
			expect(res.status()).toBe(200);
			await pub.goto(homeUrl);
			await expect(pub.locator(USER_UL)).toBeVisible();
			user = await stripTexts(pub, `${USER_UL} a`);
			expect(user).not.toContain('Register');
			expect(user).toContain('Login');

			// Blank the privacy statement → Privacy Statement goes.
			res = await putContext(
				page.request,
				ctx.path,
				ctx.id,
				{privacyStatement: {en: ''}},
				csrf,
			);
			expect(res.status()).toBe(200);
			await pub.goto(homeUrl);
			await expect(pub.locator(PRIMARY_UL)).toBeVisible();
			primary = await stripTexts(pub, `${PRIMARY_UL} a`);
			expect(primary).not.toContain('Privacy Statement');
			expect(primary).toContain('About'); // still up, About text empty

			// publishingMode = NONE → the OJS types Current + Archives hide
			// (row 131's front-end half).
			res = await putContext(
				page.request,
				ctx.path,
				ctx.id,
				{publishingMode: 2},
				csrf,
			);
			expect(res.status()).toBe(200);
			await pub.goto(homeUrl);
			await expect(pub.locator(PRIMARY_UL)).toBeVisible();
			primary = await stripTexts(pub, `${PRIMARY_UL} a`);
			expect(primary).not.toContain('Current');
			expect(primary).not.toContain('Archives');
			expect(primary).toContain('About');
			await anon.close();

			// The editor's info icons announce the conditions…
			const {menusGrid} = await openNavigationTab(page, ctx.path);
			await clickRowAction(page, menusGrid, 'Primary Navigation Menu', 'edit');
			const modal = await awaitMenuModal(page);
			await expect(
				modal.locator(
					'div[data-menu-item-title="Announcements"] button[title="This link will only be displayed if you have enabled announcements under Settings > Website."]',
				),
			).toHaveCount(1);
			// ⚠ Row 132(a): the About icon claims a condition that does not
			// exist (About always renders — asserted anonymously above).
			await expect(
				modal.locator(
					'div[data-menu-item-title="About"] button[title*="filled out the About the Journal"]',
				),
			).toHaveCount(1);
			// ⚠ Row 131: the OJS-typed Current item shows NO conditional icon
			// (no icon buttons at all) although the front end hides it.
			await expect(
				modal.locator('div[data-menu-item-title="Current"] button'),
			).toHaveCount(0);
			// Pristine modal — Cancel closes without an unsaved-changes prompt.
			await modal.getByRole('button', {name: 'Cancel', exact: true}).click();
			await expect(modal).toHaveCount(0, {timeout: 10_000});
		},
	);

	// ── Scenario 7 — Rearrange, rename, delete ─────────────────────────────────
	// In the primary menu's editor: drag-reorder top-level items (header
	// order flips), nest one level (header renders the submenu), a drag onto
	// a depth-2 item is REFUSED (client cap); an item placed in BOTH menus
	// survives unplacing from one (rule 4); renaming an item updates the
	// header immediately (rule 9); ⚠ row 133: the API stores a 3-level tree
	// (200) whose grandchild the header silently drops; deleting an item
	// removes it from every menu, deleting a menu leaves its items in the
	// pool (rule 10).
	test(
		'reorder + nest (depth capped), unplace keeps other placements, rename, 3-level API tree dropped (row 133), deletes cascade',
		{tag: '@regression'},
		async ({page, pkpApi, browser, baseURL}) => {
			test.slow();
			const tag = uniqueTag();
			const ctx = await seedJournal(pkpApi, tag);
			const homeUrl = `/index.php/${ctx.path}/`;
			const apiUrl = `/index.php/${ctx.path}/api/v1/navigationMenus`;
			const csrf = await csrfFor(page.context());
			const renamed = `Back Issues ${tag}`;

			const {menusGrid, itemsGrid} = await openNavigationTab(page, ctx.path);
			const primaryRowId = String(
				await gridRow(menusGrid, 'Primary Navigation Menu').getAttribute('id'),
			);
			const userRowId = String(
				await gridRow(menusGrid, 'User Navigation Menu').getAttribute('id'),
			);
			const primaryId = Number((primaryRowId.match(/-row-(\d+)/) || [])[1]);
			const userId = Number((userRowId.match(/-row-(\d+)/) || [])[1]);
			expect(primaryId).toBeGreaterThan(0);
			expect(userId).toBeGreaterThan(0);

			// Item-id map from the pool endpoint (titles are unique here).
			const pool = await navGet(page.request, ctx.path, '/items');
			const idOf = Object.fromEntries(
				pool.unassigned.map((i) => [i.title, i.menuItemId]),
			);
			for (const t of ['Search', 'About', 'Submissions', 'Editorial Masthead']) {
				expect(idOf[t], `pool has ${t}`).toBeTruthy();
			}

			// API setup: place Search in BOTH menus (rule 4 allows an item in
			// several menus at once — each holds its own placement).
			const putTree = async (menuId, menuTree) => {
				const r = await page.request.put(`${apiUrl}/${menuId}`, {
					headers: {'X-Csrf-Token': csrf, 'Content-Type': 'application/json'},
					data: {menuTree},
				});
				expect(r.status(), await r.text()).toBe(200);
			};
			const userItems = await navGet(page.request, ctx.path, `/${userId}/items`);
			await putTree(userId, [
				...toMenuTree(userItems.assigned),
				{menuItemId: idOf['Search'], seq: 99, parentId: null},
			]);
			const primaryItems = await navGet(
				page.request,
				ctx.path,
				`/${primaryId}/items`,
			);
			await putTree(primaryId, [
				...toMenuTree(primaryItems.assigned),
				{menuItemId: idOf['Search'], seq: 99, parentId: null},
			]);

			const anon = await newAnonContext(browser, baseURL);
			const pub = await anon.newPage();
			await pub.goto(homeUrl);
			await expect(pub.locator(PRIMARY_UL)).toBeVisible();
			expect(await stripTexts(pub, `${PRIMARY_UL} a`)).toContain('Search');
			expect(await stripTexts(pub, `${USER_UL} a`)).toContain('Search');

			// EDITOR SESSION 1 — reorder, nest, refuse-deeper. Root order
			// starts [Current, Archives, Announcements, About, Search].
			await clickRowAction(page, menusGrid, 'Primary Navigation Menu', 'edit');
			let modal = await awaitMenuModal(page);
			const assigned = (title) =>
				modal.locator(
					`[data-cy="panel-content-assigned"] div[data-menu-item-title="${title}"]`,
				);
			// Reorder: drop Archives on the panel's FIRST root drop zone
			// (the band above Current) → reorder-above. The zone's top
			// anchor is layout-stable while the ghost preview expands, so
			// the re-measuring drag converges (dropping on the item's own
			// shifting top edge does not).
			const firstRootZone = modal
				.locator(
					'[data-cy="panel-content-assigned"] > div.relative:not([data-cy])',
				)
				.first()
				.locator('div')
				.first();
			await dragItemTo(page, assigned('Archives'), firstRootZone);
			await expect
				.poll(() => assignedRootTitles(modal), {timeout: 10_000})
				.toEqual(['Archives', 'Current', 'Announcements', 'About', 'Search']);
			// Nest: drop Search on Current's CENTER → make-child (depth 2).
			await dragItemTo(page, assigned('Search'), assigned('Current'));
			const currentWrapper = modal
				.locator('[data-cy="panel-content-assigned"] > [data-cy^="menu-item-"]')
				.filter({has: page.locator('div[data-menu-item-title="Current"]')});
			await expect(
				currentWrapper.locator('div[data-menu-item-title="Search"]'),
			).toBeVisible({timeout: 10_000});
			// Refused: dropping Announcements on a DEPTH-2 item (Submissions,
			// child of About) is blocked by the editor's depth cap — the tree
			// is unchanged.
			await dragItemTo(page, assigned('Announcements'), assigned('Submissions'));
			await expect
				.poll(() => assignedRootTitles(modal), {timeout: 10_000})
				.toEqual(['Archives', 'Current', 'Announcements', 'About']);
			const aboutWrapper = modal
				.locator('[data-cy="panel-content-assigned"] > [data-cy^="menu-item-"]')
				.filter({has: page.locator('div[data-menu-item-title="About"]')});
			await expect(
				aboutWrapper.locator('div[data-menu-item-title="Announcements"]'),
			).toHaveCount(0);
			let res = await saveMenuModal(page, modal);
			expect(res.status()).toBe(200);
			await expect(modal).toHaveCount(0, {timeout: 15_000});
			await waitForJQueryIdle(page);

			// Header follows: Archives before Current (Announcements is
			// hidden — announcements off), Search now under Current, and
			// STILL in the user strip.
			await pub.goto(homeUrl);
			await expect(pub.locator(PRIMARY_UL)).toBeVisible();
			expect(await stripTexts(pub, `${PRIMARY_UL} > li > a`)).toEqual([
				'Archives',
				'Current',
				'About',
			]);
			const currentLi = pub
				.locator(`${PRIMARY_UL} > li`)
				.filter({has: pub.getByText('Current', {exact: true})})
				.first();
			await expect(currentLi.locator('ul')).toHaveCount(1);
			const currentSubTexts = await currentLi
				.locator('ul a')
				.evaluateAll((els) =>
					els.map((e) => (e.textContent || '').replace(/\s+/g, ' ').trim()),
				);
			expect(currentSubTexts).toEqual(['Search']);
			expect(await stripTexts(pub, `${USER_UL} a`)).toContain('Search');

			// EDITOR SESSION 2 — unplace Search from the primary menu: back
			// to the pool, still mounted in the user menu.
			await clickRowAction(page, menusGrid, 'Primary Navigation Menu', 'edit');
			modal = await awaitMenuModal(page);
			await dragItemTo(
				page,
				modal.locator(
					'[data-cy="panel-content-assigned"] div[data-menu-item-title="Search"]',
				),
				modal.locator('[data-cy="panel-content-unassigned"]'),
			);
			await expect(
				modal.locator(
					'[data-cy="panel-content-unassigned"] div[data-menu-item-title="Search"]',
				),
			).toBeVisible({timeout: 10_000});
			res = await saveMenuModal(page, modal);
			expect(res.status()).toBe(200);
			await expect(modal).toHaveCount(0, {timeout: 15_000});
			await waitForJQueryIdle(page);
			await pub.goto(homeUrl);
			await expect(pub.locator(PRIMARY_UL)).toBeVisible();
			expect(await stripTexts(pub, `${PRIMARY_UL} a`)).not.toContain('Search');
			expect(await stripTexts(pub, `${USER_UL} a`)).toContain('Search');

			// RENAME the Archives item through the legacy item modal — the
			// header updates on the next anonymous load (rule 9).
			await clickRowAction(page, itemsGrid, 'Archives', 'edit');
			const itemForm = page.locator('form#navigationMenuItemsForm');
			const itemTitleInput = itemForm.locator('input[name="title[en]"]');
			await expect(itemTitleInput).toBeVisible({timeout: 20_000});
			await itemTitleInput.fill(renamed);
			const renameBody = await saveItemForm(page, itemForm);
			expect(renameBody.status).toBe(true);
			await expect(itemForm).toHaveCount(0, {timeout: 15_000});
			await pub.goto(homeUrl);
			await expect(pub.locator(PRIMARY_UL)).toBeVisible();
			let primaryTexts = await stripTexts(pub, `${PRIMARY_UL} a`);
			expect(primaryTexts).toContain(renamed);
			expect(primaryTexts).not.toContain('Archives');
			expect(await stripHref(pub, PRIMARY_UL, renamed)).toContain(
				'/issue/archive',
			);

			// ⚠ Row 133 — the API stores a THREE-level tree (200) …
			await putTree(primaryId, [
				{menuItemId: idOf['Archives'], seq: 0, parentId: null},
				{menuItemId: idOf['Current'], seq: 1, parentId: null},
				{menuItemId: idOf['About'], seq: 2, parentId: null},
				{menuItemId: idOf['Submissions'], seq: 0, parentId: idOf['About']},
				{
					menuItemId: idOf['Editorial Masthead'],
					seq: 0,
					parentId: idOf['Submissions'],
				},
			]);
			const stored = await navGet(
				page.request,
				ctx.path,
				`/${primaryId}/items`,
			);
			const aboutNode = stored.assigned.find(
				(n) => n.menuItemId === idOf['About'],
			);
			const submissionsNode = aboutNode?.children?.find(
				(n) => n.menuItemId === idOf['Submissions'],
			);
			expect(
				submissionsNode?.children?.map((n) => n.menuItemId),
				'row 133: grandchild stored by the API',
			).toEqual([idOf['Editorial Masthead']]);
			// …but the header renders exactly two levels: the grandchild is
			// silently dropped and no third-level list exists.
			await pub.goto(homeUrl);
			await expect(pub.locator(PRIMARY_UL)).toBeVisible();
			primaryTexts = await stripTexts(pub, `${PRIMARY_UL} a`);
			expect(primaryTexts).toContain('Submissions');
			expect(primaryTexts).not.toContain('Editorial Masthead');
			await expect(pub.locator(`${PRIMARY_UL} li ul li ul`)).toHaveCount(0);

			// DELETE the Search ITEM — gone from every menu (it was mounted
			// in the user strip) and from the pool grid.
			await clickRowAction(page, itemsGrid, 'Search', 'remove');
			let dialog = page
				.locator('[data-cy="dialog"]')
				.filter({hasText: 'Are you sure'});
			await expect(dialog).toBeVisible({timeout: 10_000});
			let [delRes] = await Promise.all([
				page.waitForResponse(
					(r) => r.url().includes('delete-navigation-menu-item'),
					{timeout: 20_000},
				),
				dialog.getByRole('button', {name: 'OK', exact: true}).click(),
			]);
			expect(delRes.status()).toBe(200);
			await waitForJQueryIdle(page);
			await expect(gridRow(itemsGrid, 'Search')).toHaveCount(0);
			await pub.goto(homeUrl);
			await expect(pub.locator(USER_UL)).toBeVisible();
			expect(await stripTexts(pub, `${USER_UL} a`)).not.toContain('Search');

			// DELETE the PRIMARY MENU — its strip vanishes; its items survive
			// in the pool (the renamed Archives row is still listed).
			await clickRowAction(
				page,
				menusGrid,
				'Primary Navigation Menu',
				'remove',
			);
			dialog = page
				.locator('[data-cy="dialog"]')
				.filter({hasText: 'Are you sure'});
			await expect(dialog).toBeVisible({timeout: 10_000});
			[delRes] = await Promise.all([
				page.waitForResponse(
					(r) => r.url().includes('delete-navigation-menu'),
					{timeout: 20_000},
				),
				dialog.getByRole('button', {name: 'OK', exact: true}).click(),
			]);
			expect(delRes.status()).toBe(200);
			await waitForJQueryIdle(page);
			await expect(
				gridRow(menusGrid, 'Primary Navigation Menu'),
			).toHaveCount(0);
			await expect(gridRow(itemsGrid, renamed)).toBeVisible();
			await pub.goto(homeUrl);
			await expect(pub.locator('.pkp_structure_head')).toBeVisible();
			await expect(pub.locator(PRIMARY_UL)).toHaveCount(0);
			await expect(pub.locator(USER_UL)).toBeVisible();
			await anon.close();
		},
	);
});
