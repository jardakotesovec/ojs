---
name: languages-locales
scope: Configure which languages a journal offers for its UI, its data-entry forms and its submissions; set the primary language; manage the site's installed locale set; let readers and staff switch language
shared: pkp-lib
status: verified
e2e-plans: [languages-locales.md]
atlas-claims:
  - GRID-lib-pkp-grid-admin-languages-admin-language-grid-handler
  - GRID-lib-pkp-grid-languages-language-grid-handler
  - GRID-lib-pkp-grid-settings-languages-manage-language-grid-handler
  - GRID-lib-pkp-grid-settings-languages-submission-language-grid-handler
  - API-i18n-get-translations
  - LOC-admin-admin-languages
  - LOC-manager-manager-language
---

# Languages & locales

## Purpose

OJS is multilingual at three independent levels, and this feature owns the switchboard.
A **journal manager** (Settings → Website → Setup → Languages) decides, per language,
whether it is offered to readers as a **UI** language, to editors/managers as a
**Forms** (data-entry) language, and to authors as a **Submissions** language — plus
which language is the journal's **primary** (its default face) and which is the
default submission language. A **site administrator** (Administration → Site Settings
→ Site Setup → Languages) manages the site-wide pool: which locales are installed and
enabled for journals to draw from, and the site's own primary locale. Finally,
**everyone** — including anonymous readers — can switch their own viewing language via
the sidebar Language block (front end) or the user-menu language list (editorial
backend). The per-field multilingual entry machinery this feature turns on (locale
tabs on forms, per-(setting,locale) storage, primary-locale fallback) is specified
once in `journal-masthead-settings` and reused by every form-owning spec.

## Actors & permissions

Baselines: **site admin** passes every journal-level check below. "Manager with
settings access" means a user whose role group is Manager-level **and** carries the
group's *permit settings* flag (the default Journal Manager group has it; see
`roles-permissions`)<sup>a</sup>. Anonymous users have no access to any grid.
All grid mutations require a CSRF token.

| Action | Who may — and when |
|--------|--------------------|
| **View / toggle the journal's UI, Forms, Submissions & Metadata language checkboxes** | • Managers with settings access — any time, from Settings → Website → Setup → Languages<br>• Site admin — same page, or via Administration → Hosted Journals → (journal) → Settings wizard → Languages (same two grids) <sup>b</sup> |
| **Set the journal's primary locale / default submission locale** (radio) | • Same as above — the radios live in the same grids <sup>b</sup> |
| **Add/Remove submission-language roster entries** (modal) | • Same as above — grid action on the Submission Languages grid <sup>c</sup> |
| **Reload a language's default journal settings** ("Reload defaults" row action) | • Site admin only — the row expander and action render only for site admins<br>• ⚠ Managers can still trigger it by direct request — no UI control (see Known deviations) <sup>d</sup> |
| **Install / uninstall / enable / disable site locales, set site primary** | • Site admin only — Administration → Site Settings → Site Setup → Languages <sup>e</sup> |
| **Switch own viewing language** | • Anyone, including anonymous readers — front-end Language sidebar block (if placed) and the backend user-menu language list; only languages the journal offers as UI languages are offered <sup>f</sup> |

<sup>a</sup> `CanAccessSettingsPolicy::effect()` (site admin, or Manager group with `permitSettings`)
<sup>b</sup> `ManageLanguageGridHandler::__construct()/authorize()`; mounts: `lib/pkp/templates/management/website.tpl` (tab `setup/languages`), `lib/pkp/templates/admin/contextSettings.tpl`
<sup>c</sup> `SubmissionLanguageGridHandler::__construct()/authorize()` (`addLanguages`, `addLanguageModal`)
<sup>d</sup> `LanguageGridRow::initialize()` (`Validation::isSiteAdmin()` gate) vs `ManageLanguageGridHandler::__construct()` (role assignment includes `ROLE_ID_MANAGER` for `reloadLocale`)
<sup>e</sup> `AdminLanguageGridHandler::__construct()` (`ROLE_ID_SITE_ADMIN` only); mount: `lib/pkp/templates/admin/settings.tpl`
<sup>f</sup> `LanguageToggleBlockPlugin::getContents()`; `TopNavActions.vue getSupportedLocalesList()`; router op `PKPPageRouter::route()` → `_setLocale()`

