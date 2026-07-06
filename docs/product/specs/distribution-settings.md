---
name: distribution-settings
scope: The manager's Settings → Distribution page — journal-wide license/copyright defaults, search-engine (SEO) metadata, reader-access publishing mode (open / subscription / none) + OAI toggle, archiving display (PN / LOCKSS / CLOCKSS incl. the public gateway manifests), and the payments-enable toggle
shared: pkp-lib          # page shell + License/SEO/Payments forms are lib/pkp; the Access form (publishing mode), Archiving tab, copyright-year basis and the /gateway/{lockss,clockss} manifests are OJS-only
status: verified
e2e-plans: [distribution-settings]
atlas-claims: [PAGE-management-settings-distribution, PAGE-gateway-lockss, PAGE-gateway-clockss, FORM-access-form, FORM-archiving-lockss-form, FORM-license-form, FORM-pkp-license-form, FORM-pkp-search-indexing-form, LOC-manager-manager-distribution]
---

# Distribution settings

## Purpose

Settings → Distribution is where a journal manager decides how published content reaches
the world: the **default license, copyright holder and copyright year** every new
publication inherits (and which get frozen onto it at publish time), the **SEO
description and custom `<meta>` tags** search engines see, the **publishing mode** —
open access, subscription-based, or "OJS is not the publishing venue" (which shuts the
reader-facing issue/article surfaces), the **OAI harvesting toggle**, the **archiving
display** (PKP PN plugin hook plus LOCKSS/CLOCKSS enablement, whose public
`/gateway/lockss` and `/gateway/clockss` manifest pages preservation networks crawl),
and the **payments-enable switch** that turns on the fees machinery. This spec owns the
settings UI and persistence; each setting's downstream engine lives in its own feature
(license snapshot → `publication-license`, subscription enforcement →
`subscription-access`, payment methods/fees → `payments`, harvesting → `oai-pmh`) — one
live effect-link per group is verified here to prove the wire is connected.

The page has seven tabs; two of them are only *hosted* here: **DOIs** (owned by
`doi-management`) and **Statistics** (owned by `usage-statistics`). This spec owns the
page itself and the License, Search Indexing, Payments (enable-toggle boundary), Access
and Archiving tabs.

## Actors & permissions

Baseline — the Area 6 settings gate, canonically verified in `journal-masthead-settings`
and re-confirmed live here (section editor → `authorizationDenied`): the whole
`management/settings/*` surface is **journal manager + site admin only**, and a manager
whose role has the settings permission removed loses it. All tab saves except Payments
post field-scoped updates to the shared journal-settings endpoint (owned by
`journal-setup`); Payments posts to its own `_payments` endpoint with the same
manager/admin role gate.

| Action | Who may — and when |
|--------|--------------------|
| **View / edit the Distribution page** (License, Search Indexing, Access, Archiving tabs; Payments/DOIs/Statistics tabs render here too) | • Journal manager — own journal, any time<br>• Site admin — any journal<br>• Everyone else (section editor, assistant, author, reviewer, subscription manager, anonymous) — denied (live: section editor bounced to "not authorized") <sup>a</sup> |
| **Save License / SEO / Access / Archiving forms** | • Same as above — the save endpoint accepts managers + site admins only (verified for this endpoint by features 55/58; the row-118 caveat that a manager may write admin-only fields through it lives in `site-access-restrictions`) <sup>b</sup> |
| **Save the Payments form** (enable + currency + method) | • Journal manager / site admin — via the dedicated payments-settings endpoint. Subscription managers manage the Payments *area* but cannot reach this settings form <sup>c</sup> |
| **View the LOCKSS / CLOCKSS gateway manifests** | • Anyone, no login — when the journal has the flag enabled; with it off the URL bounces to the journal home (302, not a 404)<br>• Anyone — site-level manifest (`/index/gateway/lockss`) always answers, listing every hosted journal that has the flag on<br>• Behind the feature-55 login wall like any reader page when Site Access restriction is on (owned there) <sup>d</sup> |
| **See the "Payments" sidebar entry** (management UI) | • Manager, site admin, subscription manager — only while payments are enabled; appears/disappears live on saving the Payments form, without a reload <sup>e</sup> |

