---
name: document-library
scope: The Document Library — reusable, non-scholarly documents (review templates, marketing/permissions forms, reports) held at two levels: the journal-wide context library managed in Settings, and the per-submission library reached from the workflow Library button
shared: pkp-lib          # LibraryFile model/DAO/manager, the library-file grids + forms, the DocumentLibrary modal, the `_library` API and the libraryFiles download pages all live in lib/pkp; OJS adds only the empty LibraryFileManager subclass (no behaviour override)
status: verified
e2e-plans: []
atlas-claims:
  - GRID-lib-pkp-grid-files-library-file-grid-handler
  - GRID-lib-pkp-grid-files-submission-documents-submission-documents-files-grid-handler
  - GRID-lib-pkp-grid-settings-library-library-file-admin-grid-handler
  - GRID-lib-pkp-modals-document-library-document-library-handler
  - GRID-lib-pkp-grid-files-selectable-library-file-grid-handler
  - DB-library_files
  - DB-library_file_settings
  - API-library-get-library
  - PAGE-libraryfiles-downloadpublic
  - PAGE-libraryfiles-downloadlibraryfile
  - LOC-grid-grid-libraryFiles
  - LOC-manager-settings-libraryFiles
---

# Document Library (reusable context & submission documents)

## Purpose

Every journal accumulates **boilerplate documents** that are not scholarly content but travel
alongside the editorial process: a reviewer-guidelines PDF an editor pastes into review requests,
a marketing flyer, a copyright/permissions form an author must sign, an internal report. OJS keeps
these in a **Document Library** — a small file store, separate from the submission-file machinery,
organized by document **type** (Marketing, Permissions, Reports, Other). The library exists at two
levels: a **journal-wide "context" library** a manager curates in **Settings → Workflow → Library**
(the "Publisher Library" grid), and a **per-submission library** any editorial participant (or the
author) reaches from the workflow header's **Library** button — the place to stash a signed
permissions form or a note attached to one specific submission, with the journal-wide documents
available read-only alongside it. A library document can also be **attached to an outgoing email**
(the composer's "Library files" source) and a context document can be flagged **public** so it is
downloadable by a plain URL. This spec owns the library-file model, both grids, the submission
library modal, the upload/edit/delete/download mechanics, and the library API — it is **not** the
submission's manuscript files (`submission-files`) nor the publication Media tab (`media-files`),
both of which are entirely separate stores.

## Actors & permissions

Two distinct surfaces with different gates. **Context library** = the journal-wide store
(`library_files` rows with no submission), reached only from **Settings → Workflow → Library**, a
manager settings page. **Submission library** = the per-submission store (`library_files` rows
carrying a `submissionId`), reached from the workflow **Library** header button, gated by
**submission access** (an assigned participant, or a manager/site admin). "Editorial participant"
below = a manager, site admin, sub-editor (section editor) or assistant assigned on the submission;
**reviewers are never** in any library role set. Site-wide baseline: everything requires a login in
a journal context; an unassigned manager/site admin has submission access everywhere (the
`workflow-stage-navigation` baseline). Verified live on `publicknowledge` 2026-07-04 (dbarnes
manager, atester author, jjanssen reviewer; sub 4). <sup>a</sup>

| Action | Who may — and when |
|--------|--------------------|
| **Manage the context (journal) library** — add / edit / replace / delete a journal-wide document, toggle Public Access | • Managers & site admins — via **Settings → Workflow → Library** (the only entry point; a settings page). The grid's *listing* role set is broader (also sub-editor/assistant/author), but no non-settings surface renders it and every mutation op is manager/admin-only <sup>b</sup> |
| **Open a submission's Library** (the workflow header **Library** button → "Submission Library" modal) | • Anyone who can open the submission's workflow modal **and** holds an editorial-participant or author role on it — the modal handler admits manager/admin/sub-editor/assistant/author behind a submission-access check<br>• Reviewers — refused: the modal body renders only "The current role does not have access to this operation." (a reviewer never holds a library role; the stub reviewer deep-link case is `workflow-stage-navigation` OQ2) <sup>c</sup> |
| **Manage a submission's library** — add / edit / delete a document on one submission | • Any editorial participant assigned on the submission — every mutation op<br>• The **author** on their own submission — same add/edit/delete rights (verified live: atester added on sub 4)<br>• Reviewers — never <sup>d</sup> |
| **View the journal-wide documents from inside a submission** ("View Document Library" action) | • Everyone who can open the Submission Library modal — opens the context library **read-only**; the Add-file affordance appears only for managers/admins <sup>e</sup> |
| **Download a library document** | • **Context document** — any editorial role, author or reviewer with journal access (the download route admits all six roles; a context file carries no per-submission gate)<br>• **Submission document** — a manager/admin, or a user assigned to that submission at the submission stage; others get 403<br>• **Public** context document — **anyone, no login**, via the public URL when Public Access is set (rule 8) <sup>f</sup> |
| **Read the library over the REST API** (`GET /_library`, feeds the email composer's "Library files" attach source) | • Managers, site admins, sub-editors only — authors/assistants/reviewers are refused (verified live: atester → 401), even though authors/assistants may manage the submission library grid. The API is the editorial email-attach surface, not the grid's data source <sup>g</sup> |

<sup>a</sup> LibraryFile (`submissionId` null = context, set = submission); live probes 2026-07-04 (dbarnes/atester/jjanssen, sub 4) ·
<sup>b</sup> LibraryFileAdminGridHandler::__construct() (mutations → MANAGER/SITE_ADMIN only; base LibraryFileGridHandler grants fetch to MANAGER/SITE_ADMIN/SUB_EDITOR/ASSISTANT/AUTHOR); LibraryFileAdminGridDataProvider (ContextAccessPolicy); management/workflow.tpl:91 (`canEdit=true`, the sole entry) ·
<sup>c</sup> DocumentLibraryHandler::__construct() (SUB_EDITOR/MANAGER/SITE_ADMIN/AUTHOR/ASSISTANT) + authorize() (SubmissionAccessPolicy); useWorkflowActions.js `workflowViewLibrary` (`modals.documentLibrary.documentLibraryHandler`); live: reviewer body "does not have access" (workflow-stage-navigation OQ2) ·
<sup>d</sup> SubmissionDocumentsFilesGridHandler::__construct() (all ops → MANAGER/SITE_ADMIN/SUB_EDITOR/ASSISTANT/AUTHOR) + SubmissionDocumentsFilesGridDataProvider (SubmissionAccessPolicy); live: atester add on sub 4 ·
<sup>e</sup> SubmissionDocumentsFilesGridHandler::viewLibrary() (`canEdit` = user has MANAGER/SITE_ADMIN); publisherLibrary.tpl ·
<sup>f</sup> FileApiHandler::downloadLibraryFile() (roles MANAGER/SITE_ADMIN/SUB_EDITOR/ASSISTANT/REVIEWER/AUTHOR) → LibraryFileHandler::downloadLibraryFile() (submission-assignment gate for submission files; context files default-allow); LibraryFileHandler::downloadPublic() (public, requires `publicAccess`) ·
<sup>g</sup> PKPLibraryController::getRouteGroupMiddleware() (SITE_ADMIN/MANAGER/SUB_EDITOR) + authorize() (SubmissionAccessPolicy when `includeSubmissionId`); fileAttachers/Library.php; live: atester `_library?includeSubmissionId=4` → 401

## Fields & validation

The add/edit form is the same shape at both levels; the user fills these on-screen (verified live,
context and submission Add-file forms, 2026-07-04):

| Field (UI label) | Required? | Rules | Anchor |
|------------------|-----------|-------|--------|
| **Name** | Yes | The document's display name; **multilingual**; ≤255 chars | LibraryFileForm (`FormValidatorLocale` on `libraryFileName`); newFileForm.tpl (`multilingual=true`) |
| **Type** | Yes | One of **Marketing · Permissions · Reports · Other** (a "Choose One" placeholder is rejected). Sets the category the document files under and its stored-filename suffix. Live-confirmed the dropdown offers exactly these four | LibraryFileForm (`FormValidatorCustom` on `fileType` → `getNameFromType`); PKPLibraryFileManager::getTypeTitleKeyMap() |
| **Description** | Marked required in the form, **not enforced** | A free-text note; **multilingual**. ⚠ The template renders a required asterisk but no server validator checks it, so a document saves with an empty description (Known deviations) | newFileForm.tpl (`title="common.description" required=true`); LibraryFileForm::readInputData() (no `description` check) |
| **File** | Yes (on add) | The document itself, uploaded via the drag-drop uploader into a temporary file, then copied into the library store. On **edit**, re-uploading is **optional** — a replacement file swaps the content, otherwise only metadata changes (context library only; rule 6) | NewLibraryFileForm (`FormValidator` on `temporaryFileId`); PKPLibraryFileManager::copyFromTemporaryFile()/replaceFromTemporaryFile() |
| **Public Access** | No | **Context library only** — a checkbox that makes the document downloadable by a public URL with no login (rule 8). The submission-library form has **no** such field (verified live: absent) | newFileForm.tpl (context) `publicAccess`; submission newFileForm.tpl omits it; LibraryFile `publicAccess` |

Server-set (not shown): `contextId`, `submissionId` (submission library only), server `fileName`
(generated `original-<SUFFIX>.<ext>`, deduplicated), `fileType` (MIME), `fileSize`, `dateUploaded`.

## Rules & state

The document types, from `LibraryFile::LIBRARY_FILE_TYPE_*`: **Marketing**(2) · **Permissions**(3)
· **Reports**(4) · **Other**(5). A fifth constant, **Contract**(1), exists but is **absent from
every type map** (suffix/title/name), so it is never offered or stored in OJS — a monograph-era
leftover (rule 2). <sup>a</sup>

### 1. One table, two levels — context vs submission

A library document is a single **`library_files`** row carrying a **`contextId`** and, optionally, a
**`submissionId`**: a row with `submissionId` NULL is a **journal-wide** (context) document; a row
with a `submissionId` belongs to **that one submission**. The same model, DAO, form, upload path and
download route serve both — the level is purely which of `getByContextId()` (submission NULL) or
`getBySubmissionId()` the surface queries. Physical files live under
`files_dir/contexts/{contextId}/library/`, wholly separate from the `submission_files` store. Both
levels cascade-delete: deleting a journal removes its context library, deleting a submission removes
its submission library (FK `onDelete cascade`). <sup>b</sup>

### 2. Four document types; the grid groups by type; the type sets the filename suffix

The type dropdown offers **Marketing / Permissions / Reports / Other** (live-confirmed at both
levels). Types are a **hard-coded** map (not a journal setting), extensible only through the
`PublisherLibrary::types::{suffixes,titles,names}` hooks. Each library grid is a **category grid**:
it renders one collapsible category **per type** (each shown even when empty — "No Items"), and a
document lands in its type's category. The type also fixes the stored filename **suffix** — MAR /
PER / REP / OTH — appended before the extension, with a numeric `-N` de-duplicator if the name
collides (`generateFileName`). The **Contract**(1) constant is defined on the model but appears in
none of the three type maps, so it is neither offered nor accepted. <sup>c</sup>

### 3. The context (journal) library — Settings → Workflow → Library

Managers reach the journal-wide library at **Settings → Workflow → Library**, which loads the
**"Publisher Library"** grid (`LibraryFileAdminGridHandler`, mounted with `canEdit=true`). It lists
the four type categories with an **Add a file** action and, per existing document, **Edit** and
**Delete** row actions; a document's name is a **download link**. Add/edit/delete are manager/admin
only. This same grid is reused **read-only inside a submission** via the submission library's
"View Document Library" action (rule 4), where `canEdit` is recomputed from the viewer's role, so a
non-manager sees the journal documents but no Add/Edit/Delete. Verified live: the grid renders
"Publisher Library" with Marketing/Permissions/Reports/Other categories. <sup>d</sup>

### 4. The submission library — the workflow Library button

The workflow header's **Library** button (owned as chrome by `workflow-stage-navigation`; this spec
owns what it opens) opens the **"Submission Library"** modal (`DocumentLibraryHandler::documentLibrary`),
which loads the submission library grid (`SubmissionDocumentsFilesGridHandler`) for the submission.
It shows the same four type categories plus two grid actions: **Add a file** (scoped to this
submission) and **View Document Library** (opens the read-only context library, rule 3). Any assigned
editorial participant **and the author** may add/edit/delete here; the grid `canEdit` is always true
for this surface, and the submission-access policy is the real gate. Verified live: dbarnes and
atester both open "Submission Library" with Add-a-file + View-Document-Library actions; the type
dropdown on Add matches the context library. <sup>e</sup>

### 5. Upload writes directly to the library store (no wizard, no genres, no revisions)

Adding a document is a simple two-hop: the drag-drop uploader posts the file to `uploadFile`, which
stages it as a **temporary file** and returns a `temporaryFileId`; submitting the form (`saveFile`)
runs `copyFromTemporaryFile()` — copying the temp file into `contexts/{id}/library/` under the
generated name, capturing MIME/size, then inserting the `library_files` row and its `name`/
`description` settings, and finally deleting the temp file. There is **no** submission-file upload
wizard, **no genre**, **no revision history**, and **no event-log entry** — the whole submission-file
apparatus (`submission-files`) is bypassed. On the submission grid the new row also carries the
`submissionId`; on the context grid it also captures `publicAccess`. <sup>f</sup>

### 6. Editing: metadata always; file replacement only in the context library

The row's **Edit** action reopens the form pre-filled. Both levels let the user change Name,
Description and Type. The **context** edit form additionally offers the uploader and the Public
Access toggle: supplying a new file calls `replaceFromTemporaryFile()` (overwrites the content,
deleting the old physical file if the generated name changed), and the checkbox re-sets public
access. The **submission** edit form has **neither** — it updates only Name/Description/Type and
cannot replace the file's content (a minor asymmetry; Open questions). <sup>g</sup>

### 7. Deletion is immediate and CSRF-guarded

**Delete** (a confirm modal) removes the physical file and the `library_files` row (plus its
settings) in one step — `LibraryFileManager::deleteById()`. There is no soft-delete, no undo, and no
cascade beyond the file itself; the op is guarded by a CSRF check. <sup>h</sup>

### 8. Downloads — assigned/role-gated normally, public by URL when flagged

A grid row's name is a **download link** (`DownloadLibraryFileLinkAction`) that posts-and-redirects
to `FileApiHandler::downloadLibraryFile`, which delegates to `LibraryFileHandler`: a **submission**
document is served only to a manager/admin **or** a user assigned to that submission (else 403); a
**context** document has no per-submission gate and is served to any journal role the download route
admits. Separately, a **context** document flagged **Public Access** is downloadable by **anyone,
without login**, at the page URL `…/libraryFiles/downloadPublic/{fileId}` — `downloadPublic` serves
the file only if `publicAccess` is set (else 403); this public URL is surfaced to the manager in the
add/edit form's instructions. Submission documents never carry public access, so they have no public
URL. <sup>i</sup>

⚠ **Two hazards on the legacy download *page* routes** (`lib/pkp/pages/libraryFiles`, distinct from the gated
component route above). **(a)** The `libraryFiles/downloadLibraryFile` page op carries **no authorization policy or
role gate** and, for a context document, default-allows — so it streams **any non-public journal library document to
anyone with no login**, by guessable `libraryFileId` (confirmed live; the ⚠ security finding in Known deviations,
`docs/e2e/app-changes.md` #88). **(b)** The handler's refusal branches emit the legacy
`header('HTTP/1.0 403 Forbidden')`, which the PHP dev server does **not** translate into a real status — a refusal
comes back **HTTP 200** with a `403 Forbidden<br>` body (confirmed live: `downloadPublic/{id}` on a non-public file →
HTTP 200, body "403 Forbidden"). Do **not** read a 200 on these page ops as "download allowed": inspect the
body/`Content-Type`. The gated component route (`FileApiHandler`, rule preamble) is unaffected — it denies via the
authorization framework, not this legacy header.

### 9. The library API feeds the email composer's attach source

`GET /_library` returns the journal-wide documents as `{items, itemsMax}`, each item carrying its
name, MIME/`documentType`, `type`/localized `typeName`, and a **download url** (the same
`downloadLibraryFile` route). Passing **`includeSubmissionId`** additionally returns that submission's
documents (behind a submission-access check). The endpoint is **editorial-only**
(manager/site-admin/sub-editor) and exists to populate the email composer's **"Library files"**
attach source (`FileAttacherLibrary`), letting an editor pin a library document onto an outgoing
message — it is **not** the grids' data source (the grids use the legacy category-grid data
providers). Verified live: manager → 200 `{items:[],itemsMax:0}` (no seeded library files); author →
401. <sup>j</sup>

### 10. Distinct from submission files and media files

The library is a **separate store** with its own table, DAO, physical directory, forms and download
route. It shares **nothing** with `submission_files` except the generic temporary-file staging and
the multi-purpose `FileApiHandler` (which carries both `downloadFile` and `downloadLibraryFile`
ops). It is likewise unrelated to the publication **Media** tab (`media-files`, feature 27), which
stores `SUBMISSION_FILE_MEDIA` rows with variant groups — a different table, manager and API
(seam confirmed: `MediaFilesController` never touches library files). <sup>k</sup>

<sup>a</sup> LibraryFile `LIBRARY_FILE_TYPE_*`; PKPLibraryFileManager type maps (no CONTRACT) ·
<sup>b</sup> LibraryFileDAO::getByContextId()/getBySubmissionId() (`submission_id IS NULL` vs `= ?`); LibraryFile::getFilePath() (`contexts/{id}/library/`); LibraryFilesMigration (context_id + submission_id FKs `onDelete cascade`) ·
<sup>c</sup> PKPLibraryFileManager::{getTypeSuffixMap,getTypeTitleKeyMap,getTypeNameMap} (MAR/PER/REP/OTH; hook-extensible) + generateFileName() (suffix + `-N` dedup via `filenameExists`); LibraryFileGridHandler::loadData() (categories from `getTypeSuffixMap`); live dropdown = Marketing/Permissions/Reports/Other ·
<sup>d</sup> management/workflow.tpl:90-92 (Library tab, `LibraryFileAdminGridHandler`, `canEdit=true`); LibraryFileAdminGridHandler (mutations manager/admin) + LibraryFileGridRow (edit/delete when `canEdit`) + LibraryFileGridCellProvider (download link); live grid "Publisher Library" ·
<sup>e</sup> useWorkflowActions.js `workflowViewLibrary` (title `grid.libraryFiles.submission.title` = "Submission Library"); DocumentLibraryHandler::documentLibrary() → documentLibrary.tpl (`SubmissionDocumentsFilesGridHandler`); SubmissionDocumentsFilesGridHandler::initialize() (`setCanEdit(true)`, Add-file + `viewLibrary` actions); live sub 4 dbarnes/atester ·
<sup>f</sup> LibraryFileGridHandler::{uploadFile,saveFile} (TemporaryFileManager → `_getNewFileForm`); NewLibraryFileForm::execute() (`copyFromTemporaryFile`, `insertObject`, temp cleanup); submission NewLibraryFileForm sets `submissionId`; context NewLibraryFileForm sets `publicAccess` ·
<sup>g</sup> settings/library/EditLibraryFileForm::execute() (`replaceFromTemporaryFile` when temp file + `setPublicAccess`); submissionDocuments/EditLibraryFileForm::execute() (name/description/type only, no file, no public) ·
<sup>h</sup> LibraryFileGridHandler::deleteFile() (`checkCSRF`); PKPLibraryFileManager::deleteById() (unlink + `LibraryFileDAO::deleteById`) ·
<sup>i</sup> DownloadLibraryFileLinkAction (post→`api.file.FileApiHandler::downloadLibraryFile`); FileApiHandler::downloadLibraryFile() → LibraryFileHandler::downloadLibraryFile() (submission-assignment gate; context default-allow); LibraryFileHandler::downloadPublic() (`getPublicAccess()` else 403); newFileForm.tpl (`downloadPublic` instruction URL) ·
<sup>j</sup> PKPLibraryController::getLibrary() (context always + submission when `includeSubmissionId`; `fileToResponse` url/typeName) + getRouteGroupMiddleware() (editorial roles); fileAttachers/Library.php (`libraryApiUrl`, `includeSubmissionId`); live manager 200 / author 401 ·
<sup>k</sup> FileApiHandler (`downloadFile` + `downloadLibraryFile`); MediaFilesController (no library refs — grep 2026-07-04); LibraryFile vs SubmissionFile stores

## Side effects

- **No emails, no notifications, no event-log entries.** Unlike `submission_files`, the library
  writes nothing to `event_log` on add/edit/delete and raises no notifications — the library is a
  quiet store. (The one place a library document *causes* an email is when an editor attaches it in
  the composer, owned by `email-delivery`.)
- **Data mutations**: `library_files` (+ `library_file_settings` for name/description); a physical
  file under `files_dir/contexts/{contextId}/library/`; a `temporary_files` row is consumed
  (created on upload, deleted on save). Deleting a document unlinks its physical file.
- **Cross-entity cascade**: deleting the **journal** (context) or the **submission** removes its
  library files via DB foreign keys — the library holds no orphan-cleanup logic of its own. <sup>a</sup>

<sup>a</sup> LibraryFileDAO (no eventLog/notification calls); NewLibraryFileForm::execute() (temp-file cleanup); LibraryFilesMigration (cascade FKs); PKPLibraryFileManager::deleteById()

## Settings that modify behavior

- **The document types are not a setting.** Marketing/Permissions/Reports/Other are hard-coded in
  `PKPLibraryFileManager`; a journal cannot add or rename a type through the UI (only a plugin via
  the `PublisherLibrary::types::*` hooks). This is the seam versus `workflow-settings`, which owns
  the configurable submission-file **genres** (a different, submission-file concept) — the library
  has no equivalent config surface.
- **No toggle enables/disables the library.** Both surfaces are always present; the context tab is
  part of the Workflow settings page, the submission Library button part of the workflow header.
- `config.inc.php` `files_dir` sets where the physical library lives (`/contexts/{id}/library/`);
  the PHP upload caps (`upload_max_filesize`/`post_max_size`) bound the upload. No per-journal
  file-size or file-type restriction applies. <sup>a</sup>

<sup>a</sup> PKPLibraryFileManager::getTypeSuffixMap() (hooks); LibraryFile::getFilePath()

## Cross-feature interactions

- **workflow-stage-navigation** — owns the workflow header **Library** button (chrome) and the shell
  the "Submission Library" modal opens over; this spec owns the modal + grid it opens. Its OQ2
  (reviewer deep-link stub) documents the reviewer "does not have access" body this spec explains.
- **submission-files** — the *other* file store; owns the `FileAttacher` (whose **Library** variant
  consumes this spec's `_library` API), the shared `FileApiHandler` (which carries the
  `downloadLibraryFile` op), and the `temporary_files` staging the library upload reuses. No file
  moves between the two stores.
- **media-files** (feature 27, unwritten) — the publication Media tab; a **distinct** per-submission
  store (`SUBMISSION_FILE_MEDIA` + variant groups), not the library. The FEATURE-MAP's provisional
  hint tagging the library grids and `libraryFiles/download*` pages under media-files is a
  keyword-match artifact — those surfaces are the library's and are claimed here (seam recorded).
- **email-delivery** — owns the email composer that hosts the `FileAttacherLibrary` attach source
  backed by `_library` (rule 9).
- **workflow-settings** — owns submission-file **genres** (the analogous-but-different taxonomy); the
  library's types are separate and hard-coded.

## Canonical scenarios

1. **Manager curates the journal library** — a manager opens **Settings → Workflow → Library**, clicks
   **Add a file**, uploads a reviewer-guidelines PDF, picks **Type = Other**, names it and saves; it
   appears under the **Other** category. They **Edit** it (rename, or upload a replacement), download
   it from its name link, and **Delete** it with a confirm. (Live-verified: the "Publisher Library"
   grid, the four type categories, the Add-file form with the four-type dropdown + Public Access
   checkbox.)
2. **Submission Library from the workflow** — an editor opens a submission and clicks the header
   **Library** button; the **Submission Library** modal shows the four type categories with **Add a
   file** and **View Document Library** actions. **View Document Library** opens the journal-wide
   documents read-only; **Add a file** stashes a document on this submission only. (Live-verified on
   sub 4 for dbarnes.)
3. **Author attaches a permissions form to their submission** — the author opens their submission's
   **Library**, adds a signed permissions form as **Type = Permissions**; it appears on that
   submission's library and downloads back. The author cannot see it on any other submission, and the
   editor assigned to the submission can download it. (Live-verified: atester adds on sub 4.)
4. **A public journal document** — a manager edits a context document and ticks **Public Access**; the
   document becomes downloadable at `…/libraryFiles/downloadPublic/{id}` by anyone with no login,
   while non-public documents 403 on that URL. Submission documents never offer this.
5. **Permission boundaries** — the author manages their own submission's library but is **refused** the
   `_library` REST API (401, verified live), which only managers/sub-editors use for email
   attachment; a **reviewer** opening the Library button sees only "The current role does not have
   access to this operation."

## Known deviations (as-built ≠ intent)

- ⚠ **SECURITY — the legacy `libraryFiles/downloadLibraryFile` page op discloses any non-public context
  library document with no authentication.** The bare page route
  `GET /{journal}/libraryFiles/downloadLibraryFile?libraryFileId={id}` serves **any context (journal-wide)
  library document — including non-public ones — to anyone with no login**, by guessable integer fileId.
  `pages/libraryFiles/index.php` instantiates `LibraryFileHandler` with no role assignment and no
  authorization policy; the page router's blacklist authorize (`AUTHORIZATION_PERMIT` when no policy denies)
  lets everyone through, and `LibraryFileHandler::downloadLibraryFile()` sets `$allowedAccess = true`
  unconditionally for a context file (`submissionId` null). The UI-linked path is the role-gated **component**
  route (`api.file.FileApiHandler::downloadLibraryFile`, 6 roles + `ContextAccessPolicy`); this page op is a
  latent parallel route nothing renders, but fully reachable by hand-crafted URL. **Confirmed live 2026-07-04**
  (port 8000, ojs_test): non-public context file `library_files` id=1 (`j-dla0jifjg`, `public_access=0`) →
  HTTP 200 + full 14 572-byte PDF served both logged-out and as `atester` (a plain author), while the same
  `atester` is 401'd by `_library`; on `publicknowledge` a 302→`…/en/…` locale hop precedes but does not gate.
  `docs/e2e/app-changes.md` #88 (resolves OQ1). Suggested fix: add a `ContextAccessPolicy` + role gate to the
  page op mirroring the component route, or delete the page op.
- ⚠ **Description is asterisked but not enforced.** All four add/edit templates render **Description** with
  a required marker, yet `LibraryFileForm` adds no validator for it, so a library document saves with
  an empty description. Cosmetic/validation mismatch (no data loss); the required asterisk overstates
  the constraint. `docs/e2e/app-changes.md` #89. `LibraryFileForm::readInputData()`
  reads `description` but `__construct()` checks only `libraryFileName` and `fileType`.

## Open questions

1. **RESOLVED (confirmed live, 2026-07-04) — the bare page op IS reachable with no auth and serves
   non-public context files.** Promoted to a ⚠ security deviation (Known deviations) and laddered as
   `docs/e2e/app-changes.md` #88. Independently re-confirmed: `library_files` id=1 on `j-dla0jifjg`
   (`public_access=0`) → HTTP 200 + full PDF both logged-out and as `atester`. The maintainer question is
   now only *how* to fix (gate the page op vs. delete it), not *whether* the hole exists.
2. **Submission-library edit cannot replace the file** (rule 6): the context edit form can swap a
   document's content, the submission edit form cannot (metadata only). Intended (submission documents
   are write-once uploads) or an oversight?
