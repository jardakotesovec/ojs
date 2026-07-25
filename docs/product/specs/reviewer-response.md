---
name: reviewer-response
scope: A reviewer answers a review invitation and, if they accept, works through the four-step review workspace to send comments, a file and a recommendation back to the editors
shared: pkp-lib
status: verified
atlas-claims:
  - PAGE-reviewer-submission
  - PAGE-reviewer-step
  - PAGE-reviewer-savestep
  - PAGE-reviewer-showdeclinereview
  - PAGE-reviewer-savedeclinereview
  - PAGE-reviewer-downloadfile
  - VUE-reviewer-submission-page
  - API-review-get-history
  - GRID-lib-pkp-grid-files-review-reviewer-review-files-grid-handler
  - GRID-lib-pkp-grid-files-attachment-reviewer-review-attachments-grid-handler
  - DB-review_files
  - DB-review_form_responses
  - MAIL-review-confirm
  - MAIL-review-decline
  - MAIL-review-complete-notify-editors
  - NOTIF-reviewer-comment
  - EVLOG-REV-ACCP
  - EVLOG-REV-DECL
  - EVLOG-REV-RDY
  - LOC-reviewer-reviewer-submission
  - LOC-reviewer-reviewer-reviewSteps
  - LOC-reviewer-submission-comments
  - LOC-reviewer-misc
  - LOC-common-reviewer-submission
  - AUTHZ-review-assignment-access-policy
---

# Reviewer response & completed review

## Purpose

A reviewer who has been invited to review a submission needs one place to decide
whether to take the job on, read what they were sent, write their assessment and
hand it back. That place is the **review workspace**: a page carrying a row of four
tabs — **1. Request**, **2. Guidelines**, **3. Download & Review**,
**4. Completion**. Three things lead to it: the **Respond to request** / **Finish
review** / **View** button on the reviewer's own **My Assignments as Reviewer**
dashboard list; the secure link in the invitation email; and the page's own address,
which stays in the browser's address bar while the workspace is open, so anyone who
has copied it can ask for the page directly and the page itself decides whether to
show them anything. Tab 1 carries the invitation and the **Accept Review** /
**Decline Review Request** choice. Accepting opens **2. Guidelines** — and only
that; one further press of **Continue to Step #3** opens **3. Download & Review**,
where the review is actually written: comments (or a journal-defined review form),
uploaded files, and a **Recommendation**. Submitting tab 3 finishes the review,
tells the editors, and puts the whole workspace into a read-only state on **4.
Completion**. A reviewer invited again on a later round also sees a **Previous
Reviews** panel at the top of the page, so they can re-read what they sent last
time. This spec covers the reviewer's own journey only — inviting, chasing,
reading, rating and thanking reviewers is `assign-and-manage-reviewers`.

## Actors & permissions

This is a single-role workspace: everything below is done by the **Reviewer** whose
own review assignment it is. Terms: *invited* = the assignment exists and the
reviewer has neither accepted nor declined it; *accepted* = the reviewer answered
yes; *declined* = the reviewer answered no; *submitted* = the reviewer sent the
finished review; *cancelled* = an editor withdrew the assignment from the
submission's **Reviewers** list (`assign-and-manage-reviewers` owns that action);
*current assignment* = the reviewer's assignment on the latest review round **they
themselves were invited to** — which is not always the submission's own latest round,
and that difference is what the deviation in rule 13 is about.

