---
name: review-forms
scope: The journal manager's review-form BUILDER — Settings → Workflow → Review → Review Forms: create/edit/copy/delete a structured review form, add and order its question elements (six item types, the possible-responses list for choice types), mark each element required and/or author-visible, and activate a form so it becomes selectable when assigning a reviewer
shared: pkp-lib
status: verified
e2e-plans: [review-forms.md]
atlas-claims:
  - GRID-lib-pkp-grid-settings-review-forms-review-form-grid-handler
  - GRID-lib-pkp-grid-settings-review-forms-review-form-elements-grid-handler
  - GRID-lib-pkp-listbuilder-settings-review-forms-review-form-element-response-item-listbuilder-handler
  - DB-review_forms
  - DB-review_form_settings
  - DB-review_form_elements
  - DB-review_form_element_settings
  - LOC-manager-manager-reviewForms
  - LOC-manager-manager-reviewFormElements
---

# Review forms

## Purpose

A journal that wants its reviewers to answer *structured questions* instead of (or in
addition to) free-text comments builds **review forms** here. This spec owns the manager's
**builder**: the Review Forms grid under Settings → Workflow → Review, where a manager
creates a form (a title + instructions), adds **question elements** (six item types — from a
one-line box to a drop-down of preset choices), marks each element *required* and/or
*included in the copy shared with the author*, orders them, previews the result, and
**activates** the form. Only an active form is offered in the Review Form dropdown when an
editor assigns a reviewer (`assign-and-manage-reviewers`) or is set as a section's default
(`sections`); the reviewer then *fills* the form and the answers become review-form responses
(`reviewer-response`). This spec owns the form's **definition and configuration** — its
structure, its element set, and its active/in-use lifecycle. It does **not** own the
reviewer's act of answering (that is `reviewer-response`, which owns the `review_form_responses`
write), nor the picking of a form at assignment (that is `assign-and-manage-reviewers`).

## Actors & permissions

Review-form management is a **journal-settings** surface: it lives inside Settings → Workflow →
Review, reachable only by a user who holds a settings-managing role. Both grid handlers assign
**every** operation to **Journal Manager** and **Site Administrator** only, and add a
settings-access policy on top — so a section editor, assistant, reviewer or author has no path
to any review-form action (the whole Settings area is hidden from them, and a hand-crafted grid
call is refused). There is a **single capability tier**: whoever can open the grid can do
everything on it (create, edit, copy, delete, activate/deactivate, add/edit/order/delete
elements). Rows below are what the grid UI offers, verified against the two handlers' role/op
assignments and live-probed on `publicknowledge` 2026-07-03 (manager `dbarnes`; section editor
`dbuskins` refused). <sup>a</sup>

| Action | Who may — and when |
|--------|--------------------|
| **View / open the Review Forms grid** | • Managers, site admins — any time, via Settings → Workflow → Review → **Review Forms** tab<br>• Section editors, assistants, reviewers, authors — **never** (no Settings access; a direct grid call returns "The current role does not have access to this operation.") <sup>a b</sup> |
| **Create a review form** (title + instructions) | • Managers, site admins — the **Create Review Form** button; the new form is created **inactive** <sup>c</sup> |
| **Edit a form's basics and its elements** | • Managers, site admins — via the row **Edit** action, but **only while the form is not in use** (no reviewer holds it — see rule 6); an in-use form's Edit action is withdrawn <sup>d</sup> |
| **Add / edit / reorder / delete an element** | • Managers, site admins — inside the form's **Form Items** tab, only while the form is not in use (the tab is reachable only through Edit) <sup>e</sup> |
| **Preview a form** | • Managers, site admins — the row **Preview** action; always available, read-only, shows the form as a reviewer would see it <sup>f</sup> |
| **Copy a form** | • Managers, site admins — the row **Copy** action; always available; duplicates the form and its elements as a new **inactive** form <sup>g</sup> |
| **Activate / deactivate a form** | • Managers, site admins — the **Active** checkbox in each row; togglable **any time regardless of in-use state** (⚠ the activate warning claims deactivation becomes impossible once assigned — it does not; see Known deviations) <sup>h</sup> |
| **Delete a form** | • Managers, site admins — the row **Delete** action, but **only while the form is not in use**; an in-use form's Delete action is withdrawn <sup>d</sup> |
| **Reorder forms in the grid** | • Managers, site admins — drag-and-drop; persists the display sequence <sup>i</sup> |

