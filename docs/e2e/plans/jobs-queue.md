# Jobs queue

- **Area:** 8. System & communications
- **Placement:** lib/pkp
- **Budget:** 3 tests
- **Absorbs:** lib/pkp/playwright/tests/jobs-queue.spec.js (2 tests → rows 1–2)
- **Scenario needs:** none from the scenario API. Harness: row 3 shells out from the test (Node `child_process`) to `APPLICATION_ENV=test php lib/pkp/tools/jobs.php test failed` (dispatch a `TestJobFailure`) and `... jobs.php run` (synchronous drain) — valid because the Playwright `webServer` is local PHP sharing the same test DB, mirroring the legacy Cypress `cy.exec` pattern. No GAP. Note: jobs otherwise process via the built-in `job_runner = On` at end of web requests (inherited from config.TEMPLATE.inc.php by `seed-test-config.js`); the CLI drain is used where determinism matters.
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
| 3 | Failed job lifecycle: fail → details → redispatch → delete | admin | UI/CLI: dispatch `TestJobFailure` + drain via jobs.php | Drained failing job appears on the failed-jobs list; its details page shows the exception/payload; Redispatch returns it to the queued list (row leaves failed); after a second drain it fails again and Delete removes the row for good (assertions scoped to this test's row — the list is shared under parallel workers) | planned |
