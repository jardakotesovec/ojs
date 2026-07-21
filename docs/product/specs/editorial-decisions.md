---
name: editorial-decisions
scope: Editors record editorial decisions (and recommendations) that notify participants and move a submission through workflow stages — the single home for decision mechanics
shared: pkp-lib
status: draft
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
  - LOC-editor-editor-decision
  - LOC-emails-emails-decision
---

# Editorial decisions

## Purpose

Every submission moves through the workflow because an editor records a **decision**:
send it to review, accept it, decline it, request revisions, hand it to production,
or walk it back a stage. This feature is the decision engine itself — the buttons an
editor sees on each stage of the workflow page, the step-by-step "record decision"
wizard (notification emails with attachments, file promotion, an optional payment
request), the recommendation variant used by recommend-only editors, and the
automatic bookkeeping that fires with each decision: stage and status changes, review
round changes, activity-log entries, in-app notifications and emails to authors and
reviewers. It also owns the Done stage transition machine — the automatic decisions
recorded when a submission's first Version of Record is published or unpublished, and
the manual Return to Workflow / Return to Done actions. The stage features
(send-to-review, review-rounds-and-revisions, copyediting-stage, production-stage,
publication-publish-flow) reference this spec instead of re-documenting decision
rules.

## Actors & permissions

Terms used below: an **assigned deciding editor** is a Journal Manager or Section
Editor whose stage assignment on the submission covers the submission's current stage
and is *not* marked recommend-only; a **recommend-only editor** is the same but with
the recommend-only mark — applied when the participant is assigned, via the "Assign
Participant" dialog's Assignment privileges checkbox reading "This participant is
only allowed to recommend an editorial decision…"; an **unassigned manager** is a Journal Manager (or Site
Administrator) with no assignment on the submission at its current stage. Site-wide
baselines: a Site Administrator has manager authority on journals they are enrolled
in (journal creation auto-enrols the creating admin); anonymous users have no access.
The decision-recording page itself admits only Journal Managers, Section Editors and
Site Administrators. <sup>a</sup>

| Action | Who may — and when |
|--------|--------------------|
| **See decision buttons on a stage** | • Assigned deciding editors and unassigned managers — on the submission's current stage only<br>• Recommend-only editors — three recommendation buttons (Recommend Accept, Recommend Revisions, Recommend Decline) in review; on the first stage a plain Send for Review button and no other decision<br>• Assistants, Authors, Reviewers, Readers — never <sup>b</sup> |
| **Record a full decision** | • Assigned deciding editors — for the current stage<br>• Unassigned managers — any submission in their journal<br>• Recommend-only editors — no, except Send for Review on the first stage<br>• ⚠ A manager assigned only in a lesser role (e.g. as copyeditor) hits contradictory screen-vs-server outcomes that differ by stage — see Known deviations (ledger row 219) <sup>c</sup> |
| **Record a recommendation** | • Recommend-only editors — in a review stage, only while at least one assigned deciding editor exists on that stage; ⚠ the buttons' own check accepts a deciding editor assigned on *any* stage, so one assigned only elsewhere makes the buttons appear and then dead-end (new finding, see Known deviations)<br>• An assigned deciding editor or unassigned manager is never offered the recommendation controls — ⚠ except an editor holding both a deciding and a recommend-only assignment, who is shown only the recommendation controls (new finding, see Known deviations) <sup>d</sup> |
| **Record a Done-stage decision** (Return to Workflow) | • Any Journal Manager or Section Editor assigned to the submission on *any* stage — ⚠ including recommend-only assignees (ledger row 217)<br>• Unassigned managers <sup>e</sup> |
| **Use Return to Done** (from an active stage back to Done) | • Offered to any user the active stage shows decision buttons to, when the submission has Done history<br>• ⚠ Succeeds only for unassigned managers/admins; every *assigned* editor gets an error (ledger row 216) <sup>f</sup> |
| **See recorded decisions** | • Journal Managers, Section Editors — through the submission's activity log and editorial history (surface owned by editorial-activity-log)<br>• Authors — only via the notifications/emails a decision sends them <sup>g</sup> |

<sup>a</sup> DecisionHandler::__construct() (role assignment MANAGER, SITE_ADMIN, SUB_EDITOR); PKPContextService::add(); AddParticipantForm + addParticipantForm.tpl recommendOnly checkbox (label stageParticipants.recommendOnly); dual-assignment shape created through that dialog live-probed 2026-07-21 (verify-a edges); live-verified 2026-07-21 ·
<sup>b</sup> APP\submission\maps\Schema::getAvailableEditorialDecisions() (per-stage payload; active stage only); Schema::checkDecisionPermissions(); workflowConfigEditorialOJS.js getActionItems(); live-probed 2026-07-21 (per-stage rails, declined collapse, old-round rail absent, Assistant/Author zero decision buttons, recommend-only surfaces) ·
<sup>c</sup> DecisionAllowedPolicy::effect() (assignment covering current stage, non-editor groups skipped; unassigned manager/admin fallback); DecisionWritePolicy::__construct(); live-probed 2026-07-21 (unassigned manager recorded Accept end-to-end; recommend-only stage-1 Send for Review completed) ·
<sup>d</sup> DecisionAllowedPolicy::effect() (recommendOnly branch + getDecisionTypesMadeByRecommendingUsers carve-out); decision\Repository::validate() (deciding-editor requirement); DecisionHandler::record() (404 without deciding editor); live-probed 2026-07-21 (without a deciding editor the buttons are absent and the rail area reads "You can not make a recommendation until an editor is assigned with permission to record a decision."); edge probes live-verified 2026-07-21 (WorkflowRecommendOnlyControls.vue gate reads submission-wide editorAssigned — cross-stage deciding editor: buttons render, click → bare 404, API → 400; dual deciding+recommend-only assignment: only recommendation controls render while directly posted full decisions record) ·
<sup>e</sup> DecisionAllowedPolicy::effect() Done branch (any-stage editor assignment, no recommendOnly filter); live-probed 2026-07-21 (Return to Workflow button renders for a recommend-only assignee on a Done submission); recommend-only recording live-verified 2026-07-21 ·
<sup>f</sup> workflowConfigEditorialOJS.js getHeaderItems() (Return to Done button); PKPSubmissionController::authorize() 'returnToDone' (DecisionAllowedPolicy with no decision type in context — ledger row 216); live-probed 2026-07-21 (unassigned-manager confirm succeeds); assigned-editor refusal live-verified 2026-07-21 ·
<sup>g</sup> PKPSubmissionController::getDecisions(); decision\Repository::add() (event log); live-verified 2026-07-21 (manager list read; author refused)