<sup>a</sup> ReviewFormGridHandler::__construct() / ReviewFormElementsGridHandler::__construct() (addRoleAssignment: ROLE_ID_MANAGER + ROLE_ID_SITE_ADMIN for every op); both authorize() add CanAccessSettingsPolicy; live probe 2026-07-03 (dbarnes full access; dbuskins → grid `fetch-grid` returns `{status:false, "The current role does not have access to this operation."}`) ·
<sup>b</sup> workflow.tpl (Review Forms tab under Settings → Workflow → Review, manager-only page); RoleBasedHandlerOperationPolicy ·
<sup>c</sup> ReviewFormGridHandler::createReviewForm()/updateReviewForm(); ReviewFormForm::execute() (`setActive(0)` on new) ·
<sup>d</sup> ReviewFormGridRow::initialize() (`$canEdit = incompleteCount==0 && completeCount==0` gates the Edit + Delete row actions); ReviewFormGridHandler::deleteReviewForm() re-checks the same counts; live-probed (in-use row showed only Copy + Preview) ·
<sup>e</sup> ReviewFormElementsGridHandler ops; updateReviewFormElement()/deleteReviewFormElement() guard on `unusedReviewFormExists()` ·
<sup>f</sup> ReviewFormGridRow::initialize() (Preview always added); reviewFormPreview()/PreviewReviewForm; live-probed (dropdown element rendered) ·
<sup>g</sup> ReviewFormGridRow::initialize() (Copy always added); ReviewFormGridHandler::copyReviewForm() (`setActive(0)` on the copy) ·
<sup>h</sup> ReviewFormGridCellProvider::getCellActions() ('active' column → activate/deactivate link by `getActive()`, no in-use check); ReviewFormGridHandler::activateReviewForm()/deactivateReviewForm() (no in-use guard); live-verified deactivate of an in-use form succeeded ·
<sup>i</sup> ReviewFormGridHandler::initFeatures() (OrderGridItemsFeature); setDataElementSequence()/resequenceReviewForms()

## Fields & validation

Two forms. The **review-form basics** (Create / Edit → *Review Form* tab) collect the form's
identity; each **element** (Form Items → *Create New Item* / *Edit*) is one question. All text
fields are multilingual (per journal locale); server-set values (sequence, active flag, assoc
type/id) are omitted.

| Field (UI label) | Required? | Rules | Anchor |
|------------------|-----------|-------|--------|
| **Title** (review form) | Yes | Multilingual; the form's name in the grid and the assignment dropdown | ReviewFormForm::__construct() (FormValidatorLocale `title` required, `manager.reviewForms.form.titleRequired`) |
| **Description and Instructions** (review form) | No | Multilingual rich text; guidance shown to the reviewer above the form | ReviewFormForm::readInputData() (`description`) |
| **Question** (element) | Yes | Multilingual rich text; the question text shown to the reviewer and (if included) to the author. Empty → "A question is required for the form item." (live-verified) | ReviewFormElementForm::__construct() (FormValidatorLocale `question` required) |
| **Description** (element) | No | Multilingual rich text; optional help under the question | ReviewFormElementForm::readInputData() (`description`) |
| **Reviewers required to complete item** | No | Checkbox, **default off**; when on, the reviewer cannot submit until they answer this element (enforcement in `reviewer-response`) | ReviewFormElementForm::execute() (`required` → 1/0); label `manager.reviewFormElements.required` |
| **Included in message to author** | No | Checkbox, **default on**; when off, the reviewer's answer to this element is withheld from the author-facing copy of the review (editor-only) | ReviewFormElementForm::initData() (`included`=1 default) / execute(); ReviewerComments trait + reviewDownload.tpl (`getIncluded()`) |
| **Item type** | Yes | Select of six types (see rule 3); "Choose item type" placeholder is invalid. Empty → "An item type is required for the form item." | ReviewFormElementForm::__construct() (FormValidator `elementType` required, `manager.reviewFormElements.form.elementTypeRequired`); ReviewFormElement::getReviewFormElementTypeOptions() |
| **Response Options** (possible responses) | Only for choice types | A multilingual **listbuilder** of the preset answers a reviewer picks from; enabled **only** for Checkboxes / Radio buttons / Drop-down box, ignored (cleared) for the three text types | ReviewFormElementForm::execute() (unpacks the listbuilder only `if in_array(elementType, getMultipleResponsesElementTypes())`, else `setPossibleResponses(null)`); ReviewFormElementResponseItemListbuilderHandler |

