# Atlas sweep: declared UI affordances
- Scope: OJS dressing only (this repo + lib/pkp + lib/ui-library; OMP/OPS variants deferred per multi-app plan §9). Files: lib/ui-library/src/pages/workflow/composables/useWorkflowConfig/{workflowConfigEditorialOJS,workflowConfigAuthorOJS}.js, useWorkflowNavigationConfig/useWorkflowNavigationConfigOJS.js, pages/dashboard/composables/{useDashboardConfig,useDashboardConfigEditorialActivity,useDashboardConfigReviewActivity,useDashboardBulkDelete}.js, managers/*/use*Config.js (all 12, every FileManager namespace)
- Method: Read each config module; one atom per declared control/column/panel from getHeaderItems/getPrimaryItems/getSecondaryItems/getActionItems/getPrimaryControlsLeft/getPrimaryControlsRight (workflow), getMenuItems (navigation), getColumns/getTopItems/getBottomItems/getItemActions + permissions matrix (managers), columns/filters/row+bulk actions (dashboards); label = locale key resolved against lib/pkp/locale/en + locale/en; role gate = permissions-matrix roles or hasCurrentUser* call; state gate = the addItemIf / if() condition verbatim; anchor = file:line (basenames are unique in scope). Atoms are DECLARED affordances — reachability requires a live probe (rule-11). Hint = best-effort FEATURE-MAP feature by screen; attribution only — Claimed-by stays empty until specs claim during builds/grooming. `declared-unreachable` = the atom exists in a shared builder but its enabling action/permission is absent from this namespace/stage's list, so it can never render on that slice; counted as declared, flagged in the gate column.
- Date: 2026-07-25
- Atom count: 471 (70 workflow editorial dressing + 54 author dressing & stage/tab navigation + 156 FileManager namespaces + 115 other managers + 76 dashboards), of which 53 declared-unreachable on their slice

## What this sweep cannot see

The sweep reads *declarative* config. Everything imperatively built is invisible; the Submission stage alone demonstrates every category:

1. **Legacy grid/wizard modal internals behind declared buttons.** The declared atom is only the launcher; the controls inside are Smarty + legacy JS. Concretely: "Upload" opens `wizard.fileUpload.FileUploadWizardHandler` (`managers/FileManager/useFileManagerActions.js`) — the genre picker, revision-detection prompt, and metadata form never appear in any config; "Activity Log" / "Library" open `informationCenter.SubmissionInformationCenterHandler` and `modals.documentLibrary.documentLibraryHandler` (`pages/workflow/composables/useWorkflowActions.js`) — the Notes tab and library-file upload grid are invisible; "Schedule For Publication" opens the legacy `modals.publish.PublishHandler` form.
2. **Manager actions that round-trip through legacy handlers.** ParticipantManager's declared "Assign"/"Edit"/"Remove"/"Notify" all execute via `grid.users.stageParticipant.StageParticipantGridHandler` legacy modals (`managers/ParticipantManager/useParticipantManagerActions.js`); the assign form's role selector and recommend-only checkbox exist only server-side.
3. **Component-internal controls.** The config declares panel *mounts*, not their buttons: DiscussionManager's add/reply controls, WorkflowSubmissionStatus's content, and the entries inside WorkflowPaymentDropdown live in SFCs/Pinia stores. Same for the decision flow: "Send for Review" opens a multi-step decision wizard whose steps/emails are PHP `Decision` classes, not UI config.
4. **Server-computed gates.** `isDecisionAvailable` and `permissions.*` are membership tests against server output — the sweep records *that* a gate exists, not *when* it opens. Affordance-reachability claims still require a live probe (per the rule-11 lesson in `feedback_verify_ui_affordances.md`).

Mitigation: AFF atoms cross-reference the GRID sweep (`atlas/grids.md`) via the `gridComponent` / `useLegacyGridUrl` component strings, which this sweep *can* extract (noted per namespace/manager where declared).

## Workflow — editorial dressing (workflowConfigEditorialOJS.js)

Conventions (per prototype): English strings resolved from `lib/pkp/locale/en/*.po` and `locale/en/*.po` (repo state 2026-07-25). Workflow decision gates go through `isDecisionAvailable(submission, DECISION_*)`, i.e. the server-computed `availableEditorialDecisions` — the client config only tests membership; the role gate for those rows is "via decision availability". Stage getters run through `consolidateCommonAndSpecificItems` (workflowConfigHelpers.js:3-20): `WorkflowConfig.common` runs first and can short-circuit the stage entry via `shouldContinue: false`.

### Workflow header (`getHeaderItems`, workflowConfigEditorialOJS.js:20-105)

Header items are shared across all stages and evaluated once here (not repeated per stage). On this full-file slice the "Preview" item is reachable (its own gate restricts it to Copyediting/Production); the prototype flagged it declared-unreachable only because that slice was Submission-only.

| Atom ID | Surface | Control (locale key → English) | Role gate | State/visibility gate | Source anchor | Hint | Claimed by |
|---|---|---|---|---|---|---|---|
| AFF-wf-header-payments | workflow header | `common.payments` → "Payments" (dropdown; label lives in WorkflowPaymentDropdown.vue) | none in config (component self-gates) | `publicationSettings.submissionPaymentsEnabled` | workflowConfigEditorialOJS.js:32-37 | payments | |
| AFF-wf-header-view | workflow header | `common.view` → "View" | none | `submission.status === STATUS_PUBLISHED` | workflowConfigEditorialOJS.js:39-47 | article-landing | |
| AFF-wf-header-preview | workflow header | `common.preview` → "Preview" | none | not published AND stage is Copyediting/Production — never visible while on Submission or Review stage | workflowConfigEditorialOJS.js:49-61 | article-landing | |
| AFF-wf-header-activity-log | workflow header | `editor.activityLog` → "Activity Log" | `permissions.canAccessEditorialHistory` (server-computed; excludes assistants/authors) | none | workflowConfigEditorialOJS.js:63-71 | editorial-activity-log | |
| AFF-wf-header-library | workflow header | `editor.submissionLibrary` → "Library" | none (anyone who can open the workflow) | none | workflowConfigEditorialOJS.js:72-78 | document-library | |
| AFF-wf-header-return-to-workflow | workflow header | `editor.submission.decision.returnToWorkflow` → "Return to Workflow" | via decision availability | `isDecisionAvailable(DECISION_RETURN_TO_WORKFLOW)` | workflowConfigEditorialOJS.js:80-90 | editorial-decisions | |
| AFF-wf-header-return-to-done | workflow header | `editor.submission.decision.returnToDone` → "Return to Done" | via decision availability | `isDecisionAvailable(DECISION_RETURN_TO_DONE)` | workflowConfigEditorialOJS.js:92-102 | editorial-decisions | |

### Common primary items (`WorkflowConfig.common.getPrimaryItems`, run before stage config)

| Atom ID | Surface | Control (locale key → English) | Role gate | State/visibility gate | Source anchor | Hint | Claimed by |
|---|---|---|---|---|---|---|---|
| AFF-wf-common-stage-access-notice | primary column | `user.authorization.accessibleWorkflowStage` → "You don't currently have access to that stage of the workflow." (WorkflowPrimaryBasicMetadata) | shown when user lacks stage access | `!permissions.accessibleStages.includes(selectedStageId)`; short-circuits (`shouldContinue: false`) — secondary/action getters return empty under the same gate | workflowConfigEditorialOJS.js:116-127, 166-171, 179-184 | workflow-stage-navigation | |
| AFF-wf-common-change-language | primary column | WorkflowChangeSubmissionLanguage (display-only here: `canChangeSubmissionLanguage: false`) | stage access | none | workflowConfigEditorialOJS.js:132-138 | publication-metadata-references | |
| AFF-wf-common-submission-status | primary column | WorkflowSubmissionStatus (status banner; content internal to component) | stage access | always pushed; stage items suppressed when stage not started (`shouldContinue` false via `hasNotSubmissionStartedStage`) | workflowConfigEditorialOJS.js:140-153 | workflow-stage-navigation | |

### Submission stage — primary / secondary panels

| Atom ID | Surface | Control (locale key → English) | Role gate | State/visibility gate | Source anchor | Hint | Claimed by |
|---|---|---|---|---|---|---|---|
| AFF-wf-sub-file-panel | primary column | FileManager panel, namespace SUBMISSION_FILES — title `submission.submit.submissionFiles` → "Submission Files"; description `fileManager.submissionFilesDescription` → "Files uploaded at the time of submission" | internal to manager (separate slice) | stage access + stage started | workflowConfigEditorialOJS.js:191-198 | submission-files | send-to-review |
| AFF-wf-sub-discussions | primary column | DiscussionManager panel (internal controls not declared here) | internal to manager | stage access + stage started | workflowConfigEditorialOJS.js:200-203 | tasks-discussions | |
| AFF-wf-sub-participants | secondary column | ParticipantManager panel (its own config: `common.assign` → "Assign", etc. — separate slice) | internal to manager | stage access | workflowConfigEditorialOJS.js:215-221 | stage-participants | |
| AFF-wf-sub-reviewer-suggestions | secondary column | ReviewerSuggestionManager panel | internal to manager | `publicationSettings.isReviewerSuggestionEnabled` | workflowConfigEditorialOJS.js:223-232 | reviewer-suggestions | |

### Submission stage — action items (`getActionItems`)

| Atom ID | Surface | Control (locale key → English) | Role gate | State/visibility gate | Source anchor | Hint | Claimed by |
|---|---|---|---|---|---|---|---|
| AFF-wf-sub-schedule-publication | action column | `editor.submission.schedulePublication` → "Schedule For Publication" (primary; navigates to publication menu) | stage access only | none — always declared (unusual: unconditional even pre-decision) | workflowConfigEditorialOJS.js:240-249 | publication-publish-flow | |
| AFF-wf-sub-send-review | action column | `editor.submission.decision.sendExternalReview` → "Send for Review" (primary) | via decision availability | `isDecisionAvailable(DECISION_EXTERNAL_REVIEW)` | workflowConfigEditorialOJS.js:250-261 | send-to-review | send-to-review |
| AFF-wf-sub-skip-review | action column | `editor.submission.decision.skipReview` → "Accept and Skip Review" (secondary) | via decision availability | `isDecisionAvailable(DECISION_SKIP_EXTERNAL_REVIEW)` | workflowConfigEditorialOJS.js:263-277 | editorial-decisions | |
| AFF-wf-sub-decline | action column | `editor.submission.decision.decline` → "Decline Submission" (warnable) | via decision availability | `isDecisionAvailable(DECISION_INITIAL_DECLINE)` | workflowConfigEditorialOJS.js:279-290 | editorial-decisions | |
| AFF-wf-sub-revert-decline | action column | `editor.submission.decision.revertDecline` → "Revert Decline" (secondary) | via decision availability | `isDecisionAvailable(DECISION_REVERT_INITIAL_DECLINE)` | workflowConfigEditorialOJS.js:292-306 | editorial-decisions | send-to-review |
| AFF-wf-sub-delete | action column | `common.delete` → "Delete" (warnable) | `hasCurrentUserAtLeastOneAssignedRoleInAnyStage([MANAGER, SITE_ADMIN])` | piggybacks `isDecisionAvailable(DECISION_REVERT_INITIAL_DECLINE)` — i.e. only offered on a declined submission | workflowConfigEditorialOJS.js:308-327 | editorial-decisions | send-to-review |

### External Review stage — primary / secondary panels

| Atom ID | Surface | Control (locale key → English) | Role gate | State/visibility gate | Source anchor | Hint | Claimed by |
|---|---|---|---|---|---|---|---|
| AFF-wf-rev-revisions-panel | primary column | FileManager panel, namespace WORKFLOW_REVIEW_REVISIONS — title `fileManager.revisionsUploaded` → "Revisions Uploaded" | internal to manager (separate slice) | stage access + stage started | workflowConfigEditorialOJS.js:344-352 | review-rounds-and-revisions | |
| AFF-wf-rev-review-files-panel | primary column | FileManager panel, namespace EDITOR_REVIEW_FILES — title `fileManager.filesForReview` → "Files for Review" | internal to manager (separate slice) | stage access + stage started | workflowConfigEditorialOJS.js:354-362 | review-rounds-and-revisions | |
| AFF-wf-rev-reviewer-manager | primary column | ReviewerManager panel (reviewer list, add/assign controls internal to manager) | internal to manager | stage access + stage started | workflowConfigEditorialOJS.js:364-373 | assign-and-manage-reviewers | |
| AFF-wf-rev-author-response | primary column | AuthorResponseRequestManager panel (author response requests for the round) | internal to manager | stage access + stage started | workflowConfigEditorialOJS.js:375-384 | review-rounds-and-revisions | |
| AFF-wf-rev-discussions | primary column | DiscussionManager panel (internal controls not declared here) | internal to manager | stage access + stage started | workflowConfigEditorialOJS.js:386-389 | tasks-discussions | |
| AFF-wf-rev-recommendations-listing | secondary column | WorkflowRecommendOnlyListingRecommendations (recommendations made by recommend-only editors) | `selectedStage.isCurrentUserDecidingEditor` | `selectedReviewRound` present | workflowConfigEditorialOJS.js:401-413 | recommend-only-editors | |
| AFF-wf-rev-participants | secondary column | ParticipantManager panel (separate slice) | internal to manager | stage access | workflowConfigEditorialOJS.js:414-420 | stage-participants | |
| AFF-wf-rev-reviewer-suggestions | secondary column | ReviewerSuggestionManager panel | internal to manager | `selectedReviewRound` present AND `publicationSettings.isReviewerSuggestionEnabled` | workflowConfigEditorialOJS.js:422-434 | reviewer-suggestions | |

### External Review stage — action items (`getActionItems`)

Guards for the whole action column (workflowConfigEditorialOJS.js:441-455): no items when there is no `selectedReviewRound`, and none when viewing a past round (`selectedReviewRound.round < currentReviewRound.round`). Recommend-only editors (`selectedStage.currentUserCanRecommendOnly`) see only WorkflowRecommendOnlyControls; the decision buttons below live in the mutually-exclusive `else` branch (workflowConfigEditorialOJS.js:459-470).

| Atom ID | Surface | Control (locale key → English) | Role gate | State/visibility gate | Source anchor | Hint | Claimed by |
|---|---|---|---|---|---|---|---|
| AFF-wf-rev-recommend-controls | action column | WorkflowRecommendOnlyControls (recommendation actions; labels internal to component) | `selectedStage.currentUserCanRecommendOnly` | current round only (see guards above) | workflowConfigEditorialOJS.js:460-469 | recommend-only-editors | |
| AFF-wf-rev-request-revisions | action column | `editor.submission.decision.requestRevisions` → "Request Revisions" (secondary) | via decision availability; not recommend-only | `isDecisionAvailable(DECISION_RESUBMIT) OR isDecisionAvailable(DECISION_PENDING_REVISIONS)` | workflowConfigEditorialOJS.js:476-492 | editorial-decisions | |
| AFF-wf-rev-accept | action column | `editor.submission.decision.accept` → "Accept Submission" (primary) | via decision availability; not recommend-only | `isDecisionAvailable(DECISION_ACCEPT)` | workflowConfigEditorialOJS.js:494-506 | editorial-decisions | |
| AFF-wf-rev-new-round | action column | `editor.submission.createNewRound` → "Create New Review Round" | via decision availability; not recommend-only | `isDecisionAvailable(DECISION_NEW_EXTERNAL_ROUND)` | workflowConfigEditorialOJS.js:508-522 | review-rounds-and-revisions | |
| AFF-wf-rev-cancel-round | action column | `editor.submission.decision.cancelReviewRound` → "Cancel Review Round" (warnable) | via decision availability; not recommend-only | `isDecisionAvailable(DECISION_CANCEL_REVIEW_ROUND)` | workflowConfigEditorialOJS.js:524-538 | review-rounds-and-revisions | |
| AFF-wf-rev-decline | action column | `editor.submission.decision.decline` → "Decline Submission" (warnable) | via decision availability; not recommend-only | `isDecisionAvailable(DECISION_DECLINE)` | workflowConfigEditorialOJS.js:540-551 | editorial-decisions | |
| AFF-wf-rev-revert-decline | action column | `editor.submission.decision.revertDecline` → "Revert Decline" (secondary) | via decision availability; not recommend-only | `isDecisionAvailable(DECISION_REVERT_DECLINE)` | workflowConfigEditorialOJS.js:553-564 | editorial-decisions | |
| AFF-wf-rev-delete | action column | `common.delete` → "Delete" (warnable) | `hasCurrentUserAtLeastOneAssignedRoleInAnyStage([MANAGER, SITE_ADMIN])`; not recommend-only | piggybacks `isDecisionAvailable(DECISION_REVERT_DECLINE)` — i.e. only offered on a declined submission | workflowConfigEditorialOJS.js:566-582 | editorial-decisions | |

### Copyediting stage (`WORKFLOW_STAGE_ID_EDITING`)

| Atom ID | Surface | Control (locale key → English) | Role gate | State/visibility gate | Source anchor | Hint | Claimed by |
|---|---|---|---|---|---|---|---|
| AFF-wf-copy-notifications | primary column | WorkflowNotificationDisplay (stage notifications; content internal to component) | stage access | stage access + stage started | workflowConfigEditorialOJS.js:591-594 | copyediting-stage | |
| AFF-wf-copy-draft-files-panel | primary column | FileManager panel, namespace FINAL_DRAFT_FILES — title `submission.finalDraft` → "Draft Files" | internal to manager (separate slice) | stage access + stage started | workflowConfigEditorialOJS.js:596-603 | copyediting-stage | |
| AFF-wf-copy-discussions | primary column | DiscussionManager panel (internal controls not declared here) | internal to manager | stage access + stage started | workflowConfigEditorialOJS.js:605-608 | tasks-discussions | |
| AFF-wf-copy-copyedited-panel | primary column | FileManager panel, namespace COPYEDITED_FILES — title `fileManager.copyeditedFiles` → "Copyedited Files" | internal to manager (separate slice) | stage access + stage started | workflowConfigEditorialOJS.js:610-617 | copyediting-stage | |
| AFF-wf-copy-participants | secondary column | ParticipantManager panel (separate slice) | internal to manager | stage access | workflowConfigEditorialOJS.js:624-630 | stage-participants | |
| AFF-wf-copy-send-production | action column | `editor.submission.decision.sendToProduction` → "Send To Production" (primary) | via decision availability | `isDecisionAvailable(DECISION_SEND_TO_PRODUCTION)` | workflowConfigEditorialOJS.js:638-649 | editorial-decisions | |
| AFF-wf-copy-back-to-review | action column | `editor.submission.decision.backFromCopyediting` → "Move to Review" (warnable) | via decision availability | `isDecisionAvailable(DECISION_BACK_FROM_COPYEDITING)` | workflowConfigEditorialOJS.js:651-665 | editorial-decisions | |

### Production stage (`WORKFLOW_STAGE_ID_PRODUCTION`)

| Atom ID | Surface | Control (locale key → English) | Role gate | State/visibility gate | Source anchor | Hint | Claimed by |
|---|---|---|---|---|---|---|---|
| AFF-wf-prod-notifications | primary column | WorkflowNotificationDisplay (stage notifications; content internal to component) | stage access | stage access + stage started | workflowConfigEditorialOJS.js:674-677 | production-stage | |
| AFF-wf-prod-ready-files-panel | primary column | FileManager panel, namespace PRODUCTION_READY_FILES — title `editor.submission.production.productionReadyFiles` → "Production Ready Files" | internal to manager (separate slice) | stage access + stage started | workflowConfigEditorialOJS.js:679-686 | production-stage | |
| AFF-wf-prod-discussions | primary column | DiscussionManager panel (internal controls not declared here) | internal to manager | stage access + stage started | workflowConfigEditorialOJS.js:688-691 | tasks-discussions | |
| AFF-wf-prod-participants | secondary column | ParticipantManager panel (separate slice) | internal to manager | stage access | workflowConfigEditorialOJS.js:697-703 | stage-participants | |
| AFF-wf-prod-schedule-publication | action column | `editor.submission.schedulePublication` → "Schedule For Publication" (primary; navigates to publication menu) | stage access only | none — always declared (unconditional, same as on Submission) | workflowConfigEditorialOJS.js:710-720 | publication-publish-flow | |
| AFF-wf-prod-back-to-copyediting | action column | `editor.submission.decision.backToCopyediting` → "Move To Copyediting" (warnable) | via decision availability | `isDecisionAvailable(DECISION_BACK_FROM_PRODUCTION)` | workflowConfigEditorialOJS.js:722-736 | editorial-decisions | |

### Publication config — common (`PublicationConfig.common`)

All right-side controls require `permissions.canPublish` — the getter returns `[]` before declaring anything (workflowConfigEditorialOJS.js:802-804). The three status branches (queued/ready vs scheduled vs published) are mutually exclusive; "Preview" is declared separately in two branches, so it gets two atoms.

| Atom ID | Surface | Control (locale key → English) | Role gate | State/visibility gate | Source anchor | Hint | Claimed by |
|---|---|---|---|---|---|---|---|
| AFF-wf-pub-common-edit-warning | publication tab, primary column | WorkflowPublicationEditWarning (banner; content internal to component) | none | `selectedPublication.status === STATUS_PUBLISHED` | workflowConfigEditorialOJS.js:751-758 | publication-versioning | |
| AFF-wf-pub-common-change-language | publication controls left | WorkflowChangeSubmissionLanguage (editable here: `canChangeSubmissionLanguage: permissions.canChangeSubmissionLanguage`) | `permissions.canChangeSubmissionLanguage` (for the edit affordance; component still renders display) | `submission.status !== STATUS_PUBLISHED AND submission.publications.length < 2` | workflowConfigEditorialOJS.js:769-781 | publication-metadata-references | |
| AFF-wf-pub-common-version-control | publication controls left | WorkflowPublicationVersionControl (version picker; labels internal to component) | none in config | none — always declared | workflowConfigEditorialOJS.js:783-789 | publication-versioning | |
| AFF-wf-pub-common-preview-prepublish | publication controls right | `common.preview` → "Preview" (secondary) | `permissions.canPublish` | publication status is QUEUED / READY_TO_PUBLISH / READY_TO_SCHEDULE AND `hasSubmissionPassedStage(WORKFLOW_STAGE_ID_EXTERNAL_REVIEW)` | workflowConfigEditorialOJS.js:812-826 | publication-publish-flow | |
| AFF-wf-pub-common-publish-schedule | publication controls right | `publication.publish` → "Publish" when submission already published, else `editor.submission.schedulePublication` → "Schedule For Publication" (secondary) | `permissions.canPublish` | publication status is QUEUED / READY_TO_PUBLISH / READY_TO_SCHEDULE | workflowConfigEditorialOJS.js:828-841 | publication-publish-flow | |
| AFF-wf-pub-common-preview-scheduled | publication controls right | `common.preview` → "Preview" (secondary) | `permissions.canPublish` | `selectedPublication.status === STATUS_SCHEDULED` | workflowConfigEditorialOJS.js:845-852 | publication-publish-flow | |
| AFF-wf-pub-common-unschedule | publication controls right | `publication.unschedule` → "Unschedule" (warnable) | `permissions.canPublish` | `selectedPublication.status === STATUS_SCHEDULED` | workflowConfigEditorialOJS.js:854-861 | publication-publish-flow | |
| AFF-wf-pub-common-unpublish | publication controls right | `publication.unpublish` → "Unpublish" (warnable) | `permissions.canPublish` | `selectedPublication.status === STATUS_PUBLISHED` | workflowConfigEditorialOJS.js:862-872 | publication-publish-flow | |

### Publication config — tab entries

Each tab declares a single panel mount; controls inside are internal to the form/manager component (separate slices). Tab visibility itself is declared in the navigation config (`useWorkflowNavigationConfigOJS.js` — not this file), so the state gate here is "none" unless the entry declares one. `permissions.canEditPublication` is passed as `canEdit` (edit vs read-only inside the component), not a visibility gate.

| Atom ID | Surface | Control (locale key → English) | Role gate | State/visibility gate | Source anchor | Hint | Claimed by |
|---|---|---|---|---|---|---|---|
| AFF-wf-pub-title-abstract-form | publication tab (titleAbstract) | WorkflowPublicationForm, formName `titleAbstract` (field labels server-side) | `canEdit: permissions.canEditPublication` | none | workflowConfigEditorialOJS.js:886-894 | publication-title-abstract-body | |
| AFF-wf-pub-contributors-panel | publication tab (contributors) | ContributorManager panel (internal controls not declared here) | `canEdit: permissions.canEditPublication` | none | workflowConfigEditorialOJS.js:906-913 | contributors | |
| AFF-wf-pub-metadata-form | publication tab (metadata) | WorkflowPublicationForm, formName `metadata` (fallback message "No metadata fields are currently enabled." is a hard-coded string, not a locale key) | `canEdit: permissions.canEditPublication` | none | workflowConfigEditorialOJS.js:925-934 | publication-metadata-references | |
| AFF-wf-pub-citations-panel | publication tab (citations) | CitationManager panel (references; internal controls not declared here) | `canEdit: permissions.canEditPublication` | none; `citationsMetadataLookup` from `pageInitConfig.contextCitationsMetadataLookup ?? false` toggles lookup features inside | workflowConfigEditorialOJS.js:946-956 | publication-metadata-references | |
| AFF-wf-pub-data-availability-form | publication tab (dataAvailabilityAndCitation) | WorkflowPublicationForm, formName `dataAvailability` | `canEdit: permissions.canEditPublication` | none | workflowConfigEditorialOJS.js:968-976 | data-availability-citations | |
| AFF-wf-pub-data-citations-panel | publication tab (dataAvailabilityAndCitation) | DataCitationManager panel (internal controls not declared here) | none in config | `pageInitConfig?.publicationSettings?.supportsDataCitations` | workflowConfigEditorialOJS.js:978-988 | data-availability-citations | |
| AFF-wf-pub-identifiers-form | publication tab (identifiers) | WorkflowPublicationForm, formName `identifier` | `canEdit: permissions.canEditPublication` | none | workflowConfigEditorialOJS.js:1001-1009 | publication-identifiers | |
| AFF-wf-pub-body-text | publication tab (bodyText) | WorkflowPublicationBodyText (body text editor; controls internal to component — note: no `canEdit` prop passed) | none in config | none | workflowConfigEditorialOJS.js:1021-1027 | publication-title-abstract-body | |
| AFF-wf-pub-jats | publication tab (jats) | WorkflowPublicationJats (JATS XML panel; internal controls not declared here) | `canEdit: permissions.canEditPublication` | none | workflowConfigEditorialOJS.js:1039-1046 | | |
| AFF-wf-pub-galleys-panel | publication tab (galleys) | GalleyManager panel (internal controls not declared here) | `canEdit: permissions.canEditPublication` | none | workflowConfigEditorialOJS.js:1053-1060 | galleys | |
| AFF-wf-pub-media-panel | publication tab (media) | MediaFileManager panel (internal controls not declared here) | `canEdit: permissions.canEditPublication` | none | workflowConfigEditorialOJS.js:1067-1074 | media-files | |
| AFF-wf-pub-license-form | publication tab (license) | WorkflowPublicationForm, formName `permissionDisclosure` | `canEdit: permissions.canEditPublication` | none | workflowConfigEditorialOJS.js:1086-1094 | publication-license | |
| AFF-wf-pub-issue-form | publication tab (issue) | WorkflowPublicationForm, formName `issue` (`issueCount` from `publicationSettings.countIssues`) | `canEdit: permissions.canEditPublication` | none | workflowConfigEditorialOJS.js:1106-1115 | publication-issue-assignment | |

<!-- section-count: 70 atoms, 0 declared-unreachable -->

Conventions for the two author-dressing/navigation sections below:
- Dressing selection (`useWorkflowConfigOJS.js:7-14`): the author dressing is used whenever `dashboardPage !== EDITORIAL_DASHBOARD` — i.e. both MY_SUBMISSIONS and MY_REVIEW_ASSIGNMENTS resolve to `workflowConfigAuthorOJS.js`.
- `common` getters run first via `consolidateCommonAndSpecificItems` (workflowConfigHelpers.js:3-20); `shouldContinue: false` short-circuits the stage-specific getter.
- File-panel role gates come from the FileManager permission matrix for the mounted namespace (`useFileManagerConfig.js`); only the panel mount is an atom here — internal file-panel controls belong to the FileManager slice.

## Workflow — author dressing (workflowConfigAuthorOJS.js)

### Workflow header (`getHeaderItems`, workflowConfigAuthorOJS.js:14-34)

Unlike the editorial dressing, the author header declares a single item — no Payments dropdown, no View/Preview, no Activity Log, no return-to-workflow decisions.

| Atom ID | Surface | Control (locale key → English) | Role gate | State/visibility gate | Source anchor | Hint | Claimed by |
|---|---|---|---|---|---|---|---|
| AFF-wfa-header-library | workflow header | `editor.submissionLibrary` → "Library" | none (anyone who can open the author workflow) | `submission` present (guard at :19-21) | workflowConfigAuthorOJS.js:25-31 | submission-files | |

### Common primary items (`WorkflowConfig.common`, run before stage config)

| Atom ID | Surface | Control (locale key → English) | Role gate | State/visibility gate | Source anchor | Hint | Claimed by |
|---|---|---|---|---|---|---|---|
| AFF-wfa-common-stage-access-notice | primary column | `user.authorization.accessibleWorkflowStage` → "You don't currently have access to that stage of the workflow." (WorkflowPrimaryBasicMetadata) | shown when user lacks stage access | `!permissions.accessibleStages.includes(selectedStageId)`; short-circuits (`shouldContinue: false`) — secondary/action getters return empty under the same gate | workflowConfigAuthorOJS.js:45-57, 95-100, 108-113 | author-dashboard | |
| AFF-wfa-common-change-language | primary column | WorkflowChangeSubmissionLanguage (display-only here: `canChangeSubmissionLanguage: false`) | stage access | none | workflowConfigAuthorOJS.js:61-67 | author-dashboard | |
| AFF-wfa-common-submission-status | primary column | WorkflowSubmissionStatus (status banner; content internal to component) | stage access | always pushed; stage items suppressed when stage not started (`shouldContinue = !hasNotSubmissionStartedStage(...)` at :69-72) | workflowConfigAuthorOJS.js:74-82 | author-dashboard | |

### Submission stage (`WorkflowConfig[WORKFLOW_STAGE_ID_SUBMISSION]`)

No stage-specific `getSecondaryItems`/`getActionItems` on the author dressing for this stage — authors get no action column here.

| Atom ID | Surface | Control (locale key → English) | Role gate | State/visibility gate | Source anchor | Hint | Claimed by |
|---|---|---|---|---|---|---|---|
| AFF-wfa-sub-passed-status | primary column | SubmissionStatus (stage-passed banner; content internal to component) | stage access | `hasSubmissionPassedStage(submission, WORKFLOW_STAGE_ID_SUBMISSION)` | workflowConfigAuthorOJS.js:120-127 | author-dashboard | |
| AFF-wfa-sub-file-panel | primary column | FileManager panel, namespace SUBMISSION_FILES — title `submission.submit.submissionFiles` → "Submission Files"; description `fileManager.submissionFilesDescription` → "Files uploaded at the time of submission" | matrix: Author assigned in stage → LIST, EDIT, DOWNLOAD_ALL (no upload here) | stage access + stage started | workflowConfigAuthorOJS.js:129-136 | submission-files | send-to-review |
| AFF-wfa-sub-discussions | primary column | DiscussionManager panel (internal controls not declared here) | internal to manager | stage access + stage started | workflowConfigAuthorOJS.js:138-141 | tasks-discussions | |

### External Review stage (`WorkflowConfig[WORKFLOW_STAGE_ID_EXTERNAL_REVIEW]`)

| Atom ID | Surface | Control (locale key → English) | Role gate | State/visibility gate | Source anchor | Hint | Claimed by |
|---|---|---|---|---|---|---|---|
| AFF-wfa-rev-listing-emails | primary column | WorkflowListingEmails (decision emails shown to the author; content internal to component) | stage access | none | workflowConfigAuthorOJS.js:157-160 | review-rounds-and-revisions | |
| AFF-wfa-rev-reviewer-manager | primary column | ReviewerManager panel with `redactedForAuthors: true` (author-safe view of reviews) | internal to manager (redacted) | `getOpenAndCompletedReviewAssignmentsForRound(submission.reviewAssignments, selectedReviewRound.id).length` | workflowConfigAuthorOJS.js:162-178 | review-rounds-and-revisions | |
| AFF-wfa-rev-revisions-panel | primary column | FileManager panel, namespace WORKFLOW_REVIEW_REVISIONS — title `fileManager.revisionsUploaded` → "Revisions Uploaded"; description `fileManager.revisionsUploadedDescription` → "These files have been submitted by the author after revisions were requested" | matrix: Author assigned in stage → LIST, UPLOAD, EDIT, DELETE | stage access + stage started | workflowConfigAuthorOJS.js:179-187 | review-rounds-and-revisions | |
| AFF-wfa-rev-discussions | primary column | DiscussionManager panel (internal controls not declared here) | internal to manager | stage access + stage started | workflowConfigAuthorOJS.js:189-192 | tasks-discussions | |
| AFF-wfa-rev-author-response | primary column | AuthorResponseManager panel (internal controls not declared here) | internal to manager | `selectedReviewRound?.isAuthorResponseRequested` OR round status in {REVIEW_ROUND_STATUS_ACCEPTED, REVIEW_ROUND_STATUS_REVISIONS_REQUESTED} | workflowConfigAuthorOJS.js:198-213 | review-rounds-and-revisions | |
| AFF-wfa-rev-upload-revisions | action column | `workflow.uploadRevisions` → "Upload revisions" (WorkflowActionButton → FILE_UPLOAD wizard; wizard title `editor.submissionReview.uploadFile` → "Upload Review File") | stage access | `selectedReviewRound` AND round status in {REVISIONS_REQUESTED, RESUBMIT_FOR_REVIEW, REVISIONS_SUBMITTED} (REVISIONS_SUBMITTED is listed twice in the source array — harmless duplicate) | workflowConfigAuthorOJS.js:217-243 | review-rounds-and-revisions | |

### Copyediting stage (`WorkflowConfig[WORKFLOW_STAGE_ID_EDITING]`)

| Atom ID | Surface | Control (locale key → English) | Role gate | State/visibility gate | Source anchor | Hint | Claimed by |
|---|---|---|---|---|---|---|---|
| AFF-wfa-copy-discussions | primary column | DiscussionManager panel (internal controls not declared here) | internal to manager | stage access + stage started | workflowConfigAuthorOJS.js:251-254 | tasks-discussions | |
| AFF-wfa-copy-copyedited-panel | primary column | FileManager panel, namespace COPYEDITED_FILES — title `fileManager.copyeditedFiles` → "Copyedited Files"; description `fileManager.copyeditedFilesDescription` → "These are edited files that will be taken to the production stage" | matrix: Author assigned in stage → FILE_LIST only (read-only for authors) | stage access + stage started | workflowConfigAuthorOJS.js:256-263 | copyediting-stage | |

### Production stage (`WorkflowConfig[WORKFLOW_STAGE_ID_PRODUCTION]`)

| Atom ID | Surface | Control (locale key → English) | Role gate | State/visibility gate | Source anchor | Hint | Claimed by |
|---|---|---|---|---|---|---|---|
| AFF-wfa-prod-discussions | primary column | DiscussionManager panel (internal controls not declared here) | internal to manager | stage access + stage started | workflowConfigAuthorOJS.js:272-275 | tasks-discussions | |

### Publication tabs — common (`PublicationConfig.common`)

| Atom ID | Surface | Control (locale key → English) | Role gate | State/visibility gate | Source anchor | Hint | Claimed by |
|---|---|---|---|---|---|---|---|
| AFF-wfa-pub-common-edit-disabled | publication tab, primary column | WorkflowPublicationEditDisabled (published-version-is-read-only notice; content internal to component) | none | `selectedPublication.status === STATUS_PUBLISHED` | workflowConfigAuthorOJS.js:290-297 | publication-versioning | |
| AFF-wfa-pub-common-version-control | publication tab, primary controls left | WorkflowPublicationVersionControl (version selector; content internal to component) | none | none (always pushed) | workflowConfigAuthorOJS.js:307-313 | publication-versioning | |

### Publication tabs — per-tab entries (`PublicationConfig.<tab>`)

Tab reachability is decided by the navigation config (see the author publication-tab atoms below); the author dressing declares config only for the seven tabs the author nav lists — no identifiers/jats/bodyText/license/issue entries exist here.

| Atom ID | Surface | Control (locale key → English) | Role gate | State/visibility gate | Source anchor | Hint | Claimed by |
|---|---|---|---|---|---|---|---|
| AFF-wfa-pub-title-abstract-form | Title & Abstract tab | WorkflowPublicationForm `titleAbstract` (fields server-defined) | `canEdit: permissions.canEditPublication` (server-computed; display-only otherwise) | none | workflowConfigAuthorOJS.js:318-337 | publication-title-abstract-body | |
| AFF-wfa-pub-contributors-manager | Contributors tab | ContributorManager panel (internal controls not declared here) | internal to manager | none | workflowConfigAuthorOJS.js:338-355 | contributors | |
| AFF-wfa-pub-metadata-form | Metadata tab | WorkflowPublicationForm `metadata` (fields server-defined; hardcoded English `noFieldsMessage: "No metadata fields are currently enabled."`) | `canEdit: permissions.canEditPublication` | none | workflowConfigAuthorOJS.js:356-376 | publication-metadata-references | |
| AFF-wfa-pub-citations-manager | References tab | CitationManager panel (`citationsMetadataLookup` from `pageInitConfig.contextCitationsMetadataLookup`) | `canEdit: permissions.canEditPublication` | none in config (tab itself nav-gated by `publicationSettings.supportsCitations`) | workflowConfigAuthorOJS.js:377-398 | publication-metadata-references | |
| AFF-wfa-pub-data-availability-form | Data tab | WorkflowPublicationForm `dataAvailability` (fields server-defined) | `canEdit: permissions.canEditPublication` | none in config (tab nav-gated, see AFF-nav-pub-author-data) | workflowConfigAuthorOJS.js:406-415 | data-availability-citations | |
| AFF-wfa-pub-data-citation-manager | Data tab | DataCitationManager panel (edit form from `pageInitConfig.componentForms.dataCitationEditForm`) | internal to manager | none in config (tab nav-gated, see AFF-nav-pub-author-data) | workflowConfigAuthorOJS.js:416-424 | data-availability-citations | |
| AFF-wfa-pub-galleys-manager | Galleys tab | GalleyManager panel (internal controls not declared here) | internal to manager | none | workflowConfigAuthorOJS.js:428-440 | galleys | |
| AFF-wfa-pub-media-manager | Media tab | MediaFileManager panel (internal controls not declared here) | internal to manager | none | workflowConfigAuthorOJS.js:441-453 | media-files | |

## Workflow stage/tab navigation (useWorkflowNavigationConfigOJS.js)

This single nav config serves all OJS dashboard page types; role/dressing differences are expressed as `pageInitConfig.dashboardPage` and `permissions.*` tests, recorded verbatim below. Accessible titles are composed via `semicolon` → "{$label}: " with `manager.workflow` → "Workflow" or `submission.publication` → "Publication" (getWorkflowTitle/getPublicationTitle, :44-52) — title logic only, not separate atoms.

### Top-level menu (`getMenuItems`, useWorkflowNavigationConfigOJS.js:391-420)

| Atom ID | Surface | Control (locale key → English) | Role gate | State/visibility gate | Source anchor | Hint | Claimed by |
|---|---|---|---|---|---|---|---|
| AFF-nav-workflow-root | side menu | `manager.workflow` → "Workflow" (icon Dashboard; parent of stage items) | none | `submission` present (guard at :392-394) | useWorkflowNavigationConfigOJS.js:398-403 | workflow-stage-navigation | |
| AFF-nav-publication-root | side menu | `submission.publication` → "Publication" (icon MySubmissions; parent of version items) | `pageInitConfig.dashboardPage` in {EDITORIAL_DASHBOARD, MY_SUBMISSIONS} — hidden on MY_REVIEW_ASSIGNMENTS | `submission` present | useWorkflowNavigationConfigOJS.js:405-417 | workflow-stage-navigation | |

### Workflow stage items (`getWorkflowItems`, :108-156)

`colorStripe` (StageColors, :8-15) is applied only when the stage is the submission's active stage — badge styling, not a gate.

| Atom ID | Surface | Control (locale key → English) | Role gate | State/visibility gate | Source anchor | Hint | Claimed by |
|---|---|---|---|---|---|---|---|
| AFF-nav-stage-submission | Workflow menu | `manager.publication.submissionStage` → "Submission" | none | always declared | useWorkflowNavigationConfigOJS.js:121-127 | workflow-stage-navigation | |
| AFF-nav-stage-review | Workflow menu | `manager.publication.reviewStage` → "Review" (parent of round items) | none | always declared (even with zero rounds; children empty until a round exists) | useWorkflowNavigationConfigOJS.js:129-137 | workflow-stage-navigation | |
| AFF-nav-stage-review-round | Workflow menu, under Review | `workflow.reviewRoundN` → "Review Round {$number}"; accessible title `submission.stage.externalReviewWithRound` → "Review (Round {$round})" | none | one item per round from `getReviewRoundsForStage`; OJS only builds these for EXTERNAL_REVIEW (:113-117) — the `submission.stage.internalReviewWithRound` TitleKeys branch (:69-70) is dead code on OJS, noted, not a separate atom | useWorkflowNavigationConfigOJS.js:73-101 | review-rounds-and-revisions | |
| AFF-nav-stage-copyediting | Workflow menu | `submission.copyediting` → "Copyediting" | none | always declared | useWorkflowNavigationConfigOJS.js:139-145 | workflow-stage-navigation | |
| AFF-nav-stage-production | Workflow menu | `manager.publication.productionStage` → "Production" | none | always declared | useWorkflowNavigationConfigOJS.js:147-153 | workflow-stage-navigation | |

### Publication version items (`getPublicationVersionItems`, :232-271)

| Atom ID | Surface | Control (locale key → English) | Role gate | State/visibility gate | Source anchor | Hint | Claimed by |
|---|---|---|---|---|---|---|---|
| AFF-nav-pub-version | Publication menu | per-publication item, label `publication.versionString` (server-provided, no locale key); children = editorial or author tab set | editorial branch: `dashboardPage === EDITORIAL_DASHBOARD && permissions.canAccessPublication`; author branch: `dashboardPage === MY_SUBMISSIONS`; an editor without `canAccessPublication` gets no version items at all | `submission.publications.length` (guard at :233-235); one item per publication | useWorkflowNavigationConfigOJS.js:240-260 | publication-versioning | |
| AFF-nav-pub-create-version | Publication menu | `publication.createVersion` → "Create New Version" (action item, `action: 'createNewVersion'`) | `permissions.canPublish` | none beyond role gate | useWorkflowNavigationConfigOJS.js:262-268 | publication-versioning | |

### Author publication tabs (`getPublicationItemsAuthor`, :158-230; used when `dashboardPage === MY_SUBMISSIONS`)

| Atom ID | Surface | Control (locale key → English) | Role gate | State/visibility gate | Source anchor | Hint | Claimed by |
|---|---|---|---|---|---|---|---|
| AFF-nav-pub-author-title-abstract | Publication menu, version children | `publication.titleAbstract` → "Title & Abstract" | author branch (see AFF-nav-pub-version) | `publication?.id` (guard at :159-161) | useWorkflowNavigationConfigOJS.js:166-172 | publication-title-abstract-body | |
| AFF-nav-pub-author-contributors | Publication menu, version children | `publication.contributors` → "Contributors" | author branch | none | useWorkflowNavigationConfigOJS.js:174-180 | contributors | |
| AFF-nav-pub-author-metadata | Publication menu, version children | `article.metadata` → "Metadata" | author branch | none | useWorkflowNavigationConfigOJS.js:182-188 | publication-metadata-references | |
| AFF-nav-pub-author-citations | Publication menu, version children | `submission.citations` → "References" | author branch | `publicationSettings.supportsCitations` | useWorkflowNavigationConfigOJS.js:190-198 | publication-metadata-references | |
| AFF-nav-pub-author-data | Publication menu, version children | `submission.dataAvailabilityAndCitation.data` → "Data" | author branch | `publicationSettings.supportsDataCitations OR publicationSettings.supportsDataAvailability` | useWorkflowNavigationConfigOJS.js:200-211 | data-availability-citations | |
| AFF-nav-pub-author-galleys | Publication menu, version children | `submission.layout.galleys` → "Galleys" | author branch (no `canAccessProduction` gate, unlike editorial) | none | useWorkflowNavigationConfigOJS.js:213-219 | galleys | |
| AFF-nav-pub-author-media | Publication menu, version children | `publication.media` → "Media" | author branch (no `canAccessProduction` gate, unlike editorial) | none | useWorkflowNavigationConfigOJS.js:221-227 | media-files | |

### Editorial publication tabs (`getPublicationItemsEditorial`, :273-389; used when `dashboardPage === EDITORIAL_DASHBOARD && permissions.canAccessPublication`)

| Atom ID | Surface | Control (locale key → English) | Role gate | State/visibility gate | Source anchor | Hint | Claimed by |
|---|---|---|---|---|---|---|---|
| AFF-nav-pub-editorial-title-abstract | Publication menu, version children | `publication.titleAbstract` → "Title & Abstract" | editorial branch (see AFF-nav-pub-version) | `publication?.id` (guard at :274-276) | useWorkflowNavigationConfigOJS.js:281-287 | publication-title-abstract-body | |
| AFF-nav-pub-editorial-contributors | Publication menu, version children | `publication.contributors` → "Contributors" | editorial branch | none | useWorkflowNavigationConfigOJS.js:289-295 | contributors | |
| AFF-nav-pub-editorial-metadata | Publication menu, version children | `article.metadata` → "Metadata" | editorial branch | none | useWorkflowNavigationConfigOJS.js:297-303 | publication-metadata-references | |
| AFF-nav-pub-editorial-citations | Publication menu, version children | `submission.citations` → "References" | editorial branch | `publicationSettings.supportsCitations` | useWorkflowNavigationConfigOJS.js:305-313 | publication-metadata-references | |
| AFF-nav-pub-editorial-data | Publication menu, version children | `submission.dataAvailabilityAndCitation.data` → "Data" | editorial branch | `publicationSettings.supportsDataCitations OR publicationSettings.supportsDataAvailability` | useWorkflowNavigationConfigOJS.js:315-326 | data-availability-citations | |
| AFF-nav-pub-editorial-identifiers | Publication menu, version children | `submission.identifiers` → "Identifiers" | editorial branch | `publicationSettings.identifiersEnabled` | useWorkflowNavigationConfigOJS.js:328-336 | publication-identifiers | |
| AFF-nav-pub-editorial-jats | Publication menu, version children | `publication.jats` → "JATS XML" | editorial branch | none | useWorkflowNavigationConfigOJS.js:338-344 | workflow-stage-navigation | |
| AFF-nav-pub-editorial-body-text | Publication menu, version children | `publication.bodyText` → "Body Text" | editorial branch + `permissions.canAccessProduction` | none | useWorkflowNavigationConfigOJS.js:347-353 | publication-title-abstract-body | |
| AFF-nav-pub-editorial-galleys | Publication menu, version children | `submission.layout.galleys` → "Galleys" | editorial branch + `permissions.canAccessProduction` | none | useWorkflowNavigationConfigOJS.js:355-361 | galleys | |
| AFF-nav-pub-editorial-media | Publication menu, version children | `publication.media` → "Media" | editorial branch + `permissions.canAccessProduction` | none | useWorkflowNavigationConfigOJS.js:363-369 | media-files | |
| AFF-nav-pub-editorial-license | Publication menu, version children | `publication.publicationLicense` → "Permissions & Disclosure" | editorial branch + `permissions.canAccessProduction` | none | useWorkflowNavigationConfigOJS.js:371-377 | publication-license | |
| AFF-nav-pub-editorial-issue | Publication menu, version children | `publication.publicationSettings` → "Publication Settings" (issue assignment tab) | editorial branch + `permissions.canAccessProduction` | none | useWorkflowNavigationConfigOJS.js:379-385 | publication-issue-assignment | |

<!-- section-count: 54 atoms, 0 declared-unreachable -->

## FileManager namespaces (useFileManagerConfig.js)

Slice: `lib/ui-library/src/managers/FileManager/useFileManagerConfig.js` — all 12 namespaces in `FileManagerConfigurations`, each evaluated against the shared builders `getColumns` (:409-450), `getTopItems` (:452-477), `getBottomItems` (:479-494), `getItemActions` (:496-539). Role gates everywhere go through `hasCurrentUserAtLeastOneAssignedRoleInStage` (:384-395) — an *assigned* role in the current stage, not merely holding the role in the journal. "declared-unreachable here" = the atom exists in the shared builder but its enabling action is absent from this namespace's action list, so it can never render on this slice. The six `*_SELECT` variants are consumed by `getFileManagerUploadNamespaces` (:576-607) as file-source lists inside the upload/select wizard; each spreads its base config and replaces permissions/actions with `FILE_SEE_NOTES` + `FILE_SELECT` only.

### SUBMISSION_FILES

Permission matrix for this namespace (useFileManagerConfig.js:20-63): Author → LIST, EDIT, DOWNLOAD_ALL; SiteAdmin/Manager → SEND_TO_EDITOR; SubEditor/Manager/SiteAdmin/Assistant → LIST, UPLOAD, DOWNLOAD_ALL, EDIT, DELETE, SEE_NOTES. All role checks require an assignment in the Submission stage. No gridComponent declared. Panel title `submission.submit.submissionFiles` → "Submission Files".

| Atom ID | Surface | Control (locale key → English) | Role gate | State/visibility gate | Source anchor | Hint | Claimed by |
|---|---|---|---|---|---|---|---|
| AFF-fm-sf-col-select | file table column | `editor.submission.selectFiles` → "Select Files" (sr-only header, checkbox cells) | FILE_SELECT permitted | **declared-unreachable here** — FILE_SELECT only exists in `*_SELECT` namespace variants | useFileManagerConfig.js:413-420 | submission-files | |
| AFF-fm-sf-col-numero | file table column | `common.numero` → "No" | none | none | useFileManagerConfig.js:421-425 | submission-files | send-to-review |
| AFF-fm-sf-col-filename | file table column | `common.fileName` → "File Name" | none | none | useFileManagerConfig.js:426-430 | submission-files | send-to-review |
| AFF-fm-sf-col-date | file table column | `common.dateUploaded` → "Date uploaded" | none | none | useFileManagerConfig.js:431-435 | submission-files | send-to-review |
| AFF-fm-sf-col-type | file table column | `common.type` → "Type" | none | none | useFileManagerConfig.js:436-440 | submission-files | send-to-review |
| AFF-fm-sf-col-more-actions | file table column | `common.moreActions` → "More Actions" (sr-only, kebab cell) | none | none | useFileManagerConfig.js:442-447 | submission-files | send-to-review |
| AFF-fm-sf-top-upload | panel top bar | `common.upload` → "Upload" | FILE_UPLOAD: SubEditor/Manager/SiteAdmin/Assistant assigned in stage (NOT Author — author upload happens in the wizard/revisions, not here) | none | useFileManagerConfig.js:456-464; matrix :41-49 | submission-files | send-to-review |
| AFF-fm-sf-top-upload-select | panel top bar | `editor.submission.uploadSelectFiles` → "Upload/Select Files" | FILE_SELECT_UPLOAD permitted | **declared-unreachable here** — action absent from SUBMISSION_FILES action list (used by EDITOR_REVIEW_FILES / COPYEDITED_FILES / FINAL_DRAFT_FILES) | useFileManagerConfig.js:466-474 | submission-files | |
| AFF-fm-sf-bottom-download-all | panel bottom bar | `submission.files.downloadAll` → "Download All Files" (link style) | FILE_DOWNLOAD_ALL: Author or SubEditor/Manager/SiteAdmin/Assistant | `filesCount > 0` | useFileManagerConfig.js:482-491; matrix :22-49 | submission-files | send-to-review |
| AFF-fm-sf-row-send-to-editor | file row kebab | `grid.action.sendToTextEditor` → "Send to Text Editor" | FILE_SEND_TO_EDITOR: SiteAdmin/Manager only | file extension in pandoc set (docx, odt, rtf, tex, latex, md, markdown) | useFileManagerConfig.js:500-511; :9-17; matrix :30-33 | submission-files | send-to-review |
| AFF-fm-sf-row-update-file | file row kebab | `grid.action.updateFile` → "Update File Details" | FILE_EDIT: Author or SubEditor/Manager/SiteAdmin/Assistant | none | useFileManagerConfig.js:513-519 | submission-files | send-to-review |
| AFF-fm-sf-row-more-info | file row kebab | `grid.action.moreInformation` → "More Information" | FILE_SEE_NOTES: SubEditor/Manager/SiteAdmin/Assistant (not Author) | none | useFileManagerConfig.js:521-527 | submission-files | send-to-review |
| AFF-fm-sf-row-delete | file row kebab | `grid.action.delete` → "Delete" (warnable) | FILE_DELETE: SubEditor/Manager/SiteAdmin/Assistant (not Author) | none | useFileManagerConfig.js:529-536 | submission-files | send-to-review |

### SUBMISSION_FILES_SELECT

Permission matrix for this namespace (useFileManagerConfig.js:64-81): spreads SUBMISSION_FILES, then replaces permissions/actions — SubEditor/Manager/SiteAdmin/Assistant → SEE_NOTES, SELECT; nothing else is permitted (no Author entry). All role checks require an assignment in the Submission stage. No gridComponent declared (base declares none). Used as the Submission-stage file source in the upload/select wizard (:578).

| Atom ID | Surface | Control (locale key → English) | Role gate | State/visibility gate | Source anchor | Hint | Claimed by |
|---|---|---|---|---|---|---|---|
| AFF-fm-sfs-col-select | file table column | `editor.submission.selectFiles` → "Select Files" (sr-only header, checkbox cells) | FILE_SELECT: SubEditor/Manager/SiteAdmin/Assistant | none | useFileManagerConfig.js:413-420; matrix :68-79 | submission-files | |
| AFF-fm-sfs-col-numero | file table column | `common.numero` → "No" | none | none | useFileManagerConfig.js:421-425 | submission-files | |
| AFF-fm-sfs-col-filename | file table column | `common.fileName` → "File Name" | none | none | useFileManagerConfig.js:426-430 | submission-files | |
| AFF-fm-sfs-col-date | file table column | `common.dateUploaded` → "Date uploaded" | none | none | useFileManagerConfig.js:431-435 | submission-files | |
| AFF-fm-sfs-col-type | file table column | `common.type` → "Type" | none | none | useFileManagerConfig.js:436-440 | submission-files | |
| AFF-fm-sfs-col-more-actions | file table column | `common.moreActions` → "More Actions" (sr-only, kebab cell) | none | none | useFileManagerConfig.js:442-447 | submission-files | |
| AFF-fm-sfs-top-upload | panel top bar | `common.upload` → "Upload" | FILE_UPLOAD permitted | **declared-unreachable here** — FILE_UPLOAD absent from this namespace's action list (only SEE_NOTES/SELECT) | useFileManagerConfig.js:456-464 | submission-files | |
| AFF-fm-sfs-top-upload-select | panel top bar | `editor.submission.uploadSelectFiles` → "Upload/Select Files" | FILE_SELECT_UPLOAD permitted | **declared-unreachable here** — FILE_SELECT_UPLOAD absent from this namespace's action list | useFileManagerConfig.js:466-474 | submission-files | |
| AFF-fm-sfs-bottom-download-all | panel bottom bar | `submission.files.downloadAll` → "Download All Files" (link style) | FILE_DOWNLOAD_ALL permitted | **declared-unreachable here** — FILE_DOWNLOAD_ALL absent from this namespace's action list | useFileManagerConfig.js:482-491 | submission-files | |
| AFF-fm-sfs-row-send-to-editor | file row kebab | `grid.action.sendToTextEditor` → "Send to Text Editor" | FILE_SEND_TO_EDITOR permitted | **declared-unreachable here** — FILE_SEND_TO_EDITOR absent from this namespace's action list | useFileManagerConfig.js:500-511 | submission-files | |
| AFF-fm-sfs-row-update-file | file row kebab | `grid.action.updateFile` → "Update File Details" | FILE_EDIT permitted | **declared-unreachable here** — FILE_EDIT absent from this namespace's action list | useFileManagerConfig.js:513-519 | submission-files | |
| AFF-fm-sfs-row-more-info | file row kebab | `grid.action.moreInformation` → "More Information" | FILE_SEE_NOTES: SubEditor/Manager/SiteAdmin/Assistant | none | useFileManagerConfig.js:521-527; matrix :68-79 | submission-files | |
| AFF-fm-sfs-row-delete | file row kebab | `grid.action.delete` → "Delete" (warnable) | FILE_DELETE permitted | **declared-unreachable here** — FILE_DELETE absent from this namespace's action list | useFileManagerConfig.js:529-536 | submission-files | |

### EDITOR_REVIEW_FILES

Permission matrix for this namespace (useFileManagerConfig.js:82-120): SiteAdmin/Manager → SEND_TO_EDITOR; SubEditor/Manager/SiteAdmin/Assistant → LIST, SELECT_UPLOAD, EDIT, DELETE, SEE_NOTES. No Author entry at all — authors never see this panel's controls. All role checks require an assignment in the current review stage (fileStage switches between internal/external review file constants by stageId, :112-115). Declares `gridComponent: 'grid.files.review.EditorReviewFilesGridHandler'` (:116) — cross-reference atlas/grids.md. Panel title `fileManager.filesForReview` → "Files for Review"; upload/select modal title `editor.submission.review.currentFiles` → "Current Review Files For Round {$round}".

| Atom ID | Surface | Control (locale key → English) | Role gate | State/visibility gate | Source anchor | Hint | Claimed by |
|---|---|---|---|---|---|---|---|
| AFF-fm-erf-col-select | file table column | `editor.submission.selectFiles` → "Select Files" (sr-only header, checkbox cells) | FILE_SELECT permitted | **declared-unreachable here** — FILE_SELECT only exists in `*_SELECT` namespace variants | useFileManagerConfig.js:413-420 | review-rounds-and-revisions | |
| AFF-fm-erf-col-numero | file table column | `common.numero` → "No" | none | none | useFileManagerConfig.js:421-425 | review-rounds-and-revisions | |
| AFF-fm-erf-col-filename | file table column | `common.fileName` → "File Name" | none | none | useFileManagerConfig.js:426-430 | review-rounds-and-revisions | |
| AFF-fm-erf-col-date | file table column | `common.dateUploaded` → "Date uploaded" | none | none | useFileManagerConfig.js:431-435 | review-rounds-and-revisions | |
| AFF-fm-erf-col-type | file table column | `common.type` → "Type" | none | none | useFileManagerConfig.js:436-440 | review-rounds-and-revisions | |
| AFF-fm-erf-col-more-actions | file table column | `common.moreActions` → "More Actions" (sr-only, kebab cell) | none | none | useFileManagerConfig.js:442-447 | review-rounds-and-revisions | |
| AFF-fm-erf-top-upload | panel top bar | `common.upload` → "Upload" | FILE_UPLOAD permitted | **declared-unreachable here** — this namespace uses FILE_SELECT_UPLOAD instead; FILE_UPLOAD absent from its action list | useFileManagerConfig.js:456-464 | review-rounds-and-revisions | |
| AFF-fm-erf-top-upload-select | panel top bar | `editor.submission.uploadSelectFiles` → "Upload/Select Files" | FILE_SELECT_UPLOAD: SubEditor/Manager/SiteAdmin/Assistant assigned in stage | none | useFileManagerConfig.js:466-474; matrix :88-102 | review-rounds-and-revisions | |
| AFF-fm-erf-bottom-download-all | panel bottom bar | `submission.files.downloadAll` → "Download All Files" (link style) | FILE_DOWNLOAD_ALL permitted | **declared-unreachable here** — FILE_DOWNLOAD_ALL absent from this namespace's action list | useFileManagerConfig.js:482-491 | review-rounds-and-revisions | |
| AFF-fm-erf-row-send-to-editor | file row kebab | `grid.action.sendToTextEditor` → "Send to Text Editor" | FILE_SEND_TO_EDITOR: SiteAdmin/Manager only | file extension in pandoc set (docx, odt, rtf, tex, latex, md, markdown) | useFileManagerConfig.js:500-511; :9-17; matrix :84-87 | review-rounds-and-revisions | |
| AFF-fm-erf-row-update-file | file row kebab | `grid.action.updateFile` → "Update File Details" | FILE_EDIT: SubEditor/Manager/SiteAdmin/Assistant | none | useFileManagerConfig.js:513-519 | review-rounds-and-revisions | |
| AFF-fm-erf-row-more-info | file row kebab | `grid.action.moreInformation` → "More Information" | FILE_SEE_NOTES: SubEditor/Manager/SiteAdmin/Assistant | none | useFileManagerConfig.js:521-527 | review-rounds-and-revisions | |
| AFF-fm-erf-row-delete | file row kebab | `grid.action.delete` → "Delete" (warnable) | FILE_DELETE: SubEditor/Manager/SiteAdmin/Assistant | none | useFileManagerConfig.js:529-536 | review-rounds-and-revisions | |

### EDITOR_REVIEW_FILES_SELECT

Permission matrix for this namespace (useFileManagerConfig.js:121-138): spreads EDITOR_REVIEW_FILES, then replaces permissions/actions — SubEditor/Manager/SiteAdmin/Assistant → SEE_NOTES, SELECT; nothing else is permitted. All role checks require an assignment in the current review stage. Inherits `gridComponent: 'grid.files.review.EditorReviewFilesGridHandler'` from the base via spread (:116) — cross-reference atlas/grids.md. Used as a review-stage file source in the upload/select wizard (:580-586).

| Atom ID | Surface | Control (locale key → English) | Role gate | State/visibility gate | Source anchor | Hint | Claimed by |
|---|---|---|---|---|---|---|---|
| AFF-fm-erfs-col-select | file table column | `editor.submission.selectFiles` → "Select Files" (sr-only header, checkbox cells) | FILE_SELECT: SubEditor/Manager/SiteAdmin/Assistant | none | useFileManagerConfig.js:413-420; matrix :125-136 | review-rounds-and-revisions | |
| AFF-fm-erfs-col-numero | file table column | `common.numero` → "No" | none | none | useFileManagerConfig.js:421-425 | review-rounds-and-revisions | |
| AFF-fm-erfs-col-filename | file table column | `common.fileName` → "File Name" | none | none | useFileManagerConfig.js:426-430 | review-rounds-and-revisions | |
| AFF-fm-erfs-col-date | file table column | `common.dateUploaded` → "Date uploaded" | none | none | useFileManagerConfig.js:431-435 | review-rounds-and-revisions | |
| AFF-fm-erfs-col-type | file table column | `common.type` → "Type" | none | none | useFileManagerConfig.js:436-440 | review-rounds-and-revisions | |
| AFF-fm-erfs-col-more-actions | file table column | `common.moreActions` → "More Actions" (sr-only, kebab cell) | none | none | useFileManagerConfig.js:442-447 | review-rounds-and-revisions | |
| AFF-fm-erfs-top-upload | panel top bar | `common.upload` → "Upload" | FILE_UPLOAD permitted | **declared-unreachable here** — FILE_UPLOAD absent from this namespace's action list (only SEE_NOTES/SELECT) | useFileManagerConfig.js:456-464 | review-rounds-and-revisions | |
| AFF-fm-erfs-top-upload-select | panel top bar | `editor.submission.uploadSelectFiles` → "Upload/Select Files" | FILE_SELECT_UPLOAD permitted | **declared-unreachable here** — FILE_SELECT_UPLOAD absent from this namespace's action list | useFileManagerConfig.js:466-474 | review-rounds-and-revisions | |
| AFF-fm-erfs-bottom-download-all | panel bottom bar | `submission.files.downloadAll` → "Download All Files" (link style) | FILE_DOWNLOAD_ALL permitted | **declared-unreachable here** — FILE_DOWNLOAD_ALL absent from this namespace's action list | useFileManagerConfig.js:482-491 | review-rounds-and-revisions | |
| AFF-fm-erfs-row-send-to-editor | file row kebab | `grid.action.sendToTextEditor` → "Send to Text Editor" | FILE_SEND_TO_EDITOR permitted | **declared-unreachable here** — FILE_SEND_TO_EDITOR absent from this namespace's action list | useFileManagerConfig.js:500-511 | review-rounds-and-revisions | |
| AFF-fm-erfs-row-update-file | file row kebab | `grid.action.updateFile` → "Update File Details" | FILE_EDIT permitted | **declared-unreachable here** — FILE_EDIT absent from this namespace's action list | useFileManagerConfig.js:513-519 | review-rounds-and-revisions | |
| AFF-fm-erfs-row-more-info | file row kebab | `grid.action.moreInformation` → "More Information" | FILE_SEE_NOTES: SubEditor/Manager/SiteAdmin/Assistant | none | useFileManagerConfig.js:521-527; matrix :125-136 | review-rounds-and-revisions | |
| AFF-fm-erfs-row-delete | file row kebab | `grid.action.delete` → "Delete" (warnable) | FILE_DELETE permitted | **declared-unreachable here** — FILE_DELETE absent from this namespace's action list | useFileManagerConfig.js:529-536 | review-rounds-and-revisions | |

### WORKFLOW_REVIEW_REVISIONS

Permission matrix for this namespace (useFileManagerConfig.js:139-184): Author → LIST, UPLOAD, EDIT, DELETE (this is where authors upload revision files); SiteAdmin/Manager → SEND_TO_EDITOR; SubEditor/Manager/SiteAdmin/Assistant → LIST, UPLOAD, EDIT, DELETE, SEE_NOTES. All role checks require an assignment in the current review stage (fileStage switches between internal/external revision constants by stageId, :177-180). No gridComponent declared. Panel title `fileManager.revisionsUploaded` → "Revisions Uploaded".

| Atom ID | Surface | Control (locale key → English) | Role gate | State/visibility gate | Source anchor | Hint | Claimed by |
|---|---|---|---|---|---|---|---|
| AFF-fm-wrr-col-select | file table column | `editor.submission.selectFiles` → "Select Files" (sr-only header, checkbox cells) | FILE_SELECT permitted | **declared-unreachable here** — FILE_SELECT only exists in `*_SELECT` namespace variants | useFileManagerConfig.js:413-420 | review-rounds-and-revisions | |
| AFF-fm-wrr-col-numero | file table column | `common.numero` → "No" | none | none | useFileManagerConfig.js:421-425 | review-rounds-and-revisions | |
| AFF-fm-wrr-col-filename | file table column | `common.fileName` → "File Name" | none | none | useFileManagerConfig.js:426-430 | review-rounds-and-revisions | |
| AFF-fm-wrr-col-date | file table column | `common.dateUploaded` → "Date uploaded" | none | none | useFileManagerConfig.js:431-435 | review-rounds-and-revisions | |
| AFF-fm-wrr-col-type | file table column | `common.type` → "Type" | none | none | useFileManagerConfig.js:436-440 | review-rounds-and-revisions | |
| AFF-fm-wrr-col-more-actions | file table column | `common.moreActions` → "More Actions" (sr-only, kebab cell) | none | none | useFileManagerConfig.js:442-447 | review-rounds-and-revisions | |
| AFF-fm-wrr-top-upload | panel top bar | `common.upload` → "Upload" | FILE_UPLOAD: Author or SubEditor/Manager/SiteAdmin/Assistant assigned in stage (the one namespace where authors upload directly) | none | useFileManagerConfig.js:456-464; matrix :141-168 | review-rounds-and-revisions | |
| AFF-fm-wrr-top-upload-select | panel top bar | `editor.submission.uploadSelectFiles` → "Upload/Select Files" | FILE_SELECT_UPLOAD permitted | **declared-unreachable here** — action absent from WORKFLOW_REVIEW_REVISIONS action list (used by EDITOR_REVIEW_FILES / COPYEDITED_FILES / FINAL_DRAFT_FILES) | useFileManagerConfig.js:466-474 | review-rounds-and-revisions | |
| AFF-fm-wrr-bottom-download-all | panel bottom bar | `submission.files.downloadAll` → "Download All Files" (link style) | FILE_DOWNLOAD_ALL permitted | **declared-unreachable here** — FILE_DOWNLOAD_ALL absent from this namespace's action list | useFileManagerConfig.js:482-491 | review-rounds-and-revisions | |
| AFF-fm-wrr-row-send-to-editor | file row kebab | `grid.action.sendToTextEditor` → "Send to Text Editor" | FILE_SEND_TO_EDITOR: SiteAdmin/Manager only | file extension in pandoc set (docx, odt, rtf, tex, latex, md, markdown) | useFileManagerConfig.js:500-511; :9-17; matrix :150-153 | review-rounds-and-revisions | |
| AFF-fm-wrr-row-update-file | file row kebab | `grid.action.updateFile` → "Update File Details" | FILE_EDIT: Author or SubEditor/Manager/SiteAdmin/Assistant | none | useFileManagerConfig.js:513-519 | review-rounds-and-revisions | |
| AFF-fm-wrr-row-more-info | file row kebab | `grid.action.moreInformation` → "More Information" | FILE_SEE_NOTES: SubEditor/Manager/SiteAdmin/Assistant (not Author) | none | useFileManagerConfig.js:521-527 | review-rounds-and-revisions | |
| AFF-fm-wrr-row-delete | file row kebab | `grid.action.delete` → "Delete" (warnable) | FILE_DELETE: Author or SubEditor/Manager/SiteAdmin/Assistant (authors can delete their own revision uploads) | none | useFileManagerConfig.js:529-536; matrix :141-168 | review-rounds-and-revisions | |

### WORKFLOW_REVIEW_REVISIONS_SELECT

Permission matrix for this namespace (useFileManagerConfig.js:185-202): spreads WORKFLOW_REVIEW_REVISIONS, then replaces permissions/actions — SubEditor/Manager/SiteAdmin/Assistant → SEE_NOTES, SELECT; nothing else is permitted (Author entry dropped). All role checks require an assignment in the current review stage. No gridComponent declared (base declares none). Used as a review-stage file source in the upload/select wizard (:580-586).

| Atom ID | Surface | Control (locale key → English) | Role gate | State/visibility gate | Source anchor | Hint | Claimed by |
|---|---|---|---|---|---|---|---|
| AFF-fm-wrrs-col-select | file table column | `editor.submission.selectFiles` → "Select Files" (sr-only header, checkbox cells) | FILE_SELECT: SubEditor/Manager/SiteAdmin/Assistant | none | useFileManagerConfig.js:413-420; matrix :189-200 | review-rounds-and-revisions | |
| AFF-fm-wrrs-col-numero | file table column | `common.numero` → "No" | none | none | useFileManagerConfig.js:421-425 | review-rounds-and-revisions | |
| AFF-fm-wrrs-col-filename | file table column | `common.fileName` → "File Name" | none | none | useFileManagerConfig.js:426-430 | review-rounds-and-revisions | |
| AFF-fm-wrrs-col-date | file table column | `common.dateUploaded` → "Date uploaded" | none | none | useFileManagerConfig.js:431-435 | review-rounds-and-revisions | |
| AFF-fm-wrrs-col-type | file table column | `common.type` → "Type" | none | none | useFileManagerConfig.js:436-440 | review-rounds-and-revisions | |
| AFF-fm-wrrs-col-more-actions | file table column | `common.moreActions` → "More Actions" (sr-only, kebab cell) | none | none | useFileManagerConfig.js:442-447 | review-rounds-and-revisions | |
| AFF-fm-wrrs-top-upload | panel top bar | `common.upload` → "Upload" | FILE_UPLOAD permitted | **declared-unreachable here** — FILE_UPLOAD absent from this namespace's action list (only SEE_NOTES/SELECT) | useFileManagerConfig.js:456-464 | review-rounds-and-revisions | |
| AFF-fm-wrrs-top-upload-select | panel top bar | `editor.submission.uploadSelectFiles` → "Upload/Select Files" | FILE_SELECT_UPLOAD permitted | **declared-unreachable here** — FILE_SELECT_UPLOAD absent from this namespace's action list | useFileManagerConfig.js:466-474 | review-rounds-and-revisions | |
| AFF-fm-wrrs-bottom-download-all | panel bottom bar | `submission.files.downloadAll` → "Download All Files" (link style) | FILE_DOWNLOAD_ALL permitted | **declared-unreachable here** — FILE_DOWNLOAD_ALL absent from this namespace's action list | useFileManagerConfig.js:482-491 | review-rounds-and-revisions | |
| AFF-fm-wrrs-row-send-to-editor | file row kebab | `grid.action.sendToTextEditor` → "Send to Text Editor" | FILE_SEND_TO_EDITOR permitted | **declared-unreachable here** — FILE_SEND_TO_EDITOR absent from this namespace's action list | useFileManagerConfig.js:500-511 | review-rounds-and-revisions | |
| AFF-fm-wrrs-row-update-file | file row kebab | `grid.action.updateFile` → "Update File Details" | FILE_EDIT permitted | **declared-unreachable here** — FILE_EDIT absent from this namespace's action list | useFileManagerConfig.js:513-519 | review-rounds-and-revisions | |
| AFF-fm-wrrs-row-more-info | file row kebab | `grid.action.moreInformation` → "More Information" | FILE_SEE_NOTES: SubEditor/Manager/SiteAdmin/Assistant | none | useFileManagerConfig.js:521-527; matrix :189-200 | review-rounds-and-revisions | |
| AFF-fm-wrrs-row-delete | file row kebab | `grid.action.delete` → "Delete" (warnable) | FILE_DELETE permitted | **declared-unreachable here** — FILE_DELETE absent from this namespace's action list | useFileManagerConfig.js:529-536 | review-rounds-and-revisions | |

### COPYEDITED_FILES

Permission matrix for this namespace (useFileManagerConfig.js:203-242): Author → LIST only (read-only view); SiteAdmin/Manager → SEND_TO_EDITOR; SubEditor/Manager/SiteAdmin/Assistant → LIST, SELECT_UPLOAD, EDIT, DELETE, SEE_NOTES. All role checks require an assignment in the Copyediting (Editing) stage. Declares `gridComponent: 'grid.files.copyedit.CopyeditFilesGridHandler'` (:240) — cross-reference atlas/grids.md. Panel title `fileManager.copyeditedFiles` → "Copyedited Files".

| Atom ID | Surface | Control (locale key → English) | Role gate | State/visibility gate | Source anchor | Hint | Claimed by |
|---|---|---|---|---|---|---|---|
| AFF-fm-cf-col-select | file table column | `editor.submission.selectFiles` → "Select Files" (sr-only header, checkbox cells) | FILE_SELECT permitted | **declared-unreachable here** — FILE_SELECT only exists in `*_SELECT` namespace variants | useFileManagerConfig.js:413-420 | copyediting-stage | |
| AFF-fm-cf-col-numero | file table column | `common.numero` → "No" | none | none | useFileManagerConfig.js:421-425 | copyediting-stage | |
| AFF-fm-cf-col-filename | file table column | `common.fileName` → "File Name" | none | none | useFileManagerConfig.js:426-430 | copyediting-stage | |
| AFF-fm-cf-col-date | file table column | `common.dateUploaded` → "Date uploaded" | none | none | useFileManagerConfig.js:431-435 | copyediting-stage | |
| AFF-fm-cf-col-type | file table column | `common.type` → "Type" | none | none | useFileManagerConfig.js:436-440 | copyediting-stage | |
| AFF-fm-cf-col-more-actions | file table column | `common.moreActions` → "More Actions" (sr-only, kebab cell) | none | none | useFileManagerConfig.js:442-447 | copyediting-stage | |
| AFF-fm-cf-top-upload | panel top bar | `common.upload` → "Upload" | FILE_UPLOAD permitted | **declared-unreachable here** — this namespace uses FILE_SELECT_UPLOAD instead; FILE_UPLOAD absent from its action list | useFileManagerConfig.js:456-464 | copyediting-stage | |
| AFF-fm-cf-top-upload-select | panel top bar | `editor.submission.uploadSelectFiles` → "Upload/Select Files" | FILE_SELECT_UPLOAD: SubEditor/Manager/SiteAdmin/Assistant assigned in stage (not Author) | none | useFileManagerConfig.js:466-474; matrix :213-227 | copyediting-stage | |
| AFF-fm-cf-bottom-download-all | panel bottom bar | `submission.files.downloadAll` → "Download All Files" (link style) | FILE_DOWNLOAD_ALL permitted | **declared-unreachable here** — FILE_DOWNLOAD_ALL absent from this namespace's action list | useFileManagerConfig.js:482-491 | copyediting-stage | |
| AFF-fm-cf-row-send-to-editor | file row kebab | `grid.action.sendToTextEditor` → "Send to Text Editor" | FILE_SEND_TO_EDITOR: SiteAdmin/Manager only | file extension in pandoc set (docx, odt, rtf, tex, latex, md, markdown) | useFileManagerConfig.js:500-511; :9-17; matrix :209-212 | copyediting-stage | |
| AFF-fm-cf-row-update-file | file row kebab | `grid.action.updateFile` → "Update File Details" | FILE_EDIT: SubEditor/Manager/SiteAdmin/Assistant (Author has LIST only) | none | useFileManagerConfig.js:513-519 | copyediting-stage | |
| AFF-fm-cf-row-more-info | file row kebab | `grid.action.moreInformation` → "More Information" | FILE_SEE_NOTES: SubEditor/Manager/SiteAdmin/Assistant (not Author) | none | useFileManagerConfig.js:521-527 | copyediting-stage | |
| AFF-fm-cf-row-delete | file row kebab | `grid.action.delete` → "Delete" (warnable) | FILE_DELETE: SubEditor/Manager/SiteAdmin/Assistant (not Author) | none | useFileManagerConfig.js:529-536 | copyediting-stage | |

### COPYEDITED_FILES_SELECT

Permission matrix for this namespace (useFileManagerConfig.js:243-260): spreads COPYEDITED_FILES, then replaces permissions/actions — SubEditor/Manager/SiteAdmin/Assistant → SEE_NOTES, SELECT; nothing else is permitted (Author entry dropped). All role checks require an assignment in the Copyediting (Editing) stage. Inherits `gridComponent: 'grid.files.copyedit.CopyeditFilesGridHandler'` from the base via spread (:240) — cross-reference atlas/grids.md. Used as an Editing-stage file source in the upload/select wizard (:587-590).

| Atom ID | Surface | Control (locale key → English) | Role gate | State/visibility gate | Source anchor | Hint | Claimed by |
|---|---|---|---|---|---|---|---|
| AFF-fm-cfs-col-select | file table column | `editor.submission.selectFiles` → "Select Files" (sr-only header, checkbox cells) | FILE_SELECT: SubEditor/Manager/SiteAdmin/Assistant | none | useFileManagerConfig.js:413-420; matrix :247-258 | copyediting-stage | |
| AFF-fm-cfs-col-numero | file table column | `common.numero` → "No" | none | none | useFileManagerConfig.js:421-425 | copyediting-stage | |
| AFF-fm-cfs-col-filename | file table column | `common.fileName` → "File Name" | none | none | useFileManagerConfig.js:426-430 | copyediting-stage | |
| AFF-fm-cfs-col-date | file table column | `common.dateUploaded` → "Date uploaded" | none | none | useFileManagerConfig.js:431-435 | copyediting-stage | |
| AFF-fm-cfs-col-type | file table column | `common.type` → "Type" | none | none | useFileManagerConfig.js:436-440 | copyediting-stage | |
| AFF-fm-cfs-col-more-actions | file table column | `common.moreActions` → "More Actions" (sr-only, kebab cell) | none | none | useFileManagerConfig.js:442-447 | copyediting-stage | |
| AFF-fm-cfs-top-upload | panel top bar | `common.upload` → "Upload" | FILE_UPLOAD permitted | **declared-unreachable here** — FILE_UPLOAD absent from this namespace's action list (only SEE_NOTES/SELECT) | useFileManagerConfig.js:456-464 | copyediting-stage | |
| AFF-fm-cfs-top-upload-select | panel top bar | `editor.submission.uploadSelectFiles` → "Upload/Select Files" | FILE_SELECT_UPLOAD permitted | **declared-unreachable here** — FILE_SELECT_UPLOAD absent from this namespace's action list | useFileManagerConfig.js:466-474 | copyediting-stage | |
| AFF-fm-cfs-bottom-download-all | panel bottom bar | `submission.files.downloadAll` → "Download All Files" (link style) | FILE_DOWNLOAD_ALL permitted | **declared-unreachable here** — FILE_DOWNLOAD_ALL absent from this namespace's action list | useFileManagerConfig.js:482-491 | copyediting-stage | |
| AFF-fm-cfs-row-send-to-editor | file row kebab | `grid.action.sendToTextEditor` → "Send to Text Editor" | FILE_SEND_TO_EDITOR permitted | **declared-unreachable here** — FILE_SEND_TO_EDITOR absent from this namespace's action list | useFileManagerConfig.js:500-511 | copyediting-stage | |
| AFF-fm-cfs-row-update-file | file row kebab | `grid.action.updateFile` → "Update File Details" | FILE_EDIT permitted | **declared-unreachable here** — FILE_EDIT absent from this namespace's action list | useFileManagerConfig.js:513-519 | copyediting-stage | |
| AFF-fm-cfs-row-more-info | file row kebab | `grid.action.moreInformation` → "More Information" | FILE_SEE_NOTES: SubEditor/Manager/SiteAdmin/Assistant | none | useFileManagerConfig.js:521-527; matrix :247-258 | copyediting-stage | |
| AFF-fm-cfs-row-delete | file row kebab | `grid.action.delete` → "Delete" (warnable) | FILE_DELETE permitted | **declared-unreachable here** — FILE_DELETE absent from this namespace's action list | useFileManagerConfig.js:529-536 | copyediting-stage | |

### FINAL_DRAFT_FILES

Permission matrix for this namespace (useFileManagerConfig.js:261-296): SiteAdmin/Manager → SEND_TO_EDITOR; SubEditor/Manager/SiteAdmin/Assistant → LIST, SELECT_UPLOAD, EDIT, DELETE, SEE_NOTES. No Author entry at all. All role checks require an assignment in the Copyediting (Editing) stage. Declares `gridComponent: 'grid.files.final.FinalDraftFilesGridHandler'` (:294) — cross-reference atlas/grids.md. Panel title `submission.finalDraft` → "Draft Files".

| Atom ID | Surface | Control (locale key → English) | Role gate | State/visibility gate | Source anchor | Hint | Claimed by |
|---|---|---|---|---|---|---|---|
| AFF-fm-fdf-col-select | file table column | `editor.submission.selectFiles` → "Select Files" (sr-only header, checkbox cells) | FILE_SELECT permitted | **declared-unreachable here** — FILE_SELECT only exists in `*_SELECT` namespace variants | useFileManagerConfig.js:413-420 | copyediting-stage | |
| AFF-fm-fdf-col-numero | file table column | `common.numero` → "No" | none | none | useFileManagerConfig.js:421-425 | copyediting-stage | |
| AFF-fm-fdf-col-filename | file table column | `common.fileName` → "File Name" | none | none | useFileManagerConfig.js:426-430 | copyediting-stage | |
| AFF-fm-fdf-col-date | file table column | `common.dateUploaded` → "Date uploaded" | none | none | useFileManagerConfig.js:431-435 | copyediting-stage | |
| AFF-fm-fdf-col-type | file table column | `common.type` → "Type" | none | none | useFileManagerConfig.js:436-440 | copyediting-stage | |
| AFF-fm-fdf-col-more-actions | file table column | `common.moreActions` → "More Actions" (sr-only, kebab cell) | none | none | useFileManagerConfig.js:442-447 | copyediting-stage | |
| AFF-fm-fdf-top-upload | panel top bar | `common.upload` → "Upload" | FILE_UPLOAD permitted | **declared-unreachable here** — this namespace uses FILE_SELECT_UPLOAD instead; FILE_UPLOAD absent from its action list | useFileManagerConfig.js:456-464 | copyediting-stage | |
| AFF-fm-fdf-top-upload-select | panel top bar | `editor.submission.uploadSelectFiles` → "Upload/Select Files" | FILE_SELECT_UPLOAD: SubEditor/Manager/SiteAdmin/Assistant assigned in stage | none | useFileManagerConfig.js:466-474; matrix :267-281 | copyediting-stage | |
| AFF-fm-fdf-bottom-download-all | panel bottom bar | `submission.files.downloadAll` → "Download All Files" (link style) | FILE_DOWNLOAD_ALL permitted | **declared-unreachable here** — FILE_DOWNLOAD_ALL absent from this namespace's action list | useFileManagerConfig.js:482-491 | copyediting-stage | |
| AFF-fm-fdf-row-send-to-editor | file row kebab | `grid.action.sendToTextEditor` → "Send to Text Editor" | FILE_SEND_TO_EDITOR: SiteAdmin/Manager only | file extension in pandoc set (docx, odt, rtf, tex, latex, md, markdown) | useFileManagerConfig.js:500-511; :9-17; matrix :263-266 | copyediting-stage | |
| AFF-fm-fdf-row-update-file | file row kebab | `grid.action.updateFile` → "Update File Details" | FILE_EDIT: SubEditor/Manager/SiteAdmin/Assistant | none | useFileManagerConfig.js:513-519 | copyediting-stage | |
| AFF-fm-fdf-row-more-info | file row kebab | `grid.action.moreInformation` → "More Information" | FILE_SEE_NOTES: SubEditor/Manager/SiteAdmin/Assistant | none | useFileManagerConfig.js:521-527 | copyediting-stage | |
| AFF-fm-fdf-row-delete | file row kebab | `grid.action.delete` → "Delete" (warnable) | FILE_DELETE: SubEditor/Manager/SiteAdmin/Assistant | none | useFileManagerConfig.js:529-536 | copyediting-stage | |

### FINAL_DRAFT_FILES_SELECT

Permission matrix for this namespace (useFileManagerConfig.js:297-314): spreads FINAL_DRAFT_FILES, then replaces permissions/actions — SubEditor/Manager/SiteAdmin/Assistant → SEE_NOTES, SELECT; nothing else is permitted. All role checks require an assignment in the Copyediting (Editing) stage. Inherits `gridComponent: 'grid.files.final.FinalDraftFilesGridHandler'` from the base via spread (:294) — cross-reference atlas/grids.md. Used as an Editing-stage file source in the upload/select wizard (:587-590).

| Atom ID | Surface | Control (locale key → English) | Role gate | State/visibility gate | Source anchor | Hint | Claimed by |
|---|---|---|---|---|---|---|---|
| AFF-fm-fdfs-col-select | file table column | `editor.submission.selectFiles` → "Select Files" (sr-only header, checkbox cells) | FILE_SELECT: SubEditor/Manager/SiteAdmin/Assistant | none | useFileManagerConfig.js:413-420; matrix :301-312 | copyediting-stage | |
| AFF-fm-fdfs-col-numero | file table column | `common.numero` → "No" | none | none | useFileManagerConfig.js:421-425 | copyediting-stage | |
| AFF-fm-fdfs-col-filename | file table column | `common.fileName` → "File Name" | none | none | useFileManagerConfig.js:426-430 | copyediting-stage | |
| AFF-fm-fdfs-col-date | file table column | `common.dateUploaded` → "Date uploaded" | none | none | useFileManagerConfig.js:431-435 | copyediting-stage | |
| AFF-fm-fdfs-col-type | file table column | `common.type` → "Type" | none | none | useFileManagerConfig.js:436-440 | copyediting-stage | |
| AFF-fm-fdfs-col-more-actions | file table column | `common.moreActions` → "More Actions" (sr-only, kebab cell) | none | none | useFileManagerConfig.js:442-447 | copyediting-stage | |
| AFF-fm-fdfs-top-upload | panel top bar | `common.upload` → "Upload" | FILE_UPLOAD permitted | **declared-unreachable here** — FILE_UPLOAD absent from this namespace's action list (only SEE_NOTES/SELECT) | useFileManagerConfig.js:456-464 | copyediting-stage | |
| AFF-fm-fdfs-top-upload-select | panel top bar | `editor.submission.uploadSelectFiles` → "Upload/Select Files" | FILE_SELECT_UPLOAD permitted | **declared-unreachable here** — FILE_SELECT_UPLOAD absent from this namespace's action list | useFileManagerConfig.js:466-474 | copyediting-stage | |
| AFF-fm-fdfs-bottom-download-all | panel bottom bar | `submission.files.downloadAll` → "Download All Files" (link style) | FILE_DOWNLOAD_ALL permitted | **declared-unreachable here** — FILE_DOWNLOAD_ALL absent from this namespace's action list | useFileManagerConfig.js:482-491 | copyediting-stage | |
| AFF-fm-fdfs-row-send-to-editor | file row kebab | `grid.action.sendToTextEditor` → "Send to Text Editor" | FILE_SEND_TO_EDITOR permitted | **declared-unreachable here** — FILE_SEND_TO_EDITOR absent from this namespace's action list | useFileManagerConfig.js:500-511 | copyediting-stage | |
| AFF-fm-fdfs-row-update-file | file row kebab | `grid.action.updateFile` → "Update File Details" | FILE_EDIT permitted | **declared-unreachable here** — FILE_EDIT absent from this namespace's action list | useFileManagerConfig.js:513-519 | copyediting-stage | |
| AFF-fm-fdfs-row-more-info | file row kebab | `grid.action.moreInformation` → "More Information" | FILE_SEE_NOTES: SubEditor/Manager/SiteAdmin/Assistant | none | useFileManagerConfig.js:521-527; matrix :301-312 | copyediting-stage | |
| AFF-fm-fdfs-row-delete | file row kebab | `grid.action.delete` → "Delete" (warnable) | FILE_DELETE permitted | **declared-unreachable here** — FILE_DELETE absent from this namespace's action list | useFileManagerConfig.js:529-536 | copyediting-stage | |

### PRODUCTION_READY_FILES

Permission matrix for this namespace (useFileManagerConfig.js:315-351): SiteAdmin/Manager → SEND_TO_EDITOR; SubEditor/Manager/SiteAdmin/Assistant → LIST, UPLOAD, EDIT, DELETE, SEE_NOTES, DOWNLOAD_ALL. No Author entry at all. All role checks require an assignment in the Production stage. No gridComponent declared. Panel title `editor.submission.production.productionReadyFiles` → "Production Ready Files".

| Atom ID | Surface | Control (locale key → English) | Role gate | State/visibility gate | Source anchor | Hint | Claimed by |
|---|---|---|---|---|---|---|---|
| AFF-fm-pr-col-select | file table column | `editor.submission.selectFiles` → "Select Files" (sr-only header, checkbox cells) | FILE_SELECT permitted | **declared-unreachable here** — FILE_SELECT only exists in `*_SELECT` namespace variants | useFileManagerConfig.js:413-420 | production-stage | |
| AFF-fm-pr-col-numero | file table column | `common.numero` → "No" | none | none | useFileManagerConfig.js:421-425 | production-stage | |
| AFF-fm-pr-col-filename | file table column | `common.fileName` → "File Name" | none | none | useFileManagerConfig.js:426-430 | production-stage | |
| AFF-fm-pr-col-date | file table column | `common.dateUploaded` → "Date uploaded" | none | none | useFileManagerConfig.js:431-435 | production-stage | |
| AFF-fm-pr-col-type | file table column | `common.type` → "Type" | none | none | useFileManagerConfig.js:436-440 | production-stage | |
| AFF-fm-pr-col-more-actions | file table column | `common.moreActions` → "More Actions" (sr-only, kebab cell) | none | none | useFileManagerConfig.js:442-447 | production-stage | |
| AFF-fm-pr-top-upload | panel top bar | `common.upload` → "Upload" | FILE_UPLOAD: SubEditor/Manager/SiteAdmin/Assistant assigned in stage | none | useFileManagerConfig.js:456-464; matrix :321-336 | production-stage | |
| AFF-fm-pr-top-upload-select | panel top bar | `editor.submission.uploadSelectFiles` → "Upload/Select Files" | FILE_SELECT_UPLOAD permitted | **declared-unreachable here** — action absent from PRODUCTION_READY_FILES action list (used by EDITOR_REVIEW_FILES / COPYEDITED_FILES / FINAL_DRAFT_FILES) | useFileManagerConfig.js:466-474 | production-stage | |
| AFF-fm-pr-bottom-download-all | panel bottom bar | `submission.files.downloadAll` → "Download All Files" (link style) | FILE_DOWNLOAD_ALL: SubEditor/Manager/SiteAdmin/Assistant (no Author permissions in this namespace) | `filesCount > 0` | useFileManagerConfig.js:482-491; matrix :321-336 | production-stage | |
| AFF-fm-pr-row-send-to-editor | file row kebab | `grid.action.sendToTextEditor` → "Send to Text Editor" | FILE_SEND_TO_EDITOR: SiteAdmin/Manager only | file extension in pandoc set (docx, odt, rtf, tex, latex, md, markdown) | useFileManagerConfig.js:500-511; :9-17; matrix :317-320 | production-stage | |
| AFF-fm-pr-row-update-file | file row kebab | `grid.action.updateFile` → "Update File Details" | FILE_EDIT: SubEditor/Manager/SiteAdmin/Assistant | none | useFileManagerConfig.js:513-519 | production-stage | |
| AFF-fm-pr-row-more-info | file row kebab | `grid.action.moreInformation` → "More Information" | FILE_SEE_NOTES: SubEditor/Manager/SiteAdmin/Assistant | none | useFileManagerConfig.js:521-527 | production-stage | |
| AFF-fm-pr-row-delete | file row kebab | `grid.action.delete` → "Delete" (warnable) | FILE_DELETE: SubEditor/Manager/SiteAdmin/Assistant | none | useFileManagerConfig.js:529-536 | production-stage | |

### PRODUCTION_READY_FILES_SELECT

Permission matrix for this namespace (useFileManagerConfig.js:352-369): spreads PRODUCTION_READY_FILES, then replaces permissions/actions — SubEditor/Manager/SiteAdmin/Assistant → SEE_NOTES, SELECT; nothing else is permitted. All role checks require an assignment in the Production stage. No gridComponent declared (base declares none). Used as the Production-stage file source in the upload/select wizard (:591-593).

| Atom ID | Surface | Control (locale key → English) | Role gate | State/visibility gate | Source anchor | Hint | Claimed by |
|---|---|---|---|---|---|---|---|
| AFF-fm-prs-col-select | file table column | `editor.submission.selectFiles` → "Select Files" (sr-only header, checkbox cells) | FILE_SELECT: SubEditor/Manager/SiteAdmin/Assistant | none | useFileManagerConfig.js:413-420; matrix :356-367 | production-stage | |
| AFF-fm-prs-col-numero | file table column | `common.numero` → "No" | none | none | useFileManagerConfig.js:421-425 | production-stage | |
| AFF-fm-prs-col-filename | file table column | `common.fileName` → "File Name" | none | none | useFileManagerConfig.js:426-430 | production-stage | |
| AFF-fm-prs-col-date | file table column | `common.dateUploaded` → "Date uploaded" | none | none | useFileManagerConfig.js:431-435 | production-stage | |
| AFF-fm-prs-col-type | file table column | `common.type` → "Type" | none | none | useFileManagerConfig.js:436-440 | production-stage | |
| AFF-fm-prs-col-more-actions | file table column | `common.moreActions` → "More Actions" (sr-only, kebab cell) | none | none | useFileManagerConfig.js:442-447 | production-stage | |
| AFF-fm-prs-top-upload | panel top bar | `common.upload` → "Upload" | FILE_UPLOAD permitted | **declared-unreachable here** — FILE_UPLOAD absent from this namespace's action list (only SEE_NOTES/SELECT) | useFileManagerConfig.js:456-464 | production-stage | |
| AFF-fm-prs-top-upload-select | panel top bar | `editor.submission.uploadSelectFiles` → "Upload/Select Files" | FILE_SELECT_UPLOAD permitted | **declared-unreachable here** — FILE_SELECT_UPLOAD absent from this namespace's action list | useFileManagerConfig.js:466-474 | production-stage | |
| AFF-fm-prs-bottom-download-all | panel bottom bar | `submission.files.downloadAll` → "Download All Files" (link style) | FILE_DOWNLOAD_ALL permitted | **declared-unreachable here** — FILE_DOWNLOAD_ALL absent from this namespace's action list | useFileManagerConfig.js:482-491 | production-stage | |
| AFF-fm-prs-row-send-to-editor | file row kebab | `grid.action.sendToTextEditor` → "Send to Text Editor" | FILE_SEND_TO_EDITOR permitted | **declared-unreachable here** — FILE_SEND_TO_EDITOR absent from this namespace's action list | useFileManagerConfig.js:500-511 | production-stage | |
| AFF-fm-prs-row-update-file | file row kebab | `grid.action.updateFile` → "Update File Details" | FILE_EDIT permitted | **declared-unreachable here** — FILE_EDIT absent from this namespace's action list | useFileManagerConfig.js:513-519 | production-stage | |
| AFF-fm-prs-row-more-info | file row kebab | `grid.action.moreInformation` → "More Information" | FILE_SEE_NOTES: SubEditor/Manager/SiteAdmin/Assistant | none | useFileManagerConfig.js:521-527; matrix :356-367 | production-stage | |
| AFF-fm-prs-row-delete | file row kebab | `grid.action.delete` → "Delete" (warnable) | FILE_DELETE permitted | **declared-unreachable here** — FILE_DELETE absent from this namespace's action list | useFileManagerConfig.js:529-536 | production-stage | |

<!-- section-count: 156 atoms, 52 declared-unreachable -->

## Other managers (managers/*/use*Config.js)

