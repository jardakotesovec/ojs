---
name: send-to-review
scope: The Submission stage (stage 1) workspace an editor triages a freshly-submitted manuscript in — the incoming submission files, the pre-review (desk) discussions, the participant list, and the three stage-1 exits (send it into external review, accept-and-skip straight to copyediting, or desk-decline) — before any reviewer exists
shared: pkp-lib          # the stage-1 config, the FileManager/Discussion/Participant managers, the decision engine and the promote-files step all live in lib/pkp + lib/ui-library; OJS overrides the stage-1 pane config (workflowConfigEditorialOJS.js) and the submission schema overlay (schemas/submission.json)
status: verified
e2e-plans: [submission-stage-actions.md]
atlas-claims:
  - SCHEMA-submission-ojs
---

# Send to review (the Submission-stage workspace)

## Purpose

Every manuscript enters the workflow at **stage 1, the Submission stage** — Queued, not
yet in review. This spec owns the **stage-1 workspace** the editor triages it in: the
side-modal pane that opens on the Submission menu item and shows the **incoming
submission files** ("Files uploaded at the time of submission"), a **Desk Review Tasks &
Discussions** panel, the **Participants** list, and — the point of the stage — a decision
action bar offering the **three stage-1 exits**: hand the submission into **external
review**, **Accept and Skip Review** straight to copyediting, or **Decline** it (a desk
reject). It is the "before any reviewer" screen: there is no review round, no reviewer
list and no round-status yet, so the status panel is blank and the editor's job is simply
to read what arrived and choose an exit. The *decisions themselves* — the wizard, the
author email, the stage/status transitions — are owned by `editorial-decisions`; the
*shell* (menu, header, which pane opens) by `workflow-stage-navigation`; this spec owns
what the stage-1 pane is composed of and the stage-1-specific experience of each exit
(including which files carry forward into review).

## Actors & permissions

Baseline (inherited, stated once): opening the workflow modal and seeing the Submission
pane requires **login + Submission-stage access** — computed by
`workflow-stage-navigation` (rule 5): an *unassigned* journal manager or site admin gets
every stage (manager scope); an assigned editor gets the stages configured on the groups
they are assigned with (the default Journal-editor / Section-editor groups include
stage 1). A viewer without stage-1 access sees only "You don't currently have access to
that stage of the workflow." in the pane (`workflow-stage-navigation` rule 4). Authors
never get this editorial pane — they see a read-mostly composition of the same Submission
Files + Discussions on **My Submissions** (owned by `author-dashboard`); reviewers never
reach stage 1 at all. Who may *record* each stage-1 exit is the decision role-gate owned
by `editorial-decisions` (deciding editors + manager scope; recommend-only editors may
finalize only Send for Review); this table is what the stage-1 UI **offers**, verified
against the per-user `availableEditorialDecisions` the backend returns and live-probed on
submission 555. <sup>a</sup>

