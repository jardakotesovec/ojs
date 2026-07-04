---
name: submission-wizard-metadata
scope: The journal-configurable metadata questions an author answers at intake — Keywords (in the Details step) and the "For the Editors" set (Subjects, Disciplines, Supporting Agencies, Coverage, Type, Rights, Source, Funding Statement, Data Availability Statement) — each switchable per journal between don't-collect / collect-without-asking / request / require, with chip-style controlled-vocabulary entry and multilingual values, plus the Settings → Workflow → Metadata panel that configures it all
shared: pkp-lib
status: verified
e2e-plans: [submission-wizard-metadata.md]
atlas-claims:
  - FORM-for-the-editors
  - FORM-pkp-data-availability-form
  - FORM-pkp-metadata-settings-form
  - FORM-metadata-settings-form
  - API-vocab-get-many
  - DB-controlled_vocabs
  - DB-controlled_vocab_entries
  - DB-controlled_vocab_entry_settings
  - LOC-submission-metadata-property
---

# Submission wizard — metadata ("For the Editors" questions)

## Purpose

Journals decide which descriptive metadata they want from authors at submission time —
keywords, subjects, disciplines, funding, a data-availability statement and so on — and
how hard to ask: not at all, ask politely, or refuse the submission without it. A
journal manager sets this per field in **Settings → Workflow → Submission → Metadata**
(each field: don't collect / collect but don't ask the author / ask / require). The
author then meets exactly the asked-for fields inside the submission wizard: Keywords
in the **Details** step, everything else in the **For the Editors** step. Keyword-style
fields are entered as chips with type-ahead suggestions drawn from the journal's
controlled vocabulary; all fields accept a value per submission language. Required
fields are enforced on the wizard's Review step and at final submit. This spec owns the
fields, their three-mode configuration and the controlled-vocabulary entry primitive;
the wizard shell around them belongs to `submission-wizard`.

## Actors & permissions

Baselines: who can *open* the wizard at all (submitting author, managers/site admins,
assigned participants) is owned by `submission-wizard`; while a draft is in the wizard,
metadata editing is always permitted to anyone who can open it (`submission-wizard`
rule 2). "Settings access" below means a manager whose manager group carries the
settings permission — the default manager group does. <sup>a</sup>

| Action | Who may — and when |
|--------|--------------------|
| **Answer the metadata questions at intake** | • Anyone who can open the draft's wizard — the fields autosave with the rest of the step <sup>b</sup> |
| **Get type-ahead suggestions while typing chips** | • Wizard users holding any journal role except reviewer-only accounts (the suggestion service accepts author, assistant, sub-editor, manager, site admin — live-probed: all five answer 200; a reviewer-only account is refused with "The current role does not have access to this operation.") — free-text chips work for everyone regardless; ⚠ as-built the suggestions themselves are mis-scoped by journal (see Known deviations) <sup>c</sup> |
| **Configure what is collected (the Metadata settings panel)** | • Site admins — always (the settings policy names the site-admin group explicitly; live-probed with the seeded admin, who on a scratch journal also carries the auto-granted manager enrolment — pure-site-admin scope is the systemic edge, `docs/e2e/app-changes.md` §2 row 56)<br>• Managers with settings access — their journal (live-probed: the seeded manager reaches Settings → Workflow → Submission → Metadata)<br>• Everyone else — blocked with "The current role does not have access to this operation." (live-probed: author, section editor and assistant) <sup>d</sup> |
| **View/edit the same fields after submission** | • Editorial staff via the workflow's publication Metadata tab — owned by `publication-metadata-references` (pointer only) <sup>e</sup> |

