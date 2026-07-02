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

## Actors & permissions

| Actor | Can | Cannot | Anchor |
|-------|-----|--------|--------|
| Journal manager / Site admin (incl. unassigned managers) | See publish/unpublish/unschedule buttons and the "Create New Version" menu action; call all version APIs; edit any version incl. published ones (warning banner only) | Publish if their only production-stage assignment is recommend-only | `lib/ui-library/src/pages/workflow/composables/useWorkflowPermissions.js:79-87`, `lib/pkp/api/v1/submissions/PKPSubmissionController.php:270-297`, `lib/pkp/classes/security/authorization/StageRolePolicy.php:91-115` |
| Section editor (sub-editor), assigned to production, not recommend-only | Call the version/publish/unpublish/delete APIs; change a publication's version label (`changeVersion`); edit versions | See the publish/unpublish buttons or Create New Version action in the dashboard (UI gate is manager/admin-only) — see Known deviations (new) | `PKPSubmissionController.php:149-162,270-297,421-423` vs `useWorkflowPermissions.js:79-87` |
| Assistant (e.g. layout editor), assigned to production | Call the version/publish/unpublish/delete APIs (same route group as editors); edit versions if granted metadata permission | See any publish/unpublish/version-create controls in the UI; call `changeVersion` (manager/sub-editor route) | `PKPSubmissionController.php:270-297` vs `:261-267`; e2e publish-flow row 4 |
| Author (assigned in author role only) | Edit publication metadata while nothing is published/scheduled *and* an editor granted `canChangeMetadata` | Edit **any** version once any publication of the submission is published or scheduled (hard block, API and UI); create/publish/unpublish versions | `lib/pkp/classes/submission/Repository.php:535-574` (blocked at `:551-562`), `useWorkflowPermissions.js:53-65`, author hard-lock panel `workflowConfigAuthorOJS.js:289-297` |
| Recommend-only editor (any role) | View | Publish/unpublish/version via API (stage-role policy passes `allowRecommendOnly=false`) or UI (`canPublish=false`) | `PKPSubmissionController.php:421-423`, `useWorkflowPermissions.js:79-87` |
| Reader (anonymous) | View published versions, current or outdated, incl. per-version URLs | See unpublished/scheduled versions (404) | `pages/article/ArticleHandler.php:153-156` |
| Editorial staff as reader (canPreview) | Preview an unpublished/scheduled version on the reader page (with "viewing preview" notice) | — | `ArticleHandler.php:153-156`, `lib/pkp/classes/submission/Repository.php:580-589`, `templates/frontend/objects/article_details.tpl:78-83` |

## Entry points

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

## Fields & validation

**Version identity on the publication** (`lib/pkp/schemas/publication.json:478-506,352`):

| Field | Type | Notes |
|-------|------|-------|
| `versionStage` | enum `AO` / `PMUR` / `VoR` | JAV-standard stage (Author Original, Published Manuscript Under Review, Version of Record); maturity order AO < PMUR < VoR (`classes/publication/enums/VersionStage.php:19-41`). Nullable: "Unassigned Version" until first publish or explicit assignment (`lib/pkp/classes/publication/Repository.php:889-912`) |
| `versionMajor` / `versionMinor` | int | Default 1 / 0 (`lib/pkp/classes/publication/helpers/PublicationVersionInfo.php:23-29`) |
| `versionString` | computed | "{stage label} {major}.{minor}"; unassigned renders "Unassigned Version ({created date})" (`Repository.php:889-912`) |
| `sourcePublicationId` | int | The version this one was copied from (`publication.json:352-355`) |
| `status` | int | 1 QUEUED, 3 PUBLISHED, 4 DECLINED, 5 SCHEDULED (`lib/pkp/classes/publication/PKPPublication.php:35-38`); OJS-only transient pre-publish intents: 6 READY_TO_PUBLISH, 7 READY_TO_SCHEDULE (`classes/publication/Publication.php:29-44`) |
| `datePublished` | date | Stamped on first real publish if empty; **not cleared on unpublish** (used to infer prior publication for issue-assignment defaults, `classes/publication/Repository.php:322-345`) |

