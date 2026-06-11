# Categories

- **Area:** 6. Settings & administration
- **Placement:** lib/pkp (CategoryManager + wizard are shared; row 5 drives the OJS publication Issue tab, so its spec lands in the OJS tree)
- **Budget:** 5 tests
- **Absorbs:** lib/pkp/playwright/tests/categories.spec.js (all 3 tests → rows 1–3; sole owner — `submission-wizard-metadata` released its claim)
- **Scenario needs:** journal scenario endpoint with `submitWithCategories` passthrough and `categories` array (nested) — used by row 4 so the UI only drives edit/delete; `submission-published` fixture on publicknowledge for row 5 (category assignment is per-submission, so the shared journal stays read-only at the journal level; bootstrap seeds the category tree and enables `submitWithCategories`). No gaps.
- **Round 2 / out of scope:**
  - Category browse-page UX and the assignment→browse render (including the search-indexing caveat) — owned by `browse-category-section` (row 1); row 5 here stops at assignment persistence.
  - Category cover-image upload and per-category sort-order options — round 2.
  - Moving a category to a different parent after creation — round 2 (DnD/parent-change surface).
  - Wizard picker multi-select edge cases (select parent + child simultaneously) — round 2.

## Tests

| # | Title | Actors | Seed | Verifies | Status |
|---|-------|--------|------|----------|--------|
| 1 | Categories field hidden in the wizard by default | dbarnes | journal scenario | With `submitWithCategories` off and no categories, the wizard's For-the-Editors step renders no Categories field and the Review panel has no Categories item | implemented (lib/pkp/playwright/tests/categories.spec.js) |
| 2 | Enabling categories exposes the wizard field and selections persist | dbarnes | journal scenario (`submitWithCategories: true`) + UI category | Category created via the manager UI; wizard renders the Select Categories picker; selection survives to the Review panel (autosave round-trip) | implemented (lib/pkp/playwright/tests/categories.spec.js) |
| 3 | Nested hierarchy created and grandchild selectable with breadcrumb | dbarnes | journal scenario (`submitWithCategories: true`) + UI categories | Parent → child → grandchild + sibling created via More Actions > Add; tree indentation reflects depth; wizard Review panel renders the full "A > B > C" breadcrumb without leaking the sibling | implemented (lib/pkp/playwright/tests/categories.spec.js) |
| 4 | Manager edits and deletes a category | dbarnes | journal scenario (`categories` array seeds a small tree) | Edit renames a category and changes its path; tree updates; deleting a parent category **cascades**: the confirm dialog reports the sub-category count, and on confirm the parent and all its descendants are removed from the tree (verified: `Repo::category()->delete()` recursively deletes subcategories); deleted categories no longer offered in the wizard picker | planned |
| 5 | Category assigned via the publication tab persists | dbarnes | submission-published fixture (publicknowledge) | Editor assigns a bootstrap category on the publication's Issue tab; the assignment persists across reload and via the publication REST API (the category browse-page render + indexing caveat is owned by `browse-category-section` row 1) | planned |
