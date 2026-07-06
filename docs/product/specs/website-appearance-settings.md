---
name: website-appearance-settings
scope: How a journal manager shapes the journal's public look-and-feel — the Settings → Website page (owned here) with its Appearance tab group (theme + default-theme options, logo/thumbnail/homepage-image uploads, page footer, sidebar composition, custom CSS, favicon, extra home content) plus the Lists (pagination) and Date & Time (display formats) setup tabs, and the Custom Block Manager plugin that mints new sidebar blocks
shared: pkp-lib   # The page (ManagementHandler::website()), all five forms (PKPThemeForm/PKPAppearanceSetupForm/PKPAppearanceAdvancedForm/PKPListsForm/PKPDateTimeForm), the theme API and the upload pipeline live in lib/pkp. The OJS overlay is real: APP AppearanceSetupForm adds the Journal-thumbnail field, the default theme (DefaultThemePlugin, incl. the journalContentOrganization option) and the customBlockManager plugin are OJS-side, and OJS's TemplateManager wires pageFooter/itemsPerPage/numPageLinks into the reader templates.
status: verified
e2e-plans: [website-appearance]
atlas-claims:
  - PAGE-management-settings-website
  - VUE-theme-form
  - VUE-date-time-form
  - FORM-appearance-setup-form
  - FORM-pkp-appearance-setup-form
  - FORM-appearance-advanced-form
  - FORM-pkp-appearance-advanced-form
  - FORM-pkp-theme-form
  - FORM-pkp-date-time-form
  - FORM-pkp-lists-form
  - API-context-get-theme
  - API-context-edit-theme
  - PLUGIN-themes-default
  - PLUGIN-generic-customBlockManager
---

# Website appearance settings

## Purpose

Everything about how the journal *looks* to a reader — without touching what it *says* — is
configured on **Settings → Website**. This spec owns that page and, on it, the **Appearance** tab
group's **Theme** tab (pick the active theme; set the theme's own options — typography, colour,
whether the journal summary shows on the home page, what fills the home page's main column, whether
the homepage image becomes the header banner, whether usage-stats charts show on articles), its
**Setup** tab (upload the header **Logo**, the **Journal thumbnail** shown on the site's journal
list, the **Homepage Image**; write the **Page Footer**; compose the **Sidebar** from the enabled
block plugins) and its **Advanced** tab (upload a **Journal style sheet** that skins every public
page, a **Favicon**, and free-form **Additional Content** for the home page). It also owns two tabs
of the page's *Setup* group: **Lists** (how many items public lists show per page, and how many
numbered page links the pager offers) and **Date & Time** (the per-language display formats every
public date follows). Finally it owns the **Custom Block Manager** plugin, which lets a manager mint
brand-new sidebar blocks (a title + rich-text body) that then appear alongside the stock blocks in
the Sidebar picker.

It does **not** own the rest of the Settings → Website page: the *Editorial Masthead* appearance tab
(`editorial-masthead`), the Setup group's *Information* and *Privacy Statement* forms
(`journal-masthead-settings`), *Languages* (`languages-locales`), *Navigation* (`navigation-menus`),
*Announcements* (`announcements`), *Highlights* (`highlights-featured-content`), the *Plugins* tab
(`plugin-management`) or the *Content → Comments* tab (`public-comments`). Nor does it own the
public pages that display its settings — the home page and the sidebar/block **render** rules are
`journal-homepage`; the archive, article and announcement pages that show the paginated lists and
formatted dates belong to their own features. Theme/plugin *installation and enablement* is
`plugin-management`; this spec only consumes what is installed and enabled.

## Actors & permissions

One gate covers nearly everything: the page and all five forms sit behind the same
**settings-access** rule already verified by `journal-masthead-settings` (Actors table + rule 8
there): only a **site admin** or a **manager whose group carries *Permit settings*** may open any
Settings page or save through the journal-settings endpoint; everyone else is refused and sees no
Settings menu. The Theme tab saves to its **own endpoint** (`…/theme`) and the custom-block manager
runs through the legacy **plugin grid**, so those two carry their own (equivalent) gates, verified
live below. Reading the results — the themed pages, logos, footer, sidebar, dates — requires nothing
(anonymous surfaces, owned by the reader features).

| Action | Who may — and when |
|--------|--------------------|
| **Open Settings → Website** | • Site admin — always<br>• Manager — only with *Permit settings* (same single `settings` gate as Settings → Journal; owned by `journal-masthead-settings`/`roles-permissions`)<br>• Everyone else — refused, no Settings menu <sup>a</sup> |
| **Save Setup / Advanced / Lists / Date & Time** (journal-settings save) | • The same two groups — identical endpoint gate as the masthead forms; a role-less user's save is refused with the value unchanged (live-verified) <sup>b</sup> |
| **Change the theme / theme options** (theme endpoint) | • The same two groups — the theme endpoint carries the same settings-access policy; additionally it only works with the journal in scope (the site-wide API refuses, because the journal's plugins aren't loaded there) <sup>c</sup> |
| **Manage custom blocks** (create, edit, delete) | • Journal managers and site admins — via the Custom Block Manager plugin's *Manage Custom Blocks* grid (the plugin must be enabled first — `plugin-management`); a site-level variant exists for site admins when no journal is in scope <sup>d</sup> |
| **See the public results** (theme, logos, footer, sidebar, dates, pagination) | • Any visitor — no login; render rules owned by `journal-homepage` and the other reader features <sup>e</sup> |

