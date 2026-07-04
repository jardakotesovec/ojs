---
name: publication-amendments
scope: Record what changed in a published/versioned article — the per-version Update Type and the public "Summary of Changes" amendment notice, and the helper that pulls an author's revision summaries into it
shared: pkp-lib          # the InsertSummaryOfChanges modal + composable, the UpdateType enum, the publication/submissionFile schema props, the version form and the Issue-entry form fields all live in lib/pkp + lib/ui-library (OMP/OPS share them). The one OJS-specific wire is the DashboardHandler override that feeds the 12 update-type options into the workflow config; OMP/OPS wire that differently. Spec'd from the OJS angle.
status: verified
e2e-plans: [publication-amendments]
atlas-claims: [VUE-insert-summary-of-changes-modal, LOC-submission-publication-updateType]
---

# Publication amendments (Update Type + Summary of Changes)

## Purpose

When a published article is corrected, retracted or otherwise re-issued, editors need to
record **what changed** and **what kind of change** it was. This 3.6 feature (landed May
2026, commit `eb14c0b9d3` — no legacy predecessor) adds two pieces of amendment metadata to
every publication version: an **Update Type** — one of twelve standard values (New Version,
Correction, Erratum, Corrigendum, Retraction, Expression of Concern, …) that defaults to *New
Version* — and a **Summary of Changes**, a public-facing amendment notice describing the
differences from the previous version. The author's contribution rides in from the review
stage: when an author uploads a revision they can attach a single-value **Summary of Changes
(Amendment Notice)** to that file; at publish time an editor can click **Insert Content** to
pull those revision summaries into the version's public notice. This spec owns those amendment
fields, the Insert-Content helper, and where they are captured. It does **not** own the version
lifecycle that creates the new version (`publication-versioning`), the publish action that
commits it (`publication-publish-flow`), or the review-round written-response flow that happens
to use a similarly named table (`review-rounds-and-revisions` — see the seam below).

**Liveness (established live + in code, 2026-07-04).** The **editor-side capture is fully wired
in OJS 3.6**: the running app injects all twelve update-type options and the `new_version`
default into the workflow config (live-probed), the two capture forms build the fields, and the
`publications.update_type` column exists on a fresh install (varchar, default `new_version`,
NOT NULL, 12-value check constraint). The **reader-side public display is NOT implemented** —
no reader template renders the notice or the type, despite the field copy promising it "will
appear publicly" (rule 9, ⚠). The only place the type leaves the system is the Crossref
crossmark deposit.

## Actors & permissions

Organised **by action**. Recurring terms: **editorial staff** = journal **managers** (incl. a
site admin acting as a manager on a journal they created), assigned **section editors**
(sub-editors) and **assistants**. **`recommendOnly` does NOT gate amendment editing.** The
recommend-only flag limits only the **decision** pane (a recommend-only editor may recommend
but not finalize a decision — `StageRolePolicy`/`DecisionAllowedPolicy`); **editing the
publication's amendment fields is gated by `canChangeMetadata` → `canEditPublication`**, never
by `recommendOnly` (the publication-write policy stack explicitly *allows* recommend-only:
`PublicationWritePolicy` builds `StageRolePolicy(..., $allowRecommendOnly = true)` and then
enforces `PublicationCanBeEditedPolicy` → `canEditPublication`). A section editor's default
user group carries `permitMetadataEdit = true` (→ `canChangeMetadata = true`), so a
**recommend-only editor who keeps metadata-edit permission edits the Update Type and Summary of
Changes fine** — live-verified below. A user is blocked only when their assignment has
`canChangeMetadata = false` (or by the published lock). The **published
lock** is owned by `publication-versioning`: once any version of a submission is Published or
Scheduled, an author-role user is hard-locked out of *all* publication editing — so authors
never touch the per-version amendment fields in practice. Authors *do* contribute the
file-level revision summary during review, before that lock applies.

