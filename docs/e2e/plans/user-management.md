# User management

- **Area:** 5. Users, roles & access
- **Placement:** lib/pkp
- **Budget:** 8 tests
- **Absorbs:** none (the Users & Roles invitation paths are absorbed by `user-invitations`)
- **Scenario needs:** journal scenario `users[]` (scratch journal with throwaway users — disable/remove/merge are destructive and must never touch the 16 shared seeded users); submission scenario (row 6, content reassignment on merge). Surfaces verified in code: `UserAccessManager` row actions = edit, email, login-as (`canLoginAs`), remove, disable/enable, merge (`canMergeUsers`); self-row exposes only Edit + Email (`useUserAccessManagerConfig.js`); email/disable/merge ops route through legacy `UserGridHandler` modals; single-role removal lives in the Edit-user wizard (`UserInvitationUserGroupsTable` "Remove Role").
- **Round 2 / out of scope:**
  - Notify Users bulk-email tab (bulk email deferred in inventory; off in publicknowledge).
  - Site-admin cross-journal user administration (covered by `site-administration` plan).
  - Login-as from the user row (covered by `login-as` plan row 2).
  - "Add user" — the only creation path is the invitation wizard (covered by `user-invitations`).

## Tests

| # | Title | Actors | Seed | Verifies | Status |
|---|-------|--------|------|----------|--------|
| 1 | Users list renders seeded users and search narrows results | dbarnes (manager on scratch) | scenario: journal `users[]` | Users & Roles list shows name, email, roles, start date, affiliation columns for seeded users; search by name and by email narrows; clearing search restores the full list and count | planned |
| 2 | Email a user from the row action | dbarnes (manager on scratch) | scenario: journal `users[]` + Mailpit | Email action opens the compose modal; subject/body required; send delivers to the user's address in Mailpit with the entered subject | planned |
| 3 | Disable a user with a reason; enable restores access | dbarnes (manager); throwaway user | scenario: journal `users[]` | Disable modal records a reason; disabled user's login is rejected with the disabled message; row shows Enable; enabling restores login | planned |
| 4 | Remove a single role from a multi-role user | dbarnes (manager); throwaway user with two roles | scenario: journal `users[]` (two roles) | Edit-user wizard "Remove Role" drops one role; the other role remains in the user row; removed role's access gates close for the user | planned |
| 5 | Remove a user from the journal | dbarnes (manager); throwaway user | scenario: journal `users[]` | Remove action (confirm dialog) strips all journal roles; user disappears from the Users list; the account still authenticates site-wide but has no role-gated access in the journal | planned |
| 6 | Merge users reassigns content to the target account | admin | scenario: journal `users[]` + submission (submitter = user A) | Merge A into B: A's username no longer exists / cannot log in; B remains; A's submission now lists B as owner/author-side user | planned |
| 7 | Action gating on the user rows | dbarnes (manager on scratch) | scenario: journal `users[]` (incl. an admin-roled row) | Manager's own row offers only Edit + Email (no disable/remove/merge/login-as); login-as and merge appear only where `canLoginAs`/`canMergeUsers` permit (absent on the site-admin row for a non-admin manager) | planned |
| 8 | Users list paginates and keeps counts consistent | dbarnes (manager on scratch) | scenario: journal `users[]` (seed past the page size) | List paginates beyond the page-size boundary; page navigation works; total count matches seeded users and updates under search | planned |
