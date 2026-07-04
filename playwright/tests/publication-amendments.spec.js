// @ts-check
const fs = require('fs');
const path = require('path');
const {test, expect} = require('../support/fixtures.js');
const {ArticlePage} = require('../pages/ArticlePage.js');
const {ReviewRoundPanel} = require('../../lib/pkp/playwright/pages/ReviewRoundPanel.js');
const {FileStagePanel} = require('../../lib/pkp/playwright/pages/FileStagePanel.js');
const {
	setTinyMceContent,
	getTinyMceContent,
} = require('../../lib/pkp/playwright/support/tinymce.js');

/**
 * Publication amendments (Update Type + Summary of Changes) — the 7 canonical
 * scenarios of docs/product/specs/publication-amendments.md (status: draft).
 * Scenarios 2 ("editor inserts a revision's summary") and 6 ("insert fills only
 * the submission locale") are the same Insert-Content flow with one extra
 * assertion, so they are MERGED into one bilingual insert test → 6 tests.
 *
 * Scenario → test:
 *   1 → author records a revision's Summary of Changes → Amendment Notice badge
 *   3 → Schedule For Publication carries the Update Type + Summary of Changes
 *   4 → Update Type across versions (v1 default New Version → v2 Correction)
 *   2 + 6 (MERGED) → editor inserts a revision's summary into the public notice
 *        (primary/submission locale only; the French value stays empty)
 *   5 → Insert-modal empty state; manual entry still saves
 *   7 → permission boundary (author published-lock / recommend-only / reader
 *        sees NO amendment notice — the ⚠ rule-9 reader gap, asserted as absence)
 *
 * LIVENESS (task brief): the editor-side CAPTURE is fully driven live here —
 *   • the Update Type <select> (12 options, default New Version) is driven on
 *     BOTH capture surfaces: the publish "Review Publishing Details" version
 *     form (test "Schedule For Publication…") AND the Publication Settings
 *     Issue-entry form ("Update Type across versions");
 *   • the file-level Summary of Changes (Amendment Notice) is recorded live on a
 *     review-revision file's details form, and the Amendment Notice badge
 *     rendered (test 1);
 *   • the Insert Content TinyMCE button + side modal are driven live (insert +
 *     empty-state tests).
 * The READER-SIDE display is NOT implemented (rule 9 ⚠): the permission test
 * loads the published reader page and asserts the notice / update type are
 * ABSENT — the spec's reader-gap confirmation.
 *
 * Seeding: the review-revision file that feeds the Insert modal is seeded
 * directly through the files REST API (multipart add at fileStage 15,
 * assocType ASSOC_TYPE_REVIEW_ROUND) carrying its single-value summaryOfChanges
 * — the same shape the author-upload wizard produces, without paying the wizard
 * cost twice (test 1 already drives that wizard live). publicknowledge stays
 * read-only: only fresh submissions are added; the shared future/published
 * issues are scheduled INTO but never mutated. Every persistence assertion
 * reads the value back through the publication / files REST API
 * (update_type, summaryOfChanges).
 */

// ---- publication / submission status constants (verified) -----------------
const PUB_STATUS_QUEUED = 1; // PKPPublication::STATUS_QUEUED
const PUB_STATUS_PUBLISHED = 3; // PKPPublication::STATUS_PUBLISHED

// ---- amendment values / labels --------------------------------------------
const UPDATE_TYPE_NEW_VERSION = 'new_version'; // UpdateType::NEW_VERSION (default)
const UPDATE_TYPE_CORRECTION = 'correction'; // UpdateType::CORRECTION
const UPDATE_TYPE_COUNT = 12; // UpdateType::cases()

// ---- file / assoc constants (verified against source) ---------------------
const FILE_STAGE_REVIEW_REVISION = 15; // SubmissionFile::SUBMISSION_FILE_REVIEW_REVISION
const FILE_STAGE_SUBMISSION = 2; // SubmissionFile::SUBMISSION_FILE_SUBMISSION
const ASSOC_TYPE_REVIEW_ROUND = 523; // 0x000020B — PKPApplication::ASSOC_TYPE_REVIEW_ROUND

