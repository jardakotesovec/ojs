// @ts-check
const path = require('path');
const os = require('os');
const fs = require('fs');
const {test, expect} = require('../support/fixtures.js');
const {EditorialWorkflowPage} = require('../pages/EditorialWorkflowPage.js');
const {
	DiscussionManagerPage,
} = require('../../lib/pkp/playwright/pages/DiscussionManagerPage.js');
const {
	FileStagePanel,
	fixtureFilePath,
} = require('../../lib/pkp/playwright/pages/FileStagePanel.js');
const {
	waitForJQueryIdle,
} = require('../../lib/pkp/playwright/support/jquery.js');

/**
 * Submission files — the cross-stage file-management MECHANICS. One test per
 * canonical scenario of docs/product/specs/submission-files.md (10 scenarios
 * → 10 tests). This spec owns the Vue FileManager + the legacy upload wizard,
 * revisions, dependent files, downloads, delete, edit-metadata, the file
 * attacher, and the author/reviewer file boundaries.
 *
 * THE distinctive job of this spec (per the task brief): the spec author
 * could NOT browser-render the FileManager (a login block) and left the
 * rendered-control affordances CODE-DERIVED. These tests are the LIVE browser
 * verification the spec asked for — the upload wizard, the revision flow, the
 * dependent-files sub-grid, download-all, the non-ASCII round-trip, delete
 * cascade, edit-metadata, and the FileAttacher are all DRIVEN in a real
 * browser, and asserted against BOTH the rendered FileManager UI AND the
 * files REST API / DB state.
 *
 * Panel of choice: the stage-1 SUBMISSION_FILES panel ("Submission Files").
 * It grants editorial roles the full mechanic set (Upload, Download-All,
 * Edit, Delete, Notes) with a DIRECT "Upload" button, and every seeded
 * submission arrives carrying a real Article Text file at that stage — so one
 * cheap stage-1 seed gives every mechanic a live surface + a pre-existing file
 * to revise/edit/delete/download. (useFileManagerConfig SUBMISSION_FILES.)
 *
 * Scope discipline (don't duplicate sibling coverage):
 *   - Per-stage panel COMPOSITION (which panels a stage shows, the promote
 *     sources) is send-to-review / copyediting-stage / production-stage turf.
 *   - The author's Review-Revision UPLOAD cycle + round-status effects are
 *     review-rounds-and-revisions turf (author uploadRevision live there);
 *     this spec asserts the author's Submission-Files boundary + notes the
 *     Review-Revision write grants are exercised by that sibling.
 *   - Discussion/email DELIVERY of an attached file is tasks-discussions /
 *     email-delivery turf; this spec drives the FileAttacher only far enough
 *     to pin the file onto the composer (the submission-files slice).
 *
 * Known ⚠ respected (spec Known deviations): a file-metadata EDIT is logged
 * against the file's Information Center but NOT the submission Activity Log
 * (Repository::edit() builds but never persists the submission-level entry).
 * Test 7 asserts the edit appears in the file's Information Center — it does
 * NOT assert it in the Activity Log.
 *
 * Parallel-safety: tags are single hyphenless alphanumeric tokens; every
 * submission is per-test and opened by the id the scenario API returns; the
 * non-ASCII fixture is written to a per-tag temp dir; no Mailpit / clearAll.
 */

// Workflow stage / file-stage constants.
const STAGE_SUBMISSION = 1; // WORKFLOW_STAGE_ID_SUBMISSION
const FILE_STAGE_SUBMISSION = 2; // SubmissionFile::SUBMISSION_FILE_SUBMISSION

// SUBMISSION_FILES panel copy (useFileManagerConfig titleKey/wizardTitleKey).
const PANEL_SUBMISSION_FILES = 'Submission Files';
const WIZARD_SUBMISSION_FILE = 'Upload Submission File';
const WIZARD_DEPENDENT_FILE = 'Upload a Dependent File';

// The seeded Article Text file every scenario submission carries.
const SEEDED_FILE = 'default-article.pdf';

