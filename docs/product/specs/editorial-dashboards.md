---
name: editorial-dashboards
scope: Editorial triage of submissions — the Editor Dashboard (state views, counts, filters, search, sort, the submissions table and its row actions) and the reviewer's My-Assignments dashboard, plus the shared DashboardPage machinery and the legacy submissions/dashboard URLs
shared: pkp-lib
status: verified
e2e-plans: [editorial-dashboards.md]
atlas-claims:
  - PAGE-dashboard-index
  - PAGE-dashboard-editorial
  - PAGE-dashboard-reviewassignments
  - PAGE-submissions-index
  - PAGE-submissions-tasks
  - VUE-dashboard-page
  - VUE-dashboard-table
  - FORM-submission-filters
  - FORM-pkp-submission-filters
  - API-backend-submissions-get-many
  - API-backend-submissions-assigned
  - API-backend-submissions-reviews
  - API-backend-submissions-get-views-count
  - API-backend-submissions-get-review-assignments
  - LOC-submission-submission-dashboard
  - LOC-submission-dashboard-reviewAssignment
---

# Editorial dashboards

## Purpose

The dashboard is where editorial work starts every day. Users with an editorial role
(journal manager, section editor, assistant — and site admins) get the **Editor
Dashboard** (`/dashboard/editorial`): a side-nav group of state **views** with live
counts (Assigned to me, Active submissions, Needs editor, per-stage and per-review-state
buckets, Scheduled, Published, Declined), each showing a submissions table with search,
a filters panel, sortable columns and per-row actions — the row's Editorial-Activity
cell says what the submission is waiting for, and **View** opens the submission's
workflow in a side panel without leaving the list. Reviewers get their own variant, **My
Assignments as Reviewer** (`/dashboard/reviewAssignments`): the same page machinery
listing their review assignments by state (action required, all, completed, declined,
published, archived) with per-state actions that jump into the review response flow.
Authors get My Submissions (owned by `author-dashboard`). This spec owns the three-page
dashboard family as a product surface — role gating, view lists and membership per role,
counts, the filters form, search/sort/pagination mechanics, table composition, row
actions from the table — plus the legacy `submissions`/`dashboard` URLs that now
redirect into it. What happens *inside* an opened submission belongs to the workflow and
decision specs.

## Actors & permissions

Baseline: everything requires login in a journal context; anonymous users are redirected
to login with a return link (live-probed). Roles are journal enrolments; **"manager
scope"** below means journal managers and site admins — the two roles that see the whole
journal's submissions; **"assigned scope"** means section editors (sub-editors) and
assistants, who see only submissions they hold an editorial stage assignment on. In the
test journal the seeded "Journal editor" group (dbarnes) is a Manager-level role — the
live probes below use dbuskins/minoue (section editors) and mfritz (assistant) for
assigned scope. <sup>a</sup>

**Site-admin scope rides on the manager auto-enrolment** (the systemic caveat recorded
at `submission-wizard` Known deviations / e2e ledger §2 row 56 — referenced, not
re-flagged here). "Site admins have manager scope" holds only because the seeded
`admin` is auto-enrolled as a **manager** on every journal at creation. A site-admin
account with **no** manager enrolment on the journal gets an **empty** Editor Dashboard:
`getDashboardViews()` intersects the *context-scoped* roles (none, for a pure site
admin) so zero views survive `filterViewsByUserRoles`, and the view-count/assigned
endpoints 401 (their role middleware omits `SITE_ADMIN`) — only the journal-wide
`GET _submissions` still answers (that route lists `SITE_ADMIN`). Live-probed 2026-07-03
on a scratch journal: with the admin's manager enrolment removed, the page loaded but
carried 0 views and the nav count / `assigned` calls returned 401; enrolment restored →
15 views.

| Action | Who may — and when |
|--------|--------------------|
| **Open the Editor Dashboard** | • Site admins, managers, section editors, assistants — the "Editor Dashboard" side-nav group and the page (live-probed: admin, dbarnes, dbuskins, minoue, mfritz all 200)<br>• Authors and reviewers without an editorial role — refused ("The current role does not have access…"; live-probed: atester, jjanssen → authorizationDenied) <sup>b</sup> |
| **Open the reviewer dashboard** | • Reviewers only — the "My Assignments as Reviewer" nav group and `/dashboard/reviewAssignments` (live-probed: jjanssen 200)<br>• Everyone else including managers and site admins — refused (live-probed: dbarnes AND `admin` → authorizationDenied). There is no editor-facing variant of this page; editors triage review state through the Editor Dashboard's review views <sup>c</sup> |
| **See a submission in a view** | • Manager scope — every submission in the journal, including unassigned ones and other users' incomplete drafts (live-probed)<br>• Assigned scope — only submissions they are assigned to in an editorial role; unassigned submissions are invisible to them even via search (live-probed: seeded unassigned submission absent for dbuskins/mfritz, present for manager)<br>• Reviewers — only their own review assignments, on their own page <sup>d</sup> |
| **Use the Needs-editor and Declined views** | • Manager scope only — both views absent from section editors' and assistants' view lists (live-probed: 15 views for manager/admin vs 13 for dbuskins/minoue/mfritz) <sup>e</sup> |
| **Filter by assigned editor** | • Manager scope only — the "Assigned To Editor" filter is absent from everyone else's Filters panel (live-probed: present for dbarnes/admin, absent for dbuskins/mfritz/jjanssen) <sup>f</sup> |
| **Open a submission's workflow from a row** | • Any dashboard user — the row **View** button, except on rows where their only relationship to the submission is author or reviewer: there the cell shows a "you cannot access this as a Journal Manager" notice and the View button is withheld (rule 8; live-probed both guards)<br>• Incomplete drafts — **Complete submission** replaces View (owned by `submission-drafts`) <sup>g</sup> |
| **Act on a review assignment** | • The assigned reviewer — per-state row action (Respond to request / Finish review / View) jumping to the reviewer response page (live-probed: lands on `/reviewer/submission/{id}`; flow owned by `reviewer-response`) <sup>h</sup> |
| **Use the legacy URLs** | • Any logged-in user — `/{journal}/submissions` and `/{journal}/dashboard` redirect to the user's dashboard by role priority (rule 12; live-probed per role)<br>• ⚠ `/{journal}/submissions/tasks` errors for everyone (dead legacy op — Known deviations) <sup>i</sup> |

