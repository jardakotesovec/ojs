---
name: plugin-management
scope: Turn OJS plugins on/off per journal or site-wide, configure them via their Settings modals, and (site admins) install, upgrade or remove plugin code — the Installed Plugins grids, the Plugin Gallery, and the gateway-plugin dispatch that publishes plugin endpoints.
shared: pkp-lib
status: verified
e2e-plans: [plugin-management]
atlas-claims: [GRID-grid-settings-plugins-settings-plugin-grid-handler, GRID-lib-pkp-grid-admin-plugins-admin-plugin-grid-handler, GRID-lib-pkp-grid-plugins-plugin-gallery-grid-handler, PAGE-gateway-plugin, PAGE-gateway-index, DB-plugin_settings, NOTIF-plugin-enabled, NOTIF-plugin-disabled, AUTHZ-plugin-access-policy, AUTHZ-plugin-level-required-policy, AUTHZ-plugin-required-policy, PLUGIN-generic-tinymce, PLUGIN-generic-pluginTemplate, PLUGIN-generic-pflPlugin]
---

# Plugin management

## Purpose

Almost every optional OJS behavior — feeds, viewers, blocks, export formats, themes,
identifiers — ships as a plugin, and this feature is the switchboard that controls
them. A journal manager opens **Settings → Website → Plugins → Installed Plugins** to
see every plugin available to their journal, grouped by category, and flips each one
on or off with a checkbox; rows expose a per-plugin **Settings** modal when the plugin
is configurable. A site administrator gets the same grid at **Administration → Site
Settings → Plugins** for the whole installation, plus the file-level operations:
upload a plugin package, upgrade or delete an installed plugin, and install new
plugins from the remote **Plugin Gallery**. Enabling a plugin is what makes its
public surfaces exist at all — including any web endpoints it registers under
`/{journal}/gateway/plugin/…` (this spec owns that dispatch mechanism). Each
individual plugin's *behavior* is owned by the feature that uses it (see
Cross-feature interactions); this spec owns the management grid, the enable/disable
and settings mechanism, scope (site vs journal), and install/upgrade/delete.

## Actors & permissions

Recurring terms. A **journal-level plugin** (the vast majority — all generic, block,
theme, import/export… plugins) keeps an independent on/off state *per journal*. A
**site-wide plugin** declares itself site-level (stock examples: the Usage Event
plugin; the Custom Block Manager behaves as site-level only when opened from the site
grid) and has a single state for the whole installation.<sup>a</sup> **Manager**
below means a journal manager whose manager role has the "permit settings" ability —
managers in a role stripped of settings access are refused every surface in this spec
(see roles-permissions).<sup>b</sup> **Site admins are normally also managers**: the
admin who creates a journal is auto-enrolled as its manager (site-administration
spec), so they pass the manager rules below; the "site admin only" limits bite for
admins *not* enrolled in the journal. Anonymous users and all other roles have no
access to any management surface; gateway endpoints are public.