const USER = {
	dbarnes: {name: 'Daniel Barnes', email: 'dbarnes@mailinator.com'},
	atester: {name: 'Author Tester', email: 'atester@mailinator.com'},
	jjanssen: {name: 'Julie Janssen', email: 'jjanssen@mailinator.com'},
};

/** A unique, hyphenless, alphanumeric tag (parallel isolation). */
function uniqueTag() {
	const workerLetter = String.fromCharCode(97 + (test.info().parallelIndex % 26));
	let suffix = '';
	while (suffix.length < 6) {
		suffix += Math.random().toString(36).replace(/[^a-z0-9]/g, '');
	}
	return `sf${workerLetter}${suffix.slice(0, 6)}`;
}

/**
 * A submitted, stage-1 (Queued) submission on publicknowledge, carrying the
 * standard seeded Article Text file at the Submission file stage. dbarnes
 * (the `editor` group = manager scope) is the deciding editor; atester the
 * author.
 *
 * @param {{tag: string, title: string, participants?: object[]}} opts
 */
function submittedSpec({tag, title, participants = [{user: 'dbarnes', role: 'editor'}]}) {
	return {
		tag,
		journal: 'publicknowledge',
		submitter: 'atester',
		section: 'ART',
		locale: 'en',
		submitted: true,
		participants,
		publications: [{metadata: {title: {en: title}}}],
	};
}

/**
 * A submitted submission sent to external review, with an invited reviewer
 * (jjanssen) on round 1 — for the reviewer file-endpoint boundary.
 *
 * @param {{tag: string, title: string}} opts
 */
function inReviewSpec({tag, title}) {
	return {
		tag,
		journal: 'publicknowledge',
		submitter: 'atester',
		section: 'ART',
		locale: 'en',
		participants: [{user: 'dbarnes', role: 'editor'}],
		decisions: [{type: 'sendExternalReview', by: 'dbarnes'}],
		reviewRounds: [
			{reviewers: [{user: 'jjanssen', method: 'anonymous', status: 'invited'}]},
		],
		publications: [{metadata: {title: {en: title}}}],
	};
}

/** The author's My-Submissions deep link that mounts the workflow modal. */
function mySubmissionsLink(submissionId, journalPath = 'publicknowledge') {
	return `/index.php/${journalPath}/en/dashboard/mySubmissions?workflowSubmissionId=${submissionId}`;
}

/** Localize a schema `name` (string or locale map) to a plain string. */
function nameOf(item) {
	const n = item.name;
	if (typeof n === 'string') return n;
	return n?.en ?? Object.values(n || {})[0] ?? '';
}

/**
 * GET a submission's files at the given file stages through a request
 * context (throws on non-2xx). Returns the `items` array.
 *
 * @param {import('@playwright/test').APIRequestContext} request
 * @param {number} submissionId
 * @param {number[]} [fileStages]
 */
async function getFiles(request, submissionId, fileStages = [FILE_STAGE_SUBMISSION]) {
	const qs = fileStages.map((s) => `fileStages[]=${s}`).join('&');
	const res = await request.get(
		`/index.php/publicknowledge/api/v1/submissions/${submissionId}/files?${qs}`,
	);
	if (!res.ok()) {
		throw new Error(`GET files failed: ${res.status()} ${await res.text()}`);
	}
	return (await res.json()).items || [];
}

/**
 * The single-file GET response (full props incl. `revisions` +
 * `dependentFiles`, unlike the summarized list). The endpoint requires the
 * WORKFLOW `stageId` query param (a Submission-stage file → stage 1) or the
 * access policy 401s. Returns the raw APIResponse so callers can inspect
 * status (e.g. a post-delete 4xx).
 *
 * @param {import('@playwright/test').APIRequestContext} request
 * @param {number} submissionId
 * @param {number} fileId
 * @param {number} [stageId]
 */
function getFileResponse(request, submissionId, fileId, stageId = STAGE_SUBMISSION) {
	return request.get(
		`/index.php/publicknowledge/api/v1/submissions/${submissionId}/files/${fileId}?stageId=${stageId}`,
	);
}

