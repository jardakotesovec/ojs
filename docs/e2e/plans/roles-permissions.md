# Roles & permissions

- **Area:** 5. Users, roles & access
- **Placement:** lib/pkp
- **Budget:** 7 tests
- **Absorbs:** none
- **Scenario needs:** journal scenario (scratch journals; `users[]` for role-holders), submission scenario (row 3 needs a submission to open stage-participant surfaces). Role mutations happen on scratch journals only; the access-gating check against `publicknowledge` (row 6) is read-only. The Roles tab is the legacy `UserGroupGridHandler` grid; `UserGroupForm` fields verified: roleId, name/abbrev, assignedStages, permitSelfRegistration, permitMetadataEdit, permitSettings (manager level only), recommendOnly, masthead. Note: scenario `users[].roles` resolves only default role strings (`UserGroupLookup`), so custom-role membership (row 5) is reached via the existing-user invite → accept path inside the test (one-off → UI per charter).
- **Round 2 / out of scope:**
  - `recommendOnly` flag effect (covered by `recommend-only-editors` plan).
  - `permitMetadataEdit` effect (covered by `author-edit-published` absorption in `editor-metadata-editing`).
  - Role `masthead` flag effect on the public page (covered by `editorial-masthead`).
  - Role ordering in the grid; site-admin role grid at site level.
  - Author foreign-submission denial + own-dashboard-only scoping — owned by `author-dashboard`.
  - Reviewer workflow-URL gate (reviewer reaches only the reviewer view of their assignment) — owned by `reviewer-response` row 11.
  - Unassigned copyeditor denied on a submission's workflow — owned by `stage-participants` row 6.
  - Role-based dashboard gating (which dashboards a role sees) — owned by `editorial-dashboards` row 9.

## Tests

| # | Title | Actors | Seed | Verifies | Status |
|---|-------|--------|------|----------|--------|
| 1 | Roles grid lists default roles and stage-assignment edits persist | dbarnes (manager on scratch) | scenario: journal | Roles tab grid groups default roles by permission level with stage columns; unchecking/checking a stage on an existing role saves and survives reload | implemented (lib/pkp/playwright/tests/roles-permissions.spec.js) |
| 2 | Create, edit and delete a custom role | dbarnes (manager on scratch) | scenario: journal | New assistant-level role with name/abbrev + stage assignments appears in the grid; rename persists; delete removes it from the grid | implemented (lib/pkp/playwright/tests/roles-permissions.spec.js) |
| 3 | Stage assignments gate participant role options | dbarnes (manager/editor on scratch) | scenario: journal + submission; custom role via UI | Custom assistant role assigned to Copyediting only is offered in Add Participant on Copyediting but absent on Submission/Review stages | implemented (lib/pkp/playwright/tests/roles-permissions.spec.js) |
| 4 | permitSelfRegistration controls registration and profile role opt-ins | dbarnes (manager); anonymous registrant | scenario: journal; toggle via UI | With self-registration on, the role shows on `/user/register` and the profile Roles tab; toggled off, both surfaces hide it | implemented (lib/pkp/playwright/tests/roles-permissions.spec.js) |
| 5 | Manager-level role without settings access (permitSettings off) | dbarnes (manager); throwaway user in custom role | scenario: journal `users[]`; custom role + role grant via UI (invite-accept) | User in a manager-level role with permitSettings=false reaches the dashboard but ALL journal settings pages — including Users & Roles — are denied (authorizationDenied redirect); settings nav entries absent. Plan predicted "Users & Roles reachable"; live `ManagementHandler::authorize` gates the whole `settings` op (except the announcements/userComments exempt areas) behind `CanAccessSettingsPolicy`, so access is denied too — spec asserts the real behavior with the exempt Announcements area as the reachable-manager control. | implemented (lib/pkp/playwright/tests/roles-permissions.spec.js) |
| 6 | Non-manager roles are denied at management settings URLs | atester (author), jjanssen (reviewer), mfritz (copyeditor) | none (publicknowledge, read-only) | Each non-manager role hitting journal management settings URLs (`/management/settings/*`) gets 403/denied — the settings-URL access gate no other plan covers (foreign-submission/dashboard/workflow gates owned elsewhere, see out-of-scope) | implemented (lib/pkp/playwright/tests/roles-permissions.spec.js) |
| 7 | Roles are journal-scoped: no cross-journal access | throwaway user (roles in journal A only) | scenario: journal × 2 (`users[]` in A only) | User with roles only in journal A is denied on journal B's dashboard and settings (403/redirect to login or access denied); journal A access unaffected | implemented (lib/pkp/playwright/tests/roles-permissions.spec.js) |

