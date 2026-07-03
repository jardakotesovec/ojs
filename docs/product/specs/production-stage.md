---
name: production-stage
scope: The Production stage (stage 5) workspace an editor and layout editor exchange files in — the Production Ready Files that came from copyediting, the production discussions, the participant list (incl. the layout editor), the assign-a-production-user / awaiting-galleys status prompts, and the two stage-5 exits (Schedule For Publication as a navigation handoff, and the warnable Move To Copyediting) — between the Send-To-Production handoff and publication
shared: pkp-lib          # the stage-5 pane config, the FileManager/Discussion/Participant managers, the editing/production status-notification manager and the layout/proof/index email-log types all live in lib/pkp + lib/ui-library; OJS overrides the stage-5 pane config (workflowConfigEditorialOJS.js, isOJS() notification branch), the decision set (classes/submission/maps/Schema.php) and hosts the galley grid (controllers/grid/articleGalleys)
status: verified
e2e-plans: []
atlas-claims:
  - GRID-lib-pkp-grid-files-production-ready-production-ready-files-grid-handler
  - GRID-lib-pkp-grid-files-proof-manage-proof-files-grid-handler
  - NOTIF-assign-productionuser
  - NOTIF-awaiting-representations
  - NOTIF-layout-assignment
  - NOTIF-index-assignment
  - NOTIF-format-needs-approved-submission
  - EVLOG-EMAIL-LAYOUT-ED-NOT
  - EVLOG-EMAIL-LAYOUT-ED-THANK
  - EVLOG-EMAIL-LAYOUT-COMPL
  - EVLOG-EMAIL-PROOF-AUTH-NOT
  - EVLOG-EMAIL-PROOF-AUTH-COMPL
  - EVLOG-EMAIL-PROOF-AUTH-THANK
  - EVLOG-EMAIL-PROOF-PROOF-NOT
  - EVLOG-EMAIL-PROOF-PROOF-COMPL
  - EVLOG-EMAIL-PROOF-PROOF-THANK
  - EVLOG-EMAIL-PROOF-LAYOUT-NOT
  - EVLOG-EMAIL-PROOF-LAYOUT-COMPL
  - EVLOG-EMAIL-PROOF-LAYOUT-THANK
  - EVLOG-EMAIL-INDEX-NOT
  - EVLOG-EMAIL-INDEX-COMPL
---

# Production stage (the stage-5 workspace)

## Purpose

Once an editor records **Send To Production** the submission lands at **stage 5, Production** —
Queued, out of copyediting, not yet published. This spec owns the **production workspace** the
editor and layout editor share: the side-modal pane that opens on the Production menu item and
stacks a **status prompt** ("Assign a user to create galleys" → "Awaiting Galleys" — shown to
assigned editors, and only once seeded by the Send-To-Production decision; rule 2), a
**Production Ready Files** grid (the copyedited/draft files carried forward from copyediting,
the layout editor turns into galleys), and a **Production Tasks & Discussions** panel — plus a
**Participants** list that now includes the **layout editor**, and an action bar with two exits:
**Schedule For Publication** (a navigation shortcut to the Publication tab, not a decision) and
the warnable **Move To Copyediting** (Back from Production). It is the "make-the-galleys" stage:
an editor assigns a layout editor, the layout editor builds the reader-facing galleys, and once a
galley exists the article is ready to schedule/publish. **Galleys themselves are created and
edited on the Publication → Galleys tab, not in this pane** — galley CRUD and proofing mechanics
are owned by `galleys` (feature 26); this spec owns the *production-stage view* of that milestone
(the "Awaiting Galleys" prompt that clears when a galley exists) and the production file
exchange. The *decisions* (Move To Copyediting, and the Send-To-Production that lands the
submission here) are owned by `editorial-decisions`; the *shell* (menu, header, which pane opens)
by `workflow-stage-navigation`; assigning a participant's *mechanics* by `stage-participants`;
the publish/schedule flow itself by `publication-publish-flow`.

## Actors & permissions

Baseline (inherited, stated once): opening the Production pane requires **login +
production-stage (stage 5) access** — computed by `workflow-stage-navigation`: an *unassigned*
journal manager or site admin gets every stage (manager scope); an assigned editor gets the
stages configured on their group (the default Journal-editor / Section-editor groups include
stage 5); a **Layout Editor** or **Indexer** assignment (`ROLE_ID_ASSISTANT`) opens **only**
stage 5. Authors never get this editorial pane — they see a **Production Tasks & Discussions**-only
view of their *own* submission on **My Submissions** (owned by `author-dashboard`; there is no
production-file or participant panel for authors). Reviewers never reach stage 5. "**Layout
editor**" below means any assistant assigned into a stage-5 assistant group (the default OJS
stage-5 groups are **Layout Editor** and **Indexer**). Who may *record* the exit decision is the
role-gate owned by `editorial-decisions` (deciding editors + manager scope); this table is what
the stage-5 UI **offers**, verified against the file-grid permission sets and the per-user
`availableEditorialDecisions`, and **browser-driven** on live production submissions (an assigned
editor and an assigned layout editor). <sup>a</sup>