**Create-version dialog** (`lib/ui-library/src/pages/workflow/composables/useWorkflowVersionForm.js`):

- `versionSource` (select of existing versions; defaults to the latest publication, `:296-305,370-373`) — the copy source.
- `versionStage` (select AO/PMUR/VoR; required in publish mode, `:309-319`).
- `versionIsMinor` "Revision significance" (select Major/Minor; **Minor is disabled when no version
  exists yet at the chosen stage**, `:195-242`; API default is minor=true, `PKPSubmissionController.php:2353-2360`).
- In "Send to Text Editor" mode an extra `sendToVersion` select targets an existing version or
  "Create New Version"; stage/significance fields appear only for versions with no stage assigned (`:286-294,244-263`).
- In publish mode ("Review Publishing Details") the same form adds `updateType` + `summaryOfChanges`
  (owned by the **publication-amendments** spec) and, when the journal has issues, the issue-assignment
  radio + issue select with a hidden `status` (`:106-128,331-368`; `useWorkflowPublicationFormIssue.js:95-127`).

**Validation**: `changeVersion` requires a valid `versionStage` value (422 otherwise,
`PKPSubmissionController.php:2337-2351`); the create-version endpoint tolerates an invalid stage
string by silently inheriting the source's stage (`:1289-1294` — see Known deviations, new).
Numbering is never user-typed: the system always computes the next free number (rule 3).

## Rules & state

**Identity & ordering**

1. A version is a row in `publications` belonging to one submission; a submission's versions are
   ordered by maturity: unassigned-stage first (by `datePublished`), then stage (AO < PMUR < VoR),
   then major ASC, minor ASC (`lib/pkp/classes/publication/Collector.php:215-228`, loaded in that
   order onto the submission at `lib/pkp/classes/submission/DAO.php:211-218`).
2. **Latest** = last publication in that maturity order. **Current** (`submissions.current_publication_id`)
   = the most mature *published* version, or the latest version when nothing is published
   (`lib/pkp/classes/submission/Repository.php:1422-1441`). The pointer is recomputed on every
   add/publish/unpublish/delete (`lib/pkp/classes/publication/Repository.php:359,633,763,856`).
3. Version numbering per (stage): first version at a stage gets {major.minor} = 1.0; a minor bump
   increments minor; a major bump increments major and resets minor to 0 — always computed from the
   highest existing number at that stage (`lib/pkp/classes/submission/Repository.php:918-948`).

**Statuses per version**

4. QUEUED is the unpublished/draft state; it displays as "Unscheduled" when the version is the
   current publication and "Unpublished" otherwise (`WorkflowPublicationVersionControl.vue:31-57`).
5. READY_TO_PUBLISH / READY_TO_SCHEDULE (OJS only) record the editor's issue-assignment intent
   before the final publish confirm; they are the only statuses settable through the generic edit
   endpoint — PUBLISHED/SCHEDULED/QUEUED are reachable only via the publish/unpublish endpoints
   (`PKPSubmissionController.php:1342-1354`, `classes/publication/Publication.php:38-44`). The
   intent maps: no-issue/back-issue/future-issue-publish → READY_TO_PUBLISH; future-issue-schedule
   → READY_TO_SCHEDULE (`classes/issue/enums/IssueAssignment.php:44-52`).
6. Publish resolves the final status (`classes/publication/Repository.php:188-227`):
   READY_TO_PUBLISH → PUBLISHED; READY_TO_SCHEDULE → SCHEDULED; otherwise by issue — no issue or
   published issue → PUBLISHED, unpublished issue → SCHEDULED. `datePublished` is stamped with the
   current date only when the version becomes PUBLISHED and had none (so a republished version keeps
   its original date).
7. Unpublish (also labelled "Unschedule" for SCHEDULED versions) always returns the version to
   QUEUED (`lib/pkp/classes/publication/Repository.php:737-741`); the API accepts it only from
   PUBLISHED or SCHEDULED (`PKPSubmissionController.php:1489-1493`). DECLINED exists as a
   publication status constant but no code path in OJS sets it; decline is enforced at the
   submission level (rule 17).
