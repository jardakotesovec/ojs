---
name: journal-masthead-settings
scope: A journal manager maintains the journal's public identity and reader-facing texts — the Settings → Journal "Masthead" tab (title, initials, abbreviation, country, publisher, ISSNs, summary, about, editorial-history text) and Contact tab (principal + technical-support contact, mailing address), plus the Privacy-statement and For-Readers/Authors/Librarians information forms on Settings → Website — and every public page those settings surface on
shared: pkp-lib   # PKPMastheadForm/PKPContactForm/PKPPrivacyForm/PKPInformationForm + ManagementHandler::context()/website() and the context schema live in lib/pkp; the OJS overlay is real: APP MastheadForm adds abbreviation/publisher/publisherUrl/onlineIssn/printIssn, the OJS context.tpl defines the tab set, and the OJS information sidebar block renders the info blurbs
status: verified
e2e-plans: [journal-setup, public-pages]
atlas-claims:
  - PAGE-management-settings-context
  - FORM-masthead-form
  - FORM-pkp-masthead-form
  - FORM-pkp-contact-form
  - FORM-pkp-privacy-form
  - FORM-pkp-information-form
  - SCHEMA-context-ojs
  - SCHEMA-context-pkp
  - DB-journal_settings
---

# Journal masthead & identity settings

## Purpose

Everything a reader learns about *what this journal is* comes from a handful of settings a manager
maintains in two places. **Settings → Journal** (the page this spec owns) has a **Masthead** tab — the
journal's *identity*: title, initials, abbreviation, publishing country, publisher name/URL, online and
print ISSN, the one-paragraph **Journal Summary**, the long **About the Journal** text, and the
**Editorial History** narrative — and a **Contact** tab: the principal contact (name, email, phone,
affiliation, mailing address) and the technical-support contact. Two more reader-facing text forms live
on **Settings → Website → Setup** but belong to the same job and are owned here: the **Privacy
Statement** and the **For Readers / For Authors / For Librarians** information blurbs. Each field
surfaces on specific public pages — the journal title heads every page and email, the summary appears on
the site's journal list, the about text is the `/about` page, the contacts fill `/about/contact`, the
privacy statement backs `/about/privacy` and the registration consent link, and the info blurbs feed the
`/information/*` pages and the *Information* sidebar block. This spec owns the **settings forms and
which setting surfaces where**; the public pages that render them are owned by `about-pages` and
`journal-homepage`.

It does **not** own: the **editorial-team roster** and its "Editorial Masthead" appearance tab
(`editorial-masthead` — a *different* tab that shares the word "Masthead"); the **Sections** and
**Categories** tabs that sit on the same Settings → Journal page (`sections`, `categories`); the other
Website-settings tabs around Privacy/Information (`website-appearance-settings`, `navigation-menus`,
`announcements`, `languages-locales`); journal **creation/enable/path** — the site admin's Hosted
Journals wizard (`site-administration`); or the public **page renders** (`about-pages`,
`journal-homepage`).

## Actors & permissions

One gate covers everything here: the four forms all save to the **journal-settings endpoint**
(`PUT contexts/{id}`), and both the settings pages and that endpoint admit only a **site admin** or a
**manager whose role carries settings access** (the per-group *Permit settings* flag owned by
`roles-permissions`). There is no finer split — whoever can open the page can save every form on it.
Everyone else (section editor, assistant, author, reviewer, reader, anonymous) is turned away from the
pages *and* the endpoint, and their dashboard never offers a Settings menu. Reading the **public
surfaces** requires nothing (anonymous pages, owned by `about-pages`/`journal-homepage`), except that a
signed-in manager additionally sees inline **Edit** pencils on those pages linking back to these forms.

| Action | Who may — and when |
|--------|--------------------|
| **Open Settings → Journal (Masthead + Contact) and Settings → Website (Privacy + Information)** | • Site admin — always<br>• Manager — only if one of their manager groups has *Permit settings*; a manager group without it is refused and sees no Settings menu at all<br>• Section editor, assistant, author, reviewer, reader, anonymous — refused ("role does not have access") <sup>a</sup> |
| **Save any of the four forms** (journal-settings save) | • The same two groups — the save endpoint applies the identical settings-access check, so the page gate cannot be bypassed by calling the endpoint directly (verified live: a manager stripped of settings access gets refused on both) <sup>b</sup> |
| **See the inline Edit pencil on the public About / Contact / Editorial-History / Information pages** | • Signed-in manager/admin with settings access — the pencil deep-links to the owning tab (e.g. `/about` → Masthead tab); anonymous readers never see it <sup>c</sup> |
| **Read the public surfaces** (about, contact, privacy, information pages, homepage/site index, OAI identity) | • Any visitor — no login; the pages are owned by `about-pages`/`journal-homepage` and gated only by the site-access wall (`site-access-restrictions`) <sup>d</sup> |