| Action | Who may — and when |
|--------|--------------------|
| **Record a revision's "Summary of Changes" (file-level note)** | • The author uploading a review-revision file — the field appears on that file's details form<br>• Editorial staff — on any review-revision file<br>• Only on **review-revision** files (external or internal review-revision stage); other files have no such field <sup>a</sup> |
| **Choose the Update Type (per version)** | • Editorial staff — on the *Schedule For Publication* form and on the *Publication Settings* tab<br>• A **recommend-only** editor **may** edit it **if** their assignment keeps `canChangeMetadata` (the default for a section-editor group) — recommend-only gates decisions, not this field<br>• Blocked only by `canChangeMetadata = false` **or** the author published-lock <sup>b</sup> |
| **Write / edit the public "Summary of Changes" notice (per version)** | • Editorial staff — same two forms as the Update Type<br>• Same gate as the Update Type: `canChangeMetadata` (not `recommendOnly`) / published-lock <sup>c</sup> |
| **Insert a revision's summary into the notice (Insert Content)** | • Editorial staff — via the **Insert Content** button on the notice's rich-text editor, shown **only when editing in the submission's primary language**; the other locales are typed by hand <sup>d</sup> |
| **See the amendment notice as a reader** | • ⚠ **No one** — no public page renders it in 3.6 (rule 9); the Update Type reaches Crossref only <sup>e</sup> |

<sup>a</sup> useFileMetadataForm() (`summaryOfChanges` field, gated to `SUBMISSION_FILE_REVIEW_REVISION`/`SUBMISSION_FILE_INTERNAL_REVIEW_REVISION`); file-write permission owned by submission-files ·
<sup>b</sup> IssueEntryForm::addField(`updateType`); useWorkflowVersionForm() addFieldSelect(`updateType`) (publish mode only); the edit gate is `submission/Repository::canEditPublication()` — which consults `StageAssignment::$canChangeMetadata` (defaulting from the user group's `permitMetadataEdit`, true for the default section-editor group `registry/userGroups.xml`) and the role, and **never** `recommendOnly`; the route policy `PublicationWritePolicy` composes `StageRolePolicy([SubEditor,Assistant,Author], $allowRecommendOnly = true)` (recommend-only passes) + `PublicationCanBeEditedPolicy` (→ `canEditPublication`); `recommendOnly` gates only decisions (`StageRolePolicy`/`DecisionAllowedPolicy`); the author published-lock is owned by versioning. **Live-verified 2026-07-04** (port 8000, publicknowledge): as `minoue` (a section editor assigned **`recommendOnly:true` + `canChangeMetadata:true`**) `PUT …/publications/{id}` `{updateType:"correction", summaryOfChanges}` → **HTTP 200**, both persisted; the same field with `canChangeMetadata:false` → refused (the retained test's recommend-only case) ·
<sup>c</sup> IssueEntryForm::addField(`summaryOfChanges`); useWorkflowVersionForm() addFieldRichTextArea(`summaryOfChanges`); same `canChangeMetadata`/`canEditPublication` gate as <sup>b</sup> (not `recommendOnly`) ·
<sup>d</sup> useInsertSummaryOfChangesContent() (adds the `insertcontent` editor button when `locale === submissionLocale`); InsertSummaryOfChangesModal.vue ·
<sup>e</sup> live 2026-07-04: `article_details.tpl` renders neither field; grep of all reader templates is empty; only ArticleCrossrefXmlFilter emits `<update type>`

## Fields & validation

| Field (UI label) | Required? | Rules | Anchor |
|------------------|-----------|-------|--------|
| **Update Type** | No (defaults to *New Version*) | A single-select of the **12** enum values (not multilingual, one value per version). The form does **not** mark it required, but it cannot be blank — there is no empty option and the value falls back to *New Version* | useWorkflowVersionForm() `updateType` (no `isRequired`); UpdateType enum (12 cases); publication.json `updateType` (`in:` the 12 values) |
| **Summary of Changes** (public amendment notice) | No | Multilingual rich text, one value per version; the labelled description says it "will appear publicly as the version amendment notice" (⚠ rule 9 — nothing renders it yet). Carries the *Insert Content* button on the primary-locale editor | publication.json `summaryOfChanges` (multilingual, nullable); `publication.summaryOfChanges.description` |
| **Summary of Changes (Amendment Notice)** — file level | No | A **single-value** (non-multilingual) rich-text note on a **review-revision file only**, recording what changed in that revision; a file that has one shows an *Amendment Notice* badge in the file list | submissionFile.json `summaryOfChanges` (single, nullable, "Shown on Review Revision uploads only"); `submission.form.summaryOfChanges` = "Summary of Changes (Amendment Notice)"; FileManagerCellType `hasAmendmentNotice` |

