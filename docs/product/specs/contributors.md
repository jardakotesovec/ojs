---
name: contributors
scope: Manage a publication's contributors (authors) — add/edit/delete each contributor, order them, designate the primary (corresponding) contact, record affiliations, contributor roles and NISO CRediT roles — on the workflow Publication → Contributors tab and, reused, in the submission wizard's Contributors step
shared: pkp-lib
status: verified
e2e-plans: [contributors]
atlas-claims:
  - VUE-contributor-manager
  - VUE-contributors-list-panel
  - VUE-contributor-role-manager
  - FORM-contributor-form
  - SCHEMA-author
  - SCHEMA-contributor-role
  - DB-authors
  - DB-author_settings
  - DB-contributor_roles
  - DB-contributor_role_settings
  - DB-credit_roles
  - DB-credit_contributor_roles
  - API-submission-get-contributors
  - API-submission-get-contributor
  - API-submission-add-contributor
  - API-submission-edit-contributor
  - API-submission-save-contributors-order
  - API-submission-delete-contributor
  - API-contributor-role-get
  - API-contributor-role-get-many
  - API-contributor-role-get-identifiers
  - API-contributor-role-add
  - API-contributor-role-edit
  - API-contributor-role-delete
  - PLUGIN-generic-credit
  - LOC-grid-contributor-listPanel
  - LOC-manager-manager-contributorRoles
  - LOC-api-api-contributorRole
---

# Contributors

## Purpose

Every article carries a list of **contributors** — the people (and, in 3.6, the
organizations) credited on the publication: authors, translators and the like. This
spec owns the **Contributors manager**: the panel where editorial staff (and, until
publication, the submitting author) add, edit, delete and re-order contributors,
choose which one is the **primary (corresponding) contact**, and record each
contributor's affiliation(s), **contributor role** (Author / Translator / …) and
optional **CRediT** roles (Writing, Methodology, … with a degree of contribution). The
same panel is the workflow's **Publication → Contributors** tab and, reused, the
submission wizard's **Contributors** step — so this is both an intake and a
post-submission edit surface. Contributor data is the raw material for the article's
author byline, the corresponding-author correspondence, the metadata export (JATS,
Crossref, OAI) and the reader-facing masthead; those consumers own their own display,
this spec owns the collection.

## Actors & permissions

Permissions are organised **by action**. Recurring terms and site-wide baselines,
stated once: a **manager** (and a **site admin**, who acts as a manager on any journal
they created) may act on any submission; **assigned section editors and assistants** act
per their stage assignment (never recommend-only); a **reviewer** assigned to the
submission may *read* contributors via the API but is offered no contributor UI; an
**author-role** user reaches the manager through *My Submissions* on their own
submission. Contributor **writing** (add / edit / delete / reorder / set primary
contact) is offered in the UI only while the manager is in its editable state — that
state is the shared **published-lock / author-edit gate** (`canEditPublication`) defined
once in `publication-versioning` and only referenced here: managers/editors are
*warn-not-locked* on a published version, an author-role user is *hard-locked* out of
every version once **any** version is published or scheduled. When the gate is false the
Contributors panel drops every editing control and shows only **Preview**
(live-confirmed — see Rule 12). <sup>a</sup>