## Rules & state

A **review form** is a `review_forms` row (title/description in `review_form_settings`) scoped
to the journal (`assoc_type`/`assoc_id`), carrying a display **sequence** and an **active** flag
(`is_active`). Its **elements** are `review_form_elements` rows (question/description/possible
responses in `review_form_element_settings`), each with a sequence, a type, and the
required/included flags. Two computed counts drive the lifecycle: **In Review** (incomplete) and
**Completed** — how many review assignments currently point at the form.

1. **The builder is a legacy grid, and it is the sole live surface.** Review Forms is a legacy
   PKP grid (`ReviewFormGridHandler`) embedded via `load_url_in_div` in the Vue Settings →
   Workflow → Review page; there is **no** Vue-manager replacement (unlike the sibling
   *Reviewer Recommendations* tab). Every action (create/edit/copy/delete/activate, and the
   element sub-grid) is a legacy AJAX modal. Grid columns: **Title · In Review · Completed ·
   Active**. Live-verified 2026-07-03. <sup>a</sup>
2. **Creating a form makes it inactive; editing basics is title + instructions.** *Create
   Review Form* opens a modal with **Title** (required) and **Description and Instructions**;
   saving inserts a `review_forms` row with `is_active = 0` and appends it to the end of the
   sequence. The same modal, reached via **Edit**, updates the basics. Live-verified: a new
   form appeared with In Review = 0, Completed = 0 and an **unchecked** Active box. <sup>b</sup>
3. **An element is one of six item types; three of them carry preset responses.** The **Item
   type** select offers (live labels → internal type): **Single word text box**
   (`SMALL_TEXT_FIELD` 1), **Single line text box** (`TEXT_FIELD` 2), **Extended text box**
   (`TEXTAREA` 3), **Checkboxes (you can choose one or more)** (`CHECKBOXES` 4), **Radio
   buttons (you can only choose one)** (`RADIO_BUTTONS` 5), **Drop-down box** (`DROP_DOWN_BOX`
   6). The three text types take a free typed answer; the three **choice types**
   (checkboxes/radio/dropdown) present the **Response Options** the manager defines. Switching a
   saved element away from a choice type **clears** its stored responses; switching to a choice
   type enables the Response Options listbuilder. Live-verified all six options + placeholder.
   <sup>c</sup>
4. **Two flags per element: required, and author-visibility.** **Reviewers required to complete
   item** (default off) makes the element mandatory for the reviewer at submit-time
   (enforced in `reviewer-response`, not here). **Included in message to author** (default
   **on**) controls disclosure: an *included* element's question + the reviewer's answer appear
   in the author-facing copy of the review and the reviewer-comment email; an element with it
   **off** is editor-only (skipped from the author-friendly rendering). Live-verified defaults.
   <sup>d</sup>
5. **Choice elements get their answers from a multilingual listbuilder.** For a choice type, the
   **Response Options** listbuilder (*Add Item* rows, one per possible answer, editable per
   locale) defines the pick-list. It is stored as the element's `possibleResponses` locale
   setting; the reviewer's chosen value(s) reference these. Live-verified: adding a Drop-down box
   with an "Excellent" response saved and previewed as a `<select>`. <sup>e</sup>
6. **Once a reviewer holds the form, it locks against structural edits.** "In use" =
   **In Review + Completed > 0**, computed from `review_assignments` that point at the form and
   are **not declined** (In Review = every non-declined assignment holding the form that is not
   yet completed — so the lock trips the moment a reviewer is *assigned* the form, before they
   even accept; Completed = the reviewer submitted).
   While in use, the form's **Edit** and **Delete** row actions disappear (the element grid,
   reachable only through Edit, is therefore unreachable too; and the element handler
   independently refuses to **save** or **delete** an element on an in-use form —
   `updateReviewFormElement`/`deleteReviewFormElement` guard on `unusedReviewFormExists`). Only
   **Copy**, **Preview** and the
   **Active** toggle remain. Live-verified: after assigning a reviewer who accepted with the form,
   In Review became 1 and the row menu showed only Copy + Preview. <sup>f</sup>
