---
name: reviewer-response
scope: The reviewer's own journey once an editor has assigned them — reach the review assignment (dashboard link or one-click email key), accept or decline the invitation, walk the four-step review wizard (request → guidelines → download & review → completion), enter comments and/or a review form, pick a recommendation, upload attachments, and submit the finished review
shared: pkp-lib
status: verified
e2e-plans: [reviewer-assignment.md]
atlas-claims:
  - PAGE-reviewer-submission
  - PAGE-reviewer-step
  - PAGE-reviewer-savestep
  - PAGE-reviewer-showdeclinereview
  - PAGE-reviewer-savedeclinereview
  - VUE-reviewer-submission-page
  - DB-review_form_responses
  - DB-review_files
  - MAIL-review-confirm
  - MAIL-review-decline
  - MAIL-review-acknowledgement
  - MAIL-review-complete-notify-editors
  - NOTIF-reviewer-comment
  - EVLOG-REV-ACCP
  - EVLOG-REV-DECL
  - EVLOG-REV-RDY
  - AUTHZ-review-assignment-access-policy
---

# Reviewer response

## Purpose

Peer review has two sides. The editor's side — finding a reviewer, inviting them, and
shepherding the assignment — is `assign-and-manage-reviewers`. **This spec is the
*reviewer's* side**: everything the assigned reviewer does from the moment the invitation
lands. The reviewer opens the submission from their reviewer dashboard (or is dropped
straight onto it by a one-click access link in the invitation email), reads the request,
and **accepts or declines**. If they accept, a four-tab wizard walks them through the
**request**, the **reviewer guidelines**, the **download & review** step (where they read
the files, write comments to the editor and/or author — or fill a structured review form —
attach files, and choose a recommendation), and a **completion** confirmation. Submitting
is final for the reviewer. Along the way the system notifies the editors that the reviewer
accepted, declined, or finished. Everything the reviewer sees *about* the author and other
reviewers is governed by the review type (`review-anonymity`); the *content* of any
structured review form is defined by `review-forms`; this spec owns the reviewer's actions
and the responses they produce.

## Actors & permissions

Only the **assigned reviewer** uses this surface — the person an editor put on the current
review round. "Assigned" means: the user holds the **Reviewer** role in the journal and has
a `review_assignments` row on the submission that is **neither cancelled nor (for most
operations) declined**. Reaching any reviewer page requires login **and** passing the
reviewer access gate below; editors, managers and authors never see these pages (they act
from the editor-side reviewer grid or the author dashboard). A reviewer's read/visibility of
the manuscript and author identity is further shaped by the assignment's **review type**
(double-anonymous / anonymous / open), owned by `review-anonymity`. Rows are what the
reviewer UI offers, verified against the access policy and the step forms and live-probed on
submission 850 (`publicknowledge`). <sup>a</sup>

| Action | Who may — and when |
|--------|--------------------|
| **Open the review assignment** (the submission review page + wizard) | • The assigned reviewer — when their assignment is not cancelled and (unless already declined) not declined. Two distinct denial paths: a **reviewer with no live assignment on this submission** (unassigned, cancelled, or declined) passes the reviewer-role gate but is refused by the assignment access policy (`user.authorization.submissionReviewer`); a **non-reviewer** (editor, author, anyone lacking the Reviewer role) is refused one step earlier by the role gate (`user.authorization.roleBasedAccessDenied`). Both land on `/user/authorizationDenied` <sup>b</sup> |
| **One-click access** (land on the review page straight from the email link, logged in) | • The assigned reviewer — only when the journal has **reviewer access keys** enabled and the invitation is still pending; the secure key in the request email signs them in as themselves and drops them on step 1 <sup>c</sup> |
| **Accept the invitation** | • The assigned reviewer — from step 1, before they have responded; blocked until they tick the privacy-consent box when the journal has a privacy statement <sup>d</sup> |
| **Decline the invitation** | • The assigned reviewer — from step 1's **Decline Review Request**, any time before the review is completed; opens a reason form and ends their access <sup>e</sup> |
| **Download the files to review** | • The assigned reviewer — the review-round files the editor granted them; visible on step 1 already unless the journal restricts file access until acceptance, and always on step 3 <sup>f</sup> |
| **Enter comments / fill the review form / pick a recommendation** | • The assigned reviewer — on step 3, while the review is open (not yet submitted or cancelled) <sup>g</sup> |
| **Upload review attachments** | • The assigned reviewer — on step 3, while the review is open <sup>h</sup> |
| **Save the review for later** (draft, without submitting) | • The assigned reviewer — from step 3, any time before submitting <sup>i</sup> |
| **Submit / complete the review** | • The assigned reviewer — from step 3, once required fields (a recommendation in OJS, plus any required review-form elements) are filled; irreversible for the reviewer — after submit the form is read-only and further saves are refused <sup>j</sup> |
| **Read a prior round's submitted review** | • The assigned reviewer — when they reviewed an earlier round on the same submission, a history banner offers a read-only view of what they submitted then <sup>k</sup> |