<sup>a</sup> CanAccessSettingsPolicy::effect() (`permitSettings` on the manager group) ·
<sup>b</sup> PKPSubmissionHandler::getEditorsStep(), getDetailsStep(); the forms PUT the publication (metadata edit granted in-wizard per submission-wizard rule 2) ·
<sup>c</sup> PKPVocabController::getRouteGroupMiddleware() (role list), authorize() (ContextAccessPolicy); FieldControlledVocab.vue `allowCustom` default true; live probes 2026-07-02 (verifier: reviewer 401 `roleBasedAccessDenied`, author/assistant/sub-editor/site-admin 200) ·
<sup>d</sup> SettingsHandler::__construct() role assignment; ManagementHandler::authorize() (CanAccessSettingsPolicy); PKPContextController::edit() (the panel saves to the contexts API — manager/site admin); live probe 2026-07-02 ·
<sup>e</sup> PKPSubmissionController::getPublicationMetadataForm() (`_components/metadata`)

## Fields & validation

**What the author sees.** Only fields the journal set to *ask* or *require* appear in
the wizard; fields set to *collect but don't ask* exist only on the editorial side
(rule 2). One shared behaviour, stated once: every wizard field below is optional in
ask-mode and **required in require-mode** — the field is marked `* Required`, and
"required" means a value in the **submission language** (other languages stay
optional; live-probed: the French review panel shows no error while the English one
does). All fields are multilingual per the wizard's language pattern (the submission
language plus a labelled sub-field per other supported language — see
`submission-wizard`); field descriptions are shown under the label (the same texts the
editorial side gets as tooltips). <sup>a</sup>

