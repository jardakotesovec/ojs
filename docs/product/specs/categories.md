---
name: categories
scope: The journal manager's content-category taxonomy — a nestable tree of research-area categories (Settings → Journal → Categories, Vue manager) with per-category cover image, article sort preference and auto-assigned editors; exposed to authors in the wizard and to readers as category browse pages
shared: pkp-lib   # entity, schema, API controller, Vue manager and form all live in lib/pkp / lib/ui-library; OMP (its native catalog home) and OPS share them. OJS-specific is only what the referenced sibling specs own (reader catalog pages, Issue tab).
status: verified
e2e-plans: [categories, browse-category-section]
atlas-claims:
  - VUE-category-manager
  - FORM-category-form
  - SCHEMA-category
  - DB-categories
  - DB-category_settings
  - API-category-get-many
  - API-category-get-category-form-component
  - API-category-add
  - API-category-edit
  - API-category-delete
  - LOC-manager-manager-category
  - LOC-manager-grid-category
---

# Categories

## Purpose

Categories are the journal's **subject taxonomy**: a tree of research areas (*Applied Science →
Computer Science → Computer Vision*) that published articles can be filed under, orthogonal to
sections (every submission has exactly one section; categories are optional and many-per-article).
The manager builds and maintains the tree on **Settings → Journal → Categories** — a Vue table
manager (one of the few settings surfaces already off legacy grids) with an **Add Category** button,
per-row **Add / Edit / Delete Category** actions and expandable sub-category rows. A category
carries a display **name**, a URL **path** (its reader browse address), a rich-text **description**,
a **cover image**, an article **sort preference**, and **Editorial Assignments** — editors
auto-assigned to new submissions filed under the category (the category twin of section editors).
A fresh journal starts with **zero** categories (there is no default "Articles" analog; the seven
categories on the test seed's `publicknowledge` are seed data, not an install default). Defining at
least one category is what switches on every downstream surface: the wizard's author-facing picker
(when the journal opts in), the workflow Issue tab's Categories field, and the reader's category
browse pages.

## Actors & permissions

Baseline: the whole management surface — the Categories tab and **all five** API routes it drives —
is **journal manager + site admin only**, and every API write is scoped to the journal in context (a
category id from another journal answers "not found"). A section editor is bounced from the settings
page with *"The current role does not have access to this operation"* and gets 401 on the API
(live-verified); authors/reviewers/assistants have no path in. *Filing* a submission under a
category is a different capability with different owners (last two rows).

| Action | Who may — and when |
|--------|--------------------|
| **View / manage the Categories tab** | • Manager, site admin — any time (Settings → Journal → Categories)<br>• Section editor — never (settings page denies, API 401)<br>• Assistant, author, reviewer, anonymous — never <sup>a</sup> |
| **Create a category** (top level via *Add Category*; nested via a row's *Add* action) | • Manager, site admin — any time, any depth <sup>b</sup> |
| **Edit a category** (all fields incl. cover image and assigned editors) | • Manager, site admin — any time; ⚠ moving a category under a *different parent* is API-only — the edit form has no parent control (Known deviations) <sup>b</sup> |
| **Delete a category** (with all its sub-categories) | • Manager, site admin — any time, after a type-the-title confirmation; no emptiness guard (assigned publications are silently detached, unlike section delete) <sup>c</sup> |
| **Assign editors to a category** | • Manager, site admin — the *Editorial Assignments* checkboxes in the category form <sup>b</sup> |
| **File a submission under categories** | • Author — in the wizard's *For the Editors* step, only when the journal enables author category selection (owned by `submission-wizard-metadata`)<br>• Editorial roles — the workflow Issue tab's Categories field (owned by `publication-issue-assignment`) <sup>d</sup> |
| **Browse categories as a reader** | • Anyone — `/catalog/category/{path}` pages + Browse block (owned by `browse-category-section`) <sup>e</sup> |

<sup>a</sup> `CategoryCategoryController::getGroupRoutes()` (`roleAuthorizer([ROLE_ID_MANAGER, ROLE_ID_SITE_ADMIN])`), `authorize()` (`ContextAccessPolicy` + `CanAccessSettingsPolicy`); live 2026-07-06 scratch `cat1` — section editor: settings page denied + GET 401; author: GET/POST 401 ·
<sup>b</sup> `CategoryCategoryController::add()/edit()` → `saveCategory()`; `CategoryForm`; `categoryManagerStore` (`categoryAdd`/`categoryEdit`, row-action Add sets `?parentCategoryId={id}`) ·
<sup>c</sup> `CategoryCategoryController::delete()`; `Repo::category()->delete()` (recursive); `CategoryDeleteDialogBody.vue` (confirm button disabled until the typed name matches) ·
<sup>d</sup> `ForTheEditors::addCategoryField()` (`submitWithCategories` gate); `IssueEntryForm` `categoryIds` ·
<sup>e</sup> `PKPCatalogHandler::category()` — referenced, not owned

## Fields & validation

The Add/Edit Category side-modal (all captured live from the running form; Add and Edit render the
same fields — a row-action *Add* silently binds the new category to that row as parent):

| Field (UI label) | Required? | Rules | Anchor |
|------------------|-----------|-------|--------|
| Name | yes | Multilingual text; required in primary locale (an empty string is refused with an inline "This field is required."; ⚠ a payload that *omits* the field entirely slips through — API-only, row 138) | `title`; `CategoryForm` FieldText `isRequired`; `Repo::category()->validate()` |
| Path | yes | The category's URL slug; the form previews "The category's URL will be: …/catalog/category/path". Must be **unique within the journal** (refused: *"The category path already exists…"*; DB-unique per context) and match `a-zA-Z0-9/._-` (refused: *"…must consist of only letters and numbers."* — the message understates the allowed `/ . _ -`) | `path`; `Repository::CATEGORY_PATH_REGEX`, `validate()` path checks; `CategoriesMigration` unique `(context_id, path)` |
| Description | no | Multilingual rich text (bold/italic/super/subscript, link, blockquote, lists); shown on the reader category page | `description`; `CategoryForm` FieldPreparedContent |
| Order of articles ("Choose how to order articles in this category.") | no | Select: *Title (A-Z)*, *Title (Z-A)*, *Publication date (oldest first)*, *(newest first)*; defaults to newest-first; stored per category — ⚠ but **ignored by the OJS reader page** (row 103, rule 8) | `sortOption` (`title-ASC` … `datePublished-DESC`); `CategoryForm` FieldSelect; `Repo::submission()->getSortSelectOptions()/getDefaultSortOption()` |
| Cover Image | no | jpg/png/gif upload + **Alternate text**; a thumbnail is generated automatically (bounded by the journal's cover-thumbnail max width/height, default 100×100); replacing/removing deletes the old files | `image`; `CategoryForm` FieldUploadImage; `CategoryCategoryController::generateThumbnail()`; `Category::SUPPORTED_IMAGE_TYPES` |
| Editorial Assignments ("Select the editorial users who should be assigned automatically to all new submissions to this category.") | no | One checkbox per user ("Assign *name* as *role*") per assignable group — manager, section-editor and assistant role groups **with Submission-stage access** (the same candidate pool as section Editorial Assignments; with default groups: Editor, Section editor, Guest editor, Funding coordinator members) | `subEditors[{groupId}]`; `CategoryForm` (`Category::ASSIGNABLE_ROLES` × `withStageIds([WORKFLOW_STAGE_ID_SUBMISSION])`) |

Schema-required: `contextId`, `path`, `title` (`lib/pkp/schemas/category.json`; `parentId` is
nullable and **not** a form field — see rule 3).

## Rules & state

1. **A per-journal tree of unlimited depth.** Every category is either top-level or the child of
   exactly one parent category in the same journal; nesting depth is unconstrained (the seed's
   3-level *Applied Science → Computer Science → Computer Vision* renders and functions; the manager
   indents each level and shows an expand/collapse chevron only on rows that have children).
   Creating from a row's *Add* action makes a child of that row; the top *Add Category* button makes
   a top-level category. *(`Category::getParentId()`; `categories.parent_id` self-FK;
   `CategoryTreeRow.vue` recursion; live 2026-07-06 — 3-level publicknowledge tree expanded,
   child "Waves" created under Physics via row Add, `parent_id=17` in DB)*
2. **The tree is ordered alphabetically by name — there is no manual ordering.** At every level the
   manager, the API tree and downstream pickers list categories by localized title in the current UI
   locale (live: *Chemistry* before *Physics*). 3.6 **dropped** the old `seq` column and ships no
   reorder control. *(Collector::getQueryBuilder() `orderByRaw(COALESCE(title-setting) ASC)`;
   `I10404_UpdateCategoryImageNameFields` `dropColumn('seq')`; the DAO's leftover `'sequence'=>'seq'`
   mapping and its caller-less `resequenceCategories()` are dead code — see Known deviations)*
3. **Re-parenting is API-only, guarded against cycles.** The edit form offers no way to move a
   category; the API accepts `parentCategoryId` on PUT and refuses a parent that is the category
   itself or any of its descendants — *"A category cannot be its own parent or create a circular
   reference…"* (400, live-verified both shapes). Editing without `parentCategoryId` keeps the
   current parent. *(`CategoryCategoryController::saveCategory()`;
   `Repository::hasCircularReference()`; live 2026-07-06 — PUT 17 with parent 18 and with parent 17
   both → 400)*
4. **Path is the reader identity.** The path resolves the category's public browse page
   (`/catalog/category/{path}`); uniqueness is per journal (two journals may reuse a path — live:
   scratch and seed journals both use nested paths freely). Changing a path moves the reader page
   (old URL 404s — no redirect). *(rule 4 uniqueness anchors in Fields; `PKPCatalogHandler::category()`
   `filterByPaths` — owned by `browse-category-section`)*
5. **Every write is journal-scoped.** Editing or deleting a category id that belongs to another
   journal answers "resource not found" (live: PUT against a publicknowledge category id from the
   scratch journal's API → 404). *(`Repo::category()->get($id, $context->getId())`;
   `validate()` contextId cross-check)*
6. **The API reads the tree, not a flat list.** `GET /categories` returns top-level categories with
   their descendants nested under `subCategories` (no pagination); each node carries
   `assignedEditors` (id, name, initials, group ids) — what the manager's *Assigned To* column
   renders. *(`CategoryCategoryController::getMany()` `filterByParentIds([null])`;
   `category/maps/Schema::mapByProperties()` subCategories/assignedEditors)*
7. **Cover image lifecycle.** Upload accepts jpg/png/gif, stores the original as
   `{id}-category.{ext}` plus a generated `{id}-category-thumbnail.{ext}` in the journal's public
   files, records name/dimensions/alt text on the category, and deletes both files when the image is
   replaced or removed — or when the category is deleted. The reader-side `fullSize`/`thumbnail`
   serving is `browse-category-section`'s. *(`CategoryCategoryController::saveCategory()` image
   branch + `generateThumbnail()`; `Repository::delete()` image cleanup; live 2026-07-06 — PNG
   uploaded via the manager: DB image JSON + both files in `public/journals/222/`, both catalog ops
   200 `image/png`, reader page references the thumbnail)*
8. **⚠ The sort preference is stored but has no effect for OJS readers.** "Order of articles"
   round-trips faithfully (`sortOption`, default publication-date-newest) but the OJS category
   landing page computes and then discards it — readers get submission-id order (canonical home:
   `browse-category-section` rule 6, e2e ledger [§2 row 103](../../e2e/app-changes.md); its OQ3
   asks whether the control should exist in OJS at all).
9. **Category editors are auto-assigned at submit time — through the same broken filter as section
   editors.** Assigning editors writes rows keyed to the category
   (`subeditor_submission_group`, assoc-type category); when a submission whose publication carries
   category ids is **submitted**, those editors merge with the section's editors (deduped per
   user+group) and are stage-assigned with notification + email — the machinery and its side effects
   are documented once at `sections` rule 13. ⚠ **As-built the execution is dead everywhere but an
   install's first journal** — the same `$userGroups->keys()` id/index mix-up (e2e ledger
   [§2 row 135](../../e2e/app-changes.md)); the category leg was **independently live-confirmed**
   here through the real wizard: on scratch `cat1`, a category with a configured, in-group section
   editor + an author submitting through the wizard with that category selected → the editor was
   never assigned, both managers got the "editor assignment required" fallback task. Configuration
   (the *Assigned To* column, the DB rows) is intact; only submit-time routing dies.
   *(`SubEditorsDAO::assignEditors()` — single shared filter for the merged section+category
   assignments; `Repository::updateEditors()`; live 2026-07-06 — submission 509,
   `stage_assignments` = author only, 2× NOTIFICATION_TYPE_EDITOR_ASSIGNMENT_REQUIRED)*
