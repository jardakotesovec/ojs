// @ts-check
const {test, expect} = require('../support/fixtures.js');
const {EditorialWorkflowPage} = require('../pages/EditorialWorkflowPage.js');
const {IssuePage} = require('../pages/IssuePage.js');
const {DashboardPage} = require('../../lib/pkp/playwright/pages/DashboardPage.js');
const submissionPublished = require('../fixtures/scenarios/submission-published.js');

/**
 * Issue assignment & scheduling —
 * docs/e2e/plans/issue-assignment-scheduling.md (5 rows).
 *
 * Row 1 (reassign between published issues) keeps the original spec
 * below; rows 2–5 add the schedule / unschedule / back-issue-publish
 * lifecycle:
 *
 *   Row 2 — schedule into publicknowledge's shared future issue
 *           Vol. 2 No. 1 (2015). Per-test submission only; the shared
 *           issue itself is never mutated (charter principle 1) — adding
 *           our own article to its TOC is per-submission state.
 *   Row 3 — scratch journal: seeded-scheduled article goes live when the
 *           ISSUE is published (issue publishing happens only on scratch
 *           journals); the issue becomes current.
 *   Row 4 — unschedule a seeded-scheduled article on publicknowledge's
 *           future issue; status reverts, TOC entry disappears.
 *   Row 5 — publish into the published back issue Vol. 1 No. 2 (2014)
 *           immediately, then unpublish; reader TOC + landing react.
 *
 * Status model exercised (grep-verified constants):
 *   - "Assign To Future Issue and Schedule Only" PUTs publication
 *     status STATUS_READY_TO_SCHEDULE(7) + issueId; the follow-up
 *     publish PUT lands on STATUS_SCHEDULED(5)
 *     (classes/publication/Repository.php#setStatusOnPublish).
 *   - Scenario seeding `issue` (unpublished) + `published: true`
 *     produces the same STATUS_SCHEDULED state (PublicationsProcessor →
 *     Repo::publication()->publish, same code path).
 *   - Unschedule reuses the unpublish endpoint → STATUS_QUEUED(1)
 *     (lib/pkp/classes/publication/Repository.php#unpublish); the
 *     publication keeps its issueId but leaves the TOC because the TOC
 *     grid filters by submission status
 *     (classes/submission/Repository.php#getInSections).
 *   - IssueGridHandler::publishIssue publishes every scheduled
 *     publication attached to the issue and promotes the issue to
 *     current (classes/controllers/grid/issues/IssueGridHandler.php#594-627).
 *
 * Original row-1 notes follow.
 *
 * Graduated from DEFERRED. The original deferral note flagged a publication-
 * status race in the Issue side-modal save: saving the Issue panel flips the
 * publication to STATUS_READY_TO_PUBLISH, which changes which modal opens
 * when the editor next clicks Publish (skips the Review Publishing Details
 * step and goes straight to the publishModal). The simpler reassign path
 * sidestepped here is to unpublish first (which flips the status back to
 * STATUS_QUEUED) and then re-publish via `EditorialWorkflowPage#publishCurrentPanel`,
 * picking the new issue inside the Review Publishing Details side-modal —
 * the same code path the POM already exercises for first-time publish.
 *
 * Scope:
 *   - One round-trip test: editor unpublishes a published article, re-publishes
 *     it to a different published issue. Anonymous reader confirms the article
 *     appears in the new issue's TOC and is no longer in the old one.
 *
 *   - Drop the Cypress source's "unassign" arm. After OJS introduced the
 *     IssueAssignment enum (NO_ISSUE / FUTURE_PUBLISHED / FUTURE_SCHEDULED /
 *     CURRENT_BACK_PUBLISHED), unassigning maps to the NO_ISSUE option —
 *     i.e. "Don't Assign To An Issue", which sets issueId=null and STATUS_READY_TO_PUBLISH.
 *     Asserting that round-trip needs an extra modal save + a different reader
 *     surface (continuous-publishing list, not an issue TOC), which is its
 *     own row's worth of work. The capability gate this row needs — a
 *     published article moves between issues and the public TOCs reflect the
 *     move — is fully exercised by the move arm.
 *
 *   - Drop driving the standalone Issue-tab side-modal save. That path is
 *     what the original deferral note pointed at; the unpublish + re-publish
 *     route covers the same UI invariants (issue dropdown, status flip,
 *     publication's issueId persistence) without the modal-stacking race.
 *     If a future row needs the in-place issue swap, factor an
 *     `editIssuePanel()` helper into the POM at that point.
 *
 * E0 scratch journal — the bootstrap publicknowledge journal only seeds
 * one published issue (Vol. 1 No. 2 (2014)); a clean reassign-between-
 * published-issues test needs at least two. We create a scratch journal
 * with two published issues + one future issue (so the IssueAssignment
 * enum exposes both relevant options) and seed `submissionPublished` to
 * the first published issue inside that scratch journal.
 */

