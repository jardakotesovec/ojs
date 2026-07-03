---
name: editorial-decisions
scope: The single home for OJS editorial-decision mechanics — the Record-Decision wizard reached from the workflow action bar, the notify-author/notify-reviewer email steps, attach-files, the decision→stage/status/round transition machine, decline & revert, request-revisions vs resubmit (new round), the recommend-only recommendation flow, and the Done-stage transitions; every stage feature references this rather than re-narrating a decision rule
shared: pkp-lib          # the decision engine (Decision, DecisionType, Repository, policies, mailables) lives in lib/pkp; OJS overrides only the type SET (classes/decision/Repository.php) and two types (Accept, SkipExternalReview) to fold in APC payments
status: verified
e2e-plans: [review-decisions.md, review-rounds-revisions.md]
atlas-claims:
  - PAGE-decision-record
  - SCHEMA-decision
  - DB-edit_decisions
  - API-submission-get-decisions
  - API-submission-add-decision
  - API-submission-return-to-done
  - AUTHZ-decision-write-policy
  - AUTHZ-decision-allowed-policy
  - AUTHZ-decision-stage-valid-policy
  - AUTHZ-decision-type-required-policy
  - FORM-select-revision-decision-form
  - FORM-select-revision-recommendation-form
  - MAIL-decision-accept-notify-author
  - MAIL-decision-back-from-copyediting-notify-author
  - MAIL-decision-back-from-production-notify-author
  - MAIL-decision-cancel-review-round-notify-author
  - MAIL-decision-decline-notify-author
  - MAIL-decision-initial-decline-notify-author
  - MAIL-decision-new-review-round-notify-author
  - MAIL-decision-notify-other-authors
  - MAIL-decision-notify-reviewer
  - MAIL-decision-request-revisions-notify-author
  - MAIL-decision-resubmit-notify-author
  - MAIL-decision-revert-decline-notify-author
  - MAIL-decision-revert-initial-decline-notify-author
  - MAIL-decision-send-external-review-notify-author
  - MAIL-decision-send-to-production-notify-author
  - MAIL-decision-skip-external-review-notify-author
  - MAIL-recommendation-notify-editors
  - EVLOG-SUBM-ED-DEC
  - EVLOG-SUBM-ED-REC
  - EVLOG-SUBM-ED-EMAIL
  - NOTIF-editor-decision-internal-review
  - NOTIF-editor-decision-accept
  - NOTIF-editor-decision-external-review
  - NOTIF-editor-decision-pending-revisions
  - NOTIF-editor-decision-resubmit
  - NOTIF-editor-decision-new-round
  - NOTIF-editor-decision-decline
  - NOTIF-editor-decision-send-to-production
  - NOTIF-editor-decision-revert-decline
  # Informal atoms (atlas Gaps, no table row): the ~35 Decision::* constants, the 21
  # OJS DecisionType classes, WORKFLOW_STAGE_ID_DONE=6, the ApplyDoneWorkflowStage
  # listener, and the I12799 backfill migration are owned here — see the atlas Gaps notes.
---

# Editorial decisions (the decision engine)

## Purpose

An editor moves a submission through the workflow by **recording a decision** — accept
it, send it for review, request revisions, decline it, send it to production, and so on.
This spec is the ONE home for how those decisions work: the button an editor clicks in a
stage pane's action bar, the full-page **Record Decision** wizard that opens (compose an
email to the author, notify reviewers, carry files forward), and — the heart of it — the
**transition machine** that changes the submission's stage, status and review-round
status when a decision is recorded, plus the side effects (author emails, event-log
entries, dashboard notifications). It also owns the **recommend-only** flow (a section
editor records a recommendation the deciding editor then acts on) and the **Done-stage**
transitions that fire automatically when a submission is first published or unpublished.
Every stage feature (send-to-review, review-rounds-and-revisions, copyediting-stage,
production-stage) points here for its decision rules instead of restating them; the
workflow shell that renders the action bar is owned by `workflow-stage-navigation`.

## Actors & permissions

Everything here requires login in a journal context. Recurring terms: a **deciding
editor** is a journal manager or section editor with a **stage assignment on the
submission's *current* stage** whose assignment is *not* flagged recommend-only; a
**recommend-only editor** is a section editor whose stage assignment carries the
recommend-only flag (role config owned by `recommend-only-editors`); **manager scope** =
a journal manager or site admin with *no* stage assignment on the submission, who is
allowed to decide as an unassigned editor (the fallback); **assistants** = copyeditors,
layout editors, proofreaders. Two gates apply to every decision: the **stage guard** —
the submission must be in the exact workflow stage the decision type belongs to — and the
**role gate** below. Assistants, authors and reviewers can never record any decision (the
decision page itself is closed to them, and the API's access gate — `SubmissionAccessPolicy`,
which runs before the write policy — denies them 401 `roleBasedAccessDenied`; see rule 3's
denial-surface note). The action bar
that surfaces these buttons per stage is rendered by `workflow-stage-navigation`; this
table is who may actually *record* each class, verified against the backend write policy
and live-probed in the UI. <sup>a</sup>

