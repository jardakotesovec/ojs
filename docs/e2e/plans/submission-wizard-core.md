# Submission wizard — core

- **Area:** 1. Submission intake
- **Placement:** lib/pkp
- **Budget:** 14 tests
- **Absorbs:** none (`playwright/tests/submission.spec.js` is a 0-test fixme stub — superseded by this plan; delete during implementation)
- **Scenario needs:** submission scenario with `submitted: false` (in-progress draft, default Article Text file included — existing); journal scenario for scratch journals (existing). No gaps.
- **Round 2 / out of scope:**
  - Dropzone failure dictionary (file too big, invalid type, cancel upload) — config-driven, flake-prone.
  - beforeunload unsaved-changes prompt and disconnected-state banner (i18nDisconnected).
  - Custom guidance text configured through the settings UI (owned by `submission-settings` plan; row 8 here asserts only the shipped defaults render).
  - Journal "Submissions" about page content and checklist editing (owned by `submission-settings`).

## Tests

| # | Title | Actors | Seed | Verifies | Status |
|---|-------|--------|------|----------|--------|
| 1 | Begin Submission form surface | atester | UI | Start form (StartSubmissionPage) shows required title, section radios with policy reveal on selection, submission-language radios (en/fr_CA), checklist confirmation, privacy consent; completing it lands on wizard step 1 (Upload Files) | planned |
| 2 | Full happy path: submit and acknowledge | atester, dbarnes | UI + Mailpit | Author walks files (Article Text upload) → details → contributors → for-the-editors → reviewer suggestions (skippable, on by default) → review; confirm dialog; "Submission complete" screen with next-step links; submission acknowledgement email arrives for author; dbarnes finds the submission in the editorial dashboard with title/file intact | planned |
| 3 | Files step interactions | atester | submission scenario (`submitted: false`) | Dropzone upload of a primary Article Text with genre prompt; second file assigned a non-primary genre; rename file; delete file; dependent-file genres are not offered | planned |
| 4 | Details step entry and autosave | atester | submission scenario (`submitted: false`) | Title/subtitle/abstract entry; "last saved" autosave indicator appears; reloading the wizard restores the entered values | planned |
| 5 | Contributors step CRUD | atester | submission scenario (`submitted: false`) | Submitter pre-seeded as contributor; add a second contributor; edit; set primary contact; delete; review step reflects the final list | planned |
| 6 | Review step summaries and edit jump-back | atester | submission scenario (`submitted: false`) | Per-section summaries (files with genre, details, contributors, for-the-editors); each Edit control navigates back to the owning step with state intact | planned |
| 7 | Step navigation and page titles | atester | submission scenario (`submitted: false`) | Back/Continue walk; step menu navigation; page title follows `titleWithStep`; previously entered data retained when revisiting steps | planned |
| 8 | Default guidance copy renders per step | atester | submission scenario (`submitted: false`) | Each of the seven shipped help texts renders on its owning surface (context settings with `defaultLocaleKey` defaults — verified in `SubmissionGuidanceSettings.php`, `PKPSubmissionHandler.php`, `lib/pkp/schemas/context.json` + OJS `schemas/context.json`): `beginSubmissionHelp` (default.submission.step.beforeYouBegin) on the Begin Submission form; `uploadFilesHelp` (default.submission.step.uploadFiles) on Upload Files; `detailsHelp` (default.submission.step.details) on Details; `contributorsHelp` (default.submission.step.contributors) on Contributors; `forTheEditorsHelp` (default.submission.step.forTheEditors) on For the Editors; `reviewerSuggestionsHelp` (default.submission.step.reviewerSuggestions; OJS app schema) on Suggest Reviewers; `reviewHelp` (default.submission.step.review) on Review | planned |
| 9 | "Submit as" role picker for multi-role user | dbarnes | UI | User with several submitting roles sees the user-group radio on the start form; chosen role is recorded on the started submission | planned |
| 10 | Single-section journal hides section picker | dbarnes | journal scenario (scratch, default single Articles section) | Start form omits the section radio (hidden sectionId); started submission still targets that section | planned |
| 11 | Wizard routing by submission state | atester | submission scenario (one `submitted: false`, one `submitted: true`) | Wizard URL of an in-progress draft opens the wizard; wizard URL of a submitted submission shows the "Submission complete" screen with review/new-submission/dashboard links | planned |
| 12 | Wizard access control | atester, jjanssen | submission scenario (`submitted: false`, submitter atester) | A user with no stage assignment (jjanssen) is denied on the draft's wizard URL; the submitter retains access | planned |
| 13 | Confirm dialog cancel path | atester | submission scenario (`submitted: false`, file + metadata complete) | Submit opens the confirmation dialog (journal-name copy from getConfirmSubmitMessage); cancel returns to an editable wizard; confirming completes the submission | planned |
| 14 | Entry points route to the start form | atester | UI | Dashboard "New Submission" button and the journal front-end submission link both land on the Begin Submission form; anonymous visitor is sent through login first and returns | planned |
