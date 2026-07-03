// @ts-check
const {test, expect} = require('../support/fixtures.js');
const {
	DashboardPage,
} = require('../../lib/pkp/playwright/pages/DashboardPage.js');

/**
 * Workflow stage navigation (the workflow-page shell) — one test per
 * canonical scenario of docs/product/specs/workflow-stage-navigation.md
 * (6 scenarios).
 *
 * Placement: OJS root — the assertions lean on the OJS stage set (no
 * internal review), the OJS menu/pane configs (WorkflowPageOJS) and the
 * publicknowledge journal, even though the shell ships from pkp-lib.
 *
 * Live-probed realities encoded here (2026-07-03, curl + seeded probes):
 *   - Legacy stage paths hop twice: workflow/{stagePath}/{id} 302s to
 *     workflow/index/{id}/{stageId}, which 302s to
 *     dashboard/editorial?workflowSubmissionId={id}.
 *   - Every legacy-URL refusal (wrong role AND inaccessible stage) is a
 *     302 to user/authorizationDenied?message=
 *     user.authorization.accessibleWorkflowStage.
 *   - Stage-less workflow/index/{id} is HTTP 500 (known deviation,
 *     e2e ledger §2 row 70) — asserted as-built.
 *   - Unknown submission id on a shim is a 404.
 *
 * Parallel-safety: tags are single hyphenless purely-alphabetic tokens
 * riding in every title; list assertions are tag-scoped and
 * response-bounded (searchAndSettle); deep links use the ids returned by
 * the scenario API. Read-only shell — no Mailpit use.
 */

const STAGE_DENIED =
	"You don't currently have access to that stage of the workflow.";
const ROLE_DENIED =
	'The current role does not have access to this operation.';

/** A unique, hyphenless, letters-only tag (parallel isolation). */
function uniqueTag() {
	const workerLetter = String.fromCharCode(
		97 + (test.info().parallelIndex % 26),
	);
	let suffix = '';
	while (suffix.length < 6) {
		suffix += Math.random().toString(36).replace(/[^a-z]/g, '');
	}
	return `wsnav${workerLetter}${suffix.slice(0, 6)}`;
}

/**
 * Base scenario spec: a submitted stage-1 submission (legacy shape — no
 * submit event, so no auto-assigned section editors beyond `participants`).
 *
 * @param {{tag: string, title: string, submitter?: string, participants?: object[]}} opts
 */
function submittedSpec({
	tag,
	title,
	submitter = 'atester',
	participants = [{user: 'dbarnes', role: 'editor'}],
}) {
	return {
		tag,
		journal: 'publicknowledge',
		submitter,
		section: 'ART',
		locale: 'en',
		participants,
		publications: [{metadata: {title: {en: title}}}],
	};
}

/**
 * In external review, round 1, jjanssen accepted (atester submitting —
 * both then hold a personal tie to the submission for the outsider
 * refusals of scenario 5).
 *
 * @param {{tag: string, title: string}} opts
 */
function inReviewSpec({tag, title}) {
	return {
		...submittedSpec({tag, title}),
		decisions: [{type: 'sendExternalReview', by: 'dbarnes'}],
		reviewRounds: [
			{
				reviewers: [
					{user: 'jjanssen', method: 'anonymous', status: 'accepted'},
				],
			},
		],
	};
}

/** The workflow side modal (outer wrapper reports visibility:hidden — scope only). */
function workflowModal(page) {
	return page.locator('[data-cy="active-modal"]').first();
}

/** The modal header: submission id, authors, title, stage bubble, buttons. */
function modalHeader(page) {
	return page.locator('[data-cy="sidemodal-header"]');
}

/** The workflow/publication side menu inside the modal. */
function menuNav(page) {
	return workflowModal(page).locator('nav').first();
}

/**
 * A side-menu entry by its exact label. Menu items are `<a>` elements
 * wrapping a `<span>` label (SideMenu.vue); `:text-is` keeps 'Review'
 * from matching 'Review Round 1'.
 *
 * @param {import('@playwright/test').Page} page
 * @param {string} label
 */
