# Opus 5 authoring evaluation — experiment plan (APPROVED 2026-07-25)

**Maintainer approved 2026-07-25 with all recommendations as written:**
R = `stage-participants`, H = `reviewer-response`, Opus arm pins ALL subagents
(`model: opus`), thresholds as predeclared below, session order S1→S2→S3→S4.

**Question:** Can Opus 5 (`claude-opus-5`) author specs + Playwright tests for this
campaign at maintainer sign-off quality — i.e., replace Fable 5 in the AUTHORING
class (and possibly everywhere)?

**Why it matters:** every structural complication in the RUNBOOK's Model
discipline — discard+respawn, draft-before-probe, pointer briefs, chunked
verification, the fable-guard, flag-kill session restarts — exists to work around
Fable's safeguard flips. Opus 5 has no flip behavior and costs less. If its
output clears the same bar, the campaign gets simpler, cheaper, and immune to the
flag-kill failure mode. Prior evidence is about Opus **4.8** (the fallback
model): the 07-16 flipped suite scored 4.1 vs 4.5 and held the only critical
defect (the s12 inversion) in its Opus tail. **That evidence does NOT transfer to
Opus 5** — a new model, a full tier above 4.8. This experiment replaces
extrapolation with measurement.

**What is being compared:** the MODEL only. Both arms run the identical RUNBOOK
per-feature loop (same pipeline, same briefs, same gates, same budget tiers).
The orchestrator stays Fable on the main session (guard v3 protects it) and in
both arms acts mechanically: brief → gate → merge, with any intervention beyond
gate-enforcement logged in the session log and disclosed to judges.

---

## Design overview — two experiments + blind judging

| | Experiment R — replay (ground truth) | Experiment H — head-to-head (cold) |
|---|---|---|
| Feature | `stage-participants` (M·8, done) | `reviewer-response` (H·10, next pending) |
| Opus arm | rebuilds it blind in a worktree | builds it in a worktree branched pre-Fable-build |
| Fable arm | **the existing verified build** (no new work) | builds it as the normal next campaign session |
| Ground truth | verified spec, 9 green tests, ledger rows 229–234, two 4.5 rubric datapoints | none — settled by cross-verification + blind panel + maintainer |
| Marginal cost | 1 feature build | 1 feature build (Fable build was due anyway) |

R measures Opus against an answer key we trust; H measures it on genuinely
unseen work where neither model has an anchoring advantage. Either alone is
attackable (R: contamination/drift caveats; H: no ground truth) — together they
triangulate.

Why `stage-participants` for R: it has the campaign's best characterization
(two independent 4.5-rubric datapoints — split-protocol and monolithic rebuilds),
six live-verified ledger rows to test rediscovery against, and a rule-5-swept
spec, at moderate (M·8) size. Why `reviewer-response` for H: it is simply the
next row in table order, so the campaign advances by one feature regardless of
outcome — the experiment's only pure overhead is the losing arm + judging.

## Experiment R — replay protocol

**Implementation note (2026-07-25):** isolation runs on temporary IN-TREE eval
branches (root + lib/pkp) with the removals COMMITTED, not a git worktree — a
fresh worktree would need `git submodule update`, which is forbidden in this
repo (root records main's pointers, not the campaign's checkouts). Semantics
are identical: reference artifacts absent from the working tree, reachable only
via history reads the contamination audit checks for. Restore = switch back to
`e2e_revamp_fable_2` (root) / the prior lib/pkp branch; app code is untouched
by the eval commits, so the live server keeps serving throughout.

1. Create the isolated copy (see implementation note). In it, remove:
   `specs/stage-participants.md`, its spec-derived test file(s), ledger rows
   229–234 in `docs/e2e/app-changes.md`, the feature's PROGRESS row content
   (reset to `pending`), and any `.reports/stage-participants-*` files.
2. Run the standard RUNBOOK loop in that worktree with **every subagent pinned
   `model: opus`** (authoring, probe, verification alike — the question is
   whether Opus can run the whole loop). Live probing targets the normal test
   app; `npm run test:e2e:reset` before starting.
3. Findings stay in the worktree — no writes to the real ledger, PROGRESS, or
   atlas. The orchestrator collects proposed ledger rows for scoring only.