## Implementation notes (wave 9)

New POM `lib/pkp/playwright/pages/RolesSettingsPage.js` drives the legacy
`UserGroupGridHandler` grid on Settings > Users & Roles > Roles (same
legacy-grid family as `ReviewFormSettingsPage`). Spec-local helpers
(`localToday`, `extractAcceptUrl`, the settings-URL gate list,
`openAssignRoleOptions`) live in the spec.

Behaviour pinned to live source, not the plan, where they diverged:
- **Settings gate is all-or-nothing (row 5).** `CanAccessSettingsPolicy`
  permits only site admins + managers with `permitSettings`, and
  `PKP\pages\management\ManagementHandler::authorize` applies it to the
  entire `settings` op except `['announcements']` / `['userComments']`.
  A `permitSettings=false` manager is therefore denied on Users & Roles
  (`settings/access`) as well — the plan's "Users & Roles reachable" was
  wrong. Denials are `PKPPageRouter::handleAuthorizationFailure` →
  `/user/authorizationDenied?message=…` for a logged-in user (anonymous
  would 302 to `/login`), so the matching `authorizationDenied` URL is
  also a session-liveness control on rows 5–7.

App-side findings (candidates for `docs/e2e/app-changes.md`, NOT written
this wave — out of scope per the wave contract):
- **UserGroup roles grid: row at positional index 0 loses its edit/delete
  actions.** `UserGroupGridHandler::loadData`
  (lib/pkp/controllers/grid/settings/roles/UserGroupGridHandler.php:170-213)
  returns rows via `VirtualArrayIterator` over an Eloquent `->all()`
  array — positional keys (0,1,2,…) — and the query carries no
  `ORDER BY`. `UserGroupGridRow::initialize`
  (lib/pkp/controllers/grid/settings/roles/UserGroupGridRow.php:48) gates
  the edit/remove LinkActions on `!empty($rowId) && is_numeric($rowId)`,
  and `empty('0') === true`, so the FIRST grid row renders with no
  `a.show_extras` and no edit/delete links. On a clean load the order is
  effectively `user_group_id` ASC (index 0 = the non-deletable "Journal
  manager" default, mostly benign), but the create flow's in-place grid
  refresh can prepend the freshly-created custom role at index 0, leaving
  it temporarily un-editable. Worked around in the POM via
  `resolveActionableRowId` (reload until the target row carries actions).
  Suggested ledger wording: "UserGroup roles grid suppresses edit/delete
  actions on the row at positional index 0 — `empty('0')` in
  UserGroupGridRow::initialize combined with positional row ids from an
  unordered loadData query; the row is uneditable from the UI until a
  reload reshuffles it off index 0."
- **Existing-user invitation accept doesn't persist the browser session
  (row 5).** `UserRoleAssignmentReceiveController::authorize` registers
  the invitee's session server-side, but the rotated cookie doesn't reach
  the browser context — the post-accept navigation 302s to `/login`
  (same family as the row-57 finding that `finalize` never logs the new
  user in). Spec drives an explicit login afterwards. Under parallel load
  the finalize POST also intermittently surfaces an `authorizationDenied`
  dialog; reload + re-accept recovers it (spec retries up to 3×).

POM helpers I wished existed (all went spec-local or into the new POM):
- A shared `authorizationDenied` URL matcher / settings-area gate list —
  several gating specs across the suite re-derive `/management/settings/*`
  + the `authorizationDenied` redirect by hand.
- A reusable existing-user invite→accept helper (manager edits a user →
  adds a role → invitee accepts the email link) — rows 5 here and
  user-role-assignment.spec.js / user-invitation.spec.js all hand-roll
  overlapping slices of this multi-actor journey.
