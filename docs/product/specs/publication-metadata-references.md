---
name: publication-metadata-references
scope: Edit an article's descriptive metadata (keywords, subjects, disciplines, supporting agencies, coverage, rights, source, type, funding — each per submission language) on the workflow Publication → Metadata tab after submission, and manage its reference list on the References tab — adding references as raw text that are parsed into individual citations, editing each citation as raw text or structured fields, deleting, and reprocessing them through the background metadata-lookup pipeline
shared: pkp-lib
status: verified
e2e-plans: [editor-metadata-editing, citation-style-language]
atlas-claims:
  - FORM-pkp-metadata-form
  - FORM-pkp-citations-form
  - FORM-citation-raw-edit-form
  - FORM-citation-structured-edit-form
  - SCHEMA-citation
  - API-submission-get-publication-metadata-form
  - API-submission-import-additional-citations
  - API-submission-delete-citations-by-publication-id
  - API-citation-get-many
  - API-citation-get
  - API-citation-edit
  - API-citation-delete
  - VUE-citation-manager
  - DB-citations
  - DB-citation_settings
  - DB-publication_settings
  - EVLOG-SUBM-META-UPD
---

# Publication — Metadata & References

## Purpose

Once a manuscript is submitted, its descriptive metadata and reference list live on the
**Publication** record and are edited tab by tab. This spec owns two of those tabs. The
**Metadata** tab re-edits the journal's descriptive metadata fields — **Keywords,
Subjects, Disciplines, Supporting Agencies** (chip-style controlled vocabularies) plus
**Coverage, Rights, Source, Type** (plain text) and a **Funding Statement** (rich text) —
each entered per submission language; these are the same fields the submission wizard
collects at intake (owned by `submission-wizard-metadata`), here re-edited on the live
publication. The **References** tab is the **citation manager**: editorial staff paste a
block of references (one per line) that OJS tokenises into individual citation rows, then
edit each one either as **raw text** or as **structured fields** (DOI, authors, title,
source, pages …), delete them, and **reprocess** any of them through a background
metadata-lookup pipeline that tries to fill the structured fields from Crossref / OpenAlex
/ ORCID. This is the *post-submission edit* surface, governed by the same published-lock /
author-edit gate that tightens editing once a version is published — with one important
exception on the citation API (Rule 12, Known deviations). The reader-facing "how to cite"
formatting is a different feature (`citation-style-language`); the enrichment jobs
themselves are background infra (`citation-enrichment-pipeline`); this spec owns the
editing UI and its immediate API.

## Actors & permissions

Permissions are organised **by action**. Recurring terms and site-wide baselines, stated
once: a **manager** (and a **site admin**, who acts as a manager on any journal they
created) may act on any submission; **assigned section editors and assistants** act per
their stage assignment (never recommend-only); an **author-role** user reaches these tabs
through *My Submissions* on their own submission. The **published-lock / author-edit gate**
(`canEditPublication`) that decides *whether an edit is still allowed* is defined once in
`publication-versioning` and only referenced here: managers/editors are **warn-not-locked**
on a published version (the forms stay editable behind a yellow "this version is published"
warning — live-confirmed a manager saved metadata + citations onto a published version),
an author-role user is **hard-locked** out of every version the moment any version is
published or scheduled. The metadata form and the citation-manager UI both receive this
verdict as their editable/locked state. **The individual citation API endpoints do NOT
enforce this gate** — see Rule 12 and Known deviations. <sup>a</sup>

