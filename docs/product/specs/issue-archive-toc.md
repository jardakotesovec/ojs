---
name: issue-archive-toc
scope: The reader-facing issue pages (`IssueHandler` at `/issue/*`) — the paginated back-issue archive, the current-issue redirect, the single-issue table of contents (articles grouped by section, plus the issue cover/description/DOI/published-date and full-issue galleys), and the reader download of a full-issue galley
shared: no          # Issues are an OJS-only concept: the reader IssueHandler (APP\pages\issue\IssueHandler), its router (pages/issue/index.php), and the OJS templates it renders (frontend/pages/issue.tpl, issueArchive.tpl, frontend/objects/issue_toc.tpl / issue_summary.tpl) have no OMP/OPS equivalent (OMP readers use the catalog/monograph pages; OPS the preprint server). It reuses shared lib/pkp frontend partials (galley_link.tpl, pagination.tpl) and the OjsJournalMustPublish/OjsIssueRequired policies, which are OJS-app classes.
status: verified
e2e-plans: [issue-archive-toc]
atlas-claims:
  - PAGE-issue-index
  - PAGE-issue-current
  - PAGE-issue-archive
  - PAGE-issue-view
  - PAGE-issue-download
---

# Issue archive & table of contents (the reader's issue pages)

## Purpose

A journal's published articles are collected into **issues**, and this spec owns the **reader-facing
issue pages** — everything under `/{journal}/issue/*`, served by `IssueHandler`. An anonymous reader
can: **browse the back-issue archive** (`/issue/archive` — a paginated list of every published issue);
**jump to the current issue** (`/issue`, `/issue/current` — which redirects to the current issue's TOC,
or shows a *"no current issue"* placeholder); **read a single issue's table of contents**
(`/issue/view/{id}` — the issue's articles **grouped by section**, plus the issue **cover image**,
**description**, **DOI/public identifiers**, **published date**, and any **full-issue galleys**); and
**download a full-issue galley** (`/issue/download/{id}/{galleyId}` — a PDF/file covering the whole
issue). Every article in the TOC links out to its **article landing page** (owned by `article-landing`).
It is a **read-only, public** surface: it *renders* what the editorial **issue-management** feature
builds (the issue entity, its cover/description/galleys, its custom article/section order, which issue
is current) and never mutates anything — the only side effect is a usage-statistics event on an issue
view or galley download.

## Actors & permissions

The issue pages are **public and anonymous** — there is no per-role UI; what a visitor sees is governed
by **the published state of the content** and the **journal's publishing mode**, not by who they are.
Three baselines apply to every row. **Anonymous reader** — the default actor, no login. **Journal
must publish online** — the entire handler is gated by `OjsJournalMustPublishPolicy`; a journal set to
*do not publish online* makes *every* issue page unreachable. **Editorial pre-publication access** —
a site admin, journal manager, assigned sub-editor or assistant may additionally reach an
**unpublished** issue's TOC and galleys (a preview); everyone else may reach **published** issues only.
Full-issue galley **download** is further subject to the journal's **subscription / payment** gate,
owned by `subscriptions` / `payments`; this spec owns the reader link and the gate's entry points. <sup>a</sup>