| Field (UI label) | Where / control | Rules |
|------------------|-----------------|-------|
| **Keywords** | **Details step**, after Title; chip list | Type and press Enter to add a chip; each chip has a Remove button; type-ahead dropdown offers stored vocabulary terms plus the typed text itself (free text always accepted). Duplicates can be typed but are dropped on save (live-probed: one chip after reload) <sup>b</sup> |
| **Subjects** | For the Editors step, metadata form; chip list | Same chip behaviour as Keywords, own vocabulary |
| **Disciplines** | For the Editors, metadata form; chip list | Same chip behaviour, own vocabulary |
| **Supporting Agencies** | For the Editors, metadata form; chip list | Same chip behaviour, own vocabulary |
| **Coverage** | For the Editors, metadata form; one-line text | Plain text (spatial/temporal/jurisdiction coverage) |
| **Type** | For the Editors, metadata form; one-line text | Plain text; description links the Dublin Core types list (live-probed) |
| **Rights** | For the Editors, metadata form; one-line text | Plain text (live-probed at require: renders marked `* Required` and blocks Review/submit) |
| **Source** | For the Editors, metadata form; one-line text | Plain text (live-probed at ask: renders unmarked) |
| **Funding Statement** | For the Editors, metadata form; rich text | Small rich-text editor (bold/italic/super/subscript/link) (live-probed at ask: renders unmarked, as rich text) |
| **Data Availability Statement** | For the Editors, its own section below the metadata form; rich text | Same rich-text editor; appears when the statement is asked/required (live-probed: `* Required` marker at require — the blocking behaviour is rule 3's; its reader-facing display and the Data Citations manager belong to `data-availability-citations`) <sup>c</sup> |
| **Categories** | For the Editors, metadata form (last); preset chip list + **Select Categories** button | Present when the journal asks authors to pick categories and categories exist; the button opens a checkbox tree of the journal's categories, chips show breadcrumbs ("Applied Science > Computer Science", live-probed); never required; not multilingual. Category management is owned by `categories` <sup>d</sup> |

<sup>a</sup> ForTheEditors::enabled() (request/require only), setRequiredMetadata(), changeTooltipsToDescriptions(); Details::__construct() (`isRequired` on keywords); Repository::validateSubmit() (submission-locale check); live probes 2026-07-02 ·
<sup>b</sup> PKPMetadataForm::__construct() (FieldControlledVocab per vocab field, FieldText/FieldRichTextarea for the rest); FieldControlledVocab.vue selectSuggestion() (free text); ControlledVocab Repository::insertBySymbolic() `unique()` ·
<sup>c</sup> PKPSubmissionHandler::getEditorsStep() (`dataAvailability` section when request/require); PKPDataAvailabilityForm::__construct() ·
<sup>d</sup> ForTheEditors::addCategoryField() (`submitWithCategories`, breadcrumb options, vocabulary modal)

**What the manager sees** (the Metadata settings panel) is documented under Settings
that modify behavior — it is this feature's configuration surface.

## Rules & state

1. **Each metadata field has four modes**, stored per journal: *don't collect* /
   *collect but don't ask authors* / *ask during submission* / *require before
   accepting*. In the panel this renders as an "Enable … metadata" checkbox which,
   when ticked, reveals three radios ("Do not request … from the author during
   submission." / "Ask the author …" / "Require the author …"); ticking the box
   defaults to *do not request*, unticking returns the field to *don't collect*
   (live-probed). The thirteen three-mode fields are: plain language summary, keywords,
   subjects, disciplines, supporting agencies, coverage, rights, source, type,
   references, funding statement, data availability statement, data citations.
   <sup>a</sup>
2. **Wizard composition follows the mode**: a field appears in the wizard only in
   ask/require mode — *collect-but-don't-ask* keeps it off the wizard entirely
   (live-probed: Coverage on "do not request" is absent from the step) while it stays
   available on the editorial side, where any collecting mode shows the field
   (live-probed: collect-only Coverage and Type appear on the workflow's
   Publication → Metadata tab while absent from the wizard; the tab itself is owned by
   `publication-metadata-references`). Keywords render in the **Details**
   step; subjects → funding statement render in the **For the Editors** metadata form;
   the data availability statement is its own section under it; the References field
   driven by the *references* mode is in Details (owned by
   `publication-metadata-references`); plain language summary is in Details (owned by
   `publication-title-abstract-body`); the *data citations* mode likewise adds a Data
   Citations section in Details (owned by `data-availability-citations`). When no
   metadata form field is collected at
   intake, the metadata form is omitted and the For the Editors step shows only the
   Comments for the Editor box (live-probed). <sup>b</sup>
3. **Require-mode fields gate final submission**: the server refuses submit while any
   require-mode field is empty in the submission language. The Review step runs the
   same check and shows the problems banner, paints "This field is required." on the
   offending field's review row, and disables Submit; filling the field (a single chip
   suffices) and re-entering Review clears it (live-probed). Verified for the
   data availability statement too: at require, the server refuses with a
   `dataAvailability` required error in the submission language and the review row is
   painted (live-probed). Ask-mode fields never
   block — Submit stayed enabled with Type and the data statement empty (live-probed).
   The *references* requirement is checked against the References text; the review
   banner mechanics themselves belong to `submission-wizard` (rule 7 there).
   <sup>c</sup>
4. **Settings bind at page load and at every server check — not at draft creation**:
   the wizard's *composition* (which fields render, which review rows exist) is fixed
   when the page loads, but the require-check runs against current settings every
   time the Review step is entered and at submit — so a stale page picks up a
   mid-flight flip without a reload, just without anywhere to paint the new field.
   Live-probed both directions: flipping Disciplines to require while the author's
   Review page was open got the Submit click refused server-side (banner returns,
   Submit disables — though the stale page has no Disciplines row to paint the
   message on) and reloading revealed the new `* Required` field; flipping a field to
   require while the author sat on a valid Review page re-painted the banner as soon
   as they stepped out and back into Review — no reload — and flipping it back to
   *don't collect* cleared the banner and re-enabled Submit the same way. <sup>d</sup>
5. **Chips are a controlled vocabulary, per journal and per language**: each chip
   field (keywords/subjects/disciplines/agencies) saves its list as vocabulary
   entries attached to the publication — one ordered list per language, chip order
   preserved. Saving **replaces** the publication's previous list; duplicates within
   a language are dropped; a suggestion carrying an identifier but no source is
   discarded on save. <sup>e</sup>
6. **Type-ahead suggestions** query previously stored terms of the same vocabulary,
   in the language being typed, matching anywhere in the term (first letters
   suffice); the dropdown also always offers the raw typed text, so free-text entry
   never depends on the vocabulary (live-probed). ⚠ As-built the "previously stored
   terms of this journal" scope malfunctions — suggestions are empty on most journals
   and leak every journal's terms on one (see Known deviations). <sup>f</sup>
7. **Publisher ID and Article Number never appear in the wizard**, even though they
   sit on the same settings panel: they are editorial identifiers (workflow-tab
   only, owned by `publication-identifiers`), and the wizard's field lookup
   can never enable them at intake. <sup>g</sup>
8. **Review-step display**: the For the Editors review panel repeats per language
   ("For the Editors (English)" / "(French (Canada))") listing each asked/required
   field with its value or "None provided"; Categories and the cover note appear
   only on the submission-language panel (live-probed). <sup>h</sup>

<sup>a</sup> Context::METADATA_DISABLE/ENABLE/REQUEST/REQUIRE; PKPMetadataSettingsForm::__construct() (FieldMetadataSetting per field); FieldMetadataSetting.vue (`isEnabled` watch → `enabledOnlyValue`/`disabledValue`); live probe 2026-07-02 ·
<sup>b</sup> ForTheEditors::enabled() (REQUEST/REQUIRE only) vs PKPMetadataForm::enabled() (any truthy mode); ForTheEditors::__construct() (`removeField('keywords')`); Details::__construct(); PKPSubmissionHandler::getEditorsStep() (`count($metadataForm->fields)` gate, dataAvailability section), getDetailsStep() (dataCitations section); live probes 2026-07-02 (incl. verifier: workflow Metadata tab shows collect-only Coverage/Type) ·
<sup>c</sup> Repository::validateSubmit() (loop over Context::getRequiredMetadata(); `citations`→References text, `agencies`→Supporting Agencies; multilingual props checked in submission locale only); live probes 2026-07-02 (verifier: require-mode Rights + Data Availability refused as `rights`/`dataAvailability` required in the submission locale) ·
<sup>d</sup> PKPSubmissionHandler::getSteps() (step state built at page load); SubmissionWizardPage.vue validate() (`_validateOnly` fired on every entry to the Review step); Repository::validateSubmit() (reads current context settings); live probes 2026-07-02 ·
<sup>e</sup> ControlledVocab Repository::insertBySymbolic() (delete-first, seq = chip order, `unique()`, reject id-without-source); publication DAO settings mapping (keywords/subjects/disciplines/supportingAgencies → vocab symbolics) ·
<sup>f</sup> PKPVocabController::getMany() (partial match on `name`, per-locale, defined symbolics only); FieldControlledVocab.vue getSuggestions()/selectSuggestion(); live probes 2026-07-02 ·
<sup>g</sup> MetadataSettingsForm::__construct() (OJS `enablePublisherId`, `enableArticleNumber`); ForTheEditors::enabled() looks the modes up as context settings, which these are not — always excluded ·
<sup>h</sup> templates/submission/review-editors.tpl (per-locale foreach; request/require gate per field; categories/cover note in submission locale only); live probe 2026-07-02

## Side effects

Deliberately quiet — entering metadata at intake sends no emails or notifications and
writes no activity-log entries (the post-submission "metadata updated" log entry
belongs to `publication-metadata-references`):

- Wizard entries save through the step's autosave onto the draft's publication; chip
  lists rewrite the publication's vocabulary rows on every save (rule 5). Empty
  vocabulary lists still create their per-publication vocabulary containers.
  <sup>a</sup>
- Saving the settings panel writes the journal's settings and confirms with a "Saved"
  toast (live-probed); the change touches no existing drafts until they reload
  (rule 4).

<sup>a</sup> ControlledVocab Repository::build() (firstOr create); observed in `controlled_vocabs` during probes

## Settings that modify behavior

This feature carries its own settings surface: **Settings → Workflow → Submission →
Metadata** (panel shape live-probed 2026-07-02). Besides the thirteen three-mode fields
(rule 1), the panel holds:

- **Competing Interests** — "Require submitting Authors to file a Competing Interest
  (CI) statement with their submission." (its effect lives in the contributor form —
  `contributors`). <sup>a</sup>
