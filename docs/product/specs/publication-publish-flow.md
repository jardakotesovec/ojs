---
name: publication-publish-flow
scope: Publish, schedule, unpublish, unschedule and republish an article version — the confirm-and-commit action that flips a publication between the editorial workflow and the public reader site
shared: pkp-lib               # the publish/unpublish action, the PublishHandler confirm modal, the PublishForm, the API endpoints and the status/Done-stage machinery are all pkp-lib (lib/pkp), shared with OMP/OPS; the OJS specialisations are setStatusOnPublish (issue-aware), validatePublish (issue + APC), the OAI tombstone side of updateStatus, PublishSubmissions and the reader flip. Spec'd from the OJS angle.
status: verified
e2e-plans: [publication-publish-flow, publication-versioning, issue-assignment-scheduling]
atlas-claims:
  - TASK-publishsubmissions
---

# Publication — Publish / unpublish / schedule flow (the publish ACTION)

## Purpose

Every article reaches readers through one deliberate act: an editor confirms that a
**publication version** is ready and commits it. This spec owns that act — the **Publish /
Schedule For Publication / Unpublish / Unschedule** buttons on the workflow **Publication**
tab, the confirmation modal they open, the API that carries out the transition, the
**preconditions** that can block it, the **status transitions** (draft → *Scheduled* →
*Published* and back), and the **front-end visibility flip** it produces (a published article
appears on the reader site and in the issue table of contents; an unpublished one becomes a
not-found page plus an OAI "deleted" tombstone). Publishing a Version of Record also carries the
submission across the finish line into the **Done** workflow stage; unpublishing the last one
brings it back. This spec does **not** own the version lifecycle (create/copy a version), the
**Review Publishing Details** form that stages *where* the article goes, or the Done-stage
decision engine — those are referenced.

Permissions are organised **by action**. Recurring terms and baselines, stated once:
**editorial roles** = journal **managers** (including those not assigned to the submission, and
a **site admin** acting as a manager on any journal they created), assigned **section editors**
(sub-editors) and **assistants** (production assistants). A **recommend-only** editor may never
publish. An **author-role** user may never publish, and publishing any version permanently
strips authors of their metadata-edit grant. An **anonymous reader** ever only sees *Published*
versions. One cross-cutting oddity governs the whole table and is owned by
`publication-versioning` (its verified-real publish-authority finding), referenced here rather
than re-narrated: **the dashboard shows the publish/unpublish controls only to
managers/site-admins, but the API authorises assigned non-recommend-only sub-editors and
assistants for the same operations** — so those users can publish by API with no button. <sup>a</sup>

| Action | Who may — and when |
|--------|--------------------|
| **Publish now** (button: *Schedule For Publication* on the first version, *Publish* on later ones) | • Managers / site admins — via the button, any version not already Published<br>• Assigned section editors & assistants (not recommend-only) — ⚠ API-only, **no button is shown to them** (deviation owned by versioning)<br>• A recommend-only editor, an author — never <sup>a</sup> |
| **Schedule** into a future (unpublished) issue | • Same as *Publish now* — the same button and modal; the outcome is *Scheduled* instead of *Published* because of the staged intent / issue (rule 6). Staging the future-issue placement is owned by issue-assignment (and is itself manager/admin-gated — its rule 11) <sup>b</sup> |
| **Unpublish** a Published version / **Unschedule** a Scheduled one | • Managers / site admins — via the *Unpublish* / *Unschedule* button (same endpoint; label differs by status)<br>• Assigned section editors & assistants (not recommend-only) — ⚠ API-only, same button gap<br>• Recommend-only, author — never <sup>c</sup> |
| **Republish** a previously-unpublished version | • Same roles as *Publish now* — a version returned to draft can be published again; it keeps its original publication date (rule 14) <sup>d</sup> |
| **See the confirm modal / the blocking-requirements list** | • Managers, site admins, assigned sub-editors and assistants — the `PublishHandler` modal admits those four roles **by role-id**; an author (holding none of them) cannot open it at all. The modal adds **no** recommend-only carve-out of its own — a recommend-only sub-editor is kept away from publishing by the missing button and the publish-API gate (<sup>a</sup>), not by this read-only confirm surface <sup>e</sup> |
| **Auto-publish** a Scheduled article when its date arrives (scheduled task) | • The system (CLI/cron) — ⚠ but the OJS scheduler does **not** register `PublishSubmissions`, and OJS scheduled articles carry no future publish date, so this path is effectively inert in OJS (rule 15) <sup>f</sup> |
| **View a Published article** (reader) | • Anyone — the current version, and older versions by direct link<br>• A *Scheduled* / *Unpublished* version is not public (editorial staff get a preview instead) — owned by article-landing / versioning <sup>g</sup> |

