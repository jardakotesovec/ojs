# User profile

- **Area:** 5. Users, roles & access
- **Placement:** lib/pkp
- **Budget:** 6 tests
- **Absorbs:** none
- **Scenario needs:** journal scenario `users[]` with `password` — every test gets its own scratch journal + throwaway user in one POST (profile edits are user mutations; the 16 shared seeded users are off-limits). Profile tabs verified in code: identity, contact, roles (self-registration + reviewing interests via `userGroups.tpl`), publicProfile, changePassword, notificationSettings, apiProfile (`lib/pkp/templates/user/profile.tpl`). Password tab itself is covered by the `password-flows` plan.
- **Round 2 / out of scope:**
  - ORCID connect/disconnect on the profile (covered by `orcid` plan).
  - Notification opt-outs actually suppressing notifications (covered by `notifications` plan; here only persistence).
  - API key authenticating against the REST API (covered by `api-smoke`; here only the management surface).
  - Subscriptions tab (OJS, only with subscriptions enabled — `subscriptions-management` territory).
  - Profile image upload rendering across themes.

## Tests

| # | Title | Actors | Seed | Verifies | Status |
|---|-------|--------|------|----------|--------|
| 1 | Identity tab edits persist and update the displayed name | throwaway user | scenario: journal `users[]` | Given/family/preferred public name save on the Identity tab, survive reload, and the preferred public name shows in the logged-in user nav | planned |
| 2 | Contact tab edits persist | throwaway user | scenario: journal `users[]` | Email, signature, phone, affiliation, mailing address and country save and survive reload; changed email is accepted (no `email.require_validation` in test config) | planned |
| 3 | Roles tab: self-register a role and record reviewing interests | throwaway user | scenario: journal `users[]` | Self-registration checkboxes (per `permitSelfRegistration` groups) add the Reviewer role; reviewing-interests vocabulary entries persist; new role visible after reload | planned |
| 4 | Public profile: bio and homepage URL round-trip, profile image uploads | throwaway user | scenario: journal `users[]` | Public tab saves bio statement + homepage URL; profile image upload succeeds and renders in the form after reload | planned |
| 5 | Notification preferences persist | throwaway user | scenario: journal `users[]` | Toggling notification/email opt-outs on the Notifications tab saves and survives reload (suppression effect asserted in `notifications` plan) | planned |
| 6 | API key lifecycle: generate, regenerate, delete | throwaway user | scenario: journal `users[]` (throwaway only — API-key mutations must never touch one of the 16 seeded users, whose cached auth state is shared across workers; same throwaway-user pattern as `api-smoke`'s API-key row) | API Key tab generates a key, regenerate replaces it with a different value, delete clears it back to "None" | planned |
