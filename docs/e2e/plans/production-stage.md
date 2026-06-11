# Production stage

- **Area:** 2. Editorial workflow
- **Placement:** lib/pkp
- **Budget:** 6 tests
- **Absorbs:** none
- **Scenario needs:** submission scenario — `decisions: [skipExternalReview, sendToProduction]` chain to land at WORKFLOW_STAGE_ID_PRODUCTION (sendToProduction also seeds the ASSIGN_PRODUCTIONUSER notification for assigned editors), `participants` with `layoutEditor` (gcox/shellier) and `proofreader` (cturner/skumar) roles, `submitter` override (atester). All met by the existing Processor — no GAP. Production-ready files are staged via UI by the layout-editor actor (one-off state, Principles §3).
- **Helpers:** file-stage grid/upload interactions live in the NEW `lib/pkp/playwright/pages/FileStagePanel.js` POM (owned by this plan pair with copyediting-stage); participant assignment reuses `ParticipantManagerPage` (stage-participants plan owns that POM).
- **Round 2 / out of scope:**
  - Galley CRUD, labels, ordering, remote URLs → `galleys` plan (ojs).
  - Schedule/publish preconditions, issue assignment, the actual publish → `publication-publish-flow` and `issue-assignment-scheduling` plans; this plan only verifies the handoff into the Publication tab. Schedule-for-Publication's updateType/summary fields → `publication-amendments`.
  - Proofreader-specific journey beyond participant access (proofreading discussions round-trip) — round 2.
  - Generic participant add/remove/notify mechanics → `stage-participants` plan.

UI realities encoded by the implementation (verified against live sources): the
back-to-copyediting button label is **"Move To Copyediting"**
(`editor.submission.decision.backToCopyediting`); the direct upload wizard is titled
**"Upload a Production Ready File"**; Download All serves a **zip**
(`{submissionId}-{nameLocaleKey}.zip`); the assign-galley-user → awaiting-galleys flip
requires the assignment's notify MESSAGE (it keys on the production-stage discussion the
message creates — a silent assignment doesn't flip it; app-changes.md §2); the editorial
config pushes the Schedule For Publication action button unconditionally, so assistants see
it too — row 3 asserts only the decision/Assign absences.

## Tests

| # | Title | Actors | Seed | Verifies | Status |
|---|-------|--------|------|----------|--------|
| 1 | Production status notification flips when a layout editor is assigned | dbarnes, gcox | scenario: draft + dbarnes editor + decisions [skipExternalReview, sendToProduction]; assignment via UI WITH a notify message (the flip keys on the discussion the message creates) | Production stage shows the "assign a user to create galleys" status notification; after assigning gcox (Layout Editor group) with a message via the Participants panel it flips to "Awaiting Galleys."; gcox sees the submission on their dashboard (Production stage bubble) | implemented (lib/pkp/playwright/tests/production-stage.spec.js) |
| 2 | Layout editor uploads a production-ready file | gcox, dbarnes | scenario: production-stage + gcox layoutEditor; upload via UI | gcox uploads a PDF to Production Ready Files via the direct upload wizard (genre pick, unique display name); dbarnes sees the row (name, date, Article Text type badge); Download All renders once a file exists and the zip archive download completes | implemented (lib/pkp/playwright/tests/production-stage.spec.js) |
| 3 | Layout editor sees production panels without editor controls | gcox | scenario: production-stage + gcox layoutEditor | Production stage renders Production Ready Files, Discussions and Participants panels for gcox; no "Move To Copyediting" decision button (no available decisions for assistants); no Assign button on the Participants panel (gated to manager/sub-editor/admin) | implemented (lib/pkp/playwright/tests/production-stage.spec.js) |
| 4 | Schedule For Publication hands off to the Publication tab | dbarnes | scenario: production-stage | The Schedule For Publication action button on the production stage navigates to the Publication tab (Title & Abstract panel heading); the Schedule For Publication publish entry button is present for the editor (publish flow itself covered by publication-publish-flow) | implemented (lib/pkp/playwright/tests/production-stage.spec.js) |
| 5 | Back to Copyediting returns the submission to copyediting | dbarnes | scenario: production-stage | "Move To Copyediting" decision (one notifyAuthors step) returns stageId to WORKFLOW_STAGE_ID_EDITING (REST); copyediting panels (Draft Files, Copyedited Files) render again; backFromProduction decision recorded in history alongside the original sendToProduction | implemented (lib/pkp/playwright/tests/production-stage.spec.js) |
| 6 | Author view of the production stage is discussion-only | atester | scenario: production-stage, submitter atester | atester's author view of the production stage shows the Discussions panel only — no Production Ready Files panel and no Participants panel (per workflowConfigAuthorOJS) | implemented (lib/pkp/playwright/tests/production-stage.spec.js) |