const SCRATCH_ISSUES = {
	source: {volume: 1, number: '1', year: 2026},
	target: {volume: 7, number: '2', year: 2026},
};

/** Bootstrap-seeded publicknowledge issues (playwright/fixtures/bootstrap.js). */
const PK_FUTURE_ISSUE = {volume: 2, number: '1', year: 2015}; // unpublished
const PK_BACK_ISSUE = {volume: 1, number: '2', year: 2014}; // published
const PK_FUTURE_LABEL = 'Vol. 2 No. 1 (2015)';
const PK_BACK_LABEL = 'Vol. 1 No. 2 (2014)';

test.describe('Issue assignment', () => {
	// Single-actor default for rows 2–5 (dbarnes is an editor on
	// publicknowledge — the "Journal editor" group carries
	// ROLE_ID_MANAGER, so manageIssues + unpublished-issue API access
	// both work). Row 1 doesn't consume the `page` fixture, so this has
	// no effect on it.
	test.use({user: 'dbarnes'});
	test(
		'editor reassigns a published article between issues; reader TOCs reflect the move',
		{tag: '@regression'},
		async ({pkpApi, asUser, browser, baseURL}) => {
			const tag = uniqueTag(test.info(), 'reassign');

			// Two published issues + dbarnes as manager. IssueProcessor's
			// `published: true` branch promotes each issue in order via
			// Repo::issue::updateCurrent, so the second seeded issue ends
			// up as the journal's current — that's our reassignment target.
			const {context} = await pkpApi.createJournal({
				tag,
				users: [{username: 'dbarnes', roles: ['manager']}],
				issues: [
					{...SCRATCH_ISSUES.source, published: true},
					{...SCRATCH_ISSUES.target, published: true},
				],
			});

			// Seed the published submission against the source issue inside
			// the scratch journal. Override `journal` and `issue` so the
			// scenario's PublicationsProcessor resolves the right context
			// and looks up the right issue id.
			const spec = submissionPublished({tag});
			spec.journal = context.path;
			spec.publications[0].issue = {...SCRATCH_ISSUES.source};
			spec.publications[0].metadata.title.en = 'Reassign article';
			// PublicationsProcessor appends ` [${tag}]` to every title locale
			// for parallel isolation (see PublicationsProcessor.php#108-110),
			// so the rendered article title is "Reassign article [tag]".
			const articleTitle = `Reassign article [${tag}]`;
			const {submission} = await pkpApi.createSubmission(spec);

			// --- Editor: unpublish + republish to the target issue ----------
			const editorCtx = await asUser('dbarnes');
			const editorPage = await editorCtx.newPage();
			const workflow = new EditorialWorkflowPage(editorPage);

			// Resolve issue ids so the reader-side TOC URLs are deterministic.
			// The issues endpoint is gated on has.user — fetch through the
			// editor's authenticated request fixture, not an anonymous one.
			const issuesResp = await editorPage.request.get(
				`/index.php/${context.path}/api/v1/issues?count=100`,
			);
			expect(issuesResp.ok(), 'list issues').toBe(true);
			const issuesBody = await issuesResp.json();
			const issueItems = issuesBody.items || issuesBody;
			const sourceIssue = issueItems.find(
				(i) =>
					i.volume === SCRATCH_ISSUES.source.volume &&
					String(i.number) === SCRATCH_ISSUES.source.number &&
					i.year === SCRATCH_ISSUES.source.year,
			);
			const targetIssue = issueItems.find(
				(i) =>
					i.volume === SCRATCH_ISSUES.target.volume &&
					String(i.number) === SCRATCH_ISSUES.target.number &&
					i.year === SCRATCH_ISSUES.target.year,
			);
			expect(sourceIssue, 'source issue resolved').toBeTruthy();
			expect(targetIssue, 'target issue resolved').toBeTruthy();

			await editorPage.goto(
				`/index.php/${context.path}/en/dashboard/editorial?workflowSubmissionId=${submission.id}`,
			);

			// Unpublishing requires opening a publication sub-panel that
			// renders the Unpublish button — Title & Abstract is universal.
			// `WorkflowPublicationEditWarning` blocks editing fields on a
			// published publication, but the Unpublish action itself is
			// always available.
			await workflow.openPublicationPanel('Title & Abstract');
			await workflow.unpublishCurrentPanel();

			// After unpublish, status flips to STATUS_QUEUED. The publication
			// keeps versionStage=VoR but loses STATUS_READY_TO_PUBLISH, so the
			// next Publish click fully re-opens the Review Publishing Details
			// modal — the path `publishCurrentPanel` already drives.
			const beforeRepublish = await fetchFullPublication(
				editorPage,
				submission.id,
				context.path,
			);
			expect(beforeRepublish.status).toBe(STATUS_QUEUED);
			expect(beforeRepublish.issueId).toBe(sourceIssue.id);

			// Re-publish to the target issue. The POM picks the issue by
			// option label inside the Review Publishing Details side-modal.
			const targetLabel = `Vol. ${SCRATCH_ISSUES.target.volume} No. ${SCRATCH_ISSUES.target.number} (${SCRATCH_ISSUES.target.year})`;
			await workflow.publishCurrentPanel({issueLabel: targetLabel});

			// Confirm the publication moved to the target issue and is
			// published again — the load-bearing model invariant.
			const afterRepublish = await fetchFullPublication(
				editorPage,
				submission.id,
				context.path,
			);
			expect(afterRepublish.status).toBe(STATUS_PUBLISHED);
			expect(afterRepublish.issueId).toBe(targetIssue.id);

			// --- Reader: anonymous browser confirms the move ----------------
			await expectArticleInIssueToc({
				browser,
				baseURL,
				journalPath: context.path,
				issueId: targetIssue.id,
				articleTitle,
			});
			await expectArticleNotInIssueToc({
				browser,
				baseURL,
				journalPath: context.path,
				issueId: sourceIssue.id,
				articleTitle,
			});
		},
	);

	// Row 2 — schedule into publicknowledge's future issue. The shared
	// issue stays unpublished and unmutated; the only state we add is our
	// own per-test submission's assignment to it.
	test(
		'editor schedules an article into a future issue',
		{tag: '@regression'},
		async ({page, pkpApi, browser, baseURL}) => {
			const tag = uniqueTag(test.info(), 'sched');
			const {submission} = await pkpApi.createSubmission(
				productionDraftSpec({tag, title: 'Scheduled article'}),
			);
			const articleTitle = `Scheduled article [${tag}]`;

			const workflow = new EditorialWorkflowPage(page);
			await workflow.goto(submission.id);
			await workflow.openPublicationPanel('Title & Abstract');
			await scheduleCurrentPanelIntoFutureIssue(page, workflow, {
				issueLabel: PK_FUTURE_LABEL,
			});

			// Workflow chip: the publication panel's status indicator
			// (WorkflowPublicationVersionControl) renders "Status:" +
			// "Scheduled" in sibling spans — getByText resolves to their
			// shared parent. The Unschedule affordance replacing Schedule
			// For Publication is the second signal of the flip.
			const modal = workflow.workflowModal();
			await expect(modal.getByText('Status: Scheduled')).toBeVisible({
				timeout: 15_000,
			});
			await expect(
				modal.getByRole('button', {name: 'Unschedule', exact: true}),
			).toBeVisible();

			// Model invariants: publication scheduled into the future issue,
			// submission status follows.
			const futureIssueId = await resolveIssueId(
				page,
				'publicknowledge',
				PK_FUTURE_ISSUE,
			);
			const publication = await fetchFullPublication(
				page,
				submission.id,
				'publicknowledge',
			);
			expect(publication.status).toBe(STATUS_SCHEDULED);
			expect(publication.issueId).toBe(futureIssueId);

			// APP BUG (ledger candidate, do not "fix" by asserting on it):
			// the publish PUT (PKPSubmissionController::publishPublication,
			// lib/pkp/api/v1/submissions/PKPSubmissionController.php:1456)
			// hard-codes `updateStatus($submission, STATUS_PUBLISHED)` even
			// when setStatusOnPublish left the publication STATUS_SCHEDULED,
			// so a UI-scheduled submission carries submissions.status=3 and
			// lands in the dashboard "Published" view instead of "Scheduled
			// for publication" (which filters submission status 5), and the
			// "To be published in issue" activity alert never renders. The
			// dashboard-badge half of this plan row is therefore asserted on
			// the seeded scheduled state in the unschedule test below (the
			// scenario path computes STATUS_SCHEDULED correctly — the state
			// the UI flow will produce once fixed); move it back here when
			// the ledger row is resolved.

			// Reader: a scheduled article is not public.
			await expectAnonymousArticle404({
				browser,
				baseURL,
				journalPath: 'publicknowledge',
				submissionId: submission.id,
			});

			// The future issue's manage-issues TOC tab lists the article
			// (the TOC grid includes STATUS_SCHEDULED submissions).
			const issuePage = new IssuePage(page);
			await issuePage.goto('publicknowledge');
			await issuePage.openFutureIssueToc(PK_FUTURE_ISSUE);
			await expect(issuePage.tocEntry(articleTitle)).toBeVisible({
				timeout: 15_000,
			});
		},
	);

	// Row 3 — scratch journal: publishing the ISSUE flips the seeded
	// scheduled article live and makes the issue current. Issue
	// publishing only ever happens on scratch journals (charter
	// principle 1).
	test(
		'scheduled article goes live when its issue is published',
		{tag: '@regression'},
		async ({page, pkpApi, browser, baseURL}) => {
			const tag = uniqueTag(test.info(), 'golive');
			const futureIssue = {volume: 3, number: '1', year: 2030};

			const {context} = await pkpApi.createJournal({
				tag,
				users: [{username: 'dbarnes', roles: ['manager']}],
				issues: [{...futureIssue, published: false}],
			});

			// Seed the submission scheduled into the scratch journal's
			// future issue: `issue` ref + `published: true` against an
			// unpublished issue produces STATUS_SCHEDULED.
			const spec = submissionPublished({tag});
			spec.journal = context.path;
			spec.publications[0].issue = {...futureIssue};
			spec.publications[0].metadata.title.en = 'Issue launch article';
			const articleTitle = `Issue launch article [${tag}]`;
			const {submission} = await pkpApi.createSubmission(spec);

			const beforePublish = await fetchFullPublication(
				page,
				submission.id,
				context.path,
			);
			expect(beforePublish.status).toBe(STATUS_SCHEDULED);
			// Scheduled publications carry no datePublished yet — publishing
			// the issue is what stamps it.
			expect(beforePublish.datePublished).toBeFalsy();

			// Publish the issue from the manage-issues future grid.
			// sendNotification stays off — Mailpit is shared across workers.
			const issuePage = new IssuePage(page);
			await issuePage.goto(context.path);
			await issuePage.publishIssue(futureIssue);

			// The attached scheduled publication flipped live.
			const afterPublish = await fetchFullPublication(
				page,
				submission.id,
				context.path,
			);
			expect(afterPublish.status).toBe(STATUS_PUBLISHED);
			expect(afterPublish.datePublished).toBeTruthy();

			const issueId = await resolveIssueId(page, context.path, futureIssue);

			// Anonymous reader: /issue/current redirects to the newly
			// published issue (it was promoted via Repo::issue::updateCurrent),
			// whose TOC lists the article; the article landing page is live.
			const anon = await browser.newContext({
				baseURL,
				storageState: ANON_STORAGE_STATE,
			});
			try {
				const anonPage = await anon.newPage();
				const currentResp = await anonPage.goto(
					`/index.php/${context.path}/issue/current`,
				);
				expect(currentResp?.status()).toBe(200);
				await expect(anonPage).toHaveURL(
					new RegExp(`/issue/view/${issueId}(?:$|[/?#])`),
				);
				await expect(
					anonPage.locator('h1', {
						hasText: `Vol. ${futureIssue.volume} No. ${futureIssue.number} (${futureIssue.year})`,
					}),
				).toBeVisible({timeout: 10_000});
				await expect(
					anonPage
						.locator('.obj_issue_toc')
						.getByRole('link', {name: articleTitle}),
				).toBeVisible({timeout: 10_000});

				const articleResp = await anonPage.goto(
					`/index.php/${context.path}/article/view/${submission.id}`,
				);
				expect(articleResp?.status()).toBe(200);
			} finally {
				await anon.close();
			}
		},
	);

	// Row 4 — unschedule a seeded-scheduled article on publicknowledge's
	// shared future issue. The positive TOC check before unscheduling
	// bounds the absence check after it (same navigation path).
	test(
		'editor unschedules a scheduled article',
		{tag: '@regression'},
		async ({page, pkpApi, browser, baseURL}) => {
			const tag = uniqueTag(test.info(), 'unsched');
			const spec = productionDraftSpec({tag, title: 'Unschedule target'});
			spec.publications[0].issue = {...PK_FUTURE_ISSUE};
			spec.publications[0].published = true; // future issue → STATUS_SCHEDULED
			const articleTitle = `Unschedule target [${tag}]`;
			const {submission} = await pkpApi.createSubmission(spec);

			const seeded = await fetchFullPublication(
				page,
				submission.id,
				'publicknowledge',
			);
			expect(seeded.status).toBe(STATUS_SCHEDULED);

			// Dashboard badge for the scheduled state (covers the
			// dashboard-badge half of plan row 2 — see the app-bug note in
			// the schedule test above): the "Scheduled for publication"
			// view filters submissions by STATUS_SCHEDULED; the row carries
			// the "Scheduled" stage badge and the to-be-published-in-issue
			// activity alert.
			const dashboard = new DashboardPage(page);
			await dashboard.gotoEditorial({view: 'scheduled'});
			await expect(
				dashboard.viewHeading(/Scheduled for publication/),
			).toBeVisible({timeout: 15_000});
			await dashboard.search(tag);
			await expect(dashboard.row(tag)).toBeVisible({timeout: 15_000});
			await expect(dashboard.row(tag)).toContainText('Scheduled');
			await expect(dashboard.row(tag)).toContainText(
				`To be published in issue ${PK_FUTURE_LABEL}`,
			);

			// Positive control: the scheduled article is on the future
			// issue's manage-issues TOC tab.
			const issuePage = new IssuePage(page);
			await issuePage.goto('publicknowledge');
			await issuePage.openFutureIssueToc(PK_FUTURE_ISSUE);
			await expect(issuePage.tocEntry(articleTitle)).toBeVisible({
				timeout: 15_000,
			});

			// Editor unschedules from the publication panel.
			const workflow = new EditorialWorkflowPage(page);
			await workflow.goto(submission.id);
			await workflow.openPublicationPanel('Title & Abstract');
			const modal = workflow.workflowModal();
			await expect(modal.getByText('Status: Scheduled')).toBeVisible({
				timeout: 15_000,
			});
			await unscheduleCurrentPanel(page, modal);

			// Status reverts to Unscheduled/queued and the Schedule For
			// Publication entry point returns.
			await expect(modal.getByText('Status: Unscheduled')).toBeVisible({
				timeout: 15_000,
			});
			await expect(
				modal.getByRole('button', {
					name: 'Schedule For Publication',
					exact: true,
				}),
			).toBeVisible();
			const unscheduled = await fetchFullPublication(
				page,
				submission.id,
				'publicknowledge',
			);
			expect(unscheduled.status).toBe(STATUS_QUEUED);

			// Gone from the TOC tab (the grid filters by submission status;
			// the openFutureIssueToc helper waits for the grid load, and the
			// pre-unschedule positive control bounds this negative).
			await issuePage.goto('publicknowledge');
			await issuePage.openFutureIssueToc(PK_FUTURE_ISSUE);
			await expect(issuePage.tocEntry(articleTitle)).toHaveCount(0);

			// Reader URL still 404s.
			await expectAnonymousArticle404({
				browser,
				baseURL,
				journalPath: 'publicknowledge',
				submissionId: submission.id,
			});
		},
	);

	// Row 5 — assign to the published back issue and publish immediately;
	// unpublishing removes the public TOC entry and the landing 404s.
	// Adding/removing our own article to a published issue's TOC is
	// per-submission state — the shared issue's own settings are never
	// touched.
	test(
		'editor publishes into a back issue immediately; unpublish removes the TOC entry',
		{tag: '@regression'},
		async ({page, pkpApi, browser, baseURL}) => {
			const tag = uniqueTag(test.info(), 'backpub');
			const {submission} = await pkpApi.createSubmission(
				productionDraftSpec({tag, title: 'Back issue article'}),
			);
			const articleTitle = `Back issue article [${tag}]`;

			const workflow = new EditorialWorkflowPage(page);
			await workflow.goto(submission.id);
			await workflow.openPublicationPanel('Title & Abstract');
			// POM default targets the bootstrap back issue Vol. 1 No. 2
			// (2014) via "Assign To Current/Back Issue" → publish modal's
			// "Publish" commit (READY_TO_PUBLISH → published immediately).
			await workflow.publishCurrentPanel({issueLabel: PK_BACK_LABEL});

			const backIssueId = await resolveIssueId(
				page,
				'publicknowledge',
				PK_BACK_ISSUE,
			);
			const published = await fetchFullPublication(
				page,
				submission.id,
				'publicknowledge',
			);
			expect(published.status).toBe(STATUS_PUBLISHED);
			expect(published.issueId).toBe(backIssueId);
			expect(published.datePublished).toBeTruthy();

			// Anonymous reader: the back issue's public TOC lists it.
			await expectArticleInIssueToc({
				browser,
				baseURL,
				journalPath: 'publicknowledge',
				issueId: backIssueId,
				articleTitle,
			});

			// Unpublish from the (still open) publication panel.
			await workflow.unpublishCurrentPanel();
			const unpublished = await fetchFullPublication(
				page,
				submission.id,
				'publicknowledge',
			);
			expect(unpublished.status).toBe(STATUS_QUEUED);

			// TOC entry gone; the issue page itself still loads (200) —
			// that bounds the negative. Landing 404s for anonymous.
			await expectArticleNotInIssueToc({
				browser,
				baseURL,
				journalPath: 'publicknowledge',
				issueId: backIssueId,
				articleTitle,
			});
			await expectAnonymousArticle404({
				browser,
				baseURL,
				journalPath: 'publicknowledge',
				submissionId: submission.id,
			});
		},
	);
});

