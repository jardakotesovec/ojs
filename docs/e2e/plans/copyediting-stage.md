# Copyediting stage

- **Area:** 2. Editorial workflow
- **Placement:** lib/pkp
- **Budget:** 8 tests
- **Absorbs:** lib/pkp/playwright/tests/decision-send-to-production.spec.js (row 6)
- **Scenario needs:** submission scenario — `participants` with `copyeditor` role (mfritz/svogt), `decisions: [skipExternalReview]` to land at WORKFLOW_STAGE_ID_EDITING, `sendToProduction`/`backFromCopyediting` decision types, `submitter` override (atester for author-view rows), default seeded Article Text file (used by the Upload/Select row). No GAP — copyedited-stage files are one-off states staged via UI by the copyeditor actor inside the test that needs them (Principles §3).
- **Round 2 / out of scope:**
  - Galley creation from copyedited/production files → `galleys` plan.
  - Discussion CRUD mechanics on the copyediting panel → `discussions` plan (stage scoping covered there).
  - Generic add/remove/notify participant mechanics → `stage-participants` plan.
  - Email log tab assertions for decision emails → `email-delivery` plan.
  - Back-from-copyediting returning to a *review* stage (requires full review-round chain); round 1 covers the no-review variant only.

## Tests

| # | Title | Actors | Seed | Verifies | Status |
|---|-------|--------|------|----------|--------|
| 1 | Copyeditor opens an assigned copyediting-stage submission | mfritz | scenario: draft + participants (dbarnes editor, mfritz copyeditor) + decisions [skipExternalReview] | Submission appears in mfritz's dashboard; copyediting stage renders Final Draft Files, Discussions, Copyedited files and Participants panels; no Send To Production decision button (assistants get no available decisions) | planned |
| 2 | Editing-status notification flips when a copyeditor is assigned | dbarnes | scenario: draft + dbarnes editor + decisions [skipExternalReview]; assignment via UI | Workflow shows the "assign a copyeditor" status notification; after assigning mfritz (Copyeditor group) via the Participants panel it flips to "awaiting copyedits" (PKPEditingProductionStatusNotificationManager) | planned |
| 3 | Editor stages the final-draft file via Upload/Select | dbarnes | scenario: copyedit-stage (skipExternalReview); seeded Article Text file | "Upload/Select Files" on Final Draft Files lists the submission-stage Article Text; selecting it adds the file to Final Draft Files (SUBMISSION_FILE_FINAL) and it renders in the panel | planned |
| 4 | Copyeditor uploads the copyedited file | mfritz, dbarnes | scenario: copyedit-stage + mfritz copyeditor; upload via UI | mfritz uploads a PDF into Copyedited files via the upload wizard (genre pick); dbarnes sees the row (name, date, type); file download round-trips | planned |
| 5 | Author check: author sees copyedited files read-only | atester, mfritz | scenario: copyedit-stage, submitter atester, mfritz copyeditor; mfritz uploads copyedited file via UI | atester's author view of the copyediting stage lists the copyedited file (FILE_LIST only — no Upload/Edit/Delete controls per COPYEDITED_FILES author permissions); author can download it | planned |
| 6 | Editor sends a copyediting-stage submission to production | dbarnes | scenario: copyedit-stage (skipExternalReview) | Send To Production decision wizard (Continue → Record Decision); stageId flips to WORKFLOW_STAGE_ID_PRODUCTION via REST; decision row recorded | implemented (lib/pkp/playwright/tests/decision-send-to-production.spec.js) |
| 7 | Send To Production promotes files and notifies the author (Mailpit) | dbarnes | scenario: copyedit-stage, submitter atester; copyedited file staged via UI; decision via UI | Decision wizard's notify-authors step sends email with a unique marker in the message body; Mailpit assertion scoped to recipient (atester) + marker — no clearAll (Principles §8); the copyedited file selected on the promote step appears in Production Ready Files after the decision | planned |
| 8 | Back from Copyediting returns the submission | dbarnes | scenario: copyedit-stage (skipExternalReview — no review round) | Back-from-copyediting decision returns the submission to the Submission stage; stage indicator and dashboard stage column reflect it; copyediting decision history retained | planned |
