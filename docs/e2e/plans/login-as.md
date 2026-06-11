# Login-as (impersonation)

- **Area:** 5. Users, roles & access
- **Placement:** lib/pkp
- **Budget:** 2 tests
- **Absorbs:** lib/pkp/playwright/tests/login-as.spec.js
- **Scenario needs:** journal scenario `users[]` (row 2 — scratch journal so impersonation targets are throwaway; impersonating a shared seeded user would invalidate that user's cached auth state for parallel tests). Row 1 impersonates dbarnes via the canonical URL but the existing spec's auth probe (`ensureAuthStateFor`) already tolerates the session migration — keep that behavior when refitting.
- **Round 2 / out of scope:**
  - Login-as from the stage-participants grid (legacy submission-scoped affordance; `stage-participants` territory if revived).
  - Impersonation interaction with API keys / REST sessions.

## Tests

| # | Title | Actors | Seed | Verifies | Status |
|---|-------|--------|------|----------|--------|
| 1 | Site admin impersonates a user and returns to their own session | admin | none (publicknowledge, read-only) | `signInAsUser/{id}` switches `pkp.currentUser` to the target with `isUserLoggedInAs` + preserved admin identity in `loggedInAsUser`; `signOutAsUser` restores the admin session | implemented (lib/pkp/playwright/tests/login-as.spec.js) |
| 2 | Manager impersonates from the Users list; affordance is permission-gated | dbarnes (manager on scratch); throwaway reviewer | scenario: journal `users[]` (incl. an admin-roled row) | "Login As" row action opens the confirm dialog and lands in the target's session ("Logged in as" indicator in the user nav); "Log Out As" returns to the manager; the action is absent on the manager's own row and on rows where `canLoginAs` is false (site admin target) | planned |
