// @ts-check
const {test, expect} = require('../support/fixtures.js');
const {
	DashboardPage,
} = require('../../lib/pkp/playwright/pages/DashboardPage.js');

/**
 * Editorial dashboards — one test per canonical scenario of
 * docs/product/specs/editorial-dashboards.md (11 scenarios).
 *
 * Placement: OJS root — the assertions lean on the publicknowledge
 * journal (sections/issues), OJS view naming and the OJS filters form,
 * even though the page machinery ships from pkp-lib.
 *
 * Seeding notes (live-probed 2026-07-03):
 *   - "legacy shape" (no `submitted` key, no decisions) = submitted-
 *     looking stage-1 row WITHOUT firing SubmissionSubmitted — so no
 *     AssignEditors auto-assignment. `participants: []` on that shape is
 *     the only way to seed a genuinely unassigned (needs-editor)
 *     submission in publicknowledge.
 *   - Any seed with decisions/reviewRounds fires submit(), which
 *     auto-assigns the section's editors (ART: dbarnes, dbuskins,
 *     sberardo) on top of the spec's participants.
 *   - The conflict-of-interest guards (rule 8) key off stage-assignment
 *     ROLES, which resolve only for users actually enrolled in the
 *     assignment's user group — the scenario-8 scratch-journal manager
 *     therefore also gets the `author` role (the real wizard grants it
 *     on first submission; the scenario builder does not).
 *
 * Parallel-safety: tags are single hyphenless PURELY-ALPHABETIC tokens
 * (a numeric ID search must never collide with a digit inside a sibling
 * seed's tag) riding in every title; list assertions are tag-scoped and
 * response-bounded (searchAndSettle); nav counts are asserted as "some
 * number", never a fixed one (warm DB). No Mailpit use — the dashboards
 * are read surfaces.
 */

const ROLE_DENIED =
	'The current role does not have access to this operation.';

// The 15 manager-scope views: [nav label, view id], in canonical order.
const EDITOR_VIEWS = [
	['Assigned to me', 'assigned-to-me'],
	['Active submissions', 'active'],
	['Needs editor', 'needs-editor'],
	['All in submission stage', 'initial-review'],
	['Needs reviews', 'needs-reviews'],
	['Awaiting reviews', 'awaiting-reviews'],
	['Reviews submitted', 'reviews-submitted'],
	['Reviews overdue', 'reviews-overdue'],
	['Author revisions submitted', 'revisions-submitted'],
	['All in review stage', 'external-review'],
	['All in copyediting stage', 'copyediting'],
	['All in production stage', 'production'],
	['Scheduled for publication', 'scheduled'],
	['Published', 'published'],
	['Declined', 'declined'],
];

// The 6 reviewer views: [nav label, view id], in canonical order.
const REVIEWER_VIEWS = [
	['Action Required by me', 'reviewer-action-required'],
	['All assignments', 'reviewer-assignments-all'],
	['Completed', 'reviewer-assignments-completed'],
	['Declined', 'reviewer-assignments-declined'],
	['Published', 'reviewer-assignments-published'],
	['Archived', 'reviewer-assignments-archived'],
];

/**
 * A nav view link scoped by dashboard op + view id — immune to label
 * collisions across nav groups (e.g. the author group's own Declined).
 *
 * @param {DashboardPage} dashboard
 * @param {string} op
 * @param {string} viewId
 */
function viewLink(dashboard, op, viewId) {
	return dashboard.nav.locator(
		`a[href*="dashboard/${op}?currentViewId=${viewId}"]`,
	);
}

/** A unique, hyphenless, letters-only tag (see header note). */
function uniqueTag() {
	const workerLetter = String.fromCharCode(
		97 + (test.info().parallelIndex % 26),
	);
	let suffix = '';
	while (suffix.length < 6) {
		suffix += Math.random().toString(36).replace(/[^a-z]/g, '');
	}
	return `eddash${workerLetter}${suffix.slice(0, 6)}`;
}

/**
 * Base scenario spec: a stage-1 submission in the legacy shape (no
 * submit event → no auto-assigned section editors; see header note).
 *
 * @param {{tag: string, title: string, submitter?: string, section?: string, journal?: string, participants?: object[]}} opts
 */
function submittedSpec({
	tag,
	title,
	submitter = 'atester',
	section = 'ART',
	journal = 'publicknowledge',
	participants = [{user: 'dbarnes', role: 'editor'}],
}) {
	return {
		tag,
		journal,
		submitter,
		section,
		locale: 'en',
		participants,
		publications: [{metadata: {title: {en: title}}}],
	};
}

/**
 * In external review, round 1, with one reviewer in the given state.
 *
 * @param {{tag: string, title: string, reviewer?: object}} opts
 */
function inReviewSpec({
	tag,
	title,
	reviewer = {user: 'jjanssen', method: 'anonymous', status: 'accepted'},
}) {
	return {
		...submittedSpec({tag, title}),
		decisions: [{type: 'sendExternalReview', by: 'dbarnes'}],
		reviewRounds: [{reviewers: [reviewer]}],
	};
}

/**
 * Production-stage spec; pass `issue` to publish into it — the
 * unpublished issue yields Scheduled, the published one Published.
 *
 * @param {{tag: string, title: string, issue?: object}} opts
 */
function productionSpec({tag, title, issue}) {
	return {
		...submittedSpec({tag, title}),
		decisions: [
			{type: 'skipExternalReview', by: 'dbarnes'},
			{type: 'sendToProduction', by: 'dbarnes'},
		],
		...(issue
			? {
					publications: [
						{
							versionStage: 'VoR',
							metadata: {title: {en: title}},
							issue,
							published: true,
						},
					],
				}
			: {}),
	};
}

