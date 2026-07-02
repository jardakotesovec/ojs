---
name: tasks-discussions
scope: Editorial teams coordinate work on a submission through per-stage tasks (with owner + due date) and discussions (threaded conversations), optionally seeded from journal-level templates
shared: pkp-lib
status: verified
e2e-plans: [discussions.md, editorial-tasks.md, notifications.md]
atlas-claims:
  - API-editorial-task-add-task
  - API-editorial-task-edit-task
  - API-editorial-task-delete-task
  - API-editorial-task-get-task
  - API-editorial-task-get-tasks
  - API-editorial-task-close-task
  - API-editorial-task-open-task
  - API-editorial-task-start-task
  - API-editorial-task-from-template
  - API-editorial-task-add-note
  - API-editorial-task-delete-note
  - API-editorial-task-get-participants
  - API-edit-task-template-add
  - API-edit-task-template-update
  - API-edit-task-template-delete
  - API-edit-task-template-get-variables
  - API-edit-task-template-get-many
  - AUTHZ-query-access-policy
  - AUTHZ-query-write-policy
  - AUTHZ-query-required-policy
  - AUTHZ-query-assigned-to-user-access-policy
  - AUTHZ-query-workflow-stage-access-policy
  - AUTHZ-query-user-accessible-workflow-stage-required-policy
  - AUTHZ-note-access-policy
  - EVLOG-TASK-CRT
  - EVLOG-TASK-STRT
  - EVLOG-TASK-CLOSE
  - EVLOG-TASK-OPEN
  - EVLOG-TASK-NOTE
  - EVLOG-TASK-OVRDUE
  - EVLOG-TASK-FILE-UP
  - EVLOG-TASK-FILE-RM
  - EVLOG-TASK-DUE-MOD
  - EVLOG-TASK-ASGN
  - EVLOG-TASK-REASS
  - EVLOG-TASK-PART-ADD
  - EVLOG-TASK-PART-REM
  - EVLOG-EMAIL-DISC-NOT
  - MAIL-discussion-submission
  - MAIL-discussion-review
  - MAIL-discussion-copyediting
  - MAIL-discussion-production
  - NOTIF-new-query
  - VUE-discussion-manager
  - VUE-task-template-manager
  - DB-edit_tasks
  - DB-edit_task_settings
  - DB-edit_task_participants
  - DB-edit_task_templates
  - DB-edit_task_template_settings
  - DB-edit_task_template_user_groups
  - DB-notes
  - GRID-lib-pkp-grid-notifications-task-notifications-grid-handler
  - LOC-submission-submission-query
  - LOC-submission-submission-task
  - LOC-submission-discussion-form
  - LOC-grid-grid-task
---

# Editorial Tasks & Discussions

## Purpose

Everyone working on a submission — editors, assistants, authors, reviewers — needs a
place to talk about it and to hand each other work items. The 3.6 merged system puts
both shapes in one per-stage "Tasks & Discussions" panel on the submission workflow
page: a **discussion** is a threaded conversation among chosen participants; a
**task** is the same thing plus an owner ("responsible" participant) and a due date,
with an explicit start/complete lifecycle. Journal managers can predefine **templates**
so recurring work items are one click away (or created automatically when a submission
enters a stage). Every participant is notified in-app (the header Tasks bell) and by
email, with per-user opt-outs.

## Actors & permissions

"Assigned" below means having a stage assignment on the submission for the item's
stage (or, for reviewers, a review assignment in that review stage). All API access
requires one of: site admin, manager, sub-editor, assistant, author, reviewer
(lib/pkp/api/v1/submissions/tasks/EditorialTaskController.php:86-93).

