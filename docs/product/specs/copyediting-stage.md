---
name: copyediting-stage
scope: The Copyediting stage (stage 4) workspace an editor and copyeditor exchange files in — the Draft Files a copyeditor works from, the Copyedited Files they produce, the copyediting discussions, the participant list (incl. the copyeditor), the assign-a-copyeditor / awaiting-copyedits status prompts, and the two stage-4 exits (Send To Production, Move to Review) — between an Accept and the Production stage
shared: pkp-lib          # the stage-4 pane config, the FileManager/Discussion/Participant managers, the copyedit/final-draft grid handlers, the editing-status notification manager and the copyedit email-log types all live in lib/pkp + lib/ui-library; OJS overrides the stage-4 pane config (workflowConfigEditorialOJS.js) and the decision set (classes/decision/Repository.php)
status: verified
e2e-plans: [copyediting-stage.md]
atlas-claims:
  - GRID-lib-pkp-grid-files-copyedit-copyedit-files-grid-handler
  - GRID-lib-pkp-grid-files-copyedit-manage-copyedit-files-grid-handler
  - GRID-lib-pkp-grid-files-final-final-draft-files-grid-handler
  - GRID-lib-pkp-grid-files-final-manage-final-draft-files-grid-handler
  - NOTIF-copyedit-assignment
  - NOTIF-assign-copyeditor
  - NOTIF-awaiting-copyedits
  - EVLOG-EMAIL-COPY-NOTIFY
  - EVLOG-EMAIL-COPY-AUTH-NOT
  - EVLOG-EMAIL-COPY-FINAL
  - EVLOG-EMAIL-COPY-COMPL
  - EVLOG-EMAIL-COPY-AUTH-COMPL
  - EVLOG-EMAIL-COPY-FINAL-COMPL
  - EVLOG-EMAIL-COPY-ACK
  - EVLOG-EMAIL-COPY-AUTH-ACK
  - EVLOG-EMAIL-COPY-FINAL-ACK
---

# Copyediting stage (the stage-4 workspace)

## Purpose

Once a submission is **accepted** it lands at **stage 4, Copyediting** — Queued, no longer
in review, not yet in production. This spec owns the **copyediting workspace** the editor
and copyeditor share: the side-modal pane that opens on the Copyediting menu item and
stacks a **status prompt** ("Assign a copyeditor" → "Awaiting copyedits" — shown to assigned
editors, and only once seeded by the entry decision; rule 2), a **Draft Files**
grid (the accepted files a copyeditor works *from*), a **Copyediting Tasks & Discussions**
panel, a **Copyedited Files** grid (the cleaned-up files the copyeditor *produces*), and a
**Participants** list that now includes the copyeditor — plus the two stage-4 exits:
**Send To Production** and **Move to Review** (back from copyediting). It is the
"file-exchange" stage: an editor assigns a copyeditor, the copyeditor uploads the copyedited
manuscript, the author is given sight of it to check, and the finished files are handed off
to production. The *decisions themselves* — the Send-To-Production / Move-to-Review wizards
and their stage transitions — are owned by `editorial-decisions`; the *shell* (menu, header,
which pane opens) by `workflow-stage-navigation`; assigning a participant's *mechanics* by
`stage-participants`; this spec owns what the stage-4 pane is composed of, the copyedit file
grids and their file stages, the copyeditor's and author's stage-4 experience, and the
copyedit-specific notifications and email-log entries.

## Actors & permissions

Baseline (inherited, stated once): opening the Copyediting pane requires **login +
copyediting-stage (stage 4) access** — computed by `workflow-stage-navigation` (rule 5): an
*unassigned* journal manager or site admin gets every stage (manager scope); an assigned
editor gets the stages configured on their group (the default Journal-editor / Section-editor
groups include stage 4); a **Copyeditor** assignment (`ROLE_ID_ASSISTANT`) opens **only**
stage 4. Authors never get this editorial pane — they see a read-mostly Copyedited-Files +
Discussions composition on **My Submissions** (owned by `author-dashboard`), which is where
the author-check happens (rule 5). Reviewers never reach stage 4. "**Copyeditor**" below
means any assistant assigned into a stage-4 assistant group. Who may *record* each exit is
the decision role-gate owned by `editorial-decisions` (deciding editors + manager scope);
this table is what the stage-4 UI **offers**, verified against the file-grid permission sets,
the per-user `availableEditorialDecisions` the backend returns, and **browser-driven as every
role** on live copyediting submissions (an assigned editor, a manager-scope unassigned editor,
an assigned copyeditor, an unassigned copyeditor, an author, a reviewer). <sup>a</sup>

| Action | Who may — and when |
|--------|--------------------|
| **See the copyediting workspace** (Draft Files, Copyediting Discussions, Copyedited Files, Participants; the status prompt is **editor-only and conditionally seeded** — rule 2) | • Manager scope — any submission in the journal (workspace renders; **no status prompt** unless the user also holds a stage-4 assignment — verified live)<br>• Assigned editors — when their group covers stage 4 (the status prompt renders for these users only)<br>• Copyeditors — when assigned into a stage-4 assistant group (Participants panel is **read-only** — no Assign; **no decision action bar**; no status prompt; owned by `stage-participants`)<br>• Authors — a read-mostly **Copyedited Files (list) + Discussions** view of their *own* submission on My Submissions (no Draft Files, no participants, no action bar)<br>• Copyeditors **not assigned** to the submission — blocked ("The current role does not have access to this operation"); **reviewers — denied at the page level** (`user.authorization.roleBasedAccessDenied`) <sup>b</sup> |
| **See / download the Draft Files** (the accepted files to be copyedited) | • Editors, managers, site admins and **copyeditors** with stage-4 access — list + upload + edit + delete + view notes<br>• **Authors — never see this grid** (no author permission on Draft Files) <sup>c</sup> |
| **Upload / edit / delete Copyedited Files** | • Editors, managers, site admins and **copyeditors** — Upload, Select (from prior stages), edit metadata, delete, view notes<br>• **Send to Text Editor** (import a pandoc file into the Body Text editor) — **journal managers / site admins only**<br>• **Authors — view/list only** (they may open the copyedited files but not add, edit or delete them) — the author-check <sup>d</sup> |
| **Select files from prior stages into Copyedited Files** | • Editors, managers, site admins and copyeditors — the "Select Files" grid copies existing submission/draft files into the copyedited file stage<br>• Authors — never <sup>e</sup> |
| **Assign a copyeditor** (add a Copyeditor participant) | • Panel administrators (managers, site admins, assigned section editors) — via the **Participants → Assign** modal; mechanics + the picker's per-stage role list owned by `stage-participants`<br>• Copyeditors / authors — never <sup>f</sup> |
| **Request the copyedit** (notify the copyeditor with the "Request Copyedit" message) | • Anyone who can see the Participants panel — the row **Notify** action; picking the **Request Copyedit** template raises the copyeditor's task notification + writes the copyedit email-log entry (rule 6) <sup>g</sup> |
| **Send To Production** (hand off to production) | • Deciding editors and manager scope — offered whenever the submission is at stage 4 (verified live: decision id 7)<br>• Full role-gate + wizard in `editorial-decisions` <sup>h</sup> |
| **Move to Review** (back from copyediting) | • Deciding editors and manager scope — the warnable exit that returns the submission toward review/submission (verified live: decision id 30) <sup>h</sup> |

