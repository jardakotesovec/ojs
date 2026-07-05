---
name: web-feeds-syndication
scope: Give search-engine crawlers and feed readers machine-readable, anonymous views of a journal — an always-on XML sitemap of its public URLs, plus opt-in RSS/Atom syndication feeds of its recent articles and its announcements
shared: pkp-lib               # the sitemap engine (PKPSitemapHandler, _createSitemapIndex/_createContextSitemap) lives in lib/pkp and is shared with OMP/OPS; OJS supplies SitemapHandler (adds search + issues/articles/galleys). The webFeed and announcementFeed plugins are standalone cross-app plugin repos (ojs/omp/ops match arms). Spec'd from the OJS angle.
status: verified
e2e-plans: [oai-sitemap-feeds]
atlas-claims: [PAGE-sitemap-index, PLUGIN-generic-webFeed, PLUGIN-generic-announcementFeed]
---

# Web feeds & syndication (sitemap + RSS/Atom feeds)

## Purpose

Three anonymous, machine-facing surfaces that let the outside world track a journal
without scraping HTML or logging in:

- **The sitemap** (`/sitemap`) — an always-on core XML sitemap listing the journal's
  public URLs (home, register, login, about pages, announcements, issues, published
  articles and galleys) so search engines can crawl the site efficiently. Site-wide,
  `/index/sitemap` returns a sitemap *index* pointing at each journal's sitemap.
- **The web feed** (RSS 1.0, RSS 2.0, Atom) — a syndication feed of the journal's most
  recent articles, served by the **webFeed** plugin, for feed readers and aggregators.
- **The announcement feed** (RSS 1.0, RSS 2.0, Atom) — the same idea for the journal's
  announcements, served by the **announcementFeed** plugin.

The sitemap needs no setup. The two feed plugins differ in default state — the **web
feed is on by default** for every journal, the **announcement feed is off by default** —
a difference that comes from how each plugin installs its settings (rule 5, rule 9).
Everything here is read-only crawler/reader traffic: no roles, no sessions, no writes
(one small bookkeeping exception in rule 10). The only privileged action is a **journal
manager** enabling/disabling and configuring the feed plugins in the plugin gallery.

## Actors & permissions

Every *consumer* action below is an **anonymous machine call** (a crawler or feed
reader) — no login, no role, no session. The only gates are per-journal configuration
(plugin enabled? announcements enabled? publishing mode?) and publication state
(published content only). The only *authenticated* actions are a **journal manager**
(or site admin) toggling and configuring the two feed plugins under Website Settings →
Plugins. "Enabled by default" / "disabled by default" throughout is the fresh-journal
state established in rules 5 and 9.

| Action | Who may — and when |
|--------|--------------------|
| **Fetch the sitemap** | • Anyone (anonymous crawler) — always; `/{journal}/sitemap` returns the journal urlset, `/index/sitemap` the site sitemap index. No enable switch, no config gate (core handler) <sup>a</sup> |
| **Fetch the web feed** (`/gateway/plugin/WebFeedGatewayPlugin/{rss\|rss2\|atom}`) | • Anyone — when the **webFeed** plugin is enabled for the journal (**enabled by default**); a manager who disables it makes all three formats return not-found <sup>b</sup> |
| **Fetch the announcement feed** (`/gateway/plugin/AnnouncementFeedGatewayPlugin/{rss\|rss2\|atom}`) | • Anyone — only when the **announcementFeed** plugin is enabled (**disabled by default**) **and** the journal has announcements enabled. Plugin **off** ⇒ not-found (404, unregistered gateway); plugin **on** but announcements off ⇒ a 302 redirect to the journal home (200), *not* a 404 <sup>c</sup> |
| **Enable/disable + configure the web feed** (display scope, current-issue vs recent, item count, include identifiers) | • Journal manager / site admin — in the plugin gallery (Website → Plugins → Web Feeds → Settings) <sup>d</sup> |
| **Enable/disable + configure the announcement feed** (display scope, item count) | • Journal manager / site admin — in the plugin gallery (Website → Plugins → Announcement Feed → Settings) <sup>e</sup> |

