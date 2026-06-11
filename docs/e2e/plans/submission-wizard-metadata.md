# Submission wizard — metadata

- **Area:** 1. Submission intake
- **Placement:** lib/pkp
- **Absorbs:** `playwright/tests/wizard-config-reset.spec.js` (ALL 4 tests — `submission-settings` dropped its claim; charter-compliant — scratch journals via Metadata settings UI; relocate/refit under this feature's spec name at implementation. Test↔row map verified against the spec: test 1 "keywords Require → required marker" → row 5; test 2 "keywords Do-not-ask removed" → row 7; test 3 "subjects Require in For-the-Editors" → row 8; test 4 "missing required keyword surfaces a validation error in Review" → row 6 — note: the Review-step error test is keywords-based; subjects-as-Require is test 3, marker-only), `lib/pkp/playwright/tests/data-availability.spec.js` (2 tests). `lib/pkp/playwright/tests/categories.spec.js` is owned by `plans/categories.md`, not absorbed here.
- **Budget:** 13 tests
- **Scenario needs:** journal scenario scratch journals (existing); journal scenario `categories` passthrough (existing); submission scenario `submitted: false` drafts on publicknowledge (existing). Metadata request/require toggles are flipped through the Workflow → Submission → Metadata settings form on scratch journals — the established pattern from wizard-config-reset.spec.js; deliberately **not** requesting a context-scenario passthrough for the ten metadata flags (settings-UI drive doubles as coverage of the config surface, and the flags are a per-journal one-time setup inside each test).
- **Round 2 / out of scope:**
  - rights/source request/require variants (same FieldMetadataSetting plumbing as rows 5–8; no distinct wizard surface).
  - Controlled-vocab autosuggest offering entries from prior submissions (cross-submission state; brittle in parallel runs).
  - languages metadata field (rarely enabled; same plumbing).
  - Data-availability anonymization during review (belongs to `review-anonymity`).

## Tests

| # | Title | Actors | Seed | Verifies | Status |
|---|-------|--------|------|----------|--------|
| 1 | Keywords entry (request-on default) | atester | submission scenario (`submitted: false`) | Details step shows optional Keywords field per new publicknowledge default; chips persist across save; appear on review step and post-submit in the publication metadata | planned |
| 2 | Citations entry (request-on default) | atester | submission scenario (`submitted: false`) | Citations textarea in Details step per new default; pasted references persist and appear on the review step | planned |
| 3 | Categories selection persists | atester | submission scenario (`submitted: false`) | For-the-Editors categories field lists category breadcrumbs (incl. nested); selection persists and shows on review step. Note: categories.spec.js owned by plans/categories.md — this row needs its own implementation | planned |
| 4 | Categories config gate | dbarnes | journal scenario (scratch) | Field absent when submitWithCategories off or journal has no categories; enabling the setting exposes the field. Note: categories.spec.js owned by plans/categories.md — this row needs its own implementation | planned |
| 5 | Keywords require mode renders required marker | dbarnes | journal scenario + settings UI | Require flag renders Keywords with the required marker in the Details step (spec test 1) | implemented (playwright/tests/wizard-config-reset.spec.js) |
| 6 | Missing required keyword blocks at Review | dbarnes | journal scenario + settings UI | With Keywords on Require and left empty, the Review step shows the errors banner and "This field is required." against Keywords in the Details review panel (spec test 4) | implemented (playwright/tests/wizard-config-reset.spec.js) |
| 7 | Keywords disabled | dbarnes | journal scenario + settings UI | "Do not ask" removes the Keywords field from the Details step entirely (spec test 2) | implemented (playwright/tests/wizard-config-reset.spec.js) |
| 8 | Subjects require in For-the-Editors | dbarnes | journal scenario + settings UI | Subjects renders as required inside the For-the-Editors metadata form — proves the setting wiring across both host forms (spec test 3) | implemented (playwright/tests/wizard-config-reset.spec.js) |
| 9 | Disciplines, agencies, coverage, type request-on | dbarnes | journal scenario + settings UI | All four off-by-default fields render in For-the-Editors once requested; entered values persist and appear on the review step | planned |
| 10 | Data availability statement | dbarnes | journal scenario + settings UI; submission scenario (published) | Enabled field renders and persists in the wizard; statement renders on the published article page | implemented (lib/pkp/playwright/tests/data-availability.spec.js) |
| 11 | Empty metadata form omitted | dbarnes | journal scenario (vanilla scratch) | With no optional metadata enabled, For-the-Editors shows only the comments form — the metadata section is omitted (`count($metadataForm->fields)` gate) | planned |
| 12 | Citations require mode blocks submit | dbarnes | journal scenario + settings UI | Citations set to require: empty references produce a review-step error; providing them clears the error and submit proceeds | planned |
| 13 | Request mode never blocks submit | atester | UI (publicknowledge) | Keywords/citations/categories left empty on the shared journal's request-on defaults do not produce errors or block submission | planned |
