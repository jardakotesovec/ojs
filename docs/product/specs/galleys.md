---
name: galleys
scope: Create, label, order and delete an article's published-format files — the galleys (a PDF/HTML/XML file OR a remote URL, each with a label and locale) — on the workflow Publication → Galleys tab, and serve them to readers as the article's view/download links rendered by the format plugins (pdf.js, inline HTML, JATS, Lens)
shared: pkp-lib          # the Galley entity/DAO/Repository/Collector/schema and the Vue GalleyManager live in lib/pkp + lib/ui-library (OMP publication-formats / OPS preprint-galleys share the model); OJS owns the ArticleGalleyGridHandler + ArticleGalleyForm, the ArticleHandler reader page, and the four render plugins
status: verified
e2e-plans: [galleys]
atlas-claims:
  - VUE-galley-manager
  - GRID-grid-article-galleys-article-galley-grid-handler
  - SCHEMA-galley
  - DB-publication_galleys
  - DB-publication_galley_settings
  - PAGE-article-download
  - PAGE-article-downloadsuppfile
  - PLUGIN-generic-htmlArticleGalley
  - PLUGIN-generic-pdfJsViewer
  - PLUGIN-generic-jatsTemplate
  - PLUGIN-generic-lensGalley
  - AUTHZ-representation-required-policy
  - AUTHZ-representation-upload-access-policy
---

# Galleys (the publication's published-format files)

## Purpose

A **galley** is a reader-facing rendition of an article in one format — the PDF, the full-text
HTML, a JATS XML, or a link to an externally-hosted copy. This spec owns the **Galleys manager**
on the workflow **Publication → Galleys** tab, where editorial staff turn the production-ready
files into the download/view links a reader ultimately clicks: **add** a galley, give it a
**label** ("PDF", "HTML", "全文") and a **locale**, attach **either an uploaded file or a remote
URL**, **reorder** the list, assign the galley a **DOI**, and **delete** it. It also owns the
galley **entity** (`publication_galleys` + settings, `schemas/galley.json`), the reader-facing
**download/view page** (`ArticleHandler`), and the four **format-render plugins**
(pdfJsViewer, htmlArticleGalley, jatsTemplate, lensGalley) that decide *how* each galley displays.

Galleys are *built* at the **production stage** (a layout editor's job) but *created and edited
here*, on the Publication tab — `production-stage` (feature 25) owns the stage workspace and the
"Awaiting Galleys" milestone prompt that clears once a galley exists; this spec owns the galley
CRUD. The galley's **file** is an ordinary submission file (a *proof* file) whose store mechanics
belong to `submission-files`; the galley's **DOI** is minted by `publication-identifiers` (feature
28); the reader **article landing page** that surrounds the galley links is `article-landing`
(feature 38). This spec owns the galley entity, its label/locale/type/order, and the download page
that streams it.

## Actors & permissions

Recurring terms and baselines, stated once: **editorial roles** = journal manager, site admin,
assigned section editor (sub-editor) and assistant (layout editor / copyeditor / etc.). Every
galley-management capability is gated on **production-stage (stage 5) access** — the Vue manager
offers an action only to a user who **holds one of the permitted roles as a stage assignment on
the submission's production stage** (an *unassigned* manager/site-admin gets manager scope on
every stage, so they always qualify). The **author** of the submission sees the Galleys tab but
gets **list-only** — no add/edit/delete/reorder. The **published-lock** (`canEditPublication`,
owned by `publication-versioning`) that hard-locks the metadata tabs is **not wired to this
manager** — see rule 9 (⚠). Reader-side view/download is a separate, public capability gated by
publication status + subscription/payment, not by editorial roles (rules 11–13). An **editorial
user without a production-stage assignment** does *not* get a list-only tab — `WorkflowStageAccessPolicy(PRODUCTION)`
refuses them the workflow/Galleys UI outright; **the only role that reaches a list-only Galleys tab
is the author** (their own submission — rule 8, scenario 11). Backend truth: the legacy
`ArticleGalleyGridHandler` role assignments and `canEdit()` stage check enforce the same gate the
Vue config reads; **browser-driven 2026-07-04** — the full matrix is exercised live by the retained
`playwright/tests/galleys.spec.js` (10 tests, all green): editor dbarnes full CRUD on sub 135
(production, unpublished) and on a published article; author list-only; unassigned copyeditor mfritz
refused the grid op. <sup>a</sup>

| Action | Who may — and when |
|--------|--------------------|
| **See / list galleys** (the Galleys tab) | • Editorial roles with production-stage access — the full manager<br>• The submitting author — **list-only** (Name + Language columns, no Add/Order, no row actions) on their own submission<br>• Reader — the public sees only *published* galleys as view/download links on the article page (rules 11–13) <sup>b</sup> |
| **Add a galley** (Add galley → the Create-New-Galley form) | • Editorial roles with production-stage access — any version, **including a published one** (the button stays; ⚠ rule 9)<br>• Author — never <sup>c</sup> |
| **Edit a galley's label / locale / remote URL / URL path** | • Editorial roles with production-stage access — the row's **Edit** action opens the metadata form; on a **published** version the action is relabelled **View** but still opens an editable, Save-enabled form (⚠ rule 9)<br>• Author — never <sup>d</sup> |
| **Attach / replace the galley's file** (Change File) | • Editorial roles with production-stage access — the row's **Change File** action opens the file-upload wizard (the file is a *proof* file, mechanics owned by `submission-files`)<br>• Author — never <sup>e</sup> |
| **Reorder galleys** (Order) | • Editorial roles with production-stage access — the **Order** button (shown when ≥1 galley) enables drag / up-down arrows, persisted on Save<br>• Author — never <sup>f</sup> |
| **Delete a galley** | • Editorial roles with production-stage access — the row's warnable **Delete** (also on a published version); deleting cascades the galley's file (rule 10)<br>• Author — never <sup>g</sup> |
| **Set the galley DOI / publisher-id** | • Editorial roles with production-stage access — the **Identifiers** tab inside the galley's Edit modal (shown only when a DOI or pub-id plugin is enabled for galleys); DOI *mechanics* owned by `publication-identifiers` <sup>h</sup> |
| **View / download a galley** (reader) | • Anyone — for a **published** article's galley, subject to the journal's subscription/payment gate (open access, subscribed user/domain, purchased article/issue, membership, PDF-only restriction)<br>• Editorial users & the author — may preview galleys on an **unpublished/unscheduled** article; the public gets a redirect to search for a non-published article <sup>i</sup> |