7. **Activate makes a form selectable; deactivate withdraws it from *new* assignments —
   and is NOT blocked by in-use.** The **Active** checkbox flips `is_active` (each behind an
   "Are you sure?" confirm). Activating is required before a form can be assigned (rule 9).
   Deactivating removes the form from the assignment dropdown and section-default list but leaves
   any in-flight assignment's attached form intact (existing `review_assignments.review_form_id`
   is untouched — no data loss). ⚠ The **activate** confirmation warns *"Once it's assigned to a
   review you will no longer be able to deactivate it"*, but the deactivate path has **no in-use
   guard** and the checkbox is never disabled — an in-use form **can** be deactivated.
   Live-verified: deactivating a form with In Review = 1 succeeded. See Known deviations.
   <sup>g</sup>
8. **Copy duplicates the form and its elements as a fresh inactive form.** **Copy** (always
   available, even on an in-use form) inserts a new `review_forms` row (inactive, appended to the
   sequence) and clones every element with its settings — a safe way to revise an in-use form
   without touching the live one. <sup>h</sup>
9. **A form becomes assignable only when active; the assignment dropdown offers the active
   set.** The editor's Add-Reviewer / Edit-Reviewer form populates its **Review Form** dropdown
   from the journal's **active** forms (`getActiveByAssocId`), plus a **None / Free Form Review**
   option; a **section** may also nominate one active form as its default. Selecting one is
   owned by `assign-and-manage-reviewers`; the reviewer filling it and required-element
   enforcement are owned by `reviewer-response`. Live-verified: with the form active, the
   Add-Reviewer dropdown listed `None / Free Form Review` and `Probe Review Form A`. <sup>i</sup>
10. **Deleting is guarded and reattaches orphaned assignments.** **Delete** (offered only on a
    not-in-use form, and re-checked server-side) removes the form, its settings, and all its
    elements/element-settings (FK cascade), and first **nulls the `review_form_id`** on any
    review assignment that still referenced it (only *declined* assignments can — active ones
    would have made the form in-use). Because a deletable form has no completed/in-progress
    reviews, no `review_form_responses` are orphaned. <sup>j</sup>
11. **Ordering.** Both the forms grid and the element grid support drag-to-reorder; the manager's
    order sets the sequence in which forms list and elements render to the reviewer
    (`resequenceReviewForms` / `resequenceReviewFormElements`). <sup>k</sup>

<sup>a</sup> workflow.tpl (`load_url_in_div` → `grid.settings.reviewForms.ReviewFormGridHandler`); ReviewFormGridHandler::initialize() (columns name/inReview/completed/active); live probe 2026-07-03 ·
<sup>b</sup> ReviewFormForm::execute() (`setActive(0)`, `resequenceReviewForms`); ReviewFormGridHandler::createReviewForm()/updateReviewForm(); live probe ·
<sup>c</sup> ReviewFormElement type constants + getReviewFormElementTypeOptions()/getMultipleResponsesElementTypes(); ReviewFormElementForm::execute() (clears possibleResponses for non-choice types); live probe (six options) ·
<sup>d</sup> ReviewFormElementForm::initData() (`included`=1) / execute() (`required`,`included`); ReviewerComments::getReviewFormComments() + reviewDownload.tpl `authorFriendly && !getIncluded()`; live probe (required off, included on) ·
<sup>e</sup> ReviewFormElementResponseItemListbuilderHandler (LISTBUILDER_SOURCE_TYPE_TEXT, save field `possibleResponses`, MultilingualListbuilderGridColumn); ReviewFormElementForm::insert/update/deleteEntry(); live probe ·
<sup>f</sup> ReviewFormDAO::getById() (complete_count = date_completed NOT NULL & declined<>1; incomplete_count = date_completed NULL & declined<>1); ReviewFormGridRow::initialize() (`$canEdit`); ReviewFormDAO::unusedReviewFormExists(); live probe (In Review 1 → Copy+Preview only) ·
<sup>g</sup> ReviewFormGridCellProvider::getCellActions() + selectStatusCell.tpl (checkbox, no `disabled` set); ReviewFormGridHandler::activateReviewForm()/deactivateReviewForm(); locale `manager.reviewForms.confirmActivate`/`confirmDeactivate`; live-verified deactivate while in use ·
<sup>h</sup> ReviewFormGridHandler::copyReviewForm() (`setActive(0)`, clone elements, resequence) ·
<sup>i</sup> ReviewFormDAO::getActiveByAssocId(); ReviewerForm::initData()/fetch() (`reviewFormId` dropdown, `None / Free Form Review`); SectionForm (section default via getActiveByAssocId); live probe (assignment dropdown) ·
<sup>j</sup> ReviewFormGridHandler::deleteReviewForm() (count re-check; `Repo::reviewAssignment()->edit(..., ['reviewFormId'=>null])`; deleteById); ReviewFormDAO::deleteById() (settings + elements cascade) ·
<sup>k</sup> ReviewFormGridHandler / ReviewFormElementsGridHandler initFeatures() (OrderGridItemsFeature), setDataElementSequence()