| Actor | Can | Cannot | Anchor |
|-------|-----|--------|--------|
| Manager (journal-level) | See **all** items on a submission regardless of participation; create; edit/delete/close/reopen/start any item; create without being a participant; attach submission files; edit any headnote at any time | Reply to an item they are not a participant of (replies are participant-only, no manager bypass — enforced as a 422 by AddNote validation; the controller's own 403 is unreachable) | EditorialTaskController.php:269-272; AddNote.php:58-60; QueryWritePolicy.php:52-54; EditTask.php:210-214; NoteAccessPolicy.php:103-106 |
| Site admin (site-level group only) ⚠ | Reach every endpoint (role authorizer admits the role) | Effectively nothing beyond an unassigned user: every managerial exemption checks **journal-scoped** roles (`hasRole([…], $contextId)` never matches site-level groups), so a pure site admin lists zero items (`{"items":[],"itemMax":0}` live-probed), is denied writes (401 on close), and the explicit site-admin carve-outs in participant/creator validation and task pruning are void. Only the headnote 1-hour exemption deliberately checks the site context (EditTask.php:92) | EditorialTaskController.php:269; QueryWritePolicy.php:52; EditTask.php:92, :211, :235; Repository.php:258 — global ⚠, proposed ledger row (Known deviations) |
| Sub-editor (assigned) | Create items on stages they can access; see items **they participate in only**; edit/delete items they created; on items they can already write (rule 13), edit the headnote without the author/1-hour restriction; attach submission files | See items they neither created nor participate in; edit items where they are a mere participant — headnote included: the sub-editor exemption in headnote validation does not grant write access, it only lifts the 1-hour window inside an edit already permitted by QueryWritePolicy (live-probed) | EditorialTaskController.php:273-279; QueryWritePolicy.php:57-59; EditTask.php:90-95, :285-303; QueryAccessPolicy.php:118-127 |
| Assistant (assigned) | Create; participate; reply; edit/delete items they created; close/complete a task they are responsible for; attach submission files | Reopen or edit others' closed items; edit a headnote they authored after 1 hour | QueryAccessPolicy.php:79-88; QueryWritePolicy.php:57-78; EditTask.php:285-303; NoteAccessPolicy.php:96-115 |
| Author (assigned) | Create items on their submission's stages; participate; reply; edit/delete items they created | Attach existing submission files (temporary uploads only); be added alongside an anonymous reviewer; see anonymous reviewers in participant lists | QueryAccessPolicy.php:104-114; EditTask.php:285-303, :180-186; EditorialTaskController.php:985-989 |
| Reviewer | Create/read items in review stages where they hold **any** review assignment — ⚠ declined and cancelled assignments still grant stage access (the active + reviewer-accessible + latest-round filter exists only on the participant picker, EditorialTaskController.php:831-845, :954); participate; reply | Use the feature outside review stages (when reviewer is their only role); see author identities under double-anonymous review; see other blinded reviewers | QueryUserAccessibleWorkflowStageRequiredPolicy.php:45-60; EditorialTaskController.php:819-845, :879-884, :977-999; QueryAccessPolicy.php:92-101 |
| Responsible participant (task owner, any role) | Edit, close, delete the task they own | Reopen a completed task from the row actions (see rule 11) | QueryWritePolicy.php:70-78; useDiscussionManagerConfig.js:127-138 |
| Anonymous | Nothing (login + context membership required) | — | EditorialTaskController.php:84-95 |

Task-template administration (CRUD, auto-add flag) is manager/site-admin only and
additionally requires settings access; *listing* templates is open to all workflow
roles so the "apply template" picker works
(lib/pkp/api/v1/editTaskTemplates/PKPEditTaskTemplateController.php:52-76, :87-90).

## Entry points

| Entry | Path | Atom |
|-------|------|------|
| Tasks & Discussions panel (per stage) | Dashboard → submission workflow page → stage panel (editorial, author, and reviewer views); `DiscussionManager` fetches `GET api/v1/submissions/{id}/stages/{stageId}/tasks` | — |
| Header Tasks bell | Any backend page → bell with unread count → tasks grid modal; the live path is TopNavActions.vue:205-216 fetching the `grid.notifications.taskNotificationsGridHandler` component URL directly (the `$tasksUrl`/`page.PageHandler` plumbing in PKPTemplateManager and `DashboardHandler::tasks` are dead code) | — |
| Task/discussion CRUD API | `POST/PUT/DELETE api/v1/submissions/{id}/tasks[/{taskId}]`, `PUT …/close`, `…/open`, `…/start` (EditorialTaskController.php:102-148) | — |
| Replies API | `POST/DELETE api/v1/submissions/{id}/tasks/{taskId}/notes[/{noteId}]` | — |
| Participant options API | `GET api/v1/submissions/{id}/stages/{stageId}/tasks/participants` | — |
| Template prefill API | `GET api/v1/submissions/{id}/stages/{stageId}/tasks/fromTemplate/{templateId}` | — |
| Task Templates settings tab | Settings → Workflow → "Tasks and Discussions Templates" (lib/pkp/templates/management/workflow.tpl:101); API `api/v1/editTaskTemplates` | — |
| Discussion email | Participant notification email: body is the message + stage-mailable footer with a link back to the thread; tokenized unsubscribe link (`{index}/notification/unsubscribe?validate=…&id=…`) | — |
| Submission activity history | Per-item History modal (event-log entries rendered as `latestActivities`); same entries also in the submission activity log | — |

## Fields & validation

**Task/discussion form** (create `AddTask`, edit `EditTask` — lib/pkp/api/v1/submissions/tasks/formRequests/):

| Field | Type | Rules | Anchor |
|-------|------|-------|--------|
| type | enum | required; 1 = discussion, 2 = task (EditorialTaskType) | EditTask.php:69 |
| title | text | required, ≤255 chars; not multilingual | EditTask.php:70 |
| dateDue | date `Y-m-d` | required for tasks, **prohibited** for discussions; must be ≥ today (⚠ also on edit, rule 12) | EditTask.php:71-76 |
| description | rich text | headnote (first message); required in the UI form; edit restricted (rule 14) | EditTask.php:77-112; useDiscussionManagerForm.js (description `isRequired: true`) |
| participants | array of {userId, isResponsible} | required; per-item rules 5–9 below; userIds distinct and must exist | EditTask.php:114-264 |
| participants.*.isResponsible | bool | required for tasks (exactly one true), prohibited for discussions | EditTask.php:266-272, :123-126 |
| temporaryFileIds | int[] | optional; each must be the current user's temporary upload | EditTask.php:273-280 |
| submissionFileIds | int[] | optional; only managers/admins or assigned sub-editors/assistants; files must belong to the submission | EditTask.php:281-310 |
| createdBy / assocType / assocId / stageId | server-set | forced to current user / SUBMISSION / route submission / posted stage (must be a valid application stage) | AddTask.php:31-53 |

**Reply** (`AddNote`): contents required, ≤65,535 chars; poster forced to current user
and must already be a participant of the item (row exists in `edit_task_participants`);
same attachment rules as above (AddNote.php:56-105).

**Template form** (`AddTaskTemplate`/`UpdateTaskTemplate`): type (required enum),
stageId (required, valid stage), title (required ≤255), description (optional,
supports email-template variables like `{$authorsShort}` — `GET
editTaskTemplates/variables` lists them), include (bool, default false = the auto-add
flag), dueInterval (optional, one of P1W/P2W/P3W/P4W/P1M/P1M15D/P2M/P2M15D/P3M —
EditorialTaskDueInterval), restrictToUserGroups (bool) + userGroupIds (required,
min 1, only when restricted) (AddTaskTemplate.php:32-47).

## Rules & state

**Type distinction**
1. A **task** has exactly one responsible participant and a due date, and moves
   through Yet-to-begin → In progress → Closed. A **discussion** has neither owner
   nor due date and is only ever In progress or Closed — it is born "started"
   (EditTask.php:71-76, :123-126; TaskResource.php:151-159).
2. Status is **derived**, never stored: closed if `dateClosed` set; else (tasks only)
   in-progress if `dateStarted` set, else pending. Discussions without `dateClosed`
   are always in-progress (TaskResource.php:151-159).
3. A discussion can be promoted to a task later ("Add Task Details" action, offered
   while it is in progress); the UI never offers task → discussion (the task-info
   checkbox is disabled once type is task), though the API accepts any valid type on
   edit (useDiscussionManagerConfig.js:156-167; useDiscussionManagerForm.js:645;
   EditTask.php:69).

**Participants**
4. The participant pool for a stage = users with a stage assignment on the submission
   at that stage, plus (in review stages) reviewers holding an active,
   reviewer-accessible assignment on their latest review round, plus the current
   manager/admin themselves (EditorialTaskController.php:804-943).
5. Every non-exempt participant must either hold a stage assignment on the submission
   at the item's stage, **or hold any review assignment on the submission at all** —
   the reviewer branch is unfiltered by stage, status or accessibility (review
   assignments are fetched submission-wide and accepted for items on *any* stage), so
   a reviewer declined in round 1 is a valid participant for a Production task
   (EditTask.php:249-257). Managers may participate anywhere (EditTask.php:232-236;
   the site-admin half of that exemption is void — actor table ⚠).
6. The creator must be among the participants — except managers, who may create
   without participating (EditTask.php:203-219; the site-admin exemption at :211 is
   void — actor table ⚠). The UI pre-checks the current user in the participants
   list on create (useDiscussionManagerForm.js:216-219).
7. Tasks need ≥1 participant; discussions need ≥2 (EditTask.php:190-197).
8. Anonymity guards (any stage, when review assignments exist): at most one blinded
   (anonymous or double-anonymous) reviewer per item, never together with another
   reviewer; no author participant together with a blinded reviewer
   (EditTask.php:128-188). Participant *pickers* additionally hide identities:
   authors are hidden from a double-anonymous reviewer; blinded reviewers are hidden
   from authors (and reviewers) (EditorialTaskController.php:879-884, :977-999).
   Author names in template-variable substitution are stripped for double-anonymous
   reviewers (EditorialTask.php:475-498).
9. Removing a user's stage assignment (or a reviewer's assignment) strips them from
   the submission's items — unless they are a manager (Repository.php:253-276; the
   site-admin exemption at :258 is void — actor table ⚠;
   StageParticipantGridHandler.php:433; PKPReviewerGridHandler.php:694).