<sup>a</sup> workflowConfigEditorialOJS `WorkflowConfig[WORKFLOW_STAGE_ID_EDITING]`; useFileManagerConfig `FileManagerConfigurations.{COPYEDITED_FILES,FINAL_DRAFT_FILES}` (`getManagerConfig` gates each action on `hasCurrentUserAtLeastOneAssignedRoleInStage`); maps/Schema.php `getAvailableEditorialDecisions()`; **browser-driven live 2026-07-03** on seeded stage-4 subs 418 (skip→copyediting), 419 (accept→copyediting) and 420 (accept + copyeditor mfritz, assigned silently): assigned SE dbuskins → full workspace + `Send To Production`/`Move to Review`; manager-scope-but-unassigned dbarnes → full workspace, **no status prompt**; assigned copyeditor mfritz → full workspace, Participants read-only (no Assign), **no action bar**, no status prompt; unassigned copyeditor svogt → "current role does not have access" error; author atester (My Submissions) → Copyedited Files list-only + Discussions, no Draft Files/Participants/action bar; reviewer jjanssen → `authorizationDenied` ·
<sup>b</sup> `WorkflowConfig[…EDITING].getPrimaryItems/getSecondaryItems`; workflowConfigAuthorOJS `[…EDITING].getPrimaryItems` (DiscussionManager + COPYEDITED_FILES only); stage-access from `workflow-stage-navigation` rule 5 ·
<sup>c</sup> `FileManagerConfigurations.FINAL_DRAFT_FILES` (SUB_EDITOR/MANAGER/SITE_ADMIN/ASSISTANT → FILE_LIST/SELECT_UPLOAD/EDIT/DELETE/SEE_NOTES; MANAGER/SITE_ADMIN also FILE_SEND_TO_EDITOR; **no `ROLE_ID_AUTHOR` entry**) ·
<sup>d</sup> `FileManagerConfigurations.COPYEDITED_FILES` (AUTHOR → **FILE_LIST only**; SUB_EDITOR/MANAGER/SITE_ADMIN/ASSISTANT → +SELECT_UPLOAD/EDIT/DELETE/SEE_NOTES; FILE_SEND_TO_EDITOR = MANAGER/SITE_ADMIN); `CopyeditFilesGridHandler::initialize()` grants EDIT|MANAGE|VIEW_NOTES|DELETE capabilities to non-author roles only ("Authors may also view this grid, and shouldn't be able to do anything (just view)") ·
<sup>e</sup> `COPYEDITED_FILES_SELECT` (FILE_SELECT, editorial+assistant roles); `CopyeditFilesGridHandler::selectFiles()` → `ManageCopyeditFilesForm`; `ManageCopyeditFilesGridHandler` ·
<sup>f</sup> `ParticipantManager` Assign gate owned by `stage-participants` (Copyediting-stage role list includes Copyeditor); copyeditors get the panel read-only ·
<sup>g</sup> `PKPStageParticipantNotifyForm::sendMessage()` `case 'COPYEDIT_REQUEST'` → `_addAssignmentTaskNotification(NOTIFICATION_TYPE_COPYEDIT_ASSIGNMENT)` + `logMailable(COPYEDIT_NOTIFY_COPYEDITOR)` ·
<sup>h</sup> `getActionItems` (`isDecisionAvailable(submission, DECISION_SEND_TO_PRODUCTION / DECISION_BACK_FROM_COPYEDITING)`); role-gate + transitions owned by `editorial-decisions` (variant table rows Send To Production / Move to Review)

## Fields & validation

The editor and copyeditor fill no form to *be* in this workspace — the panels each own their
forms (file upload → `submission-files`; discussions → `tasks-discussions`; the exit wizards →
`editorial-decisions`; the assign/notify modal → `stage-participants`). What is stage-4-specific
is **which file stage** an upload/selection lands in:

| Field (UI label) | Required? | Rules | Anchor |
|------------------|-----------|-------|--------|
| **Type** (genre/component) on a copyedit/draft upload | Yes | The submission-component taxonomy (Article Text, Data Set, …) the uploader picks per file; the same genre set as every other stage, configured per journal in Settings → Workflow → Components; the general upload form is owned by `submission-files` | `useFileManagerConfig` `getFileGenres`; `submission-files` |
| **Copyedited Files** upload target | — (system-set) | Every file uploaded to (or selected into) the Copyedited Files grid is forced to file stage **Copyedited** (`SUBMISSION_FILE_COPYEDIT`), regardless of the source | `FileManagerConfigurations.COPYEDITED_FILES.fileStage`; `ManageCopyeditFilesForm::execute()` (forces `SUBMISSION_FILE_COPYEDIT`) |
| **Draft Files** upload target | — (system-set) | Files in the Draft Files grid are file stage **Draft** (`SUBMISSION_FILE_FINAL`); populated by an Accept-from-review promotion or a manual upload | `FileManagerConfigurations.FINAL_DRAFT_FILES.fileStage` (`SUBMISSION_FILE_FINAL`) |
| **Select Files** (the manage/select grid) | No | Ticking prior-stage files copies them into the Copyedited file stage; a copyeditor may build the copyedited set from existing files instead of a fresh upload | `ManageCopyeditFilesGridHandler` (`addFile`/`deleteFile`/`updateCopyeditFiles`) |

