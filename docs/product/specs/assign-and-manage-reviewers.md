---
name: assign-and-manage-reviewers
scope: The editor's reviewer-management surface on the review stage — the grid of assigned reviewers and their live status, the Add-Reviewer flow (search/select picker → assignment form with due dates, review type, review form, request email), and the per-reviewer management actions (unassign/cancel, reinstate, resend, thank, edit due dates, review details, history)
shared: pkp-lib
status: verified
e2e-plans: [reviewer-assignment.md]
atlas-claims:
  - VUE-reviewer-manager
  - VUE-select-reviewer-list-panel
  - GRID-grid-users-reviewer-reviewer-grid-handler
  - DB-review_assignments
  - DB-review_assignment_settings
  - SCHEMA-review-assignment
  - MAIL-review-request
  - MAIL-review-request-subsequent
  - MAIL-reviewer-reinstate
  - MAIL-reviewer-resend-request
  - MAIL-reviewer-unassign
  - NOTIF-review-assignment
  - NOTIF-review-assignment-updated
  - EVLOG-REV-ASSIGN
  - EVLOG-REV-CLR
  - EVLOG-REV-REIN
  - EVLOG-REV-CONF
  - EVLOG-REV-UNCON
  - AUTHZ-review-assignment-required-policy
---

# Assign and manage reviewers

## Purpose

Once a submission is in **external review** (stage 3, opened by the Send-for-Review
decision), an editor's core job is to find peer reviewers, invite them, and shepherd each
invitation through its lifecycle. This spec owns that editor-side surface: the **Reviewers**
grid inside a review round (the list of assigned reviewers, each with a live status and a
per-reviewer actions menu), the **Add Reviewer** flow (a search/filter picker of the
journal's reviewers → an assignment form for due dates, review type, an optional review
form, and the invitation email), and the management actions an editor performs on an
existing assignment — **unassign/cancel**, **reinstate**, **resend the request**, **thank**,
**edit due dates/files/method**, **review details**, and **history**. It is *not* the
reviewer's own journey (accepting/declining, doing the review — `reviewer-response`), nor the
review-form content (`review-forms`), nor the anonymity visibility matrix
(`review-anonymity`, which defines what each "review type" means); this spec owns the
mechanics of putting a reviewer on a round and managing that assignment.

## Actors & permissions

Baseline (stated once): reaching a review round and its Reviewers grid requires **login +
review-stage access**, computed by `workflow-stage-navigation` — an *unassigned* journal
manager or site admin gets manager scope on every submission; an assigned editor/assistant
gets the stages their groups cover (the default Journal-editor / Section-editor groups
include the review stage). A **recommend-only** section editor is a normal sub-editor here —
the reviewer grid does **not** gate on the recommend-only flag, so they add and manage
reviewers like any editor; only the final *decision* is withheld from them
(`editorial-decisions`). **Live-verified**: a recommend-only section editor (`minoue`,
`recommend_only=1`) opened the Add-Reviewer picker *with* the Create/Enroll links and had
`canGossip=true` on every assignment — a full management surface. An **author** never manages reviewers: even a user who is *both* an
author and an editor on the submission is refused every management operation, and an author
viewing their own submission gets at most a **redacted** read-only variant of the grid (only
completed reviews, "Read Review" only, further gated by `review-anonymity`; owned by
`author-dashboard` / open review). A **reviewer** never reaches this grid. "Assistant" below
means a production assistant (copyeditor/layout/proofreader) holding a review-stage role.
The rows below are what the **grid UI offers**, verified against the legacy grid handler's
per-role operation set and live-probed on submission 695. <sup>a</sup>

| Action | Who may — and when |
|--------|--------------------|
| **View the Reviewers grid** (list + statuses + types) | • Managers / site admins — manager scope, any submission<br>• Assigned sub-editors (incl. recommend-only) and assistants — when their group covers the review stage; but an **assistant's grid hides *declined* and *cancelled* assignments** (only Manager/Site-admin/Sub-editor at that stage see them — `canSeeAllReviewAssignments`), so an assistant sees a strict subset and the Resend/Reinstate actions are unreachable for them (their rows never appear). **Live-verified**: an assistant saw 3 of 4 assignments (the declined one absent), an editor saw all 4<br>• Authors — only a **redacted** read-only variant of *their own* submission (completed reviews, Read-Review only), owned by `author-dashboard` <sup>b</sup> |
| **Add reviewer** — search & assign an existing reviewer | • Managers, site admins, sub-editors, assistants — via **Add Reviewer** → the search/select picker <sup>c</sup> |
| **Create New Reviewer** / **Enroll Existing User** (from the Add-Reviewer picker) | • Managers, site admins, sub-editors **only**. The Add-Reviewer modal **hides** both links from an assistant — the legacy form only renders them when the current user holds Manager or Sub-editor role — so an assistant sees the Locate-a-Reviewer list and the search-**Change** link but no Create/Enroll tabs, matching the backend op-set that refuses `createReviewer`/`enrollReviewer` to assistants. Affordance and backend agree (no mismatch); **live-verified** (OQ6) <sup>d</sup> |
| **Unassign / Cancel a reviewer** | • Managers, site admins, sub-editors, assistants — label is **Unassign Reviewer** before the reviewer has responded (hard-removes the row) and **Cancel Reviewer** once they have accepted/declined (soft-cancels, keeps the row) — rule 6 <sup>e</sup> |
| **Reinstate a cancelled reviewer** | • Same set — offered **only** on a *cancelled* assignment (rule 7) <sup>e</sup> |
| **Resend the request** (to a declined reviewer) | • Same set — offered **only** on a *declined* assignment (rule 8) <sup>e</sup> |
| **Thank a reviewer** / **Revert Decision** | • Same set — Thank offered once the review is Complete; Revert Decision once Complete or Thanked (rule 9) <sup>f</sup> |
| **Edit** (due dates, review type, review form, files) | • Same set — any time the assignment is not cancelled (rule 10) <sup>g</sup> |
| **Send Reminder / Email Reviewer / Review Details / History / Log Response** | • Same set — Send Reminder surfaces when a response/review is overdue; Log Response only before the reviewer has responded; Review Details/History/Email any time <sup>h</sup> |
| **Editorial Notes** (reviewer "gossip") | • Managers, site admins, sub-editors **only** — the row menu shows the item only when the assignment's `canGossip` is true, and `canCurrentUserGossip()` returns false for anyone lacking Manager/Site-admin/Sub-editor role. So an assistant never sees Editorial Notes (**live-verified**: `canGossip=false` for an assistant, `true` for an editor). No affordance mismatch <sup>i</sup> |
| **Login As** (impersonate the reviewer) | • Only when the impersonation gate allows it for that reviewer; the menu item is gated on the assignment's `canLoginAs` (admin impersonation; `login-as`). **Live-verified** hidden from an assistant (`canLoginAs=false`) <sup>j</sup> |

