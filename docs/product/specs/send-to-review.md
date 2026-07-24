---
name: send-to-review
scope: The pre-review (Submission-stage) workspace — where the editorial team takes stock of the incoming files, tidies the package, and hands the submission into review, into copyediting, or out at the desk
shared: no
status: verified
atlas-claims:
  - SCHEMA-submission-ojs
---

# Send to review (the Submission-stage workspace)

## Purpose

Every new submission lands on the **Submission** stage — the first entry in the
workflow menu — and waits there for an editor's verdict. This spec covers that
pre-review workspace as the editorial team sees it: the **Submission Files** panel
holding what the author uploaded (and anything staff add), the working panels
around it (participants, tasks & discussions, reviewer suggestions), and the
stage's three exits — send the submission into peer review, accept it straight
into copyediting, or decline it at the desk. The exits themselves are editorial
decisions; their wizards, emails and stage moves are defined once in
*editorial-decisions* and only referenced here. What this spec owns is the room
the decision is made in: what an editor can see and do with the incoming package
before the submission moves on.

## Actors & permissions

Terms: *assigned* = holds a stage assignment on this submission in a role whose
group covers the Submission stage (a single assignment opens every stage its role
group covers — see *stage-participants*). Baselines: **Journal Manager and Site
Administrator** need no assignment — an unassigned manager gets the full workspace
on any submission in the journal, except while personally reviewing it (the
reviewer demotion, owned by *stage-participants*); **Authors** never see this
editorial workspace — their My Submissions tracking view shows a reduced Submission
stage of its own (owned by *author-dashboard*), and the file rows below note where
it overlaps; **Reviewers** and **anonymous** visitors have no access at all. Who
may open the stage view in the first place is the shell's rule
(*workflow-stage-navigation*). <sup>a</sup>

| Action | Who may — and when |
|--------|--------------------|
| **Open the Submission-stage workspace** | • Journal Manager, Site Administrator — any submission<br>• Section Editor, Assistant — when assigned (shell rule, see *workflow-stage-navigation*) <sup>b</sup> |
| **See the incoming files list** | • Everyone who can open the stage view, including the Author in the tracking view <sup>c</sup> |
| **Upload a file into the package** | • Journal Manager, Site Administrator, Section Editor, Assistant — with the workspace open<br>• Authors — never here; their uploads happen in the submission wizard and, later, in review rounds <sup>d</sup> |
| **Change a file's details** (name, type) | • Journal Manager, Site Administrator, Section Editor, Assistant<br>• Authors — ⚠ the tracking view also offers "Update File Details" on their own files, and a saved change persists (Known deviations, Open question 2) <sup>e</sup> |
| **Delete a file** | • Journal Manager, Site Administrator, Section Editor, Assistant — after a confirmation prompt <sup>f</sup> |
| **Open a file's notes & history** ("More Information") | • Journal Manager, Site Administrator, Section Editor, Assistant <sup>g</sup> |
| **Download all files as one archive** | • Everyone who sees the list, the Author included — the link appears only when at least one file exists <sup>h</sup> |
| **Send a file to the text editor** | • Journal Manager, Site Administrator only — and only on files whose displayed name ends in a convertible format's extension (rule 4) <sup>i</sup> |
| **Record the stage's decisions** (Send for Review, Accept and Skip Review, Decline Submission, Revert Decline, Delete) | • Defined once in *editorial-decisions* — deciding editors and unassigned managers; a recommend-only Section Editor gets the same Send for Review button here — not a recommendation control — and nothing else <sup>j</sup> |

