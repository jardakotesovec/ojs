// @ts-check
const {test, expect} = require('../support/fixtures.js');
const submissionPublished = require('../fixtures/scenarios/submission-published.js');

/**
 * Issue archive & TOC — docs/e2e/plans/issue-archive-toc.md rows 2–4.
 * (Row 1 — archive listing — is absorbed by
 * playwright/tests/journal-homepage.spec.js; both plans record the
 * split.)
 *
 *   1. (plan row 2) Scratch journal with two sections and a published
 *      issue; 2×2 submissions seeded published across both sections.
 *      The reader issue page groups articles under their section
 *      headings, sections in the journal's section sequence.
 *   2. (plan row 3) Two submissions published into bootstrap's
 *      published issue (Vol. 1 No. 2 (2014)) — one ART, one REV. The
 *      issue view renders "Articles" and "Reviews" headings with each
 *      tag-scoped title under its own section. Per-submission state on
 *      the shared issue is allowed; the issue itself is never mutated.
 *   3. (plan row 4) /issue/current resolves to the current issue TOC;
 *      the "Current" primary-nav item points there.
 *
 * Section-sequence determinism (test 1): scenario-seeded sections all
 * get seq=0 (SectionProcessor → Repo::section()->add, sections.seq
 * column default 0), and Postgres returns ORDER BY ties in arbitrary
 * order. The UI create path is the only one that sequences sections
 * (SectionForm::execute sets REALLY_BIG_NUMBER then resequence —
 * controllers/grid/settings/sections/form/SectionForm.php:188-191).
 * So the test keeps the scratch journal's default "Articles" (ART)
 * section and creates the second section through the Sections grid UI,
 * which renumbers them deterministically: Articles=0, Reviews=1.
 *
 * Within-section ordering (test 1 scope note): the TOC orders articles
 * by publications.seq ASC (pages/issue/IssueHandler.php:372-376), but
 * NOTHING in the publish flow assigns seq — every publication keeps
 * the schema default 0 (lib/pkp/schemas/publication.json "seq"), even
 * when published through the real UI. With all-zero seq the
 * within-section order is a DB tie (unstable on Postgres), so the test
 * asserts section grouping + membership, not title order inside a
 * section. Reader-visible custom TOC ordering is a recorded round-2
 * item (issue-management owns the ordering UI).
 */

