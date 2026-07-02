---
name: publication-versioning
scope: Maintain multiple versions of an article's published content — create, label, publish, unpublish and display them
shared: pkp-lib
status: verified
e2e-plans: [publication-versioning, publication-publish-flow, publication-amendments]
atlas-claims: [API-submission-version-publication, API-submission-publish-publication, API-submission-unpublish-publication, API-submission-delete-publication, API-submission-change-version, API-submission-get-next-available-version, API-submission-add-publication, GRID-lib-pkp-modals-publish-publish-handler, EVLOG-SUBM-VER-CRT, EVLOG-SUBM-META-PUB, EVLOG-SUBM-META-UNPUB, NOTIF-submission-new-version, MAIL-publication-version-notify, SCHEMA-publication-pkp, SCHEMA-publication-ojs, DB-publications, FORM-publish-form, LOC-submission-publication-versionStage]
---

# Publication versioning

## Purpose

A submission (article) can be published more than once: as corrections, as a preprint-to-VoR
progression, or as substantive new editions. Each publishable snapshot is a **publication
version** — a full copy of the article's metadata, contributors, galleys and files that has its
own lifecycle status, its own publication date and (optionally) its own DOI. Versioning lets
editors change already-published content without rewriting history: old versions stay readable at
stable URLs, readers are warned when viewing an outdated version, and the "current" version is
always the most mature published one. This spec covers what a version is, who may create/publish/
unpublish one, what a new version inherits, and how versions behave on the reader side.

Permissions are organised **by action** — read one row to see who may do it and under
what condition. The rule column states the product behaviour; how it is enforced — and
the notable case where the dashboard hides controls the API still allows — lives in
**Rules & state** and **Known deviations**, with the ⚠ marks pointing there. Baselines
applying to every row: a **site admin** acts as a manager on any journal they created
(journal creation auto-enrols the admin as a manager); a **recommend-only editor** may
only view, never act; an **anonymous reader** sees only published versions.

| Action | Who may — and when | Anchors |
|--------|--------------------|---------|
| **Create a new version** | • Managers (including those not assigned to the submission)<br>• Assigned section editors and assistants (not recommend-only) — but ⚠ only via the API, no "Create New Version" button is shown to them | useWorkflowPermissions() canPublish; PKPSubmissionController::getGroupRoutes() versionPublication route; StageRolePolicy::effect() |
| **Publish / unpublish / unschedule** | • Managers<br>• Assigned section editors and assistants (not recommend-only) — but ⚠ again only via the API (same hidden-ability gap)<br>• A recommend-only editor — cannot, through any route or button | PKPSubmissionController::$productionStageAccessRoles, getGroupRoutes() publish/unpublish routes, authorize() vs useWorkflowPermissions() canPublish |
| **Edit a version's metadata** | • Managers — any version, including a published one (warned that changes go live)<br>• An author-only user — only while nothing is published or scheduled **and** an editor granted them metadata permission; once any version is published or scheduled, hard-locked out of every version | submission/Repository::canEditPublication(); useWorkflowPermissions() canEditPublication; workflowConfigAuthorOJS.js PublicationConfig.getPrimaryItems (WorkflowPublicationEditDisabled) |
| **Relabel a version's stage/number** (change-version) | • Managers and assigned section editors only<br>• An assistant offered this action is refused | PKPSubmissionController::getGroupRoutes() versionPublication/publish routes (+Assistant) vs changeVersion route (Manager/SubEditor only); e2e publish-flow row 4 |
| **View a published version** (reader) | • Anyone — the current version, and older versions by direct link<br>• Unpublished or scheduled versions are not reachable by the public | pages/article/ArticleHandler::initialize() |
| **Preview an unpublished/scheduled version** | • Editorial staff — on the public article page, shown with a "viewing a preview" notice | ArticleHandler::initialize(); submission/Repository::canPreview(); templates/frontend/objects/article_details.tpl submission.viewingPreview notice |

## Fields & validation

**The "Create New Version" dialog** — the fields the editor fills:

