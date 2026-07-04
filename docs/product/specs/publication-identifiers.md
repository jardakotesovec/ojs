---
name: publication-identifiers
scope: View and edit an article's identifier fields on the workflow Publication tabs — the URN on the Identifiers tab, the URL path and page range on the Issue tab, the article number and publisher-id on the Metadata tab, and the read-only display of the publication's assigned DOI — validating each and honouring the published-lock
shared: pkp-lib          # the Vue PKPPublicationIdentifiersForm, the publication urlPath/pages/articleNumber props + their validation, and the pubIds framework live in lib/pkp (OMP/OPS share them); OJS owns the IssueEntryForm that renders urlPath/pages and ships the URN plugin
status: verified
e2e-plans: [publication-identifiers-license]
atlas-claims:
  - FORM-pkp-publication-identifiers-form
  - API-submission-get-publication-identifier-form
  - PLUGIN-pubIds-urn
  - LOC-submission-publication-urlPath
---

# Publication — Identifiers (DOI / URN / URL path / pages / article number)

## Purpose

Every published article carries a handful of **identifier fields** — a **DOI**, a **URN**, a
**publisher-id**, a custom **URL path** (the slug used in the article's URL instead of its numeric
id), a **page range** ("1–15") and an **article number** (for continuous/article-based journals).
This spec owns those identifier fields as they are experienced on the workflow **Publication**
tabs: what each field is, how it validates, who may edit it and when. In OJS 3.6 the fields are
**spread across three tabs**, not gathered on one — the **Identifiers** tab holds the plugin-driven
public identifiers (**URN** and any custom pub-id plugin), the **Issue** tab holds **URL path** and
**pages**, and the **Metadata** tab holds **article number** and **publisher-id**. The **DOI** is
special: it is a *core* entity managed on the journal-wide **DOIs** management page, and only its
**assigned value** surfaces read-only on the publication (and on the reader's article page). This
spec documents each identifier field and its validation; it does **not** own the DOI configuration,
assignment lifecycle or registration/deposit (that is `doi-management`), nor the Issue/Metadata
**forms** themselves (those are `publication-issue-assignment` / `publication-metadata-references`),
nor the URN **plugin settings** — it references each and owns the field-level identifier rules that
cut across them.

## Actors & permissions

Recurring terms and baselines, stated once: **editorial roles** = journal manager, site admin (who
acts as a manager on any journal they created), and **assigned** section editors (sub-editors) and
assistants. The **published-lock / author-edit gate** (`canEditPublication`) that decides *whether
an edit is still allowed* is defined once in `publication-versioning` and only referenced here:
managers/editors are **warn-not-locked** on a published version (the identifier fields stay editable
behind the yellow "this version is published" banner), an **author-role** user is **hard-locked**
out the moment any version is published/scheduled. Unlike the Galleys manager (which ignores the
lock — see `galleys` rule 9), the Identifiers tab **honours** it: `WorkflowPublicationForm` sets the
form's submit-enabled state to `canEdit` (rule 8). The **DOI assign/clear** affordance is **not** on
any Publication tab at all — it lives on the journal's **DOIs** management page (`doi-management`) —
so it carries that feature's manager-level permissions, referenced here as a pointer. <sup>a</sup>

| Action | Who may — and when |
|--------|--------------------|
| **See the Identifiers tab** (URN + custom pub-ids) | • Editorial roles — **only when a pub-id plugin (URN or a custom pub-id) is enabled for publications**; the tab is absent otherwise, even if DOIs are enabled (rule 1)<br>• Author — **never** (the tab is not added to the author's Publication menu, and the form endpoint is manager/editor-only) <sup>b</sup> |
| **Edit the URN** (Identifiers tab) | • Managers/site admins — any version, warned on a published one<br>• Assigned section editors and assistants<br>• Author — never (no tab) <sup>c</sup> |
| **Edit the URL path / pages** (Issue tab) | • Editorial roles **with production-stage access** — the **Issue** ("Publication settings") tab is editorial-and-production-only, warned on a published version<br>• Author — **never** (the Issue tab is not in the author's Publication menu) (Issue tab / `publication-issue-assignment`) <sup>d</sup> |
| **Edit the article number / publisher-id** (Metadata tab) | • Editorial roles — any version, warned on a published one<br>• Author-role user — **yes**, while nothing is published/scheduled (the Metadata tab **is** in the author's menu); hard-locked once any version is published. The fields render **only when the journal enables them** (rule 6; Metadata tab / `publication-metadata-references`) <sup>e</sup> |
| **Assign / clear the DOI** | • Managers/site admins (and editors per the DOIs page's rules) — on the journal-wide **DOIs** management page, **not** on any Publication tab; ⚠ no assign/clear affordance exists on the publication workflow itself (rule 4). Owned by `doi-management` <sup>f</sup> |
| **View the assigned DOI / URN** (reader) | • Anyone — a published article shows its DOI (as a resolving link) and URN on the reader article page (owned by `article-landing`) <sup>g</sup> |

<sup>a</sup> `useWorkflowPermissions()`/`canEditPublication` (owned by publication-versioning); `WorkflowPublicationForm.vue` (`newPublicationForm.canSubmit = props.canEdit`); DOI assign UI `DoiListPanel` (doi-management) ·
<sup>b</sup> `useWorkflowNavigationConfigOJS.js` `getPublicationItemsEditorial()` (`if (publicationSettings.identifiersEnabled)` pushes the `identifiers` item) vs `getPublicationItemsAuthor()` (no identifiers item); `PKPDashboardHandler` `identifiersEnabled` = any `PluginRegistry::getPlugins('pubIds')` `isObjectTypeEnabled('Publication', ctxId)`; route `submission.publication._components.identifiers` roles Manager|SubEditor|Assistant; live 2026-07-04 (URN off + DOI on → form GET 403 `noEnabledIdentifiers`) ·
<sup>c</sup> `workflowConfigEditorialOJS.js` `identifiers.getPrimaryItems` (`WorkflowPublicationForm formName:'identifier', canEdit: permissions.canEditPublication`); `URNPubIdPlugin::addPublicationFormFields()` ·
<sup>d</sup> `IssueEntryForm::__construct()` (`pages` GROUP_DISPLAY, `urlPath` GROUP_ACCESS); served by `WorkflowHandler.php`; `useWorkflowNavigationConfigOJS.js` — the `issue` nav item (label `publication.publicationSettings`) sits inside `getPublicationItemsEditorial()`'s `if (permissions.canAccessProduction)` block and is **absent** from `getPublicationItemsAuthor()`; publication edit gate `PublicationWritePolicy` → `canEditPublication` ·
<sup>e</sup> `PKPMetadataForm::__construct()` (`articleNumber` if `enabled('articleNumber')`, `pub-id::publisher-id` if `enabled('pub-id::publisher-id')`); `enabled()` from `enableArticleNumber` / `in_array('publication', enablePublisherId)` ·
<sup>f</sup> `DoiListPanel` / `PAGE-dois-index` (doi-management); `publication.doiObject` is read-only on the publication (`maps/Schema.php` summarizes it) ·
<sup>g</sup> `templates/frontend/objects/article_details.tpl` (`$doiObject->getData('resolvingUrl')`; the pub-id plugins' reader display) — owned by `article-landing`

## Fields & validation

The identifier fields do **not** share one form. Below, the **Tab** column names where each field
is actually rendered (and therefore which sibling spec owns that form); this spec owns the
**identifier rule** for each field. Every value is per-publication and **not** multilingual.

| Field (UI label) | Tab | Required? | Rules | Anchor |
|------------------|-----|-----------|-------|--------|
| **URN** | Identifiers | No | Present only when the **URN plugin** is enabled for publications. Two shapes by the plugin's suffix setting: a **generated** field with **Assign URN** / **Clear** buttons that build the URN from a pattern (prefix + `%j.v%vi%i.%a` etc.), or a **manual** text field with an "add check number" button. Validated for **uniqueness** (and, if configured, a check digit) on save | `URNPubIdPlugin::addPublicationFormFields()` (`FieldPubIdUrn` pattern / `FieldTextUrn` manual, `assignIdLabel`/`clearIdLabel`); `validatePublicationUrn()` |
| **DOI** (read-only) | *(none — DOIs page)* | — | **No field on any Publication tab.** The assigned DOI (value + resolving URL) is carried read-only on the publication as `doiObject`; it is **assigned/cleared/deposited on the journal's DOIs page** and shown to readers on the article page. Its format (prefix/suffix pattern) is journal DOI config | `publication.doiObject` (`maps/Schema.php`); assign/format owned by `doi-management` |
| **URL Path** | Issue | No | Optional slug used in the article URL instead of the numeric id. Must be **alphanumeric** with `.`/`-`/`_` separators (`alpha_dash_period`), must **not** be all-digits ("…may not be a number"), and must be **unique across the whole journal's submissions** (not just this publication) — a duplicate or all-digit path is refused on save | `schemas/publication.json` `urlPath` regex; `publication/Repository::validate()` (`ctype_digit`→`urlPath.numberInvalid`; `isDuplicateUrlPath`→`urlPath.duplicate`) |
| **Pages** | Issue | No | Free text — the page range in the printed issue, e.g. "1-15" or "iv-x". No format validation | `IssueEntryForm` (`pages`, FieldText); `schemas/publication-ojs` `pages` (nullable) |
| **Article Number** | Metadata | No | Free text; rendered **only** when the journal enables article numbers (`enableArticleNumber`). No format validation | `PKPMetadataForm` (`articleNumber`, gated `enableArticleNumber`) |
| **Publisher ID** | Metadata | No | Free text publisher-supplied id; rendered **only** when publisher-id is enabled for publications. When set, it is used in the article URL **instead of** the numeric id | `PKPMetadataForm` (`pub-id::publisher-id`, gated `in_array('publication', enablePublisherId)`); base `publication.json` `pub-id::publisher-id` |

Server-set / not user-entered: `doiId` (write-only, set by the DOIs page), `doiObject` (read-only
computed from the linked `dois` row).

## Rules & state

The publication carries the identifier values as ordinary publication settings
(`urlPath`, `pages`, `articleNumber`, `pub-id::publisher-id`, `pub-id::other::urn` in
`publication_settings`) plus a `doiId` foreign key to a `dois` row (the DOI entity, owned by
`doi-management`). <sup>a</sup>

1. **The Identifiers tab exists only when a pub-id *plugin* is enabled — enabling DOIs is not
   enough.** The tab is added to the editorial Publication menu only under
   `publicationSettings.identifiersEnabled`, computed as "**any** registered `pubIds`-category
   plugin reports `isObjectTypeEnabled('Publication', …)`." In default OJS the *only* pub-id plugin
   is **URN** (`plugins/pubIds/urn`; the old DOI pub-id plugin is gone — DOIs are a core entity now).
   So the tab appears when **URN** (or a custom pub-id plugin) is enabled for publications, and is
   **absent** otherwise — *even on a journal with DOIs fully enabled*. The form endpoint enforces the
   same gate: with no pub-id plugin enabled it returns 403 `api.publications.403.noEnabledIdentifiers`.
   **Live-verified 2026-07-04** on publicknowledge (DOIs enabled for publications, URN not enabled):
   `GET …/_components/identifier` → **HTTP 403** "there are no enabled Identifiers"; toggling
   `enablePublicationURN` flipped the same endpoint to **HTTP 200**. <sup>b</sup>
2. **The Identifiers form is an empty shell that pub-id plugins fill.** `PKPPublicationIdentifiersForm`
   declares **no fields of its own** — it is built with just the action/locales/publication/context,
   and each enabled pub-id plugin injects its field through the `Form::config::before` hook (matching
   on `$form->id === 'publicationIdentifiers'`). The **URN plugin** adds the `pub-id::other::urn`
   field; a custom pub-id plugin would add its own. With DOIs core (not a pub-id plugin), **no DOI
   field is injected here** — the tab is purely the plugin identifiers. <sup>c</sup>
3. **The URN field has two shapes, chosen by the plugin's suffix setting.** With a suffix
   **pattern** (or the *default* pattern), the URN renders as a generated field (`FieldPubIdUrn`)
   with **Assign URN** and **Clear** buttons that compose the URN client-side from the configured
   prefix + pattern (journal initials, volume, issue, pages, etc.); with **manual** suffixes it
   renders as a text field (`FieldTextUrn`) plus an "apply check number" button. Either way the value
   saves as `pub-id::other::urn` on the publication PUT, and the plugin validates it for uniqueness
   (and a check digit when configured) via the `Publication::validate` hook. The URN prefix, suffix
   pattern and check-number policy are **plugin settings** (owned by the URN plugin's settings form,
   referenced). <sup>d</sup>
4. **The publication's DOI is display-only here; it is assigned and deposited elsewhere.** In 3.6 the
   DOI is a core entity, not a pub-id plugin, so it has **no field on the publication Identifiers
   tab** and **no assign/clear affordance anywhere in the publication workflow.** The publication
   exposes a **read-only `doiObject`** (the DOI's value + resolving URL, summarised from the linked
   `dois` row) which the reader article page renders as a resolving link. **Assigning, clearing,
   depositing and the DOI status lifecycle** all live on the journal-wide **DOIs** management page
   (`doi-management`); the DOI's **format** (prefix + suffix pattern) is journal DOI configuration
   there. This spec owns only the fact that a publication *carries* a DOI display value; everything
   about creating/registering it is `doi-management`. <sup>e</sup>
5. **URL path and pages live on the Issue tab, not the Identifiers tab.** `IssueEntryForm` (the OJS
   Issue/placement form, tab labelled **"Publication settings"**) renders **URL path** (in its Access
   group) and **pages** (in its Display group) alongside section/issue/date. So a user setting the
   article's URL slug or page range edits them on the **Issue** tab. That tab is **editorial-and-
   production-only** — it sits inside the nav's `canAccessProduction` block and is **not** in the
   author's Publication menu, so authors cannot reach URL path/pages at all (unlike article-number/
   publisher-id, which are on the author-accessible Metadata tab — rule 6). This spec owns the *field
   rules* (validation, uniqueness — rule 7); the Issue **form and tab** are owned by
   `publication-issue-assignment`. <sup>f</sup>
6. **Article number and publisher-id live on the Metadata tab, gated by journal settings.**
   `PKPMetadataForm` adds an **Article Number** field only when `enableArticleNumber` is on, and a
   **Publisher ID** field only when publisher-id is enabled for publications
   (`in_array('publication', enablePublisherId)`). On default publicknowledge both are off
   (`enableArticleNumber = 0`, `enablePublisherId = []`), so neither field shows. The Metadata
   **form and tab** are owned by `publication-metadata-references`; this spec owns the identifier
   meaning of the two fields. <sup>g</sup>
7. **URL path validation: alphanumeric, not-all-digits, journal-unique.** On any publication save
   with a non-empty URL path, the shared publication validator requires it to match the
   `alpha_dash_period` pattern, **rejects an all-digit value** ("…may not be a number", so it can't be
   mistaken for a numeric id), and **rejects a value already used by any publication of any *other*
   submission in the same journal** ("…is already used"). Note the scope: publication URL paths are
   unique **per journal/context**, wider than galley URL paths (unique per publication — `galleys`
   rule 5). Left blank, the article is addressed by its numeric id (or its publisher-id if set).
   <sup>h</sup>
8. **The Identifiers form honours the published-lock (author hard-locked, editors warned).** The
   editorial config passes `canEdit: permissions.canEditPublication` to the Identifiers
   `WorkflowPublicationForm`, and the component wires it straight to the form's submit-enabled state
   (`canSubmit = canEdit`). So on a **published** version an editor can still edit the URN behind the
   warning banner, while an author-role user is hard-locked — and the author never sees the tab at
   all (rule 1, permissions). This is the **opposite** of the Galleys manager, which ignores
   `canEditPublication` (`galleys` rule 9); here the lock is respected. <sup>i</sup>
9. **Identifiers copy forward with a new version.** Creating a new publication version copies the
   publication settings, so URL path / pages / article-number / publisher-id / URN carry to the new
   version (the version-copy scope is owned by `publication-versioning`); the DOI is per-object and
   its versioned-DOI behaviour is owned by `doi-management`. <sup>j</sup>
10. **base-vs-override check — the publication Identifiers form is the base used directly.** The
    publication uses the pkp-lib `PKPPublicationIdentifiersForm` with **no OJS subclass or endpoint
    override** — so none of the "OJS override adds a required marker" surprises (the abstract-required
    lesson) apply here. In contrast, `IssueEntryForm` (which renders URL path/pages) **is** an OJS
    class, and the base publication `Repository::validate()` (URL-path rules) is the pkp-lib version
    used directly by OJS. The galley's **Identifiers** tab is a *different* form — the legacy
    `PKPPublicIdentifiersForm` (`controllers/tab/pubIds`), not this Vue form — see the galley seam
    (rule 11). <sup>k</sup>
11. **Galley-identifier seam.** Galleys carry their own URN / publisher-id (and DOI) on the galley's
    Edit-modal **Identifiers** sub-tab, driven by the **legacy** `PKPPublicIdentifiersForm` and the
    same pub-id plugin framework. `galleys` owns the galley entity and that modal's presence; this
    spec owns the identifier fields/validation the plugins contribute. The galley **DOI** value +
    its `PUT /_dois/galleys/{id}` route are `doi-management`; the galley urlPath (unique per
    publication) is `galleys`. <sup>l</sup>

<sup>a</sup> `publication_settings` (`urlPath`/`pages`/`articleNumber`/`pub-id::publisher-id`/`pub-id::other::urn`); `publications.doi_id` → `dois` (owned by doi-management) ·
<sup>b</sup> `useWorkflowNavigationConfigOJS.js` (`getPublicationItemsEditorial` `identifiersEnabled` push); `PKPDashboardHandler` (`identifiersEnabled` loop over `PluginRegistry::getPlugins('pubIds')` `isObjectTypeEnabled('Publication', …)`); `PKPSubmissionController::getPublicationIdentifierForm()` (same loop → 403 `api.publications.403.noEnabledIdentifiers`); live 2026-07-04 (403 with URN off/DOI on; 200 with `enablePublicationURN` set) ·
<sup>c</sup> `PKPPublicationIdentifiersForm` (no fields; holds publication/submissionContext); `FormComponent::getConfig()` (`Hook::run('Form::config::before', [$this])`); `URNPubIdPlugin::addPublicationFormFields()` (`$form->id === 'publicationIdentifiers'`) ·
<sup>d</sup> `URNPubIdPlugin::addPublicationFormFields()` (`urnSuffix` default/pattern → `FieldPubIdUrn` with `assignIdLabel`/`clearIdLabel`; else `FieldTextUrn`), `validatePublicationUrn()`; `FieldPubId.php` (`assignIdLabel`/`clearIdLabel`/`pattern`/`prefix`) ·
<sup>e</sup> `publication/maps/Schema.php` (`doiObject` → `Repo::doi()->getSchemaMap()->summarize`); `publication.json` `doiId` (writeOnly); assign/deposit/status `doi-management` (`DoiListPanel`, `PAGE-dois-index`, `SCHEMA-doi`, `DB-dois`/`doi_settings`) ·
<sup>f</sup> `IssueEntryForm::__construct()` (`urlPath` GROUP_ACCESS, `pages` GROUP_DISPLAY); `WorkflowHandler.php` (`new IssueEntryForm(...)`); tab owned by `publication-issue-assignment` (`FORM-issue-entry-form`) ·
<sup>g</sup> `PKPMetadataForm::__construct()`/`enabled()` (`articleNumber`/`pub-id::publisher-id`); journal `enableArticleNumber`/`enablePublisherId`; live: publicknowledge `enableArticleNumber=0`, `enablePublisherId=[]` ·
<sup>h</sup> `publication/Repository::validate()` (`urlPath.numberInvalid` on `ctype_digit`; `isDuplicateUrlPath($urlPath, $submissionId, $contextId)` → `urlPath.duplicate`); `schemas/publication.json` `urlPath` regex (`alpha_dash_period`); `LOC-submission-publication-urlPath` ·
<sup>i</sup> `workflowConfigEditorialOJS.js` `identifiers.getPrimaryItems` (`canEdit: permissions.canEditPublication`); `WorkflowPublicationForm.vue` (`newPublicationForm.canSubmit = props.canEdit`); contrast `galleys` rule 9 ·
<sup>j</sup> `publication/Repository::version()` (copies settings); versioned-DOI in `doi-management` ·
<sup>k</sup> `PKPPublicationIdentifiersForm` used directly by `PKPSubmissionController::getPublicationIdentifierForm()` (no OJS override); `IssueEntryForm` is `APP\components\forms\publication`; galley uses `lib/pkp/controllers/tab/pubIds/form/PKPPublicIdentifiersForm.php` (different class) ·
<sup>l</sup> `ArticleGalleyGridHandler::editGalley()`/`identifiers` (legacy `publicIdentifiersForm.tpl`); `galleys` rule 7; `BackendDoiController::editGalley` (`doi-management`)

## Side effects

- **Data:** editing URN / URL path / pages / article-number / publisher-id writes the corresponding
  `publication_settings` rows on the publication PUT. There is **no** identifier-specific event-log
  entry, email or notification; the publication edit that carries them records the shared
  **"Metadata updated"** activity-log entry (owned by `publication-metadata-references`, rule 11
  there).
- **DOI:** assigning/clearing a DOI writes a `dois` row and the publication's `doi_id`, and may queue
  a deposit job — **all owned by `doi-management`**; none of it is triggered from the Publication
  tabs.
- **URN:** assigning a URN is a pure field save (no deposit); the URN plugin's `Publication::validate`
  hook may reject a non-unique or bad-check-digit value.
- **New version:** the identifier settings copy to a new version (`publication-versioning`).

## Settings that modify behavior

- **URN plugin** (Settings → Website → Plugins → URN, then its settings): enabling it **for
  publications** (`enablePublicationURN`) is what makes the **Identifiers tab appear** (rule 1) and
  injects the URN field; its **prefix**, **suffix** (default pattern / custom pattern / manual) and
  **check-number** options decide the URN field's shape and validation (rule 3). Plugin config is
  owned by the URN plugin's settings surface (referenced).
- **DOIs** (Settings → Distribution → DOIs; owned by `doi-management`): `enableDois` +
  `enabledDoiTypes` including `publication` make a publication *eligible* for a DOI and surface its
  read-only display; **they do not create the Identifiers tab** (rule 1) and the assign/deposit UI is
  the DOIs page.
- **Article number** (`enableArticleNumber`) and **publisher-id** (`enablePublisherId` containing
  `publication`) — Settings → Workflow → Metadata: each toggles its field onto the **Metadata** tab
  (rule 6).
- **Nothing** changes the URL-path/pages fields' presence — they are always on the Issue tab.

## Cross-feature interactions

- **doi-management** (feature 69) — owns the DOI **entity** (`SCHEMA-doi`, `DB-dois`,
  `DB-doi_settings`), the journal DOI **config** (prefix/pattern/auto-assign/agency), the **assign /
  clear / deposit / status** lifecycle and the DOIs management page. This spec owns only the
  publication's **read-only DOI display** (`doiObject`) and points to `doi-management` for everything
  else (rule 4).
- **galleys** (feature 26) — owns the galley entity and its Edit-modal **Identifiers** sub-tab
  (legacy `PKPPublicIdentifiersForm`); references this spec for the identifier fields the pub-id
  plugins contribute there, and `doi-management` for the galley DOI (rule 11).
- **publication-issue-assignment** — owns the **Issue** tab / `IssueEntryForm` that physically
  renders **URL path** and **pages**; this spec owns those two fields' identifier rules/validation
  (rules 5, 7).
- **publication-metadata-references** — owns the **Metadata** tab / `PKPMetadataForm` that renders
  **article number** and **publisher-id**; this spec owns their identifier meaning (rule 6).
- **publication-versioning** — owns `canEditPublication` (the published-lock this tab honours,
  rule 8) and the per-version copy of the identifier settings (rule 9).
- **article-landing** — owns the reader article page that displays the assigned DOI (resolving link),
  URN and other pub-ids to the public (permissions row, reader).
- **crossref-deposit / doi-deposit** — own the registration-agency backends the DOIs page drives; not
  reachable from the Publication tabs.

## Canonical scenarios

1. **Edit the URL path and pages** — Editor: opens a submission's Publication → **Issue** tab, sets
   **URL Path** to `on-widgets` and **Pages** to `12-24`, and saves; both persist on the selected
   version and the article's public URL now uses `/on-widgets`. Leaving URL Path blank reverts the
   URL to the numeric id.
2. **URL-path validation boundary** — Editor: entering an **all-digit** URL Path (`2024`) is refused
   ("…may not be a number"), and entering a slug **already used by another submission in the journal**
   is refused ("…is already used"); a valid unique alphanumeric slug saves.
3. **Assign a URN** — With the **URN plugin enabled for publications**, the editor opens the
   **Identifiers** tab (which now exists), clicks **Assign URN** (pattern mode) or types one (manual
   mode) and saves; the URN persists on the publication and is validated for uniqueness. Clearing it
   empties the field.
4. **Identifiers-tab gating** — On a journal with **DOIs enabled but no pub-id plugin**, the
   Publication menu shows **no Identifiers tab** and the identifier-form endpoint returns 403
   (**live-verified 2026-07-04**: publicknowledge, DOIs on / URN off → `GET …/_components/identifier`
   HTTP 403 "no enabled Identifiers"); enabling the URN plugin makes the tab and the URN field appear.
5. **DOI display vs assign seam** — The editor sees the article's **assigned DOI** as a resolving
   link (on the reader page and, when a pub-id plugin surfaces the Identifiers tab, there too) but has
   **no assign/clear button on any Publication tab** — the DOI is assigned/cleared on the journal's
   **DOIs** management page (owned by `doi-management`). A publication with no DOI shows nothing.
6. **Published-lock and author boundary** — On a **published** version a manager can still edit the
   URN / URL path / pages / article-number behind the "this version is published" warning
   (warn-not-locked), while an **author-role** user is hard-locked out of every editable field the
   moment any version is published. Even *before* publication the author's reach is narrower than an
   editor's: the author's Publication menu has **no Identifiers tab and no Issue tab**, so an author
   can never touch the URN or the URL path/pages — only the article-number/publisher-id on the
   author-visible Metadata tab (pre-publication). Contrast: the Galleys manager does **not** honour
   the published-lock (`galleys` rule 9); the Identifiers form does (rule 8).

## Known deviations (as-built ≠ intent)

- **The "Identifiers" tab is gated on a pub-id *plugin*, not on DOIs — so a DOI-only journal has no
  publication-level Identifiers surface.** As-built (rules 1, 4): a journal that enables DOIs but no
  URN/custom pub-id plugin gets **no Identifiers tab**, and the DOI never appears as an editable field
  on any Publication tab — it lives only on the DOIs management page and the reader article view. This
  is **not flagged ⚠** because it is internally consistent and plausibly intended (DOIs were
  deliberately moved to central management in 3.4+, out of the per-publication pub-id framework); it
  is recorded here because it **contradicts the FEATURE-MAP's mental model** ("the identifiers tab:
  DOI/URN/pages/article-number on a publication") and would surprise a PO expecting one gathered tab.
  See Open questions 1.
- No other identifier-specific as-built oddity was found: the URL-path validation, the published-lock
  wiring (rule 8), and the field homes (Issue/Metadata) are all internally consistent.

## Open questions

1. **Is the pub-id-plugin gating of the Identifiers tab intended, and is the field scattering
   (Identifiers = URN only; Issue = URL path/pages; Metadata = article-number/publisher-id;
   DOI = DOIs page) the desired 3.6 information architecture?** As-built confirmed live; the
   FEATURE-MAP describes a single gathered tab that does not exist. (Intent only; does not gate
   verification.)
2. **Atom seam — `LOC-submission-publication-urlPath` and the URL-path/pages field ownership.** This
   spec claims the URL-path locale atom and documents URL path/pages/article-number as identifier
   fields, but the **forms** that render them are owned by `publication-issue-assignment` (Issue) and
   `publication-metadata-references` (Metadata). Confirm at grooming that the field-vs-form split is
   the intended ownership (this spec owns the identifier rule, the sibling owns the tab/form).
3. **DOI display atoms.** `SCHEMA-doi`, `DB-dois`, `DB-doi_settings` are left to `doi-management` (the
   DOI entity owner); this spec references them for the read-only publication display. As of the
   verifier pass their atlas **hint already points to `doi-management`** and their **"Claimed by"
   column is empty** (parked for it, not claimed here) — confirm `doi-management` claims those three
   when it is written.

---

<!-- REFERENCE MATERIAL — provenance and campaign bookkeeping, not product-owner narrative. -->

## Reference — entry points & surfaces

| Entry | Path | Atom |
|-------|------|------|
| Identifiers tab (form fetch) | Workflow → Publication → **Identifiers** (present only when a pub-id plugin is enabled for publications); `GET api/v1/submissions/{id}/publications/{pubId}/_components/identifier` → `PKPPublicationIdentifiersForm` | FORM-pkp-publication-identifiers-form, API-submission-get-publication-identifier-form |
| URN plugin (field + validation + settings) | `plugins/pubIds/urn` — injects `pub-id::other::urn` into the identifiers form; validates on `Publication::validate` | PLUGIN-pubIds-urn |
| URL-path validation messages | `publication.urlPath.*` (description / duplicate / numberInvalid) | LOC-submission-publication-urlPath |
| URL path / pages (render) | Workflow → Publication → **Issue** (`IssueEntryForm`) | *(form owned by publication-issue-assignment — FORM-issue-entry-form)* |
| Article number / publisher-id (render) | Workflow → Publication → **Metadata** (`PKPMetadataForm`, gated) | *(form owned by publication-metadata-references — FORM-pkp-metadata-form)* |
| DOI assign / clear / deposit / status | Dashboard → **DOIs** management page (`DoiListPanel`); `publication.doiObject` read-only on the publication | *(owned by doi-management — SCHEMA-doi, DB-dois, DB-doi_settings)* |
| Reader DOI / URN display | `article/view/{id}` → `article_details.tpl` (resolving link) | *(page owned by article-landing)* |

## Reference — code anchors

- **Publication identifiers form (empty shell)**:
  `lib/pkp/classes/components/forms/publication/PKPPublicationIdentifiersForm.php` (id
  `publicationIdentifiers`, no fields); built + gated by
  `lib/pkp/api/v1/submissions/PKPSubmissionController.php` `getPublicationIdentifierForm()`
  (`PluginRegistry::getPlugins('pubIds')` → `isObjectTypeEnabled('Publication', …)` else 403);
  nav gate `lib/pkp/pages/dashboard/PKPDashboardHandler.php` (`identifiersEnabled`);
  `lib/ui-library/src/pages/workflow/composables/useWorkflowNavigationConfig/useWorkflowNavigationConfigOJS.js`
  (`getPublicationItemsEditorial` identifiers push; author items omit it);
  `.../useWorkflowConfig/workflowConfigEditorialOJS.js` (`identifiers.getPrimaryItems`,
  `canEdit`); `lib/ui-library/src/pages/workflow/components/publication/WorkflowPublicationForm.vue`
  (`canSubmit = canEdit`).
- **URN plugin**: `plugins/pubIds/urn/URNPubIdPlugin.php` (`register()` hooks
  `Form::config::before`→`addPublicationFormFields()`, `Publication::validate`→`validatePublicationUrn()`;
  `isObjectTypeEnabled()` reads `enable{Type}URN`), `classes/form/FieldPubIdUrn.php`,
  `classes/form/FieldTextUrn.php`; base `lib/pkp/classes/components/forms/FieldPubId.php`
  (`assignIdLabel`/`clearIdLabel`/`pattern`/`prefix`).
- **URL path / pages field + validation**: `classes/components/forms/publication/IssueEntryForm.php`
  (`urlPath`/`pages` fields), served by `pages/workflow/WorkflowHandler.php`;
  `lib/pkp/classes/publication/Repository.php` `validate()` (`urlPath.numberInvalid`,
  `isDuplicateUrlPath`→`urlPath.duplicate`), `DAO::isDuplicateUrlPath()`;
  `lib/pkp/schemas/publication.json` (`urlPath` regex, `pub-id::publisher-id`, `doiId`),
  `schemas/publication.json` (`pages`, `articleNumber`).
- **Article number / publisher-id field**:
  `lib/pkp/classes/components/forms/publication/PKPMetadataForm.php` (`articleNumber`,
  `pub-id::publisher-id`, `enabled()` gates).
- **DOI display (referenced; entity owned by doi-management)**:
  `lib/pkp/classes/publication/maps/Schema.php` (`doiObject` summarize);
  `lib/pkp/schemas/doi.json`; `dois` / `doi_settings` (`DoiMigration`).
</content>
</invoke>
