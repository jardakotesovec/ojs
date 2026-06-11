# Editorial masthead

- **Area:** 5. Users, roles & access
- **Placement:** lib/pkp
- **Budget:** 2 tests
- **Absorbs:** lib/pkp/playwright/tests/editorial-masthead.spec.js (sole owner — `public-pages` released its duplicate claim)
- **Scenario needs:** the masthead page (`AboutContextHandler::editorialMasthead`) renders role sections for `masthead`-flagged user groups listing assignments with a per-user masthead opt-in (`user_user_groups.masthead`). `UserAssignmentProcessor` calls `assignUserToGroup(..., masthead: null)`, so no scenario-seeded assignment (bootstrap included) ever appears on the masthead — adjudicated UI-FALLBACK: row 2 reaches the opted-in assignment via the invitation accept round-trip in-test; one row doesn't justify a schema shape change (principle 3). No gaps.
- **Round 2 / out of scope:**
  - Peer Reviewers block (external reviewers whose reviews completed in the **previous calendar year**, `whereYear(date_completed) = Y-1`) — a previous-year `dateCompleted` on an assignment created today is a state no real flow produces; seeding it with parity would require backdating the whole date chain (assigned/notified/responded/completed). Deferred until a time-travel hook exists.
  - Editorial History public page (ended assignments).
  - ORCID icons next to masthead names (covered by `orcid` plan surface checks).
  - Masthead role *ordering* configuration.

## Tests

| # | Title | Actors | Seed | Verifies | Status |
|---|-------|--------|------|----------|--------|
| 1 | Masthead page renders for anonymous readers | anonymous | none (publicknowledge, read-only) | `/about/editorialMasthead` returns 200 with the page heading for an anonymous visitor | implemented (lib/pkp/playwright/tests/editorial-masthead.spec.js) |
| 2 | Masthead reflects role flags and per-user opt-ins | anonymous (assert); dbarnes (manager, setup) | scenario: journal `users[]` + UI (invitation accept round-trip for the opted-in assignment) | Opted-in user appears under their role section with the start year; a user in the same role without the opt-in is absent; a role with the `masthead` flag off never renders a section | planned |
