// @ts-check
const {test, expect} = require('../support/fixtures.js');
const {EditorialWorkflowPage} = require('../pages/EditorialWorkflowPage.js');
const {
	ActivityLogModal,
} = require('../../lib/pkp/playwright/pages/ActivityLogModal.js');
const {
	FileStagePanel,
} = require('../../lib/pkp/playwright/pages/FileStagePanel.js');
const {
	waitForJQueryIdle,
} = require('../../lib/pkp/playwright/support/jquery.js');

/**
 * Editorial activity log — the event-log READ surface. One test per
 * canonical scenario of docs/product/specs/editorial-activity-log.md
 * (5 scenarios → 4 tests): scenario 5 ("the missing file-metadata edit,
 * row-85") is MERGED into scenario 2 ("the file Information Center tabs")
 * — both open the same file Information Center, so one test drives the
 * file's Notes/History tabs AND asserts the row-85 asymmetry (the edit is
 * present in the file History but ABSENT from the submission Activity Log)
 * in a single pass over the two surfaces.
 *
 * This spec owns the two places the append-only event log is read:
 *   - the per-submission "Activity Log & Notes" modal (workflow header),
 *     driven through the shared ActivityLogModal POM (lib/pkp);
 *   - the per-file Information Center (file row → "More Information"),
 *     driven through FileStagePanel#openInformationCenter (lib/pkp).
 * It does NOT own the events themselves — decisions, reviewer moves, file
 * edits and participant changes are fired by their own features; here they
 * are only rendered. The sibling specs generate those events
 * (editorial-decisions, stage-participants, submission-files); this spec
 * seeds equivalent history via the scenario API and reads it back.
 *
 * IMPORTANT (verified against port 8000, the TEST DB — not the dev DB the
 * spec author partially drove):
 *   - Merged EMAIL rows DO appear from seeding: a seeded decision carrying
 *     `toAuthor` runs NotifyAuthors::sendAuthorEmail, whose
 *     Repo::emailLogEntry()->logMailable() writes the email_log row
 *     UNCONDITIONALLY (after Mail::send, which Mail::fake() no-ops). So the
 *     History merge (event_log ∪ email_log, date-desc) is exercised without
 *     driving a live decision. (Reviewer-assign email_log rows, by
 *     contrast, are skipped by the scenario processor — only the
 *     event-log row is written — so we assert the reviewer EVENT row, not
 *     an email row, for that action.)
 *   - There is NO Email tab; emails are merged INTO the History grid as
 *     rows prefixed "An email has been sent:" and expand via "View Email".
 *   - row-85: submission-files' Repository::edit() writes the file-assoc
 *     fileEdited event but drops the paired submission-assoc one, so a file
 *     rename shows in the FILE Information Center History but NOT the
 *     submission Activity Log. Test 2 asserts that asymmetry.
 *
 * Parallel-safety: tags are single hyphenless alphanumeric tokens; every
 * submission is per-test and opened by the id the scenario API returns;
 * Mailpit is never touched (the email evidence is read from the in-app
 * History grid, not the inbox).
 */

// Workflow stage constant (PKPApplication WORKFLOW_STAGE_ID_SUBMISSION).
const STAGE_SUBMISSION = 1;

// The seeded Article Text file every scenario submission carries.
const SEEDED_FILE = 'default-article.pdf';
const PANEL_SUBMISSION_FILES = 'Submission Files';

// Seeded users (full display names + @mailinator addresses).
const USER = {
	dbarnes: {name: 'Daniel Barnes', email: 'dbarnes@mailinator.com'},
	atester: {name: 'Author Tester', email: 'atester@mailinator.com'},
	jjanssen: {name: 'Julie Janssen', email: 'jjanssen@mailinator.com'},
	mfritz: {name: 'Maria Fritz', email: 'mfritz@mailinator.com'},
};

