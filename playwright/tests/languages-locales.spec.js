// @ts-check
const {test, expect} = require('../support/fixtures.js');
const {LoginPage} = require('../../lib/pkp/playwright/pages/LoginPage.js');
const {
	WebsiteSettingsPage,
} = require('../../lib/pkp/playwright/pages/WebsiteSettingsPage.js');
const {
	waitForJQueryIdle,
} = require('../../lib/pkp/playwright/support/jquery.js');

/**
 * Languages & locales — the three-level multilingual switchboard: the
 * journal's Website/Submission Languages grids (Settings → Website →
 * Setup → Languages), the site admin's installed-locale pool
 * (Administration → Site Settings → Site Setup → Languages), and the
 * reader/staff language switchers (sidebar Language block + backend
 * user-menu). One test per canonical scenario of
 * docs/product/specs/languages-locales.md (7 scenarios → 7 tests, 1:1).
 *
 * PARALLEL + ISOLATION (hard rules of this campaign):
 *   - EVERY mutation runs on a per-test scratch journal (unique
 *     hyphenless `loct…` path). publicknowledge's locale settings
 *     (en+fr_CA) are load-bearing for the whole multilingual suite and
 *     are NEVER touched.
 *   - NO shared seeded user is enrolled into any new role. dbarnes acts
 *     only as manager of the tests' own scratch journals; extra actors
 *     (author, second manager) are DEDICATED THROWAWAY users
 *     (password = username+username, seeder-created).
 *   - NO site-level locale is installed/uninstalled/disabled and the
 *     site primary is never touched: scenario 7 is READ-MOSTLY (grid
 *     renders, Install-Locale modal opened and closed unsaved).
 *   - Locale switches are session-scoped: the frontend/back-end switch
 *     flows run in fresh disposable contexts (never the shared cached
 *     dbarnes storage state — its server-side session is shared across
 *     workers, so flipping ITS locale would leak French UI elsewhere).
 *   - No toast assertions (trivial-notification queue is shared
 *     per-user across workers) — save outcomes are asserted on the op
 *     response JSON + the contexts API + grid state after reload.
 *
 * KNOWN LEDGER ROWS asserted AS-BUILT:
 *   - ⚠ Row 145 (test 6): the sidebar block's setLocale link builds its
 *     `source` from SERVER_NAME (port lost on php -S :8000), so the
 *     redirect falls back to the SITE INDEX (/index/fr_CA) — while the
 *     locale still switches (cookie + session). The backend user-menu
 *     switch passes the full document.URL and returns to the exact page.
 *   - Row 146 (manager-invokable reloadLocale) is a Known deviation, not
 *     a canonical scenario — not probed here.
 *   - Row 37 (##common.help##) — not asserted.
 *
 * SPEC NOTE (scenario 4, last leg): the spec narrates flipping the
 * Default submission radio to *German* (continuing its scenario-3
 * journal). Here each test is hermetic: the flip is exercised on the
 * scratch roster's fr_CA row — the identical grid op
 * (setDefaultSubmissionLocale) incl. the auto-re-enable cascade; the
 * any-language (German) roster behavior itself is test 3's job.
 *
 * AUTH: test.use dbarnes — manager of every scratch journal here.
 * Reader checks use explicit empty-storage anonymous contexts.
 */

const MANAGER = 'dbarnes';

test.use({user: MANAGER});

/** Unique hyphenless alphanumeric tag; doubles as the scratch urlPath. */
function uniqueTag(prefix = 'loct') {
	const workerLetter = String.fromCharCode(
		97 + (test.info().parallelIndex % 26),
	);
	let suffix = '';
	while (suffix.length < 6) {
		suffix += Math.random().toString(36).replace(/[^a-z0-9]/g, '');
	}
	return `${prefix}${workerLetter}${suffix.slice(0, 6)}`;
}

/** Reader/backend base path for a scratch journal. */
function base(journalPath) {
	return `/index.php/${journalPath}`;
}

/**
 * Seed a scratch journal (dbarnes as manager + passthrough) → context.
 * Defaults to a SINGLE-locale (en) journal; pass supportedLocales to get
 * en+fr_CA (the seeder mirrors it onto all four category lists).
 */
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
async function newAnonContext(browser, baseURL, extra = {}) {
	return browser.newContext({
		baseURL,
		storageState: {cookies: [], origins: []},
		...extra,
	});
}

/** Read the session CSRF token from a loaded backend page. */
async function csrfToken(page) {
	await page.waitForFunction(
		() =>
			// @ts-ignore pkp global
			!!window.pkp?.currentUser?.csrfToken ||
			!!document.querySelector('meta[name="csrf-token"]'),
		null,
		{timeout: 15_000},
	);
	return page.evaluate(
		() =>
			// @ts-ignore pkp global
			window.pkp?.currentUser?.csrfToken ||
			document
				.querySelector('meta[name="csrf-token"]')
				?.getAttribute('content'),
	);
}

