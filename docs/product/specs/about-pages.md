---
name: about-pages
scope: What an anonymous reader sees on a journal's public informational pages — the About-the-journal page, Contact, Submissions guidelines, Privacy statement, the public editorial-masthead and editorial-history rosters, the "About this publishing system" page, the For-Readers/Authors/Librarians information pages, and any custom static pages a manager has published — every page a projection of journal settings, gated only by whether the site is access-restricted, not by who is looking
shared: pkp-lib   # The about pages are rendered by shared lib/pkp handlers (AboutContextHandler, AboutSiteHandler) + shared frontend/pages/*.tpl templates, shared with OMP/OPS. The OJS overlay is thin but real: APP\pages\information\InformationHandler (the OJS Information pages), APP\pages\about\AboutHandler::subscriptions (OJS-only /about/subscriptions override, owned by subscription-access), and the OJS-repo staticPages plugin. Tagged pkp-lib to flag the shared machinery; the OJS-only pieces are called out per rule.
status: verified
e2e-plans: [public-pages, editorial-masthead]
atlas-claims:
  - PAGE-about-index
  - PAGE-about-contact
  - PAGE-about-submissions
  - PAGE-about-privacy
  - PAGE-about-editorialmasthead
  - PAGE-about-editorialhistory
  - PAGE-about-aboutthispublishingsystem
  - PAGE-information-index
  - PAGE-information-readers
  - PAGE-information-authors
  - PAGE-information-librarians
  - PAGE-information-competinginterestguidelines
  - PAGE-information-samplecopyrightwording
  - PLUGIN-generic-staticPages
---

# About & information pages (the public informational reader pages)

## Purpose

Every journal exposes a cluster of **public informational pages** under `/{journalPath}/about/*` and
`/{journalPath}/information/*` — the reader's answer to "what is this journal, who runs it, how do I
contact them, how do I submit, and what will you do with my data." This spec owns **what those pages
render**: the **About the Journal** page (`/about`); the **Contact** page (`/about/contact` — principal
contact + technical/support contact); the **Submissions** guidelines page (`/about/submissions` — author
guidelines, submission-preparation checklist, copyright notice, privacy statement); the **Privacy**
statement page (`/about/privacy`); the public **Editorial Masthead** (`/about/editorialMasthead` — the
current editors grouped by role) and **Editorial History** (`/about/editorialHistory` — past
contributors); the **About this publishing system** page (`/about/aboutThisPublishingSystem` — the OJS
version credit); the **For Readers / For Authors / For Librarians** information pages
(`/information/{readers,authors,librarians}`) plus the competing-interest-guidelines and
sample-copyright-wording pages; and any **custom static pages** a manager has authored through the
**Static Pages** plugin (rendered at an arbitrary `/{path}`). Every one is a **read-only, anonymous**
page whose content is a **journal setting configured elsewhere** — this feature owns the **pages that
display** that content, not the settings themselves.

It does **not** own: the **content** behind these pages (the About text, contact fields, guidelines,
privacy statement, reader/author/librarian info — configured in Settings and owned by
`journal-masthead-settings` / `workflow-settings`); the **masthead configuration** (which role groups
appear and their order — owned by `editorial-masthead`; this spec owns the public **page** that renders
that config); the **sidebar block plugins** that flank these pages (`journal-homepage` owns
`PLUGIN-blocks-*`); the **`/about/subscriptions`** page (owned by `subscription-access`); the
**access-restriction gate** that can hide all of these behind a login wall (owned by
`site-access-restrictions`); and the **journal home page** (`journal-homepage`) or the
**article/issue** reader pages (`article-landing`, `issue-archive-toc`).

## Actors & permissions

