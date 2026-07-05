---
name: site-search
scope: The reader-facing article SEARCH — the `/search` page (query box + advanced date filter), the fulltext query over published articles (title/abstract/body/authors), the no-result behaviour, single-journal vs site-wide (cross-journal) scope, and the maintenance of the fulltext index (the async re-index job on publish + the CLI rebuild)
shared: pkp-lib      # the SearchHandler, the Laravel-Scout engines (DatabaseEngine/OpenSearchEngine), the UpdateSubmissionSearchJob and the submissions_fulltext table all live in lib/pkp; OJS only overrides SearchHandler::authorize (journal-must-publish) and SubmissionSearchResult::newCollection (issue-availability per result)
status: verified
e2e-plans: [site-search]
atlas-claims:
  - PAGE-search-index
  - PAGE-search-search
  - DB-submissions_fulltext
  - JOB-updatesubmissionsearchjob
---

# Site search (the reader's article search)

## Purpose

A reader who wants to find an article types a term into the **search** page — reached from the
magnifying-glass link in every journal header, or directly at
`/index.php/{journal}/{lang}/search`. The page shows a **query box** and an **advanced-filters**
fieldset (a published-**date range**, plus — at the site level — a **journal picker**), runs the
query against a **fulltext index** of every *published* article's **title, abstract, galley body and
author names**, and lists the matching article summaries (paginated, 25 per page) — each linking to
its article landing page. A query that matches nothing shows a plain **"No Results"** notice. Search
is **public and anonymous**; there is no login wall and no per-article gate at the abstract level
(subscription/payment gating is carried as an availability flag on each result, resolved by the
owning features). In OJS 3.6 the whole search stack was rebuilt on **Laravel Scout** (pkp/pkp-lib
#8920): a pluggable *search engine* — the built-in **DatabaseEngine** (a MySQL-FULLTEXT / PostgreSQL-
`tsvector` index in one `submissions_fulltext` table, the default) or an optional external
**OpenSearchEngine** — replaces the old `submission_search_*` inverted-index tables and the
`ArticleSearch`/`SubmissionSearch` classes, which are gone. The index is **maintained
asynchronously**: publishing (or unpublishing) an article queues a job that (re)writes its fulltext
rows; a CLI tool rebuilds the whole index. This spec owns the **search page, the query + filters, the
result/no-result render, and the index + its maintenance job/CLI**; the article page each result
links to, the metadata that is indexed, and the galley text that is extracted are owned elsewhere
(pointers below).

## Actors & permissions

Search itself is **public** — the only actor for the query surface is the **Anonymous reader** (any
logged-in user searches identically; no role changes what search returns). "Published" is the sole
visibility gate: search returns only articles whose **current publication is Published**, and in a
journal context the surrounding `OjsJournalMustPublishPolicy` makes the page unreachable on a journal
that is not itself in a published state. Index **maintenance** is not a reader action: it is a
**site administrator** CLI job (there is no re-index button in the UI). The one search-related *form*
in the settings UI — "Search Engine Indexing" — is a **manager** SEO setting, not a fulltext-index
control (see rule 9 + Open question 1). <sup>a</sup>