Conventions (per the prototype): English strings resolved from `lib/pkp/locale/en/*.po` + `locale/en/*.po` (repo state 2026-07-25). Role gates named "assigned role" mean `hasCurrentUserAtLeastOneAssignedRoleInStage` — an *assigned* role in the named stage, not merely holding the role in the journal. "declared-unreachable here" = the atom exists in the shared builder but its enabling action is not in this manager's own action list, so it can never render from this config. Config getters that take gating props (e.g. `submissionStageId`, `redactedForAuthors`) are recorded as gates on the atom, not forked per call-site. Atoms are DECLARED affordances — reachability requires a live probe (rule-11).

### CategoryManager (useCategoryManagerConfig.js)

No permissions matrix and no permitted-actions filter: `getColumns`/`getItemActions` return everything unconditionally — role gating happens outside this config (page mount + server). The row "Add" action adds a sub-category under the row's category.

| Atom ID | Surface | Control (locale key → English) | Role gate | State/visibility gate | Source anchor | Hint | Claimed by |
|---|---|---|---|---|---|---|---|
| AFF-catm-col-name | category table column | `grid.category.categoryName` → "Category Name" | none | none | useCategoryManagerConfig.js:19-23 | categories | |
| AFF-catm-col-assigned-to | category table column | `manager.category.assignedTo` → "Assigned To" | none | none | useCategoryManagerConfig.js:25-29 | categories | |
| AFF-catm-col-more-actions | category table column | `common.moreActions` → "More Actions" (sr-only, kebab cell) | none | none | useCategoryManagerConfig.js:30-35 | categories | |
| AFF-catm-row-add | category row kebab | `common.add` → "Add" (add sub-category) | none in config | none | useCategoryManagerConfig.js:45-49 | categories | |
| AFF-catm-row-edit | category row kebab | `common.edit` → "Edit" | none in config | none | useCategoryManagerConfig.js:50-54 | categories | |
| AFF-catm-row-delete | category row kebab | `manager.category.deleteCategory` → "Delete Category" (warnable) | none in config | none | useCategoryManagerConfig.js:55-60 | categories | |

