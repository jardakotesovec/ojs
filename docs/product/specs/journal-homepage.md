---
name: journal-homepage
scope: What an anonymous reader sees when they open a journal's home page — the current-issue table of contents (or a recent-articles / category listing), the featured-highlights carousel, the in-content announcements section, the homepage image, the journal description and any custom home content, and the sidebar blocks — every surface driven by journal settings and theme options rather than by who is looking
shared: pkp-lib   # The render machinery is mostly pkp-lib and shared with OMP/OPS: PKPIndexHandler (highlights + announcements), the sidebar/block plugin mechanism (PKPTemplateManager::displaySidebar, BlockPlugin), the highlights/announcements/header/footer templates, the Highlight/Announcement repos. The OJS overlay is thin but real and OJS-only: APP\pages\index\IndexHandler, templates/frontend/pages/indexJournal.tpl, the JournalContentOption display modes (current-issue TOC / recent-published / category listing), and the current-issue TOC via IssueHandler — none of which OMP/OPS have. Tagged pkp-lib to flag the shared machinery for a future extraction; the OJS-only pieces are called out per rule.
status: verified
e2e-plans: [journal-homepage]
atlas-claims:
  - PAGE-index-index
  - PLUGIN-blocks-information
  - PLUGIN-blocks-developedBy
  - PLUGIN-blocks-languageToggle
  - PLUGIN-blocks-makeSubmission
  - PLUGIN-blocks-subscription
---

# Journal home page (the reader landing page)

## Purpose

Every journal has a **home page** at `/{journalPath}` (e.g. `/publicknowledge`) — the anonymous
reader's front door. This spec owns **what that page renders**: the journal's **current issue**
table of contents (the default), or instead a **recent-articles** list or a **category listing**;
a **highlights** carousel of featured content across the top; an in-content **announcements**
section; the journal's **homepage image**, **description** and any **custom home content**; and
the **sidebar blocks** (information, language switcher, "make a submission", subscription status,
etc.) that flank the frontend. It is a **read-only, fully public** page — no login, no forms, no
mutations — whose contents are governed entirely by the journal's **appearance settings** and its
active **theme's options**, not by the viewer's role.

It does **not** own the settings that drive it — the theme options and sidebar configuration
(`website-appearance-settings`), the description and reader/author/librarian info text
(`journal-setup`), which issue is current (`issue-management`), the highlights the manager curates
(`highlights-featured-content`), or the announcement content (`announcements`). It owns the
**page that displays** all of them. It also does not own the reader **issue archive / single-issue
TOC** pages (`issue-archive-toc`) — the current-issue block here is a distinct home-page surface —
nor the **article** landing pages the TOC links to (`article-landing`), nor the **site-level**
(multi-journal) index (`site-settings`).

## Actors & permissions

The journal home page is **fully public and anonymous**. There is no authorization policy on it —
`IndexHandler::index()` runs `$this->validate(null, $request)` (the base handler check only) and
serves every visitor identically; **role plays no part** in what the home page shows. What varies
between two visitors is **not who they are** but **what the journal has configured** (its theme
options, sidebar array, homepage settings) and **the published state of the content** (whether an
issue is current, whether articles are published). The one place a viewer's identity matters is
*downstream*: the current-issue TOC links to article pages whose **galley downloads** may be
**subscription-gated** — that gate lives on the article/galley, owned by `subscriptions`, and does
**not** hide anything on the home page itself. Rows below therefore read *"what any reader sees —
and when."* <sup>a</sup>

