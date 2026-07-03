// @ts-check
const {test, expect} = require('../support/fixtures.js');
const {
	ReviewerManagerPage,
} = require('../../lib/pkp/playwright/pages/ReviewerManagerPage.js');

/**
 * Assign and manage reviewers — one test per canonical scenario of
 * docs/product/specs/assign-and-manage-reviewers.md (12 scenarios →
 * 11 tests).
 *
 * The editor-side reviewer surface on the review stage: the Reviewers
 * grid (Vue `ReviewerManager`), the Add-Reviewer picker/assignment form,
 * and the per-reviewer management actions (unassign/cancel, reinstate,
 * resend, thank, edit). Every per-reviewer action opens a legacy jQuery
 * modal over the Vue list (spec rule 12); we drive those modals and
 * assert on the resulting API/DB state + Mailpit, never on toasts.
 *
 * Placement: OJS root. The reviewer manager itself ships from pkp-lib
 * (the `ReviewerManagerPage` POM lives there and is reused heavily), but
 * these tests lean on the `publicknowledge` journal, its seeded reviewer
 * cast, and the OJS scenario endpoints, so the spec belongs with the
 * journal-scoped OJS specs.
 *
 * Scenario mapping (see the per-test comments):
 *   1  → assign + send request
 *   2  → assign without emailing
 *   3  → create a brand-new reviewer at assignment
 *   4  → unassign an un-responded reviewer (hard delete)
 *   5  → cancel then reinstate an accepted reviewer
 *   6  → resend the request to a declined reviewer
 *   7  → thank a reviewer who completed
 *   8  → edit due dates on an active assignment
 *   9  → permission boundary (author refused / recommend-only manages)
 *   10 + 11 → the picker offering + approve-a-suggestion SEAM (folded —
 *             the full approve-a-suggestion mechanics are already
 *             exercised by reviewer-suggestions.spec.js scenarios 4/5/6,
 *             so scenario 11 here is a thin seam assertion only)
 *   12 → reviewer status reflects the lifecycle
 *
 * Seeding: reviewers are seeded directly into the needed state via the
 * submission scenario endpoint (`reviewRounds[].reviewers[].status`),
 * never by driving prior UI actions. The tag rides in the submission
 * title, which the management email bodies interpolate via
 * {$submissionTitle} — so every Mailpit assertion scopes by recipient +
 * `contains: tag` and stays parallel-safe.
 *
 * As-built realities respected (spec rules 6/7/8): unassigning an
 * un-responded reviewer HARD-deletes the row (test 4); a responded
 * reviewer soft-cancels and is reinstatable (test 5); resend is offered
 * only on a declined assignment (test 6); thank only on a completed one
 * (test 7).
 */

const STAGE_ID_REVIEW = 3; // WORKFLOW_STAGE_ID_EXTERNAL_REVIEW

// ReviewAssignment::REVIEW_ASSIGNMENT_STATUS_* (from getStatus()).
const STATUS = {
	AWAITING_RESPONSE: 0,
	DECLINED: 1,
	ACCEPTED: 5,
	COMPLETE: 8,
	THANKED: 9,
	CANCELLED: 10,
	REQUEST_RESEND: 11,
};

const EMAIL = {
	phudson: 'phudson@mailinator.com',
	jjanssen: 'jjanssen@mailinator.com',
	amccrae: 'amccrae@mailinator.com',
	agallego: 'agallego@mailinator.com',
};

// Management email subjects (locale en). {$contextName} is stripped to a
// leading phrase so the Mailpit subject filter is a stable substring.
const SUBJECT = {
	invitation: 'Invitation to review',
	cancel: 'Request for Review Cancelled',
	reinstate: 'Can you still review',
	resend: 'Requesting your review again',
	thank: 'Thank you for your review',
	edit: 'Your review assignment has been changed',
};

const MAIL_TIMEOUT = 30_000;

/** Unique, hyphenless alphanumeric tag — safe for Mailpit `contains` and email locals. */
function uniqueTag() {
	const workerIndex = test.info().parallelIndex;
	const suffix = Math.random().toString(36).slice(2, 8);
	return `amr${workerIndex}x${suffix}`;
}

