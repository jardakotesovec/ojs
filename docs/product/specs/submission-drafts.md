---
name: submission-drafts
scope: An author saves an unfinished submission for later, finds it again in the incomplete-submissions lists, resumes it, or deletes it — one at a time from the wizard or in bulk from the dashboard
shared: pkp-lib
status: verified
atlas-claims:
  - API-submission-save-for-later
  - API-submission-delete
  - API-backend-submissions-bulk-delete-incomplete-submissions
  - MAIL-submission-saved-for-later
  - PAGE-submission-saved
  - LOC-submission-dashboard-submissions
---

# Submission drafts (save for later, resume, delete)

## Purpose

Filling in a submission takes longer than one sitting, so every submission begun in
the wizard lives as a **draft** — the system calls it an *incomplete submission* —
until the moment it is actually submitted. This feature is everything that happens to
a draft *outside* the wizard's step-by-step form: the **Save for Later** action that
parks the draft and emails whoever saved it a resume link (with its "Saved for
Later" confirmation page), the **lists where drafts reappear** (the author's My Submissions
page has a dedicated "Incomplete submissions" view; editors meet drafts inside
"Active submissions"), the **resume** path from a list row or the emailed link back
into the wizard, and the two ways a draft is **deleted**: the wizard's Cancel and the
dashboard's "Delete Incomplete Submissions" bulk tool. The wizard itself — steps,
autosave, submit — is the *submission-wizard* spec; this one owns the draft's life
around it.

## Actors & permissions