8. A PUBLISHED version cannot be published again (403, `PKPSubmissionController.php:1421-1425`) and
   cannot be deleted (403, `:1533-1537`); deleting any other version also deletes its galleys and
   recomputes submission status/current pointer (`classes/publication/Repository.php:230-241`,
   `lib/pkp/classes/publication/Repository.php:841-859`). There is deliberately no delete UI.

**Creating a version**

9. "Create New Version" copies the chosen source version (default: latest) into a new QUEUED
   publication (`lib/pkp/classes/publication/Repository.php:372-501`):
   - **Copied**: all publication metadata (title, abstract, section, issue assignment, urlPath,
     coverImage, license/copyright, keywords, categories via `categoryIds`, amendment fields),
     contributors (cloned, primary contact remapped, `:417-429`), citations (`:406-413`), data
     citations (`:432-438`), a custom JATS file if one exists (`:443-449`), publication media files
     incl. variant groupings (`:451-481`), and in OJS all galleys (`classes/publication/Repository.php:151-172`).
   - **Reset**: `datePublished` → null, `status` → QUEUED, `sourcePublicationId` → source's id (`:374-378`).
   - **Version label**: bumped per rule 3 using the requested stage+significance; with no request it
     stays at the source's stage as a minor bump; a source with no stage yields another unassigned
     version (`:382-395`).
   - **DOI**: kept (shared with the source) — unless journal DOI versioning is enabled *and* the bump
     is major, in which case publication and galley DOIs are cleared for fresh assignment (`:402-404`,
     `classes/publication/Repository.php:158-166`).
   - A single review round not yet tied to any publication is attached to the new version (`:483,1244-1269`).
10. Who: the create-version API is open to managers/sub-editors/assistants with production access
    (rule table); the UI action is shown only when `canPublish` (`useWorkflowNavigationConfigOJS.js:262-268`).