The twelve update types (value → label): `addendum`→Addendum, `clarification`→Clarification,
`correction`→Correction, `corrigendum`→Corrigendum, `erratum`→Erratum,
`expression_of_concern`→Expression of Concern, `new_edition`→New Edition,
`new_version`→New Version *(default)*, `partial_retraction`→Partial Retraction,
`removal`→Removal, `retraction`→Retraction, `withdrawal`→Withdrawal *(anchor:
`classes/publication/enums/UpdateType.php`; labels `publication.updateType.*`)*.

## Rules & state

**The amendment fields on a version**

1. Every publication version carries an **Update Type** and a **Summary of Changes**. The
   Update Type is a plain column (`publications.update_type`, default `new_version`, not
   nullable, constrained to the 12 values); the public Summary of Changes is a multilingual
   publication setting. Both are ordinary publication metadata — they are **copied verbatim onto
   a new version** when one is created, like any other field (owned by `publication-versioning`
   rule 9; an editor must rewrite them for the amendment — Open question 2).
   *(anchor: `classes/publication/DAO.php` `updateType`→`update_type`; `schemas/publication.json`;
   migration `I12584_AddPublicationUpdateType` — `enum(...)->default(new_version)`)*
2. **Two editor-side surfaces capture the fields**, and only editorial staff reach either:
   - the **Schedule For Publication** version form ("Review Publishing Details"), where the two
     fields appear alongside version stage / significance / issue assignment, but **only in
     publish mode** — they are absent from the plain create-version and send-to-text-editor modes
     (`useWorkflowVersionForm()` — the `updateType`/`summaryOfChanges` fields are added under
     `if (modeState.isPublishMode)`);
   - the **Publication Settings** tab (the Issue-entry form), in a **"Version and Updates"**
     field group, editable any time (`IssueEntryForm::__construct()` — `GROUP_VERSION_AND_UPDATES`;
     `publication.versionAndUpdates`).