<sup>a</sup> `useGalleyManagerConfig.js` `GalleyManagerConfiguration.permissions` + `getManagerConfig()` (`hasCurrentUserAtLeastOneAssignedRoleInStage(..., WORKFLOW_STAGE_ID_PRODUCTION, roles)`); `ArticleGalleyGridHandler::__construct()` role assignments + `canEdit()` (`Repo::user()->canUserAccessStage(WORKFLOW_STAGE_ID_PRODUCTION, WORKFLOW_TYPE_EDITORIAL, ...)`); browser-driven 2026-07-04 ·
<sup>b</sup> `GalleyManagerConfiguration.permissions` (ROLE_ID_AUTHOR → `[GALLEY_LIST]` only; sub-editor/manager/site-admin/assistant → all actions); live: manager list shows Name/Language/More-Actions columns ·
<sup>c</sup> `getBottomItems()` (adds `GalleyManagerActionButton` only if `GALLEY_ADD` permitted); `ArticleGalleyGridHandler::addGalley()` role gate MANAGER/SITE_ADMIN/SUB_EDITOR/ASSISTANT; live: Add galley present on both sub 135 (unpublished) and sub 1 (published) ·
<sup>d</sup> `getItemActions()` (`GALLEY_EDIT` → label `common.view` when `publication.status === STATUS_PUBLISHED` else `common.edit`); `editGalley`/`editGalleyTab`/`updateGalley` ·
<sup>e</sup> `useGalleyManagerActions.js` `galleyChangeFile` (`FileUploadWizardHandler::startWizard`, `SUBMISSION_FILE_PROOF`, `ASSOC_TYPE_REPRESENTATION`); `submission-files` ·
<sup>f</sup> `getTopItems()` (`GalleyManagerSortButton` when `GALLEY_SORT` && `galleys.length`); `galleyManagerStore.js` `useOrdering` → `ArticleGalleyGridHandler::saveSequence` ·
<sup>g</sup> `galleyDelete` (`ArticleGalleyGridHandler::deleteGalley` → `Repo::galley()->delete()`); live: Delete offered in the row menu ·
<sup>h</sup> `editGalley()` (`editFormat.tpl` tabset: Edit-Metadata + Identifiers when `enablePublisherId`/pubId plugin enabled for `Representation`); `PublicIdentifiersForm`; DOI in `publication-identifiers` ·
<sup>i</sup> `ArticleHandler::userCanViewGalley()` (`Repo::submission()->canPreview` bypass; published + subscription/payment checks; non-published → redirect search); `payments`/`subscriptions`

## Fields & validation

The Create/Edit-Galley form (**"Create New Galley"** / edit-metadata tab) is one small form; the
**file** is not a field on it (it is attached separately via Change File — rule 4). All fields are
per-galley (a galley is single-locale, not multilingual). <sup>a</sup>

| Field (UI label) | Required? | Rules | Anchor |
|------------------|-----------|-------|--------|
| **Galley Label** | **Yes** | Free text, "Typically used to identify the file format (e.g. PDF, HTML, etc.)." Empty → refused. Not localized (one label per galley) | `ArticleGalleyForm` `label` check `editor.issues.galleyLabelRequired`; `submission.layout.galleyLabelInstructions` |
| **Language** | **Yes** | A select of the submission's publication languages (the journal's supported submission locales + the publication's added languages); the chosen locale must be one of them or the save is refused | `ArticleGalleyForm::__construct()` `locale` `FormValidatorCustom` (`in_array($locale, $submission->getPublicationLanguages(...))`, `editor.issues.galleyLocaleRequired`) |
| **This galley will be available at a separate website** (checkbox) → **URL of remotely-hosted content** | No | Ticking the box reveals the **remote URL** field; a galley with a remote URL needs no uploaded file (the reader link redirects to that URL — rule 11). Must be a valid URL | `articleGalleyForm.tpl` `remotelyHostedContent`/`urlRemote`; `schemas/galley.json` `urlRemote` (`validation: url`) |
| **URL Path** | No | An optional slug used in the galley's URL instead of its numeric id; alphanumeric with `.`/`-`/`_` separators, **not all-digits**, and **unique within the publication** (duplicate → "This URL path is already used"). | `ArticleGalleyForm::validate()` (`ctype_digit` → `publication.urlPath.numberInvalid`; `getByUrlPath` → `publication.urlPath.duplicate`); `FormValidatorRegExp` |

Server-set / not user-entered: `submissionFileId` (set by Change File, not the form), `publicationId`,
`seq` (set by reorder), `isApproved` (OMP-only, uncalled in OJS — rule 9), `doiId` (set by the
Identifiers tab). The read-only computed `urlPublished` is the galley's public URL.

## Rules & state

Galleys hang off a **publication** (one publication version → its own ordered galley list); a
galley is a **`Galley`/Representation** row in `publication_galleys` with its label/locale/urlPath/
urlRemote in `publication_galley_settings`. Its file, when it has one, is a submission file at
file-stage **Proof**(10) associated to the galley (`ASSOC_TYPE_REPRESENTATION`). <sup>a</sup>

