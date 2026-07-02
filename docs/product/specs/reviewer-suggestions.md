---
name: reviewer-suggestions
scope: An author names potential peer reviewers (name, email, affiliation, reason) in a dedicated submission-wizard step; after submit the frozen list surfaces to editors in the workflow and inside Add Reviewer, where a suggestion pre-fills the create/enroll/assign forms — plus the journal toggle and guidance text that switch the whole feature on
shared: pkp-lib
status: verified
e2e-plans: [reviewer-suggestions.md]
atlas-claims:
  - VUE-reviewer-suggestion-manager
  - VUE-reviewer-suggestions-list-panel
  - FORM-reviewer-suggestions-form
  - API-reviewer-suggestion-get
  - API-reviewer-suggestion-get-many
  - API-reviewer-suggestion-add
  - API-reviewer-suggestion-edit
  - API-reviewer-suggestion-delete
  - DB-reviewer_suggestions
  - DB-reviewer_suggestion_settings
---

# Reviewer suggestions

## Purpose

Journals that want the author's help finding peer reviewers turn on **Reviewer
Suggestion at Submission** (Settings → Workflow → Review). The submission wizard then
gains a **Reviewer Suggestions** step (between For the Editors and Review) where the
author lists potential reviewers — name, email, affiliation and a reason for the
suggestion — via an Add/Edit/Delete list panel. Submitting the manuscript freezes the
list. On the editorial side each suggestion becomes actionable: a **Reviewers
Suggested by Author** panel in the workflow's right rail, and a **Select a Reviewer
from Reviewer Suggestions** section inside the Add Reviewer dialog, let an editor turn
a suggestion into a real reviewer assignment with the create/enroll/assign form
pre-filled from the suggestion. A suggestion is either *pending* or *approved* (it was
used to assign a reviewer); there is no decline action — unused suggestions are simply
ignored. `publicknowledge` on the test environment has the feature ON (bootstrap
enrichment); a freshly created journal has it OFF.

## Actors & permissions

Baselines: everything here requires a logged-in account; who can *open the wizard* at
all (submitting author, managers/site admins, assigned participants) is owned by
`submission-wizard`. "Pre-submit" means the submission is still in the wizard —
after final submit the list is frozen for **everyone** (rule 4). All author-side
surfaces exist only while the journal toggle is on. <sup>a</sup>

