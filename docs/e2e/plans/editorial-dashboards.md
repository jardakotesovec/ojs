# Editorial dashboards

- **Area:** 2. Editorial workflow
- **Placement:** lib/pkp
- **Budget:** 10 tests
- **Absorbs:** none (`playwright/tests/scenarios/submission-stage.spec.js` overlaps superficially but is a scenario-seeding self-test owned by the test-infrastructure plan)
- **Scenario needs:** submission scenario — `participants` override (incl. empty list for needs-editor state), decision chains (`initialDecline`, `sendExternalReview`, `accept`, `sendToProduction`), per-round reviewer states (`invited`, `completed` + `recommendation`). All exist; no gaps.
- **Round 2 / out of scope:**
  - Exact view counts are not asserted (shared `publicknowledge` lists grow under parallel workers); rows assert presence/absence of the tagged submission only.
  - Category and days-since-last-activity filters; column sort; pagination at scale.
  - Bulk delete of incomplete submissions (journey owned by the submission-drafts plan).
  - Author `mySubmissions` list content (owned by the author-dashboard plan; only role-gating is touched here).
  - Reviewer-status filter facets on the editorial dashboard.

## Tests

| # | Title | Actors | Seed | Verifies | Status |
|---|-------|--------|------|----------|--------|
| 1 | Editor sees an assigned submission in "Assigned to me" with stage label | dbarnes | submission scenario: stage-1 draft with dbarnes as editor participant | `/dashboard/editorial` mounts; tagged submission listed in assigned-to-me view; row shows Submission stage; view menu renders with counts present | planned |
| 2 | Stage views bucket submissions by workflow stage | dbarnes | 3 submission scenarios: in review; decisions `[sendExternalReview, accept]` (copyediting); `+ sendToProduction` (production) | each tagged submission appears in its matching stage view (external-review / copyediting / production) and not in the others; stage cell label correct | planned |
| 3 | Unassigned submission shows in "Needs editor" for admin, hidden from unassigned section editor | admin, dbuskins | submission scenario: `participants: []` | admin sees needs-editor view containing the submission and sees it in Active; dbuskins gets no needs-editor view and does not see it in Active (assigned-only scoping) | planned |
| 4 | Search finds a submission by unique tag and by ID | dbarnes | submission scenario: stage-1 draft | `searchPhrase` = tag narrows the list to the submission; searching its numeric ID resolves it; clearing the search restores the list | planned |
| 5 | Section filter narrows the list and survives reload | dbarnes | 2 submission scenarios: one section ART, one section REV | filtering by Articles shows only the ART submission; active-filter chip rendered; filter persists in URL query params across reload; clear-filters restores both | planned |
| 6 | Admin filters Active view by assigned editor | admin | 2 submission scenarios with different editor participants (dbuskins vs minoue) | `assignedTo` filter limits the list to the selected editor's tagged submission | planned |
| 7 | Declined submission moves to the Declined view | dbarnes | submission scenario: decisions `[initialDecline]`, dbarnes participant | tagged submission absent from Active; present in Declined view with declined status label | planned |
| 8 | Reviewer dashboard buckets assignments by state | jjanssen | 2 submission scenarios: jjanssen `invited`; jjanssen `completed` (recommendation accept) | `/dashboard/reviewAssignments`: invited assignment under action-required view with response/review due dates; completed assignment under completed view | planned |
| 9 | Dashboard pages are role-gated | atester, phudson | none (seeded users) | author denied `/dashboard/editorial` (403/redirect); reviewer-only user denied editorial but reaches `/dashboard/reviewAssignments`; author reaches `/dashboard/mySubmissions` | planned |
| 10 | Opening a row launches the workflow dialog; closing returns to the filtered list | dbarnes | submission scenario: in review | clicking the row opens the workflow modal (`workflowSubmissionId` in URL); closing it returns to the dashboard with the selected view and search state intact | planned |