## Fields & validation

**Website Languages grid** (journal; one row per site-enabled locale):

| Field (UI label) | Required? | Rules | Anchor |
|------------------|-----------|-------|--------|
| Locale / Code | — | Read-only: language name shown as "English/English", "French/français" (own-language second) + locale code | `ManageLanguageGridHandler::loadData()` |
| Primary locale (radio) | one always set | Selecting a row makes it the journal's primary language; auto-enables that row's UI + Forms | `LanguageGridHandler::setContextPrimaryLocale()` (`primaryLocale`) |
| UI (checkbox) | ≥ 1 checked | Offers the language to readers/backend users; cannot uncheck the primary row | `LanguageGridHandler::saveLanguageSetting()` (`supportedLocales`) |
| Forms (checkbox) | ≥ 1 checked | Offers the language as a data-entry tab on multilingual forms; cannot uncheck the primary row | same (`supportedFormLocales`) |

**Submission Languages grid** (journal; one row per roster entry — see rule 4):

| Field (UI label) | Required? | Rules | Anchor |
|------------------|-----------|-------|--------|
| Default (radio) | one always set | The default submission language; selecting auto-enables that row's Submissions + Metadata | `LanguageGridHandler::setDefaultSubmissionLocale()` (`supportedDefaultSubmissionLocale`) |
| Submissions (checkbox) | ≥ 1 checked | Authors may submit in this language; checking auto-checks Metadata; cannot uncheck the Default row | `LanguageGridHandler::saveLanguageSetting()` (`supportedSubmissionLocales`) |
| Metadata (checkbox) | ≥ 1 checked | Language available for submission metadata; unchecking also unchecks Submissions; cannot uncheck the Default row | same (`supportedSubmissionMetadataLocales`) |
| Add/Remove Languages (modal) | ≥ 1 selected to save | Checkbox list of the **full language registry** (~800 entries, "[ de ] German" format) — not limited to installed locales; unchecking entries removes them from the roster | `AddLanguageForm::execute()/validate()` (`supportedAddedSubmissionLocales`) |

**Site Languages grid** (admin; one row per **installed** locale):