/**
 * A submitted submission in external review (round 1) on
 * publicknowledge, with the tag woven into the title so it reaches the
 * management email bodies. dbarnes is the deciding editor; atester is
 * the author/submitter (needed for the author-permission boundary).
 *
 * @param {{tag: string, title: string, reviewers?: object[], participants?: object[], suggestions?: object[]}} opts
 */
function inReviewSpec({tag, title, reviewers = [], participants, suggestions}) {
	const spec = {
		tag,
		journal: 'publicknowledge',
		submitter: 'atester',
		section: 'ART',
		locale: 'en',
		participants: participants ?? [{user: 'dbarnes', role: 'editor'}],
		decisions: [{type: 'sendExternalReview', by: 'dbarnes'}],
		reviewRounds: [{reviewers}],
		publications: [{metadata: {title: {en: title}}}],
	};
	if (suggestions) {
		spec.reviewerSuggestions = suggestions;
	}
	return spec;
}

/** The first review round's fragment from the scenario response. */
function firstRound(result) {
	return result.reviewRounds[0];
}

/** The seeded reviewAssignmentId for a username in the scenario response. */
function assignmentIdFor(result, username) {
	const row = firstRound(result).reviewers.find((r) => r.username === username);
	if (!row) {
		throw new Error(`No seeded reviewer '${username}' in scenario response`);
	}
	return row.reviewAssignmentId;
}

test.use({user: 'dbarnes'}); // default actor: a senior editor of publicknowledge