## Fields & validation

Most decisions open a full-page step-by-step wizard. Its steps vary by decision (see
Rules & state rule 2); the fields inside them:

**Email steps** (Notify Authors, Notify Reviewers, Notify Editors):

| Field (UI label) | Required? | Rules |
|------------------|-----------|-------|
| **To** (recipient chips) | Yes for reviewer emails | Fixed to the assigned authors for author emails; for reviewer emails the editor picks among the round's reviewers who completed their review (a non-reviewer recipient is rejected on save) <sup>a</sup> |
| **Subject** | Yes | Pre-filled from the decision's email template; editable <sup>b</sup> |
| **Message** (body) | Yes | Pre-filled from the template with variables substituted; the editor may switch to an alternate template where one is configured <sup>b</sup> |
| **CC / BCC** | No | Free email addresses <sup>b</sup> |
| **Attachments** | No | Upload a new file, pick from the submission's files (only file kinds that belong to the decision's stage), pick reviewer files (review stages), or pick a library file; anything else is rejected <sup>c</sup> |
| **Skip this email** | — | Every email step carries a "Skip this email" link except the recommendation's Notify Editors step; skipping advances to the next step at once (with an undo offered) and sends nothing, while the decision still records <sup>d</sup> |

**File promotion step** (promoting decisions only): a checkbox list of the files
eligible to carry forward to the destination stage, pre-checked by default; the
editor may deselect any or all. <sup>e</sup>

**Payment step** (Accept Submission and Accept and Skip Review, only when
publication fees are fully configured — see Settings): the wizard's *first* step, a
choice between "Request publication fee" (showing the fee and currency) and
"Waive". The request option comes pre-selected, so a person working through the
wizard always finishes with one of the two in effect; an empty choice can only be
attempted by an automated tool recording the decision directly — not by anyone at
the screen — and is rejected there. <sup>f</sup>

**Request Revisions chooser** (a small modal headed "Require New Review Round",
before the wizard): one required radio — "Revisions will not be subject to a new
round of peer reviews." (the default) or "Revisions will be subject to a new round
of peer reviews." — deciding which of two decisions the wizard then records.
Recommend-only editors pass through the same chooser (same wording) before the
matching recommendation wizard. <sup>g</sup>

<sup>a</sup> steps\Email::canChangeRecipients(); NotifyReviewers::validateNotifyReviewersAction() (completed-review filter, invalid-recipient error); NotifyAuthors trait; live-probed 2026-07-21 (author chips fixed/non-editable; reviewer chips removable, autosuggest limited to completed reviewers) ·
<sup>b</sup> DecisionType::validateEmailAction() (subject/body required, cc/bcc email format); steps\Email::getEmailTemplates() (alternate templates) ·
<sup>c</sup> DecisionType::validateEmailAction() attachments after-hook; InSubmissionStage::getAllowedAttachmentFileStages() / InExternalReviewRound::getAllowedAttachmentFileStages(); upload path live-probed 2026-07-21 (recommendation wizard attachment) ·
<sup>d</sup> steps\Email::canSkip(); IsRecommendation::getSteps() (canSkip(false)); DecisionPage.vue skippedSteps; live-probed 2026-07-21 (skip advances with undo notice; skipped author email absent from email log while the decision recorded; no skip control on Notify Editors) ·
<sup>e</sup> steps\PromoteFiles::addFileList() (selectedByDefault); pre-checked default live-probed 2026-07-21 ·
<sup>f</sup> RequestPayment::getPaymentForm() (isRequired false client-side; step prepended via Steps::addStep(…, true)), validatePaymentAction(); live-probed 2026-07-21 (Manual Payment journal; radio pre-selected) ·
<sup>g</sup> SelectRevisionDecisionForm; SelectRevisionRecommendationForm; useWorkflowDecisions.js decisionRequestRevision(); live-probed 2026-07-21 (radios/default, matching wizard headings; Recommend Revisions opens the same modal)

## Rules & state

**The decision catalogue.** Each decision is valid in exactly one stage and produces
a fixed outcome (stage move, status change, review-round change): <sup>a</sup>

| Decision (button label) | Stage | Result |
|---|---|---|
| Send for Review | Submission | → Review, round 1 created |
| Accept and Skip Review | Submission | → Copyediting |
| Decline Submission (desk) | Submission | status → Declined; stage unchanged |
| Revert Decline (desk) | Submission | status → active again |
| Request Revisions | Review | round stays open, round status "revisions requested" |
| Resubmit for Review | Review | round status "resubmit for review" (author revises, a later new round) |
| Accept Submission | Review | → Copyediting; round status "accepted" |
| Create New Review Round | Review | a new, higher-numbered round in the same stage |
| Cancel Review Round | Review | the round is deleted; falls back to the previous round's stage or to Submission |
| Decline Submission (after review) | Review | status → Declined; round status "declined" |
| Revert Decline (review) | Review | status → active again |
| Send To Production | Copyediting | → Production |
| Move to Review (back from copyediting) | Copyediting | → the last review stage that had a round, else ⚠ back to Submission under the same label (ledger row 10) |
| Move To Copyediting (back from production) | Production | → Copyediting |
| Recommend Accept / Decline / Revisions / Resubmit | Review (recommend-only) | records a recommendation; nothing moves |
| Move to Done | any active stage (automatic) | → Done when the first Version of Record is published |
| Return to Workflow | Done | → the stage it occupied before entering Done |
| Return to Done | any active stage (manual) | → Done again, when Done history exists |

1. **Decisions are recorded against the submission's current stage and are
   append-only** — there is no edit or undo of a recorded decision. The one
   exception: cancelling a review round erases that round and every decision recorded
   in it (including the cancellation itself), so a cancelled round leaves no decision
   history. <sup>b</sup>
2. **The wizard is assembled per decision**: a Notify Authors email (only when the
   submission has at least one assigned author), then for review decisions a Notify
   Reviewers email (only when the round has completed reviews — except Cancel Review
   Round, whose reviewer email goes to every reviewer still assigned to the round,
   whether or not they completed a review), then a file
   promotion step (labeled "Select Files") for promoting decisions, and — when fees
   apply — a payment step placed first. A wizard whose author step is dropped opens
   directly on its next step. Decisions with no steps (the Done family) never show a
   wizard — they record from a confirmation dialog or automatically. <sup>c</sup>
