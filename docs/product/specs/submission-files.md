---
name: submission-files
scope: The file-management machinery every editorial stage shares — the Vue FileManager (list, upload, edit metadata, revise, delete, download files per stage), the multi-step upload wizard, file revisions, dependent files, the file genres in use, non-ASCII filenames, single + download-all downloads, and the file attacher that pins existing or freshly-uploaded files onto emails and discussions
shared: pkp-lib          # the FileManager/FileAttacher managers, the submission-file model/DAO/schema, the upload wizard, the submission-file access policies and the file event-log all live in lib/pkp + lib/ui-library; OJS adds no submission-file override (it reuses the shared machinery as-is)
status: verified
e2e-plans: [submission-files]
atlas-claims:
  - VUE-file-manager
  - VUE-file-attacher
  - VUE-submission-files-list-panel
  - VUE-listing-files-list-panel
  - DB-submission_files
  - DB-submission_file_revisions
  - DB-submission_file_settings
  - DB-files
  - DB-temporary_files
  - SCHEMA-submission-file
  - FORM-pkp-submission-file-form
  - API-submission-file-get-many
  - API-submission-file-get
  - API-submission-file-add
  - API-submission-file-edit
  - API-submission-file-delete
  - API-submission-file-copy
  - API-temporary-files-upload-file
  - EVLOG-FILE-UPLOAD
  - EVLOG-FILE-REV-UP
  - EVLOG-FILE-EDIT
  - EVLOG-FILE-DELETE
  - AUTHZ-submission-file-access-policy
  - AUTHZ-submission-file-base-access-policy
  - AUTHZ-submission-file-assigned-query-access-policy
  - AUTHZ-submission-file-assigned-reviewer-access-policy
  - AUTHZ-submission-file-author-editor-policy
  - AUTHZ-submission-file-matches-submission-policy
  - AUTHZ-submission-file-matches-workflow-stage-id-policy
  - AUTHZ-submission-file-not-query-access-policy
  - AUTHZ-submission-file-requested-revision-required-policy
  - AUTHZ-submission-file-stage-access-policy
  - AUTHZ-submission-file-stage-required-policy
  - AUTHZ-submission-file-uploader-access-policy
  - AUTHZ-attach-file-upload-header
  - GRID-lib-pkp-grid-files-dependent-dependent-files-grid-handler
  - GRID-lib-pkp-grid-files-file-list-file-list-grid-handler
  - GRID-lib-pkp-grid-files-file-list-selectable-file-list-grid-handler
  - GRID-lib-pkp-grid-files-selectable-submission-file-list-category-grid-handler
  - GRID-lib-pkp-grid-files-submission-files-grid-handler
---

# Submission files (the cross-stage file-management machinery)

## Purpose

Every editorial stage is, at heart, a **file exchange**: the author uploads a manuscript, an
editor promotes it into review, reviewers get files to read, the author uploads revisions, a
copyeditor produces clean files, a layout editor turns them into galleys. This spec owns the
**shared machinery** all of that runs on — one component, one entity, one API, reused at every
stage. Concretely: the **Vue FileManager** grid a role sees on a stage (list files, upload a
new one, upload a **revision** of an existing one, edit a file's metadata, delete it, view its
notes/history, download one or all); the **multi-step upload wizard** (choose file + genre →
edit metadata → confirm) that the FileManager launches; **dependent files** (an image an HTML
manuscript loads); the **genres** a file carries (Article Text, Data Set…); **non-ASCII
filenames**; **downloads** (single + Download All); and the **file attacher** that lets an
editor pin an existing workflow file — or upload a fresh one — onto an email or a discussion.
It also owns the file **data model** (`submission_files` + revisions + settings, the physical
`files` store, `temporary_files`), the submission-file **schema**, the file **access policies**,
and the file **event-log** entries. What it does **not** own is *where* each file panel sits or
*which* files carry between stages — every stage-workspace spec (`send-to-review`,
`copyediting-stage`, `production-stage`, `review-rounds-and-revisions`) owns its own panels and
the promote-files decisions; this spec is the home for the file mechanics they all invoke.

## Actors & permissions

The FileManager runs a **per-namespace permission model**: each file-stage panel (namespace) declares,
for each capability, which roles may perform it, and the capability is offered only if the viewer
**holds one of those roles as a stage assignment on the submission's current stage**
(`hasCurrentUserAtLeastOneAssignedRoleInStage`). The site-wide baseline (owned by
`workflow-stage-navigation`): an **unassigned journal manager / site admin** gets *manager scope*
on every stage via the global-role fallback, so they satisfy the MANAGER/SITE_ADMIN branch
everywhere; an **assigned editor/assistant** satisfies it only on the stages their group covers;
an **author** satisfies only the ROLE_ID_AUTHOR branch on their own submission; a **reviewer** is
**not** a role in any FileManager namespace and reaches submission files only through the separate
reviewer file surfaces (owned by `reviewer-response`). "Editorial roles" below = sub-editor /
manager / site-admin / assistant. The backend is the source of truth: the REST files endpoint and
the file access policies enforce the same stage-assignment gate the UI reads, verified live on
`publicknowledge` (sub 236, 2026-07-04). <sup>a</sup>