Terms: a *draft* (incomplete submission) = a submission begun but not yet submitted;
the *submitting user* = whoever started it; an *assigned author* = anyone holding an
Author assignment on the draft. Claims marked **(not verifiable from the screens)**
describe behavior the system records or enforces but never displays — they were
checked below the UI, through the machine interface, with the specifics in each
claim's footnote. Baselines: **Anonymous visitors** have no access to any of these
surfaces. A **Site Administrator** who holds no role in the journal is a special
case throughout: the pages render for them and the buttons respond as if they
worked, but the change is silently discarded — nothing on screen reports the
refusal. To verify a refusal, act and then check: press the button, then reopen the
draft (or reload the list) and confirm the saved value or the deletion is absent
(the wizard spec's ledger row 177 covers the mechanism). An admin normally acts
through the Journal Manager role auto-granted on journals they created. My
Submissions as a page is reachable only by users holding the Author role in the
journal.

| Action | Who may — and when |
|--------|--------------------|
| **Save a draft for later** (wizard heading + step-footer buttons) | • Anyone who can open the in-progress wizard: the submitting user and any assigned author, a Journal Manager on any draft, a Section Editor assigned to it<br>• A Site Administrator with no journal role — the buttons show and respond, but every save is silently discarded ⚠: reopen the draft afterwards and nothing was recorded (verification procedure in the baseline paragraph above; wizard spec, Known deviations) <sup>a</sup> |
| **Receive the "saved for later" email** | • The person who pressed the button — ⚠ not necessarily the submitting author: a Journal Manager saving someone else's draft gets the resume email themselves, and the author gets nothing (Known deviations) <sup>b</sup> |
| **See drafts in a list** | • The draft's authors — My Submissions, in both the "Incomplete submissions" view and "Active submissions"<br>• Journal Managers and Site Administrators — every draft in the journal, inside the editorial dashboard's "Active submissions" (there is no editor-side incomplete view)<br>• Section Editors and Assistants — only drafts they are assigned to; other people's drafts are invisible to them <sup>c</sup> |
| **Resume a draft** (reopen the wizard) | • Same as opening the in-progress wizard (see the wizard spec): its authors, Journal Managers, assigned Section Editors — via the list row's "Complete submission" link or the emailed resume link <sup>d</sup> |
| **Delete one draft from inside the wizard** ("Cancel") | • The submitting user and any assigned author<br>• Journal Managers and Site Administrators — any draft<br>• Everyone else is refused (the ownership and role boundary is the wizard spec's Cancel row; the deletion itself is this feature's) <sup>e</sup> |
| **Bulk-delete incomplete submissions** (dashboard tool) | • On My Submissions — every author gets the tool, and may select only their own drafts<br>• On the editorial dashboard — Journal Managers and Site Administrators only; they may delete anyone's drafts<br>• Section Editors, Assistants, Reviewers — no tool anywhere (the "More Actions" button itself does not appear for them), and the underlying action refuses them too <sup>f</sup> |
| **Delete a draft through the general one-submission deletion API** | • ⚠ Machine-interface surface — no screen reaches it (not verifiable from the screens) — with a different rule set: Journal Managers and Section Editors pass the gate, the draft's own author is refused — and a permitted call reports an error even though it deletes (Known deviations, ledger row 183) <sup>g</sup> |
| **Delete one submission through the single-item variant of the dashboard delete action** | • ⚠ No UI control on any of this feature's surfaces — machine callers only (not verifiable from the screens; its only on-screen caller is the editorial workflow's Delete button on declined submissions — another feature's page): the draft's own author may delete their own draft one at a time — unlike the general one-submission deletion API above, which refuses authors<br>• A Journal Manager or Site Administrator may delete **any** submission this way, ⚠ including one already submitted — nothing on this path restricts it to drafts (rule 12; code-derived, unprobed) <sup>h</sup> |

<sup>a</sup> PKPSubmissionController::getGroupRoutes() saveForLater roleAuthorizer (Manager, Sub-editor, Author; omits Site Admin — ledger 177); SubmissionAccessPolicy; wizard buttons: lib/pkp/templates/submission/wizard.tpl; live-probed 2026-07-11 (button label exactly "Save for Later", shown twice: page heading after the title + step footer between Cancel and Continue) ·
<sup>b</sup> PKPSubmissionController::saveForLater() `->recipients([$request->getUser()])`; SubmissionSavedForLater `$toRoleIds = [ROLE_ID_AUTHOR]` declares the intent; live-probed 2026-07-11 (Mailpit: manager saving the author's draft → email to the manager only, expectNone for the author with a positive control; body greets the manager) ·
<sup>c</sup> Repository::getDashboardViews() TYPE_INCOMPLETE_SUBMISSIONS (roles: Author only) and TYPE_ACTIVE (status queued incl. drafts; unassigned visible only to Site Admin/Manager, others `assignedTo`); PKPDashboardHandler::__construct() addRoleAssignment (mySubmissions op: Author only); live-probed 2026-07-11 (unassigned foreign draft: Manager sees it in Active submissions + "Needs editor" + "All in submission stage"; unassigned Section Editor and Assistant: absent — search-verified as permission, not indexing) ·
<sup>d</sup> PKPSubmissionHandler::__construct()/showWizard(); useDashboardConfigEditorialActivity() `openSubmissionWizard` action; SubmissionEmailVariable::SUBMISSION_WIZARD_URL; live-probed 2026-07-11 (resume link and saved-page URL carry the locale segment, e.g. /en/, on multi-locale journals) ·
<sup>e</sup> PKPSubmissionHandler::showWizard() `canCancelSubmission` ($isAdmin || $isAuthor); SubmissionWizardPage.vue cancelSubmission() → DELETE on the backend list endpoint with the one id; Repository::canCurrentUserDelete() ·
<sup>f</sup> useDashboardBulkDelete() bulkDeleteIsAvailableForUser (MY_SUBMISSIONS: everyone on the page; EDITORIAL_DASHBOARD: Site Admin/Manager) and canBeDeleted(); PKPBackendSubmissionsController::getGroupRoutes() bulk-delete roleAuthorizer (Site Admin, Manager, Author) + bulkDeleteIncompleteSubmissions() `assignedTo` narrowing for non-managers; live-probed 2026-07-11 (Section Editor, Assistant, Reviewer: the "More Actions" ellipsis is entirely absent; hand-crafted DELETE as Section Editor → 401 roleBasedAccessDenied, draft untouched; Manager on an unassigned foreign draft → 200, draft gone); adversarially re-probed 2026-07-11 with the stronger variant: the ellipsis stays absent even for a Section Editor ASSIGNED to a visible draft, and a Reviewer cannot reach the editorial dashboard at all ·
<sup>g</sup> PKPSubmissionController::getGroupRoutes() delete route roleAuthorizer (Manager, Sub-editor; omits Author); ledger row 183; re-verified live 2026-07-11 (reproduces exactly) ·
<sup>h</sup> PKPBackendSubmissionsController::getGroupRoutes() `Route::delete('{submissionId}')` (_submission.delete; roleAuthorizer Site Admin, Manager, Author) → delete() (existence + same-journal checks, then Repository::canCurrentUserDelete() — NO incomplete filter, unlike the bulk route); canCurrentUserDelete() passes any Manager/Site Admin outright, an Author only on their own draft with a Submission-stage assignment; UI caller: useWorkflowActions.js workflowDeleteSubmission() (declined submissions only, Manager/Site Admin); code-derived 2026-07-11, NOT live-probed (esp. manager-deletes-submitted)

## Fields & validation

N/A — the feature has no data-entry form. Save for Later records the wizard step the
author had reached automatically (nothing is asked), the bulk-delete tool collects
only checkbox selections, and both confirmation dialogs offer just a confirm and a
cancel button (the wizard's Cancel dialog says OK/Cancel; the bulk tool's says
Confirm/Cancel). The
recorded step marker is server-set bookkeeping no screen ever shows (not verifiable
from the screens); its semantics are in Rules & state. <sup>a</sup>

<sup>a</sup> PKPSubmissionController::saveForLater() `step` request param (alpha-dash check only); SubmissionWizardPage.vue saveForLater() sends the last started step; live-probed 2026-07-11 (see rule 5's footnote for the junk-token probe)

## Rules & state

**What a draft is**
1. A submission begun in the wizard stays a draft until the moment it is submitted.
   What a tester observes is the draft/submitted split itself: lists, badges,
   deletability and the wizard-vs-tracking-view difference all follow it. Internally
   one marker carries the whole state — it names the wizard step the author last
   saved and is emptied by submitting, so an empty marker *is* the definition of
   "complete" (not verifiable from the screens; no screen shows the marker). The
   step-by-step semantics of the marker (which step the wizard reopens at, autosave
   movement) are the wizard spec's rules. <sup>a</sup>
2. ⚠ **Every** draft carries a recorded *submission date* from the moment it is
   begun, even though nothing was submitted — no creation path escapes the stamp,
   and anything reading that date as "when it was submitted" is misled for
   in-progress drafts. The stamp itself is not verifiable from the screens (no
   draft screen displays the date); its screen-testable half is the consequence:
   the manager's "Needs editor" view collects unassigned submissions that carry a
   submission date, so **every unassigned draft appears there** — a draft is
   *unassigned* until an editor is assigned to it, and every fresh draft starts
   unassigned (rule 6) — never-submitted work presented as waiting for an editor.
   That presence is expected today and flagged as wrong by design intent: verify
   the draft is there, do not file a new bug (Known deviations, ledger row 167 as
   amended). <sup>b</sup>

**Save for Later**
3. Pressing "Save for Later" first finishes any in-flight autosaves, then records the
   furthest step the author had opened, sends the resume email, and lands on the
   **"Saved for Later"** page. If the connection is down at that moment, a
   "Disconnected" dialog explains it was unable to save (exact wording unprobed),
   and nothing is recorded or sent. <sup>c</sup>
4. The **"Saved for Later" page** shows the page title "Saved for Later" and reads,
   verbatim: "Your submission details have been saved in our system, but it has not
   yet been submitted for consideration. You can return to complete your submission
   at any time by following the link below." Below that sit a link to the draft
   that reopens the wizard, labelled with the author names and title — the label
   format pairing, stated once for the whole spec: on this page the title carries
   **no** quotation marks (*Authors — Title*), while the email's copy of the same
   link wraps the title **in** quotation marks (*Authors — "Title"*) — and "We have
   emailed a copy of this link to you at {email}" with the **visitor's
   own** address — a manager saving on the author's behalf sees the manager's address
   (⚠ matching the email deviation in the permissions table). It exists only for a
   specific draft the visitor may access: a signed-in visitor without access to that
   draft is turned away to an access-denied page (its exact page title unprobed),
   an anonymous visitor is sent to
   the login page (and brought back after signing in), and without a valid submission
   the address is a plain not-found. ⚠ The page never notices a submission has since been submitted:
   revisited later, every sentence is stale (Known deviations, ledger row 178). <sup>d</sup>
5. ⚠ Machine-interface material — this whole rule is not verifiable from the
   screens; no screen can send these requests. The save-for-later action itself has
   **no "already submitted" guard**: invoked directly against a submitted submission
   it re-writes the step marker, turning the submission back into a "draft" whose
   wizard renders again — a state-machine hole with no UI path (Known deviations,
   ledger row 176). Relatedly, the step name accepted is only loosely checked
   (letters, digits, hyphens, underscores) — any such token is accepted and
   **remembered as the recorded step**, including ones no wizard step uses;
   reopening the wizard with an unrecognized marker falls back to the **first
   step**. Saving for later while naming no step at all also succeeds: the marker
   stays as it was — but the resume email is still sent. One real step name is even
   missing from the field's own permitted-values list — a schema note (ledger
   row 174). <sup>e</sup>

**Where drafts appear and how they look**
6. On **My Submissions** an author has a dedicated **"Incomplete submissions"** view
   (with a count) listing only their drafts — and the same drafts *also* count and
   appear under "Active submissions", since a draft still counts as an active
   submission (it is neither declined nor published). That double-listing is the
   product's behavior today — whether it should be is Open question 4; verify it,
   do not file it as a bug. The editorial dashboard has no incomplete view: Journal
   Managers and Site Administrators meet every draft in the journal inside "Active
   submissions" — and an unassigned draft (rule 2: no editor assigned yet; every
   fresh draft starts unassigned) also surfaces in their "Needs editor" and "All in
   submission stage" views (a consequence of the premature submission-date stamp,
   rule 2 ⚠ — expected today, not a fresh bug), its row carrying the same "Complete
   submission" resume button the author sees. Section Editors and Assistants see only submissions
   assigned to them, which excludes other people's drafts — searching for a foreign
   draft by title finds nothing. <sup>f</sup>
