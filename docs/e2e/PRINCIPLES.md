# OJS e2e Test Suite — Principles

The **test-authoring** contract for the Playwright e2e suite. Every test-writing session
follows these principles. The campaign's operating loop, test budget, and per-feature
definition-of-done live in `docs/product/RUNBOOK.md`; the spec-authoring rules and
completeness invariants live in `docs/product/CHARTER.md` (the spec-driven build:
atoms → features → specs, under `docs/product/`). Progress state lives in
`docs/product/PROGRESS.md`, never in conversation memory — re-running the same prompt must
always resume correctly.

## Why this suite exists

The legacy Cypress suite was a serial fixture chain: tests depended on state left by
earlier specs, could not run in parallel, and a failure mid-chain forced re-running
everything before it. This suite replaces that with parallel-first Playwright tests where
each test seeds its own state through test-only scenario endpoints
(`/api/v1/_test/scenarios/*`).

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
3. **Endpoint scope stays balanced.** Extend a Processor only when multiple tests need
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
   state within the test; anything that cannot be isolated that way runs in a dedicated
   serial project with an explicit note. **NEVER enrol a shared seeded user in a new role**
   — that persists a global role other suites depend on (this bit the build once: a test
   made `minoue` a manager of a scratch journal and it leaked into an unrelated
   permission test). Use dedicated throwaway users for any role-mutation probe.
8. **Mailpit is shared.** Never `clearAll()` outside the dedicated serial infrastructure
   spec. Assert emails scoped by recipient + the test's unique tag; use throwaway recipient
   users whenever a test counts messages or asserts absence, and pair every negative
   assertion ("no email sent") with a positive control message that bounds the wait.
9. **Globally-scanning operations run serially.** Scheduled tasks (reviewer/editorial
   reminders), site-level plugin toggles, site-settings mutations, and cache clears affect
   state across all journals and workers; they live in a dedicated serial Playwright project
   (`playwright/tests/serial/`), never in parallel specs. The serial project depends on the
   parallel app project, so it runs alone at the end.

## Organization

- **Tests are organized by feature**, one spec file (or a small set) named after the
  feature; the feature list and per-feature test budget live in `docs/product/PROGRESS.md`.
- **Placement rule:** behavior that exists identically in OMP/OPS → `lib/pkp/playwright/tests/`;
  OJS-only behavior (issues, galleys, subscriptions, DOIs, journal front end) →
  `playwright/tests/`. Subfolders per area are allowed and encouraged as the suite grows.

## Bootstrap data policy

- Base seed lives in `playwright/fixtures/bootstrap.js` (journal `publicknowledge`,
  16 users, sections, categories, issues). Seeded users and roles are documented in the
  `ojs-playwright-tests` skill.
- **Richer defaults are encouraged**: enable features and metadata most real journals use
  (e.g. additional submission-wizard metadata fields, categories, DOIs where it doesn't
  force per-test cleanup), so tests exercise representative configuration.
- A bootstrap change requires checking every implemented spec against the new defaults —
  do it deliberately, not casually.

## Commit discipline

`lib/pkp` is a separate repository (submodule). Shared specs, POMs, and Processor changes
are committed inside `lib/pkp`; OJS-only specs and all docs (including this directory) are
committed in the OJS root. **Never bump the submodule pointer in a root commit** — run
`git restore --staged lib/pkp` before committing the root repo.

## App-code change ledger

Any work that (a) changes non-test code (anything outside `playwright/`, `docs/`,
`.claude/`) or (b) diagnoses an app-side bug or flakiness source — even without fixing
it — appends a row to `docs/e2e/app-changes.md`. That file is the end-of-round review list
for production-relevant findings; scenario-endpoint parity notes stay in
`docs/scenario-processor-audit.md` instead.

## Budget & definition of done

The full-suite budget (**≤700 tests, ≤25 min on a fresh DB**) and the per-feature
definition-of-done are owned by `docs/product/RUNBOOK.md` — see its **Budget & ceilings**
and **Definition of done** sections. (An earlier round-1 target of ~500 tests / ~20 min is
superseded.)

## Related documents

- `.claude/skills/ojs-playwright-tests/` — developer guide: users, app map, patterns, scenarios
- `docs/scenario-processor-audit.md` — Processor parity audit ledger
- `docs/product/RUNBOOK.md` · `docs/product/CHARTER.md` — the spec-driven build loop + charter
- `.env.playwright.example` — local environment setup
