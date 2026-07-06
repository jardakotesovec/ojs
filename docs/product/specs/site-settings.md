---
name: site-settings
scope: The site administrator's configuration of the installation itself — Administration → Site Settings: site identity (name, redirect-to-a-journal), site security policy (password rules, rate limiting), site contact & about texts, site-level appearance (logo, footer, sidebar, style sheet, theme) and the site-wide statistics-collection policy that caps every journal
shared: pkp-lib   # AdminHandler::settings(), all PKPSite*Form classes, SCHEMA-site, SiteDAO/PKPSiteService and the /site API live in lib/pkp; OJS contributes the site-index render surface (pages/index/IndexHandler.php, frontend/pages/indexSite.tpl) and the site styleSheet/pageFooter wiring in APP TemplateManager
status: verified
e2e-plans: [site-settings]
atlas-claims:
  - PAGE-admin-settings
  - FORM-pkp-site-config-form
  - FORM-pkp-site-information-form
  - FORM-pkp-site-appearance-form
  - FORM-pkp-site-security-form
  - FORM-pkp-site-statistics-form
  - SCHEMA-site
  - DB-site
  - DB-site_settings
  - API-site-get
  - API-site-edit
  - API-site-get-theme
  - API-site-edit-theme
---

# Site settings

## Purpose

An OJS installation is one **site** hosting one or more journals, and the site has its
own thin layer of configuration above every journal: what the installation is called,
whether the front door should skip the journal list and land on a single journal, the
password/security policy every account obeys, the site-wide contact and privacy texts,
the look of the site-level pages (the multi-journal index), and the statistics-collection
ceiling that individual journals may narrow but never exceed. All of it lives on **one
page — Administration → Site Settings** — reachable only by a **site administrator**,
from the site context (no journal in the URL). This spec owns that page and the six
site-scoped forms on it; several other tabs mounted on the same page belong to their own
features (Languages, Navigation, Highlights, Bulk Emails, ORCID, Announcements, Plugins —
see Cross-feature interactions).

## Actors & permissions

There are only two actors: the **site administrator** (full access) and **everyone
else** (no access — including journal managers; there is no *Permit settings*-style
delegation at the site level, unlike every journal settings page). The whole
Administration area additionally sits behind the optional re-confirm-password gate owned
by `login-as` (off on a default install).