| Action | Who may — and when |
|--------|--------------------|
| **View the Contributors list** | • Any editorial user with access to the submission — the Publication → Contributors tab<br>• The submitting author — via *My Submissions*, on every version<br>• An assigned reviewer — read-only via the contributors API only (no UI) <sup>b</sup> |
| **Add a contributor** | • Managers and site admins — any version, warned on a published one<br>• Assigned section editors and assistants (not recommend-only)<br>• An author-role user — only while nothing on the submission is published or scheduled and an editor has granted metadata permission; once any version is published/scheduled, hard-locked out <sup>c</sup> |
| **Edit a contributor** | • Same as Add — the same roles, the same `canEditPublication` gate (re-checked when saving) <sup>c</sup> |
| **Delete a contributor** | • Same roles as Add; the Delete control shows only in the editable state, and the published-lock is enforced server-side by `PublicationWritePolicy` — which embeds `PublicationCanBeEditedPolicy`, the same `canEditPublication` gate (delete adds no in-body re-check on top, but it doesn't need one) <sup>d</sup> |
| **Reorder contributors** | • Same roles as Add; ordering is an arrow-based Order mode (up/down), not drag (live-confirmed); the save-order endpoint is likewise gated by `PublicationWritePolicy`'s `PublicationCanBeEditedPolicy` <sup>e</sup> |
| **Set the primary (corresponding) contact** | • Same roles as Add; the action writes the *publication* (it runs the ordinary publication edit), so it **is** subject to the `canEditPublication` gate <sup>f</sup> |
| **Configure the journal's contributor roles** | • Managers and site admins only — Settings → Workflow → Submission → **Contributor Roles** (add / edit / delete role definitions) <sup>g</sup> |

<sup>a</sup> submission/Repository::canEditPublication() (gate, owned by publication-versioning); useWorkflowPermissions() canEditPublication; ContributorManager.vue / contributorManagerStore.js (`canEdit` → `canEditPublication`) ·
<sup>b</sup> PKPSubmissionController::getGroupRoutes() (getContributors/getContributor add Reviewer to the role list); ContributorsListPanel.vue #item-actions gated on `canEditPublication` ·
<sup>c</sup> PKPSubmissionController::addContributor()/editContributor() (roleAuthorizer Manager|SubEditor|Assistant|Author + PublicationWritePolicy + a *redundant* in-body `canEditPublication` re-check, bypassed for Site Admin — the policy already applies the same gate); Repo::author()->validate() ·
<sup>d</sup> PKPSubmissionController::deleteContributor() (no in-body re-check; the published-lock is applied by PublicationWritePolicy → PublicationCanBeEditedPolicy, the identical `canEditPublication` check with the same Site-Admin bypass) ·
<sup>e</sup> PKPSubmissionController::saveContributorsOrder() (gated by PublicationWritePolicy like delete); ContributorsListPanel.vue toggleOrdering()/contributorItemOrderUp()/Down()/setItemOrderSequence(); Orderer component (`.orderer__dragDrop` CSS-hidden) ·
<sup>f</sup> ContributorsListPanel.vue setPrimaryContact() (PUT publication `{primaryContactId}`); PKPSubmissionController::editPublication() (`canEditPublication` gate) ·
<sup>g</sup> ContributorRoleController::getRouteGroupMiddleware() (roleAuthorizer Site Admin|Manager) + authorize() (ContextAccessPolicy + CanAccessSettingsPolicy); management/workflow.tpl (submission tab → contributorRoles side-tab → `<contributor-role-manager>`)

## Fields & validation

The contributor form (`ContributorForm`) is opened in a modal from the manager. Its
shape adapts to the **Contributor Type** radio: person-only fields disappear for an
organization and vice-versa. Multilingual fields show the submission language first plus
an entry per other supported submission language; only the submission-language value is
ever required. All "required" markers below are the **form's** requirements; the
server's schema enforces a narrower set (see Rules 5–6). <sup>a</sup>

| Field (UI label) | Required? | Rules | Anchor |
|------------------|-----------|-------|--------|
| **Contributor Type** | **Yes** | Radio: **Person** / **Organization or group** / **Anonymous** (defaults to Person); drives which fields below appear | ContributorForm::__construct() (`contributorType`, FieldOptions radio); ContributorType enum (PERSON/ORGANIZATION/ANONYMOUS) |
| **Given Name** | **Yes** (Person) | Multilingual single-line; the only name field the form marks required | ContributorForm (`givenName`, `isMultilingual`, `isRequired: showWhenPerson`) |
| **Family Name** | No | Multilingual single-line (Person only) | ContributorForm (`familyName`) |
| **Preferred Public Name** | No | Multilingual; how the contributor prefers to be shown for this publication; overrides given/family in the byline | ContributorForm (`preferredPublicName`) |
| **Organization or group name** | **Yes** (Organization) | Multilingual; shown only for an organization contributor | ContributorForm (`organizationName`, `isRequired: showWhenOrganization`) |
| **Email** | **Yes** (form) | Single-line; validated as an email (or localhost); server schema treats it as nullable | ContributorForm (`email`); author.json `email` (`email_or_localhost`,`nullable`) |
| **Country** | **Yes** (form) | Select of ISO-3166 countries, sorted by localized name; server schema treats it as nullable | ContributorForm (`country`, FieldSelect); author.json `country` (`nullable`,`country`) |
| **ROR ID** | No | Free text; shown only for an organization contributor | ContributorForm (`rorId`, `showWhenOrganization`); author.json `rorId` |
| **Homepage / URL** | No | The contributor's webpage; validated as a URL | ContributorForm (`url`); author.json `url` (`url`,`nullable`) |
| **ORCID** | No | Shown **only when ORCID is enabled** for the journal; **display-only** — the value cannot be set or changed here (the ORCID verification flow owns it), and any `orcid` in a save is rejected (Rule 6) | ContributorForm (`orcid`, added only under OrcidManager::isEnabled()); Repo::author()->validate() (`orcid` → error) |
| **Competing Interests** | Conditional | Multilingual rich text; appears and is **required** only when the journal turns on "require competing-interests statements" | ContributorForm (`competingInterests`, gated on `requireAuthorCompetingInterests`); Repository::validate() |
| **Bio Statement** | No | Multilingual rich text (label "Bio Statement (e.g., department and rank)") | ContributorForm (`biography`) |
| **Affiliations** | No | One or more institutional affiliations; each affiliation is an entity with a multilingual name and an optional ROR link chosen via a registry autocomplete (the ROR backend is infra — see Cross-feature) | ContributorForm (`affiliations`, FieldAffiliations); author.json `affiliations[]` → Affiliation |
| **Contributor Roles** | **Yes** | Checkbox list of the journal's configured contributor roles (seeded **Author**, **Translator**); at least one must be ticked. Appears as checkboxes only when the journal has >1 role; with a single role it is applied silently as a hidden value | ContributorForm (`contributorRoles`, FieldOptions checkbox / hidden); Repository::validate() (`api.submission.400.emptyContributorRoles`) |
| **CRediT roles** | No | The NISO CRediT taxonomy picker (label "CRediT roles and the degrees of contribution"): each selected role can carry a degree (Lead / Equal / Supporting). Present in **core** OJS regardless of the credit plugin (Rule 8) | ContributorForm (`creditRoles`, FieldCreditRoles); FieldCreditRoles::mapCreditRoles() (Repo::creditRole()->getTerms()) |
| **Include this contributor …** | No (default on) | Checkbox "Include this contributor when identifying authors in lists of publications" — governs whether the contributor appears in author lists in search results, TOCs and catalog entries | ContributorForm (`includeInBrowse`, default true); author.json `includeInBrowse` |

<sup>a</sup> The form's config is built server-side by `ContributorsListPanel.php` (wizard / author dashboard) and by `PKPDashboardHandler` (editorial workflow) and handed to the Vue panel; live-confirmed 2026-07-04 (publicknowledge, ORCID off → no ORCID field; competing-interests off → no CI field; contributor roles rendered as required Author/Translator checkboxes; CRediT picker rendered with NISO role URIs + degrees).

## Rules & state

**The manager and its two homes**

1. **One manager, two entry points.** `ContributorsListPanel` (Vue) is the shared
   implementation — add / edit / delete / reorder / set-primary / preview all live in
   it. The workflow **Publication → Contributors** tab wraps it in `ContributorManager`
   (registered in `WorkflowPageOJS.vue`; its store only injects the shared
   `contributorForm` config, the publication API URL and the `canEditPublication`
   verdict as `canEdit`), while the **submission wizard's Contributors step** mounts
   `ContributorsListPanel` directly (`SubmissionWizardPage.vue`). Both drive the same
   contributor CRUD API and the same `ContributorForm`; the wizard owns the *step* and
   its final-submit validation, this spec owns the *manager* (see Cross-feature).

2. **Contributor = the Author entity.** Each contributor is an `authors` row bound to
   one **publication** (not the submission), so a contributor is versioned: creating a
   new version clones its contributors (owned by `publication-versioning`). Localized
   values (names, biography, competing interests) live in `author_settings`; country,
   type and flags live on the row (`classes/author/Author.php`; `authors` +
   `author_settings`).

**Contributor CRUD (the API behind the buttons)**

3. **Add** (`grid.action.addContributor` → POST `…/contributors`) opens the form empty,
   validates it, strips fields irrelevant to the chosen type, resolves the ticked
   **contributor role** labels to role ids, creates the author and appends it to the end
   of the list (`seq` = current max + 1), then adds each affiliation
   (`PKPSubmissionController::addContributor()`; `Repo::author()->add()` →
   `author/DAO::getNextSeq()`; affiliations via `Repo::affiliation()`).

4. **Edit** (per-item Edit → GET `…/contributors/{id}` then PUT) reloads the form from
   the stored author, re-validates, rebuilds the affiliations, and saves; the CRediT and
   contributor-role sets are replaced wholesale from the form
   (`PKPSubmissionController::editContributor()`). **Delete** (per-item Delete → confirm
   dialog → DELETE `…/contributors/{id}`) removes the author and renumbers the remaining
   contributors gaplessly (`deleteContributor()`; `author/DAO::resetContributorsOrder()`).
   Delete is **not** blocked when the contributor is the primary contact — see Rule 10.

5. **Server validation is narrower than the form.** The author schema requires only
   `publicationId`, `contributorType` and at least one **contributor role**
   (`api.submission.400.emptyContributorRoles`); given/family name, email and country
   are marked required by the *form* but are **nullable server-side**, so a contributor
   can be saved with no name via the API. The submission-language **name** requirement is
   enforced instead at *final submit* by the wizard (`Repository::validateSubmit()`
   'contributors', owned by `submission-wizard`) — a contributor added post-submission on
   a live publication is therefore never re-checked for a name. Competing interests are
   required only under the journal's `requireAuthorCompetingInterests` setting
   (`Repository::validate()`).

6. **ORCID is display-only on this form.** Whenever an `orcid` value is present in a
   contributor save, validation rejects it with "You are not allowed to update the ORCID"
   and `editContributor()` additionally unsets it before saving — the ORCID is written
   only by the ORCID verification/collection flow (owned by `orcid`, feature 72). The
   ORCID field only appears at all when the journal has ORCID enabled
   (`Repo::author()->validate()`; `PKPSubmissionController::editContributor()`).

**Roles — two independent systems on one contributor**

7. **Contributor roles** (Author, Translator, …) are a **journal-configured** list, not
   user groups: each is a `contributor_roles` row with a fixed **identifier** (one of
   AUTHOR, EDITOR, CHAIR, REVIEWER, REVIEW_ASSISTANT, STATS_REVIEWER, REVIEWER_EXTERNAL,
   READER, TRANSLATOR, OTHER) and a multilingual **name**, managed by the
   **ContributorRoleManager** at Settings → Workflow → Submission → Contributor Roles
   (Rule 13). A journal is seeded with **Author** and **Translator**. On a contributor,
   the ticked roles are stored as `credit_contributor_roles` rows carrying a
   `contributor_role_id` (`ContributorRole`; `contributor_roles`; the form's required
   `contributorRoles` checkboxes).

8. **CRediT roles** are the fixed **NISO CRediT taxonomy** (14 terms: Conceptualization,
   Methodology, Writing – original draft, …), each optionally qualified by a **degree**
   of contribution. They are stored as `credit_contributor_roles` rows carrying a
   `credit_role_id` (→ `credit_roles`, seeded at install from the pkp-lib CRediT
   translation file) plus a `credit_degree`. The `credit_contributor_roles` table holds
   both kinds of assignment under a **XOR** constraint — a row is *either* a contributor
   role *or* a CRediT role, never both (`SubmissionsMigration` `check_xor_credit_contributor_role`;
   `CreditContributorRole`; `CreditRole`). Collecting CRediT roles is **core** OJS 3.6:
   the `FieldCreditRoles` picker is in the contributor form unconditionally, sourced from
   the DB taxonomy — it renders even with the credit plugin disabled (live-confirmed).

9. **The credit plugin is a reader-side add-on, off by default.** `plugins/generic/credit`
   is installed but **disabled** out of the box (no `enabled` plugin setting —
   live-confirmed: zero `plugin_settings` rows). When enabled it (a) injects the
   contributor's CRediT roles into the **reader** article byline (its own output filter,
   further gated by the plugin's `showCreditRoles` setting) and (b) augments the **JATS**
   contributor list with `<role>` elements. It also re-adds a `creditRoles` form field of
   its own — a legacy/duplicate of the core `FieldCreditRoles` (see Open questions).
   Disabled, none of this runs and CRediT roles are collected-but-not-shown-to-readers
   (`CreditPlugin::register()`, `addCreditRoles()`, `articleDisplayFilter()`,
   `augmentJats()`; `LazyLoadPlugin::getEnabled()`).

**Ordering & primary contact**

10. **Primary (corresponding) contact** is a **publication** property
    (`primaryContactId` → an author id), not a contributor property. The "Set Primary
    Contact" per-item action PUTs the *publication* with `{primaryContactId}` — i.e. it
    runs the ordinary publication edit, so it obeys the `canEditPublication` gate. The
    current primary contact shows a **badge** instead of the button (so the control is
    absent when a contributor is already primary, e.g. the sole author). On submission
    start the submitter-as-author is made primary contact automatically
    (`newAuthorFromUser` path). **Deleting** the primary-contact contributor **nulls**
    `primary_contact_id` and does **not** reassign it (`PKP\author\DAO::delete()` —
    `UPDATE publications SET primary_contact_id = NULL …`; the OJS `APP\author\DAO`
    subclass is empty and inherits it), leaving the publication with
    no primary contact until one is set again (`ContributorsListPanel.vue setPrimaryContact()`;
    publication.json `primaryContactId`).

11. **Ordering is arrow-based, not drag.** The list has a fixed order (`authors.seq`,
    0-based). An **Order** toggle switches the panel into ordering mode where each row
    shows up/down arrows and the footer shows **Save Order** / **Cancel**; the drag
    handle exists in markup but is **CSS-hidden**, so drag is disabled (live-confirmed —
    Order mode showed Save Order + Cancel, 2 arrow controls, no visible drag handle).
    Saving assigns `seq` = 0…n over the reordered array and PUTs `…/contributors/saveOrder`
    with the sorted author list (`ContributorsListPanel.vue toggleOrdering()`,
    `contributorItemOrderUp()/Down()`, `setItemOrderSequence()`;
    `PKPSubmissionController::saveContributorsOrder()` → `Repo::author()->setAuthorsOrder()`).

**Editability**

12. **The manager mirrors the publication edit gate.** Every editing control (Add,
    Edit, Delete, Order, Set Primary Contact) is rendered only when `canEditPublication`
    is true; when it is false the panel collapses to **Preview** only. *(Live-confirmed
    2026-07-04: on an unpublished submission the editor saw Add Contributor / Order /
    Edit / Delete / Preview; on a scheduled submission the same editor saw only Preview.)*
    The gate itself — warn-not-lock for editorial roles, hard-lock for authors once any
    version is published/scheduled — is owned by `publication-versioning` (Rules 13–15
    there). All five writes are gated by the same `canEditPublication` check server-side:
    every contributor-write route (add / edit / delete / save-order) and `editPublication`
    carries `PublicationWritePolicy`, whose embedded `PublicationCanBeEditedPolicy` runs
    that check; Add / Edit additionally re-run it in the method body (redundant), Delete /
    Save-Order rely on the policy alone — an identical gate, so there is no behavioural gap
    (Known deviations; Open question 1 resolved).

**Contributor-role settings**

13. **Managing contributor roles.** The ContributorRoleManager (Settings → Workflow →
    Submission → Contributor Roles) lists the journal's roles and offers Add / Edit /
    Delete. **Add/Edit** sets a role **identifier** (from the fixed enum, immutable once
    saved) and a multilingual **name** (`useContributorRoleManagerFormAddRole`;
    `ContributorRoleController::add()/edit()`). **Delete** requires typing the exact
    identifier to confirm, and is refused when either (a) the role is **in use** by any
    contributor (HTTP 406, `manager.contributorRoles.error.delete.inUse`) or (b) it is
    the **last AUTHOR** role in the journal (`ContributorRole::delete()` guard → HTTP 406,
    `api.contributorRole.400.errorDeletingAuthorRole`). The role list, identifiers,
    add/edit/delete are the `/contributorRoles` API (`ContributorRoleController`).

## Side effects

- **No event-log entry and no notification** is written for contributor add / edit /
  delete / reorder — the manager updates optimistically and re-fetches; the author
  repository fires only hooks (`Author::add`, `Author::edit`, `Author::delete`, …), no
  `Repo::eventLog()` call and no mailable (`PKPSubmissionController` contributor methods;
  `author/Repository.php`).
- **Setting the primary contact** goes through the publication edit endpoint, which
  dispatches the standard `MetadataChanged` publication event and records the usual
  "Metadata updated" activity-log entry every publication edit fires (surface owned by
  `publication-metadata-references` / `editorial-activity-log`) — there is no
  contributor-specific log.
- **Configuring a contributor role** emits a client-side "saved" toast
  (`manager.contributorRoles.saved`); no server event log.
- Downstream consumers read contributor data but are triggered by *publish*, not by a
  contributor edit: the reader byline/masthead, JATS/Crossref/OAI export, and (when the
  credit plugin is on) the reader CRediT list and JATS `<role>` augmentation.

## Settings that modify behavior

- **Contributor Roles** (Settings → Workflow → Submission): the journal's role list
  drives the required `contributorRoles` field — with a single role the checkbox is
  hidden and applied silently, with >1 it renders as required checkboxes (Rule 7, 13).
- **Require competing-interests statements** (`requireAuthorCompetingInterests`, Settings
  → Workflow → Metadata): adds the required Competing Interests field to the form
  (Rule 5).
- **ORCID enabled** (Settings → Workflow → ORCID): adds the display-only ORCID field
  (Rule 6). Off by default on a seeded journal.
- **Credit plugin enabled** + its **showCreditRoles** setting: turn on the reader-side
  CRediT display and JATS augmentation; both off by default (Rule 9). CRediT *collection*
  needs no setting.
- **Supported submission languages** (Settings → Website → Languages): which language
  values the multilingual name / bio / competing-interests fields offer.

## Cross-feature interactions

- **submission-wizard** — mounts this manager as its Contributors step and owns the
  step's placement and the final-submit "every contributor needs a submission-language
  name" check (Rule 5); this spec owns the manager, the form and the CRUD API.
- **publication-versioning** — owns the `canEditPublication` published-lock/author gate
  (Rule 12) and the cloning of contributors (and remapping of `primaryContactId`) when a
  new version is created.
- **publication-title-abstract-body** — the sibling Publication tab; shares the same gate
  and the multilingual-fields shape.
- **orcid** (feature 72) — owns ORCID verification/collection and the reader ORCID
  display; this spec owns only the display-only ORCID *field* on the contributor form,
  which cannot write the value (Rule 6).
- **affiliations-ror** (Background/infra) — owns the affiliation **storage** entity
  (`author_affiliations`, `SCHEMA-affiliation`) and the ROR registry / autocomplete
  backend; this spec owns the affiliation **field** on the contributor form (Fields).
- **editorial-masthead / reader article page** — own the reader-facing display of
  contributors (byline, masthead), fed by the data collected here.
- **metadata export** (JATS / Crossref / OAI / DataCite) — consume contributor data,
  including CRediT roles when the credit plugin augments JATS (Rule 9).

## Canonical scenarios

1. **Add a person contributor** — Editor (dbarnes): on a submission's Publication →
   Contributors tab, clicks **Add Contributor**, keeps type *Person*, enters given/family
   name, email, country, an affiliation, ticks the **Author** role, saves. The new
   contributor appears at the end of the list with the Author badge; the submission's
   author list now shows both.
2. **Edit a contributor** — Editor: opens a contributor's **Edit**, corrects the
   affiliation and adds the **Translator** role, saves; the row updates in place.
3. **Delete a contributor** — Editor: **Delete** on a non-primary contributor, confirms
   the "are you sure" dialog; the contributor is removed and the remaining ones renumber
   without a gap.
4. **Reorder with the Order mode** — Editor: on a submission with two contributors clicks
   **Order**, moves the second author up with the arrow control, clicks **Save Order**;
   the new sequence persists (no drag handle is offered — reordering is arrow-based).
5. **Set the primary contact** — Editor: with two contributors, clicks **Set Primary
   Contact** on the second; its badge moves there and the publication's primary-contact
   pointer updates (the action saves the publication, so it respects the edit gate).
6. **Primary contact deletion leaves none** — Editor: deletes the contributor who is the
   primary contact; the publication's primary-contact pointer is cleared (not reassigned),
   and the byline/correspondence has no corresponding author until one is set again.
7. **Assign CRediT roles** — Editor: opens a contributor, in "CRediT roles and the
   degrees of contribution" selects *Writing – original draft* at degree *Lead* and
   *Methodology* at *Supporting*, saves; the roles store against the contributor. With the
   credit plugin disabled they are collected but do not appear on the reader article page.
8. **Organization contributor** — Editor: **Add Contributor**, switches type to
   *Organization or group*; the person name/ORCID fields disappear, an **Organization
   name** (required) and **ROR ID** field appear; saves an institutional contributor.
9. **Multilingual name** — Editor: on a journal with a second submission language,
   switches the form's language tab and enters the given/family name in that language;
   both language values save. The submission-language name is the one required at final
   submit (wizard), the secondary is optional.
10. **Published version is read-only** — Editor opens the Contributors tab on a
    published/scheduled version and sees only **Preview** — Add/Edit/Delete/Order are
    gone; a manager on the same version, being warn-not-locked, would still see them. An
    **author** who was granted metadata permission finds every editing control gone the
    moment any version is published or scheduled.
11. **Configure the journal's contributor roles** — Manager: Settings → Workflow →
    Submission → **Contributor Roles**, adds an *Editor* role (identifier + name), edits
    the *Translator* name, then tries to delete **Author** and is refused because it is
    the last Author role (and any in-use role is likewise undeletable).

## Known deviations (as-built ≠ intent)

- ⚠ **Reorder is fragile — a background refetch reverts the optimistic move and can
  swallow the Save-Order click** ([app-changes §2 row 20](../../e2e/app-changes.md)):
  every contributor mutation triggers both the panel's own refresh and the workflow's
  `triggerDataChange()` refetch; the trailing re-render can revert an optimistic move-up
  or drop the pending Save-Order POST, and `getAndUpdatePublication`'s completion
  unconditionally resets `isOrdering = false`, kicking the user out of ordering mode on
  any background refresh (`contributorManagerStore.js`; `ContributorsListPanel.vue`).
- ⚠ **The list subtitle never shows affiliations (dead binding)**
  ([app-changes §2 row 21](../../e2e/app-changes.md)): the list row renders a singular
  `item.affiliation`, but the author carries only the `affiliations[]` array, so the
  affiliation subtitle is always empty (`ContributorsListPanel.vue` vs `author.json`).
- ⚠ **A refused contributor-role delete shows a generic network-error modal, not the
  reason** ([app-changes §2 row 90](../../e2e/app-changes.md)):
  `ContributorRoleController::delete()` refuses with HTTP **406** and a specific,
  translated body — `manager.contributorRoles.error.delete.inUse` (role in use by a
  contributor) or `api.contributorRole.400.errorDeletingAuthorRole` (last AUTHOR role) —
  but the Vue `roleDelete()` runs `useFetch` without `expectValidationError`, so any
  non-2xx throws into `useFetch`'s default `modalStore.openDialogNetworkError(e)` (and 406
  isn't even in its `[400,422]` validation branch). The user sees a generic "network
  error" dialog instead of the friendly refusal the backend prepared — the confirm dialog
  implies a meaningful outcome the UI then hides (contradicts a UI affordance; no data
  loss). Live-confirmed by the contributors test author; code-traced by the verifier
  (`contributorRoleManagerStore.js` `roleDelete()`; `useFetch.js` error path).
- **Add/Edit re-check the published-lock twice, Delete/Save-Order once — but the gate
  holds for all four** (not a defect; a code-tidiness note): `addContributor()` /
  `editContributor()` re-verify `canEditPublication` in the method body *in addition to*
  the `PublicationWritePolicy` that every contributor-write route carries, while
  `deleteContributor()` / `saveContributorsOrder()` rely on the policy alone.
  `PublicationWritePolicy` embeds `PublicationCanBeEditedPolicy`, which runs the
  **identical** `Repo::submission()->canEditPublication()` check (same Site-Admin bypass),
  so the published-lock/author gate is enforced on all four endpoints — the in-body
  re-check in add/edit is redundant, not a unique guard. There is **no exploitable gap**:
  `PublicationWritePolicy` never admits a writer the gate would reject (Open question 1
  resolved). Originally flagged ⚠ pre-verification; downgraded to a plain note.
- **The credit plugin re-adds a duplicate `creditRoles` form field** (benign, off by
  default): when enabled, `CreditPlugin::addCreditRoles()` adds a second `creditRoles`
  field (a degree-less checkbox from the plugin's own static JSON) on top of core's
  `FieldCreditRoles` of the same name — a legacy remnant of the pre-core CRediT mechanism.
  The plugin ships **disabled**, so this never fires out of the box; a code-cleanup
  candidate, not a live defect (Open question 4). Originally flagged ⚠; downgraded to a
  plain note.
- The **legacy `AuthorGridHandler`** (`controllers/grid/users/author/AuthorGridHandler.php`)
  is the pre-Vue contributor grid; it has no subclasses and no live reference — already a
  **dead-code candidate** in the atlas (`grids.md`, suspected-dead). The live surface is
  the Vue `ContributorManager` / `ContributorsListPanel`; this spec documents only the
  latter.

## Open questions

1. ~~Is the **Delete/Save-Order vs Add/Edit** published-lock asymmetry intended? Does
   `PublicationWritePolicy` alone ever admit a writer the `canEditPublication` gate would
   reject?~~ **Resolved (verifier 2026-07-04):** No gap. `PublicationWritePolicy` embeds
   `PublicationCanBeEditedPolicy`, which applies the *same* `canEditPublication` check
   (with the same Site-Admin bypass) that delete/reorder would otherwise need — so all
   four contributor-write endpoints enforce the published-lock, and the in-body re-check
   in add/edit is merely redundant. The policy never admits a writer the gate rejects.
2. Should **deleting the primary-contact contributor reassign** the primary contact
   (e.g. to the first remaining author) instead of leaving the publication with none
   (Rule 10)?
3. Server-side, a contributor can be **saved with no name** (Rule 5) because the name is
   only enforced at wizard final-submit — is a nameless contributor added *after*
   submission (never re-validated) intended, or should the manager enforce a
   submission-language name on save?
4. Is the credit plugin's **duplicate `creditRoles` field** (Known deviations) meant to be
   removed now that CRediT collection is core, leaving the plugin purely a reader-display
   / JATS add-on?
5. The credit plugin ships **disabled**; is reader-side CRediT display meant to be
   opt-in (enable the plugin + `showCreditRoles`), or should core surface the collected
   CRediT roles to readers without a plugin?

---

<!-- REFERENCE MATERIAL — provenance and campaign bookkeeping, not product-owner narrative. -->

## Reference — entry points & surfaces

| Entry | Path | Atom |
|-------|------|------|
| Contributors tab (editorial) | Workflow → Publication → Contributors (`ContributorManager` in `WorkflowPageOJS.vue`) | VUE-contributor-manager |
| Contributors panel (shared / wizard / author) | Submission wizard Contributors step + author dashboard (`ContributorsListPanel`) | VUE-contributors-list-panel |
| Contributor form | The add/edit modal (`ContributorForm`, ~16 fields) | FORM-contributor-form |
| List contributors / get one | `GET …/publications/{pubId}/contributors[/{id}]` | API-submission-get-contributors, API-submission-get-contributor |
| Add / edit / delete contributor | `POST …/contributors`, `PUT …/contributors/{id}`, `DELETE …/contributors/{id}` | API-submission-add-contributor, API-submission-edit-contributor, API-submission-delete-contributor |
| Save contributor order | `PUT …/contributors/saveOrder` (body `sortedAuthors`) | API-submission-save-contributors-order |
| Set primary contact | (no dedicated route) `PUT …/publications/{pubId}` with `{primaryContactId}` | — (uses API-submission-edit-publication, owned by publication-versioning) |
| Contributor-role settings | Settings → Workflow → Submission → Contributor Roles (`ContributorRoleManager`) | VUE-contributor-role-manager |
| Contributor-role API | `GET/POST/PUT/DELETE /contributorRoles[/{id}]`, `GET /contributorRoles/identifiers` | API-contributor-role-get, -get-many, -get-identifiers, -add, -edit, -delete |
| Credit plugin | `plugins/generic/credit` (disabled by default; reader display + JATS) | PLUGIN-generic-credit |
| Storage | `authors` (+ `author_settings`); roles in `contributor_roles`/`contributor_role_settings` + `credit_roles` + `credit_contributor_roles` | DB-authors, DB-author_settings, DB-contributor_roles, DB-contributor_role_settings, DB-credit_roles, DB-credit_contributor_roles |
| Schemas | `author.json`, `contributorRole.json` | SCHEMA-author, SCHEMA-contributor-role |
| Locale keys | `contributor.listPanel.*`, `manager.contributorRoles.*`, `api.contributorRole.*` | LOC-grid-contributor-listPanel, LOC-manager-manager-contributorRoles, LOC-api-api-contributorRole |

Route/role gates: contributor read routes allow Manager|SubEditor|Assistant|Author|Reviewer;
write routes (add/edit/saveOrder/delete) allow Manager|SubEditor|Assistant|Author with
`SubmissionAccessPolicy` + `PublicationWritePolicy`. `PublicationWritePolicy` embeds
`PublicationCanBeEditedPolicy`, so the `canEditPublication()` published-lock is enforced on
all four writes; add/edit *additionally* re-check `Repo::submission()->canEditPublication()`
in-body (redundant, bypassed for Site Admin). Contributor-role routes require Manager or
Site Admin (`ContributorRoleController::getRouteGroupMiddleware()` roleAuthorizer +
`ContextAccessPolicy` + `CanAccessSettingsPolicy`).

## Reference — code anchors

- Contributor CRUD API: `lib/pkp/api/v1/submissions/PKPSubmissionController.php`
  (`getContributors()`, `getContributor()`, `addContributor()`, `editContributor()`,
  `saveContributorsOrder()`, `deleteContributor()`, `getGroupRoutes()`, `authorize()`).
- Contributor form: `lib/pkp/classes/components/forms/publication/ContributorForm.php`;
  field widgets `FieldAffiliations.php`, `FieldCreditRoles.php`, `FieldOrcid.php`;
  built for the client by `lib/pkp/classes/components/listPanels/ContributorsListPanel.php`
  and `lib/pkp/pages/dashboard/PKPDashboardHandler.php`.
- Author entity: `lib/pkp/classes/author/Author.php`, `classes/author/Author.php`;
  `lib/pkp/classes/author/DAO.php` (`fromRow()/insert()/update()/delete()`,
  `getNextSeq()/resetContributorsOrder()`); `PKP\author\DAO::delete()` (nulls
  `primary_contact_id`; OJS `APP\author\DAO` is an empty subclass); `lib/pkp/classes/author/Repository.php` (`validate()`, `add()`,
  `edit()`, `newAuthorFromUser()`, `setAuthorsOrder()`).
- Roles: `lib/pkp/classes/author/contributorRole/ContributorRole.php` (+ `ContributorType.php`,
  `ContributorRoleIdentifier.php`); `lib/pkp/classes/author/creditContributorRole/`
  (`CreditContributorRole.php`, `Repository.php`); `lib/pkp/classes/author/creditRole/`
  (`CreditRole.php`, `CreditRoleDegree.php`, `Repository.php` `getTerms()`);
  `lib/pkp/api/v1/contributorRoles/ContributorRoleController.php`.
- Schemas / migration: `lib/pkp/schemas/author.json`, `lib/pkp/schemas/contributorRole.json`;
  `lib/pkp/classes/migration/install/SubmissionsMigration.php` (credit_roles seed +
  credit_contributor_roles XOR constraint), `AffiliationsMigration.php`.
- Credit plugin: `plugins/generic/credit/CreditPlugin.php` (`register()`, `addCreditRoles()`,
  `articleDisplayFilter()`, `augmentJats()`), `classes/form/CreditSettingsForm.php`.
- Vue: `lib/ui-library/src/managers/ContributorManager/ContributorManager.vue` +
  `contributorManagerStore.js`; `lib/ui-library/src/components/ListPanel/contributors/ContributorsListPanel.vue`;
  `lib/ui-library/src/managers/ContributorRoleManager/*`; registration in `WorkflowPageOJS.vue`,
  `SubmissionWizardPage.vue`, `management/workflow.tpl`.
</content>
</invoke>
