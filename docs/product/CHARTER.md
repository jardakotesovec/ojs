# OJS Product Specification Campaign — Charter

Pilot started 2026-07-02 on branch `e2e_revamp_fable`. THE contract for this campaign;
every session working on product specs reads this first.

## Mission

Document every OJS feature at the **business-logic level** — actors, fields, rules,
state, permissions, side effects — precisely enough that the feature could be
reimplemented from the spec alone. Audience: QA, developers, AI agents, and the
round-2 test-coverage crosswalk that will follow.

## Why (and why now)

Round 1 of the e2e revamp (`docs/e2e/`) built ~524 tests over 80 features, but its
feature inventory came from a single exploration pass and demonstrably missed features
(media-files and publication-amendments were caught only because the maintainer
happened to notice). This campaign inverts the method: **enumerate mechanically first**
(the atlas), then document, then map coverage. "Did we miss a feature?" must be a
grep, not a judgment call.

## Method — three phases

1. **Phase 0 — Surface atlas** (`atlas/*.md`): ~13 parallel mechanical sweeps, one per
   modality (page handlers, API endpoints, grid handlers, Vue surfaces, forms/schemas,
   plugins, mailables, notifications, jobs/tasks, authorization policies, event log,
   DB entities, locale-key space). Each sweep emits **atoms**: stable IDs + code
   pointer + one-line description. No business analysis in sweeps — completeness over
   depth.
2. **Phase 1..N — Spec waves** (`specs/*.md`): feature specs written to `TEMPLATE.md`,
   adversarially verified, claiming their atlas atoms. Re-runnable wave prompt below.
3. **Phase 2 — Coverage crosswalk**: every spec rule/scenario mapped against the
   existing e2e suite (`docs/e2e/`) → covered / gap / unit-test-territory /
   accept-untested → the round-2 test inventory, with a budget argument per gap.

## Invariants

- **Atom claim invariant**: every atlas atom ends up claimed by exactly one spec, or
  explicitly parked in `UNASSIGNED.md`, or marked out-of-scope in its sweep file with a
  reason. The unclaimed count is the campaign's progress/completeness metric.
