---
name: workflow-stage-navigation
scope: The submission workflow panel's shell — its header and stage menu, which stages each person may open, the status notes for stages that aren't current, and the routing that lands people (and old bookmarks) in the right place
shared: pkp-lib
status: verified
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

# Workflow stage navigation

## Purpose

Every submission travels through four stages — Submission, Review, Copyediting,
Production — and the people working on it need one place that shows where it is,
lets them jump between stages, and keeps them out of stages that aren't theirs. That
place is the **workflow panel**: it slides open over the dashboard list when a row's
View button is pressed (or a saved link is followed) and frames everything else —
the submission's identity in the header with a colored stage indicator, a left-hand
menu of stages (review rounds nested under Review) plus the publication's versions,
and a status note when the opened stage isn't the one the submission is in. This
spec owns that shell and its routing, including where the retired
one-page-per-stage addresses land now. What fills each stage — file panels,
reviewer tables, decision buttons — belongs to the per-stage features and to
*editorial-decisions*; how the panel is *reached* from the lists belongs to the
dashboard specs.

## Actors & permissions

Terms used below: *assigned* = has a stage assignment on this submission in a role
they still hold (a lapsed or revoked role doesn't count, even if the assignment row
survives); *stage coverage* = the set of workflow stages a role's user group is
ticked for in the journal's Users & Roles settings — an assignment opens exactly the
stages its group covers. Two baselines: **Site Administrator and Journal Manager**
need no assignment — an unassigned manager may open every stage of any submission in
the journal (⚠ with one wrinkle: a manager who is personally reviewing the
submission is shown the panel as if they had no stage access — Known deviations);
however, once a manager **is** assigned, their access follows the assignment like
anyone else's. **Anonymous** visitors are sent to login. The panel has two
dressings: the **editorial shell** (opened from the editorial dashboard, documented
here) and the author's **tracking view** (opened from My Submissions — owned by the
*author-dashboard* spec). Reviewers never get either: their dashboard rows lead to
their own review pages.

