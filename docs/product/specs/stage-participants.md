---
name: stage-participants
scope: Editors staff a submission — adding, editing and removing the people assigned to its workflow stages, with per-assignment privileges (recommend-only, metadata editing) and automatic editor assignment from section/category settings
shared: pkp-lib
status: verified
atlas-claims:
  - VUE-participant-manager
  - GRID-lib-pkp-grid-users-stage-participant-stage-participant-grid-handler
  - GRID-lib-pkp-grid-users-user-select-user-select-grid-handler
  - DB-stage_assignments
  - DB-subeditor_submission_group
  - EVLOG-SUBM-ADD-PART
  - EVLOG-SUBM-REM-PART
  - NOTIF-editor-assign
  - NOTIF-editor-assignment-required
  - API-submission-get-participants
  - API-submission-get-participants-2
  - MAIL-editor-assigned
  - MAIL-submission-needs-editor
  - LOC-common-stageParticipants-notify
---

# Stage participants

## Purpose

Every submission needs a team: editors who decide, assistants who copyedit and lay
out, authors who revise. The **Participants** panel on the submission workflow page
is where that team is managed. A Journal Manager or Section Editor assigns a person
in a role, optionally sending them a notification message; the assignment carries two
per-person privileges — whether an editor may only *recommend* decisions rather than
record them, and whether the person may edit the publication's metadata. Assignments
drive access everywhere else: an Assistant or Section Editor only sees and works on
submissions they are assigned to. The system can also assign editors automatically,
from the editor lists configured on the journal's sections and categories, the moment
an author submits.

## Actors & permissions

Terms: *assigned* = holds an assignment on this submission in a role whose user group
works on the stage in question; a single assignment covers **every** stage its role
group works on, not just the stage it was made from. A *manager-level* role is any
role whose permission level is Journal Manager — the level is visible when a Journal
Manager edits the role under Settings → Users & Roles → Roles; on a default journal
that is Journal Manager itself plus Journal Editor and Production Editor (Guest
Editor is not — its level is Section Editor). Site-wide baselines: **Journal
Manager and Site Administrator** act on every submission without needing an
assignment — except that a manager who is a reviewer on the submission with an
active invitation is treated as a reviewer only: the submission moves to their
reviewer view and the workflow's stage pages, this panel included, are withheld
until the review invitation is declined — or the review cancelled, which restores
the managerial view the same way; and the demotion applies only while the manager
holds no other assignment on the submission in any role. **Authors and Reviewers** never see the
Participants panel — their workflow views simply don't include it — and the
participant list itself is closed to them. **Anonymous** users have no access. <sup>a</sup>

| Action | Who may — and when |
|--------|--------------------|
| **See the Participants panel** | • Journal Manager, Site Administrator — every submission, all stages<br>• Section Editor, Assistant — only submissions and stages they are assigned to; on a stage their role group does not cover, the workflow shows "You don't currently have access to that stage of the workflow." instead of any panels <sup>b</sup> |
| **Assign a participant** ("Assign" button) | • Journal Manager, Site Administrator — any time<br>• Section Editor — when assigned to the stage being viewed<br>• ⚠ A recommend-only Section Editor can grant the recommend-only privilege while assigning someone new, though not while editing (Known deviations, ledger 75) <sup>c</sup> |
| **Edit an assignment's privileges** | • Journal Manager, Site Administrator — any participant except themselves-as-Section-Editor; on rows with nothing changeable the form says "No changes can be made to this participant"<br>• Section Editor assigned to the stage — offered Edit on rows that are not their own and not a manager-level role's (such as Journal Editor); a recommend-only Section Editor is not offered it on any Section Editor row ⚠ yet every Section Editor edit is refused by the server without a word — the form reopens with the boxes reset and nothing saved (Known deviations, ledger 229) <sup>d</sup> |
| **Remove a participant** | • Journal Manager, Site Administrator — any row<br>• Section Editor assigned to the stage — ⚠ sees and can use Remove on every row where Edit is withheld too: a Journal Editor's row, and their own — self-removal instantly costs them their access to the submission (Known deviations, ledger 230) <sup>e</sup> |
| **Notify** (start a discussion with one participant) | • Journal Manager, Site Administrator, Section Editor, Assistant — anyone of these with access to the stage; Assistants are otherwise read-only here <sup>f</sup> |
| **Log in as a participant** | • Rows show "Log In As" only where the viewer has impersonation rights over that user (rules owned by user-management) <sup>g</sup> |
| **Automatic editor assignment** | • The system — on submission, from the editor lists configured on the submission's section and categories; ⚠ silently inoperative on any journal created after the install's first (Known deviations, ledger 135/164) <sup>h</sup> |