<sup>a</sup> `ManagementHandler::authorize()` (`CanAccessSettingsPolicy` on the `settings` op) · `SettingsHandler::__construct()` (role map) · live 2026-07-06: minoue → `user/authorizationDenied?message=user.authorization.roleBasedAccessDenied`
<sup>b</sup> `PKPContextController::getGroupRoutes()` (`roleAuthorizer([SITE_ADMIN, MANAGER])` on `PUT contexts/{id}`)
<sup>c</sup> `PKPBackendPaymentsSettingsController::getRouteGroupMiddleware()` (SITE_ADMIN + MANAGER only)
<sup>d</sup> `GatewayHandler::lockss()` / `::clockss()` (no role check; `enableLockss`/`enableClockss` redirect guard; journal-less branch lists all journals) · live probes 2026-07-06
<sup>e</sup> `TemplateManager::setupBackendPage()` (`paymentsEnabled` + role intersection incl. SUBSCRIPTION_MANAGER) · `SettingsPage.vue` `mounted()` (form-success listener adds/removes the nav item) · live

## Fields & validation

**License tab** (journal-wide defaults; the per-publication override + publish-time
snapshot are `publication-license`):

| Field (UI label) | Required? | Rules | Anchor |
|------------------|-----------|-------|--------|
| **Copyright Holder** | No | Radio: **Author** / **Journal** / **Custom copyright statement**. Unset behaves like Journal (the computed default holder is the journal name) | `PKPLicenseForm` (`copyrightHolderType`); `context.json` `in:author,context,other`; default-holder computation `Submission::_getContextLicenseFieldValue()` |
| **Custom copyright statement** | Only with "Custom" | Free text, **multilingual**; shown only while "Custom copyright statement" is selected | `PKPLicenseForm` (`copyrightHolderOther`, `showWhen`) |
| **License** | No | Radio: the six Creative Commons 4.0 licenses (BY, BY-SA, BY-NC, BY-NC-SA, BY-ND, BY-NC-ND) + **"Other license URL"** with a free-URL input. Saved value must be a well-formed URL. On a journal with **no** default set the "Other license URL" radio renders pre-selected with an empty box (cosmetic — see Open questions) | `PKPLicenseForm` (`licenseUrl`); `PKPApplication::getCCLicenseOptions()`; `context.json` `url`; `FieldRadioInput` `isInputSelected` |
| **Copyright Year** | No | Radio: **"Use the issue's publication date"** (default) / **"Use the article's publication date"** — the basis for the computed default year at publish. OJS-only field, inserted after License | `LicenseForm` (`copyrightYearBasis`, `FIELD_POSITION_AFTER licenseUrl`); `context.json` `in:issue,submission`, default `issue` |
| **License Terms** | No | Rich text (bold/italic/super/sub, link, lists), **multilingual** — public licensing terms displayed alongside published work | `PKPLicenseForm` (`licenseTerms`) |

**Search Indexing tab** (SEO — *not* the fulltext search index; boundary settled with
`site-search`):

| Field (UI label) | Required? | Rules | Anchor |
|------------------|-----------|-------|--------|
| **Description** | No | Free text, **multilingual** — becomes `<meta name="description">` on the **journal homepage only** (live-verified: present on home, absent on other pages) | `PKPSearchIndexingForm` (`searchDescription`); `PKPTemplateManager` meta-tag registration (`requestedPage == '' \|\| 'index'`) |
| **Custom Tags** | No | Free-form HTML, **multilingual** — inserted verbatim into `<head>` of **every public journal page** (live-verified on home + issue archive). The group description links the journal's sitemap | `PKPSearchIndexingForm` (`customHeaders`); `PKPTemplateManager` (`customHeaders` header, frontend context) |

**Access tab** (OJS-only form):

| Field (UI label) | Required? | Rules | Anchor |
|------------------|-----------|-------|--------|
| **Publishing Mode** | No | Radio: "provide **open access**" / "require **subscriptions** to access some or all" / "**OJS will not be used** to publish online". Server enforces the three values (an out-of-range value → "The selected publishing mode is invalid.", live). **A new journal has none selected** and the reader site behaves as open access until one is saved (rule 6) | `AccessForm` (`publishingMode`); `Journal::PUBLISHING_MODE_{OPEN,SUBSCRIPTION,NONE}` (0/1/2); `context.json` `in:0,1,2` (no default); live 400 probe |
| **Delayed Open Access** | No | Select: **Disabled** + **1–60 months**; **visible only while Subscription is selected** (live-verified reveal). A saved value survives switching back to open access (hidden, not cleared — live). ⚠ The 1–60 bound is client-side only (ledger 126) | `AccessForm` (`delayedOpenAccessDuration`, `showWhen` subscription, `SUBSCRIPTION_OPEN_ACCESS_DELAY_MIN/MAX`); `context.json` (integer, no bounds) |
| **Enable OAI** | No | Radio Enable / **Disable**; enabled by default. Governs whether the journal's records are exposed to OAI harvesters (rule 8) | `AccessForm` (`enableOai`); `context.json` default `1` |