| Action | Who may — and when |
|--------|--------------------|
| **View the Metadata tab** | • Any editorial user with access to the submission — the tab is always present in the Publication menu<br>• The submitting author — via *My Submissions*, on every version <sup>b</sup> |
| **View the References tab** | • Same actors, **but only when the journal collects references** (the References metadata mode is on) — otherwise the tab is absent for everyone (live-confirmed present on `publicknowledge`, whose References mode ships as *request*) <sup>c</sup> |
| **Edit the metadata fields** | • Managers and site admins — any version, warned on a published one<br>• Assigned section editors and assistants (not recommend-only)<br>• An author-role user — only while nothing on the submission is published or scheduled and an editor has granted them metadata permission; once any version is published/scheduled, hard-locked out <sup>d</sup> |
| **Add references / edit / delete / reprocess a citation (in the UI)** | • Same roles and the same `canEditPublication` gate as metadata — the citation manager hides every editing control (per-row menu, Add submit, Delete-all, Reprocess-all) when the gate is false, so on a published version an author sees a read-only list while a manager still sees the controls behind the warning <sup>e</sup> |
| **Edit / delete / reprocess a citation (via the API directly)** | • ⚠ **Any** journal user holding manager, section-editor, assistant **or author** role — with **no check that they are assigned to the submission and no published-lock** (live-confirmed: an unrelated author overwrote another submission's citation). API-only; no UI exposes it. See Known deviations <sup>f</sup> |
| **Assign categories to the publication** | • Not on these tabs — post-submission category assignment lives on the **Issue** tab (owned by `publication-issue-assignment`); the intake picker is the wizard's For-the-Editors step (owned by `submission-wizard-metadata`). Pointer only <sup>g</sup> |

<sup>a</sup> submission/Repository::canEditPublication() (gate, owned by publication-versioning); useWorkflowPermissions() canEditPublication; live probes 2026-07-04 (manager PUT metadata + citationsRaw on a published publication → HTTP 200) ·
<sup>b</sup> useWorkflowNavigationConfigOJS.js getPublicationItemsEditorial()/getPublicationItemsAuthor() (`metadata` item pushed unconditionally) ·
<sup>c</sup> same, `if (publicationSettings.supportsCitations)`; PKPDashboardHandler::… `supportsCitations => !!$context->getData('citations')`; live probe 2026-07-04 (References tab rendered; journal_settings `citations = request`) ·
<sup>d</sup> workflowConfigEditorialOJS.js `metadata.getPrimaryItems` (`canEdit: permissions.canEditPublication`); PKPSubmissionController::editPublication() (route roles Manager|SubEditor|Assistant|Author + PublicationWritePolicy) ·
<sup>e</sup> CitationManagerCellActions.vue (`v-show="citationStore.canEditPublication"`); CitationManager.vue (Delete-all / Reprocess-all `:is-disabled="!canEditPublication"`); useCitationManagerFormAddRawCitation.js (`canSubmit: canEditPublication`); live probe 2026-07-04 ·
<sup>f</sup> PKPCitationController::authorize() (UserRolesRequiredPolicy + ContextRequiredPolicy + role policy only — no SubmissionAccessPolicy, no PublicationWritePolicy); getRouteGroupMiddleware() (Manager|SubEditor|Assistant|Author); live probe 2026-07-04 (atester, a journal author unrelated to the submission, GET + PUT `/citations/{id}` → 200, edit persisted) ·
<sup>g</sup> IssueEntryForm::__construct() (`categoryIds` FieldAutosuggestPreset) — owned by publication-issue-assignment; ForTheEditors::addCategoryField() — owned by submission-wizard-metadata

## Fields & validation

**The Metadata tab** is one form (`metadata`, built from `PKPMetadataForm` — the pkp-lib
base used **directly**, with no OJS override). A field appears **only when the journal
collects it** — i.e. when that field's metadata mode is any non-disabled value
(collect / request / require). **No field on this tab carries a required marker**: the
form sets no `isRequired`, so the require-mode only gates the *wizard's* final submit, not
this tab (live-confirmed: on `publicknowledge` the tab renders only **Keywords**, since
keywords is the sole enabled field, and it is unmarked). Every field below is multilingual
(one value per supported submission language). The field/mode configuration, the chip
controlled-vocabulary primitive and the intake experience are owned by
`submission-wizard-metadata`; this tab is the post-submission edit of the same values.
<sup>a</sup>

| Field (UI label) | Required? | Rules | Anchor |
|------------------|-----------|-------|--------|
| **Keywords** | No | Chip list; type + Enter to add a chip, type-ahead suggests stored vocabulary terms plus the typed text (free text always accepted); own per-publication/per-language vocabulary | PKPMetadataForm::__construct() (`keywords`, FieldControlledVocab, `CONTROLLED_VOCAB_SUBMISSION_KEYWORD`) |
| **Subjects** | No | Same chip behaviour, own vocabulary | PKPMetadataForm (`subjects`, `CONTROLLED_VOCAB_SUBMISSION_SUBJECT`) |
| **Disciplines** | No | Same chip behaviour, own vocabulary | PKPMetadataForm (`disciplines`, `CONTROLLED_VOCAB_SUBMISSION_DISCIPLINE`) |
| **Supporting Agencies** | No | Same chip behaviour, own vocabulary (internal name `supportingAgencies`, mode key `agencies`) | PKPMetadataForm (`supportingAgencies`, `CONTROLLED_VOCAB_SUBMISSION_AGENCY`) |
| **Coverage** | No | One-line text (spatial/temporal/jurisdictional coverage) | PKPMetadataForm (`coverage`, FieldText) |
| **Rights** | No | One-line text | PKPMetadataForm (`rights`, FieldText) |
| **Source** | No | One-line text | PKPMetadataForm (`source`, FieldText) |
| **Type** | No | One-line text; description links the Dublin Core types list | PKPMetadataForm (`type`, FieldText) |
| **Funding Statement** | No | Small rich-text editor | PKPMetadataForm (`fundingStatement`, FieldRichTextarea) |
| **Publisher ID / Article Number** | No | Editorial identifiers shown on the same form when enabled (OJS); their behaviour is owned by `publication-identifiers` — pointer only | PKPMetadataForm (`pub-id::publisher-id`, `articleNumber`, gated on `enablePublisherId`/`enableArticleNumber`) |

**The References tab** has two field surfaces: the **Add references** box, and the
per-citation **edit form** (whose shape depends on the journal's *References Metadata
Lookup* setting — Rule 8).

| Field (UI label) | Required? | Rules | Anchor |
|------------------|-----------|-------|--------|
| **References** (Add box) | Marked `*` | A textarea: "Enter each reference on a new line so that they can be individually processed." Click **Add** to append; entries are tokenised into individual citation rows and de-duplicated against existing raw citations. The `*` is the Add form's own requirement (you must type something to Add), **not** a metadata require-mode marker | useCitationManagerFormAddRawCitation.js (`rawCitations`, `isRequired: true`); PKPSubmissionController::importAdditionalCitations() |
| **Raw Citation** (raw edit) | **Yes** | Single textarea holding the whole citation as text; the only field when *References Metadata Lookup* is off | CitationRawEditForm::__construct() (`rawCitation`, FieldTextarea) |
| **Structured citation** (structured edit) | Raw Citation **required**; rest optional | ~19-field form shown when *References Metadata Lookup* is on: **Raw Citation** (required) + DOI, URL, URN, arXiv, Handle, Title, **Authors** (name/ORCID/OpenAlex/Wikidata rows), Source Name/ISSN/Host/Type, Date, Type, Volume, Issue, Pages, First Page, Last Page. Each PID field is validated by its own format regex; DOI/arXiv/Handle values are extracted from whatever is pasted; `publicationId` cannot be changed via the API | CitationStructuredEditForm::__construct(); citation.json (validation regexes, `writeDisabledInApi` on `publicationId`); PKPCitationController::edit() (Doi/Arxiv/Handle::extractFromString) |

## Rules & state

**The Metadata tab**

1. **Metadata is served by the base form, used directly.** The tab fetches
   `_components/metadata`, which builds `PKPMetadataForm` against the publication and the
   journal, localised for the submission's languages — there is **no OJS override** of
   this endpoint or form (unlike Title & Abstract, whose OJS override adds the
   abstract-required marker; here the base is authoritative, so none of the
   base-vs-override surprises apply). Each field is added only if its journal metadata
   mode is truthy; when none are, the tab shows "No metadata fields are currently
   enabled." (`PKPSubmissionController::getPublicationMetadataForm()`;
   `PKPMetadataForm::enabled()`; `workflowConfigEditorialOJS.js` `metadata` `noFieldsMessage`).
