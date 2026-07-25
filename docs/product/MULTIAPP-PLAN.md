# Multi-app extension plan — OJS + OMP + OPS

**Status: TRIAL APPROVED (maintainer, 2026-07-25) — see §9.** Mechanisms in §2–§4
approved for a review-focused pilot; campaign-wide adoption decided after the trial.
Synthesized from four parallel research analyses; full detail in
`.reports/multiapp-A-divergence.md` (code-grounded inventory), `-B-specs.md` (spec
mechanism design), `-C-tests.md` (test architecture), `-D-process.md` (campaign
process).

## 1. The divergence picture (measured, not assumed)

Of the 91 active OJS features (code-grounded sweep, `.reports/multiapp-A`):

| | shared-identical | shared-with-variation | absent | hidden | app-unique (new rows) |
|---|---|---|---|---|---|
| **OMP** | ≈49 | ≈34 | 5 | 3 | ~8 (chapters, publication formats/ONIX, catalog, series, internal review, codelists, direct sales, competing interests) |
| **OPS** | ≈43 | ≈28 | 18 | 2 | ~5 (relations/VOR, preprint-to-journal, posting model, Moderator persona, preprints archive) |

The five consequential divergences everything else hangs off:
1. **Stage topology**: 4 stages (OJS) vs 5 (OMP, + internal review) vs 1 (OPS,
   production only) — kills ~10 Area-2 features in OPS, doubles OMP's review matrix.
2. **Decision engine**: OMP adds 15 internal-review decision classes; OPS keeps only
   Decline/Revert — decision tables must become app-keyed.
3. **Representation model**: galleys (OJS/OPS) vs publication formats + ONIX (OMP).
4. **Publishing container**: issues vs catalog/series vs continuous posting +
   relations — these are counterpart FEATURES, not variants.
5. **Seeds/roles**: same `publicknowledge` path and admin users everywhere, but OPS
   seeds ~5 users/no reviewer or copyeditor groups; role names differ (Press manager,
   Preprint Server manager, Moderator, Series editor).

**Caveat that must gate the applicability sweep**: some observed OMP/OPS gaps
(media-files, amendments, the `_test` scenario API itself) are BRANCH DRIFT vs the
OJS e2e branch, not product divergence — the sweep must classify against intended
product, with branch-drift items listed separately as alignment work.

## 2. Spec architecture — one OJS-main spec + four delta tiers

(Design + worked examples in `.reports/multiapp-B`.) One mechanism per delta class:

1. **`APP-GLOSSARY.md`** (new, one file): the term map (journal→press→server,
   section→series, issue→catalog/—, Journal Manager→Press manager→Preprint Server
   manager…). Specs stay in OJS vocabulary; readers substitute; the glossary feeds
   the lint's forbidden-term checks. Kills per-spec vocabulary noise.
2. **Inline app badges for existence deltas only** — positive-list badges on
   rows/rules/bullets (no badge = all three apps). Prose-free, bullet granularity.
3. **`## App variations — OMP / OPS` section per spec for behavioral deltas** —
   structured overrides keyed to rule/row numbers, each quoting a 3–6-word stub of
   the base text (lint verifies the stub still matches → silent drift becomes a loud
   lint failure), each carrying its own app-specific anchors and probe footnotes.
4. **App-unique features get full ordinary specs** (`apps:` frontmatter), same
   TEMPLATE, no delta machinery.

**Graduation boundary** (delta → own spec): the moment it stops modifying rules and
needs rules of its own — UI surfaces whose atoms no OJS spec claims, or overrides
replacing >⅓ of base rules, or ≥3 full replacement scenarios.

**Scenarios**: stay single-voice OJS narratives; badge if absent per app; short
override for 1–2 step differences; a named replacement scenario (e.g. `4-OMP`) for
structural divergence. Never app-badged individual steps.

## 3. Test architecture — shared core + capability flags + thin app companions