<sup>a</sup> PKPReviewerGridHandler::__construct() (addRoleAssignment: MANAGER/SITE_ADMIN/SUB_EDITOR = all ops; ASSISTANT = all minus createReviewer/enrollReviewer/gossip), authorize() (WorkflowStageAccessPolicy + `_getAuthorDeniedOps` — the author-denied set covers *every* management op incl. showReviewerForm/create/enroll/thank/reminder/unassign/reinstate/resend/unconsider/editReview); live probe 2026-07-03 (dbarnes, sub 695). Verifier re-drove the whole matrix live 2026-07-03 on sub 849 (publicknowledge): manager `dbarnes`, assigned SE `dbuskins`/`sberardo` (auto-assigned as ART section editors), recommend-only SE `minoue`, and assistant `mfritz` (Funding-coordinator review-stage assignment) all reached the grid; reviewer `jjanssen` was refused the Add-Reviewer modal ("You don't currently have access to that stage of the workflow.") ·
<sup>b</sup> reviewerManagerStore.js `reviewAssignments` computed (`redactedForAuthors` → `getOpenAndCompletedReviewAssignmentsForRound`); useReviewerManagerConfig getColumns()/getItemPrimaryActions() (redacted branch) ·
<sup>c</sup> useReviewerManagerConfig getTopItems() (Add Reviewer button); useReviewerManagerActions reviewerAddReviewer() (`showReviewerForm`, selectionType ADVANCED_SEARCH) ·
<sup>d</sup> PKPReviewerGridHandler::__construct() (`unset($assistantOperations['createReviewer'/'enrollReviewer'])`); AdvancedSearchReviewerForm::fetch() (Create/Enroll link actions added only `if (array_intersect(getUserRoles(), [ROLE_ID_MANAGER, ROLE_ID_SUB_EDITOR]))`) — the template renders only what `$reviewerActions` holds; verifier live probe 2026-07-03 (assistant `mfritz` via a Funding-coordinator review-stage assignment vs editor `dbarnes` on sub 849: `selectCreate`/`enrolExisting` links present for the editor, absent for the assistant) ·
<sup>e</sup> useReviewerManagerConfig getItemActions() (declined→Resend; cancelled→Reinstate; else Edit + Unassign/Cancel by `dateConfirmed`); live-probed all four menus 2026-07-03 ·
<sup>f</sup> getItemPrimaryActions() (COMPLETE→Thank+Revert; THANKED→Revert) ·
<sup>g</sup> getItemActions() (Edit present unless CANCELLED) ·
<sup>h</sup> getItemPrimaryActions() (overdue→Send Reminder), getItemActions() (Log Response when `!dateConfirmed`) ·
<sup>i</sup> getItemActions() (`reviewAssignment.canGossip`); maps/Schema.php getPropertyReviewAssignments() (`canGossip = Repo::user()->canCurrentUserGossip($reviewerId)`); Repository::canCurrentUserGossip() (false unless current user holds MANAGER/SITE_ADMIN/SUB_EDITOR); verifier live probe 2026-07-03 (submission API `canGossip=false` for assistant `mfritz`, `true` for editor `dbarnes` on sub 849) ·
<sup>j</sup> getItemActions() (`reviewAssignment.canLoginAs`); useReviewerManagerActions reviewerLoginAs()

## Fields & validation