/** A unique, hyphenless, alphanumeric tag (parallel isolation). */
function uniqueTag() {
	const workerLetter = String.fromCharCode(97 + (test.info().parallelIndex % 26));
	let suffix = '';
	while (suffix.length < 6) {
		suffix += Math.random().toString(36).replace(/[^a-z0-9]/g, '');
	}
	return `eal${workerLetter}${suffix.slice(0, 6)}`;
}

/**
 * A submitted, stage-1 submission on publicknowledge carrying the standard
 * seeded Article Text file. `submitted: true` fires the real submit (so the
 * submission log gains "Initial submission completed" + "Submission
 * metadata updated" events and the ART section editors auto-assign); dbarnes
 * is the deciding editor, atester the author.
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
 * A submitted submission sent to external review, round 1, with an invited
 * reviewer (jjanssen). The sendExternalReview decision carries `toAuthor`,
 * so NotifyAuthors writes an email_log row (assoc submission) that the
 * History grid merges in — giving the reader a decision log row, a reviewer
 * assignment row AND an email row from one cheap seed.
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
		submitted: true,
		participants: [{user: 'dbarnes', role: 'editor'}],
		decisions: [
			{
				type: 'sendExternalReview',
				by: 'dbarnes',
				toAuthor: `<p>Your manuscript is going to review — ${tag}</p>`,
			},
		],
		reviewRounds: [
			{reviewers: [{user: 'jjanssen', method: 'anonymous', status: 'invited'}]},
		],
		publications: [{metadata: {title: {en: title}}}],
	};
}

/**
 * A copyediting-stage submission (submitted → skipExternalReview) with an
 * assigned copyeditor (mfritz), so an ASSISTANT can open the Copyediting
 * pane — the setting for the assistant permission-boundary check.
 *
 * @param {{tag: string, title: string}} opts
 */
function copyeditingSpec({tag, title}) {
	return {
		tag,
		journal: 'publicknowledge',
		submitter: 'atester',
		section: 'ART',
		locale: 'en',
		submitted: true,
		participants: [
			{user: 'dbarnes', role: 'editor'},
			{user: 'mfritz', role: 'copyeditor'},
		],
		decisions: [{type: 'skipExternalReview', by: 'dbarnes'}],
		publications: [{metadata: {title: {en: title}}}],
	};
}

/** The author's My-Submissions deep link that mounts the workflow modal. */
function mySubmissionsLink(submissionId, journalPath = 'publicknowledge') {
	return `/index.php/${journalPath}/en/dashboard/mySubmissions?workflowSubmissionId=${submissionId}`;
}

/** The editorial-dashboard deep link that mounts the workflow modal. */
function editorialLink(submissionId, journalPath = 'publicknowledge') {
	return `/index.php/${journalPath}/en/dashboard/editorial?workflowSubmissionId=${submissionId}`;
}

test.use({user: 'dbarnes'}); // the assigned editor (manager scope)