| Action | Who sees it — and when |
|--------|------------------------|
| **Open the journal home page** | • Any visitor, no login — always (when the journal exists and the path resolves) <sup>a</sup> |
| **See the current-issue table of contents** on the home page | • Any visitor — when the journal's display mode is *current-issue*, the journal **publishes online**, and an issue is **current** and **published**; otherwise the section is simply absent <sup>b</sup> |
| **See the highlights carousel** | • Any visitor — when the journal (or site) has ≥1 highlight configured; else absent <sup>c</sup> |
| **See the announcements section** | • Any visitor — when the journal has announcements **enabled** *and* a non-zero *"announcements on the homepage"* count *and* at least one currently-active announcement; else absent <sup>d</sup> |
| **See the homepage image / description / custom content** | • Any visitor — each shown only when its setting is populated (and, for the description, only when the theme's *show description* option is on) <sup>e</sup> |
| **See the sidebar blocks** | • Any visitor — each block shows only when it is an **enabled** plugin **and** listed in the journal's ordered **sidebar** array; a journal with an empty sidebar shows no sidebar at all <sup>f</sup> |
| **Download a subscription-gated galley** linked from the TOC | • Governed off-page by the article/galley subscription gate (`subscriptions`), **not** by this page <sup>g</sup> |

<sup>a</sup> `IndexHandler::index()` (`validate(null, ...)`; no `authorize()` override — public); route `GET /{journalPath}` / `/{journalPath}/index` · live-verified 2026-07-04 anonymous 200 on `publicknowledge`.
<sup>b</sup> `IndexHandler::index()` (`JournalContentOption::ISSUE_TOC` branch, `Repo::issue()->getCurrent($id, true)`, `publishingMode != PUBLISHING_MODE_NONE`, `IssueHandler::setupIssueTemplate()`); `indexJournal.tpl` (`{if $issue}` … `current_issue`).
<sup>c</sup> `PKPIndexHandler::getHighlights()`; `indexJournal.tpl` (`{if $highlights->count()}`); `frontend/components/highlights.tpl`.
<sup>d</sup> `PKPIndexHandler::_setupAnnouncements()` (`enableAnnouncements && numAnnouncementsHomepage`, `Announcement::withActiveByDate()`); `frontend/objects/announcements_list.tpl` (`{if $numAnnouncements && $announcements|@count}`).
<sup>e</sup> `IndexHandler::index()` (`homepageImage`, `additionalHomeContent`, `description` assigns); `indexJournal.tpl`; `DefaultThemePlugin::init()` (`showDescriptionInJournalIndex`, `useHomepageImageAsHeader`).
<sup>f</sup> `PKPTemplateManager::displaySidebar()` (iterates `context->getData('sidebar')`, renders only plugins present in `PluginRegistry::loadCategory('blocks', true)`); `BlockPlugin::getEnabled()`; `footer.tpl` (`pkp_structure_sidebar`). Empty sidebar → `hasSidebar` false → no sidebar region (live-verified absent on `publicknowledge`).
<sup>g</sup> Owned by `subscriptions` / the galley download handler; noted here only to place the seam.

## Fields & validation

**N/A — read-only, anonymous page.** The home page presents no form and accepts no reader input;
it has no fields to validate. Everything it renders is a **display setting** configured elsewhere
(the manager's Website / journal-setup forms) and read here — those settings, their owners and how
each one changes the page are enumerated in **Settings that modify behavior** below.

## Rules & state

The home page is a pure **projection of settings + published content**. `IndexHandler::index()`
gathers the pieces and hands them to one template, `frontend/pages/indexJournal.tpl`, which lays
them out top-to-bottom; the theme (its LESS/CSS and a handful of on/off **options**) styles them
and toggles a few. No state is written.

**Routing & the two branches**

1. **`/{journalPath}` resolves to this handler; with no journal it becomes the site index.** When
   a journal is in context, `index()` renders the journal home page (rules below). When **no**
   journal is in context it redirects to the sole/target journal if there is one, or (for a
   logged-in site admin with zero journals) to the admin's context-creation page, else renders the
   **site index** (the multi-journal list, `indexSite.tpl`, public-cacheable). **The site-index
   branch is owned by `site-settings`**; this spec owns the journal branch. *(anchor:
   `IndexHandler::index()` — `$request->getJournal()` present vs absent; `frontend/pages/indexSite.tpl`)*

**The home-page body content (in render order)**

2. **The main-content display mode is a theme option with three choices.** The theme option
   **`journalContentOrganization`** selects what fills the main column: **current-issue TOC**
   (`ISSUE_TOC`), **recent published articles** (`RECENT_PUBLISHED`), and/or **category listing**
   (`CATEGORY_LISTING`) — it is a multi-select, so more than one can be on. When the option is
   unset, OJS falls back to `JournalContentOption::default()`: **current-issue if the journal has
   any issue**, otherwise **recent-published**. *(anchor: `IndexHandler::index()`
   (`$activeTheme->getOption('journalContentOrganization')` else `JournalContentOption::default()`);
   `JournalContentOption` cases + `default()`; `DefaultThemePlugin::init()` registers the option,
   default = `JournalContentOption::default($context)`)*
3. **Current-issue mode shows the current issue's TOC on the home page.** In `ISSUE_TOC` mode OJS
   loads the journal's **current, published** issue (`getCurrent($id, /*published only*/ true)`)
   and — **only if the journal actually publishes online** (`publishingMode != NONE`) — sets up the
   issue template. The section renders the heading *"Current Issue"*, the issue **identification**
   (e.g. *"Vol. 1 No. 2 (2014)"*), the issue **cover** (if any), the **table of contents** grouped
   by section, and a **"View all issues"** link to the issue **archive** page. This is a **distinct
   surface** from the reader archive/current pages (`issue-archive-toc`) — the same issue, rendered
   inline on the home page. *(anchor: `IndexHandler::index()` (`ISSUE_TOC` branch →
   `IssueHandler::setupIssueTemplate()`); `indexJournal.tpl` (`current_issue` section);
   `frontend/objects/issue_toc.tpl`; live-verified 2026-07-04 — `publicknowledge` home shows the
   *Current Issue* / *Vol. 1 No. 2 (2014)* / TOC / *View All Issues* block)*
4. **Recent-published mode shows a paginated list of the latest published articles.** In
   `RECENT_PUBLISHED` mode OJS paginates the journal's latest-published submissions at
   **`itemsPerPage`** per page (default 25) and renders them via the latest-articles object. This is
   the fallback mode when a journal has no issues yet. **⚠ The list is *not* ordered by publication
   date**: the branch sets no `orderBy`, so it inherits the submission collector's
   `ORDERBY_DATE_SUBMITTED DESC` default — a back-dated or late-published article sorts by *when it
   was submitted*, and same-second ties fall in arbitrary DB order (as-built ≠ the "latest published"
   label; e2e ledger [§2 row 25](../../e2e/app-changes.md)). *(anchor: `IndexHandler::index()`
   (`RECENT_PUBLISHED` branch, `filterByLatestPublished(true)`, **no `orderBy`**, `LengthAwarePaginator`,
   `itemsPerPage`); `frontend/objects/latest_article.tpl`)*
5. **Category-listing mode adds a category header.** In `CATEGORY_LISTING` mode OJS loads the
   journal's categories and renders a category header/navigation block. The category **landing/browse
   pages** themselves are owned by `browse-category-section`. *(anchor: `IndexHandler::index()`
   (`CATEGORY_LISTING` branch, `Repo::category()->getCollector()`); `frontend/components/categoryHeader.tpl`)*
6. **A highlights carousel renders across the top when highlights exist.** `getHighlights()` returns
   the context's highlights (or the site's when no journal); when the collection is non-empty the
   page renders a **Swiper carousel** — each slide an optional image, a title, a description and a
   button linking to the highlight's URL. The carousel sits **above** the display-mode content. The
   **content** of the highlights (what they say, their order) is owned by
   `highlights-featured-content`; this spec owns the **reader render**. *(anchor:
   `PKPIndexHandler::getHighlights()`; `indexJournal.tpl` (`{if $highlights->count()}`);
   `frontend/components/highlights.tpl` (`.swiper`); carousel JS/CSS loaded by
   `DefaultThemePlugin::init()`)*
7. **The homepage image renders inline — unless the theme uses it as a banner instead.** When the
   journal has a **homepage image** set, it renders as an inline `<img>` (with its alt text) near
   the top of the content — **except** when the theme's **`useHomepageImageAsHeader`** option is on,
   in which case the image is instead applied as the **page-header background** (via inline CSS in
   the theme) and the inline image is suppressed. *(anchor: `indexJournal.tpl`
   (`{if !$activeTheme->getOption('useHomepageImageAsHeader') && $homepageImage}` → `homepage_image`);
   `DefaultThemePlugin::init()` (`useHomepageImageAsHeader` → `.pkp_structure_head` background))*
8. **The journal description shows only when the theme option is on.** The journal's **description**
   text is rendered in an *"About the Journal"* section **only** when the theme's
   **`showDescriptionInJournalIndex`** option is enabled — which is **off by default**. A journal
   can have a description set and still not show it on the home page. *(anchor: `indexJournal.tpl`
   (`{if $activeTheme->getOption('showDescriptionInJournalIndex')}` → `homepage_about`);
   `DefaultThemePlugin::init()` (`showDescriptionInJournalIndex`, default `false`); live-verified
   2026-07-04 — `publicknowledge` has a description set but the section is absent, option off)*
9. **The announcements section needs the feature enabled *and* a non-zero home-page count.**
   `_setupAnnouncements()` assigns announcements to the page **only** when **both**
   `enableAnnouncements` is true **and** `numAnnouncementsHomepage` is a non-zero number; it then
   loads up to that many **currently-active** announcements (active-by-date, newest first) scoped to
   the journal. The template renders the section only if that list is non-empty (the first
   announcement gets a full summary, the rest a compact list). Enabling announcements **alone** —
   without setting the home-page count — shows **nothing** here. The count field is **not** buried:
   `numAnnouncementsHomepage` sits on the **same** Announcements settings form directly below the
   enable toggle and is *revealed the moment the toggle is switched on* (`PKPAnnouncementSettingsForm`,
   field option `showWhen: enableAnnouncements`) — so the control to raise it is present at enable
   time, merely defaulted empty (see Open questions — the empty default, not a hidden control, is what
   surprises). *(anchor:
   `PKPIndexHandler::_setupAnnouncements()` (`enableAnnouncements && numAnnouncementsHomepage`,
   `Announcement::withActiveByDate()->limit()->orderBy(CREATED_AT,'desc')`);
   `frontend/objects/announcements_list.tpl`; live-verified 2026-07-04 — `publicknowledge` has
   `enableAnnouncements=1` but **no** `numAnnouncementsHomepage`, and no announcements section
   renders; see Open questions)*
10. **Custom "additional home content" is raw HTML appended at the bottom.** When
    **`additionalHomeContent`** is populated its (multilingual) HTML is output verbatim at the foot
    of the content column — an escape hatch for arbitrary home-page markup. *(anchor:
    `indexJournal.tpl` (`{if $additionalHomeContent}` → `additional_content`);
    `IndexHandler::index()` (`additionalHomeContent` assign))*

**The sidebar (site-wide, shown on the home page)**

11. **A sidebar block renders only when it clears two independent gates.** The sidebar is **not**
    home-page-specific — it is emitted for every frontend page by `footer.tpl` calling the
    `Templates::Common::Sidebar` hook, which `PKPTemplateManager::displaySidebar()` handles. That
    method walks the journal's **`sidebar`** setting — an **ordered array of block-plugin names** —
    and renders each block **in array order**, but only if that plugin is also present in
    `PluginRegistry::loadCategory('blocks', true)` (i.e. the block plugin is **enabled**). So a
    block appears **iff** it is (a) an **enabled** block plugin **and** (b) listed in the journal's
    `sidebar` array. If the array is empty, `hasSidebar` is false and **no sidebar region renders at
    all**. *(anchor: `PKPTemplateManager::displaySidebar()`; `BlockPlugin::getEnabled()`;
    `PKPTemplateManager` `hasSidebar` assign; `footer.tpl` (`pkp_structure_sidebar`))*
12. **By default a journal shows no sidebar blocks — the `sidebar` *selection* ships empty.**
    `publicknowledge` — and **every journal in the test database** — has **no `sidebar` setting**, so
    no sidebar renders even though four block plugins ship `enabled=true`. The
    **Website → Appearance → Setup → Sidebar management** control is an *orderable multi-select* whose
    **options are exactly the enabled block plugins** (`PKPAppearanceSetupForm` →
    `PluginRegistry::loadCategory('blocks', true)`) and whose **checked value is the current `sidebar`
    array** — which ships **empty**, so a manager composes the sidebar from an empty selection (owned by
    `website-appearance-settings`). A block's **`enabled` flag is therefore live, not legacy**: it gates
    both whether the block is *offered* in this control **and** whether `displaySidebar()` will render
    it (rule 11). Only the per-plugin **`seq`** is a superseded default-order hint — the array's own
    order wins. *(anchor: `PKPAppearanceSetupForm` (`FieldOptions('sidebar', isOrderable=true)`, options
    from `loadCategory('blocks', true)`, value = `context->getData('sidebar')`); block `settings.xml`
    (`enabled`, `seq`); `schemas/context.json` `sidebar`; live-verified 2026-07-04 — `sidebar` absent
    from every `journal_settings` row; home page emits `pkp_structure_content` with **no**
    `pkp_structure_sidebar`; see Open questions)*
13. **The block set is six plugins, each with its own content and applicability.** When placed in the
    sidebar array, the OJS block plugins render:
    - **Information** — three link lists (*For Readers / For Authors / For Librarians*) drawn from the
      journal's reader/author/librarian info text; renders nothing when the journal is out of context.
      Ships **enabled**. *(anchor: `InformationBlockPlugin::getContents()` reads
      `readerInformation`/`authorInformation`/`librarianInformation` — the fields are owned by `journal-setup`)*
    - **Language toggle** — a UI-language selector; only meaningful on a **multilingual** journal.
      Ships **enabled**. *(anchor: `LanguageToggleBlockPlugin`)*
    - **Make a submission** — a call-to-action link to the submission page. Its `settings.xml` sets
      `enabled=true`, but that default **never installs** (the plugin is the only stock block missing
      the `getContextSpecificPluginSettingsFile()` override), so on every journal it starts **disabled**
      and never renders until a manager enables it by hand — ⚠ the shipped "enabled" default is dead
      (ledger row 122; live-verified by `website-appearance-settings`). *(anchor:
      `MakeSubmissionBlockPlugin` (no override — contrast `InformationBlockPlugin`);
      `plugins/blocks/makeSubmission/settings.xml` (`enabled=true`, never read))*
    - **Subscription** — subscription status / how-to-subscribe info; only meaningful on a
      **subscription** journal. Ships **enabled**. *(anchor: `SubscriptionBlockPlugin`; the
      subscription model is owned by `subscriptions`)*
    - **Developed by** — a *"Developed by PKP"* credit. Ships **disabled** by default.
      *(anchor: `DevelopedByBlockPlugin`; `settings.xml` `enabled=false`)*
    - **Browse** — browse-by-issue/section/author links; the block **atom is owned by
      `browse-category-section`** (this spec owns only that it can appear in the sidebar; no
      `settings.xml`, so not enabled by default). *(anchor: `BrowseBlockPlugin`)*

**Read-only guarantees**

14. **Viewing the home page fires a usage-stats event and writes nothing else.** Each journal-home
    view emits a `UsageEvent` for the journal (feeding usage statistics); the site-index branch is
    marked public-cacheable. There are **no** other side effects — no emails, no notifications, no
    DB mutations. *(anchor: `IndexHandler::index()` (`event(new UsageEvent(ASSOC_TYPE_JOURNAL, ...))`;
    `setCacheability(CACHEABILITY_PUBLIC)` on the site branch))*

## Side effects

**Effectively none — the page is read-only.** The only effect of a home-page view is a
`UsageEvent` for the journal (usage statistics; owned by `usage-statistics`). The site-index branch
additionally sets **public cacheability**. No email is sent, no notification raised, no row written
or changed by loading the home page.

## Settings that modify behavior

Every knob below is **configured elsewhere and only read here**; the owning feature is named so the
rule lives in one place.

- **`journalContentOrganization`** (theme option) — picks the main-content display mode(s):
  current-issue TOC / recent-published / category listing (rule 2). Default is computed
  (issues-exist → current-issue, else recent-published). *Owner: `website-appearance-settings`
  (theme options); the modes are OJS-specific (`JournalContentOption`).*
- **`useHomepageImageAsHeader`** (theme option) — inline homepage image vs. header-banner background
  (rule 7). *Owner: `website-appearance-settings`.*
- **`showDescriptionInJournalIndex`** (theme option, default **off**) — whether the journal
  description shows on the home page (rule 8). *Owner: `website-appearance-settings`.*
- **`homepageImage`, `additionalHomeContent`** (journal settings, multilingual) — the inline image
  and the raw-HTML custom content (rules 7, 10). Uploaded/edited on the Website appearance form.
  *Owner: `website-appearance-settings`.*
- **`description`** and **reader/author/librarian information** (journal settings) — the About text
  (rule 8) and the Information block's link lists (rule 13). *Owner: `journal-setup`.*
- **`enableAnnouncements` + `numAnnouncementsHomepage`** (journal settings) — both required to show
  the announcements section, and it caps how many (rule 9). *Owner: `announcements` (enable/content),
  surfaced here.*
- **`sidebar`** (journal setting, ordered array) — which block plugins render in the sidebar and in
  what order (rules 11–12). *Owner: `website-appearance-settings` (Sidebar management).*
- **Block-plugin enabled state** (per-plugin `enabled` setting) — gates whether a block can render at
  all (rule 11). *Owner: `plugin-management` / `website-appearance-settings`.*
- **`publishingMode`** (journal setting) — *do not publish online* (`NONE`) suppresses the
  current-issue section (rule 3). *Owner: `journal-setup` / `distribution-settings`.*
- **`currentIssueId`** (journal pointer) — which issue the current-issue section shows; set by
  `issue-management`. *Owner: `issue-management`.*
- **Highlights** (per-context/site `highlights`) — presence drives the carousel (rule 6). *Owner:
  `highlights-featured-content`.*
- **Active theme** — the whole option set above belongs to the active theme (`DefaultThemePlugin` in
  OJS); a different theme may expose different options or override `indexJournal.tpl`. *Owner:
  `website-appearance-settings`.*

## Cross-feature interactions

- **issue-management** (feature 35, verified) — owns *which* issue is current (`currentIssueId`) and
  the journal's `publishingMode`; this spec **renders** that current issue's TOC inline on the home
  page (rule 3). Its spec explicitly defers the current-issue home display here.
- **issue-archive-toc** (feature 40, not written) — owns the reader **archive**, **current-issue**
  and **single-issue** pages. Seam: the home page's current-issue section (rule 3) is a **separate
  surface** that reuses the same issue-TOC object template; the *"View all issues"* link jumps to
  that feature's archive page. `SCHEMA-issue` and the reader `PAGE-issue-*` atoms stay there.
- **highlights-featured-content** (feature 37, written) — owns highlight **CRUD/ordering** (the
  `HighlightsListPanel` Vue management surface in Settings → Website → Setup → Highlights). This spec owns the
  reader **carousel render** (rule 6, the Smarty `highlights.tpl`). **Atom transferred:**
  `VUE-highlights-list-panel` (the *management* panel, not rendered on the anonymous home page) is now owned by
  `highlights-featured-content`; this spec keeps only the reader render (no atom for the Smarty template).
- **announcements** (feature 64, not written) — owns announcement **content/management** and the
  reader announcement list/detail pages; this spec owns the home-page **announcements section**
  render (rule 9).
- **website-appearance-settings** (feature 57, not written) — owns the **theme options**, the
  **sidebar-management** config (the `sidebar` array), the homepage-image upload and custom-content
  editor. This spec owns the home page that **displays** all of them (rules 2, 7–12).
- **journal-setup** — owns the **description** and the reader/author/librarian info text the About
  section (rule 8) and Information block (rule 13) render; owns `DB-journal_settings`.
- **subscriptions** — owns the subscription **model** behind the Subscription block (rule 13) and the
  **galley download gate** the TOC links reach; neither hides anything on the home page.
- **browse-category-section** (feature 41, not written) — owns the **Browse block** atom
  (`PLUGIN-blocks-browse`) and the category/section landing pages; the home page merely places the
  browse block in its sidebar and can list categories (rule 5).
- **languages-locales** — owns UI-language configuration behind the Language-toggle block (rule 13).
- **site-settings** — owns the **site-index** branch of `IndexHandler` (rule 1, no journal in context).
- **article-landing** (feature 38, not written) — owns the article pages the current-issue TOC and
  recent-articles list link to.

## Canonical scenarios

1. **A reader lands on the journal home page (default: current issue)** — Anonymous visitor: opens
   `/publicknowledge`. The page loads with no login, showing the journal name/header, and — because
   the journal has issues, publishes online, and no custom display mode is set — the **current
   issue's** table of contents inline (*"Current Issue"*, *"Vol. 1 No. 2 (2014)"*, the section-grouped
   TOC, and a *"View all issues"* link to the archive). *(live-verified 2026-07-04 on `publicknowledge`.)*
