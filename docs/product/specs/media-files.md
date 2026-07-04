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
spec owns the **Media manager** on the workflow **Publication → Media** tab, where editorial staff
**batch-upload** these files, tag each with a **dependent genre** (Image / Multimedia / HTML
Stylesheet) and a **resolution variant** (Web | High resolution), **link** a web-optimized image to
its **high-resolution original** into a **variant group**, **edit** the shared metadata (which
propagates to the group's other file), and **delete** them. Because a media file is attached to the
**publication** (not to one galley), any of that publication's galleys can reference and serve it —
that is the "shared across galleys" model. It also owns the media **REST API**
(`MediaFilesController`), the **variant group** entity (`variant_groups` + the `variant_group_id` /
`variant_type` columns), and the Vue **MediaFileManager**.

Media files are ordinary submission files at file-stage **Media** — their byte store, upload plumbing,
schema and file event-log belong to `submission-files`; this spec owns the **media entity** (which
files are media, their variant pairing and metadata-sync semantics) and the manager UI. The
**galleys** those media serve are `galleys`; the reader **article page** that surrounds the download
links is `article-landing`; the **published-lock** (`canEditPublication`) is `publication-versioning`.
The Media tab is **distinct** from the **Document Library** (`document-library` — a separate reusable
file store) and from classic per-file **dependent files** (`submission-files` rule 6 — file-stage
Dependent, attached to a *parent file*; media are file-stage Media, attached to the *publication*).

## Actors & permissions

Recurring terms and baselines, stated once. **Editorial roles** = journal manager, site admin,
assigned section editor (sub-editor) and assistant (layout editor / copyeditor / proofreader). Every
Media *management* capability is gated on **production-stage (stage 5) access** — the Vue manager
offers an action only to a user who **holds one of the permitted roles as a stage assignment on the
submission's production stage** (an *unassigned* manager/site-admin gets manager scope on every stage,
so they always qualify). The **author** sees the Media tab but gets **list-only** — no upload, link,
edit or delete. **Reviewers** are not a role in the media API at all. The Media tab sits on the
**Publication** menu right after Galleys and, like the other Publication tabs, is a live default tab in
both the editorial and the author OJS workflow. The **published-lock** is enforced *only at the API*
(rule 9): the Vue manager ignores it, but its write endpoints route through `PublicationWritePolicy`,
which exempts managers/sub-editors and locks only pure authors — so editorial users keep full media
CRUD on a published article and the author never had write access to begin with. Backend truth: the
REST role list + `PublicationWritePolicy` + the media file-stage access policy enforce the same gate the
Vue config reads. Live-probed 2026-07-04 on `publicknowledge` (dbarnes editor, atester author, jjanssen
reviewer). <sup>a</sup>

| Action | Who may — and when |
|--------|--------------------|
| **See / list media** (the Media tab) | • Editorial roles with production-stage access — the full manager<br>• The submitting **author** — **list-only** (Id, File Name, Type, Size, Date Uploaded columns; no Add / Batch-Link buttons, no per-row menu) on their own submission<br>• Reader — has no Media surface; media reach readers only as a galley's embedded/served resource (rule 10) <sup>b</sup> |
| **Batch-upload media** (Add Media File → the Upload Media File modal) | • Editorial roles with production-stage access — drag-drop one or more files, each given a dependent genre + a resolution variant<br>• Author — never <sup>c</sup> |
| **Link a web variant to a high-res original** (Manually Link Media, or Batch Link Media) | • Editorial roles with production-stage access — only on **variant-supporting** genres (Image by default); pairs one *web* file with one *high-resolution* file<br>• Author — never <sup>d</sup> |
| **Edit a media file's metadata** (Edit Metadata) | • Editorial roles with production-stage access — the shared media metadata (caption, credit, description, creator…); common fields propagate to the file's variant-group sibling<br>• Author — never <sup>e</sup> |
| **Delete a media file** (Delete File) | • Editorial roles with production-stage access — a warnable confirm; deleting cascades the file and tidies its variant group<br>• Author — never <sup>f</sup> |
| **View a media file's notes / history** (More Information) | • Editorial roles with production-stage access — opens the file's Information Center <sup>g</sup> |
| **Download a media file** (reader) | • Anyone who can view one of the publication's **galleys** — a media file is served through that galley's download route, behind the galley's own subscription/payment/published gate; ⚠ no theme surfaces the high-res variant, so it is reachable only by a hand-formed download URL (rule 10) <sup>h</sup> |

