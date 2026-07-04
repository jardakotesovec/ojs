// @ts-check
const {test, expect} = require('../support/fixtures.js');

/**
 * Journal home page — the anonymous reader's front door at `/{journalPath}`.
 * One test per canonical scenario of docs/product/specs/journal-homepage.md
 * (7 named scenarios → 7 tests). It is a read-only, fully public page whose
 * contents are a projection of journal settings + published content, not of
 * the viewer's role — so every assertion runs in an ANONYMOUS context (this
 * file sets no `test.use({user})`, so the default `page` carries no session).
 *
 * The spec author could only live-verify the ABSENT states on the seeded
 * `publicknowledge` journal (no sidebar, no highlights, no announcements
 * section — each for a documented reason). This suite drives the POSITIVE
 * cases on scratch journals it seeds via the scenario API:
 *   - Sidebar blocks   — seeds the journal `sidebar` array + relies on the
 *                        block plugins auto-enabling on context creation, then
 *                        asserts the blocks render in array order (rules 11-13).
 *   - Announcements    — satisfies the TWO-PART gate (enableAnnouncements +
 *                        numAnnouncementsHomepage) and seeds an announcement,
 *                        then asserts the in-content section renders; the
 *                        control journal (enabled but count unset) shows none
 *                        even with an announcement present (rule 9).
 *   - Highlights       — seeds a highlight (title/url/urlText, no image) and
 *                        asserts the theme's carousel renders (rule 6).
 *   - Current issue    — seeds a published current issue on a scratch journal
 *                        and asserts the TOC section; publishingMode=NONE on
 *                        the same shape suppresses it (rule 3 guard).
 *   - Custom content   — seeds `additionalHomeContent` (rule 10); the journal
 *                        description stays hidden because the theme's
 *                        `showDescriptionInJournalIndex` option is off by
 *                        default (rule 8).
 *
 * Seeding path: the scenario context schema gained passthrough for `sidebar`,
 * `numAnnouncementsHomepage`, `additionalHomeContent`, `announcements[]` and
 * `highlights[]` (lib/pkp — additive test-infra). The current-issue read on
 * `publicknowledge` needs no seeding (live).
 *
 * Stable render markers (from indexJournal.tpl / the included objects):
 *   - current issue        → `section.current_issue` (+ `.current_issue_title`,
 *                            `journal.viewAllIssues` link → issue/archive)
 *   - highlights carousel   → `.highlights` / `.swiper-slide` / `.swiper-slide-title`
 *   - announcements section → `section.cmp_announcements` (id `homepageAnnouncements`)
 *                            — distinct from the "Announcements" primary-nav link
 *   - sidebar               → `.pkp_structure_sidebar` with `.pkp_block.block_*`
 *   - custom content        → `.additional_content`
 *   - description (About)   → `section.homepage_about` (only if the theme option is on)
 *
 * Reader-URL locale rule (patterns.md item 9): `publicknowledge` is
 * multi-locale (prefix `/en/`); single-locale scratch journals serve the bare
 * path. `page.goto` follows the 302 either way, so bare scratch paths are safe.
 *
 * Parallel-safety: unique hyphenless alphanumeric journal paths; every scratch
 * journal is per-test; all reads are anonymous.
 */

/** A unique, hyphenless, alphanumeric journal path (≤32, parallel isolation). */
function uniquePath(prefix = 'home') {
	const workerLetter = String.fromCharCode(97 + (test.info().parallelIndex % 26));
	let suffix = '';
	while (suffix.length < 6) {
		suffix += Math.random().toString(36).replace(/[^a-z0-9]/g, '');
	}
	return `${prefix}${workerLetter}${suffix.slice(0, 6)}`;
}

/** Create a single-locale (en) scratch journal; returns its urlPath + name. */
async function createJournal(pkpApi, overrides = {}) {
	const path = overrides.path ?? uniquePath();
	const name = overrides.name ?? {en: `Home Journal ${path}`};
	const spec = {
		tag: path,
		path,
		primaryLocale: 'en',
		supportedLocales: ['en'],
		...overrides,
		name,
	};
	const res = await pkpApi.createJournal(spec);
	return {path: res.context.path, name: name.en};
}

/** The anonymous journal home page for a scratch journal (bare path). */
function homeUrl(path) {
	return `/index.php/${path}/`;
}

