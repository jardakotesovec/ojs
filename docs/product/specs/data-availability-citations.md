---
name: data-availability-citations
scope: On a publication's "Data" tab, record the free-text Data Availability Statement (where the article's underlying data can be found) and manage an ordered list of formal Data Citations (each dataset cited by identifier, repository, relationship and creators) — distinct from the reference/citation list
shared: pkp-lib
status: verified
e2e-plans: []
atlas-claims:
  - VUE-data-citation-manager
  - FORM-data-citation-edit-form
  - SCHEMA-data-citation
  - API-data-citation-get-many
  - API-data-citation-get
  - API-data-citation-add
  - API-data-citation-edit
  - API-data-citation-delete
  - API-data-citation-save-order
  - API-submission-get-publication-data-availability-form
  - DB-data_citations
  - DB-data_citation_settings
  - LOC-submission-submission-dataCitations
---

# Publication — Data availability & citations

## Purpose

Some journals ask authors to disclose *where the data behind an article lives* and to
formally *cite the datasets* the study used. OJS 3.6 gathers both on one Publication tab
labelled **Data** (heading "PUBLICATION: DATA"). It holds two surfaces: (1) the **Data
Availability Statement** — a free-text, multilingual, rich-text field ("A short statement
describing whether or not the author(s) have made their research data available and, if
so, where readers may access it"); and (2) the **Data Citations** manager — an ordered
table of formal dataset citations, each with a title, identifier (DOI/Accession/…),
repository, relationship type, year, creators and URL. Both are *editorial-side* surfaces
on the live publication (also collectable at intake — see the wizard seam). The statement
is the same `dataAvailability` field the wizard's metadata step drives; the data citations
are a **separate entity** stored in their own `data_citations` table — not the reference
list (`citations`) on the References tab. This spec owns the Data tab, the data-citation
entity and its CRUD; the reader-facing display and the intake question are owned elsewhere
(see Cross-feature interactions).

**Liveness (established 2026-07-04, live browser probe):** the feature is **fully wired
and reachable** in default OJS 3.6 — unlike publication-amendments' reader side. The
`DataCitationManager` Vue component is registered in `WorkflowPageOJS.vue` and rendered by
both the editorial and author workflow configs; the backend controller, form, schema and
migration all ship. It is **off by default**: the Data tab appears only once a journal
turns on the data-availability and/or data-citations metadata mode (neither is enabled on
`publicknowledge`). With a scratch journal that enables them, the tab, the statement form,
the citation manager (Add / Order / per-row Edit + Delete) and the add form all render
and function (live-probed). The one gap is reader-side: data citations are captured but
never shown to readers (Rule 9 / Known deviations). **Verifier re-confirmed 2026-07-04:**
the retained `data-availability-citations.spec.js` (4 scenarios) ran green against the
live server — the manager CRUD, the row-97 divergence (author statement read-only yet
Add/Order enabled + Add POST → 401), the row-98 reader-absence (statement shown, citation
rendered nowhere) and the properly-scoped API (anonymous reader refused 401/403, submitting
author reads 200) all held; the authorization contrast with the reference-citation hole
(row 91) was re-verified from the policy stack (Rule 10).

## Actors & permissions

Permissions are organised **by action**. Recurring terms and baselines, stated once: a
**manager** (and a **site admin**, who acts as a manager on any journal they created) may
act on any submission — and, being able to access unassigned submissions, is **never
hard-locked** by the published-lock (warn-not-locked); **assigned section editors and
assistants** act per their stage assignment (never recommend-only); an **author-role**
user reaches the Data tab through *My Submissions* on their own submission. The
**published-lock / author-edit gate** (`canEditPublication`) is defined once in
`publication-versioning` and only referenced here: on a published/scheduled version
managers/editors stay editable behind a red "This version has been published and can not
be edited" banner, while an author-role user is **hard-locked** out. Both the statement
form and the data-citation API receive this verdict — **but the data-citation manager's UI
controls do not gate on it** (Rule 8 / ⚠). <sup>a</sup>

| Action | Who may — and when |
|--------|--------------------|
| **See the Data tab** | • Any editorial user with access to the submission, and the submitting author (via *My Submissions*) — **but only when the journal collects a data-availability statement and/or data citations** (either metadata mode is a non-disabled value); otherwise the tab is absent for everyone <sup>b</sup> |
| **Edit the Data Availability Statement** | • Managers/site admins — any version, warned on a published one<br>• Assigned section editors and assistants (not recommend-only)<br>• The author — only while nothing on the submission is published or scheduled; once any version is published/scheduled, the field renders read-only (hard-locked). The statement form honours the lock — it goes read-only when the gate is false <sup>c</sup> |
| **Add / edit / delete / reorder a Data Citation (backend outcome)** | • Same roles and the same `canEditPublication` gate as the statement — the data-citation API enforces submission-assignment **and** the published-lock, so a manager may still add on a published version while a hard-locked author's write is refused <sup>d</sup> |
| **See the Add / Order / Edit / Delete controls (UI)** | • ⚠ Shown to **every** actor who can open the Data tab, **including a hard-locked author on a published version** — the manager's controls are not gated by the published-lock (unlike the References tab and the sibling statement form). The controls invite an action the server then refuses. See Known deviations <sup>e</sup> |
| **Read data citations / the statement as a reader** | • The **statement** appears on the public article page (owned by `article-landing`)<br>• ⚠ **data citations have no reader-facing display** in 3.6 despite the manager's copy promising it — pointer only, see Rule 9 <sup>f</sup> |

<sup>a</sup> submission/Repository::canEditPublication() (gate, owned by publication-versioning — returns true early for manager/site-admin via `_canUserAccessUnassignedSubmissions()`, so they are never hard-locked; a plain author on a published/scheduled version gets false); useWorkflowPermissions() canEditPublication ·
<sup>b</sup> useWorkflowNavigationConfigOJS.js getPublicationItemsEditorial()/getPublicationItemsAuthor() (`if (publicationSettings.supportsDataCitations || publicationSettings.supportsDataAvailability)`); PKPDashboardHandler `supportsDataCitations => !!$context->getData('dataCitations')`, `supportsDataAvailability => !!$context->getData('dataAvailability')`; live-probed 2026-07-04 (tab present on a scratch journal with both on; absent on publicknowledge) ·
<sup>c</sup> workflowConfigEditorialOJS.js / workflowConfigAuthorOJS.js `dataAvailabilityAndCitation.getPrimaryItems` (WorkflowPublicationForm `formName: 'dataAvailability'`, `canEdit: permissions.canEditPublication`); PKPSubmissionController::getPublicationDataAvailabilityForm() (form served from `_components/dataAvailability`) ·
<sup>d</sup> PKPDataCitationController::authorize() (UserRolesRequiredPolicy + ContextAccessPolicy + PublicationAccessPolicy on read / PublicationWritePolicy on add/edit/delete/saveOrder); getGroupRoutes() roles Manager|SiteAdmin|SubEditor|Assistant|Author; live-probed 2026-07-04 (hard-locked author POST → HTTP 401) ·
<sup>e</sup> dataCitationManagerStore.js / useDataCitationManagerConfig.js getTopItems()/getItemActions() / DataCitationManagerCellActions.vue — none reference `canEditPublication`; live-probed 2026-07-04 (author on a published version saw enabled "Add a new Data Citation" + "Order" behind the red published banner) ·
<sup>f</sup> templates/frontend/objects/article_details.tpl (`dataAvailability` rendered; no data-citation rendering)

## Fields & validation

**The Data Availability Statement** is one field on the `dataAvailability` form. **The
Data Citation** edit form (opened from the manager's Add / Edit) carries eight fields
(`DataCitationEditForm`); the underlying entity has 11 schema props (`dataCitation.json`).
All data-citation fields are **single-language** (not multilingual), unlike the statement.

| Field (UI label) | Required? | Rules | Anchor |
|------------------|-----------|-------|--------|
| **Data Availability Statement** | No (on this tab) | Multilingual rich-text (bold/italic/super/subscript/link); one value per submission language. Rendered only when the journal's data-availability mode is on; **never carries a required marker on this tab** even in require-mode (require gates only the wizard's final submit) | PKPDataAvailabilityForm::__construct() (`dataAvailability`, FieldRichTextarea, `isMultilingual`); getPublicationDataAvailabilityForm() (calls with `isRequired` omitted → false) |
| **Title** (data citation) | **Yes** | Free text; the dataset's title | DataCitationEditForm (`title`, FieldText, `isRequired`) |
| **Identifier type** | No | Select from DOI, Accession, PURL, ARK, URI, ARXIV, ECLI, Handle, ISSN, ISBN, PMID, PMCID, UUID | DataCitationEditForm (`identifierType`, FieldSelect); schema `in:` enum |
| **Identifier** | No — but **required with Identifier type** (and vice versa) | The dataset's PID; on save, known prefixes/base-URLs are stripped and the value is validated against the chosen type's format (an invalid DOI/Handle/… is rejected with "…identifier.invalid") | DataCitation::boot() (PidResolver::extractFromString/removePrefix); Repository::validate() (per-type `isValid`); schema `required_with:identifierType` |
| **Relationship type** | **Yes** | Select: **supporting / generated / analyzed / non-analyzed** (how the dataset relates to the article) | DataCitationEditForm (`relationshipType`, FieldSelect, `isRequired`); schema `in:supporting,generated,analyzed,non-analyzed` |
| **Repository** | No | Free text — where the dataset is stored / its publisher | DataCitationEditForm (`repository`, FieldText) |
| **Year** | No | Four digits (`digits:4`) — publication year of the dataset | DataCitationEditForm (`year`, FieldText); schema `digits:4` |
| **Creators** | No | A sub-table of dataset authors — **Given name / Family name / ORCID iD** rows, added via an inner Add; each ORCID is format-validated | DataCitationEditForm (`authors`, FieldAuthors); schema `authors.items` (givenName/familyName/orcid), `orcid` validation |
| **URL** | No | Must be a valid URL | DataCitationEditForm (`url`, FieldText); schema `url` |

Server-set / hidden props (not user fields): `publicationId` (set from the route,
**write-disabled** in the API), `seq` (order, set by the reorder endpoint), `id`. <sup>a</sup>

<sup>a</sup> dataCitation.json (`publicationId` `writeDisabledInApi`, `seq` default 0, `id` readOnly/primary); PKPDataCitationController::add() (forces `publicationId` from the authorized publication; `getWriteDisabledErrors()` rejects a client-supplied publicationId)

## Rules & state

**The statement**

1. **The statement is the same field at intake and on the tab.** The Data Availability
   Statement stores to the publication's multilingual `dataAvailability` setting — the same
   property the wizard's metadata step collects (owned by `submission-wizard-metadata`).
   The Data tab is the post-submission edit of that one value; there is no separate
   "publication-tab statement" field. The tab's form is fetched from
   `_components/dataAvailability` and **only renders the field when the journal's
   data-availability mode is truthy** (`getPublicationDataAvailabilityForm()`;
   `PKPDataAvailabilityForm::__construct()` gates the field on `$dataAvailabilitySetting`).
2. **On the tab the statement is never required.** `getPublicationDataAvailabilityForm()`
   constructs the form **without** the `isRequired` argument (default false), so even a
   journal that set data availability to *require* shows no required marker and no
   save-block here — require gates only the wizard's final submit (owned by
   `submission-wizard-metadata`, where the field IS marked required and blocks submit).
   (Contrast the wizard's `getEditorsStep()`, which passes `isRequired` = require-mode.)
3. **Saving the statement PUTs the selected publication version** and is subject to the
   published-lock: the form receives `canEdit: permissions.canEditPublication`, so it goes
   read-only for a hard-locked author on a published/scheduled version while a manager
   stays editable behind the red published banner (live-confirmed: author on a published
   version saw the statement form disabled).

**The data-citation manager & entity**

4. **The Data tab shows a data-citation manager when the journal collects data citations.**
   Below the statement, the `DataCitationManager` lists the publication's data citations
   (read from `publication.dataCitations`, hydrated from the `data_citations` rows) in an
   ordered table with one **Title** column and a per-row actions menu, plus top controls
   **Add a new Data Citation** and **Order**; the empty state reads "No data citations have
   been added." The manager renders when data citations are collected — **but the two
   workflow configs gate it differently** (Rule 10). (`DataCitationManager.vue`;
   `dataCitationManagerStore.js`; `DataCitation` DAO hydration `publication/DAO::setDataCitations()`.)
5. **Add opens an 8-field side modal ("Add Data Citation").** Filling Title + Relationship
   type (the two required fields) and saving POSTs the entity to
   `…/publications/{pubId}/dataCitations`; the manager then refetches the publication so the
   new row appears. Edit opens the same modal pre-filled and PUTs to `…/dataCitations/{id}`;
   Delete asks "Are you sure you want to delete this item?" then DELETEs; each write is
   validated server-side against the schema (Fields). (`useDataCitationManagerActions.js`;
   `PKPDataCitationController::add()/edit()/delete()`.)
6. **Data citations are ordered and re-orderable.** Each row carries a `seq`; the **Order**
   button switches the table into a move-up/move-down mode, and saving PUTs the id sequence
   to `…/dataCitations/order`, which rewrites each row's `seq` for that publication.
   (`useOrdering` in `dataCitationManagerStore.js`; `PKPDataCitationController::saveOrder()`.)
7. **The identifier is normalised and format-checked by its type.** On save the model
   strips known prefixes / base-URLs from the identifier and, if the value doesn't parse for
   the chosen type, validation rejects it ("The identifier '…' is not a valid {type}");
   identifier and identifier type are mutually required (one without the other is a
   validation error). (`DataCitation::boot()` → `PidResolver`; `Repository::validate()`;
   schema `required_with`.)
8. **⚠ The manager's UI controls are not gated by the published-lock.** Unlike the
   statement form (Rule 3) and unlike the References tab's citation manager, the
   `DataCitationManager` never receives `canEditPublication` and its store/config expose
   Add, per-row Edit/Delete and Order **unconditionally**. So a hard-locked author on a
   published version sees fully enabled controls behind the red "this version has been
   published and can not be edited" banner. The **backend** still refuses the write —
   `PKPDataCitationController` applies `PublicationWritePolicy` on add/edit/delete/saveOrder,
   so the attempt fails (live-confirmed: author's Add POST → HTTP 401) — but the UI presents
   an affordance the server rejects. See Known deviations. (`dataCitationManagerStore.js`,
   `useDataCitationManagerConfig.js`, `DataCitationManagerCellActions.vue` — no
   `canEditPublication`; `PKPDataCitationController::authorize()`.)
9. **⚠ Data citations are captured but shown on no reader page.** The manager's own
   description promises data citations "…appear alongside other references in the
   publication," and the schema documents the entity as citations for cited data — yet
   **no** front-end template renders them (`article_details.tpl` renders the `dataAvailability`
   statement but nothing data-citation; a frontend-template grep for `dataCitation` is empty
   — the only matches are the submission wizard's own intake/review templates). So the Data
   Citations manager is an editor/author capture surface with no public output in default
   3.6 (mirrors the amendments reader-absence, ledger row 96). See Known deviations.

**Authorization**

10. **The data-citation API is properly scoped — a notable contrast to the reference-citation
    API.** `PKPDataCitationController::authorize()` applies `UserRolesRequiredPolicy` +
    `ContextAccessPolicy` + `PublicationAccessPolicy` (read) / `PublicationWritePolicy`
    (write), so every route enforces both **submission access** and (on write) the
    **published-lock**. This is *not* the ungated hole that
    `publication-metadata-references` records for the single-citation `/citations/{id}`
    routes (ledger row 91): the data-citation controller does the assignment + lock checks
    the reference-citation controller omits. Additionally, get/edit/delete verify the target
    citation actually belongs to the authorized publication (else HTTP 403/"publications not
    matched"). (`PKPDataCitationController::authorize()`, `get()`/`edit()`/`delete()`
    publication-id guard.)

**Config asymmetry**

11. **Editorial vs author configs gate the manager differently.** The editorial workflow
    config renders the `DataCitationManager` only `if (supportsDataCitations)`, but the
    author config renders it **unconditionally** (whenever the tab is shown). The tab itself
    appears when *either* data availability *or* data citations is collected. So on a journal
    that collects only the statement (data citations *off*), an editor sees the Data tab with
    just the statement, while the **author** additionally sees a functioning Data Citations
    manager the editor doesn't — and the API (which checks only publication write access, not
    the metadata mode) accepts those writes (live-confirmed: the retained test seeds a data
    citation on `publicknowledge`, which collects neither mode, and the manager POST returns
    200). Low-impact but an inconsistency; flagged as an Open question. (`workflowConfigEditorialOJS.js` `if (…supportsDataCitations)` vs
    `workflowConfigAuthorOJS.js` unconditional push.)

## Side effects

- **Statement save** writes the multilingual `dataAvailability` value as a **publication
  setting** and records the standard **"Metadata updated"** activity-log entry that every
  publication edit fires (owned by `publication-metadata-references`). No email or
  notification.
- **Data-citation add/edit/delete/reorder** insert/update/delete rows in **`data_citations`**
  (+ localized/structured values in **`data_citation_settings`**); they run through the
  entity's own controller, **not** `editPublication`, so they write **no** activity-log
  entry and send no mail or notification. Rows cascade-delete with their publication.
- **New version**: creating a new publication version **copies** the data-citation rows to
  the new version (`publication/Repository::version()` iterates `dataCitations` and
  re-`create`s each on the new publication); the `dataAvailability` statement copies with the
  other publication settings. Owned by `publication-versioning`.

## Settings that modify behavior

- **Data Availability Statement metadata mode** (`dataAvailability`) and **Data Citations
  metadata mode** (`dataCitations`) — both on **Settings → Workflow → Submission → Metadata**
  (the four-mode don't-collect / collect / request / require control owned by
  `submission-wizard-metadata`). Their effect *here*: any non-disabled value makes the
  corresponding surface appear on the Data tab, and the tab itself appears when **either** is
  collected (Rule 1, 4; `!!$context->getData(...)` → `supportsDataAvailability` /
  `supportsDataCitations`). The **request/require** distinction only affects **intake** (the
  wizard sections and the submit-block) — on this editorial tab any collecting mode surfaces
  the field with no required marker (Rule 2).
- **Supported submission languages** (Settings → Website → Languages): which language values
  the multilingual statement offers. (Data-citation fields are single-language.)

## Cross-feature interactions

- **submission-wizard-metadata** — owns the four-mode request/require configuration of both
  `dataAvailability` and `dataCitations`, the intake **Data Availability Statement** section
  (For-the-Editors step) and the intake **Data Citations** section (Details step, shown in
  request/require mode). It also **claims the shared form atom `FORM-pkp-data-availability-form`**
  (the *same* `PKPDataAvailabilityForm` class serves intake and this tab) — this spec
  *references* that form and claims the publication-tab **fetch endpoint**
  (`API-submission-get-publication-data-availability-form`) instead. The DataCitationManager
  used at intake is the same component owned here (reused, like contributors).
- **publication-metadata-references** — the **References** tab manages the reference/citation
  list, a **distinct entity** (`citations` / `citation_settings`) from the data citations here
  (`data_citations` / `data_citation_settings`); the only overlap is the word "citation." That
  spec also records the single-citation-API authorization gap (ledger row 91) that this
  feature's API pointedly does **not** share (Rule 10).
- **article-landing** (feature 38, not yet written) — owns the public article page that renders
  the `dataAvailability` statement; **does not** render data citations (Rule 9 gap lands there).
- **publication-versioning** — owns the `canEditPublication` published-lock (referenced
  throughout) and the per-version copy of data citations + the statement (Side effects).
- **publication-title-abstract-body / contributors** — sibling Publication tabs; share the
  published-lock pattern and the "Metadata updated" log surface.
- **doi-deposit / oai-pmh** (background/out of scope) — a data citation's identifier is
  PID-normalised (`PidResolver`) as if for metadata export; whether data citations are
  emitted in any deposit/OAI format is out of this feature's scope (Open questions).

## Canonical scenarios

1. **Author records a data-availability statement** — Author (own, unpublished submission):
   on Publication → **Data**, types a statement into the rich-text "Data Availability
   Statement" field ("Raw data are available at Dryad, DOI …") and clicks **Save**; the value
   persists on the selected version and, once the article is published, appears in the "Data
   Availability Statement" section of the public article page. The field is unmarked (never
   required on this tab) even if the journal set data availability to *require*.
2. **Add a formal data citation** — Editor or author: clicks **Add a new Data Citation**,
   fills **Title** and picks a **Relationship type** (the two required fields), optionally an
   **Identifier type** + **Identifier** (a DOI, which is prefix-stripped and format-checked on
   save), **Repository**, **Year**, **Creators** and **URL**, and saves; a new row appears in
   the Data Citations table. Saving a citation with an identifier that doesn't match its type
   is rejected with an "identifier is not valid" error.
3. **Edit, reorder and delete data citations** — Editor: opens a row's actions menu to **Edit**
   (same modal, pre-filled) and save a correction; clicks **Order** to switch to move-up/
   move-down and saves a new order (the `seq` rewrites); deletes a row via the confirm dialog
   ("Are you sure you want to delete this item?"). None of these write an activity-log entry.
4. **Published-lock — manager warned, author hard-locked, and the manager's ungated controls**
   — On a **published** version an author (hard-locked) sees the red "this version has been
   published and can not be edited" banner and a **read-only** statement field — yet the Data
   Citations **Add / Order / Edit / Delete** controls are still shown and enabled (⚠ Rule 8);
   attempting an Add is refused by the server (HTTP 401). A **manager** on the same version is
   warn-not-locked: the statement stays editable and data-citation writes succeed.
5. **Tab visibility follows the journal's metadata modes** — On a journal that collects
   **neither** a data-availability statement nor data citations (the default, e.g.
   `publicknowledge`), the **Data tab is absent** for everyone. Enabling either mode makes the
   tab appear; the statement form shows only when data availability is collected, and the
   citation manager shows when data citations are collected (⚠ except the author config shows
   the manager whenever the tab is present — Rule 11).

## Known deviations (as-built ≠ intent)

- ⚠ **The Data Citations manager's Add/Edit/Delete/Order controls are not gated by the
  published-lock, so a hard-locked author is shown controls the server then refuses**
  (affordance-vs-behaviour; no data loss — the write is blocked). The sibling statement form
  receives `canEditPublication` and goes read-only, and the References tab's citation manager
  `v-show`s its controls on the same gate, but the `DataCitationManager` store/config expose
  every control unconditionally. Live-confirmed 2026-07-04: a pure author on a published
  version saw enabled "Add a new Data Citation" + "Order" behind the red published banner, and
  the Add POST returned **HTTP 401**. *Tracked as `docs/e2e/app-changes.md` §2 row 97 (pass
  `canEditPublication` into `DataCitationManager` and gate the top/row controls on it, matching
  the statement form and the References citation manager).*
- ⚠ **Data citations are captured but rendered on no reader page, though the field copy
  promises a public display** (round-2 gap, UI-copy-contradicts-behaviour; no data loss). The
  manager's description states data citations "…appear alongside other references in the
  publication," yet no front-end template renders them (only the `dataAvailability` statement
  is shown, on `article_details.tpl`). Same shape as the amendments reader-absence (row 96).
  *Tracked as `docs/e2e/app-changes.md` §2 row 98 (implement the reader-side data-citation
  display, or soften the promissory copy until it exists).*
