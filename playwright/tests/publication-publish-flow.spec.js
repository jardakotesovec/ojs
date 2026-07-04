// @ts-check
const {test, expect} = require('../support/fixtures.js');
const {ArticlePage} = require('../pages/ArticlePage.js');

/**
 * Publication — Publish / unpublish / schedule flow (the publish ACTION).
 * docs/product/specs/publication-publish-flow.md.
 *
 * This spec owns the publish-flow-SPECIFIC surfaces that the sibling specs do
 * NOT cover. It deliberately does NOT re-drive coverage already owned by:
 *   - publication-versioning.spec.js — the version lifecycle, the basic
 *     UI publish (scenario 1 "Correct a published article"), the future-issue
 *     SCHEDULE (scenario 2), blocked-publish on a declined submission
 *     (scenario 5), and the auto-assign-VoR-on-publish announcement
 *     (scenario 6 / VERSION_ASSIGN_ANNOUNCE). Publish-flow canonical scenarios
 *     5 (blocked publish) and 10 (auto-assign VoR) are therefore SKIPPED here.
 *   - publication-issue-assignment.spec.js — the Review Publishing Details
 *     staging (issueId + ready-to-publish/schedule intent) and the row-94
 *     future-issue manager gate. Publish-flow scenario 2 (schedule-into-future)
 *     is SKIPPED here — versioning + issue-assignment own the two halves.
 *   - galleys.spec.js / media-files.spec.js — the reader galley download.
 *
 * What IS publish-flow-specific and lives here:
 *   1. publish → reader VISIBILITY FLIP: article page 200 + the issue TOC lists
 *      it (versioning asserts the article page but never the TOC), and
 *      accessStatus open-by-default (rule 13).
 *   2. the Done-stage TRIGGER: publish → stage_id 6 + Move-to-Done decision 33;
 *      unpublish → leaves Done + Return-to-Workflow decision 34 (rule 11) —
 *      untested by any sibling.
 *   3. unpublish → reader 404 + the OAI TOMBSTONE (rule 12). Versioning
 *      scenario 3 asserted the 404 but explicitly did NOT probe the tombstone;
 *      this spec drives the OAI GetRecord "deleted" record.
 *   4. republish keeps the ORIGINAL datePublished (rule 14).
 *   5. continuous publication — publish IMMEDIATELY into a not-yet-published
 *      issue (scenario 3; versioning only drove future-SCHEDULE).
 *   6. issue-less publish (scenario 4) — the actual publish + reader visibility
 *      (issue-assignment stages the intent but never publishes/reads).
 *   7. unschedule a scheduled article (scenario 8).
 *   8. the PublishSubmissions ⚠ (scenario 2 / rule 15): OJS scheduled articles
 *      go live when the ISSUE is published, NOT via a date-based task. The
 *      date-based task PKPSubmissions is registered in NEITHER
 *      Scheduler::registerSchedules() nor PKPScheduler::registerSchedules() and
 *      there is no scheduledTasks.xml (confirmed at authoring time) — so this
 *      test asserts the real issue-publish path on a SCRATCH journal (publishing
 *      a shared issue would leak into sibling scheduling tests).
 *
 * All status/stage/date/accessStatus assertions read back through the REST API;
 * reader assertions use a fresh anonymous context (empty storageState — an
 * editor context can PREVIEW unpublished articles, so anonymity is mandatory,
 * patterns.md item 8). publicknowledge is never mutated: only fresh submissions
 * are added; the only issue PUBLISHED is a scratch-journal one.
 */

// ---- status / stage / decision constants (verified against source) --------
const PUB_STATUS_QUEUED = 1; // PKPPublication::STATUS_QUEUED (draft)
const PUB_STATUS_PUBLISHED = 3; // PKPPublication::STATUS_PUBLISHED
const PUB_STATUS_SCHEDULED = 5; // PKPPublication::STATUS_SCHEDULED

const SUB_STATUS_QUEUED = 1; // PKPSubmission::STATUS_QUEUED
const SUB_STATUS_PUBLISHED = 3; // PKPSubmission::STATUS_PUBLISHED
const SUB_STATUS_SCHEDULED = 5; // PKPSubmission::STATUS_SCHEDULED