2. **The display mode switches to recent articles / categories** — Manager sets the theme's
   *Journal content* option to *recent published* (a journal with no issues gets this by default): the
   home page's main column now shows a **paginated list of the latest published articles**
   (`itemsPerPage` per page) instead of an issue TOC; selecting *category listing* adds a category
   header. Verifies rule 2 / 4 / 5's mode selection.
3. **The highlights carousel appears when highlights are configured** — With ≥1 highlight curated
   (via `highlights-featured-content`), the reader sees a **Swiper carousel** across the top — image,
   title, description, and a button linking out per slide. With none configured (as on
   `publicknowledge`) the carousel is **absent**. *(both states live-verified 2026-07-04: the positive
   render is driven by the retained `journal-homepage.spec.js` on a scratch journal seeded with one
   image-less highlight — `.highlights`/`.swiper-slide`/`.swiper-slide-title` render + the slide button
   links to the highlight URL; absent-state live-verified on `publicknowledge`.)*
4. **The announcements section shows only when fully configured** — A manager who enables
   announcements **and** sets a non-zero *"announcements on the homepage"* count sees the newest
   active announcements in an in-content section (first as a full summary, the rest listed). A manager
   who enables announcements but leaves the count unset — the actual `publicknowledge` state — sees
   **no** announcements section. Verifies rule 9's two-part gate. *(both states live-verified 2026-07-04
   by the retained `journal-homepage.spec.js`: a scratch journal with `enableAnnouncements` + a
   non-zero `numAnnouncementsHomepage` + a seeded announcement renders `section.cmp_announcements`; the
   control journal — enabled but count unset, even *with* an announcement present — renders none.)*
