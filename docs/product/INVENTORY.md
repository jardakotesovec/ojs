# Product spec inventory

Feature list with status. One row per spec in `specs/`. Status: `pilot` (calibrating
the template), `planned`, `draft`, `verified`. The authoritative completeness metric
is the atlas unclaimed-atom count (see `CHARTER.md`), not this table's length —
features are added here as atom clusters get named.

| Spec | Scope | Shared | Status | Atoms claimed |
|------|-------|--------|--------|---------------|
| tasks-discussions | Editorial tasks & discussions on submissions | pkp-lib | verified (pilot) | 57 |
| publication-versioning | Publication versions: create, publish, unpublish, reader display | pkp-lib | verified (pilot) | 18 |
| submission-wizard | Make-a-Submission wizard: start form, steps, submit, acknowledgement, cancel, reconfigure | pkp-lib | verified | 30 |
| submission-wizard-metadata | For-the-Editors metadata questions: per-field collect/ask/require modes, vocab chips, the Metadata settings panel | pkp-lib | verified | 10 |
| reviewer-suggestions | Author suggests reviewers in a wizard step; editors consume them at assignment (prefill + approval); journal toggle + guidance | pkp-lib | verified | 10 |
| submission-drafts | Save-for-Later + resume email, the Incomplete-submissions list, resume-at-step, and draft deletion (single + bulk) | pkp-lib | verified | 5 |
| author-dashboard | My Submissions list (state views, search, filters, per-state rows) + the author's read-mostly tracking view of one submission; legacy authorDashboard redirect + readSubmissionEmail | pkp-lib | verified | 5 |
| editorial-dashboards | Editor Dashboard (role-scoped state views, counts, filters, search, sort, table + row actions) + reviewer My-Assignments dashboard, shared DashboardPage machinery, legacy submissions/dashboard redirects | pkp-lib | verified | 16 |

Pilot outcome (2026-07-02): both specs adversarially verified with live probes; verifier
refuted 3 permission cells + 1 state rule in tasks-discussions pre-fix (all corrected),
confirmed 6 new REAL deviations → e2e ledger §2 rows 53–60; unclaimed atoms: 1,436 of
1,511 (75 claimed). Dead-code candidates so far: 19 (UNASSIGNED.md).

## Atlas sweeps (Phase 0 — completed 2026-07-02)

Total: **1,511 atoms** across 13 modalities. Every sweep file records its own Gaps
section; the liveness audit (Phase 0.5) appends verdicts to `atlas/grids.md` and seeds
`UNASSIGNED.md` §Dead-code candidates.

| Sweep | File | Atoms | Notable gaps/oddities |
|-------|------|-------|-----------------------|
| Page handlers | atlas/pages.md | 164 | pages/manager router fully dead; 6 routed-but-unimplemented ops |
| API endpoints | atlas/api.md | 284 | `_test/` excluded; Route::prefix paths recovered manually |
| Legacy component handlers | atlas/grids.md | 87 | ~18 handlers are base classes; liveness audit appended |
| Vue surfaces | atlas/vue.md | 75 | frontend/components included; OMP-only managers skipped; empty pages/doi dir |
| Forms & schemas | atlas/forms-schemas.md | 121 | Field* widgets excluded; context.json = 131 props from ~15 forms |
| Plugins | atlas/plugins.md | 51 | gateways/ category empty; pflPlugin has no e2e plan |
| Mailables | atlas/mail.md | 69 | two mailables share SUBMISSION_ACK_NOT_USER template |
| Notification types | atlas/notifications.md | 65 | CONFIGURE_PAYMENT_METHOD + 10 BOOK_* never created; 4 editing-status types at wrong level |
| Jobs & scheduled tasks | atlas/jobs-tasks.md | 57 | no OJS scheduledTasks registry; test jobs in production tree |
| Authorization & middleware | atlas/authorization.md | 90 | zero unused policies; ~35 granular sub-policy fragments |
| Event-log types | atlas/event-log.md | 57 | 2 constants with no live writer; 1 duplicate hex value |
| DB entities | atlas/db-entities.md | 149 | highlights table has no e2e plan; 83 tables unhinted |
| Locale prefixes | atlas/locale.md | 242 | coarse net (2-segment prefixes, count≥4) for the completeness critic |
