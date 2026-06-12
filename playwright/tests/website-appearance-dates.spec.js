// @ts-check
const {test, expect} = require('../support/fixtures.js');
const {
	WebsiteSettingsPage,
} = require('../../lib/pkp/playwright/pages/WebsiteSettingsPage.js');
const submissionPublished = require('../fixtures/scenarios/submission-published.js');

/**
 * Website appearance, row 4 — docs/e2e/plans/website-appearance.md.
 *
 * Date-format settings (Settings > Website > Setup > Date & Time,
 * PKPDateTimeForm) reformat the published dates on the OJS reader
 * surfaces — which is why this row lives in the OJS tree while rows
 * 1–3/5–6 are in lib/pkp/playwright/tests/website-appearance.spec.js.
 *
 * Format-usage reality check (vs the plan's wording): the article
 * landing page (article_details.tpl:374) and the issue TOC's
 * "Published" line (issue_toc.tpl:104) both render through
 * `|date_format:$dateFormatShort` — dateFormatLong is not used by any
 * OJS frontend template. The test therefore saves custom values for
 * BOTH fields (round-trip persistence asserted for both on reload) but
 * the front-end assertions exercise dateFormatShort.
 *
 * The custom short format `Y~m~d` uses a separator (~) that no default
 * format and no locale string contains, so its appearance on the front
 * end proves the custom format applied (Smarty's date_format modifier
 * is Carbon translatedFormat with PHP date() tokens —
 * PKPTemplateManager::smartyDateFormat). The publication carries a
 * fixed past datePublished so the article assertion is exact; the
 * issue's datePublished is stamped at seed time (IssueProcessor), so
 * the TOC assertion matches the tilde shape rather than a wall-clock
 * date (display formats only — the ≥1-day-slack rule for date
 * arithmetic doesn't apply here).
 */

test.use({user: 'dbarnes'});

test.describe('Website appearance — date formats', () => {
	test(
		'custom date formats reformat the article landing page and issue TOC dates',
		{tag: '@regression'},
		async ({page, pkpApi, browser, baseURL}) => {
			const tag = scratchTag('wadate');
			const {context} = await pkpApi.createJournal({
				tag,
				name: {en: `Appearance dates ${tag}`},
				users: [{username: 'dbarnes', roles: ['manager']}],
				issues: [{volume: 1, number: 1, year: 2026, published: true}],
			});

			// Published article in the scratch journal's (only) published
			// issue, with a fixed datePublished for an exact assertion.
			const spec = submissionPublished({
				tag,
				journal: context.path,
				issue: 'latest',
			});
			spec.publications[0].metadata.datePublished = '2024-03-09';
			const {submission} = await pkpApi.createSubmission(spec);

			const shortFormat = 'Y~m~d';
			const longFormat = 'Y//m//d';

			// --- Save custom formats on Setup > Date & Time ---
			const settings = new WebsiteSettingsPage(page, context.path);
			await settings.goto();
			let panel = await settings.openSetupTab('dateTime');

			await fillCustomFormat(page, panel, 'dateFormatShort-en', shortFormat);
			await fillCustomFormat(page, panel, 'dateFormatLong-en', longFormat);
			await settings.saveForm(panel);

			// --- Persistence on reload: the custom radios are selected and
			// the inputs carry the saved formats (FieldRadioInput's mounted
			// hook re-binds a value that matches no fixed option to the
			// custom input). ---
			await settings.goto();
			panel = await settings.openSetupTab('dateTime');
			await expect(
				customFormatInput(page, panel, 'dateFormatShort-en'),
			).toHaveValue(shortFormat, {timeout: 15_000});
			await expect(
				customFormatInput(page, panel, 'dateFormatLong-en'),
			).toHaveValue(longFormat);

			// --- Anonymous front end ---
			const anon = await anonContext(browser, baseURL);
			try {
				const reader = await anon.newPage();

				// Article landing page: "Published" block renders the
				// publication date in the custom short format.
				const articleResp = await reader.goto(
					`/index.php/${context.path}/article/view/${submission.id}`,
				);
				expect(articleResp?.status()).toBe(200);
				// `.first()`: the published item also nests a `.versions`
				// sub-item whose <ul class="value"> matches the same
				// selector; the date div is the first .value.
				await expect(
					reader
						.locator('.obj_article_details .item.published .value')
						.first(),
				).toContainText('2024~03~09');

				// Issue TOC: the issue's "Published" line uses the same
				// custom format (issue datePublished = seed time, so match
				// the tilde-separated shape).
				const issueResp = await reader.goto(
					`/index.php/${context.path}/issue/current`,
				);
				expect(issueResp?.status()).toBe(200);
				await expect(
					reader.locator('.page_issue .published .value').first(),
				).toContainText(/\d{4}~\d{2}~\d{2}/);
			} finally {
				await anon.close();
			}
		},
	);
});

/**
 * The FieldRadioInput "Custom" option's text input for the given
 * (multilingual) field name — the only text-type option input in the
 * field's fieldset.
 *
 * @param {import('@playwright/test').Page} page
 * @param {import('@playwright/test').Locator} panel
 * @param {string} fieldName e.g. 'dateFormatShort-en'
 */
function customFormatInput(page, panel, fieldName) {
	return panel
		.locator('fieldset.pkpFormField--options', {
			has: page.locator(`input[name="${fieldName}"]`),
		})
		.locator('input.pkpFormField--options__input--text');
}

/**
 * Select the Custom option and type a format. Focusing the text input
 * checks the paired radio (FieldRadioInput#selectInput); the input
 * event then syncs the typed value into the field's selected value.
 *
 * @param {import('@playwright/test').Page} page
 * @param {import('@playwright/test').Locator} panel
 * @param {string} fieldName e.g. 'dateFormatShort-en'
 * @param {string} format PHP date() format string
 */
async function fillCustomFormat(page, panel, fieldName, format) {
	const input = customFormatInput(page, panel, fieldName);
	await expect(input).toBeVisible({timeout: 15_000});
	await input.fill(format);
}

/**
 * Short worker-scoped tag with a random suffix (journals.path is
 * varchar(32); re-runs on a long-lived DB must not collide).
 *
 * @param {string} prefix
 */
function scratchTag(prefix) {
	const workerIndex = test.info().parallelIndex;
	const suffix = Math.random().toString(36).slice(2, 8);
	return `${prefix}-w${workerIndex}-${suffix}`;
}

/**
 * Fresh anonymous context — explicit empty storageState because this
 * file sets `test.use({user: 'dbarnes'})` (patterns.md rule 8).
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
