---
name: author-dashboard
scope: An author tracks their submissions — the My Submissions list (views per state, search, filters) and the read-mostly tracking view of one submission (status, stage progress, files, discussions, decision notifications, publication tabs)
shared: pkp-lib
status: verified
e2e-plans: [author-dashboard.md]
atlas-claims:
  - PAGE-dashboard-mysubmissions
  - PAGE-authordashboard-submission
  - PAGE-authordashboard-readsubmissionemail
  - AUTHZ-author-dashboard-access-policy
  - API-email-get-many
---

# Author dashboard (My Submissions)

## Purpose

After submitting a manuscript, the author's home base is **My Submissions**
(`/dashboard/mySubmissions`): a side-nav group titled **"My Submissions as Author"**
listing state views (Active, Revisions requested, Revisions submitted, Incomplete,
Scheduled, Published, Declined) with live counts, plus a **Start a New Submission**
link. Each view is a table of the author's own submissions — ID, title, stage,
what's happening now, and per-state actions (open the tracking view, resume a draft,
submit revisions). Clicking **View** opens the submission in a side panel — the
author's **read-mostly tracking view**: stage-by-stage progress, the status banner,
files they may see, discussions, the editor's decision notifications, and read-only
publication tabs. In OJS 3.6 this replaced the legacy Author-Dashboard page: the old
`/authorDashboard/submission/{id}` URL survives only as a redirect into this page, and
one legacy endpoint (`readSubmissionEmail`) still renders the decision emails the
tracking view lists. This spec owns the list page, the author-mode tracking view as a
composition (what an author sees/can do where), and both legacy surfaces; the rules
inside each panel (drafts, discussions, files, review rounds, versions) live in their
owning specs and are only pointed to.

## Actors & permissions

Baseline: everything requires login in a journal context. **"The Author role"** is the
journal enrolment OJS grants automatically when a user makes their first submission
(or a manager enrols them). **"Their own submission"** = one the user holds an author
stage assignment on — assignment, not submitter-ship, is what counts (live-probed:
atester, assigned as author participant on a submission phudson submitted, sees it in
My Submissions). There is no manager/site-admin override anywhere on this page: the
page itself is Author-role-only. <sup>a</sup>

