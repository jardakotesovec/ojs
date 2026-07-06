---
name: browse-category-section
scope: The anonymous reader's browse-by-category surface — the Browse sidebar block (a category tree) and the category landing page (`/catalog/category/{path}`) that lists a category's published articles, with its subcategory nav, breadcrumb and cover images
shared: pkp-lib   # The catalog handler (PKP\pages\catalog\PKPCatalogHandler) and the query builder (PKP\search\SubmissionSearchResult / DatabaseEngine) live in lib/pkp and are shared with OMP/OPS (OMP is the catalog's native home — monograph catalog); OJS routes them unchanged (pages/catalog/index.php returns the pkp handler directly, no OJS override). The Browse block (plugins/blocks/browse, APP\plugins namespace) is an OJS-app plugin but OMP/OPS ship near-identical copies. The reader templates it renders — templates/frontend/pages/catalogCategory.tpl and the block's block.tpl — are OJS-owned. Tagged pkp-lib to flag the shared handler/builder for a future extraction; the OJS-only pieces are the templates.
status: verified
e2e-plans: [browse-category-section]
atlas-claims:
  - PAGE-catalog-category
  - PAGE-catalog-fullsize
  - PAGE-catalog-thumbnail
  - PLUGIN-blocks-browse
# DB-categories: interim claim transferred to `categories` on 2026-07-06 (that spec now owns the entity; see its Cross-feature interactions)
---

# Browse by category (the Browse block & category landing pages)

## Purpose

A journal can organise its published articles into a tree of **categories** (research areas —
*Applied Science → Computer Science → Computer Vision*, etc.). This spec owns the **anonymous
reader's browse-by-category surface**: the **Browse sidebar block** (`PLUGIN-blocks-browse` — a
navigable category tree that links into each category) and the **category landing page** at
`/{journal}/catalog/category/{categoryPath}` (`PKPCatalogHandler::category`), which shows a
category's **heading, description and cover image**, a **subcategory nav**, a **breadcrumb**, and a
paginated list of that category's **published articles** (each linking to its article landing page).
It is a **read-only, fully public** surface — no login, no forms, no mutations, and (unlike the
issue pages) **not even a usage-statistics event**.

**Liveness note — what "catalog" and "section" mean in OJS.** The `catalog` handler is OMP's native
home (a monograph catalog); OJS reuses only its **category** operations. Establish, precisely:
- **The category landing page + its cover-image ops are LIVE in OJS** (`category`, `fullSize`,
  `thumbnail` — all `type=category`), live-verified 2026-07-05.
- **There is NO reader "section" browse page, and NO by-issue / by-author / by-title browse page.**
  In OJS 3.6 the Browse block renders **only** a category tree (the `block.tpl` template's `@uses`
  docblock still names `browseNewReleases`/`browseSeriesFactory` — new-releases/series — vars, but
  `BrowseBlockPlugin::getContents()` assigns only the category tree). The **section** half of the feature name has
  no dedicated browse landing page: the section concept surfaces as **issue-TOC grouping**
  (`issue-archive-toc`) and as **section policies on the public `/about/submissions` page**
  (`about-pages`) — both cross-referenced, neither owned here.
- **The OMP-oriented `CatalogListPanel` Vue panel is dead in OJS** (parked in `UNASSIGNED.md`
  §Dead-code) — the OJS category page renders Smarty article summaries, not a Vue panel.

It does **not** own category **management** (creating/editing/nesting categories, assigning editors,
the *Sort by* setting, cover-image upload — the `categories` feature); the **articles** the listing
links to (`article-landing`); the **fulltext index** the listing resolves through (`site-search`);
the journal **home page** or the other **sidebar blocks** (`journal-homepage`); or the **section**
entity (`sections`).

## Actors & permissions

