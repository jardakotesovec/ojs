// @ts-check
const {test, expect} = require('../support/fixtures.js');
const {LoginPage} = require('../../lib/pkp/playwright/pages/LoginPage.js');
const {
	SiteAccessSettingsPage,
} = require('../../lib/pkp/playwright/pages/SiteAccessSettingsPage.js');
const submissionPublished = require('../fixtures/scenarios/submission-published.js');

/**
 * Article access restriction — docs/e2e/plans/site-access-restrictions.md
 * row 3. OJS-only: `restrictArticleAccess` is appended to the Site Access
 * form by classes/components/forms/context/UserAccessForm.php and is
 * enforced by pages/article/ArticleHandler.php — hence this spec lives in
 * the OJS tree while rows 1/2/4 live in
 * lib/pkp/playwright/tests/site-access-restrictions.spec.js.
 *
 * Enforcement (verified): ArticleHandler::userCanViewGalley#619-621 calls
 * Validation::redirectLogin() when the visitor is anonymous, the journal
 * has restrictArticleAccess on, AND a galley is requested — the abstract/
 * landing page (no galleyId) stays public. The gate only applies to
 * issue-assigned published articles (#611 bails when there is no issue),
 * so the scratch journal seeds its own published issue.
 *
 * Galley: seeded through the submission scenario's publications[].galleys
 * passthrough rather than the galley-grid UI — getting *to* the state is
 * the endpoint's job (PRINCIPLES.md §4); the add-galley UI itself is
 * covered by galleys.spec.js. The galley is REMOTE (urlRemote) pointing
 * back at a page on the same test server: server-side outbound HTTP is
 * firewalled in test runs and the browser must not depend on external
 * hosts either, so "logged-in user opens the galley" is proven by the
 * ArticleHandler::view#366-368 redirect landing on the local target.
 */

/** Explicit empty storage state (patterns.md parallel-load lesson 8). */
const EMPTY_STATE = {cookies: [], origins: []};

test.describe('Article access restriction (restrictArticleAccess)', () => {
	test(
		'anonymous readers see the abstract but must log in for galleys',
		{tag: '@regression'},
		async ({pkpApi, asUser, browser, baseURL}) => {
			const tag = uniqueTag(test.info(), 'aar');
			const clean = tag.replace(/[^a-z0-9]/gi, '');
			const reader = {username: `u${clean}r`, password: `pw-${tag}`};

			const {context} = await pkpApi.createJournal({
				tag,
				name: {en: `Article Gate ${tag}`},
				users: [
					{username: 'dbarnes', roles: ['manager']},
					{
						username: reader.username,
						password: reader.password,
						roles: ['reader'],
					},
				],
				issues: [
					// Published open-access issue (default accessStatus) —
					// the gate under test is restrictArticleAccess, not
					// subscriptions, but it only engages for issue-assigned
					// articles (ArticleHandler#611).
					{volume: 1, number: 1, year: 2026, published: true},
				],
			});

			// Manager flips restrictArticleAccess through the Site Access
			// form (UI-FALLBACK per the plan's scenario-needs adjudication —
			// the context scenario deliberately has no passthrough).
			const managerCtx = await asUser('dbarnes');
			const managerPage = await managerCtx.newPage();
			const siteAccess = new SiteAccessSettingsPage(
				managerPage,
				context.path,
			);
			await siteAccess.goto();
			await siteAccess.setCheckbox('restrictArticleAccess', true);
			await siteAccess.save();

			// Published submission with a remote galley whose target is a
			// local page on the SAME per-worker server (baseURL), keeping
			// the redirect assertion network-independent.
			const remoteTarget = `${baseURL}/index.php/${context.path}/about`;
			const spec = submissionPublished({
				tag,
				journal: context.path,
				issue: {volume: 1, number: 1, year: 2026},
			});
			spec.publications[0].galleys = [
				{label: 'PDF', urlRemote: remoteTarget},
			];
			const {submission} = await pkpApi.createSubmission(spec);

			const articleUrl = `/index.php/${context.path}/article/view/${submission.id}`;

			const anonCtx = await browser.newContext({
				baseURL,
				storageState: EMPTY_STATE,
			});
			try {
				const page = await anonCtx.newPage();

				// Anonymous landing page: public. Abstract + galley link
				// render (the gate fires on galley VIEW, not on listing).
				const resp = await page.goto(articleUrl);
				expect(resp?.status()).toBe(200);
				await expect(
					page.getByText(
						'A fully-processed, published article in scenario form.',
					),
				).toBeVisible();
				const galleyLink = page
					.locator('a.obj_galley_link', {hasText: 'PDF'})
					.first();
				await expect(galleyLink).toBeVisible();
				const galleyHref = await galleyLink.getAttribute('href');
				expect(galleyHref).toContain(`/article/view/${submission.id}/`);

				// Anonymous galley view: bounced to login with the galley
				// URL round-tripped in ?source=.
				await galleyLink.click();
				await page.waitForURL(/\/login/, {
					timeout: 15_000,
					waitUntil: 'commit',
				});
				await expect(page.locator('form#login')).toBeVisible();
				const source = new URL(page.url()).searchParams.get('source');
				expect(source).toContain(
					`/article/view/${submission.id}/`,
				);

				// Logged-in reader (throwaway — no editorial bypass via
				// canPreview) opens the galley: the remote galley redirect
				// lands on the local target page.
				const login = new LoginPage(page);
				await login.submitCredentials(reader.username, reader.password);
				await page.waitForURL((url) => !url.pathname.includes('/login'), {
					timeout: 15_000,
					waitUntil: 'commit',
				});

				await page.goto(/** @type {string} */ (galleyHref));
				await page.waitForURL(/\/about$/, {
					timeout: 15_000,
					waitUntil: 'commit',
				});
				await expect(
					page.getByRole('heading', {name: /About the/}),
				).toBeVisible();
			} finally {
				await anonCtx.close();
			}
		},
	);
});

/**
 * Build a tag scoped to this worker + test title so parallel workers and
 * re-runs on a long-lived DB don't collide on journals.path (varchar 32:
 * the scenario derives `j-` + the sanitised tag).
 *
 * @param {import('@playwright/test').TestInfo} info
 * @param {string} suffix
 */
function uniqueTag(info, suffix) {
	const rand = Math.random().toString(36).slice(2, 8);
	return `w${info.parallelIndex}-${suffix}-${rand}`;
}
