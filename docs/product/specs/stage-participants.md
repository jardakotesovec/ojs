---
name: stage-participants
scope: The per-stage Participants panel on the workflow page — who is on the submission (editors, section editors, assistants, the author), assigning a user into a role with an optional recommend-only / metadata-edit flag and an optional notify message, removing an assignment, and the role-scoped stage access an assignment grants
shared: pkp-lib          # the Vue ParticipantManager (lib/ui-library), the legacy StageParticipantGridHandler + AddParticipantForm + PKPStageParticipantNotifyForm, the participants API, and the stage_assignments/subeditor_submission_group tables all live in lib/pkp; OJS adds no override
status: verified
e2e-plans: [stage-participants.md, discussions.md, submission-stage-actions.md]
atlas-claims:
  - VUE-participant-manager
  - GRID-lib-pkp-grid-users-stage-participant-stage-participant-grid-handler
  - GRID-lib-pkp-grid-users-user-select-user-select-grid-handler
  - DB-stage_assignments
  - DB-subeditor_submission_group
  - EVLOG-SUBM-ADD-PART
  - EVLOG-SUBM-REM-PART
  - NOTIF-editor-assign
---

# Stage participants (the workflow Participants panel)

## Purpose

Every editorial-stage pane on the workflow page carries a **Participants** panel listing
the people working on the submission *at that stage* — the journal/section editors who can
decide on it, the copyeditors/layout editors/proofreaders doing the production work, and
the author. This spec owns that panel: reading the list, the **Assign** modal that adds a
user into a role (with an optional *recommend-only* flag, an optional *can-change-metadata*
flag, and an optional notification message that doubles as the opening of a discussion),
removing an assignment, and the crucial side effect — **assigning a user grants them
role-scoped access to the submission's workflow**. Assignment is how an editor gets a
section editor or an assistant onto a manuscript; the *effect* of that access (which stages
open) is computed by `workflow-stage-navigation`, and this spec owns how the assignment
that feeds it is created and removed. It also owns the submission-time **auto-assignment**
of the section/category editors configured for the submission's section.

## Actors & permissions

Everything requires login in a journal context, and the panel renders **only inside the
editorial workflow shell** (`workflow-stage-navigation`) — authors and reviewers never
reach it. Recurring terms: an **administrator of the panel** ("can administer") is a
journal manager, site admin, or a **section editor holding a stage assignment on the panel's
stage**; an *unassigned* manager/site admin counts as an administrator on every stage
(their global role is injected into the per-stage role set — the same **manager-scope**
fallback `workflow-stage-navigation` rule 5 describes, and it is suppressed the same way when
the manager is an active reviewer of the submission). **Assistants** (copyeditor, layout
editor, proofreader) get the panel **read-only**. A **participant** is any user holding a
stage assignment; the **author** appears as a participant via their author-role assignment.
"Assigned in the stage" is checked client-side against the submission's per-stage
`currentUserAssignedRoles` and server-side against the same stage-assignment data. Live
probes 2026-07-03 on `publicknowledge` with seeded submissions 416 (copyediting), 417,
418 (submission stage), 419 (production): dbarnes (manager-scope), dbuskins
(assigned section editor), mfritz (assistant / copyeditor), minoue (recommend-only section
editor). Verifier re-drove the whole matrix 2026-07-03 on fresh seed 554 (minoue = a
recommend-only Section editor) and on 416 (mfritz assigned/removed as Copyeditor) — every
add/remove/access-grant claim below is a live end-to-end result, not a code inference. <sup>a</sup>