**Archiving tab** (two side tabs):

| Field (UI label) | Required? | Rules | Anchor |
|------------------|-----------|-------|--------|
| **PKP Preservation Network (PN)** | — | With the PN plugin **not installed** (stock): an info panel "…ask your administrator to install the PKP\|PN Plugin from the Plugin Gallery" and nothing to save (live). With it installed: a single enable checkbox + settings link that drives the generic **plugin enable/disable** endpoints, not a journal setting (a self-described "dirty hack" pseudo-form) | `SettingsHandler::distribution()` (`archivePn` dummy `FormComponent`, `FieldArchivingPn` vs `FieldHTML` branch) |
| **Enable LOCKSS…** | No | Checkbox; label embeds a live link to this journal's LOCKSS **Publisher Manifest** page | `ArchivingLockssForm` (`enableLockss`); label URL `gateway/lockss` |
| **Enable CLOCKSS…** | No | Checkbox; same pattern, CLOCKSS manifest link | `ArchivingLockssForm` (`enableClockss`) |

**Payments tab** (form owned by `payments`, feature 77 — listed here because the tab
lives on this page and the *enable* boundary is this spec's):

| Field (UI label) | Required? | Rules | Anchor |
|------------------|-----------|-------|--------|
| **Enable** ("Payments will be enabled for this journal…") | No | Checkbox; master switch for the fees machinery | `PKPPaymentSettingsForm` (`paymentsEnabled`) |
| **Currency** | With payments on | Select (ISO currency list); shown only while Enable is checked; validated as a known currency code | `PKPPaymentSettingsForm` (`currency`, `showWhen`); `PKPBackendPaymentsSettingsController::edit()` |
| **Payment Plugins** | With payments on | Select of installed payment-method plugins (stock: Paypal / Manual Fee Payment); each method's own settings group (PayPal credentials, manual instructions) renders below — those fields are feature 77's | `PKPPaymentSettingsForm` (`paymentPluginName`); paymethod plugin hooks on `API::payments::settings::edit` |

## Rules & state

1. **Page assembly — seven tabs, two hosted for other features.** The pkp-lib handler
   mounts License, DOIs (setup/registration side tabs), Search Indexing, Payments and
   Statistics (the latter only when the site-level usage-stats conditions allow); the
   OJS subclass appends **Access** and **Archiving** (PN + "LOCKSS and CLOCKSS" side
   tabs) via the distribution template hook. Live tab order on 3.6: License · DOIs ·
   Search Indexing · Payments · Statistics · Access · Archiving. *(anchors:
   `ManagementHandler::distribution()`, `SettingsHandler::distribution()`,
   `management/distribution.tpl`, `management/additionalDistributionTabs.tpl`,
   `Hook Template::Settings::distribution`; live 2026-07-06, scratch `dst1`)*
2. **Each form saves independently** as a partial update of the journal's settings
   (License/SEO/Access/Archiving → the journal-settings endpoint; Payments → the
   `_payments` endpoint). A save touches only its own fields — no cross-tab coupling.
   *(anchors: each form's `$method = 'PUT'` + `action` in `SettingsHandler::distribution()`;
   `PKPBackendPaymentsSettingsController::edit()`)*
3. **License defaults feed the per-publication license machinery.** The journal's
   License URL / Copyright Holder (+ custom statement) / Copyright Year basis are the
   *computed defaults* every publication inherits while its own fields are empty, and
   they are **snapshotted onto the publication at publish time** — the mechanics
   (Override toggles, publish-time freeze, later default changes not rewriting
   published articles) are owned by `publication-license`. Live effect-link here: on
   `dst1` set Author / CC BY 4.0 / article-date, then published a submission → the
   publication stored `copyrightHolder = "Adela Gallego (Author)"`, `licenseUrl = CC BY
   4.0`, `copyrightYear = 2026`, and the public landing page rendered the CC-BY badge +
   "Copyright (c) 2026 Adela Gallego (Author)". *(anchors:
   `Submission::_getContextLicenseFieldValue()`; `Repository::publish()` (lib/pkp
   snapshot); live 2026-07-06)*
4. **Copyright-year basis discriminates issue-year vs article-year.** With the basis on
   **"Use the issue's publication date"** the computed year comes from the issue's
   publication *date* (its timestamp — not the year label typed on the issue); with
   **"Use the article's publication date"** from the publication's own date. Live
   discriminator on `dst1`: issue publication date backdated to 2025-03-01 → a
   publication published 2026-07-06 snapshotted year **2025** under issue basis and
   **2026** under article basis. Issue basis with **no issue** (or an issue without a
   publication date) falls back to the **current calendar year** at publish — not the
   article's own date (verifier live: a no-issue publication back-dated to 2024-05-01
   snapshotted year **2026**). *(anchor: `Submission::_getContextLicenseFieldValue()`
   `PERMISSIONS_FIELD_COPYRIGHT_YEAR` — default `date('Y')`, overridden only when the
   basis' source date exists; live)*
5. **SEO metadata placement.** The Description renders as `<meta name="description">`
   on the **journal homepage only**; Custom Tags are injected verbatim into the `<head>`
   of every public page of the journal (both localized to the reader's locale). Both
   also surface on the LOCKSS/CLOCKSS manifest pages (the manifest shows the journal
   description). An article's landing page carries **no** `<meta name="description">` —
   the abstract-bearing meta tags there (`citation_abstract` etc.) come from the Google
   Scholar plugin, not this form. *(anchors: `PKPTemplateManager` meta-tag block;
   `gateway/lockss.tpl`; live: description on home only, probe tag on home + issue
   archive, article landing checked)*
6. **Publishing mode drives the reader surface.**
   - **Open access** (and — as-built — *unset*): normal public reader site. A new
     journal starts with **no mode saved** and behaves as open access (the code's
     comparisons treat the absent value as "open"); the form shows no radio selected.
   - **Subscription**: the reader site stays up; galley access decisions become
     subscription checks. The mode **alone gates nothing** — the gate arms *per issue*,
     only where the issue's own access status is "Subscription" (stamped at issue
     publish, rule 7, or set on the issue's access form), and then it holds against
     **everyone** without a valid subscription even when no subscriptions are
     configured at all (verifier live: anonymous galley in an open-status issue served;
     in a subscription-status issue bounced to login with the subscription-required
     message; abstract/landing pages stay public either way — only galleys are gated).
     The *gate itself* (subscribed user / institution / delayed open-access date /
     paywall) is `subscription-access` (feature 76), and the issue-level
     access-status/open-access-date fields are `issue-management`.
   - **"OJS will not be used to publish"**: the journal's Current/Archives nav items
     disappear, the homepage stops showing the current issue, the sitemap drops all
     issue/article URLs, and the issue/article/search pages **deny readers outright**
     (anonymous visitors are bounced to login; logged-in readers/authors/reviewers are
     denied) — editorial staff (manager, section editor, assistant, subscription
     manager, admin) still see published content. All live-verified on `dst1`.
   *(anchors: `AccessForm`; `NavigationMenuService::getDisplayStatusCallback()` (NMI_TYPE_CURRENT/
   ARCHIVES); `IndexHandler::index()`; `SitemapHandler::_createContextSitemap()`;
   `OjsJournalMustPublishPolicy::effect()` (used by IssueHandler/ArticleHandler/
   SearchHandler); `IssueAction::subscriptionRequired()`; live matrix 2026-07-06)*
7. **Delayed open access is a subscription-mode issue-publish stamp.** When the mode is
   Subscription and a delay N (months) is set, *publishing an issue* marks it
   subscription-access with an open-access date N months out; the stamping happens in
   the issue-publish operation (owned by `issue-management`), this spec owns the
   setting. Changing the delay affects only issues published **after** the change —
   already-published issues keep their stamped open-access date (verifier live). The
   select only renders in subscription mode but a saved value persists
   invisibly if the mode changes (live: 12 months retained after switching to open).
   *(anchors: `IssueGridHandler::publishIssue()` (delay computation, `ISSUE_ACCESS_SUBSCRIPTION`
   + `setOpenAccessDate`); `AccessForm` `showWhen`)*
8. **Enable OAI includes/excludes the journal from harvesting.** With OAI disabled the
   journal's records vanish from OAI responses (live: 2 records → `noRecordsMatch`)
   while the endpoint itself still answers (Identify still returns the repository) —
   endpoint behavior, verbs and the site-level `[oai]` config switch are `oai-pmh`
   (feature 45). *(anchors: `AccessForm` (`enableOai`); `OAIDAO::_getRecordsRecordSetQuery()`
   `enableOai` exclusion; live 2026-07-06)*
9. **LOCKSS/CLOCKSS manifests are public, flag-gated pages.** With a flag **off**, that
   journal's `gateway/lockss|clockss` URL **redirects to the journal home** (302 — not
   a 404; live). With it **on**, the page is a public "Publisher Manifest": the
   LOCKSS/CLOCKSS permission statement plus the journal's published issues for one year
   (defaults to the latest year with issues, with prev/next-year navigation via
   `?year=`; an out-of-range year falls back to the latest with an informational note).
   The **site-level** URL (`/index/gateway/lockss`) always answers and lists every
   hosted journal whose flag is on, linking each journal's own manifest. Live: enabling
   both flags on `dst1` turned both manifests 200 with "Vol. 1 No. 1" listed.
   *(anchors: `GatewayHandler::lockss()`/`::clockss()` (redirect guard, year logic,
   journal-less branch), `getPublishedIssuesByNumber()`; `gateway/lockss.tpl` (`enableLockss`
   filter in the all-journals list); live)*
10. **The PN side tab is a plugin hook, not a journal setting.** Stock OJS (plugin not
    installed) shows only the "install the PKP|PN Plugin" panel (live). When installed,
    the checkbox calls the plugin-grid enable/disable endpoints (CSRF-tokened) — plugin
    lifecycle semantics belong to plugin management. *(anchor:
    `SettingsHandler::distribution()` `archivePn` branch)*
11. **Enabling payments rewires navigation on the spot.** Saving the Payments form with
    Enable checked persists `paymentsEnabled` + currency + method; the manager sidebar
    gains a **Payments** entry immediately (the settings page injects it on form
    success, before any reload) and on subsequent server renders for managers, admins
    and subscription managers. Reader-side, the stock **Subscriptions** nav item
    displays only when payments are enabled *and* a method is configured, and **My
    Subscriptions** additionally requires login + subscription mode. Fees, methods and
    the payment flows are `payments` (feature 77); subscription CRUD is
    `subscriptions-management`. Live: enable + CAD + Manual → persisted, sidebar entry
    appeared without reload. *(anchors: `PKPBackendPaymentsSettingsController::edit()`;
    `SettingsPage.vue` `mounted()` FORM_PAYMENT_SETTINGS branch;
    `TemplateManager::setupBackendPage()`; `NavigationMenuService::getDisplayStatusCallback()`
    (NMI_TYPE_SUBSCRIPTIONS, NMI_TYPE_MY_SUBSCRIPTIONS); `OJSPaymentManager::isConfigured()`; live)*
12. **The Payments management area is reachable regardless of the enable toggle.** The
    toggle gates only the sidebar link (rule 11): a manager who types `/payments` on a
    payments-disabled journal still gets the full Subscriptions/Payment-Types area
    (live on publicknowledge, payments off). Plausibly intended (subscription records
    can be curated before/without online payment collection) — Open question 2; the
    area's own rules are `subscriptions-management`/`payments`. *(anchor:
    `PaymentsHandler::__construct()`/`authorize()` (role + site-access policies only,
    no `paymentsEnabled` check); live)*

