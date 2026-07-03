// @ts-check
const {test, expect} = require('../support/fixtures.js');
const {
	DashboardPage,
} = require('../../lib/pkp/playwright/pages/DashboardPage.js');
const {
	EditorialWorkflowPage,
} = require('../pages/EditorialWorkflowPage.js');

/**
 * Author dashboard (My Submissions) — one test per canonical scenario of
 * docs/product/specs/author-dashboard.md (6 scenarios).
 *
 * Placement: OJS root (issue scheduling, the publicknowledge journal and
 * the OJS author workflow config are journal concepts), even though the
 * dashboard machinery ships from pkp-lib.
 *
 * Seeding notes (all states live-probed 2026-07-03):
 *   - submitted        → legacy shape (no `submitted` key, no decisions)
 *   - in review        → sendExternalReview + one reviewer on round 1
 *   - copyediting      → skipExternalReview
 *   - production       → skipExternalReview + sendToProduction
 *   - scheduled        → …production + VoR published INTO THE UNPUBLISHED
 *                        issue (Vol 2 No 1 2015) — publish() resolves that
 *                        to STATUS_SCHEDULED (setStatusOnPublish)
 *   - published        → …production + VoR published into the published
 *                        issue (Vol 1 No 2 2014); the PublicationPublished
 *                        listener bumps the stage to DONE
 *   - declined         → initialDecline
 *   - revisions asked  → sendExternalReview + requestRevisions (seeded for
 *                        list membership; scenario 5 records the decision
 *                        through the real editor UI so the notify-author
 *                        email reaches Mailpit — scenario-side mail is
 *                        swallowed by Mail::fake())
 *   - draft            → submitted: false, participants: []
 *
 * Parallel-safety: tags are single hyphenless alphanumeric tokens riding
 * in every title; list assertions are tag-scoped (searchAndSettle bounds
 * the absence checks); the Mailpit read is scoped with
 * pkpMail.find({to, contains: tag}) — never clearAll; nav view counts are
 * asserted as "some number", never a specific one (warm DB).
 */

const ROLE_DENIED =
	'The current role does not have access to this operation.';

function uniqueTag() {
	const workerIndex = test.info().parallelIndex;
	const suffix = Math.random().toString(36).slice(2, 8);
	return `adash${workerIndex}x${suffix}`;
}

/**
 * Base scenario spec: a submitted stage-1 submission by the given author
 * with dbarnes as deciding editor. Extend with decisions/publications for
 * the other states.
 *
 * @param {{tag: string, title: string, submitter?: string}} opts
 */
function submittedSpec({tag, title, submitter = 'atester'}) {
	return {
		tag,
		journal: 'publicknowledge',
		submitter,
		section: 'ART',
		locale: 'en',
		participants: [{user: 'dbarnes', role: 'editor'}],
		publications: [{metadata: {title: {en: title}}}],
	};
}

/** @param {{tag: string, title: string}} opts */
function draftSpec({tag, title}) {
	return {
		...submittedSpec({tag, title}),
		submitted: false,
		participants: [],
	};
}

/**
 * In external review, round 1, one reviewer accepted. `toAuthor` (when
 * set) writes an EDITOR_NOTIFY_AUTHOR email-log row, which is what the
 * tracking view's Notifications box lists.
 *
 * @param {{tag: string, title: string, toAuthor?: string}} opts
 */
function inReviewSpec({tag, title, toAuthor}) {
	return {
		...submittedSpec({tag, title}),
		decisions: [
			{
				type: 'sendExternalReview',
				by: 'dbarnes',
				...(toAuthor ? {toAuthor} : {}),
			},
		],
		reviewRounds: [
			{reviewers: [{user: 'jjanssen', method: 'anonymous', status: 'accepted'}]},
		],
	};
}

/** @param {{tag: string, title: string}} opts */
function revisionsRequestedSpec({tag, title}) {
	return {
		...submittedSpec({tag, title}),
		decisions: [
			{type: 'sendExternalReview', by: 'dbarnes'},
			{
				type: 'requestRevisions',
				by: 'dbarnes',
				toAuthor: `<p>Please revise ${tag}</p>`,
			},
		],
		reviewRounds: [
			{
				reviewers: [
					{
						user: 'jjanssen',
						method: 'anonymous',
						status: 'completed',
						recommendation: 'pendingRevisions',
					},
				],
			},
		],
	};
}

