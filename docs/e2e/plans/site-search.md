# Site search

- **Area:** 4. Reader front end
- **Placement:** ojs
- **Budget:** 6 tests
- **Absorbs:** none
- **Scenario needs:** submission-published, submission-in-review fixtures; journal scenario for the multi-journal row. No gaps. **Indexing verified in code:** `Repo::publication()->publish()` fires `PublicationPublished` → `UpdateSubmissionInSearchIndex` listener → `DatabaseEngine::update()` → dispatches `UpdateSubmissionSearchJob` (upserts `submissions_fulltext`) onto the DB queue, which the web-request shutdown job runner executes (`queues.job_runner` defaults On). No manual job/CLI run needed, but the index lags the scenario POST by ≤1 web request — search rows must poll/re-submit the query until the seeded record appears. MySQL FULLTEXT matching: put a unique alphanumeric token (≥4 chars, no hyphens) in seeded titles; hyphenated tags are split by the tokenizer. **Implementation notes (wave 8, run-verified):** the local engine is Postgres `whereFullText` (tsvector) — same alnum-token guidance holds. The theme's search submit button gets a CSS pseudo-element glyph appended to its accessible name, so `getByRole('button', {name: 'Search', exact: true})` matches NOTHING — match non-exact, scoped to `form.cmp_form`. Date filters are dropped server-side unless year+month+day are ALL supplied (`PKPRequest::getUserDateVar`). Author search (row 2) needs a globally-unique family name: the `authors` fulltext column is queried through the same bare `query` field and a shared name like "Vaca" hits every fixture-seeded submission on a long-lived DB.
- **Round 2 / out of scope:**
  - Keyword/subject/section/category filter params (`DatabaseEngine` supports them but the default theme exposes no UI controls — API-only surface).
  - Galley full-text (`body`) search — blocked on the galley seeding GAP (see article-landing).
  - Result pagination (needs >25 seeded published submissions; cost outweighs round-1 value).
  - orderBy/orderDir controls; OpenSearch engine driver (config-dependent).

## Tests

| # | Title | Actors | Seed | Verifies | Status |
|---|-------|--------|------|----------|--------|
| 1 | Search by title word finds the published article | anonymous | submission-published (unique token in title) | Query on `/search` returns a result row with the seeded title + authors; clicking it opens the article landing page (poll until indexed) | implemented (playwright/tests/site-search.spec.js) |
| 2 | Search by author name finds the article | anonymous | journal scenario (published issue) + scenario-created author user with unique familyName + submission-published submitted by them — a shared family name is unscopable on the long-lived DB (see notes) | Querying the author's family name on the scratch journal's `/search` returns the seeded article (authors column of `submissions_fulltext`) | implemented (playwright/tests/site-search.spec.js) |
| 3 | No-results query shows the empty-result notice | anonymous | none (bootstrap publicknowledge) | Gibberish query renders the `search.noResults` notice and no result list | implemented (playwright/tests/site-search.spec.js) |
| 4 | Publication-date range filter includes and excludes results | anonymous | submission-published (pinned `datePublished` 2024-05-10) | Wide range (poll-until-indexed doubles as the include), tight range bracketing the pinned date includes; future dateFrom and past dateTo each exclude with the no-results notice. URL-driven queries (the GET form's public surface): the form's year `<select>` is bounded by the journal's min/max published years, which parallel seeds shift | implemented (playwright/tests/site-search.spec.js) |
| 5 | Unpublished submission is not searchable | anonymous | submission-in-review (unique token in title, `reviewers: []`) + submission-published positive control seeded after it | Control polled until findable (bounds the indexing wait), then the unique in-review token returns the no-results notice — only published content is indexed | implemented (playwright/tests/site-search.spec.js) |
| 6 | Site-wide search spans journals and the context filter narrows it | anonymous | journal scenario (published issue) + submission-published in scratch journal and in publicknowledge (same token, distinct titles) | `/index/search` returns hits from both journals, each row attributed via its journal-name subtitle; selecting the scratch journal in the `searchContext` dropdown and re-submitting filters to that journal's hit only | implemented (playwright/tests/site-search.spec.js) |
