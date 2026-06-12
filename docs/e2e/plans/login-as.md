# Login-as (impersonation)

- **Area:** 5. Users, roles & access
- **Placement:** lib/pkp
- **Budget:** 2 tests
- **Absorbs:** lib/pkp/playwright/tests/login-as.spec.js
- **Scenario needs:** journal scenario `users[]` (row 2 — scratch journal so impersonation targets are throwaway; impersonating a shared seeded user would invalidate that user's cached auth state for parallel tests). Row 1 impersonates dbarnes via the canonical URL but the existing spec's auth probe (`ensureAuthStateFor`) already tolerates the session migration — kept on refit. Row 2 goes further: the impersonating MANAGER is a throwaway too (created via `users[]` + `password`, logged in through a fresh context with the LoginPage POM, not `asUser`), so `signInAs`/`signOutAs` only ever migrate a session no other worker or `.auth/` cache shares. The site admin lends his row to the gating assertion via a scratch-journal `users[]` role (`{username: 'admin', roles: ['author']}`) — he is never impersonated.
- **Round 2 / out of scope:**
  - Login-as from the stage-participants grid (legacy submission-scoped affordance; `stage-participants` territory if revived).
  - Impersonation interaction with API keys / REST sessions.

## Tests

| # | Title | Actors | Seed | Verifies | Status |
|---|-------|--------|------|----------|--------|
| 1 | Site admin impersonates a user and returns to their own session | admin | none (publicknowledge, read-only) | `signInAsUser/{id}` switches `pkp.currentUser` to the target with `isUserLoggedInAs` + preserved admin identity in `loggedInAsUser`; `signOutAsUser` restores the admin session | implemented (lib/pkp/playwright/tests/login-as.spec.js) |
| 2 | Manager impersonates from the Users list; affordance is permission-gated | throwaway manager (scratch); throwaway reviewer | scenario: journal `users[]` (incl. an admin-roled row) | "Login As" row action opens the confirm dialog ("Log in as this user?…"); OK lands in the target's session — `pkp.currentUser` flips to the reviewer with `isUserLoggedInAs` + `loggedInAsUser` carrying the manager, and the user-nav dropdown shows "You are currently logged in as {target}"; the "Logout as {target}" link restores the manager's session; the action is absent on the manager's own row and on the site-admin row (`canLoginAs` gating — Edit stays visible as the menu-open control) | implemented (lib/pkp/playwright/tests/login-as.spec.js) |
