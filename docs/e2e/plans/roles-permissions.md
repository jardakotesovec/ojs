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
| 1 | Roles grid lists default roles and stage-assignment edits persist | dbarnes (manager on scratch) | scenario: journal | Roles tab grid groups default roles by permission level with stage columns; unchecking/checking a stage on an existing role saves and survives reload | planned |
| 2 | Create, edit and delete a custom role | dbarnes (manager on scratch) | scenario: journal | New assistant-level role with name/abbrev + stage assignments appears in the grid; rename persists; delete removes it from the grid | planned |
| 3 | Stage assignments gate participant role options | dbarnes (manager/editor on scratch) | scenario: journal + submission; custom role via UI | Custom assistant role assigned to Copyediting only is offered in Add Participant on Copyediting but absent on Submission/Review stages | planned |
| 4 | permitSelfRegistration controls registration and profile role opt-ins | dbarnes (manager); anonymous registrant | scenario: journal; toggle via UI | With self-registration on, the role shows on `/user/register` and the profile Roles tab; toggled off, both surfaces hide it | planned |
| 5 | Manager-level role without settings access (permitSettings off) | dbarnes (manager); throwaway user in custom role | scenario: journal `users[]`; custom role + role grant via UI (invite-accept) | User in a manager-level role with permitSettings=false reaches the dashboard and Users & Roles but journal settings pages are denied (403/redirect); settings nav entries absent | planned |
| 6 | Non-manager roles are denied at management settings URLs | atester (author), jjanssen (reviewer), mfritz (copyeditor) | none (publicknowledge, read-only) | Each non-manager role hitting journal management settings URLs (`/management/settings/*`) gets 403/denied — the settings-URL access gate no other plan covers (foreign-submission/dashboard/workflow gates owned elsewhere, see out-of-scope) | planned |
| 7 | Roles are journal-scoped: no cross-journal access | throwaway user (roles in journal A only) | scenario: journal × 2 (`users[]` in A only) | User with roles only in journal A is denied on journal B's dashboard and settings (403/redirect to login or access denied); journal A access unaffected | planned |
