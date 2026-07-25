# OJS Product Specification Campaign — Charter

The contract for this campaign: **why** it exists, **what** is in scope, and the
invariants every wave must hold. **How** to run an iteration lives in `RUNBOOK.md`;
**how** to write a spec lives in `TEMPLATE.md`; **how** to write tests lives in
`docs/e2e/PRINCIPLES.md`; live state lives in `PROGRESS.md`. Started 2026-07-02;
the current mode always lives in `PROGRESS.md`'s banner.

## Mission

Document every OJS feature at the **business-logic level** — actors, fields, rules,
state, permissions, side effects — precisely enough that the feature could be
reimplemented from the spec alone, in language a product owner or QA person reads
without a developer. Audience: QA, developers, AI agents, and the test suite built
from each spec's canonical scenarios.

## Scope

**OJS only.** In scope: any feature reachable in OJS, including the large share
implemented in shared `lib/pkp` (flagged `shared: pkp-lib` in frontmatter for a future
extraction; OMP/OPS behaviour is not documented). Out of scope and dropped, not
parked: OMP/OPS-specific surfaces OJS never exposes (monographs, chapters, publication
formats, the catalog, `NOTIFICATION_TYPE_BOOK_*`, `*_INTERNAL` review-stage decisions,
OMP/OPS-only Vue managers unwired in `WorkflowPageOJS`).

**Format: Markdown, not HTML.** Specs are reviewed raw and in diffs; inline HTML only
where a structure needs it (`<br>` in cells, `<sup>` footnotes, rare `<details>`).

## Method

Enumerate mechanically first, then document, then map coverage — "did we miss a
feature?" must be a grep, not a judgment call (round 1's single exploration pass
demonstrably missed features):

1. **Phase 0 — surface atlas** (`atlas/*.md`, DONE): 14 mechanical sweeps
   (affordances added 2026-07-25), one per modality, emitting **atoms** (stable ID +
   code pointer + one line). Completeness over depth; no analysis in sweeps.
2. **Phase 1 — feature specs** (`specs/*.md`): written per `TEMPLATE.md` to the
   RUNBOOK loop, adversarially verified, claiming their atoms.
3. **Phase 2 — coverage crosswalk**: every spec scenario mapped against the test
   suite → covered / gap / unit-test-territory / accept-untested.

## Invariants

- **Atom claim invariant**: every atlas atom ends up claimed by exactly one spec, OR
  parked in `UNASSIGNED.md`, OR marked out-of-scope in its sweep file with a reason.
  The unclaimed count is the campaign's completeness metric.
- **Never force-fit**: a wrong grouping is worse than a deferred one — push poor fits
  onto `UNASSIGNED.md`. Group by **user intent** ("what would a journal manager call
  this?"), never by code-module boundaries. Litmus: would a QA person test these rules
  together?
- **As-built AND intent**: specs document what the code actually does. Behaviour that
  is internally inconsistent, loses data, contradicts a UI affordance, or would
  genuinely surprise a product owner gets a ⚠ + a `docs/e2e/app-changes.md` ledger row
  (non-blocking — the maintainer reviews the accumulated ledger, not per wave). A rule
  that is merely strict is usually intended: write it as a plain rule plus an Open
  question, never assert a suspected intent the code doesn't prove. A spec that
  silently transcribes bugs as requirements is poison for QA.
- **Verified, not just written**: every spec passes an adversarial verification pass
  (refute the permission and state rules; attack liveness) and a readability pass
  (RUNBOOK). Ambiguous rules are probed **live** on the test environment, never
  guessed from code.
- **Liveness before documentation**: code existing is not evidence the feature exists
  — OJS carries superseded, unreachable surfaces. Establish a surface is reachable in
  the current UI before documenting it; record unreachable atoms as dead-code
  candidates in `UNASSIGNED.md` (a campaign deliverable). Where a legacy path and a
  Vue path are both live for the same job, document both and say which is primary.
- **Frontend-first, backend-verified**: the reader interacts with the UI, so lead
  with what each role sees and can do on screen; use backend policies/validation as
  the source of truth for rules and cross-check the two. Where they diverge, the UI
  reality is the headline and the divergence is a ⚠. An ability reachable only by
  hand-crafting an API call is "API-only", never a normal user capability.
- **Business language, one statement per fact**: the spec body reads as a functional
  spec for PO/QA; every code symbol, probe result and seeded account lives in `<sup>`
  footnotes and the Reference blocks. The four non-negotiable style rules, the anchor
  format (stable symbols, never line numbers) and the mechanical lint gate are defined
  in `TEMPLATE.md` — the single home for spec style.

## Standing maintainer rulings (2026-07-25)

Committed home for the rulings from the Opus 5 eval review. A queued re-scope +
encoding session (see `QUEUE.md`) integrates them fully into TEMPLATE and sweeps
the existing corpus; until then they bind as written:

- **Variance-based ownership**: behavior that is invariant across contexts is
  specified ONCE, in the mechanism's home feature; context features own the
  deltas — presence, configuration, permissions, consequences — and point to the
  home for mechanics (both directions verifiable). Litmus per sentence: "if I
  changed stage/role/surface, would this still be true?" Named special cases:
  - **Manager components**: reusable managers (file manager, participant
    manager, tasks & discussions, …) get their mechanics specified once in the
    manager's own feature; stage features own each instantiation — which panels
    mount, which actions/columns appear, and the role × state gates on that
    stage. Affordance-atom attribution follows the same split.
  - **Test budget corollary**: mechanics are deep-tested once in the home
    feature; context features test only gates/instantiation (duplicate
    mechanism coverage is a reviewable defect).
- **One shared workflow screen, author included** (refined 2026-07-25 — this
  wording supersedes any surviving "dual-dressing" phrasing): the dashboards
  are separate features (the editorial dashboard and My Submissions each own
  their list), but the workflow screen both open is ONE shared surface.
  Workflow-page specs cover EVERY role on it — the Author included — in the
  same permission rows: role determines what is available; it never creates a
  separate surface. Never split a stage into editor-view and author-view
  features, and never frame the author's access as its own reduced screen.
  The author's entry route (View on My Submissions) belongs to
  `author-dashboard`; everything after it belongs to the workflow features.
- **Glossary**: a living `docs/product/GLOSSARY.md` keeps PO/QA language
  consistent — on-screen names always win; a term may be coined only when the
  screen offers none; every coined term has ONE definition home (the glossary)
  and first use per spec carries a gloss or pointer. Applies to test naming too.

## Definition of done

- **Per spec**: the operational checklist is `RUNBOOK.md`'s Definition of done
  (single home).
- **Campaign**: unclaimed atom count = 0 (claimed / parked-with-reason /
  out-of-scope-with-reason); every PROGRESS row `done` or `parked`.
- "Recreatable from the spec" sets the altitude; the two lines above are the
  checkable bar.

## Operating rules

- State lives in these files, not in conversation — any session resumes from disk.
- Docs-only commits per wave: the campaign touches no application code; new bug
  findings go to the `docs/e2e/app-changes.md` ledger.
- **Live-probe etiquette**: scratch journals via the scenario endpoints for anything
  mutating; `publicknowledge` and the seeded users are read-only; never `clearAll()`
  Mailpit; test key `X-Test-Key: playwright-test-key` against servers on ports 8000+
  (env facts in `.claude/skills/ojs-playwright-tests/`).