// Publication status ints — see lib/pkp/classes/submission/PKPSubmission.php
// + classes/publication/Publication.php.
const STATUS_QUEUED = 1;
const STATUS_PUBLISHED = 3;
const STATUS_SCHEDULED = 5;

/**
 * Explicit empty storage state for genuinely-anonymous reader contexts.
 * With `test.use({user: 'dbarnes'})` active, contexts created through
 * the wrapped `browser` fixture inherit the worker's configured
 * `storageState` — `browser.newContext({baseURL})` alone would silently
 * produce a LOGGED-IN context (dbarnes can preview unpublished
 * articles, turning the 404 assertions into false 200s).
 */
const ANON_STORAGE_STATE = {cookies: [], origins: []};

/**
 * Scenario spec for a production-stage submission whose VoR publication
 * carries full metadata but is neither issue-assigned nor published —
 * the state an editor is in right before Schedule For Publication.
 * Derived from the submission-published fixture with the publish step
 * stripped (publication stays STATUS_QUEUED, versionStage VoR).
 *
 * @param {{tag: string, title: string}} opts
 */
function productionDraftSpec({tag, title}) {
	const spec = submissionPublished({tag});
	spec.publications[0].metadata.title.en = title;
	delete spec.publications[0].issue;
	delete spec.publications[0].published;
	return spec;
}