| Action | Who may — and when |
|--------|--------------------|
| **Record a stage-transition decision** (Send for Review, Accept & Skip Review, Accept, Send To Production, Move to Review, Move To Copyediting) | • Deciding editors — on a submission assigned to them, when it is in the decision's stage<br>• Manager scope — any submission in the journal (unassigned manager/admin fallback)<br>• Recommend-only editors — only **Send for Review** at the submission stage (the one decision a recommending user may finalize); every other transition is a *recommendation* for them, not a decision<br>• Assistants / authors / reviewers — never <sup>b</sup> |
| **Record a decline / desk-reject** (Decline Submission, from the submission stage or a review round) | • Deciding editors and manager scope, as above<br>• Recommend-only editors — never (they may only *recommend* decline)<br>• Assistants / authors / reviewers — never <sup>b</sup> |
| **Revert a decline** (Revert Decline in a review round; Revert Decline at the submission stage) | • Deciding editors and manager scope — only while the submission is Declined (the button appears only then) <sup>c</sup> |
| **Request revisions / open a new round / cancel a round** (Request Revisions → choose no-new-round vs Resubmit for Review; Create New Review Round; Cancel Review Round) | • Deciding editors and manager scope — during a review round<br>• Recommend-only editors — may only *Recommend Revisions* (a recommendation), never finalize these <sup>b</sup> |
| **Record a recommendation** (Recommend Accept / Recommend Decline / Recommend Revisions) | • Recommend-only editors — during a review round, and only if the submission has **at least one deciding editor** assigned who could act on it (otherwise the decision page 404s)<br>• A regular deciding editor never sees the recommendation buttons (they see the finalizing buttons) <sup>d</sup> |
| **Return to Done / Return to Workflow** (Done-stage) | • Manual **Return to Done** is **manager-scope only** in practice — an unassigned journal manager or site admin (verified live). A section editor who holds a stage assignment on the submission is **refused** (401 `roleBasedAccessDenied` at `SubmissionAccessPolicy`, *before* the decision policies) — see Known deviations<br>• The auto Move-to-Done (on first publish) and Return-to-Workflow (on unpublish) are recorded by the system, not a user <sup>e</sup> |
| **Compose / skip the author email, notify reviewers, attach files** | • Whoever is recording the decision — every notify step is pre-filled and editable, most are skippable (Notify Authors, Notify Reviewers), and files may be attached from submission files, the document library, or a fresh upload <sup>f</sup> |
| **View the decision history** | • Anyone who can open the submission's Activity Log (owned by `editorial-activity-log`); the decision API list is available to any user with submission access <sup>g</sup> |

<sup>a</sup> DecisionHandler::__construct() (page role list: MANAGER, SITE_ADMIN, SUB_EDITOR); DecisionWritePolicy; PKPSubmissionController::authorize() (`addDecision` → SubmissionCompletePolicy + DecisionWritePolicy); live probes 2026-07-03 ·
<sup>b</sup> DecisionAllowedPolicy::effect() — *policy mechanics* (assignment userGroup role must be MANAGER/SUB_EDITOR else `continue`; non-recommendOnly → allowed; unassigned manager/admin fallback → PERMIT, else `noUnassignedDecisions` deny — but the access gate in rule 3 fires first, so this deny is unreachable in practice); Repository::getDecisionTypesMadeByRecommendingUsers() (submission-stage SendExternalReview exception); live-probed: minoue recommend-only saw only Recommend* buttons ·
<sup>c</sup> RevertDecline / RevertInitialDecline (getNewStatus → STATUS_QUEUED); workflowConfigEditorialOJS `isDecisionAvailable` gates the button to declined submissions ·
<sup>d</sup> DecisionHandler::record() (recommendation requires ≥1 non-recommendOnly deciding editor via StageAssignment query, else NotFoundHttpException); Repository::validate() (same check → `requiredDecidingEditor`); IsRecommendation trait ·
<sup>e</sup> ApplyDoneWorkflowStage (auto MOVE_TO_DONE / RETURN_TO_WORKFLOW); PKPSubmissionController::returnToDone() (manual RETURN_TO_DONE; SubmissionAccessPolicy gates it manager-scope-only — assigned editors get 401 roleBasedAccessDenied; see Known deviations) ·
<sup>f</sup> DecisionType::getSteps()/steps/Email.php (canSkip default true, canChangeRecipients, anonymizeRecipients); DecisionType::validateEmailAction() (attachments: temporaryFile / submissionFile / libraryFile); live-probed ·
<sup>g</sup> PKPSubmissionController::getDecisions() (SubmissionAccessPolicy); editorial-activity-log owns the log surface

## Fields & validation

The Record-Decision wizard is a sequence of **steps** built per decision type; a step is
one of three kinds — an **email composer**, a **file-selection** step, or a **form** (only
the APC-payment form). Fields the editor actually touches:

| Field (UI label) | Required? | Rules | Anchor |
|------------------|-----------|-------|--------|
| **To** (email recipients) | Fixed for author emails; editable on the reviewer step | Author step targets the assigned author(s); reviewer step lets the editor add/remove reviewers and anonymises their names in the body/subject | steps/Email.php (`canChangeRecipients`, `anonymousRecipients`); NotifyAuthors::sendAuthorEmail() |
| **Subject** | Yes | Non-empty; pre-filled from the decision's mailable template | DecisionType::validateEmailAction() (`subject` required) |
| **Message** (body) | Yes | Non-empty; pre-filled; supports insertable template variables and a per-locale switch | validateEmailAction() (`body` required); Email::getVariables() |
| **Find Template** | No | Swap in any manager-enabled template that is an alternate of the decision's default key | Email::getEmailTemplates() (`alternateTo`) |
| **CC / BCC** | No | Revealed by "Add CC/BCC"; each address must be a valid email | validateEmailAction() (`cc`/`bcc` → `email_or_localhost`) |
| **Attach Files** | No | Attach from: submission files of the decision's allowed stages, review-round files, the document library, or a new upload; each attachment must resolve to a file the user may see | validateEmailAction() (attachment must be a valid temporaryFile/submissionFile/libraryFile); getAllowedAttachmentFileStages() |
| **Skip this email** | — | Most notify steps can be skipped (no email sent); the recommendation "notify editors" step **cannot** be skipped | Email::canSkip(); IsRecommendation::getSteps() (`canSkip(false)`) |
| **Select Files** (promote) | No | On accept / send-to-production, tick which files carry to the next stage; a decision records even if none are ticked | Accept::getSteps() (PromoteFiles); DecisionPage.vue `copyFile()` |
| **Request payment / Waive** (APC) | Conditional | Only shown when publication payments are fully configured; part of Accept & Skip Review and Accept | classes/decision/types/{Accept,SkipExternalReview} (RequestPayment) |

The **Request Revisions** button first opens a small modal (`SelectRevisionDecisionForm`)
with one radio — **"Require New Review Round"** — offering *Request Revisions* (revisions
handled in the current round; the default) vs *Resubmit for Review* (revisions start a new
round). The chosen option determines which decision constant the wizard then records. The
recommendation variant uses `SelectRevisionRecommendationForm` with the same two options.
<sup>a</sup>