## Side effects

- **No emails, no notifications, no event-log entries** from any form on this page —
  saves are pure settings writes.
- **Navigation mutations**: Payments enable/disable adds/removes the manager-sidebar
  Payments entry (live, no reload — and note the same client hook also inserts the
  Institutions link) and flips the reader Subscriptions/My-Subscriptions nav items'
  display conditions (rule 11). Publishing mode "none" hides Current/Archives (rule 6).
- **Public-surface mutations**: SEO fields alter every page `<head>` (rule 5); LOCKSS/
  CLOCKSS flags open/close the gateway manifests (rule 9); OAI toggle adds/removes the
  journal's records from harvest responses (rule 8).
- **Publish-time snapshot**: license defaults are copied onto each publication when it
  is published (rule 3 — mechanics owned by `publication-license`).

## Settings that modify behavior

- **Site-level usage-stats settings** (geo stats / institution stats / public SUSHI)
  decide whether the **Statistics** tab renders on this page at all (`displayStatisticsTab`
  in `ManagementHandler::distribution()`) — the tab itself is `usage-statistics`.
- **PN plugin installed?** switches the PN side tab between info-panel and live toggle
  (rule 10).
- **Installed paymethod plugins** populate the Payment Plugins select and append their
  settings groups (feature 77).
- **`config.inc.php [oai] oai`** kills the OAI endpoint site-wide regardless of the
  per-journal Enable OAI radio (owned by `oai-pmh`).