7. A **draft's row** differs from a submitted row: the stage column shows the badge
   **"Incomplete"** where a submitted row shows its stage (e.g. "Submission"); the
   Editorial Activity column offers a **"Complete submission"** button that reopens
   the wizard; and the Actions column is **empty** — no "View" button, because there
   is nothing to track before it is submitted. (A submitted row is the mirror image:
   "View" in Actions, no "Complete submission".) <sup>g</sup>
8. **Resuming** is just reopening the wizard: from the row's "Complete submission"
   link or from the emailed resume link (both lead to the same wizard address). The
   wizard reopens on the exact step recorded at the last save — saved on Details, it
   reopens on Details, with the earlier Upload Files step showing a completed check
   mark (wizard spec, rule 2). <sup>h</sup>

**Deleting drafts**
9. Deleting a draft is **permanent and total** — the submission and everything
   attached to it (files, contributors, its wizard state) are removed, exactly as if
   it never existed. No one is notified. All the delete paths — the wizard's Cancel,
   the dashboard bulk tool, and the machine-only single-item variant (rule 12) — end
   in the same deletion. <sup>i</sup>
10. The **bulk tool's flow**: the list's "More Actions" menu (an ellipsis "…" button
    immediately right of the "Filters" button, top-left above the table) offers
    **"Delete Incomplete Submissions"** in red — greyed out when nothing on the
    current list can be deleted. Choosing it switches the table into selection mode:
    a checkbox column appears (its column header is visually hidden and reads
    "Select incomplete submissions to be deleted." — to check it, inspect the header
    cell's hidden text or read the page's accessibility tree; it is not visible on
    screen), with a checkbox **only on rows the user
    may delete** — submitted submissions and other people's drafts get none. A
    red-outlined **"Delete Incomplete Submissions"** button (disabled until something
    is checked) and a "Cancel" button sit above the table; the delete button opens a
    confirmation — heading "Confirm Delete of Incomplete Submissions", body "Are you
    sure you want to delete the selected items? This action cannot be undone. Please
    confirm to proceed.", with Confirm and Cancel buttons — and on Confirm the drafts
    are deleted and selection mode ends. The table and the left-hand view counts
    both update without a page reload, but not in step: the rows vanish first and
    the view counts follow within about ten seconds — poll the counts (re-read them
    until they settle) rather than judging from a single look. <sup>j</sup>
11. The server treats the batch as **all-or-nothing**: every requested submission
    must exist in this journal, still be a draft, and be deletable by the requester
    (their own, for an author; any, for a Journal Manager or Site Administrator) — a
    single offending id in the batch refuses the whole request and nothing is
    deleted. Of the three offending kinds, only a submitted id could ever arise from
    the screens; the foreign-id and unknown-id halves are automation-only — no
    screen can put such an id in a batch (not verifiable from the screens). ⚠ The
    on-screen eligibility check is slightly looser than the server's (an author
    assignment on *any* stage shows the checkbox; the server demands one on the
    *first* stage), so a checkbox can promise a delete the server then refuses
    wholesale (how that refusal is presented on screen was not probed — on-screen
    failure presentation unprobed). The mismatch is reachable through ordinary
    journal configuration — the recipe: the Author role's stage assignment must
    omit the "Submission" stage (Users & Roles → Roles → edit the Author group);
    an author in such a group can still begin drafts, yet cannot delete them
    (Known deviations). <sup>k</sup>