| Action | Who may — and when |
|--------|--------------------|
| **See the production workspace** (Production Ready Files, Production Discussions, Participants; the status prompt is **editor-only and conditionally seeded** — rule 2) | • Manager scope — any submission in the journal (workspace renders; **no status prompt** unless the user also holds a stage-5 editor assignment)<br>• Assigned editors — when their group covers stage 5 (the status prompt renders for these users only)<br>• Layout editors / indexers — when assigned into a stage-5 assistant group (Participants panel is **read-only** — no Assign; **no decision** in the action bar; no status prompt; owned by `stage-participants`)<br>• Authors — a **Production Discussions**-only view of their *own* submission on My Submissions (no production files, no participants, no action bar)<br>• Assistants **not assigned** to the submission — blocked; reviewers — denied at the page level <sup>b</sup> |
| **See / download / manage the Production Ready Files** (the files bound for galley creation) | • Editors, managers, site admins and **layout editors/indexers** with stage-5 access — list + Upload + Download All + Select (from prior stages) + edit + delete + view notes<br>• **Send to Text Editor** (import a pandoc file into the Body Text editor) — **journal managers / site admins only**<br>• **Authors — no access to this grid at all** (no author entry in the production-ready permission set — not even list) <sup>c</sup> |
| **Assign a layout editor** (add a Layout Editor / Indexer participant) | • Panel administrators (managers, site admins, assigned section editors) — via **Participants → Assign**; mechanics + the per-stage role list owned by `stage-participants` (the Production-stage picker offers Layout Editor and Indexer)<br>• Layout editors / authors — never <sup>d</sup> |
| **Request production** (notify the layout editor with the "Ready for Production" message) | • Anyone who can see the Participants panel — the row **Notify** action; picking the **Ready for Production** (`LAYOUT_REQUEST`) template raises the layout editor's task notification + writes the layout email-log entry (rule 6) <sup>e</sup> |
| **Create / proof galleys** (the production milestone) | • Editors, managers, site admins and **layout editors** — on the **Publication → Galleys** tab (Add Galley, upload the galley/proof file); **galley CRUD + proofing owned by `galleys` feature 26**, not this pane<br>• Authors — view-only on the reader side (no galley editing) <sup>f</sup> |
| **Move To Copyediting** (Back from Production, the only stage-5 decision) | • Deciding editors and manager scope — the warnable exit that returns the submission to Copyediting; offered whenever the submission is at stage 5 (verified live: decision id 29)<br>• Full role-gate + wizard in `editorial-decisions` <sup>g</sup> |
| **Schedule For Publication** (navigation shortcut, not a decision) | • Any viewer who can see the action bar — an always-present button that *navigates* to the Publication → Title & Abstract tab; it records nothing, and whether the user can actually schedule/publish is decided there (`publication-publish-flow`). Verified live: shown to the assigned editor **and** to the layout editor <sup>h</sup> |

<sup>a</sup> workflowConfigEditorialOJS `WorkflowConfig[WORKFLOW_STAGE_ID_PRODUCTION]`; useFileManagerConfig `FileManagerConfigurations.{PRODUCTION_READY_FILES,PRODUCTION_READY_FILES_SELECT}` (`getManagerConfig` gates each action on `hasCurrentUserAtLeastOneAssignedRoleInStage`); maps/Schema.php `getAvailableEditorialDecisions()`; **browser-driven 2026-07-03** on seeded stage-5 subs 421 (skip→copyediting→production, layout editor gcox assigned) and 422 (same + a galley): assigned editor dbarnes → full workspace + status prompt + `Schedule For Publication`/`Move To Copyediting`; layout editor gcox → full workspace, Production Ready Files with Upload, Participants (read-only), **no status prompt**, **no decision button**, but **does** see `Schedule For Publication`; header for gcox drops the Activity Log button ·
<sup>b</sup> `WorkflowConfig[…PRODUCTION].getPrimaryItems/getSecondaryItems`; workflowConfigAuthorOJS `[…PRODUCTION].getPrimaryItems` (**DiscussionManager only** — no file/participant panel); stage-access from `workflow-stage-navigation` ·
<sup>c</sup> `FileManagerConfigurations.PRODUCTION_READY_FILES` (SUB_EDITOR/MANAGER/SITE_ADMIN/ASSISTANT → FILE_LIST/UPLOAD/DOWNLOAD_ALL/EDIT/DELETE/SEE_NOTES; MANAGER/SITE_ADMIN also FILE_SEND_TO_EDITOR; **no `ROLE_ID_AUTHOR` entry**); `PRODUCTION_READY_FILES_SELECT` (FILE_SELECT, editorial+assistant roles) ·
<sup>d</sup> `ParticipantManager` Assign gate owned by `stage-participants` (Production-stage role list includes Layout Editor + Indexer); layout editors get the panel read-only (verified live, gcox) ·
<sup>e</sup> `PKPStageParticipantNotifyForm::sendMessage()` `case 'LAYOUT_REQUEST'` → `_addAssignmentTaskNotification(NOTIFICATION_TYPE_LAYOUT_ASSIGNMENT)` + `logMailable(LAYOUT_NOTIFY_EDITOR)` ·
<sup>f</sup> `galleys` feature 26; the Vue `GalleyManager` `galleyAdd` opens the legacy `ArticleGalleyGridHandler::addGalley`, and galley file upload/proofing uses `SUBMISSION_FILE_PROOF` (`useGalleyManagerActions.js galleyChangeFile`; `ManageProofFilesGridHandler`) ·
<sup>g</sup> `getActionItems` (`isDecisionAvailable(submission, DECISION_BACK_FROM_PRODUCTION)` = 29); role-gate + wizard owned by `editorial-decisions` ·
<sup>h</sup> `getActionItems` first item (`action: 'navigateToMenu'`, `actionArgs: publication_{id}_titleAbstract`); publish authority in `publication-publish-flow` / `publication-versioning`

## Fields & validation

The editor and layout editor fill no form to *be* in this workspace — the panels each own their
forms (file upload → `submission-files`; discussions → `tasks-discussions`; the exit wizard →
`editorial-decisions`; the assign/notify modal → `stage-participants`; galleys →
`galleys`). What is stage-5-specific is **which file stage** an upload/selection lands in:

| Field (UI label) | Required? | Rules | Anchor |
|------------------|-----------|-------|--------|
| **Type** (genre/component) on a production-ready upload | Yes | The submission-component taxonomy (Article Text, Data Set, …) the uploader picks per file; the same genre set as every other stage, configured per journal in Settings → Workflow → Components; the general upload form is owned by `submission-files` | `useFileManagerConfig` `getFileGenres`; `submission-files` |
| **Production Ready Files** upload target | — (system-set) | Every file uploaded to (or selected into) the Production Ready Files grid is file stage **Production Ready** (`SUBMISSION_FILE_PRODUCTION_READY`); populated by the **Send To Production** promotion (the ticked copyedited + draft files) or a manual upload/select | `FileManagerConfigurations.PRODUCTION_READY_FILES.fileStage` (`SUBMISSION_FILE_PRODUCTION_READY`) |
| **Galley proof file** target | — (system-set) | A file attached to a galley on the Publication → Galleys tab is file stage **Proof** (`SUBMISSION_FILE_PROOF`), associated to the galley (representation); the galley itself carries the label/locale/URL fields, owned by `galleys` | `useGalleyManagerActions.js galleyChangeFile` (`SUBMISSION_FILE_PROOF`, `ASSOC_TYPE_REPRESENTATION`); `ManageProofFilesForm::execute()` |

