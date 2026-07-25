---
name: send-to-review
scope: The pre-review (Submission-stage) workspace — where the editorial team takes stock of the incoming files, tidies the package, and hands the submission into review, into copyediting, or out at the desk
shared: no
status: verified
atlas-claims:
  - SCHEMA-submission-ojs
  - API-backend-submissions-delete
---

# Send to review (the Submission-stage workspace)

## Purpose

Every new submission lands on the **Submission** stage — the first entry in the
workflow menu — and waits there for an editor's verdict. This spec covers that
pre-review workspace as one shared screen for everyone who opens it — the
editorial team and the submitting author alike: the **Submission Files** panel
holding what the author uploaded (and anything staff add), the working panels
around it (participants, tasks & discussions, reviewer suggestions), and the
stage's three exits — send the submission into peer review, accept it straight
into copyediting, or decline it at the desk. The exits themselves are editorial
decisions; their wizards, emails and stage moves are defined once in
*editorial-decisions* and only referenced here. What this spec owns is the room
the decision is made in: what each of its viewers can see and do with the
incoming package before the submission moves on.

## Actors & permissions

Terms: *assigned* = holds a stage assignment on this submission — a place in
its **Participants** panel — in a role that covers the Submission stage (which
stages a role covers is part of the journal's role setup, and a single
assignment opens every stage its role covers — see *stage-participants*). A
*recommend-only* Section Editor is one whose participant assignment was set, when
they were added to the submission, to recommend editorial decisions rather than
record them (the assignment option is owned by *stage-participants*). Where a ⚠
cites "ledger row N": the ledger is the shared defect register at
docs/e2e/app-changes.md — one numbered row per as-built-vs-intent finding; the
row number is a filing reference for the team, not anything on screen. The
workflow screen is one shared surface for every role on it: the **Author**
reaches it through the **View** button on My Submissions (that entry route — the
author's "tracking view" — is owned by *author-dashboard*), and from there
stands on the same screen as the editorial roles — what differs is availability,
which each row below states, not the screen. Baselines: a **Journal Manager**
needs no assignment — an unassigned manager gets the full workspace on any
submission in the journal, except while personally serving as a reviewer on it
(the *reviewer demotion*: a manager reviewing a submission loses their
manager-wide reach on that submission for the duration — owned by
*stage-participants*). A **Site Administrator** has no reach of their own on
this stage: they work it only through a journal role they also hold, and get
exactly that role's abilities. Holding the **Journal Manager** role, that means
the same any-submission reach as a Journal Manager — this is what "Site
Administrator" means in the rows below; holding only a **Section Editor** or
**Assistant** role, that role's reach, assignment requirement included; with no
role in the journal, the workspace does not open at all — the workflow panel
stays empty behind an access-refused message. An **Author** acts only on submissions they submitted.
**Reviewers** and **anonymous** visitors have no access at all. Who may open the
stage view in the first place is the shell's rule — the *shell* being the
workflow page around this workspace, its stage menu and header tools, owned by
*workflow-stage-navigation*. <sup>a</sup>

| Action | Who may — and when |
|--------|--------------------|
| **Open the Submission-stage workspace** | • Journal Manager, Site Administrator — any submission<br>• Section Editor, Assistant — when assigned (shell rule, see *workflow-stage-navigation*)<br>• Author — their own submissions, entered from My Submissions; the same screen opens, with the availability the rows below state <sup>b</sup> |
| **See the incoming files list** | • Everyone who can open the workspace, the Author included <sup>c</sup> |
| **Upload a file into the package** | • Journal Manager, Site Administrator, Section Editor, Assistant — with the workspace open<br>• Author — no Upload button on this screen; their uploads happen in the submission wizard and, later, in review rounds <sup>d</sup> |
| **Change a file's details** — the "Edit a file" dialog always asks for the file's name; on some kinds of file it asks for more, and which further fields appear follows the kind of file (the dialog is owned by *submission-files*) | • Journal Manager, Site Administrator, Section Editor, Assistant — any file in the package<br>• Author — ⚠ on files they themselves uploaded: the same kind-dependent dialog, and a saved change persists (Known deviations, Open question 2)<br>• Author, on a file someone else uploaded — ⚠ the row menu still offers the action, but the dialog opens onto a refusal instead of a form (Known deviations, proposed) <sup>e</sup> |
| **Delete a file** | • Journal Manager, Site Administrator, Section Editor, Assistant — after a confirmation prompt<br>• Author — no; their row menu offers no Delete — ⚠ the withholding applies on this screen only (Known deviations) <sup>f</sup> |
| **Open a file's notes & history** ("More Information") | • Journal Manager, Site Administrator, Section Editor, Assistant<br>• Author — no; their row menu holds only "Update File Details" <sup>g</sup> |
| **Download all files as one archive** | • Everyone who sees the list, the Author included — the link appears only when at least one file exists <sup>h</sup> |
| **Send a file to the text editor** | • Journal Manager, Site Administrator — only on files whose displayed name ends in a convertible format's extension (rule 4)<br>• Section Editor, Assistant, Author — never, whatever the file <sup>i</sup> |
| **Record the stage's decisions** (Send for Review, Accept and Skip Review, Decline Submission, Revert Decline) | • Defined once in *editorial-decisions* — deciding editors and unassigned managers; a recommend-only Section Editor gets the same Send for Review button here — not a recommendation control — and nothing else while the submission is active (⚠ on a desk-declined submission their button set does not change — Known deviations, ledger row 254)<br>• Assistant — no decision buttons<br>• Author — no decision buttons; for them the screen renders no action column at all <sup>j</sup> |
| **Delete the submission** | • Journal Manager, Site Administrator — the button joins the action column only while the submission sits declined at this desk (rule 8); the capability behind it is broader than the button and is recorded against *submission-drafts* (ledger row 194) — this row states the screen<br>• Section Editor, Assistant — never<br>• Author — never here; removing an unfinished draft is the submission wizard's own affair (*submission-drafts*) <sup>k</sup> |

<sup>a</sup> WorkflowHandler::__construct() (role assignment); Schema.php currentUserAssignedRoles (global manager/admin fallback per stage; reviewer carve-out); the Site-Administrator split: PKPSubmissionController::getGroupRoutes() GET-route roleAuthorizer lists Manager/Sub-editor/Assistant/Reviewer/Author with no Site Administrator entry, and RoleDAO roles are journal-scoped, so administrator reach rides on a journal role — adjudicated 2026-07-25 (.reports/opus-eval-analysis/DEEPDIVE.md contradiction 1, both judges + reference-build probe); live-probed in this build 2026-07-25 (maintenance batch A items 1–2: probe.pure, Site Administrator with no journal group — the workflow panel opens empty, zero controls beyond Close, under the error dialog "The current role does not have access to this operation.", though the journal's editorial list itself still renders; seeded admin, site admin + journal Manager, unassigned — full workspace with all three exits on submissions 8/12); re-driven 2026-07-25 (verification chunk c, with a same-submission positive control): expected — with no journal role nothing about the submission is in reach; observed — the workspace and every change are refused, while some read-only views of the same submission still render (proposed ledger row, pending) ·
<sup>b</sup> workflowConfigEditorialOJS.js common.getPrimaryItems (accessibleStages guard); PKPWorkflowHandler; live-probed 2026-07-24 batch D (manager.maya unassigned — full workspace on submission 647); author entry live-probed 2026-07-25 (maintenance batch A item 3: author.alex, My Submissions → View on submission 13 — the workflow screen opens on the Submission stage; the stage menu is shorter and there is no Activity Log header tool) ·
<sup>c</sup> FileManagerConfigurations.SUBMISSION_FILES permissions (FILE_LIST for Author; list for all editorial roles); workflowConfigAuthorOJS.js submission-stage getPrimaryItems; live-probed 2026-07-24 batches A/C/D (sectioneditor.ana, assistant.rita, manager.maya, author.alex via My Submissions); author leg re-probed 2026-07-25 (maintenance batch A item 3 / batch B items 8–9 — files listed with working row menus) ·
<sup>d</sup> FileManagerConfigurations.SUBMISSION_FILES (FILE_UPLOAD roles exclude Author); useFileManagerActions.js fileUpload() → wizard.fileUpload.FileUploadWizardHandler; live-probed 2026-07-24 batches B/C/D (wizard "Upload Submission File", steps 1. Upload File / 2. Review Details / 3. Confirm; no Upload button in the author's view); author no-Upload re-probed 2026-07-25 (maintenance batch A item 3 / batch B item 10) ·
<sup>e</sup> FileManagerConfigurations.SUBMISSION_FILES (FILE_EDIT includes ROLE_ID_AUTHOR); useFileManagerActions.js fileEdit() → api.file.ManageFileApiHandler op editMetadata; dialog fields useFileMetadataForm.js — `name` always (submission.form.name), GENRE_CATEGORY_SUPPLEMENTARY adds description/creator/publisher/source/subject/sponsor/date/language, GENRE_CATEGORY_ARTWORK adds caption/credit/copyright-owner/permission-terms; per-kind field sets live-probed 2026-07-25 (maintenance batch A items 4–7: document-kind pdf → name only; Data Set → the eight further fields, on-screen labels "Creator (or owner) of file" / "Contributor or sponsoring agency"; the artwork set appears only on a dependent file of an HTML/XML file — no artwork genre is offered by the Submission Files upload wizard; an HTML file's dialog additionally carries a Dependent Files grid, keyed to the file's format, not its kind); author legs live-probed 2026-07-25 (batch B item 8: author.alex, own Data Set file, submission 11 — full supplementary field set, saved name/description/creator persisted and read back by manager.maya; on manager-uploaded files, submission 1, the same menu entry opened onto "The current role does not have access to this operation." with no form — uploader scope per SubmissionFileAccessPolicy, proposed ledger row); live-probed 2026-07-24 batches A/C on document-kind files (dialog "Edit a file"; author.alex rename on submission 640 saved and persisted — Known deviations) ·
<sup>f</sup> useFileManagerActions.js fileDelete() (confirm dialog, common.confirmDelete) → ManageFileApiHandler op deleteFile; live-probed 2026-07-24 batches A/D (Section Editor and Assistant deletes exercised end-to-end); author no-Delete re-probed 2026-07-25 (batch B item 9: author.alex row menus = "Update File Details" only, own and manager uploads alike); re-driven 2026-07-25 (verification chunk c, on a scratch submission, with a same-file positive control): expected the Author cannot remove a package file, observed the removal is carried out and the file is absent for every viewer afterwards — proposed ledger row (pending) ·
<sup>g</sup> useFileManagerActions.js fileSeeNotes() → informationCenter.FileInformationCenterHandler (title informationCenter.informationCenter); live-probed 2026-07-24 batch A (legacy modal "Information Center: <file name>", History/Notes tabs); author denial: batch C (author.alex row menu on submission 640 held only "Update File Details"); author denial re-probed 2026-07-25 (batch B item 9) ·
<sup>h</sup> useFileManagerConfig.js getBottomItems() (filesCount guard); fileDownloadAll() → api.file.FileApiHandler op downloadAllFiles; live-probed 2026-07-24 batches A/C (ZIP <submissionId>--submission-files.zip; control absent at zero files, list reads "No Items"; present in the author's view); re-confirmed for the author 2026-07-25 (batch A item 3 / batch B item 10 — Download All Files present, Upload absent) ·
<sup>i</sup> FileManagerConfigurations.SUBMISSION_FILES (FILE_SEND_TO_EDITOR: ROLE_ID_SITE_ADMIN, ROLE_ID_MANAGER); PANDOC_IMPORT_EXTENSIONS gate in getItemActions() on localize(file?.name) extension; live-probed 2026-07-24 batches B/D (manager docx yes / manager pdf no / sectioneditor.ana docx no / assistant.rita docx no; renamed pdf gains the action — Known deviations); author denial with positive control 2026-07-25 (batch B item 9: author.alex docx rows — own upload and a manager's — offered no Send to Text Editor while manager.maya's menu on the same file led with it) ·
<sup>j</sup> workflowConfigEditorialOJS.js WORKFLOW_STAGE_ID_SUBMISSION getActionItems(); APP\submission\maps\Schema::getAvailableEditorialDecisions() (submission-stage branch, recommend-only carve-out; the isOnlyRecommending branch runs before the declined-status test — ledger row 254); live-probed 2026-07-24 batches A/C/D (Section Editor and unassigned manager: Send for Review / Accept and Skip Review / Decline Submission; assistant.rita: none); the author no-action-column leg live-probed 2026-07-25 (maintenance batch A item 3 / batch B item 10: workflowConfigAuthorOJS.js defines no getActionItems for this stage, and the action-items region does not render — element count 0 — on active and desk-declined submissions alike) ·
<sup>k</sup> workflowConfigEditorialOJS.js getActionItems() (Delete pushed alongside Revert Decline, manager/admin only); useWorkflowActions.js workflowDeleteSubmission(); PKPBackendSubmissionsController::delete() + Repo\submission\Repository::canCurrentUserDelete() (role-bound, not state-bound — ledger row 194, owned by submission-drafts); manager-sees-Delete / Section-Editor-does-not live-probed 2026-07-24 batch C + chunk d (submissions 642/723); the full matrix re-probed in this build 2026-07-25 (batch B item 10: Delete present only for manager.maya and the seeded admin-with-journal-role on desk-declined submission 3 — absent for sectioneditor.ana, assistant.rita, the author, and on active submission 2); the full deletion walk driven in this build 2026-07-25 (batch B item 11, submission 4) · Adversarial verification 2026-07-24: every row then present re-derived from code alone (chunk a — all confirm) and re-driven live — positives via the scenario suite (chunk b, all green) and each denial bounded by a same-submission positive control (chunk c, submission 708: reviewer.julia and reader.rosa refused, anonymous sent to login, author.alex refused on the editorial view, no Upload/Delete/decisions where the table denies them). All ten rows as of 2026-07-24 hold; the maintenance-pass additions (the Site-Administrator split, the author legs stated in-row, row k, the row-e field-set wording, the row-j declined exception) were live-probed 2026-07-25 (maintenance batches A/B — every addition confirmed; batch B item 8 added the refusal leg now stated in row e).

## Fields & validation

N/A — the workspace hosts no forms of its own. The file-upload wizard and the
file-details dialog belong to *submission-files*; the task/discussion form to
*tasks-discussions*; the assignment dialog to *stage-participants*; the decision
wizards to *editorial-decisions*. The version-choice dialog of the text-editor
handoff is described in rule 4.

## Rules & state

1. **Where new submissions land.** A completed submission-wizard submission
   arrives on the Submission stage with its wizard uploads as the file package;
   the arrival is recorded in the activity log — the submission's running
   history, opened from the "Activity Log" tool in the workflow header (the tool
   belongs to *workflow-stage-navigation*; the arrival event is owned by
   *submission-wizard*, which also owns the automatic editor assignment and the
   cover-note discussion — a discussion the wizard may create from the author's
   comments to the editor — that may greet the editor here). <sup>a</sup>
2. **What the workspace is made of.** The stage view's main column stacks the
   **Submission Files** panel and the tasks panel — headed **"Desk Review Tasks
   & Discussions"** on this stage; the side column holds **"Participants"**
   and — only when the journal collects suggestions *and* the submission carries
   at least one — the **"Reviewers Suggested by Author"** panel, which
   Assistants are never shown even when the setting is on and a suggestion
   exists (the role gating, and how that withholding surfaces on an Assistant's
   screen, is owned by *reviewer-suggestions*); the action column carries the
   stage's decision buttons plus a **"Schedule For Publication"** shortcut to
   the publication tab (⚠ a navigation shortcut styled like a decision, shown
   even to an Assistant who has no decisions here — ledger row 220, owned by
   *editorial-decisions*). Each panel's inner workings belong to its own
   feature; this spec owns the files panel's Submission-stage behavior.
   <sup>b</sup>
3. **What the files panel lists.** Only the submission package: the wizard
   uploads plus anything staff added on this stage. Files that enter the
   workflow later — review files, copyedits, production files — live in their
   own stages' panels and never appear here; the scoping follows where a file
   entered, and nothing on this list marks the difference. The panel is headed
   "Submission Files" with the line "Files uploaded at the time of submission";
   the list's columns are "No", "File Name", "Date uploaded" and "Type" (all
   four header labels are shown in capital letters on screen, though written
   here as authored), plus a visually blank last column holding each row's "More
   Actions" control — a row carries the file's number (an identifying number
   the system gave the file when it was added, not a 1, 2, 3 row count — the
   first row need not read "1"), its name as a download link, the upload date,
   and the file kind as a badge (the kind chosen at upload — for example
   "Article Text" or "Data Set"). The row's menu offers "Update File Details" (a dialog headed
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
   is picked), offering "Create New Version" ahead of each existing version,
   listed by its name (for example "Author Original 1.0"). Confirming leaves
   the file itself untouched and lands the user in the chosen version's Body
   Text editor with the file's content imported and converted — on screen, the
   manuscript's text sits in the editor as unsaved changes — the editor flags
   them with its "Unsaved Changes" indicator — that persist only once saved
   there. ⚠ The
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
   (the view then also carries the passed-stage status note — a "Status" note
   reading "The submission is currently in the <stage> stage.", naming the
   stage the submission now sits in — owned by *workflow-stage-navigation*). ⚠ Whether a passed stage was ever meant to stay
   writable is a recorded intent question, not settled behavior (Known
   deviations, ledger row 257). <sup>e</sup>
6. **Three exits, no automatic luggage.** Send for Review, Accept and Skip Review
   and Decline Submission are the stage's decisions (catalogue, wizards and stage
   moves in *editorial-decisions*). Leaving the stage moves no files by itself:
   the decision wizard's file step lists the package with a checkbox beside each
   file, and only the ticked files are carried to the destination stage — the
   Submission Files list stays behind as the permanent record of what came in. <sup>f</sup>
