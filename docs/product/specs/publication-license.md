---
name: publication-license
scope: View and edit an article's license, copyright holder and copyright year on the workflow Publication → Permissions & Disclosure tab — the per-publication OVERRIDE of the journal's license/copyright defaults, each field inheriting the journal default until overridden and the default snapshotted onto the publication at publish time
shared: pkp-lib          # the Vue PKPPublicationLicenseForm and the publication licenseUrl/copyrightHolder/copyrightYear props live in lib/pkp (OMP/OPS share them); the publish-time default snapshot is the shared Repository::publish(); the default-value computation (_getContextLicenseFieldValue) is OJS but reads the journal defaults owned by distribution-settings
status: verified
e2e-plans: [publication-identifiers-license]
atlas-claims:
  - FORM-pkp-publication-license-form
  - API-submission-get-publication-license-form
  - LOC-submission-submission-license
---

# Publication — License, copyright holder & copyright year (Permissions & Disclosure)

## Purpose

Every article carries a **license** (a URL, typically a Creative Commons license), a **copyright
holder** and a **copyright year**. A journal sets *defaults* for all three in its Distribution
settings; this feature is the **per-publication override** of those defaults, edited on the
workflow **Publication → Permissions & Disclosure** tab. Each of the three fields sits **empty by
default and inherits the journal default** — the form shows the computed default in the field's
description and an **"Override"** button; only when a user overrides does the publication carry its
own value. If a field is still empty when the article is **published**, OJS **snapshots the journal
default onto the publication** at that moment, freezing the value the reader sees. This spec owns
those three fields on the publication (their form, validation, inheritance/override and the
published-lock); it does **not** own the journal license/copyright **defaults** or the CC-license
picker (that is `distribution-settings`), nor the intake copyright-consent checkbox
(`submission-wizard`), nor the reader-facing license display (`article-landing`).

## Actors & permissions

Recurring terms and baselines, stated once: **editorial roles** = journal manager, site admin (who
acts as a manager on any journal they created), and **assigned** section editors (sub-editors) and
assistants. The **published-lock / author-edit gate** (`canEditPublication`) that decides *whether
an edit is still allowed* is defined once in `publication-versioning` and only referenced here:
managers/editors are **warn-not-locked** on a published version (the license fields stay editable
behind the yellow "this version is published" banner), an **author-role** user is **hard-locked**
the moment any version is published/scheduled. Like the Identifiers tab (and unlike the Galleys
manager — `galleys` rule 9), the license form **honours** the lock (rule 10). The tab is
**production-gated**: it is added to the editorial Publication menu only inside the nav's
`canAccessProduction` block (alongside Galleys, Media and the Issue tab), and is **absent from the
author's Publication menu entirely** (rule 1). <sup>a</sup>

| Action | Who may — and when |
|--------|--------------------|
| **See the Permissions & Disclosure tab** | • Editorial roles **with production-stage access** — the tab sits in the nav's production block; managers always, assigned section editors/assistants when they can access production, warned on a published version<br>• Author — **never** (the tab is not in the author's Publication menu; the form endpoint is manager/editor/assistant-only — a hand-crafted author request is refused, **live 401**) <sup>b</sup> |
| **Edit the license URL / copyright holder / copyright year** | • Managers/site admins — any version, warned on a published one<br>• Assigned section editors and assistants — with production access, warned on a published one<br>• Author — **never** (no tab, endpoint refused) <sup>c</sup> |
| **View the license / copyright** (reader) | • Anyone — a published article shows its license (as a CC badge/link) and copyright statement on the reader article page (owned by `article-landing`) <sup>d</sup> |

<sup>a</sup> `useWorkflowPermissions()`/`canEditPublication`, `canAccessProduction` (owned by publication-versioning / workflow-stage-navigation); `WorkflowPublicationForm.vue` (`newPublicationForm.canSubmit = props.canEdit`) ·
<sup>b</sup> `useWorkflowNavigationConfigOJS.js` `getPublicationItemsEditorial()` pushes the `license` item inside `if (permissions.canAccessProduction)`; `getPublicationItemsAuthor()` has **no** license item; route `submission.publication._components.permissionDisclosure` roles Manager|SubEditor|Assistant; **live 2026-07-04** — editor `GET …/_components/permissionDisclosure` → **200**, author (atester) → **401** and the author Publication menu omits "Permissions & Disclosure" ·
<sup>c</sup> `workflowConfigEditorialOJS.js` `license.getPrimaryItems` (`WorkflowPublicationForm formName:'permissionDisclosure', canEdit: permissions.canEditPublication`); `PKPSubmissionController` route group roles Manager|SubEditor|Assistant ·
<sup>d</sup> `templates/frontend/objects/article_details.tpl` (license badge + `submission.copyrightStatement`) — owned by `article-landing`

