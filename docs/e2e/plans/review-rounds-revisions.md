# Review rounds & revisions

- **Area:** 2. Editorial workflow
- **Placement:** lib/pkp
- **Budget:** 12 tests
- **Absorbs:** `lib/pkp/playwright/tests/decision-request-revisions.spec.js`; `lib/pkp/playwright/tests/review-round.spec.js` (`playwright/tests/scenarios/submission-in-round-2.spec.js` is a seeding self-test owned by the test-infrastructure plan)
- **Scenario needs:** submission scenario — decision chains (`requestRevisions`, `resubmit`, `newExternalRound`), multi-round `reviewRounds` incl. per-round reviewer lists and an empty round 2, reviewer `recommendation`/`comments`, due-date passthrough. `UI-FALLBACK: seed review-revision files on a round` — adjudicated verdict for round 1: rows 2 and 4 reach the "author already uploaded revisions" state by driving the legacy plupload wizard through the UI (the path the absorbed spec proves, ~10s of legacy-form driving per test), which is acceptable; revisit a Processor extension only if more plans need seeded revisions.
- **Round 2 / out of scope:**
  - Event-log entries and the round-history modal (activity-log plan).
  - Internal review stage (OMP-only; OJS has external review only).
  - "X of N reviews" minimum-review progress indicator (depends on `numReviewsPerSubmission` config; revisit with review-settings).
  - Round-2 reviewer re-invitation shortcuts beyond plain Add Reviewer (not a verified UI surface).
  - Decision emails with attachments (review-decisions plan).

## Tests

| # | Title | Actors | Seed | Verifies | Status |
|---|-------|--------|------|----------|--------|
| 1 | Editor requests revisions (no new round); author uploads revisions | dbarnes, atester | submission scenario: in review, submitter atester | revision-type radio modal (default pending-revisions); `PENDING_REVISIONS` decision row; round status revisions-requested; author "Upload revisions" affordance; plupload wizard upload lands as `REVIEW_REVISION` file | implemented (lib/pkp/playwright/tests/decision-request-revisions.spec.js) |
| 2 | Editor sees submitted revisions; round flips to revisions-submitted | dbarnes, atester | submission scenario: in review + decisions `[requestRevisions]`, submitter atester; UI: author uploads revision file | editor's Revisions file manager lists the author's file; round status indicator shows revisions submitted; editor dashboard revisions-submitted view lists the submission | planned |
| 3 | Resubmit-for-review decision notifies the author | dbarnes, atester | submission scenario: in review, submitter atester | Request Revisions modal → "Resubmit for Review" radio; `RESUBMIT` decision row; tag-scoped Mailpit notify-author email to atester; author panel (no upload affordance pre-decision) shows the resubmit request + upload affordance after | planned |
| 4 | Resubmit cycle: revisions promoted into a new round | dbarnes, atester | submission scenario: in review + decisions `[resubmit]`, submitter atester; UI: author uploads revision | editor runs Create New Review Round; Promote Files step offers the author's revision file; round 2 review files include it | planned |
| 5 | Editor closes round 1 with revisions and opens round 2 from the UI | dbarnes | submission scenario: in review, phudson `completed` (recommendation pendingRevisions) | requestRevisions (with notify-reviewers step) then Create New Review Round; both decision rows recorded; two stage-3 rounds exist with distinct ids | implemented (lib/pkp/playwright/tests/review-round.spec.js) |
| 6 | Round tabs preserve round-1 history | dbarnes | submission scenario: submission-in-round-2 fixture | Round 1 and Round 2 tabs render; round 1 shows phudson's completed review (readable), round 2 shows jjanssen invited; current round is 2 | planned |
| 7 | Round status indicators track reviewer progress | dbarnes | 3 submission scenarios: reviewer `invited`; `accepted`; `completed` | workflow status text per state: awaiting reviewers' responses / awaiting reviews / reviews received-ready for decision (exact locale strings confirmed during implementation) | planned |
| 8 | New round 2 starts empty; editor cancels the review round | dbarnes, atester | submission scenario: decisions `[requestRevisions, newExternalRound]`, round 2 with `reviewers: []`, submitter atester | round 2 reviewer list is empty (round 1 reviewers not carried over); Cancel Review Round decision; tag-scoped Mailpit cancel-round notify-author email to atester; round 1 is current again | planned |
| 9 | Overdue review surfaces on the round and the dashboard | dbarnes | submission scenario: in review, reviewer `accepted` with past `reviewDueDate` | reviewer row shows the overdue state; editorial dashboard reviews-overdue view lists the submission | planned |
| 10 | Editor requests an author response to reviews; author responds | dbarnes, atester | submission scenario: in review, phudson `completed` with toAuthor comments, submitter atester | Author Response manager "Request Response" → tag-scoped Mailpit request email to atester; author submits a response via the response form; editor sees response-submitted status on the round | planned |
| 11 | Author revisions affordance is gated on the decision | atester | submission scenario: in review (no decisions beyond sendExternalReview), submitter atester | author's mySubmissions panel for the in-review submission shows review status but no "Upload revisions" button before any revisions decision | planned |
| 12 | Round-2 review completes independently of round 1 | jjanssen, dbarnes | submission scenario: submission-in-round-2 fixture | jjanssen accepts + submits the round-2 review via the wizard; editor sees round 2 review received while round 1 history (phudson completed) stays intact | planned |