/**
 * Add a dependent file to a parent through the legacy Dependent Files
 * sub-grid inside the "Edit a file" metadata modal (surfaced only for
 * html/xml parents — Repo::supportsDependentFiles). Leaves the edit modal
 * OPEN; the caller decides whether to close it.
 *
 * @param {FileStagePanel} panel
 * @param {import('@playwright/test').Page} page
 * @param {string} parentName  file name of the (html) parent row
 * @param {{filePath: string, displayName: string, genreLabel?: string}} opts
 * @returns {Promise<import('@playwright/test').Locator>} the open edit modal
 */
async function addDependentFile(panel, page, parentName, {filePath, displayName, genreLabel = 'Image'}) {
	const modal = await panel.openEditModal(parentName);
	// The Dependent Files grid loads via load_url_in_div (legacy jQuery).
	const grid = modal.locator('#dependentFilesGridDiv');
	await expect(grid).toBeVisible({timeout: 15_000});
	await waitForJQueryIdle(page);
	// The grid's add-file action is a linkAction labelled "Upload File".
	await grid.getByRole('link', {name: 'Upload File', exact: true}).click();
	const wizard = page
		.getByRole('dialog', {name: WIZARD_DEPENDENT_FILE})
		.first();
	await expect(wizard).toBeVisible({timeout: 15_000});
	// Same 3-step wizard; the genre dropdown here lists only dependent
	// genres (Multimedia / Image / HTML Stylesheet).
	await panel.driveUploadWizard(wizard, {filePath, genreLabel, displayName});
	// The grid refetches and shows the new dependent row.
	await expect(grid.getByText(displayName)).toBeVisible({timeout: 15_000});
	return modal;
}

test.use({user: 'dbarnes'}); // the editor with manager scope (full mechanics)