| Field (UI label) | Required? | Rules | Anchor |
|------------------|-----------|-------|--------|
| **Version Source** | Yes (defaults to the latest version) | Which existing version the new one is copied from | useWorkflowVersionForm() (`versionSource`) |
| **Version Stage** | Yes when publishing | Author Original / Published Manuscript Under Review / Version of Record (the JAV stages, ordered AO → PMUR → VoR) | useWorkflowVersionForm() versionStage field; VersionStage enum cases (`versionStage`) |
| **Revision Significance** | Yes | Major or Minor — Minor is disabled until at least one version already exists at the chosen stage | useWorkflowVersionForm() getVersionIsMinorField() (`versionIsMinor`) |

The version **number** is never typed: the system always computes the next free number
(rule 3). In "Send to Text Editor" mode the same dialog instead shows a target-version
picker (an existing unassigned version or "Create New Version"), and the stage/
significance fields appear only for a version that has no stage yet
(useWorkflowVersionForm() getUnassignedVersions()/resetVersionStageValues()). In publish mode ("Review Publishing Details") it
adds the amendment-notice fields (owned by the **publication-amendments** spec) and,
when the journal has issues, the issue-assignment controls
(useWorkflowPublicationFormIssue() createFields()). Re-labelling a version rejects an invalid
stage, while the create dialog silently tolerates one ⚠ (see Known deviations).

**How a version is labelled** to editors and readers: "{stage} {major}.{minor}" — e.g.
"Version of Record 1.0"; a version with no stage yet shows "Unassigned Version
({created date})" (Repository::getVersionString()).

**Underlying data** (reference — drives the rules below, not entered directly): each
version carries its stage, major/minor numbers, the version it was copied from, a
status (Unscheduled/Unpublished, Scheduled, or Published — plus OJS's transient
pre-publish intents), and a first-published date stamped once and never cleared on
unpublish. *Anchors: publication.json `versionMajor`/`versionMinor`/`versionStage` + `sourcePublicationId` properties; PKPPublication::STATUS_* constants; classes/publication/Publication::STATUS_READY_TO_PUBLISH/READY_TO_SCHEDULE constants; classes/publication/Repository::getIssueAssignmentStatus().*

## Rules & state

**Identity & ordering**

1. Each version is a stored publication belonging to one submission. A submission's versions are
   shown in order of maturity: any version not yet assigned a stage comes first (ordered by its
   publication date), then versions are ordered by stage (Author Original, then Published Manuscript
   Under Review, then Version of Record) and by ascending major and minor number
   (`lib/pkp/classes/publication/Collector::getQueryBuilder()` — sorted by `datePublished`, then loaded in
   that order onto the submission at `lib/pkp/classes/submission/DAO::fromRow()`).
2. The **latest** version is the last one in that maturity order. The **current** version — the one a
   reader gets by default — is the most mature *published* version, or simply the latest version when
   nothing is published (`lib/pkp/classes/submission/Repository::getCurrentPublicationIdByPublications()` —
   `current_publication_id`). This pointer is recomputed every time a version is added, published,
   unpublished or deleted (`lib/pkp/classes/publication/Repository::add()/publish()/unpublish()/delete()`).
3. Numbering runs per stage: the first version at a stage is 1.0; a minor revision increments the
   minor number; a major revision increments the major number and resets the minor to 0 — always
   computed from the highest number already in use at that stage
   (`lib/pkp/classes/submission/Repository::getNextAvailableVersion()`).

**Statuses per version**

4. The draft state before publication shows as "Unscheduled" when the version is the current one and
   "Unpublished" otherwise (`WorkflowPublicationVersionControl.vue statusProps` — underlying status
   `QUEUED`).
5. Before the editor confirms a publish, the version can hold one of two transient pre-publish intents
   (OJS only) that record where the editor chose to place it; these are the only statuses an ordinary
   metadata save can set, whereas Scheduled, Published and the draft state are reached only through the
   dedicated publish/unpublish actions (`PKPSubmissionController::editPublication()`,
   `classes/publication/Publication::getPrePublishStatuses()` — `READY_TO_PUBLISH`/`READY_TO_SCHEDULE` vs
   `PUBLISHED`/`SCHEDULED`/`QUEUED`). The issue choice decides which intent is recorded: no issue, a
   back issue, or "publish into a future issue" record the ready-to-publish intent, while "schedule
   into a future issue" records the ready-to-schedule intent
   (`classes/issue/enums/IssueAssignment::getPublicationStatus()`).