<sup>a</sup> `SettingsHandler::__construct()` (`settings` op: `ROLE_ID_SITE_ADMIN` + `ROLE_ID_MANAGER`); `ManagementHandler::authorize()` (`CanAccessSettingsPolicy` on the `settings` op); `CanAccessSettingsPolicy::effect()` (admin, or manager group with `permitSettings`). Live 2026-07-05: dbarnes (manager) + admin → 200; dbuskins/mfritz/atester/jjanssen → `authorizationDenied?message=user.authorization.roleBasedAccessDenied`; dbuskins' backend menu carries no `settings` entry, dbarnes' shows Journal/Website/Workflow/Distribution/Users & Roles ·
<sup>b</sup> `PKPContextController::getGroupRoutes()` (`roleAuthorizer([SITE_ADMIN, MANAGER])` on `PUT contexts/{contextId}`) + `PKPContextController::authorize()` (adds `CanAccessSettingsPolicy`). Live: flipping `permitSettings` off on a scratch journal's manager group → the same manager's page 302→denied and `PUT contexts/{id}` → 401, value unchanged; their nav lost the Settings menu; access on other journals unaffected ·
<sup>c</sup> `frontend/components/editLink.tpl` included by `about.tpl`/`contact.tpl`/`editorialHistory.tpl` (`path="context" anchor="masthead|contact"`) and `information.tpl` (`path="website" anchor="setup/information"`). Live: `/publicknowledge/about` as dbarnes carries `management/settings/context#masthead`; anonymous render has none ·
<sup>d</sup> `AboutContextHandler::authorize()` / `InformationHandler::authorize()` (`ContextRequiredPolicy` only) — owned by `about-pages`

## Fields & validation

All four forms are **journal-settings forms**: they submit their whole field set to the journal-settings
endpoint, and validation combines the **form's own required marks** (client-side) with the **schema's
rules** (server-side). Multilingual fields are entered per locale (the form shows a locale switcher for
every enabled form language — en + fr_CA on the test journal); a *required multilingual* field must be
filled **in the journal's primary locale only** — other locales may stay empty. ⚠ Three fields are
marked required on screen but are not enforced by the server (see Known deviations).

**Masthead form** (Settings → Journal → Masthead; groups *Journal Identity*, *Publishing Details*,
*Editorial Masthead*, *Description*):

| Field (UI label) | Required? | Rules | Anchor |
|------------------|-----------|-------|--------|
| Journal title | Yes (primary locale) | Multilingual text. The journal's name everywhere: page header/title, site index entry, emails, OAI repository name. Saving it empty in the primary locale is rejected ("You must complete this field in English."); a secondary locale may be empty. | `PKPMastheadForm` (`name`, `isRequired`); `context.json` top-level `required` |
| Journal initials | Yes (UI only ⚠) | Multilingual short text (e.g. "JPK"). Used as the journal's acronym in email variables and compact backend listings. Server accepts empty (deviation, row 119). | `PKPMastheadForm` (`acronym`); `ContextEmailVariable::values()` (`CONTEXT_ACRONYM`) |
| Journal Abbreviation | No | Multilingual text (e.g. "J Pub Know"). Feeds citation/indexing metadata (CSL citations, JATS, Crossref), not the default reader theme. | `MastheadForm` (`abbreviation`, OJS-added) |
| Country | Yes | Single select of countries. "The country where this journal is based." Once set it cannot be cleared (an empty value is rejected as an invalid country); a journal *created* by the admin wizard has none until the Masthead form is first saved. | `PKPMastheadForm` (`country`, `isRequired`); `context.json` (`validation: [country]`, not nullable) |
| Publisher | No | Plain text, publisher institution name. Surfaces in indexing/export metadata (Google Scholar tags, OAI MARC, DOAJ, Crossref, PubMed) and the LOCKSS/CLOCKSS manifest pages. | `MastheadForm` (`publisherInstitution`, OJS-added) |
| URL (publisher) | No | Must be a valid URL ("This is not a valid URL."). | `MastheadForm` (`publisherUrl`); `context.json` (`validation: [url]`) |
| Online ISSN / Print ISSN | No | Each must be a valid ISSN, checksum included ("This is not a valid ISSN."): format `NNNN-NNNC` where the final check digit may be `X`, then the mod-11 checksum is computed — a well-formed but checksum-wrong value (e.g. `1234-5678`) is refused, its checksum-correct sibling (`1234-5679`) accepted (verifier-probed). Not printed by the default reader theme — they feed indexing/export metadata (Google Scholar `citation_issn`, DOAJ, Crossref, PubMed, LOCKSS pages). | `MastheadForm` (`onlineIssn`, `printIssn`, OJS-added); `context.json` (`validation: [issn]`); `ValidationServiceProvider` (`issn` rule: regex + check digit) |
| Editorial History (rich text) | No | Multilingual rich text describing the journal's editorial past. Renders at the bottom of the public `/about/editorialHistory` page, below the past-contributor roster (roster config owned by `editorial-masthead`). | `PKPMastheadForm` (`editorialHistory`); `editorialHistory.tpl` (`getLocalizedData('editorialHistory')`) |
| Journal Summary | No | Multilingual rich text, "a brief description of your journal". Always shown beside the journal on the **site index** journal list; shown on the **journal homepage** only when the theme's *journal summary* option is on (owned by `website-appearance-settings`). | `PKPMastheadForm` (`description`); `indexSite.tpl` (`getLocalizedDescription()`); `indexJournal.tpl` (`showDescriptionInJournalIndex` theme option) |
| About the Journal | No | Multilingual rich text (full editor with image upload). The body of the public `/about` page. | `PKPMastheadForm` (`about`); `about.tpl` |

**Contact form** (Settings → Journal → Contact; groups *Principal Contact*, *Technical Support
Contact*). The page intro notes the entries appear on the public Contact page:

| Field (UI label) | Required? | Rules | Anchor |
|------------------|-----------|-------|--------|
| Name (principal) | Yes | Plain text. Saving it empty is rejected ("This field is required."). | `PKPContactForm` (`contactName`); `context.json` top-level `required` |
| Email (principal) | Yes | Must be a valid email ("This is not a valid email address."); empty rejected. Also the journal's OAI admin email. | `PKPContactForm` (`contactEmail`); `context.json` (`email_or_localhost`) |
| Phone (principal) | No | Plain text. | `PKPContactForm` (`contactPhone`) |
| Affiliation (principal) | No | Multilingual text. | `PKPContactForm` (`contactAffiliation`) |
| Mailing Address | No | Plain textarea; the journal's postal address on the Contact page. | `PKPContactForm` (`mailingAddress`) |
| Name (support) | Yes (UI only ⚠) | Plain text; server accepts empty (row 119). | `PKPContactForm` (`supportName`) |
| Email (support) | Yes (UI only ⚠) | Valid-email format enforced when present; server accepts empty (row 119). | `PKPContactForm` (`supportEmail`) |
| Phone (support) | No | Plain text. | `PKPContactForm` (`supportPhone`) |

**Privacy form** (Settings → Website → Setup → Privacy Statement — one field):

| Field (UI label) | Required? | Rules | Anchor |
|------------------|-----------|-------|--------|
| Privacy Statement | No | Multilingual rich text. Its own description states where it appears: "during user registration, author submission, and on the publicly available Privacy page." New journals get a stock statement by default; **clearing it takes the Privacy page offline** (rule 6). | `PKPPrivacyForm` (`privacyStatement`); `context.json` (`defaultLocaleKey: default.contextSettings.privacyStatement`) |

**Information form** (Settings → Website → Setup → Information; group *Journal information
descriptions*):

| Field (UI label) | Required? | Rules | Anchor |
|------------------|-----------|-------|--------|
| For Readers / For Authors / For Librarians | No | Three multilingual rich-text blurbs. Each feeds its `/information/{readers,authors,librarians}` page and its link in the *Information* sidebar block; new journals get stock texts by default; an emptied blurb drops its sidebar link (rule 7). | `PKPInformationForm` (`readerInformation`, `authorInformation`, `librarianInformation`); `context.json` (`defaultLocaleKey: default.contextSettings.for*`) |

## Rules & state

No state machine — every rule is "save a setting, the public surface follows it immediately" (settings
are read live; no publish/approval step, no versioning). All four forms save through the same
journal-settings endpoint, so a save behaves identically whether driven from the form or the API —
except for the three UI-only required marks (rule 3 ⚠).

1. **The Settings → Journal page hosts four tabs; this feature owns the first two.** The page (menu
   *Settings → Journal*, titled "Journal Settings") carries **Masthead**, **Contact**, **Sections**
   (legacy grid — `sections`) and **Categories** (Vue manager — `categories`). Masthead and Contact are
   the two forms specced here; the Privacy and Information forms sit on Settings → Website's *Setup* tab
   group (live-verified tab sets on both pages). *(anchor: `ManagementHandler::context()` (builds
   `PKPContactForm` + APP `MastheadForm`); `templates/management/context.tpl` (the four tabs);
   `ManagementHandler::website()` (builds `PKPPrivacyForm` + `PKPInformationForm`);
   `lib/pkp/templates/management/website.tpl` (`setup/privacy`, `setup/information`))*
2. **Saving is immediate and locale-aware.** A form submits its full field set; on success the new
   values are returned and the public surfaces reflect them on next load (no cache to clear,
   no re-publish). Multilingual values save per locale and each public page renders the value for the
   *viewer's* locale (live: French title/about rendered on the `fr_CA` pages after one save,
   English pages unchanged). A required multilingual field is enforced **in the primary locale only** —
   clearing the English (primary) title is rejected while an empty French title saves fine.
   Two precisions (verifier-probed live): **a multilingual value saves per locale, never wholesale** —
   a save that carries only some locales rewrites just those locales' stored values, so the primary
   locale cannot be cleared by omitting it (and an explicit empty/`null` primary-locale title is
   refused); and **an empty viewer-locale value falls back on the public page** — the page shows the
   primary-locale value, or failing that any non-empty locale's, rather than a blank (a French-only
   About text renders on the English `/about` too).
   *(anchor: `PKPContextController::edit()` (`ContextService::validate()` → `edit()`);
   `ValidatorFactory::required()` (multilingual props checked at `$primaryLocale` only, and only when
   the locale key is present); `SchemaDAO::updateObject()` (multilingual settings written per
   `(setting_name, locale)` row — omitted locales untouched); `LocalizedData::getBestLocalizedData()`
   (viewer → primary → any-non-empty fallback); live probes on scratch journals `jms2` + `jmv1vrf`)*
3. **Server-side validation is a subset of what the forms display** ⚠. The server rejects: empty
   *Journal title* (primary locale), empty/invalid *principal Name/Email*, invalid *ISSN* (both),
   invalid *publisher URL*, empty-or-unknown *Country* (all live-verified 400s with the quoted
   messages). But *Journal initials*, *support Name* and *support Email* — all marked required on
   screen and enforced by the form client-side — are accepted empty by the endpoint, so an API call can
   clear them (live-verified twice — author then verifier: all three cleared with 200, then restored;
   support Email stays format-checked when non-empty). One canonical statement here — details and
   ledger link in Known deviations (row 119).
   *(anchor: `context.json` top-level `required` = name/contactName/contactEmail (+ urlPath, locale
   props owned elsewhere); `PKPMastheadForm`/`PKPContactForm` (`isRequired` marks); `ValidatorISSN`,
   `ValidatorFactory` (`email_or_localhost`, `url`, `country`))*