| Action | Who may — and when |
|--------|--------------------|
| **See the stage-1 workspace** (Submission Files, Desk Review Discussions, Participants) | • Manager scope — any submission in the journal<br>• Assigned editors/assistants — when their assigned group covers stage 1<br>• Authors — a read-mostly Submission Files + Discussions view of their *own* submission on My Submissions (no participants, no action bar; owned by `author-dashboard`) <sup>b</sup> |
| **See / download the incoming submission files** | • Any editorial viewer with stage-1 access — list + Download All<br>• The submission's author(s) — list + Download All of their own files <sup>c</sup> |
| **Add / edit / delete the incoming files** | • Editors, managers, site admins and assistants holding a stage-1 role — Upload, edit (Update File), delete, view notes<br>• **Send to Text Editor** (import a pandoc-convertible file into the Body Text editor) — **journal managers / site admins only**, and only on docx/odt/rtf/tex/md files (never on the arrival PDF)<br>• Authors — may **edit an existing file** (the Update File action) but **not** add new files or delete them after submission (the wizard was their upload window) <sup>c</sup> |
| **Send for Review** (into external review) | • Deciding editors and manager scope — offered whenever the submission is Queued at stage 1<br>• Recommend-only editors — this is the one stage-1 decision they may finalize<br>• Full role-gate in `editorial-decisions` <sup>d</sup> |
| **Accept and Skip Review** (straight to copyediting) | • Deciding editors and manager scope — offered while Queued at stage 1 <sup>d</sup> |
| **Decline Submission** (desk reject) | • Deciding editors and manager scope — offered while Queued at stage 1 (replaced by **Revert Decline** once declined) <sup>d</sup> |
| **Delete the submission** (hard delete) | • Journal managers / site admins **only**, and **only after the submission has been declined** — the Delete button appears in the stage-1 action bar solely when Revert-Decline is available <sup>e</sup> |
| **Schedule For Publication** (shortcut) | • Any viewer who can see the action bar — a always-present button that *navigates* to the publication Title & Abstract tab; it does not itself publish, and publish authority is checked there (`publication-versioning`) <sup>f</sup> |

<sup>a</sup> workflowConfigEditorialOJS `WorkflowConfig[WORKFLOW_STAGE_ID_SUBMISSION]`; maps/Schema.php `getAvailableEditorialDecisions()`/`checkDecisionPermissions()`; live probe 2026-07-03 (sub 555 as dbarnes: `availableEditorialDecisions` = ids 3 Send for Review, 17 Accept and Skip Review, 8 Decline Submission; verifier re-probed 2026-07-03 on a fresh stage-1 sub → ids 3/17/8, each `stageId` 1) ·
<sup>b</sup> `WorkflowConfig[…SUBMISSION].getPrimaryItems/getSecondaryItems`; workflowConfigAuthorOJS `[…SUBMISSION].getPrimaryItems` (FileManager + DiscussionManager only); stage-access from `workflow-stage-navigation` ·
<sup>c</sup> `FileManagerConfigurations.SUBMISSION_FILES` (useFileManagerConfig.js — AUTHOR: FILE_LIST/FILE_EDIT/FILE_DOWNLOAD_ALL; SUB_EDITOR/MANAGER/SITE_ADMIN/ASSISTANT: +FILE_UPLOAD/FILE_DELETE/FILE_SEE_NOTES; **FILE_SEND_TO_EDITOR is granted only to MANAGER/SITE_ADMIN** and only surfaces on `PANDOC_IMPORT_EXTENSIONS` — verifier-probed 2026-07-03: absent on the arrival PDF even for a manager); `getManagerConfig()` filters by the viewer's stage-1 role ·
<sup>d</sup> `getActionItems` (`isDecisionAvailable(submission, DECISION_EXTERNAL_REVIEW / DECISION_SKIP_EXTERNAL_REVIEW / DECISION_INITIAL_DECLINE)`); role-gate + transitions owned by `editorial-decisions` ·
<sup>e</sup> `getActionItems` Delete item guard: `isDecisionAvailable(…REVERT_INITIAL_DECLINE) && hasCurrentUserAtLeastOneAssignedRoleInAnyStage(submission, [ROLE_ID_MANAGER, ROLE_ID_SITE_ADMIN])`. The role check reads `submission.stages[].currentUserAssignedRoles`, which `maps/Schema.php getPropertyStages()` fills with an **unassigned** manager/admin's *global* role on every stage (the global-role fallback, skipped only when that user is an active reviewer of the submission) — so both an assigned manager **and** an unassigned manager-scope admin see Delete, while a non-manager assigned editor does not. Verifier-probed 2026-07-03 on a declined stage-1 sub: unassigned manager dbarnes (not a participant; `currentUserAssignedRoles` = [MANAGER] on every stage via the fallback) **saw** Delete; assigned section editor dbuskins **did not** (matching the retained test's assigned-manager-vs-section-editor split) ·
<sup>f</sup> `getActionItems` first item (`action: 'navigateToMenu'`, `actionArgs: publication_{id}_titleAbstract`)