| Action | Who may — and when |
|--------|--------------------|
| **Open the search page & run a query** | • Anonymous reader (and any user) — always, in any **published** journal context or at the site level; no login, no CSRF (it is a `GET` form)<br>• On a journal whose publishing state is "none"/disabled the search page is **not reachable** (the whole handler is denied), same as every other reader page <sup>b</sup> |
| **See an article in the results** | • Anyone — but **only** articles whose **current publication is Published** *and* which have been **indexed** (a just-published article is absent until its index job runs, rule 8); a queued/declined/unpublished submission never appears <sup>c</sup> |
| **Narrow to one journal (site-wide search)** | • Anyone — at the **site** level (`/index/search`, no journal in the path) the page adds a **journal picker** listing every enabled journal; picking one scopes the query to it. Inside a journal context the query is already scoped to that journal and no picker shows <sup>d</sup> |
| **Rebuild / clear the fulltext index** | • Site administrator — **CLI only** (`php tools/rebuildSearchIndex.php [journalPath]`); flushes and re-queues indexing for all (or one journal's) submissions. **No UI affordance exists** for this <sup>e</sup> |
| **Edit "Search Engine Indexing" settings** | • Journal manager / site admin — Settings → **Distribution** → *Search Engine Indexing* (a crawler-facing description + custom `<meta>` headers). This is **not** a fulltext re-index control despite the atom name — it changes nothing about the search on this page; the form is **owned by `distribution-settings`**, listed here only to disambiguate the misleading `FORM-pkp-search-indexing-form` atom (rule 9) <sup>f</sup> |

<sup>a</sup> `SearchHandler::index()`/`::search()` call `validate(null, $request)` only (no role gate); `SearchHandler::authorize()` (OJS) adds `OjsJournalMustPublishPolicy` when a context is present ·
<sup>b</sup> `PKP\pages\search\SearchHandler::search()`; live 2026-07-05 (`:8000`, anonymous): journal search 200, site search 200 ·
<sup>c</sup> `DatabaseEngine::buildQuery()` (`whereIn('s.submission_id', publications where status = STATUS_PUBLISHED)`) + `SubmissionSearchResult::newCollection()` (skips any result whose current publication `status != STATUS_PUBLISHED`) ·
<sup>d</sup> `SearchHandler::search()` (`if (!$context) … 'searchableContexts' = getManySummary(['isEnabled' => true])`); `search.tpl` `{if $searchableContexts}` journal `<select name="searchContext">`; live: `/index/en/search` renders the picker, `/publicknowledge/en/search` does not ·
<sup>e</sup> `tools/rebuildSearchIndex.php` `execute()` (`$engine->flush()`, `deleteIndex()`, `createIndex()`, then `update()` per 100-submission chunk) ·
<sup>f</sup> `PKPSearchIndexingForm` (fields `searchDescription`, `customHeaders`), rendered by `management/distribution.tpl` `FORM_SEARCH_INDEXING`

## Fields & validation

The search form is a **`GET`** form; every field is optional and re-echoed into the results URL so
searches are bookmarkable/shareable. Only the first three rows are present in the **default theme's
UI**; the remaining rows are query parameters the backend builder honours but for which the stock
`search.tpl` renders **no input** (a plugin/theme can add them via the
`Templates::Search::SearchResults::AdditionalFilters` hook — rule 4).

| Field (UI label) | Required? | Rules | Anchor |
|------------------|-----------|-------|--------|
| **Search** (the query) | No | Free text; matched as a fulltext query over title/abstract/body/authors. Empty query = list **all** published+indexed articles. Common words are dropped by the DB's fulltext dictionary (e.g. "the" → no matches on Postgres) | `builderFromRequest()` `query`; `DatabaseEngine::buildQuery()` `whereFullText([...])` |
| **Published after** (date from) | No | Year+month+day (accessible date selector); needs all three parts to take effect. Keeps articles published **on/after** the date | `search.tpl` `html_select_date_a11y prefix="dateFrom"`; `getUserDateVar('dateFrom')`; `SearchHandler::_assignDateFromTo()` |
| **Published before** (date to) | No | As above; keeps articles published **before** the date (exclusive upper bound `< dateTo`) | `dateTo`; `DatabaseEngine::buildQuery()` `whereDate('p.date_published','<',$publishedTo)` |
| **Journal** (site-level only) | No | Dropdown of enabled journals; scopes the query to one journal. Absent inside a journal context | `search.tpl` `<select name="searchContext">` |
| Section / Category / Keyword / Subject | No | **Backend-only** (`sectionIds[]`, `categoryIds[]`, `keywords[]`, `subjects[]`) — the builder filters on them but the stock UI offers no control; reachable via URL param or an AdditionalFilters plugin | `builderFromRequest()` `whereIn(...)`; `DatabaseEngine::buildQuery()` `whereExists(...)` |
| Order by / direction | No | **Backend-only** (`orderBy`=`datePublished`\|`title`, `orderDir`=`asc`\|`desc`); no sort control in the stock UI. ⚠ `orderBy=datePublished` **500s on PostgreSQL** (rule 6) | `builderFromRequest()` `orderBy()`; `DatabaseEngine::buildQuery()` order switch |

## Rules & state

The handler is thin: `SearchHandler::index()` and `::search()` are the same code path
(`index` just calls `search`). `search()` builds a **Laravel Scout `Builder`** from the request,
`paginate()`s it through the configured **engine**, assigns the results + the year range + the
searchable-journals list, and displays `frontend/pages/search.tpl`.

1. **The search page and the header entry point.** Every journal header renders a **search link**
   (a magnifying-glass + "Search") pointing at `/search`, shown when a journal is in context and the
   reader is not already on the search page — the default theme has **no inline search box in the
   header**, only this link to the dedicated page. The page itself renders the query box, the
   advanced-filters fieldset, and (below) the results. The page is served with
   `Cache-Control: public` unless the journal restricts site access, so it is CDN-cacheable for
   anonymous readers. **Live-verified 2026-07-05**: the page loads 200 anonymously with a `#query`
   input and the date-range selectors; response carries `cache-control: public`. <sup>a</sup>

2. **What is searched (the query).** The query runs a **fulltext match over four fields — title,
   abstract, galley body, and author names** — of the `submissions_fulltext` index. On MySQL this is a
   native `MATCH … AGAINST` FULLTEXT search; on PostgreSQL it is a `to_tsvector(title‖abstract‖body‖
   authors) @@ plainto_tsquery(query)` match backed by a GIN index. An **empty** query skips the
   fulltext clause and returns every indexed published article. **Live-verified 2026-07-05** (`:8000`,
   Postgres): a title word ("Probe" → 1 hit), an author surname ("Tester" → 25 hits) and an abstract
   word all return the expected articles; body text is searchable in principle but was empty in the
   test index (no proof galleys parsed — rule 7). <sup>b</sup>

3. **Published-only results (the core gate), applied twice.** The engine query restricts to
   submissions that have **a Published publication** (`publications.status = STATUS_PUBLISHED`), and
   then `SubmissionSearchResult::newCollection()` **re-checks** each hydrated result and **drops** any
   whose *current* publication is not Published — so an article that was unpublished after indexing, or
   whose latest version is a draft, never surfaces even if a stale index row exists. Results are
   further decorated (OJS) with an **`issueAvailable`** flag from the issue's subscription state, but
   an unavailable article is still **listed** (its abstract is public); the gate on *opening* the
   galley is owned by `subscription-access`/`article-landing`. **Live-verified**: only published
   articles appear; empty query returned "1 – 25 of 166" published items in publicknowledge. <sup>c</sup>

4. **The filters actually offered.** The stock `search.tpl` exposes exactly **the query**, the
   **date range** (from/to, accessible Y/M/D selectors bounded by the journal's earliest/latest
   publication years), and — **only at the site level** — the **journal picker** (rule 5). The
   date-range filter keeps articles published in `[dateFrom, dateTo)`. Additional structured filters
   (section, category, keyword, subject) exist in the **backend builder** but have **no stock UI**;
   the template exposes a `Templates::Search::SearchResults::AdditionalFilters` hook where a theme or
   plugin can inject them (and a matching `keywords[]`/`subjects[]`/`sectionIds[]`/`categoryIds[]`
   input). This is a deliberate simplification from the pre-3.6 "advanced search" (which offered
   title/author/abstract/discipline/subject/keyword/coverage/type boxes) — that multi-field form is
   **gone**. **Live-verified 2026-07-05**: the only form inputs are `query` + `dateFrom*`/`dateTo*`;
   a future `dateFrom` (2035-01-01) and a past `dateTo` (2000-12-31) each correctly yield **No
   Results**. <sup>d</sup>

5. **Single-journal vs site-wide (cross-journal) scope.** Inside a journal context the query is
   scoped to that journal (`contextId` from the context) and no journal selector appears. At the
   **site** level (`/index/search`, no journal in the URL) the page instead assigns the list of
   **enabled journals** and shows a **journal `<select>`**; with no journal picked the query spans
   **all** contexts, and picking one narrows to it (`contextId` from the `searchContext` request var).
   **Live-verified 2026-07-05**: `/index/en/search` renders the `searchContext` picker and returns
   cross-journal results; `/publicknowledge/en/search` does not. <sup>e</sup>

6. **Ranking / ordering.** The default **DatabaseEngine does not rank by relevance** — it selects the
   matching submission ids `GROUP BY submission_id` with **no `ORDER BY` relevance score**, so results
   come back in **submission-id (insertion) order**, not best-match-first. Explicit ordering is
   supported only via the backend `orderBy` param: `title` (works on both DBs, via a `MIN(title)`
   aggregate) or `datePublished`. ⚠ **`orderBy=datePublished` throws HTTP 500 on PostgreSQL** — the
   `ORDER BY cp.date_published` sits outside the `GROUP BY submission_id` and is neither aggregated nor
   grouped, which MySQL tolerates but Postgres rejects (`SQLSTATE 42803` grouping error). It is not
   reachable from the stock UI (no sort control), so a normal reader cannot trigger it, but any theme/
   plugin/URL that sets `orderBy=datePublished` breaks on Postgres. The optional **OpenSearchEngine**,
   by contrast, **does** rank — a `multi_match` with field boosts (`authors^5`, `titles^4`,
   `abstracts^2`, `bodies`). **Live-verified 2026-07-05**: default order = ascending submission id;
   `orderBy=title` → 200 and reordered; `orderBy=datePublished` → **500** (grouping error confirmed in
   the server log). <sup>f</sup>

7. **The index table + how a row is built.** The index is a **single table `submissions_fulltext`**
   — one row per **(submission, publication, locale)** with columns `title`, `abstract`, `body`,
   `authors` and a fulltext index over all four. The **body** column is the concatenated **galley
   fulltext**: the index job pulls each publication's **proof (galley) files**, runs them through a
   `SearchFileParser` (PDF/HTML/XML/plain-text, via the configured helper programs), and appends the
   extracted text; a galley with no parseable text (or a journal with no proof galleys) leaves `body`
   empty (as in the test data). Titles are the full localized titles; authors are each contributor's
   full name per locale. The pre-3.6 `submission_search_keyword_list` / `submission_search_object` /
   `submission_search_object_keyword` inverted-index tables **no longer exist**; the three legacy
   search hooks (`SubmissionSearch::retrieveResults`, `ArticleSearchIndex::rebuildIndex`,
   `ArticleSearch::getSimilarityTerms`) are registered as **unsupported**. <sup>g</sup>

8. **Indexing is asynchronous, triggered on publish/unpublish.** When a publication is **published or
   unpublished**, the `UpdateSubmissionInSearchIndex` listener (on the `PublicationPublished` /
   `PublicationUnpublished` events) calls the engine's `update()` for the submission. For the
   DatabaseEngine this **synchronously deletes** the submission's existing `submissions_fulltext` rows
   and then **dispatches an `UpdateSubmissionSearchJob`** onto the queue (queue driver = `database`);
   the job later re-extracts and **upserts** the fresh rows (one per locale). So a **just-published
   article does not appear in search until the queue worker runs the job** (`php lib/pkp/tools/jobs.php
   run`, or the scheduled queue-processing task) — though a stock install's default **end-of-request
   JobRunner** (`[queues] job_runner = On`) drains it automatically after each web request, so a
   default install *does* index without a separate OS cron (Open question 3). This is the seam with `publication-publish-flow`
   (which owns the publish transition; this spec owns the index update it triggers). **Live-verified
   2026-07-05**: queue driver is `database`; the test index holds 275 submissions with 0 pending jobs
   (the harness drains the queue), confirming the async round-trip. <sup>h</sup>

9. **Re-index is CLI-only; the "Search Indexing" form is unrelated SEO.** A full rebuild is
   `tools/rebuildSearchIndex.php [journalPath]`: it **flushes** the index (truncates
   `submissions_fulltext` for the DB engine; `deleteIndex`/`createIndex` are real for OpenSearch,
   no-ops for the DB engine), then re-`update()`s every submission (all journals, or one) — which for
   the DB engine re-**queues** an index job per submission, so a queue drain is still needed
   afterwards. There is **no UI re-index / clear-index control**. The atom
   `FORM-pkp-search-indexing-form` (`PKPSearchIndexingForm`, Settings → Distribution → *Search Engine
   Indexing*) is a **crawler-SEO** form — a `searchDescription` and custom `<meta>` `customHeaders`
   for external search engines — and has **nothing to do** with the fulltext index or this page; it is
   **owned by `distribution-settings`**, not this spec (Open question 1, resolved). <sup>i</sup>

10. **No-result behaviour.** When the result set is empty the page renders a single `notice`-style
    message from `search.noResults` ("No Results"); the results list and pagination are suppressed.
    **Live-verified 2026-07-05**: a nonsense query renders "No Results". <sup>j</sup>

11. **Pagination & result render.** Results paginate at the journal's **items-per-page** (default 25;
    config `items_per_page`), showing an "N – M of Total" header and page links that carry the query +
    all filters. Each result renders `frontend/objects/article_summary.tpl` (title, authors, section,
    **published date**, galleys hidden) linking to the article landing page. The `similarDocuments`
    op is **routed but unimplemented** (no handler method) → **404**; it is a dead route, not a
    feature. **Live-verified 2026-07-05**: "1 – 25 of 166" with a second page; `/search/similarDocuments`
    → 404. <sup>k</sup>

