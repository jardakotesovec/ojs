---
name: media-files
scope: Upload and manage a publication's supplementary media files (images, multimedia, HTML stylesheets that a galley loads) on the workflow Publication → Media tab, pair a web-optimized image with its high-resolution original into a variant group, and share those files across the publication's galleys
shared: pkp-lib          # the Vue MediaFileManager, the MediaFilesController REST API, the VariantGroup model + variant_groups table and the media file-stage all live in lib/pkp + lib/ui-library (OMP/OPS mount the same manager in their WorkflowPage); OJS wires it into WorkflowPageOJS and the OJS reader download
status: verified
e2e-plans: [media-files]
atlas-claims:
  - VUE-media-file-manager
  - API-media-files-get-many
  - API-media-files-add
  - API-media-files-link-many
  - API-media-files-link
  - API-media-files-edit
  - API-media-files-delete
  - DB-variant_groups
  - LOC-submission-publication-mediaFiles
---

# Media files (the publication's supplementary / dependent media)

## Purpose

A **media file** is a supplementary asset a published article's galley loads but that is not itself a
galley — an **image** an HTML full-text embeds, a **multimedia** clip, an **HTML stylesheet**. This
spec owns the **Media manager** on the workflow **Publication → Media** tab, where the journal's team
— **Journal Manager**, **Section Editor**, **Assistant** (and the **Site Administrator**; see Actors
& permissions) — **batch-upload** these files, tag each with a **dependent genre** (Image / Multimedia / HTML
Stylesheet) and a **resolution** (Web | High resolution), **link** a web-optimized image to its
**high-resolution original** into a pair (a **variant group**), **edit** the shared metadata (which
propagates to the pair's other file), and **delete** them. Because a media file is attached to the
**publication** (not to one galley), any of that publication's galleys can reference and serve it —
that is the "shared across galleys" model. This spec also owns the media API, the variant-pair
entity, and the manager screen itself (provenance in the Reference blocks at the bottom). <sup>a</sup>

Media files are ordinary submission files kept at their own dedicated **Media** file stage — their
byte store, upload plumbing, schema and file history belong to `submission-files`; this spec owns the
**media entity** (which files are media, their variant pairing and metadata-sync semantics) and the
manager UI. The **galleys** those media serve are `galleys`; the reader **article page** that
surrounds the download links is `article-landing`; the **published-version lock** is
`publication-versioning`. The Media tab is **distinct** from the **Document Library**
(`document-library` — a separate reusable file store) and from classic per-file **dependent files**
(`submission-files` rule 6 — attached to a *parent file*; media attach to the *publication*). <sup>b</sup>

<sup>a</sup> `MediaFilesController` (REST); `variant_groups` + `submission_files.variant_group_id`/`variant_type`; Vue `MediaFileManager` ·
<sup>b</sup> `SubmissionFile::SUBMISSION_FILE_MEDIA` = 23 vs Dependent(17); published-lock = `canEditPublication`

## Actors & permissions

Role names used throughout this spec: **Site Administrator**, **Journal Manager**, **Section
Editor** (a.k.a. sub-editor), **Assistant** (the layout-editor / copyeditor / proofreader groups),
**Author**, **Reviewer**, **Reader**. Every Media *management* capability requires
**production-stage access**: a **Section Editor** or **Assistant** qualifies only while holding a
stage assignment on the submission's production stage, while a **Journal Manager** or **Site
Administrator** qualifies on every submission without any assignment (manager scope). The **Author**
sees the Media tab but gets **list-only** — no upload, link, edit or delete. A **Reviewer** has no
access to media at all. The Media tab sits on the **Publication** menu right after Galleys and, like
the other Publication tabs, is a live default tab in both the editorial and the Author workflow. The
**published-version lock** is enforced *only at the server* (rule 9): the on-screen manager ignores
it, and the server's lock exempts the Site Administrator, Journal Manager and Section Editor and
blocks only users whose sole role on the submission is Author — so those roles keep full media
management on a published article, and the Author never had write access to begin with. The server
enforces the same gate the screen reads. Live-probed 2026-07-04 on `publicknowledge` (dbarnes
Journal Manager, atester Author, jjanssen Reviewer). <sup>a</sup>

| Action | Who may — and when |
|--------|--------------------|
| **See / list media** (the Media tab) | • Site Administrator, Journal Manager, or a Section Editor / Assistant assigned to the production stage — full access<br>• The submitting **Author** — **list-only** (Id, File Name, Type, Size, Date Uploaded columns; no Add / Batch-Link buttons, no per-row menu) on their own submission<br>• **Reader** — has no Media surface; media reach readers only as a galley's embedded/served resource (rule 10) <sup>b</sup> |
| **Batch-upload media** (Add Media File → the Upload Media File modal) | • Site Administrator, Journal Manager, or a Section Editor / Assistant assigned to the production stage — drag-drop one or more files, each given a dependent genre + a resolution<br>• Author — never <sup>c</sup> |
| **Link a web variant to a high-res original** (Manually Link Media, or Batch Link Media) | • Site Administrator, Journal Manager, or a Section Editor / Assistant assigned to the production stage — only on **variant-supporting** genres (Image by default); pairs one *web* file with one *high-resolution* file<br>• Author — never <sup>d</sup> |
| **Edit a media file's metadata** (Edit Metadata) | • Site Administrator, Journal Manager, or a Section Editor / Assistant assigned to the production stage — the shared media metadata (caption, credit, description, creator…); shared fields propagate to the file's pair partner<br>• Author — never <sup>e</sup> |
| **Delete a media file** (Delete File) | • Site Administrator, Journal Manager, or a Section Editor / Assistant assigned to the production stage — behind a confirm; deleting removes the file and tidies its pair<br>• Author — never <sup>f</sup> |
| **View a media file's notes / history** (More Information) | • Site Administrator, Journal Manager, or a Section Editor / Assistant assigned to the production stage — opens the file's Information Center <sup>g</sup> |
| **Download a media file** (reader) | • Any **Reader** who can view one of the publication's **galleys** — a media file is served through that galley's download route, behind the galley's own subscription/payment/published gate; ⚠ no theme surfaces the high-res variant, so it is reachable only by a hand-formed download URL (rule 10) <sup>h</sup> |

<sup>a</sup> `useMediaFileManagerConfig.js` `MediaFileManagerConfigurations.permissions` + `getManagerConfig()` (`hasCurrentUserAtLeastOneAssignedRoleInStage(submission, WORKFLOW_STAGE_ID_PRODUCTION, roles)`); `MediaFilesController::getGroupRoutes()` role list + `authorize()` (`PublicationWritePolicy` on writes, `PublicationAccessPolicy` on read); live 2026-07-04 (sub 2/3/4) ·
<sup>b</sup> `MediaFileManagerConfigurations.permissions` (AUTHOR → `[MEDIA_FILE_LIST]`; sub-editor/manager/site-admin/assistant → all actions); `MediaFileManager.vue` columns; live: atester GET on own sub 3 → 200 ·
<sup>c</sup> `getTopItems()` (`MEDIA_FILE_ADD` → "Add Media File"); `useMediaFileManagerAddFileModal.js` (`FileMediaUploader` → `POST …/mediaFiles`); `AddMediaFiles` form request ·
<sup>d</sup> `getTopItems()` (`MEDIA_FILE_BATCH_LINK_IMAGES` → "Batch Link Media"); `getItemActions()` (`MEDIA_FILE_MANUALLY_LINK_IMAGE` shown only when `mediaFile.genreSupportsFileVariants`); `MediaFilesController::link()`/`linkMany()`; live link 3→4 → group 1 ·
<sup>e</sup> `getItemActions()` (`MEDIA_FILE_EDIT_METADATA`); `MediaFilesController::edit()` → `VariantGroup::applyMetadataToSiblings()` ·
<sup>f</sup> `getItemActions()` (`MEDIA_FILE_DELETE`, `isWarnable`); `MediaFilesController::delete()` → `Repo::submissionFile()->delete()` + `VariantGroup::cleanupAfterDelete()`; live: dbarnes DELETE 200 (removed) ·
<sup>g</sup> `getItemActions()` (`MEDIA_FILE_INFO` → File Information Center, owned by `editorial-activity-log`) ·
<sup>h</sup> `ArticleHandler::download()` media allow-list (`ASSOC_TYPE_PUBLICATION` + fileStage Media); reader gate + page owned by `galleys` rule 12 / `article-landing`; high-res reader-exposure gap = ledger row 59(d)

## Fields & validation

Two on-screen forms: the **Upload Media File** modal (per-file genre + resolution, one row per
dropped file) and the per-row **Edit Metadata** side-modal (the shared descriptive metadata). A media
file is not multilingual in its *content*, but its descriptive fields can be entered per language
like any submission file's. <sup>a</sup>

| Field (UI label) | Required? | Rules |
|------------------|-----------|-------|
| **File** (drag-drop, batch) | **Yes** | One or more files; each uploads and becomes a media file on the publication. The **Upload Files** button stays disabled until every dropped file has finished uploading and has a genre <sup>b</sup> |
| **What kind of media is this?** (genre) | **Yes** | A per-file select offering only the journal's **dependent** genres — by default **Image**, **Multimedia**, **HTML Stylesheet**. (Supplementary/document genres are not offered) <sup>c</sup> |
| **File resolution type** (variant) | **Yes** | **Web resolution** or **High resolution**. Required on every uploaded file; any other value is rejected. Drives variant pairing (rule 4) and the list's grouping and sort. (The form defaults it to Web) <sup>d</sup> |
| **Name** (upload / Edit Metadata) | No | The display name; defaults to the original filename when blank. Multilingual on the Edit form <sup>e</sup> |
| **Caption · Credit · Description · Creator · Publisher · Source · Subject · Sponsor · Date created · Language · Copyright owner · Terms** (Edit Metadata) | No | The shared descriptive media metadata; on a file that belongs to a **pair**, saving any of these **also writes it to the pair's other file** (rule 6). Most are multilingual <sup>f</sup> |

The server fills in the rest automatically — that the file is media, which publication it belongs to,
who uploaded it, and the pair membership set by linking; whether a file's genre supports variants is
read-only, derived from the genre. None of it is user-entered. <sup>g</sup>

<sup>a</sup> upload posts to `POST …/mediaFiles`; descriptive fields are locale maps (`submissionFile.json`) ·
<sup>b</sup> `useMediaFileManagerAddFileModal.js` (`temporaryFiles` → `files[]`); `AddMediaFiles` (`files.*.temporaryFileId` required); `MediaFilesController::add()` ·
<sup>c</sup> `mediaFileManagerStore.js` `genreOptions` (`filter(genre => genre.dependent)`); live genres 9/10/11 dependent ·
<sup>d</sup> `AddMediaFiles::rules()` (`files.*.variantType` required, `Rule::in(MediaVariantType::cases())`); `MediaVariantType` (`web` / `high_resolution`) ·
<sup>e</sup> `MediaFilesController::add()` (`name` default = original filename under the submission locale); `submissionFile.json` `name` ·
<sup>f</sup> `Repo::submissionFile()->getCommonMediaFileFields()`; `VariantGroup::applyMetadataToSiblings()`; `submissionFile.json` ·
<sup>g</sup> server-set: `fileStage` = Media(23), `assocType` = `ASSOC_TYPE_PUBLICATION`, `assocId` = publication id, `uploaderUserId`, `fileId`, `variantGroupId` (set by linking), `genreSupportsFileVariants` (read-only, from the genre)

## Rules & state

Media files hang off a **publication** — each publication version has its own media set. Each media
file carries one of the journal's **dependent** genres, a resolution marker (web or high resolution),
and, once linked, membership in a two-file variant pair. <sup>a</sup>

1. **The Media tab is one live screen backed by the media API.** The tab shows a table with columns
   **Id** (the pair id, spanning a linked pair's rows), **File Name**, **Type** (genre), **Size** and
   **Date Uploaded**, plus a per-row **More Actions** menu, with **Batch Link Media** and **Add Media
   File** buttons on top. Everything the screen shows and does goes through the media API — and
   unlike galleys there is **no legacy screen** alongside it. Live-verified (sub 2): the list returns
   exactly the publication's media files. <sup>b</sup>
2. **A media file belongs to the publication, not to a galley.** Uploading attaches the file to the
   publication itself, so it exists once per publication version and is available to **every** galley
   of that publication (rule 10, the "shared across galleys" model). This is the seam vs. classic
   **dependent files** (`submission-files` rule 6), which attach to a *parent file*; media are a
   parallel, publication-level store. The byte store, upload plumbing, schema and file history all
   belong to `submission-files`; this spec owns the media entity + variant semantics. <sup>c</sup>
3. **Upload is a batch, and every file needs a genre + a resolution.** **Add Media File** opens the
   **Upload Media File** modal hosting a drag-drop uploader: each dropped file uploads, then its row
   shows a **genre** select (dependent genres only — Image / Multimedia / HTML Stylesheet) and a
   **File resolution type** select (Web / High resolution). **Upload Files** saves the whole batch at
   once. The resolution is **required** on every file and only the two values are accepted; the batch
   is **all-or-nothing** — a validation failure on any file undoes the entire batch, leaving no
   partial upload behind. Live-verified: seeding two files (web + high-res) yields two media
   rows. <sup>d</sup>
4. **A variant pair links one *web* file with one *high-resolution* file.** **Manually Link Media**
   (a per-row action, shown only when the file's genre **supports file variants** — Image by default)
   and **Batch Link Media** (a top button listing every web file with a genre-matched high-res choice
   per row) both create the pairing. Linking is refused — with a clear message — when the two files
   have the *same* resolution type, belong to different submissions, are not both media files, or are
   the same file. A linked pair renders as one grouped block in the table (web row first), sharing
   the Id cell. A pair holds **at most two** files — there is no explicit cap setting; the linking
   behavior guarantees it, because a link always forms a *fresh* two-file pair. Live-verified:
   linking a web file to its high-res counterpart grouped both under one pair id; a self-link was
   refused ("A file cannot be linked to itself."). <sup>e</sup>
5. **Re-linking dissolves prior pairs; the former partner is left standalone.** If either file being
   linked already belongs to a pair, that pair is dissolved first, then the new pair is formed — so
   linking never grows a pair past two, and a file's old partner becomes standalone. **Batch Link
   Media** applies a whole set of web→high-res choices at once, each pairing independent. Choosing no
   counterpart (an empty target) **unlinks** the file, dissolving its pair. Live-verified: unlinking
   returned both files to standalone and removed the pair. <sup>f</sup>
6. **On link and on edit, shared metadata flows to the pair's other file.** The shared media fields
   are **caption, copyright owner, creator, credit, date created, description, language, publisher,
   source, sponsor, subject and terms**. When two files are **linked**, the primary file's shared
   fields are copied onto the other. When a paired file's **metadata is edited**, the same
   shared-field changes are written to the pair's other file — so a web/high-res pair keeps one
   shared caption, credit and so on. Fields that aren't shared (the name) stay per-file. <sup>g</sup>
7. **Deleting a media file removes it and tidies its pair.** Deleting runs the standard
   submission-file delete (with its usual cascades and its File-deleted history entry) and then, if
   the file was paired, the lone survivor is **unpaired** and the emptied pair is removed — so
   deleting the high-res half of a pair leaves the web file standalone, not stranded in an empty
   pair. <sup>h</sup>
8. **Every change the Media manager offers is re-checked on save, so its boundaries hold identically
   on screen and behind the scenes** — a viewer who is shown the list but not the action buttons is
   refused the same actions if they try anyway, with no screen-shows-but-server-blocks (or the
   reverse) gap. (Who sees the list versus the actions is defined in Actors & permissions.)
   Live-verified: the Author's list of their own submission loaded, their attempt to delete a media
   file was refused, and a Reviewer and a non-participant were refused even the list. <sup>i</sup>
9. ⚠ **Publishing does not lock media the way it locks other publication data.** On a published
   article the Media manager stays fully editable for anyone with production-stage management access,
   and the save is accepted — so media can be corrected after publication without creating a new
   version; only the Author (already list-only) stays blocked. The editorial screen is even handed a
   "this version is published" lock signal but silently ignores it, so the write buttons look exactly
   as they do on a draft and the real gate is the save itself. This mirrors the galleys
   post-publication-editable outcome but is cleaner — there is no "View"-labelled-but-editable
   affordance. The ignored lock signal is a latent inconsistency (the Assistant edge is Open
   questions #1). Live-verified 2026-07-04: a Journal Manager deleted a media file on a published
   article and it was removed. <sup>j</sup>
10. **Reader side: a media file is served through the publication's galley download.** Media files
    have no reader page of their own; they reach readers as a **galley's resource**. The article
    download (owned by `galleys`) serves a requested file if it is the galley's own file, a
    **dependent** file of that galley file, **or a media file of the galley's publication** —
    anything else is Not Found. Because media are publication-scoped (rule 2), the *same* media file
    is reachable through **any** galley of that publication (e.g. an image embedded by two HTML
    galleys) — the sharing model. The stream sits behind the galley's usual access gate (subscription
    / payment / published), owned by `galleys`/`subscriptions`. **The media stream is NOT
    world-readable like the library-file page (ledger row 88):** an **unpublished** publication
    returns a real **Not Found** to an anonymous or non-previewing visitor *before* media are even
    considered, and the download itself still runs behind the galley gate — so a media file is
    reachable only when its galley is. Browser-verified 2026-07-04: anonymous download of a media
    file on an **unpublished** publication → **404** (no bytes); on a **published** one it serves
    through either galley. ⚠ No OJS theme surfaces the **high-resolution** variant to readers (the
    HTML embed filters it out), so a high-res file is reachable only by a hand-formed download URL —
    reader-side exposure of high-res variants is unbuilt (round-2 theme work, ledger row 59(d)). This
    spec owns the media entity + the download allow-list membership; the download page and its gate
    are `galleys`. <sup>k</sup>

<sup>a</sup> `submission_files` rows at file-stage Media(23), `assocType`=`ASSOC_TYPE_PUBLICATION`, `assocId`=publication; nullable `variant_type` ('web'|'high_resolution') + `variant_group_id` (FK to `variant_groups`, `ON DELETE set null`); `SubmissionFilesMigration` ·
<sup>b</sup> `MediaFileManager.vue` (props `publication`,`submission` only; `TableBodyGroup` by `variantGroupId`); `mediaFileManagerStore.js` (`useFetchPaginated` on `GET …/mediaFiles` → `{itemsMax, items}`; `mediaFilesGrouped`, web-first sort); `MediaFilesController::{getMany,add,link,linkMany,edit,delete}` (upload `POST …/mediaFiles`, link `PUT …/{id}/link` / `POST …/mediaFiles/link`, edit `PUT …/{id}`, delete `DELETE …/{id}`); live sub 2 GET `{itemsMax:2,…}` ·
<sup>c</sup> `MediaFilesController::add()` (`fileStage=SUBMISSION_FILE_MEDIA`, `assocType=ASSOC_TYPE_PUBLICATION`, `assocId=publication`); `submission-files` rule 6 (dependent files, file-stage 17); live media row `fileStage 23`, `assocType 1048588`, `assocId 2` ·
<sup>d</sup> `useMediaFileManagerAddFileModal.js` (`onFilesUploaded` → `POST …/mediaFiles` with `files: [{temporaryFileId, variantType, genreId, …}]`); `AddMediaFiles::rules()` (`variantType` required, `Rule::in(MediaVariantType::cases())`); `MediaFilesController::add()` (`DB::transaction`, `app('file')->add(uniqid())`, `Repo::submissionFile()->add()`, temp-file delete, rollback on `validate()` error drops just-copied physical files); `mediaFileManagerStore.js` `genreOptions` (`genre.dependent`) ·
<sup>e</sup> `useMediaFileImageLinking.js` (`isWebVersion`/`isHighResVersion`, genre-matched options); `useMediaFileManagerConfig.js` `getItemActions` (`MANUALLY_LINK_IMAGE` gated on `genreSupportsFileVariants`); `LinkMediaFile::after()` (422: `cannotLinkToSelf` / `cannotLinkSameVariantType` / `targetNotMediaFile` / `targetNotInSubmission`); `VariantGroup::link()` (`create([])`, stamps both files' `variantGroupId`; always a fresh 2-member group); live link 3→4 group 1, self-link 422 ·
<sup>f</sup> `VariantGroup::link()` (dissolves existing groups first via `unlink()`); `VariantGroup::unlink()` (null every member's `variantGroupId`, delete group row); `MediaFilesController::linkMany()` (batch); `link()` null `targetSubmissionFileId` → `unlink()`; live unlink → `variantGroupId: null`, group row gone ·
<sup>g</sup> `Repo::submissionFile()->getCommonMediaFileFields()` (the 12 fields); `VariantGroup::link()` (`array_intersect_key` primary→secondary); `VariantGroup::applyMetadataToSiblings()` (edit propagation) ·
<sup>h</sup> `MediaFilesController::delete()` (`Repo::submissionFile()->delete()` + `VariantGroup::cleanupAfterDelete()` in a transaction); `VariantGroup::cleanupAfterDelete()` (lone survivor ungrouped; ≤1 → group deleted); delete mechanics owned by `submission-files` rule 12 ·
<sup>i</sup> `MediaFileManagerConfigurations.permissions` (AUTHOR `MEDIA_FILE_LIST` only); `MediaFilesController::getGroupRoutes()` (SITE_ADMIN/MANAGER/SUB_EDITOR/ASSISTANT/AUTHOR) + `authorize()` (`PublicationAccessPolicy` read / `PublicationWritePolicy` write); live atester GET own 200 / DELETE own 401 `api.submissions.403.userCantEdit` / reviewer 401 ·
<sup>j</sup> `workflowConfigEditorialOJS.js` `media.getPrimaryItems` (passes `canEdit: permissions.canEditPublication`, ignored) vs `workflowConfigAuthorOJS.js` `media` (no `canEdit`); `MediaFileManager.vue` `defineProps` (no `canEdit`); `PublicationWritePolicy` → `PublicationCanBeEditedPolicy`; `Repository::canEditPublication()` (`_canUserAccessUnassignedSubmissions` permit; lock branch only when the user has no non-author assignment); live dbarnes DELETE on published pub 4 → 200, `itemsMax` 1→0 → ledger row 22(b) family / `galleys` rule 9 ·
<sup>k</sup> `ArticleHandler::download()` (allow-list = galley file ∪ its dependents ∪ the publication's Media files; else 404); `ArticleHandler::initialize()` (unpublished pub + anon/non-preview → 404 before the allow-list) + `userCanViewGalley()`; reader gate + page `galleys` rule 12; security-clean vs ledger row 88 (browser-verified 2026-07-04: anon media download on unpublished pub → 404); high-res reader-exposure gap ledger row 59(d)

## Side effects

- **Stored data:** uploading adds the file to the publication's media set (with its file record,
  metadata and revision history, plus the physical file); linking creates a pair record on the two
  files and re-linking or unlinking dissolves it; editing writes the metadata (and, on a pair, the
  partner's too); deleting removes the file and, via cleanup, any emptied pair. The file-level
  mechanics (physical de-dup, revision rows, cascade) are owned by `submission-files`. <sup>a</sup>
- **Activity history:** media uploads, edits and deletes produce the standard **File-uploaded /
  File-edited / File-deleted** history entries, surfaced in the Activity Log and the file's
  Information Center — owned by `submission-files` / `editorial-activity-log`. Linking or unlinking a
  pair writes **no** history entry of its own. <sup>b</sup>
- **No emails and no dashboard notifications** are sent for uploading, linking, editing or deleting a
  media file. There is no production-status prompt tied to media (unlike galleys' "Awaiting
  Galleys").
- **Reader usage stats:** a media-file download through a galley does **not** count as a reader usage
  event — only a download of the galley's *own* file is counted, never its served media/dependent
  resources (`galleys` rule 12). <sup>c</sup>

<sup>a</sup> `submission_files` (+ `_settings`, a `submission_file_revisions` row) at file-stage Media; `variant_groups` insert/delete + `variant_group_id` rewrites ·
<sup>b</sup> media add/edit/delete call `Repo::submissionFile()->{add,edit,delete}`, which emit the file event-log entries; no event for `VariantGroup::link()`/`unlink()` ·
<sup>c</sup> `UsageEvent` fires only for the galley's own file

## Settings that modify behavior

- **Submission-component genres** (Settings → Workflow → Components; owned by `workflow-settings`):
  which genres are **dependent** decides what the Add-Media genre dropdown offers (Image / Multimedia
  / HTML Stylesheet by default), and a genre's **"supports file variants"** flag (**Image** only by
  default) decides whether the web/high-res linking actions appear for that genre's files. Disabling
  all dependent genres would leave the upload dropdown empty, with a message saying no media types
  are available. <sup>a</sup>
- **Subscription / payment settings** (`subscriptions`, `payments`): gate the reader galley download
  that streams a media file (rule 10) — they do not change the manager.
- The server's file-storage directory and the PHP upload size caps bound the media upload (shared
  with all submission files; set in `config.inc.php`). No per-journal media file-size or file-type
  setting exists. <sup>b</sup>
- No setting enables/disables the Media tab itself — it is always present on the Publication menu.

<sup>a</sup> `genres.supports_file_variants` (`Genre::getSupportsFileVariants`); empty-dropdown message `publication.mediaFiles.upload.noMediaTypes` ·
<sup>b</sup> `config.inc.php` `files_dir` + PHP upload caps

## Cross-feature interactions

- **submission-files** (feature 24) — owns the media files' **byte store**, the schema, the
  temporary-file upload plumbing, the file history, the physical de-dup/cascade on delete, and the
  file-stage vocabulary; this spec owns the media **entity** (publication-scope, variant pairing,
  metadata-sync) and the manager. It also owns classic **dependent files** — a parallel mechanism the
  reader download serves alongside media (rule 10). <sup>a</sup>
- **galleys** (feature 26) — owns the galleys media serve, the reader **article/download** page and
  its access gate (rule 10). A media file is publication-scoped and thus shared across all a
  publication's galleys.
- **article-landing** (feature 38, not written) — owns the reader article page that surrounds the
  galley download links; this spec owns the media entity, not the reader page.
- **publication-versioning** — owns the published-version lock this spec's server honours but its
  screen ignores (rule 9). A new publication version starts from the versioned publication's own
  media set (versioning owns the copy scope): each media file is cloned onto the new version, and
  each web/high-res pair is re-created one-for-one with the same members — so the two-per-pair
  invariant survives versioning. <sup>b</sup>
- **document-library** (feature not-27) — the **distinct** reusable-document store; the feature map's
  hint tagging the library download pages under media-files is a keyword-match artifact — those
  surfaces are the library's and are claimed by `document-library` (including the row-88
  unauthenticated-disclosure hole, which media do **not** share — media serve through the galley
  download, not the library page). <sup>c</sup>
- **editorial-activity-log** — owns the File Information Center the "More Information" action opens
  and the Activity Log that renders the media files' history entries.

<sup>a</sup> file-stages Media(23) vs Dependent(17); `files`/`temporary_files` plumbing ·
<sup>b</sup> `Repository::version()` (old→new `$variantGroupMap`, same members); `canEditPublication` ·
<sup>c</sup> FEATURE-MAP `libraryFiles/download*` hint; ledger row 88

## Canonical scenarios

1. **Batch-upload media files** — a Journal Manager (dbarnes) on a production submission opens Publication →
   **Media**, clicks **Add Media File**, drags in two images, sets each genre to **Image** and one to
   **Web resolution** / the other to **High resolution**, and clicks **Upload Files**; both appear in
   the Media table with their name, type, size and date (browser-verified seed parity: two media
   files on the publication).
2. **Link a web variant to its high-res original** — the Journal Manager uses a web image's **Manually Link
   Media** action, picks the genre-matched high-resolution file, and links them; the two files render
   as one grouped pair (web row first) sharing a pair id, and the primary's caption/credit copy onto
   the partner (browser-verified via the link API: the pair formed; a self-link was refused).
3. **Batch-link web files to high-res counterparts** — with several web/high-res images uploaded, the
   Journal Manager opens **Batch Link Media**, chooses a high-res counterpart per web row (or "No
   high-resolution file"), and applies all pairings at once; each web file is paired with its chosen
   original and any prior pairing is dissolved.
4. **Share a media file across galleys (reader)** — a published article has two HTML galleys and one
   publication-scoped media image; an **anonymous Reader** reaches the **same** media file through
   **either** galley's download link, proving the "shared across galleys" model — the image lives
   once on the publication, not per galley. A file that is neither the galley's own file nor a media
   file of its publication is refused (Not Found). No OJS theme surfaces media to a reader (rule 10),
   so this is driven at the download link, not a rendered embed (browser-verified live: anonymous
   download of the media file through galley A **and** galley B → identical image bytes; a bogus file
   id → Not Found). **Security (browser-verified 2026-07-04):** the same media file on an
   **unpublished** publication → anonymous download refused with a real Not Found (no bytes) — media
   do **not** share the library-file unauthenticated-disclosure hole (ledger row 88); see rule 10.
5. **Author read-only boundary** — the submitting Author opens their Media tab and sees the media
   list (Id / File Name / Type / Size / Date) with **no** Add, Batch-Link or per-row actions; the
   server admits their list but refuses every change (browser-verified: atester's list of their own
   submission succeeded; atester's delete of their own media file was refused — "You are not allowed
   to edit this publication").
6. **Media stays editable on a published article** — a Journal Manager opens a *published* article's
   Media tab and the Add / Batch-Link / Edit / Delete affordances are all present and functional;
   uploading or deleting a media file on the published version succeeds without a new version
   (browser-verified: dbarnes, a Journal Manager, deleted a media file on the published version and
   it was removed — the published-lock exempts the Site Administrator, Journal Manager and Section
   Editor, rule 9).
7. **Delete a media file (pair cleanup)** — the Journal Manager deletes the high-resolution half of a linked
   pair from the row menu and confirms; the file is removed and its former web partner is left
   **standalone** (the now-single-member pair is cleaned up), not stranded in an empty pair.

## Known deviations (as-built ≠ intent)

- ⚠ **The published-lock reaches the media manager only through the API; the Vue ignores its `canEdit`
  prop.** `MediaFileManager.vue` declares only `publication`/`submission`, so the
  `canEdit: permissions.canEditPublication` the editorial config passes is dropped — write buttons show on
  a published version. The actual gate is the API's `PublicationWritePolicy`, which **exempts** Journal
  Managers and Section Editors (via `canEditPublication`'s unassigned-access permit) and blocks only pure
  Authors — so
  for the roles that *have* the buttons (editorial), UI and API agree that media stays editable on a
  published article (plausibly **intended** — media are correctable post-publication, like galleys; same
  family as ledger [row 22(b)](../../e2e/app-changes.md) and `galleys` rule 9). This is **not** flagged as
  data-loss. The residual oddity is the ignored prop itself: it would only bite a role that has the
  buttons but fails `canEditPublication` — an **Assistant** (layout editor) assigned to production
  *without* `canChangeMetadata` on a published version, who would see enabled Add/Delete buttons whose API
  calls 403. That narrow edge is unverified (Open questions).
- **TEST-INFRA (FIXED) — grouped-media scenario seeding had a dangling `VariantGroup::MAX_GROUP_SIZE`
  reference.** `PublicationsProcessor::seedMediaFiles()` (the wave-7 media seed path) validated group
  sizes against `VariantGroup::MAX_GROUP_SIZE`, but the current `VariantGroup` model (post the #12794
  batch-linking refactor) defines **no constants** — so a scenario with `mediaFiles[]` sharing a `group`
  label used to throw `Undefined constant … VariantGroup::MAX_GROUP_SIZE` (HTTP 500) while ungrouped
  seeding worked. **Fixed on this branch:** `PublicationsProcessor` now defines its **own**
  `private const MAX_GROUP_SIZE = 2` (matching the web + high-res pair cap `VariantGroup::link()` enforces
  in product code) — grouped seeding works, and the retained `media-files.spec.js` scenario 7 seeds a
  linked web/high-res pair directly via the `group` label (browser-verified 2026-07-04). Never a **product**
  bug (the cap is enforced implicitly by `link()`'s pairwise semantics; grep finds no product-code
  reference). `docs/e2e/app-changes.md` **row 93** (supersedes the wave-7 row 59(c) note, which assumed the
  constant still existed on the model).
- ⚠ **High-resolution media variants have no reader-side exposure.** The web/high-res distinction is a
  workflow-only concept — no OJS theme renders the high-res variant, and the HTML embed helper filters it,
  so a high-res file is reachable only by a hand-formed `ArticleHandler::download` URL, un-differentiated
  from any other served media. Reader-facing high-res delivery is unbuilt. Pre-existing ledger
  [row 59(d)](../../e2e/app-changes.md) (wave-7 media agent); recorded here, not re-proposed.

## Open questions

1. **Is the ignored `canEdit` prop a latent bug for Assistants on a published version?** For the roles
   that carry the media write buttons, the API's `canEditPublication` exemption makes the dropped prop
   harmless. It could diverge only for an **Assistant** assigned to production *without* `canChangeMetadata`
   on a published/scheduled publication. **Both halves are now code-confirmed** (2026-07-04): the Vue config
   grants the Assistant all seven actions gated *purely* on a production-stage assignment — no
   `canChangeMetadata` check (`useMediaFileManagerConfig.js` permissions) — so the buttons render; while
   `Repository::canEditPublication()` returns **false** for exactly that shape (the locked-publication
   branch is skipped because the Assistant holds a non-author assignment, then the `canChangeMetadata`
   test fails → deny), so the write **401s** (`userCantEdit`). The genuinely-open part is the **live
   affordance/reachability** — whether such an Assistant's Add/Link/Edit/Delete controls actually render
   *enabled* in the browser (unprobed; needs an Assistant seeded on production without `canChangeMetadata`
   on a published version). Should the manager honour `canEdit`, or is the state unreachable in practice?
2. **Should the Media API's HTTP status for a refused write be 403, not 401?** A blocked write returns
   **HTTP 401** with the body key `api.submissions.403.userCantEdit` — the status/body key mismatch is a
   PKP-wide convention (shared with other publication writes), not media-specific; flagged only for QA
   awareness.
3. **Does anything ever create a variant group of >2?** **Resolved — the "at most two" invariant is total
   in product code** (2026-07-04 grep of every `variant_group_id`/`variantGroupId` writer): `VariantGroup::link()`
   always builds a **fresh 2-member** group (dissolving any prior groups first); `unlink()`/`cleanupAfterDelete()`
   only null the column; and the **publication-versioning copy** (`Repository::version()`) clones each source
   group **1:1** through an old→new `$variantGroupMap`, so a copied group has exactly the source's members
   (≤2) — it never merges or grows. **No native-XML/import path writes variant groups at all** (grep of
   `plugins/importexport/native` finds none). So no code path can seed a group larger than two.

---

<!-- REFERENCE MATERIAL — provenance and campaign bookkeeping, not product-owner
     narrative. The PO-facing "where do I find this" is in Purpose. -->

## Reference — entry points & surfaces

| Entry | Path | Atom |
|-------|------|------|
| Media manager (tab) | Workflow → Publication → **Media** (`name: 'media'`, label `publication.media`); Vue `MediaFileManager` reading the media REST API | VUE-media-file-manager |
| List media | `GET api/v1/submissions/{id}/publications/{pubId}/mediaFiles[?variantGroupIds=&variantTypes=]` | API-media-files-get-many |
| Batch-upload media | `POST api/v1/submissions/{id}/publications/{pubId}/mediaFiles` (`files[]` of temporary-file ids + genre + variantType) | API-media-files-add |
| Batch link/unlink | `POST api/v1/submissions/{id}/publications/{pubId}/mediaFiles/link` (`links[]`) | API-media-files-link-many |
| Link/unlink one file | `PUT api/v1/submissions/{id}/publications/{pubId}/mediaFiles/{fileId}/link` (`targetSubmissionFileId`, null = unlink) | API-media-files-link |
| Edit media metadata | `PUT api/v1/submissions/{id}/publications/{pubId}/mediaFiles/{fileId}` (common fields sync to siblings) | API-media-files-edit |
| Delete media | `DELETE api/v1/submissions/{id}/publications/{pubId}/mediaFiles/{fileId}` | API-media-files-delete |
| Variant-group entity | `variant_groups`; `submission_files.variant_group_id` / `variant_type` | DB-variant_groups |
| Media file entity | `submission_files` rows at file-stage Media(23), assoc Publication *(store owned by submission-files)* | *(DB-submission_files — submission-files)* |
| Reader download | `article/download/{id}/{galleyId}/{mediaFileId}` → `ArticleHandler::download` (media allow-list) | *(PAGE-article-download — galleys)* |
| Locale namespace | `publication.mediaFiles.*` (panel, upload modal, link modals, actions) + `publication.media` (tab label) | LOC-submission-publication-mediaFiles |

## Reference — code anchors

- **Vue manager**: `lib/ui-library/src/managers/MediaFileManager/` — `MediaFileManager.vue` (props
  `publication`/`submission`; `TableBodyGroup` grouped by `variantGroupId`), `mediaFileManagerStore.js`
  (`useFetchPaginated` on `…/mediaFiles`; `genreOptions` = dependent genres; `mediaFilesGrouped` web-first
  sort), `useMediaFileManagerConfig.js` (`MediaFileManagerConfigurations.permissions`/`.actions`,
  `getManagerConfig` production-stage gate, `getColumns`/`getTopItems`/`getItemActions`),
  `useMediaFileManagerActions.js` (the `Actions` set + action launchers), `useMediaFileImageLinking.js`
  (`isWebVersion`/`isHighResVersion`, genre-matched high-res options), `useMediaFileManagerAddFileModal.js`
  (`FileMediaUploader` → `POST …/mediaFiles`), `MediaFileManagerBatchLinkImagesModal.vue` /
  `MediaFileManagerManualLinkImageFormModal.vue` / `MediaFileManagerMetadataFormModal.vue`.
- **REST controller**: `lib/pkp/api/v1/submissions/MediaFilesController.php` (`getHandlerPath`
  `…/mediaFiles`; `authorize()` — `ContextAccessPolicy`, `PublicationWritePolicy` on writes /
  `PublicationAccessPolicy` on read, `SubmissionFileMatchesSubmissionPolicy` +
  `SubmissionFileStageAccessPolicy` on edit/delete/link/linkMany; `getMany`/`add`/`link`/`linkMany`/
  `edit`/`delete`; `getSubmissionFileSchemaMap` adds `fileSize`) + `formRequests/{AddMediaFiles,
  EditMediaFile,LinkMediaFile,LinkManyMediaFiles,MediaFileValidationTrait}.php` (link 422 keys:
  `cannotLinkToSelf` / `cannotLinkSameVariantType` / `targetNotMediaFile` / `targetNotInSubmission`).
- **Variant model + enum + storage**: `lib/pkp/classes/submissionFile/VariantGroup.php`
  (`link`/`unlink`/`cleanupAfterDelete`/`applyMetadataToSiblings`),
  `lib/pkp/classes/submissionFile/enums/MediaVariantType.php` (`web`/`high_resolution`),
  `lib/pkp/classes/submissionFile/Repository.php::getCommonMediaFileFields()`;
  `lib/pkp/classes/migration/install/SubmissionFilesMigration.php` (`variant_groups` +
  `submission_files.variant_group_id`/`variant_type`); `SubmissionFile::SUBMISSION_FILE_MEDIA` = 23.
- **Genre variant flag**: `lib/pkp/classes/submission/Genre.php` (`getSupportsFileVariants`) +
  `GenreDAO.php` (`supports_file_variants` column); `schemas/submissionFile.json`
  (`genreSupportsFileVariants`, `variantGroupId`, `variantType`).
- **Workflow wiring**: `lib/ui-library/src/pages/workflow/WorkflowPageOJS.vue` (registers `MediaFileManager`);
  `…/useWorkflowConfig/workflowConfigEditorialOJS.js` + `workflowConfigAuthorOJS.js` (`media.getPrimaryItems`);
  `…/useWorkflowNavigationConfig/useWorkflowNavigationConfigOJS.js` (`name: 'media'` tab).
- **Published-lock**: `lib/pkp/classes/security/authorization/PublicationWritePolicy.php` →
  `internal/PublicationCanBeEditedPolicy.php`; `lib/pkp/classes/submission/Repository.php::canEditPublication()`.
- **Reader serve**: `pages/article/ArticleHandler.php::download()` (the dependent/media allow-list);
  `ArticleHandler::initialize()` (unpublished + anon/non-preview → 404); `userCanViewGalley()`.
- **Test seam (fixed)**: `lib/pkp/classes/testing/scenario/Processor/PublicationsProcessor.php::seedMediaFiles()`
  (now uses `PublicationsProcessor::MAX_GROUP_SIZE = 2` — grouped seeding works; ledger row 93); POM
  `lib/pkp/playwright/pages/MediaFileManagerPage.js`; retained test `playwright/tests/media-files.spec.js`
  (7 canonical scenarios → 6 tests); e2e plan `docs/e2e/plans/media-files.md`.