<sup>a</sup> `SettingsHandler::__construct()` (`settings` op: site admin + manager); `ManagementHandler::authorize()` (`CanAccessSettingsPolicy`) — the one gate, verified by `journal-masthead-settings` incl. the Website page specifically · live 2026-07-06: `dbuskins` (no role on scratch `j-was1`) → `roleBasedAccessDenied` on the page ·
<sup>b</sup> `PKPContextController::getGroupRoutes()` (`roleAuthorizer([SITE_ADMIN, MANAGER])` on `PUT contexts/{contextId}`) + `PKPContextController::authorize()` (`CanAccessSettingsPolicy`) · live: `dbuskins` `PUT contexts/316` → 401 ·
<sup>c</sup> Same route group + `PKPContextController::editTheme()` (context-required refusal for the site-wide API; plus an explicit in-handler `array_intersect([SITE_ADMIN, MANAGER], userRoles)` re-check) · live: `dbuskins` `PUT contexts/316/theme` → 401; `dbarnes` (manager) → 200; verifier 2026-07-06 — a manager whose group's *Permit settings* is stripped → **401 on `/theme` GET and PUT** (same `CanAccessSettingsPolicy`, so the theme endpoint is gated identically to the settings PUT, not merely by role) ·
<sup>d</sup> `CustomBlockGridHandler::__construct()` (`ROLE_ID_MANAGER`, `ROLE_ID_SITE_ADMIN` on all five ops); `authorize()` (`ContextAccessPolicy` in a journal, `PKPSiteAccessPolicy` site-wide); `CustomBlockManagerPlugin::isSitePlugin()` ·
<sup>e</sup> `IndexHandler::index()` and friends — public, no policy (owned by `journal-homepage` etc.)

## Fields & validation

Five forms. All except Theme submit to the **journal-settings endpoint** (shared save semantics —
multilingual per-locale writes, viewer-locale fallback on public pages — are
`journal-masthead-settings` rule 2 and are not repeated here). The Theme form submits to the
**theme endpoint** (rule 3). Uploads run through the shared **temporary-files** pipeline (rule 5).
Nothing on these forms is required except the two Lists numbers; all live-verified on scratch
journal `j-was1` (multilingual fields offered per enabled form locale — en + fr_CA there).

**Theme form** (Appearance → Theme; a special form that swaps its option fields when the theme
selection changes):