function menuItem(page, label) {
	return menuNav(page).locator(`a:has(span:text-is("${label}"))`);
}

/** The editorial-dashboard deep link that mounts the workflow modal. */
function deepLink(submissionId, workflowMenuKey) {
	const key = workflowMenuKey ? `&workflowMenuKey=${workflowMenuKey}` : '';
	return `/index.php/publicknowledge/en/dashboard/editorial?workflowSubmissionId=${submissionId}${key}`;
}

/**
 * Search the dashboard list and wait for the tag-scoped fetch to land.
 *
 * @param {import('@playwright/test').Page} page
 * @param {DashboardPage} dashboard
 * @param {string} token
 */
async function searchAndSettle(page, dashboard, token) {
	await Promise.all([
		page.waitForResponse(
			(res) =>
				res.url().includes('/api/v1/_submissions') &&
				res.url().includes(`searchPhrase=${token}`) &&
				res.ok(),
			{timeout: 20_000},
		),
		dashboard.search(token),
	]);
}

/**
 * Issue a request and report its immediate redirect, without following.
 *
 * @param {import('@playwright/test').APIRequestContext} request
 * @param {string} path
 */
async function redirectOf(request, path) {
	const res = await request.get(path, {maxRedirects: 0});
	return {status: res.status(), location: res.headers()['location'] || ''};
}

test.use({user: 'dbarnes'});

