# Reviewer response

- **Area:** 2. Editorial workflow
- **Placement:** lib/pkp
- **Budget:** 12 tests
- **Absorbs:** `lib/pkp/playwright/tests/reviewer-completes-review.spec.js` (`reviewer-recommendations.spec.js` is NOT absorbed here — its surface is recommendation configuration and belongs to the review-settings plan)
- **Scenario needs:** submission scenario — reviewer statuses `invited` / `accepted` / `completed`, reviewer `comments` (toEditor/toAuthor), `recommendation`, due-date passthrough; journal scenario with `users` for the scratch journal in row 4. `reviewerAccessKeysEnabled` is not in the context schema — single row (#4), so it is set through the review-setup settings UI on the scratch journal per the one-off rule (not a GAP).
- **Round 2 / out of scope:**
  - Custom review forms in the reviewer wizard (review-forms plan); rows use the default comment fields.
  - What double-anonymous/anonymous/open hide from whom (review-anonymity plan).
  - Reviewer recommendation configuration (review-settings plan).
  - Automated response/review reminder emails (scheduled-tasks plan).
  - Reviewer competing-interests statement variants and review-step locale variants.
  - Open-review attachment display on the article landing page (article-landing plan).

## Tests

| # | Title | Actors | Seed | Verifies | Status |
|---|-------|--------|------|----------|--------|
| 1 | Reviewer accepts the assignment and submits a review with a recommendation | phudson, dbarnes | submission scenario: in review, phudson `invited` | 4-step wizard: privacy consent + accept, guidelines, TinyMCE comments to author/editor, recommendation "Accept Submission", confirm dialog, "Review Submitted" landing; editor-side status RECEIVED; recommendation persisted | implemented (lib/pkp/playwright/tests/reviewer-completes-review.spec.js) |
| 2 | Reviewer declines the invitation; editor is notified | phudson, dbarnes | submission scenario: in review, phudson `invited` | step-1 "Decline Review Request" flow with comment to editor; tag-scoped Mailpit ReviewDecline email to dbarnes; editor's reviewer list shows declined; reviewer's dashboard shows the assignment under declined | planned |
| 3 | Reviewer attaches a file to the review; editors notified on completion | jjanssen, dbarnes | submission scenario: in review, jjanssen `accepted` | step-3 attachments grid upload (plupload) + submit; Mailpit query scoped to dbarnes + the submission's unique tag finds the ReviewCompleteNotifyEditors email; editor's Read Review modal lists the comments and the attachment | planned |
| 4 | One-click reviewer access via the email link | dbarnes, anonymous browser | journal scenario (scratch: dbarnes manager+editor, reviewer user) + submission scenario in scratch journal; UI: enable reviewer access keys in Review Setup | Mailpit review-request email to the scratch journal's reviewer (throwaway recipient) contains the `key=` URL; opening it in a logged-out context lands directly on review step 1 as that reviewer (no login form) | planned |
| 5 | Editor thanks a reviewer | dbarnes | submission scenario: in review, phudson `completed` | Thank Reviewer action with editable email; tag-scoped Mailpit ReviewAcknowledgement email to phudson; acknowledged date recorded in review details | planned |
| 6 | Editor reads a submitted review, confirms it, and can revert the confirmation | dbarnes | submission scenario: in review, phudson `completed` with toEditor + toAuthor comments | Read Review modal shows recommendation and both comment streams; confirming flips status to considered/complete; Revert Decision action flips it back | planned |
| 7 | Reviewer can view and download the review file during the request | phudson | submission scenario: in review, phudson `invited` | step 1 shows request details and the seeded Article Text file; file download responds 200 for the reviewer | planned |
| 8 | Reviewer saves a draft review for later and resumes | jjanssen | submission scenario: in review, jjanssen `accepted` | step-3 "Save for Later" persists comments; reopening the assignment returns to step 3 with the saved content intact | planned |
| 9 | Due dates surface to the reviewer; overdue response flagged to the editor | phudson, dbarnes | submission scenario: in review, phudson `invited` with past `responseDueDate` | reviewer sees response/review due dates on step 1 and the dashboard row; editor's reviewer list shows the response-overdue state | planned |
| 10 | Editor logs a response on the reviewer's behalf | dbarnes | submission scenario: in review, phudson `invited` | Log Response action (WorkflowLogResponseModal) records acceptance; reviewer list status flips to accepted | planned |
| 11 | Reviewer cannot open an assignment that is not theirs | amccrae | submission scenario: in review, phudson `invited` | direct `/reviewer/submission/{id}` as amccrae is denied (403/redirect); no review form rendered | planned |
| 12 | Completed assignment is read-only for the reviewer | jjanssen | submission scenario: in review, jjanssen `completed` | reopening the assignment shows the completion/read-only view (no editable recommendation or comments); dashboard lists it under completed | planned |