Baselines that apply to every row: the workspace is reachable only through the
reviewer's *current assignment*, and only while that assignment is neither declined
nor cancelled — so a reviewer who declines, or whose assignment is cancelled, loses
the page entirely; **Journal Manager, Section Editor, Assistant, Author, Reader and
Site Administrator have no access to this workspace at all** (they work with the same
review through the submission's **Reviewers** list instead), and a visitor who is not
signed in is asked to sign in first rather than told they may not look. To try the
page as any of these people — none of whom is offered a button for it — open the
workspace's own page address: copy it from the browser's address bar while the
assigned reviewer has the workspace open, then ask for the same address while signed
in as the person being tested. Every "is told …" below is what that request puts on
screen. <sup>a</sup>

Two file lists live on this page and are easy to mix up. **Review Files** are the
files an editor sent this reviewer for this round; the reviewer can only read them.
**Reviewer Files**, under tab 3's **Upload** heading, holds the files the reviewer
uploads with their own review, added through that list's **Upload File** action. The
**Previous Reviews** side panel calls the reviewer's own uploads **Attachments**.

| Action | Who may — and when |
|--------|--------------------|
| **Open the review workspace** | • The Reviewer named on the current assignment — any time it is neither declined nor cancelled, including after the review is submitted (read-only) and after the submission has moved on to a later stage<br>• Everyone else — no access; there is no editor or author view of this page, and what they are told differs: a reviewer of the journal without a usable assignment is told they are not assigned as a reviewer for the document, while a Journal Manager, Section Editor, Assistant, Author, Reader or Site Administrator is told their role has no access to the operation, and a visitor who is not signed in is shown the sign-in form for this page instead <sup>a</sup> |
| **Accept the review invitation** | • The Reviewer — only while invited; once accepted the button is replaced by **Save and continue** <sup>b</sup> |
| **Decline the review invitation** | • The Reviewer — only while invited. After accepting, **Decline Review Request** is offered nowhere on the page: there is no screen from which an accepted reviewer can decline, and a decline that reaches the journal without passing through the page leaves the assignment accepted and changes nothing (rule 4) <sup>c</sup> |
| **Read the files sent for review** | • The Reviewer — only the files the editor sent with this assignment, never the whole submission; the list is titled **Review Files** and appears on tab 1 and again on tab 3. Until an editor has sent any, the list is there but reads **No Files**<br>• ⚠ While the journal's **Restrict File Access** setting is on, no **Review Files** list is offered on tab 1 at all — before or after accepting — and the reviewer meets the list only on tab 3 (Settings, rule 6)<br>• ⚠ A reviewer who declines loses the workspace, but a download link for one of those files that they saved before declining keeps working — and while **Restrict File Access** is off, so does the list itself (Known deviations)<br>• ⚠ Only the files the editor selected for this assignment are listed anywhere the page can reach, but a listing asked for outside the page's own controls, naming a co-reviewer's assignment on the same submission, comes back with that reviewer's file selection — including the name, date and component of a file the editor withheld from the requester; opening that file is refused (Known deviations) <sup>d</sup> |
| **Write the review** (comments, or review-form answers) | • The Reviewer — from tab 3, while accepted and not yet submitted<br>• After submitting, the same content is shown and cannot be saved; ⚠ on the free-text path the two comment boxes still accept typing, though nothing on the page can store what is typed (Known deviations) <sup>e</sup> |
| **Choose a recommendation** | • The Reviewer — from tab 3, while accepted and not yet submitted<br>• ⚠ On a submitted review the **Recommendation** list is not greyed out and a different option can be chosen, but the choice is not kept — a reload shows the recommendation that was sent (Known deviations) <sup>f</sup> |
| **Attach files to the review** | • The Reviewer — from tab 3's **Reviewer Files** list, while accepted and not yet submitted; they may add, rename and remove their own attachments, and every screen this page offers lists their own attachments only<br>• ⚠ A listing asked for outside the page's own controls, naming a co-reviewer's assignment on the same submission, comes back with that reviewer's attachment names and dates; opening or removing those files is refused. No control anywhere on the page hands out another assignment's identifier, so this cannot be reproduced from the browser (Known deviations)<br>• After submitting, the list offers neither **Upload File** nor **Delete**; ⚠ the row's **Edit** action remains and a rename takes effect, and the list's read-only state is presentation only — until an editor has confirmed the review, an addition or removal that reaches the journal outside the page's controls is carried out rather than refused (Known deviations) <sup>g</sup> |
| **Save the review without finishing it** | • The Reviewer — **Save for Later** on tab 3, while accepted and not yet submitted <sup>h</sup> |
| **Submit the finished review** | • The Reviewer — **Submit Review** on tab 3, once and only once; afterwards the page offers no way to submit again<br>• ⚠ With the workspace open in two browser tabs, a **Submit Review** or **Save for Later** pressed in the second one after the review has been submitted from the first is refused with nothing at all appearing on screen, and it leaves that page's **Submit Review** greyed out until the page is reloaded — which is when anything typed on it is lost (Known deviations) <sup>i</sup> |
| **Re-read an earlier round's review** | • The Reviewer — the **Previous Reviews** panel lists every earlier round they were invited to, and only their own review is ever shown <sup>j</sup> |
| **Discuss the submission with the editors** | • The Reviewer — the Tasks & Discussions panel embedded on tabs 3 and 4; who may see and post there is owned by `tasks-discussions` <sup>k</sup> |

<sup>a</sup> ReviewerHandler::__construct() (reviewer-only role assignment); SubmissionAccessPolicy reviewer branch; ReviewAssignmentAccessPolicy::effect() (last round by reviewer; denies cancelled, denies declined because `permitDeclined` is false) · live-probed 2026-07-25: an enrolled Reviewer with no assignment, a cancelled assignment and a declined assignment (both seeded and declined for real through the form) all land on `user/authorizationDenied?message=user.authorization.submissionReviewer`, "The current user is not assigned as a reviewer for the requested document."; Journal Manager and Site Administrator land on `…roleBasedAccessDenied`, "The current role does not have access to this operation.", while the same submission's editorial workflow opens for both (positive control); the same reviewer's other current assignment opens normally (positive control); the workspace still opens after the review is submitted and after the submission is advanced to Copyediting · live-probed again 2026-07-25 (chunk c): the same `…roleBasedAccessDenied` page and wording for an assigned Section Editor, an Assistant in the one default assistant group registered for the review stage, the submitting Author and a Reader — each denial page carrying that user's own name in the header as a session control — so only accounts holding the Reviewer role ever reach the `submissionReviewer` message; a signed-out browser is not denied but redirected to `login?source=<the workspace path>` and shown the Login form ·
<sup>b</sup> step1.tpl `reviewer.submission.acceptReview` vs `common.saveAndContinue` branch on `dateConfirmed`; PKPReviewerReviewStep1Form::execute(); ReviewerAction::confirmReview() · live-probed 2026-07-25: invited → `Accept Review, Continue to Step #2`; accepted → `Save and continue` (lower-case "c") ·
<sup>c</sup> PKPReviewerReviewStep1Form::fetch() (`declineReviewAction`, rendered only in the not-yet-confirmed branch of step1.tpl); ReviewerAction::confirmReview() (no-ops when `dateConfirmed` is set) · live-probed 2026-07-25: on an accepted assignment the label, the decline link and the decline URL each occur 0 times in the rendered page; a decline posted for an already-accepted assignment answers 200 with a redirect to the journal home page while the assignment keeps its acceptance date, records no decline, sends no mail, writes no activity-log entry and does not store the competing-interests answer carried with it ·
<sup>d</sup> ReviewerReviewFilesGridHandler; ReviewerReviewFilesGridDataProvider (passes `!restrictReviewerFileAccess` as `permitDeclined`); SubmissionFileAssignedReviewerAccessPolicy::effect(); ReviewFilesDAO::check() (`review_files`); step1.tpl `{if !$restrictReviewerFileAccess}` vs step3.tpl (unguarded) · live-probed 2026-07-25 with **Restrict File Access** on: the tab-1 list is absent from the DOM both while invited and after accepting, tab 3 lists `default-article.pdf`, a direct download is refused before acceptance and returns the PDF after; with the setting off the tab-1 **Review Files** grid renders; two reviewers on the same round given different file selections see exactly their own selection, and the download of a file not granted to an assignment is refused · live-probed 2026-07-25 (ad-hoc probe a-edges, real **Send for Review** + **Add Reviewer** so `review_files` grants exist): after the reviewer declines, the grid component URL and the download href their own tab 1 had rendered both answer 200 with byte-identical content to the pre-decline fetch while the workspace page is denied — with the setting **on** the grid fetch is refused after the decline but the download answers 200 `application/pdf`, and the same download is refused while the assignment is merely invited, so the file's availability inverts on declining; a Reviewer with no assignment on the submission is refused both (negative bound). With the setting on, the grid component URL is also served to an *invited* reviewer (the setting removes the grid from tab 1, not the component fetch) while the download is correctly refused in that state (ledger row 247) · ReviewAssignmentRequiredPolicy::dataObjectEffect() (existence + submission + stage, no owning-reviewer test); ReviewerReviewFilesGridDataProvider (scopes itself off the authorized review assignment) · live-probed 2026-07-25 (ad-hoc probe f1-reviewfiles, three consecutive runs on fresh submissions with **Restrict File Access** off and the round's review file granted to one of two accepted reviewers through the editor's **Edit Review** restrict-files checkbox): the withheld reviewer's `grid/files/review/reviewer-review-files-grid/fetch-grid?reviewAssignmentId=<the granted reviewer's assignment id>` answers 200 with that reviewer's row — file id, `default-article.pdf`, the date and the **Article Text** component — byte-identical to the owner's own fetch (6 031 bytes) where her own fetch reads "No Files" (4 279 bytes) and her page never names the file; the download of that file is refused for GET and for the row's POST control alike while the owner's own download serves the PDF (positive control), and a non-existent assignment id, her own assignment id from a different submission and a reviewer with no assignment on the submission are each refused (negative bounds); the same grid handler exposes no write operation to a reviewer (ledger row 248) ·
<sup>e</sup> PKPReviewerReviewStep3Form::readInputData(), saveReviewForm(); ReviewerReviewForm::fetch() (`reviewIsClosed`); step3.tpl `readonly=$reviewIsClosed` · live-probed 2026-07-25: on a submitted review the review-form answer fields are read-only (a fill attempt times out) while the free-text rich-text editors keep `contenteditable="true"` and accept typed text (ledger row 240) ·
<sup>f</sup> templates/reviewer/review/reviewerRecommendations.tpl (`disabled=$readOnly`, never assigned) vs ReviewerReviewForm::fetch() (`reviewIsClosed`); PKPReviewerHandler::saveStep() ("Review already completed!"); ledger row 76 · live-probed 2026-07-25: on a submitted review `select#reviewerRecommendationId` has no `disabled` attribute and a different option can be chosen; a reload shows the stored recommendation unchanged ·
<sup>g</sup> ReviewerReviewAttachmentsGridHandler::__construct(), initialize() (add/delete capabilities dropped when the including template passes `reviewIsClosed`); ReviewerReviewAttachmentGridDataProvider · live-probed 2026-07-25: add / rename / remove all work while the review is open, and a second reviewer on the same round sees "No Files"; after submitting, the grid's **Upload File** action and the row's delete action are gone (1 → 0) while the row's **Edit** action opens "Edit a file" with an enabled name field and a save takes effect (ledger row 241) · `ReviewerReviewAttachmentGridDataProvider::getAuthorizationPolicy()` (ReviewAssignmentRequiredPolicy on the supplied `assocId`: existence + review-stage access, no owning-reviewer test) · live-probed 2026-07-25 (chunk c): a second accepted reviewer's fetch of `grid/files/attachment/reviewer-review-attachments-grid/fetch-grid?assocId=<the other reviewer's assignment id>` answers 200 with that reviewer's row — filename, date, file id, download link — byte-identical to the owner's own fetch (11 976 bytes vs their own empty 6 650), while the download and the delete of that file are refused with "The current role does not have access to this operation." and the owner's own download of the same id succeeds (positive control); no page control exposes another assignment's id (ledger row 248) · `ReviewerReviewAttachmentsGridHandler::initialize()` takes `reviewIsClosed` from the request var step3.tpl puts in the grid URL; `ReviewAssignmentFileWritePolicy::effect()` refuses only DECLINED / COMPLETE / THANKED / CANCELLED · live-probed 2026-07-25 (ad-hoc probe a-edges): on a review submitted but not yet confirmed by an editor (status RECEIVED), the same grid fetched without that request var restores **Upload File** and the delete action in the DOM, a delete answers 200 and the row disappears from `submission_files` (psql oracle), and the upload wizard runs to completion adding a new row; once an editor has confirmed the review the same route answers `{"status":false,"content":"You do not have access to this review assignment."}` (positive control for the write policy) (ledger row 249) ·
<sup>h</sup> PKPReviewerHandler::saveStep() (`isSave`); PKPReviewerReviewStep3Form::saveForLater() ·
<sup>i</sup> PKPReviewerReviewStep3Form::execute(); PKPReviewerHandler::saveStep() (`throw new \Exception('Review already completed!')` once `dateCompleted` is set) · live-probed 2026-07-25 and re-probed by chunk (e), which corrects the first reading: a step save sent from a second page still sitting on tab 3 after the review was submitted from the first answers 500 with an empty body, the page does not navigate, and **nothing is shown** — `#reviewStep3MessageBox` is present but `display:none` (its only shower, reviewStep3Required.js, is loaded solely for review-form assignments, so the earlier "Please fill in required fields." reading was a hidden-node text artefact), `#reviewStep3FormNotification` is empty and no notification renders; the **Submit Review** button is left `disabled`, so the stale page is inert until reloaded, which is when the unsaved text is lost. The same empty 500 answers a submit-shaped save, an `isSave=1` save, a review-form save, and a save built from a freshly loaded submitted-review page with a valid token — it is the general shape of writing to a closed review, not a stale-token artefact (ledger row 243) ·
<sup>j</sup> PKPReviewerHandler::submission() (`reviewRoundHistories`); ReviewerSubmissionPage.vue; PKPReviewController::getHistory() (always scoped to the requesting user's own assignment); getGroupRoutes() (`history/{submissionId}/{reviewRoundId}` admits SITE_ADMIN, MANAGER and REVIEWER only — no SUB_EDITOR) · live-probed 2026-07-25, corrected by chunks (a)/(c)/(e) which agree against the earlier reading: the round's own reviewer receives their payload (200); the roles that reach the handler at all — Journal Manager, Site Administrator, and the seeded "editor" account whose role maps to a manager group — receive 404 "The requested resource was not found."; an assigned **Section Editor** and a Reviewer with no assignment on the round never reach the handler and are refused by role (401 `user.authorization.roleBasedAccessDenied`), as is an anonymous request (401) ·
<sup>k</sup> step3.tpl / reviewCompleted.tpl `discussion-manager-reviewer` mount — see `tasks-discussions`

## Fields & validation

**Tab 1 — Request.** Read-only invitation detail (submission title, abstract, review
type, and a **Review Schedule** block showing **Review Request Date**, **Response
Due Date** and **Review Due Date**) plus these inputs:

| Field (UI label) | Required? | Rules |
|------------------|-----------|-------|
| **I do not have any competing interests** / **I may have competing interests (Specify below)** | No | Only shown when the journal has published a competing-interests policy, alongside a **Competing Interests** link that opens it. **I do not have any competing interests** is selected on arrival; picking the second option reveals the rich-text box below it, and picking the first again hides it <sup>a</sup> |
| **Competing Interests** (text box) | No | Rich text; kept with the assignment. Cleared whenever the reviewer picks "I do not have any competing interests" <sup>b</sup> |
| **Yes, I agree to have my data collected and stored…** (privacy consent) | Yes, to accept | Shown only while the reviewer has not yet answered the invitation and only when the journal has a privacy statement — which every new journal starts with, so expect the box to be there. Accepting without ticking it keeps the reviewer on tab 1 with **This field is required.** beside the box and records nothing. **Declining does not need it**: the decline panel has its own single field and goes through with the box untouched <sup>c</sup> |

<sup>a</sup> step1.tpl `competingInterestOption` radios (shown when the context has `competingInterests`) · live-probed 2026-07-25: both options render with those exact labels on a journal whose policy is configured, the first is checked on arrival, the box's container is in the DOM but hidden until the second is picked and hidden again when the first is re-picked; on a journal with no policy the radios, the box and the policy link are all absent and the rest of tab 1 is unaffected ·
<sup>b</sup> PKPReviewerReviewStep1Form::execute(); ReviewAssignment `competingInterests` · live-probed 2026-07-25: text typed on tab 1 without saving tab 1 is carried into the decline form and stored with the declined assignment ·
<sup>c</sup> PKPReviewerReviewStep1Form::__construct() (`privacyConsent` required while `dateConfirmed` is null and the context has `privacyStatement`); PKPReviewerHandler::saveDeclineReview() (does not run the step-1 form) · live-probed 2026-07-25: the box is present with `required`/`aria-required` while invited, an accept attempt without it stays on tab 1 with the inline "This field is required." and leaves the assignment unconfirmed at step 1, and the box is absent once the assignment is accepted; every new journal inherits a default privacy statement, so the box is present unless the statement is emptied. The decline path takes no consent: the retained scenario-2 and scenario-8 checks both submit the decline panel with the consent box untouched and the decline is recorded

**Decline Review Request** opens a small form with one field:

| Field (UI label) | Required? | Rules |
|------------------|-----------|-------|
| **(reason for declining)** | No | Rich text, pre-filled with the journal's decline-notification wording so the reviewer can edit rather than compose; whatever is left in the box becomes the body of the email the editors receive. The form has this one field and a **Decline Review Request** button — no cancel, though the panel's own **Close** control backs out of it. Submitting also stores whatever competing-interests answer the reviewer had given on tab 1 <sup>d</sup> |

<sup>d</sup> regretMessage.tpl (`declineReviewMessage`, pre-filled from ReviewerAction::getResponseEmail()); PKPReviewerHandler::saveDeclineReview() (copies `competingInterestOption` / `reviewerCompetingInterests` hidden fields written by the modal's script) · live-probed 2026-07-25: the panel is titled "Decline Review Request", introduced by "You may provide the editor with any reasons why you are declining this review in the field below.", the rich-text field arrives holding the journal's configured decline wording (two probes measured its length differently — 226 and 250 characters — so the length is not an assertable fact; the presence of the pre-filled text is), the only other inputs are the CSRF token and the two hidden competing-interests carriers, and the only form button is **Decline Review Request**

**Tab 3 — Download & Review.** Which fields appear depends on whether this
assignment carries a review form. An editor chooses one from the **Review Form** list
on the **Add Reviewer** form when inviting the reviewer (and can change it afterwards
from the reviewer's row); that list is offered only on a journal that has an active
review form, and it starts on whatever form the submission's section is set to use.
Setting the forms up is `review-forms`; choosing one per assignment is
`assign-and-manage-reviewers`. <sup>j</sup>

| Field (UI label) | Required? | Rules |
|------------------|-----------|-------|
| **For author and editor** (comment box) | No — see rule 8 | Free-text path only (no review form). Rich text; the editors and, if they choose to share it, the author can read it <sup>e</sup> |
| **For editor** (comment box) | No — see rule 8 | Free-text path only. Rich text; never shared with the author. ⚠ Labelled **For editor** in OJS where the shared wording is **For editor only** (Known deviations) <sup>f</sup> |
| *(review-form questions)* | Each question is required or optional as the form's author set it | Review-form path only. The journal's review form is rendered in place of the two comment boxes, under its title and description; a required question's label ends with an asterisk, and every required question must be answered before the review can be submitted <sup>g</sup> |
| **Upload** — the **Reviewer Files** list | No — see rule 8 | The section is headed **Upload**; the list inside it is titled **Reviewer Files** and its action is **Upload File**. Any number of files; the reviewer's own uploads only <sup>h</sup> |
| **Recommendation** | Yes | A single choice from the journal's active recommendation options — by default **Accept Submission**, **Revisions Required**, **Resubmit for Review**, **Resubmit Elsewhere**, **Decline Submission**, **See Comments**. The list starts on **Choose One** and is offered on both paths, review form included. If the reviewer already picked an option that the journal has since retired, that option is offered at the end of the list so their answer is not lost <sup>i</sup> |

<sup>e</sup> step3.tpl `comments`; SubmissionComment `viewable` = true · live-probed 2026-07-25: the tab-3 section labels read, in order, "Review", "For author and editor", "For editor", "Upload", "Recommendation"; both comment boxes are rich-text editors over hidden fields and text written into either reads back after a save ·
<sup>f</sup> step3.tpl `submission.comments.cannotShareWithAuthor`; locale/en/locale.po override; ledger row 77 · live-probed 2026-07-25: the reviewer's tab 3 and the Journal Manager's **Read Review** dialog both read "For author and editor" / "For editor"; neither "For editor only" nor "For editors only" occurs on either page ·
<sup>g</sup> PKPReviewerReviewStep3Form::__construct() (required-element check), saveReviewForm() (`review_form_responses`); reviewFormResponse.tpl — form authoring lives in `review-forms` · live-probed 2026-07-25: with a form attached the two comment boxes are absent (count 0) and the section labels reduce to "Upload" and "Recommendation"; the required element's field carries `required`/`aria-required="true"` and its label ends with "*", the optional one has `aria-required="false"` ·
<sup>h</sup> ReviewerReviewAttachmentsGridHandler (`SUBMISSION_FILE_REVIEW_ATTACHMENT`) · live-probed 2026-07-25: the grid `#reviewAttachmentsGridContainer` is titled "Reviewer Files" with an **Upload File** link, distinct from the **Review Files** grid `#reviewFilesStep3` above it ·
<sup>i</sup> reviewerRecommendations.tpl; Repository::getRecommendationOptions() (active options, plus the one already stored on the assignment); ReviewerReviewStep3Form::__construct() (recommendation must exist in this journal) · live-probed 2026-07-25: the six default options plus "Choose One" render in that order with "Choose One" selected; after a Journal Manager deactivated "Resubmit Elsewhere", a reviewer who had not stored it no longer sees it while a reviewer who had stored it sees it appended after "See Comments" and still selected ·
<sup>j</sup> reviewerFormFooter.tpl / editReviewForm.tpl (`reviewFormId` select, label `submission.reviewForm` = **Review Form**, rendered only when the journal has at least one review form, default from the section's `getReviewFormId()`); ReviewerForm::initData(); ReviewAssignment `reviewFormId` — form authoring lives in `review-forms`, the per-assignment choice in `assign-and-manage-reviewers` · the retained review-form scenarios seed the choice through the scenario processor rather than the **Add Reviewer** form

## Rules & state

**The four tabs and how far the reviewer may go**

1. The workspace remembers how far the reviewer has got, opens on that step, and
   refuses to jump ahead. Tabs beyond the furthest step reached are greyed out and do
   not respond: clicking one changes neither the page nor which tab is highlighted.
   Asking for a later step directly — by editing the step number in the page address
   the browser shows and reloading — lands on the furthest step reached instead, with
   that step's own contents. <sup>a</sup>

   | Step reached | Tabs the reviewer can open | Where the workspace opens |
   |---|---|---|
   | 1 — invitation not yet answered | **1. Request** only | 1. Request |
   | 2 — invitation accepted | 1 and **2. Guidelines** | 2. Guidelines |
   | 3 — **Continue to Step #3** pressed on tab 2 | 1, 2 and **3. Download & Review** | 3. Download & Review |
   | 4 — review submitted | all four, including **4. Completion** | 4. Completion |

   Accepting the invitation therefore does *not* reach tab 3: a reviewer who has just
   accepted arrives on **2. Guidelines** with tab 3 still greyed out, and reaching
   tab 3 needs one press of **Continue to Step #3**.

2. Answering the invitation with **Accept Review, Continue to Step #2** moves the
   reviewer to step 2; **Continue to Step #3** moves them to step 3; **Submit
   Review** moves them to step 4. Steps only ever move forward — going back to an
   earlier tab (there is a **Go Back** link on tabs 2 and 3) does not take the
   reviewer's progress with it. ⚠ A press of **Continue to Step #3** made after the
   reviewer has gone back to tab **1. Request** and returned to tab 2 looks as though
   it did nothing — the highlighted tab does not change and tab 3 stays greyed out —
   although the step really is recorded: a second press, or re-opening the workspace,
   lands on tab 3, with nothing lost (Known deviations). <sup>b</sup>

3. **Tab 4 — Completion** is a short confirmation plus the Tasks & Discussions panel:
   the heading **Review Submitted** over a thank-you note beginning "Thank you for
   completing the review of this submission." Nothing on it can be edited. <sup>c</sup>

**Accepting**

4. Accepting is recorded once. The moment it is recorded, the editors are emailed
   and the acceptance is written to the submission's activity log (Side effects).
   Accepting a second time — which on screen means pressing tab 1's **Save and
   continue**, the button that replaces **Accept Review, Continue to Step #2** once
   the invitation has been answered — re-saves the competing-interests answer but does
   not repeat the email or the log entry. A decline that arrives after an acceptance is
   ignored too: the assignment stays accepted, nothing is emailed, nothing is logged
   and the competing-interests answer carried with it is not stored. That last half
   cannot be exercised from the screens, because an accepted reviewer is offered no
   decline control anywhere on the page (Actors); it is reachable only by a request made
   outside the page's own controls. <sup>d</sup>
5. Tab 2 — **Guidelines** — shows the journal's reviewer guidelines for the review
   stage in question, or "This publisher has not set any reviewer guidelines." when
   none are configured. It has no inputs; continuing is the only action. <sup>e</sup>
6. **Files sent for review** are chosen by an editor for this one assignment, not the
   submission's whole file list; the reviewer sees exactly what was sent to them in the
   **Review Files** list, and two reviewers on the same round who were sent different
   files each see only their own. (To watch the difference, an editor has to send just
   one file of a submission that has more than one; a round where nothing has been sent
   yet shows the list reading **No Files**.) With the journal's **Restrict File
   Access** setting off, that list is on tab 1 and again on tab 3.
   With the setting on, two things happen, and only the first is a defect:
   ⚠ the tab-1 list is withheld whatever the state of the assignment — accepting does
   not bring it back, so the reviewer meets the files only on tab 3 (Known deviations);
   the file itself, correctly, will not download while the invitation is unanswered and
   does download once the reviewer has accepted. A tester can only watch that second
   half on a link they hold from somewhere else, since with the setting on the page
   offers no download link before acceptance. <sup>f</sup>

**Declining**

7. Declining is a one-way door. The reviewer's reason is emailed to the editors, the
   decline is written to the activity log, and the reviewer is returned to the
   journal's reader-facing home page. In their own **My Assignments as Reviewer** list
   the assignment leaves the **Action Required by me** view and appears under
   **Declined**, as a row reading "Request declined on *date*" that offers no button or
   link at all. From then on the workspace is closed to them — including the **Previous
   Reviews** panel — so a reviewer whose only assignment on that submission is the
   declined one cannot re-read what they wrote when declining; a reviewer re-invited on
   a later round can read it there (rule 14). A reviewer who wants back in must be
   re-invited by an editor. ⚠ The door closes on the page but not on the files: a
   download link of the kind the reviewer's own tab 1 offers them before they answer
   keeps working after they decline — and while **Restrict File Access** is off, so does
   the **Review Files** list itself. To watch this, the link has to be copied from tab 1
   *before* declining; with the setting on there is no tab-1 list to copy it from
   (Known deviations). <sup>g</sup>

**Writing and submitting the review**

8. What the reviewer must supply before **Submit Review** will go through:
   <sup>h</sup>

   | Path | Checked when submitting |
   |---|---|
   | Review form | Every question the form marks required — and a **Recommendation** |
   | Free-text | A **Recommendation** — nothing else |

   A **Recommendation** is asked for on both paths: the list is on tab 3 whichever path
   the assignment is on, and it starts unanswered on **Choose One**. What the review
   form adds is its own required questions. (The refusal of a review-form review that
   has no recommendation has not been watched on screen — Open questions.)

   On the free-text path the **Recommendation** section's guidance reads "Select a
   recommendation and submit the review to complete the process. You must enter a
   review or upload a file before selecting a recommendation." ⚠ That comment-or-file
   minimum is neither enforced nor prompted: a review with both comment boxes empty
   and no attachment is accepted, and no message about it appears (Known
   deviations). <sup>i</sup>

9. **Save for Later** stores everything entered so far — review-form answers, both
   comment boxes and the chosen recommendation — briefly shows "Your changes have been
   saved.", and leaves the review unfinished: the reviewer stays on tab 3, tab 4 stays
   shut, and nobody is notified. The message is a passing one and easy to miss; what
   proves the save is that the values read back after the page is opened again.
   Required-answer checks are skipped, so a half-filled review form can be parked.
   <sup>j</sup>

10. **Submit Review** asks "Are you sure you want to submit this review?" first, and
    asks it before checking the form — so a press with a required answer missing still
    raises the question, and the complaint about the missing answer comes after the
    reviewer confirms. On a confirmation with nothing missing the review is stamped as
    submitted, the recommendation is stored, the editors are notified (Side effects),
    and the workspace becomes read-only. Submitting cannot be repeated or undone by the
    reviewer. <sup>k</sup>

11. ⚠ A press of **Submit Review** can be swallowed once a confirmation has been
    completed and the review has then been refused for a missing required answer. The
    first press made *after* the missing answer has been filled in does nothing at all:
    no confirmation appears, nothing is submitted, and the button still looks usable.
    The tester's instruction is therefore: fill the answer in, press **Submit Review**,
    and if no confirmation appears within a second or two press it again — that press
    must complete the review. Reloading the page instead also frees the button, but
    nothing entered was saved, so the answers have to be typed again on the fresh page.
    Two confirmed-then-refused cycles arm this every time; one cycle usually does.
    Presses made while the answer is still missing keep raising the confirmation as
    normal, and confirmations the reviewer cancels instead of completing do not arm it
    (Known deviations). <sup>l</sup>

12. On a submitted review every tab still opens and shows what was sent, but the
    controls are switched off: tab 1's **Save and continue** and tab 2's **Continue to
    Step #3** are greyed out, review-form answers cannot be edited, the **Reviewer
    Files** list offers no **Upload File** and no **Delete**, and **Submit Review** and
    **Save for Later** are both greyed out. Nothing on the page can be saved. ⚠ Three
    kinds of control do not follow that rule and still respond — the **Recommendation**
    list, the two free-text comment boxes (that is two boxes, both live), and the rename
    behind an attachment row's **Edit** action; only the rename actually changes
    anything (Known deviations). ⚠ And the **Reviewer Files** list's read-only state is
    presentation only: between the reviewer's submission and an editor confirming the
    review, an addition or removal of an attachment that reaches the journal outside the
    page's own controls is carried out rather than refused (Known
    deviations). <sup>m</sup>

**Previous Reviews**

13. A reviewer who was invited to more than one round of the same submission sees a
    **Previous Reviews** panel above the tabs, one line per round they were invited to
    other than the submission's own current round — "Round *n* Review Submitted on
    *date*" — with a **Read Round *n* Review** button. In the ordinary case (the
    reviewer is invited again on the newest round) that is every earlier round of
    theirs, and the current round is the tabs themselves. To set this up, an editor
    records **Create New Review Round** on the submission's workflow page and then
    invites the same reviewer again with **Add Reviewer**
    (`review-rounds-and-revisions` owns the round, `assign-and-manage-reviewers` the
    invitation). ⚠ Because the round left out is the submission's current one rather
    than the reviewer's own latest, a reviewer who was *not* invited to the current
    round sees the review their own tabs are showing listed in **Previous Reviews** as
    well — the same review in two places (Known deviations). <sup>n</sup>
14. **Read Round *n* Review** opens a side panel headed "Round *n* Review submitted
    by you for" with the submission title — that same heading is used even for a round
    the reviewer declined, which is as-built and not a finding. The panel shows one of
    three things, depending on how that round ended: <sup>o</sup>

    | How that round ended | What the panel shows |
    |---|---|
    | The reviewer submitted a review | **Recommendation**, then **Reviewer Comments** split into "For editors and authors" and "For editors only" with each entry numbered ("Comment 1:"), then **Attachments** — the reviewer's own uploads, and only when that round has some |
    | The reviewer declined the invitation | **Declined Date** and **Decline reason sent by email** — the subject and body of the reviewer's own decline email, or "No reason given to the decline of the review invitation." when no such email was recorded |
    | Neither — the reviewer never sent a review and never declined | "The review was not completed." |

    Alongside, the panel always shows **Article Metadata** (Type, Abstract,
    Keywords) and **General Information** (**Editor's Request**, **Response Due
    Date**, **Review Due Date** and, for a round that was not declined, **Review
    Accepted On** and — where the round was finished — **Review Submitted On**).
    ⚠ The panel also has a **Files For Review** section for the files that round was
    about, and it never appears, even for a round whose files the reviewer was reading
    on tab 3 at the time (Known deviations). <sup>o</sup>
15. ⚠ Every line of **Previous Reviews** is worded "Round *n* Review Submitted on…",
    including rounds the reviewer declined (where the date shown is the date they
    declined) and rounds they never finished — whether they simply never sent a review
    or an editor cancelled their assignment on that round, in which case the line ends
    with no date at all. The side panel then contradicts the line the reviewer clicked
    (Known deviations). <sup>p</sup>

<sup>a</sup> PKPReviewerHandler::submission(), step() (the requested step is clamped *down* to the saved step before the 1–4 range test, so a too-high step number simply renders the furthest step reached; only a value below 1 reaches the range check, which answers 500 with an empty body — `?step=0` and non-numeric values cast to 0 and are treated as no parameter); ReviewerTabHandler.getDisabledSteps() · live-probed 2026-07-25: in state *invited* tabs 2–4 carry `aria-disabled="true"` + `ui-state-disabled` and `tabindex="-1"`, force-clicking each changes neither the URL nor the visible panel, and `…/submission/{id}?step=3` renders the step-1 form with no **Submit Review** control; in state *accepted* (the scenario processor leaves `step` = 2) the workspace opens on tab 2 with tab 3 disabled and `?step=3` clamps back, and tab 3 becomes available only after **Continue to Step #3**; in state *completed* the workspace opens on tab 4 and all four tabs open when clicked ·
<sup>b</sup> ReviewerReviewForm::updateReviewStepAndSaveSubmission() (never lowers the saved step); PKPReviewerHandler::saveStep() (`setStep` event); step2.tpl / step3.tpl `cancelUrl`; ReviewerTabHandler.setStepHandler() (unlocks the next tab before selecting it) · live-probed 2026-07-25: after **Continue to Step #3** the workspace re-opens directly on tab 3; **Go Back** is an `<a>` link (a full navigation to `…/reviewer/submission/{id}?step=N`, and once a panel has been visited it stays in the DOM, so at step 3 two "Go Back" links exist — scope to the visible panel) and taking it twice still leaves the saved step at 3 · live-probed 2026-07-25 (chunk b, deterministic 6/6 across 1- and 2-worker runs): after a detour to tab 1 and back, the next **Continue to Step #3** press does post `reviewer/saveStep/{id}?step=2` and receives `{"status":true,…"events":[{"name":"setStep","data":3}]}`, yet tab 2 stays selected and tab 3 keeps `aria-disabled="true"` — the tab handler's `setStep` listener never fires (the panel re-fetch leaves the step-2 form outside the subtree it is bound to); a second press, or a reload, opens tab 3, and no data is lost (ledger row 246) ·
<sup>c</sup> reviewCompleted.tpl (`reviewer.complete`, `reviewer.complete.whatNext`) · live-probed 2026-07-25: heading "Review Submitted" plus "Thank you for completing the review of this submission. Your review has been submitted successfully. We appreciate your contribution to the quality of the work that we publish; the editor may contact you again for more information if needed." ·
<sup>d</sup> ReviewerAction::confirmReview() (guarded on `dateConfirmed`); PKPReviewerReviewStep1Form::execute() · live-probed 2026-07-25: after one accept and two further tab-1 saves the submission's activity log holds exactly one "has accepted the round 1 review" entry with one companion mail entry and the editor's inbox exactly one "Review accepted: …" message; a decline posted afterwards leaves the assignment accepted, adds no log entry, no mail-log row and no message to the editor's inbox, and does not store the competing-interests value sent with it ·
<sup>e</sup> PKPReviewerReviewStep2Form::fetch() (`internalReviewGuidelines` / `reviewGuidelines`, falling back to `reviewer.submission.noGuidelines`) · live-probed 2026-07-25: tab 2 reads "Reviewer Guidelines / This publisher has not set any reviewer guidelines." on a journal with none configured, and "Reviewer Guidelines" followed by the configured text on one that has them ·
<sup>f</sup> ReviewFilesDAO::check(); SubmissionFileAssignedReviewerAccessPolicy::effect() (skips assignments with no `dateConfirmed` when `restrictReviewerFileAccess` is on); step1.tpl guard vs step3.tpl · live-probed 2026-07-25 (see footnote d on Actors for the full matrix): with the restriction on, the tab-1 list is absent while invited *and* while accepted, the tab-3 list is present once reached, and the same file's download goes from refused to served as the assignment moves from invited to accepted; tab 3 is not reachable before acceptance by any route the page offers ·
<sup>g</sup> PKPReviewerHandler::saveDeclineReview(); ReviewerAction::confirmReview() (`declined`, invitation marked declined, activity-log entry); ReviewAssignmentAccessPolicy::effect() (`permitDeclined` false) · live-probed 2026-07-25: submitting the decline form redirects to `/index.php/{journal}/index` (the journal's reader-facing home page); the reviewer's **Declined** view then holds the row with "Request declined on 2026-07-25" and zero links or buttons inside it, the default **Action Required by me** view shows "No Items", one "Unable to Review" email carrying the reviewer's text reaches the editor, and the activity log records the decline once · ReviewerReviewFilesGridDataProvider::getAuthorizationPolicy() (passes `!restrictReviewerFileAccess` as `permitDeclined`); SubmissionFileAssignedReviewerAccessPolicy::effect() (skips an assignment only on `restrictReviewerFileAccess && !getDateConfirmed()`, and a decline *sets* `dateConfirmed`) · live-probed 2026-07-25 — see footnote d on Actors for the full matrix (ledger row 247) ·
<sup>h</sup> PKPReviewerReviewStep3Form::__construct() (required review-form elements); ReviewerReviewStep3Form::__construct() (the recommendation check, added unconditionally by the OJS step-3 form, which ReviewerHandler::getReviewForm() returns for step 3 on both paths) · live-probed 2026-07-25 on the free-text path (the recommendation select carries `required`/`aria-required="true"`); on the review-form path the retained scenario-5 and scenario-6 checks and every chunk probe supplied a recommendation before submitting, so the review-form refusal itself was never observed — Open questions #13 ·
<sup>i</sup> `reviewer.article.selectRecommendation`; ReviewerReviewStep3FormHandler.js `updateCommentsRequired_`; ledger row 78 · live-probed 2026-07-25 (ledger 78 re-validated unchanged, twice, on two submissions): with both boxes empty, "No Files" in the attachments list and only a recommendation chosen, **Submit Review** → confirmation → OK lands on tab 4 / "Review Submitted", the editor's Reviewers table reads "Review Submitted", no comment rows are written and no warning appears; the client script does stamp `required` on both hidden comment fields, but no inline error, notification or blocked submit follows, so the prompt never surfaces ·
<sup>j</sup> PKPReviewerHandler::saveStep() (`isSave` branch, trivial success notification); PKPReviewerReviewStep3Form::saveForLater(); reviewStep3Required.js (cancels validation for the save button) · live-probed 2026-07-25: "Your changes have been saved." appears as a transient toast (retained tests should assert on the `saveStep` response, not the toast), the URL and tab 3 are unchanged, tab 4 keeps `aria-disabled="true"`, and after a fresh sign-in in a new browser context both comment boxes and the recommendation read back as left; on the review-form path a save with a required element blank answers 200 and an optional answer reads back verbatim ·
<sup>k</sup> step3.tpl `confirmSubmit="reviewer.confirmSubmit"`; PKPReviewerReviewStep3Form::execute() (`dateCompleted`, `reviewerRecommendationId`) · live-probed 2026-07-25: the confirmation is a `[role="dialog"]` reading "Confirm / Are you sure you want to submit this review? / OK / Cancel" and it opens even when a required review-form element is blank, the required-field message following only after OK ·
<sup>l</sup> LinkActionHandler.enableLink() / `bindActionRequest()` (the confirm-then-act binding on the submit button); ledger row 16 · live-probed 2026-07-25 on freshly seeded review-form assignments, three sequences driven: (i) press → OK → "Please fill in required fields.", fill, press → that press sends no step save and opens no dialog, the next one submits and lands on tab 4; (ii) two such cycles, fill, press → same, inert then submitting; (iii) three such cycles, fill, press → same. The single-cycle form is timing-sensitive (3/3 in isolation, 3 of 4 under four-worker load — the exception opened the confirmation on the first press); the two-cycle form was inert in every run, single- and multi-worker. Presses made while the required answer is still blank keep opening the confirmation; press → **Cancel** cycles do not reproduce it; the assignment stays at step 3 with no completion date and nothing entered on the page is saved, so a reload starts from empty. The submit button reported a single click handler before every press, so the accumulating-handler mechanism recorded on ledger row 16 was not observable — see the amendment applied to that row (Known deviations) ·
<sup>m</sup> ReviewerReviewForm::fetch() (`reviewIsClosed`); step1.tpl / step2.tpl / step3.tpl `submitDisabled`, `readonly`; ReviewerReviewAttachmentsGridHandler::initialize() · live-probed 2026-07-25 on a submitted review: tab 1's **Save and continue** and tab 2's **Continue to Step #3** are `disabled`, **Submit Review** / **Save for Later** are `disabled`, review-form answer fields are read-only, the attachments grid's link actions fall from `[Search, Upload File]` to `[Search]` and its delete action from 1 to 0 · the tab-1 competing-interests radios and box were checked for a fourth exception and are correctly closed (`disabled=$reviewIsClosed`, step1.tpl), and templates/form/textarea.tpl renders a `disabled` rich-text field as plain text with no editor while a `readonly` one keeps both the field and the editor — which is why the comment boxes differ from every other control (ledger row 240) · the attachments grid's read-only state comes from a request var, not from the assignment, and the reviewer write policy refuses only DECLINED / COMPLETE / THANKED / CANCELLED — see footnote g on Actors for the live matrix (ledger row 249) ·
<sup>n</sup> PKPReviewerHandler::submission() (`reviewRoundHistories`, excluding the round returned by ReviewRoundDAO::getLastReviewRoundBySubmissionId() — the submission's newest round, not the reviewer's own newest assignment); ReviewerSubmissionPage.vue · live-probed 2026-07-25: with round 1 finished and round 2 live the panel holds exactly one line ("Round 1 Review Submitted on 2026-07-25") and one **Read Round 1 Review** button, and a DOM-order check places the panel before the tab strip · live-probed 2026-07-25 (chunk d, three-round seed — `submission-in-round-2.js` with `requestRevisions` + `newExternalRound` appended, five decisions, three `reviewRounds[]` entries): a reviewer invited to all three rounds with rounds 1 and 2 finished sees exactly two lines and two buttons, so "every earlier round" holds beyond a single one; and a reviewer who completed round 1 and was never invited to round 2 opens on tab 4 showing that review *and* sees a **Previous Reviews** line and **Read Round 1 Review** panel for the same review, while the round-2 reviewer sees no panel at all (bounding control) (ledger row 250) ·
<sup>o</sup> RoundHistoryModal.vue; roundHistoryModalStore.js (`isDeclined` / `isIncomplete`); PKPReviewController::getHistory() · live-probed 2026-07-25: the sections observed are the title, **Recommendation**, **Reviewer Comments** ("For editors and authors" / "For editors only", entries prefixed "Comment 1:"), **Attachments** (present only when the round really carries one — `dummy.pdf` on a round where the reviewer had uploaded it, absent on rounds without), **Article Metadata** and **General Information**; **Files For Review** never rendered — for a round that demonstrably held `default-article.pdf` (listed in the reviewer's tab-3 **Review Files** grid and downloadable) the history response for that round returned `files: []` while `attachments` in the same response was populated (ledger row 244) ·
<sup>p</sup> PKPReviewerHandler::submission() (`submittedOn` = decline date for a declined round, null for an unfinished one) under the single `reviewer.submission.reviewRound.info.submittedOn` wording · live-probed 2026-07-25: a declined round 1 reads "Round 1 Review Submitted on 2026-07-25" (the decline date) while its panel reads "Declined Date 2026-07-25"; a round 1 accepted but never finished reads "Round 1 Review Submitted on" with nothing after it while its panel reads "The review was not completed." · live-probed 2026-07-25 (chunk d): an earlier round whose assignment the editor **cancelled** produces the same dateless "Round 1 Review Submitted on" line, and that cancelled earlier assignment does not block the reviewer's current-round workspace (bounding control)

## Side effects

- **When the reviewer accepts** — the people the submission's participants list shows
  as **Section Editor**s, plus participants in a **Journal Manager** user group that
  the journal registers for the review stage, get the journal's *review accepted*
  email, sent as if from the reviewer (replies go to the reviewer). If nobody is
  assigned, it goes to the journal's primary contact instead. The email is recorded in
  the submission's email log, and an "accepted review" entry is added to the
  submission's activity log. <sup>a</sup>
- **When the reviewer declines** — the same recipients get the journal's *review
  declined* email carrying the reviewer's reason; it arrives with the subject **Unable
  to Review**. It is likewise recorded in the email log, with a "declined review"
  entry in the activity log. <sup>b</sup>
- **When the reviewer submits the review** — each **Section Editor** assigned to the
  submission gets an in-app notification pointing at the review and, unless they have
  turned that notification's emails off in their own notification settings for this
  journal, the journal's *review submitted* email as well — one message each, subject
  beginning *Review complete*, sent from the journal's contact address and carrying an
  unsubscribe link. A participant holding a **Journal Manager** role is treated the
  same way *if* the user group they were added under is one the journal registers for
  the review stage — the default **Journal editor** group is, and receives both;
  ⚠ the default **Journal manager** group is not, and receives neither the email nor
  the notification (Known deviations). The reviewer is never a recipient. The emails
  are recorded in the email log, a "review submitted" entry is added to the activity
  log, and — where one-click access is in use — the reviewer's secure link is
  retired. <sup>c</sup>
- **What an editor actually sees** — nothing lists the in-app notification itself:
  there is no per-review entry in the editor's **Tasks** flyout, and no notifications
  list to open. What they see instead is their dashboard row for the submission,
  reading "Review completed on *date* · View more details", and on the workflow page the
  Round 1 status "New reviews have been submitted." with the reviewer's row in the
  **Reviewers** list showing **Review Submitted**, the recommendation and **Read
  Review**. <sup>c</sup>
- **What the reviewer sees** — this is also where the reviewer's own outstanding job
  disappears: the assignment leaves the **Action Required by me** view of **My
  Assignments as Reviewer** and appears under **Completed** as "Review submitted on
  *date*" (a decline moves it to **Declined** the same way — rule 7). <sup>c</sup>
- **Nothing is sent on Save for Later**, and the reviewer is never emailed a copy of
  their own acceptance, decline or completed review. <sup>d</sup>

<sup>a</sup> ReviewerAction::confirmReview() with `decline` false → ReviewConfirm; SubmissionEmailLogEventType::REVIEW_CONFIRM; SubmissionEventLogEntry::SUBMISSION_LOG_REVIEW_ACCEPT; ReviewerAction::getResponseEmail() (manager/sub-editor stage assignments, else `getUserFromContextContact`) · live-probed 2026-07-25: one "Review accepted: …" message to the journal's editor and one activity-log entry, neither repeated by further tab-1 saves ·
<sup>b</sup> ReviewerAction::confirmReview() with `decline` true → ReviewDecline; SubmissionEmailLogEventType::REVIEW_DECLINE; SUBMISSION_LOG_REVIEW_DECLINE · live-probed 2026-07-25: one "Unable to Review" message to the journal's editor carrying the reviewer's text, one "has declined the round 1 review" activity-log entry ·
<sup>c</sup> PKPReviewerReviewStep3Form::execute() — `NOTIFICATION_TYPE_REVIEWER_COMMENT` per manager/sub-editor, ReviewCompleteNotifyEditors (skipped per user via `BLOCKED_EMAIL_NOTIFICATION_KEY`), `allowUnsubscribe`, SubmissionEmailLogEventType::REVIEW_COMPLETE, deletion of the reviewer's `NOTIFICATION_TYPE_REVIEW_ASSIGNMENT` row, SUBMISSION_LOG_REVIEW_READY, ReviewerAccessInvite::finalize() · live-probed 2026-07-25: on a submission whose participants were one Journal Manager, two Section Editors and the author, each Section Editor received exactly one "Review complete: … recommends …" message and one reviewer-comment notification row (the Section Editor who was also the section's editor received exactly one — the list de-duplicates), the Journal Manager received neither, and the reviewer, the author and a non-participant editor received nothing; positive control on a second submission: a participant assigned through the *Journal editor* group (registered for the review stage) received both, as did the section's own Section Editor (ledger row 242). The reviewer's task row disappeared from **Action Required by me** (12 → 11) and **Completed** rose (4 → 5); the editor's **Tasks** flyout lists no per-notification entry ·
<sup>d</sup> PKPReviewerReviewStep3Form::saveForLater(); recipient lists in ReviewerAction::getResponseEmail() and PKPReviewerReviewStep3Form::execute() exclude the reviewer · live-probed 2026-07-25: a mail search scoped to the assigned editor's address found nothing after **Save for Later**, and exactly one message after the same review was submitted (bounding control)

## Settings that modify behavior

All of these live in **Settings → Workflow → Review** unless noted; the settings
screens themselves belong to `workflow-settings`.

- **Restrict File Access** ("Reviewers will not be given access to the submission
  file until they have agreed to review it") — while it is on, the **Review Files**
  list is not offered on tab 1 in any state, and the download of one of those files is
  refused for an assignment the reviewer has not answered. See rule 6. ⚠ That refusal
  is lifted once the reviewer answers the invitation *either* way — including by
  declining it (Known deviations, rule 7).
- **One-click Reviewer Access** ("Include a secure link in the email invitation to
  reviewers") — puts a personal link in the invitation and reminder emails that logs
  the reviewer straight into their workspace on tab 1, with no password prompt. Each
  link belongs to the one reviewer it was issued to: ⚠ a link opened in a browser where
  a different user is signed in produces a blank error page rather than an explanation
  (Known deviations). With the setting off, the same link is not issued and an existing
  one lands on a page-not-found instead. The link's lifetime — the journal's
  review-time allowance plus four weeks — is not something a normal test pass can
  wait out. <sup>a</sup>
- **Competing interests policy** (Settings → Workflow → Review, "Competing
  Interests") — when filled in, tab 1 gains the competing-interests question, the
  text box and a link to read the policy.
- **Privacy statement** (Settings → Workflow → Privacy Statement) — when filled in,
  a reviewer who has not yet answered the invitation must tick the consent box before
  **Accept Review, Continue to Step #2** will go through; declining needs no tick.
  Every new journal starts with one, so plan for the tick in any accept script.
- **Reviewer guidelines** / **Internal review guidelines** — supply tab 2's text; the
  internal-review wording is used for an internal review stage, the general one
  otherwise.
- **Review recommendations** (Settings → Workflow → Reviewer Recommendations) — the
  journal's active options are what tab 3's **Recommendation** list offers.
  Deactivating an option (which the panel confirms with "Are you sure you want to
  deactivate the recommendation …") removes it from the list for assignments that have
  not stored it, and moves it to the end of the list for one that has.
- **Default review form** and **per-section review form** — set what the **Review
  Form** list on the **Add Reviewer** form starts on, and so, unless the editor changes
  it there, whether tab 3 shows a review form instead of the two comment boxes (Fields,
  tab 3). Building the form itself is `review-forms`' subject.
- **Response and review time allowances** — supply the **Response Due Date** and
  **Review Due Date** shown on tab 1 when the editor does not set them itself.
- The server configuration file holds nothing that changes any of the behaviour above,
  so there is nothing to switch there and nothing to check.

<sup>a</sup> ReviewerAccessInvite (expiry `numWeeksPerReview` + 4 weeks; `handleAccess()` 404s when the setting is off; refuses a mismatched signed-in user); OneClickReviewerAccess trait; ReviewerHandler::authorize() (accepts the key on any workspace request) · live-probed 2026-07-25 on a journal seeded with the setting on and three invitations sent through **Add Reviewer**: a signed-out browser following the invitation's only link is redirected (302) to `reviewer/submission?submissionId=…&reviewId=…`, renders tab 1 and shows the reviewer's own account in the header with no password prompt; the same kind of unconsumed link opened while the journal's editor is signed in answers 500 with an empty body and a blank page (ledger row 245); after the setting was switched off a previously issued, unconsumed link answers 404 with a "404 Not Found" body, while the same reviewer's ordinary signed-in dashboard route still works (positive control)

## Cross-feature interactions

- **assign-and-manage-reviewers** — owns the invitation itself, the due dates, the
  review type, unassigning/cancelling/reinstating, resending a request, logging a
  reviewer's answer on their behalf, reading and confirming the finished review,
  rating and thanking. Everything this spec describes starts from an assignment
  created there.
- **review-forms** — owns building the form and how the editor reads its answers;
  this spec owns only what the reviewer sees and must fill in.
- **review-anonymity** — owns who may see whose identity; this spec never restates
  it.
- **review-rounds-and-revisions** — owns rounds themselves; **Previous Reviews**
  (rules 13–15) is this spec's reviewer-facing window onto them.
- **editorial-dashboards** — owns **My Assignments as Reviewer**, the list the
  reviewer starts from, its views (**Action Required by me**, **Completed**,
  **Declined**, …) and its **Respond to request** / **Finish review** / **View**
  buttons.
- **tasks-discussions** — owns the discussion panel embedded on tabs 3 and 4.
- **editorial-activity-log** — owns the activity-log surface; this spec fires the
  accepted / declined / submitted entries.
- **submission-files** — owns file upload, revisions and downloads; the
  files-for-review selection and the reviewer's attachments use that machinery.
- **workflow-settings** — owns every setting listed above.

## Canonical scenarios

1. **Accept and reach the review form** — a reviewer holding a new invitation on an
   assignment with no review form attached opens **My Assignments as Reviewer**,
   presses **Respond to request** on that row and lands on **1. Request**. Tabs 2, 3
   and 4 are greyed out and nothing moves when each is clicked. The page shows the
   submission title, abstract, review type and a **Review Schedule** block with three
   dates. The reviewer ticks **Yes, I agree to have my data collected and stored…** —
   accepting without it stays on tab 1 with **This field is required.** — and presses
   **Accept Review, Continue to Step #2**. That opens **2. Guidelines**, showing the
   journal's reviewer guidelines (or "This publisher has not set any reviewer
   guidelines."), with tab 3 still greyed out. Pressing **Continue to Step #3** then
   opens **3. Download & Review**, where the **Review Files** list (headed **Review
   Files**; it reads **No Files** unless an editor has sent files for this round), the
   two comment boxes **For author and editor** and **For editor**, the **Reviewer
   Files** list with its **Upload File** action and the **Recommendation** list are all
   present. <sup>s1</sup>
2. **Decline with a reason** — a reviewer with a new invitation, before doing anything
   else, copies the workspace address out of the browser's address bar (it is needed at
   the end), then presses **Decline Review Request** on tab 1. A panel titled **Decline
   Review Request** appears with a message already written in its one field; the
   reviewer replaces it with their own reason and presses the panel's **Decline Review
   Request** button — the privacy consent box is not involved. They land on the
   journal's reader-facing home page. In the assigned Section Editor's email there is
   one message with the subject **Unable to Review** whose body is the reviewer's
   reason, and in **My Assignments as Reviewer** the assignment is gone from **Action
   Required by me** and appears under **Declined** as a row reading "Request declined on
   *today's date*" with no button or link in it. Opening the address copied at the start
   now shows, instead of the workspace, "The current user is not assigned as a reviewer
   for the requested document." <sup>s2</sup>
3. **Submit a free-text review** — on a submission that has two **Section Editor**s
   among its participants and a reviewer who has accepted an assignment with no review
   form, that reviewer opens the workspace (it lands on **2. Guidelines**), presses
   **Continue to Step #3**, types text into **For author and editor** and into **For
   editor**, then presses **Upload File**, chooses a file, presses **Continue** on the
   upload panel and again on the metadata step whose name field is already filled in,
   and presses **Complete** on the "File Added" confirmation — the file is then listed
   in **Reviewer Files**. They pick **Revisions Required** from **Recommendation** and
   press **Submit Review**. A confirmation asks "Are you sure you want to submit this
   review?"; on confirming, the page moves to **4. Completion** and shows **Review
   Submitted** with a thank-you note. Each of the two Section Editors has exactly one
   email in their own inbox whose subject begins *Review complete* and names the chosen
   recommendation; and when one of them opens their editorial dashboard, the
   submission's row reads "Review completed on *today's date*". <sup>s3</sup>
4. **Save for Later, then come back** — an accepted reviewer on tab 3 types part of a
   comment, picks a recommendation and presses **Save for Later**. A "Your changes
   have been saved." message appears briefly, the page stays on tab 3, and **4.
   Completion** stays greyed out. Signing out and back in and re-opening the
   workspace lands on tab 3 with the comment text and the recommendation exactly as
   left — that read-back, not the passing message, is what proves the save — and the
   editors have received nothing. <sup>s4</sup>
5. **Review form with required questions** — an accepted reviewer whose assignment
   carries a review form with one required and one optional question (an editor chose
   the form in the **Review Form** list when inviting them) sees the form's title,
   description and questions on tab 3 instead of the two comment boxes, the required one
   marked with an asterisk. They pick a recommendation, leave the required question
   blank and press **Submit Review**: the "Are you sure you want to submit this review?"
   confirmation is raised anyway, and confirming it keeps them on tab 3, marks the
   unanswered question **This field is required.** and shows a box at the foot of the
   form reading "Please fill in required fields. Some required fields are not filled in.
   Please complete them before submitting your review." They then answer the question
   and press **Submit Review**; if no confirmation appears within a second or two they
   press it again (⚠ rule 11), and the review completes on **4. Completion**.
   <sup>s5</sup>
6. **The press after two refused confirmations is swallowed** — the same reviewer as
   scenario 5, with a recommendation already picked, presses **Submit Review** with the
   required question blank and confirms, twice, seeing the required-fields box each
   time. They then answer the question and press **Submit Review** once. That press —
   the first one made since the answer was filled in — does nothing at all: no
   confirmation appears, nothing is submitted and **4. Completion** stays greyed out,
   though the button still looks usable. Nothing entered has been saved, so after
   reloading the page the reviewer picks the recommendation and answers the question
   again, and **Submit Review** then completes the review (⚠ rule 11). <sup>s6</sup>
7. **A submitted review is read-only** — a reviewer who wrote both comments, uploaded
   one attachment and then submitted (the attachment has to go on before submitting —
   there is no way to add one afterwards) opens the workspace and lands on **4.
   Completion**; all four tabs open. Tab 1's **Save and continue** and tab 2's
   **Continue to Step #3** are greyed out, and on tab 3 **Submit Review** and **Save
   for Later** are greyed out and the **Reviewer Files** list offers no **Upload File**.
   Three kinds of control still respond: the **Recommendation** list, the two comment
   boxes, and — after clicking the small **Settings** control at the start of the
   attachment's row, which slides the row's actions into view — **Edit** (there is no
   **Delete** among them). Choosing a different recommendation and typing into a comment
   box, then reloading the page, shows the recommendation and the text that were
   submitted; renaming the attachment through **Edit** does change its name in the list
   (⚠ Known deviations — the recommendation list, the comment boxes and the attachment
   rename). <sup>s7</sup>
8. **Competing interests declared, then carried into a decline** — on a journal whose
   **Competing Interests** policy is filled in, a reviewer with a new invitation sees
   the two competing-interests options on tab 1, picks **I may have competing interests
   (Specify below)**, types a note in the box that appears, then presses **Decline
   Review Request**, replaces the pre-written reason with their own and presses the
   panel's **Decline Review Request** button (no privacy tick needed). The decline email
   reaches the assigned editor's inbox with the subject **Unable to Review**. An editor
   then opens the submission from their editorial dashboard and reads the **Reviewers**
   list on the review stage: that reviewer's row reads **Request Declined** and carries
   the words **Competing Interests**. The reviewer's own wording is not printed there —
   its absence is expected, not a defect. <sup>s8</sup>
9. **Previous Reviews on a second round** — setup: an editor records **Send for
   Review** on a submission (which is what puts a file into the round's **Review
   Files**) and invites a reviewer with **Add Reviewer**; the reviewer accepts, reads
   the file listed in **Review Files** on tab 3, writes both comments, uploads one file
   of their own and submits. The editor then records **Create New Review Round** and
   invites the same reviewer again. Now the reviewer opens the workspace: above the tabs
   is a **Previous Reviews** panel with the line "Round 1 Review Submitted on *date*"
   and one **Read Round 1 Review** button. Pressing it opens a side panel headed "Round
   1 Review submitted by you for" that shows their round-1 **Recommendation**, their
   comments under "For editors and authors" and "For editors only" (each numbered
   "Comment 1:"), their **Attachments** with the file they uploaded, and **Article
   Metadata** and **General Information**. No **Files For Review** section appears, and
   the file they read on tab 3 in round 1 is nowhere in the panel (⚠ Known deviations —
   the round-history panel's file list is never filled in). <sup>s9</sup>
10. **Previous Reviews for a round they declined** — setup: a reviewer declines a
    round-1 invitation through the decline panel, writing their own reason; an editor
    then records **Create New Review Round** and invites the same reviewer again. The
    reviewer opens the workspace and sees "Round 1 Review Submitted on *date*" in
    **Previous Reviews** even though they never submitted a round-1 review, the date
    being the day they declined (⚠ rule 15). Pressing **Read Round 1 Review** shows
    **Declined Date** and, under **Decline reason sent by email**, the subject **Unable
    to Review** and the body they wrote. <sup>s10</sup>
11. **Only your own assignment opens the workspace** — three checks against one
    submission that already has an accepted reviewer. Each check needs the workspace's
    own page address, which is copied from the browser's address bar while that accepted
    reviewer has the workspace open; the person being tested then signs in and asks for
    that same address. A reviewer enrolled in the journal but not invited to this
    submission is told "The current user is not assigned as a reviewer for the requested
    document." A **Journal Manager** is told "The current role does not have access to
    this operation." — and, to show that the account is otherwise healthy, the same
    submission opens for them in their editorial dashboard on the review-stage workflow
    page. A reviewer whose assignment on this submission an editor has cancelled gets
    the first message, while the workspace of their own live assignment on a *different*
    submission opens normally. <sup>s11</sup>
12. **One-click access and restricted files** — on a journal with **One-click Reviewer
    Access** and **Restrict File Access** both switched on, an editor records **Send for
    Review** so the round really holds a file and invites two reviewers with **Add
    Reviewer**, so that each gets their own invitation email. In a browser where nobody
    is signed in, the first reviewer's invitation email is opened and its link followed:
    the workspace arrives on **1. Request** with no password prompt, showing that
    reviewer's own account in the page header — and with no **Review Files** list
    anywhere on the page. After ticking the consent box and pressing **Accept Review,
    Continue to Step #2** and then **Continue to Step #3**, the file is listed on tab 3
    and opens when clicked, while tab 1 still shows no list. Finally, in a browser where
    the journal's editor is signed in, the *second* reviewer's own untouched invitation
    link is opened: the workspace does not open and the browser shows a blank page with
    no message at all (⚠ Known deviations — the one-click link opened as another user).
    <sup>s12</sup>

<sup>s1</sup> Seed a round-1 assignment at status `invited` (ReviewRoundProcessor) · live-probed 2026-07-25. Note for the test author: a scenario-seeded round carries **no** review files and no per-assignment file grants — `sendExternalReview` through the scenario processor does not promote the submission file — so the tab-1/tab-3 **Review Files** grid reads "No Files" unless **Send for Review** is driven through the decision wizard first. Two further notes for whoever touches this suite: the tab panels load by AJAX after `domcontentloaded`, so a click issued straight after navigation hits a DOM that is then replaced (chunk d's first probe lost a privacy-consent tick that way) — wait for the panel's content; and the straight accept → **Continue to Step #3** path this scenario drives is unaffected by ledger row 246, but a future test that detours through tab 1 before continuing must press twice ·
<sup>s2</sup> Status `invited`; the address the scenario copies is the workspace page `reviewer/submission/{submissionId}`; the decline lands on `/index.php/{journal}/index`, and that copied address then redirects to `user/authorizationDenied?message=user.authorization.submissionReviewer`; the editors' mail is read in the environment's mail catcher (Mailpit), scoped by recipient + the submission's unique tag · live-probed 2026-07-25 ·
<sup>s3</sup> Status `accepted` leaves the assignment at step 2, so the **Continue to Step #3** press is required; the mail is read in the environment's mail catcher (Mailpit), scoped by recipient + the submission's unique tag; the retained test checks the dashboard line for one of the two Section Editors · live-probed 2026-07-25 (one message per assigned Section Editor; a participant assigned as Journal Manager receives none — ledger row 242) ·
<sup>s4</sup> Status `accepted`; the "Your changes have been saved." toast is transient — assert on the `saveStep` response rather than the text; persistence confirmed across a real sign-in in a fresh browser context · live-probed 2026-07-25 ·
<sup>s5</sup> Status `accepted` + `reviewForm` on a journal carrying an active review form with at least one required element; the required control is `textarea[name="reviewFormResponses[<elementId>]"]`, the confirmation is a `[role="dialog"]` with **OK** / **Cancel** (not a `.ui-dialog`, which is the file-upload modal), and the foot-of-form box is `#reviewStep3MessageBox` (hidden → visible) · live-probed 2026-07-25. The closing press lands on the rule-11 behaviour, which is timing-sensitive after a single turned-back confirmation, so the retained test presses again while no confirmation has opened rather than asserting either outcome; the deterministic form is pinned by s6 (ledger row 16) ·
<sup>s6</sup> Same seed as s5; ledger row 16; the deterministic arming condition is two *confirmed-then-refused* cycles (one cycle usually suffices but went straight through once under four-worker load — see footnote l on rule 11), press → **OK** → required-fields box each time; press → **Cancel** does not arm it. The swallowed press is the first one that would have passed the required-answer check, no step save is sent, and nothing entered before the reload is stored, so the recommendation and the answer are re-entered on the reloaded page · live-probed 2026-07-25 ·
<sup>s7</sup> Status `completed` with a recommendation, both comments and one attachment (the attachment needs uploading through tab 3 before the review is submitted); the three exceptions are ledger row 76 (recommendation) and ledger rows 240 (comment boxes) and 241 (rename); the grid row's **Edit** / **Delete** actions sit behind the row's `a.show_extras` expander — screen-reader label **Settings** — and are in the DOM but not visible until it is clicked · live-probed 2026-07-25 ·
<sup>s8</sup> The context scenario schema has no competing-interests key: configure the policy with a contexts API `PUT` as the journal's manager after `createJournal`, or add the key to the schema. Privacy statement needs no work — every new journal inherits one, so the consent box is present · live-probed 2026-07-25 (the editor's Reviewers row shows a **Competing Interests** marker; the reviewer's wording itself is not printed in that cell) ·
<sup>s9</sup> Two rounds, same reviewer, round 1 `completed` and round 2 `invited`; ledger row 244 is the missing **Files For Review** section; **Attachments** renders only when the round really carries one, so the round-1 upload is part of the precondition, and the round's review file must come from the decision wizard (see s1) — the retained test drives **Send for Review**, **Add Reviewer** and **Create New Review Round** through the editor's screens · live-probed 2026-07-25 ·
<sup>s10</sup> Two rounds, same reviewer, round 1 declined and round 2 `invited`. The reason is shown only when a decline email was actually recorded: a scenario-seeded decline writes no email-log row, and the panel then reads "No reason given to the decline of the review invitation." — a seeding artefact, not app behaviour, so drive the decline through the form · live-probed 2026-07-25 ·
<sup>s11</sup> Statuses `accepted` (positive control), `cancelled`, plus a Reviewer with no assignment and a Journal Manager; the address each check asks for is `reviewer/submission/{submissionId}`, which is why the scenario has it copied from a reviewer who can open the page; the Journal Manager's positive control is the same submission's editorial workflow, which opens with the heading "Workflow: Review (Round 1)" · live-probed 2026-07-25 ·
<sup>s12</sup> A scratch journal with both settings on and reviewers added through **Add Reviewer** so real invitation emails are sent; the link is the invitation's only link and carries the invitation id and key; the different-user case is ledger row 245, and the scenario uses the *second* reviewer's own unconsumed link (a link already followed once is not the same object) · live-probed 2026-07-25

## Known deviations (as-built ≠ intent)

Each entry below is written for the maintainer and for developers: expected behaviour,
observed behaviour, and the diagnosis or ledger row that carries it. The reader-facing
statement of every one of them is the ⚠ note in the sections above — nothing here is
needed to execute a scenario.

- ⚠ **Recommendation control not switched off on a submitted review** — ledger row 76
  (docs/e2e/app-changes.md §2 row 76); re-validated live 2026-07-25, unchanged.
  Expected: on a submitted review every step-3 control is disabled, as the comment
  boxes' underlying fields and the buttons are. Observed: the recommendation
  `<select>` renders enabled and a different option can be chosen, because
  `templates/reviewer/review/reviewerRecommendations.tpl` gates its `disabled`
  attribute on a `$readOnly` template variable that is never assigned, while every
  other control gates on `$reviewIsClosed` (set by
  `ReviewerReviewForm::fetch()`). Cosmetic only: nothing on the page can save the
  change (Submit Review, Save for Later, and tabs 1–2's step buttons are all
  disabled) and a reload shows the stored recommendation; `PKPReviewerHandler::saveStep()`
  refuses any step save once `dateCompleted` is set — see ledger row 243 for the shape of that
  refusal. Suspected intent: drive the recommendation's `disabled` off
  `$reviewIsClosed` too.
- ⚠ **"For editor" vs "For editor only"** — ledger row 77; re-validated live
  2026-07-25, unchanged, on both surfaces. Expected: one wording for the editor-only
  comment stream. Observed: OJS's `locale/en/locale.po` redefines
  `submission.comments.cannotShareWithAuthor` as "For editor", overriding pkp-lib's
  "For editor only" in `lib/pkp/locale/en/reviewer.po`; OJS also still carries a
  legacy `submission.comments.forEditor` with the same value. The reviewer's step-3
  box and the editor's **Read Review** dialog stay consistent with each other — only
  the two locale files disagree. Suspected intent: drop the OJS override so the more
  explicit shared string wins.
- ⚠ **Comment-or-file minimum is neither enforced nor prompted** — ledger row 78;
  re-validated live 2026-07-25, unchanged (and the client-side prompt the row's
  original description credited never surfaces). Expected: the step-3 guidance "You
  must enter a review or upload a file before selecting a recommendation" is enforced.
  Observed: on the free-text path the only required field checked when the review is
  submitted is the recommendation (`ReviewerReviewStep3Form::__construct()` adds a
  check for `reviewerRecommendationId`; `PKPReviewerReviewStep3Form` adds none for
  comments or files), so a review with both boxes empty and no attachment completes,
  writes no comment rows, and shows no warning. `ReviewerReviewStep3FormHandler.js`
  (`updateCommentsRequired_`) does stamp `required` on the hidden comment fields —
  both of them, since its `[id^="comments"]` selector also matches the private box —
  but the rich-text editors hide those fields from the validator, so nothing is shown
  or blocked. Behaviour call for the maintainer: enforce the minimum or drop the
  promise (Open questions #1).
- ⚠ **A press of Submit Review is swallowed after a turned-back confirmation** —
  ledger row 16; re-validated live 2026-07-25 by the retained scenario 5 and 6 tests.
  Expected: the confirmation modal opens on every press, and a press with nothing
  missing submits the review. Observed: once a confirmation has been completed and the
  required-answer check has then turned the submission back, the next press that would
  have passed that check opens no modal and posts nothing, while the button stays
  enabled; the press after it submits normally, and a page reload has the same
  effect (with nothing entered beforehand retained). One confirmed-then-turned-back
  cycle is usually enough — it was observed in every isolated run and in three of four
  under parallel load — and two cycles produced it in every run. Presses made with the
  required answer still blank keep opening the modal, and cancelled confirmations do
  not produce it. Affects any legacy form using a confirm-on-submit button, not just
  this one. Amendment applied to standing ledger row 16 (2026-07-25): it sharpens the
  reproduction to a single confirmed-then-turned-back cycle, records that the swallowed
  press is the first one that would have passed validation and that the following press
  succeeds without a reload, and sets the row's suspected mechanism — duplicate click
  handlers accumulating on the submit button — aside for re-diagnosis, since this
  round's probes read a single click handler on the button before every press. Chunk
  (e) supplies the replacement mechanism the re-diagnosis should start from:
  `LinkActionHandler.activateAction()` unbinds the action and binds `noAction_` while a
  request is in flight, and `enableLink()` re-binds it but deliberately leaves a
  `:submit` element's disabled state for the form handler to clear — so a cycle that
  ends in client-side validation failure (no form submission, therefore no form-handler
  completion) leaves the button in that no-action window, and the press that lands there
  reaches `noAction_`.
- **A cancelled assignment's read-only rendering is unreachable** (observation, no
  ledger row proposed; confirmed live 2026-07-25): `ReviewerReviewForm::fetch()`
  computes `reviewIsClosed` from either `dateCompleted` **or** `getCancelled()`, but
  `ReviewAssignmentAccessPolicy` denies a cancelled assignment outright — the probe's
  cancelled reviewer got the denial page while their other current assignment opened —
  so the cancelled half of that condition can never render. Dead-branch cleanup
  candidate — see Open questions #4.
- **A declined reviewer loses their own record — but not the files** (behaviour
  question; confirmed live 2026-07-25 for both a seeded and a real decline): because
  `permitDeclined` is false for this page, a reviewer who declines can no longer open
  the workspace, so they cannot re-read the reason they sent (the editors keep it in
  the email log). The loss is not permanent if they are re-invited: the **Previous
  Reviews** panel does show that round's decline reason to a reviewer who holds a
  later-round assignment. What they do keep is the files — see ledger row 247, which
  covers the file half of the same decision. See Open questions #5 and #10.
- **The decline routes stay reachable after acceptance** (observation, no ledger row
  proposed; confirmed live 2026-07-25): `showDeclineReview` still returns the decline
  form and `saveDeclineReview` still returns a redirect for an already-accepted
  assignment, while the `dateConfirmed` guard in `ReviewerAction::confirmReview()`
  means nothing is written, nothing is emailed and nothing is logged. Reachable but
  inert; see Open questions #7.
- **The round-history loop shadows the authorized assignment** (observation, no ledger
  row proposed; code only, no live symptom found): `PKPReviewerHandler::submission()`
  reuses `$reviewAssignment` as the `foreach` variable while building the round
  histories, so the later `getReviewFormId()` test — which decides whether the step-3
  required-fields script is loaded — reads the last assignment the collector returned
  rather than the authorized one. The two coincide in every state probed (the authorized
  assignment is the reviewer's newest round and the collector returns ascending), so
  nothing misbehaved; it would bite a multi-round reviewer whose rounds differ in
  whether they carry a review form. Cleanup candidate.
- **Dead reviewer file-download operation**: `downloadFile` is listed in
  `ReviewerHandler::__construct()`'s reviewer role assignment but no such method
  exists on the handler or its parent, and the router has no case for it — atlas atom
  `PAGE-reviewer-downloadfile`. Reviewer downloads go through the file-download
  component instead. Dead-code cleanup.

**Ledger rows filed from this feature** (all live-probed 2026-07-25; filed as rows
237–250 in §2 of `docs/e2e/app-changes.md`, deduped across the four step-4 probe
batches, the six verification chunks and the ad-hoc F2/F3 probe — rows 237–245 are the
ones the retained tests and the scenarios above cite, 246–250 are the rows the
verification pass added):

- **Ledger row 237 — "Submitted on" wording used for declined and unfinished earlier rounds.**
  Expected: the **Previous Reviews** line describes what actually happened in that
  round. Observed: `PKPReviewerHandler::submission()` builds every line from the
  single string `reviewer.submission.reviewRound.info.submittedOn` ("Round {$round}
  Review Submitted on {$submittedOn}"), supplying the *decline* date for a declined
  round and nothing at all for a round that was never completed or whose assignment the
  editor cancelled ("Round 1 Review Submitted on" with an empty date) — while the side
  panel it opens correctly shows "Declined Date" or "The review was not completed."
  Provenance note: the declined half is covered by a retained test; the dateless halves
  (never finished, cancelled) rest on the step-4 probe batch and chunk (d)'s edge seed.
  Suspected intent: per-outcome wording, and no date when there is none.
- **Ledger row 238 — Restrict File Access withholds the tab-1 file list in every state.**
  Expected: the setting's promise ("Reviewers will not be given access to the
  submission file until they have agreed to review it") is lifted once the reviewer
  has agreed. Observed: `step1.tpl` wraps the list in
  `{if !$restrictReviewerFileAccess}`, which is independent of the assignment's state,
  so an **accepted** reviewer still finds no **Review Files** list on tab 1 and meets
  the files only on tab 3, where `step3.tpl` renders the list unconditionally. The
  download guard (`SubmissionFileAssignedReviewerAccessPolicy::effect()`) is the one
  that honours the setting's condition — refused before acceptance, served after. No
  practical exposure from the unguarded tab-3 render, because tab 3 is unreachable
  until the reviewer accepts (rule 1). Suspected intent: gate tab 1's list on
  acceptance the way the download guard does, and gate tab 3's on the setting.
- **Ledger row 239 — Round-history data is only ever the requester's own review, though other
  roles are admitted to the route.** Expected: a route offered to Journal Manager and
  Site Administrator returns something useful to them. Observed:
  `PKPReviewController::getHistory()` resolves the review assignment from
  `$request->getUser()->getId()`, ignoring the caller's role, so a Journal Manager and a
  Site Administrator — the two editorial roles the route admits — each get a not-found
  result where the round's own reviewer gets their payload. (An assigned Section Editor
  is not on the route's role list at all and is refused before the handler runs; the
  earlier reading, which put the Section Editor in the not-found group, was corrected by
  chunks (a), (c) and (e) together.) Harmless and arguably the safe default; the role
  grant in `getGroupRoutes()` looks vestigial — the two granted editorial roles get
  nothing and the third is not granted. Suspected intent: reviewer-only route.
- **Ledger row 240 — A submitted review's free-text comment boxes can still be typed into.**
  Expected: after submission the review text is read-only, as the review-form answers
  are. Observed: the hidden fields behind the boxes are `readonly`, but the rich-text
  editors rendered over them keep `contenteditable="true"`, so text can be typed into
  **For author and editor** / **For editor** on a submitted review. Nothing can save
  it (every button on tabs 1–3 is disabled) and a reload restores the stored text, so
  the impact is a misleading affordance. Same family as row 76. The fix is one word:
  `templates/form/textarea.tpl` renders a `disabled` rich-text field as plain text and
  mounts no editor over it, while a `readonly` one keeps both the field and the editor —
  `step3.tpl` passes `readonly=$reviewIsClosed` where step1.tpl's competing-interests box
  passes `disabled=$reviewIsClosed`. Suspected intent: switch the two comment boxes to
  `disabled` so they close with everything else.
- **Ledger row 241 — A submitted review's attachment can still be renamed.** Expected: the
  **Reviewer Files** list is fully read-only once the review is closed (**Upload
  File** and **Delete** are correctly withdrawn). Observed: the row's **Edit** action
  remains, opens "Edit a file" with an enabled name field, and a save takes effect —
  the stored file name changed after submission. Suspected intent: withdraw **Edit**
  with the other two when `reviewIsClosed` is passed to the attachments grid.
- **Ledger row 242 — A participant assigned as Journal Manager gets no review-submitted email or
  notification.** Expected: every assigned manager or editor learns that a review
  landed. Observed: on a submission whose participants included a Journal Manager and
  two Section Editors, each Section Editor received exactly one *Review complete*
  email and one reviewer-comment notification while the Journal Manager received
  neither; the default *Journal manager* user group has no `user_group_stage` rows,
  and the recipient list is built from stage assignments, so that group is skipped.
  Positive control: a participant in the *Journal editor* group — same role, but
  registered for the review stage — received both. Suspected intent: either register
  the Journal manager group for the review stage or build the recipient list from the
  stage assignment rather than the group's stage registration.
- **Ledger row 243 — A step save on an already-submitted review ends in a server error and the
  reviewer is told nothing.** Expected: saving or submitting a step on a review that is
  already finished is refused with a message the reviewer can act on. Observed: the save
  answers 500 with an empty body, the page neither navigates nor says anything —
  `#reviewStep3MessageBox` stays hidden (an earlier reading of it as visible was a
  hidden-node text artefact; its only shower is loaded solely for review-form
  assignments) and no notification renders — and the **Submit Review** button is left
  switched off, so the page is inert until reloaded, which is when the unsaved text is
  lost. The same empty error answers a submit-shaped save, a **Save for Later**, a
  review-form save and a save built from a freshly loaded page, so it is the general
  shape of writing to a closed review rather than a stale-page artefact; a decline posted
  against a completed assignment does the same. Reachable in ordinary use with two pages
  open on tab 3. Suspected intent: a clean "this review has already been submitted"
  refusal. Could be folded into row 76's description instead of standing alone —
  maintainer's call.
- **Ledger row 244 — The round-history panel's "Files For Review" list is never populated.**
  Expected: a past round's side panel lists the files that were sent to the reviewer
  for that round (the panel has a section for it, and the reviewer read those files on
  tab 3 during the round). Observed: for a round genuinely holding a review file — the
  reviewer's tab-3 **Review Files** grid listed it and its download served the PDF —
  the history response for that round returned an empty file list, so the section
  never renders, while `attachments` in the same response was correctly populated.
  Diagnosis, now definitive: `PKPReviewController::getHistory()` filters the file
  lookup by `ASSOC_TYPE_REVIEW_ROUND` but passes the **review-assignment id** as the
  assoc id, two lines after correctly using the review-round id elsewhere; the review
  files really carry `assoc_id = review_round_id` (checked directly in the test
  database), and the two ids come from different sequences, so the filter can never
  match. Second-order wrinkle: the same lookup is gated on the reviewer's latest
  assignment in the stage not being a decline, so even with the id fixed, a reviewer
  whose most recent assignment is a decline would still be shown no files for any earlier
  round (Open questions #12). Suspected intent: scope the lookup by the review-round id.
  Impact: a reviewer re-reading a past round cannot see which files that round was about.
- **Ledger row 245 — A one-click reviewer link opened while a different user is signed in shows a
  blank error page.** Expected: the reviewer is told what happened — that they are
  signed in as someone else and should sign out and use the link again. Observed: 500
  with an empty response body, both over HTTP and in the browser (blank page, no
  title, no text). Bounded: the same kind of unconsumed link answers a clean redirect
  into the workspace from a signed-out context, and a link used after the setting was
  switched off answers a proper "404 Not Found" page — so the blank page is specific
  to the different-user case. Suspected intent: the explanatory message the other two
  branches manage — which, as chunk (e) found, **already exists at the throw site**
  ("You are logged in as a different user. Please log out and try the invitation link
  again.", `ReviewerAccessInvite::_validateAccessKey()`); it is raised as a plain
  exception where the well-behaved branches raise proper HTTP exceptions, so only the
  exception type is wrong. Likely to be met in ordinary use (shared computers, an editor
  trying a link).
- **Ledger row 246 — The first Continue to Step #3 press after a visit back to tab 1 does not move
  the workspace.** Expected: every press of **Continue to Step #3** on tab 2 opens tab
  3. Observed: after the reviewer opens tab **1. Request** and returns to tab **2.
  Guidelines**, the next press posts the step save and gets the step-advance event back —
  a reload then lands on tab 3 — but the tab strip does not move and tab 3 stays
  switched off, because the tab handler's step listener never fires; a second press
  works. Deterministic (6 of 6 runs, one and two workers). Suspected mechanism: the panel
  re-fetch the tab click triggers leaves the step-2 form outside the subtree
  `ReviewerTabHandler` binds that event on. Same family as row 16 (a legacy form losing
  its binding across a panel replacement), different control and different symptom — here
  the write succeeds and only the navigation is lost. No data loss. Suspected intent: the
  tab should advance on the first press.
- **Ledger row 247 — A reviewer who declines keeps the files they were sent.** Expected (Actors
  baseline and rule 7): declining closes the assignment, and with it the files. Observed:
  the workspace page is correctly closed, but the **Review Files** list and the file
  download link that the reviewer's own tab 1 offered them before they answered keep
  working afterwards — with **Restrict File Access** off (the default) both the listing
  and the file are served, byte-identical to the pre-decline fetch; with the setting on
  the listing is refused but the file is served, and the file moves *from* refused *to*
  served as the reviewer declines, because the download check skips an assignment only
  while the setting is on and the invitation is unanswered, and a decline counts as an
  answer. A reviewer with no assignment on the submission is refused both (control). No
  URL editing is needed — a tab left open, the back button or a saved link is enough.
  Suspected intent: test the declined flag in the download check, and stop the review-files
  list deriving its declined-reviewer allowance from the setting.
- **Ledger row 248 — Both reviewer file lists are scoped by the assignment named in the
  request.** Expected: a reviewer's **Reviewer Files** list shows only their own
  attachments (the data provider's own description says so), and their **Review Files**
  list only the files the editor selected for *their* assignment. Observed: the
  authorization both lists share checks that the named assignment exists and belongs to
  the same submission and review stage, not that it is the caller's, so a reviewer on the
  same submission who asks for either list against a co-reviewer's assignment receives
  that reviewer's rows — for attachments the filename, upload date, file id and a download
  link, identical to the owner's own view; for review files the name, date, component and
  file id of a file the editor deliberately withheld from the caller, which is the
  editor's per-reviewer restriction decision itself. Opening or deleting those files is
  refused (the attachments list by its write check, the review-files list by exposing no
  write operation to a reviewer at all), so what is exposed is the listing, not the file;
  and no control on any page exposes another assignment's identifier. Independent of
  **Restrict File Access** — established with the setting off. Matters most under
  anonymous or double-anonymous review, where a filename can identify its author. One
  cause, two call sites. Suspected intent: check the assignment's own reviewer against the
  signed-in user in the reviewer branch of that shared authorization, so one fix covers
  both lists.
- **Ledger row 249 — On a submitted review the Reviewer Files list is read-only by presentation
  only.** Expected (rule 12): once the review is submitted, nothing on tab 3 can be
  changed. Observed: the grid withdraws **Upload File** and **Delete** on the strength of
  a flag the template puts in the grid's own address, not on the assignment's state, so a
  request without it restores both — and between the reviewer's submission and the editor
  confirming the review (the ordinary state, and the one every read-only claim here is
  written about) both actions are carried out: a delete removes the attachment for real
  and the upload wizard runs to completion, each confirmed against the database. Once an
  editor has confirmed the review the same actions are refused with "You do not have
  access to this review assignment.", so the missing piece is that the reviewer write
  check treats a submitted-but-unconfirmed review as still open. Same family as row 76 and
  rows 240/241 — the page's read-only presentation is not what decides. Suspected intent:
  derive the list's read-only state from the assignment, and refuse reviewer writes from
  the moment the review is submitted (Open questions #11).
- **Ledger row 250 — A reviewer left behind by a new round sees their current review listed as a
  previous one.** Expected: **Previous Reviews** lists only rounds earlier than the one
  the reviewer's own tabs are showing. Observed: the panel is built by leaving out the
  *submission's* newest round rather than the round of the assignment being displayed, so
  a reviewer who completed an earlier round and was not invited to the current one opens
  on **4. Completion** showing that review *and* gets a **Previous Reviews** line with a
  **Read Round *n* Review** panel for the same review — the same review in two places.
  The current round's own reviewer sees no panel (control). Read-only and the reviewer's
  own data, so confusing rather than harmful. Suspected intent: leave out the round of the
  assignment on display.

## Open questions

1. Should the free-text review's "you must enter a review or upload a file" minimum
   be enforced when the review is submitted (ledger 78) — and, if it is meant to be
   prompted for on screen, should the prompt cover the private **For editor** box as
   well as the shared one, or should the guidance be reworded to say the
   recommendation is the only requirement?
2. Should the **Previous Reviews** lines be worded per outcome — submitted, declined,
   not completed — rather than all reading "Review Submitted on …" (ledger row 237)?
3. Is the tab-1 file list meant to reappear once the reviewer has accepted while
   `restrictReviewerFileAccess` is on (ledger row 238), or is withholding it for the whole
   assignment plus the download-time guard the intended design — and should step 3's
   list be guarded by the setting too?
4. `ReviewerReviewForm::fetch()`'s `reviewIsClosed` includes
   `ReviewAssignment::getCancelled()`, but a cancelled assignment is denied access by
   `ReviewAssignmentAccessPolicy::effect()`. Was a cancelled-but-visible read-only
   state ever intended, or should the condition be reduced to `dateCompleted`?
5. Should a reviewer who declined keep read access to their own decline record (their
   reason, and the round-history panel), or is losing the page immediately on decline
   the intended behaviour?
6. `PKPReviewController::getHistory()` grants the route to Site Administrator and
   Journal Manager but always resolves the assignment from the requesting user, so
   those roles get nothing (ledger row 239). Drop the grants, or was an editor-facing round
   history planned?
7. The reviewer decline routes still answer for an already-accepted assignment, with
   the `dateConfirmed` guard making the write a no-op. Should they be closed once the
   assignment is accepted?
8. `ReviewerAction::confirmReview()` records the activity-log entry against
   `Validation::loggedInAs() ?? $request->getUser()->getId()`. When an administrator
   answers an invitation while signed in as the reviewer, should the log name the
   administrator or the reviewer?
9. Should a participant assigned to a submission as **Journal Manager** receive the
   review-submitted email and notification (ledger row 242)? The fix is either the group's
   review-stage registration or the way the recipient list is built, and the choice is
   a behaviour call.
10. Should a reviewer's access to the files they were sent end when they decline (row
    K)? Today the workspace closes but the files do not, and under **Restrict File
    Access** the file becomes *more* available after a decline than before it. Two
    sub-decisions: whether a decline should revoke file access at all, and whether the
    review-files list should keep deriving its declined-reviewer allowance from that
    setting.
11. Should attachment changes be refused from the moment the reviewer submits the review,
    or only once an editor has confirmed it (ledger row 249)? The reviewer write check currently
    treats a submitted-but-unconfirmed review as open, which is the state the read-only
    screen is written about.
12. Should the round-history panel show a past round's files to a reviewer whose most
    recent assignment on the submission is a decline (ledger row 244's second-order gate), or is
    withholding them from a declined reviewer intended?
13. Is a review-form review refused when no recommendation is chosen? OJS's step-3 form
    adds the recommendation check for every step-3 save, review form or not
    (`ReviewerHandler::getReviewForm()` returns `ReviewerReviewStep3Form` on both
    paths), but every live probe and both retained review-form checks supplied a
    recommendation before submitting, so the refusal itself was never watched. Rule 8
    states the requirement for both paths on the strength of the code; a confirmation
    (or a correction) would settle the last cross-table disagreement the readability
    pass found.
14. What does the round-history side panel show for an earlier round whose assignment an
    editor **cancelled**? The **Previous Reviews** line for such a round is the dateless
    "Round *n* Review Submitted on" form (probed, chunk d), but the panel behind it was
    not opened, so rule 14's three-outcome table is silent on that case.

---

<!-- REFERENCE MATERIAL — provenance and campaign bookkeeping, not product-owner
     narrative. The PO-facing "where do I find this" is in Purpose. -->

## Reference — entry points & surfaces

| Entry | Path | Atom |
|-------|------|------|
| My Assignments as Reviewer | Dashboard → "My Assignments as Reviewer" → row button **Respond to request** / **Finish review** / **View** → `reviewer/submission/{submissionId}` (DashboardCellReviewAssignmentActions.vue → dashboardPageStore.js `openReviewerForm`) | PAGE-dashboard-reviewassignments (owned by editorial-dashboards) |
| Review workspace page | `reviewer/submission/{submissionId}[?step=N]` — ReviewerHandler::submission(); renders reviewStepHeader.tpl (tabs + ReviewerSubmissionPage.vue mount). Tabs are `li.ui-tabs-tab`; a locked tab carries `aria-disabled="true"` + `ui-state-disabled` (no `disabled` attribute) | PAGE-reviewer-submission, VUE-reviewer-submission-page |
| Who may open it | SubmissionAccessPolicy reviewer branch → RoleBasedHandlerOperationPolicy then ReviewAssignmentAccessPolicy::effect() (the reviewer's last review round via `filterByReviewerIds([...], true)`; denies cancelled, denies declined because `permitDeclined` is false; no completion or stage test). The deny-message of whichever policy refuses is what the reviewer reads | AUTHZ-review-assignment-access-policy |
| Step tab content | `reviewer/step/{submissionId}?step=N` — PKPReviewerHandler::step(); steps 1–3 render step*.tpl, step 4 renders reviewCompleted.tpl; a step above the saved step is clamped down | PAGE-reviewer-step |
| Step save / Save for Later | `reviewer/saveStep/{submissionId}?step=N` — PKPReviewerHandler::saveStep(); `isSave=1` routes to PKPReviewerReviewStep3Form::saveForLater() | PAGE-reviewer-savestep |
| Decline form | `reviewer/showDeclineReview/{submissionId}` → regretMessage.tpl modal | PAGE-reviewer-showdeclinereview |
| Decline submit | `reviewer/saveDeclineReview/{submissionId}` → ReviewerAction::confirmReview(decline) → redirect to `index` (the journal's reader-facing home page) | PAGE-reviewer-savedeclinereview |
| Round-history side panel | `GET api/v1/reviews/history/{submissionId}/{reviewRoundId}` — PKPReviewController::getHistory(); RoundHistoryModal.vue / roundHistoryModalStore.js. Route roles: SITE_ADMIN, MANAGER, REVIEWER (no SUB_EDITOR). 200 for the round's own reviewer; 404 for the roles that reach the handler without an assignment of their own (Journal Manager, Site Administrator, a manager-mapped editor account); 401 role denial for a Section Editor, for a Reviewer with no assignment and for an anonymous request | API-review-get-history |
| Files sent for review | Component grid `grid.files.review.ReviewerReviewFilesGridHandler` (fetchGrid) on step1.tpl:51 and step3.tpl:28 — DOM id `#reviewFilesStep3` on step 3, grid title **Review Files**; per-assignment whitelist in `review_files`; scope by `reviewAssignmentId`, checked by ReviewAssignmentRequiredPolicy (existence + submission + stage, no owning-reviewer test — ledger row 248); reviewer role whitelisted for fetchGrid / fetchRow only, so no write surface | GRID-lib-pkp-grid-files-review-reviewer-review-files-grid-handler, DB-review_files |
| Reviewer Files (attachments) | Component grid `grid.files.attachment.ReviewerReviewAttachmentsGridHandler` (fetchGrid) on step3.tpl:58 — DOM id `#reviewAttachmentsGridContainer`, grid title **Reviewer Files**, `reviewIsClosed` passed as a request var (ledger rows 248, 249); row actions live in a sibling `tr.row_controls` (`{rowId}-control-row`) revealed by the row's `a.show_extras`; scope by `assocId` = review-assignment id, checked by ReviewAssignmentRequiredPolicy; writes checked by ReviewAssignmentFileWritePolicy (refuses DECLINED / COMPLETE / THANKED / CANCELLED) | GRID-lib-pkp-grid-files-attachment-reviewer-review-attachments-grid-handler |
| Review-form answers | `review_form_responses` rows written by PKPReviewerReviewStep3Form::saveReviewForm(); controls `textarea[name="reviewFormResponses[<elementId>]"]` | DB-review_form_responses |
| One-click access link | Invitation ACCEPT URL `invitation/accept?id={n}&key={key}`, consumed in ReviewerHandler::authorize() → ReviewerAccessInvite::handleAccess() | (ReviewerAccessInvite; DB-invitations owned by user-invitations) |
| Emails out | ReviewConfirm / ReviewDecline (to stage managers + sub-editors, sender = reviewer); ReviewCompleteNotifyEditors (to stage managers + sub-editors, sender = journal contact) | MAIL-review-confirm, MAIL-review-decline, MAIL-review-complete-notify-editors |
| In-app notification | `NOTIFICATION_TYPE_REVIEWER_COMMENT` per manager/sub-editor on review submit (no listed surface in the editor UI); the reviewer's `NOTIFICATION_TYPE_REVIEW_ASSIGNMENT` task is deleted | NOTIF-reviewer-comment |
| Activity-log entries | SUBMISSION_LOG_REVIEW_ACCEPT / _DECLINE / _READY | EVLOG-REV-ACCP, EVLOG-REV-DECL, EVLOG-REV-RDY |
| Dead operation | `downloadFile` declared in ReviewerHandler::__construct() role assignment; no handler method, no router case | PAGE-reviewer-downloadfile |
| Wording | `reviewer.submission.*` + `reviewer.reviewSteps.*` + `reviewer.step1.*` + `submission.comments.*` (lib/pkp/locale/en/reviewer.po); `reviewer.submission.*` schedule/date labels (lib/pkp/locale/en/common.po) | LOC-reviewer-reviewer-submission, LOC-reviewer-reviewer-reviewSteps, LOC-reviewer-misc, LOC-reviewer-submission-comments, LOC-common-reviewer-submission |

## Reference — code anchors

- pages/reviewer/ReviewerHandler.php — OJS handler: reviewer role assignment, access-key
  acceptance in authorize(), OJS step-3 form selection
- lib/pkp/pages/reviewer/PKPReviewerHandler.php — submission(), step(), saveStep(),
  showDeclineReview(), saveDeclineReview(), round-history assembly
- lib/pkp/classes/submission/reviewer/form/{ReviewerReviewForm,PKPReviewerReviewStep1Form,PKPReviewerReviewStep2Form,PKPReviewerReviewStep3Form}.php
  — per-step validation, `reviewIsClosed`, save-for-later, completion side effects
- classes/submission/reviewer/form/ReviewerReviewStep3Form.php — OJS recommendation
  required check
- lib/pkp/classes/submission/reviewer/ReviewerAction.php — confirmReview() /
  getResponseEmail(): accept + decline emails, email log, activity log
- lib/pkp/classes/security/authorization/SubmissionAccessPolicy.php +
  internal/ReviewAssignmentAccessPolicy.php — who may open the workspace
- lib/pkp/classes/security/authorization/internal/SubmissionFileAssignedReviewerAccessPolicy.php
  + lib/pkp/classes/submission/ReviewFilesDAO.php — per-assignment file access
- lib/pkp/controllers/grid/files/review/ReviewerReviewFilesGridDataProvider.php +
  lib/pkp/controllers/grid/files/attachment/{ReviewerReviewAttachmentsGridHandler,ReviewerReviewAttachmentGridDataProvider}.php
  + lib/pkp/classes/security/authorization/internal/{ReviewAssignmentRequiredPolicy,ReviewAssignmentFileWritePolicy}.php
  — the two reviewer grids' own authorization and read-only handling (ledger rows 247, 248, 249)
- lib/pkp/templates/form/textarea.tpl — `disabled` vs `readonly` rich-text rendering (ledger row 240)
- lib/pkp/api/v1/reviews/PKPReviewController.php — getHistory()
- lib/pkp/classes/invitation/invitations/reviewerAccess/ReviewerAccessInvite.php +
  lib/pkp/classes/mail/traits/OneClickReviewerAccess.php — one-click access
- templates/reviewer/review/{step1,step3,reviewerRecommendations}.tpl (OJS) and
  lib/pkp/templates/reviewer/review/{reviewStepHeader,step1,step2,step3,reviewCompleted,reviewFormResponse}.tpl,
  modal/regretMessage.tpl
- lib/pkp/js/pages/reviewer/{ReviewerTabHandler,reviewStep3Required}.js;
  lib/pkp/js/controllers/form/reviewer/ReviewerReviewStep3FormHandler.js;
  lib/pkp/js/controllers/linkAction/LinkActionHandler.js
- lib/ui-library/src/pages/reviewerSubmission/{ReviewerSubmissionPage.vue,RoundHistoryModal.vue,reviewerSubmissionPageStore.js,roundHistoryModalStore.js}
- lib/pkp/classes/testing/scenario/Processor/ReviewRoundProcessor.php — scenario
  seeding: reviewer statuses `invited` / `accepted` / `declined` / `completed` /
  `cancelled`, review-form and recommendation resolution, due-date defaults. Note:
  seeded rounds carry no review files and no per-assignment file grants (drive **Send
  for Review** through the decision wizard when a test needs them), a seeded decline
  writes no email-log row, and the context scenario schema has no competing-interests
  or privacy-statement key