## Fields & validation

All three fields are per-publication and edited on the **Permissions & Disclosure** tab. Each is
**optional**; left empty it **inherits the journal default** (rules 3–7). The **"Override"** button
is the opt-in-to-edit affordance: while the field is empty **and a default exists**, the input is
shown **disabled** with the computed default in its description and an **Override** button that, when
clicked, enables the input so the user can enter a per-publication value.

| Field (UI label) | Required? | Rules | Anchor |
|------------------|-----------|-------|--------|
| **Copyright Holder** | No | **Multilingual** free text. Disabled with an **Override** button while empty; the description shows the journal default (e.g. "Copyright will be assigned automatically to *Journal of Public Knowledge* when this is published"). Overriding lets the user type a per-locale statement. No format validation | `PKPPublicationLicenseForm` (`copyrightHolder`, `isMultilingual`, `optIntoEdit = !copyrightHolder`); `schemas/publication.json` `copyrightHolder` (multilingual, nullable) |
| **Copyright Year** | No | Free **integer** year. Disabled with an **Override** button while empty; the description depends on the journal's copyright-year basis ("…set automatically when this is published **in an issue**" vs "…**as you publish**"). No range validation | `PKPPublicationLicenseForm` (`copyrightYear`, `optIntoEdit = !copyrightYear`, description from `copyrightYearBasis`); `schemas/publication.json` `copyrightYear` (integer, nullable) |
| **License URL** | No | A URL to the license terms (typically a CC URL). Validated as a **well-formed URL** on save. The **Override** button appears **only when the journal has a default license set** (`context.licenseUrl` non-empty **and** the publication has none); with **no** journal default the field is a plain **directly-editable** text input (no Override) — **live-confirmed** on publicknowledge (no default license → editable, no toggle) | `PKPPublicationLicenseForm` (`licenseUrl`, `optIntoEdit = context.licenseUrl && !publication.licenseUrl`); `schemas/publication.json` `licenseUrl` (nullable, **url**) |

Server-computed, not stored on the field: the **default** copyright holder / year / license the
description advertises — derived from the journal settings each time the form loads (rules 4–6) and
written onto the publication only at publish (rule 7).

## Rules & state

The publication carries the three values as ordinary publication settings
(`licenseUrl`, `copyrightHolder`, `copyrightYear` in `publication_settings`); `copyrightHolder` is
multilingual (per-locale rows), the other two are single-value. <sup>a</sup>

1. **Permissions & Disclosure is a default production-stage Publication tab — no plugin or setting
   gates it.** The nav adds the **license** item (label `publication.publicationLicense` =
   **"Permissions & Disclosure"**) to the editorial Publication menu inside the
   `permissions.canAccessProduction` block, so it appears for editorial roles with production access
   and sits after Galleys/Media, before the Issue tab. Unlike the **Identifiers** tab (gated on a
   pub-id plugin — `publication-identifiers` rule 1), the license tab is **always present** for a
   production-capable editor. The form endpoint enforces only a **role** gate (Manager|SubEditor|
   Assistant), no feature gate. **Live-verified 2026-07-04** on publicknowledge: editor
   `GET …/publications/1/_components/permissionDisclosure` → **HTTP 200** (form id
   `publicationLicense`, method `PUT`), and the tab renders in the Publication menu. <sup>b</sup>
2. **The form is a fixed three-field preset — the pkp-lib base used directly.** `PKPPublicationLicenseForm`
   declares exactly `copyrightHolder`, `copyrightYear`, `licenseUrl` (in that order) and nothing
   plugin-injected. There is **no OJS subclass** of the form and **no OJS override** of the
   controller method `getPublicationLicenseForm()` — the base pkp-lib form and endpoint are used as
   is (base-vs-override check: clean; contrast the **context** license form, which *is* OJS-
   overridden — rule 12). <sup>c</sup>
