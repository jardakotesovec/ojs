# Queued maintenance work (tracked)

Marching orders that must survive machine-local cleanups — moved here from the
gitignored `.reports/opus-eval/STATE.md` (2026-07-25), which keeps the eval's
execution history only. Delete this file when the queue is empty. The standing
maintainer rulings themselves live in `CHARTER.md` ("Standing maintainer
rulings"); this file holds the session briefs that land and sweep them.

Sessions run under the normal RUNBOOK contract, one per session, in order; they
do not count toward the wave counter and claim no PROGRESS row — strike the item
here when done. Area 2 (row 13 onward) resumes after items 1–2.

1. ~~**send-to-review maintenance loop**~~ **DONE 2026-07-26** (spec+tests+
   ledger 258–261+atlas committed; former OQ3 resolved as ledger row 259).
   Original brief, for the record: add Delete-submission
   coverage (eval decision 3; `arm-b-spec.md` rules 9/s4 + probe matrix in
   `.reports/opus-eval-analysis/inputs/` as reference — Fable re-authors, Opus
   probes re-verify live); fix the Site-Admin inversion, the Edit-a-file
   "(name, type)" claim (genre-dependent fields), and the permission-table
   scope — ONE shared workflow screen per the CHARTER ruling: the Author sits
   in the same rows as the editorial roles, role determines availability, and
   no "separate reduced tracking view" framing survives anywhere in the spec; reconcile ledger row 257 vs the spec's rule-5/OQ classification
   of the same behavior; tier M·7 → check if an 8th test fits budget.
2. **Re-scope + encoding session** (one session): GLOSSARY seed input — the
   real reader-stumble term list in
   `.reports/send-to-review-maint-readability.md` (kept past commit for this
   purpose). Integrate the CHARTER
   standing rulings into TEMPLATE (variance-based ownership + the manager/stage
   and author-dressing special cases, with the test-budget corollary and the
   walkability counterweight: context scenarios may inline the MINIMAL
   mechanic steps a walker needs, gloss-plus-pointer carrying the full
   behavior). Seed `GLOSSARY.md` swept from the existing specs ("shell" /
   "workflow panel", "tracking view", "dressing", "stage coverage",
   "assigned", …); growth loop: spec authors return glossary candidates in
   reports, the readability verifier's unresolvable-noun flags get rewritten
   or admitted, the orchestrator is the only glossary writer; optional lint
   later once the glossary exists. Sweep the corpus: amend `author-dashboard`
   (dashboard only) and `workflow-stage-navigation` (the one-shared-screen
   ruling replaces its two-dressings model + fix the Site-Admin
   "needs no assignment" baseline contradiction); survey other
   specs' tracking-view mentions; check author-dashboard's 6 tests for any
   that now belong to workflow features. Then trim the PROGRESS banner's
   maintenance note AND shrink CHARTER's "Standing maintainer rulings" section
   to invariant statements + pointers into TEMPLATE (per that section's own
   sunset clause).
3. **Optional salvage** (during test grooming, not a bulk import): POM helper
   patterns (`arm-b-pom-extensions.diff`) and exact-set assertion style, from
   `.reports/opus-eval-analysis/inputs/`.
4. **Process deliberation list (maintainer still thinking; do not land):**
   atlas↔frontmatter lint, anchor-overlap lint, glossary/"shell" + table-shape
   TEMPLATE rules, corpus seam-verifier chunk (g), spec-blind re-derivation
   diff chunk, RED-PEN.md registry + corpus-entrant readability persona,
   exception-driven review + DECISIONS.md queue.
5. Housekeeping: `.reports/reviewer-response-*` files await deletion after
   maintainer sampling; whether the eval's deep review counts as the wave
   sampling is the maintainer's call (counter stands at 6).
6. **UNASSIGNED grooming pass (unscheduled — maintainer to slot, e.g. at a
   sampling review):** the pile holds 4 parked atoms whose rows say "adopt at
   grooming" plus the dead-code candidate list; cluster them and route each
   (claim into a spec / mark out-of-scope in its sweep file). `UNASSIGNED.md`'s
   header points here.