// ---- rendered copy (locale/en) --------------------------------------------
const INSERT_CONTENT = 'Insert Content'; // common.insertContent (toolbar button + modal title)
const INSERT = 'Insert'; // common.insert (per-item button)
const INSERT_EMPTY =
	"No saved summaries found for this submission's review revisions."; // publication.insertContent.empty
const AMENDMENT_BADGE = 'Amendment Notice'; // submission.files.amendmentNotice
const SUMMARY_FIELD_LABEL = 'Summary of Changes (Amendment Notice)'; // submission.form.summaryOfChanges
const UPDATE_TYPE_LABEL = 'Update Type'; // publication.updateType.label

// Round-status label so the author view is on the revisions-requested phrasing.
const LABEL_REVISIONS_REQUESTED = 'Revisions have been requested.';

// Issue-assignment radio (publication-issue-assignment); ASSIGN_NONE satisfies
// the mandatory issue radio without a picker (rule 10) for placement-free saves.
const ASSIGN_NONE = "Don't Assign To An Issue";

// The published reader banner an amendment notice would live near (if it were
// rendered) — used only to bound the "reader sees nothing" absence assertion.
const AUTHOR_NAME = 'Author Tester';

const ARTICLE_FIXTURE = path.resolve(
	__dirname,
	'..',
	'..',
	'lib',
	'pkp',
	'playwright',
	'fixtures',
	'files',
	'default-article.pdf',
);

/** A unique, hyphenless, alphanumeric tag (parallel isolation). */
function uniqueTag() {
	const workerIndex = test.info().parallelIndex;
	const suffix = Math.random().toString(36).slice(2, 8);
	return `pa${workerIndex}x${suffix}`;
}

/** The workflow side modal (outer wrapper reports visibility:hidden — scope only). */
function workflowModal(page) {
	return page.locator('[data-cy="active-modal"]').first();
}

/** Deep-link the workflow onto a Publication sub-pane of a specific version. */
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
}

/** Open the Issue pane (Publication Settings tab) and wait for the form to mount. */
async function openIssueTab(page, submissionId, pubId, {author = false} = {}) {
	await page.goto(pubLink(submissionId, pubId, 'issue', {author}), {
		waitUntil: 'commit',
	});
	await expect(page.locator('#issueEntry-sectionId-control')).toBeVisible({
		timeout: 25_000,
	});
	// The injected issue-assignment radio signals the OJS placement surface rendered.
	await expect(assignmentRadio(page, ASSIGN_NONE)).toBeVisible({timeout: 25_000});
}