## Fields & validation

The editor fills no form to *be* in this workspace — the panels each own their forms
(file upload → `submission-files`; discussions → `tasks-discussions`; the decision wizard →
`editorial-decisions`). What matters here is the **intake data the submission carries in**,
the OJS submission-schema overlay (`SCHEMA-submission-ojs`). Only one field is
user-writable, and only at creation:

| Field (UI label) | Required? | Rules | Anchor |
|------------------|-----------|-------|--------|
| **Section** (`sectionId`) | Yes, at submission creation | The journal section the manuscript is submitted to; chosen in the submission wizard's first step and **write-only at create** — after the submission exists, the section is changed by editing the publication, not by re-posting this field. Surfaces at stage 1 as part of the submission's identity | `schemas/submission.json` (`sectionId`: `required`, `writeOnly`); wizard ownership `submission-wizard` |
| **Scheduled in** (`scheduledIn`) | — (read-only) | Set only once the submission is Scheduled for an issue; blank at stage 1 | `schemas/submission.json` (`scheduledIn`: `readOnly`) |
| **Reviewer suggestions** (`reviewerSuggestions`) | — (read-only) | The author's frozen reviewer suggestions, surfaced in the right rail when the feature is on; owned by `reviewer-suggestions` | `schemas/submission.json` (`reviewerSuggestions`: `readOnly`) |
| **Issue to be published in** (`issueToBePublished`) | — (read-only) | The assigned issue label once set; owned by `issue-assignment` | `schemas/submission.json` (`issueToBePublished`) |

`sectionId` is the only field of the overlay this spec is the natural home for; the other
three are read-only display projections whose *behaviour* lives in the specs noted. All
other submission properties (title, abstract, authors, status, stages, publications) are
the shared `SCHEMA-submission-pkp` overlay owned elsewhere.

## Rules & state

Stages by UI name, from `editorial-decisions`: **Submission**(1) · **Review**(external
review, 3) · **Copyediting**(4) · **Production**(5). This spec is entirely about
stage 1, status **Queued**(1) or **Declined**(4). <sup>a</sup>

1. **The stage-1 pane is a fixed composition** (`WorkflowConfig[WORKFLOW_STAGE_ID_SUBMISSION]`).
   The **main column** stacks, in order: a **read-only submission-language** indicator
   (`WorkflowChangeSubmissionLanguage`, `canChangeSubmissionLanguage: false` — language is
   changed from the Publication tab, not here); a **status** panel (rule 2); the
   **Submission Files** grid (rule 3); and the **Desk Review Tasks & Discussions** panel
   (the pre-review discussion thread, `submission.queries.submission`; mechanics owned by
   `tasks-discussions`). The **right rail** shows the **Participants** list (owned by
   `stage-participants`) and — when reviewer suggestions are enabled *and the author
   actually suggested at least one reviewer* — a **Reviewers Suggested by Author** panel
   (owned by `reviewer-suggestions`; the panel self-hides when the suggestion list is
   empty). The **action bar** holds the exits (rules 5–8). Live-probed on sub 555 (dbarnes): headings
   "WORKFLOW: SUBMISSION", "Submission Files", "Desk Review Tasks & Discussions",
   "PARTICIPANTS"; header buttons Activity Log + Library. <sup>b</sup>
2. **The status panel is blank at stage 1 — the "before review" state.** The
   `WorkflowSubmissionStatus` message is computed only for stages that have *started but
   not passed* and are a review or production stage; at stage 1 (not started a future
   stage, not passed, not review/production) it returns **null**, so the panel renders
   nothing. There is no review round, no reviewer list and no round-status to show yet —
   the "no reviewers" state is simply the *absence* of the review-stage panels, not a
   placeholder. (Reviewers, rounds and the round-status summary appear only after Send for
   Review promotes the submission into stage 3 — owned by `assign-and-manage-reviewers` /
   `review-rounds-and-revisions`.) <sup>c</sup>