2. **The tab shows a field under *any* collecting mode; the wizard is stricter.** A field
   set to *collect but don't ask* is absent from the wizard yet **present and editable
   here** (`PKPMetadataForm::enabled()` = any truthy mode, vs the wizard's
   `ForTheEditors::enabled()` = request/require only). The wizard's *require* mode gates
   only its own final submit — it adds no required marker and no save-time block on this
   tab (Fields). The field set, the four-mode configuration and the chip vocabulary
   primitive are owned by `submission-wizard-metadata`.
3. **Chips are a controlled vocabulary, per publication and per language.** Keywords /
   subjects / disciplines / supporting agencies each save their chip list as vocabulary
   entries attached to the publication (one ordered list per language); saving replaces
   the previous list. The primitive (type-ahead, free text, dedup, the journal-scope
   suggestion bug) is defined in `submission-wizard-metadata` and reused here — not
   re-documented (`publication/DAO::extractControlledVocab()`/`saveControlledVocab()`).
4. **Saving PUTs the selected publication version.** The form submits to the publication
   edit endpoint, which validates the props, writes them onto the currently selected
   version, records the "Metadata updated" activity-log entry (Rule 11) and returns the
   updated publication; there is no autosave. The published-lock is enforced here
   (`PKPSubmissionController::editPublication()` in `requiresPublicationWriteAccess` →
   `PublicationWritePolicy`); managers stay editable on a published version, authors are
   hard-locked (Rule from `publication-versioning`; live-confirmed: manager PUT on a
   published publication → 200).

**The References tab**

5. **The References tab exists only when the journal collects references.** It is added to
   the Publication menu only under `publicationSettings.supportsCitations`, which is
   `!!$context->getData('citations')` — the journal's **References** metadata mode being
   any collecting value. So it is **not a default-universal tab**: it is present on
   `publicknowledge` because that journal ships References at *request*, and vanishes if a
   journal sets References to *don't collect* (`useWorkflowNavigationConfigOJS.js`;
   `PKPDashboardHandler`; live-confirmed).