4. **Contamination audit (voids the run if failed):** post-run, grep every
   subagent transcript for reads of the removed files via git history
   (`git show`, `git log -p`, `git cat-file`, pre-worktree paths). RUNBOOK
   already forbids history reads; this verifies it.

**Known biases, accepted and directional:** the worktree retains POMs, atlas
Hint fixes, and the s1 `expectToast` flake fix that the reference build created
— all favor the Opus candidate. A spec-side quote-case fix also survives. Bias
direction is what makes this acceptable: if Opus **underperforms** despite the
head start, the conclusion is solid; if it matches, Experiment H (no such head
start) is the tiebreaker.

**R-only metric — deviation rediscovery:** of the 6 reference ledger rows
(229–234), how many does the Opus build independently rediscover and verify
live? These are app facts found by Fable's build — recall against them is the
single most objective "did it see what Fable saw" measure. Also count *novel*
findings, each live-validated before crediting (a novel finding that survives
validation is a point FOR Opus and gets folded into the real ledger afterward
regardless of the experiment's outcome).

## Experiment H — head-to-head protocol

1. **Session H-F (Fable arm):** the normal next campaign session builds
   `reviewer-response` per the standing directive, in-tree, standard policy
   (pinned fable, flips handled per RUNBOOK). Commit as usual. This arm is
   canonical unless the maintainer later swaps it.
2. **Session H-O (Opus arm):** worktree branched from the commit **before**
   H-F's commits (so the Fable spec/tests/ledger rows are invisible). DB reset
   first. All subagents pinned `model: opus`. Same no-real-ledger rule as R.
3. Serialize the sessions (single test DB); order effects are nil because the
   worktree branch point, not the calendar, controls information flow.
4. Same contamination audit as R (H-O transcripts must not touch H-F's commits).
5. Afterward: unique verified findings from the losing arm get folded into the
   ledger (app facts are model-independent).

## Judging & blinding

A dedicated judging session (fresh, after all builds) assembles a **blind
packet** per experiment: the two artifacts copied to neutral paths (`arm-A/`,
`arm-B/`, assignment coin-flipped by script), provenance stripped (model-mix
log rows, PROGRESS notes, commit trailers, probe-date footnote patterns left
intact since both arms share the loop).

Three evaluation instruments, in decreasing order of authority:

1. **Maintainer red pen (final authority).** Jarda reads both arms' body
   sections blind and marks findings; density and severity per arm. His
   calibration standard *is* the campaign's definition of quality — no panel
   overrules it.
2. **Cross-verification (objective).** The standard verification chunks a–f run
   against EACH arm's spec (fresh agents, pointer briefs, standard class
   policy). Count claims refuted per arm, normalized per 100 footnoted claims.
   For tests: green×2 is a gate, and a `verify-rubric-clauses`-style agent
   checks every test asserts its scenario's full final clause (the s12 class).
3. **Blind rubric panel (scored).** Each artifact scored on the rubric below by
   TWO independent judges — one pinned fable, one pinned opus (symmetric
   self-preference cancellation). Disagreement > 0.5 on any dimension → flagged
   for the maintainer. Judges see the blind packet only.

## Rubric (formalizing the 07-21 transcript rubric — now a durable instrument)

Score 1–5 per dimension; report per-dimension, unweighted mean as headline.

| # | Dimension | What 5 looks like | Prior-art anchor |
|---|-----------|-------------------|------------------|
| 1 | Rule fidelity | Permission/state rules match app truth; zero inversions | s12 inversion = automatic ≤2 here |
| 2 | Coverage | Atoms covered; scenario set matches the feature's real risk within tier | chunk-f standard |
| 3 | Scenario walkability | Each scenario runs as a manual test script by a code-blind reader | calibration-f1 red-pen rule |
| 4 | Business-language purity | Reads PO/QA-native beyond lint compliance | the ~2,700-line audit |
| 5 | Assertion completeness | Every test asserts its scenario's FULL final clause | s12 rubric lesson |
| 6 | Test craft | POM reuse, selector quality, wait discipline, flake resistance | PRINCIPLES + s1 toast-race |

## Decision rule (predeclared — before any build runs)

Opus 5 is **good enough for authoring** if ALL of:

- **Hard gates** (both experiments): lint zero findings; tests green ×2; tier
  respected; no subagent wrote PROGRESS/atlas/ledger; contamination audit clean.
- **R recall:** ≥ 4/6 reference deviations rediscovered, and zero critical
  (rule-inversion-class) defects in spec or tests.
- **Rubric:** mean ≥ 4.3 AND no dimension < 3.5 (calibrated to prior art: the
  failed suite sat at 4.1, accepted suites at 4.5), AND within 0.3 of the Fable
  arm in Experiment H.
- **Cross-verification:** refuted-claim rate ≤ Fable arm's + 2 per 100 claims.
- **Maintainer verdict:** red-pen findings are nits, not systemic.

Outcome mapping (maintainer confirms; tie-breaks favor Opus on cost + zero flip
risk):

- **All pass →** switch AUTHORING to Opus 5 for a 3-feature probation wave with
  per-feature rubric sampling; Fable stays available for verification if the
  maintainer wants belt-and-suspenders. Retire flip-mitigation structures
  gradually, each removal its own decision.
- **Close miss (one criterion, no criticals) →** hybrid: Opus drafts, Fable
  finalizes/verifies — rerun this eval's rubric on the first hybrid feature.
- **Clear miss or any critical →** stay on Fable; file the datapoint next to
  the 4.1/4.5 pair; re-test on the next model generation.

## Ops mechanics

- **Model-id preflight (before anything):** spawn one trivial `model: opus`
  agent; its transcript's `message.model` MUST read `claude-opus-5` — abort if
  the alias resolves to a 4.x model, the experiment is void otherwise.
- **Sessions (one unit per fresh session, standing rule):**
  S1 = Experiment R build · S2 = H-F (normal campaign session) · S3 = H-O ·
  S4 = judging + report. S2 may run before S1 if campaign cadence prefers.
- **Provenance:** log every subagent in both arms via `log-model-mix.sh` with
  label suffix `-oe` (opus-eval); in Opus-arm rows, `all-opus` is the INTENDED
  status — annotate `(pinned)` by hand so future flip-rate awk stats can
  exclude them.
- **DB:** reset before S1, S2, S3, and before each green×2 gate as usual;
  orphan-chromium sweep per RUNBOOK after any aborted gate.
- **Wave counter:** H-F counts as feature 6 since last sampling per the normal
  rules. The judging session doubles as an unusually deep sampling review —
  maintainer may reset the counter at S4, his call.
- **Cost envelope:** ≈ 2 extra feature builds + 1 judging session (~10–14
  subagents: 2 panels × 2 experiments × 2 judges, chunks a–f × 2 arms partially
  shared, packet prep scripted). Recent M/H features ran 15–20 subagents each.

## Execution state & session launch prompts

Live experiment state (which session is done/in-flight, eval-branch names,
restore status) lives in `docs/product/.reports/opus-eval/STATE.md` —
gitignored so it survives eval-branch switches. Any session resuming mid-flight
reads it FIRST, then this plan. The maintainer launches each session fresh with
one line:

- **S1:** `Run S1 of docs/product/OPUS5-EVAL-PLAN.md` (2026-07-25: running in
  the planning session itself — it was still fresh)
- **S2:** `Run S2 of docs/product/OPUS5-EVAL-PLAN.md` — the normal
  reviewer-response campaign session; RUNBOOK loop, standard Fable policy
- **S3:** `Run S3 of docs/product/OPUS5-EVAL-PLAN.md` — requires S2 committed
- **S4:** `Run S4 of docs/product/OPUS5-EVAL-PLAN.md` — requires S1–S3 done

## Open decisions for the maintainer (RESOLVED 2026-07-25 — see header)

1. Feature picks: `stage-participants` (R) and `reviewer-response` (H) as
   argued above — or different ones?
2. Opus arm scope: all-subagents-opus (recommended; answers "can Opus run the
   whole loop") vs authoring-only-opus (isolates the authoring question but
   leaves verification unmeasured)?
3. Session order: S1 first (get ground-truth data before spending on H) vs S2
   first (campaign cadence uninterrupted)?
4. Decision thresholds above: 4.3 mean / 4-of-6 recall / +2 refuted-claims —
   adjust before any build starts (predeclaration only works if it precedes
   the data).
