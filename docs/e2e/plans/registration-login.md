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

## Implementation notes (wave 8)

- Both absorbed specs were **extended in place** (no sibling files): rows 2–3 live in
  `user-registration.spec.js` beside row 1; rows 4, 5, 7, 8 live in `login.spec.js`, with row 6's
  admin smoke moved into a scoped `test.describe` + `test.use({user: 'admin'})` so the rest of the
  file stays anonymous. Spec↔row accounting: user-registration.spec.js = 3 tests / rows 1–3;
  login.spec.js = 5 tests / rows 4–8.
- Throwaway logins are driven through `LoginPage` on explicitly-anonymous contexts with
  non-`getPassword()` passwords — `asUser()` is never used for them (it would write throwaway
  entries into the shared `playwright/.auth` cache). Verified post-run: `.auth/` holds baseline
  users only, and row 6 (cached admin session) stays green alongside the login-churn rows.
- Single-locale scratch journals serve **unprefixed** URLs: a goto on `/index.php/<path>/en/...`
  302s to the bare form before the auth bounce, so the `?source=` REQUEST_URI carries no `/en/`
  segment (row 7 asserts on path parts, not the exact prefixed string).
- The profile Roles tab lists every scratch journal's self-registration groups under "Register
  with other journals" on a long-lived DB; row 2 scopes to the first `.section` of `#userGroups`
  (template-guaranteed current-context-first order). There is no text label to anchor on:
  `formSection.tpl`'s `translate=false` branch reads a misspelled `$FBV_Label` variable and
  renders the section label empty (cosmetic legacy bug, noted for the maintainers).

## Tests

| # | Title | Actors | Seed | Verifies | Status |
|---|-------|--------|------|----------|--------|
| 1 | Anonymous visitor registers, is auto-logged-in, and can start a submission | anonymous → new user | UI (publicknowledge, unique-tag username) | Registration form (identity, login, country, privacy consent) submits; "Registration complete" page; "Make a New Submission" lands in wizard Start step | implemented (lib/pkp/playwright/tests/user-registration.spec.js) |
| 2 | Registration with reviewer opt-in records the reviewer role and interests | anonymous → new user | UI (publicknowledge) | Reviewer self-registration checkbox + interests field on `/user/register`; after registering, profile Roles tab lists Reviewer and the entered reviewing interests | implemented (lib/pkp/playwright/tests/user-registration.spec.js) |
| 3 | Registration validation rejects duplicates and incomplete input | anonymous | UI (publicknowledge; duplicate check read-only against a seeded username) | Duplicate username/email, password mismatch, missing required fields, missing privacy consent each produce field errors; entered values are retained; no account created | implemented (lib/pkp/playwright/tests/user-registration.spec.js) |
| 4 | Login lands on the role-appropriate dashboard; logout invalidates the session | throwaway author + throwaway reviewer | scenario: journal `users[]` (scratch journal) | Author login → `dashboard/mySubmissions`; reviewer-only login → `dashboard/reviewAssignments`; logout via user menu returns to public site; revisiting dashboard redirects to `/login` | implemented (lib/pkp/playwright/tests/login.spec.js) |
| 5 | Failed login shows an error and a correct retry succeeds | throwaway user | scenario: journal `users[]` | Wrong password and unknown username show the login error without creating a session; subsequent correct credentials log in normally | implemented (lib/pkp/playwright/tests/login.spec.js) |
| 6 | Authenticated session persists across visits (no `/login` bounce on site root) | admin | none (bootstrap auth state) | Cached session cookie is accepted by the server; site root renders without redirect to `/login` | implemented (lib/pkp/playwright/tests/login.spec.js) |
| 7 | Anonymous request to a protected URL round-trips through login back to the target | throwaway user | scenario: journal `users[]` | Hitting a dashboard/workflow URL anonymously redirects to login with `source`; after authenticating, the user lands on the originally requested page | implemented (lib/pkp/playwright/tests/login.spec.js) |
| 8 | Already-authenticated users are redirected away from `/login` and `/user/register` | throwaway user | scenario: journal `users[]` | Logged-in GET `/login` redirects to the dashboard; GET `/user/register` serves the registration-complete view instead of the blank form | implemented (lib/pkp/playwright/tests/login.spec.js) |
