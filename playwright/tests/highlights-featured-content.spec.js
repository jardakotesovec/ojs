// @ts-check
const {test, expect} = require('../support/fixtures.js');
const {
	setTinyMceContent,
} = require('../../lib/pkp/playwright/support/tinymce.js');

/**
 * Highlights (featured content) — the MANAGEMENT side.
 * docs/product/specs/highlights-featured-content.md — the HighlightsListPanel a
 * manager reaches at Settings > Website > Setup > Highlights (management/
 * website.tpl). A manager curates an ordered list of featured cards (title,
 * description, url, urlText, optional image) that the reader theme renders as a
 * home-page carousel; the reader render itself is owned by journal-homepage.
 *
 * Five canonical scenarios, landed at FOUR tests (edit + reorder merged):
 *   1. A manager ADDS a highlight (form + required-field guard + it appears +
 *      persists via the /highlights API).
 *   2. A manager EDITS a title then REORDERS two highlights (merged) — both
 *      verified through the panel UI and the API.
 *   3. A manager DELETES a highlight (confirm dialog → gone from panel + API).
 *   4. A non-manager (section editor) CANNOT manage — the CRUD API refuses
 *      (401 roleBasedAccessDenied) and the settings page is inaccessible (no
 *      Highlights panel / nav), while a manager reaches the same route (200).
 *
 * Every mutation drives the RENDERED HighlightsListPanel + its side-modal form
 * (the spec author verified the mount by code; this suite drives the live UI)
 * AND asserts the resulting /highlights API state.
 *
 * Isolation: publicknowledge's highlights table is empty by default and must
 * stay clean, so ALL highlight mutations happen on a per-test SCRATCH JOURNAL
 * (unique hyphenless path) seeded with dbarnes enrolled as manager (and, for
 * test 4, dbuskins as a section editor). No shared state is touched.
 *
 * Field DOM (form id `highlight`, single-locale `en` scratch journals):
 *   - Title       FieldRichText  (TinyMCE)   → editor id `highlight-title-control-en`
 *   - Description FieldRichTextarea (TinyMCE) → editor id `highlight-description-control-en`
 *   - URL         FieldText                  → input  #highlight-url-control
 *   - ButtonLabel FieldText (multilingual)   → input  #highlight-urlText-control-en
 *   - Image       FieldUploadImage (optional, not exercised)
 *
 * Note on the row-100 ⚠ (spec rule 8): GET /highlights/{id} 500s in a journal
 * context (Controller passes the Context object where an int contextId is
 * expected). Probed out-of-band and confirmed (500 for both an existing and a
 * missing id). This suite deliberately does NOT assert that 500 — instead the
 * EDIT test exercises the panel's real path (edit from the pre-loaded list,
 * which never calls the single-GET route), demonstrating the panel works
 * despite the dead endpoint. Keeping the retained suite off the 500 keeps it
 * green if PKP applies the one-line fix.
 */

/** A unique, hyphenless, alphanumeric journal path (<=32, parallel isolation). */
function uniquePath(prefix = 'hl') {
	const workerLetter = String.fromCharCode(97 + (test.info().parallelIndex % 26));
	let suffix = '';
	while (suffix.length < 6) {
		suffix += Math.random().toString(36).replace(/[^a-z0-9]/g, '');
	}
	return `${prefix}${workerLetter}${suffix.slice(0, 6)}`;
}

/** A short unique token to disambiguate titles within a test's own journal. */
function token() {
	return Math.random().toString(36).replace(/[^a-z0-9]/g, '').slice(0, 5);
}

/** The context-scoped highlights REST endpoint for a scratch journal. */
function highlightsApiUrl(path) {
	return `/index.php/${path}/api/v1/highlights`;
}

/**
 * Create a single-locale scratch journal with dbarnes enrolled as journal
 * manager (the actor for tests 1-3). Extra users (e.g. a section editor) and
 * seeded highlights are optional.
 *
 * @returns {Promise<{path: string, id: number}>}
 */
async function createManagedJournal(pkpApi, {highlights = [], users = []} = {}) {
	const path = uniquePath();
	const spec = {
		tag: path,
		path,
		primaryLocale: 'en',
		supportedLocales: ['en'],
		name: {en: `Highlights Journal ${path}`},
		users: [{username: 'dbarnes', roles: ['manager']}, ...users],
	};
	if (highlights.length) {
		spec.highlights = highlights;
	}
	const res = await pkpApi.createJournal(spec);
	return {path: res.context.path, id: res.context.id};
}