| Action | Who may — and when |
|--------|--------------------|
| **See the Participants panel** | • Managers / site admins — any submission in the journal (manager scope)<br>• Section editors & assistants — only submissions they hold a stage assignment on (the workflow shell already gates entry; the participants list API is limited to managers/section-editors/assistants with submission access)<br>• Authors & reviewers — never (no editorial shell) <sup>b</sup> |
| **Add a participant (Assign)** | • Panel administrators — the **Assign** button appears only for them (live-probed: present for manager-scope dbarnes and assigned section editor dbuskins; **absent** for assistant mfritz)<br>• **A recommend-only section editor counts as an administrator here** — the Assign gate is any SE assignment in the stage, which a recommend-only editor satisfies; **verified live end-to-end** (minoue, recommend-only SE, saw **Assign** and added a Journal-editor participant → new stage_assignment) — resolves Open question 1<br>• Assistants — never (read-only) <sup>c</sup> |
| **Edit a participant's flags** (recommend-only / can-change-metadata) | • Managers / site admins — any participant<br>• Assigned section editors — any participant **except themselves, any manager/admin participant, and (if the editor is recommend-only) any other editor participant**<br>• Assistants — never <sup>d</sup> |
| **Remove a participant** | • Panel administrators (live-probed: assigned section editor dbuskins removed an assistant end-to-end)<br>• Assistants — never<br>• No confirmation guard beyond an "Are you sure" dialog; removal is immediate <sup>e</sup> |
| **Set the recommend-only flag on an assignment** | • Only when the assignment is a **manager or section-editor role** (the checkbox is hidden for author/assistant roles — live-probed)<br>• ⚠ The *self* guard and the *recommend-only-editor* guard apply **only via the Edit path**. In **add** mode the checkbox is offered (visible + **enabled**) for any manager/section-editor pick regardless of the acting user, and a **recommend-only editor CAN set recommend-only on a participant they add** — live-verified: minoue (recommend-only SE) added sberardo as a Section editor with the box checked → `recommend_only=1`. See Known deviations + Open question 2 (what the flag *does* is owned by `recommend-only-editors`) <sup>f</sup> |
| **Notify a participant / start a discussion** | • Anyone who can see the panel, including assistants — every participant row's ⋯ menu offers **Notify**, which opens a message that is delivered as an email *and* recorded as a submission discussion (owned by `tasks-discussions`); live-probed: assistant mfritz's row ⋯ menu offered **only Notify** <sup>g</sup> |
| **Log in as a participant** | • Whoever holds **full administration authority** over the participant — a journal manager within their journal, and site admins — gated by the server-computed `participant.canLoginAs` (`Validation::canUserLoginAs`, full-administration level, non-self); the ⋯ menu shows **Log In As** only for such rows (live-probed: **manager dbarnes** saw Log In As on the copyeditor's row — not site-admin-only). The impersonation act is owned by `login-as` <sup>h</sup> |
| **Be granted access by assignment** | • The assigned user — an assignment grants the **stages configured on the assignment's user group** (e.g. a Copyeditor assignment opens only Copyediting); computation owned by `workflow-stage-navigation` <sup>i</sup> |

<sup>a</sup> ParticipantManager.vue; participantManagerStore.js; useParticipantManagerConfig.js (`getTopItems`/`getItemActions`); StageParticipantGridHandler::__construct() (role ops); live probes 2026-07-03 ·
<sup>b</sup> PKPSubmissionController::getParticipants() + authorize() (`getParticipants` → SubmissionAccessPolicy; route group MANAGER/SUB_EDITOR/ASSISTANT); Collector::assignedTo(); live probes ·
<sup>c</sup> useParticipantManagerConfig.getTopItems() (`hasCurrentUserAtLeastOneAssignedRoleInStage([MANAGER,SITE_ADMIN,SUB_EDITOR])`); StageParticipantGridHandler::_canAdminister() (global-role check for the legacy modal); maps/Schema.php getPropertyStages() (manager-scope global-role injection); live probes (dbarnes/dbuskins yes, mfritz no) ·
<sup>d</sup> useCurrentUser.canCurrentUserEditParticipant(); AddParticipantForm::_isChangePermitMetadataAllowed()/_isChangeRecommendOnlyAllowed() (self + role guards) ·
<sup>e</sup> useParticipantManagerActions.participantRemove() (confirm dialog → legacy `deleteParticipant`); StageParticipantGridHandler::deleteParticipant(); live-probed (dbuskins removed mfritz → assignment gone) ·
<sup>f</sup> AddParticipantForm::_isChangeRecommendOnlyAllowed() (self + recommend-only-editor guards) — **used only in the `$assignmentId` (Edit) branch** of `execute()`/`fetch()`; the add branch calls `Repo::stageAssignment()->build()` with the raw `recommendOnly` post value, ungated; StageParticipantNotifyHandler.js updateRecommendOnly() shows/enables the checkbox purely by group membership (`possibleRecommendOnlyUserGroupIds` = manager+sub-editor groups), never checking the acting user's recommend-only status; live-verified add-mode toggle ·
<sup>g</sup> useParticipantManagerConfig.getItemActions() (Notify always pushed); StageParticipantGridHandler::viewNotify()/sendNotification(); tasks-discussions owns the discussion ·
<sup>h</sup> getItemActions() (`participant.canLoginAs`); submission/maps/Schema.php `getPropertyCanLoginAs()` → Validation::canUserLoginAs() (full-administration level, non-self — so journal managers qualify, not only site admins); useUserAuth.getDashboardLoginAsUrl(); live-probed (manager dbarnes saw Log In As) ·
<sup>i</sup> Repository::getAccessibleWorkflowStages(); registry/userGroups.xml (`stages`); workflow-stage-navigation rule 5; live-probed (mfritz opened copyediting once assigned Copyeditor)

## Fields & validation

The **Assign Participant** modal (legacy `AddParticipantForm`, opened from the panel's
**Assign** button or a row's **Edit** action). In **add** mode it has a user picker, the two
flag checkboxes, and a notify block; in **edit** mode it drops the picker and the notify
block and shows only the flags applicable to the existing assignment.

| Field (UI label) | Required? | Rules | Anchor |
|------------------|-----------|-------|--------|
| **Locate a User** (search grid with a role filter) | Yes (add) | A radio-select list filtered by the chosen role; searchable by name; **excludes users already assigned to that role on this stage**, and (in review stages) warns before adding a user who is an in-progress anonymous reviewer | UserSelectGridHandler::loadData() (`filterExcludeSubmissionStage`); AddParticipantForm::fetch() (`anonymousReviewerIds`) |
| **Role** (the user-group filter above the grid) | Yes | Offers the **non-reviewer user groups whose stage config includes this stage** (`user_group_stage`), so the set is **genuinely stage-specific and NOT nested** — a role can appear on some stages and drop on others. On the default `publicknowledge` groups (live-verified role dropdown per stage): **Submission (1)** = Journal editor, Section editor, Guest editor, Funding coordinator, Author, Translator; **Review (3)** = the same six (Reviewer excluded); **Copyediting (4)** = Journal editor, Production editor, Section editor, Guest editor, Copyeditor, **Marketing and sales coordinator**, Author, Translator — i.e. Production editor / Copyeditor / Marketing-and-sales-coordinator are **added but Funding coordinator DROPS OFF** (it is stage-scoped to 1,3); **Production (5)** = Journal editor, Production editor, Section editor, Guest editor, Designer, Indexer, Layout Editor, Proofreader, Author, Translator. The picked group **is** the assignment's role | UserSelectGridHandler::renderFilter()/getFilterForm() (`searchUserFilter.tpl`) / AddParticipantForm::fetch() (`getUserGroupsByStage`, reviewers skipped); registry/userGroups.xml `stages` |
| **Recommend only** (checkbox) | No | Rendered (visible + enabled) only after a user in a **manager/section-editor** group is selected (hidden for author/assistant roles — live-probed: manager pick → shown, section-editor pick → shown, copyeditor & author picks → hidden); pre-checked if the group is configured recommend-only. ⚠ In **add** mode it is **NOT** disabled for a recommend-only editor (only the **Edit** path applies the self / recommend-only-editor guards) — see Known deviations | addParticipantForm.tpl (`recommendOnlyWrapper`, unconditional in add mode); StageParticipantNotifyHandler.js updateRecommendOnly() (group-based show/enable only) |
| **Can change metadata** (checkbox) | No | Rendered for **non-manager** group selections (managers are always allowed and get no checkbox — live-probed: manager pick → hidden, section-editor & copyeditor picks → shown); pre-checked if the group is configured to permit metadata edit; on **submit** the value is forced `true` for a manager-role assignment regardless of the checkbox (`canChangeMetadata = roleId==MANAGER ? true : post`); the *self* guard applies only via the Edit path. Semantics (who may edit publication metadata) owned by the metadata specs | addParticipantForm.tpl (`submissionEditMetadataPermit`); StageParticipantNotifyHandler.js updateSubmissionMetadataEditPermitOption(); AddParticipantForm::execute() (manager force-true) |
| **Choose a predefined message** (template select) | No | Offers the stage's **discussion** template as default plus a stage-specific alternate — Submission → "Assign Editor" (`EDITOR_ASSIGN_SUBMISSION`); Copyediting → "Request Copyedit" (`COPYEDIT_REQUEST`); selecting one loads its body | PKPStageParticipantNotifyForm::fetch() (`alternateTo`); StageMailable::getStageMailable() |
| **Message** (rich text) | No | **Optional on add** — if left blank the user is added silently (no email, no discussion); if filled, the message is emailed to the assigned user and opened as a submission discussion | AddParticipantForm::isMessageRequired() (`false`); PKPStageParticipantNotifyForm::execute() (`if getData('message')`) |

Server-set / not user-visible: `submissionId`, `stageId`, `dateAssigned`, and the resolved
`userGroupId`/`userId` from the picker. The standalone **Notify** action (row ⋯ menu) opens
the same notify form but with the message **required**. <sup>a</sup>

<sup>a</sup> AddParticipantForm::readInputData()/execute(); PKPStageParticipantNotifyForm (base, `isMessageRequired()` → true)

## Rules & state

1. **Two live surfaces for one job — a read manager over a legacy write grid.** The
   **list** is the Vue `ParticipantManager`, which fetches
   `GET api/v1/submissions/{id}/participants/{stageId}` and re-renders on any data change.
   Every **mutation** — Assign, Edit, Remove, Notify — hands off to the legacy
   `StageParticipantGridHandler` via a modal or a direct call
   (`useParticipantManagerActions` opens `grid.users.stageParticipant...`). Both paths are
   live in 3.6 (the Vue manager superseded the grid's *list* rendering but the grid still
   backs the add/edit/remove/notify forms). Assistants get the grid's read-only op set
   (`fetchGrid`/`viewNotify`/`sendNotification`); managers/site-admins/section-editors add
   `addParticipant`/`saveParticipant`/`deleteParticipant`/`fetchUserList`. <sup>a</sup>
2. **The list is per-stage, one row per assignment, and includes the author.** The API
   returns the users `assignedTo` this submission and stage; the manager flattens them so a
   user holding two roles yields **two rows**, sorted by role id then user-group id. Each
   row shows the avatar, full name, the role (user-group) name, and a **Recommend only**
   badge when the assignment carries that flag. The author's author-role assignment appears
   here like any other (live-probed: "Author Tester — Author" on every seed). <sup>b</sup>
3. **A stage_assignment is the unit of assignment.** Adding builds a `stage_assignments` row
   keyed (submission, user-group, user) with `recommend_only`, `can_change_metadata`, and
   `dateAssigned` (verified: add created row 1230 with `recommend_only=0`,
   `can_change_metadata=1` for a Journal-editor assignment). ⚠ `Repo::stageAssignment()->build()`
   uses **firstOr** — re-assigning a user to a role they already hold on the submission is a
   **no-op that silently keeps the old flags**, so the Assign modal cannot be used to change
   an existing assignment's recommend-only/metadata flags (use **Edit** instead). The Edit
   path updates only the flags the current user is allowed to change. <sup>c</sup>
4. **The picker offers the stage's non-reviewer roles, and excludes users already in them.**
   The role dropdown lists the user groups configured for the panel's stage
   (`getUserGroupsByStage`), minus reviewer groups; the set is genuinely stage-specific and
   **not nested** — a role present on one stage can be absent on another (live: Funding
   coordinator is offered at Submission/Review but **drops off** Copyediting/Production, while
   Copyeditor/Marketing-and-sales-coordinator appear only at Copyediting — full per-stage
   lists in Fields → Role). The user grid excludes anyone already
   assigned to the selected role on this stage, and — in review stages — flags in-progress
   anonymous reviewers with a warning so an editor does not break review anonymity by adding
   a reviewer as a participant. <sup>d</sup>
5. **The two flag checkboxes appear conditionally by role** (live-verified toggle). Selecting
   a user reveals **Recommend only** only if the chosen group is a manager/section-editor
   role (pre-checked when the group itself is configured recommend-only), and reveals **Can
   change metadata** only if the chosen group is **not** a manager role (managers are
   implicitly allowed and the value is forced `true` on submit). The self / recommend-only
   restrictions on these flags live in the **Edit** path only: `_isChangeRecommendOnlyAllowed`
   / `_isChangePermitMetadataAllowed` gate the checkboxes when editing an *existing* assignment
   (a section editor cannot change either flag on their **own** row; a recommend-only editor
   cannot change recommend-only). ⚠ In **add** mode those guards are **not** applied — the
   checkbox is shown+enabled purely by the selected group, so a recommend-only editor **can**
   set recommend-only on a participant they newly add (live-verified — Known deviations). The
   recommend-only flag's *behaviour* (a recommend-only editor may only recommend, not decide)
   is owned by `recommend-only-editors` and `editorial-decisions`. <sup>e</sup>
6. **Add, with optional notify.** Submitting the modal (a) builds the stage_assignment (rule
   3); (b) if an editor role was added, **clears the "an editor needs to be assigned" task**
   for the submission and refreshes the manager's decision-stage notifications; (c) if a
   **message** was entered, sends it and opens a discussion (rule 7); (d) writes a
   **participant-added** event-log entry (`SUBMISSION_LOG_ADD_PARTICIPANT`,
   "submission.event.participantAdded" — verified log 3016); (e) raises a trivial success
   toast ("User added as a stage participant."). A blank message adds the participant with no
   email and no discussion (verified: assigning a copyeditor with no message produced no
   mail). <sup>f</sup>
7. **Notify is discussion-shaped, not a bare email.** When a message is present (on add, or
   via the standalone Notify action), `PKPStageParticipantNotifyForm` creates a submission
   **discussion** (an `EditorialTask` of type DISCUSSION) seeded with the message as its head
   note, adds the recipient **and** the sender as discussion participants, raises a
   **`NOTIFICATION_TYPE_NEW_QUERY`** task notification for the recipient, and sends the
   stage's discussion **mailable** to the recipient (verified end-to-end: adding dbarnes with
   a message delivered "You have been assigned as an editor…" to `dbarnes@mailinator.com`,
   created query id 11, and a NEW_QUERY notification; a second event-log entry
   `SUBMISSION_LOG_MESSAGE_SENT` "informationCenter.history.messageSent" — log 3015 — records
   the send). The discussion machinery is owned by `tasks-discussions`. <sup>g</sup>
8. ⚠ **The dedicated "editor assigned" notification (`NOTIF-editor-assign`) never fires
   through this flow.** `PKPStageParticipantNotifyForm::sendMessage()` only creates
   `NOTIFICATION_TYPE_EDITOR_ASSIGN` in a `case 'EDITOR_ASSIGN'` branch keyed on the **exact**
   template `EDITOR_ASSIGN`, but the 3.4 migration split that template into stage variants
   (`EDITOR_ASSIGN_{SUBMISSION,REVIEW,PRODUCTION}`) and the picker only ever offers those
   variants (live: "Assign Editor" resolves to `EDITOR_ASSIGN_SUBMISSION`). The exact key is
   no longer produced, so the branch is dead — verified: assigning an editor with the "Assign
   Editor" template created a NEW_QUERY notification but **no** `EDITOR_ASSIGN` notification
   (type 16777255 absent from the DB), and the send logged as a plain discussion notification.
   Documented as a dead-code candidate; the notification's only creator is this branch.
   Verifier re-confirmed: `$templateKey = getData('template')`, the notify picker's "Assign
   Editor" option carries value `EDITOR_ASSIGN_SUBMISSION` (observed in the live modal), the
   `switch($templateKey)` has no case for the stage variants, and the whole test DB holds
   **zero** rows of type `0x1000027` (16777255) while carrying hundreds of `NEW_QUERY`. The two
   other references to the constant (`PKPNotificationManager` lines 59/173) are display/URL
   handlers, not creators. <sup>h</sup>
9. **Assignment grants role-scoped stage access — the point of the whole panel.** A new
   assignment immediately opens the stages configured on the assignment's user group for that
   user (verified live **as the affected user**: mfritz's `GET participants/416/4` returned
   **401 `roleBasedAccessDenied`** before assignment and flipped to **200** the instant a
   manager assigned mfritz as **Copyeditor** on 416 — no re-login needed). The access matrix, the manager-scope
   fallback, and the manager-as-reviewer suppression are all owned by
   `workflow-stage-navigation` (rule 5); this spec owns only the assignment that feeds it.
   <sup>i</sup>
10. **Assistant scoping.** Copyeditors, layout editors, and proofreaders are assigned into
    stage-scoped groups (default: Copyeditor → Copyediting; Layout editor & Proofreader →
    Production) and see the workflow only for those stages; within the panel they are strictly
    **read-only** (rule 1) — they can view the roster and use Notify, but see no Assign, Edit,
    or Remove (live-probed: mfritz's panel on 416 had no Assign button and only a read view).
    Which stages a group covers is journal configuration (`workflow-stage-navigation`
    Settings). <sup>j</sup>
11. **Remove deletes the assignment and detaches the user from the submission's work.**
    `deleteParticipant` (CSRF-guarded, and only for an assignment on this submission) deletes
    the `stage_assignments` row, **removes the user from the submission's tasks/discussions**,
    recomputes decision-stage and (in copyediting/production) copyedit/production assignment
    notifications, and writes a **participant-removed** event-log entry
    (`SUBMISSION_LOG_REMOVE_PARTICIPANT`, "submission.event.participantRemoved"). The user's
    access to the submission is revoked with the row. Verified end-to-end: dbuskins removed
    mfritz → row 1231 gone, log 3018 written; and **re-probed as the removed user** — mfritz's
    `GET participants/416/4` was **200** while assigned and returned to **401
    `roleBasedAccessDenied`** the instant a manager removed the assignment. <sup>k</sup>
12. **Auto-assignment at submission time seeds the initial participants** (the
    `subeditor_submission_group` seam). On `SubmissionSubmitted`, the section/category editors
    **mapped to the submission's section (and any category)** in `subeditor_submission_group`
    are auto-assigned as participants via the same `build()` (carrying the group's
    recommend-only default) and each receives a `SUBMISSION_SUBMITTED` notification. If that
    mapping yields **no** editor, every journal manager instead gets an "editor needs to be
    assigned" task (`NOTIFICATION_TYPE_EDITOR_ASSIGNMENT_REQUIRED`) and a `SubmissionNeedsEditor`
    email (owned by `editorial-tasks`/`editorial-dashboards`). The `subeditor_submission_group`
    table is the section/category → sub-editor map (verified: section 2 → dbarnes/dbuskins/
    sberardo, section 3 → dbarnes/minoue, all as Section editor); **writing** that map is
    journal/section setup (`sections-configuration` / `roles-permissions`), and it does **not**
    itself grant access — only the `stage_assignments` rows it produces do. <sup>l</sup>

<sup>a</sup> participantManagerStore.js (`participants/{stageId}` fetch, `useDataChanged`); useParticipantManagerActions.js (`openLegacyModal`/`deleteParticipant`); StageParticipantGridHandler::__construct() (assistant read-only vs admin ops) ·
<sup>b</sup> PKPSubmissionController::getParticipants() (`assignedTo`, `summarizeManyReviewers`); participantManagerStore.participantsList (flatten + sort); ParticipantManagerItemInfoRecommendOnly.vue; live probes ·
<sup>c</sup> Repository::build() (`firstOr` on submission+user+userGroup); AddParticipantForm::execute() (insert vs flag-update branch); schemas/stageAssignment columns `recommendOnly`/`canChangeMetadata`; DB verify (row 1230) ·
<sup>d</sup> Repo::userGroup()->getUserGroupsByStage() (reviewers skipped); Collector::filterExcludeSubmissionStage(); AddParticipantForm::fetch() (`anonymousReviewerIds`); live probes (stage-1 vs stage-4 role lists) ·
<sup>e</sup> StageParticipantNotifyHandler.js updateRecommendOnly()/updateSubmissionMetadataEditPermitOption(); AddParticipantForm::_isChangeRecommendOnlyAllowed()/_isChangePermitMetadataAllowed(); live-probed (editor group → recommend-only shown, manager → metadata hidden) ·
<sup>f</sup> StageParticipantGridHandler::saveParticipant() (editor-required task delete, trivial notification, add event log); live probes (toast + log 3016) ·
<sup>g</sup> PKPStageParticipantNotifyForm::sendMessage() (EditorialTask+Participant+Note create, NEW_QUERY, Mail::send), execute() + _logEventAndCreateNotification(); StageMailable::getStageMailable(); live: Mailpit + query 11 + logs 3015/3016 ·
<sup>h</sup> PKPStageParticipantNotifyForm::sendMessage() (`switch $templateKey` case 'EDITOR_ASSIGN' → _addAssignmentTaskNotification); I5716_EmailTemplateAssignments::getEditorAssignTemplates() (EDITOR_ASSIGN_SUBMISSION/REVIEW/PRODUCTION); grep: sole creator of NOTIFICATION_TYPE_EDITOR_ASSIGN; DB verify (type 16777255 absent) ·
<sup>i</sup> Repository::getAccessibleWorkflowStages(); workflow-stage-navigation rule 5; live probe (mfritz copyediting access) ·
<sup>j</sup> useParticipantManagerConfig.getItemActions() (assistant → Notify only); registry/userGroups.xml stage lists; live probe (mfritz read-only panel) ·
<sup>k</sup> StageParticipantGridHandler::deleteParticipant() (CSRF + submission check, `removeParticipantFromSubmissionTasks`, notification recompute, remove event log); live: row 1231 deleted, log 3018 ·
<sup>l</sup> AssignEditors::handle(); SubEditorsDAO::assignEditors() (`getBySubmissionGroupIds` SECTION+CATEGORY → `build`, SUBMISSION_SUBMITTED notifications); SubmissionsMigration (subeditor_submission_group); DB verify (section→editor map)

## Side effects

- **Email.** A notified assignment sends the **stage discussion mailable** (`DiscussionSubmission`
  / `DiscussionReview` / `DiscussionCopyediting` / `DiscussionProduction`, body swappable to
  the stage's editor-assign or request template) to the **assigned user**, from the acting
  user (verified in Mailpit). Delivery + the per-submission email log
  (`SubmissionEmailLogEventType`, default `DISCUSSION_NOTIFY`) are owned by `email-delivery`.
  The `EditorAssigned` mailable (`MAIL-editor-assigned`, template `EDITOR_ASSIGN`) is **not**
  used by this flow (owned by `email-delivery`; see Open questions).
- **Discussion + notification.** A notified assignment opens a submission discussion and
  raises a `NOTIFICATION_TYPE_NEW_QUERY` task notification for the recipient (owned by
  `tasks-discussions`/`notifications`). ⚠ The stage-participant-specific
  `NOTIFICATION_TYPE_EDITOR_ASSIGN` is **never raised** (rule 8).
- **Event log.** `SUBMISSION_LOG_ADD_PARTICIPANT` on every add and
  `SUBMISSION_LOG_REMOVE_PARTICIPANT` on every remove (both recording the affected user's name
  + role); a notified add additionally writes `SUBMISSION_LOG_MESSAGE_SENT`. The log surface is
  owned by `editorial-activity-log`.
- **Task/notification recomputation.** Adding an editor clears the submission's
  `EDITOR_ASSIGNMENT_REQUIRED` task; adding/removing in copyediting or production recomputes
  the copyedit/production assignment + awaiting notifications; both refresh the manager's
  decision-stage notifications.
- **Cross-entity.** The `stage_assignments` row itself; removal also detaches the user from
  the submission's discussions/tasks (`removeParticipantFromSubmissionTasks`). Auto-assignment
  writes stage_assignments and `SUBMISSION_SUBMITTED` notifications from
  `subeditor_submission_group`, or a `SubmissionNeedsEditor` email when no editor is mapped.

## Settings that modify behavior

- **User-group stage configuration** (Settings → Users & Roles → edit role → stages): decides
  which roles the Assign picker offers per stage **and** which stages an assignment grants
  (the access effect, `workflow-stage-navigation`). Reviewer groups are always excluded.
- **Recommend-only role config** (`recommend-only-editors`): a user group flagged recommend-only
  pre-checks the Assign modal's Recommend-only box; what the flag does lives in that spec.
- **Permit-metadata-edit group config**: a group flagged to permit metadata edit pre-checks the
  Can-change-metadata box; managers are always permitted (no checkbox).
- **Section/category editor assignments** (`subeditor_submission_group`, written in section &
  category setup): the pool auto-assigned as participants at submission time (rule 12).
- **Email templates** (Settings → Workflow → Emails): enabling an alternate of a stage's
  discussion template adds it to the notify picker; the stage's own discussion template is the
  default body.

## Cross-feature interactions

- **workflow-stage-navigation** — owns the accessible-stage matrix that an assignment feeds,
  the manager-scope fallback, and the manager-as-reviewer suppression; this spec owns the
  assignments themselves.
- **editorial-decisions** — the workflow **Assign** here is the participant grid, **not** a
  decision type (OJS has no "Assign Editor" decision); that spec owns the *recommendation act*
  a recommend-only editor performs, while this spec owns the recommend-only **flag** placed on
  their assignment.
- **editorial-dashboards / editorial-tasks** — the dashboard "Needs editor" alert and the
  `EDITOR_ASSIGNMENT_REQUIRED` task open this panel to assign an editor; auto-assignment's
  needs-editor fallback lives there.
- **recommend-only-editors** — owns the recommend-only role configuration and the behaviour of
  the flag this panel sets.
- **assign-and-manage-reviewers** — reviewers are added through a **separate** flow (the Reviewers
  panel), never this picker, which excludes reviewer groups.
- **tasks-discussions** — owns the discussion/query that a notify message opens and the
  `NEW_QUERY` notification.
- **copyediting-stage / production-stage** — own the `COPYEDIT_REQUEST` / `LAYOUT_REQUEST`
  notify templates and their assignment notifications (`COPYEDIT_ASSIGNMENT` / `LAYOUT_ASSIGNMENT`).
- **roles-permissions / user-management / sections-configuration** — own the user groups, the
  users the picker searches, and the `subeditor_submission_group` write surface.
- **publication-metadata** (or the owning metadata spec) — owns what the `can-change-metadata`
  flag permits.
- **email-delivery** — owns mailable delivery + the email log, and the `EditorAssigned` mailable.

## Canonical scenarios

1. **Editor assigns a section editor and notifies them** — a manager opens the Participants
   panel, clicks **Assign**, picks a Section-editor user, types a message, and submits: the
   participant appears in the list, the assignee receives the stage email, a submission
   discussion opens, and the participant-added event is logged (verified end-to-end).
2. **The picker offers stage-appropriate roles (not a nested superset)** — on the Submission
   stage the role filter lists Journal editor / Section editor / Guest editor / Funding
   coordinator / Author / Translator; on Copyediting it **drops Funding coordinator** and adds
   Production editor, Copyeditor, and **Marketing and sales coordinator** — always excluding
   reviewers (verified live per stage).
3. **Flags surface only for the right roles** — selecting an editor-role user reveals the
   Recommend-only checkbox; selecting a manager hides Can-change-metadata (managers always may);
   selecting a copyeditor hides Recommend-only and shows Can-change-metadata (verified live).
4. **Assign an assistant, scoped to their stage** — a manager assigns a copyeditor on a
   copyediting submission; the copyeditor can now open the Copyediting pane (and only that
   stage), demonstrating the access-grant effect (verified: mfritz gained copyediting access).
5. **An assigned section editor administers the panel** — a section editor holding a stage
   assignment (not a manager) sees the Assign button, adds a participant, and removes one; the
   removal deletes the assignment and logs it (verified: dbuskins removed mfritz).
6. **An assistant sees the roster read-only** — a copyeditor opens the submission they are
   assigned to; the Participants panel lists everyone but shows **no Assign button**, and each
   row's ⋯ menu offers **only Notify** — no Edit, Remove, or Log In As (verified live: mfritz's
   panel had no Assign and a row menu of `["Notify"]`, vs a manager's `["Edit","Notify","Login
   As","Remove"]` on the same row).
7. **Silent assign vs notified assign** — leaving the message blank adds the participant with no
   email and no discussion; filling it sends the email and opens a discussion (verified both).
8. **Remove revokes access** — removing a participant deletes their stage_assignment, detaches
   them from the submission's discussions, logs the removal, and closes their access to that
   stage of the workflow.
9. **Auto-assignment at submission** — when a manuscript is submitted, the section's configured
   section editors are auto-assigned as participants (from `subeditor_submission_group`) and
   notified; if the section has no editor mapped, journal managers get a "needs editor" task
   instead (verified: seeded submissions carried their section's editors).
10. **A recommend-only section editor can still administer the panel** — an editor whose stage
    assignment carries the recommend-only flag holds a Section-editor assignment, so they see
    the **Assign** button and can add participants end-to-end (verified live: minoue, a
    recommend-only SE, added a Journal-editor participant → new stage_assignment). They cannot
    change recommend-only on an *existing* assignment (Edit path), but ⚠ in add mode nothing
    stops them stamping recommend-only on someone they add (verified live — Known deviations).

## Known deviations (as-built ≠ intent)

- ⚠ **`NOTIF-editor-assign` is unreachable (dead notification).** Its sole creator is the
  `case 'EDITOR_ASSIGN'` branch in `PKPStageParticipantNotifyForm::sendMessage()`, which matches
  the exact template key `EDITOR_ASSIGN`; the 3.4 migration `I5716` renamed that template into
  stage variants (`EDITOR_ASSIGN_SUBMISSION/REVIEW/PRODUCTION`) that the picker offers instead,
  so the branch never runs (DB-verified: no `EDITOR_ASSIGN` notification is created; only a
  `NEW_QUERY` is). Recorded as a dead-code candidate (`UNASSIGNED.md`); propose an e2e ledger row.
  Suspected intent: the switch should recognise the stage-variant keys (or the notification was
  meant to survive the rename).
- ⚠ **Re-assigning an existing participant silently drops new flags.** `Repository::build()` uses
  `firstOr`, so re-adding a user to a role they already hold on the submission returns the
  existing row untouched — the recommend-only / can-change-metadata values entered in the Assign
  modal are ignored (the Edit action is the only way to change them). No error is shown. Same
  `firstOr` caveat noted in the scenario docs. Suspected intent: either update the flags or warn.
- ⚠ **The recommend-only / self flag guards are enforced on Edit but skipped on Add.**
  `AddParticipantForm::_isChangeRecommendOnlyAllowed()` / `_isChangePermitMetadataAllowed()`
  (which block a recommend-only editor from touching recommend-only, and a section editor from
  touching their own flags) are consulted **only** in the `$assignmentId` (Edit) branch of
  `execute()`/`fetch()`. In **add** mode the template renders the checkboxes unconditionally,
  the legacy JS shows+enables them purely by the selected group, and `execute()` passes the raw
  post value into `build()` — so a **recommend-only section editor can set recommend-only on a
  brand-new participant they add**, even though they cannot change it via Edit. Live-verified:
  minoue (recommend-only SE) added sberardo as a Section editor with the box checked →
  `recommend_only=1`. Internally inconsistent (same conceptual guard applied in one path, not the
  other); propose an e2e ledger row. Suspected intent: apply the guard on the add path too.

## Open questions

1. **RESOLVED — a recommend-only section editor CAN add participants.** The Assign button is
   gated on holding *any* section-editor assignment in the stage, which a recommend-only editor
   satisfies, and no add-path check consults recommend-only. Verified live end-to-end: minoue (a
   recommend-only SE) saw **Assign** and added a Journal-editor participant → new stage_assignment
   row. (As-built fact; whether it *should* be allowed is a product call, but the observed
   boundary is now definite.) Folded into the permission matrix + scenario 10.
2. **Should the add path enforce the recommend-only / self flag guards?** As-built, a recommend-only
   editor can stamp recommend-only on a participant they *add* but not one they *edit* (Known
   deviations). Intended, or an oversight to be closed by applying the Edit-path guard on add?
3. **`can-change-metadata` ownership.** This spec documents the checkbox as a field of the Assign
   modal; the *meaning* of the flag (which participants may edit publication metadata) belongs to
   a metadata/permissions spec — which one should own it?
4. **`EditorAssigned` mailable liveness.** With the stage-participant flow using the stage
   discussion mailables, is the `EditorAssigned` mailable (template `EDITOR_ASSIGN`) reached by
   any surface, or is it — like `NOTIF-editor-assign` — a casualty of the 3.4 template split?
   (Owned by `email-delivery`; flagged here because it is the same rename.)

---

## Reference — entry points & surfaces

| Entry | Path | Atom |
|-------|------|------|
| Participants panel (list) | Workflow stage pane → **Participants** (`ParticipantManager`), fed by `GET api/v1/submissions/{id}/participants/{stageId}` | VUE-participant-manager |
| Add / Edit / Remove / Notify modals | Legacy `grid.users.stageParticipant.StageParticipantGridHandler` (ops `addParticipant`, `saveParticipant`, `deleteParticipant`, `viewNotify`, `sendNotification`, `fetchUserList`) | GRID-lib-pkp-grid-users-stage-participant-stage-participant-grid-handler |
| User picker inside the Add modal | Legacy `grid.users.userSelect.UserSelectGridHandler` (`fetchGrid`/`fetchRows`), role-filtered, excludes already-assigned + anonymous reviewers | GRID-lib-pkp-grid-users-user-select-user-select-grid-handler |
| Assignment storage | `stage_assignments` (submission × user-group × user; `recommend_only`, `can_change_metadata`, `date_assigned`) | DB-stage_assignments |
| Section/category → sub-editor map | `subeditor_submission_group` (auto-assignment source; written in section/category setup) | DB-subeditor_submission_group |
| Add/remove event-log types | `SUBMISSION_LOG_ADD_PARTICIPANT` / `SUBMISSION_LOG_REMOVE_PARTICIPANT` | EVLOG-SUBM-ADD-PART, EVLOG-SUBM-REM-PART |
| Editor-assigned task notification | `NOTIFICATION_TYPE_EDITOR_ASSIGN` (⚠ unreachable — Known deviations) | NOTIF-editor-assign |

## Reference — code anchors

- **Vue manager**: `lib/ui-library/src/managers/ParticipantManager/` — `ParticipantManager.vue`,
  `participantManagerStore.js` (`participantsList` flatten/sort, fetch), `useParticipantManagerConfig.js`
  (`getTopItems`/`getItemActions`/`getItemInfoItems` — the affordance gates),
  `useParticipantManagerActions.js` (legacy modal/`deleteParticipant` wiring),
  `ParticipantManagerItemInfoRecommendOnly.vue`.
- **Frontend gates**: `lib/ui-library/src/composables/useCurrentUser.js`
  (`hasCurrentUserAtLeastOneAssignedRoleInStage`, `canCurrentUserEditParticipant`).
- **Legacy grid + forms**: `lib/pkp/controllers/grid/users/stageParticipant/StageParticipantGridHandler.php`
  (`_canAdminister`, `addParticipant`/`saveParticipant`/`deleteParticipant`/`fetchUserList`,
  add/remove event logs); `.../form/AddParticipantForm.php` (`fetch`/`execute`,
  `_isChangeRecommendOnlyAllowed`/`_isChangePermitMetadataAllowed`);
  `.../form/PKPStageParticipantNotifyForm.php` (`sendMessage` — discussion + email + the
  `EDITOR_ASSIGN` switch); `lib/pkp/templates/controllers/grid/users/stageParticipant/addParticipantForm.tpl`;
  `lib/pkp/js/controllers/grid/users/stageParticipant/form/StageParticipantNotifyHandler.js`
  (checkbox toggles); `lib/pkp/controllers/grid/users/userSelect/UserSelectGridHandler.php`.
- **Mailable selection**: `lib/pkp/controllers/grid/queries/traits/StageMailable.php`
  (stage → `Discussion*` mailable); `lib/pkp/classes/migration/upgrade/v3_4_0/I5716_EmailTemplateAssignments.php`
  (`EDITOR_ASSIGN_*` split).
- **API + data**: `lib/pkp/api/v1/submissions/PKPSubmissionController.php` (`getParticipants`,
  `authorize` → SubmissionAccessPolicy); `lib/pkp/classes/user/Collector.php` (`assignedTo`,
  `filterExcludeSubmissionStage`); `lib/pkp/classes/user/maps/Schema.php` (`summarizeManyReviewers`).
- **Assignment engine + auto-assign**: `lib/pkp/classes/stageAssignment/Repository.php` (`build`, `firstOr`);
  `lib/pkp/classes/observers/listeners/AssignEditors.php`; `lib/pkp/classes/context/SubEditorsDAO.php`
  (`assignEditors`); `lib/pkp/classes/migration/install/SubmissionsMigration.php`
  (`subeditor_submission_group`); `lib/pkp/classes/migration/install/RolesAndUserGroupsMigration.php`
  (`stage_assignments`).