1. **The Vue GalleyManager is the live surface; the legacy grid is its form/write backend (both
   live).** The Galleys tab renders the **Vue `GalleyManager`** (`managers/GalleyManager`), a small
   table — **Name** (the label), **Language**, and a per-row **More Actions** menu — with an
   **Order** button on top and **Add galley** at the bottom. It **lists straight from the
   publication's embedded `galleys` array** (`galleyManagerStore.js` `items: publication.galleys`),
   so there is no galley list REST call. Every **mutation**, however, is delegated to the legacy
   **`ArticleGalleyGridHandler`** as a modal or POST: **Add** → `addGalley` (the `ArticleGalleyForm`
   modal), **Edit/View** → `editGalley`→`editGalleyTab`→`updateGalley`, **Change File** → the file
   wizard, **Reorder** → `saveSequence`, **Delete** → `deleteGalley`, **DOI** →
   `identifiers`/`updateIdentifiers`. So both surfaces are live: the Vue manager owns the list +
   orchestration + delete-confirm; the legacy grid owns the add/edit forms, the reorder-persist and
   the identifiers sub-tab. (⚠ atlas note correction: the legacy grid backs the **full CRUD**, not
   just the pub-ids tab — see Known deviations.) There is **no REST galley controller** — the only
   REST galley route is the DOI write, owned by `publication-identifiers`. Verified live (sub 135):
   the Vue table, Order and Add galley all render; the Add form is a legacy `$$$call$$$` modal. <sup>b</sup>
2. **A galley is a label + locale + EITHER a file OR a remote URL (or, transiently, neither).** The
   Create form captures **label**, **locale**, an optional **remote URL** and an optional **URL
   path** — but **not** a file. A galley therefore starts life file-less: if it has neither a file
   nor a remote URL, the grid row emits an **`uploadFile`** prompt inviting the editor to attach one
   (`fetchRow`). The two content modes are mutually-substituting: a **remote-URL** galley links out
   to an external copy (no OJS-hosted file); a **file** galley streams an OJS-hosted proof file. Both
   modes carry the same label/locale/order. Verified live: the form shows Galley Label, Language, the
   "available at a separate website" checkbox → remote-URL field, and URL Path — no file input. <sup>c</sup>
3. **Label and locale are required; the locale must be a publication language.** Saving with an
   empty label is refused ("An issue galley label is required." — the message is shared with issue
   galleys), and the locale is validated to be one of the submission's publication languages
   (journal supported submission locales + any languages the publication added). This is why the
   language select never offers a locale the article isn't published in. <sup>d</sup>
4. **The galley file is a *proof* submission file, attached via Change File.** The row's **Change
   File** action opens the shared file-upload wizard targeting file-stage **Proof**
   (`SUBMISSION_FILE_PROOF`), associated to the galley (`ASSOC_TYPE_REPRESENTATION`), at the
   production stage. If the galley already has a file, the upload is treated as a **revision**
   (`revisedFileId`/`revisionOnly`) — replacing the file in place. HTML/XML galley files may carry
   **dependent files** (images/CSS the manuscript loads), managed from the galley form's dependent-
   files grid — the dependent-file mechanics are owned by `submission-files`, the store by the same.
   This spec owns the galley→file association; the file bytes and wizard are `submission-files`. <sup>e</sup>
5. **URL path is an optional, publication-unique slug.** Left blank, a galley is addressed by its
   numeric id; set, it must be alphanumeric (dot/dash/underscore separators), must **not** be a bare
   number, and must be unique among the publication's galleys — a duplicate or all-digit path is
   refused. It only changes the galley's URL, nothing else. <sup>f</sup>
6. **Ordering is a manual sequence.** The **Order** button (present whenever the list holds ≥1
   galley) turns the list into a sortable one (drag handle + up/down arrows); saving posts the new
   id order to `saveSequence`, which rewrites each galley's **`seq`**. The reader page and every
   galley list render in `seq` order. Order is per-publication. <sup>g</sup>
7. **The galley DOI lives on the Edit modal's Identifiers tab (seam).** When a DOI plugin (or a
   custom publisher-id) is enabled for **galleys**, the galley's Edit modal grows a second
   **Identifiers** tab where the galley's DOI / publisher-id is displayed and (re)assigned; it posts
   to the legacy grid's `updateIdentifiers`. The **DOI value, its format, minting and deposit** are
   owned by `publication-identifiers` (feature 28) and the `PUT /_dois/galleys/{galleyId}` backend
   route; this spec owns only the **field's presence** on the galley edit surface. With no pub-id
   plugin enabled the tab does not appear and the Edit modal is metadata-only. <sup>h</sup>
