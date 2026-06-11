# API smoke

- **Area:** 8. System & communications
- **Placement:** lib/pkp
- **Budget:** 6 tests
- **Absorbs:** lib/pkp/playwright/tests/api-smoke.spec.js (4 tests → rows 1–4)
- **Scenario needs:** `submission-draft` with `submitter: atester` (row 4 — met); journal scenario `users[]` throwaway user for row 5 (met). `GAP: api_key_secret seeded into config.test.inc.php` (row 5) — the template ships `api_key_secret = ""`, so API-key tokens cannot be signed/validated at all; the legacy Cypress suite mutated the config from the spec, which is parallel-unsafe. Fix is a one-line substitution in `lib/pkp/playwright/scripts/seed-test-config.js` (harness change, applied once at cold boot, affects no other test) — wave-1 work item.
- **Round 2 / out of scope:**
  - Per-endpoint CRUD coverage — each feature plan exercises its own API surface; this plan only proves the auth/middleware stack.
  - API key management UI (enable/regenerate/delete) → `user-profile` plan owns the surface; row 5 drives it minimally as setup.
  - Rate limiting / altcha / captcha login variants (round-2 backlog).
  - OAuth-style flows — not a PKP feature; nothing to test.

## Tests

| # | Title | Actors | Seed | Verifies | Status |
|---|-------|--------|------|----------|--------|
| 1 | Authenticated page exposes a CSRF token via window.pkp.currentUser | dbarnes | none (seeded users) | `window.pkp.currentUser.csrfToken` present and well-formed on the profile page; speculative `/api/v1/_csrf` route still 404s (drift probe for `pkpApi.getCsrfToken`) | implemented (lib/pkp/playwright/tests/api-smoke.spec.js) |
| 2 | Anonymous request to /submissions is rejected | anonymous | none | Context-scoped `GET /api/v1/submissions` without a session returns 401 with a JSON `error` body (has.user middleware) | implemented (lib/pkp/playwright/tests/api-smoke.spec.js) |
| 3 | Authenticated user lists submissions | dbarnes | none | In-page fetch of `/api/v1/submissions` returns 200 with `items[]` + `itemsMax` shape (session-cookie auth through the same middleware chain as UI clicks) | implemented (lib/pkp/playwright/tests/api-smoke.spec.js) |
| 4 | Authenticated author lists their own submissions | atester | scenario: submission-draft (submitter atester) | The seeded submission id surfaces in atester's `/api/v1/submissions` listing | implemented (lib/pkp/playwright/tests/api-smoke.spec.js) |
| 5 | API-key token authenticates a request | throwaway user (users[]) | scenario: journal users[] throwaway user; UI (profile → API Key tab; needs api_key_secret GAP) | Enable + generate an API key in the throwaway user's profile — never dbarnes (read-only seeded user; a live key would persist for the whole run); a cookie-less APIRequestContext `GET /api/v1/submissions?apiToken=...` returns 200; a tampered token returns 401 (DecodeApiTokenWithValidation path) | planned |
| 6 | Role-gated endpoint rejects insufficient roles | atester, anonymous | none (seeded users) | atester (author only) in-page fetch `GET /api/v1/users` → 403 JSON error; anonymous request → 401 (positive manager-side listing is owned by `user-management`) | planned |
