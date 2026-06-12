// @ts-check
const {test, expect} = require('../support/fixtures.js');
const submissionPublished = require('../fixtures/scenarios/submission-published.js');
const {DoiManagementPage} = require('../pages/DoiManagementPage.js');

const SCRATCH_ISSUE = {volume: 1, number: '1', year: 2026};

/**
 * DOI management — rows 4–9 of docs/e2e/plans/doi-management.md.
 *
 * Covers the /dois management page (DoiListPanel) end-to-end: listing +
 * status badges + filters, bulk status transitions, manual assignment
 * with doiCreationTime=never, inline DOI editing, issue DOIs, and the
 * custom suffix pattern. Rows 1–3 (auto-assignment, versioned DOIs,
 * settings persistence) live in playwright/tests/doi-assignment.spec.js.
 *
 * Parallel-safety: rows 4, 5 and 7 ride the shared publicknowledge
 * journal whose /dois list is a SHARED surface — parallel tests keep
 * minting DOIs into it (bootstrap auto-assigns on publish). All
 * assertions there are tag-scoped: the panel is narrowed via search by
 * the per-test tag and only the per-test item (`#list-item-submission-
 * <id>`) is asserted on; whole-list composition is NEVER asserted
 * (plan row 4's hard rule). Rows 6, 8 and 9 mutate journal-level DOI
 * settings, so they run on scratch journals.
 *
 * Status-transition ordering note (row 5): the plan lists Registered →
 * Unregistered → Stale, but `markSubmissionsStale` only accepts DOIs in
 * SUBMITTED/REGISTERED status (PKPDoiController::markSubmissionsStale
 * filterByDoiStatuses), so the test runs Registered → Needs Sync (stale)
 * → Unregistered — same three transitions, reachable order.
 */

test.use({user: 'dbarnes'});