| Action | Who may — and when |
|--------|--------------------|
| **Open My Submissions** | • Users holding the Author role in this journal — the "My Submissions as Author" nav group and the page (live-probed: atester 200; phudson gains access after his first submission)<br>• Editors/managers/reviewers/site admins *without* the Author role — refused ("The current role does not have access…"; live-probed: dbarnes, jjanssen and `admin` all bounced to authorizationDenied)<br>• Anonymous — redirected to login with a return link (live-probed) <sup>b</sup> |
| **See a submission in the list** | • Only users with an author stage assignment on it, and only in their own list — every view queries "assigned to me as author" (live-probed: foreign submissions absent; assigned-not-submitter present) <sup>c</sup> |
| **Open the tracking view** | • The submission's author — row **View** button or a shareable deep link (`?workflowSubmissionId=N`)<br>• Anyone else deep-linking to a submission not theirs — the panel shows only "Error — The current role does not have access to this operation." (live-probed: atester on phudson's submission) <sup>d</sup> |
| **Resume an incomplete draft** | • The submitting author — the draft row offers **Complete submission** instead of View and reopens the wizard (rules owned by `submission-drafts`; live-probed: lands on `/submission?id=N` at the saved step) <sup>e</sup> |
| **Read a decision notification** | • The submission's author — the **Notifications** list in the tracking view's Review stage; each entry opens the email in a side panel (legacy `readSubmissionEmail`)<br>• Anyone else — refused at the door, including other authors of *other* submissions (live-probed: phudson on atester's email → authorizationDenied) <sup>f</sup> |
| **Use the legacy author-dashboard URL** | • The submission's author (submitter or assigned co-author) — `/authorDashboard/submission/{id}` redirects to My Submissions with that submission's tracking view open (live-probed 302, both author kinds)<br>• Users without the Author role, incl. site admins — refused ("authorRoleMissing"); authors of other submissions — refused ("accessibleWorkflowStage") (all live-probed) <sup>g</sup> |
| **Start a new submission** | • Any user seeing the nav group — the **Start a New Submission** item, removed when the journal has disabled submissions while the dashboard itself stays (live-probed on a scratch journal, before/after). For users who *also* hold an editorial role the item sits under their "Dashboards" nav group instead of this one (wizard owned by `submission-wizard`) <sup>h</sup> |
| **Delete / bulk-delete drafts** | • See `submission-drafts` — the More-Actions bulk-delete tool also mounts on this page, scoped to own drafts <sup>i</sup> |

<sup>a</sup> PKPDashboardHandler::__construct() (`addRoleAssignment([ROLE_ID_AUTHOR], ['mySubmissions'])`, `selectedRoleIds=[ROLE_ID_AUTHOR]`); Collector::assignedTo() ·
<sup>b</sup> PKPDashboardHandler::authorize() (PKPSiteAccessPolicy); live probes 2026-07-03 ·
<sup>c</sup> Repository::getDashboardViews() / mapDashboardViews() (every author view carries `assignedTo([$user], [ROLE_ID_AUTHOR])`); PKPBackendSubmissionsController::assigned() ·
<sup>d</sup> dashboardPageStore.openWorkflowModal(); PKPSubmissionController::authorize() SubmissionAccessPolicy (API 401 → error dialog); live probe 2026-07-03 ·
<sup>e</sup> useDashboardConfigEditorialActivity getEditorialActivityForMySubmissions() (`openSubmissionWizard`); DashboardCellSubmissionActions.vue `showButton` ·
<sup>f</sup> PKPAuthorDashboardHandler::readSubmissionEmail(); AuthorDashboardAccessPolicy; WorkflowListingEmails.vue openEmail() ·
<sup>g</sup> PKPAuthorDashboardHandler::submission() (redirect); AuthorDashboardAccessPolicy (SubmissionAccessPolicy + UserAccessibleWorkflowStageRequiredPolicy(WORKFLOW_TYPE_AUTHOR)); route roles `[ROLE_ID_AUTHOR]`; live probes 2026-07-03 ·
<sup>h</sup> PKPTemplateManager::setupBackendPage() (`disableSubmissions` guard + `$isNewSubmissionLinkPresent` — the editorial "Dashboards" group claims the item first); live probe 2026-07-03 ·
<sup>i</sup> useDashboardBulkDelete.js; owned by submission-drafts

## Fields & validation

The page has no data-entry forms; its only inputs are list controls.

| Field (UI label) | Required? | Rules | Anchor |
|------------------|-----------|-------|--------|
| **Search** ("Search submissions, ID, authors, keywords, etc.") | no | Free text; matches title, author names and numeric ID (live-probed: searching an ID found the row); resets when switching views | DashboardControlSearch.vue; dashboardPageStore `setSearchPhrase` |
| **Filters → Section** | no | Checkbox per journal section; hidden when the journal has only one section | PKPSubmissionFilters::addSectionFields() |
| **Filters → Issues** | no | Issue picker (OJS-only); hidden when the journal has no issues | SubmissionFilters::addIssues() (OJS) |
| **Filters → Categories** | no | Category picker; hidden when the journal has no categories | PKPSubmissionFilters::addCategories() |
| **Filters → Days since last activity** | no | Slider 0–180; a list filter only | PKPSubmissionFilters::addDaysSinceLastActivity() |

The **Assigned to editors** filter is manager/site-admin-only and therefore never
appears for a plain author (live-probed: atester's Filters panel on `publicknowledge`
shows only the four fields above). All three hide conditions live-probed on a fresh
scratch journal (one section, no issues, no categories): its Filters panel holds only
the Days-since-last-activity slider. <sup>a</sup>

<sup>a</sup> PKPSubmissionFilters::addAssignedTo() (`isManagerOrAdmin()`); SubmissionFilters::addIssues() (`$issueExists` guard); live probes 2026-07-03

## Rules & state

1. **The page offers exactly seven author views, always scoped to "mine as author".**
   Active submissions · Revisions requested · Revisions submitted · Incomplete
   submissions · Scheduled for publication · Published · Declined — in that order,
   mirrored as the side-nav submenu with per-view counts. Membership: Active = all my
   queued submissions **including incomplete drafts**; Revisions requested/submitted =
   review-round revision flags; Incomplete = drafts only; Scheduled = accepted and
   scheduled to an issue; Published = submissions whose workflow ended (Done stage);
   Declined = declined at any stage. Landing without (or with an unknown)
   `currentViewId` falls back to the first view (Active). Live-probed all seven with
   one seeded submission per state — each appeared exactly where expected. <sup>a</sup>
2. **The list is a five-column table with no "Days" column.** ID (sortable) ·
   Submissions (contributor string — title) · Stage · Editorial Activity · Actions.
   The editorial dashboard's days-since-activity column is not part of the author
   variant. Clicking the ID header re-sorts the list server-side and records the sort
   in the URL (live-probed: first click → `sortDirection=descending` +
   `orderBy=id&orderDirection=DESC` API call, second click flips to ascending, rows
   re-order both times). 30 rows per page with Previous/Next paging. <sup>b</sup>
3. **The Stage cell shows the submission's effective state, not just the raw stage**:
   Incomplete (draft), Submission, Review (Round N), Copyediting, Production,
   Scheduled, Published, Declined (declined wins over stage; live-probed each label).
   <sup>c</sup>
4. **The Editorial-Activity cell tells the author what is happening and, when it is
   their move, gives them the action** (author variant; live-probed per state):
   - Draft → **Complete submission** action; the View button is suppressed (semantics
     owned by `submission-drafts`).
   - Review, with revisions or a resubmit-for-review requested → "Revision
     requested" + **Submit revisions** button that opens the file-upload wizard for
     review revisions right from the list (flow owned by
     `review-rounds-and-revisions`).
   - Review otherwise → compact review-progress indicators (updated/completed counts,
     e.g. "Review update 0/1").
   - Copyediting → "Copyedited Files Uploaded: N".
   - Scheduled → "To be published in issue {issue}".
   - Submission stage, Production (unscheduled), Published, and desk-declined → empty;
     the author has nothing to do. A submission declined *during Review*, however,
     keeps the review-progress indicators in its cell (the author variant never checks
     the declined status — live-probed: a review-stage decline shows "Review update
     0/1"; the editorial variant shows "Declined during…" instead — Open question 6).
     Unlike the editorial dashboard, the author's cell never shows
     assign-editor/reviewer prompts. <sup>d</sup>
5. **View opens the tracking side panel; the URL is shareable state.** The panel
   records `workflowSubmissionId` (and the selected pane as `workflowMenuKey`) in the
   query string, so a copied URL reopens the same submission and pane; closing it
   returns to the list and refreshes it. It opens on the pane that matters now: the
   current review round in Review; **Publication → Title & Abstract** once scheduled
   or published; the current stage otherwise (all live-probed). <sup>e</sup>
6. **The tracking view is the author-mode workflow page — same shell as the editors',
   different config.** Header: status pill, **Library** button (journal document
   library, read surface). Menu: all four stage tabs (Submission, Review with one
   entry per round, Copyediting, Production) plus **Publication** tabs per version.
   A stage the author's group may not access shows only "You don't currently have
   access to that stage of the workflow." instead of its panels. Per stage the author
   gets read-mostly panels: Submission → submission files + discussions; Review →
   decision **Notifications** (rule 7), revision files ("Revisions Uploaded", with
   Upload), discussions, an **Author Response** manager while a response is requested
   or the round stands at revisions-requested / accepted (it drops off again once
   revisions are submitted — live-probed), an **Upload revisions** action from the
   moment revisions (or a resubmit) are requested — which stays after the author
   submits revisions (live-probed: still offered under "Revisions have been
   submitted…"), and — only when a review ran with the *open* method and is
   completed — a **Reviewers** panel naming the reviewer (open review discloses
   identity by design) with a **Read Review** action; absent for
   anonymous/double-anonymous reviews (live-probed both ways; who-sees-what owned by
   `review-anonymity`);
   Copyediting → discussions + copyedited files; Production → discussions only. No
   decision buttons, no participants list, no activity log anywhere (those are
   editorial-config-only). Discussions rules live in `tasks-discussions`. <sup>f</sup>
7. **Decision notifications surface in the Review stage and open via the legacy email
   endpoint.** The "Notifications" box appears only when there is at least one entry
   (live-probed: absent on a round with no notify-author email) and lists the editor's
   notify-author emails for this submission — subject + sent date, in the order they
   were logged, **oldest first** (no ordering is applied anywhere on the path;
   live-probed with two decisions) — fetched from
   `GET emails/authorEmails` — an author-only route that serves **only the requesting
   author's own** notify-author log entries for a submission they are assigned to.
   Clicking one opens `authorDashboard/readSubmissionEmail` in a side panel showing
   subject and body. Despite the old op name, nothing is "marked read" — the endpoint
   only renders the email; an email id that isn't one of the author's notify-author
   entries yields an empty response (blank panel), not an error (live-probed:
   list → click → body shows the decision message; bogus id → 200 empty). The listing
   is wired only for the Review stage, although the same endpoint can also serve
   copyediting/proofing notify-author emails (Open question 3). <sup>g</sup>
8. **Publication tabs are visible but locked unless the editor unlocked metadata.**
   Tabs: Title & Abstract, Contributors, Metadata, References (journal supports
   citations), Data (data availability/citations enabled), Galleys, Media — never the
   editorial-only Identifiers, JATS, Body Text, License or Issue tabs, and never
   Publish/Unpublish/Create-version controls. Forms render with **Save disabled**
   when the author lacks the per-submission "may edit metadata" grant (owned by
   `stage-participants`); with the grant, Save works and the edit persists
   (live-probed both ways 2026-07-03: granted author saved a new title + abstract,
   re-fetched changed; ungranted author's Save disabled). Once any version is
   published or scheduled, author editing is blocked regardless of the grant;
   *published* versions additionally banner "This version has been published and can
   not be edited." — a *scheduled* version only disables Save, with no banner
   (live-probed both; versions owned by `publication-versioning`).
   <sup>h</sup>
9. **The legacy author-dashboard page is a redirect shim.** `/authorDashboard/
   submission/{id}` answers only to the submission's author and 302s to
   `/dashboard/mySubmissions?workflowSubmissionId={id}` — it keeps old decision-email
   links and the participants-grid **Login As** (author target) working. All URLs OJS
   generates today (`urlAuthorWorkflow`, notification links) already point at the new
   page. The handler's other op, `reviewRoundInfo`, is routed but unimplemented (404,
   live-probed) and its whole template-rendering path is dead code — recorded in
   `UNASSIGNED.md` §Dead-code candidates, incl. the giveaway that
   `PKPAuthorDashboardHandler::setupTemplate()` would fatal on an undefined variable
   if anything still called it. Nuance from the verifier's re-attack: the three
   author-grid handlers that path referenced still *answer* hand-crafted
   component-router fetches for an authorized author (live-probed 200) — "dead" means
   UI-orphaned (nothing links or renders them), not unroutable. <sup>i</sup>

<sup>a</sup> Repository::mapDashboardViews() (TYPE_ACTIVE incl. drafts — no incomplete exclusion; TYPE_REVISIONS_REQUESTED/SUBMITTED `filterByRevisions*`; TYPE_INCOMPLETE_SUBMISSIONS; TYPE_SCHEDULED STATUS_SCHEDULED; TYPE_PUBLISHED `filterByStageIds([WORKFLOW_STAGE_ID_DONE])`; TYPE_DECLINED STATUS_DECLINED); filterViewsByUserRoles(); dashboardPageStore `currentViewId` fallback; live probes 2026-07-03 ·
<sup>b</sup> useDashboardConfig getColumns() (MY_SUBMISSIONS branch — no `lastActivity` column; `id` the only `sortable`); dashboardPageStore (sort → `orderBy`/`orderDirection` query); PKPDashboardHandler `$perPage = 30`; live probes (headers, "Previous 1 2 Next", sort round-trip 2026-07-03) ·
<sup>c</sup> useSubmission getExtendedStage()/getExtendedStageLabel() (DECLINED first; `submissionProgress` → INCOMPLETE; DONE → PUBLISHED; PRODUCTION by status QUEUED/SCHEDULED/PUBLISHED) ·
<sup>d</sup> useDashboardConfigEditorialActivity getEditorialActivityForMySubmissions() (`openSubmissionWizard`, FILE_UPLOAD `dashboard.submitRevisions`, ReviewsUpdate/ReviewsOpen cells, `dashboard.copyEditedFilesUploaded`, `dashboard.toBePublishedInIssue`; no STATUS_DECLINED branch — contrast getEditorialActivityForEditorialDashboard `dashboard.declinedDuringStage`); DashboardCellSubmissionActivityReviewsUpdate.vue (renders unconditionally); DashboardCellSubmissionActions.vue; live probes 2026-07-03 ·
<sup>e</sup> dashboardPageStore openWorkflowModal() (query params, onClose refetch); useWorkflowMenu (watch submission → `workflowMenuKey` or `getInitialSelectionItemKey`); useWorkflowNavigationConfigOJS getInitialSelectionItemKey() (review → round key; production+non-queued / done+published → `publication_{id}_titleAbstract`); live probes 2026-07-03 ·
<sup>f</sup> useWorkflowConfigOJS (non-editorial dashboardPage → ConfigAuthorOJS); workflowConfigAuthorOJS WorkflowConfig (per-stage items; common `accessibleStages` guard → `user.authorization.accessibleWorkflowStage` — live-probed on a scratch journal with Production unassigned from the Author group; AuthorResponseManager gate `isAuthorResponseRequested || statusId ∈ {ACCEPTED, REVISIONS_REQUESTED}`; Upload-revisions gate `statusId ∈ {REVISIONS_REQUESTED, RESUBMIT_FOR_REVIEW, REVISIONS_SUBMITTED}`; getHeaderItems → Library only) + getOpenAndCompletedReviewAssignmentsForRound() (open-method + completed only → ReviewerManager `redactedForAuthors`); useWorkflowPermissions (`canAccessEditorialHistory` never true for author-only assignment); live probes 2026-07-03 (modal menu/panels per stage: submission, review ×4 states, copyediting, production) ·
<sup>g</sup> WorkflowListingEmails.vue (review-stage-only `requestQuery`, EDITOR_NOTIFY_AUTHOR, `v-if="emails?.length"`, no client-side sort); PKPEmailController::getGroupRoutes()/getMany() (route role AUTHOR; own author stage assignment required; `EmailLogEntry::withRecipientId` scoping, bare `->get()` — insertion order; `authorEmailLogEventTypes` incl. COPYEDIT/PROOFREAD_NOTIFY_AUTHOR); PKPAuthorDashboardHandler::readSubmissionEmail() (filters by event type + current user, silent fall-through on unknown id); templates/authorDashboard/submissionEmail.tpl; live probes 2026-07-03 ·
<sup>h</sup> useWorkflowNavigationConfigOJS getPublicationItemsAuthor() (vs getPublicationItemsEditorial); workflowConfigAuthorOJS PublicationConfig (`canEdit: permissions.canEditPublication`; `WorkflowPublicationEditDisabled` gated on `STATUS_PUBLISHED` only — scheduled gets no banner); useWorkflowPermissions (`canEditPublication = canCurrentUserChangeMetadata`, author blocked when any version published/scheduled, `canPublish` requires editorial roles); live probes 2026-07-03 (Save disabled default; enabled + persisting with canChangeMetadata grant; scheduled = no banner, published = banner) ·
<sup>i</sup> PKPAuthorDashboardHandler::submission() (redirect) / setupTemplate() (uncalled; references undefined `$citationsForm`); pages/authorDashboard/index.php (`reviewRoundInfo` case, no method); StageParticipantGridRow (Login-As `$handler = 'authorDashboard'`); maps/Schema.php `urlAuthorWorkflow`; live probes 2026-07-03

## Side effects

None. The list and the tracking view are read surfaces: no emails, notifications,
event-log entries or jobs are raised by browsing, searching, opening a submission or
reading a decision notification (`readSubmissionEmail` renders the logged email and
stores nothing). Mutations reachable *from* here — resuming/deleting drafts,
uploading revisions, posting discussions, saving unlocked metadata — belong to their
owning specs. <sup>a</sup>

<sup>a</sup> PKPAuthorDashboardHandler::readSubmissionEmail() (fetchJson only); dashboardPageStore (fetch/refetch only)

## Settings that modify behavior

- **Don't accept submissions** (Settings → Workflow, `disableSubmissions`): removes
  the **Start a New Submission** nav item; the dashboard itself stays available.
- **Citations / Data availability & citations** (Settings → Workflow): add or remove
  the References and Data publication tabs in the tracking view.
- **Journal structure**: a single-section journal hides the Section filter; a journal
  with no issues hides the Issues filter; no categories hides the Categories filter.
- **Review type per assignment**: only *open*-method completed reviews expose the
  redacted reviewer listing to the author (rule 6; `review-anonymity`).
- No setting hides or disables the My Submissions page itself.

## Cross-feature interactions

- **submission-drafts** — owns everything draft-specific on this list (Incomplete
  stage label, Complete-submission action, the Incomplete view semantics, More
  Actions → Delete Incomplete Submissions). This spec owns the page they mount on.
- **submission-wizard** — owns the wizard the Complete-submission action and the
  Start-a-New-Submission link open.
- **editorial-dashboards** — owns the shared DashboardPage/DashboardTable machinery
  (views plumbing, filters form internals, sorting/pagination mechanics) and the
  editorial/review-assignment variants; this spec documents only the author-facing
  behaviour of that machinery.
- **workflow-stage-navigation** — owns the workflow-page shell and stage routing for
  editorial roles; this spec owns the author-mode composition of that shell.
- **tasks-discussions** — owns discussion rules; the author's per-stage Discussions
  panels are pointers.
- **review-rounds-and-revisions / reviewer-response** — own revision uploads and
  review-round states surfaced in rows and the Review stage.
- **review-anonymity** — owns reviewer-identity redaction (blank reviewer names in
  the author's data, open-review-only listing).
- **stage-participants** — owns the "may edit metadata" grant that unlocks rule 8.
- **publication-versioning** — owns versions, the published-version edit lock, and
  publish authority.
- **editorial-decisions** — owns the decisions whose notify-author emails rule 7
  displays.

## Canonical scenarios

1. **My list shows my submissions, per state** — atester on `publicknowledge` opens
   My Submissions: the nav shows the seven views with counts; each seeded state
   (submitted, in review, copyediting, production, scheduled, published, declined,
   draft) appears with the right Stage label and activity note; another author's
   submission never appears.
2. **State views funnel correctly** — one submission per state: each dedicated view
   (Revisions requested, Incomplete, Scheduled, Published, Declined) lists exactly
   the matching submission; the Active view also contains the incomplete draft
   (by design, rule 1).
3. **Search narrows to mine** — searching a title fragment or an ID reduces the list
   to the matching row; a non-matching phrase shows the empty state; switching views
   clears the search.
4. **Author opens their submission and gets the read-mostly view** — atester clicks
   View on an in-review submission: side panel opens on the current round with the
   round-status banner, notifications, revision-file panel and discussions — but no
   decision buttons, no participants, no reviewer identities; the URL deep-link
   reopens the same pane.
5. **Revisions requested reaches the author end-to-end** — after the editor requests
   revisions with a message: the row shows "Revision requested"/**Submit revisions**,
   the Revisions-requested view lists it, the tracking view banners the round status,
   offers **Upload revisions**, and the Notifications entry opens the editor's email
   with the message body.
6. **Someone else's submission is out of reach** — atester deep-links another
   author's `workflowSubmissionId` (or the legacy `/authorDashboard/submission/{id}`
   URL): the panel shows only the access-denied error (legacy URL bounces to
   authorization-denied); dbarnes (editor, no author role) cannot open My Submissions
   at all.

## Known deviations (as-built ≠ intent)

None ⚠-worthy found; the restrictive rules (author-role-only page, read-only
publication forms, review-stage-only notifications) read as design. The as-built
edges are parked as Open questions 2–3 and 6 rather than deviations; the dead legacy
rendering path is recorded as dead-code candidates in `UNASSIGNED.md` (rule 9), and
three stale "live" verdicts in the grids liveness audit were corrected as part of
this spec's evidence (the adversarial pass also re-attacked the three dead-grid
verdicts by direct component-router fetch — verdicts stand, evidence sharpened in
`UNASSIGNED.md`).

## Open questions

1. `GET /emails/{emailId}` (API) duplicates what `readSubmissionEmail` renders and
   works for authors (live-probed 200), but no UI calls it — is it the intended
   modern replacement for the legacy endpoint (should `WorkflowListingEmails` switch
   to it), or reserved for other consumers? (Atom left to an email/e-delivery spec.)
2. `readSubmissionEmail` with an email id that isn't the author's returns an empty
   200 (blank side panel) instead of an error — acceptable, or should it 404?
3. The Notifications listing is wired only for the Review stage, while
   `emails/authorEmails` also serves copyedit/proofread notify-author events — is
   surfacing those in Copyediting/Production planned, or intentionally review-only?
4. The author's **Active submissions** view includes incomplete drafts even though a
   dedicated Incomplete view exists (mirrors the editorial Active view). Intended?
5. Grooming: `VUE-submissions-list-panel` was mapped to this feature as an "author
   variant", but its only live mounts are the native-XML and PubMed export pickers —
   parked in `UNASSIGNED.md` for an import/export spec to claim.
6. The author's Editorial-Activity cell ignores the declined status: a submission
   declined *during Review* keeps showing "Review update x/y" (rule 4), while the
   editorial variant explicitly shows "Declined during {stage}". Oversight or
   deliberate minimalism for authors?

---

## Reference — entry points & surfaces

| Entry | Path | Atom |
|-------|------|------|
| My Submissions page | `/{journal}/dashboard/mySubmissions` (+ `currentViewId`, `searchPhrase`, `workflowSubmissionId`, `workflowMenuKey` query state) | PAGE-dashboard-mysubmissions |
| Side-nav group | "My Submissions as Author" → one item per view + Start a New Submission | — (nav built by PKPTemplateManager::setupBackendPage) |
| List data | `GET api/v1/_submissions/assigned` / `_submissions/reviews` per view + `_submissions/viewsCount` | — (API-backend-submissions-assigned etc.; shared, editorial-dashboards territory) |
| Tracking view | side modal `WorkflowPage` (author config) on the same URL | — (VUE-workflow-page, owned by workflow-stage-navigation) |
| Decision-notification list | `GET api/v1/emails/authorEmails?submissionId=N&eventType=…` | API-email-get-many |
| Decision-notification body | `/{journal}/authorDashboard/readSubmissionEmail?submissionId=N&submissionEmailId=M` (JSON side panel) | PAGE-authordashboard-readsubmissionemail |
| Legacy author dashboard | `/{journal}/authorDashboard/submission/{id}` → 302 to My Submissions (kept for old email links + participants-grid Login As) | PAGE-authordashboard-submission |
| Access policy | AuthorDashboardAccessPolicy (submission access + author workflow-stage access) | AUTHZ-author-dashboard-access-policy |
| Dead op | `/{journal}/authorDashboard/reviewRoundInfo` — routed, unimplemented, 404 | — (PAGE-authordashboard-reviewroundinfo, dead-code candidate) |

## Reference — code anchors

- lib/pkp/pages/dashboard/PKPDashboardHandler.php (`mySubmissions` op, role assignment, `DashboardPage::MySubmissions`, `getViews`, `$perPage`); pages/dashboard/index.php (op → DashboardPage routing); pages/dashboard/DashboardHandler.php (OJS `getSubmissionFiltersForm`, `setupIndex`)
- lib/pkp/classes/submission/Repository.php (`getDashboardViews`, `mapDashboardViews`, `filterViewsByUserRoles`, `getWorkflowUrlByUserRoles` — author URL target); lib/pkp/classes/submission/DashboardView.php (view type constants/order)
- lib/pkp/classes/template/PKPTemplateManager.php (`setupBackendPage` — mySubmissions nav group, newSubmission item, `disableSubmissions`)
- lib/ui-library/src/pages/dashboard/dashboardPageStore.js (views/search/filters/sort state, `openWorkflowModal`, `openSubmissionWizard`); composables/useDashboardConfig.js (MY_SUBMISSIONS columns/controls); composables/useDashboardConfigEditorialActivity.js (`getEditorialActivityForMySubmissions`); components/DashboardTable/DashboardCellSubmissionActions.vue, DashboardCellSubmissionStage.vue
- lib/ui-library/src/composables/useSubmission.js (`getExtendedStage`, `getOpenAndCompletedReviewAssignmentsForRound`)
- lib/ui-library/src/pages/workflow/composables/useWorkflowConfig/workflowConfigAuthorOJS.js (author stage/publication panels); useWorkflowNavigationConfig/useWorkflowNavigationConfigOJS.js (`getPublicationItemsAuthor`, `getInitialSelectionItemKey`); useWorkflowPermissions.js; useWorkflowMenu.js; lib/ui-library/src/pages/workflow/components/primary/WorkflowListingEmails.vue
- classes/components/forms/dashboard/SubmissionFilters.php + lib/pkp/classes/components/forms/dashboard/PKPSubmissionFilters.php (filter fields, role gating)
- lib/pkp/pages/authorDashboard/PKPAuthorDashboardHandler.php (`submission` redirect, `readSubmissionEmail`, dead `setupTemplate`); pages/authorDashboard/{index.php,AuthorDashboardHandler.php}; lib/pkp/classes/security/authorization/AuthorDashboardAccessPolicy.php
- lib/pkp/api/v1/emails/PKPEmailController.php (`authorEmails` route, per-author scoping); lib/pkp/classes/log/SubmissionEmailLogEventType.php