The decision entity itself (`decision.json`) is mostly system-set: `decision` (a
`Decision::*` constant), `submissionId`, `stageId`, `reviewRoundId`/`round`, `editorId`,
`dateDecided`, and the write-only `actions` array (the composed emails/files). The API
rejects any attempt to set `dateDecided`, `editorId`, `stageId` or `submissionId` from the
request body — they are forced from the authorized context. <sup>b</sup>

<sup>a</sup> SelectRevisionDecisionForm.php / SelectRevisionRecommendationForm.php (radio `decision`: PENDING_REVISIONS vs RESUBMIT); WorkflowSelectRevisionFormModal.vue; useWorkflowDecisions.js (`decisionRequestRevision`) ·
<sup>b</sup> schemas/decision.json (`writeDisabledInApi` on dateDecided/editorId/stageId/submissionId; `actions` writeOnly); PKPSubmissionController::addDecision() (overwrites those props)

## Rules & state

### The variant table (the backbone)

Every OJS decision is one row. **Stage guard** = the submission must be in this stage for
the decision to be offered/recorded (`DecisionType::getStageId()`, enforced by
`DecisionStageValidPolicy` and re-checked in `DecisionHandler::record()`). **Result** =
what `runAdditionalActions()` does: new stage / new status / new review-round status. All
transitions live-verified 2026-07-03 by seeding each chain and re-reading
`submissions.stage_id`, `submissions.status` and `review_rounds.status`. Stages by UI
name: **Submission**(1) · **Review**(external review, 3) · **Copyediting**(editing, 4) ·
**Production**(5) · **Done**(6). Submission status: **Queued**(1) · **Published**(3) ·
**Declined**(4) · **Scheduled**(5). <sup>a</sup>

| Decision (button) | const | Stage guard | New stage | New status | Round status | Notify-author mailable |
|---|---|---|---|---|---|---|
| **Send for Review** | EXTERNAL_REVIEW=3 | Submission | Review | — | *creates* round 1, Pending Reviewers | SendExternalReview |
| **Accept and Skip Review** | SKIP_EXTERNAL_REVIEW=17 | Submission | Copyediting | — | — | SkipExternalReview |
| **Accept Submission** | ACCEPT=2 | Review | Copyediting | — | Accepted | Accept |
| **Decline Submission** (desk reject) | INITIAL_DECLINE=8 | Submission | — | Declined | — | InitialDecline |
| **Decline Submission** (in review) | DECLINE=6 | Review | — | Declined | Declined | Decline |
| **Revert Decline** | REVERT_INITIAL_DECLINE=16 | Submission (declined) | — | Queued | — | RevertInitialDecline |
| **Revert Decline** | REVERT_DECLINE=15 | Review (declined) | — | Queued | *recalculated* → Pending Reviewers | RevertDecline |
| **Request Revisions** | PENDING_REVISIONS=4 | Review | — | — | Revisions Requested | RequestRevisions |
| **Resubmit for Review** | RESUBMIT=5 | Review | — | — | Resubmit For Review | Resubmit |
| **Create New Review Round** | NEW_EXTERNAL_ROUND=14 | Review | — | — | *creates* next round, Pending Reviewers | NewReviewRound |
| **Cancel Review Round** | CANCEL_REVIEW_ROUND=31 | Review | back to Submission (if last round) | — | *round + its decisions deleted* | CancelReviewRound |
| **Send To Production** | SEND_TO_PRODUCTION=7 | Copyediting | Production | — | — | SendToProduction |
| **Move to Review** (back from copyediting) | BACK_FROM_COPYEDITING=30 | Copyediting | Submission (or Review if a round exists) | — | — | BackFromCopyediting |
| **Move To Copyediting** (back from production) | BACK_FROM_PRODUCTION=29 | Production | Copyediting | — | — | BackFromProduction |
| **Recommend Accept / Decline / Revisions / Resubmit** | 9 / 12 / 10 / 11 | Review (recommend-only) | — | — | — (records a recommendation; notifies deciding editors) | *RecommendationNotifyEditors* → editors |
| **Move to Done** (auto, on first publish) | MOVE_TO_DONE=33 | Production | Done | Published | — | none |
| **Return to Workflow** (auto, on unpublish) | RETURN_TO_WORKFLOW=34 | Done | Production | Queued | — | none |
| **Return to Done** (manual) | RETURN_TO_DONE=35 | any active stage w/ Done history | Done | Published | — | none |

1. **A decision is recorded, never edited.** The decision page POSTs to
   `POST api/v1/submissions/{id}/decisions`; `Repository::add()` inserts the row, strips
   the `actions` array off, then runs the transition, the email/file actions, the event
   log, the raised event and the notifications — in that order. There is no update or
   user-facing delete; `Repository::validate()` and the schema exist only for `add`.
   <sup>b</sup>
2. **Three gates guard every recorded decision** (`DecisionWritePolicy`): the decision
   constant must map to a registered OJS decision type (`DecisionTypeRequiredPolicy`); the
   submission must be in that type's stage (`DecisionStageValidPolicy`); and the user must
   be allowed to make it (`DecisionAllowedPolicy` — see rule 3). `Repository::validate()`
   re-checks the stage match, that a review decision carries a valid review round for this
   submission, and lets the type add its own checks. A submission being incomplete blocks
   the decision entirely (`SubmissionCompletePolicy` on the API op). <sup>c</sup>
