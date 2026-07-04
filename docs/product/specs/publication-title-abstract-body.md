---
name: publication-title-abstract-body
scope: Edit an article's title, prefix, subtitle and abstract (and optional plain-language summary) on the workflow Publication → Title & Abstract tab after submission, plus author the article's full-text body in the built-in structured editor with a Word/Markdown → HTML import
shared: pkp-lib
status: verified
e2e-plans: [editor-metadata-editing]
atlas-claims:
  - FORM-title-abstract-form
  - API-submission-get-publication-title-abstract-form
  - API-body-text-get
  - API-body-text-save
  - API-body-text-delete
  - VUE-pandoc-converter
  - LOC-submission-publication-bodyText
---

# Publication — Title & Abstract (and full-text body)

## Purpose

Once a manuscript has been submitted, its descriptive text lives on the workflow's
**Publication** record, edited tab by tab. This spec owns the first of those tabs —
**Title & Abstract** — where editorial staff (and, until publication, the author) set
the article's **prefix, title, subtitle and abstract**, each entered per submission
language, plus an optional **plain-language summary**. It also owns the newer
**Body Text** tab, an in-app structured full-text editor (the bundled SciFlow editor)
that lets production staff author the article body directly in OJS, seeded from a
Word/OpenDocument/RTF/LaTeX/Markdown file through a **Pandoc → HTML** importer that runs
entirely in the browser. This is the *post-submission edit* surface: the same title and
abstract fields are collected at intake by the submission wizard's Details step
(`submission-wizard`), which owns that flow; here they are re-edited on the live
publication, subject to the who-can-still-edit rules that tighten once a version is
published.

## Actors & permissions

Permissions are organised **by action**. Recurring terms and site-wide baselines,
stated once: a **manager** (and a **site admin**, who acts as a manager on any journal
they created) may act on any submission; **assigned section editors and assistants** act
per their stage assignment and are never recommend-only; a **recommend-only editor** may
only view; an **author-role** user reaches these tabs through *My Submissions* on their
own submission. The **published-lock / author-edit gate** that governs *whether an
edit is still allowed* is a cross-cutting rule defined once in `publication-versioning`
(its `canEditPublication` gate) and only referenced here. The Title & Abstract form is
handed the gate's verdict as its editable/locked state; the Body Text editor is **not**
bound to it (its Save stays enabled regardless), though both tabs share the same
published-version warning banner — see Rule 7 and Open questions. <sup>a</sup>

