# Runbook — spec + Playwright build loop

**This file + `PROGRESS.md` are the source of truth for the build.** Any session —
fresh, restarted, `/clear`ed, or resumed after compaction — becomes correct by reading
these two files. Do not rely on conversation memory.

**The current mode lives in `PROGRESS.md`'s banner** — read it before doing
anything. The modes:

- **CALIBRATION / DRESS REHEARSAL**: one feature per session, then **STOP for
  maintainer review** (rehearsal: the session self-selects by the waves rule,
  zero maintainer input mid-run).
- **AUTONOMOUS WAVES**: see the "Autonomous waves" section below.

## What to read, when

- **The floor, every iteration**: this file + `PROGRESS.md` + the target
  feature's row in `FEATURE-MAP.md` (its atom list).
- **When authoring the spec**: `TEMPLATE.md` (the style rules + structure) and
  the exemplar `specs/tasks-discussions.md`; the feature's atoms in `atlas/*.md`.
- **When authoring tests**: `docs/e2e/PRINCIPLES.md` + the `ojs-playwright-tests`
  skill (env facts, seeded users, POMs, scenario endpoints).
- **Background contract (once per session is plenty)**: `CHARTER.md`.
- **Beyond the floor, read whatever helps** (maintainer, 2026-07-25): the list
  above is a minimum path, not a ceiling. Opus-pinned agents may read broadly —
  neighboring specs, old reports, code, atlas sweeps — with no flip risk.
  Fable agents may read broadly too, with ONE ordering rule kept: draft prose
  BEFORE accumulating probe/verification narrative (Model discipline). The
  orchestrator stays lean not to save tokens but to keep detail in subagent
  contexts where it belongs.

## Resuming a feature mid-flight (fresh/empty session)

If PROGRESS shows a row `in_progress` and the working tree holds uncommitted work
for it, RESUME — do not restart from scratch: the gates are idempotent, so re-run
them to discover where the loop stopped. In order: `lint-spec.sh` on the spec
(step 3); the feature's tests twice (step 6); then judge from the spec's own
footnotes whether live verification ran (probe dates + "live-probed" provenance
in `<sup>` notes — a spec whose contested claims carry only code anchors still
needs steps 4/7/8). Whatever a prior session's subagents reported is GONE with
that session — only what is in the files counts. When a stage's completion is
genuinely undecidable from the files, re-run that stage.

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
author, each probe agent and each verifier are separate subagents — model per role is
set in Model discipline (Fable writes specs and docs; Opus 5 runs probes,
verification, and test writing). The orchestrating session briefs them (each brief points at TEMPLATE /
PRINCIPLES — never paraphrases the rules), judges results, and is the ONLY writer of
PROGRESS rows, atlas `Claimed by:` markers, and ledger rows (single-writer
discipline). EVERY subagent brief — authors and verifiers alike — carries this line
verbatim: "Do NOT write to PROGRESS.md, atlas files, or docs/e2e/app-changes.md;
return proposed rows in your report instead." (A rehearsal test author appended a
ledger row itself because its brief omitted this.)

