# Copyediting stage

- **Area:** 2. Editorial workflow
- **Placement:** lib/pkp
- **Budget:** 8 tests
- **Absorbs:** lib/pkp/playwright/tests/decision-send-to-production.spec.js (row 6 — refit into copyediting-stage.spec.js; old spec deleted)
- **Scenario needs:** submission scenario — `participants` with `copyeditor` role (mfritz/svogt), `decisions: [skipExternalReview]` to land at WORKFLOW_STAGE_ID_EDITING, `sendToProduction`/`backFromCopyediting` decision types, `submitter` override (atester for author-view rows), default seeded Article Text file (used by the Upload/Select row). Row 2 needs `[sendExternalReview, accept]` instead — `skipExternalReview` never creates the assign-copyeditor notification (Decision\Repository::getSubmissionNotificationTypes only syncs it for ACCEPT/SEND_TO_PRODUCTION; recorded in app-changes.md §2). No GAP — copyedited-stage files are one-off states staged via UI by the copyeditor actor inside the test that needs them (Principles §3).
- **Helpers:** file-stage grid/upload interactions live in the NEW `lib/pkp/playwright/pages/FileStagePanel.js` POM (owned by this plan pair with production-stage); participant assignment reuses `ParticipantManagerPage` (stage-participants plan owns that POM).
- **Round 2 / out of scope:**
  - Galley creation from copyedited/production files → `galleys` plan.
  - Discussion CRUD mechanics on the copyediting panel → `discussions` plan (stage scoping covered there).
  - Generic add/remove/notify participant mechanics → `stage-participants` plan.
  - Email log tab assertions for decision emails → `email-delivery` plan.
  - Back-from-copyediting returning to a *review* stage (requires full review-round chain); round 1 covers the no-review variant only.

UI realities encoded by the implementation (verified against live sources): the Final Draft
Files panel renders as **"Draft Files"** (`submission.finalDraft`); the Copyedited Files
panel's Upload/Select dialog is titled **"Upload Review File"** with a stacked
**"Upload Copyedited File"** wizard; the Upload/Select grid defaults to the current stage —
the "Show files from all accessible workflow stages." filter reveals cross-stage files; the
back-from-copyediting button label is **"Move to Review"** even when no review round exists
and the decision returns the submission to the Submission stage (app-changes.md §2).

## Tests

| # | Title | Actors | Seed | Verifies | Status |
|---|-------|--------|------|----------|--------|
| 1 | Copyeditor opens an assigned copyediting-stage submission | mfritz | scenario: draft + participants (dbarnes editor, mfritz copyeditor) + decisions [skipExternalReview] | Submission appears in mfritz's dashboard (assigned-to-me, Copyediting stage bubble); copyediting stage renders Draft Files, Discussions, Copyedited Files and Participants panels; no Send To Production decision button (assistants get no available decisions) | implemented (lib/pkp/playwright/tests/copyediting-stage.spec.js) |
| 2 | Editing-status notification flips when a copyeditor is assigned | dbarnes | scenario: draft + dbarnes editor + decisions [sendExternalReview, accept] (skipExternalReview never seeds the notification — see Scenario needs); assignment via UI WITH a notify message (only PKPStageParticipantNotifyForm::sendMessage re-syncs the notification) | Workflow shows the "assign a copyeditor" status notification; after assigning mfritz (Copyeditor group) with a message via the Participants panel it flips to "Awaiting Copyedits." (PKPEditingProductionStatusNotificationManager) | implemented (lib/pkp/playwright/tests/copyediting-stage.spec.js) |
| 3 | Editor stages the final-draft file via Upload/Select | dbarnes | scenario: copyedit-stage (skipExternalReview); seeded Article Text file | "Upload/Select Files" on Draft Files opens the manage grid; the all-stages filter reveals the submission-stage default-article.pdf; selecting it adds the file to SUBMISSION_FILE_FINAL (REST) and it renders in the panel | implemented (lib/pkp/playwright/tests/copyediting-stage.spec.js) |
| 4 | Copyeditor uploads the copyedited file | mfritz, dbarnes | scenario: copyedit-stage + mfritz copyeditor; upload via UI | mfritz uploads a PDF into Copyedited Files via the stacked upload wizard (genre pick, unique display name); dbarnes sees the row (name, date, Article Text type badge); file download round-trips (200, pdf content-type); file at SUBMISSION_FILE_COPYEDIT via REST | implemented (lib/pkp/playwright/tests/copyediting-stage.spec.js) |
| 5 | Author check: author sees copyedited files read-only | atester, mfritz | scenario: copyedit-stage, submitter atester, mfritz copyeditor; mfritz uploads copyedited file via UI | atester's author view of the copyediting stage lists the copyedited file (FILE_LIST only — no Upload/Select control, no per-row More Actions, no Draft Files panel per COPYEDITED_FILES author permissions); author can download it | implemented (lib/pkp/playwright/tests/copyediting-stage.spec.js) |
| 6 | Editor sends a copyediting-stage submission to production | dbarnes | scenario: copyedit-stage (skipExternalReview) | Send To Production decision wizard (Continue → Record Decision); stageId flips to WORKFLOW_STAGE_ID_PRODUCTION via REST; decision row recorded | implemented (lib/pkp/playwright/tests/copyediting-stage.spec.js) |
| 7 | Send To Production promotes files and notifies the author (Mailpit) | dbarnes, mfritz | scenario: copyedit-stage, submitter atester, mfritz copyeditor; copyedited file staged via UI; decision via UI | Decision wizard's notify-authors step sends email with a unique marker in the message body; Mailpit assertion scoped to recipient (atester) + marker — no clearAll (Principles §8); the copyedited file listed on the promote step (selected by default) appears in Production Ready Files after the decision (UI + REST fileStage 11) | implemented (lib/pkp/playwright/tests/copyediting-stage.spec.js) |
| 8 | Back from Copyediting returns the submission | dbarnes | scenario: copyedit-stage (skipExternalReview — no review round) | "Move to Review" decision (one notifyAuthors step) returns the submission to the Submission stage (REST stageId=1); submission-stage decisions offered again; dashboard stage column reflects it; decision history retains both skipExternalReview and backFromCopyediting rows | implemented (lib/pkp/playwright/tests/copyediting-stage.spec.js) |
