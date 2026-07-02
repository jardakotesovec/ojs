# Big-Bang Runbook — spec + Playwright build loop

**This file + `PROGRESS.md` are the single source of truth for the autonomous
spec-and-test build.** Any session — fresh, restarted, `/clear`ed, or resumed after
compaction — becomes correct by reading these two files (plus CHARTER/TEMPLATE/
FEATURE-MAP). Do not rely on conversation memory. The loop is **stateless per
iteration**: each wake-up reads PROGRESS, does the next `pending` feature, updates
PROGRESS, commits, continues.

## Kick-off / resume prompt (paste this in any session)

The same prompt starts the run and resumes it after any break — the loop is
file-driven, so `PROGRESS.md` always says where to pick up. For an unattended run,
wrap it with the `/loop` skill (self-paced) so it re-invokes itself: type `/loop` then
paste the prompt. Plain paste also works as a one-shot nudge.

> Run the OJS product-spec big-bang build. Read `docs/product/RUNBOOK.md` and
> `docs/product/PROGRESS.md` (the source of truth) and follow the per-feature loop
> there, resuming at the next feature that isn't `done`/`parked`. For each: build the
> spec + Playwright tests, run them green against the app, verify, update PROGRESS,
> commit, and keep going autonomously until all 92 features are done or parked. Use
> Fable for subagents (the default, most-capable model) and judge them only by
> completion notifications, never by transcript size or token count. Respect the
> ≤700-test / ≤25-min budget and park-and-continue after 3 failed attempts.

## How to resume (entry point for any session)

1. Read `docs/product/RUNBOOK.md` (this file), `docs/product/PROGRESS.md`,
   `docs/product/CHARTER.md`, `docs/product/TEMPLATE.md`, `docs/product/FEATURE-MAP.md`,
   and the `ojs-playwright-tests` skill.
2. In PROGRESS, find the first feature whose row is not `done`/`parked`. If one is
   `in_progress`, check the working tree — resume or reset it (uncommitted partial work
   = re-do that feature; a feature is only "done" once committed + PROGRESS says so).
3. Run the per-feature loop below on it. Then the next. Repeat until all done/parked.

## Scope & inputs

- **Scope: OJS only** (CHARTER Scope). 92 features in `FEATURE-MAP.md` v1 (Areas 1–8).
  Background & pipelines items are documented infra, NOT features to spec.
- **Prior tests: CLEAN-SLATED (done 2026-07-02).** All 114 round-1 scenario `*.spec.js`
  files (under `lib/pkp/playwright/tests/` + `playwright/tests/`) were **deleted** so the
  new spec-driven build can't anchor to the old, less-robust scenarios. Do NOT read or
  resurrect them — git history has them if ever needed. **KEPT (reuse/extend):** the
  setup project (`bootstrap.setup.js`), POMs (`playwright/pages/` + `lib/pkp/playwright/
  pages/`, ~30 files), `support/` helpers (~8), `fixtures/`, `config-factory.js`, the
  serial project wiring, scenario-seeding endpoints (`api/v1/_test/` — app code), and the
  `ojs-playwright-tests` skill. The loop writes NEW tests per feature from that
  infrastructure. tasks-discussions + publication-versioning **specs** already exist and
  are verified; their tests get built fresh by the loop like every other feature.
- Per-feature atom coverage is in that feature's row in FEATURE-MAP (`atoms:`).

## Budget & ceilings (HARD)

- **≤ 700 tests total**, **≤ 25 min** full-suite runtime on a **fresh DB**.
- ~7–8 tests/feature average; more for heavy features (editorial-decisions, the review
  cluster), fewer for simple CRUD. Canonical-scenario level, not per-rule.
- After each feature, update the running totals in PROGRESS. If tests-used projects
  over 700, or the last full-suite timing trends toward 25 min, **trim** (drop the
  lowest-value scenarios) before continuing and note it in PROGRESS.

## The per-feature loop

For the next `pending` feature:

1. **Claim it** — set its PROGRESS row to `in_progress`.
2. **Author the spec** → `docs/product/specs/<feature>.md` per `TEMPLATE.md`:
   business-level, frontend-first, symbol anchors (not line numbers), permission +
   Fields tables, anchors as `<sup>` footnotes, Rules & state, Side effects, Canonical
   scenarios (3–6 named journeys — these ARE the test plan), Known deviations, Reference
   block at the end. Draw from the feature's atlas atoms + the code. Where the code is
   ambiguous, verify against the live app (below), don't guess.