<sup>a</sup> WorkflowHandler::__construct() (role assignment); Schema.php currentUserAssignedRoles (global manager/admin fallback per stage; reviewer carve-out) ·
<sup>b</sup> workflowConfigEditorialOJS.js common.getPrimaryItems (accessibleStages guard); PKPWorkflowHandler; live-probed 2026-07-24 batch D (manager.maya unassigned — full workspace on submission 647) ·
<sup>c</sup> FileManagerConfigurations.SUBMISSION_FILES permissions (FILE_LIST for Author; list for all editorial roles); workflowConfigAuthorOJS.js submission-stage getPrimaryItems; live-probed 2026-07-24 batches A/C/D (sectioneditor.ana, assistant.rita, manager.maya, author.alex tracking view) ·
<sup>d</sup> FileManagerConfigurations.SUBMISSION_FILES (FILE_UPLOAD roles exclude Author); useFileManagerActions.js fileUpload() → wizard.fileUpload.FileUploadWizardHandler; live-probed 2026-07-24 batches B/C/D (wizard "Upload Submission File", steps 1. Upload File / 2. Review Details / 3. Confirm; no Upload button in the author tracking view) ·
<sup>e</sup> FileManagerConfigurations.SUBMISSION_FILES (FILE_EDIT includes ROLE_ID_AUTHOR); useFileManagerActions.js fileEdit() → api.file.ManageFileApiHandler op editMetadata; live-probed 2026-07-24 batches A/C (dialog "Edit a file"; author.alex rename on submission 640 saved and persisted — Known deviations) ·
<sup>f</sup> useFileManagerActions.js fileDelete() (confirm dialog, common.confirmDelete) → ManageFileApiHandler op deleteFile; live-probed 2026-07-24 batches A/D (Section Editor and Assistant deletes exercised end-to-end) ·
<sup>g</sup> useFileManagerActions.js fileSeeNotes() → informationCenter.FileInformationCenterHandler (title informationCenter.informationCenter); live-probed 2026-07-24 batch A (legacy modal "Information Center: <file name>", History/Notes tabs) ·
<sup>h</sup> useFileManagerConfig.js getBottomItems() (filesCount guard); fileDownloadAll() → api.file.FileApiHandler op downloadAllFiles; live-probed 2026-07-24 batches A/C (ZIP <submissionId>--submission-files.zip; control absent at zero files, list reads "No Items"; present in author tracking view) ·
<sup>i</sup> FileManagerConfigurations.SUBMISSION_FILES (FILE_SEND_TO_EDITOR: ROLE_ID_SITE_ADMIN, ROLE_ID_MANAGER); PANDOC_IMPORT_EXTENSIONS gate in getItemActions() on localize(file?.name) extension; live-probed 2026-07-24 batches B/D (manager docx yes / manager pdf no / sectioneditor.ana docx no / assistant.rita docx no; renamed pdf gains the action — Known deviations) ·
<sup>j</sup> workflowConfigEditorialOJS.js WORKFLOW_STAGE_ID_SUBMISSION getActionItems(); APP\submission\maps\Schema::getAvailableEditorialDecisions() (submission-stage branch, recommend-only carve-out); live-probed 2026-07-24 batches A/C/D (Section Editor and unassigned manager: Send for Review / Accept and Skip Review / Decline Submission; assistant.rita: none) · Adversarial verification 2026-07-24: every row re-derived from code alone (chunk a — all confirm) and re-driven live — positives via the scenario suite (chunk b, all green) and each denial bounded by a same-submission positive control (chunk c, submission 708: reviewer.julia and reader.rosa refused, anonymous sent to login, author.alex refused on the editorial view, no Upload/Delete/decisions where the table denies them). All ten rows hold.

## Fields & validation

N/A — the workspace hosts no forms of its own. The file-upload wizard and the
file-details dialog belong to *submission-files*; the task/discussion form to
*tasks-discussions*; the assignment dialog to *stage-participants*; the decision
wizards to *editorial-decisions*. The version-choice dialog of the text-editor
handoff is described in rule 4.

## Rules & state

1. **Where new submissions land.** A completed submission-wizard submission
   arrives on the Submission stage with its wizard uploads as the file package;
   the arrival is recorded in the activity log (event owned by
   *submission-wizard*, which also owns the automatic editor assignment and
   cover-note discussion that may greet the editor here). <sup>a</sup>
