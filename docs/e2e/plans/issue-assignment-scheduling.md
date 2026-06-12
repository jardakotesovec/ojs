# Issue assignment & scheduling

- **Area:** 3. Publishing & issues
- **Placement:** ojs
- **Budget:** 5 tests
- **Absorbs:** playwright/tests/issue-assignment.spec.js
- **Scenario needs:** journal scenario `issues[]` w/ `published` flags — exists; submission scenario `publications[].issue` + `published` (future issue + published:true seeds STATUS_SCHEDULED) — exists. Tests that publish an issue use a scratch journal; tests that only assign/schedule a per-test submission against publicknowledge's future issue Vol 2 No 1 (2015) are allowed (issue itself stays unpublished and unmutated). No gaps.
- **Round 2 / out of scope:**
  - Continuous publishing ("Don't assign to an issue") → publication-publish-flow plan row 3.
  - Backdating/overriding datePublished on assignment.
  - Issue CRUD/publishing mechanics themselves → issue-management plan.
  - DOI behavior on schedule/publish → doi-management plan.

## Tests

| # | Title | Actors | Seed | Verifies | Status |
|---|-------|--------|------|----------|--------|
| 1 | Editor reassigns a published article between issues; reader TOCs reflect the move | dbarnes, anonymous | journal scenario: scratch journal w/ 2 published issues; submission-published into the source issue | Unpublish → republish picking the target issue in Review Publishing Details; publication issueId moves, status republished; target issue TOC lists the article, source TOC does not | implemented (playwright/tests/issue-assignment.spec.js) |
| 2 | Editor schedules an article into a future issue | dbarnes, anonymous | submission scenario: production-stage draft VoR w/ full metadata (publicknowledge) | Schedule For Publication selecting future issue Vol 2 No 1 (2015) → status Scheduled (chip in workflow; dashboard badge asserted via row 4's seeded state — see Notes); anonymous article URL 404s; manage-issues TOC tab of the future issue lists the article | implemented (playwright/tests/issue-assignment.spec.js) |
| 3 | Scheduled article goes live when its issue is published | dbarnes, anonymous | journal scenario: scratch journal w/ future issue; submission scheduled into it (issue + published:true seed) | Publishing the issue flips the article to Published; anonymous landing 200 and the article appears in the now-public issue TOC; issue becomes current | implemented (playwright/tests/issue-assignment.spec.js) |
| 4 | Editor unschedules a scheduled article | dbarnes, anonymous | submission scenario: VoR scheduled into publicknowledge future issue (issue + published:true seed) | Seeded state shows the dashboard "Scheduled" badge + to-be-published-in-issue alert (also covers row 2's badge half); unschedule confirmation reverts status to Unscheduled/queued; Schedule For Publication button returns; article no longer listed on the future issue's TOC tab; reader URL still 404 | implemented (playwright/tests/issue-assignment.spec.js) |
| 5 | Editor assigns to a published back issue and publishes immediately; unpublish removes the TOC entry | dbarnes, anonymous | submission scenario: production-stage draft VoR w/ metadata, no issue (publicknowledge) | Publish flow with current/back-issue option targeting Vol 1 No 2 (2014) publishes immediately; anonymous TOC of that issue lists the article; unpublishing removes it from the TOC and landing 404s | implemented (playwright/tests/issue-assignment.spec.js) |

## Notes

- **App-bug candidate (wave 6, needs an app-changes.md row — file untouched per wave contract):**
  `PKPSubmissionController::publishPublication` (lib/pkp/api/v1/submissions/PKPSubmissionController.php:1456)
  hard-codes `Repo::submission()->updateStatus($submission, Submission::STATUS_PUBLISHED)` after the
  publish PUT even when `setStatusOnPublish` left the publication `STATUS_SCHEDULED` (future-issue
  scheduling). A UI-scheduled submission therefore gets `submissions.status = 3` (verified in DB:
  publication 5 / submission 3) — it lands in the dashboard "Published" view, never in "Scheduled for
  publication" (`Repository::getDashboardViews` TYPE_SCHEDULED filters submission status 5), and the
  "To be published in issue …" activity alert (useDashboardConfigEditorialActivity.js:411) never
  renders. The scenario path (`Repo::publication()->publish` with `submissionStatus = null` →
  `getStatusByPublications`) computes `STATUS_SCHEDULED` correctly, so UI and seed disagree.
  Suggested fix: pass `null` so the status is derived. Until then, row 2's dashboard-badge assertion
  rides row 4's seeded scheduled state (identical to the post-fix UI state); move it back into the
  row-2 test when fixed.
- **Test-harness gotcha encoded in the spec:** with `test.use({user})` active, contexts created via
  `browser.newContext()` inherit the configured `storageState` — reader-side helpers pass an explicit
  empty `storageState` to stay anonymous (a logged-in editor can preview unpublished articles, turning
  404 assertions into false 200s).
- **Form race encoded in the spec:** the Review Publishing Details issue-assignment radio must not be
  switched before the async `issueAssignmentStatus` fetch pre-checks the server-derived option;
  an early change is swallowed by `useWorkflowPublicationFormIssue`'s initial-data-load guard and the
  late fetch overwrites the hidden `status` with READY_TO_PUBLISH (publishes immediately as continuous
  publication instead of scheduling). The spec waits for the default radio to be checked first.
