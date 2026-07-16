---
name: editorial-decisions
scope: Editors move a submission through the workflow by recording decisions — accept, decline, revisions, stage transitions, review rounds, recommendations and the Done-stage transitions — each with an optional author notification email and file handoff
shared: pkp-lib
status: verified
atlas-claims:
  - PAGE-decision-record
  - LOC-editor-editor-decision
  - LOC-emails-emails-decision
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
  - EVLOG-SUBM-ED-DEC
  - EVLOG-SUBM-ED-REC
  - EVLOG-SUBM-ED-EMAIL
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
  - NOTIF-editor-decision-internal-review
  - NOTIF-editor-decision-accept
  - NOTIF-editor-decision-external-review
  - NOTIF-editor-decision-pending-revisions
  - NOTIF-editor-decision-resubmit
  - NOTIF-editor-decision-new-round
  - NOTIF-editor-decision-decline
  - NOTIF-editor-decision-send-to-production
  - NOTIF-editor-decision-revert-decline
---

# Editorial decisions

## Purpose

Every submission moves through the workflow — Submission, Review, Copyediting,
Production, Done — by way of **editorial decisions**. This feature is the decision
engine: the catalogue of decisions OJS offers at each stage, the action buttons on the
submission workflow page, the step-by-step wizard that records a decision (compose the
notification email to the authors, optionally notify reviewers, choose which files to
carry into the next stage, request a publication fee), and the state changes each
decision produces — stage transitions, declined/active status flips, review-round
creation and cancellation, and the automatic Done-stage bookkeeping when an article is
published or unpublished. Editors with a "recommend only" assignment record
**recommendations** instead, which are relayed to the deciding editors rather than
changing the submission's state. Every stage feature (send-to-review,
review-rounds-and-revisions, copyediting-stage, production-stage,
recommend-only-editors) references this spec for decision mechanics.

## Actors & permissions

Terms used below: *assigned as editor* = has a stage assignment on the submission's
current stage through a Journal Manager or Section Editor group; *recommend-only* = that
assignment carries the "recommend only" restriction; *deciding editor* = a Journal
Manager or Section Editor assigned to the stage **without** the recommend-only
restriction; *unassigned manager* = a Journal Manager (or Site Administrator) with no
stage assignment on the submission at all. Site-wide baselines: a Site Administrator
acts as an unassigned manager on any journal where they hold no assignment; anonymous
users have no access. Decisions are reached from the workflow page's action button
column — the shell that renders it is documented in workflow-stage-navigation. <sup>a</sup>

| Action | Who may — and when |
|--------|--------------------|
| **See decision buttons / record a decision** | • A deciding editor — on the submission's current stage (in review, the buttons appear only on the latest round; ⚠ behind the scenes the recording accepts any round of the submission — API-only, no screen offers it; Known deviations)<br>• An unassigned manager — every decision, on any submission<br>• A Journal Manager or Section Editor assigned to the stage **only** recommend-only — cannot record full decisions (sees recommendation controls instead)<br>• A manager assigned to the submission in a non-editor capacity — ⚠ on the stage(s) that role covers, still sees the full set of decision buttons but every press ends in an error; on every other stage their screen offers nothing to press, yet ⚠ behind the scenes a decision submitted outside the UI is still accepted (API-only — cannot be exercised from any screen; Known deviations)<br>• A Section Editor with no assignment on the submission — cannot open the submission at all <sup>b</sup> |
| **Record a recommendation** | • A recommend-only Journal Manager or Section Editor — in a review stage, and only while at least one deciding editor is assigned to that stage<br>• Without a deciding editor, the controls explain that no recommendation can be made yet <sup>c</sup> |
| **Send for Review while recommend-only** | • A recommend-only editor on the Submission stage — this one full decision is opened to them by design <sup>d</sup> |
| **Return to Workflow / Return to Done** (Done-stage pair) | • Any Journal Manager or Section Editor assigned to the submission on **any** stage — even a recommend-only one ⚠ (the Done stage has no assignments of its own)<br>• An unassigned manager<br>• ⚠ Return to Done only *works* for an unassigned manager — assigned editors are offered the button but their confirmation is refused with a role-access error (Known deviations) <sup>e</sup> |
| **Assistants** | • Never — no decision buttons, and the server refuses them outright <sup>f</sup> |
| **Authors, Reviewers, Readers** | • Never record decisions; authors are recipients of the outcome (email, in-app notification, dashboard status) <sup>f</sup> |
| **See the decision history** | • Journal Managers and Section Editors — decision entries in the submission's activity log. (A complete decision list also exists for integrations and tooling, but it appears on no screen — API-only) <sup>g</sup> |
| **System (no user)** | • The two automatic Done-stage decisions are recorded under the name of whoever published/unpublished. When no user is acting (e.g. a scheduled task publishes), the activity log instead names an automatically chosen journal editor as the recorder — nothing on screen marks the entry as system-recorded <sup>h</sup> |

<sup>a</sup> DecisionHandler (page shell); workflowConfigEditorialOJS.js getActionItems()/getHeaderItems(); useSubmission.js isDecisionAvailable() ·
<sup>b</sup> DecisionAllowedPolicy::effect() (assignment loop skips non-editor groups; unassigned branch requires ROLE_ID_SITE_ADMIN/ROLE_ID_MANAGER; assignments fetched withStageIds([current stage]) — only a current-stage assignment suppresses the fallback); DecisionHandler::__construct() role assignment; PKPSubmissionController route middleware (manager, sub-editor); APP\submission\maps\Schema::getAvailableEditorialDecisions(), PKP…Schema::checkDecisionPermissions(); live-probed 2026-07-16 (unassigned Section Editor: submission GET 401, no workflow content); manager-as-copyeditor, arbitration 2026-07-16: Review stage — enrolled: blinded UI but POST 200 recorded; not-enrolled (seed-only shape): working buttons, POST 200; Copyediting stage — both variants: buttons render, press dead-ends on error page, POST 401 disallowedDecision; latest-round curation UI-only: old-round POST 200 (DecisionStageValidPolicy/validate() require only a round of the submission) ·
<sup>c</sup> DecisionAllowedPolicy::effect() (recommend-only + recommendation); decision\Repository::validate() and DecisionHandler::record() (deciding-editor requirement); WorkflowRecommendOnlyControls.vue (noDecidingEditors message); live-probed 2026-07-16 (guard text shown; direct wizard URL 404) ·
<sup>d</sup> APP\decision\Repository::getDecisionTypesMadeByRecommendingUsers(); DecisionAllowedPolicy::effect(); live-probed 2026-07-16 (recommend-only Section Editor recorded Send for Review end-to-end) ·
<sup>e</sup> DecisionAllowedPolicy::effect() (WORKFLOW_STAGE_ID_DONE branch); APP\…\Schema::getAvailableEditorialDecisions() (Done carve-out); PKPSubmissionController::returnToDone(); live-probed 2026-07-16 (recommend-only assignee recorded Return to Workflow via UI and API; Return to Done 401s for every user with a current-stage assignment — Known deviations) ·
<sup>f</sup> PKPSubmissionController route middleware; DecisionHandler::__construct(); live-probed 2026-07-16 (assigned assistant: zero action buttons, decision POST 401 roleBasedAccessDenied) ·
<sup>g</sup> PKPSubmissionController::getDecisions(); decision\Repository::add() event log ·
<sup>h</sup> ApplyDoneWorkflowStage::handle() (falls back to Repo::submission()->resolveSystemEditorId())