| Action | Who may — and when |
|--------|--------------------|
| **See / list the files in a stage panel** | • Editorial roles with access to that stage — every namespace<br>• Authors — only on the panels that grant them `FILE_LIST`: **Submission Files**, **Review Revisions** (their own uploads), **Copyedited Files** (list-only, the author-check); **never** Files-for-Review, Draft Files or Production-Ready Files<br>• Reviewers — never through this surface (denied the general files endpoint — verified: reviewer jjanssen → *roleBasedAccessDenied*) <sup>b</sup> |
| **Download one file / Download All** | • Anyone who can list the panel — each row exposes a download link; **Download All** (a zip of the panel) appears when the panel grants `FILE_DOWNLOAD_ALL` and holds ≥1 file — the **Submission Files** (editorial *and* author) and **Production-Ready Files** (editorial) panels grant it; the **Review-Revision** panel does **not** (no `FILE_DOWNLOAD_ALL` in its config, so it never shows Download All) <sup>c</sup> |
| **Upload a new file** (opens the upload wizard) | • Editorial roles — on the panels that grant `FILE_UPLOAD` (Submission Files, Review Revisions, Production Ready Files)<br>• Authors — **only Review Revisions** (their revised-manuscript panel); authors may **not** add files to Submission Files after submitting<br>• On the copyedit / draft / files-for-review panels the "add" affordance is **Select/Upload** instead (next row) <sup>d</sup> |
| **Upload a revision of an existing file** | • The same roles that may Upload in that panel — the wizard's first step offers "this file is a revision of an existing file", replacing the chosen file's content (same file row, new revision) <sup>e</sup> |
| **Edit a file's metadata** (Update File) | • Editorial roles — every namespace that grants `FILE_EDIT`<br>• Authors — on Submission Files and Review Revisions (they may correct their own uploads' metadata); **not** on Copyedited Files (list-only) <sup>f</sup> |
| **Delete a file** | • Editorial roles — every namespace that grants `FILE_DELETE`<br>• Authors — **only Review Revisions**; authors get no delete on Submission or Copyedited files <sup>g</sup> |
| **Select files from prior stages** (into a copyedit / draft / review / production panel) | • Editorial roles only — the "Select Files" grid copies existing submission files into the target stage; **authors never** <sup>h</sup> |
| **Send to Text Editor** (import a file into the Body-Text editor) | • **Journal managers / site admins only**, and only on pandoc-convertible files (docx/odt/rtf/tex/latex/md/markdown) — never on a PDF; offered wherever `FILE_SEND_TO_EDITOR` is granted <sup>i</sup> |
| **View a file's notes / history** (More Information) | • Any role the panel grants `FILE_SEE_NOTES` — editorial roles on all workflow panels; opens the file's Information Center (notes + event history) <sup>j</sup> |
| **Attach a file to an email / discussion** (file attacher) | • **Upload a new file** — anyone composing the message (staged to temporary files)<br>• **Attach an existing workflow file** — only a user with an editorial-role stage assignment on the submission; the picker lists the submission's files by stage <sup>k</sup> |

<sup>a</sup> useFileManagerConfig.js `getManagerConfig()` (`config.actions.filter` on `hasCurrentUserAtLeastOneAssignedRoleInStage`); PKPSubmissionFileController::authorize()/getMany() (stage-assignment gate + manager/admin fallback); SubmissionFileAccessPolicy; live 2026-07-04 sub 236 ·
<sup>b</sup> `FileManagerConfigurations.*.permissions` (`FILE_LIST` grants); PKPSubmissionFileController::getMany() (`getAssignedFileStages`; REVIEWER not in the route roles) — live: dbarnes/atester → 200 (itemsMax 1), jjanssen → 401 `user.authorization.roleBasedAccessDenied` ·
<sup>c</sup> `FILE_DOWNLOAD_ALL` grants — SUBMISSION_FILES (editorial + author) and PRODUCTION_READY_FILES (editorial); **not** WORKFLOW_REVIEW_REVISIONS (its config carries no `FILE_DOWNLOAD_ALL`, so `getBottomItems` never emits the button); useFileManagerActions `fileDownloadAll` (`api.file.FileApiHandler::downloadAllFiles`); per-row `url` from the schema map ·
<sup>d</sup> `FILE_UPLOAD` grants (SUBMISSION_FILES author+editorial; WORKFLOW_REVIEW_REVISIONS author+editorial; PRODUCTION_READY_FILES editorial); useFileManagerActions `fileUpload` (`wizard.fileUpload.FileUploadWizardHandler::startWizard`) ·
<sup>e</sup> FileUploadWizardHandler (`revisedFileId`/`revisionOnly`); SubmissionFilesUploadForm; Repository::edit() (new `fileId` → revision) ·
<sup>f</sup> `FILE_EDIT` grants; useFileManagerActions `fileEdit` (`api.file.ManageFileApiHandler::editMetadata`) ·
<sup>g</sup> `FILE_DELETE` grants; useFileManagerActions `fileDelete` (`api.file.ManageFileApiHandler::deleteFile`) ·
<sup>h</sup> `FILE_SELECT_UPLOAD`/`*_SELECT` namespaces (EDITOR_REVIEW_FILES, COPYEDITED_FILES, FINAL_DRAFT_FILES, PRODUCTION_READY_FILES); useFileManagerActions `fileSelectUpload` (`gridComponent::selectFiles`) ·
<sup>i</sup> `FILE_SEND_TO_EDITOR` granted only to SITE_ADMIN/MANAGER; `PANDOC_IMPORT_EXTENSIONS` gate in `getItemActions` ·
<sup>j</sup> `FILE_SEE_NOTES`; useFileManagerActions `fileSeeNotes` (`informationCenter.FileInformationCenterHandler::viewInformationCenter`) ·
<sup>k</sup> useDiscussionMessages.js `fileAttachers` (FileAttacherUpload always; FileAttacherWorkflowStage only if `hasCurrentUserAtLeastOneAssignedRoleInAnyStage(EditorialRoles)`); Composer additionally offers FileAttacherReviewFiles / FileAttacherLibrary

## Fields & validation

The upload wizard's two forms (**Upload** then **Metadata**), plus the per-file **Update File**
modal, are what a user fills. Fields the uploader sees on-screen:

| Field (UI label) | Required? | Rules | Anchor |
|------------------|-----------|-------|--------|
| **File** (the upload / drag-drop) | Yes | The document itself; sent as multipart. The original filename is preserved verbatim as the display **name** (any Unicode); the file on disk is renamed to a `uniqid().ext` path so the display name never touches the filesystem. A missing upload → "No file was uploaded"; a rejected type → upload error | PKPSubmissionFileController::add() (`$_FILES['file']`, `uniqid().'.'.$extension`); SubmissionFilesUploadForm |
| **Component / Type** (genre) | Yes | The genre the file is (Article Text, Data Set, Other…); the journal's genre set (Settings → Workflow → Components). **Auto-set** when the journal has exactly one enabled genre; otherwise the user picks | PKPSubmissionFileController::add() (single-genre auto-set); `getFileGenres()` |
| **"This is a revision of an existing file"** | No | On Upload, the user may mark the file as a **revision** of a listed file — replacing that file's content instead of adding a new file row (rule 4) | FileUploadWizardHandler (`revisedFileId`); fileUploadForm.tpl |
| **Name** (edit metadata) | No | The display name, editable and **multilingual**; defaults to the uploaded filename | `submissionFile.json` (`name`: multilingual, nullable) |
| **Summary of changes** | No | Free-text "what changed"; **only shown/persisted on review-revision uploads** (feeds `publication-amendments`) | `submissionFile.json` (`summaryOfChanges`); SubmissionFilesMetadataForm (review-revision stages only) |
| **Article-component metadata** (Language, Description; and for supplementary/artwork genres: Creator, Publisher, Source, Subject, Sponsor, Date created; Caption, Credit, Copyright owner, Terms) | No | Optional descriptive metadata, surfaced by genre category — supplementary genres show dataset fields, artwork genres show image fields; most are multilingual | `submissionFile.json` (creator/publisher/source/subject/sponsor/dateCreated/language/caption/credit/copyrightOwner/terms) |

Server-set fields not shown to the user (provenance only): `fileStage` (the panel's stage,
constrained to a fixed allow-list), `fileId` (the physical file), `submissionId`,
`uploaderUserId`, `assocType`/`assocId` (dependent-file / review-round / galley association),
`sourceSubmissionFileId` (set when a file is promoted from another stage), `genreMetadataType` /
`genreIsDependent` / `genreIsSupplementary` (derived from the genre), `viewable`.

## Rules & state

File stages by name, from `SubmissionFile::SUBMISSION_FILE_*`: **Submission**(2) · **Review
File**(4, files-for-review) · **Review Attachment**(5) · **Draft/Final**(6) · **Copyedit**(9) ·
**Proof**(10) · **Production Ready**(11) · **Attachment**(13, email) · **Review Revision**(15) ·
**Dependent**(17) · **Query**(18, discussion) · **JATS**(21) · **Body Text**(22) · **Media**(23).
Each FileManager namespace binds to one stage. <sup>a</sup>

### 1. The Vue FileManager is the live file surface; the legacy grids are superseded

