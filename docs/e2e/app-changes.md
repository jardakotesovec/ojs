# OJS code changes & bug findings from the e2e revamp

Review ledger for the END of round 1: every NON-TEST codebase tweak the suite work
required, plus app-bug / flakiness candidates the tests surfaced but did not fix.
Scenario-endpoint work (`api/v1/_test/`, `classes/testing/`) is deliberately NOT
tracked here — it is test-gated and reviewed in `docs/scenario-processor-audit.md`.
Charter rule: any wave that changes non-test code or diagnoses an app-side bug
appends a row here.

## 1. Production code changes (review + likely upstream)

| # | Change | Where | Commit | Why / risk | Upstream? |
|---|--------|-------|--------|------------|-----------|
| 1 | OAI `ListRecords`/`ListIdentifiers` with `from=`/`until=` fataled on Postgres: `whereDate()` received a raw `GREATEST(...)` Expression; Laravel's Postgres grammar probes the column with `str_contains()` → TypeError → 500. Replaced with `whereRaw` + portable `DATE()` casts (MySQL + PG). | `classes/oai/ojs/OAIDAO.php` | root `03516ef9c2` (wave 3) | Harvester-facing bug on every Postgres install that gets date-range harvested. Same semantics after fix. | **YES — cherry-pick to main**; check OMP/OPS OAIDAOs for the same pattern. |
| 2 | `plugins/generic/credit` checkout (stable-3_5_0) references the removed `PKP_STRICT_MODE` constant at class_alias time, fataling ALL plugin loading (web + CLI) on 3.6-dev core. Patched: `if (defined('PKP_STRICT_MODE') && !PKP_STRICT_MODE)`. | `plugins/generic/credit/CreditPlugin.php` — **UNCOMMITTED working-tree patch in the plugin's own repo** | none (wave 1 env unblock) | App cannot boot with this checkout present otherwise. Revert: `git checkout -- CreditPlugin.php` there. | Decide: move the checkout to a 3.6-compatible branch, or upstream the `defined()` guard (harmless on all branches). |
| 3 | `opis/json-schema` added as **require-dev** to lib/pkp (scenario-spec validation was silently dead without any JSON-schema validator in the vendor tree). | `lib/pkp/composer.json` + lock | lib/pkp `a859b7f64f` (wave 1) | Dev-only; production installs unaffected. | No. |

## 2. App-bug / flakiness candidates surfaced by tests (NOT fixed — needs triage)

| # | Finding | Evidence | Suspected mechanism | Suggested action |
|---|---------|----------|---------------------|------------------|
| 1 | **Wizard "Comments for the Editors" intermittently lost on Submit** (`commentsForTheEditors=null` lands in the DB). User-visible data loss, not just test flake. | scenario audit §3; reproduced 4/9 under parallel load, independent of animations and of all Processor changes; legacy test fixme'd; the replacement test passes only because it REST-polls the autosave before submitting | Wizard autosave runner and Review-step `_validateOnly` poll run on independent ~500 ms timers — a queued-but-unsent autosave is invisible to validation, so Submit can race ahead of the field's persistence | Dedicated investigation (was already flagged out-of-scope in the audit); candidate fix: flush pending autosaves before enabling/handling Submit |
| 2 | **`_submissions/reviewerAssignments` ignores `searchPhrase` AND pagination** — always returns the full list. | wave-3 dashboards + reviewer-response agents, verified against the controller | Endpoint never wires the collector's search/pagination params | Upstream API completeness fix; also a perf concern for reviewers with long histories |
| 3 | **`POST /submissions` rejects editor-role user groups (400)** while the Submit-As UI offers only stage-1 groups — managers effectively can't start submissions as themselves. | wave-2 wizard-core agent; matches known pkp/pkp-lib#10929 | UI/API disagreement on permitted `userGroupId` | Track upstream issue; no local change made |
| 4 | **Side-modal wrapper permanently computes `visibility: hidden`** while inner content is visible/interactive. | wave-2/3 agents (assertions must anchor on inner content) | ui-library modal wrapper styling | Minor; worth an a11y/markup look in ui-library |
| 5 | **Submission search tokenizes on spaces and ORs LIKE matches** — multi-word phrases match everything containing any common word; fresh drafts additionally sort last (no `dateSubmitted`), so loosely-scoped searches can't find them. | api-smoke failure analysis (wave 2 verification) | `Collector::searchPhrase` keyword OR-mapping | Behavior call: maybe AND-semantics or phrase matching upstream; tests work around via unique-token search |

## 3. Flakiness sources in the local/CI environment (not app code)

- **Stale gitignored build artifacts** (`styles/build.css`, `js/build.js`): an old build
  silently re-enables UI animations → 3 false failures in wave 1 (reduced-motion,
  task-templates, issues). Open follow-up in the inventory: bootstrap-time guard
  asserting the served CSS contains a `prefers-reduced-motion` block.
- **Rotating parallel-load flake tail**: ~1–2 random specs per local full run time out on
  dialogs/API calls and pass on retry (`retries: isCI ? 1 : 0`); suspected single-threaded
  PHP dev-server saturation. Pre-existing; open follow-up.
- **Test DBs installed before 2026-06-05 carry #12049→#12800 schema drift**
  (`edit_decisions.publication_id`); symptom: 500 on any decision. Fix: reset the DB
  (one-time local ALTERs were applied in wave 1; fresh installs are correct).
- **`playwright/.auth` storage-state files can tear under concurrent cross-agent logins**
  (one corruption observed wave 2); candidate hardening: atomic write in auth.js.