6. **The reference list is derived from the raw References text.** The publication carries
   a whole-list raw field (`citationsRaw`); whenever it changes on a publication save, OJS
   tokenises it line-by-line and **replaces** the publication's individual citation rows
   with the parsed set — each new row gets a sequence number and processing status
   *Not processed* (`publication/DAO::insert()/update()` → `citation/Repository::importCitations()`;
   `CitationListTokenizerFilter`). The **Add references** box instead *appends* new lines
   without disturbing existing rows, skipping any whose raw text already exists
   (`importAdditionalCitations()`; live-confirmed: three lines saved as three rows, seq 1–3,
   all *Not processed*, `isStructured=false`). **Delete all references** clears every row
   for the publication (`deleteCitationsByPublicationId()`).
7. **The citation manager is the References tab's UI.** `CitationManager` (Vue) lists the
   parsed rows in a searchable **Structured References** table, each row offering **Edit**
   and **Delete** (and **Reprocess** when lookup is on — Rule 9), plus the Add box,
   **Delete all references**, and — when lookup is on — a **Reprocess all**, a
   processed/total status line, and a 7-second auto-refresh that polls until every citation
   is processed. The list is read from the publication object the workflow already holds
   (`publication.citations`), so it re-renders on any workflow data change
   (`CitationManager.vue`; `citationManagerStore.js`).
8. **Raw vs structured editing is driven by the *References Metadata Lookup* setting.**
   With the journal's `citationsMetadataLookup` **off** (the default), the per-row Edit
   opens the **raw** form (a single Raw Citation textarea) and no Reprocess action is
   offered; with it **on**, Edit opens the **structured** form (~19 fields) and a Reprocess
   action appears on any row not yet marked structured. The edit PUTs the single citation
   to `/citations/{id}`; the manager re-fetches the publication on success
   (`useCitationManagerActions.js citationEditCitation()` — `formName` switch;
   `useCitationManagerConfig.js getItemActions()` — reprocess gated on
   `citationsMetadataLookup && !citation.isStructured`).
9. **Reprocess re-runs the background enrichment pipeline.** The Reprocess row action (and
   Reprocess-all) set the citation(s) back to *Not processed* and dispatch a background job
   chain (extract PIDs → Crossref → OpenAlex → ORCID → mark-processed) that fills the
   structured fields and flips `isStructured` when successful. The reprocess endpoint's own
   HTTP response echoes the just-set *Not processed*, but the chain then runs: on a live
   deferred queue it completes asynchronously (the 7-s poll reflects it), whereas in the
   **test environment (`job_runner = On`)** it runs to completion **synchronously at
   end-of-request**, so a re-fetch already reads *Processed* (`processingStatus = 5`) — the
   terminal `IsProcessedJob` marks the row processed even when the outbound
   Crossref/OpenAlex/ORCID lookups are firewalled (verifier-confirmed 2026-07-04; the same
   holds for an *import* on a lookup-on journal, which dispatches enrichment on insert).
   **This spec owns the UI action; the job chain, its enrichment logic and the two reprocess
   endpoints are owned by `citation-enrichment-pipeline` (background).** When lookup is *off*,
   no enrichment runs
   at all — new rows are stored as raw text only (`citation/Repository::reprocessCitation()`
   — `Bus::chain([ExtractPidsJob, CrossrefJob, OpenAlexJob, OrcidJob, IsProcessedJob])`;
   `importCitations()` reprocess/skip branch).
