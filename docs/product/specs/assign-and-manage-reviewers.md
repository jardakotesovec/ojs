---
name: assign-and-manage-reviewers
scope: The editor's reviewer-management surface on a review round — find and assign reviewers, watch live per-assignment statuses, and manage each assignment (edit, unassign/cancel, reinstate, resend, remind, read/confirm, thank) with their emails
shared: pkp-lib
status: verified
atlas-claims:
  - VUE-reviewer-manager
  - VUE-select-reviewer-list-panel
  - GRID-grid-users-reviewer-reviewer-grid-handler
  - DB-review_assignments
  - DB-review_assignment_settings
  - SCHEMA-review-assignment
  - AUTHZ-review-assignment-required-policy
  - MAIL-review-request
  - MAIL-review-request-subsequent
  - MAIL-reviewer-reinstate
  - MAIL-reviewer-resend-request
  - MAIL-reviewer-unassign
  - MAIL-review-acknowledgement
  - MAIL-edit-review-notify
  - MAIL-review-remind
  - MAIL-reviewer-register
  - NOTIF-review-assignment
  - NOTIF-review-assignment-updated
  - EVLOG-REV-ASSIGN
  - EVLOG-REV-CLR
  - EVLOG-REV-REIN
  - EVLOG-REV-CONF
  - EVLOG-REV-UNCON
  - EVLOG-REV-REM
  - EVLOG-REV-PROXY-REC
  - API-user-get-reviewers
  - API-review-confirm-review
  - API-review-export-review-pdf
  - API-review-export-review-xml
  - API-review-get-exported-file
  - API-review-send-to-orcid
  - FORM-log-reviewer-response-form
  - LOC-editor-reviewer-list
---

# Assign & manage reviewers {OJS OMP}

## Purpose

Once a submission reaches a review stage, someone has to find reviewers, invite
them, keep the invitations moving, and close the loop on every review that comes
back. This feature is the editor's side of that job: the **Reviewers** panel shown
on each review round of the submission workflow page. It lists every review
assignment in the round with a live status (invited, accepted, overdue, declined,
submitted, confirmed, thanked, cancelled), an **Add Reviewer** picker that searches
the journal's reviewer pool (and can create a brand-new reviewer account or enroll
an existing user on the spot), and a per-row action menu covering the whole
assignment lifecycle — edit dates and review type, unassign or cancel, reinstate,
resend a declined request, log the reviewer's answer on their behalf, send a
reminder, read and confirm the finished review, rate the reviewer, and send a
thank-you. The reviewer's own journey (accepting, filling in the review) is the
`reviewer-response` feature; the anonymity visibility matrix is owned by
`review-anonymity` — this spec only records which anonymity mode an assignment
gets and where it can be changed.

## Actors & permissions

Terms used below: *assigned* = holds a stage assignment on this submission for the
review stage (Journal Managers see every submission without needing an assignment);
an *Assistant* only reaches a review stage if their assistant role covers that stage —
the default assistant groups mostly cover copyediting/production, so this is the
exception, not the rule. **Site Administrators** act with full managerial power on
the panel wherever they hold access. **Reviewers** never see this panel — they work
from their own review pages (`reviewer-response`). **Authors** get a separate,
stripped-down read-only variant, and only in one situation (see "View" below);
anonymous visitors and Readers have no access. An author who *also* holds an
editorial role on their own submission is refused every management action here, and
under anonymous review modes even the read-type actions. <sup>a</sup>

| Action | Who may — and when |
|--------|--------------------|
| **View the Reviewers panel** (statuses, type, actions) | • Journal Manager — any submission in review<br>• Section Editor, Assistant — when assigned; ⚠ on a journal with reviewer suggestions switched on, an Assistant reaches the round only after dismissing an "Error" dialog (Known deviations, ledger 270)<br>• Author — a redacted variant (names, type, read-review only; no statuses, no add button), and only when the round has at least one completed **open** review (see `review-anonymity`) <sup>b</sup> |
| **Add a reviewer** (search & select from the reviewer pool) | • Journal Manager, Section Editor, Assistant — on rounds they can access <sup>c</sup> |
| **Create a new reviewer account / Enroll an existing user as reviewer** | • Journal Manager, Section Editor only<br>• Assistant — the two options are absent from their picker, and the operations are refused server-side <sup>d</sup> |
| **Assign despite a conflict warning** (unlock a flagged candidate) | • Anyone who can add a reviewer — after an explicit "Unlock" confirmation on the flagged entry <sup>e</sup> |
| **Edit an assignment** (due dates, review type, public visibility, files, review form) | • Journal Manager, Section Editor, Assistant — any non-cancelled assignment <sup>f</sup> |
| **Unassign / Cancel a reviewer** | • Journal Manager, Section Editor, Assistant — any non-cancelled assignment <sup>f</sup> |
| **Reinstate a cancelled reviewer** | • Journal Manager, Section Editor, Assistant <sup>f</sup> |
| **Resend the request after a decline** | • Journal Manager, Section Editor, Assistant <sup>f</sup> |
| **Log the reviewer's response on their behalf** | • Journal Manager, Section Editor — while the reviewer hasn't answered<br>• Assistant — ⚠ the action is offered but the server refuses it (Known deviations) <sup>g</sup> |
| **Read the review / Review details; confirm, rate, set the recommendation on the reviewer's behalf** | • Journal Manager, Section Editor, Assistant — Read Review is offered while the review is submitted and not yet confirmed; once confirmed, "Revert Decision" brings it back (rules 11, 13)<br>• Author — read-only, completed open reviews only, through their redacted panel <sup>h</sup> |
| **Revert the confirmation** (mark unconsidered) | • Journal Manager, Section Editor, Assistant <sup>f</sup> |
| **Thank the reviewer** | • Journal Manager, Section Editor, Assistant <sup>f</sup> |
| **Send a manual reminder** | • Journal Manager, Section Editor, Assistant <sup>f</sup> |
| **Email the reviewer** (free-form) | • Journal Manager, Section Editor, Assistant <sup>f</sup> |
| **Review history** (date milestones) | • Journal Manager, Section Editor, Assistant <sup>f</sup> |
| **Editorial Notes about the reviewer** (a shared note that carries across submissions) | • Journal Manager, Section Editor<br>• Assistant — the action is absent and the operation refused <sup>i</sup> |
| **Log In As the reviewer** | • Journal Manager (and Site Administrator) — Section Editors and Assistants don't get the action <sup>j</sup> |
| **Send a confirmed review to the reviewer's ORCID record** | • Journal Manager, Section Editor — manual re-send for a reviewer with a verified ORCID<br>• Assistant — ⚠ offered but refused server-side; ⚠ also offered before the review is even accepted (Known deviations) <sup>k</sup> |

<sup>a</sup> PKPReviewerGridHandler::__construct() (role assignments incl. SITE_ADMIN), authorize() (`_isCurrentUserAssignedAuthor`, `_getAuthorDeniedOps()`, `_getAuthorDeniedAnonymousOps()`); reviewers/authors reach the grid only via the author variant; live-probed 2026-07-10 (scratch amrv5, a submitter enrolled in both the author and section-editor groups): all four management ops refused at the operation level, read-review/review-history/gossip allowed on the completed open review and refused on the completed double-anonymous one; a pure section-editor control account was allowed throughout ·
<sup>b</sup> workflowConfigEditorialOJS.js / workflowConfigAuthorOJS.js (ReviewerManager mount; author: `redactedForAuthors` + open-and-completed gate); live-probed 2026-07-10: senior-editor/section-editor accounts full panel; funding-group assistant full panel on scratch journal; the author account saw the 3-column redacted panel only on the seeded open-completed submission, no panel otherwise ·
<sup>c</sup> useReviewerManagerConfig() getTopItems(); PKPReviewerGridHandler::_getReviewRoundOps() incl. ASSISTANT; live-probed: Add Reviewer button present for the senior-editor and section-editor accounts and the scratch assistant ·
<sup>d</sup> AdvancedSearchReviewerForm::fetch() (links only for MANAGER/SUB_EDITOR); PKPReviewerGridHandler::__construct() (createReviewer/enrollReviewer removed from ASSISTANT ops); live-probed: links present for the senior-editor + section-editor accounts, absent for the scratch assistant ·
<sup>e</sup> SelectReviewerListItem.vue (`warnOnAssignment`/`isWarningBypassed`); AdvancedSearchReviewerForm::fetch() (warn list = assigned users + managers/admins); live-probed: manager-cum-reviewer on scratch journal showed the locked notice, Unlock exposed Select ·
<sup>f</sup> PKPReviewerGridHandler::_getReviewAssignmentOps() (all granted to MANAGER/SITE_ADMIN/SUB_EDITOR/ASSISTANT); useReviewerManagerConfig() getItemActions(); live-probed action menus 2026-07-10 as the senior-editor, section-editor and scratch-assistant accounts across invited/accepted/declined/cancelled/overdue/complete/thanked rows ·
<sup>g</sup> useReviewerManagerConfig() getItemActions() (`!dateConfirmed`); PKPReviewController::getGroupRoutes() confirmReview roleAuthorizer (SITE_ADMIN/MANAGER/SUB_EDITOR); live-probed: scratch assistant saw Log Response, submit → PUT confirmReview 401 ·
<sup>h</sup> PKPReviewerGridHandler::readReview(), reviewRead(); APP ReviewerGridHandler::reviewRead() (recommendation by proxy); AuthorReviewerGridHandler (author read modal, open reviews only — documented in review-anonymity); live-probed: the senior-editor account confirm+rate+set recommendation; the author account opened the author read modal ·
<sup>i</sup> PKPReviewerGridHandler::__construct() (gossip removed for ASSISTANT), gossip() + Repo::user()->canCurrentUserGossip(); live-probed: Editorial Notes in the senior-editor + section-editor menus, absent for scratch assistant ·
<sup>j</sup> submission maps Schema.php (`canLoginAs` via Validation::canUserLoginAs()); useReviewerManagerConfig() getItemActions(); live-probed: Login As present for the senior-editor account and the scratch journal manager, absent for the section-editor account and the assistant ·
<sup>k</sup> useReviewerManagerConfig() getItemActions() (`reviewerHasOrcid && pkp.const.REVIEW_ASSIGNMENT_STATUS_COMPLETE` — constant always truthy); PKPReviewController::getGroupRoutes() sendToOrcid roleAuthorizer; live-probed: verified-ORCID reviewer, action shown on a "Request Sent" row to editor AND assistant; assistant POST → 401