(Design + skeletons in `.reports/multiapp-C`.) Shared core spec file per shared
feature stays in `lib/pkp/playwright/tests/`, gated by **capability flags, never app
names** (`if (!ctx.hasReviewStage)…` not `if (app==='ops')`), consuming an
`appContext` object resolved from the app checkout at load time. Each app repo adds
thin `<feature>.<app>.spec.js` companions for its variations and plain spec files for
its unique features. Pure parameterization was rejected because apps differ in
SHAPE (OMP adds a stage; OPS removes three) — a parameter can't express "more
behavior"; fully per-app trees were rejected as 3× maintenance of literally shared UI.

- **Seeding**: one shared scenario pipeline + per-app subclass behind a uniform API.
  The shared submission schema gets de-OJS'd (`journal`→`context` with alias;
  `section`/`issue`/`galleys` become app overlay properties; `reviewRounds` gains an
  internal/external key). `IssueProcessor` moves out of lib/pkp. `users.js` stays a
  shared identity roster; each app bootstraps its role subset.
- **POMs**: shell POMs (Dashboard/WorkflowShell/ParticipantManager…) are reusable
  as-is after a mechanical `journalPath`→`contextPath` rename — they anchor on shared
  ui-library `data-cy`/roles, and all three apps use path `publicknowledge`.
  Base+subclass only where already proven needed (SubmissionWizardPage; likely
  DecisionWizardPage).
- **App detection**: `process.cwd()` is the app root → static require of
  `<appRoot>/playwright/support/app.context.js` for file-level skips, cross-checked
  against the Playwright project name in fixtures.
- **CI**: per-app shape unchanged (setup→app→serial). pkp-lib PRs get an
  {ojs, omp, ops} matrix job so a shared-test change can't land green on one app and
  broken on two.
- **Spec↔test bridge**: spec app-badges are reader-facing; tests gate on
  capabilities. The translation lives in ONE place — `app.context.js` capability
  names are listed in APP-GLOSSARY.md next to the vocabulary map — so a test author
  maps "OPS: hidden (no review stage)" to `hasReviewStage` mechanically.

## 4. Process & bookkeeping

(Full design in `.reports/multiapp-D`.)

- **PROGRESS**: keep ONE table; add two compact columns `OMP` / `OPS` with token
  states (`—` not started · `n/a(reason)` · `delta` in progress · `ok·N` = verified
  with N tests · `parked`). OJS Spec/Tests columns, one-line note, single-writer
  discipline unchanged. Separate delta-wave counter line in the banner.
- **FEATURE-MAP**: one `apps:` line per feature from a mechanical applicability
  sweep (§1 caveat applies). Dropped surfaces that are really counterpart features
  become new Area rows (OMP/OPS areas), not deltas.
- **Ledger**: stays single; new rows tagged `[OMP]`/`[OPS]`; existing rows get
  addenda (era-marker precedent). Model-fallback log: `@delta` label suffix.
- **Sequencing: per-AREA delta passes** — after an area completes for OJS, one
  delta pass sweeps it for OMP+OPS. Decisive argument: an area is the smallest unit
  whose cross-feature reference web is closed (specs forward-reference within areas),
  so per-feature deltas would delta against holes; and one pass amortizes the
  3-server environment. Staleness bounded to weeks.