| Action | Who may — and when |
|--------|--------------------|
| **View the journal's Installed Plugins grid** (Settings → Website → Plugins) | • Managers — see journal-level plugins only<br>• Site admins — same grid plus the site-wide plugins <sup>c</sup> |
| **View the site Installed Plugins grid** (Administration → Site Settings → Plugins) | • Site admins only — managers are refused ("current role does not have access", live-verified) <sup>d</sup> |
| **Enable / disable a journal-level plugin (for one journal)** | • That journal's managers — via the journal grid's checkbox (confirm modal on disable)<br>• ⚠ Site admins *not* enrolled as manager — the toggle is shown but every click is refused, with a raw untranslated error (ledger row 157) <sup>e</sup> |
| **Enable / disable a site-wide plugin** | • Site admins — from either grid (the row appears in a journal grid only for admins)<br>• Never managers <sup>e</sup> |
| **Open and save a plugin's Settings modal** | • Managers — journal-level plugins, only while the plugin is enabled (the row action appears on enable, vanishes on disable)<br>• Site admins — site-wide plugins<br>• ⚠ API-only, no UI control: site admins *not* enrolled as manager can also read/write a journal-level plugin's *modern* settings endpoint directly (ledger row 158) <sup>f</sup> |
| **Upload a plugin package (install or upgrade from file)** | • Site admins only, and only when the install mode allows uploads (`allow_plugin_install = on`, the default); the "Upload A New Plugin" action then appears on both grids <sup>g</sup> |
| **Upgrade / Delete an installed plugin (row actions)** | • Site admins only — on any row, both grids (Upgrade hidden when uploads are disallowed) <sup>h</sup> |
| **Browse the Plugin Gallery + view plugin details** | • Managers and site admins — the Gallery tab renders at both levels <sup>i</sup> |
| **Install / upgrade from the Plugin Gallery** | • Site admins only — the Install/Upgrade button inside the details modal is admin-only, and further gated by the install mode <sup>i</sup> |
| **Call a gateway endpoint** (`/{journal}/gateway/plugin/{name}/…`) | • Anyone, anonymously — subject to any policies the plugin itself adds; live only while the owning plugin is enabled <sup>j</sup> |

<sup>a</sup> `Plugin::isSitePlugin()`; `PKPUsageEventPlugin::isSitePlugin()`; `CustomBlockManagerPlugin::isSitePlugin()` (true only without a journal context)
<sup>b</sup> `CanAccessSettingsPolicy::effect()` (`$userGroup->permitSettings`), added in `SettingsPluginGridHandler::authorize()` and `PluginGalleryGridHandler::authorize()`
<sup>c</sup> `SettingsPluginGridHandler::loadCategoryData()` (site plugins filtered out unless site admin)
<sup>d</sup> `AdminPluginGridHandler::__construct()` (role assignment = site admin only)
<sup>e</sup> `PluginAccessPolicy` MANAGE mode + `PluginLevelRequiredPolicy::effect()` (manager ⇒ journal-level plugin only; site admin ⇒ site-wide plugin only, in a journal context); `SettingsPluginGridHandler::authorize()` (enable/disable/manage ⇒ MANAGE mode)
<sup>f</sup> `PluginGridRow::_canEdit()`; `PluginSettingsController::getRouteGroupMiddleware()` (site plugin ⇒ admin only, else + manager)
<sup>g</sup> `PluginGridHandler::__construct()` (upload ops site-admin), `PluginGridHandler::initialize()` + `PluginHelper::isUploadAllowed()`
<sup>h</sup> `PluginGridRow::initialize()` (delete/upgrade under site-admin role check)
<sup>i</sup> `PluginGalleryGridHandler::__construct()` (installPlugin/upgradePlugin site-admin), `viewPlugin()` (`Validation::isSiteAdmin()` for the install action), `PluginHelper::isGalleryInstallAllowed()`
<sup>j</sup> `GatewayHandler::__construct()` + `GatewayHandler::plugin()`; `GatewayPlugin::getPolicies()`

## Fields & validation

The grids are action surfaces, not forms; each plugin's own Settings form belongs to
that plugin's feature. The generic inputs:

| Field (UI label) | Required? | Rules | Anchor |
|------------------|-----------|-------|--------|
| Installed-grid search: **Plugin name** + **Category** | no | Case-insensitive substring match on the display name; category narrows to one group; both live behind the grid header's search toggle | `PluginGridHandler::loadCategoryData()` filter branch; `pluginGridFilter.tpl` |
| Gallery search: **Categories** + text search | no | Category select + free-text match against the gallery record | `PluginGalleryGridHandler::getFilterSelectionData()`; `PluginGalleryDAO::getNewestCompatible()` |
| Upload form: **Plugin file** | yes | A `.tar.gz` plugin package; uploaded to temporary storage then validated/extracted; the same form serves install ("Upload A New Plugin") and per-row upgrade | `UploadPluginForm`; `PluginGridHandler::uploadPluginFile()`; `PluginHelper::installPlugin()`/`upgradePlugin()` |

## Rules & state