2. **What the workspace is made of.** The stage view's main column stacks the
   **Submission Files** panel and the tasks panel — headed **"Desk Review Tasks
   & Discussions"** on this stage; the side column holds **"Participants"**
   and — only when the journal collects suggestions *and* the submission carries
   at least one — the **"Reviewers Suggested by Author"** panel, which does not
   reach Assistants even when the setting is on and a suggestion exists (the
   role gating is owned by *reviewer-suggestions*); the action column carries the
   stage's decision buttons plus a **"Schedule For Publication"** shortcut to
   the publication tab (⚠ a navigation shortcut styled like a decision, shown
   even to an Assistant who has no decisions here — ledger row 220, owned by
   *editorial-decisions*). Each panel's inner workings belong to its own
   feature; this spec owns the files panel's Submission-stage behavior.
   <sup>b</sup>
3. **What the files panel lists.** Only files of the submission-package kind: the
   wizard uploads plus anything staff added on this stage — never review files,
   copyedits or production files. The panel is headed "Submission Files" with the
   line "Files uploaded at the time of submission"; the list's columns are "No",
   "File Name", "Date uploaded" and "Type" (rendered uppercase), plus a visually
   blank last column holding each row's "More Actions" control — a row carries
   the file's number, its name as a download link, the upload date, and the file
   kind as a badge. The row's menu offers "Update File Details" (a dialog headed
   "Edit a file"), "More Information" (the file's notes & history, titled
   "Information Center:" plus the file's name, with History and Notes tabs),
   "Delete" (a prompt headed "Delete" asking "Are you sure you wish to delete
   this item? This action cannot be undone.", with OK and Cancel), and — where
   rule 4 applies — "Send to Text Editor". An "Upload" button sits in the panel
   header; a "Download All Files" control under the list delivers the package as
   one ZIP archive and appears only while at least one file exists — an empty
   list reads "No Items". <sup>c</sup>
4. **The text-editor handoff.** On files whose displayed name ends in a
   convertible format's extension (docx, odt, rtf, tex, latex, md, markdown), a
   "Send to Text Editor" row action opens a dialog headed "Send File to Text
   Editor" asking "To which version would you like to send this file?" — a
   required choice that starts unselected (Confirm does nothing until a version
   is picked), offering "Create New Version" ahead of each existing version.
   Confirming leaves the file itself untouched and lands the user in the chosen
   version's Body Text editor with the file's content imported and converted —
   arriving as unsaved changes — the editor flags them with its "Unsaved
   Changes" indicator — that persist only once saved there. ⚠ The
   offer follows the file's name, not the stored file's actual format: the name
   is editable, so the action can appear on a file whose real format cannot be
   converted and disappear from one that could be (Known deviations). The Body
   Text editor is another feature's surface; this spec owns only the handoff.
   <sup>d</sup>
5. **Abilities follow the person, not the stage's progress.** The panel's actions
   are keyed to the viewer's role on this stage — they do not switch off when the
   submission moves on. Reopening the Submission stage of a submission already in
   review offers the same upload, edit and delete abilities to the same people,
   and they work — an upload lands in this stage's package, not the review round
   (the view then also carries the passed-stage status note, owned by
   *workflow-stage-navigation*). <sup>e</sup>
6. **Three exits, no automatic luggage.** Send for Review, Accept and Skip Review
   and Decline Submission are the stage's decisions (catalogue, wizards and stage
   moves in *editorial-decisions*). Leaving the stage moves no files by itself:
   only the files ticked in the decision wizard's file step are carried to the
   destination stage — the Submission Files list stays behind as the permanent
   record of what came in. <sup>f</sup>
7. **A desk-declined submission keeps its room.** Declining at the desk changes
   the submission's status, not its workspace: a "Declined" badge joins the
   submission's header (no status note enters the stage body), the files,
   participants and discussions panels remain, and the action column collapses
   to Revert Decline (plus Delete for a Journal Manager or Site Administrator),
   still under the Schedule For Publication shortcut of rule 2 — the
   decline/revert state machine is *editorial-decisions* rule 8. <sup>g</sup>

<sup>a</sup> classes/submission/Repository (submit path); LogSubmissionSubmitted.php (EVLOG-SUBM-SUBMIT, owned by submission-wizard) ·
<sup>b</sup> workflowConfigEditorialOJS.js WORKFLOW_STAGE_ID_SUBMISSION getPrimaryItems/getSecondaryItems/getActionItems (FileManager SUBMISSION_FILES, DiscussionManager, ParticipantManager, ReviewerSuggestionManager gated by isReviewerSuggestionEnabled; Schedule For Publication pushed unconditionally — ledger row 220); ReviewerSuggestionManager.vue renders only when the suggestions list is non-empty, and the suggestions read is refused for Assistants (roleBasedAccessDenied), so the panel is manager/editor-only in effect — verification chunk c (2026-07-24, submission 708) observed that refusal surface as a blocking "Error — The current role does not have access to this operation" dialog over the Assistant's workspace on load, rather than the panel silently not rendering (candidate finding for reviewer-suggestions, not this spec); heading key editor.submission.reviewerSuggestions; live-probed 2026-07-24 batches A/C/D (assistant.rita sees the shortcut but no suggestions panel, submission 647) ·
<sup>c</sup> FileManagerConfigurations.SUBMISSION_FILES fileStage SUBMISSION_FILE_SUBMISSION; titleKey submission.submit.submissionFiles; descriptionKey fileManager.submissionFilesDescription; useFileManagerConfig.js getColumns() (numero, fileName, dateUploaded, type, moreActions — last header screen-reader-only), getTopItems() (common.upload), getBottomItems() (submission.files.downloadAll); live-probed 2026-07-24 batch A (submission 648: DOM headers "No"/"File Name"/"Date uploaded"/"Type"; number cell = submission-file id; ZIP named <submissionId>--submission-files.zip; zero-file state "No Items"; delete confirm = common.confirmDelete; Information Center modal with History/Notes tabs) ·
<sup>d</sup> useFileManagerConfig.js PANDOC_IMPORT_EXTENSIONS + getItemActions() (grid.action.sendToTextEditor, extension read from localize(file?.name) — the display name); useFileManagerActions.js fileSendToEditor() (dialog fileManager.sendFileToTextEditor); useWorkflowVersionForm.js SEND_TO_TEXT_EDITOR mode (publication.sendToTextEditor.label), goToBodyTextWithImport() (PandocConverter import on arrival); live-probed 2026-07-24 batches B/D (docx handoff end-to-end on submission 643 — Body Text landing with "Unsaved Changes", original file untouched; version select starts empty, Confirm inert; renaming a pdf to *.docx surfaces the action — Known deviations) ·
<sup>e</sup> useFileManagerConfig.js getManagerConfig() permittedActions (role check only — hasCurrentUserAtLeastOneAssignedRoleInStage, no stage-currency/status check); workflowConfigEditorialOJS.js submission-stage getPrimaryItems (no passed-stage gate); live-probed 2026-07-24 batch C (submission 641 in Review Round 1: sectioneditor.ana upload with stageId=1/fileStage=2 succeeded, then delete succeeded) ·
<sup>f</sup> APP\submission\maps\Schema::getAvailableEditorialDecisions() (submission-stage branch); DecisionPage.vue copyFile() (client-side promotion — editorial-decisions rule 11); live-verified 2026-07-24 chunk d (submission 722: Send for Review recorded with the file step's checkbox UNTICKED — Files for Review reads "No Items", Submission Files list intact; note the package file arrives ticked by default, so carrying is the default and leaving is the opt-out — wording owned by editorial-decisions) ·
<sup>g</sup> getAvailableEditorialDecisions() STATUS_DECLINED branch (RevertInitialDecline only); workflowConfigEditorialOJS.js Delete gate (manager/admin); live-probed 2026-07-24 batch C (submission 642, sectioneditor.ana: header pill "Declined", rail = Schedule For Publication + Revert Decline, no Delete for the Section Editor, panels intact); re-verified 2026-07-24 chunk d (submission 723: Delete PRESENT for manager.maya on the declined view; recording Revert Decline restores the three exits and clears the badge) — chunk d also confirmed rules 1–5 at their edges, all pass

## Side effects

The workspace itself records nothing — every observable side effect belongs to an
embedded feature and is documented there:

- File uploads, detail edits and deletions write the file history entries and
  notifications owned by *submission-files*; "Download All Files" delivers the
  package as a single ZIP archive named for the submission and changes nothing.
  <sup>a</sup>
- The decisions' emails, notifications, log entries and stage moves are
  *editorial-decisions*' side effects; the submitted-event log entry that opens
  the stage's history is *submission-wizard*'s.
- The text-editor handoff sends nothing and logs nothing of its own — the
  imported text sits unsaved in the Body Text editor it opens, and nothing is
  stored until the user saves there (rule 4).

<sup>a</sup> api.file.FileApiHandler op downloadAllFiles; file event log owned by submission-files

## Settings that modify behavior

- **Reviewer suggestions** (the "Reviewer Suggestion at Submission" checkbox
  "Allow authors to suggest potential reviewers at submission process" under
  Settings → Workflow → Review → Setup, owned by *reviewer-suggestions*): when
  the journal invites authors to suggest reviewers, the "Reviewers Suggested by
  Author" panel joins the side column here on the Submission stage — though only
  once at least one suggestion exists, so an enabled setting with no suggestions
  looks the same as a disabled one (rule 2). <sup>a</sup>
- **Payments enabled with a publication fee** (owned by *editorial-decisions*):
  adds the payment step to Accept and Skip Review and a Payments control to the
  workflow header — nothing else in this workspace changes.
- There is **no setting that turns review-skipping on or off** — bypassing review
  is only ever the Accept and Skip Review decision, offered to every deciding
  editor.
- No config.inc.php variables alter these rules.

<sup>a</sup> workflowConfigEditorialOJS.js getSecondaryItems (publicationSettings.isReviewerSuggestionEnabled); context setting reviewerSuggestionEnabled; live-probed 2026-07-24 batch D (setting flipped off and restored — panel and suggestion disappeared and reappeared for the same viewer on submission 647)

## Cross-feature interactions

- **editorial-decisions** — owns the three exits, the Revert Decline / Delete
  state, the payment step, and ledger row 220 (the Schedule For Publication
  shortcut).
- **submission-files** — owns the file grids' inner mechanics: the upload wizard
  (file kinds, genres), the details dialog, deletion rules, file history.
- **workflow-stage-navigation** — owns the shell around this workspace: stage
  menu, access rules, the language line and the status notes shown when the
  Submission stage is no longer current.
- **stage-participants** — owns the Participants panel, the reviewer demotion of
  managers, and automatic editor assignment on submit.
- **tasks-discussions** — owns the Tasks & Discussions panel, including the
  cover-note discussion a wizard submission may create here.
- **reviewer-suggestions** — owns the "Reviewers Suggested by Author" panel, its
  journal setting, and the role gating that keeps the panel from Assistants.
- **submission-wizard** — owns how the package and its log entry got here.
- **author-dashboard** — owns the author's tracking view, where this stage's
  files panel reappears in reduced form.

## Canonical scenarios

1. **Taking stock of a new submission** — a Section Editor assigned to a fresh
   submission opens it from the dashboard. The workflow opens on the Submission
   stage: a "Submission Files" panel with the line "Files uploaded at the time
   of submission" lists the author's files under the columns "No", "File Name",
   "Date uploaded" and "Type", above a "Desk Review Tasks & Discussions" panel;
   "Participants" sits in the side column; the decision buttons wait on the
   right. The editor follows "Download All Files" under the list and receives
   one ZIP archive holding the whole package. <sup>s1</sup>
2. **Tidying the package** — the same Section Editor presses "Upload" in the
   panel header and adds a corrected manuscript through the "Upload Submission
   File" wizard; the new file appears in the list. From a row's "More Actions"
   menu they pick "Update File Details" to fix the file's name in the "Edit a
   file" dialog, "More Information" to read its notes and history, and on a
   duplicate row "Delete" — a prompt asks "Are you sure you wish to delete this
   item? This action cannot be undone.", and on OK the row is gone. <sup>s2</sup>
3. **Pulling the manuscript into the text editor** — a Journal Manager opens the
   actions menu on a Word-format submission file and picks "Send to Text Editor"
   (the action is absent on the PDF next to it). A dialog headed "Send File to
   Text Editor" asks "To which version would you like to send this file?" —
   "Create New Version" or an existing version; Confirm does nothing until one
   is chosen. After choosing an existing version and confirming, the Body Text
   editor opens with the manuscript's content imported, waiting as unsaved
   changes under the editor's "Unsaved Changes" indicator. The original file
   still sits unchanged in Submission Files.
   <sup>s3</sup>
4. **Handing the submission into review** — with the package in order, the
   Section Editor clicks "Send for Review" and completes the decision flow
   (owned by *editorial-decisions*), ticking the manuscript in its file step.
   The workflow now sits on Review, Round 1; the ticked file is listed in the
   round's "Files for Review"; the Submission stage keeps its full Submission
   Files list as the record of what arrived. <sup>s4</sup>
5. **Accepting without review** — on a conference-style paper, a Journal Manager
   clicks "Accept and Skip Review" and completes the flow; the submission lands
   in Copyediting without ever entering review. Reopening the Submission stage
   from the workflow menu shows the stage's panels under a "Status" note reading
   "The submission is currently in the Copyediting stage." — the note follows the
   pattern "The submission is currently in the <stage> stage.", naming whichever
   stage the submission now sits in — and the files panel still offers Upload and
   the row actions to the manager. <sup>s5</sup>
6. **A desk decline leaves the room standing** — a Section Editor clicks
   "Decline Submission" and completes the flow. Back on the Submission stage a
   "Declined" badge sits by the submission's title, the files, participants and
   discussions panels are unchanged, but the action column now offers only
   "Revert Decline" (a Journal Manager also sees "Delete"), still under the
   "Schedule For Publication" shortcut. Reverting restores the original three
   exits. <sup>s6</sup>
7. **Who sees what on the first stage** — on one submission: an Assistant
   assigned to the stage gets the files panel with "Upload", "Update File
   Details" and "Delete" (deletion works, prompt included), plus "Participants"
   and "Desk Review Tasks & Discussions" — but no decision buttons and no "Send
   to Text Editor" even on a Word-named file, though the "Schedule For
   Publication" shortcut still shows (Known deviations); the Author's My
   Submissions tracking view lists the same files with "Download All Files" but
   no Upload or Delete, its row menu offering only "Update File Details" (Known
   deviations); an unassigned Journal Manager gets the complete workspace,
   decisions included. <sup>s7</sup>

<sup>s1</sup> workflowConfigEditorialOJS.js submission-stage items; getColumns(); fileDownloadAll(); live-probed 2026-07-24 batch A (sectioneditor.ana, submission 648) ·
<sup>s2</sup> fileUpload() (FileUploadWizardHandler, title submission.submit.uploadSubmissionFile); fileEdit() (grid.action.updateFile); fileSeeNotes() (grid.action.moreInformation); fileDelete() (common.confirmDelete); live-probed 2026-07-24 batch A (rename persisted after reload) ·
<sup>s3</sup> fileSendToEditor(); PANDOC_IMPORT_EXTENSIONS (pdf excluded); useWorkflowVersionForm.js sendToTextEditor mode; live-probed 2026-07-24 batch B (manager.maya, submission 643, docx → "Author Original 1.0" → Body Text with "Unsaved Changes") ·
<sup>s4</sup> SendExternalReview (editorial-decisions s1); EDITOR_REVIEW_FILES panel (fileManager.filesForReview); live-verified 2026-07-24 chunk b (decision completes, workflow lands on Review Round 1, ticked file listed in Files for Review, Submission Files list stays) ·
<sup>s5</sup> SkipExternalReview; WorkflowSubmissionStatus.vue (workflow.submissionInFutureStage); rule 5 role-keyed actions; passed-stage revisit live-probed 2026-07-24 batch C (submission 641 in Review — status note wording, upload + delete exercised); Copyediting-stage note wording asserted verbatim in the scenario suite (green twice against the live app, 2026-07-24) ·
<sup>s6</sup> InitialDecline / RevertInitialDecline; workflowConfigEditorialOJS.js Delete gate; declined view live-probed 2026-07-24 batch C (submission 642, sectioneditor.ana) ·
<sup>s7</sup> FileManagerConfigurations.SUBMISSION_FILES permissions; workflowConfigAuthorOJS.js submission stage; Schema.php global-role fallback; live-probed 2026-07-24 batches C/D (assistant.rita + unassigned manager.maya on submission 647; author.alex tracking view on submission 640) · All seven scenarios re-run green live 2026-07-24 as the verification positive-control pass (chunk b, two headless runs against the app)

## Known deviations (as-built ≠ intent)

- ⚠ **Schedule For Publication shortcut in the action column** — expected: only
  decisions in the action column; observed: a decision-styled shortcut to the
  publication tab renders above Send for Review, persists on desk-declined
  submissions, and shows even to an Assistant who has no decisions on the stage
  (ledger row 220, owned by *editorial-decisions*; extension for the Assistant
  visibility proposed — live-probed 2026-07-24, batches C/D; reproduced in
  verification chunk e, all three legs: placement above Send for Review,
  Assistant-only action column, persistence on a desk-declined submission).
- ⚠ **Author can edit a submission file's details from the tracking view**
  (live-probed 2026-07-24, batch C — confirmed; reproduced in verification
  chunk e: rename saved and survived a full reload) — expected: the tracking
  view's file list is read-only apart from downloads; observed: the row menu
  offers a single action, "Update File Details", and a saved rename persists
  after reload while the package is under editorial control. Upload and Delete
  are absent as expected. Proposed ledger row; intent is Open question 2.
- ⚠ **The text-editor handoff is offered by file name, not file format**
  (live-probed 2026-07-24, batch D; reproduced in verification chunk e — a
  genuine PDF renamed to a Word-style name gained the action and its full
  version dialog, with the stored file untouched; the same file offered nothing
  before the rename) — expected: "Send to Text Editor" only on files whose
  stored format can actually be converted; observed: the action follows the
  displayed name's extension, which the details editor can change — a renamed
  PDF gains the action, so the dialog can be offered on a file the conversion
  cannot process. Proposed ledger row. Chunk a corroborates in code: the gate
  reads the display name's extension, and the grant is Manager/Site
  Administrator only.

## Open questions

1. The feature map's row for this feature mentions a *withdraw* option alongside
   the desk decline, but no withdraw affordance exists anywhere in the Submission
   stage's code (the nearest things are the desk decline and the manager-only
   Delete on a declined submission). Was withdraw a planned capability, or should
   the map drop the word?
2. An Author *can* edit a submission file's details (name) from the tracking
   view after submitting, and the change saves — confirmed live (see Known
   deviations). Is that intended? If yes, the details dialog is a shared author
   surface *author-dashboard* should mention; if no, the role should lose the
   action here.
3. Uploading into the Submission Files panel remains possible after the
   submission has moved to a later stage (rule 5). Intended flexibility for
   late-arriving source files, or should the panel go read-only once the stage is
   passed?
4. Code re-derivation (verification chunk a, 2026-07-24) found the server also
   grants Authors the file-*delete* operation on files they themselves uploaded —
   the same uploader-scoped access rule that lets the tracking-view rename of
   Open question 2 save. No author-facing surface offers Delete (confirmed live,
   chunk c), and the direct request path has not been driven. Is the
   uploader-scoped server grant intended, or should delete be editorial-only on
   the server as it is in the UI? (Candidate follow-up probe; the permissions
   table's row f is a UI claim and holds either way.)

---

<!-- REFERENCE MATERIAL — provenance and campaign bookkeeping, not product-owner
     narrative. -->

## Reference — entry points & surfaces

| Entry | Path | Atom |
|-------|------|------|
| Submission-stage workspace | Dashboard → submission workflow → "Submission" menu entry (shell op `workflow/index/{id}/1`, owned by workflow-stage-navigation) | PAGE-workflow-submission (stays with workflow-stage-navigation) |
| Submission Files panel | FileManager namespace SUBMISSION_FILES (fileStage 2), files fetched from `GET api/v1/submissions/{id}/files?fileStages=2` | VUE-file-manager, GRID-submission-files-* (stay with submission-files) |
| Upload dialog | legacy `wizard.fileUpload.FileUploadWizardHandler` op startWizard (stageId 1, fileStage 2) | GRID-lib-pkp-wizard-file-upload-file-upload-wizard-handler (stays with submission-files) |
| File details / delete | legacy `api.file.ManageFileApiHandler` ops editMetadata / deleteFile | — (submission-files) |
| File notes & history | legacy `informationCenter.FileInformationCenterHandler` op viewInformationCenter | — (editorial-activity-log / submission-files) |
| Download-all archive | legacy `api.file.FileApiHandler` op downloadAllFiles | — (submission-files) |
| Text-editor handoff | file row action → WorkflowVersionDialogBody (mode sendToTextEditor) → Body Text editor with PandocConverter import | — (body-text/publication feature) |
| Decision buttons | availableEditorialDecisions payload → decision wizard (editorial-decisions) | PAGE-decision-record (editorial-decisions) |
| OJS submission schema | `schemas/submission.json` (sectionId required on create; scheduledIn, issueToBePublished, reviewerSuggestions read-only) | SCHEMA-submission-ojs (claimed here) |

## Reference — code anchors

- lib/ui-library/src/pages/workflow/composables/useWorkflowConfig/workflowConfigEditorialOJS.js
  — WORKFLOW_STAGE_ID_SUBMISSION getPrimaryItems/getSecondaryItems/getActionItems
  (workspace composition, decision buttons, Delete gate)
- lib/ui-library/src/managers/FileManager/useFileManagerConfig.js —
  SUBMISSION_FILES configuration (permissions per role, actions, columns,
  PANDOC_IMPORT_EXTENSIONS gate)
- lib/ui-library/src/managers/FileManager/useFileManagerActions.js — upload /
  edit / delete / notes / download-all / send-to-text-editor action plumbing
  (legacy grid handlers behind each)
- lib/ui-library/src/managers/FileManager/fileManagerStore.js — files fetch
  (`submissions/{id}/files`, fileStages filter)
- lib/ui-library/src/pages/workflow/composables/useWorkflowVersionForm.js +
  components/publication/WorkflowVersionDialogBody.vue — sendToTextEditor mode,
  goToBodyTextWithImport()
- lib/ui-library/src/composables/useCurrentUser.js
  hasCurrentUserAtLeastOneAssignedRoleInStage(); lib/pkp/classes/submission/maps/
  Schema.php (currentUserAssignedRoles, global manager fallback, reviewer
  carve-out)
- classes/submission/maps/Schema.php getAvailableEditorialDecisions() —
  submission-stage decision roster (referenced; owned by editorial-decisions)
- pages/workflow/WorkflowHandler.php + lib/pkp/pages/workflow/PKPWorkflowHandler.php
  — page ops (owned by workflow-stage-navigation)
- schemas/submission.json — OJS-specific submission props (SCHEMA-submission-ojs)
- lib/pkp/classes/observers/listeners/LogSubmissionSubmitted.php —
  EVLOG-SUBM-SUBMIT (owned by submission-wizard)
