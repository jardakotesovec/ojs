# Editor metadata editing

- **Area:** 2. Editorial workflow
- **Placement:** lib/pkp
- **Budget:** 6 tests
- **Absorbs:** lib/pkp/playwright/tests/publication-metadata-editing.spec.js — title/abstract/keywords test only (row 1); its contributor test is owned by the contributors plan row 1 (split per the N-test absorption rule). Also: lib/pkp/playwright/tests/section-editor-metadata.spec.js, lib/pkp/playwright/tests/author-edit-published.spec.js
- **Scenario needs:** submission-in-review, submission-published and submission-draft fixtures with `participants[].canChangeMetadata` (existing); author-only user `atester` (existing baseline). No gaps.
- **Round 2 / out of scope:**
  - Published-publication edit lock (`WorkflowPublicationEditWarning`) and edit-via-new-version — owned by the publication-versioning plan.
  - Field-specific coverage of the Permissions and Issue panels — deliberately excluded in the absorbed spec (same `pkpForm` save infrastructure proven by Title & Abstract; copyright/issue field types covered by wizard-copyright, wizard-config and publish-flow plans). Reopen only on regression.
  - Front-end re-render of edited metadata on the article page — publication-publish-flow plan.
  - Contributor ordering/primary-contact — contributors plan.

## Tests

| # | Title | Actors | Seed | Verifies | Status |
|---|-------|--------|------|----------|--------|
| 1 | Editor updates title, abstract and keywords; changes persist | dbarnes | submission-in-review fixture | Title & Abstract (TinyMCE) and Metadata (keyword autosuggest) panels save with toast; values round-trip via publications API and re-render after reload | implemented (lib/pkp/playwright/tests/publication-metadata-editing.spec.js) |
| 2 | Editor adds a contributor via the Contributors panel | dbarnes | submission-in-review fixture | Add Contributor modal saves (multilingual name, email, country, required contributor role); new contributor appears in the manager list and in the publication's authors via API | planned |
| 3 | Section editor with canChangeMetadata=false gets read-only publication panels | minoue | submission-published fixture (participants: dbarnes editor; minoue sectionEditor `canChangeMetadata:false`) | Title & Abstract Save button renders disabled — `canEditPublication` gate via stage assignment | implemented (lib/pkp/playwright/tests/section-editor-metadata.spec.js) |
| 4 | Section editor with canChangeMetadata=true can save | minoue | submission-published fixture (minoue sectionEditor `canChangeMetadata:true`) | Same panel renders an enabled Save for the permitted section editor | implemented (lib/pkp/playwright/tests/section-editor-metadata.spec.js) |
| 5 | Author default cannot edit publication metadata | atester | submission-draft fixture (submitter atester, dbarnes editor) | Author's mySubmissions workflow view shows disabled Save on Title & Abstract — default Author group `permitMetadataEdit=false` flows through `canEditPublication` | implemented (lib/pkp/playwright/tests/author-edit-published.spec.js) |
| 6 | Author granted canChangeMetadata=true can edit | atester | submission-draft fixture (atester participant with `canChangeMetadata:true`) | Same surface becomes editable when the author's stage assignment grants metadata editing | implemented (lib/pkp/playwright/tests/author-edit-published.spec.js) |