## Fields & validation

**The Add Reviewer picker** (first step of the add dialog): <sup>a</sup>

- A "Submission Author List" with the authors' names and affiliations sits above
  the search so the editor can spot conflicts.
- The candidate list covers everyone holding a reviewer role in the journal,
  searchable, with per-candidate stats: rating stars, active-review count, days
  since last assignment, affiliation, biography, reviewing interests, an ORCID
  badge, and expandable counts of completed/declined/cancelled reviews and
  average completion days.
- Filters: rated at least, reviews completed, days since last review assigned,
  active reviews currently assigned, average days to complete.
- Candidates already assigned to this round are locked with a notice; candidates
  who could see author identities (users already working on the submission,
  journal managers, site administrators) are locked behind a warning with an
  explicit "Unlock".
- If the journal collects author reviewer suggestions, they are offered above
  the search (see `reviewer-suggestions`).
- From round two onward, reviewers who completed a review in the previous round
  are pinned first with a "Reassign" action.

**The assignment form** (after selecting a candidate; also the tail of the
create/enroll variants):

| Field (UI label) | Required? | Rules |
|------------------|-----------|-------|
| **Choose a predefined message** | No | Email template for the request; from round two the choice follows the path taken — the "Reassign" path offers only the "subsequent request" template, the ordinary selection path only the first-time request <sup>b</sup> |
| **Email to be sent to reviewer** | No | Prefilled from the chosen template, editable rich text <sup>b</sup> |
| **Do not send email to Reviewer** | No | Skips the request email entirely (the in-app notification still fires) <sup>c</sup> |
| **Response Due Date / Review Due Date** | Yes (both) | Defaulted from the journal's review-deadline settings; the review due date must be on or after the response due date <sup>d</sup> |
| **Files To Be Reviewed** | No | Restricts which of the round's review files this reviewer may access; collapsed behind a "restrict files" expander with a warning when nothing is selected <sup>e</sup> |
| **Review Type** | Yes | One of the three anonymity modes (the matrix lives in `review-anonymity`); defaults to the journal's default review mode <sup>f</sup> |
| **Public Visibility** ("Publicly Show Reviewer Comments") | No | Flags the eventual review for public display (see `open-peer-review-display`); default follows the journal setting <sup>g</sup> |
| **Review Form** | No | Only shown when the journal has active review forms; "None / Free Form Review" or a form (see `review-forms`); a section's default review form comes preselected <sup>h</sup> |

**Create New Reviewer** adds account fields before the assignment form: <sup>i</sup>

- Given Name — required
- Family Name
- Username — required; lowercase letters, numbers, hyphens and underscores;
  uniqueness checked; a "Suggest" helper
- Email — required, unique
- Reviewing Interests
- Affiliation
- An "Appear on the masthead" checkbox — pre-ticked and disabled: the editor
  cannot change it (Known deviations)

No reviewer-group control appears on this form: the account lands in the
journal's reviewer group without a choice (a group choice appears only when
the journal has more than one reviewer group — a default journal has exactly
one). The account is created with a generated password the user must change
at first login.

**Enroll Existing User** instead asks for the reviewer group to enroll into —
a visible choice even on a default journal, where it lists the single
reviewer group — and a "Search By Name" autocomplete that only offers users
who do *not* already hold a reviewer role in the journal. <sup>j</sup>

**Edit Review** re-opens due dates, review type, public visibility and the file
restriction on a live assignment; the review-form choice is only editable until
the review has been submitted. Both due dates stay required with the same
ordering rule. <sup>k</sup>

**The action modals**: <sup>l</sup>

- **Unassign/Cancel, Reinstate, Resend** — each shows a prefilled, editable
  notification email with a "Do not send email" checkbox; Resend additionally
  re-asks both due dates (required, defaulted afresh).
- **Thank Reviewer** — the recipient and a prefilled message plus the skip
  checkbox.
- **Send Reminder** — a template picker, an editable message, and the review
  schedule (request, acceptance, due dates); the reviewer's one-click access
  link is never revealed to the editor in the preview.
- **Log Response** — a single required choice: "Reviewer has accepted/declined
  the invitation to review".
- **Email Reviewer** — a bare subject (required) + body (required) message.
- **Editorial Notes** — one shared free-text note about the reviewer that
  carries across submissions (who may open it: see Actors & permissions).

<sup>a</sup> PKPSelectReviewerListPanel::getConfig() (filters, labels), getItems(); SelectReviewerListPanel.vue / SelectReviewerListItem.vue; PKPUserController::getReviewers() (search + filter params); AdvancedSearchReviewerForm::fetch() (author list, `currentlyAssigned`, `warnOnAssignment`, `lastRoundReviewers`); live-probed 2026-07-10 (filters panel, locked notices, stats expansion, round-2 Reassign pinning) ·
<sup>b</sup> reviewerFormFooter.tpl (template select + personal message); AdvancedSearchReviewerForm::initData()/getEmailTemplates() (ReviewRequest + ReviewRequestSubsequent + alternates); AdvancedReviewerSearchHandler.js removes the non-matching option per path, so Reassign offers only ReviewRequestSubsequent and ordinary selection only ReviewRequest; live-probed: round-1 select offered "Review Request"; round-2 Reassign showed "Review Request Subsequent" as the sole option (re-verified 2026-07-26, both OMP stages) ·
<sup>c</sup> reviewerFormFooter.tpl `skipEmail`; EditorAction::addReviewer() (email skipped, notification unconditional); live-probed: skip-email assignment produced a "Request Sent" row and zero messages for that recipient ·
<sup>d</sup> ReviewerForm::__construct() (required + FormValidatorDateCompare GREATER_OR_EQUAL); HasReviewDueDate::getDueDates() (journal `numWeeksPerReview` / `numWeeksPerResponse`, fallbacks 4/3 weeks); live-probed: defaults +4w/+4w on the default journal, +2w/+6w on a scratch journal configured 2/6 ·
<sup>e</sup> reviewerFormFooter.tpl (LimitReviewFilesGridHandler expander + no-files warning); ReviewerForm::execute() (grants on selected files) ·
<sup>f</sup> reviewerFormFooter.tpl `reviewMethod` radios; ReviewerForm::initData() (`defaultReviewMode`, fallback double-anonymous); live-probed: double-anonymous preselected on the default journal ·
<sup>g</sup> reviewerFormFooter.tpl `isReviewPubliclyVisible`; ReviewerForm::initData() (context default); EditorAction::addReviewer() ·
<sup>h</sup> reviewerFormFooter.tpl (select gated on active forms); ReviewerForm::initData() (section default form); live-probed: absent on the form-less default journal, present with "None / Free Form Review" + form title on the scratch journal ·
<sup>i</sup> CreateReviewerForm (validators; generated password, must-change flag); createReviewerForm.tpl renders the group select only when the context has more than one reviewer group and a hidden pinned group otherwise — shared count-driven template, live-verified on OMP and on OJS 2026-07-26 (the default journal's Create form renders the group only as a hidden input with zero select elements while the same modal's Enroll form renders a visible one-option select — the positive control; the raw reload-reviewer-form payloads matched the DOM); the masthead checkbox is rendered checked + disabled on both forms in both apps (OJS re-verified live 2026-07-26) and neither form reads a submitted value — the enrollment stores the flag as on via a hard-coded argument to assignUserToGroup() (Known deviations); live-probed 2026-07-10: created account was assigned and received both the registration and the invitation email ·
<sup>j</sup> EnrollExistingReviewerForm (userGroup + userId required; server re-checks the target has no reviewer role, group is a reviewer group of this journal); enrollExistingReviewerForm.tpl renders the group select unconditionally — one option on a single-group journal, live-verified on OJS 2026-07-26 ("Enroll the user with this reviewer user group", sole option the journal's reviewer group); PKPReviewerGridHandler::getUsersNotAssignedAsReviewers() ·
<sup>k</sup> EditReviewForm (same date checks; review form only until `dateCompleted`); live-probed field set 2026-07-10 ·
<sup>l</sup> ReviewerNotifyActionForm (prefill + skip); ResendRequestReviewerForm (dates re-asked); ThankReviewerForm; ReviewReminderForm (template picker; one-click URL masked in preview + compiled body fetch); LogReviewerResponseForm; EmailReviewerForm (subject/body required); ReviewerGossipForm; all modals live-driven 2026-07-10

## Rules & state

**The panel and its statuses**

1. The panel is per review round: each round's tab lists only that round's
   assignments, and the Add Reviewer picker assigns into the currently selected
   round. <sup>a</sup>
2. An assignment's status is always **computed from its milestones** (invited,
   answered, due dates, submitted, confirmed, thanked, declined, cancelled) — there
   is no editable status field. A reviewer-declared competing interest shows as a
   badge on any status. The statuses the panel shows: <sup>b</sup>

   | Status | When it shows | Extra info shown |
   |--------|---------------|------------------|
   | **Request Sent** | Invited, response not yet due | ⚠ a "Response due" line is computed but never rendered (Known deviations) |
   | **Overdue** (in red) | The response deadline has passed, or the review is due today or already past | — |
   | **Request Accepted** | The reviewer accepted | The review due date |
   | **Request Declined** | The reviewer declined | An explanatory tooltip |
   | **Request Cancelled** | The assignment was cancelled | An explanatory tooltip |
   | **Request Resent** | A declined reviewer was re-invited | ⚠ the *review* due date, printed under the "Response due" label (Known deviations) |
   | **Review Submitted** | The reviewer submitted the review | The reviewer's recommendation |
   | **Review Viewed** | An editor opened the review without confirming | The reviewer's recommendation |
   | **Complete** | An editor confirmed the review | The reviewer's recommendation |
   | **Reviewer Thanked** | The thank-you was sent | The reviewer's recommendation |