## Rules & state

Stages by UI name, from `editorial-decisions`: **Submission**(1) · **Review**(3) ·
**Copyediting**(editing, 4) · **Production**(5). This spec is entirely about stage 5, status
**Queued**(1). <sup>a</sup>

1. **The stage-5 pane is a fixed composition** (`WorkflowConfig[WORKFLOW_STAGE_ID_PRODUCTION]`).
   The **main column** stacks, in order: a **status prompt** (`WorkflowNotificationDisplay`,
   rendered *only when a status notification has been seeded* — **not** an unconditional part of
   the pane; rule 2); the **Production Ready Files** grid (rule 3); and a **Production Tasks &
   Discussions** panel (`DiscussionManager`, `submission.queries.production` = "Production Tasks &
   Discussions"; the stage default discussion mailable is `DiscussionProduction`; mechanics owned
   by `tasks-discussions`). The **right rail** shows the **Participants** list (owned by
   `stage-participants`), which at this stage offers the **Layout Editor** and **Indexer** roles
   in its Assign picker. The **action bar** holds the two exits (rules 7–8). Note the pane has
   **only one file grid** (Production Ready Files) and **no galley grid** — galleys live on the
   Publication → Galleys tab (rule 5). Browser-driven on sub 421 (stage 5, Queued): the status
   prompt, the Production Ready Files grid, the discussion panel, participants and both action-bar
   items render for the assigned editor. <sup>b</sup>
2. ⚠ **The status prompt is a stored, decision-seeded notification — not an always-on part of the
   pane.** When present it drives the "assign a production user → awaiting galleys → done" cycle:
   an inline status card computed for the submission's **assigned stage-5 editors** (users holding
   a MANAGER/SUB_EDITOR *stage assignment* — a manager-scope editor merely *viewing* an unassigned
   submission gets **no** card) by `PKPEditingProductionStatusNotificationManager`. The card reads
   **"Assign a user to create galleys using the Assign link in the Participants list."**
   (`NOTIFICATION_TYPE_ASSIGN_PRODUCTIONUSER`) while **no production discussion exists** and no
   galley exists; the instant a **production discussion** exists it flips to **"Awaiting
   Galleys."** (`NOTIFICATION_TYPE_AWAITING_REPRESENTATIONS`); and **both clear** the instant **at
   least one galley (representation)** exists on the latest publication. These are level-NORMAL
   notifications surfaced *inline in the workspace* (not the bell). The card is **seeded only by
   the Send-To-Production decision** — `decision/Repository::getSubmissionNotificationTypes()`
   returns the production types for `Decision::SEND_TO_PRODUCTION` only (there is no other entry
   into stage 5, so unlike copyediting there is no skip-path asymmetry). ⚠ Like copyediting, the
   manager keys "a production user is working on it" off the **existence of any stage-5
   discussion**, not off a Layout Editor *stage-assignment* — so a layout editor assigned
   **silently** (no notify/discussion) leaves the editor still reading "Assign a user to create
   galleys" even though one is assigned (**verified live on sub 421**: Graham Cox assigned as
   Layout Editor, no discussion → the assigned editors still hold the ASSIGN_PRODUCTIONUSER card).
   Once seeded, the card is recomputed on later changes — a participant remove, a production
   discussion open, a notify, and **a galley add/delete** (`ArticleGalleyGridHandler`) —
   see Side effects / Known deviations. <sup>c</sup>
3. **The Production Ready Files grid is the copyediting hand-off, bound for galleys.** The stage-5
   file panel is the `FileManager` in the `PRODUCTION_READY_FILES` namespace — file stage
   **Production Ready** (`SUBMISSION_FILE_PRODUCTION_READY`), titled **"Production Ready Files"**,
   described **"These are the files that will be sent for publication"**. It is populated by the
   **Send To Production** decision, which promotes the ticked **Copyedited** files (pre-selected)
   and **Draft** files (offered) from copyediting into this stage (`editorial-decisions`;
   `copyediting-stage` rule 6). Editors, managers, site admins and layout editors/indexers get
   Upload / Download All / **Select** (pull an existing file into the production-ready stage) /
   edit / delete / view-notes; **authors have no access to this grid** (rule in Actors). The Vue
   `PRODUCTION_READY_FILES` config carries **no `gridComponent`**, so the grid is served by the
   Vue FileManager + API — the legacy `ProductionReadyFilesGridHandler` is **not referenced by any
   live surface** (dead-code candidate — Known deviations). Verified live (sub 421, skip→
   production path): the grid renders with Upload and **"No Items"** — that path carried no
   copyedited files to promote, so the layout editor uploads the source here. <sup>d</sup>
4. **The layout editor is a stage-5 assistant; assigning one is a participant assignment with a
   production-specific notify.** Adding a **Layout Editor** (or Indexer) is done through the
   Participants → Assign modal (mechanics, picker, silent-vs-notified add all owned by
   `stage-participants`; the Production-stage picker offers both default stage-5 assistant groups).
   The **production-specific slice** is the notify template: the stage's default discussion
   mailable is **`DiscussionProduction`** (`DISCUSSION_NOTIFICATION_PRODUCTION`), and the picker
   also offers the retained alternate **"Ready for Production"** (`LAYOUT_REQUEST`, name
   *mailable.layoutRequest.name*). Which one the editor picks changes the side effects (rule 6).
   Assigning grants the layout editor stage-5 access (owned by `stage-participants` /
   `workflow-stage-navigation`). <sup>e</sup>
5. **The production milestone is a galley — created on the Publication tab, not in this pane.** The
   layout editor turns the production-ready files into **galleys** (the reader-facing
   representations) on the **Publication → Galleys** tab. Galley CRUD, labels, remote-URL vs file,
   ordering and DOIs are owned by `galleys` (feature 26); the galley file is uploaded as a
   **proof** file (`SUBMISSION_FILE_PROOF`, associated to the representation) via the galley's
   Change-File action (`ManageProofFilesGridHandler` / `ManageProofFilesForm` is the legacy
   proof-file selection grid — still reachable from the galley grid). This spec owns only the
   **production-stage consequence** of that milestone: the moment a galley exists on the latest
   publication, the "Awaiting Galleys" status prompt clears (rule 2). **Galley add/delete through
   the galley grid (`ArticleGalleyGridHandler`) recomputes the prompt** — so creating the first
   galley in the UI clears it. ⚠ OJS has **no galley "approval" sign-off**: representations carry
   an `isApproved` flag (`Representation::setIsApproved`) but it has **no caller anywhere in OJS**
   (it is the OMP publication-format-approval concept) — in OJS the milestone is simply *a galley
   exists*, after which the article can be scheduled/published. <sup>f</sup>
