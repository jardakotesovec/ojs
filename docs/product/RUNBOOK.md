# Runbook — spec + Playwright build loop

**This file + `PROGRESS.md` are the source of truth for the build.** Any session —
fresh, restarted, `/clear`ed, or resumed after compaction — becomes correct by reading
these two files. Do not rely on conversation memory.

**Current mode: CALIBRATION (since the 2026-07-10 reset).** Build **ONE feature**
end-to-end per session, then **STOP for maintainer review** — the maintainer picks
each next feature and signs off before another starts. The autonomous multi-feature
loop resumes only when the maintainer declares calibration done.

## What to read, when (do NOT read everything up front)

- **Every iteration**: this file + `PROGRESS.md` + the target feature's row in
  `FEATURE-MAP.md` (its atom list) — nothing else until you need it.
- **When authoring the spec**: `TEMPLATE.md` (the four style rules + structure) and
  the exemplar `specs/tasks-discussions.md`; the feature's atoms in `atlas/*.md`.
- **When authoring tests**: `docs/e2e/PRINCIPLES.md` + the `ojs-playwright-tests`
  skill (env facts, seeded users, POMs, scenario endpoints).
- **Background contract (once per session is plenty)**: `CHARTER.md`.

## Budget & ceilings (HARD)

- **≤ 700 tests total**, **≤ 25 min** full-suite runtime on a fresh DB. The 700 is
  the hard number; per-feature tiers exist to distribute it WELL — more complex or
  more important features get more tests than simpler/less important ones
  (maintainer, 2026-07-10).
- Tiers live in each PROGRESS row (`Budget: tier·target`): H 10–13 (core workflows,
  big permission matrices, state machines), M 6–8 (standard), L 3–4 (simple
  CRUD/read-only). The spec's canonical-scenario count follows the tier ±1–2 by
  author judgment — coverage of the feature's real risk is the goal, the tier keeps
  the overall distribution honest. Tiers on unbuilt rows are provisional — respect
  maintainer edits.

## The per-feature loop

**Orchestration shape**: the heavy authoring is DELEGATED — the spec author, the test
author, and each verifier are separate subagents pinned `model: fable` (see Model
discipline). The orchestrating session briefs them (each brief points at TEMPLATE /
PRINCIPLES — never paraphrases the rules), judges results, and is the ONLY writer of
PROGRESS rows, atlas `Claimed by:` markers, and ledger rows (single-writer
discipline).

1. **Claim it** — set the feature's PROGRESS row to `in_progress`.
2. **Author the spec** → `docs/product/specs/<feature>.md` per `TEMPLATE.md`:
   business-language body, frontend-first, every claim anchored to a stable symbol in
   a `<sup>` footnote, canonical scenarios named by role. Draw from the feature's
   atlas atoms + the code; where the code is ambiguous, probe the live app (step 4's
   etiquette), don't guess. Note: atlas `Claimed by:` markers survive from the
   scratched round as feature-name claims — re-verify the atom list matches the
   rebuilt spec's frontmatter and adjust claims if the regrouping changed; do not
   treat an existing marker as "already covered".
3. **Lint gate** — `docs/product/lint-spec.sh specs/<feature>.md` must pass with
   ZERO findings before anything else proceeds. It catches code symbols, routes,
   HTTP codes, probe evidence, and seeded usernames leaking into PO/QA-facing body
   text (TEMPLATE rules 1 & 4).
4. **Live-verify every affordance claim.** Any statement about what a UI control
   *does* — "button X appears / is enabled / says Y / is absent, in state Z for role
   R" — is the error class code-reading gets WRONG: the handler can't show you the
   `:disabled` / `v-if` binding that makes a path unreachable (the rule-11 lesson:
   a claimed reopen affordance didn't exist because the control disables once
   closed). No affordance claim ships without driving it — a throwaway Playwright
   probe or the browser, across the relevant state × role matrix. Probes are
   throwaway; the retained tests are step 5's.
5. **Write the Playwright tests** — one per canonical scenario, per
   `docs/e2e/PRINCIPLES.md` + the `ojs-playwright-tests` skill: scenario-seed state,
   reuse/extend POMs, scope Mailpit by recipient+tag, `--output` to a private dir,
   `--reporter=list`.