const STAGE_PRODUCTION = 5; // WORKFLOW_STAGE_ID_PRODUCTION
const STAGE_DONE = 6; // WORKFLOW_STAGE_ID_DONE

const DECISION_MOVE_TO_DONE = 33; // Decision::MOVE_TO_DONE
const DECISION_RETURN_TO_WORKFLOW = 34; // Decision::RETURN_TO_WORKFLOW

const ACCESS_ISSUE_DEFAULT = 0; // Submission::ARTICLE_ACCESS_ISSUE_DEFAULT

// ---- confirm-modal sentences (locale/en/submission.po) ---------------------
const CONFIRM_CONTINUOUS_A =
	'published immediately as continuous publication even though it is assigned to';
const CONFIRM_CONTINUOUS_B = 'which is not published yet';
const CONFIRM_ISSUELESS = 'published immediately without any issue association';

// The OAI repository id from config.test.inc.php ([oai] repository_id = ojs-test),
// selected by includes/bootstrap.php when APPLICATION_ENV=test. Article OAI ids
// are `oai:{repository_id}:article/{submissionId}` (ArticleTombstoneManager +
// live-verified: ListIdentifiers returns oai:ojs-test:article/{id}).
const OAI_REPOSITORY_ID = 'ojs-test';

/** A unique, hyphenless, alphanumeric tag (parallel isolation). */
function uniqueTag() {
	const workerIndex = test.info().parallelIndex;
	const suffix = Math.random().toString(36).slice(2, 8);
	return `ppf${workerIndex}x${suffix}`;
}

/** The workflow side modal (its outer wrapper reports visibility:hidden — scope only). */
function workflowModal(page) {
	return page.locator('[data-cy="active-modal"]').first();
}

/** Deep-link the workflow onto a Publication sub-pane of a version (editorial). */
function pubLink(submissionId, pubId, name, journalPath = 'publicknowledge') {
	return (
		`/index.php/${journalPath}/en/dashboard/editorial` +
		`?workflowSubmissionId=${submissionId}` +
		`&workflowMenuKey=publication_${pubId}_${name}`
	);
}

/** Open a version's Title & Abstract pane (editorial) and wait for it to mount. */
async function openTitleAbstract(page, submissionId, pubId, journalPath = 'publicknowledge') {
	await page.goto(pubLink(submissionId, pubId, 'titleAbstract', journalPath), {
		waitUntil: 'commit',
	});
	await expect(
		workflowModal(page).getByRole('heading', {
			name: 'Publication: Title & Abstract',
		}),
	).toBeVisible({timeout: 25_000});
	await expect(page.locator('#titleAbstract-title-control-en')).toBeAttached({
		timeout: 25_000,
	});
}

/** GET the submission JSON (page session). */
async function fetchSubmission(page, submissionId, journalPath = 'publicknowledge') {
	const res = await page.request.get(
		`/index.php/${journalPath}/api/v1/submissions/${submissionId}`,
	);
	expect(res.ok(), `GET submission ${submissionId}: ${res.status()}`).toBeTruthy();
	return res.json();
}

/** GET one publication JSON (page session). */
async function fetchPublication(page, submissionId, pubId, journalPath = 'publicknowledge') {
	const res = await page.request.get(
		`/index.php/${journalPath}/api/v1/submissions/${submissionId}/publications/${pubId}`,
	);
	expect(res.ok(), `GET publication ${pubId}: ${res.status()}`).toBeTruthy();
	return res.json();
}

/** The current publication id for a submission. */
async function currentPublicationId(page, submissionId, journalPath = 'publicknowledge') {
	return (await fetchSubmission(page, submissionId, journalPath)).currentPublicationId;
}

/** The decisions of a given type recorded on a submission (array; page session). */
async function fetchDecisions(page, submissionId, decisionType, journalPath = 'publicknowledge') {
	const res = await page.request.get(
		`/index.php/${journalPath}/api/v1/submissions/${submissionId}/decisions` +
			`?decisionTypes%5B%5D=${decisionType}`,
	);
	expect(res.ok(), `GET decisions ${submissionId}: ${res.status()}`).toBeTruthy();
	const body = await res.json();
	return Array.isArray(body) ? body : [];
}