/**
 * Resolve a bootstrap/scratch issue's id by volume/number/year through
 * the issues API with the page's session cookies. dbarnes passes the
 * controller's unpublished-issues gate in both contexts: his
 * publicknowledge "Journal editor" group and the scratch journals'
 * manager role each carry ROLE_ID_MANAGER
 * (api/v1/issues/IssueController.php#206-214).
 *
 * @param {import('@playwright/test').Page} page
 * @param {string} journalPath
 * @param {{volume: number|string, number: number|string, year: number|string}} issueRef
 * @returns {Promise<number>}
 */
async function resolveIssueId(page, journalPath, {volume, number, year}) {
	const res = await page.request.get(
		`/index.php/${journalPath}/api/v1/issues?count=100`,
	);
	if (!res.ok()) {
		throw new Error(`GET issues: ${res.status()} ${await res.text()}`);
	}
	const body = await res.json();
	const items = body.items || body;
	const issue = items.find(
		(i) =>
			Number(i.volume) === Number(volume) &&
			String(i.number) === String(number) &&
			Number(i.year) === Number(year),
	);
	if (!issue) {
		throw new Error(
			`Issue Vol. ${volume} No. ${number} (${year}) not found in ${journalPath}`,
		);
	}
	return issue.id;
}

/**
 * Drive the Schedule For Publication flow from the current Publication
 * sub-panel, picking "Assign To Future Issue and Schedule Only" in the
 * Review Publishing Details side-modal. Mirrors
 * `EditorialWorkflowPage#publishCurrentPanel` (which hard-wires the
 * "Assign To Current/Back Issue" option) — kept spec-local because the
 * POM is read-only this wave.
 *
 * Flow (useWorkflowActions#workflowAssignToIssueAndScheduleForPublication):
 *   1. "Schedule For Publication" opens the Review Publishing Details
 *      side-modal (publication is STATUS_QUEUED).
 *   2. Picking the future-schedule radio re-fetches the unpublished
 *      issues into the issueId select and flips the hidden status to
 *      STATUS_READY_TO_SCHEDULE; Confirm PUTs the publication.
 *   3. The follow-up legacy publish modal (`.pkpWorkflow__publishModal`)
 *      asks "…schedule this for publication?" with a submit button
 *      labelled "Schedule For Publication" (PublishForm.php#83-89);
 *      committing PUTs /publish and the status lands on
 *      STATUS_SCHEDULED.
 *
 * @param {import('@playwright/test').Page} page
 * @param {import('../pages/EditorialWorkflowPage.js').EditorialWorkflowPage} workflow
 * @param {{issueLabel: string}} opts  visible identification of the future issue
 */