3. **The role gate** (`DecisionAllowedPolicy`), reached only *after* the access gate below has
   admitted the user. If the user holds a stage assignment on the submission's *current* stage:
   the assignment must be an editor/manager role (assistant-role assignments are skipped); a
   **non-recommend-only** assignment permits any decision for the stage; a **recommend-only**
   assignment permits only recommendation decisions — *plus* the one decision a recommending
   user may finalize on that stage (submission-stage **Send for Review**, from
   `getDecisionTypesMadeByRecommendingUsers()`); a recommend-only editor finalizing any other
   decision is denied `disallowedDecision` (verified: an assigned recommend-only SE POSTing
   *Accept* → 401 `disallowedDecision`, submission unchanged). If the user holds **no** stage
   assignment, a journal manager or site admin is permitted as an unassigned editor (manager
   scope), and the policy's own `noUnassignedDecisions` deny nominally covers everyone else —
   **but that message is effectively unreachable in practice**: a non-manager without a stage
   assignment is already refused by the access gate below, and an assigned editor's stage-scoped
   assignment query is non-empty, so the deny branch never fires. The decision *page* is
   additionally closed to any role outside Manager / Site Admin / Section Editor. <sup>d</sup>

   **Denial surface** (verified live 2026-07-03 on `addDecision`): the decision write passes
   through *two* stacked gates and the **access gate fires first**. `SubmissionAccessPolicy`
   (added for the op) admits only managers / site admins and the editors/assistants **assigned to
   the submission** whose role has the decision op whitelisted; everyone else — an **unassigned
   section editor**, or an **assigned assistant** (copyeditor / layout editor / proofreader),
   whose role carries no decision op — is denied **401 `roleBasedAccessDenied`** ("The current
   role does not have access to this operation") *before* `DecisionWritePolicy` runs. So the
   user-facing refusal for an unassigned section editor is the generic access denial, **not** a
   "you are not assigned to take editorial decisions" message. Assigned deciding editors and
   unassigned managers pass through to the decision policies (verified: assigned SE *Accept*
   → 200; unassigned manager *Accept* → 200, manager scope).
4. **Transition mechanics** (`DecisionType::runAdditionalActions()`, the shared base). If
   the type declares a new status, the submission status is updated and its current
   publication re-resolved. If it declares a new stage, the submission moves there; moving
   *into* a review stage creates review round 1 (Pending Reviewers) if none exists, else
   resets the existing round's status; every stage change also auto-creates that stage's
   template tasks (`Repo::editorialTask()->autoCreateFromTemplates`, owned by
   `tasks-discussions`). If the decision was taken in a review round, the round's status is
   set to the type's declared value, or **recalculated from scratch** when the type returns
   null. <sup>e</sup>
5. **Send for Review vs Accept & Skip Review** (submission stage). Send for Review moves to
   the Review stage and opens round 1 (verified: stage 1→3, round 1 created). Accept & Skip
   Review bypasses review and moves straight to Copyediting (verified: stage 1→4, no
   round). Both notify the author and, when publication payments are configured, add an APC
   **request-payment** step (OJS-only override on `Accept`/`SkipExternalReview`) that queues
   a payment and raises a payment-required notification (owned by `payments`). <sup>f</sup>
6. **Accept from review** moves the submission to Copyediting and stamps the review round
   *Accepted* (verified: stage 3→4, round status Accepted). Its wizard has up to three
   steps — Notify Authors, Notify Reviewers (recipients editable, names anonymised), and a
   **Select Files** step promoting chosen review-revision files into the copyediting stage
   (drove this end-to-end: the accept email reached the author in Mailpit and the
   submission landed in Copyediting). <sup>g</sup>
7. **Decline has two faces, and both are revertible.** From the submission stage the button
   records *Initial Decline*; from a review round it records *Decline*; both set status
   **Declined** and leave the stage where it is (verified: stage unchanged, status 4; a
   review decline also stamps the round *Declined*). While declined, a **Revert Decline**
   button appears that records *Revert Initial Decline* or *Revert Decline* and returns the
   status to **Queued** (verified both: status 4→1); the review revert also **recalculates**
   the round status (Declined → Pending Reviewers). The submission never leaves its stage
   across decline/revert. <sup>h</sup>
8. **Request Revisions vs Resubmit for Review** (review stage). Both keep the submission in
   Review with no stage change; the difference is the round: Request Revisions marks the
   current round **Revisions Requested** and the author revises *in the same round*
   (verified: round status → 1); Resubmit marks it **Resubmit For Review** (verified: round
   status → 2) and the author's revisions are expected to trigger a fresh round. The choice
   is made in the Request-Revisions modal (Fields). Round mechanics (author upload, round
   history) are owned by `review-rounds-and-revisions`; this spec owns only the decision +
   its round-status effect. <sup>i</sup>
9. **New round and cancel round.** Create New Review Round opens the next round (Pending
   Reviewers) with the submission still in Review (verified: two rounds, both Pending
   Reviewers). Cancel Review Round is *retractable*: it deletes the current round **and every
   decision carrying that round's id** (the submission-stage decision that *created* the round
   has a null review-round id and survives), and if it was the only round returns the submission
   to the Submission stage (verified: after cancel, no rounds, stage 3→1, the cancel decision
   itself gone, and only the pre-round submission-stage decision left). Because the row can
   vanish, the API returns the pre-insert decision object rather than re-reading it. <sup>j</sup>
10. **Copyediting ↔ Production.** Send To Production moves Copyediting→Production; Move To
    Copyediting (back from production) moves Production→Copyediting; Move to Review (back
    from copyediting) moves Copyediting back to the Submission stage, or to Review if a
    review round already exists — in which case the pre-existing round is stamped
    **Returned To Review** (verified: skip→production→back = stage 5→4; skip→back = stage
    4→1; sendReview→accept→back = stage 4→3 with round status Returned To Review). None
    change status. <sup>k</sup>
11. **The recommendation flow** (recommend-only editors). A recommendation records a
    decision row but changes **nothing** about the submission — no stage, status or round
    change (all `getNew*` return null). Instead it opens a **discussion** among the deciding
    editors seeded with the recommendation's subject/body and any attachments, and emails
    those editors (`RecommendationNotifyEditors`); the "notify editors" step cannot be
    skipped. The deciding editor sees the recorded recommendation in the review pane and
    still records the *real* decision. A recommendation is refused unless the submission has
    at least one non-recommend-only deciding editor to act on it. Live-probed: minoue
    (recommend-only) saw only *Recommend Revisions / Accept / Decline*, never the finalizing
    buttons. The recommend-only **role** setup and configurable recommendation options are
    owned by `recommend-only-editors`. <sup>l</sup>
