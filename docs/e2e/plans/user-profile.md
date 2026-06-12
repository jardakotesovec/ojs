# User profile

- **Area:** 5. Users, roles & access
- **Placement:** lib/pkp
- **Budget:** 6 tests
- **Absorbs:** none
- **Scenario needs:** journal scenario `users[]` with `password` — every test gets its own scratch journal + throwaway user in one POST (profile edits are user mutations; the 16 shared seeded users are off-limits). Profile tabs verified in code: identity, contact, roles (self-registration + reviewing interests via `userGroups.tpl`), publicProfile, changePassword, notificationSettings, apiProfile (`lib/pkp/templates/user/profile.tpl`). Password tab itself is covered by the `password-flows` plan.
- **POM:** `lib/pkp/playwright/pages/UserProfilePage.js` (new, wave 8) — hash-anchored tab navigation (the legacy TabHandler pre-selects the tab named in `location.hash`), save-op response waits per tab (component-router uncamelized ops, incl. `save-a-p-i-profile`), TinyMCE field set/read by stable `name` attribute, API-key action helper.
- **Implementation notes (wave 8):**
  - Row 1: today's backend top nav (`TopNavActions.vue`) renders an InitialsAvatar + SR-only username only — no visible full-name string. The test asserts the two nav-feeding surfaces instead: avatar initials recompute from the new given/family name, and `pkp.currentUser.fullName` (PKPTemplateManager.php:1667) equals the preferred public name.
  - Row 2: the "changed email is accepted (no `email.require_validation`)" note was stale — ContactForm now routes every email change through a `ChangeProfileEmailInvite` (BaseProfileForm.php:66-86): pending-state form, confirmation mail to the CURRENT address, accept link finalizes + redirects to the contact tab. The test walks the full arc including the emailed accept link.
  - Row 6: APIProfileForm exposes a single toggling action (Create ↔ Delete; no dedicated regenerate button), so "regenerate" = Delete + Create with a different-JWT assertion. The stored key is `sha1(time())` — a same-second re-create would yield an identical key; the test interleaves a reload between the two creates so >1s always elapses.
- **Round 2 / out of scope:**
  - ORCID connect/disconnect on the profile (covered by `orcid` plan).
  - Notification opt-outs actually suppressing notifications (covered by `notifications` plan; here only persistence).
  - API key authenticating against the REST API (covered by `api-smoke`; here only the management surface).
  - Subscriptions tab (OJS, only with subscriptions enabled — `subscriptions-management` territory).
  - Profile image upload rendering across themes.

## Tests

| # | Title | Actors | Seed | Verifies | Status |
|---|-------|--------|------|----------|--------|
| 1 | Identity tab edits persist and update the displayed name | throwaway user | scenario: journal `users[]` | Given/family/preferred public name save on the Identity tab, survive reload, and feed the logged-in user nav (avatar initials recompute; `pkp.currentUser.fullName` = preferred public name — the nav has no visible full-name string, see Implementation notes) | implemented (lib/pkp/playwright/tests/user-profile.spec.js) |
| 2 | Contact tab edits persist | throwaway user | scenario: journal `users[]` | Signature, phone, affiliation, mailing address and country save and survive reload; email change enters the pending `ChangeProfileEmailInvite` state, the confirmation mail's accept link finalizes the new address (see Implementation notes) | implemented (lib/pkp/playwright/tests/user-profile.spec.js) |
| 3 | Roles tab: self-register a role and record reviewing interests | throwaway user | scenario: journal `users[]` | Self-registration checkboxes (per `permitSelfRegistration` groups) add the Reviewer role; reviewing-interests vocabulary entries persist; new role visible after reload | implemented (lib/pkp/playwright/tests/user-profile.spec.js) |
| 4 | Public profile: bio and homepage URL round-trip, profile image uploads | throwaway user | scenario: journal `users[]` | Public tab saves bio statement + homepage URL; profile image upload succeeds and renders in the form after reload (img present AND naturalWidth > 0) | implemented (lib/pkp/playwright/tests/user-profile.spec.js) |
| 5 | Notification preferences persist | throwaway user | scenario: journal `users[]` | Toggling notification/email opt-outs on the Notifications tab saves and survives reload (suppression effect asserted in `notifications` plan) | implemented (lib/pkp/playwright/tests/user-profile.spec.js) |
| 6 | API key lifecycle: generate, regenerate, delete | throwaway user | scenario: journal `users[]` (throwaway only — API-key mutations must never touch one of the 16 seeded users, whose cached auth state is shared across workers; same throwaway-user pattern as `api-smoke`'s API-key row) | API Key tab generates a key, regenerate (Delete + Create — single toggling action) replaces it with a different value, delete clears it back to "None" | implemented (lib/pkp/playwright/tests/user-profile.spec.js) |
