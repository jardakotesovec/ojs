// @ts-check
const {test, expect} = require('../support/fixtures.js');
const {EditorialWorkflowPage} = require('../pages/EditorialWorkflowPage.js');
const {DashboardPage} = require('../../lib/pkp/playwright/pages/DashboardPage.js');
const {waitForJQueryIdle} = require('../../lib/pkp/playwright/support/jquery.js');

/**
 * Publication publish flow — docs/e2e/plans/publication-publish-flow.md
 * rows 2–8 (row 1 lives in playwright/tests/publish-unpublish.spec.js,
 * moved there from lib/pkp in this wave).
 *
 * The feature under test is the Schedule For Publication →
 * Review Publishing Details → publish-confirmation chain on the OJS
 * editorial workflow page, its preconditions (validatePublish), the
 * permission gates on the publish controls, and the resulting
 * dashboard/front-end state transitions.
 *
 * Two-modal UI reality the assertions lean on:
 *   1. "Review Publishing Details" (WorkflowVersionSideModal) collects
 *      version stage + issue assignment. Its Confirm PUTs issueId and a
 *      READY_TO_PUBLISH/READY_TO_SCHEDULE status onto the publication —
 *      i.e. Confirm already mutates state; only Cancel leaves the
 *      publication pristine (row 6 cancels here for that reason).
 *   2. The publish-confirmation modal (`.pkpWorkflow__publishModal`,
 *      PublishHandler → PublishForm) re-runs `validatePublish()`. When
 *      requirement errors exist (unpaid publication fee — row 2;
 *      declined submission — row 8) the form is built WITHOUT a submit
 *      button, so the blocked state is "no Publish button + the named
 *      error in the message list", not a failing POST.
 *
 * Permission reality (row 4): the author dashboard renders publication
 * panels through workflowConfigAuthorOJS (no getPrimaryControlsRight at
 * all) and the editorial dashboard gates the publish buttons on
 * `permissions.canPublish` (production-stage MANAGER/site-admin role —
 * the seeded "editor" group maps to ROLE_ID_MANAGER, assistants don't).
 *
 * Row 8 plan deviation, recorded deliberately: the plan expected
 * "Publication tab renders without Schedule For Publication" on a
 * declined submission, but workflowConfigEditorialOJS#getPrimaryControlsRight
 * only checks publication status (QUEUED) + canPublish — there is no
 * declined gate, so the button IS offered and the hard stop is
 * validatePublish's `publication.required.declined` error in the final
 * modal. The test asserts that real behavior end-to-end.
 */

// Publication status ints — lib/pkp/classes/publication/PKPPublication.php
// + classes/publication/Publication.php (READY_* are OJS-only).
const STATUS_QUEUED = 1;
const STATUS_PUBLISHED = 3;
const STATUS_DECLINED = 4;
const STATUS_SCHEDULED = 5;
const STATUS_READY_TO_PUBLISH = 6;

test.use({user: 'dbarnes'});