| Action | Who may — and when |
|--------|--------------------|
| **Open Administration → Site Settings** | • Site admin — via the user menu → Administration → Site Settings, only with no journal in the URL path<br>• Journal managers and all other roles — refused ("The current role does not have access to this operation"); the Administration menu entry never appears for them <sup>a</sup> |
| **Read the site configuration** (any form's values) | • Site admin only — every form loads and saves through the one site API <sup>b</sup> |
| **Edit any site setting** (all six forms + site theme) | • Site admin only — Save per form; changes take effect immediately, site-wide <sup>b</sup> |

<sup>a</sup> `AdminHandler::__construct()` (all ops assigned `ROLE_ID_SITE_ADMIN` only); `AdminHandler::authorize()` (`PKPSiteAccessPolicy`, plus refuses any request that carries a journal context; `ReauthenticationRequiredPolicy` — the reauth gate, owned by `login-as`) · live 2026-07-06: manager `dbarnes` → `roleBasedAccessDenied` page ·
<sup>b</sup> `PKPSiteController::getRouteGroupMiddleware()` (`has.user` + `roleAuthorizer([SITE_ADMIN])` on the whole `/site` route group: GET/PUT `site`, GET/PUT `site/theme`) · live 2026-07-06: `dbarnes` GET `api/v1/site` → 401, PUT **with a valid session CSRF token** → 401 (the role gate), DB untouched; a PUT *without* the token draws the CSRF middleware's 403 before the role gate is reached ·

## Fields & validation

All six forms save to the single site record (PUT `api/v1/site`), each sending only its
own fields. Multilingual fields offer one entry per **site** language (the site's
supported locales — managed by `languages-locales`). Fields marked *Required* are
enforced **in the browser form only** — the server never re-checks them (⚠ see Known
deviations, row 149).

**Site Setup → Settings** (shown on multi-journal sites only — rule 2):

| Field (UI label) | Required? | Rules | Anchor |
|------------------|-----------|-------|--------|
| Site Name | Yes (client-side) | Text, per language. Shown as the site's title on site-level pages and the backend header. | `PKPSiteConfigForm` (`title`); `PKPTemplateManager::setupBackendPage()` (`siteTitle`), `IndexHandler::index()` (`pageTitleTranslated`) |
| Journal redirect | No | Select of all **enabled** journals (blank = no redirect). When set, requests to the site's front page are redirected to that journal (rule 3). The field only renders when at least one enabled journal exists. | `PKPSiteConfigForm` (`redirectContextId`) |
| Reviewer statistics — "Disable aggregated reviewer statistics" | No | Checkbox. When ticked, a reviewer's counts (reviews done, response times…) shown to editors are computed per journal instead of across the whole installation. | `PKPSiteConfigForm` (`disableSharedReviewerStatistics`); consumed by the reviewer-selection stats (owned by `assign-and-manage-reviewers`) |

**Site Setup → Security** (always shown):

| Field (UI label) | Required? | Rules | Anchor |
|------------------|-----------|-------|--------|
| Minimum password length (characters) | Yes (client-side) | Integer, schema minimum 4. Enforced on every password entry point — registration, change password, reset — and displayed in those forms' hints (rule 5). | `PKPSiteSecurityForm` (`minPasswordLength`); `site.json` (`min:4`); `FormValidatorPassword` |
| Check passwords against compromised password databases | No | Checkbox (off by default). When on, new passwords are refused if they appear in a breached-password corpus: a local blacklist file if present, else the Have-I-Been-Pwned k-anonymity API (rule 5). | `PKPSiteSecurityForm` (`passwordUncompromisedEnabled`); `ValidationServiceProvider` (`UncompromisedVerifier` binding, `LocalPasswordBlacklistVerifier` fallback chain) |
| Enable rate limiting | No | Checkbox (off by default). Reveals the two fields below when ticked. | `PKPSiteSecurityForm` (`rateLimitEnabled`, `showWhen`) |
| Maximum attempts | No | Integer ≥ 1, default 5. Failed login attempts (keyed IP + username) and password-reset requests (IP + email) beyond this count are blocked until the window lapses (rule 6). | `PKPSiteSecurityForm` (`rateLimitMaxAttempts`); `RateLimitingService` |
| Seconds until reset | No | Integer ≥ 60, default 300. | `PKPSiteSecurityForm` (`rateLimitDecaySeconds`); `site.json` (`min:60`) |

**Site Setup → Information** (multi-journal sites only):

| Field (UI label) | Required? | Rules | Anchor |
|------------------|-----------|-------|--------|
| About the site | No | Rich text, per language. Rendered on the site's front page above the journal list. | `PKPSiteInformationForm` (`about`); `IndexHandler::index()` → `indexSite.tpl` |
| Name of principal contact | Yes (client-side) | Text, per language. | `PKPSiteInformationForm` (`contactName`) |
| Email of principal contact | Yes (client-side) | Email format, per language. | `PKPSiteInformationForm` (`contactEmail`); `site.json` (`email_or_localhost`) |
| Privacy Statement | No | Rich text, per language. Served on the **site-level** `/about/privacy` page, and on every journal's privacy page when the installation is configured for a single site-wide statement; empty → the site privacy page is not found (rule 4). | `PKPSiteInformationForm` (`privacyStatement`); `AboutSiteHandler::privacy()` (page owned by `about-pages`) |

**Appearance → Setup** (multi-journal sites only; the Appearance → Theme tab is the
same theme form used by journals, here saving the **site** theme via `site/theme` — rule 7):

| Field (UI label) | Required? | Rules | Anchor |
|------------------|-----------|-------|--------|
| Logo | No | Image upload, per language + alt text. Displayed as the page-header logo on site-level pages. | `PKPSiteAppearanceForm` (`pageHeaderTitleImage`); `PKPTemplateManager::initialize()` (`displayPageHeaderLogo`, site branch) |
| Page Footer | No | Rich text (HTML allowed), per language. Footer of site-level pages. | `PKPSiteAppearanceForm` (`pageFooter`); OJS `TemplateManager::initialize()` (site branch) |
| Sidebar | No | Orderable checkboxes — exactly the block plugins enabled **at site level** (on this env only *Language Toggle Block*). Order = render order on site-level pages. Unknown block names are refused. | `PKPSiteAppearanceForm` (`sidebar`); `PKPSiteService::validate()` (`invalidBlock` after-hook); `PKPTemplateManager` (sidebar site fallback) |
| Site style sheet | No | Single `.css` upload (extension filter is the upload widget's, client-side), not localized. Loaded on **every** page of the installation — journal pages included, not just site-level pages: OJS `TemplateManager::initialize()` registers `siteStylesheet` *before* its context branch (live-confirmed: the link renders on publicknowledge's home). Read as intended: a *site*-wide style sheet applying installation-wide is defensible — unlike the site logo/footer/sidebar (site-level-only, overridden by each journal's own chrome), CSS is global styling, so no deviation is flagged. The field label carries no "site-level pages only" promise. | `PKPSiteAppearanceForm` (`styleSheet`); OJS `TemplateManager::initialize()` (`addStyleSheet('siteStylesheet', …)`, unconditional) |

**Site Setup → Statistics** (always shown; the site-level *policy* — the collection
machinery, reports and journal-level forms belong to `usage-statistics`):

| Field (UI label) | Required? | Rules | Anchor |
|------------------|-----------|-------|--------|
| Geographical Statistics | — | Radio: don't collect / country / country+region / country+region+city. This is a **ceiling**: each journal may pick the same or a coarser level, never finer; "don't collect" removes the choice from journal settings entirely (rule 8). | `PKPSiteStatisticsForm` (`enableGeoUsageStats`); `PKPContextStatisticsForm` (options filtered by the site value) |
| Institutional Statistics | No | Checkbox. Only when enabled site-wide can journals turn on per-institution usage tracking. | `PKPSiteStatisticsForm` (`enableInstitutionUsageStats`); `PKPContextStatisticsForm` |
| Monthly or Daily Statistics | — | Radio: monthly only (default) / daily + monthly. | `PKPSiteStatisticsForm` (`keepDailyUsageStats`) |
| Compress Logs | — | Radio: leave processed usage-log files in place (default) / gzip them after archiving. | `PKPSiteStatisticsForm` (`compressStatsLogs`) |
| Public API (Sushi Protocol) | — | Radio: COUNTER SUSHI API public (default) / restricted to managers & admins. Public here lets each journal opt its own API private; private here overrides all journals (rule 8). | `PKPSiteStatisticsForm` (`isSushiApiPublic`); `PKPStatsSushiController` (site AND journal must both allow) |
| Use the site as the platform for all journals | No | Checkbox. When ticked, COUNTER reports name the site (not the journal) as the platform, and the **Platform ID** below becomes mandatory on save — the one required rule the server does enforce. | `PKPSiteStatisticsForm` (`isSiteSushiPlatform`); `PKPSiteService::validate()` (sushiPlatformID after-hook) |
| Platform ID | Conditionally | ≤ 17 chars of `a-zA-Z0-9._/`; shown only when the platform checkbox is ticked. | `site.json` (`sushiPlatformID` regex) |

## Rules & state

1. **One page, one record.** Administration → Site Settings is a tabbed page whose
   forms all read and write the single site record; there is no draft state, each
   form's Save applies immediately installation-wide. *(anchor:
   `AdminHandler::settings()` — builds every form against `$request->getSite()`;
   `SiteDAO::getSite()`/`updateObject()` — the one-row `site` table +
   `site_settings`)*

2. **Single-journal installs collapse the page.** With **exactly one** journal, the
   site-specific tabs are hidden — top-level *Appearance*, *Announcements* and
   *Plugins* disappear, and inside Site Setup the *Settings*, *Information*,
   *Navigation*, *Highlights* and *ORCID* tabs disappear — leaving Security, Languages,
   Bulk Emails and Statistics. The reasoning: with one journal, identity/appearance is
   managed on the journal. Zero journals or two-plus journals show everything.
   ⚠ This also removes the only UI for the *Journal redirect* field, whose own help
   text targets exactly the single-journal case (Known deviations, row 150).
   *(anchor: `AdminHandler::siteSettingsAvailability()` (`getCount() !== 1`);
   `lib/pkp/templates/admin/settings.tpl` (`componentAvailability` guards). Code-anchored:
   this env hosts 200+ journals, so the full tab set renders — live-verified only in the
   multi-journal state.)*

3. **The Journal redirect bypasses the site front page.** When set, any request to the
   installation's front page (the site index, no journal in the path) is redirected to
   the chosen journal's home page; the multi-journal list and the site about text are
   never seen. When blank (default), the front page lists all **enabled** journals
   (each with the thumbnail owned by `website-appearance-settings`) under the site
   name and about text. Disabled journals are excluded from both the list and the
   redirect select. *(anchor: `IndexHandler::index()` (`$site->getRedirect()` →
   `$request->redirect($journal->getPath())`); `Site::getRedirect()`
   (`redirectContextId`); `indexSite.tpl`. NOT live-driven — setting the redirect on
   this shared test site would re-route every site-level URL.)*

4. **Site privacy statement**: the site-level `/about/privacy` page serves it and 404s
   when it is empty (live-confirmed); with the `sitewide_privacy_statement` config
   switch on, every journal's privacy page serves the site statement instead of the
   journal's own. Registration-consent wording is the journals' concern
   (`registration-login`); the site only supplies this text. *(anchor:
   `AboutSiteHandler::privacy()` — page owned by `about-pages`)*

5. **Password policy applies to every password entry point.** Minimum length is
   enforced on registration, change-password, and reset-password forms across
   all journals — there is no per-journal override. The standing hint ("The
   password must be at least N characters.") renders on the change/reset
   password forms only; the registration form shows no hint and surfaces the
   minimum solely in its refusal message (live-confirmed:
   `userRegister.tpl`/`registrationForm.tpl` never print
   `passwordLengthRestriction`; `changePassword.tpl`/`userPasswordReset.tpl`/
   `loginChangePassword.tpl` do). The
   compromised-password check, when enabled, additionally refuses passwords found in a
   local blacklist file (`lib/pkp/registry/blacklistedPasswords.txt`, if present) or —
   fallback — the Have-I-Been-Pwned range API; when disabled, the check is a no-op.
   The password *flows* themselves are `password-flows`/`registration-login` territory.
   *(anchor: `FormValidatorPassword::getValidationRules()`
   (`Password::min($site->getMinPasswordLength())->uncompromised()`);
   `ValidationServiceProvider` (verifier bound per the site toggle))*

6. **Rate limiting is one switch for two flows.** When enabled, failed logins are
   counted per IP + username and password-reset requests per IP + email; beyond
   *Maximum attempts* within the decay window the attempt is refused (with a small
   randomized delay against timing probes), and a successful login clears its counter.
   Off by default — an unlimited-attempts install is the shipped state. *(anchor:
   `RateLimitingService::isLoginLimited()/recordLoginAttempt()/clearLoginLimit()`;
   `LoginHandler` call sites)*

7. **The site has its own theme, independent of every journal's.** Appearance → Theme
   saves the site's active theme + theme options through the dedicated `site/theme`
   endpoint (options stored as site-level plugin settings, template/CSS caches cleared
   on save); it styles only **site-level** pages — each journal's theme is its own
   setting (`website-appearance-settings`). A theme name not installed/enabled is
   refused. *(anchor: `PKPSiteController::editTheme()`; `PKPSiteService::validate()`
   (`themePluginPath` after-hook); `PKPThemeForm` (site instance built without a
   context in `AdminHandler::settings()`))*

8. **Site statistics settings are ceilings, not defaults.** A journal's Statistics
   settings form only offers geo levels up to the site's level (and hides the geo/
   institution options entirely when the site disables them); a journal already
   configured finer than a newly-lowered site ceiling is clamped to the site value.
   The SUSHI API is public for a journal only if **both** site and journal allow it.
   The journal-side form and the collection machinery belong to `usage-statistics`.
   *(anchor: `PKPContextStatisticsForm` (site-filtered options);
   `PKPStatsSushiController` (double gate))*

9. **Uploads (logo, style sheet) follow the standard public-file pipeline**: staged
   as temporary files, moved to the site's public files area on save
   (`public/site/…`), old file deleted when the field is cleared. The uploader must
   own the temporary file. ⚠ As-built the clear-time delete works for the **logo**
   only: for the style sheet `_saveFileParam()` passes the stored settings *array*
   where `removeSiteFile()` expects a filename, so clearing removes the DB value
   but silently leaves `public/site/styleSheet.css` on disk — the site twin of
   ledger row 123 (⚠ ledger row **152**; live-confirmed: after a clear the setting
   is gone, the file survives, the logo's file does not). *(anchor:
   `PKPSiteService::edit()/_saveFileParam()` (`$isImage ? $setting['uploadName'] :
   $setting`); `ValidatorFactory::temporaryFilesExist()`)*

10. **The site's locale fields (`primaryLocale`, `installedLocales`,
    `supportedLocales`) live in this record but are managed by the Languages grid**
    mounted on this same page — see `languages-locales` rules 12–13 for install/
    enable/site-primary behavior; they are not editable through any of the six forms
    here. *(anchor: `SiteDAO::$primaryTableColumns`;
    `AdminLanguageGridHandler` — feature 65)*