## Rules & state

Stages by UI name, from `editorial-decisions`: **Submission**(1) · **Review**(3) ·
**Copyediting**(editing, 4) · **Production**(5). This spec is entirely about stage 4, status
**Queued**(1). <sup>a</sup>

1. **The stage-4 pane is a fixed composition** (`WorkflowConfig[WORKFLOW_STAGE_ID_EDITING]`).
   The **main column** stacks, in order: a **status prompt** (`WorkflowNotificationDisplay`,
   rendered *only when a status notification has been seeded* — **not** an unconditional part
   of the pane; rule 2); the **Draft Files** grid (rule 3); a **Copyediting Tasks &
   Discussions** panel (`DiscussionManager`, `submission.queries.editorial` = "Copyediting
   Tasks & Discussions"; mechanics owned by `tasks-discussions`); and the **Copyedited Files**
   grid (rule 4). The **right rail** shows
   the **Participants** list (owned by `stage-participants`), which at this stage offers the
   **Copyeditor** role in its Assign picker. The **action bar** holds the two exits (rule 6).
   Browser-driven on subs 418/419/420 (stage 4, status Queued): the file grids, discussion
   panel, participants and exits render for every editorial role; the status prompt renders on
   419/420 (accept path) but is **absent on 418** (skip path — rule 2). <sup>b</sup>
2. ⚠ **The status prompt is a stored, decision-seeded notification — not an always-on part of
   the pane.** When present it drives the "assign a copyeditor → awaiting copyedits → done"
   cycle: an inline status card computed for the submission's **assigned stage-4 editors**
   (users holding a MANAGER/SUB_EDITOR *stage assignment* — a manager-scope editor merely
   *viewing* an unassigned submission gets **no** card; verified live) by
   `PKPEditingProductionStatusNotificationManager`. The card reads **"Assign a copyeditor using
   the Assign link in the Participants list."** (`NOTIFICATION_TYPE_ASSIGN_COPYEDITOR`) while
   **no copyediting discussion exists** and no copyedited file exists; the instant a
   **copyediting discussion** exists it flips to **"Awaiting Copyedits."**
   (`NOTIFICATION_TYPE_AWAITING_COPYEDITS`); and **both clear** the instant **at least one
   Copyedited file** exists. These are level-NORMAL notifications surfaced *inline in the
   workspace* (not the bell). **But the notification is only ever created/updated when a
   recompute runs, and the entry decision only triggers that recompute for `ACCEPT` and
   `SEND_TO_PRODUCTION` — `decision/Repository::getSubmissionNotificationTypes()` returns the
   copyedit types for those two decisions only, and `[]` for `SKIP_EXTERNAL_REVIEW`.** So a
   submission that reached copyediting via **Accept and Skip Review** lands with **no status
   prompt at all** (verified live: accept sub 419 shows the "Assign a copyeditor" card, the
   otherwise-identical skip sub 418 shows none; opening the skip sub does not create it — the
   notification is not inserted on page load). Two consequences worth flagging (Known
   deviations / Open questions): (i) the skip-review path never nudges the editor to assign a
   copyeditor (asymmetry with the accept path); (ii) the manager keys "a copyeditor is working
   on it" off the **existence of any stage-4 discussion**, not off a Copyeditor
   *stage-assignment* — so a copyeditor assigned **silently** (no notify/discussion) leaves the
   editor still reading "Assign a copyeditor" even though one is assigned (verified live on sub
   420: Maria Fritz assigned as Copyeditor, no discussion → both assigned editors still hold
   the ASSIGN_COPYEDITOR card). Once seeded, the card is recomputed on the relevant later
   changes — a participant **removal**, a discussion open, a copyedit-file add/delete, a notify;
   note that *adding* a participant does **not** recompute the copyedit prompt
   (`StageParticipantGridHandler::saveParticipant` recomputes only the decision-stage
   notifications, and only for a MANAGER add) (rule 7 / Open question 3). <sup>c</sup>
3. **The Draft Files grid is the accepted files to be copyedited.** The first file panel is
   the `FileManager` in the `FINAL_DRAFT_FILES` namespace — file stage **Draft**
   (`SUBMISSION_FILE_FINAL`), titled **"Draft Files"**, described **"These are files from the
   review stage which are to be copyedited"** (grid `FinalDraftFilesGridHandler`). It is
   populated by the **Accept** decision, which promotes the review-revision files into this
   stage (`editorial-decisions` rule 6, `SUBMISSION_FILE_REVIEW_REVISION` →
   `SUBMISSION_FILE_FINAL`); a submission that reached copyediting via **Accept and Skip
   Review** carries **no** Draft Files (its files stay as submission files — verified live on
   skip sub 418: one file at file stage 2 `SUBMISSION_FILE_SUBMISSION`, none at Draft; the pane's
   Draft Files grid reads "No Items"), so on that path the editor/copyeditor uploads
   or selects the source manuscript here. Editors, managers, site admins and copyeditors get
   Upload / Select / edit / delete / view-notes; **authors have no access to this grid**. The
   Draft Files grid-handler atoms (`FinalDraftFilesGridHandler` + its select-grid) are **owned
   here** — the seam the FEATURE-MAP hinted to `production-stage` is resolved to copyediting, since
   the panel renders only in this stage (production-stage rule 3 / Open question 1). <sup>d</sup>
4. **The Copyedited Files grid is the copyeditor's output, bound for production.** The second
   file panel is the `FileManager` in the `COPYEDITED_FILES` namespace — file stage
   **Copyedited** (`SUBMISSION_FILE_COPYEDIT`), titled **"Copyedited Files"**, described
   **"These are edited files that will be taken to the production stage"** (grid
   `CopyeditFilesGridHandler`). The copyeditor (an assistant) **uploads** the cleaned-up
   manuscript here, or uses **Select Files** to pull an existing file into the copyedited
   stage (`ManageCopyeditFilesGridHandler` / `ManageCopyeditFilesForm`, which forces the
   copyedited file stage). Every editorial role and the copyeditor may upload/edit/delete;
   the author gets **list-only** (rule 5). These are the files **Send To Production** promotes
   (rule 6). <sup>e</sup>
5. **The author-check is list-and-discuss, not an approval gate.** An author opening their own
   submission at copyediting on **My Submissions** sees a two-panel read-mostly composition:
   the **Copyediting Discussions** and the **Copyedited Files** grid — the latter **list-only**
   (the author may open/download the copyedited files but cannot add, edit, delete or select
   them; the grid handler withholds the edit/manage/delete capabilities from authors "just
   view"). The author does **not** see the Draft Files, the Participants list or any action
   bar. There is no formal author-sign-off state in 3.6 copyediting — the "author check" is
   the author's *visibility* of the copyedited files plus participation in the copyediting
   discussion an editor/copyeditor opens to ask them to review (owned by `tasks-discussions`).
   The author composition itself is owned by `author-dashboard`; this spec owns the
   copyedited-files permission that makes the check possible. <sup>f</sup>
6. **Two exits, both owned by `editorial-decisions`.** The action bar offers **Send To
   Production** (primary) and **Move to Review** (warnable), each rendered only while its
   decision is available (verified live: ids 7 and 30 at stage 4). **Send To Production**
   moves Copyediting→Production; its wizard notifies the author
   (`DecisionSendToProductionNotifyAuthor`) and runs a **promote-files** step whose source
   lists are the **Copyedited** files (pre-selected) and the **Draft** files (offered,
   not pre-selected), copying the ticked ones into the production stage as **production-ready
   files** (`SUBMISSION_FILE_PRODUCTION_READY`). **Move to Review** (Back from Copyediting)
   returns the submission to the **Submission** stage, or to **Review** if a review round
   already exists (stamping that round *Returned To Review*). The transition machine, the
   role-gate and the wizards are `editorial-decisions`; this spec owns only that these are the
   stage-4 exits and that the copyedited files are the production hand-off source. <sup>g</sup>
7. **Assigning a copyeditor is a participant assignment with a copyedit-specific notify.**
   Adding a **Copyeditor** is done through the Participants → Assign modal (mechanics,
   picker, silent-vs-notified add all owned by `stage-participants`; the Copyediting-stage
   picker offers the Copyeditor role). The **copyedit-specific slice** is the notify template:
   the stage's default discussion mailable is **`DiscussionCopyediting`**
   (`DISCUSSION_NOTIFICATION_COPYEDITING`), and the picker also offers the retained alternate
   **"Request Copyedit"** (`COPYEDIT_REQUEST`). Which one the editor picks changes the side
   effects (rule 8). Assigning grants the copyeditor stage-4 access (owned by
   `stage-participants` / `workflow-stage-navigation`; verified there that a Copyeditor
   assignment opens only Copyediting). <sup>h</sup>
8. **The copyedit task-notification + email-log fire only when "Request Copyedit" is chosen.**
   `PKPStageParticipantNotifyForm::sendMessage()` keys a `switch($templateKey)`: only the
   **`case 'COPYEDIT_REQUEST'`** branch creates the copyeditor's task notification
   (`NOTIFICATION_TYPE_COPYEDIT_ASSIGNMENT`, level TASK) and writes the
   **`COPYEDIT_NOTIFY_COPYEDITOR`** email-log entry. If the editor keeps the **default**
   `DiscussionCopyediting` template, the branch is not entered — the notify falls to the
   generic path (a `NEW_QUERY` discussion notification + a `DISCUSSION_NOTIFY` email-log
   entry, owned by `tasks-discussions`), and **no** copyedit-assignment notification is
   raised. So `NOTIF-copyedit-assignment` and `EVLOG-EMAIL-COPY-NOTIFY` are reachable, but
   **only on the non-default template choice**. (Contrast the sibling `EDITOR_ASSIGN` branch,
   which is fully dead because that template was *renamed* into stage variants —
   `stage-participants` rule 8; `COPYEDIT_REQUEST` was instead *retained as an alternate*, so
   this branch survives.) <sup>i</sup>
9. **Most of the copyedit email-log corpus is dead legacy.** Of the nine `COPYEDIT_NOTIFY_*`
   submission email-log types, only **`COPYEDIT_NOTIFY_COPYEDITOR`** is written by any live
   path (rule 8). **`COPYEDIT_NOTIFY_AUTHOR`** is referenced only as a *display filter* (the
   email-log tab groups author-facing copyediting emails) and is never written; the remaining
   seven (`_FINAL`, `_COMPLETE`, `_AUTHOR_COMPLETE`, `_FINAL_COMPLETE`, `_ACKNOWLEDGE`,
   `_AUTHOR_ACKNOWLEDGE`, `_FINAL_ACKNOWLEDGE`) have **zero** references — remnants of the
   OJS-2 copyediting sub-workflow (copyeditor/author/final rounds with acknowledge steps) that
   3.x replaced with discussions. Claimed here so the copyedit email-log corpus has one owner;
   the eight unwritten types are dead-code candidates (Known deviations). <sup>j</sup>

<sup>a</sup> constants per `editorial-decisions` (WORKFLOW_STAGE_ID_EDITING=4, STATUS_QUEUED=1) ·
<sup>b</sup> workflowConfigEditorialOJS `WorkflowConfig[…EDITING].{getPrimaryItems,getSecondaryItems,getActionItems}`; locale `submission.queries.editorial` ("Copyediting Tasks & Discussions"); browser-driven 2026-07-03 (subs 418/419/420) ·
<sup>c</sup> WorkflowNotificationDisplay.vue (`getRequestOptionsPerStage(EDITING)` → NORMAL: ASSIGN_COPYEDITOR + AWAITING_COPYEDITS; renders the cards); locale `notification.type.assignCopyeditors` = "Assign a copyeditor using the Assign link in the Participants list.", `notification.type.awaitingCopyedits` = "Awaiting Copyedits."; PKPEditingProductionStatusNotificationManager::updateNotification() (loops **stage assignments** with `Role::ROLE_ID_MANAGER`/`ROLE_ID_SUB_EDITOR` only; EDITING branch: `countCopyeditedFiles` → clear both; else editing-stage `EditorialTask` exists → AWAITING_COPYEDITS; else ASSIGN_COPYEDITOR); **seed gate** `decision/Repository::getSubmissionNotificationTypes()` (returns the copyedit types for `Decision::ACCEPT` + `Decision::SEND_TO_PRODUCTION` only — no `SKIP_EXTERNAL_REVIEW` case) via `updateNotifications()`; other recompute callers submissionFile/Repository.php (copyedit-file add/delete), StageParticipantGridHandler (participant remove / notify), EditorialTaskController (discussion create), PKPStageParticipantNotifyForm, ManageCopyeditFilesGridHandler; live 2026-07-03 — DB `notifications` rows: accept sub 419 = ASSIGN_COPYEDITOR for both assigned SEs, skip sub 418 = none, sub 420 (copyeditor assigned, no discussion) = still ASSIGN_COPYEDITOR; browser-confirmed the rendered cards on 419/420 and their absence on 418; **the flip is live** — opening a stage-4 discussion on 419 (edit_task at `stage_id`=4) flipped both editors' rows to AWAITING_COPYEDITS and the card re-rendered "Awaiting Copyedits." (incidental: a discussion requires ≥2 participants — owned by `tasks-discussions`) ·
<sup>d</sup> `FileManagerConfigurations.FINAL_DRAFT_FILES` (`fileStage: SUBMISSION_FILE_FINAL`, `titleKey: submission.finalDraft` = "Draft Files", `descriptionKey: fileManager.draftFilesDescription`, `gridComponent: grid.files.final.FinalDraftFilesGridHandler`); Accept promotion in `editorial-decisions` rule 6; live probe (skip sub 418 has no Draft file — browser grid "No Items") ·
<sup>e</sup> `FileManagerConfigurations.COPYEDITED_FILES` (`fileStage: SUBMISSION_FILE_COPYEDIT`, `titleKey: fileManager.copyeditedFiles` = "Copyedited Files", `descriptionKey: fileManager.copyeditedFilesDescription`, `gridComponent: grid.files.copyedit.CopyeditFilesGridHandler`); `CopyeditFilesGridHandler` (`setTitle('submission.copyedited')`, author fetch-only); `ManageCopyeditFilesForm::execute()` ·
<sup>f</sup> workflowConfigAuthorOJS `[…EDITING].getPrimaryItems` (DiscussionManager + COPYEDITED_FILES); `COPYEDITED_FILES` AUTHOR=FILE_LIST; `CopyeditFilesGridHandler::initialize()` (capabilities to non-authors only); `author-dashboard` ·
<sup>g</sup> `getActionItems` (`isDecisionAvailable` SEND_TO_PRODUCTION / BACK_FROM_COPYEDITING); SendToProduction::getSteps() (Email `DecisionSendToProductionNotifyAuthor` + `PromoteFiles 'promoteFilesToProduction'` → `SUBMISSION_FILE_PRODUCTION_READY`, source lists `SUBMISSION_FILE_COPYEDIT` [selected] + `SUBMISSION_FILE_FINAL` [not]); BackFromCopyediting::getNewStageId() (Review if a round exists, else Submission); `editorial-decisions` variant table ·
<sup>h</sup> `stage-participants` (Assign modal, Copyediting-stage role list, notify-vs-silent); StageMailable::getStageMailable(WORKFLOW_STAGE_ID_EDITING) → `DiscussionCopyediting`; registry/emailTemplates.xml (`COPYEDIT_REQUEST` `alternateTo="DISCUSSION_NOTIFICATION_COPYEDITING"`) ·
<sup>i</sup> PKPStageParticipantNotifyForm::sendMessage() (`switch($templateKey)` case 'COPYEDIT_REQUEST' → `_addAssignmentTaskNotification` + `logMailable(COPYEDIT_NOTIFY_COPYEDITOR)`; default → `DISCUSSION_NOTIFY`); I5716_EmailTemplateAssignments `mapIncludedAlternateTemplates` (COPYEDIT_REQUEST retained); contrast `stage-participants` rule 8 (EDITOR_ASSIGN renamed → dead) ·
<sup>j</sup> SubmissionEmailLogEventType (COPYEDIT_NOTIFY_* 0x50000001–09); grep 2026-07-03: `COPYEDIT_NOTIFY_COPYEDITOR` 1 writer (PKPStageParticipantNotifyForm), `COPYEDIT_NOTIFY_AUTHOR` 1 ref (PKPEmailController display filter), other 7 zero refs

## Side effects

The copyediting workspace itself is a **read/exchange surface** — opening it, browsing files
and reading discussions send no email, raise no notification and write no event-log entry.
Side effects fire from the actions the panels host:

- **Requesting the copyedit with the "Request Copyedit" template** (Participants → Notify)
  creates the copyeditor's **task notification** (`NOTIFICATION_TYPE_COPYEDIT_ASSIGNMENT`,
  level TASK), sends the copyedit-request email, and writes the **`COPYEDIT_NOTIFY_COPYEDITOR`**
  submission email-log entry (rule 8). With the **default** discussion template no copyedit
  notification is raised — a `NEW_QUERY` + `DISCUSSION_NOTIFY` fire instead (owned by
  `tasks-discussions`).
- **The editor status prompt** — the prompt is *seeded* by an Accept / Send-To-Production
  decision (never by Skip Review — rule 2); thereafter **removing** a copyeditor participant,
  opening a copyediting discussion, notifying, or adding/deleting a copyedited file recomputes
  the `ASSIGN_COPYEDITOR` / `AWAITING_COPYEDITS` inline notifications for the assigned editors
  (rule 2). *Adding* a participant does not recompute them.
- **Recording Send To Production** notifies the author (`DecisionSendToProductionNotifyAuthor`,
  raising the author-facing send-to-production editor-decision notification), promotes the
  ticked copyedited/draft files into production, auto-creates the production stage's template
  tasks, and writes the decision event-log entry — all owned by `editorial-decisions`.
  **Recording Move to Review** notifies the author with **`DecisionBackFromCopyeditingNotifyAuthor`**
  (`MAIL-decision-back-from-copyediting-notify-author`, template `EDITOR_DECISION_BACK_FROM_COPYEDITING`)
  and moves the stage back — mailable + transition owned by `editorial-decisions`.
- **Uploading / editing / selecting a copyedit or draft file** mutates the submission file
  store — owned by `submission-files`.
- **Posting in Copyediting Discussions** notifies the discussion participants — owned by
  `tasks-discussions`.
- **The eight legacy `COPYEDIT_NOTIFY_*` email-log types** beyond `COPYEDIT_NOTIFY_COPYEDITOR`
  are never written (rule 9).

## Settings that modify behavior

- **User-group stage configuration** (Settings → Users & Roles): which assistant groups cover
  stage 4 (default: Copyeditor → Copyediting), and therefore who can be assigned as a
  copyeditor and gain stage-4 access (owned by `workflow-stage-navigation` / `stage-participants`).
- **Submission components / genres** (Settings → Workflow → Components): the genre set shown in
  the Type column of the copyedit/draft uploads (owned by `submission-files` / workflow settings).
- **Email templates** (Settings → Workflow → Emails): enabling/disabling the **Request Copyedit**
  alternate changes whether the copyedit-request template is offered in the notify picker
  (which in turn gates the copyedit task notification, rule 8); the exit-decision templates
  modify the Send-To-Production / Move-to-Review wizards (owned by `editorial-decisions` /
  `email-templates-management`).
- No setting changes the stage-4 pane composition or the two exits themselves.

## Cross-feature interactions

- **editorial-decisions** — owns the stage-4 exits' wizards and transitions (Send To
  Production → Production + file promotion; Move to Review / Back from Copyediting → Submission
  or Review) and the `DecisionBackFromCopyeditingNotifyAuthor` mailable; this spec owns the
  stage-4 *presentation* of those exits and the copyedited-files hand-off source.