/**
 * Production-stage spec; pass an `issue` + `published: true` publication
 * to land on Scheduled (unpublished issue) or Published (published issue).
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
 * bounding subsequent absence assertions deterministically.
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
 * The author-mode tracking side panel (workflow modal). The wrapper
 * reports `visibility: hidden` during transitions — anchor visibility
 * assertions on inner content, use this for scoping only.
 *
 * @param {import('@playwright/test').Page} page
 */
function trackingPanel(page) {
	return page.locator('[data-cy="active-modal"]').first();
}

test.use({user: 'atester'});

test.describe('Author dashboard', () => {
	// Canonical scenario 1 — atester opens My Submissions: the nav group
	// shows the seven author views (in order, each with a live count) plus
	// Start A New Submission; every seeded state carries the right Stage
	// label and Editorial-Activity note (Active folds in the draft; the
	// non-queued states live in their own views); another author's
	// submission never appears.
	test(
		'my list shows my submissions, per state',
		{tag: ['@smoke', '@regression']},
		async ({page, pkpApi}) => {
			test.slow(); // 9 scenario seeds + 4 view visits
			const tag = uniqueTag();
			const titles = {
				submitted: `Subm${tag}`,
				inReview: `Inrev${tag}`,
				copyediting: `Coped${tag}`,
				production: `Prodn${tag}`,
				scheduled: `Sched${tag}`,
				published: `Publd${tag}`,
				declined: `Decld${tag}`,
				draft: `Draft${tag}`,
				foreign: `Forgn${tag}`,
			};

			await pkpApi.createSubmission(
				submittedSpec({tag, title: titles.submitted}),
			);
			await pkpApi.createSubmission(
				inReviewSpec({tag, title: titles.inReview}),
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
			await pkpApi.createSubmission(draftSpec({tag, title: titles.draft}));
			// Another author's submission — must never surface for atester.
			await pkpApi.createSubmission(
				submittedSpec({tag, title: titles.foreign, submitter: 'phudson'}),
			);

			const dashboard = new DashboardPage(page);
			// Landing without a currentViewId falls back to the first view.
			await dashboard.gotoMySubmissions();
			await expect(
				dashboard.viewHeading(/Active submissions/),
			).toBeVisible({timeout: 20_000});

			// The nav group: seven author views in canonical order plus the
			// Start A New Submission entry.
			await expect(dashboard.nav).toContainText('My Submissions as Author');
			await expect(dashboard.nav).toContainText(
				/Active submissions[\s\S]*Revisions requested[\s\S]*Revisions submitted[\s\S]*Incomplete submissions[\s\S]*Scheduled for publication[\s\S]*Published[\s\S]*Declined/,
			);
			for (const label of [
				'Active submissions',
				'Revisions requested',
				'Revisions submitted',
				'Incomplete submissions',
				'Scheduled for publication',
				'Published',
				'Declined',
			]) {
				const item = dashboard.navItem(label);
				await expect(item).toBeVisible();
				// Live count badge — some number, never a fixed one (warm DB).
				await expect(item).toContainText(/\d+/);
			}
			await expect(
				dashboard.nav.locator('a').filter({hasText: /Start A New Submission/i}),
			).toBeVisible();

			// Active view holds the queued states INCLUDING the draft…
			await searchAndSettle(page, dashboard, tag);
			const draftRow = dashboard.row(titles.draft);
			await expect(draftRow).toBeVisible({timeout: 20_000});
			await expect(draftRow.getByText('Incomplete', {exact: true})).toBeVisible();
			await expect(
				draftRow.getByRole('button', {name: 'Complete submission'}),
			).toBeVisible();
			await expect(
				draftRow.getByRole('button', {name: 'View', exact: true}),
			).toHaveCount(0);

			const submittedRow = dashboard.row(titles.submitted);
			await expect(submittedRow).toBeVisible();
			await expect(
				submittedRow.getByText('Submission', {exact: true}),
			).toBeVisible();
			await expect(
				submittedRow.getByRole('button', {name: 'View', exact: true}),
			).toBeVisible();
			// The author variant never prompts for editorial assignments.
			await expect(submittedRow.getByText(/Assign/)).toHaveCount(0);

			const inReviewRow = dashboard.row(titles.inReview);
			await expect(inReviewRow).toBeVisible();
			await expect(
				inReviewRow.getByText('Review (Round 1)', {exact: true}),
			).toBeVisible();
			await expect(inReviewRow.getByText('Review update 0/1')).toBeVisible();

			const copyeditingRow = dashboard.row(titles.copyediting);
			await expect(copyeditingRow).toBeVisible();
			await expect(
				copyeditingRow.getByText('Copyediting', {exact: true}),
			).toBeVisible();
			await expect(
				copyeditingRow.getByText('Copyedited Files Uploaded: 0'),
			).toBeVisible();

			const productionRow = dashboard.row(titles.production);
			await expect(productionRow).toBeVisible();
			await expect(
				productionRow.getByText('Production', {exact: true}),
			).toBeVisible();

			// …and NOT the terminal/scheduled states, nor the other
			// author's submission (the settled tag search bounds absence).
			for (const absent of [
				titles.scheduled,
				titles.published,
				titles.declined,
				titles.foreign,
			]) {
				await expect(dashboard.row(absent)).toHaveCount(0);
			}

			// The non-queued states live in their dedicated views with
			// their effective-state Stage labels.
			await dashboard.gotoMySubmissions({view: 'scheduled'});
			await expect(
				dashboard.viewHeading(/Scheduled for publication/),
			).toBeVisible({timeout: 20_000});
			await searchAndSettle(page, dashboard, tag);
			const scheduledRow = dashboard.row(titles.scheduled);
			await expect(scheduledRow).toBeVisible({timeout: 20_000});
			await expect(
				scheduledRow.getByText('Scheduled', {exact: true}),
			).toBeVisible();
			await expect(
				scheduledRow.getByText(
					'To be published in issue Vol. 2 No. 1 (2015)',
				),
			).toBeVisible();

			await dashboard.gotoMySubmissions({view: 'published'});
			await expect(dashboard.viewHeading(/Published/)).toBeVisible({
				timeout: 20_000,
			});
			await searchAndSettle(page, dashboard, tag);
			const publishedRow = dashboard.row(titles.published);
			await expect(publishedRow).toBeVisible({timeout: 20_000});
			await expect(
				publishedRow.getByText('Published', {exact: true}),
			).toBeVisible();

			await dashboard.gotoMySubmissions({view: 'declined'});
			await expect(dashboard.viewHeading(/Declined/)).toBeVisible({
				timeout: 20_000,
			});
			await searchAndSettle(page, dashboard, tag);
			const declinedRow = dashboard.row(titles.declined);
			await expect(declinedRow).toBeVisible({timeout: 20_000});
			await expect(
				declinedRow.getByText('Declined', {exact: true}),
			).toBeVisible();
		},
	);

	// Canonical scenario 2 — one submission per state: each dedicated view
	// (Revisions requested, Incomplete, Scheduled, Published, Declined)
	// lists exactly the matching submission; the Active view also contains
	// the incomplete draft (by design, rule 1).
	test(
		'state views funnel correctly',
		{tag: '@regression'},
		async ({page, pkpApi}) => {
			test.slow(); // 5 scenario seeds + 6 view visits
			const tag = uniqueTag();
			const titles = {
				revisions: `Rvreq${tag}`,
				draft: `Draft${tag}`,
				scheduled: `Sched${tag}`,
				published: `Publd${tag}`,
				declined: `Decld${tag}`,
			};
			const allTitles = Object.values(titles);

			await pkpApi.createSubmission(
				revisionsRequestedSpec({tag, title: titles.revisions}),
			);
			await pkpApi.createSubmission(draftSpec({tag, title: titles.draft}));
			await pkpApi.createSubmission(
				productionSpec({
					tag,
					title: titles.scheduled,
					issue: {volume: 2, number: 1, year: 2015},
				}),
			);
			await pkpApi.createSubmission(
				productionSpec({
					tag,
					title: titles.published,
					issue: {volume: 1, number: 2, year: 2014},
				}),
			);
			await pkpApi.createSubmission({
				...submittedSpec({tag, title: titles.declined}),
				decisions: [{type: 'initialDecline', by: 'dbarnes'}],
			});

			const dashboard = new DashboardPage(page);

			/**
			 * Assert the view lists exactly the expected seeds (tag-scoped).
			 *
			 * @param {string} view
			 * @param {RegExp} heading
			 * @param {string[]} expected
			 */
			async function expectViewHoldsExactly(view, heading, expected) {
				await dashboard.gotoMySubmissions({view});
				await expect(dashboard.viewHeading(heading)).toBeVisible({
					timeout: 20_000,
				});
				await searchAndSettle(page, dashboard, tag);
				for (const title of expected) {
					await expect(dashboard.row(title)).toBeVisible({
						timeout: 20_000,
					});
				}
				for (const title of allTitles.filter(
					(t) => !expected.includes(t),
				)) {
					await expect(dashboard.row(title)).toHaveCount(0);
				}
			}

			await expectViewHoldsExactly(
				'revisions-requested',
				/Revisions requested/,
				[titles.revisions],
			);
			await expectViewHoldsExactly(
				'incomplete-submissions',
				/Incomplete submissions/,
				[titles.draft],
			);
			await expectViewHoldsExactly('scheduled', /Scheduled for publication/, [
				titles.scheduled,
			]);
			await expectViewHoldsExactly('published', /Published/, [
				titles.published,
			]);
			await expectViewHoldsExactly('declined', /Declined/, [titles.declined]);
			// Active = all queued submissions INCLUDING the incomplete
			// draft (rule 1), alongside the queued revisions submission.
			await expectViewHoldsExactly('active', /Active submissions/, [
				titles.draft,
				titles.revisions,
			]);
		},
	);

	// Canonical scenario 3 — searching a title or an ID reduces the list
	// to the matching row; a non-matching phrase shows the empty state;
	// switching views clears the search.
	test(
		'search narrows to mine',
		{tag: '@regression'},
		async ({page, pkpApi}) => {
			const tag = uniqueTag();
			const alphaTitle = `Alpha${tag}`;
			const betaTitle = `Beta${tag}`;
			await pkpApi.createSubmission(
				submittedSpec({tag, title: alphaTitle}),
			);
			const {submission: beta} = await pkpApi.createSubmission(
				submittedSpec({tag, title: betaTitle}),
			);

			const dashboard = new DashboardPage(page);
			await dashboard.gotoMySubmissions({view: 'active'});
			await expect(
				dashboard.viewHeading(/Active submissions/),
			).toBeVisible({timeout: 20_000});

			// A title search reduces the list to the matching row.
			await searchAndSettle(page, dashboard, alphaTitle);
			await expect(dashboard.row(alphaTitle)).toBeVisible({
				timeout: 20_000,
			});
			await expect(dashboard.row(betaTitle)).toHaveCount(0);

			// A numeric ID search finds the row too.
			await searchAndSettle(page, dashboard, String(beta.id));
			await expect(dashboard.row(betaTitle)).toBeVisible({
				timeout: 20_000,
			});
			await expect(dashboard.row(alphaTitle)).toHaveCount(0);

			// A non-matching phrase shows the empty state.
			await searchAndSettle(page, dashboard, `zzz${tag}nohit`);
			await expect(
				page.locator('table').getByText('No Items'),
			).toBeVisible({timeout: 20_000});

			// Switching views clears the search phrase.
			await dashboard.navItem('Declined').click();
			await expect(dashboard.viewHeading(/Declined/)).toBeVisible({
				timeout: 20_000,
			});
			await expect(dashboard.searchInput).toHaveValue('');
			await expect(page).not.toHaveURL(/searchPhrase=/);
		},
	);

	// Canonical scenario 4 — View on an in-review submission opens the
	// read-mostly tracking panel on the current round: round-status
	// banner, Notifications, the Revisions-Uploaded file panel and
	// discussions — but no decision buttons, no participants list, no
	// reviewer identities; the URL is shareable state and reopens the
	// same pane.
	test(
		'author opens their submission and gets the read-mostly view',
		{tag: ['@smoke', '@regression']},
		async ({page, pkpApi}) => {
			const tag = uniqueTag();
			const title = `Track${tag}`;
			await pkpApi.createSubmission(
				inReviewSpec({
					tag,
					title,
					toAuthor: `<p>Sent to review ${tag}</p>`,
				}),
			);

			const dashboard = new DashboardPage(page);
			await dashboard.gotoMySubmissions({view: 'active'});
			await expect(
				dashboard.viewHeading(/Active submissions/),
			).toBeVisible({timeout: 20_000});
			await searchAndSettle(page, dashboard, tag);
			const row = dashboard.row(title).first();
			await expect(row).toBeVisible({timeout: 20_000});
			await row.getByRole('button', {name: 'View', exact: true}).click();

			// The panel records submission + pane in the query string; it
			// opens on the current review round (stage 3 menu key).
			await page.waitForURL(/workflowSubmissionId=\d+/, {
				timeout: 20_000,
				waitUntil: 'commit',
			});
			await expect(page).toHaveURL(/workflowMenuKey=workflow_3_\d+/);

			const panel = trackingPanel(page);
			// Round-status banner for the current round.
			await expect(
				panel.getByRole('heading', {name: 'Round 1 Status'}),
			).toBeVisible({timeout: 20_000});
			await expect(
				panel.getByText('Awaiting responses from reviewers.'),
			).toBeVisible();

			// Decision notifications: the editor's notify-author email.
			await expect(
				panel.getByRole('heading', {name: 'Notifications'}),
			).toBeVisible();
			await expect(
				panel.locator('a').filter({hasText: /notify author/}),
			).toBeVisible();

			// Revision-file panel (with the author's Upload affordance) and
			// discussions.
			await expect(
				panel.getByRole('heading', {name: 'Revisions Uploaded'}),
			).toBeVisible();
			await expect(
				panel.getByRole('button', {name: 'Upload', exact: true}),
			).toBeVisible();
			await expect(panel.getByText('Review Tasks & Discussions')).toBeVisible();

			// The author-mode menu: all four stages + per-version
			// publication tabs; the header offers the Library.
			const menu = panel.locator('nav').first();
			for (const item of [
				'Submission',
				'Review Round 1',
				'Copyediting',
				'Production',
				'Publication',
				'Title & Abstract',
			]) {
				await expect(menu.getByText(item, {exact: true})).toBeVisible();
			}
			await expect(
				panel.getByRole('button', {name: 'Library', exact: true}),
			).toBeVisible();

			// Read-mostly: no editorial decision buttons, no participants
			// panel, no activity log, and the reviewer's identity is
			// nowhere in the author's view.
			for (const decision of [
				'Request Revisions',
				'Accept Submission',
				'Decline',
				'Send To Production',
			]) {
				await expect(
					panel.getByRole('button', {name: decision, exact: true}),
				).toHaveCount(0);
			}
			await expect(
				panel.locator('[data-cy="participant-manager"]'),
			).toHaveCount(0);
			await expect(
				panel.getByRole('button', {name: 'Activity Log'}),
			).toHaveCount(0);
			await expect(panel.getByText('Julie Janssen')).toHaveCount(0);

			// The URL is shareable state: a fresh load of the copied URL
			// reopens the same submission on the same pane.
			const deepLink = page.url();
			await page.goto(deepLink, {waitUntil: 'commit'});
			await expect(
				trackingPanel(page).getByRole('heading', {name: 'Round 1 Status'}),
			).toBeVisible({timeout: 20_000});
			await expect(page).toHaveURL(/workflowMenuKey=workflow_3_\d+/);
		},
	);

	// Canonical scenario 5 — the editor requests revisions with a message
	// through the real decision UI: the notify-author email reaches the
	// author's inbox; the row shows "Revision requested" + Submit
	// revisions; the Revisions-requested view lists it; the tracking view
	// banners the round status, offers Upload revisions, and the
	// Notifications entry opens the editor's email with the message body.
	test(
		'revisions requested reaches the author end-to-end',
		{tag: ['@smoke', '@regression']},
		async ({page, pkpApi, pkpMail, asUser}) => {
			test.slow(); // editor decision UI + author round trip
			const tag = uniqueTag();
			const title = `Rvflow${tag}`;
			const marker = `Please revise ${tag} and resubmit.`;
			const {submission} = await pkpApi.createSubmission(
				inReviewSpec({tag, title}),
			);

			// dbarnes records Request Revisions (revisions NOT subject to a
			// new round) with a personal message to the author.
			const editorCtx = await asUser('dbarnes');
			const editorPage = await editorCtx.newPage();
			const workflow = new EditorialWorkflowPage(editorPage);
			await workflow.goto(submission.id);
			await workflow.clickRequestRevisions({newRound: false});
			await workflow.setDecisionEmailBody(
				'notifyAuthors',
				`<p>${marker}</p>`,
			);
			await workflow.recordDecision();

			// The notify-author email reaches the author (scoped by tag —
			// atester's inbox is shared across the suite; NEVER clearAll).
			const [message] = await pkpMail.find({
				to: 'atester@mailinator.com',
				contains: tag,
				timeoutMs: 30_000,
			});
			expect(message.Subject).toBeTruthy();

			// The author's row: "Revision requested" + the Submit revisions
			// action, in the dedicated Revisions requested view.
			const dashboard = new DashboardPage(page);
			await dashboard.gotoMySubmissions({view: 'revisions-requested'});
			await expect(
				dashboard.viewHeading(/Revisions requested/),
			).toBeVisible({timeout: 20_000});
			await searchAndSettle(page, dashboard, tag);
			const row = dashboard.row(title).first();
			await expect(row).toBeVisible({timeout: 20_000});
			await expect(row.getByText('Revision requested')).toBeVisible();
			await expect(
				row.getByRole('button', {name: 'Submit revisions'}),
			).toBeVisible();

			// The tracking view banners the round status and offers the
			// Upload revisions action.
			await row.getByRole('button', {name: 'View', exact: true}).click();
			await page.waitForURL(/workflowSubmissionId=\d+/, {
				timeout: 20_000,
				waitUntil: 'commit',
			});
			const panel = trackingPanel(page);
			await expect(
				panel.getByRole('heading', {name: 'Round 1 Status'}),
			).toBeVisible({timeout: 20_000});
			await expect(
				panel.getByText('Revisions have been requested.'),
			).toBeVisible();
			await expect(
				panel.getByRole('button', {name: 'Upload revisions', exact: true}),
			).toBeVisible();

			// The Notifications entry opens the editor's email — subject
			// matches what landed in Mailpit, body carries the message.
			await expect(
				panel.getByRole('heading', {name: 'Notifications'}),
			).toBeVisible();
			await panel
				.locator('a')
				.filter({hasText: message.Subject})
				.first()
				.click();
			const emailPanel = page.locator('[data-cy="active-modal"]').last();
			await expect(emailPanel.getByText(marker)).toBeVisible({
				timeout: 20_000,
			});
			await expect(emailPanel.getByText(message.Subject)).toBeVisible();
		},
	);

	// Canonical scenario 6 — someone else's submission is out of reach:
	// a foreign workflowSubmissionId deep link only yields the
	// access-denied error dialog; the legacy author-dashboard URL 302s to
	// the tracking view for the submission's own author and bounces
	// everyone else to authorizationDenied; dbarnes (editor, no author
	// role) cannot open My Submissions at all.
	test(
		"someone else's submission is out of reach",
		{tag: '@regression'},
		async ({page, pkpApi, asUser}) => {
			const tag = uniqueTag();
			const ownTitle = `Mine${tag}`;
			const {submission: own} = await pkpApi.createSubmission(
				submittedSpec({tag, title: ownTitle}),
			);
			const {submission: foreign} = await pkpApi.createSubmission(
				submittedSpec({tag, title: `Their${tag}`, submitter: 'phudson'}),
			);

			// Deep-linking another author's submission: the panel shows only
			// the access-denied error.
			const dashboard = new DashboardPage(page);
			await dashboard.gotoMySubmissions({
				workflowSubmissionId: foreign.id,
			});
			const errorDialog = page
				.locator('[data-cy="dialog"]')
				.filter({hasText: ROLE_DENIED});
			await expect(errorDialog).toBeVisible({timeout: 20_000});
			await expect(errorDialog).toContainText('Error');

			// The legacy author-dashboard URL still works for the
			// submission's author — as a redirect into the tracking view…
			await page.goto(
				`/index.php/publicknowledge/en/authorDashboard/submission/${own.id}`,
				{waitUntil: 'commit'},
			);
			await page.waitForURL(
				new RegExp(
					`/dashboard/mySubmissions\\?workflowSubmissionId=${own.id}`,
				),
				{timeout: 20_000, waitUntil: 'commit'},
			);
			await expect(
				trackingPanel(page).getByText(ownTitle).first(),
			).toBeVisible({timeout: 20_000});

			// …and bounces authors of other submissions to
			// authorizationDenied (accessibleWorkflowStage).
			const foreignLegacy = await page.request.get(
				`/index.php/publicknowledge/en/authorDashboard/submission/${foreign.id}`,
				{maxRedirects: 0},
			);
			expect(foreignLegacy.status()).toBe(302);
			expect(foreignLegacy.headers()['location']).toContain(
				'authorizationDenied?message=user.authorization.accessibleWorkflowStage',
			);

			// dbarnes (editor without the Author role) is refused the page
			// outright.
			const editorCtx = await asUser('dbarnes');
			const editorPage = await editorCtx.newPage();
			await editorPage.goto(
				'/index.php/publicknowledge/en/dashboard/mySubmissions',
				{waitUntil: 'commit'},
			);
			await editorPage.waitForURL(/authorizationDenied/, {
				timeout: 20_000,
				waitUntil: 'commit',
			});
			await expect(editorPage.getByText(ROLE_DENIED)).toBeVisible({
				timeout: 20_000,
			});
		},
	);
});
