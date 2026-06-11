# Registration & login

- **Area:** 5. Users, roles & access
- **Placement:** lib/pkp
- **Budget:** 8 tests
- **Absorbs:** lib/pkp/playwright/tests/user-registration.spec.js; lib/pkp/playwright/tests/login.spec.js
- **Scenario needs:** journal scenario `users[]` (throwaway login users with `password`; never the 16 shared seeded users — their cached auth state must not be invalidated). Registration itself is the behavior under test, so it is driven via UI on `publicknowledge` (INSERT-only, parallel-safe with unique-tag usernames).
- **Round 2 / out of scope:**
  - Captcha / SSL / rate-limiting login variants (deferred in inventory).
  - `email.require_validation` mode (config-driven; requires server restart).
  - ORCID registration prefill (covered by the `orcid` plan).
  - Reviewer self-registration *toggle* effect (covered by `roles-permissions` row 4); here we only exercise the default-on opt-in.

## Tests

| # | Title | Actors | Seed | Verifies | Status |
|---|-------|--------|------|----------|--------|
| 1 | Anonymous visitor registers, is auto-logged-in, and can start a submission | anonymous → new user | UI (publicknowledge, unique-tag username) | Registration form (identity, login, country, privacy consent) submits; "Registration complete" page; "Make a New Submission" lands in wizard Start step | implemented (lib/pkp/playwright/tests/user-registration.spec.js) |
| 2 | Registration with reviewer opt-in records the reviewer role and interests | anonymous → new user | UI (publicknowledge) | Reviewer self-registration checkbox + interests field on `/user/register`; after registering, profile Roles tab lists Reviewer and the entered reviewing interests | planned |
| 3 | Registration validation rejects duplicates and incomplete input | anonymous | UI (publicknowledge; duplicate check read-only against a seeded username) | Duplicate username/email, password mismatch, missing required fields, missing privacy consent each produce field errors; entered values are retained; no account created | planned |
| 4 | Login lands on the role-appropriate dashboard; logout invalidates the session | throwaway author + throwaway reviewer | scenario: journal `users[]` (scratch journal) | Author login → `dashboard/mySubmissions`; reviewer-only login → `dashboard/reviewAssignments`; logout via user menu returns to public site; revisiting dashboard redirects to `/login` | planned |
| 5 | Failed login shows an error and a correct retry succeeds | throwaway user | scenario: journal `users[]` | Wrong password and unknown username show the login error without creating a session; subsequent correct credentials log in normally | planned |
| 6 | Authenticated session persists across visits (no `/login` bounce on site root) | admin | none (bootstrap auth state) | Cached session cookie is accepted by the server; site root renders without redirect to `/login` | implemented (lib/pkp/playwright/tests/login.spec.js) |
| 7 | Anonymous request to a protected URL round-trips through login back to the target | throwaway user | scenario: journal `users[]` | Hitting a dashboard/workflow URL anonymously redirects to login with `source`; after authenticating, the user lands on the originally requested page | planned |
| 8 | Already-authenticated users are redirected away from `/login` and `/user/register` | throwaway user | scenario: journal `users[]` | Logged-in GET `/login` redirects to the dashboard; GET `/user/register` serves the registration-complete view instead of the blank form | planned |
