# OJS e2e Test Suite — Principles & Charter

This document is the contract for all work on the Playwright e2e suite (branch `e2e_revamp`).
Every planning or implementation session reads this file first. Progress state lives in
`docs/e2e/feature-inventory.md` and `docs/e2e/plans/*.md`, never in conversation memory —
re-running the same wave prompt must always resume correctly.

## Why this suite exists

The legacy Cypress suite is a serial fixture chain: tests depend on state left by earlier
specs, cannot run in parallel, and a failure mid-chain forces re-running everything before
it. The revamp replaces that with parallel-first Playwright tests where each test seeds its
own state through test-only scenario endpoints (`/api/v1/_test/scenarios/*`).

## Goals and budget

- **Round 1 (this effort): ~500 tests.** Round 2 may extend toward ~1000; round-2 candidates
  are recorded in plans as deferred rows, never implemented early.
- **Scope: core OJS + key bundled plugins** — DOI/Crossref, ORCID, Citation Style Language,
  subscriptions/payments, usage statistics display. Long-tail generic/importexport/theme
  plugins are round 2.
- **Full-suite CI wall clock target: ~20 minutes** on parallel workers. Check runtime per
  wave with `lib/pkp/playwright/scripts/aggregate-scenario-timing.js`; treat regressions as
  defects, not facts of life.
- Coverage philosophy: typical workflows first. We can never cover everything in e2e; budget
  goes to journeys a real journal performs weekly, then to configuration surfaces that gate
  them, then to edge cases — in that order.

## Architecture principles

1. **Isolation unit is the submission.** Most tests create their own submission(s) via the
   scenario endpoint and never touch anyone else's. The shared base journal
   `publicknowledge` (seeded by `playwright/fixtures/bootstrap.js`) is **read-only**: no test
   may mutate journal-level settings, sections, categories, issues, or the 16 seeded users.
   Tests that need journal-level mutations create a **scratch journal** via
   `POST /api/v1/_test/scenarios/journal` with a unique path.
2. **Scenario endpoints must be accurate.** A seeded scenario must leave the same database
   state, fire the same hooks, and produce the same notifications as a user performing the
   equivalent steps through the UI/REST API. Any change to a Processor requires a parity
   entry in `docs/scenario-processor-audit.md` before it merges.
3. **Endpoint scope stays balanced.** Extend a Processor only when multiple plan rows need
   the same state. One-off or rare states are reached by driving the UI inside the test
   that needs them. The scenario spec schema should stay small enough to hold in your head;
   when in doubt, don't extend.
4. **Seed via endpoint, drive UI only for the behavior under test.** Getting *to* the state
   is the endpoint's job; exercising the state is the test's job.
5. **No hard-coded waits.** Use Playwright auto-waiting and web-first assertions. If an
   animation or debounce timer causes flake, shorten the store-side timer under test mode
   instead of sleeping.
6. **Group assertions per scenario.** One seeded scenario can support several related
   assertions in one test. Don't pay scenario-seeding cost per assertion; equally, don't
   build mega-tests that obscure failures — a test should still verify one coherent behavior.
7. **Tests are independent.** Specs run in parallel workers in arbitrary order; no test may
   depend on another test having run, nor leave state that can affect any other test. Each
   test creates what it needs (own submission, own users, scratch journal) and asserts only
   against state it created. Mutations of shared singletons (site settings) must restore
   state within the test; anything that cannot be isolated that way is deferred to round 2
   or runs in a dedicated serial project with an explicit note in its plan.
8. **Mailpit is shared.** Never `clearAll()` outside the dedicated serial infrastructure
   spec. Assert emails scoped by recipient + the test's unique tag; use throwaway recipient
   users whenever a test counts messages or asserts absence, and pair every negative
   assertion ("no email sent") with a positive control message that bounds the wait.
9. **Globally-scanning operations run serially.** Scheduled tasks (reviewer/editorial
   reminders), site-level plugin toggles, and cache clears affect state across all journals
   and workers; they live in a dedicated serial Playwright project, never in parallel specs.

## Organization

- **Tests are organized by feature.** Each feature has a plan file
  `docs/e2e/plans/<feature>.md` and spec file(s) named after it.
