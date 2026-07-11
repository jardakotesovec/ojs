---
name: submission-wizard-metadata
scope: The journal decides which descriptive metadata to collect and whether authors must supply it; authors provide it in the wizard's For the Editors step
shared: pkp-lib
status: verified
atlas-claims:
  - FORM-pkp-metadata-settings-form
  - FORM-metadata-settings-form
  - FORM-for-the-editors
  - FORM-pkp-data-availability-form
  - API-vocab-get-many
  - DB-controlled_vocabs
  - DB-controlled_vocab_entries
  - DB-controlled_vocab_entry_settings
  - LOC-submission-metadata-property
---

# Submission metadata: the "For the Editors" step and its configuration

## Purpose

Journals differ in how much descriptive metadata they want with a manuscript —
subjects, disciplines, funding, coverage, a data availability statement, and so on.
This feature is the dial: on **Settings → Workflow → Submission → Metadata** a Journal
Manager decides, per metadata type, whether it is collected at all, and if so whether
authors are *asked* for it during submission, *required* to provide it before the
journal accepts the submission, or whether it stays a workflow-only field that never
appears in the wizard. Whatever is requested or required from authors surfaces as the
wizard's **For the Editors** step (a few types surface on the Details step instead —
the placement map is in Fields & validation); everything enabled in any mode also
appears on the submission's **Metadata** page in the editorial workflow (with one
exception: the Data Availability Statement and Data Citations live under the
workflow's **Data** entry instead — rule 7), where anyone
with editing access to the submission's publication (the exact roles are the
publication-metadata spec's) can fill or fix it at any time. The list-style fields (subjects,
disciplines, supporting agencies — and keywords, their Details-step sibling) share one
type-ahead behavior: as the user types, the journal suggests terms already used on its
other submissions, while still accepting brand-new terms — so each journal grows its
own vocabulary over time.

## Actors & permissions

Configuration is a settings-page job; filling the fields simply follows wizard and
workflow access, which are owned by neighbouring specs — the rows below only state
where this feature adds or narrows something. Baselines: **Site Administrators** hold
manager powers on journals they administer; **anonymous users** have no access
anywhere here.