<sup>a</sup> ReviewerHandler::__construct() (ROLE_ID_REVIEWER ops: submission/step/saveStep/showDeclineReview/saveDeclineReview); live probe 2026-07-03 (sub 850: jjanssen accept→submit, amccrae decline, agallego denied) ·
<sup>b</sup> ReviewerHandler::authorize() (SubmissionAccessPolicy); ReviewAssignmentAccessPolicy::effect() (denies if no assignment, cancelled, or declined-and-not-permitted; message `user.authorization.submissionReviewer`). Non-reviewers fail the earlier role-based handler-operation gate (message `user.authorization.roleBasedAccessDenied`) because the reviewer ops are role-assigned to ROLE_ID_REVIEWER only. Live-probed 2026-07-03: reviewer-no-assignment agallego → `submissionReviewer`; cancelled reviewer jjanssen → `submissionReviewer`; editor dbarnes + author atester → `roleBasedAccessDenied` ·
<sup>c</sup> ReviewerHandler::authorize() (`reviewerAccessKeysEnabled` + `key` → invitation getByKey → acceptHandle); OneClickReviewerAccess::setOneClickAccessUrl(); ReviewerAccessInviteRedirectController::acceptHandle() → ReviewerAccessInvite::handleAccess() (`Validation::registerUserSession`) ·
<sup>d</sup> PKPReviewerReviewStep1Form::execute() (`confirmReview(..., false)`); constructor adds required `privacyConsent` when `privacyStatement` set and not yet confirmed; live-verified (accept rejected until consent ticked) ·
<sup>e</sup> PKPReviewerHandler::showDeclineReview()/saveDeclineReview(); ReviewerAction::confirmReview(..., true) ·
<sup>f</sup> PKPReviewerReviewStep1Form::fetch() (`restrictReviewerFileAccess` gates the ReviewerReviewFilesGridHandler on step 1); step3.tpl (grid always on step 3) ·
<sup>g</sup> PKPReviewerReviewStep3Form; ReviewerReviewForm::fetch() (`reviewIsClosed` = completed or cancelled → fields readonly) ·
<sup>h</sup> step3.tpl (`ReviewerReviewAttachmentsGridHandler`, SUBMISSION_FILE_REVIEW_ATTACHMENT) ·
<sup>i</sup> PKPReviewerHandler::saveStep() (`isSave` → saveForLater); PKPReviewerReviewStep3Form::saveForLater() ·
<sup>j</sup> ReviewerReviewStep3Form (OJS: recommendation required); PKPReviewerReviewStep3Form::__construct() (required review-form elements); PKPReviewerHandler::saveStep() (throws once `getDateCompleted()`); live-verified submit → completion ·
<sup>k</sup> ReviewerSubmissionPage.vue + reviewerSubmissionPageStore.js (round-history banner → RoundHistoryModal); PKPReviewerHandler::submission() (`reviewRoundHistories`)

## Fields & validation

Fields the reviewer actually fills, by on-screen label. Step 1 (Request) collects consent /
competing interests; the decline modal collects a reason; step 3 (Download & Review) is the
substance of the review. Server-set values (dates, step counter, assignment id) are omitted.

| Field (UI label) | Required? | Rules | Anchor |
|------------------|-----------|-------|--------|
| **Privacy consent** ("Yes, I agree to have my data collected…") | Yes, conditionally | Checkbox on step 1, shown only when the journal has a privacy statement **and** the reviewer has not yet responded; blocks Accept until ticked | PKPReviewerReviewStep1Form::__construct() (`privacyConsent` required when `privacyStatement`) |
| **Competing interests** | No | Step 1 radio *No / Yes* + a rich-text box, shown only when the journal defines a competing-interests policy; saved on accept and also carried into the decline form. Absent on `publicknowledge` (no policy text) — live | PKPReviewerReviewStep1Form::readInputData()/execute() (`competingInterestOption`, `reviewerCompetingInterests`) |
| **Decline reason** | No | Rich-text box in the decline modal, **pre-filled** with the standard decline email body; the reviewer may edit it; sent to the editors as the decline message | PKPReviewerHandler::showDeclineReview() (`declineMessageBody`); saveDeclineReview() (`declineReviewMessage`) |
| **Recommendation** | **Yes (OJS)** | Step-3 dropdown; must be one of the journal's configured reviewer recommendations. Live options: *Accept Submission · Revisions Required · Resubmit for Review · Resubmit Elsewhere · Decline Submission · See Comments* (plus a "Choose One" placeholder). Stored on the assignment | ReviewerReviewStep3Form::__construct() (FormValidatorCustom `reviewerRecommendationId` required + must exist); `reviewerRecommendationOptions` from Repo::reviewerRecommendation()->getRecommendationOptions() |
| **Comments — For author and editor** | No | Step-3 rich-text box (default free-text form); its content is *viewable* (may be shown to the author, subject to `review-anonymity` and editor action) | PKPReviewerReviewStep3Form::saveReviewForm() (`comments` → SubmissionComment viewable=true) |
| **Comments — For editor** | No | Step-3 rich-text box; *not* viewable — reaches only editors. On-screen label in OJS is **"For editor"** (OJS's `submission.comments.cannotShareWithAuthor` locale override; pkp-lib's shared string is "For editor only") — see Known deviations | PKPReviewerReviewStep3Form::saveReviewForm() (`commentsPrivate` → SubmissionComment viewable=false) |
| **Review form responses** | Required elements enforced | When the assignment carries a **review form**, the two free-text boxes are replaced by the form's elements; every element the form marks *required* must be answered | PKPReviewerReviewStep3Form::__construct() (FormValidatorCustom over `getRequiredReviewFormElementIds`); saveReviewForm() (→ `review_form_responses`) |
| **Review attachments (files)** | No | Step-3 upload grid — files the reviewer wants the editor and/or author to consult (e.g. an annotated manuscript); stored as review-attachment submission files | ReviewerReviewAttachmentsGridHandler (SUBMISSION_FILE_REVIEW_ATTACHMENT) |