async function scheduleCurrentPanelIntoFutureIssue(page, workflow, {issueLabel}) {
	const modal = workflow.workflowModal();
	await modal
		.getByRole('button', {name: 'Schedule For Publication', exact: true})
		.click();

	const reviewDetails = page.getByRole('dialog', {
		name: /Review Publishing Details/i,
	});
	await expect(reviewDetails).toBeVisible({timeout: 15_000});
	// Wait for the async `issueAssignmentStatus` fetch to land before
	// switching the radio: it pre-checks the server-derived assignment
	// (CURRENT_BACK_ISSUES_PUBLISHED for a queued, issueless VoR). A
	// radio change made BEFORE that point is swallowed by the form's
	// initial-data-load guard (useWorkflowPublicationFormIssue.js
	// isInitialDataLoad) and the late fetch then overwrites the hidden
	// `status` with READY_TO_PUBLISH — the publish PUT would publish
	// immediately as continuous publication instead of scheduling.
	await expect(
		reviewDetails.getByRole('radio', {name: 'Assign To Current/Back Issue'}),
	).toBeChecked({timeout: 15_000});
	await reviewDetails
		.getByRole('radio', {name: 'Assign To Future Issue and Schedule Only'})
		.check();
	// Picking the radio resets issueId and re-populates the select from
	// `issues?isPublished=false`; selectOption auto-waits for the option.
	await reviewDetails
		.locator('select[name=issueId]')
		.selectOption({label: issueLabel});
	await reviewDetails.locator('select[name=versionStage]').selectOption('VoR');
	await reviewDetails
		.locator('select[name=versionIsMinor]')
		.selectOption('true');
	await reviewDetails
		.getByRole('button', {name: 'Confirm', exact: true})
		.click();

	const publishModal = page.locator('.pkpWorkflow__publishModal');
	await expect(publishModal).toBeVisible({timeout: 15_000});
	await expect(publishModal).toContainText(
		'Are you sure you want to schedule this for publication?',
	);
	await expect(publishModal).toContainText(issueLabel);
	await publishModal
		.getByRole('button', {name: 'Schedule For Publication', exact: true})
		.click();
	await expect(publishModal).toBeHidden({timeout: 15_000});
}