10. **Delete is recursive, warned, and type-to-confirm.** Deleting a category opens *"Are you
    absolutely sure…?"* naming the category, warning it will remove **all N sub-categories**,
    unassign the category from submissions ("will not delete the submissions themselves"), and the
    red confirm button stays disabled until the manager types the exact category name. On confirm
    the category and its **whole subtree** are deleted (each with its cover files), every
    publication↔category link in the subtree is dropped (DB cascade — submissions and their
    published status untouched), the reader pages 404, and a "Category Deleted" summary reports the
    subtree count. Assigned-editor rows are *not* cleaned up (orphaned, invisible — ledger
    [§2 row 137](../../e2e/app-changes.md), same gap as sections). *(`Repository::delete()`
    recursion; `publication_categories` FK cascade; `CategoryDeleteDialogBody.vue`; live 2026-07-06 —
    Physics + 3 descendants deleted, join rows for a draft and a published article gone,
    `/catalog/category/optics` → 404, 2 subeditor rows orphaned)*
11. **Author exposure is opt-in; editorial exposure is automatic.** Authors see a *Categories*
    chip-picker ("Select Categories" checkbox tree, breadcrumb chips like *Physics > Optics*) in the
    wizard's For-the-Editors step **only when** the journal turns on the workflow-metadata Categories
    toggle (owned by `submission-wizard-metadata`); the selection persists to the draft's
    publication immediately (join rows exist pre-submit — live-verified). Editors always get the
    Issue tab's Categories field once the journal has categories (owned by
    `publication-issue-assignment`). *(`ForTheEditors::addCategoryField()`; live 2026-07-06 —
    scratch journal seeded `submitWithCategories`, wizard showed the picker with the seeded chip;
    `publication_categories` row present while still a draft)*
