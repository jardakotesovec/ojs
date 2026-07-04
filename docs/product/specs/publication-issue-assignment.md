---
name: publication-issue-assignment
scope: Assign an article to an issue and section, place it into a current/back or future issue (or leave it issueless), assign the journal's categories, and set the cover image / pages / URL path — on the workflow Publication → Issue ("Publication Settings") tab, staging the publication's pre-publish status (ready-to-publish vs ready-to-schedule) that the publish flow later turns into Published/Scheduled
shared: no               # issues are an OJS concept: IssueEntryForm, the IssueAssignment enum, the assignment-options + issue-assignment-status endpoints and the OJS SubmissionController overrides are all in the OJS app (classes/, api/v1/). The host WorkflowPublicationForm, the publication edit endpoint and the canEditPublication lock are pkp-lib, referenced. The assignment radio + issue picker are injected by the shared-repo composable useWorkflowPublicationFormIssue but only when isOJS()
status: verified
e2e-plans: [issue-assignment-scheduling]
atlas-claims:
  - FORM-issue-entry-form
  - API-submission-get-publication-issue-form
  - API-submission-get-issue-assignment-status
  - API-issue-get-assignment-options
  - DB-publication_categories
---

# Publication — Issue assignment & scheduling (the Issue / "Publication Settings" tab)

## Purpose

Before an article can be published, an editor decides **where it goes**: which **issue** it appears
in (a current/back issue, a future issue, or no issue at all), which **section** of the journal, and
— along the way — its **categories**, **cover image**, printed **page range** and custom **URL path**.
That decision is made on the workflow **Publication → Issue** tab (labelled **"Publication Settings"**).
The tab's headline control is a required **Issue Assignment** radio — *Don't Assign To An Issue* /
*Assign To Current/Back Issue* / *Assign To Future Issue and Publish Immediately* / *Assign To Future
Issue and Schedule Only* — followed by an issue picker that appears when an option needs one. Choosing
an option both records the article's `issueId` and **stages the publication's pre-publish status**
(*ready-to-publish* vs *ready-to-schedule*); the separate **Publish** action (owned by
`publication-publish-flow`) later turns that staged status into **Published** or **Scheduled**. This
spec owns the Issue tab, its form (`IssueEntryForm`), the assignment radio + issue picker, the
section/category assignment, and the tab's copy of pages / URL path / cover image. It does **not** own
the publish/schedule *action* itself, the creation/management of **issues**, the journal **category**
definitions, or the identifier rules for pages/URL path — each is referenced.

## Actors & permissions

Recurring terms and baselines, stated once: **editorial roles** = journal manager, site admin (who
acts as a manager on any journal they created), and **assigned** section editors (sub-editors) and
assistants. The **published-lock / author-edit gate** (`canEditPublication`) that decides *whether an
edit is still allowed* is defined once in `publication-versioning` and only referenced here:
managers/editors are **warn-not-locked** on a published version (the Issue fields stay editable behind
the yellow "this version is published" banner), an **author-role** user is **hard-locked** the moment
any version is published/scheduled. The tab is **production-gated**: like Galleys / Media / Permissions
& Disclosure it is added to the editorial Publication menu only inside the nav's `canAccessProduction`
block, and is **absent from the author's Publication menu entirely** (rule 1). Like the Identifiers and
License tabs (and unlike the Galleys manager — `galleys` rule 9), the Issue form **honours** the lock
(rule 8). <sup>a</sup>

