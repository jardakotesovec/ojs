# Usage statistics

- **Area:** 7. Plugins (key set)
- **Placement:** lib/pkp
- **Budget:** 6 tests
- **Absorbs:** playwright/tests/article-statistics.spec.js (1 test; spec moves to lib/pkp during refit — the stats handlers and Vue pages are shared, only the "Articles" locale override is OJS)
- **Scenario needs:** `submission-published` fixture (publicknowledge); journal scenario `users` passthrough for exact-count rows. **Minimal metrics seed — adjudicated: APPROVED FOR BUILD** (wave-1 work item, OJS-only): a scenario passthrough inserting a handful of `metrics_submission` rows matching what the usage aggregation pipeline writes (assoc to a seeded submission, a few dates, abstract + file views), because the publications detail-table only renders rows with non-zero counters: the date-filter and report-download rows (4–5) are untestable beyond empty-state without it. Replaces the dropped Cypress `generateTestMetrics.php` shell-out per migration roadmap row #36 (dropped as fragile, environment-dependent infrastructure). Justification: two rows here need the same state, and per-test UI generation of usage events (visiting pages and waiting for the usage-event pipeline) is non-deterministic and slow.
- **Round 2 / out of scope:**
  - Usage-statistics pipeline (log processing/compilation), geo/institution stats, SUSHI/COUNTER R5 endpoint correctness — explicitly round-2 per inventory and PRINCIPLES.
  - Issues stats page (`/stats/issues`, OJS-only) and the legacy report generator variants (`/stats/reports`) — beyond the publications CSV row.
  - Reviewer-activity averages on the editorial page — derived numbers, unit territory.

## Tests

| # | Title | Actors | Seed | Verifies | Status |
|---|-------|--------|------|----------|--------|
| 1 | Articles stats page renders its landmarks on empty metrics | dbarnes | submission-published on publicknowledge | /stats/publications: h1 "Articles", timeline graph, Abstracts/Files toggles, date-range button, Article Details table with Abstract/File Views columns — page doesn't crash with zero metrics | implemented (playwright/tests/article-statistics.spec.js) |
| 2 | Editorial activity page reflects workflow data | dbarnes | submission scenarios on publicknowledge (one submitted, one declined via decisions passthrough) | /stats/editorial renders the date-range control and the named metric rows (submissions received, declined, days-to-decision); the Received/Declined totals are ≥ the per-test seeded counts (parallel-safe lower bound) | planned |
| 3 | Users stats page shows role counts | dbarnes | journal scenario (scratch, `users` with known role mix) | /stats/users lists registered-user totals per role matching the seeded enrollment exactly (scratch journal makes counts deterministic) | planned |
| 4 | Date-range filter scopes the publications table | dbarnes | submission-published + minimal metrics seed (approved for build — views on known dates) | Applying a custom date range that covers the seeded dates shows the submission's row with its abstract/file view counts; narrowing to a range outside them empties the row — the filter actually re-queries | planned |
| 5 | Publications usage report download contains the seeded row | dbarnes | submission-published + minimal metrics seed (approved for build) | The stats page download produces a CSV containing the seeded submission's title and its view counts | planned |
| 6 | Journal-level stats page renders with date range | dbarnes | UI (publicknowledge) | /stats/context mounts: heading, date-range control and total-views counter render without error on empty metrics | planned |