| Action | Who may — and when |
|--------|--------------------|
| **Configure the metadata settings** (the per-type collect/request/require dial, plus the competing-interests, categories, publisher-ID and article-number switches) | • Journal Managers — any time<br>• Site Administrators <sup>a</sup> |
| **Fill the For the Editors fields during submission** | • Anyone who can open that submission's wizard (see the wizard spec's access table) — the fields carry no extra gate of their own <sup>b</sup> |
| **Edit the same metadata after submission** (the workflow's Metadata page) | • Journal Managers, Section Editors and Assistants — per their workflow access to the submission<br>• Authors — only while their role's metadata-edit permission allows it<br>• The who-may detail is owned by the publication-metadata spec; this spec only defines *which fields* the page offers (rule 7) <sup>c</sup> |
| **Receive type-ahead term suggestions** | • Journal Managers, Section Editors, Assistants, Authors and Site Administrators — anyone typing in a vocabulary field<br>• Reviewers and Readers — never: no screen shown to them contains these fields <sup>d</sup> |

<sup>a</sup> SettingsHandler::__construct() addRoleAssignment (MANAGER + SITE_ADMIN for 'settings'); ManagementHandler::workflow() (mounts APP MetadataSettingsForm); live-probed 2026-07-11 (as a Journal Manager) ·
<sup>b</sup> PKPSubmissionHandler::getEditorsStep() (forms mounted for every wizard visitor; saving rides the wizard's publication autosave); live-probed 2026-07-11 ·
<sup>c</sup> useWorkflowNavigationConfigOJS.js getPublicationItemsEditorial()/getPublicationItemsAuthor() ('metadata' item, both variants); PKPSubmissionController::getPublicationMetadataForm(); live-probed 2026-07-11 (an Author on their own submitted submission sees the page and can type into it, but Save stays disabled and nothing persists; an editor's Save works); adversarially re-probed 2026-07-11 — a direct save attempt through the service interface as the author is denied server-side (401) and the value is unchanged: the denial is not just a disabled button ·
<sup>d</sup> PKPVocabController::getRouteGroupMiddleware() (roleAuthorizer: MANAGER, SITE_ADMIN, SUB_EDITOR, ASSISTANT, AUTHOR — the suggestion endpoint additionally refuses Reviewer/Reader credentials at the service level; not observable through any screen, since no reviewer- or reader-facing page contains a vocabulary field)

## Fields & validation

**The settings page** (Settings → Workflow → Submission tab → Metadata side-tab).
Every metadata type is the same control pattern: an "Enable … metadata" checkbox;
ticking it reveals three radio choices — *"Do not request … from the author during
submission."*, *"Ask the author to suggest … during submission."*, and *"Require the
author to suggest … before accepting their submission."*. The verb-phrase in the
middle varies per type — Subjects says "provide subjects", Coverage "suggest
coverage metadata", Keywords "suggest keywords", References "provide references",
Data Citations "data citation metadata" — expect the same three-radio pattern,
differently worded, on the rest. Mind the two-level control: "Do not request…" still
collects the field — it appears for editors on the workflow Metadata page — and only
the unticked checkbox truly switches a type off (which also removes the radios). A
freshly ticked checkbox starts on the "Do not request…" choice, so nothing is asked
of authors until the manager explicitly picks one of the other two. The table maps each
setting to where its author-facing field lives; types marked *elsewhere* are
configured here but their field belongs to another spec: <sup>e</sup>

| Setting (UI label) | Author-facing field appears | Notes |
|--------------------|-----------------------------|-------|
| **Plain Language Summary** | Details step (elsewhere: wizard spec) | Same three-mode dial <sup>f</sup> |
| **Keywords** | Details step (elsewhere: wizard spec; the field's type-ahead behavior is rule 4 here) | On for new journals by default ("ask") <sup>f</sup> |
| **Subjects**, **Disciplines**, **Supporting Agencies** | For the Editors step | Type-ahead term lists (rule 4) <sup>e</sup> |
| **Coverage**, **Rights**, **Source**, **Type** | For the Editors step | One-line text fields <sup>e</sup> |
| **Competing Interests** | Contributor entry (elsewhere: contributors) | Single checkbox: "Require submitting Authors to file a Competing Interest (CI) statement with their submission." <sup>g</sup> |
| **References** | Details step (elsewhere: publication-metadata-references) | On for new journals by default ("ask"); enabling reveals a second checkbox, "Enable references structuring and metadata lookup" <sup>f</sup> |
| **Funding Statement** | For the Editors step | Rich text <sup>e</sup> |
| **Data Availability Statement** | For the Editors step | Rich text <sup>e</sup> |
| **Data Citations** | Details step (elsewhere: data-availability-citations) | ⚠ its "require" mode is not enforced at submit time (rule 6) <sup>e</sup> |
| **Categories** | For the Editors step | Yes/no radio: "Yes, add a categories field to the submission wizard." / "No, do not show authors this field." <sup>h</sup> |
| **Publisher ID** | Never in the wizard — workflow Metadata page only | Four checkboxes choosing which objects may carry one (articles, galleys, issues, issue galleys); only the articles tick affects this feature's form <sup>i</sup> |
| **Article Number** | Never in the wizard — workflow Metadata page only | Single enable checkbox <sup>i</sup> |

**The For the Editors step** (wizard step "For the Editors"). Only fields whose
setting is "ask" or "require" appear; each shows its explanation as visible text under
the label (the workflow's Metadata page shows the same texts as hover tips instead).
All fields below except Categories accept a value per submission language:

| Field (UI label) | Required? | Rules |
|------------------|-----------|-------|
| **Subjects** / **Disciplines** / **Supporting Agencies** | In "require" mode, in the submission language | Type-ahead term list (rule 4): click a suggested term, or type a new one and press Enter; each term becomes a removable chip <sup>j</sup> |
| **Coverage** / **Rights** / **Source** / **Type** | In "require" mode, in the submission language | One line of plain text per language <sup>j</sup> |
| **Funding Statement** | In "require" mode, in the submission language | Rich text per language <sup>j</sup> |
| **Data Availability Statement** | In "require" mode, in the submission language | Rich text per language <sup>k</sup> |
| **Categories** | Never | Pick from the journal's category tree via a chooser ("Select Categories"); shown only when the journal turned the setting on *and* has at least one category (rule 8) <sup>h</sup> |

The "Required?" column never blocks typing or moving between steps: the field is
flagged with the required marker, and an empty value surfaces as an error on the
Review step only — and only for the submission language (rule 6). The step always
ends with the "Comments for the Editor" box, which belongs to the wizard spec.

<sup>e</sup> PKPMetadataSettingsForm::__construct() (FieldMetadataSetting per type; options/submissionOptions labels manager.setup.metadata.*.enable/noRequest/request/require); FieldMetadataSetting.vue (checkbox reveals radios; untick stores the disabled value; newly ticked defaults to the enabled-only value); live-probed 2026-07-11 (checkbox-reveals-radios pattern, fresh-tick default, exact radio wordings) ·
<sup>f</sup> schemas/context.json (`in:0,enable,request,require` validation; `keywords` + `citations` default `request`); PKPMetadataSettingsForm::__construct() 'citationsMetadataLookup' (`showWhen: citations`); live-probed 2026-07-11 (fresh journal: only Keywords and References pre-enabled, both on "ask"; the lookup checkbox appears only while References is ticked) ·
<sup>g</sup> PKPMetadataSettingsForm::__construct() 'requireAuthorCompetingInterests'; ContributorForm.php competingInterests field; live-probed 2026-07-11 (contributor form gains a required "Competing Interests" rich-text field when on) ·
<sup>h</sup> PKPMetadataSettingsForm::__construct() 'submitWithCategories'; ForTheEditors::addCategoryField() (setting + non-empty category list guard; FieldAutosuggestPreset with the category-tree chooser; description swaps to a circular-reference warning when some categories can't render a breadcrumb); live-probed 2026-07-11 ("Select Categories" chooser tree, full-path chips, field absent when the setting is off) ·
<sup>i</sup> APP MetadataSettingsForm::__construct() ('enablePublisherId' array, 'enableArticleNumber'); PKPMetadataForm::enabled() ('pub-id::publisher-id' keyed on the 'publication' tick; 'articleNumber'); ForTheEditors::enabled() (both always false in the wizard — their settings never hold the ask/require values); live-probed 2026-07-11 (both render on the workflow Metadata page when enabled; a whole-page scan of an open wizard with both on finds neither) ·
<sup>j</sup> PKPMetadataForm::__construct() (field set + labels); ForTheEditors::__construct() (removes keywords; tooltips → descriptions; required flags from the per-type setting via setRequiredMetadata(), 'supportingAgencies' mapped to the 'agencies' setting); live-probed 2026-07-11 (field placement, visible descriptions, asterisk + screen-reader "Required" marker — same as Title/Abstract) ·
<sup>k</sup> PKPDataAvailabilityForm::__construct() (single rich-text field; required flag passed only by the wizard, PKPSubmissionHandler::getEditorsStep()); live-probed 2026-07-11 (multilingual rich text on the For the Editors step; "Required" marker only in require mode)

## Rules & state

**The four modes**
1. Each metadata type is always in exactly one of four modes, and the mode decides
   every surface at once: <sup>a</sup>

   | Mode (as the settings page shows it) | Wizard | Workflow Metadata page | Blocks submit when empty |
   |--------------------------------------|--------|------------------------|--------------------------|
   | Checkbox off (disabled) | absent | absent | no |
   | "Do not request … during submission" | absent | shown | no |
   | "Ask the author to suggest …" | shown | shown | no |
   | "Require the author to suggest …" | shown, marked required | shown | yes |

   The last column is scoped by rule 6: an empty "require"-mode field blocks submit
   only when its submission-language value is missing.

2. Turning a type off hides its fields everywhere but deletes nothing: values already
   entered stay stored with the submission and reappear if the type is re-enabled.
   Mode changes take effect on the next page load — wizards already open keep the
   fields they were built with until reloaded, though anything typed into such a
   leftover field is discarded rather than saved — to see the discard, reload the
   wizard: the stale entry is gone, and it never appears on the workflow Metadata
   page either. <sup>b</sup>

**Step composition**
3. The For the Editors step assembles top-down: the metadata form section (present
   whenever it has any field to show — a metadata type on "ask" or "require", or the
   Categories field; so with every metadata type disabled but the categories question
   on "Yes…" — and at least one category defined — the section still renders,
   containing only Categories), then the Data Availability Statement (own section,
   only in ask/require mode), then always Comments for the Editor. With nothing
   requested and categories off the step still exists, reduced to the comments box.
   The step heading and the step's introductory text — "When entering metadata,
   provide entries that you think would be most helpful to the person managing your
   submission. This information can be changed before publication." — render once,
   above the first section. <sup>c</sup>

**The vocabulary fields**
4. Subjects, Disciplines and Supporting Agencies (and Keywords on the Details step)
   are term lists with type-ahead: suggestions appear only once the author has typed
   at least one character — focusing the empty field opens nothing, and clearing the
   input closes the list again. The suggestions are terms already used on this
   journal's submissions for that same vocabulary and language — matching anywhere
   in the term, ignoring case, with identical stored terms collapsed into
   one suggestion. Clicking a suggestion adds the term as a chip with a remove
   control; typing a term and pressing Enter adds it the same way — free-typed terms
   are always accepted (the vocabularies are open, not closed lists). A term the author has already chosen is
   still offered again, and re-selecting it adds a second, identical chip — nothing
   guards against duplicates in the selection. Terms are stored per language with
   the submission itself; the suggestion pool is simply every term saved on any
   submission of the journal, so suggestions grow as the journal is used. ⚠ As
   built, the journal scoping of that pool is broken — on a multi-journal site one
   journal's terms are offered on every journal while all the others get no
   suggestions at all, not even their own; single-journal sites are unaffected
   (Known deviations). <sup>d</sup>
5. A vocabulary field's suggestions follow the input being typed in: each language's
   input offers only terms already saved in that same language, so typing in the
   second-language input never brings up first-language terms. <sup>e</sup>

**Multilingual entry and submit-time enforcement**
6. Every For the Editors field except Categories takes one value per submission
   language: a button at the top of the form, named for the other language (e.g.
   "French (Canada)"), expands each multilingual field in place with a second input
   labelled for that language, and each such field carries its own "N/2 languages
   completed" counter that ticks up as values are entered. "Require" is enforced in
   the **submission language only**: completing the submission checks each required
   type for a value in that language, and a miss appears on the Review step as
   "This field is required." on that language's For the Editors panel, under a
   warning that problems must be fixed before submitting, with the Submit button
   disabled until fixed; other languages may stay empty. Two exceptions: References in require mode
   checks the references text instead, and ⚠ Data Citations' require mode never
   actually blocks anything — the Review step shows "Data citations are required."
   on the Details panel, yet no problems warning appears and the submission
   completes anyway (Known deviations). <sup>f</sup>
7. **The workflow Metadata page.** On the submission's workflow page, the left-hand
   navigation shows a "Publication" group under each version; its "Metadata" entry
   opens this page (authors see a reduced entry list there — Title & Abstract,
   Contributors, Metadata, Galleys, Media). The page carries every type that is
   enabled at all — including
   keywords, and including Publisher ID and Article Number when their switches are on
   — regardless of whether authors were asked for it. Requirements do not follow: the
   workflow page never marks these fields required and accepts clearing a
   "require"-mode field after submission. The Data Availability Statement is not on
   this page — it sits with data citations on the same navigation's "Data" entry
   (for editors it sits between "References" and "JATS XML"), which appears once
   data availability or data citations is enabled in any mode (that
   page's editing rules are the data-availability-citations spec's). The Metadata
   entry itself stays visible even when every type it could carry is disabled;
   opening it then shows the message "No metadata fields are currently enabled."
   instead of a form — unlike the References and Data entries, which disappear with
   their settings (Known deviations / Open questions). <sup>g</sup>

**Categories**
8. The Categories field appears only when the journal both switched it on and has at
   least one category; authors pick any number via the "Select Categories" button,
   which opens a chooser listing the category tree with children indented under
   their parents. Each saved choice then shows as a removable chip carrying the
   category's full path (parent > child > grandchild), and the Review step lists the
   same full paths. One code-derived edge cannot be staged from the journal's
   screens: if the stored category tree ever contained a nesting loop (a category
   that is its own ancestor), a warning would replace the field's description and
   the affected categories would be left out — the category management screens offer
   no way to build such a loop, so this cannot be walked in the UI. The category
   list — and assigning categories editorially — belongs to the
   categories spec. <sup>h</sup>

**Review step**
9. The wizard's Review step shows one "For the Editors" panel per submission
   language (the language named in parentheses when there is more than one). Each
   panel lists only the ask/require fields, each with its entered value or "None
   provided"; chosen categories (or "None selected") and the Comments for the Editor
   box appear on the submission-language panel only. <sup>i</sup>

<sup>a</sup> Context::METADATA_DISABLE/ENABLE/REQUEST/REQUIRE (Context.php); ForTheEditors::enabled() (wizard: request/require); PKPMetadataForm::enabled() (workflow: any non-disabled); ForTheEditors::setRequiredMetadata() + Context::getRequiredMetadata() (require); live-probed 2026-07-11 (all four modes exercised across wizard and workflow) ·
<sup>b</sup> values live in publication data / controlled-vocab rows independent of the context setting (publication DAO setControlledVocab()/saveControlledVocab()); forms are built per page request (PKPSubmissionHandler::showWizard()); live-probed 2026-07-11 (a stored value survives a disable → re-enable round-trip; an open wizard keeps the field until reload; the stale unsaved entry is not kept) ·
<sup>c</sup> PKPSubmissionHandler::getEditorsStep() (metadata section only when `count($metadataForm->fields)` — the categories field added by ForTheEditors::addCategoryField() counts toward it, so categories alone keeps the section); data availability in:[REQUEST,REQUIRE]; comments always; name/description on the first section only; live-probed 2026-07-11 (all types off: the step shows only the comments box, its intro text still above it; no empty section header) ·
<sup>d</sup> FieldControlledVocab.vue (allowCustom default true; selectSuggestion() free-text accept; 250ms debounce); FieldBaseAutosuggest.vue (chips, deselect); PKPVocabController::getMany() (per-symbolic + term partial match, ILIKE/LIKE via ControlledVocabEntryMatch::PARTIAL; dedupe by identifier+source+name); ⚠ ControlledVocab::scopeWithContextId() — the journal filter's inner query is uncorrelated to the outer vocab row (arbitrary `LIMIT 1` pair decides for ALL rows), so the endpoint returns every journal's terms or none; Repo::controlledVocab()->insertBySymbolic() (terms saved per publication, delete-and-recreate); live-probed 2026-07-11 (substring + case-insensitive match, free-text chips, already-selected terms re-offered and duplicate chips created on re-select; cross-journal leak reproduced 3/3 in both directions on a two-journal site). Empty-focus claim REFUTED live 2026-07-11: no suggestions until a character is typed, clearing the input closes the list, and the field never issues the empty-query request — though PKPVocabController::getMany() would return every term for an empty query if called ·
<sup>e</sup> PKPVocabController::getMany() (suggestions are fetched with the locale of the input being edited; the locale param must be one of the journal's submission-metadata languages, plus that submission's publication languages when a submission id is passed — a service-side restriction with no UI surface, since the form only offers inputs for those languages) ·
<sup>f</sup> PKP\submission\Repository::validateSubmit() (required-metadata loop: multilingual props checked in the submission locale only; 'citations'→'citationsRaw', 'agencies'→'supportingAgencies'; ⚠ non-multilingual branch casts the hydrated data-citation array to string — "Array" is never empty, so 'dataCitations' require passes); Context::getRequiredMetadata() (list; plain-language summary handled separately, wizard spec); SubmissionWizardPage.vue validate() (the Review-step display is a client-side dry-run of the same validateSubmit() check, which runs again server-side on the completing request — not separately observable from the UI, where Submit stays disabled while the Review step reports problems); live-probed 2026-07-11 (English-only fill submits on an English submission; empty require-mode Subjects/Data Availability block with banner + disabled Submit; empty require-mode Data Citations shows only the item message and completes); adversarially re-verified 2026-07-11 on a French-language submission (an English-only fill still blocks; the French fill clears the error) ·
<sup>g</sup> PKPMetadataForm::__construct() (workflow field set incl. keywords, publisher-id, article number; no required flags); PKPSubmissionController::getPublicationDataAvailabilityForm() (workflow variant never passes the required flag); useWorkflowNavigationConfigOJS.js ('metadata' pushed unconditionally; 'dataAvailabilityAndCitation' behind supportsDataCitations/supportsDataAvailability); live-probed 2026-07-11 (enable-mode Type, Keywords, Publisher ID and Article Number all on the workflow Metadata page; explanations as tooltips there, not visible text; no required markers; clearing a require-mode field saves; all-off empty state "No metadata fields are currently enabled.") ·
<sup>h</sup> ForTheEditors::addCategoryField() (guard, breadcrumb options, vocabulary chooser, circular-reference description variant; ForTheEditors::MAX_CATEGORY_LIST_SIZE is defined but never used — vestigial); live-probed 2026-07-11 (indented checkbox tree in the chooser, full-path chips after save, field gone when the setting is off) ·
<sup>i</sup> templates/submission/review-editors.tpl (per-locale loop; request/require guards per field; categories + comments-for-the-editor only when the panel locale is the submission locale; "None provided"/"None selected" fallbacks via review-publication-field.tpl); live-probed 2026-07-11 (two-language review: one For the Editors panel per language, Categories + Comments on the submission-language panel only; Keywords and References render on the Details panels); adversarially re-verified 2026-07-11 on a French-language submission — Categories + Comments rendered on the French panel, settling that the submission language (not the journal's primary or UI language) governs placement; the code-anchor claim is now live-confirmed

## Side effects

None of its own: saving the settings or the metadata fields sends no email, raises no
notification and queues no job. Metadata entered in the wizard is saved by the
wizard's autosave (wizard spec); edits made later from the workflow Metadata page are
recorded in the submission's activity log as metadata updates, which — like the whole
post-submission editing surface — belongs to the publication-metadata spec.

## Settings that modify behavior

This feature *is* a settings page; the dials and their effects are rules 1–3 and 7.
What reaches beyond this feature:

- **Competing Interests** (this page) adds a required competing-interests declaration
  to contributor entry — enforced in the contributors feature. <sup>a</sup>
- **References** and its **metadata lookup** sub-toggle drive the Details-step
  references box and the structured-references tooling
  (publication-metadata-references). <sup>a</sup>
- **Data Citations** drives the Details-step data-citations panel and the workflow
  "Data" entry (data-availability-citations); its require mode is defective (rule 6
  ⚠). <sup>a</sup>
- **Publisher ID**'s galley/issue legs enable publisher identifiers on galleys and
  issues (identifiers/issues features); only its articles leg acts here
  (rule 7). <sup>a</sup>
- **Website → Setup → Languages**: which languages a metadata value can be entered
  in follows the journal's submission-metadata languages (languages-locales
  feature). <sup>b</sup>
- No server configuration file variables alter these rules.

<sup>a</sup> context settings `requireAuthorCompetingInterests`, `citations`, `citationsMetadataLookup`, `dataCitations`, `enablePublisherId`, `enableArticleNumber` (PKPMetadataSettingsForm / APP MetadataSettingsForm) ·
<sup>b</sup> Context::getSupportedSubmissionMetadataLocales(); PKPSubmissionHandler::showWizard() ($supportedLocales incl. publication languages)

## Cross-feature interactions

- **submission-wizard** — owns the wizard shell, the Review-step mechanics, autosave,
  and the Details step's layout (where the Keywords and Plain Language Summary fields
  sit, plus the references/data-citations panels); this spec owns the settings
  semantics behind all of them and the For the Editors fields themselves.
- **publication-metadata-references** — owns the workflow Metadata page's editing
  rules and permissions and the references tooling; this spec defines which fields
  that page offers (rule 7) and the shared type-ahead vocabulary primitive's intake
  side (rule 4).
- **data-availability-citations** — owns data citations end-to-end and the workflow
  "Data" entry; the Data Availability *Statement* field and both types' collect/ask/
  require settings are specified here.
- **contributors** — owns the competing-interests field the CI switch turns on.
- **categories** — owns the category tree and editorial assignment; this spec owns
  the wizard's category picker.
- **journal-setup** — owns the journal-settings save pipeline these settings ride on.
- **languages-locales** — owns which languages exist; multilingual entry here follows
  them.

## Canonical scenarios

1. **Configuring the dial** — a Journal Manager opens Settings → Workflow, the
   Submission tab's "Metadata" entry. Each metadata type shows an "Enable … metadata"
   checkbox; ticking "Enable subject metadata" reveals three choices, preselected on
   "Do not request subjects from the author during submission." They pick "Require
   the author to provide subjects before accepting their submission.", tick Coverage
   with "Ask the author…", tick Type but leave "Do not request…", leave Rights
   unticked, and save; the page confirms the save. <sup>s1</sup>
2. **The wizard mirrors the configuration** — with the settings from scenario 1, an
   author starts a submission and opens the "For the Editors" step: Subjects appears
   first, marked required, with its explanation visible under the label; Coverage
   appears unmarked; Type and Rights are absent; the step ends with "Comments for
   the Editor" (with the Categories question on "Yes…", a Categories field sits just
   before it). When the manager instead unticks every type and data availability and
   sets Categories to "No…", the same step shows only the comments box — the
   introductory text ("When entering metadata, provide entries that you think would
   be most helpful to the person managing your submission…") still renders above
   it. <sup>s2</sup>
3. **Typing subjects with suggestions** — on a journal where another submission
   already carries the subject "Genetics", an author in "For the Editors" types
   "gen" in Subjects: a suggestion list opens offering "Genetics"; choosing it adds a
   removable chip. They then type "Genomic epidemiology" — a term the journal has
   never seen — and press Enter: it becomes a chip too. Typing "Genetics" once more
   re-offers it, and re-selecting adds a second, identical chip — nothing stops the
   duplicate. Removing a chip via its control deletes just that term. <sup>s3</sup>
4. **Required metadata blocks the submission** — with Subjects on "require", an
   author completes everything but leaves Subjects empty and opens the Review step:
   a warning appears — "There are one or more problems that need to be fixed before
   you can submit." — the "For the Editors" panel shows "This field is required.",
   and the Submit button is disabled. The panel's Edit button returns to the For
   the Editors step; after adding a subject there, the warning and error are gone
   and Submit is enabled — pressing it asks for confirmation before completing the
   submission. <sup>s4</sup>
5. **Workflow-only metadata** — with Type on "Do not request…" (enabled, not asked), an
   author's wizard never mentions Type; after submission a Section Editor opens the
   submission's workflow page and, in the left-hand navigation's "Publication" group
   under the version, opens the "Metadata" entry and finds Type —
   together with Keywords, Subjects and the other enabled types — fills it in and
   saves. Nothing there is marked required, even for "require"-mode types. <sup>s5</sup>
6. **Categories at submission** — a Journal Manager sets the Categories question to
   "Yes, add a categories field to the submission wizard." on a journal with a nested
   category tree: the author's "For the Editors" step gains a "Categories" field with
   a "Select Categories" button opening a chooser that lists the tree with child
   categories indented under their parents; ticking a child category and saving
   shows it as a removable chip with its full path (parent > child). The chosen
   categories are listed with the same full paths on the Review step's For the
   Editors panel; skipping the field shows "None selected" there. On a journal with
   the setting on but no categories defined, the field does not appear at all. <sup>s6</sup>
7. **Data availability statement, asked vs required** — with Data Availability
   Statement on "Ask…", the author's "For the Editors" step shows the rich-text
   "Data Availability Statement" section, and leaving it empty submits fine; switched
   to "Require…", the same empty field turns up as a required-field error on the
   Review step until a statement is written. After submission the statement is
   editable under the "Data" entry in the workflow page's left-hand "Publication"
   navigation (for editors it sits between "References" and "JATS XML"), not under
   "Metadata". <sup>s7</sup>
8. **Two languages, one requirement** — first the setup: on Settings → Website →
   Setup → Languages, a Journal Manager makes French (Canada) available for
   submissions (the language's submissions toggle), so the journal accepts
   submissions in English and French (Canada). An author starting a submission then
   answers the required "Submission Language" choice on the wizard's very first
   page — English / French (Canada) — and picks English. On "For the Editors", a
   "French (Canada)" button sits at the top of the form; clicking it expands each
   field in place with a second input labelled for French (Canada), and each field
   carries a "0/2 languages completed" counter that ticks up as values are entered.
   The Review step shows "For the Editors (English)" and "For the Editors (French
   (Canada))" panels. With Subjects required,
   filling only the English value satisfies the check — the French panel simply shows
   "None provided" — and the submission goes through. <sup>s8</sup>

<sup>s1</sup> live-probed 2026-07-11 (checkbox-reveals-radios, fresh-tick default "Do not request…", exact radio wordings) ·
<sup>s2</sup> live-probed 2026-07-11 (Subjects=require + Coverage=ask + Type=enable + Rights=off matrix; all-off step reduced to the comments box with its intro text) ·
<sup>s3</sup> Seed: any second submission in the same journal with the subject term saved; suggestions match case-insensitively anywhere in the term (PKPVocabController::getMany() PARTIAL/ILIKE); live-probed 2026-07-11 (suggestion pick, free-text chip, duplicate chip on re-select) ·
<sup>s4</sup> live-probed 2026-07-11 (banner and item error verbatim; Submit carries a real disabled state; confirmation dialog on submit) ·
<sup>s5</sup> Workflow field set incl. keywords: PKPMetadataForm::__construct(); no required flags on the workflow variant; live-probed 2026-07-11 ·
<sup>s6</sup> live-probed 2026-07-11 (indented checkbox tree in the chooser; full-path chip after save; field absent with the setting off) ·
<sup>s7</sup> Wizard-only required flag: PKPSubmissionHandler::getEditorsStep() vs PKPSubmissionController::getPublicationDataAvailabilityForm(); live-probed 2026-07-11 (ask: submits empty; require: warning + disabled Submit; statement edited under the Data entry) ·
<sup>s8</sup> Locale-scoped enforcement: PKP\submission\Repository::validateSubmit() multilingual branch (submission locale only); per-locale panels: review-editors.tpl; live-probed 2026-07-11 (locale-expansion button, per-field N/2 counters, English-only fill submits)

## Known deviations (as-built ≠ intent)

- ⚠ **Vocabulary suggestions are not journal-scoped** (rule 4; live-confirmed): on a
  site with more than one journal, one journal's terms are suggested on every other
  journal, while all the remaining journals get **no suggestions at all — not even
  terms saved on their own submissions**. Which journal "wins" is arbitrary, so a
  journal's keyword box can quietly expose another journal's vocabulary, and most
  journals lose the suggestion feature entirely. When checking this, treat the
  pass-condition as a pattern, not a fixed journal: exactly one journal's terms
  appear on every journal and all the others get no suggestions at all — do not
  expect any particular journal to be the winner. Single-journal installs are
  unaffected. Suspected intent: each journal suggests only its own terms. Proposed
  ledger row (see report). <sup>l</sup>
- ⚠ **"Require" Data Citations never blocks a submission** (rule 6; live-confirmed):
  with Data Citations set to require and none entered, the Review step shows the
  item-level message "Data citations are required." on the Details panel — but the
  problems warning never appears, the Submit button stays enabled, and the
  submission completes. Require silently behaves like ask, with a contradictory
  error message left on screen. Proposed ledger row. <sup>m</sup>
- **The workflow "Metadata" entry never hides** (rule 7; live-confirmed — known
  behavior, cosmetic at most): with every metadata type disabled, the entry still
  appears for editors and authors alike, opening a page that says only "No metadata
  fields are currently enabled." — a deliberate empty state with no fields and no
  Save button, unlike the References and Data entries, which disappear with their
  settings. Not a defect; whether it should hide is Open question 1. <sup>n</sup>
- **Vestigial constant**: ForTheEditors::MAX_CATEGORY_LIST_SIZE ("how many categories
  before the options field becomes autosuggest", 10) has no consumers — the category
  field is always the same chooser regardless of list size. Dead code, not
  user-facing.

<sup>l</sup> ControlledVocab::scopeWithContextId() — the journal filter's inner query is uncorrelated to the outer vocab row (an arbitrary `LIMIT 1` publication/vocab pair decides for ALL rows), so `GET /vocabs` returns every journal's matching terms or none; live-probed 2026-07-11 (two-journal site: a term seeded only on the second journal offered on the first, 3/3 trials; the second journal received zero suggestions including its own, 3/3) ·
<sup>m</sup> PKP\submission\Repository::validateSubmit() — the non-multilingual branch checks `empty((string)$publication->getData($metadata))`; the data-citations value is hydrated as an array and PHP stringifies any array — empty included — to "Array", never empty; live-probed 2026-07-11 (item message renders, no banner, Submit enabled, submission completes). The companion prediction that this cast family also floods the server log with "Array to string conversion" warnings was live-refuted the same day — a fully driven submit with terms present produced zero warnings ·
<sup>n</sup> useWorkflowNavigationConfigOJS.js ('metadata' pushed unconditionally, author and editorial variants); PKPMetadataForm::__construct() (zero fields when all types disabled); live-probed 2026-07-11 (empty-state line "No metadata fields are currently enabled."; References entry gone, Data entry absent)

## Open questions

1. The workflow "Metadata" entry stays visible when every metadata type is disabled,
   showing the deliberate empty state "No metadata fields are currently enabled."
   Should it hide instead (matching References/Data), or is the always-present
   page with its explanatory message the intended design?
2. Is "require" meant to bind only the submission wizard (as built — the workflow
   Metadata page accepts clearing a required field afterwards), or should editorial
   saves re-enforce it?
3. Is the suggestion pool meant to be strictly per-journal (Known deviations #1
   assumes yes)? A deliberate site-wide pool would make the broken scoping less
   alarming — but as built it is not even a reliable site-wide pool, since every
   journal except the arbitrary "winner" gets no suggestions at all (live-probed
   2026-07-11).
4. The settings radio "Do not request … during submission." doubles as the
   *enabled-editors-only* state, and unticking the checkbox is the true "off" — is
   the two-level control understood by managers, or worth a wording pass? (No code
   defect; UX question raised while specifying rule 1.)

---

<!-- REFERENCE MATERIAL — provenance and campaign bookkeeping, not product-owner
     narrative. The PO-facing "where do I find this" is in Purpose. -->

## Reference — entry points & surfaces

| Entry | Path | Atom |
|-------|------|------|
| Metadata settings tab | Settings → Workflow → Submission tab → "Metadata" side-tab (management/workflow.tpl tab id=metadata); form saves via PUT contexts/{contextId} (owned by journal-setup) | FORM-pkp-metadata-settings-form, FORM-metadata-settings-form |
| For the Editors step | `{journal}/submission?id=N` step "editors" — sections: metadata form, data availability form, comments (PKPSubmissionHandler::getEditorsStep()) | FORM-for-the-editors, FORM-pkp-data-availability-form |
| Review-step panel | wizard Review step, per-locale "For the Editors" panels (templates/submission/review-editors.tpl) | — |
| Vocab suggestions API | `GET /api/v1/vocabs?vocab=…&term=…&locale=…&submissionId=…` (PKPVocabController::getMany(); hooks API::vocabs::getMany / ::external for plugin vocabularies) | API-vocab-get-many |
| Workflow Metadata page | submission workflow → version → "Metadata" (component fetched from GET …/publications/{publicationId}/_components/metadata — the route atom stays with publication-metadata-references) | — |
| Workflow Data entry | submission workflow → version → "Data" (data availability + data citations; owned by data-availability-citations) | — |
| Term storage | controlled_vocabs / controlled_vocab_entries / controlled_vocab_entry_settings (per-publication vocab rows; also the suggestion source) | DB-controlled_vocabs, DB-controlled_vocab_entries, DB-controlled_vocab_entry_settings |
| Locale keys | `metadata.property.*` (85 keys, submission.po) — property display names/descriptions used by metadata surfaces | LOC-submission-metadata-property |

## Reference — code anchors

- lib/pkp/classes/components/forms/context/PKPMetadataSettingsForm.php +
  classes/components/forms/context/MetadataSettingsForm.php — the settings form (13
  FieldMetadataSetting dials + CI + lookup + categories; the OJS subclass adds only
  the publisher-id/article-number switches)
- lib/ui-library/src/components/Form/fields/FieldMetadataSetting.vue — the
  checkbox-reveals-radios control (disabled ↔ enable/request/require)
- lib/pkp/classes/components/forms/publication/PKPMetadataForm.php — workflow-side
  field set (enabled() = any non-disabled); classes/…/submission/ForTheEditors.php —
  wizard variant (enabled() = request/require; keywords removed; required flags;
  category field)
- lib/pkp/classes/components/forms/publication/PKPDataAvailabilityForm.php — the
  statement field (required only when the wizard passes it)
- lib/pkp/pages/submission/PKPSubmissionHandler.php getEditorsStep(), getDetailsStep(),
  getControlledVocabBaseUrl(); pages/submission/SubmissionHandler.php
  getForTheEditorsForm()
- lib/pkp/classes/context/Context.php — METADATA_* constants, getRequiredMetadata()
- lib/pkp/classes/submission/Repository.php validateSubmit() — submit-time
  enforcement (locale-scoped; the data-citations array-cast defect). Extension
  point: fires the `Submission::validateSubmit` hook, through which plugins can add
  further submit blockers
- lib/pkp/api/v1/vocabs/PKPVocabController.php + lib/pkp/classes/controlledVocab/
  {ControlledVocab,ControlledVocabEntry,ControlledVocabEntryMatch,Repository}.php —
  suggestions + term storage (scopeWithContextId ⚠)
- lib/ui-library/src/components/Form/fields/{FieldControlledVocab,FieldBaseAutosuggest}.vue
  — the type-ahead chips field
- lib/pkp/templates/submission/review-editors.tpl — Review-step panels
- lib/ui-library/src/pages/workflow/composables/useWorkflowNavigationConfig/
  useWorkflowNavigationConfigOJS.js — workflow "Metadata"/"Data" entries;
  lib/pkp/api/v1/submissions/PKPSubmissionController.php
  getPublicationMetadataForm()/getPublicationDataAvailabilityForm()
- schemas/context.json (OJS) — setting validation + defaults; lib/pkp/schemas/
  publication.json — the metadata properties (multilingual flags)