6. **The layout task-notification + email-log fire only when "Ready for Production" is chosen.**
   `PKPStageParticipantNotifyForm::sendMessage()` keys a `switch($templateKey)`: only the
   **`case 'LAYOUT_REQUEST'`** branch creates the layout editor's task notification
   (`NOTIFICATION_TYPE_LAYOUT_ASSIGNMENT`, level TASK) and writes the **`LAYOUT_NOTIFY_EDITOR`**
   submission email-log entry; a **`case 'LAYOUT_COMPLETE'`** ("Layout complete", also retained)
   writes `LAYOUT_NOTIFY_COMPLETE`. If the editor keeps the **default** `DiscussionProduction`
   template, the branch is not entered — the notify falls to the generic path (a `NEW_QUERY`
   discussion notification + a `DISCUSSION_NOTIFY` email-log entry, owned by `tasks-discussions`),
   and **no** layout task notification is raised. So `NOTIF-layout-assignment` and the layout
   email-log entries are reachable, but **only on the non-default template choice** (exactly the
   copyediting `COPYEDIT_REQUEST` pattern). The sibling **`case 'INDEX_REQUEST'`** (which would
   raise `NOTIFICATION_TYPE_INDEX_ASSIGNMENT`) is **dead** — the `INDEX_REQUEST` template is not
   registered and not among the retained alternates, so the Indexer notify is never offered. After
   any stage-5 notify the four editing/production status prompts are recomputed (rule 2).
   <sup>g</sup>
7. **Move To Copyediting is the only stage-5 decision, owned by `editorial-decisions`.** The
   warnable action-bar button **"Move To Copyediting"** records **Back From Production**
   (`DECISION_BACK_FROM_PRODUCTION` = 29), the only decision the OJS decision set exposes at
   production (`getAvailableEditorialDecisions()` PRODUCTION → `BackFromProduction`). It returns
   the submission to **Copyediting** (`getNewStageId()` → `WORKFLOW_STAGE_ID_EDITING`), notifies
   the author (`DecisionBackFromProductionNotifyAuthor`, template
   `EDITOR_DECISION_BACK_FROM_PRODUCTION`) and moves the production-ready files back. The
   transition machine, the role-gate and the wizard are `editorial-decisions`; this spec owns only
   that this is the stage-5 exit. There is **no forward "publish" decision here** — the forward
   path is the Schedule For Publication navigation (rule 8). <sup>h</sup>
8. **Schedule For Publication is a navigation shortcut, not an exit.** An always-present primary
   button that jumps the menu to **Publication → Title & Abstract** — letting an editor (or layout
   editor) go straight to scheduling/publishing. It records nothing itself; whether the user can
   actually schedule/publish there is decided by publish authority (`publication-publish-flow` /
   `publication-versioning`). Verified live: the button renders for both the assigned editor and
   the layout editor (gcox); the header also offers **Preview** at stage 5 (a draft preview of the
   article). <sup>i</sup>
9. **The author's stage-5 view is discussion-only.** An author opening their own submission at
   production on **My Submissions** sees **only the Production Tasks & Discussions** panel — no
   Production Ready Files, no Participants, no status prompt and no action bar (the author never
   sees the production files at all — rule 3). The author composition is owned by
   `author-dashboard`; there is no author sign-off state in production (the reader-facing galleys
   are the output). <sup>j</sup>

