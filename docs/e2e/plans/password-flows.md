# Password flows

- **Area:** 5. Users, roles & access
- **Placement:** lib/pkp
- **Budget:** 5 tests
- **Absorbs (rework):** lib/pkp/playwright/tests/mailpit.spec.js — its password-reset test only (request → mail arrival); row 1 extends it to the full reset round-trip. The other mailpit.spec.js tests (clearAll harness, Mail::fake leak check) belong to the `test-infrastructure` plan, not here.
- **Scenario needs:** journal scenario `users[]` with `password` (throwaway users — password mutations must never touch the 16 shared seeded users, whose cached auth state would break parallel tests) and `mustChangePassword: true` (supported by the context schema) for the forced-change row. Mailpit fixture (`pkpMail`) for reset mail; tests assert per-recipient with unique-tag emails and never call `clearAll()` (principle 8 — shared inbox; the only `clearAll()` lives in the serial `test-infrastructure` spec); every negative assertion ("no mail sent") is paired with a positive control message that bounds the wait.
- **Round 2 / out of scope:**
  - Captcha / rate limiting on the lost-password form (deferred in inventory).
  - `email.require_validation` interaction with reset flows.
  - Site-admin forced password invalidation policies (no UI surface found; do not invent).

## Tests

| # | Title | Actors | Seed | Verifies | Status |
|---|-------|--------|------|----------|--------|
| 1 | Lost-password round trip: request, email link, set new password, log in | throwaway user (anonymous flow) | scenario: journal `users[]` + Mailpit | `/login/lostPassword` → generic confirmation page; reset mail lands in Mailpit; reset link opens the new-password form (`resetPassword` hash validated); `updateResetPassword` saves; old password rejected, new password logs in | planned — Absorbs (rework): lib/pkp/playwright/tests/mailpit.spec.js |
| 2 | Lost-password edge cases: unknown email and invalid hash | anonymous | scenario: journal `users[]` (control user) + Mailpit | Unknown email yields the same generic confirmation (no account enumeration); no reset mail to the unknown address, asserted with a recipient-scoped search bounded by a positive control (a reset request for the control user whose mail does arrive — principle 8); a tampered/expired reset hash is rejected and redirects back to `lostPassword` with an error | planned |
| 3 | Forced password change on first login | throwaway user with `mustChangePassword` | scenario: journal `users[]` (`mustChangePassword: true`) | Login redirects to `/login/changePassword`; dashboard unreachable until changed; after saving, user proceeds to dashboard; old password rejected on re-login, new one works | planned |
| 4 | Change password from the profile Password tab | throwaway user | scenario: journal `users[]` | Profile → Password tab requires the current password; wrong current password is rejected with an error; on success a fresh login works only with the new password | planned |
| 5 | Password validation rules on change/reset forms | throwaway user | scenario: journal `users[]` | Minimum-length rule (site `minPasswordLength`) and new/confirm mismatch produce field errors on the profile Password form and the reset form; password unchanged after failed attempts | planned |