12. ⚠ A third deletion path exists only for machine callers — the whole rule is
    not verifiable from the screens: a **single-item
    variant** of the dashboard tool's action, with no button on any of this
    feature's screens (its one on-screen home is the editorial workflow's Delete
    button on declined submissions — another feature's page). Through it an author
    may delete their own draft one at a time — the very thing the general
    one-submission deletion API refuses them — and a Journal Manager or Site
    Administrator may delete **any** submission in the journal, drafts and
    already-submitted alike: unlike the bulk tool, nothing on this path checks that
    the target is still a draft. The permissive manager rule exists to serve the
    declined-submissions cleanup, but the route does not restrict itself to that
    case (code-derived, unprobed). <sup>l</sup>

<sup>a</sup> submission schema `submissionProgress` (default `start`; empty = submitted; write-protected in the API); Collector::filterByIncomplete() (`submission_progress <> ''`); useSubmission.js getExtendedStage() ·
<sup>b</sup> Repository::add() stamps `dateSubmitted` whenever `submissionProgress` is empty at insert — and it is empty on EVERY creation path, because the wizard's Begin Submission form posts through the same PKPSubmissionController::add() route as API clients (the `start` marker is not yet set at the stamp check); arbitrated live 2026-07-11 — the original wizard-vs-API dichotomy of row 167 is false as-built; "Needs editor" = Collector isUnassigned branch, which requires `whereNotNull(s.date_submitted)`. Test-authoring note: the TEST-scenario seeder creates drafts WITHOUT the stamp, so seeded drafts never appear in "Needs editor" — a seeding fidelity gap, not app behavior ·
<sup>c</sup> SubmissionWizardPage.vue saveForLater() (waits out isAutosaving; sends `step` = last started step; redirects to the saved page), openSaveForLaterFailed() (i18nDisconnected + submission.wizard.unableToSave); PKPSubmissionController::saveForLater(); save + email + saved page live-probed 2026-07-11; the offline "Disconnected" dialog is code-derived, NOT live-probed (probe skipped) ·
<sup>d</sup> lib/pkp/templates/submission/saved.tpl (submission.wizard.saved / .description / .emailConfirmation); PKPSubmissionHandler::saved() (404 without an authorized submission; no submitted-state check — ledger row 178); live-probed 2026-07-11 (h1 + both paragraphs verbatim; manager-on-behalf sees the manager's address; page URL carries the locale segment, e.g. /en/; resume-link label has NO quotes around the title — quotes are email-only); adversarially re-probed 2026-07-11: valid saved?id as an authenticated non-owner → redirect to the access-denied page; as anonymous → redirect to login carrying a return address back to the saved page ·
<sup>e</sup> PKPSubmissionController::saveForLater() (SubmissionAccessPolicy only, no SubmissionIncompletePolicy/alreadySubmitted check — ledger row 176; `ctype_alnum` + `-`/`_` step check, bypasses schema validation); submission schema `submissionProgress` enum lacks `reviewerSuggestions` — ledger row 174; junk token + no-step live-probed 2026-07-11 (PUT step="zzz" as author, CSRF → 200, submissionProgress="zzz" persisted, wizard reload lands on step 1 "Upload Files" — SubmissionWizardPage.vue steps[0] fallback; PUT with no step → 200, marker unchanged, email still sent — mail send unconditional, marker edit gated on non-empty step) ·
<sup>f</sup> Repository::getDashboardViews() / mapDashboardViews() TYPE_INCOMPLETE_SUBMISSIONS (label submission.dashboard.view.incompleteSubmissions; Author only; assignedTo user) vs TYPE_ACTIVE (STATUS_QUEUED; unassigned included for Site Admin/Manager only); PKPDashboardHandler::__construct() selectedRoleIds per page; live-probed 2026-07-11 (draft counts in BOTH views — Incomplete 1, Active 2 = draft + submitted; Manager: foreign draft also in "Needs editor" + "All in submission stage"; Section Editor/Assistant: absent, search-verified); "Needs editor" membership re-confirmed by the row-167 arbitration 2026-07-11 — it follows from the date stamp (rule 2's footnote); seeder-created drafts lack the stamp and will NOT show there (test-authoring) ·
<sup>g</sup> useSubmission.js ExtendedStagesLabels.incomplete (submissions.incomplete = "Incomplete"); useDashboardConfigEditorialActivity() getEditorialActivityForMySubmissions()/EditorialDashboard (submission.list.completeSubmission → openSubmissionWizard); DashboardCellSubmissionActions.vue (View hidden when submissionProgress set); live-probed 2026-07-11 (badge "Incomplete" grey dot vs "Submission" purple dot; "Complete submission" in EDITORIAL ACTIVITY; ACTIONS empty; submitted row mirrors: "View" in ACTIONS) ·
<sup>h</sup> dashboardPageStore.js openSubmissionWizard(); Repository::getUrlSubmissionWizard(); SubmissionEmailVariable::SUBMISSION_WIZARD_URL; live-probed 2026-07-11 ("Complete submission" → /submission?id=N#details; wizard reopens at the LAST-SAVED step — stepper showed Upload Files completed, Details current) ·
<sup>i</sup> Repository::delete(); SubmissionWizardPage.vue cancelSubmission() (dialog submission.wizard.submissionCancel + submission.wizard.cancel.confirmation) → PKPSubmissionHandler::getSubmissionCancelUrl() (backend list endpoint, single id); live-probed 2026-07-11, twice (Cancel is footer-only, leftmost of Cancel · Save for Later · Continue, red link-style; both UI delete paths send POST with X-Http-Method-Override: DELETE to api/v1/_submissions — wizard Cancel single ids={id}, bulk ids[] array — test-authoring relevance) ·
<sup>j</sup> DashboardControlBulkActions.vue (common.moreActions ellipsis, aria-label "More Actions"; disabled when bulkDeleteSubmissionIdsCanBeDeleted empty; control renders only when ≥1 bulk action exists); DashboardTable.vue + DashboardCellBulkDelete.vue (checkbox hidden unless canBeDeleted); DashboardControlBulkDeleteButton.vue; useDashboardBulkDelete() bulkDeleteActionDelete() (dashboard.submissions.incomplete.bulkDelete.confirm/.body/.button/.column.description); full walk live-probed 2026-07-11 (all strings verbatim; no reload needed, Active 3→1, Incomplete 2→0); re-probed 2026-07-11: the table rows disappear immediately, the sidebar view-count badges lag them by a few seconds — tests should POLL the badges, not assert them instantly ·
<sup>k</sup> PKPBackendSubmissionsController::bulkDeleteIncompleteSubmissions() (filterByIncomplete + assignedTo for non-managers; per-item canCurrentUserDelete pre-flight, then delete loop); Repository::canCurrentUserDelete() (author assignment at WORKFLOW_STAGE_ID_SUBMISSION) vs useDashboardBulkDelete() canBeDeleted() (author role in any stage); all-or-nothing live-probed 2026-07-11 (author batch ownDraft+ownSubmitted → 404 "The requested resource was not found.", nothing deleted; comma and array id forms both parse). Nuances (re-verified in code 2026-07-11): the all-or-nothing guarantee is PRE-FLIGHT only — visibility failures (missing/foreign/non-draft id, filtered out by the collector) refuse 404 resourceNotFound while permission failures refuse 403 (unauthorizedDeleteSubmission / deleteSubmissionOutOfContext); the delete loop that follows is NON-transactional, so a mid-loop failure — or a submission submitted between validation and deletion — leaves earlier batch members deleted. The looser-screen-eligibility edge is code-derived, NOT live-probed, but reachable WITHOUT DB surgery: an Author user group configured without WORKFLOW_STAGE_ID_SUBMISSION can still begin drafts because PKPSubmissionController::add()'s stage filter is commented out pending pkp/pkp-lib#10929 (`withStageIds` disabled), while canCurrentUserDelete() still demands the Submission-stage assignment — checkbox renders, batch → 403 ·
<sup>l</sup> PKPBackendSubmissionsController::getGroupRoutes() `Route::delete('{submissionId}')` → delete() (no filterByIncomplete — only existence, same-journal, canCurrentUserDelete); roleAuthorizer Site Admin/Manager/Author; canCurrentUserDelete() manager/admin branch ignores draft-ness; UI caller useWorkflowActions.js workflowDeleteSubmission(), offered only when the revert-decline decision is available (workflowConfigEditorialOJS.js) to Manager/Site Admin; code-derived 2026-07-11, NOT live-probed (manager-deletes-submitted unprobed)

## Side effects

- **The "saved for later" email** — sent on every Save for Later, from the journal's
  principal contact to the person who pressed the button (⚠ acting user, see
  permissions). Default subject "Resume your submission to {journal name}". The body
  greets the recipient by name and reads: "Your submission details have been saved
  in our system, but it has not yet been submitted for consideration. You can return
  to complete your submission at any time by following the link below." — then the
  resume link labelled *Authors — "Title"*, and "This is an automated email from
  {journal name}." The journal's copy is editable in the Emails settings
  ("Submission Saved for Later" — see Settings); an edited subject is used verbatim
  by the very next save. If the journal somehow lacks the template, built-in default
  wording is used (not verifiable from the screens — no screen lets a journal lose
  the template). No in-app notification accompanies it, and nothing is written to
  any log — the no-log half was verified below the screens; from the UI you can
  only note there is no place to look (not verifiable from the screens). ⚠ The
  email is internally flagged as one a manager should be able to turn off; the
  screen-testable half is that no off switch exists anywhere in the settings
  screens (see Settings) — that no mechanism reads the flag, leaving the email
  effectively always on, is code-verified only (not verifiable from the screens)
  (Known deviations). <sup>a</sup>
- **Deleting drafts** (either path) produces no email and no notification; nothing
  is logged either — verified below the screens, since a deleted submission leaves
  no page where a log could be looked for (not verifiable from the screens).
- Save for Later writes no event-log entry either (verified below the screens — a
  draft offers no on-screen activity log to check); the only persistent effect
  besides the email is the updated step marker (rule 1).

<sup>a</sup> PKPSubmissionController::saveForLater() (Mail::send; from context contactEmail/contactName; fallback body per pkp/pkp-lib#9217); SubmissionSavedForLater (SUBMISSION_SAVED_FOR_LATER; `$canDisable = true` — no caller of Mailable::canDisable() found repo-wide; vestigial Decision import + DECISION_DESCRIPTION const); mailable.submissionSavedForLater.name = "Submission Saved for Later"; live-probed 2026-07-11 (Mailpit: subject/body/From verbatim, resume link labelled `{authorsShort} — "{title}"`; edited subject used verbatim by the next save, re-confirmed on a scratch journal; From = principal contact re-confirmed there too)

## Settings that modify behavior

- **Settings → Workflow → Emails**: the "Submission Saved for Later" template's
  wording can be edited per journal. Its row offers an "Edit Submission Saved for
  Later" button opening an editor titled "Submission Saved for Later", described as
  "An automated email sent to authors when they save their submission to complete
  later", listing the template with a "Default" badge and Add Template / Edit /
  Close buttons. There is **no disable toggle** anywhere on this surface — that
  absence is the screen-testable half of the dead disable flag; the conclusion that
  the template can never be turned off rests on code checked below the screens (see
  Side effects and Known deviations). <sup>a</sup>
- **Reviewer suggestions** (journal setting): turning it on adds a wizard step whose
  name the step marker then records — the step name missing from the marker's
  permitted-values list is a schema note, not verifiable from the screens (rule 5 ⚠,
  ledger row 174).
- Disabling new submissions altogether stops new drafts from being created but does
  not touch existing ones — that setting is the wizard spec's.
- No config.inc.php variables alter these rules.

<sup>a</sup> ManageEmails UI over SubmissionSavedForLater (`$canDisable = true` has no UI surface — no caller of Mailable::canDisable()); default subject "Resume your submission to {$contextName}"; live-probed 2026-07-11 on a scratch journal (Default badge, Add Template / Edit / Close, no disable toggle; edited subject picked up by the next save-for-later)

## Cross-feature interactions

- **submission-wizard** — owns the wizard frame: the Save for Later and Cancel
  *buttons* and their placement, autosave (whose flushing Save for Later waits on),
  which step the wizard reopens at, the "Submission cancelled" landing page, and the
  submit that ends draft-hood. This spec owns what those actions *do* outside the
  wizard: the save-for-later action's semantics, the email, the "Saved for Later"
  page, the lists, and the deletion endpoint Cancel calls. Ledger rows 167/174/176/178
  are shared context (recorded under the wizard; the draft-side symptoms are
  described here).
- **author-dashboard** (upcoming) — owns the My Submissions page in general (views
  machinery, search, the New Submission button). This spec owns only the
  draft-specific parts of that page: the "Incomplete submissions" view's existence
  and membership, the "Incomplete" badge, the "Complete submission" link, the missing
  View button on draft rows, and the bulk-delete tool.
- **editorial-dashboards** — owns the editorial dashboard and its views generally
  (including "Active submissions" as a view); this spec owns the fact that drafts
  appear there for Journal Managers and the manager-side bulk-delete tool.
- **submission-settings / email-templates** — own the Emails settings machinery this
  feature's template is edited through.
- **editorial workflow / decisions (declined-submission cleanup)** — the workflow
  page's Delete button on a declined submission is the one on-screen face of the
  single-item deletion path this spec documents for drafts (rule 12); the button,
  its dialog and the declined-state rules belong to that feature.

## Canonical scenarios

1. **An author saves a half-finished submission for later** — an author partway
   through the wizard (say, on Details) presses "Save for Later" (offered in the
   page heading and in the step footer, between "Cancel" and "Continue"). They land
   on a page titled "Saved for Later" explaining the details "have been saved in our
   system" but "not yet been submitted for consideration", with a link to their
   submission (author names and title) and the note "We have emailed a copy of this
   link to you at" their own address. Their inbox has an email from the journal's
   principal contact, subject "Resume your submission to" the journal's name; the
   link in it reopens the wizard on the Details step — the step they saved from —
   with Upload Files marked completed (a check mark on the step).
2. **An author resumes a draft from My Submissions** — an author with exactly one
   draft and no other submissions opens My Submissions. The left-hand views include
   "Incomplete submissions" with a count of 1, and "Active submissions" also counts
   1 — the same draft in both views. The draft's row carries an "Incomplete" stage
   badge, an empty Actions cell (no
   "View"), and a "Complete submission" button in the Editorial Activity column —
   clicking it reopens the wizard on the exact step they last saved from, with each
   earlier step showing a completed check mark.
3. **An author cancels a draft from inside the wizard** — the author reopens the
   draft and presses "Cancel", the leftmost of the step footer's three buttons
   (Cancel · Save for Later · Continue; the page heading has no Cancel). A "Cancel
   submission" dialog warns "Are you sure you wish to cancel this submission? This
   will delete the submission and all associated data. This action cannot be
   undone." Its buttons are "OK" and "Cancel"; pressing OK lands on the "Submission
   cancelled" page — "Submission has
   been cancelled, and all associated data has been deleted.", then "For now, you
   can:" introducing the "Create a new submission" and "Return to your dashboard"
   links — and back on My Submissions the draft is gone from both the Incomplete
   and Active views.
4. **An author bulk-deletes their drafts** — an author with two drafts and one
   already-submitted submission opens My Submissions and, from the "…" More Actions
   button beside "Filters" at the top left above the table, chooses "Delete
   Incomplete Submissions". A checkbox column appears — checkboxes sit only on the
   two draft rows, the submitted row has none. The red "Delete Incomplete
   Submissions" button stays disabled until they check the drafts; pressing it opens
   the "Confirm Delete of Incomplete Submissions" dialog — "Are you sure you want to
   delete the selected items? This action cannot be undone. Please confirm to
   proceed." — with "Confirm" and "Cancel" buttons. Pressing Confirm, both draft
   rows vanish at once; the left-hand view counts follow within about ten seconds
   (re-check them rather than reading once; no page reload either way), and the
   submitted submission is untouched.
5. **A Journal Manager cleans up other people's drafts** — a Journal Manager opens
   the editorial dashboard's "Active submissions" view, where another user's
   abandoned, unassigned draft appears with an "Incomplete" badge (the same draft
   also shows under "Needs editor", with a "Complete submission" button of its own —
   expected today though flagged as wrong by design intent: verify it is present,
   do not file a new bug). Via the "…" More Actions menu they enable "Delete
   Incomplete Submissions", check that draft (checkboxes appear on draft rows
   only), and press "Confirm" in the "Confirm Delete of Incomplete Submissions"
   dialog (its buttons are Confirm and Cancel) — the draft is deleted even though
   the manager was never assigned to it. A Section Editor
   opening their dashboard finds no "…" More Actions button above the table at all.
6. **The Saved for Later page goes stale after submitting (⚠ known deviation)** — an
   author saves for later, keeps the "Saved for Later" page's address, then finishes
   and submits the submission. Revisiting the kept address still shows the "not yet
   been submitted" explanation and claims a link was just emailed (no email was
   sent) — only following the embedded link reveals the truth by landing on
   "Submission complete". This stale copy is the recorded behavior of ledger row 178,
   kept visible here so QA recognizes it rather than filing it fresh.

## Known deviations (as-built ≠ intent)

- ⚠ **Ledger row 167** (docs/e2e/app-changes.md §2) — **amended by live arbitration
  2026-07-11**: the row's original wizard-vs-API dichotomy is FALSE as-built. The
  wizard's Begin Submission form posts through the same creation route as machine
  clients (PKPSubmissionController::add() → Repository::add(), whose stamp check
  runs while `submission_progress` is still empty), so **every** real draft carries
  a `date_submitted` stamp from the moment it is begun (re-stamped on real submit) —
  there is no unstamped creation path. Suspected intent: stamp only on submit.
  Downstream symptom: the "Needs editor" view keys on a non-null `date_submitted`
  (Collector isUnassigned branch), so every unassigned draft appears there — rule 6
  and its footnote were correct as originally written and were re-confirmed by the
  same arbitration. Recorded under submission-wizard; surfaces here because draft
  lists, exports and the manager's "Needs editor" view present never-submitted
  drafts as submitted. Test-authoring corollary: the TEST-scenario seeder creates
  drafts WITHOUT the stamp, so seeded drafts are invisible to "Needs editor" — a
  seeding fidelity gap (fix belongs in the seeder), not app behavior. Row 167's
  wording needs this amendment (proposed row text in the merge report).
- ⚠ **Ledger row 174**: the `submissionProgress` schema whitelist lacks
  `reviewerSuggestions` while save-for-later (which bypasses schema validation)
  stores that step id — latent 400 on any future schema-validated write. Owned by
  submission-wizard.
- ⚠ **Ledger row 176**: `saveForLater` has no completed-submission guard — a direct
  `PUT …/saveForLater` on a SUBMITTED submission rewrites the progress marker and
  reopens its wizard (dateSubmitted retained — hybrid state). MEDIUM,
  state-machine integrity, API-only. Owned by submission-wizard.
- ⚠ **Ledger row 178**: the "Saved for Later" page renders its not-yet-submitted copy
  for submissions that have been submitted (PKPSubmissionHandler::saved() checks
  access, not submitted state; static template). Scenario 6 walks it. Owned by
  submission-wizard.
- ⚠ **Ledger row 183** (owned by THIS feature): `DELETE /api/v1/submissions/{id}` on
  an incomplete draft returns 500 (`getData() on null` during post-delete mapping)
  but the draft IS deleted; the same call as the draft's own author is refused 401
  (route roleAuthorizer omits Author) — diverging from the wizard's Cancel, which
  authors may use. **Re-verified live 2026-07-11** (as the ledger note requested):
  reproduces exactly — manager gets the 500 body `{"error":"Call to a member
  function getData() on null"}` and the draft is deleted; the author gets 401
  roleBasedAccessDenied and nothing is deleted. Propose updating the row's note.
- ⚠ **Save-for-later email goes to the acting user, not the submitting author**
  (**live-confirmed 2026-07-11**, Mailpit with a positive control — proposed NEW
  ledger row L-A): PKPSubmissionController::saveForLater() sets
  `recipients([$request->getUser()])`, so a Journal Manager pressing Save for Later
  on an author's draft receives the resume email themselves (body greets the
  manager) and the author gets nothing; the "Saved for Later" page likewise shows
  the manager's own address in "We have emailed a copy of this link to you at …" —
  yet the mailable declares Author as its recipient role (`$toRoleIds`). Suspected
  intent: mail the draft's author(s).
- ⚠ **Junk step tokens are accepted, persisted, and silently remapped to step one**
  (**live-confirmed 2026-07-11** — proposed NEW ledger row L-B, extending row 174's
  whitelist gap): `PUT …/saveForLater` with `step="zzz"` (author, CSRF) → 200 and
  `submissionProgress="zzz"` persisted; reopening the wizard falls back to the FIRST
  step ("Upload Files" — SubmissionWizardPage.vue steps[0] fallback). A saveForLater
  with NO step also succeeds: 200, marker unchanged, and the resume email is still
  sent (mail is unconditional; only the marker write is gated on a non-empty step).
  API-only; no UI path sends junk. Suspected intent: validate against the wizard's
  real step ids.
- ⚠ **On-screen bulk-delete eligibility is looser than the server's**
  (code-derived, still unprobed — but **reachable without DB surgery**, upgraded
  2026-07-11): useDashboardBulkDelete() canBeDeleted() accepts an author assignment
  on *any* stage while Repository::canCurrentUserDelete() requires one on the
  Submission stage. The reachable recipe: configure an Author user group WITHOUT the
  Submission stage — such an author can still begin drafts, because the creation
  route's stage filter is disabled pending an upstream fix
  (PKPSubmissionController::add(), `withStageIds(WORKFLOW_STAGE_ID_SUBMISSION)`
  commented out — pkp/pkp-lib#10929), but their stage assignments then fail the
  server's delete rule — the checkbox renders and the whole batch is refused (403;
  the all-or-nothing rule 11). Needs a live probe with that journal configuration
  before it becomes a ledger row.
- **Dead "can be disabled" flag on the mailable** (code-derived; the UI half
  **live-confirmed 2026-07-11** — Manage Emails shows no disable toggle anywhere for
  this template): SubmissionSavedForLater
  sets `$canDisable = true` but `Mailable::canDisable()` has no caller anywhere in
  lib/pkp or the UI — no settings surface offers the off switch the flag promises.
  Also vestigial: an unused `Decision` import and `DECISION_DESCRIPTION` constant
  copy-pasted into the mailable. Cleanup candidates, not user-facing bugs.

## Open questions

1. Should the save-for-later email go to the draft's author(s) instead of (or in
   addition to) the acting user, when an editor or manager saves on the author's
   behalf?