Every page here is **fully public and anonymous** — no role gate. The context handlers add only a
**context-required** policy (a journal must be in the URL), and mark the response **publicly cacheable**
*unless* the journal has **restrict site access** turned on, in which case the whole front end sits
behind a login wall owned by `site-access-restrictions` (the seam — this spec does not re-implement that
gate). Two viewer-identity effects are worth naming: a logged-in **manager** viewing any of these pages
sees an inline **Edit** pencil that jumps to the settings form for that content (anonymous readers see
none); and the **Submissions** page's call-to-action changes wording for a logged-in user (see rule 3).
The **Static Pages** *authoring* (create/edit/delete/preview) is **manager-only**; anonymous visitors can
only **read** a published static page. Rows below read *"what any reader sees — and when."* <sup>a</sup>

| Action | Who may — and when |
|--------|--------------------|
| **Open any About / Information page** | • Any visitor, no login — when a journal is in the URL and (if *restrict site access* is on) they are logged in <sup>a</sup> |
| **Open a page at the site level** (no journal in the URL) | • Nobody — the context handlers require a journal; a site-level `/about` is **not found** <sup>b</sup> |
| **See the Privacy page** | • Any visitor — only when a privacy statement is configured (journal, or site when site-wide privacy is on); with none set the page is **not found** <sup>c</sup> |
| **See the inline "Edit" pencil** on a page | • A signed-in **manager/editor** with settings access — jumps to the content's settings form; **anonymous readers never see it** <sup>d</sup> |
| **See a custom static page** at `/{path}` | • Any visitor — only when the **Static Pages plugin is enabled** and a page with that path exists; otherwise the path falls through and is **not found** <sup>e</sup> |
| **Create / edit / delete / preview a static page** | • **Managers & site admins** only, in Website settings; preview is likewise manager/admin only <sup>f</sup> |

<sup>a</sup> `AboutContextHandler::authorize()` / `InformationHandler::authorize()` — `ContextRequiredPolicy` only, no role assignment; `setCacheability(CACHEABILITY_PUBLIC)` skipped when `restrictSiteAccess` is set. Live-verified 2026-07-05 anonymous 200 on `publicknowledge` for `/about`, `/about/contact`, `/about/submissions`, `/about/privacy`, `/about/editorialMasthead`, `/about/editorialHistory`, `/about/aboutThisPublishingSystem`, `/information/{readers,authors,librarians,competingInterestGuidelines,sampleCopyrightWording}`.
<sup>b</sup> `ContextRequiredPolicy` on both handlers — live-verified 2026-07-05: `/en/about` (no journal) → 404.
<sup>c</sup> `AboutSiteHandler::privacy()` — `NotFoundHttpException` when `privacyStatement` empty; `Config general.sitewide_privacy_statement` picks site vs. context statement.
<sup>d</sup> `frontend/components/editLink.tpl` (rendered inside about/contact/submissions/information templates) — only shown to users with the settings link resolved; anonymous render omits it.
<sup>e</sup> `StaticPagesPlugin::callbackHandleContent()` (LoadHandler hook, only registered when `getEnabled()`); `StaticPagesDAO::getByPath()`. Live-verified 2026-07-05: plugin **disabled** on the test journal → a made-up `/about-us-custom-xyz` path → 404.
<sup>f</sup> `StaticPagesHandler::view()` (preview requires `ROLE_ID_MANAGER`/`ROLE_ID_SITE_ADMIN`); `StaticPageGridHandler` (Website settings → Static Pages tab).

## Fields & validation

**Mostly N/A — these are read-only display pages.** They present no reader-facing form and accept no
input; each renders a **journal setting configured elsewhere** (enumerated in *Settings that modify
behavior*). The one authoring surface is the **Static Pages** editor (manager-only), whose fields are:

| Field (UI label) | Required? | Rules | Anchor |
|------------------|-----------|-------|--------|
| Path | Yes | The URL segment the page answers to (`/{path}`); must be unique within the journal | `StaticPageForm` (`path`); `StaticPagesDAO::getByPath()` |
| Title | Yes | Multilingual; shown as the page `<h1>` | `StaticPageForm` (`title`, localized) |
| Content | No | Multilingual rich text (TinyMCE); supports contact-variable substitution (see rule 8) | `StaticPageForm` (`content`, localized); `StaticPagesHandler::view()` `strtr()` |