6. Confirming the publish resolves the final status (`classes/publication/Repository::setStatusOnPublish()`): a
   recorded ready-to-publish intent becomes Published and a ready-to-schedule intent becomes
   Scheduled; without a recorded intent the issue decides — no issue or an already-published issue
   publishes immediately, while an unpublished issue schedules it. The publication date is stamped with
   the current date only the first time the version becomes Published and only if it had none, so a
   version that was unpublished and republished keeps its original date (`datePublished`).
7. Unpublish (labelled "Unschedule" for a Scheduled version) always returns the version to the draft
   state (`lib/pkp/classes/publication/Repository::unpublish()` — back to `QUEUED`), and the action is
   accepted only from Published or Scheduled (`PKPSubmissionController::unpublishPublication()`). A "declined"
   publication status exists in the constants but nothing in OJS ever sets it on a version — declining
   happens at the submission level (rule 17) (`DECLINED`).
8. A Published version cannot be published again and cannot be deleted — both are refused
   (`PKPSubmissionController::publishPublication()`; `deletePublication()`). Deleting any other version also removes its
   galleys and recomputes the submission's status and which version is current
   (`classes/publication/Repository::delete()`, `lib/pkp/classes/publication/Repository::delete()`).
   There is deliberately no delete control in the interface.

**Creating a version**

9. "Create New Version" copies the chosen source version (the latest by default) into a new version in
   the draft state (`lib/pkp/classes/publication/Repository::version()` — new publication in `QUEUED`):
   - **Copied**: all publication metadata (title, abstract, section, issue assignment, URL path, cover
     image, license/copyright, keywords, categories (`categoryIds`), amendment fields), contributors
     (cloned, with the primary contact remapped, `version()`), citations (`version()`), data citations
     (`version()`), a custom JATS file if one exists (`version()`), publication media files including
     their variant groupings (`version()`), and in OJS all galleys
     (`classes/publication/Repository::version()`).
   - **Reset**: the publication date is cleared, the version starts in the draft state, and it keeps a
     pointer back to the version it was copied from (`version()` — `datePublished` null, `status`
     `QUEUED`, `sourcePublicationId`).
   - **Version label**: bumped per rule 3 using the requested stage and significance; with no request
     it stays at the source's stage as a minor bump, and a source with no stage yields another
     unassigned version (`version()`).
   - **DOI**: kept (shared with the source) — unless journal DOI versioning is enabled *and* the bump
     is major, in which case the publication and galley DOIs are cleared for fresh assignment
     (`version()`, `classes/publication/Repository::version()`).
   - A single review round not yet tied to any publication is attached to the new version (`version()`; `setReviewPublicationAssociations()`).
10. Who may: the create-version capability is open to managers, assigned sub-editors and assistants
    with production access (see the Actors table); the "Create New Version" action appears in the
    interface only for users the dashboard treats as able to publish
    (`useWorkflowNavigationConfigOJS() canPublish` — createNewVersion menu item).
11. The "Send to Text Editor" re-label path is **not** label-only: it validates the full publication
    payload and then runs the generic publication edit, so a request missing required metadata is
    rejected outright (probed live: with no title, the save fails with a "title required" error)
    (`PKPSubmissionController::changeVersion()`).
12. The lookup that computes the next available version number is restricted to managers and
    sub-editors — narrower than the create-version action that consumes the same computation
    (`PKPSubmissionController::getGroupRoutes() getNextAvailableVersion route (Manager/SubEditor)`).

**Editability**

13. For editorial roles a Published version is *warn-locked*, not hard-locked: its panels display
    "Warning: This version has been published. Editing it may impact the published content." yet every
    form stays editable and saves straight to the live version (`workflowConfigEditorialOJS.js PublicationConfig.getPrimaryItems (WorkflowPublicationEditWarning)`,
    banner text `publication.editorEditWarning`). The hard "must create a new version" lock applies only
    to the author dashboard (`workflowConfigAuthorOJS.js PublicationConfig.getPrimaryItems (WorkflowPublicationEditDisabled)`). ⚠ Related: on a published version
    the galley row action reads "View" but opens a fully editable form —
    [app-changes §2 row 22b](../../e2e/app-changes.md).
