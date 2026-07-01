# API smoke

- **Area:** 8. System & communications
- **Placement:** lib/pkp
- **Budget:** 6 tests
- **Absorbs:** lib/pkp/playwright/tests/api-smoke.spec.js (6 tests → rows 1–6)
- **Scenario needs:** `submission-draft` with `submitter: atester` (row 4 — met); journal scenario `users[]` throwaway user for row 5 (met; password set to the username-twice derivation so `asUser` drives the login). The `api_key_secret` GAP was closed in wave 1 (`lib/pkp/playwright/scripts/seed-test-config.js` seeds `playwright-api-key-secret-not-a-secret` into config.test.inc.php at cold boot); row 5 reads the secret back from the seeded config to forge its negative-path token.
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
| 5 | API-key token authenticates a request | throwaway user (users[]) | scenario: journal users[] throwaway user; UI (profile → API Key tab) | Enable + generate an API key in the throwaway user's profile — never dbarnes (read-only seeded user; a live key would persist for the whole run); "Create API Key" is the enable (APIProfileForm::execute sets apiKeyEnabled + apiKey together); a cookie-less APIRequestContext `GET /api/v1/submissions?apiToken=...` returns 200 (tokenless control 401); a tampered-signature token returns **400** `invalidApiToken` (NOT the 401 this row originally presumed — SignatureInvalidException branch, DecodeApiTokenWithValidation.php:108-112) and a validly-signed token over an unknown key returns 401 (the unauthorized branch, :100-105) | implemented (lib/pkp/playwright/tests/api-smoke.spec.js) |
| 6 | Role-gated endpoint rejects insufficient roles | atester, anonymous | none (seeded users) | atester (author only) in-page fetch `GET /api/v1/users` → **401** JSON error (NOT the 403 this row originally presumed: HasRoles.php:70-73 responds `Response::HTTP_UNAUTHORIZED` even for authenticated-but-underprivileged users — flagged in app-changes ledger), with a 200 `/submissions` positive control proving the session is live; anonymous request → 401 (positive manager-side listing is owned by `user-management`) | implemented (lib/pkp/playwright/tests/api-smoke.spec.js) |