The file panel a role sees at any stage is the **Vue `FileManager`** component
(`managers/FileManager`), mounted per stage in the workflow config under a **namespace**
(`SUBMISSION_FILES`, `EDITOR_REVIEW_FILES`, `WORKFLOW_REVIEW_REVISIONS`, `COPYEDITED_FILES`,
`FINAL_DRAFT_FILES`, `PRODUCTION_READY_FILES`). It renders a small table — number, **File Name**,
**Date Uploaded**, **Type** (genre), and a per-row more-actions menu — plus top **Upload** /
**Select-Upload** buttons and a bottom **Download All Files** link. Its data source is the REST
files endpoint (`GET submissions/{id}/files?fileStages=`), so listing is pure Vue+API; the
**mutations open legacy modals** (upload → `FileUploadWizardHandler`, edit → `ManageFileApiHandler`,
delete → `ManageFileApiHandler`, notes → `FileInformationCenterHandler`, download-all →
`FileApiHandler`, select → the namespace's `gridComponent`). The old **concrete per-stage** file
grid handlers (`EditorSubmissionDetailsFilesGridHandler`, `AuthorSubmissionDetailsFilesGridHandler`,
`WorkflowReviewRevisionsGridHandler`, `AuthorReviewRevisionsGridHandler`,
`ProductionReadyFilesGridHandler`, the author-dashboard attachment grids) are **UI-orphaned** — the
live `SUBMISSION_FILES` / `WORKFLOW_REVIEW_REVISIONS` / `PRODUCTION_READY_FILES` configs carry **no
`gridComponent`**, and nothing else renders those handlers (verified 2026-07-04: three have zero
references outside their own class; the two `Author*` grids are reached only from dead
author-dashboard templates — an orphan include and an unimplemented `reviewRoundInfo` op — recorded
in `UNASSIGNED.md` §Dead-code candidates, superseded by `VUE-file-manager`). Their shared **base**
`SubmissionFilesGridHandler` is *not* dead — it is never rendered on its own but is still reached
transitively by the live grids below (claimed here as file-grid base machinery, OQ2).
The only legacy grids still live are the **Select-Files** select-grids (`CopyeditFilesGridHandler`,
`FinalDraftFilesGridHandler`, `EditorReviewFilesGridHandler`, `Manage*FilesGridHandler`, owned by
the stage specs) and `DependentFilesGridHandler` (rule 6). This spec documents the live Vue
surface; the legacy list-grids stay superseded. <sup>b</sup>

### 2. One entity, many stages — the file-stage vocabulary

A file is one `submission_files` row carrying a **`fileStage`** (which panel it belongs to), a
**`genreId`**, a **`fileId`** (its current physical file), and — when it belongs to a round, a
galley, a parent file, or an email/discussion — an **`assocType`/`assocId`**. The same entity,
schema, API and FileManager serve every stage; a file "moves" between stages only by being
**copied** to a new stage (rule 10), never re-stamped. The REST endpoint refuses to list or write
the non-workflow stages — **Note**(3), **Review Attachment**(5), **Query**(18) can never be
uploaded through the general files API (they belong to discussions / reviewer attachments), and
the read allow-list is further narrowed to the stages the viewer's assignments grant
(`getAssignedFileStages`). Verified live: sub 236's file is `fileStage` 2, `genreId` 1
(Article Text), served identically to editor and author. Two read-shape details worth pinning
(both confirmed live on sub 478, 2026-07-04): (i) the **single-file** read `GET …/files/{fileId}`
additionally requires a **`?stageId=`** query param equal to the file's own workflow stage — the
access policy resolves the file's stage and returns **401 `roleBasedAccessDenied`** on a missing or
mismatched `stageId` (a Submission-stage file needs `stageId=1`); (ii) the single GET returns the
**full** property map — including the read-only **`revisions`** and **`dependentFiles`** arrays —
whereas the list `getMany` returns only summarized props, so `revisions`/`dependentFiles` are
**absent from the list** and can be read only per file. <sup>c</sup>

### 3. The upload wizard: choose file + genre → metadata → confirm

Clicking **Upload** opens the legacy **file-upload wizard** in a modal
(`FileUploadWizardHandler::startWizard`), a three-step flow: **(1) Upload** — drag/drop the file
and pick its **genre** (`SubmissionFilesUploadForm`; genre auto-selected when only one exists;
`uploadFile` stores the physical file and creates the `submission_files` row via
`Repo::submissionFile()->add()`); **(2) Metadata** — edit name and the genre-appropriate metadata
(`SubmissionFilesMetadataForm`); **(3) Confirm** — `finishFileSubmission` closes the modal and the
Vue panel re-fetches. The wizard is passed the panel's `fileStage`, the `submissionId`, the
`stageId`, and (for review panels) the `reviewRoundId`. Note this workflow upload writes **directly**
to the `files` + `submission_files` store — it does **not** stage through `temporary_files` (temp
files are the attacher/public-upload path, rules 11 + Settings). The **REST** `POST
submissions/{id}/files` is the same create, used by the submission-wizard file step and by
programmatic callers. <sup>d</sup>

### 4. A revision replaces a file's content in place (same file row, new revision)

Uploading is not the only way to add content: the wizard's Upload step offers **"this file is a
revision of an existing file"**, letting the user replace a listed file's contents. When a file is
uploaded as a revision (`revisedFileId`), the existing `submission_files` row is kept — its
`fileId` is pointed at the new physical file and a new **`submission_file_revisions`** row is
appended. **Every** add/replace writes exactly one such row — `DAO::insert()` always inserts a
`submission_file_revisions` row for the file's current `fileId` — so even a **brand-new** file
(scenario-seeded *or* freshly uploaded through the wizard) carries **one** revision row. The API's
read-only **`revisions`** array is the file's list of **prior/superseded** revisions only: the
`Schema` map **skips the revision whose `fileId` is current** (`if ($revision->fileId === …) continue`).
Consequently a single-revision file reports **`revisions: []`** (length 0) — there is no
seed-vs-real-upload difference — and the array first becomes non-empty (length 1) after a revision
replaces the content, listing the now-superseded prior file. The prior revision's physical file is
retained until the file is deleted. On a **review-revision**
stage the revision upload also carries the **Summary of changes** field, recomputes the round
status (REVISIONS_REQUESTED → REVISIONS_SUBMITTED) and clears the author's pending-revisions task —
those round effects are owned by `review-rounds-and-revisions`; this spec owns the revision
mechanics (same row, new revision, version list). Verified live (sub 478, 2026-07-04): a
freshly-seeded Submission file has exactly **one** `submission_file_revisions` DB row, yet its
single-GET `revisions` projection is **`[]`** (the current revision is filtered out); the retained
`submission-files.spec.js` then drives a real wizard revision upload and asserts the array grows
(0 → 1). <sup>e</sup>

### 5. Editing metadata vs replacing the file

The per-row **Update File** action opens the metadata modal (`ManageFileApiHandler::editMetadata`).
`Repository::edit()` distinguishes two cases by whether the request carries a **new `fileId`**: a
pure metadata change writes a **File-edited** event; supplying a new file makes it a **revision**
(same as rule 4, a **Revision-uploaded** event). So a file's content and its metadata are edited
through the same form, and only a content replacement bumps the revision history. <sup>f</sup>

### 6. Dependent files — files attached to another file

A file may carry **dependent files** — typically images or media an HTML manuscript loads. A
dependent is an ordinary `submission_files` row at **`fileStage` Dependent**(17) whose
`assocType` = ASSOC_TYPE_SUBMISSION_FILE and `assocId` = the **parent** file; it is uploaded
through the same wizard (launched with the parent as assoc), never listed as a top-level stage
file, and surfaces in the parent's read-only **`dependentFiles`** array (schema) and in the legacy
`DependentFilesGridHandler` (still live — rendered both from the galley form, `articleGalleyForm.tpl`,
and from the **Edit-a-file metadata modal**, `submissionFileMetadataForm.tpl`, which is the path the
retained test drives; the grid appears only for html/xml parents via `Repo::supportsDependentFiles`)
or the read-only `ListingFilesListPanel`. Deleting the parent **cascade-deletes** its dependents (rule 12). The
dependent-file *editing UI* at publication lives in `media-files` (feature 27) and `galleys`
(feature 26); this spec owns the dependent-file mechanics (assoc, schema projection, cascade). <sup>g</sup>

### 7. Every file carries a genre (Type); genre config lives in workflow-settings

The **Type** column and the wizard's component picker are the file's **genre** — the
submission-component taxonomy (Article Text, Data Set, Other, and supplementary/artwork genres).
The genre *set* is configured per journal in **Settings → Workflow → Components**
(owned by `workflow-settings`); this spec owns **using** genres: the read lookup that fills the
Type column and the picker (`GET /genres`), the single-genre auto-select on upload, and the
genre-driven metadata fields (dependent vs supplementary vs artwork categories change which
metadata the wizard shows). `genreName` is returned as a locale map. <sup>h</sup>

### 8. Non-ASCII filenames round-trip; the disk name is always ASCII-safe

The uploaded filename is stored verbatim as the multilingual **`name`** (Unicode preserved), while
the **physical** file is written to a `uniqid().extension` path — so a name like
`Édition £ 丹尼爾 & دانيال.pdf` never reaches the filesystem and cannot break it. On download the
name is re-attached via an RFC 5987 `Content-Disposition: filename*=UTF-8''…` header, so the
reader gets the original name back. This decoupling (display name ≠ disk name) is what makes
non-ASCII, punctuation and multilingual names safe. Live-tested by the retained
`filenames.spec.js` (an `Édition £ 丹尼爾 & دانيال` upload round-trips through upload, list and the
download header). <sup>i</sup>

### 9. Downloads — one file or the whole panel

Each listed file exposes a **download URL** (`url` in the schema map) for a single download.
**Download All Files** (bottom of a panel that grants it and holds ≥1 file) streams a **zip** of
that stage's files (`FileApiHandler::downloadAllFiles`, named from the panel's title). Both are
gated by the same read access as listing. <sup>j</sup>