8. **Who may manage galleys = production-stage access; the author is list-only.** The Vue config
   grants the **author** role only `GALLEY_LIST`; the editorial roles get the full action set, each
   still filtered by an actual **production-stage assignment** (manager/site-admin qualify
   everywhere via manager scope). The legacy grid enforces the identical gate: its write ops
   (`addGalley`/`editGalley`/`updateGalley`/`deleteGalley`/`saveSequence`/`identifiers`) are assigned
   to manager/site-admin/sub-editor/assistant (the author gets only `fetchGrid`/`fetchRow`), and
   `canEdit()` re-checks production-stage access before showing Add/Edit/Order or accepting a save. An
   **editorial** user with no production-stage assignment does **not** land on a list-only tab — the
   surrounding `WorkflowStageAccessPolicy(PRODUCTION)` refuses them the workflow page and every grid
   op (an "…access to that stage of the workflow" refusal); the **only** role that reaches a
   list-only Galleys tab is the **author** on their own submission (live-confirmed 2026-07-04:
   unassigned copyeditor mfritz is refused the grid's add-galley op). <sup>i</sup>
9. ⚠ **The publication's published-lock does not gate galley editing — only the button *label*
   changes.** `GalleyManager.vue` declares only `publication` and `submission` props; the
   `canEdit: permissions.canEditPublication` prop the editorial workflow config passes it is
   **silently ignored** (the author config passes none). The manager's own gate is purely role +
   production-stage (rule 8), which stays true for editorial users on a published version. So on a
   **published** article an editor still sees **Add galley**, **Order** and **Delete**, and the
   legacy form's editability keys on `canEdit()` = *production-stage access*, **not** publication
   status — so its Save stays enabled. The **only** effect of a published status is cosmetic: the
   row's edit action is relabelled **"View"** (icon `View`) instead of **"Edit"**, yet it opens the
   same editable, Save-enabled form. Net: galleys **can be added, edited, replaced, reordered and
   deleted on a published article** (plausibly intended in OJS — e.g. posting a corrected PDF without
   a new version), but the "View" label misrepresents an editable form. **Live-verified end-to-end
   (2026-07-04, `galleys.spec.js`):** on a published article the Galleys tab shows **Add galley**
   beside the shared "this version has been published" warning banner; the row action reads **View**
   (not Edit); opening it yields a **Save-enabled** metadata form; and a **label edit PERSISTS** on
   the published publication — the full ⚠ driven, not merely code-read. Confirmed ledger
   [row 22(b)](../../e2e/app-changes.md) (also cited by `publication-versioning` rule 13). The
   `galley.cantEditPublished` error string exists but its guard is
   `!$isEditable` = *no production-stage access*, not published status, so it is effectively a
   stage-access guard, not a published guard. <sup>j</sup>
10. **Deleting a galley cascades its file and recomputes the production prompt.** `Repo::galley()->
    delete()` deletes the galley row **and every submission file associated to it** (`ASSOC_TYPE_
    GALLEY`) — the proof file goes with the galley. The grid's `deleteGalley` additionally clears the
    galley's notifications and, if the submission is at editing/production, **recomputes the
    `Assign-a-user`/`Awaiting-Galleys` status prompt** for the assigned editors (the
    `production-stage` milestone). Symmetrically a galley **created or edited** through the grid
    (`updateGalley` — the form-save op; `addGalley` merely opens the create form and does not
    recompute) runs the same recompute. ⚠ A galley added/removed **off the grid path** (an import or a scenario seed)
    does *not* run this recompute, so "Awaiting Galleys" can go stale — the `production-stage` row-83
    seam (owned there). <sup>k</sup>
11. **Reader view: galleys are grouped, and a remote galley redirects out.** On the article page
    (`ArticleHandler::view`) galleys are split into **primary** (a remote URL, or a file whose genre
    is a *primary* submission-component genre) and **supplementary** (a file with a supplementary
    genre) and listed in `seq` order. Opening a **remote-URL** galley redirects the reader straight
    to that external URL. Opening a **file** galley fires the **`ArticleHandler::view::galley`** hook
    — the render plugins (rule 13) claim it by file type; if no plugin handles it the page redirects
    to the raw **download**. Older article versions add a `noindex` robots header. <sup>l</sup>
12. **Reader download: access-gated file stream (or remote redirect).** `ArticleHandler::download`
    (`PAGE-article-download`) serves the galley's file: a **remote** galley redirects to its URL; a
    **file** galley is streamed **after `userCanViewGalley()`** — editorial users / the author may
    fetch unpublished galleys; a published article's galley is gated by the journal's
    subscription/payment rules (open access, subscribed user/domain, purchased article/issue,
    membership, or a PDF-only restriction that frees non-PDF galleys), else a login or subscriptions
    redirect. A download id that is neither the galley file nor one of its dependent/media files
    → 404. A successful galley-file download emits a **usage-stats event**. The legacy
    **`downloadSuppFile`** URL (`PAGE-article-downloadsuppfile`) is a **deprecated OJS-2 compatibility
    handler**: it looks up the submission, matches the old supp-id against the current publication's
    files/galleys, then **301-redirects** into this `download` op (else 404) — for old
    supplementary-file links. The subscription/payment gate itself is owned by
    `subscriptions`/`payments`; this spec owns the download entry point and the remote-redirect. <sup>m</sup>
13. **Four format-render plugins ship enabled and decide *how* a galley displays.** Each is a generic
    plugin whose default `settings.xml` sets `enabled=true` on journal creation — **all four are on
    by default** (live-verified for publicknowledge). By file type: **pdfJsViewer** renders an
    `application/pdf` galley in an embedded **pdf.js** viewer; **htmlArticleGalley** renders a
    `text/html` galley **inline** (wrapped in the theme, serving its dependent images via the
    download hook); **lensGalley** renders an `application/xml`/`text/xml` galley in the embedded
    **eLife Lens** reader; **jatsTemplate** generates/attaches the article's **JATS XML** (feeds the
    JATS-over-OAI metadata format and a JATS content route). A galley whose type no plugin claims
    falls through to a raw file download (rule 11). Disabling a plugin (Settings → Website → Plugins)
    makes that format download raw instead of rendering. <sup>n</sup>
14. **No galley "approval" gate in OJS.** The Galley/Representation model carries an `isApproved`
    flag, but **no OJS caller acts on it** — it is the OMP publication-format-approval concept. Its
    *only* OJS reference is the **native-XML export filter**, which serializes the flag as an
    `approved` attribute (no importer reads it back into behaviour and there is no `setIsApproved`
    caller) — so it round-trips but gates nothing. In OJS a galley is live the moment it exists on a
    published publication; there is no proof sign-off before it reaches readers (noted also by
    `production-stage`). <sup>o</sup>