**Lifecycle**
10. **Start** (tasks only): allowed once, when not yet started; requires ≥1
    participant and exactly one responsible — auto-created tasks (rule 21) fail these
    guards until edited; records `dateStarted` + `startedBy`. Starting a discussion is
    a 409 (EditorialTaskController.php:531-590). ⚠ There is **no closed guard**: a
    closed-but-never-started task can still be started via the API (:543-547 checks
    only `dateStarted`/type) — it gains `dateStarted`/`startedBy` while staying
    Closed, since `dateClosed` wins in status derivation (rule 2). On create the
    form offers "Start task upon saving" (default) vs "Create, but don't start"
    (useDiscussionManagerForm.js:458-466, :658-673).
11. **Close / reopen**: closing sets `dateClosed` (409 if already closed); reopening
    clears it (409 if not closed). Who may do it = write access (rule 13). The UI
    *row actions* forbid reopening tasks (one-way completion,
    useDiscussionManagerActions.js:147-152), ⚠ but the API has no type guard
    (EditorialTaskController.php:484-526) and neither does the view-modal status
    switch, whose CLOSED→open branch applies to tasks too — only the start
    transition is discussion-guarded (useDiscussionManagerForm.js:505-531). One-way
    completion has holes on both surfaces — see Open questions #1.