Every surface here is **public and anonymous** — there is no per-role UI; what a visitor sees is
governed by the **published state of the content** and the **journal's category configuration**, not
by who they are. Two things differ from the sibling reader pages worth stating once: (1) the category
page carries **only a context-required check** — there is **no journal-must-publish gate** (a
`do-not-publish-online` journal's category page is still reachable, though it would list published
abstracts only; contrast the issue pages, which the must-publish policy locks entirely — Open
question 1); (2) the listing shows an article only when it is **published *and* has been indexed**
(the same async-index dependency as `site-search`, because the listing runs through the fulltext
index). Rows below read *"what any reader sees — and when."* <sup>a</sup>

| Action | Who sees it — and when |
|--------|------------------------|
| **See the Browse block** in the sidebar | • Any visitor — only when the Browse block plugin is **enabled** *and* listed in the journal's **sidebar** array (it is **not** enabled by default); it then shows the journal's **category tree** (nothing if the journal has no categories) <sup>b</sup> |
| **Open a category landing page** (`/catalog/category/{path}`) | • Any visitor, no login — for any category of the journal in context; an **unknown** path is **404**. No publishing-mode gate applies <sup>c</sup> |
| **See an article listed in a category** | • Any visitor — but only an article whose **current publication is Published**, that has been **indexed**, and that is assigned to **this exact category** (a child category's article does **not** roll up to its parent) <sup>d</sup> |
| **View a category's cover image** (full-size / thumbnail) | • Any visitor — when the category has a cover image uploaded; the image is served for `type=category` only (an invalid type errors; a category from another journal is **404**) <sup>e</sup> |

<sup>a</sup> `PKPCatalogHandler::authorize()` adds **only** `ContextRequiredPolicy` (no role gate, no `OjsJournalMustPublishPolicy`); every op serves anonymous ·
<sup>b</sup> `BrowseBlockPlugin::getContents()` (returns '' with no context; assigns `browseCategories` = root categories + nested children); not enabled by default (no `settings.xml`); gated by the sidebar mechanism (`journal-homepage` rules 11–12); live-verified 2026-07-05 on a scratch journal ·
<sup>c</sup> `PKPCatalogHandler::category()` (`Repo::category()->getCollector()->filterByPaths()->filterByContextIds()` → `NotFoundHttpException` when absent); live 2026-07-05 anon — `/catalog/category/applied-science` → 200, `/catalog/category/does-not-exist` → 404 ·
<sup>d</sup> `PKPCatalogHandler::category()` (`$builder->whereIn('categoryIds', [$category->getId()])`); `DatabaseEngine::buildQuery()` (JOIN `submissions_fulltext`; `whereIn` published publications; `publication_categories` whereExists) + `SubmissionSearchResult::newCollection()` (drops non-`STATUS_PUBLISHED` current publications); live 2026-07-05 — a seeded published+indexed article in child *optics* → "1 Items"; its parent *phys* → "0 Items" ·
<sup>e</sup> `PKPCatalogHandler::fullSize()`/`thumbnail()` (`type` switch has only `category`; `category->getContextId() != context` → 404; `PublicFileManager->downloadByPath()`); live — invalid `type=monograph` → 500

## Fields & validation

**N/A — read-only, anonymous browse surface.** These pages present no form and accept no reader
input; there is nothing to validate. Everything shown is display-only, sourced from the **category**
entity (its title/description/image/path/nesting) and the **published articles** assigned to it — all
authored on the editorial side (owner named below). The only reader-supplied values are optional
**query-string** parameters honoured by the shared search builder — `orderBy`/`orderDir`, `query`,
date range, `sectionIds`/`keywords`/`subjects` — none of which the stock category page renders a
control for (they are inherited from `site-search`'s builder; see rule 5).

| Shown on the page | Rendered from | Owned by |
|-------------------|---------------|----------|
| Category title (heading, breadcrumb, block link) | `Category::getLocalizedTitle()` | `categories` |
| Category description | `Category::getLocalizedDescription()` (`strip_unsafe_html`) | `categories` |
| Category cover image (+ thumbnail) | `Category::getImage()` (`uploadName`/`thumbnailName`) via `fullSize`/`thumbnail` ops | `categories` |
| Subcategory links | `Repo::category()->getCollector()->filterByParentIds([id])` | `categories` |
| "Browse titles" count | `$results->total()` (`catalog.browseTitles`) | this spec |
| Article summaries (→ article page) | `SubmissionSearchResult` builder `whereIn('categoryIds')` → `article_summary.tpl` | `article-landing` (linked page); `publication-issue-assignment` (the category assignment) |

## Rules & state

`PKPCatalogHandler` has no state of its own; each op resolves a category (or its cover file),
assembles template variables, and renders a Smarty template. No op writes anything.

**The Browse block (sidebar)**

1. **The Browse block renders the journal's category tree — and nothing else.** When enabled and
   placed in the sidebar, `BrowseBlockPlugin::getContents()` loads the journal's **root categories**
   (`filterByParentIds([null])`) and recursively their **subcategories**, and renders a nested
   navigation list under a *"Browse → Category"* heading; each entry links to
   `/catalog/category/{path}`. If the reader is currently on a category page, that category's link is
   marked **current** (styled, non-clickable). **(stale docs, not a defect) The `block.tpl`
   template's `@uses` docblock still names `browseNewReleases`/`browseSeriesFactory`
   (new-releases/series) vars, but the 3.6 code assigns none of them** — the block is
   **category-only** (a stale template comment, not a user-facing defect; noted so QA doesn't expect
   the old links). The block renders **nothing** off-context and shows an empty tree when the journal
   has no categories.
   *(anchor: `BrowseBlockPlugin::getContents()` (`filterByParentIds([null])`, `formatCategoryData()`,
   `getSubCategories()` recursion, `browseBlockSelectedCategory`); `block.tpl` (`displayCategories`
   recursive function, `plugins.block.browse.category`); live-verified 2026-07-05 — a scratch journal
   with the block enabled + `sidebar=[browseblockplugin]` rendered *Physics* and its nested *Optics*
   with the `is_sub` class)*
2. **The Browse block is not enabled by default, and appears only via the shared sidebar mechanism.**
   The plugin ships **without** a `settings.xml`, so its `enabled` flag is off on a fresh install;
   like every block it renders only when (a) enabled **and** (b) present in the journal's `sidebar`
   array — both owned by `journal-homepage` (sidebar render, rules 11–12) and
   `website-appearance-settings` (the sidebar config). *(anchor: `plugins/blocks/browse/version.xml`
   (no `settings.xml`); `PKPTemplateManager::displaySidebar()`)*

**The category landing page (`/catalog/category/{path}`)**

3. **The page resolves a category by path within the journal, or 404s.** `category()` looks up the
   category by `path` scoped to the current context; a path that matches no category throws a
   **404**. On success it renders `frontend/pages/catalogCategory.tpl`: a **catalog breadcrumb**
   (Home → parent → this), the category **title** heading, a **"N Items"** count
   (`catalog.browseTitles` from the paginator total), the **cover image + description** (each only
   when set), a **subcategory** nav (when the category has children), and the **article list**.
   *(anchor: `PKPCatalogHandler::category()`; `catalogCategory.tpl`; `breadcrumbs_catalog.tpl`;
   live 2026-07-05 — `applied-science` → 200 with h1 *Applied Science* + subcategory links
   *comp-sci*/*eng*; a 3rd-level category (`computer-vision`) also → 200)*
4. **The listing is a category's own published, indexed articles — no subcategory roll-up.** The
   articles come from the shared **search builder** filtered to **this one category id**
   (`whereIn('categoryIds', [$category->getId()])`), so an article shows only when a **published**
   publication of it is assigned to **exactly this** category. An article assigned only to a **child**
   category does **not** appear on the **parent's** page — the parent lists only articles assigned
   directly to it. *(anchor: `PKPCatalogHandler::category()` (single-id `whereIn('categoryIds')`);
   `DatabaseEngine::buildQuery()` (`publication_categories` whereExists for a `STATUS_PUBLISHED`
   publication); live 2026-07-05 — article assigned to *optics* shows on `/optics` (1 Items) but not
   on parent `/phys` (0 Items))*
5. **Published-only, and dependent on the async index — inherited from search.** Because the listing
   runs through `SubmissionSearchResult` → the **`DatabaseEngine`** (a JOIN on the
   `submissions_fulltext` index), an article appears only when it is **indexed** *and* its **current
   publication is Published** (the engine restricts to published publications, and
   `newCollection()` re-drops any result whose current publication is not Published). A
   just-published article is therefore **absent until its index job runs** — the same
   poll-until-indexed caveat as `site-search` (owned there). *(anchor: `DatabaseEngine::buildQuery()`
   (`->join('submissions_fulltext AS ft', …)`, `whereIn('s.submission_id', publications
   status=PUBLISHED)`); `SubmissionSearchResult::newCollection()` (`status != STATUS_PUBLISHED` →
   skip); e2e plan `browse-category-section` row 1's poll-until-indexed note)*
6. **⚠ The category's configured *Sort by* order is ignored — the listing falls to submission-id
   order.** Category management exposes a **"Sort by"** setting (`CategoryForm` `sortOption`, label
   *catalog.sortBy*) choosing how a category's articles are ordered on its page. `category()`
   **computes** that order (`$category->getSortOption() ?: date-published-desc`, then `explode('-')`)
   but **never applies it** to the query builder (the locals are dead), and even assigns the *request*
   `orderBy`/`orderDir` — not the computed ones — to the template. Result order therefore comes
   **only** from a request `?orderBy=` param (rare — the stock page renders no sort control); with
   none, the `DatabaseEngine` returns matches in `GROUP BY s.submission_id` (submission-id/insertion)
   order — not the manager's choice and not even the intended `date_published DESC`. **⚠ And
   `?orderBy=datePublished` throws HTTP 500 on PostgreSQL** — the category page inherits the exact
   `DatabaseEngine` grouping bug that `site-search` owns (e2e ledger [§2 row 102](../../e2e/app-changes.md)).
   *(anchor: `PKPCatalogHandler::category()` (computes `$orderBy`/`$orderDir`, applies neither;
   template gets `$request->getUserVar('orderBy')`); `SubmissionSearchResult::builderFromRequest()`
   (`if ($orderBy = $request->getUserVar('orderBy'))`); `CategoryForm` (`FieldSelect('sortOption')`);
   new e2e ledger [§2 row 103](../../e2e/app-changes.md); live 2026-07-05 — `?orderBy=title` → 200,
   `?orderBy=datePublished` → 500)*
7. **The list paginates at the journal's items-per-page.** Results paginate at the context's
   **items-per-page** (default 25) via `getRangeInfo($request, 'category')`, with page links carrying
   the query/order params. **(minor, not flagged ⚠) The empty-state message is dead code:** the template's
   `{if empty($results)}` "no items" branch never fires because `$results` is always a
   `LengthAwarePaginator` object (never `empty()`), so an empty category shows a **"0 Items"** count
   and an entry-less list rather than the `catalog.category.noItems` message. Cosmetic — the count
   already communicates emptiness; already noted in the e2e plan (row 3). *(anchor:
   `PKPCatalogHandler::category()` (`getRangeInfo`, `paginate`); `catalogCategory.tpl`
   (`{if empty($results)}` unreachable vs the always-rendered `catalog.browseTitles` count);
   live 2026-07-05 — empty *eng* category → "0 Items")*

**Category cover images**

8. **`fullSize` / `thumbnail` serve a category's cover image — category type only.** Each op serves
   the category's uploaded cover (`uploadName` full-size, `thumbnailName` thumbnail) from the
   journal's public files, but **only** for `type=category`; any other `type` value throws (500 in
   OJS — the monograph/representation types are OMP-only), and a category whose `contextId` ≠ the
   current journal is **404**. A category with **no** image still answers 200 but serves nothing
   meaningful (it attempts a download on an empty path). *(anchor: `PKPCatalogHandler::fullSize()` /
   `thumbnail()` (`switch(type){ case 'category': … }`, context-ownership 404, `PublicFileManager`);
   `catalogCategory.tpl` `.cover` links to these ops; live 2026-07-05 — `type=category` (no image) →
   200, `type=monograph` → 500)*

**Read-only guarantee**

9. **Browsing writes nothing and fires no usage event.** Unlike the issue and article pages, the
   category page and cover-image ops emit **no** `UsageEvent` and make no DB mutation, send no email,
   raise no notification. The surface is a pure projection of the category tree + published content.
   *(anchor: `PKPCatalogHandler` (no `event(new UsageEvent(...))` anywhere), contrast
   `IssueHandler::view()` / `ArticleHandler`)*

## Side effects

**None.** Rendering the Browse block, a category page, or a cover image performs **no** writes, sends
**no** email, raises **no** notification, and — notably — emits **no** usage-statistics event (rule
9). The only "state" touched is read: the category tree and, for the listing, the fulltext index
(maintained by `site-search`, not here).

## Settings that modify behavior

Every knob below is configured elsewhere and only **read** here:

- **Browse-block `enabled` + the journal `sidebar` array** — whether the Browse block renders and
  where (rules 1–2). *Owner: `plugin-management` / `website-appearance-settings`; sidebar render
  mechanism owned by `journal-homepage`.*
- **Categories (the tree)** — the categories a journal defines, their titles/descriptions, cover
  images, nesting and paths drive both the block and the landing pages. *Owner: `categories`.*
- **Category *Sort by* (`sortOption`)** — intended to order a category's article list, but **inert on
  the OJS reader page** (rule 6). *Owner: `categories` (the setting); the reader page ignores it.*
- **Category assignment on a publication (`publication_categories`)** — which published articles a
  category lists (rules 4–5). *Owner: `publication-issue-assignment` / `submission-wizard-metadata`.*
- **Items-per-page (`itemsPerPage`)** — the category list's page size (rule 7). *Owner: journal
  setup.*
- **The fulltext index + its async job** — a published article is listable only once indexed (rule
  5). *Owner: `site-search`.*
- **Search engine (`config [search] driver`)** — the default `database` engine is documented here;
  the OpenSearch engine would resolve the same category filter through the external cluster. *Owner:
  `site-search`.*

## Cross-feature interactions

- **categories** (feature 63, written 2026-07-06) — **owns category MANAGEMENT** (CRUD, nesting,
  assigned editors, cover-image upload, the *Sort by* setting, wizard exposure) and the category
  **entity/schema** (`SCHEMA-category`, `DB-categories`, `DB-category_settings` — the `DB-categories`
  interim claim here **transferred to it 2026-07-06**). This spec owns the **reader browse** of that
  taxonomy; `DB-publication_categories` is `publication-issue-assignment`'s.
- **site-search** (feature 42, verified) — **owns the fulltext index + the `SubmissionSearchResult` /
  `DatabaseEngine` builder** this listing resolves through (rules 4–6). The category page reuses that
  builder with a `categoryIds` filter; the published-only gate, the async-index dependency, and the
  `orderBy=datePublished` Postgres 500 (ledger row 102) all live there. Distinct surface — search is
  a query box, this is a category tree.
- **journal-homepage** (feature 36, verified) — **owns the sidebar render mechanism** and the other
  block plugins; it **left `PLUGIN-blocks-browse` for this spec** (now claimed here). It can also show
  a **category listing** on the home page (`JournalContentOption::CATEGORY_LISTING` theme option) — a
  distinct home-page surface, not this category page.
- **article-landing** (feature 38, verified) — owns the article page each category-list entry links
  to.
- **issue-archive-toc** (feature 40, verified) — its OQ3 (RESOLVED) established `PLUGIN-catalog` is a
  phantom and the `PAGE-catalog-*` atoms belong here; also owns **section grouping** in the issue TOC
  (one of the two places the "section" concept surfaces — there is no section *browse* page).
- **about-pages** (feature, not written) — owns the public `/about/submissions` page where **section
  policies** render (the other place "section" surfaces; the e2e plan's test 4 exercises it under this
  feature's spec file for convenience, but the page is about-pages territory).
- **sections** (feature, not written) — owns the **section entity** (`DB-sections`,
  `SCHEMA-section-*`); referenced, not claimed.
- **publication-issue-assignment** (feature 39, verified) — owns `DB-publication_categories` (the
  article↔category mapping) that decides what a category lists.

## Canonical scenarios

1. **Reader opens the Browse block and picks a category** — On a journal whose sidebar includes the
   (enabled) Browse block, an anonymous reader sees a **Browse** panel listing the journal's category
   tree (root categories with their subcategories nested). Clicking a category navigates to its
   landing page; the current category is highlighted and non-clickable. *(live-verified 2026-07-05 on
   a scratch journal — the block rendered *Physics* and nested *Optics* linking to
   `/catalog/category/{path}`.)*
2. **Reader browses a category and sees its published articles** — An anonymous reader opens
   `/catalog/category/{path}`: the page shows the category title, an *"N Items"* count, any cover
   image/description, and a paginated list of the category's **published** articles as summaries, each
   linking to its article landing page. *(live-verified 2026-07-05 — a seeded published+indexed
   article assigned to *optics* rendered as "1 Items" with one article summary; empty categories on
   `publicknowledge` rendered "0 Items".)*
3. **Nested categories: subcategory nav, breadcrumb, and no parent roll-up** — On a parent category
   page the reader sees its **subcategories** as links and a **breadcrumb** back to Home; opening a
   child shows a breadcrumb linking back up to the parent. An article assigned **only to the child**
   appears on the child's page but **not** on the parent's. *(live-verified 2026-07-05 — *phys* lists
   subcategory *optics* and breadcrumbs; the *optics*-only article shows "1 Items" on *optics* and
   "0 Items" on parent *phys*; a 3rd-level category also resolves 200.)*
4. **Only published, indexed articles appear** — A submission that is unpublished, declined, or
   freshly published-but-not-yet-indexed does **not** appear on its category page; after its index job
   drains from the queue it becomes listable — the same async-index behaviour as site search.
   *(mechanism verified via the shared builder; the seeded article was already indexed when probed —
   0 pending jobs.)*
5. **Category cover images render at full size and thumbnail** — A category with an uploaded cover
   shows the thumbnail on its page, linking to the full-size image; both are served by the
   `thumbnail`/`fullSize` catalog ops for `type=category`. A category from another journal is a 404,
   and an invalid image type errors. *(cover ops liveness verified 2026-07-05 — `type=category` → 200,
   `type=monograph` → 500; a populated cover was not seedable via the scenario API, so the rendered
   image itself is code-derived.)*
6. **A missing category 404s; a category's Sort-by setting has no effect** — Requesting
   `/catalog/category/does-not-exist` returns **404**. A manager who sets a category's *Sort by* order
   sees the reader page **ignore** it — the list defaults to submission-id order (and any URL adding
   `?orderBy=datePublished` breaks with a Postgres 500). *(404 live-verified 2026-07-05; the
   Sort-by-ignored finding is confirmed live by the retained test — two published articles seeded via
   the `publications[].categories` passthrough (A: low-id/"Zzz"/earlier date, B: high-id/"Aaa"/later
   date) list as `[A, B]` submission-id order despite the category's `sortOption=title-ASC`, ignoring
   both the title sort and the date-desc default — with the request-order path (`?orderBy=title` →
   200) and the Postgres 500 (`?orderBy=datePublished` → 500) both live-verified.)*

## Known deviations (as-built ≠ intent)

- ⚠ **A category's configured *Sort by* order is ignored on the reader page (rule 6) — new e2e
  ledger [§2 row 103](../../e2e/app-changes.md).** Category management offers a *Sort by* control, but
  `PKPCatalogHandler::category()` computes the order and never applies it to the query — the manager's
  choice has no effect for OJS readers (default = submission-id order). UI-affordance contradiction,
  no data loss. The computed `$orderBy` is provably unused, and the **retained test observes it live**
  — two published articles (A: low-id/"Zzz"/earlier date, B: high-id/"Aaa"/later date) list as
  `[A, B]` submission-id order, ignoring both the seeded title-ASC sort and the date-desc default. OMP's
  own catalog handler may apply it, but the OJS-served `PKPCatalogHandler` does not. Fix: pass the
  computed order into the builder.
- ⚠ **(pointer, not owned here) `orderBy=datePublished` → HTTP 500 on PostgreSQL (rule 6) — e2e
  ledger [§2 row 102](../../e2e/app-changes.md).** The category page inherits the `DatabaseEngine`
  grouping bug whose canonical home is `site-search`; not reachable from the stock category UI (no
  sort control) but any theme/plugin/URL adding a date sort breaks it. Referenced, not re-owned.
- **(minor, not flagged ⚠) The empty-category "no items" message is dead code (rule 7).** `{if empty($results)}`
  never fires against the `LengthAwarePaginator`, so an empty category shows a "0 Items" count and an
  entry-less list instead of `catalog.category.noItems`. Cosmetic — the count already communicates
  emptiness; already noted in the e2e plan (row 3). No new ledger row (no user-visible harm).
- **(documentation, not a defect) The Browse block's template advertises stale `@uses` vars (rule 1).**
  `block.tpl`'s `@uses` docblock still names `browseNewReleases`/`browseSeriesFactory`
  (new-releases/series) that the 3.6 code no longer assigns — it is category-only. Stale template
  comment, not a user-facing bug; noted so QA doesn't expect the old links.

## Open questions

1. **Should the category page be gated by the journal's publishing mode?** As-built, `authorize()`
   adds only `ContextRequiredPolicy` — **no** `OjsJournalMustPublishPolicy` — so a
   *do-not-publish-online* journal's category page is still reachable (it would list published
   abstracts only), unlike the issue pages which the must-publish policy locks entirely. Confirm
   whether this inconsistency is intended or the category page should also be must-publish-gated.
   (Not probed on a `NONE` journal live; code-derived from the policy list.)
2. **RESOLVED (2026-07-06) — Atom seam: `DB-categories` ownership transferred.** The `categories`
   management spec is now written and owns `DB-categories` (+ `SCHEMA-category`,
   `DB-category_settings`); this spec retains only the reader browse and references the taxonomy.
   `DB-publication_categories` stays with `publication-issue-assignment`.
3. **Is the category *Sort by* setting meant to work in OJS at all, or is it OMP-only?** Rule 6 shows
   it is inert on the OJS reader page. If the intent is OMP-only (OJS categories are unordered
   research-area filters), the setting should perhaps be hidden in OJS category management rather than
   offered-but-ignored. Maintainer intent call.

---

<!-- REFERENCE MATERIAL — provenance and campaign bookkeeping, not product-owner narrative. -->

## Reference — entry points & surfaces

| Entry | Path | Atom |
|-------|------|------|
| Category landing page | `GET /{journal}/catalog/category/{path}[/{page}]` → `PKPCatalogHandler::category()` → `frontend/pages/catalogCategory.tpl` | PAGE-catalog-category |
| Category cover — full size | `GET /{journal}/catalog/fullSize?type=category&id={id}` → `PKPCatalogHandler::fullSize()` | PAGE-catalog-fullsize |
| Category cover — thumbnail | `GET /{journal}/catalog/thumbnail?type=category&id={id}` → `PKPCatalogHandler::thumbnail()` | PAGE-catalog-thumbnail |
| Browse sidebar block | `plugins/blocks/browse` → `BrowseBlockPlugin::getContents()` → `block.tpl` (rendered via the sidebar mechanism) | PLUGIN-blocks-browse |
| Category taxonomy entity (referenced) | `categories` (+ `category_settings`, read here) | *(DB-categories — owned by `categories` since 2026-07-06)* |
| Article↔category mapping (referenced) | `publication_categories` | *(DB-publication_categories — owned by `publication-issue-assignment`)* |
| Section policies on `/about/submissions` (NOT here) | `about-pages` | *(cross-reference; e2e plan test 4)* |
| OMP catalog list panel (dead in OJS) | `CatalogListPanel.vue` — no OJS mount | *(VUE-catalog-list-panel — UNASSIGNED §Dead-code)* |

## Reference — code anchors

- **Handler**: `lib/pkp/pages/catalog/PKPCatalogHandler.php` — `authorize()` (`ContextRequiredPolicy`
  only), `category()` (path lookup → 404; `getSortOption` computed-but-unused; `builderFromRequest` +
  `whereIn('categoryIds')` + `getRangeInfo('category')` + `paginate`; OMP-only `featured` order
  branch gated by `Application::getName()=='omp'`), `fullSize()` / `thumbnail()` (`type=category` only,
  context-ownership 404, `PublicFileManager`). Router: `pages/catalog/index.php`
  (`category`/`fullSize`/`thumbnail` → the pkp handler; **no OJS override**).
- **Browse block**: `plugins/blocks/browse/BrowseBlockPlugin.php` (`getContents()`,
  `formatCategoryData()`, `getSubCategories()` recursion; `catalogPage` = `catalog` (OJS) /
  `preprints` (OPS)); `plugins/blocks/browse/templates/block.tpl` (recursive `displayCategories`);
  `plugins/blocks/browse/version.xml` (no `settings.xml` → not enabled by default). Extends
  `lib/pkp/classes/plugins/BlockPlugin.php`.
- **Query builder** (shared with `site-search`): `lib/pkp/classes/search/SubmissionSearchResult.php`
  (`builderFromRequest()` — reads `orderBy`/`orderDir`/`categoryIds`/…; `newCollection()`
  published-only re-check), `lib/pkp/classes/search/engines/DatabaseEngine.php` (`buildQuery()` —
  `submissions_fulltext` JOIN, published-publication filter, `publication_categories` whereExists,
  the `datePublished` Postgres-500 order branch).
- **Templates**: `templates/frontend/pages/catalogCategory.tpl` (OJS-owned — heading, count,
  cover/description, subcategory nav, `article_summary.tpl` list, the dead `{if empty($results)}`
  branch); `lib/pkp/templates/frontend/components/breadcrumbs_catalog.tpl` (Home → parent → current;
  a pkp-lib template resolved through the frontend template stack).
- **Category management (referenced)**: `lib/pkp/classes/category/Category.php` (`getSortOption()`),
  `lib/pkp/classes/components/forms/context/CategoryForm.php` (`FieldSelect('sortOption')`,
  `catalog.sortBy`), `lib/pkp/schemas/category.json` (`SCHEMA-category` — owned by `categories`).
- **Liveness (2026-07-05, anonymous, port 8000, `ojs_test`, PostgreSQL)**: category page
  `/publicknowledge/en/catalog/category/applied-science` → 200 (h1, breadcrumb, subcategory links
  *comp-sci*/*eng*), `computer-vision` (3rd level) → 200, `does-not-exist` → 404, empty *eng* → "0
  Items". Scratch journal `browsecatprobe` (Browse block enabled + `sidebar=[browseblockplugin]`):
  home renders the Browse block with *Physics* + nested *Optics*; a seeded published+indexed article
  assigned to *optics* → `/catalog/category/optics` "1 Items", parent `/phys` "0 Items";
  `?orderBy=title` → 200, `?orderBy=datePublished` → 500; cover ops `type=category` → 200,
  `type=monograph` → 500. The retained `browse-category-section.spec.js` (6 tests, green ×2; re-run
  2026-07-05) now drives category **assignment** and multi-row **order** through the
  `publications[].categories` passthrough — two published articles list in submission-id order,
  ignoring the seeded `sortOption=title-ASC` (row 103). Only the category **cover render** stays
  code-derived (the scenario API seeds no cover image; the spec author's manual probe set one via a
  direct file insert on the scratch journal).