12. **The Done stage is mostly automatic.** OJS has a 6th stage, **Done**, reached when a
    submission's first Version of Record is published: the `ApplyDoneWorkflowStage` listener
    hears the publish event and auto-records a **Move to Done** (stage→Done, status
    Published) — verified: publishing a VoR left the submission at stage 6 / Published with a
    MOVE_TO_DONE row it never asked for. Unpublishing the last VoR auto-records **Return to
    Workflow** (Done→Production, status Queued). A manual **Return to Done**
    (`returnToDone` API) moves an active submission that has Done history back to Done; it is
    refused if already in Done or if the submission was never in Done. These three decisions
    have no author email and no editor-decision notification. <sup>m</sup>
13. **The notify-author email** (`NotifyAuthors` trait). Recipients are the submission's
    *assigned* authors (author-role stage assignments), not every co-author. If the journal
    has **Notify all authors** on, every other contributor also gets a
    `DecisionNotifyOtherAuthors` email wrapping the same message. Review-attachment files
    the editor attaches to the author email are flipped *viewable* so the author can see
    them. Skipping the step sends nothing. <sup>n</sup>
14. **Notify reviewers** (`NotifyReviewers` trait, on Accept / Decline / Request Revisions /
    Resubmit / Cancel Round). Sends `DecisionNotifyReviewer` per selected reviewer and, as a
    side effect, marks each reviewer's assignment *acknowledged/considered* and stamps the
    consideration date — so notifying a reviewer from a decision doubles as "thank/close"
    them. Writes one **decision-email-sent** event-log entry. <sup>o</sup>

<sup>a</sup> constants: PKPApplication WORKFLOW_STAGE_ID_* (SUBMISSION=1, EXTERNAL_REVIEW=3, EDITING=4, PRODUCTION=5, DONE=6); PKPSubmission STATUS_* (QUEUED=1, PUBLISHED=3, DECLINED=4, SCHEDULED=5); ReviewRound REVIEW_ROUND_STATUS_* ; live probes 2026-07-03 (14 seeded chains) ·
<sup>b</sup> PKPSubmissionController::addDecision(); Repository::add() (order: insert → Hook → eventLog → runAdditionalActions → DecisionAdded event → updateNotifications) ·
<sup>c</sup> DecisionWritePolicy; DecisionStageValidPolicy; DecisionTypeRequiredPolicy; Repository::validate(); SubmissionCompletePolicy ·
<sup>d</sup> SubmissionAccessPolicy (per-role RoleBasedHandlerOperationPolicy — the access gate that fires first: 401 `roleBasedAccessDenied`); DecisionAllowedPolicy::effect() (`disallowedDecision`; its `noUnassignedDecisions` deny is unreachable behind the access gate); Repository::getDecisionTypesMadeByRecommendingUsers() (OJS: SendExternalReview at submission stage only); DecisionHandler::__construct() role list; live probes 2026-07-03 (assigned SE Accept → 200; unassigned SE / assigned copyeditor → 401 roleBasedAccessDenied; recommend-only finalize → 401 disallowedDecision) ·
<sup>e</sup> DecisionType::runAdditionalActions(); Repo::editorialTask()->autoCreateFromTemplates(); ReviewRoundDAO::updateStatus() (null → recalculated) ·
<sup>f</sup> SendExternalReview / SkipExternalReview (getNewStageId); classes/decision/types/{Accept,SkipExternalReview}::getSteps() (RequestPayment, `publicationEnabled()`); live probes C1/C2 ·
<sup>g</sup> Accept::getSteps() (Email author, Email reviewers, PromoteFiles SUBMISSION_FILE_FINAL from SUBMISSION_FILE_REVIEW_REVISION); live UI drive on submission 17 (Mailpit "Your submission has been accepted", stage→4) ·
<sup>h</sup> InitialDecline/Decline (getNewStatus STATUS_DECLINED); RevertInitialDecline/RevertDecline (getNewStatus STATUS_QUEUED); live probes C4/C5/C6 ·
<sup>i</sup> RequestRevisions (REVIEW_ROUND_STATUS_REVISIONS_REQUESTED=1) / Resubmit (RESUBMIT_FOR_REVIEW=2); SelectRevisionDecisionForm; live probes C7/C8 ·
<sup>j</sup> NewExternalReviewRound (creates round, PENDING_REVIEWERS); CancelReviewRound implements DecisionRetractable (getNewStageId → Submission when last round); addDecision() comment (returns pre-insert object); live probes C9/C10 ·
<sup>k</sup> SendToProduction / BackFromProduction / BackFromCopyediting (getNewStageId); live probes C11/C12/C13 ·
<sup>l</sup> IsRecommendation trait (getSteps `canSkip(false)`, addRecommendationQuery, RecommendationNotifyEditors); DecisionHandler::record()/Repository::validate() (deciding-editor requirement); RecommendAccept/Decline/Resubmit/Revisions (getNew* all null); live-verified 2026-07-03: recommend-only SE POSTing *Recommend Accept* → 200, submission unchanged (stage/status/round), an editor discussion (`edit_tasks` row) created with the deciding editor as participant, and the `RecommendationNotifyEditors` email delivered to that editor; the recommendation is refused (400 `requiredDecidingEditor`) when no non-recommend-only deciding editor is assigned; minoue (recommend-only) saw only Recommend* buttons ·
<sup>m</sup> ApplyDoneWorkflowStage::handle() (PublicationPublished/Unpublished → MOVE_TO_DONE / RETURN_TO_WORKFLOW); PKPSubmissionController::returnToDone() (`alreadyInDone` / `noMoveToDoneHistory`); Repository::hasDoneHistory(); full cycle live-verified 2026-07-03: publish → stage 6/Published/decision 33 (MOVE_TO_DONE); unpublish (by manager) → stage 5/Queued/decision 34 (RETURN_TO_WORKFLOW); manual returnToDone (by unassigned manager) → stage 6/Published/decision 35 (RETURN_TO_DONE); no-Done-history returnToDone → 403 `noMoveToDoneHistory` ·
<sup>n</sup> NotifyAuthors::sendAuthorEmail() (assigned authors); context `notifyAllAuthors` → DecisionNotifyOtherAuthors; shareReviewAttachmentFiles() ·
<sup>o</sup> NotifyReviewers::sendReviewersEmail() (dateAcknowledged/considered/dateConsidered; SUBMISSION_LOG_DECISION_EMAIL_SENT)