<sup>a</sup> `PKPSitemapHandler::index()` (context present → `_createContextSitemap()`, absent → `_createSitemapIndex()`); `SitemapHandler::_createContextSitemap()`. No policy/authorization — public.
<sup>b</sup> `WebFeedPlugin::register()` wires the gateway only `if ($this->getEnabled($mainContextId))`, so a **disabled** web feed leaves the gateway **unregistered** → `GatewayHandler::__construct()` throws `NotFoundHttpException` → **404** (live-verified: disabled scratch journal → 404). The `!getEnabled()` guard inside `fetch()` is belt-and-suspenders, effectively unreachable once `register()` already gated the wiring.
<sup>c</sup> Two distinct mechanisms. A **disabled** plugin never registers its gateway → `GatewayHandler::__construct()` throws `NotFoundHttpException` → **404**. An **enabled** plugin whose secondary gate fails — `AnnouncementFeedGatewayPlugin::fetch()` returns *false* because `!$announcementsEnabled` (or the format is unknown) — reaches `GatewayHandler::plugin()`, which runs `$request->redirect(null, 'index')` → **302 to the journal home** (200 HTML), *not* a 404. Live-verified 2026-07-05.
<sup>d</sup> `WebFeedPlugin::getActions()` / `manage()` → `SettingsForm`.
<sup>e</sup> `AnnouncementFeedPlugin::getActions()` / `manage()` → `AnnouncementFeedSettingsForm`.

## Fields & validation

There are two kinds of "fields": the **feed request** (a machine constructs a URL) and
the **plugin settings** a manager fills in.

**Feed request** — the format is the last path segment of the gateway URL.

| Field (request) | Required? | Rules | Anchor |
|-----------------|-----------|-------|--------|
| **Feed format** | Yes | One of `rss` (RSS 1.0 / RDF, `application/rdf+xml`), `rss2` (RSS 2.0, `application/rss+xml`), `atom` (Atom 1.0, `application/atom+xml`). On an **unknown** value the two plugins diverge: the web feed **throws** `Invalid feed format` → uncaught **HTTP 500**; the announcement feed **returns false** → a 302 redirect to the journal home (200) — neither is a clean 404/400 (Open question 4). There is **no** per-issue selector — the feed always covers the current issue or the recent set (rule 6), never an arbitrary `/{issueId}` (live-verified: `/{issueId}` 404s) | `WebFeedGatewayPlugin::FEED_MIME_TYPE`, `fetch()` (`throw`); `AnnouncementFeedGatewayPlugin::fetch()` `$typeMap` (`return false`) |

**Web feed settings** (SettingsForm) — labels as the manager sees them.

| Field (UI label) | Required? | Rules | Anchor |
|------------------|-----------|-------|--------|
| **Display feed link on** (Whole site / Homepage & issues / Issue pages) | No | Radio: `all`, `homepage` (default), `issue`. Governs which frontend pages carry the autodiscovery `<link>` in their `<head>` (rule 7). `issue` option shown only for OJS | `SettingsForm` (`displayPage`); `WebFeedPlugin::setupTemplateLinks()` |
| **Items to show** (Current issue / Recent) | No (OJS only) | Radio: `issue` (current issue — default) or `recent`. Non-OJS installs have no issues, so only recent applies | `SettingsForm` (`displayItems`) |
| **Number of recent articles** | Required in *recent* mode | Positive integer; non-positive is blanked; falls back to **30** if unset | `SettingsForm::readInputData()`; `WebFeedGatewayPlugin::DEFAULT_RECENT_ITEMS` (30) |
| **Include identifiers** | No | Checkbox (default off). Adds section, category, keywords, subjects, disciplines to each feed item (rule 8) | `SettingsForm` (`includeIdentifiers`) |