12. **Edit**: the UI disables Edit on closed items (useDiscussionManagerConfig.js:154).
    ⚠ Editing a task whose due date has passed is impossible without also moving the
    due date forward: `dateDue` is validated `after_or_equal:today` on every edit
    (EditTask.php:75) — proposed ledger row (Known deviations).
13. **Write access** (edit/delete/close/reopen/start): journal managers always (the
    site-admin branch is void — actor table ⚠); the creator always; for tasks, the
    responsible participant; everyone else is read-only even as a participant
    (QueryWritePolicy.php:36-81). Read access to a single item (view, reply)
    requires being assigned to it, with a manager exception
    (QueryAccessPolicy.php:38-133). The UI mirrors this with
    `userHasWriteAccess` = manager ∨ owner ∨ responsible
    (useDiscussionManagerConfig.js:127-138).
14. **Messages**: the first message ("headnote") is created with the item and edited
    through the item's description field, which rides the item edit — so changing it
    **first requires write access per rule 13** (creator / manager / responsible; a
    sub-editor who is a mere participant cannot edit it, live-probed). Within a
    permitted edit, managers, sub-editors and site admins (this check deliberately
    uses the site context) are exempt from the extra restriction that other writers
    may only change a headnote they authored, within 1 hour of its creation
    (EditTask.php:90-112; same window in NoteAccessPolicy.php:96-115). Replies may
    be posted only by participants — enforced as a 422 by AddNote validation
    (AddNote.php:58-60); the controller's 403 check (EditorialTaskController.php:715-717)
    is unreachable dead code. Template variables in the headnote are substituted at
    save time using the participant set (sender = headnote author, recipients =
    other participants) (EditorialTask.php:437-480).