test.describe('Editorial activity log — the event-log read surface', () => {
	// Canonical scenario 1 — an editor opens the submission Activity Log and
	// reads the merged history: the "Activity Log & Notes" modal opens on the
	// History tab with Date/User/Event columns; decisions, the reviewer
	// assignment and sent-email rows interleave newest-first; an email row
	// expands to its body via "View Email".
	test(
		'editor reads the submission Activity Log',
		{tag: ['@smoke', '@regression']},
		async ({page, pkpApi}) => {
			const tag = uniqueTag();
			const {submission} = await pkpApi.createSubmission(
				inReviewSpec({tag, title: `Activity log read ${tag}`}),
			);

			const workflow = new EditorialWorkflowPage(page);
			await workflow.goto(submission.id);
			await expect(
				workflow.workflowModal().getByRole('heading', {name: /Workflow:/}),
			).toBeVisible({timeout: 20_000});

			const activityLog = new ActivityLogModal(page);
			await activityLog.openFromWorkflow();
			await activityLog.openHistoryTab();

			// The three-column grid header: Date / User / Event.
			for (const label of ['Date', 'User', 'Event']) {
				await expect(
					activityLog.historyGrid.getByRole('columnheader', {name: label}),
				).toBeVisible({timeout: 15_000});
			}

			// Event-log rows: the decision, the reviewer assignment and the
			// metadata update are all present in one merged stream. (The
			// scenario submit persists "Submission metadata updated" rows AND
			// the submit event, which OJS renders "Article submitted"
			// [locale override of pkp-lib's "Initial submission completed"];
			// this test asserts the metadata-update row's presence and does
			// not depend on either label.)
			await expect(
				activityLog.historyRow(/sent this submission to the review stage/).first(),
			).toBeVisible({timeout: 15_000});
			await expect(
				activityLog
					.historyRow(/Julie Janssen has been assigned to review/)
					.first(),
			).toBeVisible({timeout: 15_000});
			await expect(
				activityLog.historyRow(/Submission metadata updated/).first(),
			).toBeVisible({timeout: 15_000});

			// Merged EMAIL rows — sent mail rendered "An email has been sent: …"
			// (owned by email-delivery, read here) interleave with the events.
			const emailRow = activityLog
				.historyRow(/An email has been sent/)
				.first();
			await expect(emailRow).toBeVisible({timeout: 15_000});

			// Ordering: the merged stream is date-descending (documented
			// guarantee — the submission grid re-sorts by date after merging
			// emails). Read every row's Date cell and assert non-increasing.
			// (All seeded events share the seed day, so this is a structural
			// check; the strong newest-first proof is in the add-note test,
			// where a genuinely-newest row lands at the top.)
			const dates = await historyDatesDesc(activityLog);
			const sorted = [...dates].sort((a, b) => (a < b ? 1 : a > b ? -1 : 0));
			expect(dates).toEqual(sorted);

			// Expand an email row → the "View Email" modal renders the email's
			// From/To/Subject/body (proof the row expands to its content).
			const emailModal = await expandEmailRow(page, activityLog, emailRow);
			await expect(emailModal).toContainText(/mailinator\.com/i, {
				timeout: 15_000,
			});
		},
	);

	// Canonical scenarios 2 + 5 (MERGED) — the file Information Center tabs,
	// and the row-85 asymmetry. From a file's row menu an editor opens "More
	// Information"; the file's Information Center shows a Notes tab and a
	// History tab scoped to THAT file. After renaming the file (a metadata
	// edit), the fileEdited event appears in the FILE History — but is ABSENT
	// from the submission Activity Log, because submission-files'
	// Repository::edit() drops the paired submission-assoc entry (row-85).
	test(
		'the file Information Center tabs — and the missing file-metadata edit (row-85)',
		{tag: '@regression'},
		async ({page, pkpApi}) => {
			test.slow(); // legacy edit-metadata modal + two info-center drives
			const tag = uniqueTag();
			const {submission} = await pkpApi.createSubmission(
				submittedSpec({tag, title: `File info center ${tag}`}),
			);

			const workflow = new EditorialWorkflowPage(page);
			await workflow.goto(submission.id);
			const panel = new FileStagePanel(page, PANEL_SUBMISSION_FILES);
			await panel.expectVisible();

			// Rename the seeded file → writes a file-assoc fileEdited event.
			const newName = `Renamed ${tag}.pdf`;
			const editModal = await panel.openEditModal(SEEDED_FILE);
			await panel.editModalNameInput(editModal).fill(newName);
			await panel.saveEditModal(editModal);
			await expect(panel.row(newName)).toBeVisible({timeout: 20_000});

			// --- The FILE Information Center: Notes + History tabs, scoped to
			// this one file; the edit shows in its History. ---
			const info = await panel.openInformationCenter(newName);
			// Both tabs are offered (jQuery-UI TabHandler anchors).
			await expect(
				info.getByRole('link', {name: 'Notes', exact: true}),
			).toBeVisible({timeout: 15_000});
			const fileHistoryTab = info.getByRole('link', {
				name: 'History',
				exact: true,
			});
			await expect(fileHistoryTab).toBeVisible({timeout: 15_000});
			await fileHistoryTab.click();
			await waitForJQueryIdle(page);
			// The file's History carries the metadata-edit event.
			await expect(info.getByText(/was edited/i).first()).toBeVisible({
				timeout: 15_000,
			});
			await panel.closeModal(info);

			// --- The submission Activity Log: the file edit is ABSENT (row-85).
			const activityLog = new ActivityLogModal(page);
			await activityLog.openFromWorkflow();
			await activityLog.openHistoryTab();
			// The submission log DID load real events (sanity — so the absence
			// below is meaningful, not an empty grid).
			await expect(
				activityLog.historyRow(/Submission metadata updated/).first(),
			).toBeVisible({timeout: 15_000});
			// …but the file-metadata edit never reaches the submission log.
			await expect(activityLog.historyRow(/was edited/i)).toHaveCount(0);
		},
	);

	// Canonical scenario 3 — the permission boundary. The assigned editor
	// sees the Activity Log button; the author on their own submission sees
	// none (button count 0); an assistant (copyeditor) on the Copyediting
	// pane sees none either (they reach only the file Information Center); a
	// reviewer never reaches the editorial workflow view at all.
	test(
		'permission boundary — who can and cannot open the Activity Log',
		{tag: ['@smoke', '@regression']},
		async ({page, pkpApi, asUser}) => {
			test.slow(); // four actors across two seeds
			const tag = uniqueTag();
			const {submission: review} = await pkpApi.createSubmission(
				inReviewSpec({tag, title: `Perm review ${tag}`}),
			);

			// Editor (dbarnes, the default page user): the button renders.
			const editorLog = new ActivityLogModal(page);
			await page.goto(editorialLink(review.id), {waitUntil: 'commit'});
			await expect(
				new EditorialWorkflowPage(page)
					.workflowModal()
					.getByRole('heading', {name: /Workflow:/}),
			).toBeVisible({timeout: 20_000});
			await expect(editorLog.openButton).toBeVisible({timeout: 15_000});

			// Author (atester): no Activity Log button on their own submission.
			const authorCtx = await asUser('atester');
			const authorPage = await authorCtx.newPage();
			await authorPage.goto(mySubmissionsLink(review.id), {waitUntil: 'commit'});
			await expect(
				authorPage.getByRole('heading', {name: /Workflow:/}),
			).toBeVisible({timeout: 20_000});
			await expect(
				new ActivityLogModal(authorPage).openButton,
			).toHaveCount(0);

			// Reviewer (jjanssen): never reaches the editorial workflow view —
			// the editorial deep link exposes no Activity Log button.
			const reviewerCtx = await asUser('jjanssen');
			const reviewerPage = await reviewerCtx.newPage();
			await reviewerPage.goto(editorialLink(review.id), {waitUntil: 'commit'});
			await expect(
				new ActivityLogModal(reviewerPage).openButton,
			).toHaveCount(0, {timeout: 20_000});

			// Assistant (mfritz, copyeditor): opens the Copyediting pane but
			// has no SUBMISSION Activity Log button (they reach only the file
			// Information Center).
			const {submission: copyediting} = await pkpApi.createSubmission(
				copyeditingSpec({tag, title: `Perm copyedit ${tag}`}),
			);
			const mfritzCtx = await asUser('mfritz');
			const mfritzPage = await mfritzCtx.newPage();
			await mfritzPage.goto(editorialLink(copyediting.id), {waitUntil: 'commit'});
			await expect(
				mfritzPage.getByRole('heading', {name: 'Workflow: Copyediting'}),
			).toBeVisible({timeout: 20_000});
			await expect(
				new ActivityLogModal(mfritzPage).openButton,
			).toHaveCount(0);
		},
	);

	// Canonical scenario 4 — add an internal note. An editor opens the Notes
	// tab, types a note and saves; the note appears in the Notes list, and it
	// is itself logged as a "Posted new note." entry in the History tab —
	// which, being the newest event, sits at the TOP of the newest-first
	// stream (above the seeded "Initial submission completed" row).
	test(
		'add an internal note — it appears in Notes and logs a notePosted event',
		{tag: '@regression'},
		async ({page, pkpApi}) => {
			const tag = uniqueTag();
			const {submission} = await pkpApi.createSubmission(
				submittedSpec({tag, title: `Add note ${tag}`}),
			);

			const workflow = new EditorialWorkflowPage(page);
			await workflow.goto(submission.id);
			await expect(
				workflow.workflowModal().getByRole('heading', {name: /Workflow:/}),
			).toBeVisible({timeout: 20_000});

			const activityLog = new ActivityLogModal(page);
			await activityLog.openFromWorkflow();
			await activityLog.openNotesTab();

			const noteText = `Internal editorial note — ${tag}`;
			await activityLog.addNote(noteText); // asserts the note renders in the list

			// The note is logged in the History tab as a notePosted event…
			await activityLog.openHistoryTab();
			const noteRow = activityLog.historyRow(/Posted new note/).first();
			await expect(noteRow).toBeVisible({timeout: 15_000});

			// …and, being the newest event, it sits ABOVE an older seeded
			// event (newest-first ordering, proven with a genuinely-newest row).
			const olderRow = activityLog
				.historyRow(/Submission metadata updated/)
				.first();
			await expect(olderRow).toBeVisible({timeout: 15_000});
			const noteBox = await noteRow.boundingBox();
			const olderBox = await olderRow.boundingBox();
			expect(noteBox).toBeTruthy();
			expect(olderBox).toBeTruthy();
			expect(noteBox.y).toBeLessThan(olderBox.y);
		},
	);
});

