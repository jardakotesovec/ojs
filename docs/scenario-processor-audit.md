# Scenario Processor parity audit

**Branch**: `e2e_revamp_2` (parent: `e2e_revamp`).
**Started**: 2026-04-30.
**Goal**: every Processor in `lib/pkp/classes/testing/scenario/Processor/` should produce the same database result as the equivalent UI / REST flow it represents — same rows written, same hooks fired, same notifications dispatched, same side effects. This doc is the per-Processor audit ledger and post-fix verification log.

## §0 · Performance baseline

Captured at the head of `e2e_revamp_2` *before any audit changes*, so the post-remediation timing has a clean baseline to diff against.

**Method**: `lib/pkp/playwright/support/api.js` writes one JSON line per `createSubmission` / `createJournal` call to `.scenario-timing.log` when `PKP_SCENARIO_TIMING=1`. The full Playwright suite is run once, then results are aggregated by `endpoint × spec keys` into median / max / count.

**Run command**:
```
PKP_SCENARIO_TIMING=1 npm run test:e2e:ojs
node scripts/aggregate-scenario-timing.js .scenario-timing.log
```

**Baseline numbers** (captured 2026-04-30, lib/pkp at `b8b47466b1` — timing wrapper applied, no Processor fixes yet, full Playwright suite, `--workers=2`, 143 passed / 1 skipped):

| Endpoint | Spec shape (top-level keys) | Calls | Median (ms) | Max (ms) | Total (ms) |
|---|---|---|---|---|---|
| journal | `tag,users` | 43 | 1723 | 2465 | 75951 |
| submission | `decisions,journal,locale,participants,publications,reviewRounds,section,submitter,tag` (full lifecycle) | 44 | 482 | 761 | 20679 |
| journal | `name,tag,users` | 5 | 1879 | 2024 | 8926 |
| journal | `supportedLocales,tag,users` | 3 | 2140 | 2400 | 6522 |
| submission | `journal,locale,participants,publications,section,submitter,tag` (publish only) | 10 | 297 | 445 | 3112 |
| submission | `decisions,journal,locale,participants,publications,section,submitter,tag` (no review rounds) | 5 | 355 | 609 | 1979 |
| submission | `author,decisions,journal,locale,participants,publications,reviewRounds,section,submitter,tag` | 2 | 537 | 618 | 1073 |
| submission | `commentsForEditor,journal,locale,participants,publications,section,submitted,submitter,tag` | 1 | 275 | 275 | 275 |

(Plus 16 single-call journal-shape variants between 1351–2462 ms median — see `/tmp/timing-baseline.log` for the raw data.)

## §1 · Audit findings

Each Processor gets one section below as the audit proceeds. Template:

```markdown
### N. {ProcessorName}

**Domain**: …
**Current implementation summary**: 1–2 lines.

**Canonical UI entry point**:
- Form / page: …
- REST endpoint: …
- Controller method: …

**What the production path does** (trace from the controller):
- …

**What the Processor does today**:
- …

**Discrepancies**:
| # | Gap | Severity | Recommended fix |
|---|---|---|---|
| 1 | … | ✅ matches / ⚠️ partial / ❌ skips side effect | … |

**Verdict**: ✅ parity / ⚠️ N gaps / ❌ N gaps requiring source change
```

### 1. UserAssignmentProcessor

**File**: `lib/pkp/classes/testing/scenario/Processor/UserAssignmentProcessor.php`
**Domain**: `users`, `user_user_groups`
**Current implementation summary**: For each `users[]` entry — looks up by username; if missing AND `password` supplied, creates the user via `Repo::user()->newDataObject([…]) + Repo::user()->add()`. Then for each `roles[]` string, resolves a UserGroup via `UserGroupLookup` and calls `Repo::userGroup()->assignUserToGroup($userId, $userGroupId)`.

**Canonical UI/REST entry points** (no single one — see below):

| Sub-operation | Entry point |
|---|---|
| User creation | `RegistrationForm::execute()` (`lib/pkp/classes/user/form/RegistrationForm.php:263`) — public registration · `UserRoleAssignmentReceiveController::finalize()` (`lib/pkp/classes/invitation/invitations/userRoleAssignment/handlers/api/UserRoleAssignmentReceiveController.php:90`) — invitation accept · `PKPInstall::createSiteAdmin()` (`lib/pkp/classes/install/PKPInstall.php:250`) — install only. There is **no site-admin "Add User" form** on a per-context basis: every context-scoped role-add routes through the invitation pipeline. |
| Role assignment | `UserRoleAssignmentReceiveController::finalize()` lines 126–142 — only canonical entry point. |

**What the production paths do** (the union — Processor should match the lowest-common-denominator):

User creation (RegistrationForm + UserRoleAssignmentReceiveController):
- `Repo::user()->newDataObject()` + setters
- Sets `dateRegistered`, password (already encrypted at controller level via Validation::encryptCredentials)
- **Sets `inlineHelp = 1`** — both production paths do this (RegistrationForm.php:299, UserRoleAssignmentReceiveController.php:115)
- RegistrationForm only: sets `disabled` + `disabledReason` if `require_validation` config is set; sets user interests; sets blocked-notification preferences; auto-assigns Reader role; fires `UserRegisteredContext` / `UserRegisteredSite` event
- `Repo::user()->add()` — fires `Hook::call('User::add', [$user])`

Role assignment (UserRoleAssignmentReceiveController only):
- `Repo::userGroup()->assignUserToGroup($userId, $userGroupId, $effectiveDateStart, $endDate, $masthead)` — Repository.php:312
- The Repository method itself only does `UserUserGroup::create()` + masthead cache invalidation; no events, no hooks
- Marks the originating Invitation row as `ACCEPTED` (`UserRoleAssignmentReceiveController.php:144`)

**What the Processor does today** (UserAssignmentProcessor.php):
- Creates user via `Repo::user()->newDataObject([…])` array form, sets userName/password/email/givenName/familyName/country/affiliation/mustChangePassword/dateRegistered. **Does NOT set `inlineHelp`**.
- Calls `Repo::user()->add()` (Hook::call fires — ✅ matches)
- Calls `Repo::userGroup()->assignUserToGroup($userId, $userGroupId)` with **only the first 2 args** — defaults `dateStart` to today, `dateEnd` to null, `masthead` to null
- Does **not** create an Invitation row

**Discrepancies**:

| # | Gap | Severity | Recommended fix |
|---|---|---|---|
| 1 | `inlineHelp` field left NULL on Processor-created users; both production paths set it to `1` | ✅ resolved | Set `'inlineHelp' => 1` in the `newDataObject()` array. **Resolved** in `e2e_revamp_2` lib/pkp commit (UserAssignmentProcessor: set inlineHelp=1). |
| 2 | Spec doesn't expose `dateEnd` or `masthead` for `assignUserToGroup`; both default to NULL | ⚠️ deferred — no current consumer | Extend spec → forward optional `dateEnd` / `masthead` args from per-role entry through to `assignUserToGroup`. Schema bump. **Deferred** until a test surfaces the need; YAGNI. |
| 3 | No `Invitation` row created for role assignments; production always lands one (status=ACCEPTED) | ⚠️ partial — only matters for tests that hit `/api/v1/invitations` and expect to see prior assignments | Optional. Skip unless a test surfaces the gap. Recommend: document in PHPDoc rather than fix (Processor's role is "post-acceptance state", not "audit trail"). |
| 4 | RegistrationForm-specific side effects (UserRegisteredContext event, blocked notifications, user interests, auto-Reader assignment, validation-email gate) | ✅ matches by design | Processor simulates the *invitation-accept* path, not the *self-registration* path; those side effects are registration-form-only and intentionally skipped. No fix. |
| 5 | `Hook::call('User::add', [$user])` fires on both production paths and on Processor (via `Repo::user()->add()`) | ✅ matches | None. |
| 6 | `dateRegistered` set; password pre-encrypted; field accessors used either via array or setters land at the same DB row | ✅ matches | None. |

**Verdict (initial)**: ⚠️ 2 actionable gaps (#1, #2). Gap #3 is a deferred/document call.
**Verdict (post-fix)**: ✅ #1 resolved; #2 deferred (YAGNI); #3 documented. No further action.

### 2. ContextBuilderProcessor

**File**: `lib/pkp/classes/testing/scenario/Processor/ContextBuilderProcessor.php`
**Domain**: `journals` (or `presses` / `servers`), `plugin_settings`, plus everything `PKPContextService::add()` installs (default user groups, email templates, genres, nav menus, contributor roles)
**Current implementation summary**: Builds a `Journal` data object, hydrates from spec, calls `app('context')->add()` (same service the UI calls). Optionally writes plugin settings through `PluginSettingsDAO::updateSetting`.

**Canonical UI/REST entry point**:
- Form / page: site-admin "Add Journal" form
- REST endpoint: `POST /api/v1/contexts`
- Controller method: `PKPContextController::add()` (`lib/pkp/api/v1/contexts/PKPContextController.php:317–360`)

**What the production path does**:
- `convertStringsToSchema(SCHEMA_CONTEXT, …)` to coerce types
- `$contextService->validate(VALIDATE_ACTION_ADD, …)` — schema validation, returns errors
- `$contextDao->newDataObject() + setAllData($params)`
- `$contextService->add($context, $request)` — the heavy lifting (PKPContextService.php:465–608):
  - `Hook::call('Context::defaults::localeParams', …)`
  - `app('schema')->setDefaults(SCHEMA_CONTEXT, …)` — fills in schema defaults
  - Auto-defaults `supportedFormLocales` / `supportedDefaultSubmissionLocale` / `supportedAddedSubmissionLocales` / `supportedSubmissionLocales` / `supportedSubmissionMetadataLocales` to `[primaryLocale]` *only* if not set
  - `$contextDao->insertObject() + resequence()`
  - Saves uploaded files (favicon, homepageImage, pageHeaderLogoImage)
  - `GenreDAO::installDefaults()` — default genres
  - `UserGroupRepository::installSettings()` — default user groups
  - Auto-assigns currentUser to default Manager group via `UserUserGroup::create()`
  - Creates context file dirs
  - `NavigationMenuDAO::installSettings()`
  - `Repo::emailTemplate()->dao->installAlternateEmailTemplates()` + `setTemplateDefaultUnrestirctedSetting()`
  - Adds default ContributorRoles (Author, Translator)
  - `PluginRegistry::loadAllPlugins()`
  - `Hook::call('Context::add', [&$context, $request])`

**What the Processor does today**:
- Builds `$data` array from spec defaults + optional fields (copyrightNotice, submitWithCategories, enableDois, doiPrefix, doiVersioning, registrationAgency, onlineIssn, printIssn, enablePublicComments, enableAnnouncements, publishingMode, enabledDoiTypes)
- **Skips** `validate()` — goes straight to insert
- **Mirrors `supportedLocales` to `supportedFormLocales` / `supportedSubmissionLocales` / `supportedSubmissionMetadataLocales` / `supportedAddedSubmissionLocales`** rather than letting the service default to `[primaryLocale]` (deliberate — see gap #3 below)
- Sets `enabled = 1` explicitly
- Stuffs admin into `Registry::get('user')` so `$contextService->add()` picks them up as the new context's first manager
- Calls `app('context')->add()` — same path as production
- Optionally writes plugin settings via direct `PluginSettingsDAO::updateSetting()`

**Discrepancies**:

| # | Gap | Severity | Recommended fix |
|---|---|---|---|
| 1 | Schema validation (`$contextService->validate()`) is skipped | ✅ acceptable | Tests own the spec; validation would just fail-fast on malformed specs we control. Document only. |
| 2 | `enabled = 1` set explicitly | ✅ matches | Same DB row state — context schema's default is enabled. No fix. |
| 3 | `supportedFormLocales` / `supportedSubmissionLocales` / `supportedSubmissionMetadataLocales` / `supportedAddedSubmissionLocales` mirrored from `supportedLocales` rather than defaulting to `[primaryLocale]` | ⚠️ deliberate divergence | This is *intentionally* off-default: a multilingual scratch journal needs all four arrays seeded so the publication validator + wizard locale panels accept multi-locale data. A real user adding a journal would later toggle these via Languages settings; the Processor seeds the post-configuration state up front. **Document, don't fix.** |
| 4 | Plugin settings written via direct `PluginSettingsDAO::updateSetting()` | ⚠️ partial | The UI path is each plugin's own `SettingsForm::execute()`, which typically just validates + writes the same DAO row. For most plugins the DB result is identical. For Crossref / DOI plugins specifically the form's `execute()` may fire a hook plugins listen to. **Defer**: only fix if a specific plugin's tests surface a regression. |
| 5 | `Hook::call('Context::add')` fires on both paths (via shared service `add()`) | ✅ matches | None. |
| 6 | Default genres / user groups / nav menus / email templates / contributor roles installed; currentUser auto-assigned as manager | ✅ matches | All inside service `add()`; identical regardless of caller. |
| 7 | `Registry::set('user', $admin)` trick to satisfy `$request->getUser()` inside service `add()` without rotating the browser session | ✅ matches | Manager assignment lands on admin user identically to production where the logged-in admin would be `$currentUser`. |

**Verdict**: ✅ parity (with one deliberate divergence on multilingual locales — by design — and one deferred concern on plugin-settings hooks that has no known impact today).

### 3. ParticipantProcessor

**File**: `lib/pkp/classes/testing/scenario/Processor/ParticipantProcessor.php`
**Domain**: `stage_assignments`
**Current implementation summary**: For each `participants[]` entry — resolves UserGroup via `UserGroupLookup`, calls `Repo::stageAssignment()->build()`, optionally `update()`s `recommendOnly` / `canChangeMetadata` flags if the spec specified them and the existing row's defaults don't match.

**Canonical UI/REST entry point**:
- Form / page: workflow page → "Stage Participants" panel → "Add Participant" sidemodal
- Controller: `StageParticipantGridHandler::saveParticipant()` (`lib/pkp/controllers/grid/users/stageParticipant/StageParticipantGridHandler.php:329–405`)
- Form: `AddParticipantForm::execute()` (`lib/pkp/controllers/grid/users/stageParticipant/form/AddParticipantForm.php:262–302`) — the same `Repo::stageAssignment()->build()` call

**What the production path does** (saveParticipant):
1. `AddParticipantForm::execute()` → `Repo::stageAssignment()->build($submissionId, $userGroupId, $userId, $recommendOnly, $canChangeMetadata)` — Eloquent firstOr-create on `stage_assignments`. **No hooks, no events fire** in `build()` itself (`lib/pkp/classes/stageAssignment/Repository.php:30–47`).
2. If the assigned UserGroup is the Manager role: `notificationMgr->updateNotification($request, getDecisionStageNotifications(), null, ASSOC_TYPE_SUBMISSION, $submissionId)` — recomputes pending decision-stage notifications.
3. **Removes `NOTIFICATION_TYPE_EDITOR_ASSIGNMENT_REQUIRED` notifications** across all stages where the submission now has at least one assigned manager/sub-editor (lines 360–374).
4. Creates a "trivial" success notification for the *actor* ("Stage participant added") — UI feedback only.
5. Writes an `EventLog` row of type `SUBMISSION_LOG_ADD_PARTICIPANT` capturing `userFullName`, `username`, `userGroupName`.

**What the Processor does today**:
1. Calls `Repo::stageAssignment()->build()` — same Eloquent firstOr-create.
2. If existing row's flag values don't match spec: `$stageAssignment->update($flagUpdates)`. ✅ matches form's behaviour for the form's own `_assignmentId`-edit branch, although the trigger is different (Processor uses spec presence; form uses an existing assignment ID).
3. **Skips all post-form notification + event-log work** (steps 2–5 above).

**Discrepancies**:

| # | Gap | Severity | Recommended fix |
|---|---|---|---|
| 1 | `Repo::stageAssignment()->build()` is the shared write — no hooks, no events fire on either path | ✅ matches | None. |
| 2 | `EDITOR_ASSIGNMENT_REQUIRED` notification cleanup — production removes any pending instances when a manager/sub-editor lands; Processor doesn't | ✅ resolved | After all participants are processed, if any was a Manager/Sub-editor and the submission now has at least one such assignment, delete pending `EDITOR_ASSIGNMENT_REQUIRED` notifications (idempotent). **Resolved** in `e2e_revamp_2` lib/pkp commit (ParticipantProcessor: log + EDITOR_ASSIGNMENT_REQUIRED cleanup). |
| 3 | Decision-stage notification recompute on manager assignment | ⚠️ deferred | Touches `notificationMgr->updateNotification()` which has wide surface area. No current spec inspects decision-stage notifications; defer until a test surfaces the gap. |
| 4 | `EventLog` row of type `SUBMISSION_LOG_ADD_PARTICIPANT` not written | ✅ resolved | Append the same `Repo::eventLog()->newDataObject([...]) + add()` after each Processor `build()`, attributing to the admin user. **Resolved** in `e2e_revamp_2` lib/pkp commit (ParticipantProcessor: log + EDITOR_ASSIGNMENT_REQUIRED cleanup). |
| 5 | "Trivial" success notification for the actor | ✅ skip | UI-only feedback for the clicker; not relevant to seeded state. |
| 6 | Spec doesn't expose stage scoping per assignment (uses UserGroup's implicit stage) | ✅ matches | The form does the same — UserGroup membership in a stage is the gate (`UserGroupStage::withStageId()->withUserGroupId()`). |

**Verdict (initial)**: ⚠️ 2–3 actionable gaps (#2, #3, #4).
**Verdict (post-fix)**: ✅ #2, #4 resolved; #3 deferred (no current consumer).

### 4. SubmissionBuilderProcessor

**File**: `lib/pkp/classes/testing/scenario/Processor/SubmissionBuilderProcessor.php`
**Domain**: `submissions`, `publications`, `authors`, `author_contributor_roles`, `stage_assignments`, `submission_files`, `files`, plus the `submission_comments` row created by `Repo::submission()->submit()` when `commentsForTheEditors` is set
**Current implementation summary**: Creates submission + bare publication via Repo, assigns submitter as author to stage 1, builds Author from submitter user, attaches the bundled default-article.pdf via file service, optionally writes `commentsForTheEditors` and calls `Repo::submission()->submit()` to mirror the wizard's final Submit click.

**Canonical UI/REST entry point**:
- The submission wizard is a multi-step UI; each step has its own REST call:
  - `POST /api/v1/submissions` — `PKPSubmissionController::add()` (`lib/pkp/api/v1/submissions/PKPSubmissionController.php:622–766`) — creates submission + first publication + first author + first stage assignment
  - `POST /api/v1/submissions/{id}/files` — `PKPSubmissionFileController::add()` (`lib/pkp/api/v1/submissions/PKPSubmissionFileController.php:291`) — file upload
  - `PUT /api/v1/submissions/{id}` — generic edit, used by the wizard's Comments step to set `commentsForTheEditors`
  - `PUT /api/v1/submissions/{id}/submit` — `PKPSubmissionController::submit()` (lib/pkp/api/v1/submissions/PKPSubmissionController.php:866) — converts wizard-in-progress into submitted

**What the production paths do**:

`PKPSubmissionController::add()`:
- Validates schema; checks `disableSubmissions`, section inactive/editorRestricted gates
- **Disambiguates submitter UserGroup**: picks Manager group if user has it, else Author group; auto-assigns Author group if user has neither. The picked group becomes the stage assignment's `userGroupId`.
- `Repo::submission()->add()` — fires `Hook::call('Submission::add', [$submission])`
- `Repo::stageAssignment()->build()` with `recommendOnly: $userGroup->recommendOnly` and `canChangeMetadata: submissionProgress ? true : $userGroup->permitMetadataEdit`
- **Only if submitter's chosen group is AUTHOR role**: creates Author from user, sets `publicationId`, `contributorType=PERSON`, **calls `setContributorRoles([AUTHOR ContributorRole])`**, calls `Repo::author()->add()`, edits publication `primaryContactId`

`PKPSubmissionFileController::add()`:
- Uploads file via `app('file')->add()`
- Auto-defaults genre if only one is enabled; auto-defaults filename from upload basename
- Validates fileStage — disallows NOTE / REVIEW_ATTACHMENT / QUERY here; gate review-stage uploads on a valid review_round
- `Repo::submissionFile()->newDataObject()` + `Repo::submissionFile()->add()` — fires hooks

`PKPSubmissionController::submit()`:
- `Repo::submission()->validateSubmit()` (fires `Submission::validateSubmit` hook)
- Section inactive/editorRestricted gate
- `Repo::submission()->submit($submission, $context)` — clears `submissionProgress`, sets `dateSubmitted`, fires `event(SubmissionSubmitted)`, optionally creates the comments-for-the-editors discussion via `Repo::editorialTask()->addCommentsForEditorsQuery()`
- **If `confirmCopyright` was in the wizard request**: writes a `SUBMISSION_LOG_COPYRIGHT_AGREED` EventLog row

**What the Processor does today**:
- `Repo::submission()->newDataObject([...])` + `Repo::publication()->newDataObject([...])` — sets `versionMajor=1`, `versionMinor=0`
- `Repo::submission()->add()` — same `Submission::add` hook fires
- `Repo::stageAssignment()->build()` with **default flags** (no `recommendOnly` / `canChangeMetadata` passed; `Repo::stageAssignment()->build()` defaults `canChangeMetadata` to `userGroup->permitMetadataEdit ?? false`, `recommendOnly` to `false`)
- **Always uses AUTHOR group** for the submitter's stage assignment (no Manager-vs-Author disambiguation)
- `Repo::author()->newAuthorFromUser()` + `setData('publicationId')` + `setData('contributorType', PERSON)`. **Does NOT call `setContributorRoles`** — author is added without a ContributorRole linkage.
- `Repo::author()->add()` — same hook fires
- Optional: `Repo::author()->edit()` for orcid/orcidIsVerified/email passthrough (bypasses the orcid validator)
- `Repo::publication()->edit($pub, ['primaryContactId' => $authorId])`
- `attachDefaultArticleFile()`: `app('file')->add()` + `Repo::submissionFile()->dao->newDataObject()` + `Repo::submissionFile()->add()` — same as production file controller, minus the genre-auto-default and review-stage validation (Processor hardcodes genre=ARTICLE, fileStage=SUBMISSION)
- Optional: `Repo::submission()->edit($sub, ['commentsForTheEditors' => …])`
- Optional: `Repo::submission()->submit($submission, $context)` — same SubmissionSubmitted event fires

**Discrepancies**:

| # | Gap | Severity | Recommended fix |
|---|---|---|---|
| 1 | Author created without `ContributorRoles` linkage; production calls `setContributorRoles([AUTHOR])` before `Repo::author()->add()` | ✅ resolved | After `setData('contributorType', PERSON)` and before `Repo::author()->add($author)`, fetch the AUTHOR `ContributorRole` for the context and call `$author->setContributorRoles([...])`. **Resolved** in `e2e_revamp_2` lib/pkp commit (SubmissionBuilderProcessor: link AUTHOR ContributorRole). |
| 2 | StageAssignment uses Repo defaults rather than the picked UserGroup's `recommendOnly` / `permitMetadataEdit` | ✅ matches in practice | For the AUTHOR UserGroup the Repo defaults converge to the same values (`recommendOnly=false`, `canChangeMetadata=permitMetadataEdit`). Document only. |
| 3 | Submitter is always assigned as AUTHOR; production disambiguates between Manager and Author groups based on the user's existing memberships | ⚠️ deferred — no current consumer | Tests where submitter is a Manager would land an incorrect AUTHOR stage assignment. No spec currently uses a Manager submitter. Defer; optionally document on the `submissionDraft` fixture. |
| 4 | No `SUBMISSION_LOG_COPYRIGHT_AGREED` EventLog when submit() runs | ✅ acceptable | Production only writes this when the wizard's `confirmCopyright` checkbox was ticked. The spec doesn't expose `copyrightAgreed`; tests don't surface this. |
| 5 | File attachment: same `app('file')->add()` + `Repo::submissionFile()->add()` as `PKPSubmissionFileController::add()` | ✅ matches | None. |
| 6 | `Repo::submission()->submit()` shared between Processor and `PKPSubmissionController::submit()` — fires `SubmissionSubmitted` event identically; auto-creates Stage 1 cover-note discussion when `commentsForTheEditors` is set | ✅ matches | None. |
| 7 | `commentsForTheEditors` saved via `Repo::submission()->edit()` — same path as wizard's PUT step | ✅ matches | None. |
| 8 | Schema validation + `disableSubmissions` / `validateSubmit` / inactive-section gates skipped | ✅ acceptable | Test seeding intentionally bypasses these. |
| 9 | `Repo::author()->edit($author, ['orcid' => …])` passthrough bypasses Author validator's `api.orcid.403.cannotUpdateAuthorOrcid` block | ✅ deliberate | Documented in Processor; needed for ORCID-verified contributor seeding. |

**Verdict (initial)**: ⚠️ 1 actionable gap (#1 ContributorRoles). #3 deferred.
**Verdict (post-fix)**: ✅ #1 resolved; #3 deferred (no current consumer).

### 5. PublicationsProcessor

**File**: `lib/pkp/classes/testing/scenario/Processor/PublicationsProcessor.php`
**Domain**: `publications`, `publication_settings`, `submission_dois`, `event_log`, `stage_assignments` (after publish, on AUTHOR roles)
**Current implementation summary**: For each publication entry — index 0 edits the bare publication created by SubmissionBuilder, index >0 calls `Repo::publication()->version()` to chain a new version. Applies metadata + UI-settable attributes via one `Repo::publication()->edit()`. Optionally resolves an issue and calls `Repo::publication()->publish()`.

**Canonical UI/REST entry points**:
- Per-panel save: `PUT /api/v1/submissions/{id}/publications/{id}` — `PKPPublicationController::edit()` → `Repo::publication()->edit()`
- Create new version: `POST /api/v1/submissions/{id}/publications` (or via the Vue "Create New Version" dialog) → `Repo::publication()->version()`
- Publish: `PUT /api/v1/submissions/{id}/publications/{id}/publish` — `PKPSubmissionController::publishPublication()` (`lib/pkp/api/v1/submissions/PKPSubmissionController.php:1395–1454`)

**What the production publish path does** (PKPSubmissionController::publishPublication):
- Guards: 404 if not found, 403 if already published
- `Repo::publication()->validatePublish()` — fires `Publication::validatePublish` hook
- **`Repo::publication()->publish($publication, false)`** — pass `false` to skip the auto-status-update on the submission
- **Iterates stage_assignments and sets `canChangeMetadata = 0` on every AUTHOR role assignment** — authors lose metadata-edit after publish

`Repo::publication()->publish()` itself fires (regardless of caller):
- `setStatusOnPublish()` — flips publication status
- Auto-defaults missing copyrightHolder / copyrightYear / licenseUrl from the context
- Auto-versions if missing
- `Hook::call('Publication::publish::before')` → DAO update → re-fetch
- `Repo::submission()->updateStatus()` IF `$submissionStatus !== false`
- `Repo::submission()->updateCurrentPublication()`
- EventLog row of type `SUBMISSION_LOG_METADATA_PUBLISH` ('publication.event.published' / 'scheduled' / 'versionPublished' / 'versionScheduled')
- DOI staling (DOI versioning rules)
- `Hook::call('Publication::publish')`
- `event(PublicationPublished)`

**What the Processor does today**:
- Index 0 → `Repo::publication()->edit()` for metadata
- Index >0 → `Repo::publication()->version()` (auto-sets `versionStage` if provided), then `edit()` for metadata
- Optional `Repo::publication()->edit($pub, ['issueId' => $resolvedId])` before publish
- **`Repo::publication()->publish($publication)`** — uses default `submissionStatus = null` (which means: run `Repo::submission()->updateStatus()`)
- **No iteration of stage_assignments** to clear AUTHOR `canChangeMetadata` after publish
- Appends `[tag]` to every locale of the title for parallel isolation

**Discrepancies**:

| # | Gap | Severity | Recommended fix |
|---|---|---|---|
| 1 | `Repo::publication()->publish()` called with default `submissionStatus=null`; production passes `false` | ✅ deliberate divergence | Initially "fixed" by passing `false`, but that broke `submissionPublished` scenario seeding — the publication-language-change spec failed because submission.status stayed STATUS_QUEUED while the publication was PUBLISHED. Production reaches publish() through a decision chain that already advanced submission.status; the Processor consolidates create → publish in one pass and **needs** the auto-status-update. The `false` was reverted; the original default-null behaviour is correct for the Processor's all-in-one shape. **Documented** in `e2e_revamp_2` lib/pkp commit (PublicationsProcessor: keep default submissionStatus arg). |
| 2 | After publish, production iterates `stage_assignments` and clears `canChangeMetadata = 0` on every AUTHOR role assignment; Processor doesn't | ✅ resolved | After publish, iterate AUTHOR role stage_assignments and set `canChangeMetadata = 0`. Mirrors PKPSubmissionController.php:1444–1453. **Resolved** in same commit. |
| 3 | Issue assignment: `Repo::publication()->edit($pub, ['issueId' => $id])` before publish | ✅ matches | Issue panel save in UI uses the same `edit()` call; the publish endpoint then runs publish(). Same DB sequence. |
| 4 | Version creation: `Repo::publication()->version()` shared with UI's Create New Version dialog | ✅ matches | Same Repo facade — fires `Publication::version` hook + copies authors/citations. |
| 5 | Metadata edits: `Repo::publication()->edit()` shared with all panel saves | ✅ matches | Same hook chain (`Publication::edit`). |
| 6 | `Repo::publication()->publish()` itself fires every side effect identically (event log, DOI staling, hooks, `PublicationPublished` event) | ✅ matches | All inside the shared `publish()` body. |
| 7 | Title `[tag]` suffix for parallel isolation | ✅ deliberate | Documented; required for parallel-safe scratch journals. Production doesn't do this; the divergence is by design. |

**Verdict (initial)**: ⚠️ 2 actionable gaps (#1 publish-arg, #2 author canChangeMetadata clear).
**Verdict (post-fix)**: ✅ #2 resolved. #1 reverted on test-run feedback — the "production passes `false`" parity reading was wrong for the Processor's consolidated shape; default-null is correct.

### 6. DecisionProcessor

**File**: `lib/pkp/classes/testing/scenario/Processor/DecisionProcessor.php`
**Domain**: `edit_decisions`, `event_log`, `submission_comments` (legacy COMMENT_TYPE_EDITOR_DECISION rows), plus everything `DecisionType::runAdditionalActions()` triggers (stage advance, status change, review round creation, mail sends, etc.)
**Current implementation summary**: For each `decisions[]` entry — maps friendly type strings to Decision constants, builds the decision object with stageId / editorId / dateDecided / reviewRoundId, attaches optional notifyAuthors / notifyReviewers `actions`, and calls `Repo::decision()->add()`. After round-creating decisions, delegates to `ReviewRoundProcessor`. Optionally writes a private `COMMENT_TYPE_EDITOR_DECISION` row when `toEditor` is set.

**Canonical UI/REST entry point**:
- `POST /api/v1/submissions/{id}/decisions/{decision-type}` — `PKPSubmissionController::addDecision()` (`lib/pkp/api/v1/submissions/PKPSubmissionController.php:1948–1977`)

**What the production path does**:
- Schema-coerces input
- Sets `submissionId`, `dateDecided`, `editorId`, `stageId`
- **`Repo::decision()->validate($params, $decisionType, $submission, $context)`** — fires `Hook::call('Decision::validate', [&$errors, $props])`
- `Repo::decision()->newDataObject($params)`
- **`Repo::decision()->add($decision)`** — heavy lifting:
  - Strips `actions` off the decision
  - Auto-sets `round` from `reviewRoundId`
  - DAO insert
  - Fires `Hook::call('Decision::add', [$decision])`
  - Writes EventLog row of type `SUBMISSION_LOG_EDITOR_DECISION` (or `SUBMISSION_LOG_EDITOR_RECOMMENDATION`) — message from `decisionType->getLog()`
  - **Calls `decisionType->runAdditionalActions($decision, $submission, $editor, $context, $actions)`** — this dispatches per-trait `sendAuthorEmail`, `sendReviewersEmail`, stage-advance, status-change, round-create
  - Fires `event(DecisionAdded)` (round-trip catch on Exception)

**What the Processor does today**:
- Re-fetches submission per iteration so cascades are visible
- Maps friendly decision string → Decision const
- Builds decision params (`submissionId`, `decision`, `stageId`, `editorId`, `dateDecided`, optional `reviewRoundId` for in-review decisions)
- Builds `actions` array with synthetic subjects (via `defaultSubject()` helper — `[scenario] {type} — notify {audience}`); body comes from spec
- Soft-fails `toReviewers` on decision types lacking the `NotifyReviewers` trait — logs a ScenarioContext warning
- **Skips `Repo::decision()->validate()`** — goes straight to `Repo::decision()->newDataObject()` + `Repo::decision()->add()`
- After round-creating decisions, delegates to `ReviewRoundProcessor`
- **Writes a `submission_comments` row of type `COMMENT_TYPE_EDITOR_DECISION` when `toEditor` is set** — see gap #3 below

**Discrepancies**:

| # | Gap | Severity | Recommended fix |
|---|---|---|---|
| 1 | `Repo::decision()->validate()` skipped | ⚠️ minor | Production fires `Hook::Decision::validate`; plugin-injected validations don't run on the Processor path. Tests typically control inputs so plugin-defined invariants aren't exercised. **Defer**: only fix if a test surfaces a plugin-validated decision. |
| 2 | Action subject text uses synthetic literal (`[scenario] {type} — notify {audience}`) rather than the decision-type's mailable email-template subject | ⚠️ cosmetic | The form submits real composed subjects; the Processor synthesises a placeholder. Mail::fake() suppresses the actual send, but `submission_emails` log rows record the synthetic subject. **Acceptable** for tests; flag if a test asserts on subject contents. |
| 3 | `submission_comments` row of type `COMMENT_TYPE_EDITOR_DECISION` written on `toEditor` — the legacy decision form once wrote these but the current Vue decision UI no longer does | ⚠️ deliberate divergence FROM production | The Processor provides a test-only "internal editor note" capability that production no longer exposes. Removing it would break `scenario-decision-comments.spec.js`, `submission-published.js` (uses toEditor), and `reviewer-recommendations.spec.js`. **Deliberate** — the constant + DAO storage remain wired through; the divergence is a forward-compat rather than a parity bug. Document. |
| 4 | `Repo::decision()->add()` is the shared write — fires `Hook::Decision::add`, writes `SUBMISSION_LOG_EDITOR_DECISION` event log, runs `runAdditionalActions`, fires `event(DecisionAdded)` | ✅ matches | None. |
| 5 | `runAdditionalActions` includes stage advance, status change, review round creation, email sends — all driven by `actions` array → DecisionType per-trait handlers | ✅ matches | Both paths feed the same `actions` array shape into `runAdditionalActions`. |
| 6 | Mail::fake() at controller level prevents real sends on both paths | ✅ matches | None. |
| 7 | Processor's `toReviewers` recipient list is computed from completed reviewer assignments on the active round (mirrors `NotifyReviewers::validateNotifyReviewersAction`) | ✅ matches | None — both paths constrain to completed reviewer IDs. |

**Verdict**: ✅ parity with three documented divergences (#1 minor hook skip, #2 cosmetic synthetic subjects, #3 deliberate test-only `toEditor` capability). All deferred — none break the parity rule meaningfully enough to fix without breaking existing tests.

### 7. ReviewRoundProcessor

**File**: `lib/pkp/classes/testing/scenario/Processor/ReviewRoundProcessor.php`
**Domain**: `review_assignments`, `submission_comments` (COMMENT_TYPE_PEER_REVIEW), `notifications`, `event_log`, `email_log`
**Current implementation summary**: For each `reviewers[]` entry on a round — `Repo::reviewAssignment()->newDataObject() + ->add()` (creating with method, dates, round number), then `Repo::reviewAssignment()->edit()` to apply status-derived field combos (dateConfirmed / dateCompleted / declined / cancelled / reviewerRecommendationId). Writes COMMENT_TYPE_PEER_REVIEW comments for completed reviews via direct DAO insert.

**Canonical UI/REST entry points** (this is two distinct flows folded into one Processor):

| Sub-operation | Entry point |
|---|---|
| Reviewer assignment | `EditorAction::addReviewer()` (`lib/pkp/classes/submission/action/EditorAction.php:70–164`) — invoked from the workflow page's "Add Reviewer" sidemodal (`PKPReviewerForm`) |
| Reviewer completes review | `PKPReviewerReviewStep3Form::execute()` (`lib/pkp/classes/submission/reviewer/form/PKPReviewerReviewStep3Form.php:161–275`) — invoked when a reviewer submits the final review-form step |

**What the production paths do**:

`EditorAction::addReviewer()`:
- Idempotency check (already assigned?)
- **`Hook::call('EditorAction::addReviewer', [&$submission, $reviewerId])`** — gives plugins a chance to bail
- `Repo::reviewAssignment()->newDataObject()` + `Repo::reviewAssignment()->add()` — fires `Hook::ReviewAssignment::add`
- `setDueDates()` — fires `Hook::EditorAction::setDueDates` then `Repo::reviewAssignment()->edit()` for `dateDue` + `dateResponseDue`
- **`createNotification(NOTIFICATION_TYPE_REVIEW_ASSIGNMENT)`** for the reviewer (LEVEL_TASK)
- **EventLog row of type `SUBMISSION_LOG_REVIEW_ASSIGN`** with reviewerName + reviewAssignment + stageId + round
- Mail send + email log entry (skipped if `skipEmail`)

`PKPReviewerReviewStep3Form::execute()`:
- `saveReviewForm` — saves review-form responses (review_form_responses)
- `updateReviewStepAndSaveSubmission` — bumps reviewStep
- `Repo::reviewAssignment()->edit($a, ['dateCompleted', 'reviewerRecommendationId'])` — fires `Hook::ReviewAssignment::edit`
- For each manager/sub-editor stage assignment:
  - **`createNotification(NOTIFICATION_TYPE_REVIEWER_COMMENT)`** for the editor
  - Sends `ReviewCompleteNotifyEditors` mail + email log entry (gated on subscription)
- **Removes the reviewer's `NOTIFICATION_TYPE_REVIEW_ASSIGNMENT`** task notification
- **EventLog row of type `SUBMISSION_LOG_REVIEW_READY`** with reviewerName + reviewAssignmentId + round

**What the Processor does today**:
- `Repo::reviewAssignment()->newDataObject()` + `Repo::reviewAssignment()->add()` — fires `Hook::ReviewAssignment::add`
- Sets `dateDue` / `dateResponseDue` directly via `createParams` — converges to the same DB row but skips `Hook::EditorAction::setDueDates`
- For non-`invited` statuses, `Repo::reviewAssignment()->edit()` — fires `Hook::ReviewAssignment::edit`
- For `completed` with `comments`, writes COMMENT_TYPE_PEER_REVIEW rows (one per `toEditor`/`toAuthor` field) via direct DAO insert — same shape the legacy review form wrote
- **Skips** assignment-time NOTIFICATION_TYPE_REVIEW_ASSIGNMENT, completion-time NOTIFICATION_TYPE_REVIEWER_COMMENT, both EventLog rows (assign + ready), reviewer-task notification removal on completion, mail sends (faked anyway)

**Discrepancies**:

| # | Gap | Severity | Recommended fix |
|---|---|---|---|
| 1 | `Hook::call('EditorAction::addReviewer')` not fired | ⚠️ minor | Plugins can't intercept. No plugin uses this in the migration suite. Defer. |
| 2 | `Hook::call('EditorAction::setDueDates')` not fired (Processor sets dates via direct field assignment) | ⚠️ minor | Same — plugin hook skip. Defer. |
| 3 | `NOTIFICATION_TYPE_REVIEW_ASSIGNMENT` task notification not created on assignment | ✅ resolved | After `Repo::reviewAssignment()->add()`, create the LEVEL_TASK notification scoped to the reviewer, contextId, ASSOC_TYPE_REVIEW_ASSIGNMENT. **Resolved** in `e2e_revamp_2` lib/pkp commit (ReviewRoundProcessor: notification + event-log fidelity). |
| 4 | `SUBMISSION_LOG_REVIEW_ASSIGN` EventLog not written | ✅ resolved | Append EventLog row after each assignment, attributing to admin. **Resolved** in same commit. |
| 5 | `NOTIFICATION_TYPE_REVIEWER_COMMENT` not created for editors when status='completed' | ✅ resolved | After completion edit, iterate Manager/Sub-editor stage assignments and create the notification per recipient. **Resolved** in same commit. |
| 6 | Reviewer's task notification not removed on status='completed' / 'declined' / 'cancelled' | ✅ resolved | When terminal status reached, delete the LEVEL_TASK notification (idempotent). **Resolved** in same commit. |
| 7 | `SUBMISSION_LOG_REVIEW_READY` EventLog not written when status='completed' | ✅ resolved | Append EventLog row when `dateCompleted` is set. **Resolved** in same commit. |
| 8 | Mail sends (review-request to reviewer; review-complete to editors) skipped | ✅ acceptable | Mail::fake() suppresses real sends; email_log rows are also skipped (acceptable — tests don't assert on email_log for review notifications). |
| 9 | `saveReviewForm` (review_form_responses table writes) not called | ✅ acceptable | Tests don't seed reviewForm responses. |
| 10 | `updateReviewStepAndSaveSubmission` not called (reviewStep field not bumped) | ⚠️ minor | The reviewStep field tracks the reviewer's UI progress; for completed reviews production sets it to step 4. Tests don't typically inspect this. **Defer**. |
| 11 | `Repo::reviewAssignment()->add()` and `->edit()` are shared writes — `ReviewAssignment::add` and `ReviewAssignment::edit` hooks fire on both paths | ✅ matches | None. |
| 12 | COMMENT_TYPE_PEER_REVIEW rows for completed reviews | ✅ matches | Same shape as the legacy review form's writes; both paths land identical rows. |

**Verdict (initial)**: ⚠️ 5 actionable gaps (#3, #4, #5, #6, #7) — all about audit-trail / notification fidelity that production lands but the Processor skipped.
**Verdict (post-fix)**: ✅ all five resolved.

#### Follow-up gaps surfaced by user-side UI inspection

After the initial sweep landed, a screenshot of the workflow's reviewer popover surfaced two more parity holes — both visible to the user but invisible to the test suite:

| # | Gap | Severity | Recommended fix |
|---|---|---|---|
| 13 | `dateDue` and `dateResponseDue` not set when the spec doesn't pass them — both default to NULL on the row, and UI surfaces that compute "days remaining / overdue" render `null days` or `overdue by 0 days` | ⚠️ partial — **user-visible** | Always default the dates from the context's `numWeeksPerReview` / `numWeeksPerResponse` (falling back to 4 / 3 weeks via `Carbon::today()->endOfDay()->addWeeks(N)` — same logic as the UI's `HasReviewDueDate` trait). **Resolved** in `e2e_revamp_2` lib/pkp commit (ReviewRound: dueDates + editor-confirm fidelity). |
| 14 | `dateConsidered` not set + `SUBMISSION_LOG_REVIEW_CONFIRMED` event-log row not written when status='completed'. Production splits the reviewer's submit (`PKPReviewerReviewStep3Form`) from the editor's confirm (`PKPReviewerGridHandler::reviewRead`) — the Processor was lumping them but only doing the reviewer half | ⚠️ partial | When status='completed', also: (a) `Repo::reviewAssignment()->edit($a, ['dateConsidered' => $now])` to mirror the editor confirm; (b) write a `SUBMISSION_LOG_REVIEW_CONFIRMED` event-log row mirroring `PKPReviewerGridHandler::reviewRead` lines 791–807. **Resolved** in same commit. |












## §2 · Remediation log

Per-discrepancy fixes. One commit per row. Audit-doc rows in §1 flip to ✅ as fixes land.

| Date | Processor | Discrepancy | Resolved by | Commit |
|---|---|---|---|---|
| 2026-04-30 | UserAssignment | `inlineHelp` left NULL on Processor-created users | Set `inlineHelp = 1` to match both production paths (RegistrationForm, UserRoleAssignmentReceive) | lib/pkp |
| 2026-04-30 | Participant | EventLog `SUBMISSION_LOG_ADD_PARTICIPANT` row not written | Mirror `Repo::eventLog()->add()` from `StageParticipantGridHandler::saveParticipant` for each participant | lib/pkp |
| 2026-04-30 | Participant | `EDITOR_ASSIGNMENT_REQUIRED` notifications not cleaned up after manager/sub-editor assignment | Delete `withAssoc(SUBMISSION, $id)->withType(EDITOR_ASSIGNMENT_REQUIRED)` once any editor lands (idempotent) | lib/pkp |
| 2026-04-30 | SubmissionBuilder | Author created without ContributorRoles linkage | `$author->setContributorRoles([AUTHOR ContributorRole])` before `Repo::author()->add()` — mirrors PKPSubmissionController::add lines 741–748 | lib/pkp |
| 2026-04-30 | Publications | `publish()` called with default submissionStatus arg, runs an extra updateStatus that production skips | Initially fixed by passing `false`; reverted after test-run feedback (publication-language-change broke because submission.status stayed STATUS_QUEUED). Default-null is correct for the Processor's consolidated shape; flagged as a deliberate divergence in §1.5. | lib/pkp |
| 2026-04-30 | Publications | After publish, AUTHOR canChangeMetadata not cleared | Iterate AUTHOR-role stage_assignments and set canChangeMetadata = 0 — mirrors PKPSubmissionController.php:1444–1453 | lib/pkp |
| 2026-04-30 | ReviewRound | REVIEW_ASSIGNMENT task notification not created on assignment | createNotification(REVIEW_ASSIGNMENT, LEVEL_TASK) after Repo::reviewAssignment()->add() — mirrors EditorAction::addReviewer | lib/pkp |
| 2026-04-30 | ReviewRound | SUBMISSION_LOG_REVIEW_ASSIGN event-log row not written | Append eventLog row after assignment — mirrors EditorAction::addReviewer lines 121–135 | lib/pkp |
| 2026-04-30 | ReviewRound | REVIEWER_COMMENT notification to editors not created on completion | Per Manager/Sub-editor stage assignment, createNotification(REVIEWER_COMMENT) — mirrors PKPReviewerReviewStep3Form lines 196–249 | lib/pkp |
| 2026-04-30 | ReviewRound | Reviewer's REVIEW_ASSIGNMENT task notification not removed on terminal status | Delete on status='completed' / 'declined' / 'cancelled' — mirrors PKPReviewerReviewStep3Form line 252 + UnassignReviewerForm line 93 | lib/pkp |
| 2026-04-30 | ReviewRound | SUBMISSION_LOG_REVIEW_READY event-log row not written on completion | Append eventLog row when dateCompleted set — mirrors PKPReviewerReviewStep3Form lines 257–272 | lib/pkp |
| 2026-04-30 | ReviewRound | `dateDue` / `dateResponseDue` defaulted to NULL when spec doesn't pass them — UI shows "overdue by 0 days" | Default from context's `numWeeksPerReview` / `numWeeksPerResponse` (or 4 / 3 weeks fallback) — mirrors HasReviewDueDate trait | lib/pkp |
| 2026-04-30 | ReviewRound | Editor "confirm review" half of the completion flow missing — `dateConsidered` not set + SUBMISSION_LOG_REVIEW_CONFIRMED event-log row not written | When status='completed', set `dateConsidered = now` and write the event-log row — mirrors PKPReviewerGridHandler::reviewRead lines 779–807 | lib/pkp |

## §3 · Post-fix performance comparison

Captured 2026-04-30, lib/pkp at `c1f6b2f567` — all Processor fixes applied (UserAssignment inlineHelp, Participant event-log + EDITOR_ASSIGNMENT_REQUIRED cleanup, SubmissionBuilder ContributorRole linkage, Publications AUTHOR canChangeMetadata clear, ReviewRound REVIEW_ASSIGNMENT/REVIEWER_COMMENT notifications + REVIEW_ASSIGN/REVIEW_READY event-log rows + task-removal on terminal status). Full Playwright suite, `--workers=2`, 143 passed / 1 skipped — same pass rate as baseline.

**Test verification**: same pass count on both runs at the time of capture (143 passed / 1 skipped). After the §1.7 follow-up commit (dueDates + editor-confirm fidelity) re-verified — all 12 reviewer/decision specs still green, including the high-traffic ones (decision-accept, decision-decline, decision-request-revisions, review-round, reviewer-assignment, decision-send-to-review, decision-send-to-production, section-editor-recommendation).

**Pre-existing flake**: `lib/pkp/playwright/tests/wizard-comments-become-discussion.spec.js` test 2 (`wizard end-to-end`) intermittently fails with `commentsForTheEditors=null` after the wizard's Submit click. **Verified independent of this audit**: the failure reproduces with all Processor changes reverted to the pre-audit `b8b47466b1` state. Likely DB state accumulation (dbarnes carries 10+ task notifications by the time the test reaches it) or a TinyMCE init race. Out of scope for the Processor parity audit; flag for separate investigation.

**Performance delta** (top buckets sorted by total time; positive Δ = post-fix slower, negative Δ = post-fix faster):

| Endpoint | Spec shape | Calls | Baseline median (ms) | Post-fix median (ms) | Δ median | Δ total |
|---|---|---|---|---|---|---|
| journal | `tag,users` | 43/43 | 1723 | 1654 | -69 (-4%) | -3053 (-4%) |
| submission | `decisions,…,publications,reviewRounds,section,submitter,tag` (full lifecycle) | 44/44 | 482 | 454 | -28 (-6%) | -1020 (-5%) |
| journal | `supportedLocales,tag,users` | 3/3 | 2140 | 1626 | -514 (-24%) | -1653 (-25%) |
| submission | `journal,…,publications,section,submitter,tag` (publish only) | 10/10 | 297 | 270 | -27 (-9%) | -481 (-15%) |
| journal | `submitWithCategories,tag,users` | 2/2 | 2114 | 1698 | -416 (-20%) | -831 (-20%) |
| journal | `name,tag,users` | 5/5 | 1879 | 1665 | -214 (-11%) | +1325 (+15%) — outlier max in post-fix run |
| submission | `decisions,…,publications,section,submitter,tag` (no review rounds) | 5/5 | 355 | 319 | -36 (-10%) | -331 (-17%) |

**Reading the numbers**:

The post-fix run is **consistently within ±10% of baseline** on all high-N buckets, with median deltas trending slightly *negative* (faster). The highest-N rows — journal (43 calls) at -4% median, full-lifecycle submission (44 calls) at -6% median — are the most reliable indicators; both are within run-to-run noise.

The larger deltas (-15% to -28%) all live in low-N buckets (1–3 calls) where individual variance dominates. The single +15% total-time outlier on the `name,tag,users` 5-call bucket is driven by one slow call in the post-fix run, not a systematic regression — the median for that bucket is still -11%.

**Conclusion**: the added side effects (notification INSERTs, event_log INSERTs, EDITOR_ASSIGNMENT_REQUIRED DELETE, ContributorRole pivot row, AUTHOR canChangeMetadata UPDATE) are all single-row operations that cost essentially nothing. **No measurable performance regression.** Both correctness and performance bars are met by the audit.

## §4 · Wave-1 endpoint extensions (2026-06-11)

Parity entries for the adjudicated wave-1 builds from
`docs/e2e/feature-inventory.md` → "Wave 1 — infrastructure work items".
Each subsection follows the §1 format: canonical flow mirrored, rows written,
deliberate skips, discrepancies.

### Audit fragment — scenario spec schema validation (dead-code fix)

For merge into `docs/scenario-processor-audit.md`.

**Finding fixed**: `PKPContextScenarioController::validateAgainstSchema()` gated Opis behind
`class_exists(\Opis\JsonSchema\Validator::class)` while `opis/json-schema` was not installed —
the whole Opis branch was dead code and validation silently degraded to "is `tag` non-empty".
Unknown spec keys (typos, keys an agent assumed existed) were accepted and silently ignored by
the processors, seeding misleading state. `PKPSubmissionScenarioController` had the same
pattern.

**Route chosen**: no JSON-schema *validator* ships in `lib/pkp/lib/vendor`
(`Illuminate\JsonSchema` in Laravel 12 is a schema **builder** only; `justinrainbow/json-schema`
and `opis/json-schema` appear in composer.lock solely as transitive require-dev entries of other
packages and are not installed). Added `opis/json-schema ^2.4` (installed 2.6.0, pulls
`opis/string` + `opis/uri`) to **require-dev** in `lib/pkp/composer.json`.

**Commit implications**: `lib/pkp/lib/vendor` is gitignored (`lib/pkp/.gitignore:3`), so only
`composer.json` + `composer.lock` are committed (in the lib/pkp repo, per commit discipline).
Developers and CI must re-run `composer install` in lib/pkp; the Playwright workflow
(`.github/workflows/playwright.yml:58`) already runs `composer install` without `--no-dev`, so
dev deps land in CI. Production tarballs built `--no-dev` will not contain the validator — fine,
because the `_test` routes only exist behind `TestModeGate` (`APPLICATION_ENV=test`), and the
controller now **throws** (`RuntimeException`, surfaces as 500 with message) if the class is
missing in test mode instead of silently skipping.

**New behavior** (`lib/pkp/api/v1/_test/PKPContextScenarioController.php::validateAgainstSchema`):
- Validation always runs in test mode; missing validator throws loudly.
- Errors are formatted via `Opis\JsonSchema\Errors\ErrorFormatter` into `"<json-pointer>: <message>"`
  lines and returned as HTTP 400 `{error: "Invalid spec", details}`. With
  `additionalProperties:false` the message names the offending key, e.g.
  `/: Additional object properties are not allowed: totallyUnknownKey` and nested paths like
  `/reviewForms/0/elements/0: Additional object properties are not allowed: wrongKey`.
- `schemaOverlayProperties(): array` (protected, default `[]`) lets app subclasses declare
  app-only spec keys (e.g. OJS `subscriptions[]` in `JournalScenarioController`); definitions are
  merged into the schema's `properties` before validation, which also exempts them from the
  `additionalProperties:false` check (draft-07 semantics).

**Knock-on effect — submission controller**: installing the package also *activates* the
previously dead Opis branch in `PKPSubmissionScenarioController::validateAgainstSchema()`
(unchanged file — owned by the submission-seeds workstream). Its schema
(`schema/submission.json`, `additionalProperties:false`) covers every spec shape in the §0
baseline (verified key diff 2026-06-11) and a canonical `submissionInReview` spec POSTed to the
endpoint passes validation, but the submission workstream should re-run its suite to confirm no
spec relies on the previous silent acceptance. The `schemaOverlayProperties` pattern was **not**
applied to the submission controller — that file is owned by the parallel submission agent and
was mid-edit; apply there separately if OJS-only submission keys appear.

**Verified** (2026-06-11, live test server): unknown top-level key → 400 naming the key; bad
enum value → 400 `(/keywords: The data should match one item from enum)`; nested unknown key →
400 with full pointer; valid specs (incl. all new keys) → 200.

### Audit fragment — context scenario schema ⇄ ContextBuilderProcessor whitelist sync

For merge into `docs/scenario-processor-audit.md` (ContextBuilderProcessor section).

**Goal**: every key the scenario schema (`lib/pkp/classes/testing/scenario/schema/context.json`)
accepts is honored by a processor, and every key a processor honors is declared in the schema.
With validation now enforced (see schema-validation.md), an undeclared key is a hard 400 and a
declared-but-unhonored key would be a silent lie — both directions matter.

#### Pre-existing gap found and fixed

| Gap | Fix |
|---|---|
| `enableAnnouncements` was in the ContextBuilderProcessor scalar whitelist but missing from the scenario schema — with enforcement on, any spec using it would have started failing | Added to schema (`boolean`) |

All other pre-existing schema keys verified as honored: `submitWithCategories`, `enableDois`,
`doiPrefix`, `doiVersioning`, `registrationAgency`, `onlineIssn`, `printIssn`,
`enablePublicComments`, `publishingMode` (scalar whitelist), `enabledDoiTypes` (array whitelist),
`copyrightNotice` (multilingual whitelist), `plugins{}` (plugin settings block), and the
core/name/locale/contact keys. `sections` / `categories` / `users` / `issues` are handled by
SectionProcessor / CategoryProcessor / UserAssignmentProcessor / OJS `afterContextCreated` —
unchanged.

#### New seedable settings (bootstrap-enrichment support)

Each name verified against the live settings form + the context entity schema
(`lib/pkp/schemas/context.json`, OJS `schemas/context.json`). All flow through
`Context::setAllData()` → `PKPContextService::add()`, i.e. the same persistence path as the
settings forms' PUT handlers. Final supported set added to both the whitelist
(`ContextBuilderProcessor.php`) and the scenario schema:

| Key | Type / values | Source of truth |
|---|---|---|
| `enableAnnouncements` | bool | `PKPAnnouncementSettingsForm.php:42` |
| `keywords` | `0` \| `'0'` \| `'enable'` \| `'request'` \| `'require'` (entity default `'request'`) | `PKPMetadataSettingsForm.php:67`; `Context::METADATA_*` (`Context.php:31-37`: DISABLE=0, ENABLE='enable', REQUEST='request', REQUIRE='require') |
| `citations` | same values (entity default `'request'`) | `PKPMetadataSettingsForm.php:181` |
| `reviewerSuggestionEnabled` | bool | `PKPReviewSetupForm.php:202`; OJS `schemas/context.json:380` |
| `defaultReviewMode` | int 1 \| 2 \| 3 (anonymous / double-anonymous / open; entity default 2) | `PKPReviewSetupForm.php:67`; `ReviewAssignment::SUBMISSION_REVIEW_METHOD_*` |
| `numWeeksPerResponse` | int ≥ 0 (entity default 4) | `PKPReviewSetupForm.php:107` |
| `numWeeksPerReview` | int ≥ 0 (entity default 4) | `PKPReviewSetupForm.php:114` |
| `numDaysBeforeReviewResponseReminderDue` | int 0–14 (UI slider bounds) | `PKPReviewSetupForm.php:146` |
| `numDaysAfterReviewResponseReminderDue` | int 0–14 | `PKPReviewSetupForm.php:156` |
| `numDaysBeforeReviewSubmitReminderDue` | int 0–14 | `PKPReviewSetupForm.php:166` |
| `numDaysAfterReviewSubmitReminderDue` | int 0–14 | `PKPReviewSetupForm.php:176` |
| `doiCreationTime` | `'copyEditCreationTime'` \| `'publicationCreationTime'` \| `'neverCreationTime'` | `PKPDoiSetupSettingsForm.php:102` (`Context::SETTING_DOI_CREATION_TIME`); `Repo::doi()::CREATION_TIME_*` |

Note the scheduled-tasks plan's earlier naming (`numDaysBefore/AfterReviewResponse|SubmitReminderDue`)
is confirmed correct — those four are exactly what `PKPReviewSetupForm` saves.

**Automatic DOI assignment on publish**: requires `enableDois: true`, a `doiPrefix`,
`enabledDoiTypes` including `'publication'` (OJS entity-schema default), and `doiCreationTime`
of `'copyEditCreationTime'` (entity default) or `'publicationCreationTime'`;
`'neverCreationTime'` = manual-only. All four knobs are now whitelisted + in the scenario schema.

Also new in the schema: `reviewForms[]` (handled by the new ReviewFormProcessor — see
reviewforms.md) and the `$defs/localizedString` helper it uses.

**Verified** (2026-06-11, live test server): a spec setting all 12 settings produced the expected
`journal_settings` rows (`keywords='require'`, `citations='request'`, `defaultReviewMode=3`,
`doiCreationTime='publicationCreationTime'`, all four reminder values, `enableAnnouncements=1`,
`reviewerSuggestionEnabled=1`, week values 2/6); `keywords: 0` persists as `'0'` (disabled), the
same representation the settings form produces.

**Verdict**: ✅ whitelist and scenario schema are in 1:1 sync (delegated keys excepted, listed above)

### Audit fragment — ReviewFormProcessor (context `reviewForms[]`)

For merge into `docs/scenario-processor-audit.md` §1.

##### ReviewFormProcessor

**File**: `lib/pkp/classes/testing/scenario/Processor/ReviewFormProcessor.php` (new)
**Domain**: `review_forms`, `review_form_settings`, `review_form_elements`, `review_form_element_settings`
**Current implementation summary**: For each `reviewForms[]` item on a context scenario spec, creates one review form (+ its elements in spec order) on the scratch context and activates it. Returns `{id, title, elementIds}` per form in the endpoint response.

**Canonical UI entry point**:
- Form / page: Settings > Workflow > Review > Review Forms grid (create form → add elements → activate)
- Controller methods:
  - `ReviewFormForm::execute()` (`lib/pkp/controllers/grid/settings/reviewForms/form/ReviewFormForm.php:89`)
  - `ReviewFormElementForm::execute()` (`lib/pkp/controllers/grid/settings/reviewForms/form/ReviewFormElementForm.php:127`)
  - `ReviewFormGridHandler::activateReviewForm()` (`lib/pkp/controllers/grid/settings/reviewForms/ReviewFormGridHandler.php:423`)

**What the production path does** (trace from the controllers):
- New form: `ReviewFormDAO::newDataObject()`; `assocType = Application::getContextAssocType()`, `assocId = contextId`, `active = 0`, `seq = REALLY_BIG_NUMBER`; localized title/description; `insertObject()`; `resequenceReviewForms(assocType, contextId)`. Trivial (toast) notification for the acting manager.
- New element: `ReviewFormElementDAO::newDataObject()`; `reviewFormId`, `seq = REALLY_BIG_NUMBER`; localized question (+description), `required` 0/1, `included` 0/1 (UI initData defaults included=1), int `elementType`; `possibleResponses` per-locale string arrays via `ListbuilderHandler::unpack` only for the multiple-response types (checkboxes/radiobuttons/dropdown), `null` otherwise; `insertObject()`; `resequenceReviewFormElements(reviewFormId)`. Trivial notification.
- Activate: re-fetch via `getById(reviewFormId, assocType, contextId)`, `setActive(1)`, `updateObject()`. Trivial notification. CSRF check (UI-transport concern).

**What the Processor does**:
- Identical DAO sequence for form + elements, including `REALLY_BIG_NUMBER` insert-then-resequence, `included` defaulting to 1 (`includedInReview` spec key), and per-locale `possibleResponses` arrays in spec order (same `updateDataObjectSettings` path ⇒ identical `setting_type='object'` JSON rows).
- Activation re-fetches the form by ID before `setActive(1) + updateObject()` — same as the grid action. (First implementation reused the in-memory object and wrote the stale `REALLY_BIG_NUMBER` seq back; caught in smoke test, fixed.)
- Element `type` accepts the UI's locale-key names (`smalltextfield`, `textfield`, `textarea`, `checkboxes`, `radiobuttons`, `dropdown`/`dropdownbox`) and maps to `ReviewFormElement::REVIEW_FORM_ELEMENT_TYPE_*`.
- Choice types without `options[]` throw (the UI cannot produce such an element either — the listbuilder always submits rows).
- Registered in `PKPContextScenarioController::context()` directly after the sections block; results merged into the response as `reviewForms` so tests can select a seeded form without scraping the settings grid.

**Discrepancies**:
| # | Gap | Severity | Recommended fix |
|---|---|---|---|
| 1 | Trivial (toast) notifications for the acting manager are not created | ✅ intentional deviation | None — session-scoped UI feedback, consistent with the other scenario processors |
| 2 | Element-level `description` not exposed in the spec | ✅ scope choice | Schema kept minimal per PRINCIPLES.md §3; extend if a plan row needs it |
| 3 | Forms are always activated; no `active:false` option | ✅ scope choice | All current plan rows need selectable forms; drive the deactivate UI in-test if needed |

**Verification** (2026-06-11, local postgres `ojs_test`): seeded 3 forms / 5 elements through the endpoint; `review_forms` rows have `assoc_type=256`, correct `assoc_id`, `seq` 1..3, `is_active=1`; element rows `seq` 1..n per form, correct `element_type/required/included`; `possibleResponses` stored as `setting_type='object'` JSON identical to UI output (same DAO code path).

**Verdict**: ✅ parity (2 documented scope choices, 1 intentional deviation)

### Audit fragment — ReviewRoundProcessor (`reviewRounds[].reviewers[].reviewForm`)

For merge into `docs/scenario-processor-audit.md` §1.

##### ReviewRoundProcessor — review form on assignment

**File**: `lib/pkp/classes/testing/scenario/Processor/ReviewRoundProcessor.php` (createParams wiring :136-143, `resolveReviewFormId` :441)
**Domain**: `review_assignments.review_form_id`
**Current implementation summary**: A reviewer spec may name a review form by title (string). At assignment time the title is resolved against the journal's *active* review forms and the resulting ID is set as `reviewFormId` in the assignment's createParams. Unknown titles fail with a message listing the active forms.

**Canonical UI entry point**:
- Form / page: workflow → review round → "Add Reviewer" form, "Review Form" dropdown
- Controller method: `ReviewerForm` (`lib/pkp/controllers/grid/users/reviewer/form/ReviewerForm.php`)

**What the production path does**:
- The dropdown is populated from `ReviewFormDAO::getActiveByAssocId(Application::getContextAssocType(), $context->getId())` (`ReviewerForm::fetch()`, :258-264) — inactive forms are not selectable.
- On save, `EditorAction::addReviewer()` creates the assignment, then the form re-validates the posted ID via `getById($reviewFormId, contextAssocType, contextId)` and stamps it with `Repo::reviewAssignment()->edit($assignment, ['dateNotified' => now, 'reviewFormId' => $reviewForm ? $reviewFormId : null, 'considered' => REVIEW_ASSIGNMENT_NEW])` (`ReviewerForm::execute()`, :366-377).

**What the Processor does**:
- `resolveReviewFormId()` iterates the same `getActiveByAssocId(contextAssocType, contextId)` set and matches the spec string against every locale of each form's `title` (exact match). The matched ID is placed in `createParams['reviewFormId']` so the single `Repo::reviewAssignment()->add()` insert lands the same row state production reaches via add-then-edit.
- No active form with the title → `RuntimeException` listing the active forms' titles (raw locale maps, so the message doesn't depend on a request context).
- Context-side `reviewForms[]` seeding is a separate capability (ReviewFormProcessor, see `reviewforms.md`); this lookup only reads existing forms.

**Discrepancies**:
| # | Gap | Severity | Recommended fix |
|---|---|---|---|
| 1 | Production sets `reviewFormId` in a post-add `edit()` (alongside `dateNotified` + `considered`); the Processor sets it at insert | ✅ same final row | The Processor already writes `dateNotified` at creation; `considered` keeps its column default, same as production's REVIEW_ASSIGNMENT_NEW. No observable difference in the row tests read. |
| 2 | Lookup is by title instead of ID | ✅ by design | Spec ergonomics — titles are the natural key tests know. Ambiguity (two active forms sharing a title) resolves to the first match; production UI would present both identically labeled options, so this mirrors the operator's ambiguity. |
| 3 | Inactive forms are not matched | ✅ matches | Same constraint as the dropdown. The error message distinguishes "no active forms" from "title not found". |

**Verification** (2026-06-11, local postgres `ojs_test`, scratch journal 151 with 3 seeded active forms): CLI harness drove `ReviewRoundProcessor::run()` against a real round; `reviewForm: "Quality assessment"` → assignment row stored `review_form_id = 3`; unknown title → `RuntimeException: No active review form titled 'No Such Form' in context 151. Active review forms: Quality assessment | Second form | Third form`. (End-to-end via the decisions pipeline was blocked by an unrelated environmental schema drift — `edit_decisions.publication_id` NOT NULL not yet populated by DecisionProcessor; flagged separately.)

**Verdict**: ✅ parity (insert-vs-edit timing note documented; same final row)

### Audit fragment — PublicationsProcessor (`publications[].galleys[]`)

For merge into `docs/scenario-processor-audit.md` §1.

##### PublicationsProcessor — galley seeding

**File**: `lib/pkp/classes/testing/scenario/Processor/PublicationsProcessor.php` (`seedGalleys` :182, `attachGalleyFile` :240, `resolveGalleyFixturePath` :278)
**Domain**: `publication_galleys`, `submission_files`, `files`, `event_log` (file-upload rows)
**Current implementation summary**: For each `galleys[]` item on a `publications[]` entry — `{label, locale?, file?, urlRemote?}` — creates the galley row and, unless it's a remote galley, attaches a PROOF-stage SubmissionFile from a bundled fixture (`default-article.pdf` by default, or any named file under `lib/pkp/playwright/fixtures/files/`). Runs before `publish()` so DOI minting / publish events see galleys exactly as production does. Galley fragments (`{id, label, locale, submissionFileId, urlRemote}`) are returned in the scenario response under each publication.

**Canonical UI entry point**:
- Form / page: Production stage → Galleys grid → "Add galley", then "Upload file" wizard
- Controller methods:
  - `ArticleGalleyForm::execute()` (`controllers/grid/articleGalleys/form/ArticleGalleyForm.php:171-193`) — galley row
  - `SubmissionFilesUploadForm::execute()` (`lib/pkp/controllers/wizard/fileUpload/form/SubmissionFilesUploadForm.php:183-238`) — file attach
  - `APP\submissionFile\Repository::add()` (`classes/submissionFile/Repository.php:40-58`) — galley↔file wiring

**What the production path does**:
- Galley row: `Repo::galley()->add(Repo::galley()->newDataObject(['publicationId', 'label', 'locale', 'urlPath' => null, 'urlRemote' => null|value]))`. No `seq` assignment by the form (column default applies).
- File attach (file galleys): copy upload into `Repo::submissionFile()->getSubmissionDir()` via `app()->get('file')->add()`; new SubmissionFile with `fileStage` (PROOF for the galley grid), `name` keyed by **submission** locale, `submissionId`, `uploaderUserId` (the acting editor), `assocType = ASSOC_TYPE_REPRESENTATION`, `assocId = galleyId`, `genreId` (picked in the wizard; Article Text by default); `Repo::submissionFile()->add()`.
- `Repo::submissionFile()->add()` fires `SubmissionFile::add` hook, writes SUBMISSION_LOG_FILE_UPLOAD + SUBMISSION_LOG_FILE_REVISION_UPLOAD event-log rows, and — OJS-side — sets `galley.submissionFileId` when `assocType === ASSOC_TYPE_REPRESENTATION`.

**What the Processor does**:
- Identical `Repo::galley()->add(newDataObject(...))` call with the same field set; `locale` defaults to the submission locale (the form requires an explicit locale; the spec default matches the common case).
- Identical SubmissionFile field set and the same `Repo::submissionFile()->add()` call, so the hook, both event-log rows, and the `galley.submissionFileId` wiring all run via the production code path.
- Remote galleys write `urlRemote` and skip the file — exactly the form's remote-galley shape.
- Setting both `file` and `urlRemote` throws (`PublicationsProcessor.php:190`); a missing fixture throws with the resolved path. Fixture names are reduced to `basename()` so specs can't traverse outside the fixtures dir.

**Discrepancies**:
| # | Gap | Severity | Recommended fix |
|---|---|---|---|
| 1 | `uploaderUserId` is attributed to `admin` instead of a journal-specific editor | ✅ intentional deviation | Processor runs out-of-session; same attribution convention as ReviewRoundProcessor's event-log rows. Extend the spec with an `uploader` key if a test ever asserts the uploader name. |
| 2 | Genre is always Article Text (`GenreLookup 'ARTICLE'`); the wizard lets the user pick any genre | ✅ scope choice | Matches the wizard default and every current plan row; extend `galleys[].genre` if needed. |
| 3 | `urlPath` not exposed in the spec | ✅ scope choice | Schema kept minimal; production form treats it as optional-null, which is what the Processor writes. |
| 4 | No trivial (toast) notification for the acting user | ✅ intentional deviation | Session-scoped UI feedback, consistently skipped by all scenario processors. |

**Verification** (2026-06-11, local postgres `ojs_test`, scratch journal 151): seeded one file galley + one remote galley + one named-fixture (`dummy.pdf`) galley. `publication_galleys` rows carry label/locale; file galley has `submission_file_id` wired by the OJS Repository hook; remote galley has `remote_url` and NULL file. `submission_files` row: `file_stage=10` (PROOF), `assoc_type=521` (ASSOC_TYPE_REPRESENTATION), `assoc_id=<galleyId>`, correct `genre_id`, `uploader_user_id=1`. Physical file present under `journals/151/articles/<id>/<uniqid>.pdf` in the files dir. Conflicting `file`+`urlRemote` spec rejected with a clear message.

**Verdict**: ✅ parity (2 intentional deviations, 2 scope choices — all documented)

### Audit fragment — PublicationsProcessor (`publications[].metadata.datePublished`)

For merge into `docs/scenario-processor-audit.md` §1.

##### PublicationsProcessor — datePublished passthrough

**File**: `lib/pkp/classes/testing/scenario/Processor/PublicationsProcessor.php` (`METADATA_FIELDS` :47-53; applied in `applyMetadataAndAttributes` :130)
**Domain**: `publications.date_published`
**Current implementation summary**: `datePublished` added to the METADATA_FIELDS passthrough so a spec's `publications[].metadata.datePublished` lands on the publication via the same `Repo::publication()->edit()` call as the other metadata. Because `applyMetadataAndAttributes()` runs before `publish()`, a predefined date now survives publish instead of being overwritten with today.

**Canonical UI entry point**:
- Form / page: Workflow → Publication → Issue tab — "Date Published" field (`classes/components/forms/publication/IssueEntryForm.php:124-128`)
- REST endpoint: `PUT /submissions/{id}/publications/{id}` → `Repo::publication()->edit()`
- Publish-time behavior: `APP\publication\Repository::setStatusOnPublish()` (`classes/publication/Repository.php:219-226`) — "If no predefined datePublished … use current date". A pre-set value is therefore preserved on publish, which is exactly the editor capability the spec mirrors.

**What the production path does**:
- Editor sets the date in the Issue tab form → validated by the publication schema → stored by `Repo::publication()->edit()`.
- On publish, `setStatusOnPublish()` only stamps `Core::getCurrentDate()` when `datePublished` is empty and the status lands on STATUS_PUBLISHED.

**What the Processor does**:
- Same `Repo::publication()->edit()` call (one merged edit with the rest of the metadata), executed before `Repo::publication()->publish()`. No special-casing: the preservation on publish comes from the production `setStatusOnPublish()` logic itself, not from Processor code.
- When the spec omits `datePublished` and publishes, behavior is unchanged: production code stamps today.

**Discrepancies**:
| # | Gap | Severity | Recommended fix |
|---|---|---|---|
| 1 | The Processor's `edit()` bypasses the REST controller's schema validation of the date format (`Y-m-d`) | ⚠️ test-input trust | Same trust level as every other metadata field in the passthrough (the Processor has never validated metadata). A malformed date fails at the DB layer with a clear SQL error. Document, don't fix. |

**Verification** (2026-06-11, local postgres `ojs_test`): spec with `metadata.datePublished = "2024-03-15"` + `published: true` → response shows `status: 3` (PUBLISHED) and `datePublished: "2024-03-15"` (spec value preserved, not today). Spec without the key continues to get the current date stamped by `setStatusOnPublish()`.

**Verdict**: ✅ parity (1 documented trust note)

### Audit fragment — SubmissionBuilderProcessor (`reviewerSuggestions[]`)

For merge into `docs/scenario-processor-audit.md` §1.

##### SubmissionBuilderProcessor — reviewer suggestions

**File**: `lib/pkp/classes/testing/scenario/Processor/SubmissionBuilderProcessor.php` (`seedReviewerSuggestions` :213; invoked at :170 — before `submit()`, matching the wizard's order)
**Domain**: `reviewer_suggestions`, `reviewer_suggestion_settings`
**Current implementation summary**: For each top-level `reviewerSuggestions[]` item — `{givenName, familyName, email, affiliation?, suggestionReason?}` — writes one `ReviewerSuggestion::create()` row with `suggestingUserId` = the spec's submitter, exactly as if the author had added the suggestion in the wizard's Reviewer Suggestions panel before clicking Submit.

**Canonical UI entry point**:
- Form / page: submission wizard → `ReviewerSuggestionsListPanel` (`lib/pkp/classes/components/listPanels/ReviewerSuggestionsListPanel.php`), one POST per suggestion while the wizard is in progress
- REST endpoint: `POST /submissions/{submissionId}/reviewers/suggestions`
- Controller method: `ReviewerSuggestionController::add()` (`lib/pkp/api/v1/reviewers/suggestions/ReviewerSuggestionController.php:155-166`)

**What the production path does**:
- `AddReviewerSuggestion` form request (`lib/pkp/api/v1/reviewers/suggestions/formRequests/AddReviewerSuggestion.php`) merges `suggestingUserId` = current user and `submissionId` from the route (`prepareForValidation()`, :105-111); validates `givenName` / `email` / `affiliation` / `suggestionReason` required, `familyName` sometimes, email unique per submission, multilingual fields as `{locale: value}` maps.
- `ReviewerSuggestion::create($validateds)` — Eloquent model with `ModelWithSettings`; `email`/IDs land on `reviewer_suggestions`, multilingual props (`givenName`, `familyName`, `affiliation`, `suggestionReason`) land in `reviewer_suggestion_settings`.
- The route is gated by `SubmissionIncompletePolicy` — suggestions can only be added while the wizard is in progress, i.e. the rows exist *before* `submit()`. No notifications, no event-log rows, no mail on this path.

**What the Processor does**:
- Identical `ReviewerSuggestion::create()` call with the same key set; plain spec strings are wrapped as `[$submissionLocale => $value]`, matching a single-locale wizard entry. Runs before the `Repo::submission()->submit()` call, mirroring wizard ordering.
- Later interaction preserved: production's `ReviewerForm::execute()` (`lib/pkp/controllers/grid/users/reviewer/form/ReviewerForm.php:407+`) looks suggestions up by reviewer email at Add Reviewer time — seeded rows are found by that query the same as wizard-created ones.

**Discrepancies**:
| # | Gap | Severity | Recommended fix |
|---|---|---|---|
| 1 | `affiliation` and `suggestionReason` optional in the spec, but required by production validation — an omitted value writes no settings row, a state the wizard can't produce | ⚠️ partial | Adjudicated spec shape keeps them optional for fixture brevity. Tests that render the suggestion details should provide both. Tighten the schema to `required` if a UI surface ever breaks on the missing settings. |
| 2 | `orcidId` not exposed in the spec | ✅ scope choice | Production treats it as optional/nullable; extend when an ORCID-suggestion plan row appears. |
| 3 | Multilingual values seeded only in the submission locale; the wizard form could post several form locales | ✅ scope choice | Single-locale is what an author typing into the panel produces in the default journal setup. |
| 4 | No uniqueness check on email per submission (production validates) | ⚠️ test-input trust | Duplicate emails in one spec would write two rows where production rejects the second. Specs control their own input; document, don't fix. |

**Verification** (2026-06-11, local postgres `ojs_test`): two suggestions seeded (one full, one minimal). `reviewer_suggestions` rows carry `suggesting_user_id` = submitter, correct `submission_id`, email; `reviewer_suggestion_settings` rows for givenName/familyName (+ affiliation/suggestionReason when provided) keyed by locale `en` — same shape `ReviewerSuggestion::create()` writes from the REST controller.

**Verdict**: ✅ parity (2 documented trust/shape notes, 2 scope choices)

### Audit fragment — UserCommentProcessor (`userComments[]`)

For merge into `docs/scenario-processor-audit.md` §1.

##### UserCommentProcessor (new)

**File**: `lib/pkp/classes/testing/scenario/Processor/UserCommentProcessor.php` (new); registered after PublicationsProcessor in `lib/pkp/api/v1/_test/PKPSubmissionScenarioController.php:124,147-149`
**Domain**: `user_comments`, `user_comment_settings`, `notifications`
**Current implementation summary**: For each top-level `userComments[]` item — `{user, text, approved?}` (approved defaults true) — writes one public reader comment on the scenario submission's current publication, exactly as the UserComment REST create path does, then applies the moderation flow's approval mutation when `approved` isn't false. Fails clearly when the current publication isn't published. Distinct from `commentsForEditor` (the wizard's stage-1 cover note).

**Canonical UI entry point**:
- Form / page: published article page comment form (reader-facing)
- REST endpoints: `POST /comments` (`UserCommentController::submit`, `lib/pkp/api/v1/comments/UserCommentController.php:269-296`); approval via `PUT /comments/{id}/setApproval` (same file, :334-364)

**What the production path does**:
- `AddComment` form request (`lib/pkp/api/v1/comments/formRequests/AddComment.php`): publication must exist and be the submission's **current** publication (`after()`); `commentText` sanitized with `PKPString::stripUnsafeHtml()` in `validated()`.
- `UserComment::query()->create(['userId', 'contextId', 'publicationId', 'commentText', 'isApproved' => false])` — comments are always born unapproved.
- `notifyModerators()` (:485-509): one LEVEL_TASK `NOTIFICATION_TYPE_USER_COMMENT_POSTED` notification (assocType ASSOC_TYPE_COMMENT) per site admin / manager in the context. No mail on this path.
- Moderator approval (`setApproval`): `isApproved = true`, `approvedAt = now()`, `approvedByUserId = <moderator>`, `save()`. The posted-comment task notification is *not* removed by approval.

**What the Processor does**:
- Validates the current publication is `STATUS_PUBLISHED` (UserCommentProcessor.php:58) — the reader form only exists on published article pages; clear `RuntimeException` otherwise.
- Identical `UserComment::query()->create()` (created with `isApproved=false` first, like production) including the `stripUnsafeHtml` sanitation; identical `notifyModerators` loop; identical approval mutation applied afterward when `approved !== false`, with notifications intentionally left in place (production keeps them too).
- Comment reports are deliberately out of scope (adjudicated constraint).

**Discrepancies**:
| # | Gap | Severity | Recommended fix |
|---|---|---|---|
| 1 | `approvedByUserId` attributed to `admin` rather than a journal manager | ✅ intentional deviation | Out-of-session convention shared with the other processors; admin is a legitimate moderator (route allows SITE_ADMIN). Extend the spec with an `approvedBy` key if a test asserts the moderator identity. |
| 2 | The commenting `user` isn't required to hold any role in the journal | ✅ matches | Production only requires an authenticated user (`has.user` middleware), not a context role. |
| 3 | Reports / `isReported` state cannot be seeded | ✅ scope choice | Adjudicated out of scope; drive the report UI in-test. |
| 4 | Comments target the current publication implicitly (no `publicationId` in the spec) | ✅ matches | Production rejects non-current publications anyway (`AddComment::after()`), so the implicit target is the only valid one. |

**Verification** (2026-06-11, local postgres `ojs_test`, scratch journal 151): seeded one approved + one pending comment on a published publication. `user_comments` rows: correct `user_id`/`context_id`/`publication_id`; `is_approved` t/f respectively; `user_comment_settings` rows `approvedAt` + `approvedByUserId` present only on the approved one. `notifications`: one row per comment — `type=16777261` (USER_COMMENT_POSTED), `assoc_type=1048592` (ASSOC_TYPE_COMMENT), `level=3` (TASK) for the context's sole moderator. Unpublished-publication spec rejected with the documented error.

**Verdict**: ✅ parity (1 intentional deviation, 1 scope choice — both documented)

##### N. SubscriptionProcessor (OJS-only)

**File**: `classes/testing/bootstrap/Processor/SubscriptionProcessor.php`
**Domain**: `subscription_types`, `subscription_type_settings`, `subscriptions`, `institutional_subscriptions`, `institutions`, `institution_settings`, `institution_ip`
**Current implementation summary**: For each `subscriptions[]` item on the journal scenario — creates one subscription type (mirroring `SubscriptionTypeForm::execute()`), then one individual subscription (mirroring `IndividualSubscriptionForm::execute()` + `SubscriptionForm::execute()`) or one institution + institutional subscription (mirroring the Institutions form's `Repo::institution()->add()` plus `InstitutionalSubscriptionForm::execute()`). Hung off `JournalScenarioController::afterContextCreated()` like IssueProcessor; OJS-only, never in the shared cross-app schema.

**Canonical UI entry points**:

| Sub-operation | Entry point |
|---|---|
| Subscription type create | Payments → Subscription Types grid → `SubscriptionTypeForm::execute()` (`controllers/grid/subscriptions/SubscriptionTypeForm.php:155`) |
| Individual subscription create | Payments → Individual Subscriptions grid → `IndividualSubscriptionForm::execute()` (`controllers/grid/subscriptions/IndividualSubscriptionForm.php:87`) on top of `SubscriptionForm::execute()` (`classes/subscription/form/SubscriptionForm.php:204`) |
| Institution create | Settings → Institutions → `Repo::institution()->add()` (`lib/pkp/classes/institution/Repository.php:150`), IP parsing in `PKP\institution\DAO::insertIPRanges()` (`lib/pkp/classes/institution/DAO.php:207`) |
| Institutional subscription create | Payments → Institutional Subscriptions grid → `InstitutionalSubscriptionForm::execute()` (`controllers/grid/subscriptions/InstitutionalSubscriptionForm.php:187`) |

**What the production paths do**:
- Type: `SubscriptionTypeDAO::newDataObject()`; sets institutional (0/1), journalId, localized name/description, `round(cost, 2)`, currency, duration (int months or null = non-expiring), format (1=online / 16=print / 17=printOnline), membership (0 when unchecked), disable_public_display (0), `setSequence(REALLY_BIG_NUMBER)`; `insertObject()` (writes `subscription_types` + `subscription_type_settings`); `resequenceSubscriptionTypes()`.
- Individual: validates user exists and has no existing individual subscription for the journal (`subscriptionExistsByUserForJournal`); sets journalId, status (one of the `SUBSCRIPTION_STATUS_*` values — "expired" is NOT a status; expiry is date-derived via `Subscription::isExpired()`), userId, typeId, membership/referenceNumber/notes (null when blank); for expiring types sets dateStart (`Y-m-d`) and dateEnd normalized to end-of-day via `mktime(23,59,59,…)`; `IndividualSubscriptionDAO::insertObject()`. Optionally sends SubscriptionNotify mail when notifyEmail is checked.
- Institutional: same base fields plus a contact user (required by the form's SubscriberSelect), institutionId (must pre-exist via Settings → Institutions), institutionMailingAddress, domain; the form requires domain OR ≥1 institution IP range for online formats; `InstitutionalSubscriptionDAO::insertObject()` writes `subscriptions` + `institutional_subscriptions`.

**What the Processor does**:
- Type: identical field-for-field path including REALLY_BIG_NUMBER + resequence; name/description localized into the journal's primary locale only; defaults: format=online, duration=12 months, cost=0, currency=USD, membership=0, public display enabled.
- Individual: requires `user` (username); enforces the same exists + no-duplicate-subscription checks; status column always `SUBSCRIPTION_STATUS_ACTIVE` — spec `status: 'expired'` means ACTIVE status + past dateEnd (default: dateEnd=yesterday end-of-day, dateStart=dateEnd−duration), matching the row a real subscription leaves behind after lapsing. Rejects `'expired'` with a future dateEnd, and any dates on non-expiring types.
- Institutional: creates the institution through `Repo::institution()->add()` with `ipRanges` in `_data` so `institution_ip` parsing (single IP / wildcards / dash ranges / CIDR) is the production DAO code; pre-validates ranges with the same grammar `PKP\institution\Repository::validate()` accepts. Requires ≥1 IP range (domain seeding unsupported — reach domain-based access via UI). Contact user defaults to bootstrap `admin` when `user` is omitted.

**Discrepancies**:

| # | Gap | Severity | Recommended fix |
|---|---|---|---|
| 1 | `notifyEmail` / SubscriptionNotify mailable not supported | ✅ matches by design | Form-only optional side effect; subscription-notify coverage is explicitly round-2 in the subscriptions-management plan. Seed leaves no mail, same as an unchecked checkbox. |
| 2 | Expired subscriptions unreachable through the create form (date validators don't forbid past dates, but the grid workflow never produces them without back-dating tricks) | ⚠️ intentional divergence | This is the seeding's purpose (subscription-access row 4, approved for build). DB shape identical to a lapsed subscription: status ACTIVE, dateEnd in the past — exactly what `IndividualSubscriptionDAO::isValidIndividualSubscription()` date-range enforcement checks. |
| 3 | Type name/description written in the journal's primary locale only; the form can post all supported locales | ✅ acceptable | Scratch journals are effectively single-locale in tests; extend to a locale-keyed object if a multilingual row ever needs it (YAGNI). |
| 4 | Institutional `domain` and `institutionMailingAddress` always empty strings | ✅ matches by design | Plan rows only need IP-range gating; blank-form parity preserved (the grid posts `''` for untouched fields, and `isValidInstitutionalSubscription()` ignores `domain = ''`). Domain matching stays UI-tested. |
| 5 | Institutional contact user defaults to `admin` when unspecified | ⚠️ documented | Production always records the picked SubscriberSelect user; `subscriptions.user_id` is NOT NULL so a real user is required. Tests asserting the contact column should pass `user` explicitly. |
| 6 | Spec `status` only exposes `active`/`expired`; the form offers needsInformation/needsApproval/awaiting* states | ✅ acceptable | No plan row consumes the other states; the grids that create them remain the behavior under test (subscriptions-management rows 6–7). |
| 7 | `publishingMode` not flipped by the seed | ✅ matches by design | Deliberate: tests pass `publishingMode` through the shared context schema so the gate configuration stays explicit in each spec. |

**Verdict**: ✅ parity with the manager-grid create paths; 1 intentional divergence (#2 — the approved reason this seed exists) and 1 documented default (#5).

##### N. MetricsProcessor (OJS-only)

**File**: `classes/testing/bootstrap/Processor/MetricsProcessor.php`
**Domain**: `metrics_submission`
**Current implementation summary**: For the submission scenario's `metrics` spec key — inserts compiled abstract-view and galley-download rows for one submission directly into `metrics_submission`, the table the Stats > Articles page reads. Hung off `SubmissionScenarioController::afterSubmissionCreated()` (OJS-only wrapper around the shared `submission()` handler; lib/pkp parent untouched). Replaces the legacy Cypress `generateTestMetrics.php` shell-out (migration roadmap row #36, dropped as fragile/environment-dependent infrastructure).

**Canonical production path** (no UI form — this data is produced by the usage-stats pipeline):
- Event capture: `PKP\observers\listeners\LogUsageEvent` appends to `usage_events_YYYYMMDD.log`.
- Nightly aggregation: `PKPUsageStatsLoader` scheduled task → temporary-table loaders → `PKPTemporaryTotalsDAO::compileSubmissionMetrics()` (`lib/pkp/classes/statistics/PKPTemporaryTotalsDAO.php:148`) inserts into `metrics_submission`:
  - abstract views: `(load_id, context_id, submission_id, assoc_type=ASSOC_TYPE_SUBMISSION, date, metric)`
  - galley downloads: `(load_id, context_id, submission_id, representation_id, submission_file_id, file_type, assoc_type=ASSOC_TYPE_SUBMISSION_FILE, date, metric)`
- Read side (parity target): `/stats/publications` → `PKPStatsPublicationController` → `StatsPublicationQueryBuilder` (`classes/services/queryBuilders/StatsPublicationQueryBuilder.php`) aggregates `metrics_submission` by `assoc_type` + `date BETWEEN` — read-only parity means the page, the date-range filter and the CSV report must render the seeded numbers indistinguishably from compiled data.

**What the Processor does**:
- Spec `{views?, downloads?, months? (default 3)}`; totals split evenly across monthly buckets (1st of current month going backwards, remainder credited to the most recent month); never writes `metric = 0` rows (the compile step's `count(*)` can't produce them).
- `load_id` per row is `usage_events_YYYYMMDD.log` of the row's date — the loader's file-naming convention.
- Download rows reuse the current publication's first galley-with-file when one exists (real `representation_id` / `submission_file_id`, `file_type` from the file's mimetype via `PKPStatisticsHelper::getDocumentType()`); otherwise IDs stay null with `file_type` = PDF.
- Two separate batched inserts (abstract vs file rows), mirroring the two `insertUsing()` calls in `compileSubmissionMetrics()`.
- Echoes the inserted rows (`date`, `assocType`, `metric`) into the scenario response so tests derive date-range filters without re-implementing the bucket layout.

**Discrepancies**:

| # | Gap | Severity | Recommended fix |
|---|---|---|---|
| 1 | Numbers are synthetic — no usage-event log, no temporary-table lifecycle, no double-click filtering ran | ⚠️ intentional, scoped | The metrics are synthetic-but-shaped-correctly; the log-processing/compilation pipeline itself is explicitly round-2 per the usage-statistics plan and inventory. Round 1 only tests the read side (date filter, CSV — plan rows 4–5). |
| 2 | Compile step does delete-by-`load_id`/date before insert (idempotent log re-processing); Processor inserts additively | ✅ intentional | The delete is an idempotency mechanism for re-running the loader, not part of the data shape; replicating it would wipe rows seeded by parallel tests sharing a date. |
| 3 | Sibling compiled tables not written: `metrics_counter_submission_daily`/`_monthly` (COUNTER R5/SUSHI), `metrics_submission_geo_*` (geo), `metrics_issue`, `metrics_context` | ⚠️ scoped | The Stats > Articles page reads only `metrics_submission`. SUSHI/COUNTER and geo correctness are round-2 per plan; extend with parallel writers if those rows are ever pulled forward. |
| 4 | When the scenario submission has no galley, download rows carry null `representation_id`/`submission_file_id` and a default PDF `file_type`; the pipeline only emits download rows for real files | ⚠️ documented | The stats page aggregates by `assoc_type` only, so totals render identically. Tests needing galley-level drill-down should add a real galley (production-stage POM) before seeding; the Processor then uses its real IDs. |
| 5 | Rows are written regardless of publication status; the pipeline only logs events on public pages (i.e. published submissions) | ✅ acceptable | Consuming rows use the `submission-published` fixture; the detail table resolves titles from published submissions, so unpublished seeding is a test-authoring error surfaced by an empty table, not silent corruption. |

**Verdict**: ✅ read-side parity for the Stats > Articles page (row shape, load_id naming, table choice identical to `compileSubmissionMetrics()`); the generation pipeline is intentionally out of scope for round 1 (#1–#3).

### Audit fragment — "decision publication_id" drift (DB drift, not Processor drift)

For merge into `docs/scenario-processor-audit.md`.

**Symptom**: every decisions-bearing scenario POST 500'd with Postgres
`null value in column "publication_id" of relation "edit_decisions" violates not-null constraint`.

**Root cause — the drift is the test DATABASE, not the Processors.** The reported diagnosis
("core added NOT NULL `edit_decisions.publication_id` + `ReviewRoundDAO::build()` gained a
`publicationId` param; DecisionProcessor must populate it") matches an **intermediate** core
state, not current core. Timeline in lib/pkp history (both commits are ancestors of the
`e2e_revamp` HEAD):

- `ebc3e4bf12` (pkp/pkp-lib#12049) added NOT NULL `publication_id` to **both**
  `edit_decisions` and `review_rounds`, and gave `ReviewRoundDAO::build()` its
  `int $publicationId` param.
- `d3b0194d5a` (pkp/pkp-lib#12800, 2026-06-05) then **removed `edit_decisions.publication_id`
  entirely** (column, FK, index, the `publicationId` schema property and DAO column mapping)
  and made `review_rounds.publication_id` **nullable** (`?int` in `build()`). The #12049
  upgrade migration was deleted outright (3.6 unreleased — install-time only), so a DB
  installed at the #12049 state has **no upgrade path**; fresh installs simply never have the
  column.

The local `ojs_test` DB had been installed under the #12049-era schema. Current production
code (post-#12800) inserts decisions **without** `publication_id`
(`insert into "edit_decisions" ("date_decided","decision","editor_id","stage_id","submission_id") …`
— reproduced live), so *any* decision recorded against that stale DB violates the leftover
NOT NULL — a real editor recording a decision through the UI would 500 identically. Note the
misdiagnosed fix is not even implementable: current core has no `publicationId` schema
property, no DAO column mapping (`lib/pkp/classes/decision/DAO.php:46`), and an empty
`settingsTable`, so no production API can write that column.

**Processor parity check (no code change needed)** — verified DecisionProcessor and
ReviewRoundProcessor already ride the exact production path:

- Decisions: `Repo::decision()->add()` (`lib/pkp/classes/decision/Repository.php:212`) —
  same call the decision form/API makes; insert columns come from
  `lib/pkp/classes/decision/DAO.php:46` (no `publicationId` since #12800).
- Round creation: neither Processor calls `ReviewRoundDAO::build()`
  (`lib/pkp/classes/submission/reviewRound/ReviewRoundDAO.php:39`,
  signature `(int $submissionId, ?int $publicationId, int $stageId, int $round, ?int $status)`)
  directly. Rounds are created by the decision cascade, exactly as in production:
  `DecisionType::runAdditionalActions` → `createReviewRound()`
  (`lib/pkp/classes/decision/DecisionType.php:511`, `build()` call at `:518`), which sources
  the publication id from `getLatestUnPublishedPublicationId()`
  (`lib/pkp/classes/decision/DecisionType.php:556`); round-2+ via
  `lib/pkp/classes/decision/types/NewExternalReviewRound.php:115`.
- Swept the rest of `lib/pkp/classes/testing/` (scenario + bootstrap Processors, OJS
  `classes/testing/`): no other use of decision or review-round write APIs — no other
  callers of the drifted signatures exist.

**Fix applied** — aligned `ojs_test` with the current fresh-install schema (what
`tools/installTest.php` produces today):

```sql
ALTER TABLE edit_decisions DROP COLUMN publication_id;   -- matches lib/pkp/classes/migration/install/SubmissionsMigration.php:196-216
ALTER TABLE review_rounds ALTER COLUMN publication_id DROP NOT NULL;  -- matches lib/pkp/classes/migration/install/ReviewsMigration.php:37
```

The existing FK + index on `review_rounds.publication_id` already match
`classes/migration/install/OJSMigration.php:278-281` and were kept. A full
`npm run test:e2e:reset` would heal this too (and is the right call for anyone hitting this
on another machine); the surgical ALTERs were chosen to preserve seeded state mid-flight for
the parallel workstreams. The bootstrap (`lib/pkp/playwright/tests/bootstrap.setup.js`) only
installs when OJS isn't installed — it cannot self-heal schema drift, so **any test DB
installed before 2026-06-05 needs the reset/ALTERs above**.

**Verified** (2026-06-11, live server `APPLICATION_ENV=test php -S 127.0.0.1:8001` + psql):

- Pre-fix: decisions-bearing spec reproduced the exact 500.
- Post-fix: spec with `decisions: [{type:'sendExternalReview', by:'dbarnes'}]` + 1 reviewer →
  200; `edit_decisions` row written (current schema has no `publication_id`);
  `review_rounds.publication_id` = the submission's latest **unpublished** publication
  (= `submissions.current_publication_id` for the seeded state), non-null as required.
- Multi-round chain `sendExternalReview → requestRevisions → newExternalRound` → 200; both
  rounds carry the correct non-null `publication_id` (covers both production round-creating
  paths: `DecisionType` stage-advance and `NewExternalReviewRound`).
- Probe submissions removed afterwards via `tools/deleteSubmissions.php`.
