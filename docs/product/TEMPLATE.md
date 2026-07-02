# Spec template

Copy this file to `specs/<feature>.md` and fill every section (or mark it `N/A —
<reason>`). Keep the body in business language; code anchors (`file:line`) are
provenance footnotes on rules, not the content. HTML comments are guidance — delete
them in the real spec.

---

```markdown
---
name: <feature-slug>
scope: <one-line: the user job this feature serves>
shared: pkp-lib | no        # implemented in lib/pkp (OMP/OPS share it) or OJS-only
status: draft | verified    # verified = adversarial pass findings resolved
e2e-plans: [<docs/e2e/plans/*.md basenames that test this feature>]
atlas-claims: [<atom IDs this spec owns>]
---

# <Feature name>

## Purpose

<!-- One paragraph. Whose job, what job, why it exists. A new PM should get it. -->

## Actors & permissions

<!-- ORGANISE BY ACTION, not by role: a table with one ROW PER CAPABILITY (View,
     Create, Reply, Edit metadata, Edit description, Close, Delete, ...). This lets a
     reader compare a single capability across all roles in one row — a role-centric
     table buries cross-cutting rules (e.g. a one-hour edit window) inside individual
     cells. Columns: Action | Who may — and when | Anchors.

     The "Who may — and when" cell is PLAIN PRODUCT LANGUAGE a product owner or QA
     person reads without a developer. Describe OUTCOMES ("only a participant may
     reply"), never mechanism: no HTTP status codes (401/403/422/404/500), no
     route/method names, no class or variable names (canPublish, allowRecommendOnly,
     changeVersion...), no "enforced by X / dead code / unreachable" commentary. All
     mechanism goes to Rules & state (with anchors) and Known deviations. The Anchors
     cell is provenance only.

     FRONTEND-FIRST: describe what the role sees and can do IN THE UI. Verify the
     backend rule (source of truth) against the frontend logic and state the UI
     reality. If an ability exists only by hand-crafting an API call with no UI
     affordance, do not list it as a plain capability — mark it ⚠ "API-only, no UI
     control" and defer detail to Known deviations (see the versioning publish-authority
     row for the pattern).

     Lead with a short paragraph BEFORE the table defining the recurring terms
     (assigned, participant, creator, responsible...) and the site-wide baselines that
     apply to every row (site admin, anonymous, recommend-only), so cells stay terse.
     Where a rule is a bug or as-built oddity, put a bare ⚠ inline with a one-clause
     "why it matters" and defer the mechanism + ledger link to Known deviations. This
     is the section verifiers attack first — anchor every row.

     In the "Who may — and when" cell, write a LIST of items (one per role-group or
     condition), not a semicolon-chained sentence — use `<br>• ` between items so the
     cell renders as a bulleted list and still reads in raw form. Each bullet: the
     actor(s) then their condition, e.g. "• Managers — any time". -->

| Action | Who may — and when | Anchors |
|--------|--------------------|---------|
| **<Action>** | • <actor(s)> — <condition><br>• <actor(s)> — <condition; ⚠ inline for oddities> | file:line |

## Fields & validation

<!-- FRONTEND-FIRST: describe the fields the user actually sees in the UI form, by
     their on-screen LABEL (Name, Due date, Assignee...), not the internal API/DB
     attribute names (type, dateDue, isResponsible, temporaryFileIds, assocType,
     createdBy...). State validation in plain terms (required?, limits, task-vs-
     discussion differences, multilingual?). DROP purely server-set fields
     (createdBy/assocType/assocId/stageId and the like) — they're invisible to the
     user; if one matters, mention it in a sentence, don't table it. Put the internal
     attribute name in the Anchor column only, as provenance. Columns:
     Field (UI label) | Required? | Rules | Anchor. -->

| Field (UI label) | Required? | Rules | Anchor |
|------------------|-----------|-------|--------|

## Rules & state

<!-- The heart. State machine (states, transitions, who triggers, guards),
     invariants, computed behavior, ordering/timing rules. Numbered rules,
     each with an anchor. ⚠-flag as-built oddities with a ledger link.

     Even here — the most technical PO-facing section — name states and fields as the
     UI shows them ("Yet to begin", "In progress", "Closed"), not by their internal
     column/attribute ("dateStarted", "dateClosed", "status"). Describe WHAT happens
     and WHAT the user sees; the internal field that implements it goes in the anchor
     (e.g. "...computed from whether it was started/closed (TaskResource.php:151 — from
     dateStarted/dateClosed)"). Reserve an inline internal name only when it is the
     single clearest way to state a constraint, which is rare. -->

## Side effects

<!-- Emails sent (mailable, recipients, opt-outs), notifications (type, level,
     where surfaced), event-log entries, jobs queued, cross-entity mutations. -->

## Settings that modify behavior

<!-- Site/journal settings, config.inc.php vars, plugin toggles that change the
     rules above — and HOW they change them. -->

## Cross-feature interactions

<!-- Other specs this one touches; who owns the shared rule. Keep pointers, not
     duplicated rules. -->

## Canonical scenarios

<!-- 3–6 narrative user journeys a QA person would recognize, named. These are the
     units the round-2 test crosswalk maps onto. Cover the core journey, the main
     permission boundary, and the main state-rule variation at minimum. -->

1. **<Scenario name>** — <actor(s)>: <flow in 2–4 sentences, including the
   observable outcome>.

## Known deviations (as-built ≠ intent)

<!-- Every ⚠ rule from above, with docs/e2e/app-changes.md row link and one line on
     the suspected intent. New findings: propose a ledger row. -->

## Open questions

<!-- Anything the author or verifier could not determine from code or live probe.
     Each item phrased so the maintainer can answer with one sentence. -->

---

<!-- REFERENCE MATERIAL below this line — provenance and campaign bookkeeping, NOT
     product-owner narrative. A PO/QA reads the sections above; the sections below are
     for developers and for the atlas coverage crosswalk. -->

## Reference — entry points & surfaces

<!-- Where the feature is reached, as technical reference: UI paths (menu → page →
     panel), API endpoints, CLI tools, links in emails. One row per entry point, with
     its atlas atom ID (this is how the feature claims its atoms). The PO-facing "where
     do I find this" belongs in Purpose, not here. -->

| Entry | Path | Atom |
|-------|------|------|

## Reference — code anchors

<!-- The load-bearing files for this feature (handler/controller/manager/schema),
     so a reader can go deeper. Not exhaustive. -->
```