## Rules & state

A reviewer's progress is tracked on the same `review_assignments` row the editor created:
`dateConfirmed` (they responded — accepted or declined), `declined` (which one), a **step**
counter (1–4, how far the wizard has advanced), `dateCompleted` (they submitted), and
`reviewer_recommendation_id`. The editor-side *status* label (Request Sent / Accepted /
Declined / Complete …) is computed from these and is documented in
`assign-and-manage-reviewers`.

1. **Two live surfaces, co-operative.** The review page is served by the **legacy handler**
   (`ReviewerHandler`): `submission` renders the page shell + a jQuery-UI tab bar, and each
   tab's body is fetched by the `step` op (a Smarty form) and saved by `saveStep`. Mounted
   inside that shell is the **Vue** `ReviewerSubmissionPage`, which today renders only the
   prior-round **history banner** (rule 11) — the template comment marks it as the seed of a
   future full migration. Both are live; the wizard itself is still the legacy path.
   <sup>a</sup>
2. **The wizard has four steps and gates forward motion.** Tabs (live labels): **1. Request
   · 2. Guidelines · 3. Download & Review · 4. Completion**. The handler will not open a step
   beyond the assignment's saved step (`step` is capped at the stored value), and each step's
   `execute()` bumps the saved step only forward — so a reviewer cannot skip ahead, though
   they can freely revisit earlier steps. Step 4 is reachable only after the review is
   submitted. <sup>b</sup>
3. **Step 1 is accept-or-decline.** It shows the request boilerplate, title, abstract, the
   **review type** (anonymity mode label, e.g. "Anonymous Reviewer/Disclosed Author"), the
   review schedule (request / response-due / review-due dates), a *View All Submission
   Details* metadata link, and — before the reviewer responds — two actions: **Accept Review,
   Continue to Step #2** and **Decline Review Request**. After acceptance the same tab shows
   **Save and Continue** instead (no decline). Files-to-review appear here already unless the
   journal restricts file access until acceptance. <sup>c</sup>