- **Site Access restriction** (feature 55) walls the gateway manifests and sitemap along
  with the rest of the reader site.

## Cross-feature interactions

- **publication-license (29)** — owns the per-publication override form + the
  publish-time snapshot; this spec owns the journal defaults it computes from. The
  License-tab fields' downstream semantics (holder-type → computed holder, year basis →
  computed year, license → Override affordance) are documented there as rules 4–7.
- **site-access-restrictions (55)** — owns `restrictSiteAccess`/`restrictArticleAccess`
  (Users & Roles → Site Access Options). Publishing mode lives HERE; feature 55's
  galley login-gate is mode-independent and its wall covers the gateway pages. The two
  walls stack rather than compete (verifier live: with Restrict Article Access on, an
  anonymous galley hit bounces to login even in an open-access-status issue of a
  subscription journal; abstracts stay public; after login the subscription gate still
  applies on subscription-status issues).
- **subscription-access (76)** — owns the actual subscription gate (subscribed user /
  institution / delayed-OA date honoring / purchase paywall) that publishing mode
  SUBSCRIPTION arms. This spec verifies only that the mode persists + surfaces.
- **payments (77)** — owns the Payments form's method/fee configuration, the `_payments`
  endpoint atom (`API-backend-payments-edit`), `FORM-pkp-payment-settings-form` and the
  fee flows; this spec documents the toggle's location, persistence and nav effect.