3. **The incoming files grid is the submission files.** The stage-1 file panel is the
   `FileManager` in the `SUBMISSION_FILES` namespace — file stage
   `SUBMISSION_FILE_SUBMISSION`, titled **Submission Files**, described **"Files uploaded
   at the time of submission"**. Columns: number, File Name, Date Uploaded, **Type**
   (the genre), and a per-row actions menu. Editorial roles (sub-editors, managers, site
   admins, assistants with a stage-1 role) get **Upload**, **Download All Files**, **edit
   metadata**, **delete** and **view notes**; **Send to Text Editor** (importing a
   pandoc-convertible file into the Body Text editor) is narrower — **journal managers /
   site admins only**, and only on pandoc formats (docx/odt/rtf/tex/latex/md/markdown), so
   it never appears on the arrival PDF (verifier-probed 2026-07-03: a manager's per-file
   menu on the seeded PDF offered no Send to Text Editor). Authors get list + Update-File
   (edit an existing file) + Download All only — no upload or delete (rule in Actors). The *general*
   file-grid mechanics (the grid, the
   upload/edit forms, dependent files, notes) are owned by `submission-files` — this spec
   owns only that **stage 1's grid is the arrival files** and what the editor may do with
   them here. Live-probed: sub 555 shows one file, genre **Article Text**, a PDF, with
   Upload + Download All Files. <sup>d</sup>
4. **Every incoming file carries a genre.** The Type column is the file's **genre**
   (Article Text, Data Set, Other, …) — the submission-component taxonomy the author picked
   per file in the wizard, configurable per journal in Settings → Workflow → Components.
   Genre configuration and the genre picker are not owned here (the wizard sets them); the
   stage-1 grid merely surfaces the genre so the editor can see what arrived (verified:
   genreId 1 = "Article Text"). <sup>d</sup>
5. **Send for Review — the primary exit into peer review.** The primary action bar button
   (label "Send for Review") records the **External Review** decision, which moves the
   submission Submission→**Review** and opens **review round 1** (Pending Reviewers). Its
   wizard (owned by `editorial-decisions`) has two stage-1-shaped steps: **Notify Authors**
   (the `DecisionSendExternalReviewNotifyAuthor` email, to which the editor may attach the
   **submission files**), and **Select Files** — a promote-files step whose *source list is
   the stage-1 Submission Files*, copying the ticked ones into the review stage as **review
   files** (`SUBMISSION_FILE_REVIEW_FILE`). So the files that carry forward into review are
   chosen here from what arrived; unticked files stay only as submission files. Offered only
   while the stage-1 decision is available (verified: id 3 present at stage 1). The actual
   copy-into-review is the decision engine's `PromoteFiles` step (identical machinery to the
   Accept promote that `editorial-decisions` drives end-to-end); the stage-1-specific slice —
   that the **Select Files SOURCE is the arrival Submission Files** — is live-verified by the
   retained test (the Send-for-Review wizard is opened to its Select Files step and the
   arrival file is offered, then cancelled without recording). <sup>e</sup>
6. **Accept and Skip Review — bypass peer review.** The secondary "Accept and Skip Review"
   button records the **Skip External Review** decision, which jumps the submission straight
   to **Copyediting** with **no review round created** — for manuscripts an editor accepts
   without external review. When publication payments are fully configured, the OJS override
   adds an **APC request-payment** step to this decision's wizard (owned by `payments`).
   Transition + wizard owned by `editorial-decisions` (verified: id 17 present at
   stage 1). <sup>f</sup>
7. **Decline Submission — the desk reject.** The warnable "Decline Submission" button
   records the **Initial Decline** decision: status → **Declined**, the submission **stays
   at stage 1** (no stage change). Once declined, the action bar swaps: Decline disappears,
   a **Revert Decline** button appears (records Revert Initial Decline → back to Queued at
   stage 1), and — for a manager/site-admin only — a hard **Delete** button appears
   (rule 8). Decline/revert mechanics + the author email owned by `editorial-decisions`
   (verified: id 8 present while Queued). <sup>g</sup>