## Fields & validation

Most decisions open a full-page, step-by-step **decision wizard** (breadcrumbs lead
back to the dashboard and the submission). The steps vary by decision; each is one of
three shapes — an email composer, a file-selection list, or a form. The wizard's last
step shows **Record Decision**; leaving early via **Cancel Decision** asks for
confirmation (**Keep Working** to stay). After recording, a completion screen confirms
what happened; reached the normal way from the workflow page it offers a single **View
Submission Summary** button, while a wizard opened from a direct link offers **View
Submission** and **View All Submissions**. The three Done-stage decisions have no
wizard: the manual pair record after a plain confirmation dialog, the automatic ones
record silently. <sup>a</sup>

| Field (UI label) | Required? | Rules |
|------------------|-----------|-------|
| **Notify Authors** (email step) | No — a **Skip this email** link in the composer footer | Recipients are fixed: the authors assigned to the current stage (the step is omitted entirely when there are none). Subject and body prefilled from the decision's email template and editable, per journal language; subject and body are required if the email is sent; skipping sends nothing but still records the decision <sup>b</sup> |
| **Notify Reviewers** (email step) | No — skippable | Recipients are chosen from that round's reviewers who completed their review (for Cancel Review Round: from reviewers still active); at least one recipient required if sent. Each recipient gets a separate copy so reviewers never see one another, with a name placeholder personalized per copy; ⚠ recipient names are shown unmasked in the composer whatever the review method (Known deviations) <sup>c</sup> |
| **Attachments** (inside either email step) | No | Attach by uploading a new file, picking reviewer files from the round, picking submission files from the stages this decision permits, or picking a library file; anything else is rejected <sup>d</sup> |
| **Select Files** (file promotion step) | No | Checkbox lists of the source files appropriate to the decision (e.g. revisions, copyedited files); the main list is pre-checked; a list can be empty when its source holds no files yet (e.g. accepting before any revisions were uploaded); selected files are copied into the destination stage's file area <sup>e</sup> |
| **Request Payment** (form step, OJS only) | Yes when shown | Appears — as the wizard's **first** step — on Accept Submission and Accept and Skip Review when the journal's publication fee is enabled; the editor must choose to request the fee now or waive it <sup>f</sup> |
| **Require New Review Round** (pre-wizard chooser) | Yes | The **Request Revisions** button first opens a dialog (titled after the button) whose "Require New Review Round" radio choice asks whether revisions will (Resubmit for Review) or will not (Request Revisions, pre-selected) go through a new review round; **Next** opens the matching wizard. The same chooser exists for the revisions recommendation <sup>g</sup> |