15. ⚠ **Reply deletion is dead code**: `DELETE …/notes/{noteId}` requires
    NOTE_ACCESS_WRITE, which only ever permits headnotes
    (NoteAccessPolicy.php:99-101), while the controller rejects headnotes
    (EditorialTaskController.php:789-793) — every request fails one of the two.
    Proposed ledger row (Known deviations).
16. **Delete** item: any write-access user; cascades to its messages and its
    notifications (EditorialTaskController.php:420-431; EditorialTask.php:92-99).
    Deleting a submission removes all its items (Repository.php:240-251).
17. **Listing**: per stage; journal managers see all items (the site-admin branch is
    void — actor table ⚠), everyone else only items they participate in; optional
    `isOpen` filter and date ordering (EditorialTaskController.php:262-299). The panel groups rows into
    Yet to begin / In progress / Closed (discussionManagerStore.js:53-74).
18. **Overdue** is a display state, not a status: due date past + not closed →
    "Overdue" badge and a synthetic first entry in the item's activity list
    (TaskResource.php:67-80; useDiscussionManagerForm.js getBadgeProps).

**Templates**
19. Templates are journal-scoped. Non-managers only see templates that are
    unrestricted or restricted to a user group they belong to; managers see all
    (PKPEditTaskTemplateController.php:200-215; Template.php:277-282).
20. **Apply template** (workflow form): server returns an unsaved prefill — title,
    type, description (variables substituted), due date = now + dueInterval,
    participants = current holders of the template's user groups among the
    submission's stage assignments; creator = current user. Template must belong to
    the journal (404) and match the requested stage (409)
    (EditorialTaskController.php:595-640; Template.php:150-176). The UI overwrites
    form values after a confirm dialog when editing an existing item
    (useDiscussionManagerForm.js:186-262).
21. **Auto-add on stage entry** (`include` flag): when a submission is submitted
    (its current stage) and on every stage entered via an editorial decision, each
    included template for that stage is instantiated — with *no participants*,
    `createdBy` NULL, due date from dueInterval. Deduplication checks whether a task
    row from that template **currently exists** for the submission
    (Repository.php:227-234): re-entering a stage does not duplicate a surviving auto
    task, but if the auto task was deleted, re-entering the stage recreates it
    (Repository.php:196-234; decision hook DecisionType.php:228; submit hook
    classes/submission/Repository.php:677-688). Imported submissions intentionally
    skip this.

## Side effects

- **In-app notifications**: on create (all participants + creator), on edit (newly
  added participants only), on reply (all current participants — including the
  poster), each recipient gets a `NOTIFICATION_TYPE_NEW_QUERY` notification at
  `NOTIFICATION_LEVEL_TASK` pointing at the item — unless NEW_QUERY is in the user's
  `blocked_notification` list for the journal, which skips that user entirely
  (notification **and** email) (EditorialTaskController.php:226-231, :388-393, :755,
  :1014-1093, in-app gate :1051-1057).
- **Emails**: after the in-app gate, each recipient whose `blocked_emailed_notification`
  list does not contain NEW_QUERY (:1070-1077) gets the stage-specific discussion
  mailable — DiscussionSubmission / DiscussionReview / DiscussionCopyediting /
  DiscussionProduction by stage (StageMailable.php:32-46) — subject = item title,
  body = the message, attachments mirrored; sender = acting user. The footer carries
  the tokenized unsubscribe link + List-Unsubscribe headers
  (mail/traits/Discussion.php:23-40; Unsubscribe.php:49-103); following it
  (`notification/unsubscribe?validate={HMAC token}&id={notificationId}`) shows a
  form whose pre-checked boxes write `blocked_emailed_notification` rows
  (NotificationHandler.php:89-159). Each send is logged as
  `SubmissionEmailLogEventType::DISCUSSION_NOTIFY` (:1092).