- **workflow-stage-navigation** — owns the shell, the Copyediting menu item, stage-4 access,
  and the `PAGE-workflow-editorial` legacy route (referenced, not claimed).
- **stage-participants** — owns the Participants panel, the Assign/Notify modal, the
  Copyediting-stage role picker (which offers Copyeditor), and the access an assignment grants;
  this spec owns the copyedit-specific notify template + its task notification.
- **submission-files** — owns the general `FileManager` grid, upload/edit/select forms and
  dependent files; this spec owns the stage-4 `COPYEDITED_FILES` / `FINAL_DRAFT_FILES` usage
  and file stages.
- **production-stage** — owns the production workspace; the Send-To-Production promotion carries
  this stage's Copyedited + Draft files into the Production Ready Files grid. The
  `GRID-final-draft` grid-handler atoms are owned **here** (the Draft Files panel renders only in
  copyediting — seam resolved by production-stage Open question 1).
- **tasks-discussions** — owns the Copyediting Discussions panel, the generic-template notify
  path, and the `NEW_QUERY` notification.
- **author-dashboard** — owns the author's read-mostly stage-4 composition (Copyedited Files +
  Discussions on My Submissions) that hosts the author-check.
- **email-delivery / email-templates-management / notifications** — own email delivery, the
  templates the notify picker offers, and the notification inbox.