- **The delta loop** (one fresh session = one feature's OMP+OPS delta): claim both
  cells → applicability gate (live absence probe — "absent" is itself probed) →
  delta author (keep/modify/drop/add against the OJS spec; no atlas re-derivation) →
  lint → per-app probe battery (CANNOT shrink: "same as OJS" is a probed claim) →
  parameterize/extend tests → green ×2 per app + ×1 OJS regression → shrunk verify
  chunks (a/c/e per app) → readability spot-read of new prose only → PROGRESS →
  multi-repo commit → STOP.
- **Budgets** (hard ceilings; C's estimates sit inside them): OJS ≤700/25min
  unchanged · OMP ≤550/22min · OPS ≤300/12min. App-only additions per shared
  feature ≤ ceil(tier/2). Delta waves of 7 sessions, sampled independently.

## 5. Prerequisites — milestone M0 (before any delta session)

1. Align `omp-main`/`ops-main` `lib/pkp` submodules to the campaign branch (they sit
   at `9a91dc2ee9`, predating ALL Playwright infra).
2. Port the `api/v1/_test` scenario-seeding API to OMP/OPS app branches (currently
   OJS-only — hard blocker) with the de-OJS'd schema + per-app subclasses (§3).
3. config-factory: base-port parameter (8000/8100/8200) for three side-by-side
   server fleets; wire OMP/OPS `playwright/` app trees (config, app.context.js,
   bootstrap seeds).
4. Write `APP-GLOSSARY.md` + capability map; extend lint-spec.sh (badge syntax,
   override-stub check, glossary terms).
5. Applicability sweep → FEATURE-MAP `apps:` lines + the branch-drift alignment list.
6. Shared-test purge probe: the existing 8 "shared" lib/pkp specs are OJS-flavored
   below the payload level (stage labels, decision rosters) — live-probe on OMP/OPS,
   demote what doesn't generalize. The 14 legacy shared Cypress suites remain a
   coarse regression net meanwhile.

## 6. Pilot (calibration mode — one feature per session, maintainer reviews each)

1. `tasks-discussions` — shared-identical; the reference spec becomes the delta
   exemplar (expected outcome: "no variations" claim + parity probes only).
2. `workflow-stage-navigation` — shared-with-variation; exercises stage-topology
   deltas both directions (OMP internal review, OPS single-stage).
3. `reviewer-suggestions` — OPS-absent (zero wiring confirmed in code); pilots the
   `n/a` path and OMP-only delta.

## 7. Top risks

1. **Unmarked parity** (B+C agree, worst risk): an unbadged rule is an unprobed
   three-app claim; OPS hidden-ness makes missed badges the likeliest defect.
   Mitigations: explicit "No variations (probed)" claim line per spec section,
   parity-control probes in every delta battery, anchor-tripwire script (grep
   omp/ops for overrides of symbols the spec footnotes).
2. **Submodule version skew**: shared tests + app harness land via manually-advanced
   pins; the pkp-lib CI matrix + `_test` API aliasing are the guards.
3. **OJS-flavored "shared" tests**: expect demotions during the M0 purge; don't
   trust the shared label until probed.
4. **Reference-key churn**: variation overrides key on rule numbers + quoted stubs;
   OJS amendments cause lint noise → append-only numbering convention; if sampling
   shows stub-refresh fatigue, escalate to a TEMPLATE-rule-5-style halt-and-sweep.
5. **OPS skip-hollowing**: a shared suite that skips 60% of itself on OPS reads as
   coverage but isn't — track OPS by its own applicable-feature list, never by
   shared-suite adoption.

## 7b. Worked example — OMP review (the boundary case, maintainer-raised)

OMP review decomposes into every delta type at once; how each nuance lands:

- **Extra decisions on a shared stage** → behavioral delta: an override in
  `editorial-decisions.md`'s `## App variations — OMP`, keyed to the
  decision-roster rule with a quoted stub, OMP anchors + OMP probe footnotes.
  Tests: thin `editorial-decisions.omp.spec.js` companion covering only the
  added decisions.
- **The additional Internal Review stage** → hybrid, because it is the SAME
  machinery instantiated on another stage:
  - each review-machinery spec gets ONE scope declaration in its OMP variations
    section — "applies identically to both Internal and External Review
    <sup>probed</sup>, except: …" (the parity claim is probed, never assumed);
  - one small OMP-unique spec `omp-internal-review.md` owns only what is new:
    stage existence/position, entry & exit decisions, internal-round visibility,
    transition topology — referencing the shared review specs for machinery
    (single-home discipline);
  - tests: shared review cores already run on OMP's external stage; the
    `hasInternalReview` capability triggers an OMP companion re-running a
    REPRESENTATIVE SUBSET of scenarios on the internal stage + the transition
    decisions (seeded via the `reviewRounds` internal/external schema key).
- **OMP features with no OJS counterpart** (catalog, chapters, formats…) → full
  ordinary specs, `apps: [omp]`, new OMP area rows, OMP-repo tests, OMP budget.

**The general rule this fixes in place**: an app addition that PARAMETERIZES
existing machinery (another stage, another decision in a roster) is a variation
+ companion test; an addition with its own screens and rules is a feature with
its own spec. When in doubt, split like internal review: thin unique spec for
the topology, parity declarations for the machinery.

## 8. Decisions needed from the maintainer

1. Approve the four-tier spec mechanism (§2) and the capability-flag test shape (§3)?
2. Approve per-area delta sequencing (§4) — or prefer per-feature/end-of-campaign?
3. Budgets: confirm OMP ≤550 / OPS ≤300 ceilings.
4. M0 scope: submodule alignment + `_test` port is real engineering (not spec work) —
   schedule it as its own effort? Who owns the OMP/OPS branch alignment?
5. When do delta passes start: after Area 2 completes for OJS (first closed area
   under the current directive), or retro-pilot on the already-verified rows now?

## 9. TRIAL — review-focused pilot (approved 2026-07-25)

**Maintainer decision**: run the pilot NOW on already-verified review-cluster rows
(retro-pilot; §8-Q5 answered), focused on review stage(s) to challenge the
mechanism at its hardest point. Calibration mode: ONE unit per fresh session,
maintainer reviews after each. §2–§4 mechanisms and §4 budgets provisionally
approved for the trial's scope.

### Pilot trio (in order — each exercises a different §7b delta class)

1. `workflow-stage-navigation` — the stage-topology axis itself (OMP 5 stages /
   OPS 1); pilots capability flags + existence badges both directions.
2. `assign-and-manage-reviewers` — review machinery: OMP parity declaration
   ("applies to Internal + External, probed") + internal-stage test subset;
   OPS `n/a(no review)` — pilots the absence gate with a live absence probe.
3. `editorial-decisions` — behavioral deltas: OMP's added decisions incl. the
   internal→external topology edge (thin `omp-internal-review.md` spec is
   in-scope here if the graduation rule demands it); OPS's reduced roster
   (Decline/Revert only).

### M0-lite — environment bring-up, scoped to the pilot (BLOCKER, runs first)

Engineering session(s), not spec loops. Work the gates IN ORDER; commit per gate
(lib/pkp vs app repos separately, RUNBOOK step 10 discipline); STOP and report at
any gate needing maintainer input.

- **G1 — submodule alignment**: point omp-main + ops-main `lib/pkp` at the
  campaign SHA; resolve app-side fatals (expect abstract-method/plugin drift —
  RUNBOOK "Plugin-submodule alignment" lore applies). GATE: both apps boot and
  serve a login page.
- **G2 — servers**: config-factory base-port parameter → OJS 8000 / OMP 8100 /
  OPS 8200 side-by-side; OMP/OPS test DBs (Postgres, mirroring ojs_test setup).
  GATE: three fleets up simultaneously, seeded admin login works on each.
- **G3 — scenario API port**: `api/v1/_test` endpoints live on OMP + OPS;
  shared schema de-OJS'd (`journal`→`context` alias; section/issue/galleys as
  app overlays; `reviewRounds` internal/external key; IssueProcessor out of the
  shared path). GATE: createContext + createSubmission succeed on all three
  apps; an OMP submission seeds an internal review round.
- **G4 — app trees**: minimal `playwright/` tree in omp-main + ops-main
  (config, `support/app.context.js` with the capability map, bootstrap seeds
  for each app's role subset). GATE: a trivial smoke spec (login + dashboard
  heading) green on OMP and OPS.
- **G5 — spec-side tooling**: `APP-GLOSSARY.md` (vocabulary + capability names);
  lint-spec.sh extended (badge syntax, variation-stub match, glossary terms).
  GATE: lint passes on all existing specs unchanged (mechanism is additive).

### Trial session sequence (each = one fresh session, standard kickoff prompt
pointed at this file's §9)

M0-lite (G1–G5, one or more sessions) → pilot 1 → maintainer review → pilot 2 →
review → pilot 3 → review → GO/NO-GO on campaign-wide adoption (§8 decisions
finalized, RUNBOOK/TEMPLATE amended, delta passes scheduled per §4).

Delta-loop steps for the pilot sessions: §4 "delta loop", plus each pilot ends by
proposing amendments to THIS plan from what it learned (the trial exists to find
the mechanism's friction, not to confirm it).

**Housekeeping note**: OJS row 10 (`send-to-review`) is still `in_progress` from
its flag-killed session — its standard resume session should run before or
alongside the trial; it is not a trial dependency.