## Rules & state

Each page is a **projection of settings + published state**; no state is written by viewing one. The
context handlers gather the pieces and hand them to a single Smarty template. All ops below live under
`/{journalPath}/`.

**The About-cluster pages (`/about/*`)**

1. **About the Journal** (`/about`) renders the journal's **About** text under an *"About the Journal"*
   heading — nothing more. When the About setting is empty, the page still renders (heading only).
   *(anchor: `AboutContextHandler::index()` → `frontend/pages/about.tpl` (`$currentContext->getLocalizedData('about')`); live-verified 2026-07-05 — `/about` shows *"About the Journal"*)*
2. **Contact** (`/about/contact`) renders up to three blocks: the **mailing address**, a **Principal
   Contact** block (name, title, affiliation, phone, email) and a **Support/Technical Contact** block
   (name, phone, email) — each block shown only when at least one of its fields is set. Email addresses
   are **JavaScript-obfuscated** (rendered via a `document.write` of an escaped `mailto:`) to resist
   scraping. *(anchor: `AboutContextHandler::contact()` (assigns `contactName/Title/Affiliation/Phone/Email`, `supportName/Phone/Email`, `mailingAddress`) → `frontend/pages/contact.tpl` (`{mailto encode='javascript'}`); live-verified 2026-07-05 — Principal + Support blocks render *"Ramiro Vaca"* with obfuscated email)*
3. **Submissions** (`/about/submissions`) renders a **call-to-action notification** plus, each only when
   its setting is populated, **Author Guidelines**, **Submission Preparation Checklist**, **Copyright
   Notice** and **Privacy Statement**. The notification varies: **anonymous** → *"Login or Register to
   make a submission"*; **logged-in** → new-submission / view-submissions links; and if the journal has
   **no author-submittable section** or **submissions are disabled**, it instead reads *"not currently
   accepting submissions."* The page loads the journal's sections **only to compute that gate** — it
   does **not** list per-section policies. *(anchor: `AboutContextHandler::submissions()` (`submissionChecklist`, `Repo::section()->…->excludeEditorOnly(!$canSubmitAll)`) → `frontend/pages/submissions.tpl` (`$isUserLoggedIn`, `authorGuidelines`, `copyrightNotice`, `privacyStatement`); live-verified 2026-07-05 anonymous — *"Login or Register…"* + *"Author Guidelines"*)*
4. **Privacy** (`/about/privacy`) renders the **privacy statement** — the **context** statement when
   the `sitewide_privacy_statement` config flag is **off** and a journal is in context, otherwise the
   **site** statement (flag on, or no journal context). It does **not** fall back from an empty journal
   statement to the site one — an empty resolved statement is a **404**. **With no statement configured
   the page is not served (404).** *(anchor: `AboutSiteHandler::privacy()`
   (`if (!$enableSiteWidePrivacyStatement && $context)` → context, `else` → site; `NotFoundHttpException`
   when the resolved statement is empty) → `frontend/pages/privacy.tpl`; live-verified 2026-07-05 — 200
   with the seeded statement)*
5. **Editorial Masthead** (`/about/editorialMasthead`) lists the journal's **masthead roles** — the
   user groups flagged as masthead, **excluding reviewers**, in the manager-configured order — and under
   each, the **users flagged for masthead** on their **active** role assignment (full name, service
   start year, affiliation, a verified-ORCID icon). It ends with a link to the Editorial History page and
   then a **Peer Reviewers** section listing external reviewers who **completed a review in the previous
   calendar year**. A role heading appears only if it has at least one masthead user; the reviewers
   section only if there are any. **On the current test seed the whole page renders empty** (heading + history
   link only): the non-reviewer masthead groups exist but have **no users flagged for masthead**, and no
   reviews completed in the prior year. This is a **seed-data state, not a defect** — the per-user masthead
   flag is populatable through the normal UI (see Known deviations + Open question 1). *(anchor:
   `AboutContextHandler::editorialMasthead()` (`getSortedMastheadUserGroups()` → `UserGroup::masthead(true)->excludeRoles([ROLE_ID_REVIEWER])`; `Repo::userGroup()->getMastheadUserIdsByRoleIds()`; `getExternalReviewerIdsByCompletedYear(…, date('Y')-1)`) → `frontend/pages/editorialMasthead.tpl`; live-verified 2026-07-05 — 200, zero role headings, zero reviewers on `publicknowledge`)*