The **Add Reviewer** picker (a search/filter list of the journal's reviewers) has no form
fields of its own — filters and the Select action are described in rule 4. Selecting a
reviewer opens the **assignment form** below; the same fields (minus the reviewer picker)
recur on **Edit** and on **Resend**. Labels are the on-screen labels observed live.

| Field (UI label) | Required? | Rules | Anchor |
|------------------|-----------|-------|--------|
| **Selected Reviewer** | Yes | The reviewer being assigned — set by the picker (existing reviewer), by **Create New Reviewer** (name/email/username entered), or by **Enroll Existing User** (pick an account + reviewer group). The backend re-checks the user actually holds the Reviewer role and is not already on this round | ReviewerForm::_isValidReviewer(); CreateReviewerForm / EnrollExistingReviewerForm / AdvancedSearchReviewerForm |
| **Email template / message** | — | A dropdown of the review-request template plus any journal alternates the user may use, and a rich-text **personal message** pre-filled from the chosen template; sent as the invitation unless *skip email* is ticked | ReviewerForm::getEmailTemplates(); `template`, `personalMessage` uservars |
| **Response Due Date** | Yes | Date the reviewer must *accept/decline by*; defaults from journal setting (rule 3). Must be **on or before** the Review Due Date | ReviewerForm::__construct() (FormValidator `required` + FormValidatorDateCompare); `responseDueDate` |
| **Review Due Date** | Yes | Date the review itself is due; defaults from journal setting (rule 3); must be **≥ Response Due Date** ("Review due date must be greater or equal to response due date.") | ReviewerForm::__construct(); `reviewDueDate` |
| **Review Type** | Yes (defaulted) | Radio: **Anonymous Reviewer/Anonymous Author** (double-anonymous), **Anonymous Reviewer/Disclosed Author** (anonymous), **Open**; defaults to the journal's default review mode (rule 3). The *meaning* of each mode is owned by `review-anonymity` | ReviewerForm::initData() (`reviewMethod`); ReviewAssignment::SUBMISSION_REVIEW_METHOD_* |
| **Review Form** | No | Dropdown of the journal's **active** review forms; a form the reviewer fills instead of free-text comments. Pre-selected from the section's default form when one is set; the field is absent when the journal has no active review forms (live-probed: absent on `publicknowledge`). Form content owned by `review-forms` | ReviewerForm::initData()/fetch() (`reviewFormId`, section default); EditReviewForm hides it once the review is completed |
| **Publicly Show Reviewer Comments** | No | Checkbox (`isReviewPubliclyVisible`); defaults to the journal's default review visibility. Feeds the public open-review display (`open-peer-review-display`) | ReviewerForm::initData() (`getDefaultReviewPublicVisibility`) |
| **Do not send email to Reviewer** | No | Checkbox (`skipEmail`) present on assign, unassign/cancel, reinstate, resend and thank — suppresses that action's email but not its state change | EditorAction::addReviewer() (`skipEmail`); ReviewerNotifyActionForm; ThankReviewerForm |
| **Files for review** (selected files) | No | Which review-round files this reviewer may see; the general file grid is owned by `review-rounds-and-revisions` / `submission-files`, this form only grants/revokes per-reviewer access | ReviewerForm::execute() / EditReviewForm::execute() (`selectedFiles` → ReviewFilesDAO::grant) |

## Rules & state

A **review assignment** (`review_assignments` row) is created when a reviewer is added to a
round and carries the dates and flags that drive its **status** (a computed value, not a
stored column). Statuses by UI label, from `ReviewAssignment::getStatus()`: **Request Sent /
Awaiting Response** (0), **Request Declined** (1), **Response overdue** (4), **Request
Accepted** (5), **Review overdue** (6), **Review Submitted / received** (7), **Complete**
(8), **Reviewer Thanked** (9), **Request Cancelled** (10), **Request Resent** (11), **Review
Viewed** (12). <sup>a</sup>

1. **The grid is one review round's assignments.** The **Reviewers** grid (Vue
   `ReviewerManager`) lists the assignments for the *currently-selected* review round in four
   visible columns — **Reviewer**, **Reviewer status**, **Type**, **Actions** — plus a **More
   Actions** menu; a header **Add Reviewer** button sits above it. It reads
   `submission.reviewAssignments` filtered to the round; switching rounds (or opening a later
   round with no reviewers) shows that round's list. Live-probed on sub 695 round 1: four
   rows (Paul Hudson / Julie Janssen / Aisla McCrae / Adela Gallego) with the columns above.
   <sup>b</sup>
2. **Status labels are computed from dates+flags, not stored.** The **Reviewer status** cell
   renders per `getStatus()`: *Request Sent* + "Response due …" while awaiting a response;
   *Request Accepted* + "Review due …" once accepted; *Overdue* (negative styling) once past
   the relevant due date; *Request Declined* / *Request Cancelled* (each with a tooltip);
   *Complete* / *Reviewer Thanked* / *Review Submitted* / *Review Viewed* after submission;
   *Request Resent* after a resend. The **Type** cell shows the review-type (anonymity) label.
   Live-probed: Hudson "Request Sent", Janssen "Request Accepted / Review due: 2026-07-31",
   McCrae "Request Declined", Gallego "Complete". <sup>c</sup>
3. **Add-reviewer defaults come from journal settings.** Opening the assignment form
   pre-fills: **Review Type** = `defaultReviewMode` (fallback double-anonymous); **Review
   Form** = the section's default review form if set; **Response Due Date** = today +
   `numWeeksPerResponse` weeks (fallback 3); **Review Due Date** = today + `numWeeksPerReview`
   weeks (fallback 4); **Publicly Show Reviewer Comments** = the journal's default review
   visibility. Live-probed on `publicknowledge` (today 2026-07-03): both due dates offered as
   2026-07-31 and Review Type "Anonymous Reviewer/Anonymous Author" pre-checked. <sup>d</sup>
4. **The picker offers the journal's reviewers, ranked by workload, warns on anonymity
   risk.** Add Reviewer opens **Locate a Reviewer** (Vue `SelectReviewerListPanel`): every
   user holding the **Reviewer** role in the journal, each row showing review-workload data
   (rating, completed / active / declined / cancelled counts, days since last assignment) and
   filters for rating, completed reviews, days-since-last-assignment, active reviews and
   average completion. Reviewers **already assigned to this round** appear but are not
   selectable ("This reviewer has already been assigned to this review round."); users who
   may have seen author identity are flagged for anonymity (`warnOnAssignment`). Below the
   list, **Create New Reviewer** and **Enroll Existing User** tabs (managers/editors only);
   when the journal has reviewer suggestions on, a **suggestions** section appears above the
   list (owned by `reviewer-suggestions`). Live-probed: the four seeded reviewers shown as
   already-assigned; other reviewers selectable with workload badges. <sup>e</sup>
5. **Assigning creates the row, sends the request, notifies, logs.** Selecting a reviewer and
   submitting the form runs `ReviewerForm::execute()` → `EditorAction::addReviewer()`, which
   (unless the reviewer is already on the round): inserts the `review_assignments` row with
   the stage/round/method and the two due dates; marks it *new/unconsidered*; grants the
   selected review files; raises the reviewer's **New review assignment** task notification;
   writes the **reviewer-assigned** event-log entry; and — unless *skip email* — sends the
   **review-request** email to the reviewer (**Invitation to review**), logged to the
   submission's email history. A success flash ("… added as a reviewer") appears and the grid
   refreshes live. The email is `ReviewRequest` on round 1 and `ReviewRequestSubsequent` on
   later rounds. When journal reviewer-access keys are on, a one-click access invitation URL
   is woven into the email. Live-probed: assigning a reviewer on sub 695 sent "Invitation to
   review" to the reviewer and added a "Request Sent" row. <sup>f</sup>