<sup>a</sup> `publication_galleys`/`publication_galley_settings` (`OJSMigration`); `schemas/galley.json`; `SUBMISSION_FILE_PROOF`=10, `ASSOC_TYPE_REPRESENTATION` ·
<sup>b</sup> `GalleyManager.vue` (props `publication`,`submission` only); `galleyManagerStore.js` (`items: publication.galleys`); `useGalleyManagerActions.js` (`galleyAdd`/`galleyEdit`/`galleyChangeFile`/`galleyDelete` → `useLegacyGridUrl` `grid.articleGalleys.ArticleGalleyGridHandler`; `saveSequence`); `ArticleGalleyGridHandler` ops `addGalley,editGalley,editGalleyTab,updateGalley,deleteGalley,identifiers,updateIdentifiers,clearPubId,saveSequence,fetchGrid,fetchRow`; no REST galley controller (only `api/v1/_dois/BackendDoiController::editGalley`) ·
<sup>c</sup> `ArticleGalleyForm` (`label/locale/urlPath/urlRemote` user vars; no file); `ArticleGalleyGridHandler::fetchRow()` (`!urlRemote && !submissionFileId` → `uploadFile` event); live form probe ·
<sup>d</sup> `ArticleGalleyForm::__construct()` (`FormValidator label required`; `FormValidatorCustom locale` on `getPublicationLanguages()`) ·
<sup>e</sup> `useGalleyManagerActions.js` `galleyChangeFile` (`SUBMISSION_FILE_PROOF`, `ASSOC_TYPE_REPRESENTATION`, `revisedFileId`/`revisionOnly` when a file exists); `articleGalleyForm.tpl` dependent-files grid (`supportsDependentFiles`); `submission-files` rule 6 ·
<sup>f</sup> `ArticleGalleyForm::validate()` (`ctype_digit`→`urlPath.numberInvalid`; `Repo::galley()->getByUrlPath()`→`urlPath.duplicate`); `schemas/galley.json` `urlPath` regex ·
<sup>g</sup> `useGalleyManagerConfig.js` `getTopItems`; `galleyManagerStore.js` `useOrdering` `onSave`→`saveSequence`; `ArticleGalleyGridHandler::{initFeatures→OrderGridItemsFeature, setDataElementSequence→Repo::galley()->edit(seq)}` ·
<sup>h</sup> `ArticleGalleyGridHandler::{editGalley (editFormat.tpl tabset, enableIdentifiers), identifiers, updateIdentifiers, clearPubId}`; `publicIdentifiersForm.tpl` (`$pubObject instanceof Galley`); `BackendDoiController::editGalley` (`PUT _dois/galleys/{galleyId}`); `publication-identifiers` ·
<sup>i</sup> `GalleyManagerConfiguration.permissions`; `ArticleGalleyGridHandler::__construct()`/`canEdit()` ·
<sup>j</sup> `GalleyManager.vue` `defineProps` (no `canEdit`); `workflowConfigEditorialOJS.js` `galleys.getPrimaryItems` (passes `canEdit: permissions.canEditPublication`, ignored); `workflowConfigAuthorOJS.js` `galleys` (no canEdit); `useGalleyManagerConfig.js` `getItemActions` (`STATUS_PUBLISHED ? common.view : common.edit`); `ArticleGalleyForm` `_isEditable = canEdit()` (the `galley.cantEditPublished` error fires only on `!$_isEditable`, i.e. no production-stage access — never on published status); live `galleys.spec.js` scenario 9 (published article: Add galley + banner both shown, row action "View", form Save-enabled, label edit persists) → ledger row 22(b) ·
<sup>k</sup> `Repo::galley()->delete()` (cascade `ASSOC_TYPE_GALLEY` submission files); `ArticleGalleyGridHandler::deleteGalley()/updateGalley()` (`NotificationManager::updateNotification([ASSIGN_PRODUCTIONUSER, AWAITING_REPRESENTATIONS])` when stage EDITING/PRODUCTION); `production-stage` rule 5 / row-83 ·
<sup>l</sup> `ArticleHandler::view()` (primary/supplementary genre split; `urlRemote`→`redirectUrl`; `Hook::call('ArticleHandler::view::galley')` else redirect `download`) ·
<sup>m</sup> `ArticleHandler::download()` (`urlRemote`→redirect; `userCanViewGalley()`; dependent/media file id allow-list; `UsageEvent`); `ArticleHandler::downloadSuppFile()`; `subscriptions`/`payments` ·
<sup>n</sup> `PdfJsViewerPlugin`/`HtmlArticleGalleyPlugin`/`LensGalleyPlugin`/`JatsTemplatePlugin` `register()` (hook `ArticleHandler::view::galley` by `getFileType()`; jatsTemplate hooks `OAIMetadataFormat_JATS::findJats` + `LoadHandler`); each `settings.xml` `enabled=true`; live plugin_settings ctx 1 all = 1 ·
<sup>o</sup> `Representation::getIsApproved()/setIsApproved()` — no OJS caller **that acts on it** (OMP publication-format concept); the sole OJS reader is `ArticleGalleyNativeXmlFilter` (`->getIsApproved()` → `approved` XML attribute on export; no `setIsApproved` caller, no behaviour gate); `production-stage` Known deviations

## Side effects

- **Data:** add/edit/delete write `publication_galleys` (+ `_settings` for label/locale/urlPath/
  urlRemote/publisher-id); reorder rewrites each galley's `seq`. **Delete cascades** the galley's
  proof file (and its dependents) through `submission-files`. Add/edit fire the `Galley::add` /
  `Galley::edit` / `Galley::delete` hooks (plugin extension points). Attaching a file goes through
  the submission-file store (its own event-log entries, owned by `submission-files`).
