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
| 1 | Login-wall journal: anonymous readers are forced through login | anonymous; throwaway user | scenario: journal `users[]` + UI (Site Access form: `restrictSiteAccess` on) | With `restrictSiteAccess` on, homepage/about/issue URLs redirect anonymous visitors to login; `/login` and `/user/register` remain reachable (policy exemptions); after login the same pages render | implemented (lib/pkp/playwright/tests/site-access-restrictions.spec.js) |
| 2 | Registration disabled: register surfaces close | anonymous | scenario: journal + UI (Site Access form: `disableUserReg` on) | `/user/register` renders the registration-disabled error with a Login backlink (no form); the Register nav item is hidden on the journal front end | implemented (lib/pkp/playwright/tests/site-access-restrictions.spec.js) |
| 3 | Article access restriction: galleys require login (OJS) | anonymous; throwaway user | scenario: journal `users[]` + `issues[]` + UI (Site Access form: `restrictArticleAccess` on) + submission scenario (published, seeded remote galley via `publications[].galleys[].urlRemote` pointed at a local page — the add-galley UI is already covered by galleys.spec.js, and a local target keeps the redirect assertion network-independent) | Anonymous reader sees the article landing/abstract but galley view redirects to login (with `?source=` round-trip); a logged-in throwaway reader opens the galley (remote-galley redirect lands on the target) | implemented (playwright/tests/article-access-restriction.spec.js) |
| 4 | Disabled journal is hidden from the public but reachable by admins | admin; anonymous | scenario: journal + UI (admin unchecks `enabled` in the contexts-grid Edit modal; re-enables via the Settings Wizard form — same FORM_CONTEXT, both admin surfaces) | Disabled scratch journal's front end redirects anonymous visitors to its login page (PKPPageRouter::route) and the journal is absent from the site index journal list; site admin still reaches its front end and Settings Wizard; re-enabling restores public access + the index listing | implemented (lib/pkp/playwright/tests/site-access-restrictions.spec.js) |

Implementation notes (wave 9):
- Rows 1–3 drive the Site Access form through a new shared POM
  `lib/pkp/playwright/pages/SiteAccessSettingsPage.js` (tab activation,
  checkbox/radio helpers, save-with-contexts-PUT wait).
- Row 1's "issue URLs" probe uses OJS `issue/archive`; the
  RestrictedSiteAccessPolicy applies before handler dispatch, so OMP/OPS
  adopters of the shared spec swap in their own catalog path (probe list
  is data in the test).
- Row 4 disable-arm reality check: a disabled journal **redirects to its
  login page** for anonymous visitors (no 404) — asserted accordingly.
