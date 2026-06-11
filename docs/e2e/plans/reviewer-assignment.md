# Reviewer assignment

- **Area:** 2. Editorial workflow
- **Placement:** lib/pkp
- **Budget:** 10 tests
- **Absorbs:** `lib/pkp/playwright/tests/reviewer-assignment.spec.js`
- **Scenario needs:** submission scenario — in-review fixture with `reviewers` override incl. statuses `invited` / `accepted` / `declined` and `responseDueDate` / `reviewDueDate` passthrough. All exist; no gaps.
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
| 2 | Add Reviewer search filters candidates; already-assigned reviewer is flagged | dbarnes | submission scenario: in review, jjanssen `invited` | search narrows the panel to phudson; jjanssen's row carries the "currently assigned" marker (`reviewer.list.currentlyAssigned`) for this round | planned |
| 3 | Assigning a reviewer sends the review-request email | dbarnes, phudson | submission scenario: in review, `reviewers: []` | assign phudson via UI; Mailpit query scoped to phudson + the submission's unique tag finds the ReviewRequest email carrying submission title + response due date; phudson's reviewAssignments dashboard shows the new invitation | planned |
| 4 | Editor edits a review assignment's method and due dates | dbarnes | submission scenario: in review, phudson `invited` | Edit action → edit-review form; change review method + review due date; reviewer list reflects the new anonymity label and date | planned |
| 5 | Editor unassigns an invited reviewer with notification | dbarnes | submission scenario: in review, phudson `invited` | Unassign action with email step; reviewer removed from the active list; tag-scoped Mailpit ReviewerUnassign email to phudson | planned |
| 6 | Editor cancels an accepted reviewer with notification | dbarnes | submission scenario: in review, jjanssen `accepted` | Cancel action (offered instead of Unassign once confirmed); assignment shows cancelled; tag-scoped Mailpit cancellation email to jjanssen | planned |
| 7 | Editor reinstates a declined reviewer | dbarnes | submission scenario: in review, phudson `declined` | Reinstate action with email; assignment active again (awaiting response); tag-scoped Mailpit ReviewerReinstate email to phudson | planned |
| 8 | Editor resends the review request to a declined reviewer | dbarnes | submission scenario: in review, phudson `declined` | Resend Request action; tag-scoped Mailpit ReviewerResendRequest email to phudson; status returns to awaiting response | planned |
| 9 | Editor sends a manual review reminder | dbarnes | submission scenario: in review, jjanssen `accepted` with past `reviewDueDate` | Send Reminder action; tag-scoped Mailpit ReviewRemind email to jjanssen; review details record the reminder date | planned |
| 10 | Editor creates a new reviewer from the Add Reviewer modal | dbarnes | submission scenario: in review, `reviewers: []` | Create New Reviewer form: unique new user created, enrolled as reviewer, assigned to the round; appears in the reviewer list (unique username avoids shared-journal collisions) | planned |