5. **The homepage image and description follow their settings and theme options** — With a homepage
   image set and *use-as-header* off, the reader sees the image **inline**; turning *use-as-header* on
   moves it to the **page-header banner**. The journal description shows in an *About* section **only**
   if the theme's *show description* option is on (off by default) — so `publicknowledge`, which has a
   description but the option off, shows **no** About section. Verifies rules 7–8.
6. **The sidebar renders configured blocks in order — or nothing** — On a journal whose **sidebar
   array** lists, say, *Information* then *Language toggle*, the reader sees those blocks in that order
   in the sidebar; each shows only because it is both **enabled** and **listed**. A journal with an
   **empty sidebar** — every journal in the test DB — shows **no sidebar region** even though several
   block plugins ship "enabled". Verifies rules 11–13. *(both states live-verified 2026-07-04 by the
   retained `journal-homepage.spec.js`: a multilingual scratch journal whose `sidebar` array is
   `[languagetoggleblockplugin, informationblockplugin]` renders `.block_language` then
   `.block_information` in that array order; an empty-sidebar scratch journal renders no
   `.pkp_structure_sidebar` region.)*
7. **A journal that does not publish online (or has no current issue) suppresses the issue section** —
   Anonymous visitor on a journal set to *do not publish online*, or with no current published issue:
   the current-issue TOC section is **absent** (guarded by `publishingMode != NONE` and a current
   published issue), while the rest of the page shell (header, any highlights/description/custom
   content, sidebar) still renders. Verifies rule 3's guards.