6. **Unassign vs Cancel depends on whether the reviewer has responded.** The remove action is
   labelled **Unassign Reviewer** when the reviewer has *not* confirmed (no `dateConfirmed`)
   and **Cancel Reviewer** once they have accepted or declined. Its effect differs: an
   unconfirmed assignment is **hard-deleted** (the row disappears — no history, cannot be
   reinstated, only re-added fresh); a confirmed assignment is **soft-cancelled** (`cancelled`
   flag + `dateCancelled`, the row stays as *Request Cancelled*). Either way the reviewer's
   task notification is removed, the submission is stamped modified, a success flash appears,
   and — unless *skip email* — a **cancellation** email (**Request for Review Cancelled**) is
   sent and a **review-cleared** event-log entry written; if the reviewer has no other active
   assignment on the submission, they are dropped from the submission's tasks. Live-probed:
   cancelling accepted reviewer Janssen sent "Request for Review Cancelled" and left the row
   as *Request Cancelled*. <sup>g</sup>
7. **Reinstate applies only to a cancelled assignment.** *Reinstate Reviewer* is offered
   **only** when the status is *Cancelled*; it clears the `cancelled` flag/date (returning the
   assignment to its prior *Accepted*/etc. state), stamps the submission modified, and —
   unless *skip email* — sends a **reinstate** email (**Can you still review …?**) and writes
   a **reinstated** event-log entry. A hard-deleted (unconfirmed-then-unassigned) reviewer
   cannot be reinstated because the row is gone — **verifier-confirmed live**: a reinstate
   request against a non-existent assignment id is refused by `ReviewAssignmentRequiredPolicy`
   ("You do not have permission to access this review assignment"). The *only-when-cancelled*
   gate is enforced by the **Vue menu**, not the backend form: `ReinstateReviewerForm` re-checks
   no status, so a hand-crafted request against a still-active assignment opens the form and would
   re-set `cancelled=false` (a no-op) plus send the email — API-only, never offered in the UI.
   Live-probed: the cancelled Janssen row offered a reduced menu
   (Reinstate/Email/History/Login As/Editorial Notes) and reinstating sent the email and restored
   *Request Accepted*. <sup>h</sup>
8. **Resend applies only to a declined assignment.** *Resend Review Request* is offered
   **only** when the reviewer has *declined*; it clears the `declined` flag and `dateConfirmed`,
   sets `requestResent`, resets both due dates (fresh defaults, editable in the modal), stamps
   activity, sends — unless *skip email* — a **resend** email (**Requesting your review again …**)
   and writes an event-log entry (reusing the reviewer-assign event type). The status becomes
   *Request Resent*. As with reinstate, the *only-when-declined* gate is **UI-only**:
   `ResendRequestReviewerForm` re-checks no status (`canResendReviewRequest()` is consulted only
   by the legacy grid row / Vue menu, not the form), so a hand-crafted resend against an *accepted*
   assignment opens the form and would destructively null `dateConfirmed` — API-only, never offered
   in the UI (verifier-confirmed: the resend form opens `status:true` against an accepted
   assignment). Live-probed: resending to declined reviewer McCrae sent the email and set
   *Request Resent / Response due: …*. <sup>i</sup>
9. **Thank / Revert Decision act on a completed review.** Once a review is **Complete**, the
   primary actions are **Thank Reviewer** and **Revert Decision**; a thanked review keeps only
   **Revert Decision**. Thanking sends — unless *skip email* — the **acknowledgement** email
   (**Thank you for your review**; the mailable is owned by `reviewer-response`), stamps
   `dateAcknowledged`, marks the review *considered*, and moves the status to *Reviewer
   Thanked*, plus a success flash. **Revert Decision** (unconsider) resets the editor's
   confirmation of the review back to unread and logs it; the review returns to a
   pre-confirmation state. A review reaches *Complete* only after the editor **reads** it
   (Review Details / Read Review), which confirms it and writes a **review-confirmed**
   event-log entry. Live-probed: thanking Gallego sent "Thank you for your review" and set
   *Reviewer Thanked* with Revert Decision remaining. <sup>j</sup>
10. **Edit changes due dates / type / form / files after assignment.** **Edit** re-opens the
    due-date, review-type, review-form (only while the review is not yet completed) and
    file-access fields. On save it re-grants the selected files and, **only if a due date or
    the review method actually changed** (and the reviewer has not opted out of these emails),
    raises a **review-assignment-updated** task notification and sends an **edit-notify** email
    to the reviewer; otherwise it saves silently. <sup>k</sup>
11. **A reviewer can be on a round exactly once, and must hold the reviewer role.** The
    backend refuses assigning a user already on the current round, and refuses a user who is
    not enrolled as a reviewer in the journal. The picker enforces the same by disabling
    already-assigned reviewers and only listing reviewer-role users. <sup>l</sup>
12. **Every per-reviewer action is a legacy modal over a Vue list.** The `ReviewerManager` Vue
    component renders the list and menus, but each action (Add, Edit, Unassign/Cancel,
    Reinstate, Resend, Thank, Review Details, History, Email, Editorial Notes, Reminder) opens
    a **legacy modal** served by the `ReviewerGridHandler` grid — both surfaces are live and
    co-operative (Vue = list + action routing; legacy grid = the forms/AJAX and the state
    mutations). <sup>m</sup>