12. **⚠ A title-less API create bricks the manager.** A `POST /categories` that omits the `title`
    key entirely (not sendable from the UI form, which always posts the key — an empty string is
    properly refused) passes validation, inserts a broken category, 500s its own response, and from
    then on **every tree read — including the Categories tab itself — 500s** until the row is
    deleted by id. New e2e ledger [§2 row 138](../../e2e/app-changes.md). *(live 2026-07-06 —
    POST `{path:'notitle'}` → 500 + row created; GET → 500, tab empty; DELETE id → recovered)*
13. **One of the five API routes is dead.** `GET /categories/categoryFormComponent` is registered
    but its handler method does not exist — always 500, no frontend caller (the manager receives its
    form config from the settings page payload instead). New e2e ledger
    [§2 row 139](../../e2e/app-changes.md). *(`getGroupRoutes()`;
    `ManagementHandler::context()` `pageInitConfig.categoryForm`; live 2026-07-06 → 500
    "Method … does not exist")*

## Side effects

- **Category CRUD itself** sends no email, raises no notification, writes no event log. Saving
  shows a "Category saved" toast (and auto-expands the parent so a new child is visible); deleting
  shows the "Category Deleted" summary dialog. *(`categoryManagerStore` `categorySaved()`/
  `openCategoryDeletedDialog()`)*