test.describe('Publication publish flow', () => {
	// Row 2
	test('publish is blocked by an unpaid publication fee', {tag: ['@regression', '@slow']}, async ({page, pkpApi, browser, baseURL}) => {
		// Scratch-journal setup drives two settings UIs before the workflow
		// part starts — give it the slow budget under parallel load.
		test.slow();
		const tag = uniqueTag('ppf2');
		// Scratch journal: payments config is journal-level state, so the
		// read-only publicknowledge journal can't host this row. One
		// published issue gives the publish flow an assignable target.
		const {context} = await pkpApi.createJournal({
			tag,
			users: [{username: 'dbarnes', roles: ['manager']}],
			issues: [{volume: 1, number: '1', year: 2026, published: true}],
		});

		// --- Enable payments (Distribution → Payments, Vue form) --------
		// Same form drive as subscription-config.spec.js: tick Enable,
		// pick the Manual Fee Payment plugin (its isConfigured() requires
		// non-empty manualInstructions), pick a currency, save.
		await page.goto(
			`/index.php/${context.path}/management/settings/distribution#payments`,
		);
		await page.locator('#payments-button').click();
		const paymentsForm = page
			.locator('form', {
				has: page.locator('label', {hasText: 'Payments will be enabled'}),
			})
			.first();
		await expect(paymentsForm).toBeVisible({timeout: 15_000});
		await paymentsForm
			.locator('label', {hasText: 'Payments will be enabled'})
			.first()
			.click();
		const pluginSelect = paymentsForm.locator(
			'select#paymentSettings-paymentPluginName-control',
		);
		await expect(pluginSelect).toBeVisible({timeout: 15_000});
		await pluginSelect.selectOption({label: 'Manual Fee Payment'});
		await paymentsForm
			.locator('select#paymentSettings-currency-control')
			.selectOption({label: 'Canadian Dollar'});
		const instrTextarea = paymentsForm.locator(
			'textarea#paymentSettings-manualInstructions-control',
		);
		await expect(instrTextarea).toBeVisible({timeout: 15_000});
		await instrTextarea.fill(`Pay the fee manually ${tag}.`);
		const settingsForm = page.locator('form', {
			has: page.locator(
				'textarea#paymentSettings-manualInstructions-control',
			),
		});
		const saveBtn = settingsForm.getByRole('button', {
			name: 'Save',
			exact: true,
		});
		await expect(saveBtn).toHaveCount(1);
		await saveBtn.scrollIntoViewIfNeeded();
		await Promise.all([
			page.waitForResponse(
				(res) =>
					/\/api\/v1\/(_payments|contexts\/\d+)/.test(res.url()) &&
					res.ok() &&
					['POST', 'PUT'].includes(res.request().method()),
				{timeout: 15_000},
			),
			saveBtn.click(),
		]);

		// --- Set the publication (APC) fee (Payments → Author Fees) -----
		// publicationEnabled() additionally requires publicationFee > 0;
		// the fee field lives on the legacy /payments page's paymentTypes
		// tab (jQuery TabHandler + AjaxFormHandler).
		await page.goto(`/index.php/${context.path}/payments`);
		await page.locator('a[name="paymentTypes"]').click();
		await waitForJQueryIdle(page);
		const feeForm = page.locator('form#paymentTypesForm');
		await expect(feeForm).toBeVisible({timeout: 15_000});
		await feeForm.locator('input[name="publicationFee"]').fill('100');
		await feeForm.locator('button[type="submit"]').click();
		await waitForJQueryIdle(page);
		// Re-open the tab; the persisted fee proves the save landed before
		// we lean on it in validatePublish.
		await page.goto(`/index.php/${context.path}/payments`);
		await page.locator('a[name="paymentTypes"]').click();
		await waitForJQueryIdle(page);
		await expect(
			page.locator('form#paymentTypesForm input[name="publicationFee"]'),
		).toHaveValue('100', {timeout: 15_000});

		// --- Seed the publishable submission (no payment recorded) ------
		const {submission} = await pkpApi.createSubmission(
			productionDraftSpec({
				tag,
				title: 'Fee-blocked article',
				journal: context.path,
			}),
		);

		const workflow = new EditorialWorkflowPage(page);
		await workflow.goto(submission.id, {journalPath: context.path});
		await workflow.openPublicationPanel('Title & Abstract');

		// The publish modal lists the named precondition from OJS
		// validatePublish() and offers no committing button (PublishForm
		// builds an error page without submitButton).
		const details = await workflow.openPublishingDetailsModal();
		const publishModal = await workflow.confirmPublishingDetails(details, {
			issueLabel: 'Vol. 1 No. 1 (2026)',
		});
		await expect(publishModal).toContainText(
			'The following requirements must be met before this can be published.',
		);
		await expect(publishModal).toContainText('Publication Fee not paid');
		await expect(
			publishModal.getByRole('button', {name: 'Publish', exact: true}),
		).toHaveCount(0);
		await expect(
			publishModal.getByRole('button', {
				name: 'Schedule For Publication',
				exact: true,
			}),
		).toHaveCount(0);

		// Model: the publication never reached published/scheduled. The
		// details-modal Confirm legitimately moved QUEUED →
		// READY_TO_PUBLISH (issue assignment persists), but no
		// datePublished is stamped and the article stays dark.
		const pub = await fetchFullPublication(page, submission.id, context.path);
		expect([STATUS_QUEUED, STATUS_READY_TO_PUBLISH]).toContain(pub.status);
		expect(pub.datePublished).toBeFalsy();
		await expectArticleStatus({
			browser,
			baseURL,
			journalPath: context.path,
			submissionId: submission.id,
			status: 404,
		});
	});

	// Row 3
	test('editor publishes without an issue (continuous publishing)', {tag: '@regression'}, async ({page, pkpApi, browser, baseURL}) => {
		const tag = uniqueTag('ppf3');
		const {submission} = await pkpApi.createSubmission(
			productionDraftSpec({tag, title: 'Issueless article'}),
		);

		const workflow = new EditorialWorkflowPage(page);
		await workflow.goto(submission.id);
		await workflow.openPublicationPanel('Title & Abstract');

		// "Don't Assign To An Issue" routes through STATUS_READY_TO_PUBLISH
		// with issueId=null; the confirmation modal calls out the
		// issue-less immediate publication before committing.
		const details = await workflow.openPublishingDetailsModal();
		const publishModal = await workflow.confirmPublishingDetails(details, {
			assignment: 'noIssue',
		});
		await expect(publishModal).toContainText(
			'published immediately without any issue association',
		);
		await publishModal
			.getByRole('button', {name: 'Publish', exact: true})
			.click();
		await expect(publishModal).toBeHidden({timeout: 15_000});

		// Model: published with no issue assignment.
		const pub = await fetchFullPublication(page, submission.id);
		expect(pub.status).toBe(STATUS_PUBLISHED);
		expect(pub.issueId).toBeNull();
		expect(pub.datePublished).toBeTruthy();

		// Reader: the landing page renders without any issue, and the
		// journal's current-issue TOC does not list it.
		const anonCtx = await anonymousContext(browser, baseURL);
		try {
			const anonPage = await anonCtx.newPage();
			const articleResp = await anonPage.goto(
				`/index.php/publicknowledge/article/view/${submission.id}`,
			);
			expect(articleResp?.status()).toBe(200);
			await expect(anonPage.locator('h1').first()).toContainText(
				'Issueless article',
			);

			const tocResp = await anonPage.goto(
				`/index.php/publicknowledge/issue/current`,
			);
			expect(tocResp?.status()).toBe(200);
			const toc = anonPage.locator('.obj_issue_toc');
			await expect(toc).toBeVisible({timeout: 10_000});
			await expect(
				toc.getByRole('link', {name: `Issueless article [${tag}]`}),
			).toHaveCount(0);
		} finally {
			await anonCtx.close();
		}
	});

	// Row 4
	test('author and assistant see no publish or unpublish controls', {tag: '@regression'}, async ({page, pkpApi, asUser}) => {
		const tag = uniqueTag('ppf4');
		const {submission} = await pkpApi.createSubmission(
			productionDraftSpec({
				tag,
				title: 'Permission-gated article',
				submitter: 'atester',
				participants: [
					{user: 'dbarnes', role: 'editor'},
					{user: 'gcox', role: 'layoutEditor'},
				],
			}),
		);

		// --- Author (atester) on the My Submissions dashboard -----------
		// workflowConfigAuthorOJS defines no publication primary controls
		// right, so no publish affordance can render. Bound the negative
		// on the version-control status chip ("Status: Unscheduled") that
		// authors DO get.
		const authorCtx = await asUser('atester');
		const authorPage = await authorCtx.newPage();
		await authorPage.goto(
			`/index.php/publicknowledge/en/dashboard/mySubmissions?workflowSubmissionId=${submission.id}`,
		);
		await openPublicationPanelOn(authorPage, 'Title & Abstract');
		await expectNoPublishControls(authorPage);

		// --- Assistant (gcox, layout editor) on the editorial dashboard --
		// Assistants get canAccessPublication (assigned editorial role on
		// the active production stage) but canPublish stays false — only
		// production-stage managers publish.
		const assistantCtx = await asUser('gcox');
		const assistantPage = await assistantCtx.newPage();
		await assistantPage.goto(
			`/index.php/publicknowledge/en/dashboard/editorial?workflowSubmissionId=${submission.id}`,
		);
		await openPublicationPanelOn(assistantPage, 'Title & Abstract');
		await expectNoPublishControls(assistantPage);

		// --- Editor (dbarnes) sanity: same panel exposes the control ----
		const workflow = new EditorialWorkflowPage(page);
		await workflow.goto(submission.id);
		await workflow.openPublicationPanel('Title & Abstract');
		await expect(
			controlsRight(page).getByRole('button', {
				name: 'Schedule For Publication',
				exact: true,
			}),
		).toBeVisible({timeout: 15_000});
	});

	// Row 5
	test('editor previews a scheduled article before it is public', {tag: '@regression'}, async ({page, pkpApi, browser, baseURL}) => {
		const tag = uniqueTag('ppf5');
		// `published: true` against the bootstrap's future issue
		// "Vol. 2 No. 1 (2015)" yields STATUS_SCHEDULED (publish() defers
		// to the unpublished issue). Assigning our own submission to the
		// shared future issue is allowed; the issue itself is never
		// published or otherwise mutated here.
		const {submission} = await pkpApi.createSubmission(
			productionDraftSpec({
				tag,
				title: 'Scheduled preview article',
				issue: {volume: 2, number: 1, year: 2015},
				published: true,
			}),
		);

		const workflow = new EditorialWorkflowPage(page);

		// Model: scheduled, not published.
		const pubsBefore = await workflow.fetchPublications(submission.id);
		expect(pubsBefore[0].status).toBe(STATUS_SCHEDULED);

		// Anonymous: still dark while scheduled. Checked before Preview so
		// the editor-page navigation below can't interleave.
		await expectArticleStatus({
			browser,
			baseURL,
			journalPath: 'publicknowledge',
			submissionId: submission.id,
			status: 404,
		});

		await workflow.goto(submission.id);
		await workflow.openPublicationPanel('Title & Abstract');

		// Scheduled-state affordances: status chip + Preview + Unschedule
		// (workflowConfigEditorialOJS's STATUS_SCHEDULED branch); the
		// publish/unpublish entry buttons are absent in this state.
		await expect(
			controlsLeft(page).getByText('Scheduled', {exact: true}),
		).toBeVisible({timeout: 15_000});
		const preview = controlsRight(page).getByRole('button', {
			name: 'Preview',
			exact: true,
		});
		await expect(preview).toBeVisible({timeout: 15_000});
		await expect(
			controlsRight(page).getByRole('button', {
				name: 'Unschedule',
				exact: true,
			}),
		).toBeVisible();
		await expect(
			controlsRight(page).getByRole('button', {
				name: 'Schedule For Publication',
				exact: true,
			}),
		).toHaveCount(0);

		// Preview redirects the editor to the article landing page
		// (urlPublished); editors pass Repo::submission()->canPreview so
		// the unpublished article renders for them.
		await Promise.all([
			page.waitForURL(/\/article\/view\//, {
				timeout: 15_000,
				waitUntil: 'commit',
			}),
			preview.click(),
		]);
		await expect(page.locator('h1').first()).toContainText(
			'Scheduled preview article',
			{timeout: 15_000},
		);
	});

	// Row 6
	test('cancelling the publish dialog leaves the publication untouched', {tag: '@regression'}, async ({page, pkpApi, browser, baseURL}) => {
		const tag = uniqueTag('ppf6');
		const {submission} = await pkpApi.createSubmission(
			productionDraftSpec({tag, title: 'Cancelled publish article'}),
		);

		const workflow = new EditorialWorkflowPage(page);
		await workflow.goto(submission.id);
		await workflow.openPublicationPanel('Title & Abstract');

		// The details modal renders the issue-assignment choices and the
		// version fields (requirements review). Cancel before Confirm —
		// Confirm is the step that persists, so cancelling here is the
		// only path that provably leaves STATUS_QUEUED in place.
		const details = await workflow.openPublishingDetailsModal();
		await expect(
			details.getByText(/Assign To Current\/Back Issue/i),
		).toBeVisible({timeout: 15_000});
		await expect(details.locator('select[name=versionStage]')).toBeVisible();
		await expect(
			details.getByRole('button', {name: 'Confirm', exact: true}),
		).toBeVisible();
		await workflow.cancelPublishingDetails(details);

		// Model untouched: still queued, no datePublished, reader 404.
		const pubs = await workflow.fetchPublications(submission.id);
		expect(pubs[0].status).toBe(STATUS_QUEUED);
		expect(pubs[0].datePublished).toBeFalsy();

		// The entry button is immediately available again.
		await expect(
			controlsRight(page).getByRole('button', {
				name: 'Schedule For Publication',
				exact: true,
			}),
		).toBeVisible({timeout: 15_000});

		await expectArticleStatus({
			browser,
			baseURL,
			journalPath: 'publicknowledge',
			submissionId: submission.id,
			status: 404,
		});
	});

	// Row 7
	test('publishing moves the submission to the published dashboard view', {tag: '@regression'}, async ({page, pkpApi}) => {
		const tag = uniqueTag('ppf7');
		// Control submission stays in production so the absence assertion
		// on the production view is bounded by a positive row match under
		// the same search.
		const {submission} = await pkpApi.createSubmission(
			productionDraftSpec({tag, title: `Pub-${tag}`}),
		);
		await pkpApi.createSubmission(
			productionDraftSpec({tag, title: `Ctl-${tag}`}),
		);

		const workflow = new EditorialWorkflowPage(page);
		await workflow.goto(submission.id);
		await workflow.openPublicationPanel('Title & Abstract');
		await workflow.publishCurrentPanel();

		const pubs = await workflow.fetchPublications(submission.id);
		expect(pubs[0].status).toBe(STATUS_PUBLISHED);

		// Published view lists it with the "Published" stage badge.
		const dashboard = new DashboardPage(page);
		await dashboard.gotoEditorial({view: 'published'});
		await expect(dashboard.viewHeading(/Published/)).toBeVisible({
			timeout: 15_000,
		});
		await dashboard.search(tag);
		const publishedRow = dashboard.row(`Pub-${tag}`);
		await expect(publishedRow).toBeVisible({timeout: 15_000});
		await expect(publishedRow).toContainText('Published');

		// It left the active production queue; the unpublished control
		// submission still shows under the same tag search.
		await dashboard.gotoEditorial({view: 'production'});
		await expect(
			dashboard.viewHeading(/All in production stage/),
		).toBeVisible({timeout: 15_000});
		await dashboard.search(tag);
		await expect(dashboard.row(`Ctl-${tag}`)).toBeVisible({timeout: 15_000});
		await expect(page.getByText(`Pub-${tag}`)).toHaveCount(0);
	});

	// Row 8
	test('declined submission cannot be published (validatePublish blocks)', {tag: '@regression'}, async ({page, pkpApi}) => {
		const tag = uniqueTag('ppf8');
		const {submission} = await pkpApi.createSubmission({
			tag,
			journal: 'publicknowledge',
			submitter: 'rvaca',
			section: 'ART',
			locale: 'en',
			participants: [{user: 'dbarnes', role: 'editor'}],
			decisions: [{type: 'initialDecline', by: 'dbarnes'}],
			publications: [
				{
					versionStage: 'VoR',
					metadata: {
						title: {en: 'Declined article'},
						abstract: {en: '<p>A declined submission.</p>'},
						copyrightHolder: {en: 'The Author'},
						copyrightYear: 2026,
						licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
					},
					published: false,
				},
			],
		});

		const workflow = new EditorialWorkflowPage(page);
		await workflow.goto(submission.id);

		// Declined state on the workflow: the submission-stage action rail
		// offers Revert Decline (the only path back) and no Send for
		// Review; the model concurs.
		await expect(
			workflow
				.actionItems()
				.getByRole('button', {name: 'Revert Decline', exact: true}),
		).toBeVisible({timeout: 15_000});
		await expect(
			workflow
				.actionItems()
				.getByRole('button', {name: 'Send for Review', exact: true}),
		).toHaveCount(0);
		const sub = await workflow.fetchSubmission(submission.id);
		expect(sub.status).toBe(STATUS_DECLINED);

		// Publication tab reality check: the Schedule For Publication
		// button is still offered (no declined gate in
		// workflowConfigEditorialOJS#getPrimaryControlsRight — plan row 8
		// expected it hidden); the decline is enforced by validatePublish
		// in the final confirmation modal instead: the named error
		// renders and no committing button exists.
		await workflow.openPublicationPanel('Title & Abstract');
		const details = await workflow.openPublishingDetailsModal();
		const publishModal = await workflow.confirmPublishingDetails(details);
		await expect(publishModal).toContainText(
			'A declined submission can not be published.',
		);
		await expect(
			publishModal.getByRole('button', {name: 'Publish', exact: true}),
		).toHaveCount(0);
		await expect(
			publishModal.getByRole('button', {
				name: 'Schedule For Publication',
				exact: true,
			}),
		).toHaveCount(0);

		// Model: still declined, nothing published.
		const pubs = await workflow.fetchPublications(submission.id);
		expect([STATUS_QUEUED, STATUS_READY_TO_PUBLISH]).toContain(
			pubs[0].status,
		);
		expect(pubs[0].datePublished).toBeFalsy();
		const subAfter = await workflow.fetchSubmission(submission.id);
		expect(subAfter.status).toBe(STATUS_DECLINED);
	});
});