/**
 * Read the History grid's Date column top-to-bottom. The date is pulled by
 * regex from each row's text rather than positionally: rows carrying a row
 * action (email / file-upload rows) prepend a "Settings" gear cell, so the
 * date is not always the first <td>. Rows without a date (header / control
 * rows) are skipped.
 *
 * @param {ActivityLogModal} activityLog
 * @returns {Promise<string[]>}
 */
async function historyDatesDesc(activityLog) {
	const rows = activityLog.historyGrid.locator('table tr');
	const count = await rows.count();
	const dates = [];
	for (let i = 0; i < count; i++) {
		const text = (await rows.nth(i).textContent()) || '';
		const match = text.match(/\d{4}-\d{2}-\d{2}/);
		if (match) {
			dates.push(match[0]);
		}
	}
	return dates;
}

/**
 * Expand a History email row and return the resulting "View Email" AjaxModal.
 * Legacy pkp grids hide a row's link actions behind the "Settings" gear
 * (`a.show_extras`) and render them in the immediately-following control
 * row — so reveal the gear, then click "View Email" in that sibling row.
 *
 * @param {import('@playwright/test').Page} page
 * @param {ActivityLogModal} activityLog
 * @param {import('@playwright/test').Locator} emailRow
 * @returns {Promise<import('@playwright/test').Locator>}
 */
async function expandEmailRow(page, activityLog, emailRow) {
	await emailRow.locator('a.show_extras').first().click();
	await waitForJQueryIdle(page);
	const controlRow = emailRow.locator('xpath=following-sibling::tr[1]');
	const viewEmail = controlRow.getByRole('link', {
		name: 'View Email',
		exact: true,
	});
	await expect(viewEmail).toBeVisible({timeout: 10_000});
	await viewEmail.click();
	await waitForJQueryIdle(page);
	const emailModal = page.getByRole('dialog', {name: 'View Email'});
	await expect(emailModal).toBeVisible({timeout: 15_000});
	return emailModal;
}