<sup>a</sup> constants per `editorial-decisions` (WORKFLOW_STAGE_ID_PRODUCTION=5, STATUS_QUEUED=1) ·
<sup>b</sup> workflowConfigEditorialOJS `WorkflowConfig[…PRODUCTION].{getPrimaryItems,getSecondaryItems,getActionItems}`; locale `submission.queries.production` ("Production Tasks & Discussions"); StageMailable → `DiscussionProduction` (`DISCUSSION_NOTIFICATION_PRODUCTION`); browser-driven 2026-07-03 (sub 421) ·
<sup>c</sup> WorkflowNotificationDisplay.vue (`getRequestOptionsPerStage(PRODUCTION)` `isOJS()` branch → NORMAL: ASSIGN_PRODUCTIONUSER + AWAITING_REPRESENTATIONS; the `isOMP()` branch instead requests VISIT_CATALOG + FORMAT_NEEDS_APPROVED_SUBMISSION); locale `notification.type.assignProductionUser` = "Assign a user to create galleys using the Assign link in the Participants list.", `notification.type.awaitingRepresentations` = "Awaiting Galleys." (`locale/en/locale.po`); PKPEditingProductionStatusNotificationManager::updateNotification() (loops **stage assignments** with `Role::ROLE_ID_MANAGER`/`ROLE_ID_SUB_EDITOR`; PRODUCTION branch: representations exist → clear both; else stage-5 `EditorialTask` exists → AWAITING_REPRESENTATIONS; else ASSIGN_PRODUCTIONUSER); **seed gate** `decision/Repository::getSubmissionNotificationTypes()` (`Decision::SEND_TO_PRODUCTION` case adds the 2 production types) via `updateNotifications()`; `fetchNotification`/`_getNotificationsByOptions` **only reads** stored rows (no recompute); live 2026-07-03 — DB `notifications`: sub 421 (layout editor gcox assigned, no discussion) = ASSIGN_PRODUCTIONUSER for the assigned SEs, **and the rendered card confirms it** ·
<sup>d</sup> `FileManagerConfigurations.PRODUCTION_READY_FILES` (`fileStage: SUBMISSION_FILE_PRODUCTION_READY`, `titleKey: editor.submission.production.productionReadyFiles` = "Production Ready Files", `descriptionKey: fileManager.productionReadyFilesDescription` = "These are the files that will be sent for publication", **no gridComponent**); `PRODUCTION_READY_FILES_SELECT` (FILE_SELECT); Send-To-Production promotion in `editorial-decisions` / `copyediting-stage` rule 6; `ProductionReadyFilesGridHandler` has zero live references (dead); live probe (sub 421 grid = "No Items") ·
<sup>e</sup> `stage-participants` (Assign modal, Production-stage role list = Layout Editor + Indexer per `registry/userGroups.xml` roleId ASSISTANT stages=5); StageMailable → `DiscussionProduction`; `registry/emailTemplates.xml` (`LAYOUT_REQUEST` `alternateTo="DISCUSSION_NOTIFICATION_PRODUCTION"`); `I5716_EmailTemplateAssignments::mapIncludedAlternateTemplates` (retains `COPYEDIT_REQUEST`, `LAYOUT_REQUEST`, `LAYOUT_COMPLETE`; **no `INDEX_REQUEST`**) ·
<sup>f</sup> `galleys` feature 26; `useGalleyManagerActions.js` (`galleyAdd` → legacy `ArticleGalleyGridHandler::addGalley`; `galleyChangeFile` → `FileUploadWizardHandler` fileStage `SUBMISSION_FILE_PROOF`, `ASSOC_TYPE_REPRESENTATION`); `ManageProofFilesGridHandler`/`ManageProofFilesForm` (proof-file selection); `ArticleGalleyGridHandler::addGalley()`/`deleteGalley()` recompute [ASSIGN_PRODUCTIONUSER, AWAITING_REPRESENTATIONS]; `Representation::getIsApproved()/setIsApproved()` — **no OJS caller** (OMP-only) ·
<sup>g</sup> PKPStageParticipantNotifyForm::sendMessage() (`switch($templateKey)` `case 'LAYOUT_REQUEST'` → `_addAssignmentTaskNotification(NOTIFICATION_TYPE_LAYOUT_ASSIGNMENT)` + `logMailable(LAYOUT_NOTIFY_EDITOR)`; `case 'LAYOUT_COMPLETE'` → `logMailable(LAYOUT_NOTIFY_COMPLETE)`; `case 'INDEX_REQUEST'`/`'INDEX_COMPLETE'` present but template unregistered; default → `DISCUSSION_NOTIFY`; then recompute the 4 editing/production status types when stage ∈ {EDITING, PRODUCTION}) ·
<sup>h</sup> `getActionItems` (`isDecisionAvailable(…BACK_FROM_PRODUCTION)`); `classes/submission/maps/Schema.php getAvailableEditorialDecisions()` (PRODUCTION → `BackFromProduction`); `lib/pkp/classes/decision/types/BackFromProduction.php` (`getNewStageId()` → `WORKFLOW_STAGE_ID_EDITING`, `DecisionBackFromProductionNotifyAuthor`); Decision::BACK_FROM_PRODUCTION = 29; `editorial-decisions` variant table (Back to Copyediting) ·
<sup>i</sup> `getActionItems` first item (`navigateToMenu` → `publication_{id}_titleAbstract`); `getHeaderItems` (Preview at stage EDITING/PRODUCTION); publish authority `publication-publish-flow` ·
<sup>j</sup> workflowConfigAuthorOJS `[…PRODUCTION].getPrimaryItems` (DiscussionManager only); `author-dashboard`

## Side effects

The production workspace itself is a **read/exchange surface** — opening it, browsing files and
reading discussions send no email, raise no notification and write no event-log entry. Side
effects fire from the actions the panels host:

- **Requesting production with the "Ready for Production" template** (Participants → Notify)
  creates the layout editor's **task notification** (`NOTIFICATION_TYPE_LAYOUT_ASSIGNMENT`, level
  TASK), sends the layout-request email, and writes the **`LAYOUT_NOTIFY_EDITOR`** submission
  email-log entry (rule 6). With the **default** discussion template no layout notification is
  raised — a `NEW_QUERY` + `DISCUSSION_NOTIFY` fire instead (owned by `tasks-discussions`).
- **The editor status prompt** — *seeded* by the Send-To-Production decision (rule 2); thereafter
  a participant remove, a production discussion open, a notify, or **a galley add/delete
  through the galley grid** recomputes the `ASSIGN_PRODUCTIONUSER` / `AWAITING_REPRESENTATIONS`
  inline notifications for the assigned editors. ⚠ Note the recompute callers do **not** include a
  submission-file event or a galley created off the grid path (see Known deviations).
- **Recording Move To Copyediting** notifies the author with **`DecisionBackFromProductionNotifyAuthor`**
  (`MAIL-decision-back-from-production-notify-author`, template `EDITOR_DECISION_BACK_FROM_PRODUCTION`)
  and moves the stage back to Copyediting — mailable + transition owned by `editorial-decisions`.
  The Send-To-Production decision that *lands* a submission here (and its author email
  `DecisionSendToProductionNotifyAuthor`) is owned by `editorial-decisions` / `copyediting-stage`.
- **Uploading / editing / selecting a production-ready file** mutates the submission file store —
  owned by `submission-files`.
- **Creating / editing a galley** (Publication → Galleys) mutates the publication's
  representations and recomputes the status prompt — galley mechanics owned by `galleys`.
- **Posting in Production Discussions** notifies the discussion participants — owned by
  `tasks-discussions`.
- **The proofreading / indexing / layout-thank email-log corpus** beyond `LAYOUT_NOTIFY_EDITOR`
  and `LAYOUT_NOTIFY_COMPLETE` is never written (rule 6 / Known deviations).

## Settings that modify behavior

- **User-group stage configuration** (Settings → Users & Roles): which assistant groups cover
  stage 5 (defaults: Layout Editor → Production, Indexer → Production), and therefore who can be
  assigned as a layout editor/indexer and gain stage-5 access (owned by
  `workflow-stage-navigation` / `stage-participants`).
- **Submission components / genres** (Settings → Workflow → Components): the genre set shown in
  the Type column of the production-ready uploads (owned by `submission-files` / workflow settings).
- **Email templates** (Settings → Workflow → Emails): enabling/disabling the **Ready for
  Production** / **Layout complete** alternates changes whether they are offered in the notify
  picker (which in turn gates the layout task notification, rule 6); the exit-decision template
  modifies the Move-to-Copyediting wizard (owned by `editorial-decisions` /
  `email-templates-management`).
- **Publication payments configured** — the header **Payments** dropdown appears at production too
  (owned by `payments`); it does not change the pane composition.
- No setting changes the stage-5 pane composition or the two exits themselves.

## Cross-feature interactions

