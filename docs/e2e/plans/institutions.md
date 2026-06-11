# Institutions

- **Area:** 6. Settings & administration
- **Placement:** lib/pkp
- **Budget:** 2 tests
- **Absorbs:** none
- **Scenario needs:** scratch journal via `POST /api/v1/_test/scenarios/journal`. Institutions are created through the UI (list-panel CRUD is the behavior under test; no Processor capability warranted for a 2-row feature).
- **Round 2 / out of scope:**
  - Institution-resolved usage statistics (site-level `enableInstitutionUsageStats`, log attribution) — round-2 stats-pipeline backlog.
  - Institutional-subscription linkage (institution select on subscription forms, IP-range access grants) — owned by `subscriptions-management` / `subscription-access`.
  - Institutions nav-link visibility toggling via the Distribution > Statistics / Payments forms — the page is asserted via direct URL here; nav gating is exercised in `distribution-settings` row 4.
  - ROR autocomplete/external lookup behavior beyond storing the value.

## Tests

| # | Title | Actors | Seed | Verifies | Status |
|---|-------|--------|------|----------|--------|
| 1 | Create and edit an institution | dbarnes | scenario: scratch journal | `management/settings/institutions`: add an institution with multilingual name, IP ranges and ROR id → appears in the list panel; reopen → values round-tripped; edit the name and an IP range → updated row persists after reload. | planned |
| 2 | Delete an institution | dbarnes | scenario: scratch journal | Create a second institution via UI, delete it from the list panel with confirm → removed from the list and stays gone after reload; the remaining institution is untouched. | planned |
