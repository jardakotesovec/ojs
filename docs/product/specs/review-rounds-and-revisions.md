---
name: review-rounds-and-revisions
scope: The review-round lifecycle on the External Review stage — what a round IS (a review_rounds row with a number and a status label), the per-round panel an editor works in (revision files, files-for-review, reviewers, round status, author response), the round-status label machine, the author's revision-upload → resubmit cycle that a Request-Revisions/Resubmit decision drives, the newer editor-requests-→-author-submits written-response flow, and browsing prior rounds' history
shared: pkp-lib          # ReviewRound, ReviewRoundDAO, the author-response subsystem, the round notifications and the round file/status Vue managers all live in lib/pkp + lib/ui-library; OJS carries no round-specific override (it uses the shared external-review-stage config as-is)
status: verified
e2e-plans: [review-rounds-revisions.md]
atlas-claims:
  - DB-review_rounds
  - DB-review_round_settings
  - DB-review_round_files
  - DB-review_round_author_responses
  - DB-review_round_author_response_authors
  - DB-review_round_author_response_settings
  - SCHEMA-review-round
  - NOTIF-review-round-status
  - NOTIF-pending-external-revisions
  - NOTIF-pending-internal-revisions
  - VUE-request-review-round-author-response
  - VUE-author-response-manager
  - VUE-author-response-request-manager
  - API-review-request-author-response
  - API-review-submit-author-response
  - API-review-edit-author-response
  - API-review-delete-author-response
  - PAGE-reviewresponse-requestauthorresponse
  - MAIL-request-review-round-author-response
  - AUTHZ-review-round-required-policy
  - AUTHZ-review-stage-access-policy
  - AUTHZ-review-assignment-file-write-policy
---

# Review rounds and revisions

## Purpose

Peer review in OJS happens in **rounds**. When an editor sends a submission for review, a
**review round** opens on the External Review stage; each round groups a set of reviewers,
the files they review, the author's uploaded revisions, and a computed **round-status
label** that tells everyone where the round stands ("Awaiting responses from reviewers",
"Revisions have been requested", "All reviews are confirmed and a decision is needed"…).
This spec owns the **round as an object and the round's own lifecycle**: what a round is,
how its number sequences, how its status label is computed and displayed, the per-round
panel an editor works in, the **revision cycle** an editor triggers with a Request-Revisions
or Resubmit decision (the author uploads a revised manuscript, which flips the round status
and, on a new round, seeds the next one), the newer **author-response** flow (an editor
formally requests a written response to the round and the author submits one), and the
ability to browse **prior rounds' history**. It does *not* own the **decisions** that drive
these transitions — Request Revisions, Resubmit for Review, Create New Review Round, Cancel
Review Round, Accept and Decline are defined once in `editorial-decisions` (this spec
references that variant table and owns only the round-side effects they cause). Nor does it
own the reviewer list within a round (`assign-and-manage-reviewers`), the reviewer's own
review journey (`reviewer-response`), or the workflow shell/route
(`workflow-stage-navigation`).

## Actors & permissions

Everything here is inside a journal context and requires **login + review-stage access**,
computed by `workflow-stage-navigation`: an *unassigned* journal manager or site admin gets
manager scope on every submission; an assigned editor/assistant gets the stages their groups
cover (the default Journal-editor / Section-editor groups include External Review). A
**recommend-only** section editor is a normal editor for everything in this spec except
finalizing decisions (owned by `editorial-decisions`). "Author" = a user holding an
author-role stage assignment on the submission. Two review-stage authorization policies gate
the round surfaces: **round-valid** (`ReviewRoundRequiredPolicy` — the request must carry a
review round that belongs to this submission) and **review-stage access**
(`ReviewStageAccessPolicy` — the user may act on this review-stage component); revision/attachment
file writes additionally pass `ReviewAssignmentFileWritePolicy`. The rows below are what each
surface **offers**, verified against the backend role gates and live-probed on
`publicknowledge` 2026-07-03 (author + verifier passes; the verifier re-drove the
author-response gates via authenticated API calls and the author round view in a browser). <sup>a</sup>

| Action | Who may — and when |
|--------|--------------------|
| **View a round panel** (round status, revision files, files-for-review, reviewers, author-response, discussions) | • Managers / site admins — manager scope, any submission<br>• Assigned editors (incl. recommend-only) and assistants — when their group covers the review stage<br>• Authors — a **read-mostly** variant of *their own* submission's round on My Submissions: round status, their own Revisions Uploaded panel, a redacted reviewer view (completed reviews only) and discussions; no files-for-review, no participant management <sup>b</sup> |
| **Switch rounds / view a prior round's history** | • Any viewer with review-stage access — the left workflow menu lists **Review Round 1 … N**; selecting one re-scopes the whole panel to that round. A **past** round shows its reviewers and files but **no decision buttons** (decisions act only on the current round) <sup>c</sup> |
| **Open a new round / cancel a round / request revisions / resubmit** (the decisions that reshape rounds) | • Deciding editors and manager scope — during the current round; recommend-only editors may only *recommend*. Button availability, the wizard and the transition are **owned by `editorial-decisions`**; this spec owns the resulting round state <sup>d</sup> |
| **Upload a revision (revised manuscript)** | • **Authors** — via the **Upload revisions** action button and the **Revisions Uploaded** panel, offered while the round status is *Revisions Requested*, *Resubmit For Review* or *Revisions Submitted*<br>• Editors / managers / assistants — may also upload/edit/delete revision files in that panel any time <sup>e</sup> |
| **Request a written author response** (the newer flow) | • Managers, site admins, sub-editors — the **Request Response** button in the round's **Author Response** panel, **enabled only** once the round has enough completed reviews (the journal's minimum, or all accepted reviews completed) and **no** response yet exists; opens the request-response compose page <sup>f</sup> |
| **Submit a written author response** | • **Authors** — from the round's **Author Response** panel (**Submit Response**), shown when a response was requested or the round is *Accepted*/*Revisions Requested*; exactly **one** response per round <sup>g</sup> |
| **Edit / delete a submitted author response** | • Managers, site admins, sub-editors — **View** and **Delete** on the response row (edit via API); authors do **not** get edit/delete controls once submitted <sup>h</sup> |