/**
 * Click Unschedule on the current Publication sub-panel and confirm the
 * PkpDialog. Mirrors `EditorialWorkflowPage#unpublishCurrentPanel` for
 * the scheduled state (useWorkflowActions#workflowUnschedulePublication
 * — same /unpublish endpoint, different labels). Spec-local because the
 * POM is read-only this wave.
 *
 * @param {import('@playwright/test').Page} page
 * @param {import('@playwright/test').Locator} modal  the workflow side-modal
 */
async function unscheduleCurrentPanel(page, modal) {
	await modal.getByRole('button', {name: 'Unschedule', exact: true}).click();
	const dialog = page.locator('[data-cy="dialog"]');
	await expect(dialog).toBeVisible({timeout: 10_000});
	await expect(dialog).toContainText(
		"Are you sure you don't want this scheduled for publication?",
	);
	await dialog.getByRole('button', {name: 'Unschedule', exact: true}).click();
	await expect(dialog).toBeHidden({timeout: 10_000});
}

/**
 * Anonymous reader requests the article landing page and gets a 404 —
 * the contract for scheduled, unscheduled and unpublished publications
 * (pages/article/ArticleHandler.php#153).
 *
 * @param {{
 *   browser: import('@playwright/test').Browser,
 *   baseURL?: string,
 *   journalPath: string,
 *   submissionId: number,
 * }} opts
 */