8. **Delete is gated behind decline.** The stage-1 **Delete** button (a hard
   `WORKFLOW_DELETE_SUBMISSION`, not a decision) renders only when **both** the submission
   is declined *and* the viewer is a journal manager or site admin — the same
   Revert-Decline-availability guard plus a manager/admin role check. A submission cannot be
   deleted from this bar while it is still Queued; the intended path is decline-then-delete.
   The delete action itself is owned by the dashboard/deletion surface. <sup>h</sup>
9. **Schedule For Publication is a navigation shortcut, not an exit.** An always-present
   primary button at stage 1 that jumps the menu to **Publication → Title & Abstract** —
   letting an editor go straight to scheduling/publishing from stage 1 without recording any
   review decision. It records nothing itself; whether the user can actually publish there
   is decided by publish authority (`publication-versioning`). <sup>i</sup>
10. **Entry into this workspace is the SUBMIT event.** A submission reaches stage 1 /
    Queued when the author completes the submission wizard: `Repo::submission()->submit()`
    raises `SubmissionSubmitted`, which writes the **submission-submitted** event-log entry
    (`SUBMISSION_LOG_SUBMISSION_SUBMIT`, `EVLOG-SUBM-SUBMIT`, owned by `submission-wizard`)
    and — when the author left a comment for the editors — auto-creates the stage-1
    Desk-Review discussion. This spec is the *destination* of that event, not its owner.
    (An incomplete draft that never finished the wizard has no `dateSubmitted`; the modal
    can still be deep-linked onto it, a completeness-gate hole owned by
    `workflow-stage-navigation`.) <sup>j</sup>

<sup>a</sup> stage/status constants per `editorial-decisions` (WORKFLOW_STAGE_ID_*, STATUS_QUEUED=1/STATUS_DECLINED=4) ·
<sup>b</sup> workflowConfigEditorialOJS `WorkflowConfig[…SUBMISSION].{getPrimaryItems,getSecondaryItems,getActionItems}` + `common.getPrimaryItems`; locale `submission.queries.submission` ("Desk Review Tasks & Discussions"); live probe 2026-07-03 (sub 555) ·
<sup>c</sup> WorkflowSubmissionStatus.vue (`message` computed → null at stage 1); useSubmission `hasNotSubmissionStartedStage`/`hasSubmissionPassedStage` ·
<sup>d</sup> useFileManagerConfig.js `FileManagerConfigurations.SUBMISSION_FILES` (`fileStage: SUBMISSION_FILE_SUBMISSION`, `titleKey: submission.submit.submissionFiles`, `descriptionKey: fileManager.submissionFilesDescription` = "Files uploaded at the time of submission", columns/actions); live probe (sub 555 files API: fileStage 2, genreId 1 Article Text) ·
<sup>e</sup> SendExternalReview::getSteps() (Email `DecisionSendExternalReviewNotifyAuthor` + `PromoteFiles 'promoteFilesToReview'` → `SUBMISSION_FILE_REVIEW_FILE`, source list `withFilePromotionLists` filtered to `SUBMISSION_FILE_SUBMISSION`; `getAllowedAttachmentFileStages` = SUBMISSION_FILE_SUBMISSION); transition in `editorial-decisions` variant table ·
<sup>f</sup> SkipExternalReview::getSteps() (`parent::getSteps` + `RequestPayment` when `publicationEnabled()`); getNewStageId → Copyediting (`editorial-decisions` rule 5) ·
<sup>g</sup> InitialDecline (getNewStatus STATUS_DECLINED, no stage change); `getActionItems` swaps Decline↔Revert on `DECISION_REVERT_INITIAL_DECLINE` availability; `editorial-decisions` rule 7 ·
<sup>h</sup> `getActionItems` Delete guard (`isDecisionAvailable(…REVERT_INITIAL_DECLINE) && hasCurrentUserAtLeastOneAssignedRoleInAnyStage([ROLE_ID_MANAGER, ROLE_ID_SITE_ADMIN])`); `WorkflowActions.WORKFLOW_DELETE_SUBMISSION` ·
<sup>i</sup> `getActionItems` first item (`navigateToMenu` → `publication_{id}_titleAbstract`) ·
<sup>j</sup> LogSubmissionSubmitted::handle() (`SUBMISSION_LOG_SUBMISSION_SUBMIT`); SubmissionSubmitted event; owned by `submission-wizard`