### CitationManager (useCitationManagerConfig.js)

No permissions matrix; no permitted-actions filter. Oddity: the single top item is the component `CitationManagerSearchField` but its `label` prop is `submission.citations.structured.expandAll` → "Expand All" with an empty `action` — the label prop looks vestigial (the component is a search field; expand/collapse-all lives in the `CitationManagerToggleAll` header component).

| Atom ID | Surface | Control (locale key → English) | Role gate | State/visibility gate | Source anchor | Hint | Claimed by |
|---|---|---|---|---|---|---|---|
| AFF-cim-col-citation | citation table column | `submission.citations.structured` → "Structured References" | none | none | useCitationManagerConfig.js:10-14 | publication-metadata-references | |
| AFF-cim-col-toggle-all | citation table column | header is component `CitationManagerToggleAll` (`isHeaderComponent`; expand/collapse-all toggle, label internal to component) | none | none | useCitationManagerConfig.js:16-21 | publication-metadata-references | |
| AFF-cim-col-actions | citation table column | `''` (empty header) — actions cell `CitationManagerCellActions` | none | none | useCitationManagerConfig.js:23-27 | publication-metadata-references | |
| AFF-cim-top-search | panel top bar | `CitationManagerSearchField` (search input; declared label prop `submission.citations.structured.expandAll` → "Expand All", empty action — see paragraph above) | none | none | useCitationManagerConfig.js:35-41 | publication-metadata-references | |
| AFF-cim-row-edit | citation row kebab | `common.edit` → "Edit" | none in config | none | useCitationManagerConfig.js:49-53 | publication-metadata-references | |
| AFF-cim-row-delete | citation row kebab | `common.delete` → "Delete" (warnable) | none in config | none | useCitationManagerConfig.js:55-60 | publication-metadata-references | |
| AFF-cim-row-reprocess | citation row kebab | `admin.citation.reprocess` → "Reprocess" | none in config | `store.citationsMetadataLookup.value && !citation.isStructured` | useCitationManagerConfig.js:62-70 | publication-metadata-references | |