| Action | Who may — and when |
|--------|--------------------|
| **View the Title & Abstract tab** | • Any editorial user with access to the submission — it is the first (default) pane of the Publication menu<br>• The submitting author — via *My Submissions*, on every version <sup>b</sup> |
| **Edit title / prefix / subtitle / abstract (+ plain-language summary)** | • Managers and site admins — any version, including a published one, shown with the "this version is published" warning but still editable<br>• Assigned section editors and assistants (not recommend-only)<br>• An author-role user — only while **nothing** on the submission is published or scheduled **and** an editor has granted them metadata permission; once any version is published or scheduled they are hard-locked out of every version <sup>c</sup> |
| **Edit the full-text Body Text** | • Managers, site admins, and assigned section editors/assistants who can reach the **production** stage — the Body Text tab appears only for them<br>• Authors — never; no Body Text tab is shown in *My Submissions* (the body-text API route's role list still includes author, but no author UI renders it and the file-stage MODIFY policy gates any author write — an API-only latent capability, see Open questions)<br>• On a **published** version the tab shows the shared "this version is published" warning banner (like every publication tab), but the body-text editor is **not** bound to `canEditPublication`, so its Save stays enabled — matching the warn-not-lock the editorial roles who can reach it already get on the metadata forms (see Rule 7) <sup>d</sup> |
| **Import a Word/Markdown file into the body (Pandoc)** | • Anyone who can edit the Body Text tab — the in-tab importer is always available there<br>• Additionally reachable from a submission file's **"Send to Text Editor"** row action, shown on `.docx/.odt/.rtf/.tex/.latex/.md/.markdown` files in the editorial file managers <sup>e</sup> |

<sup>a</sup> submission/Repository::canEditPublication() (gate, owned by publication-versioning); useWorkflowPermissions() canEditPublication / canAccessProduction ·
<sup>b</sup> useWorkflowNavigationConfigOJS.js getPublicationItemsEditorial()/getPublicationItemsAuthor() (titleAbstract is pushed first, unconditionally) ·
<sup>c</sup> workflowConfigEditorialOJS.js `titleAbstract.getPrimaryItems` (`canEdit: permissions.canEditPublication`); workflowConfigAuthorOJS.js (WorkflowPublicationEditDisabled); PKPSubmissionController::editPublication() ·
<sup>d</sup> useWorkflowNavigationConfigOJS.js getPublicationItemsEditorial() (`bodyText` item inside `if (permissions.canAccessProduction)`); workflowConfigEditorialOJS.js `bodyText.getPrimaryItems` (passes no `canEdit` prop, unlike `titleAbstract.getPrimaryItems` which passes `canEdit: permissions.canEditPublication`); the published warning banner is the shared `PublicationConfig.common.getPrimaryItems` `WorkflowPublicationEditWarning`, prepended to every publication tab when `selectedPublication.status === STATUS_PUBLISHED` (`consolidateCommonAndSpecificItems`) — so it appears on Body Text too (live-confirmed); PKPBodyTextController::getGroupRoutes() (roleAuthorizer manager/site-admin/sub-editor/assistant/author) + authorize() (PublicationWritePolicy + SubmissionFileStageAccessPolicy MODIFY on the body-text stage) ·
<sup>e</sup> useFileManagerConfig.js getItemActions() (`PANDOC_IMPORT_EXTENSIONS`, `FILE_SEND_TO_EDITOR`); useFileManagerActions.js fileSendToEditor(); useWorkflowVersionForm.js goToBodyTextWithImport()

## Fields & validation

The Title & Abstract tab is one form (`titleAbstract`) whose fields are all
**multilingual** — one value per supported submission language, entered through the
form's language tabs. The Body Text tab is not a field form; it is a document editor
(see Rules 7–10). <sup>a</sup>

| Field (UI label) | Required? | Rules | Anchor |
|------------------|-----------|-------|--------|
| **Prefix** | No | Short leading text (e.g. "A", "The") kept out of title sorting; single-line text; a tip explains it is not indexed with the title | TitleAbstractForm::__construct() (`prefix`, FieldText, `common.prefix`) |
| **Title** | **Yes** | Always marked required; rich-text single line (bold/italic/super/subscript/link) | TitleAbstractForm::__construct() (`title`, FieldRichText, `isRequired: true`) |
| **Subtitle** | No | Rich-text single line, same controls as Title | TitleAbstractForm::__construct() (`subtitle`, FieldRichText) |
| **Abstract** | Section-dependent, and **marked on this tab** | Large rich-text area. The section may require abstracts and/or cap them at a word count; the OJS form endpoint passes both section values to the form, so the field shows a `* Required` marker when the section requires abstracts and a word-count meter when the section sets a limit — the same affordances as the wizard's Details step — and both are also **enforced when saving** (Rule 5) | TitleAbstractForm::__construct() (`abstract`, FieldRichTextarea, `isRequired`/`wordLimit`); OJS `SubmissionController::getPublicationTitleAbstractForm()` passes `wordCount` + `!abstractsNotRequired`; classes/publication/Repository::validate() |
| **Plain Language Summary** | Only when the journal *requires* it | Appears only if the journal's plain-language-summary metadata mode is collect/request/require; large rich-text area; required when the mode is *require*; shares the section word-count cap | TitleAbstractForm::addPlainLanguageSummary() (mode gate + `isRequired` on METADATA_REQUIRE) |
| **Body Text** (Body Text tab) | No | The article full text, authored in the bundled structured editor; saved as an editor **document** (not a plain field). See Rules 7–10 | WorkflowPublicationBodyText.vue |

<sup>a</sup> The form's PUT target is the publication itself; `getPublicationFormLocales()` supplies the language set. Server-set attributes (submissionId, publication id) are not user fields.

## Rules & state

**The Title & Abstract tab**

1. **Title & Abstract is the default Publication pane.** In both the editorial and the
   author navigation it is pushed first, with no enabling condition, so opening a
   submission's Publication menu (or landing there for a scheduled/published submission —
   see `workflow-stage-navigation`) lands on this tab
   (`useWorkflowNavigationConfigOJS.js` getPublicationItemsEditorial()/getPublicationItemsAuthor()).
