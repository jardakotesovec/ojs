---
name: workflow-stage-navigation
scope: The workflow-page shell an editorial user gets when they open a submission — the side modal over the dashboard, the stage/publication menu with round sub-items and status bubble, which pane opens by default per submission state, who may open which stage, deep-link routing (workflowMenuKey), and the legacy workflow/* URL shims
shared: pkp-lib          # shell + policies in lib/pkp / lib/ui-library; OJS overrides WorkflowPageOJS (manager wiring, menu config) and pages/workflow/WorkflowHandler.php (role list)
status: verified
e2e-plans: [editorial-dashboards.md, submission-stage-actions.md]
atlas-claims:
  - PAGE-workflow-access
  - PAGE-workflow-index
  - PAGE-workflow-submission
  - PAGE-workflow-externalreview
  - PAGE-workflow-editorial
  - PAGE-workflow-production
  - VUE-workflow-page
  - VUE-workflow-page-ojs
  - AUTHZ-workflow-stage-access-policy
  - AUTHZ-user-accessible-workflow-stage-policy
  - AUTHZ-user-accessible-workflow-stage-required-policy
  - AUTHZ-workflow-stage-required-policy
---

# Workflow stage navigation (the workflow-page shell)

## Purpose

When an editor clicks **View** on a dashboard row (or follows a shared link), the
submission opens in a **side modal over the dashboard** — the workflow page. This spec
owns that shell: the header (submission ID, authors, title, the coloured stage bubble,
the header action buttons), the **left menu** — a *Workflow* group with one item per
stage (Submission, Review with one sub-item per round, Copyediting, Production) and a
*Publication* group with one submenu per version — the rule for **which pane opens
first** per submission state, the **stage-access matrix** (who may open which stage,
and the "You don't currently have access to that stage of the workflow." message when
they may not), the **URL routing** (`workflowSubmissionId` + `workflowMenuKey` make any
pane shareable), and the **legacy `workflow/*` URLs** that now redirect into the
dashboard. What renders *inside* each pane — files, reviewers, decisions, publication
forms — belongs to the stage/publication specs; the decision action bar is documented
once in `editorial-decisions`. The author's read-mostly composition of this same shell
is owned by `author-dashboard`.

## Actors & permissions

Baseline: everything requires login in a journal context (anonymous hits on the legacy
URLs bounce to login with a return link — live-probed). **"Manager scope"** = journal
managers and site admins *without* a stage assignment on the submission — they get every
stage (rule 5). **"Assigned scope"** = anyone holding a stage assignment: their access
is the union of the *stage lists configured on the user groups they are assigned with*
(e.g. the default Copyeditor group covers only Copyediting). Authors and reviewers never
get the editorial shell — authors have their own variant (`author-dashboard`), reviewers
have the reviewer page (`reviewer-response`). Live probes 2026-07-03 on `publicknowledge`
with seeded submissions 538–546 (tag `wsnav2`): dbarnes (manager-level editor, unassigned),
dbuskins (assigned section editor), minoue (unassigned section editor), mfritz (assistant
assigned as Copyeditor), jjanssen (reviewer), atester (author); adversarial re-probe
2026-07-03 re-drove the matrix and added scratch-journal probes (tag `wsnavv2`:
enrolment revocation, manager-as-reviewer, payments/pub-id gating, notification
click-through). <sup>a</sup>

| Action | Who may — and when |
|--------|--------------------|
| **Open a submission's workflow modal** | • Manager scope — any submission in the journal, including incomplete drafts (⚠ drafts open via URL only — Known deviations)<br>• Assigned scope — only submissions they hold a stage assignment on (live-probed: mfritz/dbuskins open their seeds; mfritz deep-linking an unassigned one gets an empty shell + an error dialog "The current role does not have access to this operation.")<br>• Unassigned section editors — refused the same way (live-probed: minoue, empty shell + the same error dialog)<br>• Authors and reviewers — never reach this modal: the editorial dashboard itself bounces them to the full-page authorizationDenied (same sentence, different surface — live-probed: atester, jjanssen); their own dashboards serve the author/reviewer compositions instead. A reviewer deep-linking on their own dashboard gets a stub shell with every stage denied (Open question 2) <sup>b</sup> |
| **Open a stage pane** | • Users whose stage access (matrix, rule 5) covers that stage — the pane's panels render<br>• Everyone else who can open the modal — the pane shows only "You don't currently have access to that stage of the workflow." (live-probed: mfritz on Submission/Review/Production; all stage items stay visible and clickable) <sup>c</sup> |
| **See the Publication menu group** | • Editor Dashboard users assigned in an editorial role on the *current* stage (and manager scope) — per-version submenus; items Body Text → Publication Settings additionally require production-stage access (live-probed: mfritz sees a trimmed list; on a production-stage submission his group is empty)<br>• Authors — their own item set on My Submissions (owned by `author-dashboard`); reviewers — never <sup>d</sup> |
| **Use Create New Version / Publish controls** | • Managers and site admins only (publish authority owned by `publication-versioning`; live-probed: menu action absent for dbuskins and mfritz, present for dbarnes) <sup>e</sup> |
| **See header buttons** | • Activity Log — manager scope + managers/section editors assigned on the current stage (absent for mfritz; present for dbarnes/dbuskins — live-probed)<br>• Library — everyone who can open the modal<br>• View (published) / Preview (copyediting & production, unpublished) — anyone who can open the modal, by submission state<br>• Payments dropdown — everyone who can open the modal, but only when publication payments are fully configured: payments enabled + a configured payment method + a non-zero publication fee (`OJSPaymentManager::publicationEnabled()`; live-probed on a scratch journal — absent until all three were set, then present for manager and assigned section editor alike; `payments-fees` owns the dropdown) <sup>f</sup> |
| **Use the legacy `workflow/*` URLs** | • Site admins, managers, section editors, assistants — with stage access: `access` needs *some* accessible stage; every other op (`index/{id}/{stageId}` and the stage paths `submission`/`externalReview`/`editorial`/`production`) needs access to *that specific* stage; all redirect into the dashboard modal (live-probed: mfritz allowed `editorial/540` and `index/540/4`, refused `submission/540` and `index/540/1` with "You don't currently have access to that stage of the workflow.")<br>• Authors and reviewers — always refused, even on their own submissions (live-probed: atester, jjanssen)<br>• Anonymous — redirected to login and back <sup>g</sup> |

<sup>a</sup> WorkflowHandler::__construct() (role list); Repository::getAccessibleWorkflowStages(); registry/userGroups.xml (per-group `stages`); live probes 2026-07-03 ·
<sup>b</sup> dashboardPageStore.openWorkflowModal(); PKPSubmissionController GET `submissions/{id}` → SubmissionAccessPolicy (401 → error dialog); live probes 2026-07-03 ·
<sup>c</sup> workflowConfigEditorialOJS WorkflowConfig.common getPrimaryItems/getSecondaryItems/getActionItems (`permissions.accessibleStages` guard → `user.authorization.accessibleWorkflowStage`); live probes 2026-07-03 ·
<sup>d</sup> useWorkflowNavigationConfigOJS getPublicationVersionItems()/getPublicationItemsEditorial() (`canAccessPublication`, `canAccessProduction`); useWorkflowPermissions; live probes 2026-07-03 ·
<sup>e</sup> useWorkflowPermissions (`canPublish`); useWorkflowNavigationConfigOJS (`publication_create_new_version`); live probes 2026-07-03 ·
<sup>f</sup> workflowConfigEditorialOJS getHeaderItems(); useWorkflowPermissions (`canAccessEditorialHistory`); live probes 2026-07-03 ·
<sup>g</sup> PKPWorkflowHandler::authorize() (per-op policy split); UserAccessibleWorkflowStageRequiredPolicy / UserAccessibleWorkflowStagePolicy; live probes 2026-07-03

## Fields & validation

N/A — the shell has no data-entry fields of its own; every form inside the panes
belongs to its owning spec.

## Rules & state

1. **One shell, per-dashboard configuration.** The workflow page is a Vue side modal
   (`WorkflowPage`) mounted over the dashboard when `workflowSubmissionId` is in the
   URL; OJS registers its own wrapper (`WorkflowPageOJS`) under the same component name,
   wiring the OJS manager panels and the OJS menu/pane configs into the generic shell.
   Which configuration renders follows the *dashboard*, not the user's roles: the Editor
   Dashboard gets the editorial config; My Submissions **and** the reviewer dashboard
   get the author config (a reviewer deep-linking is thus served the author-shaped
   shell — Open question 2). Opening/closing and the list round-trip are owned by
   `editorial-dashboards` (its rule 10); the submission and selected version are fetched
   live (`submissions/{id}`, `…/publications/{id}`), and every mutation inside a pane
   triggers a refetch of both. <sup>a</sup>
2. **The header identifies the submission and its state.** Pre-title = submission ID;
   title = the authors short string; description = the full title; below them a
   coloured **stage bubble** shows the effective state label — the same
   Incomplete / Submission / Review (Round N) / Copyediting / Production / Scheduled /
   Published / Declined labelling as the dashboard's Stage column (owned by
   `editorial-dashboards` rule 7), each state with its own bubble colour (live-probed:
   Review (Round 2), Scheduled, Published, Declined, Incomplete). Header buttons per the
   permissions table; Return-to-Workflow / Return-to-Done appear here only when that
   decision is available (owned by `editorial-decisions`). <sup>b</sup>
3. **The menu is fixed-shape; state only decorates it.** The *Workflow* group always
   lists the four OJS stages in order — Submission, Review, Copyediting, Production —
   regardless of the viewer's access or the submission's state; the Review item nests
   one sub-item per review round ("Review Round N", oldest first) and the round list
   grows as rounds are created (live-probed by the verifier: recording a New Review
   Round decision added "Review Round 2" and moved the default selection to the new
   round's key). The **current** stage item (and current round sub-item)
   carries a stage-coloured stripe; other items are plain (live-probed on 539: stripe on
   Review + Review Round 2 only, class `border-stage-in-review`). The Review *parent* is
   itself selectable and shows a stage-level (round-less) pane. The *Publication* group renders one collapsible
   submenu per version (labelled with the version string) plus **Create New Version**
   for users with publish authority; its item set per the permissions table —
   Title & Abstract, Contributors, Metadata, References (journal supports citations),
   Data (data citations/availability enabled), Identifiers (pub-id plugin enabled),
   JATS XML, then production-gated: Body Text, Galleys, Media, Permissions & Disclosure,
   Publication Settings (live-probed: full set for dbarnes/dbuskins, trimmed after JATS
   XML for mfritz). Tab *content* is owned by the Area-3 publication specs. <sup>c</sup>
4. **An inaccessible stage shows one sentence and nothing else.** Selecting a stage
   outside the viewer's stage access renders only "You don't currently have access to
   that stage of the workflow." in the pane — no panels, no action buttons, no
   secondary column — while the URL still records the selection (live-probed: mfritz,
   `workflowMenuKey=workflow_1`/`workflow_3`/`workflow_5`). Publication tabs have no
   such per-tab guard; their gate is menu membership (rule 3). <sup>d</sup>
5. **The stage-access matrix.** A user's accessible stages on a submission are computed
   from the same inputs client- and server-side:
   - Union, over their stage assignments on this submission, of the **stage lists
     configured on the assigned user groups** (Settings → Users & Roles; defaults:
     Journal editor & Section editor 1,3,4,5; Copyeditor 4; Layout editor & Proofreader
     5; Author 1,3,4,5) — the assignment's role only counts while the user still holds a
     **live enrolment** (verifier-probed: revoking a Copyeditor's enrolment left their
     assigned stage-4 pane showing only the no-access sentence while the shell still
     opened). ⚠ The two sides check revocation at different granularity — the shell
     requires enrolment in the assignment's *exact group*, the legacy/API doors only in
     any group with the same *role* — so a partially-revoked user can pass the legacy
     door into a modal that denies every pane (Known deviations; e2e ledger §2 row 72).
   - If that union is **empty** and the user is a journal manager or site admin, they
     fall back to **all stages** — so an *unassigned* manager sees everything, while a
     manager assigned only as (say) Copyeditor is confined to that group's stages.
   - Client-side only: a manager who is an **active reviewer** of the submission
     (assignment not declined/cancelled) is denied the fallback — the shell treats them
     as unassigned: every pane shows the no-access sentence, the Publication group is
     empty and Activity Log disappears, while the *server* fallback stays intact (the
     legacy URLs still 302 them in; verifier-probed both halves on a scratch journal
     with a manager as accepted reviewer, plus a no-reviewer control). The modal-side
     twin of the dashboard COI guard, e2e ledger §2 row 69's family.
   Editorial access additionally requires an editorial role somewhere in the result —
   author-only assignments satisfy the *author* workflow (author-dashboard), never the
   editorial one (live-probed: atester refused everywhere). Live-probed both sides:
   mfritz per-stage panes and legacy per-stage URLs agree (stage 4 yes, 1/3/5 no).
   <sup>e</sup>
6. **The default pane follows the submission state.** When the modal opens without a
   (valid) `workflowMenuKey`, it selects: in Review → the **current round**; in
   Production while scheduled or published → **Publication → Title & Abstract**; Done
   (workflow ended) → Publication → Title & Abstract if published, else Production;
   any other state → the current stage. Live-probed matrix (dbarnes): submission-stage
   538 → `workflow_1`; copyediting 540 → `workflow_4`; production-queued 541 →
   `workflow_5`; review-round-2 539 → `workflow_3_116` (current round); declined-in-
   review 544 → `workflow_3_117` with the Declined bubble; scheduled 546 and published
   542 → `publication_{id}_titleAbstract`; incomplete draft 545 → `workflow_1` with the
   Incomplete bubble (⚠ Known deviations). The Done-but-not-published branch behaves as
   written (verifier-probed by forcing stage Done + status queued on a scratch row →
   `workflow_5`), but the state is normally self-healing: unpublishing the last
   published Version of Record auto-returns the submission to its prior stage
   (`ApplyDoneWorkflowStage` listener), so the branch is defensive rather than part of
   a normal flow (`publication-versioning` owns those flows). The "latest" publication
   is what the publication default targets (`getLatestPublication`). <sup>f</sup>
7. **`workflowMenuKey` is the pane address, and the URL always tracks it.** Key grammar:
   `workflow_{stageId}` (stage pane; stages 1, 3, 4, 5), `workflow_{stageId}_{reviewRoundId}`
   (a round), `publication_{publicationId}_{tabName}` (a version tab). Every menu click
   rewrites the key in the query string (live-probed round-trip: Review Round 1 →
   `workflow_3_115`, Title & Abstract → `publication_539_titleAbstract`), so copying the
   URL reproduces submission + pane. On open, a key that exists in *this viewer's* menu
   is honoured (even when it only yields the no-access message — rule 4); an unknown key
   falls back to the state default and the URL is rewritten (live-probed:
   `workflowMenuKey=bogus_key_zz` → `workflow_3_116`). Closing the modal strips both
   params (`editorial-dashboards` rule 10). <sup>g</sup>
8. **The legacy `workflow/*` URLs are pure redirect shims.** All six ops —
   `workflow/access/{id}`, `workflow/index/{id}/{stageId}`, and the four stage paths
   `workflow/submission|externalReview|editorial|production/{id}` — issue a redirect to
   `dashboard/editorial?workflowSubmissionId={id}` (live-probed each, dbarnes + mfritz;
   `access` also accepts `?submissionId={id}`). Authorization is enforced **before**
   redirecting, per the permissions table; the per-stage ops also require a *complete*
   submission (live-probed: `workflow/index/{draftId}/1` → "…workflowAccessRestrict"
   denial), while `access` has no completeness check and 302s a draft straight into
   the modal (live-probed; feeds ⚠ Known deviations). An unknown submission is a
   404. Two quirks: the
   **stage named in the URL is dropped** — the modal opens on the state default, so an
   old link to a non-current stage lands elsewhere (live-probed:
   `workflow/submission/539` → review round 2; Open question 3) — and ⚠ the stage-less
   form `workflow/index/{id}` crashes with HTTP 500 (Known deviations). The shims are
   **still load-bearing**, on two surfaces: **in-app**, the header Tasks panel's
   editor-assignment-required entry ("A new article has been submitted to which an
   editor needs to be assigned", task-level) resolves to `workflow/submission/{id}`
   (verifier-probed end-to-end: seeded a no-editor submission, clicked the manager's
   task → mark-read redirect answered the legacy URL → shim chain → modal); **in
   notification emails**, submission-submitted and editor-assignment-required link
   `workflow/submission/{id}`, a new-version notification links
   `workflow/production/{id}`, and a reviewer-comment notification links
   `workflow/externalReview/{id}` — these three are normal-level notifications with no
   in-app surface, so their links travel only by email. Other notification types (new
   discussion, pending revisions) already link the dashboard URL directly
   (`getWorkflowUrlByUserRoles`). <sup>h</sup>
9. **The OJS/pkp-lib split, and a dead rendering path.** lib/pkp owns the shell
   (`WorkflowPage`, the menu/permission composables, `PKPWorkflowHandler` with the
   redirect ops and policies); OJS contributes `WorkflowPageOJS` (registered as
   `WorkflowPage`), the OJS menu/pane configs, and `WorkflowHandler` (role list; OJS has
   no internal-review stage, so `externalReview` is the only review path). The OJS
   handler still carries a full template-state builder — `WorkflowHandler::setupIndex()`
   (issue-entry form, JATS panel, payments form, word limits) — but nothing invokes it
   since `index` became a redirect: the modal gets those forms from the dashboard's
   page config and the `_components/*` API instead. Recorded as a dead-code candidate
   (`UNASSIGNED.md`). <sup>i</sup>

<sup>a</sup> js/load.js (`VueRegistry.registerComponent('WorkflowPage', WorkflowPageOJS)`); WorkflowPageOJS.vue (Components map, config imports); useWorkflowConfigOJS() (dashboardPage switch: EDITORIAL_DASHBOARD → ConfigEditorialOJS, else ConfigAuthorOJS); dashboardPageStore.openWorkflowModal(); useWorkflowDataSubmissionPublication(); useDataChangedProvider; live probes 2026-07-03 ·
<sup>b</sup> WorkflowPage.vue (pre-title/title/description/post-description slots); StageBubble.vue (ExtendedStagesColorClass); useSubmission.getExtendedStage()/getExtendedStageLabel(); workflowConfigEditorialOJS getHeaderItems(); live probes 2026-07-03 ·
<sup>c</sup> useWorkflowNavigationConfigOJS getMenuItems()/getWorkflowItems()/getReviewItems() (`workflow.reviewRoundN`, StageColors stripe on `isActive`); getPublicationVersionItems()/getPublicationItemsEditorial(); useWorkflowMenu (SideMenu wiring); live probes 2026-07-03 ·
<sup>d</sup> workflowConfigEditorialOJS WorkflowConfig.common (accessibleStages guard, `shouldContinue: false`); locale `user.authorization.accessibleWorkflowStage`; live probes 2026-07-03 ·
<sup>e</sup> Repository::getAccessibleWorkflowStages() (assignment × userGroupStages; revoked-**role** guard `in_array($roleId, $userRoleIds)`; manager/admin fallback, no reviewer suppression); maps/Schema.php getPropertyStages()/getAssignmentRoles() (`currentUserAssignedRoles`; revoked-**group** guard via live `userUserGroups` date window; reviewer suppression of the global fallback); useWorkflowPermissions (`accessibleStages`); registry/userGroups.xml; PKPApplication::getWorkflowTypeRoles(); live probes 2026-07-03 (author) + verifier scratch-journal probes 2026-07-03 (revocation surgery, manager-as-reviewer) ·
<sup>f</sup> useWorkflowNavigationConfigOJS getInitialSelectionItemKey(); useWorkflowMenu (submission watcher: URL key → else default); live probes 2026-07-03 (538/539/540/541/542/544/545/546) ·
<sup>g</sup> useWorkflowMenu (selectedMenuKey watcher → `queryParamsUrl.workflowMenuKey`; `doesKeyExist` check); getWorkflowItem()/getReviewItem()/getPublicationItem() (key grammar); live probes 2026-07-03 ·
<sup>h</sup> PKPWorkflowHandler::access()/index()/_redirectToIndex(); PKPWorkflowHandler::authorize() (`access` → SubmissionRequiredPolicy + UserAccessibleWorkflowStageRequiredPolicy; others → SubmissionCompletePolicy + WorkflowStageAccessPolicy(identifyStageId)); identifyStageId() (`$args[1]` — the 500); WorkflowStageDAO::getIdFromPath(); SubmissionNotificationManager::getNotificationUrl() + PKPNotificationManager::getNotificationUrl() (NOTIFICATION_TYPE_REVIEWER_COMMENT branch) — live URL generators; AssignEditors listener (creates EDITOR_ASSIGNMENT_REQUIRED at NOTIFICATION_LEVEL_TASK); NotificationsGridHandler::markRead() (`redirect=1` → `redirectRequested` with getNotificationUrl); PKPNotificationOperationManager::sendNotificationEmail() (`notificationUrl` in the mail template — the email surface for normal-level types); live probes 2026-07-03 ·
<sup>i</sup> pages/workflow/index.php (op switch); WorkflowHandler::__construct(); WorkflowHandler::setupIndex() (uncalled — no `setupIndex` caller outside PKPDashboardHandler's own); SubmissionController `_components/issue` route; live probe: modal renders publication forms without any workflow-page render

## Side effects

None. The shell is a read surface: opening the modal, switching panes, following deep
links and the legacy redirects send no emails, raise no notifications, write no
event-log entries and queue no jobs. Mutations live inside the panes and belong to
their owning specs; the shell's only job afterwards is refetching the submission and
publication (rule 1). <sup>a</sup>

<sup>a</sup> workflowStore.js (fetch/refetch + triggerDataChange only); PKPWorkflowHandler (redirects only)

## Settings that modify behavior

- **User group stage configuration** (Settings → Users & Roles → edit role → stages):
  the entire assigned-scope matrix (rule 5) — changing a group's stages changes what
  every assignee of that group can open.
- **Payments: publication fee** — the header Payments dropdown appears only once
  payments are enabled *and* a payment method is configured *and* the publication fee
  is non-zero (`OJSPaymentManager::publicationEnabled()`; live-probed on a scratch
  journal; `payments-fees`).
- **Citations / Data citations / Data availability** (Settings → Workflow) — add the
  References and Data menu items; **a pub-id plugin enabled for publications** (e.g.
  URN with "publication URNs" checked) — adds Identifiers (live-probed: scratch journal
  with the URN plugin's `enablePublicationURN` on). DOI registration alone does not (it
  has its own pages; `publicknowledge` has DOIs on and shows no Identifiers item).
- No setting alters the four-stage Workflow group, the default-pane rules or the legacy
  shims. <sup>a</sup>

<sup>a</sup> DashboardHandler::setupIndex() (`submissionPaymentsEnabled`); PKPDashboardHandler::index() (`publicationSettings`: supportsCitations/DataCitations/DataAvailability, `identifiersEnabled` from pubIds plugins); useWorkflowNavigationConfigOJS

## Cross-feature interactions

- **editorial-dashboards** — owns the dashboard under the modal, the row → modal
  round-trip, `workflowSubmissionId` open/close semantics, and the effective-stage
  label set the bubble reuses.
- **author-dashboard** — owns the author-mode composition of this shell (menu item set,
  read-mostly panes); this spec owns the shell machinery both render on.
- **editorial-decisions** — owns the decision action bar rendered in stage panes and
  the Return-to-Workflow / Return-to-Done header decisions.
- **send-to-review / review-rounds-and-revisions / copyediting-stage /
  production-stage / tasks-discussions / submission-files / stage-participants /
  assign-and-manage-reviewers** — own the panels inside each stage pane.
- **publication-versioning** — owns versions, publish authority (`canPublish`) and what
  Create New Version does; **Area-3 publication specs** own each Publication tab's
  content.
- **payments-fees** — owns the header Payments dropdown.
- **document-library** — owns the Library modal the header button opens.
- **reviewer-response** — owns the reviewer's own workspace (reviewers never get this
  shell).

## Canonical scenarios

1. **Editor opens a submission in review** — dbarnes clicks View on a round-2
   submission: the side modal shows ID/authors/title, a "Review (Round 2)" bubble,
   Activity Log + Library buttons; the menu lists the four stages with Review expanded
   into Round 1/Round 2 (stripe on the current round) and a Publication group with all
   version tabs + Create New Version; the URL now carries
   `workflowMenuKey=workflow_3_{currentRoundId}`.
2. **The default pane follows the state** — one submission per state: submission-stage
   and copyediting/production-queued open on their stage pane; in-review (and
   declined-in-review) open on the current round; scheduled and published open on
   Publication → Title & Abstract, with matching Scheduled/Published bubbles.
3. **Deep links share the exact pane** — a copied URL with `workflowMenuKey` reopens
   the same submission and pane; an unknown key silently falls back to the state
   default and the URL is corrected; clicking any menu item rewrites the key in place.
4. **Assistant sees only their stage** — mfritz (Copyeditor, stage-4 group) on a
   copyediting-stage submission: Copyediting pane fully renders, header has
   Preview/Library but no Activity Log, Publication submenu ends after JATS XML; every
   other stage item shows only "You don't currently have access to that stage of the
   workflow." — and when the same submission moves to Production, the modal *opens*
   onto that message.
5. **Outsiders cannot open the submission at all** — minoue (unassigned section
   editor) deep-links the modal: empty shell + "The current role does not have access
   to this operation."; atester (author) and jjanssen (reviewer) are refused the legacy
   workflow URLs; anonymous users are sent to login and return.
6. **Legacy workflow URLs collapse into the dashboard** — `workflow/access/{id}`,
   `workflow/index/{id}/{stage}` and the four stage paths each 302 to the dashboard
   with the modal open, enforcing per-stage access first (mfritz passes `editorial`,
   is refused `submission`); the named stage is dropped in favour of the state default;
   a stage-less `workflow/index/{id}` errors (deviation), an unknown id 404s.

## Known deviations (as-built ≠ intent)

- ⚠ **Legacy `workflow/index/{submissionId}` without a stage segment crashes (HTTP
  500)**: `PKPWorkflowHandler::identifyStageId()` falls through to `$args[1]` which
  doesn't exist, throwing before the redirect (live-probed as dbarnes on an accessible
  submission). Every *other* form of the shim family works. Proposed as e2e ledger §2
  row 70. Suspected intent: treat a missing stage like `access` (any-stage redirect).
- ⚠ **The workflow modal opens incomplete drafts, bypassing the completeness gate the
  per-stage doors enforce**: deep-linking `workflowSubmissionId` to a draft renders the
  full editorial shell (Incomplete bubble, submission-stage panels with the draft's
  file and discussions — live-probed as dbarnes on seed 545), and the legacy
  `workflow/access/{draftId}` shim 302s into exactly that modal (live-probed — no
  completeness policy on the `access` op), while the dashboard row deliberately
  withholds View for drafts (Complete-submission instead, `submission-drafts`) and the
  per-stage legacy ops refuse them ("…submission is incomplete" denial, live-probed).
  Not only manager-scoped: the **author's own tracking view has the same hole** —
  atester deep-linking their own draft on My Submissions gets the full author shell
  (Incomplete bubble, Submission Files with the draft's file, Discussions;
  verifier-probed on 545), while the list row substitutes Complete-submission for View
  (`author-dashboard`). e2e ledger §2 row 71 (updated with the author door).
  Suspected intent: one consistent completeness rule on every door.
- ⚠ **Revoked-role checks disagree between the shell and the legacy/API doors** (rule
  5): the shell resolves a stage assignment's role through a live enrolment in the
  assignment's **exact group** (`Schema::getAssignmentRoles`), the server doors only
  through membership in any group with the same **role id**
  (`Repository::getAccessibleWorkflowStages`). A user assigned as Copyeditor, revoked
  from Copyeditor but still enrolled as Layout Editor (both ROLE_ID_ASSISTANT), passes
  the legacy `workflow/editorial/{id}` door into a modal where every pane shows the
  no-access sentence (verifier-probed both halves on a scratch journal; revoking the
  sibling enrolment too closes both doors). Internally inconsistent; e2e ledger §2
  row 72. Suspected intent: one revocation rule on both sides.
- The **stage-drop on legacy redirects** (rule 8) and the **all-denied reviewer stub
  shell** (Open question 2) are recorded as open questions, not deviations — no data
  loss, and plausibly by design.

## Open questions

1. **Empty Publication group**: a user with modal access but no publication access
   (mfritz on a production-stage submission) still sees the "Publication" group header
   — expandable, zero items (live-probed). Should the group hide when empty?
2. **Reviewer deep-link stub**: an assigned reviewer pasting a `workflowSubmissionId`
   URL onto *their* dashboard gets the shell (title, Declined bubble, **Library**
   button, full stage menu — no Publication group at all on this dashboard) with every
   pane denied — the submission API intentionally answers assigned reviewers, and the
   reviewer dashboard reuses the author pane config (live-probed: jjanssen on 544).
   Nothing in the UI creates such a link, and the stub leaks nothing: the Library
   button opens the Submission Library modal whose body is only "The current role does
   not have access to this operation." (verifier-probed — the component handler
   refuses; behaviour owned by `document-library`). Intended leniency (reviewer
   already knows the submission) or should the modal be
   editorial/author-dashboard-only?
3. **Legacy stage links lose their stage**: `workflow/submission/{id}` authorizes
   against the named stage, then redirects without it, so the modal opens on the state
   default (rule 8) — and notifications still *generate* stage-specific links
   (rule 8), so e.g. an editor-assignment task's `workflow/submission/{id}` link opens
   whatever pane the state default picks (verifier-probed: the Tasks-panel click landed
   on the state default, which happened to coincide for a submission-stage item; an
   emailed `workflow/production/{id}` new-version link on a published submission would
   land on Publication → Title & Abstract instead). Harmless while defaults track the
   current stage; should the shims map the stage path onto `workflowMenuKey` anyway?
4. **Seam note (grooming)**: `PAGE-workflow-externalreview` was hinted at
   `review-rounds-revisions` in the atlas, but it is byte-identical shim behaviour to
   its five siblings, so this spec claims all six legacy routes as one rule;
   `review-rounds-and-revisions` should reference rule 8 rather than re-document the
   route. Same rationale vs the FEATURE-MAP's listing of `PAGE-workflow-submission/
   editorial/production` under the stage-content features — the *routes* live here,
   the stage *content* lives there.

---

## Reference — entry points & surfaces

| Entry | Path | Atom |
|-------|------|------|
| Workflow modal (editorial) | `/{journal}/dashboard/editorial?workflowSubmissionId={id}&workflowMenuKey={key}` (side modal; also mounts on mySubmissions/reviewAssignments with the author config) | VUE-workflow-page, VUE-workflow-page-ojs |
| Legacy any-stage entry | `/{journal}/workflow/access/{id}` (also `?submissionId=`) → 302 dashboard modal | PAGE-workflow-access |
| Legacy stage entry | `/{journal}/workflow/index/{id}/{stageId}` → 302; stage-less form 500s (Known deviations) | PAGE-workflow-index |
| Legacy stage paths | `/{journal}/workflow/submission\|externalReview\|editorial\|production/{id}` → 302 via index | PAGE-workflow-submission, PAGE-workflow-externalreview, PAGE-workflow-editorial, PAGE-workflow-production |
| Per-stage gate (legacy ops, grids, decision APIs) | WorkflowStageAccessPolicy (stage validity + submission + accessible-stage check) | AUTHZ-workflow-stage-access-policy, AUTHZ-workflow-stage-required-policy |
| Accessible-stages computation | UserAccessibleWorkflowStageRequiredPolicy (computes + stores the matrix), UserAccessibleWorkflowStagePolicy (checks one stage against it) | AUTHZ-user-accessible-workflow-stage-required-policy, AUTHZ-user-accessible-workflow-stage-policy |
| Modal data | `GET api/v1/submissions/{id}`, `GET …/publications/{publicationId}` (shared; submission API atoms owned elsewhere) | — |

## Reference — code anchors

- lib/pkp/pages/workflow/PKPWorkflowHandler.php (`authorize` per-op policy split,
  `access`/`index` redirects, `_redirectToIndex`, `identifyStageId`; vestigial
  `setupIndex` helpers); pages/workflow/WorkflowHandler.php (role assignments; dead
  `setupIndex`); pages/workflow/index.php (op switch)
- lib/pkp/classes/security/authorization/WorkflowStageAccessPolicy.php +
  internal/{UserAccessibleWorkflowStageRequiredPolicy, UserAccessibleWorkflowStagePolicy,
  WorkflowStageRequiredPolicy}.php; lib/pkp/classes/user/Repository.php
  `getAccessibleWorkflowStages()` / `canUserAccessStage()`;
  lib/pkp/classes/core/PKPApplication.php `getWorkflowTypeRoles()`
- lib/pkp/classes/submission/maps/Schema.php `getPropertyStages()` /
  `getAssignmentRoles()` (`stages[].currentUserAssignedRoles` — the client-side matrix)
- lib/ui-library/src/pages/workflow/: WorkflowPage.vue, WorkflowPageOJS.vue,
  workflowStore.js; composables/useWorkflowMenu.js (URL key sync, initial selection),
  useWorkflowPermissions.js (accessibleStages, canAccessPublication/Production,
  canPublish, canAccessEditorialHistory),
  useWorkflowNavigationConfig/useWorkflowNavigationConfigOJS.js (menu items, key
  grammar, `getInitialSelectionItemKey`),
  useWorkflowConfig/{useWorkflowConfigOJS,workflowConfigEditorialOJS,workflowConfigAuthorOJS}.js
  (per-stage pane composition, common accessibleStages guard, header items),
  useWorkflowDataSubmissionPublication.js
- lib/ui-library/src/components/StageBubble/StageBubble.vue; js/load.js (OJS component
  registration); lib/pkp/classes/workflow/WorkflowStageDAO.php (stage-path map)
- lib/ui-library/src/pages/dashboard/dashboardPageStore.js `openWorkflowModal()`
  (owned by editorial-dashboards; the modal's door)