/**
 * Production-stage draft VoR scenario spec with full publishable
 * metadata. skipExternalReview → sendToProduction is the shortest
 * decision chain that lands in WORKFLOW_STAGE_ID_PRODUCTION without
 * carrying a review round.
 *
 * @param {object} opts
 * @param {string} opts.tag
 * @param {string} opts.title
 * @param {string} [opts.journal='publicknowledge']
 * @param {string} [opts.submitter='rvaca']
 * @param {Array<{user: string, role: string}>} [opts.participants]
 * @param {{volume: number, number: number|string, year: number}} [opts.issue]
 * @param {boolean} [opts.published=false]
 */
function productionDraftSpec({
	tag,
	title,
	journal = 'publicknowledge',
	submitter = 'rvaca',
	participants = [{user: 'dbarnes', role: 'editor'}],
	issue,
	published = false,
}) {
	return {
		tag,
		journal,
		submitter,
		section: 'ART',
		locale: 'en',
		participants,
		decisions: [
			{type: 'skipExternalReview', by: 'dbarnes'},
			{type: 'sendToProduction', by: 'dbarnes'},
		],
		publications: [
			{
				versionStage: 'VoR',
				metadata: {
					title: {en: title},
					abstract: {
						en: '<p>A production-stage article for the publish-flow rows.</p>',
					},
					copyrightHolder: {en: 'The Author'},
					copyrightYear: 2026,
					licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
					pages: '1-10',
					keywords: {en: ['publish', 'flow']},
				},
				...(issue ? {issue} : {}),
				published,
			},
		],
	};
}