## Canonical scenarios

1. **Editor opens the copyediting workspace** — an editor opens an **accepted** manuscript on
   the Copyediting pane: the workspace shows an "Assign a copyeditor using the Assign link in
   the Participants list." status prompt, a **Draft Files** grid (the accepted files to be
   copyedited), a **Copyediting Discussions** panel, a **Copyedited Files** grid, a
   **Participants** list (with a Copyeditor-capable Assign picker), and an action bar offering
   **Send To Production** and **Move to Review** (browser-verified, sub 419). **On the
   skip-review path (sub 418) the workspace is identical but carries no status prompt** — the
   "Assign a copyeditor" nudge is seeded only by an Accept/Send-To-Production decision (rule 2).
2. **Assign a copyeditor and request the copyedit** — the editor opens Participants → Assign,
   picks a **Copyeditor**, and notifies them with the **Request Copyedit** template: the
   copyeditor gains stage-4 access, receives a copyedit-request email + a task notification,
   and the editor's status prompt flips from "Assign a copyeditor" to "Awaiting copyedits".
   (Keeping the *default* discussion template instead opens a plain discussion with no
   copyedit task notification — rule 8.)
3. **The copyedited-files exchange** — the copyeditor opens the Copyedited Files grid and
   **uploads** the cleaned-up manuscript (or uses **Select Files** to pull a draft file into
   the copyedited stage); once a copyedited file exists, the editor's "Awaiting copyedits"
   prompt clears.