7. **A desk-declined submission keeps its room.** Declining at the desk changes
   the submission's status, not its workspace: a "Declined" badge joins the
   submission's header (no status note enters the stage body), the files,
   participants and discussions panels remain, and the action column collapses
   to Revert Decline (plus Delete for a Journal Manager or Site Administrator),
   still under the Schedule For Publication shortcut of rule 2 — the
   decline/revert state machine is *editorial-decisions* rule 8. ⚠ The collapse is what
   the action column offers, not what the stage refuses: a recommend-only
   Section Editor keeps their Send for Review button instead of gaining Revert
   Decline, and for any assigned editor the same decision arriving by a direct
   request outside the screen — a route with no on-screen control, so a QA
   person cannot construct that case manually; it is tracked in ledger row
   254 — is recorded rather than refused; the submission then sits on Review,
   Round 1 while still marked Declined (Known deviations, ledger row 254). <sup>g</sup>
8. **Deleting a declined submission is permanent and total.** Delete asks for
   confirmation first — a dialog titled "Delete" reading "Are you sure you want
   to permanently delete this submission?", with Confirm and Cancel. Confirming
   removes the submission outright: the workflow panel — the workspace opens
   over the dashboard but has a web address of its own — closes, the submission
   drops from the editorial lists (the dashboard's submission lists, the
   "Active" and "Declined" views alike), and an old link to it opens an empty
   workflow panel over the message "Invalid submission." There is no undo and no
   archive copy — the files, participants, discussions, recorded decisions and
   the submission's activity log all leave with the submission, ⚠ though stored
   history entries about its files outlive the deletion, unreachable from any
   screen — nothing a manual tester can observe or verify; the finding is
   tracked in Known deviations (proposed ledger row) and Side effects. Who gets
   the button, and on which submissions, is the permissions table's last row.
   <sup>h</sup>

