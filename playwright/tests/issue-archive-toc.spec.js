// @ts-check
const {test, expect} = require('../support/fixtures.js');
const {IssuePage} = require('../pages/IssuePage.js');
const {fixtureFilePath} = require('../../lib/pkp/playwright/pages/FileStagePanel.js');

/**
 * Issue archive & table of contents — the anonymous reader's issue pages
 * (`IssueHandler` at `/{journal}/issue/*`). One test per canonical scenario of
 * docs/product/specs/issue-archive-toc.md (6 named scenarios → 6 tests). Every
 * page here is READ-ONLY and PUBLIC: what a visitor sees is governed by the
 * published state of the content + the journal's publishing mode, not by role —
 * so all reader assertions run in a fresh ANONYMOUS browser context with an
 * explicit empty storageState (patterns.md item 8). This file sets no
 * `test.use({user})`; the manager context needed for seeding/ordering probes is
 * opened per-test via `asUser('dbarnes')`.
 *
 * SEEDING (the spec author's blocker): publicknowledge has only ONE published
 * issue + no issue galleys, so multi-issue ordering, section grouping and the
 * full-issue galley download were all CODE-ONLY for the spec author. This suite
 * seeds its own scratch journals (multiple published issues; a two-section issue
 * with published articles; publishingMode=NONE; an unpublished issue) via the
 * scenario API, and drives ONE legacy-grid UI flow (issue-galley add, reusing
 * IssuePage from issue-management) to put a real Full-Issue galley on a scratch
 * issue — then reads every surface as an anonymous visitor.
 *
 * AS-BUILT REALITIES these tests drive live (assert reality, per the spec):
 *   - ⚠ ROW 101 — the archive orders back issues by custom_issue_orders.seq ASC
 *     ONLY (no date/current tiebreaker). A never-reordered journal has an EMPTY
 *     custom_issue_orders, so every issue's seq is NULL and the archive falls to
 *     ARBITRARY DB order, NOT newest-first. Live-confirmed here: seeding the same
 *     three years (2020/2021/2022) into two fresh journals produced DIFFERENT
 *     orders across runs (2021,2020,2022 vs 2022,2020,2021) — neither
 *     date-descending nor insertion order. Test 1 therefore asserts the archive
 *     DOM order EQUALS the seq collector's order (the manager issues API with
 *     orderBy=seq, the SAME Collector::ORDERBY_SEQUENCE query) — a deterministic
 *     way to prove "the archive follows seq" without pinning a fragile order.
 *   - ⚠ LOGIN-REDIRECT-NOT-404 (OQ 2) — a missing / unpublished / other-journal
 *     issue is DENIED to the public and (for anonymous) REDIRECTED TO LOGIN (302),
 *     NOT a 404 — unlike the article page, which 404s. Test 5 asserts this
 *     reality (302 → login), and the editorial-preview contrast (a manager opens
 *     the same unpublished issue's TOC, 200, with a "Preview" banner).
 *
 * Reader-URL locale rule (patterns.md item 9): single-locale scratch journals
 * serve the BARE path directly (the /en/ form 302s back), so every reader URL
 * here is bare `/index.php/{path}/issue/...`. publicknowledge is not used (its
 * lone issue can't drive any positive multi-issue/galley case).
 *
 * Parallel-safety: unique hyphenless journal paths; every scratch journal is
 * per-test; all reader reads are anonymous; the one UI flow runs on its own
 * scratch journal (no shared-state mutation, publish notification OFF → no
 * Mailpit spray). No hard-coded waits — web-first assertions + redirect probes.
 */

/** A unique, hyphenless, alphanumeric journal path (≤32, parallel isolation). */
function uniquePath(prefix = 'iat') {
	const workerLetter = String.fromCharCode(97 + (test.info().parallelIndex % 26));
	let suffix = '';
	while (suffix.length < 6) {
		suffix += Math.random().toString(36).replace(/[^a-z0-9]/g, '');
	}
	return `${prefix}${workerLetter}${suffix.slice(0, 6)}`;
}

/** A fresh anonymous browser context (explicit empty storage state). */
async function newAnonContext(browser, baseURL) {
	return browser.newContext({
		baseURL,
		storageState: {cookies: [], origins: []},
	});
}

/** The reader identification string an un-titled issue renders, e.g. "Vol. 1 No. 2 (2021)". */
function identification({volume, number, year}) {
	return `Vol. ${volume} No. ${number} (${year})`;
}

/** Bare reader base for a single-locale scratch journal. */
function base(path) {
	return `/index.php/${path}`;
}