<sup>a</sup> Schema::getPropertyStages() (global manager/admin roles injected into every stage's currentUserAssignedRoles unless the user is assigned in **no** role on the submission AND holds a review assignment that is neither declined nor **cancelled** — `!getDeclined() && !getCancelled()`, Schema.php ~963–972; code re-derived 2026-07-22, verify chunk a); workflowConfigAuthorOJS.js (no ParticipantManager); PKPSubmissionController participants routes (roleAuthorizer MANAGER/SUB_EDITOR/ASSISTANT); live-probed 2026-07-21 (probe A item 2: scratch manager with accepted review → currentUserAssignedRoles empty on every stage, stage views withheld, submission listed under "My Assignments as Reviewer"; after decline → managerial view restored incl. Assign/Edit/Remove; nuance: GET …/participants/{stageId} still answers 200 to the demoted manager — the closure is UI-side only, the API roleAuthorizer keys on journal roles) ·
<sup>b</sup> workflowConfigEditorialOJS.js getSecondaryItems() (ParticipantManager in every stage's side panel); WorkflowStageAccessPolicy (grid ops); PKPSubmissionController::getParticipants(); live-probed 2026-07-21 (probe A items 1/10: assigned Assistant on stage 1 and SE whose group lacks stage 4 both get the no-access message, panel absent; unassigned Assistant: workflow shell empty, submission + participants API 401 roleBasedAccessDenied); ⚠ an *assigned* Assistant opening the Submission or Review stage is occluded by a blocked reviewer-suggestions error dialog (Known deviations, ledger 234) ·
<sup>c</sup> useParticipantManagerConfig() getTopItems() (MANAGER/SITE_ADMIN/SUB_EDITOR assigned-in-stage); StageParticipantGridHandler::__construct() (addParticipant/saveParticipant ops); AddParticipantForm::execute() add branch (ungated recommendOnly); live-probed 2026-07-21 (probe A item 1 full matrix: unassigned JM + admin + assigned SE see Assign on stages 1 and 4, assigned Assistant does not; probe C item 7: recommend-only SE offered Assign) ·
<sup>d</sup> useCurrentUser() canCurrentUserEditParticipant() (UI matrix); Validation::canEditParticipant() (server guard; its stage filter can never match — see Known deviations); AddParticipantForm::_isChangeRecommendOnlyAllowed(), _isChangePermitMetadataAllowed(); stageParticipants.noOptionsToHandle; live-probed 2026-07-21 (probe A item 3: 4-viewer × 6-row matrix exactly as stated; probe B item 4: SE ticked the Permissions box on an Assistant row → HTTP 200 with re-rendered form, no error, no toast, DB flag unchanged, no event-log entry) ·
<sup>e</sup> useParticipantManagerConfig() getItemActions() (Remove keyed on canAdminister only, not isEditable); StageParticipantGridHandler::deleteParticipant() (role + CSRF + submission check only); live-probed 2026-07-21 (probe B item 5: assigned SE removed a Journal-editor row — DB row deleted, removal logged — and removed herself, losing the workflow view mid-page) ·
<sup>f</sup> StageParticipantGridHandler::__construct() (viewNotify/sendNotification in the Assistant op set); useParticipantManagerConfig() getItemActions() (Notify unconditional); live-probed 2026-07-21 (probe A item 10: assigned Assistant's row menus carry only Notify; send succeeded end-to-end with "Notification sent to users.") ·
<sup>g</sup> participant payload canLoginAs; useParticipantManagerActions() participantLoginAs(); live-probed 2026-07-21 (probe A: Log In As on every row for JM/admin, never for SEs or the Assistant) ·
<sup>h</sup> SubEditorsDAO::assignEditors(); AssignEditors::handle(); live-probed 2026-07-21 (probe D item 14 — see rule 10)

## Fields & validation

**The Assign Participant form** (the panel's "Assign" button):

| Field (UI label) | Required? | Rules |
|------------------|-----------|-------|
| **Locate a User** | Yes | A searchable user list filtered by a role dropdown; only roles whose groups work the current stage are offered, and reviewer roles never are. The list hides anyone *already assigned* on this submission in the chosen role — on every stage's panel, not just the one the form was opened from. Picking a role then a person is required — "You must select a user group." — and the server re-checks that the person actually holds the chosen role <sup>a</sup> |
| **Assignment privileges** — "This participant is only allowed to recommend an editorial decision…" | No | Shown only when the chosen role is an editor role (Journal Manager or Section Editor group); default unchecked, or the group's own recommend-only default when assigned automatically <sup>b</sup> |
| **Permissions** — "Allow this person to make changes to the publication…" | No | Default follows the chosen group's metadata-edit setting; for Journal Manager assignments it is always granted regardless of the box <sup>c</sup> |
| **Choose a predefined message / Message** | No | An optional notification: pick a predefined email for the stage (e.g. the "Assign Editor" variants, copyediting or layout requests) or write one; sending it starts a discussion with the person (see Side effects). Leaving it blank assigns silently ⚠ (rule 8) <sup>d</sup> |

<sup>a</sup> UserSelectGridHandler::loadData() (filterExcludeSubmissionStage, searchPhrase); Collector::buildExcludedSubmissionStagesFilter() (joins on submission + user + group only — no stage condition, so exclusion spans all stages; live-probed 2026-07-21, probe C item 6: an assigned SE absent from the SE picker on both stage panels, name search "No Items"); AddParticipantForm::validate() (userInGroup); editor.submission.addStageParticipant.form.userGroupRequired; role-dropdown stage scoping live-probed 2026-07-21 (probe D item 11 setup: review-stage picker omits Copyeditor and other stage-4/5 groups) ·
<sup>b</sup> addParticipantForm.tpl 'recommendOnly'; StageParticipantNotifyHandler.js updateRecommendOnly(); SubEditorsDAO::assignEditors() (group default) ·
<sup>c</sup> addParticipantForm.tpl 'canChangeMetadata'; AddParticipantForm::execute() (manager forced true); Repository::build() (group default when unset) ·
<sup>d</sup> addParticipantForm.tpl notify area; AddParticipantForm::isMessageRequired() (false); PKPStageParticipantNotifyForm::fetch() (stage template + alternates); live-probed 2026-07-21 (probe C item 8: Submission-stage picker offers exactly "Discussion (Submission)" and "Assign Editor", body auto-filled)

**The Edit Assignment form** (a row's Edit action) shows the fixed participant and
role, and only the privilege checkboxes the acting user may change for that row; when
neither is changeable it says "No changes can be made to this participant". It has no
notification section. <sup>e</sup>

**The Notify form** (a row's Notify action, dialog titled "Notify") is headed "Start
Discussion" and explains it begins a discussion between the acting user and that
person; it has the same predefined-message picker plus a **Message** field —
required here. <sup>f</sup>

<sup>e</sup> addParticipantForm.tpl edit branch (isChangeRecommendOnlyAllowed / isChangePermitMetadataAllowed gates); live-probed 2026-07-21 (probe B item 13: manager-level Journal-editor row → recommend-only box only; Assistant row → Permissions box only; own SE row → no boxes, "No changes can be made to this participant", Edit still offered) ·
<sup>f</sup> notify.tpl; PKPStageParticipantNotifyForm::isMessageRequired() (true); live-probed 2026-07-21 (probe A item 10: dialog "Notify", body "Start Discussion — Begin a discussion between yourself and …", Message starred required, submit button "Notify")

## Rules & state

**What an assignment is**
1. An assignment ties one person, in one role, to the whole submission — "Users are
   assigned to stages of the workflow by user group", as the form itself explains. The
   person appears on the Participants panel of **every** stage their role group works
   on, and removing them removes them from all of those stages at once (the removal
   dialog warns exactly this). <sup>a</sup>
2. The panel lists participants grouped and ordered by role, each row showing the
   person's name, role name, and — when they hold the recommend-only privilege — the
   note "Only allowed to recommend an editorial decision". An empty role section reads
   "None Assigned". The panels exist for every stage, including stages the submission
   has not reached. ⚠ An assignment made under the "Journal Manager" role group itself
   never appears on any panel — journal-manager participants are visible only via
   groups like Journal Editor or Production Editor (Known deviations,
   ledger 233). <sup>b</sup>
3. The same person cannot be assigned twice in the same role through the form — the
   picker hides them everywhere (Fields, "Locate a User"). ⚠ If a duplicate
   assignment request is forced through anyway (a hand-crafted request; no UI path
   reaches it), it reports success while keeping the existing assignment untouched
   and discarding the privilege boxes without any warning — the only way to change
   an existing assignment's privileges is Edit (Known deviations, ledger 74 as
   amended). <sup>c</sup>

**Privileges**
4. **Recommend-only** exists for editor roles only: such an editor can record only
   recommendations, not decisions, on this submission (the decision rules live with
   editorial-decisions). The privilege is per-assignment: the same Section Editor can
   be recommend-only on one submission and a deciding editor on another. <sup>d</sup>
5. **Metadata editing** controls whether the participant may change the publication's
   title, abstract and other details (enforcement lives with the publication-metadata
   rules); Journal Manager assignments always carry it. When an author completes
   submission, every author assignment's metadata privilege is reset to the author
   group's configured default — a pre-submission editing grant does not survive
   submission. <sup>e</sup>
6. **Who may change which privilege on Edit**: nobody may change their own
   Section-Editor assignment (the form still opens, reading "No changes can be made
   to this participant"); the metadata box is never offered on a manager-level row
   (it is always granted anyway); the recommend-only box is offered only on editor
   rows — and for an acting editor who is themselves recommend-only, the Edit action
   is withheld from editor rows entirely rather than shown with the box disabled.
   ⚠ On **Assign** (add mode) none of these guards run — both boxes are shown and
   honored for any administering user, so a recommend-only Section Editor can stamp
   recommend-only onto a new participant (Known deviations, ledger 75). ⚠ And for
   Section Editors the Edit matrix is moot in practice: the server refuses every
   non-manager privilege edit without feedback (Actors; Known deviations,
   ledger 229). <sup>f</sup>
7. **Anonymity protection — intended, but dead** ⚠: while a submission is in review,
   choosing a person who is conducting an anonymous review is meant to pop a warning
   that assigning them will reveal the author's identity. As built the warning never
   appears for anyone — the assignment simply proceeds with no notice, active
   anonymous reviewer or not (Known deviations, ledger 231). <sup>g</sup>

**Assignment effects on workflow status**
8. Editing-stage and production-stage status notices ("Assign a copyeditor using the
   Assign link in the Participants list.", "Awaiting copyedits.", and their
   production counterparts) are shown only to editors who are themselves assigned on
   that stage — an unassigned Journal Manager sees no status line at all. ⚠ The
   notice tracks whether a stage *discussion* exists, not who is assigned: assigning
   with the message left blank keeps the "assign a …" prompt; sending the message
   (or a later Notify) flips it to the awaiting state; and removing participants
   never changes it — even removing the only copyeditor leaves "Awaiting copyedits."
   standing. The notice can therefore be stale in both directions (Known deviations,
   ledger 9 as amended). <sup>h</sup>
9. Assigning an editor clears the journal managers' "editor needs to be assigned"
   task wherever an editor is now present. Separately, a submission can carry a
   per-stage notice that decisions are blocked for want of an editor — "An editor
   must be assigned before review is initiated. Please add editor using the
   Participants list.", and the counterparts asking for a production editor before
   the editorial or production process begins. Saving a participant in a
   manager-level role re-checks those notices stage by stage: the prompt is removed
   for any stage that now has an editor (a manager-level participant or Section
   Editor) assigned, and created for any stage that still has none. <sup>i</sup>

**Automatic editor assignment**
10. When an author completes submission, every editor configured on the submission's
    section — and on any of its categories — is assigned automatically, in the
    configured role, with the role group's recommend-only default; disabled accounts
    and people who no longer hold the configured role are skipped. Duplicate
    configurations collapse to one assignment. ⚠ As built this works only on the
    install's first journal, by accident: on any later journal every configured
    editor is silently skipped and the needs-editor fallback (rule 11) fires instead
    (Known deviations, ledger 135/164 — owned by sections / submission-wizard).
    No screen reveals which journal is the install's first — it is simply the
    earliest-created one, a fact a tester must get from whoever maintains the
    install. <sup>j</sup>
11. If automatic assignment produced no editor, every Journal Manager instead gets an
    "editor needs to be assigned" task item and a "needs editor" email (individually
    suppressible via their notification opt-outs). <sup>k</sup>

**Notify**
12. The Notify action (and the assign-form message) starts a regular discussion
    between the acting user and that participant on the current stage, titled with the
    chosen email's subject line; the recipient gets the discussion notification and
    the email itself, subject to their notification opt-outs. Sending confirms with
    "Notification sent to users." <sup>l</sup>

**Removal**
13. Removing a participant deletes the assignment (all stages, rule 1) and drops them
    from every task and discussion on the submission — unless they are a Journal
    Manager. Anyone removed this way simply loses the submission from their
    dashboards, since access rode on the assignment. The editing/production status
    notice does not change on removal (rule 8 ⚠). <sup>m</sup>

<sup>a</sup> stage_assignments (no stage column — stage membership derives from user_group_stage); StageAssignment::scopeWithStageIds() (via userGroupStages); editor.submission.addStageParticipant.userGroup; editor.submission.removeStageParticipant.description; live-probed 2026-07-21 (probe D item 12: SE assigned from the Copyediting panel appears on Submission/Review/Production panels too; removal from any panel clears all; a Copyeditor row stays scoped to Copyediting only) ·
<sup>b</sup> participantManagerStore.js participantsList (sort by roleId, userGroupId); ParticipantManagerItemInfoRecommendOnly.vue; StageParticipantGridHandler::loadData()/loadCategoryData(); editor.submission.noneAssigned; manager-group invisibility: getParticipants → user\Collector::assignedTo() INNER JOINs user_group_stage and the Journal manager group has zero stage rows — live-probed 2026-07-21 (probe B: seeded manager-group assignment present in DB, rendered on no panel; same mechanism family as ledger 205) ·
<sup>c</sup> Repository::build() (firstOr keyed on submission+user+group); AddParticipantForm::execute() add branch; live-probed 2026-07-21 (probe C item 6: picker exclusion spans stages, so no UI path; direct save-participant POST with recommendOnly=1 for an already-assigned SE → success response, existing row byte-identical, no duplicate) ·
<sup>d</sup> stage_assignments.recommend_only; Schema::getPropertyStages() (currentUserCanRecommendOnly, isDecidingEditorAssigned); row note live-probed 2026-07-21 (probe C item 7) ·
<sup>e</sup> stage_assignments.can_change_metadata; Repo::submission()->canEditPublication(); AddParticipantForm::execute() (manager forced true); RestrictAuthorAssignment::handle(); UpdateAuthorStageAssignments::handle(); live-probed 2026-07-22 (verify-d E2: scenario draft carries can_change_metadata=1, real submit resets it to the Author group default 0; reset executed by RestrictAuthorAssignment — UpdateAuthorStageAssignments' index-keyed group lookup is inert, see Known deviations cleanup bullet) ·
<sup>f</sup> AddParticipantForm::_isChangeRecommendOnlyAllowed(), _isChangePermitMetadataAllowed() (consulted in the edit branch of fetch()/execute() only); addParticipantForm.tpl add branch (unconditional checkboxes); StageParticipantNotifyHandler.js updateRecommendOnly() (group-keyed show/hide only); live-probed 2026-07-21 (probe C item 7: recommend-only SE's add-mode checkbox enabled, save stamped recommend_only=1 and the row note appeared; same actor's menu on another SE row held only Notify/Remove — no Edit); micro-edge (verify chunk a, code): _isChangeRecommendOnlyAllowed keys on the acting user's assignments regardless of role, so even a Journal Manager holding a recommend-only assignment on this submission loses the recommend-only box in edit mode — Validation::canEditParticipant() admits managers, but the form withholds the checkbox ·
<sup>g</sup> AddParticipantForm::fetch() anonymousReviewerIds (anonymous + double-anonymous, non-declined — server data correct); StageParticipantNotifyHandler.js maybeTriggerReviewerWarning() (string radio value vs integer id array — strict indexOf never matches, ConfirmationModal branch unreachable); editor.submission.addStageParticipant.form.reviewerWarning (orphaned at runtime); live-probed 2026-07-21 (probe D item 11: active anonymous reviewer selected → no warning, assignment saved; declined reviewer correctly excluded from the id list) ·
<sup>h</sup> PKPEditingProductionStatusNotificationManager::updateNotification() (EDITING branch keys on an editing-stage discussion existing — "If a copyeditor is assigned i.e. there is a copyediting discussion"; loops editorStageAssignments, hence per-assigned-editor visibility); StageParticipantGridHandler::saveParticipant() (no recompute); sendNotification() and deleteParticipant() (recompute runs but is inert on delete — the discussion survives); live-probed 2026-07-21 (probe D item 9 matrix: silent assign → prompt stays; assign+message and Notify → "Awaiting copyedits."; removals → no change, incl. removing the last copyeditor); the notice rows themselves are created only by UI-recorded ACCEPT / SEND_TO_PRODUCTION decisions — ⚠ Accept-and-Skip-Review creates none at all (Known deviations, ledger 8 as amended) ·
<sup>i</sup> StageParticipantGridHandler::saveParticipant() (EDITOR_ASSIGNMENT_REQUIRED cleanup loop; decision-stage notices when the saved group is a manager group); PKPNotificationManager::getDecisionStageNotifications() (the four per-stage EDITOR_ASSIGNMENT_* types); EditorAssignmentNotificationManager::updateNotification() (per stage: delete when a MANAGER/SUB_EDITOR assignment covers the stage, create when none; notice texts notification.type.editorAssignment / editorAssignmentEditing / editorAssignmentProduction); live-probed 2026-07-22 (verify-d E1: needs-editor task rows for every manager incl. admin deleted on a Section-editor assignment — the delete is submission-scoped, not per-viewer; a Funding-coordinator (assistant) assignment leaves them; Tasks bell reflects both states) ·
<sup>j</sup> SubEditorsDAO::assignEditors() (section + category lists, userInGroup + enabled filters, dedupe, group recommendOnly default; ⚠ $userGroups->keys() — collection indexes, not group ids — kills every candidate whose group id exceeds the journal's group count: ledger 135/164); triggered by the submitted event; live-probed 2026-07-21 (probe D item 14: real submit endpoint; publicknowledge ART → both in-group configured SEs assigned + mailed, the configured-but-not-in-group editor correctly skipped; scratch journal with configured SE → no assignment, zero mail, needs-editor fallback fired) ·
<sup>k</sup> AssignEditors::handle() (EDITOR_ASSIGNMENT_REQUIRED task per manager + SubmissionNeedsEditor mailable, opt-out checked); live-probed 2026-07-21 (probe D item 14B1: task text "A new article has been submitted to which an editor needs to be assigned." + 'A new submission needs an editor to be assigned: "…"' email, to every journal-manager holder) ·
<sup>l</sup> PKPStageParticipantNotifyForm::sendMessage() (discussion + NEW_QUERY at TASK level + mailable with unsubscribe); stageParticipants.history.messageSent; live-probed 2026-07-21 (probe C item 8: discussion titled with the email subject, participants = actor + recipient, recipient's bell shows the discussion notice; probe A item 10: "Notification sent to users.") ·
<sup>m</sup> StageParticipantGridHandler::deleteParticipant(); Repo::editorialTask()->removeParticipantFromSubmissionTasks() (manager exception per tasks-discussions rule 9); live-probed 2026-07-21 (probe D item 12: dialog "Remove Participant / You are about to remove this participant from all stages."; post-OK: assignment rows gone, discussion participation pruned, dashboard no longer lists the submission)

## Side effects

- **Confirmation toasts**: a new assignment confirms "User added as a stage
  participant."; a privilege edit confirms "The stage assignment has been changed." <sup>a</sup>
- **Submission history**: adding writes a "… was assigned to this submission as
  a …" entry; removing writes the matching removal entry. Both name the real acting
  user even when working as someone else. ⚠ A privilege *edit* — or even a forced
  re-assignment that changes nothing — writes another "was assigned" entry, so
  histories show repeated assignment lines with no edit-specific wording (Known
  deviations, ledger 232). ⚠ And in every such entry the role name never fills
  in: the line ends in a raw placeholder where the role should be (Known
  deviations, ledger 14 — owned by editorial-activity-log). <sup>b</sup>
- **Notification message / Notify** (when a message is sent): a discussion is created
  with the acting user and the recipient as its participants; the recipient gets an
  in-app discussion notification (skipped if they blocked it) and the email, which
  carries a personal unsubscribe link; the email is recorded in the submission's
  email log — filed internally under a category matching the chosen predefined
  message, though the log shows no such label on screen: a manual check can only
  confirm the email appears there. Copyediting, layout
  and indexing request messages additionally place a matching task notice in the
  recipient's Tasks bell. ⚠ The "editor assigned" task notice never fires — its
  trigger keys on a message name that no longer exists (Known deviations, ledger 73). <sup>c</sup>
- **Automatic assignment on submit**: each auto-assigned editor gets an in-app "new
  submission" notification and a "You have been assigned as an editor…" email
  (opt-out respected, logged in the email log); with no editor configured — or,
  as built, on any journal after the install's first (rule 10 ⚠) — managers get
  the "editor needs to be assigned" task and "needs editor" email instead
  (rule 11). <sup>d</sup>

<sup>a</sup> notification.addedStageParticipant; notification.editStageParticipant; StageParticipantGridHandler::saveParticipant() (branch keyed on whether a new assignment id was produced); live-probed 2026-07-21 (probe B item 15: both exact texts observed; the edit really saved on the manager path — recommend_only flipped in DB) ·
<sup>b</sup> SUBMISSION_LOG_ADD_PARTICIPANT / SUBMISSION_LOG_REMOVE_PARTICIPANT; submission.event.participantAdded / participantRemoved; userId = Validation::loggedInAs() ?? current user; the add-entry is written on every successful save — edit and no-op re-assign included (live-probed 2026-07-21: probe B item 15 two identical participantAdded rows for one add + one edit; probe C item 6 a third for a no-op re-assign); placeholder: saveParticipant passes param key userGroupName but eventLog.json declares only userGroupNames, so the param is dropped and the locale placeholder renders literally (ledger 14; probe B: no such row in event_log_settings, every add entry affected) ·
<sup>c</sup> PKPStageParticipantNotifyForm::sendMessage() (EditorialTask + Participant rows, NEW_QUERY, allowUnsubscribe, email-log switch by template key; COPYEDIT_REQUEST/LAYOUT_REQUEST/INDEX_REQUEST → _addAssignmentTaskNotification; dead case 'EDITOR_ASSIGN' → NOTIFICATION_TYPE_EDITOR_ASSIGN); ledger 73 re-validated live 2026-07-21 (probe C item 8: "Assign Editor" = EDITOR_ASSIGN_SUBMISSION sent — discussion + email + email-log row + NEW_QUERY notice all present; zero EDITOR_ASSIGN-type notifications in the entire long-lived test DB) ·
<sup>d</sup> SubEditorsDAO::assignEditors() (NOTIFICATION_TYPE_SUBMISSION_SUBMITTED; EditorAssigned mailable, EDITOR_ASSIGN email-log type); AssignEditors::handle(); live-probed 2026-07-21 (probe D item 14: assigned SEs got the submitted notification + "You have been assigned as an editor on a submission to …" email; no needs-editor task when editors were assigned)

## Settings that modify behavior

- **Section and category editor lists** (Settings → Journal → Sections; category
  setup): who is auto-assigned on submission, and in which role (rules 10–11 —
  including rule 10's ⚠ first-journal-only caveat). <sup>a</sup>
- **Role settings** (Settings → Users & Roles → Roles): each group's stage
  assignments decide which stage panels a participant appears on (rule 1); the
  group's recommend-only default seeds automatic assignments (rule 10); the group's
  metadata-edit permission seeds the Permissions box and the author reset on submit
  (rule 5). <sup>b</sup>
- **Profile → Notifications** (per user, per journal): opt-outs govern the discussion
  notification/email from Notify, the "Editor Assigned" email, and the managers'
  "needs editor" email. <sup>c</sup>
- No config.inc.php variables alter these rules.

<sup>a</sup> subeditor_submission_group (assoc section/category → user + group); PKPSectionForm; category Repository ·
<sup>b</sup> user_group_stage; user_groups recommendOnly / permitMetadataEdit ·
<sup>c</sup> blocked_notification / blocked_emailed_notification checks in the paths above

## Cross-feature interactions

- **Editorial decisions** — what a recommend-only editor can record, and the
  deciding-editor prompts, are defined there; this spec owns only the flag itself.
- **Tasks & discussions** — Notify creates a discussion (owned here as a trigger;
  discussion behavior is theirs); removal prunes task/discussion participation
  (their rule 9 documents the manager exception).
- **Submission wizard** — creates the author's own assignment; the submitted event
  triggers automatic editor assignment (rules 10–11, owned here) and the author
  privilege reset (rule 5).
- **Publication metadata** — enforcement of the metadata-edit privilege.
- **User management / roles** — group membership, group defaults, and the Log In As
  rules.
- **Editorial dashboards & workflow navigation** — assignment is what makes a
  submission appear in "Assigned to me" views and opens stage access for Section
  Editors and Assistants; those screens own their own listing rules.
- **Assign & manage reviewers** — reviewers are assigned through their own manager,
  never through this panel (reviewer roles are excluded from the role picker).

## Canonical scenarios

1. **Assign a copyeditor with a notification** — a Journal Manager opens a
   submission's Copyediting stage and clicks "Assign" in the Participants panel. In
   the "Assign Participant" form they filter the user list to the copyeditor role,
   search and select a person, pick the copyedit request as the predefined message,
   and save. The panel now lists the person under their role, the toast "User added
   as a stage participant." appears, the copyeditor receives the request email and a
   discussion with that email's subject appears on the stage, and the submission's
   history gains "… was assigned to this submission as a …". <sup>s1</sup>
2. **Silent assignment leaves the stage status stale** ⚠ — the same manager assigns a
   second copyeditor but clears the message box before saving. The person is listed
   as a participant. The stage status line is visible only to an editor assigned on
   the stage — assigning others does not assign the manager themselves, so an
   unassigned manager sees no status line at all (rule 8) and this check must be
   made as an assigned editor. Viewed that way, the line still reads "Assign a
   copyeditor using the Assign link in the Participants list." — it flips to
   "Awaiting copyedits." only once a notification message is sent, whether from the
   assign form or a later Notify; removing participants never updates it either
   (ledger 9). <sup>s2</sup>
3. **Section hand-off: automatic editor assignment** — a Journal Manager configures a
   Section Editor on a section's editor list. An author submits to that section: the
   Section Editor appears in the submission's Participants panel without anyone
   touching it, and receives the "You have been assigned as an editor…" email. On a
   section with an empty editor list, submitting instead puts "A new article has
   been submitted to which an editor needs to be assigned." in every Journal
   Manager's Tasks bell, plus the needs-editor email. ⚠ On any journal created
   after the install's first, the configured editor is silently skipped and the
   editor-needed fallback fires as if the list were empty (ledger 135/164). <sup>s3</sup>
4. **Recommend-only editor** — while assigning a Section Editor, the manager ticks
   "This participant is only allowed to recommend an editorial decision…". The new
   row carries the note "Only allowed to recommend an editorial decision", and that
   editor's decision controls offer only recommendations. ⚠ If a recommend-only
   Section Editor themselves assigns a new editor, the same box is available to them
   — though the Edit action on existing editor rows is withheld from them entirely
   (ledger 75). <sup>s4</sup>
5. **Editing a participant's privileges** — a Journal Manager uses a Section Editor
   row's Edit action: the "Edit Assignment" form shows the person read-only with both
   privilege boxes; saving confirms "The stage assignment has been changed." Opening
   Edit on a Journal Editor's row (a manager-level role — see Actors & permissions) offers only
   the recommend-only box, and on the manager's own Section-Editor assignment the
   form reads "No changes can be made to this participant". <sup>s5</sup>
6. **The picker never re-offers an assigned person** — a Journal Manager opens
   "Assign" and filters the user list to a role somebody already holds on this
   submission: that person is missing from the list, on every stage's panel alike,
   and searching their name finds "No Items" — so the same assignment cannot be
   made twice from the form. Changing an existing participant's privileges is done
   with the row's Edit action, never by re-assigning. ⚠ (A duplicate request forced
   outside the form reports success while silently discarding its privilege boxes —
   ledger 74.) <sup>s6</sup>
7. **Removing a participant clears them everywhere** — a Journal Manager clicks
   Remove on an Assistant who participates in a discussion. The dialog "Remove
   Participant" warns "You are about to remove this participant from all stages";
   confirming removes them from every stage's panel, drops them from the submission's
   discussions, logs the removal in the history, and the submission disappears from
   the Assistant's own dashboard. <sup>s7</sup>
8. **Assistant sees but cannot manage** — an Assistant assigned to the Copyediting
   stage opens the submission: the Participants panel lists the team, but shows no
   "Assign" button and no Edit or Remove on any row; the Notify action is available.
   A different Assistant with no assignment on this submission cannot open the
   submission's workflow at all. <sup>s8</sup>
9. **Notify starts a discussion** — a Section Editor uses Notify on the layout
   editor's row. The "Notify" dialog, headed "Start Discussion", explains it begins
   a discussion between the two of them; the Message field is required here. After
   sending, "Notification sent to users." confirms, the layout editor gets the
   email, and the exchange appears as a discussion on the stage. <sup>s9</sup>

<sup>s1</sup> seeded journal + role-keyed accounts per test roster; COPYEDIT_REQUEST also files a Tasks-bell notice for the recipient; toast/dialog texts live-probed 2026-07-21 (probes A/D) ·
<sup>s2</sup> the recompute lives only in the message paths and keys on the stage discussion (rule 8); full matrix live-probed 2026-07-21 (probe D item 9; note the notice is visible only to editors assigned on the stage) ·
<sup>s3</sup> SubEditorsDAO::assignEditors(); AssignEditors::handle(); live-probed 2026-07-21 (probe D item 14 — first-journal leg positive on publicknowledge; scratch-journal leg falls to the fallback per ledger 135/164; test on the seeded journal) ·
<sup>s4</sup> AddParticipantForm::execute() add vs edit branches; live-probed 2026-07-21 (probe C item 7 end-to-end) ·
<sup>s5</sup> guard matrix rule 6; live-probed 2026-07-21 (probe B item 13; the "Journal Manager row" is reachable only via manager-role groups with stages — Journal editor / Production editor, see rule 2 ⚠) ·
<sup>s6</sup> Repository::build() firstOr; Collector::buildExcludedSubmissionStagesFilter(); live-probed 2026-07-21 (probe C item 6: picker exclusion + direct-POST silent discard) ·
<sup>s7</sup> deleteParticipant() + removeParticipantFromSubmissionTasks(); live-probed 2026-07-21 (probe D item 12: exact dialog text; assignment, discussion participation and dashboard access all cleared) ·
<sup>s8</sup> Assistant op set excludes add/save/delete; WorkflowStageAccessPolicy; live-probed 2026-07-21 (probe A item 10: Notify-only menus, no Assign; unassigned Assistant gets an empty workflow shell, API 401) ·
<sup>s9</sup> notify.tpl; sendMessage(); live-probed 2026-07-21 (probe A item 10 dialog anatomy + toast)

## Known deviations (as-built ≠ intent)

All probe references below are the 2026-07-21 live-probe reports
(docs/product/.reports/stage-participants-probe{A,B,C,D}.md); every row below was
independently re-reproduced with no drift on 2026-07-22 by the verification pass
(docs/product/.reports/stage-participants-verify-{a..f}.md — code re-derivation,
live positive/denial probes, and edge seeds). Ledger rows 229–234 plus an
amendment to row 8 are drafted in final form in
docs/product/.reports/stage-participants-ledger-proposals.md (numbering verified
against the ledger tail, last row 228). Reading note for QA: each bullet opens
with the user-observable symptom; the mechanism, code and probe detail that
follows is for developers and can be skipped without losing the behavior.

- ⚠ **Ledger 9** (docs/e2e/app-changes.md §2 row 9) — **re-validated + amendment
  proposed** (probe D item 9): the editing/production "assign a …"/"awaiting …"
  notices key on whether an editing-stage *discussion* exists, not on assignments.
  saveParticipant never recomputes (blank-message assign → stale prompt, as the row
  says); sendMessage/sendNotification recompute AND create the discussion that flips
  the state; deleteParticipant runs the recompute but — the discussion surviving —
  can never flip it (removing the last copyeditor leaves "Awaiting copyedits.";
  probe B independently saw the mirror case after removals). Bonus facts: the notice
  rows are per-assigned-editor, so an unassigned Journal Manager sees no status box;
  and scenario-seeded decisions skip creating the notice rows (processor parity gap,
  non-ledger note). Proposed amendment replaces the draft's "delete/notify DO
  recompute" framing.
- ⚠ **Ledger 73** — **re-validated 2026-07-21** (probe C item 8): the
  NOTIFICATION_TYPE_EDITOR_ASSIGN task notice is dead — sendMessage()'s switch keys
  on the exact template name `EDITOR_ASSIGN`, the picker only offers the 3.4-split
  stage variants (`EDITOR_ASSIGN_SUBMISSION` observed); discussion/email/email-log
  all fired, zero EDITOR_ASSIGN-type notifications exist in the whole test DB. Row
  stands as written; atom NOTIF-editor-assign claimed with this caveat.
- ⚠ **Ledger 74** — **re-validated server-side, reachability corrected; amendment
  proposed** (probe C item 6): the silent flag-discard on re-assign is real
  (firstOr on submission+user+group; direct POST → success response, row untouched),
  but the row's implied UI path does not exist — the picker's already-assigned
  exclusion has no stage condition, so an assigned user is hidden from that role's
  picker on every stage panel. Only a hand-crafted request (or future UI regression)
  reaches the defect. Spec rule 3 / scenario 6 rewritten accordingly.
- ⚠ **Ledger 75** — **re-validated end-to-end 2026-07-21** (probe C item 7): a
  recommend-only Section Editor's add-mode recommend-only checkbox is enabled, and
  saving stamped `recommend_only=1` on a new Section Editor (row note shown).
  Contrast confirmed: the same actor gets no Edit action at all on existing editor
  rows — the edit-side guard manifests as action withholding, not a disabled box.
  Row stands; no wording change needed.
- ⚠ **NEW ledger 229 — Section Editor privilege edits are silently refused
  server-side. CONFIRMED** (probe B item 4; re-confirmed live 2026-07-22, verify
  chunk c §2 with the 3197-vs-91 response-size signature and a manager positive
  control): saveParticipant guards edits with
  Validation::canEditParticipant(), whose stage filter reads
  `$stageAssignment->stageId` — always null (stage_assignments has no stage column)
  — so every non-manager falls through to deny. Live: an assigned deciding Section
  Editor ticked the Permissions box on an Assistant row → HTTP 200 returning the
  re-rendered form (`JSONMessage(true, $form->fetch())`), modal reopens with the box
  reset, no error, no toast, `can_change_metadata` unchanged, no event-log entry.
  The UI meanwhile offers Edit to assigned Section Editors
  (canCurrentUserEditParticipant). (If the filter ever matched, the next line calls
  an undefined accessor and would crash.)
- ⚠ **NEW ledger 230 — Remove is offered wider than Edit, and the server
  deletes ungated. CONFIRMED** (probe B item 5; UI corroborated by probes A item 3
  and C item 7; code re-derived by verify chunks a and c): item actions key Remove on canAdminister alone, so an assigned
  Section Editor sees Remove exactly where Edit is hidden — manager-role rows and
  their own row — and deleteParticipant applies no per-row guard: removing a
  Journal Editor's assignment succeeded (DB row deleted, removal logged), and
  self-removal succeeded too, instantly revoking the actor's own access mid-page.
- ⚠ **NEW ledger 231 — the anonymous-reviewer warning never fires. CONFIRMED
  refutation of the intended rule 7** (probe D item 11; code re-confirmed by
  verify chunk e): the server correctly
  computes the non-declined anonymous reviewer ids into the form, but
  StageParticipantNotifyHandler.js maybeTriggerReviewerWarning() compares the
  radio's string value against integer ids with strict indexOf — never matches, the
  confirmation modal is unreachable, and the assignment saves with no notice. The
  reviewerWarning locale string is orphaned at runtime. One-line type-cast fix.
- ⚠ **NEW ledger 232 (minor) — privilege edits (and no-op re-assigns) are logged
  as assignments. CONFIRMED** (probe B item 15; probe C item 6; re-confirmed live
  2026-07-22 — verify chunk c §4 caught the manager edit writing event_log row
  4643, type SUBMISSION_LOG_ADD_PARTICIPANT): every successful
  save writes SUBMISSION_LOG_ADD_PARTICIPANT — one add + one privilege edit yielded
  two identical "was assigned" entries, and even a nothing-changed forced re-assign
  wrote a third. No edit-specific event type exists. Related but separately owned:
  the entries' `{$userGroupName}` placeholder never resolves (**ledger 14**, owned
  by editorial-activity-log — re-confirmed live: the param key never lands in
  event_log_settings, every add entry shows the literal placeholder).
- ⚠ **NEW ledger 233 (minor) — Journal-manager-group assignments are invisible
  in the Participants panel** (probe B reachability finding; DB re-confirmed by
  verify chunk e — the "Journal manager" group has zero user_group_stage rows): getParticipants
  filters through user\Collector::assignedTo(), which INNER JOINs user_group_stage —
  and the "Journal manager" group has zero stage rows, so its assignments (present
  in the DB) render on no panel. Manager-participant semantics are only reachable
  via manager-role groups with stages (Journal editor, Production editor). Same
  mechanism family as ledger 205 (editorial-dashboards).
- ⚠ **Ledger 8** (owned by copyediting-stage) — **re-confirmed + every-viewer
  extension proposed, live 2026-07-22** (verify chunk e s2-candidate; first
  re-spotted by the s2 test author before being matched to the existing row):
  Accept-and-Skip-Review creates no copyediting status notices for anyone — the
  submission lands on Copyediting showing neither "Assign a copyeditor using the
  Assign link in the Participants list." nor "Awaiting copyedits.", for any
  viewer, the assigned deciding editor included. Distinct from the row-9 family:
  row 9 is about existing notice rows keying on the discussion; here no notice
  rows are created at all — decision\Repository::getSubmissionNotificationTypes()
  switches only on ACCEPT and SEND_TO_PRODUCTION, SKIP_EXTERNAL_REVIEW falls
  through to an empty list. Amendment proposed on row 8, not a new row.
- ⚠ **NEW ledger 234 — an Assistant assigned on the Submission or Review stage is
  locked out by a blocked reviewer-suggestions lookup. CONFIRMED live 2026-07-22**
  (verify chunk e s8-candidate; first hit by the s8 test author, corroborated by
  verify chunk b): opening the workflow there fires
  `GET /api/v1/submissions/{id}/reviewers/suggestions`, which 401s for the
  assistant role and pops a blocking "Error — The current role does not have
  access to this operation." dialog whose aria-modal occludes the entire workflow
  page, Participants panel included — even though the access policy admits the
  assigned assistant. Assistants can only usefully open stages that don't fetch
  reviewer suggestions (Copyediting is clean). Extends ledger 221 (same
  mechanism, seen on Review for an assistant with review-stage access): also
  reproduces on the Submission stage, and the impact is full-page occlusion.
- **Minor, candidate (orchestrator to decide)** — the manager-as-reviewer demotion
  is UI-only: while demoted, the participants REST endpoint still serves the full
  list to the manager (probe A item 2). The UI withholds everything; no current
  ledger row claims this.
- ⚠ **Ledger 135/164** (owned by sections / submission-wizard) — **re-confirmed in
  passing** (probe D item 14): SubEditorsDAO::assignEditors() filters candidates
  with `$userGroups->keys()` (collection indexes, not group ids), so auto-assignment
  works only where group ids happen to fall under the journal's group count — the
  install's first journal. Probe added the positive-control leg via the real submit
  endpoint (publicknowledge: in-group configured editors assigned + mailed;
  configured-but-not-in-group editor skipped by the separate userInGroup check) and
  the scratch-journal negative leg (configured editor silently dropped, fallback
  fired). Addendum proposed on those rows, not a new one.
- **Dead broken SQL / inert code, no user impact**: SubEditorsDAO::deleteEditor() and
  editorExists() reference a nonexistent `section_id` column (and editorExists
  compares assoc_id against the assoc *type*); both have no callers — section/category
  forms rewrite via deleteBySubmissionGroupId() + insertEditor(). Also (verify
  chunk d): UpdateAuthorStageAssignments::handle() looks up the author group with a
  positional-index `$userGroups->get($userGroupId)` — the ledger-135/164 family —
  which returns null for realistic group ids, making the listener a no-op;
  behavior matches rule 5 only because RestrictAuthorAssignment does the real
  reset. And (verify chunk a): AddParticipantForm::execute()'s stage "sanity
  check" is unreachable via the UI (the picker only offers stage-covered groups)
  and would fault on an unset variable if ever tripped. Cleanup candidates, not
  ledger rows.

## Open questions

1. Should the editing/production status notices key on stage assignments rather
   than on the existence of a stage discussion (ledger 9 as amended) — i.e. should
   a silent assignment flip the prompt, and removing the last copyeditor un-flip it?
2. Should add mode enforce the same recommend-only/self-edit guards as edit mode
   (ledger 75), or is an unguarded add accepted behavior?
3. Are Section Editors meant to be able to edit other participants' privileges? The
   UI offers it, the server always silently denies (confirmed live, ledger 229) —
   which side expresses the intent?
4. Should Remove be limited by the same per-row rules as Edit? Confirmed live: a
   Section Editor can remove a Journal Editor's assignment, and their own.
5. Should a privilege edit write a distinct history entry instead of a second "was
   assigned" line (confirmed duplicates, ledger 232)?
6. StageParticipantGridHandler::fetchUserList() appears to have no caller (the add
   form embeds UserSelectGridHandler instead) — dead op to remove?
7. Is the manager-as-reviewer demotion meant to close the participant list at the
   API level too? The UI withholds it, but the REST participants endpoint still
   answers the demoted manager (probe A item 2).

---

<!-- REFERENCE MATERIAL — provenance and campaign bookkeeping, not product-owner
     narrative. -->

## Reference — entry points & surfaces

| Entry | Path | Atom |
|-------|------|------|
| Participants panel (every stage) | Dashboard → submission workflow page → right-hand column; `ParticipantManager` fetches `GET api/v1/submissions/{id}/participants/{stageId}` | VUE-participant-manager |
| Assign / Edit modal (legacy form) | Panel "Assign" / row Edit → `grid.users.stageParticipant.StageParticipantGridHandler` op `addParticipant` (+ `assignmentId` for edit), save via `saveParticipant` | GRID-lib-pkp-grid-users-stage-participant-stage-participant-grid-handler |
| User picker inside the assign modal | `grid.users.userSelect.UserSelectGridHandler` op `fetchGrid` (role filter + name search) | GRID-lib-pkp-grid-users-user-select-user-select-grid-handler |
| Remove | row Remove → confirm dialog → op `deleteParticipant` (POST + CSRF) | GRID-lib-pkp-grid-users-stage-participant-stage-participant-grid-handler |
| Notify | row Notify → op `viewNotify` / `sendNotification`; template body preview via `fetchTemplateBody` | GRID-lib-pkp-grid-users-stage-participant-stage-participant-grid-handler |
| Assignments store | `stage_assignments` (submission × user_group × user; recommend_only, can_change_metadata, date_assigned; stage scope derived from user_group_stage) | DB-stage_assignments |
| Auto-assign config store | `subeditor_submission_group` (context, assoc section/category, user, user_group) | DB-subeditor_submission_group |
| History entries | submission activity log: participant added / removed | EVLOG-SUBM-ADD-PART, EVLOG-SUBM-REM-PART |
| "Editor assigned" task notice (dead) | would surface in the Tasks bell; creator branch unreachable (ledger 73) | NOTIF-editor-assign |

## Reference — code anchors

- lib/pkp/controllers/grid/users/stageParticipant/StageParticipantGridHandler.php —
  grid ops, save/delete side effects, event logging
- lib/pkp/controllers/grid/users/stageParticipant/form/AddParticipantForm.php —
  add/edit form, privilege guards (edit-only), execute branches
- lib/pkp/controllers/grid/users/stageParticipant/form/PKPStageParticipantNotifyForm.php —
  notify flow: discussion + email + template-key switch (dead EDITOR_ASSIGN branch)
- lib/pkp/templates/controllers/grid/users/stageParticipant/addParticipantForm.tpl; form/notify.tpl —
  modal markup; lib/pkp/js/controllers/grid/users/stageParticipant/form/StageParticipantNotifyHandler.js
- lib/pkp/classes/stageAssignment/{StageAssignment,Repository}.php — model (stage scope via
  userGroupStages), build() firstOr
- lib/pkp/classes/security/Validation.php canEditParticipant() — server edit guard (stage-filter defect)
- lib/pkp/classes/notification/managerDelegate/PKPEditingProductionStatusNotificationManager.php —
  editing/production status notices (discussion-keyed EDITING branch, per-assigned-editor rows)
- lib/pkp/classes/user/Collector.php — assignedTo() (panel listing; inner join user_group_stage)
  and buildExcludedSubmissionStagesFilter() (picker exclusion, no stage condition)
- lib/pkp/classes/context/SubEditorsDAO.php assignEditors() — auto-assign; classes/observers/listeners/
  {AssignEditors,RestrictAuthorAssignment,UpdateAuthorStageAssignments}.php
- lib/pkp/classes/submission/maps/Schema.php getPropertyStages(), getAssignmentRoles() —
  per-stage role payload driving all UI affordances
- lib/pkp/api/v1/submissions/PKPSubmissionController.php getParticipants()
- lib/ui-library/src/managers/ParticipantManager/** (store, config, actions);
  lib/ui-library/src/composables/useCurrentUser.js canCurrentUserEditParticipant()