<sup>a</sup> ReviewAssignment::getStatus() / getStatusKey(); status constants REVIEW_ASSIGNMENT_STATUS_* ·
<sup>b</sup> ReviewerManager.vue; reviewerManagerStore.js `reviewAssignments`; useReviewerManagerConfig getColumns(); live probe 2026-07-03 (sub 695 round 1) ·
<sup>c</sup> useReviewerManagerConfig getCellStatusItems() (per-status labels/tooltips); ReviewerManagerCellReviewType; live probe 2026-07-03 ·
<sup>d</sup> ReviewerForm::initData() (`defaultReviewMode`, section `getReviewFormId`); HasReviewDueDate::getDueDates() (REVIEW_SUBMIT_DEFAULT_DUE_WEEKS=4, REVIEW_RESPONSE_DEFAULT_DUE_WEEKS=3, `numWeeksPerReview`/`numWeeksPerResponse`); live probe 2026-07-03 ·
<sup>e</sup> PKPSelectReviewerListPanel::getConfig()/_getCollector() (`filterByRoleIds([ROLE_ID_REVIEWER])`, `includeReviewerData`, `currentlyAssigned`, `warnOnAssignment`, filters, `suggestions`); AdvancedSearchReviewerForm; live probe 2026-07-03 ·
<sup>f</sup> ReviewerForm::execute(); EditorAction::addReviewer() (row insert, NOTIFICATION_TYPE_REVIEW_ASSIGNMENT, SUBMISSION_LOG_REVIEW_ASSIGN, `createMail` → ReviewRequest/ReviewRequestSubsequent by `getRound()==1`, ReviewerAccessInvite when `reviewerAccessKeysEnabled`); live probe 2026-07-03 (mailpit "Invitation to review") ·
<sup>g</sup> useReviewerManagerConfig getItemActions() (Unassign vs Cancel by `dateConfirmed`); UnassignReviewerForm::execute() (`dateConfirmed` → cancel else delete; SUBMISSION_LOG_REVIEW_CLEAR; ReviewerUnassign; task removal); PKPReviewerGridHandler::updateUnassignReviewer(); live probe 2026-07-03 (mailpit "Request for Review Cancelled") ·
<sup>h</sup> ReinstateReviewerForm::execute() (`cancelled=false`; SUBMISSION_LOG_REVIEW_REINSTATED; ReviewerReinstate); getItemActions() cancelled branch; live probe 2026-07-03 (mailpit "Can you still review …") ·
<sup>i</sup> ReviewAssignment::canResendReviewRequest() (declined && !cancelled); ResendRequestReviewerForm::execute() (`declined=false`, `requestResent=true`, reset due dates, SUBMISSION_LOG_REVIEW_ASSIGN); getItemActions() declined branch; live probe 2026-07-03 (mailpit "Requesting your review again …") ·
<sup>j</sup> ThankReviewerForm::execute() (ReviewAcknowledgement, `dateAcknowledged`, considered); PKPReviewerGridHandler::reviewRead() (SUBMISSION_LOG_REVIEW_CONFIRMED) / unconsiderReview() (SUBMISSION_LOG_REVIEW_UNCONSIDERED); getItemPrimaryActions(); live probe 2026-07-03 (mailpit "Thank you for your review") ·
<sup>k</sup> EditReviewForm::execute() (NOTIFICATION_TYPE_REVIEW_ASSIGNMENT_UPDATED + EditReviewNotify only when due date/method changed and not opted out; hides reviewFormId once completed) ·
<sup>l</sup> ReviewerForm::_isValidReviewer() (not-already-on-round + `userHasRole(ROLE_ID_REVIEWER)`); EditorAction::addReviewer() `$assigned` guard ·
<sup>m</sup> useReviewerManagerActions.js (every action `useLegacyGridUrl({component:'grid.users.reviewer.ReviewerGridHandler'})`); grids.md liveness (both-live)

## Side effects

**Emails** (each suppressible by *skip email*; each written to the submission email log):

- **Review request** — `ReviewRequest` (round 1) / `ReviewRequestSubsequent` (later rounds),
  to the reviewer, on assignment (rule 5). Logged as `REVIEW_REQUEST` /
  `REVIEW_REQUEST_SUBSEQUENT`.
- **Cancellation** — `ReviewerUnassign` (template `REVIEW_CANCEL`), to the reviewer, on
  unassign/cancel (rule 6). Logged as `REVIEW_CANCEL`.
- **Reinstate** — `ReviewerReinstate` (template `REVIEW_REINSTATE`), to the reviewer, on
  reinstate (rule 7). Logged as `REVIEW_REINSTATED`.
- **Resend** — `ReviewerResendRequest` (template `REVIEW_RESEND_REQUEST`), to the reviewer,
  on resend (rule 8). Logged as `REVIEW_RESEND`.
- **Edit-notify** — `EditReviewNotify` (falls back to the generic notification template),
  only when due dates/method changed and the reviewer has not opted out (rule 10). Logged as
  `REVIEW_EDIT_NOTIFY_REVIEWER`.
- **Acknowledgement (thank)** — `ReviewAcknowledgement` (`REVIEW_ACK`), to the reviewer, on
  thank (rule 9). The mailable atom is owned by `reviewer-response`; the *action* is here.

**Notifications** (in-app, TASK level, to the reviewer):

- **New review assignment** — `NOTIFICATION_TYPE_REVIEW_ASSIGNMENT` on assignment; removed
  when the review is unassigned/cancelled or read by the editor.
- **Review assignment updated** — `NOTIFICATION_TYPE_REVIEW_ASSIGNMENT_UPDATED` when Edit
  changes a due date or the method (paired with the edit-notify email).

**Event-log entries** (submission activity log; the log surface is owned by
`editorial-activity-log`, each type co-claimed by the firing feature):