/**
 * A genuinely anonymous browser context. With `test.use({user})` in
 * effect, `browser.newContext()` inherits the test's `storageState`
 * option — i.e. the "anonymous" context silently carries the editor's
 * session and unpublished articles render via canPreview() instead of
 * 404ing. Forcing an empty storage state restores reader semantics.
 *
 * @param {import('@playwright/test').Browser} browser
 * @param {string} [baseURL]
 */
function anonymousContext(browser, baseURL) {
	return browser.newContext({
		baseURL,
		storageState: {cookies: [], origins: []},
	});
}

/** The workflow page's hosting side-modal on any dashboard variant. */
function workflowModal(page) {
	return page.locator('[data-cy="active-modal"]').first();
}

/** The publication panel's right-hand primary controls strip. */
function controlsRight(page) {
	return workflowModal(page).locator('[data-cy="workflow-controls-right"]');
}

/** The publication panel's left-hand primary controls strip (status chip). */
function controlsLeft(page) {
	return workflowModal(page).locator('[data-cy="workflow-controls-left"]');
}

/**
 * Open a Publication sub-panel on whichever workflow view `page` shows
 * (editorial or author dashboard). Mirrors
 * EditorialWorkflowPage#openReviewRoundPanel's expand-if-collapsed
 * pattern for the Publication nav group.
 */