10. **Editing controls mirror the publication edit gate.** Every citation editing control
    is rendered/enabled only when `canEditPublication` is true (the per-row action menu is
    `v-show`n on it; Add's submit, Delete-all and Reprocess-all are disabled without it).
    So on a published version an **author** (hard-locked) sees a read-only reference list,
    while a **manager** (warn-not-locked) still sees the controls behind the yellow
    published-version banner (live-confirmed on a published version:
    manager sees Add box + Delete-all + the table).

**Shared behaviour**

11. **Every publication edit records "Metadata updated".** Saving the metadata form (or any
    other publication edit — title/abstract, citationsRaw, primary-contact) fires one
    **Metadata updated** activity-log entry against the submission
    (`SUBMISSION_LOG_METADATA_UPDATE`, message `submission.event.general.metadataUpdated`).
    This is the canonical home of that event surface. **Individual citation CRUD via
    `/citations/{id}` does NOT write it** — those endpoints bypass `editPublication`, so
    editing/deleting a single citation leaves no metadata-updated log entry (only a
    citationsRaw save on the publication, or the bulk import/delete routes' effect on the
    publication, would) (`publication/Repository::edit()` — the eventLog add;
    `PKPCitationController` writes no eventLog).
12. **⚠ The single-citation API is only role-and-context scoped.** `PKPCitationController`
    (get / getMany / edit / delete / reprocess a citation by id) authorises with **only**
    the journal role list (manager, section editor, assistant, author) and a context
    check — it applies **neither** a submission-assignment policy **nor** the published-lock.
    Any such user can therefore read, overwrite, delete or reprocess **any** citation in
    the journal, for **any** submission, regardless of assignment or publish state
    (live-confirmed: an unrelated author overwrote a citation on a submission they had no
    role on; a manager edited citations on a published version). The bulk publication-level
    routes (add/import, delete-all, reprocess-all on `PKPSubmissionController`) are
    stricter — they carry `SubmissionAccessPolicy` (assignment enforced) **and** enforce
    the published-lock through an **inline `canEditPublication()` guard** that returns 403
    when locked; they lack only the *declarative* `PublicationWritePolicy`, not the lock
    itself. So **only the single-citation routes are ungated** — the assignment check and
    the published-lock are both absent there (live-confirmed: an *assigned* author on a
    **published** submission was refused the bulk import with 403 "You are not allowed to
    edit this publication", yet still edited that same submission's citation by id → 200).
    No UI exposes the gap (the citation manager only ever renders inside a submission's own
    gated References tab), so it is an **API-only** capability; see Known deviations.

## Side effects

- **Metadata save** writes the field values as **publication settings** rows (coverage /
  rights / source / type / fundingStatement / citationsRaw) and rewrites the publication's
  **controlled-vocabulary** rows for the chip fields; it records the **Metadata updated**
  activity-log entry (Rule 11). No email or notification (`publication/DAO::update()`;
  `EVLOG-SUBM-META-UPD`).
- **Saving a changed References text** (`citationsRaw`) deletes and re-inserts the
  publication's `citations` rows from the tokenised list (Rule 6); each row's structured
  fields live in `citation_settings`. **Add references** inserts only the new,
  non-duplicate rows. **Delete / Delete all** remove rows. None of these send mail or
  notifications.
- **Reprocess** (row or all) dispatches the background enrichment job chain
  (`citation-enrichment-pipeline`); the jobs update the citation rows asynchronously and
  the manager polls for the result (Rule 9).
- **New version**: creating a new publication version **copies** the citation rows to the
  new version and blanks the new version's `citationsRaw` (so the parsed rows persist but
  the raw block is reset), owned by `publication-versioning`
  (`publication/Repository::version()` — `setData('citationsRaw', null)`;
  `citation/Repository::copyCitations()`).

## Settings that modify behavior

- **References metadata mode** (Settings → Workflow → Submission → Metadata, the
  *References* field; owned by `submission-wizard-metadata`): its being set to any
  collecting value is what makes the **References tab appear** and drives the
  publication's `citationsRaw` field (Rule 5).
- **References Metadata Lookup** (`citationsMetadataLookup`, same panel, shown only while
  References is collected; **off by default**): switches per-citation editing between the
  raw and structured forms, shows/hides the Reprocess actions and the processed-status +
  auto-poll, and decides whether importing references triggers enrichment or stores them
  as raw text (Rules 8–9). With it off, a DOI is *meant* to be extracted from each raw line
  — see Known deviations for the initial-import case.
- **Each metadata field's mode** (collect / request / require; owned by
  `submission-wizard-metadata`): a field is present and editable on the Metadata tab under
  **any** collecting mode (Rule 2). Require adds no marker or block here.
- **Supported submission languages** (Settings → Website → Languages): which language
  values the multilingual metadata fields offer.

## Cross-feature interactions

- **submission-wizard-metadata** — owns the metadata field set, its four-mode
  request/require configuration, the References field's intake, and the chip
  controlled-vocabulary primitive (including its journal-scope suggestion bug). This spec
  owns the post-submission edit of the same fields on the Metadata tab and the
  citation-manager editing on the References tab. `ForTheEditors` (the wizard's metadata
  form) **extends** `PKPMetadataForm` (owned here).
- **publication-title-abstract-body** — the sibling Publication tab; shares the multilingual
  form shape and writes the same **Metadata updated** log surface owned here.
- **contributors** — the sibling Publication tab; also writes the Metadata updated log via
  set-primary-contact.
- **publication-versioning** — owns the `canEditPublication` published-lock/author gate
  (referenced throughout) and the per-version copy of citations (Side effects).
- **publication-issue-assignment** — owns **category assignment** to a publication (the
  Issue tab's `categoryIds` field) and the `publication_categories` store; this spec does
  **not** cover categories despite the field family overlap.
- **categories** — owns category definitions/nesting.
- **citation-enrichment-pipeline** (background) — owns the reference metadata-lookup job
  chain and the two reprocess endpoints (`API-citation-reprocess-citation`,
  `API-submission-reprocess-citations-by-publication-id`); this spec owns the reprocess
  **UI action** and the citation CRUD it sits alongside.
- **citation-style-language** — owns the reader-facing "how to cite" formatting/download,
  which is unrelated to this editing surface despite the shared "citation" word.
- **data-availability-citations** — owns the separate **Data** tab (data availability
  statement + data citations), a different mode and manager.

## Canonical scenarios

1. **Editor edits the descriptive metadata** — Editor: opens a submission's Publication →
   **Metadata** tab, sees only the journal's enabled fields (on `publicknowledge`, just
   **Keywords**), adds a keyword chip and a Coverage value (if enabled), switches the
   form's language tab to enter a French keyword, and saves; the values persist on the
   selected version and a **Metadata updated** entry appears in the activity log. No field
   is marked required, and an empty save is accepted.