- **Editing Editorial Assignments** rewrites the category's assignment rows (delete-then-insert,
  filtered to users actually holding an assignable role in the journal); existing stage assignments
  on past submissions are untouched. *(`Repository::updateEditors()`)*
- **On submission submit**, category-assigned editors ride the section-editor auto-assignment
  (stage assignment + "submission submitted" notification + *EditorAssigned* mail; manager fallback
  task + *SubmissionNeedsEditor* when nobody lands) — owned by `sections` rule 13, subject to row
  135 (rule 9 above).
- **Deleting** removes cover-image files from the journal's public directory (whole subtree) and
  cascades the subtree's `publication_categories` rows; `category_settings` cascade per category.
  *(`Repository::delete()`; `CategoriesMigration` FKs)*

## Settings that modify behavior

- **Workflow → Metadata → Categories toggle** (`submitWithCategories`, owned by
  `submission-wizard-metadata`): exposes the author picker in the wizard (rule 11). Off by default —
  categories are then editorial-only metadata.
- **Journal cover-thumbnail bounds** (`coverThumbnailsMaxWidth`/`coverThumbnailsMaxHeight`, journal
  appearance setup): cap the generated category thumbnail (rule 7; default 100×100).
- **Browse block enable + sidebar placement** (owned by `browse-category-section` /
  `website-appearance-settings`): whether readers get the category-tree sidebar.