14. Whether an editorial write is allowed comes down to this: managers and admins may always edit; a
    user whose stage assignments are all author-role is locked out of every version once **any** version
    of the submission is Published or Scheduled — even if an editor had granted them metadata permission
    — and otherwise that granted permission decides (`lib/pkp/classes/submission/Repository::canEditPublication()`
    — `canEditPublication` over `canChangeMetadata`; applied at `PKPSubmissionController::editPublication()`).
15. Publishing any version permanently revokes the author-side metadata-edit permission from every
    author-role assignment on the submission (`PKPSubmissionController::publishPublication()` — `canChangeMetadata`).
16. The control for changing the submission's primary language is offered only while the submission is
    unpublished and has fewer than two versions (`workflowConfigEditorialOJS.js PublicationConfig.getPrimaryControlsLeft (WorkflowChangeSubmissionLanguage)`).

**Publishing a version**

17. Pre-publish validation must pass, or the confirm modal renders the blocking errors with no submit
    button: a declined submission cannot be published
    (`lib/pkp/classes/publication/Repository::validatePublish()`); ORCID problems block it when ORCID is
    enabled (`validatePublish()`); OJS also blocks on an invalid issue selection and on an enabled-but-unpaid
    article processing charge (APC) (`classes/publication/Repository::validatePublish()`); plugins may add
    further checks through a hook (`Publication::validatePublish`). ⚠ Yet the Schedule For Publication
    button is still offered on declined submissions, and the "Review Publishing Details" Confirm persists
    the chosen issue and pre-publish intent *before* this validation runs; a late fetch can also
    overwrite the chosen issue — [app-changes §2 row 23](../../e2e/app-changes.md).
18. Publishing through the interface is a two-step chain: if the version has no stage yet, or is not
    already holding a pre-publish intent, the "Review Publishing Details" form runs first (persisting
    stage, significance, issue intent and amendment fields through the generic edit endpoint); then a
    legacy confirm modal states the consequence — back-issue publish, continuous publication into a
    future issue, issueless publish, or schedule — and submits the publish action
    (`useWorkflowActions() workflowScheduleForPublication()`, `lib/pkp/controllers/modals/publish/PublishHandler::publish()`,
    `classes/components/forms/publication/PublishForm::__construct()`). ⚠ The related Issue-entry
    ("Publication Settings") form refuses to save *anything* until its required Issue radio is answered
    — [app-changes §2 row 26](../../e2e/app-changes.md).
19. A version published without a stage is auto-assigned the next major **Version of Record** number,
    and the confirm modal announces the exact label beforehand
    (`lib/pkp/classes/publication/Repository::publish()`, `classes/publication/Publication::DEFAULT_VERSION_STAGE`,
    `PublishForm::__construct()`).
20. When a version first becomes Published, any empty copyright holder, copyright year and license URL
    are filled from the journal defaults (`lib/pkp/classes/publication/Repository::publish()`).
21. Issue actions cascade to the versions assigned to them: publishing a not-yet-published issue
    publishes every Scheduled version in it
    (`classes/controllers/grid/issues/IssueGridHandler::publishIssue()`); unpublishing an issue returns its
    Published versions to Scheduled rather than to the draft state, by running an
    unpublish-then-republish on each (`unpublishIssue()`).

**Effect on the submission**

22. The submission's own status is derived from its versions: if any version is Published the
    submission is Published; otherwise if any is Scheduled it is Scheduled; otherwise it is unpublished;
    a declined submission stays Declined regardless
    (`lib/pkp/classes/submission/Repository::getStatusByPublications()`). Unpublishing a version and creating or
    deleting one all trigger this recompute (`lib/pkp/classes/publication/Repository::unpublish()`).
23. A submission left with **zero** versions derives the status Declined — the recompute treats an
    empty submission as mid-deletion (`lib/pkp/classes/submission/Repository::getStatusByPublications()`).
24. ⚠ **Known mismatch**: the publish *endpoint* skips that recompute and hard-codes the submission to
    Published even when the version only became Scheduled — so a UI-scheduled article lands in the
    dashboard "Published" view and never in "Scheduled" (`PKPSubmissionController::publishPublication()`;
    [app-changes §2 row 18](../../e2e/app-changes.md)). Seed and CLI paths that go through the
    publication publish method alone (`Repo::publication()->publish()`) compute both the version and the
    submission as Scheduled correctly.