- **Production status prompt:** a galley add/delete/update **through the grid** recomputes the
  assigned editors' `Assign-a-user-to-create-galleys` / `Awaiting-Galleys` inline notifications when
  the submission is at editing/production (the `production-stage` milestone). ⚠ A galley created off
  the grid path does not recompute it (row-83 seam).
- **Reader usage stats:** a successful galley-**file** download emits a `UsageEvent` (fed to
  `usage-statistics`); a remote-URL galley redirect does not.
- **No email or dashboard notification** is sent for creating, editing, reordering or deleting a
  galley. Assigning a galley **DOI** and any deposit are side effects owned by
  `publication-identifiers` / `doi-management`.

## Settings that modify behavior

- **Format-render plugins** (Settings → Website → Plugins): pdfJsViewer / htmlArticleGalley /
  lensGalley / jatsTemplate are **enabled by default**; disabling one makes that file type download
  raw instead of rendering in-browser (rule 13). No per-galley render setting exists.
- **DOI / publisher-id for galleys** (Settings → Distribution → DOIs; custom pub-id plugins): enabling
  a pub-id type for **Representation/galley** is what surfaces the **Identifiers** tab on the galley
  Edit modal (rule 7).
- **Subscription / payment settings** (`subscriptions`, `payments`): `restrictArticleAccess`,
  subscription requirement, article/issue purchase, membership and the **PDF-only** restriction all
  gate the reader galley **download** (rule 12) — they do not change the manager.
- **Submission-component genres** (Settings → Workflow → Components; owned by `workflow-settings`):
  which genres are *primary* vs *supplementary* decides how a **file** galley is grouped on the
  reader page (rule 11).
- No setting changes the galley form fields, the CRUD gate or the reorder.

## Cross-feature interactions

- **production-stage** (feature 25) — owns the stage-5 workspace and the "Assign a user / Awaiting
  Galleys" milestone prompt that a galley add/delete clears; this spec owns the galley CRUD it is a
  proxy for, and recomputes that prompt on the grid path (rule 10 / row-83 seam).
- **submission-files** (feature 24) — owns the proof-file store, the upload wizard the Change-File
  action launches, and dependent files; this spec owns the galley→file association, label, type and
  order. `GRID-manage-proof-files` (the proof-file select grid) is claimed by `production-stage` as
  the proof exchange.
- **publication-identifiers** (feature 28, not yet written) — owns the galley **DOI** value, minting,
  the `PUT /_dois/galleys/{id}` route and the deposit; this spec owns only the DOI field's presence
  on the galley Edit modal's Identifiers tab (seam).
- **article-landing** (feature 38, not yet written) — owns the reader article page that *surrounds*
  the galley view/download links (metadata, license, how-to-cite); this spec owns the galley entity,
  the primary/supplementary grouping and the download page it links to.
- **publication-versioning** — owns `canEditPublication`; ⚠ this manager does **not** honour it
  (rule 9). Creating a new version copies the JATS and media files but the galley set is
  per-publication (a new version starts from the versioned publication's galleys — versioning owns
  the copy scope).
- **jats-content-api** (parked/unmapped) — owns the JATS **content API** (upload/visibility/public
  download) and the `oaiJats` OAI format; this spec claims the **jatsTemplate render plugin** per the
  feature map (it renders/attaches the JATS galley) — a seam to reconcile if jats-content-api is
  written (Open question).
- **media-files** (feature 27) / **issue-management** — own the publication Media tab (variant/
  supplementary files shareable across galleys) and **issue** galleys (a separate entity,
  `issue_galleys`); neither is an article galley.
- **subscriptions / payments / usage-statistics** — gate and meter the reader galley download.

## Canonical scenarios

1. **Add a file galley** — Editor (dbarnes) on a production submission opens Publication → Galleys,
   clicks **Add galley**, enters label "PDF" and a language, saves; the galley appears in the list,
   then **Change File** uploads the PDF as its proof file. The "Awaiting Galleys" production prompt
   clears once the first galley exists (browser-verified: the Add form and manager render on sub 135).
2. **Add a remote-URL galley** — Editor adds a galley, ticks **"This galley will be available at a
   separate website,"** enters the external URL and a label ("External HTML"), and saves; the galley
   needs no uploaded file and, for readers, links straight out to that URL.
3. **Edit a galley's label / locale** — Editor uses the row's **Edit** action to rename a galley or
   change its language; the change persists on the galley row.
4. **Reorder galleys** — With two or more galleys, the editor clicks **Order**, drags PDF above HTML
   (or uses the arrows), and saves; the new sequence drives every galley list and the reader page.
5. **Assign a galley DOI** — With a DOI plugin enabled for galleys, the editor opens a galley's Edit
   modal, switches to the **Identifiers** tab, and assigns/edits the galley DOI (mechanics owned by
   `publication-identifiers`); with no pub-id plugin the tab is absent.
6. **Delete a galley** — Editor deletes a galley from the row menu and confirms; the galley and its
   proof file are removed, and (on the grid path) the production status prompt recomputes.
7. **Reader downloads a galley (PDF.js render)** — A reader opens a published article, clicks the
   **PDF** galley, and the pdfJsViewer plugin renders it in the embedded pdf.js viewer; the raw file
   is one click away and the download is metered as a usage event (**browser-verified 2026-07-04**:
   `galleys.spec.js` seeds a published PDF galley — an anonymous reader gets the `#pdfCanvasContainer`
   iframe pointed at `pdf.js/web/viewer.html` + a raw-download link, and the download streams
   `application/pdf` bytes; the four render plugins are default-enabled in the live DB).