2. **The tab reflects the journal's metadata modes** — Manager: with Subjects set to
   *collect but don't ask* and Coverage to *require*, the Metadata tab shows **both**
   (any collecting mode surfaces here, unlike the wizard which hides collect-only Subjects),
   neither carrying a required marker; after disabling every metadata field, the tab shows
   "No metadata fields are currently enabled."
3. **Add references as raw text** — Editor: on the References tab, pastes three references
   (one per line) into the Add box and clicks **Add**; OJS parses them into three rows in
   the Structured References table (sequence 1–3, status *Not processed*); re-adding a line
   already present is skipped as a duplicate.
4. **Edit a citation — raw vs structured** — Editor: with *References Metadata Lookup*
   **off**, **Edit** on a row opens a single Raw Citation textarea; the manager corrects
   the text and saves. On a journal with lookup **on**, the same Edit opens the
   ~19-field structured form (DOI, authors, title, source, pages …) with Raw Citation
   required; the editor fills the DOI and title and saves.
5. **Reprocess a citation** — Editor (lookup on): clicks **Reprocess** on an unstructured
   row; the citation flips to *Not processed* and the background pipeline runs, filling the
   structured fields and marking it structured; the manager's status line and 7-second poll
   reflect the change. **Reprocess all** does the same for the whole list.
6. **Published version — warn vs hard-lock** — On a published version a **manager** still
   sees the Add box, per-row Edit/Delete and Delete-all behind the yellow "this version is
   published" warning and can save (warn-not-locked); an **author** granted metadata
   permission finds every metadata field and every citation control gone the moment any
   version is published or scheduled. The References tab itself is absent entirely if the
   journal doesn't collect references.
7. **Permission boundary — the citation API gap** — ⚠ Via the API only, a journal user who
   is a manager, section editor, assistant **or author** — *even one with no role on the
   submission and even on a published version* — can GET, edit, delete or reprocess any
   citation by id (live-confirmed: an unrelated author overwrote another submission's
   citation, HTTP 200, persisted). The UI never offers this; a normal user only edits
   citations inside their own submission's gated References tab. The bulk
   import/delete/reprocess routes are **not** part of the gap — they require submission
   access *and* enforce the published-lock via an inline `canEditPublication()` guard
   (verifier-confirmed: an assigned author on a published submission got 403 on the bulk
   import but 200 on the single-citation edit) — so **only the single-citation routes are
   ungated**.

## Known deviations (as-built ≠ intent)

