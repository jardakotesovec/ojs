---
name: navigation-menus
scope: How a journal manager composes the reader site's header navigation — menus, their theme areas, typed menu items (system links, custom pages, remote URLs), drag-drop ordering/nesting, per-item conditional display, and the anonymous custom-page renderer
shared: pkp-lib   # Entities, DAOs, service, grids, API, page handler and the Vue editor live in lib/pkp / lib/ui-library. The OJS overlay is real: registry/navigationMenus.xml seeds the default menus, and APP\services\NavigationMenuService adds the Current Issue / Archives / Subscriptions / My Subscriptions item types via hooks.
status: verified   # adversarial verifier passed 2026-07-06 (live re-probed on ojs_test)
e2e-plans: [navigation-menus]
atlas-claims:
  - PAGE-navigationmenu-index
  - PAGE-navigationmenu-view
  - PAGE-navigationmenu-preview
  - VUE-navigation-menu-editor
  - VUE-navigation-menu-manager-field
  - GRID-lib-pkp-grid-navigation-menus-navigation-menus-grid-handler
  - GRID-lib-pkp-grid-navigation-menus-navigation-menu-items-grid-handler
  - API-navigation-menu-get-all-items
  - API-navigation-menu-get-areas
  - API-navigation-menu-get-items
  - API-navigation-menu-add
  - API-navigation-menu-edit
  - SCHEMA-navigation-menu
  - SCHEMA-navigation-menu-item
  - DB-navigation_menus
  - DB-navigation_menu_items
  - DB-navigation_menu_item_settings
  - DB-navigation_menu_item_assignments
  - DB-navigation_menu_item_assignment_settings
  - LOC-manager-manager-navigationMenus
  - LOC-manager-manager-navigationMenu
---

# Navigation menus

## Purpose