8. **Reader hits the access gate** — On a subscription article without access, clicking a galley
   triggers the subscription/login/purchase gate instead of the file (owned by
   `subscriptions`/`payments`); an open-access or subscribed reader gets the file. **Browser-verified
   2026-07-04** for the unpublished-galley gate: an anonymous reader is **404'd** on both the galley
   view and download of an unpublished article, while the editor (canPreview) fetches the same file.
9. **Galley CRUD on a published article** — Editor opens a *published* article's Galleys tab: the
   "this version has been published" banner shows, yet **Add galley**, **Order** and **Delete**
   remain and the existing galley's action reads **View** but opens an editable form — an editor can
   post a corrected galley without a new version (**browser-verified 2026-07-04**: banner + Add galley
   render together; the row action reads "View"; opening it yields a Save-enabled form and a **label
   edit persists** on the published publication — the ⚠, ledger row 22b).
10. **Author boundary** — The submitting author opens their Galleys tab and sees the galley list
    (Name/Language) **read-only** — no Add galley, no Order, no per-row More-Actions menu (author role
    → `GALLEY_LIST` only; **browser-verified 2026-07-04**: atester sees the seeded galley row but none
    of the management affordances).
11. **Permission boundary — no production access** — An **editorial** user with no production-stage
    assignment on the submission (copyeditor mfritz) is refused the Galleys UI **entirely**:
    `WorkflowStageAccessPolicy(PRODUCTION)` blocks the workflow page and the legacy grid's add-galley
    op returns an "…access to that stage of the workflow" refusal, whereas the assigned editor
    (dbarnes) gets the Create-New-Galley form. The list-visible-but-no-actions case is the **author's**
    (scenario 10), *not* an unassigned editor's (**browser-verified 2026-07-04**).

## Known deviations (as-built ≠ intent)

- ⚠ **The published-lock is not wired to the galley manager; a published galley's action says "View"
  but the form is editable.** `GalleyManager.vue` ignores the `canEditPublication` prop the editorial
  config passes it, and the legacy form's editability keys on production-stage access rather than
  publication status — so on a published article Add/Edit/Delete/Order all stay available and Save
  stays enabled, while the row action is merely relabelled Edit→View (rule 9). The *permissiveness*
  is plausibly **intended** for OJS (galleys are files you may correct post-publication without a new
  version — the metadata tabs are the versioned surface, galleys are not), so this is **not** flagged
  as data-loss or a hard bug; the genuine oddity is the **"View" label over an editable, Save-enabled
  form**, which contradicts the affordance. **Confirmed live end-to-end** (`galleys.spec.js` scenario
  9, 2026-07-04): the row action reads "View", the form is Save-enabled, and a label edit persists on
  a published article. Ledger [**row 22(b)**](../../e2e/app-changes.md) (the wave-6 galleys finding;
  also cited by `publication-versioning` rule 13) — this is a *confirmed* row, not a proposed
  candidate. Residual intent question (label vs. gate) parked in Open questions 1.
- ⚠ **A remotely-hosted galley still opens the file-upload wizard the user must cancel.** The Vue port
  lost the legacy `!urlRemote` gate: `useGalleyManagerActions.js` `galleyAdd` **always** chains
  `galleyChangeFile` (the Change-File proof-upload wizard) after a create, keying only on "a galley id
  was returned" — never inspecting `urlRemote`. So adding a *remote-URL* galley (which needs no
  OJS-hosted file, rule 2) pops the file wizard, which the editor must dismiss. Minor UX regression
  (no data loss); ledger [**row 22(a)**](../../e2e/app-changes.md) (same wave-6 row as the
  published-lock finding). The retained `galleys.spec.js` scenario 2 works around it by re-opening the
  panel — the remote galley already persisted.
- ⚠ **Atlas liveness note is under-stated.** `grids.md` records `ArticleGalleyGridHandler` as
  both-live "backing the pubIds identifiers tab, not full galley CRUD." In fact the legacy grid backs
  the **entire** galley CRUD — the Add/Edit forms, Delete, reorder-persist **and** the identifiers
  tab — all invoked as modals/POSTs from the live Vue GalleyManager (rule 1). Not a product bug; a
  correction to the atlas liveness annotation (the Vue manager is primary for the list + orchestration,
  the legacy grid is the form/write backend). No ledger row needed.
- ⚠ **`galley.cantEditPublished` is misnamed.** The error string reads as a published-status guard,
  but its trigger is `!$isEditable` = *no production-stage access* (`ArticleGalleyForm::validate()`),
  so it never actually fires on "published" grounds — it is a stage-access guard with a published-
  sounding message. Low severity, no data effect. (Same string is reused by the pub-ids form.)
- ⚠ **No galley approval step (OMP-only `isApproved`).** As in `production-stage`: no OJS caller acts
  on the Representation `isApproved` flag (its sole OJS reference is the native-XML export filter,
  which serializes it as an `approved` attribute without reading it back); a galley is reader-live as
  soon as it exists on a published publication. Dead-code/OMP-only note; recorded under
  `production-stage`.

## Open questions

1. **[As-built resolved; intent open] Is the galley manager's independence from `canEditPublication`
   intended (rule 9)?** The as-built is **confirmed live** and is a **confirmed ledger row (22b)** — no
   longer a candidate: galleys stay add/edit/delete-able on a published article and the "View"-labelled
   row action opens an editable, persisting form. Left for the maintainer: is this **intended**
   (post-publication galley correction without a new version, only the "View" label wrong), or should a
   published galley's action be genuinely read-only? (Intent only; does not gate verification.)
2. **Does the author's list-only Galleys tab add value, or should it be hidden?** The author sees the
   galley list with no actions on their own submission — intended transparency, or noise?