4. **Identity fields surface exactly where the labels promise** (all live-verified on `jms2` except the
   metadata exports, which are code-anchored):
   - *Journal title* — reader-page header/`<title>`, the **site index** entry, the backend context
     switcher, **emails** (name + initials variables), and the **OAI Identify** repository name.
     (The *site-level* OAI endpoint at `/index/oai` identifies with the **site's** own title and
     contact email instead — journal settings play no part there; `site-administration`.
     Verifier-probed live.)
   - *Journal Summary* — the site index entry under the title; the journal homepage's "About the
     Journal" block **only when the theme option is on** (off by default — `website-appearance-settings`).
   - *About the Journal* — the `/about` page body.
   - *Editorial History* — the closing section of `/about/editorialHistory` (the roster above it is
     `editorial-masthead`'s).
   - *Publisher, URL, ISSNs, Abbreviation, Country* — **not rendered by the default reader theme**;
     they feed machine/indexing surfaces: Google Scholar meta tags, OAI record formats (MARC etc.),
     DOAJ/Crossref/PubMed/DataCite exports, CSL citations (abbreviation), JATS, and the LOCKSS/CLOCKSS
     manifest gateway pages.
   *(anchor: `frontend/components/header.tpl`; `indexSite.tpl`; `about.tpl`; `editorialHistory.tpl`;
   `JournalOAI::repositoryInfo()` (`repositoryName = getLocalizedName()`, `adminEmail =
   getData('contactEmail')`) — live-verified via `?verb=Identify`; `GoogleScholarPlugin::articleViewCallback()`
   (`citation_issn`, `citation_publisher`, `citation_journal_abbrev` — verifier-confirmed live on a
   publicknowledge article page: the ISSN + abbreviation meta tags render; `citation_publisher` only
   when a publisher is set); `CitationStyleLanguagePlugin` (`abbreviation`);
   `templates/gateway/{lockss,clockss}.tpl`)*
5. **The Contact settings are the `/about/contact` page, block by block.** Mailing address, a
   *Principal Contact* block (name, affiliation, phone, email) and a *Technical Support Contact* block
   (name, phone, email) render exactly the saved values (live-verified); email addresses are
   JavaScript-obfuscated against scraping (page mechanics owned by `about-pages`). The principal email
   doubles as the OAI admin email (rule 4).
   *(anchor: `AboutContextHandler::contact()` → `contact.tpl` (`{mailto encode='javascript'}`))*
6. **The Privacy statement gates three surfaces at once.** While set (new journals start with the stock
   text), it renders on `/about/privacy`, as the "privacy statement" consent link on the **registration
   form**, and as the *Privacy Statement* section of `/about/submissions`. **Clearing it (all locales)
   removes all three**: the Privacy page turns *not found*, and the registration + submissions
   references disappear (all live-verified). Site-wide-statement override and the page itself are owned
   elsewhere (`site-settings` config flag; `about-pages` rule 4).
   *(anchor: `AboutSiteHandler::privacy()` (`NotFoundHttpException` when empty); `userRegister.tpl`
   (`{if $currentContext->getData('privacyStatement')}` privacy-consent opt-in); `submissions.tpl`
   (`privacyStatement` section))*
7. **Each information blurb drives its page and its sidebar link independently.** With the
   *Information* sidebar block active (plugin ships enabled; sidebar placement owned by
   `website-appearance-settings`), the sidebar lists one link per **non-empty** blurb — For Readers /
   For Authors / For Librarians. Emptying a blurb removes **its** link; emptying all three removes the
   **whole block**; the `/information/*` page itself stays reachable but renders only its heading (it
   does not 404 — contrast the privacy page, rule 6; Open question 2). New journals start with stock
   texts for all three. All live-verified on `jms2`.
   *(anchor: `InformationBlockPlugin::getContents()` + `block.tpl` (per-blurb `{if}`s, outer `{if}` on
   any); `InformationHandler::index()` (no empty-check); pages owned by `about-pages`)*
8. **Settings access is all-or-nothing per journal, and scoped per journal.** The one policy from the
   Actors table is the only gate on every surface in this spec (both settings pages, the save endpoint).
   Stripping *Permit settings* from a manager group locks its members out of pages **and** endpoint on
   that journal immediately, drops the Settings menu from their nav, and leaves their access on other
   journals untouched (live-verified end-to-end on `jms2` — the flag's toggle itself is
   `roles-permissions`).
   *(anchor: `CanAccessSettingsPolicy::effect()`; `PKPContextController::authorize()`;
   `ManagementHandler::authorize()`)*
9. **The same identity fields are also editable by the site admin from Hosted Journals.** The admin
   wizard/edit form (`site-administration`) carries title, initials, abbreviation and summary for any
   journal, plus admin-only properties (enabled, path). Same storage, no interaction beyond
   last-write-wins; the manager-facing Masthead form is the canonical surface for identity upkeep.
   ⚠ The save endpoint's missing per-field authority guard (a manager can PUT admin-only properties
   like `enabled`/`urlPath`) is **ledger row 118**, owned by `site-access-restrictions`/
   `site-administration` — referenced, not re-narrated.
   *(anchor: `AdminHandler::contexts()` (APP `ContextForm`); `PKPContextController::edit()` (row 118))*

