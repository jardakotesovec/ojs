// @ts-check
const {test, expect} = require('../support/fixtures.js');
const {waitForJQueryIdle} = require('../../lib/pkp/playwright/support/jquery.js');
const {setTinyMceContent} = require('../../lib/pkp/playwright/support/tinymce.js');

/**
 * About & information pages — the anonymous reader's public informational
 * pages. One test per canonical scenario of docs/product/specs/about-pages.md
 * (5 named scenarios → 5 tests). Every one of these is a read-only, fully
 * public page whose content is a projection of journal settings, gated only by
 * whether the site is access-restricted — never by who is looking. So the
 * default `page` in this file carries NO session (no `test.use({user})`): the
 * reader assertions all run anonymous. The one manager action (authoring a
 * static page, scenario 5) opens a SEPARATE admin context via `asUser`.
 *
 * The spec author live-verified the read-only pages on the shared, read-only
 * `publicknowledge` journal but could NOT drive the custom-static-page path:
 * the Static Pages plugin ships disabled, and enabling it on publicknowledge
 * would mutate the shared journal. This suite closes that gap on a SCRATCH
 * journal — enabling the plugin via the scenario `plugins` passthrough
 * (writes `staticpagesplugin.enabled` into the journal's plugin_settings, which
 * activates the plugin's LoadHandler/settings-tab hooks at request time), then
 * creating a page through the manager grid and viewing it anonymously.
 *
 * As-built realities asserted here (feedback discipline — assert reality, don't
 * edit the spec):
 *   - `/about/editorialTeam` is a DEAD op → 404 (only `editorialMasthead`
 *     exists; there is no editorialTeam alias in the router). [Known deviation]
 *   - The public Editorial Masthead renders EMPTY on the seed (heading +
 *     history link only): the masthead role groups are flagged, but no
 *     non-reviewer user carries the per-assignment masthead flag, and no
 *     reviews completed in the prior year. [rule 5 / Open question 1]
 *   - The Submissions page does NOT list per-section policies — it loads
 *     sections only to gate the accepting/not-accepting notice. [rule 3 note]
 *   - The About text is empty on the seed, so `/about` renders heading-only —
 *     the page still renders. [rule 1]
 *
 * Reader-URL locale rule (patterns.md item 9): `publicknowledge` is multi-locale
 * (needs the `/en/` prefix); single-locale scratch journals serve the bare path.
 */

/** publicknowledge reader URL (multi-locale → explicit /en/ prefix). */
function pk(op) {
	return `/index.php/publicknowledge/en/${op}`;
}

/** A unique, hyphenless, alphanumeric journal path (≤32, parallel isolation). */
function uniquePath(prefix = 'about') {
	const workerLetter = String.fromCharCode(97 + (test.info().parallelIndex % 26));
	let suffix = '';
	while (suffix.length < 6) {
		suffix += Math.random().toString(36).replace(/[^a-z0-9]/g, '');
	}
	return `${prefix}${workerLetter}${suffix.slice(0, 6)}`;
}

