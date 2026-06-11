# Sections

- **Area:** 6. Settings & administration
- **Placement:** ojs (sections grid + `SectionGridHandler` are OJS-specific)
- **Budget:** 6 tests
- **Absorbs:** playwright/tests/sections.spec.js
- **Scenario needs:** journal scenario endpoint (scratch journal, `users`); its `sections` array (abbrev/title/wordCount/identifyType/abstractsNotRequired/editorRestricted/sectionEditors) pre-seeds the multi-section state for row 6 so the UI only drives reorder/delete. Section CRUD itself goes through the grid UI — the surface under test. No gaps.
- **Round 2 / out of scope:**
  - Wizard-side effects of inactive and editor-restricted sections (section hidden/blocked in the submission wizard) — owned by `submission-wizard-validation`, which absorbs lib/pkp/playwright/tests/wizard-section-rules.spec.js. Rows 2 and 3 here own the admin-side persistence half only; do not duplicate the wizard assertions.
  - Section policy/abstract-word-limit enforcement during submission (500-word counter) — submission-wizard territory.
  - Front-end section policy display on browse pages — owned by `browse-category-section`.
  - Per-issue custom TOC section ordering — owned by `issue-management`.

## Tests

| # | Title | Actors | Seed | Verifies | Status |
|---|-------|--------|------|----------|--------|
| 1 | Manager creates a new section | dbarnes | journal scenario | Create Section form saves title + abbreviation; new row appears in the sections grid | implemented (playwright/tests/sections.spec.js) |
| 2 | Manager deactivates a section and the flag persists | dbarnes | journal scenario + UI (second section first — last-active guard) | Cannot deactivate the only active section (validator); after adding a second section, `isInactive` saves and persists across reload (wizard-side hiding owned by submission-wizard-validation) | implemented (playwright/tests/sections.spec.js) |
| 3 | Manager marks a section editor-restricted and the flag persists | dbarnes | journal scenario | `editorRestricted` checkbox saves and persists across reload (wizard-side blocking owned by submission-wizard-validation) | implemented (playwright/tests/sections.spec.js) |
| 4 | Manager configures section fields and they persist | dbarnes | journal scenario | `wordCount`, multilingual `identifyType`, and `abstractsNotRequired` save, persist across reload, and match via the sections REST API | implemented (playwright/tests/sections.spec.js) |
| 5 | Manager assigns multiple section editors | dbarnes | journal scenario (extra sectionEditor users) | Three editor candidates render in the assignment list; all three assignments save and persist across reload | implemented (playwright/tests/sections.spec.js) |
| 6 | Manager reorders sections and deletes an empty one; delete guards hold | dbarnes | journal scenario (`sections` array seeds 3 sections; 1 with a submission via submission scenario) | Grid reorder (`saveSequence`) persists across reload and the submission wizard's section choices follow the new order; deleting an empty section removes it; deleting a section with submissions is refused with the alert; last-active-section delete is refused | planned |