6. **Editorial History** (`/about/editorialHistory`) uses the same role grouping but shows the users
   whose masthead assignments have **ended**, each with their **service date range(s)** — the roster of
   past contributors. *(anchor: `AboutContextHandler::editorialHistory()` (`getMastheadUserIdsByRoleIds(…, STATUS_ENDED)`, `UserUserGroup::withEnded()->withMasthead()`) → `frontend/pages/editorialHistory.tpl`; live-verified 2026-07-05 — 200, *"This section lists past contributors."*)*
7. **About this publishing system** (`/about/aboutThisPublishingSystem`) renders a fixed credit naming
   the running **OJS version** and linking to the Contact page. It reads no journal content. *(anchor:
   `AboutSiteHandler::aboutThisPublishingSystem()` (`VersionDAO::getCurrentVersion()`) → `frontend/pages/aboutThisPublishingSystem.tpl`; live-verified 2026-07-05 — *"…uses Open Journal Systems 3.6.0.0…"*)*

**The Information pages (`/information/*`)**

8. **Each Information op renders one journal text block.** `/information/readers`, `/authors` and
   `/librarians` render the journal's **reader / author / librarian information** text; **
   /competingInterestGuidelines** and **/sampleCopyrightWording** render the competing-interest policy
   and a fixed sample-copyright locale string. Each shows a title `<h1>` and the content; the template
   also supports a **content-only** embed used by the *Information* sidebar block (owned by
   `journal-homepage`, which reuses this same content). **A bare `/information` with no (or an
   unrecognised) sub-page redirects to the journal home page.** *(anchor: `InformationHandler::index()`
   (`switch` on `readers/authors/librarians/competingInterestGuidelines/sampleCopyrightWording`, `default` → `redirect($journal->getPath())`) → `frontend/pages/information.tpl`; live-verified 2026-07-05 — the five ops 200, bare `/information` → 302)*

**Custom static pages (Static Pages plugin)**

9. **The plugin ships disabled; enabling it lets custom pages answer arbitrary paths.** Static Pages is a
   lazy-loaded generic plugin that is **off by default**. Once a manager enables it, it hooks page
   loading: for **any** front-end request whose `page[/op[/args]]` path matches a stored static page, it
   swaps in the static-pages handler and renders the page. *(anchor: `StaticPagesPlugin::register()` (hooks added only under `getEnabled()`), `callbackHandleContent()` (builds the path, `StaticPagesDAO::getByPath()`); live-verified 2026-07-05 — plugin disabled on the test journal, a made-up path → 404)*
10. **A published static page renders its title + content to anyone.** `view()` outputs the page's
    localized title and content through `content.tpl`, first substituting the journal's contact tokens
    (`{$contactName}`, `{$contactEmail}`, `{$supportName}`, `{$supportPhone}`, `{$supportEmail}`) into the
    content — a convenience for "contact us" style pages. A **preview** (an unsaved page, id 0) is
    permitted **only** to a manager/site admin. *(anchor: `StaticPagesHandler::view()` (`strtr($…getLocalizedContent(), $vars)`; manager/admin guard on `!getId()`) → `content.tpl`)*