4. **Accepting confirms the assignment, tells the editors, and logs it.** Submitting step 1
   (with consent if required) runs `confirmReview(decline = false)`: it stamps `dateConfirmed`,
   clears any reminder flags, advances to step 2, sends the **review-confirm** email to the
   assigned editors (managers/sub-editors on the stage; the journal's contact if none), logs
   that email, and writes a **review-accepted** event-log entry. Acceptance is one-way for the
   reviewer — `confirmReview` only fires while `dateConfirmed` is null, so there is no reviewer
   "un-accept". Live-verified: accepting on sub 850 sent "Review accepted: Julie Janssen
   accepted review assignment…" to the editor. <sup>d</sup>
5. **Declining records a reason, notifies the editors, and ends access.** *Decline Review
   Request* opens a modal whose reason box is pre-filled with the decline email body; the
   reviewer may edit it and any competing-interests answer is carried over. Submitting runs
   `confirmReview(decline = true)`: stamps `dateConfirmed`, sets `declined`, marks the
   one-click access invitation *declined*, sends the **review-decline** email to the editors
   (with the reason as the body), logs it, writes a **review-declined** event-log entry, and
   redirects the reviewer to the journal home page. A declined assignment then **fails the
   access gate** (rule 12) — the reviewer can no longer open the review page. Live-verified:
   amccrae's decline sent "Unable to Review" to the editor and redirected to the journal
   index. <sup>e</sup>
6. **Step 2 is the reviewer guidelines.** A read-only page showing the journal's review
   guidelines (internal-review guidelines when on the internal-review stage; a "no guidelines
   set" fallback otherwise), with **Continue to Step #3** and **Go Back**. Live-verified: "This
   publisher has not set any reviewer guidelines." <sup>f</sup>
7. **Step 3 is the review itself — form XOR free-text, plus files and a recommendation.**
   When the assignment has a **review form**, its elements render and required ones are
   enforced; otherwise the reviewer gets two rich-text boxes — **For author and editor**
   (viewable) and **For editor** (not viewable; OJS label, see Known deviations). Either way the step also offers the
   files-to-review download grid, a review-guidelines link, an **Upload File** attachment
   grid, the submission's tasks/discussions panel, and (OJS) the **recommendation** dropdown.
   Buttons: **Submit Review · Save for Later · Go Back**. Live-verified all present on sub
   850. <sup>g</sup>
8. **Free-text comments become peer-review comments; form answers become form responses.**
   With no review form, a non-empty *For author and editor* box is saved as a peer-review
   `submission_comments` row with `viewable = true`, and *For editor* as one with
   `viewable = false` (empty boxes save nothing). With a review form, each answer is written
   to **`review_form_responses`** keyed by review-id + element-id, typed by the element
   (string / int / object). Whether a viewable comment is actually surfaced to the author is
   an editor/anonymity concern (`review-anonymity`), not decided here. <sup>h</sup>
9. **Submitting is final and fans out notifications.** **Submit Review** (behind an "Are you
   sure?" confirm) validates, saves the responses, advances to step 4, and stamps
   `dateCompleted` + the chosen `reviewer_recommendation_id`. It then, for each
   manager/sub-editor assigned to the stage (respecting their email opt-outs): raises a
   **reviewer-comment** in-app notification and sends the **review-complete** email (unsubscribe
   link included). It removes the reviewer's own "new review assignment" task, finalizes the
   one-click access invitation, and writes a **review-ready** event-log entry. The reviewer sees
   a **Review Submitted / "Thank you for completing the review"** confirmation. Live-verified:
   submitting sent "Review complete: Julie Janssen recommends Accept Submission for #850…" to
   the editor. <sup>i</sup>
10. **A submitted review is read-only to the reviewer.** Once `dateCompleted` is set, the
    step-3 comment editors render read-only and both action buttons (Submit Review, Save for
    Later) are disabled — and, decisively, `saveStep` refuses **any** further POST for that
    assignment ("Review already completed!"), so the review cannot be re-edited even by a
    hand-crafted request. One cosmetic gap: the **recommendation `<select>` is *not* disabled**
    on a closed review (its template keys `disabled` on an unset `$readOnly`, while the comments
    and buttons use `$reviewIsClosed`) — but this is inert, not a data hole: with Submit/Save
    disabled there is no UI path to post it, and a direct `saveStep` POST changing the
    recommendation is rejected server-side (HTTP 500) with the recommendation left unchanged
    (live-probed 2026-07-03). Correcting a submitted review is an editor action (Revert Decision,
    in `assign-and-manage-reviewers`), not something the reviewer can do. The **thank-you**
    (`review-acknowledgement`) email the reviewer later receives is sent by the *editor* from
    the reviewer grid; the mailable is owned here, the send is there. <sup>j</sup>
11. **Save-for-later drafts the review without completing it.** *Save for Later* writes the
    current form responses and the (nullable) recommendation but does **not** stamp
    `dateCompleted` or advance/notify — the reviewer can return and finish. <sup>k</sup>
12. **Access is gated per-assignment, not just per-role.** `ReviewAssignmentAccessPolicy`
    (inside `SubmissionAccessPolicy`) permits only a reviewer who has a live assignment on the
    submission: it **denies** when there is no assignment, when it is **cancelled**, or when it
    is **declined** (unless the caller explicitly permits declined views — the reviewer pages do
    not). A reviewer not on the submission, or one who declined/was cancelled, is bounced to the
    authorization-denied page (`user.authorization.submissionReviewer`). Live-probed 2026-07-03:
    agallego (unassigned) and a cancelled jjanssen both denied; a *non-reviewer* (editor/author)
    is denied even earlier by the role gate (`roleBasedAccessDenied`) — see the permissions
    table. <sup>l</sup>
13. **One-click access is a secure key, not a shared password.** When the journal enables
    reviewer access keys, the invitation email's review link carries a per-invitation key; the
    handler looks the invitation up by that key and, if pending, signs the reviewer in as
    themselves and redirects to their review page — no manual login. Declining via the key's
    decline path marks the invitation declined and sends the reviewer to the login page. The
    key is single-purpose (tied to one review assignment) and consumed/decline-marked on use.
    <sup>m</sup>

<sup>a</sup> reviewStepHeader.tpl (`<reviewer-submission-page>` + `#reviewTabs` + ReviewerTabHandler); PKPReviewerHandler::submission()/step() ·
<sup>b</sup> PKPReviewerHandler::submission()/step() (`$step > $reviewStep` clamp; 1–4 bounds); ReviewerReviewForm::updateReviewStepAndSaveSubmission(); live tab labels ·
<sup>c</sup> step1.tpl; PKPReviewerReviewStep1Form::fetch() (accept/decline buttons by `dateConfirmed`); live probe ·
<sup>d</sup> PKPReviewerReviewStep1Form::execute(); ReviewerAction::confirmReview() (dateConfirmed guard, ReviewConfirm, SUBMISSION_LOG_REVIEW_ACCEPT, REVIEW_CONFIRM email log); live mailpit ·
<sup>e</sup> PKPReviewerHandler::showDeclineReview()/saveDeclineReview(); ReviewerAction::confirmReview(decline=true) (declined, InvitationStatus::DECLINED, ReviewDecline, SUBMISSION_LOG_REVIEW_DECLINE); redirect to `index`; live mailpit "Unable to Review" ·
<sup>f</sup> PKPReviewerReviewStep2Form::fetch() (`reviewGuidelines`/`internalReviewGuidelines`, `noGuidelines` fallback); live probe ·
<sup>g</sup> step3.tpl; PKPReviewerReviewStep3Form::fetch(); reviewerRecommendations.tpl; live probe (options, labels, buttons, upload grid) ·
<sup>h</sup> PKPReviewerReviewStep3Form::saveReviewForm() (SubmissionComment viewable true/false; ReviewFormResponse typed by element); ReviewFormResponseDAO ·
<sup>i</sup> PKPReviewerReviewStep3Form::execute() (dateCompleted, reviewerRecommendationId, NOTIFICATION_TYPE_REVIEWER_COMMENT, ReviewCompleteNotifyEditors + REVIEW_COMPLETE log, task removal, SUBMISSION_LOG_REVIEW_READY, invitation finalize); reviewCompleted.tpl; live mailpit ·
<sup>j</sup> PKPReviewerHandler::saveStep() (`getDateCompleted()` throw); ReviewerReviewForm::fetch() (`reviewIsClosed`); ReviewAcknowledgement (sent by ThankReviewerForm, assign-and-manage-reviewers) ·
<sup>k</sup> PKPReviewerHandler::saveStep() (`isSave`); PKPReviewerReviewStep3Form::saveForLater() ·
<sup>l</sup> ReviewAssignmentAccessPolicy::effect(); SubmissionAccessPolicy (`$permitDeclined` default false); live probe agallego ·
<sup>m</sup> OneClickReviewerAccess::setOneClickAccessUrl(); ReviewerAccessInvite::handleAccess() (`Validation::registerUserSession`); ReviewerAccessInviteRedirectController::acceptHandle()/confirmDecline()

## Side effects

**Emails** (each written to the submission email log):

- **Review confirm** — `ReviewConfirm` (`REVIEW_CONFIRM`), **from the reviewer to the assigned
  editors**, on accept (rule 4). Editor-disableable. Reviewer→editor "I'll review it".
- **Review decline** — `ReviewDecline` (`REVIEW_DECLINE`), from the reviewer to the editors,
  on decline (rule 5), carrying the reviewer's reason. Editor-disableable.
- **Review complete** — `ReviewCompleteNotifyEditors` (`REVIEW_COMPLETE`), to each
  manager/sub-editor on the stage, on submit (rule 9); suppressed for editors who opted out of
  that notification, and carries an unsubscribe link. Its subject names the recommendation.
- **Review acknowledgement (thank you)** — `ReviewAcknowledgement` (`REVIEW_ACK`), from a
  section editor **to the reviewer**. The mailable is owned here; it is *sent* by the editor's
  **Thank Reviewer** action (`assign-and-manage-reviewers`), not by any reviewer action.

When none of the confirm/decline recipients resolve (no manager/sub-editor on the stage), the
message falls back to the journal's contact user.

**Notifications** (in-app): **reviewer-comment** (`NOTIFICATION_TYPE_REVIEWER_COMMENT`) to each
assigned manager/sub-editor on submit (rule 9), paired with the review-complete email. The
reviewer's own **new review assignment** task (`NOTIFICATION_TYPE_REVIEW_ASSIGNMENT`, raised at
assignment by `assign-and-manage-reviewers`) is **removed** on submit.

**Event log** (submission activity log; the log surface is `editorial-activity-log`):

- `SUBMISSION_LOG_REVIEW_ACCEPT` — reviewer accepted (rule 4).
- `SUBMISSION_LOG_REVIEW_DECLINE` — reviewer declined (rule 5).
- `SUBMISSION_LOG_REVIEW_READY` — reviewer submitted the completed review (rule 9).

(The editor's *reading* of the review — `SUBMISSION_LOG_REVIEW_CONFIRMED` / `_UNCONSIDERED` —
is `assign-and-manage-reviewers`. There is **no** dedicated event for the recommendation; it
rides on the review-ready entry and the `reviewer_recommendation_id` column.)

**Data**: writes `review_form_responses` (when a review form is attached) or peer-review
`submission_comments` (free-text path); writes review-attachment files
(`SUBMISSION_FILE_REVIEW_ATTACHMENT` in `submission_files`, owned by `submission-files`); sets
`dateConfirmed` / `declined` / `step` / `dateCompleted` / `reviewer_recommendation_id` on the
`review_assignments` row (entity owned by `assign-and-manage-reviewers`); and creates/finalizes
a `ReviewerAccessInvite` invitation when access keys are on. **`review_files`** is the
per-reviewer file-**access** table (which round files this reviewer may see); the reviewer
*reads* those on steps 1/3, but the rows are *written* by the editor's assignment form
(`assign-and-manage-reviewers` / `review-rounds-and-revisions`) — see Open questions.

## Settings that modify behavior

- **Reviewer access keys enabled** (`reviewerAccessKeysEnabled`, Settings → Workflow → Review)
  — turns on the one-click access link + login (rule 13). Off by default on `publicknowledge`.
- **Restrict reviewer file access** (`restrictReviewerFileAccess`) — when on, files-to-review
  are hidden on step 1 and appear only after acceptance (on step 3) (rule 3).
- **Privacy statement** (`privacyStatement`) — presence adds the required consent checkbox to
  step 1 for first-time responders (rule 3).
- **Competing-interests policy** (`competingInterests`) — presence adds the competing-interests
  radio/box to step 1.
- **Review guidelines / internal-review guidelines** (`reviewGuidelines`,
  `internalReviewGuidelines`) — the step-2 text.
- **Reviewer recommendation options** (`reviewer_recommendations` table, configured in
  `workflow-settings` / `recommend-only-editors`) — populate the step-3 recommendation
  dropdown; the field is required in OJS.
- **Review type** (`defaultReviewMode` / the per-assignment method) — the anonymity mode the
  reviewer works under; meaning owned by `review-anonymity`, chosen at assignment by
  `assign-and-manage-reviewers`.
- All reviewer emails (confirm/decline/complete/acknowledgement) are editable and
  enable/disable-able in `email-templates-management`.

## Cross-feature interactions

- **assign-and-manage-reviewers** — the editor side: creates the assignment (the precondition
  for this whole journey), grants files (`review_files`), reads the submitted review, and sends
  the **thank-you** (`ReviewAcknowledgement`, owned here) via Thank Reviewer. Owns the
  `review_assignments` entity and the computed status labels.
- **review-forms** — defines/configures the review form and its elements; this spec owns the
  reviewer *filling* it and the `review_form_responses` it produces.
- **review-anonymity** — the visibility matrix: what the reviewer may see of the author and
  what of the reviewer's comments/identity may reach the author. This spec shows the review-type
  label and stores viewable vs non-viewable comments; it does not decide disclosure.
- **editorial-decisions** — consumes the reviewer's recommendation and comments when the editor
  records a decision; the recommendation itself is captured here.
- **review-rounds-and-revisions** — owns rounds, the round files, and the new-round cycle; a
  reviewer's prior-round review is surfaced here read-only (rule 11). Also owns the author
  *response* flow (the `PKPReviewController` `authorResponse` endpoints and
  `reviewResponse/requestAuthorResponse` page hinted at reviewer-response in the atlas but
  belonging there — seam).
- **submission-files** — owns the review-attachment file entity the reviewer uploads.
- **tasks-discussions** — the discussions panel embedded on steps 3 and 4 (reviewer variant).
- **email-delivery / email-templates-management** — the mailable delivery/log surface and the
  editable templates.
- **login-as** — reviewer impersonation is an editor tool; distinct from one-click key access.

## Canonical scenarios

1. **Accept, then complete and submit** — the assigned reviewer opens the submission, reads the
   request, accepts (giving privacy consent), advances through the guidelines, downloads the
   files, writes comments and picks a recommendation, and submits: the wizard shows "Review
   Submitted", the editors get the accept and the complete emails, and the assignment is marked
   complete (live-verified end-to-end on sub 850: accept email → complete email naming the
   recommendation).
2. **Decline with a reason** — from step 1 the reviewer clicks Decline Review Request, edits the
   pre-filled reason, and submits: the editors receive the decline email with the reason, the
   assignment is marked declined, and the reviewer is returned to the journal home and can no
   longer reopen the review (live-verified: "Unable to Review" email + redirect).
3. **Pick a recommendation (required)** — on step 3 the reviewer chooses from Accept Submission
   / Revisions Required / Resubmit for Review / Resubmit Elsewhere / Decline Submission / See
   Comments; in OJS submitting without a recommendation is rejected (live-verified options).
4. **Split the comments** — the reviewer writes into *For author and editor* and *For editor*;
   the first is stored viewable (author-eligible, per anonymity), the second reaches only
   editors. Both labels also head the editor's Read-Review modal (live-verified: the editor's
   *Review Details* modal shows the two streams under "For author and editor" / "For editor").
5. **Fill a structured review form** — when the assignment carries a review form, the free-text
   boxes are replaced by the form's elements; the reviewer must answer every required element
   (submitting it empty is refused), and the answers are stored as review-form responses the
   editor reads (live-verified 2026-07-03 on a scratch journal; review-form config owned by
   `review-forms`).
6. **Attach a file** — the reviewer uploads an annotated manuscript on step 3; it is stored as a
   review-attachment file the editor (and possibly author) can consult (live-verified 2026-07-03:
   pushed a PDF through the reviewer attachment grid; it survived submission and appears in the
   editor's Read-Review modal).
7. **Save for later** — the reviewer partially fills step 3 and clicks Save for Later; the draft
   responses and recommendation persist, nothing is submitted or notified, and they can return
   to finish.
8. **One-click access from the email** — with reviewer access keys on, the reviewer clicks the
   secure link in the invitation email and lands on step 1 already logged in as themselves,
   without typing a password (live-verified 2026-07-03: from a fresh signed-out browser context,
   the key in the request email logged the reviewer in as themselves and dropped them on the
   review page).
9. **Cannot edit after submitting** — a reviewer who has submitted reopens the page and finds
   the review read-only; any attempt to save again is refused ("Review already completed").
10. **Permission boundary — not-my-assignment** — a reviewer who is not on this submission (or
    whose assignment was cancelled/declined) is refused the review page with "not assigned as a
    reviewer for the requested document" (live-verified: agallego denied on sub 850).
11. **Read a prior round's review** — a reviewer invited again in a later round sees a history
    banner and can open a read-only view of the review they submitted in the earlier round.

## Known deviations (as-built ≠ intent)

None rise to a ⚠ for this spec — every item below is internally consistent, loses no data, and
leaves no reachable control that misbehaves. They are as-built facts (three now live-confirmed)
and candidates the maintainer may want to tidy; low-severity rows are appended to the e2e ledger
(`docs/e2e/app-changes.md` §2).

- **Empty free-text review is submittable** — on the default (no review form) path the server
  requires only a recommendation, so a review with both comment boxes empty and no attachment is
  accepted, despite the client-side hint "You must enter a review or upload a file before
  selecting a recommendation" (the enter-review-or-file check is client-side only). Live-verified
  2026-07-03 (recommendation-only submit → completion + `RECEIVED` status). Recorded as Open
  question 1 — a permissive backend that may be intended, not a data/consistency fault.
- **Recommendation `<select>` stays enabled on a completed review** — cosmetic: the field's
  template gates `disabled` on an unset `$readOnly` while the rest of step 3 uses `$reviewIsClosed`
  (rule 10). Inert, because Submit/Save are disabled and any `saveStep` POST is refused
  server-side (live-verified: HTTP 500, recommendation unchanged). No data loss.
- **"For editor" vs "For editor only" label** — OJS's `locale/en/locale.po` overrides
  `submission.comments.cannotShareWithAuthor` to **"For editor"**, shadowing pkp-lib's
  "For editor only". The shorter label shows on *both* the reviewer's step-3 box and the editor's
  Read-Review modal (live-verified 2026-07-03), so the two sides stay consistent; only the
  pkp-lib/OJS locale files disagree. Cosmetic wording, not a behaviour change.
- **`review_files` is file-*access*, not "reviewer uploads"** — the FEATURE-MAP (and the atlas
  description) label `review_files` "reviewer uploads", but that table is the per-reviewer
  file-**access** grant; the reviewer's real uploads live in `submission_files` as
  `SUBMISSION_FILE_REVIEW_ATTACHMENT` rows. As-built naming inaccuracy — Open question 2.

## Open questions

1. **Is an empty free-text review meant to be submittable?** On the default (no review form)
   path, only the recommendation is server-required; a reviewer can submit with both comment
   boxes blank and no attachment despite the "enter a review or upload a file" hint
   (live-verified 2026-07-03: recommendation-only submit completed, assignment went `RECEIVED`).
   Is the comment/file minimum intended to be enforced server-side, or is the recommendation
   deemed sufficient? (`PKPReviewerReviewStep3Form` has no comment/file required check.)
2. **`DB-review_files` ownership.** Claimed here per the FEATURE-MAP, but it is the file-access
   grant table written by the *editor* at assignment and merely *read* by the reviewer;
   `assign-and-manage-reviewers` / `review-rounds-and-revisions` arguably own its writes. Left
   here so it is not orphaned; grooming may reassign. (The map's "reviewer uploads" description
   is inaccurate — those are `SUBMISSION_FILE_REVIEW_ATTACHMENT` rows.)
3. **No recommendation event.** The FEATURE-MAP anticipated an `EVLOG-REV-RECOMMENDATION` atom;
   none exists. The recommendation is persisted only on `review_assignments.reviewer_recommendation_id`
   and implied by the review-ready log entry / the review-complete email subject. Confirm that
   no dedicated event is wanted.
4. **`PKPReviewController` reviewer/author-response endpoints.** The `/reviews/*` API
   (author-response, review history/export, send-to-ORCID, confirm-review) is hinted at
   reviewer-response in the atlas but is editor/author-facing and unused by the reviewer wizard;
   left for `review-rounds-and-revisions` (author response) and the editor-side review-reading
   feature. Confirm the split.

---

## Reference — entry points & surfaces

| Entry | Path | Atom |
|-------|------|------|
| Reviewer submission review page (shell + tab bar) | `reviewer/submission/{submissionId}` (`ReviewerHandler::submission`) | PAGE-reviewer-submission |
| Wizard step body (AJAX) | `reviewer/step` (`ReviewerHandler::step`, steps 1–4) | PAGE-reviewer-step |
| Save/advance a step | `reviewer/saveStep` (`ReviewerHandler::saveStep`; `isSave` = draft) | PAGE-reviewer-savestep |
| Decline reason modal | `reviewer/showDeclineReview` (`ReviewerHandler::showDeclineReview`) | PAGE-reviewer-showdeclinereview |
| Submit decline | `reviewer/saveDeclineReview` (`ReviewerHandler::saveDeclineReview`) | PAGE-reviewer-savedeclinereview |
| Round-history banner + modal (Vue shell) | mounted in `reviewStepHeader.tpl` (`ReviewerSubmissionPage`) | VUE-reviewer-submission-page |
| Review-form answers | `review_form_responses` (review-id × element-id) | DB-review_form_responses |
| Per-reviewer file-access grant | `review_files` (review-id × submission-file-id) | DB-review_files |
| Confirm / decline / thank / complete emails | `ReviewConfirm`, `ReviewDecline`, `ReviewAcknowledgement`, `ReviewCompleteNotifyEditors` | MAIL-review-confirm, MAIL-review-decline, MAIL-review-acknowledgement, MAIL-review-complete-notify-editors |
| Reviewer-comment notification | `NOTIFICATION_TYPE_REVIEWER_COMMENT` | NOTIF-reviewer-comment |
| Accept / decline / ready events | `SUBMISSION_LOG_REVIEW_ACCEPT` / `_DECLINE` / `_READY` | EVLOG-REV-ACCP, EVLOG-REV-DECL, EVLOG-REV-RDY |
| Reviewer access gate | `ReviewAssignmentAccessPolicy` (via `SubmissionAccessPolicy`) | AUTHZ-review-assignment-access-policy |

Dead-code sibling (not claimed): **PAGE-reviewer-downloadfile** — `downloadFile` is in the
reviewer role's op list but has no implementing/routed method; a dead op, recorded as a
dead-code candidate rather than a surface of this feature.

## Reference — code anchors

- **Handler**: `lib/pkp/pages/reviewer/PKPReviewerHandler.php` (submission/step/saveStep/
  showDeclineReview/saveDeclineReview/getReviewForm); OJS subclass
  `pages/reviewer/ReviewerHandler.php` (role ops, `authorize()` = one-click key +
  `SubmissionAccessPolicy`, OJS step-3 form).
- **Accept/decline engine**: `lib/pkp/classes/submission/reviewer/ReviewerAction.php`
  (`confirmReview`, `getResponseEmail`).
- **Step forms**: `lib/pkp/classes/submission/reviewer/form/` — `ReviewerReviewForm.php`
  (base, `updateReviewStepAndSaveSubmission`), `PKPReviewerReviewStep1Form.php` (accept +
  privacy/competing interests), `PKPReviewerReviewStep2Form.php` (guidelines),
  `PKPReviewerReviewStep3Form.php` (`execute`/`saveReviewForm`/`saveForLater`); OJS
  `classes/submission/reviewer/form/ReviewerReviewStep3Form.php` (recommendation required).
- **Templates**: `lib/pkp/templates/reviewer/review/` — `reviewStepHeader.tpl`, `step1.tpl`,
  `step2.tpl`, `step3.tpl`, `reviewCompleted.tpl`, `modal/regretMessage.tpl`; OJS
  `templates/reviewer/review/step3.tpl` + `reviewerRecommendations.tpl`.
- **Access**: `lib/pkp/classes/security/authorization/internal/ReviewAssignmentAccessPolicy.php`;
  `.../SubmissionAccessPolicy.php` (`$permitDeclined`).
- **One-click access**: `lib/pkp/classes/mail/traits/OneClickReviewerAccess.php`;
  `lib/pkp/classes/invitation/invitations/reviewerAccess/ReviewerAccessInvite.php` +
  `handlers/ReviewerAccessInviteRedirectController.php`.
- **Attachments**: `lib/pkp/controllers/grid/files/attachment/ReviewerReviewAttachmentsGridHandler.php`
  (SUBMISSION_FILE_REVIEW_ATTACHMENT).
- **Recommendation options**: `Repo::reviewerRecommendation()->getRecommendationOptions()`;
  `reviewer_recommendations` table.
- **Mailables**: `lib/pkp/classes/mail/mailables/{ReviewConfirm,ReviewDecline,
  ReviewAcknowledgement,ReviewCompleteNotifyEditors}.php`.
- **Vue shell**: `lib/ui-library/src/pages/reviewerSubmission/ReviewerSubmissionPage.vue` +
  `reviewerSubmissionPageStore.js` + `RoundHistoryModal.vue`.
- **Entity/DB**: `review_form_responses`, `review_files` in
  `lib/pkp/classes/migration/install/ReviewsMigration.php`; `ReviewFormResponseDAO`,
  `ReviewFilesDAO`.
</content>
</invoke>
