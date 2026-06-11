# Production stage

- **Area:** 2. Editorial workflow
- **Placement:** lib/pkp
- **Budget:** 6 tests
- **Absorbs:** none
- **Scenario needs:** submission scenario — `decisions: [skipExternalReview, sendToProduction]` chain to land at WORKFLOW_STAGE_ID_PRODUCTION, `participants` with `layoutEditor` (gcox/shellier) and `proofreader` (cturner/skumar) roles, `submitter` override (atester). All met by the existing Processor — no GAP. Production-ready files are staged via UI by the layout-editor actor (one-off state, Principles §3).
- **Round 2 / out of scope:**
  - Galley CRUD, labels, ordering, remote URLs → `galleys` plan (ojs).
  - Schedule/publish preconditions, issue assignment, the actual publish → `publication-publish-flow` and `issue-assignment-scheduling` plans; this plan only verifies the handoff into the Publication tab.
  - Proofreader-specific journey beyond participant access (proofreading discussions round-trip) — round 2.
  - Generic participant add/remove/notify mechanics → `stage-participants` plan.

## Tests

| # | Title | Actors | Seed | Verifies | Status |
|---|-------|--------|------|----------|--------|
| 1 | Production status notification flips when a layout editor is assigned | dbarnes, gcox | scenario: draft + dbarnes editor + decisions [skipExternalReview, sendToProduction]; assignment via UI | Production stage shows the "assign a user to create galleys" status notification; after assigning gcox (Layout Editor group) via the Participants panel it flips to the awaiting-galleys notification; gcox sees the submission on their dashboard | planned |
| 2 | Layout editor uploads a production-ready file | gcox, dbarnes | scenario: production-stage + gcox layoutEditor; upload via UI | gcox uploads a PDF to Production Ready Files via the upload wizard; dbarnes sees the row (name, date, type); Download All renders once a file exists and the archive download responds OK | planned |
| 3 | Layout editor sees production panels without editor controls | gcox | scenario: production-stage + gcox layoutEditor | Production stage renders Production Ready Files, Discussions and Participants panels for gcox; no Back to Copyediting decision button (no available decisions for assistants); no Assign button on the Participants panel (gated to manager/sub-editor/admin) | planned |
| 4 | Schedule For Publication hands off to the Publication tab | dbarnes | scenario: production-stage | The Schedule For Publication action button on the production stage navigates to the Publication tab (Title & Abstract panel); the Schedule For Publication publish entry button is present for the editor (publish flow itself covered by publication-publish-flow) | planned |
| 5 | Back to Copyediting returns the submission to copyediting | dbarnes | scenario: production-stage | Back-from-production decision returns stageId to WORKFLOW_STAGE_ID_EDITING (REST + UI stage indicator); copyediting panels (Final Draft, Copyedited files) render again; decision recorded in history | planned |
| 6 | Author view of the production stage is discussion-only | atester | scenario: production-stage, submitter atester | atester's author view of the production stage shows the Discussions panel only — no Production Ready Files panel and no Participants panel (per workflowConfigAuthorOJS) | planned |