11. **Authoring is manager-only, in Website settings.** Managers create/edit/delete static pages
    (path + multilingual title + rich-text content) through the **Static Pages** tab the plugin injects
    into Settings → Website; each save writes a `static_pages` row (with `static_page_settings`).
    *(anchor: `StaticPagesPlugin::callbackShowWebsiteSettingsTabs()`, `StaticPageGridHandler`, `StaticPagesSchemaMigration`)*

**Read-only guarantee**

12. **Viewing any of these pages writes nothing.** The only effect is public cacheability (skipped under
    restrict-site-access). No emails, notifications or DB writes result from a read. *(anchor: handler
    `authorize()`/`setupTemplate()` — `setCacheability` only)*

## Side effects

**None on read.** Loading any about/information/static page performs no email, notification, event-log
or DB mutation — the pages set public cacheability and nothing else. The **only** writes in this
feature come from the **manager-only Static Pages CRUD** (rule 11): creating, editing or deleting a
custom page writes/updates/removes a `static_pages` (+ `static_page_settings`) row. No email or
notification is raised by that CRUD either.

## Settings that modify behavior

Every knob below is **configured elsewhere and only read here**; the owning feature is named so the rule
lives in one place.

- **`about`** (journal setting, multilingual) — the About-page body (rule 1). *Owner:
  `journal-masthead-settings`.*
- **`contactName / contactTitle / contactAffiliation / contactPhone / contactEmail`,
  `supportName / supportPhone / supportEmail`, `mailingAddress`** — the Contact-page blocks (rule 2).
  *Owner: `journal-masthead-settings` (contact settings).*
- **`authorGuidelines`, `submissionChecklist`, `copyrightNotice`** — the Submissions-page sections
  (rule 3). *Owner: `workflow-settings` (submission guidance).*
- **`disableSubmissions`** + section availability — flips the Submissions call-to-action to "not
  accepting" (rule 3). *Owner: `workflow-settings` / `sections`.*
- **`privacyStatement`** (context) / site `privacyStatement` + **`general.sitewide_privacy_statement`**
  (config) — the Privacy page and the Submissions-page privacy block (rules 3–4). *Owner:
  `journal-masthead-settings` (context) / `site-settings` (site).*
- **`readerInformation / authorInformation / librarianInformation`, `competingInterestsPolicy`** — the
  Information pages (rule 8). *Owner: `journal-masthead-settings`.*
- **Masthead role selection** (`mastheadUserGroupIds`, per-user-group `masthead` flag) and **per-user
  masthead opt-in** on a role assignment — which roles and which people the masthead/history pages list
  (rules 5–6). *Owner: `editorial-masthead` (role selection) / `user-management`+`roles-permissions`
  (per-user assignment masthead flag).*
- **`restrictSiteAccess`** (journal setting) — when on, drops public cacheability and puts every page
  here behind the login wall (Actors table). *Owner: `site-access-restrictions`.*
- **Static Pages plugin enabled** — gates whether custom-path pages resolve at all (rules 9–11). Ships
  **off**. *Owner: `plugin-management`.*

## Cross-feature interactions

- **editorial-masthead** (Area 5) — owns the masthead **configuration** (`FORM-pkp-appearance-masthead`,
  `API-user-masthead`: which role groups are on the masthead and their order, reviewer-display opt-in).
  **Seam:** this spec owns the public **pages** that render it (`/about/editorialMasthead`,
  `/about/editorialHistory`, rules 5–6); `editorial-masthead` owns the config and keeps
  `editorial-masthead.spec.js` for the config→display mapping.
- **journal-masthead-settings** / **workflow-settings** — own the **content** every page here displays
  (About, contact, guidelines, checklist, copyright, privacy, reader/author/librarian info). This spec
  owns only the display.