11. Re-labelling an existing version (`PUT …/version`) is **not** label-only: the endpoint
    validates the full publication payload and finishes by running the generic publication edit, so
    a request that omits required metadata fails outright (probed live: no title → 400 "title
    required") (`PKPSubmissionController.php:1053-1068`).
12. The next-available-version lookup route is restricted to managers/sub-editors — narrower than
    the create-version route that consumes the same computation
    (`PKPSubmissionController.php:265-267`).

**Editability**

13. Published is *warn-locked*, not hard-locked, for editorial roles: the panels of a PUBLISHED
    version show "Warning: This version has been published. Editing it may impact the published
    content." but every form stays editable and saves to the live version
    (`workflowConfigEditorialOJS.js:727-735`, banner text `publication.editorEditWarning`). The hard
    "must create a new version" lock applies to the author dashboard only
    (`workflowConfigAuthorOJS.js:289-297`). ⚠ Related: the galley row action on a published version
    says "View" but opens a fully editable form — [app-changes §2 row 22b](../../e2e/app-changes.md).
14. API edit gate: `canEditPublication` — managers/admins always may; any user whose stage
    assignments are exclusively author-role is refused once **any** version of the submission is
    PUBLISHED or SCHEDULED, even with `canChangeMetadata`; otherwise `canChangeMetadata` decides
    (`lib/pkp/classes/submission/Repository.php:535-574`, applied at `PKPSubmissionController.php:1328-1337`).
15. Publishing any version permanently revokes `canChangeMetadata` from all author-role stage
    assignments of the submission (`PKPSubmissionController.php:1442-1451`).
16. Changing the primary language of the submission is offered only while the submission is not
    published and has fewer than two publications (`workflowConfigEditorialOJS.js:745-757`).

**Publishing a version**

17. Pre-publish validation must pass (else 400 / confirm modal renders errors with no submit
    button): declined submissions cannot be published (`lib/pkp/classes/publication/Repository.php:280-283`);
    ORCID problems when ORCID is enabled (`:286-298`); OJS adds invalid issue id and an
    enabled-but-unpaid publication (APC) fee (`classes/publication/Repository.php:125-148`);
    plugins may add more via hook (`Publication::validatePublish`). ⚠ The Schedule-for-Publication
    button itself is still offered on declined submissions and the "Review Publishing Details"
    Confirm persists `issueId`+READY_* status *before* this validation runs; the issue radio can
    also be overwritten by a late fetch — [app-changes §2 row 23](../../e2e/app-changes.md).
18. UI publish is a two-step chain: if the version has no stage or is not in a READY_* status, the
    "Review Publishing Details" form runs first (persisting stage/significance, issue intent and
    amendment fields via the generic edit endpoint); then the legacy confirm modal states the
    consequence — back-issue publish / continuous publication into a future issue / issueless
    publish / schedule — and submits `PUT …/publish` (`useWorkflowActions.js:86-162`,
    `lib/pkp/controllers/modals/publish/PublishHandler.php:88-120`, `classes/components/forms/publication/PublishForm.php:57-124`).
    ⚠ The related Issue-entry ("Publication Settings") form refuses to save *anything* until its
    required Issue radio is answered — [app-changes §2 row 26](../../e2e/app-changes.md).
19. A version publishing without a stage is auto-assigned the next major **VoR** version; the
    confirm modal announces the exact string beforehand (`lib/pkp/classes/publication/Repository.php:613-619`,
    `classes/publication/Publication.php:33`, `PublishForm.php:91-106`).
20. On becoming PUBLISHED, empty copyright holder/year and license URL are filled from journal
    defaults (`lib/pkp/classes/publication/Repository.php:578-611`).
21. Scheduling interplay with issues: publishing a not-yet-published issue publishes every
    SCHEDULED version assigned to it (`classes/controllers/grid/issues/IssueGridHandler.php:595-625`);
    unpublishing an issue runs unpublish+republish on its PUBLISHED versions so they return to
    SCHEDULED, not QUEUED (`:710-727`).

**Effect on the submission**

22. Submission status is derived from its versions: any PUBLISHED version → submission PUBLISHED;
    else any SCHEDULED → submission SCHEDULED; else QUEUED; a DECLINED submission stays DECLINED
    regardless (`lib/pkp/classes/submission/Repository.php:1387-1416`). Unpublish and version
    create/delete use this recompute (`lib/pkp/classes/publication/Repository.php:756-765`).
23. A submission left with **zero** publications derives status DECLINED (the recompute treats it
    as mid-deletion) (`lib/pkp/classes/submission/Repository.php:1396-1399`).
24. ⚠ **Known mismatch**: the publish *endpoint* bypasses the recompute and hard-codes the
    submission to PUBLISHED even when the version only became SCHEDULED — so UI-scheduled articles
    land in the dashboard "Published" view and never in "Scheduled" (`PKPSubmissionController.php:1440,1456`;
    [app-changes §2 row 18](../../e2e/app-changes.md)). Seed/CLI paths through
    `Repo::publication()->publish()` alone compute SCHEDULED/SCHEDULED correctly.
25. OJS adds tombstone bookkeeping on submission status flips (delete tombstones on becoming
    PUBLISHED, create them on leaving it) for OAI harvesters (`classes/submission/Repository.php:106-129`).

**Reader side**

26. `/article/view/{id}` always shows the **current** publication; a request whose path segment
    doesn't match the current publication's best id (urlPath or submission id) is redirected to it
    (`pages/article/ArticleHandler.php:127-151`). `/article/view/{id}/version/{publicationId}`
    addresses a specific version; unknown version ids 404 (`:137-147`).
27. Non-published versions 404 for readers; users passing `canPreview` (editorial/subscription-manager
    roles or assigned participants; never for incomplete submissions) see them with a "viewing
    preview" notice (`ArticleHandler.php:153-156`, `article_details.tpl:78-83`).
28. Viewing an outdated (published, non-current) version shows the "outdated version" notice
    linking to the newest version, and emits `noindex` + a canonical link to the current URL
    (`article_details.tpl:84-93`, `ArticleHandler.php:373-378,418-421`).
29. The landing page lists **published** versions only ("Versions" list, newest first, each entry
    "{date} ({version string})"); the current one links to the plain URL, older ones to `/version/{id}`
    URLs (`article_details.tpl:381-399`, `lib/pkp/classes/submission/PKPSubmission.php:141-151`).
    The "Published" item shows first-published date plus "Updated on" for later versions (`:365-379`).
30. Unpublishing the current version moves the current pointer back to the most mature remaining
    published version (rule 2): readers see that version again and the unpublished one drops out of
    the version list; if nothing published remains, the article 404s for readers. Galley URLs that
    survive only on an outdated version redirect to the current article page (`ArticleHandler.php:171-184`).

**DOIs per version**

31. With journal DOI versioning **off**: all versions share the source DOI; on publish, DOIs are
    marked stale (for re-deposit) only when the published version is the current one; on unpublish,
    only when the unpublished version was current (`lib/pkp/classes/publication/Repository.php:686-694,802-805`).
    The reader page of a DOI-less version falls back to the current version's DOI (`ArticleHandler.php:252-262`).
32. With DOI versioning **on**: major versions get fresh DOIs (rule 9); publishing a major version
    marks all the submission's DOIs stale (relationship updates), publishing/unpublishing a minor
    version marks its DOIs stale only when it is (was) the highest published minor of its
    major (`:660-685,779-801`); the reader falls back to a sibling minor version's DOI (`ArticleHandler.php:254-256`).
    New DOIs are minted on publish when the journal mints at publication time (`lib/pkp/classes/observers/listeners/VersionDois.php:39-55`).

## Side effects

- **Create version**: event-log entry `publication.event.versionCreated` (type CREATE_VERSION,
  impersonation-aware user id) (`lib/pkp/classes/publication/Repository.php:489-498`); TASK-level
  notification `SUBMISSION_NEW_VERSION` to every user assigned to the submission plus the
  `PublicationVersionNotify` email to each of them unless they blocked that email type
  (`PKPSubmissionController.php:2502-2556`).
- **Publish**: event-log `publication.event.published|scheduled`, or `…versionPublished|versionScheduled`
  when more than one version exists (`lib/pkp/classes/publication/Repository.php:637-654`);
  `PublicationPublished` event → search index update (`UpdateSubmissionInSearchIndex.php:49-52`),
  ORCID deposit (`SendSubmissionToOrcid.php:38`), DOI minting (`VersionDois.php:39-55`); author
  metadata grants revoked (rule 15); DOI staleness per rules 31-32.
- **Unpublish**: event-log `publication.event.unpublished` / `…versionUnpublished`
  (`:767-816`); `PublicationUnpublished` event → search re-index (`UpdateSubmissionInSearchIndex.php:43-47`);
  tombstones when the submission leaves PUBLISHED (rule 25).
- **Metadata edit on any version**: event-log `submission.event.general.metadataUpdated` (`:536-546`).

## Settings that modify behavior

- **DOI versioning** (`doiVersioning`, journal DOI settings; `lib/pkp/classes/context/Context.php:47`)
  — flips DOI inheritance/staleness between rules 31 and 32.
- **DOIs enabled + creation time** — publish-time minting only when enabled and not "never"
  (`VersionDois.php:44-52`).
- **Publication fee (APC)** enabled with amount > 0 — blocks publish of any version until paid
  (`classes/publication/Repository.php:139-145`).
- **ORCID enabled** — adds ORCID pre-publish checks (`lib/pkp/classes/publication/Repository.php:286-298`).
- **Journal has no issues** — the publish form skips the issue-assignment fields and submits
  issueId null + READY_TO_PUBLISH (`useWorkflowVersionForm.js:111-123`).
- **Notification opt-outs** — per-user blocking of the new-version email (`PKPSubmissionController.php:2531-2541`).

## Cross-feature interactions

- **publication-amendments** owns `updateType` / `summaryOfChanges` semantics (fields ride the
  publish-mode version form here; copied to new versions like any metadata).
- **issue-assignment-scheduling** owns issue selection UX and issue publish/unpublish; rules 5-6, 21
  define only the version-status consequences.
- **doi-management** owns DOI registration/deposit; rules 31-32 define only version-boundary behavior.
- **galleys** owns galley management; galley cloning on version-create is rule 9.
- **submission-workflow / decisions** owns declined state; rule 17 consumes it.
- **activity-log**, **notifications**: consume the side effects listed above.
- ⚠ Issue TOC ordering of published versions is undefined (`publications.seq` never stamped) —
  owned by issue TOC feature; [app-changes §2 row 28](../../e2e/app-changes.md).

## Canonical scenarios

1. **Correct a published article** — Editor (dbarnes): on a published VoR 1.0, chooses Create New
   Version (VoR, minor) → draft VoR 1.1 appears in the Publication menu as "Unpublished" with all
   metadata/galleys copied; editor fixes the title and publishes. Reader now gets 1.1 at the plain
   article URL; 1.0 stays reachable from the Versions list at its `/version/{id}` URL and shows the
   outdated-version notice.
2. **Schedule into a future issue** — Editor: Schedule For Publication on a QUEUED version →
   Review Publishing Details (stage VoR, future-issue-schedule intent) → Confirm → final modal says
   it will be scheduled → version becomes SCHEDULED with Preview/Unschedule buttons; readers still
   404. Publishing the issue flips it to PUBLISHED with the issue's date. ⚠ The dashboard wrongly
   files the submission under "Published" the whole time (row 18).
3. **Roll back the latest version** — Editor: unpublishes v2 (confirm dialog) → v2 returns to
   QUEUED ("Unscheduled", it is no longer current), the current pointer falls back to v1, the reader
   page shows v1 with no notice and v2 vanishes from the version list; unpublishing v1 too makes the
   article 404 and re-creates its OAI tombstone.
4. **Author locked out by publication** — Author with `canChangeMetadata`: once any version is
   published or scheduled, every metadata API write returns 403, even for draft versions. The
   explanatory "cannot be edited" panel renders only when the *selected* version is PUBLISHED
   (`workflowConfigAuthorOJS.js:289-297`) — on a scheduled-only submission the author's forms are
   locked with no panel explaining why. The editor's own panels show only the yellow edit warning
   and remain editable.
5. **Blocked publish** — Editor on a declined submission (or with an unpaid APC): Schedule For
   Publication is still clickable; the confirm modal lists the blocking requirement and offers no
   commit button; the publication stays unpublished — but the Review Publishing Details step has
   already persisted READY_* + issue choice (row 23b).
6. **Version numbering ladder** — Editor: create-version dialog on a submission with VoR 1.0 only:
   choosing AO disables "Minor" (no AO exists → AO 1.0); VoR+minor yields 1.1; a later VoR+major
   yields 2.0; publishing an unassigned version auto-assigns the next major VoR after announcing it
   in the confirm text.

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
  Manager/Site Admin (`useWorkflowPermissions.js:79-87`), but the API authorizes assigned
  sub-editors *and assistants* (non-recommend-only) for the same operations
  (`PKPSubmissionController.php:149-162,270-297`). Probed: a section editor with `canPublish=false`
  in the UI got 200 on `POST …/version`, `PUT …/publish` and `PUT …/unpublish`. Ledger row being
  added — [app-changes §2 (wave: product-spec pilot)](../../e2e/app-changes.md).
- ⚠ **VERIFIED REAL (live-probed, minor)** — `POST …/version` silently ignores an invalid
  `versionStage` value (`VersionStage::tryFrom` → null → inherits the source's stage; probed:
  `"BOGUS"` → 200) while `PUT …/version` correctly 422s the same input
  (`PKPSubmissionController.php:1289-1294` vs `:2337-2351`). Ledger row being added —
  [app-changes §2 (wave: product-spec pilot)](../../e2e/app-changes.md).
- ⚠ **VERIFIED REAL (live-probed, companion)** — an invalid `versionIsMinor` value (e.g.
  `"banana"`) on `POST …/version` returns a 500: `FILTER_NULL_ON_FAILURE` yields null, which is
  passed into a `bool`-typed parameter → TypeError
  (`PKPSubmissionController.php:1292-1294,2353-2360`). Ledger row being added —
  [app-changes §2 (wave: product-spec pilot)](../../e2e/app-changes.md).

## Code anchors

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
