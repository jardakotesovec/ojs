// @ts-check
const {test, expect} = require('../support/fixtures.js');
const {ArticlePage} = require('../pages/ArticlePage.js');

/**
 * Publication versioning — the 6 canonical scenarios of
 * docs/product/specs/publication-versioning.md (status: verified). One test
 * per scenario, named after it.
 *
 * The spec covers a shared pkp-lib behaviour (versioning) but the assertions
 * reach into OJS-only surfaces — issues, the reader article view, the
 * Publication → Issue placement, OAI — so this lives in the OJS root
 * (`playwright/tests/`), importing the OJS `fixtures.js`.
 *
 * Seeding: each test seeds its own published / versioned submission through
 * the scenario API (`pkpApi.createSubmission`). The PublicationsProcessor
 * builds chained versions exactly like the UI's create-version form
 * (`Repo::publication()->version()`), and `published: true` runs
 * `Repo::publication()->publish()` — which, on a future/unpublished issue,
 * computes STATUS_SCHEDULED correctly (the row-24 hard-code is UI-endpoint
 * only). publicknowledge is never mutated: only fresh submissions are added,
 * and the shared future issue is scheduled INTO but never published.
 *
 * As-built deviations these tests assert (do NOT fight — the spec verified
 * them): row 23b (a blocked publish still persists the pre-publish issue +
 * intent — scenario 5).
 *
 * Two places the app now disagrees with the VERIFIED spec (both reported in
 * the return):
 *   - Rule 24 / row 18 (scenario 2): the UI-scheduled-article-mis-filed-as-
 *     Published deviation is FIXED — commit d52aa4c84b (pkp/pkp-lib#12799)
 *     swapped the hard-coded updateStatus($submission, STATUS_PUBLISHED) for
 *     the recompute updateStatus($submission), so submission.status now
 *     computes to SCHEDULED. Test 2 asserts the real (fixed) SCHEDULED.
 *   - Scenario 3 prose (parenthetical): claims the rolled-back version shows
 *     "Unscheduled", but rule 4 + WorkflowPublicationVersionControl.vue +
 *     getCurrentPublicationIdByPublications() all make a non-current QUEUED
 *     version show "Unpublished". Test 3 asserts the real "Unpublished".
 */

// ---- status constants (verified against source) ---------------------------
const PUB_STATUS_QUEUED = 1; // PKPPublication::STATUS_QUEUED (draft)
const PUB_STATUS_PUBLISHED = 3; // PKPPublication::STATUS_PUBLISHED
const PUB_STATUS_SCHEDULED = 5; // PKPPublication::STATUS_SCHEDULED
const PUB_STATUS_READY_TO_PUBLISH = 6; // Publication::STATUS_READY_TO_PUBLISH (pre-publish intent)

const SUB_STATUS_PUBLISHED = 3; // PKPSubmission::STATUS_PUBLISHED
const SUB_STATUS_SCHEDULED = 5; // PKPSubmission::STATUS_SCHEDULED
const SUB_STATUS_DECLINED = 4; // PKPSubmission::STATUS_DECLINED

// ---- reader-side notice / status strings (locale/en) ----------------------
const OUTDATED_NOTICE = 'This is an outdated version';
const PREVIEW_NOTICE = 'This is a preview and has not been published';
const EDITOR_EDIT_WARNING =
	'Warning: This version has been published. Editing it may impact the published content.';
const AUTHOR_EDIT_DISABLED =
	'This version has been published and can not be edited.';
const PUBLISH_REQUIREMENTS =
	'The following requirements must be met before this can be published.';
const DECLINED_REQUIREMENT = 'A declined submission can not be published.';
const SCHEDULE_CONFIRMATION = 'Are you sure you want to schedule this for publication?';
const VERSION_ASSIGN_ANNOUNCE =
	'The stage version that will be assigned to the publication is';

// Version-status labels (WorkflowPublicationVersionControl.vue statusProps).
const STATUS_LABEL_UNSCHEDULED = 'Unscheduled';
const STATUS_LABEL_UNPUBLISHED = 'Unpublished';
const STATUS_LABEL_PUBLISHED = 'Published';
const STATUS_LABEL_SCHEDULED = 'Scheduled';

/** A unique, hyphenless, alphanumeric tag (parallel isolation). */
function uniqueTag() {
	const workerIndex = test.info().parallelIndex;
	const suffix = Math.random().toString(36).slice(2, 8);
	return `pv${workerIndex}x${suffix}`;
}

/** The workflow side modal (its outer wrapper reports visibility:hidden — scope only). */
function workflowModal(page) {
	return page.locator('[data-cy="active-modal"]').first();
}

/**
 * Deep-link the workflow onto a specific Publication sub-pane of a specific
 * version. `dash` = 'editorial' for editorial roles, 'mySubmissions' for an
 * author.
 */