<sup>a</sup> classes/submission/Repository (submit path); LogSubmissionSubmitted.php (EVLOG-SUBM-SUBMIT, owned by submission-wizard) ·
<sup>b</sup> workflowConfigEditorialOJS.js WORKFLOW_STAGE_ID_SUBMISSION getPrimaryItems/getSecondaryItems/getActionItems (FileManager SUBMISSION_FILES, DiscussionManager, ParticipantManager, ReviewerSuggestionManager gated by isReviewerSuggestionEnabled; Schedule For Publication pushed unconditionally — ledger row 220); ReviewerSuggestionManager.vue renders only when the suggestions list is non-empty, and the suggestions read is refused for Assistants (roleBasedAccessDenied), so the panel is manager/editor-only in effect — verification chunk c (2026-07-24, submission 708) observed that refusal surface as a blocking "Error — The current role does not have access to this operation" dialog over the Assistant's workspace on load, rather than the panel silently not rendering (candidate finding for reviewer-suggestions, not this spec); heading key editor.submission.reviewerSuggestions; live-probed 2026-07-24 batches A/C/D (assistant.rita sees the shortcut but no suggestions panel, submission 647) ·
<sup>c</sup> FileManagerConfigurations.SUBMISSION_FILES fileStage SUBMISSION_FILE_SUBMISSION; titleKey submission.submit.submissionFiles; descriptionKey fileManager.submissionFilesDescription; useFileManagerConfig.js getColumns() (numero, fileName, dateUploaded, type, moreActions — last header screen-reader-only), getTopItems() (common.upload), getBottomItems() (submission.files.downloadAll); live-probed 2026-07-24 batch A (submission 648: DOM headers "No"/"File Name"/"Date uploaded"/"Type"; number cell = submission-file id; ZIP named <submissionId>--submission-files.zip; zero-file state "No Items"; delete confirm = common.confirmDelete; Information Center modal with History/Notes tabs); the shared file-panel builder also declares a "Select Files" checkbox column and an "Upload/Select Files" button — neither is permitted in this stage's file panel, so neither can appear here; waived as unreachable on this screen (declared-control sweep, 2026-07-25) ·
<sup>d</sup> useFileManagerConfig.js PANDOC_IMPORT_EXTENSIONS + getItemActions() (grid.action.sendToTextEditor, extension read from localize(file?.name) — the display name); useFileManagerActions.js fileSendToEditor() (dialog fileManager.sendFileToTextEditor); useWorkflowVersionForm.js SEND_TO_TEXT_EDITOR mode (publication.sendToTextEditor.label), goToBodyTextWithImport() (PandocConverter import on arrival); live-probed 2026-07-24 batches B/D (docx handoff end-to-end on submission 643 — Body Text landing with "Unsaved Changes", original file untouched; version select starts empty, Confirm inert; renaming a pdf to *.docx surfaces the action — Known deviations) ·
<sup>e</sup> useFileManagerConfig.js getManagerConfig() permittedActions (role check only — hasCurrentUserAtLeastOneAssignedRoleInStage, no stage-currency/status check); workflowConfigEditorialOJS.js submission-stage getPrimaryItems (no passed-stage gate); live-probed 2026-07-24 batch C (submission 641 in Review Round 1: sectioneditor.ana upload with stageId=1/fileStage=2 succeeded, then delete succeeded); rename leg re-probed in this build 2026-07-25 (batch B item 14, submission 6 in Review: sectioneditor.ana renamed a file in the reopened Submission stage — saved, and the new name shown to manager.maya and author.alex in fresh sessions; the passed-stage action column held only the Schedule For Publication shortcut) ·
<sup>f</sup> APP\submission\maps\Schema::getAvailableEditorialDecisions() (submission-stage branch); DecisionPage.vue copyFile() (client-side promotion — editorial-decisions rule 11); live-verified 2026-07-24 chunk d (submission 722: Send for Review recorded with the file step's checkbox UNTICKED — Files for Review reads "No Items", Submission Files list intact; note the package file arrives ticked by default, so carrying is the default and leaving is the opt-out — wording owned by editorial-decisions) ·
<sup>g</sup> getAvailableEditorialDecisions() STATUS_DECLINED branch (RevertInitialDecline only); workflowConfigEditorialOJS.js Delete gate (manager/admin); live-probed 2026-07-24 batch C (submission 642, sectioneditor.ana: header pill "Declined", rail = Schedule For Publication + Revert Decline, no Delete for the Section Editor, panels intact); re-verified 2026-07-24 chunk d (submission 723: Delete PRESENT for manager.maya on the declined view; recording Revert Decline restores the three exits and clears the badge) — chunk d also confirmed rules 1–5 at their edges, all pass; the recommend-only exception re-probed in this build 2026-07-25 (batch B item 13, submission 5 — see Known deviations, ledger row 254) ·
<sup>h</sup> useWorkflowActions.js workflowDeleteSubmission() (dialog common.delete / editor.submissionArchive.confirmDelete, then closeWorkflowModal()); PKPBackendSubmissionsController::delete(); Repo\submission\Repository::delete(); live-probed in this build 2026-07-25 (batch B item 11, manager.maya, submission 4: dialog verbatim with Confirm/Cancel buttons; Confirm closes the panel onto the dashboard; the submission's tag absent from the Active and Declined lists; the old address renders an empty panel under an "Error / Invalid submission." dialog)

## Side effects

The workspace itself records nothing — every observable side effect belongs to an
embedded feature and is documented there:

- File uploads, detail edits and deletions write the file history entries and
  notifications that *submission-files* documents — none of them surface on this
  screen; that spec names where each is seen. "Download All Files" delivers the
  package as a single ZIP archive named for the submission and changes nothing.
  <sup>a</sup>
- The decisions' emails, notifications, log entries and stage moves are
  *editorial-decisions*' side effects; the submitted-event log entry that opens
  the stage's history is *submission-wizard*'s.
- The text-editor handoff sends nothing and logs nothing of its own — the
  imported text sits unsaved in the Body Text editor it opens, and nothing is
  stored until the user saves there (rule 4).
- Deleting the submission (rule 8) emails no one: the submission's activity
  log, files, participants, discussions, decisions and notifications all go
  with it. ⚠ Not every stored trace goes: history entries kept about the
  submission's files remain behind, and the deletion itself records one more —
  though no screen reaches them afterwards (Known deviations, proposed). What
  remains observable is the submission's absence from the dashboard's
  submission lists (rule 8) and the "Invalid submission." message on its old
  address. <sup>b</sup>

<sup>a</sup> api.file.FileApiHandler op downloadAllFiles; file event log owned by submission-files ·
<sup>b</sup> Repo\submission\Repository::delete() (hooks only — no mailable); side effects live-probed in this build 2026-07-25 (maintenance batch B items 11–12, submission 4: Mailpit gained nothing; every submission-scoped table — submissions, publications, submission_files, files, stage_assignments, edit_decisions, notifications, submission-scoped event_log — held zero rows afterwards, and the submission's files directory was removed; the exception: event_log rows scoped ASSOC_TYPE_SUBMISSION_FILE survive, and the delete writes a submission.event.fileDeleted row plus settings naming file, submission and acting user — proposed ledger row); the earlier reference-build walk (arm-b, 2026-07-25) is superseded by this in-build probe

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
  menu, access rules, the header tools (Activity Log, Library, Payments,
  Preview — the Author's header carries Library), the language line and the
  status notes shown when the Submission stage is no longer current.
- **stage-participants** — owns the Participants panel, the reviewer demotion of
  managers, and automatic editor assignment on submit.
- **tasks-discussions** — owns the Tasks & Discussions panel, including the
  cover-note discussion a wizard submission may create here.
- **reviewer-suggestions** — owns the "Reviewers Suggested by Author" panel, its
  journal setting, and the role gating that keeps the panel from Assistants.
- **submission-wizard** — owns how the package and its log entry got here.
- **submission-drafts** — owns the author-side deletion of an unfinished draft;
  the editorial Delete of rule 8 is the same underlying capability seen from the
  workflow (its breadth is ledger row 194, recorded there).
- **author-dashboard** — owns My Submissions and its "View" button, the
  author's entry route into this shared workflow screen.

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
   exits, and the "Declined" badge leaves the submission's header. <sup>s6</sup>
7. **Who sees what on the first stage** — on one submission: an Assistant
   assigned to the stage gets the files panel with "Upload", "Update File
   Details" and "Delete" (deletion works, prompt included), plus "Participants"
   and "Desk Review Tasks & Discussions" — no "Reviewers Suggested by Author"
   panel joins their side column (rule 2 keeps it from Assistants) — but no
   decision buttons and no "Send to Text Editor" even on a Word-named file,
   though the "Schedule For Publication" shortcut still shows (Known
   deviations); the Author — opening the same submission through "View" on My
   Submissions — stands on the same screen: the same files with "Download All
   Files" but no Upload, no Delete and no decision buttons — and no "Schedule
   For Publication" either, since the Author's screen shows no action column at
   all — each row's menu offering only "Update File Details" (Known
   deviations); an unassigned Journal Manager gets the complete workspace,
   decisions included. <sup>s7</sup>
8. **Deleting a declined submission for good** — on a submission already
   declined at the desk (the state scenario 6 ends in), a Journal Manager first
   notes down the submission's web address — it cannot be recovered afterwards —
   then presses "Delete" in the action column. A dialog titled "Delete" asks
   "Are you sure you want to permanently delete this submission?"; on Confirm
   the workflow panel closes and the submission is gone from the editorial
   lists. Opening the noted address now shows an empty workflow panel over the
   message "Invalid submission." <sup>s8</sup>

<sup>s1</sup> workflowConfigEditorialOJS.js submission-stage items; getColumns(); fileDownloadAll(); live-probed 2026-07-24 batch A (sectioneditor.ana, submission 648) ·
<sup>s2</sup> fileUpload() (FileUploadWizardHandler, title submission.submit.uploadSubmissionFile); fileEdit() (grid.action.updateFile); fileSeeNotes() (grid.action.moreInformation); fileDelete() (common.confirmDelete); live-probed 2026-07-24 batch A (rename persisted after reload) ·
<sup>s3</sup> fileSendToEditor(); PANDOC_IMPORT_EXTENSIONS (pdf excluded); useWorkflowVersionForm.js sendToTextEditor mode; live-probed 2026-07-24 batch B (manager.maya, submission 643, docx → "Author Original 1.0" → Body Text with "Unsaved Changes") ·
<sup>s4</sup> SendExternalReview (editorial-decisions s1); EDITOR_REVIEW_FILES panel (fileManager.filesForReview); live-verified 2026-07-24 chunk b (decision completes, workflow lands on Review Round 1, ticked file listed in Files for Review, Submission Files list stays) ·
<sup>s5</sup> SkipExternalReview; WorkflowSubmissionStatus.vue (workflow.submissionInFutureStage); rule 5 role-keyed actions; passed-stage revisit live-probed 2026-07-24 batch C (submission 641 in Review — status note wording, upload + delete exercised); Copyediting-stage note wording asserted verbatim in the scenario suite (green twice against the live app, 2026-07-24) ·
<sup>s6</sup> InitialDecline / RevertInitialDecline; workflowConfigEditorialOJS.js Delete gate; declined view live-probed 2026-07-24 batch C (submission 642, sectioneditor.ana) ·
<sup>s7</sup> FileManagerConfigurations.SUBMISSION_FILES permissions; workflowConfigAuthorOJS.js submission stage; Schema.php global-role fallback; live-probed 2026-07-24 batches C/D (assistant.rita + unassigned manager.maya on submission 647; author.alex via My Submissions on submission 640); author legs re-probed 2026-07-25 (maintenance batch A item 3 / batch B items 8–10) ·
<sup>s8</sup> workflowDeleteSubmission(); PKPBackendSubmissionsController::delete(); driven live in this build 2026-07-25 (maintenance batch B item 11, manager.maya, submission 4 — dialog, panel close, list absence and "Invalid submission." all as written); seed shortcut: the scenario API accepts a stage-1 submission with an initialDecline decision · Scenarios 1–7 re-run green live 2026-07-24 as the verification positive-control pass (chunk b, two headless runs against the app); scenario 8 was driven in this build 2026-07-25 (maintenance batch B)

## Known deviations (as-built ≠ intent)

- ⚠ **Schedule For Publication shortcut in the action column** — expected: only
  decisions in the action column; observed: a decision-styled shortcut to the
  publication tab renders above Send for Review, persists on desk-declined
  submissions, and shows even to an Assistant who has no decisions on the stage
  (ledger row 220, owned by *editorial-decisions*; extension for the Assistant
  visibility proposed — live-probed 2026-07-24, batches C/D; reproduced in
  verification chunk e, all three legs: placement above Send for Review,
  Assistant-only action column, persistence on a desk-declined submission;
  re-observed incidentally 2026-07-25, maintenance batch B — sole rail entry
  for an Assistant on a desk-declined submission and in a passed-stage view).
- ⚠ **The Author can edit the details of files they uploaded, after
  submitting** (live-probed 2026-07-24, batch C; reproduced in verification
  chunk e: rename saved and survived a full reload; extended 2026-07-25,
  maintenance batch B item 8 — on the Author's own supplementary-kind file the
  dialog opened with the full wider field set, and a save of name, description
  and creator persisted and was read back by a Journal Manager) — expected: the
  Author's file list on this screen is read-only apart from downloads;
  observed: each row's menu offers a single action, "Update File Details", and
  on the Author's own files a saved change persists while the package is under
  editorial control. Upload and Delete are absent as expected. Proposed ledger
  row; intent is Open question 2.
- ⚠ **"Update File Details" is offered to the Author on files they did not
  upload, and opens onto a refusal** (live-probed 2026-07-25, maintenance
  batch B item 8) — expected: a row menu offers only actions its viewer can
  complete; observed: on a file uploaded by a Journal Manager, the Author's row
  menu offers the same single action, but choosing it opens the "Edit a file"
  dialog holding only the message "The current role does not have access to
  this operation." — no fields, no Save; the same action on the Author's own
  file opens the normal form. The availability follows who uploaded the file;
  the menu does not say so. Proposed ledger row (pending).
- ⚠ **A file the Author uploaded can leave the package at the Author's hand,
  though this screen offers no Delete** (live-verified 2026-07-25, verification
  chunk c) — expected: the Author cannot remove a file from the editorial
  package, which is why their row menu offers no Delete; observed: the
  withholding is on this screen only — a deletion of a file the Author
  uploaded, arriving by a direct request outside the screen (no on-screen
  control offers it, so the case cannot be constructed manually), is carried
  out rather than refused, and the file is then absent from the package for
  every viewer, the editorial list included. The permissions table's row f states the screen and holds either
  way. Proposed ledger row (pending); intent is Open question 3.
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
- ⚠ **A desk decline is not enforced when the review decision is recorded** —
  expected: once a submission is declined at the desk, Revert Decline is the
  only decision available to anyone (rule 7); observed: a recommend-only
  Section Editor is still offered Send for Review and never Revert Decline, and
  for any assigned editor the decision — offered on screen or arriving by a
  direct request outside it — is recorded rather than refused; the submission then sits on Review,
  Round 1 while still marked Declined, a combination no other path produces
  (**ledger row 254**, owned by this feature; reproduced in this build
  2026-07-25, full drive included; scope widened after verification chunk c,
  which reached the same outcome with an ordinary assigned Section Editor —
  amendment clause proposed).
- ⚠ **A passed Submission stage stays writable** — expected reading of a stage
  the submission has left: a record of what came in; observed: only the decision
  buttons are withdrawn — upload, edit and delete stay offered and work, and a
  change made here is what everyone sees afterwards (rule 5; **ledger row 257**,
  owned by this feature, which extends row 220 and carries the intent question —
  formerly this spec's Open question 3). The upload and delete legs are
  live-probed in this build (batch C, 2026-07-24); the rename-persists leg
  re-probed in this build 2026-07-25 (maintenance batch B item 14) — the change
  shows to other viewers, the Author included.
- ⚠ **Deleting a submission leaves stored file-history entries behind — and
  writes one** (live-probed 2026-07-25, maintenance batch B item 12) —
  expected: rule 8's deletion removes the submission's stored records and adds
  none; observed: every submission-scoped record, the file store and the
  submission's own activity log are removed and no email is sent, but the
  history entries kept against the submission's files survive the deletion, and
  the deletion itself records a further file-deleted entry there naming the
  file, the submission and the acting user; no screen reaches the surviving
  entries afterwards. Proposed ledger row (pending).

## Open questions

1. The feature map's row for this feature mentions a *withdraw* option alongside
   the desk decline, but no withdraw affordance exists anywhere in the Submission
   stage's code (the nearest things are the desk decline and the manager-only
   Delete on a declined submission). Was withdraw a planned capability, or should
   the map drop the word?
2. An Author *can* edit the details of a submission file they themselves
   uploaded, after submitting — the full kind-dependent field set, and the
   change saves — confirmed live (see Known deviations). Is that intended? If
   yes, the spec should state it as a plain capability; if no, the Author
   should lose the action on this screen.
3. An Author *can* remove a file they themselves uploaded from the submission
   package, although this screen offers them no Delete — confirmed live (see
   Known deviations). The availability follows who uploaded the file, the same
   uploader-scoped rule behind Open question 2. Is that intended, or should
   removal be editorial-only wherever it is requested?

---

<!-- REFERENCE MATERIAL — provenance and campaign bookkeeping, not product-owner
     narrative. -->

## Reference — entry points & surfaces

| Entry | Path | Atom |
|-------|------|------|
| Submission-stage workspace | Dashboard → submission workflow → "Submission" menu entry (shell op `workflow/index/{id}/1`, owned by workflow-stage-navigation) | PAGE-workflow-submission (stays with workflow-stage-navigation) |
| Submission Files panel | FileManager namespace SUBMISSION_FILES (fileStage 2), files fetched from `GET api/v1/submissions/{id}/files?fileStages=2` | VUE-file-manager, the submission-files grid atoms (stay with submission-files) |
| Upload dialog | legacy `wizard.fileUpload.FileUploadWizardHandler` op startWizard (stageId 1, fileStage 2) | GRID-lib-pkp-wizard-file-upload-file-upload-wizard-handler (stays with submission-files) |
| File details / delete | legacy `api.file.ManageFileApiHandler` ops editMetadata / deleteFile | — (submission-files) |
| File notes & history | legacy `informationCenter.FileInformationCenterHandler` op viewInformationCenter | — (editorial-activity-log / submission-files) |
| Download-all archive | legacy `api.file.FileApiHandler` op downloadAllFiles | — (submission-files) |
| Text-editor handoff | file row action → WorkflowVersionDialogBody (mode sendToTextEditor) → Body Text editor with PandocConverter import | — (body-text/publication feature) |
| Decision buttons | availableEditorialDecisions payload → decision wizard (editorial-decisions) | PAGE-decision-record (editorial-decisions) |
| Delete submission | action-column "Delete" on a desk-declined submission → `DELETE api/v1/_submissions/{submissionId}` (useWorkflowActions.js workflowDeleteSubmission; the UI sends POST + `X-Http-Method-Override: DELETE`) | API-backend-submissions-delete (claimed here; atlas owner column still reads submission-drafts — edit proposed) |
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
  submission-stage decision roster (referenced; owned by editorial-decisions);
  its isOnlyRecommending short-circuit ahead of the declined-status test is
  ledger row 254
- lib/pkp/api/v1/_submissions/PKPBackendSubmissionsController.php delete() +
  lib/pkp/classes/submission/Repository.php delete()/canCurrentUserDelete() —
  the submission Delete of rule 8 (API-backend-submissions-delete)
- lib/pkp/api/v1/submissions/PKPSubmissionController.php getGroupRoutes() —
  the GET-route role list behind the Site-Administrator baseline (no
  ROLE_ID_SITE_ADMIN entry)
- lib/ui-library/src/pages/workflow/composables/useWorkflowActions.js
  workflowDeleteSubmission() — the Delete confirmation dialog and panel close
- lib/ui-library/src/managers/FileManager/modals/useFileMetadataForm.js — the
  Edit-a-file dialog's field set (name always; further fields per genre
  category)
- pages/workflow/WorkflowHandler.php + lib/pkp/pages/workflow/PKPWorkflowHandler.php
  — page ops (owned by workflow-stage-navigation)
- schemas/submission.json — OJS-specific submission props (SCHEMA-submission-ojs)
- lib/pkp/classes/observers/listeners/LogSubmissionSubmitted.php —
  EVLOG-SUBM-SUBMIT (owned by submission-wizard)