/** GET the journal's settings JSON through the manager session. */
async function getContext(requestCtx, path, contextId) {
	const res = await requestCtx.get(
		`${base(path)}/api/v1/contexts/${contextId}`,
	);
	expect(res.ok(), `GET context ${res.status()}`).toBeTruthy();
	return res.json();
}

/**
 * Open Settings → Website → Setup → Languages and wait for BOTH legacy
 * grids (Website Languages + Submission Languages) to arrive.
 */
async function openLanguagesTab(page, journalPath) {
	await page.goto(`${base(journalPath)}/management/settings/website`);
	await page.locator('#setup-button').click();
	await openLanguagesSideTab(page);
}

/** Click the Languages side tab (outer Setup tab already active). */
async function openLanguagesSideTab(page) {
	await page.locator('#languages-button').click();
	await expect(
		page.locator('#languageGridContainer input[id^="select-cell-"]').first(),
	).toBeVisible({timeout: 20_000});
	await expect(
		page
			.locator('#submissionLanguageGridContainer input[id^="select-cell-"]')
			.first(),
	).toBeVisible({timeout: 20_000});
	await waitForJQueryIdle(page);
}

/**
 * A grid cell's checkbox/radio input. Cell ids are
 * `select-cell-{locale}-{columnId}[uniqid]` (selectStatusCell.tpl /
 * radioButtonCell.tpl), so a prefix match pins locale + column.
 */
function cellInput(page, containerId, locale, column) {
	return page.locator(
		`#${containerId} input[id^="select-cell-${locale}-${column}"]`,
	);
}

/** Column id → the grid op its baked AjaxAction URL hits. */
const CELL_OP = {
	uiLocale: 'save-language-setting',
	formLocale: 'save-language-setting',
	submissionLocale: 'save-language-setting',
	submissionMetadataLocale: 'save-language-setting',
	contextPrimary: 'set-context-primary-locale',
	defaultSubmissionLocale: 'set-default-submission-locale',
};

function cellResponsePredicate(locale, column) {
	return (r) =>
		r.url().includes(CELL_OP[column]) && r.url().includes(`rowId=${locale}`);
}

/**
 * Click a language-grid cell and wait for its op to succeed (the grid
 * then refreshes itself through a dataChanged event). Returns the op's
 * JSON body.
 */
async function saveCell(page, containerId, locale, column) {
	const [res] = await Promise.all([
		page.waitForResponse(cellResponsePredicate(locale, column), {
			timeout: 20_000,
		}),
		cellInput(page, containerId, locale, column).click(),
	]);
	expect(res.status()).toBe(200);
	const body = await res.json();
	expect(body.status, `grid op accepted (${column} ${locale})`).toBe(true);
	await waitForJQueryIdle(page);
	return body;
}

/**
 * Click a language-grid cell EXPECTING the server's refusal: JSON
 * status:false whose message surfaces as a native browser alert
 * (legacy-grid-wide pattern). Returns the alert message.
 */
async function refuseCell(page, containerId, locale, column) {
	const dialogPromise = page.waitForEvent('dialog', {timeout: 20_000});
	const responsePromise = page.waitForResponse(
		cellResponsePredicate(locale, column),
		{timeout: 20_000},
	);
	await cellInput(page, containerId, locale, column).click();
	const dialog = await dialogPromise;
	const message = dialog.message();
	await dialog.accept();
	const body = await (await responsePromise).json();
	expect(body.status, 'grid op refused').toBe(false);
	await waitForJQueryIdle(page);
	return message;
}

/**
 * Authenticate a THROWAWAY user through the real sign-in form post,
 * scoped to their own journal (API-only probes; no page needed). The
 * form's session CSRF token is scraped first — signIn validates it —
 * and the POST goes to the LOCALE-PREFIXED action (on a multi-locale
 * journal the bare /login/signIn URL only answers with the locale
 * redirect, silently dropping the POST).
 */
async function formPostLogin(browser, baseURL, journalPath, username) {
	const ctx = await newAnonContext(browser, baseURL);
	const loginRes = await ctx.request.get(`${base(journalPath)}/en/login`);
	const m = (await loginRes.text()).match(/name="csrfToken" value="([^"]+)"/);
	if (!m) throw new Error(`login csrfToken not found (${loginRes.url()})`);
	const res = await ctx.request.post(
		`${base(journalPath)}/en/login/signIn`,
		{
			form: {
				csrfToken: m[1],
				username,
				password: `${username}${username}`,
				source: '',
				remember: '',
			},
			maxRedirects: 0,
		},
	);
	expect(res.status(), `throwaway ${username} signs in`).toBe(302);
	return ctx;
}

