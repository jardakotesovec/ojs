# Submission stage actions

- **Area:** 2. Editorial workflow
- **Placement:** lib/pkp
- **Budget:** 9 tests
- **Absorbs:** `lib/pkp/playwright/tests/decision-send-to-review.spec.js`; `lib/pkp/playwright/tests/decision-accept.spec.js` (stage-1 accept-and-skip-review test only — the post-review accept test belongs to review-decisions); `lib/pkp/playwright/tests/decision-decline.spec.js` (stage-1 initial-decline test only — the post-review decline test belongs to review-decisions). Both shared files get split between the two plans during refit.
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
| 1 | Editor sends a stage-1 submission to external review | dbarnes | submission scenario: stage-1 draft (submission-draft fixture) | "Send for Review" wizard (notify authors → promote files); stage advances to external review, status queued; `EXTERNAL_REVIEW` decision row recorded | implemented (lib/pkp/playwright/tests/decision-send-to-review.spec.js) |
| 2 | Editor accepts and skips review from stage 1 | dbarnes | submission scenario: stage-1 draft | "Accept and Skip Review" wizard; submission lands in copyediting (stage 4, queued); `SKIP_EXTERNAL_REVIEW` decision row | implemented (lib/pkp/playwright/tests/decision-accept.spec.js — stage-1 test) |
| 3 | Editor declines a stage-1 submission | dbarnes | submission scenario: stage-1 draft | "Decline Submission" wizard; status flips to declined; `INITIAL_DECLINE` decision row | implemented (lib/pkp/playwright/tests/decision-decline.spec.js — stage-1 test) |
| 4 | Manager assigns an editor to a needs-editor submission; decisions unlock | admin, dbuskins | submission scenario: `participants: []` | admin adds dbuskins as editor via the Participants panel; submission leaves the needs-editor dashboard view; dbuskins now sees the stage-1 decision buttons on the workflow page | planned |
| 5 | Editor reverts an initial decline; author sees the status flip | dbarnes, atester | submission scenario: submitter atester, decisions `[initialDecline]` | "Revert Decline" button offered on the declined stage-1 submission; after revert, status queued at stage 1 and `REVERT_INITIAL_DECLINE` decision row recorded; author's mySubmissions shows the submission active again | planned |
| 6 | Manager deletes a declined submission | admin | submission scenario: decisions `[initialDecline]` (add a manager participant if the `hasCurrentUserAtLeastOneAssignedRoleInAnyStage` gate requires an explicit assignment — verify against workflowConfigEditorialOJS.js during implementation) | Delete button offered only post-decline to manager/site admin; confirmation dialog; submission gone (workflow URL errors, absent from dashboard lists) | planned |
| 7 | Author sees no editorial decision controls on their own submission | atester | submission scenario: submitter atester, stage-1 draft | author workflow view via mySubmissions renders the stage without Send for Review / Accept and Skip Review / Decline buttons | planned |
| 8 | Cancelling the decision wizard records nothing | dbarnes | submission scenario: stage-1 draft | open "Send for Review" wizard, cancel/close before recording; no decision rows via API; stage unchanged; decision buttons still offered | planned |
| 9 | Stage-1 decline email reaches the author | dbarnes, atester | submission scenario: submitter atester, stage-1 draft | decline via UI with edited notify-author body; Mailpit query scoped to atester + the submission's unique tag finds the decline email containing the edited body; author's mySubmissions shows declined (complements row 3, which owns the state-transition assertions) | planned |
