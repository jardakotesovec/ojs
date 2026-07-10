# Spec template

Copy this file to `specs/<feature>.md` and fill every section (or mark it `N/A —
<reason>`). HTML comments are guidance — delete them in the real spec.

**These specs are read by a PRODUCT OWNER / QA person, not an engineer.** The reference
exemplar is `specs/tasks-discussions.md` (the maintainer-calibrated gold standard) —
read it before writing, and match its voice. The non-negotiable rules, enforced in
every section and checked mechanically by `docs/product/lint-spec.sh` (a spec must
pass with ZERO findings before it proceeds to test authoring — the exemplar passes):

1. **Business-language bodies, code in footnotes.** No section BODY (Purpose, Actors,
   Fields, Rules & state, Side effects, Scenarios) may contain a class/method name, a
   REST route or endpoint, a Vue component/composable, a DB table/column, a constant
   (`SUBMISSION_FILE_*`), or an HTTP status code. Describe only what a user OBSERVES or
   DOES. Every code symbol is PROVENANCE and lives ONLY in a `<sup>x</sup>` footnote on
   the rule/row + the `## Reference — code anchors` block. (Known deviations, Open
   questions and the Reference blocks may keep technical detail — that's where
   developers look.) Anchor to a STABLE SYMBOL (`ClassName::method()`, a constant, a
   route path, a form field, a Vue function) — never a line number.
2. **Concrete role names, never umbrellas.** Anywhere you name who-can-do-something,
   use the actual OJS roles by name: **Site Administrator, Journal Manager, Section
   Editor** (a.k.a. sub-editor), **Assistant, Author, Reviewer, Reader.** NEVER write
   "editorial staff", "editorial roles", "editors", "editorial roles with X access", or
   "the full manager". If several roles qualify, LIST them; if it's assignment-based,
   say so ("a Section Editor or Assistant assigned to this submission's production
   stage"); if scope-based, say it ("Site Administrator" vs "Journal Manager"). Use the
   same canonical name for a role everywhere in the spec.
3. **One home for permissions.** Actors & permissions is the SINGLE source of who-may.
   Rules & state is about behavior and state — it must NOT restate the permission
   matrix. Where a rule is permission-adjacent, describe the STATE/behavior and defer
   the who to Actors (don't re-enumerate roles). A ⚠ permission *deviation* (e.g. a
   screen-vs-server divergence) may live in Rules/Known-deviations as a behavior anomaly
   but references roles minimally, not a full re-listing.
4. **Probe evidence is provenance, exactly like code anchors.** Verification facts —
   HTTP status codes, redirect targets, "live-probed …" notes and dates, seeded
   usernames (`atester`, `dbarnes`, …) and the seeded journal — prove a claim; they are
   not the claim. They live ONLY in the `<sup>` footnotes, alongside the code anchors.
   The body states the observable outcome in the user's terms. The one real example
   that defines the line (from the maintainer's red pen):
   - **Bad**: "`/authorDashboard/submission/{id}` redirects to My Submissions with that
     submission's tracking view open (live-probed 302, both author kinds)"
   - **Good**: "An old bookmarked author-dashboard link lands on My Submissions with
     that submission's tracking view open. <sup>g</sup>" — with the footnote carrying
     `<sup>g</sup> /authorDashboard/submission/{id} → 302; PKPAuthorDashboardHandler::submission();
     live-probed 2026-07-03 (submitter + assigned co-author)`.
   The RUNBOOK still requires every affordance claim to be live-probed — this rule is
   only about WHERE the evidence goes, never whether to collect it.

---

```markdown
---
name: <feature-slug>
scope: <one-line: the user job this feature serves>
shared: pkp-lib | no        # implemented in lib/pkp (OMP/OPS share it) or OJS-only
status: draft | verified    # verified = adversarial pass findings resolved
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
     actor(s) then their condition, e.g. "• Managers — any time".

     ANCHORS AS FOOTNOTES, not a column: the table is a PO/QA-facing summary, and the
     detailed rules are re-anchored in Rules & state anyway — so keep the table TWO
     columns and hang the anchors off a `<sup>a</sup>` marker at the end of each "Who
     may" cell, collected in a de-emphasized `<sup>a</sup> Class::method() · ...` block
     directly below the table. Keeps provenance available but out of the reading flow.
     (Docs stay Markdown — inline HTML like <sup>/<br> is used surgically only where a
     structure needs it; do not convert specs to full HTML.) -->

| Action | Who may — and when |
|--------|--------------------|
| **<Action>** | • <actor(s)> — <condition><br>• <actor(s)> — <condition; ⚠ inline for oddities> <sup>a</sup> |

<sup>a</sup> Class::method(); OtherClass::method()

## Fields & validation

<!-- FRONTEND-FIRST: describe the fields the user actually sees in the UI form, by
     their on-screen LABEL (Name, Due date, Assignee...), not the internal API/DB
     attribute names (type, dateDue, isResponsible, temporaryFileIds, assocType,
     createdBy...). State validation in plain terms (required?, limits, task-vs-
     discussion differences, multilingual?). DROP purely server-set fields
     (createdBy/assocType/assocId/stageId and the like) — they're invisible to the
     user; if one matters, mention it in a sentence, don't table it.

     ANCHORS AS FOOTNOTES, NOT A COLUMN (same as Actors and the gold standard): keep the
     table THREE columns and hang the internal attribute name / validator off a
     `<sup>x</sup>` marker at the end of each row's Rules cell, collected in a
     de-emphasized `<sup>x</sup> attribute; Validator::rule()` block directly below the
     table. Do NOT add an "Anchor" column. -->

| Field (UI label) | Required? | Rules |
|------------------|-----------|-------|

## Rules & state

<!-- The heart. State machine (states, transitions, who triggers, guards),
     invariants, computed behavior, ordering/timing rules. Numbered rules,
     each with a `<sup>` footnote anchor (NOT an inline parenthetical code list).
     ⚠-flag as-built oddities with a ledger link.

     DO NOT RESTATE PERMISSIONS HERE. Who-may-do-what lives once, in Actors &
     permissions. A rule that just re-lists which roles can do X is redundant — cut it.
     When a rule's behavior depends on a role, name the STATE/behavior and defer the who
     to Actors (e.g. "On a published article, media stays editable for anyone with
     production-stage management access" — not a re-enumeration of Site Administrator /
     Journal Manager / Section Editor / Assistant). Use concrete role names (never
     "editorial staff / roles / editors") on the rare occasion a role must be named.

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

<!-- Narrative user journeys a QA person would recognize, named. These are the
     units the test build maps onto — one retained test per scenario, so the count
     comes from the feature's Budget column in PROGRESS.md (L 3–4, M 6–8, H up to
     ~12–13). Cover the core journey, the main permission boundary, and the main
     state-rule variation at minimum.

     NAME ACTORS BY ROLE, never by seeded account: "an author", "a Journal Manager",
     "a Section Editor assigned to the submission" — the scenario describes the
     PRODUCT, not the test environment, and a QA person must be able to act it out on
     any install. Seeded usernames (atester, dbarnes…), the seeded journal
     (publicknowledge) and seeding recipes are test-authoring detail: if the test
     author needs them, hang them off a <sup> footnote on the scenario. -->

<!-- example: 1. **<Scenario name>** — an author: <flow in 2–4 sentences, including
     the observable outcome>. <sup>s1</sup> -->

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