- **subscriptions-management** — owns the `/payments` management area the sidebar link
  opens (and rule 12's reachability note).
- **oai-pmh (45)** — owns the OAI endpoint; consumes `enableOai` (its "Per-journal
  enableOai" setting row points here for the toggle's location).
- **web-feeds-syndication (46)** — the sitemap that publishing-mode NONE prunes (rule 6)
  and the RSS channel `<copyright>` element fed by License Terms.
- **doi-management / usage-statistics** — own the DOIs and Statistics tabs hosted on
  this page (their forms/atoms are claimed there).
- **issue-management** — owns issue publish (where the delayed-OA stamp fires) and the
  per-issue access-status/open-access-date fields.
- **journal-setup** — owns the shared journal-settings save endpoint
  (`API-context-edit`) all non-Payments tabs post to.
- **article-landing** — owns the landing page that renders the license block (CC badge /
  license link, journal License Terms, copyright line).

## Canonical scenarios

1. **Journal license defaults flow into a published article** — manager: on a scratch
   journal set Copyright Holder = Author, License = CC Attribution 4.0 on the License
   tab and save; publish a new submission. The publication carries the CC-BY license
   and "Copyright (c) <year> <author> (Author)", and its public landing page shows the
   CC badge and copyright line. (Live 2026-07-06, `dst1`.)
2. **Copyright-year basis: issue date vs article date** — manager: with an issue whose
   publication date is in 2025, publish an article in 2026 under "Use the issue's
   publication date" → copyright year 2025; flip to "Use the article's publication
   date" and publish another → 2026. (Live, `dst1`.)
3. **SEO metadata reaches the reader pages** — manager sets Description + a Custom Tag
   on Search Indexing; an anonymous visit shows the `<meta name="description">` on the
   journal homepage (and only there) and the custom tag on every journal page. (Live.)
4. **Publishing-mode lifecycle** — manager: fresh journal shows no mode selected (site
   behaves open); choosing Subscription reveals the Delayed Open Access select (1–60
   months) and saves both; choosing "OJS will not be used to publish" removes
   Current/Archives from the reader nav, the current issue from the homepage and issues
   from the sitemap, and anonymous visitors hitting an issue/article URL are bounced to
   login while the manager still sees them. Returning to Open restores the reader site.
   (Live, `dst1`.)
5. **LOCKSS/CLOCKSS manifests go live with the flags** — manager enables both
   checkboxes on Archiving → "LOCKSS and CLOCKSS" (labels link the manifests); the
   anonymous `gateway/lockss` and `gateway/clockss` pages now render the permission
   statement + the published-issue list, and before enabling they bounced to the
   journal home. (Live, `dst1`.)
6. **Payments enable + the settings boundary** — manager checks Enable on the Payments
   tab (Currency + Payment Plugins appear), picks CAD + Manual Fee Payment, saves: the
   Payments sidebar entry appears immediately. A section editor requesting the
   Distribution page gets the standard settings denial (the Area 6 gate). (Live:
   `dst1` + minoue on publicknowledge.)

## Known deviations (as-built ≠ intent)

- ⚠ **Delayed Open Access duration is bounded only in the UI** — the select offers
  Disabled/1–60 months but the schema has no bounds, so an API client can store 999 or
  even **-5** (both accepted live). A negative value back-dates the open-access stamp
  at the **next issue publish** — verifier-proven end-to-end: with -5 stored, a newly
  published issue got open-access date 2025-02 (the signed month arithmetic turns -5
  into -17 months) and anonymous readers were served its galleys at once, while the
  issue's access status still said subscription. Bounded: **not retroactive** —
  already-published issues keep their stamped dates (rule 7), and only an API client
  can store the value, so the severity stays LOW. Family of ledger rows 119/125
  (client-only validation). → `docs/e2e/app-changes.md` **row 126** (new, this spec).
  Suspected intent: `min:0,max:60` (or at least `min:0`) in the context schema.
- **Not flagged** (plausibly intended, recorded as Open questions): the unset
  publishing mode on new journals behaving as open access (OQ 1); the `/payments` area
  reachable with payments disabled (OQ 2, rule 12); the "Other license URL" radio
  pre-selected on journals with no default license (OQ 3).

**Verifier confirmation (2026-07-06).** Independently re-drove row 126 on a fresh scratch
journal (`j-dsva`) and attacked the permission/state/seam claims. **Row 126** reconfirmed
(999 → 200, -5 → 200 stored, publishingMode 7 → 400) **and its consequence proven
end-to-end**: with -5 stored, publishing an issue stamped a *past* open-access date
(signed month arithmetic: -5 → -17 months) and anonymous readers got the galleys of a
subscription-flagged issue immediately, while a sibling issue published under +12 stayed
gated — and the leak is **not retroactive** (already-embargoed issues keep their stamped
dates), so it stays LOW on row 126, no new ledger row. Seam probes folded into the rules:
publishing mode SUBSCRIPTION **alone gates nothing** — the galley gate arms per issue
access status and then holds against everyone with zero subscriptions configured (rule 6);
`restrictArticleAccess` (55) stacks mode-independently (cross-feature note). **License
snapshot immutability** proven live: default CC-BY → publish → default flipped to
CC-BY-NC → the published publication *and* its public landing page kept CC-BY; the next
publication took CC-BY-NC. **Year-basis fallback** found and added to rule 4 (issue basis
+ no issue → current year, live-discriminated with a 2024-backdated no-issue publication).
**OAI toggle** re-verified independently (3 records → `noRecordsMatch` after disable,
Identify still answering); seam with `oai-pmh` (45) correct (it claims only endpoint
atoms). **LOCKSS manifest** lists published issues only (an unpublished 2027 issue absent),
mid-life disable → immediate 302; the site-level list filters to flag-on journals and
renders an empty list (not a 404) with none — `{if $journals}` iterates all journals with
a per-item `enableLockss` filter. **Fresh-journal default** confirmed from code: no
`PUBLISHING_MODE_OPEN` fallback anywhere — every consumer compares `!= NONE` /
`== SUBSCRIPTION`, so the absent value falls through to open behaviour. **Payments
boundary** spot-checked beyond the retained test: an anonymous `PUT _payments` → 403,
nothing stored. Atlas: all 9 atoms single-owned; the feature-29 double-claim ruled out
(`publication-license` claims only its 3 per-publication atoms and references ownership
here); `FORM-pkp-payment-settings-form` + `API-backend-payments-edit` correctly left to
`payments` (77, FEATURE-MAP consistent); `PAGE-gateway-{index,plugin}` correctly not
claimed (generic gateway-plugin dispatch, hinted to plugin-management). Scratch residue:
`j-dsva` (id 15, subscription mode + the three probe issues), `j-dsvb` (id 16, CC-BY-NC
default, OAI off, LOCKSS off, SEO probe string). `publicknowledge` untouched (journal 1
settings = the two schema defaults only, verified in the DB). No finding contradicts the
retained `distribution-settings.spec.js` (not modified).

## Open questions

1. **Should a new journal be forced to pick a publishing mode?** The schema has no
   default; the Access form renders with nothing selected and the reader site behaves
   as open access until a mode is saved. One sentence: is "unset = open" intended, or
   should creation default the field to Open?
2. **Is the `/payments` management area meant to be reachable while payments are
   disabled?** The enable toggle gates only the sidebar link; the area itself carries
   no `paymentsEnabled` check (rule 12). Intended (curate subscriptions without online
   payments) or an oversight?
3. **"Other license URL" pre-selected on a fresh journal** — with no default license
   the License radio group renders the free-URL option checked with an empty box, which
   reads as "a custom license is configured" when none is. Cosmetic; fix in the radio
   widget or accept?
4. **PN pseudo-form ownership** — the PN tab drives the generic plugin-grid endpoints;
   this spec documents the tab, plugin-management semantics stay generic. Confirm no
   dedicated PN spec is wanted while the plugin ships uninstalled.

---

## Reference — entry points & surfaces

| Entry | Path | Atom |
|-------|------|------|
| Distribution settings page | Settings → Distribution (`management/settings/distribution`) | PAGE-management-settings-distribution |
| License form (journal defaults) | Distribution → License tab (`FORM_LICENSE`) | FORM-pkp-license-form (base) + FORM-license-form (OJS `copyrightYearBasis` override) |
| Search Indexing form | Distribution → Search Indexing tab (`FORM_SEARCH_INDEXING`) | FORM-pkp-search-indexing-form |
| Access form | Distribution → Access tab (`FORM_ACCESS`, hook-appended) | FORM-access-form |
| Archiving LOCKSS form | Distribution → Archiving → "LOCKSS and CLOCKSS" (`FORM_ARCHIVING_LOCKSS`) | FORM-archiving-lockss-form |
| LOCKSS manifest | `/{journal}/gateway/lockss` (+ site-level `/index/gateway/lockss`) | PAGE-gateway-lockss |
| CLOCKSS manifest | `/{journal}/gateway/clockss` (+ site-level) | PAGE-gateway-clockss |
| Locale keys | `manager.distribution.*` (8 keys: title, publishing modes, license labels, customHeaders…) | LOC-manager-manager-distribution |
| Payments form + endpoint | Distribution → Payments tab; `PUT _payments` | *(FORM-pkp-payment-settings-form, API-backend-payments-edit — owned by `payments`)* |
| DOIs / Statistics tabs | hosted on this page | *(owned by `doi-management` / `usage-statistics`)* |
| Journal-settings save endpoint | `PUT contexts/{id}` | *(API-context-edit — owned by `journal-setup`)* |

## Reference — code anchors

- Page assembly: `lib/pkp/pages/management/ManagementHandler.php` `distribution()`;
  `pages/management/SettingsHandler.php` `distribution()` (Access/Archiving/PN, payments
  nav-link state, `Template::Settings::distribution` hook);
  `lib/pkp/templates/management/distribution.tpl`;
  `templates/management/additionalDistributionTabs.tpl`.
- Forms: `lib/pkp/classes/components/forms/context/PKPLicenseForm.php`;
  `classes/components/forms/context/LicenseForm.php` (`copyrightYearBasis`);
  `lib/pkp/classes/components/forms/context/PKPSearchIndexingForm.php`;
  `classes/components/forms/context/AccessForm.php` (publishingMode, delayed OA,
  enableOai); `classes/components/forms/context/ArchivingLockssForm.php`;
  `lib/pkp/classes/components/forms/context/PKPPaymentSettingsForm.php` (feature 77).
- Schemas: `schemas/context.json` (publishingMode, delayedOpenAccessDuration,
  enableOai, copyrightYearBasis); `lib/pkp/schemas/context.json` (licenseUrl,
  copyrightHolderType/Other, licenseTerms, searchDescription, customHeaders,
  enableLockss/Clockss, paymentsEnabled, currency).
- Consumers: `pages/gateway/GatewayHandler.php` (`lockss()`, `clockss()`);
  `templates/gateway/{lockss,clockss}.tpl`; `classes/security/authorization/OjsJournalMustPublishPolicy.php`;
  `classes/services/NavigationMenuService.php`; `classes/template/TemplateManager.php`
  (backend Payments link); `lib/ui-library/src/components/Container/SettingsPage.vue`;
  `lib/pkp/classes/template/PKPTemplateManager.php` (SEO meta tags);
  `classes/submission/Submission.php` `_getContextLicenseFieldValue()`;
  `classes/controllers/grid/issues/IssueGridHandler.php` `publishIssue()` (delayed OA);
  `classes/oai/ojs/OAIDAO.php` (enableOai exclusion);
  `lib/pkp/api/v1/_payments/PKPBackendPaymentsSettingsController.php`.