2. **The form serves five possible fields** — prefix, title, subtitle, abstract and
   (conditionally) plain-language summary — each multilingual, with only the title always
   required (`TitleAbstractForm::__construct()`). The tab is served to the browser by the
   publication form endpoint, which builds the same form class and localises it for the
   submission's languages. In OJS this endpoint is **overridden** to pass the section's
   word count and abstract-required flag into the form (`SubmissionController::getPublicationTitleAbstractForm()`
   → `TitleAbstractForm(..., (int) $section->wordCount, !$section->abstractsNotRequired)`
   → `_components/titleAbstract`), where the pkp-lib base builds it with the neutral
   defaults; this override is why the abstract's required marker and word-count meter
   surface here (Rule 5).
3. **Plain Language Summary is metadata-mode-gated**: the field is added only when the
   journal's plain-language-summary metadata setting is one of collect / request /
   require, and is marked required only under *require*
   (`TitleAbstractForm::addPlainLanguageSummary()`). The mode is configured in
   Settings → Workflow (owned by `submission-wizard-metadata` / `workflow-settings`); this
   spec owns the field's presence and behaviour on the Publication tab.
4. **Saving PUTs the selected publication version.** The form submits to the publication
   edit endpoint, which validates the props and writes them onto the currently selected
   version, then returns the updated publication; there is no separate autosave
   (`PKPSubmissionController::editPublication()`).
5. **Abstract requirements are both surfaced on this tab and enforced on save.** For a
   completed submission whose section requires abstracts, the OJS endpoint marks the
   abstract field `* Required` and — when the section sets a word count — renders a
   word-count meter, exactly like the wizard's Details step, because
   `SubmissionController::getPublicationTitleAbstractForm()` passes the section's
   `wordCount` and `!abstractsNotRequired` into the form (the pkp-lib base would pass the
   0/false defaults, but OJS overrides it). Saving with the primary-language abstract empty
   is then refused server-side ("Please enter the abstract of your article."), and an
   over-limit abstract (or plain-language summary) is refused too — the backend guard is
   authoritative and independent of the marker (`classes/publication/Repository::validate()`
   — `abstractsNotRequired`, `wordCount`). *(Live-confirmed 2026-07-04 on the ART section
   — abstracts required, word-count 500: the abstract carries the `* Required` marker and a
   "500"-word meter, an empty-abstract save is blocked client-side and a direct empty PUT
   returns HTTP 400.)*
6. **Who may still edit is the versioning gate.** Managers/admins may always edit (a
   published version stays editable behind a yellow "this version is published" warning);
   an author-role user is locked out of every version the moment any version is published
   or scheduled, otherwise a granted metadata permission decides. This `canEditPublication`
   rule and its warn-lock-vs-hard-lock split are defined in `publication-versioning`
   (rules 13–15); the Title & Abstract form merely receives the verdict as its
   editable/locked state (`canEdit: permissions.canEditPublication`).

**The Body Text tab (full-text editor)**