/**
 * GET the journal's highlights list through the caller's session. Returns the
 * parsed `{itemsMax, items:[{id, title, url, urlText, sequence, ...}]}` payload,
 * items ordered by sequence ascending (the collector's order).
 */
async function listHighlights(request, path) {
	const res = await request.get(highlightsApiUrl(path));
	expect(res.status(), `GET highlights for ${path}`).toBe(200);
	return res.json();
}

/**
 * Open Settings > Website > Setup > Highlights and return the rendered
 * HighlightsListPanel locator. The outer Setup tab (#setup) is distinct from
 * Appearance's inner Setup side tab (patterns.md pitfall 2).
 */
async function openHighlightsPanel(page, path) {
	await page.goto(`/index.php/${path}/management/settings/website`);
	await expect(page.locator('#appearance-button')).toBeVisible({timeout: 15_000});
	await page.locator('#setup-button').click();
	await page.locator('#highlights-button').click();
	const panel = page.locator('.highlightsListPanel');
	await expect(panel.getByRole('heading', {name: 'Highlights'})).toBeVisible({
		timeout: 15_000,
	});
	return panel;
}

/** A highlight row in the panel, located by (localized) title text. */
function highlightRow(panel, text) {
	return panel.locator('.listPanel__item').filter({hasText: text});
}

/** The add/edit highlight side-modal form (anchored by its non-localized url control). */
function highlightForm(page) {
	return page.locator('form:has(#highlight-url-control)');
}

/**
 * Fill the (already-open) highlight form. Title/description go through TinyMCE;
 * url/urlText are plain inputs. Any field left undefined is untouched.
 */
async function fillHighlightForm(page, {title, description, url, urlText}) {
	await expect(page.locator('#highlight-url-control')).toBeVisible({
		timeout: 15_000,
	});
	if (title !== undefined) {
		await setTinyMceContent(page, 'highlight-title-control-en', title);
	}
	if (description !== undefined) {
		await setTinyMceContent(page, 'highlight-description-control-en', description);
	}
	if (url !== undefined) {
		await page.locator('#highlight-url-control').fill(url);
	}
	if (urlText !== undefined) {
		await page.locator('#highlight-urlText-control-en').fill(urlText);
	}
}

/**
 * Click the form's Save and wait for the add (POST /highlights) or edit
 * (POST /highlights/{id}, PUT tunnelled) write. The order route is excluded.
 */
async function saveHighlightForm(page) {
	const [response] = await Promise.all([
		page.waitForResponse(
			(res) =>
				/\/api\/v1\/highlights(?:\/\d+)?(?:\?|$)/.test(res.url()) &&
				!/\/highlights\/order/.test(res.url()) &&
				res.request().method() === 'POST',
			{timeout: 20_000},
		),
		highlightForm(page).getByRole('button', {name: 'Save', exact: true}).click(),
	]);
	return response;
}

test.use({user: 'dbarnes'}); // journal manager for the management-side tests