test.describe('About & information pages — the anonymous reader informational pages', () => {
	// Canonical scenario 1 — A reader reads About, Contact and Privacy.
	// Anonymous visitor opens /about (the "About the Journal" heading; the
	// About text is empty on the seed so the page renders heading-only — rule
	// 1), /about/contact (Principal + Support contact blocks, the contact name,
	// emails JavaScript-obfuscated — rule 2) and /about/privacy (the seeded
	// privacy statement — rule 4). Also pins the KNOWN-DEVIATION dead op:
	// /about/editorialTeam is not a live route → 404.
	test(
		'reader reads About, Contact and Privacy; /about/editorialTeam is a dead 404',
		{tag: ['@smoke', '@regression']},
		async ({page}) => {
			// About — heading + page container render even with empty About text.
			await page.goto(pk('about'));
			await expect(
				page.getByRole('heading', {level: 1, name: 'About the Journal'}),
			).toBeVisible();
			await expect(page.locator('.page_about')).toBeVisible();

			// Contact — Principal + Support contact blocks with the contact name.
			await page.goto(pk('about/contact'));
			await expect(
				page.getByRole('heading', {level: 1, name: 'Contact'}),
			).toBeVisible();
			const primary = page.locator('.contact.primary');
			await expect(
				primary.getByRole('heading', {name: 'Principal Contact'}),
			).toBeVisible();
			await expect(primary.locator('.name')).toContainText('Ramiro Vaca');
			await expect(
				page
					.locator('.contact.support')
					.getByRole('heading', {name: 'Support Contact'}),
			).toBeVisible();

			// Email obfuscation (rule 2): the raw HTML source carries a
			// document.write of a percent-escaped mailto, NOT a scrapeable
			// plain-text address. Assert against the SOURCE (page.request), not
			// the rendered DOM (the browser executes document.write, so the DOM
			// would contain the decoded link).
			const contactSrc = await (
				await page.request.get(pk('about/contact'))
			).text();
			expect(contactSrc).toContain('document.write');
			expect(contactSrc).not.toContain('rvaca@mailinator.com');

			// Privacy — heading + the seeded statement text (rule 4).
			await page.goto(pk('about/privacy'));
			await expect(
				page.getByRole('heading', {level: 1, name: 'Privacy Statement'}),
			).toBeVisible();
			await expect(page.locator('.page_privacy')).toContainText(
				'will be used exclusively for the stated purposes of this journal',
			);

			// Known deviation: /about/editorialTeam is not a live op → 404.
			const dead = await page.request.get(pk('about/editorialTeam'));
			expect(dead.status()).toBe(404);
		},
	);

	// Canonical scenario 2 — A reader reads the Submissions guidelines.
	// Anonymous visitor opens /about/submissions: a "Login or Register to make a
	// submission" call-to-action, followed by the configured guidance sections
	// (Author Guidelines, Submission Preparation Checklist). Asserts the rule-3
	// scope correction: the page does NOT list per-section policies — it loads
	// sections only to compute the accepting/not-accepting notice, so neither
	// section title appears as a heading here.
	test(
		'the Submissions guidelines page shows the anonymous CTA + guidance and lists no per-section policies',
		{tag: '@regression'},
		async ({page}) => {
			await page.goto(pk('about/submissions'));
			await expect(
				page.getByRole('heading', {level: 1, name: 'Submissions'}),
			).toBeVisible();

			// Anonymous call-to-action (rule 3): Login or Register prompt.
			const notification = page.locator('.cmp_notification');
			await expect(notification).toContainText('Login');
			await expect(notification).toContainText('Register');
			await expect(notification.getByRole('link', {name: 'Login'})).toHaveAttribute(
				'href',
				/\/login/,
			);
			await expect(
				notification.getByRole('link', {name: 'Register'}),
			).toHaveAttribute('href', /\/user\/register/);

			// The configured guidance sections render.
			const pageBody = page.locator('.page_submissions');
			await expect(
				pageBody.getByRole('heading', {name: 'Author Guidelines'}),
			).toBeVisible();
			await expect(
				pageBody.getByRole('heading', {name: 'Submission Preparation Checklist'}),
			).toBeVisible();

			// Rule-3 note: NO per-section policies — the journal's sections
			// (Articles / Reviews) never appear as headings on this page.
			await expect(
				pageBody.getByRole('heading', {name: 'Articles'}),
			).toHaveCount(0);
			await expect(
				pageBody.getByRole('heading', {name: 'Reviews'}),
			).toHaveCount(0);
		},
	);

	// Canonical scenario 3 — A reader opens the public Editorial Masthead and
	// the About-this-publishing-system credit. /about/editorialMasthead renders
	// its heading and the link to Editorial History, but the roster is EMPTY on
	// the seed (no non-reviewer user is masthead-flagged, no prior-year
	// reviewers) — a pure projection of the masthead config (rule 5 / Known
	// deviation). /about/aboutThisPublishingSystem renders the fixed OJS version
	// credit (rule 7).
	test(
		'the Editorial Masthead renders (empty roster) and About-this-publishing-system credits OJS',
		{tag: '@regression'},
		async ({page}) => {
			// Editorial Masthead — page + heading render; roster is empty.
			await page.goto(pk('about/editorialMasthead'));
			await expect(
				page.getByRole('heading', {level: 1, name: 'Editorial Masthead'}),
			).toBeVisible();
			const masthead = page.locator('.page_masthead');
			// A link to the Editorial History page is always present.
			await expect(
				masthead.getByRole('link', {name: /Editorial History/i}),
			).toHaveAttribute('href', /about\/editorialHistory/);
			// Empty roster (Known deviation): no role/section headings render —
			// neither a masthead role group nor the Peer Reviewers section, both
			// of which would be <h2>s if populated.
			await expect(masthead.locator('h2')).toHaveCount(0);

			// About this publishing system — the fixed OJS version credit.
			await page.goto(pk('about/aboutThisPublishingSystem'));
			await expect(
				page.getByRole('heading', {level: 1, name: 'About Open Journal Systems'}),
			).toBeVisible();
			await expect(page.locator('.page_about_publishing_system')).toContainText(
				/Open Journal Systems \d/,
			);
		},
	);

	// Canonical scenario 4 — A reader opens the Information pages. Anonymous
	// visitor opens /information/{readers,authors,librarians} and reads each
	// info block (heading + the configured description text — rule 8). A bare
	// /information with no recognised sub-page redirects (302) to the journal
	// home page.
	test(
		'the Information pages render and a bare /information redirects home',
		{tag: '@regression'},
		async ({page}) => {
			const infoPages = [
				{op: 'information/readers', heading: 'Information For Readers'},
				{op: 'information/authors', heading: 'Information For Authors'},
				{op: 'information/librarians', heading: 'Information For Librarians'},
			];
			for (const {op, heading} of infoPages) {
				await page.goto(pk(op));
				await expect(
					page.getByRole('heading', {level: 1, name: heading}),
				).toBeVisible();
				// Each renders a non-empty description block (rule 8).
				await expect(
					page.locator('.page_information .description'),
				).not.toBeEmpty();
			}

			// Bare /information → 302 to the journal home (rule 8 default branch).
			const redirect = await page.request.get(pk('information'), {
				maxRedirects: 0,
			});
			expect(redirect.status()).toBe(302);
			const location = redirect.headers()['location'] ?? '';
			expect(location).toContain('/publicknowledge/');
			expect(location).not.toContain('/information');
		},
	);

	// Canonical scenario 5 — A manager publishes a custom static page; a reader
	// views it. On a SCRATCH journal with the Static Pages plugin enabled (via
	// the scenario `plugins` passthrough), a manager (admin, auto-enrolled as
	// the scratch journal's manager) creates a page at a custom path (title +
	// rich-text content) through Settings → Website → Static Pages (rules 9-11);
	// an anonymous reader then opens /{journalPath}/{path} and sees the rendered
	// title + content (rule 10). A non-existent custom path 404s (rule 9).
	test(
		'a manager publishes a custom static page on a scratch journal; a reader views it; a missing path 404s',
		{tag: '@regression'},
		async ({page, pkpApi, asUser}) => {
			const journalPath = uniquePath('about');
			const suffix = journalPath.slice(-6);
			const pagePath = `about-us-${suffix}`;
			const marker = `static-page-marker-${suffix}`;
			const pageTitle = `Our Custom About Us ${suffix}`;

			// Seed a scratch journal with the Static Pages plugin enabled. The
			// passthrough writes staticpagesplugin.enabled=1 into plugin_settings,
			// which registers the plugin's LoadHandler + settings-tab hooks on
			// every subsequent request to this journal.
			await pkpApi.createJournal({
				tag: journalPath,
				path: journalPath,
				primaryLocale: 'en',
				supportedLocales: ['en'],
				name: {en: `About Pages ${journalPath}`},
				plugins: {staticpagesplugin: {enabled: true}},
			});

			// Manager authoring path (rule 11): open the plugin's Static Pages tab
			// under Settings → Website and create the page through its legacy grid.
			const adminCtx = await asUser('admin');
			const adminPage = await adminCtx.newPage();
			await adminPage.goto(
				`/index.php/${journalPath}/management/settings/website`,
			);
			await adminPage.locator('#staticPages-button').click();
			const grid = adminPage.locator('#staticPageGridContainer');
			const addLink = grid.locator(
				'a[id^="component-plugins-generic-staticpages-controllers-grid-staticpagegrid-addStaticPage-button-"]',
			);
			await expect(addLink).toBeVisible({timeout: 20_000});
			await waitForJQueryIdle(adminPage);
			await addLink.click();

			// The add form opens in an AjaxModal. Fill path + title + rich content.
			const form = adminPage.locator('#staticPageForm');
			const pathInput = form.locator('input[name="path"]');
			await expect(pathInput).toBeVisible({timeout: 15_000});
			await pathInput.fill(pagePath);
			await form.locator('input[name="title[en]"]').fill(pageTitle);
			// The rich content textarea. On a single-locale journal the fbv
			// template skips the per-locale popover, so the id is `content-{hash}`
			// (not `content-en-{hash}`); select by the stable `content[en]` name
			// and read the runtime id TinyMCE mounts against.
			const contentTextarea = form.locator('textarea[name="content[en]"]');
			const editorId = await contentTextarea.getAttribute('id');
			await setTinyMceContent(adminPage, editorId, `<p>${marker}</p>`);

			// Save; the AjaxFormHandler closes the modal on success (a still-open
			// form means server-side validation failed).
			await form.locator('button.submitFormButton').click();
			await expect(form).toHaveCount(0, {timeout: 15_000});
			await waitForJQueryIdle(adminPage);

			// Anonymous reader views the published page (single-locale scratch
			// journal → bare path). The default `page` carries no session.
			const view = await page.goto(`/index.php/${journalPath}/${pagePath}`);
			expect(view?.status()).toBe(200);
			await expect(
				page.getByRole('heading', {name: pageTitle}),
			).toBeVisible();
			await expect(page.getByText(marker)).toBeVisible();

			// A non-existent custom path falls through → 404 (rule 9).
			const missing = await page.goto(
				`/index.php/${journalPath}/no-such-static-page-${suffix}`,
			);
			expect(missing?.status()).toBe(404);
		},
	);
});