- **editorial-decisions** — owns the stage-5 exit (Move To Copyediting / Back From Production →
  Copyediting) and the `DecisionBackFromProductionNotifyAuthor` mailable, plus the
  Send-To-Production decision that lands a submission here and the file promotion into
  Production Ready Files; this spec owns the stage-5 *presentation* of the exit and the
  production-ready hand-off target.
- **galleys** (feature 26, not yet written) — owns galley CRUD, labels, remote-URL/file, ordering,
  DOIs, the proof-file mechanics (`SUBMISSION_FILE_PROOF`) and the galley grids; this spec owns
  only the production-stage *milestone* (a galley existing clears "Awaiting Galleys"). The
  `GRID-manage-proof-files` atom is claimed here as the proof-file exchange at production, but the
  galley it attaches to is `galleys`' (**seam** — see Open questions).
- **publication-publish-flow** (feature 32, not yet written) — owns the Schedule For Publication /
  publish/unpublish flow this pane's Schedule button navigates to, and the Done-stage transition
  on first publish.
- **copyediting-stage** — owns the stage-4 workspace and the **Draft Files** panel
  (`FINAL_DRAFT_FILES` / `FinalDraftFilesGridHandler`); the Send-To-Production promotion carries
  its Copyedited + Draft files into this stage's Production Ready Files (seam resolved — see Open
  questions).
- **workflow-stage-navigation** — owns the shell, the Production menu item, stage-5 access, and
  the `PAGE-workflow-production` legacy route (referenced, not claimed).
- **stage-participants** — owns the Participants panel, the Assign/Notify modal, the
  Production-stage role picker (Layout Editor + Indexer), and the access an assignment grants;
  this spec owns the production-specific notify template + its task notification.
- **submission-files** — owns the general `FileManager` grid, upload/edit/select forms and
  dependent files; this spec owns the stage-5 `PRODUCTION_READY_FILES` usage and file stage.
- **tasks-discussions** — owns the Production Discussions panel, the generic-template notify path,
  and the `NEW_QUERY` notification.
- **author-dashboard** — owns the author's discussion-only stage-5 composition on My Submissions.
- **editorial-activity-log / notifications / email-delivery / email-templates-management** — own
  the log surface, the notification inbox, email delivery, and the templates the notify picker
  offers.

## Canonical scenarios

1. **Editor opens the production workspace** — an editor opens a submission just handed to
   production on the Production pane: the workspace shows an **"Assign a user to create galleys
   using the Assign link in the Participants list."** status prompt, a **Production Ready Files**
   grid (the files carried from copyediting, "sent for publication"), a **Production Tasks &
   Discussions** panel, a **Participants** list (with a Layout-Editor-capable Assign picker), and
   an action bar offering **Schedule For Publication** and **Move To Copyediting**
   (browser-verified, sub 421).
2. **Assign a layout editor and request production** — the editor opens Participants → Assign,
   picks a **Layout Editor**, and notifies them with the **Ready for Production** template: the
   layout editor gains stage-5 access, receives a layout-request email + a task notification, and
   the editor's status prompt flips from "Assign a user to create galleys" to "Awaiting Galleys".
   (Keeping the *default* discussion template instead opens a plain discussion with no layout task
   notification — rule 6.)
3. **Manage the production-ready files** — the layout editor opens the Production Ready Files grid
   and **uploads** (or **Selects** from prior stages) the files to be turned into galleys; on the
   skip-review path the grid arrives empty and the layout editor uploads the source, on the
   full path it already holds the promoted copyedited files.
4. **Build the galleys (the production milestone)** — the layout editor goes to **Publication →
   Galleys**, adds a galley and uploads its file (a proof file on the representation); the instant
   the first galley exists the editor's **"Awaiting Galleys"** prompt clears (galley CRUD owned by
   `galleys`; the prompt recompute is driven by the galley grid).
5. **Schedule handoff** — instead of any further stage decision, the editor clicks **Schedule For
   Publication**, which navigates directly to the Publication → Title & Abstract tab (recording no
   decision), where scheduling/publishing is gated by publish authority (`publication-publish-flow`).
6. **Move back to copyediting** — the editor clicks the warnable **Move To Copyediting**,
   returning the submission to the Copyediting stage and emailing the author the back-from-production
   notice (decision owned by `editorial-decisions`).
7. **Permission boundary** (browser-verified on sub 421) — a **layout editor** opens the same
   submission: the Production pane renders and they can Upload/Select production-ready files and
   post discussions, but the Participants panel is read-only (no Assign), there is **no decision
   button** (no Move To Copyediting), and **no status prompt** — though they **do** see the
   **Schedule For Publication** navigation button. An **author** sees only the Production
   Discussions on My Submissions (no files, no participants). A manager-scope editor who is not a
   stage-5 assignee sees the full workspace but no status prompt (owned by `stage-participants` /
   `workflow-stage-navigation`).

## Known deviations (as-built ≠ intent)

- ⚠ **The "Assign a user to create galleys" status prompt is discussion-keyed, not
   assignment-tracking.** The manager keys "a production user is on it" off the existence of any
   stage-5 **discussion**, not off a Layout Editor *stage-assignment*, so a layout editor added
   **silently** (no discussion) leaves the editor still reading "Assign a user to create galleys"
   (verified live: sub 421; **re-verified live 2026-07-03 on sub 622** — gcox assigned as Layout
   Editor with no stage-5 discussion → all three assigned editors still hold the ASSIGN_PRODUCTIONUSER
   notification in the DB). This is the exact analogue of the copyediting prompt deviation
   (`copyediting-stage` rule 2). The shared editing/production ledger entry is
   `docs/e2e/app-changes.md` §2 **row 9** (which explicitly names *production-stage row 1*); its
   copyediting-specific restatement is **row 82**; no data is lost.
   Suspected intent: the prompt should track the actual Layout Editor assignment. Unlike
   copyediting there is **no skip-path asymmetry** (the only entry into stage 5 is
   Send-To-Production, which seeds the prompt).