- `SUBMISSION_LOG_REVIEW_ASSIGN` — reviewer assigned (also reused by resend).
- `SUBMISSION_LOG_REVIEW_CLEAR` — reviewer unassigned/cancelled.
- `SUBMISSION_LOG_REVIEW_REINSTATED` — assignment reinstated.
- `SUBMISSION_LOG_REVIEW_CONFIRMED` — editor read/confirmed the review.
- `SUBMISSION_LOG_REVIEW_UNCONSIDERED` — editor reverted the confirmation (Revert Decision /
  `unconsiderReview`, rule 9). Claimed here (EVLOG-REV-UNCON).

**Data**: creates/edits/deletes `review_assignments` rows (+ `review_assignment_settings` for
locale-scoped extras); grants/revokes per-reviewer file access (`review_files`, owned by
`review-rounds-and-revisions`); stamps the submission modified. Approving a matching author
**reviewer suggestion** on assignment is owned by `reviewer-suggestions`. Depositing a
completed review to ORCID (Send Review to ORCID) is owned by `orcid`.

## Settings that modify behavior

- **Default review method** (`defaultReviewMode`, Settings → Workflow → Review) — pre-selects
  the Review Type radio (fallback double-anonymous).
- **Weeks to complete review** (`numWeeksPerReview`, fallback 4) and **weeks to respond**
  (`numWeeksPerResponse`, fallback 3) — set the Review/Response due-date defaults (rule 3).
  (The `numDaysBefore/AfterReview*ReminderDue` settings drive *reminders*, owned by
  `scheduled-tasks`, not the due-date defaults.)
- **Default review comment visibility** (`getDefaultReviewPublicVisibility`) — default of the
  Publicly-Show-Reviewer-Comments checkbox; feeds `open-peer-review-display`.
- **Reviewer access keys enabled** (`reviewerAccessKeysEnabled`) — when on, the request email
  carries a one-click access URL and a reviewer-access invitation is created on assignment.
- **Section default review form** — a section can designate a default review form, pre-selected
  at assignment (`sections`).
- **Reviewer suggestions enabled** (`reviewerSuggestionEnabled`) — adds the suggestions section
  to the Add-Reviewer picker (`reviewer-suggestions`).
- All review **email templates** (request/cancel/reinstate/resend/edit-notify/ack) are editable
  in `email-templates-management`; a reviewer's opt-out of the "assignment updated" email
  suppresses the edit-notify send.

## Cross-feature interactions

- **review-anonymity** — owns what each **Review Type** (double-anonymous / anonymous / open)
  means for who-sees-whom; this spec owns *choosing* the type at assignment and displaying it.
- **reviewer-response** — owns the reviewer's own accept/decline/complete journey and the
  events those fire (`EVLOG-REV-ACCP/DECL/RDY`) plus the confirm/decline/acknowledgement
  mailables (`MAIL-review-{confirm,decline,acknowledgement}`); this spec fires the
  acknowledgement (thank) email and confirms the review (read) from the editor side. The
  *read-review content* modal and the reviewer-consider lifecycle are shared (see Open
  questions on `EVLOG-REV-UNCON`).
- **review-forms** — owns building/reading a review form; this spec owns selecting one at
  assignment (`reviewFormId`).
- **review-rounds-and-revisions** — owns rounds, round status, files-for-review and the
  new-round/revision cycle; this spec owns the reviewer list *within* a round and per-reviewer
  file grants. Assigning on a later round uses `ReviewRequestSubsequent` (seam).
- **reviewer-suggestions** — owns author-suggested reviewers and the approve-a-suggestion
  path; this spec owns the Add-Reviewer picker/form that a suggestion feeds into and the
  assignment mechanics that stamp a suggestion approved.
- **editorial-decisions** — owns the Send-for-Review decision that opens the review stage and
  round 1 (the precondition for this grid) and the recommend/decision gates.
- **workflow-stage-navigation** — owns review-stage access and the workflow shell the grid
  renders in.
- **editorial-activity-log** — owns the activity-log surface that renders the REV-* events.
- **email-delivery / email-templates-management** — own the mailable delivery/log surface and
  the editable templates.
- **orcid** / **login-as** / **author-dashboard** — own Send-Review-to-ORCID, reviewer
  impersonation, and the author-side redacted grid respectively.

## Canonical scenarios

1. **Assign a reviewer and send the request** — an editor on a review round clicks **Add
   Reviewer**, filters/locates a reviewer, selects them, accepts the default due dates and
   review type, and submits: a *Request Sent* row appears in the grid and the reviewer
   receives the **Invitation to review** email (live-verified on sub 695).
2. **Assign without emailing** — the same flow with **Do not send email to Reviewer** ticked:
   the row is created but no invitation is sent (the reviewer sees only the in-app task).
3. **Create a brand-new reviewer at assignment** — from the picker the editor uses **Create
   New Reviewer**, enters name/email/username, and assigns; a new reviewer account is created,
   enrolled, and put on the round (the backend refuses this operation to assistants).
4. **Unassign an un-responded reviewer** — for a reviewer still *Request Sent*, the editor
   picks **Unassign Reviewer**: the row is hard-removed (no history, not reinstatable) and a
   cancellation email is sent unless skipped.
5. **Cancel then reinstate an accepted reviewer** — for an *accepted* reviewer the editor
   picks **Cancel Reviewer** (row becomes *Request Cancelled*, cancellation email sent), then
   later **Reinstate Reviewer** on that cancelled row restores it to *Request Accepted* and
   sends the reinstate email (live-verified end-to-end on sub 695).
6. **Resend the request to a declined reviewer** — a reviewer who **declined** shows *Request
   Declined*; the editor picks **Resend Review Request**, adjusts the fresh due dates, and
   sends: status becomes *Request Resent* and the reviewer gets the "requesting again" email
   (live-verified on sub 695).
7. **Thank a reviewer who completed** — after the editor reads a submitted review (status
   *Complete*), **Thank Reviewer** sends the acknowledgement email and moves the row to
   *Reviewer Thanked*; **Revert Decision** remains available (live-verified on sub 695).