| Action | Who may — and when |
|--------|--------------------|
| **See / fill the wizard step** | • Anyone who can open the draft's wizard — only when the journal toggle is on (live-probed both shapes) <sup>b</sup> |
| **Add / edit / delete a suggestion** | • The submitting author — pre-submit only (live-probed: add/edit/delete all succeed on own draft)<br>• Managers and site admins — same pre-submit window, any draft they can open (live-probed: manager adds to an author's draft)<br>• Sub-editors — accepted by the suggestion service; reach it via a draft they are assigned to (wizard access per `submission-wizard`)<br>• Assistants and reviewers — refused by the suggestion service even for submissions they can otherwise reach (live-probed: assistant and reviewer both get "The current role does not have access to this operation."). Assistants also cannot open the wizard at all — its role gate admits only author/sub-editor/manager/site-admin — so the *no dead Add button* worry does not arise: a copyeditor seeded onto a draft's stage assignment is redirected to `authorizationDenied` before any suggestion panel renders (live-probed) <sup>c</sup> |
| **View suggestions as editorial staff** | • Managers, site admins and assigned sub-editors — the "Reviewers Suggested by Author" panel at the Submission and Review stages (live-probed as dbarnes); the panel only renders when there is something to list<br>• Unassigned sub-editors — refused (live-probed: a section editor of another section is denied the read)<br>• Assistants — no panel content (their read is refused, so the panel stays empty/hidden)<br>• Reviewers — never (service refuses the role; no UI surface) <sup>d</sup> |
| **View as the author after submit** | • No UI surface — the author dashboard has no suggestion panel (live-probed)<br>• ⚠ API-only: the author's read access continues and reveals approval state — see Known deviations 1 <sup>e</sup> |
| **Use a suggestion ("Add Reviewer")** | • Editors who can assign reviewers on the round — the per-suggestion action appears only on a review round while the submission is currently in the review stage (live-probed: present at Review Round 1, absent at the Submission stage); assignment mechanics belong to `assign-and-manage-reviewers` <sup>f</sup> |
| **Decline / dismiss a suggestion** | • Nobody — no such affordance exists anywhere; the only menu item is "Add Reviewer" (live-probed) and pending suggestions just remain listed <sup>g</sup> |
| **Configure the toggle & guidance** | • Managers with settings access and site admins — Settings → Workflow (live-probed: admin flips the checkbox on a scratch journal); the settings page as a whole is owned by `workflow-settings` <sup>h</sup> |

<sup>a</sup> ReviewerSuggestionController::getRouteGroupMiddleware() (site admin/manager/sub-editor/author), authorize() (SubmissionAccessPolicy; SubmissionIncompletePolicy on add/edit/delete) ·
<sup>b</sup> PKPSubmissionHandler::getSteps() (`reviewerSuggestionEnabled` gate); live probes 2026-07-02 ·
<sup>c</sup> ReviewerSuggestionController::add()/edit()/delete(); PKPSubmissionHandler::getRouteGroupMiddleware() (wizard role gate: author/sub-editor/manager/site-admin only — no assistant); live probes 2026-07-02 (author + manager 200 on draft; mfritz/jjanssen 401 `roleBasedAccessDenied`; assigned copyeditor redirected to authorizationDenied on wizard open) ·
<sup>d</sup> workflowConfigEditorialOJS.js getSecondaryItems() (`isReviewerSuggestionEnabled`); ReviewerSuggestionManager.vue (`v-if` on list length); PKPDashboardHandler::setupIndex() `publicationSettings` ·
<sup>e</sup> workflowConfigAuthorOJS.js (no ReviewerSuggestionManager); live probe 2026-07-02 (author dashboard, panel absent; API read 200) ·
<sup>f</sup> reviewerSuggestionManagerStore.js atActiveReviewStage(); useReviewerSuggestionManagerActions.js ·
<sup>g</sup> useReviewerSuggestionManagerActions.js getItemActions() (single action) ·
<sup>h</sup> PKPReviewSetupForm::addReviewSuggestionControl(); ManagementHandler::authorize() (CanAccessSettingsPolicy)

## Fields & validation

The wizard step shows the journal's guidance text, then a **Reviewer Suggestions**
list panel: each row shows the person's name with an affiliation badge and their email
underneath, plus **Edit** and **Delete** buttons; **Add Reviewer Suggestion** opens a
side modal of the same name (all live-probed). Saving the empty modal flags every
required field with "This field is required.". Multilingual fields repeat per
supported form language (e.g. "French Given Name in French"); email is single-valued.
There is **no limit** on how many people can be suggested. <sup>a</sup>

| Field (UI label) | Required? | Rules |
|------------------|-----------|-------|
| **Given Name** | Yes | One-line text; multilingual |
| **Family Name** | No | One-line text; multilingual (a given-name-only suggestion saves fine — live-probed) |
| **Email** | Yes | Valid email; must be unique among this submission's suggestions — a duplicate is refused with "The email has already been taken." (live-probed); the same person may be suggested on other submissions |
| **ORCID iD** | No | Present only when ORCID is configured for the journal (absent on the test environment — live-probed); validated as an ORCID |
| **Affiliation** | Yes | One-line text; multilingual |
| **Reasons for suggesting reviewer** | Yes | Rich text; multilingual; description asks why the person is recommended and about potential conflicts of interest |

<sup>a</sup> ReviewerSuggestionsForm::__construct() (fields, `OrcidManager::isEnabled()` gate); AddReviewerSuggestion::rules() (required set, `Rule::unique` scoped to the submission), EditReviewerSuggestion::rules(); ReviewerSuggestionsListPanel.vue; live probes 2026-07-02

## Rules & state

A suggestion has two states: **pending** (default) and **approved** (an editor used it
to assign a reviewer; the approval records when, by whom, and which user became the
reviewer).

1. **Step presence follows the journal toggle, bound at page load**: with the toggle
   off the wizard has no Reviewer Suggestions step; turning it on adds the step (with
   the journal's guidance text on top) between *For the Editors* and *Review* — a
   draft started while the toggle was off gains the step on next load (live-probed on
   a scratch journal: 5 steps → toggle on → 6 steps, default guidance shown).
   <sup>a</sup>
2. **Suggesting is wizard-only**: suggestions are created, edited and deleted from
   the step's list panel while the submission is in the wizard; the suggesting user
   is recorded. Deleting asks "Are you sure you want to remove this suggestion? This
   action can not be undone." (live-probed). <sup>b</sup>
3. **The Review step repeats the list, and an empty list warns without blocking**:
   the read-only *Reviewer Suggestions* review panel lists each suggestion's name,
   email and affiliation with an Edit link back to the step; with no suggestions it
   shows a warning — "No reviewers have been suggested for this submission." — but
   submission is not blocked (no completion rule exists for this step; live-probed).
   <sup>c</sup>
4. **Submit freezes the list for everyone**: after final submit, add/edit/delete are
   refused — for the author *and* for managers/site admins — with "Add, update or
   delete of reviewer suggestion for completed submission is restricted."
   (live-probed both roles, all three verbs: author add/edit and manager add/delete
   all 401). The freeze keys on submission *completion*, not stage or outcome — an
   **initially-declined** submission is equally frozen (live-probed: author add on a
   declined submission → same restriction). Approval (rule 7) is the only change that
   can still happen. <sup>d</sup>
5. **Editor surfacing — the "Reviewers Suggested by Author" panel** (right rail,
   editorial workflow): at the **Submission stage** it lists **every** suggestion
   read-only — *including already-approved ones* (the submission-stage manager gets no
   review round, so it fetches unfiltered and keeps rows with a `reviewerId`;
   live-probed post-approval: the approved suggestion stays listed at the Submission
   stage with no actions menu, while a still-pending sibling also shows). On a
   **Review round** it lists only pending suggestions not yet tied to a reviewer, each
   row with an actions menu whose single item is **Add Reviewer** — and that menu only
   exists while the submission is currently in the review stage (live-probed: menu at
   Review Round 1; approved rows dropped; no buttons at the Submission stage). Rows
   show initials-avatar, name, affiliation and the suggestion reason (not the email).
   The panel disappears entirely when it has nothing to list or the toggle is off.
   <sup>e</sup>
6. **"Add Reviewer" on a suggestion routes by what the suggested email matches**
   (create and already-a-reviewer branches live-probed end-to-end at HEAD; the
   enroll-existing branch's pre-filled form live-probed, its completion verified by
   the retained round-1 test — e2e plan row 5):
   • no account with that email → **Create New Reviewer**, pre-filled with the
   suggestion's given/family name, email and affiliation (username left to complete);
   • an account without the reviewer role → **Enroll Existing User as Reviewer**,
   the account pre-selected and the reviewer group pre-chosen;
   • an account already holding the reviewer role → the assignment form directly,
   with "Selected Reviewer: *account name*".
   Matching is by email only — the form shows the *account's* name where one exists,
   even when the author typed a different name (live-probed: suggestion "Jennifer
   Janssen" pre-selected the account "Julie Janssen" behind the same email).
   <sup>f</sup>
7. **Completing the assignment approves the suggestion — permanently**: the
   suggestion is stamped with the approval time, the approving editor and the
   resulting reviewer's account (live-probed via API: `approvedAt`, `approverId`,
   `reviewerId`). Approval can never be undone or re-run: the stamps refuse
   overwriting, and opening the add-reviewer form against an already-approved
   suggestion is rejected server-side. Approved suggestions leave the review-round
   panel and the Add-Reviewer suggestions section; the panel-action path refreshes
   the list live (live-probed; the standalone-dialog path needs a reload — ledger
   §2 row 52). <sup>g</sup>
8. **The standalone Add Reviewer dialog offers the suggestions first**: with the
   toggle on, the reviewer-selection step shows **Select a Reviewer from Reviewer
   Suggestions** (name, affiliation, reason, a *Select Reviewer* button per pending
   suggestion) above the regular *Locate a Reviewer* list; selecting one routes
   exactly per rule 6 (live-probed, screenshot-verified). <sup>h</sup>
9. **Email match auto-approves even outside the suggestion UI**: assigning a reviewer
   whose account email equals a pending suggestion's email approves that suggestion
   automatically — live-probed: picking the account from the plain *Locate a
   Reviewer* list (never touching the suggestion controls) stamped the matching
   suggestion approved and linked the reviewer. <sup>i</sup>
10. **Suggestions are per-submission rows, resilient to user deletion**: each row
    belongs to one submission (cascade-deleted with it); losing the suggesting user,
    approver or linked reviewer account nulls the reference without deleting the
    suggestion. <sup>j</sup>
11. **Reviewers never see the suggestions** — the service refuses the reviewer role
    outright (live-probed), no reviewer-facing surface lists them; the wider
    who-sees-what matrix once review starts is owned by `review-anonymity`.
    <sup>k</sup>

<sup>a</sup> PKPSubmissionHandler::getSteps(), getReviewerSuggestionsStep() (`reviewerSuggestionsHelp` description); live probes 2026-07-02 ·
<sup>b</sup> AddReviewerSuggestion::prepareForValidation() (`suggestingUserId` = current user); ReviewerSuggestionsListPanel.vue openDeleteModal(); live probes 2026-07-02 ·
<sup>c</sup> templates/submission/review-reviewer-suggestions.tpl (`submission.wizard.noReviewerSuggestions` warning); Repository::validateSubmit() (no reviewer-suggestion rule); live probes 2026-07-02 ·
<sup>d</sup> SubmissionIncompletePolicy via ReviewerSuggestionController::authorize() (`user.authorization.submission.complete.reviewerSuggestionRestrict`); live probes 2026-07-02 ·
<sup>e</sup> workflowConfigEditorialOJS.js (submission-stage + review-stage secondary items); reviewerSuggestionManagerStore.js (`?approved=false` + `!reviewerId` filter per round, atActiveReviewStage()); ReviewerSuggestionManager.vue; live probes 2026-07-02 ·
<sup>f</sup> useReviewerSuggestionManagerActions.js reviewerSuggestionApprove() (selectionType by existingUserId/hasExistingReviewerRole); PKPReviewerGridHandler::getReviewerForm(); CreateReviewerForm::initData(); EnrollExistingReviewerForm::initData(); AdvancedSearchReviewerForm::initData(); ReviewerSuggestion::existingUser() (match by email); live probes 2026-07-02 ·
<sup>g</sup> ReviewerForm::execute() → ReviewerSuggestion::approveAndAttachReviewer(); ReviewerSuggestion::approvedAt()/reviewerId() (set-once attributes); PKPReviewerGridHandler::getReviewerForm() (approved → exception); live probes 2026-07-02 ·
<sup>h</sup> PKPSelectReviewerListPanel::getConfig() (`suggestionTitle`, `suggestions` = pending only); SelectReviewerListPanel.vue / SelectReviewerSuggestionListItem.vue; live probe 2026-07-02 ·
<sup>i</sup> ReviewerForm::execute() (`??=` lookup: unapproved suggestion by assigned reviewer's email); live probe 2026-07-02 ·
<sup>j</sup> ReviewerSuggestionsMigration::up() (FKs: submission cascade; user references `set null`) ·
<sup>k</sup> ReviewerSuggestionController::getRouteGroupMiddleware(); live probe 2026-07-02

## Side effects

Deliberately quiet. Adding, editing, deleting and approving a suggestion send **no
emails**, raise **no notifications**, and write **no activity-log entries** of their
own (the controller performs bare CRUD). The suggested person is never contacted by
this feature — mail starts only if an editor assigns them, at which point the normal
add-reviewer side effects fire (review-request email, notification, "reviewer
assigned" log entry — owned by `assign-and-manage-reviewers`). <sup>a</sup>

<sup>a</sup> ReviewerSuggestionController (no Mail/Notification/EventLog usage); ReviewerForm::execute() (assignment side effects live there)

## Settings that modify behavior

- **Reviewer Suggestion at Submission** (Settings → Workflow → Review, Setup) — the
  checkbox "Allow authors to suggest potential reviewers at submission process".
  Off by default on a new journal (live-probed); turning it on adds the wizard step
  (rule 1), the editor panels (rule 5) and the Add-Reviewer suggestions section
  (rule 8). Turning it off hides all those surfaces; stored suggestions are kept but
  unreachable in the UI (live-probed: on a scratch journal with one suggestion, the
  editor panel vanished after the toggle was cleared while the `reviewer_suggestions`
  row and its API read both persisted). <sup>a</sup>
- **For Reviewer Suggestion** guidance text (Settings → Workflow → Submission, among
  the wizard guidance fields; multilingual rich text) — shown at the top of the
  wizard step; defaults to the stock "…you have the option to suggest several
  potential reviewers…" text (live-probed). The guidance-settings form itself is
  owned by `submission-settings`/`workflow-settings`. <sup>b</sup>
- **ORCID configuration** — when ORCID is enabled for the journal, the suggestion
  modal gains the optional ORCID iD field (Fields table). <sup>c</sup>
- **App-schema note**: both context properties live in OJS's own context schema, and
  the shared pkp-lib forms/steps check the schema before adding the control — so the
  feature only exists in apps whose schema defines it (OJS does). <sup>d</sup>

<sup>a</sup> schemas/context.json `reviewerSuggestionEnabled` (no default); PKPReviewSetupForm::addReviewSuggestionControl(); live probes 2026-07-02 ·
<sup>b</sup> schemas/context.json `reviewerSuggestionsHelp` (`defaultLocaleKey: default.submission.step.reviewerSuggestions`); SubmissionGuidanceSettings::addReviewSuggestionGuidanceDetail() ·
<sup>c</sup> ReviewerSuggestionsForm::__construct() (`OrcidManager::isEnabled()`) ·
<sup>d</sup> PKPReviewSetupForm::addReviewSuggestionControl() / SubmissionGuidanceSettings::addReviewSuggestionGuidanceDetail() (schema-property guards)

## Cross-feature interactions

- **submission-wizard** — owns the wizard shell (step order, autosave, Review-step
  banner mechanics, save-for-later, the incomplete-only guard policy atoms); this
  spec owns the Reviewer Suggestions step's content and its review panel/warning.
- **assign-and-manage-reviewers** — owns the Add Reviewer modal mechanics, reviewer
  search, assignment side effects and emails; this spec owns only how suggestions
  enter that flow (pre-fill, routing, approval stamping).
- **review-anonymity** — owns who-sees-what once assignment starts; referenced by
  rule 11 and Known deviations 1.
- **workflow-settings** — owns Settings → Workflow as a page (the Review setup form
  atom); this spec owns the toggle's meaning.
- **submission-settings** — owns the guidance-text settings form
  (FORM-submission-guidance-settings); this spec owns the reviewer-suggestions
  guidance field's effect.
- **profile-orcid / site ORCID config** — determines the ORCID field's presence.

## Canonical scenarios

1. **Author manages suggestions in the wizard** — atester on `publicknowledge`
   (feature on by default): the wizard shows *5 Reviewer Suggestions* between For the
   Editors and Review; "Add Reviewer Suggestion" opens the modal; saving empty flags
   the four required fields; a valid save lists the person with affiliation badge,
   email, Edit and Delete; a second suggestion with the same email is refused ("The
   email has already been taken."); Delete (after the cannot-be-undone dialog)
   removes the row; the Review step's panel mirrors the list, or warns "No reviewers
   have been suggested for this submission." without blocking Submit.
2. **The journal toggle controls the step** — on a scratch journal the wizard has 5
   steps (no Reviewer Suggestions); a manager ticks "Allow authors to suggest
   potential reviewers at submission process" in Settings → Workflow → Review and
   saves; reloading the same in-flight draft now shows 6 steps, with the default
   guidance text atop the new step.
3. **Suggestions survive submit, reach the editor, and freeze** — atester submits
   with suggestions attached; dbarnes sees "Reviewers Suggested by Author" (name,
   affiliation, reason) at the Submission stage without actions and on Review Round 1
   with the actions menu; add/edit/delete attempts now fail for author *and* editor
   with the completed-submission restriction; a reviewer's read is refused outright;
   the author's dashboard shows no suggestion panel.
4. **Approve a suggestion into a brand-new reviewer** — dbarnes, submission in
   review, suggestion email matches no account: "Add Reviewer" on the suggestion
   opens **Create New Reviewer** pre-filled with the suggested name, email and
   affiliation; completing it (username + form defaults) assigns the reviewer, the
   suggestion is stamped approved/linked, and it leaves the round's panel.
5. **Approve a suggestion matching an existing reviewer** — same submission,
   suggestion email = jjanssen's: "Add Reviewer" skips straight to the assignment
   form with "Selected Reviewer: Julie Janssen" (account name, matched by email —
   no create fields); completing it assigns her, stamps the suggestion approved with
   `reviewerId` = her account, and the panel refreshes without her.
6. **Standalone Add Reviewer meets the suggestions — and email match auto-approves**
   — dbarnes opens the round's own "Add Reviewer" button: the selection step shows
   "Select a Reviewer from Reviewer Suggestions" listing pending suggestions above
   "Locate a Reviewer"; ignoring it and assigning the matching account from the
   regular list still auto-approves the pending suggestion (approvedAt + reviewerId
   set). A suggestion whose email belongs to a role-less account routes to **Enroll
   Existing User as Reviewer** pre-selected (its completion enrolls and assigns —
   e2e plan row 5).

## Known deviations (as-built ≠ intent)

- ⚠ **The author can watch editorial uptake of their suggestions via the API**
  (docs/e2e/app-changes.md §2 row 64; re-verified live end-to-end 2026-07-02): after
  submit, the author's suggestion reads keep returning 200 and each item carries
  `approvedAt`, `reviewerId`, `existingUserId`, `hasExistingReviewerRole` — and
  `?include_reviewer_data=true` returns the linked reviewer's full editorial summary
  (email, biography, affiliation, review-workload stats, even ORCID token fields). No
  UI surface exposes this (API-only), but on the double-anonymous default journal
  (`publicknowledge`, `defaultReviewMode=2` — confirmed) it tells the author *which*
  suggested people actually became reviewers and when (probed: author `atester` read
  submission 70 after `dbarnes` assigned `jjanssen` — saw `approvedAt` + `reviewerId`
  + the full reviewer object). Suspected intent: post-submit reads for authors should
  hide approval state (or be editorial-only). ReviewerSuggestionResource::toArray();
  ReviewerSuggestionController::getMany() (no role-based field filtering).
- ⚠ **A11y + refresh quirks in the Add-Reviewer suggestion list**
  (docs/e2e/app-changes.md §2 row 52): every suggestion's Select button announces
  "Select undefined" (re-confirmed live at HEAD 2026-07-02:
  `SelectReviewerSuggestionListItem.vue` interpolates a missing `fullName`), and on
  the standalone enroll path the dialog pops back to the selection step without
  live-refreshing the manager. The suggestion-*panel* path does refresh live
  (re-probed: the approved row left the panel without reload).
- **`submissionProgress` whitelist omits the step id** (benign; cross-ref
  `submission-wizard` Open question 4): Save for Later on this step writes
  `submissionProgress = 'reviewerSuggestions'` — a value outside the submission
  schema's `in:,start,details,files,contributors,editors,review` list — because
  saveForLater bypasses schema validation; resume nonetheless reopens the step
  (live-probed end-to-end). Fix is to add the value to the schema list.
- **Language sub-labels differ from the rest of the wizard** (cosmetic;
  live-probed): the suggestion modal labels secondary languages without region
  ("French Given Name in French") while sibling wizard forms say "French (Canada)" —
  the step's locale names are built with `LANGUAGE_LOCALE_WITHOUT`
  (PKPSubmissionHandler::showWizard(), reviewer-suggestions branch).

## Open questions

1. **Which language is "required"?** The suggestion form's multilingual required
   rule anchors to the journal's primary locale (AddReviewerSuggestion::primaryLocale()
   → context primary), while the wizard's other forms require the *submission
   language*. **Now live-probed with a French (`fr_CA`) submission on `publicknowledge`
   (primary `en`)**: a suggestion supplying only `fr_CA` values is rejected with
   `givenName.en`/`affiliation.en`/`suggestionReason.en` "This field is required.",
   while an `en`-only save succeeds — confirming the required locale is the *context
   primary*, not the submission language. As-built is settled; the open part is intent
   only: should it follow the submission language like the other wizard forms?
2. **Silent expiry after review**: once the submission leaves the review stage,
   pending suggestions remain listed (Submission-stage panel) but no surface can
   approve them anymore. Is "suggestions are only actionable during review" the
   intended lifecycle end?
3. **`SCHEMA-submission-ojs` ownership**: the OJS submission overlay bundling
   `sectionId`/`issueToBePublished`/`reviewerSuggestions` is hinted to
   `submission-settings` and is *not* claimed here — reviewer-suggestions owns only its
   dedicated atoms (the read-only `reviewerSuggestions` property rides along on that
   multi-concern schema atom). Confirm `submission-settings` claims it at grooming.
   (The other flagged hint — `DB-reviewer_recommendations` → `reviewer-suggestions` —
   was a mis-hint for a *different* feature, the configurable reviewer-recommendation
   options; corrected in `atlas/db-entities.md` to `review-settings` during this pass.)
4. **Stale-bundle hazard for this feature's tests** (test-env note, not a product
   bug): the running `js/build.js` predated the June 25 API field rename
   (`existingReviewerRole` → `hasExistingReviewerRole`), which silently sent every
   existing-user suggestion down the enroll-existing branch until the bundle was
   rebuilt during this spec's probes. Worth a bootstrap check (bundle newer than
   lib/ui-library HEAD?) so affordance probes don't chase ghosts.

---

## Reference — entry points & surfaces

| Entry | Path | Atom |
|-------|------|------|
| Wizard step | `/{journal}/submission?id=N` step 5 `#reviewerSuggestions` (when enabled) | — (step assembly owned by submission-wizard's PAGE atoms) |
| Wizard list panel (Vue) | `ReviewerSuggestionsListPanel` + `ReviewerSuggestionsEditModal` | VUE-reviewer-suggestions-list-panel |
| Suggestion form (config) | `ReviewerSuggestionsForm` (given/family/email/orcid/affiliation/reason) | FORM-reviewer-suggestions-form |
| Wizard review panel | `templates/submission/review-reviewer-suggestions.tpl` | — (rendered inside the wizard's Review step) |
| Editor panel (Vue) | `ReviewerSuggestionManager` (workflow right rail, Submission + Review stages) | VUE-reviewer-suggestion-manager |
| Add Reviewer suggestions section | `SelectReviewerListPanel` (`suggestions` config from PKPSelectReviewerListPanel) | — (panel atom owned by assign-and-manage-reviewers) |
| List / read API | `GET api/v1/submissions/{id}/reviewers/suggestions[?approved=bool]`, `GET …/{suggestionId}` | API-reviewer-suggestion-get-many, API-reviewer-suggestion-get |
| Mutate API (wizard-only) | `POST …/suggestions`, `PUT …/{suggestionId}`, `DELETE …/{suggestionId}` | API-reviewer-suggestion-add, API-reviewer-suggestion-edit, API-reviewer-suggestion-delete |
| Approval trigger (legacy) | `ReviewerGridHandler::showReviewerForm` + create/enroll/assign ops with `reviewerSuggestionId` | — (grid atom owned by assign-and-manage-reviewers) |
| Storage | `reviewer_suggestions` + `reviewer_suggestion_settings` (multilingual name/affiliation/reason) | DB-reviewer_suggestions, DB-reviewer_suggestion_settings |
| Journal toggle / guidance | `reviewerSuggestionEnabled`, `reviewerSuggestionsHelp` (OJS `schemas/context.json`) | — (context schema atom owned by journal-settings sweeps) |

## Reference — code anchors

- lib/pkp/classes/submission/reviewer/suggestion/ReviewerSuggestion.php (Eloquent model: states, set-once approval attributes, email-match `existingUser`, scopes)
- lib/pkp/api/v1/reviewers/suggestions/ReviewerSuggestionController.php (+ formRequests/AddReviewerSuggestion.php, EditReviewerSuggestion.php, resources/ReviewerSuggestionResource.php)
- lib/pkp/classes/migration/install/ReviewerSuggestionsMigration.php (tables); upgrade I4787_InstallReviewerSuggestion / I11673_AddMissingApprovalToReviewerSuggestion
- lib/pkp/pages/submission/PKPSubmissionHandler.php getReviewerSuggestionsStep(), getReviewerSuggestionsListPanel(), showWizard() (locale-name assembly)
- lib/pkp/classes/components/listPanels/ReviewerSuggestionsListPanel.php + forms/submission/ReviewerSuggestionsForm.php (wizard panel + modal)
- lib/pkp/classes/components/listPanels/PKPSelectReviewerListPanel.php (Add-Reviewer suggestions section)
- lib/pkp/classes/controllers/grid/users/reviewer/PKPReviewerGridHandler.php getReviewerForm(); lib/pkp/controllers/grid/users/reviewer/form/{ReviewerForm,CreateReviewerForm,EnrollExistingReviewerForm,AdvancedSearchReviewerForm}.php (pre-fill + approval + email-match auto-approve)
- lib/ui-library/src/managers/ReviewerSuggestionManager/ (manager, store, actions); lib/ui-library/src/components/ListPanel/reviewerSuggestions/; lib/ui-library/src/components/ListPanel/users/SelectReviewerSuggestionListItem.vue
- lib/ui-library/src/pages/workflow/composables/useWorkflowConfig/workflowConfigEditorialOJS.js (panel placement); lib/pkp/pages/dashboard/PKPDashboardHandler.php (`isReviewerSuggestionEnabled`)
- lib/pkp/classes/components/forms/context/PKPReviewSetupForm.php addReviewSuggestionControl(); lib/pkp/classes/components/forms/submission/SubmissionGuidanceSettings.php addReviewSuggestionGuidanceDetail(); schemas/context.json (OJS)