3. **`jatsTemplate` ownership (seam).** The feature map lists `PLUGIN-generic-jatsTemplate` under both
   *galleys* (the JATS **render** plugin) and the parked *jats-content-api* (the JATS **content API** +
   `oaiJats`). Claimed here as a render plugin; confirm the split when/if `jats-content-api` is written.
4. **`PAGE-article-downloadsuppfile` — keep or retire?** It is a legacy redirect for old
   supplementary-file download URLs; is it still needed, or a deprecation candidate?

---

## Reference — entry points & surfaces

| Entry | Path | Atom |
|-------|------|------|
| Galleys manager (tab) | Workflow → Publication → **Galleys** (`workflowMenuKey=publication_{pubId}_galleys`); Vue `GalleyManager` reading `publication.galleys` | VUE-galley-manager |
| Galley CRUD (forms/write) | `grid.articleGalleys.ArticleGalleyGridHandler` ops `addGalley`/`editGalley`/`editGalleyTab`/`updateGalley`/`deleteGalley`/`saveSequence`/`identifiers`/`updateIdentifiers`/`clearPubId` (legacy `$$$call$$$` modals + POSTs) | GRID-grid-article-galleys-article-galley-grid-handler |
| Galley file upload | `wizard.fileUpload.FileUploadWizardHandler::startWizard` (fileStage Proof, assoc Representation) — via Change File | *(owned by submission-files)* |
| Galley DOI / pub-id | Edit modal → **Identifiers** tab → `updateIdentifiers`; `PUT api/v1/_dois/galleys/{galleyId}` | *(owned by publication-identifiers)* |
| Galley entity / schema | `publication_galleys` (+ `publication_galley_settings`); `schemas/galley.json` | DB-publication_galleys, DB-publication_galley_settings, SCHEMA-galley |
| Reader view | `article/view/{id}[/version/{pubId}]/{galleyId}` → `ArticleHandler::view` (`ArticleHandler::view::galley` hook / remote redirect) | *(page owned by article-landing; galley grouping here)* |
| Reader download | `article/download/{id}/{galleyId}[/{fileId}]` → `ArticleHandler::download`; legacy `article/downloadSuppFile/...` | PAGE-article-download, PAGE-article-downloadsuppfile |
| Format-render plugins | `ArticleHandler::view::galley` by file type: pdf.js (PDF), inline HTML, Lens (XML), JATS (XML/OAI) | PLUGIN-generic-pdfJsViewer, -htmlArticleGalley, -lensGalley, -jatsTemplate |
| Galley policies | `RepresentationRequiredPolicy` (valid galley in request), `RepresentationUploadAccessPolicy` (file-upload-to-galley) | AUTHZ-representation-required-policy, AUTHZ-representation-upload-access-policy |

## Reference — code anchors

- **Vue manager**: `lib/ui-library/src/managers/GalleyManager/` — `GalleyManager.vue` (props
  `publication`/`submission` only), `galleyManagerStore.js` (`items: publication.galleys`, `useOrdering`
  → `saveSequence`), `useGalleyManagerConfig.js` (`GalleyManagerConfiguration.permissions`,
  `getManagerConfig`/`getColumns`/`getBottomItems`/`getTopItems`/`getItemActions`,
  `getGalleyGridComponent`), `useGalleyManagerActions.js` (`galleyAdd`/`galleyEdit`/`galleyChangeFile`/
  `galleyDelete`/`galleyMoreInfo` → legacy grid modals).
- **Legacy grid + form**: `controllers/grid/articleGalleys/ArticleGalleyGridHandler.php`
  (`authorize` = WorkflowStageAccessPolicy(PRODUCTION)+PublicationAccessPolicy+RepresentationRequiredPolicy;
  `canEdit()`; `addGalley`/`editGalley`/`editGalleyTab`/`updateGalley`/`deleteGalley`/`saveSequence`/
  `identifiers`/`updateIdentifiers`/`clearPubId`/`fetchRow`), `.../form/ArticleGalleyForm.php`
  (label/locale/urlPath/urlRemote, `validate`, `execute` → `Repo::galley()->add/edit`),
  `templates/controllers/grid/articleGalleys/{form/articleGalleyForm.tpl,editFormat.tpl}`.
- **Entity**: `lib/pkp/classes/galley/` — `Galley.php` (`getBestGalleyId`/`getFileType`/`isPdfGalley`/
  `isApproved`), `Repository.php` (`add`/`edit`/`delete` cascade, `getByUrlPath`,
  `getMinorVersionsWithSameDoi`), `DAO.php`, `Collector.php`, `maps/Schema.php` (`urlPublished`);
  `schemas/galley.json`; `publication_galleys` + `publication_galley_settings` (`OJSMigration`).
- **Reader page**: `pages/article/ArticleHandler.php` (`view()`, `download()`, `downloadSuppFile()`,
  `userCanViewGalley()`).
- **Render plugins**: `plugins/generic/{pdfJsViewer/PdfJsViewerPlugin.php, htmlArticleGalley/
  HtmlArticleGalleyPlugin.php, lensGalley/LensGalleyPlugin.php, jatsTemplate/JatsTemplatePlugin.php}`
  (`register()` hook `ArticleHandler::view::galley`/`::download`; each `settings.xml` `enabled=true`).
- **DOI seam**: `api/v1/_dois/BackendDoiController.php` (`editGalley` `PUT _dois/galleys/{galleyId}`);
  `lib/pkp/controllers/tab/pubIds/form/PKPPublicIdentifiersForm.php` + `templates/.../publicIdentifiersForm.tpl`.
- **Policies**: `lib/pkp/classes/security/authorization/internal/RepresentationRequiredPolicy.php`,
  `.../RepresentationUploadAccessPolicy.php`.