12. **Which engine is live.** The engine is chosen by config `[search] driver` (default **`database`**,
    alternative `opensearch`). A stock OJS 3.6 install — and the `:8000` test env — runs the
    **DatabaseEngine**; OpenSearch requires an external cluster plus `opensearch_hosts`/`_username`/
    `_password` config and is opt-in. This spec documents the **DatabaseEngine** as the live default
    and notes OpenSearch's divergences (real ranking, real create/delete index) inline. <sup>l</sup>

<sup>a</sup> `header.tpl` (`{if $currentContext && $requestedPage !== 'search'}` search link); `SearchHandler::setupTemplate()` (`CACHEABILITY_PUBLIC` unless `restrictSiteAccess`); `search.tpl`; live `:8000` ·
<sup>b</sup> `DatabaseEngine::buildQuery()` (`->when($builder->query, fn ($q) => $q->whereFullText(['title','abstract','body','authors'], $builder->query))`); `SubmissionSearchMigration` (`$table->fulltext([...])`); live Postgres GIN `to_tsvector` index ·
<sup>c</sup> `DatabaseEngine::buildQuery()` (`whereIn('s.submission_id', publications status=PUBLISHED)`); `SubmissionSearchResult::newCollection()` (`status != STATUS_PUBLISHED` → skip); OJS `APP\search\SubmissionSearchResult::newCollection()` (`issueAvailable` via `IssueAction`); live 166 published ·
<sup>d</sup> `search.tpl` (`search_advanced` fieldset: `html_select_date_a11y`, `Templates::Search::SearchResults::AdditionalFilters` hook); `builderFromRequest()` (`whereIn('sectionIds'|'categoryIds'|'keywords'|'subjects')`); live future/past date → No Results ·
<sup>e</sup> `SearchHandler::search()` (`$contextId = $context?->getId() ?? (int) getUserVar('searchContext')`, `searchableContexts` only when `!$context`); `builderFromRequest()` same; live `/index` vs `/publicknowledge` ·
<sup>f</sup> `DatabaseEngine::buildQuery()` (order switch: `title` via `orderBy(raw('MIN(title_current.setting_value)'))`, `datePublished` via `orderBy('cp.date_published')` **without** aggregation while `groupBy('s.submission_id')`); `OpenSearchEngine::buildQuery()` (`multi_match` boosts); live `datePublished` → 500 `SQLSTATE[42803]` ·
<sup>g</sup> `SubmissionSearchMigration::up()` (`submissions_fulltext` columns + `fulltext(['title','abstract','body','authors'])` + unique `(submission_id,publication_id,locale)`); `UpdateSubmissionSearchJob::handle()` (galley proof files → `SearchFileParser`, author full names); `PKPApplication` `Hook::addUnsupportedHooks('SubmissionSearch::retrieveResults','ArticleSearchIndex::rebuildIndex','ArticleSearch::getSimilarityTerms')` ·
<sup>h</sup> `UpdateSubmissionInSearchIndex::subscribe()`/`handlePublicationPublished()`/`handleUnpublished()` → `EngineManager::engine()->update()`; `DatabaseEngine::update()` (`$this->delete($models)` then `dispatch(new UpdateSubmissionSearchJob(...))`); `config.inc.php [queues] default_connection = database`; live 275 indexed / 0 pending ·
<sup>i</sup> `rebuildSearchIndex::execute()`; `DatabaseEngine::flush()` (`truncate`), `createIndex()`/`deleteIndex()` (empty for DB engine); `PKPSearchIndexingForm` (`searchDescription`/`customHeaders`) on `management/distribution.tpl` ·
<sup>j</sup> `search.tpl` (`{if $count == 0}` → `notification.tpl messageKey="search.noResults"`); live "No Results" ·
<sup>k</sup> `search.tpl` (`article_summary.tpl … showDatePublished=true hideGalleys=true`, `cmp_pagination`); `SearchHandler::search()` `paginate(..., 'submissions', ...)`; `pages/search/index.php` (`similarDocuments` case → `SearchHandler` with no such method → 404); live 404 ·
<sup>l</sup> `PKPContainer` (`$items['scout']['driver'] = Config::getVar('search','driver','database')`, `EngineManager` `extend('opensearch')`/`extend('database')`); `config.TEMPLATE.inc.php [search] driver = database`