### DataCitationManager (useDataCitationManagerConfig.js)

No permissions matrix; no permitted-actions filter — all items unconditional in config.

| Atom ID | Surface | Control (locale key → English) | Role gate | State/visibility gate | Source anchor | Hint | Claimed by |
|---|---|---|---|---|---|---|---|
| AFF-dcm-col-citation | data-citation table column | `submission.dataCitations.title` → "Title" | none | none | useDataCitationManagerConfig.js:10-13 | data-availability-citations | |
| AFF-dcm-col-actions | data-citation table column | `common.moreActions` → "More Actions" (sr-only, kebab cell) | none | none | useDataCitationManagerConfig.js:15-20 | data-availability-citations | |
| AFF-dcm-top-add | panel top bar | `grid.action.addDataCitation` → "Add a new Data Citation" | none in config | none | useDataCitationManagerConfig.js:28-34 | data-availability-citations | |
| AFF-dcm-top-sort | panel top bar | `DataCitationManagerSortButton` (label internal to component) | none in config | none | useDataCitationManagerConfig.js:36-38 | data-availability-citations | |
| AFF-dcm-row-edit | data-citation row kebab | `common.edit` → "Edit" | none in config | none | useDataCitationManagerConfig.js:46-50 | data-availability-citations | |
| AFF-dcm-row-delete | data-citation row kebab | `common.delete` → "Delete" (warnable) | none in config | none | useDataCitationManagerConfig.js:52-57 | data-availability-citations | |