## Side effects

- **Storage** — every field here is a journal setting (`journal_settings`, keyed per locale for
  multilingual fields); the `journals` row itself (path/enabled/seq/primary locale) is not touched by
  these forms (owned by `site-administration`). No event-log entry, no notification, and no email is
  produced by saving any of the four forms — the effect is purely "the public surfaces now show the new
  values".
- **Public surfaces per field** — the full field→surface map is rule 4 (identity), rule 5 (contact),
  rule 6 (privacy), rule 7 (information). Summarised: title → header/site index/emails/OAI; summary →
  site index (+homepage w/ theme option); about → `/about`; editorial history →
  `/about/editorialHistory` tail; contact block → `/about/contact` + OAI admin email; privacy →
  `/about/privacy` + registration consent + `/about/submissions`; info blurbs → `/information/*` +
  sidebar block; publisher/ISSN/abbreviation/country → indexing & export metadata only.
- **Manager convenience** — the public About/Contact/Editorial-History/Information pages show the
  settings-linked Edit pencil to managers (Actors table row 3).

## Settings that modify behavior

- **Permit settings** (per manager group; `roles-permissions`) — the single access switch for this
  whole feature (rule 8).
- **Theme option "journal summary"** (`showDescriptionInJournalIndex`, default theme, off by default;
  `website-appearance-settings`) — whether the Journal Summary also renders on the journal's own
  homepage (it always renders on the site index).
- **Sidebar block placement + Information block plugin** (`website-appearance-settings` /
  `journal-homepage`) — whether the Information block appears at all; the block's *content* follows
  this feature's blurbs (rule 7).
- **`general.sitewide_privacy_statement`** (config; `site-settings`) — when on, `/about/privacy` shows
  the *site* statement instead of this journal's (seam documented at `about-pages` rule 4).
- **`restrictSiteAccess`** (`site-access-restrictions`) — walls all the public surfaces behind login;
  no effect on the settings forms themselves.
- **Enabled form locales** (`languages-locales`) — which locale tabs the multilingual fields offer;
  the primary locale defines where "required" bites (rule 2).

## Cross-feature interactions

- **about-pages** — owns the public **page renders** (`/about`, `/about/contact`, `/about/privacy`,
  `/information/*`, `/about/editorialHistory`); this spec owns the **settings** they project and the
  field→surface mapping. Their "Settings that modify behavior" list names this spec as owner —
  reciprocal seam.
- **editorial-masthead** — the *other* "Masthead": Settings → Website → Editorial Masthead orders the
  public roster; this spec's Editorial History **text** shares the `/about/editorialHistory` page with
  their roster (their Cross-feature note + label-collision Open question 3 — theirs, not repeated).
- **sections / categories** — own the other two tabs on the Settings → Journal page (rule 1).
- **website-appearance-settings** — owns the rest of Settings → Website (theme option for the summary,
  sidebar management) around the Privacy/Information forms specced here.
- **roles-permissions** — owns the *Permit settings* toggle this feature's gate reads (rule 8), and the
  Users & Roles surfaces on the same Settings menu.
- **site-administration** — owns journal creation and the admin add/edit-journal form (`ContextForm` /
  `PKPContextForm`, `FORM-context-form`/`FORM-pkp-context-form` — **not claimed here**), the
  admin-only context properties, and (with `site-access-restrictions`) ledger row 118 on the shared
  save endpoint.
- **site-settings** — owns the site-level counterpart forms (site title, site-wide privacy) and the
  `sitewide_privacy_statement` config seam.
- **workflow-settings** — owns the author-facing guidance texts (author guidelines, checklist,
  copyright notice) that share the `/about/submissions` page with this spec's privacy statement.
- **subscription-access** — the journal's payment/subscription contact is *not* here (Distribution →
  Payments); only principal/support contacts are.

## Canonical scenarios

1. **Rebrand the journal and see every surface follow** — A manager opens Settings → Journal →
   Masthead, edits title (en + fr), initials, abbreviation, country, publisher + URL, both ISSNs,
   summary, about and editorial history, and saves. The journal header, site-index entry (title +
   summary), `/about` body, `/about/editorialHistory` tail and OAI `Identify` repository name all show
   the new values — in the viewer's locale; the French pages show the French title/about. Bad values
   are refused with field errors: an invalid ISSN, an invalid publisher URL, an empty primary-locale
   title (an empty French title is fine). *(live-verified 2026-07-05 on scratch `jms2`; e2e:
   `journal-setup.spec.js` rows 1–2, 4)*
2. **Point readers at the right people** — The manager fills the Contact tab: principal contact
   (name/email/phone/affiliation), mailing address, support contact. `/about/contact` renders the
   mailing address and both contact blocks with obfuscated emails; the OAI admin email follows the
   principal email. Clearing the principal name or entering a malformed email is refused.
   *(live-verified on `jms2`; e2e: `journal-setup.spec.js` row 3, `public-pages.spec.js`)*