<sup>a</sup> PKPDashboardHandler::__construct() (role assignments per op); Repository::getDashboardViews() (`$canAccessUnassignedSubmission` = site admin/manager) ·
<sup>b</sup> PKPDashboardHandler::__construct() (`editorial` → SITE_ADMIN/MANAGER/SUB_EDITOR/ASSISTANT); PKPSiteAccessPolicy; live probes 2026-07-03 ·
<sup>c</sup> PKPDashboardHandler::__construct() (`reviewAssignments` → ROLE_ID_REVIEWER only); live probes 2026-07-03 ·
<sup>d</sup> Repository::mapDashboardViews() (per-view `assignedTo()` vs unscoped collector); PKPBackendSubmissionsController route role middleware; live probes 2026-07-03 ·
<sup>e</sup> Repository::mapDashboardViews() (TYPE_NEEDS_EDITOR / TYPE_DECLINED roles) + filterViewsByUserRoles(); live probes 2026-07-03 ·
<sup>f</sup> PKPSubmissionFilters::addAssignedTo() (`isManagerOrAdmin()`); live probes 2026-07-03 ·
<sup>g</sup> DashboardCellSubmissionActions.vue `showButton`; useDashboardConfigEditorialActivity.js (author/reviewer guards); live probes 2026-07-03 ·
<sup>h</sup> DashboardCellReviewAssignmentActions.vue; dashboardPageStore.openReviewerForm(); live probe 2026-07-03 ·
<sup>i</sup> lib/pkp/pages/submissions/index.php; PKPPageRouter::getHomeUrl(); live probes 2026-07-03

## Fields & validation

The dashboards have no data-entry forms; the inputs are the list controls. The Filters
panel opens as a side modal from the **Filters** button, with **Apply Filters** / **Clear
Filters**; each applied filter also renders as a removable chip above the table.

| Field (UI label) | Required? | Rules | Anchor |
|------------------|-----------|-------|--------|
| **Search** ("Search submissions, ID, authors, keywords, etc.") | no | Free text; matches title, abstract, keywords/subjects/disciplines, author names/ORCID, exact numeric submission ID, and DOIs (a phrase starting like a DOI prefix, e.g. `10.`, searches by DOI). Multiple words are OR'd (rule 9 ⚠). Cleared when switching views | Collector::searchPhrase() query build; DashboardControlSearch.vue |
| **Filters → Section** | no | One checkbox per journal section (multi-select = OR); hidden when the journal has only one section (live-probed on a scratch journal) | PKPSubmissionFilters::addSectionFields() |
| **Filters → Assigned To Editor** | no | Manager scope only; autosuggest over the journal's managers and section editors; narrows to submissions where a picked user holds an editorial stage assignment (live-probed) | PKPSubmissionFilters::addAssignedTo(); PKPBackendSubmissionsController::getMany() `assignedTo` |
| **Filters → Issues** | no | Issue picker (OJS-only field); hidden when the journal has no issues (live-probed on a scratch journal) | SubmissionFilters::addIssues() (OJS); Collector::filterByIssueIds() (OJS) |
| **Filters → Categories** | no | Category autosuggest + "Select Categories" browser; hidden when the journal has no categories (live-probed on a scratch journal) | PKPSubmissionFilters::addCategories() |
| **Filters → Days since last activity** | no | Slider 0–180; keeps only submissions whose last activity is *older* than the chosen number of days (live-probed: fresh submissions excluded at 30) | PKPSubmissionFilters::addDaysSinceLastActivity(); Collector::filterByDaysInactive() |

Different filters combine with AND; values within one filter combine with OR
(live-probed: section=Articles + assigned-to=dbuskins returned exactly the one
submission satisfying both; sections Articles+Reviews returned both sections'
submissions). The same panel (minus Assigned To Editor for non-managers) renders on
all three dashboard variants — including the reviewer dashboard, where none of it has
any effect (⚠ rule 11). <sup>a</sup>

<sup>a</sup> useFiltersForm.js (query-param assembly); getSubmissionCollector() param switch; live probes 2026-07-03

## Rules & state