## Side effects

- **Author / reviewer emails.** Each decision that notifies the author uses its own
  mailable (variant table, "Notify-author mailable" column — the 16 `Decision*NotifyAuthor`
  / `Decision*` classes, template keys `EDITOR_DECISION_*`). Reviewer notifications use
  `DecisionNotifyReviewer` (`EDITOR_DECISION_NOTIFY_REVIEWERS`); co-author fan-out uses
  `DecisionNotifyOtherAuthors` (`EDITOR_DECISION_NOTIFY_OTHER_AUTHORS`); recommendations
  email deciding editors via `RecommendationNotifyEditors` (`EDITOR_RECOMMENDATION`). All
  are drafted in the wizard, editable, and (author/reviewer) skippable; delivery + the
  per-submission email log are owned by `email-delivery`.
- **Event-log entries.** Every decision writes one submission event — `Editor decision`
  (`SUBMISSION_LOG_EDITOR_DECISION`) or, for recommendations, `Editor recommendation`
  (`SUBMISSION_LOG_EDITOR_RECOMMENDATION`) — recording the acting editor and the decision's
  log label. Notifying reviewers additionally writes a `Decision notification email sent`
  entry (`SUBMISSION_LOG_DECISION_EMAIL_SENT`). The notify-author send is logged separately
  by the email-log subsystem (`EDITOR_NOTIFY_AUTHOR`, owned by `email-delivery`). The log
  surface is owned by `editorial-activity-log`.
- **Dashboard notifications.** Eight decisions raise an author-facing editor-decision
  notification (`getNotificationTypeByEditorDecision`): Accept, Send-to-External-Review,
  Request-Revisions, Resubmit, New-Round, Decline (both variants share one type),
  Revert-Decline, Send-to-Production. Request-Revisions and Resubmit are **task-level**
  (they sit in the author's task list); the rest are normal bell notifications. On each
  decision the manager first **clears** the submission's stale editor-decision
  notifications for the author, then recreates the current one (so only the latest shows).
  `EDITOR_DECISION_INTERNAL_REVIEW` is defined but **never fired in OJS** (no internal-review
  stage). Accept and Send-to-Production also refresh copyeditor/production assignment
  notifications. The inbox framework is owned by `notifications`.
- **Cross-entity mutations.** Stage/status/round changes (variant table); review round
  creation on promotion to Review; deletion of a round + its decisions on Cancel Round;
  auto-creation of the destination stage's template tasks on any stage move
  (`tasks-discussions`); a discussion (query) created among editors for a recommendation
  (`tasks-discussions`); a queued APC payment + payment-required notification on
  Accept/Skip when payments are on (`payments`); review-attachment files flipped viewable
  when attached to the author email. Publishing/unpublishing (owned by
  `publication-publish-flow`) triggers the Done-stage decisions here via the
  `ApplyDoneWorkflowStage` listener.

## Settings that modify behavior

- **Notify all authors** (journal setting `notifyAllAuthors`) — when on, every decision
  that emails the assigned author also emails the other contributors via
  `DecisionNotifyOtherAuthors`.
- **Publication payments configured** (payments enabled + a payment method + a non-zero
  publication fee) — adds the APC request-payment step to Accept and Accept & Skip Review
  (`OJSPaymentManager::publicationEnabled()`; the fee UI is owned by `payments-fees`).
- **Email templates** (Settings → Workflow → Emails) — enabling/adding an alternate
  template for a decision's key populates the wizard's Find-Template picker; disabling the
  decision's mailable removes the composed email step (owned by
  `email-templates-management`).
- **Require reviews before an accept/new-round decision** — a journal may warn the editor
  with a confirm dialog before Accept / Create New Review Round if the minimum number of
  reviews has not been received (frontend `showWarningDialogAboutMinimumReviewsIfEnabled`;
  a warning, not a hard block — not triggered on the default journal).
- No setting changes the transition table itself: the stage/status/round machine is fixed
  in the decision-type classes.

## Cross-feature interactions

- **workflow-stage-navigation** — owns the workflow shell and *renders* the decision action
  bar (which buttons appear per stage/role) and the Return-to-Workflow/Return-to-Done header
  buttons; this spec owns the bar's content, the wizard, and every transition.
- **send-to-review** — the stage-1 workspace; its accept-and-skip / send-to-review /
  desk-decline actions are the decisions defined here.
- **review-rounds-and-revisions** — owns round history, author revision upload and the
  request-revisions→resubmit cycle *mechanics*; the request-revisions / resubmit / new-round
  / cancel-round **decisions** are defined here.
- **copyediting-stage / production-stage** — own those stage workspaces; the
  send-to-production / back-from-copyediting / back-from-production **decisions** are here.
- **recommend-only-editors** — owns the recommend-only role config and the configurable
  recommendation options; the recommendation **decision act**, its editor email and its
  event log are here.
- **publication-publish-flow / publication-versioning** — own publish/unpublish; those
  transitions fire the Move-to-Done / Return-to-Workflow decisions defined here.
- **payments / payments-fees** — own the APC payment the Accept/Skip step queues.
- **tasks-discussions** — owns the template-task auto-creation on stage change and the
  recommendation discussion.
- **editorial-activity-log** — owns the log surface where decision events render.
- **email-delivery / email-templates-management / notifications** — own email delivery, the
  templates the wizard offers, and the notification inbox, respectively.

## Canonical scenarios