1. **Claim it** — set the feature's PROGRESS row to `in_progress`.
2. **Author the spec** → `docs/product/specs/<feature>.md` per `TEMPLATE.md`:
   business-language body, frontend-first, every claim anchored to a stable symbol in
   a `<sup>` footnote, canonical scenarios named by role. Draw from the feature's
   atlas atoms + the code — including the feature's rows in
   `atlas/affordances.md` (the declared-control sweep, added 2026-07-25):
   every affordance on the feature's screens must end up covered by a rule or
   scenario, DELEGATED with a verifiable pointer (the target spec must
   actually hold the behavior — mechanics live once in the owning manager
   feature, per-stage gates live here), or explicitly waived. Forward-only — see
   Definition of done; earlier verified specs retrofit when next reopened for any
   maintenance (no dedicated pass scheduled). Where the code is ambiguous, don't
   guess — put the question on the PROBE LIST the author returns with its draft
   (step 4 executes it via dedicated probe subagents; the author itself never
   probes, see Model discipline). Re-verify existing atlas `Claimed by:` markers
   against the rebuilt spec's frontmatter and adjust claims if the regrouping
   changed — never treat a surviving marker as "already covered" (markers predate
   the 2026-07-10 reset). Also check the feature's rows in
   `docs/e2e/app-changes-audit-2026-07-21.md` (pre-campaign findings): fold them
   in as candidate deviations for steps 4/7 to re-validate; the orchestrator
   amends the ledger and ticks the list. (Background in that file's header.)
3. **Lint gate** — `docs/product/lint-spec.sh specs/<feature>.md` must pass with
   ZERO findings before anything else proceeds. It catches code symbols, routes,
   HTTP codes, probe evidence, and seeded usernames leaking into PO/QA-facing body
   text (TEMPLATE rules 1 & 4), plus the deviation-phrasing term-density ceiling
   (rule 5).
4. **Live-verify every affordance claim.** Any statement about what a UI control
   *does* — "button X appears / is enabled / says Y / is absent, in state Z for role
   R" — is the error class code-reading gets WRONG: the handler can't show you the
   `:disabled` / `v-if` binding that makes a path unreachable (the rule-11 lesson:
   a claimed reopen affordance didn't exist because the control disables once
   closed). No affordance claim ships without driving it — a throwaway Playwright
   probe or the browser, across the relevant state × role matrix. Probes are
   throwaway; the retained tests are step 5's. Execution is DELEGATED: the
   author's probe list is farmed to dedicated probe subagents (see Model
   discipline) and the facts handed back to a fresh agent to finalize the spec —
   the orchestrator never runs the battery itself.
5. **Write the Playwright tests** — one per canonical scenario, per
   `docs/e2e/PRINCIPLES.md` + the `ojs-playwright-tests` skill: scenario-seed state,
   reuse/extend POMs, scope Mailpit by recipient+tag, `--output` to a private dir,
   `--reporter=list`.