- **Header Tasks bell/grid**: the bell badge counts the user's *unread* LEVEL_TASK
  notifications (PKPTemplateManager.php:1093-1103); the grid lists all their
  LEVEL_TASK notifications newest-first with Mark Read / Mark New / Delete
  (TaskNotificationsGridHandler.php:44-57; NotificationsGridHandler.php). ⚠ The
  EditorialReminder digest's in-app row is created at NORMAL level so it can never
  appear here (ledger row 50).
- **Editing/production status flip**: whenever notifications fire for an item in the
  Copyediting or Production stage, the four editing/production submission
  notifications (assign copyeditor / awaiting copyedits / assign production user /
  awaiting representations) are re-synced — the manager delegate treats "a discussion
  exists in this stage" as "someone is assigned"
  (EditorialTaskController.php:1029-1046;
  PKPEditingProductionStatusNotificationManager.php:165). ⚠ ledger row 9: the
  assignment itself never re-syncs; only this message path does.
- **Event log** (assoc = the item, `submissionId` carried): created, closed, opened,
  started, notePosted, fileUploaded/fileRemoved, dateDue modified (old→new), assigned
  / reassigned (owner change, tasks only), participantsAdded/Removed — each with
  acting user + localized role names (EditorialTaskController.php:209-224, :459-473,
  :506-520, :570-584, :736-749, :1169-1368). These render in the History modal
  (TaskResource.php:82-111). ⚠ Rendering of role placeholders is fragile across the
  wider activity log — ledger row 14.
- **Auto cover-note discussion**: submitting with "Comments for the Editor" creates a
  stage-1 discussion titled with the cover-note label, participants = all assigned
  managers/sub-editors/assistants/authors, sender = the author; participants get
  NEW_QUERY notifications (this path skips the in-app block check) and a plain email
  (generic mailable: no stage template, no unsubscribe footer, no email log)
  (Repository.php:87-194; trigger classes/submission/Repository.php:675-678). ⚠ Its
  first message is stored *without* the headnote flag (Repository.php:103-108), so
  the cover note renders as a reply and the item is headnote-less — see Known
  deviations.

## Settings that modify behavior

- **Task templates** (Settings → Workflow → Tasks and Discussions Templates): each
  template's `include` flag turns on auto-add (rule 21); `restrictToUserGroups` +
  group list limits who sees it in the apply-template picker (rule 19); `dueInterval`
  sets the computed due date.
- **Profile → Notifications** (per user, per journal): "New discussion" in-app block
  (`blocked_notification`) suppresses the notification *and* — as built — the email
  (see Open questions #3); the email block (`blocked_emailed_notification`,
  also written by the unsubscribe form) suppresses only the email
  (EditorialTaskController.php:1051-1077). ⚠ The same form also offers a
  "Discussion activity" (`NOTIFICATION_TYPE_QUERY_ACTIVITY`) row
  (PKPNotificationSettingsForm.php:92), but nothing anywhere creates that
  notification type — a dead settings row (Known deviations).
- No config.inc.php variables alter these rules.

## Cross-feature interactions

- **Submission wizard** — the "Comments for the Editor" step feeds the auto
  cover-note discussion (owned here; the wizard itself is the wizard spec's).
- **Editorial decisions** — stage entry triggers template auto-add (decision
  recording rules live with the decisions spec).
- **Editing/production stage status notices** — flipped by this feature's
  notification path; the notice semantics belong to the copyediting/production
  stage specs (ledger row 9 is the shared ⚠).
- **Stage participants & reviewer assignment** — assignment removal prunes
  participants (rule 9); assignment rules live in those specs.
- **Notifications framework** — bell/grid, block lists and the unsubscribe token are
  shared machinery; this spec only owns their NEW_QUERY behavior.
- **File attachments** — messages attach temporary uploads or submission files
  (SaveNoteWithFiles); file-genre and file-stage semantics live with submission-files.

## Canonical scenarios

1. **Copyeditor task lifecycle** — editor (dbarnes): on the Copyediting panel creates
   a task with the copyeditor as responsible, a future due date, "create, don't
   start" → listed under "Yet to begin"; later starts it (In progress, startedBy
   recorded); the copyeditor completes it → Closed group, Edit disabled, no reopen
   offered.