/**
 * Search the dashboard list and wait for the tag-scoped fetch to land,
 * bounding subsequent absence assertions deterministically. Matches
 * both the journal-wide and the self-scoped list endpoints.
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

/** The count baked into the page heading, e.g. "Active submissions (212)". */
async function headingCount(page) {
	const text = await page
		.getByRole('heading', {level: 1})
		.first()
		.textContent();
	const match = (text || '').match(/\((\d+)\)/);
	if (!match) {
		throw new Error(`No count in dashboard heading: ${text}`);
	}
	return Number(match[1]);
}

/** The numeric ID cell of the first table row (NaN while loading). */
async function firstRowId(page) {
	const text = await page
		.locator('table tbody tr')
		.first()
		.locator('td, th')
		.first()
		.textContent({timeout: 5_000})
		.catch(() => '');
	return Number((text || '').trim());
}

test.use({user: 'dbarnes'});

test.describe('Editorial dashboards', () => {
	// Canonical scenario 1 — dbarnes (manager-level editor) opens
	// /dashboard/editorial: the Editor Dashboard nav group lists 15 views
	// with counts (in the fixed order) plus Start A New Submission, the
	// page lands on Assigned to me, the table is six columns, the
	// Filters / More Actions / Search controls render, and the seeded row
	// carries a View button.
	test(
		"manager's morning triage",
		{tag: ['@smoke', '@regression']},
		async ({page, pkpApi}) => {
			const tag = uniqueTag();
			const title = `Triage${tag}`;
			await pkpApi.createSubmission(submittedSpec({tag, title}));

			const dashboard = new DashboardPage(page);
			await dashboard.gotoEditorial();

			// Landing without a view falls back to the first one, and the
			// view id is recorded in the URL.
			await expect(dashboard.viewHeading(/Assigned to me/)).toBeVisible({
				timeout: 20_000,
			});
			await expect(page).toHaveURL(/currentViewId=assigned-to-me/);

			// The nav group: all 15 views, in the canonical order, each
			// with a live count badge, plus the Start A New Submission
			// entry.
			await expect(dashboard.nav).toContainText('Editor Dashboard');
			await expect(dashboard.viewLinks('editorial')).toHaveCount(15);
			await expect(dashboard.nav).toContainText(
				new RegExp(EDITOR_VIEWS.map(([label]) => label).join('[\\s\\S]*')),
			);
			for (const [label, viewId] of EDITOR_VIEWS) {
				const item = viewLink(dashboard, 'editorial', viewId);
				await expect(item).toBeVisible();
				await expect(item).toContainText(label);
				// Live count — some number, never a fixed one (warm DB).
				await expect(item).toContainText(/\d+/);
			}
			await expect(
				dashboard.nav
					.locator('a')
					.filter({hasText: /Start A New Submission/i}),
			).toBeVisible();

			// List controls.
			await expect(dashboard.filterButton).toBeVisible();
			await expect(
				page.getByRole('button', {name: 'More Actions'}),
			).toBeVisible();
			await expect(dashboard.searchInput).toBeVisible();

			// The editorial table is six columns (ID and Days sortable —
			// their accessible names carry the SR-only "Sort" suffix).
			await expect(page.getByRole('columnheader')).toHaveCount(6);
			for (const name of [
				'ID Sort',
				'Submissions',
				'Stage',
				'Days Sort',
				'Editorial Activity',
				'Actions',
			]) {
				await expect(
					page.getByRole('columnheader', {name, exact: true}),
				).toBeVisible();
			}

			// The seeded row (dbarnes holds the editor assignment, so it
			// lives in Assigned to me) carries a View button; the search
			// narrows the heading count to the fetched total.
			await searchAndSettle(page, dashboard, tag);
			const row = dashboard.row(title);
			await expect(row).toBeVisible({timeout: 20_000});
			await expect(
				row.getByRole('button', {name: 'View', exact: true}),
			).toBeVisible();
			await expect(dashboard.viewHeading(/Assigned to me \(1\)/)).toBeVisible();
		},
	);

	// Canonical scenario 2 — dbuskins (section editor) and mfritz
	// (assistant) get 13 views (no Needs editor, no Declined), every view
	// restricted to submissions they hold an assignment on: the seeded
	// unassigned submission is invisible to them even by direct search,
	// while the manager finds it.
	test(
		'scoped roles see only their desk',
		{tag: ['@smoke', '@regression']},
		async ({page, pkpApi, asUser}) => {
			test.slow(); // three actors, three dashboard loads
			const tag = uniqueTag();
			const unassignedTitle = `Nobody${tag}`;
			const assignedTitle = `Ourdesk${tag}`;
			await pkpApi.createSubmission(
				submittedSpec({tag, title: unassignedTitle, participants: []}),
			);
			await pkpApi.createSubmission(
				submittedSpec({
					tag,
					title: assignedTitle,
					participants: [
						{user: 'dbuskins', role: 'sectionEditor'},
						{user: 'mfritz', role: 'copyeditor'},
					],
				}),
			);

			// The manager sees the whole journal: 15 views, both rows.
			const dashboard = new DashboardPage(page);
			await dashboard.gotoEditorial({view: 'active'});
			await expect(
				dashboard.viewHeading(/Active submissions/),
			).toBeVisible({timeout: 20_000});
			await expect(dashboard.viewLinks('editorial')).toHaveCount(15);
			await searchAndSettle(page, dashboard, tag);
			await expect(dashboard.row(unassignedTitle)).toBeVisible({
				timeout: 20_000,
			});
			await expect(dashboard.row(assignedTitle)).toBeVisible();

			// Section editor and assistant: 13 views (no Needs editor, no
			// Declined) and only their assigned submission — the
			// unassigned one stays invisible even to a direct search
			// (absence bounded by the settled tag response).
			for (const username of ['dbuskins', 'mfritz']) {
				const ctx = await asUser(username);
				const scopedPage = await ctx.newPage();
				const scopedDashboard = new DashboardPage(scopedPage);
				await scopedDashboard.gotoEditorial({view: 'active'});
				await expect(
					scopedDashboard.viewHeading(/Active submissions/),
				).toBeVisible({timeout: 20_000});
				await expect(
					scopedDashboard.viewLinks('editorial'),
				).toHaveCount(13);
				await expect(
					viewLink(scopedDashboard, 'editorial', 'needs-editor'),
				).toHaveCount(0);
				await expect(
					viewLink(scopedDashboard, 'editorial', 'declined'),
				).toHaveCount(0);

				await searchAndSettle(scopedPage, scopedDashboard, tag);
				await expect(scopedDashboard.row(assignedTitle)).toBeVisible({
					timeout: 20_000,
				});
				await expect(scopedDashboard.row(unassignedTitle)).toHaveCount(0);
			}
		},
	);

	// Canonical scenario 3 — a submission with no editor (or only an
	// assistant) assigned appears in the manager's Needs editor view with
	// an Assign Editor row action; an incomplete draft does not appear;
	// assigning a section editor clears the row from the view.
	test(
		'needs-editor triage',
		{tag: '@regression'},
		async ({page, pkpApi}) => {
			test.slow(); // legacy assign-participant modal round-trip
			const tag = uniqueTag();
			const unassignedTitle = `Unassigned${tag}`;
			const assistantTitle = `Assistantonly${tag}`;
			const draftTitle = `Draft${tag}`;
			await pkpApi.createSubmission(
				submittedSpec({tag, title: unassignedTitle, participants: []}),
			);
			await pkpApi.createSubmission(
				submittedSpec({
					tag,
					title: assistantTitle,
					participants: [{user: 'mfritz', role: 'copyeditor'}],
				}),
			);
			await pkpApi.createSubmission({
				...submittedSpec({tag, title: draftTitle, participants: []}),
				submitted: false,
			});

			const dashboard = new DashboardPage(page);
			await dashboard.gotoEditorial({view: 'needs-editor'});
			await expect(dashboard.viewHeading(/Needs editor/)).toBeVisible({
				timeout: 20_000,
			});
			await searchAndSettle(page, dashboard, tag);

			// Unassigned and assistant-only both count as needing an
			// editor and prompt Assign Editor right in the activity cell;
			// the draft does not appear (absence bounded by the settled
			// search).
			const unassignedRow = dashboard.row(unassignedTitle);
			await expect(unassignedRow).toBeVisible({timeout: 20_000});
			await expect(
				unassignedRow.getByRole('button', {name: 'Assign Editor'}),
			).toBeVisible();
			const assistantRow = dashboard.row(assistantTitle);
			await expect(assistantRow).toBeVisible();
			await expect(
				assistantRow.getByRole('button', {name: 'Assign Editor'}),
			).toBeVisible();
			await expect(dashboard.row(draftTitle)).toHaveCount(0);

			// Assign a section editor through the row action (legacy
			// Assign Participant modal: pick the group, search, pick the
			// user radio, OK — the notify message is optional).
			await unassignedRow
				.getByRole('button', {name: 'Assign Editor'})
				.click();
			const modal = dashboard.activeModal;
			await expect(
				modal.getByRole('heading', {name: 'Assign Participant'}),
			).toBeVisible({timeout: 20_000});
			await modal
				.locator('select[name="filterUserGroupId"]')
				.selectOption({label: 'Section editor'});
			await modal.getByRole('button', {name: 'Search', exact: true}).click();
			const userRow = modal
				.getByRole('row')
				.filter({hasText: 'David Buskins'});
			await expect(userRow).toBeVisible({timeout: 20_000});
			await userRow.getByRole('radio').check();

			// Saving closes the modal and re-fetches the view — wait for
			// the tag-scoped needs-editor re-query to bound the absence.
			await Promise.all([
				page.waitForResponse(
					(res) =>
						res.url().includes('/api/v1/_submissions') &&
						res.url().includes('isUnassigned') &&
						res.url().includes(`searchPhrase=${tag}`) &&
						res.ok(),
					{timeout: 20_000},
				),
				modal.getByRole('button', {name: 'OK', exact: true}).click(),
			]);
			await expect(dashboard.row(unassignedTitle)).toHaveCount(0);
			// The assistant-only sibling still needs an editor.
			await expect(dashboard.row(assistantTitle)).toBeVisible();
		},
	);

	// Canonical scenario 4 — one submission per state: each appears in
	// exactly its matching stage/status view with the right Stage label,
	// and the declined one is reachable only in manager scope (dbuskins is
	// even auto-assigned to it, yet has no Declined view and no way to
	// search it up).
	test(
		'state views bucket correctly',
		{tag: '@regression'},
		async ({page, pkpApi, asUser}) => {
			test.slow(); // 7 scenario seeds + 7 view visits
			const tag = uniqueTag();
			const titles = {
				submission: `Subm${tag}`,
				review: `Inrev${tag}`,
				copyediting: `Coped${tag}`,
				production: `Prodn${tag}`,
				scheduled: `Sched${tag}`,
				published: `Publd${tag}`,
				declined: `Decld${tag}`,
			};
			const allTitles = Object.values(titles);

			await pkpApi.createSubmission(
				submittedSpec({tag, title: titles.submission}),
			);
			await pkpApi.createSubmission(
				inReviewSpec({tag, title: titles.review}),
			);
			await pkpApi.createSubmission({
				...submittedSpec({tag, title: titles.copyediting}),
				decisions: [{type: 'skipExternalReview', by: 'dbarnes'}],
			});
			await pkpApi.createSubmission(
				productionSpec({tag, title: titles.production}),
			);
			await pkpApi.createSubmission(
				productionSpec({
					tag,
					title: titles.scheduled,
					issue: {volume: 2, number: 1, year: 2015}, // unpublished issue
				}),
			);
			await pkpApi.createSubmission(
				productionSpec({
					tag,
					title: titles.published,
					issue: {volume: 1, number: 2, year: 2014}, // published issue
				}),
			);
			await pkpApi.createSubmission({
				...submittedSpec({tag, title: titles.declined}),
				decisions: [{type: 'initialDecline', by: 'dbarnes'}],
			});

			const dashboard = new DashboardPage(page);
			await dashboard.gotoEditorial({view: 'active'});
			await expect(
				dashboard.viewHeading(/Active submissions/),
			).toBeVisible({timeout: 20_000});

			/**
			 * Switch to a view (SPA nav), tag-search, and assert it holds
			 * exactly the expected seed with its Stage label.
			 *
			 * @param {string} navLabel
			 * @param {RegExp} heading
			 * @param {string} expectedTitle
			 * @param {string} stageLabel
			 */
			async function expectViewHoldsExactly(
				navLabel,
				heading,
				expectedTitle,
				stageLabel,
			) {
				await dashboard.navItem(navLabel).click();
				await expect(dashboard.viewHeading(heading)).toBeVisible({
					timeout: 20_000,
				});
				await searchAndSettle(page, dashboard, tag);
				const row = dashboard.row(expectedTitle);
				await expect(row).toBeVisible({timeout: 20_000});
				await expect(
					row.getByText(stageLabel, {exact: true}),
				).toBeVisible();
				for (const other of allTitles.filter(
					(t) => t !== expectedTitle,
				)) {
					await expect(dashboard.row(other)).toHaveCount(0);
				}
			}

			await expectViewHoldsExactly(
				'All in submission stage',
				/All in submission stage/,
				titles.submission,
				'Submission',
			);
			await expectViewHoldsExactly(
				'All in review stage',
				/All in review stage/,
				titles.review,
				'Review (Round 1)',
			);
			await expectViewHoldsExactly(
				'All in copyediting stage',
				/All in copyediting stage/,
				titles.copyediting,
				'Copyediting',
			);
			await expectViewHoldsExactly(
				'All in production stage',
				/All in production stage/,
				titles.production,
				'Production',
			);
			await expectViewHoldsExactly(
				'Scheduled for publication',
				/Scheduled for publication/,
				titles.scheduled,
				'Scheduled',
			);
			await expect(
				dashboard
					.row(titles.scheduled)
					.getByText('To be published in issue Vol. 2 No. 1 (2015)'),
			).toBeVisible();
			await expectViewHoldsExactly(
				'Published',
				/Published/,
				titles.published,
				'Published',
			);
			await expectViewHoldsExactly(
				'Declined',
				/Declined/,
				titles.declined,
				'Declined',
			);
			await expect(
				dashboard.row(titles.declined).getByText(/Declined during the/),
			).toBeVisible();

			// Manager scope only: dbuskins (auto-assigned to the declined
			// submission as an Articles section editor) has no Declined
			// view, and an unknown view id in the URL falls back to the
			// first view; a direct search cannot surface it either — every
			// scoped view filters to queued submissions.
			const ctx = await asUser('dbuskins');
			const scopedPage = await ctx.newPage();
			const scopedDashboard = new DashboardPage(scopedPage);
			await scopedDashboard.gotoEditorial({view: 'declined'});
			await expect(
				scopedDashboard.viewHeading(/Assigned to me/),
			).toBeVisible({timeout: 20_000});
			await searchAndSettle(scopedPage, scopedDashboard, titles.declined);
			await expect(scopedDashboard.row(titles.declined)).toHaveCount(0);
		},
	);

	// Canonical scenario 5 — searching a unique title token narrows the
	// list to the seeded submission; searching its numeric ID finds it;
	// switching views clears the search.
	test(
		'search: unique token and ID',
		{tag: '@regression'},
		async ({page, pkpApi}) => {
			const tag = uniqueTag();
			const alphaTitle = `Alpha${tag}`;
			const betaTitle = `Beta${tag}`;
			await pkpApi.createSubmission(submittedSpec({tag, title: alphaTitle}));
			const {submission: beta} = await pkpApi.createSubmission(
				submittedSpec({tag, title: betaTitle}),
			);

			const dashboard = new DashboardPage(page);
			await dashboard.gotoEditorial({view: 'active'});
			await expect(
				dashboard.viewHeading(/Active submissions/),
			).toBeVisible({timeout: 20_000});

			// A unique title token narrows the list to the one row.
			await searchAndSettle(page, dashboard, alphaTitle);
			await expect(dashboard.row(alphaTitle)).toBeVisible({
				timeout: 20_000,
			});
			await expect(dashboard.row(betaTitle)).toHaveCount(0);

			// A numeric token matches the submission ID exactly.
			await searchAndSettle(page, dashboard, String(beta.id));
			await expect(dashboard.row(betaTitle)).toBeVisible({
				timeout: 20_000,
			});
			await expect(dashboard.row(alphaTitle)).toHaveCount(0);

			// Switching views clears the search phrase (box and URL).
			await dashboard.navItem('All in submission stage').click();
			await expect(
				dashboard.viewHeading(/All in submission stage/),
			).toBeVisible({timeout: 20_000});
			await expect(dashboard.searchInput).toHaveValue('');
			await expect(page).not.toHaveURL(/searchPhrase=/);
		},
	);

	// Canonical scenario 6 — Section + Assigned To Editor + Days since
	// last activity combine with AND: a chip renders per filter, the
	// heading count drops, only rows satisfying every filter remain,
	// reloading the copied URL reproduces the state, and Clear Filters
	// restores the view.
	test(
		'filters combine and travel in the URL',
		{tag: '@regression'},
		async ({page, pkpApi}) => {
			test.slow(); // two filter-modal round-trips + full reload
			const tag = uniqueTag();
			const artDbuskinsTitle = `Artbusk${tag}`;
			const artMinoueTitle = `Artmino${tag}`;
			const revDbuskinsTitle = `Revbusk${tag}`;
			await pkpApi.createSubmission(
				submittedSpec({
					tag,
					title: artDbuskinsTitle,
					participants: [{user: 'dbuskins', role: 'sectionEditor'}],
				}),
			);
			await pkpApi.createSubmission(
				submittedSpec({
					tag,
					title: artMinoueTitle,
					participants: [{user: 'minoue', role: 'sectionEditor'}],
				}),
			);
			await pkpApi.createSubmission(
				submittedSpec({
					tag,
					title: revDbuskinsTitle,
					section: 'REV',
					participants: [{user: 'dbuskins', role: 'sectionEditor'}],
				}),
			);

			const dashboard = new DashboardPage(page);
			await dashboard.gotoEditorial({view: 'active'});
			await expect(
				dashboard.viewHeading(/Active submissions/),
			).toBeVisible({timeout: 20_000});
			// The heading count starts at (0) while the first fetch is in
			// flight — our three fresh seeds guarantee at least 3.
			await expect
				.poll(() => headingCount(page), {timeout: 20_000})
				.toBeGreaterThanOrEqual(3);
			const unfilteredCount = await headingCount(page);

			// Section=Articles + Assigned To Editor=dbuskins.
			await dashboard.openFilters();
			const modal = dashboard.activeModal;
			await modal.getByRole('checkbox', {name: 'Articles'}).check();
			await modal
				.getByRole('combobox', {name: 'Assigned To Editor'})
				.fill('Buskins');
			await page.getByRole('option', {name: 'David Buskins'}).click();
			await Promise.all([
				page.waitForResponse(
					(res) =>
						res.url().includes('/api/v1/_submissions') &&
						res.url().includes('sectionIds') &&
						res.url().includes('assignedTo') &&
						res.ok(),
					{timeout: 20_000},
				),
				dashboard.applyFilters(),
			]);

			// A chip per filter; the heading follows the filtered total.
			await expect(
				dashboard.filterChip('Section', 'Articles'),
			).toBeVisible({timeout: 20_000});
			await expect(
				dashboard.filterChip('Assigned To Editor', 'David Buskins'),
			).toBeVisible();
			await expect
				.poll(() => headingCount(page), {timeout: 20_000})
				.toBeLessThan(unfilteredCount);

			// AND semantics: only the row satisfying BOTH filters remains
			// of the tagged trio.
			await searchAndSettle(page, dashboard, tag);
			await expect(dashboard.row(artDbuskinsTitle)).toBeVisible({
				timeout: 20_000,
			});
			await expect(dashboard.row(artMinoueTitle)).toHaveCount(0);
			await expect(dashboard.row(revDbuskinsTitle)).toHaveCount(0);

			// Adding Days-since-activity (slider; End = max 180) excludes
			// the fresh seeds too.
			await dashboard.openFilters();
			const slider = dashboard.activeModal.getByRole('slider', {
				name: 'Days since last activity',
			});
			await slider.focus();
			await page.keyboard.press('End');
			await Promise.all([
				page.waitForResponse(
					(res) =>
						res.url().includes('/api/v1/_submissions') &&
						res.url().includes('daysInactive=180') &&
						res.ok(),
					{timeout: 20_000},
				),
				dashboard.applyFilters(),
			]);
			await expect(
				dashboard.filterChip('Days since last activity', '180'),
			).toBeVisible({timeout: 20_000});
			await expect(dashboard.row(artDbuskinsTitle)).toHaveCount(0);
			await expect(
				page.locator('table').getByText('No Items'),
			).toBeVisible();

			// The whole list state rides in the URL — a copied URL
			// reproduces it on a fresh load.
			await expect(page).toHaveURL(/sectionIds=/);
			await expect(page).toHaveURL(/assignedTo=/);
			await expect(page).toHaveURL(/daysInactive=180/);
			await expect(page).toHaveURL(new RegExp(`searchPhrase=${tag}`));
			await page.goto(page.url(), {waitUntil: 'commit'});
			await expect(
				dashboard.filterChip('Section', 'Articles'),
			).toBeVisible({timeout: 20_000});
			await expect(
				dashboard.filterChip('Assigned To Editor', 'David Buskins'),
			).toBeVisible();
			await expect(
				dashboard.filterChip('Days since last activity', '180'),
			).toBeVisible();
			await expect(dashboard.searchInput).toHaveValue(tag);
			await expect(
				page.locator('table').getByText('No Items'),
			).toBeVisible({timeout: 20_000});

			// Clear Filters drops the chips and restores the (still
			// tag-searched) view.
			await Promise.all([
				page.waitForResponse(
					(res) =>
						res.url().includes('/api/v1/_submissions') &&
						res.url().includes(`searchPhrase=${tag}`) &&
						!res.url().includes('daysInactive=180') &&
						res.ok(),
					{timeout: 20_000},
				),
				dashboard.clearFiltersButton.click(),
			]);
			await expect(
				dashboard.filterChip('Section', 'Articles'),
			).toHaveCount(0);
			await expect(dashboard.row(artDbuskinsTitle)).toBeVisible({
				timeout: 20_000,
			});
			await expect(dashboard.row(artMinoueTitle)).toBeVisible();
			await expect(dashboard.row(revDbuskinsTitle)).toBeVisible();
		},
	);

	// Canonical scenario 7 — clicking View pushes workflowSubmissionId
	// (and the pane key) into the URL and opens the workflow side panel;
	// closing it strips them and returns to the same view and search with
	// the list re-fetched.
	test(
		'row → workflow panel round-trip',
		{tag: ['@smoke', '@regression']},
		async ({page, pkpApi}) => {
			const tag = uniqueTag();
			const title = `Roundtrip${tag}`;
			await pkpApi.createSubmission(inReviewSpec({tag, title}));

			const dashboard = new DashboardPage(page);
			await dashboard.gotoEditorial({view: 'active'});
			await expect(
				dashboard.viewHeading(/Active submissions/),
			).toBeVisible({timeout: 20_000});
			await searchAndSettle(page, dashboard, tag);
			const row = dashboard.row(title);
			await expect(row).toBeVisible({timeout: 20_000});

			// Open: the URL gains the workflow keys on top of the list
			// state; the panel shows the submission.
			await row.getByRole('button', {name: 'View', exact: true}).click();
			await page.waitForURL(/workflowSubmissionId=\d+/, {
				timeout: 20_000,
				waitUntil: 'commit',
			});
			await expect(page).toHaveURL(/workflowMenuKey=/);
			await expect(page).toHaveURL(/currentViewId=active/);
			await expect(page).toHaveURL(new RegExp(`searchPhrase=${tag}`));
			const panel = dashboard.activeModal;
			await expect(panel.getByText(title).first()).toBeVisible({
				timeout: 20_000,
			});

			// Close: the workflow keys are stripped, the view + search
			// survive, and the list is re-fetched (bounded on the
			// tag-scoped re-query).
			await Promise.all([
				page.waitForResponse(
					(res) =>
						res.url().includes('/api/v1/_submissions') &&
						res.url().includes(`searchPhrase=${tag}`) &&
						res.ok(),
					{timeout: 20_000},
				),
				panel
					.getByRole('button', {name: 'Close', exact: true})
					.first()
					.click(),
			]);
			await page.waitForURL(
				(url) => !url.search.includes('workflowSubmissionId'),
				{timeout: 20_000, waitUntil: 'commit'},
			);
			await expect(page).toHaveURL(/currentViewId=active/);
			await expect(page).toHaveURL(new RegExp(`searchPhrase=${tag}`));
			await expect(dashboard.searchInput).toHaveValue(tag);
			await expect(dashboard.row(title)).toBeVisible({timeout: 20_000});
		},
	);

	// Canonical scenario 8 — conflict-of-interest guard: a manager whose
	// only tie to a row is being its author gets the author notice
	// instead of actions (no View button); being only its reviewer gets
	// the reviewer twin. Runs on a scratch journal so the manager holds
	// no editorial assignment on either row (publicknowledge's ART
	// section auto-assigns its editors on submit).
	test(
		'conflict-of-interest guard',
		{tag: '@regression'},
		async ({pkpApi, asUser}) => {
			test.slow(); // scratch journal + fresh user login
			const tag = uniqueTag();
			const journalTag = `${tag}j`;
			const journalPath = `j-${journalTag}`;
			const manager = `${tag}m`;
			const author = `${tag}a`;
			await pkpApi.createJournal({
				tag: journalTag,
				name: {en: `Editorial Dashboards ${tag}`},
				users: [
					{
						username: manager,
						password: manager + manager,
						// The author-guard keys off an author STAGE
						// assignment whose role only resolves for enrolled
						// users — the real wizard grants the author role on
						// first submission, the scenario builder does not.
						roles: ['manager', 'reviewer', 'author'],
					},
					{
						username: author,
						password: author + author,
						roles: ['author'],
					},
				],
			});
			const authorConflictTitle = `Authored${tag}`;
			const reviewerConflictTitle = `Refereed${tag}`;
			// The manager's own submission: author tie only.
			await pkpApi.createSubmission(
				submittedSpec({
					tag,
					title: authorConflictTitle,
					journal: journalPath,
					submitter: manager,
					participants: [],
				}),
			);
			// Someone else's submission the manager reviews: reviewer tie
			// only (the scratch journal's section has no section editors,
			// so submit() auto-assigns nobody).
			await pkpApi.createSubmission({
				...submittedSpec({
					tag,
					title: reviewerConflictTitle,
					journal: journalPath,
					submitter: author,
					participants: [],
				}),
				decisions: [{type: 'sendExternalReview', by: manager}],
				reviewRounds: [
					{
						reviewers: [
							{user: manager, method: 'anonymous', status: 'accepted'},
						],
					},
				],
			});

			const ctx = await asUser(manager);
			const managerPage = await ctx.newPage();
			const dashboard = new DashboardPage(managerPage, {
				journal: journalPath,
			});
			await dashboard.gotoEditorial({view: 'active'});
			await expect(
				dashboard.viewHeading(/Active submissions/),
			).toBeVisible({timeout: 20_000});

			// Author guard: notice instead of activity, View withheld.
			const authorRow = dashboard.row(authorConflictTitle);
			await expect(authorRow).toBeVisible({timeout: 20_000});
			await expect(
				authorRow.getByText(
					/You cannot access this submission as a Journal Manager since you are the author\. To view it, go to "My Submissions"/,
				),
			).toBeVisible();
			await expect(
				authorRow.getByRole('button', {name: 'View', exact: true}),
			).toHaveCount(0);
			await expect(
				authorRow.getByRole('button', {name: 'Assign Editor'}),
			).toHaveCount(0);

			// Reviewer guard: the twin notice, View withheld.
			const reviewerRow = dashboard.row(reviewerConflictTitle);
			await expect(reviewerRow).toBeVisible();
			await expect(
				reviewerRow.getByText(
					/You cannot access this submission as a Journal Manager since you are the reviewer\. To view it, go to "Review Assignments"/,
				),
			).toBeVisible();
			await expect(
				reviewerRow.getByRole('button', {name: 'View', exact: true}),
			).toHaveCount(0);
		},
	);

	// Canonical scenario 9 — jjanssen opens /dashboard/reviewAssignments:
	// six views with counts on a four-column table; an invited assignment
	// sits in Action Required with the respond-by deadline and Respond to
	// request; an accepted one shows Finish review; a completed one shows
	// View in Completed; each button lands on the reviewer response page.
	test(
		'reviewer buckets and acts on assignments',
		{tag: ['@smoke', '@regression']},
		async ({pkpApi, asUser}) => {
			test.slow(); // three reviewer-page round-trips
			const tag = uniqueTag();
			const invitedTitle = `Invited${tag}`;
			const acceptedTitle = `Accepted${tag}`;
			const completedTitle = `Completed${tag}`;
			const {submission: invited} = await pkpApi.createSubmission(
				inReviewSpec({
					tag,
					title: invitedTitle,
					reviewer: {user: 'jjanssen', method: 'anonymous', status: 'invited'},
				}),
			);
			const {submission: accepted} = await pkpApi.createSubmission(
				inReviewSpec({
					tag,
					title: acceptedTitle,
					reviewer: {
						user: 'jjanssen',
						method: 'anonymous',
						status: 'accepted',
					},
				}),
			);
			const {submission: completed} = await pkpApi.createSubmission(
				inReviewSpec({
					tag,
					title: completedTitle,
					reviewer: {
						user: 'jjanssen',
						method: 'anonymous',
						status: 'completed',
						recommendation: 'accept',
					},
				}),
			);

			const ctx = await asUser('jjanssen');
			const reviewerPage = await ctx.newPage();
			const dashboard = new DashboardPage(reviewerPage);
			await dashboard.gotoReviewAssignments();
			await expect(
				dashboard.viewHeading(/Action Required by me/),
			).toBeVisible({timeout: 20_000});

			// Six views, in order, each with a live count.
			await expect(dashboard.nav).toContainText(
				'My Assignments as Reviewer',
			);
			await expect(dashboard.viewLinks('reviewAssignments')).toHaveCount(6);
			await expect(dashboard.nav).toContainText(
				new RegExp(
					REVIEWER_VIEWS.map(([label]) => label).join('[\\s\\S]*'),
				),
			);
			for (const [label, viewId] of REVIEWER_VIEWS) {
				const item = viewLink(dashboard, 'reviewAssignments', viewId);
				await expect(item).toContainText(label);
				await expect(item).toContainText(/\d+/);
			}

			// The reviewer table is four columns — no Stage, no Days.
			await expect(
				reviewerPage.getByRole('columnheader'),
			).toHaveCount(4);
			await expect(
				reviewerPage.getByRole('columnheader', {
					name: 'Stage',
					exact: true,
				}),
			).toHaveCount(0);

			// Action Required: the invited row narrates the respond-by
			// deadline; the accepted row the complete-by deadline. The ID
			// column carries the SUBMISSION's id. (The reviewer list
			// controls are inert — rule 11 ⚠ — so rows are located by
			// title on the always-full list, never via search.)
			const invitedRow = dashboard.row(invitedTitle);
			await expect(invitedRow).toBeVisible({timeout: 20_000});
			await expect(invitedRow).toContainText(String(invited.id));
			await expect(
				invitedRow.getByText(/Please accept or decline this request by/),
			).toBeVisible();
			const acceptedRow = dashboard.row(acceptedTitle);
			await expect(acceptedRow).toBeVisible();
			await expect(
				acceptedRow.getByText(/Please complete this review by/),
			).toBeVisible();
			// The completed assignment has left Action Required.
			await expect(dashboard.row(completedTitle)).toHaveCount(0);

			// Respond to request → the reviewer response page.
			await invitedRow
				.getByRole('button', {name: 'Respond to request'})
				.click();
			await reviewerPage.waitForURL(
				new RegExp(`/reviewer/submission/${invited.id}`),
				{timeout: 20_000, waitUntil: 'commit'},
			);

			// Finish review → the reviewer response page.
			await dashboard.gotoReviewAssignments();
			await expect(
				dashboard.viewHeading(/Action Required by me/),
			).toBeVisible({timeout: 20_000});
			await dashboard
				.row(acceptedTitle)
				.getByRole('button', {name: 'Finish review'})
				.click();
			await reviewerPage.waitForURL(
				new RegExp(`/reviewer/submission/${accepted.id}`),
				{timeout: 20_000, waitUntil: 'commit'},
			);

			// Completed bucket: "Review submitted on …" + View → the
			// reviewer response page.
			await dashboard.gotoReviewAssignments({
				view: 'reviewer-assignments-completed',
			});
			await expect(dashboard.viewHeading(/Completed/)).toBeVisible({
				timeout: 20_000,
			});
			const completedRow = dashboard.row(completedTitle);
			await expect(completedRow).toBeVisible({timeout: 20_000});
			await expect(
				completedRow.getByText(/Review submitted on/),
			).toBeVisible();
			await completedRow
				.getByRole('button', {name: 'View', exact: true})
				.click();
			await reviewerPage.waitForURL(
				new RegExp(`/reviewer/submission/${completed.id}`),
				{timeout: 20_000, waitUntil: 'commit'},
			);
		},
	);

	// Canonical scenario 10 — role gating and legacy doors: authors and
	// reviewers are refused the Editor Dashboard; editors and admin are
	// refused the reviewer dashboard; /submissions and /dashboard 302
	// each user to their own dashboard by role priority; anonymous hits
	// are sent to login and return after.
	test(
		'role gating and legacy doors',
		{tag: '@regression'},
		async ({page, baseURL, browser, asUser}) => {
			test.slow(); // five actors
			const editorialUrl =
				'/index.php/publicknowledge/en/dashboard/editorial';
			const reviewerUrl =
				'/index.php/publicknowledge/en/dashboard/reviewAssignments';

			/** @param {import('@playwright/test').APIRequestContext} request */
			async function redirectTarget(request, path) {
				const res = await request.get(path, {maxRedirects: 0});
				expect(res.status()).toBe(302);
				return res.headers()['location'] || '';
			}

			// Author and reviewer: refused the Editor Dashboard.
			for (const username of ['atester', 'jjanssen']) {
				const ctx = await asUser(username);
				expect(await redirectTarget(ctx.request, editorialUrl)).toContain(
					'authorizationDenied',
				);
			}
			// The refusal renders the role-denied message (full UI check
			// for one representative).
			const authorCtx = await asUser('atester');
			const authorPage = await authorCtx.newPage();
			await authorPage.goto(editorialUrl, {waitUntil: 'commit'});
			await authorPage.waitForURL(/authorizationDenied/, {
				timeout: 20_000,
				waitUntil: 'commit',
			});
			await expect(authorPage.getByText(ROLE_DENIED)).toBeVisible({
				timeout: 20_000,
			});

			// Editors — including the site admin — are refused the
			// reviewer dashboard; there is no editor-facing variant.
			expect(await redirectTarget(page.request, reviewerUrl)).toContain(
				'authorizationDenied',
			);
			const adminCtx = await asUser('admin');
			expect(await redirectTarget(adminCtx.request, reviewerUrl)).toContain(
				'authorizationDenied',
			);

			// The legacy doors redirect by role priority.
			const legacyDoors = [
				'/index.php/publicknowledge/en/submissions',
				'/index.php/publicknowledge/en/dashboard',
			];
			const expectedTarget = {
				atester: '/dashboard/mySubmissions',
				jjanssen: '/dashboard/reviewAssignments',
			};
			for (const door of legacyDoors) {
				expect(await redirectTarget(page.request, door)).toContain(
					'/dashboard/editorial',
				);
				for (const [username, target] of Object.entries(expectedTarget)) {
					const ctx = await asUser(username);
					expect(await redirectTarget(ctx.request, door)).toContain(
						target,
					);
				}
			}

			// Anonymous: sent to login with a return link, and back after.
			const anonCtx = await browser.newContext({
				baseURL,
				storageState: {cookies: [], origins: []},
			});
			const anonPage = await anonCtx.newPage();
			await anonPage.goto(editorialUrl, {waitUntil: 'commit'});
			await anonPage.waitForURL(/\/login\?source=/, {
				timeout: 20_000,
				waitUntil: 'commit',
			});
			await anonPage.locator('input#username').fill('dbarnes');
			await anonPage.locator('input#password').fill('dbarnesdbarnes');
			await anonPage.locator('form#login button').click();
			await anonPage.waitForURL(/\/dashboard\/editorial/, {
				timeout: 20_000,
				waitUntil: 'commit',
			});
			await expect(
				anonPage.getByRole('heading', {name: /Assigned to me/}),
			).toBeVisible({timeout: 20_000});
			await anonCtx.close();
		},
	);

	// Canonical scenario 11 — clicking ID sorts descending, then
	// ascending (recorded in the URL, re-ordered server-side); the Days
	// column sorts by last activity; the sort survives a view switch; and
	// a list over 30 rows pages with Previous/Next.
	test(
		'sort and pagination',
		{tag: '@regression'},
		async ({page, pkpApi}) => {
			test.slow(); // may top-up seeds to cross the 30-row page size
			const tag = uniqueTag();

			// The Active view must exceed one page (30 rows) for the pager
			// half of the scenario. The warm suite DB always does; on a
			// fresh DB, top up with minimal seeds.
			const countRes = await page.request.get(
				'/index.php/publicknowledge/api/v1/_submissions?status=1&count=1',
			);
			expect(countRes.ok()).toBeTruthy();
			const {itemsMax} = await countRes.json();
			const shortfall = 31 - itemsMax;
			for (let i = 0; i < shortfall; i += 5) {
				await Promise.all(
					Array.from(
						{length: Math.min(5, shortfall - i)},
						(_, j) =>
							pkpApi.createSubmission(
								submittedSpec({tag, title: `Pad${i + j}${tag}`}),
							),
					),
				);
			}

			const dashboard = new DashboardPage(page);
			await dashboard.gotoEditorial({view: 'active'});
			await expect(
				dashboard.viewHeading(/Active submissions/),
			).toBeVisible({timeout: 20_000});

			// ID sort: first click descending — URL records it and the
			// server re-orders (page 1 starts at the highest ID).
			await dashboard.sortButton('ID').click();
			await page.waitForURL(/sortColumn=id&sortDirection=descending/, {
				timeout: 20_000,
			});
			await expect
				.poll(() => firstRowId(page), {timeout: 20_000})
				.toBeGreaterThan(0);
			const highestId = await firstRowId(page);

			// Second click: ascending — the order flips server-side.
			await dashboard.sortButton('ID').click();
			await page.waitForURL(/sortColumn=id&sortDirection=ascending/, {
				timeout: 20_000,
			});
			await expect
				.poll(() => firstRowId(page), {timeout: 20_000})
				.toBeLessThan(highestId);

			// The Days column sorts by last activity (also URL-recorded).
			await dashboard.sortButton('Days').click();
			await page.waitForURL(
				/sortColumn=lastActivity&sortDirection=descending/,
				{timeout: 20_000},
			);

			// The sort — unlike search and filters — survives a view
			// switch.
			await dashboard.navItem('Scheduled for publication').click();
			await expect(
				dashboard.viewHeading(/Scheduled for publication/),
			).toBeVisible({timeout: 20_000});
			await expect(page).toHaveURL(
				/sortColumn=lastActivity&sortDirection=descending/,
			);

			// Pagination: 30 rows per page with a numbered pager.
			await dashboard.navItem('Active submissions').click();
			await expect(
				dashboard.viewHeading(/Active submissions/),
			).toBeVisible({timeout: 20_000});
			await expect(
				page.getByText(/Showing 1 to 30 of \d+/),
			).toBeVisible({timeout: 20_000});
			await expect(page.locator('table tbody tr')).toHaveCount(30);
			// The Previous button may carry a "Go to Previous" aria-label;
			// Next is plain text.
			const previousButton = page.getByRole('button', {
				name: /^(Go to )?Previous$/,
			});
			const nextButton = page.getByRole('button', {
				name: /^(Go to )?Next$/,
			});
			await expect(previousButton).toBeDisabled();
			await nextButton.click();
			await expect(page.getByText(/Showing 31 to \d+ of \d+/)).toBeVisible(
				{timeout: 20_000},
			);
			await expect(previousButton).toBeEnabled();
			await previousButton.click();
			await expect(
				page.getByText(/Showing 1 to 30 of \d+/),
			).toBeVisible({timeout: 20_000});
		},
	);
});
