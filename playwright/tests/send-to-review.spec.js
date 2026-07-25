// @ts-check
const path = require('path');
const fs = require('fs');
const {test, expect} = require('../support/fixtures.js');
const {
	WorkflowShellPage,
} = require('../../lib/pkp/playwright/pages/WorkflowShellPage.js');
const {
	DecisionWizardPage,
} = require('../../lib/pkp/playwright/pages/DecisionWizardPage.js');
const {
	FileStagePanel,
} = require('../../lib/pkp/playwright/pages/FileStagePanel.js');
const {
	DashboardPage,
} = require('../../lib/pkp/playwright/pages/DashboardPage.js');

/**
 * Send to review (the Submission-stage workspace) — one test per
 * canonical scenario of docs/product/specs/send-to-review.md
 * (8 scenarios → 8 tests). The workspace composition is OJS-specific
 * (workflowConfigEditorialOJS.js: the Desk Review panel heading, the
 * OJS decision roster Send for Review / Accept and Skip Review /
 * Decline Submission, the Schedule For Publication shortcut), and the
 * scenarios lean on publicknowledge / ART — so the spec lives at the
 * OJS root (mirroring tasks-discussions.spec.js). The file-panel POM it
 * drives (FileStagePanel) and the shell/decision POMs ship from lib/pkp.
 *
 * Coverage map (canonical scenario → test):
 *   s1 Taking stock of a new submission     → 's1: taking stock — panels, columns, decision rail, Download All Files ZIP'
 *   s2 Tidying the package                  → 's2: tidying — upload, rename persists, notes & history, delete with prompt'
 *   s3 Pulling the manuscript into the
 *      text editor                          → 's3: Send to Text Editor — manager-only docx handoff to Body Text, original untouched'
 *   s4 Handing the submission into review   → 's4: Send for Review — ticked file lands in Files for Review, Submission Files stay'
 *   s5 Accepting without review             → 's5: Accept and Skip Review — Copyediting landing, revisited stage keeps its abilities'
 *   s6 A desk decline leaves the room
 *      standing                             → 's6: desk decline — Declined badge, panels intact, collapsed rail, revert restores'
 *   s7 Who sees what on the first stage     → 's7: role boundary — assistant, author tracking view, unassigned manager'
 *   s8 Deleting a declined submission
 *      for good                             → 's8: permanent deletion — Delete prompt, panel closes, submission leaves the lists, address invalid'
 *
 * Facts baked in from the 2026-07-24 probe batches A–D (do not
 * rediscover): row actions are role=menuitem, not buttons; renames are
 * asserted on the row locator, never bare getByText (the first text
 * match after reload is a hidden element); "Download All Files" is a
 * BUTTON styled as a link, archive named <id>--submission-files.zip;
 * the Information Center is a legacy modal — never press Escape in it
 * (it also closes the workflow dialog), close it via its Close button;
 * the Send to Text Editor gate reads the DISPLAYED name's extension,
 * so a wizard upload whose metadata name ends in .docx carries the
 * action; the version select starts unselected and Confirm is inert
 * until a version is picked.
 *
 * Parallel-safety: every submission is per-test via the scenario API
 * (no reliance on probe leftovers); tags are single hyphenless
 * alphanumeric tokens; publicknowledge is used read-only + additively;
 * no Mailpit assertions (decision mails are editorial-decisions').
 */

test.use({user: 'sectioneditor.ana'}); // default actor: an assigned section editor

const JOURNAL = 'publicknowledge';
const SEEDED_FILE = 'default-article.pdf';
const DUMMY_PDF = path.join(
	__dirname,
	'..',
	'..',
	'lib',
	'pkp',
	'playwright',
	'fixtures',
	'files',
	'dummy.pdf',
);
const MANUSCRIPT_DOCX = path.join(
	__dirname,
	'..',
	'fixtures',
	'files',
	'send-to-review-manuscript.docx',
);
// Body copy inside send-to-review-manuscript.docx (pandoc-built fixture).
const DOCX_BODY_TEXT =
	'Imported body text for the send-to-review handoff suite.';

const DELETE_PROMPT =
	'Are you sure you wish to delete this item? This action cannot be undone.';
// The submission-level Delete prompt (editor.submissionArchive.confirmDelete)
// — distinct from the file-level DELETE_PROMPT above.
const DELETE_SUBMISSION_PROMPT =
	'Are you sure you want to permanently delete this submission?';
const INVALID_SUBMISSION_SENTENCE = 'Invalid submission.';
const FILES_PANEL_DESCRIPTION = 'Files uploaded at the time of submission';
const DECISION_BUTTONS = [
	'Send for Review',
	'Accept and Skip Review',
	'Decline Submission',
];
// The action rail's EXACT contents, in render order — the Schedule For
// Publication navigation shortcut sits above the decisions (Known
// deviations, ledger row 220).
const ACTIVE_RAIL = ['Schedule For Publication', ...DECISION_BUTTONS];
const DECLINED_RAIL = ['Schedule For Publication', 'Revert Decline'];
const DECLINED_RAIL_MANAGER = [...DECLINED_RAIL, 'Delete'];

/** A unique, hyphenless, alphanumeric tag (parallel isolation). */
function uniqueTag(prefix = 'str') {
	const workerLetter = String.fromCharCode(
		97 + (test.info().parallelIndex % 26),
	);
	let suffix = '';
	while (suffix.length < 6) {
		suffix += Math.random()
			.toString(36)
			.replace(/[^a-z0-9]/g, '');
	}
	return `${prefix}${workerLetter}${suffix.slice(0, 6)}`;
}