## Side effects

- **Index writes (the only mutations in this feature).** Publishing/unpublishing an article
  synchronously **deletes** its `submissions_fulltext` rows and **queues** an
  `UpdateSubmissionSearchJob` that re-inserts them (DatabaseEngine); the CLI rebuild truncates the
  table and re-queues jobs for every submission. Running a **search performs no writes** (the page is
  a cacheable `GET`).
- **A usage event fires when a result is *opened*, not when it is listed** — that view event lives on
  the article landing page (`article-landing` rule 16), not here; browsing search results emits no
  usage event.
- **No emails or notifications** are sent by search or by indexing.
- **OpenSearch divergence:** with the OpenSearch driver, `update()` writes to the external cluster
  (create doc) and the CLI rebuild actually creates/deletes the OpenSearch index and mapping; the DB
  engine's `createIndex`/`deleteIndex` are no-ops (the schema lives in the migration).

## Settings that modify behavior

- **`config.inc.php [search]`** — `driver` (`database` default | `opensearch`); `search_index_name`
  (the OpenSearch index name); `opensearch_hosts`/`opensearch_username`/`opensearch_password`/
  `opensearch_ssl_verification` (required only for the OpenSearch driver); helper-program paths
  (`index[application/pdf]` etc.) that convert non-text galleys to text for the **body** index (rule
  7); `min_word_length` (a MySQL FULLTEXT concept — on Postgres the dictionary/stopwords apply
  instead) and the legacy `results_per_keyword` (a pre-Scout knob, unused by the current engines).