2. Is "Submission Saved for Later" meant to be disable-able per journal (the flag
   says yes, no mechanism exists), or should the flag be dropped?
3. Should the general single-submission deletion API admit authors for their own
   drafts, matching the wizard's Cancel (ledger 183's role-gate half)?
4. Drafts double-appear in "Active submissions" and "Incomplete submissions" on My
   Submissions — intended (a draft *is* active) or should Active exclude drafts?
5. The single-item deletion path (rule 12) lets a Journal Manager delete **any**
   submission, submitted ones included; its on-screen use is limited to declined
   submissions. Should the server restrict it to drafts and declined submissions,
   or is the broad manager rule intentional?
6. Atom boundary (narrowed by the coverage audit 2026-07-11, which removed this
   spec's claim): the legacy submissions list panel (with its "Incomplete" filter)
   is mounted today only by export-tool pages (e.g. the PubMed export plugin's
   submission picker) — which spec should claim its atom: author-dashboard (its
   atlas hint) or the import/export tools feature?

---

<!-- REFERENCE MATERIAL — provenance and campaign bookkeeping, not product-owner
     narrative. The PO-facing "where do I find this" is in Purpose. -->

## Reference — entry points & surfaces

| Entry | Path | Atom |
|-------|------|------|
| Save for Later action | Wizard page-heading + step-footer buttons → `PUT api/v1/submissions/{submissionId}/saveForLater` (body `step`) | API-submission-save-for-later |
| "Saved for Later" page | `{journal}/submission/saved?id={submissionId}` (SubmissionHandler::saved, lib/pkp/pages/submission/PKPSubmissionHandler.php) | PAGE-submission-saved (claimed HERE per coverage audit 2026-07-11; the wizard spec should drop its claim) |
| Resume email | SubmissionSavedForLater mailable, key `SUBMISSION_SAVED_FOR_LATER`, `{$submissionWizardUrl}` link | MAIL-submission-saved-for-later |
| Resume link / wizard reopen | `{journal}/submission?id={submissionId}` (list row "Complete submission" and email both target it) | PAGE-submission-index (wizard's) |
| Incomplete submissions view | Dashboard → My Submissions → view `incomplete-submissions` (`GET api/v1/_submissions/assigned?isIncomplete=true`) | LOC-submission-dashboard-submissions (labels); views machinery: editorial-dashboards |
| Bulk delete tool | My Submissions / editorial dashboard → "…" More Actions → "Delete Incomplete Submissions" → `DELETE api/v1/_submissions?ids[]=…` — the UI sends it as POST + `X-Http-Method-Override: DELETE` (test-authoring relevance) | API-backend-submissions-bulk-delete-incomplete-submissions |
| Wizard Cancel deletion | Wizard footer "Cancel" (leftmost of Cancel · Save for Later · Continue) → same `DELETE api/v1/_submissions?ids={id}` (PKPSubmissionHandler::getSubmissionCancelUrl), also POST + method-override | API-backend-submissions-bulk-delete-incomplete-submissions (shared) |
| Legacy list panel incomplete filter | Export-tool pages mounting SubmissionsListPanel ("Incomplete" filter → `isIncomplete`) | VUE-submissions-list-panel — NOT claimed here (coverage audit 2026-07-11); cross-reference only, see Open question 6 |
| Single-submission delete API (no UI) | `DELETE api/v1/submissions/{submissionId}` (Manager/Sub-editor gate; ledger 183) | API-submission-delete |
| Single-item backend delete (no UI on this feature's surfaces) | `DELETE api/v1/_submissions/{submissionId}` (Site Admin/Manager/Author gate; NO incomplete filter — rule 12; on-screen caller is the workflow's declined-submission Delete) | API-backend-submissions-bulk-delete-incomplete-submissions (shared route family; no separate atom) |

## Reference — code anchors

- lib/pkp/api/v1/submissions/PKPSubmissionController.php — saveForLater() (:822; route :368 with Manager/Sub-editor/Author gate), delete() (:962; route :260 Manager/Sub-editor gate — ledger 183), add() (single creation route for wizard + API; Submission-stage user-group filter commented out pending pkp/pkp-lib#10929)
- lib/pkp/api/v1/_submissions/PKPBackendSubmissionsController.php — bulkDeleteIncompleteSubmissions() (:442; route :79 Site Admin/Manager/Author gate; pre-flight validation then non-transactional delete loop), delete() (:409; single-item route `{submissionId}` :89, Site Admin/Manager/Author gate, no incomplete filter — rule 12), getSubmissionCollector() `isIncomplete`
- lib/pkp/pages/submission/PKPSubmissionHandler.php — saved() (:373), cancelled() (:358), getSubmissionCancelUrl() (:469 — points Cancel at `_submissions?ids=`), showWizard() canCancelSubmission
- lib/pkp/classes/submission/Repository.php — canCurrentUserDelete() (:508), getDashboardViews()/mapDashboardViews() (TYPE_INCOMPLETE_SUBMISSIONS :1254), add() dateSubmitted stamp (:614)
- lib/pkp/classes/submission/Collector.php — filterByIncomplete() (:211; SQL `submission_progress <> ''` :536); isUnassigned branch requires non-null `date_submitted` (the "Needs editor" ↔ row-167 link)
- lib/ui-library/src/pages/workflow/composables/useWorkflowActions.js — workflowDeleteSubmission() (the single-item backend delete's only UI caller; offered on declined submissions via workflowConfigEditorialOJS.js)
- lib/pkp/classes/mail/mailables/SubmissionSavedForLater.php; lib/pkp/classes/mail/variables/SubmissionEmailVariable.php (SUBMISSION_WIZARD_URL); registry/emailTemplates.xml SUBMISSION_SAVED_FOR_LATER; lib/pkp/locale/en/emails.po (subject/body defaults)
- lib/pkp/templates/submission/saved.tpl; lib/pkp/templates/submission/wizard.tpl (Save for Later / Cancel buttons)
- lib/ui-library/src/components/Container/SubmissionWizardPage.vue — saveForLater() (:556), cancelSubmission() (:835), openSaveForLaterFailed()
- lib/ui-library/src/pages/dashboard/composables/useDashboardBulkDelete.js — tool availability, canBeDeleted, dialog; components/DashboardControlBulkActions.vue, DashboardControlBulkDeleteButton.vue, DashboardTable/DashboardCellBulkDelete.vue
- lib/ui-library/src/pages/dashboard/composables/useDashboardConfigEditorialActivity.js — "Complete submission" action; DashboardTable/DashboardCellSubmissionActions.vue (View suppressed); lib/ui-library/src/composables/useSubmission.js — "Incomplete" extended stage
- lib/pkp/pages/dashboard/PKPDashboardHandler.php — mySubmissions/editorial ops, per-page role gates and selected roles
