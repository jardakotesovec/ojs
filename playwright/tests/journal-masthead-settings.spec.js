// @ts-check
const {test, expect} = require('../support/fixtures.js');
const {setTinyMceContent} = require('../../lib/pkp/playwright/support/tinymce.js');

/**
 * Journal masthead & identity settings — the four journal-settings forms
 * (Masthead + Contact on Settings → Journal; Privacy + Information on
 * Settings → Website → Setup) and the public surfaces each field projects
 * onto. One test per canonical scenario of
 * docs/product/specs/journal-masthead-settings.md (4 named, 4 tests, 1:1).
 *
 * WHAT IS DRIVEN LIVE:
 *   - The REAL Vue pkp-forms: Masthead (title en+fr / initials / abbreviation
 *     / country / publisher + URL / both ISSNs / summary / about / editorial
 *     history — including the FormLocales fr_CA toggle), Contact (both
 *     contact blocks + mailing address), Privacy and Information (TinyMCE
 *     rich text). Every save is ONE PUT to the journal-settings API
 *     (tunneled as POST + X-Http-Method-Override by the Vue form).
 *   - Public surfacing, read ANONYMOUSLY on the scratch journal: reader-page
 *     header/<title>, the site-index entry (title + summary), /about body
 *     (en AND fr_CA — per-locale rendering), the /about/editorialHistory
 *     tail, OAI Identify (repositoryName + adminEmail), /about/contact
 *     (blocks + JS-obfuscated emails), /about/privacy (custom text, then 404
 *     when cleared), the registration-consent and /about/submissions privacy
 *     references, /information/readers and the sidebar Information block's
 *     per-blurb links (link → block removal as blurbs empty).
 *   - Validation at both layers: the form surfaces the server's field error
 *     (invalid email → 400 + "This is not a valid email address." inline);
 *     API probes pin invalid ISSN / invalid URL / empty primary-locale title
 *     / empty principal name as 400s with the exact messages, and the
 *     primary-locale-only rule (empty fr title saves fine). Row-119 fields
 *     (initials, support name/email) are exercised via the UI's happy path
 *     only — the documented schema hole is the ledger's, not this suite's.
 *   - The AUTHZ gate (rule 8): manager + admin get the four-tab page;
 *     section editor / author / reviewer / assistant are refused on the page
 *     AND the PUT (401, value unchanged) and carry no Settings nav entry;
 *     stripping Permit settings from the scratch journal's manager group
 *     (via the roles-grid handler, as admin) locks the manager out of page +
 *     endpoint on THAT journal while publicknowledge stays open to him.
 *
 * AUTH: `test.use({user: 'dbarnes'})` — dbarnes is enrolled as manager of
 * each test's OWN scratch journal. Public reads use explicit empty-state
 * anonymous contexts (patterns.md item 8). Other actors via `asUser`.
 *
 * PARALLEL + isolation: every test seeds its OWN scratch journal (unique
 * hyphenless `jmt…` tag) and mutates identity/contact/privacy/info settings
 * ONLY there — publicknowledge is never written (test 4's cross-journal
 * probe is a read-only GET). The permitSettings flip hits the scratch
 * journal's own manager group only (per-journal scope, spec rule 8). The
 * site-index assertion only checks OUR journal's entry (other workers'
 * scratch journals may coexist — harmless). No Mailpit: saving these forms
 * produces no email, notification or event-log entry (spec Side effects).
 * Fully parallel at the flat root.
 */

const MANAGER = 'dbarnes';

/** A unique, hyphenless, lowercased alphanumeric token (parallel + re-run isolation). */
function uniqueTag(prefix = 'jmt') {
	const workerIndex = test.info().parallelIndex;
	const rand = Math.random().toString(36).slice(2, 8);
	return `${prefix}${workerIndex}x${rand}`;
}