- ⚠ **The status prompt only auto-clears on a galley created through the galley grid.** The prompt
   is a stored notification recomputed by a fixed set of events — the Send-To-Production decision,
   a participant remove, a production discussion open, a notify, and a galley add/delete via
   `ArticleGalleyGridHandler`. It is **not** recomputed by a bare submission-file event, nor by any
   galley created off the grid path (e.g. an import or a scenario seed) — so in those edge cases
   "Awaiting Galleys" can persist even though a galley exists (observed on scenario-seeded sub 422,
   whose galley was added via the Repo, not the grid). In the normal UI the layout editor creates
   galleys through the grid, which recomputes, so the prompt clears; the staleness is an edge-case
   affordance inconsistency, not data loss. Ledger `docs/e2e/app-changes.md` §2 **row 83**
   (confirmed live 2026-07-03 on sub 623: a scenario-seeded remote galley exists on the latest
   publication — `publication_galleys` row, `is_approved=0` — yet all three assigned editors still
   hold the ASSIGN_PRODUCTIONUSER notification, because the Repo-path add never ran the recompute).
- ⚠ **No galley "approval" step exists in OJS.** Representations carry an `isApproved` flag with
   getter/setter (`Representation::setIsApproved`) but **no caller anywhere in OJS** — it is the
   OMP publication-format-approval concept. In OJS the production milestone is simply *a galley
   exists*; there is no proofing sign-off gate before scheduling. Recorded as a dead-code / OMP-only
   note (UNASSIGNED.md §Dead-code candidates). Suspected intent: as-built for OJS (galleys are the
   output, publish is the gate) — an Open question, not a hard bug.
- ⚠ **`NOTIF-index-assignment` and the Indexer notify are dead in 3.6.** The `case 'INDEX_REQUEST'`
   branch (which would raise `NOTIFICATION_TYPE_INDEX_ASSIGNMENT` + write `INDEX_NOTIFY_INDEXER`)
   is unreachable because the `INDEX_REQUEST` template is not registered and not among the retained
   alternate templates (`I5716` retains only `COPYEDIT_REQUEST`/`LAYOUT_REQUEST`/`LAYOUT_COMPLETE`).
   The **Indexer** user group still exists as a default stage-5 assistant group, so an indexer can
   be *assigned*, but the "Index Request" notify is never offered. Dead-code candidate. Suspected
   intent: the indexing sub-workflow was retired with OJS-2; the Indexer group/notify is legacy.
- ⚠ **Most of the production email-log corpus is dead legacy.** Of the 14 proof/layout/index
   submission email-log types, only **`LAYOUT_NOTIFY_EDITOR`** (rule 6) and **`LAYOUT_NOTIFY_COMPLETE`**
   are written by a live path. **`PROOFREAD_NOTIFY_AUTHOR`** survives only as a *display filter*
   (the email-log tab groups author-facing proofing emails, `PKPEmailController`) and is never
   written; the remaining eleven (`PROOFREAD_*` proofreader/layout/thank, `LAYOUT_THANK_EDITOR`,
   `INDEX_NOTIFY_INDEXER`, `INDEX_NOTIFY_COMPLETE`) have **no reachable writer** — remnants of the
   OJS-2 proofreading/layout/indexing sub-workflow (proofreader/author/layout rounds with
   acknowledge steps) that 3.x replaced with galleys + discussions. Claimed here so the corpus has
   one owner; the twelve unwritten/unreachable types are dead-code candidates (UNASSIGNED.md).
- ⚠ **`NOTIF-format-needs-approved-submission` is OMP-centric and unreachable in OJS.** The
   production `WorkflowNotificationDisplay` requests `FORMAT_NEEDS_APPROVED_SUBMISSION` +
   `VISIT_CATALOG` only in its **`isOMP()`** branch; OJS requests `ASSIGN_PRODUCTIONUSER` +
   `AWAITING_REPRESENTATIONS` instead. OJS's `NotificationManager` registers a delegate for
   `APPROVE_SUBMISSION`/`VISIT_CATALOG` but **not** for `FORMAT_NEEDS_APPROVED_SUBMISSION`, so that
   type is never surfaced in OJS. Claimed here to give the atom an owner; a dead-code / OMP-only
   note in the OJS context.

## Open questions

1. **`GRID-final-draft` ownership (seam) — resolved to copyediting.** The **Draft Files** panel
   (`FINAL_DRAFT_FILES` / `FinalDraftFilesGridHandler`, and its `ManageFinalDraftFilesGridHandler`
   select-grid) renders **only in the copyediting stage** (the `PRODUCTION_READY_FILES` config is
   the *only* file grid in the stage-5 pane — confirmed in `workflowConfigEditorialOJS.js`), so per
   the live-panel test these two `final` grid atoms belong to **copyediting-stage**, not
   production-stage — this spec reassigns them there (answering `copyediting-stage` Open Question 1)
   and merely references them as the source of the promoted production-ready files. Flagged for the
   maintainer / grooming in case the FEATURE-MAP's original production hint was intentional.
2. **`GRID-manage-proof-files` sits on the galley seam.** The proof-file selection grid
   (`ManageProofFilesGridHandler`) is claimed here as the production proof-file exchange, but the
   file is a **dependent of a galley** (representation) and the galley is `galleys`' (feature 26).
   When `galleys` is written, confirm whether the proof-file grid atom should move there.
3. **Should "Awaiting Galleys" track the Layout Editor assignment and recompute on any galley
   creation?** As-built the prompt is discussion-keyed and only recomputed by a fixed event set
   (Known deviations). Intended proxy, or should it key off the actual assignment and any galley
   add?
4. **Is the absence of a galley-approval / proofing sign-off intended for OJS?** OJS has no
   representation-approval step (the OMP `isApproved` flag is uncalled). Is "a galley exists →
   schedule/publish" the intended model, or should production carry an explicit proof-approval
   gate?

---

## Reference — entry points & surfaces