### DiscussionManager (useDiscussionManagerConfig.js)

Permission matrix (useDiscussionManagerConfig.js:5-36): a single block — SubEditor/Manager/SiteAdmin/Assistant/Author/Reviewer → all seven actions (LIST, ADD, SEARCH, EDIT, DELETE, HISTORY, ADD_TASK_DETAILS). `getManagerConfig` (:84-101) permits an action when the user has an assigned matrix role in the passed `submissionStageId` **OR** `isCurrentUserAssignedAsReviewer(submission)` — the reviewer test is OR-ed outside the role check, so an assigned reviewer gets every action regardless of stage assignment. Row actions additionally require `userHasWriteAccess` (:127-140): journal manager, work-item owner (`workItem.createdBy`), or the responsible participant. `getBottomItems` (:103-106) always returns `[]` — no bottom atoms. SEARCH is in the matrix but no getter declares a search control (search UI is component-internal).

| Atom ID | Surface | Control (locale key → English) | Role gate | State/visibility gate | Source anchor | Hint | Claimed by |
|---|---|---|---|---|---|---|---|
| AFF-dm-col-name | work-item table column | `common.name` → "Name" | none | none | useDiscussionManagerConfig.js:50-53 | tasks-discussions | |
| AFF-dm-col-activity | work-item table column | `submission.query.activityName` → "Activity" | none | none | useDiscussionManagerConfig.js:55-58 | tasks-discussions | |
| AFF-dm-col-due-date | work-item table column | `common.dueDate` → "Due Date" | none | none | useDiscussionManagerConfig.js:60-63 | tasks-discussions | |
| AFF-dm-col-started | work-item table column | `submission.query.started` → "Started" | none | none | useDiscussionManagerConfig.js:65-68 | tasks-discussions | |
| AFF-dm-col-closed | work-item table column | `submission.query.closed` → "Closed" | none | none | useDiscussionManagerConfig.js:70-73 | tasks-discussions | |
| AFF-dm-col-more-actions | work-item table column | `common.moreActions` → "More Actions" (sr-only, kebab cell) | none | none | useDiscussionManagerConfig.js:75-79 | tasks-discussions | |
| AFF-dm-top-add | panel top bar | `common.add` → "Add" | TASKS_AND_DISCUSSIONS_ADD permitted (any matrix role assigned in stage, or assigned reviewer) | none | useDiscussionManagerConfig.js:112-120 | tasks-discussions | |
| AFF-dm-row-edit | work-item row kebab | `common.edit` → "Edit" | `userHasWriteAccess` (journal manager / owner / responsible participant) — note: pushed without a permittedActions check | `disabled: !!workItem?.dateClosed` | useDiscussionManagerConfig.js:150-155 | tasks-discussions | |
| AFF-dm-row-add-task-details | work-item row kebab | `discussion.addTaskDetails` → "Add Task Details" | `userHasWriteAccess` | `workItem.type === EDITORIAL_TASK_TYPE_DISCUSSION && workItem.status === EDITORIAL_TASK_STATUS_IN_PROGRESS` | useDiscussionManagerConfig.js:157-167 | tasks-discussions | |
| AFF-dm-row-history | work-item row kebab | `common.history` → "History" | TASKS_AND_DISCUSSIONS_HISTORY permitted + `userHasWriteAccess` | none | useDiscussionManagerConfig.js:170-179 | tasks-discussions | |
| AFF-dm-row-delete | work-item row kebab | `common.delete` → "Delete" (warnable) | TASKS_AND_DISCUSSIONS_DELETE permitted + `userHasWriteAccess` | none | useDiscussionManagerConfig.js:181-191 | tasks-discussions | |

