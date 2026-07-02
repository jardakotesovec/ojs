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

<!-- Table: role → what they can do / see. Include anonymous where relevant.
     This is the section verifiers attack first — anchor every cell. -->

| Actor | Can | Cannot | Anchor |
|-------|-----|--------|--------|

## Entry points

<!-- Where the feature is reached: UI paths (menu → page → panel), API endpoints,
     CLI tools, links in emails. One row per entry point, with atlas atom ID. -->

| Entry | Path | Atom |
|-------|------|------|

## Fields & validation

<!-- Per form/object: field, type, required?, validation rules, default,
     multilingual?, who can edit. -->

## Rules & state

<!-- The heart. State machine (states, transitions, who triggers, guards),
     invariants, computed behavior, ordering/timing rules. Numbered rules,
     each with an anchor. ⚠-flag as-built oddities with a ledger link. -->

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

## Code anchors

<!-- The load-bearing files for this feature (handler/controller/manager/schema),
     so a reader can go deeper. Not exhaustive. -->

## Open questions

<!-- Anything the author or verifier could not determine from code or live probe.
     Each item phrased so the maintainer can answer with one sentence. -->
```