<sup>a</sup> `useWorkflowActions() workflowScheduleForPublication()` (opens `modals.publish.PublishHandler`); button visibility `useWorkflowConfig/workflowConfigEditorialOJS.js` (`publication.publish` / `editor.submission.schedulePublication`) gated by `useWorkflowPermissions() canPublish`; API gate `PKPSubmissionController::$productionStageAccessRoles` + `getGroupRoutes()` publish route; the UI/API mismatch is versioning's verified-real deviation ·
<sup>b</sup> `Repository::setStatusOnPublish()` (READY_TO_SCHEDULE → SCHEDULED); the future-issue staging + its own manager gate are `publication-issue-assignment` rules 3 & 11 ·
<sup>c</sup> `useWorkflowActions() workflowUnpublishPublication()` / `workflowUnschedulePublication()` (both PUT `…/unpublish`); labels `publication.unpublish` / `publication.unschedule`; API gate as above; `PKPSubmissionController::unpublishPublication()` ·
<sup>d</sup> `PKPSubmissionController::publishPublication()` (refuses only STATUS_PUBLISHED); `Repository::publish()` keeps `datePublished` when already set ·
<sup>e</sup> `PublishHandler::__construct()` role assignment `[SUB_EDITOR, MANAGER, SITE_ADMIN, ASSISTANT]` on op `publish` (author role-excluded); `authorize()` adds only `SubmissionAccessPolicy` + `PublicationAccessPolicy` — **no** recommend-only or `StageRolePolicy` filter, so the recommend-only publish gate is the button (`canPublish`) + the publish API (`StageRolePolicy(productionStageAccessRoles, PRODUCTION, false)`), per <sup>a</sup>, not the modal ·
<sup>f</sup> `PKP\task\PublishSubmissions::executeActions()`; **absent** from both `APP\scheduler\Scheduler::registerSchedules()` and `PKP\scheduledTask\PKPScheduler::registerSchedules()` (re-verified 2026-07-04: grep of the whole PHP tree finds the class name only in its own docblock; no `scheduledTasks.xml`), and live DB shows 0/19 SCHEDULED publications carry a `date_published` — [app-changes §2 row 95](../../e2e/app-changes.md) ·
<sup>g</sup> `pages/article/ArticleHandler::initialize()` (owned by article-landing / versioning rule 27); live 2026-07-04 — a freshly-published submission's `/article/view/{id}` returns **200** and renders `obj_article_details`

## Fields & validation

The publish **confirmation modal** (`PublishHandler` → `PublishForm`) is a *confirm* surface, not
a data-entry form: its only field is a block of HTML (`FieldHTML 'validation'`) whose text and
whether a submit button appears are computed from the publication's staged status and its
pre-publish validation. There is nothing for the user to type here — the *placement* choices
(issue, section, stage, amendment notice) were made on the **Review Publishing Details** step
that runs first, owned by `publication-issue-assignment` / `publication-versioning`.

| What the modal shows | When | Rules | Anchor |
|----------------------|------|-------|--------|
| **A submit button** labelled *Publish* or *Schedule For Publication*, under a confirmation sentence | Only when every pre-publish requirement passes | Label is *Schedule For Publication* for a ready-to-schedule intent, *Publish* otherwise; the sentence is chosen by the staged intent + issue (rule 3) | `PublishForm::__construct()` (`empty($requirementErrors)` branch, `submitButton`) |
| **The blocking-requirements list** — "The following requirements must be met before this can be published." + a bulleted list, and **no submit button** | When any requirement fails | Renders each `validatePublish` error; the page has no submit button, so the editor cannot commit (rule 4) | `PublishForm::__construct()` (`else` branch); `publication.publish.requirements` |
| **A non-blocking warnings banner** — yellow "The following issues were found, but will not prevent publishing" + list, above the submit button | When `validatePublishWarnings` returns anything | Warnings do **not** remove the submit button; publishing proceeds | `PublishHandler::publish()` (`$warnings`); `publish.tpl` (`publishWarnings`); `publication.publish.warning` |
| **A version-stage announcement** — the exact label the version will receive | When the version has no JAV stage yet | Publishing an un-staged version auto-assigns the next **Version of Record** number and the modal states it beforehand (rule 8) | `PublishForm::__construct()` (`publication.required.versionStage.assignment`) |

