---
name: tasks-discussions
scope: Editorial teams coordinate work on a submission through per-stage tasks (with owner + due date) and discussions (threaded conversations), optionally seeded from journal-level templates
shared: pkp-lib
status: verified
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
auto-enrols the admin as a manager); **Anonymous / not-logged-in** users have no access
at all. Reaching the feature requires being one of: site admin, manager, sub-editor,
assistant, author, reviewer. <sup>m</sup>

| Action | Who may — and when |
|--------|--------------------|
| **View / list items** | • Managers — every item on the submission<br>• Everyone else — only items they created or participate in<br>• Reviewers — their review stage's items, via any review assignment ⚠ (declined/cancelled included) <sup>a</sup> |
| **Create a task or discussion** | • Assigned editorial roles (manager, sub-editor, assistant) — on stages they can access<br>• Authors — on their own submission's stages<br>• Reviewers — in a review stage they're assigned to<br>• Managers need not be a participant <sup>b</sup> |
| **Edit item metadata** (title, due date, participants) | • The creator, the responsible participant, or a manager (any item)<br>• A sub-editor or assistant who is only a participant — cannot <sup>c</sup> |
| **Edit the head message** — its text is editable after creation, unlike a reply | • Managers and sub-editors — the text, any time<br>• Authors, assistants, reviewers — only their own head message, and only within one hour of writing it, then locked<br>• Requires edit rights on the item to begin with <sup>d</sup> |
| **Post a reply** — replies are a permanent record | • Any participant may post a reply — and only a participant (even a manager must be added to the item first)<br>• A posted reply is permanent: no one can edit or delete it (by design) <sup>e</sup> |
| **Attach files** — the message editor offers this while writing the head message or a reply | • Anyone posting a message can **upload a new file** ("Add file" in the editor)<br>• Only managers and assigned editors/assistants also see **"attach files from the submission"** (existing workflow files) — authors and reviewers do not<br>• The head message's files can be revised when its text is edited; a reply's files are fixed once posted <sup>f</sup> |
| **Start a task** | • The responsible participant<br>• A manager <sup>g</sup> |
| **Close / complete a task** | • The responsible participant<br>• A manager<br>• (discussions aren't "closed" the same way — see Rules & state) <sup>h</sup> |
| **Reopen a completed task** | • Managers only<br>• Other roles — no reopen affordance in the list ⚠ (an API-level gap exists — see rule 11) <sup>i</sup> |
| **Delete a whole task or discussion** (not a single reply) | • The creator, or a manager <sup>j</sup> |
| **See identities under anonymous review** | • Authors — can't see reviewers, can't be added alongside an anonymous reviewer<br>• Reviewers — can't see author identities or other blinded reviewers <sup>k</sup> |
| **Administer task templates** (CRUD, auto-add flag) | • Managers — full management (also needs settings access)<br>• All workflow roles — may list templates for the "apply template" picker <sup>l</sup> |

<sup>a</sup> EditorialTaskController::getTasks(), getParticipants(); QueryAccessPolicy::__construct(); QueryUserAccessibleWorkflowStageRequiredPolicy::effect() ·
<sup>b</sup> EditorialTaskController::getTasks(); QueryAccessPolicy::__construct() ·
<sup>c</sup> QueryWritePolicy::effect(); EditTask::rules() ·
<sup>d</sup> EditTask::rules() 'headnote' rule (exempt roles; own-author + 1-hour checks) ·
<sup>e</sup> AddNote::rules(); NoteAccessPolicy::effect(); EditorialTaskController::addNote(), deleteNote() ·
<sup>f</sup> useDiscussionMessages() fileAttachers (UI); EditTask::rules()/AddNote::rules() 'temporaryFileIds'/'submissionFileIds' (backend) ·
<sup>g</sup> QueryWritePolicy::effect() ·
<sup>h</sup> QueryWritePolicy::effect(); EditTask::rules() 'participants' rule ·
<sup>i</sup> useDiscussionManagerConfig() userHasWriteAccess(); useDiscussionManagerForm() status switch ·
<sup>j</sup> QueryWritePolicy::effect() ·
<sup>k</sup> EditorialTaskController::getParticipants(), getReviewers(); QueryAccessPolicy::__construct() ·
<sup>l</sup> PKPEditTaskTemplateController::getGroupRoutes(), authorize() ·
<sup>m</sup> (baselines) PKPContextService::add() (site-admin auto-enrol); EditorialTaskController::getRouteGroupMiddleware() (access requirement)

## Fields & validation

**The create/edit form** (opened from the panel's "Add" button, or an item's edit
action). The fields the user fills:

| Field (UI label) | Required? | Rules |
|------------------|-----------|-------|
| **Name** | Yes | The item's title; up to 255 characters <sup>a</sup> |
| **Message / details** | Yes | The item's first message (rich text); can carry file attachments (see "Attach files"); who may edit it later is in the permissions table <sup>b</sup> |
| **Participants** | Yes | Who is on the item, chosen from the people assigned to the stage <sup>c</sup> |
| **Add task details** (toggle) | No | Off → it's a discussion (no owner, no due date); on → it's a task <sup>d</sup> |
| **Due date** (only when it's a task) | Yes for a task | Must be today or later — ⚠ re-checked on every later edit too (rule 12) <sup>e</sup> |
| **Assignee** (only when it's a task) | Yes for a task | Exactly one participant is marked responsible for completing it <sup>f</sup> |

<sup>a</sup> useDiscussionManagerForm() addFieldText('title'); EditTask::rules() (`title`) ·
<sup>b</sup> useDiscussionManagerForm() addFieldRichTextArea('description'); EditTask::rules() (`headnote`) ·
<sup>c</sup> useDiscussionManagerForm() addFieldOptions('participants'); EditTask::rules() 'participants' ·
<sup>d</sup> useDiscussionManagerForm() addFieldCheckbox('taskInfoAdd'); EditTask::rules() (`type`) ·
<sup>e</sup> useDiscussionManagerForm() addTaskInfoDueDate(); EditTask::rules() (`dateDue`) ·
<sup>f</sup> useDiscussionManagerForm() addTaskInfoAssignee(); EditTask::rules() (`isResponsible`)

The server fills in context automatically (who created it, which submission and stage
it belongs to) — not user-entered.

**A reply** is just a message: rich text, required, up to ~65,000 characters, with the
same optional file attachments. Only a participant of the item may post one. <sup>g</sup>

**The task-template form** (Settings → Workflow → Tasks and Discussions Templates) has
the same core fields — name, message, task-or-discussion, stage — plus template-only
options: the message may include placeholder variables (e.g. the author's name) that
fill in when the template is applied; an **"add automatically"** flag that creates the
item as soon as a submission reaches that stage; a default **due interval** (one to
four weeks, or one to three months); and an optional **restriction to chosen roles**. <sup>h</sup>

<sup>g</sup> AddNote::rules() ·
<sup>h</sup> AddTaskTemplate::rules()

## Rules & state

**Type distinction**
1. A **task** has exactly one responsible participant and a due date, and moves
   through **Yet to begin → In progress → Closed**. A **discussion** has neither owner
   nor due date and only ever shows **In progress** or **Closed** — it starts already
   in progress. <sup>a</sup>
2. The state a user sees follows the actions taken on the item, not a field anyone
   sets: a task is "Yet to begin" until it is started, "In progress" once started, and
   "Closed" once completed; a discussion is "In progress" until it is closed. There is
   no editable status field — the state is always computed from whether the item has
   been started and/or closed. <sup>b</sup>
3. A discussion can be promoted to a task later — the **Add Task Details** action,
   offered while it is In progress. The reverse is never offered in the UI: once an
   item is a task, the task-details toggle is locked, so a task can't be turned back
   into a discussion (though the API will accept any valid type on edit). <sup>c</sup>

**Participants**
4. **Who the picker offers** as participants on an item: everyone assigned to the
   submission at that stage; in a review stage, also reviewers with an active,
   accessible assignment — across all of their review rounds, not just the latest — and
   always the acting manager or admin. For a reviewer, the picker returns the review
   details per round (round number and review method), so a reviewer who reviewed more
   than once is listed with all their reviews. <sup>d</sup>
5. **The backend accepts more than the picker offers** ⚠: on save it applies no
   reviewer filtering at all — *any* review assignment anywhere on the submission
   qualifies a person, even a **declined or cancelled** one, for an item on any stage
   (so a reviewer who declined in round 1 can be added to a Production task; the picker
   would never offer them). Managers may be added to any item regardless (see Known
   deviations). <sup>e</sup>
6. Whoever creates an item must be one of its participants — except managers, who may
   create an item without joining it. When creating, the form pre-checks the current
   user in the participant list so this is the default. <sup>f</sup>
7. A task needs at least one participant; a discussion needs at least two. <sup>g</sup>
8. To protect anonymous review, whenever a submission has review assignments the item
   limits who can share a thread (on any stage): at most one blinded reviewer —
   anonymous or double-anonymous — per item, never alongside another reviewer, and no
   author participant alongside a blinded reviewer. The participant pickers go further
   and hide identities outright: an author is hidden from a double-anonymous reviewer,
   and blinded reviewers are hidden from authors and from other reviewers. Author names
   inserted by template variables are stripped for double-anonymous reviewers. <sup>h</sup>
9. When a user's stage assignment (or a reviewer's review assignment) is removed, they
   are dropped from every item on that submission — unless they are a manager. <sup>i</sup>

**Lifecycle**
10. **Starting** applies to tasks only and moves a task from Yet to begin to In
    progress. It is allowed once, only while the task has not been started, and only
    when the task has at least one participant and exactly one responsible participant
    — auto-created tasks (rule 21) fail these checks until someone edits them. Trying
    to start a discussion is rejected. ⚠ There is **no closed guard**: a task that was
    closed but never started can still be started through the API — it picks up a start
    time while still displaying as Closed, since a close always wins in the computed
    state (rule 2). On the create form the user picks **Start task upon saving** (the
    default) or **Create, but don't start**. <sup>j</sup>
11. **Closing and reopening** behaves differently for the two types. Closing marks an
    item Closed (write access required, rule 13); reopening returns it to In progress
    (reopening an item that isn't closed, or re-closing a closed one, is refused as a
    no-op). A **discussion** can be reopened from the UI: the **Closed** column is a
    checkbox, and unchecking it — after a confirm — reopens it. A **task**, once closed,
    **cannot be reopened from the UI at all** — its Closed checkbox is disabled, and the
    view modal's status control (which only offers *start* / *complete*) is disabled too
    — so task completion is one-way. ⚠ That one-way rule is enforced only in the UI: the
    reopen endpoint (`PUT …/open`) has no task-vs-discussion guard, so a closed task can
    still be reopened by a direct API call (and a closed-but-unstarted task can even be
    started, rule 10) — see Open questions #1. <sup>k</sup>
12. **Editing**: the UI disables the Edit action on closed items. ⚠ A task whose due
    date has already passed can't be edited at all without also moving the due date
    forward, so fixing a typo or adding a participant on an overdue task is blocked
    until its due date is bumped — proposed ledger row (Known deviations). <sup>l</sup>
13. **Write access** — the ability to edit, delete, close, reopen or start an item —
    is held by journal managers at all times, by the creator at all times, and, for
    tasks, by the responsible participant; everyone else is read-only even when they
    are a participant. Read access to a single item — viewing it and replying — requires
    being one of its participants, again with a manager exception. The UI mirrors this,
    showing the write controls only to a manager, the owner or the responsible
    participant. <sup>m</sup>
14. **Messages**: the item's first message (its head message) is created together with
    the item and later edited through the item's description field, as part of editing
    the item — so changing it **first requires write access per rule 13** (creator,
    manager or responsible participant; a sub-editor who is only a participant cannot
    edit it). Within a permitted edit, managers, sub-editors and site
    admins are exempt from an extra restriction that applies to other writers: they may
    change a head message only if they authored it, and only within one hour of writing
    it. Replies may be posted only by participants — a non-participant's reply is
    rejected on validation; a second, controller-level check for the same thing never
    runs. Template variables in the head message are filled in when it is saved, using
    the participant set — the head message's author as sender and the other participants
    as recipients. <sup>n</sup>
15. **Replies are permanent by design**: no one can edit or delete a posted reply — a
    reply is a permanent record, and this is the intended rule. A note-deletion
    endpoint exists in code but can never succeed for anyone: the write policy only
    allows head messages while the delete handler rejects head messages, so every path
    is blocked. Because replies were never meant to be individually deletable, this
    leaves no functional gap — it's a vestigial-endpoint cleanup candidate, not a
    user-facing bug. <sup>o</sup>
16. **Deleting an item**: any user with write access can delete a whole task or
    discussion; deleting it also removes all of its messages and the notifications that
    pointed at it. Deleting the submission removes all of its items. <sup>p</sup>
17. **Listing**: items are listed per stage. Journal managers see every item on the
    submission; everyone else sees only items they participate in. The list can be
    filtered to open items only and ordered by date. In the panel, rows are grouped
    under Yet to begin, In progress and Closed. <sup>q</sup>
18. **Overdue** is a display state, not a separate status: when a task's due date has
    passed and it isn't closed, the item shows an **Overdue** badge and gains a
    synthetic first entry at the top of its activity list. <sup>r</sup>

**Templates**
19. Templates are journal-scoped. A non-manager sees only templates that are
    unrestricted or restricted to a user group they belong to; managers see all of
    them. <sup>s</sup>
20. **Applying a template** in the add/edit form fills the form without saving
    anything: it sets the title, the task-or-discussion type, the description (with
    variables substituted), and a due date of today plus the template's due interval.
    ⚠ It does **not** pre-select participants — the client prefill clears the responsible
    assignee and leaves the participant list at its default (only the current user, as
    creator), even though the template data handed to the form does include the
    promoted participants; the form simply ignores them. The template must belong to this journal and match the
    stage being worked on, or the prefill is refused. If the user applies a template
    while editing an existing item, the form warns first and then overwrites the current
    values on confirm. <sup>t</sup>
21. **Auto-add on stage entry**: a template can be marked to create its item
    automatically. When a submission is first submitted (into its starting stage) and
    each time it enters a stage through an editorial decision, every auto-add template
    for that stage is instantiated — as an item with *no participants*, no recorded
    creator, and a due date set from the template's due interval. Before creating one,
    the system checks whether an item from that template **already exists** on the
    submission: re-entering a stage does not duplicate a surviving auto-created item,
    but if that item was deleted, re-entering the stage creates it again. Submissions
    brought in by import intentionally skip this. <sup>u</sup>

<sup>a</sup> EditTask rules for type/due-date; TaskResource::determineStatus() ·
<sup>b</sup> TaskResource::determineStatus() (from `dateStarted`/`dateClosed`) ·
<sup>c</sup> useDiscussionManagerConfig() getItemActions(); useDiscussionManagerForm() addFieldCheckbox('taskInfoAdd'); EditTask::rules() (`type`) ·
<sup>d</sup> EditorialTaskController::getParticipants(), getReviewers(); EditorialTaskParticipantResource ·
<sup>e</sup> EditTask participant validation ·
<sup>f</sup> EditTask::rules() 'participants' creator check; useDiscussionManagerForm() getSelectedParticipants() ·
<sup>g</sup> EditTask::rules() 'participants' count check ·
<sup>h</sup> EditTask::rules() 'participants' anonymity check; EditorialTaskController::getParticipants(), getReviewers(); EditorialTask::compileDescription(), anonymizeAuthors() ·
<sup>i</sup> Repository::removeParticipantFromSubmissionTasks(); StageParticipantGridHandler::deleteParticipant(); PKPReviewerGridHandler::updateUnassignReviewer() ·
<sup>j</sup> EditorialTaskController::startTask() (records `dateStarted`/`startedBy`; discussion-start returns 409; checks only `dateStarted`/type); useDiscussionManagerForm() addWorkItem(), addFieldSelect('taskInfoShouldStart') ·
<sup>k</sup> DiscussionManagerCellClosed.vue (Closed-column checkbox, disabled for closed tasks); useDiscussionManagerActions() discussionSetClosed() (`// Tasks cannot be reopened` guard); DiscussionManagerTaskInfo.vue (view-modal status checkbox, disabled when closed); EditorialTaskController::openTask() (no type guard) ·
<sup>l</sup> useDiscussionManagerConfig() getItemActions(); EditTask::rules() 'dateDue' (re-validated `after_or_equal:today` on every edit) ·
<sup>m</sup> QueryWritePolicy::effect(); QueryAccessPolicy::__construct(); useDiscussionManagerConfig() userHasWriteAccess() ·
<sup>n</sup> EditTask::rules() 'headnote' rule (site-admin check uses the site context; same one-hour window in NoteAccessPolicy::effect()); AddNote::rules() 'userId'; EditorialTaskController::addNote() (unreachable dead code); EditorialTask::compileDescription() ·
<sup>o</sup> NoteAccessPolicy::effect(); EditorialTaskController::deleteNote() (`DELETE …/notes/{noteId}`) ·
<sup>p</sup> EditorialTaskController::deleteTask(); EditorialTask::booted(); Repository::deleteBySubmissionId() ·
<sup>q</sup> EditorialTaskController::getTasks() (`isOpen` filter); useDiscussionManagerStore() discussions[] groups ·
<sup>r</sup> TaskResource::toArray(); useDiscussionManagerForm() getBadgeProps() ·
<sup>s</sup> PKPEditTaskTemplateController::getMany(); Template::scopeWithUserGroupIds() ·
<sup>t</sup> EditorialTaskController::fromTemplate(); Template::promote() (due date = now + `dueInterval`; 404 wrong journal, 409 wrong stage); useDiscussionManagerForm() onSelectTemplate(), setValuesFromTemplate() ·
<sup>u</sup> Repository::autoCreateFromTemplates(), taskAlreadyCreatedFromTemplate() (`include` flag, `createdBy` NULL, due date from `dueInterval`); DecisionType::runAdditionalActions(); classes/submission/Repository::submit()

## Side effects

- **In-app notifications**: creating an item notifies all participants plus the
  creator; editing notifies only the newly added participants; posting a reply
  notifies all current participants, including the person who posted it. Each recipient
  gets a *new discussion* notification that lands in the header Tasks bell and points
  at the item — unless that user has blocked the *New discussion* notification for this
  journal in their profile, in which case they are skipped entirely, for both the
  in-app notification **and** the email. <sup>a</sup>
- **Emails**: past that gate, each remaining recipient who has not blocked *discussion
  emails* for this journal gets an email built from a stage-specific template — one
  each for the submission, review, copyediting and production stages. Its subject is
  the item title, its body is the message, and any attachments are carried through; the
  sender is the acting user. The footer includes a personal unsubscribe link and
  standard List-Unsubscribe headers; following that link opens a form whose pre-checked
  boxes record the email opt-out. Each email sent is recorded in the submission's email
  log. <sup>b</sup>
- **Header Tasks bell and grid**: the bell's badge counts the user's *unread*
  task-level notifications; opening it lists all of their task-level notifications,
  newest first, with Mark Read, Mark New and Delete actions. ⚠ The editorial-reminder
  digest's in-app notification is created at normal level, not task level, so it never
  appears in this bell or grid (ledger row 50). <sup>c</sup>
- **Copyediting/production status flip**: whenever notifications fire for an item on
  the Copyediting or Production stage, the four editing/production status notices —
  assign a copyeditor, awaiting copyedits, assign a production user, awaiting
  representations — are recomputed, because the code treats "a discussion exists on
  this stage" as if "someone is assigned". ⚠ The assignment itself never triggers this
  recompute; only this discussion path does (ledger row 9). <sup>d</sup>
- **Event log**: each item records its own history — created, closed, reopened,
  started, a reply posted, a file attached or removed, the due date changed (old to
  new), the owner assigned or reassigned (tasks only), and participants added or
  removed — each entry naming the acting user and the roles involved. These entries
  appear in the item's History modal, and a file-attachment entry now carries the
  attached file's id and name so the modal can link straight to it. ⚠ Rendering the
  role placeholders is fragile across the wider activity log — ledger row 14. <sup>e</sup>
- **Auto cover-note discussion**: submitting with "Comments for the Editor" filled in
  creates a discussion on the submission stage, titled with the cover-note label, with
  all assigned managers, sub-editors, assistants and authors as participants and the
  author as sender. Participants get the *new discussion* notification (this path skips
  the in-app block check) and a plain email — a generic message with no stage template,
  no unsubscribe footer and no email-log entry. ⚠ The opening message is stored
  *without* the head-message flag, so the cover note renders as a reply and the item
  has no head message — see Known deviations. <sup>f</sup>

<sup>a</sup> EditorialTaskController::addTask(), editTask(), addNote(), notifyParticipants() (in-app gate; `NOTIFICATION_TYPE_NEW_QUERY` at `NOTIFICATION_LEVEL_TASK`, `blocked_notification`) ·
<sup>b</sup> StageMailable::getStageMailable() (DiscussionSubmission / DiscussionReview / DiscussionCopyediting / DiscussionProduction); Discussion::addFooter(); Unsubscribe::setupUnsubscribeFooter(), headers(); NotificationHandler::unsubscribe() (`notification/unsubscribe?validate={HMAC token}&id={notificationId}` → `blocked_emailed_notification`); EditorialTaskController::notifyParticipants() (logs `SubmissionEmailLogEventType::DISCUSSION_NOTIFY`) ·
<sup>c</sup> PKPTemplateManager::setupBackendPage(); TaskNotificationsGridHandler::loadData(); NotificationsGridHandler ·
<sup>d</sup> EditorialTaskController::notifyParticipants(); PKPEditingProductionStatusNotificationManager::updateNotification() ·
<sup>e</sup> EditorialTaskController event-logging in the create/close/open/start/note/file/participant handlers (logged against the item, carrying `submissionId`); TaskResource latest-activities (+ `settings` for file id/name) ·
<sup>f</sup> Repository::addCommentsForEditorsQuery(), addQuery() (`NEW_QUERY`; trigger classes/submission/Repository::submit()); Repository::addQuery() (head-message flag omitted)

## Settings that modify behavior

- **Task templates** (Settings → Workflow → Tasks and Discussions Templates): a
  template's auto-add flag turns on stage-entry creation (rule 21); its restrict-to-
  roles setting and the chosen group list limit who sees it in the apply-template
  picker (rule 19); its due interval sets the due date computed when the template is
  applied. <sup>a</sup>
- **Profile → Notifications** (per user, per journal): the *New discussion* in-app
  opt-out suppresses the bell notification *and*, as built, the email too (see Open
  questions #3); the separate email opt-out — also set by the unsubscribe form —
  suppresses only the email. ⚠ The same settings form also offers a *Discussion
  activity* opt-out, but nothing anywhere creates that notification, so the toggle does
  nothing — a dead settings row (Known deviations). <sup>b</sup>
- No config.inc.php variables alter these rules.

<sup>a</sup> template fields `include`, `restrictToUserGroups`, `dueInterval` ·
<sup>b</sup> EditorialTaskController::notifyParticipants() (`blocked_notification` vs `blocked_emailed_notification`); PKPNotificationSettingsForm::getNotificationSettingCategories() (`NOTIFICATION_TYPE_QUERY_ACTIVITY`)

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
  token are shared machinery; this spec only owns their *new discussion* behavior. <sup>a</sup>
- **File attachments** — messages carry either newly uploaded files or existing
  submission files; file-genre and file-stage semantics live with submission-files. <sup>b</sup>

<sup>a</sup> `NEW_QUERY` ·
<sup>b</sup> SaveNoteWithFiles

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
   to the template's type and prefills the title, description and due date; it does
   **not** pre-select participants (⚠ the responsible assignee is cleared and the
   participant list stays at its default, even though the template carries user groups —
   see rule 20). Nothing is saved until the user submits the form.
6. **Email opt-out both ways** — one participant blocks discussion emails in their
   profile: the next discussion still reaches their Tasks bell but not their inbox. A
   second participant instead follows the unsubscribe link in an email and confirms —
   same end state, and both opt-outs are scoped to that journal only.

## Known deviations (as-built ≠ intent)

- ⚠ Side effects / ledger row 9 (docs/e2e/app-changes.md §2 row 9): editing/production
  "assigned" notices key on discussion existence, not assignments.
- ⚠ Side effects / ledger row 14: event-log `{$userGroupName}` param mismatch in
  participant-added rendering (TaskResource::toArray() carries a defensive fallback).
- ⚠ Ledger row 15: DiscussionManager's stage heading goes stale on in-place stage
  switch (DiscussionManager.vue `discussionTitleByStage`) — cosmetic.
- ⚠ Ledger row 50: EditorialReminder in-app notification is NORMAL-level, invisible
  to the TASK-filtered bell/grid.
- ⚠ **Site-admin carve-outs check the wrong scope** (live-probed; app-changes §2,
  product-spec pilot rows) — **low practical impact**: every managerial exemption uses
  journal-scoped `hasRole([…], $contextId)`, which never matches site-level groups
  (RoleDAO::getByUserId() `COALESCE(context_id,0)`), so the explicit site-admin carve-outs
  (EditTask::rules() 'participants' creator/userId manager carve-outs; Repository::removeParticipantFromSubmissionTasks()) are dead code — a site admin holding no
  manager role on the journal lists zero items and gets 401 on writes. Mitigated in
  normal use because journal creation auto-enrols the creating admin as a manager of
  that journal (PKPContextService::add()), so admins ordinarily act through the
  manager role; it only bites an admin account with no manager enrolment on the
  journal. Contrast EditTask::rules() 'headnote' site-context check, which deliberately checks the site context.
  Suspected intent: the carve-outs meant site admin ≥ manager everywhere.
- ⚠ **Reviewer stage access outlives the assignment** (rule and permissions table;
  intent question): QueryUserAccessibleWorkflowStageRequiredPolicy grants review-stage
  access for *any* review assignment, declined and cancelled included; the picker's
  active/accessible filtering exists only on the participant list, not on access
  (EditorialTaskController::getParticipants(), getReviewers()). (Upstream #12928, Jun
  2026, removed the picker's *latest-round* limit so it now offers all active rounds —
  the declined/cancelled mismatch with access still stands.)
- **Vestigial note-deletion endpoint** (live-probed — app-changes §2, product-spec
  pilot rows) — **not a user-facing bug**: a `DELETE …/notes/{noteId}` route exists
  but can never succeed for anyone (NoteAccessPolicy WRITE permits only headnotes,
  NoteAccessPolicy::effect(), while deleteNote rejects headnotes,
  EditorialTaskController::deleteNote() — replies fail authorization, headnote attempts
  401 too, even for a manager supplying `?stageId`). Per the maintainer, replies are
  intentionally permanent, so the observable behaviour is correct; this is dead code
  to remove (or clarify what it was for), not a functional gap.
- ⚠ **Overdue tasks are un-editable without a due-date bump** (live-probed: with a
  DB-forced past `date_due`, an edit resubmitting the same date is a 422) —
  `dateDue` is re-validated `after_or_equal:today` on every edit
  (EditTask::rules() 'dateDue'), so once overdue, adding a participant or fixing a typo is
  rejected until the due date is moved to ≥ today. Suspected intent: the floor
  should apply to *changed* due dates only. App-changes §2, product-spec pilot rows.
- ⚠ **Headnote-less items 500 on description-less edits** (live-probed —
  app-changes §2, product-spec pilot rows): two producers of headnote-less items
  exist — tasks auto-created from a template with an empty description
  (Template::promote() + EditorialTask::fill() `isset` on null) and **every
  cover-note discussion** (Repository::addQuery() creates the first note without
  `isHeadnote`, so "Comments for the Editor" renders its opening message as a
  reply). UI edits are unaffected in practice (the form always sends the required
  description field), but API-shaped edits that omit `description` dereference the
  missing headnote (EditorialTaskController::editTask(); notifyParticipants())
  → 500.
- ⚠ **Actors notify themselves** (live-probed: the creator gets their own NEW_QUERY
  row at TASK level *and* the email; a reply poster likewise — app-changes §2,
  product-spec pilot rows): the creator is appended to the create-notification list
  (EditorialTaskController::addTask()) and a reply notifies *all* participants
  including the poster (EditorialTaskController::addNote()). Legacy behavior excluded the acting user;
  intent unclear.
- ⚠ **Dead "Discussion activity" settings row**: Profile → Notifications offers
  opt-outs for `NOTIFICATION_TYPE_QUERY_ACTIVITY`
  (PKPNotificationSettingsForm::getNotificationSettingCategories()), but no code path ever creates that
  notification type — the toggle does nothing. App-changes §2, product-spec pilot
  rows.

## Open questions

1. Reopening a completed *task* is blocked everywhere in the UI (the Closed-column
   checkbox and the view-modal status control are both disabled once the task is
   closed), but the reopen endpoint `PUT …/open` has no task-vs-discussion guard, so a
   task can still be reopened by a direct API call; a closed-but-unstarted task can even
   be "started" (rule 10 ⚠). Is one-way task completion the intended product rule (the
   API should then 409 for tasks), or is the API deliberately permissive?
2. Should the acting user be excluded from their own NEW_QUERY notification/email
   (see Known deviations)?
3. Blocking the *in-app* "new discussion" notification also suppresses the email
   (the `continue` at EditorialTaskController::notifyParticipants() precedes the email path) even
   when the email column is unblocked — intended coupling, or should the two profile
   columns be independent?
4. The auto cover-note path (Repository::addQuery()) sends a bare mailable — no stage
   template, no unsubscribe footer, no DISCUSSION_NOTIFY email-log entry, and ignores
   the in-app block list. Deliberate lightweight path, or should it share
   notifyParticipants?
5. `Repository::countOpenPerStage` (Repository::countOpenPerStage()) calls scopes that no longer
   exist on the model (`withClosed`, `withUserIds`) and has no callers — dead code to
   delete, or a regression from the query→editorialTask rename?
6. `edit_tasks.status`/`closed` columns are fillable but never read (status is always
   derived, TaskResource::determineStatus()) — schema leftovers?
7. Should declined/cancelled review assignments keep granting review-stage access to
   tasks and discussions (QueryUserAccessibleWorkflowStageRequiredPolicy), given the
   participant picker still filters them out? (Upstream #12928 loosened the picker to
   all active rounds but kept excluding declined/cancelled, so the access-vs-picker
   mismatch narrowed but was not closed.)

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
