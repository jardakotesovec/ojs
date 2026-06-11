# Submission settings

- **Area:** 6. Settings & administration
- **Placement:** lib/pkp
- **Budget:** 3 tests
- **Absorbs:** none — playwright/tests/wizard-config-reset.spec.js is owned entirely by `submission-wizard-metadata`, which covers the settings→wizard effects (required asterisk, removed field, Review-step validation). The pure settings-form persistence row this plan held was dropped in adversarial review (pure form persistence with no user-visible effect beyond the wizard rows owned elsewhere).
- **Scenario needs:** scratch journal via `POST /api/v1/_test/scenarios/journal` with `users` passthrough (dbarnes as manager). All settings mutations are the behavior under test, so they are driven through the UI — no new Processor capability needed.
- **Round 2 / out of scope:**
  - Per-field sweep of all metadata toggles (agencies/coverage/type/rights/source/citations/dataAvailability) — the FieldMetadataSetting settings→wizard wiring (including representative fields) is owned by `submission-wizard-metadata`.
  - Contributor Roles tab (CRediT-style role manager) — niche config, round 2.
  - Genre ordering (saveSequence) and per-genre dependent/supplementary flags.
  - Publisher Library tab (covered implicitly by submission-files round 2 if needed).
  - Workflow > Emails tab (signature etc.) — owned by `email-delivery`.

## Tests

| # | Title | Actors | Seed | Verifies | Status |
|---|-------|--------|------|----------|--------|
| 1 | Submission guidance texts surface to authors | dbarnes | scenario: scratch journal | Workflow > Submission > Instructions: set authorGuidelines, submissionChecklist and beginSubmissionHelp, save → public `about/submissions` page renders guidelines + checklist text; wizard start step shows the custom before-you-begin help (`StartSubmission` description). | planned |
| 2 | Custom file component appears in wizard upload choices | dbarnes | scenario: scratch journal | Workflow > Submission > Components: add a custom genre via the grid modal, reload → genre listed; start a submission → upload step's file-kind options include the custom genre; delete it from the grid → gone from grid. (Upload mechanics themselves live in `submission-wizard-core`.) | planned |
| 3 | Disable submissions blocks new submissions journal-wide | dbarnes | scenario: scratch journal | Workflow > Submission > Disable Submissions: tick the toggle, save → settings pages show the "not accepting submissions" notification banner; public `about/submissions` shows the not-accepting message; the "Make a New Submission" link disappears from the front end/dashboard entry points. Untoggle → submission entry points return. | planned |