| Action | Who may — and when |
|--------|--------------------|
| **See the Issue ("Publication Settings") tab** | • Editorial roles **with production-stage access** — managers always; assigned section editors/assistants when they can access production; warned on a published version<br>• Author — **never** (the tab is not in the author's Publication menu; the form endpoint is manager/editor/assistant-only — a hand-crafted author request is refused, **live 401**) <sup>b</sup> |
| **Assign to a *current/back* (published) issue, or *don't assign*** | • Editorial roles with production access — any version, warned on a published one<br>• Author — **never** (no tab; endpoint refused) <sup>c</sup> |
| **Assign to / schedule into a *future* (unpublished) issue** | • Managers and site admins — the "Assign To Future Issue…" options<br>• ⚠ Section editors / assistants — the radio **offers** these options but the future-issue picker is manager/admin-only, so a non-manager editor gets an error dialog + empty, un-fillable picker and cannot complete a future-issue assignment; **worse, merely *opening* the Issue tab on an already-scheduled (or future-placed) article pops that same 403 error dialog on load and leaves the target-issue picker empty** — so a section editor can't even see which future issue a scheduled article is in (rule 11, both facets)<br>• Author — **never** <sup>h</sup> |
| **Set the section** | • Same editorial roles — the section is required on every publication and re-settable here<br>• Author — sets the section **only at intake** (submission wizard), not on this tab <sup>d</sup> |
| **Assign categories to the publication** | • Same editorial roles — the category picker on this tab (present only when the journal defines categories); the author's category picker is the wizard's For-the-Editors step (owned by `submission-wizard-metadata`) <sup>e</sup> |
| **Edit cover image / pages / URL path** | • Same editorial roles — warned on a published version<br>• Author — **never** (these live on this editorial-only tab; contrast the author-visible Metadata tab's article-number) <sup>f</sup> |
| **Stage ready-to-publish / ready-to-schedule; do the actual Publish/Schedule** | • Saving the tab stages the **pre-publish** status only; the **Publish / Schedule** action itself (turning it Published/Scheduled, setting the publication date) is a **separate button** owned by `publication-publish-flow`; ⚠ setting a published/scheduled status *directly* through this form's save is refused (rule 6) <sup>g</sup> |

<sup>a</sup> `useWorkflowPermissions()`/`canEditPublication`, `canAccessProduction` (owned by publication-versioning / workflow-stage-navigation); `WorkflowPublicationForm.vue` (`newPublicationForm.canSubmit = props.canEdit`) ·
<sup>b</sup> `useWorkflowNavigationConfigOJS.js` `getPublicationItemsEditorial()` pushes the `issue` item (label `publication.publicationSettings`) inside `if (permissions.canAccessProduction)`; `getPublicationItemsAuthor()` has **no** issue item; `SubmissionController::getGroupRoutes()` roles SubEditor|Manager|SiteAdmin|Assistant; **live 2026-07-04** — editor `GET …/_components/issue` → **200**, author (atester) → **401**, and the author Publication menu omits "Publication Settings" ·
<sup>c</sup> `workflowConfigEditorialOJS.js` `issue.getPrimaryItems` (`formName:'issue', canEdit: permissions.canEditPublication`); `useWorkflowPublicationFormIssue()` `createFields()` (the `assignment` radio) ·
<sup>d</sup> `IssueEntryForm::__construct()` (`sectionId` FieldSelect); `schemas/publication.json` `required: [sectionId]` ·
<sup>e</sup> `IssueEntryForm::__construct()` (`categoryIds` FieldAutosuggestPreset, added only when `Repo::category()` returns options); `publication/DAO::saveCategories()` ·
<sup>f</sup> `IssueEntryForm::__construct()` (`coverImage`/`pages`/`urlPath`); `pages`/`urlPath` identifier rules owned by `publication-identifiers` ·
<sup>g</sup> `PKPSubmissionController::editPublication()` (pre-publish-status guard → `api.publication.403.cantEditStatus`); `Repository::setStatusOnPublish()` (READY_TO_PUBLISH→PUBLISHED, READY_TO_SCHEDULE→SCHEDULED) — owned by `publication-publish-flow` ·
<sup>h</sup> `IssueAssignment::getAvailableAssignmentOption()` (options not role-filtered); `IssueController::getMany()` (`$isAdmin` = MANAGER/SITE_ADMIN only → 403 `api.submissions.403.unpublishedIssues` on `isPublished=false`); **live 2026-07-04** — dbuskins (sectionEditor) `GET /issues/assignmentOptions` → 200 (all four options) but `GET /issues?isPublished=0` → **403**; rule 11 / Known deviations (ledger row 94)

## Fields & validation

The tab is a single form served as `issueEntry` (the OJS `IssueEntryForm`, PUT). **Two of its
controls are not in the PHP form at all** — the **Issue Assignment** radio and the **Issue** picker are
injected client-side by the `useWorkflowPublicationFormIssue` composable (positioned before Section),
and only when the journal has at least one issue (`issueCount > 0`) and the app is OJS. Everything
saves on the shared publication `PUT`. The **live form fetch** (2026-07-04) returns exactly:
`sectionId, categoryIds, datePublished, updateType, summaryOfChanges, coverImage, pages, urlPath` in
groups `placement / publicationTiming / versionAndUpdates / display / access`.

| Field (UI label) | Required? | Rules | Anchor |
|------------------|-----------|-------|--------|
| **Issue Assignment** (radio) | **Yes** (client-side) | Injected control, one row per *available* option (rule 2). Choosing it decides whether an issue picker appears and what pre-publish status the save stages (rule 3). Not a stored publication prop — it drives `issueId` + `status` | `useWorkflowPublicationFormIssue()` `createFields()` (`assignment`, `isRequired`); `IssueAssignment` enum |
| **Issue** (picker) | **Yes when an issue-requiring option is chosen** (client-side `showWhen`) | Injected select; shown only for the three options that need an issue (all but *Don't Assign*). Its options are the journal's issues **filtered to the chosen option's publish-state** (published issues for *Current/Back*, unpublished for the two *Future* options). Backend rejects a non-existent issue ("The issue…could not be found") | `useWorkflowPublicationFormIssue()` (`issueId`, `showWhen: ['assignment', …]`, options from `/issues?isPublished=`); `publication/Repository::validate()` (`publication.invalidIssue`) |
| **Section** | **Yes** | The journal section the article belongs to. Options are the journal's sections; an inactive section is labelled "(Inactive)". The **only** publication-schema-required field; backend rejects a section not in this journal ("The section…could not be found") | `IssueEntryForm` (`sectionId`, FieldSelect); `schemas/publication.json` `required:[sectionId]`; `publication/Repository::validate()` (`publication.invalidSection`) |
| **Categories** | No | Multi-select autosuggest of the journal's categories (breadcrumb labels, nested categories supported); **rendered only when the journal defines at least one category**. Saving rewrites the publication's category rows. No format validation | `IssueEntryForm` (`categoryIds`, FieldAutosuggestPreset, gated on non-empty options); `publication/DAO::saveCategories()` |
| **Cover Image** | No | Per-publication cover image upload (multilingual — one per submission language); used on the article/issue pages instead of the issue cover | `IssueEntryForm` (`coverImage`, FieldUploadImage, `isMultilingual`) |
| **Publication Date** | No | Free-text date. Description: set automatically when the issue is published — enter one **only** to backdate a previously-published article. Nullable | `IssueEntryForm` (`datePublished`, FieldText) |
| **Pages** | No | Free-text page range ("1-15", "iv-x"). Rendered here, but its identifier meaning/validation is owned by `publication-identifiers` (no format validation) | `IssueEntryForm` (`pages`, FieldText, GROUP_DISPLAY) |
| **URL Path** | No | Custom URL slug. Rendered here; its validation (alphanumeric, not-all-digits, journal-unique) is owned by `publication-identifiers` (`publication-identifiers` rule 7) | `IssueEntryForm` (`urlPath`, FieldText, GROUP_ACCESS); `publication/Repository::validate()` (urlPath rules, owned by identifiers) |
| **Version / Summary of changes** | No | *Update type* select + multilingual *Summary of changes* rich-text — the amendments/versioning controls that ride on this form; owned by `publication-amendments` / `publication-versioning`. Pointer only | `IssueEntryForm` (`updateType` FieldSelect, `summaryOfChanges` FieldRichTextarea) |

## Rules & state

The publication carries the placement values as ordinary publication fields — `issueId`, `sectionId`,
`pages`, `urlPath`, `datePublished`, `coverImage`, `status` — plus category rows in
**`publication_categories`** (a join table, not a setting). The **assignment radio** and the injected
**status** are *derived*, not stored props of their own: the radio reflects the placement and the save
writes `issueId` + a pre-publish `status`. <sup>a</sup>

1. **The Issue tab is a production-stage editorial tab; authors never see it.** The nav adds the
   `issue` item (label `publication.publicationSettings` = **"Publication Settings"**) to the editorial
   Publication menu inside the `permissions.canAccessProduction` block (after Galleys/Media/License),
   and **omits it from the author menu**. The form endpoint (`_components/issue`) and the
   issue-assignment-status endpoint are role-gated **SubEditor|Manager|SiteAdmin|Assistant**. So an
   author cannot reach issue assignment at all. **Live-verified 2026-07-04**: editor
   `GET …/_components/issue` → **200**; author (atester) → **401** on both `…/_components/issue` and
   `…/issueAssignmentStatus`. <sup>b</sup>
2. **The assignment radio offers four options, filtered to those an issue actually exists for.** The
   options come from the OJS `IssueAssignment` enum via `GET /issues/assignmentOptions`
   (**live-verified body**, 2026-07-04): **(1) "Don't Assign To An Issue"** — no issue, always offered;
   **(2) "Assign To Future Issue and Publish Immediately"** — an *unpublished* issue, continuous
   publication; **(3) "Assign To Future Issue and Schedule Only"** — an *unpublished* issue, scheduled;
   **(4) "Assign To Current/Back Issue"** — a *published* issue. `getAvailableAssignmentOption()` keeps
   option 1 always, keeps 2 & 3 only when at least one **unpublished** issue exists, and keeps 4 only
   when at least one **published** issue exists. Live on publicknowledge all four were returned (it has
   both a published and an unpublished issue). When the journal has **no issues at all**
   (`issueCount = 0`), the composable does **not** inject the radio/picker — only the base fields show.
   The options are filtered **only** by issue existence, **not by the user's role** — see rule 11 for the
   consequence for non-manager editors. <sup>c</sup>
3. **The chosen option decides the issue picker's contents and the staged pre-publish status.** Each
   option carries an `isPublished` flag (null / 0 / 1) and a `status`. When an option with a non-null
   `isPublished` is chosen, the **Issue** picker becomes required and is populated from
   `GET /issues?isPublished={0|1}` — **published** issues for *Current/Back*, **unpublished** issues for
   the two *Future* options; *Don't Assign* shows no picker. The option's `status` becomes the form's
   hidden **status**: **READY_TO_PUBLISH** for options 1, 2 and 4; **READY_TO_SCHEDULE** for option 3
   ("Schedule Only"). Changing the radio after the initial load clears the picked issue. <sup>d</sup>
4. **The radio is pre-selected to reflect the article's current placement.** On load the tab calls
   `GET …/issueAssignmentStatus`, which returns an `assignmentType` + `status` computed by
   `Repository::getIssueAssignmentStatus()` from the publication's current status, `issueId`,
   `datePublished` and the assigned issue's published flag: e.g. a queued article with no issue defaults
   to *Current/Back* when issues exist (else *Don't Assign*); an article in a published issue → *Current/
   Back*; in an unpublished issue with a publish date → *Future/Publish Immediately*, without one →
   *Future/Schedule Only*. **Live-verified 2026-07-04**: both a queued issueless article and a published
   one returned `{assignmentType: 4 (Current/Back), status: 6 (ready-to-publish)}`. <sup>e</sup>
5. **Section is required and validated against the journal; issue is validated when set.** Every
   publication must have a `sectionId` (the schema's sole required field); saving a `sectionId` that is
   not a section of this journal is refused with "The section…could not be found", and a `sectionId`
   change re-checks the section's abstract/word-count requirements (owned by `publication-title-abstract-body`).
   A non-existent `issueId` is refused with "The issue…could not be found". Both validate on the shared
   publication save. <sup>f</sup>
6. **⚠ The Issue tab stages a *pre-publish* status only — it cannot Publish or Schedule directly.**
   `editPublication` accepts a `status` change **only** to a pre-publish value —
   `getPrePublishStatuses()` = **READY_TO_PUBLISH (6)** or **READY_TO_SCHEDULE (7)**; any attempt to set
   **Published (3)** or **Scheduled (5)** through the form's save is refused
   (`api.publication.403.cantEditStatus`, **live 403**: "You can not modify the status directly through
   the API. Instead, use the /publish and /unpublish endpoints."). So saving the Issue tab **records the
   placement + the intent** (ready-to-publish vs ready-to-schedule); the actual transition to Published/
   Scheduled — and setting the publication date — happens at the **Publish/Schedule** action, where
   `setStatusOnPublish()` maps READY_TO_PUBLISH→PUBLISHED and READY_TO_SCHEDULE→SCHEDULED. That action
   is owned by `publication-publish-flow`. On the initial load of an *already* published/scheduled
   article the composable deliberately leaves `status` unset so a plain re-save does not disturb it.
   <sup>g</sup>
7. **Categories persist to a join table even though the schema marks `categoryIds` read-only.** The
   `categoryIds` prop is flagged `readOnly` in the publication schema, yet the Issue-tab save **does**
   assign them: the publication DAO reads `categoryIds` off the object on insert/update and rewrites
   `publication_categories` (`assignCategoriesToPublication` inserts the picked ids and deletes the
   unpicked), so the picker is fully functional. **Live-verified 2026-07-04**: `PUT …{categoryIds:[1]}`
   → 200 with `categoryIds:[1]` read back. The category **definitions/nesting** are owned by
   `categories`; the wizard's intake picker by `submission-wizard-metadata`. <sup>h</sup>
8. **The Issue form honours the published-lock (author hard-locked, editors warned).** The editorial
   config passes `canEdit: permissions.canEditPublication` to the issue `WorkflowPublicationForm`, which
   wires it to the form's submit-enabled state. On a **published** version a manager can still change the
   issue/section/pages behind the warning banner; an author-role user is hard-locked — and never sees the
   tab. The save endpoint enforces the same gate server-side (`editPublication` → `canEditPublication`
   else `api.submissions.403.userCantEdit`). **Live-verified 2026-07-04**: an editor `PUT` on a
   *published* publication → **200** (warn-not-locked). Same wiring as `publication-identifiers` rule 8 /
   `publication-license` rule 10; opposite of the Galleys manager (`galleys` rule 9). <sup>i</sup>
9. **A scheduled article advertises its target issue to dashboards.** Two read-only submission-summary
   props surface where a not-yet-published article is headed: **`issueToBePublished`** = for the latest
   **Scheduled** publication, the issue `{id, label}` it will appear in; **`scheduledIn`** = that
   publication's `issueId` when the submission's status is Scheduled. These drive the "Scheduled in …"
   text on dashboards/lists. They are populated by the publish action's status flip (rule 6), not by
   this form's save. <sup>j</sup>
10. **base-vs-override check — the form is an OJS class; the save path is the shared endpoint.** The
    Issue tab renders the OJS `IssueEntryForm` (`APP\components\forms\publication`, no pkp-lib
    equivalent — OMP uses a catalog-entry form, OPS has none), served by the **OJS**
    `SubmissionController::getPublicationIssueForm()`. It saves through the **shared** pkp-lib
    `PKPSubmissionController::editPublication()` + `publication/Repository` (OJS `validate()` adds the
    section/issue checks over the pkp-lib base). The assignment radio/picker come from the shared-repo
    composable `useWorkflowPublicationFormIssue`, gated `isOJS()`. So the *placement* surface is
    OJS-specific even though its host form component and edit endpoint are shared. <sup>k</sup>
11. **⚠ A section editor / assistant is offered "future issue" options they cannot fulfil — and the same
    403 blanks the Issue picker on *load* for an already-scheduled article.** The assignment radio's
    options are filtered by issue existence only (rule 2), **not by role**, so a section editor or
    assistant with production access sees the two **"Assign To Future Issue…"** options; but the picker
    those options need fetches `GET /issues?isPublished=0`, and the issue-list endpoint restricts
    **unpublished** issues to **managers and site admins** (`IssueController::getMany()` — `$isAdmin` =
    MANAGER/SITE_ADMIN; SUB_EDITOR/ASSISTANT excluded), returning
    **403 "You do not have permission to view unpublished issues."** `useFetch` surfaces that 403 as a
    blocking **"Error"** modal (`modalStore.openDialogNetworkError`) and the required Issue picker stays
    empty. **Two facets** of the one bug:
    **(a) offered-but-unfulfillable** — a non-manager editor who *picks* a future-issue option gets the
    error modal and an empty, un-fillable required Issue picker, so the assignment can't be completed
    through the UI (only *Current/Back* published issues and *Don't Assign* work for them);
    **(b) on-load blanking of a scheduled article** — because `getIssueAssignmentStatus()` resolves any
    **scheduled** publication (and any article placed in / staged for an unpublished/future issue) to a
    future option, the composable *auto-fetches* `/issues?isPublished=0` on load to populate the current
    placement, so a section editor merely **opening** the Issue tab on such an article hits the 403
    immediately — the error modal pops on load and the target-issue picker never fills, so they can't see
    or confirm which future issue the article is scheduled into (the radio itself still renders, with the
    future option pre-selected; only the specific issue is hidden and un-re-selectable). The
    assignment-options / assignment-status surfaces and the issue-list endpoint disagree on who may touch a
    future-issue placement. **Live-verified 2026-07-04 (API + browser)**: dbuskins (sectionEditor)
    `GET /issues/assignmentOptions` → **200** (all four options); `GET /issues?isPublished=1` → 200;
    `GET /issues?isPublished=0` → **403**; a manager gets 200 on all three. Facet (b) reproduced in a real
    browser — opening the **Publication Settings** tab on scheduled submission 583 as dbuskins fired, on
    load, `issueAssignmentStatus` → 200 (`assignmentType 3`) then `/issues?isPublished=0` → **403**,
    popping the **"Error" / "You do not have permission to view unpublished issues."** modal with the
    required Issue picker empty (screenshot captured). See Known deviations (ledger row 94). <sup>l</sup>

<sup>a</sup> `publication_settings`/`publications` (`issueId`, `sectionId`, `pages`, `urlPath`, `datePublished`, `status`, `coverImage`); `publication_categories` (join) ·
<sup>b</sup> `useWorkflowNavigationConfigOJS.js` `getPublicationItemsEditorial()` (`issue` push in `canAccessProduction`; author items omit it); `SubmissionController::getGroupRoutes()` (`roleAuthorizer([SUB_EDITOR, MANAGER, SITE_ADMIN, ASSISTANT])`); live 2026-07-04 (editor 200 / author 401) ·
<sup>c</sup> `IssueAssignment` enum (`NO_ISSUE`/`FUTURE_ISSUES_PUBLISHED`/`FUTURE_ISSUE_SCHEDULED`/`CURRENT_BACK_ISSUES_PUBLISHED`, `getLabel()`, `getIssuePublishStatus()`); `IssueAssignment::getAvailableAssignmentOption()` (filters by `Repo::issue()->getCollector()->filterByPublished(...)->exists()`); `IssueController::getAssignmentOptions()`; `WorkflowPublicationForm.vue` (`issueCount > 0 && isOJS()`); live body 2026-07-04 (4 options) ·
<sup>d</sup> `useWorkflowPublicationFormIssue()` (`assignmentOptions`, `showWhenAssignmentIds` = options with `isPublished !== null`, `issuesQuery` `{isPublished}`, `setHiddenValue('status', option.status)`); `IssueAssignment::getPublicationStatus()` (READY_TO_PUBLISH for 1/2/4, READY_TO_SCHEDULE for 3) ·
<sup>e</sup> `SubmissionController::getIssueAssignmentStatus()`; `publication/Repository::getIssueAssignmentStatus()` (status/issueId/datePublished/issue-published branches); live 2026-07-04 (queued issueless + published → assignmentType 4/status 6) ·
<sup>f</sup> `publication/Repository::validate()` (`sectionId` → `publication.invalidSection`; `issueId` → `publication.invalidIssue`; section abstract/word-count checks); `schemas/publication.json` `required:[sectionId]` ·
<sup>g</sup> `PKPSubmissionController::editPublication()` (`status` null→unset; `!in_array($params['status'], Publication::getPrePublishStatuses())` → 403 `api.publication.403.cantEditStatus`); `Publication::getPrePublishStatuses()` = `[STATUS_READY_TO_PUBLISH=6, STATUS_READY_TO_SCHEDULE=7]`; `Repository::setStatusOnPublish()` (6→PUBLISHED, 7→SCHEDULED, sets datePublished) — owned by publication-publish-flow; `useWorkflowPublicationFormIssue()` (leaves status null when already PUBLISHED/SCHEDULED); live 403 2026-07-04 ·
<sup>h</sup> `schemas/publication.json`/`lib/pkp/schemas/publication.json` `categoryIds` (`readOnly`); `publication/DAO::update()`→`saveCategories()`→`Repo::publication()->assignCategoriesToPublication()`; live 2026-07-04 (categoryIds:[1] persisted) ·
<sup>i</sup> `workflowConfigEditorialOJS.js` `issue.getPrimaryItems` (`canEdit: permissions.canEditPublication`, `issueCount`); `WorkflowPublicationForm.vue` (`canSubmit = canEdit`); `editPublication()` (`canEditPublication` → `api.submissions.403.userCantEdit`); live 2026-07-04 (editor PUT on published → 200) ·
<sup>j</sup> `classes/submission/maps/Schema.php` `getPropertyIssueToBePublished()` (latest STATUS_SCHEDULED publication), `scheduledIn` (issueId when submission STATUS_SCHEDULED); `schemas/submission.json` `issueToBePublished` ·
<sup>k</sup> `IssueEntryForm` (`APP\components\forms\publication`); `SubmissionController::getPublicationIssueForm()` (OJS); `PKPSubmissionController::editPublication()` + `publication/Repository::validate()` (OJS over pkp-lib base); `useWorkflowPublicationFormIssue` (`isOJS()` gate) ·
<sup>l</sup> `IssueAssignment::getAvailableAssignmentOption()` (no role filter); `api/v1/issues/IssueController.php` `getMany()` (`$isAdmin` = MANAGER/SITE_ADMIN → 403 `api.submissions.403.unpublishedIssues` on `isPublished=false` for non-admins); facet (b) trigger `publication/Repository::getIssueAssignmentStatus()` (any SCHEDULED/READY_TO_SCHEDULE → `FUTURE_ISSUE_SCHEDULED`; unpublished issue → `FUTURE_*`) + `useWorkflowPublicationFormIssue()` (`currentAssignmentOption` watcher `await fetchIssues()` when `isPublished !== null`); the 403 → modal via `useFetch()` → `modalStore.openDialogNetworkError()`; `issueOptions` → `[]` on failed fetch; live 2026-07-04 (dbuskins 403 on `isPublished=0`; browser-reproduced on-load error modal on scheduled sub 583); docs/e2e/app-changes.md §2 row 94

## Side effects

- **Data:** saving the tab writes `issueId`, `sectionId`, `pages`, `urlPath`, `datePublished`,
  `coverImage` and a pre-publish `status` (READY_TO_PUBLISH / READY_TO_SCHEDULE) onto the publication,
  and **rewrites `publication_categories`** from the picked category ids (insert picked, delete
  unpicked). No email or notification.
- **Activity log:** every publication edit — including an Issue-tab save — fires the shared **"Metadata
  updated"** activity-log entry against the submission (`event(new MetadataChanged(...))`; the log
  surface is owned by `publication-metadata-references`).
- **At publish (not here):** the staged READY_TO_* status is converted to Published/Scheduled and the
  publication date is set by the Publish action (`setStatusOnPublish()`, owned by
  `publication-publish-flow`); when an **issue** is later published, its attached publications inherit
  the issue's date (owned by `issue-management`).
- **New version:** the placement fields (`issueId`, `sectionId`, `pages`, `urlPath`, categories) copy to
  a new publication version (the version-copy scope is owned by `publication-versioning`).

## Settings that modify behavior

- **Existing issues** (Settings → *Issues*, owned by `issue-management`): whether **published** and/or
  **unpublished (future)** issues exist is what decides which assignment options appear (rule 2) and
  what the issue picker offers (rule 3). With **no issues at all**, the radio/picker are not injected.
- **Journal categories** (Settings → *Categories*, owned by `categories`): defining at least one
  category is what makes the **Categories** field appear on this tab (rule 7); with none defined the
  field is absent.
- **Journal sections** (Settings → Journal → *Sections*, owned by `journal-sections`): populate the
  Section select; inactive sections are shown labelled "(Inactive)".
- **Continuous publication / issue-less publishing**: the *Future / Publish Immediately* and *Don't
  Assign* options exist so an article can go live without waiting for its issue to be published — the
  publish-time semantics are owned by `publication-publish-flow`.

## Cross-feature interactions

- **publication-publish-flow** (feature 32, not yet written) — owns the **Publish / Unpublish /
  Schedule** action and its preconditions: it turns the pre-publish status this tab stages
  (READY_TO_PUBLISH / READY_TO_SCHEDULE) into **Published / Scheduled**, sets the publication date, and
  flips front-end visibility. This spec owns *assigning to an issue and staging the intent*; that spec
  owns *the publish transition* (rule 6).
- **issue-management** (feature 35, not yet written) — owns creating/editing/publishing **issues**
  themselves (back/future lists, TOC, issue cover, current issue) and the `/issues` list endpoints the
  picker reads. This spec owns *assigning a publication to an existing issue*, not managing issues.
- **categories** (feature 63) — owns category **definitions and nesting**; this spec owns *assigning
  those categories to a publication* on the Issue tab (`publication_categories`, rule 7).
- **submission-wizard-metadata** — owns the **intake** category/section pickers (For-the-Editors step);
  this spec is the post-submission re-assignment on the live publication.
- **publication-identifiers** — owns the **identifier rules** for **pages** and **URL path**, which are
  *rendered on this tab* (`publication-identifiers` rules 5, 7). This spec owns the Issue **form** that
  contains those two fields; that spec owns their validation.
- **publication-amendments / publication-versioning** — own the **Update type** + **Summary of changes**
  controls that ride on this form, the `canEditPublication` published-lock this tab honours (rule 8), and
  the per-version copy of the placement fields.
- **article-landing / issue-archive-toc** — the reader surfaces where the assigned issue/section/cover
  are displayed; not editable here.

## Canonical scenarios

1. **Assign to a current/back issue** — Editor: on a queued submission's Publication → **Issue** tab,
   picks **"Assign To Current/Back Issue"**, selects the journal's published issue in the **Issue**
   picker, and saves; the article's `issueId` is set and its status is staged **ready-to-publish**
   (**live-verified**: `PUT {issueId, status:6}` → 200, `issueId` persisted). A later **Publish** turns
   it Published immediately in that issue (publish-flow).
2. **Schedule into a future issue** — Manager: picks **"Assign To Future Issue and Schedule Only"**, and
   the **Issue** picker now offers only **unpublished (future)** issues; selecting one and saving stages
   the status **ready-to-schedule**. The article is not yet public; when the future issue is later
   published (or the article is published as continuous publication), it becomes **Scheduled/Published**.
   The dashboard shows "Scheduled in …" via `issueToBePublished` (rule 9). ⚠ A **section editor/assistant**
   sees the same option but cannot complete it — the future-issue picker returns 403 for non-managers; and
   once an article *is* scheduled, a section editor opening its Issue tab hits that 403 **on load** (an
   "Error" modal + empty picker), so they can't even see which issue it is scheduled into (rule 11, both
   facets / Known deviations).
3. **Don't assign to an issue** — Editor: picks **"Don't Assign To An Issue"**; **no issue picker**
   appears and `issueId` stays empty. Saving stages ready-to-publish; publishing then makes the article
   live **without any issue association** (issue-less/continuous publication, publish-flow). This is also
   the only option offered on a journal that has no issues yet.
4. **Assign section and categories** — Editor: sets the **Section** (required; an inactive section shows
   "(Inactive)") and picks one or more **Categories** from the journal's category tree, then saves; the
   `publication_categories` rows are rewritten to the selection (**live-verified**: `categoryIds:[1]`
   persisted). A section not belonging to the journal is refused ("The section…could not be found").
5. **Set the cover image, pages and URL path** — Editor: uploads a per-publication **Cover Image**,
   enters a **Pages** range ("12-24") and a custom **URL Path** ("on-widgets"), and saves; all persist on
   the selected version. The URL-path validation boundary (all-digit / duplicate refused) is owned by
   `publication-identifiers`.
6. **Published-lock & author boundary** — On a **published** version a manager can still change the
   issue/section/pages behind the "this version is published" warning (warn-not-locked; **live**: editor
   `PUT` on a published publication → 200), while an **author** never sees the Issue tab at all and a
   hand-crafted author request to the issue form or the assignment-status endpoint is refused (**live**:
   atester → **401** on both). Contrast: the Galleys manager does **not** honour the lock (`galleys`
   rule 9); the Issue form does (rule 8).

## Known deviations (as-built ≠ intent)

- ⚠ **The assignment radio offers "future issue" options to section editors/assistants, but the picker
  that fulfils them is manager/site-admin-only — and the same 403 blanks the Issue tab on load for a
  scheduled article** (broken affordance / cross-surface role inconsistency; rule 11).
  `IssueAssignment::getAvailableAssignmentOption()` filters options by issue existence, not by role, so a
  non-manager editorial user is shown the two "Assign To Future Issue…" options; but the issue picker's
  source (`GET /issues?isPublished=0`) refuses unpublished issues to anyone who is not a manager or site
  admin, returning **403 `api.submissions.403.unpublishedIssues`**, which `useFetch` turns into a blocking
  **"Error"** modal. Two facets: **(a)** a non-manager who *picks* a future option gets that modal + an
  empty, un-fillable required Issue picker, so the assignment cannot be completed; **(b)** because
  `getIssueAssignmentStatus()` maps any **scheduled** publication (and any future-issue placement) to a
  future option, the composable auto-fetches the unpublished-issue list on load, so a section editor just
  *opening* the Issue tab on an already-scheduled article gets the error modal **on load** and an empty
  target-issue picker — they cannot see or confirm which future issue it is scheduled into (the radio
  still renders with the future option pre-selected). **Live-verified 2026-07-04 (API + browser)**: dbuskins
  (sectionEditor) got 200 on the options list (all four) but 403 on the unpublished-issue list; a manager
  got 200 throughout; and opening the Publication Settings tab on scheduled submission 583 as dbuskins
  popped the on-load "Error"/"…unpublished issues" modal with the Issue picker empty (screenshot). This is
  a genuine UI/backend disagreement — it contradicts the affordance the radio presents and blocks a section
  editor from even *inspecting* a scheduled article's placement. *Tracked as `docs/e2e/app-changes.md`
  §2 row 94 (either role-filter the future options out for non-managers, or widen the unpublished-issue
  list to assigned section editors/assistants — decide whether future-issue scheduling is intended to be
  manager/admin-only).* Intent adjudication is the maintainer's (Open question 3); the as-built is solid.
- **No other product-level deviation flagged ⚠.** The rest of the Issue tab is internally consistent: the
  issue-picker filtering (`isPublished=0/1` returns the right issues; the `(bool)"false"` string-coercion
  quirk on the list endpoint is not on any UI path — the composable sends integers), the section/issue
  validation, the category persistence (despite the schema's `readOnly` flag — a deliberate DAO
  special-case, not a bug) and the published-lock wiring all agree between UI and backend. The rule-6
  refusal of a direct Published/Scheduled status through the form save is **intended** (that transition
  must go through the publish endpoints), so it is documented as a plain rule + a permissions-row ⚠
  pointer, not a deviation.
- **Author form-endpoint returns 401, not 403** — a hand-crafted author request to `…/_components/issue`
  or `…/issueAssignmentStatus` yields **HTTP 401** (Unauthorized) rather than 403. This is the
  **campaign-wide authenticated-but-unauthorized-role → 401 baseline** (as recorded for
  `publication-license`), **not** an issue-assignment defect — noted once, not flagged ⚠. The UI reality
  is unaffected: the author never sees the tab.

## Open questions

1. **Atom seam — `SCHEMA-submission-ojs` (the `issueToBePublished` / `sectionId` aspect).** The scheduled-
   issue display prop `issueToBePublished` and the OJS `sectionId` prop live on this schema atom, which is
   **already claimed by `send-to-review`** (for its `reviewerSuggestions` aspect). This spec **references**
   it (rule 9) rather than re-claiming — the same field-vs-atom split flagged for
   `publication-identifiers`/`publication-license`. Confirm at grooming that the issue aspect need not
   move. (Bookkeeping only; does not gate verification.)
2. **Atom seam — `API-issue-get-assignment-options`.** This endpoint's atlas hint points at
   `issue-management`, but it exists solely to drive **this** tab's assignment radio (it returns
   placement options for a publication, not issue-management data), so this spec claims it. Confirm at
   grooming when `issue-management` is written that the split (assignment-options here, issue CRUD/list
   there) is intended. Note its role gate is looser (Manager|SubEditor|Assistant|Reviewer|Author) than the
   issue *form* endpoint, so an author gets **200** on the options list (**live-confirmed**) — harmless,
   as it returns only static option labels and the tab itself is unreachable for authors.
3. **Is touching a *future* (unpublished) issue placement intended to be manager/site-admin-only?**
   As-built (rule 11 / Known deviations / ledger row 94), the future-issue options are *offered* to section
   editors/assistants but the picker's unpublished-issue list refuses them (403) — both when they *pick* a
   future option (facet a) and, more surprisingly, when they merely *open* the Issue tab on an
   already-scheduled article (facet b, the on-load fetch). Either the radio/composable should not drive the
   unpublished-issue fetch for non-managers (hide those options and skip the on-load fetch), or the
   unpublished-issue list should admit assigned section editors/assistants (who already reach the Issue
   tab). The maintainer decides which is the intended behaviour; note that facet (b) means the current
   as-built also blocks a section editor from *viewing* a scheduled placement, not just creating one. (As-
   built confirmed live; intent adjudication only.)
4. **Is the empty-issue edge (no radio injected when `issueCount = 0`) the intended UX?** With a journal
   that has zero issues the assignment radio and picker are simply absent and the article is placed
   issue-less by default. As-built confirmed from the composable's `issueCount > 0` guard; intent only.

---

<!-- REFERENCE MATERIAL — provenance and campaign bookkeeping, not product-owner narrative. -->

## Reference — entry points & surfaces

| Entry | Path | Atom |
|-------|------|------|
| Issue ("Publication Settings") tab — form fetch | Workflow → Publication → **Issue** (production-capable editors); `GET api/v1/submissions/{id}/publications/{pubId}/_components/issue` → `IssueEntryForm` (id `issueEntry`) | FORM-issue-entry-form, API-submission-get-publication-issue-form |
| Issue-assignment status (pre-select the radio) | `GET api/v1/submissions/{id}/publications/{pubId}/issueAssignmentStatus` → `{assignmentType, status}` | API-submission-get-issue-assignment-status |
| Assignment options (radio contents) | `GET api/v1/issues/assignmentOptions` → the available `IssueAssignment` options | API-issue-get-assignment-options |
| Issue picker contents | `GET api/v1/issues?isPublished={0|1}` (issue list) | *(owned by issue-management — API-issue-get-many)* |
| Save (persist placement + categories) | `PUT api/v1/submissions/{id}/publications/{pubId}` (shared publication edit) | *(publication edit endpoint — co-used by every Publication tab)* |
| Category assignments storage | `publication_categories` join table | DB-publication_categories |
| Scheduled-issue display prop | `submission.issueToBePublished` / `submission.scheduledIn` | *(schema owned by send-to-review — SCHEMA-submission-ojs; issue aspect referenced)* |

## Reference — code anchors

- **Issue form (OJS)**: `classes/components/forms/publication/IssueEntryForm.php` (`__construct()`
  builds `sectionId`, `categoryIds` (gated on category options), `datePublished`, `updateType`,
  `summaryOfChanges`, `coverImage`, `pages`, `urlPath` in groups placement/publicationTiming/
  versionAndUpdates/display/access); served by `api/v1/submissions/SubmissionController.php`
  `getPublicationIssueForm()` (route `_components/issue`, roles SubEditor|Manager|SiteAdmin|Assistant).
- **Assignment radio + issue picker (injected, Vue)**:
  `lib/ui-library/src/pages/workflow/composables/useWorkflowPublicationFormIssue.js`
  (`createFields()` → `assignment` radio + `issueId` select with `showWhen`; watchers fetch
  `/issues/assignmentOptions`, `/issues?isPublished=`, `…/issueAssignmentStatus`; `setHiddenValue('status', …)`);
  wired in `lib/ui-library/src/pages/workflow/components/publication/WorkflowPublicationForm.vue`
  (`formName === 'issue' && issueCount > 0 && isOJS()` → `initialize()`; `canSubmit = canEdit`);
  nav `.../useWorkflowNavigationConfig/useWorkflowNavigationConfigOJS.js` (`getPublicationItemsEditorial`
  `issue` push inside `canAccessProduction`; `getPublicationItemsAuthor` omits it);
  config `.../useWorkflowConfig/workflowConfigEditorialOJS.js` (`issue.getPrimaryItems`, `canEdit`,
  `issueCount = publicationSettings.countIssues`).
- **Assignment options enum (OJS)**: `classes/issue/enums/IssueAssignment.php`
  (`NO_ISSUE`/`FUTURE_ISSUES_PUBLISHED`/`FUTURE_ISSUE_SCHEDULED`/`CURRENT_BACK_ISSUES_PUBLISHED`;
  `getLabel()`, `getPublicationStatus()`, `getIssuePublishStatus()`, `getAvailableAssignmentOption()`,
  `defaultAssignment()`, `getIssueRequiredOptions()`); endpoint `api/v1/issues/IssueController.php`
  `getAssignmentOptions()`.
- **Assignment-status derivation + status transitions**: `classes/publication/Repository.php`
  `getIssueAssignmentStatus()` (derive current option from status/issueId/datePublished/issue-published),
  `setStatusOnPublish()` (READY_TO_PUBLISH→PUBLISHED, READY_TO_SCHEDULE→SCHEDULED — owned by
  publication-publish-flow), `validate()` (`publication.invalidSection` / `publication.invalidIssue`);
  status endpoint `api/v1/submissions/SubmissionController.php` `getIssueAssignmentStatus()`.
- **Save + status guard + category persistence**:
  `lib/pkp/api/v1/submissions/PKPSubmissionController.php` `editPublication()` (canEditPublication gate;
  `getPrePublishStatuses()` guard → `api.publication.403.cantEditStatus`); `classes/publication/Publication.php`
  `getPrePublishStatuses()` = `[STATUS_READY_TO_PUBLISH=6, STATUS_READY_TO_SCHEDULE=7]`;
  `lib/pkp/classes/publication/DAO.php` `saveCategories()`/`setCategories()`/`deleteCategories()` +
  `Repository::assignCategoriesToPublication()`; `publication_categories` in
  `lib/pkp/classes/migration/install/CategoriesMigration.php`.
- **Display props**: `classes/submission/maps/Schema.php` `getPropertyIssueToBePublished()` + `scheduledIn`;
  `schemas/submission.json` (`issueToBePublished`); `schemas/publication.json` (`required:[sectionId]`,
  `status` `in:1,3,4,5,6,7`, `issueId` nullable).