**Announcement feed settings** (AnnouncementFeedSettingsForm) — **Display feed link on**
(`all` / `homepage` / `announcement`) and **Number of recent announcements** (positive
integer; blank = unlimited). *(anchor: `AnnouncementFeedSettingsForm::readInputData()`)*

## Rules & state

All three surfaces are **read-only** to journal content. The one write is the
announcement feed's `dateUpdated` bookkeeping setting (rule 10, Side effects).

**The sitemap (core, always on)**

1. **Two shapes, chosen by scope.** `/{journal}/sitemap` returns a `<urlset>` (the
   journal's own URLs); `/index/sitemap` returns a `<sitemapindex>` whose `<sitemap><loc>`
   entries point at every enabled context's `/sitemap`. Both are served as
   `application/xml` with a `Cache-Control: private` header and no session. There is no
   enable toggle — the handler is core and always reachable. *(anchor:
   `PKPSitemapHandler::index()`; `_createSitemapIndex()` iterates `getContextDAO()->getAll(true)`)*

2. **What the journal urlset lists.** Always: the journal home, login, About →
   Submissions, plus **search** and (unless publishing mode is *None*) issue **current**,
   issue **archive**, every **published issue** view, and — for each published issue —
   every **published article**'s abstract URL and each of its **galley** URLs.
   Conditionally: user **register** (unless registration is disabled), the **announcement**
   index and each announcement view (when announcements are enabled), About → **contact**
   (when a contact name or mailing address is set), the **About** page (when About text is
   set), and every **custom navigation-menu page**. URLs are locale-prefixed
   (`…/en/…`). *(anchor: `PKPSitemapHandler::_createContextSitemap()` — register/login/
   announcements/about gates; `SitemapHandler::_createContextSitemap()` — search + issues +
   `Repo::submission()->filterByStatus([STATUS_PUBLISHED])->filterByIssueIds([...])` +
   `Repo::galley()`; `_createUrlTree()` emits `<url><loc>`)*

3. **Published-only, issue-scoped.** Articles reach the sitemap only through the
   published-issue loop and only at `STATUS_PUBLISHED`; unpublished/withdrawn articles and
   articles not in a published issue are absent. (A recent regression that used the
   continuous-publication filter here dropped *all* article/galley URLs — fixed; see
   Known deviations.) A `SitemapHandler::createJournalSitemap` hook lets plugins add URLs.
   *(anchor: `SitemapHandler::_createContextSitemap()` filter chain + `Hook::call('SitemapHandler::createJournalSitemap')`)*

**The web feed (webFeed plugin)**

4. **Three formats, one gateway.** When enabled, the plugin registers a gateway handler
   answering `…/gateway/plugin/WebFeedGatewayPlugin/{format}` for `rss` (**RSS 1.0 / RDF**),
   `rss2` (**RSS 2.0**) and `atom` (**Atom 1.0**), each with its own MIME type and template.
   An unrecognised format throws "Invalid feed format". *(anchor: `WebFeedGatewayPlugin::fetch()`,
   `FEED_MIME_TYPE`; templates `rss.tpl`/`rss2.tpl`/`atom.tpl`)*

5. **Enabled by default.** ⚠(informational) Unlike most reader plugins, the web feed is
   **on for every new journal**: `WebFeedPlugin` overrides `getContextSpecificPluginSettingsFile()`,
   so on journal creation its `settings.xml` defaults (`enabled=true`) are installed into
   the journal's plugin settings. A manager can disable it, at which point `register()`
   stops wiring the gateway/block and all three formats return not-found. *(anchor:
   `Plugin::register()` adds the `Context::add` hook only when `getContextSpecificPluginSettingsFile()`
   is non-null → `Plugin::installContextSpecificSettings()`; `WebFeedPlugin::getContextSpecificPluginSettingsFile()`
   returns `settings.xml`; contrast rule 9. Live-verified 2026-07-05: `webfeedplugin.enabled=1`
   present for every seeded journal, all three formats HTTP 200.)*

6. **Feed content: current issue *or* recent.** In the default **current-issue** mode
   (`displayItems=issue`) the feed lists **every published article in the journal's current
   issue**, ordered by section/sequence, with the channel date set to the issue's publish
   date. In **recent** mode (`displayItems=recent`) it lists the **N most-recently-modified
   published submissions** across the journal (N = *recentItems*, default 30), newest first —
   issue-agnostic. Both modes emit only `STATUS_PUBLISHED` submissions. *(anchor:
   `WebFeedGatewayPlugin::fetch()` — `filterByStatus([STATUS_PUBLISHED])` + `ORDERBY_LAST_MODIFIED DESC`
   for recent; `Repo::issue()->getCurrent()` + `filterByIssueIds()` + `ORDERBY_SEQUENCE ASC`, `limit(null)`
   for issue)*

7. **Item payload + autodiscovery + sidebar block.** Each item carries the article title,
   its reader URL, the abstract (as description/summary), authors, copyright/licence, a
   permalink guid, and the publish date. When enabled the plugin also (a) injects
   `<link rel="alternate" type="…">` **autodiscovery** tags into the page `<head>` — on the
   homepage+issue pages, issue pages only, or all frontend pages per the *displayPage*
   setting — and (b) registers a **sidebar block** (WebFeedBlockPlugin) whose `block.tpl`
   shows Atom / RSS 2.0 / RSS 1.0 icon links. *(anchor: `WebFeedPlugin::setupTemplateLinks()`
   `addHeader(... 'contexts' => $contexts)`; `WebFeedBlockPlugin`; item fields in each `*.tpl`.
   Live-verified 2026-07-05: Atom `<updated>`/`<published>` are well-formed RFC3339, e.g.
   `2026-07-05T00:00:00+00:00`.)*

8. **Include-identifiers enrichment.** With *includeIdentifiers* on, each item additionally
   exposes the submission's section, categories, keywords, subjects and disciplines — as
   `<category>` elements and prepended to the description/summary. Off by default. *(anchor:
   `WebFeedGatewayPlugin::getIdentifiers()`; `includeIdentifiers` branches in the templates)*

**The announcement feed (announcementFeed plugin)**

9. **Disabled by default — and why.** The announcement feed is **off for every new
   journal**: `AnnouncementFeedPlugin` does **not** override `getContextSpecificPluginSettingsFile()`,
   so no `Context::add` settings-install hook is registered and no `enabled` row is ever
   created — `getEnabled()` reads null → false. Even once enabled, the gateway *also*
   requires the journal to have **announcements enabled** — but the two "off" states
   respond differently: a **disabled plugin** leaves the gateway unregistered → **404**,
   while an **enabled plugin on a journal with announcements off** returns false from
   `fetch()` and is **redirected to the journal home** (302→200), *not* a 404. When both
   are on it serves `rss`/`rss2`/`atom` at
   `…/gateway/plugin/AnnouncementFeedGatewayPlugin/{format}`. *(anchor: contrast rule 5 —
   base `Plugin::getContextSpecificPluginSettingsFile()` returns null; `AnnouncementFeedGatewayPlugin::fetch()`
   dual gate; `GatewayHandler::plugin()` redirect-on-false vs `__construct()` NotFoundHttpException.
   Live-verified 2026-07-05: a default (unconfigured) journal such as `publicknowledge` has
   no `announcementfeedplugin` `enabled` row and 404s on all three formats; enabling it on a
   journal with announcements on → HTTP 200; enabling it on a journal with announcements
   *off* → 302 redirect to the home page.)*

10. **Feed content + a bookkeeping write.** The feed lists the journal's **active
    (non-expired) announcements**, newest first, limited to *recentItems* if set. The plugin
    keeps a `dateUpdated` plugin-setting marker and **writes** it (its only write) *only when
    the change is real*: it advances the marker to the newest announcement's post date when
    that date is newer than the stored value, and — when there are no announcements and no
    prior marker — stamps "now". A fetch that finds nothing newer writes nothing. Items carry
    title, reader URL, description and post date.
    ⚠ The **Atom and RSS 1.0** announcement templates emit **malformed timestamps** (rule
    in Known deviations); the RSS 2.0 template is correct. *(anchor:
    `AnnouncementFeedGatewayPlugin::fetch()` — `Announcement::withContextIds()->withActiveByDate()`,
    `updateSetting(..., 'dateUpdated', ...)`)*

**Shared**

11. **No sessions, no auth, no content mutation.** All three handlers run as plain
    anonymous requests and return XML. Nothing here creates or edits journal content; the
    sitemap and web feed write nothing at all, the announcement feed writes only its
    `dateUpdated` marker. *(anchor: `PKPSitemapHandler::index()`, both gateway `fetch()`)*

## Side effects

- **Sitemap:** none. Pure read; emits XML with `Cache-Control: private`.
- **Web feed:** none. Pure read.
- **Announcement feed:** a **conditional plugin-setting write** — `dateUpdated` is advanced
  to the most recent announcement's post date *only when it is newer than the stored marker*
  (or set to "now" when there are no announcements and no prior value); a fetch that finds
  nothing newer writes nothing. No content change. *(anchor:
  `AnnouncementFeedGatewayPlugin::fetch()` — `if (empty($lastDateUpdated) || $dateUpdated->gt($lastDateUpdated)) updateSetting(..., 'dateUpdated', ...)`)*
- **No emails, notifications, event-log entries, or jobs** from any of the three.

## Settings that modify behavior

- **webFeed plugin enabled** (per journal, **default on**) — gates the whole web feed +
  its autodiscovery links + sidebar block. *(rule 5)*
- **webFeed `displayItems`** (`issue` default / `recent`) — current-issue vs recent-N feed.
  Note: the settings.xml default was recently corrected from a boolean to the string
  `issue` (see Known deviations) — journals created before that fix carry a stale value
  that falls through to *recent* mode.
- **webFeed `recentItems`** (default 30) — item cap in recent mode.
- **webFeed `displayPage`** (`all` / `homepage` default / `issue`) — where autodiscovery
  `<link>`s appear.
- **webFeed `includeIdentifiers`** (default off) — section/category/keyword enrichment.
- **announcementFeed plugin enabled** (per journal, **default off**) — gates the
  announcement feed. *(rule 9)*
- **`enableAnnouncements`** (journal) — additionally required for the announcement feed to
  serve; also controls whether the sitemap lists announcement URLs. *(anchor:
  `context.json` `enableAnnouncements`; `AnnouncementFeedGatewayPlugin::fetch()`;
  `PKPSitemapHandler::_createContextSitemap()`)*
- **announcementFeed `recentItems`** — announcement cap (blank = unlimited).
- **`publishingMode`** (journal) — *None* suppresses all issue/article/galley URLs from the
  sitemap. **`disableUserReg`** suppresses the register URL. About/contact URLs appear only
  when the corresponding text/contact fields are set. *(anchor:
  `PKPSitemapHandler::_createContextSitemap()`, `SitemapHandler::_createContextSitemap()`)*

## Cross-feature interactions

- **oai-pmh** — the *other* machine-harvest door, and a deliberate contrast: OAI-PMH is a
  stateful metadata-harvesting protocol (verbs, resumption tokens, DC/MARC/JATS formats,
  deletion tombstones) at `/oai`; these feeds are lightweight RSS/Atom **syndication** of
  recent content at `/sitemap` and the gateway URLs. Different audiences (indexers vs feed
  readers), different formats, no shared code beyond both being anonymous read surfaces.
- **browse-category-section** — owns `PLUGIN-blocks-browse` (the *browse-by-category*
  sidebar block). The web feed's own **WebFeedBlockPlugin** is a separate sidebar block
  (feed icon links, rule 7) owned here; do not confuse the two.
- **announcements** — owns the announcement **data** (create/edit/expiry, `enableAnnouncements`).
  This spec owns only the **feed rendering** of that data; the feed reads active
  announcements and is additionally gated on `enableAnnouncements`.
- **article-landing** / **issue-archive-toc** — the human reader pages the feed and sitemap
  mirror. The web feed's item links point at `article/view`; the sitemap lists the same
  issue/article/galley URLs. Published-only visibility is defined by those features.
- **journal-homepage** / **about-pages** — the sitemap enumerates their URLs (home, About,
  contact, custom pages); the autodiscovery `<link>`s render into their `<head>`.

## Canonical scenarios

1. **Crawl the journal sitemap** — A search engine GETs `/{journal}/sitemap` and receives
   an `application/xml` `<urlset>` listing the home, login, register, About/Submissions/
   Contact, announcements, search, current/archive issue pages, each published issue, and
   each published article + galley URL. GETting `/index/sitemap` instead returns a
   `<sitemapindex>` pointing at every journal's sitemap. No login, always available.
   *(Live-verified 2026-07-05: journal urlset + site index both 200; after seeding a
   published article it appeared as `…/article/view/1`.)*

2. **Subscribe to the current-issue web feed** — A feed reader GETs
   `…/gateway/plugin/WebFeedGatewayPlugin/rss2`. Because the web feed is enabled by default,
   it receives an RSS 2.0 channel of the current issue's published articles — each with
   title, article URL, abstract, author, licence and publish date. The `atom` and `rss`
   (RSS 1.0/RDF) URLs return the same content in those formats.
   *(Live-verified 2026-07-05: all three formats 200 with valid XML; a seeded published
   article surfaced as an item with a well-formed Atom date.)*

3. **A manager disables the web feed** — A journal manager opens Website → Plugins → Web
   Feeds and unchecks it. All three feed URLs now return not-found, the sidebar block
   disappears, and the autodiscovery `<link>`s stop rendering. Re-enabling restores them.
   *(Backed by rule 5 — disabling stops `register()` wiring the gateway.)*

4. **The announcement feed is off until enabled** — On a default journal a reader GETs
   `…/gateway/plugin/AnnouncementFeedGatewayPlugin/atom` and gets **not-found** (plugin off
   by default). A manager enables the Announcement Feed plugin on a journal that has
   announcements enabled; the same URL now returns an Atom feed of the active announcements
   (title, announcement URL, description, post date). *(Live-verified 2026-07-05 on a
   scratch journal seeded with two announcements + the plugin enabled: 404 before, 200 with
   both announcements after.)*

5. **Recent-mode + include-identifiers** — A manager switches the web feed to *Recent* with
   a count of 10 and turns on *Include identifiers*. The feed now lists the 10
   most-recently-modified published articles journal-wide (newest first), and each item
   additionally carries its section, categories and keywords as `<category>` elements and in
   the description. *(Backed by rules 6, 8.)*

6. **Withdrawn content drops out** — After an editor unpublishes an article, it disappears
   from both the sitemap (published-issue loop, rule 3) and the web feed (published-only,
   rule 6) on the next fetch — the same published-only visibility the reader pages enforce.
   *(Backed by rules 3, 6; the article/galley URL is present only while the article is
   published in a published issue — confirmed by seeding: the URL appeared once the article
   was published to a live issue.)*

## Known deviations (as-built ≠ intent)

- ⚠ **Announcement Atom & RSS 1.0 feeds emit malformed dates (rules 9–10).** The
  announcementFeed `atom.tpl` (`<updated>`, `<published>`) and `rss.tpl` (`<dc:date>`) format
  dates with obsolete `strftime`-style `%` codes — either via Smarty `date_format:"%Y-%m-%dT%T%z"`
  or, worse, by calling Carbon `->format("%Y-%m-%dT%T%z")` directly. Under modern Smarty /
  PHP 8.1+ these tokens are not `strftime` codes: DateTime/Carbon `format()` treats `%`
  literally, `T`→timezone abbreviation, `%z`→day-of-year — so the output is garbage like
  `<updated>%2026-%07-%05UTC%UTC%185</updated>` and `<dc:date>%2026-%07-%05</dc:date>`. This
  makes the **Atom announcement feed invalid** (a feed validator rejects the non-RFC3339
  `<updated>`) and the RSS 1.0 `dc:date` unusable. The **RSS 2.0** announcement template is
  unaffected (it uses `{$smarty.const.DATE_RSS|date:...}` after `strtotime`), and the
  **web feed** templates are all correct (`date_format:"Y-m-d\TH:i:sP"`). *Live-observed
  2026-07-05. Suspected intent: emit RFC3339/RFC822 timestamps as the web feed does.
  Proposed new ledger row (app-changes.md §2) — non-blocking; a template-only fix in
  pkp/announcementFeed.*
- **Sitemap zero-article regression — already fixed (app-changes.md §1 row 4).** A Feb-2026
  change made the per-issue article loop use the continuous-publication filter, which
  contradicts the published-issue filter and dropped every article/galley URL from journal
  sitemaps. The working tree restores `filterByStatus([STATUS_PUBLISHED])`; live-verified
  2026-07-05 that a published article now appears. Referenced here, not re-flagged.
- **webFeed `displayItems` bool→string — already fixed (app-changes.md §1 row 5).** The
  plugin's `settings.xml` declared `displayItems` as a boolean, so fresh journals installed
  `true` while the gateway compares `=== 'issue'` — new contexts silently took the *recent*
  branch and neither settings radio showed checked. Corrected to a `string` default of
  `issue`; the working-tree `settings.xml` now installs `displayItems=issue`, so journals
  seeded after the fix render in **current-issue** mode. Only journals created *before* the
  fix still carry the stale boolean that falls through to recent mode. **Live-verified
  2026-07-05 (correcting an earlier draft note): the test env's `publicknowledge` carries
  `displayItems=issue` and runs the issue-mode feed** (`limit(null)` → every current-issue
  article; the feed returned 100+ items, far past the 30-item recent cap). Referenced, not
  re-flagged.

## Open questions

1. **Should the announcement Atom/RSS 1.0 date bug be fixed to match the web feed's
   formatter?** (Deviation above.) It produces invalid Atom output on every announcement
   feed; confirm it is a straight template bug and not intentionally tolerated.
2. **Is "web feed enabled by default, announcement feed disabled by default" intended?**
   The asymmetry is an accident of one plugin overriding `getContextSpecificPluginSettingsFile()`
   and the other not (rules 5, 9). Confirm the intended default state of each feed.
3. **Recent-mode issue-agnostic selection (rule 6).** In *recent* mode the web feed filters
   only on submission status, so a published submission not attached to a published issue
   could list in the feed while 404-ing on click (unlike the sitemap/OAI, which require a
   published issue). Confirm whether recent mode should also require a published issue.
4. **Unknown web-feed format returns HTTP 500 (not a clean 4xx).** An unrecognised format on
   the web-feed gateway (`…/WebFeedGatewayPlugin/xml`) makes `fetch()`
   `throw new Exception('Invalid feed format')`, surfacing as an uncaught **HTTP 500**; the
   sibling announcement-feed gateway instead `return`s false for the same bad input →
   `GatewayHandler` redirects to the journal home (302→200). Both are only reachable by
   hand-crafting a bad URL segment and neither loses data, but the two plugins disagree and a
   500 is the wrong class for bad client input (OAI answers the analogous case with
   `cannotDisseminateFormat`). Low-severity, non-blocking — a candidate app-changes ledger
   row; confirm whether the web feed should degrade gracefully like its sibling.
   *(Live-verified 2026-07-05: `/WebFeedGatewayPlugin/xml` → 500, `/AnnouncementFeedGatewayPlugin/xml`
   → 302→200.)*

---

## Reference — entry points & surfaces

| Entry | Path | Atom |
|-------|------|------|
| Journal sitemap | `/index.php/{journal}/sitemap` (302 → `…/en/sitemap`) → `SitemapHandler::index()` | PAGE-sitemap-index |
| Site sitemap index | `/index.php/index/sitemap` → `PKPSitemapHandler::_createSitemapIndex()` | PAGE-sitemap-index |
| Web feed (RSS 1.0 / RSS 2.0 / Atom) | `/index.php/{journal}/gateway/plugin/WebFeedGatewayPlugin/{rss\|rss2\|atom}` | PLUGIN-generic-webFeed |
| Web feed settings + sidebar block | Website → Plugins → Web Feeds → Settings; `WebFeedBlockPlugin` sidebar block | PLUGIN-generic-webFeed |
| Announcement feed (RSS 1.0 / RSS 2.0 / Atom) | `/index.php/{journal}/gateway/plugin/AnnouncementFeedGatewayPlugin/{rss\|rss2\|atom}` | PLUGIN-generic-announcementFeed |
| Announcement feed settings | Website → Plugins → Announcement Feed → Settings | PLUGIN-generic-announcementFeed |
| Browse-by-category sidebar block (feed-adjacent, **not owned here**) | `plugins/blocks/browse` | PLUGIN-blocks-browse → browse-category-section |

## Reference — code anchors

- **Sitemap**: `pages/sitemap/SitemapHandler.php` (`_createContextSitemap()` — search +
  issues/articles/galleys + `SitemapHandler::createJournalSitemap` hook); shared base
  `lib/pkp/pages/sitemap/PKPSitemapHandler.php` (`index()`, `_createSitemapIndex()`,
  `_createContextSitemap()` — home/register/login/announcements/about/custom-pages gates,
  `_createUrlTree()`); routing `pages/sitemap/index.php`.
- **Web feed**: `plugins/generic/webFeed/WebFeedPlugin.php` (`register()` gated on
  `getEnabled()`, `setupTemplateLinks()`, `getContextSpecificPluginSettingsFile()`),
  `WebFeedGatewayPlugin.php` (`fetch()`, `FEED_MIME_TYPE`, `DEFAULT_RECENT_ITEMS`,
  `getIdentifiers()`), `WebFeedBlockPlugin.php`, `SettingsForm.php`, `settings.xml`,
  templates `rss.tpl` (RDF), `rss2.tpl`, `atom.tpl`, `block.tpl`, `settingsForm.tpl`.
- **Announcement feed**: `plugins/generic/announcementFeed/AnnouncementFeedPlugin.php`
  (`register()`, `callbackAddLinks()`), `AnnouncementFeedGatewayPlugin.php` (`fetch()` dual
  gate + `dateUpdated` write), `AnnouncementFeedBlockPlugin.php`, `AnnouncementFeedSettingsForm.php`,
  `settings.xml`, templates `rss.tpl`/`rss2.tpl`/`atom.tpl`/`block.tpl`.
- **Settings-install mechanism** (why the two plugins differ): `lib/pkp/classes/plugins/Plugin.php`
  — `register()` adds the `Context::add` hook only when `getContextSpecificPluginSettingsFile()`
  is non-null; `installContextSpecificSettings()` → `PluginSettingsDAO::installSettings()`.
- **Config/schema**: `lib/pkp/schemas/context.json` (`enableAnnouncements`), journal
  `publishingMode` / `disableUserReg`.