3. **Publish, then retire, the privacy statement and reader blurbs** — The manager edits the Privacy
   Statement on Settings → Website → Setup: the custom text appears on `/about/privacy` and stays
   linked from the registration form. Clearing the statement 404s the Privacy page and drops the
   registration and `/about/submissions` references. On the Information form, a custom For-Readers
   blurb appears at `/information/readers` and in the sidebar Information block; clearing it removes
   its sidebar link (page stays, empty); clearing all three blurbs removes the whole block.
   *(live-verified on `jms2`)*
4. **Only settings-managers get in** — A section editor, assistant, author and reviewer each get
   "access denied" opening Settings → Journal and see no Settings menu; a manager and the site admin
   get the four-tab page. Stripping *Permit settings* from a scratch journal's manager group locks that
   journal's managers out of the page **and** the save endpoint (the value stays unchanged) while their
   other journals are unaffected. *(live-verified 2026-07-05 on `publicknowledge` (read-only) + `jms2`)*

## Known deviations (as-built ≠ intent)

- ⚠ **Three "required" fields are only client-enforced — the save endpoint accepts them empty**
  (proposed **ledger row 119**). *Journal initials* (Masthead) and *support Name/Email* (Contact) carry
  the same required mark and inline "this field is required" behaviour as Journal title/principal
  contact, but the schema does not require them, so a direct API PUT clears them (live: acronym and
  supportName emptied with 200 on `jms2`, restored). Consequence: a journal can silently lose its
  initials (used in email variables) via any API client, and QA testing "required" semantics at the API
  level gets opposite results for on-screen-identical fields. LOW: no UI path clears them, values are
  restorable. Suspected intent: the schema's required list simply lags the forms'.
- **Note — Country is half-required.** The Masthead form requires it and the server refuses to *clear*
  it, but it is not required at creation — an admin-created journal has no country until the first
  Masthead save (the wizard never asks; verifier re-confirmed at the creation endpoint: a wizard-parity
  create leaves `country` unset). As-built and probably intended (the identity tab is the journal's
  completion step); recorded so nobody reads "required" as "always present". (Open question 1.)
- **Referenced, owned elsewhere:** the save endpoint's missing per-field authority guard (manager can
  PUT admin-only props) is **row 118** (`site-access-restrictions`); the "Masthead" tab-name collision
  is `editorial-masthead` Open question 3; and the *creation* endpoint enforces **no** required
  property at all — an API client can create a nameless, contact-less journal because
  `PKPContextService::validate()` passes the action string where `ValidatorFactory::required()`
  expects null-on-add — **ledger row 120** (`site-administration`; found by this spec's verifier while
  re-checking the country note; no effect on the *edit-time* rules above, which are live-verified).

## Open questions

1. **Should Country (and the other identity fields) be enforced at journal creation** rather than only
   on the first Masthead save, so a live journal can't sit indefinitely without country/initials?
2. **Should an emptied information page 404 like the privacy page does?** As-built `/information/readers`
   with an empty blurb renders an empty titled page (rule 7) while `/about/privacy` with an empty
   statement is *not found* (rule 6) — confirm the asymmetry is intended.
3. **Should the schema's required list be aligned with the forms' required marks** (row 119), or the
   marks relaxed? One-line maintainer call decides the fix direction.

---

<!-- REFERENCE MATERIAL — provenance and campaign bookkeeping, not product-owner narrative. -->

## Reference — entry points & surfaces

| Entry | Path | Atom |
|-------|------|------|
| Settings → Journal page | `GET {journal}/management/settings/context` → `ManagementHandler::context()` → `templates/management/context.tpl` (Masthead/Contact/Sections/Categories tabs) | PAGE-management-settings-context |
| Masthead form | Settings → Journal → **Masthead** → APP `MastheadForm` extends `PKPMastheadForm` → `PUT api/v1/contexts/{id}` | FORM-masthead-form, FORM-pkp-masthead-form |
| Contact form | Settings → Journal → **Contact** → `PKPContactForm` → `PUT api/v1/contexts/{id}` | FORM-pkp-contact-form |
| Privacy form | Settings → Website → Setup → **Privacy Statement** → `PKPPrivacyForm` → `PUT api/v1/contexts/{id}` | FORM-pkp-privacy-form |
| Information form | Settings → Website → Setup → **Information** → `PKPInformationForm` → `PUT api/v1/contexts/{id}` | FORM-pkp-information-form |
| Journal entity schema | `lib/pkp/schemas/context.json` + OJS overlay `schemas/context.json` (validation source of truth for every field here) | SCHEMA-context-pkp, SCHEMA-context-ojs |
| Settings storage | `journal_settings` (per-locale rows for multilingual fields) | DB-journal_settings |
| Journals table *(not this feature)* | `journals` (path/enabled/seq/primary locale — admin-owned) | DB-journals *(owned by `journal-homepage`; creation → `site-administration`)* |
| Admin add/edit journal form *(not this feature)* | Admin → Hosted Journals → APP `ContextForm` extends `PKPContextForm` (instantiated only in `AdminHandler::contexts()` — verified) | FORM-context-form, FORM-pkp-context-form *(→ `site-administration`)* |
| Public renders *(not this feature)* | `/about`, `/about/contact`, `/about/privacy`, `/information/*`, `/about/editorialHistory`, site index / homepage | PAGE-about-*, PAGE-information-* *(owned by `about-pages`)*, PAGE-index-* *(journal-homepage)* |
| Information sidebar block *(referenced)* | `plugins/blocks/information` → `InformationBlockPlugin::getContents()` | PLUGIN-blocks-* *(owned by `journal-homepage`)* |