test.describe('Workflow stage navigation', () => {
	// Canonical scenario 1 — dbarnes clicks View on a round-2 submission:
	// the side modal shows ID/authors/title, a "Review (Round 2)" bubble,
	// Activity Log + Library buttons; the menu lists the four stages with
	// Review expanded into Round 1/Round 2 (stage-coloured stripe on the
	// current round) and a Publication group with all version tabs +
	// Create New Version; the URL carries the current-round pane key.
	test(
		'editor opens a submission in review',
		{tag: ['@smoke', '@regression']},
		async ({page, pkpApi}) => {
			const tag = uniqueTag();
			const title = `Roundtwo${tag}`;
			const seeded = await pkpApi.createSubmission({
				...submittedSpec({tag, title}),
				decisions: [
					{type: 'sendExternalReview', by: 'dbarnes'},
					{type: 'requestRevisions', by: 'dbarnes'},
					{type: 'newExternalRound', by: 'dbarnes'},
				],
				reviewRounds: [
					{
						reviewers: [
							{
								user: 'phudson',
								method: 'anonymous',
								status: 'completed',
								recommendation: 'pendingRevisions',
							},
						],
					},
					{
						reviewers: [
							{user: 'jjanssen', method: 'anonymous', status: 'invited'},
						],
					},
				],
			});
			const submissionId = seeded.submission.id;
			const round2Id = seeded.reviewRounds[1].roundId;

			const dashboard = new DashboardPage(page);
			await dashboard.gotoEditorial({view: 'active'});
			await expect(dashboard.viewHeading(/Active submissions/)).toBeVisible({
				timeout: 20_000,
			});
			await searchAndSettle(page, dashboard, tag);
			const row = dashboard.row(title);
			await expect(row).toBeVisible({timeout: 20_000});
			await row.getByRole('button', {name: 'View', exact: true}).click();

			// The URL now carries submission + current-round pane key.
			await page.waitForURL(
				new RegExp(`workflowMenuKey=workflow_3_${round2Id}(&|$)`),
				{timeout: 20_000, waitUntil: 'commit'},
			);
			await expect(page).toHaveURL(
				new RegExp(`workflowSubmissionId=${submissionId}(&|$)`),
			);

			// Header: pre-title = submission ID, title = authors short
			// string, description = full title, stage bubble, header buttons.
			const header = modalHeader(page);
			// The pre-title text node shares its element with the refresh
			// spinner, so containment (not exact text) is the right shape.
			await expect(header).toContainText(String(submissionId), {
				timeout: 20_000,
			});
			await expect(header.getByText(/Tester/)).toBeVisible();
			await expect(header.getByText(title)).toBeVisible();
			await expect(
				header.getByText('Review (Round 2)', {exact: true}),
			).toBeVisible();
			await expect(
				header.getByRole('button', {name: 'Activity Log', exact: true}),
			).toBeVisible();
			await expect(
				header.getByRole('button', {name: 'Library', exact: true}),
			).toBeVisible();

			// The Workflow group: four OJS stages in order, Review expanded
			// into its two rounds (oldest first), Publication group below.
			const nav = menuNav(page);
			await expect(nav).toContainText(
				/Submission[\s\S]*Review[\s\S]*Review Round 1[\s\S]*Review Round 2[\s\S]*Copyediting[\s\S]*Production[\s\S]*Publication/,
			);

			// The stage-coloured stripe decorates the current stage and the
			// current round only.
			await expect(menuItem(page, 'Review Round 2')).toHaveClass(
				/border-stage-in-review/,
			);
			await expect(menuItem(page, 'Review')).toHaveClass(
				/border-stage-in-review/,
			);
			await expect(menuItem(page, 'Review Round 1')).not.toHaveClass(
				/border-stage/,
			);
			await expect(menuItem(page, 'Submission')).not.toHaveClass(
				/border-stage/,
			);

			// The Publication group: the full editorial tab set for a
			// manager-scope editor on publicknowledge (References present —
			// citations enabled; Data/Identifiers are settings-gated and off)
			// plus Create New Version (manager publish authority).
			for (const label of [
				'Title & Abstract',
				'Contributors',
				'Metadata',
				'References',
				'JATS XML',
				'Body Text',
				'Galleys',
				'Media',
				'Permissions & Disclosure',
				'Publication Settings',
				'Create New Version',
			]) {
				await expect(menuItem(page, label)).toBeVisible();
			}
		},
	);

	// Canonical scenario 2 — one submission per state, opened without a
	// menu key: submission-stage and copyediting/production-queued open on
	// their stage pane; in-review and declined-in-review open on the
	// current round; scheduled and published open on Publication → Title &
	// Abstract — each with the matching stage bubble.
	test(
		'the default pane follows the state',
		{tag: '@regression'},
		async ({page, pkpApi}) => {
			test.slow(); // 7 scenario seeds + 7 modal loads
			const tag = uniqueTag();

			const submission = await pkpApi.createSubmission(
				submittedSpec({tag, title: `Subm${tag}`}),
			);
			const inReview = await pkpApi.createSubmission(
				inReviewSpec({tag, title: `Inrev${tag}`}),
			);
			const copyediting = await pkpApi.createSubmission({
				...submittedSpec({tag, title: `Coped${tag}`}),
				decisions: [{type: 'skipExternalReview', by: 'dbarnes'}],
			});
			const production = await pkpApi.createSubmission({
				...submittedSpec({tag, title: `Prodn${tag}`}),
				decisions: [
					{type: 'skipExternalReview', by: 'dbarnes'},
					{type: 'sendToProduction', by: 'dbarnes'},
				],
			});
			const declined = await pkpApi.createSubmission({
				...inReviewSpec({tag, title: `Decld${tag}`}),
				decisions: [
					{type: 'sendExternalReview', by: 'dbarnes'},
					{type: 'decline', by: 'dbarnes'},
				],
			});
			/** Production + published into the given issue. */
			const publishedSpec = (title, issue) => ({
				...submittedSpec({tag, title}),
				decisions: [
					{type: 'skipExternalReview', by: 'dbarnes'},
					{type: 'sendToProduction', by: 'dbarnes'},
				],
				publications: [
					{
						versionStage: 'VoR',
						metadata: {title: {en: title}},
						issue,
						published: true,
					},
				],
			});
			const scheduled = await pkpApi.createSubmission(
				// The unpublished issue yields Scheduled.
				publishedSpec(`Sched${tag}`, {volume: 2, number: 1, year: 2015}),
			);
			const published = await pkpApi.createSubmission(
				// The published back issue yields Published.
				publishedSpec(`Publd${tag}`, {volume: 1, number: 2, year: 2014}),
			);

			/**
			 * Open the modal without a key and assert the rewritten pane key
			 * plus the stage bubble in the header.
			 *
			 * @param {number} id
			 * @param {string} expectedKey
			 * @param {string} bubble
			 */
			async function expectDefaultPane(id, expectedKey, bubble) {
				await page.goto(deepLink(id), {waitUntil: 'commit'});
				await expect(page).toHaveURL(
					new RegExp(`workflowMenuKey=${expectedKey}(&|$)`),
					{timeout: 20_000},
				);
				await expect(
					modalHeader(page).getByText(bubble, {exact: true}),
				).toBeVisible({timeout: 20_000});
			}

			await expectDefaultPane(
				submission.submission.id,
				'workflow_1',
				'Submission',
			);
			await expectDefaultPane(
				inReview.submission.id,
				`workflow_3_${inReview.reviewRounds[0].roundId}`,
				'Review (Round 1)',
			);
			await expectDefaultPane(
				copyediting.submission.id,
				'workflow_4',
				'Copyediting',
			);
			await expectDefaultPane(
				production.submission.id,
				'workflow_5',
				'Production',
			);
			await expectDefaultPane(
				declined.submission.id,
				`workflow_3_${declined.reviewRounds[0].roundId}`,
				'Declined',
			);
			await expectDefaultPane(
				scheduled.submission.id,
				`publication_${scheduled.publications[0].id}_titleAbstract`,
				'Scheduled',
			);
			await expectDefaultPane(
				published.submission.id,
				`publication_${published.publications[0].id}_titleAbstract`,
				'Published',
			);
		},
	);

	// Canonical scenario 3 — workflowMenuKey is the pane address: clicking
	// any menu item rewrites the key in place, a copied URL reopens the
	// same submission and pane, a valid key deep-links straight to its
	// pane, and an unknown key silently falls back to the state default
	// with the URL corrected.
	test(
		'deep links share the exact pane',
		{tag: ['@smoke', '@regression']},
		async ({page, pkpApi}) => {
			const tag = uniqueTag();
			const title = `Deeplink${tag}`;
			const seeded = await pkpApi.createSubmission(
				inReviewSpec({tag, title}),
			);
			const id = seeded.submission.id;
			const roundId = seeded.reviewRounds[0].roundId;
			const pubId = seeded.publications[0].id;

			// Opening without a key lands on the state default (current
			// round) and the URL records it.
			await page.goto(deepLink(id), {waitUntil: 'commit'});
			await expect(page).toHaveURL(
				new RegExp(`workflowMenuKey=workflow_3_${roundId}(&|$)`),
				{timeout: 20_000},
			);
			await expect(
				workflowModal(page).getByRole('heading', {
					name: 'Workflow: Review (Round 1)',
				}),
			).toBeVisible({timeout: 20_000});

			// Every menu click rewrites the key in place — a stage pane…
			await menuItem(page, 'Copyediting').click();
			await expect(page).toHaveURL(/workflowMenuKey=workflow_4(&|$)/);
			await expect(
				workflowModal(page).getByRole('heading', {
					name: 'Workflow: Copyediting',
				}),
			).toBeVisible();

			// …and a publication tab.
			await menuItem(page, 'Title & Abstract').click();
			await expect(page).toHaveURL(
				new RegExp(`workflowMenuKey=publication_${pubId}_titleAbstract(&|$)`),
			);
			await expect(
				workflowModal(page).getByRole('heading', {
					name: 'Publication: Title & Abstract',
				}),
			).toBeVisible();

			// The copied URL reproduces submission + pane on a fresh load.
			const shared = page.url();
			await page.goto(shared, {waitUntil: 'commit'});
			await expect(
				workflowModal(page).getByRole('heading', {
					name: 'Publication: Title & Abstract',
				}),
			).toBeVisible({timeout: 20_000});
			await expect(page).toHaveURL(
				new RegExp(`workflowSubmissionId=${id}(&|$)`),
			);

			// A valid key deep-links straight to its pane (a non-current
			// stage, even).
			await page.goto(deepLink(id, 'workflow_1'), {waitUntil: 'commit'});
			await expect(
				workflowModal(page).getByRole('heading', {
					name: 'Workflow: Submission',
				}),
			).toBeVisible({timeout: 20_000});
			await expect(page).toHaveURL(/workflowMenuKey=workflow_1(&|$)/);

			// An unknown key falls back to the state default and the URL is
			// corrected.
			await page.goto(deepLink(id, 'bogus_key_zz'), {waitUntil: 'commit'});
			await expect(page).toHaveURL(
				new RegExp(`workflowMenuKey=workflow_3_${roundId}(&|$)`),
				{timeout: 20_000},
			);
			await expect(
				workflowModal(page).getByRole('heading', {
					name: 'Workflow: Review (Round 1)',
				}),
			).toBeVisible();
		},
	);

	// Canonical scenario 4 — mfritz (Copyeditor, stage-4 group) on a
	// copyediting-stage submission: the Copyediting pane fully renders,
	// the header has Preview/Library but no Activity Log, the Publication
	// submenu ends after JATS XML; every other stage item stays clickable
	// but shows only the no-access sentence — and when the same cast's
	// submission sits in Production, the modal OPENS onto that message.
	test(
		'assistant sees only their stage',
		{tag: '@regression'},
		async ({pkpApi, asUser}) => {
			test.slow(); // two seeds + five pane switches in a second context
			const tag = uniqueTag();
			const cast = [
				{user: 'dbarnes', role: 'editor'},
				{user: 'mfritz', role: 'copyeditor'},
			];
			const copyediting = await pkpApi.createSubmission({
				...submittedSpec({tag, title: `Coped${tag}`, participants: cast}),
				decisions: [{type: 'skipExternalReview', by: 'dbarnes'}],
			});
			const production = await pkpApi.createSubmission({
				...submittedSpec({tag, title: `Prodn${tag}`, participants: cast}),
				decisions: [
					{type: 'skipExternalReview', by: 'dbarnes'},
					{type: 'sendToProduction', by: 'dbarnes'},
				],
			});

			const ctx = await asUser('mfritz');
			const page = await ctx.newPage();
			await page.goto(deepLink(copyediting.submission.id), {
				waitUntil: 'commit',
			});
			await expect(page).toHaveURL(/workflowMenuKey=workflow_4(&|$)/, {
				timeout: 20_000,
			});

			// The accessible stage pane fully renders: pane heading, panels
			// (participants in the secondary column), no denial sentence.
			const modal = workflowModal(page);
			await expect(
				modal.getByRole('heading', {name: 'Workflow: Copyediting'}),
			).toBeVisible({timeout: 20_000});
			await expect(
				modal.locator('[data-cy="participant-manager"]'),
			).toBeVisible({timeout: 20_000});
			await expect(modal.getByText(STAGE_DENIED)).toHaveCount(0);

			// Header: Preview + Library, but no Activity Log for an
			// assistant.
			const header = modalHeader(page);
			await expect(
				header.getByRole('button', {name: 'Preview', exact: true}),
			).toBeVisible();
			await expect(
				header.getByRole('button', {name: 'Library', exact: true}),
			).toBeVisible();
			await expect(
				header.getByRole('button', {name: 'Activity Log'}),
			).toHaveCount(0);

			// The Publication submenu ends after JATS XML — the
			// production-gated tabs and Create New Version are absent.
			for (const label of [
				'Title & Abstract',
				'Contributors',
				'Metadata',
				'References',
				'JATS XML',
			]) {
				await expect(menuItem(page, label)).toBeVisible();
			}
			for (const label of [
				'Body Text',
				'Galleys',
				'Media',
				'Permissions & Disclosure',
				'Publication Settings',
				'Create New Version',
			]) {
				await expect(menuItem(page, label)).toHaveCount(0);
			}

			// Every other stage item stays visible and clickable, the URL
			// records the selection, and the pane shows only the no-access
			// sentence — no panels, no action buttons, no secondary column.
			for (const [label, key] of [
				['Submission', 'workflow_1'],
				['Review', 'workflow_3'],
				['Production', 'workflow_5'],
			]) {
				await menuItem(page, label).click();
				await expect(page).toHaveURL(
					new RegExp(`workflowMenuKey=${key}(&|$)`),
				);
				await expect(modal.getByText(STAGE_DENIED)).toBeVisible({
					timeout: 20_000,
				});
				await expect(
					modal.locator('[data-cy="workflow-action-items"]'),
				).toHaveCount(0);
				await expect(
					modal.locator('[data-cy="workflow-secondary-items"]'),
				).toHaveCount(0);
				await expect(
					modal.locator('[data-cy="participant-manager"]'),
				).toHaveCount(0);
			}

			// On the production-stage sibling, the modal OPENS onto the
			// no-access message (state default workflow_5 is honoured even
			// though it only yields the denial).
			await page.goto(deepLink(production.submission.id), {
				waitUntil: 'commit',
			});
			await expect(page).toHaveURL(/workflowMenuKey=workflow_5(&|$)/, {
				timeout: 20_000,
			});
			await expect(
				workflowModal(page).getByText(STAGE_DENIED),
			).toBeVisible({timeout: 20_000});
		},
	);

	// Canonical scenario 5 — outsiders cannot open the submission at all:
	// minoue (unassigned section editor) deep-links the modal and gets an
	// empty shell + the role-denied error; atester (author) and jjanssen
	// (reviewer) are refused the legacy workflow URLs even on their own
	// submission; anonymous users are sent to login and return.
	test(
		'outsiders cannot open the submission at all',
		{tag: '@regression'},
		async ({browser, baseURL, pkpApi, asUser}) => {
			test.slow(); // four actors
			const tag = uniqueTag();
			const title = `Outsider${tag}`;
			// atester submits, jjanssen reviews — their legacy-URL refusals
			// below are "even on their own submission".
			const seeded = await pkpApi.createSubmission(
				inReviewSpec({tag, title}),
			);
			const id = seeded.submission.id;

			// minoue: the modal shell opens empty — the submission fetch is
			// refused with the role-denied error and no stage menu renders.
			const minoueCtx = await asUser('minoue');
			const minouePage = await minoueCtx.newPage();
			await minouePage.goto(deepLink(id), {waitUntil: 'commit'});
			await expect(minouePage.getByText(ROLE_DENIED)).toBeVisible({
				timeout: 20_000,
			});
			await expect(menuItem(minouePage, 'Copyediting')).toHaveCount(0);
			await expect(
				modalHeader(minouePage).getByText(title),
			).toHaveCount(0);

			// Author and reviewer: every legacy door bounces to the
			// authorizationDenied page (live-probed shape).
			for (const username of ['atester', 'jjanssen']) {
				const ctx = await asUser(username);
				for (const op of [
					`workflow/access/${id}`,
					`workflow/submission/${id}`,
				]) {
					const {status, location} = await redirectOf(
						ctx.request,
						`/index.php/publicknowledge/en/${op}`,
					);
					expect(status, `${username} on ${op}`).toBe(302);
					expect(location, `${username} on ${op}`).toContain(
						'authorizationDenied',
					);
				}
			}

			// Anonymous: sent to login with a return link; signing in lands
			// inside the dashboard modal for the requested submission.
			const anonCtx = await browser.newContext({
				baseURL,
				storageState: {cookies: [], origins: []},
			});
			const anonPage = await anonCtx.newPage();
			await anonPage.goto(
				`/index.php/publicknowledge/en/workflow/access/${id}`,
				{waitUntil: 'commit'},
			);
			await anonPage.waitForURL(/\/login\?source=/, {
				timeout: 20_000,
				waitUntil: 'commit',
			});
			await anonPage.locator('input#username').fill('dbarnes');
			await anonPage.locator('input#password').fill('dbarnesdbarnes');
			await anonPage.locator('form#login button').click();
			await anonPage.waitForURL(
				new RegExp(`workflowSubmissionId=${id}(&|$)`),
				{timeout: 20_000, waitUntil: 'commit'},
			);
			await expect(
				modalHeader(anonPage).getByText(title),
			).toBeVisible({timeout: 20_000});
			await anonCtx.close();
		},
	);

	// Canonical scenario 6 — the legacy workflow/* URLs collapse into the
	// dashboard: access + index/{id}/{stage} + the four stage paths each
	// 302 into the dashboard modal (stage paths via an index hop),
	// enforcing per-stage access first (mfritz passes editorial, is
	// refused submission); the named stage is dropped in favour of the
	// state default; the stage-less index form 500s (known deviation) and
	// an unknown id 404s.
	test(
		'legacy workflow URLs collapse into the dashboard',
		{tag: '@regression'},
		async ({page, pkpApi, asUser}) => {
			test.slow(); // a dozen redirect probes + one full modal load
			const tag = uniqueTag();
			const seeded = await pkpApi.createSubmission({
				...submittedSpec({
					tag,
					title: `Legacy${tag}`,
					participants: [
						{user: 'dbarnes', role: 'editor'},
						{user: 'mfritz', role: 'copyeditor'},
					],
				}),
				decisions: [{type: 'skipExternalReview', by: 'dbarnes'}],
			});
			const id = seeded.submission.id;
			const base = '/index.php/publicknowledge/en';
			const dashboardTarget = `dashboard/editorial?workflowSubmissionId=${id}`;

			// Manager scope (dbarnes): access 302s straight to the modal.
			const access = await redirectOf(
				page.request,
				`${base}/workflow/access/${id}`,
			);
			expect(access.status).toBe(302);
			expect(access.location).toContain(dashboardTarget);

			// The four stage paths hop via index/{id}/{stageId}, which 302s
			// to the modal — authorization per stage passes for a manager.
			for (const [op, stageId] of [
				['submission', 1],
				['externalReview', 3],
				['editorial', 4],
				['production', 5],
			]) {
				const hop1 = await redirectOf(
					page.request,
					`${base}/workflow/${op}/${id}`,
				);
				expect(hop1.status, `workflow/${op}`).toBe(302);
				expect(hop1.location, `workflow/${op}`).toContain(
					`workflow/index/${id}/${stageId}`,
				);
				const hop2 = await redirectOf(
					page.request,
					`${base}/workflow/index/${id}/${stageId}`,
				);
				expect(hop2.status, `workflow/index/${id}/${stageId}`).toBe(302);
				expect(hop2.location, `workflow/index/${id}/${stageId}`).toContain(
					dashboardTarget,
				);
			}

			// The stage named in the URL is dropped: an old submission-stage
			// link opens the modal on the state default (copyediting), not
			// the named stage.
			await page.goto(`${base}/workflow/submission/${id}`, {
				waitUntil: 'commit',
			});
			await page.waitForURL(new RegExp(`workflowSubmissionId=${id}(&|$)`), {
				timeout: 20_000,
				waitUntil: 'commit',
			});
			await expect(page).toHaveURL(/workflowMenuKey=workflow_4(&|$)/, {
				timeout: 20_000,
			});
			await expect(
				workflowModal(page).getByRole('heading', {
					name: 'Workflow: Copyediting',
				}),
			).toBeVisible({timeout: 20_000});

			// Assigned scope (mfritz, Copyeditor): allowed through the door
			// of his stage, refused the stage he cannot access — before any
			// redirect.
			const mfritzCtx = await asUser('mfritz');
			const allowed = await redirectOf(
				mfritzCtx.request,
				`${base}/workflow/editorial/${id}`,
			);
			expect(allowed.status).toBe(302);
			expect(allowed.location).toContain(`workflow/index/${id}/4`);
			const refused = await redirectOf(
				mfritzCtx.request,
				`${base}/workflow/submission/${id}`,
			);
			expect(refused.status).toBe(302);
			expect(refused.location).toContain('authorizationDenied');
			expect(refused.location).toContain(
				'user.authorization.accessibleWorkflowStage',
			);

			// Known deviation (ledger §2 row 70), asserted as-built: the
			// stage-less index form crashes instead of redirecting.
			const stageless = await page.request.get(
				`${base}/workflow/index/${id}`,
				{maxRedirects: 0},
			);
			expect(stageless.status()).toBe(500);

			// An unknown submission is a 404.
			const missing = await page.request.get(
				`${base}/workflow/access/99999999`,
				{maxRedirects: 0},
			);
			expect(missing.status()).toBe(404);
		},
	);
});