### 10. Files move between stages by copy, not re-stamp

A file is carried into another stage by **copying** it: `Repository::copy()` clones the row with a
new `fileStage`, records the origin in **`sourceSubmissionFileId`**, and (for a review stage)
re-associates it to the target round. The **decisions** that trigger these copies — Send for
Review (submission→review file), Accept (review-revision→draft), Send to Production
(copyedit/draft→production-ready) — are owned by `editorial-decisions` and surfaced per stage by
the workspace specs; this spec owns the copy mechanic and the `sourceSubmissionFileId` lineage. <sup>k</sup>

### 11. The file attacher pins files onto emails and discussions

When composing an email (decision notifications, discussions) the **`FileAttacher`** offers a set
of attach sources as action panels: **Upload** a new file (staged to **`temporary_files`** via
`POST /temporaryFiles`, then promoted to a submission file when the message is sent),
**Workflow-stage** files (attach an existing submission file — offered only to editorial-role
assignees), and in the email composer also **Review files** and **Library** documents. The
attacher returns the chosen files to the composer/discussion, which persists them as
attachment-stage files (Attachment(13) for emails, Query(18) for discussions) when sent. This spec
owns the attacher component + the temporary-file upload plumbing; the compose/discussion flows that
host it are owned by `email-delivery` / `tasks-discussions`. <sup>l</sup>

### 12. Deleting a file cascades and de-duplicates the physical store

Deleting a file (`Repository::delete()`) **cascade-deletes its dependent files** and its notes,
removes its `submission_file_revisions`, and then deletes each underlying **physical** file **only
if no other submission file still references it** (files are de-duplicated across rows, e.g. after
a promote-copy, so a shared physical file survives until its last referrer is gone). On a
review-revision or copyedit delete it also recomputes the relevant round/editing notifications.
There is no soft-delete/undo — deletion is immediate. <sup>m</sup>

### 13. The two file **list panels** are live, read-mostly surfaces