/**
 * Scenario spec for a SUBMITTED stage-1 submission with an AO
 * publication carrying the tag in its title.
 */
function submittedSpec({tag, title, participants, decisions}) {
	return {
		tag,
		journal: JOURNAL,
		submitter: 'author.alex',
		section: 'ART',
		locale: 'en',
		submitted: true,
		...(participants ? {participants} : {}),
		...(decisions ? {decisions} : {}),
		publications: [
			{
				versionStage: 'AO',
				published: false,
				metadata: {
					title: {en: title},
					abstract: {en: `<p>Send-to-review fixture ${tag}.</p>`},
				},
			},
		],
	};
}

/**
 * The entry names inside a ZIP buffer, read from its central directory
 * (EOCD record → entry count + directory offset → walk the records).
 * No external tool: FileArchive::create() writes flat client filenames
 * (PKPFileService::formatFilename — the file's displayed name), so the
 * entry names are exactly what the panel's rows show.
 *
 * @param {Buffer} buffer
 * @returns {string[]}
 */
function zipEntryNames(buffer) {
	const eocd = buffer.lastIndexOf(Buffer.from('PK\x05\x06', 'latin1'));
	if (eocd < 0) {
		throw new Error('not a ZIP archive: no end-of-central-directory record');
	}
	const count = buffer.readUInt16LE(eocd + 10);
	let offset = buffer.readUInt32LE(eocd + 16);
	const names = [];
	for (let i = 0; i < count; i++) {
		if (buffer.readUInt32LE(offset) !== 0x02014b50) {
			throw new Error('corrupt ZIP central directory');
		}
		const nameLen = buffer.readUInt16LE(offset + 28);
		const extraLen = buffer.readUInt16LE(offset + 30);
		const commentLen = buffer.readUInt16LE(offset + 32);
		names.push(
			buffer.subarray(offset + 46, offset + 46 + nameLen).toString('utf8'),
		);
		offset += 46 + nameLen + extraLen + commentLen;
	}
	return names;
}

/** A decision button in the workflow shell's action rail. */
function railButton(shell, name) {
	return shell.actionItems().getByRole('button', {name, exact: true});
}

/** Click a rail decision button and wait for the decision/record page. */
async function openDecision(page, shell, name) {
	await railButton(shell, name).click();
	await page.waitForURL(/\/decision\/record\//, {
		timeout: 20_000,
		waitUntil: 'commit',
	});
}

/** Open the editorial shell and wait for the Submission-stage heading. */
async function openSubmissionStage(page, submissionId) {
	const shell = new WorkflowShellPage(page);
	await shell.gotoEditorial(submissionId);
	await expect(shell.contentHeading('Workflow: Submission')).toBeVisible({
		timeout: 20_000,
	});
	return shell;
}

/**
 * Open a row's More Actions menu and assert which items it offers,
 * then close the menu again (Escape on a headlessui menu is safe — the
 * legacy-modal Escape pitfall does not apply here; precedent in
 * author-dashboard.spec.js s1).
 *
 * @param {FileStagePanel} panel
 * @param {import('@playwright/test').Page} page
 * @param {string} rowText
 * @param {{present?: string[], absent?: string[]}} items
 */
async function expectRowMenu(panel, page, rowText, {present = [], absent = []}) {
	await panel.openRowMenu(rowText);
	const menu = page.getByRole('menu');
	await expect(menu).toBeVisible({timeout: 10_000});
	for (const label of present) {
		await expect(
			page.getByRole('menuitem', {name: label, exact: true}),
		).toBeVisible();
	}
	for (const label of absent) {
		await expect(
			page.getByRole('menuitem', {name: label, exact: true}),
		).toHaveCount(0);
	}
	await page.keyboard.press('Escape');
	await expect(menu).toHaveCount(0, {timeout: 10_000});
}

const ROLE_ERROR_SENTENCE =
	'The current role does not have access to this operation.';

/**
 * Run `fn`, retrying if it is torn up mid-flight — used for the
 * assistant's row-menu operations, which the as-built role-access error
 * dialog (the assistant's reviewer-suggestions fetch 401s and pops an
 * "Error" dialog at an arbitrary moment) can interrupt by closing the
 * open menu. The page-level locator handler dismisses the dialog; this
 * wrapper repairs the page state (leftover dialog, stray menu, or a
 * workflow modal that got closed in the shuffle) and restarts the
 * interrupted interaction. Never presses Escape blindly: with no menu
 * open, Escape closes the workflow modal itself.
 *
 * @param {{page: import('@playwright/test').Page, shell: WorkflowShellPage, submissionId: number|string}} ctx
 * @param {() => Promise<void>} fn
 * @param {number} [attempts=3]
 */
async function retryOnRoleError({page, shell, submissionId}, fn, attempts = 3) {
	let lastError;
	for (let i = 0; i < attempts; i++) {
		try {
			return await fn();
		} catch (error) {
			lastError = error;
			// A lingering role-access dialog (usually the handler got it).
			const err = page
				.locator('[data-cy="dialog"]')
				.filter({hasText: ROLE_ERROR_SENTENCE});
			if (await err.count()) {
				await err
					.last()
					.getByRole('button', {name: 'OK', exact: true})
					.click()
					.catch(() => {});
			}
			// A stray open row menu — Escape is consumed by the menu.
			if (await page.getByRole('menu').count()) {
				await page.keyboard.press('Escape').catch(() => {});
			}
			// The shuffle can drop the page back to the dashboard listing —
			// reopen the stage view before retrying.
			const stageOpen = await shell
				.contentHeading('Workflow: Submission')
				.isVisible()
				.catch(() => false);
			if (!stageOpen) {
				await shell.gotoEditorial(submissionId);
				await expect(
					shell.contentHeading('Workflow: Submission'),
				).toBeVisible({timeout: 20_000});
			}
		}
	}
	throw lastError;
}

