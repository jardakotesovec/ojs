---
name: editorial-activity-log
scope: The read surface for a submission's editorial audit trail — the per-submission "Activity Log & Notes" history modal (workflow header) and the per-file Information Center (Notes/History) — plus the event-log entity, schema and DB the whole log is written to
shared: pkp-lib          # the event-log grids, the information-center handlers, the EventLogEntry model/DAO/schema and the event_log tables all live in lib/pkp; OJS adds no override (it reuses the shared surface as-is)
status: verified
e2e-plans: [activity-log]
status-verified: 2026-07-04   # adversarial verifier: live-probed the render + permission matrix on port 8000 (test DB)
atlas-claims:
  - GRID-lib-pkp-grid-event-log-submission-event-log-grid-handler
  - GRID-lib-pkp-grid-event-log-submission-file-event-log-grid-handler
  - GRID-lib-pkp-information-center-information-center-handler
  - GRID-lib-pkp-information-center-submission-information-center-handler
  - GRID-lib-pkp-information-center-file-information-center-handler
  - SCHEMA-event-log
  - DB-event_log
  - DB-event_log_settings
---

# Editorial activity log (the event-log surface — Activity Log modal + file Information Center)

## Purpose

Every editorial action a submission accrues — an editor's decision, a reviewer accepting or
declining, a file uploaded or deleted, a participant added, metadata updated, an email sent, a
note posted — is written to an **append-only event log**. This feature is the two places that log
is **read**. From the workflow page's header an editor opens **Activity Log & Notes**: a modal
whose **History** tab lists the whole submission's event history (event-log entries *and* sent
emails, merged, newest first) and whose **Notes** tab lets the editorial team leave internal
notes. From any file's row-menu **More Information** an editor (or a production assistant) opens
that **file's Information Center**: the same Notes/History pair scoped to one file. This spec owns
the **surface** — the two event-log grids, the three information-center handlers, the `eventLog`
schema, the `event_log` table, the log-entry **render** (format, params, ordering, anonymization)
and the **note-adding** UI. It does **not** own the individual events' *meaning* or *when they
fire*: each event type is fired and owned by the feature that performs the action (editorial
decisions, reviewer management, submission files, tasks/discussions, stage participants,
publication versioning), and the sent-email entries are owned by email-delivery. Those features
**co-claim** their event atoms; this feature is the reader they all render into.

## Actors & permissions

Recurring terms: **editorial roles** = journal **manager** (MANAGER), **section editor**
(SUB_EDITOR) and **site admin** (SITE_ADMIN); **assistant** = copyeditor / layout editor /
proofreader (ASSISTANT). **Assigned to the active stage** = the user holds that role as a *stage
assignment* on the submission's current stage. Two site-wide baselines apply below: (i) the
**workflow header** "Activity Log" button is offered strictly on *active-stage* editorial
assignments — an unassigned manager browsing a submission sees **no** button; (ii) the **backend**
grid + submission-information-center handler are slightly more permissive — a manager/site-admin
with **no** stage assignment still passes (global-role fallback), so they can reach the modal by
direct navigation even without the button (a minor divergence, Known deviations). Authors and
reviewers never reach either surface through these handlers. Verified live on `publicknowledge`
(2026-07-04, seeded in-review submission): editor **dbarnes** saw the button and the full History;
author **atester** saw **no** Activity Log button (button count 0). <sup>a</sup>

| Action | Who may — and when |
|--------|--------------------|
| **Open the submission Activity Log** (workflow header → "Activity Log & Notes" modal) | • Editorial roles **assigned to the active stage** — the header button renders only under this rule<br>• An unassigned manager / site admin — **no button**, but the backend still admits them if they navigate directly ⚠ <sup>b</sup> |
| **View the submission History tab** (the event-log grid) | • The same active-stage editorial roles; the grid additionally requires an *accessible editorial workflow stage*. Assistants, authors and reviewers are refused<br>• The History tab is **hidden entirely** from anyone lacking a manager/section-editor role on the context <sup>c</sup> |
| **Post / read Notes on the submission** (Notes tab) | • Editorial roles that can open the modal — the Notes tab shows for every role admitted to the modal, even when the History tab is hidden <sup>d</sup> |
| **Open a file's Information Center** (file row → More Information → Notes/History) | • Editorial roles **and assistants** — gated by workflow-stage access on the file's stage plus file-read access; this is the one log surface an assistant reaches <sup>e</sup> |
| **View a file's History tab** (the file event-log grid) | • Editorial roles only — the file event-log grid inherits the manager/section-editor/site-admin gate, so an **assistant** who opens the file Information Center sees the History tab offered but its grid **denies** them ⚠ (Known deviations). Confirmed live 2026-07-04: copyeditor **mfritz**'s `SubmissionFileEventLogGridHandler::fetchGrid` returned *"The current role does not have access to this operation."* while dbarnes's rendered <sup>f</sup> |
| **Post / read Notes on a file** (file Notes tab) | • Editorial roles and assistants; a file promoted from an earlier stage also shows its **source file's** notes read-only ("past notes") <sup>g</sup> |
| **Delete a note** | • Any user who can open that Notes tab — deletion is guarded by a CSRF token and a check that the note belongs to *this* submission/file, **not** by note authorship, so any admitted editor can remove any note (by design — shared editorial notes) <sup>h</sup> |
| **Expand a sent-email entry** ("View email") | • Anyone who can see the History grid — each email row expands to show the email's From/To/Cc/Subject and sanitized body <sup>i</sup> |
| **Download a file version from a log row** | • Anyone who can see the History grid — file-upload / revision rows carry a Download link to that file version (suppressed for reviewer-attachment files shown to an editor-author) <sup>j</sup> |