- **`config.inc.php [interface] items_per_page`** (default 25) — the search results page size (rule 11).
- **`[queues] default_connection = database`** — makes indexing genuinely async; a `sync` driver would
  run the index job inline (rule 8).
- **Journal publishing mode / disabled state** (`OjsJournalMustPublishPolicy`) — gates whether the
  journal's search page is reachable at all.
- **`restrictSiteAccess`** — when set, the search page is **not** marked publicly cacheable (rule 1).
- **Settings → Distribution → Search Engine Indexing** (`searchDescription`, `customHeaders`) — SEO
  crawler hints; **does not** affect this page's search (rule 9).

## Cross-feature interactions

- **article-landing** (feature 38) — owns the article page every result links to; this spec owns the
  search + the result list, and hands off at the article link.
- **publication-publish-flow** (feature 33) — owns publish/unpublish; this spec owns the
  **index-update job** those transitions trigger (rule 8) and the published-only result gate (rule 3).
- **galleys** (feature 26) — owns the galley entity + the proof-file **fulltext extraction**; this
  spec owns the search **over** the extracted `body` text (rule 7).
- **submission-wizard-metadata** / **publication-metadata-references** (features 3 / 25) — own the
  keywords/subjects/section authoring; this spec owns the (backend-only) **filter** over them (rule 4).