- **References Metadata Lookup** — structuring/lookup toggle shown only while
  References is collected (`showWhen`); behaviour owned by
  `publication-metadata-references` / the citation pipeline.
- **Categories** — yes/no radio "Yes, add a categories field to the submission
  wizard." driving the wizard's Categories field (rule 2's picker; management owned
  by `categories`).
- **Publisher ID** (OJS-only) — four checkboxes enabling the ID on Publications /
  Galleys / Issues / Issue Galleys; **Article Number** (OJS-only) — single enable
  checkbox. Both editorial-side only (rule 7).

External settings that change this feature's behaviour:

- **Submission-language set** (Settings → Website → Languages): which languages the
  multilingual fields offer entries for, and which language the require-check applies
  to (the draft's submission language).
- **Journal's category tree** (`categories`): with categories enabled but none
  defined, the wizard field is omitted.

<sup>a</sup> PKPMetadataSettingsForm::__construct() (`requireAuthorCompetingInterests`, `citationsMetadataLookup` showWhen, `submitWithCategories`); MetadataSettingsForm::__construct() (OJS additions)

## Cross-feature interactions

- **submission-wizard** — owns the wizard shell this feature plugs into: step order,
  autosave, the multilingual form pattern, Review banner mechanics and Submit gating,
  the Comments for the Editor box on the same step. This spec owns *which* metadata
  fields exist there and *when they block*.
- **publication-metadata-references** — the same fields edited post-submission in the
  workflow's Metadata tab (any collecting mode shows them there), the References
  field content, and the "metadata updated" activity-log entry. The vocabulary chips
  primitive is defined here and reused there.
- **data-availability-citations** — the reader-facing Data Availability Statement
  display and the Data Citations manager; this spec owns only the intake question and
  its ask/require config (see Open questions on the form atom seam).
- **workflow-settings** — the rest of Settings → Workflow; the Metadata panel is
  carved out to this spec.
- **categories** — category definitions/nesting and the picker's deep rules; this
  spec owns only the field's presence at intake via the panel's Categories radio.
- **publication-title-abstract-body** — the Plain Language Summary field itself; its
  ask/require mode lives on this panel.
- **contributors** — the competing-interests statement required of contributors when
  the panel's CI toggle is on.
- **user-profile** — reviewer interests use the same controlled-vocabulary machinery
  with their own vocabulary and endpoint (`/vocabs/interests`); not claimed here.
- **review-anonymity** — hiding author-identifying metadata (e.g. funding, data
  statements) from reviewers is owned there.

## Canonical scenarios

1. **Author answers the For-the-Editors questions (chips + multilingual)** — on a
   scratch journal with Subjects required and Type asked: the author's For the
   Editors step shows Subjects marked `* Required` and Type unmarked; typing
   "case studies" + Enter makes a removable chip; switching the form's language
   toggle reveals "Subjects in French (Canada)" for separate French chips; values
   survive reload via autosave.
2. **Require blocks Submit, ask doesn't** — same journal: with Subjects empty, Review
   shows the problems banner, "This field is required." on the For the Editors
   (English) panel's Subjects row, and a disabled Submit — while empty Type and Data
   Availability Statement rows say "None provided" without errors; adding one
   Subjects chip and re-entering Review clears the banner and enables Submit.
3. **Keywords ride in the Details step** — with Keywords on ask (publicknowledge
   default): the Details step shows the Keywords chip field after Title, unmarked;
   flipping the journal to require marks it `* Required` and an empty submit attempt
   flags it on Review; "do not request" removes it from Details entirely.
4. **Manager reconfigures the panel and the wizard follows** — a manager opens
   Settings → Workflow → Submission → Metadata: ticking "Enable subject metadata"
   reveals the three radios defaulting to "Do not request…"; on "do not request" the
   field stays out of the wizard (collect-only); after unticking every metadata box
   the author's For the Editors step shows only Comments for the Editor — the
   metadata form vanishes.
5. **Mid-flight require-flip binds at submit time** — with the author parked on a
   fully valid Review page, the manager flips Disciplines to require: the author's
   Submit click is refused (banner re-appears, Submit disables), and reloading the
   wizard reveals the new required Disciplines field to fill.
6. **Data availability statement collected at intake** — with the statement on ask, a
   rich-text "Data Availability Statement" section appears in For the Editors below
   the metadata form; the entered statement persists and shows on the For the Editors
   review panel (its appearance on the published article belongs to
   `data-availability-citations`).
7. **Only managers configure the panel** — the author and a section editor requesting
   Settings → Workflow get "The current role does not have access to this
   operation."; the journal manager gets the panel and their save shows "Saved".

## Known deviations (as-built ≠ intent)

- ⚠ **Chip suggestions are mis-scoped by journal — empty almost everywhere,
  cross-journal leak on one journal** (docs/e2e/app-changes.md §2 row 62;
  live-probed both directions 2026-07-02): the suggestion query's journal filter
  (`ControlledVocab::scopeWithContextId()`) contains an uncorrelated subquery that
  always resolves to one arbitrary publication's journal (in practice the first
  journal in the database). A keyword stored on a scratch-journal submission is not
  suggested in that same journal's wizard (`/vocabs` returns `[]`), while
  `publicknowledge`'s wizard dropdown offers that other journal's term. Suspected
  intent: suggestions drawn from *this* journal's previously stored terms. Free-text
  entry is unaffected, so authors can always type their terms — the feature degrades
  silently rather than erroring. Re-verified at verification (2026-07-02): a fresh
  term stored on a scratch-journal draft returned `[]` from that journal's `/vocabs`
  and appeared in `publicknowledge`'s suggestions.