### GalleyManager (useGalleyManagerConfig.js)

Permission matrix (useGalleyManagerConfig.js:6-39): Author → GALLEY_LIST only; SubEditor/Manager/SiteAdmin/Assistant → LIST, ADD, CHANGE_FILE, DELETE, EDIT, SORT, MORE_INFO. `getManagerConfig` (:80-98) checks the assigned role in `WORKFLOW_STAGE_ID_PRODUCTION` (hard-coded, regardless of currently viewed stage). Authors therefore see the list but no declared controls. Legacy grid cross-ref (atlas/grids.md): `getGalleyGridComponent` (:46-52) returns `grid.articleGalleys.ArticleGalleyGridHandler` (OJS) or `grid.preprintGalleys.PreprintGalleyGridHandler` (OPS).

| Atom ID | Surface | Control (locale key → English) | Role gate | State/visibility gate | Source anchor | Hint | Claimed by |
|---|---|---|---|---|---|---|---|
| AFF-gm-col-name | galley table column | `common.name` → "Name" | none | none | useGalleyManagerConfig.js:57-61 | galleys | |
| AFF-gm-col-language | galley table column | `common.language` → "Language" | none | none | useGalleyManagerConfig.js:63-68 | galleys | |
| AFF-gm-col-more-actions | galley table column | `common.moreActions` → "More Actions" (sr-only, kebab cell) | none | none | useGalleyManagerConfig.js:70-75 | galleys | |
| AFF-gm-bottom-add | panel bottom bar | `grid.action.addGalley` → "Add galley" (link style) | GALLEY_ADD: SubEditor/Manager/SiteAdmin/Assistant assigned in Production | none | useGalleyManagerConfig.js:103-109 | galleys | |
| AFF-gm-top-sort | panel top bar | `GalleyManagerSortButton` (label internal to component) | GALLEY_SORT: SubEditor/Manager/SiteAdmin/Assistant assigned in Production | `galleys.value.length` > 0 | useGalleyManagerConfig.js:117-122 | galleys | |
| AFF-gm-row-edit-view | galley row kebab | `common.edit` → "Edit" / `common.view` → "View" (label+icon flip to View when `publication.status === STATUS_PUBLISHED`) | GALLEY_EDIT: SubEditor/Manager/SiteAdmin/Assistant assigned in Production | none (label state-dependent) | useGalleyManagerConfig.js:129-145 | galleys | |
| AFF-gm-row-change-file | galley row kebab | `submission.changeFile` → "Change File" | GALLEY_CHANGE_FILE: SubEditor/Manager/SiteAdmin/Assistant assigned in Production | none | useGalleyManagerConfig.js:147-153 | galleys | |
| AFF-gm-row-more-info | galley row kebab | `grid.action.moreInformation` → "More Information" | GALLEY_MORE_INFO: SubEditor/Manager/SiteAdmin/Assistant assigned in Production | `galley.submissionFileId` present (absent for remote-URL galleys) | useGalleyManagerConfig.js:155-164 | galleys | |
| AFF-gm-row-delete | galley row kebab | `common.delete` → "Delete" (warnable) | GALLEY_DELETE: SubEditor/Manager/SiteAdmin/Assistant assigned in Production | none | useGalleyManagerConfig.js:166-173 | galleys | |

### MediaFileManager (useMediaFileManagerConfig.js)

Permission matrix (useMediaFileManagerConfig.js:5-38): Author → MEDIA_FILE_LIST only; SubEditor/Manager/SiteAdmin/Assistant → LIST, ADD, BATCH_LINK_IMAGES, INFO, EDIT_METADATA, MANUALLY_LINK_IMAGE, DELETE. `getManagerConfig` (:78-94) checks the assigned role in `WORKFLOW_STAGE_ID_PRODUCTION` (hard-coded). Note: the group-id column is rendered explicitly in MediaFileManager.vue (spans grouped rows) and is deliberately not declared in `getColumns` (comment at :45-46).

| Atom ID | Surface | Control (locale key → English) | Role gate | State/visibility gate | Source anchor | Hint | Claimed by |
|---|---|---|---|---|---|---|---|
| AFF-mfm-col-filename | media-file table column | `common.fileName` → "File Name" | none | none | useMediaFileManagerConfig.js:49-52 | media-files | |
| AFF-mfm-col-type | media-file table column | `common.type` → "Type" | none | none | useMediaFileManagerConfig.js:54-57 | media-files | |
| AFF-mfm-col-size | media-file table column | `common.size` → "Size" | none | none | useMediaFileManagerConfig.js:59-62 | media-files | |
| AFF-mfm-col-date-uploaded | media-file table column | `common.dateUploaded` → "Date uploaded" | none | none | useMediaFileManagerConfig.js:64-67 | media-files | |
| AFF-mfm-col-more-actions | media-file table column | `common.moreActions` → "More Actions" (sr-only, kebab cell) | none | none | useMediaFileManagerConfig.js:69-73 | media-files | |
| AFF-mfm-top-batch-link | panel top bar | `publication.mediaFiles.batchLinkMedia` → "Batch Link Media" | MEDIA_FILE_BATCH_LINK_IMAGES: SubEditor/Manager/SiteAdmin/Assistant assigned in Production | none | useMediaFileManagerConfig.js:100-108 | media-files | |
| AFF-mfm-top-add | panel top bar | `publication.mediaFiles.add` → "Add Media File" | MEDIA_FILE_ADD: SubEditor/Manager/SiteAdmin/Assistant assigned in Production | none | useMediaFileManagerConfig.js:110-118 | media-files | |
| AFF-mfm-row-info | media-file row kebab | `grid.action.moreInformation` → "More Information" | MEDIA_FILE_INFO: SubEditor/Manager/SiteAdmin/Assistant assigned in Production | none | useMediaFileManagerConfig.js:126-132 | media-files | |
| AFF-mfm-row-edit-metadata | media-file row kebab | `grid.action.editMetadata` → "Edit Metadata" | MEDIA_FILE_EDIT_METADATA: SubEditor/Manager/SiteAdmin/Assistant assigned in Production | none | useMediaFileManagerConfig.js:134-140 | media-files | |
| AFF-mfm-row-manually-link | media-file row kebab | `publication.mediaFiles.manuallyLinkMedia` → "Manually Link Media" | MEDIA_FILE_MANUALLY_LINK_IMAGE: SubEditor/Manager/SiteAdmin/Assistant assigned in Production | `mediaFile.genreSupportsFileVariants` | useMediaFileManagerConfig.js:142-153 | media-files | |
| AFF-mfm-row-delete | media-file row kebab | `grid.action.deleteFile` → "Delete File" (warnable) | MEDIA_FILE_DELETE: SubEditor/Manager/SiteAdmin/Assistant assigned in Production | none | useMediaFileManagerConfig.js:155-162 | media-files | |

### ParticipantManager (useParticipantManagerConfig.js)

No permissions-matrix constant; gates are inline. `canAdminister` = `hasCurrentUserAtLeastOneAssignedRoleInStage(submission, submissionStageId, [Manager, SiteAdmin, SubEditor])` (:13-21, :46-54); the stage is a prop, recorded as a gate rather than forked per call-site. Row edit additionally requires `canCurrentUserEditParticipant(participant, submissionStageId, submission, participants)`. This config declares no `getColumns` — the participant list renders via `getItemInfoItems` (info components per row), not a column table. Declared actions round-trip through the legacy `grid.users.stageParticipant.StageParticipantGridHandler` modals (see useParticipantManagerActions.js; cross-ref atlas/grids.md).

| Atom ID | Surface | Control (locale key → English) | Role gate | State/visibility gate | Source anchor | Hint | Claimed by |
|---|---|---|---|---|---|---|---|
| AFF-pm-top-assign | panel top bar | `common.assign` → "Assign" | `canAdminister`: Manager/SiteAdmin/SubEditor assigned in the given stage | none | useParticipantManagerConfig.js:23-28 | stage-participants | |
| AFF-pm-row-edit | participant row kebab | `common.edit` → "Edit" | `canAdminister` AND `canCurrentUserEditParticipant(...)` | none | useParticipantManagerConfig.js:63-69 | stage-participants | |
| AFF-pm-row-notify | participant row kebab | `submission.stageParticipants.notify` → "Notify" | none in config (always pushed) | none | useParticipantManagerConfig.js:71-75 | stage-participants | |
| AFF-pm-row-login-as | participant row kebab | `grid.action.logInAs` → "Login As" | `participant.canLoginAs` (server-computed) | none | useParticipantManagerConfig.js:77-83 | login-as | |
| AFF-pm-row-remove | participant row kebab | `common.remove` → "Remove" (warnable) | `canAdminister` | none | useParticipantManagerConfig.js:85-92 | stage-participants | |
| AFF-pm-info-name | participant row (info stack) | `ParticipantManagerItemInfoName` (display; content internal to component) | none | none | useParticipantManagerConfig.js:100 | stage-participants | |
| AFF-pm-info-role | participant row (info stack) | `ParticipantManagerItemInfoRole` (display; content internal to component) | none | none | useParticipantManagerConfig.js:101 | stage-participants | |
| AFF-pm-info-recommend-only | participant row (info stack) | `ParticipantManagerItemInfoRecommendOnly` (display badge; content internal to component) | none | `participant.recommendOnly` | useParticipantManagerConfig.js:102-107 | recommend-only-editors | |

### ReviewerManager (useReviewerManagerConfig.js)

No permissions matrix; the whole config forks on the `redactedForAuthors` prop (the anonymized author-facing view) plus per-assignment `statusId` switches. The composable takes a `recommendations` prop — recommendation strings resolve only when it is defined (OJS; `undefined` in OMP/OPS, `getRecommendationString` then returns null, :12-25). `getCellStatusItems` (:9-168) declares eleven status-cell displays (one per REVIEW_ASSIGNMENT_STATUS_*), atomized below as display atoms; each also appends `reviewer.competingInterests` → "Competing Interests" when `reviewAssignment.competingInterests?.length`. Extra getter beyond the usual four: `getItemPrimaryActions` (inline row buttons in the Actions column).

| Atom ID | Surface | Control (locale key → English) | Role gate | State/visibility gate | Source anchor | Hint | Claimed by |
|---|---|---|---|---|---|---|---|
| AFF-rvm-col-reviewer | reviewer table column | `user.role.reviewer` → "Reviewer" | none | none | useReviewerManagerConfig.js:175-179 | assign-and-manage-reviewers | |
| AFF-rvm-col-status | reviewer table column | `reviewerManager.reviewerStatus` → "Reviewer status" | none | `!redactedForAuthors` (hidden in author view) | useReviewerManagerConfig.js:181-187 | assign-and-manage-reviewers | |
| AFF-rvm-col-type | reviewer table column | `common.type` → "Type" | none | none | useReviewerManagerConfig.js:189-193 | assign-and-manage-reviewers | |
| AFF-rvm-col-primary-actions | reviewer table column | `grid.columns.actions` → "Actions" | none | none | useReviewerManagerConfig.js:195-199 | assign-and-manage-reviewers | |
| AFF-rvm-col-more-actions | reviewer table column | `common.moreActions` → "More Actions" (sr-only, kebab cell) | none | `!redactedForAuthors` | useReviewerManagerConfig.js:201-208 | assign-and-manage-reviewers | |
| AFF-rvm-top-add-reviewer | panel top bar | `editor.submission.addReviewer` → "Add Reviewer" | none in config | `!redactedForAuthors` (getTopItems returns `[]` for authors) | useReviewerManagerConfig.js:218-224 | assign-and-manage-reviewers | |
| AFF-rvm-primary-read-review-author | reviewer row primary button | `editor.review.readReview` → "Read Review" (author variant, REVIEWER_READ_REVIEW_BY_AUTHOR) | author-redacted view only (`redactedForAuthors`) | `statusId` in COMPLETE/THANKED/RECEIVED/VIEWED; otherwise no primary actions in author view | useReviewerManagerConfig.js:233-250 | review-anonymity | |
| AFF-rvm-primary-send-reminder | reviewer row primary button | `editor.review.sendReminder` → "Send Reminder" | none in config (editor view) | `statusId` in RESPONSE_OVERDUE/REVIEW_OVERDUE | useReviewerManagerConfig.js:251-260 | assign-and-manage-reviewers | |
| AFF-rvm-primary-thank-reviewer | reviewer row primary button | `editor.review.thankReviewer` → "Thank Reviewer" | none in config (editor view) | `statusId === REVIEW_ASSIGNMENT_STATUS_COMPLETE` | useReviewerManagerConfig.js:264-267 | assign-and-manage-reviewers | |
| AFF-rvm-primary-revert-consider | reviewer row primary button | `editor.review.revertDecision` → "Revert Decision" | none in config (editor view) | `statusId` COMPLETE or THANKED (pushed in both branches) | useReviewerManagerConfig.js:268-271, 275-278 | assign-and-manage-reviewers | |
| AFF-rvm-primary-read-review | reviewer row primary button | `editor.review.readReview` → "Read Review" | none in config (editor view) | `statusId` in RECEIVED/VIEWED | useReviewerManagerConfig.js:285-288 | assign-and-manage-reviewers | |
| AFF-rvm-row-review-details | reviewer row kebab | `editor.review.reviewDetails` → "Review Details" | none in config | `statusId !== REVIEW_ASSIGNMENT_STATUS_CANCELLED` | useReviewerManagerConfig.js:297-306 | assign-and-manage-reviewers | |
| AFF-rvm-row-email-reviewer | reviewer row kebab | `editor.review.emailReviewer` → "Email Reviewer" | none in config | none (always pushed) | useReviewerManagerConfig.js:309-313 | assign-and-manage-reviewers | |
| AFF-rvm-row-resend-request | reviewer row kebab | `editor.review.resendRequestReviewer` → "Resend Review Request" | none in config | `statusId === REVIEW_ASSIGNMENT_STATUS_DECLINED` | useReviewerManagerConfig.js:316-324 | reviewer-response | |
| AFF-rvm-row-edit | reviewer row kebab | `common.edit` → "Edit" | none in config | `statusId !== REVIEW_ASSIGNMENT_STATUS_CANCELLED` | useReviewerManagerConfig.js:330-334 | assign-and-manage-reviewers | |
| AFF-rvm-row-unassign-cancel | reviewer row kebab | `editor.review.unassignReviewer` → "Unassign Reviewer" / `editor.review.cancelReviewer` → "Cancel Reviewer" (label+action flip on `reviewAssignment.dateConfirmed`; warnable) | none in config | `statusId !== CANCELLED`; unconfirmed → Unassign, confirmed → Cancel | useReviewerManagerConfig.js:336-345 | assign-and-manage-reviewers | |
| AFF-rvm-row-reinstate | reviewer row kebab | `editor.review.reinstateReviewer` → "Reinstate Reviewer" | none in config | `statusId === REVIEW_ASSIGNMENT_STATUS_CANCELLED` (else branch of the pair above) | useReviewerManagerConfig.js:347-351 | assign-and-manage-reviewers | |
| AFF-rvm-row-history | reviewer row kebab | `submission.history` → "History" | none in config | none (always pushed) | useReviewerManagerConfig.js:355-359 | assign-and-manage-reviewers | |
| AFF-rvm-row-login-as | reviewer row kebab | `grid.action.logInAs` → "Login As" | `reviewAssignment.canLoginAs` (server-computed) | none | useReviewerManagerConfig.js:361-367 | login-as | |
| AFF-rvm-row-gossip | reviewer row kebab | `user.gossip` → "Editorial Notes" | `reviewAssignment.canGossip` (server-computed) | none | useReviewerManagerConfig.js:368-374 | assign-and-manage-reviewers | |
| AFF-rvm-row-log-response | reviewer row kebab | `editor.review.logResponse` → "Log Response" | none in config | `!reviewAssignment.dateConfirmed` | useReviewerManagerConfig.js:376-382 | reviewer-response | |
| AFF-rvm-row-send-to-orcid | reviewer row kebab | `dashboard.reviewAssignment.action.sendReviewToOrcid` → "Send Review To ORCID" | none in config | `reviewAssignment.reviewerHasOrcid && pkp.const.REVIEW_ASSIGNMENT_STATUS_COMPLETE` — second operand is a bare constant (always truthy), so the intended status check is inoperative as written | useReviewerManagerConfig.js:385-394 | assign-and-manage-reviewers | |
| AFF-rvm-status-awaiting-response | reviewer row status cell (display) | `editor.review.requestSent` → "Request Sent"; message `editor.review.responseDue` → "Response due: {$date}" | none | `statusId === REVIEW_ASSIGNMENT_STATUS_AWAITING_RESPONSE` | useReviewerManagerConfig.js:34-45 | assign-and-manage-reviewers | |
| AFF-rvm-status-accepted | reviewer row status cell (display) | `editor.review.requestAccepted` → "Request Accepted"; `editor.review.reviewDue` → "Review due: {$date}" | none | `statusId === REVIEW_ASSIGNMENT_STATUS_ACCEPTED` | useReviewerManagerConfig.js:47-58 | assign-and-manage-reviewers | |
| AFF-rvm-status-complete | reviewer row status cell (display) | `common.complete` → "Complete" (+ recommendation string when `recommendations` prop defined) | none | `statusId === REVIEW_ASSIGNMENT_STATUS_COMPLETE` | useReviewerManagerConfig.js:59-68 | assign-and-manage-reviewers | |
| AFF-rvm-status-review-overdue | reviewer row status cell (display) | `common.overdue` → "Overdue" (negative); `editor.review.reviewDue` → "Review due: {$date}" | none | `statusId === REVIEW_ASSIGNMENT_STATUS_REVIEW_OVERDUE` | useReviewerManagerConfig.js:69-81 | assign-and-manage-reviewers | |
| AFF-rvm-status-response-overdue | reviewer row status cell (display) | `common.overdue` → "Overdue" (negative); `editor.review.responseDue` → "Response due: {$date}" | none | `statusId === REVIEW_ASSIGNMENT_STATUS_RESPONSE_OVERDUE` | useReviewerManagerConfig.js:83-95 | assign-and-manage-reviewers | |
| AFF-rvm-status-declined | reviewer row status cell (display) | `editor.review.requestDeclined` → "Request Declined"; tooltip `editor.review.requestDeclined.tooltip` → "The reviewer declined this review request." | none | `statusId === REVIEW_ASSIGNMENT_STATUS_DECLINED` | useReviewerManagerConfig.js:97-106 | assign-and-manage-reviewers | |
| AFF-rvm-status-cancelled | reviewer row status cell (display) | `editor.review.requestCancelled` → "Request Cancelled"; tooltip `editor.review.requestCancelled.tooltip` → "The editor cancelled this review request." | none | `statusId === REVIEW_ASSIGNMENT_STATUS_CANCELLED` | useReviewerManagerConfig.js:108-117 | assign-and-manage-reviewers | |
| AFF-rvm-status-received | reviewer row status cell (display) | `editor.review.reviewSubmitted` → "Review Submitted" (+ recommendation) | none | `statusId === REVIEW_ASSIGNMENT_STATUS_RECEIVED` | useReviewerManagerConfig.js:119-128 | assign-and-manage-reviewers | |
| AFF-rvm-status-thanked | reviewer row status cell (display) | `editor.review.reviewerThanked` → "Reviewer Thanked" (+ recommendation) | none | `statusId === REVIEW_ASSIGNMENT_STATUS_THANKED` | useReviewerManagerConfig.js:130-139 | assign-and-manage-reviewers | |
| AFF-rvm-status-request-resend | reviewer row status cell (display) | `editor.review.ReviewerResendRequest` → "Request Resent"; description uses `editor.review.responseDue` → "Response due: {$date}" (note: fed `dateDue`, not `dateResponseDue`) | none | `statusId === REVIEW_ASSIGNMENT_STATUS_REQUEST_RESEND` | useReviewerManagerConfig.js:141-152 | assign-and-manage-reviewers | |
| AFF-rvm-status-viewed | reviewer row status cell (display) | `editor.review.reviewViewed` → "Review Viewed" (+ recommendation) | none | `statusId === REVIEW_ASSIGNMENT_STATUS_VIEWED` | useReviewerManagerConfig.js:153-162 | assign-and-manage-reviewers | |