- **subscription-access** / **payments** — own the availability gate on *opening* a gated article;
  this spec only surfaces the `issueAvailable` flag on a result and still lists the abstract (rule 3).
- **distribution-settings** (feature 62) — **owns** the *Search Engine Indexing* SEO form
  (`PKPSearchIndexingForm`): the `FORM-pkp-search-indexing-form` atom is **released to it** by the
  verifier (its FEATURE-MAP line already lists `pkp-search-indexing`); this spec only references the
  form to disambiguate the misleading atom name (rule 9, Open question 1 resolved).
- **jobs-queue** / **scheduled-tasks** (features 87 / 89) — own the queue worker that drains the
  `UpdateSubmissionSearchJob`s this feature dispatches.
- **journal-homepage** / **issue-archive-toc** — link *into* the search page from the header.

## Canonical scenarios

1. **Reader searches by a title or author word** — An anonymous reader opens the journal's search
   page, types a word that appears in an article's title (or an author's surname), and submits; the
   results list the matching published articles as summaries (title/authors/section/published date),
   each linking to its article page. (Live-verified: "Probe" → 1 result, author "Tester" → 25.)

2. **Reader finds an article by its abstract / full text** — The reader searches a distinctive word
   that appears only in an abstract (or, where proof galleys are indexed, only in the article body);
   the fulltext index matches it and the article is returned — demonstrating that search covers
   abstract and galley text, not just titles. (Abstract match live-verified; body index empty in the
   test data.)

3. **Reader filters by publication date range** — The reader adds a "published after" and/or
   "published before" date in the advanced-filters fieldset; results narrow to articles published in
   that window. (Live-verified: a future "from" date and a past "to" date each yield No Results.)

4. **A no-match query shows the "No Results" notice** — The reader searches a term no article
   contains; the page shows a single "No Results" notice with no result list and no pagination.
   (Live-verified.)

5. **Site-wide (cross-journal) search with a journal picker** — At the site level (no journal in the
   URL) the reader searches and gets results across all enabled journals, with a journal dropdown to
   optionally scope to one; inside a single journal the same query is already scoped and no picker
   appears. (Live-verified: `/index/search` shows the picker and returns cross-journal hits.)

6. **Only published, indexed articles appear — and indexing is async** — A submission that is
   unpublished, declined, or freshly published-but-not-yet-indexed does **not** appear in results;
   after its publish job is drained from the queue it becomes findable. (Live-verified: 166 published
   results; queue driver `database`, index built by the drained job — a fresh publish is absent until
   the worker runs.)

7. **Administrator rebuilds the fulltext index** — A site admin runs
   `php tools/rebuildSearchIndex.php` (optionally for one journal path); the index is flushed and an
   index job is re-queued per submission, and after the queue drains the search reflects the rebuilt
   index. There is no UI equivalent. (Code-verified; the CLI is the only re-index path.)

