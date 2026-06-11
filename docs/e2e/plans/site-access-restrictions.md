# Site access restrictions

- **Area:** 5. Users, roles & access
- **Placement:** lib/pkp (row 3 is OJS-only — `restrictArticleAccess` lives in OJS `UserAccessForm` / `ArticleHandler`; its spec lands in `playwright/tests/`)
- **Budget:** 4 tests
- **Absorbs:** none (legacy `cypress/tests/integration/MultipleContexts.cy.js` covers the disable-journal arm for the final cross-check)
- **Scenario needs:** all three toggles are journal-level context settings on `PKPUserAccessForm`/`UserAccessForm` (verified: `restrictSiteAccess`, `disableUserReg`, `restrictArticleAccess`), so scratch journals suffice — `publicknowledge` is never touched. The context scenario schema (`lib/pkp/classes/testing/scenario/schema/context.json`, `additionalProperties: false`) does **not** pass them through, and stays that way (adjudicated UI-FALLBACK): each toggle serves exactly one row, and a single visit to the Users & Roles > Site Access form reaches the state — below the Processor-extension bar (principle 3: extend only when multiple rows need the same state). Rows 1–3 toggle via that form in-test. Journal disable (row 4) is a site-admin `enabled` flag on the hosted-journal form — one-off → UI. No gaps.
- **Round 2 / out of scope:**
  - Site-wide login wall across multiple journals (per-journal coverage is representative; multi-context interplay belongs to `site-administration`).
  - `restrictSiteAccess` exemption list beyond login/register (help, payment, invitation pages — asserted incidentally where cheap, not exhaustively).
  - Subscription-based access control (covered by `subscription-access`).

## Tests

| # | Title | Actors | Seed | Verifies | Status |
|---|-------|--------|------|----------|--------|
| 1 | Login-wall journal: anonymous readers are forced through login | anonymous; throwaway user | scenario: journal `users[]` + UI (Site Access form: `restrictSiteAccess` on) | With `restrictSiteAccess` on, homepage/about/issue URLs redirect anonymous visitors to login; `/login` and `/user/register` remain reachable (policy exemptions); after login the same pages render | planned |
| 2 | Registration disabled: register surfaces close | anonymous | scenario: journal + UI (Site Access form: `disableUserReg` on) | `/user/register` renders the registration-disabled error with a Login backlink (no form); the Register nav item is hidden on the journal front end | planned |
| 3 | Article access restriction: galleys require login (OJS) | anonymous; throwaway user | scenario: journal `users[]` + UI (Site Access form: `restrictArticleAccess` on) + submission scenario (published) + UI (remote galley) | Anonymous reader sees the article landing/abstract but galley view redirects to login; a logged-in user opens the galley | planned |
| 4 | Disabled journal is hidden from the public but reachable by admins | admin; anonymous | scenario: journal + UI (admin unchecks `enabled` on the hosted-journal form) | Disabled scratch journal's front end is unavailable to anonymous visitors (404/redirect) and absent from the site journal list; site admin still reaches its settings/dashboard; re-enabling restores public access | planned |
