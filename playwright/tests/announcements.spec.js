// @ts-check
const {execFileSync} = require('child_process');
const {test, expect} = require('../support/fixtures.js');
const {
	WebsiteSettingsPage,
} = require('../../lib/pkp/playwright/pages/WebsiteSettingsPage.js');
const {
	UserProfilePage,
} = require('../../lib/pkp/playwright/pages/UserProfilePage.js');
const {LoginPage} = require('../../lib/pkp/playwright/pages/LoginPage.js');
const {
	setTinyMceContent,
} = require('../../lib/pkp/playwright/support/tinymce.js');
const {
	waitForJQueryIdle,
} = require('../../lib/pkp/playwright/support/jquery.js');

/**
 * Announcements — the journal news channel: the enable toggle (Settings →
 * Website → Setup → Announcements), the two-tab management area (Vue list
 * panel + legacy types grid), the reader listing/detail pages, and the
 * notify-on-create job/email/in-app chain. One test per canonical scenario
 * of docs/product/specs/announcements.md (6 scenarios → 6 tests, 1:1).
 *
 * Parallel-safety: EVERY mutation runs on a per-test scratch journal
 * (unique hyphenless `annt…` path). publicknowledge's announcement state
 * (enableAnnouncements=1, no announcements) is load-bearing for other
 * suites and is NEVER touched — not even to create an announcement.
 * Mailpit reads are scoped by recipient + unique one-token title markers
 * (pkpMail.find / expectNone); no clearAll. The spec author's scratch
 * journals ann1/ann2 are not depended on.
 *
 * KNOWN LEDGER ROWS asserted AS-BUILT (feedback discipline — flip these
 * when the code is fixed):
 *   - ⚠ Row 141 (test 4): deleting an announcement TYPE cascade-deletes
 *     its announcements behind the GENERIC "delete this item?" confirm —
 *     the dedicated cascade warning string exists but is wired to nothing.
 *     Asserted on a scratch journal: typed announcement gone, untyped
 *     survivor kept.
 *   - ⚠ Row 143a (test 5): the Send-Email checkbox renders on the EDIT
 *     modal but editing never notifies (no new rows, no mail).
 *   - Row 142 (edit + bad image deletes the announcement) is NOT probed:
 *     no canonical scenario covers it and it is pure data-loss bait.
 *   - OQ feature 80: in-app new-announcement notifications are WRITTEN
 *     (notification rows, type 8 = NOTIFICATION_TYPE_NEW_ANNOUNCEMENT,
 *     level NORMAL) but NO 3.6 UI surface renders them — the notify
 *     effect is asserted on the DB rows via read-only psql (the test DB
 *     is Postgres; .env.playwright carries the credentials), NOT via a
 *     bell/dashboard (there is nothing to see).
 *
 * Notify chain (test 5): create with Send Email → NewAnnouncementNotifyUsers
 * job batch → with [queues] job_runner = On the batch drains on subsequent
 * web requests, so the mail/row polls interleave cheap reader-page GETs
 * (each request's end-of-request JobRunner pops pending jobs) — no
 * hard-coded waits, no CLI drain (a CLI drain in the parallel project
 * could flush ANOTHER worker's seeding-faked mail jobs with the real
 * mailer, contaminating their negative assertions).
 *
 * AUTH: test.use dbarnes — manager of every scratch journal here. Reader
 * checks use explicit empty-storage anonymous contexts (patterns.md
 * item 8); scratch journals are single-locale → bare reader URLs.
 */

const MANAGER = 'dbarnes';

test.use({user: MANAGER});

/** Unique hyphenless alphanumeric tag; doubles as the scratch urlPath. */
function uniqueTag(prefix = 'annt') {
	const workerLetter = String.fromCharCode(
		97 + (test.info().parallelIndex % 26),
	);
	let suffix = '';
	while (suffix.length < 6) {
		suffix += Math.random().toString(36).replace(/[^a-z0-9]/g, '');
	}
	return `${prefix}${workerLetter}${suffix.slice(0, 6)}`;
}

/** Bare reader/backend base for a single-locale scratch journal. */
function base(journalPath) {
	return `/index.php/${journalPath}`;
}