test.describe('Highlights (featured content) — management panel', () => {
	// Canonical scenario 1 — A manager adds a highlight. Opens the panel on an
	// empty journal, clicks Add Highlight, and first proves the required-field
	// guard (an empty save surfaces "This field is required." on Title, URL and
	// Button Label — no write leaves). Then enters Title + URL + Button Label
	// (required) and a Description (optional), saves, and the highlight appears
	// at the end of the list and persists with all four fields via the API.
	test(
		'a manager adds a highlight through the panel form',
		{tag: ['@smoke', '@regression']},
		async ({page, pkpApi}) => {
			test.slow();
			const t = token();
			const title = `Featured ${t}`;
			const url = `https://example.org/featured-${t}`;
			const urlText = `Read more ${t}`;
			const description = `A curated collection ${t}`;

			const {path} = await createManagedJournal(pkpApi);
			const panel = await openHighlightsPanel(page, path);

			// Empty to start.
			await expect(panel.locator('.listPanel__item')).toHaveCount(0);

			await panel.getByRole('button', {name: 'Add Highlight'}).click();
			const form = highlightForm(page);
			await expect(page.locator('#highlight-url-control')).toBeVisible({
				timeout: 15_000,
			});

			// Required-field guard: a blank save is blocked client-side (no POST).
			await form.getByRole('button', {name: 'Save', exact: true}).click();
			await expect(
				form.getByText('This field is required.').first(),
			).toBeVisible({timeout: 10_000});

			// Fill the required fields (+ optional description) and save.
			await fillHighlightForm(page, {title, description, url, urlText});
			const res = await saveHighlightForm(page);
			expect(res.status(), await res.text()).toBe(200);

			// It appears in the panel…
			await expect(highlightRow(panel, title)).toBeVisible({timeout: 15_000});
			await expect(panel.locator('.listPanel__item')).toHaveCount(1);

			// …and persists with every field via the API.
			const {itemsMax, items} = await listHighlights(page.request, path);
			expect(itemsMax).toBe(1);
			expect(items[0].title.en).toContain(title);
			expect(items[0].url).toBe(url);
			expect(items[0].urlText.en).toContain(urlText);
			expect(items[0].description.en).toContain(description);
		},
	);

	// Canonical scenarios 2 + 3 (merged) — A manager edits a highlight, then
	// reorders. On a journal seeded with two highlights (Alpha, Bravo), the
	// manager clicks Edit on Alpha (the side-modal opens pre-filled FROM THE
	// PRE-LOADED LIST — never the broken single-GET route, spec rule 8),
	// changes the title, and saves: the row updates in place and the API shows
	// the new title. Then, in Order mode, the manager moves Bravo up with the
	// arrow control and clicks Save Order: the API reports Bravo now first.
	test(
		'a manager edits a title and reorders highlights',
		{tag: '@regression'},
		async ({page, pkpApi}) => {
			test.slow();
			const t = token();
			const alpha = `Alpha ${t}`;
			const bravo = `Bravo ${t}`;
			const alphaEdited = `Alpha Edited ${t}`;

			const {path} = await createManagedJournal(pkpApi, {
				highlights: [
					{title: alpha, url: `https://example.org/a-${t}`, urlText: `Go A ${t}`},
					{title: bravo, url: `https://example.org/b-${t}`, urlText: `Go B ${t}`},
				],
			});

			// Capture the seeded order (Alpha seq 1, Bravo seq 2).
			const seeded = await listHighlights(page.request, path);
			expect(seeded.items.map((i) => i.title.en)).toEqual([alpha, bravo]);
			const alphaId = seeded.items[0].id;

			const panel = await openHighlightsPanel(page, path);

			// EDIT — open Alpha's row (pre-filled from the loaded list) and retitle.
			await highlightRow(panel, alpha)
				.getByRole('button', {name: 'Edit', exact: true})
				.click();
			await fillHighlightForm(page, {title: alphaEdited});
			const editRes = await saveHighlightForm(page);
			expect(editRes.status(), await editRes.text()).toBe(200);

			// Row swapped in place; the API persisted the new title on the same id.
			await expect(highlightRow(panel, alphaEdited)).toBeVisible({
				timeout: 15_000,
			});
			const afterEdit = await listHighlights(page.request, path);
			const editedItem = afterEdit.items.find((i) => i.id === alphaId);
			expect(editedItem.title.en).toContain(alphaEdited);

			// REORDER — enter Order mode, move Bravo up, Save Order.
			await panel.getByRole('button', {name: 'Order', exact: true}).click();
			await expect(
				panel.getByRole('button', {name: 'Save Order'}),
			).toBeVisible({timeout: 15_000});
			await highlightRow(panel, bravo).locator('.orderer__up').click();

			const [orderRes] = await Promise.all([
				page.waitForResponse(
					(res) =>
						/\/highlights\/order(?:\?|$)/.test(res.url()) &&
						res.request().method() === 'POST' &&
						res.status() === 200,
					{timeout: 20_000},
				),
				panel.getByRole('button', {name: 'Save Order'}).click(),
			]);
			const orderBody = await orderRes.json();
			expect(orderBody.items[0].title.en).toBe(bravo);

			// DB truth: Bravo is now first, the edited Alpha second.
			const reordered = await listHighlights(page.request, path);
			expect(reordered.items.map((i) => i.title.en)).toEqual([
				bravo,
				alphaEdited,
			]);
		},
	);

	// Canonical scenario 4 — A manager deletes a highlight. On a journal with two
	// highlights (Keep, Remove), the manager clicks Delete on Remove, confirms in
	// the guard dialog, and the highlight disappears from the panel and the API;
	// the other highlight is untouched.
	test(
		'a manager deletes a highlight via the confirm dialog',
		{tag: '@regression'},
		async ({page, pkpApi}) => {
			test.slow();
			const t = token();
			const keep = `Keep ${t}`;
			const remove = `Remove ${t}`;

			const {path} = await createManagedJournal(pkpApi, {
				highlights: [
					{title: keep, url: `https://example.org/k-${t}`, urlText: `Go K ${t}`},
					{title: remove, url: `https://example.org/r-${t}`, urlText: `Go R ${t}`},
				],
			});

			const panel = await openHighlightsPanel(page, path);
			await expect(panel.locator('.listPanel__item')).toHaveCount(2);

			await highlightRow(panel, remove)
				.getByRole('button', {name: 'Delete', exact: true})
				.click();

			// Confirm dialog (title "Delete Highlight", message names the highlight).
			const dialog = page
				.locator('[role="dialog"], [role="alertdialog"]')
				.filter({hasText: 'Delete Highlight'});
			await expect(dialog).toBeVisible({timeout: 15_000});
			const [delRes] = await Promise.all([
				page.waitForResponse(
					(res) =>
						/\/highlights\/\d+(?:\?|$)/.test(res.url()) &&
						res.request().method() === 'POST' &&
						res.status() === 200,
					{timeout: 20_000},
				),
				dialog.getByRole('button', {name: 'Yes'}).click(),
			]);
			expect(delRes.ok()).toBeTruthy();

			// Gone from the panel; Keep remains.
			await expect(highlightRow(panel, remove)).toHaveCount(0, {
				timeout: 15_000,
			});
			await expect(highlightRow(panel, keep)).toBeVisible();

			// API truth: exactly one highlight left, and it is Keep.
			const remaining = await listHighlights(page.request, path);
			expect(remaining.itemsMax).toBe(1);
			expect(remaining.items[0].title.en).toBe(keep);
		},
	);

	// Canonical scenario 5 — A non-manager cannot manage highlights. A section
	// editor (dbuskins), enrolled in the journal only as a section editor, is
	// refused by the CRUD API (401 roleBasedAccessDenied — all six routes share
	// the manager/site-admin role gate) and cannot reach the Website settings
	// page at all (it redirects to authorizationDenied — no Highlights panel or
	// nav). The manager reaching the SAME route with 200 proves this is a
	// permission boundary, not a dead route.
	test(
		'a section editor cannot manage highlights (API refused, no panel)',
		{tag: '@regression'},
		async ({page, pkpApi, asUser}) => {
			test.slow();
			const t = token();
			const {path} = await createManagedJournal(pkpApi, {
				users: [{username: 'dbuskins', roles: ['sectionEditor']}],
				highlights: [
					{title: `Gated ${t}`, url: `https://example.org/g-${t}`, urlText: `Go ${t}`},
				],
			});

			// Manager (the default page) can read the route — 200.
			const mgrRes = await page.request.get(highlightsApiUrl(path));
			expect(mgrRes.status(), 'manager GET /highlights').toBe(200);

			// Section editor is refused by the API.
			const sectionEditorCtx = await asUser('dbuskins');
			const seApiRes = await sectionEditorCtx.request.get(highlightsApiUrl(path));
			expect(seApiRes.status(), 'section editor GET /highlights').toBe(401);
			expect(await seApiRes.text()).toContain('roleBasedAccessDenied');

			// Section editor cannot open the Website settings page (no panel/nav).
			const sectionEditorPage = await sectionEditorCtx.newPage();
			await sectionEditorPage.goto(
				`/index.php/${path}/management/settings/website`,
			);
			await expect(sectionEditorPage).toHaveURL(/authorizationDenied/, {
				timeout: 15_000,
			});
			await expect(
				sectionEditorPage.locator('#highlights-button'),
			).toHaveCount(0);
		},
	);
});