async function openPublicationPanelOn(page, label) {
	const nav = workflowModal(page).locator('nav');
	const item = nav.getByText(label, {exact: true}).first();
	if (!(await item.isVisible().catch(() => false))) {
		await nav.getByText('Publication', {exact: true}).first().click();
	}
	await expect(item).toBeVisible({timeout: 15_000});
	await item.click();
}

/**
 * Assert the open publication panel exposes NO publish-cycle controls.
 * Bounded by the version-control status chip ("Status: Unscheduled"),
 * which renders for every role on the same controls row — proving the
 * panel hydrated before the negatives are trusted.
 */
async function expectNoPublishControls(page) {
	await expect(controlsLeft(page).getByText('Status:')).toBeVisible({
		timeout: 20_000,
	});
	await expect(
		controlsLeft(page).getByText('Unscheduled', {exact: true}),
	).toBeVisible({timeout: 15_000});
	for (const name of [
		'Schedule For Publication',
		'Publish',
		'Unpublish',
		'Unschedule',
	]) {
		await expect(
			workflowModal(page).getByRole('button', {name, exact: true}),
		).toHaveCount(0);
	}
}

/**
 * Fetch the full publication payload for a submission's current
 * publication (the `…/publications` collection summary omits issueId).
 *
 * @param {import('@playwright/test').Page} page  authenticated page
 * @param {number} submissionId
 * @param {string} [journalPath='publicknowledge']
 */