/**
 * Create a single-locale (en) scratch journal via the scenario API; returns its
 * urlPath. dbarnes is seeded as a manager (needed for the issues API / grid UI);
 * atester as author (needed only where the test seeds submissions).
 */
async function createJournal(pkpApi, overrides = {}) {
	const path = overrides.path ?? uniquePath();
	const spec = {
		tag: path,
		path,
		primaryLocale: 'en',
		supportedLocales: ['en'],
		users: [
			{username: 'dbarnes', roles: ['manager']},
			{username: 'atester', roles: ['author']},
		],
		...overrides,
	};
	const res = await pkpApi.createJournal(spec);
	return res.context.path;
}

/**
 * A VoR submission published into a published issue → STATUS_PUBLISHED, so it
 * appears in that issue's reader TOC. dbarnes is the managing editor; atester the
 * author. Mirrors issue-management's scheduledIntoIssueSpec, but the target issue
 * is already published, so `published: true` lands the publication PUBLISHED.
 */
function publishedIntoIssueSpec({tag, title, journal, section, volume, number, year}) {
	return {
		tag,
		journal,
		submitter: 'atester',
		section,
		locale: 'en',
		participants: [{user: 'dbarnes', role: 'editor', canChangeMetadata: true}],
		decisions: [
			{type: 'skipExternalReview', by: 'dbarnes'},
			{type: 'sendToProduction', by: 'dbarnes'},
		],
		publications: [
			{
				versionStage: 'VoR',
				metadata: {title: {en: title}},
				issue: {volume, number, year},
				published: true,
			},
		],
	};
}

/** Parse the current issue's id out of the /issue/current 302 Location (anon). */
async function currentIssueId(reqCtx, path) {
	const res = await reqCtx.get(`${base(path)}/issue/current`, {maxRedirects: 0});
	expect(res.status(), 'current issue redirects (302)').toBe(302);
	const loc = res.headers()['location'] ?? '';
	const m = loc.match(/\/issue\/view\/(\d+)/);
	expect(m, `current Location points at an issue view: ${loc}`).toBeTruthy();
	return Number(m[1]);
}