25. OJS also keeps OAI tombstones in step as the submission's status flips — clearing them when it
    becomes Published and creating them when it leaves Published, so OAI harvesters see the change
    (`classes/submission/Repository::updateStatus()`).

**Reader side**

26. The plain article URL always shows the **current** version; a request whose path segment doesn't
    match the current version's preferred identifier (its URL path or submission id) is redirected to it
    (`pages/article/ArticleHandler::initialize()`). A `/article/view/{id}/version/{publicationId}` URL
    addresses one specific version, and an unknown version id gives a not-found page (`initialize()`).
27. A non-published version is not reachable by the public (they get a not-found page); a user with
    preview rights — editorial and subscription-manager roles, or assigned participants, and never on an
    incomplete submission — sees it instead with a "viewing a preview" notice
    (`ArticleHandler::initialize()` — `canPreview`; `article_details.tpl submission.viewingPreview notice`).
28. Viewing an outdated version (published but no longer current) shows the "outdated version" notice
    linking to the newest version, and the page carries a no-index instruction plus a canonical link to
    the current URL (`article_details.tpl submission.outdatedVersion notice`, `ArticleHandler::view()`).
29. The article landing page lists only **published** versions in its "Versions" list, newest first,
    each entry showing its date and version label; the current one links to the plain article URL and
    older ones to their `/version/{id}` URLs (`article_details.tpl submission.versions section`,
    `lib/pkp/classes/submission/PKPSubmission::getPublishedPublications()`). The "Published" line shows the
    first-published date, adding "Updated on …" once later versions exist (`article_details.tpl submissions.published/updatedOn item`).
30. Unpublishing the current version moves the current pointer back to the most mature remaining
    published version (rule 2): readers see that earlier version again and the unpublished one drops out
    of the versions list; if no published version remains, the article gives readers a not-found page. A
    galley URL that survives only on an outdated version redirects to the current article page
    (`ArticleHandler::initialize()`).

**DOIs per version**

31. With journal DOI versioning **off**: every version shares the source's DOI; publishing marks the
    DOIs stale (due for re-deposit) only when the published version is the current one, and unpublishing
    does so only when the unpublished version was current
    (`lib/pkp/classes/publication/Repository::publish()/unpublish()`). A version that has no DOI of its own
    shows the current version's DOI to readers (`ArticleHandler::view()`).
32. With DOI versioning **on**: major versions receive fresh DOIs (rule 9); publishing a major version
    marks all of the submission's DOIs stale, while publishing or unpublishing a minor version marks its
    DOIs stale only when it is (or was) the highest published minor within its major (`publish()/unpublish()`);
    a reader falls back to a sibling minor version's DOI (`ArticleHandler::view()`). Fresh DOIs are
    minted at publish time when the journal is set to mint at publication
    (`lib/pkp/classes/observers/listeners/VersionDois::handlePublishedEvent()`).

## Side effects

- **Create version**: an activity-log entry "New version created" is recorded — attributed to the
  real user even when someone is impersonating them
  (`lib/pkp/classes/publication/Repository::version()` — `publication.event.versionCreated`, type
  `CREATE_VERSION`). Every user assigned to the submission receives a task-level notification and,
  unless they have blocked that email type, the new-version notification email
  (`PKPSubmissionController::createNewPublicationVersionAndNotify()` — `SUBMISSION_NEW_VERSION`, `PublicationVersionNotify`).