## Known deviations (as-built ≠ intent)

- ⚠ **`orderBy=datePublished` returns HTTP 500 on PostgreSQL** (rule 6) — the DatabaseEngine orders by
  a non-aggregated `cp.date_published` under `GROUP BY submission_id`, which MySQL permits but Postgres
  rejects (grouping error). Not reachable from the stock UI (no sort control), so no reader hits it
  today, but any theme/plugin/URL adding a date sort breaks on Postgres. **Propose new ledger row**
  (below). Low severity, cross-DB portability bug; the fix mirrors the `title` branch (aggregate or add
  the column to `GROUP BY`).
- **Latent code note (not a ⚠): the `UpdateSubmissionSearchJob` upsert omits `authors` from its
  conflict-update columns** (`['title','abstract','body']`) (rule 8, `UpdateSubmissionSearchJob::handle()`)
  — masked because `update()` deletes the rows before the job inserts fresh, so the conflict path is
  **never taken under normal operation**; it would only drop an author-index refresh if a stale row
  survived (e.g. two concurrent jobs). Recorded as a code-smell for the maintainer; not user-reachable,
  so no ledger row and no ⚠ (calibrated down by the verifier 2026-07-05).
- **The pre-3.6 multi-field "advanced search" (author/title/abstract/discipline/subject/keyword/
  coverage/type boxes) is gone** — the stock UI now offers only query + date range + (site) journal
  (rule 4). This is an intended 3.6 simplification (the extra filters live in the backend builder and
  can be re-exposed by a plugin), not a bug — recorded so QA does not expect the old form.
- **`similarDocuments` is a dead route** (rule 11) — routed in `pages/search/index.php` but has no
  handler method → 404. Atlas already flags `PAGE-search-similardocuments` as dead; left unclaimed
  (dead-code candidate).

## Open questions

1. **RESOLVED — `FORM-pkp-search-indexing-form` released to `distribution-settings`.**
   `PKPSearchIndexingForm` is the Settings → Distribution *Search Engine Indexing* SEO form
   (`searchDescription` + custom `<meta>` `customHeaders`) and has **no functional link** to the
   fulltext search on this page. The verifier (2026-07-05) **released it to `distribution-settings`**
   (whose FEATURE-MAP line already lists `pkp-search-indexing`) and re-pointed the atlas hint
   accordingly; `site-search` no longer claims it and now owns **4 atoms** (the two search PAGEs, the
   index JOB, the index TABLE). This spec keeps only the rule-9 disambiguation so a reader isn't misled
   by the atom name.

2. **Is the DatabaseEngine's lack of relevance ranking intended?** The default engine returns matches
   in submission-id order with no relevance sort (rule 6), whereas the OpenSearch engine boosts and
   ranks. A reader on a stock install therefore gets no "best match first" ordering. Confirm whether
   the intent is that DB-backed search is deliberately un-ranked (acceptable for small journals) or
   whether a MySQL/Postgres relevance-score `ORDER BY` should be added.

3. **Is a queue worker assumed to be running in a default install?** Indexing is async (rule 8), but a
   stock OJS install ships `[queues] job_runner = On` — a passive **end-of-request JobRunner** that
   drains up to `job_runner_max_jobs` (30) pending jobs after each web request — so a default install
   **does** index newly-published articles *without* a separate OS cron. The "search silently never
   updates" risk therefore only bites if an admin sets `job_runner = Off` **and** configures no queue
   cron (`jobs.php run` / the scheduled queue task). Confirm this is the intended operational contract.
   Calibrated as an Open question, **not** a ⚠, because the default configuration drains the queue.

---

## Reference — entry points & surfaces

| Entry | Path | Atom |
|-------|------|------|
| Search page (form + results) | `search` / `search/index` → `SearchHandler::index` → `SearchHandler::search` → `frontend/pages/search.tpl` | PAGE-search-index |
| Search results (query execution) | `search/search?query=…&dateFrom*=…&dateTo*=…[&searchContext=…]` → `SearchHandler::search` → `SubmissionSearchResult::builderFromRequest` → engine `paginate` | PAGE-search-search |
| Header search link | journal `header.tpl` magnifying-glass → `{url page="search"}` | *(rendered from PAGE-search-index)* |
| Site-wide search | `/index/{lang}/search` (no journal → journal picker) | PAGE-search-index |
| Fulltext index table | `submissions_fulltext` (`SubmissionSearchMigration`) — one row per submission/publication/locale | DB-submissions_fulltext |
| Async re-index job | `UpdateSubmissionSearchJob` (dispatched by `DatabaseEngine::update` on publish/unpublish) | JOB-updatesubmissionsearchjob |
| CLI rebuild | `php tools/rebuildSearchIndex.php [journalPath]` | *(tool; re-queues JOB-updatesubmissionsearchjob)* |
| Search Engine Indexing (SEO) form — *owned by `distribution-settings`* | Settings → Distribution → *Search Engine Indexing* (`PKPSearchIndexingForm`) — **SEO, not the fulltext index**; referenced here only to disambiguate the atom name | FORM-pkp-search-indexing-form *(released)* |
| Dead route | `search/similarDocuments` → 404 (no handler method) | *(PAGE-search-similardocuments — dead, unclaimed)* |

