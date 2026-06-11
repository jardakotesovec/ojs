# Review settings

- **Area:** 6. Settings & administration
- **Placement:** lib/pkp
- **Budget:** 5 tests
- **Absorbs:** lib/pkp/playwright/tests/reviewer-recommendations.spec.js (5 tests → row 5; previously orphaned — no plan claimed it). **Refit note:** the wave refactor should split those 5 tests across recommendation-settings effects (defaults/type metadata, custom-recommendation CRUD, active/inactive toggle, in-use lock, inactive option absent from the reviewer's completion form) rather than keep them as one monolith.
- **Scenario needs:** scratch journal via `POST /api/v1/_test/scenarios/journal`; `submission-in-review` fixture with `journal` override (rows 1, 2, 3 — provides a stage-3 submission with jjanssen accepted, used to open the Add Reviewer modal and the reviewer's own review steps). Settings values themselves are set through the UI (the mutation is the behavior under test).
- **Round 2 / out of scope:**
  - Reminder emails actually firing — `scheduled-tasks` plan owns triggering the task and asserting the Mailpit reminder. The four reminder sliders' persistence row was dropped in adversarial review (no user-visible effect in-test; the send effect is owned by `scheduled-tasks`).
  - One-click reviewer access (`reviewerAccessKeysEnabled`) end-to-end — the access-key login flow is owned by `reviewer-response`.
  - Review Forms tab — owned by `review-forms` plan.
  - `numReviewsPerSubmission` ("reviews required") effect on round status display — round 2.
  - `defaultReviewPublicVisibility` / open-review public comments display — round 2 (interacts with public-comments surface).

## Tests

| # | Title | Actors | Seed | Verifies | Status |
|---|-------|--------|------|----------|--------|
| 1 | Default review mode preselects anonymity in Add Reviewer | dbarnes | scenario: scratch journal + submission-in-review fixture (journal override) | Workflow > Review > Setup: set defaultReviewMode to Open, save, reload → radio persists; open Add Reviewer on the seeded submission → review-type radio defaults to Open (ReviewerForm initData reads `defaultReviewMode`). | planned |
| 2 | Response/review deadlines prefill reviewer due dates | dbarnes | scenario: scratch journal + submission-in-review fixture (journal override) | Set numWeeksPerResponse=2 and numWeeksPerReview=6, save → values persist on reload; Add Reviewer modal prefills response due ≈ today+2w and review due ≈ today+6w (HasReviewDueDate trait). | planned |
| 3 | Reviewer guidance text reaches the reviewer | dbarnes, jjanssen | scenario: scratch journal + submission-in-review fixture (journal override, jjanssen accepted) | Workflow > Review > Reviewer Guidance: set reviewGuidelines (and competingInterests disclosure), save → persists on reload; jjanssen opens their review (`/reviewer/submission/{id}`) → Guidelines step renders the custom guidelines text. | planned |
| 4 | Reviewer-suggestions toggle gates the wizard step | dbarnes | scenario: scratch journal | Review > Setup: enable reviewerSuggestionEnabled, save → persists; start a submission → wizard includes the Suggest Reviewers step; disable, start another submission → step absent. This plan owns the toggle round-trip including the no-wizard-step assertion (`reviewer-suggestions` released its duplicate; suggestion content flows stay there). | planned |
| 5 | Reviewer recommendation configuration + reviewer-facing recommendation flows | dbarnes, rvaca, phudson | scenario: scratch journal (`users` passthrough; review-stage submission where needed) | Reviewer Recommendations manager: defaults render with non-empty type metadata; custom recommendation CRUD (add/edit/delete); active/inactive toggle on an unused recommendation; a recommendation in use by a completed review cannot be edited or deleted; an inactive recommendation does not appear in the reviewer's review-completion form. | implemented (lib/pkp/playwright/tests/reviewer-recommendations.spec.js) |