3. **`_library` API excludes authors/assistants** who can nonetheless manage the submission library
   grid (rule 9). Intended — the API serves only the editorial email composer — or should it match the
   grid's role set?
4. **`SelectableLibraryFileGridHandler` is dead in OJS.** It extends the live `LibraryFileGridHandler`
   base but has zero call sites in this checkout (a monograph/OMP selectable-picker surface not wired
   in OJS). Claimed here as part of the library-grid family and recorded as a **dead-code candidate**
   (`UNASSIGNED.md`); confirm OMP-only before removal.

---

## Reference — entry points & surfaces

| Entry | Path | Atom |
|-------|------|------|
| Context library (journal-wide) | Settings → Workflow → **Library** tab → "Publisher Library" grid (`grid.settings.library.LibraryFileAdminGridHandler`) | GRID-lib-pkp-grid-settings-library-library-file-admin-grid-handler |
| Submission library modal | Workflow header **Library** button → `modals.documentLibrary.DocumentLibraryHandler::documentLibrary` → "Submission Library" | GRID-lib-pkp-modals-document-library-document-library-handler |
| Submission library grid | inside the modal — `grid.files.submissionDocuments.SubmissionDocumentsFilesGridHandler` (addFile/uploadFile/saveFile/editFile/updateFile/deleteFile/viewLibrary) | GRID-lib-pkp-grid-files-submission-documents-submission-documents-files-grid-handler |
| Library-grid base machinery | `LibraryFileGridHandler` (fetch/upload/save/edit/update/delete; category grid by type) | GRID-lib-pkp-grid-files-library-file-grid-handler |
| Selectable library grid (dead in OJS) | `SelectableLibraryFileGridHandler` — no OJS call site (OMP-suspected; dead-code candidate) | GRID-lib-pkp-grid-files-selectable-library-file-grid-handler |
| Library REST read | `GET api/v1/_library[?includeSubmissionId={id}]` (editorial-only; email-attach source) | API-library-get-library |
| Download a library file | `api.file.FileApiHandler::downloadLibraryFile` (component; role + assignment gated) | *(FileApiHandler owned by submission-files)* |
| Public download page | `/{journal}/libraryFiles/downloadPublic/{fileId}` (public when `publicAccess`) | PAGE-libraryfiles-downloadpublic |
| Restricted download page | `/{journal}/libraryFiles/downloadLibraryFile?libraryFileId={id}` (legacy page op; OQ1) | PAGE-libraryfiles-downloadlibraryfile |
| Library entity / storage | `library_files` (+ `library_file_settings`); physical files under `files_dir/contexts/{id}/library/` | DB-library_files, DB-library_file_settings |
| Locale namespaces | `grid.libraryFiles.*` (grid labels), `settings.libraryFiles.*` (types, form) | LOC-grid-grid-libraryFiles, LOC-manager-settings-libraryFiles |