6. **Run them green twice** against the live app (config-factory servers on 8000+ or
   `php -S`). If a test contradicts the spec, the **SPEC is wrong**: fix it (and
   ledger the finding if it's a real app bug). Never edit a test to pass a claim the
   app disproves.
7. **Adversarial verify** — a separate pass that attempts to refute the permission
   and state rules and attacks liveness ("reachable by any user today?"). Resolve
   findings or record them as Open questions.
8. **Readability verify** — a SEPARATE subagent (never the spec's author) in a strict
   persona: a QA/PO person with NO access to the code or test environment reads ONLY
   the body sections (everything above `## Reference`, minus footnotes) and must be
   able to restate every rule in their own words. Rewrite anything they stumble on;
   re-run the lint.
9. **Update PROGRESS** — status, #tests, a ONE-line note. Findings go in the spec and
   the ledger, never in PROGRESS.
10. **Commit** — `lib/pkp` and root **separately**, NEVER bump submodule pointers
    (`git restore --staged lib/pkp lib/ui-library plugins` before the root commit).
    Shared (pkp-lib) test/POM/Processor changes commit inside `lib/pkp`; specs, docs
    and OJS-only tests commit in the root. This is the single home of the commit
    rule — PRINCIPLES points here.
11. **STOP (calibration mode)** — report to the maintainer: what was built, verifier
    findings, open questions, anything low-confidence. Do not start another feature.
    The review is about spec/test QUALITY and process fit — Open questions and ledger
    rows stay recorded, not resolved: with 90+ features, blocking on answers would
    stall the build (maintainer, 2026-07-10; the team returns to them over time).

## Model discipline (subagents & fallback)

- **Use Fable and pin it explicitly** (`model: fable`) on every spec/test/verifier
  subagent.
- **Fable's safeguards can silently swap a session — or a subagent — to Opus mid-run**
  (`model_refusal_fallback`). This went unnoticed for days in July 2026 and is why the
  pre-reset corpus was mostly authored by the wrong model. Mitigations now active on
  this machine: `switchModelsOnFlag: false` (the session pauses instead of switching)
  and a PreToolUse **fable-guard** hook that hard-stops any session that started on
  Fable and is now served by another model. **A fable-guard stop is working as
  intended: resume in a FRESH session** (new sessions restore Fable); never disable
  the guard mid-run.
- Spot-check per feature: the last assistant `message.model` in the session
  transcript must be `claude-fable-5`.
- **The completion notification is the ONLY reliable subagent liveness signal.** Never
  judge a subagent by transcript size or token count (that misled an orchestrator into
  killing working agents). If an agent looks stuck, check ground truth — has its
  target file changed? — otherwise wait.

## Ops & environment safeguards

- **DB hygiene**: reset (`npm run test:e2e:reset`) before any full-suite timing run
  and every ~8–10 features (long-lived DBs accumulate drafts whose worker tokens
  collide — ledger §3). Never delete `config.test.inc.php` alone. The test DB is
  **PostgreSQL** (`ojs_test`, driver postgres9) — Postgres-specific defects reproduce
  in-env.
- **After a killed/aborted test gate**: `ps aux | grep chromium` and kill orphans
  before re-running, or the re-run timing is garbage. Restart the PHP server with an
  ABSOLUTE `-t` docroot. If the parallel result line shows a passed count, re-run only
  serial; else re-run both (`--project=ojs`, then `--project=serial --no-deps`).
- **Plugin-submodule alignment**: if the app fatals on a plugin "contains N abstract
  methods" error, align that plugin submodule to the SHA root records
  (`git ls-tree HEAD plugins/<path>` → check it out in the submodule). Do NOT blow
  away webFeed/credit, which carry local env-patches.
- **Env invariants**: server-side egress firewalled; `[schedule] task_runner=Off`;
  DTD/XSD mirrors via `XML_CATALOG_FILES`; Mailpit read-only scoped
  (`pkpMail.find({to, contains: tag})`); globally-scanning ops in serial specs.
- **Park-and-continue** (autonomous mode only): 3 failed attempts → mark the row
  `parked` with the reason and move on. In calibration mode, stop and report instead.

## Definition of done

- **Per feature**: spec `verified` + lint-clean; scenario tests green twice; PROGRESS
  row updated (one-line note); committed; **maintainer sign-off (calibration mode)**.
- **Campaign**: every feature `done` or `parked`; full suite ≤ 700 tests, ≤ 25 min on
  a fresh DB; parked list + accumulated ledger findings reported.
