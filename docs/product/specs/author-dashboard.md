---
name: author-dashboard
scope: The author's My Submissions page (views, search, row anatomy for submitted work) and the read-mostly tracking view of their own submission, including the legacy author-dashboard URLs
shared: pkp-lib
status: verified
atlas-claims:
  - PAGE-dashboard-mysubmissions
  - PAGE-authordashboard-submission
  - PAGE-authordashboard-readsubmissionemail
  - AUTHZ-author-dashboard-access-policy
  - API-email-get-many
---

# Author dashboard (My Submissions & the author's tracking view)

## Purpose

After submitting, an author's job is mostly *waiting and watching* — with occasional
work items (upload revisions, answer a discussion). This feature is the author's home
for that: the **My Submissions** page lists everything they ever submitted to the
journal, grouped into views (Active, Revisions requested, Revisions submitted,
Scheduled for publication, Published, Declined — plus the drafts-only Incomplete view
owned by the drafts spec), with a search box, filters, and one row per submission
showing where it stands and what, if anything, the author should do. Pressing a row's
**View** opens the author's **tracking view** of that submission — a panel laid over
the list with the same left-hand menu shape as the editor's workflow (stages plus
publication pages per version) but read-mostly: the author sees status, files,
notifications and discussions, and can act only where the product wants them to
(revision uploads, discussion replies, and metadata only when an editor has granted
it). Old links from the pre-3.5 author dashboard still work: the legacy
submission URL lands on My Submissions with the right tracking view open, and the
legacy read-email popup still renders the editor's notification emails.

## Actors & permissions

Terms: *their own submission* = a submission on which the user holds an Author
assignment (created automatically by submitting; co-authors can be added by editors);
*metadata-edit grant* = the per-assignment "permit metadata edits" flag an editor can
set on the author's participation. Baselines: **anonymous visitors** have no access to
any of these surfaces (they are sent to login); every surface here requires the
**Author role in this journal** — a Reviewer or Section Editor without the Author role
cannot open My Submissions at all, and a Site Administrator or Journal Manager without
an Author assignment never sees anyone else's work *here* (their all-submissions
access lives on the editorial dashboard, another feature). Reaching a specific
submission's tracking view additionally requires being one of that submission's
authors.