2. **Discussion with the author** — author submits with comments for the editor → a
   stage-1 discussion appears In progress with author + editorial team as
   participants; the author replies from their view; every participant gets a bell
   notification and a stage-discussion email whose footer links back to the thread.
3. **Permission boundary** — dbarnes creates a task with dbuskins responsible and
   minoue as plain participant: dbuskins gets row actions and can edit/complete;
   minoue sees it read-only; a sub-editor who is not a participant does not see the
   row at all; the manager sees everything.
4. **Auto-add on stage entry** — manager saves a Copyediting template with auto-add
   ON and a 2-week due interval; recording Accept + Skip Review lands the submission
   in Copyediting and a participant-less "Yet to begin" task materializes once (and
   is not duplicated on stage re-entry while it exists — though deleting it and
   re-entering the stage recreates it, rule 21); it cannot be started until someone
   edits in participants and an owner.
5. **Apply template prefill** — while adding an item, picking a template flips the
   form to the template's type, prefills title/description/due date and pre-selects
   participants from the template's user groups; nothing is saved until the user
   submits.
6. **Email opt-out both ways** — a participant blocks discussion emails in their
   profile: next discussion still reaches their bell but not their inbox; a second
   participant instead follows the email's unsubscribe link and confirms — same end
   state, both scoped to that journal only.

## Known deviations (as-built ≠ intent)

- ⚠ Rule 11 / ledger row 9 (docs/e2e/app-changes.md §2 row 9): editing/production
  "assigned" notices key on discussion existence, not assignments.
- ⚠ Side effects / ledger row 14: event-log `{$userGroupName}` param mismatch in
  participant-added rendering (TaskResource.php:90 carries a defensive fallback).
- ⚠ Ledger row 15: DiscussionManager's stage heading goes stale on in-place stage
  switch (DiscussionManager.vue:115) — cosmetic.
- ⚠ Ledger row 50: EditorialReminder in-app notification is NORMAL-level, invisible
  to the TASK-filtered bell/grid.
- ⚠ **Site admin is locked out of the whole feature** (live-probed; ledger row being
  added — app-changes §2, product-spec pilot rows): every managerial exemption uses
  journal-scoped `hasRole([…], $contextId)`, which never matches site-level groups
  (RoleDAO.php:68 `COALESCE(context_id,0)`), so a pure site admin lists zero items,
  gets 401 on writes, and the explicit site-admin carve-outs (EditTask.php:211,
  :235; Repository.php:258) are dead — contrast EditTask.php:92, which deliberately
  checks the site context. Suspected intent: site admin ≥ manager everywhere.
- ⚠ **Reviewer stage access outlives the assignment** (rule and actor table;
  intent question): QueryUserAccessibleWorkflowStageRequiredPolicy.php:45-60 grants
  review-stage access for *any* review assignment, declined and cancelled included;
  the active/accessible/latest-round filtering exists only on the participant picker
  (EditorialTaskController.php:831-845, :954).
- ⚠ **Note deletion is wholly dead** (live-probed — app-changes §2, product-spec
  pilot rows): NoteAccessPolicy WRITE permits only headnotes
  (NoteAccessPolicy.php:99-101) while deleteNote rejects headnotes
  (EditorialTaskController.php:789-793) — replies fail authorization and headnote
  attempts 401 too, even for a manager supplying `?stageId`. `DELETE
  …/notes/{noteId}` can never succeed for anyone. Suspected intent: participants
  (or at least managers) can delete a reply.
- ⚠ **Overdue tasks are un-editable without a due-date bump** (live-probed: with a
  DB-forced past `date_due`, an edit resubmitting the same date is a 422) —
  `dateDue` is re-validated `after_or_equal:today` on every edit
  (EditTask.php:71-76), so once overdue, adding a participant or fixing a typo is
  rejected until the due date is moved to ≥ today. Suspected intent: the floor
  should apply to *changed* due dates only. App-changes §2, product-spec pilot rows.
