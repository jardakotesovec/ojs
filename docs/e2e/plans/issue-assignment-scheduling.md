# Issue assignment & scheduling

- **Area:** 3. Publishing & issues
- **Placement:** ojs
- **Budget:** 5 tests
- **Absorbs:** playwright/tests/issue-assignment.spec.js
- **Scenario needs:** journal scenario `issues[]` w/ `published` flags — exists; submission scenario `publications[].issue` + `published` (future issue + published:true seeds STATUS_SCHEDULED) — exists. Tests that publish an issue use a scratch journal; tests that only assign/schedule a per-test submission against publicknowledge's future issue Vol 2 No 1 (2015) are allowed (issue itself stays unpublished and unmutated). No gaps.
- **Round 2 / out of scope:**
  - Continuous publishing ("Don't assign to an issue") → publication-publish-flow plan row 3.
  - Backdating/overriding datePublished on assignment.
  - Issue CRUD/publishing mechanics themselves → issue-management plan.
  - DOI behavior on schedule/publish → doi-management plan.

## Tests

| # | Title | Actors | Seed | Verifies | Status |
|---|-------|--------|------|----------|--------|
| 1 | Editor reassigns a published article between issues; reader TOCs reflect the move | dbarnes, anonymous | journal scenario: scratch journal w/ 2 published issues; submission-published into the source issue | Unpublish → republish picking the target issue in Review Publishing Details; publication issueId moves, status republished; target issue TOC lists the article, source TOC does not | implemented (playwright/tests/issue-assignment.spec.js) |
| 2 | Editor schedules an article into a future issue | dbarnes, anonymous | submission scenario: production-stage draft VoR w/ full metadata (publicknowledge) | Schedule For Publication selecting future issue Vol 2 No 1 (2015) → status Scheduled (chip in workflow, dashboard badge); anonymous article URL 404s; manage-issues TOC tab of the future issue lists the article | planned |
| 3 | Scheduled article goes live when its issue is published | dbarnes, anonymous | journal scenario: scratch journal w/ future issue; submission scheduled into it (issue + published:true seed) | Publishing the issue flips the article to Published; anonymous landing 200 and the article appears in the now-public issue TOC; issue becomes current | planned |
| 4 | Editor unschedules a scheduled article | dbarnes, anonymous | submission scenario: VoR scheduled into publicknowledge future issue (issue + published:true seed) | Unschedule confirmation reverts status to Unscheduled/queued; Schedule For Publication button returns; article no longer listed on the future issue's TOC tab; reader URL still 404 | planned |
| 5 | Editor assigns to a published back issue and publishes immediately; unpublish removes the TOC entry | dbarnes, anonymous | submission scenario: production-stage draft VoR w/ metadata, no issue (publicknowledge) | Publish flow with current/back-issue option targeting Vol 1 No 2 (2014) publishes immediately; anonymous TOC of that issue lists the article; unpublishing removes it from the TOC and landing 404s | planned |