/** The injected assignment radio, by option label. */
function assignmentRadio(page, name) {
	return page.getByRole('radio', {name, exact: true});
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
	const token = await page.evaluate(() => window.pkp.currentUser.csrfToken);
	expect(token, 'csrf token from page').toBeTruthy();
	return token;
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

/** The genreId of the seeded Article Text (Submission-stage) file. */
async function articleGenreId(page, submissionId) {
	const res = await page.request.get(
		`/index.php/publicknowledge/api/v1/submissions/${submissionId}/files?fileStages[]=${FILE_STAGE_SUBMISSION}`,
	);
	expect(res.ok(), `GET submission files: ${res.status()}`).toBeTruthy();
	const items = (await res.json()).items || [];
	expect(items.length, 'seeded Article Text file present').toBeGreaterThan(0);
	return items[0].genreId;
}

/**
 * Seed a review-revision file (fileStage 15, assoc'd to a review round) carrying
 * a single-value summaryOfChanges — the same shape the author-upload wizard
 * writes — via one multipart POST to the files REST API.
 */
async function createReviewRevisionFile(
	ctx,
	{submissionId, reviewRoundId, genreId, name, summaryOfChanges, csrf},
) {
	return ctx.request.post(
		`/index.php/publicknowledge/api/v1/submissions/${submissionId}/files`,
		{
			headers: {'X-Csrf-Token': csrf},
			multipart: {
				file: {
					name: `${name}.pdf`,
					mimeType: 'application/pdf',
					buffer: fs.readFileSync(ARTICLE_FIXTURE),
				},
				fileStage: String(FILE_STAGE_REVIEW_REVISION),
				assocType: String(ASSOC_TYPE_REVIEW_ROUND),
				assocId: String(reviewRoundId),
				genreId: String(genreId),
				'name[en]': name,
				summaryOfChanges,
			},
		},
	);
}

/**
 * Resolve the id of a mounted+initialised TinyMCE editor whose id contains
 * `includes` (optionally ending in `-{locale}`). Polls until it mounts.
 */
async function resolveEditorId(page, includes, {locale} = {}) {
	const handle = await page.waitForFunction(
		({inc, loc}) => {
			const tiny = window.tinymce;
			const list = (typeof tiny?.get === 'function' ? tiny.get() : null) ?? [];
			const ids = list.filter((e) => e.initialized).map((e) => e.id);
			if (loc) {
				return ids.find((id) => id.includes(inc) && id.endsWith('-' + loc)) || null;
			}
			return ids.find((id) => id.includes(inc)) || null;
		},
		{inc: includes, loc: locale ?? null},
		{timeout: 20_000},
	);
	return /** @type {string} */ (await handle.jsonValue());
}

/** Open the create-new-version dialog, fill stage + significance, confirm. */
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

/** Click "Schedule For Publication" and return the Review Publishing Details dialog. */
async function openPublishDetails(page) {
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
	await expect(details.locator('select[name=versionStage]')).toBeVisible({
		timeout: 20_000,
	});
	return details;
}

/** Choose the issue-assignment radio + issue in the (open) publish details dialog. */
async function pickPublishIssue(details, {assignment, issueId}) {
	// Let the issue composable finish its initial data load before switching the
	// radio (the isInitialDataLoad guard in useWorkflowPublicationFormIssue).
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
	const picker = details.locator('select[name=issueId]');
	await expect(picker.locator(`option[value="${issueId}"]`)).toHaveCount(1, {
		timeout: 20_000,
	});
	await picker.selectOption(String(issueId));
}

/** Commit the final publish/schedule modal and wait for it to close. */
async function commitPublish(page, publishModal) {
	await publishModal
		.getByRole('button', {name: /^(Publish|Schedule For Publication)$/})
		.click();
	await expect(publishModal).toBeHidden({timeout: 20_000});
}

/**
 * Save the Issue form (Publication Settings) and wait for the publication PUT
 * (tunnelled as POST). Returns the response.
 */
async function saveIssueForm(page, pubId) {
	const issueFormEl = page.locator('form.pkpForm', {
		has: page.locator('#issueEntry-sectionId-control'),
	});
	const [response] = await Promise.all([
		page.waitForResponse(
			(res) =>
				new RegExp(`/publications/${pubId}(?:\\?|$)`).test(res.url()) &&
				res.request().method() === 'POST',
			{timeout: 20_000},
		),
		issueFormEl.getByRole('button', {name: 'Save', exact: true}).click(),
	]);
	return response;
}

/** Pull the English (or first) localized title off a publication JSON. */
function localizedTitle(pub) {
	const title = pub.fullTitle ?? pub.title ?? {};
	if (typeof title === 'string') return title;
	return title.en ?? Object.values(title)[0] ?? '';
}

// ---- scenario specs -------------------------------------------------------

/** A VoR 1.0 published to publicknowledge's published issue (Vol 1 No 2 2014). */
function publishedVorSpec({tag, title, participants}) {
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
		publications: [
			{
				versionStage: 'VoR',
				metadata: {title: {en: title}},
				issue: {volume: 1, number: 2, year: 2014},
				published: true,
			},
		],
	};
}

/** A submitted, unpublished, stage-1 submission (its single version unassigned). */
function submittedSpec({tag, title, participants}) {
	return {
		tag,
		journal: 'publicknowledge',
		submitter: 'atester',
		section: 'ART',
		locale: 'en',
		participants: participants ?? [{user: 'dbarnes', role: 'editor'}],
		publications: [{metadata: {title: {en: title}}}],
	};
}

/** A submission in external review (round 1), for a review-revision-file surface. */
function inReviewSpec({tag, title, decisions = [], reviewers = []}) {
	return {
		tag,
		journal: 'publicknowledge',
		submitter: 'atester',
		section: 'ART',
		locale: 'en',
		participants: [{user: 'dbarnes', role: 'editor'}],
		decisions: [{type: 'sendExternalReview', by: 'dbarnes'}, ...decisions],
		reviewRounds: [{reviewers}],
		publications: [{metadata: {title: {en: title}}}],
	};
}