| Field (UI label) | Required? | Rules | Anchor |
|------------------|-----------|-------|--------|
| Enable (checkbox) | ≥ primary | Makes an installed locale available site-wide (journals can then enable it); the site-primary row cannot be disabled ("This locale is the primary language of the site…") | `AdminLanguageGridHandler::enableLocale()/disableLocale()` |
| Primary locale (radio) | one always set | Site default language (sites' own pages, fallback for journals) | `AdminLanguageGridHandler::setPrimaryLocale()` |
| Install Locale (grid action) | — | Modal checkbox list of shipped, not-yet-installed locale packs; installing also enables them | `AdminLanguageGridHandler::installLocale()/saveInstallLocale()`, `InstallLanguageForm::execute()` |
| Remove (row action) | — | Uninstalls a non-primary locale (row expander; hidden on the primary row) | `LanguageGridRow::initialize()`, `AdminLanguageGridHandler::uninstallLocale()` |
| * marker + footnote | — | Incompletely-translated locales are marked `*` with footnote "Marked locales may be incomplete." | `AdminLanguageGridHandler::loadData()` (`LocaleMetadata::isComplete`), `initialize()` footnote |

## Rules & state

1. **Three independent per-journal language categories.** A language can be
   forms-only (staff enter translations readers never navigate in), UI-only, or
   submission-only. Verified live: with French UI unchecked but Forms checked, the
   Information form still offered its French tab while the reader site was
   English-only. (`LanguageGridHandler::saveLanguageSetting()`;
   settings `supportedLocales`, `supportedFormLocales`, `supportedSubmissionLocales`,
   `supportedSubmissionMetadataLocales`)
2. **The journal's Website-Languages roster = the locales the site admin has
   *enabled*** (site "supported"), not everything installed.
   (`ManageLanguageGridHandler::loadData()` — `$site->getSupportedLocales()`)
3. **Never empty, never orphan the primary.** Unchecking UI or Forms on the primary
   row, or Submissions/Metadata on the Default row, is refused ("The language setting
   could not be saved. All options need to be enabled." — surfaced as a browser alert
   and the checkbox snaps back); removing the last language of any category is refused
   ("…At least one language must be enabled for each option"). ⚠ This guard lives
   only in the grid handler — the context settings API (`PUT …/contexts/{id}`) does
   **not** re-check it, so a direct API write of `supportedLocales` that excludes the
   current primary is accepted and orphans the primary (ledger **148**, new; the
   contexts-API validation is journal-masthead-settings territory).
   (`LanguageGridHandler::saveLanguageSetting()` guard block)
4. **Submission languages have their own roster and may be *any* language.** The
   Add/Remove Languages modal lists the entire language registry — e.g. German was
   added and offered to authors on a site where only en/fr_CA are installed. Newly
   added entries appear unchecked; removing entries that include the current Default
   re-points the default to the first remaining entry.
   (`AddLanguageForm::execute()`; `Locale::getSubmissionLocaleDisplayNames()`)
5. **Category cascades.** Checking Submissions auto-adds the language to Metadata;
   unchecking Metadata auto-removes it from Submissions (verified live: one click
   emptied fr_CA from both). (`LanguageGridHandler::saveLanguageSetting()`)
6. **Enabling a Forms language (re)loads that language's default journal texts** —
   schema defaults (name-derived boilerplate, guidelines, …) are written for that
   locale, merged into existing multilingual values. The same restore runs when a
   submission language is first added to Metadata, and on the site-admin-only "Reload
   defaults" row action (confirm prompt; overwrites current values).
   (`PKPContextService::restoreLocaleDefaults()`; `ManageLanguageGridHandler::reloadLocale()`)
7. **Primary locale flip.** Selecting a primary radio force-adds that language to UI
   and Forms (verified: with only English enabled, choosing French as primary
   re-enabled French in both), stamps the journal, and makes it the default reader
   language. A visitor's `Accept-Language` still wins **among enabled UI locales**
   (Accept-Language `de-DE` → French home; `en` → English home).
   (`LanguageGridHandler::setContextPrimaryLocale()`; `PKPPageRouter::_getLocaleForUrl()`)
8. **URL shape follows the UI-locale count.** With ≥ 2 UI languages every page URL
   carries a locale segment (`/locspec3/en/…`); dropping to one removes the segment
   and stale locale-prefixed URLs 302-redirect to the plain form. Verified live in
   both directions. (`PKPPageRouter::url()` / `_setLocale()`)
9. **Language switching is a virtual route.** `…/user/setLocale/{locale}` is handled
   by the page router before any page handler (no `setLocale` method exists on the
   user pages); it stores the choice in the session and a `currentLocale` cookie, then
   redirects to the `source` query parameter (if its host passes the `allowed_hosts`
   check) or the referer; when neither yields a usable target it falls back to the
   **site index** ⚠ (see Known deviations — the sidebar block's `source` value is
   broken on non-standard ports). Invalid/disabled locales are ignored (current locale
   kept). The backend user menu lists the same enabled UI locales and returns to the
   exact page (verified: French dashboard). (`PKPPageRouter::route()`, `_setLocale()`,
   `isAllowedHost()`; `TopNavActions.vue getSupportedLocalesList()`)
10. **The front-end Language block renders only when useful**: it lists the journal's
    UI languages (site's at site level) and hides itself entirely when fewer than two
    are enabled (verified live: block disappeared the moment fr_CA UI was unchecked,
    reappeared on re-enable). Block placement itself is `journal-homepage` /
    `website-appearance-settings` territory. (`LanguageToggleBlockPlugin::getContents()`)
11. **Backend translations are served as a JS bundle** — `GET
    /{context}/api/v1/_i18n/ui.js` returns `pkp.localeKeys` assignments for the
    *current request locale*, publicly accessible (works on restricted sites), cached
    one year and cache-busted by a hash of the locale files' mtimes; backend pages
    load it automatically. Keys missing from the active locale render as `##key##`.
    (`I18nController::getTranslations()`; `PKPTemplateManager` `i18n_keys` script;
    `UITranslator::getCacheHash()`)
12. **Site-level changes cascade to every journal**: enabling/disabling or
    uninstalling a site locale intersects each journal's four category lists with the
    new site-enabled set, and any journal whose primary was removed is re-primaried to
    the site primary. Uninstalling or disabling the **site primary** itself is
    refused. Installing a locale = registering a shipped locale pack (filesystem, no
    network) + installing its email-template texts; it arrives site-enabled but no
    journal has it until a manager (or the cascade above) says so. Uninstalling
    deletes that locale's email templates. (`AdminLanguageGridHandler::
    _updateContextLocaleSettings()/uninstallLocale()/disableLocale()`;
    `InstallLanguageForm::execute()`; `Locale::installLocale()/uninstallLocale()`)
13. **Single-journal installs**: on a site with exactly one journal, the site-admin
    grid additionally shows the journal management columns (context primary, UI,
    Forms) so the admin manages both levels in one place. Not applicable in the
    multi-journal test env; code-anchored only. (`AdminLanguageGridHandler::_canManage()`)
14. **Author-side gate**: the submission wizard's "Submission Language" required radio
    group offers exactly the Submissions-checked languages, and the field disappears
    entirely when only one is enabled (verified live: en+fr_CA → two radios; en only →
    no field; de+en → "German/English"). Wizard behavior beyond this gate belongs to
    `submission-wizard`. (`SubmissionLanguageGridHandler::loadData()`; wizard start form)

## Side effects

- **Trivial success notifications** on every grid save: "Locale settings saved.",
  "Submission locales updated.", "{locale} defined as primary locale.", "{locale}
  locale reloaded for {journal}.", admin-side "Locale enabled./disabled.", "All
  selected locale(s) installed and activated.", "{locale} locale uninstalled."
  (`NotificationManager::createTrivialNotification` calls in both handlers)
- **Live form-tab refresh**: a UI/Forms toggle broadcasts a `set-form-languages`
  global event so open multilingual forms gain/lose their language buttons without a
  reload (verified live). (`LanguageGridHandler::saveLanguageSetting()` →
  `setGlobalEvent`)
- **Journal default texts written** when a Forms locale is enabled / primary changes /
  reload-defaults runs (rule 6); reviewer-recommendation localized labels are also
  refreshed (`Repo::reviewerRecommendation()->setLocalizedDataOnNewLocaleAdd`).
- **Site primary change re-writes user locale preferences** from the old site primary
  to the new one (`Repo::user()->dao->changeSitePrimaryLocale()`).
- **Locale install/uninstall touches email templates** (installs/deletes that
  locale's rows) (rule 12). No emails are sent by anything in this feature; no
  event-log entries are written.

## Settings that modify behavior

- **Site enabled-locale set** gates what journal managers can offer (rules 2, 12).
- **`permitSettings` flag** on Manager-level role groups gates the whole journal
  Languages tab (see `roles-permissions`).
- **`allowed_hosts`** (config.inc.php) constrains which `source` hosts the
  language-switch redirect will honour; unset/empty means any (`PKPPageRouter::isAllowedHost()`).
  The test config's `allowed_hosts = "[\"\"]"` disables the check (empty-string prefix
  matches every host).
- **Sidebar block placement** (Website → Appearance → Setup) controls whether readers
  get the Language block at all; scratch/new journals start with an empty sidebar.
- With sessions disabled (bot/cacheable requests) the block lists site locales and
  switching is a no-op form post (`LanguageToggleBlockPlugin::getContents()`
  `languageToggleNoUser`).

## Cross-feature interactions

- **journal-masthead-settings** — owns the multilingual field machinery this feature
  switches on: per-(setting,locale) storage, required-in-primary-locale-only, best-
  locale fallback for display. Also owns the context schema atom (`SCHEMA-context-pkp`).
- **website-appearance-settings** — owns the Settings → Website page shell and the
  sidebar-management UI; **journal-homepage** owns the Language block plugin atom
  (`PLUGIN-blocks-languageToggle`) and its default ordering.
- **submission-wizard / submission-wizard-metadata** — own the wizard's language step
  behavior and per-locale metadata entry; this spec owns only which languages are on
  offer (rule 14). The workflow "change submission language" action
  (`FORM-change-submission-language-metadata-form`, unclaimed) draws from the same
  submission-locale pool but belongs with a submission-side spec.
- **registration-login / user-profile** — the user's own preferred/working languages
  (multilingual profile checkboxes, registration locale). Session switching here does
  not touch the profile.
- **site-settings (feature 66)** — owns the Administration → Site Settings page and
  the site setup forms (incl. `SCHEMA-site`'s locale props); this spec owns the
  Languages grid mounted on that page and all install/enable/site-primary behavior.
  Seam: site-settings should reference rules 12–13 rather than respec them.
- **roles-permissions** — the `permitSettings` baseline; **email-templates-management**
  — per-locale template bodies installed/deleted with locales (rule 12).

## Canonical scenarios

1. **Manager turns a reader language off and on** — locmgr1 on a scratch journal with
   en+fr_CA: unchecks French "UI" → saved notification; the front-end Language block
   disappears, URLs lose their locale segment, `/fr_CA/` URLs redirect; re-checking
   restores block and segment. An author who tries the Languages page or grid URL gets
   "role does not have access".
2. **Forms language drives form tabs, independent of UI** — with French UI off but
   Forms on, the Information form still offers French entry; unchecking French "Forms"
   makes the French button vanish from the open form without a reload (global
   `set-form-languages` event); enabling a new Forms language writes that language's
   default journal texts.
3. **Author submission-language gate & the any-language roster** — manager opens
   Add/Remove Languages, ticks German (not installed anywhere on the site), saves;
   the German row appears unchecked; checking "Submissions" auto-checks "Metadata" and
   the author's wizard now offers a required German/English choice; with only one
   submission language the wizard hides the field entirely.
4. **Guard rails: defaults and primaries are immovable** — unchecking UI/Forms on the
   primary row or Submissions on the Default row is refused with "The language setting
   could not be saved…" (alert; checkbox snaps back, nothing stored); unchecking
   Metadata on a non-default row silently drags Submissions off with it; setting the
   Default radio to German records the new default submission language.
5. **Primary-locale flip re-faces the journal** — manager selects French as Primary
   locale: French is force-re-added to UI+Forms; a fresh visitor with Accept-Language
   `de-DE` now lands on the French home, while `Accept-Language: en` still gets
   English; forms now treat French as the required-first language (see feature 56).
6. **Reader and editor switch their own language** — anonymous reader clicks
   "français" in the sidebar block → French chrome, `fr_CA` URL segment, choice kept
   in session+cookie (⚠ in this env the block's redirect lands on the site index —
   ledger 145 — while the backend user-menu switch returns to the exact dashboard
   page in French).
7. **Site administrator's language pool (read-mostly)** — admin's Site Setup →
   Languages lists installed locales (en primary, fr_CA `*` incomplete + footnote)
   with Enable checkboxes, site-primary radio, "Install Locale" modal of shipped
   packs, and Remove only on non-primary rows; site-level enable/disable cascades
   into every journal's category lists (rule 12 — cascade not probed live: global).

## Known deviations (as-built ≠ intent)

- ⚠ **Language-block switch dumps the reader on the site index when the request
  host/port doesn't match the app's URL** (ledger **145**, new). The block builds its
  return address from `SERVER_NAME` + request URI — losing the port (and trusting
  `SERVER_NAME` over the Host header). When that string doesn't match the app's index
  URL the locale still switches but the redirect falls back to `/index/{locale}`.
  Reproduced live (server on `php -S 127.0.0.1:8000`, browsed as `localhost:8000`);
  any non-80/443 deployment is exposed. The backend switcher passes the full
  `document.URL` and is immune — suspected intent: block should behave like the
  backend. (`plugins/blocks/languageToggle/templates/block.tpl` `source=` param;
  `PKPPageRouter::_setLocale()` fallback)
- ⚠ **"Reload defaults" is manager-invokable but site-admin-visible** (ledger **146**,
  new). The row action renders only for site admins, yet the operation is
  role-assigned to managers — a crafted POST by a manager succeeds (verified live)
  and silently overwrites the journal's localized settings with defaults. Either the
  UI gate or the role assignment is wrong. (`LanguageGridRow::initialize()` vs
  `ManageLanguageGridHandler::__construct()`)
- ⚠ **The context settings API orphans the primary locale** (ledger **148**, new).
  The grid refuses to disable the primary (rule 3), but `PUT …/contexts/{id}` with a
  `supportedLocales` list that excludes the current `primaryLocale` is accepted (200)
  and persists `primaryLocale ∉ supportedLocales`; the schema DOES enforce membership
  when `primaryLocale` itself is set, but not when `supportedLocales` shrinks. Verified
  live (scratch `lcv48220`). Own-journal, API-only, recoverable — the cross-field
  validation belongs with `journal-masthead-settings` (`SCHEMA-context-pkp`). Suspected
  intent: the API should mirror the grid's never-orphan-the-primary guard.
- ⚠ **fr_CA ships a broken interpolation placeholder** in the required-in-primary-
  locale error (ledger **147**, new). `form.requirePrimaryLocale` in
  `lib/pkp/locale/fr_CA/common.po` reads `"…en {$ language}."` — a stray space inside
  the token — so French users see the literal `{$ language}` instead of the language
  name (PKP's substitution matches the un-spaced `{$language}`). fr_CA only; every
  other bundled locale (incl. `fr`) is correct. i18n/cosmetic. Suspected intent: the
  placeholder should be `{$language}`.
- **`##common.help##` in the backend header** — pre-existing ledger row **37** (the
  key exists in no locale file); resurfaced during these probes on scratch-journal
  backend pages. Not re-filed.
- Refusals (rule 3) surface as native browser alerts rather than inline notifications
  — legacy-grid-wide pattern, recorded once in ledger 37(c)-adjacent territory; not
  re-filed.

## Open questions

1. Should journal managers (with settings access) get the "Reload defaults" row
   action, or should `reloadLocale` be site-admin-only end-to-end (ledger 146)?
2. The Submission Languages roster accepts ~800 registry languages while Website
   Languages is capped at site-enabled locales — intended asymmetry ("weak"
   submission-only locales), or should the roster be curtailed?
3. `FORM-change-submission-language-metadata-form` (workflow change-submission-
   language modal) is still unclaimed — should it join a submission-side spec
   (suggest `publication-metadata-references` or `submission-wizard`) rather than
   this settings spec?
4. Is the one-year public cache on `_i18n/ui.js` acceptable for sites with restricted
   access (the endpoint deliberately bypasses site restriction)?

---

## Reference — entry points & surfaces

| Entry | Path | Atom |
|-------|------|------|
| Journal Languages tab | Settings → Website → Setup → Languages (`management/settings/website#setup/languages`) — hosts both journal grids | (page owned by website-appearance-settings) |
| Website Languages grid | component `grid.settings.languages.ManageLanguageGridHandler` | GRID-lib-pkp-grid-settings-languages-manage-language-grid-handler |
| Submission Languages grid | component `grid.settings.languages.SubmissionLanguageGridHandler` | GRID-lib-pkp-grid-settings-languages-submission-language-grid-handler |
| Shared grid base (save/primary/default ops) | `grid.languages.LanguageGridHandler` (base class; ops reached via the mounted subclasses) | GRID-lib-pkp-grid-languages-language-grid-handler |
| Site Languages grid | Administration → Site Settings → Site Setup → Languages; component `grid.admin.languages.AdminLanguageGridHandler`; also mounted per-journal on the admin context-settings wizard | GRID-lib-pkp-grid-admin-languages-admin-language-grid-handler |
| UI translation bundle | `GET /{context}/api/v1/_i18n/ui.js?hash=…` | API-i18n-get-translations |
| Language switch | `…/user/setLocale/{locale}?source=…` (router-level virtual op) | (no page atom — router internal) |
| Front-end Language block | sidebar block `languagetoggleblockplugin` | PLUGIN-blocks-languageToggle *(owned by journal-homepage)* |
| Locale key spaces | `admin.languages.*`, `manager.language.*` | LOC-admin-admin-languages, LOC-manager-manager-language |

## Reference — code anchors

- `lib/pkp/controllers/grid/languages/LanguageGridHandler.php` — shared save/guard/cascade + primary/default ops
- `lib/pkp/controllers/grid/settings/languages/ManageLanguageGridHandler.php` — journal Website Languages grid
- `lib/pkp/controllers/grid/settings/languages/SubmissionLanguageGridHandler.php` + `…/languages/form/AddLanguageForm.php` — submission roster
- `lib/pkp/controllers/grid/admin/languages/AdminLanguageGridHandler.php` + `…/languages/form/InstallLanguageForm.php` — site pool & cascade
- `lib/pkp/controllers/grid/languages/LanguageGridRow.php` — site-admin-only row actions (Remove / Reload defaults)
- `lib/pkp/classes/core/PKPPageRouter.php` — `_setLocale()`, locale URL segment, `isAllowedHost()`
- `lib/pkp/classes/services/PKPContextService.php::restoreLocaleDefaults()`
- `lib/pkp/api/v1/_i18n/I18nController.php`; `lib/pkp/classes/i18n/ui/UITranslator.php`
- `plugins/blocks/languageToggle/LanguageToggleBlockPlugin.php` (+ `templates/block.tpl`)
- `lib/ui-library/src/components/TopNavActions/TopNavActions.vue` — backend switcher
- `lib/pkp/schemas/context.json` — the six locale props (`primaryLocale`, `supportedLocales`, `supportedFormLocales`, `supportedSubmissionLocales`, `supportedSubmissionMetadataLocales`, `supportedAddedSubmissionLocales`, `supportedDefaultSubmissionLocale`)

## Verification (2026-07-06, adversarial pass)

Verified on port 8000 / `ojs_test` (PostgreSQL); `publicknowledge` and the site-level
locale set (installed = en primary + fr_CA; enabled unchanged) were never touched. Live
probes ran on throwaway scratch journal `lcv48220` (243, en+fr_CA, throwaway manager).
Every permission and state claim survived; two new LOW ledger rows (147, 148) came out
of the attack and two existing rows (145, 146) were re-verified and re-calibrated;
status → `verified`.

**Row 146 (priority — data overwrite) re-driven independently, blast radius bounded,
LOW confirmed.** The scratch manager's `fetch-grid` HTML carries neither a
`reload-locale` action nor a `show_extras` row expander, yet the manager's direct POST
`reload-locale rowId=en` (CSRF) returns `status:true`/`dataChanged`. A sentinel
`authorGuidelines.en` set via the contexts API was overwritten with schema-default
boilerplate by that POST **while `authorGuidelines.fr_CA` was preserved** — proving the
blast radius is exactly the *target locale's* slot of the 16 localized default-carrying
context settings (`authorGuidelines, authorInformation, beginSubmissionHelp,
contributorsHelp, detailsHelp, forTheEditorsHelp, librarianInformation,
openAccessPolicy, privacyStatement, readerInformation, reviewHelp, submissionChecklist,
uploadFilesHelp` + OJS `clockssLicense, lockssLicense, reviewerSuggestionsHelp`), other
locales/settings/journals untouched. Severity stays **LOW**: the manager already owns
all these settings via the UI, so it is self-inflicted, single-locale, own-journal-only
loss reachable only by a crafted POST — a UI-hides/API-permits policy inconsistency, not
a privilege escalation.

**Row 145 mechanism confirmed, re-calibrated MEDIUM → LOW.** `block.tpl` builds
`source` from `SERVER_NAME|cat:REQUEST_URI` (no port); `_setLocale()` accepts it under
the test config's empty-string `allowed_hosts`, fails the index-URL path rewrite
(`$replaceCount == 0`), and falls back to `/index/{locale}`. The locale still switches
(cookie + session). In a correctly-configured production deploy the bug is largely
self-defeating: standard ports have no port to drop, and a real `allowed_hosts` rejects
the `SERVER_NAME`-only source so the full `HTTP_REFERER` fallback wins. Exposure is a
dev/non-standard-port annoyance, no data loss → LOW.

**New finding — contexts API orphans the primary (ledger 148).** The grid's
never-orphan-the-primary guard (rule 3) is not mirrored in the schema API: `PUT
…/contexts/243 {"supportedLocales":["fr_CA"]}` with `primaryLocale=en` → 200 and
persists `primary=en, supported=["fr_CA"]`. The schema DOES validate membership when
`primaryLocale` is the field being set (`{"primaryLocale":"de"}` → 400), so the gap is
the missing cross-field re-check on `supportedLocales` shrink — journal-masthead-settings
(`SCHEMA-context-pkp`) territory. LOW (API-only, own-journal, recoverable).

**New finding — fr_CA broken placeholder (ledger 147).** `form.requirePrimaryLocale`
in `lib/pkp/locale/fr_CA/common.po:1293` has a stray space (`{$ language}`) that PKP's
`str_replace`-based substitution (`LocaleBundle::_format()`, search token `{$language}`)
never matches, so French users see the literal token. fr_CA only — all other bundled
locales incl. `fr` are correct. The retained test's scenario-5 assertion
(`/You must complete this field in French|Vous devez remplir ce champ/`) matches both
the broken and fixed strings, so it survives the fix. i18n/cosmetic → LOW.

**Permission attacks refuted.** The site-admin Languages grid is fully site-admin-gated
(all ops `ROLE_ID_SITE_ADMIN` + `RoleBasedHandlerOperationPolicy`) — a manager is
refused on `admin-language-grid/fetch-grid` (proven by test 7); no manager API-admits
gap on `setPrimaryLocale`/`enableLocale`/`disableLocale`/`installLocale`/`uninstallLocale`.
On the journal grids, `reloadLocale` (row 146) is the *sole* UI-hides/API-permits
instance; every other manager-assigned op has a matching manager-with-settings UI
control, and all journal ops sit behind `CanAccessSettingsPolicy` (author refused —
test 1). Primary-locale guard holds server-side for `primaryLocale` writes; the only gap
is the `supportedLocales`-shrink path (row 148).

**de-locale-install contamination — SAFE (benign as-built note).** Enabling German as a
submission-metadata locale runs `restoreLocaleDefaults('de')` →
`Locale::installLocale('de')` →
`EmailTemplate DAO::installEmailTemplateLocaleData(..., ['de'])`, which is **idempotent**
(per (email_key, locale) `delete()`-then-`insert()`, no accumulation, no duplicate-key
error), touches **only** the `de` rows of the site-wide `email_templates_default_data`
table (never en/fr_CA), and **does not** add `de` to the site's installed/enabled locale
set. No test asserts on the exact installed email-template locale set or site
`supportedLocales` — the only email-templates count assertion counts *templates* (66),
which extra `de` locale rows do not change. So the additive de-install cannot contaminate
sibling suites; enabling a bundled locale for a scratch journal stays within the campaign
rules.

**Seam / atom audit clean.** All 7 claimed atoms single-owner (languages-locales).
`PLUGIN-blocks-languageToggle` is owned by `journal-homepage` (referenced here, not
claimed). `FORM-change-submission-language-metadata-form` is correctly *unclaimed* in the
atlas (owner column empty; OQ 3 defers it to a submission-side spec) — not force-fit here.

**Scratch residue:** journal `lcv48220` (243, en+fr_CA, throwaway manager `mlcv48220`)
left with its `authorGuidelines.en` reset to default and `supportedLocales` orphaned by
the probes — disposable scratch, no cleanup required. `publicknowledge` untouched; no
site-level locale installed/uninstalled/enabled/disabled and the site primary never
touched.