## Side effects

The stage-1 workspace itself is a **read/triage surface** — opening it, browsing files and
reading discussions send no email, raise no notification and write no event-log entry
(the shell's read-only nature is established in `workflow-stage-navigation`). All side
effects fire from the actions the panels host, each owned elsewhere:

- **Recording a stage-1 exit** (Send for Review / Accept & Skip / Decline) writes the
  editor-decision event-log entry, sends the notify-author email, raises the author-facing
  editor-decision notification, auto-creates the destination stage's template tasks, and —
  on Send for Review — creates review round 1; on Accept & Skip with payments configured,
  queues an APC payment. All owned by `editorial-decisions` (and `payments`).
- **Uploading / editing / deleting an incoming file** mutates the submission file store and
  may write file-level notes — owned by `submission-files`.
- **Posting in Desk Review Discussions** notifies the discussion participants — owned by
  `tasks-discussions`.
- The **submission-submitted** event that lands a submission here (rule 10) is written by
  `submission-wizard`, not by this workspace.

## Settings that modify behavior

- **Reviewer Suggestion at Submission** (`reviewerSuggestionEnabled`, Settings → Workflow →
  Review) — enables the right-rail "Reviewers Suggested by Author" panel on the stage-1
  workspace, which then renders once the author has suggested at least one reviewer
  (`reviewer-suggestions`; verifier-probed 2026-07-03 — the panel appeared on a stage-1 sub
  seeded with an author suggestion). `publicknowledge` has it ON.
- **Publication payments configured** (payments enabled + method + non-zero publication
  fee) — adds the APC request-payment step to Accept and Skip Review, and the header
  Payments dropdown (`payments` / `payments-fees`).
- **Submission components / genres** (Settings → Workflow → Components) — defines the genre
  set shown in the incoming files' Type column.
- **Notify all authors** and the **email templates** for the decisions — modify the exit
  wizards, owned by `editorial-decisions` / `email-templates-management`.
- No setting changes the stage-1 pane composition or the three exits themselves.

## Cross-feature interactions

- **editorial-decisions** — owns the three stage-1 exits' wizards and their
  stage/status/round transitions (Send for Review → Review + round 1; Accept & Skip →
  Copyediting; Initial Decline → Declined; Revert). This spec owns the stage-1 *presentation*
  of those exits and the promote-files source list.
- **workflow-stage-navigation** — owns the shell, the Submission menu item, stage access,
  and the `PAGE-workflow-submission` legacy route; it renders the action bar this spec's
  buttons sit in.
- **submission-files** — owns the general `FileManager` grid, upload/edit forms, dependent
  files and the legacy `GRID-submission-files-*` handlers; this spec owns the stage-1
  `SUBMISSION_FILES` (arrival files) usage only (**seam**, see Open questions).
- **submission-wizard** — owns file upload during submission, `sectionId` capture, and the
  `EVLOG-SUBM-SUBMIT` event that lands a submission at stage 1.
- **tasks-discussions** — owns the Desk Review Tasks & Discussions panel.
- **stage-participants** — owns the Participants panel.
- **reviewer-suggestions** — owns the right-rail reviewer-suggestions panel.
- **assign-and-manage-reviewers / review-rounds-and-revisions** — own everything that
  appears *after* Send for Review (reviewers, rounds, round status).
- **author-dashboard** — owns the author's read-mostly stage-1 view (Submission Files +
  Discussions on My Submissions).