4. **The author checks the copyedited files** — the author opens their own submission at
   copyediting on My Submissions and sees the **Copyedited Files** (list/download) and the
   **Copyediting Discussions**, read-mostly: no Draft Files, no participants, no action bar,
   and files they can view but not upload, edit or delete (the author-check).
5. **Send to production** — the editor clicks **Send To Production**, composes the author
   email, and on the promote-files step ticks the **Copyedited** files (and optionally the
   **Draft** files); recording moves the submission to Production, carrying the chosen files
   forward as production-ready files (decision owned by `editorial-decisions`).
6. **Move back from copyediting** — instead of sending to production, the editor clicks the
   warnable **Move to Review**, returning the submission to the Submission stage (or to Review
   if a review round exists) and emailing the author the back-from-copyediting notice (decision
   owned by `editorial-decisions`).
7. **Permission boundary** (all browser-verified on sub 420) — a copyeditor opens the same
   submission: the Copyediting pane fully renders and they can Upload/Select copyedited and
   draft files, but the Participants panel is read-only (no Assign), there is **no decision
   action bar**, and no status prompt; an author sees only the copyedited-files list +
   discussions; an assistant **not assigned** to the submission is blocked ("The current role
   does not have access to this operation"); a reviewer is **denied at the page level**
   (`roleBasedAccessDenied`); a manager-scope editor who is not a stage-4 assignee sees the full
   workspace but no status prompt (owned by `stage-participants` / `workflow-stage-navigation`).

## Known deviations (as-built ≠ intent)

- ⚠ **The "Assign a copyeditor" status prompt never appears on the skip-review path, and does
  not track the actual copyeditor assignment.** The prompt is a stored notification seeded only
  by the recompute that the entry decision triggers, and `decision/Repository::getSubmissionNotificationTypes()`
  emits the copyedit notification types for `Decision::ACCEPT` and `Decision::SEND_TO_PRODUCTION`
  **but not `Decision::SKIP_EXTERNAL_REVIEW`** — so a submission that reaches Copyediting via
  **Accept and Skip Review** lands with no "Assign a copyeditor" nudge at all, while an
  otherwise-identical Accept-from-review submission gets it (verified live: skip sub 418 has no
  card, accept sub 419 does; the notification is not created on page load). Compounding this, the
  manager keys "a copyeditor is on it" off the existence of any stage-4 **discussion**, not off a
  Copyeditor *stage-assignment*, so a copyeditor added **silently** leaves the editor still
  reading "Assign a copyeditor" (verified live: sub 420). Both are edge-case UI-affordance
  inconsistencies (the prompt is missing where it should nudge, and stale where it shouldn't);
  no data is lost. Both are in the e2e ledger: the skip-path omission is
  `docs/e2e/app-changes.md` §2 **row 8** (already recorded by the wave-4 copyediting test), and
  the discussion-key staleness is **row 82** (Open question 3). Suspected intent:
  `SKIP_EXTERNAL_REVIEW` should be in the seed switch alongside `ACCEPT`, and/or the prompt
  should key off the Copyeditor assignment rather than a discussion.
- ⚠ **Eight of the nine copyedit email-log types are never written (dead legacy).** Only
  `COPYEDIT_NOTIFY_COPYEDITOR` has a live writer; `COPYEDIT_NOTIFY_AUTHOR` survives only in a
  display filter, and `_FINAL / _COMPLETE / _AUTHOR_COMPLETE / _FINAL_COMPLETE / _ACKNOWLEDGE /
  _AUTHOR_ACKNOWLEDGE / _FINAL_ACKNOWLEDGE` have no references (rule 9). They are remnants of
  the OJS-2 copyediting sub-workflow (copyeditor→author→final rounds with acknowledge steps)
  that 3.x replaced with the discussion-driven exchange. Recorded in `UNASSIGNED.md`
  §Dead-code candidates (the campaign's home for unreachable code — verified there 2026-07-03).
  Suspected intent: the corpus should be pruned to the one type still emitted (plus the author
  display filter).
- **The copyedit task notification is template-conditional, not a plain oddity.** That
  `NOTIF-copyedit-assignment` fires only when the editor picks the non-default **Request
  Copyedit** template (rule 8) is as-built and internally consistent (the same
  template-keyed `switch` that the sibling `EDITOR_ASSIGN` case sits in); unlike
  `EDITOR_ASSIGN`, `COPYEDIT_REQUEST` was retained, so this branch is *reachable*, not dead.
  Whether an editor who assigns a copyeditor with the default template *should* still generate
  the copyedit assignment task is a product call — Open question 2, not a hard deviation.
- **The `ASSIGN_COPYEDITOR` / `AWAITING_COPYEDITS` "reads-as-a-task-but-NORMAL-level" atlas
  note is not a UI defect here.** Both are requested at NORMAL level by
  `WorkflowNotificationDisplay` and rendered as **inline status cards** in the workspace (not
  as bell/task items), which is their intended surface (rule 2). Left as an Open question, not
  a deviation.

## Open questions

1. **`GRID-final-draft` ownership (seam) — resolved to copyediting.** The **Draft Files** panel
   (`FINAL_DRAFT_FILES` / `FinalDraftFilesGridHandler`, and its `ManageFinalDraftFilesGridHandler`
   select-grid) renders **only** in the copyediting stage — the production-stage pane has no
   final-draft grid (`workflowConfigEditorialOJS` `WORKFLOW_STAGE_ID_PRODUCTION` exposes only
   `PRODUCTION_READY_FILES`). The production-stage spec (its Open question 1) therefore reassigned
   both `final` grid atoms **here**, and this spec now claims them. Flagged for the maintainer in
   case the FEATURE-MAP's original production hint was intentional.
2. **Copyedit task notification on the default template.** As-built, assigning a copyeditor
   raises the `COPYEDIT_ASSIGNMENT` task only when the editor picks the **Request Copyedit**
   template (rule 8). Is it intended that assigning with the default `DiscussionCopyediting`
   template creates a plain discussion with no copyedit-assignment task, or should the task be
   raised on any copyeditor assignment?
3. **The "Assign a copyeditor" prompt is decision-seeded and discussion-keyed, not
   assignment-tracking (confirmed live; ⚠ Known deviations).** Two intertwined behaviours (rule
   2): (a) the prompt is created only by an `ACCEPT`/`SEND_TO_PRODUCTION` recompute, so
   **skip→copyediting submissions never show it** (verified: sub 418 vs 419); (b) it flips to
   "Awaiting Copyedits" on the existence of a stage-4 **discussion**, not on a **Copyeditor
   stage-assignment**, so a silently-assigned copyeditor leaves the editor still reading "Assign
   a copyeditor" (verified: sub 420). The developers equate the two (code comment: "If a
   copyeditor is assigned i.e. there is a copyediting discussion"). Intended proxy + intended
   skip-path silence, or should `SKIP_EXTERNAL_REVIEW` join the seed switch and the prompt track
   the actual Copyeditor assignment? (Ledger `docs/e2e/app-changes.md` §2 rows 8 + 82.)
4. **No formal author-approval state in copyediting.** The author-check (rule 5) is
   list-visibility + discussion, with no explicit author sign-off gate before Send To
   Production. Is a discussion-based check the intended model, or should copyediting carry an
   author-approval step as production's proof-approval does?

---

## Reference — entry points & surfaces

| Entry | Path | Atom |
|-------|------|------|
| Copyediting workspace (pane) | `/{journal}/dashboard/editorial?workflowSubmissionId={id}&workflowMenuKey=workflow_4` (Copyediting menu item; shell owned by `workflow-stage-navigation`) | PAGE-workflow-editorial *(owned by workflow-stage-navigation — referenced)* |
| Copyedited Files grid | `FileManager` namespace `COPYEDITED_FILES` (`SUBMISSION_FILE_COPYEDIT`); legacy `grid.files.copyedit.CopyeditFilesGridHandler` | GRID-lib-pkp-grid-files-copyedit-copyedit-files-grid-handler |
| Copyedited Files "Select Files" | `grid.files.copyedit.ManageCopyeditFilesGridHandler` (`addFile`/`downloadFile`/`deleteFile`/`updateCopyeditFiles`) → `ManageCopyeditFilesForm` | GRID-lib-pkp-grid-files-copyedit-manage-copyedit-files-grid-handler |
| Draft Files grid | `FileManager` namespace `FINAL_DRAFT_FILES` (`SUBMISSION_FILE_FINAL`); `grid.files.final.FinalDraftFilesGridHandler` (+ `ManageFinalDraftFilesGridHandler` select-grid) | GRID-lib-pkp-grid-files-final-final-draft-files-grid-handler, GRID-lib-pkp-grid-files-final-manage-final-draft-files-grid-handler *(owned here — seam resolved from production-stage)* |
| Editor status prompt (assigned editors only; seeded by Accept/Send-To-Production, **absent on skip** — rule 2) | `POST notification/fetchNotification` (NORMAL: ASSIGN_COPYEDITOR + AWAITING_COPYEDITS), rendered by `WorkflowNotificationDisplay` | NOTIF-assign-copyeditor, NOTIF-awaiting-copyedits |
| Copyeditor task notification | `NOTIFICATION_TYPE_COPYEDIT_ASSIGNMENT` (level TASK) via Participants → Notify "Request Copyedit" | NOTIF-copyedit-assignment |
| Copyedit email-log types | `SubmissionEmailLogEventType::COPYEDIT_NOTIFY_*` (only `_COPYEDITOR` written) | EVLOG-EMAIL-COPY-* |
| Stage-4 exits | Decision action bar → Record-Decision wizard (`editorial-decisions`) | *(decision atoms owned by editorial-decisions)* |

## Reference — code anchors

- **Stage-4 pane config**: `lib/ui-library/src/pages/workflow/composables/useWorkflowConfig/workflowConfigEditorialOJS.js`
  — `WorkflowConfig[WORKFLOW_STAGE_ID_EDITING].{getPrimaryItems,getSecondaryItems,getActionItems}`
  (status prompt / Draft Files / discussions / Copyedited Files / participants / exits);
  author variant `workflowConfigAuthorOJS.js` (`[…EDITING]` → DiscussionManager + COPYEDITED_FILES).
- **File managers**: `lib/ui-library/src/managers/FileManager/useFileManagerConfig.js`
  (`FileManagerConfigurations.{COPYEDITED_FILES,COPYEDITED_FILES_SELECT,FINAL_DRAFT_FILES}` —
  file stages, per-role permission sets, `gridComponent`).
- **Grid handlers**: `lib/pkp/controllers/grid/files/copyedit/CopyeditFilesGridHandler.php`
  (author fetch-only, `selectFiles`), `.../ManageCopyeditFilesGridHandler.php` +
  `.../form/ManageCopyeditFilesForm.php` (`execute()` forces `SUBMISSION_FILE_COPYEDIT`);
  `lib/pkp/controllers/grid/files/final/FinalDraftFilesGridHandler.php` (Draft Files, owned by
  production-stage).
- **Status notifications**: `lib/ui-library/src/pages/workflow/components/primary/WorkflowNotificationDisplay.vue`
  (`getRequestOptionsPerStage(EDITING)`); `lib/pkp/classes/notification/managerDelegate/PKPEditingProductionStatusNotificationManager.php`
  (`updateNotification` EDITING branch, `_createNotification`/`_removeNotification`);
  `lib/pkp/classes/notification/Notification.php` (`NOTIFICATION_TYPE_ASSIGN_COPYEDITOR`=0x1000023,
  `_AWAITING_COPYEDITS`=0x1000024, `_COPYEDIT_ASSIGNMENT`).
- **Copyedit notify / email log**: `lib/pkp/controllers/grid/users/stageParticipant/form/PKPStageParticipantNotifyForm.php`
  (`sendMessage()` `case 'COPYEDIT_REQUEST'`); `lib/pkp/classes/log/SubmissionEmailLogEventType.php`
  (COPYEDIT_NOTIFY_* corpus); `registry/emailTemplates.xml` (`COPYEDIT_REQUEST` alternateTo
  `DISCUSSION_NOTIFICATION_COPYEDITING`); `lib/pkp/classes/migration/upgrade/v3_4_0/I5716_EmailTemplateAssignments.php`
  (`mapIncludedAlternateTemplates`).
- **Exits**: `lib/pkp/classes/decision/types/SendToProduction.php` (`getSteps` — Email +
  `PromoteFiles 'promoteFilesToProduction'` → `SUBMISSION_FILE_PRODUCTION_READY` from
  COPYEDIT/FINAL); `.../BackFromCopyediting.php` (`getNewStageId`); OJS decision set
  `classes/submission/maps/Schema.php` `getAvailableEditorialDecisions()` (EDITING → SendToProduction +
  BackFromCopyediting); full engine in `editorial-decisions`.