## Open questions

1. ~~**FORM-pkp-metadata-form dual listing**~~ **Resolved (2026-07-04):** the base
   `PKPMetadataForm` is instantiated *directly* by the workflow Metadata tab (no OJS
   override, no subclass), while this wizard step uses the `ForTheEditors` subclass — so
   `FORM-pkp-metadata-form` was handed to `publication-metadata-references` (Publication-tab
   use) and this spec keeps only `FORM-for-the-editors`. The base-class anchors on
   `PKPMetadataForm::__construct()` in Fields remain as provenance for the shared field set.
2. **FORM-pkp-data-availability-form seam — resolved (2026-07-04).** The same
   `PKPDataAvailabilityForm` class serves the wizard's intake section (this spec, marked
   required in require-mode) and the Publication → Data tab fetched via
   `_components/dataAvailability` (feature `data-availability-citations`, never required
   there). The split is confirmed: **this spec keeps the form atom**
   `FORM-pkp-data-availability-form` (shared class), and `data-availability-citations`
   references it and now **claims the publication-tab fetch endpoint**
   `API-submission-get-publication-data-availability-form` (previously unclaimed).
3. **FORM-metadata-settings / FORM-pkp-metadata-settings-form also appear in
   `workflow-settings`' FEATURE-MAP atom list**; claimed here because the map's entry
   for this feature says it "carries its own request/require config". The
   workflow-settings spec should reference, not re-claim.