1. **Send a submission for review** — an editor on a submission-stage manuscript clicks
   *Send for Review*, composes the author email, and records: the submission moves to the
   Review stage and review round 1 opens (Pending Reviewers).
2. **Accept and skip review** — from the submission stage the editor picks *Accept and Skip
   Review*; the submission jumps straight to Copyediting with no review round, and (if APC
   payments are configured) an optional payment step is offered.
3. **Accept from review and carry files forward** — with a completed reviewer, the editor
   clicks *Accept Submission*, steps through Notify Authors → Notify Reviewers → Select
   Files, and records: the submission moves to Copyediting, the round is marked Accepted,
   the chosen review-revision files promote to copyediting, and the author receives the
   acceptance email (verified live end-to-end).
4. **Desk-reject and later revert** — an editor declines at the submission stage (status
   Declined, stage unchanged); the *Revert Decline* button then returns the submission to
   Queued in the same stage.
5. **Decline in review and revert** — declining during a review round sets Declined and
   stamps the round Declined; reverting returns the submission to Queued and recalculates
   the round back to Pending Reviewers.
6. **Request revisions without a new round** — the editor clicks *Request Revisions*, keeps
   the default "no new round" option, and records: the submission stays in Review and the
   round is marked Revisions Requested for the author to revise in place.
7. **Resubmit for review (new round on revisions)** — same button, but the editor picks
   *Resubmit for Review*; the round is marked Resubmit For Review, seeding the next round
   once the author uploads.
8. **Open a second review round** — *Create New Review Round* adds round 2 (Pending
   Reviewers) with the submission still in Review; the round menu grows a "Review Round 2".
9. **Cancel a review round** — *Cancel Review Round* retracts the current round, deletes it
   and its in-round decisions, and (if it was the only round) drops the submission back to
   the Submission stage.
10. **Hand off through copyediting and production** — *Send To Production* moves
    Copyediting→Production; *Move To Copyediting* moves it back; *Move to Review* from
    copyediting returns the submission toward review — none changing status.
11. **A recommend-only editor recommends** — a recommend-only section editor sees only
    *Recommend Accept / Decline / Revisions* (verified live), records a recommendation that
    changes no state but opens an editor discussion and emails the deciding editors; the
    deciding editor then records the real decision.
12. **Publish flips the submission to Done, unpublish returns it** — publishing the first
    Version of Record auto-records Move to Done (stage Done, status Published, verified
    live); unpublishing the last VoR auto-records Return to Workflow back to Production; an
    unassigned manager can manually Return to Done a submission that has Done history (all
    three verified live end-to-end).
13. **Compose the author email — CC/BCC, attach, or skip** — on any notifying decision the
    editor can edit subject/body, reveal CC/BCC, attach a submission/library/uploaded file,
    swap the template, or click *Skip this email* to record the decision with no email sent.
14. **Permission boundaries** (verified live) — an assistant (copyeditor) and an unassigned
    section editor are both refused with the generic access denial (401 `roleBasedAccessDenied`
    from `SubmissionAccessPolicy`, *before* the decision policies); an unassigned manager may
    decide anyway (manager scope); a recommend-only editor is confined to recommendations
    (finalizing any other decision → 401 `disallowedDecision`, no state change).

## Known deviations (as-built ≠ intent)

- **Manual Return to Done is manager-scope-only; assigned editors are refused (401), not a 500.**
  The `returnToDone` API adds `DecisionAllowedPolicy` **without** `DecisionTypeRequiredPolicy`,
  so that policy's authorized decision-type object is null. Read in isolation this looks fatal:
  a user holding a stage assignment on the submission's *current* stage reaches the policy's
  else-branch and calls `isRecommendation($decisionType->getDecision())` on null (confirmed in
  isolation — it *does* throw). **But the fatal is not reachable through the route** (live-probed
  2026-07-03, all three actor classes): `returnToDone` first runs `SubmissionAccessPolicy`, whose
  per-role `RoleBasedHandlerOperationPolicy` denies *every* stage-assigned editor this operation
  with **401 `roleBasedAccessDenied`** ("The current role does not have access to this operation")
  *before* `DecisionAllowedPolicy` runs — confirmed for an assigned section editor **and** for a
  journal manager who *also* holds a section-editor stage assignment. The only actors who pass the
  access gate are unassigned-scope managers/admins, and the manager user group carries **no
  `user_group_stage` rows**, so `DecisionAllowedPolicy`'s stage-scoped assignment query comes back
  empty → they take the manager-fallback PERMIT branch and never touch the null. Live outcomes: an
  unassigned manager returns the submission to Done (verified end-to-end:
  publish → unpublish → `returnToDone` = stage 6 / Published / a RETURN_TO_DONE decision), or gets
  a clean 403 `noMoveToDoneHistory` when there is no Done history; an assigned section editor is
  refused 401. The missing `DecisionTypeRequiredPolicy` is a **latent defensive-code gap shielded
  by the access gate**, not a user-facing bug — no ledger row (the live behaviour is a correct
  denial, and `SubmissionAccessPolicy` cannot be bypassed to reach the null). Worth hardening
  defensively (add `DecisionTypeRequiredPolicy` or a null guard) — see Open question 1.
- ⚠ **Cancel Review Round silently deletes decision history.** Cancelling a round removes the
  round *and every decision recorded in it* (verified: after cancelling round 1, the cancel
  decision and the round were gone, leaving only the pre-round submission-stage decision).
  This is by design for retraction, but it means the activity log loses the record that a
  round ever happened — worth a product-owner confirmation rather than a code fix. Recorded
  as an open question, not a hard deviation.
- The **recommendation → no state change** rule and the **assistants-cannot-decide** rule
  are strict-by-design, not deviations.

## Open questions

1. **Return to Done audience** — manual Return to Done is manager-scope-only in practice
   (an assigned section editor is refused 401 `roleBasedAccessDenied` by `SubmissionAccessPolicy`
   before any decision policy; verified 2026-07-03 — the once-suspected 500 does *not* occur).
   Is manager-only the intended audience, and should the workflow header even offer a
   Return-to-Done affordance to an assigned section editor on a Done-history submission
   (affordance owned by `workflow-stage-navigation`)? Separately, the latent null-decision-type
   gap in `returnToDone`'s authorization — harmless today only because the access gate denies
   every actor who could reach it — is worth a defensive fix.