3. **Finishing the wizard**: the last step's button records the decision; a
   completion dialog then confirms it in words matching the decision taken (e.g.
   "Sent for Review"), with a single "View Submission Summary" button that lands
   back on the submission's workflow. Backing out via the wizard's "Cancel" button
   first asks "Are you sure you want to cancel this decision?" ("Cancel Decision" /
   "Keep Working"); confirming abandons the wizard and records nothing.
   <sup>d</sup>
4. **Buttons are curated by status and round, the checks behind the screen are
   not** ⚠. What the editor sees in the stage's **action rail** — this spec's
   shorthand for the column of decision buttons on the stage view; no on-screen
   heading names it — follows the submission's state: a declined submission offers
   only Revert Decline; review buttons appear only on the newest round; a decision
   already ruled out by status is hidden. But that curation lives only in the
   screens: an automated tool recording decisions directly — a path no person at
   the screen can take — can record status-inconsistent decisions (a second
   decline, Send for Review on a declined submission) and decisions against an
   obsolete round, and they are accepted with full effect (ledger row 218). ⚠ The
   Submission-stage rail additionally
   carries a decision-styled "Schedule For Publication" button that is only a
   shortcut to the publication tab — it persists on desk-declined submissions and
   on the stage view of a Done submission (new finding, see Known deviations).
   <sup>e</sup>
5. **Review decisions belong to a round**: recording one requires naming a round of
   that submission, and the decision updates that round's displayed status (see the
   catalogue). A decision the catalogue lists with no round status of its own still
   refreshes the label: the round's displayed status is recalculated to match the
   round's current reviewer activity, rather than left showing whatever it said
   before the decision. <sup>f</sup>
6. **Cancel Review Round is offered only while the round is uncommitted** — the
   moment any reviewer has confirmed an invitation or completed a review, the button
   disappears and the page for it refuses to load. Cancelling deletes the round's
   reviewer assignments and the round itself. <sup>g</sup>
7. **Create New Review Round** numbers the new round one higher than the last and
   starts it "pending reviewers"; its wizard lets the editor notify the authors and
   carry revision files into the new round. <sup>h</sup>
8. **Declining and reverting**: both desk decline and post-review decline mark the
   whole submission Declined (it leaves the active queue but keeps its stage); the
   matching revert restores it to active. While declined, Revert Decline is the only
   decision the stage's action rail offers — plus a "Delete" action for Journal
   Managers and Site Administrators. <sup>i</sup>
9. **Recommendations** are recorded like decisions but move nothing. They require at
   least one assigned deciding editor on the stage — without one, the
   recommendation buttons are withheld and the editor instead reads "You can not
   make a recommendation until an editor is assigned with permission to record a
   decision." (direct recording attempts are refused too; ⚠ the on-screen
   withholding accepts a deciding editor from any stage while recording insists on
   the current one — see Known deviations); the wizard is a single,
   unskippable Notify Editors email that goes to the deciding editors, and the same
   message is also posted as a discussion among them. Deciding editors see the
   recorded recommendations listed on the review stage. <sup>j</sup>
10. **The revisions chooser routes to one of two decisions** — "Request Revisions"
    is one button but two decisions: revisions without a new round, or resubmit for
    a new round; the chooser modal (rule in Fields) decides which wizard opens.
    <sup>k</sup>
11. **File promotion is the wizard's own last chore, not part of the decision**: to
    a tester, the ticked files are simply listed in the destination stage's file
    panel by the time the completion dialog appears — but it is the wizard screen
    that copies them over, one by one, just after the decision records. A decision
    recorded by an automated tool without the wizard — not something a person at
    the screen can do — therefore arrives with no files carried forward.
    <sup>l</sup>
12. **Sharing reviewer attachments with authors**: attaching a reviewer-uploaded
    file to the Notify Authors email of a review decision marks that file visible to
    the author. ⚠ For anonymous review methods the author has no screen that lists
    it — the email attachment is the only copy they get (ledger row 215). <sup>m</sup>
13. **The Done machine**: publishing a submission's first Version of Record
    automatically records Move to Done (from whatever stage it was on) and the
    workflow lands on a Done stage; unpublishing the last published Version of
    Record automatically records Return to Workflow. From Done, an editor can
    manually confirm Return to Workflow; the submission returns to the exact stage
    recorded on its most recent into-Done decision. From any active stage, a
    submission with Done history offers Return to Done in the workflow header ⚠ (but
    see Known deviations, row 216: assigned editors are refused). Both manual
    actions are one-click confirm dialogs, not wizards. On screen the Done stage has
    no name or menu entry of its own — the workflow menu keeps the four working
    stages, and a Done submission is recognizable by its "Published" header badge
    and the Return to Workflow button, while dialogs and the activity log speak of
    "the Done stage". <sup>n</sup>
14. **Minimum-reviews warning**: when the journal sets a minimum number of confirmed
    reviews, choosing Accept, Request Revisions or Create New Review Round below
    that minimum first shows a "Proceed Without Minimum Confirmed Reviews?" prompt
    with "Yes, Continue" / "Cancel"; for Request Revisions the prompt appears before
    the revisions chooser. Decline never warns. <sup>o</sup>
15. **Anonymity in the reviewer composer** ⚠: reviewer notification emails are sent
    one copy per reviewer with per-copy name substitution, but the composer's
    recipient chips show every reviewer's real name regardless of review method —
    the planned masking was never built (ledger row 214). <sup>p</sup>