- **Publish**: an activity-log "published" or "scheduled" entry (worded as "version
  published/scheduled" once more than one version exists)
  (`lib/pkp/classes/publication/Repository::publish()`); publishing triggers a search-index update
  (`UpdateSubmissionInSearchIndex::handlePublicationPublished()`), an ORCID deposit (`SendSubmissionToOrcid::handle()`) and
  DOI minting (`VersionDois::handlePublishedEvent()`) via the publish event (`PublicationPublished`); author
  metadata grants are revoked (rule 15); DOI staleness follows rules 31-32.
- **Unpublish**: an activity-log "unpublished" entry (or "version unpublished") (`unpublish()`) and a
  search re-index (`UpdateSubmissionInSearchIndex::handleUnpublished()` — `PublicationUnpublished` event); OAI
  tombstones are created when the submission leaves Published (rule 25).
- **Metadata edit on any version**: an activity-log "metadata updated" entry (`edit()`).

## Settings that modify behavior

- **DOI versioning** (a journal DOI setting) — switches DOI inheritance and staleness between rules
  31 and 32 (`lib/pkp/classes/context/Context::SETTING_DOI_VERSIONING` — `doiVersioning`).
- **DOIs enabled, with a creation time other than "never"** — enables the publish-time DOI minting
  above (`VersionDois::handlePublishedEvent()`).
- **Publication fee (APC)** enabled with an amount above zero — blocks publishing any version until
  the fee is paid (`classes/publication/Repository::validatePublish()`).
- **ORCID enabled** — adds the ORCID pre-publish checks (`lib/pkp/classes/publication/Repository::validatePublish()`).
- **Journal has no issues** — the publish form hides the issue-assignment fields and submits with no
  issue and the ready-to-publish intent (`useWorkflowVersionForm() handleVersionSubmission()` — issueId null,
  `READY_TO_PUBLISH`).
- **Notification opt-outs** — let each user block the new-version email (`PKPSubmissionController::createNewPublicationVersionAndNotify()`).

## Cross-feature interactions

- **publication-amendments** owns the amendment-notice fields (the "what changed" notice); they ride
  the publish-mode version form here and are copied to new versions like any other metadata
  (`updateType` / `summaryOfChanges`).
- **issue-assignment-scheduling** owns issue selection and issue publish/unpublish; rules 5-6 and 21
  define only the version-status consequences.
- **doi-management** owns DOI registration and deposit; rules 31-32 define only the version-boundary
  behavior.
- **galleys** owns galley management; the galley cloning on version-create is rule 9.
- **submission-workflow / decisions** owns the declined state; rule 17 consumes it.
- **activity-log** and **notifications** consume the side effects listed above.
- ⚠ The order in which an issue's table of contents lists a submission's published versions is
  undefined, because the ordering field is never stamped (`publications.seq`) — owned by the issue TOC
  feature; [app-changes §2 row 28](../../e2e/app-changes.md).

## Canonical scenarios

1. **Correct a published article** — Editor (dbarnes): on a published Version of Record 1.0, chooses
   Create New Version (Version of Record, minor) → a draft "Version of Record 1.1" appears in the
   Publication menu as "Unpublished" with all metadata and galleys copied; the editor fixes the title
   and publishes. The reader now gets 1.1 at the plain article URL, while 1.0 stays reachable from the
   Versions list at its `/version/{id}` URL and shows the outdated-version notice.
2. **Schedule into a future issue** — Editor: Schedule For Publication on an unpublished version →
   Review Publishing Details (stage Version of Record, "schedule into a future issue") → Confirm → the
   final modal says it will be scheduled → the version becomes Scheduled with Preview and Unschedule
   buttons, and readers still get a not-found page. Publishing the issue then flips it to Published with
   the issue's date. ⚠ The dashboard wrongly files the submission under "Published" the whole time
   (row 18).
3. **Roll back the latest version** — Editor: unpublishes the second version (confirm dialog) → it
   returns to the draft state (shown as "Unscheduled", since it is no longer current), the current
   pointer falls back to the first version, the reader page shows that first version with no notice, and
   the rolled-back one vanishes from the version list; unpublishing the first version too makes the
   article not-found for readers and re-creates its OAI tombstone.
4. **Author locked out by publication** — Author who was granted metadata permission: once any version
   is published or scheduled, every metadata save is refused, even on draft versions. The explanatory
   "cannot be edited" panel appears only when the *selected* version is Published
   (`workflowConfigAuthorOJS.js PublicationConfig.getPrimaryItems (WorkflowPublicationEditDisabled)`) — so on a scheduled-only submission the author's forms are
   locked with no panel explaining why. The editor's own panels show only the yellow edit warning and
   remain editable.
5. **Blocked publish** — Editor on a declined submission (or one with an unpaid APC): Schedule For
   Publication is still clickable; the confirm modal lists the blocking requirement and offers no commit
   button, so the publication stays unpublished — but the Review Publishing Details step has already
   persisted the pre-publish intent and issue choice (row 23b).
6. **Version numbering ladder** — Editor: in the create-version dialog on a submission with only
   Version of Record 1.0, choosing Author Original disables "Minor" (no Author Original exists yet, so
   it becomes 1.0); Version of Record + minor yields 1.1; a later Version of Record + major yields 2.0;
   and publishing an unassigned version auto-assigns the next major Version of Record after announcing
   it in the confirm text.

## Known deviations (as-built ≠ intent)

- ⚠ Rule 24 — publish endpoint hard-codes submission status PUBLISHED while the publication is
  SCHEDULED: [app-changes §2 row 18](../../e2e/app-changes.md).
- ⚠ Rule 13 — published galley "View" opens an editable form: [row 22b](../../e2e/app-changes.md).
- ⚠ Rule 17/18 — declined submissions keep the Schedule button; Confirm persists issueId+status
  pre-validation; late fetch can overwrite the issue radio: [row 23](../../e2e/app-changes.md).
- ⚠ Rule 18 — Issue-entry form blocks all saves on the required Issue field: [row 26](../../e2e/app-changes.md).
- ⚠ `publications.seq` never stamped → undefined TOC order: [row 28](../../e2e/app-changes.md).
- ⚠ **VERIFIED REAL (live-probed)** — UI/API publish-authority mismatch: the dashboard shows
  publish/unpublish/create-version controls only when the user's production-stage roles include
  Manager/Site Admin (`useWorkflowPermissions() canPublish`), but the API authorizes assigned
  sub-editors *and assistants* (non-recommend-only) for the same operations
  (`PKPSubmissionController::$productionStageAccessRoles, getGroupRoutes() version/publish routes`). Probed: a section editor with `canPublish=false`
  in the UI got 200 on `POST …/version`, `PUT …/publish` and `PUT …/unpublish`. Ledger row being
  added — [app-changes §2 (wave: product-spec pilot)](../../e2e/app-changes.md).
- ⚠ **VERIFIED REAL (live-probed, minor)** — `POST …/version` silently ignores an invalid
  `versionStage` value (`VersionStage::tryFrom` → null → inherits the source's stage; probed:
  `"BOGUS"` → 200) while `PUT …/version` correctly 422s the same input
  (`PKPSubmissionController::versionPublication()` vs `validateVersionStage()`). Ledger row being added —
  [app-changes §2 (wave: product-spec pilot)](../../e2e/app-changes.md).
- ⚠ **VERIFIED REAL (live-probed, companion)** — an invalid `versionIsMinor` value (e.g.
  `"banana"`) on `POST …/version` returns a 500: `FILTER_NULL_ON_FAILURE` yields null, which is
  passed into a `bool`-typed parameter → TypeError
  (`PKPSubmissionController::versionPublication(), validateVersionIsMinor()`). Ledger row being added —
  [app-changes §2 (wave: product-spec pilot)](../../e2e/app-changes.md).

## Open questions

1. Is the dashboard's manager/admin-only gate on publish/version controls intended, given the API
   (and the legacy 3.4 UI) let assigned non-recommend-only sub-editors publish? (Known deviations,
   verified-real publish-authority mismatch — one-word answer decides which side to fix.)
2. Is it intended that republishing a previously published version keeps its original
   `datePublished` (only stamped when empty — rule 6), even after months unpublished?
3. `Publication::STATUS_DECLINED` (4) appears in the schema/constants but nothing in OJS assigns it
   to a publication — reserved for OPS/OMP, or dead in OJS?
4. Version delete exists API-only (rule 8). Is a delete UI intentionally withheld (audit-trail
   argument), or missing?
5. Should the new-version copy reset amendment fields (`updateType`, `summaryOfChanges`) instead of
   inheriting the previous version's notice verbatim (rule 9 "Copied")? Today an editor must
   remember to rewrite them at publish time.

---

<!-- REFERENCE MATERIAL — provenance and campaign bookkeeping, not product-owner
     narrative. The PO-facing "where do I find this" is in Purpose. -->

## Reference — entry points & surfaces

| Entry | Path | Atom |
|-------|------|------|
| "Create New Version" menu action | Dashboard → submission workflow → Publication side-menu (visible when `canPublish`) | — |
| "Schedule For Publication" / "Publish" button chain | Workflow → Publication → primary controls (status QUEUED/READY_*) → "Review Publishing Details" side modal → legacy publish confirm modal | GRID-lib-pkp-modals-publish-publish-handler, FORM-publish-form |
| "Preview" button (reader preview of the selected version) | Workflow → Publication → primary controls; shown for QUEUED/READY_* versions once the submission passed external review, and always for SCHEDULED (`workflowConfigEditorialOJS.js:794-801,824-828`) | — |
| "Unpublish" / "Unschedule" buttons | Workflow → Publication → primary controls (status PUBLISHED / SCHEDULED respectively) | — |
| "Send to Text Editor" (version-targeting mode of the same form) | Workflow → file row dropdown; targeting an existing unassigned version with a stage choice submits `PUT …/version` — see change-version row | — |
| Create version API | `POST api/v1/submissions/{submissionId}/publications/{publicationId}/version` | API-submission-version-publication |
| Add publication API (blank first publication, no UI) | `POST …/submissions/{submissionId}/publications` | API-submission-add-publication |
| Publish / unpublish APIs | `PUT …/publications/{publicationId}/publish`, `PUT …/unpublish` | API-submission-publish-publication, API-submission-unpublish-publication |
| Change version label API | `PUT …/publications/{publicationId}/version` (manager/sub-editor only) — also a **live UI path**: the Send-to-Text-Editor form submits here when re-labelling an existing unassigned version (`useWorkflowVersionForm.js:136` uses method PUT); an assistant offered that flow is rejected (401) | API-submission-change-version |
| Next-available-version API | `GET …/submissions/{submissionId}/nextAvailableVersion?versionStage=&versionIsMinor=` | API-submission-get-next-available-version |
| Delete version API (no UI) | `DELETE …/publications/{publicationId}` | API-submission-delete-publication |
| Reader: current version | `/article/view/{urlPath-or-id}` | — |
| Reader: specific version | `/article/view/{urlPath-or-id}/version/{publicationId}[/{galleyId}]` | — |
| Issue publish/unpublish (transitively publishes/re-schedules versions) | Backend → Issues → Future/Back issues grid | — |

Route/role gates: all publication sub-routes require submission access; version/publish/unpublish/
delete/add additionally require manager|sub-editor|assistant with a non-recommend-only production-stage
assignment (unassigned managers pass) (`PKPSubmissionController.php:99-162,270-297,398-446`).

## Reference — code anchors

- Core lifecycle: `lib/pkp/classes/publication/Repository.php` (version 372-501, publish 568-707,
  unpublish 737-829, delete 841-859, updateVersion 867-883, versionString 889-912)
- OJS specializations: `classes/publication/Repository.php` (galley copy 151-172, setStatusOnPublish
  188-227, validatePublish 125-148, issue-assignment status 316-369); `classes/publication/Publication.php`
- Status/pointer derivation: `lib/pkp/classes/submission/Repository.php:535-574,728-765,918-948,1387-1441`
- API: `lib/pkp/api/v1/submissions/PKPSubmissionController.php` (routes 99-393, changeVersion
  1032-1069, versionPublication 1270-1304, editPublication 1309-1394, publish 1403-1467, unpublish
  1472-1507, delete 1515-1548, notify 2502-2556)
- Schema: `lib/pkp/schemas/publication.json`; version value object
  `lib/pkp/classes/publication/helpers/PublicationVersionInfo.php`; `classes/publication/enums/VersionStage.php`
- UI: `lib/ui-library/src/pages/workflow/composables/{useWorkflowVersionForm,useWorkflowPermissions,useWorkflowActions,useWorkflowPublicationFormIssue}.js`,
  `useWorkflowConfig/workflowConfigEditorialOJS.js:719-853`, `components/publication/WorkflowPublicationVersionControl.vue`
- Publish confirm: `lib/pkp/controllers/modals/publish/PublishHandler.php`, `classes/components/forms/publication/PublishForm.php`
- Reader: `pages/article/ArticleHandler.php:105-198,209-440`, `templates/frontend/objects/article_details.tpl:76-401`
- Issue interplay: `classes/controllers/grid/issues/IssueGridHandler.php:595-727`, `classes/issue/enums/IssueAssignment.php`
