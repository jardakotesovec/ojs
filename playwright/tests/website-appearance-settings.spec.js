// @ts-check
const path = require('path');
const {test, expect} = require('../support/fixtures.js');
const {
	setTinyMceContent,
} = require('../../lib/pkp/playwright/support/tinymce.js');
const {
	WebsiteSettingsPage,
} = require('../../lib/pkp/playwright/pages/WebsiteSettingsPage.js');
const {
	PluginsGridPage,
} = require('../../lib/pkp/playwright/pages/PluginsGridPage.js');
const {
	waitForJQueryIdle,
} = require('../../lib/pkp/playwright/support/jquery.js');

/**
 * Website appearance settings — Settings → Website's Appearance tab group
 * (Theme / Setup / Advanced), the Setup group's Lists and Date & Time tabs,
 * and the Custom Block Manager plugin. One test per canonical scenario of
 * docs/product/specs/website-appearance-settings.md (7 named, 7 tests, 1:1).
 *
 * WHAT IS DRIVEN LIVE:
 *   - The REAL Vue forms via the WebsiteSettingsPage POM: Theme (typography
 *     radio, the vue3-color Colour picker's hex input, the Journal Summary
 *     and Header Background Image checkboxes — saved to the theme endpoint),
 *     Appearance Setup (three FieldUploadImage dropzones + alt text, the
 *     TinyMCE Page Footer in en+fr, the orderable Sidebar picker incl. the
 *     Orderer up-buttons), Advanced (the .css FieldUpload + the favicon
 *     image upload), Lists (itemsPerPage happy path AND the min:1 400 with
 *     its inline error) and Date & Time (preset radio for en, the free
 *     "Custom" input for fr).
 *   - The legacy Custom Block Manager chain: Installed Plugins grid row →
 *     Manage Custom Blocks AjaxModal → Add Block form (fbv multilingual
 *     title, legacy TinyMCE body, Show Name) → grid row → sidebar picker →
 *     public render — and the documented delete-500 (below).
 *   - Public surfacing, read ANONYMOUSLY on each test's scratch journal:
 *     recompiled theme CSS (new colour in, default #1E6292 out) + the Lora
 *     font CSS + the homepage_about block; logo/thumbnail/homepage-image/
 *     favicon render points incl. the fr→en logo fallback and the
 *     homepage-image-as-header flip; the custom stylesheet <link> (after the
 *     theme's, cache-busted, served content, link gone after clearing); per-locale
 *     footers; sidebar block order; date-format deltas on the announcements
 *     section (en d.m.Y vs fr d/m/Y vs the Y-m-d server default); the
 *     two-page issue archive at itemsPerPage=1.
 *
 * KNOWN BUGS asserted as documented (feedback discipline — assert reality):
 *   - Ledger row 121: deleting a custom block 500s on PostgreSQL
 *     (PluginSettingsDAO's `plugin_Name` column-case typo) and the block
 *     survives in the grid and the public sidebar. Test 5 asserts the 500 +
 *     survival exactly as the spec words it — do NOT green-flag deletion.
 *   - Ledger row 122: the Make a Submission block's default-enabled
 *     settings.xml never installs, so it is absent from the Sidebar picker
 *     until manually enabled in Installed Plugins. Test 4 asserts
 *     absent-by-default → grid-enable → offered.
 *   - Ledger row 123 (NEW — found by this suite): clearing the journal
 *     style sheet removes the setting and the <link> but NOT the public
 *     file — the null-clear branch passes the stored array where a
 *     filename string is expected, so styleSheet.css keeps being served.
 *     Test 3 asserts link-gone + file-still-200 (spec corrected).
 *
 * AUTH: `test.use({user: 'dbarnes'})` — dbarnes is enrolled as manager of
 * each test's OWN scratch journal. Public reads use explicit empty-state
 * anonymous contexts (patterns.md item 8). The role-less probe uses
 * `asUser('dbuskins')` (section editor — no settings role).
 *
 * PARALLEL + isolation: every test seeds its OWN scratch journal (unique
 * hyphenless `wat…` tag) and mutates theme/uploads/sidebar/CSS/pagination
 * ONLY there — publicknowledge appearance state is load-bearing suite-wide
 * and is never touched (the site-index read in test 2 only inspects OUR
 * journal's entry). Uploads land in the scratch journal's own
 * public/journals/{id}/ directory. No Mailpit: none of these saves emails,
 * notifies or writes the event log (spec Side effects). Fully parallel at
 * the flat root.
 */

const MANAGER = 'dbarnes';
const IMAGE_FIXTURE = path.join(
	__dirname,
	'../../lib/pkp/playwright/fixtures/files/dependent-image.png',
);
const CSS_FIXTURE = path.join(
	__dirname,
	'../fixtures/files/journal-stylesheet.css',
);

/** A unique, hyphenless, lowercased alphanumeric token (parallel + re-run isolation). */
function uniqueTag(prefix = 'wat') {
	const workerIndex = test.info().parallelIndex;
	const rand = Math.random().toString(36).slice(2, 8);
	return `${prefix}${workerIndex}x${rand}`;
}