7. **The Body Text tab is production-scoped and editorial-only.** It is added to the
   Publication menu only inside the `canAccessProduction` branch of the editorial
   navigation, and never appears in the author navigation
   (`useWorkflowNavigationConfigOJS.js` getPublicationItemsEditorial()). The tab hosts the
   bundled **SciFlow** structured editor plus a document sidebar (references / selected
   element / outline) — it is part of default OJS 3.6, not a plugin
   (`WorkflowPageOJS.vue` imports `WorkflowPublicationBodyText`). On a **published**
   version the tab shows the same yellow "this version has been published" warning banner
   every publication tab shows (the shared `WorkflowPublicationEditWarning` common item),
   but — unlike the metadata forms — the editor is passed no `canEdit` prop, so its Save
   button is **never locked** by the versioning gate. Because only editorial/production
   users ever reach this tab, and those users are warned-not-locked on the metadata forms
   too (their `canEditPublication` stays true on a published version), the practical
   behaviour matches: warn, don't lock. The author hard-lock does not apply here since
   authors never see the tab. *(Live-confirmed 2026-07-04: on a published submission the
   editor's Body Text tab renders the warning banner AND keeps Save enabled — see Open
   questions for the residual gate-independence question.)*
8. **Body text is stored as a per-version submission file.** The editor's document is
   persisted as a JSON file at the body-text file stage
   (`SubmissionFile::SUBMISSION_FILE_BODY_TEXT` = 22), associated to the *publication*, one
   per version (`Repo::bodyText()->getBodyTextFile()` filters that stage by publication id).
   Saving serialises the editor document and PUTs it as the `bodyText` field; the
   repository **creates the file on first save and replaces its content thereafter**,
   deleting the superseded stored file (`Repository::setBodyText()` →
   `createBodyTextFile()`/`updateBodyTextFile()`; `PKPBodyTextController::save()`). "Full-text
   HTML editor" is loose: the *stored* body is the editor's own document format, not raw
   HTML — HTML is only the import/paste interchange (Rule 10).
9. **Get / save / delete.** Reading returns the mapped file (its submission-file props plus
   `bodyTextContent` and any dependent files) or an empty shell when none exists yet;
   deleting removes the body-text submission file and returns 404 when there is nothing to
   delete (`PKPBodyTextController::get()/delete()`). Figures pasted or imported into the
   editor are uploaded as **dependent files** of the body-text file
   (`WorkflowPublicationBodyText.vue handleFigureUpload()` — `SUBMISSION_FILE_DEPENDENT`).
10. **The Pandoc importer converts a document to HTML in the browser.** The tab always
    shows an importer at the top; separately, a file row's **"Send to Text Editor"** action
    (offered only on `.docx/.odt/.rtf/.tex/.latex/.md/.markdown`) opens a version-target
    dialog and then navigates to that version's Body Text tab carrying the file's URL as
    query params (`useWorkflowVersionForm.js goToBodyTextWithImport()`). The importer loads
    a WebAssembly build of Pandoc, converts the file to HTML (format inferred from the
    extension), rewrites and **uploads embedded images as dependent files**, and pastes the
    resulting HTML into the editor, which then serialises it to its document format on the
    next save (`PandocConverter.vue runConversion()/rewriteImages()`;
    `WorkflowPublicationBodyText.vue handlePandocHtmlReady()` — `view.pasteHTML(html)`).
11. **New versions do not carry the body text.** Creating a new version copies publication
    metadata, contributors, citations, the JATS file and **media** files, but the body-text
    file is *not* among the file stages copied (`publication/Repository::version()` versions
    the JATS file via `versionSubmissionFile()` and copies `SUBMISSION_FILE_MEDIA` through
    its file-stage filter, and no other stage — the body-text stage is omitted), so a new
    version starts with an empty Body Text tab (see Open questions).

## Side effects

- **Title/abstract save** updates the selected publication version and records the
  standard **"Metadata updated"** activity-log entry fired by every publication edit
  (`Repo::publication()->edit()` — `EVLOG-SUBM-META-UPD`, whose log surface is owned by
  `publication-metadata-references` / `editorial-activity-log`). No email or notification is
  sent for a title/abstract edit.