2. **Cancel-round history loss** — should cancelling a review round erase the decision
   history of that round, or should a tombstone remain in the activity log?
3. **Revert-initial-decline has no notification** — Revert Decline (in review) raises a
   revert-decline notification, but Revert Initial Decline (submission stage) maps to no
   notification type (`getNotificationTypeByEditorDecision` returns null for it). Intended
   asymmetry, or should the desk-reject revert also notify the author?
4. **Internal-review notification constant** — `EDITOR_DECISION_INTERNAL_REVIEW` and the
   `*_INTERNAL` decision constants ship in shared lib/pkp but are unreachable in OJS (no
   internal-review stage). Claimed here so the atoms have an owner; confirm they should be
   documented as OJS-inert rather than dropped.

---

## Reference — entry points & surfaces

| Entry | Path | Atom |
|-------|------|------|
| Record-Decision wizard (page) | `/{journal}/decision/record/{submissionId}?decision={const}[&reviewRoundId=]` — full-page `DecisionPage`, reached from a stage-pane action button | PAGE-decision-record |
| Record a decision (API) | `POST api/v1/submissions/{id}/decisions` (body: `decision` + `actions[]`) | API-submission-add-decision |
| List decision history (API) | `GET api/v1/submissions/{id}/decisions` (filters: decisionTypes, editorIds, reviewRoundId, stageId) | API-submission-get-decisions |
| Manual Return to Done (API) | `POST api/v1/submissions/{id}/returnToDone` | API-submission-return-to-done |
| Decision entity schema | `lib/pkp/schemas/decision.json` | SCHEMA-decision |
| Decision storage | `edit_decisions` table | DB-edit_decisions |
| Write authorization | `DecisionWritePolicy` → `DecisionTypeRequiredPolicy` + `DecisionStageValidPolicy` + `DecisionAllowedPolicy` | AUTHZ-decision-write-policy, AUTHZ-decision-type-required-policy, AUTHZ-decision-stage-valid-policy, AUTHZ-decision-allowed-policy |
| Request-Revisions modal forms | `SelectRevisionDecisionForm`, `SelectRevisionRecommendationForm` | FORM-select-revision-decision-form, FORM-select-revision-recommendation-form |
| Notify-author / reviewer / other-authors / recommendation mailables | `lib/pkp/classes/mail/mailables/Decision*` (16) + `RecommendationNotifyEditors` | MAIL-decision-*, MAIL-recommendation-notify-editors |
| Decision event-log types | `SUBMISSION_LOG_EDITOR_DECISION` / `_EDITOR_RECOMMENDATION` / `_DECISION_EMAIL_SENT` | EVLOG-SUBM-ED-DEC, EVLOG-SUBM-ED-REC, EVLOG-SUBM-ED-EMAIL |
| Author editor-decision notifications | `NOTIFICATION_TYPE_EDITOR_DECISION_*` (9) | NOTIF-editor-decision-* |

## Reference — code anchors

- **Engine**: `lib/pkp/classes/decision/Repository.php` (`add`, `validate`, `updateNotifications`,
  `isRecommendation`, `hasDoneHistory`, `getActivePendingRevisionsDecision`);
  `lib/pkp/classes/decision/DecisionType.php` (base `runAdditionalActions`, `getSteps`,
  `validateEmailAction`, `addEmailDataToMailable`, `createReviewRound`);
  `lib/pkp/classes/decision/Decision.php` (the ~35 `Decision::*` constants; OMP-only ones
  marked in-file); `classes/decision/Repository.php` (OJS type set + OJS
  `getDecisionTypesMadeByRecommendingUsers`); `classes/decision/Decision.php` (OJS subclass).
- **Types**: `lib/pkp/classes/decision/types/*` (21 OJS-reachable classes) + traits
  `NotifyAuthors`, `NotifyReviewers`, `IsRecommendation`, `InSubmissionStage`,
  `InExternalReviewRound`, `WithReviewAssignments`; OJS overrides
  `classes/decision/types/{Accept,SkipExternalReview}.php` + `traits/RequestPayment.php`.
- **Steps**: `lib/pkp/classes/decision/{Steps,Step}.php` + `steps/{Email,Form,PromoteFiles}.php`.
- **Page / API / policies**: `lib/pkp/pages/decision/DecisionHandler.php`;
  `lib/pkp/api/v1/submissions/PKPSubmissionController.php`
  (`addDecision`, `getDecisions`, `returnToDone`, `authorize`);
  `lib/pkp/classes/security/authorization/DecisionWritePolicy.php` +
  `internal/{DecisionTypeRequiredPolicy,DecisionStageValidPolicy,DecisionAllowedPolicy}.php`.
- **Done stage**: `lib/pkp/classes/observers/listeners/ApplyDoneWorkflowStage.php`;
  `WORKFLOW_STAGE_ID_DONE` in `lib/pkp/classes/core/PKPApplication.php`;
  `lib/pkp/classes/migration/upgrade/v3_6_0/I12799_MovePublishedSubmissionsToDone.php`.
- **Notifications**: `lib/pkp/classes/notification/PKPNotificationManager.php`
  (`getNotificationTypeByEditorDecision`);
  `lib/pkp/classes/notification/managerDelegate/EditorDecisionNotificationManager.php`.
- **Frontend**: `lib/ui-library/src/components/Container/DecisionPage.vue` +
  `lib/pkp/templates/decision/record.tpl`; action bar in
  `lib/ui-library/src/pages/workflow/composables/useWorkflowConfig/workflowConfigEditorialOJS.js`
  + `composables/useWorkflowDecisions.js`; recommend-only controls
  `pages/workflow/components/action/WorkflowRecommendOnlyControls.vue`; request-revisions
  modal `pages/workflow/modals/WorkflowSelectRevisionFormModal.vue`.