- No config.inc.php vars or plugin toggles alter category behavior.

## Cross-feature interactions

- **browse-category-section** (feature 42, verified) — owns the reader surfaces this taxonomy
  projects onto: the `/catalog/category/{path}` landing pages, cover-image serving ops, the Browse
  sidebar block, and the row-103 sort-discard finding (rule 8 defers there). `DB-categories`
  ownership **transferred from that spec to this one** (it was interim-claimed there pending this
  spec; its Open question 2 is hereby resolved).
- **publication-issue-assignment** (feature 30, verified) — owns *assigning* categories to a
  publication on the Issue tab and the `DB-publication_categories` join atom; this spec owns the
  category entities being assigned (and verified the join rows cascade on category delete, rule 10).
- **submission-wizard-metadata** (feature 2, verified) — owns the wizard's Categories field and the
  Categories yes/no metadata setting; this spec owns the tree the picker offers (rule 11).
- **sections** (feature 62, verified) — the sibling taxonomy: shares the Editorial-Assignments
  candidate-pool rule, the `SubEditorsDAO` auto-assign machinery (its rule 13; row 135 — rule 9
  here confirms the category leg), and the orphaned-assignment-rows-on-delete gap (row 137).
- **stage-participants** — owns `DB-subeditor_submission_group`, the storage rules 9/10 read/write.
- **journal-masthead-settings** — owns `PAGE-management-settings-context`, the settings page hosting
  the Categories tab.

## Canonical scenarios

1. **Manager builds and edits the category tree** — Manager: opens Settings → Journal → Categories,
   creates a top-level category (Name + Path), uses a row's *More Actions → Add* to nest a child
   under it, expands the parent to see the child indented; rows list alphabetically at each level.
   Renaming and re-pathing via *Edit* updates the tree. A duplicate path is refused inline; a
   section editor requesting the tab or the API is denied. *(live 2026-07-06 on scratch `cat1` —
   all steps driven in the real manager UI + API probes.)*
2. **Author files a submission under a category and readers find it** — Author + anonymous reader:
   with author category selection enabled and a category tree defined, the wizard's For-the-Editors
   step shows the *Select Categories* picker; the picked category renders as a breadcrumb chip
   (*Physics > Optics*) and persists on the draft. Once the article is published (and indexed), the
   category's reader page `/catalog/category/{path}` lists it. *(live 2026-07-06 — wizard chip on
   draft 509; published probe article listed on `/cat1/catalog/category/optics`.)*
3. **Category assigned editors — configuration works, routing is dead (row 135)** — Manager +
   author: the manager ticks "Assign X as Section editor" on a category (the *Assigned To* column
   shows X; DB row written). An author submits a wizard submission filed under that category — X is
   **not** stage-assigned; the managers get the "editor assignment required" fallback task instead
   (on any journal but an install's first). The retained test should pin the *intended* routing once
   row 135 is fixed. *(live 2026-07-06 — the full wizard path on scratch `cat1`.)*
4. **Deleting a parent category is loud, typed, and total** — Manager: deletes a category that has
   sub-categories, an assigned editor and assigned publications; the dialog reports the sub-category
   count and demands the exact name be typed before the delete button enables; on confirm the whole
   subtree disappears from the manager, the publications lose (only) their category links, and the
   category's reader page 404s. *(live 2026-07-06 — Physics + 3 descendants, draft + published
   article detached, optics page 404.)*
