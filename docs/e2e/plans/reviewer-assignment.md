# Reviewer assignment

- **Area:** 2. Editorial workflow
- **Placement:** lib/pkp
- **Budget:** 10 tests
- **Absorbs:** `lib/pkp/playwright/tests/reviewer-assignment.spec.js` (pre-revamp 1-test version rewritten in place; its flow is row 1, refit onto the new `lib/pkp/playwright/pages/ReviewerManagerPage.js` POM)
- **Scenario needs:** submission scenario — in-review fixture with `reviewers` override incl. statuses `invited` / `accepted` / `declined` / `cancelled` and `responseDueDate` / `reviewDueDate` passthrough. All exist; no gaps.
- **Round 2 / out of scope:**
  - Enroll Existing User as reviewer (`enrollExistingReviewerForm`) — enrolling a seeded publicknowledge user mutates the 16 shared users, so it needs a scratch journal; deferred.
  - Login-as-reviewer row action (login-as plan) and editorial notes/gossip action.
  - Review-form selection during assignment (review-forms plan).
  - Author-suggested reviewers surfacing in the Add Reviewer flow (reviewer-suggestions plan).
  - What each anonymity mode exposes to reviewer/author (review-anonymity plan); here only the form control and stored method are asserted.
  - Automated reminder emails (scheduled-tasks plan); row 9 covers the manual reminder only.

## Tests

| # | Title | Actors | Seed | Verifies | Status |
|---|-------|--------|------|----------|--------|
| 1 | Editor assigns a reviewer via the Add Reviewer modal with anonymity + due dates | dbarnes | submission scenario: in review, `reviewers: []` | select-reviewer list panel; anonymity radio (method stored = anonymous); prefilled response/review due dates; reviewer row appears with method label; REST `reviewAssignments` round-trip | implemented (lib/pkp/playwright/tests/reviewer-assignment.spec.js) |
| 2 | Add Reviewer search filters candidates; already-assigned reviewer is flagged | dbarnes | submission scenario: in review, jjanssen `invited` | search narrows the panel to phudson; jjanssen's row carries the "currently assigned" marker (`reviewer.list.currentlyAssigned`) for this round and loses its Select button | implemented (lib/pkp/playwright/tests/reviewer-assignment.spec.js) |
| 3 | Assigning a reviewer sends the review-request email | dbarnes, phudson | submission scenario: in review, `reviewers: []` | assign phudson via UI; Mailpit query scoped to phudson + the submission's unique tag finds the ReviewRequest email carrying submission title + response due date; phudson's reviewAssignments dashboard shows the new invitation | implemented (lib/pkp/playwright/tests/reviewer-assignment.spec.js) |
| 4 | Editor edits a review assignment's method and due dates | dbarnes | submission scenario: in review, phudson `invited` | Edit action → edit-review form; change review method + review due date; reviewer list reflects the new anonymity label; REST `reviewAssignments` reflects method + date | implemented (lib/pkp/playwright/tests/reviewer-assignment.spec.js) |
| 5 | Editor unassigns an invited reviewer with notification | dbarnes | submission scenario: in review, phudson `invited` | Unassign action with email step; reviewer removed from the active list (unconfirmed assignment is deleted); tag-scoped Mailpit ReviewerUnassign email to phudson | implemented (lib/pkp/playwright/tests/reviewer-assignment.spec.js) |
| 6 | Editor cancels an accepted reviewer with notification | dbarnes | submission scenario: in review, jjanssen `accepted` | Cancel action (offered instead of Unassign once confirmed); assignment shows cancelled (statusId + dateCancelled); tag-scoped Mailpit cancellation email to jjanssen | implemented (lib/pkp/playwright/tests/reviewer-assignment.spec.js) |
| 7 | Editor reinstates a cancelled reviewer | dbarnes | submission scenario: in review, phudson `cancelled` | Reinstate action with email; assignment active again (returns to accepted — the cancelled state keeps dateConfirmed); tag-scoped Mailpit ReviewerReinstate email to phudson. *Plan originally said "declined", but the Reviewer Manager offers Reinstate only for CANCELLED assignments (`useReviewerManagerConfig.getItemActions`); declined gets Resend Request (row 8).* | implemented (lib/pkp/playwright/tests/reviewer-assignment.spec.js) |
| 8 | Editor resends the review request to a declined reviewer | dbarnes | submission scenario: in review, phudson `declined` | Resend Request action with fresh due dates; tag-scoped Mailpit ReviewerResendRequest email to phudson; status becomes Request Resent (REQUEST_RESEND) | implemented (lib/pkp/playwright/tests/reviewer-assignment.spec.js) |
| 9 | Editor sends a manual review reminder | dbarnes | submission scenario: in review, jjanssen `accepted` with past `reviewDueDate` | row shows Overdue; Send Reminder primary action; tag-scoped Mailpit ReviewRemind email to jjanssen; the row's History modal records the reminder date (the submission REST summary doesn't expose dateReminded) | implemented (lib/pkp/playwright/tests/reviewer-assignment.spec.js) |
| 10 | Editor creates a new reviewer from the Add Reviewer modal | dbarnes | submission scenario: in review, `reviewers: []` | Create New Reviewer form: unique new user created, enrolled as reviewer, assigned to the round; appears in the reviewer list (unique username avoids shared-journal collisions) | implemented (lib/pkp/playwright/tests/reviewer-assignment.spec.js) |