<sup>a</sup> `useMediaFileManagerConfig.js` `MediaFileManagerConfigurations.permissions` + `getManagerConfig()` (`hasCurrentUserAtLeastOneAssignedRoleInStage(submission, WORKFLOW_STAGE_ID_PRODUCTION, roles)`); `MediaFilesController::getGroupRoutes()` role list + `authorize()` (`PublicationWritePolicy` on writes, `PublicationAccessPolicy` on read); live 2026-07-04 (sub 2/3/4) ·
<sup>b</sup> `MediaFileManagerConfigurations.permissions` (AUTHOR → `[MEDIA_FILE_LIST]`; sub-editor/manager/site-admin/assistant → all actions); `MediaFileManager.vue` columns; live: atester GET on own sub 3 → 200 ·
<sup>c</sup> `getTopItems()` (`MEDIA_FILE_ADD` → "Add Media File"); `useMediaFileManagerAddFileModal.js` (`FileMediaUploader` → `POST …/mediaFiles`); `AddMediaFiles` form request ·
<sup>d</sup> `getTopItems()` (`MEDIA_FILE_BATCH_LINK_IMAGES` → "Batch Link Media"); `getItemActions()` (`MEDIA_FILE_MANUALLY_LINK_IMAGE` shown only when `mediaFile.genreSupportsFileVariants`); `MediaFilesController::link()`/`linkMany()`; live link 3→4 → group 1 ·
<sup>e</sup> `getItemActions()` (`MEDIA_FILE_EDIT_METADATA`); `MediaFilesController::edit()` → `VariantGroup::applyMetadataToSiblings()` ·
<sup>f</sup> `getItemActions()` (`MEDIA_FILE_DELETE`, `isWarnable`); `MediaFilesController::delete()` → `Repo::submissionFile()->delete()` + `VariantGroup::cleanupAfterDelete()`; live: dbarnes DELETE 200 (removed) ·
<sup>g</sup> `getItemActions()` (`MEDIA_FILE_INFO` → File Information Center, owned by `editorial-activity-log`) ·
<sup>h</sup> `ArticleHandler::download()` media allow-list (`ASSOC_TYPE_PUBLICATION` + fileStage Media); reader gate + page owned by `galleys` rule 12 / `article-landing`; high-res reader-exposure gap = ledger row 59(d)

## Fields & validation

Two on-screen forms: the **Upload Media File** modal (per-file genre + resolution, one row per dropped
file) and the per-row **Edit Metadata** side-modal (the shared descriptive metadata). The upload posts
directly to `POST …/mediaFiles`; a media file is not multilingual in its *content*, but its descriptive
fields are locale maps like any submission file. <sup>a</sup>

| Field (UI label) | Required? | Rules | Anchor |
|------------------|-----------|-------|--------|
| **File** (drag-drop, batch) | **Yes** | One or more files staged to temporary files by the media uploader, then copied into the submission's file store; each becomes a Media-stage submission file. The **Upload Files** button stays disabled until every dropped file has finished uploading and has a genre | `useMediaFileManagerAddFileModal.js` (`temporaryFiles` → `files[]`); `AddMediaFiles` (`files.*.temporaryFileId` required); `MediaFilesController::add()` |
| **What kind of media is this?** (genre) | **Yes** | A per-file select offering only the journal's **dependent** genres — by default **Image**, **Multimedia**, **HTML Stylesheet**. (Supplementary/document genres are not offered — the picker filters on `genre.dependent`) | `mediaFileManagerStore.js` `genreOptions` (`filter(genre => genre.dependent)`); live genres 9/10/11 dependent |
| **File resolution type** (variant) | **Yes** | **Web resolution** or **High resolution**. Required on every uploaded file; an invalid value is rejected. Drives variant-group pairing (rule 4) and the manager's grouping/sort. (The UI defaults it to Web) | `AddMediaFiles::rules()` (`files.*.variantType` required, `Rule::in(MediaVariantType::cases())`); `MediaVariantType` (`web` / `high_resolution`) |
| **Name** (upload / Edit Metadata) | No | The display name; defaults to the original filename when blank, stored as a locale map. Multilingual on the Edit form | `MediaFilesController::add()` (`name` default = original filename under the submission locale); `submissionFile.json` `name` |
| **Caption · Credit · Description · Creator · Publisher · Source · Subject · Sponsor · Date created · Language · Copyright owner · Terms** (Edit Metadata) | No | The shared descriptive media metadata; on a file that belongs to a **variant group**, saving any of these **also writes it to the group's sibling** (rule 6). Most are multilingual | `Repo::submissionFile()->getCommonMediaFileFields()`; `VariantGroup::applyMetadataToSiblings()`; `submissionFile.json` |