3. **Write the Playwright tests** — one per Canonical Scenario, per the
   `ojs-playwright-tests` skill: scenario-seed state, reuse/extend POMs, scope Mailpit
   by recipient+tag, `--output` to a private dir, `--reporter=list`.
4. **Run them against the live app** (`php -S localhost:7001` or the config-factory
   servers on 8000+). Green **twice** consecutively. For every UI-affordance claim
   ("control X appears / is enabled / says Y in state Z"), drive it — Chrome or a
   Playwright probe — across the relevant state × role matrix. Reset/tweak the DB as
   needed.
5. **Feedback discipline** — if a test contradicts the spec, the **SPEC is wrong**: fix
   it (and, if it's a real app bug, add a row to `docs/e2e/app-changes.md` §2 — NON-
   blocking, for the maintainer). Never edit a test to pass a claim the app disproves.
6. **Adversarial verify** — a pass that tries to refute the permission and state rules
   and attacks liveness ("reachable by any user today?"). Resolve or record as Open
   questions.
7. **Update PROGRESS** — status `done`, #tests, runtime delta, atoms claimed, findings.
8. **Commit** — `lib/pkp` and root **separately**, NEVER bump submodule pointers
   (`git restore --staged lib/pkp lib/ui-library plugins` before the root commit).

## Safeguards & operating rules

- **Subagents: use Fable** (the default / top-tier model) — it's the most capable for
  spec + test authoring and ran cleanly throughout this session (the four feature-map
  strategies, the synthesis, the restructure were all Fable). The **completion
  notification is the ONLY reliable liveness signal.** Do NOT judge a subagent by
  transcript byte-size or token count — that repeatedly misled the orchestrator into
  thinking *working* agents were "hung" and killing them (they were mid-read before
  writing their output once at the end). If an agent looks stuck, check the ground
  truth (has it edited its target file / made a git change?); otherwise just wait for
  the completion notification. There is no confirmed Fable hang.
- **Park-and-continue** — if a feature fails to reach done after **3 attempts**, mark
  its row `parked` with the reason and move on. One bad feature must never stall the
  other 91.
- **DB hygiene** — reset (`npm run test:e2e:reset`) before any full-suite timing run and
  every ~8–10 features (long-lived DBs accumulate drafts whose worker tokens collide;
  see `docs/e2e/app-changes.md` §3). Never delete `config.test.inc.php` alone.
- **Plugin-submodule alignment after the rebase** — the branch was rebased onto main,
  which added `IDoiRegistrationAgency::depositPeerReviews/exportPeerReviews`; the
  `crossref` plugin submodule lagged and fataled boot (abstract-methods error). FIXED
  2026-07-02 by checking crossref out at root's recorded commit (`61a64961`, #12509). If
  the app fatals on a plugin "contains N abstract methods" error, align that plugin
  submodule to the SHA root records (`git ls-tree HEAD plugins/generic/<p>` → checkout
  it in the submodule) — do NOT blow away webFeed/credit which carry local env-patches.
- **Env invariants** (unchanged from round 1): all server-side egress firewalled;
  `[schedule] task_runner=Off`; DTD/XSD mirrors via `XML_CATALOG_FILES`; Mailpit reads
  only `pkpMail.find({to, contains: tag})`; serial specs for globally-scanning ops.
- **Commit continuously** so the run is always resumable from a clean-ish tree.
- **Findings → ledger** (`docs/e2e/app-changes.md`), never block on them.

## Definition of done

- **Per feature:** spec `verified` + its scenario tests green twice + PROGRESS row
  updated + committed.
- **Campaign:** every feature `done` or `parked`; full suite ≤ 700 tests, ≤ 25 min on a
  fresh DB; parked list + accumulated findings reported for the maintainer's return.

## For the maintainer's review (leave for Jarda)

- The `parked` list with reasons.
- New rows in `docs/e2e/app-changes.md` §1/§2 (bugs/deviations found).
- Any feature marked `done` but flagged low-confidence in its PROGRESS Notes.
