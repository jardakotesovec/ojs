# Runbook — spec + Playwright build loop

**This file + `PROGRESS.md` are the source of truth for the build.** Any session —
fresh, restarted, `/clear`ed, or resumed after compaction — becomes correct by reading
these two files. Do not rely on conversation memory.

**The current mode lives in `PROGRESS.md`'s banner** — read it before doing
anything. The modes:

- **CALIBRATION / DRESS REHEARSAL**: build **ONE feature** end-to-end per session,
  then **STOP for maintainer review**. In calibration the maintainer picks the
  feature; in the dress rehearsal the session picks it itself by the waves
  selection rule and must complete with ZERO maintainer input mid-run — the
  rehearsal exists to prove the docs alone produce sign-off quality cold.
- **AUTONOMOUS WAVES**: see the "Autonomous waves" section below.

## What to read, when (do NOT read everything up front)

- **Every iteration**: this file + `PROGRESS.md` + the target feature's row in
  `FEATURE-MAP.md` (its atom list) — nothing else until you need it.
- **When authoring the spec**: `TEMPLATE.md` (the four style rules + structure) and
  the exemplar `specs/tasks-discussions.md`; the feature's atoms in `atlas/*.md`.
- **When authoring tests**: `docs/e2e/PRINCIPLES.md` + the `ojs-playwright-tests`
  skill (env facts, seeded users, POMs, scenario endpoints).
- **Background contract (once per session is plenty)**: `CHARTER.md`.

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
author, and each verifier are separate subagents pinned `model: fable` (see Model
discipline). The orchestrating session briefs them (each brief points at TEMPLATE /
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
   feature, per-stage gates live here), or explicitly waived. Forward-only:
   applies to features built after 2026-07-25; earlier verified specs
   retrofit during grooming. Where the code is ambiguous, don't guess — put
   the question on the PROBE LIST the author returns with its draft (step 4 executes
   it via dedicated probe subagents; the author itself never probes, see Model
   discipline). Note: atlas `Claimed by:` markers survive from the
   scratched round as feature-name claims — re-verify the atom list matches the
   rebuilt spec's frontmatter and adjust claims if the regrouping changed; do not
   treat an existing marker as "already covered". Also check the EXPOSURE LIST in
   `docs/e2e/app-changes-audit-2026-07-21.md` for pre-campaign ledger rows owned
   by this feature (round-1 findings unchecked since their tests were deleted):
   treat them like standing ledger rows — fold them into the spec as candidate
   deviations, let steps 4/7 re-validate them live, and have the orchestrator
   amend the ledger row (and tick it off the exposure list) if the app diverged.
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
   and state rules and attacks liveness ("reachable by any user today?"). Resolve
   findings or record them as Open questions.
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
    continue with the next feature (next /loop iteration or fresh session),
    unless a wave boundary, a maintainer scope directive in the PROGRESS banner,
    or a halt condition hit (see Autonomous waves).

## Autonomous waves (post-rehearsal mode)

Active ONLY when the PROGRESS banner says so. The unit of work stays ONE full
per-feature loop per iteration; the maintainer typically runs iterations back to
back in a single `/loop` session. Context across iterations is DISPOSABLE by
design — all state lives in PROGRESS + the files, so a compaction mid-run (or
mid-feature) is routine: re-read this file + PROGRESS and, if a feature is
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
- **Park-and-continue is active** (see Ops): 3 failed attempts → `parked` with
  the reason, move on.

## Model discipline (subagents & fallback)

- **Model assignment by role (maintainer, 2026-07-25, from the Opus 5 eval —
  full record in git history: OPUS5-EVAL-PLAN.md @ 88b9e02d8d, removed after
  the eval closed): SPEC WORK stays on Fable —
  spec-author, spec-finalizer, readability-verifier/-fix, verification chunks,
  merge/arbitration agents are pinned `model: fable`. PROBES and TEST WRITING
  run on Opus 5 — all probe agents, the test-author (and the scaffold /
  micro-authors / harmonizer when the split protocol runs), and test-fix
  agents are pinned `model: opus`. Opus agents have no safeguard-flip
  behavior: their log-model-mix rows read `all-opus` — annotate `(pinned)` so
  per-class flip rates stay meaningful. Everything below about flips applies
  to the FABLE-PINNED classes only. The draft-before-probe structure, pointer
  briefs, and chunked verification stay unchanged for every class.**