test.describe('Journal home page — the anonymous reader landing page', () => {
	// Canonical scenario 1 — A reader lands on the journal home page. Anonymous
	// visitor opens publicknowledge: the current issue's TOC renders inline
	// ("Current Issue", "Vol. 1 No. 2 (2014)", the TOC, and a "View All Issues"
	// link to the archive). This is the default because the journal has issues,
	// publishes online, and sets no custom display mode. The documented ABSENT
	// states are asserted alongside: no sidebar region, no highlights carousel,
	// and no in-content announcements section (publicknowledge has announcements
	// enabled but no home-page count — rule 9's two-part gate).
	test(
		'anonymous reader sees the current-issue TOC on publicknowledge',
		{tag: ['@smoke', '@regression']},
		async ({page}) => {
			await page.goto('/index.php/publicknowledge/en/');

			// The current-issue section renders inline with its heading,
			// identification, TOC and the archive link.
			const currentIssue = page.locator('section.current_issue');
			await expect(currentIssue).toBeVisible();
			await expect(
				currentIssue.getByRole('heading', {name: 'Current Issue'}),
			).toBeVisible();
			await expect(currentIssue.locator('.current_issue_title')).toContainText(
				'Vol. 1 No. 2 (2014)',
			);
			// The section-grouped TOC object is embedded in the section…
			await expect(currentIssue.locator('.obj_issue_toc')).toBeVisible();
			// …and a "View All Issues" link points at the issue archive.
			const archiveLink = currentIssue.getByRole('link', {
				name: 'View All Issues',
			});
			await expect(archiveLink).toBeVisible();
			await expect(archiveLink).toHaveAttribute('href', /issue\/archive/);

			// Documented absent states on publicknowledge (spec rules 6, 9, 11-12).
			await expect(page.locator('.pkp_structure_sidebar')).toHaveCount(0);
			await expect(page.locator('.highlights .swiper-slide')).toHaveCount(0);
			await expect(page.locator('section.cmp_announcements')).toHaveCount(0);
		},
	);

	// Canonical scenario 3 — The highlights carousel appears when highlights are
	// configured. A scratch journal with one seeded highlight (title / url /
	// urlText, no image) renders the theme's Swiper carousel across the top:
	// a slide with the highlight title and a button linking to its URL (rule 6).
	test(
		'highlights carousel renders when a highlight is configured',
		{tag: '@regression'},
		async ({page, pkpApi}) => {
			const {path} = await createJournal(pkpApi, {
				highlights: [
					{
						title: 'Featured Special Issue',
						description: 'A curated collection',
						url: 'https://example.org/featured',
						urlText: 'Explore the collection',
					},
				],
			});

			await page.goto(homeUrl(path));

			const carousel = page.locator('.highlights');
			await expect(carousel).toBeVisible();
			const slide = carousel.locator('.swiper-slide').first();
			await expect(slide).toBeVisible();
			await expect(slide.locator('.swiper-slide-title')).toHaveText(
				'Featured Special Issue',
			);
			const slideButton = slide.getByRole('link', {
				name: 'Explore the collection',
			});
			await expect(slideButton).toBeVisible();
			await expect(slideButton).toHaveAttribute(
				'href',
				'https://example.org/featured',
			);
		},
	);

	// Canonical scenario 4 — The announcements section shows only when fully
	// configured. POSITIVE: a scratch journal with announcements enabled AND a
	// non-zero home-page count AND a seeded announcement renders the in-content
	// section (heading + the announcement). CONTROL (rule 9's two-part gate): a
	// journal with announcements enabled but NO home-page count — even with an
	// announcement present — renders NO section.
	test(
		'announcements section obeys the two-part enable + count gate',
		{tag: '@regression'},
		async ({page, pkpApi}) => {
			// Positive: both flags set + an active announcement.
			const positive = await createJournal(pkpApi, {
				enableAnnouncements: true,
				numAnnouncementsHomepage: 5,
				announcements: [
					{
						title: 'Call for Papers 2026',
						descriptionShort: 'Submissions now open',
						description: 'The full call for papers text.',
					},
				],
			});
			await page.goto(homeUrl(positive.path));
			const section = page.locator('section.cmp_announcements');
			await expect(section).toBeVisible();
			await expect(section).toContainText('Call for Papers 2026');
			await expect(section).toContainText('Submissions now open');

			// Control: enabled but count unset → the section stays absent even
			// though an announcement exists (the second half of the gate).
			const control = await createJournal(pkpApi, {
				enableAnnouncements: true,
				announcements: [
					{
						title: 'Hidden Announcement',
						descriptionShort: 'Should not appear on the home page',
					},
				],
			});
			await page.goto(homeUrl(control.path));
			await expect(page.locator('section.cmp_announcements')).toHaveCount(0);
			await expect(page.getByText('Hidden Announcement')).toHaveCount(0);
		},
	);

	// Canonical scenario 6 — The sidebar renders configured blocks in order — or
	// nothing. POSITIVE: a multilingual scratch journal (so the language-toggle
	// block is meaningful) whose `sidebar` array lists [languageToggle,
	// information] renders both blocks, in that order. CONTROL: a journal with an
	// empty sidebar renders no sidebar region at all — even though the block
	// plugins ship "enabled" (rules 11-13 + the empty-default).
	test(
		'sidebar renders the configured blocks in array order',
		{tag: '@regression'},
		async ({page, pkpApi}) => {
			// Multilingual so the language-toggle block has something to show.
			const {path} = await createJournal(pkpApi, {
				supportedLocales: ['en', 'fr_CA'],
				sidebar: ['languagetoggleblockplugin', 'informationblockplugin'],
			});

			await page.goto(homeUrl(path));

			const sidebar = page.locator('.pkp_structure_sidebar');
			await expect(sidebar).toBeVisible();

			// Both configured blocks render…
			await expect(sidebar.locator('.block_language')).toBeVisible();
			await expect(sidebar.locator('.block_information')).toBeVisible();

			// …and in the array order given: language-toggle is the first block.
			const blockClasses = await sidebar
				.locator('.pkp_block')
				.evaluateAll((els) => els.map((e) => e.className));
			const langIndex = blockClasses.findIndex((c) =>
				c.includes('block_language'),
			);
			const infoIndex = blockClasses.findIndex((c) =>
				c.includes('block_information'),
			);
			expect(langIndex).toBeGreaterThanOrEqual(0);
			expect(infoIndex).toBeGreaterThan(langIndex);

			// Control: an empty sidebar → no sidebar region renders.
			const empty = await createJournal(pkpApi);
			await page.goto(homeUrl(empty.path));
			await expect(page.locator('.pkp_structure_sidebar')).toHaveCount(0);
		},
	);

	// Canonical scenario 5 — The homepage image / description / custom content
	// follow their settings and theme options. Drives the two seedable-without-
	// a-file surfaces: the custom "additional home content" (raw HTML appended
	// at the foot — rule 10) RENDERS when set; the journal description does NOT
	// show an About section because the theme's `showDescriptionInJournalIndex`
	// option is off by default (rule 8) — a journal can have a description and
	// still not display it.
	test(
		'custom home content renders; the description stays hidden by default',
		{tag: '@regression'},
		async ({page, pkpApi}) => {
			const marker = `custom-home-${uniquePath('x')}`;
			const {path} = await createJournal(pkpApi, {
				description: {en: 'A distinctive journal description sentence.'},
				additionalHomeContent: {
					en: `<div class="test-home-marker">${marker}</div>`,
				},
			});

			await page.goto(homeUrl(path));

			// The custom HTML is emitted verbatim in the additional-content block.
			const additional = page.locator('.additional_content');
			await expect(additional).toBeVisible();
			await expect(additional.locator('.test-home-marker')).toHaveText(marker);

			// The description exists but the About section is absent (theme
			// option off by default) — the description text does not render.
			await expect(page.locator('section.homepage_about')).toHaveCount(0);
			await expect(
				page.getByText('A distinctive journal description sentence.'),
			).toHaveCount(0);
		},
	);

	// Canonical scenario 7 — A journal that does not publish online suppresses
	// the current-issue section. A/B on the same shape (a published, current
	// issue seeded on a scratch journal): with default publishing the TOC
	// section renders (its identification + archive link); with
	// publishingMode=NONE ("do not publish online") the section is suppressed
	// while the rest of the page shell still renders (rule 3's guards).
	test(
		'publishingMode=NONE suppresses the current-issue section',
		{tag: '@regression'},
		async ({page, pkpApi}) => {
			const issue = {volume: 9, number: 3, year: 2021, published: true};

			// A — publishes online: the seeded current issue renders inline.
			const online = await createJournal(pkpApi, {issues: [issue]});
			await page.goto(homeUrl(online.path));
			const onlineSection = page.locator('section.current_issue');
			await expect(onlineSection).toBeVisible();
			await expect(onlineSection.locator('.current_issue_title')).toContainText(
				'Vol. 9 No. 3 (2021)',
			);
			await expect(
				onlineSection.getByRole('link', {name: 'View All Issues'}),
			).toBeVisible();

			// B — do not publish online: the same current issue is suppressed,
			// but the page shell (journal name in the masthead) still renders.
			const offline = await createJournal(pkpApi, {
				publishingMode: 2, // Journal::PUBLISHING_MODE_NONE
				issues: [issue],
			});
			await page.goto(homeUrl(offline.path));
			await expect(page.locator('section.current_issue')).toHaveCount(0);
			await expect(page.getByText(offline.name).first()).toBeVisible();
		},
	);

	// Canonical scenario 2 — The display mode falls back to recent-published
	// when the journal has no issues. A fresh scratch journal has no issues, so
	// JournalContentOption::default() selects RECENT_PUBLISHED: no current-issue
	// TOC section renders, and the page shell (masthead + main content column)
	// still loads. Verifies rule 2/4's default mode selection and rule 3's
	// "no current issue → section absent" guard, distinct from the
	// publishingMode guard above.
	test(
		'a journal with no issues shows no current-issue section (recent-published fallback)',
		{tag: '@regression'},
		async ({page, pkpApi}) => {
			const {path, name} = await createJournal(pkpApi);

			await page.goto(homeUrl(path));

			// No issue → no current-issue TOC section, no archive link.
			await expect(page.locator('section.current_issue')).toHaveCount(0);
			await expect(
				page.getByRole('link', {name: 'View All Issues'}),
			).toHaveCount(0);

			// The page shell renders: the journal name is in the masthead and the
			// main content region is present (recent-published mode, empty list).
			await expect(page.getByText(name).first()).toBeVisible();
			await expect(page.locator('.pkp_structure_content')).toBeVisible();
		},
	);
});