Server-set (not user-entered): `fileStage` = **Media**(23), `assocType` = **Publication**, `assocId` =
the publication id, `uploaderUserId`, `fileId`, `variantGroupId` (set by linking), `genreSupportsFileVariants`
(read-only, from the genre). <sup>b</sup>

## Rules & state

Media files hang off a **publication** (each publication version has its own media set). A media file is
a `submission_files` row at file-stage **Media**(23) with `assocType`=**Publication**, `assocId`=the
publication, plus a nullable **`variant_type`** ('web'|'high_resolution') and **`variant_group_id`** (FK
to `variant_groups`, `ON DELETE set null`). The genre is one of the journal's **dependent** genres. <sup>a</sup>

1. **The Vue MediaFileManager is the live surface; the media REST API is its backend.** The Media tab
   renders the **Vue `MediaFileManager`** — a table with columns **Id** (the variant-group id, spanning
   grouped rows), **File Name**, **Type** (genre), **Size**, **Date Uploaded**, and a per-row **More
   Actions** menu — with **Batch Link Media** and **Add Media File** buttons on top. It **lists from
   the REST API** (`GET submissions/{id}/publications/{pubId}/mediaFiles`), and every mutation is a REST
   call to `MediaFilesController`: upload → `POST …/mediaFiles`, manual/batch link → `PUT …/{id}/link` /
   `POST …/mediaFiles/link`, edit → `PUT …/{id}`, delete → `DELETE …/{id}`. Unlike galleys there is **no
   legacy grid** — the whole feature is Vue + a Laravel controller. The manager reads `publication` and
   `submission` props only. Live-verified (sub 2): the GET returns `{itemsMax, items}` of Media-stage
   files assoc'd to the publication. <sup>b</sup>
