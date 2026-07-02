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

Permissions are organised **by action** — read one row to see who may do it and under
what condition. Terms: *assigned* = has a stage assignment on the submission for the
item's stage (for reviewers, a review assignment in that review stage); *participant* =
named on the item; *responsible* = the participant marked as owning a task; *creator* =
whoever created the item. The rule column states the product behaviour; how it is
enforced (and where enforcement is buggy) lives in **Rules & state** and **Known
deviations**, with the ⚠ marks pointing there. Two site-wide baselines apply to every
row: **Site admin** acts as a manager on any journal they created (journal creation
auto-enrols the admin as a manager — PKPContextService.php:560-578); **Anonymous /
not-logged-in** users have no access at all. Reaching the feature requires being one
of: site admin, manager, sub-editor, assistant, author, reviewer
(EditorialTaskController.php:84-95).

| Action | Who may — and when | Anchors |
|--------|--------------------|---------|
| **View / list items** | • Managers — every item on the submission<br>• Everyone else — only items they created or participate in<br>• Reviewers — their review stage's items, via any review assignment ⚠ (declined/cancelled included) | EditorialTaskController.php:269-279, :819-845; QueryAccessPolicy.php:92-127; QueryUserAccessibleWorkflowStageRequiredPolicy.php:45-60 |
| **Create a task or discussion** | • Assigned editorial roles (manager, sub-editor, assistant) — on stages they can access<br>• Authors — on their own submission's stages<br>• Reviewers — in a review stage they're assigned to<br>• Managers need not be a participant | EditorialTaskController.php:269-279; QueryAccessPolicy.php:79-114 |
| **Edit item metadata** (title, due date, participants) | • The creator, the responsible participant, or a manager (any item)<br>• A sub-editor or assistant who is only a participant — cannot | QueryWritePolicy.php:52-78; EditTask.php:285-303 |
| **Edit the head message** — its text is editable after creation, unlike a reply | • Managers and sub-editors — the text, any time<br>• Authors, assistants, reviewers — only their own head message, and only within one hour of writing it, then locked<br>• Requires edit rights on the item to begin with | EditTask.php:90-111 (exempt roles :90-95; own-author + 1-hour checks :103-110) |
| **Post a reply** — replies are a permanent record | • Any participant may post a reply — and only a participant (even a manager must be added to the item first)<br>• A posted reply is permanent: no one can edit or delete it (by design) | AddNote.php:42-96; NoteAccessPolicy.php:96-115; EditorialTaskController.php:704, :779-793 |
| **Attach files** — the message editor offers this while writing the head message or a reply | • Anyone posting a message can **upload a new file** ("Add file" in the editor)<br>• Only managers and assigned editors/assistants also see **"attach files from the submission"** (existing workflow files) — authors and reviewers do not<br>• The head message's files can be revised when its text is edited; a reply's files are fixed once posted | useDiscussionMessages.js:14,27-70 (UI); EditTask.php:273-305; AddNote.php:69-96 (backend) |
| **Start a task** | • The responsible participant<br>• A manager | QueryWritePolicy.php:70-78 |
| **Close / complete a task** | • The responsible participant<br>• A manager<br>• (discussions aren't "closed" the same way — see Rules & state) | QueryWritePolicy.php:70-78; EditTask.php:113-160 |
| **Reopen a completed task** | • Managers only<br>• Other roles — no reopen affordance in the list ⚠ (an API-level gap exists — see rule 11) | useDiscussionManagerConfig.js:127-138; useDiscussionManagerForm.js:505-531 |
| **Delete a whole task or discussion** (not a single reply) | • The creator, or a manager | QueryWritePolicy.php:52-78 |
| **See identities under anonymous review** | • Authors — can't see reviewers, can't be added alongside an anonymous reviewer<br>• Reviewers — can't see author identities or other blinded reviewers | EditorialTaskController.php:879-884, :977-999; QueryAccessPolicy.php:92-101 |
| **Administer task templates** (CRUD, auto-add flag) | • Managers — full management (also needs settings access)<br>• All workflow roles — may list templates for the "apply template" picker | PKPEditTaskTemplateController.php:52-76, :87-90 |

## Fields & validation

**The create/edit form** (opened from the panel's "Add" button, or an item's edit
action). The fields the user fills:

| Field (UI label) | Required? | Rules | Anchor |
|------------------|-----------|-------|--------|
| **Name** | Yes | The item's title; up to 255 characters | useDiscussionManagerForm.js:614-622; EditTask.php:70 (`title`) |
| **Message / details** | Yes | The item's first message (rich text); can carry file attachments (see "Attach files"); who may edit it later is in the permissions table | useDiscussionManagerForm.js:601-610; EditTask.php:77-112 (`headnote`) |
| **Participants** | Yes | Who is on the item, chosen from the people assigned to the stage | useDiscussionManagerForm.js:624-633; EditTask.php:114-264 |
| **Add task details** (toggle) | No | Off → it's a discussion (no owner, no due date); on → it's a task | useDiscussionManagerForm.js:640-644; EditTask.php:69 (`type`) |
| **Due date** (only when it's a task) | Yes for a task | Must be today or later — ⚠ re-checked on every later edit too (rule 12) | useDiscussionManagerForm.js:300-309; EditTask.php:71-76 (`dateDue`) |
| **Assignee** (only when it's a task) | Yes for a task | Exactly one participant is marked responsible for completing it | useDiscussionManagerForm.js:317-328; EditTask.php:266-272 (`isResponsible`) |

The server fills in context automatically (who created it, which submission and stage
it belongs to) — not user-entered.

**A reply** is just a message: rich text, required, up to ~65,000 characters, with the
same optional file attachments. Only a participant of the item may post one
(AddNote.php:56-105).

**The task-template form** (Settings → Workflow → Tasks and Discussions Templates) has
the same core fields — name, message, task-or-discussion, stage — plus template-only
options: the message may include placeholder variables (e.g. the author's name) that
fill in when the template is applied; an **"add automatically"** flag that creates the
item as soon as a submission reaches that stage; a default **due interval** (one to
four weeks, or one to three months); and an optional **restriction to chosen roles**
(AddTaskTemplate.php:32-47).

## Rules & state

**Type distinction**
1. A **task** has exactly one responsible participant and a due date, and moves
   through **Yet to begin → In progress → Closed**. A **discussion** has neither owner
   nor due date and only ever shows **In progress** or **Closed** — it starts already
   in progress (EditTask.php:71-76, :123-126; TaskResource.php:151-159).
2. The state a user sees follows the actions taken on the item, not a field anyone
   sets: a task is "Yet to begin" until it is started, "In progress" once started, and
   "Closed" once completed; a discussion is "In progress" until it is closed. There is
   no editable status field — the state is always computed from whether the item has
   been started and/or closed (TaskResource.php:151-159 — from `dateStarted`/`dateClosed`).
3. A discussion can be promoted to a task later — the **Add Task Details** action,
   offered while it is In progress. The reverse is never offered in the UI: once an
   item is a task, the task-details toggle is locked, so a task can't be turned back
   into a discussion (though the API will accept any valid type on edit)
   (useDiscussionManagerConfig.js:156-167; useDiscussionManagerForm.js:645;
   EditTask.php:69).

**Participants**
4. **Who the picker offers** as participants on an item: everyone assigned to the
   submission at that stage; in a review stage, also reviewers with an active
   assignment on their latest review round; and always the acting manager or admin
   (EditorialTaskController.php:804-943).
5. **The backend accepts more than the picker offers** ⚠: on save it applies no
   reviewer filtering — *any* review assignment anywhere on the submission qualifies a
   person, even a declined or earlier-round one, for an item on any stage (so a
   reviewer who declined in round 1 can be added to a Production task). Managers may be
   added to any item regardless (EditTask.php:232-257; see Known deviations).
6. Whoever creates an item must be one of its participants — except managers, who may
   create an item without joining it (EditTask.php:203-219). When creating, the form
   pre-checks the current user in the participant list so this is the default
   (useDiscussionManagerForm.js:216-219).
7. A task needs at least one participant; a discussion needs at least two
   (EditTask.php:190-197).
8. To protect anonymous review, whenever a submission has review assignments the item
   limits who can share a thread (on any stage): at most one blinded reviewer —
   anonymous or double-anonymous — per item, never alongside another reviewer, and no
   author participant alongside a blinded reviewer (EditTask.php:128-188). The
   participant pickers go further and hide identities outright: an author is hidden
   from a double-anonymous reviewer, and blinded reviewers are hidden from authors and
   from other reviewers (EditorialTaskController.php:879-884, :977-999). Author names
   inserted by template variables are stripped for double-anonymous reviewers
   (EditorialTask.php:475-498).
9. When a user's stage assignment (or a reviewer's review assignment) is removed, they
   are dropped from every item on that submission — unless they are a manager
   (Repository.php:253-276; StageParticipantGridHandler.php:433;
   PKPReviewerGridHandler.php:694).

**Lifecycle**
10. **Starting** applies to tasks only and moves a task from Yet to begin to In
    progress. It is allowed once, only while the task has not been started, and only
    when the task has at least one participant and exactly one responsible participant
    — auto-created tasks (rule 21) fail these checks until someone edits them. Trying
    to start a discussion is rejected (EditorialTaskController.php:531-590 — records
    `dateStarted` + `startedBy`; discussion start returns 409). ⚠ There is **no closed
    guard**: a task that was closed but never started can still be started through the
    API — it picks up a start time while still displaying as Closed, since a close
    always wins in the computed state (rule 2) (EditorialTaskController.php:543-547
    checks only `dateStarted`/type). On the create form the user picks **Start task
    upon saving** (the default) or **Create, but don't start**
    (useDiscussionManagerForm.js:458-466, :658-673).
11. **Closing and reopening**: closing an item marks it Closed; reopening clears that
    and returns it to In progress. Each is one step at a time — closing an
    already-closed item, or reopening one that isn't closed, is refused as a redundant
    no-op (close sets `dateClosed`, reopen clears it; a repeat call returns 409). Doing
    either requires write access (rule 13). In the UI, a completed task's **row
    actions** offer no reopen, presenting completion as one-way
    (useDiscussionManagerActions.js:147-152). ⚠ But nothing enforces that one-way rule
    underneath: the reopen API carries no task-vs-discussion guard
    (EditorialTaskController.php:484-526), and neither does the status switch in the
    item's view modal — its Closed→open path applies to tasks too, with only the
    *start* transition discussion-guarded there (useDiscussionManagerForm.js:505-531).
    One-way completion has holes on both surfaces — see Open questions #1.
12. **Editing**: the UI disables the Edit action on closed items
    (useDiscussionManagerConfig.js:154). ⚠ A task whose due date has already passed
    can't be edited at all without also moving the due date forward, so fixing a typo
    or adding a participant on an overdue task is blocked until its due date is bumped
    (EditTask.php:75 — `dateDue` re-validated `after_or_equal:today` on every edit) —
    proposed ledger row (Known deviations).
13. **Write access** — the ability to edit, delete, close, reopen or start an item —
    is held by journal managers at all times, by the creator at all times, and, for
    tasks, by the responsible participant; everyone else is read-only even when they
    are a participant (QueryWritePolicy.php:36-81). Read access to a single item — viewing it
    and replying — requires being one of its participants, again with a manager
    exception (QueryAccessPolicy.php:38-133). The UI mirrors this, showing the write
    controls only to a manager, the owner or the responsible participant
    (useDiscussionManagerConfig.js:127-138 — `userHasWriteAccess`).
14. **Messages**: the item's first message (its head message) is created together with
    the item and later edited through the item's description field, as part of editing
    the item — so changing it **first requires write access per rule 13** (creator,
    manager or responsible participant; a sub-editor who is only a participant cannot
    edit it, live-probed). Within a permitted edit, managers, sub-editors and site
    admins are exempt from an extra restriction that applies to other writers: they may
    change a head message only if they authored it, and only within one hour of writing
    it (EditTask.php:90-112 — the site-admin check deliberately uses the site context;
    same window in NoteAccessPolicy.php:96-115). Replies may be posted only by
    participants — a non-participant's reply is rejected on validation
    (AddNote.php:58-60); a second, controller-level check for the same thing never runs
    (EditorialTaskController.php:715-717 — unreachable dead code). Template variables in
    the head message are filled in when it is saved, using the participant set — the
    head message's author as sender and the other participants as recipients
    (EditorialTask.php:437-480).
15. **Replies are permanent by design**: no one can edit or delete a posted reply — a
    reply is a permanent record, and this is the intended rule. A note-deletion
    endpoint exists in code but can never succeed for anyone: the write policy only
    allows head messages while the delete handler rejects head messages, so every path
    is blocked (NoteAccessPolicy.php:99-101; EditorialTaskController.php:789-793 —
    `DELETE …/notes/{noteId}`). Because replies were never meant to be individually
    deletable, this leaves no functional gap — it's a vestigial-endpoint cleanup
    candidate, not a user-facing bug.
16. **Deleting an item**: any user with write access can delete a whole task or
    discussion; deleting it also removes all of its messages and the notifications that
    pointed at it (EditorialTaskController.php:420-431; EditorialTask.php:92-99).
    Deleting the submission removes all of its items (Repository.php:240-251).
17. **Listing**: items are listed per stage. Journal managers see every item on the
    submission; everyone else sees only items they participate in. The list can be filtered to open items only
    and ordered by date (EditorialTaskController.php:262-299 — `isOpen` filter). In the
    panel, rows are grouped under Yet to begin, In progress and Closed
    (discussionManagerStore.js:53-74).
18. **Overdue** is a display state, not a separate status: when a task's due date has
    passed and it isn't closed, the item shows an **Overdue** badge and gains a
    synthetic first entry at the top of its activity list (TaskResource.php:67-80;
    useDiscussionManagerForm.js getBadgeProps).

**Templates**
19. Templates are journal-scoped. A non-manager sees only templates that are
    unrestricted or restricted to a user group they belong to; managers see all of them
    (PKPEditTaskTemplateController.php:200-215; Template.php:277-282).
20. **Applying a template** in the add/edit form fills the form without saving
    anything: it sets the title, the task-or-discussion type, the description (with
    variables substituted), a due date of today plus the template's due interval, and
    pre-selects participants — the people currently holding the template's user groups
    among the submission's stage assignments — with the current user as creator. The
    template must belong to this journal and match the stage being worked on, or the
    prefill is refused (EditorialTaskController.php:595-640; Template.php:150-176 —
    due date = now + `dueInterval`; 404 wrong journal, 409 wrong stage). If the user
    applies a template while editing an existing item, the form warns first and then
    overwrites the current values on confirm (useDiscussionManagerForm.js:186-262).
21. **Auto-add on stage entry**: a template can be marked to create its item
    automatically. When a submission is first submitted (into its starting stage) and
    each time it enters a stage through an editorial decision, every auto-add template
    for that stage is instantiated — as an item with *no participants*, no recorded
    creator, and a due date set from the template's due interval. Before creating one,
    the system checks whether an item from that template **already exists** on the
    submission: re-entering a stage does not duplicate a surviving auto-created item,
    but if that item was deleted, re-entering the stage creates it again
    (Repository.php:196-234, dedup :227-234 — `include` flag, `createdBy` NULL, due
    date from `dueInterval`; decision hook DecisionType.php:228; submit hook
    classes/submission/Repository.php:677-688). Submissions brought in by import
    intentionally skip this.

## Side effects

- **In-app notifications**: creating an item notifies all participants plus the
  creator; editing notifies only the newly added participants; posting a reply
  notifies all current participants, including the person who posted it. Each recipient
  gets a *new discussion* notification that lands in the header Tasks bell and points
  at the item — unless that user has blocked the *New discussion* notification for this
  journal in their profile, in which case they are skipped entirely, for both the
  in-app notification **and** the email (EditorialTaskController.php:226-231, :388-393,
  :755, :1014-1093, in-app gate :1051-1057 — `NOTIFICATION_TYPE_NEW_QUERY` at
  `NOTIFICATION_LEVEL_TASK`, `blocked_notification`).
- **Emails**: past that gate, each remaining recipient who has not blocked *discussion
  emails* for this journal gets an email built from a stage-specific template — one
  each for the submission, review, copyediting and production stages
  (StageMailable.php:32-46 — DiscussionSubmission / DiscussionReview /
  DiscussionCopyediting / DiscussionProduction). Its subject is the item title, its
  body is the message, and any attachments are carried through; the sender is the
  acting user. The footer includes a personal unsubscribe link and standard
  List-Unsubscribe headers (mail/traits/Discussion.php:23-40; Unsubscribe.php:49-103);
  following that link opens a form whose pre-checked boxes record the email opt-out
  (NotificationHandler.php:89-159 —
  `notification/unsubscribe?validate={HMAC token}&id={notificationId}` writes
  `blocked_emailed_notification` rows). Each email sent is recorded in the submission's
  email log (EditorialTaskController.php:1070-1077 checks `blocked_emailed_notification`
  for `NEW_QUERY`; :1092 logs `SubmissionEmailLogEventType::DISCUSSION_NOTIFY`).
- **Header Tasks bell and grid**: the bell's badge counts the user's *unread*
  task-level notifications (PKPTemplateManager.php:1093-1103); opening it lists all of
  their task-level notifications, newest first, with Mark Read, Mark New and Delete
  actions (TaskNotificationsGridHandler.php:44-57; NotificationsGridHandler.php). ⚠ The
  editorial-reminder digest's in-app notification is created at normal level, not task
  level, so it never appears in this bell or grid (ledger row 50).
- **Copyediting/production status flip**: whenever notifications fire for an item on
  the Copyediting or Production stage, the four editing/production status notices —
  assign a copyeditor, awaiting copyedits, assign a production user, awaiting
  representations — are recomputed, because the code treats "a discussion exists on
  this stage" as if "someone is assigned" (EditorialTaskController.php:1029-1046;
  PKPEditingProductionStatusNotificationManager.php:165). ⚠ The assignment itself never
  triggers this recompute; only this discussion path does (ledger row 9).
- **Event log**: each item records its own history — created, closed, reopened,
  started, a reply posted, a file attached or removed, the due date changed (old to
  new), the owner assigned or reassigned (tasks only), and participants added or
  removed — each entry naming the acting user and the roles involved
  (EditorialTaskController.php:209-224, :459-473, :506-520, :570-584, :736-749,
  :1169-1368 — logged against the item, carrying `submissionId`). These entries appear
  in the item's History modal (TaskResource.php:82-111). ⚠ Rendering the role
  placeholders is fragile across the wider activity log — ledger row 14.
- **Auto cover-note discussion**: submitting with "Comments for the Editor" filled in
  creates a discussion on the submission stage, titled with the cover-note label, with
  all assigned managers, sub-editors, assistants and authors as participants and the
  author as sender. Participants get the *new discussion* notification (this path skips
  the in-app block check) and a plain email — a generic message with no stage template,
  no unsubscribe footer and no email-log entry (Repository.php:87-194 — `NEW_QUERY`;
  trigger classes/submission/Repository.php:675-678). ⚠ The opening message is stored
  *without* the head-message flag (Repository.php:103-108), so the cover note renders
  as a reply and the item has no head message — see Known deviations.

## Settings that modify behavior

- **Task templates** (Settings → Workflow → Tasks and Discussions Templates): a
  template's auto-add flag turns on stage-entry creation (rule 21); its restrict-to-
  roles setting and the chosen group list limit who sees it in the apply-template
  picker (rule 19); its due interval sets the due date computed when the template is
  applied (template fields `include`, `restrictToUserGroups`, `dueInterval`).
- **Profile → Notifications** (per user, per journal): the *New discussion* in-app
  opt-out suppresses the bell notification *and*, as built, the email too (see Open
  questions #3); the separate email opt-out — also set by the unsubscribe form —
  suppresses only the email (EditorialTaskController.php:1051-1077 —
  `blocked_notification` vs `blocked_emailed_notification`). ⚠ The same settings form
  also offers a *Discussion activity* opt-out (PKPNotificationSettingsForm.php:92 —
  `NOTIFICATION_TYPE_QUERY_ACTIVITY`), but nothing anywhere creates that notification,
  so the toggle does nothing — a dead settings row (Known deviations).
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
- **Notifications framework** — the bell and grid, the block lists and the unsubscribe
  token are shared machinery; this spec only owns their *new discussion* behavior
  (NEW_QUERY).
- **File attachments** — messages carry either newly uploaded files or existing
  submission files (SaveNoteWithFiles); file-genre and file-stage semantics live with
  submission-files.

## Canonical scenarios

1. **Copyeditor task lifecycle** — an editor (dbarnes) on the Copyediting panel creates
   a task with the copyeditor as responsible participant, a future due date, and
   "Create, but don't start"; it appears under **Yet to begin**. The editor later
   starts it, moving it to **In progress**; the copyeditor completes it, moving it to
   the **Closed** group, where Edit is disabled and no reopen is offered.
2. **Discussion with the author** — an author submits with comments for the editor; a
   discussion appears on the submission stage, In progress, with the author and the
   editorial team as participants. The author replies from their own view, and every
   participant gets a Tasks-bell notification and a stage-discussion email whose footer
   links back to the thread.
3. **Permission boundary** — dbarnes creates a task with dbuskins as responsible
   participant and minoue as a plain participant: dbuskins sees the row actions and can
   edit and complete the task; minoue sees it read-only; a sub-editor who is not a
   participant doesn't see the item at all; a manager sees everything.
4. **Auto-add on stage entry** — a manager saves a Copyediting template with auto-add
   on and a two-week due interval; recording Accept and Skip Review lands the
   submission in Copyediting, and a participant-less **Yet to begin** task appears once.
   It is not duplicated when the stage is re-entered while it still exists, though
   deleting it and re-entering the stage creates it again (rule 21); it can't be
   started until someone edits in participants and an owner.
5. **Apply template prefill** — while adding an item, picking a template flips the form
   to the template's type, prefills the title, description and due date, and
   pre-selects participants from the template's user groups; nothing is saved until the
   user submits the form.
6. **Email opt-out both ways** — one participant blocks discussion emails in their
   profile: the next discussion still reaches their Tasks bell but not their inbox. A
   second participant instead follows the unsubscribe link in an email and confirms —
   same end state, and both opt-outs are scoped to that journal only.

## Known deviations (as-built ≠ intent)

- ⚠ Side effects / ledger row 9 (docs/e2e/app-changes.md §2 row 9): editing/production
  "assigned" notices key on discussion existence, not assignments.
- ⚠ Side effects / ledger row 14: event-log `{$userGroupName}` param mismatch in
  participant-added rendering (TaskResource.php:90 carries a defensive fallback).
- ⚠ Ledger row 15: DiscussionManager's stage heading goes stale on in-place stage
  switch (DiscussionManager.vue:115) — cosmetic.
- ⚠ Ledger row 50: EditorialReminder in-app notification is NORMAL-level, invisible
  to the TASK-filtered bell/grid.
- ⚠ **Site-admin carve-outs check the wrong scope** (live-probed; app-changes §2,
  product-spec pilot rows) — **low practical impact**: every managerial exemption uses
  journal-scoped `hasRole([…], $contextId)`, which never matches site-level groups
  (RoleDAO.php:68 `COALESCE(context_id,0)`), so the explicit site-admin carve-outs
  (EditTask.php:211, :235; Repository.php:258) are dead code — a site admin holding no
  manager role on the journal lists zero items and gets 401 on writes. Mitigated in
  normal use because journal creation auto-enrols the creating admin as a manager of
  that journal (PKPContextService.php:560-578), so admins ordinarily act through the
  manager role; it only bites an admin account with no manager enrolment on the
  journal. Contrast EditTask.php:92, which deliberately checks the site context.
  Suspected intent: the carve-outs meant site admin ≥ manager everywhere.
- ⚠ **Reviewer stage access outlives the assignment** (rule and permissions table;
  intent question): QueryUserAccessibleWorkflowStageRequiredPolicy.php:45-60 grants
  review-stage access for *any* review assignment, declined and cancelled included;
  the active/accessible/latest-round filtering exists only on the participant picker
  (EditorialTaskController.php:831-845, :954).
- **Vestigial note-deletion endpoint** (live-probed — app-changes §2, product-spec
  pilot rows) — **not a user-facing bug**: a `DELETE …/notes/{noteId}` route exists
  but can never succeed for anyone (NoteAccessPolicy WRITE permits only headnotes,
  NoteAccessPolicy.php:99-101, while deleteNote rejects headnotes,
  EditorialTaskController.php:789-793 — replies fail authorization, headnote attempts
  401 too, even for a manager supplying `?stageId`). Per the maintainer, replies are
  intentionally permanent, so the observable behaviour is correct; this is dead code
  to remove (or clarify what it was for), not a functional gap.
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

---

<!-- REFERENCE MATERIAL — provenance and campaign bookkeeping, not product-owner
     narrative. The PO-facing "where do I find this" is in Purpose. -->

## Reference — entry points & surfaces

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

## Reference — code anchors

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