- **Never force-fit**: a wrong grouping is worse than a deferred one. Atoms that don't
  obviously belong to a feature go on the pile (`UNASSIGNED.md`); grooming passes
  cluster the pile every few waves. Grouping heuristic: **user intent** ("what would a
  journal manager call this?"), never code-module boundaries. Litmus test: would a QA
  person test these rules together?
- **As-built AND intent**: specs document what the code actually does. Where behavior
  looks unintended, the rule is flagged `⚠` with a link to
  `docs/e2e/app-changes.md` (and a new ledger row is proposed if it isn't there yet).
  A spec that silently transcribes bugs as requirements is poison for QA.
  **Deviation collection is NON-BLOCKING**: new bug/deviation candidates are appended
  to the ledger as they're found and the wave moves on — the maintainer reviews the
  accumulated list at campaign end, not per wave.
  **Calibrate the ⚠**: reserve it for behaviour that is internally inconsistent, loses
  data, contradicts a UI affordance, or would genuinely surprise a product owner — NOT
  for a rule that is merely strict or restrictive, which is usually intended (e.g.
  "replies can't be deleted" is by design, not a bug). "As-built" facts are solid;
  "≠ intent" is a hypothesis only the maintainer can confirm. When unsure whether a
  restriction is intended, write it as a plain rule plus an Open question, not a ⚠
  deviation. Do not assert a suspected intent the code doesn't prove. A spec reaches `verified` when its
  claims match as-built behavior; intent adjudication and Open questions accumulate
  for the end review and never gate progress.
- **Verified, not just written**: every spec passes an adversarial verification pass
  (verifier attempts to refute the permission and state rules specifically, and checks
  the atlas for surfaces the spec should own but doesn't). Ambiguous rules are probed
  **live** on the test environment (scenario seeding + running PHP servers — see
  Live-probe etiquette) rather than guessed from code.
- **Business language, anchored**: the spec body reads as a functional spec; code
  anchors (`file:line`) ride along per rule so any claim can be re-checked as code
  drifts. Anchors are provenance, not content.
- **Frontend-first description, backend-verified rules**: the reader is a product owner
  or QA person who interacts with the **UI**, not the API. Describe every feature as it
  is experienced in the interface — what buttons/fields a role sees, what the screen
  does. Use backend validation/policies as the **source of truth for the rules**
  (they're authoritative and hardest to fake), but ALWAYS cross-check them against the
  frontend logic (Vue managers/composables, templates, legacy JS) and lead with what
  the UI actually offers. Where the two AGREE, state the UI behaviour and anchor both.
  Where they DIVERGE — the API permits something the UI hides, or the UI shows a
  control the backend rejects — the **UI reality is the headline**, and the divergence
  is a ⚠ deviation (e.g. the versioning "section editors can publish via API but see no
  button" finding). Never describe an ability only reachable by hand-crafting an API
  call as if it were a normal user capability; call it out as API-only.
- **Liveness before documentation**: code existing is not evidence the feature exists.
  OJS carries superseded surfaces — especially legacy grids/handlers being replaced by
  Vue managers — that are partly or fully unreachable. Before a spec documents a
  surface, establish it is reachable in the current UI (referenced from live
  templates/managers, not just present on disk). An atom judged unreachable is
  resolved as **dead-code candidate** (recorded in `UNASSIGNED.md` §Dead-code
  candidates with the evidence) — that list is itself a campaign deliverable for the
  maintainer. Where BOTH a legacy path and a Vue path are live for the same job (a
  real 3.6 situation), the spec documents both and says which is primary. Verifiers
  must attack liveness explicitly: "is this rule reachable by any user today?"
- **Placement**: all specs live in this repo. Features implemented in `lib/pkp`
  (shared with OMP/OPS) carry `shared: pkp-lib` frontmatter; OJS-only features carry
  `shared: no`. A future extraction to pkp-lib can filter on that.

## Definition of done

- **Per spec**: every TEMPLATE section filled or explicitly N/A; every rule anchored;
  verifier findings resolved (fixed or recorded as Open questions); atoms claimed in
  the sweep files.
- **Campaign**: unclaimed atom count = 0 (claimed, parked-with-reason, or
  out-of-scope-with-reason); every INVENTORY row `verified`.
- "Recreatable from the spec" is the aspiration that sets the altitude; the checkable
  acceptance bar is the two lines above.

## Wave prompt (re-runnable)

> Read docs/product/CHARTER.md and docs/product/INVENTORY.md. Pick the next unclaimed
> atom cluster (~1–3 features by user intent). For each: write
> docs/product/specs/<feature>.md per TEMPLATE.md — business-level rules sufficient to
> reimplement, canonical scenarios included, every claim carrying a code anchor; where
> the code is ambiguous, probe the live test env instead of guessing; where behavior
> looks unintended, flag ⚠ and cross-link docs/e2e/app-changes.md. Claim the covered
> atoms in the atlas sweep files (one owner per atom); push poor fits onto
> UNASSIGNED.md — never force-fit. Then run an adversarial verifier per spec (must
> attempt to refute the permission rules and state rules specifically, and check the
> atlas for uncovered atoms hinting at this feature). Resolve findings, update
> INVENTORY.md, commit. Every third wave: grooming pass on UNASSIGNED.md + a
> completeness critic over the atlas (any modality not swept? any sweep gap left?).

## Operating rules

- State lives in these files, not in conversation — any session can resume from disk.
- Sweeps and grooming use fast models; spec authorship and verification use strong
  models. Sweep agents never analyze; spec agents never enumerate.
- Docs-only commits per wave (this campaign touches no application code; new bug
  findings go to the e2e ledger, not to code).
- **Live-probe etiquette** (inherited from `docs/e2e/PRINCIPLES.md`): scratch journals
  via the scenario endpoints for anything mutating; `publicknowledge` and the 16
  seeded users are read-only; never `clearAll()` Mailpit; test key
  `X-Test-Key: playwright-test-key` against servers on ports 8000+ (env facts in
  `.claude/skills/ojs-playwright-tests/`).
- Cross-links: e2e plans (`docs/e2e/plans/`) are the *test-side* view of a feature and
  often name the same feature — specs cite them, but the spec is about the product,
  not the tests.