<sup>a</sup> useWorkflowPermissions.js `canAccessEditorialHistory`; SubmissionInformationCenterHandler::authorize() (`_isCurrentUserAssignedEditor`); SubmissionEventLogGridHandler::authorize() (`UserAccessibleWorkflowStageRequiredPolicy(WORKFLOW_TYPE_EDITORIAL)` + role assignment); live probe 2026-07-04 — dbarnes button present + grid renders; atester button absent **and** the submission event-log grid `fetchGrid` refused them (*"The current role does not have access to this operation."*) ·
<sup>b</sup> workflowConfigEditorialOJS.js `getHeaderItems` (`if (permissions.canAccessEditorialHistory)` → `WORKFLOW_VIEW_ACTIVITY_LOG`); useWorkflowActions.js `workflowViewActivityLog` (`informationCenter.SubmissionInformationCenterHandler::viewInformationCenter`); useWorkflowPermissions.js (active-stage `currentUserAssignedRoles` ∩ [MANAGER, SITE_ADMIN, SUB_EDITOR]); SubmissionInformationCenterHandler::authorize() else-branch (global MANAGER/SITE_ADMIN) ·
<sup>c</sup> SubmissionEventLogGridHandler::__construct (`addRoleAssignment([MANAGER, SITE_ADMIN, SUB_EDITOR], ['fetchGrid','fetchRow','viewEmail'])`); SubmissionInformationCenterHandler::viewInformationCenter (`removeHistoryTab = !$userHasRole || !$_isCurrentUserAssignedEditor`, `$userHasRole` = MANAGER/SUB_EDITOR on the context) ·
<sup>d</sup> InformationCenterHandler::__construct (`viewNotes`/`saveNote`/`deleteNote` for MANAGER/SITE_ADMIN/SUB_EDITOR); informationCenter.tpl (Notes tab always rendered) ·
<sup>e</sup> FileInformationCenterHandler::__construct (adds ROLE_ID_ASSISTANT); ::authorize() (`WorkflowStageAccessPolicy`); useFileManagerActions.js `fileSeeNotes` (`informationCenter.FileInformationCenterHandler::viewInformationCenter`) ·
<sup>f</sup> SubmissionFileEventLogGridHandler extends SubmissionEventLogGridHandler (inherits the MANAGER/SITE_ADMIN/SUB_EDITOR `fetchGrid` role assignment — no ASSISTANT) yet its own `getFilterForm()` intersects ASSISTANT (internal inconsistency); FileInformationCenterHandler::viewInformationCenter passes `removeHistoryTab` only from the request var, and useFileManagerActions.js `fileSeeNotes` never sets it → History tab shown; live 2026-07-04 (mfritz `fetchGrid` → "The current role does not have access to this operation.") ·
<sup>g</sup> FileInformationCenterHandler::_listPastNotes (`sourceSubmissionFileId` notes, `notesDeletable=false`) ·
<sup>h</sup> InformationCenterHandler::deleteNote (`checkCSRF()` + `assocType`/`assocId` match; no author check) ·
<sup>i</sup> EventLogGridRow::initialize (`EmailLinkAction`); SubmissionEventLogGridHandler::viewEmail/_formatEmail (`PKPString::stripUnsafeHtml`) ·
<sup>j</sup> EventLogGridRow::initialize (`DownloadFileLinkAction` on `SUBMISSION_LOG_FILE_UPLOAD`/`_REVISION_UPLOAD`; suppressed when `_isCurrentUserAssignedAuthor` and the file is a review attachment)

## Fields & validation

The only thing a user *enters* on this surface is a **note**. Everything else is read-only history.

| Field (UI label) | Required? | Rules | Anchor |
|------------------|-----------|-------|--------|
| **Note** (the "Add a note" text box) | Enforced by the UI, not the form | Free rich text; stored verbatim as the note's contents. Single-language (not multilingual). No server-side length limit or non-empty check — the form validates only a POST method + CSRF token, so the required-ness is a UI affordance | NewNoteForm::readInputData (`newNote`); ::execute (`Note::create(['contents' => …])`); FormValidatorPost + FormValidatorCSRF (no length/required check) |