## Reference — code anchors

- **Model / DAO / storage**: `lib/pkp/classes/context/LibraryFile.php` (`LIBRARY_FILE_TYPE_*`,
  `publicAccess`, `getFilePath`), `lib/pkp/classes/context/LibraryFileDAO.php`
  (`getByContextId`/`getBySubmissionId`/`insertObject`/`updateObject`/`deleteById`,
  `library_file_settings` locale fields), `lib/pkp/classes/file/PKPLibraryFileManager.php`
  (type maps, `generateFileName`, `copyFromTemporaryFile`/`replaceFromTemporaryFile`, `deleteById`);
  `classes/file/LibraryFileManager.php` (empty OJS subclass);
  `lib/pkp/classes/migration/install/LibraryFilesMigration.php` (tables + cascade FKs).
- **Context grid**: `lib/pkp/controllers/grid/settings/library/LibraryFileAdminGridHandler.php` +
  `LibraryFileAdminGridDataProvider.php` + `form/{New,Edit}LibraryFileForm.php`;
  `lib/pkp/templates/management/workflow.tpl` (Library tab) +
  `templates/controllers/grid/settings/library/form/{newFileForm,editFileForm}.tpl`.
- **Submission grid + modal**: `lib/pkp/controllers/modals/documentLibrary/DocumentLibraryHandler.php`
  + `templates/controllers/modals/documentLibrary/{documentLibrary,publisherLibrary}.tpl`;
  `lib/pkp/controllers/grid/files/submissionDocuments/SubmissionDocumentsFilesGridHandler.php` +
  `SubmissionDocumentsFilesGridDataProvider.php` + `form/{New,Edit}LibraryFileForm.php`;
  `lib/ui-library/src/pages/workflow/composables/useWorkflowActions.js` (`workflowViewLibrary`).
- **Shared grid base**: `lib/pkp/controllers/grid/files/LibraryFileGridHandler.php`,
  `LibraryFileGridRow.php`, `LibraryFileGridCellProvider.php`, `LibraryFileGridCategoryRow.php`,
  `form/LibraryFileForm.php`.
- **Download**: `lib/pkp/pages/libraryFiles/LibraryFileHandler.php`
  (`downloadPublic`/`downloadLibraryFile`) + `index.php`;
  `lib/pkp/controllers/api/file/FileApiHandler.php::downloadLibraryFile`;
  `lib/pkp/controllers/api/file/linkAction/DownloadLibraryFileLinkAction.php`.
- **API + email attach**: `lib/pkp/api/v1/_library/PKPLibraryController.php` (`getLibrary`,
  `fileToResponse`); `lib/pkp/classes/components/fileAttachers/Library.php` (`FileAttacherLibrary`
  state).