| Entry | Path | Atom |
|-------|------|------|
| Production workspace (pane) | `/{journal}/dashboard/editorial?workflowSubmissionId={id}&workflowMenuKey=workflow_5` (Production menu item; shell owned by `workflow-stage-navigation`) | PAGE-workflow-production *(owned by workflow-stage-navigation — referenced)* |
| Production Ready Files grid | `FileManager` namespace `PRODUCTION_READY_FILES` (`SUBMISSION_FILE_PRODUCTION_READY`); **no gridComponent** (Vue FileManager + API); legacy `grid.files.productionReady.ProductionReadyFilesGridHandler` **(dead)** | GRID-lib-pkp-grid-files-production-ready-production-ready-files-grid-handler |
| Galley proof-file selection | `grid.files.proof.ManageProofFilesGridHandler` (`addFile`/`downloadFile`/`deleteFile`/`updateProofFiles`) → `ManageProofFilesForm` (fileStage `SUBMISSION_FILE_PROOF`, assoc galley); reached from the galley grid | GRID-lib-pkp-grid-files-proof-manage-proof-files-grid-handler |
| Draft Files grid (source of promotion) | `FileManager` namespace `FINAL_DRAFT_FILES` (`SUBMISSION_FILE_FINAL`); `grid.files.final.FinalDraftFilesGridHandler` | GRID-lib-pkp-grid-files-final-final-draft-files-grid-handler *(reassigned to copyediting-stage — referenced)* |
| Editor status prompt (assigned editors only; seeded by Send-To-Production) | `POST notification/fetchNotification` (NORMAL: ASSIGN_PRODUCTIONUSER + AWAITING_REPRESENTATIONS), rendered by `WorkflowNotificationDisplay` `isOJS()` branch | NOTIF-assign-productionuser, NOTIF-awaiting-representations |
| Layout task notification | `NOTIFICATION_TYPE_LAYOUT_ASSIGNMENT` (level TASK) via Participants → Notify "Ready for Production" | NOTIF-layout-assignment |
| Indexer task notification (dead) | `NOTIFICATION_TYPE_INDEX_ASSIGNMENT` — `INDEX_REQUEST` template unregistered | NOTIF-index-assignment |
| Galley-approval prompt (OMP-only in OJS) | `NOTIFICATION_TYPE_FORMAT_NEEDS_APPROVED_SUBMISSION` — requested only by the `isOMP()` branch | NOTIF-format-needs-approved-submission |
| Production email-log types | `SubmissionEmailLogEventType::{LAYOUT_*,PROOFREAD_*,INDEX_*}` (only `LAYOUT_NOTIFY_EDITOR` + `LAYOUT_NOTIFY_COMPLETE` written) | EVLOG-EMAIL-LAYOUT-*, EVLOG-EMAIL-PROOF-*, EVLOG-EMAIL-INDEX-* |
| Stage-5 exit | Decision action bar → Record-Decision wizard (`editorial-decisions`, BackFromProduction=29) | *(decision atoms owned by editorial-decisions)* |
| Schedule handoff | Action-bar "Schedule For Publication" → `navigateToMenu` publication titleAbstract | *(owned by publication-publish-flow — referenced)* |

## Reference — code anchors

- **Stage-5 pane config**: `lib/ui-library/src/pages/workflow/composables/useWorkflowConfig/workflowConfigEditorialOJS.js`
  — `WorkflowConfig[WORKFLOW_STAGE_ID_PRODUCTION].{getPrimaryItems,getSecondaryItems,getActionItems}`
  (status prompt / Production Ready Files / discussions / participants / Schedule + Move exits) and
  `getHeaderItems` (Preview at EDITING/PRODUCTION); author variant `workflowConfigAuthorOJS.js`
  (`[…PRODUCTION]` → DiscussionManager only).
- **File manager**: `lib/ui-library/src/managers/FileManager/useFileManagerConfig.js`
  (`FileManagerConfigurations.{PRODUCTION_READY_FILES,PRODUCTION_READY_FILES_SELECT}` — file stage,
  per-role permission sets, no gridComponent).
- **Status notifications**: `lib/ui-library/src/pages/workflow/components/primary/WorkflowNotificationDisplay.vue`
  (`getRequestOptionsPerStage(PRODUCTION)` isOJS/isOMP branches; `_getNotificationsByOptions` read-only);
  `lib/pkp/classes/notification/managerDelegate/PKPEditingProductionStatusNotificationManager.php`
  (`updateNotification` PRODUCTION branch, representations vs stage-5 EditorialTask);
  `lib/pkp/classes/notification/Notification.php` (`NOTIFICATION_TYPE_ASSIGN_PRODUCTIONUSER`=0x1000026,
  `_AWAITING_REPRESENTATIONS`=0x1000025, `_LAYOUT_ASSIGNMENT`=0x1000019, `_INDEX_ASSIGNMENT`=0x100001A,
  `_FORMAT_NEEDS_APPROVED_SUBMISSION`=0x100001D); seed gate `lib/pkp/classes/decision/Repository.php`
  `getSubmissionNotificationTypes()` (SEND_TO_PRODUCTION); recompute callers `ArticleGalleyGridHandler`,
  `StageParticipantGridHandler`, `PKPStageParticipantNotifyForm`, `EditorialTaskController`.
- **Layout notify / email log**: `lib/pkp/controllers/grid/users/stageParticipant/form/PKPStageParticipantNotifyForm.php`
  (`sendMessage()` `case 'LAYOUT_REQUEST'`/`'LAYOUT_COMPLETE'`/`'INDEX_REQUEST'`);
  `lib/pkp/classes/log/SubmissionEmailLogEventType.php` (LAYOUT/PROOFREAD/INDEX corpus);
  `registry/emailTemplates.xml` (`LAYOUT_REQUEST`/`LAYOUT_COMPLETE` alternateTo `DISCUSSION_NOTIFICATION_PRODUCTION`);
  `lib/pkp/classes/migration/upgrade/v3_4_0/I5716_EmailTemplateAssignments.php` (`mapIncludedAlternateTemplates`);
  `registry/userGroups.xml` (Layout Editor + Indexer, ASSISTANT, stages=5).
- **Galleys / proofing (seam — galleys feature 26)**: `lib/ui-library/src/managers/GalleyManager/useGalleyManagerActions.js`
  (`galleyAdd`, `galleyChangeFile` → `SUBMISSION_FILE_PROOF`); `controllers/grid/articleGalleys/ArticleGalleyGridHandler.php`
  (`addGalley`/`deleteGalley` recompute the status prompt); `lib/pkp/controllers/grid/files/proof/ManageProofFilesGridHandler.php`
  + `.../form/ManageProofFilesForm.php`; `lib/pkp/classes/submission/Representation.php` (`isApproved` — OMP-only, uncalled).
- **Exit**: `lib/pkp/classes/decision/types/BackFromProduction.php` (`getNewStageId()` → EDITING,
  `DecisionBackFromProductionNotifyAuthor`); OJS decision set `classes/submission/maps/Schema.php`
  `getAvailableEditorialDecisions()` (PRODUCTION → BackFromProduction); full engine in `editorial-decisions`.
