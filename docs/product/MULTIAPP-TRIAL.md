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
| Pilot 1: `workflow-stage-navigation` OMP+OPS delta | done | FULL delta loop: draft edb3e7e631 → 20 probes → finalized 2ce8a3efc0 (ledger 262/263) → companions green×2 both apps (omp 35b498092c, ops ac5b0ec1b3) → verify OMP NOT-PASS 5 rows + OPS PASS 5 nuances → readability 5 stumbles → all folded 9c684c0f6c; OJS regression green throughout |
| Pilot 2: `assign-and-manage-reviewers` OMP+OPS delta | done | FULL delta loop: draft 6a70d181d1 → 15/15 probes → finalized 80df7d4a51 (ledger 264/265/266) → companions green×2 (omp e8911807bb, ops c5f418c21f) → closeout trio: OMP verify (parity declaration CONFIRMED + evidenced on its 2 unprobed legs; 4 corrections, 1 base refutation, 1 scenario gap), OPS verify (absence conclusion holds; impossibility claim refuted — a Reviewer role IS creatable on OPS), readability (13/13 scenarios walkable, 5 stumbles) → fold 1 69452640c8 → OJS scope probe (**all 5 held-back findings reproduce on OJS — base facts, not deltas**) → fold 2 4fd623b910. Ledger 267–272 filed. Lint 0, corpus clean, density 3/5 |
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

- 2026-07-26 — iter 20 (fresh session after the handoff; state re-read from this
  file): all three fleets verified up (8000/8100/8200). Pilot-2 closeout trio
  launched per pilot 1's iters 14–17 pattern: shrunk verify OMP a/c/e (opus),
  light OPS-absence verify (opus), readability spot-read of the new prose
  (fable). No spec edits until all three land — a single fix pass folds them.
- 2026-07-26 — iter 21: readability spot-read landed — 13/13 scenarios walkable,
  all overrides restatable but one; 5 findings (1 moderate: the OPS absence
  sentence uses developer/HTTP vocabulary a no-code reader can't check) + a
  stale Roles-footnote "confirm on first probe" now that OPS probes are done.
  Held for the single fix pass; both verify chunks still running.
- 2026-07-26 — iter 22: OPS verify landed — absence CONCLUSION holds (no role
  reached any surface this spec owns, every negative positive-controlled), but
  the narrowed SHAPE is refuted in 3 places: a Server Manager can create a
  Reviewer role on OPS (self-registration then fills it), so "impossible" must
  become "none installed by default"; 10-item change list incl. a ledger
  candidate (reviewer dashboard reachable on OPS, prints an untranslated
  OJS-only key) and a refinement to draft row 266. Held for the fix pass;
  OMP verify still running.
- 2026-07-26 — iter 23: OMP verify landed (the big one — parity declaration
  CONFIRMED and now evidenced on its two unprobed legs; 4 corrections m3/m6/m7 +
  scenario-5 stage-boundary gap, 1 base claim REFUTED (rule 17 History does show
  the reminder → residual OQ4 dropped), 13-item change list). Closeout trio
  complete. Launched: fix pass (fable, folds OMP-except-3/8/11/12 + all OPS +
  all readability) and an OJS scope probe (opus) for the 4 findings that touch
  BASE claims and can't be badged until OJS is checked (hidden group field,
  un-withdrawn task, 500 on refused assignment, assistant 401, XML mime).
  Orchestrator filed ledger row 267 ([OPS] reviewer role creatable → broken
  reviewer dashboard + untranslated OJS-only key) and amended 264 (first page
  applies no filters either) and 266 (checkbox is disabled + hard-coded; the
  masthead pin is previous-calendar-year; OPS has no such form at all).
- 2026-07-26 — iter 24 (OUT-OF-BAND, maintainer-directed mid-loop; not trial
  work): discard the `reviewer-response` feature produced by the closed Opus-5
  eval. Maintainer rulings: PROGRESS row 12 → back to `pending` (feature stays
  on the map, wave counter 6→5); ledger → delete rows 237–253 AND revert the
  trial's amendments to 16/76/77/78. Deleted 19 `.reports/reviewer-response-*`
  files + `opus-eval/` + `opus-eval-analysis/` (gitignored ⇒ unrecoverable from
  git; archived to the session scratchpad first). Two sweeps launched: ledger +
  tests (opus), docs + atlas unclaim (fable), both fenced off from the files the
  pilot-2 fix pass and the OJS scope probe are touching. Suite green-run
  deferred until the OJS probe releases `ojs_test`.