| Action | Who may — and when |
|--------|--------------------|
| **Open the editorial shell** | • Site Administrator, Journal Manager — any submission in the journal<br>• Section Editor, Assistant — when assigned<br>• Author, Reviewer — never this shell (authors get the tracking view; reviewers their review pages)<br>• Which rows offer the View button is the dashboards' rule <sup>a</sup> |
| **See a stage's working panels** (instead of the no-access note) | • Anyone whose assigned role covers that stage<br>• Site Administrator, Journal Manager — every stage while unassigned <sup>b</sup> |
| **See the Publication menu's version entries** | • Site Administrator, Journal Manager — while unassigned (the baseline)<br>• A Journal Manager, Section Editor or Assistant assigned on the submission's *current* stage<br>• The production-bound entries (Body Text, Galleys, Media, Permissions & Disclosure — the menu's name for the License screen — and Publication Settings) — only with production-stage access on top of that <sup>c</sup> |
| **See the header tools** | • Activity Log — Site Administrator, Journal Manager, or a Section Editor assigned on the current stage<br>• Library — everyone who can open the shell<br>• Preview (relabeled View once published) — everyone who can open the shell, from the moment the submission reaches Copyediting<br>• Return to Workflow — gated on a decision, not a role or an app: shown when the viewer's available decisions include returning the submission to the workflow (in practice: on a published submission), for managers and assigned Section Editors alike; the decision's behavior belongs to *editorial-decisions* <sup>d</sup> |
| **Use a legacy workflow address** | • Site Administrator, Journal Manager, Section Editor, Assistant — same shell access as above, checked before the redirect<br>• Author, Reviewer — sent to an access-denied page reading "You don't currently have access to that stage of the workflow." — never into the workflow<br>• Logged out — asked to sign in first; an allowed person then continues on to the panel <sup>e</sup> |

<sup>a</sup> dashboardPageStore.js openWorkflowModal() (mounts WorkflowPage per dashboard type); editorial-dashboards spec rule 15 (View-button gating); useWorkflowConfigOJS.js (EDITORIAL_DASHBOARD → workflowConfigEditorialOJS, else workflowConfigAuthorOJS); denial side live-probed 2026-07-16 (verification chunk c: author and reviewer deep links → 302 user/authorizationDenied?message=user.authorization.roleBasedAccessDenied — the role-whitelist denial, unlike the legacy ops' accessible-stage sentence; an *unassigned* Section Editor's deep link returns 200 and mounts the dashboard, but the panel renders an empty husk — the submission API answers 401 and no submission content or title appears — so "when assigned" holds substantively) ·
<sup>b</sup> classes/user/Repository::getAccessibleWorkflowStages() (assignments × userGroupStages × still-held roles; manager/admin fallback when none); submission/maps/Schema::getPropertyStages(), getAssignmentRoles() (per-stage currentUserAssignedRoles; dateStart/dateEnd check); useWorkflowPermissions.js (accessibleStages); workflowConfigEditorialOJS.js WorkflowConfig.common.getPrimaryItems; denial + baseline live-probed 2026-07-16 (verification chunk c: stage-4-only assistant saw exactly the no-access sentence on Submission/Review/Production and real content on Copyediting; unassigned Site Administrator walked all four stages with the sentence nowhere) ·
<sup>c</sup> useWorkflowPermissions.js (canAccessPublication = EditorialRoles on active stage; canAccessProduction = EditorialRoles on production stage); useWorkflowNavigationConfigOJS.js getPublicationVersionItems(), getPublicationItemsEditorial(); split live-probed 2026-07-16 (verification chunk c: assistant assigned off the current stage — no version entries, inert Publication header; assistant assigned on the current stage — non-production screens only, no create-version action; manager-role editor — full set plus "Create New Version") ·
<sup>d</sup> workflowConfigEditorialOJS.js getHeaderItems(); useWorkflowPermissions.js (canAccessEditorialHistory: SITE_ADMIN/MANAGER/SUB_EDITOR on active stage); Preview/View block is stage+status-gated only (stageId EDITING/PRODUCTION, common.preview → common.view when STATUS_PUBLISHED), no permission check — live-probed 2026-07-16 (Group C: stage-covering assistant on a Copyediting submission saw Preview + Library, no Activity Log; verification chunk c re-confirmed both directions: same assistant's Preview absent while the submission sat in Review, Activity Log absent for the assistant but present for the manager-role editor); Return to Workflow: addItemIf(isDecisionAvailable(submission, DECISION_RETURN_TO_WORKFLOW)) sits in the OJS, OMP and OPS editorial configs alike — observed 2026-07-26 on a published OMP monograph and a posted OPS preprint (manager and section-editor viewers), so it is a shared decision-gated tool, not an app extra; caveat: the same configs register a sibling "Return to Done" button (DECISION_RETURN_TO_DONE) that no probed state has shown — the header after a return-to-workflow decision was not walked (OPS probe H left it incomplete), so that button's reachability is unconfirmed, recorded here as a caveat rather than a claim ·
<sup>e</sup> WorkflowHandler::__construct() addRoleAssignment([SUB_EDITOR, MANAGER, SITE_ADMIN, ASSISTANT]); PKPWorkflowHandler::authorize() (access op: UserAccessibleWorkflowStageRequiredPolicy WORKFLOW_TYPE_EDITORIAL, roles not re-checked; stage ops: WorkflowStageAccessPolicy); PKPApplication::getWorkflowTypeRoles() (editorial workflow = admin/manager/sub-editor/assistant); live-probed 2026-07-16 (Group A: author + reviewer, access op AND stage-named op → 302 user/authorizationDenied?message=user.authorization.accessibleWorkflowStage — the accessible-stage sentence, not the role-whitelist denial; logged out → login with the legacy URL in `source`, chain resumes to the panel after sign-in); denial side re-probed 2026-07-16 (verification chunk c: author, reviewer AND an unassigned Section Editor each 302 → the accessibleWorkflowStage denial on both the entry-check and stage-named ops, assigned editor as positive control — confirming "same shell access as above" means assigned-only for Section Editors)

## Fields & validation

N/A — the shell is navigation only; it has no user-entered fields.

## Rules & state

**Shell anatomy**

1. The panel header identifies the submission: its ID number above the title area,
   the author list as the heading, the full title beneath it, and a **stage
   indicator** — a colored dot plus label ("bubble") summarizing where the
   submission stands. A spinner beside the ID appears while data refreshes.
   <sup>a</sup>
2. The stage indicator collapses stage + status into one label. Its states:

   | Indicator | When |
   |-----------|------|
   | **Incomplete** | the submission wizard was never finished |
   | **Submission** {OJS OMP} | in the Submission (desk review) stage |
   | **Review (Round N)** {OJS OMP} | in the Review stage — N is the latest round |
   | **Copyediting** {OJS OMP} | in the Copyediting stage, not scheduled or published |
   | **Production** | in the Production stage, not scheduled or published |
   | **Scheduled** | the version of record is assigned to an issue awaiting publication (shown from Copyediting or Production) |
   | **Published** | the version of record is published |
   | **Declined** | declined — this overrides every stage |

   Each state has its own dot color, matching the stage badges used on the
   dashboard lists. Scheduled and Published track the *version of record* only:
   scheduling or publishing an earlier variant (e.g. an Author Original) leaves
   the indicator on the plain stage. <sup>b</sup>

**The stage menu**

3. The left-hand menu opens with a **Workflow** group listing all four stages —
   Submission, Review, Copyediting, Production — for *every* viewer, regardless of
   which stages they may access: the menu never hides or locks an entry, and the
   gate is applied inside the content area instead (rule 7). Under **Review**, one
   sub-entry per existing review round ("Review Round 1", "Review Round 2", …);
   a submission never in review has none. The **Review** entry is itself
   selectable, not just a group heading — each click on it also folds or unfolds
   its round list (⚠ what a selected round-less Review then shows misdescribes an
   active round — Known deviations). The Workflow and Publication groups and
   the Review stage start out expanded. <sup>c</sup>
4. The stage the submission is *currently in* carries a colored stripe in the menu
   (colored per stage, same palette as the indicator); in Review, the stripe sits on
   the current round's entry. Selecting an entry sets the content-pane heading to
   "Workflow: {stage}" (rounds: "Workflow: Review (Round N)"). <sup>d</sup>
5. Below Workflow sits a **Publication** group with one entry per version of the
   submission, each expanding into that version's editing screens: always Title &
   Abstract, Contributors, Metadata and JATS XML; per journal settings, Citations
   (the menu labels it "References"), Data availability (the menu labels it
   "Data") and Identifiers; and, per
   the permissions table, the production-bound screens. Alongside the versions
   sits a "Create New Version" action for those who may publish. For a viewer entitled
   to no version entries at all (per the permissions table), the group's header
   still appears — an inert label with no expand arrow that opens nothing when
   clicked. The entries and their contents belong to the publication/versioning
   features; this spec owns only their place in the menu. <sup>e</sup>

**Per-stage access**

6. What a viewer may open is computed per stage from their assignments: each
   assignment contributes the stages its user group covers, but only while the
   underlying role is still held — an assignment in a role that was since removed
   contributes nothing. Site Administrators and Journal Managers with no assignment
   at all get every stage (the baseline above). Reviewer duties never contribute
   stage access to this shell. <sup>f</sup>
7. Opening a menu stage the viewer's roles don't cover shows a single sentence in
   the content area — "You don't currently have access to that stage of the
   workflow." — and no panels, no side column, no action buttons; the sentence
   renders bare, without the "Status" box framing accessible stages use. The menu
   entry itself stays clickable (rule 3). <sup>g</sup>
8. Opening an accessible stage that is not the submission's current stage leads
   with a **Status** box:
   - a stage the submission hasn't reached: "The {stage} stage has not yet been
     initiated." — in the main column, nothing else beyond that box and the
     "Current Submission Language" line that opens every accessible stage view
     (the author's tracking view shows the same line). The box is not alone on
     the screen, though: the editorial shell still renders the stage's
     Participants side column beside it, and an un-reached Production stage
     also offers its "Schedule For Publication" action (⚠ one exception: on
     OMP, the un-reached view of that app's extra review stage drops the
     Participants column — Known deviations);
   - a stage the submission has passed: "The submission is currently in the
     {current stage} stage.", above that stage's read-only panels;
   - an older review round {OJS OMP} when the submission has moved on: "The submission has
     been advanced to the next round of review" (still in Review) or "The
     submission advanced to the next review round, was accepted, and is currently
     in the {stage} stage." (already past Review);
   - ⚠ a published submission's Production stage was intended to read
     "Submission published." — but that box never renders: publishing
     internally moves the submission past Production, so the Production entry
     shows the passed-stage box with a blank where the stage name belongs —
     "The submission is currently in the  stage." (Known deviations).
   What the current stage and round show beyond this box is the per-stage
   features' domain. <sup>h</sup>

**Landing and routing**

9. Where the panel lands when opened fresh follows the submission's state: the
   current stage's entry; in Review, the current round's entry; a Production-stage
   submission already scheduled or published (and any published submission) lands on
   the latest version's Title & Abstract instead; a submission internally marked
   as having finished its workflow while still unpublished lands on Production —
   a defensive edge: no in-app action produces that state (it was only ever
   reached by forcing the stored record), so testers should not expect to stage
   it. A declined submission lands on the stage it was declined in. The landing follows the submission's state
   even when the viewer may not access that stage — such a viewer lands on the
   no-access sentence (rule 7). <sup>i</sup>
10. The selected menu entry is recorded in the page address as the panel is used, so
    reloading or sharing the address reopens the same screen; a stale or invalid
    menu reference in the address falls back to the fresh-open landing of rule 9.
    (The address parameters and their cleanup on close are the dashboards'
    bookkeeping.) <sup>j</sup>
11. **Legacy addresses**: before 3.5/3.6 each submission had its own workflow page,
    so old bookmarks and emailed links come in two shapes — the **entry-check
    address**, whose last part names only the submission (a general "take me to
    this submission's workflow" link), and the four **stage-named addresses**,
    whose last part names one of the four stages — it reads submission,
    externalReview, editorial or production (the full address forms are listed
    under Reference). All of them now funnel to the editorial dashboard with
    the panel open on that submission: the entry-check address redirects straight
    there, and the stage-named addresses redirect in two hops (stage name →
    stage landing → dashboard). ⚠ The stage named in the old address is dropped on
    the way — the panel opens at its default landing (rule 9), not at the
    bookmarked stage (Known deviations). <sup>k</sup>
12. The stage-named legacy addresses authorize against the *named* stage — a viewer
    whose roles don't cover that stage is refused even though the destination
    ignores the stage entirely; the entry-check address only requires access to
    *some* stage. ⚠ So one and the same person can be refused by an old
    Production-stage bookmark yet open the same panel through the entry-check
    address (Known deviations). <sup>l</sup>

<sup>a</sup> WorkflowPage.vue (pre-title = submissionId + Spinner; title = authorsStringShort; description = fullTitle; post-description = StageBubble) ·
<sup>b</sup> useSubmission.js getExtendedStage(), getExtendedStageLabel(), ExtendedStagesLabels (submissions.incomplete / manager.publication.submissionStage / submission.stage.externalReviewWithRound / submission.copyediting / manager.publication.productionStage / submission.status.scheduled / submission.stage.published / submissions.declined; DECLINED short-circuits first; SCHEDULED/PUBLISHED override in EDITING and PRODUCTION); StageBubble.vue ExtendedStagesColorClass; all eight labels + distinct bg-stage-* dot classes live-probed 2026-07-16 (Group C matrix; Scheduled identical from Copyediting and Production; Declined overrides stage); VoR-only: Repo\submission\Repository::getStatusByPublications() counts only a version-of-record publication for SCHEDULED/PUBLISHED — a published Author Original leaves the bubble on the plain stage (live-verified 2026-07-16; ledger §2 row 210, same mechanism, owned by editorial-dashboards; re-confirmed on OMP 2026-07-26, pilot-1 batch A item 8 — a future-dated Author Original reached SCHEDULED while the header stayed "Production") ·
<sup>c</sup> useWorkflowNavigationConfigOJS.js getMenuItems() (workflow group always; no permissions filter in getWorkflowItems()), getReviewItems() (one item per round, workflow.reviewRoundN); WorkflowPageOJS.vue setExpandedKeys(['workflow','publication','marketing','workflow_3']); parent Review selectability live-probed 2026-07-16 (Group C item 6: selecting it sets workflowMenuKey=workflow_3, heading "Workflow: Review"; every click toggles round expansion while selection persists) ·
<sup>d</sup> useWorkflowNavigationConfigOJS.js getWorkflowItem()/getReviewItem() (colorStripe = StageColors[stageId] when isActive), getWorkflowTitle() (semicolon + manager.workflow) ·
<sup>e</sup> useWorkflowNavigationConfigOJS.js getPublicationVersionItems() (per-version items; publication_create_new_version when canPublish), getPublicationItemsEditorial() (identifiersEnabled, supportsCitations, supportsDataCitations/DataAvailability toggles; canAccessProduction block); empty-group rendering live-probed 2026-07-16 (Group C item 7: header li with icon + label, no submenu ul, no chevron, click is a no-op — useSideMenu attaches no command to an item with no link/action/state); menu labels live-verified 2026-07-16 (verification chunk c: the Citations entry renders as "References" — submission.citations msgstr, lib/pkp/locale/en/submission.po; JATS XML appears in every version's list regardless of production access; the action's label is "Create New Version"); the Data availability entry's on-screen label is "Data" — submission.dataAvailabilityAndCitation.data msgstr, lib/pkp/locale/en/submission.po, shared by all three apps (label live-probed 2026-07-26, pilot-1 batch B item 16 — a base-spec label fix surfaced by the OPS roster walk, not an app delta) ·
<sup>f</sup> classes/user/Repository::getAccessibleWorkflowStages(); submission/maps/Schema::getPropertyStages() (per-stage currentUserAssignedRoles; global manager/admin fallback only when not assigned in any still-held role), getAssignmentRoles(); useWorkflowPermissions.js accessibleStages ·
<sup>g</sup> workflowConfigEditorialOJS.js WorkflowConfig.common.getPrimaryItems/getSecondaryItems/getActionItems (accessibleStages gate, shouldContinue:false → WorkflowPrimaryBasicMetadata with user.authorization.accessibleWorkflowStage); lib/pkp/locale/en/user.po; live-probed 2026-07-16 (Group B item 4: workflow-primary-items innerText = exactly the sentence, workflow-secondary-items and workflow-action-items both count 0 on uncovered stages; covered stage renders status box + Participants side column) ·
<sup>h</sup> WorkflowSubmissionStatus.vue (workflow.stageNotStarted, workflow.submissionInFutureStage, workflow.submissionInNextReviewRound, workflow.submissionNextReviewRoundInFutureStage, editor.submission.workflowDecision.submission.published); useSubmission.js hasNotSubmissionStartedStage(), hasSubmissionPassedStage(); workflowConfigEditorialOJS.js common.getPrimaryItems (shouldContinue = !hasNotSubmissionStartedStage → the PRIMARY column holds only the status box on an unstarted stage; secondary/action items are separate getters — EDITING and PRODUCTION getSecondaryItems push ParticipantManager unconditionally, PRODUCTION getActionItems pushes schedulePublication unconditionally, and workflowConfigEditorialOMP.js overrides neither stage, so the un-reached-stage side column is shared behavior: OJS un-reached Copyediting observed with the Participants column 2026-07-16 (Group B item 4), OMP un-reached Copyediting AND Production observed 2026-07-26 (pilot-1 verify pass, port 8140 — Production adds the "Schedule For Publication" action, Copyediting shows no action), OJS un-reached Production not separately probed — same config objects, code-derived; this corrects the earlier "box alone" reading and closes former Open question 4); OJS stage names from workflow.review.externalReview "Review", submission.copyediting, submission.production; not-yet-initiated + current-stage messages live-probed 2026-07-16 (Group B item 4); the ever-present language line is WorkflowChangeSubmissionLanguage (submission.list.changeSubmissionLanguage.currentLanguage), rendered ahead of the status box on every accessible stage view — same fixture author-dashboard rule 8 documents; published-box unreachability + blank-stage sentence live-probed 2026-07-26 (pilot-1 batch B item 13: a published submission sits on the internal Done stage — ApplyDoneWorkflowStage on PublicationPublished — so WorkflowSubmissionStatus.vue's hasSubmissionPassedStage() branch fires before the PRODUCTION+published branch that would emit editor.submission.workflowDecision.submission.published, and its StageNames map has entries for stages 2–5 only, so the Done stage's name resolves to nothing; byte-identical render observed on an OJS published submission, read-only, and an OPS posted preprint — ledger row 262) ·
<sup>i</sup> useWorkflowNavigationConfigOJS.js getInitialSelectionItemKey() (review stages → workflow_{stage}_{currentRound}; PRODUCTION + status ≠ QUEUED → publication_{latest}_titleAbstract; DONE → publication if PUBLISHED else workflow_5; else workflow_{stageId}); declined keeps stageId → else branch; author-side declined landings live-probed 2026-07-11 (author-dashboard spec); editor-side landings live-probed 2026-07-16 (Group A item 8: scheduled + published → publication_{latest}_titleAbstract; a published submission is internally moved to the Done stage by ApplyDoneWorkflowStage, so it lands via the DONE branch — same outcome; Done-but-unpublished → workflow_5 verified only with a forced DB state, no in-app path found — defensive branch; Group B item 4: stage-4-only assistant landed on workflow_3_{round}, saw the no-access sentence) ·
<sup>j</sup> useWorkflowMenu.js (workflowMenuKey query param: watch selectedMenuKey → write; on submission fetch → navigateToMenu(url key) with doesKeyExist fallback to getInitialSelectionItemKey()); dashboardPageStore.js onClose cleanup (editorial-dashboards <sup>n</sup>); fallback live-probed 2026-07-16 (Group A item 8d: stale publication key and garbage key both fell back to the fresh-open landing, bad key replaced in the URL); cross-app parity live-probed 2026-07-26 (pilot-1 batch B item 19: OPS persistence + reload hold; stale keys — including other-app workflow_{1,2,3} keys, exactly what a copied OJS link would carry — and garbage keys all rewritten to the rule-9 landing; OJS control re-confirmed read-only; OMP persistence + deep-link confirmed batch A §12.2, its stale-key fallback not separately probed) ·
<sup>k</sup> PKPWorkflowHandler::access(), index() (both → dashboard/editorial?workflowSubmissionId={id}, no workflowMenuKey), submission()/externalReview()/editorial()/production() → _redirectToIndex() → workflow/index/{id}/{stageId}; workflow/access/{id} → 302 live-probed 2026-07-16 (editorial-dashboards <sup>g</sup>); two-hop chain + stage-drop live-probed 2026-07-16 (Group A item 1: hop 1 carries the op's stage id, hop 2 → dashboard/editorial?workflowSubmissionId={id} identical for stages 1 and 3, no workflowMenuKey; browser lands at the rule-9 default; post-login resume through the full chain also verified) ·
<sup>l</sup> PKPWorkflowHandler::authorize() (access op: UserAccessibleWorkflowStageRequiredPolicy only; other ops: WorkflowStageAccessPolicy with identifyStageId() — stage from op name or index/{id}/{stageId} arg); UserAccessibleWorkflowStagePolicy::effect() (named stage ∩ editorial-workflow roles); live-probed 2026-07-16 (Group B item 3: stage-5-only and stage-4-only assistants — uncovered stage-named op → 302 user/authorizationDenied (accessibleWorkflowStage message, same sentence as rule 7), covered op and workflow/access both reach the dashboard; both directions bounded with positive controls)

## Side effects

None — the shell is read-only navigation. It sends no emails, raises no
notifications and writes no log entries; the only trace of using it is the menu
selection recorded in the page address (rule 10).

## Settings that modify behavior

- **Users & Roles → a role's stage coverage** (journal settings): ticking/unticking
  workflow stages on a user group directly widens or narrows what its assignees may
  open (rule 6). <sup>a</sup>
- **Journal publication settings** add or remove Publication-menu entries: citations
  support adds Citations; data-availability/data-citation support adds Data
  availability; an enabled public-identifier plugin (such as URN) adds
  Identifiers {OJS OMP} — enabling DOIs alone does not (rule 5). <sup>b</sup>
- **Payments enabled** {OJS} adds a payment dropdown to the editorial shell's header tools
  (its behavior belongs to the fees feature). <sup>c</sup>
- No config.inc.php variables alter these rules.

<sup>a</sup> UserGroup::userGroupStages via Repository::getAccessibleWorkflowStages() ·
<sup>b</sup> useWorkflowNavigationConfigOJS.js getPublicationItemsEditorial() (publicationSettings.supportsCitations / supportsDataCitations / supportsDataAvailability / identifiersEnabled); {OJS OMP} badge: both apps ship a pubIds plugin category (plugins/pubIds/urn), OPS ships none, so identifiersEnabled is permanently false there (App variations); DOI-only half re-confirmed on OMP 2026-07-26 (pilot-1 batch A item 7: enableDois true, prefix set, no Identifiers entry) ·
<sup>c</sup> workflowConfigEditorialOJS.js getHeaderItems() (publicationSettings.submissionPaymentsEnabled → WorkflowPaymentDropdown)

## Cross-feature interactions

- **editorial-dashboards** — owns how the panel is reached (View button, deep link,
  address cleanup on close, list refresh) and who appears on which list; this spec
  starts once the panel is open.
- **author-dashboard** — owns the author dressing of this same shell (the tracking
  view): its menu roster, per-stage author panels and author landings. The shared
  mechanics (stage menu shape, access gate sentence, status boxes, landing rules)
  are documented here once.
- **editorial-decisions** (pending) — owns the decision action rail the shell
  renders beside a stage's panels.
- **stage-participants** (pending) — owns creating/removing the assignments that
  rule 6 turns into stage access.
- **Per-stage features** (submission/review/copyediting/production stage specs,
  pending) — own every panel inside a stage; *tasks-discussions* and
  *assign-and-manage-reviewers* own their panels likewise.
- **Publication & versioning features** (pending) — own the Publication menu
  entries' screens and the create-version/publish actions the menu exposes.

## Canonical scenarios

1. **A Section Editor tours the stage menu** {OJS OMP} — a Section Editor assigned to a
   submission under Review opens it from the dashboard. The header shows the
   submission's ID, authors and title with a "Review (Round 1)" stage indicator; in
   the menu, all four stages are listed and the Review round entry carries the
   colored stripe. Opening **Copyediting** shows a Status box reading "The
   Copyediting stage has not yet been initiated." with the Participants side
   column beside it, and nothing else in the main column beyond the
   ever-present submission-language line (rule 8); opening
   **Submission** shows "The submission is currently in the Review stage." above
   the desk-review panels; returning to the Review round shows the working stage.
   <sup>s1</sup>
2. **Review rounds unfold in the menu** {OJS OMP} — on a submission sent to a second review
   round, the Review menu entry contains "Review Round 1" and "Review Round 2".
   Opening the panel fresh lands on Round 2 (the stripe sits there); selecting
   Round 1 shows "The submission has been advanced to the next round of review"
   above that round's historical content. After the submission is accepted and
   moved on, Round 1 instead explains the submission advanced, was accepted, and
   names the stage it now sits in. <sup>s2</sup>
3. **An Assistant hits a stage their role doesn't cover** {OJS OMP} — an Assistant whose
   group covers only Copyediting and Production is assigned to a submission in
   Review. They open the panel: the menu still lists all four stages, but opening
   **Review** (or Submission) shows only "You don't currently have access to that
   stage of the workflow." — no panels, no side column, no buttons — while
   Copyediting opens normally with its not-yet-initiated status. <sup>s3</sup>
4. **A Journal Manager oversees without an assignment** — a Journal Manager who was
   never assigned to the submission opens it from the dashboard and can walk every
   stage: each accessible stage shows its panels or status note, never the
   no-access sentence, and the header offers Activity Log and Library. <sup>s4</sup>
5. **Old workflow addresses find their way home** — a Section Editor follows a
   years-old bookmark to a submission's workflow page (the entry-check shape of
   rule 11): the browser lands on the editorial dashboard with that submission's
   panel open. A bookmark deep into a specific stage (a stage-named address)
   arrives the same way but at the panel's default landing — the
   bookmarked stage is not preselected. Followed while signed out, the bookmark
   first asks for login and then continues on to the open panel. An author trying
   an editorial workflow address never reaches the dashboard: they land on an
   access-denied page reading "You don't currently have access to that stage of
   the workflow." <sup>s5</sup>
6. **An author and a Section Editor open the same submission** {OJS OMP} — for one submission
   in Copyediting, the assigned Section Editor's panel and the author's tracking
   view (from My Submissions) share the same skeleton — header with the same
   "Copyediting" indicator, stage menu, Publication group — but the author's
   Publication versions offer fewer screens (no Identifiers, no Publication
   Settings, and no Permissions & Disclosure — the menu's name for the License
   screen), the author's header has Library but no Activity Log, and no decision
   rail appears anywhere in the author view (details owned by *author-dashboard*).
   <sup>s6</sup>

<sup>s1</sup> Seed: any queued submission in external review with an assigned sub-editor; stage names verbatim from manager.po / submission.po ·
<sup>s2</sup> Round data: getReviewRoundsForStage(); messages WorkflowSubmissionStatus.vue ·
<sup>s3</sup> Requires an assistant group with stage coverage excluding review (Users & Roles); seed note: no default assistant group covers exactly Copyediting + Production (registry/userGroups.xml — Copyeditor covers Copyediting only, Layout Editor covers Production only), so the seed unions two assignments on one assistant, assigned through both groups — precisely rule 6's per-assignment union; gate workflowConfigEditorialOJS.js common.getPrimaryItems; live-probed 2026-07-16 (Group B item 4, stage-4-only copyeditor group) ·
<sup>s4</sup> Manager fallback Repository::getAccessibleWorkflowStages(); header items getHeaderItems() ·
<sup>s5</sup> Routes: {journal}/workflow/access/{id} and {journal}/workflow/{submission|externalReview|editorial|production}/{id} and {journal}/workflow/index/{id}/{stageId}; author denial via WORKFLOW_TYPE_EDITORIAL role intersect (PKPWorkflowHandler::authorize()); all three legs live-probed 2026-07-16 (Group A items 1–2; probe note: assert redirects on the locale-prefixed /en/ URL form — bare journal URLs first take an unrelated locale 302) ·
<sup>s6</sup> Contrast anchors: getPublicationItemsAuthor() vs getPublicationItemsEditorial(); workflowConfigAuthorOJS.js getHeaderItems() (Library only); the License screen's menu label is "Permissions & Disclosure" (publication.publicationLicense msgstr); Identifiers nuance: identifiersEnabled gates on pub-id plugins (e.g. URN — PKPDashboardHandler::setupIndex()), NOT on DOIs, so on a journal with no pub-id plugin enabled the entry is absent from BOTH dressings — the author-side absence still holds but is not an editor/author contrast; the contrast is carried by the production-bound entries; author side owned by author-dashboard spec

## Known deviations (as-built ≠ intent)

- ⚠ **A manager who reviews is blinded in the UI but not on the server** {OJS OMP}
  (rule 6, permissions lead-in; live-confirmed 2026-07-16, Group B item 5): the
  submission payload skips the global manager/admin fallback when the viewer holds
  an active (not declined/cancelled) review assignment on the submission
  (Schema::getPropertyStages() `$hasCurrentUserReviewAssignment` guard), so an
  unassigned Journal Manager who is also a reviewer sees the no-access sentence on
  all four stages (the shell itself still opens — header and menu load — but the
  blinding reaches past stage content: the Activity Log button disappears and the
  Publication group collapses to a bare header with no version entries and no
  create action, since canAccessEditorialHistory, canAccessPublication and
  canPublish all derive from the same emptied per-stage roles — observed on OMP
  2026-07-26, pilot-1 verify P3; ledger row 211's user-visible surface is this
  whole set) — but classes/user/Repository::getAccessibleWorkflowStages()
  has no such guard, so server-side stage authorization still permits them
  everywhere (probed: the legacy stage route enters the normal redirect chain and a
  stage-scoped participants API call succeeds for the same person). A declined AND
  a cancelled review assignment both restore the full manager view, matching the
  guard's condition. Suspected intent: reviewer anonymity should not be
  underminable by the same person's manager hat — but then the server should match.
  Proposed ledger row 211. Same family, smaller surface (code re-derivation
  2026-07-16): the two sides even check "still-held" differently — the server
  counts an assignment when the user still holds its role through *any* of their
  groups (Repository::getAccessibleWorkflowStages()), while the payload requires
  live membership in the assignment's own group
  (Schema::getAssignmentRoles() date-window check) — so a user whose membership in
  the assigned group lapsed but who holds the same role via another group keeps
  server-side stage access while the UI blinds them; cold edge, the UI is only
  ever stricter — folded into row 211's family note rather than a new row.
  Reproduces on OMP unchanged (live-probed 2026-07-26, pilot-1 batch A item 9):
  the blinding covers all five stages, and the server side is identically
  permissive — the internal-review legacy op included enters the normal
  redirect chain and a stage-scoped participants call returns content for the
  same blinded person; ledger row 211 applies as written. Cannot arise on OPS —
  the app installs no reviewer group and has no review stage, so no manager can
  hold a review assignment there (hence the badge).
- ⚠ **Legacy stage bookmarks lose their stage** (rule 11; live-confirmed
  2026-07-16, Group A item 1): every old stage-named address ends at
  `dashboard/editorial?workflowSubmissionId={id}` with no `workflowMenuKey`, so the
  panel opens at the rule-9 default rather than the bookmarked stage
  (PKPWorkflowHandler::index() discards the stage arg its authorization checked —
  probed: a Submission-stage bookmark on a Review-stage submission opened at the
  current review round). Suspected intent: map the old stage path onto the menu
  key. Low impact; proposed ledger row 212 (behavior-change note).
- ⚠ **Stage-named addresses are stricter than their destination** {OJS OMP}
  (rule 12; live-confirmed 2026-07-16, Group B item 3): the named stage is authorized
  (WorkflowStageAccessPolicy) although the redirect target ignores it — an
  Assistant not covering the named stage is refused by e.g.
  `workflow/production/{id}` (302 to the authorization-denied page carrying the
  same "You don't currently have access to that stage of the workflow." sentence)
  yet gets the identical end state via `workflow/access/{id}` or a covered
  stage-named address. Harmless as-built inconsistency; folded into ledger row 212.
  The asymmetry cannot arise on OPS: its one surviving stage-named address names
  the app's only stage, so a viewer refused there is refused by the entry-check
  address too (App variations).
- ⚠ **The selected parent Review entry misdescribes an active round** {OJS OMP}
  (rule 3; found live 2026-07-16, Group C item 6; no Review entry exists on OPS to
  select): selecting the round-less **Review**
  entry shows the status box "The submission has been advanced to the next round
  of review" while round 1 is still running
  (WorkflowSubmissionStatus.vue compares `selectedReviewRoundId` — null here —
  against `currentReviewRound.id`), renders the round-scoped panels with no round
  (the Reviewers and Files for Review tables sit empty despite existing
  assignments), and drops the decision action rail entirely. A coherent defect
  cluster: a round-less Review view that misstates where the submission is.
  Suspected intent: the parent entry should be expand-only, or should select the
  current round. Proposed ledger row 213. Reproduces on both OMP review stages,
  on single- and multi-round fixtures (live-probed 2026-07-26, pilot-1 batch A
  item 2); OMP addendum for the ledger row, scope widened by the pilot-1 verify
  pass: ANY Internal Review view with no selected round loses the Participants
  side column — the round-less parent entry and the not-yet-initiated stage
  alike (workflowConfigEditorialOMP.js getSecondaryItems early-returns before
  pushing ParticipantManager whenever no round is selected, which includes a
  Submission-stage monograph's un-reached Internal Review entry — the OMP
  exception rule 8 flags) — while External Review, inheriting the OJS guard,
  keeps the column in both cases; this scope carries into ledger row 213.
- ⚠ **The published status box never renders — a blank-stage sentence appears
  instead** (rule 8, last bullet; live-probed 2026-07-26, pilot-1 batch B
  item 13): expected — a published submission's Production stage leads with
  "Submission published."; observed — publishing moves the submission to the
  internal Done stage (ApplyDoneWorkflowStage on PublicationPublished, which
  writes the stage directly, outside entity-schema validation), the
  passed-stage branch of WorkflowSubmissionStatus.vue is evaluated before the
  published branch, and its StageNames map has no entry for Done, so the box
  reads "The submission is currently in the  stage." — a blank stage token
  with a double space, user-visible. Byte-identical on OJS (published
  submission, read-only control) and OPS (posted preprint, where it is the
  only status box that can occur — App variations). Proposed ledger row 262.

## Open questions

1. Is the manager-as-reviewer UI blinding (Known deviations, first item —
   live-confirmed both sides 2026-07-16) the intended product rule? If yes, should
   getAccessibleWorkflowStages() apply the same active-review-assignment guard so
   server-side access (legacy routes, stage-scoped APIs) matches the UI?
2. Should a legacy stage-named address preselect that stage in the panel (e.g.
   translate the old path to a `workflowMenuKey`), or is "default landing" the
   accepted behavior?
3. Should the parent **Review** menu entry be selectable at all (it is today —
   Known deviations, fourth item), or expand-only / an alias for the current round?
4. {OMP} Scheduled is reachable only by setting a future publication date on a
   screen whose help text steers users toward *backdating* — is a
   forward-scheduling affordance intended? (Likely owned by the publishing
   feature; recorded here because the Scheduled indicator's reachability is
   this spec's claim.)

## App variations — OMP / OPS

Read the base spec through APP-GLOSSARY.md (journal → press / preprint server,
Journal Manager → Press Manager / Preprint Server Manager, Section Editor →
Series Editor / Moderator, and so on). The shell itself — header, access gate,
no-access sentence, status-box machinery, submission-language line, address
persistence and fallback — is one shared mechanism dressed per app, so every
unbadged, un-overridden rule claims all three apps. <sup>v1</sup> The overrides
below are keyed to the base text by quoted stubs.

### OMP

- "travels through four stages" — through five: an Internal Review stage sits
  between Submission and the base spec's Review stage (on-screen: Internal
  Review, External Review). Each review stage nests its own rounds, and the
  round rules here (menu sub-entries, stripes, status boxes, landings) apply to
  each review stage separately, with this app's stage names substituted into
  every status message. <sup>v2</sup>
- "Review (Round N)" — two review indicator states, labeled Internal Review
  (Round N) and External Review (Round N), each with its own dot color.
  <sup>v3</sup>
- "listing all four stages" — listing all five; the two review entries join
  the Workflow and Publication groups as initially expanded. Round sub-entries
  carry the same label form under both review stages, so a submission with
  rounds in both shows two menu entries reading exactly
  "Review Round 1" — only their parent entry (and, once selected, the
  content-pane heading, which substitutes the stage name into the base form:
  "Workflow: Internal Review (Round 1)" vs "Workflow: External Review
  (Round 1)") tells them apart. <sup>v4</sup>
- "entry is itself selectable" — both review entries behave like the base
  Review entry: selectable, folding their round list on each click. The
  round-less misdescription deviation reproduces on both stages, and on
  Internal Review any view with no selected round — the round-less parent
  entry and the not-yet-initiated stage alike — loses its Participants side
  column, the one exception to rule 8's un-reached-stage side column (Known
  deviations). <sup>v4</sup>
- "Below Workflow sits a Publication group" — a third group, Marketing
  (Audience, Representatives, Publication Dates), sits between Workflow and
  Publication in the editorial shell only and starts expanded; its screens
  belong to OMP marketing features — this spec owns only their place in the
  menu. <sup>v5</sup>
- "Metadata and JATS XML" — there is no JATS XML entry. Every version lists
  Title & Abstract, Contributors, Chapters, Metadata, Publication Formats and
  Media unconditionally; Citations, Data availability and Identifiers follow
  the same settings as the base spec; Body Text, Galleys and Publication
  Settings entries do not exist. <sup>v6</sup>
- "the production-bound entries" — are Catalog Entry and Permissions &
  Disclosure. <sup>v6</sup>
- "See the header tools" — the header also carries a work-type control
  beside Library, labeled with the current work type — on-screen
  "Monograph" or "Edited Volume" — whose dropdown offers exactly those two
  choices; switching the type relabels the button and changes nothing else
  in this shell. There is no payment dropdown. <sup>v7</sup>
- "in Review, the current round's entry" — rule 9's landing, per review
  stage: a submission in either review stage lands on that stage's current
  round. <sup>v8</sup>
- "the four stage-named addresses" — five: an internal-review shape joins
  them — its last part reads internalReview (full form under Reference) —
  with the same two-hop redirect and the same stage-drop deviation.
  <sup>v9</sup>
- "offer fewer screens" — the author's versions lack Identifiers, Catalog
  Entry and Permissions & Disclosure; Chapters, Publication Formats and Media
  appear in both dressings. <sup>v6</sup>

### OPS

- "travels through four stages" — through one: Production. A preprint is
  created in the Production stage and stays there until posted (posting parks
  it on an internal past-the-end marker with no menu entry of its own), so
  the panel has no stage topology to navigate. <sup>v10</sup>
- "The stage indicator collapses" — the reachable states are Production,
  Scheduled, Published and Declined only; a preprint whose submission wizard
  was never finished also reads Production, so Incomplete never appears here.
  <sup>v10</sup>
- "listing all four stages" — the Workflow group holds a single Production
  entry: no round sub-entries, no Review entry, and only two menu groups
  exist and start out expanded — Workflow and the version group, whose
  on-screen header the next override renames. Once a preprint is posted,
  no menu entry carries the current-stage stripe — the submission then sits
  on the internal marker no entry names. <sup>v11</sup>
- "Below Workflow sits a Publication group" — the group's on-screen header
  reads "Preprint", not "Publication", and the content-pane headings follow
  it ("Preprint: Title & Abstract"). <sup>v19</sup>
- "Metadata and JATS XML" — there is no JATS XML entry. Versions list Title &
  Abstract, Contributors and Metadata, plus the same settings-gated Citations
  and Data availability; an Identifiers entry can never appear — the app
  ships none of the public-identifier plugins the entry depends on, so the
  matching Settings bullet does not apply. <sup>v12</sup>
- "the production-bound entries" — are Galleys, Media, Permissions &
  Disclosure and Preprint entry. <sup>v12</sup>
- "the submission reaches Copyediting" — from the start: every unposted
  preprint already sits in the Production stage, so Preview is offered
  immediately — even on an unfinished or a declined preprint — and is
  relabeled View once posted; once posted the header also shows the base
  row's decision-gated Return to Workflow button (a shared tool that becomes
  available on posting, not an app extra). <sup>v13</sup>
- "leads with a status box" — only one box can occur, on a posted preprint's
  Production entry — and it is the blank-stage passed-stage sentence of the
  base deviation, not "Submission published." (Known deviations); queued,
  scheduled, declined and unfinished preprints show no box at all.
  <sup>v10</sup>
- "shows a single sentence" — cannot occur inside the panel: with one stage
  there is no viewer who covers some stage but not the selected one, and a
  viewer covering no stage gets no panel content at all — the menu renders
  empty and neither the submission's title nor its stage indicator loads,
  only the ID number. The sentence remains reachable only as the full-page
  refusal on a legacy address. <sup>v20</sup>
- "the group's header still appears" — the zero-entry case cannot occur
  either: on a one-stage app, entitlement to version entries and to any panel
  content rise and fall together, so no viewer both opens the panel and is
  owed an empty group. <sup>v20</sup>
- "follows the submission's state" — collapses to two landings: a queued
  preprint lands on the Production entry; a scheduled, posted or declined one
  lands on the latest version's Title & Abstract — declined included, so the
  base declined-lands-where-declined sentence does not carry over here.
  <sup>v14</sup>
- "funnel to the editorial dashboard" — only the entry-check and the
  production-named shapes do; the other three (last parts submission,
  externalReview and editorial — the base spec's Submission-, Review- and
  Copyediting-named shapes) name stages the app does not have and are refused
  for every signed-in viewer, in every role — managers and administrators
  included — on a refusal page reading "A workflow stage was not specified."
  (a third denial wording, distinct from both the base spec records;
  misleading as written, since the address does name a stage — just not one
  this app has). A logged-out visitor is first sent to login, as the base
  rule says. <sup>v15</sup>
- "authorize against the named stage" — for the three absent-stage shapes the
  refusal is therefore universal — not a permission asymmetry of the rule-12
  family but a flat refusal, the named stage being invalid for the app before
  any role question arises: no signed-in viewer can use those addresses, while
  the entry-check address works normally. <sup>v15</sup>
- "has two dressings" — the author's tracking view drops the Workflow group
  entirely (Publication versions only); the author-dashboard delta owns that
  menu. <sup>v16</sup>
- "A bookmark deep into" — only a production-stage bookmark arrives home; the
  other stage-named bookmarks are refused as above. <sup>v15</sup>

### Both apps

- "assigned to an issue awaiting publication" — neither app has issues:
  Scheduled means a version of record is scheduled for publication, and what
  puts it there belongs to each app's publishing feature (on the preprint
  side the version of record is the version the menu lists as
  "Author Original" — on screen a posted preprint's version entry reads
  "Author Original 1.0"). <sup>v17</sup>

<sup>v1</sup> useWorkflowConfigOMP.js / useWorkflowConfigOPS.js deep-merge the OJS editorial and author configs as base (deepMerge(ConfigEditorialOJS, ConfigEditorialOMP/OPS)), so WorkflowConfig.common — the accessibleStages gate, the no-access sentence, WorkflowSubmissionStatus, WorkflowChangeSubmissionLanguage — and useWorkflowMenu.js / WorkflowPage.vue are the same objects in all three apps; classes/user/Repository::getAccessibleWorkflowStages() and the authorization policies are shared lib/pkp code ·
<sup>v2</sup> omp-main classes/core/Application.php getApplicationStages() (5 stages); useWorkflowNavigationConfigOMP.js getWorkflowItems() (five items; getReviewItems() run for internal and external stages); lib/pkp WorkflowStageDAO stage-path map incl. internalReview; per-review-stage parity live-probed 2026-07-26 (pilot-1 batch A items 1 + 4: five stage entries with per-stage round nesting, all groups expanded on fresh open; stripes sit on the current stage's parent AND current round in that stage's palette; landings workflow_{stage}_{round} per review stage, incl. a declined-in-internal-round-1 landing; all four base rule-8 box shapes rendered on the internal stage with the OMP stage-name msgstrs — "The Internal Review stage has not yet been initiated.", "The submission is currently in the External Review stage.", the advanced/accepted pair — no internal-specific wording exists) ·
<sup>v3</sup> useSubmission.js ExtendedStages.INTERNAL_REVIEW + ExtendedStagesLabels; omp locale submission.stage.internalReviewWithRound "Internal Review (Round {$round})" and submission.stage.externalReviewWithRound "External Review (Round {$round})"; StageBubble.vue ExtendedStagesColorClass + border-stage-in-internal-review stripe color in useWorkflowNavigationConfigOJS.js StageColors; labels + dots live-probed 2026-07-26 (pilot-1 batch A item 3: header "Internal Review (Round 1)" bg-stage-in-internal-review rgb(66,66,127) vs "External Review (Round 1)" bg-stage-in-review rgb(224,137,20), all nine states walked with eight distinct colors; dashboard row badges use identical classes, colors and strings) ·
<sup>v4</sup> WorkflowPageOMP.vue setExpandedKeys(['workflow','publication','marketing', workflow_3, workflow_2]); useWorkflowNavigationConfigOMP.js passes isDisabled for round-bearing review entries but the shared getWorkflowItem() builder drops that property, leaving parent entries selectable exactly as in OJS; selectability + fold-on-click live-probed 2026-07-26 (pilot-1 batch A item 2: parent selection sets workflow_2 / workflow_3 with headings "Workflow: Internal Review" / "Workflow: External Review", rounds collapse and re-expand per click while selection persists); the ledger-213 round-less defect reproduces on both review stages, single- and multi-round fixtures — Internal Review additionally loses the Participants column (workflowConfigEditorialOMP.js getSecondaryItems early-return, Known deviations); duplicate round labels: getReviewItem() renders workflow.reviewRoundN ("Review Round {$number}") for both stages, so a work with rounds in both shows two identical "Review Round 1" entries (batch A item 1 — exact-name menu matching is ambiguous on OMP, a test-layer hazard) ·
<sup>v5</sup> useWorkflowNavigationConfigOMP.js getMenuItems() (marketing group pushed between workflow and publication, EDITORIAL_DASHBOARD only), getMarketingItems(); omp locale monograph.audience "Audience", grid.catalogEntry.representatives "Representatives", grid.catalogEntry.publicationDates "Publication Dates"; placement + labels live-probed 2026-07-26 (pilot-1 batch A items 1 + 7: Marketing renders between Workflow and Publication, labels verbatim, expanded on fresh open, absent from the author tracking view) ·
<sup>v6</sup> useWorkflowNavigationConfigOMP.js getPublicationItemsEditorial() (no jats item; chapters, publicationFormats, media unconditional; canAccessProduction → catalogEntry + license) and getPublicationItemsAuthor(); omp locale publication.catalogEntry "Catalog Entry"; publication.publicationLicense "Permissions & Disclosure" is the lib/pkp msgstr, shared by all three apps; rosters + gates live-probed 2026-07-26 (pilot-1 batch A items 7 + 12.3: editorial roster verbatim Title & Abstract / Contributors / Chapters / Metadata / Publication Formats / Media / References / Catalog Entry / Permissions & Disclosure + Create New Version; a copyediting-coverage-only assistant's roster ends at References with no create action; a production-coverage assistant gets Catalog Entry + Permissions & Disclosure but no create action — canAccessProduction and canPublish gate exactly as claimed; DOIs enabled yet no Identifiers entry, the pub-id-plugin gate holds on OMP; author view drops Identifiers, Catalog Entry and Permissions & Disclosure while keeping Chapters, Publication Formats and Media) ·
<sup>v7</sup> workflowConfigEditorialOMP.js getHeaderItems() (WorkflowWorkTypeOMP pushed unconditionally after Library; no WorkflowPaymentDropdown, no submissionPaymentsEnabled branch); control live-probed 2026-07-26 (pilot-1 batch A item 5: header buttons Activity Log | Library | Monograph in DOM order; the dropdown offers exactly "Edited Volume | Monograph"; choosing Edited Volume relabels the button and nothing else in the shell changes — menu, roster and content byte-identical, Chapters unconditional either way; "Monograph" is the omp common.publication msgstr, "Edited Volume" submission.workflowType.editedVolume.label — the code vocabulary "authored work" never reaches the screen; no payment dropdown in any observed header) ·
<sup>v8</sup> useWorkflowNavigationConfigOMP.js getInitialSelectionItemKey() (internal OR external stage → workflow_{stageId}_{currentRound}; other branches identical to OJS); landings live-probed 2026-07-26 (pilot-1 batch A item 4 table: internal r1 → workflow_2_1, internal r2 → workflow_2_10, external r1 → workflow_3_12, copyediting → workflow_4) ·
<sup>v9</sup> omp-main pages/workflow/WorkflowHandler.php addRoleAssignment(..., ['access','index','submission','internalReview','externalReview','editorial','production']) + internalReview() → _redirectToIndex(); redirect chain and stage-drop are the shared PKPWorkflowHandler ops; live-probed 2026-07-26 (pilot-1 batch A item 6: workflow/internalReview/{id} → 302 workflow/index/{id}/2 → 302 dashboard/editorial?workflowSubmissionId={id}, hop 2 identical for all five stage names and carrying no workflowMenuKey — ledger-212 stage drop holds for the OMP-only shape) ·
<sup>v10</sup> ops-main schemas/submission.json stageId (default 5, validation min:5 max:5 — every preprint is Production-stage at creation); ops-main classes/core/Application.php getApplicationStages() = [WORKFLOW_STAGE_ID_PRODUCTION]; useSubmission.js getExtendedStage() branches for stages 1/3/4 therefore unreachable — and so is Incomplete: INCOMPLETE is returned only inside the stage-1 branch (submissionProgress check), dead code on OPS, so an unfinished preprint (stage 5 + queued) falls through to PRODUCTION_QUEUED — live-probed 2026-07-26 (pilot-1 batch B item 10: five lifecycle states walked; the submissionProgress='start' preprint shows "Production" bg-stage-production); the "past-the-end marker" is the internal Done stage (id 6): the shared ApplyDoneWorkflowStage listener on PublicationPublished writes stageId directly, outside entity-schema validation, so a posted preprint's payload reports stage 6 active despite the schema pin; status boxes live-probed 2026-07-26 (batch B item 13: queued/scheduled/declined/incomplete → no box at all; posted → the passed-stage box with the blank stage token, ledger row 262 — "Submission published." never renders because hasSubmissionPassedStage() is evaluated first, see Known deviations) ·
<sup>v11</sup> useWorkflowNavigationConfigOPS.js getWorkflowItems() (single production item, no getReviewItems import); WorkflowPageOPS.vue setExpandedKeys(['workflow','publication']); live-probed 2026-07-26 (pilot-1 batch B item 11: nav holds no Review / Round / Submission / Copyediting anchor in any state; heading "Workflow: Production"; both groups expanded on fresh open; stripe border-stage-production on queued, scheduled, declined and incomplete preprints, no border-stage-* class on any anchor once posted — the stage-6 side effect) ·
<sup>v12</sup> useWorkflowNavigationConfigOPS.js getPublicationItemsEditorial() (no jats item; canAccessProduction → galleys, media, license, preprintEntry); ops locale preprint.entry msgstr "Preprint entry" (lowercase e, live-confirmed); roster live-probed 2026-07-26 (pilot-1 batch B items 16 + 20: verbatim Title & Abstract / Contributors / Metadata / References / Data / Galleys / Media / Permissions & Disclosure / Preprint entry + Create New Version — CONTEXT-DEPENDENT roster, not a baseline: the Data entry is settings-gated and the probe context had data availability switched on, while the bootstrapped test server leaves it off (no schema default), so the baseline fixture shows no Data entry — assert it only on a context with the setting enabled; a non-manager section editor sees the same roster minus the create action — canPublish gates it as in the base spec); Identifiers unreachable: ops-main ships no plugins/pubIds category at all (OJS and OMP both ship pubIds/urn), and identifiersEnabled iterates PluginRegistry::getPlugins('pubIds'), so the flag is permanently false — a DOI-enabled scratch context still rendered no Identifiers entry ·
<sup>v13</sup> workflowConfigEditorialOPS.js getHeaderItems() — same stage+status gate as OJS (stageId EDITING or PRODUCTION, common.preview → common.view when STATUS_PUBLISHED), but an OPS submission's stageId is PRODUCTION from creation, so the gate is always open pre-publication; live-probed 2026-07-26 (pilot-1 batch B item 12: queued/scheduled/declined/incomplete headers all carry Preview + Activity Log + Library; the posted header carries View + Activity Log + Library + a "Return to Workflow" button — the shared decision-gated tool of the base header row, footnote d — for manager and section-editor viewers alike) ·
<sup>v14</sup> useWorkflowNavigationConfigOPS.js getInitialSelectionItemKey() (no review branch; PRODUCTION + status ≠ QUEUED → publication_{latest}_titleAbstract; DONE branch as OJS; the extra MY_SUBMISSIONS always-publication branch is the author-dashboard delta's to document); landings live-probed 2026-07-26 (pilot-1 batch B: queued → workflow_5; posted and scheduled → publication_{latest}_titleAbstract; declined (status DECLINED, not QUEUED) also → publication_{latest}_titleAbstract via the same branch — the base declined-keeps-its-stage landing does not occur on OPS) ·
<sup>v15</sup> ops-main pages/workflow/WorkflowHandler.php still registers the submission/externalReview/editorial ops, but WorkflowStageAccessPolicy composes WorkflowStageRequiredPolicy, whose effect() denies any stageId outside Application::getApplicationStages() — stages 1, 3, 4 are invalid in OPS, so denial precedes any redirect for every user; refusal live-probed 2026-07-26 (pilot-1 batch B item 14: the three absent-stage shapes 302 → user/authorizationDenied?message=user.authorization.workflowStageRequired for manager and section editor alike — rendered page reads verbatim "A workflow stage was not specified.", lib/pkp/locale/en/user.po — while zero-coverage and non-editorial roles get the same denial there and the accessibleWorkflowStage denial on the valid shapes; workflow/production/{id} two-hop with the stage dropped and workflow/access/{id} single-hop both reach the dashboard exactly as the base spec says; anonymous → login with the legacy URL in source, resume holds; the message's wording is itself misleading — the address names a stage, just an invalid one — noted as a cold candidate ledger item, not raised as a row by pilot 1) ·
<sup>v16</sup> useWorkflowNavigationConfigOPS.js getMenuItems() (workflow group pushed only when dashboardPage is EDITORIAL_DASHBOARD; MY_SUBMISSIONS gets the publication group alone); live-probed 2026-07-26 (pilot-1 batch B item 15: author tracking view nav holds the "Preprint" group alone — no Workflow anchor, no Production stage anchor; header Library only; landing publication_{id}_titleAbstract; the roster ends with an author-only "Production Tasks & Discussions" entry and a posted version shows a posted-can-not-be-edited notice — details for the author-dashboard delta) ·
<sup>v17</sup> lib/pkp classes/submission/Repository.php getStatusByPublications() — the version-of-record-only Scheduled/Published computation is base-class code shared by all three apps; only OJS ties scheduling to issue assignment (its publish flow), OMP/OPS schedule without issues — the trigger per app is owned by the respective publishing feature; OMP trigger live-probed 2026-07-26 (pilot-1 batch A item 8: Catalog Entry → Publication Timing → Date Published set to a future date, then Publication → Publish — the confirm dialog is titled "Schedule For Publication" and offers no date or container field — yields publication STATUS_SCHEDULED with no issue anywhere; the indicator shows "Scheduled" from Copyediting and from Production; the only date control's help text steers toward backdating, hence Open question 4); OPS Scheduled confirmed reachable (batch B seed, submission status SCHEDULED, future datePublished) with the in-app trigger left to the OPS publishing feature; OPS "version of record" = the Author Original stage (ops-main VersionStage::finalVersionStage(), posted version labeled "Author Original 1.0") ·
<sup>v19</sup> useWorkflowNavigationConfigOPS.js getPublicationTitle() uses t('submission.publication'), whose ops-main msgstr is "Preprint" (ojs-main: "Publication"); live-probed 2026-07-26 (pilot-1 batch B item 16: nav group header "Preprint"; content headings "Preprint: Title & Abstract" on OPS vs "Publication: Title & Abstract" on OJS, both observed) ·
<sup>v20</sup> single-stage collapse, live-probed 2026-07-26 (pilot-1 batch B items 17 + 18): the in-panel gate (workflowConfigEditorialOJS.js common.getPrimaryItems) runs only after the submission payload loads, and useWorkflowPermissions.js computes canAccessPublication and canAccessProduction from the same intersection when the active stage IS the production stage — so a viewer either covers Production (full panels, full roster) or covers nothing (submission API answers 401, the shell renders the empty husk of base footnote a: the nav landmark renders with zero menu entries, no bubble, no title, no content — only the submission ID); probed with the zero-coverage assistant-role group ops-main registry/userGroups.xml installs (stages="") — assigned to the submission, still the husk — and a covering section editor as positive control; the no-access sentence therefore renders on OPS only as the full-page accessibleWorkflowStage denial of the legacy addresses (footnote v15), and canonical scenario 3's {OJS OMP} badge is correct

---

<!-- REFERENCE MATERIAL — provenance and campaign bookkeeping, not product-owner
     narrative. The PO-facing "where do I find this" is in Purpose. -->

## Reference — entry points & surfaces

| Entry | Path | Atom |
|-------|------|------|
| Workflow panel (generic shell) | Side modal mounted by the dashboards; `WorkflowPage.vue` layout (header slots, SideMenu, 2-column content) | VUE-workflow-page |
| Workflow panel (OJS wiring) | `WorkflowPageOJS.vue` — mounts OJS managers/components into the shell, editorial vs author config split, default-expanded menu groups | VUE-workflow-page-ojs |
| Legacy entry-check address | `{journal}/workflow/access/{submissionId}` → 302 `dashboard/editorial?workflowSubmissionId={id}` (live-probed 2026-07-16, editorial-dashboards) | PAGE-workflow-access |
| Legacy stage landing | `{journal}/workflow/index/{submissionId}/{stageId}` → 302 same destination (stage dropped) | PAGE-workflow-index |
| Legacy stage-named addresses | `{journal}/workflow/submission/{id}` | PAGE-workflow-submission |
| | `{journal}/workflow/externalReview/{id}` | PAGE-workflow-externalreview |
| | `{journal}/workflow/internalReview/{id}` — OMP only (App variations); same chain | — (no OJS atom; OMP atlas pending) |
| | `{journal}/workflow/editorial/{id}` | PAGE-workflow-editorial |
| | `{journal}/workflow/production/{id}` — each → 302 `workflow/index/{id}/{stageId}` → 302 dashboard | PAGE-workflow-production |
| Stage-access authorization | WorkflowStageAccessPolicy (composite used by the legacy ops and every stage-scoped handler/API) | AUTHZ-workflow-stage-access-policy |
| | UserAccessibleWorkflowStagePolicy (named-stage check against the computed stage map) | AUTHZ-user-accessible-workflow-stage-policy |
| | UserAccessibleWorkflowStageRequiredPolicy (any-stage check; builds the accessible-stages context object) | AUTHZ-user-accessible-workflow-stage-required-policy |
| | WorkflowStageRequiredPolicy (stage-id validity sub-policy composed inside WorkflowStageAccessPolicy) | AUTHZ-workflow-stage-required-policy |

## Reference — code anchors

- lib/pkp/pages/workflow/PKPWorkflowHandler.php — legacy ops (access/index/stage
  names), authorize() split, identifyStageId(), _redirectToIndex()
- pages/workflow/WorkflowHandler.php — OJS role whitelist + setupIndex() (dead
  weight for the redirect ops; still feeds forms)
- lib/pkp/classes/security/authorization/WorkflowStageAccessPolicy.php,
  internal/UserAccessibleWorkflowStagePolicy.php,
  internal/UserAccessibleWorkflowStageRequiredPolicy.php
- lib/pkp/classes/user/Repository.php getAccessibleWorkflowStages() — the per-stage
  access computation (assignments × group stage coverage × held roles; manager
  fallback)
- lib/pkp/classes/submission/maps/Schema.php getPropertyStages(),
  getAssignmentRoles() — the `stages[].currentUserAssignedRoles` payload the UI
  gates on (incl. the manager-as-reviewer guard)
- lib/ui-library/src/pages/workflow/WorkflowPage.vue, WorkflowPageOJS.vue,
  workflowStore.js — shell layout, store, OJS component wiring
- lib/ui-library/src/pages/workflow/composables/useWorkflowNavigationConfig/
  useWorkflowNavigationConfigOJS.js — menu roster, stripes, initial landing
- lib/ui-library/src/pages/workflow/composables/useWorkflowMenu.js — menu-key URL
  persistence and fallback
- lib/ui-library/src/pages/workflow/composables/useWorkflowPermissions.js — UI
  permission flags (accessibleStages, canAccessPublication/Production/Publish,
  canAccessEditorialHistory)
- lib/ui-library/src/pages/workflow/composables/useWorkflowConfig/
  {useWorkflowConfigOJS,workflowConfigEditorialOJS,workflowConfigAuthorOJS}.js —
  editorial/author dressing, per-stage access gate, header tools
- lib/ui-library/src/pages/workflow/components/primary/WorkflowSubmissionStatus.vue —
  status-box messages
- lib/ui-library/src/components/StageBubble/StageBubble.vue +
  lib/ui-library/src/composables/useSubmission.js — stage indicator states/labels