A saved note is one `notes` row carrying the poster's `userId`, the `assocType`/`assocId` (the
submission or the file) and the `contents`. The `notes` table itself is owned by
`tasks-discussions`; this feature owns only the information-center note-adding UI that writes into
it. Every log entry the History tab shows is server-written and has **no** user-facing form —
its fields are the `eventLog` schema below.

## Rules & state

The event log is one entity read through two grids; the assoc-type of an entry decides which grid
shows it. Assoc types (`PKPApplication::ASSOC_TYPE_*`): **submission** = `0x0100009` (1048585),
**submission file** = `0x0000203` (515), **query/task** = `0x010000a` (1048586). <sup>a</sup>

### 1. The Activity Log is reached from the workflow header; it is a legacy modal, not a Vue panel

On the editorial workflow page the header action bar renders an **Activity Log** button whenever
`canAccessEditorialHistory` holds (rule 6). Clicking it opens a **side modal titled "Activity Log
& Notes"** that loads the legacy `SubmissionInformationCenterHandler::viewInformationCenter`
component over AJAX — a jQuery-UI **TabHandler** with two tabs, **History** then **Notes**, default
tab index 0 (History when present). The Vue app only *launches* this modal (`useWorkflowActions`
`workflowViewActivityLog` → `useLegacyGridUrl`); all its content is legacy-grid HTML. Verified live
2026-07-04 (dbarnes: the modal opened with both tabs, History active). <sup>b</sup>

### 2. The submission History tab merges the event log with the email log, newest first

The History tab loads `SubmissionEventLogGridHandler`, a three-column grid — **Date · User ·
Event**. Its data is the **union** of two sources for that submission: the **event-log** entries
(`event_log` rows with `assoc_type` = submission) *and* the **email-log** entries (sent-email
records with `assoc_type` = submission), merged into one list and **sorted by date descending**
(`usort` on `dateLogged`/`dateSent`). So a reader sees decisions, reviewer moves, file events,
participant changes, metadata updates, posted notes and **every email the submission sent**
interleaved in one reverse-chronological stream. Each **email** row is expandable ("View email")
to reveal its From/To/Cc/Bcc/Subject and sanitized body; each **file-upload / revision** row
carries a Download link to that file version. Verified live 2026-07-04 (dbarnes, fresh
scenario-seeded in-review submission on port 8000): the History grid rendered "Submission metadata
updated", **"Article submitted"**, "…sent this submission to the review stage", "Julie Janssen has
been assigned to review…", and email rows "An email has been sent: …", all dated newest-first.

**On the submitted event.** The "**Article submitted**" row is the `SUBMISSION_LOG_SUBMISSION_SUBMIT`
event written by `LogSubmissionSubmitted` when `Repo::submission()->submit()` fires `SubmissionSubmitted`
— the wizard's final Submit step **and** the scenario-API seed path both call `submit()`, so both
produce this row; only a submission never actually submitted (a draft, e.g. scenario `submitted:false`)
lacks it. The message key is `submission.event.submissionSubmitted`, which **OJS overrides** to
"Article submitted" (`locale/en/locale.po`); the pkp-lib default is "Initial submission completed."
so an OMP/OPS reader sees that wording. (Verified in the test DB: every one of the 104 seeded
submissions that reached external review carried this row, and a fresh seed rendered it live.)

**Seeding caveat (not a product bug).** On a *scenario-seeded* submission the merged email rows can
show a raw `{$contextName}` in the subject (e.g. "Thank you for your submission to {$contextName}").
This is a **seeding artifact**: seeding sends those system emails under `Mail::fake()`, and
`Repository::logMailable()` compiles the logged subject against the mailable's `viewData`
(`Mail::compileParams`), which on the seed path does not carry `contextName`. Real (non-faked) sends
substitute it — the same log's UI-driven rows read "…for Journal of Public Knowledge". Do **not**
read `{$contextName}` as a render bug (contrast the genuine `{$userGroupName}` leak in Known
deviations, which *does* affect real UI assignments). <sup>c</sup>

### 3. Each log row is rendered by translating a locale-key message with the entry's own fields as params

An event-log entry stores a **message** that is normally a **locale key**
(`submission.event.fileUploaded`, `editor.submission.decision.accept.log`,
`log.review.reviewerAssigned`, …) plus an `isTranslated` flag. The Event column renders
`getTranslatedMessage()`: if `isTranslated` is true the message is a literal string shown as-is;
otherwise the key is translated **with the entry's own data supplied as the substitution params**
(so `{$reviewerName}`, `{$round}`, `{$decision}`, `{$filename}` etc. are filled from the row's
columns). The **Date** column is formatted with the context's short date format; the **User**
column shows the acting user's full name. The entry's full param set is the `eventLog` schema
(rule 5). <sup>d</sup>