/** Seed a scratch journal (users + extra spec passthrough) → context. */
async function seedJournal(pkpApi, tag, users = [], extra = {}) {
	const {context} = await pkpApi.createJournal({tag, users, ...extra});
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

/**
 * Read the session CSRF token of an authenticated BrowserContext by
 * scraping the <meta name="csrf-token"> tag off the SITE-level profile
 * page (works without opening a page). Cached per context.
 */
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
 * PUT journal settings through the same journal-settings API all four
 * forms save to. Returns the APIResponse (callers assert the status —
 * several probes EXPECT a refusal).
 */
async function putContext(requestCtx, path, contextId, data, csrf) {
	return requestCtx.put(`/index.php/${path}/api/v1/contexts/${contextId}`, {
		headers: {'X-Csrf-Token': csrf, 'Content-Type': 'application/json'},
		data,
	});
}

/** GET the journal's settings JSON (manager/admin session required). */
async function getContext(requestCtx, path, contextId) {
	const res = await requestCtx.get(
		`/index.php/${path}/api/v1/contexts/${contextId}`,
	);
	expect(res.ok(), `GET context ${res.status()}`).toBeTruthy();
	return res.json();
}

/**
 * Subscribe to the next journal-settings save of this context (the Vue
 * form tunnels PUT as POST — match the URL, accept both verbs). Call
 * BEFORE clicking Save; assert the status on the awaited response.
 */
function nextContextSave(page, contextId) {
	return page.waitForResponse(
		(r) =>
			r.url().includes(`/api/v1/contexts/${contextId}`) &&
			['PUT', 'POST'].includes(r.request().method()),
	);
}

/** A fresh anonymous browser context (explicit empty storage state). */
async function newAnonContext(browser, baseURL) {
	return browser.newContext({baseURL, storageState: {cookies: [], origins: []}});
}

test.use({user: MANAGER});

test.describe('Journal masthead & identity settings — forms + public surfacing', () => {
	// ── Scenario 1 — Rebrand the journal and see every surface follow ─────────
	// The manager edits the REAL Masthead form: title (en + fr via the form's
	// locale toggle), initials, abbreviation, country, publisher + URL, both
	// ISSNs, summary, about and editorial history — one Save, one PUT. The
	// journal header/<title>, site-index entry (title + summary), /about body,
	// /about/editorialHistory tail and OAI Identify repositoryName all show the
	// new values, in the viewer's locale (fr_CA pages carry the French
	// title/about). Bad values are refused with the exact field errors —
	// invalid ISSN, invalid publisher URL, empty primary-locale title — while
	// an empty FRENCH title saves fine (required bites the primary locale only,
	// rule 2), and no rejected value sticks.
	test(
		'masthead rebrand: header, site index, about, history and OAI follow; bad values refused per locale rules',
		{tag: '@smoke'},
		async ({page, pkpApi, browser, baseURL}) => {
			test.slow();
			const tag = uniqueTag();
			const ctx = await seedJournal(
				pkpApi,
				tag,
				[{username: MANAGER, roles: ['manager']}],
				{primaryLocale: 'en', supportedLocales: ['en', 'fr_CA']},
			);

			const nameEn = `Renamed Journal ${tag}`;
			const nameFr = `Journal Renomme ${tag}`;
			const summary = `Summary text ${tag}`;
			const aboutEn = `About body en ${tag}`;
			const aboutFr = `A propos fr ${tag}`;
			const history = `Editorial past ${tag}`;
			const publisher = `Publisher House ${tag}`;
			const publisherUrl = `https://publisher.example.com/${tag}`;

			// The Masthead tab is the settings page's default-active tab.
			await page.goto(`/index.php/${ctx.path}/management/settings/context`);
			const panel = page.locator('#masthead');
			await expect(panel.locator('#masthead-name-control-en')).toBeVisible();

			// Identity + publishing details (control ids: {formId}-{field}-control[-locale]).
			await panel.locator('#masthead-name-control-en').fill(nameEn);
			await panel.locator('#masthead-acronym-control-en').fill(`AC${tag}`);
			await panel.locator('#masthead-abbreviation-control-en').fill(`J Rn ${tag}`);
			await panel.locator('#masthead-country-control').selectOption('IS');
			await panel.locator('#masthead-publisherInstitution-control').fill(publisher);
			await panel.locator('#masthead-publisherUrl-control').fill(publisherUrl);
			await panel.locator('#masthead-onlineIssn-control').fill('0378-5955');
			await panel.locator('#masthead-printIssn-control').fill('2049-3630');

			// The three rich-text fields (TinyMCE mounts per locale column).
			await setTinyMceContent(page, 'masthead-editorialHistory-control-en', `<p>${history}</p>`);
			await setTinyMceContent(page, 'masthead-description-control-en', `<p>${summary}</p>`);
			await setTinyMceContent(page, 'masthead-about-control-en', `<p>${aboutEn}</p>`);

			// French: toggle the form's fr_CA column (the one additional-locale
			// button of the FormLocales switcher), then fill title + about.
			await panel.locator('button.pkpFormLocales__locale').click();
			await panel.locator('#masthead-name-control-fr_CA').fill(nameFr);
			await setTinyMceContent(page, 'masthead-about-control-fr_CA', `<p>${aboutFr}</p>`);

			// ONE Save → ONE PUT; the response echoes the new values (rule 2).
			const savePromise = nextContextSave(page, ctx.id);
			await panel.getByRole('button', {name: 'Save', exact: true}).click();
			const saveRes = await savePromise;
			expect(saveRes.status()).toBe(200);
			const echoed = await saveRes.json();
			expect(echoed.name.en).toBe(nameEn);
			expect(echoed.name.fr_CA).toBe(nameFr);
			expect(echoed.acronym.en).toBe(`AC${tag}`);
			expect(echoed.abbreviation.en).toBe(`J Rn ${tag}`);
			expect(echoed.country).toBe('IS');
			expect(echoed.publisherInstitution).toBe(publisher);
			expect(echoed.publisherUrl).toBe(publisherUrl);
			expect(echoed.onlineIssn).toBe('0378-5955');
			expect(echoed.printIssn).toBe('2049-3630');

			// Validation, on the same endpoint the form saves to (rule 3): the
			// exact server messages, and nothing rejected sticks.
			const csrf = await csrfToken(page);
			const badIssn = await putContext(page.request, ctx.path, ctx.id, {onlineIssn: '1234-5678'}, csrf);
			expect(badIssn.status()).toBe(400);
			expect(await badIssn.text()).toContain('This is not a valid ISSN.');
			const badUrl = await putContext(page.request, ctx.path, ctx.id, {publisherUrl: 'not-a-url'}, csrf);
			expect(badUrl.status()).toBe(400);
			expect(await badUrl.text()).toContain('This is not a valid URL.');
			// Empty title in the PRIMARY locale → refused…
			const emptyEn = await putContext(page.request, ctx.path, ctx.id, {name: {en: '', fr_CA: nameFr}}, csrf);
			expect(emptyEn.status()).toBe(400);
			expect(await emptyEn.text()).toContain('You must complete this field in English.');
			// …while an empty SECONDARY-locale title saves fine (rule 2).
			const emptyFr = await putContext(page.request, ctx.path, ctx.id, {name: {en: nameEn, fr_CA: ''}}, csrf);
			expect(emptyFr.status(), await emptyFr.text()).toBe(200);
			const restoreFr = await putContext(page.request, ctx.path, ctx.id, {name: {en: nameEn, fr_CA: nameFr}}, csrf);
			expect(restoreFr.status()).toBe(200);
			const current = await getContext(page.request, ctx.path, ctx.id);
			expect(current.onlineIssn).toBe('0378-5955');
			expect(current.publisherUrl).toBe(publisherUrl);
			expect(current.name.en).toBe(nameEn);

			// Public surfacing, anonymously (multi-locale journal → locale-prefixed
			// reader URLs).
			const anon = await newAnonContext(browser, baseURL);
			const pub = await anon.newPage();
			// The journal header + page <title> carry the new name (rule 4).
			await pub.goto(`/index.php/${ctx.path}/en`);
			await expect(pub).toHaveTitle(new RegExp(nameEn));
			await expect(pub.getByText(nameEn).first()).toBeVisible();
			// The site index lists the new title AND the summary (rule 4).
			await pub.goto('/index.php/index');
			await expect(pub.getByText(nameEn).first()).toBeVisible();
			await expect(pub.getByText(summary)).toBeVisible();
			// /about renders the About text (rule 4).
			await pub.goto(`/index.php/${ctx.path}/en/about`);
			await expect(
				pub.getByRole('heading', {level: 1, name: 'About the Journal'}),
			).toBeVisible();
			await expect(pub.locator('.page_about')).toContainText(aboutEn);
			// The FRENCH pages render the French title/about (rule 2).
			await pub.goto(`/index.php/${ctx.path}/fr_CA/about`);
			await expect(pub.locator('.page_about')).toContainText(aboutFr);
			await expect(pub).toHaveTitle(new RegExp(nameFr));
			// The Editorial History text closes /about/editorialHistory (rule 4).
			await pub.goto(`/index.php/${ctx.path}/en/about/editorialHistory`);
			await expect(pub.locator('.page_masthead')).toContainText(history);
			// OAI Identify's repository name follows the title (rule 4).
			const oai = await anon.request.get(`/index.php/${ctx.path}/oai?verb=Identify`);
			expect(await oai.text()).toContain(`<repositoryName>${nameEn}</repositoryName>`);
			await anon.close();
		},
	);

	// ── Scenario 2 — Point readers at the right people ─────────────────────────
	// The manager fills the Contact tab (principal name/email/phone/affiliation,
	// mailing address, support contact) and saves — one PUT. /about/contact
	// renders the mailing address and both contact blocks with the emails
	// JavaScript-obfuscated in the page SOURCE; the OAI adminEmail follows the
	// principal email (rules 4+5). A malformed principal email is refused by
	// the REAL form with the inline field error; clearing the principal name is
	// refused by the endpoint — neither refusal sticks.
	test(
		'contact settings fill /about/contact and the OAI adminEmail; bad name/email refused',
		{tag: '@smoke'},
		async ({page, pkpApi, browser, baseURL}) => {
			test.slow();
			const tag = uniqueTag();
			const ctx = await seedJournal(pkpApi, tag, [
				{username: MANAGER, roles: ['manager']},
			]);
			const c = {
				name: `Principal Person ${tag}`,
				email: `principal${tag}@example.test`,
				phone: '+1-555-0100',
				affiliation: `Contact University ${tag}`,
				mailing: `123 Reader Way ${tag}`,
				supportName: `Support Person ${tag}`,
				supportEmail: `support${tag}@example.test`,
				supportPhone: '+1-555-0199',
			};

			await page.goto(`/index.php/${ctx.path}/management/settings/context`);
			await page.locator('#contact-button').click();
			const panel = page.locator('#contact');
			await expect(panel.locator('#contact-contactName-control')).toBeVisible();
			await panel.locator('#contact-contactName-control').fill(c.name);
			await panel.locator('#contact-contactEmail-control').fill(c.email);
			await panel.locator('#contact-contactPhone-control').fill(c.phone);
			await panel.locator('#contact-contactAffiliation-control-en').fill(c.affiliation);
			await panel.locator('#contact-mailingAddress-control').fill(c.mailing);
			await panel.locator('#contact-supportName-control').fill(c.supportName);
			await panel.locator('#contact-supportEmail-control').fill(c.supportEmail);
			await panel.locator('#contact-supportPhone-control').fill(c.supportPhone);

			const savePromise = nextContextSave(page, ctx.id);
			await panel.getByRole('button', {name: 'Save', exact: true}).click();
			const saveRes = await savePromise;
			expect(saveRes.status()).toBe(200);
			const echoed = await saveRes.json();
			expect(echoed.contactName).toBe(c.name);
			expect(echoed.contactEmail).toBe(c.email);
			expect(echoed.supportName).toBe(c.supportName);

			// A malformed principal email is refused BY THE FORM: the save 400s
			// and the server's field error renders inline (rule 3).
			await panel.locator('#contact-contactEmail-control').fill('not-an-email');
			const badPromise = nextContextSave(page, ctx.id);
			await panel.getByRole('button', {name: 'Save', exact: true}).click();
			expect((await badPromise).status()).toBe(400);
			// The inline field error (exact match — the form ALSO renders an
			// error-summary jump button "Go to Email: …" with the same text).
			await expect(
				panel.getByText('This is not a valid email address.', {exact: true}),
			).toBeVisible();

			// Clearing the principal name is refused by the endpoint (rule 3);
			// neither refusal touched the stored values.
			const csrf = await csrfToken(page);
			const emptyName = await putContext(page.request, ctx.path, ctx.id, {contactName: ''}, csrf);
			expect(emptyName.status()).toBe(400);
			expect(await emptyName.text()).toContain('This field is required.');
			const current = await getContext(page.request, ctx.path, ctx.id);
			expect(current.contactName).toBe(c.name);
			expect(current.contactEmail).toBe(c.email);

			// /about/contact is the contact settings, block by block (rule 5) —
			// read anonymously (single-locale scratch journal → bare path).
			const anon = await newAnonContext(browser, baseURL);
			const pub = await anon.newPage();
			await pub.goto(`/index.php/${ctx.path}/about/contact`);
			await expect(pub.getByRole('heading', {level: 1, name: 'Contact'})).toBeVisible();
			await expect(pub.locator('.address')).toContainText(c.mailing);
			const primary = pub.locator('.contact.primary');
			await expect(primary.getByRole('heading', {name: 'Principal Contact'})).toBeVisible();
			await expect(primary.locator('.name')).toContainText(c.name);
			await expect(primary.locator('.affiliation')).toContainText(c.affiliation);
			await expect(primary.locator('.phone')).toContainText(c.phone);
			const support = pub.locator('.contact.support');
			await expect(support.getByRole('heading', {name: 'Support Contact'})).toBeVisible();
			await expect(support.locator('.name')).toContainText(c.supportName);
			await expect(support.locator('.phone')).toContainText(c.supportPhone);

			// Both emails are JavaScript-obfuscated against scraping: the raw
			// SOURCE carries a document.write, never the plain address (rule 5).
			const src = await (
				await anon.request.get(`/index.php/${ctx.path}/about/contact`)
			).text();
			expect(src).toContain('document.write');
			expect(src).not.toContain(c.email);
			expect(src).not.toContain(c.supportEmail);

			// The principal email doubles as the OAI admin email (rule 4).
			const oai = await anon.request.get(`/index.php/${ctx.path}/oai?verb=Identify`);
			expect(await oai.text()).toContain(`<adminEmail>${c.email}</adminEmail>`);
			await anon.close();
		},
	);

	// ── Scenario 3 — Publish, then retire, the privacy statement and blurbs ────
	// The manager sets a custom Privacy Statement on Settings → Website → Setup
	// (real form): it renders on /about/privacy, backs the registration-consent
	// checkbox and the /about/submissions section. CLEARING it removes all
	// three — the privacy page turns 404 (rule 6). A custom For-Readers blurb
	// (real Information form) feeds /information/readers and its sidebar
	// Information-block link; clearing the blurb drops ITS link while the page
	// stays reachable (empty), and clearing all three blurbs removes the whole
	// block (rule 7 — contrast with the privacy 404, Open question 2).
	test(
		'privacy statement and information blurbs gate their pages, references and sidebar links',
		{tag: '@regression'},
		async ({page, pkpApi, browser, baseURL}) => {
			test.slow();
			const tag = uniqueTag();
			// The Information block plugin ships enabled; sidebar PLACEMENT is
			// seeded so the block renders (placement owned by
			// website-appearance-settings).
			const ctx = await seedJournal(
				pkpApi,
				tag,
				[{username: MANAGER, roles: ['manager']}],
				{sidebar: ['informationblockplugin']},
			);
			const privacyText = `Custom privacy ${tag}`;
			const readerText = `Reader info ${tag}`;

			// Real Privacy form: Settings → Website → Setup → Privacy Statement.
			await page.goto(`/index.php/${ctx.path}/management/settings/website`);
			await page.locator('#setup-button').click();
			await page.locator('#privacy-button').click();
			const privacyPanel = page.locator('#privacy');
			await setTinyMceContent(page, 'privacy-privacyStatement-control-en', `<p>${privacyText}</p>`);
			const savePrivacy = nextContextSave(page, ctx.id);
			await privacyPanel.getByRole('button', {name: 'Save', exact: true}).click();
			expect((await savePrivacy).status()).toBe(200);

			// Real Information form: a custom For-Readers blurb.
			await page.locator('#information-button').click();
			const infoPanel = page.locator('#information');
			await setTinyMceContent(page, 'information-readerInformation-control-en', `<p>${readerText}</p>`);
			const saveInfo = nextContextSave(page, ctx.id);
			await infoPanel.getByRole('button', {name: 'Save', exact: true}).click();
			expect((await saveInfo).status()).toBe(200);

			// While SET: all three privacy surfaces + the reader page/sidebar link.
			const anon = await newAnonContext(browser, baseURL);
			const pub = await anon.newPage();
			await pub.goto(`/index.php/${ctx.path}/about/privacy`);
			await expect(
				pub.getByRole('heading', {level: 1, name: 'Privacy Statement'}),
			).toBeVisible();
			await expect(pub.locator('.page_privacy')).toContainText(privacyText);
			await pub.goto(`/index.php/${ctx.path}/user/register`);
			await expect(pub.locator('input[name="privacyConsent"]')).toBeVisible();
			await pub.goto(`/index.php/${ctx.path}/about/submissions`);
			await expect(pub.locator('#privacyStatement')).toContainText(privacyText);
			await pub.goto(`/index.php/${ctx.path}/information/readers`);
			await expect(
				pub.getByRole('heading', {level: 1, name: 'Information For Readers'}),
			).toBeVisible();
			await expect(pub.locator('.page_information .description')).toContainText(readerText);
			// Sidebar: one link per non-empty blurb (stock texts fill the others).
			await pub.goto(`/index.php/${ctx.path}`);
			const block = pub.locator('.block_information');
			await expect(block.getByRole('link', {name: 'For Readers'})).toBeVisible();
			await expect(block.getByRole('link', {name: 'For Authors'})).toBeVisible();
			await expect(block.getByRole('link', {name: 'For Librarians'})).toBeVisible();

			// CLEAR the privacy statement (all locales — en is the only one),
			// through the same journal-settings endpoint the form saves to.
			const csrf = await csrfToken(page);
			const clearPrivacy = await putContext(page.request, ctx.path, ctx.id, {privacyStatement: {en: ''}}, csrf);
			expect(clearPrivacy.status(), await clearPrivacy.text()).toBe(200);
			// The privacy page is NOT FOUND (rule 6)…
			const gone = await anon.request.get(`/index.php/${ctx.path}/about/privacy`);
			expect(gone.status()).toBe(404);
			// …the registration consent is gone (the form itself remains)…
			await pub.goto(`/index.php/${ctx.path}/user/register`);
			await expect(pub.locator('form#register')).toBeVisible();
			await expect(pub.locator('input[name="privacyConsent"]')).toHaveCount(0);
			// …and the /about/submissions section disappeared.
			await pub.goto(`/index.php/${ctx.path}/about/submissions`);
			await expect(
				pub.getByRole('heading', {level: 1, name: 'Submissions'}),
			).toBeVisible();
			await expect(pub.locator('#privacyStatement')).toHaveCount(0);

			// Clearing ONE blurb drops ITS sidebar link; the page STAYS reachable,
			// rendering only its heading (rule 7 — no 404, unlike privacy).
			const clearReader = await putContext(page.request, ctx.path, ctx.id, {readerInformation: {en: ''}}, csrf);
			expect(clearReader.status()).toBe(200);
			await pub.goto(`/index.php/${ctx.path}`);
			await expect(block).toBeVisible();
			await expect(block.getByRole('link', {name: 'For Readers'})).toHaveCount(0);
			await expect(block.getByRole('link', {name: 'For Authors'})).toBeVisible();
			await pub.goto(`/index.php/${ctx.path}/information/readers`);
			await expect(
				pub.getByRole('heading', {level: 1, name: 'Information For Readers'}),
			).toBeVisible();
			await expect(pub.locator('.page_information')).not.toContainText(readerText);

			// Clearing ALL THREE blurbs removes the whole Information block.
			const clearRest = await putContext(
				page.request,
				ctx.path,
				ctx.id,
				{authorInformation: {en: ''}, librarianInformation: {en: ''}},
				csrf,
			);
			expect(clearRest.status()).toBe(200);
			await pub.goto(`/index.php/${ctx.path}`);
			await expect(pub.locator('.block_information')).toHaveCount(0);
			await anon.close();
		},
	);

	// ── Scenario 4 — Only settings-managers get in ─────────────────────────────
	// The manager and the site admin get the four-tab Settings → Journal page;
	// a section editor, author, reviewer and assistant are refused on the page
	// AND the save endpoint (401, value unchanged) and carry no Settings nav
	// entry. Stripping Permit settings from the scratch journal's manager
	// group (the roles-grid handler, as admin — the toggle itself is
	// roles-permissions') locks the manager out of page + endpoint and drops
	// his Settings menu on THAT journal, while his access on publicknowledge
	// is untouched (rule 8; read-only probe).
	test(
		'settings gate: manager+admin in, other roles refused both ways, permitSettings strips per journal',
		{tag: '@regression'},
		async ({page, pkpApi, asUser}) => {
			test.slow();
			const tag = uniqueTag();
			const name = `Gatekept Journal ${tag}`;
			const ctx = await seedJournal(
				pkpApi,
				tag,
				[
					{username: MANAGER, roles: ['manager']},
					{username: 'dbuskins', roles: ['sectionEditor']},
					{username: 'atester', roles: ['author']},
					{username: 'jjanssen', roles: ['reviewer']},
					{username: 'mfritz', roles: ['copyeditor']},
				],
				{name: {en: name}},
			);

			// The manager gets the four-tab page (rule 1) and a Settings nav entry.
			await page.goto(`/index.php/${ctx.path}/management/settings/context`);
			for (const tab of ['Masthead', 'Contact', 'Sections', 'Categories']) {
				await expect(page.getByRole('tab', {name: tab, exact: true})).toBeVisible();
			}
			await expect(
				page.locator('nav#app-nav').getByText('Settings', {exact: true}),
			).toBeVisible();
			const mgrCsrf = await csrfToken(page);

			// The site admin gets the page too.
			const adminCtx = await asUser('admin');
			const adminRes = await adminCtx.request.get(
				`/index.php/${ctx.path}/management/settings/context`,
			);
			expect(adminRes.status()).toBe(200);
			expect(adminRes.url()).not.toMatch(/authorizationDenied/);

			// Section editor: page denied, no Settings nav entry, PUT refused.
			const seCtx = await asUser('dbuskins');
			const sePage = await seCtx.newPage();
			await sePage.goto(`/index.php/${ctx.path}/management/settings/context`);
			await expect(sePage).toHaveURL(/authorizationDenied/);
			await sePage.goto(`/index.php/${ctx.path}/dashboard/editorial`);
			const seNav = sePage.locator('nav#app-nav');
			await expect(seNav.getByText('Statistics', {exact: true})).toBeVisible();
			await expect(seNav.getByText('Settings', {exact: true})).toHaveCount(0);
			const sePut = await putContext(
				seCtx.request,
				ctx.path,
				ctx.id,
				{name: {en: `Hijacked-se ${tag}`}},
				await csrfFor(seCtx),
			);
			expect(sePut.status(), 'section editor PUT refused').toBe(401);

			// Author, reviewer and assistant: page + PUT refused likewise.
			for (const username of ['atester', 'jjanssen', 'mfritz']) {
				const uCtx = await asUser(username);
				const pageRes = await uCtx.request.get(
					`/index.php/${ctx.path}/management/settings/context`,
				);
				expect(pageRes.url(), `${username} bounced off the page`).toMatch(
					/authorizationDenied/,
				);
				const put = await putContext(
					uCtx.request,
					ctx.path,
					ctx.id,
					{name: {en: `Hijacked-${username} ${tag}`}},
					await csrfFor(uCtx),
				);
				expect(put.status(), `${username} PUT refused`).toBe(401);
			}
			// No refused write stuck.
			let current = await getContext(adminCtx.request, ctx.path, ctx.id);
			expect(current.name.en).toBe(name);

			// Strip Permit settings from the scratch journal's default manager
			// group (as admin, through the roles-grid handler the Roles UI
			// drives; omitting the checkbox saves it off).
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

			// The manager is now locked out of THIS journal's page AND endpoint…
			await page.goto(`/index.php/${ctx.path}/management/settings/context`);
			await expect(page).toHaveURL(/authorizationDenied/);
			const mgrPut = await putContext(
				page.request,
				ctx.path,
				ctx.id,
				{name: {en: `Hijacked-mgr ${tag}`}},
				mgrCsrf,
			);
			expect(mgrPut.status(), 'stripped manager PUT refused').toBe(401);
			current = await getContext(adminCtx.request, ctx.path, ctx.id);
			expect(current.name.en, 'value unchanged by the refusal').toBe(name);
			// …his Settings menu is gone here…
			await page.goto(`/index.php/${ctx.path}/dashboard/editorial`);
			const mgrNav = page.locator('nav#app-nav');
			await expect(mgrNav.getByText('Statistics', {exact: true})).toBeVisible();
			await expect(mgrNav.getByText('Settings', {exact: true})).toHaveCount(0);
			// …while his access on ANOTHER journal is untouched (read-only probe
			// on publicknowledge — never mutated).
			const pkRes = await page.request.get(
				'/index.php/publicknowledge/management/settings/context',
			);
			expect(pkRes.status()).toBe(200);
			expect(pkRes.url()).not.toMatch(/authorizationDenied/);
		},
	);
});