/** Seed a scratch journal (dbarnes as manager + passthrough) → context. */
async function seedJournal(pkpApi, tag, extra = {}) {
	const {context} = await pkpApi.createJournal({
		tag,
		path: tag,
		primaryLocale: 'en',
		supportedLocales: ['en'],
		users: [{username: MANAGER, roles: ['manager']}, ...(extra.users ?? [])],
		...Object.fromEntries(
			Object.entries(extra).filter(([k]) => k !== 'users'),
		),
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

/**
 * Read-only query against the shared Postgres test DB — the only surface
 * that exposes the in-app new-announcement notification rows (OQ: no 3.6
 * UI renders them). Returns psql's -tAc output (one row per line).
 */
function dbQuery(sql) {
	return execFileSync(
		'psql',
		[
			'-h', process.env.OJS_DB_HOST || 'localhost',
			'-U', process.env.OJS_DB_USER || process.env.USER || 'postgres',
			'-d', process.env.OJS_DB_NAME || 'ojs_test',
			'-tAc', sql,
		],
		{
			encoding: 'utf8',
			env: {...process.env, PGPASSWORD: process.env.OJS_DB_PASSWORD || ''},
		},
	).trim();
}

/** NOTIFICATION_TYPE_NEW_ANNOUNCEMENT = 0x8, level NORMAL — count per user. */
function dbNotifyCount(contextId, username) {
	const out = dbQuery(
		`SELECT count(*) FROM notifications n JOIN users u ON u.user_id = n.user_id ` +
			`WHERE n.context_id = ${Number(contextId)} AND n.type = 8 ` +
			`AND u.username = '${username.replace(/'/g, "''")}'`,
	);
	return Number(out);
}

/** Open the announcements management area; wait for the Vue panel. */
async function gotoAnnouncementsArea(page, journalPath) {
	await page.goto(`${base(journalPath)}/management/settings/announcements`);
	await expect(
		page.getByRole('button', {name: 'Add Announcement'}),
	).toBeVisible({timeout: 20_000});
}

/** The list-panel item containing `text`. */
function panelItem(page, text) {
	return page
		.locator('.announcementsListPanel .listPanel__item')
		.filter({hasText: text});
}

/** Open the Add Announcement side modal; returns the modal locator. */
async function openAddModal(page) {
	await page.getByRole('button', {name: 'Add Announcement'}).click();
	const modal = page.locator('[data-cy="active-modal"]');
	await expect(
		modal.locator('input[id^="announcement-title-control"]'),
	).toBeVisible({timeout: 20_000});
	return modal;
}

/** Open the Edit modal for the panel item containing `text`. */
async function openEditModal(page, text) {
	await panelItem(page, text)
		.getByRole('button', {name: 'Edit', exact: true})
		.click();
	const modal = page.locator('[data-cy="active-modal"]');
	await expect(
		modal.locator('input[id^="announcement-title-control"]'),
	).toBeVisible({timeout: 20_000});
	return modal;
}

/**
 * Save the announcement form modal; both create (POST) and edit (PUT,
 * tunneled as POST + X-Http-Method-Override) land on the announcements
 * API. Returns the API response.
 */
async function saveAnnouncementModal(page, modal) {
	const [res] = await Promise.all([
		page.waitForResponse(
			(r) =>
				/\/api\/v1\/announcements(\/\d+)?$/.test(r.url().split('?')[0]) &&
				r.request().method() === 'POST',
			{timeout: 20_000},
		),
		modal.getByRole('button', {name: 'Save', exact: true}).click(),
	]);
	return res;
}

/** Fill the modal's Title (primary-locale) field. */
function titleInput(modal) {
	return modal.locator('input[id^="announcement-title-control"]');
}

/** GET the manager-gated announcements API from the page's session. */
async function apiGet(page, journalPath, suffix = '') {
	return page.request.get(
		`${base(journalPath)}/api/v1/announcements${suffix}`,
	);
}

/**
 * Poll Mailpit for {to, contains} while interleaving cheap reader-page
 * GETs — each app request's end-of-request JobRunner (job_runner = On)
 * drains pending NewAnnouncementNotifyUsers jobs, so the poll converges
 * without a hard-coded wait or a (parallel-unsafe) CLI drain.
 */
async function findMailWithDrain(
	page,
	journalPath,
	pkpMail,
	{to, contains},
	timeoutMs = 45_000,
) {
	const deadline = Date.now() + timeoutMs;
	let lastErr;
	for (;;) {
		await page.request.get(`${base(journalPath)}/announcement`);
		try {
			return await pkpMail.find({to, contains, timeoutMs: 2_000, poll: 400});
		} catch (err) {
			lastErr = err;
			if (Date.now() > deadline) throw lastErr;
		}
	}
}

/** Poll the DB notify count for a user, draining jobs between reads. */
async function expectNotifyCount(page, journalPath, contextId, username, count) {
	await expect
		.poll(
			async () => {
				await page.request.get(`${base(journalPath)}/announcement`);
				return dbNotifyCount(contextId, username);
			},
			{timeout: 45_000, intervals: [500, 1_000, 2_000, 3_000]},
		)
		.toBe(count);
}

/** Legacy types grid helpers (navigation-menus idiom). */
function gridRow(grid, title) {
	return grid.locator('tr.gridRow').filter({hasText: title}).first();
}

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

/** Open the Announcement Types tab; returns the grid container locator. */
async function openTypesTab(page) {
	await page.locator('#announcementTypes-button').click();
	const grid = page.locator('#announcementTypeGridContainer');
	await expect(
		grid.locator('a[id*="-addAnnouncementType-button-"]'),
	).toBeVisible({timeout: 20_000});
	await waitForJQueryIdle(page);
	return grid;
}

/** Save the legacy announcement-type form; returns the op's JSON body. */
async function saveTypeForm(page, form) {
	const [res] = await Promise.all([
		page.waitForResponse(
			(r) => r.url().includes('update-announcement-type'),
			{timeout: 20_000},
		),
		form.getByRole('button', {name: 'Save', exact: true}).click(),
	]);
	expect(res.status()).toBe(200);
	const body = await res.json();
	await waitForJQueryIdle(page);
	return body;
}

test.describe('Announcements', () => {
	// ── Scenario 1 — Enable and configure ──────────────────────────────────
	// On a fresh (disabled) journal: the reader list and detail URLs 404,
	// the backend left menu has no Announcements entry — yet the management
	// area's direct URL opens with a working Add button (the deliberate
	// settings-gate exemption). The Website → Setup → Announcements tab
	// shows only the enable checkbox; ticking it reveals Introduction and
	// Display on Homepage in place (no save needed); saving stores all
	// three. Then: the left menu gains Announcements, the reader page
	// serves (introduction above the — empty — list) and the nav item
	// appears in the anonymous header.
	test(
		'enable and configure: disabled journal 404s readers but keeps the manager area; the toggle reveals fields, stores, and lights the menus',
		{tag: ['@smoke', '@regression']},
		async ({page, pkpApi, browser, baseURL}) => {
			test.slow();
			const tag = uniqueTag();
			const ctx = await seedJournal(pkpApi, tag); // announcements OFF by default
			const introMarker = `annintro${tag}`;

			// Anonymous, while disabled: list and detail 404 (rule 1).
			const anon = await newAnonContext(browser, baseURL);
			try {
				const listRes = await anon.request.get(`${base(ctx.path)}/announcement`);
				expect(listRes.status(), 'disabled reader list 404s').toBe(404);
				const viewRes = await anon.request.get(
					`${base(ctx.path)}/announcement/view/1`,
				);
				expect(viewRes.status(), 'disabled reader detail 404s').toBe(404);

				// The manager: no Announcements left-menu entry while disabled,
				// but the area's direct URL still opens with a working Add
				// button (settings-gate exemption for ['announcements']).
				await gotoAnnouncementsArea(page, ctx.path);
				const sideNav = page.getByRole('navigation', {
					name: 'Site Navigation',
				});
				await expect(sideNav).toBeVisible({timeout: 15_000});
				await expect(
					sideNav.getByRole('link', {name: 'Announcements', exact: true}),
				).toHaveCount(0);
				const modal = await openAddModal(page); // the Add button works
				await expect(titleInput(modal)).toBeEditable();
				await page.keyboard.press('Escape');
				await expect(modal).toHaveCount(0, {timeout: 10_000});

				// Settings → Website → Setup → Announcements: only the enable
				// checkbox shows; ticking reveals the two dependent fields in
				// place (showWhen — no save needed).
				const website = new WebsiteSettingsPage(page, ctx.path);
				await website.goto();
				const panel = await website.openSetupTab('announcements');
				const enableBox = panel.getByRole('checkbox', {
					name: 'Enable announcements',
				});
				await expect(enableBox).not.toBeChecked();
				const homepageCount = panel.locator(
					'input[id^="announcementSettings-numAnnouncementsHomepage-control"]',
				);
				await expect(homepageCount).toHaveCount(0);
				await expect(panel.getByText('Introduction')).toHaveCount(0);

				await enableBox.check();
				await expect(homepageCount).toBeVisible();
				await expect(panel.getByText('Introduction').first()).toBeVisible();

				// Fill Introduction + Display on Homepage, save, and confirm
				// all three stored (the contexts API echoes the settings).
				await setTinyMceContent(
					page,
					'announcementSettings-announcementsIntroduction-control-en',
					`<p>${introMarker}</p>`,
				);
				await homepageCount.fill('2');
				await website.saveForm(panel);
				const ctxRes = await page.request.get(
					`${base(ctx.path)}/api/v1/contexts/${ctx.id}`,
				);
				expect(ctxRes.ok()).toBeTruthy();
				const stored = await ctxRes.json();
				expect(stored.enableAnnouncements).toBe(true);
				expect(String(stored.numAnnouncementsHomepage)).toBe('2');
				expect(stored.announcementsIntroduction?.en).toContain(introMarker);

				// The backend left menu gains Announcements…
				await gotoAnnouncementsArea(page, ctx.path);
				await expect(
					sideNav.getByRole('link', {name: 'Announcements', exact: true}),
				).toBeVisible({timeout: 15_000});

				// …the reader page starts serving (introduction rendered above
				// the — still empty — list)…
				const pub = await anon.newPage();
				await pub.goto(`${base(ctx.path)}/announcement`);
				await expect(
					pub.getByRole('heading', {name: 'Announcements'}),
				).toBeVisible();
				await expect(pub.getByText(introMarker)).toBeVisible();

				// …and the conditional nav item appears in the reader header.
				await pub.goto(`${base(ctx.path)}/`);
				await expect(pub.locator('ul#navigationPrimary')).toBeVisible();
				await expect(
					pub.locator('ul#navigationPrimary a', {
						hasText: 'Announcements',
					}),
				).toHaveCount(1);
			} finally {
				await anon.close();
			}
		},
	);

	// ── Scenario 2 — Announcement CRUD with reader effect-links ────────────
	// Title alone suffices to create; the new announcement tops the panel
	// and, immediately, the reader list (introduction above it), its detail
	// page, and the home-page section (count set). Newest-first everywhere.
	// Edit updates in place; the panel search finds items by title or
	// description text; Delete (confirm dialog) removes it from the panel
	// and the reader side.
	test(
		'announcement CRUD: create tops panel + reader list/detail/home, edit in place, search by title and description, delete removes everywhere',
		{tag: ['@smoke', '@regression']},
		async ({page, pkpApi, browser, baseURL}) => {
			test.slow();
			const tag = uniqueTag();
			const ctx = await seedJournal(pkpApi, tag, {
				enableAnnouncements: true,
				numAnnouncementsHomepage: 5,
			});
			const introMarker = `annintro${tag}`;
			const titleA = `TitleA ${tag}a1`;
			const titleA2 = `Retitled ${tag}a2`;
			const titleB = `TitleB ${tag}b1`;
			const descMarker = `anndesc${tag}`;

			// Introduction via the journal-settings API (owned by scenario 1's
			// form; here it is only the reader-list backdrop).
			const csrf = await csrfFor(page.context());
			const putRes = await page.request.put(
				`${base(ctx.path)}/api/v1/contexts/${ctx.id}`,
				{
					headers: {'X-Csrf-Token': csrf, 'Content-Type': 'application/json'},
					data: {announcementsIntroduction: {en: `<p>${introMarker}</p>`}},
				},
			);
			expect(putRes.status()).toBe(200);

			// CREATE with title only (all other fields optional).
			await gotoAnnouncementsArea(page, ctx.path);
			let modal = await openAddModal(page);
			await titleInput(modal).fill(titleA);
			let res = await saveAnnouncementModal(page, modal);
			expect(res.status(), await res.text()).toBe(200);
			const announcementA = await res.json();
			await expect(panelItem(page, titleA)).toHaveCount(1, {timeout: 15_000});

			// The item's View action links the reader detail page.
			await expect(
				panelItem(page, titleA).getByRole('link', {name: 'View', exact: true}),
			).toHaveAttribute('href', /\/announcement\/view\/\d+/);

			// Reader effect-links, immediately: list (introduction above it),
			// detail, home-page section.
			const anon = await newAnonContext(browser, baseURL);
			try {
				const pub = await anon.newPage();
				await pub.goto(`${base(ctx.path)}/announcement`);
				await expect(pub.getByText(introMarker)).toBeVisible();
				await expect(pub.getByRole('link', {name: titleA, exact: true})).toBeVisible();
				await pub.goto(`${base(ctx.path)}/announcement/view/${announcementA.id}`);
				await expect(
					pub.getByRole('heading', {name: titleA, exact: true}),
				).toBeVisible();
				await pub.goto(`${base(ctx.path)}/`);
				const homeSection = pub.locator('section.cmp_announcements');
				await expect(homeSection).toBeVisible();
				await expect(homeSection).toContainText(titleA);

				// SECOND announcement (short description carries a searchable
				// marker) — newest first in the panel AND on the reader list.
				modal = await openAddModal(page);
				await titleInput(modal).fill(titleB);
				await setTinyMceContent(
					page,
					'announcement-descriptionShort-control-en',
					`<p>${descMarker}</p>`,
				);
				res = await saveAnnouncementModal(page, modal);
				expect(res.status()).toBe(200);
				await expect(panelItem(page, titleB)).toHaveCount(1, {
					timeout: 15_000,
				});
				await expect
					.poll(async () =>
						page
							.locator('.announcementsListPanel .listPanel__itemTitle')
							.allTextContents()
							.then((t) => t.map((s) => s.trim())),
					)
					.toEqual([titleB, titleA]);
				await pub.goto(`${base(ctx.path)}/announcement`);
				const readerTitles = await pub
					.locator('.page_announcements .obj_announcement_summary h2 a')
					.allTextContents();
				expect(readerTitles.map((t) => t.trim())).toEqual([titleB, titleA]);
				// The list shows B's short description.
				await expect(pub.getByText(descMarker)).toBeVisible();

				// EDIT A in place (retitle) — panel row replaced, reader detail
				// follows.
				modal = await openEditModal(page, titleA);
				await expect(titleInput(modal)).toHaveValue(titleA);
				await titleInput(modal).fill(titleA2);
				res = await saveAnnouncementModal(page, modal);
				expect(res.status()).toBe(200);
				await expect(panelItem(page, titleA2)).toHaveCount(1, {
					timeout: 15_000,
				});
				await expect(panelItem(page, titleA)).toHaveCount(0);
				await pub.goto(`${base(ctx.path)}/announcement/view/${announcementA.id}`);
				await expect(
					pub.getByRole('heading', {name: titleA2, exact: true}),
				).toBeVisible();

				// SEARCH by title token…
				const searchInput = page.locator(
					'.announcementsListPanel input[type="search"]',
				);
				const searched = page.waitForResponse(
					(r) =>
						r.url().includes('/api/v1/announcements') &&
						r.url().includes(`searchPhrase=${tag}b1`),
					{timeout: 20_000},
				);
				await searchInput.click();
				await searchInput.pressSequentially(`${tag}b1`);
				await searched;
				await expect(panelItem(page, titleB)).toHaveCount(1);
				await expect(panelItem(page, titleA2)).toHaveCount(0);
				// …and by description text.
				await page
					.getByRole('button', {name: 'Clear search phrase'})
					.click();
				const searchedDesc = page.waitForResponse(
					(r) =>
						r.url().includes('/api/v1/announcements') &&
						r.url().includes(`searchPhrase=${descMarker}`),
					{timeout: 20_000},
				);
				await searchInput.pressSequentially(descMarker);
				await searchedDesc;
				await expect(panelItem(page, titleB)).toHaveCount(1);
				await expect(panelItem(page, titleA2)).toHaveCount(0);
				await page
					.getByRole('button', {name: 'Clear search phrase'})
					.click();
				await expect(panelItem(page, titleA2)).toHaveCount(1, {
					timeout: 15_000,
				});

				// DELETE B behind the confirm dialog (names the announcement).
				await panelItem(page, titleB)
					.getByRole('button', {name: 'Delete', exact: true})
					.click();
				const dialog = page
					.locator('[data-cy="dialog"]')
					.filter({hasText: 'permanently delete the announcement'});
				await expect(dialog).toBeVisible({timeout: 15_000});
				await expect(dialog).toContainText(titleB);
				const [deleteRes] = await Promise.all([
					page.waitForResponse(
						(r) =>
							/\/api\/v1\/announcements\/\d+$/.test(r.url().split('?')[0]) &&
							r.request().method() === 'POST', // tunneled DELETE
						{timeout: 20_000},
					),
					dialog.getByRole('button', {name: 'Yes', exact: true}).click(),
				]);
				expect(deleteRes.status()).toBe(200);
				await expect(panelItem(page, titleB)).toHaveCount(0, {
					timeout: 15_000,
				});
				await expect(panelItem(page, titleA2)).toHaveCount(1);

				// Reader side: gone from the list; the dead detail URL bounces
				// to the list (view() redirects when the id no longer resolves).
				await pub.goto(`${base(ctx.path)}/announcement`);
				await expect(pub.getByRole('link', {name: titleA2, exact: true})).toBeVisible();
				await expect(pub.getByText(titleB)).toHaveCount(0);
				const deadDetail = await anon.request.get(
					`${base(ctx.path)}/announcement/view/${(await deleteRes.json()).id}`,
					{maxRedirects: 0},
				);
				expect(deadDetail.status()).toBe(302);
				expect(deadDetail.headers()['location']).toContain(
					`/${ctx.path}/announcement`,
				);
			} finally {
				await anon.close();
			}
		},
	);

	// ── Scenario 3 — Expiry lifecycle ───────────────────────────────────────
	// A past Expiry Date (accepted on entry) drops the announcement from the
	// reader list and the home-page section and turns its detail URL into a
	// redirect to the list — while the manager panel and the API keep
	// listing it. Advancing the date resurrects it (expiry hides, never
	// deletes).
	test(
		'expiry hides from readers but stays in the manager panel and API; advancing the date resurrects',
		{tag: ['@smoke', '@regression']},
		async ({page, pkpApi, browser, baseURL}) => {
			const tag = uniqueTag();
			const expTitle = `Expiring ${tag}e1`;
			const ctlTitle = `Control ${tag}c1`;
			const ctx = await seedJournal(pkpApi, tag, {
				enableAnnouncements: true,
				numAnnouncementsHomepage: 5,
				announcements: [
					{title: {en: expTitle}},
					{title: {en: ctlTitle}},
				],
			});

			// Map the seeded titles to ids through the manager API.
			const listRes = await apiGet(page, ctx.path, `?searchPhrase=${tag}`);
			expect(listRes.status()).toBe(200);
			const items = (await listRes.json()).items;
			const expId = items.find((i) => i.title.en === expTitle)?.id;
			expect(expId, 'seeded announcement id resolved').toBeTruthy();

			const isoDate = (offsetDays) => {
				const d = new Date(Date.now() + offsetDays * 24 * 3600 * 1000);
				return d.toISOString().slice(0, 10);
			};

			const anon = await newAnonContext(browser, baseURL);
			try {
				// Baseline: both announcements live for readers.
				const pub = await anon.newPage();
				await pub.goto(`${base(ctx.path)}/announcement`);
				await expect(pub.getByRole('link', {name: expTitle, exact: true})).toBeVisible();
				await expect(pub.getByRole('link', {name: ctlTitle, exact: true})).toBeVisible();

				// The manager sets a PAST expiry date through the real edit
				// modal (past dates are accepted on entry — rule 5).
				await gotoAnnouncementsArea(page, ctx.path);
				let modal = await openEditModal(page, expTitle);
				await modal
					.locator('input[id^="announcement-dateExpire-control"]')
					.fill(isoDate(-2));
				let res = await saveAnnouncementModal(page, modal);
				expect(res.status(), await res.text()).toBe(200);

				// Reader list: dropped (control stays)…
				await pub.goto(`${base(ctx.path)}/announcement`);
				await expect(pub.getByRole('link', {name: ctlTitle, exact: true})).toBeVisible();
				await expect(pub.getByText(expTitle)).toHaveCount(0);
				// …home-page section: dropped…
				await pub.goto(`${base(ctx.path)}/`);
				const homeSection = pub.locator('section.cmp_announcements');
				await expect(homeSection).toBeVisible();
				await expect(homeSection).toContainText(ctlTitle);
				await expect(homeSection).not.toContainText(expTitle);
				// …detail: 302 back to the reader list.
				const expiredDetail = await anon.request.get(
					`${base(ctx.path)}/announcement/view/${expId}`,
					{maxRedirects: 0},
				);
				expect(expiredDetail.status()).toBe(302);
				expect(expiredDetail.headers()['location']).toContain(
					`/${ctx.path}/announcement`,
				);

				// The manager panel and the API both keep it (expiry ≠ delete).
				await gotoAnnouncementsArea(page, ctx.path);
				await expect(panelItem(page, expTitle)).toHaveCount(1);
				const apiOne = await apiGet(page, ctx.path, `/${expId}`);
				expect(apiOne.status(), 'API keeps the expired announcement').toBe(200);
				expect((await apiOne.json()).dateExpire).toContain(isoDate(-2));

				// Advancing the date resurrects it on every reader surface.
				modal = await openEditModal(page, expTitle);
				await modal
					.locator('input[id^="announcement-dateExpire-control"]')
					.fill(isoDate(+2));
				res = await saveAnnouncementModal(page, modal);
				expect(res.status()).toBe(200);
				await pub.goto(`${base(ctx.path)}/announcement`);
				await expect(pub.getByRole('link', {name: expTitle, exact: true})).toBeVisible();
				await pub.goto(`${base(ctx.path)}/announcement/view/${expId}`);
				await expect(
					pub.getByRole('heading', {name: expTitle}),
				).toBeVisible();
			} finally {
				await anon.close();
			}
		},
	);

	// ── Scenario 4 — Types: label vocabulary with a destructive delete ─────
	// With no types the announcement form has no type field. Creating a
	// type in the legacy grid makes a radio appear on the (re-rendered)
	// form; a typed announcement renders to readers with its PLAIN title
	// (no type prefix — the fullTitle composer is broken and unused,
	// row 143b). ⚠ Row 141: deleting the type shows only the GENERIC
	// "delete this item?" confirm — the dedicated cascade warning exists in
	// the locale files but nothing uses it — and silently deletes the typed
	// announcement; the untyped one survives.
	test(
		'types grid CRUD: radio appears once a type exists, reader shows plain title, delete is generic-confirm and cascades (row 141)',
		{tag: '@regression'},
		async ({page, pkpApi, browser, baseURL}) => {
			test.slow();
			const tag = uniqueTag();
			const ctx = await seedJournal(pkpApi, tag, {enableAnnouncements: true});
			const untypedTitle = `Untyped ${tag}u1`;
			const typedTitle = `Typed ${tag}t1`;
			const typeName = `Call for Papers ${tag}`;
			const typeRenamed = `CFP Renamed ${tag}`;

			// No types yet → the Add form has NO type radio group.
			await gotoAnnouncementsArea(page, ctx.path);
			let modal = await openAddModal(page);
			await expect(modal.getByRole('radio')).toHaveCount(0);
			await titleInput(modal).fill(untypedTitle);
			let res = await saveAnnouncementModal(page, modal);
			expect(res.status()).toBe(200);
			const untypedId = (await res.json()).id;

			// Types grid (tab 2): create…
			let grid = await openTypesTab(page);
			await grid.locator('a[id*="-addAnnouncementType-button-"]').click();
			const typeForm = page.locator('form#announcementTypeForm');
			await expect(typeForm.locator('input[name="name[en]"]')).toBeVisible({
				timeout: 20_000,
			});
			await typeForm.locator('input[name="name[en]"]').fill(typeName);
			let body = await saveTypeForm(page, typeForm);
			expect(body.status).toBe(true);
			// Wait for the AjaxModal to tear down fully before touching the
			// row actions (racing it detaches the next modal's handlers).
			await expect(typeForm).toHaveCount(0, {timeout: 15_000});
			await expect(gridRow(grid, typeName)).toBeVisible({timeout: 15_000});

			// …and edit (rename persists — asserted after a reload below).
			await clickRowAction(page, grid, typeName, 'edit');
			const editForm = page.locator('form#announcementTypeForm');
			const nameInput = editForm.locator('input[name="name[en]"]');
			await expect(nameInput).toBeVisible({timeout: 20_000});
			// The EDIT instance carries the hidden id (not the add form).
			await expect(
				editForm.locator('input[name="announcementTypeId"]'),
			).toBeAttached({timeout: 15_000});
			await expect(nameInput).toHaveValue(typeName);
			await nameInput.fill(typeRenamed);
			body = await saveTypeForm(page, editForm);
			expect(body.status).toBe(true);
			await expect(editForm).toHaveCount(0, {timeout: 15_000});

			// The announcement form's config is rendered server-side — reload
			// the area: the rename round-trips in the fresh types grid and
			// the Add modal now offers the type radio.
			await gotoAnnouncementsArea(page, ctx.path);
			grid = await openTypesTab(page);
			await expect(gridRow(grid, typeRenamed)).toBeVisible({timeout: 15_000});
			await expect(gridRow(grid, typeName)).toHaveCount(0);
			await page.locator('#announcements-button').click();
			modal = await openAddModal(page);
			const typeRadio = modal.getByRole('radio', {name: typeRenamed});
			await expect(typeRadio).toBeVisible();
			await titleInput(modal).fill(typedTitle);
			await typeRadio.check();
			res = await saveAnnouncementModal(page, modal);
			expect(res.status(), await res.text()).toBe(200);
			const typed = await res.json();
			expect(typed.typeId).toBeTruthy();

			// Reader detail: the PLAIN title, no type prefix (rule 6/row 143b).
			const anon = await newAnonContext(browser, baseURL);
			try {
				const pub = await anon.newPage();
				await pub.goto(`${base(ctx.path)}/announcement/view/${typed.id}`);
				const heading = pub.locator('.obj_announcement_full h1');
				await expect(heading).toHaveText(new RegExp(`^\\s*${typedTitle}\\s*$`));
				await expect(pub.getByText(`${typeRenamed}:`)).toHaveCount(0);

				// ⚠ Row 141 — delete the type: ONLY the generic confirm shows
				// (the dedicated cascade warning string is wired to nothing)…
				grid = await openTypesTab(page);
				await clickRowAction(page, grid, typeRenamed, 'remove');
				const dialog = page
					.locator('[data-cy="dialog"]')
					.filter({hasText: 'Are you sure you wish to delete this item?'});
				await expect(dialog).toBeVisible({timeout: 15_000});
				await expect(dialog).not.toContainText(
					'All announcements with this announcement type will also be deleted',
				);
				const [delRes] = await Promise.all([
					page.waitForResponse(
						(r) => r.url().includes('delete-announcement-type'),
						{timeout: 20_000},
					),
					dialog.getByRole('button', {name: 'OK', exact: true}).click(),
				]);
				expect(delRes.status()).toBe(200);
				await waitForJQueryIdle(page);
				await expect(gridRow(grid, typeRenamed)).toHaveCount(0);

				// …and the typed announcement is GONE everywhere (cascade),
				// while the untyped one survives.
				const typedGone = await apiGet(page, ctx.path, `/${typed.id}`);
				expect(typedGone.status(), 'row 141: typed announcement cascaded').toBe(404);
				const untypedKept = await apiGet(page, ctx.path, `/${untypedId}`);
				expect(untypedKept.status(), 'untyped announcement survives').toBe(200);
				await gotoAnnouncementsArea(page, ctx.path);
				await expect(panelItem(page, untypedTitle)).toHaveCount(1);
				await expect(panelItem(page, typedTitle)).toHaveCount(0);
				await pub.goto(`${base(ctx.path)}/announcement`);
				await expect(
					pub.getByRole('link', {name: untypedTitle, exact: true}),
				).toBeVisible();
				await expect(pub.getByText(typedTitle)).toHaveCount(0);
				// The reload-fresh Add form loses the radio again.
				modal = await openAddModal(page);
				await expect(modal.getByRole('radio')).toHaveCount(0);
			} finally {
				await anon.close();
			}
		},
	);

	// ── Scenario 5 — Notify on create ───────────────────────────────────────
	// Create with Send Email ticked: every user with a role in the journal
	// gets an in-app notification row (type 8, asserted on the DB — no 3.6
	// UI renders them, OQ/feature 80) and the ANNOUNCEMENT email (subject =
	// title, detail-page link, unsubscribe footer) — EXCEPT a user who
	// blocked the on-screen notification (neither leg) and a user who
	// blocked only the email (in-app row only). Creating unticked writes
	// rows but sends no mail. ⚠ Row 143a: the Send-Email checkbox renders
	// on the EDIT modal too, but editing never notifies (no rows, no mail).
	test(
		'notify on create: job → email + in-app rows honoring the opt-out matrix; unticked create and edit never mail (row 143a)',
		{tag: ['@smoke', '@regression']},
		async ({page, pkpApi, pkpMail, browser, baseURL}) => {
			test.slow();
			const tag = uniqueTag();
			const password = 'Notify-Pass-123';
			const userFull = `${tag}f`; // no opt-outs: both legs
			const userNoScreen = `${tag}b`; // blocks on-screen: neither leg
			const userNoMail = `${tag}m`; // blocks email only: in-app only
			const emailOf = (u) => `${u}@example.test`;
			const mk1 = `${tag}k1`; // create WITH Send Email
			const mk2 = `${tag}k2`; // create WITHOUT Send Email
			const mk3 = `${tag}k3`; // control create WITH Send Email
			const mk4 = `${tag}k4`; // edit retitle (must never notify)

			const ctx = await seedJournal(pkpApi, tag, {
				enableAnnouncements: true,
				users: [
					{username: userFull, password, email: emailOf(userFull), roles: ['reader']},
					{username: userNoScreen, password, email: emailOf(userNoScreen), roles: ['reader']},
					{username: userNoMail, password, email: emailOf(userNoMail), roles: ['reader']},
				],
			});

			// Opt-outs through the real profile Notifications tab (surface
			// owned by user-profile; the announcement-side effect is ours).
			const setOptOut = async (username, {blockScreen, blockEmail}) => {
				const userCtx = await newAnonContext(browser, baseURL);
				try {
					const p = await userCtx.newPage();
					const login = new LoginPage(p);
					await login.login(username, password, ctx.path);
					await p.waitForURL((u) => !u.pathname.includes('/login'), {
						waitUntil: 'commit',
						timeout: 15_000,
					});
					const profile = new UserProfilePage(p, ctx.path);
					await profile.goto('notificationSettings');
					if (blockScreen) {
						// "Enable these types of notifications." → off blocks BOTH.
						await profile
							.field('notificationSettings', 'notificationNewAnnouncement')
							.uncheck();
					}
					if (blockEmail) {
						// "Do not send me an email…" → on blocks the email leg.
						await profile
							.field('notificationSettings', 'emailNotificationNewAnnouncement')
							.check();
					}
					await profile.save('notificationSettings');
				} finally {
					await userCtx.close();
				}
			};
			await setOptOut(userNoScreen, {blockScreen: true, blockEmail: false});
			await setOptOut(userNoMail, {blockScreen: false, blockEmail: true});

			// CREATE #1 with Send Email ticked, through the real modal.
			await gotoAnnouncementsArea(page, ctx.path);
			let modal = await openAddModal(page);
			await titleInput(modal).fill(mk1);
			await modal
				.getByRole('checkbox', {
					name: 'Send an email about this to all registered users.',
				})
				.check();
			let res = await saveAnnouncementModal(page, modal);
			expect(res.status(), await res.text()).toBe(200);
			const created = await res.json();

			// The full-subscription user gets the ANNOUNCEMENT email: subject
			// is the title, the body links the detail page, and the footer
			// carries an unsubscribe link tied to the notification.
			const [mail] = await findMailWithDrain(page, ctx.path, pkpMail, {
				to: emailOf(userFull),
				contains: mk1,
			});
			expect(mail.Subject).toBe(mk1);
			const full = await pkpMail.fullMessage(mail.ID);
			expect(full.HTML).toContain(`/announcement/view/${created.id}`);
			expect(full.HTML).toContain('notification/unsubscribe');

			// In-app rows (DB, type 8): full + email-blocked users have one;
			// the on-screen blocker has NONE (blocking on-screen suppresses
			// both legs).
			await expectNotifyCount(page, ctx.path, ctx.id, userFull, 1);
			await expectNotifyCount(page, ctx.path, ctx.id, userNoMail, 1);
			expect(dbNotifyCount(ctx.id, userNoScreen)).toBe(0);

			// Neither blocker got the email (bounded by the control mail that
			// already arrived for the full user).
			await pkpMail.expectNone({
				to: emailOf(userNoScreen),
				contains: mk1,
				afterControl: {to: emailOf(userFull), contains: mk1},
			});
			await pkpMail.expectNone({
				to: emailOf(userNoMail),
				contains: mk1,
				afterControl: {to: emailOf(userFull), contains: mk1},
			});

			// CREATE #2 with the box UNTICKED (API, same manager session):
			// in-app rows are written, no mail goes out.
			const csrf = await csrfFor(page.context());
			const apiPost = (data) =>
				page.request.post(`${base(ctx.path)}/api/v1/announcements`, {
					headers: {'X-Csrf-Token': csrf, 'Content-Type': 'application/json'},
					data,
				});
			const quietRes = await apiPost({title: {en: mk2}, sendEmail: false});
			expect(quietRes.status(), await quietRes.text()).toBe(200);
			await expectNotifyCount(page, ctx.path, ctx.id, userFull, 2);
			expect(dbNotifyCount(ctx.id, userNoScreen)).toBe(0);

			// EDIT #1 (retitle to mk4) with the edit modal's Send-Email box
			// ticked — ⚠ row 143a: the checkbox renders but is inert.
			await gotoAnnouncementsArea(page, ctx.path);
			modal = await openEditModal(page, mk1);
			const editSendEmail = modal.getByRole('checkbox', {
				name: 'Send an email about this to all registered users.',
			});
			await expect(editSendEmail).toBeVisible(); // renders on edit (143a)
			await editSendEmail.check();
			await titleInput(modal).fill(mk4);
			res = await saveAnnouncementModal(page, modal);
			expect(res.status()).toBe(200);

			// CONTROL CREATE #3 with Send Email — its arrival bounds every
			// negative below.
			const controlRes = await apiPost({title: {en: mk3}, sendEmail: true});
			expect(controlRes.status(), await controlRes.text()).toBe(200);
			const [controlMail] = await findMailWithDrain(page, ctx.path, pkpMail, {
				to: emailOf(userFull),
				contains: mk3,
			});
			expect(controlMail.Subject).toBe(mk3);

			// No mail ever went out for the quiet create or the edit…
			await pkpMail.expectNone({
				to: emailOf(userFull),
				contains: mk2,
				afterControl: {to: emailOf(userFull), contains: mk3},
			});
			await pkpMail.expectNone({
				to: emailOf(userFull),
				contains: mk4,
				afterControl: {to: emailOf(userFull), contains: mk3},
			});

			// …and the row ledger closes exactly: 3 creates notified, the
			// edit added nothing; the on-screen blocker stayed at zero.
			await expectNotifyCount(page, ctx.path, ctx.id, userFull, 3);
			await expectNotifyCount(page, ctx.path, ctx.id, userNoMail, 3);
			expect(dbNotifyCount(ctx.id, userNoScreen)).toBe(0);
		},
	);

	// ── Scenario 6 — Permission boundary ────────────────────────────────────
	// Anonymous: reader pages only (when enabled); every API route — GET
	// included — answers 401 (no public API read). A section editor sees no
	// Announcements menu and is refused by page, grid and API; an enrolled
	// author is refused too. A journal manager still manages announcements
	// after their role is barred from Settings (the area is exempt). Another
	// journal's manager cannot touch this journal's announcements through
	// their own journal's endpoint (context guards: GET 400, PUT/DELETE 403).
	test(
		'permission boundary: anonymous 401s, non-managers refused, settings-barred manager keeps the area, cross-journal API guarded',
		{tag: '@regression'},
		async ({page, pkpApi, asUser, browser, baseURL}) => {
			test.slow();
			const tag = uniqueTag();
			const permTitle = `Perm ${tag}p1`;
			const ctx = await seedJournal(pkpApi, tag, {
				enableAnnouncements: true,
				users: [
					{username: 'dbuskins', roles: ['sectionEditor']},
					{username: 'atester', roles: ['author']},
				],
				announcements: [{title: {en: permTitle}}],
			});
			// A second journal whose manager has NO role in ctx. Use a
			// DEDICATED throwaway user (created by the seeder, password =
			// username+username so asUser's getPassword derivation matches) —
			// never a shared seeded editorial user. Enrolling e.g. `minoue`
			// as a manager here persists a cross-context manager role that
			// leaks into the editorial suites she appears in (it flipped a
			// discussion "More Actions" permission assertion in
			// tasks-discussions), so this actor must be disposable.
			const otherTag = uniqueTag();
			const otherMgrUser = `annmgr${otherTag}`;
			const other = await seedJournal(pkpApi, otherTag, {
				users: [
					{
						username: otherMgrUser,
						password: otherMgrUser + otherMgrUser,
						roles: ['manager'],
					},
				],
			});
			const apiUrl = `${base(ctx.path)}/api/v1/announcements`;

			// Resolve the seeded announcement's id as its own manager.
			const listRes = await apiGet(page, ctx.path, `?searchPhrase=${tag}`);
			expect(listRes.status()).toBe(200);
			const annId = (await listRes.json()).items[0]?.id;
			expect(annId, 'seeded announcement id resolved').toBeTruthy();

			// ANONYMOUS: reader pages serve (feature enabled)…
			const anon = await newAnonContext(browser, baseURL);
			try {
				expect(
					(await anon.request.get(`${base(ctx.path)}/announcement`)).status(),
				).toBe(200);
				expect(
					(
						await anon.request.get(
							`${base(ctx.path)}/announcement/view/${annId}`,
						)
					).status(),
				).toBe(200);
				// …but every API route refuses anonymously: the reads answer
				// 401 (no public API read), and the write verbs die even
				// EARLIER, at the session CSRF wall (403 "The form could not
				// be submitted…") before authentication is ever consulted —
				// AS-BUILT nuance folded into the spec's scenario 6.
				expect((await anon.request.get(apiUrl)).status()).toBe(401);
				expect((await anon.request.get(`${apiUrl}/${annId}`)).status()).toBe(401);
				const anonPost = await anon.request.post(apiUrl, {
					data: {title: {en: 'x'}},
				});
				expect(anonPost.status()).toBe(403);
				expect(await anonPost.text()).toContain(
					'The form could not be submitted',
				);
				expect(
					(
						await anon.request.put(`${apiUrl}/${annId}`, {
							data: {title: {en: 'x'}},
						})
					).status(),
				).toBe(403);
				expect(
					(await anon.request.delete(`${apiUrl}/${annId}`)).status(),
				).toBe(403);
			} finally {
				await anon.close();
			}

			// SECTION EDITOR: no Announcements entry in their backend menu,
			// page refused, grid refused, API 401.
			const seCtx = await asUser('dbuskins');
			const sePage = await seCtx.newPage();
			await sePage.goto(`${base(ctx.path)}/dashboard/editorial`);
			const seNav = sePage.getByRole('navigation', {name: 'Site Navigation'});
			await expect(seNav).toBeVisible({timeout: 20_000});
			await expect(
				seNav.getByRole('link', {name: 'Announcements', exact: true}),
			).toHaveCount(0);
			await sePage.goto(`${base(ctx.path)}/management/settings/announcements`);
			await expect(sePage).toHaveURL(/authorizationDenied/, {timeout: 15_000});
			const seGrid = await seCtx.request.get(
				`${base(ctx.path)}/$$$call$$$/grid/announcements/announcement-type-grid/fetch-grid`,
			);
			const seGridJson = await seGrid.json();
			expect(seGridJson.status).toBe(false);
			expect(seGridJson.content).toContain(
				'The current role does not have access to this operation.',
			);
			expect((await seCtx.request.get(apiUrl)).status()).toBe(401);

			// AUTHOR (enrolled, non-manager): API refused too.
			const authorCtx = await asUser('atester');
			expect((await authorCtx.request.get(apiUrl)).status()).toBe(401);

			// CROSS-JOURNAL: the other journal's manager reads their OWN
			// journal's endpoint fine, but this journal's announcement is
			// walled off behind the assocId guards. The throwaway manager is
			// signed in through a self-managed request context (a form POST to
			// /login/signIn, the CSRF-exempt sign-in path) rather than asUser —
			// asUser's browser-page login flow assumes a baseline user, and
			// this actor is a freshly-seeded one; the cross-journal probe only
			// needs an authenticated API session anyway.
			const otherMgr = await browser.newContext({baseURL});
			// Sign in at `other`'s context (not the site-level 'index' login):
			// this scopes the session to the journal the throwaway user
			// actually manages, matching how asUser signs a baseline user in
			// at their own journal. A context-less site session resolves roles
			// too broadly and would read across journals.
			const otherLogin = await otherMgr.request.post(
				`${base(other.path)}/login/signIn`,
				{
					form: {
						username: otherMgrUser,
						password: `${otherMgrUser}${otherMgrUser}`,
						source: '',
						remember: '',
					},
					maxRedirects: 0,
				},
			);
			expect(otherLogin.status(), 'throwaway manager signs in').toBe(302);
			expect(
				(
					await otherMgr.request.get(
						`${base(other.path)}/api/v1/announcements`,
					)
				).status(),
			).toBe(200);
			const otherCsrf = await csrfFor(otherMgr);
			const crossGet = await otherMgr.request.get(
				`${base(other.path)}/api/v1/announcements/${annId}`,
			);
			expect(crossGet.status()).toBe(400);
			expect(await crossGet.text()).toContain('not part of this journal');
			const crossPut = await otherMgr.request.put(
				`${base(other.path)}/api/v1/announcements/${annId}`,
				{
					headers: {'X-Csrf-Token': otherCsrf, 'Content-Type': 'application/json'},
					data: {title: {en: `hijack${tag}`}},
				},
			);
			expect(crossPut.status()).toBe(403);
			const crossDelete = await otherMgr.request.delete(
				`${base(other.path)}/api/v1/announcements/${annId}`,
				{headers: {'X-Csrf-Token': otherCsrf}},
			);
			expect(crossDelete.status()).toBe(403);
			// (The earlier belt-and-suspenders check "the other manager's own
			// session also reads ctx's LIST endpoint as 401" was dropped: it
			// only held for the previous shared actor because asUser scoped
			// that user's session to a journal where they were a non-manager.
			// With a dedicated throwaway manager the list read resolves
			// ambiguously against the request context — see Open question on
			// session-vs-URL context resolution. The meaningful cross-journal
			// WRITE guards above (400 "not part of this journal" + 403 on
			// PUT/DELETE) are the real assertion and hold robustly.)
			await otherMgr.close();

			// SETTINGS-BARRED MANAGER: strip "Permit settings" from this
			// journal's manager group (admin, through the real roles-grid
			// endpoint — omitting the checkbox saves it off)…
			const adminCtx = await asUser('admin');
			const groupsRes = await adminCtx.request.get(
				`${base(ctx.path)}/api/v1/userGroups`,
			);
			expect(groupsRes.ok()).toBeTruthy();
			const mgrGroup = (await groupsRes.json()).items.find(
				(g) => g.name === 'Journal manager',
			);
			expect(mgrGroup, 'Journal manager group found').toBeTruthy();
			const flip = await adminCtx.request.post(
				`${base(ctx.path)}/$$$call$$$/grid/settings/roles/user-group-grid/update-user-group`,
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

			// …the stripped manager loses the Settings pages but KEEPS the
			// announcements area (deliberate exemption) — and can still
			// create.
			await page.goto(`${base(ctx.path)}/management/settings/website`);
			await expect(page).toHaveURL(/authorizationDenied/, {timeout: 15_000});
			await gotoAnnouncementsArea(page, ctx.path);
			const modal = await openAddModal(page);
			await titleInput(modal).fill(`Stripped ${tag}s1`);
			const res = await saveAnnouncementModal(page, modal);
			expect(res.status(), 'settings-barred manager still creates').toBe(200);
			await expect(panelItem(page, `Stripped ${tag}s1`)).toHaveCount(1, {
				timeout: 15_000,
			});
		},
	);
});