3. **Empty = inherit the journal default; "Override" opts into a per-publication value.** Each field
   is built with `optIntoEdit` true while the publication has no explicit value, rendering the input
   **disabled** with the computed default in the description and an **"Override"** button
   (`optIntoEditLabel = common.override` = "Override") that enables editing. So the reset-to-default
   state and the override state are the same control: a field left/blanked empty inherits; a field
   overridden carries its own value. There is **no separate "reset" button** — clearing an overridden
   value returns the field to the inherit state. <sup>d</sup>
4. **Default copyright holder is computed from the journal's copyright-holder type.** When the field
   is empty the description (and the value snapshotted at publish) is: the **article's author string**
   if the journal's `copyrightHolderType` is `author`; the **journal name** if it is `context` or
   unset; the journal's **custom copyright statement** (`copyrightHolderOther`, multilingual) for any
   other value. Live: publicknowledge (`copyrightHolderType` unset) → "…assigned automatically to
   *Journal of Public Knowledge*". These journal settings are owned by `distribution-settings`. <sup>e</sup>
5. **Default copyright year is computed from the journal's copyright-year basis.** Empty → the year
   is the **year of the assigned issue's `datePublished` timestamp** if the journal's
   `copyrightYearBasis` is `issue` (default on publicknowledge), the **publication's own** publish
   year if it is `submission` ("published as you go"), else the **current year**. **Nuance — timestamp,
   not label:** the issue basis reads the issue's `datePublished` *timestamp*, **not** its
   volume/number/**year label**; the two usually agree in production but can diverge. **Live-verified
   2026-07-04**: an un-overridden article published into publicknowledge's *"Vol 1 No 2 (2014)"* issue
   snapshotted `copyrightYear = 2026` — because the test seed's `IssueProcessor` stamps a published
   issue's `datePublished` with the current date (`Core::getCurrentDate()`), so on the seed the
   inherited year is the **current** year, not the 2014 label. The label→timestamp divergence is a
   seed artifact; the durable product rule is "reads `datePublished`, not the label." Live description:
   publicknowledge (`issue`) → "…set automatically when this is published in an issue." Owned-setting:
   `distribution-settings`. <sup>f</sup>
6. **Default license URL is the journal's default license — and the Override toggle only shows when
   one exists.** Empty → the publication inherits `context.licenseUrl` (the journal's CC choice).
   The **Override** affordance is added only when the journal *has* a default license
   (`context.licenseUrl` set) and the publication does not; with **no** journal default the licenseUrl
   field is a plain editable input. **Live-confirmed**: publicknowledge has no default license, so
   the field showed **no Override button** and was directly editable, while Copyright Holder/Year
   (which always have a computed default) showed Override. <sup>g</sup>
7. **The journal defaults are snapshotted onto the publication at publish.** In `Repository::publish()`,
   for each of `copyrightHolder` / `copyrightYear` / `licenseUrl` that is **still empty** at the
   moment the version becomes **published**, OJS writes the computed journal default
   (`_getContextLicenseFieldValue`, rules 4–6) onto the publication. So an un-overridden field is
   *frozen to the default in force at publish time* — later changing the journal default does **not**
   retroactively change already-published articles. An **overridden** field is left untouched.
   **Live-verified 2026-07-04**: an un-overridden article published on publicknowledge froze
   `copyrightHolder` = the journal name per locale (`en` + `fr_CA`), `copyrightYear` = the issue's
   `datePublished` year, and `licenseUrl` = empty (publicknowledge has no default license) — all read
   back off the published publication. <sup>h</sup>
8. **License URL must be a well-formed URL.** On save, a non-empty `licenseUrl` is validated by the
   publication schema's **`url`** rule; a malformed value is refused. Copyright holder (free text) and
   copyright year (integer) have no format validation beyond type. <sup>i</sup>
9. **Only the copyright holder is multilingual.** `copyrightHolder` is stored per submission-supported
   locale (the field shows the multilingual globe/override affordance); `copyrightYear` (integer) and
   `licenseUrl` are single-value. When the default copyright holder is the journal name or custom
   statement it is per-locale; when it is the author string it is stored under the primary locale. <sup>j</sup>
10. **The form honours the published-lock (author hard-locked, editors warned).** The editorial config
    passes `canEdit: permissions.canEditPublication` to the license `WorkflowPublicationForm`, which
    wires it straight to the form's submit-enabled state (`canSubmit = canEdit`). On a **published**
    version an editor can still edit the license behind the warning banner; an author-role user is
    hard-locked — and never sees the tab at all (rule 1). This is the **same** wiring the Identifiers
    tab uses (`publication-identifiers` rule 8) and the **opposite** of the Galleys manager, which
    ignores the lock (`galleys` rule 9). <sup>k</sup>
11. **License/copyright copy forward with a new version.** Creating a new publication version copies
    the publication settings, so an overridden license/copyright carries to the new version; an
    un-overridden (inheriting) field stays empty on the new version and re-inherits at that version's
    publish (the version-copy scope is owned by `publication-versioning`). <sup>l</sup>
12. **base-vs-override seam with the journal-default form.** The *publication* form (this spec) is the
    unmodified pkp-lib `PKPPublicationLicenseForm` (rule 2). The *journal-default* license form is a
    different surface: pkp-lib `PKPLicenseForm` (id `license`) — the **CC-license picker**
    (`Application::getCCLicenseOptions()`), the **copyright-holder type** radio (author/journal/other +
    `copyrightHolderOther`) and the **license terms** rich text — **is** OJS-overridden by
    `LicenseForm`, which appends the **copyright-year basis** option (issue/submission). Those forms
    and settings are owned by `distribution-settings`; this spec references them as the source of the
    defaults its Override fields inherit (rules 4–6). <sup>m</sup>

<sup>a</sup> `publication_settings` (`licenseUrl`/`copyrightHolder`/`copyrightYear`) ·
<sup>b</sup> `useWorkflowNavigationConfigOJS.js` `getPublicationItemsEditorial()` (`license` push inside `canAccessProduction`, label `publication.publicationLicense`); `PKPSubmissionController` route `permissionDisclosure` (Manager|SubEditor|Assistant); live 2026-07-04 (editor GET 200) ·
<sup>c</sup> `PKPPublicationLicenseForm::__construct()` (three `FieldText`s; no OJS subclass found); `PKPSubmissionController::getPublicationLicenseForm()` (`new PKPPublicationLicenseForm(...)`, no OJS override) ·
<sup>d</sup> `PKPPublicationLicenseForm` (`optIntoEdit`, `optIntoEditLabel = __('common.override')`); `FieldText.vue` (`v-if="optIntoEdit && isDisabled"` button → `isDisabled = false`) ·
<sup>e</sup> `Submission::_getContextLicenseFieldValue(PERMISSIONS_FIELD_COPYRIGHT_HOLDER)` (`copyrightHolderType`: `author`→`getAuthorString()`, `context`/null→`getName()`, else→`copyrightHolderOther`); `PKPPublicationLicenseForm` copyright description; live: `copyrightHolderType` unset → journal name ·
<sup>f</sup> `Submission::_getContextLicenseFieldValue(PERMISSIONS_FIELD_COPYRIGHT_YEAR)` (`copyrightYearBasis`: `issue`→issue `datePublished` year, `submission`→publication `datePublished` year, default `date('Y')`); form description `publication.copyrightYearBasis.{issue,submission}Description` ·
<sup>g</sup> `PKPPublicationLicenseForm` licenseUrl `optIntoEdit = context.licenseUrl && !publication.licenseUrl`; `Submission::_getContextLicenseFieldValue(PERMISSIONS_FIELD_LICENSE_URL)` = `context.licenseUrl`; live 2026-07-04 (no journal default → licenseUrl editable, no Override) ·
<sup>h</sup> `publication/Repository::publish()` (`if ($itsPublished && !$newPublication->getData(...))` → `setData($field, $submission->_getContextLicenseFieldValue(null, PERMISSIONS_FIELD_..., $newPublication))` for holder/year/url) ·
<sup>i</sup> `schemas/publication.json` `licenseUrl` (`["nullable","url"]`), `copyrightYear` (integer nullable), `copyrightHolder` (nullable) ·
<sup>j</sup> `schemas/publication.json` `copyrightHolder` (`multilingual: true`); author-string default keyed to `getPrimaryLocale()` in `_getContextLicenseFieldValue` ·
<sup>k</sup> `workflowConfigEditorialOJS.js` `license.getPrimaryItems` (`canEdit: permissions.canEditPublication`); `WorkflowPublicationForm.vue` (`newPublicationForm.canSubmit = props.canEdit`); contrast `galleys` rule 9, parallel `publication-identifiers` rule 8 ·
<sup>l</sup> `publication/Repository::version()` (copies settings); scope owned by `publication-versioning` ·
<sup>m</sup> `PKPLicenseForm` (id `license`; `copyrightHolderType`/`copyrightHolderOther`/`licenseUrl` radio/`licenseTerms`); OJS `LicenseForm` adds `copyrightYearBasis`; `Application::getCCLicenseOptions()`; owned by `distribution-settings`

## Side effects

- **Data:** editing the three fields writes the corresponding `publication_settings` rows on the
  publication `PUT`. There is **no** license-specific event-log entry, email or notification; the
  publication edit that carries them records the shared **"Metadata updated"** activity-log entry
  (owned by `publication-metadata-references`).
- **At publish:** `Repository::publish()` may write the computed journal defaults onto any still-empty
  license/copyright field (rule 7) — a one-time snapshot, not an ongoing link to the journal setting.
- **New version:** overridden values copy to a new version; inheriting fields stay empty
  (`publication-versioning`).

## Settings that modify behavior

All are **journal defaults owned by `distribution-settings`** (Settings → Distribution → License);
they set what an un-overridden field inherits and the descriptions the Override fields show:

- **Default license URL** (`licenseUrl`, chosen from the CC-license picker or a custom URL) — the
  license the publication inherits, and the trigger for the licenseUrl **Override** toggle (rule 6).
- **Copyright holder type** (`copyrightHolderType` = author / journal / other, with
  `copyrightHolderOther` when "other") — decides the default copyright holder (rule 4).
- **Copyright year basis** (`copyrightYearBasis` = issue / submission) — decides the default copyright
  year (rule 5).
- **License terms** (`licenseTerms`, rich text) — journal-level license terms; not a per-publication
  field, referenced by the reader display (`article-landing`).

## Cross-feature interactions

- **distribution-settings** (feature 59, not yet written) — owns the **journal license/copyright
  defaults** and the **CC-license picker** (`PKPLicenseForm` / OJS `LicenseForm`,
  `Application::getCCLicenseOptions()`): default `licenseUrl`, `copyrightHolderType` /
  `copyrightHolderOther`, `copyrightYearBasis`, `licenseTerms`. This spec owns only the
  **per-publication override** of `licenseUrl` / `copyrightHolder` / `copyrightYear` and points there
  for how each default is configured and computed (rules 4–7, 12).
- **publication-identifiers** — the split sibling (same former `publication-identifiers-license`
  feature). Shares the Publication-tab pattern, the `WorkflowPublicationForm`/`canEdit` wiring and the
  published-lock contrast; owns the Identifiers/Issue/Metadata identifier fields.
- **publication-versioning** — owns `canEditPublication` (the published-lock this tab honours, rule 10)
  and the per-version copy of the license/copyright settings (rule 11).
- **article-landing** — owns the reader article page that displays the license (CC badge/link) and the
  copyright statement (`submission.copyrightStatement`) to the public (permissions row, reader).
- **submission-wizard** — owns the intake **copyright-notice consent** checkbox
  (`submission.copyright.agree`); that is a separate agree-to-terms step, **not** the per-publication
  license override documented here.
- **Publication-tab siblings** (`publication-title-abstract-body`, `contributors`,
  `publication-metadata-references`, `galleys`) — parallel tabs on the same Publication menu; each
  honours the published-lock except Galleys.

## Canonical scenarios

1. **Override the license URL** — Editor: opens a submission's Publication → **Permissions &
   Disclosure** tab and enters a Creative Commons URL (e.g. `https://creativecommons.org/licenses/by/4.0/`)
   in **License URL**, then saves; the publication now carries that license instead of inheriting the
   journal default, and the reader article page shows it. On a journal that has a default license the
   field starts behind an **Override** button; on publicknowledge (no default) it is directly
   editable.
2. **License URL validation boundary** — Editor: entering a **malformed** License URL (e.g. `not a url`)
   is refused on save (must be a well-formed URL); a valid URL saves. Copyright Year accepts a plain
   integer; Copyright Holder accepts free text.
3. **Override the copyright holder (multilingual)** — Editor: clicks **Override** on **Copyright
   Holder**, enters a statement in English and a different one in French (`fr_CA`), and saves; both
   per-locale values persist and the reader sees the locale-appropriate copyright statement. Leaving it
   empty instead inherits the journal default shown in the description.
4. **Inherit the journal defaults at publish** — Editor: leaves all three fields empty (inheriting),
   assigns the article to an issue and **publishes**; OJS snapshots the journal defaults onto the
   publication — copyright holder = the journal name (or author, per the journal setting), copyright
   year = the year of the issue's **`datePublished`** (per `copyrightYearBasis` — see rule 5's
   timestamp-not-label nuance), license = the journal default license. Changing
   the journal default afterwards does **not** alter this already-published article.
5. **Copyright-year basis drives the default** — Editor/manager: with the journal set to
   **issue-based** copyright years the field description reads "…set automatically when this is
   published in an issue" and an un-overridden year snapshots the **issue's** year; switching the
   journal to **submission-based** (in Distribution settings) makes it snapshot the **publication's own**
   publish year instead. (The setting itself is `distribution-settings`.)
6. **Published-lock and author boundary** — On a **published** version a manager can still edit the
   license/copyright behind the "this version is published" warning (warn-not-locked), while an
   **author**-role user is hard-locked. Even before publication the author's reach is narrower: the
   author's Publication menu has **no Permissions & Disclosure tab** at all, and a hand-crafted author
   request to the license-form endpoint is refused (**live-verified 2026-07-04**: atester → the tab is
   absent and `GET …/_components/permissionDisclosure` → **HTTP 401**). Contrast: the Galleys manager
   does **not** honour the lock (`galleys` rule 9); the license form does (rule 10).

## Known deviations (as-built ≠ intent)

- **Author form-endpoint returns 401, not 403.** A hand-crafted author request to
  `GET …/_components/permissionDisclosure` is rejected with **HTTP 401** (Unauthorized) rather than
  403 (Forbidden) — **live-verified 2026-07-04** (atester → 401, body
  `user.authorization.roleBasedAccessDenied` from `RoleBasedHandlerOperationPolicy`; the route's
  `roleAuthorizer(Manager|SubEditor|Assistant)` middleware would equally answer 401). This is the
  **campaign-wide authenticated-but-unauthorized-role → 401 baseline** (FEATURE-MAP Part C / AUTHZ
  baseline), **not** a license-specific defect — noted once here, not flagged ⚠. The UI reality is
  unaffected: the author never sees the tab, so the endpoint is unreachable through the interface.
- No license-specific as-built oddity was found: the Override/inherit mechanism, the publish-time
  snapshot, the URL validation and the published-lock wiring are all internally consistent. The
  "no explicit reset button — clear the field to re-inherit" behaviour (rule 3) is the intended
  `optIntoEdit` UX, not a deviation.

## Open questions

1. **Atom seam — `LOC-submission-submission-license` is shared copy.** This spec claims the
   `submission.license.*` locale prefix (19 keys), but **18 of them are CC-license *name/footer*
   labels** (`submission.license.cc.by4`, …) used by the **journal CC picker** (`distribution-settings`,
   via `Application::getCCLicenseOptions()`) and the **reader license badge** (`article-landing`); only
   `submission.license.description` is primarily this form's. Confirm at grooming whether this atom
   should sit with `distribution-settings` (the CC-picker owner) instead, with this spec merely
   referencing it — the same field-vs-copy split flagged for `publication-identifiers`
   (`LOC-submission-publication-urlPath`). (Bookkeeping only; does not gate verification.)
2. **`copyrightYearBasis` unset edge.** `_getContextLicenseFieldValue` has `default: assert(false)`
   in the copyright-year switch, so a journal with **no** `copyrightYearBasis` set would hit the
   assertion; with assertions disabled in production it falls through to the current year (`date('Y')`).
   publicknowledge ships `issue`, so this is only reachable on a mis-seeded journal. Is the unset case
   meant to be prevented at the settings form, or silently defaulted? (Intent only.)
3. **Production-gating of the tab.** The Permissions & Disclosure tab requires **production-stage
   access** (nav `canAccessProduction` block), so an editorial user without production access does not
   see it — unlike title/abstract/metadata (always shown to editors). Is placing license editing behind
   production access the intended information architecture? (Intent only; as-built confirmed.)

---

<!-- REFERENCE MATERIAL — provenance and campaign bookkeeping, not product-owner narrative. -->

## Reference — entry points & surfaces

| Entry | Path | Atom |
|-------|------|------|
| Permissions & Disclosure tab (form fetch) | Workflow → Publication → **Permissions & Disclosure** (production-capable editors); `GET api/v1/submissions/{id}/publications/{pubId}/_components/permissionDisclosure` → `PKPPublicationLicenseForm` (id `publicationLicense`) | FORM-pkp-publication-license-form, API-submission-get-publication-license-form |
| License/copyright field copy | `submission.license.*` (description + CC-license names/footers), `submission.copyrightHolder(.description)`, `submission.copyrightYear`, `submission.licenseURL`, `common.override` | LOC-submission-submission-license |
| Save (persist the three fields) | `PUT api/v1/submissions/{id}/publications/{pubId}` (shared publication edit) | *(publication edit endpoint — API-submission-edit-publication, co-used by every Publication tab)* |
| Journal license/copyright defaults + CC picker | Settings → **Distribution → License** (`PKPLicenseForm` / OJS `LicenseForm`) | *(owned by distribution-settings — FORM-pkp-license-form, FORM-license-form)* |
| Reader license / copyright display | `article/view/{id}` → `article_details.tpl` (CC badge, copyright statement) | *(page owned by article-landing)* |

## Reference — code anchors

- **Publication license form (three-field preset)**:
  `lib/pkp/classes/components/forms/publication/PKPPublicationLicenseForm.php`
  (id `publicationLicense`; `copyrightHolder` multilingual, `copyrightYear`, `licenseUrl`; each with
  `optIntoEdit`/`optIntoEditLabel = common.override`; descriptions from `copyrightHolderType` /
  `copyrightYearBasis` / `licenseUrl`); built by
  `lib/pkp/api/v1/submissions/PKPSubmissionController.php` `getPublicationLicenseForm()` (route
  `permissionDisclosure`, roles Manager|SubEditor|Assistant — **no** OJS override);
  nav `lib/ui-library/src/pages/workflow/composables/useWorkflowNavigationConfig/useWorkflowNavigationConfigOJS.js`
  (`getPublicationItemsEditorial` `license` push inside `canAccessProduction`; author items omit it);
  `.../useWorkflowConfig/workflowConfigEditorialOJS.js` (`license.getPrimaryItems`, `canEdit`);
  `lib/ui-library/src/pages/workflow/components/publication/WorkflowPublicationForm.vue`
  (`canSubmit = canEdit`); `lib/ui-library/src/components/Form/fields/FieldText.vue` (`optIntoEdit`
  disabled-input + Override button).
- **Default computation + publish-time snapshot**:
  `classes/submission/Submission.php` `_getContextLicenseFieldValue()` (OJS impl of the
  `PKPSubmission` abstract; `PERMISSIONS_FIELD_{LICENSE_URL,COPYRIGHT_HOLDER,COPYRIGHT_YEAR}`);
  `lib/pkp/classes/publication/Repository.php` `publish()` (snapshots each empty field onto the
  published publication).
- **Schema / validation**: `lib/pkp/schemas/publication.json` (`licenseUrl` `["nullable","url"]`,
  `copyrightHolder` multilingual nullable, `copyrightYear` integer nullable).
- **Journal-default forms (referenced; owned by distribution-settings)**:
  `lib/pkp/classes/components/forms/context/PKPLicenseForm.php` (id `license`; `copyrightHolderType`,
  `copyrightHolderOther`, `licenseUrl` CC picker, `licenseTerms`); `classes/components/forms/context/LicenseForm.php`
  (OJS override, adds `copyrightYearBasis`); `lib/pkp/classes/core/PKPApplication.php`
  `getCCLicenseOptions()`.
