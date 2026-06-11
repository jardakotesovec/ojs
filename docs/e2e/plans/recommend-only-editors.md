# Recommend-only editors

- **Area:** 2. Editorial workflow
- **Placement:** lib/pkp
- **Budget:** 4 tests
- **Absorbs:** lib/pkp/playwright/tests/recommend-only-editor.spec.js, lib/pkp/playwright/tests/section-editor-recommendation.spec.js. Evaluated and NOT absorbed: lib/pkp/playwright/tests/reviewer-recommendations.spec.js — that spec covers reviewer-recommendation *customisation* (manager grid + reviewer-form dropdown options), which belongs to the review-settings plan, not recommend-only editor behavior.
- **Scenario needs:** submission scenario `participants[].recommendOnly` (existing); submission-in-review and submission-published fixtures with participant overrides (existing); Mailpit for the recommendation's Notify Editors mail (existing). No gaps.
- **Round 2 / out of scope:**
  - Toggling `recommendOnly` via the participant edit form UI — stage-participants plan owns participant-flag editing.
  - Aggregated listing with multiple recommend-only editors recording conflicting recommendations.
  - Recommend-only behavior on the copyediting stage (no recommend decisions exist there; covered implicitly by row 4's "no decision buttons outside review" gate).

## Tests

| # | Title | Actors | Seed | Verifies | Status |
|---|-------|--------|------|----------|--------|
| 1 | Recommend-only section editor sees recommendation controls, not decisions | minoue, dbarnes | submission-in-review fixture (participants: dbarnes editor; minoue sectionEditor `recommendOnly:true`) | minoue gets the WorkflowRecommendOnlyControls panel (Recommend Accept/Revisions/Decline) and none of the full decision buttons; dbarnes on the same submission sees the full decision set and no Recommend buttons | implemented (lib/pkp/playwright/tests/recommend-only-editor.spec.js) |
| 2 | Section editor records a recommendation; deciding editor sees it | minoue, dbarnes | submission-in-review fixture (minoue `recommendOnly:true`) | minoue records Recommend Accept (Notify Editors step); decision API contains DECISION_RECOMMEND_ACCEPT; dbarnes's review-stage view lists the recommendation in the secondary column | implemented (lib/pkp/playwright/tests/section-editor-recommendation.spec.js) |
| 3 | Deciding editor is notified and acts on the recommendation | minoue, dbarnes | submission-in-review fixture (minoue `recommendOnly:true`); minoue records Recommend Accept via UI | The recommendation's Notify Editors message (unique marker entered in the message body) reaches dbarnes — Mailpit assertion scoped to recipient + marker, no clearAll (Principles §8); dbarnes records Accept Submission; recommendation and final decision both appear in the decision history; minoue's view reflects the recorded decision state | planned |
| 4 | Recommend-only gate extends to publication actions | minoue, dbarnes | submission-published fixture (participants: dbarnes editor; minoue sectionEditor `recommendOnly:true`) | On the published submission minoue gets no Unpublish/Create New Version controls (`canPublish` requires non-recommend-only per useWorkflowPermissions); dbarnes retains them | planned |