5. **Cover image round-trip** — Manager: uploads a PNG with alt text in the category form; the
   image and an auto-thumbnail land in the journal's public files, and the reader category page
   shows the cover (thumbnail linking to full size). *(live 2026-07-06 — chem cover; serving ops
   owned by browse-category-section.)*

## Known deviations (as-built ≠ intent)

- ⚠ **Row 135 (category leg)** — category-editor auto-assignment at submit is dead on every journal
  after an install's first (rule 9); live-confirmed here through the real wizard. Canonical home:
  `sections` spec / ledger row 135 — this spec adds the category-leg evidence, no separate row.
- ⚠ **Row 138 (new)** — an API create that omits `title` inserts a broken category and 500-bricks
  the whole Categories manager and tree API until the row is deleted by id (rule 12). API-only
  trigger (the UI can't send it), management-surface-wide blast radius.
- ⚠ **Row 139 (new)** — `GET /categories/categoryFormComponent` is a registered route with no
  handler: always 500, zero callers (rule 13). Dead-route cleanup candidate; the atom is claimed
  here and flagged dead.
- ⚠ **Row 140 (new, cosmetic/a11y)** — the tree rows' expand/collapse button never updates its
  accessible label (always "Expand sub-categories", even when expanded): a `.value` misuse on a
  Boolean prop in `TableCellTreeExpand` **and** swapped label bindings in `CategoryTreeRow` cancel
  into a constant label; only the chevron icon reflects state.
- ⚠ **Row 103 (referenced, owned by browse-category-section)** — the "Order of articles" setting is
  offered and stored here but discarded by the OJS reader page (rule 8).
- **Row 137 (referenced)** — deleting a category orphans its `subeditor_submission_group` rows
  (live-confirmed here; evidence appended to the existing row). Data hygiene only.
- **(minor, not ⚠) Path error message understates the rule** — the "letters and numbers" refusal
  text omits that `/ . _ -` are also accepted (`CATEGORY_PATH_REGEX` vs `grid.category.pathAlphaNumeric`).
- **(minor, not ⚠) The Add-sub-category modal doesn't name the parent** — a row's *Add* action opens
  a modal titled just "Add Category" with no indication which category will be the parent; the
  parent only becomes visible after save (auto-expanded row). UX polish.
- **(dead code, no user impact)** `category/DAO::resequenceCategories()` has no callers, targets the
  `seq` column **dropped in 3.6** (`I10404`), and its parent-scope `where()` names the *value* as
  the column; the DAO's `'sequence' => 'seq'` mapping is equally vestigial. Cleanup candidate noted
  here rather than UNASSIGNED (it is code inside a claimed entity, not an atom).

## Open questions

1. **Should re-parenting be a UI capability?** The API fully supports moving a category
   (`parentCategoryId` on edit, with a circular-reference guard), but the form offers no parent
   control — managers must delete-and-recreate to restructure (losing assignments). Was the move UI
   deliberately deferred (round-1 e2e plan already parked "moving a category" as round-2) or is it
   missing?
2. **Is alphabetical-only ordering intended as final?** 3.6 dropped the manual `seq` ordering
   without adding any reorder affordance — sections kept drag-ordering, categories didn't. Confirm
   alphabetical-by-title is the intended contract (it also decides wizard-picker and Browse-block
   order).
3. **Should category delete require the same emptiness guard as sections?** Sections refuse deletion
   while any submission points at them; categories silently detach their publications (the dialog
   does warn). Deliberate asymmetry (categories are optional metadata) or drift?
4. **Assistant-role assigned editors:** `Category::ASSIGNABLE_ROLES` includes assistants (as does
   the section form), but the submit-time flow notifies/emails "editors" — are assistant
   auto-assignments intended to ride the same path? (Unobservable today behind row 135 on
   multi-journal installs.)

---

<!-- REFERENCE MATERIAL — provenance and campaign bookkeeping, not product-owner narrative. -->

## Reference — entry points & surfaces

| Entry | Path | Atom |
|-------|------|------|
| Categories tab (Vue manager) | Settings → Journal → Categories (`management/settings/context#categories`; `templates/management/context.tpl` `<category-manager v-bind="pageInitConfig">`) | VUE-category-manager |
| Category add/edit form | `CategoryForm` config delivered via `ManagementHandler::context()` `pageInitConfig.categoryForm`, posted to the API | FORM-category-form |
| Tree read API | `GET /api/v1/{context}/categories` (top-level + nested `subCategories`) | API-category-get-many |
| Create / edit / delete API | `POST /categories[?parentCategoryId]`, `PUT /categories/{id}[?parentCategoryId]`, `DELETE /categories/{id}` | API-category-add, API-category-edit, API-category-delete |
| Dead route (row 139) | `GET /categories/categoryFormComponent` — registered, no handler, always 500 | API-category-get-category-form-component *(dead route)* |
| Entity schema | `lib/pkp/schemas/category.json` | SCHEMA-category |
| Storage | `categories` (+ self-FK `parent_id`, unique `(context_id, path)`), `category_settings` | DB-categories, DB-category_settings |
| Locale | `manager.category.*` (manager/dialogs), `grid.category.*` (form labels/errors) | LOC-manager-manager-category, LOC-manager-grid-category |

Referenced, not claimed: `DB-publication_categories` (publication-issue-assignment),
`DB-subeditor_submission_group` (stage-participants), `PAGE-catalog-*` + `PLUGIN-blocks-browse`
(browse-category-section), `PAGE-management-settings-context` (journal-masthead-settings), wizard
atoms (submission-wizard-metadata).

## Reference — code anchors

- `lib/pkp/api/v1/categories/CategoryCategoryController.php` — all routes; `saveCategory()`
  (create/edit, parent resolution, circular guard, subEditors, image + `generateThumbnail()`)
- `lib/pkp/classes/category/{Category,DAO,Repository,Collector}.php` — entity (`ASSIGNABLE_ROLES`,
  `SUPPORTED_IMAGE_TYPES`), path regex + `validate()`, recursive `delete()`, `updateEditors()`,
  `hasCircularReference()`, title-ordered collector; `maps/Schema.php` (subCategories,
  assignedEditors)
- `lib/pkp/classes/components/forms/context/CategoryForm.php` — the form fields incl. the
  per-group Editorial-Assignments checkboxes
- `lib/ui-library/src/managers/CategoryManager/` — `CategoryManager.vue`, `categoryManagerStore.js`
  (add/edit/delete flows), `CategoryTreeRow.vue` (recursion, row 140),
  `CategoryDeleteDialogBody.vue` (type-to-confirm), `useCategoryManagerConfig.js` (columns/actions)
- `lib/pkp/pages/management/ManagementHandler.php` `context()` — form delivery;
  `templates/management/context.tpl` — the tab mount
- `lib/pkp/classes/migration/install/CategoriesMigration.php` — tables/FKs;
  `…upgrade/v3_6_0/I10404_UpdateCategoryImageNameFields.php` — the `seq` drop
- `lib/pkp/classes/context/SubEditorsDAO.php` `assignEditors()` — the shared (row-135) submit-time
  auto-assignment
- **Liveness (2026-07-06, port 8000, `ojs_test`, PostgreSQL, scratch journal `cat1`/context 222):**
  manager tree CRUD + nesting + alphabetical order + assigned-editor save all driven in the UI;
  API probes: duplicate path 400, bad chars 400, omitted title 500+brick (row 138), circular/self
  parent 400, cross-journal 404, formComponent 500 (row 139), author/section-editor 401;
  wizard chip + draft join row (submission 509); published article listed on
  `/cat1/catalog/category/optics`; row-135 category leg (stage_assignments author-only + 2×
  EDITOR_ASSIGNMENT_REQUIRED); recursive delete + cascade + orphaned subeditor rows + 404;
  cover PNG upload → files + both catalog ops 200. publicknowledge read-only (tree viewed only).

## Verification (2026-07-06, adversarial pass)

Verified on scratch journal `catv33157` (context 253, port 8000, `ojs_test`, PostgreSQL);
`publicknowledge` untouched (read-only category-id lookups only). Every rule and permission
claim survived; status → `verified`.

**Permission attacks refuted — categories is CLEAN (contrast nav-menus row 130).** The
controller runs BOTH a `MANAGER + SITE_ADMIN` role list AND `CanAccessSettingsPolicy`
(`authorize()`), so there is no API-admits hole. Live: section editor (`dbuskins`) AND
assistant (`mfritz`) each got **401 on all four routes** — GET, POST, PUT, DELETE (not just
read). No sub-editor/assistant write path exists. Cross-context write refuted: PUT of a
`publicknowledge` category id from the scratch journal → 404; re-parenting under a foreign
journal's category → 404 (parent lookup is context-scoped). (Permission table + rule 5 hold.)

**Nesting/cycle guard airtight (rule 3).** Re-parenting refused 400 for self-parent, for a
direct child, AND for a **grandchild** (deep-chain cycle) — `hasCircularReference()` walks the
whole ancestor chain, not just the immediate parent. Re-parenting is API-only (no form control),
confirmed.

**Rows 138/139/140 re-verified.** Row 139: `GET /categories/categoryFormComponent` → 500
"Method … does not exist" (dead route, no caller) — **LOW stands**. Row 140: label-constant
a11y defect confirmed by code (`.value` on a Boolean prop + swapped label bindings) — **LOW
(cosmetic) stands**. Row 138: titleless POST → 500 + persisted broken row → every tree GET
(incl. the tab) 500s → DELETE-by-id recovers — reproduced exactly (row 78 on this journal).
**Bounded and re-calibrated MEDIUM:** `title` is the *only* omitted-required-prop that persists
a bricking row; omitting `path` also bypasses the same validation gap but 500s at `setPath()`
*before* insert (transient, no row, tree GET stays healthy); an empty-string title is a clean
400 (the only shape the UI can send). Trigger is API-only, blast radius is the whole management
surface until manual cleanup — **MEDIUM confirmed** (denial-of-feature, no data loss). Bound
appended to ledger row 138.

**Row-135 category leg spot-confirmed (rule 9).** `SubEditorsDAO::assignEditors()` MERGES the
category assignments (`getBySubmissionGroupIds(categoryIds, ASSOC_TYPE_CATEGORY)`) into the same
`$assignments` collection as the section assignments and applies the identical faulty
`$userGroups->keys()` filter to both — there is no separate category-specific assignment code
that could work. The retained test proves the dead routing live; no re-drive needed.

**Wizard exposure model confirmed (rule 11).** `ForTheEditors::addCategoryField()` returns early
unless `submitWithCategories` is on AND ≥1 category exists — the author picker is opt-in, off by
default, exactly as specified (no always-on path).

**Cover upload is type-enforced — categories does NOT share the website-appearance gap.**
`Repository::validate()` checks the uploaded file's MIME-derived extension against
`SUPPORTED_IMAGE_TYPES` (jpg/png/gif) AND runs `getimagesize()` with positive-dimension
guards; a `.php`/`.svg` masquerading as an image is refused server-side (`form.invalidImage`).
(Rule 7 / Fields table stand.)

**Path edge cases (minor observations, no spec change).** Path uniqueness is **case-sensitive**
(`achem` and `AChem` coexist as distinct categories — Postgres exact match). The regex admits
`/` so a slashed path (`foo/bar`) is accepted by create but would not resolve as a single-segment
`/catalog/category/{path}` reader page — a latent dead-page edge owned by `browse-category-section`
(the spec already flags the error message understating `/ . _ -`). Ties in the alphabetical order
have no id tiebreaker (`orderByRaw` on title only) — unstable relative order for identical titles;
ordering is by the **current UI request locale** (`Locale::getLocale()`), missing-locale titles
sort last. None rise to ⚠.

**Atom/seam audit clean.** All 12 claims single-owner in the sweeps. `DB-categories` transfer
from browse-category-section (42) is complete — 42's frontmatter comments it out with a transfer
note; the db-entities sweep names `categories` as sole owner. `DB-publication_categories` stays
with publication-issue-assignment (30) — listed here only as Referenced. The dead
`API-category-get-category-form-component` route is claimed + flagged dead in the API sweep.
Scratch journal `catv33157` (253) remains; `publicknowledge` never mutated.