## Side effects

- **No emails, no notifications, no event-log entries** are produced by saving any
  site form — settings apply silently. (The neighboring Bulk Emails / Announcements
  tabs have side effects owned by their features.)
- **Site theme save clears the compiled-template and CSS caches** so the new look is
  immediate. *(anchor: `PKPSiteController::editTheme()` — `clearTemplateCache()`/`clearCssCache()`)*
- **Appearance/identity fields re-render every site-level page** on next request:
  site name (browser title + backend header), logo, footer, sidebar blocks, custom
  style sheet, about text on the front page.
- **Security fields change login/registration behavior everywhere** (rules 5–6) with
  no migration of existing data — e.g. raising the minimum length never invalidates
  existing shorter passwords; it applies to new entries only.

## Settings that modify behavior

Config-file (`config.inc.php`) siblings the forms do **not** cover — shown on the
read-only Administration → System Information config dump, never editable in the UI:

- `[security]` — `force_ssl`, `force_login_ssl`, `session_check_ip`, `encryption`,
  `reset_seconds` (password-reset-link lifetime), `allowed_hosts`, `salt`,
  `api_key_secret`, `allow_plugin_install`; plus the `password_timeout` behind the
  Administration reauth gate (owned by `login-as`). The Security **form** owns only
  what's in its table above — the split is: *policy about passwords/attempts* = DB
  form; *transport/crypto/host trust* = config file.