test.use({user: 'dbarnes'}); // the assigned editor — a manager on publicknowledge

test.describe('Publication amendments (Update Type + Summary of Changes)', () => {
	// Canonical scenario 1 — the AUTHOR records a revision's Summary of Changes.
	// On a submission whose round is Revisions-Requested, the author uploads a
	// revision (no summary yet → no Amendment Notice badge), then opens the
	// file's details form, fills the single-value "Summary of Changes (Amendment
	// Notice)" rich-text field and saves; the row now shows the Amendment Notice
	// badge and the file API carries the summary. (The "second revision without a
	// summary shows no badge" half is covered by asserting the SAME file's badge
	// is absent BEFORE the summary is recorded — one upload, both states.)
	test(
		"author records a revision's Summary of Changes -> Amendment Notice badge",
		{tag: ['@smoke', '@regression']},
		async ({page, pkpApi, asUser}) => {
			test.slow(); // author upload wizard + legacy file-metadata modal
			const tag = uniqueTag();
			const {submission} = await pkpApi.createSubmission(
				inReviewSpec({
					tag,
					title: `Amendment badge ${tag}`,
					decisions: [{type: 'requestRevisions', by: 'dbarnes'}],
					reviewers: [
						{
							user: 'jjanssen',
							method: 'anonymous',
							status: 'completed',
							recommendation: 'pendingRevisions',
						},
					],
				}),
			);

			// The author opens their round view and uploads a revision.
			const authorCtx = await asUser('atester');
			const authorPage = await authorCtx.newPage();
			const round = new ReviewRoundPanel(authorPage);
			await round.gotoAuthor(submission.id);
			await round.expectRoundStatus(1, LABEL_REVISIONS_REQUESTED);

			const fileName = `Revised manuscript ${tag}`;
			await round.uploadRevision({filePath: ARTICLE_FIXTURE, displayName: fileName});

			// The Revisions Uploaded panel now lists the file — with NO Amendment
			// Notice badge yet (no summary recorded).
			const panel = new FileStagePanel(authorPage, 'Revisions Uploaded');
			await expect(panel.row(fileName)).toBeVisible({timeout: 20_000});
			await expect(panel.row(fileName).getByText(AMENDMENT_BADGE)).toHaveCount(0);

			// Open the file's details form: it offers the single-value Summary of
			// Changes (Amendment Notice) field (review-revision files only).
			const editModal = await panel.openEditModal(fileName);
			await expect(editModal.getByText(SUMMARY_FIELD_LABEL)).toBeVisible({
				timeout: 15_000,
			});
			const summaryHtml = `<p>Corrected Figure 2 and updated the dataset ${tag}</p>`;
			const editorId = await resolveEditorId(authorPage, 'summaryOfChanges');
			await setTinyMceContent(authorPage, editorId, summaryHtml);
			await panel.saveEditModal(editModal);

			// API/DB truth: the review-revision file now carries the summary.
			await expect
				.poll(
					async () => {
						const res = await authorPage.request.get(
							`/index.php/publicknowledge/api/v1/submissions/${submission.id}/files?fileStages[]=${FILE_STAGE_REVIEW_REVISION}`,
						);
						const items = (await res.json()).items || [];
						const f = items.find((x) => (x.name?.en ?? '') === fileName);
						return f?.summaryOfChanges ?? '';
					},
					{timeout: 20_000},
				)
				.toContain(tag);

			// Rendered FileManager: reload the round view and the badge is present.
			await round.gotoAuthor(submission.id);
			await expect(panel.row(fileName)).toBeVisible({timeout: 20_000});
			await expect(panel.row(fileName).getByText(AMENDMENT_BADGE)).toBeVisible({
				timeout: 20_000,
			});
		},
	);

	// Canonical scenario 3 — Schedule For Publication carries the Update Type +
	// Summary of Changes. On the publish "Review Publishing Details" version form
	// the Update Type <select> renders all 12 options and defaults to New Version;
	// the multilingual Summary of Changes field is present. The editor sets
	// Update Type = Correction + a summary, assigns the published issue, and
	// commits; both values persist on the now-published publication.
	test(
		'Schedule For Publication carries the update type + summary',
		{tag: ['@smoke', '@regression']},
		async ({page, pkpApi}) => {
			test.slow();
			const tag = uniqueTag();
			const {submission} = await pkpApi.createSubmission(
				submittedSpec({tag, title: `Publish amendment ${tag}`}),
			);
			const pubId = await currentPublicationId(page, submission.id);
			const publishedIssue = await firstIssue(page, 1);

			await openTitleAbstract(page, submission.id, pubId);
			const details = await openPublishDetails(page);

			// The Update Type select: 12 options, defaults to New Version.
			const updateSelect = details.locator('select[name=updateType]');
			await expect(updateSelect).toBeVisible({timeout: 20_000});
			await expect(updateSelect.locator('option')).toHaveCount(UPDATE_TYPE_COUNT);
			await expect(updateSelect).toHaveValue(UPDATE_TYPE_NEW_VERSION);
			await expect(details.getByText(UPDATE_TYPE_LABEL, {exact: true})).toBeVisible();
			// The multilingual Summary of Changes field is present on this form.
			await expect(
				details.getByText(SUMMARY_FIELD_LABEL, {exact: true}),
			).toBeVisible();

			// Choose Correction + a summary.
			await updateSelect.selectOption(UPDATE_TYPE_CORRECTION);
			const summaryHtml = `<p>Methodology section revised ${tag}</p>`;
			const editorId = await resolveEditorId(page, 'summaryOfChanges', {locale: 'en'});
			await setTinyMceContent(page, editorId, summaryHtml);

			// Assign the published issue, then confirm + commit the publish.
			await pickPublishIssue(details, {
				assignment: 'currentBack',
				issueId: publishedIssue.id,
			});
			await details.locator('select[name=versionStage]').selectOption('VoR');
			await details
				.locator('select[name=versionIsMinor]')
				.selectOption('false')
				.catch(() => {});
			await details.getByRole('button', {name: 'Confirm', exact: true}).click();
			const publishModal = page.locator('.pkpWorkflow__publishModal');
			await expect(publishModal).toBeVisible({timeout: 20_000});
			await commitPublish(page, publishModal);

			// Server truth: published, with Correction + the summary persisted.
			await expect
				.poll(async () => (await fetchPublication(page, submission.id, pubId)).status, {
					timeout: 20_000,
				})
				.toBe(PUB_STATUS_PUBLISHED);
			const pub = await fetchPublication(page, submission.id, pubId);
			expect(pub.updateType).toBe(UPDATE_TYPE_CORRECTION);
			expect(pub.summaryOfChanges?.en ?? '').toContain(tag);
		},
	);

	// Canonical scenario 4 — Update Type across versions. v1 publishes with the
	// default New Version; Create New Version → on v2 the Publication Settings
	// (Issue-entry) form's Update Type select is set to Correction + a summary and
	// saved. v2 carries Correction while v1 stays New Version — the amendment is
	// per-version (versioning copies then diverges).
	test(
		'update type across versions: default New Version -> Correction on v2',
		{tag: ['@smoke', '@regression']},
		async ({page, pkpApi}) => {
			test.slow();
			const tag = uniqueTag();
			const {submission, publications} = await pkpApi.createSubmission(
				publishedVorSpec({tag, title: `Across versions ${tag}`}),
			);
			const v1Id = publications[0].id;
			expect(publications[0].status).toBe(PUB_STATUS_PUBLISHED);
			// v1 defaults to New Version.
			expect((await fetchPublication(page, submission.id, v1Id)).updateType).toBe(
				UPDATE_TYPE_NEW_VERSION,
			);

			// Create a new VoR minor version off the published v1.
			await openTitleAbstract(page, submission.id, v1Id);
			await createNewVersion(page, {versionStage: 'VoR', versionIsMinor: 'true'});
			await expect
				.poll(async () => (await fetchPublications(page, submission.id)).length, {
					timeout: 20_000,
				})
				.toBe(2);
			const v2 = (await fetchPublications(page, submission.id)).find(
				(p) => p.id !== v1Id,
			);
			expect(v2.status).toBe(PUB_STATUS_QUEUED);

			// On v2's Publication Settings tab, set Update Type = Correction + summary.
			await openIssueTab(page, submission.id, v2.id);
			await page
				.locator('#issueEntry-updateType-control')
				.selectOption(UPDATE_TYPE_CORRECTION);
			const summaryHtml = `<p>Corrected author affiliations ${tag}</p>`;
			const editorId = await resolveEditorId(page, 'summaryOfChanges', {locale: 'en'});
			await setTinyMceContent(page, editorId, summaryHtml);
			// A placement-free save: satisfy the mandatory issue radio (rule 10).
			await assignmentRadio(page, ASSIGN_NONE).check();

			const saveRes = await saveIssueForm(page, v2.id);
			expect(saveRes.status(), await saveRes.text()).toBe(200);

			// v2 carries Correction + the summary; v1 stays New Version (untouched).
			await expect
				.poll(
					async () => (await fetchPublication(page, submission.id, v2.id)).updateType,
					{timeout: 20_000},
				)
				.toBe(UPDATE_TYPE_CORRECTION);
			const v2After = await fetchPublication(page, submission.id, v2.id);
			expect(v2After.summaryOfChanges?.en ?? '').toContain(tag);
			expect((await fetchPublication(page, submission.id, v1Id)).updateType).toBe(
				UPDATE_TYPE_NEW_VERSION,
			);
		},
	);

	// Canonical scenarios 2 + 6 (MERGED) — the editor inserts a revision's summary
	// into the public notice. On the Publication Settings Summary of Changes field
	// the "Insert Content" button appears (submission/primary locale only); the
	// side modal lists the review-revision file; selecting it APPENDS the file's
	// original HTML into the English value. The single-value file summary maps to
	// ONE publication locale — the French value stays empty (no cross-locale
	// autofill).
	test(
		"editor inserts a revision's summary into the public notice (primary locale only)",
		{tag: ['@smoke', '@regression']},
		async ({page, pkpApi}) => {
			test.slow();
			const tag = uniqueTag();
			const {submission} = await pkpApi.createSubmission(
				inReviewSpec({tag, title: `Insert content ${tag}`}),
			);
			const pubId = await currentPublicationId(page, submission.id);
			const reviewRoundId = (await fetchSubmission(page, submission.id))
				.reviewRounds.slice(-1)[0].id;
			const genreId = await articleGenreId(page, submission.id);

			// Seed a review-revision file carrying a single-value summary (the shape
			// the author-upload wizard writes) directly through the files API.
			await page.goto('/index.php/publicknowledge/en/dashboard/editorial', {
				waitUntil: 'commit',
			});
			const csrf = await getCsrf(page);
			const summaryText = `Figure 2 was corrected ${tag}`;
			const fileRes = await createReviewRevisionFile(page, {
				submissionId: submission.id,
				reviewRoundId,
				genreId,
				name: `Revision ${tag}`,
				summaryOfChanges: `<p><strong>${summaryText}</strong></p>`,
				csrf,
			});
			expect(fileRes.status(), await fileRes.text()).toBe(200);

			// Open the Publication Settings tab and locate the primary-locale
			// Summary of Changes editor — its toolbar carries "Insert Content".
			await openIssueTab(page, submission.id, pubId);
			const editorId = await resolveEditorId(page, 'summaryOfChanges', {locale: 'en'});
			const insertButton = page.getByRole('button', {
				name: INSERT_CONTENT,
				exact: true,
			});
			await expect(insertButton).toBeVisible({timeout: 20_000});
			await insertButton.click();

			// The modal lists the seeded revision (plain-text preview); insert it.
			const insertModal = page
				.locator('[data-cy="active-modal"]')
				.filter({hasText: summaryText});
			await expect(insertModal.getByText(summaryText)).toBeVisible({
				timeout: 20_000,
			});
			await insertModal.getByRole('button', {name: INSERT, exact: true}).click();

			// The English editor now holds the file's original HTML (markup preserved).
			await expect
				.poll(async () => getTinyMceContent(page, editorId), {timeout: 20_000})
				.toContain(summaryText);
			expect(await getTinyMceContent(page, editorId)).toContain('<strong>');

			// Persist it (placement-free save; satisfy the mandatory issue radio).
			await assignmentRadio(page, ASSIGN_NONE).check();
			const saveRes = await saveIssueForm(page, pubId);
			expect(saveRes.status(), await saveRes.text()).toBe(200);

			// Server truth: the English notice holds the inserted content; the French
			// value stays empty (the single-value file summary maps to one locale).
			const pub = await fetchPublication(page, submission.id, pubId);
			expect(pub.summaryOfChanges?.en ?? '').toContain(summaryText);
			expect(pub.summaryOfChanges?.fr_CA ?? '').toBe('');
		},
	);

	// Canonical scenario 5 — Insert-modal empty state; manual entry still works.
	// On a submission with no review-revision summaries, the Insert Content modal
	// shows its empty-state message; the editor closes it, types a notice by hand,
	// and it saves.
	test(
		'insert-modal empty state; manual entry still saves',
		{tag: '@regression'},
		async ({page, pkpApi}) => {
			test.slow();
			const tag = uniqueTag();
			const {submission} = await pkpApi.createSubmission(
				submittedSpec({tag, title: `Empty insert ${tag}`}),
			);
			const pubId = await currentPublicationId(page, submission.id);

			await openIssueTab(page, submission.id, pubId);
			const editorId = await resolveEditorId(page, 'summaryOfChanges', {locale: 'en'});

			// Insert Content → the empty-state message (no review-revision summaries).
			const insertButton = page.getByRole('button', {
				name: INSERT_CONTENT,
				exact: true,
			});
			await expect(insertButton).toBeVisible({timeout: 20_000});
			await insertButton.click();
			const insertModal = page
				.locator('[data-cy="active-modal"]')
				.filter({hasText: INSERT_EMPTY});
			await expect(insertModal.getByText(INSERT_EMPTY)).toBeVisible({
				timeout: 20_000,
			});

			// Close the modal and type the notice by hand.
			await insertModal
				.getByRole('button', {name: 'Close', exact: true})
				.first()
				.click();
			await expect(page.getByText(INSERT_EMPTY)).toHaveCount(0, {timeout: 15_000});

			const manual = `Manually authored amendment notice ${tag}`;
			await setTinyMceContent(page, editorId, `<p>${manual}</p>`);
			await assignmentRadio(page, ASSIGN_NONE).check();
			const saveRes = await saveIssueForm(page, pubId);
			expect(saveRes.status(), await saveRes.text()).toBe(200);

			// Server truth: the manually-typed notice persisted.
			const pub = await fetchPublication(page, submission.id, pubId);
			expect(pub.summaryOfChanges?.en ?? '').toContain(manual);
		},
	);

	// Canonical scenario 7 — permission boundary. On a published submission an
	// editor may still edit the amendment fields (warn-not-lock) but the AUTHOR is
	// hard-locked (PUT refused; no Publication Settings tab). A recommend-only
	// editor cannot change them either (PUT refused). And the reader sees NEITHER
	// the notice NOR the update type — the ⚠ rule-9 reader gap, asserted as
	// ABSENCE on the live published article page.
	test(
		'permission boundary: author locked, recommend-only view-only, reader sees no notice',
		{tag: ['@smoke', '@regression']},
		async ({page, pkpApi, asUser, browser, baseURL}) => {
			test.slow(); // multiple actors + reader context
			const tag = uniqueTag();

			// A published submission (atester author, dbarnes managing editor).
			const {submission, publications} = await pkpApi.createSubmission(
				publishedVorSpec({tag, title: `Locked amendment ${tag}`}),
			);
			const pubId = publications[0].id;
			expect(publications[0].status).toBe(PUB_STATUS_PUBLISHED);

			// A separate NON-published submission with a view-only section editor —
			// isolates this gate from the published-lock. NOTE (spec deviation, see
			// return): `recommendOnly` alone does NOT block amendment editing — the
			// gate is `canChangeMetadata` (canEditPublication), which defaults TRUE
			// for a section editor's user group (permitMetadataEdit). So a
			// recommend-only editor who KEEPS metadata-edit permission can edit the
			// update type/summary (200). To model the spec's "view only" editor we
			// pin canChangeMetadata:false — that is the real refusal gate.
			const {submission: recSub} = await pkpApi.createSubmission(
				submittedSpec({
					tag: `${tag}r`,
					title: `Recommend-only amendment ${tag}`,
					participants: [
						{user: 'dbarnes', role: 'editor'},
						{
							user: 'minoue',
							role: 'sectionEditor',
							recommendOnly: true,
							canChangeMetadata: false,
						},
					],
				}),
			);
			const recPubId = await currentPublicationId(page, recSub.id);

			// --- Editor (dbarnes, manager): warn-not-lock — the amendment edit
			// persists on the PUBLISHED publication. Seed a distinctive notice +
			// Correction so the reader-absence check has something to look for.
			await page.goto('/index.php/publicknowledge/en/dashboard/editorial', {
				waitUntil: 'commit',
			});
			const csrf = await getCsrf(page);
			const noticeText = `Retraction notice body ${tag}`;
			const editorPut = await putPublication(
				page,
				submission.id,
				pubId,
				{
					updateType: UPDATE_TYPE_CORRECTION,
					summaryOfChanges: {en: `<p>${noticeText}</p>`},
				},
				csrf,
			);
			expect(editorPut.status(), await editorPut.text()).toBe(200);
			const editedPub = await fetchPublication(page, submission.id, pubId);
			expect(editedPub.updateType).toBe(UPDATE_TYPE_CORRECTION);
			expect(editedPub.summaryOfChanges?.en ?? '').toContain(noticeText);

			// --- Author (atester): published-lock — the amendment PUT is refused…
			const authorCtx = await asUser('atester');
			const authorCsrfPage = await authorCtx.newPage();
			await authorCsrfPage.goto(
				'/index.php/publicknowledge/en/dashboard/mySubmissions',
				{waitUntil: 'commit'},
			);
			const authorCsrf = await getCsrf(authorCsrfPage);
			const authorPut = await putPublication(
				authorCtx,
				submission.id,
				pubId,
				{updateType: UPDATE_TYPE_CORRECTION},
				authorCsrf,
			);
			expect([401, 403]).toContain(authorPut.status());

			// …and the author's Publication menu has no "Publication Settings" item
			// (the Issue-entry surface where the amendment fields live).
			const authorPage = await authorCtx.newPage();
			await authorPage.goto(
				pubLink(submission.id, pubId, 'titleAbstract', {author: true}),
				{waitUntil: 'commit'},
			);
			const authorNav = workflowModal(authorPage).locator('nav');
			await expect(
				authorNav.getByText('Title & Abstract', {exact: true}).first(),
			).toBeVisible({timeout: 20_000});
			await expect(
				authorNav.getByText('Publication Settings', {exact: true}),
			).toHaveCount(0);

			// --- View-only (recommend-only, no metadata edit) editor (minoue):
			// cannot change the amendment fields (canChangeMetadata=false; not a
			// manager) — PUT refused even on the non-published submission.
			const recCtx = await asUser('minoue');
			const recCsrfPage = await recCtx.newPage();
			await recCsrfPage.goto(
				'/index.php/publicknowledge/en/dashboard/editorial',
				{waitUntil: 'commit'},
			);
			const recCsrf = await getCsrf(recCsrfPage);
			const recPut = await putPublication(
				recCtx,
				recSub.id,
				recPubId,
				{updateType: UPDATE_TYPE_CORRECTION},
				recCsrf,
			);
			expect([401, 403]).toContain(recPut.status());

			// --- Reader (anonymous): sees NEITHER the amendment notice NOR the
			// update type — nothing renders it in 3.6 (rule 9 ⚠).
			const anon = await browser.newContext({
				baseURL,
				storageState: {cookies: [], origins: []},
			});
			try {
				const reader = await anon.newPage();
				const article = new ArticlePage(reader);
				const resp = await article.goto(submission.id, {locale: 'en'});
				expect(resp?.status(), 'published article reachable').toBeLessThan(400);
				// The article itself is served (author present, no locale/version notice).
				await expect(reader.getByText(AUTHOR_NAME).first()).toBeVisible({
					timeout: 20_000,
				});
				// …but the amendment notice text and the update-type surface are ABSENT.
				await expect(reader.getByText(noticeText)).toHaveCount(0);
				await expect(reader.getByText(AMENDMENT_BADGE)).toHaveCount(0);
				await expect(reader.getByText(UPDATE_TYPE_LABEL, {exact: true})).toHaveCount(0);
			} finally {
				await anon.close();
			}
		},
	);
});