/** Seed a scratch journal (dbarnes as manager + spec passthrough) → context. */
async function seedJournal(pkpApi, tag, extra = {}) {
	const {context} = await pkpApi.createJournal({
		tag,
		users: [{username: MANAGER, roles: ['manager']}, ...(extra.users ?? [])],
		...Object.fromEntries(
			Object.entries(extra).filter(([k]) => k !== 'users'),
		),
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

/** Read another context's CSRF token off the site-level profile page. */
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

/** PUT journal settings through the same journal-settings API the forms use. */
async function putContext(requestCtx, ctxPath, contextId, data, csrf) {
	return requestCtx.put(`/index.php/${ctxPath}/api/v1/contexts/${contextId}`, {
		headers: {'X-Csrf-Token': csrf, 'Content-Type': 'application/json'},
		data,
	});
}

/** PUT to the theme endpoint (the Theme tab's own save target — spec rule 3). */
async function putTheme(requestCtx, ctxPath, contextId, data, csrf) {
	return requestCtx.put(
		`/index.php/${ctxPath}/api/v1/contexts/${contextId}/theme`,
		{
			headers: {'X-Csrf-Token': csrf, 'Content-Type': 'application/json'},
			data,
		},
	);
}

/** GET the journal's settings JSON (manager session required). */
async function getContext(requestCtx, ctxPath, contextId) {
	const res = await requestCtx.get(
		`/index.php/${ctxPath}/api/v1/contexts/${contextId}`,
	);
	expect(res.ok(), `GET context ${res.status()}`).toBeTruthy();
	return res.json();
}

/** GET the active theme + its option values (manager session required). */
async function getTheme(requestCtx, ctxPath, contextId) {
	const res = await requestCtx.get(
		`/index.php/${ctxPath}/api/v1/contexts/${contextId}/theme`,
	);
	expect(res.ok(), `GET theme ${res.status()}`).toBeTruthy();
	return res.json();
}

/** A fresh anonymous browser context (explicit empty storage state). */
async function newAnonContext(browser, baseURL) {
	return browser.newContext({
		baseURL,
		storageState: {cookies: [], origins: []},
	});
}

/**
 * GET a public page anonymously and harvest its <link rel="stylesheet">
 * hrefs in document order (entity-decoded). Theme LESS bundles link through
 * `…/page/page/css?name=…`; the journal's custom sheet links straight to
 * `public/journals/{id}/styleSheet.css?d=…`.
 */
async function fetchPageStylesheets(anon, pageUrl) {
	const res = await anon.request.get(pageUrl);
	expect(res.ok(), `GET ${pageUrl} → ${res.status()}`).toBeTruthy();
	const html = await res.text();
	const hrefs = [];
	for (const tag of html.match(/<link\b[^>]*rel="stylesheet"[^>]*>/g) ?? []) {
		const m = tag.match(/href="([^"]+)"/);
		if (m) hrefs.push(m[1].replace(/&amp;/g, '&'));
	}
	return {html, hrefs};
}

/**
 * Set content in a LEGACY fbv TinyMCE editor whose id carries a runtime
 * uniqid suffix (patterns.md pitfall 8) by resolving the live editor id
 * from a stable prefix, then reusing the shared setTinyMceContent helper.
 */
async function setLegacyTinyMceByPrefix(page, idPrefix, html) {
	const handle = await page.waitForFunction(
		(prefix) => {
			const list =
				(typeof window.tinymce?.get === 'function'
					? window.tinymce.get()
					: null) ?? [];
			const editor = list.find(
				(e) => e.id.startsWith(prefix) && e.initialized,
			);
			return editor ? editor.id : false;
		},
		idPrefix,
		{timeout: 15_000},
	);
	const editorId = /** @type {string} */ (await handle.jsonValue());
	await setTinyMceContent(page, editorId, html);
}

/**
 * The Sidebar picker fieldset (the one orderable FieldOptions on the
 * Appearance → Setup panel).
 */
function sidebarField(panel, page) {
	return panel
		.locator('fieldset.pkpFormField--options')
		.filter({has: page.locator('input[name="sidebar"]')});
}

/**
 * Move a sidebar option to the TOP of the picker with the Orderer's
 * up-button (each click moves one position; clicking at the top is a
 * no-op). Bounded by the option count, so it terminates deterministically.
 */
async function moveSidebarOptionToTop(panel, page, value) {
	const field = sidebarField(panel, page);
	const options = field.locator('label.pkpFormField--options__option');
	const count = await options.count();
	for (let i = 0; i < count; i++) {
		if (
			await options
				.first()
				.locator(`input[value="${value}"]`)
				.count()
		) {
			return;
		}
		await options
			.filter({has: page.locator(`input[value="${value}"]`)})
			.locator('button.orderer__up')
			.click();
	}
	await expect(
		options.first().locator(`input[value="${value}"]`),
	).toHaveCount(1);
}

/** Upload a file into a FieldUploadImage and fill its alt text. */
async function uploadImageWithAlt(site, formId, fieldName, altText) {
	const altInput = await site.uploadImage(formId, fieldName, IMAGE_FIXTURE);
	await altInput.fill(altText);
}

test.use({user: MANAGER});

test.describe('Website appearance settings — Appearance/Lists/Date & Time + custom blocks', () => {
	// ── Scenario 1 — Restyle the journal from the Theme tab ───────────────────
	// The manager switches Typography to Lora, picks #FF0000 in the Colour
	// picker and ticks Journal Summary — ONE Save to the theme endpoint (its
	// own endpoint, not the journal-settings one — rule 3). The options
	// persist as plugin settings (theme GET), and an anonymous reader's next
	// load serves the Lora font CSS, the recompiled theme CSS in the new
	// colour with the default #1E6292 gone (rule 4), and the home page gains
	// the "About the Journal" block it did not have before.
	test(
		'theme options restyle the public site: Lora font, new colour, summary block',
		{tag: ['@smoke', '@regression']},
		async ({page, pkpApi, browser, baseURL}) => {
			test.slow();
			const tag = uniqueTag();
			const description = `Distinctive summary ${tag}`;
			const ctx = await seedJournal(pkpApi, tag, {
				primaryLocale: 'en',
				supportedLocales: ['en'],
				description: {en: description},
			});
			const homeUrl = `/index.php/${ctx.path}/`;

			// Baseline, anonymously: no summary block before the theme save.
			const anon = await newAnonContext(browser, baseURL);
			const pub = await anon.newPage();
			await pub.goto(homeUrl);
			await expect(pub.locator('section.homepage_about')).toHaveCount(0);

			// The REAL Theme form (Appearance → Theme is the default side tab).
			const site = new WebsiteSettingsPage(page, ctx.path);
			await site.goto();
			const panel = await site.openAppearanceTab('theme');

			// Typography → Lora (radio, labelled with the font description).
			await panel.locator('input[name="typography"][value="lora"]').check();
			// Colour → #FF0000 through the picker's editable hex input.
			await panel
				.locator('.vc-chrome-fields input.vc-input__input')
				.first()
				.fill('#FF0000');
			// Journal Summary → on (single-option checkbox).
			await panel
				.locator('input[name="showDescriptionInJournalIndex"]')
				.check();

			// ONE Save → the theme endpoint (rule 3), confirmed by Saved badge.
			await site.saveForm(panel, {
				endpoint: /\/api\/v1\/contexts\/\d+\/theme/,
			});

			// The options persisted as the ACTIVE theme's plugin settings.
			const theme = await getTheme(page.request, ctx.path, ctx.id);
			expect(theme.typography).toBe('lora');
			expect(theme.baseColour).toBe('#FF0000');
			expect(Boolean(theme.showDescriptionInJournalIndex)).toBe(true);

			// Anonymous next load: the summary block appeared…
			await pub.goto(homeUrl);
			const about = pub.locator('section.homepage_about');
			await expect(about).toBeVisible();
			await expect(
				about.getByRole('heading', {name: 'About the Journal'}),
			).toBeVisible();
			await expect(about).toContainText(description);

			// …and the served CSS follows: Lora font in, new colour in,
			// default colour gone (rule 4's cache-clear makes it immediate).
			const {hrefs} = await fetchPageStylesheets(anon, homeUrl);
			const fontHref = hrefs.find((h) => h.includes('css?name=font'));
			const styleHref = hrefs.find((h) =>
				h.includes('css?name=stylesheet'),
			);
			expect(fontHref, `font css link in ${hrefs}`).toBeTruthy();
			expect(styleHref, `theme css link in ${hrefs}`).toBeTruthy();
			const fontCss = (
				await (await anon.request.get(fontHref)).text()
			).toLowerCase();
			const themeCss = (
				await (await anon.request.get(styleHref)).text()
			).toLowerCase();
			expect(fontCss).toContain('lora');
			expect(`${themeCss}`).toMatch(/#f00\b|#ff0000/);
			expect(themeCss).not.toContain('#1e6292');
			await anon.close();
		},
	);

	// ── Scenario 2 — Brand the journal with images ─────────────────────────────
	// The manager uploads a Logo, Journal thumbnail and Homepage Image
	// (Appearance → Setup) and a Favicon (Advanced), each with alt text, all
	// through the real dropzone → temporary-files → settings-PUT pipeline
	// (rule 5, canonical names). Render points (rule 6): logo in the public
	// header (alt intact; the FRENCH page falls back to the English logo),
	// thumbnail on the site index beside OUR journal, inline homepage image
	// on the home page, favicon <link> on public AND backend pages. Ticking
	// the theme's Header Background Image moves the homepage image into the
	// header banner and removes the inline image.
	test(
		'logo, thumbnail, homepage image and favicon land on their render points',
		{tag: ['@smoke', '@regression']},
		async ({page, pkpApi, browser, baseURL}) => {
			test.slow();
			const tag = uniqueTag();
			const name = `Wat Journal ${tag}`;
			const ctx = await seedJournal(pkpApi, tag, {
				primaryLocale: 'en',
				supportedLocales: ['en', 'fr_CA'],
				name: {en: name},
			});
			const logoAlt = `Logo alt ${tag}`;
			const homepageAlt = `Homepage alt ${tag}`;

			const site = new WebsiteSettingsPage(page, ctx.path);
			await site.goto();

			// Appearance → Setup: the three image uploads, one Save.
			const setupPanel = await site.openAppearanceTab('appearance-setup');
			await uploadImageWithAlt(site, 'appearanceSetup', 'pageHeaderLogoImage', logoAlt);
			await uploadImageWithAlt(site, 'appearanceSetup', 'journalThumbnail', `Thumb alt ${tag}`);
			await uploadImageWithAlt(site, 'appearanceSetup', 'homepageImage', homepageAlt);
			const setupRes = await site.saveForm(setupPanel);
			const echoed = await setupRes.json();
			// Canonical public names: {setting}_{locale}.{ext} (rule 5).
			expect(echoed.pageHeaderLogoImage.en.uploadName).toBe('pageHeaderLogoImage_en.png');
			expect(echoed.pageHeaderLogoImage.en.altText).toBe(logoAlt);
			expect(echoed.journalThumbnail.en.uploadName).toBe('journalThumbnail_en.png');
			expect(echoed.homepageImage.en.uploadName).toBe('homepageImage_en.png');

			// Advanced: the favicon (png is among ico/png/gif — rule 5).
			const advancedPanel = await site.openAppearanceTab('advanced');
			await uploadImageWithAlt(site, 'appearanceAdvanced', 'favicon', `Favicon ${tag}`);
			const advRes = await site.saveForm(advancedPanel);
			expect((await advRes.json()).favicon.en.uploadName).toBe('favicon_en.png');

			// Anonymous render points (multi-locale journal → /en/ URLs).
			const anon = await newAnonContext(browser, baseURL);
			const pub = await anon.newPage();
			await pub.goto(`/index.php/${ctx.path}/en/`);
			// Logo in the header, alt intact (journal-name text replaced).
			const logo = pub.locator('img[src*="pageHeaderLogoImage_en"]').first();
			await expect(logo).toBeVisible();
			await expect(logo).toHaveAttribute('alt', logoAlt);
			// Inline homepage image on the home page (theme option off).
			const homepageImg = pub.locator('.homepage_image img');
			await expect(homepageImg).toBeVisible();
			await expect(homepageImg).toHaveAttribute('src', /homepageImage_en/);
			await expect(homepageImg).toHaveAttribute('alt', homepageAlt);
			// The logo file is really served from public/journals/{id}/.
			const logoSrc = await logo.getAttribute('src');
			expect(logoSrc).toContain(`public/journals/${ctx.id}/`);
			expect((await anon.request.get(logoSrc)).status()).toBe(200);

			// Favicon <link rel="icon"> on the public page…
			const publicHtml = await (
				await anon.request.get(`/index.php/${ctx.path}/en/`)
			).text();
			expect(publicHtml).toContain('rel="icon"');
			expect(publicHtml).toContain('favicon_en.png');
			// …and on the backend (manager session).
			const backendHtml = await (
				await page.request.get(
					`/index.php/${ctx.path}/management/settings/website`,
				)
			).text();
			expect(backendHtml).toContain('rel="icon"');
			expect(backendHtml).toContain('favicon_en.png');

			// The FRENCH page falls back to the English logo (no fr upload).
			const frHtml = await (
				await anon.request.get(`/index.php/${ctx.path}/fr_CA/`)
			).text();
			expect(frHtml).toContain('pageHeaderLogoImage_en.png');

			// The site index shows the thumbnail beside OUR journal's entry
			// (read-only on the shared index — only our own <li> is inspected).
			await pub.goto('/index.php/index');
			const entry = pub.locator('li.has_thumb').filter({hasText: name});
			await expect(entry).toBeVisible();
			await expect(entry.locator('.thumb img')).toHaveAttribute(
				'src',
				/journalThumbnail_en/,
			);

			// Theme's Header Background Image: the homepage image becomes the
			// header banner and the inline image disappears (rules 4 + 6).
			const themePanel = await site.openAppearanceTab('theme');
			await themePanel
				.locator('input[name="useHomepageImageAsHeader"]')
				.check();
			await site.saveForm(themePanel, {
				endpoint: /\/api\/v1\/contexts\/\d+\/theme/,
			});
			await pub.goto(`/index.php/${ctx.path}/en/`);
			await expect(pub.locator('.homepage_image')).toHaveCount(0);
			const bannerHtml = await pub.content();
			expect(bannerHtml).toContain('.pkp_structure_head { background:');
			expect(bannerHtml).toContain('homepageImage_en.png');
			await anon.close();
		},
	);

	// ── Scenario 3 — Skin every page with custom CSS and a footer ──────────────
	// The manager uploads a .css journal style sheet (Advanced — the widget
	// only accepts .css) and writes a Page Footer in both languages (Setup).
	// Every public page links the stylesheet AFTER the theme's CSS with a
	// cache-busting ?d= stamp (rule 6), the served file is our upload, and
	// the footer renders per locale. Clearing the stylesheet removes the
	// LINK — but ⚠ the public file survives on disk (ledger row 123: the
	// null-clear branch passes the stored ARRAY where a filename string is
	// expected, so the delete is a silent no-op — asserted as-built).
	test(
		'custom style sheet links late with a cache-buster; per-locale footer; clearing removes both',
		{tag: '@regression'},
		async ({page, pkpApi, browser, baseURL}) => {
			test.slow();
			const tag = uniqueTag();
			const ctx = await seedJournal(pkpApi, tag, {
				primaryLocale: 'en',
				supportedLocales: ['en', 'fr_CA'],
			});
			const footerEn = `Footer text en ${tag}`;
			const footerFr = `Pied de page fr ${tag}`;

			const site = new WebsiteSettingsPage(page, ctx.path);
			await site.goto();

			// Advanced → Journal style sheet (FieldUpload, .css only, not
			// localized — the hidden dropzone input carries no locale suffix).
			const advancedPanel = await site.openAppearanceTab('advanced');
			const hiddenInput = page.locator(
				'#appearanceAdvanced-styleSheet-hiddenFileId',
			);
			await hiddenInput.waitFor({state: 'attached', timeout: 15_000});
			const uploaded = page.waitForResponse(
				(res) =>
					/\/api\/v1\/temporaryFiles/.test(res.url()) &&
					res.ok() &&
					res.request().method() === 'POST',
				{timeout: 20_000},
			);
			await hiddenInput.setInputFiles(CSS_FIXTURE);
			await uploaded;
			await expect(
				advancedPanel.getByText('journal-stylesheet.css').first(),
			).toBeVisible({timeout: 15_000});
			const advRes = await site.saveForm(advancedPanel);
			// Canonical name — styleSheet.css, NOT localized (rule 5).
			expect((await advRes.json()).styleSheet.uploadName).toBe('styleSheet.css');

			// Setup → Page Footer, en + fr (the form's locale toggle).
			const setupPanel = await site.openAppearanceTab('appearance-setup');
			await setTinyMceContent(
				page,
				'appearanceSetup-pageFooter-control-en',
				`<p>${footerEn}</p>`,
			);
			await setupPanel.locator('button.pkpFormLocales__locale').click();
			await setTinyMceContent(
				page,
				'appearanceSetup-pageFooter-control-fr_CA',
				`<p>${footerFr}</p>`,
			);
			const setupRes = await site.saveForm(setupPanel);
			expect((await setupRes.json()).pageFooter.en).toContain(footerEn);

			// Anonymous: the link is emitted AFTER the theme's CSS bundles
			// (STYLE_SEQUENCE_LATE — the custom rule wins), cache-busted.
			const anon = await newAnonContext(browser, baseURL);
			const homeUrl = `/index.php/${ctx.path}/en/`;
			const {hrefs} = await fetchPageStylesheets(anon, homeUrl);
			const customIdx = hrefs.findIndex((h) => h.includes('styleSheet.css'));
			const themeIdx = hrefs.findIndex((h) =>
				h.includes('css?name=stylesheet'),
			);
			expect(customIdx, `styleSheet.css link in ${hrefs}`).toBeGreaterThan(-1);
			expect(themeIdx).toBeGreaterThan(-1);
			expect(customIdx).toBeGreaterThan(themeIdx);
			const customHref = hrefs[customIdx];
			expect(customHref).toMatch(/styleSheet\.css\?d=/);
			// The served CSS is our fixture.
			const servedCss = await (await anon.request.get(customHref)).text();
			expect(servedCss).toContain('.wat-custom-css-marker');

			// The locale-correct footer on every public page.
			const pub = await anon.newPage();
			await pub.goto(homeUrl);
			await expect(pub.getByText(footerEn).first()).toBeVisible();
			await pub.goto(`/index.php/${ctx.path}/fr_CA/`);
			await expect(pub.getByText(footerFr).first()).toBeVisible();

			// CLEAR the stylesheet through the same journal-settings
			// endpoint: the setting nulls and the <link> disappears…
			const csrf = await csrfToken(page);
			const clearRes = await putContext(
				page.request,
				ctx.path,
				ctx.id,
				{styleSheet: null},
				csrf,
			);
			expect(clearRes.status(), await clearRes.text()).toBe(200);
			const after = await fetchPageStylesheets(anon, homeUrl);
			expect(
				after.hrefs.find((h) => h.includes('styleSheet.css')),
			).toBeUndefined();
			// …but ⚠ the FILE is NOT deleted (ledger row 123): the clear
			// branch of PKPContextService::_saveFileParam() hands the stored
			// array to removeContextFile() where a filename is expected, so
			// styleSheet.css keeps being served at its stable URL. Asserting
			// the documented as-built behavior — do NOT green-flag deletion.
			const orphan = await anon.request.get(customHref.split('?')[0]);
			expect(orphan.status(), 'row 123: cleared file still served').toBe(200);
			expect(await orphan.text()).toContain('.wat-custom-css-marker');
			await anon.close();
		},
	);

	// ── Scenario 4 — Compose the sidebar ───────────────────────────────────────
	// The Sidebar picker offers the enabled block plugins (Make a Submission
	// is NOT offered — its shipped default never installs, ledger row 122).
	// The manager checks Language Toggle then Information and orders Language
	// Toggle first; the public sidebar renders those blocks in that order
	// (rules 9/11 + journal-homepage render). A save naming a non-existent
	// block is refused with "…block can not be found…" and changes nothing.
	// Enabling Make a Submission in Installed Plugins makes it appear in the
	// picker (the enable→offered loop).
	test(
		'sidebar picker: compose + order, invalid block refused, enable→offered loop (row 122)',
		{tag: '@regression'},
		async ({page, pkpApi, browser, baseURL}) => {
			test.slow();
			const tag = uniqueTag();
			const ctx = await seedJournal(pkpApi, tag, {
				primaryLocale: 'en',
				supportedLocales: ['en', 'fr_CA'],
			});

			const site = new WebsiteSettingsPage(page, ctx.path);
			await site.goto();
			const panel = await site.openAppearanceTab('appearance-setup');
			const field = sidebarField(panel, page);

			// The picker offers the enabled stock blocks…
			await expect(
				field.locator('input[name="sidebar"][value="languagetoggleblockplugin"]'),
			).toBeVisible();
			await expect(
				field.locator('input[name="sidebar"][value="informationblockplugin"]'),
			).toBeVisible();
			// …but NOT Make a Submission: its default-enabled settings file
			// never installs (ledger row 122) so it starts disabled everywhere.
			await expect(
				field.locator('input[name="sidebar"][value="makesubmissionblockplugin"]'),
			).toHaveCount(0);

			// Compose: check Language Toggle then Information, order Language
			// Toggle first via the Orderer, one Save (ordinary settings PUT).
			await field
				.locator('input[name="sidebar"][value="languagetoggleblockplugin"]')
				.check();
			await field
				.locator('input[name="sidebar"][value="informationblockplugin"]')
				.check();
			await moveSidebarOptionToTop(panel, page, 'languagetoggleblockplugin');
			const saveRes = await site.saveForm(panel);
			expect((await saveRes.json()).sidebar).toEqual([
				'languagetoggleblockplugin',
				'informationblockplugin',
			]);

			// Anonymous: both blocks render, in the saved order.
			const anon = await newAnonContext(browser, baseURL);
			const pub = await anon.newPage();
			await pub.goto(`/index.php/${ctx.path}/en/`);
			const sidebar = pub.locator('.pkp_structure_sidebar');
			await expect(sidebar).toBeVisible();
			await expect(sidebar.locator('.block_language')).toBeVisible();
			await expect(sidebar.locator('.block_information')).toBeVisible();
			const classes = await sidebar
				.locator('.pkp_block')
				.evaluateAll((els) => els.map((e) => e.className));
			expect(
				classes.findIndex((c) => c.includes('block_language')),
			).toBeLessThan(classes.findIndex((c) => c.includes('block_information')));

			// A non-existent block name is refused with the exact message and
			// nothing changes (the sidebar after-hook — Fields table).
			const csrf = await csrfToken(page);
			const bad = await putContext(
				page.request,
				ctx.path,
				ctx.id,
				{sidebar: ['bogusblockplugin']},
				csrf,
			);
			expect(bad.status()).toBe(400);
			expect(await bad.text()).toContain('block can not be found');
			const current = await getContext(page.request, ctx.path, ctx.id);
			expect(current.sidebar).toEqual([
				'languagetoggleblockplugin',
				'informationblockplugin',
			]);

			// Enable Make a Submission in Installed Plugins → it appears in
			// the picker on the next PAGE LOAD (the options list is built
			// server-side per load — a fresh goto, not just a tab switch).
			const pluginsGrid = new PluginsGridPage(page);
			await pluginsGrid.gotoJournalGrid(ctx.path);
			await pluginsGrid.enable('makesubmissionblockplugin');
			await site.goto();
			const panel2 = await site.openAppearanceTab('appearance-setup');
			await expect(
				sidebarField(panel2, page).locator(
					'input[name="sidebar"][value="makesubmissionblockplugin"]',
				),
			).toBeVisible();
			await anon.close();
		},
	);

	// ── Scenario 5 — Mint a custom sidebar block — and hit the delete bug ──────
	// With Custom Block Manager enabled, the manager opens Manage Custom
	// Blocks, adds "Reading List …" with rich-text content and Show Name on.
	// The block (kebab-derived permanent name) lands in the grid, is offered
	// in the Sidebar picker like a stock block, and — once placed first —
	// the public sidebar shows it with its visible title and body ahead of
	// the stock block (rule 9). Attempting to DELETE it fails with a server
	// error (HTTP 500 — the plugin_Name Postgres typo, ledger row 121) and
	// the block remains everywhere: grid AND public sidebar.
	test(
		'custom block: create → picker → public render; delete 500s and the block survives (row 121)',
		{tag: '@regression'},
		async ({page, pkpApi, browser, baseURL}) => {
			test.slow();
			const tag = uniqueTag();
			const ctx = await seedJournal(pkpApi, tag, {
				primaryLocale: 'en',
				supportedLocales: ['en'],
				sidebar: ['informationblockplugin'],
				plugins: {customblockmanagerplugin: {enabled: true}},
			});
			const blockTitle = `Reading List ${tag}`;
			const blockName = `reading-list-${tag}`; // kebab of the title (permanent)
			const blockBody = `Body text ${tag}`;

			// Installed Plugins → Custom Block Manager → Manage Custom Blocks.
			const pluginsGrid = new PluginsGridPage(page);
			const customGrid = page.locator(
				'#customBlockGridUrlGridContainer .pkp_controllers_grid',
			);
			await pluginsGrid.gotoJournalGrid(ctx.path);
			await pluginsGrid.openSettingsModal('customblockmanagerplugin', customGrid);

			// Add Block: multilingual name (required), rich-text content,
			// Show Name on — the legacy AjaxModal form.
			await page.getByRole('link', {name: 'Add Block'}).first().click();
			const form = page.locator('form#customBlockForm');
			await expect(form).toBeVisible({timeout: 15_000});
			await form.locator('input[name="blockTitle[en]"]').fill(blockTitle);
			await setLegacyTinyMceByPrefix(page, 'blockContent', `<p>${blockBody}</p>`);
			await form.locator('input[name="showName"]').check();
			const [createRes] = await Promise.all([
				page.waitForResponse(
					(res) =>
						/update-custom-block/.test(res.url()) &&
						res.request().method() === 'POST',
					{timeout: 20_000},
				),
				form.getByRole('button', {name: 'Save', exact: true}).click(),
			]);
			expect(createRes.status()).toBe(200);
			expect((await createRes.json()).status).toBe(true);
			await waitForJQueryIdle(page);
			// The grid lists the block under its derived permanent name.
			await expect(
				customGrid.locator('tr.gridRow').filter({hasText: blockName}),
			).toBeVisible({timeout: 15_000});

			// The new block is OFFERED in the Sidebar picker exactly like a
			// stock block; place it first, ahead of the seeded Information.
			const site = new WebsiteSettingsPage(page, ctx.path);
			await site.goto();
			const panel = await site.openAppearanceTab('appearance-setup');
			const blockOption = sidebarField(panel, page).locator(
				`input[name="sidebar"][value="${blockName}"]`,
			);
			await expect(blockOption).toBeVisible();
			await blockOption.check();
			await moveSidebarOptionToTop(panel, page, blockName);
			const saveRes = await site.saveForm(panel);
			expect((await saveRes.json()).sidebar).toEqual([
				blockName,
				'informationblockplugin',
			]);

			// Public: visible title (Show Name on) + body, ahead of the stock block.
			const anon = await newAnonContext(browser, baseURL);
			const pub = await anon.newPage();
			await pub.goto(`/index.php/${ctx.path}/`);
			const customBlock = pub.locator('.pkp_structure_sidebar .block_custom');
			await expect(customBlock).toBeVisible();
			await expect(customBlock.locator('h2.title')).toHaveText(blockTitle);
			await expect(
				customBlock.locator('h2.title'),
			).not.toHaveClass(/pkp_screen_reader/);
			await expect(customBlock.locator('.content')).toContainText(blockBody);
			const order = await pub
				.locator('.pkp_structure_sidebar .pkp_block')
				.evaluateAll((els) => els.map((e) => e.className));
			expect(order.findIndex((c) => c.includes('block_custom'))).toBeLessThan(
				order.findIndex((c) => c.includes('block_information')),
			);

			// DELETE → server error, block untouched (⚠ ledger row 121: the
			// plugin-settings delete names plugin_Name, which PostgreSQL
			// rejects — asserting the documented failure, NOT a green delete).
			await pluginsGrid.gotoJournalGrid(ctx.path);
			await pluginsGrid.openSettingsModal('customblockmanagerplugin', customGrid);
			const row = customGrid
				.locator('tr.gridRow')
				.filter({hasText: blockName});
			await expect(row).toBeVisible({timeout: 15_000});
			const rowId = await row.getAttribute('id');
			const expander = row.locator('a.show_extras');
			if (await expander.count()) {
				await expander.click();
			}
			await page.locator(`a[id^="${rowId}-deleteCustomBlock-button-"]`).click();
			const dialog = page
				.locator('[data-cy="dialog"]')
				.filter({hasText: 'Are you sure'});
			await expect(dialog).toBeVisible({timeout: 10_000});
			const [deleteRes] = await Promise.all([
				page.waitForResponse(
					(res) => /delete-custom-block/.test(res.url()),
					{timeout: 20_000},
				),
				dialog.getByRole('button', {name: 'OK', exact: true}).click(),
			]);
			expect(deleteRes.status(), 'row 121: delete 500s on Postgres').toBe(500);

			// The block remains everywhere: the grid on a fresh load…
			await pluginsGrid.gotoJournalGrid(ctx.path);
			await pluginsGrid.openSettingsModal('customblockmanagerplugin', customGrid);
			await expect(
				customGrid.locator('tr.gridRow').filter({hasText: blockName}),
			).toBeVisible({timeout: 15_000});
			// …and the public sidebar.
			await pub.goto(`/index.php/${ctx.path}/`);
			await expect(
				pub.locator('.pkp_structure_sidebar .block_custom'),
			).toBeVisible();
			await anon.close();
		},
	);

	// ── Scenario 6 — Localized dates follow the journal's formats ──────────────
	// The manager sets Date (Short) to d.m.Y for English (a preset radio) and
	// d/m/Y for French (the free "Custom" input) on Setup → Date & Time. The
	// home page's announcement date — rendered with the short format (rule 7)
	// — switches from the server-default Y-m-d shape to dd.mm.yyyy on the
	// English page and dd/mm/yyyy on the French one; the untouched formats
	// stay unset on the journal (server-config fallback keeps serving them).
	test(
		'short-date formats render per locale; unset formats keep server defaults',
		{tag: '@regression'},
		async ({page, pkpApi, browser, baseURL}) => {
			test.slow();
			const tag = uniqueTag();
			const ctx = await seedJournal(pkpApi, tag, {
				primaryLocale: 'en',
				supportedLocales: ['en', 'fr_CA'],
				enableAnnouncements: true,
				numAnnouncementsHomepage: 5,
				announcements: [
					{
						title: `Dated announcement ${tag}`,
						descriptionShort: `Short blurb ${tag}`,
					},
				],
			});

			// Baseline, anonymously: the announcement date renders in the
			// server-default Y-m-d shape before any journal format is set.
			const anon = await newAnonContext(browser, baseURL);
			const pub = await anon.newPage();
			await pub.goto(`/index.php/${ctx.path}/en/`);
			const announcements = pub.locator('section.cmp_announcements');
			await expect(announcements).toBeVisible();
			await expect(announcements).toContainText(/\d{4}-\d{2}-\d{2}/);

			// Setup → Date & Time: en preset d.m.Y; fr custom d/m/Y (the
			// "Custom" text input — focusing it selects its radio).
			const site = new WebsiteSettingsPage(page, ctx.path);
			await site.goto();
			const panel = await site.openSetupTab('dateTime');
			await panel
				.locator('input[name="dateFormatShort-en"][value="d.m.Y"]')
				.check();
			await panel.locator('button.pkpFormLocales__locale').click();
			const frShortField = panel
				.locator('fieldset.pkpFormField--options')
				.filter({has: page.locator('input[name="dateFormatShort-fr_CA"]')});
			await frShortField
				.locator('input.pkpFormField--options__input--text')
				.fill('d/m/Y');
			const saveRes = await site.saveForm(panel);
			const echoed = await saveRes.json();
			expect(echoed.dateFormatShort.en).toBe('d.m.Y');
			expect(echoed.dateFormatShort.fr_CA).toBe('d/m/Y');
			// Only the short format was touched — the long format still
			// reads as the SERVER-CONFIG default (`F j, Y`): the context
			// resolves unset formats through the config fallback (rule 7).
			expect(echoed.dateFormatLong.en).toBe('F j, Y');

			// The SAME surface now renders each locale's format.
			await pub.goto(`/index.php/${ctx.path}/en/`);
			await expect(announcements).toContainText(/\b\d{2}\.\d{2}\.\d{4}\b/);
			await expect(announcements).not.toContainText(/\d{4}-\d{2}-\d{2}/);
			await pub.goto(`/index.php/${ctx.path}/fr_CA/`);
			await expect(
				pub.locator('section.cmp_announcements'),
			).toContainText(/\b\d{2}\/\d{2}\/\d{4}\b/);
			await anon.close();
		},
	);

	// ── Scenario 7 — Pagination bounds and the permission wall ─────────────────
	// Items per page = 1 (Setup → Lists) splits the two-issue archive into
	// two one-issue pages with a next-page link (rule 8); saving 0 is refused
	// by the endpoint with "This must be at least 1." surfaced inline, value
	// unchanged. A user with no settings role (section editor) is refused the
	// Website page AND both save endpoints — the journal-settings PUT and the
	// theme PUT (its separate gate) — with nothing changed.
	test(
		'itemsPerPage paginates the archive; 0 refused; no-settings-role user walled off both endpoints',
		{tag: '@regression'},
		async ({page, pkpApi, asUser, browser, baseURL}) => {
			test.slow();
			const tag = uniqueTag();
			const ctx = await seedJournal(pkpApi, tag, {
				primaryLocale: 'en',
				supportedLocales: ['en'],
				users: [{username: 'dbuskins', roles: ['sectionEditor']}],
				issues: [
					{volume: 1, number: 1, year: 2023, published: true},
					{volume: 1, number: 2, year: 2024, published: true},
				],
			});

			// Setup → Lists: itemsPerPage = 1, one ordinary settings save.
			const site = new WebsiteSettingsPage(page, ctx.path);
			await site.goto();
			const panel = await site.openSetupTab('lists');
			await panel.locator('#lists-itemsPerPage-control').fill('1');
			const saveRes = await site.saveForm(panel);
			expect((await saveRes.json()).itemsPerPage).toBe(1);

			// Anonymous: the two-issue archive splits into two pages.
			const anon = await newAnonContext(browser, baseURL);
			const pub = await anon.newPage();
			await pub.goto(`/index.php/${ctx.path}/issue/archive`);
			const items = pub.locator('ul.issues_archive > li');
			await expect(items).toHaveCount(1);
			const pageOne = await items.first().innerText();
			const nextLink = pub.locator('.cmp_pagination a.next');
			await expect(nextLink).toBeVisible();
			await expect(nextLink).toHaveAttribute('href', /issue\/archive\/2/);
			await pub.goto(`/index.php/${ctx.path}/issue/archive/2`);
			await expect(items).toHaveCount(1);
			expect(await items.first().innerText()).not.toBe(pageOne);

			// Saving 0 is refused ("This must be at least 1." — min:1) and
			// the stored value stays 1. Driven through the REAL form.
			await panel.locator('#lists-itemsPerPage-control').fill('0');
			const badSave = page.waitForResponse(
				(r) =>
					r.url().includes(`/api/v1/contexts/${ctx.id}`) &&
					['PUT', 'POST'].includes(r.request().method()),
			);
			await panel
				.getByRole('button', {name: 'Save', exact: true})
				.click();
			expect((await badSave).status()).toBe(400);
			await expect(
				panel.getByText('This must be at least 1.', {exact: true}).first(),
			).toBeVisible();
			let current = await getContext(page.request, ctx.path, ctx.id);
			expect(current.itemsPerPage).toBe(1);

			// The permission wall: a section editor (no settings role) is
			// refused the page and BOTH save endpoints (settings + theme).
			const seCtx = await asUser('dbuskins');
			const sePage = await seCtx.newPage();
			await sePage.goto(`/index.php/${ctx.path}/management/settings/website`);
			await expect(sePage).toHaveURL(/authorizationDenied/, {timeout: 15_000});
			const seCsrf = await csrfFor(seCtx);
			const sePut = await putContext(
				seCtx.request,
				ctx.path,
				ctx.id,
				{itemsPerPage: 5},
				seCsrf,
			);
			expect(sePut.status(), 'settings PUT refused').toBe(401);
			const seTheme = await putTheme(
				seCtx.request,
				ctx.path,
				ctx.id,
				{typography: 'lora'},
				seCsrf,
			);
			expect(seTheme.status(), 'theme PUT refused').toBe(401);

			// Nothing changed under either refusal.
			current = await getContext(page.request, ctx.path, ctx.id);
			expect(current.itemsPerPage).toBe(1);
			const theme = await getTheme(page.request, ctx.path, ctx.id);
			expect(theme.typography).not.toBe('lora');
		},
	);
});