- **Body-text save/delete** creates, replaces or removes a body-text submission file (and,
  for figures, dependent submission files) through the submission-file repository; no
  dedicated notification is sent and no body-text-specific event type exists. Because the
  save/delete go through `Repo::submissionFile()->add()/edit()/delete()`, they emit the
  **standard submission-file event-log entries** (`SUBMISSION_LOG_FILE_UPLOAD` /
  `…_REVISION_UPLOAD` on first save, `…_FILE_EDIT`/`…_REVISION_UPLOAD` on replace,
  `…_FILE_DELETE` on delete — `submissionFile/Repository::add()/edit()/delete()` call
  `Repo::eventLog()->add()` unconditionally) — i.e. body-text saves are *not* silent in the
  log, they log as ordinary file events at the body-text file stage; there is just no
  body-text-specific label.
- Neither tab triggers publish, re-index or DOI effects on its own — those follow the
  publish action (`publication-publish-flow` / `publication-versioning`).

## Settings that modify behavior

- **Section settings** (owned by `sections`): the section's **"Abstracts not required"**
  toggle and **"Word Count"** limit drive both the field's surfaced `* Required` marker /
  word-count meter and the save-time validation (Rule 5). A section with abstracts required
  marks the field required and refuses an empty primary-language abstract on save; a word
  count shows the meter and caps the abstract and plain-language summary length.
- **Plain-language-summary metadata mode** (Settings → Workflow → Metadata; owned by
  `submission-wizard-metadata`): collect/request/require controls whether the PLS field
  appears on this tab and whether it is required (Rule 3).
- **Supported submission languages** (Settings → Website → Languages; owned by
  `languages-locales`): which language values the multilingual fields offer.
- **No toggle for the Body Text editor or the Pandoc importer** — both ship enabled in
  default OJS 3.6 and are gated only by production-stage access (Rule 7). The importer's
  Pandoc/WASM runtime loads on demand in the browser.

## Cross-feature interactions

- **submission-wizard** / **submission-wizard-metadata** — collect the same title, prefix,
  subtitle, abstract and plain-language-summary at *intake* (the wizard's Details step;
  `FORM-details` extends the form owned here). This spec owns the post-submission edit; the
  wizard owns intake, and the PLS/metadata *mode* config lives with wizard-metadata.
- **publication-versioning** — owns the `canEditPublication` published-lock/author gate
  referenced in Rule 6 and the per-version copy behaviour (Rule 11: JATS + media carried,
  body text not).
- **publication-metadata-references** — owns the adjacent Metadata tab and the
  "Metadata updated" activity-log surface that a title/abstract save writes to.
- **sections** — owns the abstract-required and word-count section settings that Rule 5
  enforces.
- **submission-files** — owns the submission-file primitive the body text and its figures
  are stored as (body text at a dedicated file stage; figures as dependent files), and the
  file-manager "Send to Text Editor" row action that launches the importer.
- **workflow-stage-navigation** — owns the workflow shell and the rule that a
  scheduled/published submission's default pane is Publication → Title & Abstract.
- **contributors** / **galleys** / **publication-identifiers** / **publication-license** /
  **data-availability-citations** / **publication-issue-assignment** — the other Publication
  tabs; each owns its own tab.

## Canonical scenarios

1. **Editor edits the title and abstract** — Editor (dbarnes): opens a submission's
   Publication menu (lands on Title & Abstract), fixes the title, edits the abstract, and
   saves; the fields persist on the selected version and a "Metadata updated" entry appears
   in the activity log. On a *published* version the same forms stay editable behind the
   yellow "this version is published" warning.
2. **Multilingual entry** — Editor: on a journal with a second submission language, switches
   the form's language tab and enters a separate title/subtitle/abstract for that language;
   both language values save independently, and the primary-language title remains the
   required one.
