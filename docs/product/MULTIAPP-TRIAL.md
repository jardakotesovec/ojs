# MULTIAPP-TRIAL — live state (overnight run started 2026-07-25)

**Maintainer directive (2026-07-25, before sleep):** run the trial's environment
bring-up and ONE pilot feature overnight, autonomously — "start working on it
and refine the strategy from that experience." For THIS run only, this overrides
§9's one-unit-per-session calibration cadence; the maintainer reviews the
committed results in the morning. Full brief: `MULTIAPP-PLAN.md` §9 (gates
G1–G5, pilot definitions), mechanisms §2–§4.

**Scope of this run** (widened by the maintainer mid-run, 2026-07-25 late):
M0-lite G1–G5 → TWO pilot specs in §9 trio order — Pilot 1
`workflow-stage-navigation`, then Pilot 2 `assign-and-manage-reviewers` —
"that will be enough for me to review and discuss once its done" → learnings
report + proposed amendments to MULTIAPP-PLAN. Pilot 3 (`editorial-decisions`)
stays OUT of scope, and `QUEUE.md` items stay untouched tonight (day-session
work).

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
| G1 submodule alignment (omp+ops boot on campaign lib/pkp) | done | PASSED both apps (login 200, dashboards render, 0 console errors); commits omp `85da7e7eb0` / ops `d87f740243` on local `e2e_revamp_fable_2`; lib/pkp branch pushed to fork; report `.reports/multiapp-trial-g1.md` |
| G2 servers + test DBs (3 fleets side-by-side) | done | PASSED ×3 (admin login + 0 console errors each; OJS regression 14/14 green with OMP+OPS live); omp_test/ops_test created, nothing dropped; lib/pkp `1b2111c34b`+`caa812b5e2` (pushed), omp 3 commits, ops 3 commits; ui-library aligned+built both apps; bonus fix: TEST_API_KEY never reached PHP env (broke OJS too); servers up: 8000/8100/8200; watch: shared Mailpit, stray php on 8010 |
| G3 scenario API port (createContext+createSubmission on all 3; OMP internal round seeds) | done | PASSED ×3 (OMP internal round verified in DB; OPS stage-5 seeding; OJS 14/14 regression green); shared `f296a80c46` pushed, omp/ops re-pinned, ojs root `2336dc9d3a` (no submodule pointers); headline fix: shared builder hard-coded submission stage — OPS would have seeded invisible; report has overlay-model + SeriesProcessor design notes |
| G4 app playwright trees (smoke spec green on OMP+OPS) | done | PASSED ×3 (smoke 3/3 cold+warm both apps; OJS 14/14); lib/pkp `23d35b375b`+`60b6193d8f` pushed, app trees committed, ojs root `11059f814e`; DISCLOSED DEVIATION: one --force-with-lease amend on lib/pkp (3-min orphan, self-referenced only); rulings needed: seed.actors persona indirection (plan §3 gap — editor.diana can't exist on OPS), possible hasEditorRole capability; sharedTests:false in app configs (flipping it = §5.6 purge milestone) |
| G5 spec-side tooling (APP-GLOSSARY.md + lint extensions) | done | glossary committed dd001eba4a; lint: badge syntax `{OJS OMP}` (canonical order, no all-three badge), variation-stub match, glossary-driven forbidden terms; 13/13 specs clean (orchestrator re-verified); bonus fix: vacuous-path bug in lint gate; OQ for maintainer: glossary `Translator` row vs the real OJS Translator user group |
| Pilot 1: `workflow-stage-navigation` OMP+OPS delta | in_progress | SPEC DRAFT COMMITTED edb3e7e631 (lint-clean, 9 badges, 24 overrides; author attempt 1 flag-killed, respawn clean); 20-item probe list + tests wait on G2–G4 |
| Pilot 2: `assign-and-manage-reviewers` OMP+OPS delta | in_progress | SPEC DRAFT COMMITTED 6a70d181d1 (lint-clean first attempt; OPS absence = file-scope badge + prose, OMP parity declaration + 6 overrides, 2 candidate OMP pool-leak defects); 15-item probe list waits on G3 |
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
- **Branch name everywhere (maintainer, confirmed): `e2e_revamp_fable_2`** —
  lib/pkp in all three checkouts, and omp-main/ops-main trial commits land on
  a local `e2e_revamp_fable_2` branch (created from their current
  `e2e_revamp`), matching ojs-main.
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

- 2026-07-26 — iter 16: OPS verify chunk PASS (nothing refuted; 5 precision
  nuances queued for the fix pass — notably Known-deviations bullets unbadged
  yet impossible on OPS, and a v12 roster footnote that is context-specific).
  Ledger 262 + 212 re-reproduced on OPS. Awaiting OMP verify + pilot-2 probes.
- 2026-07-26 — iter 15: readability spot-read done — 28/28 overrides
  restatable, 5 wording stumbles (+1 stale APP-GLOSSARY work-type cell) held
  for a single fix pass after the two verify chunks land (no spec edits while
  verifiers read).
- 2026-07-26 — iter 14: Pilot-1 companions GREEN ×2 both apps (omp 35b498092c,
  ops ac5b0ec1b3; zero spec conflicts, zero lib/pkp changes needed; OJS 14/14).
  Launched the pilot-1 closeout trio: shrunk verify OMP + OPS (opus) and
  readability spot-read (fable). Pilot-2 probes still running.
- 2026-07-26 — iter 13: Pilot-1 spec FINALIZED + committed 2ce8a3efc0 (lint
  re-verified); ledger rows 262/263 filed by the orchestrator. Pilot-1 test
  author (opus, ≤3 companions per app) launched; Pilot-2 probes still running.
- 2026-07-26 — iter 12: Pilot-1 probes batch A (OMP) done (8/9 confirmed with
  nuances; work-type labels contradicted; harness findings: OMP presses seed
  zero default reviewer recommendations → ledger 263 reserved, orphan
  submissions on failed scenario builds, silent reviewRounds drop). Pilot-1
  finalizer (fable, citing reserved ledger rows 262/263) + Pilot-2 probe
  battery (opus) launched in parallel.
- 2026-07-26 — iter 11: Pilot-1 probes batch B (OPS) done — 11 verdicts incl.
  a BASE-SPEC defect reproducing on OJS (published-status box unreachable,
  blank stage-name render — candidate ledger row) and an OPS landing
  three-state correction. Waiting on batch A (OMP) before the spec finalizer.
- 2026-07-26 — iter 10: G4 PASSED ×3 — ALL M0-lite GATES DONE. Force-push
  deviation disclosed (recorded, no follow-up needed beyond the morning
  report). Pilot-1 probe battery launched: two opus agents (OMP items /
  OPS+parity items) against the 8100/8200 fleets; Pilot-2 probes queue next
  to keep fleet load and failure attribution clean.
- 2026-07-26 — iter 9: G3 PASSED ×3 (scenario API live everywhere; OPS
  stage-hardcode landmine fixed; possible upstream OMP ResubmitInternal
  constant bug flagged unmapped). G4 launched — last gate before the pilot
  probe batteries.
- 2026-07-26 — iter 8: Pilot-2 spec draft committed (fable-clean, no respawn
  needed — lean-brief pattern holding). Both pilot spec drafts now in; probe
  batteries queue behind G3 (still running). Mechanism-friction notes from
  both authors accumulating for the learnings report.
- 2026-07-26 — iter 7: G2 PASSED all three fleets (OJS untouched + regression
  green; OMP 8100, OPS 8200 with fresh test DBs). G3 launched with G2's
  handoff. Pilot-2 author still drafting.
- 2026-07-26 — iter 6: Pilot-1 respawn SUCCEEDED — spec deltas committed
  edb3e7e631 (orchestrator re-ran lint: clean); author returned 20 probes,
  2 graduation candidates (OMP Marketing/Catalog screens; OPS >⅓-trigger
  wording needs maintainer call) + mechanism-friction notes for the learnings
  report. Pilot-2 spec author (fable) launched in parallel; G2 still running.
- 2026-07-26 — iter 5: Pilot-1 author attempt 1 flag-killed BEFORE any edit
  (born-dead on a dense brief — the pointer-brief rule confirmed again);
  respawn 1 of max 2 launched with a lean pointer brief. Spec file verified
  untouched before respawn.
- 2026-07-26 — iter 4: G5 done (lint extensions in; corpus re-verified 13/13
  clean). Pilot 1 SPEC-delta author (fable) launched in parallel with the
  running G2 — the draft needs only G5; its probe list waits for G2 servers.
- 2026-07-26 — iter 3: G1 PASSED both apps, no fatals (the expected plugin
  drift didn't materialise; one stale-cache warning fixed). G2 launched with
  G1's handoff (ui-library alignment, server cleanup, test DBs). Bookkeeping
  caveat: background-agent transcripts don't all land in `subagents/`, so
  model-mix rows for some trial agents can't be logged — glossary agent
  verified fable-clean; G1's served model unverifiable from disk (its work is
  investigation-class; provenance there is recording, not a gate).
- 2026-07-25 — iter 2: G5 glossary landed fable-clean (26 terms, 9 capability
  names, 4 open questions in its report — capability spellings now canonical,
  G4 must adopt them); lint-extension agent (opus) launched; maintainer widened
  pilot scope to TWO specs (+`assign-and-manage-reviewers`) and confirmed
  branch `e2e_revamp_fable_2` everywhere.
- 2026-07-25 — iter 1: G1 agent (opus) + G5 glossary agent (fable) launched in
  parallel; process-doc batch committed 1342b7201f.
- 2026-07-25 — file created; loop starting with G1 (+ G5 in parallel when
  context allows).