## Side effects

Review-form editing is **local configuration** — it mutates only the four review-form tables and
raises a trivial in-app **"Your changes have been saved."** notification on each save/activate/
deactivate/copy/delete (`NotificationManager::createTrivialNotification`). No emails, no
event-log entries, no cross-entity mutations at edit time, with two exceptions carried in the
rules above:

- **Deactivating** a form sets `is_active = 0` only; it does **not** touch existing
  `review_assignments` (in-flight reviews keep their attached form). It just drops the form from
  the *active* set the assignment dropdown / section default reads.
- **Deleting** a form nulls `review_assignments.review_form_id` on any (declined) assignment that
  referenced it, then cascade-deletes the form's settings and all its elements/element-settings.

The **reviewer's responses** (`review_form_responses`) are written by `reviewer-response` when a
reviewer submits, and read by the editor's Read-Review modal / the author-facing copy; this spec
does not write or delete them (a deletable form has none — rule 10).

## Settings that modify behavior

- **Section default review form** — a journal section may nominate one **active** review form as
  its default, which pre-selects in the assignment form; the dropdown there is filtered to active
  forms (`sections`, `assign-and-manage-reviewers`). Deactivating or deleting a form removes it
  from that set.
- No `config.inc.php` variable or journal toggle changes the builder's rules; review-form
  management is available on every journal (the tab always shows for a manager).

## Cross-feature interactions

- **reviewer-response** — owns the reviewer *filling* a form and the `review_form_responses`
  write at submit; enforces each element's **required** flag. This spec owns the form/element
  **structure** those responses answer (the structure-vs-write split). Seam: `DB-review_form_responses`
  is claimed by `reviewer-response`.
