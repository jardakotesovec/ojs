// @ts-check
const {test, expect} = require('../support/fixtures.js');
const {
	setTinyMceContent,
	getTinyMceContent,
} = require('../../lib/pkp/playwright/support/tinymce.js');

/**
 * Journal setup — docs/e2e/plans/journal-setup.md (rows 1–4).
 *
 * The Masthead + Contact forms on /management/settings/context are the
 * surface under test (OJS's MastheadForm adds abbreviation / publisher /
 * ISSN fields on top of PKPMastheadForm), so rows 1–3 enter values
 * through the forms rather than seeding them via the scenario
 * passthroughs. Public render assertions use explicit anonymous
 * contexts (patterns.md rule 8).
 *
 * Per-row notes:
 *   1. New journal name must reach the anonymous journal homepage
 *      header (frontend/components/header.tpl `.pkp_site_name a.is_text`)
 *      and the site index listing (frontend/pages/indexSite.tpl).
 *   2. The homepage "About the Journal" block renders only when the
 *      active theme's `showDescriptionInJournalIndex` option is on
 *      (DefaultThemePlugin default: false). Theme options are plain
 *      plugin settings, so the scenario's `plugins` passthrough seeds
 *      it — the option is a precondition, not the surface under test.
 *   3. /about/contact (lib/pkp frontend/pages/contact.tpl) renders
 *      mailing address + principal/support blocks. The email links are
 *      written via Smarty's {mailto encode='javascript'}, so a real
 *      browser page is required (same as public-pages.spec.js row 1).
 *   4. Required-field validation is client-side (Form.vue
 *      validateRequired — no request fires; FieldError renders
 *      "This field is required."); email-format validation is server-side
 *      (context schema `email_or_localhost`, 400 with an inline error).
 *
 * Scratch-journal gotchas (wave-8): the scenario seeds `acronym` empty
 * unless passed, and the masthead form requires name + acronym +
 * country — tests that save the masthead either fill the acronym or
 * seed it.
 */

/** Short worker-scoped tag (journals.path is varchar(32)). */
function uniqueTag(prefix) {
	const workerIndex = test.info().parallelIndex;
	const suffix = Math.random().toString(36).slice(2, 8);
	return `${prefix}-w${workerIndex}-${suffix}`;
}

/**
 * Fresh anonymous browser context with an explicit empty storageState
 * so it can never inherit a logged-in session (patterns.md rule 8).
 *
 * @param {import('@playwright/test').Browser} browser
 * @param {string} [baseURL]
 */
async function anonContext(browser, baseURL) {
	return browser.newContext({
		baseURL,
		storageState: {cookies: [], origins: []},
	});
}

/**
 * Open the journal settings page (Masthead is the default tab) and
 * return the masthead form locator.
 *
 * @param {import('@playwright/test').Page} page
 * @param {string} journalPath
 */
async function openMastheadForm(page, journalPath) {
	await page.goto(`/index.php/${journalPath}/management/settings/context`);
	const form = page.locator('#masthead form').first();
	await expect(form).toBeVisible({timeout: 30_000});
	return form;
}

/**
 * Open the Contact tab on the journal settings page and return the
 * contact form locator.
 *
 * @param {import('@playwright/test').Page} page
 * @param {string} journalPath
 */
async function openContactForm(page, journalPath) {
	await page.goto(`/index.php/${journalPath}/management/settings/context`);
	const tabButton = page.locator('#contact-button');
	await expect(tabButton).toBeVisible({timeout: 30_000});
	await tabButton.click();
	const form = page.locator('#contact form').first();
	await expect(form).toBeVisible({timeout: 15_000});
	return form;
}

/**
 * Click a settings form's Save and wait for the contexts API PUT to
 * succeed. Form.vue tunnels PUT through POST + X-Http-Method-Override,
 * so match on URL + ok only. Toast assertions are avoided on purpose —
 * dbarnes is shared across parallel workers (patterns.md, parallel-load
 * lesson 2).
 *
 * @param {import('@playwright/test').Page} page
 * @param {import('@playwright/test').Locator} form
 * @param {number} contextId
 */
async function saveContextForm(page, form, contextId) {
	const saveButton = form.getByRole('button', {name: 'Save', exact: true});
	await saveButton.scrollIntoViewIfNeeded();
	await Promise.all([
		page.waitForResponse(
			(res) =>
				res.url().includes(`/api/v1/contexts/${contextId}`) && res.ok(),
			{timeout: 20_000},
		),
		saveButton.click(),
	]);
}