## Reference — code anchors

- **Page assembly**: `lib/pkp/pages/management/ManagementHandler.php` — `context()` (builds
  `PKPContactForm` + APP `MastheadForm`; registers `FORM_CONTACT`/`FORM_MASTHEAD`; also mounts the
  `categoryForm` for the Categories tab), `website()` (builds `PKPPrivacyForm` +
  `getInformationForm()`), `authorize()` (`CanAccessSettingsPolicy` on `settings`);
  `pages/management/SettingsHandler.php` `__construct()` (role assignments: settings =
  admin+manager). Templates: `templates/management/context.tpl` (OJS, the four tabs),
  `lib/pkp/templates/management/website.tpl` (`setup/information`, `setup/privacy`).
- **Forms**: `classes/components/forms/context/MastheadForm.php` (OJS — adds `abbreviation`,
  `publisherInstitution`, `publisherUrl`, `onlineIssn`, `printIssn`);
  `lib/pkp/classes/components/forms/context/PKPMastheadForm.php` (`name`*, `acronym`*, `country`*,
  `editorialHistory`, `description`, `about`; * = `isRequired`);
  `PKPContactForm.php` (`contactName`*, `contactEmail`*, `contactPhone`, `contactAffiliation`(ml),
  `mailingAddress`, `supportName`*, `supportEmail`*, `supportPhone`); `PKPPrivacyForm.php`
  (`privacyStatement`); `PKPInformationForm.php` (`readerInformation`, `authorInformation`,
  `librarianInformation`).
- **Save & validation**: `lib/pkp/api/v1/contexts/PKPContextController.php` — `getGroupRoutes()`
  (manager+admin group), `authorize()` (`CanAccessSettingsPolicy`), `edit()` (context-match guard,
  `ContextService::validate()`/`edit()`); `lib/pkp/classes/services/PKPContextService.php`
  `validate()` (schema rules + `ValidatorFactory::required()`); `lib/pkp/classes/validation/
  ValidatorFactory.php` `required()` (primary-locale-only for multilingual); schemas
  `lib/pkp/schemas/context.json` (top-level `required: [name, primaryLocale, supportedLocales,
  urlPath, contactName, contactEmail]`; `email_or_localhost`, `country`) + `schemas/context.json`
  (OJS: `issn` on both ISSNs, `url` on `publisherUrl`).
- **Gate**: `lib/pkp/classes/security/authorization/CanAccessSettingsPolicy.php` `effect()`
  (admin, or manager group with `permitSettings`).
- **Surfacing**: `templates/frontend/pages/indexSite.tpl` (title + description per journal);
  `templates/frontend/pages/indexJournal.tpl` (description behind `showDescriptionInJournalIndex`);
  `lib/pkp/templates/frontend/pages/{about,contact,editorialHistory}.tpl` (+ `editLink.tpl` pencil);
  `pages/information/InformationHandler.php` + `information.tpl`;
  `plugins/blocks/information/InformationBlockPlugin.php` `getContents()` + `templates/block.tpl`;
  `lib/pkp/classes/mail/variables/ContextEmailVariable.php` (`CONTEXT_NAME`, `CONTEXT_ACRONYM`);
  OAI: `classes/oai/ojs/JournalOAI.php` `repositoryInfo()` (live `?verb=Identify`);
  metadata consumers: `plugins/generic/googleScholar/GoogleScholarPlugin.php` (`citation_issn`,
  `citation_publisher`), `plugins/generic/citationStyleLanguage/CitationStyleLanguagePlugin.php`
  (abbreviation), DOAJ/Crossref/PubMed/DataCite filters, `templates/gateway/{lockss,clockss}.tpl`.
- **Liveness note** — probed 2026-07-05 against `:8000` (`ojs_test`, PostgreSQL, `APPLICATION_ENV=test`).
  **Reads on `publicknowledge`** (never mutated; identity fields confirmed intact afterwards — name
  "Journal of Public Knowledge", path, ISSNs, contacts, `enabled:true`): settings/context 200 as
  dbarnes/admin with the four tabs and the exact field/required/multilingual sets in the tables above
  (parsed from the page state); settings/website carried `privacy` + `information` forms; denial matrix
  dbuskins/mfritz/atester/jjanssen → `roleBasedAccessDenied`, no `settings` nav entry for dbuskins; the
  `/about` Edit pencil → `management/settings/context#masthead` for dbarnes, absent anonymously.
  **Mutations on scratch journals** (via `/api/v1/_test/scenarios/journal`): `jms2` (id 161, en+fr_CA,
  managers dbarnes + throwaway `jmsmgr`, sidebar `informationblockplugin`) — full identity PUT then
  public checks (site index title+summary; `/about` en+fr; `/about/editorialHistory` tail; homepage
  title only — summary correctly absent with the theme option off; OAI Identify name+adminEmail);
  validation 400s (ISSN, URL, email, country empty/`ZZ`, empty primary-locale name, empty contactName)
  vs the row-119 200s (empty acronym, empty supportName — both restored); contact block render incl.
  obfuscated mailto; privacy set→render, clear→404 + registration & submissions references gone;
  information blurb set/clear → per-link then whole-block sidebar behaviour, empty page stays 200;
  permitSettings flip on `jms2`'s manager group (via the roles grid as admin) → jmsmgr page denied +
  PUT 401 (value unchanged) + Settings menu gone, dbarnes likewise locked out of `jms2` but untouched
  on `publicknowledge`. **Residue**: scratch journals `jms1` (id 159 — partial: created by a failed
  scenario POST whose user processor aborted; harmless, isolated) and `jms2` (id 161) remain, plus
  throwaway user `jmsmgr`; `jms2`'s manager group left with `permitSettings=false` (scratch-only).