- 2026-07-26 — iter 25: pilot-2 fix pass folded and committed 69452640c8 (lint
  0, corpus 13/13, density 3/5; companion tests unaffected in meaning, 2
  cosmetic drifts noted). OPS absence now states its conclusion without
  claiming impossibility. FOUR items still awaiting scope (OMP D-6/7/8/10) —
  the OJS probe finishes them in a short second fold. Two one-line follow-ups
  parked for that fold: APP-GLOSSARY's stale "confirm on first probe" footnote,
  and a residual OQ that lives in the pilot-2 report rather than the spec.
- 2026-07-26 — iter 26: reviewer-response removal COMPLETE across three commits
  — docs 22daeeb4b6 (root), tests d14231f1db (lib/pkp: the spec lived in the
  SHARED tree), ledger 41df1a63b7 (root, no submodule bump). Rows 237–253 gone
  with no renumbering (gap is intentional); 16/76/77/78 reverted byte-for-byte
  from `d6beaf4ecd^` — row 16's duplicate-click-handler diagnosis stands again.
  Tonight's rows 254–267 byte-identical. Static checks clean (node --check on
  all 13 surviving specs + POM; zero `reviewer-response` hits in either test
  tree). OPEN for the maintainer: `ReviewerSubmissionPage.js` keeps ~18 dead
  members the trial added AND four method bodies it rewrote that three
  surviving specs are green against — left whole deliberately. lib/pkp NOT
  pushed: no omp/ops re-pin is needed for a test deletion.
- 2026-07-26 — iter 27: OJS scope probe landed with the headline that reframes
  pilot 2 — **none of the five findings is an OMP delta; all five reproduce on
  OJS**. They are BASE-spec facts the OMP pass surfaced only because a press was
  looked at harder than the journal ever was. That is a trial learning in its
  own right: the multi-app delta pass doubles as a base-spec auditor. Filed
  ledger rows 268 (updated-assignment task never withdrawn), 269 (validity
  refusal 500s silently), 270 (assistant blocked by a role-denied dialog, with
  a reachability rider), 271 (XML export served as text/html) and 272 ([OMP]
  empty JATS recommendation — the ONE half that stayed app-specific). Launched
  the second fold (fable, base-not-badged + the glossary one-liner) and the
  deferred post-removal suite run (opus, expect green minus 12).
- 2026-07-26 — iter 28: **PILOT 2 DONE** — second fold committed 4fd623b910
  (all five held-back findings landed as BASE corrections, unbadged; glossary
  Moderator note confirmed; stale "PROPOSED row 266" citation fixed — the five
  numberless PROPOSED rows are pre-trial base-spec backlog, deliberately left).
  Both pilots now complete. Learnings report (fable) launched — the last unit —
  briefed to find friction rather than confirm the mechanism, and to disclose
  the G4 force-with-lease deviation and pilot 3's out-of-scope blockers.
  Post-removal suite run still going.
- 2026-07-26 — iter 29: post-removal suite GREEN — 106/106, exit 0, zero flaky,
  one run: `ojs` project 104 (was 116 — exactly minus 12), setup 2, serial 0
  (empty by construction, pre-existing). PROGRESS's 91 reconciles: it counts 11
  product-spec features and excludes `assign-and-manage-reviewers` (13 tests,
  round-1, predates the campaign) — 91+13=104, so no stale count. The
  `ReviewerSubmissionPage` worry is CLEARED empirically: all three co-tenant
  specs green first-attempt (13/13, 10/10, 13/13) driving the trial-rewritten
  method bodies — keeping the POM whole is safe; its ~18 orphan members are
  dead, not broken, so removing them is tidiness with no correctness pressure.
  Caveat recorded: single run on a warm ojs_test; a reset-DB run would be a
  stronger signal.
- 2026-07-26 — iter 19 (SESSION HANDOFF POINT — maintainer restarting the
  session; no agents in flight): pilot-2 companions green×2 both apps,
  committed in app repos. Remaining units: pilot-2 closeout trio + fix pass;
  learnings report + MULTIAPP-PLAN §9 amendments; morning report; stop loop.
  Fresh session: re-run the same /loop prompt — this file is the state.
- 2026-07-26 — iter 18: Pilot-2 probes 15/15 done — all confirmed with
  corrections; TWO real OMP permission leaks (picker first page unscoped,
  cross-stage assignment accepted) + dead masthead checkbox → ledger rows
  264–266 reserved; §7b parity declaration probe-confirmed. Finalizer (fable)
  launched. Pilot-3 blockers recorded for the learnings report.
- 2026-07-26 — iter 17: PILOT 1 DONE (fix pass folded 17 findings; corpus
  clean; companion tests semantically unaffected — 2 cosmetic comment/title
  drifts noted in the fix report). Noisy finished verify task killed after
  ~12 duplicate notifications. Pilot-2 probes still running.
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
