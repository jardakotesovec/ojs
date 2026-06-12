# User management

- **Area:** 5. Users, roles & access
- **Placement:** lib/pkp
- **Budget:** 8 tests
- **Absorbs:** none (the Users & Roles invitation paths are absorbed by `user-invitations`)
- **Scenario needs:** journal scenario `users[]` (scratch journal with throwaway users — disable/remove/merge are destructive and must never touch the 16 shared seeded users); submission scenario (row 6, content reassignment on merge). Surfaces verified in code: `UserAccessManager` row actions = edit, email, login-as (`canLoginAs`), remove, disable/enable, merge (`canMergeUsers`); self-row exposes only Edit + Email (`useUserAccessManagerConfig.js`); email/disable/merge ops route through legacy `UserGridHandler` modals; single-role removal lives in the Edit-user wizard (`UserInvitationUserGroupsTable` "Remove Role").
- **Implementation notes (wave 9):**
  - Every scratch journal carries ONE extra Users-list row: `ContextBuilderProcessor` routes creation through `PKPContextService::add()`, which enrolls the creating user (`admin`) as the journal's first manager. All count assertions include it.
  - Row 5 deviation: a removed user does NOT disappear from the list. The Vue store queries `status=all`, and `lib/pkp/classes/user/Collector.php:500-502` widens `userUserGroupStatus` to ALL for `status=all`, so role-less users stay listed with an empty Roles cell (legacy grid hid them behind the explicit `includeNoRole` filter). The spec asserts the actual behavior: roles cell empties + Remove action disappears + gates close.
  - Candidate UI/backend gating mismatch (row 7, not asserted): Remove User / Disable User still render on a site-admin's row for a non-admin manager (`useUserAccessManagerConfig.js` gates them only on self/active-groups), while the legacy backend ops would reject with `grid.user.cannotAdminister`.
  - POM added: `lib/pkp/playwright/pages/UserManagementPage.js` (Users & Roles list, row menus, search, pagination, legacy side-modal hook).
- **Round 2 / out of scope:**
  - Notify Users bulk-email tab (bulk email deferred in inventory; off in publicknowledge).
  - Site-admin cross-journal user administration (covered by `site-administration` plan).
  - Login-as from the user row (covered by `login-as` plan row 2).
  - "Add user" — the only creation path is the invitation wizard (covered by `user-invitations`).

## Tests

| # | Title | Actors | Seed | Verifies | Status |
|---|-------|--------|------|----------|--------|
| 1 | Users list renders seeded users and search narrows results | dbarnes (manager on scratch) | scenario: journal `users[]` | Users & Roles list shows name, email, roles, start date, affiliation columns for seeded users; search by name and by email narrows; clearing search restores the full list and count | implemented (lib/pkp/playwright/tests/user-management.spec.js) |
| 2 | Email a user from the row action | dbarnes (manager on scratch) | scenario: journal `users[]` + Mailpit | Email action opens the compose modal; subject/body required; send delivers to the user's address in Mailpit with the entered subject | implemented (lib/pkp/playwright/tests/user-management.spec.js) |
| 3 | Disable a user with a reason; enable restores access | dbarnes (manager); throwaway user | scenario: journal `users[]` | Disable modal records a reason; disabled user's login is rejected with the disabled message; row shows Enable; enabling restores login | implemented (lib/pkp/playwright/tests/user-management.spec.js) |
| 4 | Remove a single role from a multi-role user | dbarnes (manager); throwaway user with two roles | scenario: journal `users[]` (two roles) | Edit-user wizard "Remove Role" drops one role; the other role remains in the user row; removed role's access gates close for the user | implemented (lib/pkp/playwright/tests/user-management.spec.js) |
| 5 | Remove a user from the journal | dbarnes (manager); throwaway user | scenario: journal `users[]` | Remove action (confirm dialog) strips all journal roles; the row stays listed (status=all keeps role-less users) with an emptied Roles cell and no Remove action; the account still authenticates site-wide but has no role-gated access in the journal | implemented (lib/pkp/playwright/tests/user-management.spec.js) |
| 6 | Merge users reassigns content to the target account | admin | scenario: journal `users[]` + submission (submitter = user A) | Merge A into B: A's username no longer exists / cannot log in; B remains; A's submission now lists B as owner/author-side user | implemented (lib/pkp/playwright/tests/user-management.spec.js) |
| 7 | Action gating on the user rows | dbarnes (manager on scratch) | scenario: journal `users[]` (the admin row is present via journal-creation auto-enrollment — no explicit seeding needed) | Manager's own row offers only Edit + Email (no disable/remove/merge/login-as); login-as and merge appear only where `canLoginAs`/`canMergeUsers` permit (absent on the site-admin row for a non-admin manager) | implemented (lib/pkp/playwright/tests/user-management.spec.js) |
| 8 | Users list paginates and keeps counts consistent | dbarnes (manager on scratch) | scenario: journal `users[]` (seed past the page size) | List paginates beyond the page-size boundary; page navigation works; total count matches seeded users and updates under search | implemented (lib/pkp/playwright/tests/user-management.spec.js) |