8. **Edit due dates on an active assignment** — the editor opens **Edit**, changes the review
   due date, and saves: the reviewer gets a "review updated" task notification and the
   edit-notify email (only because a date changed); changing nothing sends nothing.
9. **Permission boundary — assistant vs editor** — a production assistant with review-stage
   access can add an existing reviewer and manage assignments, but the Add-Reviewer picker
   **hides** Create-New / Enroll and the row menu hides Editorial-Notes / Login-As from them
   (live-verified: `mfritz` vs `dbarnes` on sub 849 — no affordance mismatch), and their grid even
   omits declined/cancelled rows; a recommend-only section editor manages reviewers normally
   (live-verified: `minoue`); an author (even one also holding an editor role) is refused all
   management ops.
10. **The picker offering** — Add Reviewer lists the journal's reviewers with workload badges
    and filters, marks reviewers already on the round as non-selectable, and flags
    anonymity-risky candidates; only reviewer-role users appear (live-verified on sub 695).
11. **Approve an author suggestion into an assignment (seam)** — when reviewer suggestions are
    on, the editor picks a suggested reviewer from the Add-Reviewer suggestions section, which
    routes into this assignment form (create/enroll/assign) and, on completion, stamps the
    suggestion approved — assignment mechanics here, suggestion state in `reviewer-suggestions`.
12. **Reviewer status reflects the lifecycle** — across a round the grid shows *Request Sent →
    Request Accepted → Review Submitted → Complete → Reviewer Thanked* (or *Declined* /
    *Cancelled* / *Response overdue* / *Review overdue* / *Request Resent*), each with the
    right per-status action menu (live-verified: the four seeded states on sub 695).

## Known deviations (as-built ≠ intent)

None rise to a ⚠ for this spec. The behaviours a product owner might question — the
**hard-delete on unassigning an un-responded reviewer** (rule 6, which loses that assignment's
history and makes it non-reinstatable, unlike the soft-cancel of a responded reviewer), the
**reuse of a status constant to select the request-email log type** (see Open questions), and the
**UI-only enforcement of the status gates** (the Reinstate/Resend backend forms re-check no
status, so a *hand-crafted* request against a non-cancelled/non-declined assignment opens the form;
rules 7–8) — are recorded as Open questions rather than deviations. The first two are plausibly
intended and the constant reuse is behaviourally correct; the third is **UI-shielded** (the actions
are never *offered* except in the right state, and a deleted assignment is hard-denied by
`ReviewAssignmentRequiredPolicy`), so it is a latent robustness gap reachable only by hand-crafted
API calls — not a user-facing affordance mismatch (cf. the `editorial-decisions` "returnToDone
shielded 500" finding, which took no ledger row either). **OQ6 was live-resolved clean** (the
assistant picker/menu hide every control the backend refuses — no mismatch), so no new ledger row
is added. Cross-cutting manager-scope access quirks are owned by `workflow-stage-navigation` /
`roles-permissions`.

## Open questions

1. **Is the hard-delete of an un-responded reviewer intended?** Unassigning a reviewer who
   never responded deletes the `review_assignments` row outright (no *Cancelled* trace, no
   reinstate — only re-add), whereas cancelling a responded reviewer keeps the row. Is the
   asymmetry deliberate (they never engaged) or should both be soft-cancelled for audit?
   (`UnassignReviewerForm::execute()`.)