/** The first issue matching a publish state (0 = future/unpublished, 1 = published). */
async function firstIssue(page, isPublished, journalPath = 'publicknowledge') {
	const res = await page.request.get(
		`/index.php/${journalPath}/api/v1/issues?isPublished=${isPublished}&count=100`,
	);
	expect(res.ok(), `GET issues isPublished=${isPublished}: ${res.status()}`).toBeTruthy();
	const items = (await res.json()).items;
	expect(items.length, `>=1 issue isPublished=${isPublished}`).toBeGreaterThan(0);
	return items[0];
}

/** CSRF token from a loaded OJS page (window.pkp boots async under waitUntil:commit). */
async function getCsrf(page) {
	await page.waitForFunction(() => !!window.pkp?.currentUser?.csrfToken, null, {
		timeout: 20_000,
	});
	return page.evaluate(() => window.pkp.currentUser.csrfToken);
}

/** PUT (tunnelled as POST + override, matching useFetch) an arbitrary publication op. */
async function putPublicationOp(ctx, submissionId, pubId, op, csrf, journalPath = 'publicknowledge') {
	const suffix = op ? `/${op}` : '';
	return ctx.request.post(
		`/index.php/${journalPath}/api/v1/submissions/${submissionId}/publications/${pubId}${suffix}`,
		{
			headers: {
				'X-Csrf-Token': csrf,
				'X-Http-Method-Override': 'PUT',
				'Content-Type': 'application/json',
			},
			data: {},
		},
	);
}

/**
 * Drive the shared publish two-step: click the entry button, fill the "Review
 * Publishing Details" side-modal per `assignment`, Confirm, and return the final
 * publish confirmation modal (`.pkpWorkflow__publishModal`) WITHOUT committing.
 * Assumes a Publication sub-pane of the version to publish is already open.
 *
 * @param {'currentBack'|'futurePublish'|'none'} opts.assignment
 * @param {number} [opts.issueId] required unless assignment === 'none'
 */
async function openPublishConfirm(page, {assignment, issueId}) {
	const modal = workflowModal(page);
	const schedule = modal.getByRole('button', {
		name: 'Schedule For Publication',
		exact: true,
	});
	const publish = modal.getByRole('button', {name: 'Publish', exact: true});
	await schedule.or(publish).first().waitFor({state: 'visible', timeout: 20_000});
	if (await schedule.isVisible().catch(() => false)) {
		await schedule.click();
	} else {
		await publish.click();
	}

	const details = page.getByRole('dialog', {name: /Review Publishing Details/i});
	await expect(details).toBeVisible({timeout: 20_000});
	const stageSelect = details.locator('select[name=versionStage]');
	await expect(stageSelect).toBeVisible({timeout: 20_000});

	// Let the issue composable finish its initial data load before switching the
	// assignment radio — switching too early leaves the hidden status field at
	// the wrong pre-publish intent (the isInitialDataLoad guard in
	// useWorkflowPublicationFormIssue).
	await expect
		.poll(
			async () =>
				details.getByRole('radio').evaluateAll((els) =>
					els.some((e) => /** @type {HTMLInputElement} */ (e).checked),
				),
			{timeout: 20_000},
		)
		.toBe(true);

	const label = {
		currentBack: 'Assign To Current/Back Issue',
		futurePublish: 'Assign To Future Issue and Publish Immediately',
		none: "Don't Assign To An Issue",
	}[assignment];
	await details.getByRole('radio', {name: label, exact: true}).check();

	if (assignment !== 'none') {
		const picker = details.locator('select[name=issueId]');
		await expect(picker.locator(`option[value="${issueId}"]`)).toHaveCount(1, {
			timeout: 20_000,
		});
		await picker.selectOption(String(issueId));
	}

	await stageSelect.selectOption('VoR');
	await details
		.locator('select[name=versionIsMinor]')
		.selectOption('false')
		.catch(() => {});

	await details.getByRole('button', {name: 'Confirm', exact: true}).click();

	const publishModal = page.locator('.pkpWorkflow__publishModal');
	await expect(publishModal).toBeVisible({timeout: 20_000});
	return publishModal;
}

/** Commit the final publish/schedule modal and wait for it to close. */
async function commitPublish(page, publishModal) {
	await publishModal
		.getByRole('button', {name: /^(Publish|Schedule For Publication)$/})
		.click();
	await expect(publishModal).toBeHidden({timeout: 20_000});
}