3. **Abstract marked required and enforced on save** — Editor: on a section that requires
   abstracts (and caps them at a word count), opens the tab and sees the abstract field
   carrying a `* Required` marker and a word-count meter (OJS surfaces the section values,
   just like the wizard's Details step); clearing the primary-language abstract and saving
   is refused both client-side (the required marker blocks it) and server-side ("Please
   enter the abstract of your article."), and the stored abstract is untouched.
4. **Author edit gate closes at publication** — Author granted metadata permission: edits
   the title/abstract while the submission is still unpublished; after any version is
   published or scheduled, every field on every version is locked and the Body Text tab was
   never offered to them at all.
5. **Body Text editor: write and save** — Editor with production access: opens the Body
   Text tab, types content into the structured editor, clicks Save → the document is stored
   as the version's body-text file; a figure dropped in is uploaded as a dependent file;
   deleting clears the body-text file.
6. **Pandoc import from a Word file** — Editor: on a `.docx` submission file chooses "Send
   to Text Editor", targets the version, and lands on the Body Text tab where the importer
   fetches and converts the file to HTML in the browser, uploads its images as dependent
   files, and pastes the article body into the editor ready to save.

## Known deviations (as-built ≠ intent)

None confirmed. The spec author code-read the pkp-lib base and flagged three ⚠ candidates;
adversarial verification (code + live probes, 2026-07-04) reconciled all three to the OJS
as-built reality and **retracted** each — no `app-changes.md` ledger row was added:

- **(retracted) "abstract required marker missing"** — FALSE for OJS. The base
  `PKPSubmissionController::getPublicationTitleAbstractForm()` builds the form with 0/false
  defaults, but OJS **overrides** it (`SubmissionController::getPublicationTitleAbstractForm()`
  passes the section's `wordCount` + `!abstractsNotRequired`), so the abstract does carry the
  `* Required` marker and word-count meter here — live-confirmed. Rule 5 now documents this
  as correct behaviour.
- **(retracted) "Body Text tab has no published warning or lock"** — half-false. The
  published warning banner **is** shown on the Body Text tab (the shared
  `WorkflowPublicationEditWarning` common item, prepended to every publication tab — live
  count = 1). The editor is not bound to `canEditPublication`, so its Save is not locked —
  but the only users who reach the tab (editorial/production) are warned-not-locked on the
  metadata forms too, and authors never see the tab, so there is no observable inconsistency
  for any reachable user. Reframed as a plain rule (Rule 7); the residual "should body-text
  editing honour the metadata-change/published gate at all?" is an Open question, not a
  deviation.
- **(retracted) "body-text API route lists the author role"** — benign. Authors get no
  Body Text UI, and any author write is gated by the body-text-stage `MODIFY` policy; the
  read route merely lets an author fetch their own submission's body via API. An API-only
  latent role, not a deviation — kept as an Open question.

## Open questions

1. Is it intended that **creating a new version drops the body text** (only the JATS + media
   files are carried — Rule 11), forcing production staff to re-author or re-import the body
   on every correction?
2. Is it intended that the **Body Text editor is not bound to the versioning/`canChangeMetadata`
   gate at all** (Rule 7) — i.e. a production-access editorial user without metadata-change
   rights can edit the body text even though the metadata forms are locked for them, and a
   published version's body stays editable (behind the warning) with no hard lock? This is
   consistent for the users who can reach the tab (all warned-not-locked) and body text is
   production content rather than "metadata", so it is plausibly by design — but the gate
   independence is worth a maintainer confirmation.
3. Is the **author role's presence in the body-text API route** intentional (it lets an
   author read their own submission's body via API, with writes still gated by the file-stage
   `MODIFY` policy) given no author UI exists, or should the role be dropped?
4. Where does the stored body-text document get **consumed for readers**? Verification found
   **no reader-side/galley/theme consumer** of `SUBMISSION_FILE_BODY_TEXT` today (the only
   references are storage + the editor API), so the Body Text editor appears to be
   **authoring-only** in default OJS 3.6 — is a render/galley path planned, or is this
   intentionally an authoring surface with no reader output yet?

---

<!-- REFERENCE MATERIAL — provenance and campaign bookkeeping, not product-owner narrative. -->

## Reference — entry points & surfaces

| Entry | Path | Atom |
|-------|------|------|
| Title & Abstract tab (form fetch) | Workflow → Publication → Title & Abstract; `GET api/v1/submissions/{id}/publications/{pubId}/_components/titleAbstract` | API-submission-get-publication-title-abstract-form |
| Title/abstract form class | `lib/pkp/classes/components/forms/publication/TitleAbstractForm.php` (base of the wizard's `Details`, owned by submission-wizard) | FORM-title-abstract-form |
| Body Text tab | Workflow → Publication → Body Text (editorial + production access only) | — (VUE WorkflowPublicationBodyText; not a separately-swept atom) |
| Body text get / save / delete | `GET/PUT/DELETE api/v1/submissions/{id}/publications/{pubId}/bodyText` | API-body-text-get, API-body-text-save, API-body-text-delete |
| Pandoc importer | Body Text tab (always) + a file row's "Send to Text Editor" (`.docx/.odt/.rtf/.tex/.latex/.md/.markdown`) | VUE-pandoc-converter |
| Body-text locale keys | `publication.bodyText.*` (submission.po, 5 keys: panel/import/outline labels) | LOC-submission-publication-bodyText |

Route/role gate: the body-text routes require an authenticated context user in
manager | site-admin | sub-editor | assistant | author, with `PublicationAccessPolicy`
(read) or `PublicationWritePolicy` (write) and, on save, `SubmissionFileStageAccessPolicy`
MODIFY on the body-text stage (`PKPBodyTextController::getGroupRoutes()`, `authorize()`).

## Reference — code anchors

- Title/abstract form: `lib/pkp/classes/components/forms/publication/TitleAbstractForm.php`
  (fields, `addPlainLanguageSummary()`; `$abstractWordLimit`/`$isAbstractRequired` ctor
  args); served by the OJS override
  `api/v1/submissions/SubmissionController.php` `getPublicationTitleAbstractForm()` — which
  passes `(int) $section->getData('wordCount')` + `!$section->getData('abstractsNotRequired')`
  (the pkp-lib base `PKPSubmissionController::getPublicationTitleAbstractForm()` passes the
  0/false defaults); route `_components/titleAbstract`; edited via `editPublication()`.
- Abstract/PLS validation: `classes/publication/Repository.php` `validate()` (required +
  word count on completed submissions); wizard-time parallel in
  `classes/submission/Repository.php` `validateSubmit()`.
- Body-text API: `lib/pkp/api/v1/bodyText/PKPBodyTextController.php`
  (`getGroupRoutes()`, `authorize()`, `get()/save()/delete()`).
- Body-text storage: `lib/pkp/classes/bodyText/Repository.php`
  (`getBodyTextFile()/setBodyText()/createBodyTextFile()/updateBodyTextFile()`),
  `BodyTextFile.php`; file stage `lib/pkp/classes/submissionFile/SubmissionFile.php`
  `SUBMISSION_FILE_BODY_TEXT`.
- Body-text editor UI: `lib/ui-library/src/pages/workflow/components/publication/WorkflowPublicationBodyText.vue`
  (`saveDocument()`, `handleFigureUpload()`, `handlePandocHtmlReady()`),
  `WorkflowPublicationBodyTextUtils.js`; registered in `WorkflowPageOJS.vue`.
- Pandoc importer: `lib/ui-library/src/components/PandocConverter/PandocConverter.vue`
  (`runConversion()`, `rewriteImages()`, auto-import watch), `pandocLoader.js`.
- Nav / config: `lib/ui-library/src/pages/workflow/composables/useWorkflowNavigationConfig/useWorkflowNavigationConfigOJS.js`
  (`getPublicationItemsEditorial()`/`getPublicationItemsAuthor()`),
  `useWorkflowConfig/workflowConfigEditorialOJS.js` (`titleAbstract`, `bodyText` primary items).
- "Send to Text Editor": `lib/ui-library/src/managers/FileManager/useFileManagerConfig.js`
  (`PANDOC_IMPORT_EXTENSIONS`, `getItemActions()`), `useFileManagerActions.js`
  (`fileSendToEditor()`), `useWorkflowVersionForm.js` (`goToBodyTextWithImport()`).
- Edit gate (referenced, owned by publication-versioning):
  `lib/pkp/classes/submission/Repository.php` `canEditPublication()`.
- Version copy scope (Rule 11): `lib/pkp/classes/publication/Repository.php` `version()`.