- ⚠ (minor) **Editorial vs author config asymmetry** (Rule 11): the author workflow config
  renders the data-citation manager whenever the Data tab shows, while the editorial config
  gates it on `supportsDataCitations`. On a statement-only journal the author gets a working
  citation manager the editor doesn't, and the API accepts those writes (it checks only
  publication-write access, not the metadata mode). Low impact; captured as an Open question
  rather than a ledger row pending the maintainer's intent call.

## Open questions

1. **Require-mode for data citations does not block submission server-side (mechanism
   code-confirmed; end-to-end submit not driven).** `dataCitations` is listed in
   `Context::getRequiredMetadata()` (fired only when the mode is `require`), and the wizard
   Review step carries an empty-state warning key (`submission.dataCitations.required`), but
   `submission/Repository::validateSubmit()` tests each required non-multilingual field as a
   scalar publication prop — `empty((string) $publication->getData('dataCitations'))`. The
   verifier code-traced the hydration (2026-07-04): `publication/DAO::setDataCitations()`
   stores a **plain PHP array** (`->get()->values()->all()`), so `(string) […]` yields the
   non-empty string "Array" **even for zero rows**, and the required check can **never** fire.
   (Contrast the sibling `dataAvailability`, a multilingual **string** whose require-check
   works — verified by `submission-wizard-metadata`.) So a `dataCitations = require` journal
   would surface the Review warning but not actually gate submit. **The end-to-end wizard
   submit was not driven** (would need a require-mode journal through the wizard's final step);
   the submit-gate itself is owned by `submission-wizard` / `submission-wizard-metadata`, so the
   fix (test the array's length, not its string cast) lands there, not on this tab.
2. Should the data-citation manager's controls honour the published-lock (Known deviations #1)?
   As-built the UI invites an add/edit the server refuses (401) for a hard-locked author.
3. Is the reader-absence of data citations (Known deviations #2) an unbuilt round-2 surface or
   intended (e.g. data citations meant only for metadata export via DOI-deposit/OAI, not the
   article page)? If export is the intent, which format emits them?
4. Is the editorial/author manager asymmetry (Rule 11 / Known deviations #3) intended? Should
   the author config also gate the manager on `supportsDataCitations`, and/or should the API
   reject data-citation writes when the journal's data-citations mode is disabled?
5. **`FORM-pkp-data-availability-form` seam — resolved here.** The *same* `PKPDataAvailabilityForm`
   class serves the wizard intake section (marked required in require-mode) and this Data tab
   (never required). `submission-wizard-metadata` keeps the form atom; this spec references it
   and claims the publication-tab fetch endpoint
   (`API-submission-get-publication-data-availability-form`, previously unclaimed). Confirm at
   grooming.

---

<!-- REFERENCE MATERIAL — provenance and campaign bookkeeping, not product-owner narrative. -->

## Reference — entry points & surfaces

| Entry | Path | Atom |
|-------|------|------|
| Data tab (statement form fetch) | Workflow → Publication → **Data**; `GET api/v1/submissions/{id}/publications/{pubId}/_components/dataAvailability` | API-submission-get-publication-data-availability-form |
| Data Availability Statement form class | `PKPDataAvailabilityForm` (`dataAvailability` FieldRichTextarea) — shared with the wizard intake step | *(FORM-pkp-data-availability-form — owned by submission-wizard-metadata; referenced)* |
| Data Citations manager | Workflow → Publication → Data (present when data citations collected) | VUE-data-citation-manager |
| Data Citation edit form | `DataCitationEditForm` (~8 fields), opened from Add/Edit | FORM-data-citation-edit-form |
| List / get a data citation | `GET …/dataCitations`, `GET …/dataCitations/{id}` | API-data-citation-get-many, API-data-citation-get |
| Add / edit / delete a data citation | `POST …/dataCitations`, `PUT …/dataCitations/{id}`, `DELETE …/dataCitations/{id}` | API-data-citation-add, API-data-citation-edit, API-data-citation-delete |
| Reorder data citations | `PUT …/dataCitations/order` | API-data-citation-save-order |
| Data citation schema | `lib/pkp/schemas/dataCitation.json` (11 props; PID validation; `publicationId` write-disabled) | SCHEMA-data-citation |
| Storage | `data_citations` (publication_id + seq) + `data_citation_settings` (localized/structured values incl. authors/identifier/…) | DB-data_citations, DB-data_citation_settings |
| Locale keys | `submission.dataCitations.*` (20 keys: labels, relationship types, modal titles, validation) | LOC-submission-submission-dataCitations |

Route/role gates: the data-citation routes require an authenticated context user in
Manager|SiteAdmin|SubEditor|Assistant|Author with `ContextAccessPolicy` +
`PublicationAccessPolicy` (read) / `PublicationWritePolicy` (write) — i.e. submission access
**and** the `canEditPublication` published-lock are both enforced (Rule 10). The
`_components/dataAvailability` form fetch rides the submission controller's read gate.

## Reference — code anchors

- Statement form: `lib/pkp/classes/components/forms/publication/PKPDataAvailabilityForm.php`
  (`__construct()` — field gated on `$dataAvailabilitySetting`, `isRequired` param); served by
  `lib/pkp/api/v1/submissions/PKPSubmissionController.php` `getPublicationDataAvailabilityForm()`
  (route `_components/dataAvailability`; `isRequired` omitted → never required here). Wizard
  counterpart `PKPSubmissionHandler::getEditorsStep()` (passes require-mode as `isRequired`).
- Data-citation manager (Vue): `lib/ui-library/src/managers/DataCitationManager/` —
  `DataCitationManager.vue`, `dataCitationManagerStore.js` (`useOrdering`, action wrappers — no
  `canEditPublication`), `useDataCitationManagerActions.js` (Add/Edit side-modal, Delete dialog),
  `useDataCitationManagerConfig.js` (columns, top items, row actions), `DataCitationManagerCellActions.vue`,
  `modals/DataCitationEditModal.vue`; registered in `WorkflowPageOJS.vue`; nav/config in
  `useWorkflowNavigationConfigOJS.js` (`supportsDataCitations || supportsDataAvailability` →
  `dataAvailabilityAndCitation` item) and `workflowConfigEditorialOJS.js` /
  `workflowConfigAuthorOJS.js` (`dataAvailabilityAndCitation.getPrimaryItems`; editorial gates the
  manager on `supportsDataCitations`, author does not); page-init in `PKPDashboardHandler.php`
  (`supportsDataCitations`/`supportsDataAvailability`, `componentForms.dataCitationEditForm`).
- Data-citation API: `lib/pkp/api/v1/dataCitations/PKPDataCitationController.php`
  (`getGroupRoutes()`, `authorize()` — the read/write policies, `get/getMany/add/edit/delete/saveOrder`,
  publication-id ownership guards, `getWriteDisabledErrors()`).
- Entity: `lib/pkp/classes/dataCitation/DataCitation.php` (Eloquent + `ModelWithSettings`;
  `boot()` identifier normalisation via `pid/PidResolver.php`), `Repository.php` (`validate()` —
  required props + per-type identifier check), `maps/Schema.php` (schema map / summary),
  schema `lib/pkp/schemas/dataCitation.json`.
- Edit form: `lib/pkp/classes/components/forms/dataCitation/DataCitationEditForm.php` (8 fields,
  relationship/identifier type option lists).
- Publication hydration + versioning: `lib/pkp/classes/publication/DAO.php`
  `setDataCitations()`/`deleteDataCitations()`; `publication/Repository.php` `version()`
  (copies data-citation rows); publication schema `dataCitations` (readOnly array) + `dataAvailability`.
- Storage/migration: `lib/pkp/classes/migration/install/MetadataMigration.php` (`data_citations`
  + `data_citation_settings`); upgrade `lib/pkp/classes/migration/upgrade/v3_6_0/I6278_DataCitations.php`.
- Reader (pointer): `templates/frontend/objects/article_details.tpl` (`dataAvailability` section;
  no data-citation rendering — Rule 9).