1. **Grid layout** — one category grid with a group per plugin category (stock OJS:
   metadata, blocks, gateways, generic, importexport, oaiMetadataFormats, paymethod,
   pubIds, reports, themes; live-verified). Rows show Name, Description, and an
   Enabled checkbox; a row whose plugin refuses enabling/disabling renders the
   checkbox locked (greyed). Derivative sub-plugins a generic plugin registers at
   runtime (e.g. Web Feed's gateway and block children) are hidden from the grid, so
   the *gateways* group normally renders empty.
   (`PluginGridHandler::initialize()`; `PluginGridCellProvider::getTemplateVarsFromRowColumn()` 'enabled' case; `Plugin::getHideManagement()`; `WebFeedGatewayPlugin::getHideManagement()`)
2. **Where the on/off state lives** — one `enabled` row per scope in the plugin
   settings store: the journal's own row for journal-level plugins, the installation
   ("site") row for site-wide plugins. Toggling from a journal grid writes only that
   journal's row (live-verified: enabling on a scratch journal left every other
   journal and the site row untouched).
   (`LazyLoadPlugin::getEnabled()`/`setEnabled()`; `Plugin::updateSetting()`; DB `plugin_settings`)
3. **A toggle needs the plugin's consent** — enable/disable go through the plugin's
   own can-enable/can-disable checks (plus CSRF); a refusing plugin is shown locked
   and direct requests are no-ops. Stock examples, live-verified: **TinyMCE** is
   enabled everywhere and cannot be disabled (locked-on checkbox — there is no
   supported way to get plain textareas); **Usage Event** (site-wide) can be neither
   enabled nor disabled.
   (`PluginGridHandler::enable()`/`disable()` (`getCanEnable()`/`getCanDisable()` guards); `TinyMCEPlugin::getCanDisable()`; `PKPUsageEventPlugin::getCanEnable()`/`getCanDisable()`)