<sup>a</sup> DecisionHandler::record() state (cancel/keep-working/completed labels); DecisionPage.vue openCompletedDialog (return-URL vs direct-link variants); Steps::getState(); useWorkflowActions.js workflowDecisionReturnToWorkflow()/workflowDecisionReturnToDone() (confirm dialogs); live-probed 2026-07-16 (both completion variants) ·
<sup>b</sup> steps\Email (canSkip default true, isValidStep drops empty-recipient steps); Steps::getStageParticipants(ROLE_ID_AUTHOR); DecisionType::validateEmailAction() (subject/body required); live-probed 2026-07-16 (skip link; skipped email never delivered; decision + activity-log entry still recorded) ·
<sup>c</sup> steps\Email canChangeRecipients(true)/anonymizeRecipients(true) — the anonymize flag has no UI consumer; getRecipientOptions() serializes real full names; per-copy {$recipientName} variable; NotifyReviewers::validateNotifyReviewersAction() (recipients required, must hold an eligible assignment); WithReviewAssignments::getReviewAssignments(); live-probed 2026-07-16 (completed reviewers only; real names in the To chips for anonymous + open methods) ·
<sup>d</sup> DecisionType::validateEmailAction() attachments after-hook; InSubmissionStage/InExternalReviewRound/SendToProduction getAllowedAttachmentFileStages(), getFileAttachers(); live-probed 2026-07-16 (four attacher tabs on Accept's author email) ·
<sup>e</sup> steps\PromoteFiles::addFileList() ($selectedByDefault); live-probed 2026-07-16 (Accept with no revisions → empty list) ·
<sup>f</sup> APP\decision\types\{Accept,SkipExternalReview}::getSteps() (payment step prepended — Steps::addStep($form, true)); RequestPayment::validatePaymentAction(); RequestPaymentDecisionForm; step order live-verified 2026-07-16 (test author) ·
<sup>g</sup> SelectRevisionDecisionForm; SelectRevisionRecommendationForm; WorkflowSelectRevisionFormModal.vue; live-probed 2026-07-16 (decision + recommendation variants route to the matching wizards)

## Rules & state

**The decision catalogue.** Each decision is offered only on one workflow stage (its
*stage guard*) and, within it, only in the states listed. Recording it produces the
state change in the last column.

1. Submission-stage decisions: <sup>a</sup>

   | Decision (button) | Offered while | Result |
   |---|---|---|
   | **Send for Review** | submission active | Moves to the Review stage; round 1 is created (or an existing round's status recalculated); selected files copied to the review files area |
   | **Accept and Skip Review** | submission active | Moves straight to Copyediting; selected files copied to final-draft files; payment step if fee enabled |
   | **Decline Submission** | submission active | Status becomes **Declined**; the submission stays on the Submission stage and moves to the dashboard's Declined list |
   | **Revert Decline** | submission declined | Status returns to active; the normal decision buttons come back |

   The Submission-stage action column also always carries a **Schedule For
   Publication** shortcut that jumps to the publication panel — a navigation button,
   not a decision. It stays even while the submission is declined; the review stage
   shows no such shortcut while declined. <sup>a</sup>

2. Review-stage decisions (offered only on the latest round — older rounds show no
   action buttons; ⚠ the recording itself is not so restricted, rule 8): <sup>b</sup>

   | Decision (button) | Offered while | Result |
   |---|---|---|
   | **Request Revisions** (chooser: revisions without new round) | review active | Round status becomes "Revisions requested" (the round panel reads "Revisions have been requested."); the submission stays in review awaiting the author's files |
   | **Resubmit for Review** (same chooser, second option) | review active | Round status becomes "Resubmit for review" (round panel: "Revisions requested from the author to be taken to a new review round."); a fresh round is *not* created yet — that is the editor's later Create New Review Round |
   | **Accept Submission** | review active | Moves to Copyediting; round status "Accepted"; selected revisions copied to final-draft files |
   | **Create New Review Round** | review active | A new, empty round is added (its panel reads "Waiting for reviewers to be assigned." until reviewers join); selected files carried into it |
   | **Cancel Review Round** | review active, and only while **no** reviewer of the round has confirmed or completed a review | The round and its review assignments are deleted (decisions recorded in that round go with it); the submission returns to the previous round, or to the Submission stage if it was round 1; active reviewers can be notified they are unassigned |
   | **Decline Submission** | review active | Status **Declined**; round status "Declined" (round panel: "Submission declined."); stays on the review stage, in the Declined list |
   | **Revert Decline** | review declined | Status returns to active; the round panel's wording is recomputed from the state of the round's reviews — the expected text per review state is the round-status catalogue owned by review-rounds-and-revisions (a round with no reviewers, for example, reads "Waiting for reviewers to be assigned.") |

3. Copyediting- and Production-stage decisions: <sup>c</sup>

   | Decision (button) | Offered while | Result |
   |---|---|---|
   | **Send To Production** | copyediting | Moves to Production; selected copyedited files copied to production-ready files |
   | **Move to Review** (back from Copyediting) | copyediting | Returns to the Review stage if the submission ever had a review round — otherwise to the Submission stage ⚠ (the button, wizard and author email say "review" either way — Known deviations); the last round is recorded as returned to review, and its panel reads "Returned back to review." — unless the round's own reviewer situation calls for a different notice (a round with no reviewers keeps "Waiting for reviewers to be assigned."); which wording wins is the round-status display rule owned by review-rounds-and-revisions |
   | **Move To Copyediting** (back from Production) | production | Returns to Copyediting |

4. Recommendations (review stage, recommend-only editors): **Recommend Accept**,
   **Recommend Decline**, and **Recommend Revisions** (a chooser between revisions and
   resubmit, like rule 2). Recording one changes nothing about the submission's stage,
   status or round — it notifies the deciding editors (rule 12). <sup>d</sup>

5. Done-stage transitions: <sup>e</sup>

   | Decision | Trigger | Result |
   |---|---|---|
   | **Move to Done** | automatic, when the submission's first Version of Record is published | Stage becomes Done, status Published; the stage it came from is remembered |
   | **Return to Workflow** | button in the workflow-page header while in Done; also automatic when the last published Version of Record is unpublished | Returns to the stage the submission occupied when it entered Done (falls back to Production if that record is missing); status returns to active |
   | **Return to Done** | button in the workflow-page header on any active stage, shown only when the submission has been in Done before | Stage becomes Done again, status Published — ⚠ but confirming it as an assigned editor fails with a role-access error; only an unassigned manager can actually record it (Known deviations) |

6. **One wizard, one engine.** Every button opens the same full-page decision wizard
   (rule-5 manual decisions use a confirm dialog instead); whatever the decision, the
   engine records it the same way: an immutable decision entry (decisions are never
   edited — only Cancel Review Round ever removes them, by deleting the round), an
   activity-log entry naming the editor, then the decision's own effects. <sup>f</sup>

7. **Guards are enforced twice.** The buttons are computed server-side from the
   submission's current stage and status (that is why a declined submission shows
   *only* Revert Decline). The wizard page and the recording call re-check that the
   decision belongs to the submission's current stage — a stale link or a stale tab
   (e.g. a second editor already moved the submission on) is refused with a
   not-found/error response instead of recording. A review-stage decision also
   requires a valid round of that submission. <sup>g</sup>

8. ⚠ **The status and latest-round curation exist only in the button list.** The
   server-side guard checks the stage, not the status and not the round's recency — a
   hand-crafted recording *was accepted* for declining an already-declined submission,
   for sending a declined submission to review, and for a review decision aimed at an
   older round (recorded against that round, with all its normal effects), leaving
   states no UI can produce. No UI path reaches these — verifying this rule requires
   API tooling, not a screen (Known deviations). <sup>h</sup>

9. **Steps are assembled per decision and situation.** The notify-authors step only
   appears when authors are assigned to the stage; the notify-reviewers step only when
   the round has eligible reviewers (so the two revision decisions gain a second,
   Notify Reviewers step whenever the round has completed reviews); the payment step
   only when the journal's publication fee is enabled. Skipping an email step (rule
   Fields) records the decision without sending that email — except the
   recommendation's **Notify Editors** step, which cannot be skipped. <sup>i</sup>

10. **Author notification mechanics.** The email goes to the authors assigned to the
    stage, from the acting editor, in the language the editor chose. When the journal
    is set to notify all authors, every other contributor on the publication receives
    a separate, fixed-template copy carrying the same message. Attaching a reviewer's
    file to a review-stage author email also releases that file to the author — but
    the author can only find it afterwards by opening an **open**-method review from
    their dashboard ("Read Review" → its "Reviewer Files" list); ⚠ for anonymous and
    double-anonymous reviews the released file has no author-facing surface beyond
    the email attachment itself (Known deviations). <sup>j</sup>

11. **Reviewer notification mechanics.** The editor picks which of the round's
    completed reviewers to write to; each recipient is sent a separate copy so
    reviewers never learn who else reviewed, with a name placeholder personalizing
    each copy — ⚠ the composer itself shows every reviewer's real name to the editor,
    whatever the review method (Known deviations). Sending it also marks each
    recipient's review as acknowledged — the review listings then show the reviewer
    as thanked. Cancel Review Round instead writes to the round's still-active
    reviewers using the unassignment email. <sup>k</sup>

12. **Recommendation mechanics.** Recording a recommendation (a) logs it as a
    recommendation, not a decision; (b) sends the mandatory Notify Editors email to
    every deciding editor on the stage; and (c) opens a discussion among those
    deciding editors containing the message (the recommending editor is not a
    participant), with any attachments copied in as discussion files. The
    recommend-only editor then sees their standing recommendation in place
    of the action buttons, with a "Change decision" link to record a new one; how the
    deciding editor consumes recommendations is recommend-only-editors' subject.
    A recommendation cannot be recorded at all — button hidden, server refuses —
    until a deciding editor is assigned to the stage. <sup>l</sup>

13. **Minimum-reviews warning.** When the journal sets a minimum number of confirmed
    reviews, choosing Accept Submission or Create New Review Round below that number
    first asks "Proceed Without Minimum Confirmed Reviews?" — **Yes, Continue** opens
    the wizard, **Cancel** stays on the workflow page with nothing recorded. It is a
    warning shown by the page, not a block. <sup>m</sup>

14. **Stage-entry side effects belong to the engine.** Entering a review stage creates
    round 1 if none exists; entering any stage instantiates that stage's auto-add task
    templates (rule owned by tasks-discussions). Status-flip decisions also refresh
    the copyediting/production status notices (Side effects). <sup>n</sup>