3. Row actions follow the status: <sup>c</sup>
   - overdue rows — reminders are the headline action;
   - submitted/viewed rows — Read Review;
   - confirmed rows — Thank Reviewer + Revert Decision;
   - declined rows only — Resend Review Request;
   - cancelled rows only — Reinstate (these rows lose Review Details, Edit and
     the unassign/cancel actions);
   - while the reviewer hasn't answered — Log Response.

**Assigning**

4. A reviewer can be assigned at most once per round — the picker locks
   already-assigned candidates and the server independently rejects duplicates
   and non-reviewer accounts. ⚠ Those rejections show nothing on screen: the
   modal stays open without any message and its submit button becomes inert
   until the dialog is reopened (Known deviations, ledger 269). <sup>d</sup>
5. Assigning stamps the assignment and notification dates, applies the chosen
   dates/type/visibility/files/form, sends the request email (unless skipped)
   built from the chosen template with the editor's edited body, and gives the
   reviewer an in-app task notification. When the journal has one-click reviewer
   access enabled, the request email's link gives the reviewer that one-click
   access (`reviewer-response` owns what the reviewer does with it). <sup>e</sup>
6. Creating a new reviewer additionally creates the user account (emailing a
   registration welcome with a temporary password unless skipped) and enrolls it
   in the journal's reviewer group (the group chosen on the form, when the
   journal offers a choice — Fields & validation); enrolling an existing user
   adds the chosen reviewer group to their account. Both then run the normal assignment of rule 5. If the
   candidate matches an author reviewer suggestion, the suggestion is marked
   approved (`reviewer-suggestions`). <sup>f</sup>

**Unassign, cancel, reinstate, resend**

7. **Unassign vs Cancel is one action with two outcomes**, and the menu labels it
   accordingly: while the reviewer has not yet answered, "Unassign Reviewer"
   *deletes* the assignment — the row disappears; once the reviewer has answered
   (accepted *or* declined), "Cancel Reviewer" keeps the row and marks it
   Cancelled. Either way the reviewer's pending task notification is withdrawn
   and, unless skipped, a cancellation email is sent; if the reviewer holds no
   other active assignment on the submission, they are also dropped from its
   tasks and discussions (rule owned by `tasks-discussions`). <sup>g</sup>
8. **Reinstate** undoes a cancellation: the assignment returns to the state its
   milestones imply (e.g. straight back to Request Accepted), with an optional
   notification email. <sup>h</sup>
9. **Resend after decline** clears the decline, resets both due dates to the
   values entered in the modal, and puts the row in Request Resent — the reviewer
   is asked again (optional email), and can now answer afresh; the editor can
   also log the answer on their behalf again. <sup>i</sup>
10. **Log Response** records the accept/decline exactly as if the reviewer had
    answered (the reviewer-side consequences live in `reviewer-response`); the row
    moves to the corresponding status immediately. <sup>j</sup>

**Reading, confirming, thanking**

11. **Read Review** opens the full review: completion date, recommendation,
    the reviewer's comments separated into "For author and editor" and the
    editor-only stream, review-form responses when a form was used, and the
    reviewer's attached files — plus an upload slot so an editor can attach a
    review file the reviewer delivered elsewhere. A "Download Review Form" menu
    exports the review as PDF or XML, in a full variant and an author-friendly
    variant (redaction rules per `review-anonymity`). Merely opening a
    fresh submitted review marks it **Review Viewed**. Read Review — and with
    it the whole "Download Review Form" menu — is offered only while the
    review sits in Review Submitted or Review Viewed; confirming removes it
    from the row's actions, and "Revert Decision" (rule 13) is the way back to
    reading or exporting. <sup>k</sup>