### TaskTemplateManager (useTaskTemplateManagerConfig.js)

Permission matrix (useTaskTemplateManagerConfig.js:4-22): Manager/SiteAdmin → LIST, ADD, EDIT, DELETE. However `getManagerConfig` (:49-58) filters only on `perm.actions.includes(action)` — the matrix `roles` array is never consulted, so client-side every declared action is always permitted; role enforcement is server-side only. ADD is in the matrix but no getter declares an Add control (the add affordance lives in the hosting page/component, not this config).

| Atom ID | Surface | Control (locale key → English) | Role gate | State/visibility gate | Source anchor | Hint | Claimed by |
|---|---|---|---|---|---|---|---|
| AFF-ttm-col-name | template table column | `taskTemplates.templateName` → "Task and discussion template name" | none | none | useTaskTemplateManagerConfig.js:30-33 | tasks-discussions | |
| AFF-ttm-col-auto-add | template table column | `taskTemplates.templateAutoAddAtStage` → "Auto-add at stage" | none | none | useTaskTemplateManagerConfig.js:35-38 | tasks-discussions | |
| AFF-ttm-col-more-actions | template table column | `common.moreActions` → "More Actions" (sr-only, kebab cell) | none | none | useTaskTemplateManagerConfig.js:40-44 | tasks-discussions | |
| AFF-ttm-row-edit | template row kebab | `common.edit` → "Edit" | TASK_TEMPLATES_EDIT permitted (matrix says Manager/SiteAdmin but roles not enforced client-side — see paragraph) | none | useTaskTemplateManagerConfig.js:62-68 | tasks-discussions | |
| AFF-ttm-row-delete | template row kebab | `common.delete` → "Delete" (warnable) | TASK_TEMPLATES_DELETE permitted (same caveat) | none | useTaskTemplateManagerConfig.js:70-77 | tasks-discussions | |

### UserAccessManager (useUserAccessManagerConfig.js)

No permissions matrix; gates inline. Self-row protection: Login As / Remove / Disable / Merge are all inside `getCurrentUserId() !== user.id` (:24-54), so no user sees them on their own row. Edit and Email are unconditional. A commented-out `getBottomItems` exists (:116) — nothing declared.

| Atom ID | Surface | Control (locale key → English) | Role gate | State/visibility gate | Source anchor | Hint | Claimed by |
|---|---|---|---|---|---|---|---|
| AFF-uam-col-name | user table column | `userAccess.tableHeader.name` → "Name" | none | none | useUserAccessManagerConfig.js:65-69 | user-management | |
| AFF-uam-col-email | user table column | `about.contact.email` → "Email" | none | none | useUserAccessManagerConfig.js:71-75 | user-management | |
| AFF-uam-col-roles | user table column | `user.roles` → "Roles" | none | none | useUserAccessManagerConfig.js:77-81 | roles-permissions | |
| AFF-uam-col-start-date | user table column | `userAccess.tableHeader.startDate` → "Start Date" | none | none | useUserAccessManagerConfig.js:82-86 | user-management | |
| AFF-uam-col-affiliation | user table column | `user.affiliation` → "Affiliation" | none | none | useUserAccessManagerConfig.js:87-91 | user-management | |
| AFF-uam-col-more-actions | user table column | `common.moreActions` → "More Actions" (sr-only, kebab cell) | none | none | useUserAccessManagerConfig.js:93-98 | user-management | |
| AFF-uam-top-search | panel top bar | `UserAccessManagerActionSearch` (search input; label internal to component) | none | none | useUserAccessManagerConfig.js:105-109 | user-management | |
| AFF-uam-row-edit | user row kebab | `common.edit` → "Edit" | none in config | none (always pushed) | useUserAccessManagerConfig.js:12-16 | user-management | |
| AFF-uam-row-email | user row kebab | `email.email` → "Email" | none in config | none (always pushed) | useUserAccessManagerConfig.js:18-22 | user-management | |
| AFF-uam-row-login-as | user row kebab | `grid.user.logInAs` → "Login As" | `user.canLoginAs` (server-computed) | `getCurrentUserId() !== user.id` | useUserAccessManagerConfig.js:24-30 | login-as | |
| AFF-uam-row-remove | user row kebab | `grid.user.remove` → "Remove User" (warnable) | none in config | not self AND `user.groups.find((value) => value.dateEnd === null)` (has an active group) | useUserAccessManagerConfig.js:32-39 | user-management | |
| AFF-uam-row-disable-enable | user row kebab | `grid.user.disable` → "Disable User" / `grid.user.enable` → "Enable User" (label+icon flip on `user.disabled`; warnable only when disabling) | none in config | `getCurrentUserId() !== user.id` | useUserAccessManagerConfig.js:41-46 | user-management | |
| AFF-uam-row-merge | user row kebab | `grid.action.mergeUser` → "Merge user" | `user.canMergeUsers` (server-computed) | `getCurrentUserId() !== user.id` | useUserAccessManagerConfig.js:48-53 | user-management | |

### ReviewRoundResponseManager / AuthorResponseRequestManager (useReviewRoundAuthorResponseConfig.js)

No permissions matrix; the actions column and both row actions exist only once a response has been submitted (`reviewRound.authorResponse`). Row actions are declared for every listed author but `disabled` unless that author is the one who submitted the response (`response.submittedByUser.id === authorUser.id`). The local Actions constant declares `RESPONSE_EDIT` (:5) but no getter ever emits it — declared action with no declared control, not counted as an atom.

| Atom ID | Surface | Control (locale key → English) | Role gate | State/visibility gate | Source anchor | Hint | Claimed by |
|---|---|---|---|---|---|---|---|
| AFF-rrar-col-author | author-response table column | `user.role.author` → "Author" | none | none | useReviewRoundAuthorResponseConfig.js:12-17 | review-rounds-and-revisions | |
| AFF-rrar-col-status | author-response table column | `editor.submission.reviewRound.responseStatus` → "Response Status" | none | none | useReviewRoundAuthorResponseConfig.js:18-23 | review-rounds-and-revisions | |
| AFF-rrar-col-actions | author-response table column | `grid.columns.actions` → "Actions" (sr-only, kebab cell) | none | `reviewRound.value.authorResponse` present (no actions column before a response is submitted) | useReviewRoundAuthorResponseConfig.js:28-35 | review-rounds-and-revisions | |
| AFF-rrar-top-request-response | panel top bar | `editor.submission.reviewRound.RequestResponse` → "Request Response" (navigates to request-response page) | none in config | none | useReviewRoundAuthorResponseConfig.js:83-91 | review-rounds-and-revisions | |
| AFF-rrar-row-view | author row kebab | `common.view` → "View" | none in config | `reviewRound.authorResponse` exists; `disabled` unless `response.submittedByUser.id === authorUser.id` | useReviewRoundAuthorResponseConfig.js:61-66 | review-rounds-and-revisions | |
| AFF-rrar-row-delete | author row kebab | `common.delete` → "Delete" (warnable) | none in config | `reviewRound.authorResponse` exists; `disabled` unless submitting author | useReviewRoundAuthorResponseConfig.js:67-73 | review-rounds-and-revisions | |

<!-- section-count: 115 atoms, 0 declared-unreachable -->

## Dashboards (pages/dashboard/composables)

English strings resolved from `lib/pkp/locale/en/*.po` (repo state 2026-07-25). Dashboard configs switch on `dashboardPage` (`EDITORIAL_DASHBOARD` / `MY_REVIEW_ASSIGNMENTS` / `MY_SUBMISSIONS`) — that switch is recorded as the role gate, since the page type is itself role-gated (editors / reviewers / authors respectively). "declared-unreachable here" = the item is declared in this slice's config but a stated condition (or the code's own comment) prevents it from ever rendering in OJS.

### useDashboardConfig.js — controls and table columns

`getLeftControls` / `getRightControls` are shared by all three dashboard views (no `dashboardPage` switch); the bulk controls self-gate via `bulkDeleteIsAvailableForUser` (useDashboardBulkDelete.js:71-84), which is false on My Review Assignments. Columns are declared per view by `getColumns`.

| Atom ID | Surface | Control (locale key → English) | Role gate | State/visibility gate | Source anchor | Hint | Claimed by |
|---|---|---|---|---|---|---|---|
| AFF-dash-ctl-filters | top bar, left | `common.filter` → "Filters" (opens filters modal) | none (all dashboard views) | none | useDashboardConfig.js:10-13 | editorial-dashboards | |
| AFF-dash-ctl-bulk-actions | top bar, left | DashboardControlBulkActions dropdown — trigger `common.moreActions` → "More Actions"; menu entry `dashboard.submissions.incomplete.bulkDelete.button` → "Delete Incomplete Submissions" (labels live in DashboardControlBulkActions.vue) | editorial dashboard: Manager/SiteAdmin; My Submissions: any author | component self-gates on `bulkDeleteIsAvailableForUser` — never on My Review Assignments | useDashboardConfig.js:15-18 | submission-drafts | |
| AFF-dash-ctl-bulk-delete-btn | top bar, left | DashboardControlBulkDeleteButton — `dashboard.submissions.incomplete.bulkDelete.button` → "Delete Incomplete Submissions" / `common.cancel` → "Cancel" while selection active (labels live in DashboardControlBulkDeleteButton.vue) | same as AFF-dash-ctl-bulk-actions | component self-gates on `bulkDeleteIsAvailableForUser` and toggles with `bulkDeleteSelectionEnabled` | useDashboardConfig.js:20-23 | submission-drafts | |
| AFF-dash-ctl-search | top bar, right | DashboardControlSearch — `editor.submission.search` → "Search submissions, ID, authors, keywords, etc." (label lives in DashboardControlSearch.vue) | none (all dashboard views) | none | useDashboardConfig.js:31 | editorial-dashboards | |
| AFF-dash-ra-col-id | review-assignments table column | `common.id` → "ID" (sortable) | `dashboardPage === MY_REVIEW_ASSIGNMENTS` | none | useDashboardConfig.js:39-44 | editorial-dashboards | |
| AFF-dash-ra-col-title | review-assignments table column | `navigation.submissions` → "Submissions" | `dashboardPage === MY_REVIEW_ASSIGNMENTS` | none | useDashboardConfig.js:46-51 | editorial-dashboards | |
| AFF-dash-ra-col-activity | review-assignments table column | `stats.editorialActivity` → "Editorial Activity" | `dashboardPage === MY_REVIEW_ASSIGNMENTS` | none | useDashboardConfig.js:53-58 | editorial-dashboards | |
| AFF-dash-ra-col-actions | review-assignments table column | `admin.jobs.list.actions` → "Actions" | `dashboardPage === MY_REVIEW_ASSIGNMENTS` | none | useDashboardConfig.js:60-65 | editorial-dashboards | |
| AFF-dash-my-col-id | my-submissions table column | `common.id` → "ID" (sortable) | `dashboardPage === MY_SUBMISSIONS` | none | useDashboardConfig.js:67-72 | author-dashboard | |
| AFF-dash-my-col-title | my-submissions table column | `navigation.submissions` → "Submissions" | `dashboardPage === MY_SUBMISSIONS` | none | useDashboardConfig.js:74-79 | author-dashboard | |
| AFF-dash-my-col-stage | my-submissions table column | `workflow.stage` → "Stage" | `dashboardPage === MY_SUBMISSIONS` | none | useDashboardConfig.js:81-86 | author-dashboard | |
| AFF-dash-my-col-activity | my-submissions table column | `stats.editorialActivity` → "Editorial Activity" | `dashboardPage === MY_SUBMISSIONS` | none | useDashboardConfig.js:88-93 | author-dashboard | |
| AFF-dash-my-col-actions | my-submissions table column | `admin.jobs.list.actions` → "Actions" | `dashboardPage === MY_SUBMISSIONS` | none | useDashboardConfig.js:95-100 | author-dashboard | |
| AFF-dash-ed-col-id | editorial table column | `common.id` → "ID" (sortable) | editorial dashboard (else branch) | none | useDashboardConfig.js:102-107 | editorial-dashboards | |
| AFF-dash-ed-col-title | editorial table column | `navigation.submissions` → "Submissions" | editorial dashboard | none | useDashboardConfig.js:109-114 | editorial-dashboards | |
| AFF-dash-ed-col-stage | editorial table column | `workflow.stage` → "Stage" | editorial dashboard | none | useDashboardConfig.js:116-121 | editorial-dashboards | |
| AFF-dash-ed-col-days | editorial table column | `editor.submission.days` → "Days" (sortable, id `lastActivity`) | editorial dashboard | none | useDashboardConfig.js:123-128 | editorial-dashboards | |
| AFF-dash-ed-col-activity | editorial table column | `stats.editorialActivity` → "Editorial Activity" | editorial dashboard | none | useDashboardConfig.js:130-135 | editorial-dashboards | |
| AFF-dash-ed-col-actions | editorial table column | `admin.jobs.list.actions` → "Actions" | editorial dashboard | none | useDashboardConfig.js:137-142 | editorial-dashboards | |

### useDashboardConfigEditorialActivity.js — per-status activity cell content

One atom per return-site cell item (alert or action button rendered in the "Editorial Activity" cell). Branch conditions mentioning `WORKFLOW_STAGE_ID_INTERNAL_REVIEW` are OMP-only legs; in OJS those branches are reachable via `WORKFLOW_STAGE_ID_EXTERNAL_REVIEW` alone, so the atoms are not flagged. `DashboardCellSubmissionActivityReviews` (the per-reviewer indicator row) is pushed by five branches and recorded once; its per-indicator popover controls are the useDashboardConfigReviewActivity atoms below.

Editorial dashboard view (`getEditorialActivityForEditorialDashboard`):