<sup>a</sup> SendExternalReview, APP\…\SkipExternalReview, InitialDecline, RevertInitialDecline (getStageId/getNewStageId/getNewStatus); APP\submission\maps\Schema::getAvailableEditorialDecisions() (declined → revert only); workflowConfigEditorialOJS.js (Schedule For Publication pushed unconditionally on stage 1; Delete gated on a manager-typed group); live-probed 2026-07-16 (button set + styles active and declined; Declined dashboard view; review-stage declined shows no Schedule For Publication) ·
<sup>b</sup> RequestRevisions, Resubmit, APP\…\Accept, NewExternalReviewRound, CancelReviewRound (incl. canRetract(), runAdditionalActions() round deletion), Decline, RevertDecline; workflowConfigEditorialOJS.js (older round → no action items); ReviewRound status constants; live-probed 2026-07-16 (chooser routing; Resubmit leaves a single round, status 2; cancel-round guard both states; round-panel wordings; revert recalculates the round from its reviews; chunk d: round-1 cancel returns to the Submission stage, older-round rail empty, new round panel "Waiting for reviewers to be assigned.") ·
<sup>c</sup> SendToProduction, BackFromCopyediting (getNewStageId() review-round probe; REVIEW_ROUND_STATUS_RETURNED_TO_REVIEW), BackFromProduction; locale editor.submission.decision.backFromCopyediting = "Move to Review"; ReviewRound::determineStatus() (reviewer states take display precedence over status 16); live-probed 2026-07-16 (DB status 16; zero-reviewer round displays "Waiting for reviewers to be assigned.") ·
<sup>d</sup> RecommendAccept/RecommendDecline/RecommendRevisions/RecommendResubmit; IsRecommendation trait; SelectRevisionRecommendationForm; live-probed 2026-07-16 ·
<sup>e</sup> MoveToDone, ReturnToWorkflow (getNewStageId() reads the last into-Done decision's stage; Production fallback), ReturnToDone; ApplyDoneWorkflowStage::handle(); PKPSubmissionController::returnToDone() (refused while already in Done or without Done history); decision\Repository::hasDoneHistory(); live-probed 2026-07-16 (publish → auto Move to Done, no wizard; Return to Workflow confirm dialog → remembered stage; unpublish auto-returns; Return to Done 401s for assigned editors — Known deviations; chunk d: remembered non-Production stage replayed, Production fallback when the into-Done record is missing) ·
<sup>f</sup> decision\Repository::add() (insert, event log, runAdditionalActions, notifications); decision\Repository::validate() ("It is not possible to edit a decision"); PKPSubmissionController::addDecision(); live-probed 2026-07-16 (cancelled round's decisions gone from edit_decisions) ·
<sup>g</sup> APP\…\Schema::getAvailableEditorialDecisions() (isActiveStage + status switches); DecisionStageValidPolicy::effect(); DecisionHandler::record() (stage + review-round 404s); decision\Repository::validate() (stage/round checks); live-probed 2026-07-16 (stale tab: 401 editor.submission.workflowDecision.invalidStage, error dialog, no duplicate row) ·
<sup>h</sup> decision\Repository::validate() (no status check; round check requires only a round of the submission); DecisionWritePolicy (stage-only); DecisionStageValidPolicy; live-probed 2026-07-16 (double decline 200 + duplicate rows; Send for Review on declined 200 → stage review, status declined; old-round POST 200 recorded with the old reviewRoundId, full effects — the old-round Accept moved the submission to Copyediting) ·
<sup>i</sup> DecisionType::getSteps() per type; steps\Email::isValidStep(); IsRecommendation::getSteps() canSkip(false); APP\…\{Accept,SkipExternalReview}::getSteps() payment step; RequestRevisions/Resubmit add Notify Reviewers with completed reviews; live-probed 2026-07-16 (author-less Send for Review shows Select Files only; revision wizards two steps; Notify Editors has no skip control) ·
<sup>j</sup> NotifyAuthors::sendAuthorEmail() (assigned-author recipients, notifyAllAuthors branch, DecisionNotifyOtherAuthors); NotifyAuthors::shareReviewAttachmentFiles() (viewable flag); author panel mounts the reviewer listing only for open-method completed reviews (getOpenAndCompletedReviewAssignmentsForRound); live-probed 2026-07-16 (viewable=1 set; open-method "Read Review" → "Reviewer Files"; anonymous method: no author surface) ·
<sup>k</sup> NotifyReviewers::sendReviewersEmail() (dateAcknowledged/considered updates); CancelReviewRound (ReviewerUnassign mailable, REVIEW_ASSIGNMENT_ACTIVE); steps\Email::getRecipientOptions() (real names; per-copy {$recipientName}); live-probed 2026-07-16 (both completed reviewers thanked, status 9; unmasked To chips; unassign email delivered to the invited reviewer) ·
<sup>l</sup> IsRecommendation::addRecommendationQuery() (discussion + attachments), sendEditorsEmail(); RecommendationNotifyEditors; decision\Repository::add() (SUBMISSION_LOG_EDITOR_RECOMMENDATION); WorkflowRecommendOnlyControls.vue (currentRecommendation, changeDecision); decision\Repository::validate() + DecisionHandler::record() (deciding-editor guard); live-probed 2026-07-16 (email to all deciding editors; discussion participants exclude the recommender; standing panel + "Change decision"; log "recommended…"; attachment copy-through NOT live-probed — code-anchored only) ·
<sup>m</sup> useWorkflowDecisions.js showWarningDialogAboutMinimumReviewsIfEnabled(); context setting numReviewsPerSubmission; live-probed 2026-07-16 (Accept + Create New Review Round, both branches; client-side warning only) ·
<sup>n</sup> DecisionType::runAdditionalActions() (review-round creation, Repo::editorialTask()->autoCreateFromTemplates()); decision\Repository::updateNotifications()

## Side effects

- **Emails.** Each decision has its own author-notification email template (sixteen of
  them, one per decision variant), sent only if the editor doesn't skip the step; the
  optional reviewer email and the co-author copy (rule 10) ride along; a recommendation
  sends the editors' email instead. Author and reviewer decision emails are recorded in
  the submission's email log. <sup>a</sup>
- **In-app notifications.** The assigned authors' decision notification is refreshed on
  every decision: revisions-type decisions (Request Revisions, Resubmit) land at task
  level — the author's Tasks bell — while accept, send-to-review, new-round, decline,
  revert-decline and send-to-production notices are regular bell notifications. The
  author-facing pending-revisions task notice is also recomputed (its lifecycle is
  review-rounds-and-revisions' subject). <sup>b</sup>
- **Event log.** Every decision writes an activity-log entry naming the editor (e.g.
  "accepted this submission and sent it to the copyediting stage"); recommendations are
  logged as recommendations; sending the reviewer email adds its own entry with the
  recipient count and subject. <sup>c</sup>
- **Editing/production status notices.** Accept refreshes the "assign a copyeditor" /
  "awaiting copyedits" notices; Send To Production additionally refreshes the
  production pair. <sup>d</sup>
- **Files.** File-promotion steps copy the selected files into the destination stage's
  file list; attached reviewer files shared with authors become visible on the author
  dashboard (rule 10). <sup>e</sup>
- **Payment (OJS).** Choosing to request the publication fee records a fee as awaiting
  payment behind the scenes — no screen in this feature lists the pending fee; its
  later payment or waiver is the payments feature's subject. What is observable here:
  each assigned author gets a task-level "payment required" notification, and is
  emailed a payment request from the journal's principal contact. <sup>f</sup>
- **Review data.** Cancel Review Round deletes the round, its review assignments and
  that round's recorded decisions; the reviewer thank-you marks reviews acknowledged —
  the reviewer listing then reads "Reviewer Thanked" (rule 11). <sup>g</sup>

<sup>a</sup> Decision*NotifyAuthor mailables (16); DecisionNotifyOtherAuthors; DecisionNotifyReviewer; RecommendationNotifyEditors; NotifyAuthors::sendAuthorEmail() (EDITOR_NOTIFY_AUTHOR email log); NotifyReviewers::sendReviewersEmail() (REVIEW_NOTIFY_REVIEWER / REVIEW_EDIT_NOTIFY_REVIEWER); live-probed 2026-07-16 (co-author fixed-template copy delivered with all-authors, absent with assigned-only) ·
<sup>b</sup> decision\Repository::updateNotifications(); PKPNotificationManager::getNotificationTypeByEditorDecision(); EditorDecisionNotificationManager (PENDING_REVISIONS/RESUBMIT at NOTIFICATION_LEVEL_TASK); NOTIFICATION_TYPE_PENDING_EXTERNAL_REVISIONS; live-probed 2026-07-16 (author's Tasks bell row "Revision required.") ·
<sup>c</sup> decision\Repository::add() (SUBMISSION_LOG_EDITOR_DECISION / _RECOMMENDATION, editorName + per-type log key); NotifyReviewers::sendReviewersEmail() (SUBMISSION_LOG_DECISION_EMAIL_SENT, recipientCount/subject); live-probed 2026-07-16 (decision, recommendation and "email … sent to 2 reviewer(s)" rows in Activity Log; Move to Done logged "moved this submission to the Done stage.") ·
<sup>d</sup> decision\Repository::getSubmissionNotificationTypes() (ACCEPT → copyeditor pair; SEND_TO_PRODUCTION → all four) ·
<sup>e</sup> steps\PromoteFiles; NotifyAuthors::shareReviewAttachmentFiles() ·
<sup>f</sup> APP RequestPayment::requestPayment() (queued payment; NOTIFICATION_TYPE_PAYMENT_REQUIRED task level; PaymentRequest mailable from journal contact) ·
<sup>g</sup> CancelReviewRound::runAdditionalActions(); NotifyReviewers::sendReviewersEmail(); live-probed 2026-07-16 (round row deleted incl. its decisions; REVIEW_ASSIGNMENT_STATUS_THANKED = 9; "Reviewer Thanked" label)

## Settings that modify behavior

- **Notify All Authors** (Settings → Workflow → Emails): when set to all authors,
  decision author-emails are copied to unassigned contributors through the separate
  fixed template (rule 10); when set to assigned authors only, they are not
  (`notifyAllAuthors`). <sup>a</sup>
- **Minimum Confirmed Reviews Required** (Settings → Workflow → Review): a non-zero
  value arms the proceed-without-minimum warning of rule 13
  (`numReviewsPerSubmission`). <sup>b</sup>
- **Article Processing Charge / publication fee** (Payments settings): enabling
  payments with a publication fee adds the Request Payment step to Accept Submission
  and Accept and Skip Review (rule 9). <sup>c</sup>
- **Email templates** (Settings → Workflow → Emails): each decision email step is
  prefilled from its template; a manager's alternate templates registered for that
  email appear as choices in the composer, filtered to the editor's role. <sup>d</sup>
- The recommend-only restriction itself is set when assigning the editor
  (stage-participants); the list of recommendation options offered is
  workflow-settings' subject. No config-file variables alter these rules.

<sup>a</sup> PKPEmailSetupForm (notifyAllAuthors field); NotifyAuthors::sendAuthorEmail(); live-probed 2026-07-16 both ways ·
<sup>b</sup> PKPReviewSetupForm (numReviewsPerSubmission); useWorkflowDecisions.js; live-probed 2026-07-16 ·
<sup>c</sup> OJSPaymentManager::publicationEnabled(); APP\…\{Accept,SkipExternalReview}::getSteps() ·
<sup>d</sup> steps\Email::getEmailTemplates() (alternateTo + isTemplateAccessibleToUser)

## Cross-feature interactions

- **workflow-stage-navigation** — owns the workflow-page shell, stage bubbles and
  routing; this spec owns the decision buttons' availability logic and everything after
  a button is pressed.
- **send-to-review / copyediting-stage / production-stage** — the stage workspaces;
  their transition actions (Send for Review, Accept and Skip Review, desk decline, Send
  To Production, the back-moves) are defined here and referenced there.
- **review-rounds-and-revisions** — owns round anatomy, round status display, the
  author's revision upload and response cycle; the decisions that drive them
  (Request Revisions, Resubmit, Create New Review Round, Cancel Review Round) live
  here.
- **recommend-only-editors** — owns the role behavior around recommendations (how the
  deciding editor sees and acts on them, the recommendations-ready state); the
  recording mechanics (rule 12) live here.
- **assign-and-manage-reviewers** — owns review assignments; this feature reads them
  (eligible reviewer recipients) and mutates them (acknowledged marks, cancel-round
  deletion, unassignment email).
- **tasks-discussions** — stage entry auto-creates task-template items (their rule 21);
  the recommendation discussion created by rule 12 is a discussion item owned there.
- **payments** — owns fee configuration and payment completion; the decision engine
  only queues the request.
- **versioning/publishing** — publishing and unpublishing a Version of Record fires the
  automatic Done-stage decisions (rule 5); the publish flow itself is owned by
  production/versioning.
- **author-dashboard** — how decisions, notifications and shared files surface to the
  author.
- **editorial-dashboards** — the archived/declined lists a decline moves a submission
  into, and the Delete Submission action offered alongside Revert Decline.

## Canonical scenarios

1. **Send a submission to review** — a Journal Manager opens a new submission's
   workflow page and presses **Send for Review**. A full-page wizard opens with two
   steps: *Notify Authors* — an email prefilled from the review-notification template,
   addressed to the submitting author — and *Select Files*, where the submission files
   are listed pre-checked. Pressing **Record Decision** shows a completion message; back
   on the workflow page the submission now sits in the Review stage with Round 1
   created, the chosen files appear in the review files list, and the author has the
   email and a new notification. <sup>s1</sup>
2. **Accept and skip review, with a payment request** — on a journal with a publication
   fee enabled, a Journal Manager presses **Accept and Skip Review** on a
   submission-stage article. The wizard has three steps — *Request Payment* first,
   where the manager chooses to request the fee, then the author email and *Select
   Files*. After recording, the submission is in Copyediting, and the author has a
   payment-request email plus a "payment required" entry in their Tasks bell. <sup>s2</sup>
3. **Desk decline and revert** — a Journal Manager presses **Decline Submission** on the
   Submission stage and sends the decline email. The submission's status shows Declined
   and it moves to the dashboard's Declined list; reopening it, the only decision
   offered is **Revert Decline** (alongside a Delete option for the manager and the
   ever-present Schedule For Publication shortcut). Recording Revert Decline
   restores the active status, and the full button set (Send for Review, Accept and Skip
   Review, Decline Submission) returns. <sup>s3</sup>
4. **Request revisions vs. resubmit** — a Section Editor on a review round with a
   completed review presses **Request Revisions**. A dialog titled "Request Revisions"
   opens; under the heading "Require New Review Round" it offers two radio options —
   revisions **without** a new round (pre-selected), or revisions **subject to** a new
   round. Choosing the first, pressing **Next** and completing the wizard (two steps
   here — the author email, then Notify Reviewers, because the round has a completed
   review) leaves the submission in the same round, whose panel reads "Revisions have
   been requested."; the author gets the request email and a "Revision required." entry
   in their Tasks bell. Running it again with the second option marks the round
   "Resubmit for review" instead — no new round appears yet. <sup>s4</sup>
5. **Accept after review, thank reviewers, share an attachment** — a Section Editor
   presses **Accept Submission** on a round with completed reviews, one of them an
   **open** review. Step 1 is the author email — the editor attaches that reviewer's
   file from the round's review files. Step 2, *Notify Reviewers*, lists the completed
   reviewers to thank. Step 3 selects the revision files. After recording, the
   submission is in Copyediting, the files landed in final drafts, the reviewer row
   reads "Reviewer Thanked", and the author can read the attached reviewer file by
   opening the open review from their dashboard ("Read Review" → "Reviewer
   Files"). <sup>s5</sup>
6. **Decline in review, then revert** — with a submission in review, a Journal Manager
   records **Decline Submission**: the round panel reads "Submission declined." and the
   submission moves to the Declined list still pointing at the review stage. **Revert
   Decline** (the only offer while declined) brings it back active; the round panel's
   wording again reflects the state of the round's reviews — for the exact text to
   expect per review state, follow the round-status catalogue in
   review-rounds-and-revisions (a round still waiting on its reviewers reads "Waiting
   for reviewers to be assigned."). <sup>s6</sup>
7. **Create a new review round** — after a resubmit decision and the author's revised
   file, a Section Editor presses **Create New Review Round**, carries the revision file
   into the new round, and records. A "Round 2" appears, empty of reviewers, its panel
   reading "Waiting for reviewers to be assigned."; the round-1 reviewers are untouched,
   and the author is notified if the email step was sent. <sup>s7</sup>
8. **Cancel a review round — guard and effect** — a Journal Manager adds round 2 and
   assigns a reviewer who has not yet accepted. **Cancel Review Round** is offered; its
   wizard has two steps — the author email, then the unassignment email addressed to
   that reviewer — and recording it deletes round 2 entirely, leaving the submission on
   round 1 again. On a round where a reviewer has already confirmed or completed, the
   Cancel Review Round button is absent. <sup>s8</sup>
9. **Copyediting hand-offs both ways** — from Copyediting, a Journal Manager presses
   **Send To Production**, keeps the pre-checked copyedited file, and records: the
   submission is in Production with the file under production-ready. From Production,
   **Move To Copyediting** returns it. Back in Copyediting, **Move to Review** returns
   it to the review stage with the last round's panel reading "Returned back to
   review." <sup>s9</sup>
10. **Recommend-only editor records a recommendation** — a Section Editor assigned to
    the review stage with "recommend only" sees no Accept/Decline buttons — instead the
    buttons **Recommend Revisions**, **Recommend Accept**, **Recommend Decline**.
    Recording Recommend Accept walks a one-step wizard whose *Notify Editors* email is
    addressed to every deciding editor on the stage and cannot be skipped. Afterwards a
    panel headed "Recommendation" shows the standing recommendation ("Accept
    Submission") with a "Change decision" button; each deciding editor finds the
    recommendation message as a discussion and an email; the activity log says the
    editor "recommended" the outcome. <sup>s10</sup>
11. **Recommendation needs a deciding editor** — on a submission whose review stage has
    *only* the recommend-only editor assigned, the Recommendation panel explains that no
    recommendation can be made until an editor with decision authority is assigned.
    Once a regular Section Editor is added, the recommendation buttons appear. <sup>s11</sup>
12. **Who may record at all** — on the same submission: an Assistant assigned to the
    stage sees no decision buttons; an unassigned Journal Manager sees the full set; a
    Section Editor assigned to the stage sees them; a Section Editor with no assignment
    on the submission cannot open it at all; ⚠ a Journal Manager enrolled and assigned
    as a copyeditor is blinded on the Review stage (the no-access notice, no decision
    buttons), and on the Copyediting stage instead sees the buttons render and every
    press end on an error page (Known deviations). The author's view offers no
    decision controls anywhere. Two companion checks cannot be walked on screen and
    are handed off to API tooling: that the blinded manager's decision is nonetheless
    accepted when submitted outside the UI, and the variant of a manager assigned as
    copyeditor without being enrolled in that group — a shape no assignment screen
    can create (Known deviations). <sup>s12</sup>
13. **The Done round-trip** — publishing a submission's first Version of Record moves it
    to the Done stage automatically (the activity log reads "moved this submission to
    the Done stage" and no wizard is shown). In Done, the header offers **Return to
    Workflow**; confirming returns the submission to the stage it left (Production)
    with active status — and the header now offers **Return to Done**. ⚠ Confirming
    Return to Done as the assigned editor fails with "The current role does not have
    access to this operation."; an unassigned Journal Manager can record it and put the
    submission straight back (Known deviations). Unpublishing the version while in Done
    also returns it to the workflow automatically. <sup>s13</sup>

<sup>s1</sup> seed: any queued submission-stage item in the test journal; author email lands in the mail log; live-probed 2026-07-16 (steps, pre-checked file, completion dialog, round 1 status 6, Files for Review) ·
<sup>s2</sup> requires payments plugin/fee configured (publicationFee > 0); otherwise the step is absent ·
<sup>s3</sup> Delete gating: manager-typed group assigned in any stage, or unassigned manager (workflowConfigEditorialOJS.js hasCurrentUserAtLeastOneAssignedRoleInAnyStage(MANAGER|SITE_ADMIN)); NB the seeded "Journal editor" group is manager-typed; live-probed 2026-07-16 ·
<sup>s4</sup> chooser: WorkflowSelectRevisionFormModal → decision/record with the chosen type; live-probed 2026-07-16 ·
<sup>s5</sup> reviewer must be in a completed-review state; thanked = considered/acknowledged marks; author surface exists only for open-method reviews (Known deviations); live-probed 2026-07-16 ·
<sup>s6</sup> declined-in-review keeps stageId = external review; live-probed 2026-07-16 (round status 5 while declined, recalculated on revert) ·
<sup>s7</sup> NewExternalReviewRound::runAdditionalActions(); live-probed 2026-07-16 (chunk d: round 2 status 6 = REVIEW_ROUND_STATUS_PENDING_REVIEWERS, panel "Waiting for reviewers to be assigned.", round-1 reviewer untouched) ·
<sup>s8</sup> guard: CancelReviewRound::canRetract() (confirmed or completed ⇒ hidden); live-probed 2026-07-16 (both button states; round deleted; unassign email "Request for Review Cancelled") ·
<sup>s9</sup> BackFromCopyediting review-round probe — also see Known deviations for the no-round case; live-probed 2026-07-16 ·
<sup>s10</sup> recommend-only stage assignment; IsRecommendation steps; live-probed 2026-07-16 ·
<sup>s11</sup> editor.submission.recommendation.noDecidingEditors; live-probed 2026-07-16 — seeding NOTE: the test journal auto-assigns section editors at submit, so this state needs a scratch journal without section editors (direct wizard URL then 404s) ·
<sup>s12</sup> DecisionAllowedPolicy; route middleware; live-probed 2026-07-16 (assistant 0 buttons + POST 401; unassigned SE: submission GET 401 — assert no-access, not merely missing buttons); manager-as-copyeditor arbitration 2026-07-16: the enrolled manager+copyeditor is the only UI-reachable variant (AddParticipantForm::validate() requires userInGroup) — blinded on Review yet well-formed POST 200 recorded; a minimal-body POST 4xx is validation (missing reviewRoundId), not authorization ·
<sup>s13</sup> ApplyDoneWorkflowStage; header buttons from getHeaderItems(); live-probed 2026-07-16 (publish/unpublish auto-transitions; Return to Done POST 401 for assigned editors, 200 for unassigned manager)

## Known deviations (as-built ≠ intent)

- ⚠ **Rule 3 — "Move to Review" label can lie** (ledger row 10, evidence completed by
  live probe 2026-07-16). The back-from-copyediting button, wizard heading and author
  email are all labelled "moved to review"
  (`editor.submission.decision.backFromCopyediting`) regardless of target, but
  `BackFromCopyediting::getNewStageId()` returns the Submission stage when the
  submission has no review round (the Accept-and-Skip-Review path). Probed twice: the
  author email said "has been moved to the review stage", the completion dialog dodged
  ("sent back from the copyediting stage"), and the submission landed on the
  Submission stage. Suspected intent: dynamic label or a review-round-aware target.
- ⚠ **Rule 8 — API accepts status- and round-inconsistent decisions** (ledger row 218,
  live-probed 2026-07-16). `Repository::validate()` and `DecisionWritePolicy` check the
  decision's stage guard but never the submission's status, while the button list
  curates by status (declined ⇒ revert only). Probe: POST decline on an already-declined
  submission → 200 with duplicate decline rows; POST Send for Review on a declined
  submission → 200, leaving stage = review with status = Declined, a state no UI path
  produces. The latest-round curation is likewise UI-only:
  `DecisionStageValidPolicy`/`validate()` accept any round belonging to the submission —
  a decision POSTed against round 1 while round 2 was current returned 200, recorded
  with the old reviewRoundId and fired its full effects (the old-round Accept moved the
  submission to Copyediting), so a stale tab / dual-editor race can act through an
  obsolete round. Suspected intent: validation should refuse decisions the state
  machine doesn't offer.
- ⚠ **Manager assigned in a lesser role: two opposite layer mismatches, split by
  stage** (ledger row 219, arbitration re-probe 2026-07-16).
  `DecisionAllowedPolicy::effect()` sees only stage assignments whose user group covers
  the submission's **current** stage, and skips non-editor groups. *On the covered
  stage* (a copyeditor assignment, submission in Copyediting) the assignment suppresses
  the unassigned-manager fallback and every decision POST is refused (401
  disallowedDecision) — yet `Schema::checkDecisionPermissions()` still passes via the
  manager **enrollment** fallback, so the full button set renders and every press
  dead-ends on an error page. This holds whether or not the manager is enrolled in the
  copyeditor group. *On any other stage* (e.g. Review) the assignment is invisible to
  the policy and the manager **can** record decisions (POST 200, decision under their
  name). What the UI shows there depends on enrollment: a manager **enrolled** in the
  copyeditor group — the only shape the Assign Participant form can produce
  (`AddParticipantForm::validate()` requires `userInGroup`) — is blinded (no-access
  sentence, no rail) *while the API still records their decisions*; a manager assigned
  **without** enrollment (seed/API-only) keeps the all-stage manager view and the
  buttons simply work. The actionable defects are the two UI/server disagreements
  (Copyediting: UI offers, server refuses; Review + enrolled: UI blinds, server
  permits); whether the covered-stage denial is intended remains a maintainer question.
- ⚠ **Done-stage decisions open to recommend-only assignees** (ledger row 217,
  live-probed 2026-07-16). The Done-stage branch of `DecisionAllowedPolicy` accepts any
  manager/sub-editor stage assignment on the submission without checking the
  recommend-only flag: a recommend-only Section Editor recorded Return to Workflow from
  Done via UI and via direct POST (200, decision under their name). Return to Done is
  not reachable for them (button hidden; POST 401 — but that is the same 401 every
  assigned editor gets, next row). Likely an oversight in the new Done code.
- ⚠ **Return to Done is refused for exactly its audience — assigned editors** (NEW;
  ledger row 216, live-probed 2026-07-16). The header offers Return to Done to assigned
  editors on every active stage with Done history, but
  `PKPSubmissionController::authorize()` runs `DecisionAllowedPolicy` for
  `returnToDone` with no decision type in the context; for any user holding a
  current-stage **editor** assignment the policy dereferences the null type
  (`$decisionType->getDecision()`) and throws, answered as 401
  roleBasedAccessDenied — the UI shows "The current role does not have access to this
  operation." (A user whose only current-stage assignments are non-editor groups ends
  in the same refusal via the ordinary deny path, without the dereference.) Only
  unassigned managers/admins (who never reach that line) can record it.
- ⚠ **Rule 11 — composer recipient masking doesn't exist** (NEW; ledger row 214,
  live-probed 2026-07-16). The Notify Reviewers "To:" chips show real reviewer names
  for all review methods; the backend's serialized `anonymousRecipients` flag
  (`steps\Email::anonymizeRecipients()`) has no consumer in the UI library. As-built
  anonymity: per-recipient delivery + the `{$recipientName}` variable (stated in the
  step's own description), plus the `allReviewerComments` author-email variable masking
  anonymous reviewers as "Reviewer 1". The spec body now describes the as-built model.
- ⚠ **Rule 10 — shared reviewer file unreachable for anonymous review methods** (NEW;
  ledger row 215, live-probed 2026-07-16). Attaching a reviewer file to the author
  email flips it `viewable = 1` (`NotifyAuthors::shareReviewAttachmentFiles()`), but
  the author-side round panel mounts its reviewer listing only for OPEN completed
  reviews (`getOpenAndCompletedReviewAssignmentsForRound`) — the shared file surfaces
  solely in the open review's "Read Review" modal ("Reviewer Files"). For
  anonymous/double-anonymous reviews (the default review mode) it has no author-facing
  surface beyond the email attachment.
- ⚠ **Auto-recorded decisions bypass validation.** `ApplyDoneWorkflowStage` and
  `PKPSubmissionController::returnToDone()` insert decisions via `Repository::add()`
  directly (no `validate()` pass); `MoveToDone::getStageId()` says Production but the
  listener records whatever stage the submission actually held (live-probed 2026-07-16:
  Move to Done recorded with the true pre-Done stage). Harmless by design
  (the recorded stage is what Return to Workflow later replays) — documenting so a
  verifier doesn't flag the mismatch as a bug.

## Open questions

1. Rule 8 / ledger row 218: should `Repository::validate()` enforce the same status
   and latest-round curation as `getAvailableEditorialDecisions()`
   (decline-while-declined, review-send on declined, decisions against an older round,
   ReturnToDone while declined) — now live-confirmed permissive — or is API
   permissiveness deliberate for imports/tools?
2. Rule 3 / ledger row 10: for a never-reviewed submission, should
   back-from-copyediting be labelled/targeted "Move to Submission" instead of "Move to
   Review"?
3. Done carve-out / ledger row 217: is a recommend-only editor supposed to be able to
   Return to Workflow from Done (live-confirmed they can)? One-sentence answer decides
   whether recommend-only-editors' spec lists it as a capability or a bug.
4. `DecisionAllowedPolicy` permits a non-recommend-only editor to record a
   *recommendation* type via API (UI never offers it; live-confirmed 2026-07-16 — a
   deciding Section Editor's recommendation POST returned 200 and was recorded under
   their name). Should the server refuse recommendations from deciding editors?
5. Intent behind ledger row 219: when a Journal Manager is assigned in a non-editor
   capacity, is losing decision authority the product rule (then the buttons must
   hide, and note the restriction is void on every stage the lesser role's group
   doesn't cover — the policy scopes assignments to the current stage) or should the
   unassigned-manager fallback survive (then the server must allow)? Either answer
   fixes one side of the layer mismatches.

---

<!-- REFERENCE MATERIAL — provenance and campaign bookkeeping, not product-owner
     narrative. The PO-facing "where do I find this" is in Purpose. -->

## Reference — entry points & surfaces

| Entry | Path | Atom |
|-------|------|------|
| Decision wizard page | Workflow page → action button → `{journal}/decision/record/{submissionId}?decision={type}[&reviewRoundId={id}]` (full-page Vue app) | PAGE-decision-record |
| Record a decision (API) | `POST api/v1/submissions/{submissionId}/decisions` — body: decision, actions[] (per-step email/form/file data), reviewRoundId | API-submission-add-decision |
| List decisions (API) | `GET api/v1/submissions/{submissionId}/decisions[?decisionTypes=…]` | API-submission-get-decisions |
| Return to Done (API) | `POST api/v1/submissions/{submissionId}/returnToDone` (bypasses the stage-valid policy by design) | API-submission-return-to-done |
| Action buttons / header buttons | `workflowConfigEditorialOJS.js` getActionItems()/getHeaderItems() per stage; availability from submission prop `availableEditorialDecisions` | — |
| Revisions chooser modals | `WorkflowSelectRevisionFormModal.vue` ← SelectRevisionDecisionForm / SelectRevisionRecommendationForm | FORM-select-revision-decision-form, FORM-select-revision-recommendation-form |
| Automatic Done transitions | `PublicationPublished` / `PublicationUnpublished` events → `ApplyDoneWorkflowStage` listener | — (claimed via db-entities Gaps note) |
| Decision entity | `lib/pkp/schemas/decision.json`; table `edit_decisions` | SCHEMA-decision, DB-edit_decisions |
| Recommend-only panel | `WorkflowRecommendOnlyControls.vue` (action column, review stages) | — |

## Reference — code anchors

- lib/pkp/classes/decision/{Decision,DecisionType,Repository,Steps,Step}.php — constants
  (1–35), the type contract (stage guard, new stage/status/round-status, steps,
  additional actions), recording pipeline (validate → insert → event log →
  runAdditionalActions → DecisionAdded event → notifications)
- lib/pkp/classes/decision/types/*.php + classes/decision/{Repository,types/*}.php —
  the 21 OJS decision types (OJS overrides Accept/SkipExternalReview for APC)
- lib/pkp/classes/decision/types/traits/{NotifyAuthors,NotifyReviewers,IsRecommendation,WithReviewAssignments,InSubmissionStage,InExternalReviewRound}.php; classes/decision/types/traits/RequestPayment.php
- lib/pkp/classes/decision/steps/{Email,Form,PromoteFiles}.php — wizard step state
- lib/pkp/pages/decision/DecisionHandler.php + templates/decision/record.tpl;
  lib/ui-library/src/components/Container/DecisionPage.vue — the wizard page
- lib/pkp/api/v1/submissions/PKPSubmissionController.php — addDecision (:1950),
  getDecisions (:1102), returnToDone (:1988), role middleware (:241)
- lib/pkp/classes/security/authorization/DecisionWritePolicy.php + internal/{DecisionAllowedPolicy,DecisionStageValidPolicy,DecisionTypeRequiredPolicy}.php
- classes/submission/maps/Schema.php getAvailableEditorialDecisions() (:110);
  lib/pkp/classes/submission/maps/Schema.php checkDecisionPermissions() (:1187)
- lib/pkp/classes/observers/listeners/ApplyDoneWorkflowStage.php; lib/pkp/classes/migration/upgrade/v3_6_0/I12799_MovePublishedSubmissionsToDone.php — Done stage
- lib/ui-library/src/pages/workflow/composables/{useWorkflowDecisions.js,useWorkflowActions.js,useWorkflowConfig/workflowConfigEditorialOJS.js}; components/action/WorkflowRecommendOnlyControls.vue
- lib/pkp/classes/notification/PKPNotificationManager.php getNotificationTypeByEditorDecision(); managerDelegate/EditorDecisionNotificationManager.php
