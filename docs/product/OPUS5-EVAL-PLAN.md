# Opus 5 authoring evaluation — single-arm live trial (REVISED 2026-07-25)

**Revision:** the maintainer replaced the original two-experiment design
(blind replay + head-to-head + judge panels; in git at `e1ec40cdc1`) with a
simpler live trial the same day, after the replay setup cost a main-session
flag-kill before producing anything. New shape: **Opus 5 builds the next real
campaign feature; the maintainer reviews it the way calibration features were
reviewed.** His red pen was the final authority in the elaborate design too —
this keeps the authority and drops the apparatus.

**Question (unchanged):** can Opus 5 (`claude-opus-5`) author specs + Playwright
tests at maintainer sign-off quality, replacing Fable 5 whose safeguard flips
force all the Model-discipline complexity in the RUNBOOK? Prior evidence (the
4.1-scoring Opus **4.8** tail vs 4.5 Fable suites) does not transfer to Opus 5.

**Preflight: PASS 2026-07-25** — a pinned `model: opus` subagent's transcript
shows `claude-opus-5` (not a 4.x alias).

## Protocol

- The next campaign session runs the **unmodified RUNBOOK per-feature loop** on
  the next pending row (**`reviewer-response`, H·10, row 12**) with exactly ONE
  change: **every subagent is spawned `model: opus`**. Real writes as normal —
  spec, tests, ledger rows, PROGRESS row, commits. This is a live campaign
  feature, not a sandbox; whatever it finds/builds stands or falls in review.
- **Keep pointer-brief discipline and all structural rules** even though Opus
  agents cannot flip: an identical pipeline is what makes the quality
  comparison clean, and the MAIN session still runs Fable under the guard
  (orchestrator model is unchanged — a main-session flag still means end +
  fresh session, standard rule).
- **Provenance:** log every subagent via `log-model-mix.sh` with label suffix
  `-oe`; `all-opus` is the INTENDED status here — annotate `(pinned)` so flip-
  rate stats exclude these rows. The discard-on-authoring-flip rule is moot for
  this feature.
- The feature counts toward the wave as normal (6th since the last sampling);
  the maintainer's trial review can double as early sampling at his discretion.

## Maintainer review (the judging)

Calibration-style: read the spec body cold, walk each canonical scenario as a
manual test script, then the tests. The 6-dimension rubric below is the
score sheet if he wants one; the calibrated reference points are **4.5 =
accepted Fable suites, 4.1 = the rejected Opus-4.8-tail suite** (its defects:
an inverted-assertion critical plus majors clustered in the flipped half).

| # | Dimension | What 5 looks like |
|---|-----------|-------------------|
| 1 | Rule fidelity | Permission/state rules match app truth; zero inversions |
| 2 | Coverage | Atoms covered; scenarios match the feature's real risk within tier |
| 3 | Scenario walkability | Each scenario runs as a manual test by a code-blind reader |
| 4 | Business-language purity | Reads PO/QA-native beyond lint compliance |
| 5 | Assertion completeness | Every test asserts its scenario's FULL final clause |
| 6 | Test craft | POM reuse, selector quality, wait discipline, flake resistance |

## Outcomes (maintainer decides after review)

- **Sign-off quality →** Opus 5 authors a 3-feature probation wave with
  per-feature review, then the flip-mitigation structures get retired one
  decision at a time.
- **Borderline →** hybrid: Opus drafts, Fable verifies/finalizes; re-review on
  the next feature.
- **Below bar →** stay on Fable; file the datapoint; re-test next model
  generation. Either way the feature itself gets fixed to standard (his review
  findings are calibration input, same as f1 was).

## Launching

Fresh session (one feature per session, standing rule):

> Run the Opus 5 trial per docs/product/OPUS5-EVAL-PLAN.md — build the next
> pending PROGRESS row through the standard RUNBOOK loop with every subagent
> pinned `model: opus`; log with `-oe` suffix.

Scratch state, if any, lives in `docs/product/.reports/opus-eval/STATE.md`
(gitignored). The aborted replay experiment's isolation was fully unwound
2026-07-25 (branches deleted, artifacts restored) — nothing from it survives
except this plan's git history.

## Side-by-side replay: `send-to-review` (added 2026-07-25, after the trial)

The maintainer wants a direct A/B on one feature. Fable's build of
`send-to-review` (row 10, committed `78c6e6b224` on `e2e_revamp_fable_2`) is
the reference; **Opus 5 rebuilds the same feature blind on eval branch
`opus-eval-str`** (root + a twin lib/pkp branch for any POM writes). Same
paths, two branches — the side-by-side at the end is a plain
`git diff e2e_revamp_fable_2 opus-eval-str -- docs/product/specs/send-to-review.md playwright/tests/send-to-review.spec.js docs/e2e/app-changes.md`.

**Isolation (committed `4b6ccbf8b3` on the eval branch):** removed Fable's
spec, test file, and fixture docx; ledger rows 235–236 deleted and the
2026-07-24 amendment clauses stripped from rows 220/234; PROGRESS row 10 reset
to pending (which makes it the FIRST pending row — standard selection lands on
it naturally) with totals/wave counter rolled back. Atlas claim markers and
POM/infra fixes predate the reference build and stay (known, directionally
pro-Opus bias, same reasoning as the original replay design).

**Build protocol (fresh session):**
1. `git checkout opus-eval-str` in root AND lib/pkp (verify with
   `git branch --show-current` before anything else).
2. `npm run test:e2e:reset`.
3. Standard RUNBOOK loop on the first pending PROGRESS row, every subagent
   `model: opus`, logs suffixed `-oe (pinned)`. Real writes everywhere —
   ledger, PROGRESS, atlas — they are branch-local by construction. Commit on
   the eval branches per RUNBOOK step 10. **Never merge these branches.**
4. To mirror the reviewer-response trial's configuration, the maintainer may
   launch the session with the main model set to Opus 5 as well.
5. Reading the removed reference content out of git history (`git show`,
   `git log -p`, the isolation commit's parent) is forbidden and voids the
   comparison — subagent briefs never mention that a reference exists.

**Contamination audit (before comparison):** grep the build session's subagent
transcripts for history reads of the reference paths; any hit voids the run.

**Comparison & review:** unblinded side-by-side, maintainer's call throughout.
Objective anchors: did Opus rediscover ledger rows 235/236 and the row-220/234
amendments (they are live app facts); scenario-count and coverage vs the
reference's 7 tests at tier M·7; the 6-dimension rubric above per artifact.
After review: Fable's build stays canonical on the main branch; verified novel
Opus findings get cherry-picked into the real ledger; delete both
`opus-eval-str` branches when done.