1. **One machinery, three dashboards, role-gated at the door.** The same page
   (DashboardPage + DashboardTable) serves `/dashboard/editorial` (site
   admin/manager/section editor/assistant), `/dashboard/reviewAssignments` (reviewer
   only) and `/dashboard/mySubmissions` (author only; owned by `author-dashboard`).
   Each is a side-nav group — "Editor Dashboard", "My Assignments as Reviewer", "My
   Submissions as Author" — listing that dashboard's views with live counts; users
   holding several role families get several groups. The editorial group also carries
   the **Start A New Submission** link (removed when the journal disables submissions;
   ownership `submission-wizard`). Browser tab title is "Submissions". <sup>a</sup>
2. **The Editor Dashboard offers up to 15 views, in a fixed order.** For manager scope
   (live-probed as dbarnes and admin): Assigned to me · Active submissions · Needs
   editor · All in submission stage · Needs reviews · Awaiting reviews · Reviews
   submitted · Reviews overdue · Author revisions submitted · All in review stage · All
   in copyediting stage · All in production stage · Scheduled for publication ·
   Published · Declined. Section editors and assistants get 13 — the same list minus
   **Needs editor** and **Declined** (live-probed as dbuskins, minoue, mfritz). Landing
   without (or with an unknown) view in the URL falls back to the first view (Assigned
   to me); the current view id, search, filters and sort all live in the URL, so a
   copied URL reproduces the exact list state (live-probed). <sup>b</sup>
3. **View membership** (all views except Scheduled/Published/Declined are limited to
   queued — still-in-workflow — submissions):
   - *Assigned to me* — submissions where **I** hold an editorial stage assignment
     (this view is assignment-scoped even for managers).
   - *Active submissions* — every queued submission, **including incomplete drafts**
     (drafts semantics owned by `submission-drafts`).
   - *Needs editor* — rule 4.
   - *All in submission / review / copyediting / production stage* — by current stage.
   - *Needs reviews* — in review with fewer confirmed reviewers than the journal's
     "reviews per submission" target — which falls back to **1** (not 2) when the
     setting is 0/unset (`Context::REVIEWS_REQUIRED_COUNT`; live-probed on
     `publicknowledge` where the setting is 0: a submission with **1** confirmed
     review is *excluded* from Needs-reviews, proving the threshold is 1); *Awaiting
     reviews* — assigned reviews not yet submitted; *Reviews submitted* — at least
     one review submitted; *Reviews overdue* — a response or report deadline has
     passed **(a deadline due *today* already counts — the SQL cutoff is
     `< tomorrow`; live-probed: a review due today lands in Reviews overdue)**;
     *Author revisions submitted* — revisions uploaded and awaiting an editor's look.
   - *Scheduled for publication* — accepted and scheduled; *Published* — workflow
     finished (Done stage); *Declined* — declined at any stage.
   Live-probed 2026-07-03 by seeding one submission per bucket and checking each
   view's list *and* its nav count (the nav count and the table query take different
   code paths): every seeded item landed in exactly its bucket and each view's nav
   badge equalled its list total (needs-reviews 61/61, awaiting 55/55, reviews-
   submitted 21/21, reviews-overdue 1/1, revisions-submitted 2/2, declined 21/21,
   scheduled 22/22, published 21/21, needs-editor 57/57). A submission that has moved
   to copyediting drops out of every review view (all review buckets are stage-gated
   to the review stages), so a review-then-copyediting history is bucketed by
   *current* stage only. One view type in the shared registry (`review-all`) is
   OMP-only and never appears in OJS. <sup>c</sup>
4. **"Needs editor" = submitted, and nobody with decision authority is assigned.** A
   submission counts as needing an editor while it has no manager or section-editor
   stage assignment — an assigned *assistant* does not clear it (live-probed: an
   assistant-only submission still listed). Incomplete drafts never appear (only
   actually-submitted items count; live-probed). Its rows prompt **Assign Editor**
   right in the activity cell (opens the participant manager, owned by
   `stage-participants`). Manager scope only (rule 2). <sup>d</sup>
5. **Scoping: managers see the journal, everyone else sees their assignments.** For
   manager scope, every view (except Assigned to me) queries the whole journal. For
   assigned scope every view is additionally restricted to "assigned to me in an
   editorial role", making their *Active submissions* identical to *Assigned to me*
   (live-probed 2026-07-03: identical counts — dbuskins 117/117, mfritz 8/8 — Open
   question 2), and their search
   can never surface an unassigned submission (live-probed). The API enforces the same
   split, not just the UI: the journal-wide list endpoint is manager/site-admin-only
   (others get 401), everyone else is served by self-scoped endpoints. <sup>e</sup>
6. **Counts are live, and the heading follows the filters.** The side-nav badges come
   from one counts call per nav group and always reflect each view's *full*
   membership; the page heading "{View name} ({count})" follows the fetched list, so
   it drops to the filtered/searched total (live-probed: heading fell from 207 to 194
   with a section filter on while the nav badge kept the full count). Nav counts
   refresh (throttled) after list-mutating actions.
   The reviewer nav marks the attention views (Action Required by me; on the editorial
   side Reviews overdue) with a highlighted badge. <sup>f</sup>