### 4. Reviewer identities are anonymized when an editor is also an author on the submission

The grid protects blind review from a **dual-role editor-author**. `SubmissionEventLogGridHandler`
computes `_isCurrentUserAssignedAuthor` (the viewer holds an author assignment on the submission,
even if also an editor) and, when true, the cell provider **masks reviewer names** on
review-accept / -decline / -unconsidered entries and on reviewer-attachment file entries to
"Anonymous Reviewer" — **unless** the review is **open** method (open reviews reveal the name).
The same masking runs in `EventLogEntry::getTranslatedMessage($locale, $hideReviewerName=true)` for
the message text. Non-author editors see the real names. <sup>e</sup>

### 5. The event-log entity: fixed columns + an open settings bag (the `eventLog` schema)

An `event_log` row has fixed columns — `log_id`, `assoc_type`, `assoc_id`, `user_id` (nullable —
NULL for system/automated events), `date_logged`, `event_type` (one of the `SUBMISSION_LOG_*`
constants), `message` (locale key or literal) and `is_translated` — plus an **`event_log_settings`**
key/value bag holding all the event-specific params. The `eventLog` **schema** (`schemas/eventLog.json`,
~42 properties) is the superset of those params across every event kind: decision fields
(`decision`, `editorName`), review fields (`reviewerName`, `reviewAssignmentId`, `round`,
`reviewDueDate`), file fields (`fileId`, `filename`, `fileStage`, `submissionFileId`,
`sourceSubmissionFileId`), task fields (`taskType`, `taskDateDueOld/New`, `taskOwnerOld/New…`,
`taskParticipantsModified…`), participant/user fields (`userFullName`, `username`, `userGroupNames`),
copyright (`copyrightNotice`) and email fields (`recipientName`, `senderName`, `subject`). A
`settings_name_value` index on (`fileId`, `submissionId`) supports the file-history lookups. This
schema is **read-only in the API sense** (`dateLogged` is `writeDisabledInApi`); entries are created
only by the firing features, never through a public write endpoint. <sup>f</sup>

### 6. Who sees the Activity Log — the `canAccessEditorialHistory` rule (this feature owns it)

The workflow header button and the History tab are gated by **`canAccessEditorialHistory`**: the
viewer holds **manager, section-editor or site-admin** among their **active-stage** assigned roles.
This is the rule the copyediting-stage and author-dashboard specs deferred here. Consequences,
all verified against the handlers: **authors** never qualify (no editorial role) → no button, and
the grid refuses them; **assistants** (copyeditor/layout/proofreader) never qualify for the
*submission* Activity Log either → they have no header button and the submission event-log grid
denies them (they reach only the *file* Information Center, rule 7); **reviewers** never reach the
workflow page's editorial view at all. The backend enforces the same editorial set on the grid
(`fetchGrid`) and the info-center handler, with the unassigned-manager fallback of the permission
baseline. Additionally the History tab is stripped (`removeHistoryTab`) if the viewer lacks a
manager/section-editor role on the *context*, leaving them the Notes tab only. <sup>g</sup>

### 7. The file Information Center: the same Notes/History pair scoped to one file — and open to assistants