test.describe('Issue archive & TOC', () => {
	test(
		'issue TOC groups articles by section in the journal section sequence',
		{tag: '@regression'},
		async ({pkpApi, asUser, browser, baseURL}) => {
			const tag = scratchTag('toc');
			const {context} = await pkpApi.createJournal({
				tag,
				name: {en: `Issue TOC ${tag}`},
				users: [{username: 'dbarnes', roles: ['manager']}],
				issues: [{volume: 3, number: 1, year: 2026, published: true}],
			});

			// Second section via the Sections grid UI so the journal's
			// section sequence is deterministic (see header comment).
			const ctx = await asUser('dbarnes');
			const page = await ctx.newPage();
			await createSectionViaUi(page, context.path, {
				title: 'Reviews',
				abbrev: 'REV',
			});

			// 2×2 submissions published into the scratch issue across both
			// sections. Titles get " [tag]" appended by the processor.
			const issueRef = {volume: 3, number: 1, year: 2026};
			const seeds = [
				{section: 'ART', title: 'Articles entry one'},
				{section: 'ART', title: 'Articles entry two'},
				{section: 'REV', title: 'Reviews entry one'},
				{section: 'REV', title: 'Reviews entry two'},
			];
			let issueId = null;
			for (const seed of seeds) {
				const spec = submissionPublished({
					tag,
					journal: context.path,
					issue: issueRef,
				});
				spec.section = seed.section;
				spec.publications[0].metadata.title = {en: seed.title};
				const result = await pkpApi.createSubmission(spec);
				issueId = result.publications?.[0]?.issueId ?? issueId;
			}
			expect(issueId, 'seeded publications carry the issue id').toBeTruthy();

			const listed = (title) => `${title} [${tag}]`;

			// --- Anonymous reader: section grouping + sequence ---
			const anon = await anonContext(browser, baseURL);
			try {
				const reader = await anon.newPage();
				const resp = await reader.goto(
					`/index.php/${context.path}/issue/view/${issueId}`,
				);
				expect(resp?.status()).toBe(200);
				await expect(reader.locator('h1').first()).toContainText(
					'Vol. 3 No. 1 (2026)',
				);

				// Both sections render, in the journal's section sequence:
				// Articles (seq 0) before Reviews (seq 1).
				// toHaveText regexes match the raw (un-normalized) text
				// content, so allow the template's indentation whitespace
				// around the section title.
				const sections = reader.locator('.sections > .section');
				await expect(sections).toHaveCount(2);
				await expect(
					sections.nth(0).locator('h2').first(),
				).toHaveText(/^\s*Articles\s*$/);
				await expect(
					sections.nth(1).locator('h2').first(),
				).toHaveText(/^\s*Reviews\s*$/);

				// Each seeded article sits under its own section heading —
				// and not under the other one.
				const articlesSection = sections.nth(0);
				const reviewsSection = sections.nth(1);
				await expect(articlesSection).toContainText(
					listed('Articles entry one'),
				);
				await expect(articlesSection).toContainText(
					listed('Articles entry two'),
				);
				await expect(articlesSection).not.toContainText(
					listed('Reviews entry one'),
				);
				await expect(articlesSection).not.toContainText(
					listed('Reviews entry two'),
				);
				await expect(reviewsSection).toContainText(
					listed('Reviews entry one'),
				);
				await expect(reviewsSection).toContainText(
					listed('Reviews entry two'),
				);
				await expect(reviewsSection).not.toContainText(
					listed('Articles entry one'),
				);
				await expect(reviewsSection).not.toContainText(
					listed('Articles entry two'),
				);

				// Each section lists exactly its two seeded articles.
				await expect(
					articlesSection.locator('ul.cmp_article_list > li'),
				).toHaveCount(2);
				await expect(
					reviewsSection.locator('ul.cmp_article_list > li'),
				).toHaveCount(2);
			} finally {
				await anon.close();
			}
		},
	);

	test(
		'bootstrap issue TOC groups ART and REV articles under their section headings',
		{tag: '@regression'},
		async ({pkpApi, browser, baseURL}) => {
			// Plan row 3 — publish into the SHARED bootstrap issue
			// (allowed per-submission state); every assertion is scoped by
			// the unique tag because parallel workers publish into the same
			// issue. Section ORDER is deliberately not asserted here:
			// bootstrap's ART and REV sections were scenario-seeded and tie
			// at seq=0 (see test 1's header note) — grouping is the
			// behavior under test.
			const tag = scratchTag('btoc');

			const artSpec = submissionPublished({tag}); // section ART, Vol 1 No 2 (2014)
			artSpec.publications[0].metadata.title = {en: 'Grouped article'};
			const artResult = await pkpApi.createSubmission(artSpec);
			const issueId = artResult.publications?.[0]?.issueId;
			expect(issueId, 'ART publication carries the issue id').toBeTruthy();

			const revSpec = submissionPublished({tag});
			revSpec.section = 'REV';
			revSpec.publications[0].metadata.title = {en: 'Grouped review'};
			await pkpApi.createSubmission(revSpec);

			const artTitle = `Grouped article [${tag}]`;
			const revTitle = `Grouped review [${tag}]`;

			const anon = await anonContext(browser, baseURL);
			try {
				const reader = await anon.newPage();
				const resp = await reader.goto(
					`/index.php/publicknowledge/issue/view/${issueId}`,
				);
				expect(resp?.status()).toBe(200);
				await expect(reader.locator('h1').first()).toContainText(
					'Vol. 1 No. 2 (2014)',
				);

				const articlesSection = reader.locator(
					'.sections .section:has(h2:text-is("Articles"))',
				);
				const reviewsSection = reader.locator(
					'.sections .section:has(h2:text-is("Reviews"))',
				);
				await expect(articlesSection).toHaveCount(1);
				await expect(reviewsSection).toHaveCount(1);

				await expect(articlesSection).toContainText(artTitle);
				await expect(articlesSection).not.toContainText(revTitle);
				await expect(reviewsSection).toContainText(revTitle);
				await expect(reviewsSection).not.toContainText(artTitle);
			} finally {
				await anon.close();
			}
		},
	);

	test(
		'/issue/current resolves to the current issue TOC and the Current nav item points there',
		{tag: '@regression'},
		async ({pkpApi, browser, baseURL}) => {
			// Plan row 4 — bootstrap's current issue is the published
			// Vol. 1 No. 2 (2014); tests never mutate publicknowledge's
			// issues, so "current" is stable across the suite. Seed one
			// published submission so the TOC has tag-scoped content.
			const tag = scratchTag('cur');
			const spec = submissionPublished({tag});
			spec.publications[0].metadata.title = {en: 'Current issue article'};
			await pkpApi.createSubmission(spec);
			const listedTitle = `Current issue article [${tag}]`;

			const anon = await anonContext(browser, baseURL);
			try {
				const reader = await anon.newPage();
				const resp = await reader.goto(
					'/index.php/publicknowledge/issue/current',
				);
				expect(resp?.status()).toBe(200);

				// Current-issue identification + the seeded article in the
				// TOC's section listing.
				await expect(reader.locator('h1').first()).toContainText(
					'Vol. 1 No. 2 (2014)',
				);
				await expect(reader.locator('.sections')).toContainText(
					listedTitle,
				);

				// The "Current" primary-nav item points at issue/current.
				const currentNav = reader
					.locator('#navigationPrimary')
					.getByRole('link', {name: 'Current', exact: true});
				await expect(currentNav).toBeVisible();
				expect(await currentNav.getAttribute('href')).toContain(
					'/issue/current',
				);
			} finally {
				await anon.close();
			}
		},
	);
});