The confirmation sentence itself, per staged intent (all begin "All publication requirements
have been met."): a **back issue** → "…published immediately in {issue}…"; a **future issue,
publish immediately** → "…published immediately as continuous publication even though it is
assigned to {issue} which is not published yet…"; **no issue** → "…published immediately without
any issue association…"; a **future issue, schedule only** → "…published when {issue} is
published…" with the *Schedule For Publication* button. *(anchors: `PublishForm::__construct()`;
`publication.publish.confirmation{,.backIssue,.continuousPublication,.issueLess,.futureIssue}`)*

## Rules & state

The publication's lifecycle status is one integer (`PKPPublication::STATUS_*`): **Queued** (1,
the draft state, shown as *Unpublished*/*Unscheduled*), **Published** (3), **Declined** (4),
**Scheduled** (5), and the two transient OJS **pre-publish intents** **Ready-to-publish** (6)
and **Ready-to-schedule** (7) that the Review-Publishing-Details save stages. Only the publish
and unpublish actions move a publication into Published/Scheduled or back to Queued; an ordinary
metadata save can set only the two intents (guarded — owned by issue-assignment rule 6). <sup>a</sup>

**The publish action (UI)**

1. **Publishing is a two-step chain.** The *Schedule For Publication* / *Publish* button first
   runs the **Review Publishing Details** side-form (staging version stage, significance, issue
   intent and amendment fields — owned by `publication-issue-assignment` /
   `publication-versioning` rule 18) when needed, then opens the legacy **confirm modal**
   (`modals.publish.PublishHandler`) that states the consequence and submits the publish. On a
   version already holding a pre-publish intent the chain goes straight to the confirm modal.
   *(anchor: `useWorkflowActions() workflowScheduleForPublication()`; `PublishHandler::publish()`)*
2. **The entry button reflects the status.** *Schedule For Publication* on the first (un-staged)
   version, *Publish* on a version once the submission is Published; *Unpublish* replaces it on a
   Published version, *Unschedule* on a Scheduled one. Unpublish and Unschedule are the **same
   endpoint** with different confirm-dialog copy. *(anchor: `workflowConfigEditorialOJS.js`
   `publication.publish` / `editor.submission.schedulePublication` / `publication.unpublish` /
   `publication.unschedule`; `useWorkflowActions() workflowUnpublishPublication()/workflowUnschedulePublication()`)*

**Preconditions (what blocks a publish)**

3. **The confirm modal validates before offering to commit.** `PublishHandler::publish()` runs
   `validatePublish`; a non-empty result renders the blocking list with no submit button (Fields
   table). *(anchor: `PublishHandler::publish()` → `PublishForm`)*
4. **`validatePublish` blocks on:** a **declined** submission ("A declined submission can not be
   published."); **ORCID** problems when ORCID is enabled (an author's unauthenticated or
   duplicate ORCID); an **invalid issue** selection; and, OJS-specific, an enabled **article
   processing charge (APC)** that has not been paid. Plugins may add checks via a hook. Warnings
   (`validatePublishWarnings`, hook-only) are surfaced but never block.
   *(anchor: `PKP\publication\Repository::validatePublish()` — declined/ORCID/`Publication::validatePublish` hook; `APP\publication\Repository::validatePublish()` — issue + `OJSPaymentManager` APC)*
   ⚠ The *Schedule For Publication* button is still offered on a declined submission, and the
   Review-Publishing-Details **Confirm persists the chosen issue + intent *before* this
   validation runs** — so a blocked publish still leaves the staged placement behind (row 23b,
   owned by versioning rule 17).

**The publish/unpublish API + status recompute**

5. **Publish endpoint.** `PUT …/publications/{id}/publish` verifies the publication belongs to
   the submission, **refuses a re-publish of an already-Published version** (403
   `api.publication.403.alreadyPublished`), re-runs `validatePublish` (400 with the error list on
   failure), then commits via `Repo::publication()->publish($publication, false)`. It passes
   **`false`** so the core publish does not itself set the submission status; the controller then
   **re-fetches the submission and recomputes**: `Repo::submission()->updateStatus($submission)`
   (derive the correct submission status from its versions) **+ `updateCurrentPublication()`**.
   *(anchor: `PKPSubmissionController::publishPublication()`)* This recompute is the **row-18
   fix** (pkp/pkp-lib#12799, 2026-06-28): a UI-scheduled article now computes **Scheduled** and
   files under the dashboard "Scheduled" view instead of being hard-coded to Published — see
   versioning rule 24. [app-changes §2 row 18](../../e2e/app-changes.md) (FIXED).
6. **`setStatusOnPublish` resolves the final status.** A staged **ready-to-publish** intent
   becomes **Published**; **ready-to-schedule** becomes **Scheduled**. Without an intent the
   issue decides: **no issue** or an **already-published** issue → Published; an **unpublished
   (future)** issue → Scheduled. The **publication date** is stamped with the current date only
   when the status becomes Published *and* the version has no date yet — so a republished version
   keeps its original date (rule 14). *(anchor: `APP\publication\Repository::setStatusOnPublish()`)*
   **Live-verified 2026-07-04**: a scenario publish stamped publication 326 as *Published*, VoR
   1.0, `datePublished` = today.
7. **Publish fills empty license/copyright from journal defaults.** When a version first becomes
   Published, an empty copyright holder, copyright year or license URL is filled from the
   journal's defaults (the publish-time snapshot; detail owned by `publication-license`).
   *(anchor: `PKP\publication\Repository::publish()` — `_getContextLicenseFieldValue`)*
8. **Publishing an un-staged version auto-assigns a Version of Record stage.** A version with no
   JAV stage is given the next major *Version of Record* number at publish, announced in the
   confirm modal first (Fields table). *(anchor: `PKP\publication\Repository::publish()`;
   `Publication::DEFAULT_VERSION_STAGE`)* Owned jointly with `publication-versioning` (rule 19).
9. **Unpublish endpoint.** `PUT …/publications/{id}/unpublish` accepts a publication **only from
   Published or Scheduled** (else 403 `api.publication.403.alreadyUnpublished`) and calls
   `Repo::publication()->unpublish()`, which returns the version to the **Queued** draft state
   and recomputes the submission status + current publication. The first-published date is **not**
   cleared. *(anchor: `PKPSubmissionController::unpublishPublication()`; `PKP\publication\Repository::unpublish()`)*

**Submission status + the Done-stage transition**

10. **The submission status is derived from its versions** (any Published → submission
    *Published*; else any Scheduled → *Scheduled*; else unpublished; declined stays Declined) —
    owned by `publication-versioning` rule 22. *(anchor: `PKP\submission\Repository::getStatusByPublications()`)*
11. **Publishing a Version of Record moves the submission to Done; unpublishing the last one
    returns it.** An event listener fires on every publish/unpublish: if the submission now has
    ≥1 Published Version-of-Record and is not already in **Done**, it records a **Move to Done**
    decision (stage 6); if it drops to zero Published VoRs while in Done, it records a **Return
    to Workflow** decision. The decision mechanics are owned by `editorial-decisions`; this action
    is only the trigger. *(anchor: `PKP\observers\listeners\ApplyDoneWorkflowStage::handle()` on
    `PublicationPublished`/`PublicationUnpublished`; auto-registered by directory discovery in
    `EventServiceProvider`)* **Live-verified 2026-07-04**: publishing submission 305 left it at
    `stage_id = 6` (Done) with a recorded `decision = 33` (Move to Done, from stage 1).

**The front-end visibility flip**

12. **Publish makes the article public; unpublish hides it and drops an OAI tombstone.** A
    Published version's article page and issue-TOC entry become reader-visible; a Scheduled or
    Unpublished version's public article URL is a **not-found** page (editorial staff see a
    preview instead). As the submission's status crosses the Published boundary, OJS keeps **OAI
    tombstones** in step: it **deletes** the submission's tombstone when it becomes Published and
    **inserts** an article tombstone when it leaves Published, so OAI harvesters see a "deleted"
    record. The reader pages themselves are owned by `article-landing` / `issue-archive-toc`; the
    tombstone read side by `oai-sitemap-feeds`. *(anchor: `ArticleHandler::initialize()`;
    `APP\submission\Repository::updateStatus()` → `ArticleTombstoneManager::insertArticleTombstone()` /
    `DataObjectTombstoneDAO::deleteByDataObjectId()`)* **Live-verified 2026-07-04**: the
    just-published article returned **HTTP 200** and rendered; a non-published id gives 404.
13. **`accessStatus` is a per-article open-access flag, not a publish-modal choice.** A
    publication carries `accessStatus` — **0** = *use the issue's access setting* (the default),
    **1** = *open access* regardless of the issue. It is set on the issue **Table of Contents**
    grid, not in the publish flow, and governs subscription/open-access gating on subscription
    journals. This action only carries the field through. *(anchor: `schemas/publication.json`
    `accessStatus`; `Submission::ARTICLE_ACCESS_ISSUE_DEFAULT`/`ARTICLE_ACCESS_OPEN`; set via
    `TocGridHandler::setAccessStatus()` — owned by `issue-archive-toc` / `subscriptions`)*

**Issue-driven publishing, republish, and the scheduled task**

14. **Republish keeps the original date.** Publishing a version that was previously Published and
    then unpublished (now Queued) re-publishes it; because the publish date is stamped only when
    empty (rule 6), the version keeps its **original** `datePublished` even after a long time
    unpublished. The content side of a republish (amendment notice / summary of changes) is owned
    by `publication-amendments`. *(anchor: `PKP\publication\Repository::publish()`)*
15. **The `PublishSubmissions` scheduled task is effectively inert in OJS.** The task would, per
    context, load every **Scheduled** submission whose current publication's `datePublished` has
    arrived and publish it. But it is **not registered** in the OJS scheduler
    (`Scheduler::registerSchedules()` / `PKPScheduler::registerSchedules()`), and OJS scheduled
    articles carry **no** future `datePublished` (it is stamped only on becoming Published, rule
    6) — so nothing drives date-based auto-publish in OJS. In OJS a *Scheduled* article instead
    goes live when its **issue is published** (the issue action publishes every Scheduled version
    in it — owned by `publication-versioning` rule 21 / `issue-management`). ⚠ See Known
    deviations. **Re-verified live 2026-07-04**: the class name appears nowhere in the PHP tree
    except its own docblock (registered in no scheduler; no `scheduledTasks.xml`), and 0 of 19
    SCHEDULED publications in the test DB carry a `date_published` — [app-changes §2 row 95](../../e2e/app-changes.md).
    *(anchor: `PKP\task\PublishSubmissions::executeActions()`; absent from both `registerSchedules()`)*

## Side effects

On **publish** (`PublicationPublished` event + inline work):
- **Status & stage**: submission status recomputed (rule 10); a **Move to Done** decision may be
  recorded (rule 11) — which itself is an editorial-decisions side effect (its own log entry).
- **Activity log**: a "published" / "scheduled" entry (worded "version published/scheduled" once
  more than one version exists) — attributed to the impersonated user when relevant. *(owned by
  publication-versioning; `SUBMISSION_LOG_METADATA_PUBLISH`)*
- **Search index** re-index, **ORCID** deposit, **DOI** minting/staleness — via the publish event
  (owned by versioning rules 31-32 / doi-management).
- **Author grants revoked**: every author-role stage assignment loses `canChangeMetadata`
  permanently. *(anchor: `PKPSubmissionController::publishPublication()`)*
- **OAI tombstone** cleared when the submission becomes Published (rule 12).
- **No email or bell notification is sent by the publish action itself** — the new-version
  notification email belongs to *creating* a version (versioning), not to publishing one.

On **unpublish** (`PublicationUnpublished` event):
- Submission status recomputed; a **Return to Workflow** decision may be recorded (rule 11);
  activity-log "unpublished" entry; search re-index; DOI staleness; an **OAI tombstone inserted**
  when the submission leaves Published (rule 12).

The **scheduled task**, when run manually, dispatches a `MetadataChanged` event per published
submission after publishing it. *(anchor: `PublishSubmissions::executeActions()`)*

## Settings that modify behavior

- **Publication fee / APC** (Payments enabled + a publication fee amount) — blocks publishing any
  version until the fee is paid (rule 4). *(anchor: `OJSPaymentManager::publicationEnabled()`)*
- **ORCID enabled** — adds the ORCID pre-publish checks (rule 4).
- **Journal license/copyright defaults** — supply the values snapshotted at publish (rule 7;
  owned by `publication-license` / distribution-settings).
- **DOIs enabled + a creation time other than "never" / DOI versioning** — drive DOI minting and
  staleness at publish (owned by versioning / doi-management).
- **Journal has no issues** — the publish form submits with no issue and the ready-to-publish
  intent, so the article publishes issue-less (owned by issue-assignment).
- **Subscription journal + `accessStatus`** — govern whether a published article is open or gated
  (rule 13; owned by subscriptions / issue-archive-toc).

## Cross-feature interactions

- **publication-versioning** — owns the version lifecycle (create/copy/label/delete a version),
  the reader version display, and the **shared publish atoms** (`FORM-publish-form`,
  `GRID-lib-pkp-modals-publish-publish-handler`, `API-submission-publish/unpublish-publication`,
  `SCHEMA-publication-{pkp,ojs}`, `DB-publications`) which it claimed in the pilot; this spec
  **references** them and owns the publish/unpublish **action** they implement. Rules 6, 8, 10,
  11, 15 restate a version-status consequence versioning also states — the shared fact is stated
  once there. The **UI/API publish-authority mismatch** and **row-18/row-23b** are versioning's
  deviations, referenced here.
- **publication-issue-assignment** — owns the **Review Publishing Details** / "Publication
  Settings" step that stages `issueId` + the pre-publish intent (ready-to-publish vs
  ready-to-schedule); this spec owns the **commit** that turns that intent into
  Published/Scheduled (rule 6). It also owns the manager-only gate on *future-issue* placement
  (its rule 11).
- **editorial-decisions** — owns the **Move to Done / Return to Workflow** decision engine that
  this action triggers on publish/unpublish (rule 11).
- **publication-license** — owns the publish-time default snapshot of empty license/copyright
  fields (rule 7).
- **publication-amendments** — owns the "what changed" notice on a **republish** (rule 14).
- **article-landing** / **issue-archive-toc** — own the reader article page and issue TOC; this
  spec owns the publish→visible / unpublish→not-found **flip** onto them (rule 12) and the
  `accessStatus` field they consume (rule 13).
- **oai-sitemap-feeds** — owns the OAI feed and the tombstone read surface; this action is what
  **writes** the tombstones (rule 12).
- **doi-management** — owns DOI registration/deposit; this action fires the publish/unpublish
  events that mark DOIs stale.
- **issue-management** — owns publishing an **issue**, which transitively publishes its Scheduled
  versions (rule 15).

## Canonical scenarios

1. **Publish an article — it appears to readers** — Editor (dbarnes): on an unpublished
   submission's Publication tab, *Schedule For Publication* → **Review Publishing Details** (a
   current/back issue) → **Confirm** ("All publication requirements have been met. This will be
   published immediately in {issue}…") → the version becomes **Published**, the article renders at
   its reader URL and in the issue TOC, and the submission auto-moves to the **Done** stage
   (live-verified: `stage_id 6` + a Move-to-Done decision; reader page HTTP 200).
2. **Schedule into a future issue** — Editor: "Assign To Future Issue and Schedule Only" → the
   confirm modal reads "…published when {issue} is published" with a *Schedule For Publication*
   button → the version becomes **Scheduled**, readers still get a not-found page, and the
   dashboard now correctly files it under **Scheduled** (row-18 fixed). Publishing the issue later
   flips it to Published with the issue's date.
3. **Continuous publication into a not-yet-published issue** — Editor: "Assign To Future Issue and
   Publish Immediately" → confirm "…published immediately as continuous publication even though it
   is assigned to {issue} which is not published yet" → **Published now** and reader-visible,
   without waiting for the issue to be published.
4. **Issue-less publish** — Editor: "Don't Assign To An Issue" → confirm "…published immediately
   without any issue association" → **Published**, visible, with no issue link. This is also the
   only path on a journal with no issues.
5. **Blocked publish (preconditions)** — Editor on a **declined** submission (or one with an
   **unpaid APC**): the confirm modal lists the blocking requirement ("The following requirements
   must be met before this can be published.") and shows **no submit button**, so the article
   stays unpublished — but the Review-Publishing-Details step has already persisted the chosen
   issue + intent (row 23b).
6. **Non-blocking publish warning** — Editor: a plugin-contributed warning appears in a yellow
   "The following issues were found, but will not prevent publishing" banner above a still-present
   submit button; confirming publishes anyway.
7. **Unpublish — article disappears, tombstone appears, submission leaves Done** — Editor:
   *Unpublish* on a Published article → confirm dialog → the version returns to **Unpublished**
   (draft), the reader page becomes not-found, an **OAI tombstone** is inserted, and if it was the
   submission's only Published Version of Record the submission **returns from Done** to its prior
   stage (Return-to-Workflow decision). The original publish date is retained.
8. **Unschedule a scheduled article** — Editor: the button reads **Unschedule** on a Scheduled
   version and its confirm copy differs, but it hits the same endpoint and returns the version to
   the Unpublished draft state; it was never reader-visible.
9. **Republish keeps the original date** — Editor: publishing a version that had been published
   and then unpublished re-publishes it while preserving its **original** `datePublished` (the
   date is only stamped when empty).
10. **Auto-assign Version-of-Record on publish** — Editor: publishing a version that has no JAV
    stage → the confirm modal announces the exact next *Version of Record* label, and the version
    publishes as that stage.
11. **Permission boundary** — A **section editor / assistant** sees **no** publish/unpublish
    button on the dashboard (manager/admin-only in the UI) yet the publish and unpublish APIs
    accept them (the verified-real UI/API mismatch, owned by versioning); a **recommend-only**
    editor and an **author** cannot publish through any route, and publishing strips every author
    of their metadata-edit grant.

## Known deviations (as-built ≠ intent)

- ⚠ **`PublishSubmissions` is not wired into the OJS scheduler** (rule 15). The auto-publish task
  exists in shared `lib/pkp` but is registered in neither `Scheduler::registerSchedules()` nor
  `PKPScheduler::registerSchedules()` (and there is no legacy `scheduledTasks.xml`), so
  date-based auto-publishing of Scheduled submissions never runs on OJS. In practice OJS reaches
  the same end by publishing the **issue** (which publishes its Scheduled versions), and OJS
  scheduled articles carry no future publish date for the task to act on anyway — so this may be
  intentional (the task reads as an OPS/continuous-publishing feature). **Re-confirmed live
  2026-07-04** (grep: the class is referenced nowhere but its own docblock; no `scheduledTasks.xml`;
  live DB: 0/19 SCHEDULED publications carry a `date_published`). Ledgered as
  [app-changes §2 row 95](../../e2e/app-changes.md); the maintainer decides whether OJS is meant
  to register it. New finding — Open question 1.
- **Referenced, owned elsewhere** (not re-flagged here): the **UI/API publish-authority
  mismatch** (dashboard hides publish controls from assigned sub-editors/assistants the API
  authorises) — versioning's verified-real deviation; **row 23b** (declined submissions keep the
  *Schedule* button; Review-Publishing-Details Confirm persists issue + intent before
  `validatePublish` runs) — versioning rule 17; **row 18** (publish endpoint used to hard-code
  submission status Published) — **FIXED**, versioning rule 24.
- **Authenticated-but-unauthorized → 401 baseline**: as elsewhere in the campaign, a hand-crafted
  request from a role without publish authority returns **401**, not 403 — a campaign-wide
  baseline, not a publish-flow defect.

## Open questions

1. **Is OJS meant to register `PublishSubmissions`?** As-built it is unregistered and OJS
   scheduled articles have no future date, so date-based auto-publish is dead in OJS while issue
   publication carries the load. Is the task intentionally OPS-only, or is its omission from the
   OJS scheduler a gap? (As-built confirmed + re-verified live 2026-07-04, [app-changes §2 row 95](../../e2e/app-changes.md);
   intent adjudication only.)
2. **Atom seam — the publish-action atoms live under `publication-versioning`.** `FORM-publish-form`,
   `GRID-lib-pkp-modals-publish-publish-handler` and `API-submission-publish/unpublish-publication`
   were claimed by the versioning pilot, but they *implement the publish action this spec owns*.
   Confirm at grooming whether they should move here (single-owner by user-intent) or stay with
   versioning (which references them). This spec references them and claims only the
   publish-flow-specific `TASK-publishsubmissions` to avoid double-claiming. (Bookkeeping only.)
3. **Atom seam — the OAI tombstone tables.** `DB-data_object_tombstones` (+ settings / oai-set) are
   *written* by this action (rule 12) but *read* by OAI. They are currently unclaimed; confirm at
   grooming that `oai-sitemap-feeds` (the reader/OAI owner) claims them, with this spec as the
   writer. (Bookkeeping only.)
4. **Is the `datePublished`-preserving republish (rule 14) intended** even after a long unpublish,
   or should a republish re-stamp the date? (Shared with versioning Open question 2.)

---

<!-- REFERENCE MATERIAL — provenance and campaign bookkeeping, not product-owner narrative. -->

## Reference — entry points & surfaces

| Entry | Path | Atom |
|-------|------|------|
| *Schedule For Publication* / *Publish* button → confirm modal | Workflow → Publication → primary controls → *Review Publishing Details* side-modal → legacy `PublishHandler` confirm modal (`.pkpWorkflow__publishModal`, "All publication requirements have been met…") | *(GRID-lib-pkp-modals-publish-publish-handler, FORM-publish-form — owned by publication-versioning; referenced)* |
| *Unpublish* / *Unschedule* button → confirm dialog | Workflow → Publication → primary controls (status Published / Scheduled) | — |
| Publish API | `PUT api/v1/submissions/{submissionId}/publications/{publicationId}/publish` | *(API-submission-publish-publication — owned by publication-versioning; referenced)* |
| Unpublish / unschedule API | `PUT api/v1/submissions/{submissionId}/publications/{publicationId}/unpublish` | *(API-submission-unpublish-publication — owned by publication-versioning; referenced)* |
| Publish confirm modal (renders the requirements/confirmation) | legacy `controllers/modals/publish/PublishHandler::publish` (roles SubEditor/Manager/SiteAdmin/Assistant) | *(GRID-lib-pkp-modals-publish-publish-handler — referenced)* |
| Publication status / accessStatus fields | `schemas/publication.json` (`status`, `accessStatus`) + `lib/pkp/schemas/publication.json` (`status`) | *(SCHEMA-publication-{ojs,pkp} — owned by publication-versioning; status/accessStatus aspect referenced)* |
| Auto-publish scheduled submissions (task) | `PKP\task\PublishSubmissions` — not registered in the OJS scheduler | **TASK-publishsubmissions** |
| Reader visibility flip | `/publicknowledge/article/view/{id}` (published → 200; unpublished → not-found) + issue TOC | *(owned by article-landing / issue-archive-toc)* |
| OAI tombstone (deleted-record) | OAI feed after unpublish | *(owned by oai-sitemap-feeds)* |

## Reference — code anchors

- **Publish action (UI)**: `lib/ui-library/src/pages/workflow/composables/useWorkflowActions.js`
  (`workflowScheduleForPublication` → `modals.publish.PublishHandler`; `workflowUnpublishPublication`;
  `workflowUnschedulePublication` — both PUT `…/unpublish`);
  `.../useWorkflowConfig/workflowConfigEditorialOJS.js` (entry-button labels & `canPublish` gate).
- **Confirm modal + form**: `lib/pkp/controllers/modals/publish/PublishHandler.php` (`publish()`
  — runs `validatePublish`/`validatePublishWarnings`, builds `PublishForm`);
  `classes/components/forms/publication/PublishForm.php` (confirmation text vs blocking list vs
  version-stage announcement; submit button only when no errors);
  `lib/pkp/templates/controllers/modals/publish/publish.tpl` (`publishWarnings` banner).
- **Publish/unpublish API + recompute**: `lib/pkp/api/v1/submissions/PKPSubmissionController.php`
  (`publishPublication()` — already-published guard, `validatePublish`, `publish($pub, false)`,
  author-grant revoke, `updateStatus` + `updateCurrentPublication` [row-18 fix];
  `unpublishPublication()` — Published/Scheduled-only guard, `unpublish()`).
- **Core lifecycle**: `lib/pkp/classes/publication/Repository.php` (`publish()` 572-711 —
  license snapshot, VoR auto-stage, event log, DOI staleness, `PublicationPublished`;
  `unpublish()` 741-833 — back to Queued, `PublicationUnpublished`; `validatePublish()` 280-307).
- **OJS specialisations**: `classes/publication/Repository.php` (`setStatusOnPublish()` 189-228 —
  intent/issue → Published/Scheduled + date stamp; `validatePublish()` 126-149 — issue + APC).
- **Status derivation + tombstone**: `lib/pkp/classes/submission/Repository.php`
  (`getStatusByPublications()`, `updateStatus()`, `updateCurrentPublication()`);
  `classes/submission/Repository.php` (`updateStatus()` 106-129 — OAI tombstone insert/delete via
  `ArticleTombstoneManager` / `DataObjectTombstoneDAO`).
- **Done-stage trigger**: `lib/pkp/classes/observers/listeners/ApplyDoneWorkflowStage.php`
  (`handle()` on `PublicationPublished`/`PublicationUnpublished`; `Decision::MOVE_TO_DONE` /
  `RETURN_TO_WORKFLOW`; auto-registered by `lib/pkp/classes/core/EventServiceProvider.php`
  directory discovery).
- **Scheduled task**: `lib/pkp/classes/task/PublishSubmissions.php`; schedulers
  `classes/scheduler/Scheduler.php` + `lib/pkp/classes/scheduledTask/PKPScheduler.php`
  (`registerSchedules()` — PublishSubmissions absent).
- **Status constants**: `lib/pkp/classes/publication/PKPPublication.php`
  (`STATUS_QUEUED=1`/`PUBLISHED=3`/`DECLINED=4`/`SCHEDULED=5`);
  `classes/publication/Publication.php` (`STATUS_READY_TO_PUBLISH=6`/`READY_TO_SCHEDULE=7`,
  `DEFAULT_VERSION_STAGE`); `classes/submission/Submission.php`
  (`ARTICLE_ACCESS_ISSUE_DEFAULT=0`/`ARTICLE_ACCESS_OPEN=1`).