test.describe('DOI management page', () => {
	test(
		'lists the per-test submission with its DOI, Unregistered badge and tag-scoped filter membership',
		{tag: '@regression'},
		async ({page, pkpApi}) => {
			const tag = uniqueTag(test.info(), 'list');

			// Per-test submission on publicknowledge. Bootstrap seeds
			// enableDois + doiPrefix=10.1234 + doiCreationTime=
			// publicationCreationTime, so publishing auto-mints a
			// publication DOI in Unregistered status.
			const {submission, publications} = await pkpApi.createSubmission(
				submissionPublished({tag}),
			);

			const doiPage = new DoiManagementPage(page, 'publicknowledge');
			await doiPage.goto();

			// Narrow the shared list to this test's tag before any
			// presence assertion (the unscoped first page is contended
			// by parallel workers).
			await doiPage.search('submission', tag);
			const item = doiPage.item('submission', submission.id);
			await expect(item).toBeVisible();
			await expect(item).toContainText(tag);

			// Published item with an auto-minted, undeposited DOI →
			// "Unregistered" badge (DoiListItem depositStatusString).
			await expect(doiPage.badge('submission', submission.id)).toHaveText(
				'Unregistered',
			);

			// Expanding exposes the minted DOI under the bootstrap prefix.
			await doiPage.expandItem('submission', submission.id);
			await expect(
				doiPage.publicationDoiInput(submission.id, publications[0].id),
			).toHaveValue(/^10\.1234\//);

			// Tag-scoped filter membership: present under "Unregistered"…
			await doiPage.toggleFilter('submission', 'Unregistered');
			await expect(item).toBeVisible();
			await doiPage.toggleFilter('submission', 'Unregistered');

			// …present under "DOI Assigned"…
			await doiPage.toggleFilter('submission', 'DOI Assigned');
			await expect(item).toBeVisible();
			await doiPage.toggleFilter('submission', 'DOI Assigned');

			// …absent under "Registered" (nothing has deposited it).
			await doiPage.toggleFilter('submission', 'Registered');
			await expect(item).toHaveCount(0);
		},
	);

	test(
		'manager transitions DOI status via bulk actions: Registered, Needs Sync, back to Unregistered',
		{tag: '@regression'},
		async ({page, pkpApi}) => {
			const tag = uniqueTag(test.info(), 'mark');
			const {submission} = await pkpApi.createSubmission(
				submissionPublished({tag}),
			);

			const doiPage = new DoiManagementPage(page, 'publicknowledge');
			await doiPage.goto();
			await doiPage.search('submission', tag);

			const badge = doiPage.badge('submission', submission.id);
			await expect(badge).toHaveText('Unregistered');

			// Each bulk action re-fetches the (still tag-filtered) list;
			// selection is cleared on completion, so re-select each time.
			await doiPage.selectItem('submission', submission.id);
			await doiPage.bulkAction(
				'submission',
				'Mark DOIs Registered',
				'markRegistered',
			);
			await expect(badge).toHaveText('Registered');

			// Stale ("Needs Sync") is only reachable from
			// SUBMITTED/REGISTERED — see header note.
			await doiPage.selectItem('submission', submission.id);
			await doiPage.bulkAction(
				'submission',
				'Mark DOIs Needs Sync',
				'markStale',
			);
			await expect(badge).toHaveText('Needs Sync');

			await doiPage.selectItem('submission', submission.id);
			await doiPage.bulkAction(
				'submission',
				'Mark DOIs Unregistered',
				'markUnregistered',
			);
			await expect(badge).toHaveText('Unregistered');
		},
	);

	test(
		'with doiCreationTime=never the published item needs a DOI and bulk Assign DOIs mints one under the prefix',
		{tag: '@regression'},
		async ({page, pkpApi}) => {
			const tag = uniqueTag(test.info(), 'asg');
			const prefix = '10.9999';

			// Scratch journal: journal-level DOI settings get mutated via
			// the UI, so publicknowledge is off-limits (charter §1).
			const {context} = await pkpApi.createJournal({
				tag,
				enableDois: true,
				doiPrefix: prefix,
				users: [{username: 'dbarnes', roles: ['manager']}],
				issues: [{...SCRATCH_ISSUE, published: true}],
			});

			// Turn automatic assignment OFF through the Distribution →
			// DOIs settings UI (plan: one-off settings state reached via
			// UI, no scenario passthrough) — BEFORE seeding, so neither
			// the production decision nor publish mints a DOI.
			await page.goto(
				`/index.php/${context.path}/management/settings/distribution`,
			);
			await page.locator('#dois-button').click();
			const form = page.locator('form#doisSetup, #doisSetup form').first();
			await expect(form).toBeVisible();
			await form
				.locator('select[name="doiCreationTime"]')
				.selectOption('neverCreationTime');
			await Promise.all([
				page.waitForResponse(
					(res) =>
						/\/api\/v1\/contexts\/\d+/.test(res.url()) &&
						res.ok() &&
						['POST', 'PUT'].includes(res.request().method()),
				),
				form.getByRole('button', {name: 'Save', exact: true}).click(),
			]);

			const spec = submissionPublished({tag});
			spec.journal = context.path;
			spec.publications[0].issue = {...SCRATCH_ISSUE};
			const {submission, publications} = await pkpApi.createSubmission(spec);

			const doiPage = new DoiManagementPage(page, context.path);
			await doiPage.goto();

			// The published-but-DOIless item lives under "Needs DOI".
			await doiPage.toggleFilter('submission', 'Needs DOI');
			const item = doiPage.item('submission', submission.id);
			await expect(item).toBeVisible();
			await expect(doiPage.badge('submission', submission.id)).toHaveText(
				'Needs DOI',
			);

			// Bulk "Assign DOIs" mints; the refreshed hasDois=0 list no
			// longer contains the item.
			await doiPage.selectItem('submission', submission.id);
			await doiPage.bulkAction('submission', 'Assign DOIs', 'assignDois');
			await expect(item).toHaveCount(0);

			// …and it now sits under "DOI Assigned" with a DOI under the
			// configured prefix.
			await doiPage.toggleFilter('submission', 'Needs DOI');
			await doiPage.toggleFilter('submission', 'DOI Assigned');
			await expect(item).toBeVisible();
			await expect(doiPage.badge('submission', submission.id)).toHaveText(
				'Unregistered',
			);
			await doiPage.expandItem('submission', submission.id);
			await expect(
				doiPage.publicationDoiInput(submission.id, publications[0].id),
			).toHaveValue(new RegExp(`^${escapeRegex(prefix)}/`));
		},
	);

	test(
		'editor edits a DOI to a custom suffix and it propagates to the article landing page',
		{tag: '@regression'},
		async ({page, pkpApi, browser, baseURL}) => {
			const tag = uniqueTag(test.info(), 'edit');
			const {submission, publications} = await pkpApi.createSubmission(
				submissionPublished({tag}),
			);

			const doiPage = new DoiManagementPage(page, 'publicknowledge');
			await doiPage.goto();
			await doiPage.search('submission', tag);
			await doiPage.expandItem('submission', submission.id);

			const item = doiPage.item('submission', submission.id);
			const input = doiPage.publicationDoiInput(
				submission.id,
				publications[0].id,
			);
			await expect(input).toHaveValue(/^10\.1234\//);

			// Tag-unique suffix so the edited value can't collide with any
			// parallel test's DOI (DOIs are unique per context).
			const customDoi = `10.1234/${tag}-custom`;

			await item.getByRole('button', {name: 'Edit', exact: true}).click();
			await input.fill(customDoi);

			// Save PUTs /api/v1/dois/{doiId}, then the panel re-fetches the
			// submission to refresh the item in place (no page reload).
			const doiPut = page.waitForResponse(
				(res) => /\/api\/v1\/dois\/\d+$/.test(res.url()) && res.ok(),
			);
			const itemRefresh = page.waitForResponse(
				(res) =>
					res.url().includes(`/api/v1/submissions/${submission.id}`) &&
					res.request().method() === 'GET' &&
					res.ok(),
			);
			await item.getByRole('button', {name: 'Save', exact: true}).click();
			await doiPut;
			await itemRefresh;
			await expect(input).toHaveValue(customDoi);

			// Reader half: the anonymous article landing page renders the
			// edited DOI (explicit empty storageState — the default
			// context here is authenticated as dbarnes).
			const anon = await browser.newContext({
				baseURL,
				storageState: {cookies: [], origins: []},
			});
			try {
				const anonPage = await anon.newPage();
				const resp = await anonPage.goto(
					`/index.php/publicknowledge/article/view/${submission.id}`,
				);
				expect(resp?.status()).toBe(200);
				const doiSection = anonPage.locator('section.item.doi');
				await expect(doiSection).toBeVisible();
				await expect(doiSection).toContainText(customDoi);
			} finally {
				await anon.close();
			}
		},
	);

	test(
		'issue DOIs: Issues tab lists the issue, bulk-assign mints its DOI, and the anonymous issue TOC renders it',
		{tag: '@regression'},
		async ({page, pkpApi, browser, baseURL}) => {
			const tag = uniqueTag(test.info(), 'iss');
			const prefix = '10.9999';

			const {context} = await pkpApi.createJournal({
				tag,
				enableDois: true,
				doiPrefix: prefix,
				enabledDoiTypes: ['publication', 'issue'],
				users: [{username: 'dbarnes', roles: ['manager']}],
				issues: [{...SCRATCH_ISSUE, published: true}],
			});

			// Resolve the seeded issue's id via the REST API (the journal
			// scenario response doesn't echo issue ids).
			const issuesResp = await page.request.get(
				`/index.php/${context.path}/api/v1/issues`,
			);
			expect(issuesResp.ok()).toBeTruthy();
			const issues = (await issuesResp.json()).items ?? [];
			expect(issues.length).toBe(1);
			const issueId = issues[0].id;

			const doiPage = new DoiManagementPage(page, context.path);
			await doiPage.goto();

			// Both DOI types enabled → both tabs render.
			await expect(doiPage.submissionsTabButton).toBeVisible();
			await expect(doiPage.issuesTabButton).toBeVisible();
			await doiPage.gotoIssuesTab();

			const item = doiPage.item('issue', issueId);
			await expect(item).toBeVisible();
			// Issues never auto-mint — fresh issue needs a DOI.
			await expect(doiPage.badge('issue', issueId)).toHaveText('Needs DOI');

			await doiPage.selectItem('issue', issueId);
			await doiPage.bulkAction('issue', 'Assign DOIs', 'assignDois');

			await doiPage.expandItem('issue', issueId);
			const doiInput = doiPage.issueDoiInput(issueId);
			await expect(doiInput).toHaveValue(
				new RegExp(`^${escapeRegex(prefix)}/`),
			);
			const issueDoi = await doiInput.inputValue();

			// Anonymous reader: the issue TOC renders the DOI resolving
			// link (templates/frontend/objects/issue_toc.tpl .pub_id.doi).
			const anon = await browser.newContext({
				baseURL,
				storageState: {cookies: [], origins: []},
			});
			try {
				const anonPage = await anon.newPage();
				const resp = await anonPage.goto(
					`/index.php/${context.path}/issue/view/${issueId}`,
				);
				expect(resp?.status()).toBe(200);
				const doiDiv = anonPage.locator('.pub_id.doi');
				await expect(doiDiv).toBeVisible();
				await expect(doiDiv).toContainText(issueDoi);
				await expect(
					doiDiv.getByRole('link', {name: new RegExp(escapeRegex(issueDoi))}),
				).toHaveAttribute('href', `https://doi.org/${issueDoi}`);
			} finally {
				await anon.close();
			}
		},
	);

	test(
		'custom suffix pattern configured via the UI drives newly minted DOIs',
		{tag: '@regression'},
		async ({page, pkpApi}) => {
			const tag = uniqueTag(test.info(), 'pat');
			const prefix = '10.9999';

			// publicationCreationTime: pattern-based minting requires the
			// publication's issue assignment, which only exists by publish
			// time (mint-at-production would soft-fail with
			// PUBLICATION_MISSING_ISSUE). The acronym feeds the pattern's
			// %j token.
			const {context} = await pkpApi.createJournal({
				tag,
				enableDois: true,
				doiPrefix: prefix,
				doiCreationTime: 'publicationCreationTime',
				acronym: {en: 'E2EJ'},
				users: [{username: 'dbarnes', roles: ['manager']}],
				issues: [{...SCRATCH_ISSUE, published: true}],
			});

			// Distribution → DOIs: pick the custom-pattern suffix type; the
			// pattern fields are revealed by the showWhen group toggle.
			await page.goto(
				`/index.php/${context.path}/management/settings/distribution`,
			);
			await page.locator('#dois-button').click();
			const form = page.locator('form#doisSetup, #doisSetup form').first();
			await expect(form).toBeVisible();

			const patternField = form.locator(
				'input[name="doiPublicationSuffixPattern"]',
			);
			await expect(patternField).toBeHidden();
			await form
				.locator('input[name="doiSuffixType"][value="customPattern"]')
				.check();
			await expect(patternField).toBeVisible();

			// %j = journal initials (lowercased acronym), %v/%i = volume/
			// issue number, %Y = year (PubIdPlugin::generateCustomPattern).
			const pattern = 'e2e-%j.v%vi%i.%Y';
			await patternField.fill(pattern);
			await Promise.all([
				page.waitForResponse(
					(res) =>
						/\/api\/v1\/contexts\/\d+/.test(res.url()) &&
						res.ok() &&
						['POST', 'PUT'].includes(res.request().method()),
				),
				form.getByRole('button', {name: 'Save', exact: true}).click(),
			]);

			// Persistence proves the round-trip.
			await page.reload();
			await page.locator('#dois-button').click();
			const reloaded = page.locator('form#doisSetup, #doisSetup form').first();
			await expect(reloaded).toBeVisible();
			await expect(
				reloaded.locator('input[name="doiSuffixType"][value="customPattern"]'),
			).toBeChecked();
			await expect(
				reloaded.locator('input[name="doiPublicationSuffixPattern"]'),
			).toHaveValue(pattern);

			// A submission published AFTER the pattern was saved mints its
			// DOI from the pattern: %j → 'e2ej', %v → 1, %i → 1, %Y → 2026.
			const spec = submissionPublished({tag});
			spec.journal = context.path;
			spec.publications[0].issue = {...SCRATCH_ISSUE};
			const {submission} = await pkpApi.createSubmission(spec);

			const resp = await page.request.get(
				`/index.php/${context.path}/api/v1/submissions/${submission.id}`,
			);
			expect(resp.ok()).toBeTruthy();
			const body = await resp.json();
			const currentPub = body.publications.find(
				(p) => p.id === body.currentPublicationId,
			);
			expect(currentPub.doiObject, 'publication DOI minted').toBeTruthy();
			expect(currentPub.doiObject.doi).toBe(
				`${prefix}/e2e-e2ej.v${SCRATCH_ISSUE.volume}i${SCRATCH_ISSUE.number}.${SCRATCH_ISSUE.year}`,
			);
		},
	);
});

/**
 * Per-run-random tag scoped to worker + suffix. The random component
 * matters on the shared publicknowledge /dois surface: a long-lived
 * local DB accumulates items from previous runs, and search-by-tag is
 * the only isolation these tests have (patterns.md lesson 10).
 *
 * @param {import('@playwright/test').TestInfo} info
 * @param {string} suffix
 */
function uniqueTag(info, suffix) {
	// Journal urlPath is varchar(32) (path = `j-{alnum(tag)}`); stay short.
	const rand = Math.random().toString(36).slice(2, 6);
	return `dm-w${info.parallelIndex}-${suffix}-${rand}`;
}

/**
 * Escape a string for inclusion in a RegExp.
 *
 * @param {string} s
 */
function escapeRegex(s) {
	return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