Beyond the FileManager, two ListPanel components are live: **`SubmissionFilesListPanel`** — the
**submission-wizard** file-upload step (list + upload + edit + a selection checkbox; the author's
upload window during submission; hosted by `submission-wizard`, mechanics owned here); and
**`ListingFilesListPanel`** — a **read-only** file listing reused where files are shown but not
managed (e.g. the reviewer's round-history modal). Both are live (confirmed by usage grep); the
FileManager is the primary in-workflow surface, the list panels the wizard/read-only ones. <sup>n</sup>

<sup>a</sup> SubmissionFile `SUBMISSION_FILE_*` constants ·
<sup>b</sup> FileManager.vue + fileManagerStore.js (REST list) + useFileManagerActions.js (legacy modals); useFileManagerConfig.js (namespaces; SUBMISSION_FILES/WORKFLOW_REVIEW_REVISIONS/PRODUCTION_READY_FILES have **no** `gridComponent`, while EDITOR_REVIEW_FILES/COPYEDITED_FILES/FINAL_DRAFT_FILES do — the live Select-grids); grids.md liveness (confirmed dead 2026-07-04: EditorSubmissionDetailsFiles/WorkflowReviewRevisions/ProductionReadyFiles grids have zero live references; the two Author* grids only from dead author-dashboard tpls); UNASSIGNED.md §Dead-code candidates ·
<sup>c</sup> submission_files schema; PKPSubmissionFileController::getMany() (`$allowedFileStages`, `getAssignedFileStages`, `summarizeMany`) + get() (`map` = full props) + add() (`$notAllowedFileStages` = NOTE/REVIEW_ATTACHMENT/QUERY); single-GET `?stageId=` gate: SubmissionFileAccessPolicy (`getUserVar('stageId')`) → `SubmissionFileMatchesWorkflowStageIdPolicy`; `revisions`/`dependentFiles` have no `apiSummary` flag in `submissionFile.json`; live sub 236 + sub 478 (single-GET no/mismatched `stageId` → 401) ·
<sup>d</sup> useFileManagerActions `fileUpload` → `wizard.fileUpload.FileUploadWizardHandler`; FileUploadWizardHandler::{startWizard,uploadFile,editMetadata,finishFileSubmission}; SubmissionFilesUploadForm::execute() (`Repo::submissionFile()->add()`); PKPSubmissionFileController::add() (REST create, direct `$_FILES`) ·
<sup>e</sup> FileUploadWizardHandler (`revisedFileId`/`getRevisionOnly`); `DAO::insert()` (always writes one `submission_file_revisions` row); `Schema::mapByProperties()` `revisions` branch (skips the current-`fileId` revision → prior-only); Repository::edit() (new `fileId` → SUBMISSION_LOG_FILE_REVISION_UPLOAD + `submission_file_revisions`); Repository::add() (review-revision → `ReviewRoundDAO::updateStatus` + pending-revisions notification); live sub 478 (seeded file `revisions: []`) ·
<sup>f</sup> useFileManagerActions `fileEdit` (`ManageFileApiHandler::editMetadata`); Repository::edit() (`$newFileUploaded = !empty($params['fileId']) && $params['fileId'] !== old`) ·
<sup>g</sup> SubmissionFile `SUBMISSION_FILE_DEPENDENT`; `dependentFiles` schema (readOnly); DependentFilesGridHandler (live via `articleGalleyForm.tpl:46` and `submissionFileMetadataForm.tpl:60`); `Repository::supportsDependentFiles()` (html/xml only); ListingFilesListPanel; Repository::delete() (dependent cascade) ·
<sup>h</sup> useFileManagerConfig `getFileGenres`; FileManagerCellType.vue; GenreController::{getMany,get}; PKPSubmissionFileController::add() (single-genre auto-set); genre config owned by `workflow-settings` ·
<sup>i</sup> PKPSubmissionFileController::add() (`uniqid().'.'.$extension`; `name` defaults to `$_FILES['file']['name']`); `submissionFile.json` `name` multilingual; retained `lib/pkp/playwright/tests/filenames.spec.js` ·
<sup>j</sup> useFileManagerActions `fileDownloadAll` (`api.file.FileApiHandler::downloadAllFiles`); `getBottomItems` (`FILE_DOWNLOAD_ALL` && filesCount); schema `url` ·
<sup>k</sup> Repository::copy() (`sourceSubmissionFileId`, re-assoc to round); promote steps owned by `editorial-decisions` ·
<sup>l</sup> FileAttacher.vue; useDiscussionMessages.js `fileAttachers`; PKPTemporaryFilesController::uploadFile() (`POST /temporaryFiles`); AttachFileUploadHeader middleware ·
<sup>m</sup> Repository::delete() (dependent + Note cascade; per-`fileId` share count before `app()->get('file')->delete`; review-revision/copyedit notification recompute) ·
<sup>n</sup> SubmissionFilesListPanel (submission/wizard.tpl + PKPSubmissionHandler::getSubmissionFilesListPanel); ListingFilesListPanel (reviewerSubmission/RoundHistoryModal.vue)

## Side effects

- **Event-log entries** (`SubmissionFileEventLogEntry`, surfaced in the submission Activity Log +
  the file Information Center):
  - **Upload** (`Repository::add()`) writes **two** entries — a **File-uploaded**
    (`SUBMISSION_LOG_FILE_UPLOAD`, assoc'd to the file) *and* a **Revision-uploaded**
    (`SUBMISSION_LOG_FILE_REVISION_UPLOAD`, assoc'd to the *submission*, message `fileRevised`),
    so the submission-level history records every file add as a file event. Verified live (sub 236:
    a `SUBMISSION_LOG_FILE_UPLOAD` "fileUploaded" row on the file **and** a
    `SUBMISSION_LOG_FILE_REVISION_UPLOAD` "fileRevised" row on the submission).
  - **Edit** (`Repository::edit()`) writes a **File-edited** (`SUBMISSION_LOG_FILE_EDIT`) — or a
    **Revision-uploaded** when the edit replaces the file — assoc'd to the **file**. ⚠ The paired
    submission-level entry is **built but never persisted** (see Known deviations), so metadata
    edits are missing from the submission Activity Log.
  - **Delete** (`Repository::delete()`) writes a **File-deleted** (`SUBMISSION_LOG_FILE_DELETE`)
    assoc'd to **both** the file and the submission.
- **Notifications**: a **review-revision** upload/delete recomputes the round status
  (`NOTIFICATION_TYPE_REVIEW_ROUND_STATUS`) and the author's **pending-revisions** task
  (`…PENDING_EXTERNAL_REVISIONS`; deletes it on upload) — owned by `review-rounds-and-revisions`; a
  **copyedit** file add/delete recomputes the editor's **Assign-copyeditor / Awaiting-copyedits**
  status prompt (owned by `copyediting-stage`). Uploading a review revision **as an author** also
  emails the assigned editors ("revisions uploaded"). No notification fires for a plain
  submission/production file add.
- **Data mutations**: `files` (physical store, de-duplicated on delete), `submission_files` (+
  `_revisions` version history, `_settings` metadata), `temporary_files` (attacher/public-upload
  staging, reaped by a scheduled task). Promote-copies write `sourceSubmissionFileId` lineage.
- **No emails** are sent by the file machinery itself except the author→editor revisions notice
  above; decision emails that *carry* file attachments are owned by `editorial-decisions` /
  `email-delivery`.

## Settings that modify behavior

- **Submission components / genres** (Settings → Workflow → Components) — defines the genre set,
  which genres are dependent/supplementary, and each genre's required-ness; owned by
  `workflow-settings`. This spec consumes them (rule 7).
- **Upload limits & storage** (`config.inc.php`) — `files_dir` (where physical files live),
  `umask`, and the PHP `upload_max_filesize` / `post_max_size` cap the upload; there is no
  per-journal file-size setting. `temporary_files` are swept by a scheduled task
  (`scheduled-tasks`).
- No setting changes the FileManager's per-namespace permission model or the upload wizard steps.

## Cross-feature interactions

- **send-to-review** — owns the stage-1 Submission Files panel + the promote-to-review file
  selection; consumes this spec's FileManager + copy mechanic.
- **review-rounds-and-revisions** — owns the round-scoped Review-Revision (author uploads) and
  Files-for-Review panels, the `review_round_files` artifact and the round-status effects of a
  revision upload; consumes the FileManager/wizard.
- **assign-and-manage-reviewers / reviewer-response** — own the reviewer's file surfaces
  (files-to-review, review attachments) that this spec's general endpoint deliberately excludes.
- **copyediting-stage** — owns the Draft Files + Copyedited Files panels (and their live
  `Final`/`Copyedit` select-grids); **production-stage** — owns Production Ready Files + the proof
  grid; both consume the FileManager and the file stages here.
- **submission-wizard** — hosts the `SubmissionFilesListPanel` file step (the author's upload
  window); mechanics owned here.
- **galleys** (feature 26) / **media-files** (feature 27) — own galley proof files and the
  publication Media tab (variant-linked supplementary/dependent files); this spec owns the shared
  submission-file model + dependent-file mechanics they build on (seam).
- **editorial-decisions** — owns the promote-files decision steps that copy files between stages.
- **tasks-discussions / email-delivery** — host the file attacher (this spec's `FileAttacher` +
  temporary-file plumbing) on discussions and emails.
- **editorial-activity-log** — owns the Activity Log / Information Center surface that renders the
  file event-log entries this spec fires.
- **workflow-settings** — owns the genre configuration; **publication-amendments** — consumes the
  review-revision `summaryOfChanges`.

## Canonical scenarios

1. **Upload a file through the wizard** — an editor opens a stage's file panel, clicks **Upload**,
   drops a document, picks its **Type** (genre), advances through the metadata step and confirms;
   the new file appears in the list with its name, upload date and genre, and a File-uploaded event
   lands in the submission's history (retained `submission-files.spec.js`).
2. **Upload a revision of an existing file** — a user uploads a new version and marks it "a
   revision of an existing file"; the same file row keeps its place, its content is replaced, and
   its revision history gains a version (no second row appears).
3. **Add a dependent file** — an editor uploads an HTML manuscript, then adds an image as a
   **dependent** of it; the image is not a top-level stage file but travels with the manuscript
   (and is deleted with it).
4. **Download all files** — with several files in a panel, a viewer clicks **Download All Files**
   and receives a zip of that stage's files; individual rows also offer single downloads.
5. **Non-ASCII filename round-trips** — an author uploads `Édition £ 丹尼爾 & دانيال.pdf`; the exact
   name shows in the list and the API, the genre sticks, and the download header carries the
   decodable UTF-8 filename (retained `filenames.spec.js`).
6. **Delete a file** — an editor deletes a file via the row menu and confirms; the file (and any
   dependents + notes) is removed, its physical file dropped unless another file still shares it,
   and a File-deleted event is logged.
7. **Edit a file's metadata** — a user opens **Update File**, renames it and fills genre-specific
   metadata (e.g. a dataset's creator/language); the list reflects the new name.
8. **Attach a file to a discussion / email** — composing a message, a user attaches an existing
   workflow file (or uploads a fresh one via the attacher); the file is pinned to the message and
   delivered as an attachment.
9. **Author's file boundary** — an author on their own submission can **list, download and edit**
   the Submission Files and **upload/edit/delete** their Review Revisions, but cannot add to or
   delete the Submission Files, and sees Copyedited Files **read-only** (verified live: atester
   lists sub 236's file).
10. **Reviewer boundary** — a reviewer never reaches the general file surface: the submission
    files endpoint refuses them (roleBasedAccessDenied), and they see only the files-to-review the
    reviewer surface grants (verified live: jjanssen → 401).

## Known deviations (as-built ≠ intent)

- ⚠ **A file-metadata edit is logged against the file but not the submission.** `Repository::edit()`
  writes the file-assoc event (`SUBMISSION_LOG_FILE_EDIT` / revision), then **builds a second,
  submission-assoc event object but never calls `Repo::eventLog()->add()` on it** (and the object
  carries an `isTranslate` typo instead of `isTranslated`) — unlike `add()` and `delete()`, which
  both persist the submission-level entry. Net effect: the submission's **Activity Log** shows file
  uploads and deletions but **not** metadata edits (the edit is visible only in that file's
  Information Center). Internally inconsistent with the sibling add/delete paths; low severity, no
  data loss. **Confirmed live** (sub 478, 2026-07-04): after a metadata rename, `event_log` held the
  file-assoc `SUBMISSION_LOG_FILE_EDIT` row but **no** submission-assoc edit row, while the upload's
  submission-assoc `fileRevised` row *was* present — the exact asymmetry above. Tracked as
  `docs/e2e/app-changes.md` row 85.

## Open questions

1. **Genre read-endpoint ownership (seam).** `GET /genres` (`API-genre-get-many` / `-get`) is the
   read lookup this spec uses for the Type column/picker, but the genre *config* CRUD belongs to a
   future `workflow-settings` spec. Left **referenced, not claimed** here; grooming should assign
   the genre endpoints to whichever spec owns the genre-config grid, with this spec citing them.
2. **Base file-grid classes claimed as shared machinery.** The base grid handlers
   (`FileListGridHandler`, `SelectableFileListGridHandler`, `SelectableSubmissionFileListCategoryGridHandler`,
   `SubmissionFilesGridHandler`) underpin the still-live Select-Files grids owned by the stage
   specs. Claimed here as the file-grid base machinery; if grooming prefers them parked as
   pure infrastructure, move accordingly.
3. **The public-file upload primitive is left unclaimed.** `POST /_uploadPublicFile`
   (`API-upload-public-file-upload-file`) shares the temporary-file plumbing but serves settings
   images (logos, covers, TinyMCE), not submission files — left for a settings/media home. This
   spec claims only the submission-file half (`/temporaryFiles` + the attach-file-upload header).
4. **"Revision uploaded" phrasing on an initial upload.** `add()` labels its submission-level entry
   `submission.event.fileRevised` even for a brand-new file (there is no prior revision). Intended
   ("every file event is a revision at the submission level") or should a first upload read
   "uploaded" at both levels?

---

## Reference — entry points & surfaces

| Entry | Path | Atom |
|-------|------|------|
| The file panel (any stage) | Workflow pane → a stage's file grid (Vue `FileManager`, namespace per stage) | VUE-file-manager |
| List / read files | `GET api/v1/submissions/{id}/files[?fileStages=&reviewRoundIds=]` (summarized props); `GET …/files/{fileId}?stageId=` (full props incl. `revisions`/`dependentFiles`; `stageId` **required** — must match the file's workflow stage or 401) | API-submission-file-get-many, API-submission-file-get |
| Upload / edit / delete / copy file | `POST/PUT/DELETE api/v1/submissions/{id}/files[/{fileId}]`; `PUT …/{fileId}/copy` | API-submission-file-add, -edit, -delete, -copy |
| Upload wizard (modal) | `wizard.fileUpload.FileUploadWizardHandler::startWizard` (upload → metadata → confirm) | *(legacy handler — FileManager action)* |
| Edit / delete / notes (modals) | `api.file.ManageFileApiHandler::{editMetadata,deleteFile}`; `informationCenter.FileInformationCenterHandler` | FORM-pkp-submission-file-form *(edit form)* |
| Download one / all | file `url`; `api.file.FileApiHandler::downloadAllFiles` (zip) | *(file-api handler)* |
| Attach to email / discussion | `FileAttacher` (Upload → `POST api/v1/temporaryFiles`; Workflow-stage / Review / Library) | VUE-file-attacher, API-temporary-files-upload-file |
| Wizard file step / read-only listing | `SubmissionFilesListPanel` (submission wizard); `ListingFilesListPanel` (round history) | VUE-submission-files-list-panel, VUE-listing-files-list-panel |
| File entity / schema | `submission_files` (+ `_revisions`, `_settings`), `files`, `temporary_files`; `schemas/submissionFile.json` | DB-submission_files, DB-submission_file_revisions, DB-submission_file_settings, DB-files, DB-temporary_files, SCHEMA-submission-file |
| Dependent files grid | `grid.files.dependent.DependentFilesGridHandler` (galley form) | GRID-lib-pkp-grid-files-dependent-dependent-files-grid-handler |
| File access policies | `SubmissionFileAccessPolicy` + internals; `SubmissionFileStageAccessPolicy`; `AttachFileUploadHeader` | AUTHZ-submission-file-access-policy (+ 11 internal policies), AUTHZ-attach-file-upload-header |
| File event log | `SUBMISSION_LOG_FILE_{UPLOAD,REVISION_UPLOAD,EDIT,DELETE}` | EVLOG-FILE-UPLOAD, -REV-UP, -EDIT, -DELETE |

## Reference — code anchors

- **Vue FileManager**: `lib/ui-library/src/managers/FileManager/` — `FileManager.vue`,
  `fileManagerStore.js` (REST list from `submissions/{id}/files`), `useFileManagerConfig.js`
  (`FileManagerConfigurations` namespaces + per-role `permissions`/`actions`, `getManagerConfig`
  stage-assignment gate, `getColumns`/`getTopItems`/`getBottomItems`/`getItemActions`),
  `useFileManagerActions.js` (`Actions` + the legacy-modal launchers: upload wizard, edit-metadata,
  delete, notes, download-all, send-to-editor).
- **File attacher**: `lib/ui-library/src/components/FileAttacher/` (`FileAttacher.vue` +
  `FileAttacherUpload/WorkflowStage/ReviewFiles/Library` variants);
  `lib/ui-library/src/managers/DiscussionManager/useDiscussionMessages.js` (`fileAttachers`);
  `lib/ui-library/src/components/Composer/` (email composer host).
- **List panels**: `.../components/ListPanel/submissionFiles/SubmissionFilesListPanel.vue`
  (wizard step; `lib/pkp/pages/submission/PKPSubmissionHandler.php::getSubmissionFilesListPanel`);
  `.../components/ListPanel/listingFiles/ListingFilesListPanel.vue` (read-only listing;
  `.../pages/reviewerSubmission/RoundHistoryModal.vue`).
- **Entity / model / DAO / repo**: `lib/pkp/classes/submissionFile/` — `SubmissionFile.php`
  (`SUBMISSION_FILE_*` constants), `Repository.php` (`add`/`edit`/`copy`/`delete` + the file
  event-log writes, dependent cascade, physical de-dup, revision handling, `getAssignedFileStages`),
  `DAO.php` (`insertReviewRound`); `schemas/submissionFile.json` (`SCHEMA-submission-file`).
- **REST + upload wizard**: `lib/pkp/api/v1/submissions/PKPSubmissionFileController.php`
  (`authorize`, `getMany` allow-list, `add` upload + single-genre auto-set, `edit`, `copy`,
  `delete`); `lib/pkp/controllers/wizard/fileUpload/FileUploadWizardHandler.php`
  (`startWizard`/`uploadFile`/`editMetadata`/`finishFileSubmission`, `revisedFileId`) +
  `form/SubmissionFilesUploadForm.php` + `form/SubmissionFilesMetadataForm.php`
  (`summaryOfChanges` on review-revision stages); `lib/pkp/api/v1/temporaryFiles/PKPTemporaryFilesController.php`.
- **Access policies**: `lib/pkp/classes/security/authorization/SubmissionFileAccessPolicy.php`
  + `internal/SubmissionFile{Base,Stage,StageRequired,MatchesSubmission,MatchesWorkflowStageId,AssignedQuery,AssignedReviewer,AuthorEditor,NotQuery,RequestedRevisionRequired,Uploader}*Policy.php`;
  `lib/pkp/classes/middleware/AttachFileUploadHeader.php`.
- **Event log**: `lib/pkp/classes/log/event/SubmissionFileEventLogEntry.php`
  (`SUBMISSION_LOG_FILE_UPLOAD/REVISION_UPLOAD/EDIT/DELETE`).