4. **Enabling is what creates the plugin's surfaces** — a plugin only registers its
   hooks, sub-plugins, API routes and gateway endpoints when it loads *enabled*, so
   the effect of a toggle is immediate and total (live-verified with Web Feed on a
   scratch journal: disable removed the homepage `<link rel="alternate">` tags and
   turned its gateway feed URLs into 404s; re-enable restored both. Same for the
   Plugin Template demo: its Settings row action and its settings API endpoint exist
   only while enabled).
   (`GenericPlugin` subclasses' `register()` `getEnabled($mainContextId)` gate — e.g. `PluginTemplatePlugin::register()`, `WebFeedPlugin::register()`)
5. **Settings survive disable** — turning a plugin off flips only the enabled flag;
   its other saved settings remain and reappear on re-enable (live-verified:
   Plugin Template's saved statement persisted through disable).
   (`LazyLoadPlugin::setEnabled()` — writes only `enabled`)
6. **Default states come from install files** — a plugin that ships a per-context
   settings file gets those defaults (typically `enabled = true`) written for **every
   newly created journal** (Web Feed, TinyMCE, Google Scholar, the default theme, the
   standard blocks…); plugins without one (Plugin Template, Publication Facts Label,
   Static Pages…) start with no row, i.e. disabled, in every journal. Site-wide
   defaults install once at system install.
   (`Plugin::getContextSpecificPluginSettingsFile()`/`installContextSpecificSettings()` (Context::add hook); `Plugin::getInstallSitePluginSettingsFile()`; live DB baseline)
7. **The site grid shows everything, but its toggle only governs the site scope** —
   the site-level grid lists all plugins including journal-level ones, with active
   checkboxes; toggling a journal-level plugin there writes the *site* row, which
   journal pages never read (journals read their own row), so the switch changes
   nothing journals or readers see. ⚠ Canonical mention: ledger row 48(f);
   live-re-verified (site-enabling Plugin Template left every journal grid
   unchecked). The legitimate uses of the site grid are site-wide plugins and the
   file-level actions (upload/upgrade/delete).
   (`AdminPluginGridHandler` (no level filter on display); `LazyLoadPlugin::setEnabled()` scope resolution; ledger row 48f)
8. **Two Settings-modal generations, both live** — (a) legacy: the row action opens
   an in-place modal with a Smarty form served by the grid's `manage` operation
   (Web Feed, most established plugins); (b) modern: the row action opens a Vue form
   modal backed by the plugin's own REST endpoint `GET/PUT
   /{journal}/api/v1/plugins/{pluginName}/settings` (Plugin Template pattern;
   live-verified 200 round-trip, 404 while disabled). By convention plugins expose
   the Settings action only while enabled. The two generations carry *different*
   permission gates for one edge actor — the modern endpoint admits pure site
   admins to journal-level plugins that the legacy manage op refuses (⚠ canonical:
   Known deviations, row 158).
   (`PluginGridHandler::manage()` → `Plugin::manage()` e.g. `WebFeedPlugin::manage()`; `PluginSettingsController::getGroupRoutes()`/`getRouteGroupMiddleware()`; `PluginTemplatePlugin::getActions()`)
9. **Plugin Gallery** — the Gallery tab fetches the PKP-hosted gallery XML
   (configurable `plugin_gallery_urls`, cached ~24 h) and lists releases compatible
   with the running application version; each row's details modal reports one of:
   *Not installed / Upgrade available / Newer version installed / Up to date /
   Incompatible*, with an Install or Upgrade button for site admins when the install
   mode allows. Install/upgrade downloads the package, verifies its MD5 checksum,
   then runs the same install pipeline as an upload; success or failure is reported
   as a toast. ⚠ When the gallery server is unreachable (firewalled/air-gapped
   installs), the tab hard-fails with an empty 500 instead of an empty list — ledger
   row 156 (live-verified at both journal and site level in the network-blocked test
   env; no live install was attempted).
   (`PluginGalleryGridHandler::loadData()`/`viewPlugin()`/`installPlugin()`; `PluginGalleryDAO::getNewestCompatible()`/`_getDocument()`; `GalleryPlugin::getCurrentStatus()`)
10. **Install-mode switch** — the config setting `security → allow_plugin_install`
    maps: `on` (default) = upload + gallery install + gallery upgrade; `gallery_only`
    = no upload; `upgrade_only` = gallery upgrades only; `off` = none. The Gallery
    tab itself is always visible; blocked actions are hidden/refused with an
    explanatory status line. Unknown values fail closed to `off`.
    (`PluginHelper::getInstallMode()`/`getCapabilities()`; `PluginGalleryGridHandler::viewPlugin()` status keys)
11. **Upload install/upgrade and delete** — upload takes a `.tar.gz`, validates the
    package's version descriptor and installs it (or upgrades the named plugin, per-row
    action); **Delete** (confirm modal) removes the plugin's directory from disk (app
    and lib/pkp trees) and marks its version record disabled, with a success/error
    toast. The grid also self-heals version bookkeeping: any on-disk plugin missing a
    version record gets one inserted when the grid loads.
    (`PluginGridHandler::saveUploadPlugin()`/`deletePlugin()`/`loadCategoryData()` version branch; `PluginHelper::installPlugin()`/`upgradePlugin()`)
12. **Gateway dispatch** — `/{journal}/gateway/plugin/{GatewayPluginName}/{args…}`
    loads the *gateways* plugin category and hands the request to the named plugin's
    fetch handler, after applying any authorization policies the plugin declares.
    Unknown name — or a gateway whose parent plugin is disabled, since disabled
    plugins never register — → 404 (live-verified). A fetch that returns failure
    redirects to the journal home page; the bare `/gateway` entry just redirects home.
    (`GatewayHandler::__construct()`/`plugin()`/`index()`; `PluginRegistry::loadCategory('gateways')`)
13. **Authorization mechanics** (source of the matrix above): plugin-targeted grid
    operations run through the plugin access policy — *manage* mode (enable, disable,
    settings) permits a manager only for journal-level plugins and a site admin only
    for site-wide plugins (in a journal context); *admin* mode (upload/delete/upgrade,
    and any plugin-targeted fetch) permits site admins only. Non-plugin operations
    (grid fetch) need only journal access + settings permission. One practical quirk:
    a single row refresh with the `plugin` parameter is admin-mode, so managers' grids
    refresh via whole-category re-render instead.
    (`SettingsPluginGridHandler::authorize()`; `AdminPluginGridHandler::authorize()`; `PluginAccessPolicy`; `PluginLevelRequiredPolicy::effect()`)

## Side effects

- **Toast notifications** (per-user, in-place): "The plugin *name* has been enabled."
  / "…disabled." on every successful toggle (`NOTIFICATION_TYPE_PLUGIN_ENABLED`/
  `_DISABLED`, live-verified text); success/error toasts for gallery installs,
  uploads and deletes (generic success/error types).
  (`PluginGridHandler::enable()`/`disable()`; `PKPNotificationManager::getNotificationMessage()` → `common.pluginEnabled`/`common.pluginDisabled`)
- **Settings store writes** — every toggle/setting save writes `plugin_settings`
  (scoped per rule 2) and fires a `PluginSettingChanged` event for listeners.
  (`Plugin::updateSetting()`)
- **Filesystem + version records** — install/upgrade/delete mutate the `plugins/`
  tree and the `versions` table (insert on install/upgrade, disable on delete).
  (`PluginHelper::installPlugin()`; `PluginGridHandler::deletePlugin()`)
- No emails, no event-log entries, no jobs.

## Settings that modify behavior

- `config.inc.php [security] allow_plugin_install` — rule 10 matrix (upload/gallery
  gating). Default `on`.
- `config.inc.php [security] plugin_gallery_urls` — JSON array of gallery feeds;
  default the PKP gallery. (`PluginGalleryDAO::getPluginGalleryConfig()`)
- The manager role's **permit settings** flag — gates every surface here for
  managers. (`CanAccessSettingsPolicy`)
- Each plugin's own declarations shape its row: site-wide vs journal-level,
  can-enable/can-disable, hidden-from-management, default-enabled settings files
  (rules 1, 2, 3, 6).

## Cross-feature interactions

- **Per-plugin behavior is owned elsewhere; this spec owns the switch.**
  website-appearance-settings (57): customBlockManager grid + blocks/themes/sidebar
  (incl. ledger rows 121, 122); journal-homepage: stock block plugins;
  web-feeds-syndication (46): webFeed/announcementFeed — their gateway feeds ride the
  dispatch in rule 12; oai-pmh (45): oaiMetadataFormats + driver plugin toggles;
  about-pages: staticPages; galleys: pdfJsViewer/lensGalley; citation-style-language
  (73), orcid (72), doi (69), payments: their plugins likewise.
- **site-administration (67)** — the Administration index and the journal settings
  wizard host the site grid and the journal-grid twin (`contextSettings.tpl`); journal
  creation auto-enrolls the creating admin as manager (why admins usually pass the
  manager rules) and installs per-journal plugin defaults (rule 6).
- **roles-permissions** — the "permit settings" manager flag and role baselines.
- **distribution-settings** — owns the LOCKSS/CLOCKSS gateway *manifest pages*
  (`GatewayHandler::lockss()`/`clockss()`); this spec owns the same handler's plugin
  dispatch + index ops.
- **usage-statistics** — owns the Usage Event plugin's behavior; here it is only the
  locked site-row example.

## Canonical scenarios

1. **Manager toggles a plugin and its public surfaces follow** — dbarnes on a
   scratch journal: Website Settings → Installed Plugins shows the category groups;
   Web Feed is on by default and the journal home page carries its three feed
   autodiscovery links. She disables it (confirm modal) → "has been disabled" toast,
   checkbox clears and survives reload, the links vanish and the feed gateway URL
   404s; re-enabling restores all of it.
2. **Manager configures a plugin through its Settings modal** — dbarnes enables the
   Plugin Template demo plugin → "has been enabled" toast and a Settings action
   appears under the row's expander. The modal form saves a value; reopening shows it
   persisted. Disabling the plugin removes the Settings action (and its API), but the
   saved value survives a disable/enable round-trip. (Legacy-form variant: Web Feed's
   Settings modal.)
3. **Plugin enablement is journal-scoped** — enabling Plugin Template on journal A
   only: journal B's grid and the site grid still show it disabled, and only journal
   A's row exists in the settings store.
4. **Site admin runs the site grid** — admin on Administration → Site Settings →
   Plugins: all categories render including site-wide plugins (Usage Event appears,
   locked); rows carry Delete and Upgrade, the grid header offers Upload A New
   Plugin. Toggling a *journal-level* plugin here flips only the site-scope state —
   no journal grid or reader page changes (⚠ row 48f).
5. **Permission boundaries** — dbarnes requesting the site grid is refused; a site
   admin who is *not* a manager of the journal still sees active toggles on the
   journal grid but every click on a journal-level plugin is refused — with a raw
   `##user.authorization.pluginLevel##` message (⚠ row 157); a manager whose role
   lacks the settings permission gets nothing at all.
6. **Plugin Gallery, render and gating** — the Gallery tab lists compatible releases
   with status per row; details modals offer Install/Upgrade to site admins only
   (never managers), per the install mode. Offline/firewalled: the tab currently
   500s instead of rendering empty (⚠ row 156) — install/upgrade is not exercised in
   the test environment (network egress blocked).

## Known deviations (as-built ≠ intent)

- ⚠ **Gallery tab hard-500s when the gallery feed is unreachable** — ledger row 156.
  The remote-fetch failure path returns null, which the XML loader rejects fatally;
  the handler's catch covers only the HTTP-client exception class — and can in fact
  *never* fire, because the fetch helper swallows every exception upstream, so ANY
  fetch failure (not just firewalled installs: a gallery outage or DNS/TLS hiccup on
  an online install with a cold/expired cache) produces the same empty-body 500, on
  the tab fetch and the details (`viewPlugin`) op alike; failures are not cached, so
  the 500 repeats until a fetch succeeds. Suspected intent: an empty grid ("no
  items") with the error logged. Live-verified in the firewalled test env at both
  levels (verifier re-confirmed on a scratch journal; body confirmed 0 bytes — no
  stack-trace leak).
- ⚠ **Pure site admin on a journal's plugin grid: toggles shown, clicks refused with
  a raw locale key** — ledger row 157. The checkbox cell renders its enable/disable
  action for every viewer, but the manage-mode policy denies site admins on
  journal-level plugins, and the denial message key `user.authorization.pluginLevel`
  does not exist in any locale file, so the toast reads `##user.authorization.pluginLevel##`.
  Verifier-bounded: the raw key surfaces *only* on this path (enable, disable and the
  legacy manage op alike) — the mirror-image mismatch (a manager hand-crafting a
  toggle of a site-wide plugin) and a bogus plugin name both refuse with properly
  translated messages, and neither has a UI affordance. Two candidate intents
  (affordance-side fix vs policy-side fix) — maintainer call; the missing locale
  string is a defect either way.
- ⚠ **The modern settings REST endpoint contradicts the grid policy for pure site
  admins** — ledger row 158. A site admin not enrolled as the journal's manager can
  GET *and* PUT a journal-level plugin's `api/v1/plugins/{name}/settings` (the
  endpoint's role gate admits site admins for every plugin), while the legacy manage
  op refuses the same actor (row 157) and the Settings row action is hidden from
  them — API-only, no UI control reaches it. Whichever side of Open question 1 the
  maintainer picks, one of the two gates is wrong today.
- ⚠ **Site-grid toggles of journal-level plugins govern nothing journals see** —
  ledger row 48(f), canonical statement in rule 7.
- (Minor, crafted-URL only, not ledgered: the grid's category/row refresh ops 500 or
  report not-found when called without the exact parameter set the UI sends —
  `fetchCategory` without `rowId`, `fetchRow` with `plugin` instead of `rowId`.)

## Open questions

1. Should a site admin who is not enrolled as the journal's manager be able to
   manage that journal's plugins (today: toggle shown but denied on use — row 157 —
   while the modern settings API quietly *permits* them — row 158)? One sentence
   decides the fix direction for both rows.
2. Is the site-scope enabled state for journal-level plugins meant to *mean*
   anything (e.g. an availability gate for journals), or should the site grid stop
   offering toggles for them (row 48f)?
3. TinyMCE is locked enabled (cannot be disabled anywhere). Intended as a hard
   dependency, or should the rich-text editor be optional per journal?

## Verification

Adversarially verified 2026-07-06 (live on `:8000`, `ojs_test` PostgreSQL; all writes
on scratch journal `plgv3951d8` id 316 with dedicated throwaway manager/author, journal
+ users deleted afterward, `plugin_settings` cascade + NULL-context scope + publicknowledge
state DB-verified pristine). Confirmed `verified`:
- **Row 157 re-confirmed + bounded**: pure site admin (auto-manager membership
  stripped) → raw `##user.authorization.pluginLevel##` on enable AND the legacy manage
  op; grid HTML renders the un-`disabled` checkbox for the same actor (usageEvent/
  tinymce correctly locked); nothing written. Key confirmed in NO locale file (repo-wide
  grep; sibling `user.authorization.pluginRequired` exists). Blast radius: the raw key
  is exclusive to this path — manager-crafts-site-plugin-toggle and bogus-name denials
  are both translated (the admin sub-policy's advice wins the aggregation).
- **Row 156 re-confirmed + recalibrated**: 500 with 0-byte body (no stack trace) on a
  scratch journal as manager; `view-plugin` dies too. Not offline-only — the
  `TransferException` catch is dead code (the DAO swallows Throwable → null upstream),
  so online installs 500 on any transient fetch failure with a cold cache, retried
  every request. LOW-MEDIUM stands; ledger row amended.
- **New finding → ledger row 158**: the modern settings REST endpoint admits pure site
  admins to journal-level plugins (GET/PUT 200, write persisted) that the legacy manage
  op refuses and whose Settings action the grid hides — API-only divergence between the
  two settings generations; spec row f, rule 8 and Known deviations updated.
- **TinyMCE is locked server-side, not just UI**: a manager's direct `disable` with a
  valid CSRF token → `{"status":false}` no-op, DB row unchanged (`getCanDisable()`
  guard inside the handler) — NOT a row-114/124 UI-locked-but-API-permits case. Same
  shape for a site admin's `enable` of Usage Event (policy permits, `getCanEnable()`
  refuses silently). CSRF-less toggles are no-ops too.
- **Level policy probed in both directions**: manager → site-plugin op denied;
  pure admin → journal-plugin op denied; admin on site plugin passes the policy and
  stops only at the plugin's consent gate. Author and stripped-of-settings manager get
  translated refusals on grid, gallery and enable ops; anonymous/author hit 401 on the
  settings API. Manager on the ADMIN grid's enable op → translated role refusal.
- **Scope model re-confirmed from code + serial test evidence**: `LazyLoadPlugin::getEnabled()`
  reads exactly one scope (journal row for journal-level, site row for site-level; no
  fallback) — so "site-disabled vs journal-enabled precedence" is a non-question:
  journal contexts never consult the site row in either direction (rules 2/7 stand).
- **Gateway dispatch**: unknown plugin name → 404; bare `/gateway` → 302 to journal
  home; enabled webFeed → 200 (disabled → 404 is test-proven).
- **Toggle toasts (NOTIF-plugin-enabled/disabled)**: not inert — canonical text is
  asserted visible in scenario-1's retained test.
- **Seam audit**: all 14 atoms single-owned in the atlas; no other spec's frontmatter
  claims them; distribution-settings holds only `PAGE-gateway-{lockss,clockss}`;
  webFeed/customBlockManager/oai plugin atoms stay with their behavior owners.
- Also spot-confirmed: this suite's throwaway logins use the real form (session-CSRF
  enforced) with explicit empty storage state — the announcements-style
  inherited-storageState pitfall does not apply here.

---

## Reference — entry points & surfaces

| Entry | Path | Atom |
|-------|------|------|
| Journal Installed Plugins grid | Settings → Website → Plugins → Installed Plugins (`management/settings/website#plugins`); also inside the admin journal-settings wizard | GRID-grid-settings-plugins-settings-plugin-grid-handler |
| Site Installed Plugins grid | Administration → Site Settings → Plugins (`admin/settings#plugins`) | GRID-lib-pkp-grid-admin-plugins-admin-plugin-grid-handler |
| Plugin Gallery tab | second tab at both locations above | GRID-lib-pkp-grid-plugins-plugin-gallery-grid-handler |
| Gateway plugin dispatch | `/{journal}/gateway/plugin/{GatewayPluginName}/{args…}` | PAGE-gateway-plugin |
| Gateway index (redirects home) | `/{journal}/gateway` | PAGE-gateway-index |
| Plugin settings REST endpoints (modern modals) | `GET/PUT /{journal}/api/v1/plugins/{pluginName}/settings` | (routes registered per plugin — mechanism in rule 8) |
| On/off + settings storage | `plugin_settings` (context row per journal; NULL-context row = site) | DB-plugin_settings |
| Toggle toasts | trivial notifications on enable/disable | NOTIF-plugin-enabled, NOTIF-plugin-disabled |
| Access policies | plugin access + level policies on plugin-targeted grid ops | AUTHZ-plugin-access-policy, AUTHZ-plugin-level-required-policy |
| Substrate plugins used by this spec | TinyMCE (locked-on rich-text editor), Plugin Template (demo generic plugin, modern settings modal), Publication Facts Label (disabled-by-default generic plugin adding a facts label to article pages; legacy settings form) | PLUGIN-generic-tinymce, PLUGIN-generic-pluginTemplate, PLUGIN-generic-pflPlugin |

## Reference — code anchors

- `lib/pkp/classes/controllers/grid/plugins/PluginGridHandler.php` — shared grid: columns, filter, enable/disable/manage, upload/delete ops
- `controllers/grid/settings/plugins/SettingsPluginGridHandler.php` — journal-level grid (site-plugin filtering, MANAGE/ADMIN mode selection)
- `lib/pkp/controllers/grid/admin/plugins/AdminPluginGridHandler.php` — site-level grid
- `lib/pkp/controllers/grid/plugins/PluginGridRow.php`, `PluginGridCellProvider.php` — row actions (settings/delete/upgrade) + the enabled-checkbox cell actions
- `lib/pkp/controllers/grid/plugins/PluginGalleryGridHandler.php`, `lib/pkp/classes/plugins/PluginGalleryDAO.php`, `lib/pkp/classes/plugins/GalleryPlugin.php` — gallery
- `lib/pkp/classes/plugins/Plugin.php`, `LazyLoadPlugin.php`, `GenericPlugin.php`, `GatewayPlugin.php` — enabled-state model, settings store, install files
- `lib/pkp/classes/plugins/PluginHelper.php` — install modes + package install/upgrade
- `lib/pkp/classes/plugins/PluginSettingsController.php` — modern settings REST base
- `lib/pkp/classes/security/authorization/PluginAccessPolicy.php`, `internal/PluginLevelRequiredPolicy.php`, `internal/PluginRequiredPolicy.php`, `CanAccessSettingsPolicy.php`
- `pages/gateway/GatewayHandler.php` — gateway dispatch (plugin/index ops; lockss/clockss owned by distribution-settings)
- `lib/pkp/templates/management/website.tpl`, `lib/pkp/templates/admin/settings.tpl`, `lib/pkp/templates/admin/contextSettings.tpl` — grid placements
- Substrate: `plugins/generic/tinymce/TinyMCEPlugin.php`, `plugins/generic/pluginTemplate/PluginTemplatePlugin.php` (+ `PluginTemplateSettingsController.php`), `plugins/generic/pflPlugin/PflPlugin.php`