- **journal-homepage** — owns the **sidebar block plugins** (`PLUGIN-blocks-{information,developedBy,
  makeSubmission,...}`) that flank these pages, **and** reuses the Information page content in the
  *Information* sidebar block (rule 8's content-only embed). The block atoms stay there; this spec
  **references** them, does not claim them.
- **subscription-access** — owns **`/about/subscriptions`** (`PAGE-about-subscriptions`, the OJS
  `AboutHandler::subscriptions` override) — a subscriptions-info page adjacent to these but **not** part
  of this feature.
- **site-access-restrictions** — owns the `restrictSiteAccess` login wall that can hide all of these
  pages; this spec only notes the cacheability seam.
- **article-landing** / **issue-archive-toc** / **journal-homepage** — the other Area-4 reader pages;
  siblings, no shared rule.

## Canonical scenarios

1. **A reader reads About, Contact and Privacy** — Anonymous visitor opens `/about` (the *"About the
   Journal"* text), `/about/contact` (principal + technical/support contact blocks, emails obfuscated),
   and `/about/privacy` (the privacy statement). All load with no login; if the journal had **no** privacy
   statement the privacy page would 404 instead. *(live-verified 2026-07-05 on `publicknowledge`;
   backed by `public-pages.spec.js` rows 1–4.)*
2. **A reader reads the Submissions guidelines** — Anonymous visitor opens `/about/submissions` and sees
   a *"Login or Register to make a submission"* prompt followed by the **Author Guidelines**,
   **Submission Preparation Checklist**, **Copyright Notice** and **Privacy Statement** sections (each
   present only if configured). A logged-in author instead sees new-submission / view-submissions links;
   a journal not accepting submissions shows a "not accepting" notice. *(live-verified 2026-07-05
   anonymous.)*
3. **A reader opens the public Editorial Masthead** — Anonymous visitor opens `/about/editorialMasthead`.
   On a journal whose editors are flagged for the masthead they see the editors grouped by role (with
   service start years, affiliations, ORCID icons), a link to the Editorial History, and a Peer Reviewers
   list. **On the current seed the page renders empty** (heading + history link only) because no
   non-reviewer users are masthead-flagged and no reviews completed in the prior year — the page is a pure
   projection of the masthead config owned by `editorial-masthead`. *(live-verified 2026-07-05 — empty on
   `publicknowledge`.)*
4. **A reader opens the Information pages** — Anonymous visitor opens `/information/readers`,
   `/information/authors` and `/information/librarians` and reads each info block; the same content also
   appears in the *Information* sidebar block on other pages. A bare `/information` bounces to the journal
   home page. *(live-verified 2026-07-05 — five ops 200, bare `/information` → 302.)*
5. **A manager publishes a custom static page; a reader views it** — With the **Static Pages** plugin
   enabled, a manager creates a page at path `about-us` (title + rich-text content) in Settings → Website
   → Static Pages; an anonymous reader then opens `/{journalPath}/about-us` and sees the rendered page
   (contact tokens substituted). With the plugin **disabled** (the default, and the test-journal state)
   the same path 404s. *(plugin-disabled 404 live-verified 2026-07-05; the enabled create+view path is
   documented from code — not driven live, see Open questions.)*

## Known deviations (as-built ≠ intent)

- **Note — the public Editorial Masthead can render completely empty even for a journal with a full
  editorial team** (rule 5). The page lists a user only if that user is flagged **masthead** on their
  **active** role assignment; the test seed flags the *role groups* as masthead but flags **no
  non-reviewer users**, so the page shows only its heading and the history link. This is an intended
  two-level opt-in (the role is on the masthead; each person opts in per assignment), **not** a code
  defect: no affordance promises a name appears, no data is lost, and the per-user flag **is populatable
  through the normal UI** — the *Edit User* form exposes a per-user-group *"display on masthead"* selection
  (`UserForm` `mastheadUserGroupIds` → `Repo::userGroup()->updateActiveUserUserGroupMasthead()`) and a
  `PUT users/{userId}/masthead/{userUserGroupId}` API (`PKPUserController::masthead()`, with a
  `UserRoleMastheadUpdateNotify` email). Because the masthead is fully populatable, the empty seed is a
  **seed-data state, not a ⚠ deviation** — recorded as a plain rule + Open question 1. Propose a ledger
  row only if the maintainer confirms the empty seed is unintended. *(Verifier 2026-07-05: re-confirmed
  live — `/about/editorialMasthead` 200 with zero role headings + zero reviewers on `publicknowledge`;
  the populate affordance verified in code.)*
- **Note — `/about/editorialTeam` is not a live op** (404). Only `editorialMasthead` exists; there is no
  `editorialTeam` alias in the router. Recorded so that stale links/tests expecting `/about/editorialTeam`
  are known to fail by design, not by regression. (Dead-op candidate — see UNASSIGNED.md.)
- **Note — the Submissions page does not list per-section policies.** The handler loads sections but only
  to decide the "accepting / not accepting" notice (rule 3); the FEATURE-MAP's "section policies" phrasing
  overstates it. Factual scope correction, not a bug.

## Open questions

1. **Is the empty editorial-masthead seed intended?** The masthead role groups on `publicknowledge` are
   flagged masthead, but no non-reviewer users carry the per-assignment masthead flag, so the public page
   is empty. Confirm whether a seeded journal should flag its editors for the masthead (so the public page
   demonstrates a roster), or whether an empty-by-default masthead awaiting per-user opt-in is the intended
   state. The rule (5) is solid as-built; only the intent of the seed is in question. **Verifier
   (2026-07-05): kept as OQ, not ⚠.** The per-user masthead flag is populatable through the normal UI (the
   *Edit User* form's per-user-group masthead selection + the `users/{id}/masthead/{userUserGroupId}` API —
   see Known deviations), so an empty masthead is a *seed-data* state, not an unpopulatable-affordance
   defect. No ledger row unless the maintainer confirms the empty seed is unintended.
2. **Static-page create+view was not driven live.** The plugin is disabled on the read-only test journal
   and enabling it would mutate `publicknowledge` (against live-probe etiquette), so the enabled
   authoring→render path (rules 9–11) is documented from code + the disabled-path 404 only. Confirm the
   round-2 test seeds a scratch journal with the plugin enabled to exercise the full path.

---

<!-- REFERENCE MATERIAL — provenance and campaign bookkeeping, not product-owner narrative. -->

## Reference — entry points & surfaces

| Entry | Path | Atom |
|-------|------|------|
| About the Journal | `GET /{journalPath}/about` → `AboutContextHandler::index()` → `frontend/pages/about.tpl` | PAGE-about-index |
| Contact | `GET /{journalPath}/about/contact` → `AboutContextHandler::contact()` → `contact.tpl` | PAGE-about-contact |
| Submissions guidelines | `GET /{journalPath}/about/submissions` → `AboutContextHandler::submissions()` → `submissions.tpl` | PAGE-about-submissions |
| Privacy statement | `GET /{journalPath}/about/privacy` → `AboutSiteHandler::privacy()` → `privacy.tpl` | PAGE-about-privacy |
| Editorial Masthead (public) | `GET /{journalPath}/about/editorialMasthead` → `AboutContextHandler::editorialMasthead()` → `editorialMasthead.tpl` | PAGE-about-editorialmasthead *(config owned by `editorial-masthead`)* |
| Editorial History (public) | `GET /{journalPath}/about/editorialHistory` → `AboutContextHandler::editorialHistory()` → `editorialHistory.tpl` | PAGE-about-editorialhistory |
| About this publishing system | `GET /{journalPath}/about/aboutThisPublishingSystem` → `AboutSiteHandler::aboutThisPublishingSystem()` → `aboutThisPublishingSystem.tpl` | PAGE-about-aboutthispublishingsystem |
| Information landing (redirect) | `GET /{journalPath}/information` → `InformationHandler::index()` (default → redirect home) | PAGE-information-index |
| For Readers | `GET /{journalPath}/information/readers` → `InformationHandler::readers()` → `information.tpl` | PAGE-information-readers |
| For Authors | `GET /{journalPath}/information/authors` → `InformationHandler::authors()` | PAGE-information-authors |
| For Librarians | `GET /{journalPath}/information/librarians` → `InformationHandler::librarians()` | PAGE-information-librarians |
| Competing-interest guidelines | `GET /{journalPath}/information/competingInterestGuidelines` → `InformationHandler::competingInterestGuidelines()` | PAGE-information-competinginterestguidelines |
| Sample copyright wording | `GET /{journalPath}/information/sampleCopyrightWording` → `InformationHandler::sampleCopyrightWording()` | PAGE-information-samplecopyrightwording |
| Custom static page (reader) | `GET /{journalPath}/{path}` → `StaticPagesPlugin::callbackHandleContent()` → `StaticPagesHandler::view()` → `content.tpl` (only when plugin enabled) | PLUGIN-generic-staticPages |
| Static Pages authoring (manager) | Settings → Website → Static Pages tab → `StaticPageGridHandler` | PLUGIN-generic-staticPages |
| Subscriptions info *(not this feature)* | `GET /{journalPath}/about/subscriptions` → `AboutHandler::subscriptions()` | PAGE-about-subscriptions *(owned by `subscription-access`)* |
| Sidebar blocks *(not this feature)* | `plugins/blocks/*` in the sidebar | PLUGIN-blocks-* *(owned by `journal-homepage`)* |

## Reference — code anchors

- **Routers**: `pages/about/index.php` (OJS: `subscriptions` → `AboutHandler`, else fall to lib/pkp);
  `lib/pkp/pages/about/index.php` (`index/editorialMasthead/editorialHistory/submissions/contact` →
  `AboutContextHandler`; `privacy/aboutThisPublishingSystem` → `AboutSiteHandler`);
  `pages/information/index.php`.
- **Handlers**: `lib/pkp/pages/about/AboutContextHandler.php` (`index()`, `contact()`, `submissions()`,
  `editorialMasthead()`, `editorialHistory()`, `getSortedMastheadUserGroups()`, `authorize()`);
  `lib/pkp/pages/about/AboutSiteHandler.php` (`privacy()`, `aboutThisPublishingSystem()`);
  `pages/information/InformationHandler.php` (`index()` switch + per-op methods, `authorize()`,
  `setupTemplate()`); `pages/about/AboutHandler.php` (OJS `subscriptions()` override — owned by
  `subscription-access`).
- **Templates**: `lib/pkp/templates/frontend/pages/{about,contact,submissions,privacy,
  editorialMasthead,editorialHistory,information}.tpl`; `aboutThisPublishingSystem.tpl` is an **OJS-repo
  override** at `templates/frontend/pages/aboutThisPublishingSystem.tpl` (not lib/pkp);
  `frontend/components/editLink.tpl` (manager edit pencil), `breadcrumbs.tpl`, `header.tpl`/`footer.tpl`.
- **Static Pages plugin**: `plugins/generic/staticPages/StaticPagesPlugin.php` (`register()`,
  `callbackHandleContent()`, `callbackShowWebsiteSettingsTabs()`, `setupGridHandler()`);
  `StaticPagesHandler.php` (`view()` token substitution + preview guard); `classes/StaticPage.php`,
  `classes/StaticPagesDAO.php` (`getByPath()`); `controllers/grid/StaticPageGridHandler.php` +
  `form/StaticPageForm.php`; `StaticPagesSchemaMigration.php` (`static_pages`, `static_page_settings`);
  `templates/{content,staticPagesTab,editStaticPageForm}.tpl`.
- **Masthead data**: `Repo::userGroup()->getMastheadUserIdsByRoleIds()`, `UserGroup::masthead()`,
  `UserUserGroup::withMasthead()/withActive()/withEnded()`,
  `Repo::reviewAssignment()->getExternalReviewerIdsByCompletedYear()`.
</content>