## Reference — code anchors

- **Handler**: `pages/search/SearchHandler.php` (OJS — `authorize()` adds `OjsJournalMustPublishPolicy`)
  extending `lib/pkp/pages/search/SearchHandler.php` (`index()`, `search()`, `_assignDateFromTo()`,
  `setupTemplate()` public cacheability). Router: `pages/search/index.php` (`index`/`search`/
  `similarDocuments` cases).
- **Query builder**: `lib/pkp/classes/search/SubmissionSearchResult.php` (`builderFromRequest()` reads
  query/date/context/section/category/keyword/subject/order; `newCollection()` published-only +
  decorator hooks), `classes/search/SubmissionSearchResult.php` (OJS — `newCollection()` adds
  `issueAvailable`).
- **Engines**: `lib/pkp/classes/search/engines/DatabaseEngine.php` (`buildQuery()`, `search()`,
  `paginate()`, `update()`→job, `delete()`, `flush()`=truncate), `.../OpenSearchEngine.php` (external,
  ranked `multi_match`, real create/delete index). Registered in
  `lib/pkp/classes/core/PKPContainer.php` (`$items['scout']['driver']`, `EngineManager` `extend`).
- **Index job**: `lib/pkp/jobs/submissions/UpdateSubmissionSearchJob.php` (`handle()` — proof-galley
  parse via `SearchFileParser`, author full names, per-locale upsert; `timeout=180`).
- **Index trigger**: `lib/pkp/classes/observers/listeners/UpdateSubmissionInSearchIndex.php`
  (`PublicationPublished`/`PublicationUnpublished` → `engine()->update()`).
- **Index table**: `lib/pkp/classes/migration/install/SubmissionSearchMigration.php` (`submissions_fulltext`).
- **CLI rebuild**: `tools/rebuildSearchIndex.php` (`execute()`).
- **SEO form**: `lib/pkp/classes/components/forms/context/PKPSearchIndexingForm.php`;
  `lib/pkp/templates/management/distribution.tpl` (`FORM_SEARCH_INDEXING`).
- **Templates**: `templates/frontend/pages/search.tpl` (form, filters, results, no-results,
  `Templates::Search::SearchResults::AdditionalFilters`/`::PreResults` hooks),
  `templates/frontend/objects/article_summary.tpl` (result row),
  `lib/pkp/templates/frontend/components/header.tpl` (search link).
- **Config**: `config.TEMPLATE.inc.php [search]` (driver/opensearch/min_word_length/helper programs),
  `[queues] default_connection`, `[interface] items_per_page`.
- **Legacy removal**: `lib/pkp/classes/core/PKPApplication.php`
  (`Hook::addUnsupportedHooks('SubmissionSearch::retrieveResults','ArticleSearchIndex::rebuildIndex','ArticleSearch::getSimilarityTerms')`).
- **Liveness note**: probed live 2026-07-05 as anonymous against `:8000` (`ojs_test`, PostgreSQL) —
  confirmed the page/form, title/author/abstract matching, the date-range filter, the No-Results
  notice, site-wide vs single-journal scope, published-only results, the 404 `similarDocuments`
  route, the async index (queue driver `database`), and the `orderBy=datePublished` Postgres 500
  (SQLSTATE 42803). **Adversarial verifier re-confirmed 2026-07-05** (anonymous, `:8000`, DB driver
  `postgres9`): `orderBy=datePublished` → **500** / `orderBy=title` → **200** (row 102); `/index/en/search`
  renders the `searchContext` picker while `/publicknowledge/en/search` does not; a gibberish query →
  **No Results**; empty query → all published articles paginated 25/page; author "Tester" → 25 hits;
  `similarDocuments` → **404**; `pdftotext`/`index[application/pdf]` commented out in
  `config.test.inc.php` (galley `body` empty here, rule 7); `[queues] job_runner = On` + driver
  `database` (Open question 3).