7. **The editorial table is six columns; the reviewer table four.** Editorial: ID
   (sortable) · Submissions (author short-string — title) · Stage (effective state
   label: Incomplete, Submission, Review (Round N), Copyediting, Production,
   Scheduled, Published, Declined) · Days (sortable; days since last activity) ·
   Editorial Activity · Actions. Reviewer: ID (the *submission's* id) · Submissions
   (title) · Editorial Activity · Actions — no Stage/Days. 30 rows per page with a
   numbered pager ("Showing X to Y of Z"). Sorting cycles descending → ascending → off
   per click, is recorded in the URL, re-queries server-side, and — unlike search and
   filters — survives switching views (live-probed). <sup>g</sup>
8. **The Editorial-Activity cell tells the editor what the submission is waiting for,
   and flags conflicts of interest.** Editorial variant, by state (each live-probed
   2026-07-03 by seeding the state and reading the rendered cell): no editor assigned →
   **Assign Editor** action (rule 4); review round pending reviewers → **Assign
   Reviewers** action; otherwise in review → per-reviewer activity indicators (with a
   details popover) and/or round-status notices — "Revisions requested from author",
   "Revisions submitted", the reviews-completed alert ("All reviews are confirmed and a
   decision is needed."), the minimum-reviews alert ("Minimum required number of reviews
   have been confirmed. A decision is needed."), and the recommend-only trio: a
   *recommending* editor sees "Recommending Editors are tasked to advise…" before
   recommending and "Recommendation has been made by you." after, while the *deciding*
   editor sees "…advise…" then "All editorial recommendations have been received, and a
   decision is required." (all live-probed on submission 485 by toggling the
   recommendation); copyediting → "Copyedited Files Uploaded: N"; scheduled → "To be
   published in issue {issue}"; declined → "Declined during the {stage} stage.";
   incomplete draft → **Complete submission** action. **Conflict guards**: when the
   viewer's only tie to the row is being its *author*, the cell instead says "You
   cannot access this submission as a Journal Manager since you are the author. To
   view it, go to \"My Submissions\"" and the View button is withheld; symmetrically
   for being its *reviewer* ("…since you are the reviewer. To view it, go to \"Review
   Assignments\""; both live-probed 2026-07-03 on `j-eddprobej2` with a manager+author
   row and a manager+reviewer row). **The guard is enrolment-gated, not
   assignment-gated** (⚠ Known deviations): it fires only when the viewer holds a live
   *enrolment* in the Author (or Reviewer) role, so a manager who authored a submission
   without ever being enrolled as an Author sees a **normal** View + activity cell, not
   the notice. <sup>h</sup>
9. **Search is one box, many fields, OR semantics.** Matches per rule in Fields;
   numeric words also match the submission ID exactly (live-probed: searching "338"
   returned exactly that submission). ⚠ Multiple words are OR'd across all fields —
   "speceddash zzzznotexist" still returns every "speceddash" match (live-probed), so
   multi-word phrases *widen* rather than narrow results — pre-existing ledger finding
   (e2e ledger §2 row 5), stated once here. A phrase from which no keywords can be
   extracted returns an empty list. Searching, filtering or switching pages never
   changes the view; switching views clears search and filters, resets to page 1 and
   keeps the sort (live-probed). <sup>i</sup>
10. **The View action opens the workflow side panel; the URL is shareable state.**
    Clicking View records `workflowSubmissionId` (and the selected pane,
    `workflowMenuKey`) in the query string on top of the current view/search/filter
    state; closing the panel strips them and re-fetches the list, preserving the list
    state (live-probed round-trip). The panel itself — stage navigation, decisions,
    participants — is owned by `workflow-stage-navigation` and the stage/decision
    specs. <sup>j</sup>
11. **The reviewer dashboard buckets the reviewer's own assignments into six views:**
    Action Required by me (response or report still owed on a live round) · All
    assignments (not declined/cancelled, and either the submission is still in review
    or the review was completed and the submission is not yet published) · Completed
    (review submitted, submission still unpublished) · Declined · Published (review
    submitted and the submission got published) · Archived (review never finished and
    the submission moved on to copyediting/production). Live-probed as jjanssen
    (30/42/12/0/0/0). Each row's activity cell narrates the state with its deadline —
    "Please accept or decline this request by {date}", response/report overdue
    notices, "Review submitted on {date}", declined-on date — and the action button
    matches: **Respond to request** (awaiting response / response overdue / resend
    requested), **Finish review** (accepted / report overdue), **View** (completed),
    none for declined or for unfinished reviews whose submission moved past review.
    All actions open the reviewer response page (`reviewer-response`). ⚠ The page
    renders the standard search box, Filters panel, ID-sort control and pager, but the
    reviewer endpoint ignores every one of those parameters: the full list always
    renders on one page (42 rows shown while the pager claims "1 to 30 of 42" and
    page 2 shows the same rows; search/filter/sort leave the list untouched —
    live-probed each). Known deviations. <sup>k</sup>
12. **Legacy URLs collapse into the dashboards.** `/{journal}/submissions` and
    `/{journal}/dashboard` (also its `index` op) redirect by role priority: editorial
    role → Editor Dashboard; else reviewer → reviewer dashboard; else author → My
    Submissions (all live-probed per role); a user with no role beyond reader is sent
    to the journal home page, and with no journal context to the site index. Login
    lands on the same target (live-probed). ⚠ The legacy `submissions/tasks` op — the
    old header tasks popup — still routes but crashes (HTTP 500) because its template
    was deleted; the other four legacy list ops (`myQueue`, `unassigned`, `active`,
    `archives`) are role-assigned but have no implementation and 404 (all
    live-probed). Known deviations. <sup>l</sup>

<sup>a</sup> pages/dashboard/index.php (op → DashboardPage enum); PKPTemplateManager::setupBackendPage() (nav groups, newSubmission item, `disableSubmissions`); dashboardPageStore (TitleTranslations); PKPDashboardHandler::index() (`pageTitle` navigation.submissions) ·
<sup>b</sup> DashboardView::getTypes() (constant order); Repository::mapDashboardViews() + filterViewsByUserRoles(); dashboardPageStore `currentViewId` fallback; useQueryParams; live probes 2026-07-03 ·
<sup>c</sup> Repository::mapDashboardViews() (per-type collectors: STATUS_QUEUED, stage ids, `filterByNumReviewsConfirmedLimit` w/ `Context::REVIEWS_REQUIRED_COUNT` default, `filterByAwaitingReviews`, `filterByReviewsSubmitted`, `filterByReviewsOverdue`, `filterByRevisionsSubmitted`, STATUS_SCHEDULED, WORKFLOW_STAGE_ID_DONE, STATUS_DECLINED; TYPE_REVIEW_ALL has no OJS case → filtered out); live probes 2026-07-03 ·
<sup>d</sup> Collector::filterByisUnassigned() (`date_submitted` NOT NULL + zero manager/sub-editor assignments); useDashboardConfigEditorialActivity (PARTICIPANT_ASSIGN alert); live probes 2026-07-03 ·
<sup>e</sup> Repository::getDashboardViews() (`$canAccessUnassignedSubmission`); mapDashboardViews() (`assignedTo($user, $selectedRoleIds)` on non-manager branches); PKPBackendSubmissionsController::getGroupRoutes() (getMany → SITE_ADMIN/MANAGER; assigned/reviews → self-scoped); live probes 2026-07-03 (dbuskins/mfritz `GET _submissions` 401; viewsCount 70/70, 1/1) ·
<sup>f</sup> PKPBackendSubmissionsController::getViewsCount(); SideNav.vue (per-group viewsCount fetch, `ViewsWithAttentionBadge`); appStore.triggerReloadViewsCount() (throttle); DashboardPage.vue heading (`submissionsPagination.itemCount`); live probes 2026-07-03 ·
<sup>g</sup> useDashboardConfig.getColumns() (per-dashboard columns); DashboardCellSubmissionDays.vue (`dateLastActivity` → days); useSubmission.getExtendedStage(); DashboardCellReviewAssignmentId.vue (`item.submissionId`); PKPDashboardHandler `$perPage = 30`; useSorting (cycle + URL); getSubmissionCollector() `orderBy` whitelist; live probes 2026-07-03 ·
<sup>h</sup> useDashboardConfigEditorialActivity.getEditorialActivityForEditorialDashboard() (author/reviewer guards → `dashboard.noAccessBeingAuthor`/`noAccessBeingReviewer`; per-round-status branches; `checkMinimumConsideredReviews`); useCurrentUser.hasCurrentUserAtLeastOneAssignedRoleInAnyStage() (reads `submission.stages[].currentUserAssignedRoles`); maps/Schema.php getPropertyStages()/getAssignmentRoles() (assignment role resolved via `userUserGroups` — enrolment-gated → the row-69 nuance); ReviewActivityIndicatorPopover.vue; DashboardCellSubmissionActions.vue `showButton` (same guard); live probes 2026-07-03 (dbarnes author-of 343/344 → normal View; eddpmgr1 enrolled-author 353 / manager+reviewer 354 → both guards fire) ·
<sup>i</sup> Collector::searchPhrase() (keyword OR-mapping, `ctype_digit` → ID, DOI-prefix branch, `1 = 0` fallback); dashboardPageStore (view-switch watcher: `clearFiltersForm` + `resetSearchPhrase` + page 1; sort watcher independent); live probes 2026-07-03 ·
<sup>j</sup> dashboardPageStore.openWorkflowModal() (query params, onClose refetch); live probe 2026-07-03 ·
<sup>k</sup> Repository::mapDashboardViews() (reviewer types → reviewAssignment Collector: filterByActionRequiredByReviewer/Active/Completed/Published/IsArchived/Declined, `filterByReviewerIds($user, true)`); useDashboardConfigEditorialActivity.getEditorialActivityForMyReviewAssignments(); DashboardCellReviewAssignmentActions.vue; PKPBackendSubmissionsController::getReviewAssignments() (no searchPhrase/pagination/orderBy/filter params); live probes 2026-07-03 ·
<sup>l</sup> lib/pkp/pages/submissions/index.php (`index`/`tasks` only); PKP\pages\dashboard\DashboardHandler::index() → PKPPageRouter::redirectHome()/getHomeUrl() (role priority); DashboardHandler::tasks() (`dashboard/tasks.tpl` — template absent from the tree); PKPDashboardHandler::authorize() (null `dashboardPage` → redirectHome); live probes 2026-07-03

## Side effects

None. The dashboards are read surfaces: browsing, searching, filtering, sorting,
paging and opening/closing the workflow panel send no emails, raise no notifications,
write no event-log entries and queue no jobs. Every mutation reachable *from* here —
assigning an editor or reviewer, uploading files, deleting drafts, recording decisions
— belongs to its owning spec; the dashboard's part is only to re-fetch the list and
counts afterwards. <sup>a</sup>

<sup>a</sup> dashboardPageStore (fetch/refetch + `triggerReloadViewsCount` only)

## Settings that modify behavior

- **Don't accept submissions** (Settings → Workflow, `disableSubmissions`): removes
  **Start A New Submission** from the nav group; the dashboards stay.
- **Journal structure**: a single-section journal hides the Section filter; no issues
  hides the Issues filter; no categories hides the Categories filter (all live-probed
  on a scratch journal — a manager there sees only Assigned To Editor + Days since
  last activity).
- **Reviews per submission required** (Settings → Workflow → Review,
  `numReviewsPerSubmission`; schema default **0**): a non-zero value sets the
  threshold for the **Needs reviews** view *and* enables the "minimum reviews
  confirmed, decision needed" activity alert. When the setting is 0/unset the
  Needs-reviews view still applies a hard-coded fallback threshold of **1**
  (`Context::REVIEWS_REQUIRED_COUNT`), while the minimum-reviews alert stays off
  (Open question 4).
- **Journal sections/issues/categories content** changes filter *options*; user
  enrolments change the Assigned-To-Editor picker (managers + section editors).
- No setting hides the dashboards themselves; which of the three a user gets is purely
  role enrolment. <sup>a</sup>

<sup>a</sup> PKPTemplateManager::setupBackendPage(); SubmissionFilters/PKPSubmissionFilters constructors; Context::getNumReviewsPerSubmission(); live probes 2026-07-03

## Cross-feature interactions

- **author-dashboard** — owns `/dashboard/mySubmissions` (the third variant of this
  machinery) and everything author-facing; this spec owns the shared machinery itself.
- **submission-drafts** — owns draft semantics on these lists (Incomplete stage label,
  Complete-submission action, the manager Active-view drafts, More Actions →
  bulk-delete, and the `_submissions` DELETE endpoints).
- **workflow-stage-navigation** — owns the workflow side panel the View action opens.
- **stage-participants** — owns the Assign-Editor flow (participant manager) launched
  from Needs-editor rows.
- **reviewer-assignment** — owns the Assign-Reviewers flow and the per-reviewer
  statuses the review activity indicators summarize.
- **reviewer-response** — owns the reviewer page every reviewer-dashboard action
  opens.
- **editorial-decisions / review-rounds-revisions / copyediting-stage /
  production-stage** — own the states the Stage and Editorial-Activity cells narrate.
- **recommend-only-editors** — owns the recommend-vs-decide semantics behind the
  recommendation-flavoured activity alerts.
- **issue-assignment-scheduling** — owns scheduling; this page only shows "To be
  published in issue …" and the Scheduled view.
- **usage-statistics** — owns the *statistics* editorial-activity page
  (`/stats/editorial`); despite the similar name it is not part of this dashboard.

## Canonical scenarios

1. **Manager's morning triage** — dbarnes (manager-level editor) opens
   `/dashboard/editorial`: the Editor Dashboard nav group lists 15 views with counts,
   the page lands on Assigned to me with the six-column table, Filters/More
   Actions/Search controls, and a View button per row.
2. **Scoped roles see only their desk** — dbuskins (section editor) and mfritz
   (assistant) get 13 views (no Needs editor, no Declined), every view restricted to
   submissions they're assigned to; a seeded unassigned submission is invisible to
   them even by direct search, while a manager finds it.
3. **Needs-editor triage** — a submission arrives with no editor (or only an assistant)
   assigned: it appears in the manager's Needs editor view with an **Assign Editor**
   action in the row; an incomplete draft does not appear; assigning a section editor
   clears it from the view.
4. **State views bucket correctly** — one submission per state (submission stage, in
   review, copyediting, production, scheduled, published, declined): each appears in
   exactly its matching view with the right Stage label, and the declined one is only
   reachable by manager scope.
5. **Search: unique token and ID** — searching a unique title token narrows the list
   to the seeded submission; searching its numeric ID finds it; switching views clears
   the search.
6. **Filters combine and travel in the URL** — manager applies Section=Articles +
   Assigned To Editor=dbuskins + Days-since-activity: chips render per filter, the
   heading count drops, only rows satisfying ALL filters remain, and reloading the
   copied URL reproduces the state; Clear Filters restores the view.
7. **Row → workflow panel round-trip** — clicking View pushes `workflowSubmissionId`
   into the URL and opens the workflow side panel; closing it returns to the same
   view, search and filters, with the list re-fetched.
8. **Conflict-of-interest guard** — a manager who is the *author* of a listed
   submission sees "You cannot access this submission as a Journal Manager since you
   are the author…" instead of actions (no View button); a manager who is its
   *reviewer* sees the reviewer twin of the notice.
9. **Reviewer buckets and acts on assignments** — jjanssen opens
   `/dashboard/reviewAssignments`: six views with counts; an invited assignment sits
   in Action Required with "Please accept or decline this request by {date}" and
   **Respond to request**; an accepted one shows **Finish review**; a completed one
   shows **View**; each button lands on the reviewer response page.
10. **Role gating and legacy doors** — atester (author) and jjanssen (reviewer) are
    refused `/dashboard/editorial`; dbarnes and admin are refused
    `/dashboard/reviewAssignments`; `/submissions` (and `/dashboard`) 302s each user
    to their own dashboard; anonymous hits are sent to login and return after.
11. **Sort and pagination** — clicking ID sorts descending, again ascending (URL
    records it, order changes server-side); the Days column sorts by last activity;
    lists over 30 rows page with Previous/Next and the sort survives a view switch.

## Known deviations (as-built ≠ intent)

- ⚠ **The reviewer dashboard's list controls are scenery**: search, the entire Filters
  panel, ID-sort and the pager all render but do nothing — the reviewer-assignments
  endpoint ignores every list parameter and always returns the full set; the client
  renders all rows on one page while the pager claims 30-per-page slices (live-probed,
  rule 11). Extends e2e ledger §2 row 2 (which recorded the search/pagination half) —
  full affordance inventory appended as ledger §2 row 68. Suspected intent: the shared
  DashboardPage controls were mounted wholesale; the endpoint was never wired for them.
- ⚠ **Legacy `submissions/tasks` crashes (500)**: the op is still routed and
  role-assigned but its template (`dashboard/tasks.tpl`) no longer exists; four sibling
  ops (`myQueue`/`unassigned`/`active`/`archives`) are role-assigned with no
  implementation (404). Dead legacy surface that should be deleted — appended as e2e
  ledger §2 row 67 (rule 12).
- ⚠ **Multi-word search widens results** (OR across words and fields) — pre-existing
  ledger finding, e2e ledger §2 row 5; restated in rule 9 because the dashboard search
  box is its main victim (live-re-probed 2026-07-03: `edverif zzzznotexist` returned
  all 8 `edverif` rows, identical to the single-token search).
- ⚠ **The conflict-of-interest guard is enrolment-gated, so it silently fails for a
  manager who authored a submission without an Author enrolment**: the "you cannot
  access this as a Journal Manager since you are the author/reviewer" cell + withheld
  View is driven by `hasCurrentUserAtLeastOneAssignedRoleInAnyStage(…, [AUTHOR])`, which
  reads `submission.stages[].currentUserAssignedRoles` — and `getAssignmentRoles()`
  resolves a stage assignment's role through the viewer's *live `user_user_groups`
  enrolment*, returning `null` when the viewer holds the stage assignment but no active
  enrolment in that role's group. So a manager who is the submission's **author by stage
  assignment but was never enrolled as an Author** (e.g. seeded via SQL, or assigned as
  a participant in a role they don't hold) is shown a **normal** View button and the
  ordinary activity cell — the guard meant to keep them out of their own authored
  submission never fires. Live-probed 2026-07-03: dbarnes (author stage assignment on
  submissions 343/344, manager-only enrolment) saw "Assign Editor / **View**", no COI
  notice; contrast eddpmgr1 on `j-eddprobej2` (enrolled Author) whose row 353 correctly
  showed the notice with View withheld. Contradicts the UI-affordance promise the guard
  exists to make — e2e ledger §2 row 69. Suspected intent: the guard should key on the
  stage assignment's role, not on a separate enrolment.

## Open questions

1. Section editors and assistants have **no Declined view and no other dashboard route
   to a declined submission** — every one of their views filters to queued (or
   scheduled/published) submissions, so a submission they handled disappears from the
   dashboard the moment it is declined. The restriction is purely the missing *view*:
   URL-forcing `currentViewId=declined` silently falls back to their first view
   (live-probed: dbuskins → "Assigned to me"), but the self-scoped list endpoint still
   returns their own declined submissions if a `status=4` param is hand-crafted
   (live-probed: dbuskins `GET _submissions/assigned?status[]=4` → 20 rows) — so this is
   a UI omission, not an API scope boundary. Intended privacy/scope choice, or should
   assigned users keep a Declined view?
2. For section editors and assistants, **Active submissions ≡ Assigned to me** (same
   query, live-probed identical counts: dbuskins 117/117, mfritz 8/8). Is the duplicate
   view intended (parallel naming with the manager view set), or should Active be hidden
   for scoped roles?
3. The **Assigned To Editor picker** (users API filtered to managers + section
   editors) also offers the site `admin` account, which holds neither journal role
   (live-probed). Users-API role-filter quirk worth confirming (user-management
   territory, surfaced here).
4. The **Needs reviews** threshold uses the journal's `numReviewsPerSubmission` with a
   hard-coded fallback of **1** (`REVIEWS_REQUIRED_COUNT`) when the setting is 0/unset;
   the "minimum reviews" activity alert reads the *raw* setting and only appears when
   it is non-zero. Two different readings of the same setting (view falls back to 1;
   alert treats 0 as off) — intended?
5. `_submissions/viewsCount` accepts any dashboard role including reviewers, and the
   response is keyed by view id computed server-side from `assignedWithRoles` — the
   SideNav sends one call per nav group. Fine as-built; flagging only that the counts
   endpoint is the single place all three dashboards' role logic meets, useful for the
   round-2 crosswalk.
6. **Grooming — dashboard-adjacent atoms deliberately NOT claimed here** (recorded so a
   groomer sees they were considered, not missed): `API-stats-editorial-get`/`-averages`
   and `PAGE-stats-editorial` carry a stale `editorial-dashboards.md` *hint* in the
   atlas but belong to **usage-statistics** (the `/stats/editorial` page, disowned in
   Cross-feature interactions). `NOTIF-approve-submission`, `NOTIF-visit-catalog`,
   `NOTIF-editorial-report`, `NOTIF-format-needs-approved-submission` hint at legacy
   "requires attention"/tasks panels that the 3.6 dashboard no longer renders — they
   belong to a notifications/tasks spec (this page raises no notifications, Side
   effects). `VUE-side-nav` (SideNav.vue) is the *app-wide* backend left-nav shell used
   by every backend page; this spec uses its per-group viewsCount fetch and attention
   badges (rule 6) but does not claim the global chrome — leave for a backend-navigation
   spec rather than force-fit. All four groups remain unclaimed in the atlas by design.

---

## Reference — entry points & surfaces

| Entry | Path | Atom |
|-------|------|------|
| Editor Dashboard | `/{journal}/dashboard/editorial` (+ `currentViewId`, `searchPhrase`, filter params, `sortColumn`/`sortDirection`, `workflowSubmissionId`/`workflowMenuKey` query state) | PAGE-dashboard-editorial |
| Reviewer dashboard | `/{journal}/dashboard/reviewAssignments` (+ same query-state family) | PAGE-dashboard-reviewassignments |
| Dashboard index (no variant) | `/{journal}/dashboard` → 302 by role priority | PAGE-dashboard-index |
| Legacy submissions page | `/{journal}/submissions` → 302 by role priority | PAGE-submissions-index |
| Legacy tasks popup | `/{journal}/submissions/tasks` → HTTP 500 (dead; Known deviations) | PAGE-submissions-tasks |
| Page shell | DashboardPage.vue + dashboardPageStore (views/search/filters/sort/modal state) | VUE-dashboard-page |
| Table | DashboardTable.vue + DashboardCell* components | VUE-dashboard-table |
| Filters form | OJS SubmissionFilters (adds Issues) over PKPSubmissionFilters | FORM-submission-filters, FORM-pkp-submission-filters |
| Journal-wide list (manager views, Needs editor, assignedTo filter) | `GET api/v1/_submissions` | API-backend-submissions-get-many |
| Self-scoped list (Assigned to me; all scoped-role views; author views) | `GET api/v1/_submissions/assigned` | API-backend-submissions-assigned |
| Review-state views | `GET api/v1/_submissions/reviews` (+ needsReviews/awaitingReviews/reviewsSubmitted/reviewsOverdue/revisionsRequested/revisionsSubmitted) | API-backend-submissions-reviews |
| View counts (all three nav groups) | `GET api/v1/_submissions/viewsCount?assignedWithRoles[]=…` | API-backend-submissions-get-views-count |
| Reviewer's assignments | `GET api/v1/_submissions/reviewerAssignments` (+ actionRequired/active/completed/published/archived/declined) | API-backend-submissions-get-review-assignments |
| View names & dashboard strings | `submission.dashboard.*` (view titles), `dashboard.reviewAssignment.*` (reviewer activity texts) | LOC-submission-submission-dashboard, LOC-submission-dashboard-reviewAssignment |

## Reference — code anchors

- lib/pkp/pages/dashboard/PKPDashboardHandler.php (`DashboardPage` enum, role
  assignments, `getViews`, `$perPage`, pageInitConfig incl. `filtersForm`/`views`);
  pages/dashboard/DashboardHandler.php (OJS `setupIndex` extras,
  `getSubmissionFiltersForm`); pages/dashboard/index.php (op routing)
- lib/pkp/pages/dashboard/DashboardHandler.php + lib/pkp/pages/submissions/index.php —
  the LEGACY `submissions` page (redirect + dead `tasks`); distinct class from the
  handler above despite the name
- lib/pkp/classes/core/PKPPageRouter.php (`getHomeUrl`/`redirectHome` role priority)
- lib/pkp/classes/submission/Repository.php (`getDashboardViews`,
  `mapDashboardViews`, `filterViewsByUserRoles`, `setViewsCount`);
  lib/pkp/classes/submission/DashboardView.php (types/order/`getData`)
- lib/pkp/classes/submission/Collector.php (`searchPhrase`, `filterByisUnassigned`,
  `filterByDaysInactive`, `assignedTo`, review-state filters, orderBy);
  classes/submission/Collector.php (OJS `filterByIssueIds`/`filterBySectionIds`);
  lib/pkp/classes/submission/reviewAssignment/Collector.php (reviewer view filters)
- lib/pkp/api/v1/_submissions/PKPBackendSubmissionsController.php (routes, role
  middleware, `getSubmissionCollector` param whitelist);
  api/v1/_submissions/BackendSubmissionsController.php (OJS: issue/section params,
  payment route — payments spec)
- lib/pkp/classes/components/forms/dashboard/PKPSubmissionFilters.php +
  classes/components/forms/dashboard/SubmissionFilters.php (filter fields + gating)
- lib/ui-library/src/pages/dashboard/: DashboardPage.vue, dashboardPageStore.js,
  useDashboardConfig.js (columns/controls), useDashboardConfigEditorialActivity.js
  (activity cells ×3 variants), useDashboardConfigReviewActivity.js +
  ReviewActivityIndicatorPopover (review indicators),
  components/DashboardTable/* (cells), modals/DashboardModalFilters.vue
- lib/ui-library/src/components/SideNav/SideNav.vue (view counts, attention badges);
  lib/pkp/classes/template/PKPTemplateManager.php (`setupBackendPage` nav groups)