12. **Confirming** (the modal's confirm button) marks the review **Complete**,
    records the private reviewer rating (1–5 stars, never shown to the reviewer),
    withdraws the reviewer's task notification, and attempts an ORCID deposit of
    the review for reviewers with a verified ORCID (machinery in `orcid`). In OJS
    the same modal lets the editor **set or adjust the reviewer's recommendation
    on their behalf**; a change is written to the assignment and logged as a
    by-proxy recommendation. ⚠ The activity-log entry for the confirmation itself
    is written on the wrong occasions (Known deviations). <sup>l</sup>
13. **Revert Decision** (offered on Complete and Thanked rows) asks for
    confirmation, then marks the review unconsidered: the row returns to Review
    Submitted and the review must be confirmed again; note history is
    preserved. <sup>m</sup>
14. **Thank Reviewer** sends the editable acknowledgement email (skippable) and
    stamps the acknowledgement, moving the row to Reviewer Thanked; if the
    review hadn't been confirmed yet, thanking also counts as considering
    it. <sup>n</sup>

**Ongoing management**

15. **Edit** applies new due dates, review type, public visibility and the file
    restriction at any time before cancellation; when the dates or the review type
    actually change, the reviewer gets an "assignment changed" task notification
    and (unless they blocked that email) an email. <sup>o</sup>
16. **Send Reminder** mails the chosen reminder to the reviewer and stamps the
    reminded date shown in History. Automated overdue reminders are a scheduled
    task (`scheduled-tasks`), not this manual action. <sup>p</sup>
17. **History** lists the assignment's dated milestones under the labels shown
    on screen — Assigned, Notified, Reminder, Confirm (or Declined), Completed,
    Acknowledged — ordered by date, not by lifecycle, so an early reminder can
    sit above later milestones. **Email Reviewer**
    sends a free-form message logged to the submission's email log. **Editorial
    Notes** edits the shared note about this reviewer — one note per reviewer,
    not tied to any single journal. <sup>q</sup>
18. The author-facing variant of the panel is pure disclosure — reviewer name,
    review type and Read Review on completed open reviews — and appears only when
    there is something disclosable; everything about who may see whom is owned by
    `review-anonymity`. <sup>r</sup>

<sup>a</sup> reviewerManagerStore.js (assignments filtered by the selected round); ReviewerManager mount per round in workflowConfigEditorialOJS.js ·
<sup>b</sup> ReviewAssignment::getStatus() (milestone-derived), getStatusKey(); useReviewerManagerConfig() getCellStatusItems(); ReviewerManagerCellStatusInfo.vue (accepts `description`, not the `message` prop the awaiting-response case sends; resent case formats `dateDue` under the response-due label); the two overdue boundaries are asymmetric — response-overdue only fires after the response due date's end of day (`responseDueTime < time()`), while review-overdue fires once the review date is today or earlier (`reviewDueTime < strtotime('tomorrow')`), so an accepted review due *today* already shows Overdue whereas an invited row whose response is due today stays "Request Sent" until day's end; all eleven internal statuses (ten display labels — "Overdue" covers both the response-overdue and review-overdue states) live-rendered 2026-07-10 (submissions 10/11/14/15 + a forced viewed state); boundary re-verified same day on scratch amrv5 — an accepted review due today rendered Overdue (statusId 6) while an invited row with its response due today stayed Request Sent (statusId 0) ·
<sup>c</sup> useReviewerManagerConfig() getItemPrimaryActions()/getItemActions(); live-probed per-status menus 2026-07-10 ·
<sup>d</sup> SelectReviewerListPanel.vue (`currentlyAssigned` lock); ReviewerForm::_isValidReviewer() (duplicate + reviewer-role check); EditorAction::addReviewer() (re-checks assigned); refusal presentation: _isValidReviewer() failures throw from ReviewerForm::execute() (HTTP 500, empty body — modal unchanged, submit disabled) and PKPReviewerGridHandler::updateReviewer()'s validate() branch answers JSONMessage(false) carrying no form; live-probed 2026-07-26 on OMP and OJS, bounded by the modal's required-field messages and a passing control assignment (ledger 269) ·
<sup>e</sup> EditorAction::addReviewer() (dates via setDueDates(); NOTIFICATION_TYPE_REVIEW_ASSIGNMENT at TASK level — live-verified notification row + "Invitation to review" email 2026-07-10; ReviewerAccessInvite when `reviewerAccessKeysEnabled`); ReviewerForm::execute() (review form, file grants, considered=NEW) ·
<sup>f</sup> CreateReviewerForm::execute() (account + ReviewerRegister email; live-verified both emails); EnrollExistingReviewerForm::execute(); ReviewerForm::execute() (ReviewerSuggestion::approveAndAttachReviewer()) ·
<sup>g</sup> useReviewerManagerConfig() getItemActions() (`dateConfirmed` label switch); UnassignReviewerForm::execute() (delete vs `cancelled`; notification withdrawal); PKPReviewerGridHandler::updateUnassignReviewer() (ReviewerUnassign mail = REVIEW_CANCEL template; task-participant pruning); live-probed: invited row deleted with "Request for Review Cancelled" email; declined/accepted rows offered "Cancel Reviewer" ·
<sup>h</sup> ReinstateReviewerForm::execute(); PKPReviewerGridHandler::updateReinstateReviewer() (ReviewerReinstate mail); live-probed: cancelled-after-accept row returned to "Request Accepted" ·
<sup>i</sup> ResendRequestReviewerForm::execute() (`declined` cleared, `requestResent`, dates re-set); ReviewAssignment::getStatus() (REQUEST_RESEND); live-probed incl. the reappearing Log Response action ·
<sup>j</sup> WorkflowLogResponseModal.vue → PKPReviewController::confirmReview() → ReviewerAction::confirmReview(); live-probed: accept-on-behalf flipped an overdue-response row to the accepted/overdue-review state ·
<sup>k</sup> PKPReviewerGridHandler::readReview() (comments/form responses/files; considered NEW→VIEWED); readReview.tpl (upload slot text, EditorReviewAttachmentsGridHandler); ReviewerManagerReadReviewModal.vue (4 export options → export-pdf/export-xml + exported-file download); modal live-driven 2026-07-10; availability: useReviewerManagerConfig() getItemActions() offers Read Review on submitted/viewed rows only — live 2026-07-26 (OMP, both stages): a Complete row's actions are Thank Reviewer / Revert Decision with no export path until the decision is reverted; all four export variants driven end to end on OMP and OJS 2026-07-26, every leg 200 — PDFs application/pdf, XML mislabeled text/html (ledger 271) ·
<sup>l</sup> PKPReviewerGridHandler::reviewRead() (quality + dateConsidered/dateCompleted, notification delete, SendReviewToOrcid); APP ReviewerGridHandler::reviewRead() (`reviewerRecommendationId` + SUBMISSION_LOG_REVIEW_RECOMMENDATION_BY_PROXY — live-verified event-log row 137 after changing the recommendation); readReview.tpl OJS override ("Set or adjust the reviewer recommendation", rating stars) ·
<sup>m</sup> PKPReviewerGridHandler::unconsiderReview() (considered=UNCONSIDERED + SUBMISSION_LOG_REVIEW_UNCONSIDERED); live-probed dialog "Unconsider this Review… history will be preserved" ·
<sup>n</sup> ThankReviewerForm::execute() (ReviewAcknowledgement mail — live-verified "Thank you for your review"; `dateAcknowledged`; considered backfill) ·
<sup>o</sup> EditReviewForm::execute() (change detection → NOTIFICATION_TYPE_REVIEW_ASSIGNMENT_UPDATED at TASK level + EditReviewNotify mail behind the blocked-emails check; live-verified notification row + "Your review assignment has been changed…" email after a due-date edit) ·
<sup>p</sup> ReviewReminderForm::execute() (ReviewRemind mail, `dateReminded`, SUBMISSION_LOG_REVIEW_REMIND; live-verified email + log row + stamp); TASK-reviewreminder (scheduled) is owned by scheduled-tasks ·
<sup>q</sup> PKPReviewerGridHandler::reviewHistory() (date list — live-rendered); reviewHistory.tpl renders the milestones date-sorted with the labels quoted in the rule — live-verified 2026-07-26 on both OMP review stages (shared template): the Reminder line rendered immediately after sending and after a reload, a completed+acknowledged row rendered its full label set, and a declined+reminded row sorted the older reminder to the top; sendEmail() (EmailReviewerForm; logged REVIEW_NOTIFY_REVIEWER), gossip() ·
<sup>r</sup> workflowConfigAuthorOJS.js (open-and-completed gate); useReviewerManagerConfig() getColumns()/getItemPrimaryActions() (`redactedForAuthors`); AuthorReviewerGridHandler; live-probed as the submitting author (3 columns, single open-review row, working read modal; no panel without a completed open review)

## Side effects

- **Emails to the reviewer**, each with a submission email-log entry (log
  machinery owned by `email-delivery`): <sup>a</sup>
  - the review request (first round) or subsequent-round request
  - the assignment-changed notice
  - the manual reminder
  - the cancellation notice
  - the reinstatement notice
  - the renewed request after a decline
  - the thank-you
  - the free-form Email Reviewer message
  - for a newly created account, the reviewer registration welcome with the
    temporary password

  Request/cancel/reinstate/resend/thank emails can each be skipped with their
  "Do not send email" checkbox.
- **In-app notifications**: a task-level "new review assignment" notification
  on assign — withdrawn when the reviewer submits the review or is
  unassigned/cancelled (by editor-confirmation time the reviewer's own
  submission has already cleared it) — and a task-level "assignment changed"
  notification when dates or type change on edit (its email respects the
  user's blocked-emails list). ⚠ The "assignment changed" task is never
  withdrawn on its own: it outlives cancellation and confirmation alike and
  clears only when the assignment itself is deleted, so a cancelled reviewer
  keeps a stale task in their list (Known deviations, ledger 268). Assignment
  changes also refresh the round's status notification
  (`review-rounds-and-revisions`). <sup>b</sup>
- **Submission activity log** entries: <sup>c</sup>
  - reviewer assigned
  - review unassigned/cancelled
  - reviewer reinstated
  - request resent (recorded under the assigned-entry type with its own wording)
  - reminder sent
  - review confirmed ⚠ (mis-timed — Known deviations)
  - review reverted to unconsidered
  - recommendation set by proxy (OJS)

  The reviewer-side accepted/declined/completed entries belong to
  `reviewer-response`.
- **Cross-entity**: unassigning a reviewer's last active assignment prunes them
  from the submission's tasks & discussions; confirming a review triggers an
  ORCID deposit attempt for verified-ORCID reviewers; assigning can auto-approve a
  matching author reviewer suggestion. <sup>d</sup>

<sup>a</sup> mailables ReviewRequest / ReviewRequestSubsequent / EditReviewNotify / ReviewRemind / ReviewerUnassign (REVIEW_CANCEL) / ReviewerReinstate / ReviewerResendRequest / ReviewAcknowledgement / ReviewerRegister; email-log types REVIEW_REQUEST(_SUBSEQUENT), REVIEW_EDIT_NOTIFY_REVIEWER, REVIEW_REMIND, REVIEW_CANCEL, REVIEW_REINSTATED, REVIEW_RESEND, REVIEW_THANK_REVIEWER, REVIEW_NOTIFY_REVIEWER; subjects live-verified in Mailpit 2026-07-10 ·
<sup>b</sup> EditorAction::addReviewer(); PKPReviewerGridHandler::reviewRead(); UnassignReviewerForm::execute(); EditReviewForm::execute(); Repository::updateReviewRoundStatus(); withdrawal scope: reviewRead() and UnassignReviewerForm::execute() delete only NOTIFICATION_TYPE_REVIEW_ASSIGNMENT, and the reviewer's own submit (PKPReviewerReviewStep3Form) deletes that same type — the …_UPDATED row is removed only together with the assignment row; live-verified 2026-07-26 on OMP (both stages) and OJS: cancel and confirm each left the updated task listed for the reviewer, while unassigning an unanswered row removed the assignment and both task rows (ledger 268) ·
<sup>c</sup> event types SUBMISSION_LOG_REVIEW_{ASSIGN,CLEAR,REINSTATED,REMIND,UNCONSIDERED,CONFIRMED,RECOMMENDATION_BY_PROXY}; ResendRequestReviewerForm::execute() (REVIEW_ASSIGN type, resend wording); rows live-verified in the activity log table 2026-07-10 ·
<sup>d</sup> PKPReviewerGridHandler::updateUnassignReviewer() → Repo::editorialTask()->removeParticipantFromSubmissionTasks(); SendReviewToOrcid; ReviewerForm::execute()

## Settings that modify behavior

- **Review deadlines** (Settings → Workflow → Review): the weeks-to-respond and
  weeks-to-review settings drive the default response/review due dates on the
  assignment, resend and edit forms (falling back to 3 and 4 weeks). <sup>a</sup>
- **Default review mode** preselects the Review Type radio; **default public
  review visibility** preselects the Public Visibility checkbox. <sup>b</sup>
- **One-click reviewer access** makes the request emails carry the reviewer's
  one-click access link (and the reminder preview hides it from
  editors). <sup>c</sup>
- **Review forms** (their existence and active flag) gate the Review Form
  dropdown; a section's designated default form comes preselected. <sup>d</sup>
- **Reviewer suggestions enabled** adds the author-suggestion block to the
  picker; ⚠ with the setting on, an Assistant opening a review round first
  meets an error dialog (Known deviations, ledger 270). The setting is off on
  a newly created journal. <sup>e</sup>

<sup>a</sup> `numWeeksPerResponse` / `numWeeksPerReview`; HasReviewDueDate; live-verified 2/6-week scratch journal vs 4/4 default journal ·
<sup>b</sup> `defaultReviewMode`; context default review public visibility (ReviewerForm::initData(), EditorAction::addReviewer()) ·
<sup>c</sup> `reviewerAccessKeysEnabled`; EditorAction::createMail() (ReviewerAccessInvite); ReviewReminderForm::initData() (URL masked) ·
<sup>d</sup> ReviewerForm::fetch() (active forms), initData() (section default) ·
<sup>e</sup> `reviewerSuggestionEnabled`; PKPSelectReviewerListPanel::getConfig(); the workflow page mounts ReviewerSuggestionManager only when the setting is on (workflowConfigEditorialOJS.js), and schemas/context.json declares the field with no default — the seeded journal carries it on via bootstrap enrichment, a freshly created journal has no value at all (ledger 270)

## Cross-feature interactions

- **`review-anonymity`** — owns the three review types' visibility matrix, the
  author-facing redaction and the author-friendly export redaction; this spec
  only records where the mode is chosen (assignment + edit forms).
- **`reviewer-response`** — the reviewer's own accept/decline and review
  submission; Log Response and confirm-on-behalf write into that same journey.
- **`review-rounds-and-revisions`** — round creation/selection and round-status
  notices; this panel only reads the selected round.
- **`reviewer-suggestions`** — the suggestion block in the picker and the
  prefill/auto-approve on assignment.
- **`review-forms`** — building forms and reading form responses; this spec owns
  only the per-assignment form choice.
- **`scheduled-tasks`** — automated response/review reminders and their
  templates; only the manual reminder is owned here.
- **`orcid`** — the review-deposit machinery behind confirm-time and manual
  deposits.
- **`tasks-discussions`** — participant pruning on unassignment.
- **`email-delivery`** — the email log where every reviewer email lands.
- **`user-management`** — Log In As semantics and the gossip note as user data.
- **`open-peer-review-display`** — what the Public Visibility flag ultimately
  exposes to readers.
- **`editorial-dashboards`** — how an author who also holds an editorial role
  reaches their own submission's workflow; note that reaching it does not shield
  the panel — the editorial Reviewers panel still renders in full for such a
  user, and it is the author denial recorded in Actors that refuses their
  management actions (see Open questions on the display divergence).

## Canonical scenarios

1. **Assign from the pool** — a Section Editor assigned to a submission in review
   opens Add Reviewer, searches the pool, picks a candidate, keeps the default
   dates and review type, and sends the request. The row appears as "Request
   Sent"; the reviewer gets the invitation email and an in-app task
   notification. <sup>s1</sup>
2. **Skip the email** — a Journal Manager assigns a reviewer with "Do not send
   email to Reviewer" ticked: the row still appears and the in-app notification
   fires, but no invitation email is sent. <sup>s2</sup>
3. **Conflict warning and unlock** — in Add Reviewer, a candidate who could know
   the authors (a journal manager who also reviews) shows a warning notice in place
   of the usual selection; the editor reads the warning, chooses "Unlock" — the
   entry now offers "Select Reviewer" — and assigns anyway. <sup>s3</sup>
4. **Create or enroll a reviewer mid-assignment** — a Journal Manager uses "Create
   New Reviewer" inside Add Reviewer to make a brand-new account and assign it in
   one flow (the new user gets a registration email and the review request); an
   Assistant with review-stage access sees neither "Create New Reviewer" nor
   "Enroll Existing User". <sup>s4</sup>
5. **Reassign last round's reviewer** — the submission enters a second review
   round. In Add Reviewer, the reviewers who completed round one appear at the top
   of the list, each with a "Reassign" button. Reassigning one opens the normal
   request form with the predefined message already set to "Review Request
   Subsequent" — the email written for re-reviewing a revised submission, not the
   first-time invitation. <sup>s5</sup>
6. **Unassign before an answer vs cancel after** — unassigning a reviewer who
   never answered removes the row outright; cancelling one who accepted keeps a
   "Request Cancelled" row; both send the cancellation email unless skipped. <sup>s6</sup>
7. **Reinstate a cancelled reviewer** — on a "Request Cancelled" row, the editor
   uses "Reinstate" and keeps the prefilled notification email; the reviewer is
   notified and the row returns to "Request Accepted". <sup>s7</sup>
8. **Decline → resend cycle** — on a declined row, the editor uses "Resend Review
   Request" and sets fresh due dates; the row shows "Request Resent" and the
   editor may again log the response on the reviewer's behalf. <sup>s8</sup>
9. **Read, rate, confirm, and set the recommendation by proxy** — an editor opens
   a submitted review (the row changes to "Review Viewed"), adjusts the reviewer's
   recommendation, rates the review, and confirms: the row shows "Complete" with
   the new recommendation, and the activity log records the by-proxy
   recommendation. "Revert Decision" then drops the row back to "Review
   Submitted". <sup>s9</sup>
10. **Thank the reviewer** — from a Complete row, the editor sends the prefilled
    thank-you; the reviewer receives it and the row moves to "Reviewer
    Thanked". <sup>s10</sup>
11. **Edit an in-flight assignment** — the editor moves the review due date; the
    row shows the new date and the reviewer receives the assignment-changed
    notification and email. <sup>s11</sup>
12. **Remind an overdue reviewer** — an overdue row's headline action is "Send
    Reminder"; it opens a prefilled reminder email, and sending it delivers the
    email and stamps the reminded date in the row's History. <sup>s12</sup>
13. **The author's window** — the submitting author sees no reviewer panel while
    reviews are anonymous or unfinished; once an open review is completed, a
    redacted panel appears with just the reviewer, the type and Read
    Review. <sup>s13</sup>

<sup>s1</sup> seed a submission in external review via the submission scenario (participants: a senior editor + a section editor; spare seeded reviewers unassigned); probed 2026-07-10 on submission 11 (a seeded reviewer account as submitter) ·
<sup>s2</sup> probed on scratch journal amrj2 (manager-reviewer target, Mailpit count 0) ·
<sup>s3</sup> needs a reviewer who also holds a managerial role — scenario users with roles editor+reviewer on a scratch journal ·
<sup>s4</sup> probed as amred1 (created "Nova Probe"; two Mailpit messages) and amrasst1 (funding-group assistant; options absent) ·
<sup>s5</sup> seed decisions sendExternalReview→requestRevisions→newExternalRound with a completed round-1 reviewer; probed on submission 15 ·
<sup>s6</sup> probed on submissions 10 (the invited reviewer's row deleted, "Request for Review Cancelled" email) and 10/11 (accepted/declined rows offer Cancel) ·
<sup>s7</sup> probed on submission 11 (a seeded reviewer cancelled→accepted) ·
<sup>s8</sup> probed on submissions 10 + 14 (declined seeded via reviewer status) ·
<sup>s9</sup> probed on submission 10 (a seeded reviewer; event-log rows for proxy recommendation + unconsider) ·
<sup>s10</sup> probed on submission 10 ("Thank you for your review" in Mailpit) ·
<sup>s11</sup> probed on submission 10 (a seeded reviewer; "Your review assignment has been changed…") ·
<sup>s12</sup> probed on submission 11 (overdue seeded via past due dates; "A reminder to please complete your review") ·
<sup>s13</sup> probed as the author account on submission 12 (one open completed + one double-anonymous completed + one open accepted; only the first is listed)

## Known deviations (as-built ≠ intent)

- ⚠ **"Send Review To ORCID" is offered in every status and to roles the API
  refuses** (permissions table, rule 12) — the action's status condition compares
  against a bare constant instead of the row's status
  (useReviewerManagerConfig.js getItemActions(): `reviewAssignment.reviewerHasOrcid &&
  pkp.const.REVIEW_ASSIGNMENT_STATUS_COMPLETE`, always truthy), so any
  verified-ORCID reviewer's row shows it from the moment of invitation; and the
  menu is role-blind while `POST reviews/{submissionId}/{reviewAssignmentId}/sendToOrcid`
  is gated to SITE_ADMIN/MANAGER/SUB_EDITOR — an Assistant's click dies with 401
  after the confirm dialog (live 2026-07-10, scratch journal, funding-group
  assistant + verified-ORCID reviewer, "Request Sent" row). Suspected intent:
  `statusId === COMPLETE` and either an assistant-capable role list or a hidden
  action. **PROPOSED ledger row.**
- ⚠ **"Log Response" is offered to Assistants but refused server-side**
  (permissions table) — the item action only checks that the reviewer hasn't
  answered, while `PUT reviews/{submissionId}/{reviewAssignmentId}/confirmReview`
  allows only SITE_ADMIN/MANAGER/SUB_EDITOR; the assistant's submit returns 401
  and the modal gives no meaningful feedback (live 2026-07-10). Note the legacy
  grid granted assistants nearly all reviewer ops, so the narrower REST role list
  may be the accident. **PROPOSED ledger row** (same family as ledger rows 114/124
  — role-list vs UI divergence, here UI-permits/API-denies).
- ⚠ **"Request Resent" rows label the review due date as "Response due"**
  (rule 2) — the resent status case feeds `reviewAssignment.dateDue` into the
  response-due string (useReviewerManagerConfig.js REQUEST_RESEND case); live: a
  scratch journal with 2-week response / 6-week review defaults showed "Response
  due: 2026-08-21" (the review date) right after a resend. **PROPOSED ledger row**
  (cosmetic).
- ⚠ **"Request Sent" rows never show their response-due date** (rule 2) — the
  awaiting-response case passes the date as a `message` prop that
  ReviewerManagerCellStatusInfo.vue does not declare (it renders `description`);
  every awaiting-response row renders the bare title while the code clearly
  intends a "Response due: …" line (live: all invited rows dateless, all other
  dated statuses render). **PROPOSED ledger row** (one-word prop fix).
- ⚠ **The "review confirmed" activity-log entry fires on the wrong
  confirmations** (rule 12, Side effects) — PKPReviewerGridHandler::reviewRead()
  writes SUBMISSION_LOG_REVIEW_CONFIRMED only `if ($reviewAssignment->isRead())`,
  but the repository's edit() clones the object, so the check sees the
  *pre-confirm* considered value: the first, real confirmation is never logged,
  while redundant re-confirms of an already-confirmed review are (live
  2026-07-10: confirm after unconsider at 10:11 → no row; re-confirm at 10:12/10:13
  → rows 138/139). **PROPOSED ledger row.**
- ⚠ **The "Appear on the masthead" checkbox on Create New Reviewer / Enroll
  Existing User is inert** (Fields & validation) — expected: a choice that
  eventually lists the new reviewer on the public editorial masthead;
  observed: the checkbox is pre-ticked and disabled — the editor can neither
  tick nor untick it — the enrollment records the flag as on regardless of
  what the form submits (the forms pass a hard-coded value and read no
  submitted one), and the masthead never reads that flag for reviewer groups:
  it excludes the reviewer role from its role sections and draws its reviewer
  names from reviews completed in the previous calendar year instead (probed
  on a press 2026-07-26, bounded — the role sections and the
  previous-year reviewer list both rendered while the newly created reviewers
  did not; the journal behavior follows from the same shared forms and
  masthead handler — the OMP-specific stage consequence is in App
  variations). **Ledger row 266.**
- ⚠ **The "assignment changed" task notification is never withdrawn** (Side
  effects) — expected: the task leaves the reviewer's list together with the
  assignment it announces; observed: cancelling the assignment and confirming
  the review each withdraw only the "new review assignment" task type
  (UnassignReviewerForm::execute() and PKPReviewerGridHandler::reviewRead()
  delete NOTIFICATION_TYPE_REVIEW_ASSIGNMENT only), so the "Review assignment
  updated." task outlives both and sits in the reviewer's task list even for
  a cancelled assignment; it disappears only when the assignment row itself
  is deleted (unassigning an unanswered reviewer removes both task types).
  The sibling precision: the "new review assignment" task is withdrawn when
  the reviewer submits the review (PKPReviewerReviewStep3Form), so the
  confirm-time deletion normally finds it already gone (live 2026-07-26, OMP
  both stages + OJS). **Ledger row 268.**
- ⚠ **Add Reviewer's server-side rejections are invisible** (rule 4) —
  expected: a message in the modal explaining the refusal; observed: when the
  server rejects the chosen candidate (already assigned to this round, or not
  a reviewer), the request dies as an uncaught exception
  (ReviewerForm::execute() → _isValidReviewer(); HTTP 500, empty body) and
  the modal shows nothing — no error text anywhere, the submit button left
  disabled until the dialog is reopened; the ordinary validation branch is
  silent too (PKPReviewerGridHandler::updateReviewer() answers a false status
  with an empty payload under a redisplay-the-form comment that sends no
  form). Bounded: empty required fields in the same modal do render "This
  field is required." messages, and a valid assignment closes it (live
  2026-07-26, OMP + OJS). **Ledger row 269.**
- ⚠ **An Assistant opening a review round meets a blocking error dialog**
  (Actors & permissions) — expected: the workflow page opens normally for an
  assigned Assistant whose role covers the review stage; observed: the page
  renders and is then covered by a modal "Error / The current role does not
  have access to this operation. / OK", because the reviewer-suggestion panel
  mounted with the round calls an endpoint whose role list omits Assistants
  (ReviewerSuggestionController::getRouteGroupMiddleware() authorizes
  SITE_ADMIN/MANAGER/SUB_EDITOR/AUTHOR while the workflow config mounts
  ReviewerSuggestionManager for anyone who can open the round). Reachability:
  the panel is mounted only when the journal's "Reviewer Suggestion at
  Submission" setting is on — on for the seeded journal via its bootstrap
  enrichment, absent on a freshly created journal (live 2026-07-26, OJS +
  OMP; on OMP the request is issued on the external round). **Ledger
  row 270.**
- ⚠ **The XML review export is served with a web-page content type**
  (rule 11) — expected: an XML type on the downloaded file; observed: both
  XML variants arrive as `text/html; charset=utf-8` while the PDF variants on
  the same two-step route are correctly `application/pdf`; the payloads
  themselves are genuine XML with the right attachment filename (live
  2026-07-26, OJS + OMP). **Ledger row 271.**
- Existing ledger row 52 already covers the Add Reviewer dialog's
  reviewer-suggestion list quirks ("Select undefined" accessible names; no
  live-refresh after enroll-and-assign from a suggestion) — cross-referenced, not
  re-proposed.
- Existing ledger row 77 covers the "For editor" vs "For editor only" label seen
  in the Read Review modal's private-comments heading.

## Open questions

1. Are Assistants meant to manage reviewer responses at all? The legacy grid
   grants them almost every reviewer operation (all but create/enroll/gossip),
   but the two newer REST endpoints this panel calls (log response on behalf,
   manual ORCID send) exclude them. Which side is the intended policy?
2. Resending a declined request logs its event under the *assigned* event type
   (with resend wording) rather than a dedicated type
   (ResendRequestReviewerForm::execute() uses SUBMISSION_LOG_REVIEW_ASSIGN) —
   intended reuse or a missing constant?
3. The Public Visibility checkbox ("Publicly Show Reviewer Comments") is offered
   for every review type, including double-anonymous — should it be limited to
   (or only meaningful for) open reviews, and is its interaction with the modes
   documented anywhere beyond open-peer-review-display?
4. The manual "Send Review To ORCID" duplicates the automatic deposit attempted
   at confirmation (PKPReviewerGridHandler::reviewRead() →
   SendReviewToOrcid) — is the manual action meant as a retry for failed
   deposits only (and should it then be gated to confirmed reviews, per Known
   deviations)?
5. Thanking an unconfirmed review counts as consideration
   (ThankReviewerForm::execute() backfills the considered flag), yet a review
   that was thanked and later unconsidered displays as "Review Viewed" rather
   than "Review Submitted" (ReviewAssignment::getStatus() orders the
   acknowledged check first) — is that the intended reading of a reverted,
   thanked review?
6. An author who also holds an editorial role on their own submission sees the
   **full editorial Reviewers panel** — Add Reviewer button and every per-row
   management action (Edit, Unassign/Cancel, Send Reminder, Thank, Log Response,
   Send To ORCID) — because the editorial workflow mounts the panel unconditionally
   for anyone with editorial-dashboard access, while the grid handler's author
   denial only refuses the operations server-side (mount unconditional and client
   action config role-blind in code; live 2026-07-10, scratch amrv5: a submitter
   enrolled in both the author and section-editor groups had every management op
   refused with "The current role does not have access to this operation", while
   read-type ops were allowed for the open review and refused for the
   double-anonymous one, matching the anonymous-denial list). Should the panel
   hide management affordances from an
   author-editor rather than show buttons that all fail on click, or is the
   server refusal the intended (defence-in-depth) design?
7. The reviewer-directory endpoint this spec claims (atlas
   API-user-get-reviewers, the picker's search source) is mounted in all three
   apps: on OPS it answers with an empty collection on a default install and a
   populated one once a Preprint Server Manager creates a Reviewer role there,
   even though every surface of this spec is absent (App variations — OPS,
   verified 2026-07-26). Should the atom's OPS half move to a spec that owns
   user directories, or stay claimed here under the absence paragraph?

## App variations — OMP / OPS

Read the base spec through APP-GLOSSARY.md (journal → press, Journal Manager →
Press Manager, article → monograph, section → series, and so on). The title
badge scopes this whole feature to OJS and OMP: every rule, field, status,
modal, side effect, setting and scenario above claims both of those apps unless
overridden below — and none of it exists in OPS. Overrides are keyed to the
base text by quoted stubs.

### OMP

**Parity declaration.** OMP runs review twice — an Internal Review stage sits
before the base spec's review stage (on-screen: External Review) — and this
feature is one machinery mounted on both: the panel and its computed statuses,
the picker with its stats and filters, the per-row actions and their modals,
the emails, notifications and log entries, the settings, and the author-facing
variant apply identically to Internal and External Review, per round, except
as overridden below. The parity claim was confirmed on a running press — a
representative battery found no divergence beyond the overrides
below. <sup>m1</sup>

- "everyone holding a reviewer role" — the role is split into two groups,
  Internal Reviewer (internal rounds) and External Reviewer (external rounds),
  and the pool follows the round: searching or filtering the picker returns
  only candidates whose group belongs to the round's stage. ⚠ As built, two
  edges deviate from that scoping: the picker's first, unsearched page lists
  both groups' reviewers — a search immediately re-scopes the list
  (ledger 264) — and if a wrong-stage candidate is selected anyway, say from
  that unsearched first page, the assignment form accepts them instead of
  refusing (ledger 265). <sup>m2</sup>
- "reviewer group to enroll into" — the round's own group is the only one
  reachable: whichever form is used, the new or enrolled reviewer lands in the
  round's stage group. The form shapes themselves — a one-option choice on
  Enroll Existing User, no visible group control on Create New Reviewer — are
  the ordinary single-group rendering a default journal shows too (Fields &
  validation); the OMP delta is which group that is, chosen by the round's
  stage. The enroll search also excludes holders of either reviewer group, so
  an internal reviewer cannot be enrolled into the external group from this
  picker, nor the reverse. <sup>m3</sup>
- "recommendation on their behalf" — reviewer recommendations do not exist in
  OMP: reviewers are never asked for one, the read-review modal neither shows
  a recommendation nor offers the set-or-adjust control, the by-proxy log
  entry never occurs, and the status rows whose extra info is the reviewer's
  recommendation show none; the review's XML export carries an empty
  recommendation entry where OJS writes the reviewer's recommendation in
  (ledger 272). <sup>m4</sup>
- "attempts an ORCID deposit" — the deposit is a no-op in OMP: confirming a
  review and the manual send-to-ORCID row action both run without error, and
  nothing is ever sent to the reviewer's record; the action's status-blind
  availability (first Known deviation) reproduces, offering a button that can
  never deposit. <sup>m5</sup>
- "at least one completed open review" — on an internal round the author's
  redacted variant appears once the round has a review of the open type,
  whether or not that review is finished — though a declined or cancelled one
  does not count — laxer than the external round's gate, which also requires
  the open review to be completed. Before any open review completes, what
  appears is an empty panel: the author sees the redacted Reviewers table with
  no rows (the matching external case shows no panel at all), so the early
  disclosure is the panel's existence, not any reviewer; rows appear as open
  reviews complete, on either stage. It remains an open intent question
  whether authors should see internal rounds at all (a possible future
  Known-deviations entry, pending that decision). <sup>m6</sup>
- "set the recommendation by proxy" — scenario 9 runs without its
  recommendation steps in OMP: read, rate and confirm work as written, with no
  recommendation to adjust and no by-proxy log row. <sup>m4</sup>
- "enters a second review round" — round counting restarts per stage, and
  scenario 5's reassignment offer reads only the previous round of the *same*
  stage: a second internal round and a second external round each list their
  own round-one reviewers with "Reassign" and the "Review Request Subsequent"
  message, but when a monograph moves from Internal Review into External
  Review it starts external round one — no one is offered for reassignment,
  the reviewer who just completed the internal round sits in the ordinary list
  with a plain "Select Reviewer", and the only message offered is the
  first-time "Review Request". <sup>m8</sup>
- "Appear on the masthead" — ⚠ the base deviation (the checkbox cannot be
  changed and is never read for reviewer groups — Known deviations) carries an
  extra pin here: the masthead's reviewer names come solely from
  external-round reviews completed in the previous calendar year, so a
  reviewer who only ever completes internal rounds can never appear on the
  masthead — and even an external-round reviewer is listed only in the year
  after completing (ledger 266). <sup>m7</sup>

### OPS

**Absent — nothing here exists in OPS.** A preprint lives in the Production
stage from creation to posting (what posting does to its internal stage
marker is `workflow-stage-navigation`'s record), so a review round can never
arise, and no surface of this spec is usable there: the Reviewers panel is
never mounted, the Add Reviewer picker never opens, the per-assignment
actions with their emails, notifications and log entries are absent, and the
workflow settings offer no Review tab. No reviewer user group is installed by
default — an install fact, not an app impossibility: a Preprint Server
Manager can create a Reviewer role from the roles settings and people can
then hold it, yet every surface of this spec stays absent even then (what a
signed-in holder of that role sees of their own is other features' scope).
Every rule, field, status, scenario, setting and deviation above is out of
scope for OPS (the title badge is the contract; the glossary's absence rule
is the reader's safety net). The absence was confirmed on a running server —
by menu, by direct web address, and through the participant surfaces, before
and after a reviewer role existed; the shared machinery leaves a few inert
traces behind the scenes, none reachable from any screen (the footnote lists
them). <sup>o1</sup>

<sup>m1</sup> omp-main lib/ui-library useWorkflowConfigOMP.js deep-merges the OJS editorial/author configs (deepMerge(ConfigEditorialOJS, ConfigEditorialOMP)), so the external-stage ReviewerManager mount is the OJS config object verbatim (workflowConfigEditorialOJS.js) while workflowConfigEditorialOMP.js mounts the same ReviewerManager per internal round (same props minus recommendations) and workflowConfigAuthorOMP.js mounts the redacted author variant on both stages; omp-main controllers/grid/users/reviewer/ReviewerGridHandler.php is an empty subclass of PKPReviewerGridHandler (every grid op shared); all picker/assignment/action forms and modals are shared lib/pkp (omp-main templates/controllers/grid/users/reviewer/ holds only the readReview.tpl override — see m4); omp-main api/v1/reviews/index.php mounts the shared PKPReviewController; mail Repository::map() is merged unchanged and omp-main registry/emailTemplates.xml seeds the full review family (REVIEW_REQUEST, REVIEW_REQUEST_SUBSEQUENT, REVIEW_CANCEL, REVIEW_REINSTATE, REVIEW_RESEND_REQUEST, REVIEW_ACK, REVIEW_REMIND, REVIEW_EDIT, REVIEWER_REGISTER); the base's section-default review form works per series via shared ReviewerForm::initData() + Application::getSectionIdPropName() = 'seriesId' + omp schemas/section.json reviewFormId; the shared context schema carries defaultReviewMode, defaultReviewPublicVisibility, numWeeksPerResponse/numWeeksPerReview, restrictReviewerFileAccess and reviewerAccessKeysEnabled, and omp schemas/context.json adds reviewerSuggestionEnabled — internal-stage parity live-probed 2026-07-26 (MULTIAPP-PLAN §7b representative-subset battery: canonical scenarios 1, 6, 8 and 12 plus the full status walk of rule 2 re-run on Internal Review rounds — all ten display labels, per-status action menus, modals, emails and date stamps byte-identical to the external round; the verification pass widened the evidence 2026-07-26 — assign/edit task notifications, the picker's five filters with identical parameters and defaults, per-candidate stats on a rated control reviewer, the role-matrix menus with server-bounded refusals, the overdue boundary and the review exports all re-measured internal ≡ external; the series-default review-form check required activating the seeded forms by hand — the scenario seeder creates review forms inactive with no way to declare a series default, a pilot-3-relevant harness gap recorded in the pilot-2 probe report §16.3) ·
<sup>m2</sup> omp-main registry/userGroups.xml — two groups on ROLE_ID_REVIEWER: Internal Reviewer stages="2", External Reviewer stages="3" (only the external group has permitSelfRegistration + masthead); scoping: AdvancedSearchReviewerForm::fetch() passes reviewStage = $reviewRound->getStageId() into the reviewers API, whose collector applies filterByWorkflowStageIds() via the user_group_stage join (lib/pkp PKPUserController::getReviewers(); classes/user/Collector.php); leak 1: PKPSelectReviewerListPanel::_getCollector() applies neither the stage nor the panel's stat filters, so the server-rendered first page of the picker is unscoped by stage or filter (it does honour the already-assigned lock and the round-2 pinning); leak 2: ReviewerForm::_isValidReviewer() checks only userHasRole(..., ROLE_ID_REVIEWER), never the group's stage — both live-probed 2026-07-26 and re-verified bounded: search and filter-only requests carry the round's stage on both stages (wrong-stage searches return the empty state; the same filter with the opposite stage flips exactly the group-only accounts); the unsearched first page rendered the identical candidate list on internal and external rounds — external-only accounts and filter-excluded candidates included — and submitting the assignment form for an external-only reviewer on an internal round completed normally, leaving a cross-stage assignment row (ledger 264, 265; pilot-2 probe report §§4–5; verification report D-9) ·
<sup>m3</sup> ReviewerForm::fetch() feeds the create/enroll group choice from Repo::userGroup()->getUserGroupsByStage($contextId, $reviewRound->getStageId(), ROLE_ID_REVIEWER) — only the round's stage group; PKPReviewerGridHandler::getUsersNotAssignedAsReviewers() excludes every reviewer-role holder regardless of group, so cross-group enrollment is unavailable from the picker; the one-option/no-control shapes are the shared count-driven templates (createReviewerForm.tpl renders a select only above one group, enrollExistingReviewerForm.tpl always renders it) — a default single-group OJS journal renders the identical pair (code-derived; the OJS fleet was not probed in this pass — verification report D-2); live-probed 2026-07-26: the enroll form showed a one-option select (Internal Reviewer on the internal round, External Reviewer on the external), the create form carries the group only as a hidden field pinned to the round's stage group — accounts created from each round landed in that round's group — and the enroll autocomplete returned no reviewer-group holder while a control search returned non-reviewer staff ·
<sup>m4</sup> omp-main templates/controllers/grid/users/reviewer/readReview.tpl blanks the reviewerRecommendations capture ("Not implemented in OMP") before including the shared readReview.tpl, where OJS instead injects its set-or-adjust block and OJS's app ReviewerGridHandler::reviewRead() writes reviewerRecommendationId + the by-proxy log entry — OMP's app handler is an empty subclass with no such override; ui-library useReviewerManagerConfig.js renders no recommendation cell when no recommendations prop is passed, and neither OMP workflow config passes one; watch item, not a graduation: the configurable-recommendation plumbing is half-wired in OMP (Application::hasCustomizableReviewerRecommendation() true, install/upgrade migrations present) but SettingsHandler::workflow() never exposes the settings tab and there is no reviewers/recommendations API route; live-probed 2026-07-26 on both stages: the read-review modal shows no recommendation and no set-or-adjust control (its only buttons are Download Review Form and Confirm), Submitted/Viewed/Complete/Thanked rows carry no recommendation line, and confirm/revert cycles wrote only the confirmed/unconsidered log entries — no by-proxy entry is producible, and the OJS-only recommendations API path answers not-found on OMP; the author's read modal (authorReadReview.tpl, fully shared, no OMP override) is blank by data rather than template — the assignment's recommendation id is always null on OMP; presses never receive the default recommendation set however they are created — only OJS's ContextService::addDefaultRecommendations() seeds it, so the recommendations table is empty for every press (ledger 263 — an app-level fact, broader than its scenario-API framing; also a pilot-3 fixture blocker; verification report D-11); the export XML's peer-review-recommendation custom-meta is emitted empty on OMP while OJS's export carries the recommendation text in the same element (live 2026-07-26, OMP + OJS; ledger 272) ·
<sup>m5</sup> omp-main classes/orcid/actions/SendReviewToOrcid.php extends PKPSendReviewToOrcid whose execute() is an intentional no-op ("currently only OJS" per its docblock); both call sites run in OMP — PKPReviewerGridHandler::reviewRead() at confirm time and the manual POST reviews/{submissionId}/{reviewAssignmentId}/sendToOrcid (mounted by omp-main api/v1/reviews/index.php) — and useReviewerManagerConfig.js offers the row action under the same status-blind condition recorded in Known deviations; live-probed 2026-07-26: the row action offered on never-accepted and Complete rows on both stages, the manual send returned success with an empty body and wrote no deposit setting, confirm-time deposits likewise wrote nothing, and a malformed control call drew a validation error — the API is live and the no-op is real ·
<sup>m6</sup> workflowConfigAuthorOMP.js gates the internal-round author ReviewerManager on getOpenReviewAssignmentsForRound() with redactedForAuthors, while the external round inherits the OJS gate getOpenAndCompletedReviewAssignmentsForRound() (workflowConfigAuthorOJS.js); the effective gate is "any open-type assignment that is neither declined nor cancelled" because the gate's input is the submission record the author receives, which already omits declined and cancelled assignments for a viewer without stage access (submission maps Schema.php) — those rounds look reviewer-less to the panel; whether authors should see internal rounds at all is omp-internal-review scope (pilot 3); live-probed 2026-07-26 with a full state table (verification report D-4): invited and accepted-but-uncompleted open reviews each rendered the three-column redacted panel with no rows for the author (the identically-staged external cases rendered no panel), declined-only and cancelled-only rounds rendered no panel, completed open reviews rendered a single row on both stages, an anonymous-only internal round rendered no panel, and Add Reviewer was never visible to the author ·
<sup>m7</sup> lib/pkp AboutContextHandler::getSortedMastheadUserGroups() builds the masthead role sections with excludeRoles([ROLE_ID_REVIEWER]), so the per-user masthead flag is never read for reviewer groups — and there is no choice to store: createReviewerForm.tpl and enrollExistingReviewerForm.tpl both render the checkbox checked + disabled, neither form reads a masthead user var, and assignUserToGroup() is called with the flag hard-coded on (a POST carrying masthead=0 was stored as 1); the masthead's reviewer names come from Repo::reviewAssignment()->getExternalReviewerIdsByCompletedYear($contextId, date('Y') - 1), whose DAO pins both stage_id = WORKFLOW_STAGE_ID_EXTERNAL_REVIEW and the previous calendar year — internal-round completions never qualify, and current-year external completions qualify only next year; live-probed 2026-07-26, bounded on a scratch press (verification report D-1): a masthead-flagged editor rendered in the role sections, an external review re-dated to the previous year rendered under "Peer Reviewers in Previous Year", the identically re-dated internal review did not, and neither newly created reviewer appeared despite the stored flag (shared forms and handler — the OJS side is claimed from that shared code, not probed; the external-stage pin is the OMP consequence) (ledger 266) ·
<sup>m8</sup> AdvancedSearchReviewerForm::fetch() computes the reassignment offer only when $reviewRound->getRound() > 1 and looks the previous round up within the same stage, while OMP restarts round numbering per stage — the internal→external transition hands the picker an empty last-round list; the per-path template narrowing is the shared AdvancedReviewerSearchHandler.js behavior recorded in footnote b of Fields & validation; live-probed 2026-07-26 (verification report D-5): internal round 1→2 and external round 1→2 both pinned the completing reviewer ("This reviewer completed a review in the last round.") with "Review Request Subsequent" as the sole message, while a monograph whose completed internal round moved into External Review round 1 listed that reviewer unpinned with "Select Reviewer" and "Review Request" as the only message ·
<sup>o1</sup> ops-main schemas/submission.json pins stageId (default 5, validation min:5/max:5; a posted preprint parks on the internal past-the-end marker recorded by workflow-stage-navigation) and classes/core/Application.php getApplicationStages() returns production only, so no review round can exist; registry/userGroups.xml defines no reviewer-role group (the stray ROLE_ID_REVIEWER in controllers/api/file/ManageFileApiHandler.php is dead wiring), but the role is creatable in-app — the shared roles settings offer Reviewer as a permission level (Application::getRoleNames(true), not overridden by OPS); live 2026-07-26 (OPS verification pass, probes C–E): a manager created such a group through Settings → Users & Roles (its sole stage checkbox, Production, is disabled — the group carries no stage; the public registration form's reviewer opt-in renders the untranslated key ##user.reviewerPrompt.userGroup##, a string family that exists only in OJS), a visitor self-registered into it, and GET api/v1/users/reviewers — the one endpoint of this spec that OPS mounts (ops-main api/v1/users/index.php) — went from an empty collection to a populated reviewer record, while the whole absence battery re-run unchanged: no panel, no picker, no per-assignment action; no OPS workflow config mounts ReviewerManager (workflowConfigEditorialOPS.js is production-only; the deep-merged OJS review-stage menu entries are unreachable — forcing their menu keys falls back to the production landing byte-identically); the editors' reviewer grid needs an app subclass of PKPReviewerGridHandler to be URL-resolvable and OPS has none (no controllers/grid/users/ directory); lib/pkp's AuthorReviewerGridHandler is routable and refused for every viewer — with the app's own stage id (5) the refusal is exactly the review-round authorization, other stage ids fail earlier at the stage check, an anonymous component call at stage access; there is no api/v1/reviews/index.php, so the shared PKPReviewController is unmounted and the reviews API paths answer not-found; classes/mail/Repository.php map() lists no review mailables and registry/emailTemplates.xml seeds none (one orphan row: REQUEST_REVIEW_ROUND_AUTHOR_RESPONSE, a template with no mailable in the OPS map); the Settings → Workflow Review tab sits behind hasReviewStage, false in OPS; the remaining inert traces — an open list of shared machinery, not a closed pair: review DB tables installed by shared migrations but never written, the submission payload's empty review keys (reviewAssignments, reviewRounds, reviewersNotAssigned), the shared context schema's review preferences (defaultReviewMode, numWeeksPerReview, …) which ops-main schemas/context.json keeps and the contexts API accepts writes to although nothing reads them without a review stage, and the stage-participant Assign form's shared anonymous-reviewer warning string with an always-empty reviewer-id list; live-probed 2026-07-26 (pilot-2 probe report §1 + OPS verification report; scratch OPS contexts; manager, moderator and author sessions, before and after the created role): no reviewer surface of this spec reachable by menu, forced menu key, legacy web address, grid or API — every negative bounded by a positive control in the same session; a signed-in holder of the created role lands on a reviewer-assignments page owned by editorial-dashboards / reviewer-response, outside this spec's surfaces

---

## Reference — entry points & surfaces

| Entry | Path | Atom |
|-------|------|------|
| Reviewers panel (per review round) | Dashboard → submission workflow → External Review stage; `ReviewerManager` mounted per round (editorial + redacted author variants) | VUE-reviewer-manager |
| Reviewer picker | Add Reviewer modal step 1; items from `GET api/v1/users/reviewers` (search + 5 stat filters) | VUE-select-reviewer-list-panel, API-user-get-reviewers |
| Legacy reviewer grid (backing AJAX) | `grid.users.reviewer.ReviewerGridHandler` ops: showReviewerForm/reloadReviewerForm, createReviewer/enrollReviewer/updateReviewer, editReview/updateReview, unassignReviewer/updateUnassignReviewer, reinstateReviewer/updateReinstateReviewer, resendRequestReviewer/updateResendRequestReviewer, readReview/reviewRead, editThankReviewer/thankReviewer, editReminder/sendReminder/fetchReviewReminderTemplateBody, unconsiderReview, sendEmail, reviewHistory, gossip, getUsersNotAssignedAsReviewers, fetchTemplateBody | GRID-grid-users-reviewer-reviewer-grid-handler |
| Log Response modal | Vue side modal → `PUT api/v1/reviews/{submissionId}/{reviewAssignmentId}/confirmReview` | FORM-log-reviewer-response-form, API-review-confirm-review |
| Review export | Read Review modal "Download Review Form" → `GET api/v1/reviews/{submissionId}/{reviewAssignmentId}/export-pdf|export-xml?authorFriendly=0|1` → `GET api/v1/reviews/{submissionId}/exports/{fileId}` | API-review-export-review-pdf, API-review-export-review-xml, API-review-get-exported-file |
| Manual ORCID deposit | Row action → `POST api/v1/reviews/{submissionId}/{reviewAssignmentId}/sendToOrcid` | API-review-send-to-orcid |
| Emails | REVIEW_REQUEST, REVIEW_REQUEST_SUBSEQUENT, REVIEW_CANCEL, REVIEW_REINSTATE, REVIEW_RESEND_REQUEST, REVIEW_ACK, REVIEW_EDIT, REVIEW_REMIND, REVIEWER_REGISTER templates (REVIEW_REMIND_AUTO stays with scheduled-tasks) | MAIL-review-request, MAIL-review-request-subsequent, MAIL-reviewer-unassign, MAIL-reviewer-reinstate, MAIL-reviewer-resend-request, MAIL-review-acknowledgement, MAIL-edit-review-notify, MAIL-review-remind, MAIL-reviewer-register |
| Notifications | reviewer task bell: new assignment + assignment updated | NOTIF-review-assignment, NOTIF-review-assignment-updated |
| Event log | assigned / cleared / reinstated / confirmed / unconsidered / reminder / by-proxy recommendation entries in the submission activity log | EVLOG-REV-ASSIGN, EVLOG-REV-CLR, EVLOG-REV-REIN, EVLOG-REV-CONF, EVLOG-REV-UNCON, EVLOG-REV-REM, EVLOG-REV-PROXY-REC |
| Data | `review_assignments` (+ settings), reviewAssignment JSON schema | DB-review_assignments, DB-review_assignment_settings, SCHEMA-review-assignment |
| Authorization | review-assignment-required policy on all per-assignment grid ops | AUTHZ-review-assignment-required-policy |
| Locale | `reviewer.list.*` picker strings | LOC-editor-reviewer-list |

## Reference — code anchors

- lib/pkp/classes/controllers/grid/users/reviewer/PKPReviewerGridHandler.php — all grid ops, role
  assignments, author denial lists; controllers/grid/users/reviewer/ReviewerGridHandler.php (OJS) —
  recommendation-by-proxy on reviewRead
- lib/pkp/controllers/grid/users/reviewer/form/ — ReviewerForm (base assignment form),
  AdvancedSearchReviewerForm, CreateReviewerForm, EnrollExistingReviewerForm, EditReviewForm,
  ReviewerNotifyActionForm + {Unassign,Reinstate,ResendRequest}ReviewerForm, ThankReviewerForm,
  ReviewReminderForm, EmailReviewerForm, ReviewerGossipForm, traits/HasReviewDueDate.php
- lib/pkp/classes/submission/action/EditorAction.php — addReviewer/setDueDates/createMail
- lib/pkp/classes/submission/reviewAssignment/{ReviewAssignment,Repository}.php — status machine,
  clone-based edit; lib/pkp/classes/submission/maps/Schema.php — reviewAssignments props
  (statusId, canLoginAs, canGossip, reviewerHasOrcid, competingInterests)
- lib/ui-library/src/managers/ReviewerManager/ — ReviewerManager.vue, reviewerManagerStore.js,
  useReviewerManagerConfig.js, useReviewerManagerActions.js, cells + ReadReview/LogResponse modals
- lib/pkp/classes/components/listPanels/PKPSelectReviewerListPanel.php +
  lib/ui-library/src/components/ListPanel/users/SelectReviewerListPanel.vue — picker
- lib/pkp/api/v1/users/PKPUserController.php getReviewers(); lib/pkp/api/v1/reviews/PKPReviewController.php
  — confirmReview, export-pdf/xml, exports/{fileId}, sendToOrcid (role lists)
- lib/pkp/templates/controllers/grid/users/reviewer/ — reviewerFormFooter.tpl,
  advancedSearchReviewerForm.tpl, readReview.tpl (+ OJS override templates/controllers/grid/users/reviewer/readReview.tpl,
  templates/reviewer/review/reviewerRecommendations.tpl); lib/pkp/templates/workflow/reviewHistory.tpl
- lib/pkp/classes/components/forms/decision/LogReviewerResponseForm.php
- lib/pkp/classes/mail/mailables/{ReviewRequest,ReviewRequestSubsequent,ReviewerUnassign,ReviewerReinstate,ReviewerResendRequest,ReviewAcknowledgement,EditReviewNotify,ReviewRemind,ReviewerRegister}.php
