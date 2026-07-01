# Jobs queue

- **Area:** 8. System & communications
- **Placement:** lib/pkp
- **Budget:** 3 tests
- **Absorbs:** lib/pkp/playwright/tests/jobs-queue.spec.js (3 tests → rows 1–3)
- **Scenario needs:** none from the scenario API. Harness: row 3 shells out from the test (Node `child_process`) to `APPLICATION_ENV=test php lib/pkp/tools/jobs.php test --only=failed` (dispatch a `TestJobFailure`; the bare positional `test failed` form parses as no-op and dispatches BOTH test jobs — `HasParameterList` only keys `--x=y` forms) and `... jobs.php run --test` (synchronous drain of `Job::TESTING_QUEUE`; bare `run` drains only the default `queue`) — valid because the Playwright `webServer` is local PHP sharing the same test DB, mirroring the legacy Cypress `cy.exec` pattern. No GAP. Parallel-safety: the end-of-request web `job_runner` explicitly EXCLUDES the testing queue (`PKPQueueProvider::getJobModelBuilder()` → `notQueue(TESTING_QUEUE)`, PKPQueueProvider.php:57), so only the explicit CLI drain ever touches the dispatched job; all failed/queued-list assertions are scoped to ids discovered by before/after snapshot diffs of `TestJobFailure` rows, never counts.
- **Round 2 / out of scope:**
  - `jobs.php work` worker-daemon mode and `purge` CLI surface (no admin-UI equivalent).
  - "Requeue All" bulk button (row 3 covers the per-row Redispatch; bulk variant deferred — failed-jobs list is global and parallel-unsafe to assert in bulk).
  - Job retry/backoff configuration and `delete_failed_jobs_after` pruning.
  - Per-queue filtering of the jobs list.

## Tests

| # | Title | Actors | Seed | Verifies | Status |
|---|-------|--------|------|----------|--------|
| 1 | Site admin views the queued jobs page and API | admin | none (admin pages) | `/admin/jobs` renders heading + PkpTable; `/index/api/v1/jobs/all` returns 200 with `data`/`total` shape | implemented (lib/pkp/playwright/tests/jobs-queue.spec.js) |
| 2 | Site admin views the failed jobs page and API | admin | none (admin pages) | `/admin/failedJobs` renders heading + PkpTable; `/index/api/v1/jobs/failed/all` returns 200 with `data`/`total` shape | implemented (lib/pkp/playwright/tests/jobs-queue.spec.js) |
| 3 | Failed job lifecycle: fail → details → redispatch → delete | admin | UI/CLI: dispatch `TestJobFailure` + drain via jobs.php | Drained failing job appears on the failed-jobs list (row identified by id-diff, paginated lookup); its details page shows the exception message + payload FQN in their attribute rows; "Try Again" redispatches it (POST 200, row leaves failed list, fresh queued row appears via API + on /admin/jobs when on page 1); after a second drain it fails again under a new id and Delete removes the row for good (API confirms; test leaves zero residue on the shared list) | implemented (lib/pkp/playwright/tests/jobs-queue.spec.js) |