2. **`EVLOG-REV-UNCON` ownership — RESOLVED (claimed here).** `SUBMISSION_LOG_REVIEW_UNCONSIDERED`
   (the **Revert Decision** action, fired from this grid's `unconsiderReview`, rule 9) is now
   **claimed by this spec**, keeping the editor-side read/confirm/revert triad together with its
   counterpart `EVLOG-REV-CONF`. Intent adjudication (should the review-consideration lifecycle
   live under `reviewer-response` instead?) is deferred to grooming, but the atom is no longer
   unclaimed.
3. **Request-email log type keys on a status constant.** `EditorAction::addReviewer()` selects
   the *email-log* type with `$round === ReviewRound::REVIEW_ROUND_STATUS_REVISIONS_REQUESTED
   ? REVIEW_REQUEST : REVIEW_REQUEST_SUBSEQUENT` — comparing a **round number** to a
   round-**status** constant. It is behaviourally correct only because that constant equals 1
   (= round 1); the mailable itself is chosen cleanly by `getRound()==1`. Worth an upstream
   tidy, but not a behavioural bug.
4. **`AUTHZ-review-assignment-required-policy` ownership — RESOLVED (claimed here).** This policy
   validates the `reviewAssignmentId` for this grid's per-reviewer operations and is now **claimed
   by this spec** (verifier live-triggered its denial: a per-reviewer op against a missing
   assignment id returns "You do not have permission to access this review assignment"). Its
   sibling `AUTHZ-review-assignment-access-policy` (the *reviewer's* own-submission access, used by
   `SubmissionAccessPolicy`) is **left for `reviewer-response`** — it is not this editor-side
   grid's concern.
5. **Both due dates equal on `publicknowledge`.** Response and Review due dates both defaulted
   to 2026-07-31 live (4 weeks), implying the journal's `numWeeksPerResponse` is configured to
   match `numWeeksPerReview` rather than the code fallback (3 vs 4). As-built default logic is
   settled; the observation is just that the seeded journal's settings coincide.
6. **Does the Add-Reviewer picker hide Create-New / Enroll (and Editorial Notes) for an
   assistant? — RESOLVED (hidden; no mismatch).** All three controls are **hidden** from an
   assistant, so there is **no affordance mismatch**. Verifier live probe 2026-07-03: an assistant
   (`mfritz`, given review-stage access via a Funding-coordinator stage assignment on sub 849) vs
   an editor (`dbarnes`): the Add-Reviewer modal rendered the Locate-a-Reviewer list and the
   search-**Change** link for both, but the **Create New Reviewer** (`selectCreate`) and **Enroll
   Existing User** (`enrolExisting`) links were present only for the editor and absent for the
   assistant (`AdvancedSearchReviewerForm::fetch()` adds them only for Manager/Sub-editor roles);
   and the submission API returned `canGossip=false`/`canLoginAs=false` on every assignment for the
   assistant (`true` for the editor), so the Vue row menu omits Editorial Notes and Login As. The
   original worry that these are "not obviously role-gated in the templates" was mistaken — the
   legacy form and the `canGossip` map projection both gate them by role. (Contrary to a first grep,
   `contextId="createReviewerForm"` is a static template attribute present regardless of role — not
   evidence the Create link renders.)

---

## Reference — entry points & surfaces

| Entry | Path | Atom |
|-------|------|------|
| Reviewers grid (Vue) | Review-stage workspace → **Reviewers** panel (`ReviewerManager`) | VUE-reviewer-manager |
| Add-Reviewer picker (Vue) | Add Reviewer → **Locate a Reviewer** (`SelectReviewerListPanel`) | VUE-select-reviewer-list-panel |
| Reviewer grid + action modals (legacy) | `$$$call$$$/grid/users/reviewer/reviewer-grid/*` (`showReviewerForm`, `updateReviewer`, `unassignReviewer`/`updateUnassignReviewer`, `reinstateReviewer`/`updateReinstateReviewer`, `resendRequestReviewer`/`updateResendRequestReviewer`, `editThankReviewer`/`thankReviewer`, `editReview`/`updateReview`, `reviewRead`, `unconsiderReview`, `readReview`, `reviewHistory`, `sendEmail`, `editReminder`/`sendReminder`, `gossip`, `getUsersNotAssignedAsReviewers`) | GRID-grid-users-reviewer-reviewer-grid-handler |
| Assignment / management forms | `AdvancedSearchReviewerForm`, `CreateReviewerForm`, `EnrollExistingReviewerForm`, `EditReviewForm`, `UnassignReviewerForm`, `ReinstateReviewerForm`, `ResendRequestReviewerForm`, `ThankReviewerForm` | *(forms under the grid atom)* |
| Assignment entity | `review_assignments` (+ `review_assignment_settings`); schema `reviewAssignment.json` | DB-review_assignments, DB-review_assignment_settings, SCHEMA-review-assignment |
| Request emails | `ReviewRequest`, `ReviewRequestSubsequent` | MAIL-review-request, MAIL-review-request-subsequent |
| Management emails | `ReviewerReinstate`, `ReviewerResendRequest`, `ReviewerUnassign` | MAIL-reviewer-reinstate, MAIL-reviewer-resend-request, MAIL-reviewer-unassign |
| Notifications | `NOTIFICATION_TYPE_REVIEW_ASSIGNMENT`, `…_UPDATED` | NOTIF-review-assignment, NOTIF-review-assignment-updated |
| Event log | `SUBMISSION_LOG_REVIEW_ASSIGN` / `_CLEAR` / `_REINSTATED` / `_CONFIRMED` / `_UNCONSIDERED` | EVLOG-REV-ASSIGN, EVLOG-REV-CLR, EVLOG-REV-REIN, EVLOG-REV-CONF, EVLOG-REV-UNCON |
| Per-reviewer access policy | `ReviewAssignmentRequiredPolicy` (validates `reviewAssignmentId` for per-reviewer ops) | AUTHZ-review-assignment-required-policy |

## Reference — code anchors

- **Grid handler**: `lib/pkp/classes/controllers/grid/users/reviewer/PKPReviewerGridHandler.php`
  (role/op assignment, authorize + author-denied ops, all action ops, `createMail`); OJS
  subclass `controllers/grid/users/reviewer/ReviewerGridHandler.php`.
- **Assignment engine**: `lib/pkp/classes/submission/action/EditorAction.php`
  (`addReviewer`, `setDueDates`, `createMail` → ReviewRequest/Subsequent, ReviewerAccessInvite).
- **Forms**: `lib/pkp/controllers/grid/users/reviewer/form/` — `ReviewerForm.php` (base
  assign; `execute`, `initData`, `_isValidReviewer`, `getEmailTemplates`),
  `AdvancedSearchReviewerForm.php`/`CreateReviewerForm.php`/`EnrollExistingReviewerForm.php`,
  `EditReviewForm.php`, `UnassignReviewerForm.php`, `ReinstateReviewerForm.php`,
  `ResendRequestReviewerForm.php`, `ThankReviewerForm.php`, `ReviewerNotifyActionForm.php`,
  `traits/HasReviewDueDate.php`.
- **Entity**: `lib/pkp/classes/submission/reviewAssignment/ReviewAssignment.php`
  (`getStatus`, `getStatusKey`, `getReviewMethodKey`, `canResendReviewRequest`, status/method
  constants); `Repository.php`, `maps/Schema.php`; `schemas/reviewAssignment.json`;
  migrations `ReviewsMigration.php`, `ReviewAssignmentSettingsMigration.php`.
- **Vue manager**: `lib/ui-library/src/managers/ReviewerManager/` — `ReviewerManager.vue`,
  `reviewerManagerStore.js`, `useReviewerManagerConfig.js` (columns, status items, item
  actions), `useReviewerManagerActions.js` (legacy-modal routing), the `Cell*` components.
- **Picker**: `lib/pkp/classes/components/listPanels/PKPSelectReviewerListPanel.php`
  (reviewer collector, filters, `currentlyAssigned`, `warnOnAssignment`, suggestions);
  `lib/ui-library/src/components/ListPanel/users/SelectReviewerListPanel.vue`.
- **Mailables**: `lib/pkp/classes/mail/mailables/{ReviewRequest,ReviewRequestSubsequent,
  ReviewerReinstate,ReviewerResendRequest,ReviewerUnassign,EditReviewNotify,
  ReviewAcknowledgement}.php`.