- **Adversarial verification (2026-07-06, verifier)** — probed on scratch journal `jmv1vrf`
  (`j-jmv1vrf`, id 174, en+fr_CA, dbarnes manager, information sidebar block) against `:8000`
  (`ojs_test`, PostgreSQL); `publicknowledge` read-only throughout. **Refutations attempted → all
  survived**: (1) *Website-page gate identity* — after stripping `permitSettings` from `jmv1vrf`'s
  manager group, BOTH `management/settings/context` AND `management/settings/website` →
  `roleBasedAccessDenied` for the manager, `PUT contexts/{id}` → 401 (value unchanged), while his
  `publicknowledge` settings page stayed 200 (rule 8's "one gate, per-journal" holds on the Website
  page too — both pages share the single `settings` op in `SettingsHandler::__construct()`).
  (2) *Primary-locale sneak-clear* — `PUT {name:{fr_CA:…}}` (no `en` key) → 200 with the English name
  PRESERVED (per-locale settings write, `SchemaDAO::updateObject()`); `{name:{en:null,…}}` → 400
  "You must complete this field in English." — the primary locale cannot be cleared by omission or
  null (rule 2 precision added). (3) *Row 119 re-driven independently + precision*: `{acronym:
  {en:"",fr_CA:""}}` → 200 stored empty; `{supportName:""}` → 200; `{supportEmail:""}` → **200**
  (the third field re-confirmed); `{supportEmail:"not-an-email"}` → **400** "This is not a valid
  email address." (format enforced exactly when present); `isRequired` marks on
  acronym/supportName/supportEmail confirmed in `PKPMastheadForm`/`PKPContactForm`, and the CLIENT
  side requires multilingual fields in the primary locale only (`Form.vue validateRequired()` —
  same shape as the server rule). All cleared values restored. (4) *ISSN checksum calibration* —
  `1234-5678` (well-formed, checksum-wrong) → 400; `1234-5679` (checksum-correct) → 200; `12345678`
  (malformed) → 400: the `issn` rule is regex + real mod-11 check digit (`ValidationServiceProvider`).
  (5) *Pristine defaults on a FRESH journal* — before any save: `/about/privacy` 200 with the stock
  statement, `/information/readers` 200 with the stock blurb, and the sidebar Information block
  PRESENT with all three links (rule 6/7's "new journals start with stock texts" verified from the
  pristine state, not the tests' own writes). (6) *fr-only optional value* — a French-only About
  renders on the fr_CA page AND on the English page via the any-locale fallback
  (`getBestLocalizedData()`; rule 2 precision added). Cookie-less clients see a locale-redirect loop
  on `/fr_CA/*` URLs (session-dependent redirect) — browser clients unaffected. (7) *Public-absence
  spot checks* — abbreviation + publisher set on `jmv1vrf` appear NOWHERE on homepage/`/about`/
  `/about/contact` as text (rule 4's "not rendered by the default reader theme" holds), while a
  publicknowledge article page carries live `citation_issn` + `citation_journal_abbrev` meta tags
  (`citation_publisher` absent when publisher unset) — the indexing-surface claim is real
  (`indexing-meta-tags` seam). (8) *OAI seam* — journal `?verb=Identify` repositoryName/adminEmail =
  journal name/contactEmail; the SITE-level `/index/oai` identifies with the site's title (empty on
  the test site) + site contact email — journal settings play no part (rule 4 note added).
  (9) *Theme option* — `showDescriptionInJournalIndex`, label `manager.setup.contextSummary`
  ("Journal Summary"), `default => false` confirmed in `DefaultThemePlugin`. (10) *Country at
  creation* — wizard-parity `POST contexts` leaves `country` null (half-required note re-verified) —
  and this probe surfaced **NEW ledger row 120**: the creation endpoint enforces NO required props
  at all (nameless journal created via API; `PKPContextService::validate()` passes the action string
  where `ValidatorFactory::required()` expects null-on-add) — owned by `site-administration`,
  referenced under Known deviations; both probe journals (`jmvadm1`/`jmvadm2`, ids 175/176) deleted.
  **Scenario-seeder caveat** (test-infra, not product): scenario-created journals arrive with
  `country:'US'`, placeholder contacts and an EMPTY acronym — a scenario scratch journal is NOT the
  wizard-pristine state; the pristine probes above used the surfaces the seeder doesn't touch.
  **Residue**: `jmv1vrf` (id 174) remains with mutated identity fields and its manager group left
  `permitSettings=false` (scratch-only); `publicknowledge` confirmed untouched (no PUT ever aimed at
  it; its settings page, article page and site-index entry re-read normal). Retained
  `journal-masthead-settings.spec.js` not modified; no finding contradicts it.