- **Fable flip policy (maintainer, revised 2026-07-21; applies to the
  fable-pinned classes above). A mid-run downgrade to Opus is handled BY CLASS:
  AUTHORING agents (spec/test/POM/readability writing) that flip are allowed to
  finish and are LOGGED, but their output is DISCARDED and the chunk respawned
  fresh (max 2 respawns; for the TEST AUTHOR, exhausted respawns switch to the
  SPLIT TEST-AUTHORING protocol below instead of parking — park only if that
  also fails; other authoring chunks park the feature and report);
  VERIFICATION and PROBE agents that flip continue and their output is KEPT**
  (their results get merged and cross-checked, so a flipped verifier is low
  risk). Rationale for the revision: the 2026-07-16 editorial-decisions suite —
  test-author flipped at 122/232 under the old accept-everything policy — failed
  a rubric review precisely in its opus-tail half (the s12 inversion; see the
  fallback memory / ledger context), while the 2026-07-21 from-scratch rebuild
  ran 23/23 agents clean on the same permission-dense feature, showing flips are
  now rare enough that discard+respawn costs ~nothing in expectation. The
  original 2026-07-10 rationale (flips follow probe-heavy context; retry loops
  once burned hours) still governs the STRUCTURE below: prose is drafted BEFORE
  probe context accumulates ("Authors draft"), and short fresh chunk contexts
  flip less — chunk authoring small so a respawn is cheap.
- **Split test-authoring protocol (maintainer, 2026-07-21; demoted to FALLBACK
  2026-07-22).** Default is always a MONOLITHIC test author — since TEMPLATE
  rule 5 + the lint density ceiling, spec content no longer carries the flip
  trigger (A/B proof: the same permission-matrix spec flipped 2 monolithic
  authors at msgs 26/19 unswept, then authored 234 msgs fable-clean once
  neutrally phrased, at equal rubric quality 4.5/5 and lower cost — one agent,
  one coherent file, no harmonizer). Use the split protocol ONLY when a
  monolithic test-author's respawns exhaust (it rescued wave 8: 12/12 agents
  clean on the then-unswept spec).
  Shape — one file, many small authors, quality held by scaffold + harmonizer:
  1. **Scaffold agent** (first, before dense context): file skeleton — imports,
     fixtures, tag helpers, `test.use`, header coverage map naming every canonical
     scenario, empty stubs in spec order — plus ALL POM extensions, once, from the
     probe reports' DOM facts. No test bodies.
  2. **One micro-author per scenario, IN SERIES, fresh context each.** Pointer
     brief only (scenario id, spec path, file path, PRINCIPLES/skill — never
     restate the matrix). It implements exactly its stub, using the completed
     tests already in the file as style examples, runs ITS OWN test to green
     (bounded, ≤2 fix cycles), and writes a claim→assertion map for its scenario
     to its `.reports` file. Log each as authoring `test-author-<sN>`.
     Flip → discard that one test's diff, respawn once; second flip → mark the
     scenario a STRAGGLER and continue the series (scenario-level parking).
  3. **Stragglers**: one final tight retry each at the end; if it flips again the
     orchestrator MAY keep an Opus-written version of that single test but MUST
     flag it in the PROGRESS note for sampling review.
  4. **Harmonizer** (authoring class — discard+respawn on flip): reads the whole
     file; dedupes helpers, normalizes naming/selectors/wait patterns, checks the
     header map against bodies, prunes zero-caller POM methods, and verifies each
     test asserts its scenario's FULL final clause (the s12 rubric lesson).
  5. Steps 6–8 (green twice on the whole suite, adversarial verify, readability)
     run unchanged afterwards.
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
  out of the log. A FLIPPED authoring row triggers the discard+respawn rule
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
  single-purpose subagents, each a fresh context with a tight brief and ~5–15 tool
  calls — (a) permission re-derivation from code only, (b) live positive controls,
  (c) live denial probes, (d) state-machine edge seeds, (e) one ⚠-deviation
  reproduction each, (f) atlas coverage grep. Each returns a small structured
  verdict; the orchestrator merges. Chunks that downgrade mid-run finish and
  count — record the flip, don't re-run.