async function fetchFullPublication(
	page,
	submissionId,
	journalPath = 'publicknowledge',
) {
	const subRes = await page.request.get(
		`/index.php/${journalPath}/api/v1/submissions/${submissionId}`,
	);
	if (!subRes.ok()) {
		throw new Error(`GET submission: ${subRes.status()} ${await subRes.text()}`);
	}
	const subBody = await subRes.json();
	const pubRes = await page.request.get(
		`/index.php/${journalPath}/api/v1/submissions/${submissionId}/publications/${subBody.currentPublicationId}`,
	);
	if (!pubRes.ok()) {
		throw new Error(`GET publication: ${pubRes.status()} ${await pubRes.text()}`);
	}
	return pubRes.json();
}

/**
 * Anonymous GET of the public article landing page; asserts the given
 * HTTP status (200 for published, 404 for dark).
 *
 * @param {{
 *   browser: import('@playwright/test').Browser,
 *   baseURL?: string,
 *   journalPath: string,
 *   submissionId: number,
 *   status: number,
 * }} opts
 */
async function expectArticleStatus({
	browser,
	baseURL,
	journalPath,
	submissionId,
	status,
}) {
	const ctx = await anonymousContext(browser, baseURL);
	try {
		const page = await ctx.newPage();
		const resp = await page.goto(
			`/index.php/${journalPath}/article/view/${submissionId}`,
		);
		expect(resp?.status()).toBe(status);
	} finally {
		await ctx.close();
	}
}

/**
 * Worker-scoped unique tag (whitespace-free, short enough for the
 * 32-char journals.urlPath cap when used as a scratch-journal tag).
 *
 * @param {string} prefix
 */
function uniqueTag(prefix) {
	const workerIndex = test.info().parallelIndex;
	const suffix = Math.random().toString(36).slice(2, 8);
	return `${prefix}-w${workerIndex}-${suffix}`;
}
