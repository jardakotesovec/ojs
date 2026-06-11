# Editorial dashboards

- **Area:** 2. Editorial workflow
- **Placement:** lib/pkp
- **Budget:** 10 tests
- **Absorbs:** none (`playwright/tests/scenarios/submission-stage.spec.js` overlaps superficially but is a scenario-seeding self-test owned by the test-infrastructure plan)
- **Scenario needs:** submission scenario — `participants` override (incl. empty list for needs-editor state), decision chains (`initialDecline`, `sendExternalReview`, `accept`, `sendToProduction`), per-round reviewer states (`invited`, `completed` + `recommendation`). All exist; no gaps. **Seeding subtlety:** a real submit (explicit `submitted: true` or any decisions/reviewRounds) fires `SubmissionSubmitted` → the `AssignEditors` listener auto-assigns the section's editors, so on publicknowledge (ART: dbarnes/dbuskins/sberardo, REV: dbarnes/minoue) `participants` is additive, not exact. Omitting `submitted` (with no decisions) seeds the submitted-shaped row WITHOUT the event — that's how rows 3 (needs-editor, `participants: []`) and 6 (exact per-editor assignment) stay reachable on the shared journal.
- **Round 2 / out of scope:**
  - Exact view counts are not asserted (shared `publicknowledge` lists grow under parallel workers); rows assert presence/absence of the tagged submission only.
  - Category and days-since-last-activity filters; column sort; pagination at scale.
  - Bulk delete of incomplete submissions (journey owned by the submission-drafts plan).
  - Author `mySubmissions` list content (owned by the author-dashboard plan; only role-gating is touched here).
  - Reviewer-status filter facets on the editorial dashboard.

## Tests

| # | Title | Actors | Seed | Verifies | Status |
|---|-------|--------|------|----------|--------|
| 1 | Editor sees an assigned submission in "Assigned to me" with stage label | dbarnes | submission scenario: stage-1 draft with dbarnes as editor participant | `/dashboard/editorial` mounts; tagged submission listed in assigned-to-me view; row shows Submission stage; view menu renders with counts present | implemented (lib/pkp/playwright/tests/editorial-dashboards.spec.js) |
| 2 | Stage views bucket submissions by workflow stage | dbarnes | 3 submission scenarios: in review; decisions `[sendExternalReview, accept]` (copyediting); `+ sendToProduction` (production) | each tagged submission appears in its matching stage view (external-review / copyediting / production) and not in the others; stage cell label correct | implemented (lib/pkp/playwright/tests/editorial-dashboards.spec.js) |
| 3 | Unassigned submission shows in "Needs editor" for admin, hidden from unassigned section editor | admin, dbuskins | submission scenario: `participants: []`, `submitted` omitted (see Scenario needs) | admin sees needs-editor view containing the submission and sees it in Active; dbuskins gets no needs-editor view and does not see it in Active (assigned-only scoping) | implemented (lib/pkp/playwright/tests/editorial-dashboards.spec.js) |
| 4 | Search finds a submission by unique tag and by ID | dbarnes | submission scenario: stage-1 draft | `searchPhrase` = tag narrows the list to the submission; searching its numeric ID resolves it; clearing the search restores the list | implemented (lib/pkp/playwright/tests/editorial-dashboards.spec.js) |
| 5 | Section filter narrows the list and survives reload | dbarnes | 2 submission scenarios: one section ART, one section REV | filtering by Articles shows only the ART submission; active-filter chip rendered; filter persists in URL query params across reload; clear-filters restores both | implemented (lib/pkp/playwright/tests/editorial-dashboards.spec.js) |
| 6 | Admin filters Active view by assigned editor | admin | 2 submission scenarios with different editor participants (dbuskins vs minoue), `submitted` omitted (see Scenario needs) | `assignedTo` filter limits the list to the selected editor's tagged submission | implemented (lib/pkp/playwright/tests/editorial-dashboards.spec.js) |
| 7 | Declined submission moves to the Declined view | admin | submission scenario: decisions `[initialDecline]`, dbarnes participant | tagged submission absent from Active; present in Declined view with declined status label | implemented (lib/pkp/playwright/tests/editorial-dashboards.spec.js) |
| 8 | Reviewer dashboard buckets assignments by state | jjanssen | 2 submission scenarios: jjanssen `invited`; jjanssen `completed` (recommendation accept) | `/dashboard/reviewAssignments`: invited assignment under action-required view with the response due date; completed assignment under completed view with its submit date | implemented (lib/pkp/playwright/tests/editorial-dashboards.spec.js) |
| 9 | Dashboard pages are role-gated | atester, phudson | none (seeded users) | author denied `/dashboard/editorial` (403/redirect); reviewer-only user denied editorial but reaches `/dashboard/reviewAssignments`; author reaches `/dashboard/mySubmissions` | implemented (lib/pkp/playwright/tests/editorial-dashboards.spec.js) |
| 10 | Opening a row launches the workflow dialog; closing returns to the filtered list | dbarnes | submission scenario: in review | clicking the row opens the workflow modal (`workflowSubmissionId` in URL); closing it returns to the dashboard with the selected view and search state intact | implemented (lib/pkp/playwright/tests/editorial-dashboards.spec.js) |

## Implementation notes (UI realities, verified live)

- **Row 7 actor changed dbarnes → admin.** The editorial dashboard's Declined view is offered to
  `ROLE_ID_SITE_ADMIN` / `ROLE_ID_MANAGER` (plus authors on mySubmissions) only — section
  editors/sub-editors like dbarnes get no Declined view at all (`Repo::submission()` →
  `mapDashboardViews()`; confirmed against the rendered view menu).
- **Row 2:** the external-review view heading is "All in review stage"
  (`submission.dashboard.view.reviewAll`), not "All in peer review" (`…reviewExternal`, unused by
  `mapDashboardViews`). Stage cell label for review is "Review (Round 1)".
- **Row 4:** clearing the search leaves an empty `searchPhrase=` param in the URL (vueuse
  `useUrlSearchParams` keeps the key); the test asserts the ID left the param + the input emptied.
- **Row 8:** the reviewer assignments endpoint (`_submissions/reviewerAssignments`) ignores
  `searchPhrase` and pagination params — it returns the reviewer's full list. Tag-scoped search is
  impossible there; rows are asserted against the fully rendered list, with the positive row
  bounding the fetch before each absence assertion. The invited row's activity cell shows the
  response due date ("Please accept or decline this request by {date}"); the review-completion due
  date is not displayed in that cell.
- **Locator traps:** the row's open control is named "View" but `getByRole` string matching is
  substring-based — "Assign Re**view**ers" matches too; `exact: true` required. The filters button
  is labelled "Filters" (`common.filter`).