test.describe('Assign and manage reviewers', () => {
	// Canonical scenario 1 — an editor on a review round clicks Add
	// Reviewer, locates a reviewer, accepts the default due dates + review
	// type, and submits: a Request Sent row appears and the reviewer gets
	// the "Invitation to review" email (spec rule 5).
	test(
		'assign a reviewer and send the request',
		{tag: ['@smoke', '@regression']},
		async ({page, pkpApi, pkpMail}) => {
			test.slow(); // Add Reviewer modal round-trip + TinyMCE + Mailpit
			const tag = uniqueTag();
			const {submission} = await pkpApi.createSubmission(
				inReviewSpec({tag, title: `AMR assign ${tag}`}),
			);

			const rm = new ReviewerManagerPage(page);
			await rm.gotoWorkflow(submission.id);

			const modal = await rm.openAddReviewerModal();
			await rm.searchSelectPanel(modal, 'phudson');
			const form = await rm.selectReviewer(modal, 'Paul Hudson');
			// The picker fetches the request body into personalMessage; wait
			// until it carries the tag (proves TinyMCE settled AND the sent
			// body will contain the tag for the Mailpit scope).
			await rm.awaitRichTextContains(form, 'personalMessage', tag);
			await rm.ensureDueDatesOrdered(form);
			await rm.submitLegacyForm(form, 'Add Reviewer', modal);

			// Request Sent row appears live.
			await expect(rm.row('Paul Hudson')).toContainText('Request Sent', {
				timeout: 20_000,
			});

			// DB round-trip: one assignment, Awaiting Response.
			const assignments = await rm.fetchReviewAssignments(submission.id);
			expect(assignments).toHaveLength(1);
			expect(assignments[0].statusId).toBe(STATUS.AWAITING_RESPONSE);

			// The invitation reached the reviewer.
			await pkpMail.find({
				to: EMAIL.phudson,
				contains: tag,
				subject: SUBJECT.invitation,
				timeoutMs: MAIL_TIMEOUT,
			});
		},
	);

	// Canonical scenario 2 — the same flow with "Do not send email to
	// Reviewer" ticked: the row is created but no invitation is sent (spec
	// rule 5 / the skipEmail flag suppresses only that action's email). A
	// second reviewer assigned WITHOUT skip is the bounded control that
	// proves the suppression is targeted, not global.
	test(
		'assign without emailing',
		{tag: '@regression'},
		async ({page, pkpApi, pkpMail}) => {
			test.slow(); // two Add Reviewer round-trips + Mailpit
			const tag = uniqueTag();
			const {submission} = await pkpApi.createSubmission(
				inReviewSpec({tag, title: `AMR skipmail ${tag}`}),
			);

			const rm = new ReviewerManagerPage(page);
			await rm.gotoWorkflow(submission.id);

			// Aisla McCrae — assign with skip-email ticked.
			let modal = await rm.openAddReviewerModal();
			await rm.searchSelectPanel(modal, 'amccrae');
			let form = await rm.selectReviewer(modal, 'Aisla McCrae');
			await rm.awaitRichTextContains(form, 'personalMessage', tag);
			await form.locator('#skipEmail').check();
			await rm.ensureDueDatesOrdered(form);
			await rm.submitLegacyForm(form, 'Add Reviewer', modal);
			await expect(rm.row('Aisla McCrae')).toContainText('Request Sent', {
				timeout: 20_000,
			});

			// Adela Gallego — the control: assign normally (email sent).
			modal = await rm.openAddReviewerModal();
			await rm.searchSelectPanel(modal, 'agallego');
			form = await rm.selectReviewer(modal, 'Adela Gallego');
			await rm.awaitRichTextContains(form, 'personalMessage', tag);
			await rm.ensureDueDatesOrdered(form);
			await rm.submitLegacyForm(form, 'Add Reviewer', modal);
			await expect(rm.row('Adela Gallego')).toContainText('Request Sent', {
				timeout: 20_000,
			});

			// Both rows exist (both Awaiting Response).
			const assignments = await rm.fetchReviewAssignments(submission.id);
			expect(assignments).toHaveLength(2);
			expect(
				assignments.every((a) => a.statusId === STATUS.AWAITING_RESPONSE),
			).toBe(true);

			// McCrae got no invitation; Gallego's arrival bounds the wait.
			await pkpMail.expectNone({
				to: EMAIL.amccrae,
				contains: tag,
				afterControl: {to: EMAIL.agallego, contains: tag},
			});
		},
	);

	// Canonical scenario 3 — from the picker the editor uses Create New
	// Reviewer, enters name/email/username, and assigns: a new reviewer
	// account is created, enrolled and put on the round, and the
	// invitation reaches the new address (spec Fields table / rule 5). The
	// backend refusal of this operation to assistants is asserted in
	// scenario 9.
	test(
		'create a brand-new reviewer at assignment',
		{tag: '@regression'},
		async ({page, pkpApi, pkpMail}) => {
			test.slow(); // create form + TinyMCE + Mailpit
			const tag = uniqueTag();
			const family = `Newby${tag}`;
			const username = `rev${tag}`.slice(0, 30);
			const email = `${username}@mailinator.com`;
			const {submission} = await pkpApi.createSubmission(
				inReviewSpec({tag, title: `AMR create ${tag}`}),
			);

			const rm = new ReviewerManagerPage(page);
			await rm.gotoWorkflow(submission.id);

			const modal = await rm.openAddReviewerModal();
			const createForm = await rm.openCreateReviewerForm(modal);
			await createForm.locator('input[name="givenName[en]"]').fill('Nadia');
			await createForm.locator('input[name="familyName[en]"]').fill(family);
			await createForm.locator('input[name="username"]').fill(username);
			await createForm.locator('input[name="email"]').fill(email);
			await createForm
				.locator('input[name="affiliation[en]"]')
				.fill(`Aff ${tag}`);
			const userGroupSelect = createForm.locator('select[name="userGroupId"]');
			if (await userGroupSelect.isVisible().catch(() => false)) {
				await userGroupSelect.selectOption({label: 'Reviewer'});
			}
			await rm.awaitRichTextContains(createForm, 'personalMessage', tag);
			await rm.ensureDueDatesOrdered(createForm);
			await rm.submitLegacyForm(createForm, 'Add Reviewer', modal);

			// The new reviewer is on the round.
			await expect(rm.manager).toContainText(`Nadia ${family}`, {
				timeout: 20_000,
			});
			const assignments = await rm.fetchReviewAssignments(submission.id);
			expect(assignments).toHaveLength(1);
			expect(assignments[0].statusId).toBe(STATUS.AWAITING_RESPONSE);

			// The invitation reached the newly-created account.
			await pkpMail.find({
				to: email,
				contains: tag,
				subject: SUBJECT.invitation,
				timeoutMs: MAIL_TIMEOUT,
			});
		},
	);

	// Canonical scenario 4 — for a reviewer still Request Sent the editor
	// picks Unassign Reviewer: the row is HARD-removed (no history, not
	// reinstatable — spec rule 6, as-built) and a cancellation email is
	// sent. We assert the row is GONE from the API (not merely cancelled),
	// which is the hard-delete reality that distinguishes an un-responded
	// unassign from a responded cancel (scenario 5).
	test(
		'unassign an un-responded reviewer',
		{tag: ['@smoke', '@regression']},
		async ({page, pkpApi, pkpMail}) => {
			test.slow();
			const tag = uniqueTag();
			const {submission} = await pkpApi.createSubmission(
				inReviewSpec({
					tag,
					title: `AMR unassign ${tag}`,
					reviewers: [{user: 'phudson', method: 'anonymous', status: 'invited'}],
				}),
			);

			const rm = new ReviewerManagerPage(page);
			await rm.gotoWorkflow(submission.id);
			await expect(rm.row('Paul Hudson')).toContainText('Request Sent');

			// The menu label for an un-responded reviewer is "Unassign
			// Reviewer" (dateConfirmed is null — spec rule 6).
			const modal = await rm.openRowAction(
				'Paul Hudson',
				'Unassign Reviewer',
				'Unassign Reviewer',
			);
			const form = await rm.legacyForm(modal, 'unassignReviewerForm');
			await rm.awaitRichTextContains(form, 'personalMessage', tag);
			await rm.submitLegacyForm(form, 'Unassign Reviewer', modal);

			// Hard delete: the row is gone entirely (not a Cancelled trace).
			await expect(rm.row('Paul Hudson')).toHaveCount(0, {timeout: 20_000});
			const assignments = await rm.fetchReviewAssignments(submission.id);
			expect(assignments).toHaveLength(0);

			// Cancellation email sent.
			await pkpMail.find({
				to: EMAIL.phudson,
				contains: tag,
				subject: SUBJECT.cancel,
				timeoutMs: MAIL_TIMEOUT,
			});
		},
	);

	// Canonical scenario 5 — for an ACCEPTED reviewer the editor picks
	// Cancel Reviewer (row becomes Request Cancelled, soft-cancel keeps the
	// row, cancellation email sent), then Reinstate Reviewer on that
	// cancelled row restores Request Accepted and sends the reinstate email
	// (spec rules 6/7). Same recipient for both emails, so the Mailpit
	// scope adds the subject to disambiguate.
	test(
		'cancel then reinstate an accepted reviewer',
		{tag: ['@smoke', '@regression']},
		async ({page, pkpApi, pkpMail}) => {
			test.slow(); // two modal round-trips + two Mailpit asserts
			const tag = uniqueTag();
			const {submission} = await pkpApi.createSubmission(
				inReviewSpec({
					tag,
					title: `AMR reinstate ${tag}`,
					reviewers: [{user: 'jjanssen', method: 'anonymous', status: 'accepted'}],
				}),
			);

			const rm = new ReviewerManagerPage(page);
			await rm.gotoWorkflow(submission.id);
			await expect(rm.row('Julie Janssen')).toContainText('Request Accepted');

			// Cancel — a responded reviewer soft-cancels (label is Cancel
			// Reviewer because dateConfirmed is set).
			let modal = await rm.openRowAction(
				'Julie Janssen',
				'Cancel Reviewer',
				'Cancel Reviewer',
			);
			let form = await rm.legacyForm(modal, 'unassignReviewerForm');
			await rm.awaitRichTextContains(form, 'personalMessage', tag);
			await rm.submitLegacyForm(form, 'Cancel Reviewer', modal);

			await expect(rm.row('Julie Janssen')).toContainText('Request Cancelled', {
				timeout: 20_000,
			});
			let assignments = await rm.fetchReviewAssignments(submission.id);
			expect(assignments).toHaveLength(1); // row kept (soft cancel)
			expect(assignments[0].statusId).toBe(STATUS.CANCELLED);
			await pkpMail.find({
				to: EMAIL.jjanssen,
				contains: tag,
				subject: SUBJECT.cancel,
				timeoutMs: MAIL_TIMEOUT,
			});

			// Reinstate — offered only on a cancelled assignment (rule 7).
			modal = await rm.openRowAction(
				'Julie Janssen',
				'Reinstate Reviewer',
				'Reinstate Reviewer',
			);
			form = await rm.legacyForm(modal, 'reinstateReviewerForm');
			await rm.awaitRichTextContains(form, 'personalMessage', tag);
			await rm.submitLegacyForm(form, 'Reinstate Reviewer', modal);

			await expect(rm.row('Julie Janssen')).toContainText('Request Accepted', {
				timeout: 20_000,
			});
			assignments = await rm.fetchReviewAssignments(submission.id);
			expect(assignments[0].statusId).toBe(STATUS.ACCEPTED);
			await pkpMail.find({
				to: EMAIL.jjanssen,
				contains: tag,
				subject: SUBJECT.reinstate,
				timeoutMs: MAIL_TIMEOUT,
			});
		},
	);

	// Canonical scenario 6 — a reviewer who DECLINED shows Request
	// Declined; the editor picks Resend Review Request (offered only on a
	// declined assignment — rule 8), adjusts the fresh due dates, and
	// sends: status becomes Request Resent and the reviewer gets the
	// "requesting again" email.
	test(
		'resend the request to a declined reviewer',
		{tag: '@regression'},
		async ({page, pkpApi, pkpMail}) => {
			test.slow();
			const tag = uniqueTag();
			const {submission} = await pkpApi.createSubmission(
				inReviewSpec({
					tag,
					title: `AMR resend ${tag}`,
					reviewers: [{user: 'amccrae', method: 'anonymous', status: 'declined'}],
				}),
			);

			const rm = new ReviewerManagerPage(page);
			await rm.gotoWorkflow(submission.id);
			await expect(rm.row('Aisla McCrae')).toContainText('Request Declined');

			const modal = await rm.openRowAction(
				'Aisla McCrae',
				'Resend Review Request',
				'Resend Review Request',
			);
			const form = await rm.legacyForm(modal, 'resendRequestReviewerForm');
			await rm.awaitRichTextContains(form, 'personalMessage', tag);
			await rm.ensureDueDatesOrdered(form); // resend resets & re-offers due dates
			await rm.submitLegacyForm(form, 'Resend Review Request', modal);

			// Status becomes Request Resent.
			await expect(rm.row('Aisla McCrae')).toContainText('Request Resent', {
				timeout: 20_000,
			});
			const assignments = await rm.fetchReviewAssignments(submission.id);
			expect(assignments[0].statusId).toBe(STATUS.REQUEST_RESEND);

			await pkpMail.find({
				to: EMAIL.amccrae,
				contains: tag,
				subject: SUBJECT.resend,
				timeoutMs: MAIL_TIMEOUT,
			});
		},
	);

	// Canonical scenario 7 — after the editor has read a submitted review
	// (status Complete — seeded), the inline Thank Reviewer primary action
	// sends the acknowledgement email and moves the row to Reviewer
	// Thanked; Revert Decision remains available (spec rule 9).
	test(
		'thank a reviewer who completed',
		{tag: ['@smoke', '@regression']},
		async ({page, pkpApi, pkpMail}) => {
			test.slow();
			const tag = uniqueTag();
			const {submission} = await pkpApi.createSubmission(
				inReviewSpec({
					tag,
					title: `AMR thank ${tag}`,
					reviewers: [
						{
							user: 'agallego',
							method: 'anonymous',
							status: 'completed',
							recommendation: 'accept',
						},
					],
				}),
			);

			const rm = new ReviewerManagerPage(page);
			await rm.gotoWorkflow(submission.id);
			await expect(rm.row('Adela Gallego')).toContainText('Complete');

			// Thank Reviewer + Revert Decision are inline primary actions on
			// a Complete review.
			const row = rm.row('Adela Gallego');
			await expect(
				row.getByRole('button', {name: 'Revert Decision'}),
			).toBeVisible();

			const modal = await rm.clickRowPrimaryAction(
				'Adela Gallego',
				'Thank Reviewer',
				'Thank Reviewer',
			);
			// The thank form's rich-text field is `message` (not
			// personalMessage) and the form id is sendThankYouForm.
			const form = await rm.legacyForm(modal, 'sendThankYouForm');
			await rm.awaitRichTextContains(form, 'message', tag);
			await rm.submitLegacyForm(form, 'Thank Reviewer', modal);

			// Row moves to Reviewer Thanked; Revert Decision remains.
			await expect(rm.row('Adela Gallego')).toContainText('Reviewer Thanked', {
				timeout: 20_000,
			});
			await expect(
				rm.row('Adela Gallego').getByRole('button', {name: 'Revert Decision'}),
			).toBeVisible();

			const assignments = await rm.fetchReviewAssignments(submission.id);
			expect(assignments[0].statusId).toBe(STATUS.THANKED);

			await pkpMail.find({
				to: EMAIL.agallego,
				contains: tag,
				subject: SUBJECT.thank,
				timeoutMs: MAIL_TIMEOUT,
			});
		},
	);

	// Canonical scenario 8 — the editor opens Edit, changes the review due
	// date, and saves: because a due date actually changed, the reviewer
	// gets the edit-notify email (spec rule 10) and the new date persists.
	//
	// NOTE: the "changing nothing sends nothing" half of scenario 8 is not
	// asserted here. EditReviewForm compares `strtotime(stored)` (seeded
	// dateDue carries a 23:59:59 time-of-day) against the datepicker's
	// date-only post, so a UI no-op save can register as a change and fire
	// the email — a true no-op is not reliably reachable through the modal.
	// See the return notes (spec caveat).
	test(
		'edit due dates on an active assignment',
		{tag: '@regression'},
		async ({page, pkpApi, pkpMail}) => {
			test.slow();
			const tag = uniqueTag();
			const {submission} = await pkpApi.createSubmission(
				inReviewSpec({
					tag,
					title: `AMR edit ${tag}`,
					reviewers: [{user: 'jjanssen', method: 'anonymous', status: 'accepted'}],
				}),
			);

			const rm = new ReviewerManagerPage(page);
			await rm.gotoWorkflow(submission.id);
			await expect(rm.row('Julie Janssen')).toContainText('Request Accepted');

			const {modal, form} = await rm.openEditReviewModal('Julie Janssen');

			// Read the current review due date (datepicker altField = Y-m-d)
			// and push it out a week — an unambiguous change.
			const reviewDueHidden = form
				.locator('input[name="reviewDueDate"]')
				.last();
			await expect(reviewDueHidden).toHaveValue(/\d{4}-\d{2}-\d{2}/);
			const current = await reviewDueHidden.inputValue();
			const bumped = new Date(`${current}T00:00:00Z`);
			bumped.setUTCDate(bumped.getUTCDate() + 7);
			const newReviewDue = bumped.toISOString().slice(0, 10);
			await rm.setDatepickerDate(form, 'reviewDueDate', newReviewDue);

			await rm.submitLegacyForm(form, 'OK', modal);

			// The changed due date persisted (summary dateDue is Y-m-d).
			await expect
				.poll(
					async () => {
						const a = await rm.fetchReviewAssignments(submission.id);
						return a[0]?.dateDue;
					},
					{timeout: 20_000},
				)
				.toBe(newReviewDue);

			// The edit-notify email fired because a date changed.
			await pkpMail.find({
				to: EMAIL.jjanssen,
				contains: tag,
				subject: SUBJECT.edit,
				timeoutMs: MAIL_TIMEOUT,
			});
		},
	);

	// Canonical scenario 9 — permission boundary. A recommend-only section
	// editor manages reviewers normally (the grid does NOT gate on the
	// recommend-only flag); an author (the submitter) is refused every
	// management operation even though they can reach the stage. Asserted
	// through observable outcomes: a real UI assignment by the
	// recommend-only editor, and the legacy grid handler's authorization
	// verdict (JSONMessage status) for author vs editor.
	//
	// The assistant sub-case (backend refuses createReviewer/enrollReviewer
	// — spec Open Question 6) is descoped: a default copyeditor group is
	// not assigned to the review stage, so seeding a review-stage assistant
	// needs group surgery beyond this file's scope. The op-removal is
	// verified in code (PKPReviewerGridHandler::__construct) and flagged
	// unverified-in-UI by the spec itself.
	test(
		'permission boundary — recommend-only editor manages, author refused',
		{tag: '@regression'},
		async ({pkpApi, asUser}) => {
			test.slow(); // scenario seed + two actor contexts + a UI assignment
			const tag = uniqueTag();
			const {submission, ...result} = await pkpApi.createSubmission(
				inReviewSpec({
					tag,
					title: `AMR perms ${tag}`,
					// minoue is a Reviews-section editor, so NOT auto-assigned to
					// this ART submission — the recommendOnly flag sticks
					// (ParticipantProcessor build() is firstOr; a colliding
					// auto-assign would drop the flag).
					participants: [
						{user: 'dbarnes', role: 'editor'},
						{user: 'minoue', role: 'sectionEditor', recommendOnly: true},
					],
					reviewers: [
						{user: 'jjanssen', method: 'anonymous', status: 'invited'},
					],
				}),
			);
			const fullResult = {submission, ...result};
			const janssenAssignmentId = assignmentIdFor(fullResult, 'jjanssen');

			// A recommend-only section editor adds a reviewer through the UI.
			const editorCtx = await asUser('minoue');
			const editorPage = await editorCtx.newPage();
			const rm = new ReviewerManagerPage(editorPage);
			await rm.gotoWorkflow(submission.id);

			const modal = await rm.openAddReviewerModal();
			await rm.searchSelectPanel(modal, 'phudson');
			const form = await rm.selectReviewer(modal, 'Paul Hudson');
			await rm.ensureDueDatesOrdered(form);
			await rm.submitLegacyForm(form, 'Add Reviewer', modal);
			await expect(rm.row('Paul Hudson')).toContainText('Request Sent', {
				timeout: 20_000,
			});

			// The legacy grid handler's authorize() verdict, read straight
			// off the JSONMessage: allowed for the (recommend-only) editor,
			// refused for the author. unassign-reviewer is a read-only GET
			// (renders the confirm form) — no state mutation.
			const gridUrl = (op, params) => {
				const qs = new URLSearchParams({
					submissionId: String(submission.id),
					stageId: String(STAGE_ID_REVIEW),
					...params,
				});
				return `/index.php/publicknowledge/$$$call$$$/grid/users/reviewer/reviewer-grid/${op}?${qs}`;
			};

			const editorVerdict = await editorPage.request.get(
				gridUrl('unassign-reviewer', {
					reviewAssignmentId: String(janssenAssignmentId),
				}),
			);
			expect((await editorVerdict.json()).status).toBe(true);

			const authorCtx = await asUser('atester');
			const authorPage = await authorCtx.newPage();
			const authorVerdict = await authorPage.request.get(
				gridUrl('unassign-reviewer', {
					reviewAssignmentId: String(janssenAssignmentId),
				}),
			);
			expect((await authorVerdict.json()).status).toBe(false);
		},
	);

	// Canonical scenario 10 (+ 11 folded) — the Add Reviewer picker offers
	// the journal's reviewers with workload data, marks reviewers already
	// on the round as non-selectable, and lists only reviewer-role users
	// (spec rule 4). When reviewer suggestions are on, a suggestions
	// section sits above the list — the seam into `reviewer-suggestions`
	// (scenario 11). The full approve-a-suggestion mechanics are already
	// covered by reviewer-suggestions.spec.js scenarios 4/5/6, so scenario
	// 11 is a thin seam assertion here, NOT a re-test.
	test(
		'the picker offering and the suggestions seam',
		{tag: '@regression'},
		async ({page, pkpApi}) => {
			test.slow();
			const tag = uniqueTag();
			const {submission} = await pkpApi.createSubmission(
				inReviewSpec({
					tag,
					title: `AMR picker ${tag}`,
					reviewers: [
						{user: 'jjanssen', method: 'anonymous', status: 'accepted'},
						{user: 'phudson', method: 'anonymous', status: 'invited'},
					],
					suggestions: [
						{
							givenName: 'Sam',
							familyName: `Suggested${tag}`,
							email: `sam.${tag}@mailinator.com`,
							affiliation: `Aff ${tag}`,
							suggestionReason: `Reason ${tag}`,
						},
					],
				}),
			);

			const rm = new ReviewerManagerPage(page);
			await rm.gotoWorkflow(submission.id);
			const modal = await rm.openAddReviewerModal();

			// Two select panels: the suggestions section above "Locate a
			// Reviewer" (the seam — scenario 11).
			const panels = modal.locator('.listPanel--selectReviewer');
			await expect(panels).toHaveCount(2, {timeout: 15_000});
			await expect(
				panels.first().getByRole('heading', {
					name: 'Select a Reviewer from Reviewer Suggestions',
				}),
			).toBeVisible();
			await expect(
				panels.last().getByRole('heading', {name: 'Locate a Reviewer'}),
			).toBeVisible();

			// A reviewer NOT on the round is selectable (workload-listed).
			const list = rm.selectPanel(modal);
			await rm.searchSelectPanel(modal, 'amccrae');
			await expect(
				list.getByRole('button', {name: 'Select Aisla McCrae', exact: true}),
			).toBeVisible({timeout: 15_000});

			// A reviewer already on the round appears but is non-selectable.
			await rm.searchSelectPanel(modal, 'jjanssen');
			await expect(list).toContainText(
				'This reviewer has already been assigned to this review round.',
				{timeout: 15_000},
			);
			await expect(
				list.getByRole('button', {name: 'Select Julie Janssen', exact: true}),
			).toHaveCount(0);

			// Only reviewer-role users are offered — a pure editor
			// (dbuskins, no Reviewer role) never appears in the candidate list.
			await rm.searchSelectPanel(modal, 'dbuskins');
			await expect(
				list.getByRole('button', {name: /^Select /}),
			).toHaveCount(0, {timeout: 15_000});
		},
	);

	// Canonical scenario 12 — across a round the grid shows the lifecycle
	// (Request Sent / Request Accepted / Complete / Request Declined), each
	// with the right per-status action menu: an un-responded reviewer
	// offers Unassign (not Cancel); an accepted one offers Cancel; a
	// declined one offers Resend; a completed one offers the inline Thank +
	// Revert primary actions (spec rules 2 & 6–9).
	test(
		'reviewer status reflects the lifecycle',
		{tag: ['@smoke', '@regression']},
		async ({page, pkpApi}) => {
			test.slow();
			const tag = uniqueTag();
			const {submission} = await pkpApi.createSubmission(
				inReviewSpec({
					tag,
					title: `AMR lifecycle ${tag}`,
					reviewers: [
						{user: 'phudson', method: 'anonymous', status: 'invited'},
						{user: 'jjanssen', method: 'anonymous', status: 'accepted'},
						{
							user: 'agallego',
							method: 'anonymous',
							status: 'completed',
							recommendation: 'accept',
						},
						{user: 'amccrae', method: 'anonymous', status: 'declined'},
					],
				}),
			);

			const rm = new ReviewerManagerPage(page);
			await rm.gotoWorkflow(submission.id);

			// Status labels, one row per state.
			await expect(rm.row('Paul Hudson')).toContainText('Request Sent');
			await expect(rm.row('Julie Janssen')).toContainText('Request Accepted');
			await expect(rm.row('Adela Gallego')).toContainText('Complete');
			await expect(rm.row('Aisla McCrae')).toContainText('Request Declined');

			// Complete → inline Thank + Revert primary actions.
			await expect(
				rm.row('Adela Gallego').getByRole('button', {name: 'Thank Reviewer'}),
			).toBeVisible();
			await expect(
				rm.row('Adela Gallego').getByRole('button', {name: 'Revert Decision'}),
			).toBeVisible();

			// Un-responded → Unassign Reviewer, never Cancel Reviewer.
			await rm
				.row('Paul Hudson')
				.getByRole('button', {name: 'More Actions'})
				.click();
			await expect(
				page.getByRole('menuitem', {name: 'Unassign Reviewer', exact: true}),
			).toBeVisible();
			await expect(
				page.getByRole('menuitem', {name: 'Cancel Reviewer', exact: true}),
			).toHaveCount(0);
			await page.keyboard.press('Escape');

			// Accepted (responded) → Cancel Reviewer.
			await rm
				.row('Julie Janssen')
				.getByRole('button', {name: 'More Actions'})
				.click();
			await expect(
				page.getByRole('menuitem', {name: 'Cancel Reviewer', exact: true}),
			).toBeVisible();
			await page.keyboard.press('Escape');

			// Declined → Resend Review Request offered.
			await rm
				.row('Aisla McCrae')
				.getByRole('button', {name: 'More Actions'})
				.click();
			await expect(
				page.getByRole('menuitem', {
					name: 'Resend Review Request',
					exact: true,
				}),
			).toBeVisible();
			await page.keyboard.press('Escape');
		},
	);
});