A file's row-menu **More Information** opens `FileInformationCenterHandler::viewInformationCenter`
(the file's Information Center modal), with the same **History** + **Notes** tabs. Two differences
from the submission modal: (i) it is **also open to assistants** (the handler adds ROLE_ID_ASSISTANT
and gates on workflow-stage + file-read access), so a copyeditor can read/annotate a copyedit file's
history; and (ii) the History tab loads `SubmissionFileEventLogGridHandler`, which filters the event
log to that **file's** `assoc_id` (assoc-type submission-file) — so it shows only *that file's*
events (upload, revision, metadata edit, delete, note posted). The file grid also offers an editor-only
**"all events" filter** toggle. The Notes tab additionally shows the file's **source file's** notes
read-only when the file was promoted from an earlier stage. <sup>h</sup>

### 8. Adding a note writes a note **and** a "note posted" event

Posting a note (submission or file) does two things: it inserts the `notes` row (rule: Fields), and
it **writes a `SUBMISSION_LOG_NOTE_POSTED` event** (message `informationCenter.history.notePosted`,
assoc'd to the submission or file) so the note itself appears in the History tab, and it raises a
trivial "Note added" success notification for the poster. Deleting a note raises a "Note removed"
notification but writes **no** event. Verified live 2026-07-04: posting a note on the seeded
submission created one `notes` row **and** an `event_log` row `event_type` 16777216 message
`informationCenter.history.notePosted` assoc'd to the submission. <sup>i</sup>

### 9. Task/discussion events live on a *different* assoc and do **not** appear in the submission Activity Log

Editorial-task and discussion events (`submission.event.task.*` — created, started, closed, note
posted, participants changed, due-date modified) are logged against **assoc-type query/task**
(1048586), **not** the submission. Because both event-log grids filter strictly by assoc
(submission → `assoc_type` 1048585; file → 515), these task events surface only in the **task's own
history** (owned by `tasks-discussions`), **never** in the submission Activity Log or the file
Information Center. So the Activity Log is the *editorial-workflow* history, not a firehose of every
logged event. Verified live 2026-07-04 (the seeded submission's task events sat at `assoc_type`
1048586, absent from the submission-assoc history query). <sup>j</sup>

### 10. Ordering & filtering

Both grids order by **`date_logged` descending** (the collector `orderBy('date_logged','desc')`;
the submission grid re-sorts after merging emails). There is no paging control in the modal — the
grid loads the full history. The file grid exposes an editor-only filter form with a single
**"Show all events"** checkbox (`allEvents`); the submission grid has no filter. <sup>k</sup>

<sup>a</sup> PKPApplication ASSOC_TYPE_SUBMISSION / _SUBMISSION_FILE / _QUERY ·
<sup>b</sup> workflowConfigEditorialOJS.js `getHeaderItems`; useWorkflowActions.js `workflowViewActivityLog`; informationCenter.tpl (TabHandler, History+Notes); InformationCenterHandler::setupTemplate (`selectedTabIndex`); ActivityLogModal.js POM; live 2026-07-04 ·
<sup>c</sup> SubmissionEventLogGridHandler::loadData (`Repo::eventLog()->getCollector()->filterByAssoc(ASSOC_TYPE_SUBMISSION,…)` merged with `EmailLogEntry::withAssocId(…)`, `usort` by date desc — no event-type filter, so the submit event renders); ::initialize (Date/User/Event columns); EventLogGridRow (Email/Download link actions); LogSubmissionSubmitted::handle (`SUBMISSION_LOG_SUBMISSION_SUBMIT`, `submission.event.submissionSubmitted`, `isTranslated=false`); Submission\Repository::submit (fires `SubmissionSubmitted`); OJS override `locale/en/locale.po` (`submission.event.submissionSubmitted` = "Article submitted") vs pkp-lib `submission.po` ("Initial submission completed."); Log\Repository::logMailable (`Mail::compileParams($subject, $viewData)` — `{$contextName}` unbound on the `Mail::fake()` seed path); live 2026-07-04 (dbarnes rendered "Article submitted" + "Submission metadata updated" + raw `{$userGroupName}` + `{$contextName}` email rows on seeded sub) ·
<sup>d</sup> EventLogEntry::getTranslatedMessage (`isTranslated` short-circuit; `__($message, $params, $locale)` with the entry's own data); EventLogGridCellProvider::getTemplateVarsFromRowColumn (date/user/event); DateGridCellProvider (`getLocalizedDateFormatShort`) ·
<sup>e</sup> SubmissionEventLogGridHandler::authorize (`_isCurrentUserAssignedAuthor`); EventLogGridCellProvider (`$reviewerLogTypes`, `SUBMISSION_FILE_REVIEW_ATTACHMENT`, open-method exception); EventLogEntry::getTranslatedMessage (`$hideReviewerName`) ·
<sup>f</sup> LogMigration.php (`event_log` + `event_log_settings`, `settings_name_value` index on fileId/submissionId); schemas/eventLog.json (~42 props; `dateLogged.writeDisabledInApi`); EventLogEntry (`SUBMISSION_LOG_NOTE_POSTED`/`_MESSAGE_SENT` constants) ·
<sup>g</sup> useWorkflowPermissions.js `canAccessEditorialHistory` (active-stage ∩ [MANAGER, SITE_ADMIN, SUB_EDITOR]); SubmissionEventLogGridHandler::__construct + ::authorize; SubmissionInformationCenterHandler::authorize + ::viewInformationCenter (`removeHistoryTab`) ·
<sup>h</sup> FileInformationCenterHandler::__construct (ROLE_ID_ASSISTANT) + ::authorize (`WorkflowStageAccessPolicy`) + ::viewHistory (`SubmissionFileEventLogGridHandler::fetchGrid`); SubmissionFileEventLogGridHandler::loadData (`filterByAssoc(ASSOC_TYPE_SUBMISSION_FILE,…)`) + ::getFilterForm/getFilterSelectionData; FileInformationCenterHandler::_listPastNotes ·
<sup>i</sup> SubmissionInformationCenterHandler::saveNote + InformationCenterHandler::_logEvent (`SUBMISSION_LOG_NOTE_POSTED`, `informationCenter.history.notePosted`); ::deleteNote (notification, no event); live 2026-07-04 (notes row + event_log 16777216) ·
<sup>j</sup> event-log write sites for `submission.event.task.*` assoc'd to ASSOC_TYPE_QUERY (owned by tasks-discussions); both grids' `filterByAssoc`; live 2026-07-04 (task events at assoc_type 1048586) ·
<sup>k</sup> Collector::getQueryBuilder (`orderBy('date_logged','desc')`); SubmissionEventLogGridHandler::loadData `usort`; SubmissionFileEventLogGridHandler::getFilterForm (`allEvents`)

## Side effects

- **Adding a note** writes a `notes` row *and* a `SUBMISSION_LOG_NOTE_POSTED` event-log entry
  (rule 8) *and* a trivial "Note added" in-app notification to the poster. **Deleting a note**
  writes a trivial "Note removed" notification and no event-log entry.
- **Viewing** anything on this surface is read-only — opening the modal, switching tabs, expanding
  an email or downloading a file version mutates nothing.
- **No emails** are sent by this surface; the History tab merely *renders* the email-log entries
  that other features created.
- **Every other event row** on the History tab is a side effect of some *other* feature's action
  (a decision, a reviewer move, a file upload, a participant change) — those writes are owned by
  the firing feature, not here.

## Settings that modify behavior

- **None specific to this surface.** There is no journal/site setting or `config.inc.php` variable
  that turns the Activity Log on/off, changes its columns, or filters which events it shows.
- **Review method** (per review assignment) indirectly changes the *render*: open reviews reveal a
  reviewer's name to an editor-author, anonymous/double-anonymous mask it (rule 4). That setting is
  owned by `assign-and-manage-reviewers` / `review-anonymity`; this surface only consumes it.
- **Context short date format** formats the Date column (owned by journal setup).

## Cross-feature interactions

This surface renders events fired and owned by many features. **This spec owns the log surface;
each firing feature co-claims its own `EVLOG-*` atoms.** Pointers to the event owners:

- **editorial-decisions** — `EVLOG-SUBM-ED-*` (decision recorded, recommendation, decision email
  sent); the decision `.log` messages render here.
- **assign-and-manage-reviewers / reviewer-response** — `EVLOG-REV-*` (assigned, accepted,
  declined, reinstated, unconsidered, completed…); these are the entries anonymized in rule 4.
- **submission-files** — `EVLOG-FILE-*` (upload, revision, edit, delete). **Note the row-85 gap**:
  submission-files' `Repository::edit()` writes the *file*-assoc `FILE_EDIT` event but drops the
  paired *submission*-assoc event, so a file-metadata edit shows in the **file** Information Center
  History but **not** the submission Activity Log (Known deviations).
- **stage-participants** — `EVLOG-SUBM-ADD/REM-PART` (participant added/removed) — the row whose
  render currently leaks a literal `{$userGroupName}` (Known deviations).
- **tasks-discussions** — `EVLOG-TASK-*` and the `notes` / `submission_comments` tables. The task
  events are assoc'd to the query/task, so they render in the **task's** history, not here (rule 9);
  the `notes` table this surface writes notes into is owned there.
- **publication-versioning / publication-metadata-references** — `EVLOG-SUBM-META-*`,
  `EVLOG-SUBM-VER-CRT` (metadata updated/published/unpublished, version created).
- **submission-wizard** — `EVLOG-SUBM-SUBMIT`, `EVLOG-SUBM-COPY-AGR` (submitted, copyright agreed).
- **email-delivery** — the sent-email entries (the `email_log` and the `EVLOG-EMAIL-*` corpus) that
  the History tab merges in and the "View email" expander renders; `email_log` is owned there.
- **workflow-stage-navigation** — owns the stage-assignment model `canAccessEditorialHistory` reads.

## Canonical scenarios

1. **Editor reads the submission Activity Log** — on a submission with a review history, an editor
   clicks **Activity Log** in the workflow header; the "Activity Log & Notes" modal opens on the
   **History** tab showing Date/User/Event rows newest-first — decisions, the reviewer assignment,
   file revisions, metadata updates and sent-email rows interleaved — and an email row expands to
   its body via "View email" (verified live 2026-07-04).
2. **The file Information Center tabs** — from a file's row menu an editor (or a copyeditor on a
   copyedit file) opens **More Information**; the file's Information Center shows a **Notes** tab
   (with the source file's notes read-only if the file was promoted) and a **History** tab listing
   only *that file's* events (upload, revision, edit, delete).
3. **Permission boundary — who can't see it** — an author on their own submission has **no**
   Activity Log button and is refused the event-log grid; an assistant has no *submission* Activity
   Log button either (they reach only the file Information Center); a reviewer never reaches the
   editorial workflow view (verified live 2026-07-04: atester's button count 0).
4. **Add an internal note** — an editor opens the Notes tab, types a note and saves; the note
   appears in the list, a "Note added" confirmation shows, and the note is itself logged as a
   "note posted" entry in the History tab (verified live 2026-07-04: a `notes` row + a
   `notePosted` event were written).
5. **The missing file-metadata edit (row-85)** — an editor edits a file's metadata (a rename),
   then opens both logs: the edit appears in that **file's** Information Center History but is
   **absent** from the submission Activity Log — the surface faithfully reflects the submission-level
   event that `submission-files` never persisted (Known deviations; confirmed at the DB layer —
   `assoc_type` 515 carries the `fileEdited` rows, `assoc_type` 1048585 carries none).

## Known deviations (as-built ≠ intent)

- ⚠ **File-metadata edits are missing from the submission Activity Log** (surfaced here, caused
  upstream). `submission-files`' `Repository::edit()` persists the *file*-assoc `SUBMISSION_LOG_FILE_EDIT`
  but builds-and-drops the paired *submission*-assoc entry (and it carries an `isTranslate` typo),
  unlike the upload/delete paths which persist both. Net effect on **this** surface: the submission
  History tab shows file uploads and deletions but never a metadata edit — that edit is visible only
  in the file's Information Center History. `docs/e2e/app-changes.md` **row 85** (confirmed at the DB
  layer here: `assoc_type` 515 holds `fileEdited` rows, submission `assoc_type` 1048585 holds none).
- ⚠ **"Participant added" rows render a literal `{$userGroupName}`.** The History tab shows lines
  like *"Daniel Barnes (dbarnes) was assigned to this submission as a {$userGroupName}."* — the
  writer/schema use `userGroupNames` (plural) but the `submission.event.participantAdded` locale key
  expects singular `userGroupName`, so the param is dropped and the placeholder renders raw.
  Observed live in the History grid 2026-07-04; already tracked as `docs/e2e/app-changes.md` **row
  14** (owned by stage-participants; this surface is where it's *seen*).
- ⚠ **The header button and the backend gate diverge for unassigned managers.** The workflow header
  offers the Activity Log only on *active-stage* editorial assignments (`canAccessEditorialHistory`
  reads the active stage's `currentUserAssignedRoles`, i.e. real stage assignments), but the grid +
  submission info-center handler also admit an *unassigned* global manager/site-admin (the
  `authorize()` else-branch checks global MANAGER/SITE_ADMIN roles; the accessible-stages computation
  is role-level) — so such a user has **no** button yet can open the modal by direct component
  navigation. Read-only, low severity, no data exposure beyond what a manager may already reach; same
  affordance-vs-backend family as ledger row 53. `docs/e2e/app-changes.md` **row 86** (verifier
  2026-07-04; button gating live-confirmed for dbarnes/atester/mfritz/jjanssen, the unassigned-manager
  admit code-traced).
- ⚠ **An assistant is offered a file History tab whose grid then denies them.** `FileInformationCenterHandler`
  admits ROLE_ID_ASSISTANT to the file Information Center and never sets `removeHistoryTab` (the Vue
  `fileSeeNotes` path passes only file/submission/stage), so a copyeditor/layout-editor/proofreader
  sees the **History** tab — but its grid `SubmissionFileEventLogGridHandler` inherits
  `SubmissionEventLogGridHandler`'s manager/section-editor/site-admin `fetchGrid` role gate (no
  ASSISTANT), so the tab loads *"The current role does not have access to this operation."* Internally
  inconsistent: the same grid's `getFilterForm()` explicitly anticipates ASSISTANT, yet the fetch gate
  excludes it. Broken affordance, no data loss (the safe direction — history is withheld).
  `docs/e2e/app-changes.md` **row 87** (verifier 2026-07-04, live-probed: mfritz `fetchGrid` denied,
  dbarnes rendered).

## Open questions

1. **Assistant + file History tab — intent only** (as-built now confirmed & ledgered, Known deviations
   / row 87). The verifier reached a copyeditor (mfritz) live and confirmed the History tab **is**
   offered but its grid denies with *"The current role does not have access to this operation."* The
   remaining question is intent: is it deliberate that an assistant sees file *notes* but not file
   *history* (in which case the tab should simply not be offered), or should the grid admit assistants
   (as its own `getFilterForm` already anticipates)?
2. **The vestigial "notify" tab** (confirmed dead). `InformationCenterHandler::setupTemplate` still
   maps a `tab=notify` keyword to tab index 1 and `tab=history` to index 2, but the rendered
   `informationCenter.tpl` has only History (0) and Notes (1) — verified live the modal's tab strip is
   exactly `["History","Notes"]` with History active by default (index 0). So `tab=history`→2 selects
   nothing valid and `tab=notify`→1 lands on Notes; the "notify" path is unreachable. Dead legacy (a
   removed third tab whose email function is now the inline "View email" rows); recommend dropping the
   keyword mapping. Not a ⚠ — harmless dead code, no user-facing effect.
3. **No non-empty check on notes.** A note can be posted with empty contents (`NewNoteForm` validates
   only POST + CSRF — no length/required rule). Intended, or should the "Add a note" box be required
   server-side?

---

## Reference — entry points & surfaces

| Entry | Path | Atom |
|-------|------|------|
| Submission Activity Log (modal) | Workflow header → **Activity Log** → `informationCenter.SubmissionInformationCenterHandler::viewInformationCenter` (History tab → `grid.eventLog.SubmissionEventLogGridHandler::fetchGrid`; Notes tab → `viewNotes`/`saveNote`/`deleteNote`) | GRID-lib-pkp-information-center-submission-information-center-handler, GRID-lib-pkp-grid-event-log-submission-event-log-grid-handler |
| File Information Center (modal) | File row → **More Information** → `informationCenter.FileInformationCenterHandler::viewInformationCenter` (History tab → `grid.eventLog.SubmissionFileEventLogGridHandler::fetchGrid`; Notes tab) | GRID-lib-pkp-information-center-file-information-center-handler, GRID-lib-pkp-grid-event-log-submission-file-event-log-grid-handler |
| Information-center base handler | `informationCenter.InformationCenterHandler` (shared `viewNotes`/`saveNote`/`deleteNote`/`_logEvent`) | GRID-lib-pkp-information-center-information-center-handler |
| Event-log entity / schema | `event_log` (+ `event_log_settings`); `schemas/eventLog.json` (~42 props) | DB-event_log, DB-event_log_settings, SCHEMA-event-log |
| View a sent email | History email row → "View email" → `SubmissionEventLogGridHandler::viewEmail` (`_formatEmail`) | *(part of the submission event-log grid)* |
| The `EVLOG-*` corpus rendered here | `SUBMISSION_LOG_*` event types (~36) — **co-claimed** by their firing features (editorial-decisions, review specs, submission-files, stage-participants, publication-versioning, submission-wizard, email-delivery); not re-owned here | *(see event-log.md; co-claimed)* |

## Reference — code anchors

- **Event-log grids**: `lib/pkp/controllers/grid/eventLog/` — `SubmissionEventLogGridHandler.php`
  (authorize gate, `initialize` columns, `loadData` event+email merge & date-desc sort, `viewEmail`/
  `_formatEmail`), `SubmissionFileEventLogGridHandler.php` (file-assoc filter, `getFilterForm`/
  `getFilterSelectionData` `allEvents`), `EventLogGridCellProvider.php` (date/user/event render +
  reviewer anonymization), `EventLogGridRow.php` (Download + View-email link actions),
  `linkAction/EmailLinkAction.php`.
- **Information-center handlers**: `lib/pkp/controllers/informationCenter/` —
  `InformationCenterHandler.php` (base: `viewInformationCenter`, `deleteNote`, `_listNotes`,
  `_logEvent`, `setupTemplate` tabs), `SubmissionInformationCenterHandler.php`
  (`_isCurrentUserAssignedEditor` gate, `viewHistory`, `saveNote`, `removeHistoryTab`),
  `FileInformationCenterHandler.php` (ASSISTANT role, `WorkflowStageAccessPolicy`, `viewHistory` →
  file grid, `_listPastNotes`); forms `NewNoteForm.php` / `NewSubmissionNoteForm.php` /
  `NewFileNoteForm.php`.
- **Templates**: `lib/pkp/templates/controllers/informationCenter/` — `informationCenter.tpl`
  (TabHandler, History+Notes), `submissionHistory.tpl` (loads the submission event-log grid),
  `notesList.tpl` / `newNoteForm.tpl`.
- **Entity / model / schema / DB**: `lib/pkp/classes/log/event/` — `EventLogEntry.php`
  (`getTranslatedMessage` params + reviewer masking, `SUBMISSION_LOG_NOTE_POSTED`/`_MESSAGE_SENT`),
  `PKPSubmissionEventLogEntry.php` / `SubmissionFileEventLogEntry.php` (the `SUBMISSION_LOG_*`
  constants), `Collector.php` (`filterByAssoc`, `orderBy date_logged desc`), `DAO.php`,
  `Repository.php`, `maps/Schema.php`; `schemas/eventLog.json`;
  `lib/pkp/classes/migration/install/LogMigration.php` (`event_log` + `event_log_settings`).
- **Vue launch + permission**: `lib/ui-library/src/pages/workflow/composables/useWorkflowActions.js`
  (`workflowViewActivityLog`), `.../useWorkflowConfig/workflowConfigEditorialOJS.js` (`getHeaderItems`
  Activity Log button), `.../useWorkflowPermissions.js` (`canAccessEditorialHistory`);
  `lib/ui-library/src/managers/FileManager/useFileManagerActions.js` (`fileSeeNotes`).
- **Test POM**: `lib/pkp/playwright/pages/ActivityLogModal.js`; e2e plan `docs/e2e/plans/activity-log.md`.