- **publication-versioning** — owns the Schedule For Publication destination and publish
  authority; **payments / payments-fees** — own the APC step on Accept & Skip.

## Canonical scenarios

1. **Editor triages an incoming submission** — an editor opens a freshly-submitted
   manuscript on the Submission pane: the workspace shows the incoming Submission Files
   ("Files uploaded at the time of submission", with genres), the Desk Review Tasks &
   Discussions panel and the Participants list, a blank status area (no reviewers yet), and
   an action bar offering Send for Review / Accept and Skip Review / Decline Submission plus
   a Schedule For Publication shortcut (verified live, sub 555).
2. **Send a submission into external review** — the editor clicks **Send for Review**,
   composes the author email (optionally attaching submission files), and on the **Select
   Files** step ticks which of the arrival files become the review files; recording moves
   the submission to the Review stage and opens round 1 (Pending Reviewers), carrying the
   chosen files forward as review files.
3. **Accept and skip review** — for a manuscript that needs no peer review, the editor picks
   **Accept and Skip Review**: the submission jumps straight to Copyediting with no review
   round, and (when APC payments are configured) an optional payment step is offered.
4. **Desk-decline, then revert or delete** — the editor clicks **Decline Submission**: the
   submission is marked Declined but stays at stage 1; the bar now offers **Revert Decline**
   (back to Queued) and, for a manager, a hard **Delete** — the only path by which a
   submission can be deleted from the stage-1 bar.
5. **Manage the incoming files** — an editor uploads an additional file to the Submission
   Files grid, downloads all files, edits a file's metadata / views its notes, and — if a
   **manager/site-admin** and the file is a docx — uses **Send to Text Editor**; an author
   on the same submission can only list, edit metadata and download, never upload or delete.
6. **Author's stage-1 view** — the author opens their own just-submitted manuscript on My
   Submissions and sees the same Submission Files and Discussions, read-mostly: no
   participant list, no decision action bar, and files they can view/download but not add to
   or remove (owned by `author-dashboard`).
7. **Jump straight to scheduling** — instead of sending to review, the editor clicks
   **Schedule For Publication**, which navigates directly to the Publication → Title &
   Abstract tab (recording no review decision), where publishing is gated by publish
   authority.

## Known deviations (as-built ≠ intent)

None specific to this spec. The stage-1 workspace faithfully reflects the backend
`availableEditorialDecisions`; the two behaviours worth a product-owner eye are recorded as
Open questions (delete-gated-behind-decline; the schedule shortcut bypassing review) rather
than deviations, since both are plausibly intended. Cross-cutting deviations that touch
stage 1 (incomplete-draft modal access, the legacy-route stage-drop) are owned and flagged
by `workflow-stage-navigation`.

## Open questions

1. **`SCHEMA-submission-ojs` ownership (seam).** The atlas hint column pointed this atom at
   `submission-settings`, and `reviewer-suggestions` deferred it. This spec claims it as the
   home for `sectionId` (the intake field), but the overlay is multi-concern —
   `issueToBePublished` behaves under `issue-assignment`, `reviewerSuggestions` under
   `reviewer-suggestions`, `scheduledIn` under scheduling. If grooming prefers a settings/
   wizard home, reassign there and have this spec reference the field. One-owner rule kept;
   flagged for the maintainer.
2. **Files-grid seam with `submission-files` (feature 20, not yet written).** The general
   `FileManager`/`VUE-file-manager` atom and the legacy `GRID-submission-files-*` handlers
   are **left unclaimed** for `submission-files`; this spec documents only stage 1's use of
   the `SUBMISSION_FILES` namespace. Note the current Vue `SUBMISSION_FILES` config carries
   **no `gridComponent`**, so the stage-1 incoming-files grid is served by the Vue FileManager
   + API, not the legacy `SubmissionFilesGridHandler` — `submission-files` should adjudicate
   whether that legacy handler is still live for any stage.
