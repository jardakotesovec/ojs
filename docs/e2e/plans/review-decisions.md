# Review decisions

- **Area:** 2. Editorial workflow
- **Placement:** lib/pkp
- **Budget:** 8 tests
- **Absorbs:** `lib/pkp/playwright/tests/decision-accept.spec.js` (post-review accept test only); `lib/pkp/playwright/tests/decision-decline.spec.js` (post-review decline test only). The stage-1 tests in both files belong to submission-stage-actions; the files get split between the two plans during refit.
- **Scenario needs:** submission scenario — in-review fixture, reviewer `completed` status with `recommendation`, decision chains (`decline`, `requestRevisions`). All exist; no gaps.
- **Round 2 / out of scope:**
  - Stage-1 decisions incl. initial decline and its revert (submission-stage-actions plan).
  - Request-revisions / new-round / cancel-round decisions (review-rounds-revisions plan).
  - Editor recommendations (RECOMMEND_*) and recommend-only flows (recommend-only-editors plan).
  - Send-to-production and back-from-copyediting decisions (copyediting-stage plan).
  - Decision email-template management (email-templates-management plan) and submission email log (email-delivery plan).
  - Decision `toEditor` comment seeding self-test (test-infrastructure plan owns `scenario-decision-comments.spec.js`).

## Tests

| # | Title | Actors | Seed | Verifies | Status |
|---|-------|--------|------|----------|--------|
| 1 | Editor accepts a submission after external review | dbarnes | submission scenario: in review (invited + accepted reviewers) | "Accept Submission" wizard; submission lands in copyediting (stage 4, queued); `ACCEPT` decision row recorded | implemented (lib/pkp/playwright/tests/decision-accept.spec.js — post-review test) |
| 2 | Editor declines a submission after review | dbarnes | submission scenario: in review | "Decline Submission" wizard; status declined; `DECLINE` decision row recorded | implemented (lib/pkp/playwright/tests/decision-decline.spec.js — post-review test) |
| 3 | Accept with completed reviews notifies author and reviewers | dbarnes, atester | submission scenario: in review, submitter atester, phudson `completed` (recommendation accept) | wizard gains the Notify Reviewers step (only with completed reviews); Mailpit queries scoped by recipient + the submission's unique tag: notify-author accept email to atester + decision email to phudson | planned |
| 4 | Notify-author decision email carries an attachment | dbarnes, atester | submission scenario: in review, submitter atester | accept decision with composer FileAttacher upload + edited subject/body; tag-scoped Mailpit message to atester shows the attachment and the edited content | planned |
| 5 | Editor reverts a post-review decline | dbarnes | submission scenario: in review + decisions `[decline]` | "Revert Decline" button on the declined submission; after revert, status queued back at the review stage; `REVERT_DECLINE` decision row; primary decisions offered again | planned |
| 6 | Post-review decline notifies the author and archives the submission for them | dbarnes, atester | submission scenario: in review, submitter atester | decline via UI; Mailpit query scoped to atester + the submission's unique tag finds the decline email; author's mySubmissions shows the submission declined (complements row 2, which owns the state-transition assertions) | planned |
| 7 | Decision history records the chain in order | dbarnes | submission scenario: in review + decisions `[requestRevisions]`; UI: accept decision | decisions endpoint lists pendingRevisions then accept with editor + dates; workflow shows copyediting started while the review stage retains its recorded state | planned |
| 8 | Declined submission offers only revert and delete | dbarnes | submission scenario: in review + decisions `[decline]` | review-stage action panel shows Revert Decline (+ Delete for managers) and none of Accept / Request Revisions / Decline | planned |