test.describe('Send to review — the Submission-stage workspace', () => {
	// Canonical scenario 1 — a Section Editor assigned to a fresh submission
	// opens it: the workflow lands on the Submission stage with the
	// "Submission Files" panel ("Files uploaded at the time of submission",
	// columns No / File Name / Date uploaded / Type + the sr-only More
	// Actions column) listing the author's file as a download link with a
	// type badge, above "Desk Review Tasks & Discussions"; "Participants"
	// in the side column; the decision buttons on the right. "Download All
	// Files" under the list delivers one ZIP archive named
	// <submissionId>--submission-files.zip.
	test('s1: taking stock — panels, columns, decision rail, Download All Files ZIP', async ({
		page,
		pkpApi,
	}) => {
		const tag = uniqueTag('stra');
		const {submission} = await pkpApi.createSubmission(
			submittedSpec({
				tag,
				title: `Taking stock ${tag}`,
				participants: [{user: 'sectioneditor.ana', role: 'sectionEditor'}],
			}),
		);

		const shell = await openSubmissionStage(page, submission.id);

		// The files panel: heading, description line, Upload in the header.
		const files = new FileStagePanel(page, 'Submission Files');
		await files.expectVisible();
		await expect(
			shell.modal().getByText(FILES_PANEL_DESCRIPTION),
		).toBeVisible();
		await expect(
			files.root().getByRole('button', {name: 'Upload', exact: true}),
		).toBeVisible();

		// Columns exactly as rendered in the DOM (uppercase look is CSS),
		// plus the visually-blank sr-only "More Actions" header.
		for (const header of ['No', 'File Name', 'Date uploaded', 'Type']) {
			await expect(
				files.table.getByRole('columnheader', {name: header, exact: true}),
			).toBeVisible();
		}
		await expect(
			files.table.getByRole('columnheader', {name: 'More Actions'}),
		).toHaveCount(1);

		// The row: file id number, the name as a download link, the upload
		// date, the kind as a badge ("Article Text").
		const row = files.row(SEEDED_FILE);
		await expect(row).toBeVisible();
		await expect(files.fileLink(SEEDED_FILE)).toBeVisible();
		await expect(row.getByRole('cell').first()).toHaveText(/^\s*\d+\s*$/);
		await expect(row).toContainText(/\d{4}-\d{2}-\d{2}/);
		await expect(row).toContainText('Article Text');

		// The working panels around it.
		await expect(
			shell
				.modal()
				.getByRole('heading', {name: 'Desk Review Tasks & Discussions'}),
		).toBeVisible();
		await expect(
			shell.secondaryItems().getByRole('heading', {name: 'Participants'}),
		).toBeVisible();

		// The three exits wait on the right.
		for (const label of DECISION_BUTTONS) {
			await expect(railButton(shell, label)).toBeVisible();
		}

		// "Download All Files" (a button styled as a link) delivers the
		// package as one ZIP archive named <id>--submission-files.zip…
		const listed = (
			await files.table.getByRole('row').getByRole('link').allTextContents()
		)
			.map((text) => text.trim())
			.filter(Boolean);
		expect(listed, 'the panel lists the author\'s file').toEqual([SEEDED_FILE]);

		const download = await files.downloadAll();
		expect(download.suggestedFilename()).toBe(
			`${submission.id}--submission-files.zip`,
		);
		const zipPath = await download.path();
		const archive = fs.readFileSync(zipPath);
		expect(
			archive.subarray(0, 2).toString('latin1'),
			'the archive is a real ZIP (PK magic)',
		).toBe('PK');
		// …"holding the whole package": its entries are exactly the files
		// the panel lists, under the names it shows.
		expect(
			zipEntryNames(archive).sort(),
			'the archive holds exactly the listed package',
		).toEqual([...listed].sort());
	});

	// Canonical scenario 2 — the same Section Editor tidies the package:
	// "Upload" runs the "Upload Submission File" wizard and the new file
	// appears; "Update File Details" ("Edit a file") renames it and the
	// rename persists after reload (asserted on the row, not bare
	// getByText); "More Information" opens the Information Center with
	// History and Notes; "Delete" on a duplicate row prompts with the
	// exact confirmDelete wording and on OK the row is gone.
	test('s2: tidying — upload, rename persists, notes & history, delete with prompt', async ({
		page,
		pkpApi,
	}) => {
		test.slow(); // two legacy upload wizards + rename + reload + legacy modal
		const tag = uniqueTag('strb');
		const {submission} = await pkpApi.createSubmission(
			submittedSpec({
				tag,
				title: `Tidy package ${tag}`,
				participants: [{user: 'sectioneditor.ana', role: 'sectionEditor'}],
			}),
		);
		const correctedName = `corrected-${tag}.pdf`;
		const renamedName = `fixed-${tag}.pdf`;
		const duplicateName = `duplicate-${tag}.pdf`;

		const shell = await openSubmissionStage(page, submission.id);
		const files = new FileStagePanel(page, 'Submission Files');
		await files.expectVisible();

		// Upload the corrected manuscript through the "Upload Submission
		// File" wizard; it appears in the list.
		let wizard = await files.openDirectUploadWizard('Upload Submission File');
		await files.driveUploadWizard(wizard, {
			filePath: DUMMY_PDF,
			displayName: correctedName,
		});
		await expect(files.row(correctedName)).toBeVisible({timeout: 20_000});

		// …and a duplicate to delete later.
		wizard = await files.openDirectUploadWizard('Upload Submission File');
		await files.driveUploadWizard(wizard, {
			filePath: DUMMY_PDF,
			displayName: duplicateName,
		});
		await expect(files.row(duplicateName)).toBeVisible({timeout: 20_000});

		// "Update File Details" → the "Edit a file" dialog; the rename
		// shows on the row and persists across a full reload.
		const editModal = await files.openEditModal(correctedName);
		await files.editModalNameInput(editModal).fill(renamedName);
		await files.saveEditModal(editModal);
		await expect(files.row(renamedName)).toBeVisible({timeout: 20_000});
		await page.reload({waitUntil: 'commit'});
		await expect(shell.contentHeading('Workflow: Submission')).toBeVisible({
			timeout: 20_000,
		});
		await expect(files.row(renamedName)).toBeVisible({timeout: 20_000});
		await expect(files.row(correctedName)).toHaveCount(0);

		// "More Information" → the legacy Information Center modal titled
		// with the file's CURRENT name, carrying History and Notes tabs.
		// Closed via its Close button — Escape here would take the whole
		// workflow dialog down with it (probe batch A pitfall).
		const infoModal = await files.openInformationCenter(renamedName);
		await expect(infoModal).toContainText(`Information Center: ${renamedName}`);
		await expect(infoModal.getByRole('tab', {name: 'History'}).first())
			.toBeVisible();
		await expect(infoModal.getByRole('tab', {name: 'Notes'}).first())
			.toBeVisible();
		await files.closeModal(infoModal);

		// "Delete" on the duplicate row: the prompt is headed "Delete",
		// asks the exact confirmDelete question, offers OK and Cancel —
		// and on OK the row is gone.
		await files.clickRowAction(duplicateName, 'Delete');
		const dialog = page
			.locator('[data-cy="dialog"]')
			.filter({hasText: DELETE_PROMPT})
			.first();
		await expect(dialog).toBeVisible({timeout: 10_000});
		await expect(
			dialog.getByRole('heading', {name: 'Delete', exact: true}),
		).toBeVisible();
		await expect(
			dialog.getByRole('button', {name: 'Cancel', exact: true}),
		).toBeVisible();
		await dialog.getByRole('button', {name: 'OK', exact: true}).click();
		await expect(files.row(duplicateName)).toHaveCount(0, {timeout: 20_000});
		// The other rows stay.
		await expect(files.row(renamedName)).toBeVisible();
		await expect(files.row(SEEDED_FILE)).toBeVisible();
	});

	// Canonical scenario 3 — a Journal Manager picks "Send to Text Editor"
	// on a Word-format file (the action is absent on the PDF next to it):
	// the "Send File to Text Editor" dialog asks "To which version would
	// you like to send this file?" with "Create New Version" ahead of the
	// existing version, starts unselected, and Confirm is inert until a
	// version is picked. Confirming an existing version lands in the Body
	// Text editor with the manuscript imported as unsaved changes; the
	// original file still sits in Submission Files.
	test('s3: Send to Text Editor — manager-only docx handoff to Body Text, original untouched', async ({
		asUser,
		pkpApi,
	}) => {
		test.slow(); // upload wizard + Pandoc round-trip
		const tag = uniqueTag('strc');
		const {submission} = await pkpApi.createSubmission(
			submittedSpec({
				tag,
				title: `Text editor handoff ${tag}`,
				participants: [{user: 'editor.diana', role: 'editor'}],
			}),
		);
		const docxName = `manuscript-${tag}.docx`;

		const mayaCtx = await asUser('manager.maya');
		const page = await mayaCtx.newPage();
		const shell = await openSubmissionStage(page, submission.id);
		const files = new FileStagePanel(page, 'Submission Files');
		await files.expectVisible();

		// Add the Word manuscript next to the seeded PDF.
		const wizard = await files.openDirectUploadWizard('Upload Submission File');
		await files.driveUploadWizard(wizard, {
			filePath: MANUSCRIPT_DOCX,
			displayName: docxName,
		});
		await expect(files.row(docxName)).toBeVisible({timeout: 20_000});

		// The action is absent on the PDF next to it…
		await expectRowMenu(files, page, SEEDED_FILE, {
			present: ['Update File Details', 'More Information', 'Delete'],
			absent: ['Send to Text Editor'],
		});

		// …and present on the docx. Open the handoff dialog.
		await files.openRowMenu(docxName);
		await page
			.getByRole('menuitem', {name: 'Send to Text Editor', exact: true})
			.click();
		const dialog = page.getByRole('dialog', {name: 'Send File to Text Editor'});
		await expect(dialog).toBeVisible({timeout: 15_000});
		await expect(
			dialog.getByText('To which version would you like to send this file?'),
		).toBeVisible();

		// The required version choice starts unselected, offering "Create
		// New Version" ahead of the existing version.
		const versionSelect = dialog.locator('select[name="sendToVersion"]');
		await expect(versionSelect).toHaveValue('');
		const optionLabels = await versionSelect.locator('option').allTextContents();
		const trimmed = optionLabels.map((t) => t.trim()).filter(Boolean);
		expect(trimmed).toContain('Create New Version');
		expect(trimmed).toContain('Author Original 1.0');
		expect(trimmed.indexOf('Create New Version')).toBeLessThan(
			trimmed.indexOf('Author Original 1.0'),
		);

		// Confirm does nothing until a version is picked: the dialog stays
		// and no Body Text navigation happens.
		await dialog.getByRole('button', {name: 'Confirm', exact: true}).click();
		await expect(dialog).toBeVisible();
		expect(page.url()).not.toContain('bodyText');

		// Choose the existing version and confirm: the Body Text editor
		// opens with the manuscript's content imported, waiting as
		// unsaved changes.
		await versionSelect.selectOption({label: 'Author Original 1.0'});
		await dialog.getByRole('button', {name: 'Confirm', exact: true}).click();
		await page.waitForURL(/bodyText/, {timeout: 30_000, waitUntil: 'commit'});
		await expect(
			shell.contentHeading('Publication: Body Text'),
		).toBeVisible({timeout: 30_000});
		await expect(
			shell.modal().getByText('Unsaved Changes', {exact: true}),
		).toBeVisible({timeout: 30_000});
		await expect(
			shell.modal().getByText(DOCX_BODY_TEXT).first(),
		).toBeVisible({timeout: 30_000});

		// The original file still sits unchanged in Submission Files.
		await shell.clickMenu('Submission');
		await expect(shell.contentHeading('Workflow: Submission')).toBeVisible({
			timeout: 20_000,
		});
		await expect(files.row(docxName)).toBeVisible({timeout: 20_000});
		await expect(files.row(SEEDED_FILE)).toBeVisible();
	});

	// Canonical scenario 4 — the Section Editor clicks "Send for Review"
	// and completes the decision flow with the manuscript ticked in the
	// file step: the workflow now sits on Review, Round 1; the ticked file
	// is in the round's "Files for Review"; the Submission stage keeps its
	// full Submission Files list as the record of what arrived.
	test('s4: Send for Review — ticked file lands in Files for Review, Submission Files stay', async ({
		page,
		pkpApi,
	}) => {
		const tag = uniqueTag('strd');
		const {submission} = await pkpApi.createSubmission(
			submittedSpec({
				tag,
				title: `Into review ${tag}`,
				participants: [{user: 'sectioneditor.ana', role: 'sectionEditor'}],
			}),
		);

		const shell = await openSubmissionStage(page, submission.id);
		await openDecision(page, shell, 'Send for Review');

		// The decision flow (owned by editorial-decisions): keep the
		// prefilled email, verify the manuscript is ticked in the file
		// step, record.
		const wizard = new DecisionWizardPage(page);
		await expect(wizard.stepItem('Notify Authors')).toBeVisible({
			timeout: 20_000,
		});
		await wizard.continueStep();
		await expect(wizard.promoteFileRow(SEEDED_FILE)).toBeVisible({
			timeout: 20_000,
		});
		await expect(wizard.promoteFileCheckbox(SEEDED_FILE)).toBeChecked();
		await wizard.record('Sent for Review');
		await wizard.viewSummary(submission.id);

		// The workflow now sits on Review, Round 1, with the ticked file
		// in the round's Files for Review.
		await expect(
			shell.contentHeading('Workflow: Review (Round 1)'),
		).toBeVisible({timeout: 20_000});
		const reviewFiles = new FileStagePanel(page, 'Files for Review');
		await reviewFiles.expectVisible();
		await expect(reviewFiles.row(SEEDED_FILE)).toBeVisible({timeout: 20_000});

		// The Submission stage keeps its full Submission Files list.
		await shell.clickMenu('Submission');
		await expect(shell.contentHeading('Workflow: Submission')).toBeVisible({
			timeout: 20_000,
		});
		const files = new FileStagePanel(page, 'Submission Files');
		await files.expectVisible();
		await expect(files.row(SEEDED_FILE)).toBeVisible({timeout: 20_000});
	});

	// Canonical scenario 5 — a Journal Manager clicks "Accept and Skip
	// Review": the submission lands in Copyediting without entering
	// review. Reopening the Submission stage shows the stage's panels
	// under a "Status" note naming the stage the submission now sits in —
	// and the files panel still offers Upload and the row actions to the
	// manager (abilities follow the person, not the stage's progress).
	test('s5: Accept and Skip Review — Copyediting landing, revisited stage keeps its abilities', async ({
		asUser,
		pkpApi,
	}) => {
		test.slow(); // decision wizard + stage revisit
		const tag = uniqueTag('stre');
		const {submission} = await pkpApi.createSubmission(
			submittedSpec({
				tag,
				title: `Skip review ${tag}`,
				participants: [{user: 'editor.diana', role: 'editor'}],
			}),
		);

		const mayaCtx = await asUser('manager.maya');
		const page = await mayaCtx.newPage();
		const shell = await openSubmissionStage(page, submission.id);
		await openDecision(page, shell, 'Accept and Skip Review');

		const wizard = new DecisionWizardPage(page);
		await wizard.recordThrough('Skipped Review');
		await wizard.viewSummary(submission.id);

		// The submission lands in Copyediting…
		await expect(shell.contentHeading('Workflow: Copyediting')).toBeVisible({
			timeout: 20_000,
		});

		// …WITHOUT ever entering review: no round was ever opened (no
		// round entry in the stage menu), and the Review stage itself
		// still reads as never initiated.
		await expect(shell.menuItem('Review Round 1')).toHaveCount(0);
		await shell.clickMenu('Review');
		await expect(shell.contentHeading('Workflow: Review')).toBeVisible({
			timeout: 20_000,
		});
		await shell.expectStageNotStarted('Review');

		// Reopening the Submission stage: panels under a Status note naming
		// the stage the submission now sits in.
		await shell.clickMenu('Submission');
		await expect(shell.contentHeading('Workflow: Submission')).toBeVisible({
			timeout: 20_000,
		});
		await expect(
			shell.primaryItems().getByRole('heading', {name: 'Status'}),
		).toBeVisible({timeout: 20_000});
		await expect(
			shell
				.primaryItems()
				.getByText('The submission is currently in the Copyediting stage.'),
		).toBeVisible();

		// The files panel still offers Upload and the row actions.
		const files = new FileStagePanel(page, 'Submission Files');
		await files.expectVisible();
		await expect(
			files.root().getByRole('button', {name: 'Upload', exact: true}),
		).toBeVisible();
		await expectRowMenu(files, page, SEEDED_FILE, {
			present: ['Update File Details', 'More Information', 'Delete'],
		});
	});

	// Canonical scenario 6 — a Section Editor declines at the desk: a
	// "Declined" badge joins the header, the files/participants/
	// discussions panels stay, the decision column collapses to Revert
	// Decline (a Journal Manager also sees Delete) under the Schedule For
	// Publication shortcut; reverting restores the original three exits.
	test('s6: desk decline — Declined badge, panels intact, collapsed rail, revert restores', async ({
		page,
		asUser,
		pkpApi,
	}) => {
		test.slow(); // two decision wizards + a second actor
		const tag = uniqueTag('strf');
		const {submission} = await pkpApi.createSubmission(
			submittedSpec({
				tag,
				title: `Desk decline ${tag}`,
				participants: [{user: 'sectioneditor.ana', role: 'sectionEditor'}],
			}),
		);

		const shell = await openSubmissionStage(page, submission.id);
		await openDecision(page, shell, 'Decline Submission');
		const wizard = new DecisionWizardPage(page);
		await wizard.recordThrough('Submission Declined');
		await wizard.viewSummary(submission.id);

		// A "Declined" badge sits by the submission's title.
		await expect(
			shell.header().getByText('Declined', {exact: true}).first(),
		).toBeVisible({timeout: 20_000});

		// The panels remain: files (with its row), participants, discussions.
		const files = new FileStagePanel(page, 'Submission Files');
		await files.expectVisible();
		await expect(files.row(SEEDED_FILE)).toBeVisible();
		await expect(
			shell.secondaryItems().getByRole('heading', {name: 'Participants'}),
		).toBeVisible();
		await expect(
			shell
				.modal()
				.getByRole('heading', {name: 'Desk Review Tasks & Discussions'}),
		).toBeVisible();

		// The decision column collapses to Revert Decline as the ONLY
		// decision offered — asserted as the rail's exact contents, not
		// as a list of absences — still under the Schedule For
		// Publication shortcut, and with no Delete for a Section Editor.
		await expect(railButton(shell, 'Revert Decline')).toBeVisible({
			timeout: 20_000,
		});
		await expect(shell.actionItems().getByRole('button')).toHaveText(
			DECLINED_RAIL,
		);

		// A Journal Manager also sees Delete — and nothing else beyond it.
		const mayaCtx = await asUser('manager.maya');
		const mayaPage = await mayaCtx.newPage();
		const mayaShell = new WorkflowShellPage(mayaPage);
		await mayaShell.gotoEditorial(submission.id);
		await expect(railButton(mayaShell, 'Revert Decline')).toBeVisible({
			timeout: 20_000,
		});
		await expect(mayaShell.actionItems().getByRole('button')).toHaveText(
			DECLINED_RAIL_MANAGER,
		);

		// Reverting restores the original three exits — again as the
		// rail's exact contents, with Revert Decline gone.
		await openDecision(page, shell, 'Revert Decline');
		await wizard.recordThrough('Submission Reactivated');
		await wizard.viewSummary(submission.id);
		await expect(railButton(shell, 'Send for Review')).toBeVisible({
			timeout: 20_000,
		});
		await expect(shell.actionItems().getByRole('button')).toHaveText(
			ACTIVE_RAIL,
		);
	});

	// Canonical scenario 7 — on one submission: an unassigned Journal
	// Manager gets the complete workspace, decisions included (and renames
	// the file to a Word name, arming the assistant's negative check); an
	// Assistant assigned to the stage gets the files panel with Upload,
	// Update File Details and a working Delete (prompt included), plus
	// Participants and Desk Review Tasks & Discussions — but no decision
	// buttons and no Send to Text Editor even on a Word-named file, while
	// the Schedule For Publication shortcut still shows (Known
	// deviations); the Author's tracking view lists the same files with
	// Download All Files but no Upload or Delete, its row menu offering
	// only Update File Details (Known deviations).
	test('s7: role boundary — assistant, author tracking view, unassigned manager', async ({
		asUser,
		pkpApi,
	}) => {
		test.slow(); // three actors + rename + upload/delete round-trip
		const tag = uniqueTag('strg');
		const {submission} = await pkpApi.createSubmission(
			submittedSpec({
				tag,
				title: `Role boundary ${tag}`,
				// assistant.rita joins through the funding group — the
				// assistant-role group with Submission-stage access.
				participants: [
					{user: 'editor.diana', role: 'editor'},
					{user: 'assistant.rita', role: 'funding'},
				],
			}),
		);
		const wordName = `word-${tag}.docx`;
		const scratchName = `scratch-${tag}.pdf`;

		// --- Unassigned Journal Manager: the complete workspace. ---
		const mayaCtx = await asUser('manager.maya');
		const mayaPage = await mayaCtx.newPage();
		const mayaShell = await openSubmissionStage(mayaPage, submission.id);
		const mayaFiles = new FileStagePanel(mayaPage, 'Submission Files');
		await mayaFiles.expectVisible();
		await expect(
			mayaFiles.root().getByRole('button', {name: 'Upload', exact: true}),
		).toBeVisible();
		await expect(
			mayaShell.secondaryItems().getByRole('heading', {name: 'Participants'}),
		).toBeVisible();
		for (const label of DECISION_BUTTONS) {
			await expect(railButton(mayaShell, label)).toBeVisible();
		}
		// Rename the seeded file to a Word name (full edit ability for the
		// unassigned manager; also arms the assistant's format-negative).
		const editModal = await mayaFiles.openEditModal(SEEDED_FILE);
		await mayaFiles.editModalNameInput(editModal).fill(wordName);
		await mayaFiles.saveEditModal(editModal);
		await expect(mayaFiles.row(wordName)).toBeVisible({timeout: 20_000});

		// --- Assigned Assistant: workspace without decisions. ---
		const ritaCtx = await asUser('assistant.rita');
		const ritaPage = await ritaCtx.newPage();
		// On publicknowledge (reviewer suggestions enabled) the assistant's
		// stage view pops the as-built role-access error dialog at a
		// VARIABLE moment (the suggestions fetch 401s — editorial-decisions
		// s11 documents the same dialog on the review stage). While open it
		// is modal: the workspace drops out of the accessibility tree and
		// every role locator stops resolving. Auto-dismiss it whenever it
		// shows up mid-flow.
		const ritaError = ritaPage
			.locator('[data-cy="dialog"]')
			.filter({hasText: ROLE_ERROR_SENTENCE});
		await ritaPage.addLocatorHandler(
			ritaError.first(),
			async () => {
				await ritaError
					.last()
					.getByRole('button', {name: 'OK', exact: true})
					.click();
			},
			{noWaitAfter: true},
		);
		const ritaShell = await openSubmissionStage(ritaPage, submission.id);
		const ritaFiles = new FileStagePanel(ritaPage, 'Submission Files');
		await ritaFiles.expectVisible();
		await expect(
			ritaFiles.root().getByRole('button', {name: 'Upload', exact: true}),
		).toBeVisible();
		await expect(
			ritaShell.secondaryItems().getByRole('heading', {name: 'Participants'}),
		).toBeVisible();
		await expect(
			ritaShell
				.modal()
				.getByRole('heading', {name: 'Desk Review Tasks & Discussions'}),
		).toBeVisible();
		// No decision buttons — but the Schedule For Publication shortcut
		// still shows (as-built deviation, ledger row 220 extension).
		for (const label of DECISION_BUTTONS) {
			await expect(railButton(ritaShell, label)).toHaveCount(0);
		}
		await expect(
			railButton(ritaShell, 'Schedule For Publication'),
		).toBeVisible();
		// No Send to Text Editor even on a Word-named file: the negative
		// is role-driven, not format-driven. (Menu ops are wrapped in the
		// role-error retry: the dialog's arrival closes an open row menu.)
		const ritaCtx2 = {page: ritaPage, shell: ritaShell, submissionId: submission.id};
		await retryOnRoleError(ritaCtx2, async () => {
			await expectRowMenu(ritaFiles, ritaPage, wordName, {
				present: ['Update File Details', 'More Information', 'Delete'],
				absent: ['Send to Text Editor'],
			});
		});
		// Deletion works, prompt included — on the assistant's own upload,
		// leaving the package intact for the author's view.
		const ritaWizard = await ritaFiles.openDirectUploadWizard(
			'Upload Submission File',
		);
		await ritaFiles.driveUploadWizard(ritaWizard, {
			filePath: DUMMY_PDF,
			displayName: scratchName,
		});
		await expect(ritaFiles.row(scratchName)).toBeVisible({timeout: 20_000});
		await retryOnRoleError(ritaCtx2, async () => {
			await ritaFiles.openRowMenu(scratchName);
			await ritaPage
				.getByRole('menuitem', {name: 'Delete', exact: true})
				.click({timeout: 10_000});
		});
		const ritaConfirm = ritaPage
			.locator('[data-cy="dialog"]')
			.filter({hasText: DELETE_PROMPT})
			.first();
		await expect(ritaConfirm).toBeVisible({timeout: 10_000});
		await ritaConfirm.getByRole('button', {name: 'OK', exact: true}).click();
		await expect(ritaFiles.row(scratchName)).toHaveCount(0, {timeout: 20_000});

		// --- The Author, entering the SAME screen through My Submissions:
		//     the same Submission-stage workspace, the same files with
		//     Download All Files, but no Upload, no Delete and no
		//     decision buttons; each row's menu offers only Update File
		//     Details (Known deviations). ---
		const alexCtx = await asUser('author.alex');
		const alexPage = await alexCtx.newPage();
		const alexShell = new WorkflowShellPage(alexPage);
		await alexShell.gotoTracking(submission.id);
		// One shared screen: the author stands on the same workflow
		// surface, opened on the Submission stage.
		await expect(
			alexShell.contentHeading('Workflow: Submission'),
		).toBeVisible({timeout: 20_000});
		const alexFiles = new FileStagePanel(alexPage, 'Submission Files');
		await alexFiles.expectVisible();
		await expect(alexFiles.row(wordName)).toBeVisible({timeout: 20_000});
		await expect(
			alexFiles.root().getByRole('button', {name: 'Download All Files'}),
		).toBeVisible();
		await expect(
			alexFiles.root().getByRole('button', {name: 'Upload', exact: true}),
		).toHaveCount(0);
		// No decision buttons — for the Author the action column is not
		// rendered at all (permissions table row j).
		for (const label of DECISION_BUTTONS) {
			await expect(railButton(alexShell, label)).toHaveCount(0);
		}
		await expect(alexShell.actionItems()).toHaveCount(0);
		// …and no Delete: the row menu holds a single entry.
		await alexFiles.openRowMenu(wordName);
		await expect(alexPage.getByRole('menuitem')).toHaveText([
			'Update File Details',
		]);
		await alexPage.keyboard.press('Escape');
	});

	// Canonical scenario 8 — on a submission already declined at the desk
	// (the state scenario 6 ends in), a Journal Manager notes the
	// submission's web address and presses "Delete" in the action column.
	// A dialog titled "Delete" asks "Are you sure you want to permanently
	// delete this submission?" with Confirm and Cancel; on Confirm the
	// workflow panel closes and the submission is gone from the editorial
	// lists. Opening the noted address now shows an empty workflow panel
	// over the message "Invalid submission." (rule 8: permanent and
	// total, no undo, no archive copy).
	//
	// The submission is a THROWAWAY seeded for this test alone (declined
	// via the scenario API's initialDecline shortcut); a second declined
	// submission sharing the searchable token rides along as the positive
	// control that bounds the "gone from the list" negative — without it
	// an empty list could simply mean the list had not loaded.
	// The one part of rule 8 this test cannot reach is its Known
	// deviation: the file-history rows that survive the deletion are, by
	// the deviation's own statement, reachable from no screen.
	test('s8: permanent deletion — Delete prompt, panel closes, submission leaves the lists, address invalid', async ({
		asUser,
		pkpApi,
	}) => {
		test.slow(); // two seeded submissions + a dashboard round-trip
		const token = uniqueTag('strh');
		const victimTitle = `Permanent deletion ${token} victim`;
		const controlTitle = `Permanent deletion ${token} control`;
		const declinedBy = [{type: 'initialDecline', by: 'editor.diana'}];
		const participants = [{user: 'editor.diana', role: 'editor'}];
		const {submission} = await pkpApi.createSubmission(
			submittedSpec({
				tag: `${token}v`,
				title: victimTitle,
				participants,
				decisions: declinedBy,
			}),
		);
		await pkpApi.createSubmission(
			submittedSpec({
				tag: `${token}c`,
				title: controlTitle,
				participants,
				decisions: declinedBy,
			}),
		);

		const mayaCtx = await asUser('manager.maya');
		const page = await mayaCtx.newPage();
		const shell = await openSubmissionStage(page, submission.id);

		// The state scenario 6 ends in: declined at the desk, with the
		// manager-only Delete in the collapsed action column.
		await expect(
			shell.header().getByText('Declined', {exact: true}).first(),
		).toBeVisible({timeout: 20_000});
		await expect(shell.actionItems().getByRole('button')).toHaveText(
			DECLINED_RAIL_MANAGER,
		);

		// The manager notes the submission's web address first — it
		// cannot be recovered afterwards.
		const address = page.url();

		// Delete asks for confirmation: a dialog titled "Delete" with the
		// permanent-deletion question, Confirm and Cancel.
		await railButton(shell, 'Delete').click();
		const dialog = page
			.locator('[data-cy="dialog"]')
			.filter({hasText: DELETE_SUBMISSION_PROMPT})
			.first();
		await expect(dialog).toBeVisible({timeout: 10_000});
		await expect(
			dialog.getByRole('heading', {name: 'Delete', exact: true}),
		).toBeVisible();
		await expect(
			dialog.getByRole('button', {name: 'Cancel', exact: true}),
		).toBeVisible();
		await dialog
			.getByRole('button', {name: 'Confirm', exact: true})
			.click();

		// On Confirm the workflow panel closes.
		await expect(dialog).toHaveCount(0, {timeout: 20_000});
		await expect(shell.contentHeading('Workflow: Submission')).toHaveCount(0, {
			timeout: 20_000,
		});

		// …and the submission is gone from the editorial lists — the
		// Declined view it sat in still holds the control submission.
		const dash = new DashboardPage(page);
		await dash.gotoEditorial({view: 'declined'});
		await expect(dash.viewHeading(/Declined/)).toBeVisible({timeout: 20_000});
		await dash.search(token);
		await expect(dash.row(controlTitle)).toBeVisible({timeout: 20_000});
		await expect(dash.row(victimTitle)).toHaveCount(0);

		// The noted address: an empty workflow panel over "Invalid
		// submission." — no undo, no archive copy, nothing left to open.
		await page.goto(address, {waitUntil: 'commit'});
		const invalid = page
			.locator('[data-cy="dialog"]')
			.filter({hasText: INVALID_SUBMISSION_SENTENCE})
			.first();
		await expect(invalid).toBeVisible({timeout: 20_000});
		await expect(shell.contentHeading('Workflow: Submission')).toHaveCount(0);
		await expect(
			shell.modal().getByRole('table', {name: 'Submission Files'}),
		).toHaveCount(0);
		await expect(shell.actionItems()).toHaveCount(0);
	});
});