4. **LOC-submission-metadata-property fit**: the 85 `metadata.property.*` keys
   actually label the legacy metadata-description framework whose live consumers are
   the Dublin Core OAI export and the articles report — not the wizard's field labels
   (those come from `common.*` / `submission.*` / `manager.setup.metadata.*`).
   Claimed per FEATURE-MAP; candidate to move to `oai-pmh` at a grooming pass.
5. **Stale-page require-flip UX** (rule 4): the refused Submit (or a Review re-entry)
   re-shows the generic "one or more problems" banner, but the stale page has no row
   for the newly required field, so nothing below the banner is flagged until reload.
   Acceptable edge, or worth a reload prompt?
6. Is the never-in-the-wizard outcome for Publisher ID / Article Number (rule 7)
   intended as designed? The wizard's mode lookup reads context settings named
   `pub-id::publisher-id`/`articleNumber`, which don't exist — the outcome (editorial
   identifiers stay editorial) looks right, but the mechanism is accidental-looking.

---

## Reference — entry points & surfaces

| Entry | Path | Atom |
|-------|------|------|
| For the Editors metadata form | wizard step 4 (`/{journal}/submission?id=N`), first section | FORM-for-the-editors (subclass of FORM-pkp-metadata-form; this spec claims only the subclass — the base is owned by publication-metadata-references) |
| Data availability intake section | wizard step 4, second section (when asked/required) | FORM-pkp-data-availability-form (seam — Open questions 2) |
| Details-step Keywords field | wizard step 2 | — (FORM-details owned by submission-wizard; the keywords field is added by Details::__construct()) |
| Metadata settings panel | Settings → Workflow → Submission → Metadata (`/{journal}/management/settings/workflow`) | FORM-pkp-metadata-settings-form, FORM-metadata-settings-form |
| Chip suggestion API | `GET api/v1/vocabs?vocab=…&term=…&locale=…[&submissionId=…]` | API-vocab-get-many |
| Vocabulary storage | `controlled_vocabs` / `controlled_vocab_entries` / `controlled_vocab_entry_settings` (per-publication lists; also the shared primitive behind reviewer interests) | DB-controlled_vocabs, DB-controlled_vocab_entries, DB-controlled_vocab_entry_settings |
| Locale keys | `metadata.property.*` (legacy metadata-description labels — Open questions 4) | LOC-submission-metadata-property |