- **Placement rule:** behavior that exists identically in OMP/OPS → `lib/pkp/playwright/tests/`;
  OJS-only behavior (issues, galleys, subscriptions, DOIs, journal front end) →
  `playwright/tests/`. Subfolders per area are allowed and encouraged as the suite grows.
- **All plan docs live in this repo** (`docs/e2e/plans/`), including plans whose specs land
  in `lib/pkp` — one source of truth for coverage.

## Plan file format

Every plan file follows this template so wave sessions can parse progress mechanically:

```markdown
# <Feature name>

- **Area:** <inventory area>
- **Placement:** lib/pkp | ojs
- **Budget:** <N> tests
- **Absorbs:** <existing spec files this plan subsumes, or "none">
- **Scenario needs:** <endpoint capabilities used; unmet needs flagged as `GAP:` with justification>
- **Round 2 / out of scope:** <bullets>

## Tests

| # | Title | Actors | Seed | Verifies | Status |
|---|-------|--------|------|----------|--------|
| 1 | ...   | dbarnes | submission in review round 1 | ... | planned |
```

`Status` is exactly one of: `planned`, `implemented (path/to/file.spec.js)`,
`dropped (reason)`. The feature-inventory tracks per-feature rollups of these statuses.
A spec file containing N tests may back at most N `implemented` rows across ALL plans;
when a spec is split between plans, both plans record the split in **Absorbs**.

## Absorbing the pre-revamp specs

The ~69 Playwright specs written during the 1:1 Cypress migration are raw material. Each
plan row that an existing spec already satisfies records it under **Absorbs**; during
implementation the spec is moved/refit into the new taxonomy (or rewritten if it doesn't
hold up) and counts toward the 500. The legacy Cypress suite was retired at the final
cross-check (round 1 complete, 2026-07-01): every Cypress assertion mapped to a new test
or a recorded "intentionally dropped" reason.

## Bootstrap data policy

- Base seed lives in `playwright/fixtures/bootstrap.js` (journal `publicknowledge`,
  16 users, sections, categories, issues). Seeded users and roles are documented in the
  `ojs-playwright-tests` skill.
- **Richer defaults are encouraged**: enable features and metadata most real journals use
  (e.g. additional submission-wizard metadata fields, categories, DOIs where it doesn't
  force per-test cleanup), so tests exercise representative configuration.
- **Bootstrap changes happen at the start of wave 1, before tests accumulate** against old
  defaults. After wave 1, bootstrap changes require checking every implemented spec.

## Definition of done — per implementation wave

1. Affected Playwright projects pass locally in parallel mode; full suite passes once.
2. Runtime checked against the 20-minute budget.
3. Plan rows updated to `implemented (...)` / `dropped (...)`; inventory rollup updated.
4. Any new Processor capability has its parity-audit entry.
5. The `ojs-playwright-tests` skill is updated if conventions changed.
6. Committed with correct repo discipline (below).

## Commit discipline

`lib/pkp` is a separate repository (submodule). Shared specs, POMs, and Processor changes
are committed inside `lib/pkp`; OJS-only specs and all docs (including this directory) are
committed in the OJS root. **Never bump the submodule pointer in a root commit** — run
`git restore --staged lib/pkp` before committing the root repo.

## App-code change ledger

Any wave that (a) changes non-test code (anything outside `playwright/`, `docs/`,
`.claude/`) or (b) diagnoses an app-side bug or flakiness source — even without fixing
it — appends a row to `docs/e2e/app-changes.md` in the same wave. That file is the
end-of-round review list for production-relevant changes; scenario-endpoint changes stay
in `docs/scenario-processor-audit.md` instead.

## Related documents

- `.claude/skills/ojs-playwright-tests/` — developer guide: users, app map, patterns, scenarios
- `docs/scenario-processor-audit.md` — Processor parity audit ledger
- `.env.playwright.example` — local environment setup

> Note (2026-07-06): the round-1 planning docs this file used to reference —
> `docs/e2e/feature-inventory.md`, `docs/e2e/plans/`, and
> `docs/e2e-playwright-migration.md` — were retired once round 1 completed and the
> spec-driven build (atoms → features → specs, under `docs/product/`) took over. This
> file is kept for its still-current test-suite principles (esp. the serial-project
> rules 8–9 referenced by `lib/pkp/playwright/config-factory.js`).
