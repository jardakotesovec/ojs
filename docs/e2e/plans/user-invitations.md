# User invitations

- **Area:** 5. Users, roles & access
- **Placement:** lib/pkp
- **Budget:** 6 tests
- **Absorbs:** lib/pkp/playwright/tests/user-invitation.spec.js; lib/pkp/playwright/tests/user-role-assignment.spec.js
- **Scenario needs:** journal scenario `users[]` (scratch journal; dbarnes as manager plus throwaway/baseline invitees) + Mailpit (`extractLink`-style accept/decline URL extraction — the invitation template uses single-quoted `btn-accept`/`btn-decline` anchors, see the absorbed spec's local helper). Invitation wizard shapes verified in the absorbed specs: search → details → email composer (manager side); userCreate → userDetails → review (invitee side); Edit-user wizard skips the search step. Refit note (principle 7): the absorbed `user-role-assignment.spec.js` currently seeds **phudson** — one of the 16 shared seeded users — into the scratch journal and leaves a pending invitation on his account across runs; on refit, row 2 must use a throwaway `users[]` user instead.
- **Round 2 / out of scope:**
  - ORCID step inside the accept wizard (covered by `orcid` plan).
  - Reviewer invitations issued from the review workflow (covered by `reviewer-assignment` / `reviewer-response`).
  - Invitation expiry by date (no deterministic in-test clock; revisit with a time-travel hook if one lands).

## Tests

| # | Title | Actors | Seed | Verifies | Status |
|---|-------|--------|------|----------|--------|
| 1 | Invite a brand-new user to a role; invitee accepts and lands in the role | dbarnes (manager) → invitee (anonymous) | scenario: journal `users[]` + Mailpit | Full multi-actor journey: search step stashes new email → details + role table → email composer sends; accept link drives userCreate/userDetails/review; REST shows the role; new credentials log in to the role dashboard | implemented (lib/pkp/playwright/tests/user-invitation.spec.js) |
| 2 | Invite an existing journal user to an additional role (manager side) | dbarnes (manager) | scenario: journal `users[]` (throwaway existing user as reviewer — not phudson; see refit note) | Edit-user wizard (search step skipped) adds a role with start date + masthead choice; "Invitation Sent" dialog; pending `userRoleAssignment` invitation visible via REST and the Invitations panel count | implemented (lib/pkp/playwright/tests/user-role-assignment.spec.js) |
| 3 | Existing user accepts a role invitation without re-registering | dbarnes (manager) → throwaway existing user | scenario: journal `users[]` + Mailpit | Accept link for an existing account skips account creation (login as the existing user instead); on finalize the new role is active on the journal; the pending invitation clears from the Invitations panel | planned |
| 4 | Invitee declines an invitation | dbarnes (manager) → invitee | scenario: journal `users[]` + Mailpit | Decline link (`btn-decline`) marks the invitation declined; no role is granted; Users list unchanged; Invitations panel no longer counts it as pending | planned |
| 5 | Manager cancels a pending invitation | dbarnes (manager) | scenario: journal `users[]` + Mailpit | Cancel action on the Invitations panel removes the pending row; the previously emailed accept link no longer works (error page, no role granted) | planned |
| 6 | Wizard search resolves an existing journal user | dbarnes (manager) | scenario: journal `users[]` | Step-1 search by the email of a user already in the journal resolves the account (no new-user branch): wizard proceeds to details with the user's identity and current roles shown; role select excludes roles already held | planned |