/**
 * Create a section through the legacy Sections grid (Settings →
 * Journal → Sections). Mirrors the helpers in
 * playwright/tests/sections.spec.js (no Sections POM exists; the grid
 * helpers there are spec-local, so they're duplicated rather than
 * imported across specs).
 *
 * @param {import('@playwright/test').Page} page
 * @param {string} journalPath
 * @param {{title: string, abbrev: string}} data
 */
async function createSectionViaUi(page, journalPath, {title, abbrev}) {
	await page.goto(`/index.php/${journalPath}/management/settings/context`);
	await page.locator('#sections-button').click();
	const addButton = page.locator(
		'a[id^="component-grid-settings-sections-sectiongrid-addSection-button-"]',
	);
	await expect(addButton).toBeVisible();
	await addButton.click();
	const form = page.locator('form#sectionForm');
	await expect(form).toBeVisible();
	await form.locator('input[id^="title-"]').fill(title);
	await form.locator('input[id^="abbrev-"]').fill(abbrev);
	await form.getByRole('button', {name: 'Save'}).click();
	// AjaxFormHandler closes the dialog on success and refreshes the
	// grid; the new row's presence confirms the save landed before the
	// caller seeds submissions into the section.
	await expect(form).toHaveCount(0, {timeout: 15_000});
	await expect(page.locator('tr.gridRow', {hasText: title})).toBeVisible();
}

/**
 * Short worker-scoped tag with a random suffix. The journal scenario
 * derives the path as `j-<alnum(tag)>` and journals.path is
 * varchar(32); the random suffix keeps re-runs against the long-lived
 * local DB from colliding. Mirrors
 * lib/pkp/playwright/tests/announcements.spec.js.
 *
 * @param {string} prefix
 */
function scratchTag(prefix) {
	const workerIndex = test.info().parallelIndex;
	const suffix = Math.random().toString(36).slice(2, 8);
	return `${prefix}-w${workerIndex}-${suffix}`;
}

/**
 * Fresh anonymous browser context with an explicit empty storageState
 * (patterns.md rule 8) so a future `test.use({user})` in this file
 * can't silently turn reader checks into logged-in checks.
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