Every reader-facing page of a journal carries a header with two navigation strips: the
**primary** menu (Current, Archives, Announcements, About …) and the **user** menu
(Register/Login when logged out; the username's dropdown when logged in). This feature is
how those strips are defined. A manager works on **Settings → Website → Setup →
Navigation**: two lists — **Navigation** (the menus) and **Navigation Menu Items** (the
pool of links) — where they create typed items (system links whose URLs the app computes,
**Custom Page** items that publish a rich-text page at a chosen URL path, and **Remote
URL** items pointing anywhere), then compose each menu from the pool in a drag-drop
editor with one level of nesting. The active theme declares which **navigation areas**
exist (the default theme: `primary` and `user`); a menu renders only while it is assigned
to one of them. Many items are **conditional** — Announcements only when announcements
are enabled, Login only when logged out, Administration only for site admins — so the
same menu definition renders differently per visitor and per journal state. On
multi-journal installations, site admins manage the site-level user menu (rendered on the
site-wide journal list) from **Administration → Site Settings → Site Setup → Navigation
Menus**.

## Actors & permissions

Baselines: the Settings → Website page sits behind the campaign-wide **settings-access**
gate (site admin, or manager whose group carries *Permit settings* — canonical treatment
in `journal-masthead-settings`). "Manager" below means a manager passing that gate.
Everything reader-facing is anonymous.

| Action | Who may — and when |
|--------|--------------------|
| **Open the Navigation manager** | • Site admin / manager — Settings → Website → Setup → Navigation<br>• Site admins — the site-level twin on Administration → Site Settings → Site Setup → Navigation Menus, offered **only on multi-journal sites**<br>• Everyone else — page refused, tab never seen (section editor live-verified) <sup>a</sup> |
| **Create / edit a menu** (title, area, item tree) | • Site admin / manager — via the Add Menu / Edit side modal (saves through the navigation-menus API)<br>• ⚠ A manager whose *Permit settings* was stripped keeps full API access while the page and grids refuse them — API-only, no UI control (Known deviations, row 130) <sup>b</sup> |
| **Delete a menu** | • Site admin / manager — grid row action (grid-only; the API has no delete) <sup>c</sup> |
| **Create / edit / delete a menu item** | • Site admin / manager — legacy modal from the Navigation Menu Items list (same settings gate as the grids) <sup>d</sup> |
| **Preview a Custom Page before saving** | • Site admin / manager — the Preview button in the item modal renders the unsaved title/content in a new tab; anyone else who forges the request gets a raw server error (Known deviations, row 132) <sup>e</sup> |
| **See the menus / open a custom page or remote link** | • Any visitor, no login — subject to each item's display condition (rules 6–7); custom pages are public even while the item is in no menu <sup>f</sup> |

<sup>a</sup> `ManagementHandler::website()` + `ManagementHandler::authorize()` (`CanAccessSettingsPolicy`); `AdminHandler::settings()` (`'navigationMenus' => $isMultiContextSite`); live 2026-07-06: section editor `navsec1` → `roleBasedAccessDenied`, grid fetch → role denial, API → 401; anonymous API → 401 ·
<sup>b</sup> `PKPNavigationMenuController::getRouteGroupMiddleware()` (`roleAuthorizer([SITE_ADMIN, MANAGER])`, **no** settings policy) vs `NavigationMenusGridHandler::authorize()` (`CanAccessSettingsPolicy`); live: stripped manager → page 302, grid "Access denied.", API GET 200 / PUT 200 ·
<sup>c</sup> `NavigationMenusGridHandler` ops `fetchGrid,fetchRow,deleteNavigationMenu`; `PKPNavigationMenuController::getGroupRoutes()` (GET/POST/PUT only) ·
<sup>d</sup> `NavigationMenuItemsGridHandler` ops incl. `addNavigationMenuItem,editNavigationMenuItem,updateNavigationMenuItem,deleteNavigationMenuItem`; `authorize()` (`CanAccessSettingsPolicy`) ·
<sup>e</sup> `NavigationMenuItemHandler::preview()` (in-method manager/site-admin check); live: dbarnes 200 with unsaved content, anonymous → 500 ·
<sup>f</sup> `PKPNavigationMenuService::_callbackHandleCustomNavigationMenuItems()` (LoadHandler hook); live: `/nav1/nav-probe` 200 anonymously before any menu assignment

## Fields & validation

**Menu** (Add Menu / Edit side modal — Vue form over the API):

| Field (UI label) | Required? | Rules | Anchor |
|------------------|-----------|-------|--------|
| Title | Yes | Plain text, one per journal — a duplicate title is refused ("This title already exists for another navigation menu.") | `navigationMenu.json` `title`; `PKPNavigationMenuController::validateNavigationMenu()` (duplicate via `NavigationMenuDAO::getByTitle()`) |
| Active Theme Navigation Areas | No | Select: *None* + the active theme's areas (default theme: `primary`, `user`). One menu per area — assigning an occupied area is refused ("A navigation menu is already assigned to this area."). *None* parks the menu unrendered. The API accepts area names the theme never declared; they store but never render (rule 2) | `useNavigationMenuManagerForm.js` (options from `GET navigationMenus/areas`); `validateNavigationMenu()` (`getByArea` check); `DefaultThemePlugin::init()` `addMenuArea(['primary','user'])` |
| Assigned Menu Items / Unassigned Menu Items | — | Two drag-drop panels: drag from the unassigned pool to place an item, drag within Assigned to reorder or nest (one sublevel; rule 4). Items carrying a display condition show an info icon with the condition; a parent with a submenu shows a "link may not be followable on all devices" notice | `NavigationMenuEditor.vue` (two `MenuTreePanel`s); `NavigationMenuItemResource` (`conditionalWarning`); saved as `menuTree` (`navigationMenu.json`) |

**Menu item** (Add item / Edit legacy modal). The type select is labelled **Navigation Menu
Type** with 19 choices: Custom Page, Remote URL, About, Editorial Masthead, Submissions,
Announcements, Login, Register, Dashboard, View Profile, Administration, Logout, Contact,
Search, Privacy Statement, Current Issue, Archives, Subscriptions, My Subscriptions
(the last four are OJS additions). Type is required; the per-type fields swap in below it.

| Field (UI label) | Required? | Rules | Anchor |
|------------------|-----------|-------|--------|
| Title | Yes (primary locale) | Multilingual. For system types the default label comes from the type (e.g. `{$loggedInUsername}` renders as the visitor's username); typing a different text stores a per-locale override, and clearing a locale falls back to the default | `PKPNavigationMenuItemsForm` (`FormValidatorLocale`); `execute()` (stores only titles differing from the type default); `titleLocaleKey` setting |
| Navigation Menu Type | Yes | Select as above; "typeMissing" error when unset | `PKPNavigationMenuItemsForm::validate()`; `PKPNavigationMenuService::getMenuItemTypes()` + `NavigationMenus::itemTypes` hook (`APP NavigationMenuService::getMenuItemTypesCallback()`) |
| Path (Custom Page only) | Yes | Letters/digits/`/._-` only; unique per journal ("duplicatePath"); helper shows the resulting URL `…/{journal}/%PATH%` and warns against paths built into the system | `validate()` (`pathRegEx` `/^[a-zA-Z0-9\/._-]+$/`, `getByPath` duplicate); live: duplicate + bad path both refused |
| Content (Custom Page only) | No | Rich text (TinyMCE), multilingual; the body of the published page. `{$contactName}`, `{$contactEmail}`, `{$supportName}`, `{$supportPhone}`, `{$supportEmail}` are substituted at render | `navigationMenuItem.json` `content`; `NavigationMenuItemHandler::view()` (strtr substitutions) |
| Remote URL (Remote URL only) | Yes (primary locale) | Must be a valid URL per locale ("customUrlError") | `validate()` (`FILTER_VALIDATE_URL`) |
| Query parameters (system types only) | No | Multilingual; appended to the generated URL. Hidden for Custom Page / Remote URL | `NavigationMenuItemsFormHandler.js` (`NMI_QUERY_PARAMS` shown only for system types); `navigationMenuItem.json` `queryParams` |

## Rules & state

1. **Areas belong to the theme.** A theme declares its navigation areas
   (`ThemePlugin::addMenuArea()`, inherited by child themes); the bundled default theme —
   the only bundled theme — declares `primary` and `user`. A menu renders in the reader
   header only while its assigned area is declared by the journal's active theme; the
   header template requests both areas on every reader page.
   <sup>`DefaultThemePlugin::init()`; `PKPTemplateManager::smartyLoadNavigationMenuArea()` (area guard → empty output); `frontend/components/header.tpl` (`{load_menu name="primary"…}` / `name="user"`)</sup>
2. **Area assignment is exclusive but not validated against the theme.** Per journal, at
   most one menu per area name (422 "menuAssigned" otherwise); a menu with area *None* —
   or an area the active theme doesn't declare (reachable only via API, or by switching
   themes after assignment) — is kept but never rendered. Live: a bogus `areaName`
   stored via API (201) and never rendered.
   <sup>`PKPNavigationMenuController::validateNavigationMenu()`; `smartyLoadNavigationMenuArea()`</sup>
3. **Defaults are seeded at journal creation** from `registry/navigationMenus.xml`:
   *Primary Navigation Menu* (area `primary`): Current, Archives, Announcements, About ▸
   (About the Journal, Submissions, Editorial Masthead, Privacy Statement, Contact);
   *User Navigation Menu* (area `user`): Register, Login, `{$loggedInUsername}` ▸
   (Dashboard, View Profile, Administration, Logout); plus one **unassigned** Search item.
   The site level gets only the items flagged `site="1"` — the user menu and its items
   (7 items; Search is not site-flagged); there is no site primary menu, and the site
   user menu renders on the site-wide journal list.
   Live-verified on a fresh scratch journal (17 items, two menus) and on `/index/en`.
   <sup>`registry/navigationMenus.xml`; `PKPContextService` (context add → `NavigationMenuDAO::installSettings()`); `NavigationMenuItemDAO::installSettings()`</sup>
4. **The item tree: one sublevel, rebuilt on save.** The drag-drop editor nests to the
   configured depth — `interface.navigation_menu_max_depth` in `config.inc.php`,
   default **2** (top level + one submenu) — refusing deeper drags; the reader header
   likewise renders exactly two levels. Saving a menu deletes and recreates **all** its
   placements from the submitted tree. ⚠ The depth cap is client-side only: the API
   stores arbitrarily deep trees, whose 3rd-and-deeper levels the front end silently
   never shows (Known deviations, row 133). An item may be placed in **several menus at
   once** (each menu holds its own placement; live: Search rendered in both header
   strips), and unplacing an item returns it to the pool without deleting it.
   <sup>`PKPNavigationMenuController::DEFAULT_MAX_DEPTH`; `PKPTemplateManager::display()` (`navigationMenuMaxDepth` from config); `useNavigationMenuEditorDragDrop.js` / `MenuTreeItem.vue` (drag guards); `frontend/components/navigationMenu.tpl` (two-level markup); `PKPNavigationMenuService::saveMenuTreeAssignments()` (`deleteByMenuId` + reinsert)</sup>
5. **Titles resolve per visitor.** Display titles come from the item's stored override,
   else the type's default label; `{$loggedInUsername}` is substituted from the session
   (live: the user-menu parent renders as "dbarnes"), and the Logout item becomes
   "Logout as …" while logged in as someone else. (Placements can also carry their own
   title override in storage, but no current UI writes one — Open question 1.)
   <sup>`PKPNavigationMenuService::transformNavMenuItemTitle()` / `loadMenuTreeDisplayState()`; `NavigationMenuItemAssignment::getTitle()`</sup>
6. **Conditional display — the heart of the feature.** Each rendered item is checked
   per request; hidden items disappear entirely (a parent's submenu renders only if some
   child is visible). All conditions live-verified on scratch `nav1`:
   - *Announcements* — only when announcements are enabled (journal setting; site setting
     at site level). Flipping the setting flips the link.
   - *Contact* — only when a contact name or mailing address is set.
   - *Privacy Statement* — only when a privacy statement is filled in (blanking it
     removed the link).
   - *Register* — only logged out **and** user registration not disabled (flipping
     `disableUserReg` removed it). *Login* — only logged out.
   - *Dashboard, View Profile, Logout* — only logged in. *Administration* — only a
     logged-in **site admin** (manager dbarnes did not see it; admin did).
   - *About, Submissions, Editorial Masthead, Search, Custom Page, Remote URL* — always
     shown (About renders even with no "About the journal" text — see row 132 on the
     editor's contrary warning).
   - OJS types: *Current Issue* / *Archives* — only when the journal publishes online
     (publishing mode not "None"); *Subscriptions* — only when payments are enabled and
     configured; *My Subscriptions* — additionally logged in + subscription publishing
     mode.
   <sup>`PKPNavigationMenuService::getDisplayStatus()` (per-type switch); `APP NavigationMenuService::getDisplayStatusCallback()` (`NavigationMenus::displaySettings` hook); `navigationMenu.tpl` (`getIsDisplayed()` / `getIsChildVisible()`)</sup>
7. **Custom pages are path-interception, not menu membership.** A Custom Page item
   publishes its content at `{journalUrl}/{path}` — a request whose path matches a
   custom item is rerouted to the anonymous page renderer (journal title + content,
   contact/support placeholders substituted). This works the moment the item is saved,
   whether or not it sits in any menu; deleting the item frees the path. The interception
   is a `LoadHandler` hook that fires **before** the normal page handler resolves, so on
   an exact path match a custom item **shadows a built-in page**: a custom item at path
   `about` or `issue` renders instead of the system About / Issue landing (live-verified —
   the real page's content is fully replaced, not merged). The match is exact, so
   `issue/current` still reaches the system handler while a custom `issue` shadows only
   the bare `/issue`. Path segments join with `/`, so multi-segment paths (`foo/bar/baz`)
   are matched too. The item form only *advises* against paths "built into the system"
   (helper text) — it does **not** block them (Open question 5). Remote URL
   items render as plain external `href`s (live: `https://pkp.sfu.ca/…` in the header).
   <sup>`PKPNavigationMenuService::_callbackHandleCustomNavigationMenuItems()` (LoadHandler; builds `$path` from `$page`/`$op`/args, `getByPath()` exact lookup); `PKPPageRouter::route()` (`Hook::call('LoadHandler')` short-circuits before the page handler loads); `NavigationMenuItemHandler::view()` / `index()`; `frontend/pages/navigationMenuItemViewContent.tpl`</sup>
8. **System types resolve their own URLs.** Each non-custom type maps to its fixed app
   page (About → `/about`, Search → `/search`, Current Issue → `/issue/current`,
   Subscriptions → `/about/subscriptions`, …) plus any query parameters from the item.
   Caveat for parents: on viewports wider than 992px the default theme's dropdown
   script rewrites a parent-with-visible-submenu's rendered `href` to `#` (the parent
   becomes a pure toggle — the editor's "link may not be followable on all devices"
   notice made real); the computed URL still ships in the raw markup and serves
   narrow viewports.
   <sup>`PKPNavigationMenuService::getDisplayStatus()` (URL switch); `APP NavigationMenuService::getDisplayStatusCallback()`; `plugins/themes/default/js/main.js` (`toggleDropdowns()` `attr('href', '#')`)</sup>
9. **Edits show up immediately.** Menu trees are cached (24 h) but every menu, item or
   placement write forgets the affected menus' cache; display state is recomputed per
   request on top of the cached structure. Live: renaming an item changed the header on
   the next anonymous load.
   <sup>`PKPNavigationMenuService::getMenuTree()` / `loadMenuTree()` (`Cache::put` 24 h); `NavigationMenuDAO::updateObject()/deleteById()`, `NavigationMenuItemDAO`/`NavigationMenuItemAssignmentDAO` `unCacheRelatedNavigationMenus()`</sup>
10. **Deletion cascades.** Deleting a menu removes its placements (items survive in the
    pool); deleting an item removes it from every menu and its settings with it (live:
    the header link vanished, placement rows gone). Deleting a journal removes all its
    menus and items.
    <sup>`NavigationMenusMigration` (FK `onDelete('cascade')` on assignments/settings); `NavigationMenuItemsGridHandler::deleteNavigationMenuItem()`</sup>
11. **The manager surface is a deliberate hybrid** (3.6): the two lists are legacy grids;
    Add/Edit **menu** opens a Vue side modal saving via the REST API; Add/Edit **item**
    opens a legacy form modal; menu delete and item CRUD post to the grids. The old
    all-in-one menu form still on disk is dead code (UNASSIGNED § Dead-code candidates).
    <sup>`templates/management/website.tpl` (`setup` tab → `navigationMenus` tab, two `load_url_in_div` grids); `NavigationMenusGridHandler::initialize()` / `NavigationMenusGridRow` (`VueModal('NavigationMenuManagerFormModal')`); `NavigationMenuForm.php` + `navigationMenuForm.tpl` (orphaned)</sup>

## Side effects

- **Reader header on every journal page** re-renders from the saved menus (rules 1, 6, 9).
- **A public page appears/disappears** at the Custom Page item's path (rule 7).
- No emails, no notifications, no event-log entries for any menu/item operation
  (verified none exist in the handlers/service).

## Settings that modify behavior

- **Active theme** (website-appearance-settings) — declares the areas; switching to a
  theme without the assigned area silently stops rendering that menu (rule 2).
- **Announcements enabled**, **privacy statement**, **contact name/mailing address**,
  **user registration disabled** — flip the corresponding items (rule 6).
- **Publishing mode** and **payments enabled/configured** (distribution-settings) — gate
  the OJS item types (rule 6).
- **`interface.navigation_menu_max_depth`** (`config.inc.php`) — editor nesting depth,
  default 2 (rule 4).
- **Multi-journal site** — the site-level Navigation Menus tab appears in
  Administration → Site Settings only when the site hosts more than one journal
  (`AdminHandler::settings()`).

## Cross-feature interactions

- **about-pages** — owns the About/Submissions/Editorial Masthead/Privacy/Contact target
  pages (and the staticPages plugin's separate custom-page mechanism); this spec owns
  only the links that point there.
- **website-appearance-settings** — owns the Settings → Website page and theme selection;
  this spec owns the Navigation tab's content. Theme choice feeds rule 1.
- **journal-homepage** — owns the reader header/layout that hosts the rendered strips
  (including the built-in search icon link next to the user menu, which is not a menu
  item).
- **announcements / site-search / registration-login / editorial-masthead /
  subscription features** — own the pages the system item types link to and the settings
  behind their display conditions.
- **site-administration** — owns the Administration → Site Settings page hosting the
  site-level twin of this manager.
- **languages-locales** — multilingual item titles/content follow the journal's locales.

## Canonical scenarios

1. **Out-of-the-box header** — anonymous reader: a fresh journal already shows the
   default primary strip (Current, Archives, About ▸ its five children — Announcements
   hidden while announcements are off) and the user strip (Register, Login); the Search
   item exists unassigned; on the multi-journal site's journal list, the site user menu
   renders. Logging in swaps the user strip to the username's dropdown (Dashboard, View
   Profile, Logout — plus Administration for a site admin only).
2. **Only settings-holders manage menus** — section editor / anonymous: the Website
   settings page refuses, the grids refuse, the API returns 401; a manager and a site
   admin both reach the Navigation tab. (⚠ the API's missing *Permit settings* check —
   row 130 — is the API-only exception.)
3. **Compose and mount a menu** — manager: creates a menu via Add Menu (duplicate title
   refused; occupied area refused), leaves it as *None* (nothing renders), then assigns
   a free/parked area or swaps areas between menus — the header follows the assignment.
4. **Publish a custom page** — manager: creates a Custom Page item (bad or duplicate
   path refused), previews the unsaved content in a new tab, saves; the page is served
   anonymously at `/{path}` immediately (even before placement); after dragging the item
   into the primary menu, the header links to it.
5. **External link** — manager: adds a Remote URL item (invalid URL refused) and places
   it; the header renders a plain link to the external address.
6. **Conditional links follow journal state** — manager + anonymous reader: enabling
   announcements makes the Announcements link appear; disabling user registration
   removes Register; blanking the privacy statement removes Privacy Statement; the
   editor's info icons announce each condition (with the row-131/132 gaps).
7. **Rearrange, rename, delete** — manager: drags to reorder top-level items (header
   order flips), nests an item one level deep (deeper nesting refused by the editor),
   renames an item (header updates immediately), unplaces an item (back to the pool,
   still in the other menu if placed there), deletes an item (gone from every menu) and
   deletes a menu (items survive unassigned).

## Known deviations (as-built ≠ intent)

Only one genuine gap survives verification: the API settings-bypass (row 130), kept ⚠.
The other four ledger rows are LOW and recalibrated to plain notes below — two are
editor-advisory imperfections (front-end rendering is correct throughout) and two are
reachable only by a hand-crafted API call or an anonymous forged request, never by a
normal UI user. Adversarially re-verified 2026-07-06 on `ojs_test`.

- ⚠ **Row 130** — the navigation-menus REST API omits the settings gate: a manager whose
  group's *Permit settings* is stripped is refused the page and both grids but keeps full
  menu read/create/edit via `api/v1/navigationMenus`. **Bounded (verifier re-drive):** the
  role list is **SITE_ADMIN + MANAGER only**, so a section editor is refused all five
  routes (401), and the controller scopes every menu to the request context, so a manager
  of journal A cannot reach journal B's menus (401). Same over-permission shape as row
  124, but narrower — row 124 also admitted sub-editors. `docs/e2e/app-changes.md`.
- **Row 131** (editor-advisory, LOW) — the four OJS item types are invisible to the
  API/Vue-editor surface: the app-service hook that registers them (`itemTypes` /
  `displaySettings`) is never resolved in an API request, so the editor payload carries 15
  of the 19 types and a Current / Archives / Subscriptions / My Subscriptions item shows
  **no** conditional-warning icon although the front end still hides it correctly. The
  effect is confined to the editor's advisory icons — no item is mis-rendered — but the
  editor is *internally inconsistent* (it warns on some conditional items, not on others).
- **Row 132** (LOW, three unrelated edge findings) — (a) the About items carry a
  conditional-warning string ("only displayed if you have filled out the About the
  Journal section") but the display switch has **no About hide-case**, so About always
  renders — the warning misinforms; (b) the Administration item reuses the generic
  logged-in warning string, omitting its real **site-admin** condition; (c) an
  unauthenticated GET **or** POST to `navigationMenu/preview` (CSRF-gate-free) throws an
  uncaught exception → a bare **500 with an empty body** — no stack trace, no message
  leak. (c) is anonymously reachable but produces no output and no UI path reaches it (the
  Preview button lives only inside the manager-only item modal), so it is a robustness
  blemish, not an info-disclosure; (a)/(b) are cosmetic editor guidance.
- **Row 133** (client-only bound, LOW; family of rows 119/125/126) — the editor's depth-2
  nesting cap is enforced only client-side; a hand-crafted `menuTree` PUT stores
  arbitrarily deep trees whose 3rd-and-deeper levels the reader header silently never
  renders. **No data is lost** (the extra assignment rows persist until the next menu save
  normalises the tree) and the cap is unreachable through the drag-drop editor.
- **Dead code** (UNASSIGNED § Dead-code candidates): `NavigationMenuForm` +
  `navigationMenuForm.tpl` (posts to a grid op that no longer exists; embeds an
  unregistered `<navigation-menu-editor-panel>` Vue tag) — superseded by
  `NavigationMenuManagerFormModal` + the API.
- (Filed while probing, not nav-specific: row 134 — `common.help` locale key missing
  app-wide; the backend top-nav Help button's screen-reader label renders `##common.help##`
  on every backend page, side-modal headers included. Sole consumer `TopNavActions.vue`.)

## Open questions

1. Placements can carry a per-menu title override (`navigation_menu_item_assignments`
   settings; the renderer and editor prefer it over the item title), but no 3.6 UI
   writes one, and every menu save wipes them (delete + recreate). Vestige of the
   pre-3.6 editor to drop, or a feature the Vue editor should regain?
2. The site-level Navigation Menus tab is hidden on single-journal sites
   (`AdminHandler::settings()`), though a site user menu exists and renders on the
   journal-list page (which single-journal sites effectively never expose). Intended?
3. Menu **delete** is grid-only while create/edit moved to the API — is an API delete
   route planned to finish the migration (the hybrid forces the Vue modal to fire a
   legacy `dataChanged` refresh)?
4. The API accepts `areaName` values the active theme never declared (stored, never
   rendered). Deliberate tolerance for theme switching, or should it validate against
   `getAreas()` like the UI select implies?
5. A Custom Page whose path collides with a built-in route (`about`, `issue`, `search`,
   even `login`) silently **shadows** that system page — the item form warns against
   "paths built into the system" but does not enforce it (rule 7). Is overriding a system
   page (e.g. a custom About) an intended affordance, or should reserved paths be
   rejected? (As-built; not raised to a ⚠ — the form's advisory warning shows the app is
   aware of the collision, and the actor is a trusted manager.)

---

## Reference — entry points & surfaces

| Entry | Path | Atom |
|-------|------|------|
| Navigation tab (journal) | Settings → Website → Setup → Navigation (`management/settings/website`, `website.tpl` tab `navigationMenus`) | (page owned by website-appearance-settings: PAGE-management-settings-website) |
| Navigation Menus tab (site) | Administration → Site Settings → Site Setup → Navigation Menus (`admin/settings`, multi-journal only) | (page owned by site-administration) |
| Menus grid | `$$$call$$$/grid/navigation-menus/navigation-menus-grid/*` (fetchGrid, fetchRow, deleteNavigationMenu) | GRID-lib-pkp-grid-navigation-menus-navigation-menus-grid-handler |
| Items grid | `$$$call$$$/grid/navigation-menus/navigation-menu-items-grid/*` (fetch*, add/edit/update/deleteNavigationMenuItem, saveSequence) | GRID-lib-pkp-grid-navigation-menus-navigation-menu-items-grid-handler |
| Menu editor modal | `NavigationMenuManagerFormModal` → `NavigationMenuManagerField` → `NavigationMenuEditor` (drag-drop) | VUE-navigation-menu-manager-field, VUE-navigation-menu-editor |
| Menus API | `GET navigationMenus/items` · `GET navigationMenus/areas` · `GET navigationMenus/{id}/items` · `POST navigationMenus` · `PUT navigationMenus/{id}` | API-navigation-menu-{get-all-items, get-areas, get-items, add, edit} |
| Custom-page renderer | `{journalUrl}/{path}` (LoadHandler rewrite → `navigationMenu/view`); `navigationMenu/preview` (POST, manager) | PAGE-navigationmenu-{index, view, preview} |
| Schemas | `navigationMenu.json`, `navigationMenuItem.json` | SCHEMA-navigation-menu, SCHEMA-navigation-menu-item |
| Storage | `navigation_menus`, `navigation_menu_items(+_settings)`, `navigation_menu_item_assignments(+_settings)` | DB-navigation_menus, DB-navigation_menu_items, DB-navigation_menu_item_settings, DB-navigation_menu_item_assignments, DB-navigation_menu_item_assignment_settings |
| Locale | `manager.navigationMenus.*` (52 keys), `manager.navigationMenu.*` (4) | LOC-manager-manager-navigationMenus, LOC-manager-manager-navigationMenu |

## Reference — code anchors

- `lib/pkp/classes/services/PKPNavigationMenuService.php` — types, display switch, tree
  build/cache, custom-path interception, `saveMenuTreeAssignments()`
- `classes/services/NavigationMenuService.php` — OJS types + display/URL hooks
- `lib/pkp/classes/navigationMenu/` — `NavigationMenu`, `NavigationMenuItem` (NMI_TYPE_*
  constants), `NavigationMenuItemAssignment`, three DAOs, `resources/*Resource.php`
- `lib/pkp/api/v1/navigationMenus/PKPNavigationMenuController.php` — routes, validation,
  `DEFAULT_MAX_DEPTH`
- `lib/pkp/controllers/grid/navigationMenus/` — both grid handlers,
  `PKPNavigationMenuItemsForm` (+ empty APP subclass), dead `NavigationMenuForm`
- `lib/pkp/pages/navigationMenu/NavigationMenuItemHandler.php` — view/preview
- `lib/ui-library/src/managers/NavigationMenuManager/`, `components/NavigationMenuEditor/`
- `plugins/themes/default/DefaultThemePlugin.php` — `addMenuArea(['primary','user'])`
- `registry/navigationMenus.xml` — default menus (OJS); `lib/pkp/templates/frontend/components/{header,navigationMenu}.tpl`

---

**Adversarial verifier re-probe (2026-07-06, `:8000` / `ojs_test`, scratch journals
`nmvprobe`/`nmvother`/`nmvse`/`nmvml`):** all rules survive. **Row 130 re-driven and
bounded:** with `permit_settings` flipped 1→0 on the scratch journal's manager group,
dbarnes lost the Settings page (302 `roleBasedAccessDenied`) and the grids ("Access
denied.") but kept `GET items` 200 / `POST` 201 / `PUT` 200; a section editor is refused
all five routes (401) and a manager of another journal is refused cross-context (401) —
so the hole is SITE_ADMIN+MANAGER, same-journal only (narrower than row 124); permit
restored. **Row 131 re-confirmed:** the API `itemTypes` payload carries 15 keys (none of
`NMI_TYPE_{CURRENT,ARCHIVES,SUBSCRIPTIONS,MY_SUBSCRIPTIONS}`), and seeded Current/Archives
items come back `conditionalWarning:null` while Announcements/About/Privacy/Contact carry
theirs — advisory-only, front end hides correctly. **Row 132 split & recalibrated:** the
`isVisible` field is derived *solely* from whether the type owns a `conditionalWarning`
string (not the real render state), which is why About reports `isVisible:false` yet
always renders (132a); the Administration warning shares the generic `loggedOut`
conditionalWarning key (132b); an anonymous GET **and** POST to `navigationMenu/preview`
both return **500 with a 0-byte body** (no disclosure), CSRF-gate-free but UI-unreachable
(132c) — all downgraded from ⚠ to LOW notes. **Row 133** confirmed no-data-loss
client-only bound → LOW note. **Row 134** confirmed app-wide (0 `common.help` msgids; sole
consumer `TopNavActions.vue`). **New finding folded into rule 7 + OQ 5 (no new ledger
row):** a Custom Page path that collides with a built-in route (`about`, `issue`) **fully
shadows** the system page via the pre-handler `LoadHandler` hook — exact-path only
(`issue/current` unaffected) — with the form only advising against reserved paths.
**Also confirmed:** bogus `areaName` accepted+stored+never-rendered (rule 2); a fr_CA-only
custom title falls back to the fr text on the en header (rule 5); an app-layer (API/DAO)
write busts the 24 h menu-tree cache while a raw DB write leaves it stale (rule 9). **Atom
audit clean:** all 21 claimed atoms single-owner; the API is 5 routes (no DELETE — menu
delete is grid-only); `DB-navigation_menu_item_assignment*` referenced by no other spec;
distribution-settings and site-access-restrictions only cross-reference
`getDisplayStatus()` (no atom claim); dead `NavigationMenuForm`/`navigationMenuForm.tpl`
parked in UNASSIGNED § Dead-code candidates. Scratch journals `nmvprobe`(417)/`nmvother`
(418)/`nmvse`(419)/`nmvml`(420) remain, isolated from `publicknowledge` (never touched).
