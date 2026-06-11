# Discussions

- **Area:** 2. Editorial workflow
- **Placement:** lib/pkp
- **Budget:** 6 tests
- **Absorbs:** Absorbs (rework): playwright/tests/discussions/discussion-manager.spec.js (test 1 mixes the discussion CRUD arc with a task CRUD arc — split on absorption; task half goes to the `editorial-tasks` plan, test 2 is claimed there). Absorbs (rework): lib/pkp/playwright/tests/wizard-comments-become-discussion.spec.js — seeded-comments test only, owned here by row 5; the wizard end-to-end test belongs to submission-wizard-validation (currently flaky — commentsForTheEditors=null after Submit, see scenario audit §3 / commit e6ada638c5); neither validation row claims the spec as implemented anymore (split recorded per the N-test absorption rule).
- **Scenario needs:** submission scenario — draft fixture (default editor/section-editor cast), `commentsForEditor` + `submitted: true` (auto-creates the Stage 1 discussion via SubmissionSubmitted), `submitter` override (atester), `decisions: [skipExternalReview, sendToProduction]` for the stage-scoping row. All met — no GAP. Discussions themselves are created via UI: creation is the behavior under test or a one-line setup (Principles §3).
- **Round 2 / out of scope:**
  - Task-shaped items (due dates, start/complete, templates) → `editorial-tasks` plan.
  - Discussion file attachments (SaveNoteWithFiles surface) — round 2.
  - Email-log entries for discussion notifications (DISCUSSION_NOTIFY) → `email-delivery` plan.
  - Reviewer participation in discussions — round 2.

## Tests

| # | Title | Actors | Seed | Verifies | Status |
|---|-------|--------|------|----------|--------|
| 1 | Discussion CRUD arc on a stage panel | dbarnes | scenario: draft (default cast) | Create with participants + message → listed "In progress"; open shows message; reply; close → "Closed" group; reopen via row checkbox; edit title via row actions; delete after confirm. Absorbs (rework): playwright/tests/discussions/discussion-manager.spec.js (discussion half of test 1) | implemented (lib/pkp/playwright/tests/discussions.spec.js) |
| 2 | Discussions are stage-scoped | dbarnes | scenario: draft + decisions [skipExternalReview, sendToProduction] | Discussion created on the Production stage panel appears there; switching to the Copyediting stage panel does not list it (per-stage `stages/{stageId}/tasks` fetch); each stage starts with its own empty list | implemented (lib/pkp/playwright/tests/discussions.spec.js) |
| 3 | Discussion visibility is participant-scoped | dbarnes, dbuskins, minoue, admin | scenario: draft (default cast); discussion via UI | dbarnes creates a discussion adding only dbuskins: dbuskins sees it on their workflow view; minoue (stage participant, not discussion participant) does not; site admin/manager sees it (managers list all tasks) | implemented (lib/pkp/playwright/tests/discussions.spec.js) |
| 4 | Creating a discussion emails the added participants | dbarnes, dbuskins | scenario: draft; discussion via UI | Create discussion with dbuskins + a message carrying a unique marker → Mailpit assertion scoped to recipient (dbuskins) + marker finds the stage discussion mailable (DiscussionSubmission template at stage 1) containing the message body — no clearAll (Principles §8) | implemented (lib/pkp/playwright/tests/discussions.spec.js) |
| 5 | Wizard comments-for-the-editors surface as a Stage 1 discussion | dbarnes | scenario: draft + commentsForEditor + submitted | Submission stage panel lists the auto-created cover-note discussion "In progress"; opening it shows the seeded comment text; submitter and editors are participants. Absorbs (rework): lib/pkp/playwright/tests/wizard-comments-become-discussion.spec.js (seeded-comments test only — see Absorbs) | implemented (lib/pkp/playwright/tests/discussions.spec.js) |
| 6 | Author replies to a discussion from the author view | atester, dbarnes | scenario: draft, submitter atester, commentsForEditor + submitted | atester opens their own submission, sees the Stage 1 discussion on the author view, adds a reply; dbarnes sees the reply in the editorial view thread | implemented (lib/pkp/playwright/tests/discussions.spec.js) |
