# Issue management

- **Area:** 3. Publishing & issues
- **Placement:** ojs
- **Budget:** 11 tests
- **Absorbs:** playwright/tests/issues.spec.js (4 tests) — all 4 tests back rows 1-4 of **this plan only**. issue-archive-toc previously also claimed the spec's reader archive/issue-view coverage; that claim was removed as double-counting (its row reverted to `planned` and was re-scoped to TOC section grouping/ordering).
- **Scenario needs:** journal scenario: scratch journal w/ `users` (dbarnes manager) and `issues[]` (volume/number/year, `published`) — exists; submission scenario `journal` override + `publications[].issue` for TOC content — exists. Every test that creates/publishes/edits issues runs in a scratch journal (publicknowledge issues are read-only shared state). No gaps.
- **Round 2 / out of scope:**
  - Issue Access tab + per-article access status (`setAccessStatus`, subscription journals) → subscriptions-management / subscription-access plans.
  - Issue DOIs/identifiers tab → doi-management plan.
  - Reader TOC section grouping and archive pagination → issue-archive-toc plan.
  - Current-issue rendering on the journal homepage → journal-homepage plan.
  - Native XML issue export/import → native-xml-import-export plan.
  - Issue-published reader notification opt-outs → notifications plan.

## Tests

| # | Title | Actors | Seed | Verifies | Status |
|---|-------|--------|------|----------|--------|
| 1 | Manager creates a future issue and edits volume/number/year | dbarnes | journal scenario: scratch journal (dbarnes manager) | Create Issue form (uncheck showTitle) adds a Future-tab row; Issue Data tab edit bumps vol/no/year; grid row updates and persists across reload | implemented (playwright/tests/issues.spec.js) |
| 2 | Manager publishes issues, swaps the current issue, unpublishes | dbarnes | journal scenario: scratch journal | Publishing moves issues Future → Back and auto-promotes current; setCurrentIssue action appears only on non-current published issues and swaps correctly; unpublish returns the issue to Future | implemented (playwright/tests/issues.spec.js) |
| 3 | Published issue appears on the public archive with a working view page | dbarnes, anonymous | journal scenario: scratch journal; issue created+published via UI | Anonymous `/issue/archive` lists the identification; following the link loads the issue page (h1 identification) | implemented (playwright/tests/issues.spec.js) |
| 4 | Publishing with the notification box ticked emails journal users | dbarnes | journal scenario: scratch journal w/ a throwaway reader user (unique per-test email) enrolled | sendIssueNotification dispatches "Just published: …" email; Mailpit assertion scoped to the throwaway recipient's address + the scratch journal's unique issue identification — **no `clearAll()`** (principle 8; absorbed spec's inbox clearing must be removed at refit) | implemented (playwright/tests/issues.spec.js) |
| 5 | Manager reorders the issue TOC; reader TOC follows | dbarnes, anonymous | journal scenario: scratch journal w/ published issue; 2 submissions seeded published into it | TOC tab grid ordering (saveSequence) persists the new article order; anonymous issue page lists the articles in the new order | planned |
| 6 | Issue cover image uploads and shows to readers | dbarnes, anonymous | journal scenario: scratch journal w/ published issue | Issue Data cover upload + alt text saves; anonymous issue page (and archive listing) renders the cover image with the alt text | planned |
| 7 | Issue galley (full-issue PDF) is downloadable from the issue page | dbarnes, anonymous | journal scenario: scratch journal w/ published issue | Issue Galleys tab upload creates a galley row; anonymous issue page lists the issue galley link | planned |
| 8 | Manager deletes issues from both tabs | dbarnes, anonymous | journal scenario: scratch journal w/ one future + one published issue | Deleting the future issue removes its row; deleting the back issue removes it from the grid and the public archive no longer lists it | planned |
| 9 | Issue identification options and urlPath surface to readers | dbarnes, anonymous | journal scenario: scratch journal w/ future issue | Title + showTitle toggle, description, and urlPath save on Issue Data; after publish, `/issue/view/{urlPath}` loads and shows the title and description | planned |
| 10 | Unpublishing an issue pulls its articles from the reader site | dbarnes, anonymous | journal scenario: scratch journal w/ published issue + 1 submission published into it | Unpublish flips articles back to Scheduled (workflow status chip); anonymous article URL 404s; archive no longer lists the issue | planned |
| 11 | Manager removes an article from the issue TOC | dbarnes, anonymous | journal scenario: scratch journal w/ published issue + 2 submissions published into it | TOC tab removeArticle action drops the row; reader TOC no longer lists that article while the other remains; removed article is no longer published in the issue | planned |