- `[general]` — `sitewide_privacy_statement` (rule 4), `show_upgrade_warning` (the
  "new version available" banner on this page), `items_per_page`/`page_links` (site
  fallbacks; there is **no** site-level Lists form — pagination forms are per-journal,
  see `website-appearance-settings`).

## Cross-feature interactions

The Site Settings page is a shell shared by many features; ownership of its tabs:

- **Languages** tab → `languages-locales` (the admin language grid; also the sole
  editor of the site record's locale fields — rule 10).
- **Navigation** tab → `navigation-menus` (site-level menus, multi-journal only).
- **Highlights** tab → `highlights-featured-content` (site-level highlights).
- **Bulk Emails** tab → `email-templates-management` (`FORM-pkp-site-bulk-emails`,
  the per-journal enable gate).
- **ORCID** tab → `orcid` (`FORM-orcid-site-settings`).
- **Announcements** tab (settings/list/types) → `announcements` (site-level twin).
- **Plugins** tab (installed + gallery, site scope) → `plugin-management`.
- **Appearance → Theme** reuses the journal theme form component against the site
  endpoint; the form atom (`FORM-pkp-theme-form`) stays with
  `website-appearance-settings`, the two site theme API routes are claimed here.
- **site-administration** (feature 67) — the Administration **index** page, Hosted
  Journals CRUD and the journal settings wizard; this spec's page is one link off that
  index. The admin-only journal properties a manager cannot touch (ledger rows
  118/120 context) are context-schema rules owned there.
- **usage-statistics** (feature 87) — all collection jobs, log processing, reports,
  and the journal-level statistics forms; this spec owns only the site ceiling (rule 8).
- **password-flows / registration-login** — consume the password policy (rule 5) and
  rate limits (rule 6) in their flows.
- **login-as** — owns the Administration reauth gate this page sits behind.
- **about-pages** — owns the public pages that serve the site privacy/about texts.

## Canonical scenarios

1. **Admin configures the site front door; a manager is refused** — site admin: opens
   Administration → Site Settings (Site Setup → Settings), renames the site, observes
   the name on the site index and backend header; the Journal-redirect select offers
   exactly the enabled journals; saving with the required Site Name blank is refused
   in-form ("This field is required."). A journal manager cannot open the page (access
   denied, no menu entry) and the site API refuses them.

2. **Site information surfaces publicly** — site admin: fills About-the-site, principal
   contact and Privacy Statement on Site Setup → Information; the about text renders on
   the multi-journal front page and the site `/about/privacy` page serves the statement
   (it 404s while the statement is empty).

3. **Site appearance is independent of journal appearance** — site admin: uploads a
   site logo and style sheet, sets a footer, and places the site-level sidebar
   block (this env offers exactly one, the Language Toggle block); site-level
   pages restyle while a journal's pages keep their own header, footer and
   sidebar — with the one as-built exception that the site *style sheet* links on
   journal pages too (field table above). The site theme is saved through its own
   `site/theme` endpoint; with only the `default` theme installed in this env the
   drivable proof is the round-trip (GET → `default`, re-save → 200, options
   roster = the one installed theme), not a switch.

4. **Security and statistics policy ripple down** — site admin: raises the minimum
   password length and enables rate limiting on Site Setup → Security — registration
   on any journal now enforces the new minimum (the refusal message names it; the
   standing hint lives on the change/reset-password forms, rule 5), and repeated
   failed logins lock the attempt window so that even the correct password is
   refused (with the deliberately generic login error) until the window lapses or
   the limiter is turned off; sets the geo-statistics ceiling to "country" on
   Statistics — every journal's statistics form now offers at most country-level
   collection, and turning the SUSHI API private hides all journals' COUNTER
   endpoints from the public (anonymous requests → 401).

## Known deviations (as-built ≠ intent)

- ⚠ **Rule "Fields & validation": the server never enforces the site's own required
  fields** — `PKPSiteService::validate()` passes **the publication schema's**
  required/multilingual prop lists to the required-check instead of the site
  schema's (an apparent copy-paste), so the API accepts blanking Site Name, contact
  name and contact email. Live: `PUT api/v1/site {"contactName":{"en":""}}` → 200,
  empty value persisted (restored immediately); the UI form still blocks in the
  browser, so this is API-reachable only. → ledger row **149**.
- ⚠ **Rule 2: single-journal installs lose the only UI for the Journal redirect** —
  the redirect field's help text ("useful if the site is hosting only a single
  journal") names exactly the state in which `siteSettingsAvailability()` hides the
  Settings tab that carries it; on a 1-journal site the redirect is settable only by
  direct API call. Code-anchored (not reproducible in this 200-journal env). →
  ledger row **150**.
- **Field table: the site style sheet is installation-wide, not site-level** (as-built,
  no ⚠ — read as intended). OJS `TemplateManager::initialize()` adds the
  `siteStylesheet` link before its context branch, so every journal page loads the
  site CSS too. Live 2026-07-06: after a site style-sheet upload, `publicknowledge`'s
  home links `public/site/styleSheet.css`. Calibrated NOT a deviation: a *site*-wide
  style sheet applying across the whole installation is a defensible design and the
  field label promises no "site-level pages only" scope — the site logo/footer/sidebar
  are page-chrome each journal overrides, whereas CSS is global styling. No ledger row;
  test 3 of the e2e plan asserts this as-built.
- ⚠ **Rule 9: clearing the site style sheet orphans the public file** —
  `PKPSiteService::_saveFileParam()` passes the stored array where a filename
  string is expected on the non-image branch, so the delete is a silent no-op;
  the DB value clears, `public/site/styleSheet.css` survives on disk (the logo's
  clear-time delete works — its branch extracts `uploadName`). The site twin of
  ledger row **123**. → ledger row **152** (live-confirmed 2026-07-06: an orphaned
  `public/site/styleSheet.css` sits on disk after the retained test's clear, with no
  DB reference).
- **Two low blemishes** (ledger row **151**): (a) `PKPSiteController::getTheme()`
  misses a `return` on its theme-not-found branch, so a site whose theme plugin is
  missing/disabled gets a 500 (null-method fatal) instead of the intended 404; (b)
  the page renders two elements with `id="setup"` (the Site Setup top tab and the
  Appearance → Setup sub-tab), an invalid-DOM a11y blemish observed live via a
  strict-mode locator violation.

## Open questions

1. Rule 2 / row 150: is hiding the *Settings* (and Information/Appearance) tabs on
   exactly-one-journal installs intended to also retire the Journal redirect — i.e.
   should single-journal front doors be handled some other way, or should the
   redirect field move to an always-visible tab?
2. The Site Name is empty on this test installation and nothing fills it at install
   time — is a blank site title an acceptable install state (the browser title shows
   just "Open Journal Systems" from the contact default), or should the installer
   require it?
3. The theme options rendered at site level reuse journal-worded labels ("Choose a
   font combination that suits this journal", "Show the journal summary on the
   homepage") — cosmetic, but is site-specific wording wanted?

## Verification

Adversarially verified 2026-07-06 (live on `:8000` as `admin`, `ojs_test` PostgreSQL;
every write snapshot→mutate→restored, DB-verified pristine). Confirmed `verified`:
- **Row 149 blast radius bounded**: the required-check mis-wiring lets the three site
  *required* fields be blanked via the API — `title` (setting rows deleted), `contactName`
  (`''` persisted), `contactEmail` (`''` persisted) all returned 200. But per-field
  validation from `SCHEMA_SITE` still runs: `contactEmail:"not-an-email"` → 400,
  `minPasswordLength:2` → 400 (min:4), a bogus sidebar block → 400. No dangerous
  unvalidated value is admitted; the hole is required-ness only. The inverse imposition
  (publication required props on a site PUT) is inert for real edits — `version`/
  `submissionId` only 400 when explicitly sent empty, and site payloads never carry them.
- **Permission surface**: `api/v1/site` GET is admin-gated, not public — anonymous GET
  → 401 and manager GET → 401 (the site index surfaces site title/about, but the API
  does not); anonymous PUT without a token → 403 (CSRF fires before the role gate);
  manager PUT with a valid token → 401 (role gate). Site info is public via the render
  surfaces, never via the API.
- **Rows 151(a) getTheme-500 and 151(b) duplicate `id="setup"`**: code-verified (not
  driven — would strand the shared site).
- **Site style sheet installation-wide**: re-affirmed as-built and calibrated NOT a
  deviation (see Known deviations).
- **New finding filed — ledger row 152** (clear-orphans the public `styleSheet.css`,
  the site twin of row 123): confirmed live, an orphaned `public/site/styleSheet.css`
  sits on disk after the retained test's clear with no DB reference.
- **About/rich-text HTML is stored and rendered unescaped** (a `<script>` in About
  survived the API and rendered raw on the site index). Not filed: site admin is the
  top trust boundary (can edit templates/config/plugins), About is a rich-text field,
  and the raw-HTML-through-the-schema-API pattern is app-wide (journal-level rich-text
  fields behave identically), not a site-settings defect. Open observation only.

---

## Reference — entry points & surfaces

| Entry | Path | Atom |
|-------|------|------|
| Site Settings page | `/index/admin/settings` (`AdminHandler::settings()`) | PAGE-admin-settings |
| Site Setup → Settings form | on-page (`siteConfig`) | FORM-pkp-site-config-form |
| Site Setup → Security form | on-page (`siteSecurity`) | FORM-pkp-site-security-form |
| Site Setup → Information form | on-page (`siteInfo`) | FORM-pkp-site-information-form |
| Site Setup → Statistics form | on-page (`siteStatistics`) | FORM-pkp-site-statistics-form |
| Appearance → Setup form | on-page (`siteAppearance`) | FORM-pkp-site-appearance-form |
| Site API | GET/PUT `api/v1/site` | API-site-get, API-site-edit |
| Site theme API | GET/PUT `api/v1/site/theme` | API-site-get-theme, API-site-edit-theme |
| Site entity schema | `lib/pkp/schemas/site.json` | SCHEMA-site |
| Site storage | `site` + `site_settings` tables | DB-site, DB-site_settings |
| Public render surfaces | site index (`IndexHandler::index()` → `indexSite.tpl`), site `/about/privacy` (page owned by `about-pages`) | — (referenced) |

## Reference — code anchors

- `lib/pkp/pages/admin/AdminHandler.php` — `settings()` (form roster + state),
  `siteSettingsAvailability()` (single-vs-multi gating), `authorize()` (admin-only,
  no-context, reauth policy)
- `lib/pkp/templates/admin/settings.tpl` — the tab tree and availability guards
- `lib/pkp/classes/components/forms/site/PKPSite{Config,Information,Appearance,Security,Statistics}Form.php`
- `lib/pkp/api/v1/site/PKPSiteController.php` — `get()/edit()/getTheme()/editTheme()`
- `lib/pkp/classes/services/PKPSiteService.php` — `validate()` (⚠ row 149), `edit()`,
  `_saveFileParam()`
- `lib/pkp/classes/site/Site.php`, `lib/pkp/classes/site/SiteDAO.php` — entity +
  storage (`site` primary columns: redirect, min password length, locales)
- `pages/index/IndexHandler.php` (OJS) — site index + redirect;
  `classes/template/TemplateManager.php` (OJS) — site styleSheet/pageFooter wiring;
  `lib/pkp/classes/template/PKPTemplateManager.php` — site logo/sidebar/title
- `lib/pkp/classes/security/RateLimitingService.php`,
  `lib/pkp/classes/core/ValidationServiceProvider.php`,
  `lib/pkp/classes/form/validation/FormValidatorPassword.php` — security policy consumers
