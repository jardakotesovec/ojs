# Author dashboard

- **Area:** 1. Submission intake
- **Placement:** lib/pkp
- **Budget:** 6 tests
- **Absorbs:** none
- **Scenario needs:** submission scenario — `submitted: false` drafts, decision chains (`sendExternalReview`, `requestRevisions`, `decline`), `publications` with `published: true` (all existing); journal scenario scratch journal with `users[]` throwaway submitter (existing — row 2 independence). No gaps.
- **Round 2 / out of scope:**
  - "Scheduled" view (needs a schedule-for-publication state the scenario endpoint doesn't model yet; single-row need, not GAP-worthy — revisit with `issue-assignment-scheduling`).
  - Author uploads revisions after a revisions-requested decision (owned by `review-rounds-revisions`).
  - Editorial-role dashboard views/filters (owned by `editorial-dashboards`).
  - Per-column sort and pagination mechanics (shared list plumbing, covered once in `editorial-dashboards`).

## Tests

| # | Title | Actors | Seed | Verifies | Status |
|---|-------|--------|------|----------|--------|
| 1 | My-submissions list scoping | atester | submission scenario ×2 (one submitter atester, one other submitter) | Author's dashboard lists own submissions with stage/status labels; other users' submissions are absent; no editorial-role views are offered to a plain author | planned |
| 2 | Views filter by submission state | throwaway author (journal scenario `users[]` on a scratch journal) | journal scenario (scratch, `users[]` throwaway submitter) + submission scenario ×4 (incomplete, active, declined, published — one each, unique-tag titles, submitter = throwaway user) | Incomplete / Active / Declined / Published views each show the tag-scoped submission seeded for that state (correct status badge) and do not show the tag-scoped submissions of the other states — presence/absence by unique tag only, never exact membership or counts (principle 7: atester is shared across dozens of parallel tests, so count assertions on its dashboard flake) | planned |
| 3 | Search own submissions by title | atester | submission scenario ×2 | Title search narrows the list to the matching submission; non-matching query shows the empty state | planned |
| 4 | Author opens own submission (author workflow view) | atester | submission scenario (in external review, reviewers assigned) | Workflow modal renders the author config: submission status header, files visible, no editorial decision controls or reviewer identities | planned |
| 5 | Revisions-requested status surfaces to the author | atester | submission scenario (decisions: sendExternalReview → requestRevisions, toAuthor message) | "Revisions requested" view lists the submission; list row and author workflow view show the revisions-requested status and the editor's notification | planned |
| 6 | Author cannot open someone else's submission | atester | submission scenario (other submitter) | Direct workflow/dashboard URL for another author's submission is denied (authorization error), while the same URL works for its owner | planned |