<sup>a</sup> WorkflowStageAccessPolicy (`workflow-stage-navigation`); ReviewRoundRequiredPolicy; ReviewStageAccessPolicy; ReviewAssignmentFileWritePolicy; live probes 2026-07-03 (subs 166–172) ·
<sup>b</sup> workflowConfigEditorialOJS `WorkflowConfig[WORKFLOW_STAGE_ID_EXTERNAL_REVIEW]`; workflowConfigAuthorOJS same key (author variant — `redactedForAuthors`, no ParticipantManager/files-for-review); live: dbarnes saw the full panel, atester saw Round Status + Revisions Uploaded + redacted Reviewers + Discussions ·
<sup>c</sup> useWorkflowNavigationConfigOJS `getReviewItems()`/`getReviewItem()` (one menu item per round, `key: workflow_{stageId}_{roundId}`); getActionItems returns `[]` when `selectedReviewRound.round < currentReviewRound.round` — live: sub 168 past round 1 showed no decision buttons, current round 2 showed all ·
<sup>d</sup> `editorial-decisions` variant table (RequestRevisions/Resubmit/NewExternalReviewRound/CancelReviewRound) ·
<sup>e</sup> workflowConfigAuthorOJS getActionItems (`workflow.uploadRevisions`, gated on `selectedReviewRound.statusId ∈ {REVISIONS_REQUESTED, RESUBMIT_FOR_REVIEW, REVISIONS_SUBMITTED}`); useFileManagerConfig `WORKFLOW_REVIEW_REVISIONS` (AUTHOR: LIST/UPLOAD/EDIT/DELETE); live: atester saw "Upload revisions" + "Revisions Uploaded" ·
<sup>f</sup> PKPReviewController::requestAuthorResponse() (roleAuthorizer MANAGER/SITE_ADMIN/SUB_EDITOR; 422 unless min-reviews met or all accepted reviews completed; 409 if a response exists); AuthorResponseRequestManagerStore `canRequestReviewRoundAuthorResponse`; live: dbarnes's Request Response button enabled on sub 171 (completed round) ·
<sup>g</sup> PKPReviewController::submitAuthorResponse() (roleAuthorizer AUTHOR; AddResponse `passedValidation` re-checks the caller is an assigned author of the round's stage); AuthorResponseManager.vue (author side, shown when `isAuthorResponseRequested` or status ∈ {ACCEPTED, REVISIONS_REQUESTED}); live: response row created by atester on sub 171 ·
<sup>h</sup> useReviewRoundAuthorResponseConfig getAuthorItemActions (View/Delete, only for the submitting author's row, only once a response exists); PKPReviewController::editAuthorResponse()/deleteAuthorResponse() (MANAGER/SITE_ADMIN/SUB_EDITOR)

## Fields & validation

Three forms live here. The **revision upload** reuses the shared file-upload wizard
(mechanics owned by `submission-files`); this spec owns only the two author-response forms.

| Field (UI label) | Required? | Rules | Anchor |
|------------------|-----------|-------|--------|
| **Revision file** (Upload revisions) | Yes | The author's revised manuscript, uploaded into the round as a **review-revision** file; each file carries a genre and lands associated to the *current* round | useFileManagerConfig `WORKFLOW_REVIEW_REVISIONS` (`SUBMISSION_FILE_REVIEW_REVISION`); PKPSubmissionFileController::add() |
| **Request Response — Subject / Message / Locale** | Yes | The email an editor composes when requesting a response; pre-filled from the `RequestReviewRoundAuthorResponse` template, with the reviewer comments woven in; CC/BCC and attachments optional | RequestAuthorResponse (`subject`, `body`, **`locale`** all required — live: a request missing `locale` 422s "This field is required."; `cc`, `bcc`, `attachments` optional); RequestReviewResponsePage |
| **Author Response — Response text** | Yes | The author's written reply (rich text, multilingual); stored as the round's single author response | ReviewRoundAuthorResponseCommonValidator (`authorResponse`: array, required) |
| **Author Response — On behalf of** (associated authors) | Yes | Which contributor(s) the response is submitted on behalf of; each must be an author on the round's publication | ReviewRoundAuthorResponseCommonValidator (`associatedAuthorIds`: array, required; `after()` validates each id) |

A **review round** itself (`reviewRound.json`) is entirely system-set: `round`, `stageId`,
`statusId`/`status` (computed, read-only), `publicationId`, and the nested `authorResponse`
projection. The `isAuthorResponseRequested` flag is a round *setting*
(`review_round_settings`), flipped by the request action, not a user field. <sup>a</sup>

<sup>a</sup> schemas/reviewRound.json (`status` readOnly); ReviewRound `getAdditionalFieldNames()` (`isAuthorResponseRequested`); maps/Schema.php getPropertyReviewRounds()

## Rules & state

Stages/statuses by UI name (from `editorial-decisions`): **Submission**(1) · **Review**
(external review, 3) · **Copyediting**(4) · **Production**(5); submission status
**Queued**(1)/**Declined**(4). All round-status values below are `ReviewRound::REVIEW_ROUND_STATUS_*`.

### 1. A round is a `review_rounds` row with a number and a status

Each round is one `review_rounds` row (`submissionId`, `stageId`, `round`, `status`,
`publicationId`). **Round 1 is created by the Send-for-Review decision**; each subsequent
round by a Create-New-Review-Round decision (both owned by `editorial-decisions`). Round
numbers are a 1-based sequence per stage (`ReviewRoundDAO` assigns `lastReviewRound + 1`).
A round owns, through join/assoc: its reviewers (`review_assignments`,
`assign-and-manage-reviewers`), its files (rule 6), and at most one author response
(rule 9). Verified live: Send-for-Review opened round 1; Create-New-Review-Round added
round 2 (sub 168, two rounds). <sup>a</sup>

### 2. The round status is a 16-value label — partly stored, partly computed

The **stored** `status` column is set explicitly by decisions (in OJS: RequestRevisions→1,
Resubmit→2, Accept→4, Decline→5; BackFromCopyediting→16) and is *also* over-written with the
computed value on every reviewer/revision event (rule 10, `updateStatus`) — so the column
often holds a computed value (6–11) too. Everything the label shows is nonetheless **(re)computed
on read** by `ReviewRound::determineStatus()` from the round's reviewer/recommendation/revision
state; the stored column is only a cache. The label a UI shows is `getStatusKey()` → localized
string. Statuses (computed IDs are live-verified on `publicknowledge` 2026-07-03 across seeded
rounds — 1, 2, 4, 5, 6, 7, 8, 9, 10, 16 observed directly; 11 & 15 driven by the retained test's
author-upload flow): <sup>b</sup>

| # | Constant | Source | Label (en) |
|---|----------|--------|------------|
| 1 | REVISIONS_REQUESTED | stored (RequestRevisions) | "Revisions have been requested." ✓ |
| 2 | RESUBMIT_FOR_REVIEW | stored (Resubmit) | "Revisions requested from the author to be taken to a new review round." ✓ |
| 3 | SENT_TO_EXTERNAL | *(OMP internal→external artifact)* | "…sentToExternal" — **OJS-inert: no OJS decision ever writes it** (verified: no `updateStatus(…, SENT_TO_EXTERNAL)` caller; only OMP's internal-review stage sets it) |
| 4 | ACCEPTED | stored (Accept) | "…accepted" ✓ |
| 5 | DECLINED | stored (Decline) | "…declined" ✓ |
| 6 | PENDING_REVIEWERS | computed (no reviewers) | "Waiting for reviewers to be assigned." ✓ |
| 7 | PENDING_REVIEWS | computed (awaiting reviews) | "Awaiting responses from reviewers." ✓ |
| 8 | REVIEWS_READY | computed (a submitted, not-yet-considered review) | editor "New reviews have been submitted." / **author variant** "…and are being considered by the editor." ✓ (author variant reaches only the notification — Known deviations) |
| 9 | REVIEWS_COMPLETED | computed (all confirmed) | "All reviews are confirmed and a decision is needed." ✓ |
| 10 | REVIEWS_OVERDUE | computed | editor "A review is overdue." / **author variant** "One or more reviewers missed their deadline…No action is needed from you right now…" ✓ (author variant reaches only the notification — Known deviations) |
| 11 | REVISIONS_SUBMITTED | computed (revision uploaded) | "Revisions have been submitted and a decision is needed." ✓ |
| 12–14 | PENDING/READY/COMPLETED_RECOMMENDATIONS | computed (recommend-only editors) | `…recommendations*` |
| 15 | RESUBMIT_FOR_REVIEW_SUBMITTED | computed (revision uploaded after Resubmit) | "…submissionResubmitted" |
| 16 | RETURNED_TO_REVIEW | stored (BackFromCopyediting) | "…returnedToReview" |

`determineStatus()` resolves in a fixed order: a *revisions-requested* or *resubmit* round
first checks whether a revision file has been uploaded since the decision (→ SUBMITTED
variant, rule 4); terminal stored values (SENT_TO_EXTERNAL/ACCEPTED/DECLINED) pass through;
recommend-only editor state is checked next; then the reviewer-assignment tally decides
PENDING_REVIEWERS / REVIEWS_OVERDUE / REVIEWS_READY / PENDING_REVIEWS / PENDING_RECOMMENDATIONS;
RETURNED_TO_REVIEW is preserved; the default is REVIEWS_COMPLETED. <sup>b</sup>

### 3. The status label surfaces per round, in the panel and in a notification

In the workflow, the round status renders in a **Status** card
(`WorkflowSubmissionStatus.vue`) headed **"Round N Status"** with the label as its body,
scoped to the *selected* round (verified: sub 172 showed "Round 1 Status / Revisions have
been requested."). Two nuances: **(a)** the card keys off the **current** round, so when a
*prior* round is selected it shows a generic "submission is in the next review round"
message rather than that past round's historical status; **(b)** when the journal enforces a
**minimum reviews** count, PENDING/READY/COMPLETED/OVERDUE statuses are overlaid with a
minimum-reviews message instead of the raw label. The same status also drives an in-app
notification (rule, Side effects). ⚠ The label always uses the **editor** phrasing even on
the author's own view — see Known deviations. <sup>c</sup>

### 4. The revision cycle is a small state machine (decision half owned by editorial-decisions)

The heart of the feature. An editor's revision decision sets the round's stored status; the
author's upload then advances it:

- **Request Revisions** → round **REVISIONS_REQUESTED**(1); the author is expected to revise
  **in the same round**. When the author uploads a review-revision file, the round
  recomputes to **REVISIONS_SUBMITTED**(11) — verified live end-to-end (sub 172: uploading a
  revision flipped the round from statusId 1 "Revisions have been requested." to statusId 11
  "Revisions have been submitted and a decision is needed."). The editor then acts again
  (accept, request more revisions, or open a new round).
- **Resubmit for Review** → round **RESUBMIT_FOR_REVIEW**(2); the author's upload advances it
  to **RESUBMIT_FOR_REVIEW_SUBMITTED**(15) by the same predicate; the editor is expected to
  open a fresh round for the resubmission.
- **Create New Review Round** opens the next round (PENDING_REVIEWERS) with the submission
  still in Review. As a side effect it **resets the prior round's stored `status`** to
  PENDING_REVIEWERS (`DecisionType::runAdditionalActions` writes the new round status onto the
  decision's own round), so that round's label recomputes from its reviewers rather than
  reflecting the revisions that were requested (verified live: sub 702 round 1 stored=6 but
  computes to **9 REVIEWS_COMPLETED**, not a revisions status, after a new round opened). No
  data is lost — the Request-Revisions decision persists in full in the decision history; the
  round-status label is a computed cache, not a historical record. Whether the browsing UI
  *should* still surface "a revision round happened" is Open question 4 (parallels the
  `editorial-decisions` cancel-round history note).

The "uploaded since decision" test is `Repo::decision()->revisionsUploadedSinceDecision()`
(each revision file's `updatedAt` vs the pending-revisions decision's `dateDecided`),
consulted both by `determineStatus()` and the pending-revisions notification (rule 5). The
decisions themselves, their wizards and the "no-new-round vs Resubmit" radio are owned by
`editorial-decisions`. <sup>d</sup>

### 5. The author's revision-upload surface

The author revises through the round's **Revisions Uploaded** panel (Vue `FileManager`
namespace `WORKFLOW_REVIEW_REVISIONS`, file stage **`SUBMISSION_FILE_REVIEW_REVISION`**=15)
plus a top-of-panel **Upload revisions** action button that appears only while the round is
in a revisions-requested/resubmit/submitted state. Unusually for a FileManager, **authors
may upload/edit/delete** here (most namespaces are list-only for authors). Listing is a plain
API read (`GET submissions/{id}/files?fileStages=15&reviewRoundIds={round}`); the **upload**
still runs through the legacy file-upload wizard (`FileUploadWizardHandler`, launched as a
modal from the Vue panel). Verified live: atester saw the "Upload revisions" button and the
"Revisions Uploaded" panel, and an uploaded file advanced the round status. <sup>e</sup>

### 6. `review_round_files` (files for the round) vs revision files

`review_round_files` is a **join of a submission file to a specific round** (`submission_id`,
`review_round_id`, `stage_id`, `submission_file_id`), recording "the files made available for
this round." A file gets a row here when it is saved with `assocType`
**ASSOC_TYPE_REVIEW_ROUND** and `assocId` = the round id — the persistence hook
`SubmissionFile\DAO::insertReviewRound()` writes it (there is no dedicated `ReviewRoundFileDAO`).
Both the editor's **Files for Review** (`SUBMISSION_FILE_REVIEW_FILE`, what reviewers review —
promoted in from submission files by `editorial-decisions`/`send-to-review`, per-reviewer
limiting by `assign-and-manage-reviewers`) and the author's **revision** files
(`SUBMISSION_FILE_REVIEW_REVISION`) are round-scoped this way (verified: the uploaded revision
landed with assocType 523=ASSOC_TYPE_REVIEW_ROUND, assocId = the round). Distinct from
`review_files` (a submission file joined to a single reviewer *assignment*, owned by
`reviewer-response`/`assign-and-manage-reviewers`). <sup>f</sup>

### 7. New round vs round staying open; cancel round

A round stays open until a decision closes or supersedes it. **Create New Review Round**
adds the next round (rule 4); **Cancel Review Round** is retractable and **deletes the
current round and every decision recorded in it** — if it was the only round, the submission
drops back to the **Submission** stage (verified: sub 170, cancelReviewRound → zero rounds,
stage 3→1). Deleting a round cascades its settings, its `review_round_files` join rows and
its `NOTIFICATION_TYPE_REVIEW_ROUND_STATUS` notification. The Cancel-Review-Round button is
offered only on a round with **no recorded decision** (verified: present on a fresh round 2,
absent on a round that already carried a Request-Revisions decision) — a decision-availability
rule owned by `editorial-decisions`. <sup>g</sup>

### 8. Round history — browsing prior rounds

The left workflow menu lists every round (**Review Round 1 … N**); selecting one re-scopes
the whole External Review pane to that round's reviewers, files and status. A **past** round
is read-only for decisions (its action bar is empty; rule, Actors). There is no separate
editor "history" page — the round selector *is* the history. A **reviewer** has a dedicated
per-round history endpoint (`GET reviews/history/{submissionId}/{reviewRoundId}`,
`PKPReviewController::getHistory()`) returning that round's publication snapshot, the
reviewer's own recommendation/comments/attachments and the files they reviewed — used by the
reviewer's "view my past review" surface (the reviewer journey is owned by
`reviewer-response`). Verified: sub 168's menu listed Review Round 1 + Review Round 2; the
past round showed no decision buttons. <sup>h</sup>

### 9. The author-response flow (newer 3.6 flow — LIVE, wired end-to-end)

Distinct from uploading a revised manuscript, a round can carry **one written author
response**. This flow is **live in OJS 3.6** (both managers are registered on
`WorkflowPageOJS.vue` and mounted from the external-review config; verified end-to-end):

1. **Editor requests** — the round's **Author Response** panel
   (`AuthorResponseRequestManager`) lists the assigned authors and a **Request Response**
   button, **enabled only** once the round has enough completed reviews (the journal's
   `numReviewsPerSubmission` minimum met, or **all accepted reviews completed**) and no
   response yet exists. The button opens a compose page
   (`reviewResponse/requestAuthorResponse` → `RequestReviewRoundAuthorResponse.vue`); sending
   emails the assigned authors the **`RequestReviewRoundAuthorResponse`** mailable (with the
   reviewer comments woven in and a deep link that auto-opens the author's response form) and
   flips the round's `isAuthorResponseRequested` flag to true. Verified live: dbarnes's
   request on sub 171 flipped the flag and delivered the email to the author.
2. **Author submits** — the author's **Author Response** panel (`AuthorResponseManager`,
   shown when a response was requested or the round is Accepted/Revisions-Requested) offers a
   **Submit Response** button that opens the response form modal (`AuthorResponseFormModal`) —
   the same modal the email deep link (`?reviewResponseAction=respond`) auto-opens. (Verifier
   note 2026-07-03: the panel button is **live and functional** — clicking it as the author
   opened the "Submit Your Response to Reviewer Feedback" side modal with the rich-text
   *Author Response* field; the earlier "inert button" concern is **refuted**, both the panel
   button and the email path reach the form.) Submitting **creates the round's single
   `review_round_author_responses` row** with the rich-text body, the submitting participant,
   and the contributor(s) it is on behalf of.
   Verified live: atester's submission created response id 1 with the body, associated author
   169 and `isPublic:false`.
3. **Editor views / edits / deletes** — the response appears back in the editor's panel with
   **View** and **Delete** (edit via API); there is at most one response per round. The
   one-response guard is enforced on **both** ends: a further **Request Response** 409s
   (`requestAuthorResponse` checks `$reviewRound->getAuthorResponse()`) and a second author
   **submit** 409s (`AddResponse::passedValidation` checks `$hasExistingResponse`). Nuance
   (live): the 409 keys on an existing *response*, not on a prior *request* — re-requesting a
   round that was already requested but not yet answered simply **re-sends** the email (200),
   as verified on sub 697 (two requests → 200, 200; `isAuthorResponseRequested` stayed true,
   no response row). Verified live end-to-end: editor request on the ACCEPTED sub 697 → 200
   then re-send 200; author submit on sub 695 → response created, second submit → 409;
   a submit missing `associatedAuthorIds` → 422 "This field is required."

A response carries **no file attachments** (text + author list only); its **public
visibility** (`isPublic`) is derived from whether all non-declined reviews in the round are
publicly visible (feeds open-review display), and it may be assigned a **DOI**
(`doi_id` → a `TYPE_AUTHOR_RESPONSE` DOI, deposit owned by `doi-deposit`). <sup>i</sup>

### 10. Round-status recomputation is event-driven

`ReviewRoundDAO::updateStatus($round, $status = null)` writes the status only when it
changed; a null `$status` forces a `determineStatus()` recompute. It is called on: **decision
events** (`DecisionType::runAdditionalActions()` — a decision either sets an explicit round
status or, when it declares none, forces a recompute; `BackFromCopyediting` sets
RETURNED_TO_REVIEW); **reviewer events** (`ReviewAssignment\Repository` recomputes on every
add/edit/delete — assign, accept, decline, submit, cancel, reinstate — so the round label
tracks the reviewers automatically); and **revision-file events** (`SubmissionFile\Repository`
recomputes on revision upload and deletion, flipping REVISIONS_REQUESTED↔REVISIONS_SUBMITTED).
This is why the label in rule 2 is described as "computed on read": the stored column is kept
roughly in sync, but the displayed value always runs `determineStatus()`. <sup>j</sup>

<sup>a</sup> ReviewRound; ReviewRoundDAO (`build`/`getLastReviewRoundNumber`); `editorial-decisions` (SendExternalReview/NewExternalReviewRound create the round); live sub 168 ·
<sup>b</sup> ReviewRound REVIEW_ROUND_STATUS_* constants; ReviewRound::determineStatus(); getStatusKey(); live labels subs 166–172 (statusId→label read from the submission API `reviewRounds[].status`) ·
<sup>c</sup> WorkflowSubmissionStatus.vue (`message` computed — heading `notification.type.roundStatusTitle`, body `currentReviewRound.status`; prior-round branch → `workflow.submissionInNextReviewRound`; #10363 minimum-reviews overlay via `checkMinimumConsideredReviews`); maps/Schema.php getPropertyReviewRounds() (`status = __(getStatusKey())`, no `$isAuthor`); live sub 172 ·
<sup>d</sup> RequestRevisions/Resubmit `getNewReviewRoundStatus()`; ReviewRound::determineStatus() (REVISIONS_SUBMITTED / RESUBMIT_FOR_REVIEW_SUBMITTED branches); Repo::decision()->revisionsUploadedSinceDecision(); scenarios.md gotcha (newExternalRound resets round-1 status); live sub 172 (1→11) + sub 168 (round 1 recomputed to 9) ·
<sup>e</sup> useFileManagerConfig `FileManagerConfigurations.WORKFLOW_REVIEW_REVISIONS` (`SUBMISSION_FILE_REVIEW_REVISION`, AUTHOR = LIST/UPLOAD/EDIT/DELETE); workflowConfigAuthorOJS getActionItems (`workflow.uploadRevisions`, status gate); fileManagerStore (API list) + useFileManagerActions `fileUpload` (`FileUploadWizardHandler`); live atester sub 172 ·
<sup>f</sup> ReviewsMigration (`review_round_files`); SubmissionFile\DAO::insertReviewRound() (assocType ASSOC_TYPE_REVIEW_ROUND=0x20B); SubmissionFile SUBMISSION_FILE_REVIEW_FILE=4 / REVIEW_REVISION=15; live sub 172 file 174 (assocType 523) ·
<sup>g</sup> `editorial-decisions` (CancelReviewRound `DecisionRetractable`, getNewStageId→Submission; NewExternalReviewRound); ReviewRoundDAO::deleteById() (cascades settings/files/notifications); live sub 170 ·
<sup>h</sup> useWorkflowNavigationConfigOJS getReviewItems()/getReviewItem(); workflowConfigEditorialOJS getActionItems (past-round `[]`); PKPReviewController::getHistory() (roleAuthorizer MANAGER/SITE_ADMIN/REVIEWER); live sub 168 ·
<sup>i</sup> WorkflowPageOJS.vue (registers AuthorResponseRequestManager + AuthorResponseManager); workflowConfigEditorialOJS/AuthorOJS (External Review getPrimaryItems push); PKPReviewController::{requestAuthorResponse,submitAuthorResponse,editAuthorResponse,deleteAuthorResponse}(); AuthorResponse (model, `associateAuthorsToResponse`, `isPublic`, `doi`); AuthorResponseManager::sendAuthorRequest(); live subs 171 end-to-end ·
<sup>j</sup> ReviewRoundDAO::updateStatus(); DecisionType::runAdditionalActions()/updateReviewRoundStatus(); ReviewAssignment\Repository (add/edit/delete → updateReviewRoundStatus); SubmissionFile\Repository (revision add/delete → updateStatus); live sub 172

## Side effects

- **Round-status notification** (`NOTIFICATION_TYPE_REVIEW_ROUND_STATUS`, NORMAL/bell) — one
  is created per round at round creation (`DecisionType::createReviewRound()`), scoped to the
  round (`ASSOC_TYPE_REVIEW_ROUND`) and visible to everyone on the submission. Its **message
  is computed on read** from `getStatusKey($isAuthor)`, so as the round status changes the same
  notification renders new text — and here the **author vs editor phrasing** actually differs
  (the panel does not, see Known deviations). It is deleted only when the round is deleted.
- **Pending-revisions task** (`NOTIFICATION_TYPE_PENDING_EXTERNAL_REVISIONS`, TASK,
  author-facing, warning style) — a reconciled (upsert-or-delete) task, not a fire-once event.
  Recording **Request Revisions** creates it for each assigned author with an "upload revision"
  call-to-action; **uploading a revision deletes it** (and its paired
  `NOTIFICATION_TYPE_EDITOR_DECISION_PENDING_REVISIONS`), because
  `PendingRevisionsNotificationManager` re-checks `revisionsUploadedSinceDecision()`. Managed
  by `PendingRevisionsNotificationManager::updateNotification()`, driven from the decision
  flow and the revision-file flow. The internal-review twin
  (`NOTIFICATION_TYPE_PENDING_INTERNAL_REVISIONS`) is claimed here for completeness but is
  **OJS-inert** — OJS has no internal-review stage, so it is never created (see Open questions).
- **Request-author-response email** (`RequestReviewRoundAuthorResponse`,
  `REQUEST_REVIEW_ROUND_AUTHOR_RESPONSE`) — to the assigned authors, sent by the editor's
  Request-Response action (rule 9); carries the reviewer comments and a deep link that
  auto-opens the author's response form. Delivery/log owned by `email-delivery`.
- **Data mutations** — round creation/deletion (`review_rounds` + `review_round_settings`
  incl. `isAuthorResponseRequested`); the `review_round_files` join on file save; the
  `review_round_author_responses` (+ `_settings`, `_authors`) rows on response submit/edit;
  the round-status recompute on decision/reviewer/revision events (rule 10). Round creation
  and the decision-side transitions are performed by `editorial-decisions`; template-task
  auto-creation on a stage move is owned by `tasks-discussions`.

## Settings that modify behavior

- **Reviews required before a decision** (`numReviewsPerSubmission`) — when set, the round
  status card overlays a minimum-reviews message on the pending/ready/completed/overdue
  statuses (rule 3), and it is one gate that **enables the Request-Response button** (rule 9).
  `publicknowledge` has it 0 (so "all accepted reviews completed" is the operative gate).
- **Default review mode / due-date defaults / reminders** (Settings → Workflow → Review) —
  shape the *reviewers* within a round; owned by `assign-and-manage-reviewers` /
  `workflow-settings` / `scheduled-tasks`, not the round object itself.
- **Public review visibility** — a round's author response is public iff all its non-declined
  reviews are publicly visible; the per-review visibility default is a journal setting
  (`assign-and-manage-reviewers` / `open-peer-review-display`).
- No setting changes the round-status machine or the round-number sequence; those are fixed in
  `ReviewRound`/`ReviewRoundDAO` and the decision types.

## Cross-feature interactions

- **editorial-decisions** — **owns** the decisions that reshape rounds (Request Revisions,
  Resubmit for Review, Create New Review Round, Cancel Review Round, Accept, Decline, Revert)
  and their stored round-status effects; this spec owns the round object, the computed status,
  the author revision/response cycle and round history. Cite that spec's variant table, never
  re-narrate a decision.
- **assign-and-manage-reviewers** — owns the reviewer list, per-reviewer file grants and
  reviewer status *within* a round (the Reviewers panel); this spec owns the round that groups
  them and the round-status recompute their state drives.
- **reviewer-response** — owns the reviewer's own accept/decline/complete journey, their
  attachments and `review_files`; it explicitly defers the author-response endpoints and page
  to this spec. A round's status computes from reviewer statuses (seam).
- **send-to-review** — the stage-1 workspace whose Send-for-Review exit opens round 1 and
  promotes the first files-for-review; this spec picks up at round 1.
- **submission-files** — owns the general `FileManager`, the upload wizard and dependent
  files; this spec owns the round-scoped **revision** and **files-for-review** usage and the
  `review_round_files` artifact. The legacy review-file **grid handlers** are left for
  `submission-files` to adjudicate (see Open questions).
- **workflow-stage-navigation** — owns `PAGE-workflow-externalreview` (the route/shell), the
  stage tabs and review-stage access; this spec owns the round-panel content and the
  round-selector menu items.
- **tasks-discussions** — owns the Review Tasks & Discussions panel inside the round pane.
- **notifications / email-delivery / email-templates-management** — own the notification
  inbox framework, mail delivery/log, and the editable `RequestReviewRoundAuthorResponse`
  template respectively.
- **doi-deposit** — owns the author-response DOI (`doi_id`, `TYPE_AUTHOR_RESPONSE`) deposit.
- **open-peer-review-display** — consumes a round's public author response / review
  visibility.
- **publication-amendments** — a **separate** published-article "summary of changes" flow;
  despite a FEATURE-MAP note it does **not** share the `review_round_author_responses` table
  (it uses a `summaryOfChanges` field on review-revision *files* + `publications.update_type`).
  Out of scope here.

## Canonical scenarios

1. **Request revisions, author revises in place** — an editor on a review round records
   *Request Revisions* (no new round); the round shows **"Revisions have been requested."** and
   the author gets a pending-revisions task. The author opens their round view, clicks **Upload
   revisions**, and uploads a revised manuscript; the round flips to **"Revisions have been
   submitted and a decision is needed."** and the task clears (verified live end-to-end,
   sub 172).
2. **Resubmit for review, then a fresh round** — the editor records *Resubmit for Review*
   (round → "…taken to a new review round"); the author uploads a revision (round →
   resubmit-submitted); the editor records *Create New Review Round*, opening round 2 (Pending
   Reviewers) and recomputing round 1's label from its reviewers.
3. **Open a second review round** — with reviews complete in round 1, the editor records
   *Create New Review Round*; the workflow menu grows **Review Round 2** and the panel
   re-scopes to it (verified live, sub 168).
4. **Cancel a review round** — the editor records *Cancel Review Round*; the current round and
   its in-round decisions are deleted, and (as the only round) the submission drops back to the
   Submission stage (verified live, sub 170).
5. **Round status tracks its reviewers** — across a round the Status card moves through
   *Awaiting responses from reviewers* → *reviews ready* → **"All reviews are confirmed and a
   decision is needed."** with no editor action on the round itself, because the status
   recomputes on each reviewer event (verified live: statusId 7 and 9 on seeded rounds).
6. **Browse a prior round** — after round 2 opens, the editor selects **Review Round 1** from
   the menu and sees that round's reviewers and files but **no decision buttons**; the current
   round 2 retains the full decision bar (verified live, sub 168).
7. **Editor requests a written author response** — on a round with completed reviews the
   **Request Response** button is enabled; the editor composes and sends the request; the
   round's `isAuthorResponseRequested` flips true and the author receives the
   *RequestReviewRoundAuthorResponse* email (verified live, sub 171).
8. **Author submits the written response** — the author opens the Author Response form (auto-
   opened by the email link, or via the panel) and submits a reply on behalf of one or more
   contributors; the round's single response row is created and shown back to the editor with
   **View/Delete** (verified live end-to-end, sub 171: response id 1).
9. **Only one response per round** — a second Request-Response attempt on a round that already
   has a response is refused (409); the author cannot submit two.
10. **Author's read-mostly round view** — the author opening their own submission in external
    review sees the round Status, their **Revisions Uploaded** panel and a redacted reviewer
    view, but no files-for-review and no participant controls (verified live: atester on
    sub 172).
11. **Permission boundary** — a reviewer never reaches the round panel; an author cannot open
    a new round, request/edit/delete a response, or manage reviewers; requesting an author
    response before reviews are complete is refused (422). Live-verified 2026-07-03 via
    authenticated API calls: the author-response **request** route rejects an author *and* a
    reviewer with **HTTP 401 `user.authorization.roleBasedAccessDenied`** (roleAuthorizer =
    MANAGER/SITE_ADMIN/SUB_EDITOR); the author-response **submit** route rejects an editor and a
    reviewer the same way (roleAuthorizer = AUTHOR only); an editor requesting on a
    PENDING_REVIEWS round with no completed review → **422** "This review round has review
    assignments that needs to be completed…" (UI also hides the controls).
12. **Files carry into the round** — files promoted for review and the author's uploaded
    revisions both land as round-scoped files (`review_round_files`, assoc'd to the round), so
    switching rounds shows each round's own files (verified live: revision file assoc'd to the
    round on sub 172).

## Known deviations (as-built ≠ intent)

- ⚠ **The round-status label shows editor phrasing to the author in the Status card.**
  ([app-changes](../../e2e/app-changes.md) §2 row 80.) `ReviewRound::getStatusKey($isAuthor)`
  defines author-specific wording for exactly two statuses — **REVIEWS_READY** and
  **REVIEWS_OVERDUE** — but the submission schema map builds the round's `status` string with
  `__($reviewRound->getStatusKey())` **without** the `$isAuthor` flag, and
  `WorkflowSubmissionStatus.vue` binds that string verbatim (`body: currentReviewRound.status`),
  so the author's Status card always renders the `editor.*` phrasing. The author-specific text
  only reaches the `REVIEW_ROUND_STATUS` notification (which *does* pass the flag). Verified live
  as the author (atester): the REVIEWS_OVERDUE round (sub 696) showed **"A review is overdue."**
  and the REVIEWS_READY round (sub 704) showed **"New reviews have been submitted."** — the
  editor keys — instead of the author reassurance ("…No action is needed from you right now…").
  (All *other* statuses share one key, so the divergence surfaces only on these two — the round
  the spec author first probed, REVISIONS_REQUESTED, has no author variant and is *not* evidence
  of the bug.) Low-severity wording inconsistency; no data loss.
- **Opening a new round recomputes the prior round's status label** — *plain rule, not a ⚠*
  (see rule 4 and Open question 4). *Create New Review Round* resets the previous round's stored
  `status` to PENDING_REVIEWERS, so its label recomputes from its reviewers and no longer names
  the revisions that were requested (verified live: sub 702 round 1 stored=6, computes to 9
  "All reviews are confirmed…"). This is **not** a data-loss deviation like the
  `editorial-decisions` cancel-round finding — that one cascade-deletes the decision row; here
  the Request-Revisions decision persists intact in history and only the derived label
  recomputes. Whether the browsing UI should still surface the prior revision round is an
  intent question for the maintainer (OQ4), not an as-built defect.
- **Round-less panel URL throws a console error (not user-reachable).** Opening the
  external-review pane with a bare stage menu key (`workflow_3`, no round id) leaves
  `selectedReviewRound` null; the author-response manager store then throws
  `Cannot read properties of null (reading 'publicationId')` and the Status card shows a
  generic message. This is **not reachable through normal navigation** — the menu (including
  the stage-parent item) always resolves to a concrete round. Re-verified live 2026-07-03
  (dbarnes): the hand-typed `…&workflowMenuKey=workflow_3` throws exactly
  `TypeError: Cannot read properties of null (reading 'publicationId')` (in a Pinia `useStore`
  init) and renders no Status card, while a default open (`?workflowSubmissionId=695`, no key)
  redirects to `…&workflowMenuKey=workflow_3_356` and the concrete key throws nothing. A latent
  defensive-code gap reachable only by a hand-typed URL; no ledger row (cf. the
  `editorial-decisions` access-shielded-500 pattern). See Open question 3.

## Open questions

1. **Author-response file grids' ownership (seam).** The review-file/attachment **grid
   handlers** (`EditorReviewFilesGridHandler`, `ManageReviewFilesGridHandler`,
   `LimitReviewFilesGridHandler`, `ReviewerReviewFilesGridHandler`, the review-attachment
   grids, and the superseded `WorkflowReviewRevisionsGridHandler` /
   `AuthorReviewRevisionsGridHandler`) are hinted at this feature in the atlas but form a
   cross-cutting file cluster spanning send-to-review, assign-reviewers, reviewer-response and
   this spec. They are **left unclaimed** for `submission-files` (feature 20) to adjudicate;
   this spec documents the *live Vue* review-revision/files-for-review surfaces and the
   `review_round_files` artifact only. The two `*RevisionsGridHandler`s are dead/superseded by
   the Vue `WORKFLOW_REVIEW_REVISIONS` FileManager (verifier-confirmed 2026-07-03: the atlas
   liveness sweep marks both **suspected-dead** — `WorkflowReviewRevisionsGridHandler` has *no*
   live reference; `AuthorReviewRevisionsGridHandler`'s only caller is the dead
   `authorDashboard/reviewRoundInfo.tpl`).
2. **`NOTIFICATION_TYPE_PENDING_INTERNAL_REVISIONS` — OJS-inert (resolved: document-as-inert).**
   Claimed here so the atom has an owner. Verifier-confirmed 2026-07-03: the only creator,
   `PendingRevisionsNotificationManager::getStagesData()`, keys the internal-revisions type on
   `$stagesData[WORKFLOW_STAGE_ID_INTERNAL_REVIEW]`, which OJS (no internal-review stage) never
   populates → it is never created; the type appears elsewhere only in the twin-delete query
   (`submissionFile/Repository`), harmlessly. Documented as OJS-inert, not dropped (parallels
   `editorial-decisions`' `EDITOR_DECISION_INTERNAL_REVIEW`).
3. **Should the round-status author phrasing reach the panel?** `getStatusKey($isAuthor=true)`
   exists but is unused in the Vue Status card (deviation 1). Intended (author sees editor
   wording) or should the schema map pass the flag on the author's view?
4. **New-round history loss** — should opening a new round preserve the prior round's
   "revisions requested" status somewhere the UI shows, or is decision-history-only intended?

---

## Reference — entry points & surfaces

| Entry | Path | Atom |
|-------|------|------|
| External-review round pane (shell) | `/{journal}/dashboard/editorial?workflowSubmissionId={id}&workflowMenuKey=workflow_3_{roundId}` (route owned by `workflow-stage-navigation`) | PAGE-workflow-externalreview *(referenced — owned by workflow-stage-navigation)* |
| Review round entity / schema | `review_rounds` (+ `review_round_settings`, `review_round_files`); `schemas/reviewRound.json` | DB-review_rounds, DB-review_round_settings, DB-review_round_files, SCHEMA-review-round |
| Request-author-response compose page | `reviewResponse/requestAuthorResponse` (`ReviewResponseHandler::requestAuthorResponse` → `RequestReviewRoundAuthorResponse.vue`) | PAGE-reviewresponse-requestauthorresponse, VUE-request-review-round-author-response |
| Author-response managers (Vue) | round panel → **Author Response** (`AuthorResponseRequestManager` editor / `AuthorResponseManager` author) | VUE-author-response-request-manager, VUE-author-response-manager |
| Author-response API | `POST reviews/{sub}/{round}/authorResponse/requestResponse` · `POST …/authorResponse` · `PUT/DELETE …/authorResponse/{id}` | API-review-request-author-response, API-review-submit-author-response, API-review-edit-author-response, API-review-delete-author-response |
| Author-response storage | `review_round_author_responses` (+ `_settings`, `_authors`) | DB-review_round_author_responses, DB-review_round_author_response_settings, DB-review_round_author_response_authors |
| Request-response email | `RequestReviewRoundAuthorResponse` (`REQUEST_REVIEW_ROUND_AUTHOR_RESPONSE`) | MAIL-request-review-round-author-response |
| Round notifications | `NOTIFICATION_TYPE_REVIEW_ROUND_STATUS` · `…_PENDING_EXTERNAL_REVISIONS` · `…_PENDING_INTERNAL_REVISIONS` (OJS-inert) | NOTIF-review-round-status, NOTIF-pending-external-revisions, NOTIF-pending-internal-revisions |
| Review-stage authorization | `ReviewRoundRequiredPolicy` · `ReviewStageAccessPolicy` · `ReviewAssignmentFileWritePolicy` | AUTHZ-review-round-required-policy, AUTHZ-review-stage-access-policy, AUTHZ-review-assignment-file-write-policy |
| Reviewer round-history API | `GET reviews/history/{sub}/{round}` (`PKPReviewController::getHistory`) | *(reviewer surface — reviewer-response)* |

## Reference — code anchors

- **Round entity**: `lib/pkp/classes/submission/reviewRound/ReviewRound.php`
  (`REVIEW_ROUND_STATUS_*`, `determineStatus()`, `getStatusKey()`, `getAuthorResponse()`);
  `ReviewRoundDAO.php` (`build`, `updateStatus`, `deleteById`); `schemas/reviewRound.json`;
  migration `lib/pkp/classes/migration/install/ReviewsMigration.php` (`review_rounds`,
  `review_round_files`).
- **Author response**: `lib/pkp/classes/submission/reviewRound/authorResponse/`
  (`AuthorResponse.php`, `AuthorResponseManager.php`); migration
  `lib/pkp/classes/migration/install/ReviewRoundAuthorResponse.php` (+ upgrade
  `.../upgrade/v3_6_0/I12048_ReviewRoundAuthorResponse.php`, DOIs `.../I11332_AddPeerReviewDois.php`);
  API `lib/pkp/api/v1/reviews/PKPReviewController.php` + formRequests
  `{RequestAuthorResponse,AddResponse,EditResponse,ReviewRoundAuthorResponseCommonValidator}.php`
  + `resources/ReviewRoundAuthorResponseResource.php`; page
  `lib/pkp/pages/reviewResponse/ReviewResponseHandler.php` +
  `lib/pkp/classes/components/RequestReviewResponsePage.php`; mailable
  `lib/pkp/classes/mail/mailables/RequestReviewRoundAuthorResponse.php` + trait
  `lib/pkp/classes/mail/traits/ReviewRoundAuthorResponse.php`.
- **Status serialization**: `lib/pkp/classes/submission/maps/Schema.php`
  (`getPropertyReviewRounds`, `getReviewRoundsFromSubmission`).
- **Recompute callers**: `lib/pkp/classes/decision/DecisionType.php`
  (`runAdditionalActions`, `createReviewRound`, `updateReviewRoundStatus`);
  `lib/pkp/classes/submission/reviewAssignment/Repository.php` (`updateReviewRoundStatus`);
  `lib/pkp/classes/submissionFile/Repository.php` (revision add/delete);
  `lib/pkp/classes/submissionFile/DAO.php` (`insertReviewRound`).
- **Notifications**: `lib/pkp/classes/notification/managerDelegate/PendingRevisionsNotificationManager.php`;
  `lib/pkp/classes/notification/PKPNotificationManager.php` (`getNotificationMessage` for
  `REVIEW_ROUND_STATUS`, author/editor phrasing).
- **Frontend**: `lib/ui-library/src/pages/workflow/WorkflowPageOJS.vue`;
  `.../composables/useWorkflowConfig/workflowConfigEditorialOJS.js` +
  `workflowConfigAuthorOJS.js` (External Review pane); `.../useWorkflowNavigationConfig/useWorkflowNavigationConfigOJS.js`
  (round menu); `.../components/primary/WorkflowSubmissionStatus.vue`;
  `lib/ui-library/src/managers/ReviewRoundResponseManager/**` (author-response managers,
  store, form modal); `lib/ui-library/src/managers/FileManager/useFileManagerConfig.js`
  (`WORKFLOW_REVIEW_REVISIONS`, `EDITOR_REVIEW_FILES`);
  `lib/ui-library/src/pages/requestReviewRoundAuthorResponse/RequestReviewRoundAuthorResponse.vue`.
- **Authorization**: `lib/pkp/classes/security/authorization/internal/ReviewRoundRequiredPolicy.php`;
  `.../ReviewStageAccessPolicy.php`; `.../ReviewAssignmentFileWritePolicy.php`.
</content>
</invoke>