| Atom ID | Surface | Control (locale key → English) | Role gate | State/visibility gate | Source anchor | Hint | Claimed by |
|---|---|---|---|---|---|---|---|
| AFF-dash-edact-no-access-author | activity cell | `dashboard.noAccessBeingAuthor` → "You cannot access this submission as a Journal Manager since you are the author. To view it, go to \"My Submissions\"" (alert) | assigned as Author AND NOT assigned as Manager/SubEditor/Assistant in any stage | short-circuits all other cell content | useDashboardConfigEditorialActivity.js:39-57 | editorial-dashboards | |
| AFF-dash-edact-no-access-reviewer | activity cell | `dashboard.noAccessBeingReviewer` → "You cannot access this submission as a Journal Manager since you are the reviewer. To view it, go to \"Review Assignments\"" (alert) | assigned as Reviewer AND NOT assigned as Manager/SubEditor/Assistant in any stage | short-circuits all other cell content | useDashboardConfigEditorialActivity.js:60-76 | editorial-dashboards | |
| AFF-dash-edact-declined-stage | activity cell | `dashboard.declinedDuringStage` → "Declined during the {$stageName} stage." (alert) | editorial dashboard | `submission.status === STATUS_DECLINED` | useDashboardConfigEditorialActivity.js:78-89 | editorial-decisions | |
| AFF-dash-edact-complete-submission | activity cell | `submission.list.completeSubmission` → "Complete submission" (action button → `openSubmissionWizard`) | editorial dashboard | `submission.submissionProgress` truthy (incomplete draft) | useDashboardConfigEditorialActivity.js:92-103 | submission-drafts | |
| AFF-dash-edact-assign-editor | activity cell | `submission.list.assignEditor` → "Assign Editor" (action button → ParticipantManager PARTICIPANT_ASSIGN) | editorial dashboard | Submission stage AND `!submission.editorAssigned` | useDashboardConfigEditorialActivity.js:105-118 | editorial-dashboards | |
| AFF-dash-edact-recommendation-made | activity cell | `editor.submission.roundStatus.recommendationMadeByYou` → "Recommendation has been made by you." (alert) | recommend-only editor (`activeStage.currentUserCanRecommendOnly`) | review stage AND `activeStage.currentUserRecommendation` set | useDashboardConfigEditorialActivity.js:152-166 | editorial-decisions | |
| AFF-dash-edact-assign-reviewers | activity cell | `dashboard.assignReviewers` → "Assign Reviewers" (action button → ReviewerManager REVIEWER_ADD_REVIEWER) | editorial dashboard | review stage AND round status PENDING_REVIEWERS (deciding editor sees PENDING_RECOMMENDATIONS instead per :139-148 remap) | useDashboardConfigEditorialActivity.js:199-214 | assign-and-manage-reviewers | |
| AFF-dash-edact-revision-requested | activity cell | `dashboard.revisionRequestedFromAuthor` → "Revisions requested from author" (alert) | editorial dashboard | review stage AND round status REVISIONS_REQUESTED | useDashboardConfigEditorialActivity.js:215-236 | review-rounds-and-revisions | |
| AFF-dash-edact-reviews-row | activity cell | DashboardCellSubmissionActivityReviews — per-reviewer activity indicator row (indicator content declared in useDashboardConfigReviewActivity.js) | editorial dashboard | review stage; pushed at round statuses REVISIONS_REQUESTED, REVISIONS_SUBMITTED, REVIEWS_COMPLETED, minimum-reviews-met, and the default review-stage fallback | useDashboardConfigEditorialActivity.js:226-235, 260-269, 350-359, 369-378, 380-393 | assign-and-manage-reviewers | |
| AFF-dash-edact-resubmit-new-round | activity cell | `dashboard.revisionsRequestedFromAuthorNextRound` → "Revisions requested from the author to be taken to a new review round" (alert) | editorial dashboard | review stage AND round status RESUBMIT_FOR_REVIEW | useDashboardConfigEditorialActivity.js:237-248 | review-rounds-and-revisions | |
| AFF-dash-edact-revisions-submitted | activity cell | `submission.list.revisionsSubmitted` → "Revisions submitted" (alert) | editorial dashboard | review stage AND round status REVISIONS_SUBMITTED (:253-259) or RESUBMIT_FOR_REVIEW_SUBMITTED (:311-317) | useDashboardConfigEditorialActivity.js:253-259, 311-317 | review-rounds-and-revisions | |
| AFF-dash-edact-pending-recommendations | activity cell | `dashboard.recommendOnly.pendingRecommendations` → "Recommending Editors are tasked to advise the next steps for this submission" (alert) | deciding editor (statuses remapped to PENDING_RECOMMENDATIONS at :139-148; recommend-only editors remapped away at :169-196) | review stage AND effective round status PENDING_RECOMMENDATIONS | useDashboardConfigEditorialActivity.js:271-282 | editorial-decisions | |
| AFF-dash-edact-recommendations-ready | activity cell | `dashboard.recommendOnly.recommendationsReady` → "An editorial recommendation has been received" (alert) | deciding editor (see remaps above) | review stage AND round status RECOMMENDATIONS_READY | useDashboardConfigEditorialActivity.js:283-294 | editorial-decisions | |
| AFF-dash-edact-recommendations-completed | activity cell | `dashboard.recommendOnly.recommendationsCompleted` → "All editorial recommendations have been received, and a decision is required." (alert) | deciding editor (see remaps above) | review stage AND round status RECOMMENDATIONS_COMPLETED | useDashboardConfigEditorialActivity.js:295-306 | editorial-decisions | |
| AFF-dash-edact-new-review-round | activity cell | `dashboard.newReviewRoundToBeCreated` → "New review round to be created" (alert; paired with revisions-submitted alert) | editorial dashboard | review stage AND round status RESUBMIT_FOR_REVIEW_SUBMITTED | useDashboardConfigEditorialActivity.js:318-323 | review-rounds-and-revisions | |
| AFF-dash-edact-declined-review-round | activity cell | `dashboard.declinedDuringStage` → "Declined during the {$stageName} stage." with stageName `manager.publication.reviewStage` → "Review" (alert) | editorial dashboard | review stage AND round status REVIEW_ROUND_STATUS_DECLINED | useDashboardConfigEditorialActivity.js:325-337 | editorial-decisions | |
| AFF-dash-edact-reviews-completed | activity cell | `editor.submission.roundStatus.reviewsCompleted` → "All reviews are confirmed and a decision is needed." (alert) | editorial dashboard | review stage AND round status REVIEWS_COMPLETED AND `!shouldMinimumReviewsBeConsidered` | useDashboardConfigEditorialActivity.js:338-360 | editorial-decisions | |
| AFF-dash-edact-minimum-reviews | activity cell | `dashboard.minimumReviewsConfirmedDecisionNeeded` → "Minimum required number of reviews have been confirmed. A decision is needed." (alert) | editorial dashboard | review stage AND `shouldMinimumReviewsBeConsidered && hasMinimumReviewsCount` (#10363, `contextMinReviewsPerSubmission`) | useDashboardConfigEditorialActivity.js:361-379 | editorial-decisions | |
| AFF-dash-edact-copyedited-files | activity cell | `dashboard.copyEditedFilesUploaded` → "Copyedited Files Uploaded: {$count}" (alert) | editorial dashboard | `activeStage.id === WORKFLOW_STAGE_ID_EDITING` | useDashboardConfigEditorialActivity.js:396-407 | copyediting-stage | |
| AFF-dash-edact-to-be-published | activity cell | `dashboard.toBePublishedInIssue` → "To be published in issue {$issue}" (alert) | editorial dashboard | Production stage AND `status === STATUS_SCHEDULED` AND `issueToBePublished.label` set | useDashboardConfigEditorialActivity.js:409-424 | production-stage | |

My Submissions view (`getEditorialActivityForMySubmissions`):

| Atom ID | Surface | Control (locale key → English) | Role gate | State/visibility gate | Source anchor | Hint | Claimed by |
|---|---|---|---|---|---|---|---|
| AFF-dash-myact-complete-submission | activity cell | `submission.list.completeSubmission` → "Complete submission" (action button → `openSubmissionWizard`) | author (My Submissions view) | `submission.submissionProgress` truthy | useDashboardConfigEditorialActivity.js:433-444 | submission-drafts | |
| AFF-dash-myact-submit-revisions | activity cell | `dashboard.revisionRequested` → "Revision requested" + action `dashboard.submitRevisions` → "Submit revisions" (FileManager FILE_UPLOAD; wizard title `editor.submissionReview.uploadFile` → "Upload Review File") | author | review stage AND round status REVISIONS_REQUESTED or RESUBMIT_FOR_REVIEW; internal-review fileStage leg (`SUBMISSION_FILE_INTERNAL_REVIEW_REVISION`, :459-461) is OMP-only — in OJS always `SUBMISSION_FILE_REVIEW_REVISION` | useDashboardConfigEditorialActivity.js:446-477 | review-rounds-and-revisions | |
| AFF-dash-myact-reviews-update | activity cell | DashboardCellSubmissionActivityReviewsUpdate (author-facing review progress summary; content internal to component) | author | review stage, round status not in the revisions-requested pair | useDashboardConfigEditorialActivity.js:485-490 | author-dashboard | |
| AFF-dash-myact-reviews-open | activity cell | DashboardCellSubmissionActivityReviewsOpen (author-facing open-review listing; content internal to component) | author | review stage, round status not in the revisions-requested pair | useDashboardConfigEditorialActivity.js:491-496 | author-dashboard | |
| AFF-dash-myact-copyedited-files | activity cell | `dashboard.copyEditedFilesUploaded` → "Copyedited Files Uploaded: {$count}" (alert) | author | `activeStage.id === WORKFLOW_STAGE_ID_EDITING` | useDashboardConfigEditorialActivity.js:501-512 | author-dashboard | |
| AFF-dash-myact-to-be-published | activity cell | `dashboard.toBePublishedInIssue` → "To be published in issue {$issue}" (alert) | author | Production stage AND `status === STATUS_SCHEDULED` AND `issueToBePublished.label` set | useDashboardConfigEditorialActivity.js:514-529 | author-dashboard | |

My Review Assignments view (`getEditorialActivityForMyReviewAssignments`):

| Atom ID | Surface | Control (locale key → English) | Role gate | State/visibility gate | Source anchor | Hint | Claimed by |
|---|---|---|---|---|---|---|---|
| AFF-dash-raact-declined | activity cell | `dashboard.reviewAssignment.declined` → "Request declined on {$date}" (alert) | reviewer (My Review Assignments view) | `reviewAssignment.status === REVIEW_ASSIGNMENT_STATUS_DECLINED` (checked first, any stage) | useDashboardConfigEditorialActivity.js:536-552 | reviewer-response | |
| AFF-dash-raact-incomplete | activity cell | `submissions.incomplete` → "Incomplete" (alert) | reviewer | submission moved to Editing/Production stage AND assignment status not in CompletedReviewAssignmentStatuses | useDashboardConfigEditorialActivity.js:554-573 | reviewer-response | |
| AFF-dash-raact-accept-decline-by | activity cell | `dashboard.reviewAssignment.acceptOrDeclineRequestDate` → "Please accept or decline this request by {$date}" (alert) | reviewer | status AWAITING_RESPONSE or REQUEST_RESEND | useDashboardConfigEditorialActivity.js:575-592 | reviewer-response | |
| AFF-dash-raact-response-overdue | activity cell | `dashboard.reviewAssignment.deadlineForRespondingAcceptOrDecline` → "Deadline for responding to this request has passed. Please accept or decline this request at the earliest." (alert) | reviewer | status RESPONSE_OVERDUE | useDashboardConfigEditorialActivity.js:593-607 | reviewer-response | |
| AFF-dash-raact-complete-by | activity cell | `dashboard.reviewAssignment.completeReviewByDate` → "Please complete this review by {$date}." (alert) | reviewer | status ACCEPTED | useDashboardConfigEditorialActivity.js:608-623 | reviewer-response | |
| AFF-dash-raact-review-overdue | activity cell | `dashboard.reviewAssignment.deadlineForCompletingReviewHasPassed` → "Deadline for completing this review has passed. Please complete the review at the earliest." (alert) | reviewer | status REVIEW_OVERDUE | useDashboardConfigEditorialActivity.js:624-638 | reviewer-response | |
| AFF-dash-raact-review-submitted | activity cell | `dashboard.reviewAssignment.reviewSubmitted` → "Review submitted on {$date}" (alert) | reviewer | status in CompletedReviewAssignmentStatuses | useDashboardConfigEditorialActivity.js:639-652 | reviewer-response | |
| AFF-dash-raact-cancelled-placeholder | activity cell | literal `-` (no locale key; alert placeholder) | reviewer | **declared-unreachable here** — code comment states cancelled review assignments are filtered out of this view; branch kept "just for documentation" | useDashboardConfigEditorialActivity.js:653-665 | reviewer-response | |

### useDashboardConfigReviewActivity.js — review activity indicator + popover

Consumed by the editorial dashboard reviews cell (`DashboardCellSubmissionActivityReviewsItem`, via `dashboardPageStore`). One atom for the indicator control, one per distinct declared action button (slot occupancy in the gate column), and one per per-status popover card (`ConfigPerStatus`). Popover buttons dispatch through `ActionsMapping` (:17-32) to ReviewerManager actions. `descriptionWithoutRecommendationKey` (:164-166, 185-187) is the no-recommendation fallback (`recommendations === undefined` in OMP/OPS) — reachable in OJS too when a review carries no recommendation.

| Atom ID | Surface | Control (locale key → English) | Role gate | State/visibility gate | Source anchor | Hint | Claimed by |
|---|---|---|---|---|---|---|---|
| AFF-dash-ract-indicator | reviews cell, per reviewer | ReviewActivityIndicator button — days-remaining/progress or status icon; srLabel = status title; opens popover | editorial dashboard (via reviews cell) | per-status `reviewActivityIndicator` variant; progress ring only when `displayVariant === 'progress'`; day count shown only when no icon | useDashboardConfigReviewActivity.js:301-330 | assign-and-manage-reviewers | |
| AFF-dash-ract-action-resend | indicator popover button | `dashboard.reviewAssignment.action.resendReviewRequest` → "Resend Review Request" (→ REVIEWER_RESEND_REQUEST) | editorial dashboard | text slot of statuses DECLINED, CANCELLED | useDashboardConfigReviewActivity.js:35-37, 18-19 | assign-and-manage-reviewers | |
| AFF-dash-ract-action-edit-due-date | indicator popover button | `dashboard.reviewAssignment.action.editDueDate` → "Edit Due Date" (→ REVIEWER_EDIT_REVIEW) | editorial dashboard | text slot of statuses AWAITING_RESPONSE, RESPONSE_OVERDUE, ACCEPTED, REVIEW_OVERDUE, REQUEST_RESEND | useDashboardConfigReviewActivity.js:38-40, 20-21 | assign-and-manage-reviewers | |
| AFF-dash-ract-action-view-details | indicator popover button | `dashboard.reviewAssignment.action.viewDetails` → "View details" (→ REVIEWER_REVIEW_DETAILS) | editorial dashboard | primary slot of statuses AWAITING_RESPONSE, DECLINED, RESPONSE_OVERDUE, ACCEPTED, REVIEW_OVERDUE, CANCELLED, REQUEST_RESEND | useDashboardConfigReviewActivity.js:41-43, 22-23 | assign-and-manage-reviewers | |
| AFF-dash-ract-action-cancel-reviewer | indicator popover button | `dashboard.reviewAssignment.action.cancelReviewer` → "Cancel Reviewer" (→ REVIEWER_CANCEL_REVIEWER) | editorial dashboard | negative slot of statuses DECLINED, ACCEPTED, REVIEW_OVERDUE | useDashboardConfigReviewActivity.js:44-46, 24-25 | assign-and-manage-reviewers | |
| AFF-dash-ract-action-unassign | indicator popover button | `dashboard.reviewAssignment.action.unassignReviewer` → "Unassign" (→ REVIEWER_UNASSIGN_REVIEWER) | editorial dashboard | negative slot of statuses AWAITING_RESPONSE, RESPONSE_OVERDUE, REQUEST_RESEND | useDashboardConfigReviewActivity.js:47-49, 26-27 | assign-and-manage-reviewers | |
| AFF-dash-ract-action-view-recommendation | indicator popover button | `dashboard.reviewAssignment.action.viewRecommendation` → "View recommendation" (→ REVIEWER_REVIEW_DETAILS) | editorial dashboard | primary slot of statuses VIEWED, COMPLETE, THANKED | useDashboardConfigReviewActivity.js:50-52, 28-29 | assign-and-manage-reviewers | |
| AFF-dash-ract-action-view-unread | indicator popover button | `dashboard.reviewAssignment.action.viewUnreadRecommendation` → "View unread recommendation" (→ REVIEWER_REVIEW_DETAILS) | editorial dashboard | primary slot of status RECEIVED only | useDashboardConfigReviewActivity.js:53-55, 30-31 | assign-and-manage-reviewers | |
| AFF-dash-ract-status-awaiting | indicator popover card | `dashboard.reviewAssignment.statusAwaitingResponse.title` → "Awaiting Response from the reviewer"; buttons: Edit Due Date / View details / Unassign | editorial dashboard | statusId AWAITING_RESPONSE; date shown `dateResponseDue` | useDashboardConfigReviewActivity.js:60-77 | assign-and-manage-reviewers | |
| AFF-dash-ract-status-declined | indicator popover card | `dashboard.reviewAssignment.statusDeclined.title` → "Review Request declined on {$date}"; buttons: Resend Review Request / View details / Cancel Reviewer | editorial dashboard | statusId DECLINED; date shown `dateConfirmed` | useDashboardConfigReviewActivity.js:79-95 | assign-and-manage-reviewers | |
| AFF-dash-ract-status-response-overdue | indicator popover card | `dashboard.reviewAssignment.statusResponseOverdue.title` → "Review Request overdue by {$days} days"; buttons: Edit Due Date / View details / Unassign | editorial dashboard | statusId RESPONSE_OVERDUE; date shown `dateResponseDue` | useDashboardConfigReviewActivity.js:97-114 | assign-and-manage-reviewers | |
| AFF-dash-ract-status-accepted | indicator popover card | `dashboard.reviewAssignment.statusAccepted.title` → "Ongoing review - request accepted"; buttons: Edit Due Date / View details / Cancel Reviewer | editorial dashboard | statusId ACCEPTED; date shown `dateDue` | useDashboardConfigReviewActivity.js:116-131 | assign-and-manage-reviewers | |
| AFF-dash-ract-status-review-overdue | indicator popover card | `dashboard.reviewAssignment.statusReviewOverdue.title` → "Review overdue by {$days} days"; buttons: Edit Due Date / View details / Cancel Reviewer | editorial dashboard | statusId REVIEW_OVERDUE; date shown `dateDue` | useDashboardConfigReviewActivity.js:133-150 | assign-and-manage-reviewers | |
| AFF-dash-ract-status-received | indicator popover card | `dashboard.reviewAssignment.statusReceived.title` → "Review completed on {$date}"; button: View unread recommendation (no text/negative) | editorial dashboard | statusId RECEIVED; date shown `dateCompleted`; description falls back to `withoutRecommendation` variant when no recommendation | useDashboardConfigReviewActivity.js:152-171 | assign-and-manage-reviewers | |
| AFF-dash-ract-status-viewed | indicator popover card | `dashboard.reviewAssignment.statusReceived.title` → "Review completed on {$date}" (shared with RECEIVED); button: View recommendation | editorial dashboard | statusId VIEWED; date shown `dateCompleted` | useDashboardConfigReviewActivity.js:173-192 | assign-and-manage-reviewers | |
| AFF-dash-ract-status-complete | indicator popover card | `dashboard.reviewAssignment.statusComplete.title` → "Review was confirmed by editor"; button: View recommendation | editorial dashboard | statusId COMPLETE; date shown `dateConsidered` | useDashboardConfigReviewActivity.js:195-212 | assign-and-manage-reviewers | |
| AFF-dash-ract-status-thanked | indicator popover card | `dashboard.reviewAssignment.statusComplete.title` → "Review was confirmed by editor" (shared with COMPLETE); button: View recommendation | editorial dashboard | statusId THANKED; date shown `dateConsidered` | useDashboardConfigReviewActivity.js:215-231 | assign-and-manage-reviewers | |
| AFF-dash-ract-status-cancelled | indicator popover card | `dashboard.reviewAssignment.statusCancelled.title` → "Reviewer cancelled review request"; buttons: Resend Review Request / View details | editorial dashboard | statusId CANCELLED; date shown `dateCancelled` (reaches the cell — `getCurrentReviewAssignments` does not filter cancelled) | useDashboardConfigReviewActivity.js:234-252 | assign-and-manage-reviewers | |
| AFF-dash-ract-status-request-resend | indicator popover card | `dashboard.reviewAssignment.statusRequestResend.title` → "Awaiting Response from the reviewer"; buttons: Edit Due Date / View details / Unassign | editorial dashboard | statusId REQUEST_RESEND; date shown `dateResponseDue` | useDashboardConfigReviewActivity.js:254-271 | assign-and-manage-reviewers | |

### useDashboardBulkDelete.js — bulk delete of incomplete submissions

Declares the selection mode, the per-row deletability rule, the availability gate consumed by the top-bar buttons (atoms AFF-dash-ctl-bulk-actions / AFF-dash-ctl-bulk-delete-btn above), and the confirmation dialog. Deletion calls `DELETE _submissions?ids=...`.

| Atom ID | Surface | Control (locale key → English) | Role gate | State/visibility gate | Source anchor | Hint | Claimed by |
|---|---|---|---|---|---|---|---|
| AFF-dash-bulk-row-select | submissions table rows | row selection checkbox mode (`bulkDeleteSelectionEnabled`; select/deselect per submission id) | availability: editorial dashboard → SiteAdmin/Manager; My Submissions → any; per row: `submissionProgress` truthy AND (SiteAdmin/Manager or assigned Author) | selection mode toggled on via the bulk-delete buttons; only ids in `bulkDeleteSubmissionIdsCanBeDeleted` selectable | useDashboardBulkDelete.js:20-43, 53-69, 71-96 | submission-drafts | |
| AFF-dash-bulk-delete-dialog | modal dialog | `dashboard.submissions.incomplete.bulkDelete.confirm` → "Confirm Delete of Incomplete Submissions"; body `dashboard.submissions.incomplete.bulkDelete.body` → "Are you sure you want to delete the selected items? This action cannot be undone. Please confirm to proceed." (negative style) | as row-select availability | opened by `bulkDeleteActionDelete` with a non-empty selection | useDashboardBulkDelete.js:116-142 | submission-drafts | |
| AFF-dash-bulk-delete-confirm | dialog action | `common.confirm` → "Confirm" (primary; DELETE `_submissions` for selected ids, then reset + refresh callback) | as row-select availability | dialog open | useDashboardBulkDelete.js:122-129, 98-109 | submission-drafts | |
| AFF-dash-bulk-delete-cancel | dialog action | `common.cancel` → "Cancel" (warnable; resets selection and closes) | as row-select availability | dialog open | useDashboardBulkDelete.js:131-137 | submission-drafts | |

<!-- section-count: 76 atoms, 1 declared-unreachable -->
