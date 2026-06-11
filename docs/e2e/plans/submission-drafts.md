# Submission drafts

- **Area:** 1. Submission intake
- **Placement:** lib/pkp
- **Budget:** 6 tests
- **Absorbs:** none
- **Scenario needs:** submission scenario `submitted: false` (in-progress draft). NOTE: the pre-wave seed wrote a submitted-shaped row for `submitted: false` (`submission_progress=''`, `date_submitted` stamped, default `canChangeMetadata`); fixed during implementation to true wizard-draft parity — see the `submitted: false` audit fragment in `docs/scenario-processor-audit.md`. Mailpit fixture for the saved-for-later email (existing). No gaps.
- **Round 2 / out of scope:**
  - Admin/manager deleting another author's incomplete submission from the editorial dashboard (bulk-delete admin branch of useDashboardBulkDelete; rare janitorial flow).
  - Draft expiry / cleanup tooling (no in-app surface).
  - Saved-for-later email template editing (owned by `email-templates-management`).

## Tests

| # | Title | Actors | Seed | Verifies | Status |
|---|-------|--------|------|----------|--------|
| 1 | Save for later | atester | UI + Mailpit | "Save for Later" lands on the saved screen showing the account email; SubmissionSavedForLater email arrives with a resume link; following the link reopens the wizard on the draft | implemented (lib/pkp/playwright/tests/submission-drafts.spec.js) |
| 2 | Incomplete submissions view | atester | submission scenario (`submitted: false` ×2) | My-submissions dashboard "Incomplete submissions" view lists the drafts with incomplete status; the continue action resumes the wizard | implemented (lib/pkp/playwright/tests/submission-drafts.spec.js) |
| 3 | Draft persists across sessions | atester | submission scenario (`submitted: false`) + UI edits | Edits made in the wizard (details, files) are still present when the draft is reopened from a fresh browser context/login | implemented (lib/pkp/playwright/tests/submission-drafts.spec.js) |
| 4 | Cancel submission from the wizard | atester | submission scenario (`submitted: false`) | Cancel action confirms, lands on the "submission cancelled" screen, and the draft disappears from the incomplete list | implemented (lib/pkp/playwright/tests/submission-drafts.spec.js) |
| 5 | Delete incomplete drafts from the dashboard | atester | submission scenario (`submitted: false` ×2) | Author selects own incomplete drafts and bulk-deletes them (confirm dialog with incomplete.bulkDelete copy); list updates; submitted submissions offer no delete | implemented (lib/pkp/playwright/tests/submission-drafts.spec.js) |
| 6 | Abandoned wizard start becomes a draft | atester | UI | Starting a submission and navigating away without an explicit save still leaves an incomplete draft listed on the dashboard (start form persists the submission immediately) | implemented (lib/pkp/playwright/tests/submission-drafts.spec.js) |