## Known deviations (as-built ≠ intent)

- **⚠ Recent-published ordering (rule 4) — e2e ledger [§2 row 25](../../e2e/app-changes.md).** In
  `RECENT_PUBLISHED` mode the "latest published" list is ordered by **submission date**, not
  publication date (the branch sets no `orderBy`). A back-dated or late-published article sorts by
  when it was *submitted*, contradicting the "latest published" framing. Pre-existing ledger row
  (wave-7 homepage agent, observed live); the fix is a one-line `->orderBy(ORDERBY_DATE_PUBLISHED, DESC)`.
  This is the **only** ⚠ this page owns.
- **Seam ⚠ (not owned here) — issue-TOC within-section order, e2e ledger [§2 row 28](../../e2e/app-changes.md).**
  The current-issue section (rule 3) reuses `issue_toc.tpl`, whose within-section article order is
  undefined (`publications.seq` is all-zero until an editor uses custom TOC ordering). Its canonical
  home is `issue-archive-toc` (the shared TOC object); noted here only because the home page renders
  that object.
- **No *new* ⚠ found.** The remaining conditional rendering is internally consistent and reads as
  intended:
  - The **two-part announcements gate** (rule 9) and the **empty-by-default sidebar** (rules 11–12) are
    **not** UI-affordance contradictions: the home-page count field *reveals itself* below the enable
    toggle (rule 9's `showWhen`), and the Sidebar-management control presents the enabled blocks as an
    empty selection to *compose* (rule 12) — no affordance promises either surface renders on its own.
    Both are documented as plain rules; whether the *defaults* surprise a manager stays an Open question,
    not a ⚠ (calibration: neither loses data, contradicts an affordance, or is internally inconsistent).
  - **Description shown only when a theme option is on** (rule 8, off by default) is a theme design
    choice, not a defect.
  The campaign's live-probe of `publicknowledge` (re-run by the verifier 2026-07-04, anonymous, on the
  running server) matched the code-derived rules exactly: issue TOC present (*Vol. 1 No. 2 (2014)* /
  *View All Issues* / `obj_issue_toc`); highlights / announcements / About / sidebar all absent for the
  documented reasons.