6. **Run them green twice** against the live app (config-factory servers on 8000+ or
   `php -S`). If a test contradicts the spec, the **SPEC is wrong**: fix it (and
   ledger the finding if it's a real app bug). Never edit a test to pass a claim the
   app disproves.
7. **Adversarial verify** — a separate pass that attempts to refute the permission
   and state rules and attacks liveness ("reachable by any user today?"). Run as
   chunked Opus subagents; the Opus merge agent returns a neutral change list and
   a Fable agent folds accepted findings into the spec (Model discipline).
   Resolve findings or record them as Open questions.
8. **Readability verify** — a SEPARATE subagent (never the spec's author) in a strict
   persona: a QA/PO person with NO access to the code or test environment reads ONLY
   the body sections (everything above `## Reference`, minus footnotes) and must
   (a) restate every rule in their own words, AND (b) walk each canonical scenario
   as a manual test — "the steps I'd take and what I should see" — flagging any
   verb or noun they cannot map to something on screen (the s5 lesson: "pins /
   preloads the subsequent-request template" passed the lint but not a reader).
   Rewrite anything they stumble on; re-run the lint.
9. **Update PROGRESS** — status, #tests, a ONE-line note. Findings go in the spec and
   the ledger, never in PROGRESS.
10. **Commit** — `lib/pkp` and root **separately**, NEVER bump submodule pointers
    (`git restore --staged lib/pkp lib/ui-library plugins` before the root commit).
    Shared (pkp-lib) test/POM/Processor changes commit inside `lib/pkp`; specs, docs
    and OJS-only tests commit in the root. This is the single home of the commit
    rule — PRINCIPLES points here.
11. **Report** — to the maintainer: what was built, verifier findings, open
    questions, anything low-confidence (that flag goes in the PROGRESS note — it
    drives the waves sampling review). Open questions and ledger rows stay
    recorded, not resolved: with 90+ features, blocking on answers would stall the
    build (maintainer, 2026-07-10; the team returns to them over time). Then:
    calibration/rehearsal mode → STOP, do not start another feature; waves mode →
    ALSO STOP after this one feature (one feature per fresh session — see
    Autonomous waves); flag if the wave counter reached 7.

## Autonomous waves (post-rehearsal mode)

Active ONLY when the PROGRESS banner says so. The unit of work is ONE full
per-feature loop per session: every feature starts in a clean session the
maintainer launches; no multi-feature `/loop` (standing maintainer preference,
2026-07-21). Context across sessions is DISPOSABLE by design — all state lives
in PROGRESS + the files, so a compaction mid-run (or mid-feature) is routine: re-read this file + PROGRESS and, if a feature is
half-done, continue via "Resuming a feature mid-flight". A wave is a review
cadence, not a batch:

- **Selection**: the first `pending` row in PROGRESS table order. The maintainer
  may reorder rows or mark a row claimed/deferred at any time — respect edits.
- **Wave = 7 features.** The PROGRESS banner records the wave counter. When 7
  features have completed since the last maintainer sampling, do NOT start
  another: report and request a sampling review.
- **Sampling review**: the maintainer spot-reads 1–2 specs from the wave plus
  everything flagged low-confidence in PROGRESS notes. Nit findings → fix in
  place; systemic findings → **HALT the campaign**, encode the fix in
  TEMPLATE/RUNBOOK first (the s5 scenario-wording rule is the model), sweep it
  across the wave's outputs, then resume.
- **Park-and-continue is active** (rule in Ops).

## Model discipline (subagents & fallback)

- **Model assignment by role (maintainer, revised 2026-07-25): FABLE WRITES,
  OPUS 5 INVESTIGATES.**
  - **Fable-pinned** (`model: fable`): the spec author, spec-finalizer,
    readability-verifier/-fix, and any agent that writes or edits specs or
    campaign docs. The MAIN (orchestrating) session is always Fable.
  - **Opus-pinned** (`model: opus`): every probe agent, the test author and
    test-fix agents, ALL step-7 verification chunks, and the
    verification-merge / arbitration agents. Opus is better tuned against
    false safeguard flags, so investigative work — probing, adversarial
    verification, test writing — runs on it end to end. Its log rows read
    `all-opus`: annotate `(pinned)`.
  - **The language boundary at the Fable seam**: findings flow ONE way. Opus
    agents write full detail to `.reports/` files, read only by other Opus
    agents; whatever crosses INTO a Fable context — the merge agent's change
    list, probe fact sheets, orchestrator-bound returns, spawn briefs — is a
    NEUTRAL, actionable summary in the outcome voice of TEMPLATE rule 5
    ("rule 4: expected X, observed Y — see report / ledger row N"), never
    attack narrative. Everything below about flips applies to the
    Fable-pinned classes only.
- **Fable flip policy (revised 2026-07-25 — every Fable-pinned agent is now a
  writing agent).** An agent that downgrades to Opus mid-run finishes and is
  LOGGED, but its output is DISCARDED and the agent respawned fresh (max 2
  respawns; then park the feature and report). Keep writing chunks small —
  respawns are cheap, and prose is drafted BEFORE probe context accumulates
  ("Authors draft" below). (Rationale + the 2026-07-16/21 evidence: git
  history, this bullet.)
- **Split test-authoring protocol — DORMANT** while the test author is
  Opus-pinned (its trigger is a Fable flip). If test authoring ever returns to
  Fable, restore the full protocol from git history (RUNBOOK @ 88b9e02d8d:
  scaffold → serial micro-authors → stragglers → harmonizer; it rescued wave 8).
- **Only the MAIN session must never run on the wrong model.** Mitigations active
  on this machine: `switchModelsOnFlag: false` (the main session pauses instead
  of switching — subagents still switch silently under it, which is now the
  intended behavior) and the PreToolUse **fable-guard** hook (v3, 2026-07-10:
  main-transcript-only; v2's subagent scanning is retired with the
  accept-downgrade policy). A fable-guard stop means the MAIN session flipped:
  resume in a fresh session; never disable the guard mid-run.
- **The completion spot-check is a GATE for authoring rows, provenance recording
  for the rest**: after EVERY subagent finishes (clean or flipped, kept or
  discarded), append its row to the "Model-fallback log" section at the end of
  `PROGRESS.md` via
  `docs/product/log-model-mix.sh <session-dir>/subagents/agent-<id>.jsonl
  <feature> <authoring|verification|probe> <label>` — authoring and
  verification/probe rows are classed separately so per-class flip rates fall
  out of the log. For deliberately non-Fable agents (the Opus-pinned classes),
  append ` (pinned)` to the logged row's Status cell by hand — the script takes
  no flag for it. A FLIPPED authoring row triggers the discard+respawn rule
  above (log the discarded attempt too — suffix its label `-discarded`).
  Mention flips in the feature report. The 2026-07-21 rubric-review pair
  (flipped suite 4.1 vs clean suite 4.5, defects clustered in the opus tail)
  is the confirmed quality-drift precedent sampling reviews watch for.
- **Authors draft, probe agents probe.** The spec author works from code + atlas
  and returns the draft PLUS a probe list (every affordance/behavior claim
  needing live confirmation, per step 4) — drafting first is what keeps the prose
  Fable-written, since flips follow probe context. The orchestrator farms the
  list to dedicated probe subagents (fresh context, tight scope, facts-only
  returns) and hands the results to a fresh agent to fold in and finalize the
  footnotes. The ORCHESTRATOR never accumulates a probe battery in its own
  context.
- **Delegate verification CHUNKED, not monolithic**: split step 7 into 4–6
  single-purpose Opus subagents, each a fresh context with a tight brief
  (feature, chunk letter, spec path, report-file path, "follow the chunk
  instructions in RUNBOOK Model discipline") and ~5–15 tool calls. The
  instructions, written once: (a) permission re-derivation from code only,
  (b) live positive controls, (c) live denial probes, (d) state-machine edge
  seeds, (e) one ⚠-deviation reproduction each, (f) atlas coverage grep —
  each chunk reads the spec section it owns (permissions table for (a)/(c),
  Rules & state for (d), Known deviations for (e)), checks every row it finds
  there against code or the live app per its letter, and bounds negatives with
  positive controls. Each writes to its report file and returns its verdict;
  the Opus MERGE agent reads the reports and hands the Fable finalizer a
  neutral change list (the language boundary in the assignment bullet).
- **Orchestrator protection (simplified 2026-07-25): subagents return neutral
  spec feedback; detail stays in files.** Every probe/verification agent
  writes its full findings to `docs/product/.reports/<feature>-<label>.md`
  (gitignored; kept across sessions for mid-flight resume, deleted after the
  feature's commit) and returns to the orchestrator only what was missed or
  needs considering — spec/test feedback in the rule-5 outcome voice. That
  neutral-return discipline IS the protection. Keep spawn briefs
  matter-of-fact pointers (as in the chunk bullet) rather than restated
  attack scenarios — dense adversarial briefs were the historical
  main-session kill vector (2026-07-14/16/24 forensics; the stricter
  machinery lives in git history — re-tighten from there if main-session
  flags ever return). The final MAINTAINER REPORT may describe findings in
  plain language. If the main session is flag-killed anyway: END the session
  and let a FRESH one resume the remaining gates from files — never recompose
  the same turn.
- **The orchestrator NEVER completes probe or verification work inline.** (The
  earlier "bounded inline exception" is REVOKED, 2026-07-10: it walked the
  dress-rehearsal orchestrator into running the probe battery itself, the main
  session got flagged, and the whole run died with nothing on disk. Inline
  completion is how you lose the controlling agent.) If the orchestrator's
  context runs low mid-feature, finish the current gate, commit what is
  committed-worthy, and END the session — a fresh one resumes via "Resuming a
  feature mid-flight".
- **Session cadence** (one feature per fresh session) lives in Autonomous waves;
  fresh context also zeroes accumulated narrative as a side benefit.
- **The completion notification is the ONLY reliable subagent liveness signal.** Never
  judge a subagent by transcript size or token count (that misled an orchestrator into
  killing working agents). If an agent looks stuck, check ground truth — has its
  target file changed? — otherwise wait.

## Ops & environment safeguards

- **Live-probe etiquette** (the CHARTER invariant, operationalized): scratch
  journals via the scenario endpoints for anything mutating; `publicknowledge` and
  the seeded users are read-only; never `clearAll()` Mailpit; test key
  `X-Test-Key: playwright-test-key` against servers on ports 8000+ (env facts in
  `.claude/skills/ojs-playwright-tests/`).
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
- **`.reports` cleanups**: never delete `.reports/opus-eval*/` while
  `docs/product/QUEUE.md` still lists work referencing them.

## Definition of done

- **Per feature**: spec `verified` + lint-clean; every `atlas/affordances.md`
  atom on the feature's screens covered / verifiably delegated / waived
  (features built after 2026-07-25); scenario tests green twice; PROGRESS
  row updated (one-line note); committed; **maintainer sign-off (calibration mode)**.
- **Campaign**: the campaign-level bar lives in `CHARTER.md`'s Definition of done
  (single home).