## Reference — code anchors

- lib/pkp/classes/components/forms/submission/ForTheEditors.php (wizard metadata form: request/require filter, required markers, tooltip→description, categories field)
- lib/pkp/classes/components/forms/publication/PKPMetadataForm.php (base field set + vocab wiring), Details.php (keywords + plain-language summary in the Details step), PKPDataAvailabilityForm.php
- lib/pkp/classes/components/forms/context/PKPMetadataSettingsForm.php + classes/components/forms/context/MetadataSettingsForm.php (the settings panel; OJS publisher-id/article-number additions)
- lib/pkp/classes/context/Context.php (METADATA_* constants, getRequiredMetadata())
- lib/pkp/classes/submission/Repository.php validateSubmit() (require-mode enforcement at Review/submit)
- lib/pkp/pages/submission/PKPSubmissionHandler.php getDetailsStep()/getEditorsStep()/getControlledVocabBaseUrl(); pages/submission/SubmissionHandler.php getForTheEditorsForm()/getDetailsForm() (OJS)
- lib/pkp/classes/controlledVocab/ (ControlledVocab, ControlledVocabEntry, Repository: build/getBySymbolic/insertBySymbolic); lib/pkp/classes/publication/DAO.php (vocab props ↔ publication)
- lib/pkp/api/v1/vocabs/PKPVocabController.php (suggestion endpoint)
- lib/ui-library/src/components/Form/fields/FieldControlledVocab.vue, FieldMetadataSetting.vue, FieldAutosuggestPreset (categories)
- lib/pkp/templates/submission/review-editors.tpl (Review-step panel), review-details.tpl (keywords row)
- lib/pkp/templates/management/workflow.tpl (panel mount on the Metadata tab)