3. **OJS supplies the 12 update-type options; the shared handler does not.** The Vue store reads
   the option list and default from the page config
   (`workflowStore.js` — `componentForms.updateTypeOptions` / `defaultUpdateType`). The shared
   `PKPDashboardHandler` fills in only the version-stage options; the **OJS** `DashboardHandler`
   override builds the update-type options from the enum and sets the default to *New Version*.
   Without that override the select would render empty. **Live-probed 2026-07-04**: the running
   OJS page's injected config carried all 12 `updateTypeOptions` and `defaultUpdateType:
   "new_version"`. *(anchor: `APP\pages\dashboard\DashboardHandler::setupIndex()` — builds
   `updateTypeOptions` + `defaultUpdateType`; `PKP\pages\dashboard\PKPDashboardHandler::setupIndex()`
   — only `versionStageOptions`)*
4. On the OJS **publish** path the version form saves the fields through the **generic
   publication edit** endpoint (a `PUT` on the publication) carrying `updateType` +
   `summaryOfChanges` together with the issue intent; the values validate against the publication
   schema. *(anchor: `useWorkflowVersionForm() handleVersionSubmission()` — `requestBody.updateType`
   / `requestBody.summaryOfChanges`, PUT `submissions/{id}/publications/{publicationId}` when OJS +
   publish mode)*

**The revision summary and the Insert-Content helper**

5. During review, a **review-revision file** can carry a single-value **Summary of Changes
   (Amendment Notice)** on its details form; the field appears **only** for the external- or
   internal-review-revision file stages. A file that has one shows an **Amendment Notice** badge
   in the file list. *(anchor: `useFileMetadataForm()` — field gated to the two review-revision
   stages; `FileManagerCellType.vue` `hasAmendmentNotice`; `submission.files.amendmentNotice`)*
6. The public notice's rich-text editor gains an **Insert Content** button — but only while the
   **submission's primary language** is being edited (the summary is a single value and is
   inserted into that locale; other locales are hand-translated). *(anchor:
   `useInsertSummaryOfChangesContent()` — registers the `insertcontent` button when
   `locale === submissionLocale`)*
7. **Insert Content** opens a side modal listing the submission's review-revision files that
   **carry a summary** (files without one are filtered out). Each row shows a **plain-text preview**
   of the summary and a description **"{review-round label} • {date} • {file name}"**. Choosing one
   **appends its original HTML** to the notice's primary-locale value; typing is still available.
   With no such files the modal shows an **empty state** ("No saved summaries found for this
   submission's review revisions."). *(anchor: `InsertSummaryOfChangesModal.vue` — `items`
   computed from `SUBMISSION_FILE_REVIEW_REVISION` files' `summaryOfChanges`, `insert()` appends
   the HTML; `publication.insertContent.empty`)*
8. The same Insert-Content wiring is applied on **both** capture surfaces (the publish version
   form and the Publication Settings / Issue-entry form). OPS has no review stage, so it wires
   neither — out of scope here. *(anchor: `useWorkflowVersionForm()` and
   `WorkflowPublicationForm.vue` both call `useInsertSummaryOfChangesContent(...,'summaryOfChanges',...)`;
   guarded `!isOPS()` / `isOJS()`)*

**As-built gaps**

9. ⚠ **The public amendment notice is not shown to readers in 3.6.** The field description and
   schema both say the Summary of Changes "will appear publicly", but **no reader template renders
   it** and neither is the Update Type surfaced on the article page — confirmed live and by an
   exhaustive template grep. The only external exposure is the **Crossref** deposit: when the
   Crossmark plugin is enabled, the update type is written as an `<update type="…">` attribute in
   the crossmark `<updates>` node. See Known deviations. *(anchor: `templates/frontend/objects/article_details.tpl`
   renders neither; `plugins/generic/crossref/filter/ArticleCrossrefXmlFilter.php` — `setAttribute('type', ...updateType)`)*
10. ⚠ **On the Publication Settings tab an amendment edit is coupled to a mandatory issue
    decision.** That form embeds the issue-assignment controls, which preload the "current/back
    issue" radio with the required Issue select empty, so client-side validation blocks **any**
    save — including a summary-only edit — until an issue is picked, and the save also writes the
    assignment-derived publication status. This is the Issue-entry form's behaviour (owned by
    `publication-issue-assignment`), inherited here. *(anchor:
    `useWorkflowPublicationFormIssue()` issue radio/required Issue select)*

## Side effects

- **Persisted on the publication**: `update_type` (column) and `summaryOfChanges` (multilingual
  setting); both are copied to a new version on version-create (rule 1).
- **Persisted on the submission file**: the revision-level `summaryOfChanges`, which drives the
  Amendment Notice badge and the Insert-Content list (rule 5).
- **Crossref**: the update type is emitted as `<update type>` in the crossmark deposit when
  Crossmark is enabled (rule 9) — consumed by `doi-crossref` export.
- **No emails, notifications or activity-log entries of its own.** The version-create
  notification/log and the publish log are owned by `publication-versioning` /
  `publication-publish-flow`; recording an amendment adds nothing beyond the metadata save
  those actions already log.

## Settings that modify behavior

- **Crossmark plugin enabled** (crossref) — turns on the `<updates>`/`<update type>` node that
  carries the update type into the deposit (rule 9). No other journal setting toggles the
  amendment fields — they are always present in OJS.
- **Journal supported locales** — the public Summary of Changes is multilingual; the Insert
  Content button only assists the **primary** submission locale (rule 6), the rest are typed.

## Cross-feature interactions

- **publication-versioning** — owns the version lifecycle (create/copy/label a version), the
  *Review Publishing Details* version-form shell these fields ride on, and the **published lock**
  (`canEditPublication`) that keeps authors out. It copies `updateType`/`summaryOfChanges` on
  version-create (its rule 9). This spec owns the two fields themselves.
- **publication-publish-flow** — owns the publish / **republish** action; this spec owns the
  amendment content carried on that republish (its rule 14 points here).
- **publication-issue-assignment** — owns `FORM-issue-entry-form` / the *Publication Settings*
  form shell and the mandatory-issue save-block (rule 10); this spec owns the Update Type +
  Summary of Changes fields *on* that form.
- **review-rounds-and-revisions** — **seam, resolved**: it single-owns
  `DB-review_round_author_responses` and the **review-round written-response** flow (editor
  *Request Response* → author *Submit Response*), which is a **different** feature. Despite the
  FEATURE-MAP note pointing that table here, this amendment flow does **not** use it: the
  "author submits, editor inserts" path runs through the **file-level `summaryOfChanges`** on
  review-revision files plus `publications.update_type` (the review-rounds spec states the same,
  its cross-feature note). That spec also owns the review-revision **file** lifecycle; this spec
  owns the amendment *meaning* of the file summary + the Amendment Notice badge.
- **submission-files** — owns the file details form and the storage of the file-level
  `summaryOfChanges` field + the file-write permission; this spec owns its amendment semantics.
- **publication-title-abstract-body** / the other Publication-tab metadata specs — own the body,
  title and abstract edits that constitute the *actual* correction; this spec owns only the notice
  describing it and the type.
- **doi-crossref** — owns the Crossref export surface; consumes the update type (rule 9).

## Canonical scenarios

1. **Author records a revision's Summary of Changes** — atester (author) + dbarnes (editor): on a
   submission in review with a *Request Revisions* decision, the author uploads a revision file;
   its details form offers the single-value **Summary of Changes (Amendment Notice)** rich-text
   field. After saving, the file row shows the **Amendment Notice** badge; a second revision saved
   without a summary shows no badge.
2. **Editor inserts a revision's summary into the public notice** — dbarnes: on the publication's
   Summary of Changes field the **Insert Content** button appears (submission locale only); the
   modal lists the revision file with its round label and date; selecting it **appends the file's
   HTML** (markup preserved) into the field, and it persists.
3. **Schedule for Publication carries the update type + summary** — dbarnes: on a
   production-ready version, *Schedule For Publication* → the Review Publishing Details form shows
   **Update Type** (a select defaulting to *New Version* with all 12 options, not marked required)
   and the multilingual **Summary of Changes**; the chosen values persist onto the publication.
4. **Update type across versions** — dbarnes: v1 publishes with the default *New Version*;
   *Create New Version* → schedule the new version with **Update Type = Correction** and a summary
   → republish. v2 carries *Correction* + the summary while v1 is untouched (the versioning
   interaction).
5. **Insert-modal empty state, manual entry still works** — dbarnes: on a submission accepted with
   no review revisions, the **Insert Content** modal shows its empty-state message; the editor
   types a summary by hand and it saves.
6. **Insert fills only the submission locale** — dbarnes on a bilingual journal (English
   submission): after Insert Content, the English Summary of Changes holds the inserted content
   while the French value stays empty — the single-value file summary maps to one publication
   locale, with no cross-locale autofill.
7. **Permission boundary** — an **author** granted metadata permission cannot touch the Update
   Type or public Summary of Changes once any version is published/scheduled (the published lock),
   and can never open the publish form. A **recommend-only** section editor is **not** blocked by
   the recommend-only flag: with metadata-edit permission (`canChangeMetadata`, the section-editor
   default) they edit the amendment fields normally (live-verified 200); only a
   `canChangeMetadata:false` assignment refuses them. The author's sole input is the file-level
   revision summary during review. A **reader** sees neither field — the public notice is not
   rendered anywhere in 3.6 (rule 9; live-verified: a published article carrying
   `updateType=correction` + a summary shows the reader nothing).

## Known deviations (as-built ≠ intent)

- ⚠ **The public amendment notice / update type are never displayed to readers** (rule 9) —
  [app-changes §2 row 96](../../e2e/app-changes.md). The Summary of Changes field is described
  (`publication.summaryOfChanges.description`: "This will appear publicly as the version amendment
  notice…") and schema-documented ("Public-facing amendment notice…") as a public-facing notice,
  but no front-end template renders it and the Update Type appears only in the Crossref crossmark
  deposit (`ArticleCrossrefXmlFilter.php` `setAttribute('type', …updateType)`). Almost certainly a
  **not-yet-implemented** reader surface rather than a logic bug (the e2e plan records the same:
  "NOT yet implemented in the front end … add reader rows when it lands"), but the field copy
  promises a public display that does not exist. **Live re-confirmed 2026-07-04**: a manager set
  `updateType=correction` + a distinctive summary on a published article (200, persisted); the
  anonymous reader page rendered the article but zero occurrences of the notice text, "Update
  Type", "Amendment Notice" or "correction". (Non-blocking; ledger row 96.)
- ⚠ **Publication Settings cannot save an amendment-only edit** without also answering the
  mandatory issue radio (rule 10) — owned by `publication-issue-assignment`; referenced, not
  re-flagged as this spec's own defect.
- **Not a defect (noted)**: the Update Type select is not marked *required* yet can never be blank
  (no empty option + a `new_version` default) — intended.
- **Corrected understanding (not a defect)**: `recommendOnly` does **not** block a section editor
  from editing the amendment fields — that was a drafting error. The edit gate is
  `canChangeMetadata` (→ `canEditPublication`); `PublicationWritePolicy` passes recommend-only
  (`$allowRecommendOnly = true`) and `recommendOnly` only limits decisions. A recommend-only
  editor with metadata permission edits the Update Type / Summary of Changes normally
  (live-verified 200); see Actors and footnote <sup>b</sup>.
- **Shared open item (not a defect)**: version-create copies `updateType`/`summaryOfChanges`
  verbatim, so an editor must rewrite the amendment on the new version (shared with
  `publication-versioning` Open question 5).

## Open questions

1. Is the missing reader-side display of the amendment notice / update type an intended
   round-2 gap, or an oversight? The field and schema copy both promise a public notice.
2. Should version-create **reset** `updateType` (to *New Version*) and clear `summaryOfChanges`
   instead of inheriting the previous version's amendment verbatim? (Dup of versioning OQ 5.)
3. Is it intended that recording an amendment notice on **Publication Settings** forces a
   simultaneous issue-assignment decision (rule 10)?
4. Should the **Update Type** be a genuinely required, deliberate choice, given that Correction /
   Retraction / Expression of Concern are semantically significant and the field silently defaults
   to *New Version*?

---

<!-- REFERENCE MATERIAL — provenance and campaign bookkeeping, not product-owner narrative. -->

## Reference — entry points & surfaces

| Entry | Path | Atom |
|-------|------|------|
| Revision-file Summary of Changes | Workflow → Review → file details form (review-revision files) — single-value "Summary of Changes (Amendment Notice)" | *(field on the file form — submission-files; summaryOfChanges aspect here)* |
| Update Type + public Summary of Changes (publish) | Workflow → Publication → *Schedule For Publication* → "Review Publishing Details" form ("Version and Updates" fields) | *(rides FORM-publish-form / the version form — owned by versioning; referenced)* |
| Update Type + public Summary of Changes (any time) | Workflow → Publication → **Publication Settings** tab → "Version and Updates" group | *(rides FORM-issue-entry-form — owned by publication-issue-assignment; referenced)* |
| Insert Content button + modal | The Summary of Changes rich-text editor (primary locale) → **Insert Content** side modal listing review-revision summaries | **VUE-insert-summary-of-changes-modal** |
| Update-type labels/options | The 12 `publication.updateType.*` strings + label/description | **LOC-submission-publication-updateType** |
| Crossref update-type deposit | Crossmark-enabled Crossref XML → `<updates><update type="…">` | *(export — owned by doi-crossref; referenced)* |

Not claimed here (seam notes): `DB-review_round_author_responses` (+ `_settings`/`_authors`) is
single-owned by `review-rounds-and-revisions` (the review-round written-response flow — a
different feature). The `updateType`/`summaryOfChanges` publication schema props are part of
`SCHEMA-publication-{pkp,ojs}` (owned by `publication-versioning`); the `submissionFile.json`
`summaryOfChanges` prop is part of the submission-file schema (submission-files). There is no
separate atom for the `publications.update_type` column.

## Reference — code anchors

- **The amendment fields (schema/enum/DB)**: `lib/pkp/schemas/publication.json`
  (`updateType` `in:`-validated, `summaryOfChanges` multilingual);
  `lib/pkp/classes/publication/enums/UpdateType.php` (12 cases + `labelKey()`);
  `classes/publication/DAO.php` (`updateType`→`update_type`);
  `lib/pkp/classes/migration/upgrade/v3_6_0/I12584_AddPublicationUpdateType.php` (column, default
  `new_version`); file-level: `lib/pkp/schemas/submissionFile.json` (`summaryOfChanges`, single).
- **Capture surfaces**:
  `lib/ui-library/src/pages/workflow/composables/useWorkflowVersionForm.js` (`updateType` /
  `summaryOfChanges` fields under publish mode; `handleVersionSubmission` request body + OJS
  publish-mode PUT);
  `classes/components/forms/publication/IssueEntryForm.php` (`GROUP_VERSION_AND_UPDATES` — the
  `updateType` select + `summaryOfChanges` rich text);
  `lib/ui-library/src/pages/workflow/components/publication/WorkflowPublicationForm.vue` (wires
  Insert Content into the issue-entry form).
- **Option wiring**: `pages/dashboard/DashboardHandler.php` (OJS override — builds
  `updateTypeOptions` from `UpdateType::cases()`, `defaultUpdateType` = `NEW_VERSION`);
  `lib/pkp/pages/dashboard/PKPDashboardHandler.php` (only `versionStageOptions`);
  `lib/ui-library/src/pages/workflow/workflowStore.js` (reads `componentForms.updateTypeOptions`
  / `defaultUpdateType`).
- **Insert-Content helper**:
  `lib/ui-library/src/components/InsertSummaryOfChanges/InsertSummaryOfChangesModal.vue`
  (lists review-revision files' summaries; `insert()` appends HTML);
  `lib/ui-library/src/composables/useInsertSummaryOfChangesContent.js` (registers the
  `insertcontent` editor button for the submission locale only);
  `lib/ui-library/src/managers/FileManager/modals/useFileMetadataForm.js` (file-level field,
  review-revision stages); `lib/ui-library/src/managers/FileManager/FileManagerCellType.vue`
  (`hasAmendmentNotice` badge).
- **Reader/export**: `templates/frontend/objects/article_details.tpl` (renders **neither** — the
  reader gap, rule 9); `plugins/generic/crossref/filter/ArticleCrossrefXmlFilter.php`
  (`<update type>` in the crossmark node).
- **Locale**: `lib/pkp/locale/en/submission.po` (`publication.updateType.*` — 14 keys:
  label + description + 12 type labels; `submission.form.summaryOfChanges(.description)`,
  `publication.summaryOfChanges.description`, `publication.insertContent.empty`,
  `publication.versionAndUpdates`, `submission.files.amendmentNotice`);
  `lib/pkp/locale/en/common.po` (`common.insertContent`, `common.insertContentSearch`).
- **e2e**: `docs/e2e/plans/publication-amendments.md`;
  `lib/pkp/playwright/tests/publication-amendments.spec.js`.
</content>
</invoke>