2. **A media file is a Media-stage submission file attached to the publication.** Uploading creates a
   `submission_files` row at `fileStage` Media(23), `assocType` Publication, `assocId` the publication —
   *not* attached to a galley. So a media file is **publication-scoped**: it exists once per publication
   version and is available to **every** galley of that publication (rule 10, the "shared across
   galleys" model). This is the seam vs. classic **dependent files** (`submission-files` rule 6), which
   live at file-stage Dependent(17) attached to a *parent submission file*; media are a parallel,
   publication-level store. The byte store, `files`/`temporary_files` plumbing, schema and file
   event-log all belong to `submission-files`; this spec owns the media entity + variant semantics. <sup>c</sup>
3. **Upload is a batch, and every file needs a genre + a resolution variant.** **Add Media File** opens
   the **Upload Media File** modal hosting a drag-drop uploader: each dropped file uploads to a
   temporary file, then the row shows a **genre** select (dependent genres only — Image / Multimedia /
   HTML Stylesheet) and a **File resolution type** select (Web / High resolution). **Upload Files** posts
   `files: [{temporaryFileId, variantType, genreId, …}]` to `POST …/mediaFiles`, which copies each temp
   file into the store and inserts a Media-stage row (`Repo::submissionFile()->add()`), deleting the temp
   file. `variantType` is **required and validated** to `web`|`high_resolution`; the whole batch is one
   DB transaction — a validation failure on any file rolls the batch back and drops the just-copied
   physical files. Live-verified: seeding two files (web + high-res) yields two Media rows (ids 3, 4). <sup>d</sup>
4. **A variant group pairs one *web* file with one *high-resolution* file.** **Manually Link Media** (a
   per-row action, shown only when the file's genre **supports file variants** — Image by default) and
   **Batch Link Media** (a top button, a table of every web file with a genre-matched high-res select
   per row) both call the link API. `link()` requires the two files to be **different variant types**
   (web ↔ high-res), the **same submission**, both **Media-stage**, and **not the same file** — else a
   422 (`cannotLinkToSelf` / `cannotLinkSameVariantType` / `targetNotMediaFile` / `targetNotInSubmission`).
   Linking creates a **`variant_groups`** row and stamps both files' `variant_group_id` with it; the
   manager then renders the pair inside one grouped `<tbody>` (web row first), sharing the group-id cell.
   A group holds **at most two** files — there is no explicit cap constant; the semantics enforce it
   (`link()` always builds a *fresh* 2-member group). Live-verified: `PUT …/3/link {targetSubmissionFileId:4}`
   → both files `variantGroupId: 1`; self-link → 422 "A file cannot be linked to itself." <sup>e</sup>
5. **Re-linking dissolves prior groups; the former sibling is left ungrouped.** If either file passed to
   `link()` already belongs to a group, that group is **unlinked first** (every member's
   `variant_group_id` set null, the group row deleted), then a new 2-member group is created — so linking
   never grows a group past two, and a file's old partner becomes standalone. `Batch Link Media` applies
   a whole set of web→high-res choices at once (`linkMany`), each pairing independent. Passing a **null**
   target **unlinks** the file (dissolves its group). Live-verified: `PUT …/3/link {targetSubmissionFileId:null}`
   → both files back to `variantGroupId: null`, group row gone. <sup>f</sup>
6. **On link and on edit, common metadata propagates from the primary to the group's sibling.** The
   "common media file fields" are **caption, copyrightOwner, creator, credit, dateCreated, description,
   language, publisher, source, sponsor, subject, terms**. When two files are **linked**, the primary's
   common fields are copied onto the secondary. When a grouped file's **metadata is edited** (`PUT …/{id}`),
   `applyMetadataToSiblings()` writes the same common-field edits to every other file in the group — so a
   web/high-res pair keeps one shared caption/credit/etc. Non-common fields (the name) stay per-file. <sup>g</sup>
7. **Deleting a media file cascades the file and tidies its variant group.** `DELETE …/{id}` runs
   `Repo::submissionFile()->delete()` (the standard submission-file delete — cascades dependents/notes,
   de-dups the physical file, writes the File-deleted event) inside a transaction, then, if the file was
   grouped, `VariantGroup::cleanupAfterDelete()`: if exactly **one** sibling remains it is **ungrouped**,
   and a group with **≤1** remaining member has its `variant_groups` row removed. So deleting the high-res
   half of a pair leaves the web file standalone, not dangling in an empty group. <sup>h</sup>
8. **Who may manage media = production-stage access; the author is list-only.** The Vue config grants the
   **author** only `MEDIA_FILE_LIST`; editorial roles get the full action set, each filtered by an actual
   **production-stage assignment** (manager/site-admin qualify everywhere via manager scope). The API
   enforces the same shape: the routes admit SITE_ADMIN/MANAGER/SUB_EDITOR/ASSISTANT/AUTHOR, but reads add
   `PublicationAccessPolicy` and **writes add `PublicationWritePolicy`** (rule 9), so a plain author is
   admitted to the **read** (LIST) and refused every **write**. Live-verified: author atester GET on own
   sub 3 → 200; atester DELETE own media file → **401 `api.submissions.403.userCantEdit`**; a reviewer
   (jjanssen) and a non-participant → 401 on the GET. <sup>i</sup>
9. ⚠ **The published-lock is enforced only at the API, and it exempts editorial roles — so media stays
   fully editable on a published article.** The editorial workflow config passes
   `canEdit: permissions.canEditPublication` to `MediaFileManager`, but the component **declares only
   `publication` and `submission` props** (the author config passes no `canEdit` at all), so the flag is
   **silently ignored** — the Media manager's write buttons show on a published version exactly as on a
   draft, gated purely by production-stage role. The real lock lives on the **API**: all five write
   actions route through `PublicationWritePolicy` → `PublicationCanBeEditedPolicy` →
   `Repo::submission()->canEditPublication()`, which **permits** site admins and anyone who can access
   unassigned submissions (managers, sub-editors) and only *denies* users whose sole assignment is Author.
   Net: **editorial users can upload / link / edit / delete media on a *published* publication** (both UI
   and API agree), while an author is blocked at both layers. This mirrors the galleys published-lock
   outcome (files may be corrected post-publication without a new version) but through a *different*
   mechanism, and it is cleaner than galleys — there is no "View"-labelled-but-editable affordance. The
   ignored `canEdit` prop is a latent inconsistency (see Open questions for the assistant-without-
   `canChangeMetadata` edge). **Live-verified 2026-07-04:** dbarnes (editor) `DELETE` of a media file on a
   **published** publication returned **200** and the file was removed (`itemsMax` 1 → 0). <sup>j</sup>
10. **Reader side: a media file is served through the publication's galley download.** Media files have
    no reader page of their own; they reach readers as a **galley's resource**. `ArticleHandler::download`
    (owned by `galleys` — `PAGE-article-download`) serves a requested file id if it is the galley's own
    file, a **dependent** file of that galley file, **or a media file of the galley's publication** —
    otherwise 404. Because media are publication-scoped (rule 2), the *same* media file is reachable
    through **any** galley of that publication (e.g. an image embedded by two HTML galleys) — the sharing
    model. The stream sits behind the galley's usual `userCanViewGalley()` access gate (subscription /
    payment / published), owned by `galleys`/`subscriptions`. **The media stream is NOT world-readable
    like the library-file page op (ledger row 88):** `ArticleHandler::initialize()` returns a real **404**
    for an **unpublished** publication when the requester is anonymous or cannot preview — *before* the
    media allow-list is even reached — and `download()` still runs behind `userCanViewGalley()`, so a media
    file is reachable only when its galley is. Browser-verified 2026-07-04: anon download of a media file
    on an **unpublished** publication → HTTP **404** (no bytes); on a **published** one it serves through
    either galley. ⚠ No OJS theme surfaces the **high-resolution**
    variant to readers (the HTML embed helper filters it), so a high-res file is reachable only by a
    hand-formed download URL — reader-side exposure of high-res variants is unbuilt (round-2 theme work,
    ledger row 59(d)). This spec owns the media entity + the allow-list membership; the download page and
    its gate are `galleys`. <sup>k</sup>

<sup>a</sup> `SubmissionFilesMigration` (`variant_groups`; `submission_files.variant_group_id`/`variant_type`); `SubmissionFile::SUBMISSION_FILE_MEDIA`=23; `ASSOC_TYPE_PUBLICATION` ·
<sup>b</sup> `MediaFileManager.vue` (props `publication`,`submission`; `TableBodyGroup` by `variantGroupId`); `mediaFileManagerStore.js` (`useFetchPaginated` on `…/mediaFiles`; `mediaFilesGrouped`, web-first sort); `MediaFilesController::{getMany,add,link,linkMany,edit,delete}`; live sub 2 GET `{itemsMax:2,…}` ·
<sup>c</sup> `MediaFilesController::add()` (`fileStage=SUBMISSION_FILE_MEDIA`, `assocType=ASSOC_TYPE_PUBLICATION`, `assocId=publication`); `submission-files` rule 6 (dependent files, file-stage 17); live media row `fileStage 23`, `assocType 1048588`, `assocId 2` ·
<sup>d</sup> `useMediaFileManagerAddFileModal.js` (`onFilesUploaded` → `POST …/mediaFiles`); `AddMediaFiles::rules()` (`variantType` required); `MediaFilesController::add()` (`DB::transaction`, `app('file')->add(uniqid())`, `Repo::submissionFile()->add()`, temp-file delete, rollback on `validate()` error); `mediaFileManagerStore.js` `genreOptions` (`genre.dependent`) ·
<sup>e</sup> `useMediaFileImageLinking.js` (`isWebVersion`/`isHighResVersion`, genre-matched options); `useMediaFileManagerConfig.js` `getItemActions` (`MANUALLY_LINK_IMAGE` gated on `genreSupportsFileVariants`); `LinkMediaFile::after()` (self/same-type/not-media/not-in-submission → 422); `VariantGroup::link()` (`create([])`, both `variantGroupId`); live link 3→4 group 1, self-link 422 ·
<sup>f</sup> `VariantGroup::link()` (dissolves existing groups first via `unlink()`); `VariantGroup::unlink()` (null every member's `variantGroupId`, delete group row); `MediaFilesController::linkMany()` (batch); `link()` null target → `unlink()`; live unlink → `variantGroupId: null` ·
<sup>g</sup> `Repo::submissionFile()->getCommonMediaFileFields()` (the 12 fields); `VariantGroup::link()` (`array_intersect_key` primary→secondary); `VariantGroup::applyMetadataToSiblings()` (edit propagation) ·
<sup>h</sup> `MediaFilesController::delete()` (`Repo::submissionFile()->delete()` + `VariantGroup::cleanupAfterDelete()` in a transaction); `VariantGroup::cleanupAfterDelete()` (lone survivor ungrouped; ≤1 → group deleted); delete mechanics owned by `submission-files` rule 12 ·
<sup>i</sup> `MediaFileManagerConfigurations.permissions` (AUTHOR `MEDIA_FILE_LIST` only); `MediaFilesController::getGroupRoutes()` (5-role list) + `authorize()` (`PublicationAccessPolicy` read / `PublicationWritePolicy` write); live atester GET own 200 / DELETE own 401 / reviewer 401 ·
<sup>j</sup> `workflowConfigEditorialOJS.js` `media.getPrimaryItems` (passes `canEdit`, ignored) vs `workflowConfigAuthorOJS.js` `media` (no `canEdit`); `MediaFileManager.vue` `defineProps` (no `canEdit`); `PublicationWritePolicy` (`PublicationCanBeEditedPolicy`); `Repository::canEditPublication()` (`_canUserAccessUnassignedSubmissions` permit; lock branch only when the user has no non-author assignment); live dbarnes DELETE on published pub 4 → 200, `itemsMax` 1→0 → ledger row 22(b) family / `galleys` rule 9 ·
<sup>k</sup> `ArticleHandler::download()` (allow-list = galley file ∪ its dependents ∪ the publication's Media files; else 404); `ArticleHandler::initialize()` (unpublished pub + anon/non-preview → 404 before the allow-list) + `userCanViewGalley()`; reader gate + page `galleys` rule 12; security-clean vs ledger row 88 (browser-verified 2026-07-04: anon media download on unpublished pub → 404); high-res reader-exposure gap ledger row 59(d)

## Side effects

- **Data:** upload inserts `submission_files` rows at file-stage Media (+ `_settings` for name/metadata,
  + a `submission_file_revisions` row) and a physical file; linking inserts/deletes `variant_groups`
  rows and rewrites `variant_group_id` on the affected files; editing writes `_settings` (and the
  sibling's on a group); deleting removes the file and, via cleanup, the emptied group row. All the
  submission-file-level mutations (physical de-dup, revision row, cascade) are owned by `submission-files`.
- **File event-log:** because media add/edit/delete call `Repo::submissionFile()->{add,edit,delete}`,
  they emit the standard **File-uploaded / File-edited / File-deleted** submission-file event-log entries
  (surfaced in the Activity Log + File Information Center) — owned by `submission-files` / `editorial-activity-log`.
  The variant-group link/unlink writes **no** event-log entry of its own.
- **No emails and no dashboard notifications** are sent for uploading, linking, editing or deleting a
  media file. There is no production-status prompt tied to media (unlike galleys' "Awaiting Galleys").
- **Reader usage stats:** a media-file download through a galley does **not** fire a usage event — the
  `UsageEvent` fires only for the galley's *own* file, not for its served media/dependent resources
  (`galleys` rule 12).

## Settings that modify behavior

- **Submission-component genres** (Settings → Workflow → Components; owned by `workflow-settings`):
  which genres are **dependent** decides what the Add-Media genre dropdown offers (Image / Multimedia /
  HTML Stylesheet by default), and a genre's **"supports file variants"** flag
  (`genres.supports_file_variants`, **Image** only by default) decides whether the web/high-res linking
  actions appear for that genre. Disabling all dependent genres would empty the upload dropdown
  (`publication.mediaFiles.upload.noMediaTypes`).
- **Subscription / payment settings** (`subscriptions`, `payments`): gate the reader galley download that
  streams a media file (rule 10) — they do not change the manager.
- `config.inc.php` `files_dir` + the PHP upload caps bound the media upload (shared with all submission
  files). No per-journal media file-size or file-type setting exists.
- No setting enables/disables the Media tab itself — it is always present on the Publication menu.

## Cross-feature interactions

- **submission-files** (feature 24) — owns the media files' **byte store**, the schema, the
  temporary-file upload plumbing, the file event-log, the physical de-dup/cascade on delete, and the
  file-stage constant vocabulary (Media(23)); this spec owns the media **entity** (publication-scope,
  variant pairing, metadata-sync) and the manager. It also owns classic **dependent files** (file-stage
  Dependent(17)) — a parallel mechanism the reader download serves alongside media (rule 10).
- **galleys** (feature 26) — owns the galleys media serve, the reader **article/download** page and its
  `userCanViewGalley()` access gate (rule 10). A media file is publication-scoped and thus shared across
  all a publication's galleys.
- **article-landing** (feature 38, not written) — owns the reader article page that surrounds the galley
  download links; this spec owns the media entity, not the reader page.
- **publication-versioning** — owns `canEditPublication` (the published-lock this spec's API honours but
  its Vue ignores, rule 9). A new publication version starts from the versioned publication's own media
  set (versioning owns the copy scope): `Repository::version()` clones each media file onto the new
  publication and **re-creates each variant group 1:1** (an old→new group map, same members) — so the
  ≤2-per-group invariant is preserved across versions.
- **document-library** (feature not-27) — the **distinct** reusable-document store; the FEATURE-MAP's hint
  tagging the `libraryFiles/download*` pages and library grids under media-files is a keyword-match
  artifact — those surfaces are the library's and are claimed by `document-library` (incl. the row-88
  unauthenticated-disclosure hole, which media do **not** share — media serve through the galley download,
  not the libraryFiles page op).
- **editorial-activity-log** — owns the File Information Center the "More Information" action opens and the
  Activity Log that renders the media files' file event-log entries.

## Canonical scenarios

1. **Batch-upload media files** — an editor (dbarnes) on a production submission opens Publication →
   **Media**, clicks **Add Media File**, drags in two images, sets each genre to **Image** and one to
   **Web resolution** / the other to **High resolution**, and clicks **Upload Files**; both appear in the
   Media table with their name, type, size and date (browser-verified seed parity: two Media-stage rows,
   ids 3 & 4, assoc'd to the publication).
2. **Link a web variant to its high-res original** — the editor uses a web image's **Manually Link
   Media** action, picks the genre-matched high-resolution file, and links them; the two files render as
   one grouped pair (web row first) sharing a variant-group id, and the primary's caption/credit copy onto
   the sibling (browser-verified via the REST link: `PUT …/3/link {4}` → both `variantGroupId: 1`;
   self-link → 422).
3. **Batch-link web files to high-res counterparts** — with several web/high-res images uploaded, the
   editor opens **Batch Link Media**, chooses a high-res counterpart per web row (or "No high-resolution
   file"), and applies all pairings at once; each web file is grouped with its chosen original and any
   prior pairing is dissolved.
4. **Share a media file across galleys (reader)** — a published article has two HTML galleys and one
   publication-scoped media image; an **anonymous** reader reaches the **same** media file through
   **either** galley's download route (`ArticleHandler::download` media allow-list), proving the "shared
   across galleys" model — the image lives once on the publication, not per galley. A file id that is
   neither the galley's own file nor a media file of its publication is refused (404). No OJS theme
   surfaces media to a reader (rule 10), so this is driven at the download route, not a rendered embed
   (browser-verified live: anon GET of the media file through galley A **and** galley B → identical PNG
   bytes; a bogus file id → 404). **Security (browser-verified 2026-07-04):** the same media file on an
   **unpublished** publication → anon download **404** (real Not-Found, no bytes) — media do **not** share
   the library-file unauthenticated-disclosure hole (ledger row 88); see rule 10.
5. **Author read-only boundary** — the submitting author opens their Media tab and sees the media list
   (Id / File Name / Type / Size / Date) with **no** Add, Batch-Link or per-row actions; the API admits
   their LIST but refuses every write (browser-verified: atester GET own submission → 200; atester DELETE
   own media file → 401 "You are not allowed to edit this publication").
6. **Media stays editable on a published article** — an editor opens a *published* article's Media tab and
   the Add / Batch-Link / Edit / Delete affordances are all present and functional; uploading or deleting
   a media file on the published version succeeds without a new version (browser-verified: dbarnes DELETE
   on published pub 4 → 200, the file removed — the published-lock exempts editorial roles, rule 9).
7. **Delete a media file (variant-group cleanup)** — the editor deletes the high-resolution half of a
   linked pair from the row menu and confirms; the file is removed and its former web partner is left
   **ungrouped** (the now-single-member variant group is cleaned up), not stranded in an empty group.

## Known deviations (as-built ≠ intent)

- ⚠ **The published-lock reaches the media manager only through the API; the Vue ignores its `canEdit`
  prop.** `MediaFileManager.vue` declares only `publication`/`submission`, so the
  `canEdit: permissions.canEditPublication` the editorial config passes is dropped — write buttons show on
  a published version. The actual gate is the API's `PublicationWritePolicy`, which **exempts** managers
  and sub-editors (via `canEditPublication`'s unassigned-access permit) and blocks only pure authors — so
  for the roles that *have* the buttons (editorial), UI and API agree that media stays editable on a
  published article (plausibly **intended** — media are correctable post-publication, like galleys; same
  family as ledger [row 22(b)](../../e2e/app-changes.md) and `galleys` rule 9). This is **not** flagged as
  data-loss. The residual oddity is the ignored prop itself: it would only bite a role that has the
  buttons but fails `canEditPublication` — an **assistant** (layout editor) assigned to production
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

1. **Is the ignored `canEdit` prop a latent bug for assistants on a published version?** For the roles
   that carry the media write buttons, the API's `canEditPublication` exemption makes the dropped prop
   harmless. It could diverge only for an **assistant** assigned to production *without* `canChangeMetadata`
   on a published/scheduled publication. **Both halves are now code-confirmed** (2026-07-04): the Vue config
   grants the assistant all seven actions gated *purely* on a production-stage assignment — no
   `canChangeMetadata` check (`useMediaFileManagerConfig.js` permissions) — so the buttons render; while
   `Repository::canEditPublication()` returns **false** for exactly that shape (the locked-publication
   branch is skipped because the assistant holds a non-author assignment, then the `canChangeMetadata`
   test fails → deny), so the write **401s** (`userCantEdit`). The genuinely-open part is the **live
   affordance/reachability** — whether such an assistant's Add/Link/Edit/Delete controls actually render
   *enabled* in the browser (unprobed; needs an assistant seeded on production without `canChangeMetadata`
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
  EditMediaFile,LinkMediaFile,LinkManyMediaFiles,MediaFileValidationTrait}.php`.
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
- **Reader serve**: `pages/article/ArticleHandler.php::download()` (the dependent/media allow-list).
- **Test seam (fixed)**: `lib/pkp/classes/testing/scenario/Processor/PublicationsProcessor.php::seedMediaFiles()`
  (now uses `PublicationsProcessor::MAX_GROUP_SIZE = 2` — grouped seeding works; ledger row 93); POM
  `lib/pkp/playwright/pages/MediaFileManagerPage.js`; retained test `playwright/tests/media-files.spec.js`
  (7 canonical scenarios → 6 tests); e2e plan `docs/e2e/plans/media-files.md`.