/** Unpublish/unschedule the open version pane and confirm the dialog. */
async function unpublishOpenVersion(page) {
	const modal = workflowModal(page);
	await modal
		.getByRole('button', {name: /^(Unpublish|Unschedule)$/})
		.first()
		.click();
	const dialog = page.locator('[data-cy="dialog"]');
	await expect(dialog).toBeVisible({timeout: 15_000});
	await dialog.getByRole('button', {name: /^(Unpublish|Unschedule)$/}).click();
	await expect(dialog).toBeHidden({timeout: 15_000});
}

/** Anon reader probe of the public article URL (locale-prefixed for publicknowledge). */
async function readerArticleStatus(browser, baseURL, submissionId, {journalPath = 'publicknowledge', bare = false} = {}) {
	const anon = await browser.newContext({
		baseURL,
		storageState: {cookies: [], origins: []},
	});
	try {
		const url = bare
			? `/index.php/${journalPath}/article/view/${submissionId}`
			: `/index.php/${journalPath}/en/article/view/${submissionId}`;
		const res = await anon.request.get(url);
		return res.status();
	} finally {
		await anon.close();
	}
}

/** OAI GetRecord body for an article, from a fresh anonymous context. */
async function oaiGetRecord(browser, baseURL, submissionId, journalPath = 'publicknowledge') {
	const anon = await browser.newContext({
		baseURL,
		storageState: {cookies: [], origins: []},
	});
	try {
		const identifier = `oai:${OAI_REPOSITORY_ID}:article/${submissionId}`;
		const res = await anon.request.get(
			`/index.php/${journalPath}/oai?verb=GetRecord&metadataPrefix=oai_dc&identifier=${identifier}`,
		);
		return {status: res.status(), body: await res.text()};
	} finally {
		await anon.close();
	}
}

// ---- scenario spec builders ------------------------------------------------

/**
 * A VoR published + assigned to an issue. `issue` picks the target
 * (publicknowledge's published Vol 1 No 2 2014 by default). `datePublished`
 * seeds an explicit date (survives publish, mirrors the editor capability).
 */
function publishedVorSpec({tag, title, issue = {volume: 1, number: 2, year: 2014}, datePublished, journal = 'publicknowledge', participants}) {
	const metadata = {title: {en: title}};
	if (datePublished) metadata.datePublished = datePublished;
	return {
		tag,
		journal,
		submitter: 'atester',
		section: 'ART',
		locale: 'en',
		participants: participants ?? [
			{user: 'dbarnes', role: 'editor', canChangeMetadata: true},
		],
		decisions: [
			{type: 'skipExternalReview', by: 'dbarnes'},
			{type: 'sendToProduction', by: 'dbarnes'},
		],
		publications: [{versionStage: 'VoR', metadata, issue, published: true}],
	};
}

/** A submitted, unpublished, stage-1 submission whose single version is unassigned. */
function unassignedSpec({tag, title, journal = 'publicknowledge', participants}) {
	return {
		tag,
		journal,
		submitter: 'atester',
		section: 'ART',
		locale: 'en',
		participants: participants ?? [{user: 'dbarnes', role: 'editor'}],
		publications: [{metadata: {title: {en: title}}}],
	};
}

test.use({user: 'dbarnes'}); // the assigned editor — a manager on publicknowledge