test.describe('Submission files — the cross-stage file mechanics', () => {
	// Canonical scenario 1 — an editor opens the Submission Files panel,
	// clicks Upload, drops a document, picks its Type (Article Text), advances
	// through the metadata step and confirms; the new file lands in the list
	// with its name + genre, is present in the files API, and a File-uploaded
	// event is recorded in the file's Information Center history.
	test(
		'upload a file through the wizard',
		{tag: ['@smoke', '@regression']},
		async ({page, pkpApi}) => {
			test.slow(); // a full 3-step legacy upload wizard drive
			const tag = uniqueTag();
			const {submission} = await pkpApi.createSubmission(
				submittedSpec({tag, title: `Upload wizard ${tag}`}),
			);

			const workflow = new EditorialWorkflowPage(page);
			await workflow.goto(submission.id);
			await expect(
				workflow.workflowModal().getByRole('heading', {
					name: 'Workflow: Submission',
				}),
			).toBeVisible({timeout: 20_000});

			const panel = new FileStagePanel(page, PANEL_SUBMISSION_FILES);
			await panel.expectVisible();

			const displayName = `wizard-${tag}.pdf`;
			const wizard = await panel.openDirectUploadWizard(WIZARD_SUBMISSION_FILE);
			await panel.driveUploadWizard(wizard, {
				filePath: fixtureFilePath('dummy.pdf'),
				genreLabel: 'Article Text',
				displayName,
			});

			// Rendered FileManager: the new row shows with its Article-Text genre.
			const row = panel.row(displayName);
			await expect(row).toBeVisible({timeout: 20_000});
			await expect(row.getByText('Article Text')).toBeVisible();

			// API/DB truth: a second Submission-stage file now exists with the
			// chosen display name (alongside the seeded one).
			const files = await getFiles(page.request, submission.id);
			const uploaded = files.find((f) => nameOf(f) === displayName);
			expect(uploaded).toBeTruthy();
			expect(files.length).toBe(2); // seeded + this upload

			// Side effect: a File-uploaded event is in the file's Information
			// Center history (spec Side effects / scenario 1).
			const info = await panel.openInformationCenter(displayName);
			await info.getByRole('link', {name: 'History', exact: true}).click();
			await waitForJQueryIdle(page);
			await expect(info.getByText(/uploaded/i).first()).toBeVisible({
				timeout: 15_000,
			});
		},
	);

	// Canonical scenario 2 — a user uploads a new version and marks it "a
	// revision of an existing file": the same file row keeps its place, its
	// content (physical fileId) is replaced, and its revision history gains a
	// version — no second row appears.
	test(
		'upload a revision of an existing file',
		{tag: '@regression'},
		async ({page, pkpApi}) => {
			test.slow();
			const tag = uniqueTag();
			const {submission} = await pkpApi.createSubmission(
				submittedSpec({tag, title: `Revision ${tag}`}),
			);

			// Pre-state: exactly one Submission file. Capture its physical
			// fileId + version-history length (revisions is a full-prop, so read
			// it from the single-file GET).
			const before = await getFiles(page.request, submission.id);
			expect(before).toHaveLength(1);
			const fileId0 = before[0].id;
			const fullBefore = await (
				await getFileResponse(page.request, submission.id, fileId0)
			).json();
			const physicalBefore = fullBefore.fileId;
			const revisionsBefore = fullBefore.revisions.length;

			const workflow = new EditorialWorkflowPage(page);
			await workflow.goto(submission.id);
			const panel = new FileStagePanel(page, PANEL_SUBMISSION_FILES);
			await panel.expectVisible();

			// Upload a revision OF the seeded file (revisedFileId select in the
			// wizard's first step; genre is inherited, no new row).
			const wizard = await panel.openDirectUploadWizard(WIZARD_SUBMISSION_FILE);
			await panel.driveUploadWizard(wizard, {
				filePath: fixtureFilePath('dummy.pdf'),
				reviseFileName: SEEDED_FILE,
			});

			// Rendered FileManager: still the SAME single row (no second row).
			await expect(panel.row(SEEDED_FILE)).toBeVisible({timeout: 20_000});

			// API/DB truth: still one row (no second file); same file id, a NEW
			// physical fileId, and the version history gained a revision —
			// content replaced in place, version list appended.
			const after = await getFiles(page.request, submission.id);
			expect(after).toHaveLength(1);
			expect(after[0].id).toBe(fileId0);
			const fullAfter = await (
				await getFileResponse(page.request, submission.id, fileId0)
			).json();
			expect(fullAfter.fileId).not.toBe(physicalBefore);
			expect(fullAfter.revisions.length).toBeGreaterThan(revisionsBefore);
		},
	);

	// Canonical scenario 3 — an editor uploads an HTML manuscript, then adds an
	// image as a DEPENDENT of it via the parent's Dependent Files sub-grid; the
	// image is not a top-level stage file (it never appears in the panel or the
	// files list) but travels with the manuscript in its `dependentFiles`.
	test(
		'add a dependent file to a manuscript',
		{tag: '@regression'},
		async ({page, pkpApi}) => {
			test.slow(); // an html upload + a nested dependent-file wizard
			const tag = uniqueTag();
			const {submission} = await pkpApi.createSubmission(
				submittedSpec({tag, title: `Dependent ${tag}`}),
			);

			const workflow = new EditorialWorkflowPage(page);
			await workflow.goto(submission.id);
			const panel = new FileStagePanel(page, PANEL_SUBMISSION_FILES);
			await panel.expectVisible();

			// Upload the HTML manuscript (text/html → supportsDependentFiles).
			const parentName = `manuscript-${tag}.html`;
			const parentWizard = await panel.openDirectUploadWizard(
				WIZARD_SUBMISSION_FILE,
			);
			await panel.driveUploadWizard(parentWizard, {
				filePath: fixtureFilePath('sample-article.html'),
				genreLabel: 'Article Text',
				displayName: parentName,
			});
			await expect(panel.row(parentName)).toBeVisible({timeout: 20_000});

			const parentId = (await getFiles(page.request, submission.id)).find(
				(f) => nameOf(f) === parentName,
			).id;

			// Add an Image dependent through the parent's Dependent Files grid.
			const depName = `dep-${tag}.png`;
			await addDependentFile(panel, page, parentName, {
				filePath: fixtureFilePath('dependent-image.png'),
				displayName: depName,
				genreLabel: 'Image',
			});

			// API/DB truth: the image is projected under the parent's
			// dependentFiles, NOT as a top-level stage file.
			const parentRes = await getFileResponse(
				page.request,
				submission.id,
				parentId,
			);
			expect(parentRes.ok()).toBeTruthy();
			const parent = await parentRes.json();
			expect(parent.dependentFiles.length).toBeGreaterThan(0);
			expect(parent.dependentFiles.some((d) => nameOf(d) === depName)).toBe(
				true,
			);

			// The dependent is NOT listed at the Submission stage.
			const topLevel = await getFiles(page.request, submission.id);
			expect(topLevel.some((f) => nameOf(f) === depName)).toBe(false);
		},
	);

	// Canonical scenario 4 — with a file in the panel, Download All Files
	// streams an archive of that stage's files; each row also exposes a single
	// download link.
	test(
		'download all files as an archive; each row offers a single download',
		{tag: '@regression'},
		async ({page, pkpApi}) => {
			const tag = uniqueTag();
			const {submission} = await pkpApi.createSubmission(
				submittedSpec({tag, title: `Download ${tag}`}),
			);

			const workflow = new EditorialWorkflowPage(page);
			await workflow.goto(submission.id);
			const panel = new FileStagePanel(page, PANEL_SUBMISSION_FILES);
			await panel.expectVisible();

			// Each row offers a single download (an <a href> to the file url).
			await expect(panel.fileLink(SEEDED_FILE)).toHaveAttribute(
				'href',
				/downloadFile|submissionFileId|api\/file/i,
			);

			// Download All streams a .zip (or .tar.gz where zip is unavailable).
			const download = await panel.downloadAll();
			expect(download.suggestedFilename()).toMatch(/\.(zip|tar\.gz)$/);
		},
	);

	// Canonical scenario 5 — an author uploads a file whose name carries
	// Unicode + punctuation; the exact name round-trips through the list and
	// the API, the genre sticks, and the single-file download re-attaches the
	// decodable UTF-8 filename via the RFC 5987 Content-Disposition header.
	test(
		'a non-ASCII filename round-trips through list, API and download header',
		{tag: '@regression'},
		async ({page, pkpApi}) => {
			test.slow();
			const tag = uniqueTag();
			const {submission} = await pkpApi.createSubmission(
				submittedSpec({tag, title: `Unicode ${tag}`}),
			);

			// Write the fixture under a per-tag temp dir with the exact Unicode
			// name so the uploaded filename IS the Unicode string.
			const unicodeName = 'Édition £ 丹尼爾 & دانيال.pdf';
			const dir = fs.mkdtempSync(path.join(os.tmpdir(), `sf-${tag}-`));
			const unicodePath = path.join(dir, unicodeName);
			fs.copyFileSync(fixtureFilePath('dummy.pdf'), unicodePath);

			// The seeded file's genre — to prove the uploaded file's genre sticks.
			const seededGenre = (await getFiles(page.request, submission.id))[0]
				.genreId;

			const workflow = new EditorialWorkflowPage(page);
			await workflow.goto(submission.id);
			const panel = new FileStagePanel(page, PANEL_SUBMISSION_FILES);
			await panel.expectVisible();

			// Upload WITHOUT overriding the name → the display name defaults to
			// the Unicode filename.
			const wizard = await panel.openDirectUploadWizard(WIZARD_SUBMISSION_FILE);
			await panel.driveUploadWizard(wizard, {
				filePath: unicodePath,
				genreLabel: 'Article Text',
			});

			// Rendered FileManager: the exact Unicode name shows in the list.
			await expect(
				panel.table.getByRole('row').filter({hasText: '丹尼爾'}),
			).toBeVisible({timeout: 20_000});

			// API: the name is stored verbatim and the genre stuck.
			const files = await getFiles(page.request, submission.id);
			const uploaded = files.find((f) => nameOf(f).includes('丹尼爾'));
			expect(uploaded).toBeTruthy();
			expect(nameOf(uploaded)).toBe(unicodeName);
			expect(uploaded.genreId).toBe(seededGenre);

			// Download header: RFC 5987 filename* carries the decodable UTF-8 name.
			const dl = await page.request.get(uploaded.url);
			expect(dl.ok()).toBeTruthy();
			const disposition = dl.headers()['content-disposition'] || '';
			expect(disposition).toContain("filename*=UTF-8''");
			const encoded = disposition
				.split("filename*=UTF-8''")[1]
				.split(';')[0]
				.trim();
			const decoded = decodeURIComponent(encoded.replace(/\+/g, '%20'));
			expect(decoded).toContain('丹尼爾');
			expect(decoded).toContain('Édition');
		},
	);

	// Canonical scenario 6 — an editor deletes a file via the row menu and
	// confirms; the file (and its dependents) is removed. Seeds a parent+image
	// dependent, deletes the parent, and asserts BOTH are gone (cascade).
	test(
		'delete a file cascades to its dependents',
		{tag: '@regression'},
		async ({page, pkpApi}) => {
			test.slow(); // html upload + dependent + delete
			const tag = uniqueTag();
			const {submission} = await pkpApi.createSubmission(
				submittedSpec({tag, title: `Delete cascade ${tag}`}),
			);

			const workflow = new EditorialWorkflowPage(page);
			await workflow.goto(submission.id);
			const panel = new FileStagePanel(page, PANEL_SUBMISSION_FILES);
			await panel.expectVisible();

			// Parent HTML + an image dependent.
			const parentName = `parent-${tag}.html`;
			const parentWizard = await panel.openDirectUploadWizard(
				WIZARD_SUBMISSION_FILE,
			);
			await panel.driveUploadWizard(parentWizard, {
				filePath: fixtureFilePath('sample-article.html'),
				genreLabel: 'Article Text',
				displayName: parentName,
			});
			await expect(panel.row(parentName)).toBeVisible({timeout: 20_000});
			const parentId = (await getFiles(page.request, submission.id)).find(
				(f) => nameOf(f) === parentName,
			).id;

			await addDependentFile(panel, page, parentName, {
				filePath: fixtureFilePath('dependent-image.png'),
				displayName: `dep-${tag}.png`,
				genreLabel: 'Image',
			});
			// The dependent's own file id, for the cascade check.
			const parentBefore = await (
				await getFileResponse(page.request, submission.id, parentId)
			).json();
			const dependentId = parentBefore.dependentFiles[0].id;

			// Close the edit modal, then delete the parent from the row menu.
			await page.keyboard.press('Escape');
			await expect(
				page.getByRole('dialog', {name: 'Edit a file'}),
			).toBeHidden({timeout: 15_000});

			await panel.deleteFile(parentName);

			// Rendered FileManager: the parent row is gone; the seeded file stays.
			await expect(panel.row(parentName)).toHaveCount(0);
			await expect(panel.row(SEEDED_FILE)).toBeVisible();

			// API/DB truth: the parent AND its dependent are gone (cascade); the
			// seeded file survives. (A missing file no longer resolves through
			// the access policy — a 4xx, not a 200.)
			const parentAfter = await getFileResponse(
				page.request,
				submission.id,
				parentId,
			);
			expect(parentAfter.ok()).toBeFalsy();
			const depAfter = await getFileResponse(
				page.request,
				submission.id,
				dependentId,
			);
			expect(depAfter.ok()).toBeFalsy();
			const remaining = await getFiles(page.request, submission.id);
			expect(remaining.some((f) => nameOf(f) === SEEDED_FILE)).toBe(true);
		},
	);

	// Canonical scenario 7 — a user opens Update File Details, renames the file
	// and saves; the list reflects the new name and the API persists it. The
	// edit is recorded in the file's Information Center history — but (⚠ Known
	// deviation) NOT in the submission Activity Log, so we assert only the
	// Information Center, per the spec.
	test(
		'edit a file’s metadata (Update File)',
		{tag: '@regression'},
		async ({page, pkpApi}) => {
			test.slow();
			const tag = uniqueTag();
			const {submission} = await pkpApi.createSubmission(
				submittedSpec({tag, title: `Edit metadata ${tag}`}),
			);

			const workflow = new EditorialWorkflowPage(page);
			await workflow.goto(submission.id);
			const panel = new FileStagePanel(page, PANEL_SUBMISSION_FILES);
			await panel.expectVisible();

			const newName = `Renamed ${tag}.pdf`;
			const modal = await panel.openEditModal(SEEDED_FILE);
			const nameInput = panel.editModalNameInput(modal);
			await nameInput.fill(newName);
			await panel.saveEditModal(modal);

			// Rendered FileManager: the row now shows the new name.
			await expect(panel.row(newName)).toBeVisible({timeout: 20_000});
			await expect(panel.row(SEEDED_FILE)).toHaveCount(0);

			// API/DB truth: the persisted name changed.
			const files = await getFiles(page.request, submission.id);
			expect(files).toHaveLength(1);
			expect(nameOf(files[0])).toBe(newName);

			// ⚠ The edit is in the FILE's Information Center history (the
			// submission Activity Log is not asserted — the submission-level
			// entry is built but never persisted).
			const info = await panel.openInformationCenter(newName);
			await info.getByRole('link', {name: 'History', exact: true}).click();
			await waitForJQueryIdle(page);
			await expect(info.getByText(/was edited/i).first()).toBeVisible({
				timeout: 15_000,
			});
		},
	);

	// Canonical scenario 8 — composing a discussion, an editor attaches an
	// existing workflow file via the FileAttacher; the file is pinned onto the
	// message. The editorial-only "Attach Workflow Files" source is offered
	// (the permission-gated affordance the spec author could not render).
	test(
		'attach an existing workflow file to a discussion via the file attacher',
		{tag: '@regression'},
		async ({page, pkpApi}) => {
			test.slow(); // nested side-modals: FileAttacher → workflow-stage picker
			const tag = uniqueTag();
			const {submission} = await pkpApi.createSubmission(
				submittedSpec({tag, title: `Attach ${tag}`}),
			);

			const workflow = new EditorialWorkflowPage(page);
			await workflow.goto(submission.id);
			await expect(
				workflow.workflowModal().getByRole('heading', {
					name: 'Workflow: Submission',
				}),
			).toBeVisible({timeout: 20_000});

			// Open a new discussion; its head-message rich-text editor carries
			// the "Attach Files" toolbar button (useDiscussionMessages).
			const dm = new DiscussionManagerPage(page);
			await dm.expectVisible();
			const form = await dm.openAdd();
			await form.fillTitle(`Attach discussion ${tag}`);

			const attachToolbar = page.getByRole('button', {name: 'Attach Files'});
			await expect(attachToolbar).toBeVisible({timeout: 20_000});
			await attachToolbar.click();

			// FileAttacherModal: both the always-present Upload source and the
			// editorial-only "Attach Workflow Files" source are offered.
			const attachWorkflow = page.getByRole('button', {
				name: 'Attach Workflow Files',
				exact: true,
			});
			await expect(attachWorkflow).toBeVisible({timeout: 15_000});
			await expect(
				page.getByRole('button', {name: 'Upload File', exact: true}).first(),
			).toBeVisible();
			await attachWorkflow.click();

			// Workflow-stage picker (AttacherModal). Its outer [data-cy] wrapper
			// reports visibility:hidden, so anchor on the "Attach Selected"
			// button instead, then scope the picker to the modal holding it.
			const attachSelected = page.getByRole('button', {
				name: 'Attach Selected',
				exact: true,
			});
			await expect(attachSelected).toBeVisible({timeout: 15_000});
			const picker = page
				.locator('[data-cy="active-modal"]')
				.filter({has: attachSelected});

			// Choose the Submission stage, tick the seeded file, attach it.
			await picker.locator('select').first().selectOption({label: 'Submission'});
			const fileRow = picker.locator('tr').filter({hasText: SEEDED_FILE});
			await expect(fileRow).toBeVisible({timeout: 15_000});
			await fileRow
				.locator('label:has(input[type="checkbox"])')
				.first()
				.click();
			await expect(attachSelected).toBeEnabled({timeout: 10_000});
			await attachSelected.click();

			// Back on the discussion form: the file is pinned to the message
			// (FileAttacherAttachedFiles renders it as a File + a Remove
			// control). Both attacher modals have closed, so the discussion
			// form is the sole remaining side-modal.
			const composer = page.locator('[data-cy="active-modal"]').first();
			await expect(composer.getByText(SEEDED_FILE)).toBeVisible({
				timeout: 15_000,
			});
			await expect(
				composer.getByRole('button', {name: 'Remove'}).first(),
			).toBeVisible();
		},
	);

	// Canonical scenario 9 — the author's file boundary. On their own
	// submission the author may LIST, DOWNLOAD and EDIT the Submission Files
	// but may NOT add or delete them. (Their upload/edit/delete grants on
	// Review Revisions are exercised live by review-rounds-and-revisions and
	// granted by the WORKFLOW_REVIEW_REVISIONS config — not re-driven here.)
	test(
		'author’s file boundary on Submission Files (list/download/edit, no add/delete)',
		{tag: '@regression'},
		async ({pkpApi, asUser}) => {
			test.slow(); // author actor
			const tag = uniqueTag();
			const {submission} = await pkpApi.createSubmission(
				submittedSpec({tag, title: `Author boundary ${tag}`}),
			);

			const authorCtx = await asUser('atester');
			const authorPage = await authorCtx.newPage();
			await authorPage.goto(mySubmissionsLink(submission.id), {
				waitUntil: 'commit',
			});
			const panel = new FileStagePanel(authorPage, PANEL_SUBMISSION_FILES);
			await panel.expectVisible();

			// May download all + view/download the file…
			await expect(
				panel
					.root()
					.getByRole('button', {name: 'Download All Files', exact: true}),
			).toBeVisible();
			await expect(panel.fileLink(SEEDED_FILE)).toBeVisible();

			// …but no Upload affordance (cannot add after submitting)…
			await expect(
				panel.root().getByRole('button', {name: 'Upload', exact: true}),
			).toHaveCount(0);

			// …the row menu offers Update File Details but NOT Delete.
			await panel.openRowMenu(SEEDED_FILE);
			await expect(
				authorPage.getByRole('menuitem', {
					name: 'Update File Details',
					exact: true,
				}),
			).toBeVisible({timeout: 10_000});
			await expect(
				authorPage.getByRole('menuitem', {name: 'Delete', exact: true}),
			).toHaveCount(0);

			// API/DB truth: the author may LIST their own Submission files.
			const items = await getFiles(authorCtx.request, submission.id);
			expect(items.some((f) => nameOf(f) === SEEDED_FILE)).toBe(true);
		},
	);

	// Canonical scenario 10 — the reviewer boundary. A reviewer never reaches
	// the general file surface: the submission-files endpoint refuses them
	// (REVIEWER is not a route role), while the editor and the author both
	// read it.
	test(
		'the reviewer is denied the general files endpoint',
		{tag: ['@smoke', '@regression']},
		async ({page, pkpApi, asUser}) => {
			test.slow(); // three actors (reviewer / author / editor)
			const tag = uniqueTag();
			const {submission} = await pkpApi.createSubmission(
				inReviewSpec({tag, title: `Reviewer boundary ${tag}`}),
			);
			const filesUrl = `/index.php/publicknowledge/api/v1/submissions/${submission.id}/files`;

			// Reviewer (jjanssen): refused the general files endpoint.
			const reviewerCtx = await asUser('jjanssen');
			const reviewerRes = await reviewerCtx.request.get(filesUrl);
			expect(reviewerRes.ok()).toBeFalsy();
			expect([401, 403]).toContain(reviewerRes.status());

			// Editor (dbarnes, the default page user): reads it.
			const editorRes = await page.request.get(filesUrl);
			expect(editorRes.ok()).toBeTruthy();

			// Author (atester): also reads their own submission's files.
			const authorCtx = await asUser('atester');
			const authorRes = await authorCtx.request.get(filesUrl);
			expect(authorRes.ok()).toBeTruthy();
		},
	);
});