async function expectAnonymousArticle404({
	browser,
	baseURL,
	journalPath,
	submissionId,
}) {
	const ctx = await browser.newContext({
		baseURL,
		storageState: ANON_STORAGE_STATE,
	});
	try {
		const anonPage = await ctx.newPage();
		const resp = await anonPage.goto(
			`/index.php/${journalPath}/article/view/${submissionId}`,
		);
		expect(resp?.status()).toBe(404);
	} finally {
		await ctx.close();
	}
}

/**
 * Fetch the full publication object for a submission's current publication.
 * The summary returned by `…/publications` collection endpoint omits
 * `issueId` (only present on the full publication payload); we hit the
 * single-publication GET to assert the issue assignment moved.
 *
 * Always uses the journal path passed in — the shared
 * `EditorialWorkflowPage#fetchPublications` helper hard-codes
 * `publicknowledge`, which doesn't fit a scratch-journal spec.
 */
async function fetchFullPublication(page, submissionId, journalPath) {
	const subRes = await page.request.get(
		`/index.php/${journalPath}/api/v1/submissions/${submissionId}`,
	);
	if (!subRes.ok()) {
		throw new Error(
			`GET submission: ${subRes.status()} ${await subRes.text()}`,
		);
	}
	const subBody = await subRes.json();
	const publicationId = subBody.currentPublicationId;
	const pubRes = await page.request.get(
		`/index.php/${journalPath}/api/v1/submissions/${submissionId}/publications/${publicationId}`,
	);
	if (!pubRes.ok()) {
		throw new Error(
			`GET publication: ${pubRes.status()} ${await pubRes.text()}`,
		);
	}
	return pubRes.json();
}