- **assign-and-manage-reviewers** — owns the editor's **Review Form** dropdown at assignment
  (offering this feature's *active* forms + "None / Free Form Review") and the
  `review_assignments.review_form_id` it sets; `EditReviewForm` hides the dropdown once the review
  is completed. This spec owns which forms are *available* to that dropdown (active set).
- **sections** — owns a section's default-review-form setting (`reviewFormId` on the section),
  which points at one of this feature's active forms.
- **review-anonymity** — governs whether an *included* element's reviewer answer actually reaches
  the author (disclosure matrix); this spec only sets the per-element *included* flag.
- **workflow-settings / review-settings** — own the surrounding Review setup tab (default review
  mode, guidance, recommendations); Review Forms is a sibling tab, not part of that form.
- **email-templates-management** — owns the reviewer-comment email into which *included* element
  answers are composed (`ReviewerComments`).

## Canonical scenarios

1. **Build a form with mixed element types** — a manager creates "Peer Review" (title +
   instructions), then adds several elements: an *Extended text box* for narrative comments, a
   *Drop-down box* rating, and a *Checkboxes* list — ordering them by drag; each saves into the
   Form Items grid (live-verified: a dropdown element created, saved, and listed).
2. **Add a choice element with preset responses** — for the rating element the manager picks
   *Drop-down box*, and the **Response Options** listbuilder appears; they add "Excellent" /
   "Good" / "Poor" as multilingual rows and save; the preview renders a `<select>` with those
   options (live-verified end-to-end).
3. **Activate, and it appears at assignment** — the manager ticks the row's **Active** box
   (confirming the prompt); the form flips active and now shows in the editor's Add-Reviewer
   **Review Form** dropdown alongside "None / Free Form Review" (live-verified: `Probe Review
   Form A` listed after activation).
4. **Required / author-visibility flags** — the manager marks the narrative element *Reviewers
   required to complete item* and clears *Included in message to author* on an internal-only
   element; at review time the reviewer cannot submit without the required answer, and the
   editor-only element is withheld from the author copy (enforcement/display owned by
   `reviewer-response` / `review-anonymity`).
5. **In-use lock** — once a reviewer has been assigned the form and accepted, the form's grid row
   loses its **Edit** and **Delete** actions (In Review shows 1) and only **Copy** and
   **Preview** remain — the manager copies the form to make a revised version instead of editing
   the live one (live-verified: In Review = 1 → Copy + Preview only).
6. **Delete an unused form** — a manager deletes a never-assigned draft form via the row
   **Delete** action (confirming "Are you sure you wish to delete this review form?"); the form,
   its elements and settings are removed. An in-use form offers no Delete action, and a
   hand-crafted delete of an in-use form is refused server-side.
7. **Deactivate a form that is in use (deviation)** — although the activate warning promised
   otherwise, the manager can still deactivate a form that a reviewer is currently using; it
   drops out of *new* assignments while the in-flight review keeps it (live-verified: deactivated
   a form with In Review = 1). ⚠ see Known deviations.
8. **Permission boundary — manager only** — a section editor (or assistant/reviewer/author) has
   no Settings access and no Review Forms tab; a direct grid call is refused with "The current
   role does not have access to this operation." (live-verified: `dbuskins`).

## Known deviations (as-built ≠ intent)

- ⚠ **The activate confirmation over-promises: an in-use form CAN be deactivated.** The
  *activate* prompt reads "Are you sure you wish to activate this review form? Once it's assigned
  to a review you will no longer be able to deactivate it." — but `deactivateReviewForm()` has no
  in-use guard, the **Active** checkbox is never disabled, and (rule 6) the in-use lock only
  withdraws Edit/Delete, never the activate/deactivate toggle. Live-verified 2026-07-03:
  deactivating a form with In Review = 1 (a reviewer accepted with it attached) succeeded and
  removed it from the assignment dropdown, while the reviewer's assignment kept the form. This is
  a **UI affordance contradicting behaviour** (the message states a restriction the code doesn't
  enforce), though it loses no data. Suspected intent: either enforce the lock on deactivate (to
  match the promise) or soften the message. Recorded as `docs/e2e/app-changes.md` §2 **row 79**.
- **Correction to an existing ledger row (applied).** Ledger §2 row 17(b) (wave 5) stated
  `manager.reviewForms.confirmActivate`/`confirmDeactivate` "ship empty `msgstr`" so the confirm
  modals render with no text. That was **inaccurate**: both keys are non-empty **multi-line PO
  strings** (an empty first `msgstr ""` line followed by continuation lines — standard gettext
  folding), and both modals render full text live (rule 7 / the ⚠ above quote them verbatim). Row
  17(b) has been **retracted** in the ledger accordingly.

## Open questions

1. **Is deactivating an in-use form intended?** As-built the deactivate control stays live and
   functional on a form a reviewer is using, contradicting the activate warning (⚠ above). Should
   deactivate be blocked when In Review + Completed > 0 (matching the Edit/Delete lock and the
   message), or is deactivating-while-in-use deliberately allowed (with the message being the
   thing to fix)?
2. **Does "included = off" fully suppress an element from the author, given anonymity?** This
   spec sets the flag; the author-facing rendering (`reviewDownload.tpl authorFriendly`) and the
   reviewer-comment email honour it, but final disclosure also runs through `review-anonymity` /
   the editor's share action. Confirm the flag alone is the intended author-visibility control.
3. **Copy always yields an inactive duplicate with the same title.** No "(copy)" suffix or
   activate carry-over; two identically-titled forms can coexist (one active, one inactive).
   Intended convenience, or should the copy be disambiguated?

---

## Reference — entry points & surfaces

| Entry | Path | Atom |
|-------|------|------|
| Review Forms grid | Settings → Workflow → Review → **Review Forms** (`grid.settings.reviewForms.ReviewFormGridHandler`; ops fetchGrid/fetchRow/createReviewForm/editReviewForm/updateReviewForm/reviewFormBasics/reviewFormElements/copyReviewForm/reviewFormPreview/activateReviewForm/deactivateReviewForm/deleteReviewForm/saveSequence) | GRID-lib-pkp-grid-settings-review-forms-review-form-grid-handler |
| Form Items (elements) grid | Edit form → **Form Items** (`grid.settings.reviewForms.ReviewFormElementsGridHandler`; ops fetchGrid/fetchRow/saveSequence/createReviewFormElement/editReviewFormElement/updateReviewFormElement/deleteReviewFormElement) | GRID-lib-pkp-grid-settings-review-forms-review-form-elements-grid-handler |
| Possible-responses listbuilder | element form → **Response Options** (`listbuilder.settings.reviewForms.ReviewFormElementResponseItemListbuilderHandler`) | GRID-lib-pkp-listbuilder-settings-review-forms-review-form-element-response-item-listbuilder-handler |
| Review form entity | `review_forms` (+ `review_form_settings`) | DB-review_forms, DB-review_form_settings |
| Review form element entity | `review_form_elements` (+ `review_form_element_settings`) | DB-review_form_elements, DB-review_form_element_settings |
| Locale keys | `manager.reviewForms.*` (18) / `manager.reviewFormElements.*` (23) | LOC-manager-manager-reviewForms, LOC-manager-manager-reviewFormElements |

Seam (not claimed here): **DB-review_form_responses** — the reviewer's submitted answers, owned by
`reviewer-response` (it owns the write at submit; this spec owns the element structure those
responses key against).

## Reference — code anchors

- **Grid handlers**: `lib/pkp/controllers/grid/settings/reviewForms/ReviewFormGridHandler.php`
  (create/edit/copy/activate/deactivate/delete/preview, columns, ordering),
  `ReviewFormElementsGridHandler.php` (element create/edit/delete/order, `unusedReviewFormExists`
  guard), `ReviewFormGridRow.php` / `ReviewFormElementGridRow.php` (row actions; `$canEdit`),
  `ReviewFormGridCellProvider.php` (In Review / Completed counts, Active toggle link).
- **Forms**: `.../reviewForms/form/ReviewFormForm.php` (title/description; new = inactive),
  `ReviewFormElementForm.php` (question/description/required/included/type + listbuilder unpack),
  `PreviewReviewForm.php`.
- **Listbuilder**: `lib/pkp/controllers/listbuilder/settings/reviewForms/ReviewFormElementResponseItemListbuilderHandler.php`.
- **Entities / DAOs**: `lib/pkp/classes/reviewForm/` — `ReviewForm.php`, `ReviewFormDAO.php`
  (`getById`/`getByAssocId`/`getActiveByAssocId` with complete/incomplete count subqueries,
  `unusedReviewFormExists`, `deleteById`, `resequenceReviewForms`), `ReviewFormElement.php`
  (type constants, `getReviewFormElementTypeOptions`, `getMultipleResponsesElementTypes`),
  `ReviewFormElementDAO.php`.
- **Consumers (cross-feature)**: `lib/pkp/controllers/grid/users/reviewer/form/ReviewerForm.php`
  / `EditReviewForm.php` (assignment dropdown, `getActiveByAssocId`), OJS
  `controllers/grid/settings/sections/form/SectionForm.php` (section default),
  `lib/pkp/classes/mail/traits/ReviewerComments.php` + `reviewDownload.tpl` (`getIncluded`
  author-visibility).
- **Templates**: `lib/pkp/templates/manager/reviewForms/reviewFormElementForm.tpl` (element form +
  listbuilder trigger), `lib/pkp/templates/management/workflow.tpl` (tab mount),
  `controllers/grid/settings/reviewForms/editReviewForm.tpl` (Review Form / Form Items / Preview
  tabs).
- **Schema / migration**: `lib/pkp/classes/migration/install/ReviewFormsMigration.php`
  (`review_forms`, `review_form_settings`, `review_form_elements`, `review_form_element_settings`).
- **Locale**: `lib/pkp/locale/en/manager.po` (`manager.reviewForms.*`,
  `manager.reviewFormElements.*`; note `confirmActivate`/`confirmDeactivate` are multi-line PO
  strings, not empty).