| Field (UI label) | Required? | Rules | Anchor |
|------------------|-----------|-------|--------|
| Theme | — | Select over the **installed & enabled** theme plugins; only *Default Theme* ships in this environment, so the list has one entry. Saving a theme that isn't installed/enabled is rejected ("The theme you selected is not installed or enabled." — live-verified 400, value untouched). | `PKPThemeForm` (`themePluginPath`); `PKPContextService::validate()` (installed-theme after-hook) |
| Typography | No | Radio, 7 font pairings (Noto Sans; Noto Serif; Serif/Sans combos; Lato; Lora; Lora/Open Sans). Default **Noto Sans**. Switches which font CSS the public pages load (live: Lora `@font-face` served after the switch). | `DefaultThemePlugin::init()` (`typography` option) |
| Colour | No | Colour picker for the header background. Default `#1E6292`. An invalid value (only craftable via the API — the picker constrains the UI) is **silently discarded** back to the default, not rejected (live: 200, stored null; a deliberate XSS guard). | `DefaultThemePlugin::saveOption()` (hex-pattern guard, pkp/pkp-lib#11974) |
| Journal Summary | No | Checkbox "show the journal summary on the home page"; default **off**. The summary text itself is `journal-masthead-settings`'. | `DefaultThemePlugin::init()` (`showDescriptionInJournalIndex`) |
| Journal Content Organization | No | Checkbox set choosing what fills the home page's main column: current-issue TOC / recent published articles / category listing (multi-select). Default computed: current-issue if the journal has any issue, else recent-published. Render rules owned by `journal-homepage` (rules 2–5 there). | `DefaultThemePlugin::init()` (`journalContentOrganization`); `JournalContentOption::default()` |
| Header Background Image | No | Checkbox; default off. When on **and** a Homepage Image is set, the image becomes the page-header background instead of an inline home-page image (rule 6). | `DefaultThemePlugin::init()` (`useHomepageImageAsHeader`) |
| Usage statistics display options | No | Radio none / bar chart / line chart; default none. Controls the usage-stats graph on article landing pages (`article-landing` / `usage-statistics` render). | `DefaultThemePlugin::init()` (`displayStats`) |

**Setup form** (Appearance → Setup):

| Field (UI label) | Required? | Rules | Anchor |
|------------------|-----------|-------|--------|
| Logo | No | Image upload (widget offers any `image/*` — client-side only; the server does no type check, rule 5), **per locale** with alt text. Renders in the page header of every public page; without one the journal name renders as text. A locale without its own logo falls back to the primary locale's (live: French pages show the English logo). | `PKPAppearanceSetupForm` (`pageHeaderLogoImage`); `header.tpl` (`$displayPageHeaderLogo`) |
| Journal thumbnail | No | Image upload, per locale + alt text. **OJS-added field**: the small image beside the journal's entry on the multi-journal **site index**. | `AppearanceSetupForm` (`journalThumbnail`, APP override); `indexSite.tpl` |
| Homepage Image | No | Image upload, per locale + alt text. Shown inline on the home page — or as the header banner when the theme option is on (rule 6). | `PKPAppearanceSetupForm` (`homepageImage`); `indexJournal.tpl` |
| Page Footer | No | Multilingual rich text. Renders in the footer of **every** public page, in the viewer's locale (live: en + fr footers). | `PKPAppearanceSetupForm` (`pageFooter`); OJS `TemplateManager::initialize()`; `footer.tpl` |
| Sidebar | No | **Orderable multi-select whose options are exactly the enabled block plugins** (stock blocks + any custom blocks + plugin-provided blocks like Web Feed). Checked entries, in their drag order, are the journal's sidebar. Saving a name that isn't an enabled block is rejected ("The X block can not be found…" — live 400). Ships empty (no sidebar). Render rules: `journal-homepage` rules 11–13. | `PKPAppearanceSetupForm` (`sidebar`, `isOrderable`, options from `PluginRegistry::loadCategory('blocks', true)`); `PKPContextService::validate()` (sidebar after-hook) |

**Advanced form** (Appearance → Advanced):

| Field (UI label) | Required? | Rules | Anchor |
|------------------|-----------|-------|--------|
| Journal style sheet | No | Single file upload, **`.css` only** (upload-widget filter, client-side only — the server accepts any type, rule 5; max size = the PHP upload limit). Linked **late-priority on every public page** (after the theme's CSS, so it wins ties), with a cache-busting query string from the upload date. Uploading a replacement re-busts; clearing removes the link — ⚠ but **not the file**, which stays served at its URL (row 123). | `PKPAppearanceAdvancedForm` (`styleSheet`, `acceptedFiles: .css`); `PKPTemplateManager::initialize()` (`contextStylesheet`, `STYLE_SEQUENCE_LATE`) |
| Favicon | No | Image upload; the widget offers `image/x-icon,image/png,image/gif` (client-side filter only — the server does no type check, rule 5), per locale. Emitted as the `<link rel="icon">` of **both** the public pages and the backend (live on reader + archive pages). | `PKPAppearanceAdvancedForm` (`favicon`); `PKPTemplateManager::initialize()` (`addHeader('favicon')`) |
| Additional Content | No | Multilingual rich text appended verbatim at the bottom of the home page (render: `journal-homepage` rule 10). | `PKPAppearanceAdvancedForm` (`additionalHomeContent`) |

**Lists form** (Setup → Lists):

| Field (UI label) | Required? | Rules | Anchor |
|------------------|-----------|-------|--------|
| Items per page | Yes | Integer ≥ 1 (0 rejected: "This must be at least 1." — live 400). Default 25. How many items the public paginated lists show per page (rule 8). | `PKPListsForm` (`itemsPerPage`); `context.json` (`min:1`, default 25) |
| Page links | Yes | Integer ≥ 1, default 10. How many numbered page links the pager bar offers at once (rule 8). | `PKPListsForm` (`numPageLinks`); `context.json` (`min:1`, default 10) |

**Date & Time form** (Setup → Date & Time) — five **per-locale** choices, each a radio over
presets **plus a free "Custom" input** taking PHP `DateTime::format()` codes. None required; a
locale left unset falls back to the server-config default for that format:

| Field (UI label) | Required? | Rules | Anchor |
|------------------|-----------|-------|--------|
| Date | No | Long date, per locale. Presets `F j, Y` · `F j Y` · `j F Y` · `Y F j` + custom. | `PKPDateTimeForm` (`dateFormatLong`) |
| Date (Short) | No | Short date, per locale. Presets `Y-m-d` · `d-m-Y` · `m/d/Y` · `d.m.Y` + custom. **This is the format the reader-facing dates use** (rule 7). | `PKPDateTimeForm` (`dateFormatShort`) |
| Time | No | Per locale. Presets `H:i` · `h:i A` · `g:ia` + custom. | `PKPDateTimeForm` (`timeFormat`) |
| Date & Time / Date & Time (Short) | No | Per locale; the offered preset is composed live from the currently chosen date + time formats, plus a custom input. | `PKPDateTimeForm` (`datetimeFormatLong`, `datetimeFormatShort`) |

**Custom block form** (Website → Plugins → Custom Block Manager → *Manage Custom Blocks* → Add
Block — a legacy modal form, not a Vue form):

| Field (UI label) | Required? | Rules | Anchor |
|------------------|-----------|-------|--------|
| Block name | Yes | Multilingual text; the block's internal name is derived from it (lower-kebab-case of the title in the current UI language, suffixed to stay unique) and **cannot change afterwards** — editing updates title/content under the same name. | `CustomBlockForm` (`blockTitle`, `FormValidator required`); `CustomBlockForm::execute()` (kebab + `uniqid` on collision) |
| Content | No | Multilingual rich text — the block's body. Shown in the viewer's locale, falling back to the journal's primary locale. | `CustomBlockForm` (`blockContent`); `CustomBlockPlugin::getContents()` |
| Show Name | No | Checkbox: display the block title as a visible heading; unchecked keeps the title for screen readers only. | `CustomBlockForm` (`showName`); plugin `templates/block.tpl` (`pkp_screen_reader`) |

## Rules & state

No state machine — every rule is "save a setting, the public surfaces follow on next load". The one
wrinkle is the Theme tab, which has its own endpoint and storage.

1. **The Settings → Website page hosts four tab groups; this spec owns the page and six of its
   tabs.** Top tabs: **Appearance** (side tabs Theme / Setup / *Editorial Masthead* / Advanced),
   **Setup** (Information / Languages / Navigation / Announcements / Highlights / **Lists** /
   Privacy Statement / **Date & Time**), **Plugins**, **Content** (Comments). Owned here: the page,
   Theme, Appearance-Setup, Advanced, Lists, Date & Time (all tab labels live-verified). The rest
   belong to the features named in Purpose. *(anchor: `ManagementHandler::website()` (builds all the
   forms); `lib/pkp/templates/management/website.tpl` (the tab tree))*
2. **Four of the five forms are ordinary journal-settings saves.** Setup, Advanced, Lists and
   Date & Time submit their field set to the journal-settings endpoint; validation, per-locale
   write semantics and the settings-access gate are exactly `journal-masthead-settings` rules 2/3/8
   (one endpoint, one gate — not repeated). Effects are immediate on the next public page load.
   *(anchor: `PKPContextController::edit()`; forms' `$method = 'PUT'`, action = `contexts/{id}`)*
3. **The Theme tab saves through its own endpoint, and theme options live outside the journal
   settings.** Saving posts the selected theme plus that theme's option values to the theme
   endpoint, which (a) validates a *changed* theme name against the installed-and-enabled theme
   plugins (bogus name → 400, nothing saved — live-verified), (b) stores the theme name as the
   journal setting `themePluginPath`, (c) hands each option to the **theme plugin itself**, which
   stores them as *plugin settings* per journal, ignoring params that aren't declared options, and
   (d) clears the template and CSS caches so the change is visible immediately (live: one save →
   next anonymous page load reflects it). Reading the tab shows only the **active** theme's current
   option values; the form carries a separate field store per installed theme and swaps fields when
   the selection changes (one theme installed here, so nothing to swap). *(anchor:
   `PKPContextController::editTheme()`; `PKPContextService::validate()` (installed-theme hook);
   `ThemePlugin::saveOption()`/`getOptionValues()` (plugin_settings); `PKPThemeForm::getConfig()`
   (`themeFields`); `ThemeForm.vue`)*
4. **The default theme's options restyle the public site without touching content** (all
   live-verified on `j-was1`): *Typography* switches the font stylesheet the pages load (Lora
   `@font-face` after switching); *Colour* recompiles the theme's LESS with the new base colour
   (`#FF0000` → nine `#f00` rules in the served CSS, default blue gone); *Journal Summary* adds the
   "About the Journal" block to the home page; *Header Background Image* moves the homepage image
   into the header (rule 6); *Journal Content Organization* and *Usage statistics* change surfaces
   owned by `journal-homepage` / `article-landing`. An **invalid colour value is silently reset to
   the default** — the save succeeds and no error is shown; unreachable from the UI's colour picker,
   so a plain note, not a deviation. *(anchor: `DefaultThemePlugin::init()` (LESS variables per
   option); `DefaultThemePlugin::saveOption()` (colour guard))*
5. **Uploads flow through temporary files into the journal's public directory under canonical
   names.** The widget uploads to the temporary-files API; saving the form sends the temporary-file
   id; the server verifies the file exists **and belongs to the saving user**, moves it to
   `public/journals/{id}/` renamed to `{setting}_{locale}.{ext}` (`styleSheet.css` — not localized),
   deletes the temporary file, and stores name/size/alt-text metadata in the setting (live: all five
   uploads landed under the canonical names and served back). Saving **null clears the setting and
   deletes the public file** — for the **image** fields; ⚠ for the **style sheet** the file is NOT
   deleted: the clear branch passes the stored metadata array where a filename string is expected,
   so the delete silently no-ops and `styleSheet.css` stays served at its URL after the link is gone
   (row 123, test-author live 2026-07-06; Known deviations). **The type restrictions are enforced
   only in the browser** — the `acceptedFiles` widget filters (favicon ico/png/gif, style sheet
   `.css`, logos/homepage/thumbnail any image) are client-side hints; the temporary-files API and the
   settings save apply **no** server-side MIME/extension whitelist (`temporaryFilesExist()` checks only
   that the temp file exists and the saving user owns it), and no dimension constraints. The stored
   file's extension is derived from its **detected MIME type**, so a type outside the
   document/image maps is saved with **no extension** — live 2026-07-06: a hand-crafted `.php` or a
   script-bearing `.svg` PUT as the logo is accepted and stored as an extension-less
   `pageHeaderLogoImage_en`, served raw at its public URL (the `.php` is served as **source, not
   executed** — the MIME-derived rename strips the `.php` extension). This does not widen a manager's
   reach — the same account already injects arbitrary HTML/JS into public pages through the legitimate
   rich-text *Additional Content* and *Page Footer* fields (same origin, same trust boundary) — so it
   is a note, not a ⚠ deviation (Open question 4). *(anchor:
   `ValidatorFactory::temporaryFilesExist()` (in `PKPContextService::validate()` — no type check);
   `PKPContextService::_saveFileParam()` / `moveTemporaryFile()` (extension from
   `FileManager::getDocumentExtension`/`getImageExtension`); `PKPTemporaryFilesController::uploadFile()`
   (no type filter))*
6. **Each visual asset has exactly one render point** (all live-verified): Logo → header of every
   public page (with width/height/alt from the upload; journal-name text when absent); Journal
   thumbnail → the site index's journal list; Favicon → `<link rel="icon">` on public **and**
   backend pages; custom style sheet → late-priority `<link>` on every public page (wins over theme
   CSS; cache-busted); Page Footer → every public page's footer, per locale; Homepage Image →
   inline `<div class="homepage_image">` on the home page, **or**, with the theme's *Header
   Background Image* option on, an inline style making it the header background while the inline
   image disappears (both states live-verified). *(anchor: `PKPTemplateManager::initialize()`
   (logo/favicon/styleSheet assigns); OJS `TemplateManager::initialize()` (pageFooter, publicFilesDir);
   `header.tpl`, `footer.tpl`, `indexJournal.tpl`, `indexSite.tpl`;
   `DefaultThemePlugin::init()` (homepage-image-as-header CSS))*
7. **Date formats are per-language display rules applied wherever a public date renders.** Every
   page render receives the journal's five formats (viewer's locale, falling back to the
   server-config defaults when a locale has no value); the reader surfaces — issue "Published"
   dates, article landing published/updated dates, announcement dates — use the **short date**
   format (live: after setting en `d.m.Y` / fr `d/m/Y`, the same page showed `05.07.2026` in
   English and `05/07/2026` in French). The long/time/date-time formats feed editorial and admin
   surfaces (e.g. system information) and share the same fallback chain. Formats are PHP
   `DateTime::format()` codes; the "Custom" radio option accepts any such string. *(anchor:
   `PKPTemplateManager::initialize()` (the five format assigns via
   `Context::getLocalizedDateFormat*()`); `Context::getDateTimeFormats()` (config fallback per
   locale); `issue_toc.tpl` / `article_details.tpl` / `announcements_list.tpl`
   (`|date_format:$dateFormatShort`, `->format($dateFormatShort)`))*
8. **Items-per-page paginates the public lists; page-links caps the pager.** `itemsPerPage` slices
   the issue **archive** (live: set to 1 → the archive showed one issue with a page-2 link; page 2
   served the other issue), the home page's recent-published list, search results and the other
   iterated public lists (plus legacy grids via the shared range helper); `numPageLinks` caps how
   many numbered links the `{page_links}` pager bar shows at once (search/category/recent lists;
   code-anchored — exercising it needs > numPageLinks result pages). Both fall back to the
   server-config values where a journal is not in context. *(anchor: `IssueHandler::archive()`
   (`itemsPerPage`); `IndexHandler::index()` (recent-published paginator);
   `PKPHandler::getRangeInfo()`; OJS `TemplateManager::initialize()` (context overrides the config
   assigns); `PKPTemplateManager::smartyPageLinks()` (`$numPageLinks`, hard default 10))*
9. **A custom block is a real block plugin minted from settings.** Creating one (Block name +
   Content + Show Name) derives a permanent internal name from the title (kebab-case, unique),
   appends it to the manager plugin's per-journal `blocks` list, marks the new block **enabled**
   immediately, and stores title/content/show-name as its plugin settings. From that moment the
   block is **offered in the Sidebar picker** exactly like a stock block (live: "Reading List" →
   `reading-list` appeared in the options and, once checked, rendered first in the sidebar with its
   visible title and body). Editing updates the settings under the same name. Blocks render in the
   viewer's locale with primary-locale fallback. The site-level variant (no journal in scope) does
   the same against site-wide settings, for site admins. *(anchor: `CustomBlockForm::execute()`;
   `CustomBlockManagerPlugin::register()` (registers each listed block);
   `CustomBlockPlugin::getContents()`; `PKPAppearanceSetupForm` (options from
   `loadCategory('blocks', true)`))*
10. **⚠ Deleting a custom block crashes — on PostgreSQL the delete always fails with a server
    error and the block survives intact** (ledger row 121). The delete action calls a plugin-settings
    delete whose SQL names a non-existent column (`plugin_Name` — a case typo Postgres rejects,
    MySQL's case-insensitive columns masked); live: delete → HTTP 500, the block still renders
    publicly, still sits in the grid and the sidebar. Secondary (code-read): even where the SQL
    works, the handler never deletes the block's `blockTitle`/`showName` settings — invisible
    residue. Mechanism + blast radius in Known deviations. *(anchor:
    `PluginSettingsDAO::deleteSetting()` / `deleteSettingsByPlugin()` (`where('plugin_Name', …)`);
    `CustomBlockGridHandler::deleteCustomBlock()`)*
11. **The Sidebar picker is self-consistent with block liveness, and stale entries are harmless.**
    The options list re-derives from the enabled block plugins on every page load — enabling a block
    plugin in the Installed Plugins grid adds it to the picker (live: enabling *Make a Submission*
    made `makesubmissionblockplugin` appear); a saved sidebar entry whose block later disappears or
    is disabled simply stops rendering (the render loop skips unknown names — `journal-homepage`
    rule 11) and drops off on the next sidebar save. ⚠ One stock block is broken at the source:
    **the "Make a Submission" block ships a default-enabled settings file that never installs**
    (the plugin doesn't register its settings file for new journals), so on every journal it starts
    disabled — absent from the picker until a manager enables it in Installed Plugins — contradicting
    the shipped default and the sibling spec's "ships enabled" claim (ledger row 122; live-verified:
    no `enabled` row on any journal incl. the seed journal, unchecked in the plugin grid, absent
    from the picker until enabled). *(anchor: `MakeSubmissionBlockPlugin` (no
    `getContextSpecificPluginSettingsFile()` override — contrast `InformationBlockPlugin`);
    `plugins/blocks/makeSubmission/settings.xml` (`enabled=true`, dead);
    `PKPContextService::validate()` (sidebar names checked against enabled blocks))*

## Side effects

- **No emails, notifications or event-log entries** from any save in this feature.
- **Files**: uploads write (and clearing deletes) files in the journal's public directory
  (`public/journals/{id}/`); temporary files are consumed on save (rule 5).
- **Caches**: a theme save clears the template cache and the compiled-CSS cache so the restyle is
  immediate (rule 3); the custom style sheet link carries an upload-date cache-buster (rule 6).
- **Storage**: theme options and custom-block definitions live in **plugin settings** (per
  journal), not journal settings — exporting/copying journal settings alone won't carry them.
  Everything else here is a `journal_settings` row.

## Settings that modify behavior

- **Permit settings** (per manager group; `roles-permissions`) — the single access switch (Actors).
- **Installed/enabled themes and block plugins** (`plugin-management`) — define what the Theme
  select and the Sidebar picker can offer (rules 3, 11). The Custom Block Manager plugin itself
  must be enabled before the *Manage Custom Blocks* action exists.
- **Enabled form locales** (`languages-locales`) — which locale tabs the multilingual fields and
  the per-locale date formats offer.
- **`config.inc.php`** `date_format_short/long`, `time_format`, `datetime_format_short/long`,
  `items_per_page`, `page_links` — the site-wide fallbacks when a journal (or locale) has no value
  (rules 7–8).
- **`restrictSiteAccess`** (`site-access-restrictions`) — walls the public render surfaces; no
  effect on the forms.
- **Site-level counterparts** (`site-settings`) — the site has its own appearance/theme/lists
  forms and its own style sheet (served on no-journal pages); independent of this journal-level
  feature.

## Cross-feature interactions

- **journal-homepage** — owns every home-page and sidebar **render** rule this feature configures
  (display modes, homepage image/description/custom content placement, sidebar two-gate render,
  block inventory). Reciprocal: its "Settings that modify behavior" names this spec as config owner.
- **journal-masthead-settings** — owns the shared settings-endpoint semantics + the one
  settings-access gate (referenced, not re-proven) and the Privacy/Information forms on this same
  page; its *Journal Summary* text is what this spec's theme option reveals.
- **editorial-masthead** — owns the Appearance group's *Editorial Masthead* tab.
- **highlights-featured-content / announcements / navigation-menus / languages-locales /
  public-comments / plugin-management** — own the other tabs listed in rule 1; plugin-management
  additionally owns theme/block/plugin enablement and the Installed Plugins grid the custom-block
  *Manage* action lives in.
- **issue-archive-toc / article-landing / site-search** — own the public pages where `itemsPerPage`
  / `numPageLinks` / the date formats / `displayStats` are experienced.
- **site-settings** — the site-level twins (site appearance form, site style sheet, site theme
  endpoint, site sidebar) and the site index that renders the journal thumbnail.
- **rest-api / temporary-files plumbing** (Background) — the upload primitive (rule 5).

## Canonical scenarios

1. **Restyle the journal from the Theme tab** — Manager on Settings → Website → Appearance → Theme:
   switches Typography to Lora, picks a new Colour, ticks *Journal Summary*. After one save an
   anonymous reader's next load serves the Lora font CSS, the recompiled theme CSS in the new
   colour (old default colour gone), and the home page gains the "About the Journal" block.
   *(live-verified 2026-07-06 on scratch `j-was1`.)*
2. **Brand the journal with images** — Manager uploads a Logo, Journal thumbnail, Homepage Image
   (Appearance → Setup) and a Favicon (Advanced), each with alt text. The header of every public
   page shows the logo (alt intact; French pages fall back to the English logo), the site index
   shows the thumbnail beside the journal, the home page shows the inline homepage image, and the
   favicon link appears on public + backend pages. Ticking the theme's *Header Background Image*
   moves the homepage image into the header banner and removes the inline image. *(live-verified.)*
3. **Skin every page with custom CSS and a footer** — Manager uploads a `.css` file (only `.css`
   accepted) and writes a Page Footer in both languages. Every public page now links the journal
   stylesheet after the theme's (the custom rule wins) with a cache-busting stamp, and renders the
   locale-correct footer. Clearing the stylesheet removes the link — ⚠ but the file survives and
   keeps being served at its URL (row 123). *(upload + link + served CSS + per-locale footer
   live-verified by the spec author; the clear behavior live-verified by the test author
   2026-07-06 — the original "and the file" claim was a code-read miss.)*
4. **Compose the sidebar** — Manager opens Appearance → Setup → Sidebar: the picker offers exactly
   the enabled block plugins; they check Language Toggle then Information and drag the order. The
   public sidebar renders those blocks in that order. A save naming a non-existent block is
   refused with "The X block can not be found…". Enabling another block plugin (Installed Plugins)
   makes it appear in the picker. *(live-verified, incl. the invalid-name 400 and the
   enable→offered loop on the Make-a-Submission block.)*
5. **Mint a custom sidebar block — and hit the delete bug** — Manager enables Custom Block Manager,
   opens *Manage Custom Blocks*, adds "Reading List" with rich-text content and *Show Name* on. The
   block appears in the Sidebar picker; once placed, the public sidebar shows it with its visible
   title and body ahead of the stock blocks. Attempting to **delete** the block fails with a server
   error and the block remains everywhere (⚠ row 121 — PostgreSQL). *(live-verified.)*
6. **Localized dates follow the journal's formats** — Manager sets Date (Short) to `d.m.Y` for
   English and `d/m/Y` for French on Setup → Date & Time. The home page's announcement and
   current-issue "Published" dates immediately render `05.07.2026` on the English pages and
   `05/07/2026` on the French ones; unset formats keep the server defaults. *(live-verified.)*
7. **Pagination bounds and the permission wall** — Manager sets Items per page to 1 (Setup →
   Lists): the two-issue archive splits into two pages with a next-page link; saving 0 is refused
   ("This must be at least 1."). A user with no settings role is refused the Website page and gets
   authorization errors from both save endpoints (settings + theme), values unchanged.
   *(live-verified.)*

## Known deviations (as-built ≠ intent)

- ⚠ **Custom blocks cannot be deleted on PostgreSQL — the delete action 500s and changes nothing**
  (**ledger row 121**, new). `PluginSettingsDAO::deleteSetting()` (and its uncalled sibling
  `deleteSettingsByPlugin()`) filter on `plugin_Name` — a column-name case typo. MySQL's
  case-insensitive identifiers masked it; PostgreSQL rejects the statement, so
  `CustomBlockGridHandler::deleteCustomBlock()`'s first delete throws and the whole action dies
  before touching the block list. Live: delete → HTTP 500 (`Undefined column … HINT: perhaps you
  meant plugin_name`), block still in grid/picker/public sidebar. Also reachable from
  `ThemePlugin::saveOption()`'s empty-string branch, though the API can't hit it (the framework
  converts `""` to null in requests). Secondary: the handler deletes only
  `enabled/context/seq/blockContent`, never `blockTitle`/`showName` — harmless residue once the SQL
  is fixed. Suspected intent: trivial typo; fix `plugin_Name` → `plugin_name` in both methods.
- ⚠ **The "Make a Submission" block ships default-enabled but the default never installs — the
  block is effectively disabled-by-default everywhere** (**ledger row 122**, new).
  `plugins/blocks/makeSubmission/settings.xml` sets `enabled=true`, but the plugin class is the
  only stock block that doesn't override `getContextSpecificPluginSettingsFile()`, so no journal
  ever gets the row: the block is unchecked in Installed Plugins, absent from the Sidebar picker,
  and can never render until manually enabled (live-verified on the seed journal and a scratch
  journal; enabling it by hand works and it then appears in the picker). This contradicts
  `journal-homepage` rule 13's "ships enabled" (a code-read of the dead settings.xml) — that spec
  should drop makeSubmission from its enabled-by-default list at grooming. Suspected intent: the
  override was simply forgotten; add it (as in `InformationBlockPlugin`).
- ⚠ **Clearing the journal style sheet leaves the file publicly served — only the link and the
  setting go away** (**ledger row 123**, new — found at test authoring 2026-07-06). The null-clear
  branch of `PKPContextService::_saveFileParam()` picks the file to delete as
  `$isImage ? $setting['uploadName'] : $setting`, but the non-image `styleSheet` setting stores the
  same metadata **array** the method itself returns on upload — so `removeContextFile()` gets an
  array where a filename belongs and the delete no-ops. Live: `PUT contexts/{id}` `{styleSheet:
  null}` → 200, no `<link>` on the next anonymous load, yet `GET public/journals/{id}/styleSheet.css`
  still 200 with the old content. The image fields (`$isImage=true`) delete correctly. Suspected
  intent: trivial shape mismatch; fix to `is_array($setting) ? $setting['uploadName'] : $setting`.
  This spec originally claimed "clearing … deletes the file" (code-read) — corrected in rule 5,
  the Advanced-form field table and scenario 3.
- **Note — invalid theme colour is silently discarded** (rule 4): an API save with a non-hex
  colour returns success and stores nothing, so the theme silently reverts to the default colour.
  A deliberate injection guard (pkp/pkp-lib#11974) with no UI path to trigger it — recorded as a
  plain rule, not a ⚠ (Open question 2).
- **Referenced, owned elsewhere:** the settings endpoint's missing per-field authority guard
  (manager can PUT admin-only journal props) is **row 118** (`site-access-restrictions` /
  `site-administration`) — it rides the same `PUT contexts/{id}` these forms use.

## Open questions

1. **Should custom-block deletion also purge `blockTitle`/`showName`** (and should re-creating a
   block under a previously-used name be guaranteed clean), once the row-121 typo is fixed? One
   sentence decides whether the fix is the SQL alone or the handler's setting list too.
2. **Should an invalid theme-option value fail loudly?** As-built an out-of-pattern colour is
   silently dropped to the default (API-only path). Confirm silent-reset is preferred over a 400.
3. **Are the long/time/date-time formats intentionally without a default-theme reader surface?**
   Only the short date renders on the stock public pages; the other four formats surface in
   editorial/admin contexts. Confirm no reader surface is expected to use them (otherwise a theme
   gap).
4. **Should the upload type filters be enforced server-side?** As-built the favicon/style-sheet/image
   `acceptedFiles` restrictions are client-side widget hints only — the temporary-files API and the
   settings save apply no MIME/extension whitelist, so a hand-crafted `.php`/`.svg` is accepted and
   stored extension-less (verifier live 2026-07-06: served raw, `.php` **not** executed). Not raised
   as a ⚠ because the actor is a manager who already holds an equivalent raw-HTML surface (*Additional
   Content* / *Page Footer*) — no privilege gained, no RCE. Confirm whether defence-in-depth
   server-side validation is wanted anyway (no ledger row proposed pending that call).

---

<!-- REFERENCE MATERIAL — provenance and campaign bookkeeping, not product-owner narrative. -->

## Reference — entry points & surfaces

| Entry | Path | Atom |
|-------|------|------|
| Settings → Website page | `GET {journal}/management/settings/website` → `ManagementHandler::website()` → `lib/pkp/templates/management/website.tpl` | PAGE-management-settings-website |
| Theme form | Appearance → **Theme** → `PKPThemeForm` + `ThemeForm.vue` → `PUT api/v1/contexts/{id}/theme` | FORM-pkp-theme-form, VUE-theme-form, API-context-edit-theme |
| Theme read | `GET api/v1/contexts/{id}/theme` (active theme + option values) | API-context-get-theme |
| Appearance Setup form | Appearance → **Setup** → APP `AppearanceSetupForm` extends `PKPAppearanceSetupForm` → `PUT api/v1/contexts/{id}` | FORM-appearance-setup-form, FORM-pkp-appearance-setup-form |
| Appearance Advanced form | Appearance → **Advanced** → APP `AppearanceAdvancedForm` (empty override) extends `PKPAppearanceAdvancedForm` → `PUT api/v1/contexts/{id}` | FORM-appearance-advanced-form, FORM-pkp-appearance-advanced-form |
| Lists form | Setup → **Lists** → `PKPListsForm` → `PUT api/v1/contexts/{id}` | FORM-pkp-lists-form |
| Date & Time form | Setup → **Date & Time** → `PKPDateTimeForm` + `DateTimeForm.vue` → `PUT api/v1/contexts/{id}` | FORM-pkp-date-time-form, VUE-date-time-form |
| Default theme (options + render) | `plugins/themes/default/DefaultThemePlugin.php` — options registered in `init()`, stored per journal in plugin settings | PLUGIN-themes-default |
| Custom Block Manager | Website → Plugins → Custom Block Manager → *Manage Custom Blocks* → `CustomBlockGridHandler` (component router `plugins/generic/custom-block-manager/controllers/grid/custom-block-grid/*`) | PLUGIN-generic-customBlockManager |
| Upload primitive *(not this feature)* | `POST api/v1/temporaryFiles` (then consumed by the settings PUT) | API-temporary-files-upload-file *(→ submission-files / plumbing)* |
| Public renders *(not this feature)* | home page / site index / every-page header+footer / archive / article / announcements | PAGE-index-index etc. *(owned by `journal-homepage` and reader features)* |

## Reference — code anchors

- **Page assembly**: `lib/pkp/pages/management/ManagementHandler.php` `website()` (builds all
  forms, theme API URL, temporary-file + public-file URLs); `pages/management/SettingsHandler.php`
  `__construct()` (the `settings` op gate); `lib/pkp/templates/management/website.tpl` (tab tree).
- **Forms**: `lib/pkp/classes/components/forms/context/PKPThemeForm.php` (per-theme field store,
  `getConfig()['themeFields']`), `PKPAppearanceSetupForm.php`, `PKPAppearanceAdvancedForm.php`,
  `PKPListsForm.php`, `PKPDateTimeForm.php`; OJS `classes/components/forms/context/
  AppearanceSetupForm.php` (adds `journalThumbnail`) + `AppearanceAdvancedForm.php` (empty
  override). Vue: `lib/ui-library/src/components/Form/context/ThemeForm.vue`, `DateTimeForm.vue`.
- **Theme save**: `lib/pkp/api/v1/contexts/PKPContextController.php` `editTheme()`/`getTheme()`
  (context-match, context-required, role + `CanAccessSettingsPolicy` via `authorize()`; option
  passthrough to the plugin; template/CSS cache clear); `lib/pkp/classes/plugins/ThemePlugin.php`
  `saveOption()`/`getOptionValues()`/`getOptionsConfig()`;
  `plugins/themes/default/DefaultThemePlugin.php` `init()` (option set + LESS variables +
  homepage-image header CSS) / `saveOption()` (colour guard);
  `classes/journal/enums/JournalContentOption.php`.
- **Settings save + uploads**: `lib/pkp/classes/services/PKPContextService.php` `validate()`
  (temporaryFilesExist on favicon/homepageImage/pageHeaderLogoImage/styleSheet; sidebar
  enabled-block hook; installed-theme hook) / `edit()` / `_saveFileParam()` /
  `moveTemporaryFile()`; schemas `lib/pkp/schemas/context.json` (`itemsPerPage`/`numPageLinks`
  min:1 + defaults; upload-object shapes; `sidebar` array; per-locale format strings) +
  `schemas/context.json` (`journalThumbnail`).
- **Render wiring**: `lib/pkp/classes/template/PKPTemplateManager.php` `initialize()` (logo,
  favicon header, `contextStylesheet` late link, the five date/time assigns, config-fallback
  itemsPerPage/numPageLinks) and `smartyPageLinks()`; OJS `classes/template/TemplateManager.php`
  `initialize()` (context `numPageLinks`/`itemsPerPage`/`pageFooter`/`publicFilesDir`);
  `lib/pkp/classes/context/Context.php` `getDateTimeFormats()`/`getLocalizedDateFormat*()`;
  `pages/issue/IssueHandler.php` `archive()`; consumers `header.tpl`, `footer.tpl`,
  `indexJournal.tpl`, `indexSite.tpl`, `issue_toc.tpl`, `article_details.tpl`,
  `announcements_list.tpl`.
- **Custom blocks**: `plugins/generic/customBlockManager/CustomBlockManagerPlugin.php`
  (`register()` re-registers each listed block; `getActions()` *Manage Custom Blocks*;
  `isSitePlugin()`); `CustomBlockPlugin.php` (`getContents()` locale fallback, `getEnabled()`);
  `controllers/grid/CustomBlockGridHandler.php` (five ops, roles, `deleteCustomBlock()` — row 121);
  `controllers/grid/form/CustomBlockForm.php` (`execute()` name derivation, required title);
  `templates/block.tpl` (`showName` → `pkp_screen_reader`); `lib/pkp/classes/plugins/
  PluginSettingsDAO.php` `deleteSetting()`/`deleteSettingsByPlugin()` (the `plugin_Name` typo).
- **Liveness note** — probed 2026-07-06 against `:8000` (`ojs_test`, PostgreSQL,
  `APPLICATION_ENV=test`). **Reads on `publicknowledge`** only (its appearance settings are
  load-bearing for the parallel suite and were never mutated; post-run check: no
  sidebar/styleSheet/pageFooter/upload rows, `itemsPerPage=25`/`numPageLinks=10`, theme plugin
  settings untouched, homepage 200). **All mutations on scratch journal `j-was1`** (id 316,
  en+fr_CA, manager dbarnes, 2 published issues, 1 announcement, customBlockManager enabled via
  scenario seeding): page + tab set + all five form field configs (parsed from page state); theme
  PUTs (typography/colour/summary/header-image; bogus theme 400; invalid colour silently null;
  role-less user 401); the five uploads end-to-end (temporaryFiles → PUT → public files →
  header/site-index/homepage/favicon/stylesheet renders, fr fallback, footer en+fr); sidebar
  invalid-name 400 + ordered render; custom block create → picker → public render, delete → 500
  (row 121); makeSubmission absent-from-picker → plugin-grid enable → offered (row 122);
  date-format en/fr deltas on announcement + issue dates; itemsPerPage=1 archive pagination +
  `min:1` 400; dbuskins denied page + both endpoints. **Residue**: `j-was1` retains all of the
  above (custom block `reading-list` undeletable on Postgres — row 121); no cleanup attempted, no
  seeded user or `publicknowledge` state altered.
- **Adversarial verification (2026-07-06, verifier)** — attacked on a FRESH scratch journal
  `j-wav57a` (id 345, en, dbarnes manager, customBlockManager enabled, 1 published issue) against
  `:8000` (`ojs_test`, PostgreSQL); `publicknowledge` read-only throughout (no PUT ever aimed at it).
  **Refutations attempted → spec survived**: (1) *Row 121 re-driven independently* — created a fresh
  block, `delete-custom-block` → **HTTP 500**, server log shows the exact `PDOException SQLSTATE[42703]
  … column "plugin_Name" does not exist … HINT: perhaps you meant plugin_settings.plugin_name` at
  `PluginSettingsDAO::deleteSetting()`; block's six `plugin_settings` rows (incl. the never-deleted
  `blockTitle`/`showName`) all survive and the `blocks` list is unchanged — mechanism + secondary
  residue confirmed. The `ConvertEmptyStringsToNull` immunity of `ThemePlugin::saveOption()`'s
  empty-string branch confirmed live (`{typography:""}` PUT → **200**, stored null, no 500).
  (2) *Row 122 on a fresh journal* — `plugin_settings` for ctx 345 has NO `makesubmissionblockplugin`
  row (only the four other stock blocks; `developedby` disabled, the rest enabled), the Sidebar picker
  offers `[WebFeed, information, subscription, languagetoggle]` (no makeSubmission), and
  `PUT sidebar:[makesubmissionblockplugin]` → **400** invalidBlock. True cause verified = the missing
  `getContextSpecificPluginSettingsFile()` override (the `Context::add` install hook is only
  registered for plugins that override it — `Plugin::register()`), NOT installer ordering. Groomed
  `journal-homepage` rule 13's "Make a submission — ships enabled" → corrected with the row-122 note
  (cross-spec groom done). (3) *Theme-endpoint gate* — a manager with `permitSettings` stripped →
  **401 on `/theme` GET and PUT** and on the settings PUT (identical `CanAccessSettingsPolicy`), page
  → authorizationDenied; group restored. Refutes "role-only gate" — the theme endpoint is gated
  exactly like the settings PUT. (4) *Row 123 mechanism + independent re-drive* — code-confirmed
  `_saveFileParam()`'s null branch (`$fileName = $isImage ? $setting['uploadName'] : $setting`) hands
  the stored ARRAY to `removeContextFile()` for the non-image styleSheet; live: uploaded `.css` →
  `PUT {styleSheet:null}` → 200, link gone, `GET public/journals/345/styleSheet.css` → **200** with
  content; contrast — an IMAGE-field null-clear (`{pageHeaderLogoImage:{en:null}}`) deletes correctly
  (file → **404**). (5) *Upload-security probe* — the `acceptedFiles` type filters are **client-side
  only**: a `.php` and a script-bearing `.svg` were accepted by `POST temporaryFiles` and by the
  logo `PUT`, stored as extension-less `pageHeaderLogoImage_en` (their MIME maps to no
  document/image extension) and served raw — the `.php` as **source, not executed** (rename strips
  the extension; no RCE). Calibrated as a note + **Open question 4**, no new ledger row: a manager
  already injects arbitrary HTML/JS via *Additional Content*/*Page Footer* (same origin, same trust
  boundary — no privilege gained). Spec's rule 5 + Logo/Favicon/style-sheet field rows corrected to
  attribute the type restrictions to the browser widget. (6) *Date short-format on issue pages* — set
  `dateFormatShort:{en:"d.m.Y"}`, the issue-view "Published" line rendered **`05.07.2026`** (rule 7's
  issue surface, which the retained test does not directly assert); unset `dateFormatLong` stays empty
  in storage and resolves to the config default at render (the test's `'F j, Y'` echo is the real
  form persisting the config-resolved value on save — not a contradiction). (7) *customBlockManager
  liveness* — not default-enabled (no `enabled` row on `publicknowledge` ctx 1); editing a block
  keeps its derived name (`CustomBlockForm::execute()` regenerates the name only on create), so a
  rename never breaks a sidebar reference. **Atlas audit**: all 14 claimed atoms single-owned by this
  spec, no double-claim, no orphan; the FORM-pkp-lists-form ownership note names a "FORM-pkp-site-lists"
  twin that is not an actual atom (site pagination is not a separate form) — harmless phantom, tidy
  candidate. **Residue**: `j-wav57a` (id 345) retains an undeletable custom block (row 121), a cleared
  styleSheet whose file still serves (row 123) and a `dateFormatShort` override; malicious upload
  fixtures were cleared (logo nulled → deleted). No seeded user or `publicknowledge` state altered;
  `publicknowledge` post-checked untouched. No finding contradicts the retained
  `website-appearance-settings.spec.js` (not modified).