/**
 * Anonymous reader visits the issue's public view page and asserts the
 * article title appears as a TOC link. The issue page renders one
 * `<a>` per published submission inside `.obj_article_summary`; matching
 * by visible text is enough for an OJS-only test.
 *
 * @param {{
 *   browser: import('@playwright/test').Browser,
 *   baseURL?: string,
 *   journalPath: string,
 *   issueId: number,
 *   articleTitle: string,
 * }} opts
 */
async function expectArticleInIssueToc({
	browser,
	baseURL,
	journalPath,
	issueId,
	articleTitle,
}) {
	const ctx = await browser.newContext({
		baseURL,
		storageState: ANON_STORAGE_STATE,
	});
	try {
		const page = await ctx.newPage();
		const resp = await page.goto(
			`/index.php/${journalPath}/issue/view/${issueId}`,
		);
		expect(resp?.status()).toBe(200);
		await expect(
			page.locator('.obj_issue_toc').getByRole('link', {name: articleTitle}),
		).toBeVisible({timeout: 10_000});
	} finally {
		await ctx.close();
	}
}

/**
 * Anonymous reader visits the issue's public view page and asserts the
 * article title is NOT listed in its TOC. The page must still load (200);
 * the article just isn't there.
 */
async function expectArticleNotInIssueToc({
	browser,
	baseURL,
	journalPath,
	issueId,
	articleTitle,
}) {
	const ctx = await browser.newContext({
		baseURL,
		storageState: ANON_STORAGE_STATE,
	});
	try {
		const page = await ctx.newPage();
		const resp = await page.goto(
			`/index.php/${journalPath}/issue/view/${issueId}`,
		);
		expect(resp?.status()).toBe(200);
		await expect(
			page.locator('.obj_issue_toc').getByRole('link', {name: articleTitle}),
		).toHaveCount(0);
	} finally {
		await ctx.close();
	}
}

/**
 * Build a worker-scoped tag so parallel runs don't collide.
 *
 * @param {import('@playwright/test').TestInfo} info
 * @param {string} suffix
 */
function uniqueTag(info, suffix) {
	const random = Math.random().toString(36).slice(2, 8);
	return `ia-w${info.parallelIndex}-${suffix}-${random}`;
}
