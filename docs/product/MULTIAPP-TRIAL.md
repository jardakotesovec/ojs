# MULTIAPP-TRIAL — live state (overnight run started 2026-07-25)

**Maintainer directive (2026-07-25, before sleep):** run the trial's environment
bring-up and ONE pilot feature overnight, autonomously — "start working on it
and refine the strategy from that experience." For THIS run only, this overrides
§9's one-unit-per-session calibration cadence; the maintainer reviews the
committed results in the morning. Full brief: `MULTIAPP-PLAN.md` §9 (gates
G1–G5, pilot definitions), mechanisms §2–§4.

**Scope of this run**: M0-lite G1–G5 → Pilot 1 `workflow-stage-navigation` (the
§9 trio's first) → learnings report + proposed amendments to MULTIAPP-PLAN.
Pilots 2–3 are OUT of scope (they wait for maintainer review), and `QUEUE.md`
items stay untouched tonight (day-session work).

## Environment facts (verified 2026-07-25 late evening)

- Checkouts: `/Users/jarda/git/pkp/pkp-main/{ojs-main,omp-main,ops-main}`.
  omp-main + ops-main: branch `e2e_revamp`, `lib/pkp` pinned `9a91dc2ee9`
  (pre-Playwright — the G1 problem).
- Campaign lib/pkp: branch `e2e_revamp_fable_2` @ `6d1ff6603025` (G1 target).
- Scenario API today: app-side `api/v1/_test/` (`JournalScenarioController`,
  `SubmissionScenarioController`) over shared `lib/pkp/api/v1/_test/`
  (`PKPContextScenarioController`, `PKPSubmissionScenarioController`). G3 =
  thin OMP/OPS app controllers + the de-OJS'd shared schema (§9-G3 details).
- Ports: OJS 8000 / OMP 8100 / OPS 8200. Test DBs: Postgres — create
  `omp_test` / `ops_test` mirroring the `ojs_test` setup.
- The OJS environment is untouchable tonight: additive changes only; never
  break the OJS fleet, `ojs_test`, or the OJS suite's green state.

## Units (single-writer: only the orchestrator edits this file)

| Unit | Status | Note |
|------|--------|------|
| G1 submodule alignment (omp+ops boot on campaign lib/pkp) | pending | expect abstract-method/plugin drift; RUNBOOK "Plugin-submodule alignment" lore |
| G2 servers + test DBs (3 fleets side-by-side) | pending | config-factory base-port param 8000/8100/8200 |
| G3 scenario API port (createContext+createSubmission on all 3; OMP internal round seeds) | pending | journal→context alias; section/issue/galleys as app overlays; reviewRounds internal/external key; IssueProcessor out of shared path |
| G4 app playwright trees (smoke spec green on OMP+OPS) | pending | config, app.context.js capability map, bootstrap seeds per role subset |
| G5 spec-side tooling (APP-GLOSSARY.md + lint extensions) | pending | independent of G1–G4; lint must pass on existing specs unchanged |
| Pilot 1: `workflow-stage-navigation` OMP+OPS delta | pending | delta loop per PLAN §4; spec mechanisms §2; stage-topology axis (OMP 5 stages / OPS 1) |
| Learnings report + plan amendments | pending | → `.reports/multiapp-trial-learnings.md`, then fold proposals into MULTIAPP-PLAN §9 |

Dependency chain: G1 → G2 → G3 → G4 → pilot tests. G5 is independent (any
time). Pilot 1's SPEC delta needs only G5; its TESTS need G1–G4.

## Operating rules for this run

- RUNBOOK Model discipline applies unchanged: FABLE WRITES (spec deltas, docs,
  this file), OPUS INVESTIGATES (engineering, probes, tests). The orchestrator
  delegates and never runs engineering/probe/verification batteries inline.
- Every subagent brief carries: "Do NOT write to PROGRESS.md, atlas files,
  docs/e2e/app-changes.md, or MULTIAPP-TRIAL.md; write your full findings to
  docs/product/.reports/multiapp-trial-<label>.md and return neutral
  what-was-missed / what-to-consider feedback."
- Commits per gate, per repo, SEPARATELY: omp-main and ops-main commit their
  own trees (submodule re-pins there ARE the work — commit them); shared
  lib/pkp changes commit inside ojs-main/lib/pkp on `e2e_revamp_fable_2`
  (omp/ops then re-pin to the new SHA); ojs-main ROOT commits never bump
  submodule pointers (RUNBOOK step 10).
- **lib/pkp sharing (maintainer, 2026-07-25): via the `jardakotesovec` remote
  ONLY.** In every checkout that remote is `origin`
  (`git@github.com:jardakotesovec/pkp-lib`). Flow: commit in ojs-main/lib/pkp →
  push `e2e_revamp_fable_2` to `origin` → in omp-main/ops-main `lib/pkp`:
  fetch `origin`, check out the SAME branch name `e2e_revamp_fable_2`. NEVER
  push to `upstream` (pkp/pkp-lib) or any other remote (`gazi`, `vitaliy`) —
  verify the remote URL before every push. Same rule for the app repos if a
  push is needed: jardakotesovec forks only.
- Park-and-continue: 3 failed attempts on a unit → `parked` + reason, continue
  with anything not blocked by it. If everything remaining is blocked, write
  the morning report and STOP the loop early.
- No OJS PROGRESS row is claimed; the wave counter is untouched.
- Destructive ops are off-limits: no force-push, no dropping existing DBs, no
  deleting files outside the working trees; new DBs/configs only.
- Morning report: final loop iteration writes a plain-language summary (what
  works, what's parked and why, pilot findings, proposed plan amendments) —
  readable before coffee.

## Log (newest first, one line per orchestrator iteration)

- 2026-07-25 — file created; loop starting with G1 (+ G5 in parallel when
  context allows).