3. **Delete gated behind decline — intended?** A submission can be hard-deleted from the
   stage-1 action bar only after it has been declined (and only by a manager/admin). Is
   "decline first, then delete" the intended lifecycle, and should a never-declined stage-1
   submission be deletable from the workflow at all (versus only from the dashboard)?
4. **Schedule-For-Publication from stage 1.** The shortcut lets an editor route a
   never-reviewed stage-1 submission straight to the publication tab (and, with publish
   authority, publish it) without recording any Accept/Skip decision. Intended fast path, or
   should scheduling require an explicit stage exit first?

---

## Reference — entry points & surfaces

| Entry | Path | Atom |
|-------|------|------|
| Stage-1 workspace (pane) | `/{journal}/dashboard/editorial?workflowSubmissionId={id}&workflowMenuKey=workflow_1` (Submission menu item; shell owned by `workflow-stage-navigation`) | PAGE-workflow-submission *(owned by workflow-stage-navigation — referenced)* |
| Submission entity (intake fields) | `GET/PUT api/v1/submissions/{id}` — OJS schema overlay (`sectionId`, `scheduledIn`, `reviewerSuggestions`, `issueToBePublished`) | SCHEMA-submission-ojs |
| Incoming files | `FileManager` namespace `SUBMISSION_FILES` (`SUBMISSION_FILE_SUBMISSION`); `GET api/v1/submissions/{id}/files?fileStages[]=2` | VUE-file-manager, GRID-submission-files-* *(owned by submission-files — referenced)* |
| Stage-1 exits | Decision action bar buttons → Record-Decision wizard (`editorial-decisions`) | *(decision atoms owned by editorial-decisions)* |
| Arrival event | `SUBMISSION_LOG_SUBMISSION_SUBMIT` when the wizard submits | EVLOG-SUBM-SUBMIT *(owned by submission-wizard — referenced)* |

## Reference — code anchors

- **Stage-1 pane config**: `lib/ui-library/src/pages/workflow/composables/useWorkflowConfig/workflowConfigEditorialOJS.js`
  — `WorkflowConfig[WORKFLOW_STAGE_ID_SUBMISSION].{getPrimaryItems,getSecondaryItems,getActionItems}`
  (files/discussions/participants/exits) + `common.getPrimaryItems` (language + status);
  author variant `workflowConfigAuthorOJS.js`.
- **Incoming files**: `lib/ui-library/src/managers/FileManager/useFileManagerConfig.js`
  (`FileManagerConfigurations.SUBMISSION_FILES`, `getManagerConfig`, columns/actions);
  `FileManager.vue` + `fileManagerStore.js` (owned by `submission-files`).
- **Status / decision availability**: `lib/ui-library/src/pages/workflow/components/primary/WorkflowSubmissionStatus.vue`;
  `lib/ui-library/src/composables/useSubmission.js` (`isDecisionAvailable`,
  `hasNotSubmissionStartedStage`, `hasSubmissionPassedStage`).
- **Exits (decision types)**: `lib/pkp/classes/decision/types/SendExternalReview.php`
  (`getSteps` — Email + `PromoteFiles 'promoteFilesToReview'` from `SUBMISSION_FILE_SUBMISSION`
  → `SUBMISSION_FILE_REVIEW_FILE`); `classes/decision/types/SkipExternalReview.php`
  (OJS `RequestPayment` override); `lib/pkp/classes/decision/types/InitialDecline.php`;
  full engine in `editorial-decisions`.
- **Intake schema**: `schemas/submission.json` (OJS overlay — `sectionId` required/writeOnly,
  `scheduledIn`, `reviewerSuggestions`, `issueToBePublished`).
- **Arrival event**: `lib/pkp/classes/observers/listeners/LogSubmissionSubmitted.php`
  (`SUBMISSION_LOG_SUBMISSION_SUBMIT`).