- **Chunk briefs are POINTERS, never payloads** (2026-07-16: two main-session
  flag-pauses fired ON the Agent calls composing the denial/arbitration briefs —
  enumerating deny matrices and "adversarially refute" instructions in a spawn
  prompt is what trips the classifier, whichever side generates or reads it;
  it is also why denial chunks twice started life all-Opus). The spawn prompt
  for a verification chunk contains ONLY: the feature name, the chunk letter,
  the spec path, the report-file path, and "follow the chunk instructions in
  RUNBOOK step 7" — the full instructions live HERE, written once: each chunk
  reads the spec section it owns (permissions table for (a)/(c), Rules & state
  for (d), Known deviations for (e)), checks every row it finds there against
  code or the live app per its letter, bounds negatives with positive controls,
  writes findings to its report file, and returns a ≤10-line verdict. For
  arbitration chunks: name the two report files in conflict and the rule number
  — never restate the conflicting behaviors in the prompt. Agent `description`
  fields stay neutral ("check spec table (c) live"), not adversarial.
  The SAME pointer rule binds two spots that have slipped (2026-07-24 flag
  forensics — both contributed to a double main-session kill): (i) AD-HOC
  probes spawned mid-loop — brief = report file + section + "reproduce the
  finding there", NEVER a restatement of the scenario (an 835-char brief
  restating a delete-bypass scenario produced a born-flipped probe at msg 5);
  (ii) the VERIFICATION-MERGE brief is a pointer too — the report-file paths
  plus "follow RUNBOOK step 7 merge duties", nothing else; the merge agent
  reads the findings, the orchestrator must not re-narrate them while
  composing the brief. And after a flag-kill, do NOT recompose the same dense
  turn on resume — END the session and let a FRESH one run the remaining
  gates (resume-from-files is designed for exactly this; the 07-24 second
  kill was the same turn re-attempted in the same context).
- **Keep findings OUT of the orchestrator's context — reports go to files**
  (2026-07-14, after the Area-1 run's main session was flag-paused 3×; term-density
  analysis showed each flag followed accumulated permission-testing narrative —
  denial verdicts, bypass descriptions — mostly while composing reports).
  Every probe/verification brief instructs the agent to WRITE its full findings to
  `docs/product/.reports/<feature>-<label>.md` (gitignored, kept across sessions
  for mid-flight resume; delete the feature's files after its commit) and RETURN
  at most ~10 lines: verdict + file pointer + anything the orchestrator must act
  on. The verification-merge / spec-finalizer agents READ those files — the
  orchestrator never holds the detail. In PROGRESS notes and commit messages the
  orchestrator cites ledger rows and Open questions by number. RELAXED
  2026-07-21 (flag-pauses have subsided — safeguards more accurate now): the
  final MAINTAINER REPORT may describe findings in plain language again;
  readability for the maintainer beats term-density caution there. If
  main-session flag-pauses return, re-tighten this first. Volume remains the
  lever — vocabulary substitution is proven useless.
- **The orchestrator NEVER completes probe or verification work inline.** (The
  earlier "bounded inline exception" is REVOKED, 2026-07-10: it walked the
  dress-rehearsal orchestrator into running the probe battery itself, the main
  session got flagged, and the whole run died with nothing on disk. Inline
  completion is how you lose the controlling agent.) If the orchestrator's
  context runs low mid-feature, finish the current gate, commit what is
  committed-worthy, and END the session — a fresh one resumes via "Resuming a
  feature mid-flight".
- **ONE FEATURE PER FRESH SESSION is the standing mode (maintainer, 2026-07-21)**
  — originally a flip mitigation (a flag-pause can break a /loop wakeup chain:
  the session sits idle until re-prompted; 14 pauses in 3 permission-dense
  features on 2026-07-16), it is now kept as a permanent preference for
  consistency: every feature starts in a clean session the maintainer launches,
  no multi-feature /loop. Fresh context zeroes accumulated narrative as a side
  benefit; the PROGRESS banner + wave counter keep the cadence.
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

- **Per feature**: spec `verified` + lint-clean; every `atlas/affordances.md`
  atom on the feature's screens covered / verifiably delegated / waived
  (features built after 2026-07-25); scenario tests green twice; PROGRESS
  row updated (one-line note); committed; **maintainer sign-off (calibration mode)**.
- **Campaign**: every feature `done` or `parked`; full suite ≤ 700 tests, ≤ 25 min on
  a fresh DB; parked list + accumulated ledger findings reported.