function pubLink(submissionId, pubId, name, {author = false} = {}) {
	const dash = author ? 'mySubmissions' : 'editorial';
	return (
		`/index.php/publicknowledge/en/dashboard/${dash}` +
		`?workflowSubmissionId=${submissionId}` +
		`&workflowMenuKey=publication_${pubId}_${name}`
	);
}

/** Open a version's Title & Abstract pane (editorial) and wait for it to mount. */
async function openTitleAbstract(page, submissionId, pubId, {author = false} = {}) {
	await page.goto(pubLink(submissionId, pubId, 'titleAbstract', {author}), {
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
async function fetchSubmission(page, submissionId) {
	const res = await page.request.get(
		`/index.php/publicknowledge/api/v1/submissions/${submissionId}`,
	);
	expect(res.ok(), `GET submission ${submissionId}: ${res.status()}`).toBeTruthy();
	return res.json();
}

/** GET one publication JSON (page session). */
async function fetchPublication(page, submissionId, pubId) {
	const res = await page.request.get(
		`/index.php/publicknowledge/api/v1/submissions/${submissionId}/publications/${pubId}`,
	);
	expect(res.ok(), `GET publication ${pubId}: ${res.status()}`).toBeTruthy();
	return res.json();
}

/** GET the publications list JSON (page session). */
async function fetchPublications(page, submissionId) {
	const res = await page.request.get(
		`/index.php/publicknowledge/api/v1/submissions/${submissionId}/publications`,
	);
	expect(res.ok(), `GET publications ${submissionId}: ${res.status()}`).toBeTruthy();
	const body = await res.json();
	return body.items || body;
}

/** Resolve the current publication id for a submission. */
async function currentPublicationId(page, submissionId) {
	return (await fetchSubmission(page, submissionId)).currentPublicationId;
}

/** The first issue matching a publish state (0 = future/unpublished, 1 = published). */
async function firstIssue(page, isPublished) {
	const res = await page.request.get(
		`/index.php/publicknowledge/api/v1/issues?isPublished=${isPublished}&count=100`,
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

/** PUT a publication (tunnelled as POST + override, matching useFetch). */
async function putPublication(ctx, submissionId, pubId, data, csrf) {
	return ctx.request.post(
		`/index.php/publicknowledge/api/v1/submissions/${submissionId}/publications/${pubId}`,
		{
			headers: {
				'X-Csrf-Token': csrf,
				'X-Http-Method-Override': 'PUT',
				'Content-Type': 'application/json',
			},
			data,
		},
	);
}

/** The status label rendered by WorkflowPublicationVersionControl for the open pane. */
function versionStatusControl(page) {
	// "Status: <label>" row — scope to the version-control text, avoid the
	// stage pipeline. The label span sits right after the "Status:" span
	// (t('semicolon') renders "Status: ").
	return workflowModal(page).getByText(/^Status:/).first().locator('..');
}

/**
 * Drive the shared publish two-step: click the entry button, fill the "Review
 * Publishing Details" side-modal, Confirm, and return the final publish
 * confirmation modal (`.pkpWorkflow__publishModal`) WITHOUT committing.
 *
 * Assumes a Publication sub-pane of the version to publish is already open.
 *
 * @param {object} opts
 * @param {'currentBack'|'futureSchedule'} opts.assignment
 * @param {number} opts.issueId
 * @param {'AO'|'PMUR'|'VoR'} [opts.versionStage='VoR']
 * @param {'true'|'false'} [opts.versionIsMinor='false']
 */
async function openPublishConfirm(page, {assignment, issueId, versionStage = 'VoR', versionIsMinor = 'false'}) {
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

	// The Review Publishing Details side-modal (WorkflowVersionSideModal in
	// publish mode). It stacks as a role=dialog with an accessible name.
	const details = page.getByRole('dialog', {name: /Review Publishing Details/i});
	await expect(details).toBeVisible({timeout: 20_000});
	const stageSelect = details.locator('select[name=versionStage]');
	await expect(stageSelect).toBeVisible({timeout: 20_000});

	// Let the issue composable finish its initial data load before switching
	// the assignment radio — switching too early leaves the hidden status field
	// at the wrong pre-publish intent (the isInitialDataLoad guard in
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

	const label =
		assignment === 'futureSchedule'
			? 'Assign To Future Issue and Schedule Only'
			: 'Assign To Current/Back Issue';
	await details.getByRole('radio', {name: label, exact: true}).check();

	// The picker re-fetches issues for the chosen assignment; wait for our
	// target option to appear, then select it.
	const picker = details.locator('select[name=issueId]');
	await expect(picker.locator(`option[value="${issueId}"]`)).toHaveCount(1, {
		timeout: 20_000,
	});
	await picker.selectOption(String(issueId));

	await stageSelect.selectOption(versionStage);
	// "Minor" is disabled until a version exists at the chosen stage; setting
	// the enabled value is a no-op when already selected.
	await details
		.locator('select[name=versionIsMinor]')
		.selectOption(versionIsMinor)
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
	await dialog
		.getByRole('button', {name: /^(Unpublish|Unschedule)$/})
		.click();
	await expect(dialog).toBeHidden({timeout: 15_000});
}

/** Open the Create New Version dialog, fill stage + significance, confirm. */
async function createNewVersion(page, {versionStage = 'VoR', versionIsMinor = 'true'} = {}) {
	const modal = workflowModal(page);
	await modal.getByText('Create New Version', {exact: true}).first().click();
	const dialog = page.locator('[data-cy="dialog"]');
	await expect(dialog).toBeVisible({timeout: 15_000});
	await dialog.locator('select[name=versionStage]').selectOption(versionStage);
	await dialog.locator('select[name=versionIsMinor]').selectOption(versionIsMinor);
	await dialog.getByRole('button', {name: 'Confirm', exact: true}).click();
	await expect(dialog).toBeHidden({timeout: 20_000});
}

// ---- scenario specs -------------------------------------------------------

/** A VoR 1.0 published to publicknowledge's published issue (Vol 1 No 2 2014). */
function publishedVorSpec({tag, title, galleys, participants}) {
	const pub = {
		versionStage: 'VoR',
		metadata: {title: {en: title}},
		issue: {volume: 1, number: 2, year: 2014},
		published: true,
	};
	if (galleys) pub.galleys = galleys;
	return {
		tag,
		journal: 'publicknowledge',
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
		publications: [pub],
	};
}

/** A submitted, unpublished, stage-1 submission whose single version is unassigned. */
function unassignedSpec({tag, title, participants, decisions}) {
	return {
		tag,
		journal: 'publicknowledge',
		submitter: 'atester',
		section: 'ART',
		locale: 'en',
		participants: participants ?? [{user: 'dbarnes', role: 'editor'}],
		...(decisions ? {decisions} : {}),
		publications: [{metadata: {title: {en: title}}}],
	};
}

test.use({user: 'dbarnes'}); // the assigned editor — a manager on publicknowledge

test.describe('Publication versioning', () => {
	// Scenario 1 — Correct a published article. Create a new VoR minor version
	// off a published VoR 1.0: it appears "Unpublished" with metadata + galleys
	// copied. Fix the title, publish. The reader now gets 1.1 at the plain URL;
	// 1.0 stays reachable at /version/{id} with the outdated-version notice.
	test(
		'Correct a published article',
		{tag: ['@smoke', '@regression']},
		async ({page, pkpApi, browser, baseURL}) => {
			test.slow();
			const tag = uniqueTag();
			const {submission, publications} = await pkpApi.createSubmission(
				publishedVorSpec({
					tag,
					title: `Correct me ${tag}`,
					galleys: [{label: 'PDF', file: 'default-article.pdf'}],
				}),
			);
			const v1Id = publications[0].id;
			expect(publications[0].status).toBe(PUB_STATUS_PUBLISHED);
			expect(publications[0].galleys.length).toBeGreaterThan(0);

			// Open the published v1 and create a new VoR minor version.
			await openTitleAbstract(page, submission.id, v1Id);
			await expect(versionStatusControl(page)).toContainText(
				STATUS_LABEL_PUBLISHED,
			);
			await createNewVersion(page, {versionStage: 'VoR', versionIsMinor: 'true'});

			// The new draft version — copied metadata + galleys, status Unpublished.
			await expect
				.poll(async () => (await fetchPublications(page, submission.id)).length, {
					timeout: 20_000,
				})
				.toBe(2);
			const pubs = await fetchPublications(page, submission.id);
			const v2 = pubs.find((p) => p.id !== v1Id);
			expect(v2.versionStage).toBe('VoR');
			expect(v2.versionMajor).toBe(1);
			expect(v2.versionMinor).toBe(1); // VoR 1.1
			expect(v2.status).toBe(PUB_STATUS_QUEUED);
			// Title copied (carries the tag); galleys cloned.
			expect(localizedTitle(v2)).toContain(tag);
			expect(v2.galleys.length).toBeGreaterThan(0);

			// The version pane shows the copied draft as "Unpublished" (not current).
			await openTitleAbstract(page, submission.id, v2.id);
			await expect(versionStatusControl(page)).toContainText(
				STATUS_LABEL_UNPUBLISHED,
			);

			// Fix the title on the new version. The metadata-edit surface itself
			// is owned by publication-title-abstract-body; here we only need the
			// correction to persist on v2 so the reader gets it, so apply it
			// deterministically through the publication PUT (as the form does).
			const correctedTitle = `Corrected ${tag}`;
			const csrf = await getCsrf(page);
			const saveRes = await putPublication(
				page,
				submission.id,
				v2.id,
				{title: {en: correctedTitle}},
				csrf,
			);
			expect(saveRes.status(), await saveRes.text()).toBe(200);
			expect(localizedTitle(await fetchPublication(page, submission.id, v2.id))).toContain(
				correctedTitle,
			);

			const publishedIssue = await firstIssue(page, 1);
			const publishModal = await openPublishConfirm(page, {
				assignment: 'currentBack',
				issueId: publishedIssue.id,
				versionStage: 'VoR',
				versionIsMinor: 'true',
			});
			await commitPublish(page, publishModal);

			// Server truth: v2 published + now the current version.
			await expect
				.poll(async () => (await fetchPublication(page, submission.id, v2.id)).status, {
					timeout: 20_000,
				})
				.toBe(PUB_STATUS_PUBLISHED);
			await expect
				.poll(async () => currentPublicationId(page, submission.id), {timeout: 20_000})
				.toBe(v2.id);

			// --- Reader side (anonymous) ---
			const anon = await browser.newContext({
				baseURL,
				storageState: {cookies: [], origins: []},
			});
			try {
				const reader = await anon.newPage();
				const article = new ArticlePage(reader);

				// Plain URL → the current (corrected 1.1) version, NO notice.
				await article.goto(submission.id, {locale: 'en'});
				await expect(reader.locator('h1.page_title')).toContainText(correctedTitle);
				await expect(reader.getByText(OUTDATED_NOTICE)).toHaveCount(0);
				await expect(reader.getByText(PREVIEW_NOTICE)).toHaveCount(0);
				// Both published versions listed.
				await expect(article.versionEntries).toHaveCount(2);

				// Specific-version URL for 1.0 → the old version WITH the outdated notice.
				await article.goto(submission.id, {locale: 'en', version: v1Id});
				await expect(reader.getByText(OUTDATED_NOTICE)).toBeVisible();
				await expect(reader.locator('h1.page_title')).toContainText(tag);
				await expect(reader.locator('h1.page_title')).not.toContainText(
					correctedTitle,
				);
			} finally {
				await anon.close();
			}
		},
	);

	// Scenario 2 — Schedule into a future issue. Schedule For Publication on an
	// unassigned version → Review Publishing Details (VoR, "schedule into a
	// future issue") → Confirm → the final modal says it will be scheduled →
	// the version becomes Scheduled (Preview + Unschedule); readers still get a
	// not-found. ⚠ row 24/18: the dashboard mis-files the submission as
	// Published the whole time — asserted here as submission.status = PUBLISHED
	// while publication.status = SCHEDULED.
	test(
		'Schedule into a future issue',
		{tag: ['@smoke', '@regression']},
		async ({page, pkpApi, browser, baseURL}) => {
			test.slow();
			const tag = uniqueTag();
			const {submission} = await pkpApi.createSubmission(
				unassignedSpec({tag, title: `Future ${tag}`}),
			);
			const pubId = await currentPublicationId(page, submission.id);
			const futureIssue = await firstIssue(page, 0);

			await openTitleAbstract(page, submission.id, pubId);

			const publishModal = await openPublishConfirm(page, {
				assignment: 'futureSchedule',
				issueId: futureIssue.id,
				versionStage: 'VoR',
				versionIsMinor: 'false',
			});
			// The final modal announces a schedule (not an immediate publish).
			await expect(publishModal.getByText(SCHEDULE_CONFIRMATION)).toBeVisible({
				timeout: 20_000,
			});
			await commitPublish(page, publishModal);

			// Version pane now shows Scheduled with Preview + Unschedule controls.
			await openTitleAbstract(page, submission.id, pubId);
			await expect(versionStatusControl(page)).toContainText(
				STATUS_LABEL_SCHEDULED,
			);
			await expect(
				workflowModal(page).getByRole('button', {name: 'Unschedule', exact: true}),
			).toBeVisible();
			await expect(
				workflowModal(page).getByRole('button', {name: 'Preview', exact: true}),
			).toBeVisible();

			// Server truth: publication SCHEDULED, assigned to the future issue.
			const pub = await fetchPublication(page, submission.id, pubId);
			expect(pub.status).toBe(PUB_STATUS_SCHEDULED);
			expect(pub.issueId).toBe(futureIssue.id);

			// ⚠ SPEC CONTRADICTION (fixed since verification) — rule 24 / row 18
			// claim the UI publish endpoint hard-codes submission.status =
			// PUBLISHED while the publication is SCHEDULED (so the dashboard
			// mis-files it under "Published"). That is NO LONGER TRUE: commit
			// d52aa4c84b (pkp/pkp-lib#12799, 2026-06-28) changed
			// PKPSubmissionController::publishPublication from
			// `updateStatus($submission, STATUS_PUBLISHED)` to the recompute
			// `updateStatus($submission)`. So a UI-scheduled article now correctly
			// computes submission.status = SCHEDULED and files under "Scheduled".
			// Assert the app's REAL (fixed) behavior.
			const sub = await fetchSubmission(page, submission.id);
			expect(sub.status).toBe(SUB_STATUS_SCHEDULED);

			// Reader: a scheduled (not published) version is not reachable publicly.
			const anon = await browser.newContext({
				baseURL,
				storageState: {cookies: [], origins: []},
			});
			try {
				const view = await anon.request.get(
					`/index.php/publicknowledge/en/article/view/${submission.id}`,
				);
				expect(view.status(), 'anon reader gets not-found on a scheduled article').toBe(
					404,
				);
			} finally {
				await anon.close();
			}
		},
	);

	// Scenario 3 — Roll back the latest version. Unpublish the second (current)
	// version → it returns to draft, the current pointer falls back to v1, the
	// reader sees v1 with no notice, and the rolled-back version drops out of
	// the reader's versions list. Unpublishing v1 too makes the article
	// not-found for readers.
	//
	// NOTE (spec-prose vs app): scenario 3's prose says the rolled-back version
	// shows "Unscheduled". Rule 4 + WorkflowPublicationVersionControl.vue +
	// getCurrentPublicationIdByPublications() all make a NON-current QUEUED
	// version show "Unpublished" (Unscheduled == current). This test asserts the
	// app's real "Unpublished".
	test(
		'Roll back the latest version',
		{tag: ['@smoke', '@regression']},
		async ({page, pkpApi, browser, baseURL}) => {
			test.slow();
			const tag = uniqueTag();
			// Seed two published versions (VoR 1.0 then VoR 1.1) to the published issue.
			const {submission, publications} = await pkpApi.createSubmission({
				tag,
				journal: 'publicknowledge',
				submitter: 'atester',
				section: 'ART',
				locale: 'en',
				participants: [{user: 'dbarnes', role: 'editor', canChangeMetadata: true}],
				decisions: [
					{type: 'skipExternalReview', by: 'dbarnes'},
					{type: 'sendToProduction', by: 'dbarnes'},
				],
				publications: [
					{
						versionStage: 'VoR',
						metadata: {title: {en: `Rollback ${tag}`}},
						issue: {volume: 1, number: 2, year: 2014},
						published: true,
					},
					{
						versionStage: 'VoR',
						versionIsMinor: true,
						metadata: {title: {en: `Rollback v2 ${tag}`}},
						issue: {volume: 1, number: 2, year: 2014},
						published: true,
					},
				],
			});
			expect(publications).toHaveLength(2);
			const v1Id = publications[0].id;
			const v2Id = publications[1].id;
			expect(publications[1].versionMinor).toBe(1); // VoR 1.1
			// Current is the most mature published = v2.
			await expect
				.poll(async () => currentPublicationId(page, submission.id), {timeout: 20_000})
				.toBe(v2Id);

			// Unpublish v2 (the latest, current version).
			await openTitleAbstract(page, submission.id, v2Id);
			await unpublishOpenVersion(page);

			// v2 returns to draft; current pointer falls back to v1.
			await expect
				.poll(async () => (await fetchPublication(page, submission.id, v2Id)).status, {
					timeout: 20_000,
				})
				.toBe(PUB_STATUS_QUEUED);
			await expect
				.poll(async () => currentPublicationId(page, submission.id), {timeout: 20_000})
				.toBe(v1Id);

			// Per rule 4 the now-non-current QUEUED v2 shows "Unpublished"
			// (contradicting scenario 3's prose "Unscheduled" — reported).
			await openTitleAbstract(page, submission.id, v2Id);
			await expect(versionStatusControl(page)).toContainText(
				STATUS_LABEL_UNPUBLISHED,
			);
			await expect(versionStatusControl(page)).not.toContainText(
				STATUS_LABEL_UNSCHEDULED,
			);

			// Reader: v1 is shown, no notice, and the rolled-back v2 is gone from
			// the versions list (only one published version remains).
			const anon = await browser.newContext({
				baseURL,
				storageState: {cookies: [], origins: []},
			});
			try {
				const reader = await anon.newPage();
				const article = new ArticlePage(reader);
				await article.goto(submission.id, {locale: 'en'});
				await expect(reader.locator('h1.page_title')).toContainText(`Rollback ${tag}`);
				await expect(reader.locator('h1.page_title')).not.toContainText(`v2 ${tag}`);
				await expect(reader.getByText(OUTDATED_NOTICE)).toHaveCount(0);
				await expect(article.versionEntries).toHaveCount(1);
			} finally {
				await anon.close();
			}

			// Unpublish v1 too → no published version remains → article not-found.
			await openTitleAbstract(page, submission.id, v1Id);
			await unpublishOpenVersion(page);
			await expect
				.poll(async () => (await fetchPublication(page, submission.id, v1Id)).status, {
					timeout: 20_000,
				})
				.toBe(PUB_STATUS_QUEUED);

			const anon2 = await browser.newContext({
				baseURL,
				storageState: {cookies: [], origins: []},
			});
			try {
				const view = await anon2.request.get(
					`/index.php/publicknowledge/en/article/view/${submission.id}`,
				);
				expect(view.status(), 'reader not-found after full rollback').toBe(404);
				// (OAI tombstone re-creation on leaving Published is a backend
				// side-effect; the observable rollback-to-nothing is this 404.)
			} finally {
				await anon2.close();
			}
		},
	);

	// Scenario 4 — Author locked out by publication. Once any version is
	// published OR scheduled, an author-only user's metadata saves are refused
	// on EVERY version (even drafts). The "cannot be edited" panel shows ONLY
	// when the selected version is Published — so on a scheduled-only submission
	// the author is locked with no explaining panel. The editor stays warn-not-
	// locked on the published version.
	test(
		'Author locked out by publication',
		{tag: ['@smoke', '@regression']},
		async ({page, pkpApi, asUser}) => {
			test.slow();
			const tag = uniqueTag();

			// Submission P: v1 published + v2 draft. atester is the author.
			const {submission: subP, publications: pubsP} = await pkpApi.createSubmission({
				tag,
				journal: 'publicknowledge',
				submitter: 'atester',
				section: 'ART',
				locale: 'en',
				participants: [{user: 'dbarnes', role: 'editor', canChangeMetadata: true}],
				decisions: [
					{type: 'skipExternalReview', by: 'dbarnes'},
					{type: 'sendToProduction', by: 'dbarnes'},
				],
				publications: [
					{
						versionStage: 'VoR',
						metadata: {title: {en: `Locked pub ${tag}`}},
						issue: {volume: 1, number: 2, year: 2014},
						published: true,
					},
					{
						versionStage: 'VoR',
						versionIsMinor: true,
						metadata: {title: {en: `Locked draft ${tag}`}},
					},
				],
			});
			const pPub = pubsP[0]; // published v1
			const pDraft = pubsP[1]; // draft v2
			expect(pPub.status).toBe(PUB_STATUS_PUBLISHED);
			expect(pDraft.status).toBe(PUB_STATUS_QUEUED);

			// Submission S: a single SCHEDULED version (future issue → schedules).
			const futureIssue = await firstIssue(page, 0);
			const {submission: subS, publications: pubsS} = await pkpApi.createSubmission({
				tag: `${tag}s`,
				journal: 'publicknowledge',
				submitter: 'atester',
				section: 'ART',
				locale: 'en',
				participants: [{user: 'dbarnes', role: 'editor', canChangeMetadata: true}],
				decisions: [
					{type: 'skipExternalReview', by: 'dbarnes'},
					{type: 'sendToProduction', by: 'dbarnes'},
				],
				publications: [
					{
						versionStage: 'VoR',
						metadata: {title: {en: `Sched lock ${tag}`}},
						issue: {volume: futureIssue.volume, number: futureIssue.number, year: futureIssue.year},
						published: true,
					},
				],
			});
			const sPub = pubsS[0];
			expect(sPub.status).toBe(PUB_STATUS_SCHEDULED);
			expect((await fetchSubmission(page, subS.id)).status).toBe(SUB_STATUS_SCHEDULED);

			// --- Editor: warn-not-locked on the published version ---
			await openTitleAbstract(page, subP.id, pPub.id);
			await expect(workflowModal(page).getByText(EDITOR_EDIT_WARNING)).toBeVisible({
				timeout: 20_000,
			});
			await expect(
				workflowModal(page)
					.locator('form.pkpForm')
					.getByRole('button', {name: 'Save', exact: true}),
			).toBeEnabled();

			// --- Author: locked out ---
			const authorCtx = await asUser('atester');
			const csrfCtx = await authorCtx.newPage();
			await csrfCtx.goto('/index.php/publicknowledge/en/dashboard/mySubmissions', {
				waitUntil: 'commit',
			});
			const csrf = await getCsrf(csrfCtx);

			// (a) Published version: PUT refused + the "cannot be edited" panel shown.
			const putPub = await putPublication(
				authorCtx,
				subP.id,
				pPub.id,
				{title: {en: `Hacked ${tag}`}},
				csrf,
			);
			expect([401, 403]).toContain(putPub.status());

			const authorPage = await authorCtx.newPage();
			await openTitleAbstract(authorPage, subP.id, pPub.id, {author: true});
			await expect(
				workflowModal(authorPage).getByText(AUTHOR_EDIT_DISABLED),
			).toBeVisible({timeout: 20_000});

			// (b) Draft version of the same (published) submission: PUT still
			// refused (locked even on a draft) but NO explaining panel.
			const putDraft = await putPublication(
				authorCtx,
				subP.id,
				pDraft.id,
				{title: {en: `Hacked draft ${tag}`}},
				csrf,
			);
			expect([401, 403]).toContain(putDraft.status());

			await openTitleAbstract(authorPage, subP.id, pDraft.id, {author: true});
			await expect(
				workflowModal(authorPage).getByText(AUTHOR_EDIT_DISABLED),
			).toHaveCount(0);

			// (c) Scheduled-only submission: PUT refused, and again NO panel — the
			// panel is gated on STATUS_PUBLISHED, so a scheduled version locks the
			// author silently.
			const putSched = await putPublication(
				authorCtx,
				subS.id,
				sPub.id,
				{title: {en: `Hacked sched ${tag}`}},
				csrf,
			);
			expect([401, 403]).toContain(putSched.status());

			await openTitleAbstract(authorPage, subS.id, sPub.id, {author: true});
			await expect(
				workflowModal(authorPage).getByText(AUTHOR_EDIT_DISABLED),
			).toHaveCount(0);
		},
	);

	// Scenario 5 — Blocked publish. On a declined submission, Schedule For
	// Publication is still offered; Review Publishing Details Confirm persists
	// the pre-publish intent + issue (⚠ row 23b), but the final confirm modal
	// lists the blocking requirement with NO commit button, so the publication
	// stays unpublished.
	test(
		'Blocked publish',
		{tag: ['@smoke', '@regression']},
		async ({page, pkpApi}) => {
			test.slow();
			const tag = uniqueTag();
			const {submission} = await pkpApi.createSubmission(
				unassignedSpec({
					tag,
					title: `Declined ${tag}`,
					decisions: [{type: 'initialDecline', by: 'dbarnes'}],
				}),
			);
			// The submission is declined at the submission level; its publication
			// stays QUEUED (declining never sets a publication status).
			expect((await fetchSubmission(page, submission.id)).status).toBe(
				SUB_STATUS_DECLINED,
			);
			const pubId = await currentPublicationId(page, submission.id);
			const publishedIssue = await firstIssue(page, 1);

			await openTitleAbstract(page, submission.id, pubId);

			// Schedule For Publication is still clickable on a declined submission
			// (⚠ row 23). Drive Review Publishing Details → Confirm.
			const publishModal = await openPublishConfirm(page, {
				assignment: 'currentBack',
				issueId: publishedIssue.id,
				versionStage: 'VoR',
				versionIsMinor: 'false',
			});

			// The confirm modal lists the blocking requirement and offers NO commit.
			await expect(publishModal.getByText(PUBLISH_REQUIREMENTS)).toBeVisible({
				timeout: 20_000,
			});
			await expect(publishModal.getByText(DECLINED_REQUIREMENT)).toBeVisible();
			await expect(
				publishModal.getByRole('button', {
					name: /^(Publish|Schedule For Publication)$/,
				}),
			).toHaveCount(0);

			// ⚠ row 23b — the Review Publishing Details Confirm already persisted
			// the pre-publish intent + issue BEFORE validation ran, yet the
			// publication is never actually published.
			const pub = await fetchPublication(page, submission.id, pubId);
			expect(pub.issueId).toBe(publishedIssue.id);
			expect(pub.status).toBe(PUB_STATUS_READY_TO_PUBLISH);
			expect(pub.status).not.toBe(PUB_STATUS_PUBLISHED);
		},
	);

	// Scenario 6 — Version numbering ladder. In the create-version dialog on a
	// submission with only VoR 1.0: choosing Author Original disables "Minor"
	// (no AO exists yet → it would be 1.0); VoR + minor yields 1.1; a later VoR
	// + major yields 2.0. Publishing an unassigned version auto-assigns the next
	// major VoR, announced in the publish confirm text.
	test(
		'Version numbering ladder',
		{tag: ['@smoke', '@regression']},
		async ({page, pkpApi}) => {
			test.slow();
			const tag = uniqueTag();
			const {submission, publications} = await pkpApi.createSubmission(
				publishedVorSpec({tag, title: `Ladder ${tag}`}),
			);
			const v1Id = publications[0].id;

			// --- Dialog affordance: AO disables Minor, VoR enables it ---
			await openTitleAbstract(page, submission.id, v1Id);
			await workflowModal(page)
				.getByText('Create New Version', {exact: true})
				.first()
				.click();
			const dialog = page.locator('[data-cy="dialog"]');
			await expect(dialog).toBeVisible({timeout: 15_000});
			const minorOption = dialog.locator('select[name=versionIsMinor] option[value="true"]');

			// Author Original: no AO version exists yet → "Minor" is disabled.
			await dialog.locator('select[name=versionStage]').selectOption('AO');
			await expect(minorOption).toBeDisabled();
			// Version of Record: a VoR 1.0 exists → "Minor" becomes enabled.
			await dialog.locator('select[name=versionStage]').selectOption('VoR');
			await expect(minorOption).toBeEnabled();

			// Confirm VoR + Minor → creates VoR 1.1.
			await dialog.locator('select[name=versionIsMinor]').selectOption('true');
			await dialog.getByRole('button', {name: 'Confirm', exact: true}).click();
			await expect(dialog).toBeHidden({timeout: 20_000});

			await expect
				.poll(async () => (await fetchPublications(page, submission.id)).length, {
					timeout: 20_000,
				})
				.toBe(2);
			let pubs = await fetchPublications(page, submission.id);
			const v2 = pubs.find((p) => p.id !== v1Id);
			expect(v2.versionMajor).toBe(1);
			expect(v2.versionMinor).toBe(1); // VoR 1.1

			// --- VoR + Major on VoR 1.1 → VoR 2.0 ---
			await openTitleAbstract(page, submission.id, v2.id);
			await createNewVersion(page, {versionStage: 'VoR', versionIsMinor: 'false'});
			await expect
				.poll(async () => (await fetchPublications(page, submission.id)).length, {
					timeout: 20_000,
				})
				.toBe(3);
			pubs = await fetchPublications(page, submission.id);
			const ids = new Set([v1Id, v2.id]);
			const v3 = pubs.find((p) => !ids.has(p.id));
			expect(v3.versionMajor).toBe(2);
			expect(v3.versionMinor).toBe(0); // VoR 2.0

			// --- Author Original numbering: nextAvailableVersion computes 1.0 ---
			const aoRes = await page.request.get(
				`/index.php/publicknowledge/api/v1/submissions/${submission.id}/nextAvailableVersion?versionStage=AO&versionIsMinor=true`,
			);
			expect(aoRes.ok(), `nextAvailableVersion AO: ${aoRes.status()}`).toBeTruthy();
			const ao = await aoRes.json();
			expect(ao.versionStage).toBe('AO');
			expect(ao.majorNumbering).toBe(1);
			expect(ao.minorNumbering).toBe(0); // Author Original → 1.0

			// --- Publishing an unassigned version auto-assigns the next major VoR,
			// announced in the confirm text. A fresh unassigned submission passes
			// validatePublish (issue-less), so the legacy PublishHandler confirm
			// modal renders the auto-assignment announcement.
			const {submission: unassigned} = await pkpApi.createSubmission(
				unassignedSpec({tag: `${tag}u`, title: `Unassigned ${tag}`}),
			);
			const unassignedPubId = await currentPublicationId(page, unassigned.id);
			// The next VoR major for a stage-less submission is 1.0.
			const vorRes = await page.request.get(
				`/index.php/publicknowledge/api/v1/submissions/${unassigned.id}/nextAvailableVersion?versionStage=VoR&versionIsMinor=false`,
			);
			const vor = await vorRes.json();
			expect(vor.versionStage).toBe('VoR');
			expect(vor.majorNumbering).toBe(1);
			expect(vor.minorNumbering).toBe(0); // Version of Record 1.0

			// The publish confirm modal (PublishForm) announces the stage that will
			// be assigned. Fetch the legacy modal fragment directly (the same URL
			// the "Schedule For Publication" flow opens once a version holds an
			// intent) and assert the announcement text + the VoR label. Build the
			// URL from the page's real legacyGridBaseUrl exactly as
			// useLegacyGridUrl does (modals.publish.PublishHandler → the
			// modals/publish/publish component + the publish op).
			const fragmentUrl = await page.evaluate(
				({submissionId, publicationId}) =>
					window.pkp.context.legacyGridBaseUrl.replace(
						/component\/action$/,
						'modals/publish/publish/publish',
					) + `?submissionId=${submissionId}&publicationId=${publicationId}`,
				{submissionId: unassigned.id, publicationId: unassignedPubId},
			);
			const confirmFragment = await page.request.get(fragmentUrl);
			expect(confirmFragment.ok(), `publish modal fragment: ${confirmFragment.status()}`).toBeTruthy();
			const fragmentText = await confirmFragment.text();
			expect(fragmentText).toContain(VERSION_ASSIGN_ANNOUNCE);
			expect(fragmentText).toContain('Version of Record 1.0');
		},
	);
});

/** Pull the English (or first) localized title off a publication JSON. */
function localizedTitle(pub) {
	const title = pub.fullTitle ?? pub.title ?? {};
	if (typeof title === 'string') return title;
	return title.en ?? Object.values(title)[0] ?? '';
}