test.describe('Issue archive & table of contents (anonymous reader)', () => {
	// Canonical scenario 1 — Reader browses the back-issue archive. A scratch
	// journal with THREE published back issues lists them all on /issue/archive
	// (each a summary linking to its TOC); requesting a page past the last
	// (/issue/archive/5) is 404. ⚠ ROW 101: the archive orders SOLELY by
	// custom_issue_orders.seq — empty on a never-reordered journal — so the order
	// is arbitrary DB order, not newest-first. Asserted here by proving the
	// archive DOM order equals the seq collector's order (the manager issues API,
	// orderBy=seq — the SAME ORDERBY_SEQUENCE query the archive runs).
	test(
		'archive lists all published back issues; ordering follows seq (row 101); out-of-range 404',
		{tag: ['@smoke', '@regression']},
		async ({pkpApi, browser, baseURL, asUser}) => {
			// Years chosen so date-order (2022,2021,2020) differs from insertion
			// order (2020,2021,2022) — either would be a plausible "intended"
			// order, and the arbitrary seq order matches neither.
			const seeded = [
				{volume: 1, number: 1, year: 2020},
				{volume: 1, number: 2, year: 2021},
				{volume: 2, number: 1, year: 2022},
			];
			const path = await createJournal(pkpApi, {
				issues: seeded.map((i) => ({...i, published: true})),
			});

			const anon = await newAnonContext(browser, baseURL);
			try {
				const reader = await anon.newPage();
				const resp = await reader.goto(`${base(path)}/issue/archive`);
				expect(resp?.status()).toBe(200);

				// The archive page shell + one summary per published issue.
				await expect(reader.locator('.page_issue_archive')).toBeVisible();
				const summaries = reader.locator('.obj_issue_summary');
				await expect(summaries).toHaveCount(seeded.length);

				// Every seeded issue is listed, each linking to its own TOC.
				for (const issue of seeded) {
					const ident = identification(issue);
					const link = reader
						.locator('.obj_issue_summary h2 a.title')
						.filter({hasText: ident});
					await expect(link, `${ident} listed`).toBeVisible();
					await expect(link).toHaveAttribute('href', /\/issue\/view\//);
				}

				// The DOM order the reader sees.
				const domOrder = (
					await reader.locator('.obj_issue_summary h2 a.title').allInnerTexts()
				).map((s) => s.replace(/\s+/g, ' ').trim());

				// ⚠ ROW 101 — the archive order EQUALS the seq collector's order.
				// The anonymous issues API returns nothing, so read the same
				// ORDERBY_SEQUENCE list as the seeded manager (dbarnes).
				const mgrCtx = await asUser('dbarnes');
				const apiRes = await mgrCtx.request.get(
					`${base(path)}/api/v1/issues?isPublished=1&orderBy=seq&count=100`,
				);
				expect(apiRes.ok(), `manager issues API ${apiRes.status()}`).toBeTruthy();
				const seqOrder = (await apiRes.json()).items.map((i) =>
					identification(i),
				);
				expect(seqOrder).toHaveLength(seeded.length);
				expect(
					domOrder,
					'reader archive order matches the seq collector (row 101)',
				).toEqual(seqOrder);

				// Out-of-range page (offset past the last issue) → 404.
				const past = await anon.request.get(`${base(path)}/issue/archive/5`, {
					maxRedirects: 0,
				});
				expect(past.status(), 'archive page past the last is 404').toBe(404);
			} finally {
				await anon.close();
			}
		},
	);

	// Canonical scenario 2 — Reader jumps to the current issue. /issue, /issue/index
	// and /issue/current are the same op: on a journal WITH a current issue they
	// all 302 → that issue's TOC (/issue/view/{id}); on a journal with NO current
	// issue /issue/current instead renders the "No Current Issue" placeholder.
	test(
		'current-issue redirect (index/current → view) and the no-current placeholder',
		{tag: ['@smoke', '@regression']},
		async ({pkpApi, browser, baseURL}) => {
			// A — a published (hence current) issue: index/current redirect to it.
			const withCurrent = await createJournal(pkpApi, {
				issues: [{volume: 4, number: 1, year: 2025, published: true}],
			});
			// B — no issues at all: no current issue → placeholder page.
			const noCurrent = await createJournal(pkpApi);

			const anon = await newAnonContext(browser, baseURL);
			try {
				// Every entry point into the current issue op redirects to a TOC.
				for (const op of ['issue', 'issue/index', 'issue/current']) {
					const res = await anon.request.get(`${base(withCurrent)}/${op}`, {
						maxRedirects: 0,
					});
					expect(res.status(), `${op} redirects`).toBe(302);
					expect(res.headers()['location'], `${op} → view`).toMatch(
						/\/issue\/view\/\d+/,
					);
				}

				// The no-current journal renders the placeholder (200, not a redirect).
				const reader = await anon.newPage();
				const resp = await reader.goto(`${base(noCurrent)}/issue/current`);
				expect(resp?.status()).toBe(200);
				await expect(reader.locator('.page_issue')).toBeVisible();
				await expect(
					reader.getByRole('heading', {name: 'No Current Issue'}),
				).toBeVisible();
				// No TOC object renders on the placeholder.
				await expect(reader.locator('.obj_issue_toc')).toHaveCount(0);
			} finally {
				await anon.close();
			}
		},
	);

	// Canonical scenario 3 — Reader reads a single issue's TOC grouped by section.
	// A scratch journal with TWO sections (Articles, Reviews) + a published issue
	// carrying a description and one published article in EACH section renders the
	// issue heading (identification + description) and the articles grouped under
	// their section headings, each article a summary linking to its landing page.
	test(
		'single-issue TOC groups articles under their section headings',
		{tag: ['@smoke', '@regression']},
		async ({pkpApi, browser, baseURL}) => {
			test.slow(); // two submission seeds + the reader read
			const path = uniquePath();
			const desc = `This issue collects work tagged ${path}.`;
			await createJournal(pkpApi, {
				path,
				sections: [
					{abbrev: {en: 'ART'}, title: {en: 'Articles'}},
					{abbrev: {en: 'REV'}, title: {en: 'Reviews'}},
				],
				issues: [
					{
						volume: 3,
						number: 1,
						year: 2033,
						published: true,
						description: {en: desc},
					},
				],
			});
			const artTitle = `Articles paper ${path}`;
			const revTitle = `Reviews paper ${path}`;
			await pkpApi.createSubmission(
				publishedIntoIssueSpec({
					tag: `${path}art`,
					title: artTitle,
					journal: path,
					section: 'ART',
					volume: 3,
					number: 1,
					year: 2033,
				}),
			);
			await pkpApi.createSubmission(
				publishedIntoIssueSpec({
					tag: `${path}rev`,
					title: revTitle,
					journal: path,
					section: 'REV',
					volume: 3,
					number: 1,
					year: 2033,
				}),
			);

			const anon = await newAnonContext(browser, baseURL);
			try {
				const issueId = await currentIssueId(anon.request, path);
				const reader = await anon.newPage();
				const resp = await reader.goto(`${base(path)}/issue/view/${issueId}`);
				expect(resp?.status()).toBe(200);

				const toc = reader.locator('.obj_issue_toc');
				await expect(toc).toBeVisible();
				// The issue heading renders its description.
				await expect(toc.locator('.heading .description')).toContainText(desc);

				// Two section groups, each headed by its (visible) section title.
				const artSection = toc
					.locator('.sections .section')
					.filter({has: reader.getByRole('heading', {name: 'Articles'})});
				const revSection = toc
					.locator('.sections .section')
					.filter({has: reader.getByRole('heading', {name: 'Reviews'})});
				await expect(artSection).toHaveCount(1);
				await expect(revSection).toHaveCount(1);

				// Each section groups ONLY its own article, each a link to the
				// article landing page.
				const artLink = artSection.getByRole('link', {name: artTitle});
				await expect(artLink).toBeVisible();
				await expect(artLink).toHaveAttribute('href', /\/article\/view\//);
				await expect(artSection.getByRole('link', {name: revTitle})).toHaveCount(0);

				await expect(revSection.getByRole('link', {name: revTitle})).toBeVisible();
				await expect(revSection.getByRole('link', {name: artTitle})).toHaveCount(0);
			} finally {
				await anon.close();
			}
		},
	);

	// Canonical scenario 4 — Reader downloads a full-issue galley. On an OPEN-ACCESS
	// journal, an issue carrying a "Full Issue" PDF galley renders that galley in a
	// "Full Issue" list on its TOC, and the reader download streams the file. The
	// galley is seeded through the editorial UI (reused IssuePage from
	// issue-management — the scenario API cannot attach issue galleys), on a future
	// issue that is then published; the reader read is anonymous. (The
	// subscription/payment gate on this download is owned by subscriptions/payments;
	// article-landing.spec.js drives the analogous per-galley gate.)
	test(
		'full-issue galley renders in the TOC and downloads (open access)',
		{tag: '@regression'},
		async ({pkpApi, browser, baseURL, asUser}) => {
			test.slow(); // legacy jQuery grid: galley upload + publish
			const path = uniquePath();
			const issue = {volume: 8, number: 1, year: 2038};
			await createJournal(pkpApi, {
				path,
				issues: [{...issue, published: false}],
			});
			const label = `Full Issue PDF ${path}`;

			// Manager adds the issue galley to the future issue, then publishes it.
			const mgrCtx = await asUser('dbarnes');
			const issuePage = new IssuePage(await mgrCtx.newPage());
			await issuePage.goto(path);
			await issuePage.openIssueGalleysTab(issuePage.futureRow(issue));
			await issuePage.addIssueGalley({
				label,
				filePath: fixtureFilePath('default-article.pdf'),
			});
			// addIssueGalley closes only the inner galley-form AjaxModal; the
			// outer Edit Issue side-modal stays open and would intercept the
			// publish click. Reload the Issues page for a clean future grid.
			await issuePage.goto(path);
			await issuePage.publishIssue(issue, {sendNotification: false});

			// Resolve the now-published issue + its galley id (manager API).
			const listRes = await mgrCtx.request.get(
				`${base(path)}/api/v1/issues?isPublished=1&count=10`,
			);
			expect(listRes.ok(), `issues API ${listRes.status()}`).toBeTruthy();
			const issueId = (await listRes.json()).items[0].id;
			const issueRes = await mgrCtx.request.get(
				`${base(path)}/api/v1/issues/${issueId}`,
			);
			const galleys = (await issueRes.json()).galleys ?? [];
			expect(
				galleys.map((g) => g.label),
				'the seeded galley is stored on the issue',
			).toContain(label);
			// The issue-galley API object carries no `id`; its best galley id is
			// the last segment of the reader URL (`.../issue/view/{id}/{galleyId}`).
			const galley = galleys.find((g) => g.label === label);
			const galleyId = galley.urlPublished.split('/').pop();

			const anon = await newAnonContext(browser, baseURL);
			try {
				const reader = await anon.newPage();
				await reader.goto(`${base(path)}/issue/view/${issueId}`);

				// The TOC renders a "Full Issue" galley list with the galley link.
				const galleyBlock = reader.locator('.obj_issue_toc .galleys');
				await expect(galleyBlock).toBeVisible();
				await expect(
					galleyBlock.getByRole('heading', {name: 'Full Issue'}),
				).toBeVisible();
				const galleyLink = galleyBlock.locator('a.obj_galley_link').first();
				await expect(galleyLink).toBeVisible();
				// Open access → the link is NOT drawn restricted.
				await expect(galleyLink).not.toHaveClass(/restricted/);

				// The reader download streams the PDF bytes.
				const dl = await anon.request.get(
					`${base(path)}/issue/download/${issueId}/${galleyId}`,
				);
				expect(dl.ok(), `download ${dl.status()}`).toBeTruthy();
				expect(dl.headers()['content-type']).toContain('pdf');
				const body = await dl.body();
				expect(body.subarray(0, 5).toString()).toBe('%PDF-');
			} finally {
				await anon.close();
			}
		},
	);

	// Canonical scenario 5 — Published-only visibility. ⚠ An anonymous reader
	// requesting a NON-EXISTENT issue id, or an UNPUBLISHED issue, is REDIRECTED TO
	// LOGIN (302) — NOT a 404 (the framework default-deny for a required data
	// object; diverges from the article page, OQ 2). An editorial pre-publication
	// user (manager) may open the SAME unpublished issue's TOC — a 200 preview with
	// a "Preview" banner.
	test(
		'missing / unpublished issue → login redirect (not 404); manager sees a preview',
		{tag: ['@smoke', '@regression']},
		async ({pkpApi, browser, baseURL, asUser}) => {
			const path = await createJournal(pkpApi, {
				issues: [{volume: 5, number: 9, year: 2044, published: false}],
			});

			// The unpublished issue's id (via the seeded manager).
			const mgrCtx = await asUser('dbarnes');
			const listRes = await mgrCtx.request.get(
				`${base(path)}/api/v1/issues?isPublished=0&count=10`,
			);
			expect(listRes.ok(), `unpublished issues API ${listRes.status()}`).toBeTruthy();
			const unpubId = (await listRes.json()).items[0].id;

			const anon = await newAnonContext(browser, baseURL);
			try {
				// Non-existent id → 302 → login (NOT 404).
				const missing = await anon.request.get(
					`${base(path)}/issue/view/99999999`,
					{maxRedirects: 0},
				);
				expect(missing.status(), 'missing issue redirects').toBe(302);
				expect(missing.headers()['location'], 'missing → login').toContain('login');

				// Unpublished issue → 302 → login (denied to the public).
				const unpub = await anon.request.get(
					`${base(path)}/issue/view/${unpubId}`,
					{maxRedirects: 0},
				);
				expect(unpub.status(), 'unpublished issue redirects').toBe(302);
				expect(unpub.headers()['location'], 'unpublished → login').toContain('login');
			} finally {
				await anon.close();
			}

			// The manager (pre-publication access) opens the same unpublished
			// issue's TOC — a 200 preview with the "Preview" banner.
			const mgrPage = await mgrCtx.newPage();
			const resp = await mgrPage.goto(`${base(path)}/issue/view/${unpubId}`);
			expect(resp?.status(), 'manager preview 200').toBe(200);
			const toc = mgrPage.locator('.obj_issue_toc');
			await expect(toc).toBeVisible();
			await expect(toc.locator('.cmp_notification')).toContainText('Preview');
		},
	);

	// Canonical scenario 6 — A journal that does not publish online exposes no issue
	// pages. On a journal set to "do not publish online" (publishingMode=NONE), the
	// archive, current-issue and index pages are all UNREACHABLE to the public
	// (denied by OjsJournalMustPublishPolicy → redirected to login), even though a
	// published issue exists. Verifies rule 2.
	test(
		'publishingMode=NONE makes every issue page unreachable to the public',
		{tag: '@regression'},
		async ({pkpApi, browser, baseURL}) => {
			const path = await createJournal(pkpApi, {
				publishingMode: 2, // Journal::PUBLISHING_MODE_NONE
				issues: [{volume: 1, number: 1, year: 2020, published: true}],
			});

			const anon = await newAnonContext(browser, baseURL);
			try {
				for (const op of ['issue', 'issue/current', 'issue/archive']) {
					const res = await anon.request.get(`${base(path)}/${op}`, {
						maxRedirects: 0,
					});
					expect(res.status(), `${op} denied (302)`).toBe(302);
					expect(res.headers()['location'], `${op} → login`).toContain('login');
				}
			} finally {
				await anon.close();
			}
		},
	);
});
