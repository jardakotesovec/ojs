---
name: editorial-dashboards
scope: The editor's and reviewer's dashboards — role-scoped submission lists ("views") with counts, filters, search, sorting and per-row triage summaries — plus the shared list machinery all three dashboards run on
shared: pkp-lib
status: verified
atlas-claims:
  - PAGE-dashboard-index
  - PAGE-dashboard-editorial
  - PAGE-dashboard-reviewassignments
  - PAGE-submissions-index
  - PAGE-submissions-tasks
  - VUE-dashboard-page
  - VUE-dashboard-table
  - FORM-submission-filters
  - API-backend-submissions-get-many
  - API-backend-submissions-assigned
  - API-backend-submissions-reviews
  - API-backend-submissions-get-views-count
  - API-backend-submissions-get-review-assignments
  - FORM-pkp-submission-filters
  - LOC-submission-dashboard-reviewAssignment
  - LOC-submission-submission-dashboard
---

# Editorial dashboards (editor & reviewer submission lists)

## Purpose

Journal Managers and Section Editors live in lists: what just arrived, what has no editor, what is
stuck waiting on reviews, what is ready to publish. The 3.6 dashboards give each role
a home page of **views** — named, pre-filtered submission lists ("Active submissions",
"Needs editor", "Reviews overdue", …) listed in the left navigation with a live count
beside each — over one shared table with a search box, a Filters panel, sortable
columns and paging. There are three dashboards, one per hat the user wears in the
journal: the **Editor Dashboard** (Site Administrators, Journal Managers, Section
Editors, Assistants — journal-wide triage), **My Assignments as Reviewer** (a
reviewer's own review requests and history), and **My Submissions as Author** (owned
by the author-dashboard spec; it reuses everything described here). Each row
summarizes where the submission stands and, where a next step is obvious, offers it
right in the list ("Assign Editor", "Assign Reviewers", "Respond to request"); the
row's **View** button opens the submission's workflow in a panel over the list. This
spec owns the two editor/reviewer pages and the shared list machinery — views,
counts, filters, search, sorting, paging, deep links.

## Actors & permissions

Terms: *editorial capacity* = participating on a submission as a Journal Manager,
Section Editor or Assistant (an author or reviewer tie to the same submission does
not count); *scoped* = a list limited to submissions where the user has an
editorial-capacity assignment; *variant* = the final part of a dashboard's web
address, which names the dashboard being shown — it is visible in the browser bar
whenever a dashboard is open, so an address to type can always be copied from a
session that has the page; the *bare* dashboard address is that same address with
the final naming part cut off, reached only by hand-editing the address.
Baselines: **anonymous visitors** are sent to login by
every *named* surface here — ⚠ the one exception is the bare dashboard address that
names no variant, which crashes to an empty error page instead of asking for login
(Known deviations); a **Reader-only** account has none of these navigation sections;
all roles are the journal's own — each journal has its own dashboards. A **Site
Administrator enrolled as Journal Manager** (the normal state — creating a journal
auto-enrols the creator) acts as a manager below; ⚠ an admin with *no* enrolment in
the journal reaches only a degraded, viewless page — and only by typing the address,
since logging in sends them to the journal's public homepage (Known
deviations). <sup>a</sup>

| Action | Who may — and when |
|--------|--------------------|
| **Open the Editor Dashboard** | • Site Administrator, Journal Manager, Section Editor, Assistant — the "Editor Dashboard" section appears in the left navigation<br>• Everyone else — no navigation section; typing the address is turned away to a page in the journal's public look reading "The current role does not have access to this operation.", never an error screen <sup>b</sup> |
| **Open My Assignments as Reviewer** | • Reviewer-role holders only — there is no editor-facing variant of this page; a Journal Manager or Section Editor without the Reviewer role has neither the navigation section nor access by address <sup>c</sup> |
| **See the whole journal in a view** | • Site Administrator, Journal Manager — their views list every matching submission, assigned or not<br>• Section Editor, Assistant — every view is scoped to their own editorial-capacity assignments<br>• ⚠ a Section Editor or Assistant who is *also* a Site Administrator gets journal-wide rows in the five review-state views while their sidebar counts stay scoped (Known deviations) <sup>d</sup> |
| **Use the "Needs editor" view** | • Site Administrator, Journal Manager only — other roles never see it in the view list <sup>e</sup> |
| **Filter by "Assigned To Editor"** | • Site Administrator, Journal Manager — the field appears in their Filters panel<br>• Section Editor, Assistant — no such field<br>• ⚠ works only on some views (Known deviations) <sup>f</sup> |
| **Open a row's workflow ("View")** | • Anyone whose row it is — except when the person's only tie to that submission is as its author or reviewer: then the button is hidden and the row explains where to go instead (rule 15)<br>• Incomplete-submission rows have no View button (drafts spec) <sup>g</sup> |
| **Act from a row's Editorial Activity cell** ("Assign Editor", "Assign Reviewers", review indicators) | • The same people who could take that action inside the workflow — the cell is a shortcut, not an extra permission; mechanics belong to the stage-participants and assign-and-manage-reviewers features <sup>h</sup> |
| **Bulk-delete incomplete submissions** | • Site Administrator, Journal Manager — a "More Actions" (…) menu on the Editor Dashboard offers "Delete Incomplete Submissions" (disabled while the current list has no deletable rows); the author-side variant and the deletion rules are the drafts spec's <sup>i</sup> |
| **Act on a reviewer row** ("Respond to request", "Finish review", "View") | • The reviewer themselves — each row is one of their own review assignments; the buttons lead to their review pages, never into the editorial workflow <sup>j</sup> |