## Open questions

1. **Is it intended that enabling announcements alone shows nothing on the home page?** As-built
   (rule 9) the announcements section requires **both** `enableAnnouncements` **and** a non-zero
   `numAnnouncementsHomepage`; `publicknowledge` has the former but not the latter, so its home page
   shows no announcements. Confirm the two-flag design is intended (vs. enabling announcements
   implying a sensible default home-page count). **Verifier (2026-07-04): kept as OQ, not ⚠.** The
   count field is on the *same* form and *reveals itself* below the enable toggle
   (`PKPAnnouncementSettingsForm`, `showWhen: enableAnnouncements`), so this is **not** a hidden-control
   / UI-affordance contradiction — only the empty *default* of a visible, labelled field ("Number of
   announcements to display on the homepage"). Announcements enabled without a count still power the
   dedicated `/announcements` page + nav; only the home-page section is a separate opt-in. Below the
   ⚠ bar — a plain rule + this intent question, no ledger row.
2. **Do fresh OJS journals ship a default sidebar, or is empty-by-default intended?** Every journal in
   the test DB has **no `sidebar` setting**, so no sidebar renders — even though *Information*,
   *Language toggle* and *Subscription* install `enabled=true` (*Make a submission* nominally ships
   `enabled=true` too but its default never installs — rule 13 / ledger row 122). A manager may
   reasonably expect "enabled" blocks to appear. Confirm whether an install should seed a default
   sidebar array or whether an empty sidebar (blocks added manually) is the intended default.
   **Verifier (2026-07-04): kept as OQ, not ⚠.** The Sidebar-management control (`PKPAppearanceSetupForm`,
   rule 12) presents the enabled blocks as an **empty orderable selection to compose** — no affordance
   presents any block as "already on/showing", so the empty default reads as intended (compose your
   own sidebar), not a config-contradicts-behaviour bug. A block's `enabled` flag governs whether it is
   *offered* here + can render, not whether it is *placed*. No ledger row.
3. **Atom seam — `VUE-highlights-list-panel`.** This atom is the highlights **management CRUD panel**
   (`HighlightsListPanel.vue`, rendered in `admin/settings.tpl` and `management/website.tpl` — the
   Settings → Website page), **not** rendered on the anonymous home page; the reader carousel is the
   Smarty `frontend/components/highlights.tpl` (no atom). It is claimed here per the current
   atlas/FEATURE-MAP coloring, but **ownership should transfer to `highlights-featured-content`** when
   that spec is written, with journal-homepage retaining only the reader render. Confirm at grooming.
   **Verifier (2026-07-04): confirmed the seam.** The atom *is* the management panel, not a reader
   surface — but `highlights-featured-content` (feature 37) is not yet written, so transferring now
   would leave the atom **unclaimed** (violating the atom-claim invariant). Correct resolution:
   **journal-homepage remains the interim owner with the transfer note in place** (atlas already tags
   it `journal-homepage (mgmt panel; seam → highlights-featured-content)`); the move happens when
   feature 37 lands. **RESOLVED 2026-07-04:** feature 37 (`highlights-featured-content`) is now written and has
   **taken ownership** of `VUE-highlights-list-panel`; this spec's atlas-claims no longer list it and journal-homepage
   retains only the reader carousel render (rule 6). The atlas `Claimed by` column now reads `highlights-featured-content`.
4. **Atom seam — the block plugins render site-wide, not only on the home page.** `PLUGIN-blocks-*`
   render in the sidebar of **every** frontend page (via `footer.tpl`), yet are claimed here as the
   canonical reader surface. `PLUGIN-blocks-browse` is left to `browse-category-section` (its owner in
   the FEATURE-MAP). Confirm at grooming that journal-homepage is the right home for the generic block
   atoms (vs. `website-appearance-settings`, which owns the sidebar *config*). **Verifier (2026-07-04):
   single-owner confirmed** — the 5 claimed `PLUGIN-blocks-*` (information, developedBy, languageToggle,
   makeSubmission, subscription) are claimed by **only** journal-homepage across all specs; `PLUGIN-blocks-browse`
   is correctly *unclaimed here* (atlas tag `→ browse-category-section`). The homepage is the canonical
   reader surface for the block *render*; the sidebar *config* stays with `website-appearance-settings`
   (rule 12). Interim home is fine until feature 57 lands.
5. **Atom ownership — `DB-journals` (RESOLVED, reassigned away 2026-07-06).** The `journals` entity is
   **no longer claimed here** — the core journal create/delete/enable/seq lifecycle belongs to
   `site-administration` (feature 67), which now owns `DB-journals`; `journal_settings` stays with
   `journal-masthead-settings`. This page merely *reads* the entity for homepage display, so it is
   referenced, not claimed. (Earlier interim ownership by journal-homepage was retired when the
   site-administration spec landed; atlas `db-entities.md` reassigned the atom the same day.)

---

<!-- REFERENCE MATERIAL — provenance and campaign bookkeeping, not product-owner narrative. -->

## Reference — entry points & surfaces

| Entry | Path | Atom |
|-------|------|------|
| Journal home page (journal in context) | `GET /{journalPath}` / `/{journalPath}/index` → `IndexHandler::index()` → `frontend/pages/indexJournal.tpl` | PAGE-index-index |
| Site index (no journal in context) | Same handler, journal-absent branch → `frontend/pages/indexSite.tpl` | PAGE-index-index *(branch owned by `site-settings`)* |
| Highlights carousel (reader render) | `frontend/components/highlights.tpl` (Swiper) — data from `PKPIndexHandler::getHighlights()` | *(render; management = VUE-highlights-list-panel)* |
| Highlights management panel (Settings → Website) | `HighlightsListPanel.vue` in `admin/settings.tpl` / `management/website.tpl` | VUE-highlights-list-panel *(seam → `highlights-featured-content`)* |
| Announcements section (home) | `frontend/objects/announcements_list.tpl` — gated by `enableAnnouncements` + `numAnnouncementsHomepage` | *(content atoms owned by `announcements`)* |
| Sidebar (site-wide) | `Templates::Common::Sidebar` hook → `PKPTemplateManager::displaySidebar()` → `footer.tpl` `pkp_structure_sidebar` | *(mechanism; block atoms below)* |
| Information block | `plugins/blocks/information` — reader/author/librarian info | PLUGIN-blocks-information |
| Language-toggle block | `plugins/blocks/languageToggle` — UI language selector | PLUGIN-blocks-languageToggle |
| Make-a-submission block | `plugins/blocks/makeSubmission` — submission CTA | PLUGIN-blocks-makeSubmission |
| Subscription block | `plugins/blocks/subscription` — subscription status/info | PLUGIN-blocks-subscription |
| Developed-by block (disabled by default) | `plugins/blocks/developedBy` — PKP credit | PLUGIN-blocks-developedBy |
| Browse block (atom owned by `browse-category-section`) | `plugins/blocks/browse` — browse by issue/section/author | *(PLUGIN-blocks-browse — not claimed here)* |
| Journal entity (homepage-display settings) | `journals` (+ `journal_settings`, read here) | *(DB-journals — owned by `site-administration`; read here, not claimed)* |

## Reference — code anchors

- **Handlers**: `pages/index/IndexHandler.php` (`index()` — journal vs site branch, display-mode
  selection, current-issue setup, homepage assigns, `UsageEvent`); `lib/pkp/pages/index/PKPIndexHandler.php`
  (`getHighlights()`, `_setupAnnouncements()`); `pages/issue/IssueHandler.php` (`setupIssueTemplate()`,
  reused for the home current-issue section).
- **Display modes**: `classes/journal/enums/JournalContentOption.php` (cases `ISSUE_TOC`/
  `RECENT_PUBLISHED`/`CATEGORY_LISTING`, `default()`, `getOptions()`).
- **Theme**: `plugins/themes/default/DefaultThemePlugin.php` (`init()` — options
  `journalContentOrganization`, `useHomepageImageAsHeader`, `showDescriptionInJournalIndex`,
  `displayStats`, `baseColour`, `typography`; Swiper carousel scripts; homepage-image-as-header CSS).
- **Templates**: `templates/frontend/pages/indexJournal.tpl` (the home layout — the OJS-owned
  template); `lib/pkp/templates/frontend/components/highlights.tpl` (carousel);
  `lib/pkp/templates/frontend/objects/announcements_list.tpl` (shared, no OJS override — the
  `{if $numAnnouncements && $announcements|@count}` gate); `templates/frontend/objects/issue_toc.tpl`
  (current-issue TOC, OJS-owned); `lib/pkp/templates/frontend/components/header.tpl` (`hasSidebar`) and
  `footer.tpl` (`Templates::Common::Sidebar` → `pkp_structure_sidebar`).
- **Sidebar / blocks**: `lib/pkp/classes/template/PKPTemplateManager.php` (`displaySidebar()`,
  `hasSidebar` assign); `lib/pkp/classes/plugins/BlockPlugin.php` (`getEnabled()`, `getContents()`);
  `lib/pkp/classes/plugins/PluginRegistry.php` (`loadCategory('blocks', true)`); block plugins under
  `plugins/blocks/*` (`*BlockPlugin.php`, `settings.xml` install defaults).
- **Announcements data**: `lib/pkp/classes/announcement/Announcement.php` (`withActiveByDate()`).
- **Schema/entity**: `lib/pkp/schemas/context.json` (`sidebar`, `homepageImage`,
  `additionalHomeContent`, `description`, `enableAnnouncements`, `numAnnouncementsHomepage`,
  `itemsPerPage`); `classes/migration/install/JournalsMigration.php` (`journals`, `journal_settings`).
</content>
</invoke>
