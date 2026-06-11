# Submission stage actions

- **Area:** 2. Editorial workflow
- **Placement:** lib/pkp
- **Budget:** 9 tests
- **Absorbs:** DONE — `lib/pkp/playwright/tests/decision-send-to-review.spec.js` fully absorbed into `submission-stage-actions.spec.js` (row 1) and the file deleted; the stage-1 accept-and-skip-review test moved out of `decision-accept.spec.js` (row 2) and the stage-1 initial-decline test out of `decision-decline.spec.js` (row 3). Both files keep their post-review test for the review-decisions plan, with a header note recording the split.
- **Scenario needs:** submission scenario — `submitter` override (atester for author-side checks), `participants` override incl. empty list (needs-editor state), decisions `initialDecline`. All exist; no gaps.
- **Round 2 / out of scope:**
  - Generic participant add/remove/notify and assistant permission effects (stage-participants plan); row 4 here covers only the needs-editor → assign-editor journey.
  - Revert-decline and decision emails at the *review* stage (review-decisions plan).
  - Recommend-only behavior at stage 1 (recommend-only-editors plan).
  - Stage-1 discussion/file panels (discussions and submission-files plans).
  - Email-template editing for decision mailables (email-templates-management plan); rows here assert delivery/content of the default templates only.

## Tests

| # | Title | Actors | Seed | Verifies | Status |
|---|-------|--------|------|----------|--------|
| 1 | Editor sends a stage-1 submission to external review | dbarnes | submission scenario: stage-1 draft (submission-draft fixture) | "Send for Review" wizard (notify authors → promote files); stage advances to external review, status queued; `EXTERNAL_REVIEW` decision row recorded | implemented (lib/pkp/playwright/tests/submission-stage-actions.spec.js) |
| 2 | Editor accepts and skips review from stage 1 | dbarnes | submission scenario: stage-1 draft | "Accept and Skip Review" wizard; submission lands in copyediting (stage 4, queued); `SKIP_EXTERNAL_REVIEW` decision row | implemented (lib/pkp/playwright/tests/submission-stage-actions.spec.js) |
| 3 | Editor declines a stage-1 submission | dbarnes | submission scenario: stage-1 draft | "Decline Submission" wizard; status flips to declined; `INITIAL_DECLINE` decision row | implemented (lib/pkp/playwright/tests/submission-stage-actions.spec.js) |
| 4 | Manager assigns an editor to a needs-editor submission; decisions unlock | admin, dbuskins | submission scenario: `participants: []` | admin adds dbuskins as editor via the Participants panel; submission leaves the needs-editor dashboard view; dbuskins now sees the stage-1 decision buttons on the workflow page | implemented (lib/pkp/playwright/tests/submission-stage-actions.spec.js) |
| 5 | Editor reverts an initial decline; author sees the status flip | dbarnes, atester | submission scenario: submitter atester, decisions `[initialDecline]` | "Revert Decline" button offered on the declined stage-1 submission (regular decisions absent); after revert, status queued at stage 1 and `REVERT_INITIAL_DECLINE` decision row recorded; author's mySubmissions shows the submission active again. Note: Delete is ALSO offered to dbarnes — OJS's "Journal editor" group carries ROLE_ID_MANAGER, so the editor passes the manager gate | implemented (lib/pkp/playwright/tests/submission-stage-actions.spec.js) |
| 6 | Manager deletes a declined submission | admin | submission scenario: decisions `[initialDecline]` + a queued sibling draft (verified: NO explicit manager participant needed — unassigned site admins/managers get the global-role fallback in lib/pkp Schema.php getPropertyStages, so the `hasCurrentUserAtLeastOneAssignedRoleInAnyStage` gate passes) | Delete button offered only post-decline (absent on the queued sibling) to manager/site admin; confirmation dialog; submission gone (API 404, workflow URL errors, absent from the declined dashboard view) | implemented (lib/pkp/playwright/tests/submission-stage-actions.spec.js) |
| 7 | Author sees no editorial decision controls on their own submission | atester | submission scenario: submitter atester, stage-1 draft | author workflow view via mySubmissions renders the stage (submission files incl. seeded default file as positive control) without Send for Review / Accept and Skip Review / Decline buttons | implemented (lib/pkp/playwright/tests/submission-stage-actions.spec.js) |
| 8 | Cancelling the decision wizard records nothing | dbarnes | submission scenario: stage-1 draft | open "Send for Review" wizard, cancel via the Cancel → "Cancel Decision" confirmation before recording; no decision rows via API; stage unchanged; decision buttons still offered | implemented (lib/pkp/playwright/tests/submission-stage-actions.spec.js) |
| 9 | Stage-1 decline email reaches the author | dbarnes, atester | submission scenario: submitter atester, stage-1 draft | decline via UI with edited notify-author body; Mailpit query scoped to atester + the test's unique marker finds the decline email containing the edited body; author's mySubmissions shows declined (complements row 3, which owns the state-transition assertions) | implemented (lib/pkp/playwright/tests/submission-stage-actions.spec.js) |