<sup>a</sup> PKPSiteAccessPolicy; PKPContextService::add() (creator auto-enrol); RoleDAO::getByUserId() (journal-scoped role resolution); unenrolled-admin edge live-probed 2026-07-16 (minted context-NULL admin; degraded page, details in Known deviations) ·
<sup>b</sup> PKPDashboardHandler::__construct() addRoleAssignment([SITE_ADMIN, MANAGER, SUB_EDITOR, ASSISTANT], ['editorial']); PKPTemplateManager::setupBackendPage() (menu['dashboards']); live-probed 2026-07-16 (reviewer-only + author-only → redirect to user/authorizationDenied in public chrome, no console errors) ·
<sup>c</sup> PKPDashboardHandler::__construct() addRoleAssignment(REVIEWER, ['reviewAssignments']); atlas PAGE-dashboard-reviewassignments (reviewer-only, verified 2026-07-03); live-probed 2026-07-16 (Journal Manager + Section Editor without Reviewer role: denied by address, no nav section); API-level denial verified 2026-07-16 (the reviewer-assignments list op refuses manager and author accounts; reviewer baseline serves only their own assignments) ·
<sup>d</sup> Repository::getDashboardViews() ($canAccessUnassignedSubmission = SITE_ADMIN|MANAGER); Repository::mapDashboardViews() (per-view assignedTo fallback); live-probed 2026-07-16 (scoped Section Editor's search cannot match out-of-scope rows; manager lists journal-wide); API-level denials verified 2026-07-16 (journal-wide list op denied to SE/Assistant/reviewer/author; scope-widening params assignedTo/isUnassigned ignored on the self-scoped ops); hybrid admin+SE leak live-probed 2026-07-16 (reviews() skips self-scoping via canAccessAllSubmissions(), which counts site-level SITE_ADMIN — Known deviations, ledger row 208) ·
<sup>e</sup> Repository::mapDashboardViews() TYPE_NEEDS_EDITOR roles [SITE_ADMIN, MANAGER]; live-probed 2026-07-16, view count corrected by test run 2026-07-16 (manager nav: 15 views incl. Needs editor + Declined; Section Editor: 13, without either) ·
<sup>f</sup> PKPSubmissionFilters::addAssignedTo() (isManagerOrAdmin gate); PKPBackendSubmissionsController::getMany() ('assignedTo' param mapped only here); live-probed 2026-07-16 (field absent from Section Editor and Reviewer panels; inert-view detail in Known deviations) ·
<sup>g</sup> DashboardCellSubmissionActions.vue (showButton; suppressed for author/reviewer-only ties on EDITORIAL_DASHBOARD, and when submissionProgress is set) ·
<sup>h</sup> useDashboardConfigEditorialActivity.js getEditorialActivityForEditorialDashboard(); useParticipantManagerActions(); useReviewerManagerActions() ·
<sup>i</sup> useDashboardBulkDelete.js bulkDeleteIsAvailableForUser; DashboardControlBulkActions.vue ·
<sup>j</sup> DashboardCellReviewAssignmentActions.vue; dashboardPageStore.js openReviewerForm(); live-probed 2026-07-16 (all five states; every button is a plain navigation to reviewer/submission/{id}, never a workflow modal)

## Fields & validation

The dashboards take no data entry; their inputs are list controls. The **search box**
(top right, labelled "Search submissions, ID, authors, keywords, etc.") narrows the
current view as a phrase is typed (semantics in rule 9). The **"Filters" button** (top
left) opens a side panel titled "Filters"; every filter is optional and each is
offered only when the journal has something to filter by:

| Field (UI label) | Required? | Rules |
|------------------|-----------|-------|
| **Section** | No | Checkbox per journal section; hidden when the journal has only one section <sup>a</sup> |
| **Assigned To Editor** | No | Pick one or more people from the journal's managers and section editors; only Site Administrators and Journal Managers get this field <sup>b</sup> |
| **Issues** | No | Pick one or more issues; hidden when the journal has no issues yet (this journal-format filter is the OJS-specific piece of the panel) <sup>c</sup> |
| **Categories** | No | Pick from the journal's category tree; hidden when no categories exist <sup>d</sup> |
| **Days since last activity** | No | A slider from 0 to 180; at N it keeps only submissions untouched for more than N days; 0 means off <sup>e</sup> |

<sup>a</sup> PKPSubmissionFilters::addSectionFields(); panel composition live-probed 2026-07-16 (Section/Issues/Categories/Days rendered, incl. on the reviewer dashboard) ·
<sup>b</sup> PKPSubmissionFilters::addAssignedTo() (FieldSelectUsers over roleIds MANAGER, SUB_EDITOR); live-probed 2026-07-16 (manager sees it; Section Editor and Reviewer panels do not) ·
<sup>c</sup> SubmissionFilters::addIssues() (OJS override; FieldSelectIssues, hidden when no issue exists) ·
<sup>d</sup> PKPSubmissionFilters::addCategories() ·
<sup>e</sup> PKPSubmissionFilters::addDaysSinceLastActivity() (FieldSlider 0–180)

## Rules & state

**Pages and landing**

1. There are exactly three dashboards, each tied to a role family (Editor Dashboard;
   My Assignments as Reviewer; My Submissions as Author) and each a separate page with
   its own navigation section, views and counts. A user with several hats gets several
   sections and switches by navigation, not by a toggle. All three run the same page
   machinery — one heading with the view name and count, the same controls row, the
   same table shell. <sup>a</sup>
2. Logging in (or following any dashboard address that names no variant) lands on the
   highest-priority dashboard the user's journal roles allow: Site Administrator,
   Journal Manager, Section Editor or Assistant → Editor Dashboard; else Reviewer →
   My Assignments as Reviewer; else Author → My
   Submissions; a Reader-only or role-less user goes to the journal's public
   homepage. ⚠ A Site Administrator with no enrolment in the journal is landed on
   the public homepage like a role-less user — even though the Editor Dashboard
   address itself would admit them (Known deviations). <sup>b</sup>
3. Legacy addresses survive as redirects: the pre-3.6 submission-lists address
   redirects to the role-priority dashboard, as does the dashboard address without a
   variant — ⚠ though the variant-less address performs that redirect *before*
   checking sign-in, so followed while signed out it crashes to an empty error page
   instead of asking for login, unlike every named variant (Known deviations). ⚠ One
   legacy operation survives half-way: the old tasks popup — the to-do list the
   pre-3.6 backend header opened over the page — has no link anywhere in 3.6, so
   only an old bookmark or hand-typed address (the "tasks" sub-address of the
   legacy submission-lists address) still reaches it, and following it crashes
   (its template no longer exists); four other legacy list
   operations are routed to nothing (Known deviations, ledger row 67). <sup>c</sup>

**Views — the Editor Dashboard**

4. A view is a named, pre-filtered list. Which views a user gets is fixed by role;
   the sidebar lists them in a fixed order with a count beside each. The full
   editorial set, in order ("all four" = Site Administrator, Journal Manager,
   Section Editor, Assistant): <sup>d</sup>

   | View (sidebar label) | Who gets it | What it lists |
   |---|---|---|
   | **Assigned to me** | all four | in-progress submissions where the user holds an editorial-capacity assignment |
   | **Active submissions** | all four | every in-progress submission (scoped for Section Editors/Assistants, rule 5) |
   | **Needs editor** | Site Administrator, Journal Manager | submitted, in progress, and no Journal Manager or Section Editor has any assignment on it (an Assistant doesn't count as an editor) |
   | **All in submission stage** | all four | in-progress submissions currently in the Submission stage |
   | **Needs reviews** | all four | in review, with fewer confirmed reviews in the current round than the journal requires (Settings) — a review counts only once an editor has confirmed it, so a review the reviewer has submitted but no editor has yet confirmed still leaves the submission here |
   | **Awaiting reviews** | all four | in review, with at least one active review request in the current round not yet completed |
   | **Reviews submitted** | all four | in review, with at least one completed review in the current round |
   | **Reviews overdue** | all four | in review, with a review — or a response to a request — past its due date in the current round |
   | **Author revisions submitted** | all four | in review, with revisions handed in by the author in the current round — membership begins when the author uploads, not when the editor requests revisions |
   | **All in review stage** | all four | in-progress submissions currently in the Review stage |
   | **All in copyediting stage** | all four | in-progress submissions currently in Copyediting |
   | **All in production stage** | all four | in-progress submissions currently in Production |
   | **Scheduled for publication** | all four | submissions whose *Version of Record* is scheduled in an issue but not yet published; ⚠ scheduling any earlier version leaves the workflow panel saying "Scheduled" while this view never lists it (Known deviations) |
   | **Published** | all four | submissions whose workflow is done (published) |
   | **Declined** | Site Administrator, Journal Manager only | declined submissions |

   Review-state views count only the current review round — an earlier round's
   overdue review does not keep a submission in "Reviews overdue". The two author-only
   views (Revisions requested, Incomplete submissions) and the author flavors of the
   shared names belong to the author-dashboard and drafts specs. <sup>e</sup>
5. **Scope**: for a Site Administrator or Journal Manager every view above is
   journal-wide. For a Section Editor or Assistant every view keeps its membership
   rule but adds "…and assigned to me in an editorial capacity" — there is no way for
   them to browse unassigned work, and a submission where they are only the author or
   a reviewer never appears on their Editor Dashboard. ⚠ One hybrid breaks this: a
   Section Editor or Assistant who also holds the Site Administrator role keeps a
   scoped sidebar and scoped counts, but the five review-state views (Needs reviews
   through Author revisions submitted) list the whole journal — counts and lists
   disagree, and unassigned in-review work becomes browsable (Known
   deviations). <sup>f</sup>
6. ⚠ Because the Declined view is withheld from Section Editors and Assistants and
   no other editorial view matches declined submissions, a Section Editor loses
   every dashboard *route* to a submission the moment it is declined — no view
   lists it and no in-view search can find it, even one they handled and declined
   themselves. A saved or shared address to the submission's workflow still opens
   it in full (rule 13) — the loss is of discovery, not of access (Open
   questions #1). <sup>g</sup>
7. **Counts**: each sidebar view name carries the number of submissions in the
   view's *unfiltered* membership; the page heading shows, in parentheses, how many
   the list is showing *right now* — so with no search or filters the two agree,
   but while a search phrase or filter chips are applied the heading count shrinks
   to the narrowed list and the sidebar number stays put. Both load with the page
   and are recomputed whenever the list changes (acting from a row, deleting,
   closing the workflow panel) — not on a timer. <sup>h</sup>
8. **Default and fallback**: opening a dashboard without naming a view lands on the
   first view in its list ("Assigned to me" on the Editor Dashboard, "Action
   Required by me" on the reviewer's); an address naming a view the user doesn't
   have falls back the same way, silently — no error, and the address bar corrects
   itself to the view actually shown. Switching views returns to page 1 and clears
   the search phrase; ⚠ applied filters survive the switch even though the search
   does not, and the invalid-address fallback behaves exactly like a switch —
   search dropped, filters kept (Known deviations, shared bug AD-G). <sup>i</sup>

**List controls (shared by all three dashboards)**

9. **Search** narrows the *current view only* — its baseline filters always apply.
   A phrase is split into words and matches submissions on title, abstract,
   keywords/subjects/disciplines, or author names and their ORCID identifiers; a
   purely numeric word also matches that exact submission number; a phrase shaped
   like a DOI finds submissions by their DOIs instead of by text. Anonymity guard:
   on *scoped* lists, a searcher who holds any review assignment — on any
   submission, in any journal on the site, even a single accepted-but-never-completed
   one; the trigger is having an assignment, not holding the Reviewer role — gets no
   author-name matching, so reviewer-searchers can't uncover blinded authors by
   name — though matching on an author's ORCID identifier is *not* suppressed
   (Open questions #2). Searching returns to page 1. <sup>j</sup>
10. **Filters** chosen in the panel are applied with "Apply Filters" and then shown
    as removable chips between the controls and the table (e.g. "Section: Articles"),
    with a "Clear Filters" link to drop them all; removing one chip re-runs the list
    without it. Filters combine with the view's baseline and the search. <sup>k</sup>
11. **Sorting**: column headers marked sortable (on the Editor Dashboard: ID and
    Days) cycle descending → ascending → off on repeated presses. The default order
    is newest submission first. <sup>l</sup>
12. **Paging**: thirty rows per page, with pager controls under the table. An empty
    list shows "No Items". <sup>m</sup>
13. **The address is the state**: the current view, search phrase, filters, sort,
    any open submission panel — and which of the panel's inner sections is showing —
    are all carried in the page address. Reloading or sharing the address restores
    the same screen; a recipient who isn't signed in is asked to log in first and
    then lands on that same screen. Closing the workflow panel cleans the address
    up and refreshes the list. <sup>n</sup>

**Rows — the Editor Dashboard table**

14. Columns: **ID** (the submission number), **Submissions** (the author list in
    bold, a dash, then the title), **Stage** (a colored bubble naming the current
    stage or terminal state), **Days** (days since the submission's last activity),
    **Editorial Activity**, and **Actions** (the View button). The Editorial Activity
    cell reads the submission's state and shows either a one-click next step or a
    status line: "Assign Editor" when a Submission-stage row has no editor; "Assign
    Reviewers" when a review round has none; compact review-progress indicators once
    reviewers exist; revision alerts ("Revision requested from author", author
    revisions submitted); tailored messaging for a Section Editor assigned as
    recommend-only — assigned with the participant option "Only allowed to
    recommend an editorial decision", so they advise rather than decide: their
    row's progress lines are aimed at the recommendation they owe, and once they
    have made it the cell reads "Recommendation has been made by
    you."; copyediting/production hints (files
    uploaded, the issue it will appear in); "Complete submission" on incomplete rows
    (drafts spec); and "Declined during the … stage" on declined rows. <sup>o</sup>
15. **Multi-role guard**: when a Site Administrator's or Journal Manager's own
    submission (or one they review) shows up in a journal-wide view, the row's
    Editorial Activity replaces the summary with an explanation — "You cannot access
    this submission as a Journal Manager since you are the author. To view it, go to
    \"My Submissions\"" (and the reviewer twin pointing at "Review Assignments") —
    and the View button is withheld, so their journal-wide access never opens work
    they hold an author or reviewer hat on. The guard yields as soon as they are
    *also* assigned in an editorial capacity — ⚠ except that an assignment made
    under the "Journal manager" group name does not lift it: only an editor-type
    assignment does, so a manager-author legitimately assigned as a manager stays
    locked out of their own row (Known deviations). <sup>p</sup>

**My Assignments as Reviewer**

16. The reviewer dashboard lists **review assignments**, not submissions — a person
    who reviewed two rounds has two rows. Its views: <sup>q</sup>

    | View (sidebar label) | What it lists |
    |---|---|
    | **Action Required by me** | assignments awaiting the reviewer's response or an unfinished review, while the submission is still in the review stage |
    | **All assignments** | every assignment that isn't declined, cancelled, or on a published submission — the reviewer's open book of work, finished or not; ⚠ as built it also omits never-finished reviews whose submission moved on, which appear only under Archived (Open questions #4) |
    | **Completed** | finished reviews on submissions still working their way through (not yet published, not sent back to the Submission stage) |
    | **Declined** | requests the reviewer declined |
    | **Published** | finished reviews whose submission has since been published |
    | **Archived** | never-finished reviews on submissions that moved on to Copyediting or Production without them |

17. Reviewer rows show the submission number and title, an activity line with the
    relevant date — "Please accept or decline this request by {date}", "Please
    complete this review by {date}", "Review submitted on {date}", "Request declined
    on {date}", or overdue phrasing once a deadline passes — and one action button
    named for the needed step: "Respond to request" (new, overdue or re-sent
    requests), "Finish review" (accepted or overdue reviews), otherwise "View"; a
    declined row gets no button, and an unfinished review whose submission moved on
    keeps only a one-word status line — "Incomplete" — with no button. Every button
    leads to the reviewer's own review pages, opening at the step the review is
    at (the request step for a new request, mid-review for an accepted one, the
    completion notice for a submitted one). <sup>r</sup>
18. ⚠ The reviewer dashboard's list controls are cosmetic as-built: the search box,
    Filters panel, sortable ID column and pager all render and *appear* to respond —
    a search phrase sticks in the box, filter chips appear, the pager's "Showing X
    to Y of Z" text advances — but the list honors none of them: every view always
    shows its complete list, on every page, in the same order (Known deviations,
    ledger §2 row 2). The view *membership* filters (rule 16) do work. <sup>s</sup>

<sup>a</sup> pages/dashboard/index.php (op → DashboardPage enum); PKPDashboardHandler::__construct() (per-page role assignments, selectedRoleIds); DashboardPage.vue; dashboardPageStore.js (TitleTranslations: navigation.dashboards / navigation.reviewAssignments / navigation.mySubmissions) ·
<sup>b</sup> PKPPageRouter::getHomeUrl() (role-priority ladder; reader/role-less → journal index); PKPDashboardHandler::authorize() (no-variant → redirectHome); live-probed 2026-07-16 (all role mixes incl. Reviewer+Author → reviewer dashboard; reader-only and unenrolled site admin → journal homepage); anonymous no-variant address live-probed 2026-07-16 (HTTP 500, empty body — redirectHome() runs in authorize() before the login policy and getHomeUrl() dereferences a null Auth::user(); named variants and legacy /submissions correctly 302 → login; Known deviations, ledger row 209); ladder edge code-verified 2026-07-16: a Subscription-Manager-only enrolment falls through getHomeUrl() to the legacy submissions address, which does not role-assign them — they land on the authorization-denied page, not the homepage ·
<sup>c</sup> lib/pkp/pages/submissions/index.php (routes only index/tasks → lib/pkp/pages/dashboard/DashboardHandler.php); DashboardHandler::index() (redirectHome), ::tasks() (missing dashboard/tasks.tpl → 500); addRoleAssignment ghost ops myQueue/unassigned/active/archives ·
<sup>d</sup> Repository::getDashboardViews(), filterViewsByUserRoles(); DashboardView::getTypes() (constant order = sidebar order); locale keys submission.dashboard.view.*; live-probed 2026-07-16, counts code-verified 2026-07-16 (manager sidebar: 15 views incl. Needs editor + Declined; Section Editor: 13 without either — matches the table and Actors footnote e; an earlier 16/14 tally was stale) ·
<sup>e</sup> Repository::mapDashboardViews() (per-type collectors: STATUS_QUEUED baselines; TYPE_NEEDS_EDITOR filterByisUnassigned; TYPE_NEEDS_REVIEWS filterByNumReviewsConfirmedLimit; TYPE_AWAITING_REVIEWS / TYPE_REVIEWS_SUBMITTED / TYPE_REVIEWS_OVERDUE / TYPE_REVISIONS_SUBMITTED; stage views filterByStageIds; TYPE_SCHEDULED STATUS_SCHEDULED; TYPE_PUBLISHED stage DONE; TYPE_DECLINED STATUS_DECLINED); Collector::buildReviewStageQueries() (current-round scoping via MAX(round)); "confirmed" = review_assignments.considered (editor confirmation, not reviewer submission); revisions membership = review_rounds REVIEW_ROUND_STATUS_REVISIONS_SUBMITTED, set by the author's upload; Scheduled membership via Repository::getStatusByPublications() (VoR-only — Known deviations); state edges live-probed 2026-07-16 (stage transition, decline, review completion incl. submitted-unconfirmed staying in Needs reviews, new-round reset of Reviews submitted, revisions-upload trigger, VoR schedule + publish) ·
<sup>f</sup> Repository::mapDashboardViews() ($canAccessUnassignedSubmission branch per view: collector vs collector->assignedTo($user, $selectedRoleIds)); Collector.php assignedTo() with assignedWithRoles (reviewer assignments excluded when roles given without REVIEWER); scoping live-probed 2026-07-16 (assigned Section Editor's lists and searches confined to own assignments); nuance code-verified 2026-07-16: the "editorial capacity" half of the scope is client-parameterized — assigned()/reviews() force assignedTo($currentUser) server-side but take assignedWithRoles from the query string (the store always sends the editorial role IDs), so a bare API call widens a Section Editor's scope from editorial-capacity ties to any own tie (author/reviewer — and, with no status baseline, declined ones, footnote g), never to other people's or unassigned work (API denial probes 2026-07-16: 0 bypasses); hybrid admin+SE review-state leak live-probed 2026-07-16 (Known deviations, ledger row 208) ·
<sup>g</sup> Repository::mapDashboardViews() TYPE_DECLINED roles [SITE_ADMIN, MANAGER, AUTHOR]; no other editorial view admits STATUS_DECLINED; live-probed 2026-07-16 (assigned Section Editor: no view/search reaches a declined submission; ?workflowSubmissionId deep link and the legacy workflow/access redirect both open its full workflow panel; the assigned-list API returns it when queried without a status baseline) ·
<sup>h</sup> Repository::setViewsCount(); PKPBackendSubmissionsController::getViewsCount() (ignores searchPhrase/filters — badge = unfiltered membership); SideNav.vue (viewsCount fetch per nav section, badge fill); DashboardPage.vue h1 `${currentView.name} (${itemCount})` (itemsMax of the current fetch — heading = filtered list); appStore triggerReloadViewsCount(); live-probed 2026-07-16 (heading 2 vs badge 197 under filter+search; viewsCount + list refetch fired on row action and panel close, one viewsCount call per nav section, no idle polling) ·
<sup>i</sup> dashboardPageStore.js currentViewId (fallback to views[0]), currentViewId watcher (currentPage=1, clearFiltersForm, resetSearchPhrase — filters restored by query-param re-init, AD-G); live-probed 2026-07-16 (bogus currentViewId → silent fallback to assigned-to-me, address rewritten, searchPhrase dropped, sectionIds kept and applied) ·
<sup>j</sup> Collector.php search-phrase block (title/abstract via publication_settings; controlled vocab keyword/subject/discipline; author given/family/orcid with the any_assignment reviewer guard — the guard excludes only IDENTITY_SETTING_GIVENNAME/FAMILYNAME, ORCID matching survives; ctype_digit → submission_id; Doi::beginsWithDoiPrefixPattern → addFilterByAssociatedDoiIdsToQuery); dashboardPageStore.js setSearchPhrase() (currentPage=1); guard live-probed 2026-07-16 (reviewer-Section-Editor: author-name match dead, title match alive; non-reviewer control matches by name; ORCID leg code-read only — no seeded ORCID); guard also verified at the API layer 2026-07-16 (searchPhrase passed straight to the assigned op: author-name match suppressed for the reviewer-holder, title control alive, non-reviewer control matches — server-side, not just the search box) ·
<sup>k</sup> DashboardModalFilters.vue; useFiltersForm(); DashboardActiveFilters.vue (chips, common.filtersClear); PKPBackendSubmissionsController::getSubmissionCollector() (sectionIds via OJS override, categoryIds, daysInactive) ·
<sup>l</sup> useSorting.js (descending→ascending→none cycle); useDashboardConfig.js getColumns() (sortable: id, lastActivity); Collector.php $orderBy default ORDERBY_DATE_SUBMITTED DESC ·
<sup>m</sup> PKPDashboardHandler::$perPage = 30; useFetchPaginated(); TablePagination; TableBody empty-text grid.noItems ·
<sup>n</sup> dashboardPageStore.js useQueryParams() (currentViewId, searchPhrase, filters, sortColumn/sortDirection, workflowSubmissionId AND workflowMenuKey all URL-backed; openWorkflowModal onClose clears params + refetch); live-probed 2026-07-16 (full deep link restored view+chip+phrase+open panel in a fresh session; logged-out → /login?source={deep link} → same screen; panel close cleaned URL and refetched; cosmetic: while a deep-linked panel is open the list behind it stays in its initial Loading state with heading "(0)" until close — invisible to users, misleading to automated assertions) ·
<sup>o</sup> useDashboardConfig.js getColumns() (headers common.id / navigation.submissions / workflow.stage / editor.submission.days / stats.editorialActivity / admin.jobs.list.actions); DashboardCellSubmissionTitle.vue (authorsStringShort — fullTitle); DashboardCellSubmissionStage.vue (StageBubble); DashboardCellSubmissionDays.vue; useDashboardConfigEditorialActivity.js getEditorialActivityForEditorialDashboard() (assignEditor when !editorAssigned; assignReviewers on PENDING_REVIEWERS; recommendOnly branches; declinedDuringStage; completeSubmission); Assign Editor live-probed 2026-07-16 (button on unassigned rows in Needs editor AND Active; opens the Assign Participant dialog over the list; on save the row leaves the view and the badge drops, no page reload) ·
<sup>p</sup> useDashboardConfigEditorialActivity.js (dashboard.noAccessBeingAuthor / dashboard.noAccessBeingReviewer, keyed on assigned-role checks); DashboardCellSubmissionActions.vue showButton; live-probed 2026-07-16 (author + reviewer alerts exact-text confirmed, View withheld; Journal-editor-group assignment lifts the guard, Journal-manager-group assignment does not — Schema.php getPropertyStages() fills currentUserAssignedRoles only from userGroupStages and the manager group has no user_group_stage rows) ·
<sup>q</sup> Repository::mapDashboardViews() TYPE_REVIEWER_* (reviewAssignment Collector: filterByActionRequiredByReviewer / filterByActive / filterByCompleted / filterByDeclined / filterByPublished / filterByIsArchived); locale submission.dashboard.view.reviewAssignments.*; view membership live-probed 2026-07-16 (five seeded states each landed in the specced view; the archived-incomplete assignment was absent from All assignments) ·
<sup>r</sup> DashboardCellReviewAssignmentId.vue (submissionId), …Title.vue (publicationTitle); useDashboardConfigEditorialActivity.js getEditorialActivityForMyReviewAssignments() (dashboard.reviewAssignment.* strings); DashboardCellReviewAssignmentActions.vue (label by status; null for declined and moved-on incomplete); dashboardPageStore.js openReviewerForm() (reviewer/submission/{id}); live-probed 2026-07-16 (all five states, exact lines + destinations: invited → wizard step 1, accepted → step 2, submitted → step 4 "Review Submitted"; the accepted-state due line carries a time-of-day, the respond-by line is date-only; archived line is the single word "Incomplete") ·
<sup>s</sup> PKPBackendSubmissionsController::getReviewAssignments() (only view flags mapped — the FRONT END sends searchPhrase, orderBy/orderDirection, offset/count/page and the filter params on every request; the controller drops them, so the fix is backend-only); useDashboardConfig.js (controls rendered regardless of dashboardPage); app-changes.md §2 row 2; live-probed 2026-07-16 (32-row view: all 32 rendered under "Showing 1 to 30 of 32", page 2 repeats all 32 under "31 to 32"; ID sort and section chip cosmetic; params confirmed on the wire)

## Side effects

None from this feature itself — the dashboards are a read surface. Emails,
notifications and log entries belong to the actions launched *from* rows (assigning
participants and reviewers, deleting drafts, decisions inside the workflow panel),
each owned by its feature. The one background behavior of the page is bookkeeping:
sidebar counts and the list re-fetch after any row-level action or when the workflow
panel closes. <sup>a</sup>

<sup>a</sup> dashboardPageStore.js fetchSubmissions() → appStore triggerReloadViewsCount(); openWorkflowModal() onClose refetch; live-probed 2026-07-16 (counts + list refetched after a row action and after panel close; no periodic polling observed over idle minutes)

## Settings that modify behavior

- **Reviews required** (Settings → Workflow → Review): sets the confirmed-review
  threshold behind the "Needs reviews" view and the minimum-reviews messaging in the
  Editorial Activity cell; unset, the floor is one review. <sup>a</sup>
- **Disable submissions** (journal setting): removes the "Start A New Submission"
  entry that otherwise appears at the bottom of the Editor Dashboard section (or, for
  non-editors, the My Submissions section) in the left navigation. <sup>b</sup>
- **Journal structure feeds the Filters panel**: with one section, no issues, or no
  categories, the corresponding filter fields simply don't exist (Fields &
  validation).
- **Plugins** may add or alter dashboard views through an extension point; none of
  the standard OJS plugins do. <sup>c</sup>
- No config.inc.php variables alter these rules.

<sup>a</sup> Context::getNumReviewsPerSubmission(); REVIEWS_REQUIRED_COUNT = 1 fallback; Repository::mapDashboardViews() TYPE_NEEDS_REVIEWS; PKPDashboardHandler::index() 'contextMinReviewsPerSubmission' ·
<sup>b</sup> PKPTemplateManager::setupBackendPage() ('disableSubmissions' gate, placement per role mix) ·
<sup>c</sup> Hook Dashboard::views (PKPDashboardHandler::getViews())

## Cross-feature interactions

- **author-dashboard** — owns the My Submissions page built on this machinery, the
  author view set, and the author-side deviations already on file (the leaked
  "Assigned To Editor" field AD-B, the manager-scope leak in the author's revisions
  views AD-H); this spec owns the shared store, controls and counts those bugs live
  in.
- **submission-drafts** — owns incomplete-submission rows everywhere they appear:
  the "Complete submission" action, the missing View button, and the bulk-delete
  mechanics this page merely surfaces for managers.
- **assign-and-manage-reviewers** — owns everything behind the row's "Assign
  Reviewers" shortcut and the review-progress indicators' popovers.
- **stage-participants** (pending) — owns the assignment form behind "Assign
  Editor" and the assignments that feed "Assigned to me"/scoping.
- **workflow-stage-navigation / editorial-decisions** (pending) — own the workflow
  panel the View button opens; this spec owns only that it opens over the list, is
  addressable, and refreshes the list on close.
- **review-process surfaces** — the reviewer row buttons land on the reviewer's
  review pages, owned by the review-response/review-steps features.
- **DOI management** — the DOI-shaped search behavior is shared with the DOIs
  feature; this spec owns only that the dashboard search accepts it.

## Canonical scenarios

1. **A Journal Manager triages the journal** — a Journal Manager signs in and lands
   on the Editor Dashboard, on "Assigned to me". The sidebar under "Editor Dashboard"
   lists every view from rule 4, each with a count. They press "Active submissions":
   the heading reads "Active submissions" with the count in parentheses, and the
   table shows every in-progress submission in the journal — including ones not yet
   assigned to anyone — with ID, authors — title, a stage bubble, days since last
   activity, an Editorial Activity summary and a View button. Pressing View slides
   the submission's workflow open over the list; closing it returns to the same
   list, refreshed.
2. **A Section Editor sees only their own desk** — a Section Editor assigned to two
   of the journal's many submissions opens the Editor Dashboard. "Active submissions"
   shows exactly those two; there is no "Needs editor" and no "Declined" view in
   their sidebar; the Filters panel has no "Assigned To Editor" field. Searching for
   the exact title of an unassigned submission finds nothing — scope beats search.
3. **Needs editor, cleared by assigning** — an author submits a new manuscript. A
   Journal Manager's "Needs editor" count rises by one; the row's Editorial Activity
   shows an "Assign Editor" button. Pressing it opens the participant-assignment
   form right over the list; after assigning a Section Editor, the list refreshes —
   the submission has left "Needs editor" and the sidebar count drops.
4. **Search within a view** — a Journal Manager on "Active submissions" types an
   author's family name in "Search submissions, ID, authors, keywords, etc.": the
   list narrows to that author's submissions and the heading count shrinks to match.
   Typing a bare submission number instead finds that exact submission. Clearing the
   phrase restores the full view. The same phrase typed while on "All in copyediting
   stage" matches only copyediting submissions — search never leaves the view.
5. **Filters and the reset trap** — a Journal Manager opens "Filters", ticks a
   Section and drags "Days since last activity" to 30, then applies. Two chips appear
   above the table ("Section: …" and "Days since last activity: 30") and the list narrows; removing
   the section chip re-widens it. They then switch to another view: the search box
   empties, but ⚠ the remaining chip survives and keeps filtering the new view —
   remove it or press "Clear Filters" to see everything (Known deviations, AD-G).
6. **An editor's own submission stays at arm's length** — a Journal Manager who
   authored a submission opens "Active submissions". Their submission's row is
   there, but its Editorial Activity reads "You cannot access this submission as a
   Journal Manager since you are the author. To view it, go to \"My Submissions\"" and
   has no View button. Once another manager assigns them to it in an editor-type
   participant group too — "Journal editor", say; picking the "Journal manager"
   group would leave the guard in place (rule 15) — the same row shows the normal
   summary and View returns.
7. **A reviewer works the queue** — a user whose only role is Reviewer signs in and
   lands on "My Assignments as Reviewer", view "Action Required by me". A fresh
   request shows "Please accept or decline this request by {date}" and a "Respond to
   request" button that opens the review's request step; an accepted review shows
   "Please complete this review by {date}" and "Finish review". Submitting the
   review moves the row out of "Action Required by me"; it stays in "All
   assignments" and appears under "Completed", now reading "Review submitted on
   {date}" with a "View" button.
8. **A reviewer's history sorts itself** — the same reviewer checks the other views:
   a request they declined sits under "Declined" (with "Request declined on {date}"
   and no action button); a review they finished long ago on a since-published
   article has moved from "Completed" to "Published"; a request they never finished
   on a submission that advanced to Copyediting without them sits under "Archived",
   marked simply "Incomplete" with no action offered — and is missing from "All
   assignments" too. ⚠ Typing in the search box, applying a filter, pressing the ID
   column or paging changes nothing in any of these lists — the controls render and
   appear to respond, but the reviewer lists ignore them (Known deviations, ledger
   §2 row 2).
9. **Dashboards match hats** — in a journal with three users: a Section Editor
   without the Reviewer role sees "Editor Dashboard" in the navigation but no "My
   Assignments as Reviewer"; a reviewer-only user sees the reverse, and typing the
   Editor Dashboard's address (copied from the Section Editor's browser bar) gets
   the current-role-has-no-access page; a Section
   Editor who also reviews sees both sections and each page shows only that hat's rows.
   Logging in lands each of them on their highest dashboard: editorial first,
   reviewer next, author last.
10. **The address restores the screen** — a Journal Manager on "Reviews overdue",
    with a section filter applied, a search phrase typed and a submission's workflow
    panel open, copies the browser address to a colleague with the same role. Opening
    it, the colleague gets the same view, the same chip and phrase, the same open
    panel — and if they weren't signed in yet, the login screen comes first and the
    same screen follows. Editing the address to name a view that doesn't exist lands
    safely on "Assigned to me" with no error — the address corrects itself, the
    search phrase is dropped, but the section chip sticks and keeps filtering, just
    as when switching views (scenario 5).

## Known deviations (as-built ≠ intent)

- ⚠ **Legacy tasks popup crashes; four ghost list addresses** (ledger
  docs/e2e/app-changes.md §2 row 67, filed by this feature's earlier probe pass
  2026-07-03): the pre-3.6 `submissions` page survives for the role-priority
  redirect, but its `tasks` op renders the deleted `dashboard/tasks.tpl` → HTTP 500,
  and `myQueue`/`unassigned`/`active`/`archives` are role-assigned with no
  implementing methods → 404 (DashboardHandler in lib/pkp/pages/dashboard/…,
  lib/pkp/pages/submissions/index.php). Upstream cleanup proposed in the row.
- ⚠ **Reviewer lists ignore every list control — a backend-only defect** (ledger
  §2 row 2, symptom set live-probed 2026-07-16): the front end SENDS every
  parameter on every request (searchPhrase, orderBy/orderDirection,
  offset/count/page, sectionIds and the other filter params — confirmed on the
  wire); `_submissions/reviewerAssignments`
  (PKPBackendSubmissionsController::getReviewAssignments()) maps only the
  view-membership flags and drops the rest, so wiring the params is purely a
  controller fix. On-screen symptom: with 32 assignments, every "page" renders all
  32 rows while the pager label claims "Showing 1 to 30 of 32" (page 2: the same
  32 under "Showing 31 to 32 of 32"); ID sort updates URL + request but never the
  order; a section chip renders, filters nothing. Proposed row-2 amendment with
  this detail; fix direction stays "wire the params (backend) or hide the
  controls".
- ⚠ **View switch clears search but not filters** (ledger §2 row 201, filed by
  author-dashboard as AD-G; the buggy store is shared —
  dashboardPageStore.js currentViewId watcher clears the filters form, then the
  URL-driven re-init restores it). Live-probed on the Editor Dashboard 2026-07-16:
  view switch dropped searchPhrase from box + URL while the Section chip survived
  and kept filtering (heading 101 vs badge 103). The invalid-view fallback (rule 8)
  runs the same path — search cleared, filters kept. This spec owns the store; the
  ledger row stays 201.
- ⚠ **"Assigned To Editor" filter is silently inert on assigned/review-state views**
  (live-probed 2026-07-16, ledger §2 row 204): the parameter is mapped only
  by the journal-wide list service (PKPBackendSubmissionsController::getMany()
  'assignedTo'); the assigned-scope and review-state services (…::assigned(),
  …::reviews()) drop it — API responses byte-identical with/without the param. On
  the Editor Dashboard the manager's no-op set is: Assigned to me, Needs reviews,
  Awaiting reviews, Reviews submitted, Reviews overdue, Author revisions submitted;
  the chip renders, the URL updates and "Clear Filters" appears either way, so the
  UI gives no hint the filter did nothing. Working on Active submissions and the
  stage views; on Needs editor the param IS applied but composes contradictorily
  with the view's unassigned baseline (6 → 3 rows where logic says 0 — precisely,
  the surviving rows are those where the chosen editor holds an *assistant-group*
  assignment: the param's role list admits assistants while the unassigned baseline
  excludes only manager/editor groups; code-verified 2026-07-16). Related: the field
  leaking onto My Submissions is author-dashboard's row 196 (AD-B).
- ⚠ **Multi-role guard does not yield for a Journal-manager-group assignment**
  (live-probed 2026-07-16, ledger §2 row 205): rule 15's guard lifts when the
  manager-author is stage-assigned via the *Journal editor* group but NOT via the
  *Journal manager* group — Schema.php getPropertyStages() fills
  `currentUserAssignedRoles` only from userGroupStages, and the manager group has
  zero user_group_stage rows (managers have implicit all-stage access), so the
  mapper sees "author only" while the SQL side (filterByisUnassigned) counts the
  same assignment (the row correctly leaves Needs editor). A real journal hits this
  by picking the "Journal manager" group in the participant form. Mapper/collector
  disagree on what an editorial assignment is.
- ⚠ **A site administrator with no enrolment in the journal gets a degraded,
  viewless dashboard** (live-probed 2026-07-16, ledger §2 row 206): page
  access admits the site-level role, but the view list is built from journal-scoped
  roles only (Repository::getDashboardViews() → RoleDAO::getByUserId($userId,
  $contextId), which never matches the context-NULL admin group) — the page renders
  with no view links, counts or menus in the left sidebar (the probe saw no sidebar
  at all; code-reading 2026-07-16 suggests the empty navigation section — with only
  a "Start A New Submission" entry — may still mount for site-level admins, so
  re-check the exact sidebar state when fixing), a heading of literally
  "undefined (N)", and a working table serving the raw journal-wide list with no
  view baseline — incomplete drafts included, every such row offering "Complete
  submission". No script error; not blank (the earlier dereference-crash hypothesis
  did not materialize). Login itself routes such an admin to the journal's public
  homepage (the landing ladder also sees no journal roles), so the page is reached
  only by typing the address. Same wrong-scope family as the tasks-discussions
  site-admin carve-out finding. Mitigated in practice by creator auto-enrolment.
- ⚠ **A site administrator enrolled only as Section Editor/Assistant gets
  journal-wide rows in the five review-state views** (live-probed 2026-07-16,
  ledger §2 row 208): the sidebar and its badge counts stay correctly SE-scoped
  (13 views, no Needs editor or Declined), but opening Needs reviews, Awaiting
  reviews, Reviews submitted, Reviews overdue or Author revisions submitted lists
  every in-review submission in the journal — the probe account, assigned to one
  submission, saw all 91 (badge "1 Needs reviews" beside a heading "Needs reviews
  (80)"). Mechanism: those five views fetch through the review-state list service,
  which skips self-scoping when canAccessAllSubmissions() — computed over journal
  *and site* roles, so site-level SITE_ADMIN qualifies — while the badge path
  (getDashboardViews → RoleDAO journal-scoped roles) gates unassigned widening on
  journal MANAGER only; badges and lists disagree, and rule 5's scope is breached
  for this hybrid. Same wrong-scope mapper-vs-API family as rows 205/206 (and
  author-dashboard's row 202 — the same self-scoping skip, seen from the author
  page). "Assigned to me" is unaffected (its service stays server-scoped).
- ⚠ **Anonymous visit to the bare dashboard address crashes — empty page, HTTP
  500** (code-derived, then live-probed 2026-07-16, ledger §2 row 209): the
  variant-less address performs its role-priority redirect inside authorize()
  *before* the login policy runs, and the home-URL resolver dereferences the
  signed-in user without a null guard (PKPDashboardHandler::authorize() →
  PKPPageRouter::redirectHome()/getHomeUrl(), null Auth::user()) — so a logged-out
  GET of the bare address returns HTTP 500 with an empty body instead of the login
  form. Every named variant and the legacy submissions address redirect to login
  correctly (302 → login form, probed the same day). The legacy address is safe
  because its redirect runs in the op, after the login policy.
- ⚠ **Scheduling a non-final version never surfaces in "Scheduled for
  publication"** (live-probed 2026-07-16, ledger §2 row 210): the Review
  Publishing Details dialog defaults the Publication Stage to the version's
  current stage (Author Original for a first version); choosing "Assign To Future
  Issue and Schedule Only" then marks that publication scheduled and the workflow
  panel flips to "Scheduled" with an Unschedule button — but the submission's own
  status is derived only from a scheduled/published *Version of Record*
  (Repository::getStatusByPublications(), lib/pkp/classes/submission/Repository.php),
  so it stays queued: the Scheduled view never lists it and the row keeps sitting
  in Active and the production-stage view with a "Production" bubble while the
  panel says "Scheduled". Discovery is not lost, but panel and sidebar disagree.
  The Version-of-Record path is correct end-to-end (same session: VoR schedule →
  Scheduled view, immediate publish → Published view). Either intended versioning
  semantics — then the view label/panel status should say so — or the status
  derivation should count any scheduled version.
- **Manager scope leaking into the author's revisions views** (ledger §2 row 202,
  AD-H) — recorded and owned by author-dashboard; the mechanism (reviews listing
  skips self-scoping for managers) is *intended* behavior on the Editor Dashboard
  and only wrong on the author page.
- **Dashboard header help link renders a raw locale key** (`##common.help##`,
  observed 2026-07-16 on both dashboards, enrolled and unenrolled sessions alike).
  Possibly test-environment locale state rather than a product defect — not filed;
  re-check on a clean install before proposing a row.

## Open questions

1. **Declined submissions become undiscoverable for Section Editors/Assistants**
   (rule 6): the Declined view's audience is Site Administrator/Journal Manager only
   (Repository::mapDashboardViews() TYPE_DECLINED roles — Author is listed, for the
   My Submissions flavor), and no other editorial view matches STATUS_DECLINED.
   Live-probed 2026-07-16: no view or in-view search reaches the declined
   submission, but a direct workflow address still opens it in full (the server
   does not role-block it — only the views' status baselines hide it). Is a Section
   Editor losing every dashboard *route* to submissions they declined intended, or
   should Declined be offered (scoped) to sub-editors as it was in 3.4's archive?
2. **Search's author-name anonymity guard: keyed too broadly AND too narrowly?**
   (a) Too broadly: the guard disables author-name matching on any scoped list
   whenever the *searcher* has any review assignment anywhere (Collector.php
   `any_assignment` join is not context- or submission-filtered) — live-confirmed
   2026-07-16: one accepted, never-completed assignment killed a Section Editor's
   author-name search on their own editorial lists, while an otherwise-identical
   non-reviewer control matched normally. (b) Too narrowly: the guard's exclusion
   covers only given/family-name settings — **ORCID matching is NOT suppressed**
   for reviewer-searchers (code-read, Collector.php author branch; not live-probed —
   no seeded author ORCID), so an ORCID search could still uncover a blinded
   author. Intended blunt safety, or should the guard key on the list actually
   containing the searcher's review assignments — and should it cover ORCID?
3. Should the reviewer dashboard hide its inert controls until ledger §2 row 2 is
   fixed — or wire the params, which the 2026-07-16 probe showed is a backend-only
   change (the front end already sends them all)?
4. "All assignments" (reviewer) excludes declined/cancelled and published — and,
   live-probed 2026-07-16, ALSO excludes never-finished assignments whose
   submission moved on to Copyediting/Production (they appear only under
   Archived) — so it is even less literally *all* than the label says; label/
   membership intent to confirm while fixing row 2?

---

<!-- REFERENCE MATERIAL — provenance and campaign bookkeeping, not product-owner
     narrative. The PO-facing "where do I find this" is in Purpose. -->

## Reference — entry points & surfaces

| Entry | Path | Atom |
|-------|------|------|
| Editor Dashboard | `/{journal}/dashboard/editorial` (left nav "Editor Dashboard" → view links `?currentViewId=…`) | PAGE-dashboard-editorial |
| Reviewer dashboard | `/{journal}/dashboard/reviewAssignments` | PAGE-dashboard-reviewassignments |
| Dashboard index (redirect) | `/{journal}/dashboard` → role-priority redirect (PKPPageRouter::redirectHome()); logged-out → 500 (ledger §2 row 209) | PAGE-dashboard-index |
| Legacy submissions list (redirect) | `/{journal}/submissions` → same redirect | PAGE-submissions-index |
| Legacy tasks popup (broken) | `/{journal}/submissions/tasks` → 500, template deleted (ledger §2 row 67) | PAGE-submissions-tasks |
| Page shell / table | DashboardPage.vue + dashboardPageStore.js; DashboardTable + cell components | VUE-dashboard-page, VUE-dashboard-table |
| Filters form | SubmissionFilters (OJS, adds issues) extends PKPSubmissionFilters | FORM-submission-filters |
| Journal-wide list API | `GET /api/v1/_submissions` (manager/admin only) | API-backend-submissions-get-many |
| Self-scoped list API | `GET /api/v1/_submissions/assigned` | API-backend-submissions-assigned |
| Review-state list API | `GET /api/v1/_submissions/reviews` | API-backend-submissions-reviews |
| View counts API | `GET /api/v1/_submissions/viewsCount` (SideNav badges + refresh) | API-backend-submissions-get-views-count |
| Reviewer list API | `GET /api/v1/_submissions/reviewerAssignments` | API-backend-submissions-get-review-assignments |
| Workflow panel deep link | `…/dashboard/editorial?workflowSubmissionId={id}&workflowMenuKey={key}` (openWorkflowModal; legacy `…/workflow/access/{id}` 302-redirects here — live-probed 2026-07-16) | — (workflow specs own the panel) |

## Reference — code anchors

- lib/pkp/pages/dashboard/PKPDashboardHandler.php — page ops (editorial /
  reviewAssignments / mySubmissions), role assignments, views + filters-form
  bootstrapping, per-page selectedRoleIds; pages/dashboard/DashboardHandler.php (OJS
  overrides: payments flag, recommendations, issue count, filters form with issues);
  pages/dashboard/index.php (op → DashboardPage enum)
- lib/pkp/pages/dashboard/DashboardHandler.php + lib/pkp/pages/submissions/index.php
  — legacy `/submissions` redirect + broken tasks op (ledger §2 row 67)
- lib/pkp/classes/core/PKPPageRouter.php getHomeUrl()/redirectHome() — role-priority
  landing
- lib/pkp/classes/submission/Repository.php getDashboardViews(),
  mapDashboardViews(), filterViewsByUserRoles(), setViewsCount();
  lib/pkp/classes/submission/DashboardView.php (types, per-view roles/op/queryParams)
- lib/pkp/api/v1/_submissions/PKPBackendSubmissionsController.php — getMany
  (manager/admin), assigned, reviews, getViewsCount, getReviewAssignments,
  getSubmissionCollector (param map); api/v1/_submissions/BackendSubmissionsController.php
  (OJS: issueIds/sectionIds, payment)
- lib/pkp/classes/submission/Collector.php — searchPhrase (title/abstract/vocab/
  author+ORCID/ID/DOI, reviewer name-guard), assignedTo + assignedWithRoles,
  filterByisUnassigned, daysInactive, buildReviewStageQueries (current-round view
  semantics); lib/pkp/classes/submission/reviewAssignment/Collector.php (reviewer
  view filters: actionRequired/active/completed/published/declined/archived)
- lib/pkp/classes/components/forms/dashboard/PKPSubmissionFilters.php +
  classes/components/forms/dashboard/SubmissionFilters.php — the Filters panel
- lib/ui-library/src/pages/dashboard/** — DashboardPage.vue, dashboardPageStore.js
  (views/search/filters/sort/paging/URL state, workflow modal),
  useDashboardConfig.js (controls, columns), useDashboardConfigEditorialActivity.js
  + useDashboardConfigReviewActivity.js (activity cells), useDashboardBulkDelete.js,
  components/DashboardTable/** (cells incl. action-button logic)
- lib/pkp/classes/template/PKPTemplateManager.php setupBackendPage() — the three nav
  sections, per-view links, Start A New Submission placement;
  lib/ui-library/src/components/SideNav/SideNav.vue (viewsCount badges)