<sup>a</sup> APP\decision\Repository::getDecisionTypes(); each type's getStageId()/getNewStageId()/getNewStatus()/getNewReviewRoundStatus(); Decision::* constants (OMP-only *_INTERNAL variants are inert in OJS); catalogue transitions live-verified 2026-07-21 ·
<sup>b</sup> decision\Repository::validate() ("It is not possible to edit a decision"); PKPSubmissionController::addDecision() (cancel-round deletion note); CancelReviewRound::runAdditionalActions() (deletes assignments + round); erasure set live-verified 2026-07-21 (the round-creating decision, recorded against the prior round, survives) ·
<sup>c</sup> each type's getSteps(); Steps::addStep(); steps\Email::isValidStep() (empty-recipient steps dropped); RequestRevisions::getSteps() (authors-count guard); CancelReviewRound::getSteps() (active assignments); APP Accept/SkipExternalReview::getSteps() (payment step); step rosters, author-less wizard and completed-reviews reviewer-step gating live-probed 2026-07-21 ·
<sup>d</sup> DecisionPage.vue (record + openCompletedDialog + cancel) — openCompletedDialog branches on returnUrlToSubmissionSummary: every dashboard entry takes the one-button "View Submission Summary" branch; a two-button return-to-list variant exists only when the record URL is opened without a return parameter (no UI path); DecisionType::getCompletedLabel()/getCompletedMessage(); DecisionHandler::record() state; live-probed 2026-07-21 (completion + cancel leave no decision row/stage move/email) ·
<sup>e</sup> APP\submission\maps\Schema::getAvailableEditorialDecisions() (status switches, latest-round curation in workflowConfigEditorialOJS.js getActionItems); decision\Repository::validate() (stage-only; round checked for submission ownership only) — ledger row 218; rail curation live-probed 2026-07-21 (declined collapse, old-round rail absent); "Schedule For Publication" pushed unconditionally by getActionItems (navigateToMenu shortcut) — new finding ·
<sup>f</sup> decision\Repository::validate() (review-round requirement); DecisionType::runAdditionalActions() (round status update / recompute); live-verified 2026-07-21 (missing round refused; recompute observed) ·
<sup>g</sup> CancelReviewRound::canRetract() (no confirmed, no completed); Schema::getAvailableEditorialDecisions() (conditional listing); DecisionHandler::record() (DecisionRetractable 404); live-probed 2026-07-21 (offered with invited-only reviewers; gone once a reviewer accepts) ·
<sup>h</sup> NewExternalReviewRound::runAdditionalActions() (round + 1); DecisionType::createReviewRound(); wizard steps live-probed 2026-07-21 ·
<sup>i</sup> Decline/InitialDecline (STATUS_DECLINED), RevertDecline/RevertInitialDecline (STATUS_QUEUED); workflowConfigEditorialOJS.js (revert + delete buttons, manager/admin gate); live-probed 2026-07-21 (collapsed rail; manager adds "Delete") ·
<sup>j</sup> IsRecommendation::getSteps() (canSkip(false)), addRecommendationQuery(); decision\Repository::validate() + DecisionHandler::record() (deciding-editor guards); WorkflowRecommendOnlyListingRecommendations (listing, owned by recommend-only-editors); live-probed 2026-07-21 (three Recommend buttons; no-deciding-editor notice; unskippable Notify Editors with fixed recipients; discussion created) ·
<sup>k</sup> useWorkflowDecisions.js decisionRequestRevision()/decisionRecommendRevision(); SelectRevision*Form; live-probed 2026-07-21 ·
<sup>l</sup> DecisionPage.vue copyFile() (client-side copy after the decision POST); live-probed 2026-07-21 (copy requests complete before the completion dialog shows; unticked file not copied) ·
<sup>m</sup> NotifyAuthors::shareReviewAttachmentFiles() (viewable flag) — ledger row 215 ·
<sup>n</sup> ApplyDoneWorkflowStage::handle() (publish/unpublish listeners, VoR count); ReturnToWorkflow::getNewStageId() (last into-Done decision's recorded stage); PKPSubmissionController::returnToDone() (Done-history + not-in-Done guards); useWorkflowActions.js workflowDecisionReturnToWorkflow()/ReturnToDone() (confirm dialogs); WORKFLOW_STAGE_ID_DONE; I12799_MovePublishedSubmissionsToDone (backfill); live-probed 2026-07-21 (UI publish → Done + log entry; return to exact prior stage; auto return on unpublish; Return to Done for unassigned manager; Copyediting-origin return target verified) ·
<sup>o</sup> useWorkflowDecisions.js showWarningDialogAboutMinimumReviewsIfEnabled(); live-probed 2026-07-21 (warning on Accept/New Round/Request Revisions, none on Decline; cancel leaves no decision) ·
<sup>p</sup> steps\Email::anonymizeRecipients() (serialized, unconsumed) — ledger row 214

## Side effects

- **Author in-app notification**: every decision refreshes the assigned authors'
  decision notification, and older decision notifications for the submission are
  replaced, not stacked. ⚠ Only the revise decisions (Request Revisions, Resubmit)
  actually reach the author's screen — as a row in the author's Tasks list plus a
  notice in the round's status panel; the other decisions' notifications are
  recorded but appear on no author page at all, so for them the email is the
  author's only visible channel (new finding, see Known deviations). <sup>a</sup>
- **Author email**: the Notify Authors step (unless skipped) emails the assigned
  authors using the decision's own email template, with the composed subject, body
  and attachments; it is recorded in the submission's email log. When the journal
  turned on "notify all authors", every other contributor with an email address
  gets a companion note built from a separate template that wraps the message sent
  to the submitting author — sent by the deciding editor, like the original.
  <sup>b</sup>
- **Reviewer email**: the Notify Reviewers step sends each chosen reviewer their own
  copy (with their own name substituted), logs one email-log entry per reviewer and
  one activity-log entry with the recipient count, and marks each reviewer's
  assignment as acknowledged — the reviewer's row in the round's reviewer list then
  reads "Reviewer Thanked". The cancellation decision uses the unassignment message
  instead. <sup>c</sup>
- **Activity log**: every decision writes an entry naming the editor and the
  decision taken; recommendations write a recommendation entry instead. These render
  in the submission's activity log (surface owned by editorial-activity-log).
  <sup>d</sup>
- **Recommendation extras**: the Notify Editors message is duplicated as a
  discussion whose participants are the deciding editors — the recommending editor
  authors its first message but is not a participant — with any attachments copied
  onto it (see tasks-discussions for discussion mechanics). <sup>e</sup>
- **Stage-entry housekeeping**: entering a stage through a decision creates a fresh
  review round when a review stage has none, resets the round status when one
  exists, and instantiates any auto-add task templates for the destination stage
  (rule owned by tasks-discussions). <sup>f</sup>
- **Editing/production notices**: Accept refreshes the copyediting notices (assign a
  copyeditor / awaiting copyedits); Send To Production refreshes those plus the
  production notices. Review-stage notices about pending revisions are refreshed on
  every decision. <sup>g</sup>
- **Payment**: choosing "request payment" queues the publication fee against the
  submission, sends each assigned author a payment-request email from the journal's
  contact (not the editor), and gives them a task-level payment notification ("The
  publication fee is due for payment."); the editor's workflow gains a Payments
  panel listing the fee as Unpaid. <sup>h</sup>
- **Other parts of the system are told about the decision** (e.g. DOI registration,
  the review-round response flow) so they can react. There is nothing here for a
  tester to observe directly — any visible consequences appear in those features'
  own screens. <sup>i</sup>

<sup>a</sup> decision\Repository::updateNotifications(); EditorDecisionNotificationManager (TASK level for pending-revisions/resubmit, NORMAL otherwise); live-probed 2026-07-21 (Accept row written NORMAL/unread with no surface; Request Revisions task row + round-status notice; replacement observed as delete-and-recreate) ·
<sup>b</sup> NotifyAuthors::sendAuthorEmail() (mailable Decision*NotifyAuthor per type; EDITOR_NOTIFY_AUTHOR email log; notifyAllAuthors → DecisionNotifyOtherAuthors); live-probed 2026-07-21 (wrapper delivered only with the setting on; sender is the editor) ·
<sup>c</sup> NotifyReviewers::sendReviewersEmail() (DecisionNotifyReviewer / ReviewerUnassign; REVIEW_NOTIFY_REVIEWER log; SUBMISSION_LOG_DECISION_EMAIL_SENT event; dateAcknowledged/considered updates); live-probed 2026-07-21 (per-reviewer copy with own name; row flips Complete → "Reviewer Thanked") ·
<sup>d</sup> decision\Repository::add() (SUBMISSION_LOG_EDITOR_DECISION / SUBMISSION_LOG_EDITOR_RECOMMENDATION, message from getLog()); live-probed 2026-07-21 (decision, recommendation and email-sent wordings verified) ·
<sup>e</sup> IsRecommendation::addRecommendationQuery(); live-probed 2026-07-21 ("Editor Recommendation" discussion, attachment carried, sender absent from participants) ·
<sup>f</sup> DecisionType::runAdditionalActions() (createReviewRound, editorial-task auto-create) ·
<sup>g</sup> decision\Repository::getSubmissionNotificationTypes(), getReviewNotificationTypes() ·
<sup>h</sup> RequestPayment::requestPayment() (queued payment, PaymentRequest mailable, PAYMENT_REQUIRED task notification); live-probed 2026-07-21 ("Payment Request Notification" from the journal contact; task row; Payments panel Unpaid/Paid/Waived selector) ·
<sup>i</sup> DecisionAdded event (decision\Repository::add())

## Settings that modify behavior

- **Notify all authors** (Settings → Workflow → Emails): on, the author email step
  also writes to contributors who are not assigned as participants (see Side
  effects). <sup>a</sup>
- **Publication fee / payments enabled** (Settings → Distribution → Payments): with
  payments on, a fee amount set AND a payment method configured (e.g. manual
  payment with its instructions filled in), the request-or-waive payment step is
  added to Accept Submission and Accept and Skip Review. ⚠ With a fee set but no
  configured payment method, the step silently disappears and the fee is never
  requested (new finding, see Known deviations). <sup>b</sup>
- **Minimum reviews per submission** (journal review setup): arms the
  proceed-without-minimum-reviews warning (rule 14). <sup>c</sup>
- **Email templates** (Settings → Workflow → Emails): each decision's notification
  email is pre-filled from its own editable template, and templates configured as
  alternates appear as choices in the composer. Template management is owned by the
  email-templates/workflow settings feature. <sup>d</sup>
- No config.inc.php variables alter these rules.

<sup>a</sup> context setting notifyAllAuthors (PKPEmailSetupForm); live-probed 2026-07-21 (on/off contrast) ·
<sup>b</sup> OJSPaymentManager::publicationEnabled() (configured payment plugin && paymentsEnabled && fee > 0); context publicationFee/currency; live-probed 2026-07-21 (step absent until the ManualPayment instructions were configured) ·
<sup>c</sup> context numReviewsPerSubmission (useWorkflowDecisions.js); live-probed 2026-07-21 ·
<sup>d</sup> steps\Email::getEmailTemplates() (alternateTo)

## Cross-feature interactions

- **send-to-review** — owns the stage-1 workspace; its Send for Review / Accept and
  Skip Review / Decline buttons are this spec's decisions.
- **review-rounds-and-revisions** — owns rounds, revision files and the author
  response cycle; the decisions that open/close/cancel rounds live here.
- **recommend-only-editors** — owns the recommendation *journey* (controls, listing,
  how a deciding editor acts on one); the recommendation decision mechanics
  (validation, wizard, discussion side effect) live here.
- **copyediting-stage / production-stage** — own their workspaces; the handoff
  decisions (Send To Production, the back-movements) live here.
- **publication-publish-flow** — publishing/unpublishing triggers the automatic Done
  decisions (rule 13); the publish preconditions are its own.
- **tasks-discussions** — auto-add task templates on stage entry; the
  recommendation discussion.
- **submission-files** — file kinds, promotion targets and the attachment pickers.
- **workflow-settings / email-templates** — the settings listed above.
- **editorial-activity-log** — renders the decision and email log entries recorded
  here.

## Canonical scenarios

1. **Send for Review** — a Section Editor assigned to a new submission opens it and
   clicks "Send for Review". A full-page wizard opens with steps "Notify Authors"
   and a "Select Files" step; the editor keeps the prefilled email, ticks the
   submission file to carry forward, and confirms on the last step. A completion
   dialog headed "Sent for Review" confirms it, with a "View Submission Summary"
   button; back on the workflow the submission sits on the Review stage, Round 1,
   and the carried file is listed in the round's file panel, whose on-screen
   heading reads "Files for Review". The author
   receives the notification email. <sup>s1</sup>
2. **Accept and Skip Review with a fee request** — on a journal with a publication
   fee enabled, a Journal Manager clicks "Accept and Skip Review" on a
   submission-stage article. The wizard opens on a "Request Payment" step; the
   manager keeps "Request publication fee" (pre-selected), completes the wizard,
   and the submission lands in Copyediting.
   The author gets the acceptance email plus a separate payment-request email, and a
   payment task appears in their tasks. <sup>s2</sup>
3. **Desk decline, then revert** — a Section Editor clicks "Decline Submission" on
   the Submission stage and completes the wizard. The submission's status shows
   Declined and "Revert Decline" is the only decision button the stage now
   shows (a Journal Manager additionally sees "Delete"; the "Schedule For
   Publication" shortcut stays — see Known deviations). Clicking "Revert Decline"
   and finishing its
   wizard restores the submission to the active queue with the original decision
   buttons back. <sup>s3</sup>
4. **Request Revisions via the chooser** — with one completed review in Round 1, a
   Section Editor clicks "Request Revisions". A small dialog asks whether revisions
   will be subject to a new round; keeping the default (no new round) and pressing
   Next opens the wizard. The editor attaches the reviewer's uploaded file to the
   author email and records the decision. The round remains open showing "Revisions
   requested"; the author's copy of the email carries the attachment, and the
   revise-request notification appears with the author's tasks. <sup>s4</sup>
5. **Accept below the review minimum, thanking reviewers** — the journal requires
   more confirmed reviews than exist; the editor clicks "Accept Submission" and
   first sees the "Proceed Without Minimum Confirmed Reviews?" prompt. Choosing
   "Yes, Continue" opens the wizard with "Notify Authors", "Notify Reviewers" and
   "Select Files". In the
   reviewer step the completed reviewer is offered as a recipient by real name
   (whatever the review method); the editor sends both emails and completes. The
   submission moves to Copyediting and the reviewer receives the thank-you email.
   <sup>s5</sup>
6. **Create a new review round** — after a "resubmit" cycle, the Section Editor
   clicks "Create New Review Round", keeps the author notification, and ticks the
   revised file to carry into the new round. Round 2 appears in the review stage's
   round list, empty of reviewers, with the carried file in its review files.
   <sup>s6</sup>
7. **Cancel Review Round while it is still uncommitted** — on a fresh round with
   only unconfirmed reviewer invitations, the editor sees "Cancel Review Round" and
   uses it; the round disappears and the submission falls back to where it stood
   before the round — the stage the previous round belonged to, or the Submission
   stage when no earlier round exists. On a sibling submission where a reviewer has
   confirmed, the button is absent. <sup>s7</sup>
8. **A recommend-only editor records a recommendation** — a Section Editor assigned
   recommend-only on the review stage sees three buttons — "Recommend Accept",
   "Recommend Revisions", "Recommend Decline" — instead of decision buttons.
   "Recommend Accept" opens a one-step wizard whose Notify Editors email offers no
   skip option; after sending, a "Recommendation Submitted" dialog confirms it, and
   the deciding editor finds the recommendation listed on the review stage and the
   same message waiting as a discussion. On the Submission stage the same
   recommend-only editor is offered a plain "Send for Review" button and no other
   decision. <sup>s8</sup>
9. **Copyediting handoffs, including the mislabeled back-move** — from Copyediting,
   "Send To Production" moves the submission to Production. On a submission that
   was accepted straight from the Submission stage (no review round), the back
   button still reads "Move to Review" and its wizard and author email speak of the
   review stage, but completing it lands the submission on the Submission stage
   (as-built, ledger row 10). On a sibling that did have a review round, the same
   button returns it to the Review stage. <sup>s9</sup>
10. **Back from Production** — a Journal Manager on the Production stage clicks
    "Move To Copyediting" and completes its wizard — a full-page wizard whose only
    step is the Notify Authors email, not a mere confirm dialog — and the
    submission is back in Copyediting with the decision recorded in the activity
    log. <sup>s10</sup>
11. **Decision authority boundary** — on the same review-stage submission: an
    Assistant assigned to the stage sees the workspace but no decision buttons; the
    submission's Author sees none in their view; an unassigned Journal Manager sees
    and can record every decision; a recommend-only Section Editor is never offered
    "Accept Submission". <sup>s11</sup>
12. **Automatic Done bookkeeping** — publishing a production-stage submission's
    first Version of Record flips the submission's header badge to "Published" and
    adds a "Return to Workflow" button (the Done stage), and the activity log shows
    a "moved this submission to the Done stage" entry no one clicked for.
    Unpublishing it returns the submission to Production, with a matching return
    decision logged. <sup>s12</sup>
13. **Return to Done — offered widely, honored narrowly** — after the unpublish in
    the previous scenario, the workflow header shows "Return to Done" on the active
    stage. The assigned Section Editor confirms the dialog and gets an error about
    role access, with nothing recorded (as-built, ledger row 216); an unassigned
    Journal Manager confirms the same dialog and the submission moves back to Done.
    <sup>s13</sup>

<sup>s1</sup> SendExternalReview; test seeding: fresh wizard submission, assigned section editor; live-probed 2026-07-21 end-to-end (incl. unticked-file sibling: nothing copied) ·
<sup>s2</sup> APP SkipExternalReview + RequestPayment; enable payments + publication fee + a configured payment method in Distribution settings (configure paymethod plugin settings through the UI — DB-seeded plugin settings are cache-blind); live-probed 2026-07-21 end-to-end (payment step first; "Payment Request Notification" from the journal contact; task row; Payments panel) ·
<sup>s3</sup> InitialDecline / RevertInitialDecline; delete gate hasCurrentUserAtLeastOneAssignedRoleInAnyStage(manager/admin); rail collapse + "Delete" gate + Revert Decline wizard live-probed 2026-07-21 ·
<sup>s4</sup> RequestRevisions + SelectRevisionDecisionForm; attachment sharing rule 12 (open-method author surface is ledger row 215's positive case); chooser + task-level author notice live-probed 2026-07-21 ·
<sup>s5</sup> Accept + showWarningDialogAboutMinimumReviewsIfEnabled; composer chips per ledger row 214 (as-built real names); warning prompt, wizard roster, reviewer thank-you + "Reviewer Thanked" row live-probed 2026-07-21 ·
<sup>s6</sup> NewExternalReviewRound; wizard steps (Notify Authors, Select Files) live-probed 2026-07-21 ·
<sup>s7</sup> CancelReviewRound::canRetract(); live-probed 2026-07-21 (offered with invited-only reviewers; absent once one accepts) ·
<sup>s8</sup> IsRecommendation; getDecisionTypesMadeByRecommendingUsers() (stage-1 Send for Review); live-probed 2026-07-21 end-to-end (both halves; discussion + attachment verified) ·
<sup>s9</sup> SendToProduction; BackFromCopyediting::getNewStageId() (ledger row 10 addendum); "Move to Review" button label + wizard on a never-reviewed submission live-probed 2026-07-21 (wizard opened, not completed); row-10 Submission-stage landing live-verified 2026-07-21 ·
<sup>s10</sup> BackFromProduction; wizard (Notify Authors only) live-probed 2026-07-21 (opened) ·
<sup>s11</sup> Schema::getAvailableEditorialDecisions(); DecisionAllowedPolicy; live-probed 2026-07-21 (Assistant workspace w/o rail — note an unrelated reviewer-suggestions error dialog pops for the Assistant, see Known deviations new findings; Author view w/o rail; unassigned manager Accept end-to-end) ·
<sup>s12</sup> ApplyDoneWorkflowStage; ReturnToWorkflow; live-probed 2026-07-21 via the UI publish path (scenario-seeded publishes skip the moved-to-Done log entry — publish via UI in tests) ·
<sup>s13</sup> returnToDone endpoint + ledger row 216 (established fact — the test asserts the as-built refusal); unassigned-manager success live-probed 2026-07-21; assigned-editor refusal live-verified 2026-07-21

## Known deviations (as-built ≠ intent)

All six standing facts below are maintainer-confirmed ledger rows owned by this
feature (docs/e2e/app-changes.md §2). They are established: a probe or test that
seems to contradict one is a new finding to report, not a reason to reconcile.
Each was re-reproduced live 2026-07-21 (verification chunk e), every negative
bounded by a positive control.

- ⚠ **Ledger row 214 — reviewer-composer anonymity masking was never built**: the
  Notify Reviewers "To:" chips show real reviewer names for anonymous and
  double-anonymous reviews; the backend serializes an anonymize flag no UI consumes
  (steps\Email::anonymizeRecipients(), set by Accept/Decline/RequestRevisions/
  Resubmit). Editor-facing only. Suspected intent: mask the chips (or drop the dead
  flag).
- ⚠ **Ledger row 215 — reviewer files shared via decision email are unreachable for
  the author under anonymous methods**: NotifyAuthors::shareReviewAttachmentFiles()
  flips the viewable flag, but the author-side round panel lists only open-method
  completed reviews, so the flag has no author surface for the default methods.
- ⚠ **Ledger row 216 — Return to Done fails for exactly its audience**: the header
  offers it on any active stage with Done history, but PKPSubmissionController::
  authorize() adds DecisionAllowedPolicy with no decision type for returnToDone, so
  every assigned editor's confirm ends in "The current role does not have access to
  this operation." — only unassigned managers/admins succeed. Suspected intent:
  authorize with a real decision type.
- ⚠ **Ledger row 217 — Done-stage decisions are open to recommend-only assignees**:
  the Done branch of DecisionAllowedPolicy::effect() accepts any Manager/Section
  Editor stage assignment without the recommend-only filter, so a recommend-only
  Section Editor can record Return to Workflow (UI and API) — the only full decision
  such an assignee can take anywhere. Intent under triage (Open question 3).
- ⚠ **Ledger row 218 — recording accepts status- and round-inconsistent decisions
  the UI never offers**: decision\Repository::validate() checks the stage guard but
  not the submission status, and accepts any round belonging to the submission — a
  duplicate decline, Send for Review on a declined submission, and decisions against
  a superseded round all record with full effects when posted directly. API-only;
  the UI curation hides all of these. Intent under triage (Open question 1).
- ⚠ **Ledger row 219 — a manager assigned in a lesser role: three layers disagree,
  split by whether the lesser group covers the current stage**: covered stage
  (copyeditor assignment on Copyediting) — buttons render, every press errors,
  direct posts refused; uncovered stage (Review) — direct posts succeed while
  enrolled managers see the no-access sentence with no action rail (not-enrolled,
  seed-only shapes keep the full manager view). DecisionAllowedPolicy::effect()
  scopes assignments by the group's stages then skips non-editor groups;
  Schema::checkDecisionPermissions() falls back to manager enrollment. Intent under
  triage (Open question 5).
- ⚠ **Ledger row 10 (+ 2026-07-16 addendum) — back-from-copyediting is mislabeled
  when no review round exists**: the button, wizard heading and author email all say
  review ("Move to Review") while BackFromCopyediting::getNewStageId() sends a
  no-round submission to the Submission stage; the completion dialog hedges. With a
  round, the same decision correctly returns to review.

### New findings — 2026-07-21 live probes (proposed ledger rows, NOT yet ledgered)

Consolidated draft rows with evidence and anchors:
docs/product/.reports/editorial-decisions-proposed-ledger.md. None contradicts the
established rows above. Summaries:

- ⚠ **Ledger row 220 — "Schedule For Publication" renders as a decision-styled primary button in
  rails where it is only a navigation shortcut** — atop the Submission-stage rail,
  persisting on desk-declined submissions, for recommend-only assignees, and on the
  Production view of a Done submission; it just opens the publication tab
  (workflowConfigEditorialOJS.js getActionItems pushes it unconditionally).
- ⚠ **Ledger row 221 — Assistant with review-stage access gets an "Error — The current role does not
  have access to this operation." dialog on every review-stage open** when reviewer
  suggestions are enabled — the suggestions request is denied (401) for the role and
  surfaces as a modal over an otherwise functional workspace. (Surface belongs to
  reviewer management; reported from this feature's probing.)
- ⚠ **Ledger row 222 — Accept-class author notifications have no surface**: NORMAL-level decision
  notifications (e.g. Accept) are written unread but no author page displays them —
  only TASK-level revise decisions surface (Tasks grid + round-status notice); the
  email is the only author-visible channel (see Side effects, Open question 8).
- ⚠ **Ledger row 223 — The payment step is silently gated on a configured payment-method plugin**:
  with a fee set and payments on but no configured method, Accept wizards omit the
  Request Payment step and never request the fee — no warning anywhere
  (OJSPaymentManager::publicationEnabled(); see Settings, Open question 9).
- ⚠ **Ledger row 225 — Done submissions' stage view shows a broken status sentence** — "The
  submission is currently in the stage." with an empty stage name (no stage-6 entry
  in the stage-name map); cosmetic, visible to any role opening the stage view.
- (minor, folded into Side effects; ledger row 224) the recommendation's auto-created discussion
  lists only the deciding editors as participants — the recommending sender is not
  one, despite authoring its first message.
- ⚠ **Ledger row 227 — Recommendation buttons offered when no deciding editor covers the current
  stage — clicking any lands on a bare "404 Not Found"** (verify-a F2, edge-probed
  2026-07-21): the rail's withhold check reads the submission-wide editorAssigned
  flag (WorkflowRecommendOnlyControls.vue; Schema builds it from assignments on
  ANY stage), while both fulfilment paths scope to the decision's stage
  (decision\Repository::validate() requiredDecidingEditor → 400;
  DecisionHandler::record() → 404). A non-recommendOnly Production-editor
  assignment on a submission still in review flips the gate; the control seed
  without it correctly withholds the buttons. A new *shape* of the row-219
  screen-vs-server family (different mechanism — row 219 itself stands unchanged).
- ⚠ **Ledger row 228 — A deciding editor who also holds a recommend-only assignment silently loses
  every decision button** (verify-a F3, edge-probed 2026-07-21): any recommend-only
  row sets currentUserCanRecommendOnly and the review rail's either/or
  (workflowConfigEditorialOJS.js) renders the recommendation controls INSTEAD of
  the decision buttons, while DecisionAllowedPolicy still permits the full
  decision via the deciding row — their directly posted Accept recorded and moved
  the submission. Capability concealment, no escalation; the dual shape is
  creatable through the Assign Participant UI. Another row-219-family screen/server
  split (distinct mechanism — row 219 stands unchanged).

## Open questions

1. (Ledger row 218) Should decision recording enforce the UI's status and
   latest-round curation server-side, or is API permissiveness deliberate for
   imports and editorial tools?
2. Recording a decision through the API promotes no files (promotion is a
   client-side follow-up, rule 11) — accepted consequence of the wizard design, or
   should the decision body accept a file list?
3. (Ledger row 217) Should the Done-stage branch of the decision policy apply the
   recommend-only filter, or is "any assigned editor may return a Done submission to
   the workflow" the intended capability (then document it in
   recommend-only-editors)?
4. (Ledger row 216) Is the intended audience for Return to Done "anyone offered the
   button" (fix the authorization) or "unassigned managers only" (hide the button
   from assigned editors)?
5. (Ledger row 219) For a manager assigned in a lesser role: should the lesser
   assignment strip manager decision authority everywhere (hide buttons, close the
   uncovered-stage bypass) or nowhere (keep the enrollment fallback in the policy)?
6. The recommendation carve-out lets a recommend-only editor record Send for Review
   on the submission stage (there is nothing to recommend there). Intended
   convenience, or should stage 1 offer them nothing?
7. Move to Done / Return to Workflow are recorded with the acting user as deciding
   editor, falling back to a derived system editor when no user is in scope (e.g.
   scheduled publishing). Is attributing an automatic transition to the acting user
   (who may be, say, a manager publishing an issue) the intended audit trail?
8. (New finding, 2026-07-21; ledger row 222) Author notifications for Accept-class decisions are
   written but no author screen shows them — only the revise decisions surface as
   tasks. Is email-only the intended author channel for those decisions (then stop
   writing the dead rows), or should the author dashboard surface them?
9. (New finding, 2026-07-21; ledger row 223) With a publication fee set and payments enabled but no
   configured payment method, the payment step silently vanishes from Accept
   wizards. Should the Distribution → Payments form (or the wizard) warn — and is
   the fee-without-method state even reachable through that form, or only via
   API/imports?

---

<!-- REFERENCE MATERIAL — provenance and campaign bookkeeping, not product-owner
     narrative. -->

## Reference — entry points & surfaces

| Entry | Path | Atom |
|-------|------|------|
| Stage action rail (decision buttons) | Dashboard → submission workflow page → per-stage action column; buttons from `availableEditorialDecisions` in the submission payload (workflowConfigEditorialOJS.js getActionItems) | — |
| Workflow header (Return to Workflow / Return to Done) | Workflow page header action buttons (workflowConfigEditorialOJS.js getHeaderItems) | — |
| Decision wizard page | `{journal}/decision/record/{submissionId}?decision={n}[&reviewRoundId={n}]` (DecisionHandler::record → DecisionPage.vue) | PAGE-decision-record |
| Record decision API | `POST api/v1/submissions/{submissionId}/decisions` | API-submission-add-decision |
| List decisions API | `GET api/v1/submissions/{submissionId}/decisions` | API-submission-get-decisions |
| Return to Done API | `POST api/v1/submissions/{submissionId}/returnToDone` | API-submission-return-to-done |
| Revisions chooser modal | Review stage → "Request Revisions" button → WorkflowSelectRevisionFormModal (forms FORM_SELECT_REVISION_DECISION / _RECOMMENDATION) | FORM-select-revision-{decision,recommendation}-form |
| Decision notification emails | Decision*NotifyAuthor / DecisionNotifyReviewer / RecommendationNotifyEditors / DecisionNotifyOtherAuthors mailables (templates EDITOR_DECISION_*) | MAIL-decision-*, MAIL-recommendation-notify-editors |
| Automatic Done decisions | PublicationPublished/PublicationUnpublished events → ApplyDoneWorkflowStage listener | — (db-entities Gaps claim) |
| Decision history | Submission activity log entries (editorial-activity-log surface) | EVLOG-SUBM-ED-{DEC,REC,EMAIL} |

## Reference — code anchors

- lib/pkp/classes/decision/{Decision,DecisionType,Repository,Steps,Step}.php — engine,
  validation, recording, wizard-step assembly
- classes/decision/{Decision,Repository}.php; classes/decision/types/* — OJS decision
  roster (21 types), APC payment trait
- lib/pkp/classes/decision/types/* + types/traits/* — the shared decision types,
  stage traits, notify/recommendation traits
- lib/pkp/classes/decision/steps/{Email,Form,PromoteFiles}.php — wizard step kinds
- lib/pkp/pages/decision/DecisionHandler.php — wizard page; lib/ui-library
  src/components/Container/DecisionPage.vue — wizard frontend (record POST + client
  file promotion)
- lib/pkp/api/v1/submissions/PKPSubmissionController.php — getDecisions (:1104),
  addDecision (:1950), returnToDone (:1988) + authorize() wiring
- lib/pkp/classes/security/authorization/DecisionWritePolicy.php + internal/
  {DecisionAllowedPolicy,DecisionStageValidPolicy,DecisionTypeRequiredPolicy}.php
- classes/submission/maps/Schema.php getAvailableEditorialDecisions() — per-stage
  button curation; lib/pkp/classes/submission/maps/Schema.php
  checkDecisionPermissions()
- lib/ui-library/src/pages/workflow/composables/{useWorkflowDecisions.js,
  useWorkflowActions.js,useWorkflowConfig/workflowConfigEditorialOJS.js}
- lib/pkp/classes/observers/listeners/ApplyDoneWorkflowStage.php;
  lib/pkp/classes/migration/upgrade/v3_6_0/I12799_MovePublishedSubmissionsToDone.php
- lib/pkp/classes/notification/managerDelegate/EditorDecisionNotificationManager.php
- lib/pkp/schemas/decision.json; DB edit_decisions