- ⚠ **Headnote-less items 500 on description-less edits** (live-probed —
  app-changes §2, product-spec pilot rows): two producers of headnote-less items
  exist — tasks auto-created from a template with an empty description
  (Template.php:165 + EditorialTask.php:122-124 `isset` on null) and **every
  cover-note discussion** (Repository.php:103-108 creates the first note without
  `isHeadnote`, so "Comments for the Editor" renders its opening message as a
  reply). UI edits are unaffected in practice (the form always sends the required
  description field), but API-shaped edits that omit `description` dereference the
  missing headnote (EditorialTaskController.php:394-397; notifyParticipants :1083)
  → 500.
- ⚠ **Actors notify themselves** (live-probed: the creator gets their own NEW_QUERY
  row at TASK level *and* the email; a reply poster likewise — app-changes §2,
  product-spec pilot rows): the creator is appended to the create-notification list
  (EditorialTaskController.php:226-229) and a reply notifies *all* participants
  including the poster (:713, :755). Legacy behavior excluded the acting user;
  intent unclear.
- ⚠ **Dead "Discussion activity" settings row**: Profile → Notifications offers
  opt-outs for `NOTIFICATION_TYPE_QUERY_ACTIVITY`
  (PKPNotificationSettingsForm.php:92), but no code path ever creates that
  notification type — the toggle does nothing. App-changes §2, product-spec pilot
  rows.

## Code anchors

- lib/pkp/api/v1/submissions/tasks/EditorialTaskController.php — all item endpoints,
  notifyParticipants (:1014), event logging
- lib/pkp/api/v1/submissions/tasks/formRequests/{AddTask,EditTask,AddNote}.php — validation
- lib/pkp/classes/editorialTask/{EditorialTask,Participant,Template,Repository}.php —
  model, participants/headnote persistence, template promote/auto-add, cover-note query
- lib/pkp/classes/security/authorization/{QueryAccessPolicy,QueryWritePolicy,NoteAccessPolicy}.php
- lib/pkp/api/v1/editTaskTemplates/PKPEditTaskTemplateController.php (+ formRequests) — template CRUD
- lib/pkp/controllers/grid/queries/traits/StageMailable.php; lib/pkp/classes/mail/traits/{Discussion,Unsubscribe}.php; lib/pkp/pages/notification/NotificationHandler.php — mail + unsubscribe
- lib/pkp/controllers/grid/notifications/TaskNotificationsGridHandler.php; lib/pkp/classes/template/PKPTemplateManager.php:1093-1103 — Tasks bell/grid
- lib/ui-library/src/managers/DiscussionManager/** (store, config, actions, form); lib/ui-library/src/managers/TaskTemplateManager/**

## Open questions

1. Reopening a completed *task* is blocked by the row actions but allowed by
   `PUT …/open` (no type guard, EditorialTaskController.php:484-526) *and* by the
   view-modal status switch (useDiscussionManagerForm.js:505-531); a closed
   unstarted task can even be "started" (rule 10 ⚠) — is one-way task completion
   the product rule (API should 409) or are the row actions over-restrictive?
2. Should the acting user be excluded from their own NEW_QUERY notification/email
   (see Known deviations)?
3. Blocking the *in-app* "new discussion" notification also suppresses the email
   (the `continue` at EditorialTaskController.php:1056 precedes the email path) even
   when the email column is unblocked — intended coupling, or should the two profile
   columns be independent?
4. The auto cover-note path (Repository.php:87-151) sends a bare mailable — no stage
   template, no unsubscribe footer, no DISCUSSION_NOTIFY email-log entry, and ignores
   the in-app block list. Deliberate lightweight path, or should it share
   notifyParticipants?
5. `Repository::countOpenPerStage` (Repository.php:45-61) calls scopes that no longer
   exist on the model (`withClosed`, `withUserIds`) and has no callers — dead code to
   delete, or a regression from the query→editorialTask rename?
6. `edit_tasks.status`/`closed` columns are fillable but never read (status is always
   derived, TaskResource.php:151-159) — schema leftovers?
7. Should declined/cancelled review assignments keep granting review-stage access to
   tasks and discussions (QueryUserAccessibleWorkflowStageRequiredPolicy.php:45-60),
   given the participant picker deliberately filters to active, reviewer-accessible,
   latest-round assignments?
