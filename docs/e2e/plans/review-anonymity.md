# Review anonymity

- **Area:** 2. Editorial workflow
- **Placement:** lib/pkp
- **Budget:** 5 tests
- **Absorbs:** none
- **Scenario needs:** submission scenario per-reviewer `method` (`anonymous` | `doubleAnonymous` | `open`) and `status` (existing); submission-in-review fixture overrides (existing). No gaps. Code-verified surfaces: submission Schema map anonymizes authors only for the current user's double-anonymous assignment (`lib/pkp/classes/submission/maps/Schema.php:471`); the author's review stage mounts `ReviewerManager` with `redactedForAuthors` only when open+completed assignments exist (`workflowConfigAuthorOJS.js:163`); authors read open reviews via `REVIEWER_READ_REVIEW_BY_AUTHOR`; `EditReviewForm` exposes `reviewMethod`; editor list renders `ReviewMethodIcons` per assignment.
- **Round 2 / out of scope:**
  - Public open-review display on the article landing page (`OpenReviewComponent` / `PkpOpenReview`) — large OJS front-end feature, separate round-2 candidate.
  - Anonymity-mode *selection* in the Add Reviewer modal — covered by the reviewer-assignment plan.
  - Journal default review mode (`PKPReviewSetupForm`) — review-settings plan.
  - Reviewer identity handling in notify-author decision emails — review-decisions plan.

## Tests

| # | Title | Actors | Seed | Verifies | Status |
|---|-------|--------|------|----------|--------|
| 1 | Double-anonymous: reviewer cannot see author identity | jjanssen | submission-in-review fixture (jjanssen `method:doubleAnonymous`, `status:accepted`) | Reviewer's submission view + "view all details" expose no author names (Schema map anonymization); review-type notice on the request step states the double-anonymous mode | planned |
| 2 | Anonymous (one-way): reviewer sees authors, author sees no reviewer | jjanssen, atester | submission-in-review fixture (submitter atester; jjanssen `method:anonymous`, `status:completed`, comments toAuthor) | Reviewer-side submission details DO show author identity; author's review-stage view mounts no reviewer listing (no open assignments) and never displays jjanssen's name | planned |
| 3 | Open review: author sees the completed review with reviewer identity | atester, dbarnes | submission-in-review fixture (submitter atester; jjanssen `method:open`, `status:completed`, comments toAuthor) | Author's review stage shows the redacted ReviewerManager listing the open review with the reviewer's name; author opens Read Review and sees the comments; editor view unaffected | planned |
| 4 | Editor changes review method on an existing assignment | dbarnes | submission-in-review fixture (jjanssen `method:doubleAnonymous`, `status:invited`) | Edit Review modal shows current method + due dates; switching to open persists and the reviewer row's ReviewMethodIcons/labels update | planned |
| 5 | Editor list distinguishes all three methods on one submission | dbarnes | submission-in-review fixture (three reviewers: doubleAnonymous, anonymous, open) | ReviewerManager shows each assignment with the correct review-type icon/label and full reviewer identity for the editor — anonymity never redacts the editor view | planned |