| Action | Who may — and when |
|--------|--------------------|
| **Browse the back-issue archive** (`/issue/archive`) | • Any visitor — lists only **published** issues, paginated; an out-of-range page is **not-found**; a journal that does not publish online is unreachable <sup>b</sup> |
| **Open the current issue** (`/issue`, `/issue/current`) | • Any visitor — redirected to the current issue's TOC when the journal has a current issue; otherwise shown a *"no current issue"* placeholder page <sup>c</sup> |
| **Read a single issue's table of contents** (`/issue/view/{id}`) | • Any visitor — any **published** issue of the journal<br>• Editorial pre-publication user — additionally an **unpublished** issue, shown with a *preview* banner<br>• A non-existent or unpublished issue is **denied** to the public — an anonymous visitor is **redirected to login** (not a 404, unlike the article page — the framework default-deny; Open question 2) <sup>d</sup> |
| **Download a full-issue galley** (`/issue/download/{id}/{galleyId}`) | • Any visitor — for a published issue whose access is open / the reader is subscribed / has purchased it; otherwise the click routes to **login / subscribe / purchase** instead of the file<br>• Editorial pre-publication user — bypasses the gate (may download an unpublished issue's galley) <sup>e</sup> |

<sup>a</sup> `IssueHandler::authorize()` (`ContextRequiredPolicy` + `OjsJournalMustPublishPolicy` + `OjsIssueRequiredPolicy` on `view`/`download`); `IssueHandler::userCanViewGalley()`; `IssueAction::allowedIssuePrePublicationAccess()` ·
<sup>b</sup> `IssueHandler::archive()` (`filterByPublished(true)`, pagination, `NotFoundHttpException` when a paged offset yields no issues); live 2026-07-05 anonymous — `/issue/archive` 200, `/issue/archive/5` 404 ·
<sup>c</sup> `IssueHandler::index()`→`current()` (`Repo::issue()->getCurrent()` → redirect to `view`, else render `issue.tpl` placeholder); live — `/issue`, `/issue/current` both 302 → `/issue/view/1` ·
<sup>d</sup> `OjsIssueRequiredPolicy::dataObjectEffect()` (DENY on missing/unpublished issue unless the user holds SITE_ADMIN/MANAGER/SUB_EDITOR/ASSISTANT); `issue_toc.tpl` preview notice (`editor.issues.preview`); live — `/issue/view/99999` (missing) → 302 → login, `/issue/view/1` (published) → 200 ·
<sup>e</sup> `IssueHandler::download()` / `userCanViewGalley()` (subscription/domain/purchase/membership checks, `redirectLogin`, queued issue-purchase payment); gate owned by `subscriptions` / `payments`

## Fields & validation

**N/A — read-only reader render.** The issue pages present no form and accept no reader input; there is
nothing to validate. Every value shown is display-only, sourced from the **issue** entity, its
**sections**, and the **publications** assigned to it — all authored on the editorial side (owner named
below). What the reader sees, and who owns the source:

| Shown on the page | Rendered from | Owned by |
|-------------------|---------------|----------|
| Issue identification (Vol./No./Year/Title) | `Issue::getIssueIdentification()` / `getLocalizedTitle()` | `issue-management` |
| Issue cover image (+ alt text) | `Issue::getLocalizedCoverImageUrl()` / `…AltText()` | `issue-management` |
| Issue description | `Issue::getLocalizedDescription()` (`strip_unsafe_html`) | `issue-management` |
| Issue DOI / public identifiers | `Issue::getData('doiObject')`, `getStoredPubId()` + `pubIdPlugins` | `doi-management` / `publication-identifiers` |
| Published date | `Issue::getDatePublished()` (`dateFormatShort`) | `issue-management` |
| Full-issue galleys ("Full Issue" links) | `IssueGalleyDAO::getByIssueId()` | `issue-management` (entity) / this spec (reader link) |
| Sections (headings) + their order | `Repo::section()->getByIssueId()` (custom-section-order fallback) | `journal-sections` / `issue-management` (custom order) |
| Articles per section (summaries → article page) | `Repo::submission()->getCollector()->filterByIssueIds()` | `article-landing` (the linked page); `publication-issue-assignment` (the assignment) |
| Archive back-issue list + pagination | `Repo::issue()->getCollector()->filterByPublished(true)`, `itemsPerPage` | this spec |

## Rules & state

`IssueHandler` has no state of its own; each op resolves an issue (or a page of issues), assembles
template variables, and renders a Smarty template. `view`/`download` require a valid issue
(`OjsIssueRequiredPolicy`); every op requires a journal that publishes online.

**Routing & the current-issue redirect**

1. **`/issue` and `/issue/current` are the same op, and redirect to the current issue.** `index()`
   simply calls `current()`, which reads the journal's **current issue** pointer and, if set,
   **redirects** to `/issue/view/{bestIssueId}`. When the journal has **no** current issue, it instead
   renders `frontend/pages/issue.tpl` with no issue — a *"No Current Issue"* heading + warning notice.
   *(anchor: `IssueHandler::index()`→`current()`; `Repo::issue()->getCurrent()` (reads
   `journals.current_issue_id`); `issue.tpl` `{if !$issue}` → `current.noCurrentIssue`; live 2026-07-05 —
   both ops 302 → `/issue/view/1`)*
2. **The whole handler is gated on the journal publishing online.** `OjsJournalMustPublishPolicy`
   denies every issue op on a journal whose publishing mode is *do not publish online* — the archive,
   current and view pages all become unreachable, independent of the content's own published state.
   *(anchor: `IssueHandler::authorize()` (`OjsJournalMustPublishPolicy`))*
3. **A single issue is viewable only when published — else the public is bounced to login.**
   `OjsIssueRequiredPolicy` permits `view`/`download` only when the id resolves to a real issue of this
   journal **and** that issue is **published**, *or* the user holds an editorial role (site admin,
   manager, sub-editor, assistant) with pre-publication access. A **missing** id, an id from another
   journal, or an **unpublished** issue is **denied**; for an anonymous visitor a denied issue page
   **redirects to the login screen** — **not** a 404. This is the **framework-standard deny** for
   *every* required-data-object page (a failed `authorize()` → `PKPPageRouter::handleAuthorizationFailure()`
   → `Validation::redirectLogin()`), so it is not issue-page-specific; the **article landing page is the
   outlier** that explicitly 404s a non-existent/unpublished article from its own handler
   (`ArticleHandler::initialize()`). Whether the issue page *should* likewise 404 is a maintainer intent
   call, kept as **Open question 2** (a plain rule, not asserted as a bug). *(anchor:
   `OjsIssueRequiredPolicy::dataObjectEffect()` (`getByBestId`; published-or-editorial gate);
   `getDataObjectId()` (numeric id or urlPath); `PKPHandler::authorize()`/`PKPPageRouter::handleAuthorizationFailure()`
   → `Validation::redirectLogin()`; live 2026-07-05 anon — `/en/issue/view/99999999` → 302 →
   `/en/login?source=…`)*

**The single-issue table of contents (`/issue/view/{id}`)**

4. **The view page renders the issue's TOC (or streams a galley).** `view()` loads the authorized
   issue and displays `frontend/pages/issue.tpl` → `frontend/objects/issue_toc.tpl`. If the URL carries
   a **galley** segment (`/issue/view/{id}/{galleyId}`) and the reader may access it, the op instead
   **redirects to the download** op (rule 9). An **unpublished** issue being previewed shows a
   *"This is a preview…"* warning banner at the top of the TOC. *(anchor: `IssueHandler::view()`
   (galley → `download` redirect, else `setupIssueTemplate()` + display); `issue_toc.tpl` preview notice
   `editor.issues.preview`)*
5. **The TOC heading shows the issue's cover, description, identifiers and published date.** Above the
   articles, `issue_toc.tpl` renders (each only when present): the localized **cover image** (with alt
   text, defaulting to the issue identification), the **description** (sanitized HTML), any **public
   identifiers** (e.g. URN) and the **DOI** as a resolving link, and the **published date**. **Live
   2026-07-05**: `publicknowledge` issue 1 renders the `obj_issue_toc` heading + published date but has
   no cover/description/DOI/galleys set. *(anchor: `issue_toc.tpl` (`.heading`: `getLocalizedCoverImageUrl`,
   `hasDescription`, `pubIdPlugins`/`doiObject`, `getDatePublished`); `IssueHandler::current()`/`view()`
   assign `pubIdPlugins`)*
6. **Articles are grouped by section, in the issue's section order.** `setupIssueTemplate()` fetches the
   issue's **sections** via `Repo::section()->getByIssueId()` — which returns only sections that actually
   have a qualifying article in the issue, **ordered by** `COALESCE(custom_section_orders.seq,
   sections.seq)` (i.e. the editor's per-issue custom section order from `issue-management`, falling back
   to the section's own sequence). Each section renders as a group with its heading and its articles.
   *(anchor: `IssueHandler::setupIssueTemplate()` (`Repo::section()->getByIssueId()`);
   `section/DAO::getByIssueId()` (`COALESCE(o.seq, s.seq)` over `custom_section_orders`); `issue_toc.tpl`
   `.sections` foreach)*
7. **Within a section, articles render in publication-sequence order — which is undefined until an
   editor orders the TOC.** The issue's submissions are collected `filterByIssueIds([id])` ordered by
   `ORDERBY_SEQUENCE` (the publication's `seq`) ascending and bucketed into their section. ⚠ Because
   nothing stamps `publications.seq` on issue-assignment/publish (schema default 0), same-section
   articles tie at seq 0 and fall in **arbitrary DB order** until an editor uses the editorial custom-TOC
   ordering (owned by `issue-management`). This is the reader render of e2e ledger **row 28**; its
   canonical home is **here**. *(anchor: `IssueHandler::setupIssueTemplate()` (submission collector
   `ORDERBY_SEQUENCE` ASC); `frontend/objects/article_summary.tpl` per article; ledger
   [§2 row 28](../../e2e/app-changes.md))*
8. **Only published articles appear (published issue) / scheduled+published (preview).** For a
   **published** issue, an article shows in the TOC only when its **current publication is Published**
   and it has a section; for an **unpublished** issue being previewed, **Scheduled or Published**
   publications show. A publication with no section is skipped. *(anchor:
   `IssueHandler::setupIssueTemplate()` (status filter: published issue → `STATUS_PUBLISHED`; unpublished
   → `STATUS_SCHEDULED`/`STATUS_PUBLISHED`; `!$sectionId` → skip))*
9. **A section whose title is hidden renders its articles with no heading.** When a section is marked
   *hide title*, its heading is suppressed (the section still lists its articles); *hide author* likewise
   omits author names. **Live 2026-07-05**: `publicknowledge` issue 1's single section renders with no
   `<h2>` heading (title hidden). *(anchor: `IssueHandler::setupIssueTemplate()` (`getHideTitle()` →
   `title = null`, `getHideAuthor()`); `issue_toc.tpl` `{if $section.title}` guards the heading)*

**Full-issue galleys**

10. **A "Full Issue" galley list renders when the issue has galleys, each a subscription-gated link.**
    When `IssueGalleyDAO::getByIssueId()` returns galleys, `issue_toc.tpl` renders a *"Full Issue"*
    section listing each via the shared `galley_link.tpl` (with the issue's purchase fee/currency).
    Clicking a galley hits `view` with a galley id → redirect to `download`, or the direct
    `/issue/download/{id}/{galleyId}` route. ⚠ Every issue-galley link's accessible name is fixed to
    *"Full Issue"* (a shared `labelledBy`), so multiple galleys are indistinguishable to assistive tech
    (e2e ledger **row 29b**, a11y; pointer only). `publicknowledge` issue 1 has no issue galleys, so this
    was not live-observable. *(anchor: `issue_toc.tpl` `.galleys` (`issue.fullIssue`, `galley_link.tpl`
    `parent=$issue labelledBy="issueTocGalleyLabel"`); ledger [§2 row 29](../../e2e/app-changes.md))*
11. **Downloading a full-issue galley streams the file through the subscription/payment gate.**
    `download()` calls `userCanViewGalley()` and, when allowed, streams the galley file
    (`IssueFileManager::downloadById`, optionally `inline`). `userCanViewGalley()` allows: an editorial
    pre-publication user (unconditional); otherwise, for a **published** issue, an open-access issue / a
    subscribed domain / a valid user subscription / a completed issue-purchase / active membership. When
    access is missing it **redirects to login** (if `restrictArticleAccess` or a subscription is
    required) or **queues an issue-purchase payment** and shows the payment form (if issue-purchase /
    membership is enabled); a *PDF-only* restriction frees non-PDF galleys. An **unpublished** issue's
    galley redirects a non-editorial reader to the journal index. *(anchor: `IssueHandler::download()`,
    `userCanViewGalley()` (`IssueAction::subscriptionRequired`/`subscribedUser`/`subscribedDomain`,
    `OJSCompletedPaymentDAO::hasPaidPurchaseIssue`, `OJSPaymentManager` purchase-issue flow))*

**The archive listing (`/issue/archive`)**

12. **The archive is a paginated list of published back issues.** `archive()` loads **published** issues
    (`filterByPublished(true)`) for the journal, `itemsPerPage` per page (falling back to the
    `interface.items_per_page` config), rendering each via `issue_summary.tpl` with prev/next pagination
    and a *"Showing N–M of T"* line. Page 1 with no issues shows a *"no issues published"* message; a
    **paged** URL (offset > 0) that yields no issues throws **404**. **Live 2026-07-05**: `/issue/archive`
    → 200 listing Vol. 1 No. 2 (2014); `/issue/archive/5` → 404. *(anchor: `IssueHandler::archive()`
    (`getCollector()->limit/offset->filterByPublished(true)->orderBy(ORDERBY_SEQUENCE)`;
    `NotFoundHttpException` when `!count($issues) && $offset`); `issueArchive.tpl`;
    `frontend/components/pagination.tpl`)*
13. **⚠ The archive's back-issue order is undefined until an editor manually orders the Back Issues
    list.** The archive orders **solely** by `custom_issue_orders.seq ASC` with **no** date/current
    tiebreaker. On a journal that has never dragged its Back Issues list, `custom_issue_orders` is empty
    (the resequence routine early-returns when no ordering exists, and publishing never seeds a row), so
    every issue's sequence is NULL and the archive falls to **arbitrary DB order** rather than
    newest-first — unlike the editorial Back-Issues grid and the OAI feed, which fall back to
    current-first + `date_published DESC`. Code-derived (the test journal has one published issue, so
    multi-issue order was not live-observable); e2e ledger **row 101**. *(anchor:
    `Collector::orderBy()` (`ORDERBY_SEQUENCE` = single `o.seq ASC`; contrast `ORDERBY_PUBLISHED_ISSUES`);
    `issue/DAO::resequenceCustomIssueOrders()` (early return); ledger [§2 row 101](../../e2e/app-changes.md))*

**Usage statistics**

14. **Viewing an issue and downloading an issue galley each fire a usage event.** A single-issue **view**
    emits a `UsageEvent` for the issue (`ASSOC_TYPE_ISSUE`); a **galley download** emits one for the
    issue galley (`ASSOC_TYPE_ISSUE_GALLEY`). The archive and current-issue-redirect pages fire no such
    event. These feed `usage-statistics`. There are **no** other side effects — no emails, notifications,
    or DB mutations. *(anchor: `IssueHandler::view()` (`event(new UsageEvent(ASSOC_TYPE_ISSUE, …))`),
    `download()` (`ASSOC_TYPE_ISSUE_GALLEY`))*

## Side effects

- **Usage events (stats):** an issue **view** emits an `ASSOC_TYPE_ISSUE` usage event; an issue-galley
  **download** emits an `ASSOC_TYPE_ISSUE_GALLEY` event (rule 14). Both feed `usage-statistics`. No event
  fires for the archive listing or the current-issue redirect.
- **Queued payment (galley purchase):** when a reader without access opens a full-issue galley on a
  journal with issue-purchase/membership enabled, a **queued issue-purchase payment** is created and the
  payment form shown (rule 11) — the only "write" this feature triggers, and it is owned by `payments`.
- **No emails, notifications, or content mutations** — every issue page is read-only.

## Settings that modify behavior

- **`itemsPerPage`** (journal setting) — how many issues per archive page; falls back to the
  `interface.items_per_page` config value (rule 12). *Owner: journal setup.*
- **`publishingMode`** (journal setting) — *do not publish online* makes **all** issue pages unreachable
  (rule 2). *Owner: `journal-setup` / `distribution-settings`.*
- **`currentIssueId`** (journal pointer) — which issue `/issue/current` redirects to (rule 1). Set by
  `issue-management` (publishing / set-current). *Owner: `issue-management`.*
- **Subscription / payment settings** (`restrictArticleAccess`, subscription requirement,
  `purchaseIssueFee`, issue-purchase, membership, *PDF-only*) — gate the full-issue galley
  download/link (rule 11). *Owner: `subscriptions` / `payments`.*
- **Custom issue order** (`custom_issue_orders`) — the manual Back-Issues order that (only when set)
  drives the archive listing order (rule 13). *Owner: `issue-management`.*
- **Custom section order** (`custom_section_orders`) + the section's own `seq`, **hide title**, **hide
  author** — drive the TOC section grouping/order and heading suppression (rules 6, 9). *Owner:
  `journal-sections` / `issue-management`.*
- **Publication `seq`** — the within-section article order in the TOC (rule 7); stamped by the editorial
  custom-TOC ordering. *Owner: `issue-management`.*
- **Public-identifier / DOI plugins** (`pubIds`) — whether the issue's DOI / URN renders in the TOC
  heading (rule 5). *Owner: `doi-management` / `publication-identifiers`.*
- **Issue cover / description** (issue settings) — the heading cover image and description (rule 5).
  *Owner: `issue-management`.*

## Cross-feature interactions

- **issue-management** (feature 35, verified) — owns the **issue entity** (`SCHEMA-issue`, `DB-issues`
  and friends), the **editorial TOC grid** (`GRID-grid-toc-toc-grid-handler` — article/section ordering,
  removal, access status), the **issue-galley management** grid, the **cover/description** upload, the
  **custom issue/section orders**, and which issue is **current**. This spec owns the **reader render**
  of all of it. Seam confirmed (issue-management Open question 4): the editorial TOC **grid** stays with
  issue-management; the reader `PAGE-issue-*` pages + this reader TOC page stay here. `SCHEMA-issue` is
  **referenced**, not claimed.
- **article-landing** (feature 38, verified) — owns the reader **article page** each TOC entry links to;
  this spec owns the issue/TOC pages and the article **summaries** in the TOC, not the article page.
- **journal-homepage** (feature 36, verified) — renders the current issue's TOC **inline on the home
  page** (a distinct surface reusing `issue_toc.tpl`) and the *"View all issues"* link into this
  feature's **archive**; this spec owns the standalone `/issue/current`, `/issue/archive` and
  `/issue/view` pages.
- **galleys** (feature 26, verified) — owns **article** galleys and their download; this spec owns the
  distinct **issue** galleys' reader download link. Both reuse `galley_link.tpl`.
- **subscriptions** / **payments** — own the access model behind the full-issue galley gate (rule 11);
  this spec owns the reader entry points into it.
- **usage-statistics** — owns the metering the view/download events feed (rule 14); the issue-level
  reader usage chart and stats pages are theirs.
- **doi-management** / **publication-identifiers** — own the issue DOI / pub-id values; this spec renders
  them in the TOC heading (rule 5).
- **journal-sections** — owns the **section** entity and its `seq` / hide-title / hide-author flags this
  TOC groups by (rules 6, 9).
- **browse-category-section** (feature 41, not written) — owns the OMP-oriented catalog handler
  (`PAGE-catalog-*`) and the browse-by landing pages; **not** part of this reader-issue feature (see Open
  questions on `PLUGIN-catalog`).

## Canonical scenarios

1. **Reader browses the back-issue archive** — Anonymous reader opens `/issue/archive`: the page lists
   the journal's **published** issues (each a cover/identification summary linking to its TOC),
   `itemsPerPage` per page, with prev/next pagination and a *"Showing N–M of T"* line. Requesting a page
   past the last (`/issue/archive/5` on a one-issue journal) returns **404**. *(live-verified 2026-07-05
   on `publicknowledge`: archive 200 listing Vol. 1 No. 2 (2014); `/archive/5` → 404.)*
2. **Reader jumps to the current issue** — Anonymous reader opens `/issue` or `/issue/current`: OJS
   **redirects** to the current issue's TOC (`/issue/view/{id}`). On a journal with no current issue set,
   the reader instead sees a *"No Current Issue"* placeholder page. *(live-verified: both ops 302 →
   `/issue/view/1`.)*
3. **Reader reads a single issue's table of contents grouped by section** — Anonymous reader opens
   `/issue/view/{id}` of a published issue: the page shows the issue heading (cover, description, DOI,
   published date when set) and the **articles grouped by section** in the issue's section order, each
   article a summary linking to its landing page; a section whose title is hidden shows its articles with
   no heading. *(live-verified: `obj_issue_toc` with a hidden-title section + published date renders on
   `publicknowledge` issue 1.)*
4. **Reader downloads a full-issue galley (subscription gate)** — On an issue with a *"Full Issue"* PDF,
   an open-access reader (or a subscriber/purchaser) gets the file streamed and the download metered; a
   reader without access is instead routed to **login / subscribe / purchase**. (Code-derived — the test
   journal's issues carry no galleys; gate owned by `subscriptions`/`payments`.)
5. **Published-only visibility — a missing/unpublished issue bounces the public to login** — An anonymous
   reader requesting a non-existent issue, an issue from another journal, or an **unpublished** issue is
   **redirected to the login screen** (not a 404); an editorial pre-publication user (manager/editor) can
   open the same unpublished issue's TOC, shown with a *preview* banner. *(live-verified: `/issue/view/99999`
   → 302 → login.)*
6. **A journal that does not publish online exposes no issue pages** — On a journal set to *do not publish
   online*, the archive, current-issue and single-issue view pages are all **unreachable** (denied by the
   must-publish policy), regardless of whether issues exist. Verifies rule 2.

## Known deviations (as-built ≠ intent)

- ⚠ **Archive back-issue order is undefined until manually ordered (rule 13) — e2e ledger
  [§2 row 101](../../e2e/app-changes.md).** The reader archive orders only by `custom_issue_orders.seq`
  with no date/current fallback, so an un-ordered journal lists back issues in arbitrary DB order rather
  than newest-first — inconsistent with the editorial Back-Issues grid and the OAI feed, which fall back
  to current-first + `date_published DESC`. **New candidate (code-derived, this wave);** the one-issue
  test journal could not exhibit it live. Fix: give the archive query a deterministic tiebreaker.
- ⚠ **Within-section article order is undefined (rule 7) — e2e ledger
  [§2 row 28](../../e2e/app-changes.md).** Same-section articles tie at `publications.seq = 0` until an
  editor uses the editorial custom-TOC ordering, so they render in arbitrary DB order. Canonical home is
  **here** (the reader TOC); the fix (stamp a sequence on assignment/publish) lives with `issue-management`.
- **Missing/unpublished issue → login redirect, not 404 (rule 3).** As-built, the required-data-object
  policy **denies** and (for anonymous) **redirects to login** — even for an id that simply does not
  exist. This is the framework-standard deny behaviour for *every* required-data-object page, and it
  **diverges from the article page**, which 404s a non-existent/unpublished article. **Verifier
  calibration (2026-07-05): kept as an Open question, NOT a ⚠ deviation, and no ledger row** — the
  login-redirect is the OJS-wide default (`PKPPageRouter::handleAuthorizationFailure()` →
  `Validation::redirectLogin()`), so `article-landing` is the special case (it throws a 404 from its own
  handler), not the issue pages being defective; low impact (a dead/unpublished link → login form, no
  data loss or security effect). Whether the issue page *should* also 404 (to avoid implying "log in to
  see this" for content that does not exist) is a maintainer intent call (Open question 2), not asserted
  here as a bug.
- **Pointer — issue-galley link a11y label (rule 10), e2e ledger [§2 row 29b](../../e2e/app-changes.md).**
  Every full-issue galley link's accessible name is fixed to *"Full Issue"*; multiple galleys are
  indistinguishable to assistive tech. Minor a11y candidate already ledgered; owned at the template.
- **Pointer — publishing makes the issue current (rule 1's `currentIssueId`), e2e ledger
  [§2 row 99](../../e2e/app-changes.md).** The current-issue page reflects whichever issue `issue-management`
  last set current; that publish-makes-current-unconditionally edge is **issue-management's** deviation,
  not re-narrated here.

## Open questions

1. **Is the archive's `custom_issue_orders`-only ordering (rule 13) intended to have no newest-first
   fallback?** As-built, an archive on a journal that never manually re-ordered its back issues lists them
   in undefined DB order. Confirm whether the archive should reuse the editorial grid's current-first +
   `date_published DESC` fallback (ledger row 101). Code-derived; not live-observable on the one-issue
   test journal.
2. **Should a non-existent/unpublished issue page 404 for the public (like the article page) instead of
   redirecting to login (rule 3)?** The redirect-to-login for an id that does not exist implies "log in to
   see this" for content that is not there, and is inconsistent with `article-landing`'s 404. Confirm the
   intended behaviour.
3. **`PLUGIN-catalog` — no such atom exists for OJS; confirm it is out of scope.** The FEATURE-MAP stanza
   listed a speculative `PLUGIN-catalog`, but the atlas has **no** such atom. The catalog handler
   (`PKPCatalogHandler` → `PAGE-catalog-{category,fullSize,thumbnail}`) and `VUE-catalog-list-panel` are
   **OMP-oriented** (monograph catalog) and hinted to `browse-category-section` (feature 41), not to the
   reader issue pages. This spec claims **no** catalog atom; confirm at grooming that `PLUGIN-catalog` was
   a phantom and the `PAGE-catalog-*` atoms belong to `browse-category-section`.
4. **`GRID-grid-toc-toc-grid-handler` seam (issue-management OQ4) — RESOLVED.** The atom is the
   **editorial** TOC ordering/removal grid and stays with `issue-management`; this spec owns the reader
   TOC **page** (`frontend/objects/issue_toc.tpl`, no atom of its own) and the `PAGE-issue-*` handlers.
   No overlap.

---

<!-- REFERENCE MATERIAL — provenance and campaign bookkeeping, not product-owner narrative. -->

## Reference — entry points & surfaces

| Entry | Path | Atom |
|-------|------|------|
| Issue index (= current) | `GET /{journal}/issue` / `/issue/index` → `IssueHandler::index()`→`current()` (redirect to current, else `issue.tpl` placeholder) | PAGE-issue-index |
| Current issue | `GET /{journal}/issue/current` → `IssueHandler::current()` → redirect `/issue/view/{id}` | PAGE-issue-current |
| Back-issue archive | `GET /{journal}/issue/archive[/{page}]` → `IssueHandler::archive()` → `frontend/pages/issueArchive.tpl` | PAGE-issue-archive |
| Single-issue TOC | `GET /{journal}/issue/view/{issueId|urlPath}[/{galleyId}]` → `IssueHandler::view()` → `frontend/pages/issue.tpl` → `frontend/objects/issue_toc.tpl` | PAGE-issue-view |
| Full-issue galley download | `GET /{journal}/issue/download/{issueId}/{galleyId}` → `IssueHandler::download()` (`IssueFileManager::downloadById`) | PAGE-issue-download |
| Editorial TOC grid (NOT claimed here) | Component `grid.toc.TocGridHandler` | *(GRID-grid-toc-toc-grid-handler — owned by issue-management)* |
| Issue entity (referenced) | `schemas/issue.json` / `issues` | *(SCHEMA-issue / DB-issues — owned by issue-management)* |

## Reference — code anchors

- **Handler**: `pages/issue/IssueHandler.php` — `authorize()` (`ContextRequiredPolicy`,
  `OjsJournalMustPublishPolicy`, `OjsIssueRequiredPolicy` on `view`/`download`), `initialize()` (galley
  resolution → redirect to `view` on bad galley id), `index()`/`current()` (current-issue redirect /
  placeholder), `view()` (TOC render or galley→download redirect, `UsageEvent` ASSOC_TYPE_ISSUE),
  `archive()` (paginated back issues, out-of-range 404), `download()` (`UsageEvent`
  ASSOC_TYPE_ISSUE_GALLEY), `userCanViewGalley()` (subscription/payment gate),
  `setupIssueTemplate()` (section grouping, published-only article filter, hasAccess).
- **Router**: `pages/issue/index.php` (`switch ($op)`: index/current/archive/view/download).
- **Policies**: `classes/security/authorization/OjsIssueRequiredPolicy.php` (`dataObjectEffect()`
  published-or-editorial gate; `getDataObjectId()` id-or-urlPath); `OjsJournalMustPublishPolicy`.
- **Templates**: `templates/frontend/pages/issue.tpl` (single-issue wrapper / no-current placeholder),
  `templates/frontend/pages/issueArchive.tpl` (archive list + pagination),
  `templates/frontend/objects/issue_toc.tpl` (the reader TOC: heading/cover/description/pubIds/DOI/date,
  Full Issue galleys, section groups), `templates/frontend/objects/issue_summary.tpl` (archive item),
  `frontend/objects/galley_link.tpl` + `frontend/components/pagination.tpl` (shared, lib/pkp).
- **Ordering / grouping**: `classes/issue/Collector.php` (`orderBy()` — `ORDERBY_SEQUENCE` vs
  `ORDERBY_PUBLISHED_ISSUES`), `classes/issue/DAO.php` (`resequenceCustomIssueOrders()`,
  `custom_issue_orders` join), `classes/section/DAO.php` `getByIssueId()` (`custom_section_orders`
  COALESCE order).
- **Galley download / access**: `classes/issue/IssueAction.php`
  (`allowedIssuePrePublicationAccess()`, `subscriptionRequired()`, `subscribedUser/Domain()`),
  `APP\file\IssueFileManager`, `classes/issue/IssueGalleyDAO.php` (`getByIssueId`, `getByBestId`),
  `payment/ojs/OJSCompletedPaymentDAO` / `OJSPaymentManager` (issue purchase).
- **Liveness (2026-07-05, anonymous, port 8000 `publicknowledge`)**: `/issue` & `/issue/current` → 302
  `/issue/view/1`; `/issue/view/1` → 200 `obj_issue_toc` (heading + published date + a hidden-title
  section of article summaries; no cover/description/DOI/galleys on this issue); `/issue/archive` → 200
  listing Vol. 1 No. 2 (2014); `/issue/archive/5` → 404; `/issue/view/99999` (missing) → 302 → login.
  The full-issue galley download and multi-issue archive ordering are **code-derived** (the test journal
  has one published issue and no issue galleys).
