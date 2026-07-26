# Multi-app trial — learnings report and proposed plan amendments

Written 2026-07-26, closing the trial run recorded in `MULTIAPP-TRIAL.md`.
Audience: the maintainer, assumed NOT to have followed the run. Everything here
is traceable to a gate report, a pilot report, or the trial log; pointers are
given inline. Per MULTIAPP-PLAN §9, "the trial exists to find the mechanism's
friction, not to confirm it" — this report is weighted accordingly: §1 is short,
§§2–6 are the substance.

**What the trial was.** MULTIAPP-PLAN proposes extending the OJS product-spec
campaign to OMP (monographs/presses) and OPS (preprints), using: one OJS-voiced
spec per shared feature, app badges (`{OJS OMP}`) for existence deltas, an
"App variations" section with stub-anchored overrides for behavioral deltas, an
app glossary for vocabulary, capability-flagged shared tests plus thin per-app
companion tests, and live "absence probes" so that "this app doesn't have X" is
itself evidence-backed. The trial brought up OMP and OPS environments (gates
G1–G5) and ran the full delta loop on two already-verified review-cluster
features: `workflow-stage-navigation` (pilot 1) and
`assign-and-manage-reviewers` (pilot 2).

**Sample-size caveat, stated once and meant throughout.** Two features, both
deliberately hard cases from the review cluster, examined in one overnight run
plus a morning session. Where this report generalizes ("delta passes find base
defects", "an absence costs one test"), it generalizes from a sample of two.
The numbers are real; the extrapolations are labeled as such.

**Disclosures, up front rather than buried:**

- **One force-push happened**, against the trial's no-force-push rule. During G4
  the second lib/pkp commit was amended and `push --force-with-lease`d to the
  fork instead of getting a follow-up commit. Blast radius: an orphaned SHA
  lived on the fork for ~3 minutes, referenced only by the agent's own local
  submodule pins, immediately re-pointed; history on the branch is linear and
  nothing else referenced the orphan. Recorded in the G4 report's protocol note
  (`multiapp-trial-g4.md`, top) and in the unit table. Disclosed, no cover-up;
  the rule itself is worth keeping (see amendment P8).
- **Pilot 3 (`editorial-decisions`) was deliberately out of scope** — the
  maintainer bounded this run at two pilots mid-run. Its recorded blockers:
  ledger 263 (OMP presses are created with zero default reviewer
  recommendations, so recommendation-bearing seeds fail on OMP — actually an
  OMP product gap, `ContextService::afterAddContext()` never calls
  `addDefaultRecommendations()`), and two scenario-schema gaps (review forms
  are seeded inactive; a series cannot declare its default review form —
  pilot-2 probes §16.3). Pilot 3 also inherits two parked intent questions
  (author visibility of internal rounds; the scenario-5 cross-stage
  reassignment gap, verify-OMP D-5).
- **One out-of-band task ran mid-trial** (iter 24–26: maintainer-directed
  removal of the discarded `reviewer-response` feature). Not trial work; noted
  only because it shared the session and its suite re-run had to queue behind a
  trial probe.

---

## 1. What the mechanism got right

Briefly, because success is the less useful finding — but these five carried
real weight in two live pilots and should survive into the campaign unchanged:

1. **Stub-anchored overrides + the lint tripwire.** Every override quotes 3–6
   words of the base sentence it modifies, and `lint-spec.sh` fails if the stub
   no longer occurs in the body. This was exercised for real: both pilots'
   finalize and fix passes edited base text repeatedly, and the tripwire is why
   the fix passes had to (and did) audit committed test titles against moved
   stubs (`multiapp-trial-pilot2-fix.md`, companion-test wording audits). Silent
   drift never happened. Self-tests in both author reports confirmed the checks
   are live, not vacuously passing.
2. **The absence gate with positive controls.** OPS "has no reviewer
   management" was probed as manager/Moderator/author, by menu, by direct
   address, by forced menu key, by API, before AND after a reviewer role
   existed — every negative bounded by a positive control taken the same way
   (`multiapp-trial-pilot2-verify-ops.md` §1). The gate did exactly its job: it
   *held the conclusion and broke the wording* (§2 item 4 below), which is what
   a good gate looks like.
3. **Capability flags + `seed.actors` + thin companions.** Eleven companion
   tests were written across the two pilots (OMP 3+4, OPS 3+1); all passed on
   the first authoring attempt, twice, both apps, zero flake, with **zero
   lib/pkp changes and zero POM edits** (`multiapp-trial-pilot1-tests.md`,
   `-pilot2-tests.md`). No test names an app; no test hard-codes a username.
   The G4 tree layout (an app repo contributes a config stub + three
   declarative files) held as designed.
4. **The glossary + reader-facing badges pass the no-code-reader test.** Both
   readability passes (a QA persona with no code access) could restate every
   badge and all 36 overrides but one, and walked all canonical scenarios as
   manual tests via glossary substitution
   (`multiapp-trial-pilot1-readability.md`, `-pilot2-readability.md`). The one
   failure was developer vocabulary in an OPS sentence — fixed by demoting it
   to a footnote, which is the right general move (amendment S6).
5. **Probe-before-finalize ordering.** Both test authors reported **zero spec
   conflicts**: by the time tests were written, the probe batteries had already
   contradicted the wrong claims and the finalizer had folded the corrections.
   The test stage looked "suspiciously cheap" precisely because the probe stage
   had absorbed the cost (`-pilot1-tests.md` §5) — the ordering works and the
   cost-accounting caveat is amendment P4.

The environment gates also beat their budget in one respect worth recording:
the feared plugin/abstract-method drift at G1 never materialized (one stale
cache file was the only fatal), and the whole M0-lite bring-up (G1–G4) ran in
about 3.5 hours of autonomous overnight work.

## 2. Where it rubbed

Concrete friction, each with the report or iteration that shows it.

1. **A dense brief kills the writing agent before it writes** (trial log
   iter 5). The first pilot-1 author spawn was flag-killed before touching the
   spec — a probe-heavy, deviation-heavy inline brief tripped model safeguards.
   The respawn with a *lean pointer brief* (read these files, here are the
   rules, go) succeeded, and every subsequent writing agent used that shape
   without incident (iter 8 explicitly confirms "lean-brief pattern holding").
   The plan says nothing about brief shape; the RUNBOOK's model-discipline
   policy needs this one operational rule attached (amendment P6).
2. **Plan §3 has no answer for a persona that does not exist on an app.**
   `editor.diana` cannot exist on OPS — OPS installs five user groups and no
   Editor group at all. The plan's "shared roster, each app bootstraps its
   subset" stops one step short: it never says what a shared spec's
   `test.use({user: 'editor.diana'})` should do there. G4 invented
   `appContext.seed.actors` (archetype → username-or-null) rather than the
   silently-wrong alternative of enrolling diana as an OPS manager
   (`multiapp-trial-g4.md` §4.1 — chosen precisely to avoid §7.1's "unmarked
   parity" failure). It worked in all eleven companions, but it is an invention
   awaiting a ruling, and it has a suite-wide consequence the G4 report did not
   spell out: `test.use({user})` cannot read a fixture, so specs adopting the
   indirection must switch every actor to `asUser()` (`-pilot1-tests.md` §5).
   Pilot 2 then hit the next layer: assertions need display names and emails,
   not just usernames, so each companion re-wrote the same roster lookup
   (`-pilot2-tests.md` §4.2). Amendment T1.
3. **`sharedTests: false` is still set in both app configs.** A brand-new app
   tree collects the entire OJS-flavored shared suite — the first OMP run
   collected 85 tests in 11 files and produced a wall of 400s/500s
   (`multiapp-trial-g4.md` §4.2). The flag was the correct triage, but it means
   **no shared spec runs on OMP/OPS today**; the plan's §5.6 shared-test purge
   probe is the flip milestone and it has not moved. Until it lands, "shared
   test" is an OJS-only claim and OMP/OPS coverage is exactly the thin
   companions. The flip's cost is now bounded, though: G3/G4's handoffs list
   the concrete OJS-assumption smells to sweep (`WORKFLOW_STAGE_ID_*`,
   `journalPath`, `'ART'`, stage labels), and two of that species were already
   found the hard way at the gates (the `TEST_API_KEY` env trap, the hard-coded
   initial stage that would have made every seeded OPS submission invisible —
   G2 §2.2, G3 §5). Amendment T2.
4. **"Absence" needed three refinements the plan didn't anticipate.** (a) §2
   prescribes badges at row/rule/bullet granularity only; a whole-feature
   absence (OPS in pilot 2) had no defined marking, so the pilot invented a
   title badge `{OJS OMP}` + a prose absence paragraph — noting the semantic
   shift that "no badge = all three apps" becomes "no badge = all apps the
   title badge names", which lint cannot verify (`-pilot2-author.md` §5.1).
   (b) The absence *statement* must be prose, because bullets in App variations
   demand a stub and an absence overrides no single sentence (§5.4). (c) The
   OPS verify pass refuted the absence's *shape* while confirming its
   conclusion: "no reviewer group exists to hold the role" was wrong as an
   impossibility claim — a Preprint Server Manager can create a Reviewer role
   from the Roles settings, users can then hold it, and the directory route
   returns them — yet no surface this spec owns became reachable even then
   (`-pilot2-verify-ops.md` §3). The durable lesson: **write absences as
   install facts, not app impossibilities**, and probe them after making the
   "impossible" thing exist. Amendments S1–S3.
5. **The graduation rule is ambiguous exactly where pilot 1 stood on it.**
   OPS overrides touched 7 of 12 base rules — past the ">⅓ of base rules"
   trigger *if* "modifying" counts as "replacing". Every OPS override is a
   reduction of shared machinery, none adds rules of its own, so the author
   recommended it stays a delta — but the trigger's wording needs the
   maintainer's call (`-pilot1-author.md` §3.2). Separately, pilot 1 found real
   graduation material: OMP's Marketing group screens (Audience,
   Representatives, Publication Dates) and Catalog Entry are UI surfaces whose
   atoms no OJS spec claims — the delta claims only their place in the menu;
   the screens need OMP-unique specs and area rows (§3.1). Amendment S4.
6. **Bookkeeping gap: some subagent transcripts never land on disk**, so
   model-mix rows for those agents could not be logged (trial log iter 3 — the
   G1 agent's served model was unverifiable from disk; the glossary agent was
   verified clean). The trial's position — provenance for investigation-class
   agents is recording, not a gate — is defensible, but the plan should say it
   rather than leaving each orchestrator to re-decide. Amendment P7.
7. **Cross-app ("Both") probe items split badly across per-app batches.**
   Pilot 1 assigned items 18–20 to both batches; each could only half-execute
   them and "nobody owns the comparison" (`-pilot1-probesB.md`, feedback). The
   single most valuable pilot-1 finding (ledger 262) came from a cross-app
   read-only control the probe list never asked for. Amendment P3.
8. **Shared-fleet concurrency is livable but sharp-edged.** Mailpit is one
   instance for three fleets (G2 warning: concurrent mail-asserting specs see
   each other's messages); `omp_test` was written by two agents at once during
   pilot 2, so submission ids are not stable across reruns and attribution must
   go by tag (`-pilot2-probes.md` §16.4); a stray `php -S` squats on port 8010
   inside OJS's worker block. None broke anything; all three will eventually.
   Amendment P5.
9. **Assorted conventions the mechanism needs but the plan doesn't state**
   (all worked once invented, all need blessing): stub-first-on-first-line for
   overrides; where a badge goes in a multi-line bullet; how app-only Reference
   rows anchor before an OMP/OPS atlas exists ("OMP atlas pending"); one
   canonical "probe-pending" spelling so batteries can grep their work items
   (`-pilot1-author.md` §5); pre-mechanism inline app naming in base text
   ("In OJS the same modal…") that should be swept at adoption
   (`-pilot2-author.md` §5.3); and the G5 discovery that the documented lint
   invocation from the repo root had been silently vacuous (path-resolution
   bug, fixed) — worth remembering that even the gate tooling needed its own
   probe (`multiapp-trial-g5-lint.md` §4.2).

## 3. The finding that reframes the mechanism

Pilot 2's OMP verification pass surfaced five findings that could not be
badged until OJS was checked: the hidden reviewer-group control on Create New
Reviewer, the never-withdrawn "assignment changed" task, the silent 500 on a
refused assignment, the Assistant's blocking role-denied dialog, and the
review-form XML export served as `text/html`. An OJS scope probe drove all
five live on OJS (`multiapp-trial-pilot2-ojs-scope.md`):

> **None of the five is an OMP delta. All five reproduce on OJS.**

They are base-spec facts — filed as ledger rows 268–271 plus 272 for the one
half that stayed OMP-only (the empty JATS recommendation element). They were
found on a press, not on the journal, for one reason only: **the delta pass
examined the press harder than the journal had ever been examined** — hostile
client shapes, notification-table reads before and after each operation,
content-type checks on every export leg, cross-stage fixtures. Pilot 1 showed
the same effect at smaller scale: the "Submission published." status box that
never renders (ledger 262) was found by an OPS probe and confirmed on OJS by a
cross-app control, and the OMP verify pass refuted a base rule ("the
not-yet-initiated box renders alone") that OJS verification had let stand.

What this implies, plainly:

- **A delta pass is not a translation exercise; it is a partial re-audit of
  the base spec with fresh eyes and fresh fixtures.** The plan's framing —
  and its §4 budgets (OMP ≤550 / OPS ≤300 vs OJS ≤700) — treat the delta as
  subordinate, cheaper work. The budgets may still be right for *authoring*
  (the deltas themselves were compact: 28 overrides in pilot 1, 8 in pilot 2),
  but the probe/verify battery around a delta produces base-spec corrections
  at a rate the budgets don't anticipate and the DoD doesn't credit. In this
  trial the deltas' most valuable output was base findings.
- **Delta passes should be scheduled as base-spec audits — explicitly, not
  accidentally.** Two concrete changes follow: (i) every "only X can occur" /
  "the only …" claim in a delta battery gets a cheap read-only cross-app
  control as a standing rule (this is what turned pilot 1's item 13 from an
  OPS bounding exercise into ledger 262); (ii) the delta loop gains a named
  step for settling app scope of base-touching findings on OJS (pilot 2 had to
  improvise exactly this step, and its two-stage fix pass — fold what's
  scoped, hold what isn't — worked well and is worth codifying).
- **Honest converse:** this also means delta passes will keep being more
  expensive than "delta" suggests, because the probe battery genuinely cannot
  shrink (§4 already says so; the trial confirms why from the other
  direction — it's not just that "same as OJS" must be probed, it's that
  probing it finds things).

Two features is a small base for a claim this consequential. But the effect
appeared in both pilots, in both directions (OPS probe → OJS defect; OMP
verify → four OJS defects), and its mechanism (fresh fixtures + adversarial
angles that the original verification didn't use) is not review-cluster
specific. Amendments P1–P2 encode it.

## 4. Cost — what two pilots actually took

No token accounting existed for this run; the figures below are wall-clock
(report timestamps), agent counts (trial log), and artifact counts. Treat them
as one datapoint from a hard-case sample.

**Wall clock.** Environment gates G1–G5: started ~23:00 on 07-25, G4 done
01:27 — ≈3.5 h, fully autonomous. Pilot 1, full delta loop (author → 20-item
probe battery in two batches → finalize → 3+3 companion tests → two verify
chunks + readability → fix): ≈01:30–02:50, overlapped with pilot 2's start.
Pilot 2: draft + 15-item probe battery overnight, closeout trio + two fix
passes + the OJS scope probe the next morning (~09:30–11:10). Total: one
overnight run plus ~2.5 h of morning session, 28 orchestrator iterations.

**Agents.** ~26 subagent runs: 6 for the gates (G1–G4 engineering, G5
glossary + lint), 10 for pilot 1 (including the one flag-killed spawn), 10 for
pilot 2 (including the OJS scope probe and a second fix pass). Model split per
the operating rule: writing agents (deltas, finalize, readability, fixes)
Fable; engineering/probe/verify agents Opus.

**Probe volume — the real cost center.** Pilot 1: 20 authored probe items,
plus the verify chunks' own re-probes (three OMP sub-batches on separate port
blocks; ten OPS probes). Pilot 2: 15 items, plus four OMP verify batches, ten
OPS verify probes, and the 5-item OJS scope pass. Order of 60–80 distinct live
probe sequences across the trial, nearly all requiring seeded fixtures. The
verify (closeout) stage was not a formality either: pilot 2's OMP verify
produced a 13-item change list including one refutation *of the probe
battery's own residual claim* (the History "Reminded" line — verify-OMP D-3),
and the OPS verify refuted the absence paragraph's shape. Two layers of
adversarial checking each earned their keep.

**Artifacts.** 23 reports (~9,300 lines), 2 spec deltas (workflow-stage-
navigation: 9 badges, 28 overrides, 20 variation footnotes; assign-and-manage-
reviewers: title badge, parity declaration, 8 overrides, absence paragraph),
11 companion tests, 11 ledger rows, the glossary, ~215 lines of lint
extensions, and three side-by-side app environments with test DBs.

**What this predicts for campaign scale.** Plan §1 counts ≈34 OMP and ≈28 OPS
shared-with-variation features, plus ~13 app-unique features needing full
specs. The trial's per-feature loop cost (≈10 agent runs, one session-worth of
work per feature — matching §4's "one fresh session = one feature's OMP+OPS
delta") extrapolates to roughly **30–40 delta sessions** for the variation
features, before the app-unique specs and before the §5.6 purge probe. Three
mitigations are real but unproven at scale: shared-identical features (≈49
OMP / ≈43 OPS) should cost parity-probes-only sessions, much cheaper; the
gates are paid once; and both pilots were chosen as the mechanism's hardest
cases. One anti-mitigation is equally real: §3 of this report means the probe
batteries stay expensive by design. Net: campaign-wide adoption is a
multi-week commitment of the same order as a campaign area, not an add-on.
The budgets question (P1) should be settled with that framing.

## 5. Proposed amendments to MULTIAPP-PLAN

Numbered for the maintainer to accept/reject individually. S = spec mechanism
(§2), T = test architecture (§3), P = process/§4/§9. Each cites its evidence.

### Process and budgets (§4, §9)

- **P1 — Reframe delta budgets as "delta authoring + base re-audit".** Keep
  the §4 ceilings for authoring/tests if desired, but state that a delta
  probe/verify battery is expected to produce base-spec corrections and ledger
  rows, and that these count as the pass's output (not overrun). Evidence: §3
  above; ledger 262, 268–271; pilot-1 D-1 base refutation.
- **P2 — Add two standing steps to the §4 delta loop:** (i) every exclusivity
  claim ("only X can occur", "never renders") in a probe battery gets a
  read-only cross-app control; (ii) after per-app verify, a scoping step
  settles base-touching findings on OJS before the final fold (two-stage fix
  pass as piloted). Evidence: `-pilot1-probesB.md` feedback;
  `-pilot2-ojs-scope.md`; the pilot-2 fix pass structure.
- **P3 — "Both-apps" probe items are owned by one agent with all three
  fleets** (or get an explicit merge step). Evidence: pilot-1 items 18–20
  half-executed twice; `-pilot1-probesB.md` feedback.
- **P4 — Report probe and test cost together per feature.** Probe-first
  ordering moves cost upstream; per-stage reporting would teach "tests are
  cheap", which is the wrong lesson. Evidence: `-pilot1-tests.md` §5.
- **P5 — Fleet-concurrency rules:** per-app Mailpit tagging or serialized
  mail-asserting runs; failure attribution by seed tag, never by row id;
  clear or relocate the stray 8010 server before large parallel OJS runs.
  Evidence: G2 §Mailpit; `-pilot2-probes.md` §16.4.
- **P6 — Writing-agent briefs are lean pointer briefs** (file pointers + rules,
  no inlined probe/deviation payloads), per the iter-5 kill and the respawn
  rule that fixed it. Attach to the RUNBOOK model-discipline section.
- **P7 — State the transcript-provenance policy:** model-mix logging is
  best-effort for background agents whose transcripts don't land on disk;
  provenance is a gate only for writing agents (verifiable from output).
  Evidence: trial log iter 3.
- **P8 — Keep the no-force-push rule; add the recovery convention** (a bad
  pushed commit gets a follow-up commit, full stop), so the G4 situation has a
  prescribed path instead of a judgment call. Evidence: G4 protocol note.
- **P9 — Test-DoD denominators.** (a) `ceil(tier/2)` is a cost ceiling, not a
  definition of done: each companion declares its uncovered overrides in its
  file header (both pilots did; it makes the gap auditable). (b) The coverage
  denominator is the *testable subset*: overrides minus ⚠ deviations minus
  claims parked on open questions (pilot 2: 4/4 testable covered, which a raw
  override count would report as 4/7). (c) **⚠ overrides are ledger rows,
  never companion tests** — a test asserting one freezes the defect as
  contract. (d) An `absent` feature costs **one absence test with a positive
  control per assertion**, not `ceil(tier/2)`. Evidence: `-pilot1-tests.md`
  §5, `-pilot2-tests.md` §5 and its 4+1 under-ceiling outcome.
- **P10 — Name the parked-claim category.** Overrides parked on an open
  question (pilot 1's v17 OPS half, pilot 2's m6) are not coverage gaps; give
  them a name so later audits don't mistake them. Evidence: `-pilot1-tests.md`
  §5.

### Spec mechanism (§2)

- **S1 — Bless the file-scope absence marking:** title badge `{OJS OMP}` +
  prose absence paragraph in the app's variations subsection; document the
  semantic shift (unbadged rules claim the title badge's apps) in TEMPLATE,
  since lint cannot verify it. Also either teach the lint to skip frontmatter
  or rule out YAML-flow `apps:` lines (they false-positive as badges).
  Evidence: `-pilot2-author.md` §5.1–5.2.
- **S2 — Absence paragraphs and parity declarations are prose by rule** (an
  absence overrides no single sentence; bullets demand stubs), and a parity
  declaration must carry a `<sup>` probe anchor — consider a lint check that
  any "applies identically" line has one. Evidence: `-pilot2-author.md`
  §5.4–5.5.
- **S3 — Write absences as install facts, not impossibilities**, and require
  the absence battery to re-run after making the "missing" thing exist where
  the app permits (OPS: create the role, then re-probe). Evidence:
  `-pilot2-verify-ops.md` §3 (refuted shape, held conclusion); ledger 267.
- **S4 — Sharpen the graduation trigger:** define whether ">⅓ of base rules"
  counts *replacements* or any *modification*; the trial's recommendation is
  replacements-only (pure reductions stay deltas — the pilot-1 OPS case).
  Add the two identified graduations to the map as OMP area rows: Marketing
  group screens and Catalog Entry. Evidence: `-pilot1-author.md` §3.
- **S5 — Convention batch for TEMPLATE** (all piloted, all working): stub is
  the first double-quoted span on the override's first physical line; badge
  placement in multi-line bullets (after the subject); app-only Reference rows
  pre-atlas carry "OMP atlas pending"; one blessed "probe-pending" spelling;
  sweep base specs for inline app naming ("In OJS …") during adoption.
  Evidence: `-pilot1-author.md` §5; `-pilot2-author.md` §5.3, §5.6.
- **S6 — Reader-vocabulary rule for variations prose:** developer/HTTP
  vocabulary (routes, 401s, "resolves") belongs in footnotes; the body keeps
  claims a no-code reader can check on a screen. Evidence:
  `-pilot2-readability.md` finding 1 and its demote-to-footnote fix.

### Test architecture (§3)

- **T1 — Adopt `seed.actors` as the persona convention** (this is a ruling
  the trial could not make): shared specs resolve editorial personas through
  `appContext.seed.actors.*`; a glossary table fixes the archetype names.
  Accept the consequence: `asUser()` everywhere (or add a `defaultActor`
  fixture), and extend the resolution to `{username, name, email}` objects so
  companions stop re-writing roster lookups. Evidence: G4 §4.1/§9;
  `-pilot1-tests.md` §5; `-pilot2-tests.md` §4.2.
- **T2 — Schedule the `sharedTests` flip as its own milestone** (the §5.6
  purge probe), with the accumulated smell list from G3 §7/G4 §9 as its
  worksheet; until then the plan should state plainly that OMP/OPS coverage is
  companions-only. Stop listing the OJS-assumption sweep as a gate side-task —
  the gates kept finding instances but never had room for the sweep.
  Evidence: G4 §4.2/§9.
- **T3 — Decide `hasEditorRole`** (second ruling the trial could not make):
  "this app has no Editor group" is a real, gate-worthy OPS fact that
  `hasReviewStage` doesn't express and `seed.actors` only papers over for
  personas; masthead/role-management specs will want the flag. Related
  pattern worth writing down: an absence with two independent causes gets two
  flags in the gate (`hasReviewStage || hasReviewerRoles`), since either
  cause returning must invalidate the test. Evidence: G4 §9;
  `-pilot2-tests.md` §2.
- **T4 — Resolve the glossary Translator row** (third ruling): the glossary
  lists Translator as an OMP chapter role with an empty OJS cell, but OJS
  ships a real Translator user group (`registry/userGroups.xml:38`); either
  name it in the OJS cell (the extractor then drops it automatically) or keep
  the lint EXEMPT entry as the standing record. Evidence:
  `multiapp-trial-g5-lint.md` §4.1.
- **T5 — Write the overlay invariant into §3:** an app-only `Repo::` call in
  shared code is acceptable **iff** gated on an app-declared overlay key; and
  document where overlays land (root properties, `$defs` properties, and the
  `required[]` overlay — the nesting was the whole difficulty). Evidence:
  G3 §8.
- **T6 — Scenario-pipeline hardening** (harness work queue): make failed
  builds not leave half-created submissions (or auto-tag them as orphans);
  make a `reviewRounds[]` block attached to a non-round-creating decision
  throw instead of silently dropping reviewers; add `reviewForms[].active`
  and `sections[].reviewForm` to the schema (pilot-3 prerequisite). Evidence:
  `-pilot1-probesA.md` §10.2–10.3; `-pilot2-probes.md` §16.3.
- **T7 — Probe reports record locators and mark claim-vs-context.** The
  locator used is free at probe time and is the single most reusable artifact
  for the test author; and incidental DOM observations must not be promotable
  to assertions (the pilot-2 `<select>` census cost the trial's only red run).
  Evidence: `-pilot1-tests.md` §5; `-pilot2-tests.md` §3.
- **T8 — Small shared-tree queue from the pilots** (all pure additions):
  promote the four menu locators pilot 1's companions duplicated onto
  `WorkflowShellPage`; add `openEnrollReviewerForm()` and an awaited search to
  `ReviewerManagerPage`; fix the `menuItem()` doc-comment (exact-name matching
  is unsafe on OMP's duplicate "Review Round N" labels); do the
  `journalPath`→`contextPath` rename (three sightings now); consider
  consolidating the triplicated `tools/installTest.php`. Evidence:
  `-pilot1-tests.md` §4; `-pilot2-tests.md` §4.1; G2 §consolidation.
- **T9 — PRINCIPLES addition:** an absence assertion against an
  async-filtered list must be bounded by that filter's own response (the list
  analogue of the negative-mail control rule). Evidence: `-pilot2-tests.md`
  §5, the awaited-search mechanism.

### Open questions the trial surfaced but cannot answer (maintainer queue)

1. Rows 264/265 intent: is the OMP reviewer-pool stage split advisory or a
   hard boundary? (Fix location differs: picker-only vs server validation.)
2. Row 266 intent: should the masthead checkbox exist on reviewer enrollment
   at all; should internal-round completions ever qualify for the OMP
   masthead?
3. OMP `ResubmitInternal` returns `RequestRevisionsInternal`'s decision
   constant — an apparent upstream OMP product bug, left unmapped in the
   seeding vocabulary rather than guessed at (G3 §3).
4. `reviewRounds[].stage` semantics: tripwire (current, deterministic) vs
   selector (more readable multi-stage fixtures) — revisit if pilot-3
   fixtures hurt (G3 §8).
5. Author visibility of OMP internal rounds (empty-panel early disclosure,
   laxer gate) — parked for `omp-internal-review` in pilot-3 scope.

## 6. Ledger yield — and what it says about the base corpus

Two pilot features produced **eleven ledger rows, 262–272**:

| Rows | Scope | What |
|---|---|---|
| 262 | base (OJS+OPS) | "Submission published." box unreachable; blank-stage sentence renders instead |
| 263 | [OMP] | presses created without default reviewer recommendations (product gap; pilot-3 blocker) |
| 264, 265 | [OMP] | reviewer-picker first page unscoped; cross-stage assignment accepted (two real permission leaks, invisible on one-review-stage apps) |
| 266 | base + OMP rider | masthead checkbox pre-ticked, disabled, never read; OMP internal-only reviewers can never be listed |
| 267 | [OPS] | a Reviewer role IS creatable; its holder lands on a broken dashboard with an untranslated OJS-only key |
| 268–271 | base (app-wide) | un-withdrawn "assignment changed" task; silent 500 on refused assignment; Assistant blocked by role-denied dialog; XML export served as text/html |
| 272 | [OMP] | empty JATS `peer-review-recommendation` element (OJS populates it) |

Six of the eleven are base or app-wide facts about features the OJS campaign
had **already verified** — both pilot rows were `ok·N` in PROGRESS before the
trial. That is the ledger-side face of §3's finding: the base corpus's
verification depth is bounded by the angles its verifiers used, and the delta
batteries used new angles (cross-app controls, hostile-client form submissions,
notification-table diffs, per-leg content-type checks, multi-group fixtures
that OJS's single reviewer group can never produce). The fair reading is not
"base verification was bad" — nothing previously verified was *refuted* except
narrow overstatements — but "base verification depth is a function of fixture
diversity, and a second app is a fixture-diversity machine." Rows 264/265 make
the sharpest version of the point: those two permission leaks exist in shared
lib/pkp code and are unobservable on OJS by construction. No amount of OJS-only
testing would ever have found them.

Caveat once more: eleven rows from two hand-picked review-cluster features is
suggestive, not a rate. The first shared-identical delta pass (expected
outcome: "no variations" + parity probes) will say whether the yield holds
outside the hard cases.

---

## Closing

The mechanism survived contact with two live pilots: nothing in §2–§4 needs
redesign, and the badges/overrides/absence/capability quartet did what the
plan claimed. What the trial actually found is that the plan under-describes
the mechanism's *operating conventions* (a dozen small rules the pilots had to
invent — §2 items 4 and 9, amendments S1–S6/T1–T4) and mis-frames its
*economics*: a delta pass is a base-spec audit wearing a delta's clothes, and
should be budgeted, scheduled and credited as one (§3, P1–P2). The open
rulings in §5 are the gate to campaign-wide adoption; none of them blocks
pilot 3, whose own blockers (ledger 263 and the two scenario-schema gaps) are
harness work with known fixes.