test.describe('Publication — publish / unpublish / schedule flow', () => {
	// Canonical scenario 1 (visibility flip) + rule 13 (accessStatus). Publishing
	// to a published issue makes the article render at its reader URL AND appear
	// in the issue TOC; the version carries accessStatus 0 (use the issue's access
	// setting — the open-by-default value). Reader assertions are anonymous.
	test(
		'publish makes the article reader-visible (article page + issue TOC) with open access by default',
		{tag: ['@smoke', '@regression']},
		async ({page, pkpApi, browser, baseURL}) => {
			test.slow();
			const tag = uniqueTag();
			const {submission, publications} = await pkpApi.createSubmission(
				publishedVorSpec({tag, title: `Visible ${tag}`}),
			);
			const pub = publications[0];
			expect(pub.status).toBe(PUB_STATUS_PUBLISHED);

			// Server truth: PUBLISHED, open-by-default accessStatus, in the issue.
			const pubJson = await fetchPublication(page, submission.id, pub.id);
			expect(pubJson.accessStatus).toBe(ACCESS_ISSUE_DEFAULT);
			const publishedIssue = await firstIssue(page, 1);
			expect(pubJson.issueId).toBe(publishedIssue.id);
			expect((await fetchSubmission(page, submission.id)).status).toBe(
				SUB_STATUS_PUBLISHED,
			);

			// --- Reader side (anonymous) ---
			const anon = await browser.newContext({
				baseURL,
				storageState: {cookies: [], origins: []},
			});
			try {
				const reader = await anon.newPage();
				const article = new ArticlePage(reader);

				// The article page renders for the public.
				const resp = await article.goto(submission.id, {locale: 'en'});
				expect(resp?.status()).toBe(200);
				await expect(reader.locator('h1.page_title')).toContainText(tag);

				// The published issue TOC lists the article (a link to it).
				await reader.goto(
					`/index.php/publicknowledge/en/issue/view/${publishedIssue.id}`,
				);
				await expect(
					reader.getByRole('link', {name: new RegExp(tag)}),
				).toBeVisible({timeout: 15_000});
			} finally {
				await anon.close();
			}
		},
	);

	// Canonical scenarios 1 + 7 (the Done-stage TRIGGER, rule 11). Publishing a
	// Version of Record moves the submission into the Done stage (stage_id 6) and
	// records a Move-to-Done decision (33); unpublishing the only Published VoR
	// returns it to its prior stage (Production, 5) with a Return-to-Workflow
	// decision (34). Asserted purely via the submission + decisions API.
	test(
		'publish moves the submission to Done (stage 6 + decision 33); unpublish returns it (stage 5 + decision 34)',
		{tag: ['@smoke', '@regression']},
		async ({page, pkpApi}) => {
			test.slow();
			const tag = uniqueTag();
			const {submission, publications} = await pkpApi.createSubmission(
				publishedVorSpec({tag, title: `Done stage ${tag}`}),
			);
			const pubId = publications[0].id;

			// Publish (seeded) → the submission is in Done with a Move-to-Done decision.
			await expect
				.poll(async () => (await fetchSubmission(page, submission.id)).stageId, {
					timeout: 20_000,
				})
				.toBe(STAGE_DONE);
			expect(
				(await fetchDecisions(page, submission.id, DECISION_MOVE_TO_DONE)).length,
				'a Move-to-Done (33) decision is recorded on publish',
			).toBeGreaterThan(0);

			// Unpublish the only Published VoR (real UI action).
			await openTitleAbstract(page, submission.id, pubId);
			await unpublishOpenVersion(page);

			// The version returns to draft…
			await expect
				.poll(async () => (await fetchPublication(page, submission.id, pubId)).status, {
					timeout: 20_000,
				})
				.toBe(PUB_STATUS_QUEUED);
			// …and the submission leaves Done, back to Production, with a
			// Return-to-Workflow decision.
			await expect
				.poll(async () => (await fetchSubmission(page, submission.id)).stageId, {
					timeout: 20_000,
				})
				.toBe(STAGE_PRODUCTION);
			expect(
				(await fetchDecisions(page, submission.id, DECISION_RETURN_TO_WORKFLOW)).length,
				'a Return-to-Workflow (34) decision is recorded on unpublish',
			).toBeGreaterThan(0);
		},
	);

	// Canonical scenario 7 (the flip + OAI tombstone, rule 12). A Published
	// article's reader URL is 200 and its OAI record is alive; unpublishing it
	// makes the reader URL a 404 AND inserts an OAI "deleted" tombstone that an
	// OAI GetRecord returns with status="deleted". (Versioning scenario 3 asserted
	// the 404 but explicitly did NOT probe the tombstone — this test does.)
	test(
		'unpublish hides the article (reader 404) and inserts an OAI tombstone',
		{tag: ['@smoke', '@regression']},
		async ({page, pkpApi, browser, baseURL}) => {
			test.slow();
			const tag = uniqueTag();
			const {submission, publications} = await pkpApi.createSubmission(
				publishedVorSpec({tag, title: `Tombstone ${tag}`}),
			);
			const pubId = publications[0].id;

			// Precondition: reader 200 + OAI record ALIVE (not deleted).
			expect(await readerArticleStatus(browser, baseURL, submission.id)).toBe(200);
			const alive = await oaiGetRecord(browser, baseURL, submission.id);
			expect(alive.status).toBe(200);
			expect(alive.body).toContain(`article/${submission.id}`);
			expect(alive.body).not.toContain('status="deleted"');

			// Unpublish (real UI action).
			await openTitleAbstract(page, submission.id, pubId);
			await unpublishOpenVersion(page);
			await expect
				.poll(async () => (await fetchPublication(page, submission.id, pubId)).status, {
					timeout: 20_000,
				})
				.toBe(PUB_STATUS_QUEUED);

			// Reader now gets a not-found page…
			expect(await readerArticleStatus(browser, baseURL, submission.id)).toBe(404);

			// …and OAI now returns a deleted-record tombstone for the same identifier.
			await expect
				.poll(
					async () => (await oaiGetRecord(browser, baseURL, submission.id)).body,
					{timeout: 15_000},
				)
				.toContain('status="deleted"');
			const deleted = await oaiGetRecord(browser, baseURL, submission.id);
			expect(deleted.body).toContain(
				`oai:${OAI_REPOSITORY_ID}:article/${submission.id}`,
			);
		},
	);

	// Canonical scenario 9 (rule 14). Publishing stamps the date only when empty,
	// so a version published with an explicit date, unpublished, then republished
	// keeps its ORIGINAL datePublished — not a fresh stamp. Unpublish is the real
	// UI action; the republish exercises the publish API endpoint (rule 5) that
	// re-runs validatePublish + setStatusOnPublish on the now-Queued version.
	test(
		'republish preserves the original publication date',
		{tag: ['@smoke', '@regression']},
		async ({page, pkpApi, browser, baseURL}) => {
			test.slow();
			const tag = uniqueTag();
			const originalDate = '2020-01-15';
			const {submission, publications} = await pkpApi.createSubmission(
				publishedVorSpec({tag, title: `Republish ${tag}`, datePublished: originalDate}),
			);
			const pubId = publications[0].id;
			expect(
				(await fetchPublication(page, submission.id, pubId)).datePublished,
			).toContain(originalDate);

			// Unpublish (UI) → Queued; the first-published date is NOT cleared.
			await openTitleAbstract(page, submission.id, pubId);
			await unpublishOpenVersion(page);
			await expect
				.poll(async () => (await fetchPublication(page, submission.id, pubId)).status, {
					timeout: 20_000,
				})
				.toBe(PUB_STATUS_QUEUED);
			expect(
				(await fetchPublication(page, submission.id, pubId)).datePublished,
				'unpublish keeps the original date',
			).toContain(originalDate);

			// Republish via the publish endpoint → Published again, ORIGINAL date kept.
			await page.goto('/index.php/publicknowledge/en/dashboard/editorial', {
				waitUntil: 'commit',
			});
			const csrf = await getCsrf(page);
			const res = await putPublicationOp(page, submission.id, pubId, 'publish', csrf);
			expect(res.status(), await res.text()).toBe(200);

			await expect
				.poll(async () => (await fetchPublication(page, submission.id, pubId)).status, {
					timeout: 20_000,
				})
				.toBe(PUB_STATUS_PUBLISHED);
			expect(
				(await fetchPublication(page, submission.id, pubId)).datePublished,
				'republish does NOT re-stamp the date',
			).toContain(originalDate);

			// The article is reader-visible again under its preserved date.
			expect(await readerArticleStatus(browser, baseURL, submission.id)).toBe(200);
		},
	);

	// Canonical scenario 3 — Continuous publication. "Assign To Future Issue and
	// Publish Immediately" → the confirm modal reads "…published immediately as
	// continuous publication even though it is assigned to {issue} which is not
	// published yet" → the version publishes NOW (STATUS_PUBLISHED, not scheduled)
	// and is reader-visible without waiting for the issue to be published.
	test(
		'continuous publication: publish immediately into a not-yet-published issue',
		{tag: ['@smoke', '@regression']},
		async ({page, pkpApi, browser, baseURL}) => {
			test.slow();
			const tag = uniqueTag();
			const {submission} = await pkpApi.createSubmission(
				unassignedSpec({tag, title: `Continuous ${tag}`}),
			);
			const pubId = await currentPublicationId(page, submission.id);
			const futureIssue = await firstIssue(page, 0);

			await openTitleAbstract(page, submission.id, pubId);
			const publishModal = await openPublishConfirm(page, {
				assignment: 'futurePublish',
				issueId: futureIssue.id,
			});
			// The confirm sentence is the continuous-publication one.
			await expect(publishModal.getByText(CONFIRM_CONTINUOUS_A)).toBeVisible({
				timeout: 20_000,
			});
			await expect(publishModal.getByText(CONFIRM_CONTINUOUS_B)).toBeVisible();
			await commitPublish(page, publishModal);

			// Server truth: PUBLISHED now (NOT scheduled), assigned to the future issue.
			await expect
				.poll(async () => (await fetchPublication(page, submission.id, pubId)).status, {
					timeout: 20_000,
				})
				.toBe(PUB_STATUS_PUBLISHED);
			const pub = await fetchPublication(page, submission.id, pubId);
			expect(pub.issueId).toBe(futureIssue.id);
			expect((await fetchSubmission(page, submission.id)).status).toBe(
				SUB_STATUS_PUBLISHED,
			);

			// Reader-visible immediately, even though the issue itself is unpublished.
			expect(await readerArticleStatus(browser, baseURL, submission.id)).toBe(200);
		},
	);

	// Canonical scenario 4 — Issue-less publish. "Don't Assign To An Issue" → the
	// confirm modal reads "…published immediately without any issue association" →
	// PUBLISHED with a null issueId, reader-visible, and the reader page shows no
	// issue link. (issue-assignment stages this intent but never publishes/reads.)
	test(
		'issue-less publish makes the article public with no issue association',
		{tag: ['@smoke', '@regression']},
		async ({page, pkpApi, browser, baseURL}) => {
			test.slow();
			const tag = uniqueTag();
			const {submission} = await pkpApi.createSubmission(
				unassignedSpec({tag, title: `Issueless ${tag}`}),
			);
			const pubId = await currentPublicationId(page, submission.id);

			await openTitleAbstract(page, submission.id, pubId);
			const publishModal = await openPublishConfirm(page, {assignment: 'none'});
			await expect(publishModal.getByText(CONFIRM_ISSUELESS)).toBeVisible({
				timeout: 20_000,
			});
			await commitPublish(page, publishModal);

			// Server truth: PUBLISHED, no issue.
			await expect
				.poll(async () => (await fetchPublication(page, submission.id, pubId)).status, {
					timeout: 20_000,
				})
				.toBe(PUB_STATUS_PUBLISHED);
			expect((await fetchPublication(page, submission.id, pubId)).issueId).toBeNull();

			// Reader-visible with NO issue link.
			const anon = await browser.newContext({
				baseURL,
				storageState: {cookies: [], origins: []},
			});
			try {
				const reader = await anon.newPage();
				const article = new ArticlePage(reader);
				const resp = await article.goto(submission.id, {locale: 'en'});
				expect(resp?.status()).toBe(200);
				await expect(reader.locator('h1.page_title')).toContainText(tag);
				await expect(article.issueLink).toHaveCount(0);
			} finally {
				await anon.close();
			}
		},
	);

	// Canonical scenario 8 — Unschedule. A version scheduled into a future issue
	// shows an "Unschedule" button (same endpoint as Unpublish, different copy);
	// clicking it returns the version to the Queued draft state. It was never
	// reader-visible (404 throughout).
	test(
		'unschedule a scheduled article returns it to draft; never reader-visible',
		{tag: ['@smoke', '@regression']},
		async ({page, pkpApi, browser, baseURL}) => {
			test.slow();
			const tag = uniqueTag();
			const futureIssue = await firstIssue(page, 0);
			// published:true into a FUTURE issue → SCHEDULED (setStatusOnPublish).
			const {submission, publications} = await pkpApi.createSubmission(
				publishedVorSpec({
					tag,
					title: `Unschedule ${tag}`,
					issue: {volume: futureIssue.volume, number: futureIssue.number, year: futureIssue.year},
				}),
			);
			const pubId = publications[0].id;
			expect(publications[0].status).toBe(PUB_STATUS_SCHEDULED);
			expect((await fetchSubmission(page, submission.id)).status).toBe(
				SUB_STATUS_SCHEDULED,
			);

			// A scheduled version is not public.
			expect(await readerArticleStatus(browser, baseURL, submission.id)).toBe(404);

			// The entry control reads "Unschedule" on a Scheduled version.
			await openTitleAbstract(page, submission.id, pubId);
			await expect(
				workflowModal(page).getByRole('button', {name: 'Unschedule', exact: true}),
			).toBeVisible({timeout: 20_000});

			// Unschedule → back to the Queued draft state.
			await unpublishOpenVersion(page);
			await expect
				.poll(async () => (await fetchPublication(page, submission.id, pubId)).status, {
					timeout: 20_000,
				})
				.toBe(PUB_STATUS_QUEUED);
			expect((await fetchSubmission(page, submission.id)).status).toBe(
				SUB_STATUS_QUEUED,
			);

			// Still not reader-visible (it never was).
			expect(await readerArticleStatus(browser, baseURL, submission.id)).toBe(404);
		},
	);

	// Canonical scenario 2 (rule 15) — the PublishSubmissions ⚠. OJS does NOT run
	// a date-based auto-publish task (PublishSubmissions is registered in neither
	// scheduler and there is no scheduledTasks.xml — confirmed at authoring time).
	// A Scheduled article instead goes live when its ISSUE is published. This test
	// proves the real path on a SCRATCH journal (publishing publicknowledge's
	// shared future issue would leak into sibling scheduling tests): schedule an
	// article into an unpublished scratch issue, publish that issue, and assert the
	// scheduled version flips to Published and becomes reader-visible.
	test(
		'a scheduled article goes live when its issue is published (not via a date task)',
		{tag: ['@regression']},
		async ({page, pkpApi, browser, baseURL}) => {
			test.slow();
			const tag = uniqueTag();

			// Scratch journal: dbarnes is manager (can publish the issue), atester author.
			const {context} = await pkpApi.createJournal({
				tag,
				users: [
					{username: 'dbarnes', roles: ['manager']},
					{username: 'atester', roles: ['author']},
				],
				issues: [{volume: 1, number: 1, year: 2035, published: false}],
			});
			const journalPath = context.path;

			// The scratch (unpublished) issue.
			const scratchIssue = await firstIssue(page, 0, journalPath);

			// Schedule an article into it (published:true into a future issue → SCHEDULED).
			const {submission, publications} = await pkpApi.createSubmission(
				publishedVorSpec({
					tag: `${tag}s`,
					title: `Goes live ${tag}`,
					journal: journalPath,
					issue: {volume: 1, number: 1, year: 2035},
				}),
			);
			const pubId = publications[0].id;
			expect(publications[0].status).toBe(PUB_STATUS_SCHEDULED);
			// Not reader-visible while scheduled (scratch journals are single-locale
			// → probe the BARE URL, patterns.md item 9).
			expect(
				await readerArticleStatus(browser, baseURL, submission.id, {journalPath, bare: true}),
			).toBe(404);

			// Publish the scratch issue via the legacy FutureIssueGridHandler op (no
			// REST endpoint exists). confirmed=1 skips the AssignPublicIdentifiers
			// modal step; csrfToken passes PKPRequest::checkCSRF.
			await page.goto(`/index.php/${journalPath}/en/dashboard/editorial`, {
				waitUntil: 'commit',
			});
			const csrf = await getCsrf(page);
			const gridBase = await page.evaluate(
				() => window.pkp.context.legacyGridBaseUrl,
			);
			const publishIssueUrl =
				gridBase.replace(
					/component\/action$/,
					'grid/issues/future-issue-grid/publish-issue',
				) + `?issueId=${scratchIssue.id}`;
			const issueRes = await page.request.post(publishIssueUrl, {
				headers: {'X-Csrf-Token': csrf},
				form: {confirmed: '1', csrfToken: csrf},
			});
			expect(issueRes.status(), await issueRes.text()).toBe(200);

			// Publishing the issue published the scheduled version.
			await expect
				.poll(
					async () =>
						(await fetchPublication(page, submission.id, pubId, journalPath)).status,
					{timeout: 20_000},
				)
				.toBe(PUB_STATUS_PUBLISHED);
			expect((await fetchSubmission(page, submission.id, journalPath)).status).toBe(
				SUB_STATUS_PUBLISHED,
			);

			// Now reader-visible.
			expect(
				await readerArticleStatus(browser, baseURL, submission.id, {journalPath, bare: true}),
			).toBe(200);
		},
	);
});