| Action | Who may — and when |
|--------|--------------------|
| **Open My Submissions** | • Anyone holding the Author role in the journal — the "My Submissions as Author" section appears in the left navigation<br>• Everyone else — no navigation entry; a visitor typing the address is sent to login (with a return address back to the page), and a signed-in user without the Author role lands on an ordinary page reading "The current role does not have access to this operation." — never an error screen <sup>a</sup> |
| **See a submission in the lists** | • The submission's authors — only their own submissions ever appear, in whichever views match the submission's state; for a user whose only role here is Author, no view ever shows anyone else's work<br>• ⚠ Exception: an Author who is also a Journal Manager or Site Administrator opening the "Revisions requested" or "Revisions submitted" view sees every journal submission that belongs in that view — other authors' work included — while the sidebar badges stay correctly scoped to their own work, so badge and table disagree (Known deviations, AD-H) <sup>b</sup> |
| **Open the tracking view** ("View" in the row) | • The submission's authors — any submitted submission, in any state (in progress, scheduled, published, declined)<br>• Draft rows have no View button (drafts spec) <sup>c</sup> |
| **See a stage's panels inside the tracking view** | • The author — only for workflow stages the journal's Author role is assigned to cover (set in the journal's Users & Roles settings — Settings that modify behavior); an uncovered stage shows a no-access explanation instead of panels <sup>d</sup> |
| **Edit Title & Abstract / Metadata pages** | • The author — only with the metadata-edit grant on their assignment, and only while no version is scheduled or published; a granted author's edits save and persist<br>• Without the grant — the forms still render and accept typing, but Save stays disabled and typed changes do not stick; the block also holds below the screens — the service refuses the save (that half is not verifiable from the screens)<br>• Publishing clears the grant automatically; ⚠ if an editor re-grants it after publication, Save wrongly stays enabled on the published version (Known deviations, AD-D) <sup>e</sup> |
| **Edit Contributors** | • No one on this page ⚠ — the author's Contributors panel is read-only even with the metadata-edit grant: each row offers only "Preview" (Known deviations, AD-A) <sup>f</sup> |
| **Upload revision files** | • The author — while the current review round asks for revisions (boundary: the revision rules are the review-rounds feature's; this spec owns the buttons' presence here) <sup>g</sup> |
| **Read the editor's notification emails** | • The author — only emails they themselves received on that submission<br>• No screen ever offers anyone else's email; a request crafted for one shows an empty popup and nothing of the foreign email leaks (not verifiable from the screens — automation-only) <sup>h</sup> |
| **Participate in discussions** | • Per the tasks-discussions spec — the panels appear on every stage of the tracking view <sup>i</sup> |
| **Follow a legacy author-dashboard link** | • The submission's authors — the submitting author and any added co-author land on the tracking view<br>• A user without the Author role at all is told to add the role to their profile ("Register As"); an Author-role holder who is not on that submission is told they lack access to that stage — the missing-role message wins when both apply <sup>j</sup> |
| **Start a new submission** | • Any Author-role holder — a "Start A New Submission" link inside a navigation section (placement varies by roles — rule 14), unless the journal has disabled submissions (then no start entry appears anywhere) <sup>k</sup> |

<sup>a</sup> PKPDashboardHandler::__construct() addRoleAssignment(ROLE_ID_AUTHOR, ['mySubmissions']); PKPTemplateManager::setupBackendPage() (menu['mySubmissions'] gated on Author role); PKPSiteAccessPolicy; live-probed 2026-07-11: anonymous → login redirect with `?source=` return address (never a 403 status); reviewer-only and section-editor-only → 302 to user/authorizationDenied?message=roleBasedAccessDenied, rendered as HTTP 200 ·
<sup>b</sup> Repository::getDashboardViews() with $selectedRoleIds=[ROLE_ID_AUTHOR] — every author view's collector applies assignedTo([$user], [Author]) (these collectors also feed the badge counts); PKPDashboardHandler::__construct() (MySubmissions → selectedRoleIds [Author]); BUT the two revisions views' table rows load via the reviews listing op — PKPBackendSubmissionsController::reviews() — which skips assignedTo() whenever canAccessAllSubmissions() (Journal Manager / Site Administrator), AD-H; live-confirmed by arbitration 2026-07-11: author+manager badge 0 vs 13 table rows; pure-author control correctly scoped ·
<sup>c</sup> DashboardCellSubmissionActions.vue (View hidden only when submissionProgress set; no other suppression on MY_SUBMISSIONS); dashboardPageStore.js openWorkflowModal() ·
<sup>d</sup> workflowConfigAuthorOJS.js WorkflowConfig.common.getPrimaryItems (accessibleStages check → user.authorization.accessibleWorkflowStage); useWorkflowPermissions.js (accessibleStages from stages[].currentUserAssignedRoles) ·
<sup>e</sup> useWorkflowPermissions.js (canEditPublication = canCurrentUserChangeMetadata; its author-side published/scheduled-version block is inert — undefined constants, AD-D); maps/Schema.php canChangeMetadata() (stage-assignment canChangeMetadata flag); Repository::canEditPublication(); live-probed 2026-07-11, adversarially re-verified 2026-07-11 (incl. granting/revoking through the editor's participants UI): no grant → Save disabled, direct API save (POST) 401 "You are not allowed to edit this publication."; with grant → saves persist (DB-verified); publish auto-clears canChangeMetadata on author assignments; re-grant after publish → Save enabled, click → save POST 401 accessibleWorkflowStage + generic error toast that auto-dismisses after a few seconds (test note: poll for it) (AD-D); see also submission-wizard-metadata spec footnote c ·
<sup>f</sup> workflowConfigAuthorOJS.js PublicationConfig.contributors (ContributorManager mounted WITHOUT the canEdit prop — contrast workflowConfigEditorialOJS.js:911 canEdit: permissions.canEditPublication); ContributorManager.vue (canEdit required Boolean → undefined/falsy); live-probed 2026-07-11, adversarially re-verified 2026-07-11 (author WITH grant: "Preview" only — AD-A) ·
<sup>g</sup> workflowConfigAuthorOJS.js EXTERNAL_REVIEW getActionItems (workflow.uploadRevisions on round statuses REVISIONS_REQUESTED / RESUBMIT_FOR_REVIEW / REVISIONS_SUBMITTED); useDashboardConfigEditorialActivity.js getEditorialActivityForMySubmissions() (dashboard.submitRevisions); FileManagerConfigurations.WORKFLOW_REVIEW_REVISIONS (Author: list/upload/edit/delete) ·
<sup>h</sup> PKPAuthorDashboardHandler::readSubmissionEmail() (matches the requested id against EDITOR_NOTIFY_AUTHOR entries addressed to the current user; falls through silently otherwise); PKPEmailController::getMany() (authorEmails route, Author-role gate + recipient filter); live-probed 2026-07-11: foreign email id with own submission → 200 empty body (empty popup); junk id → empty; foreign submission id → access-denied page, no foreign content ·
<sup>i</sup> workflowConfigAuthorOJS.js (DiscussionManager on all four stages) ·
<sup>j</sup> PKPAuthorDashboardHandler::__construct() addRoleAssignment(ROLE_ID_AUTHOR); AuthorDashboardAccessPolicy (SubmissionAccessPolicy + UserAccessibleWorkflowStageRequiredPolicy WORKFLOW_TYPE_AUTHOR); live-probed 2026-07-11: submitter and co-author both land with the tracking view open; author-not-on-submission → authorizationDenied?message=accessibleWorkflowStage ("You don't currently have access to that stage of the workflow."); no author role → authorizationDenied?message=authorRoleMissing ("You do not currently have sufficient privileges to view the submission. Please edit your profile to ensure that you have been granted the appropriate roles under \"Register As\".") — role gate fires before the assignment gate ·
<sup>k</sup> PKPTemplateManager::setupBackendPage() (newSubmission link, gated on !disableSubmissions; placement per role mix); live-probed 2026-07-11 (submissions-disabled journal: zero start entries, rest of nav unchanged)

## Fields & validation

The page has no data-entry forms; its inputs are list controls. The **search box**
(top right, labelled "Search submissions, ID, authors, keywords, etc.") narrows the
current view as you type a phrase. The **"Filters" button** (top left) opens a side
panel titled "Filters" with "Clear Filters" and "Apply Filters" buttons; every
filter is optional: <sup>a</sup>

| Field (UI label) | Required? | Rules |
|------------------|-----------|-------|
| **Section** | No | Checkbox per journal section; hidden when the journal has only one section <sup>b</sup> |
| **Issues** | No | Issue picker (starts at "Selected: None"); hidden when the journal has no issues yet <sup>c</sup> |
| **Category** | No | Category picker with browse dialog; hidden when the journal has no categories <sup>d</sup> |
| **Days since last activity** | No | A 0–180 slider; 0 means no restriction <sup>e</sup> |
| **Assigned To Editor** | No | ⚠ Not an author's filter — it appears in this panel only when the visitor *also* holds Journal Manager or Site Administrator in the journal, because the panel is built from all the visitor's roles, not the page's; on this page applying it changes nothing — the chip and address update but the rows never do (Known deviations, AD-B) <sup>f</sup> |

<sup>a</sup> useDashboardConfig.js getLeftControls()/getRightControls(); DashboardControlSearch.vue (editor.submission.search); dashboardPageStore.js openFiltersModal(); live-probed 2026-07-11 (label/placeholder verbatim; panel roster for a pure author on a multi-section journal with categories: Section, Issues, Categories, Days since last activity) ·
<sup>b</sup> PKPSubmissionFilters::addSectionFields() (hidden when count($sections)===1) ·
<sup>c</sup> APP SubmissionFilters::addIssues() (hidden when no issue exists; OJS-only field) ·
<sup>d</sup> PKPSubmissionFilters::addCategories() ·
<sup>e</sup> PKPSubmissionFilters::addDaysSinceLastActivity() (FieldSlider 0–180) ·
<sup>f</sup> PKPSubmissionFilters::addAssignedTo() (isManagerOrAdmin() over $userRoles); PKPDashboardHandler::index() passes the user's FULL context role list to getSubmissionFiltersForm(), not selectedRoleIds; live-probed 2026-07-11: label verbatim "Assigned To Editor" (singular); visible to an author+manager, never to a pure author; server-side no-op on My Submissions (the endpoint ignores assignedTo and hard-sets the current user); lossy URL round-trip → "assignedTo=undefined" with a chip "Assigned To Editor: " (AD-B)

## Rules & state

**The views (left navigation) and what lands in each**

1. An author's submissions are grouped into **seven views**, listed in this order
   under "My Submissions as Author" in the left navigation, each with a count badge:
   - **Active submissions** — everything still in the editorial process (submitted
     and in any stage before a final outcome); scheduled, published and declined
     submissions never appear here. ⚠ Drafts also count and appear here — the
     double-listing is the drafts spec's (its Open question 4).
   - **Revisions requested** — submissions whose current review round asks the author
     for revisions, under either editor decision: **"Request Revisions"** (the author
     revises within the same round) or **"Resubmit for Review"** (the revisions go to
     a new review round) — decision mechanics: editorial-decisions spec.
   - **Revisions submitted** — submissions where the author's revisions have been
     handed in and await the editor.
   - **Incomplete submissions** — drafts only; owned by the submission-drafts spec.
   - **Scheduled for publication** — accepted and scheduled in an issue, not yet
     published.
   - **Published** — published submissions.
   - **Declined** — submissions the editors declined.
   A submission can sit in more than one view at once (e.g. Active + Revisions
   requested). The author-facing "Revisions submitted" view is labelled slightly
   differently from the editors' equivalent view ("Author revisions submitted" on
   their dashboard) — same underlying membership. ⚠ For an Author who is also a
   Journal Manager or Site Administrator, the two revisions views' tables overrun
   their badges with other people's submissions (Known deviations, AD-H). <sup>a</sup>
2. Opening My Submissions lands on the **first view, Active submissions**; the page
   heading is the view's name with the row count in parentheses, e.g. "Active
   submissions (2)". A view with no rows shows "No Items". Which view is open is
   recorded in the page address, so a view can be bookmarked; an address naming a
   view that does not exist falls back to the first view. <sup>b</sup>
3. **Switching views clears the search phrase — but ⚠ not the filters**: an active
   filter (say, a Section) survives the view switch (Known deviations). The search
   and filters live in the address, so a filtered search is shareable and restores
   on a fresh load. Active filters are shown as removable chips between the
   controls and the table. <sup>c</sup>

**Row anatomy (submitted submissions)**

4. The table has five columns: **ID** (sortable), **Submissions** (the authors and
   title), **Stage**, **Editorial Activity**, **Actions** — there is no
   "days" column here, unlike the editors' dashboard. The **Stage** cell is a badge
   naming where the submission is: "Incomplete" (drafts), "Submission", "Review
   (Round N)" — always the latest round —, "Copyediting", "Production", and for end
   states "Scheduled", "Published", "Declined". <sup>d</sup>
5. The **Editorial Activity** cell tells the author what is happening, and offers an
   action only when the author has one:
   - Current review round asks for revisions (under either of the two decisions
     rule 1 names): an alert reading "Revision requested" plus a **"Submit
     revisions"** button that
     opens the file-upload wizard directly from the list (upload semantics:
     review-rounds feature).
   - Any other review-stage state — including right after the author hands in
     revisions, and on a submission declined after review: a compact review-progress
     indicator ("Review update N/M" — completed reviews out of total), with no
     reviewer names anywhere. There is never a "Revisions submitted" text alert.
   - Copyediting: "Copyedited Files Uploaded: N" (shown even when N is 0).
   - Scheduled with an issue: a note naming the issue, e.g. "To be published in
     issue Vol. 2 No. 1 (2026)".
   - Submission stage and Published: the cell is empty — no alert is shown.
   - Drafts: the "Complete submission" button (drafts spec).
   <sup>e</sup>
6. The **Actions** cell of every submitted row holds **"View"**, which opens the
   tracking view; on this page it is never withheld from a submitted row (the
   editors' dashboard hides it in some multi-role cases — that rule is theirs).
   <sup>f</sup>

**The tracking view (the author's workflow panel)**

7. View opens the tracking view as a **panel over the list** (the list stays
   behind; closing the panel returns to the list and refreshes it). The submission it
   shows is recorded in the page address, so the tracking view itself is
   bookmarkable — this is also how the legacy redirect works (rule 12). Its left
   menu has two sections: **Workflow** — Submission, Review (with a "Review Round N"
   entry per round; a submission that never entered review, such as a desk-declined
   one, shows Review with no round entries), Copyediting, Production, the active
   stage marked with a colored stripe — and **Publication** — one expandable section per version (named like
   "Version of Record 1.0", "1.1"), each holding: Title & Abstract, Contributors,
   Metadata, References (only if the journal collects references), Data (only if
   data citations/availability are enabled), Galleys, Media. There is **no version
   dropdown** for authors: versions are switched from these left-menu sections, and
   each publication page tops with a status chip naming the version's state —
   "Published" on a published version, "Scheduled" on a scheduled one (the chip's
   exact wording on a version that is neither is unprobed).
   The author's menu never shows the editor-only publication pages (Identifiers,
   JATS XML, Body Text, Permissions & Disclosure, Publication Settings, Create New
   Version). Where the panel opens depends on the submission's state:
   - in an active stage — on that stage (in review, on the **current** round);
   - scheduled or published — on the latest version's Title & Abstract;
   - declined after review — on the last review round, whose status reads
     "Submission declined."; desk-declined — on the Submission stage.
   A **"Library"** button in the panel header opens the submission library's
   documents. <sup>g</sup>
8. Every stage view the author may see starts with the submission's **status**: the
   current language line ("Current Submission Language:" — with no change control
   for authors) followed by a "Status" heading and, under it, a short sentence
   saying where the stage stands (probed examples in review: a declined round reads
   "Submission declined.", a round whose revisions await a new round reads
   "Revisions submitted. A new review round needs to be created."; other states'
   exact wording unprobed). A stage the submission has not reached yet keeps that
   same frame — the language line, then the "Status" heading — but under the
   heading shows only "The {stage} stage has not yet been initiated.", with no
   panels after it. A stage the journal's Author role does not cover shows the
   access sentence **alone**: "You don't currently have access to that stage of
   the workflow." — no language line, no "Status" heading, no panels. <sup>h</sup>
9. **Per-stage panels** in the author's tracking view:
   - **Submission stage**: "Submission Files — Files uploaded at the time of
     submission" with a "Download All Files" button; the only per-file action is
     "Update File Details" — the author cannot add files here after submitting —
     plus the stage's discussions panel, titled "Desk Review Tasks & Discussions".
   - **Review stage** (per round): a **"Notifications"** listing of the editor's
     notification emails — present only once at least one such email exists, and
     covering the whole submission, so a later round repeats the earlier rounds'
     emails (rule 11); a **"Reviewers"** table that lists a reviewer **only when
     their review is completed and was conducted openly** — anonymous and
     double-anonymous reviews are omitted entirely (not name-redacted), while a
     completed open review shows the reviewer's real name with a "Read Review"
     action (the review type — open, anonymous, double-anonymous — is chosen when
     the editor assigns the reviewer: assign-and-manage-reviewers spec); the
     "Revisions Uploaded" file list, where the author can upload, edit
     and delete their revision files; "Review Tasks & Discussions"; and — when the
     round asks for revisions (either decision — rule 1), requests an author
     response, or is accepted (the editor actions behind these states:
     editorial-decisions spec for the decisions, review-rounds-and-revisions for
     the response request) — the author's response area, reading "Author Response"
     and "Respond to Reviews" with a "Submit Response" button, which disappears
     once the response or revisions are handed in (boundary: the response-request
     flow and revision rules are the review-rounds feature's). An **"Upload
     revisions"** button appears while the round asks for revisions (either
     decision — rule 1) or has received same-round revisions — ⚠ but wrongly
     vanishes right after an upload on the new-round path (Known deviations, AD-E).
   - **Copyediting**: "Copyediting Tasks & Discussions" and the read-only
     "Copyedited Files" list (each file is just a download link).
   - **Production**: "Production Tasks & Discussions" only.
   <sup>i</sup>
10. **Publication pages are read-mostly.** Title & Abstract and Metadata are real
    forms: without the metadata-edit grant the fields accept typing but Save stays
    disabled and nothing persists; with the grant (and no version scheduled or
    published — permissions table) saves work and persist. Multilingual fields show
    one tab per journal language and a per-field completion counter counting the
    journal's languages (it reads like "1/2 languages completed" on a two-language
    journal). Contributors is a
    list whose only control per row is "Preview" — no add, edit, delete, reorder or
    set-primary, grant or not ⚠; Galleys and Media are bare lists (no add, edit,
    sort or delete); References is editable only with the same metadata grant.
    Publishing a version clears the grant automatically. A published version's
    pages carry the banner "This version has been published and can not be
    edited." — ⚠ yet an author re-granted metadata edits after publication still
    sees an enabled Save there (Known deviations, AD-D). Versions are switched from
    the left menu (rule 7 — no dropdown). <sup>j</sup>

**The read-email popup**

11. In the review stage's "Notifications" listing, each entry is an email the editor
    sent this author about this submission (typically the decision notification),
    shown as its subject and sent date; clicking the subject opens a popup titled
    "Notifications" rendering the email's subject, date and body. Only mail the
    current user received qualifies — no screen ever offers someone else's email,
    and a request crafted for one shows an empty popup rather than an error, with
    nothing of the foreign email leaking (not verifiable from the screens —
    automation-only). Nothing is marked "read": the listing looks the same before
    and after opening. The listing appears only on the review stage. (Background,
    not verifiable from the screens: the machinery behind the listing also
    recognizes copyediting/production notification email types, but nothing sends
    those any more, so extending the listing to other stages would list
    nothing.) <sup>k</sup>

**Legacy URLs**

12. Old author-dashboard bookmarks still work. The pre-3.5 address for a
    submission's author page is the journal's web address followed by
    /authorDashboard/submission/ and the submission's number; typing or following
    it lands on My Submissions with that submission's tracking view open — for the
    submitting author and added co-authors alike. Anyone else is refused with an
    ordinary page, never an error
    screen: a user without the Author role is asked to add the role to their
    profile, while an author not on that submission is told they lack access to
    that stage (permissions table). <sup>l</sup>
13. The rest of the legacy author-dashboard area is documented-dead housekeeping
    (not verifiable from the screens): it declares a review-round-info page that no
    code implements, plus setup code nothing can reach, kept only as an atlas note
    (Known deviations). The one screen-testable line: typing the old
    review-round-info address shows a not-found page. <sup>m</sup>

**Multi-role users**

14. The left navigation builds one section per role family, in this order: **"Editor
    Dashboard"** (Journal Manager, Section Editor, Assistant, Site Administrator),
    **"My Assignments as Reviewer"** (Reviewer), **"My Submissions as Author"**
    (Author) — a user with all three roles sees all three sections, each expanding
    to that page's views with count badges. The **"Start A New Submission"** link is
    added exactly once, as the last entry of one section: Editor Dashboard's when
    the user has any editorial role, otherwise My Submissions'; a user whose only
    role is Reader gets a single **"New Submission"** entry instead. When the
    journal has disabled submissions, no start entry appears anywhere and the rest
    of the navigation is unchanged. After login, the same priority picks the
    landing page: editorial roles → Editor Dashboard, else Reviewer → assignments,
    else Author → My Submissions. <sup>n</sup>
15. On My Submissions the tracking view is **always the author's view** — even for a
    user who is also a Journal Manager: the editor-grade panels (decisions,
    participants, activity log) never appear here; to act as an editor they must
    open the same submission from the editorial dashboard. (The mirror rule — the
    editorial dashboard warning an editor off submissions where they are the author
    — belongs to editorial-dashboards.) <sup>o</sup>

<sup>a</sup> Repository::mapDashboardViews() author-role cases (TYPE_ACTIVE, TYPE_REVISIONS_REQUESTED, TYPE_REVISIONS_SUBMITTED, TYPE_INCOMPLETE_SUBMISSIONS, TYPE_SCHEDULED, TYPE_PUBLISHED, TYPE_DECLINED — order = DashboardView::getTypes() constant order), filterViewsByUserRoles(); labels submission.dashboard.view.* ; author label fork Repository.php:1245 (submission.list.revisionsSubmitted "Revisions submitted" vs submission.dashboard.view.revisionsSubmitted "Author revisions submitted"); SideNav.vue (viewsCount badges via GET api/v1/_submissions/viewsCount; badge accessible name reads "N {view label}", e.g. "2 Active submissions"); Published-view membership keys on the submission reaching the final workflow stage (TYPE_PUBLISHED collector filterByStageIds([WORKFLOW_STAGE_ID_DONE])), not on publication status; live-probed 2026-07-11, adversarially re-verified 2026-07-11 (views/order/labels/badges/headings re-driven): 7 views, order and labels verbatim, currentViewId values active/revisions-requested/revisions-submitted/incomplete-submissions/scheduled/published/declined; scheduled+published+declined excluded from Active; RESUBMIT_FOR_REVIEW_SUBMITTED submissions do NOT join Revisions submitted (AD-E) ·
<sup>b</sup> DashboardPage.vue h1 (`${currentView.name} (${itemCount})`); dashboardPageStore.js currentViewId (queryParamsUrl.currentViewId, fallback views[0]); live-probed 2026-07-11 (heading format; "No Items" empty state) ·
<sup>c</sup> dashboardPageStore.js watch on currentViewId (clearFiltersForm + resetSearchPhrase — but the URL re-init restores the filters the store just cleared), filtersFormQueryParams→URL sync; DashboardActiveFilters.vue (chips, remove aria "Clear filter: …"); live-probed 2026-07-11, adversarially re-verified 2026-07-11 (AD-G reproduced): sectionIds survives view switches, searchPhrase does not; search + section filter both restore on a fresh load ·
<sup>d</sup> useDashboardConfig.js getColumns() MY_SUBMISSIONS branch (ID sortable / navigation.submissions / workflow.stage / stats.editorialActivity / admin.jobs.list.actions; no Days column); DashboardCellSubmissionStage.vue; useSubmission.js getExtendedStage()/ExtendedStagesLabels (submissions.incomplete, manager.publication.submissionStage, submission.stage.externalReviewWithRound, submission.copyediting, manager.publication.productionStage, submission.status.scheduled, submission.stage.published, submissions.declined; round = last round of stage); live-probed 2026-07-11, adversarially re-verified 2026-07-11 (row anatomy re-driven: headers "ID Sort | Submissions | Stage | Editorial Activity | Actions"; badges verbatim incl. "Review (Round 2)" = latest round; editor dashboard has "Days Sort", this page doesn't) ·
<sup>e</sup> useDashboardConfigEditorialActivity.js getEditorialActivityForMySubmissions() (dashboard.revisionRequested "Revision requested" + dashboard.submitRevisions on REVISIONS_REQUESTED/RESUBMIT_FOR_REVIEW; else DashboardCellSubmissionActivityReviewsUpdate/-Open; dashboard.copyEditedFilesUploaded; dashboard.toBePublishedInIssue; empty object otherwise); live-probed 2026-07-11, adversarially re-verified 2026-07-11: post-upload cell "Review update 1/1" (no alert — AD-F reproduced); declined-after-review cell "Review update 0/0" (desk-declined cell unprobed, expected empty — the row opens at the Submission stage); "Copyedited Files Uploaded: 0" renders at N=0; "To be published in issue Vol. 2 No. 1 (2026)"; the author-facing payload nulls reviewer identities (names/usernames/initials, canLoginAs/canGossip false) though per-assignment status strings + dates are exposed ·
<sup>f</sup> DashboardCellSubmissionActions.vue (common.view; suppression branch is EDITORIAL_DASHBOARD-only) ·
<sup>g</sup> dashboardPageStore.js openWorkflowModal()/onClose (workflowSubmissionId query param; refetch on close); useWorkflowNavigationConfigOJS.js getMenuItems()/getWorkflowItems()/getPublicationItemsAuthor()/getInitialSelectionItemKey(); WorkflowPublicationVersionControl (status chip; no author dropdown); workflowConfigAuthorOJS.js getHeaderItems() (editor.submissionLibrary "Library" → WORKFLOW_VIEW_LIBRARY → modals.documentLibrary.DocumentLibraryHandler); live-probed 2026-07-11, adversarially re-verified 2026-07-11 (declined landings re-driven): author Publication menu roster + editor-contrast never-list; all initial-selection branches incl. declined-from-review → review round ("Submission declined.") and desk-declined → Submission stage with a round-less Review menu entry; scheduled opens latest version Title & Abstract (badge "Scheduled", no banner) ·
<sup>h</sup> workflowConfigAuthorOJS.js common.getPrimaryItems (WorkflowChangeSubmissionLanguage with canChangeSubmissionLanguage:false; WorkflowSubmissionStatus; shouldContinue=false for unstarted stages); WorkflowSubmissionStatus.vue (workflow.stageNotStarted); submission.list.changeSubmissionLanguage.currentLanguage; live-probed 2026-07-11 (both sentences verbatim; uncovered stage — Author group without that stage — renders the access sentence alone, no language line) ·
<sup>i</sup> workflowConfigAuthorOJS.js per-stage getPrimaryItems/getActionItems (WorkflowListingEmails, mounted only when ≥1 email returns; ReviewerManager redactedForAuthors:true, gated on getOpenAndCompletedReviewAssignmentsForRound; FileManager namespaces SUBMISSION_FILES / WORKFLOW_REVIEW_REVISIONS / COPYEDITED_FILES; DiscussionManager; AuthorResponseManager on isAuthorResponseRequested / ACCEPTED / REVISIONS_REQUESTED; workflow.uploadRevisions gate at workflowConfigAuthorOJS.js:222-227 — REVISIONS_SUBMITTED listed twice, RESUBMIT_FOR_REVIEW_SUBMITTED omitted, AD-E); useFileManagerConfig.js (Author: SUBMISSION_FILES list/edit/download-all; WORKFLOW_REVIEW_REVISIONS list/upload/edit/delete; COPYEDITED_FILES list); live-probed 2026-07-11, adversarially re-verified 2026-07-11: "Update File Details" is the sole file action on the Submission stage; Submission-stage discussions panel titled "Desk Review Tasks & Discussions" (submission.queries.submission); Notifications listing submission-wide (round 2 shows round-1-era emails); Reviewers table = completed OPEN reviews only (real name + "Read Review"), anonymous/double-anonymous omitted; Upload-revisions present on revisions-requested / resubmit-for-review / same-round revisions-submitted, absent on RESUBMIT_FOR_REVIEW_SUBMITTED (AD-E reproduced twice); Author Response present on revisions-requested / accepted / response-requested, gone at both submitted statuses ·
<sup>j</sup> workflowConfigAuthorOJS.js PublicationConfig (titleAbstract/metadata/citations canEdit:permissions.canEditPublication; contributors WITHOUT canEdit; galleys/media managers); useGalleyManagerConfig.js (Author: GALLEY_LIST only); useMediaFileManagerConfig.js (Author: MEDIA_FILE_LIST only); publication.editDisabled (banner verbatim); live-probed 2026-07-11: typeable + disabled Save without grant, persisting saves with grant (DB-verified); language tabs "French (Canada) | English" + "N/2 languages completed" badges; Contributors "Preview"-only with grant (AD-A); Galleys "PDF / English" and Media bare tables — a "MORE ACTIONS" column header renders with no controls; publish auto-clears the grant; re-grant Save-enabled hole = AD-D ·
<sup>k</sup> WorkflowListingEmails.vue (notification.notifications; GET emails/authorEmails?submissionId&eventType=EDITOR_NOTIFY_AUTHOR; fetch wired for external-review stage only, comment "currently only used in review stage"); PKPEmailController::getMany() (allowed types incl. COPYEDIT_NOTIFY_AUTHOR, PROOFREAD_NOTIFY_AUTHOR — but those event types have no producers any more, live-verified 2026-07-11: Copyediting/Production views show no listing even when the API returns the review-stage email); PKPAuthorDashboardHandler::readSubmissionEmail() (recipient-filtered; silent fall-through on mismatch; renders authorDashboard/submissionEmail.tpl subject/date/body); live-probed 2026-07-11: entry = subject + date ("2026-07-11 01:27 PM"); side modal titled "Notifications"; foreign email id → 200 empty body; junk id → empty; foreign submission id → denial page, no content; nothing marked read ·
<sup>l</sup> AuthorDashboardHandler (APP) inherited submission(): redirect to dashboard/mySubmissions?workflowSubmissionId={id}&currentViewId=active&workflowMenuKey=… (302; live-probed 2026-07-11, adversarially re-verified 2026-07-11, submitter + co-author; denial messages in permissions footnote j) ·
<sup>m</sup> pages/authorDashboard/index.php routes 'reviewRoundInfo' with no handler method ("404 Not Found" re-probed live 2026-07-11, atlas PAGE-authordashboard-reviewroundinfo); PKPAuthorDashboardHandler::setupTemplate() uncalled, would fatal on undefined $citationsForm (atlas grids sweep 2026-07-03) ·
<sup>n</sup> PKPTemplateManager::setupBackendPage() menu build (navigation.dashboards "Editor Dashboard" / navigation.reviewAssignments "My Assignments as Reviewer" / navigation.mySubmissions "My Submissions as Author"; $isNewSubmissionLinkPresent; reader-only author.submit branch — OJS en renders "New Submission"); PKPPageRouter::getHomeUrl() (editorial > reviewer > author > submissions); live-probed 2026-07-11 (section order; Start A New Submission once, last item of Editor Dashboard's submenu for a manager+reviewer+author, last item of My Submissions for a pure author; disabled-submissions journal: zero start entries) ·
<sup>o</sup> useWorkflowConfigOJS.js (EDITORIAL_DASHBOARD → editorial config, everything else → author config — keyed on the page, not the user's roles); live-probed 2026-07-11 (manager+author from My Submissions: author variant, header "Library" only, no decision buttons / Participants / activity log)

## Side effects

Tracking is deliberately inert — the page changes nothing by being looked at:

- Opening the tracking view, a stage, a publication page or the read-email popup
  records nothing and notifies no one: the submission's Activity Log — an
  editor-side panel on the editorial workflow (editorial-dashboards spec) — gains
  no entry, and the author's own screens offer no log to check; the read-email
  popup does not even mark the notification email as read (rule 11). <sup>a</sup>
- Closing the tracking view refreshes the list and the view count badges without a
  page reload (the badges may settle a moment after the rows). <sup>b</sup>
- Actions that do have side effects — uploading revisions, posting a discussion
  reply, editing granted metadata — belong to the features that own them
  (review-rounds, tasks-discussions, publication metadata); this page only hosts
  their buttons.

<sup>a</sup> PKPAuthorDashboardHandler::readSubmissionEmail() (read-only fetch; no write); atlas PAGE-authordashboard-readsubmissionemail ("nothing is marked read", verified 2026-07-03) ·
<sup>b</sup> dashboardPageStore.js onClose → fetchSubmissions() → appStore.triggerReloadViewsCount() (throttled). Test guidance: poll the badges rather than read once — the drafts spec once observed ~10 s of lag on this machinery, while 2026-07-11 probes here saw ≤1 s in two runs; do not assert a fixed lag either way

## Settings that modify behavior

- **Disable submissions** (Settings → Workflow → Submission): removes the "Start A
  New Submission" link from the navigation; existing submissions and this page are
  untouched. <sup>a</sup>
- **References** (Settings → Workflow → Submission → Metadata — the References
  dial): when the journal collects references, a "References" page joins the
  author's Publication menu. **Data Citations / Data Availability** (the same
  Metadata tab's dials): when either is enabled, a "Data" page joins it. Which
  fields the Metadata page offers follows the journal's metadata settings
  (submission-wizard-metadata spec). <sup>b</sup>
- **Journal structure feeds the filters**: a second section enables the Section
  filter, a first issue the Issues filter, categories the Category filter
  (Fields & validation). <sup>c</sup>
- **Author role stage assignment** (Settings → Users & Roles, editing the Author
  role — the stage-assignment checkboxes): a stage left unchecked is uncovered for
  authors, and the tracking view shows the no-access sentence there instead of
  panels (rule 8; permissions table).
- The per-assignment **metadata-edit grant** is the switch that turns the author's
  Title & Abstract/Metadata/References pages editable (rule 10). An editor sets it
  from the workflow's **Participants** panel: the author row's "More Actions" menu →
  the Edit dialog → the metadata-edit checkbox (exact checkbox wording unprobed;
  granting/revoking mechanics: stage-participants feature).
- No config.inc.php variables alter these rules.

<sup>a</sup> PKPTemplateManager::setupBackendPage() (!disableSubmissions gate) ·
<sup>b</sup> useWorkflowNavigationConfigOJS.js getPublicationItemsAuthor() (supportsCitations, supportsDataCitations/supportsDataAvailability from pageInitConfig.publicationSettings ← PKPDashboardHandler::index()) ·
<sup>c</sup> SubmissionFilters (APP) / PKPSubmissionFilters (conditional fields)

## Cross-feature interactions

- **submission-drafts** — owns everything draft-shaped on this page: the Incomplete
  submissions view, the "Incomplete" badge, "Complete submission", the missing View
  button on draft rows, the bulk-delete tool, and the drafts-in-Active
  double-listing. This spec owns the page frame they sit in.
- **submission-wizard / submission-wizard-metadata** — the wizard itself and the
  metadata-settings dial; the New Submission link here just points at the wizard.
  The author's typeable-but-unsavable Metadata page is recorded there (footnote c);
  this spec cites it, not re-derives it.
- **editorial-decisions** (pending) — owns the editor decisions whose outcomes this
  page reflects ("Request Revisions", "Resubmit for Review", accept, decline); this
  spec only names them where the author sees their effects (rules 1, 5, 9).
- **review-rounds-and-revisions** (pending) — owns revision-upload semantics, the
  author response request flow, and what a redacted review looks like when opened;
  this spec owns only where those affordances surface on the author's screens.
- **tasks-discussions** — owns the Tasks & Discussions panels the tracking view
  mounts on every stage (authors create/reply per that spec's permissions table).
- **editorial-dashboards** (pending) — owns the views/table machinery both pages
  share (counts endpoint, filters modal, sorting), the editor-side pages, and the
  multi-role warnings shown to editors about their own submissions.
- **reviewer-suggestions** — verified there: the author's tracking view has no
  suggestions surface post-submit.
- **stage-participants** — owns granting/revoking the metadata-edit flag this page
  reacts to.
- **galleys / media-files / publication metadata specs** — own the managers the
  publication pages mount; this spec owns the fact that the author gets list-only
  variants.

## Canonical scenarios

1. **An author tracks a fresh submission** — an author with one just-submitted
   submission opens "My Submissions as Author" in the left navigation. The page
   heading reads "Active submissions (1)"; the row shows the submission's ID, authors
   and title, a "Submission" stage badge, an empty Editorial Activity cell, and
   "View" under Actions. Pressing View opens a panel over the list: the left menu
   shows Workflow (Submission, Review, Copyediting, Production) and Publication
   (one version, expanding to Title & Abstract, Contributors, Metadata, Galleys,
   Media — the journal here collects neither references nor data statements;
   otherwise References and Data pages join the menu). The Submission stage shows
   "Submission Files" — the files uploaded at
   submission, with a "Download All Files" button and "Update File Details" as the
   only per-file action — and a "Desk Review Tasks & Discussions" area; selecting
   Copyediting shows the "Current Submission Language:" line, then a "Status"
   heading with only "The Copyediting stage has not yet been initiated." under it —
   no other panels. Closing the panel returns to the unchanged list.
2. **Revisions round-trip** — an editor requests revisions within the same round
   (the "Request Revisions" decision). On the author's My Submissions, the
   "Revisions requested" view now counts 1, and the row's Editorial Activity says
   "Revision requested" with a "Submit revisions" button. Inside the tracking
   view's Review Round 1, the author sees a "Notifications" listing with the
   editor's decision email, a "Revisions Uploaded" file area, and an "Upload
   revisions" button — either that button or the list row's "Submit revisions"
   takes in the files; this scenario walks the list's. The author presses "Submit
   revisions": a three-step upload wizard (Upload File, Review Details, Confirm)
   opens right over the list; they upload a file and press "Complete". The list
   refreshes without a page
   reload: the submission leaves "Revisions requested" for the "Revisions
   submitted" view, and its Editorial Activity now shows the compact
   review-progress indicator ("Review update …") — no "Revisions submitted" text
   alert appears, and the "Upload revisions" button is still there for further
   same-round files.
3. **What an author can and can't touch** — an author without the metadata-edit
   grant opens their submission's Publication section. On Title & Abstract the
   fields accept typing but the Save button stays disabled and nothing persists; on
   Metadata the same. Contributors lists the authors with only a "Preview" button
   on each row — no Add Contributor, no edit or delete anywhere (⚠ even a
   metadata-edit grant does not unlock it — Known deviations, AD-A); Galleys and
   Media are bare lists with no add or edit controls. The stage views show "Current
   Submission Language:" with no change link, and the panel header offers only
   "Library". After an editor grants metadata edits, Save comes alive on Title &
   Abstract and Metadata and a saved change survives a reload.
4. **Multi-role navigation** — a user who is Journal Manager, Reviewer and Author in
   the journal signs in and lands on the editorial dashboard. Their left navigation
   shows three sections in order: "Editor Dashboard", "My Assignments as Reviewer",
   "My Submissions as Author", each expanding to its views with count badges.
   "Start A New Submission" appears exactly once, as the last item of Editor
   Dashboard's submenu — not under My Submissions. Opening their own submission
   from My Submissions shows the
   author tracking view (no decision buttons, no participants panel) even though
   they are a manager; the same submission opened from the editorial dashboard is
   another feature's story.
5. **An old bookmark and an editor's email** — the author follows a years-old
   author-dashboard link to their submission — or types the old address by hand:
   the journal's web address plus /authorDashboard/submission/ and the
   submission's number (rule 12). They land on My Submissions with that
   submission's tracking view already open. In the Review stage's "Notifications"
   listing they click the decision email's subject: a popup titled "Notifications"
   shows the email's subject, sent date and full body. Closing and reopening the
   listing looks exactly the same — nothing is marked read.
6. **End states: published and declined** — an author with one published submission
   and one declined after review opens My Submissions. "Published" counts 1 (row
   badge "Published") and "Declined" counts 1 (row badge "Declined"); "Active
   submissions" contains neither. The published row's Editorial Activity is empty;
   the declined row still shows the compact review-progress indicator ("Review
   update …"). Both rows still offer View: the published one opens on the latest
   version's Title & Abstract carrying "This version has been published and can not
   be edited.", the declined one opens on its last review round, whose status reads
   "Submission declined.", with its history readable — no upload buttons anywhere
   and no enabled Save on any publication form; the stage "Tasks & Discussions"
   panels remain (acting there: tasks-discussions spec). A
   desk-declined submission opens on the Submission stage instead.

## Known deviations (as-built ≠ intent)

- ⚠ **Author's Contributors panel ignores the metadata-edit grant** (live-probed
  2026-07-11, adversarially re-verified 2026-07-11 — proposed ledger row AD-A):
  a grant-holding author's Contributors
  panel renders with a "Preview" button only — zero add/edit/delete/reorder/
  set-primary — while Title & Abstract and Metadata on the same menu honor the
  grant. The author-side publication config mounts the contributors manager without
  passing the edit flag (workflowConfigAuthorOJS.js PublicationConfig.contributors —
  contrast the editorial config, which passes
  canEdit: permissions.canEditPublication), and the component requires it
  (ContributorManager.vue canEdit required Boolean → falsy). Suspected intent:
  pass the same permission. (The
  required-prop console warning is suppressed by the production Vue build.)
- ⚠ **The author's Metadata page is typeable but unsavable without the grant** —
  owned by submission-wizard-metadata (its footnote c; re-confirmed here
  2026-07-11): fields accept input, Save stays disabled, and a direct save is
  refused server-side (401 "You are not allowed to edit this publication.").
  Cited here because this page is where authors meet it.
- ⚠ **"Assigned To Editor" filter leaks onto My Submissions for multi-role users —
  and is a no-op there** (live-probed 2026-07-11 — proposed ledger row AD-B):
  PKPDashboardHandler::index() builds the filters panel from the visitor's full
  role list, not the page's role (PKPSubmissionFilters::addAssignedTo() checks
  isManagerOrAdmin() over $userRoles), so an author who is also a Journal Manager
  or Site Administrator sees the editor-assignment filter on their author page; a
  pure author never does. Applying it renders a chip and updates the URL but the
  result set never changes — the My-Submissions endpoint ignores the parameter and
  hard-sets the current user (only the editorial endpoint maps it). Bonus defect:
  the URL round-trip is lossy — restoring the address (which omits the label param)
  yields "assignedTo=undefined" and a chip reading "Assigned To Editor: ". LOW,
  cosmetic/incoherent. Suspected intent: build the panel from the page's role.
- ⚠ **Multi-role authors see the whole journal in the two revisions views**
  (live-confirmed by arbitration 2026-07-11 — proposed ledger row AD-H): a user
  holding Author plus Journal Manager (or Site Administrator) who opens My
  Submissions' "Revisions requested" or "Revisions submitted" view sees EVERY
  journal submission in that round state — not just their own — while the sidebar
  badge stays correctly author-scoped (observed: badge 0 beside a 13-row table). A
  pure author is correctly scoped (control passed). The extra rows are submissions
  the manager may legitimately access elsewhere, so this is page-role incoherence —
  the author's page showing the manager's scope — not a privilege breach; but the
  badge/table disagreement is plainly wrong. Root cause: the reviews-listing
  service drops the author scoping for users who can access all submissions —
  PKPBackendSubmissionsController::reviews() applies assignedTo() only when
  !canAccessAllSubmissions() (Journal Manager / Site Administrator), while the
  badges come from the view collectors, which always scope to the author
  (Repository::mapDashboardViews() author cases). MEDIUM — incoherent, confusing,
  though not a leak. Suspected intent: the My Submissions tables always scoped to
  the author's own work, matching their badges.
- ⚠ **View switches clear the search but not the filters** (live-probed 2026-07-11,
  adversarially re-verified 2026-07-11 — proposed ledger row, AD-G in this spec's
  numbering): switching views resets the
  search phrase, but active filters (e.g. a Section) survive the switch — the store
  clears the filters form, then the URL re-initialization restores exactly what was
  just cleared (dashboardPageStore.js currentViewId watcher vs. query-param
  re-init). Suspected intent: search and filters reset together. LOW.
- ⚠ **Published version: Save stays enabled for a re-granted author** (live-probed
  2026-07-11; symptom reproduced twice, root cause arbitrated live 2026-07-11 —
  proposed ledger row AD-D): publishing auto-clears the author's metadata-edit
  grant, so the normal post-publish state is Save disabled. But if an editor
  re-grants metadata edits after publication, the author's Title & Abstract and
  Metadata forms on the published version show the "can not be edited" banner AND
  an enabled Save; clicking it is refused (the save POST returns 401,
  accessibleWorkflowStage) surfaced only as the generic toast "An unexpected error
  has occurred. Please reload the page and try again." — which auto-dismisses
  after a few seconds (test note: poll for the toast rather than asserting after a
  wait). Root cause (corrected by arbitration — the earlier Done-stage-roles
  account was wrong; the Done stage carries the author's roles correctly): the
  interface's author-side safety block compares each version's status against
  status constants that are undefined in the running app, so the comparison never
  matches and the block never fires — Save stays enabled from the re-granted
  permission; the server still refuses (useWorkflowPermissions.js
  hasBlockedPublication reads pkp.const.STATUS_PUBLISHED /
  pkp.const.STATUS_SCHEDULED, but PKPTemplateManager::setupBackendPage() exports
  those constants only nested, as pkp.const.submission.STATUS_* and
  pkp.const.publication.STATUS_*, so both flat reads are undefined). LOW-MEDIUM —
  needs a re-grant to arise, but fails ungracefully. Suspected intent: the block
  compares against the constants as actually exported, forcing the re-granted
  author read-only whenever any version is published or scheduled.
- ⚠ **"Upload revisions" gate mis-lists the resubmit path** (live-probed 2026-07-11,
  adversarially re-verified 2026-07-11 — proposed ledger row AD-E): the button's
  round-status gate
  (workflowConfigAuthorOJS.js:222-227) lists REVISIONS_SUBMITTED twice and omits
  RESUBMIT_FOR_REVIEW_SUBMITTED — the duplicate almost certainly meant the latter.
  Effect: after an upload on the resubmit-for-review path the button vanishes
  (round status text: "Revisions submitted. A new review round needs to be
  created."), while the same-round path keeps it after upload. Related membership
  gap: resubmit-submitted submissions also do not join the author's "Revisions
  submitted" view (its membership excludes that round status), so the author gets
  no list-side signal that their resubmission landed. LOW-MEDIUM. Suspected
  intent: both submitted statuses treated alike — button persists and the view
  includes both.
- ⚠ **No "Revisions submitted" confirmation in the list row** (live-probed
  2026-07-11, adversarially re-verified 2026-07-11 — proposed ledger row AD-F, a
  spec/scenario correction): after the
  author hands in revisions, the row's Editorial Activity shows only the compact
  review-progress indicator ("Review update 1/1") — no alert confirms the revisions
  were submitted; the only signal is the row's move into the "Revisions submitted"
  view. The draft spec (and its scenario 2) asserted a "Revisions submitted" alert
  that does not exist. LOW, UX/documentation.
- ⚠ **Dead legacy author-dashboard code** (atlas-verified 2026-07-03; 404
  re-confirmed live 2026-07-11; cleanup candidate, proposed ledger row AD-C): the
  routed-but-unimplemented review-round-info op (pages/authorDashboard/index.php
  'reviewRoundInfo' → 404); PKPAuthorDashboardHandler::setupTemplate() is uncalled
  and would fatal on an undefined $citationsForm if ever called; four legacy
  grids/templates behind it are suspected-dead (atlas grids rows corrected by this
  feature's earlier probes: AuthorReviewAttachments, AuthorReviewRevisions,
  AuthorSubmissionDetailsFiles; controllers/tab/authorDashboard templates). Not
  user-facing; the live ops are only the redirect and the read-email popup.
- **Drafts double-list in Active submissions** — recorded by submission-drafts
  (its rule 6 / Open question 4); noted here only because Active is this spec's
  view.

## Open questions

1. Contributors: should the author-side panel honor the metadata-edit grant like
   Title & Abstract and Metadata do (i.e. is the missing edit flag an oversight,
   deviation AD-A), or are contributor changes post-submit meant to be editor-only?
2. Are the Galleys and Media publication pages intended for authors at all? For
   most of the workflow they are empty lists the author cannot act on; they render
   for authors unconditionally while the editorial side gates them on production
   access.
3. Should My Submissions be strictly page-role-scoped for multi-role users? Two
   deviations share the theme: the filters panel is built from the visitor's full
   role list (the "Assigned To Editor" leak/no-op, deviation AD-B), and the two
   revisions views' tables drop the author scoping entirely for a Journal Manager
   or Site Administrator while the badges stay author-scoped (deviation AD-H,
   arbitrated live 2026-07-11 — pure authors are unaffected). Is the intended rule
   "on this page, the Author scope always wins" for both?
4. Should the list row confirm handed-in revisions explicitly (a "Revisions
   submitted" alert, deviation AD-F), or is the row's move into the "Revisions
   submitted" view signal enough?

(Settled by the 2026-07-11 probes: the review-only "Notifications" listing is
correct as-built — the copyediting/proofreading notify-author email types have no
producers any more, so extending the listing would list nothing; and the read-email
popup's silent-empty response for a foreign email id leaks nothing — recorded in
rule 11 as as-built behavior. Settled by the 2026-07-11 arbitration: AD-D's
mechanism is the undefined status constants in the author-side safety block — not
a Done-stage roles hole, which was disproved (the Done stage carries the author's
roles correctly); and the multi-role revisions-views scoping anomaly is real and
one-sided — tables unscoped, badges and pure authors correct (AD-H).)

---

<!-- REFERENCE MATERIAL — provenance and campaign bookkeeping, not product-owner
     narrative. The PO-facing "where do I find this" is in Purpose. -->

## Reference — entry points & surfaces

| Entry | Path | Atom |
|-------|------|------|
| My Submissions page | Left nav "My Submissions as Author" → `{journal}/dashboard/mySubmissions?currentViewId={view}` (DashboardHandler with DashboardPage::MySubmissions) | PAGE-dashboard-mysubmissions |
| Tracking view (workflow modal) | Row "View" → same page + `workflowSubmissionId={id}` (+ `workflowMenuKey` for the selected menu item); WorkflowPage side modal, author config | PAGE-dashboard-mysubmissions (shared; VUE-dashboard-page/-table are editorial-dashboards') |
| Legacy author dashboard URL | `{journal}/authorDashboard/submission/{submissionId}` → 302 to `dashboard/mySubmissions?workflowSubmissionId={id}` | PAGE-authordashboard-submission |
| Read-email popup | Review stage "Notifications" listing → `{journal}/authorDashboard/readSubmissionEmail?submissionId={id}&submissionEmailId={emailId}` (JSON, rendered in a LegacyAjax side modal) | PAGE-authordashboard-readsubmissionemail |
| Author emails API | `GET api/v1/emails/authorEmails?submissionId={id}&eventType={type}` (Author role; recipient-scoped) | API-email-get-many |
| Access policy (legacy ops) | AuthorDashboardAccessPolicy (submission access + author-type stage assignment) | AUTHZ-author-dashboard-access-policy |
| Submissions list API | `GET api/v1/_submissions/assigned` / `…/reviews` etc. per view `op` + queryParams; counts via `GET api/v1/_submissions/viewsCount` | (editorial-dashboards' API atoms) |
| Dead op | `{journal}/authorDashboard/reviewRoundInfo` — routed, unimplemented, 404 | PAGE-authordashboard-reviewroundinfo (NOT claimed — dead; see deviations AD-C) |

## Reference — code anchors

- lib/pkp/pages/dashboard/PKPDashboardHandler.php — mySubmissions op (:380), role
  gates (:95–108), DashboardPage enum, getViews() (:406); pages/dashboard/index.php
  (op → page mapping); pages/dashboard/DashboardHandler.php (OJS filters form +
  OJS pageInitConfig: payments, issues count, recommendations)
- lib/pkp/classes/submission/Repository.php — getDashboardViews() (:880),
  mapDashboardViews() (:991; author cases :1007 TYPE_ACTIVE, :1175 TYPE_SCHEDULED,
  :1191 TYPE_PUBLISHED, :1207 TYPE_DECLINED, :1223 TYPE_REVISIONS_REQUESTED, :1236
  TYPE_REVISIONS_SUBMITTED, :1253 TYPE_INCOMPLETE_SUBMISSIONS),
  filterViewsByUserRoles() (:1342); lib/pkp/classes/submission/DashboardView.php
- lib/pkp/pages/authorDashboard/PKPAuthorDashboardHandler.php — submission()
  redirect (:92), readSubmissionEmail() (:108), dead setupTemplate() (:159);
  pages/authorDashboard/{AuthorDashboardHandler.php,index.php};
  lib/pkp/classes/security/authorization/AuthorDashboardAccessPolicy.php
- lib/pkp/api/v1/emails/PKPEmailController.php — authorEmails route (:63, Author
  gate), getMany() recipient/type filters (:98)
- lib/pkp/api/v1/_submissions/PKPBackendSubmissionsController.php — reviews()
  (the two revisions views' table listing; skips assignedTo() when
  canAccessAllSubmissions() — AD-H), getViewsCount() (the author-scoped badges)
- lib/pkp/classes/template/PKPTemplateManager.php — setupBackendPage() nav menu
  (:1141–1239: dashboards/reviewAssignments/mySubmissions sections, newSubmission
  placement, reader-only submit); lib/pkp/classes/core/PKPPageRouter.php
  getHomeUrl() (:401)
- lib/ui-library/src/pages/dashboard/ — dashboardPageStore.js (views/search/filters
  URL sync, openWorkflowModal, openSubmissionWizard), composables/
  useDashboardConfig.js (MY_SUBMISSIONS columns), composables/
  useDashboardConfigEditorialActivity.js getEditorialActivityForMySubmissions(),
  components/DashboardTable/DashboardCellSubmission{Stage,Actions}.vue
- lib/ui-library/src/pages/workflow/ — composables/useWorkflowConfig/
  workflowConfigAuthorOJS.js (per-stage + publication author config),
  useWorkflowConfigOJS.js (page→config selection), composables/
  useWorkflowNavigationConfig/useWorkflowNavigationConfigOJS.js
  (getPublicationItemsAuthor, getInitialSelectionItemKey),
  useWorkflowPermissions.js, components/primary/WorkflowListingEmails.vue,
  components/primary/WorkflowSubmissionStatus.vue
- lib/pkp/classes/submission/maps/Schema.php — canCurrentUserChangeMetadata (:498),
  canChangeMetadata() (:571); lib/pkp/classes/components/forms/dashboard/
  PKPSubmissionFilters.php + classes/components/forms/dashboard/
  SubmissionFilters.php (filter fields)
- lib/ui-library/src/managers — FileManager/useFileManagerConfig.js (author
  permissions per namespace), GalleyManager/useGalleyManagerConfig.js,
  MediaFileManager/useMediaFileManagerConfig.js, ContributorManager/
  ContributorManager.vue (required canEdit prop)
- lib/pkp/templates/authorDashboard/submissionEmail.tpl (popup body);
  lib/pkp/templates/authorDashboard/submissionEmails.tpl (legacy listing, dead)