test.describe('Journal setup', () => {
	test(
		'masthead identity persists and renames the public journal',
		{tag: '@regression'},
		async ({pkpApi, asUser, browser, baseURL}) => {
			const tag = uniqueTag('jsm');
			const newName = `Renamed Journal ${tag}`;
			const {context} = await pkpApi.createJournal({
				tag,
				name: {en: `Journal setup ${tag}`},
				users: [{username: 'dbarnes', roles: ['manager']}],
			});

			const ctx = await asUser('dbarnes');
			const page = await ctx.newPage();
			let form = await openMastheadForm(page, context.path);

			// Identity + publishing fields. The scratch journal seeds the
			// acronym empty, so filling it here is also what makes the
			// required-field set complete (country defaults to US via the
			// scenario). ISSNs must pass the `issn` checksum rule — use
			// two known-valid ISSNs.
			await form.locator('#masthead-name-control-en').fill(newName);
			await form.locator('#masthead-acronym-control-en').fill(`RJ${tag.slice(-4)}`);
			await form
				.locator('#masthead-abbreviation-control-en')
				.fill(`RenJ ${tag.slice(-4)}`);
			await form
				.locator('#masthead-publisherInstitution-control')
				.fill(`Public Knowledge House ${tag}`);
			await form
				.locator('#masthead-publisherUrl-control')
				.fill('https://publisher.example.com');
			await form.locator('#masthead-onlineIssn-control').fill('2049-3630');
			await form.locator('#masthead-printIssn-control').fill('0378-5955');
			await saveContextForm(page, form, context.id);

			// Reload — every entered value must round-trip.
			form = await openMastheadForm(page, context.path);
			await expect(form.locator('#masthead-name-control-en')).toHaveValue(
				newName,
			);
			await expect(
				form.locator('#masthead-acronym-control-en'),
			).toHaveValue(`RJ${tag.slice(-4)}`);
			await expect(
				form.locator('#masthead-abbreviation-control-en'),
			).toHaveValue(`RenJ ${tag.slice(-4)}`);
			await expect(
				form.locator('#masthead-publisherInstitution-control'),
			).toHaveValue(`Public Knowledge House ${tag}`);
			await expect(
				form.locator('#masthead-publisherUrl-control'),
			).toHaveValue('https://publisher.example.com');
			await expect(
				form.locator('#masthead-onlineIssn-control'),
			).toHaveValue('2049-3630');
			await expect(form.locator('#masthead-printIssn-control')).toHaveValue(
				'0378-5955',
			);

			// Anonymous reader: the journal homepage header prints the new
			// name (text-mode site name — no logo configured on a scratch
			// journal), and the site index lists the renamed journal.
			const anon = await anonContext(browser, baseURL);
			try {
				const reader = await anon.newPage();
				await reader.goto(`/index.php/${context.path}`);
				await expect(
					reader.locator('.pkp_site_name a.is_text'),
				).toHaveText(newName);

				await reader.goto('/index.php/index');
				await expect(
					reader.getByRole('link', {name: newName, exact: true}).first(),
				).toBeVisible();
			} finally {
				await anon.close();
			}
		},
	);

	test(
		'journal summary and about text surface on reader pages',
		{tag: '@regression'},
		async ({pkpApi, asUser, browser, baseURL}) => {
			const tag = uniqueTag('jsd');
			const descriptionText = `A journal of seeded knowledge ${tag}`;
			const aboutText = `Everything about this journal ${tag}`;
			const {context} = await pkpApi.createJournal({
				tag,
				name: {en: `Journal summary ${tag}`},
				acronym: {en: 'JSD2'},
				users: [{username: 'dbarnes', roles: ['manager']}],
				// The homepage description block is gated on the default
				// theme's showDescriptionInJournalIndex option (default
				// false). Theme options live in plugin_settings, so the
				// generic plugins passthrough seeds the precondition.
				plugins: {
					defaultthemeplugin: {
						settings: {showDescriptionInJournalIndex: true},
					},
				},
			});

			const ctx = await asUser('dbarnes');
			const page = await ctx.newPage();
			const form = await openMastheadForm(page, context.path);

			await setTinyMceContent(
				page,
				'masthead-description-control-en',
				`<p>${descriptionText}</p>`,
				{timeout: 15_000},
			);
			await setTinyMceContent(
				page,
				'masthead-about-control-en',
				`<p>${aboutText}</p>`,
				{timeout: 15_000},
			);
			await saveContextForm(page, form, context.id);

			// Reload and confirm the rich-text values persisted (TinyMCE
			// values never reach the backing textarea — read through the
			// editor API).
			await openMastheadForm(page, context.path);
			expect(
				await getTinyMceContent(page, 'masthead-description-control-en', {
					timeout: 15_000,
				}),
			).toContain(descriptionText);
			expect(
				await getTinyMceContent(page, 'masthead-about-control-en', {
					timeout: 15_000,
				}),
			).toContain(aboutText);

			const anon = await anonContext(browser, baseURL);
			try {
				const reader = await anon.newPage();

				// Homepage: "About the Journal" section with the summary.
				await reader.goto(`/index.php/${context.path}`);
				const aboutSection = reader.locator('section.homepage_about');
				await expect(aboutSection).toBeVisible();
				await expect(
					aboutSection.getByRole('heading', {name: 'About the Journal'}),
				).toBeVisible();
				await expect(aboutSection).toContainText(descriptionText);

				// /about: the about text renders in the page body.
				const resp = await reader.goto(`/index.php/${context.path}/about`);
				expect(resp?.status()).toBe(200);
				await expect(reader.locator('.page_about')).toContainText(
					aboutText,
				);
			} finally {
				await anon.close();
			}
		},
	);

	test(
		'contact settings persist and render on the public contact page',
		{tag: '@regression'},
		async ({pkpApi, asUser, browser, baseURL}) => {
			const tag = uniqueTag('jsc');
			const principalName = `Principal Contact ${tag}`;
			const principalEmail = `principal-${tag}@example.com`;
			const principalPhone = '+1-604-555-0101';
			const principalAffiliation = `University of Testing ${tag}`;
			const mailingAddress = `123 Test Street\nVancouver BC ${tag}`;
			const supportName = `Support Person ${tag}`;
			const supportEmail = `support-${tag}@example.com`;
			const supportPhone = '+1-604-555-0202';
			const {context} = await pkpApi.createJournal({
				tag,
				name: {en: `Journal contact ${tag}`},
				users: [{username: 'dbarnes', roles: ['manager']}],
			});

			const ctx = await asUser('dbarnes');
			const page = await ctx.newPage();
			let form = await openContactForm(page, context.path);

			await form.locator('#contact-contactName-control').fill(principalName);
			await form
				.locator('#contact-contactEmail-control')
				.fill(principalEmail);
			await form
				.locator('#contact-contactPhone-control')
				.fill(principalPhone);
			await form
				.locator('#contact-contactAffiliation-control-en')
				.fill(principalAffiliation);
			await form
				.locator('#contact-mailingAddress-control')
				.fill(mailingAddress);
			await form.locator('#contact-supportName-control').fill(supportName);
			await form.locator('#contact-supportEmail-control').fill(supportEmail);
			await form.locator('#contact-supportPhone-control').fill(supportPhone);
			await saveContextForm(page, form, context.id);

			// Reload — values must round-trip.
			form = await openContactForm(page, context.path);
			await expect(
				form.locator('#contact-contactName-control'),
			).toHaveValue(principalName);
			await expect(
				form.locator('#contact-contactEmail-control'),
			).toHaveValue(principalEmail);
			await expect(
				form.locator('#contact-contactPhone-control'),
			).toHaveValue(principalPhone);
			await expect(
				form.locator('#contact-contactAffiliation-control-en'),
			).toHaveValue(principalAffiliation);
			await expect(
				form.locator('#contact-mailingAddress-control'),
			).toHaveValue(mailingAddress);
			await expect(
				form.locator('#contact-supportName-control'),
			).toHaveValue(supportName);
			await expect(
				form.locator('#contact-supportEmail-control'),
			).toHaveValue(supportEmail);
			await expect(
				form.locator('#contact-supportPhone-control'),
			).toHaveValue(supportPhone);

			// Anonymous /about/contact: mailing address, principal and
			// support blocks (frontend/pages/contact.tpl).
			const anon = await anonContext(browser, baseURL);
			try {
				const reader = await anon.newPage();
				const resp = await reader.goto(
					`/index.php/${context.path}/about/contact`,
				);
				expect(resp?.status()).toBe(200);

				// Mailing address renders nl2br'd inside .address.
				const address = reader.locator('.contact_section .address');
				await expect(address).toContainText('123 Test Street');
				await expect(address).toContainText(`Vancouver BC ${tag}`);

				const primary = reader.locator('.contact.primary');
				await expect(primary.locator('.name')).toContainText(
					principalName,
				);
				await expect(primary.locator('.affiliation')).toContainText(
					principalAffiliation,
				);
				await expect(primary.locator('.phone .value')).toContainText(
					principalPhone,
				);
				await expect(
					primary.getByRole('link', {name: principalEmail}),
				).toBeVisible();

				const support = reader.locator('.contact.support');
				await expect(support.locator('.name')).toContainText(supportName);
				await expect(support.locator('.phone .value')).toContainText(
					supportPhone,
				);
				await expect(
					support.getByRole('link', {name: supportEmail}),
				).toBeVisible();
			} finally {
				await anon.close();
			}
		},
	);

	test(
		'masthead and contact form validation',
		{tag: '@regression'},
		async ({pkpApi, asUser}) => {
			const tag = uniqueTag('jsv');
			const {context} = await pkpApi.createJournal({
				tag,
				name: {en: `Journal validation ${tag}`},
				// Seed the acronym so the masthead form starts valid and the
				// test controls exactly which fields it invalidates.
				acronym: {en: 'JSV4'},
				users: [{username: 'dbarnes', roles: ['manager']}],
			});

			const ctx = await asUser('dbarnes');
			const page = await ctx.newPage();

			// --- Masthead: clearing the required name + acronym blocks the
			// save client-side (Form.vue validateRequired fires no request)
			// and renders inline FieldError messages.
			let form = await openMastheadForm(page, context.path);
			await form.locator('#masthead-name-control-en').fill('');
			await form.locator('#masthead-acronym-control-en').fill('');
			let apiCalled = false;
			const listener = (/** @type {import('@playwright/test').Request} */ req) => {
				if (req.url().includes(`/api/v1/contexts/${context.id}`)) {
					apiCalled = true;
				}
			};
			page.on('request', listener);
			const saveButton = form.getByRole('button', {name: 'Save', exact: true});
			await saveButton.scrollIntoViewIfNeeded();
			await saveButton.click();
			await expect(form.locator('#masthead-name-error-en')).toContainText(
				'This field is required.',
			);
			await expect(
				form.locator('#masthead-acronym-error-en'),
			).toContainText('This field is required.');
			page.off('request', listener);
			expect(apiCalled, 'no contexts PUT while required fields empty').toBe(
				false,
			);

			// Correcting the values allows the save to go through.
			const fixedName = `Valid Journal ${tag}`;
			await form.locator('#masthead-name-control-en').fill(fixedName);
			await form.locator('#masthead-acronym-control-en').fill('JSV4');
			await saveContextForm(page, form, context.id);
			form = await openMastheadForm(page, context.path);
			await expect(form.locator('#masthead-name-control-en')).toHaveValue(
				fixedName,
			);

			// --- Contact: a malformed principal email passes the client's
			// required check but the API rejects it (email_or_localhost) —
			// 400 with an inline error on the field.
			form = await openContactForm(page, context.path);
			await form.locator('#contact-contactName-control').fill('Val Contact');
			await form
				.locator('#contact-contactEmail-control')
				.fill('not-an-email-address');
			await form.locator('#contact-supportName-control').fill('Val Support');
			await form
				.locator('#contact-supportEmail-control')
				.fill(`valid-support-${tag}@example.com`);
			const contactSave = form.getByRole('button', {
				name: 'Save',
				exact: true,
			});
			await contactSave.scrollIntoViewIfNeeded();
			await Promise.all([
				page.waitForResponse(
					(res) =>
						res.url().includes(`/api/v1/contexts/${context.id}`) &&
						res.status() === 400,
					{timeout: 20_000},
				),
				contactSave.click(),
			]);
			await expect(
				form.locator('#contact-contactEmail-error'),
			).toContainText(/valid email/i);

			// Correcting the email lets the form save.
			const fixedEmail = `valid-principal-${tag}@example.com`;
			await form.locator('#contact-contactEmail-control').fill(fixedEmail);
			await saveContextForm(page, form, context.id);
			form = await openContactForm(page, context.path);
			await expect(
				form.locator('#contact-contactEmail-control'),
			).toHaveValue(fixedEmail);
		},
	);
});
