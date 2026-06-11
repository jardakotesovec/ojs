# Submission wizard — validation

- **Area:** 1. Submission intake
- **Placement:** lib/pkp
- **Budget:** 10 tests
- **Absorbs:** `lib/pkp/playwright/tests/wizard-validation.spec.js` (1 test), `lib/pkp/playwright/tests/wizard-copyright-notice.spec.js` (2 tests), `lib/pkp/playwright/tests/wizard-section-rules.spec.js` (2 tests). `lib/pkp/playwright/tests/wizard-comments-become-discussion.spec.js` is NOT absorbed here: its seeded-comments test is owned by `plans/discussions.md` as Absorbs (rework); its wizard end-to-end test is a documented intermittent flake and backs no row anywhere until fixed (rows 6–7 below).
- **Scenario needs:** journal scenario with `copyrightNotice` and `sections` (incl. `editorRestricted`) passthroughs (existing); submission scenario `commentsForEditor` + `submitted` (existing); submission scenario `submitted: false` drafts (existing). Section inactivation has no scenario passthrough — flipped via the sections settings grid inside the test (existing pattern in wizard-section-rules.spec.js); one-off state, no GAP requested.
- **Round 2 / out of scope:**
  - Journal-without-privacy-statement variant (consent field absent) — needs a privacyStatement passthrough nobody else needs.
  - ORCID-required contributor validation (owned by `orcid` plan).
  - FR-locale validation rendering (owned by `submission-wizard-language` rows 2–3).
  - Require-mode metadata errors (owned by `submission-wizard-metadata` rows 5, 11).
  - Known flake: wizard-comments-become-discussion test 2 intermittently loses commentsForTheEditors after Submit (pre-existing, documented in scenario audit §3); tracked as a defect, not replanned here.

## Tests

| # | Title | Actors | Seed | Verifies | Status |
|---|-------|--------|------|----------|--------|
| 1 | Start form gating | atester | UI | Begin Submission blocked with per-field required errors while title, section, language, checklist confirmation or privacy consent are missing; completing them proceeds to step 1 | planned |
| 2 | Review-step required errors | dbarnes | UI | Empty title + missing Article Text file surface the errors banner and per-section errors at the Review step; restoring the title clears its field error | implemented (lib/pkp/playwright/tests/wizard-validation.spec.js) |
| 3 | Copyright consent gates submit | dbarnes | journal scenario (`copyrightNotice`) | Notice text renders on the confirm section; Submit stays disabled until the agreement checkbox is ticked; locale resolution proven in EN and FR | implemented (lib/pkp/playwright/tests/wizard-copyright-notice.spec.js) |
| 4 | Closed sections filtered from start form | dbarnes, atester | journal scenario + sections UI | Inactive section is pruned from the section radio; editor-restricted section is hidden from a plain author | implemented (lib/pkp/playwright/tests/wizard-section-rules.spec.js) |
| 5 | Section-closed edge cases | dbarnes, atester | journal scenario + sections UI; submission scenario (`submitted: false`) | Editor still sees an editor-restricted section in their own start form; resuming a draft whose section was closed meanwhile shows the sectionClosed error page with journal contact info | planned |
| 6 | Comments for the editors become a discussion (seeded parity) | dbarnes | submission scenario (`commentsForEditor`, submitted) | Seeded comments produce the stage-1 discussion exactly as a UI submit would. Note: the seeded-comments test of wizard-comments-become-discussion.spec.js is owned by plans/discussions.md as Absorbs (rework); the wizard end-to-end test is a documented intermittent flake (see docs/scenario-processor-audit.md §3, commentsForTheEditors=null after Submit) and must be fixed before it can back any row | planned |
| 7 | Comments entered in the wizard survive submit | dbarnes | UI | Comments typed into the For-the-Editors step persist through Submit and appear as the stage-1 discussion for the editor. Note: the seeded-comments test of wizard-comments-become-discussion.spec.js is owned by plans/discussions.md as Absorbs (rework); the wizard end-to-end test is a documented intermittent flake (see docs/scenario-processor-audit.md §3, commentsForTheEditors=null after Submit) and must be fixed before it can back any row | planned |
| 8 | Abstract requirement follows section rules | atester | UI (publicknowledge ART vs REV) | Articles section requires an abstract (review-step error when empty); Reviews (`abstractsNotRequired`) submits without one | planned |
| 9 | Abstract word limit | atester | submission scenario (`submitted: false`, ART) | Articles' 500-word limit shows the live word counter; over-limit abstract raises a review-step error; trimming clears it | planned |
| 10 | File genre must be resolved | atester | submission scenario (`submitted: false`) | Uploaded file without a component/genre shows the "what kind of file" prompt and is flagged at review until a genre is chosen | planned |