- ⚠ **The single-citation API endpoints enforce neither submission-assignment nor the
  published-lock** (cross-submission tamper; data-integrity, API-only). `PKPCitationController`
  authorises get/getMany/edit/delete/reprocess with only the journal role list + a context
  check — no `SubmissionAccessPolicy` and no `PublicationWritePolicy`. A journal author or
  editorial user can read/overwrite/delete/reprocess **any** submission's citations,
  regardless of assignment or publish state. Live-confirmed 2026-07-04: `atester` (a plain
  author, no role on the target submission) `GET` and `PUT /citations/{id}` → 200, and the
  edit persisted; a manager edited citations on a published version. **Verifier re-confirmed
  2026-07-04** on the running server: unassigned `atester` `GET` + `PUT /citations/{id}` →
  200 persisted, while the bulk delete-all on the same submission was refused (401). The
  bulk publication-level routes are **not** part of this gap: they carry
  `SubmissionAccessPolicy` (assignment enforced) **and** enforce the published-lock through
  an **inline `canEditPublication()` guard** returning 403 when locked — they lack only the
  *declarative* `PublicationWritePolicy`, not the lock. (Verifier-confirmed: an *assigned*
  author on a **published** submission was refused the bulk `importAdditionalCitations` with
  403, yet edited that submission's citation by id → 200 — isolating the hole to the
  single-citation routes.) No UI reaches these paths (the citation manager only renders
  inside a submission's own `canEditPublication`-gated References tab), so it is API-only —
  but a genuine authorization gap, unlike the metadata form, contributors and title/abstract,
  which all carry `PublicationWritePolicy`. This is the **second** authorization hole this
  campaign has surfaced (after the library-file unauthenticated disclosure, ledger row 88).
  *Tracked as `docs/e2e/app-changes.md` §2 row 91 (add `SubmissionAccessPolicy` +
  `PublicationWritePolicy` to `PKPCitationController`; the bulk routes only need the
  policy for declarative consistency — they already enforce the lock inline).*
- ⚠ **A DOI extracted from a raw reference on the *initial* import (lookup off) is not
  persisted** (silent data loss of the derived DOI). When *References Metadata Lookup* is
  off, `importCitations()` extracts a DOI from each raw line and `setData('doi', …)` on the
  citation — but **after** the row was already inserted and **without** a follow-up save, so
  the DOI is dropped. The parallel "add additional references" path
  (`importAdditionalCitations()`) *does* call `Repo::citation()->edit()` after setting the
  DOI, so it persists. Live-confirmed 2026-07-04: three references saved via the publication
  (initial import), the DOI-bearing line came back with `doi = null`. Low impact (the DOI can
  still be lifted by enrichment or manual edit) but an inconsistency between the two import
  paths. *Suggested ledger row.*

## Open questions

1. Should the single-citation API (`PKPCitationController`) apply `SubmissionAccessPolicy`
   and `PublicationWritePolicy`, matching the metadata form, contributors and title/abstract
   (Known deviations #1)? As-built any journal author/editor can tamper with any
   submission's citations by id.
2. Is the **initial-import DOI non-persistence** (Known deviations #2) intended, or should
   `importCitations()` save the extracted DOI as `importAdditionalCitations()` does?
3. **FORM-pkp-metadata-form seam — resolved here.** The base `PKPMetadataForm` is instantiated
   *directly* for this tab (no OJS override, no subclass), whereas the wizard uses the
   `ForTheEditors` subclass. This spec claims the base atom `FORM-pkp-metadata-form`
   (Publication-tab use); `submission-wizard-metadata` keeps `FORM-for-the-editors`. Confirm
   at grooming.
4. **Reprocess-endpoint seam.** The reprocess UI action is owned here, but the two reprocess
   endpoints (`API-citation-reprocess-citation`,
   `API-submission-reprocess-citations-by-publication-id`) are left to the background
   `citation-enrichment-pipeline` per the feature map. Confirm the split, or move the thin
   controller endpoints here and keep only the jobs in background.
5. ~~The feature map lists **category assignment** under this feature~~ **Resolved
   (verifier 2026-07-04):** confirmed `PKPMetadataForm` adds **no** category field (only
   keywords/subjects/disciplines/supportingAgencies + coverage/rights/source/type/
   fundingStatement + the OJS pub-id/articleNumber), so the Metadata tab has no category
   picker. The post-submission picker is the **Issue** tab's `IssueEntryForm categoryIds`
   (owned by `publication-issue-assignment`, which claims `DB-publication_categories`); the
   intake picker is the wizard's For-the-Editors step. The FEATURE-MAP feature title has
   been corrected to drop "categories" (its atoms line never claimed a category atom).
6. Is it intended that a **new version keeps the parsed citation rows but blanks
   `citationsRaw`** (Side effects), so the References Add box starts empty on a new version
   while the Structured References table is pre-populated?

---

<!-- REFERENCE MATERIAL — provenance and campaign bookkeeping, not product-owner narrative. -->

## Reference — entry points & surfaces

| Entry | Path | Atom |
|-------|------|------|
| Metadata tab (form fetch) | Workflow → Publication → Metadata; `GET api/v1/submissions/{id}/publications/{pubId}/_components/metadata` | API-submission-get-publication-metadata-form |
| Metadata form class | `lib/pkp/classes/components/forms/publication/PKPMetadataForm.php` (base of the wizard's `ForTheEditors`) | FORM-pkp-metadata-form |
| References field (whole-list raw) form | `PKPCitationsForm` (`citationsRaw` textarea) — the References-mode field; parsed into rows on save | FORM-pkp-citations-form |
| References tab (citation manager) | Workflow → Publication → References (present when References mode is on) | VUE-citation-manager |
| Add references (append + parse) | `POST …/publications/{pubId}/citations/importAdditionalCitations` | API-submission-import-additional-citations |
| Delete all references | `DELETE …/publications/{pubId}/citations/deleteCitationsByPublicationId` | API-submission-delete-citations-by-publication-id |
| List / get one citation | `GET api/v1/citations` (list, count/offset), `GET api/v1/citations/{id}` | API-citation-get-many, API-citation-get |
| Edit / delete a citation | `PUT api/v1/citations/{id}`, `DELETE api/v1/citations/{id}` | API-citation-edit, API-citation-delete |
| Raw / structured edit forms | `CitationRawEditForm` (1 field) / `CitationStructuredEditForm` (~19 fields); chosen by `citationsMetadataLookup` | FORM-citation-raw-edit-form, FORM-citation-structured-edit-form |
| Reprocess a citation / all | `POST …/citations/{id}/reprocessCitation`, `POST …/publications/{pubId}/citations/reprocessCitationsByPublicationId` | *(owned by citation-enrichment-pipeline — seam, Open q. 4)* |
| Citation schema | `lib/pkp/schemas/citation.json` (raw + structured props, PID validation, `writeDisabledInApi` on publicationId) | SCHEMA-citation |
| Storage | `citations` (raw_citation + seq) + `citation_settings` (structured fields incl. isStructured/processingStatus); metadata fields in `publication_settings` | DB-citations, DB-citation_settings, DB-publication_settings |
| Metadata-updated log | `SUBMISSION_LOG_METADATA_UPDATE` on every publication edit | EVLOG-SUBM-META-UPD |

Route/role gates: the metadata form GET + `editPublication` PUT require an authenticated
context user in Manager|SubEditor|Assistant|Author with `SubmissionAccessPolicy` +
(on write) `PublicationWritePolicy` → the `canEditPublication` published-lock. The
`/citations/{id}` routes require Manager|SubEditor|Assistant|Author with **only**
`UserRolesRequiredPolicy` + `ContextRequiredPolicy` (no submission/publication policy —
Known deviations #1). The publication-level bulk citation routes
(import/delete-all/reprocess-all) require the same roles + `SubmissionAccessPolicy`, and
enforce the published-lock via an **inline `canEditPublication()` guard** (403 when locked)
rather than the declarative `PublicationWritePolicy` — so they are lock-enforced despite not
appearing in `$requiresPublicationWriteAccess`.

## Reference — code anchors

- Metadata form: `lib/pkp/classes/components/forms/publication/PKPMetadataForm.php`
  (`__construct()` field-by-field, `enabled()` mode gate, `getVocabEntryData()`); served by
  `lib/pkp/api/v1/submissions/PKPSubmissionController.php` `getPublicationMetadataForm()`
  (route `_components/metadata`; no OJS override); saved via `editPublication()`.
- References field / parsing: `lib/pkp/classes/components/forms/publication/PKPCitationsForm.php`
  (`citationsRaw`); `lib/pkp/classes/publication/DAO.php` `insert()/update()` →
  `lib/pkp/classes/citation/Repository.php` `importCitations()` (tokenise + replace + DOI
  branch), `importAdditionalCitations()` (append + dedup + DOI persist),
  `deleteByPublicationId()`, `copyCitations()`, `reprocessCitation()` (`Bus::chain` of
  enrichment jobs — owned by citation-enrichment-pipeline).
- Citation API: `lib/pkp/api/v1/citations/PKPCitationController.php`
  (`getGroupRoutes()`, `authorize()` — the missing policies, `get()/getMany()/edit()/delete()/reprocessCitation()`);
  publication-level bulk routes in `PKPSubmissionController.php`
  (`importAdditionalCitations()/deleteCitationsByPublicationId()/reprocessCitationsByPublicationId()`;
  `requiresSubmissionAccess` incl. these three, `requiresPublicationWriteAccess` excl. them).
- Edit forms: `lib/pkp/classes/components/forms/citation/CitationRawEditForm.php`,
  `CitationStructuredEditForm.php`; schema `lib/pkp/schemas/citation.json`.
- Citation manager UI: `lib/ui-library/src/managers/CitationManager/` — `CitationManager.vue`,
  `citationManagerStore.js` (`deleteAllCitations()`, `reprocessAllCitations()`, poll interval,
  `canEditPublication`), `useCitationManagerActions.js` (`citationEditCitation()` raw/structured
  switch), `useCitationManagerConfig.js` (`getItemActions()` reprocess gate),
  `useCitationManagerFormAddRawCitation.js`, `CitationManagerCellActions.vue`
  (`v-show canEditPublication`); registered in `WorkflowPageOJS.vue`; nav/config in
  `useWorkflowNavigationConfigOJS.js` (`supportsCitations`) and
  `workflowConfigEditorialOJS.js` (`metadata`/`citations` primary items,
  `contextCitationsMetadataLookup`); page-init in `PKPDashboardHandler.php`
  (`supportsCitations`, `contextCitationsMetadataLookup`, `componentForms`).
- Metadata-updated event: `lib/pkp/classes/publication/Repository.php` `edit()`
  (`SUBMISSION_LOG_METADATA_UPDATE`, `submission.event.general.metadataUpdated`);
  constant `lib/pkp/classes/log/event/PKPSubmissionEventLogEntry.php` (`268435458`).
- Edit gate (referenced, owned by publication-versioning):
  `lib/pkp/classes/submission/Repository.php` `canEditPublication()`.
- Storage: `lib/pkp/classes/migration/install/MetadataMigration.php` (`citations` +
  `citation_settings`); `SubmissionsMigration.php` (`publication_settings`).