test.describe('Languages & locales', () => {
	// ── Scenario 1 — Manager turns a reader language off and on ────────────
	// On an en+fr_CA scratch journal (Language block placed): the reader
	// site starts bilingual (302 onto /en, block lists "français").
	// Unchecking French "UI" (Website Languages grid, roster = the two
	// site-enabled locales) keeps Forms untouched, removes the block,
	// drops the URL locale segment and 302s stale /fr_CA/ URLs to the
	// plain form; re-checking restores block and segment. An enrolled
	// author is refused on the Languages page AND the raw grid URL.
	test(
		'UI toggle: language block and URL segments follow off/on; forms untouched; author refused',
		{tag: ['@smoke', '@regression']},
		async ({page, pkpApi, browser, baseURL}) => {
			test.slow();
			const tag = uniqueTag();
			const authorUser = `au${tag}`;
			const ctx = await seedJournal(pkpApi, tag, {
				supportedLocales: ['en', 'fr_CA'],
				sidebar: ['languagetoggleblockplugin'],
				users: [
					{
						username: authorUser,
						password: authorUser + authorUser,
						roles: ['author'],
					},
				],
			});

			const anon = await newAnonContext(browser, baseURL);
			try {
				// Bilingual baseline: bare URL 302s onto the /en segment
				// (rule 8) and the sidebar block lists French (rule 10).
				const redir = await anon.request.get(base(ctx.path), {
					maxRedirects: 0,
				});
				expect(redir.status()).toBe(302);
				expect(redir.headers()['location']).toContain(`/${ctx.path}/en`);
				const pub = await anon.newPage();
				await pub.goto(`${base(ctx.path)}/en`);
				const block = pub.locator('.block_language');
				await expect(block).toBeVisible();
				await expect(
					block.locator('li.locale_fr_CA a', {hasText: 'français'}),
				).toBeVisible();

				// The Website Languages roster = the two site-enabled
				// locales, one UI checkbox each (rule 2).
				await openLanguagesTab(page, ctx.path);
				await expect(
					page.locator(
						'#languageGridContainer input[id*="-uiLocale"]',
					),
				).toHaveCount(2);

				// Uncheck French "UI" — accepted; Forms stays on (rule 1).
				await saveCell(page, 'languageGridContainer', 'fr_CA', 'uiLocale');
				let stored = await getContext(page.request, ctx.path, ctx.id);
				expect(stored.supportedLocales).toEqual(['en']);
				expect(stored.supportedFormLocales).toContain('fr_CA');

				// Reader side: no more locale segment (bare URL serves
				// directly), stale locale-prefixed URLs 302 to the plain
				// form, and the block hides itself (rules 8 + 10).
				expect(
					(
						await anon.request.get(base(ctx.path), {maxRedirects: 0})
					).status(),
				).toBe(200);
				const stale = await anon.request.get(
					`${base(ctx.path)}/fr_CA/about`,
					{maxRedirects: 0},
				);
				expect(stale.status()).toBe(302);
				expect(stale.headers()['location']).not.toContain('fr_CA');
				const staleEn = await anon.request.get(
					`${base(ctx.path)}/en/about`,
					{maxRedirects: 0},
				);
				expect(staleEn.status()).toBe(302);
				expect(staleEn.headers()['location']).not.toContain('/en/');
				await pub.goto(base(ctx.path));
				await expect(pub.locator('.block_language')).toHaveCount(0);

				// Re-check French "UI": segment and block come back.
				await saveCell(page, 'languageGridContainer', 'fr_CA', 'uiLocale');
				stored = await getContext(page.request, ctx.path, ctx.id);
				expect(stored.supportedLocales).toEqual(['en', 'fr_CA']);
				const back = await anon.request.get(base(ctx.path), {
					maxRedirects: 0,
				});
				expect(back.status()).toBe(302);
				await pub.goto(`${base(ctx.path)}/en`);
				await expect(pub.locator('.block_language')).toBeVisible();
			} finally {
				await anon.close();
			}

			// The enrolled AUTHOR: Languages page refused, grid URL refused
			// ("role does not have access").
			const authorCtx = await formPostLogin(
				browser,
				baseURL,
				ctx.path,
				authorUser,
			);
			try {
				const pageRes = await authorCtx.request.get(
					`${base(ctx.path)}/management/settings/website`,
				);
				expect(pageRes.url()).toMatch(/authorizationDenied/);
				const gridRes = await authorCtx.request.get(
					`${base(ctx.path)}/$$$call$$$/grid/settings/languages/manage-language-grid/fetch-grid`,
				);
				const gridJson = await gridRes.json();
				expect(gridJson.status).toBe(false);
				expect(gridJson.content).toContain(
					'The current role does not have access to this operation.',
				);
			} finally {
				await authorCtx.close();
			}
		},
	);

	// ── Scenario 2 — Forms language drives form tabs, independent of UI ────
	// On an en-only scratch journal: the Information form has no locale
	// buttons. Checking French "Forms" (UI stays off) makes the French
	// entry button appear on the already-mounted form WITHOUT a reload
	// (set-form-languages global event) and writes fr_CA default journal
	// texts (rule 6); the reader site stays English-only. Unchecking
	// Forms strips the button live again.
	test(
		'forms toggle: French tab appears/vanishes live while UI stays off; default texts written',
		{tag: ['@smoke', '@regression']},
		async ({page, pkpApi, browser, baseURL}) => {
			test.slow();
			const tag = uniqueTag();
			const ctx = await seedJournal(pkpApi, tag); // en-only

			// Baseline: no fr_CA anywhere; the French default texts have
			// never been written.
			let stored = await getContext(page.request, ctx.path, ctx.id);
			expect(stored.supportedFormLocales).toEqual(['en']);
			expect(stored.authorGuidelines?.fr_CA ?? '').toBe('');

			// One page load for the whole test — the tab switches below are
			// client-side, which is what makes the "without a reload"
			// assertions meaningful.
			const website = new WebsiteSettingsPage(page, ctx.path);
			await website.goto();
			const infoPanel = await website.openSetupTab('information');
			const frButton = infoPanel.locator('button.pkpFormLocales__locale');
			await expect(frButton).toHaveCount(0); // single form locale → no toggle

			// Check French "Forms" in the grid (UI left unchecked).
			await openLanguagesSideTab(page);
			await expect(
				cellInput(page, 'languageGridContainer', 'fr_CA', 'formLocale'),
			).not.toBeChecked();
			await saveCell(page, 'languageGridContainer', 'fr_CA', 'formLocale');

			// The open Information form gained its French button live
			// (set-form-languages event — no page.goto() in between).
			await page.locator('#information-button').click();
			await expect(frButton).toBeVisible({timeout: 15_000});

			// Stored state: forms-only French (rule 1) + the French default
			// journal texts were written (rule 6).
			stored = await getContext(page.request, ctx.path, ctx.id);
			expect(stored.supportedFormLocales).toEqual(['en', 'fr_CA']);
			expect(stored.supportedLocales).toEqual(['en']);
			expect(stored.authorGuidelines?.fr_CA ?? '').toContain('Les auteur');

			// The reader site stays English-only: bare URL serves with no
			// locale segment (single UI locale).
			const anon = await newAnonContext(browser, baseURL);
			try {
				expect(
					(
						await anon.request.get(base(ctx.path), {maxRedirects: 0})
					).status(),
				).toBe(200);
			} finally {
				await anon.close();
			}

			// Uncheck French "Forms": the button vanishes from the open
			// form, again without a reload.
			await page.locator('#languages-button').click();
			await saveCell(page, 'languageGridContainer', 'fr_CA', 'formLocale');
			await page.locator('#information-button').click();
			await expect(frButton).toHaveCount(0);
			stored = await getContext(page.request, ctx.path, ctx.id);
			expect(stored.supportedFormLocales).toEqual(['en']);
		},
	);

	// ── Scenario 3 — Author submission-language gate & any-language roster ─
	// On an en-only scratch journal the wizard start form hides the
	// Submission Language field (single submission language). The manager
	// adds GERMAN — not installed anywhere on the site — through the
	// Add/Remove Languages modal (full ~800-entry registry); the new row
	// arrives unchecked; checking "Submissions" auto-checks "Metadata"
	// (rule 5); the author's wizard now offers the required
	// German/English choice (rule 14).
	test(
		'submission roster: registry add of German, Submissions→Metadata cascade, wizard gate',
		{tag: ['@smoke', '@regression']},
		async ({page, pkpApi, browser, baseURL}) => {
			test.slow();
			const tag = uniqueTag();
			const authorUser = `au${tag}`;
			const ctx = await seedJournal(pkpApi, tag, {
				users: [
					{
						username: authorUser,
						password: authorUser + authorUser,
						roles: ['author'],
					},
				],
			});

			// The author's wizard, BEFORE: single submission language → the
			// field is hidden entirely.
			const authorCtx = await newAnonContext(browser, baseURL);
			try {
				const authorPage = await authorCtx.newPage();
				const login = new LoginPage(authorPage);
				await login.login(authorUser, authorUser + authorUser, ctx.path);
				await authorPage.waitForURL((u) => !u.pathname.includes('/login'), {
					waitUntil: 'commit',
					timeout: 15_000,
				});
				await authorPage.goto(`${base(ctx.path)}/submission`);
				await expect(
					authorPage.getByRole('button', {name: 'Begin Submission'}),
				).toBeVisible({timeout: 20_000});
				await expect(
					authorPage.getByText('Submission Language'),
				).toHaveCount(0);

				// The manager opens Add/Remove Languages: the modal lists the
				// FULL language registry (not just installed locales), with
				// the current roster pre-checked.
				await openLanguagesTab(page, ctx.path);
				await page
					.locator(
						'#submissionLanguageGridContainer a[id*="-addLanguageModal-button-"]',
					)
					.click();
				const form = page.locator('form#addLanguageForm');
				await expect(form).toBeVisible({timeout: 20_000});
				expect(
					await form.locator('input[name^="localesToAdd"]').count(),
				).toBeGreaterThan(100);
				await expect(
					form.locator('input[name="localesToAdd[en]"]'),
				).toBeChecked();
				const deBox = form.locator('input[name="localesToAdd[de]"]');
				await expect(deBox).not.toBeChecked();
				await deBox.check();
				const [saveRes] = await Promise.all([
					page.waitForResponse((r) => r.url().includes('add-languages'), {
						timeout: 20_000,
					}),
					form.getByRole('button', {name: 'Save', exact: true}).click(),
				]);
				expect(saveRes.status()).toBe(200);
				await waitForJQueryIdle(page);

				// The German row appears with BOTH checkboxes unchecked
				// (rule 4: newly added entries arrive disabled).
				const deSub = cellInput(
					page,
					'submissionLanguageGridContainer',
					'de',
					'submissionLocale',
				);
				const deMeta = cellInput(
					page,
					'submissionLanguageGridContainer',
					'de',
					'submissionMetadataLocale',
				);
				await expect(deSub).toBeVisible({timeout: 20_000});
				await expect(deSub).not.toBeChecked();
				await expect(deMeta).not.toBeChecked();

				// Checking "Submissions" auto-checks "Metadata" (rule 5).
				await saveCell(
					page,
					'submissionLanguageGridContainer',
					'de',
					'submissionLocale',
				);
				await expect(deMeta).toBeChecked({timeout: 20_000});
				const stored = await getContext(page.request, ctx.path, ctx.id);
				expect(stored.supportedAddedSubmissionLocales).toContain('de');
				expect(stored.supportedSubmissionLocales).toContain('de');
				expect(stored.supportedSubmissionMetadataLocales).toContain('de');
				// …while the journal's UI/Forms lists never learned German.
				expect(stored.supportedLocales).toEqual(['en']);

				// The author's wizard, AFTER: the required German/English
				// radio choice appears.
				await authorPage.goto(`${base(ctx.path)}/submission`);
				await expect(
					authorPage.getByText('Submission Language'),
				).toBeVisible({timeout: 20_000});
				await expect(
					authorPage.getByRole('radio', {name: 'German'}),
				).toBeVisible();
				await expect(
					authorPage.getByRole('radio', {name: 'English'}),
				).toBeVisible();
			} finally {
				await authorCtx.close();
			}
		},
	);

	// ── Scenario 4 — Guard rails: defaults and primaries are immovable ─────
	// On an en+fr_CA scratch journal: unchecking UI on the primary row or
	// Submissions on the Default row is refused with the exact alert and
	// nothing is stored (checkbox is checked again after a reload);
	// unchecking Metadata on a non-default row silently drags Submissions
	// off with it; flipping the Default radio records the new default and
	// auto-re-enables that row's Submissions + Metadata. (The spec words
	// the flip against German — same op, exercised here on the hermetic
	// roster's fr_CA row; German is test 3's subject.)
	test(
		'guard rails: primary/default rows refuse with alert; metadata drags submissions; default flip re-enables',
		{tag: '@regression'},
		async ({page, pkpApi}) => {
			test.slow();
			const tag = uniqueTag();
			const ctx = await seedJournal(pkpApi, tag, {
				supportedLocales: ['en', 'fr_CA'],
			});

			await openLanguagesTab(page, ctx.path);

			// Refusal 1: UI off on the PRIMARY row (en).
			const msg1 = await refuseCell(
				page,
				'languageGridContainer',
				'en',
				'uiLocale',
			);
			expect(msg1).toBe(
				'The language setting could not be saved. All options need to be enabled.',
			);

			// Refusal 2: Submissions off on the DEFAULT row (en).
			const msg2 = await refuseCell(
				page,
				'submissionLanguageGridContainer',
				'en',
				'submissionLocale',
			);
			expect(msg2).toBe(
				'The language setting could not be saved. All options need to be enabled.',
			);

			// Nothing stored by either refusal…
			let stored = await getContext(page.request, ctx.path, ctx.id);
			expect(stored.supportedLocales).toEqual(['en', 'fr_CA']);
			expect(stored.supportedSubmissionLocales).toEqual(['en', 'fr_CA']);
			// …and a fresh grid render shows both checkboxes back on.
			await openLanguagesTab(page, ctx.path);
			await expect(
				cellInput(page, 'languageGridContainer', 'en', 'uiLocale'),
			).toBeChecked();
			await expect(
				cellInput(
					page,
					'submissionLanguageGridContainer',
					'en',
					'submissionLocale',
				),
			).toBeChecked();

			// Metadata off on the non-default fr_CA row silently drags
			// Submissions off with it (rule 5, downward cascade).
			await saveCell(
				page,
				'submissionLanguageGridContainer',
				'fr_CA',
				'submissionMetadataLocale',
			);
			await expect(
				cellInput(
					page,
					'submissionLanguageGridContainer',
					'fr_CA',
					'submissionLocale',
				),
			).not.toBeChecked({timeout: 20_000});
			stored = await getContext(page.request, ctx.path, ctx.id);
			expect(stored.supportedSubmissionLocales).toEqual(['en']);
			expect(stored.supportedSubmissionMetadataLocales).toEqual(['en']);

			// Flipping the Default radio to fr_CA records the new default
			// submission language and auto-re-enables the row's
			// Submissions + Metadata.
			await saveCell(
				page,
				'submissionLanguageGridContainer',
				'fr_CA',
				'defaultSubmissionLocale',
			);
			await expect(
				cellInput(
					page,
					'submissionLanguageGridContainer',
					'fr_CA',
					'submissionLocale',
				),
			).toBeChecked({timeout: 20_000});
			stored = await getContext(page.request, ctx.path, ctx.id);
			expect(stored.supportedDefaultSubmissionLocale).toBe('fr_CA');
			expect(stored.supportedSubmissionLocales).toContain('fr_CA');
			expect(stored.supportedSubmissionMetadataLocales).toContain('fr_CA');
		},
	);

	// ── Scenario 5 — Primary-locale flip re-faces the journal ──────────────
	// On an en-only scratch journal the manager selects French as Primary
	// locale: French is force-re-added to UI + Forms (rule 7); a fresh
	// visitor with Accept-Language de-DE lands on the French home (their
	// language isn't offered → primary wins) while Accept-Language en
	// still gets English; forms now require French first (feature 56's
	// machinery — pinned via the settings API's field error).
	test(
		'primary flip: French force-added to UI+Forms; Accept-Language routing; French-first requirement',
		{tag: ['@smoke', '@regression']},
		async ({page, pkpApi, browser, baseURL}) => {
			test.slow();
			const tag = uniqueTag();
			const ctx = await seedJournal(pkpApi, tag); // en-only

			await openLanguagesTab(page, ctx.path);
			const frUi = cellInput(page, 'languageGridContainer', 'fr_CA', 'uiLocale');
			const frForms = cellInput(
				page,
				'languageGridContainer',
				'fr_CA',
				'formLocale',
			);
			await expect(frUi).not.toBeChecked();
			await expect(frForms).not.toBeChecked();

			// Select French as Primary locale (radio).
			await saveCell(page, 'languageGridContainer', 'fr_CA', 'contextPrimary');
			// Force-re-added to UI and Forms, in the grid and in storage.
			await expect(frUi).toBeChecked({timeout: 20_000});
			await expect(frForms).toBeChecked();
			const stored = await getContext(page.request, ctx.path, ctx.id);
			expect(stored.primaryLocale).toBe('fr_CA');
			expect(stored.supportedLocales).toEqual(['en', 'fr_CA']);
			expect(stored.supportedFormLocales).toEqual(['en', 'fr_CA']);

			// Accept-Language de-DE → the French home (primary), en → English
			// (Accept-Language wins among ENABLED UI locales only).
			const deCtx = await newAnonContext(browser, baseURL, {locale: 'de-DE'});
			try {
				const dePage = await deCtx.newPage();
				await dePage.goto(base(ctx.path));
				await expect(dePage).toHaveURL(new RegExp(`/${ctx.path}/fr_CA`));
				await expect(dePage.locator('html')).toHaveAttribute('lang', 'fr-CA');
			} finally {
				await deCtx.close();
			}
			const enCtx = await newAnonContext(browser, baseURL, {locale: 'en'});
			try {
				const enPage = await enCtx.newPage();
				await enPage.goto(base(ctx.path));
				await expect(enPage).toHaveURL(new RegExp(`/${ctx.path}/en`));
				await expect(enPage.locator('html')).toHaveAttribute('lang', 'en');
			} finally {
				await enCtx.close();
			}

			// Forms now require French first: an empty fr_CA title is
			// refused by the same endpoint every settings form saves to.
			// The error is keyed to name.fr_CA; its message localizes to
			// the session's negotiated locale (en or, post-flip, fr_CA —
			// whose translation ships a broken `{$ language}` placeholder,
			// asserted loosely on purpose).
			const csrf = await csrfToken(page);
			const put = await page.request.put(
				`${base(ctx.path)}/api/v1/contexts/${ctx.id}`,
				{
					headers: {'X-Csrf-Token': csrf, 'Content-Type': 'application/json'},
					data: {name: {en: `Renamed ${tag}`, fr_CA: ''}},
				},
			);
			expect(put.status()).toBe(400);
			const errors = await put.json();
			expect(errors.name?.fr_CA?.length ?? 0).toBeGreaterThan(0);
			expect(errors.name.fr_CA[0]).toMatch(
				/You must complete this field in French|Vous devez remplir ce champ/,
			);
		},
	);

	// ── Scenario 6 — Reader and editor switch their own language ───────────
	// Anonymous reader clicks "français" in the sidebar block: the locale
	// switches (cookie + session → French chrome, fr_CA URL segment) but
	// ⚠ the redirect lands on the SITE INDEX — ledger 145 as-built (the
	// block's `source` loses the :8000 port). The backend user-menu
	// switch (full document.URL) returns to the exact dashboard page in
	// French. Plus rule 11: the public _i18n/ui.js bundle serves the
	// CURRENT request locale, long-cached.
	test(
		'language switching: block switches locale but lands on site index (row 145); backend switch returns in place; i18n bundle follows',
		{tag: ['@smoke', '@regression']},
		async ({page, pkpApi, browser, baseURL}) => {
			test.slow();
			const tag = uniqueTag();
			const mgrUser = `mg${tag}`;
			const ctx = await seedJournal(pkpApi, tag, {
				supportedLocales: ['en', 'fr_CA'],
				sidebar: ['languagetoggleblockplugin'],
				// DEDICATED throwaway manager for the backend switch — the
				// shared dbarnes storage state's server-side session is
				// reused by other workers, so ITS locale must never flip.
				users: [
					{
						username: mgrUser,
						password: mgrUser + mgrUser,
						roles: ['manager'],
					},
				],
			});

			// ANONYMOUS reader: the sidebar block switch.
			const anon = await newAnonContext(browser, baseURL);
			try {
				const pub = await anon.newPage();
				await pub.goto(base(ctx.path)); // lands on /en
				await expect(pub).toHaveURL(new RegExp(`/${ctx.path}/en`));
				const frLink = pub.locator('.block_language li.locale_fr_CA a', {
					hasText: 'français',
				});
				await expect(frLink).toBeVisible();
				await frLink.click();

				// ⚠ Ledger 145 as-built: the redirect falls back to the SITE
				// INDEX (in French) because the block's source param lost the
				// port…
				await pub.waitForURL(/\/index\.php\/index\/fr_CA/, {
					timeout: 20_000,
				});
				// …but the locale DID switch: cookie + session.
				const cookies = await anon.cookies();
				expect(
					cookies.find((c) => c.name === 'currentLocale')?.value,
				).toBe('fr_CA');
				await pub.goto(base(ctx.path));
				await expect(pub).toHaveURL(new RegExp(`/${ctx.path}/fr_CA`));
				await expect(pub.locator('html')).toHaveAttribute('lang', 'fr-CA');
				await expect(
					pub.locator('.block_language li.locale_fr_CA'),
				).toHaveClass(/current/);

				// Rule 11: the PUBLIC translation bundle follows the request
				// locale (this session is French now), cached one year.
				const frBundle = await anon.request.get(
					`${base(ctx.path)}/api/v1/_i18n/ui.js`,
				);
				expect(frBundle.status()).toBe(200);
				expect(frBundle.headers()['content-type']).toContain('javascript');
				expect(frBundle.headers()['cache-control']).toContain(
					'max-age=31536000',
				);
				const frBody = await frBundle.text();
				expect(frBody).toContain('pkp.localeKeys');
				expect(frBody).toContain('"common.save":"Enregistrer"');
			} finally {
				await anon.close();
			}

			// A FRESH anonymous session gets the English bundle from the
			// same public URL (no auth required).
			const anonEn = await newAnonContext(browser, baseURL);
			try {
				const enBundle = await anonEn.request.get(
					`${base(ctx.path)}/api/v1/_i18n/ui.js`,
				);
				expect(enBundle.status()).toBe(200);
				expect(await enBundle.text()).toContain('"common.save":"Save"');
			} finally {
				await anonEn.close();
			}

			// BACKEND: the throwaway manager switches via the user menu and
			// returns to the exact page, now in French (immune to row 145 —
			// the menu passes the full URL).
			const mgrCtx = await newAnonContext(browser, baseURL);
			try {
				const mgrPage = await mgrCtx.newPage();
				const login = new LoginPage(mgrPage);
				await login.login(mgrUser, mgrUser + mgrUser, ctx.path);
				await mgrPage.waitForURL((u) => !u.pathname.includes('/login'), {
					waitUntil: 'commit',
					timeout: 15_000,
				});
				await mgrPage.goto(`${base(ctx.path)}/dashboard/editorial`);
				await mgrPage
					.locator('[data-cy="app-user-nav"] button')
					.first()
					.click();
				await mgrPage
					.getByRole('link', {name: 'français', exact: true})
					.click();
				await mgrPage.waitForURL(
					new RegExp(`/${ctx.path}/fr_CA/dashboard/editorial`),
					{timeout: 20_000},
				);
				await expect(mgrPage.locator('html')).toHaveAttribute(
					'lang',
					'fr-CA',
				);
			} finally {
				await mgrCtx.close();
			}
		},
	);

	// ── Scenario 7 — Site administrator's language pool (READ-MOSTLY) ──────
	// Admin's Site Setup → Languages lists the two INSTALLED locales:
	// Enable checkboxes (both site-enabled), the site-primary radio on en,
	// fr_CA marked `*` incomplete + the footnote, the Install Locale modal
	// of shipped-but-not-installed packs (opened, asserted, CLOSED — never
	// saved), and Remove only on the non-primary row. Site-vs-journal
	// boundary: a journal manager is refused on the admin page and grid.
	// NO site locale is installed/uninstalled/enabled/disabled here — the
	// rule-12 cascade is global and stays unprobed (spec's own note).
	test(
		'admin pool (read-mostly): grid anatomy, incomplete marker, install modal, remove on non-primary only; manager refused',
		{tag: '@regression'},
		async ({page, asUser}) => {
			test.slow();
			const adminCtx = await asUser('admin');
			const adminPage = await adminCtx.newPage();
			await adminPage.goto('/index.php/index/admin/settings');
			// NB the page renders TWO tabs whose DOM id is `setup-button`
			// (the outer "Site Setup" and Site Appearance's inner "Setup") —
			// pick by accessible name; the Languages side tab lives inside
			// the #setup panel.
			await adminPage
				.getByRole('tab', {name: 'Site Setup', exact: true})
				.click();
			await adminPage.locator('#setup').locator('#languages-button').click();
			const grid = adminPage.locator('#languageGridContainer');
			await expect(
				grid.locator('input[id^="select-cell-"]').first(),
			).toBeVisible({timeout: 20_000});
			await waitForJQueryIdle(adminPage);

			// Column anatomy: Enable / Locale / Code / Primary locale.
			for (const header of ['Enable', 'Locale', 'Code', 'Primary locale']) {
				await expect(
					grid.locator('th', {hasText: header}).first(),
				).toBeVisible();
			}

			// One row per INSTALLED locale: en + fr_CA, both site-enabled.
			await expect(grid.locator('input[id*="-enable"]')).toHaveCount(2);
			await expect(
				cellInput(adminPage, 'languageGridContainer', 'en', 'enable'),
			).toBeChecked();
			await expect(
				cellInput(adminPage, 'languageGridContainer', 'fr_CA', 'enable'),
			).toBeChecked();

			// Site primary: en's radio selected, fr_CA's not.
			await expect(
				cellInput(adminPage, 'languageGridContainer', 'en', 'sitePrimary'),
			).toBeChecked();
			await expect(
				cellInput(adminPage, 'languageGridContainer', 'fr_CA', 'sitePrimary'),
			).not.toBeChecked();

			// fr_CA is incompletely translated: `*` on its row + footnote.
			const frRow = grid.locator('tr[id$="-row-fr_CA"]');
			const enRow = grid.locator('tr[id$="-row-en"]');
			await expect(frRow.locator('.pkp_form_error')).toHaveText('*');
			await expect(enRow.locator('.pkp_form_error')).toHaveCount(0);
			await expect(grid).toContainText('Marked locales may be incomplete.');

			// The Install Locale modal lists shipped-but-not-installed packs
			// (e.g. German) — opened read-only and dismissed, NEVER saved.
			await grid.locator('a[id*="-installLocale-button-"]').click();
			const installForm = adminPage.locator('form#installLanguageForm');
			await expect(installForm).toBeVisible({timeout: 20_000});
			expect(
				await installForm.locator('input[name^="localesToInstall"]').count(),
			).toBeGreaterThan(0);
			await expect(
				installForm.locator('input[name="localesToInstall[de]"]'),
			).toBeAttached();
			// No installed locale is offered again.
			await expect(
				installForm.locator('input[name="localesToInstall[en]"]'),
			).toHaveCount(0);
			await adminPage.keyboard.press('Escape');
			await expect(installForm).toHaveCount(0, {timeout: 15_000});

			// Remove renders on the NON-PRIMARY row only (row expander).
			const frRowId = await frRow.getAttribute('id');
			await frRow.locator('a.show_extras').click();
			await expect(
				adminPage.locator(`a[id^="${frRowId}-uninstall-button-"]`),
			).toBeVisible({timeout: 15_000});
			const enRowId = await enRow.getAttribute('id');
			await expect(
				adminPage.locator(`a[id^="${enRowId}-uninstall-button-"]`),
			).toHaveCount(0);
			await expect(enRow.locator('a.show_extras')).toHaveCount(0);

			// SITE-vs-JOURNAL boundary: the journal manager (dbarnes, via the
			// default fixture context — read-only probes) is refused on the
			// admin settings page AND the admin grid URL.
			const mgrPageRes = await page.request.get(
				'/index.php/index/admin/settings',
			);
			expect(mgrPageRes.url()).toMatch(/authorizationDenied|login/);
			const mgrGridRes = await page.request.get(
				'/index.php/index/$$$call$$$/grid/admin/languages/admin-language-grid/fetch-grid',
			);
			const mgrGridJson = await mgrGridRes.json();
			expect(mgrGridJson.status).toBe(false);
			expect(mgrGridJson.content).toContain(
				'The current role does not have access to this operation.',
			);
		},
	);
});
