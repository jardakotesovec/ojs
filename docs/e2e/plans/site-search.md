# Site search

- **Area:** 4. Reader front end
- **Placement:** ojs
- **Budget:** 6 tests
- **Absorbs:** none
- **Scenario needs:** submission-published, submission-in-review fixtures; journal scenario for the multi-journal row. No gaps. **Indexing verified in code:** `Repo::publication()->publish()` fires `PublicationPublished` → `UpdateSubmissionInSearchIndex` listener → `DatabaseEngine::update()` → dispatches `UpdateSubmissionSearchJob` (upserts `submissions_fulltext`) onto the DB queue, which the web-request shutdown job runner executes (`queues.job_runner` defaults On). No manual job/CLI run needed, but the index lags the scenario POST by ≤1 web request — search rows must poll/re-submit the query until the seeded record appears. MySQL FULLTEXT matching: put a unique alphanumeric token (≥4 chars, no hyphens) in seeded titles; hyphenated tags are split by the tokenizer.
- **Round 2 / out of scope:**
  - Keyword/subject/section/category filter params (`DatabaseEngine` supports them but the default theme exposes no UI controls — API-only surface).
  - Galley full-text (`body`) search — blocked on the galley seeding GAP (see article-landing).
  - Result pagination (needs >25 seeded published submissions; cost outweighs round-1 value).
  - orderBy/orderDir controls; OpenSearch engine driver (config-dependent).

## Tests

| # | Title | Actors | Seed | Verifies | Status |
|---|-------|--------|------|----------|--------|
| 1 | Search by title word finds the published article | anonymous | submission-published (unique token in title) | Query on `/search` returns a result row with the seeded title + authors; clicking it opens the article landing page (poll until indexed) | planned |
| 2 | Search by author name finds the article | anonymous | submission-published | Querying the author's family name returns the seeded article (authors column of `submissions_fulltext`) | planned |
| 3 | No-results query shows the empty-result notice | anonymous | none (bootstrap publicknowledge) | Gibberish query renders the `search.noResults` notice and no result list | planned |
| 4 | Publication-date range filter includes and excludes results | anonymous | submission-published | dateFrom year in the future → seeded article absent; wide date range → present (same seeded scenario, two queries) | planned |
| 5 | Unpublished submission is not searchable | anonymous | submission-in-review (unique token in title) | Query for the unique token returns the no-results notice — only published content is indexed | planned |
| 6 | Site-wide search spans journals and the context filter narrows it | anonymous | journal scenario (published issue) + submission-published in scratch journal and in publicknowledge | `/index/search` returns hits from both journals; selecting one journal in the `searchContext` dropdown filters to that journal's hit only | planned |
