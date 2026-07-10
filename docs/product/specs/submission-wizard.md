---
name: submission-wizard
scope: An author fills in and submits a manuscript end-to-end — start, files+genres, details, confirm, consent — and the journal acknowledges it
shared: pkp-lib
status: verified
atlas-claims:
  - PAGE-submission-index
  - PAGE-submission-saved
  - PAGE-submission-wizard
  - PAGE-submission-cancelled
  - VUE-start-submission-form
  - VUE-reconfigure-submission-modal
  - FORM-start-submission-pkp
  - FORM-start-submission-ojs
  - FORM-reconfigure-submission-pkp
  - FORM-reconfigure-submission-ojs
  - FORM-details
  - FORM-confirm-submission
  - FORM-comments-for-the-editors
  - API-submission-add
  - API-submission-submit
  - AUTHZ-submission-complete-policy
  - AUTHZ-submission-incomplete-policy
  - DB-submissions
  - MAIL-submission-acknowledgement
  - MAIL-submission-acknowledgement-not-author
  - MAIL-submission-acknowledgement-other-authors
  - NOTIF-submission-submitted
  - EVLOG-SUBM-SUBMIT
  - EVLOG-SUBM-COPY-AGR
  - LOC-submission-submission-submit
  - LOC-submission-submission-wizard
---

# Submission wizard

## Purpose

The submission wizard is how a manuscript enters the journal. From the "Make a
Submission" page an author starts a submission by naming its title, section and
language and agreeing to the journal's requirements; the wizard then walks them
through a fixed sequence of steps — **Upload Files → Details → Contributors → For
the Editors → (Reviewer Suggestions) → Review** — autosaving as they go, so they can
leave and come back at any time. The final Review step shows everything they entered,
runs the journal's completeness checks, collects any copyright consent, and submits.
Submitting locks the wizard, alerts the editorial team, and emails an acknowledgement
to the authors (Side effects). Journal Managers can walk the same wizard to submit on
an author's behalf. The "For the Editors" metadata fields, the reviewer-suggestions
step content, and the saved-drafts list are owned by neighbouring specs (see
Cross-feature interactions); this spec owns the frame: start, files+genres, details,
comments for the editors, confirm/consent, submit, cancel, and the acknowledgement.

## Actors & permissions

Terms: *in-progress* = a submission still inside the wizard (not yet submitted);
*submitting roles* = the journal roles in which a user may make a submission — their
active roles with access to the journal's first workflow stage (a role's stage
access is granted with the "Stages" checkboxes on its role form, under Users &
Roles → Roles in the journal's settings). Baselines: a **Site
Administrator** or **Journal Manager** may open any in-progress submission in their
scope; **anonymous users** have no access (logging in is always required); and when
the journal has **disabled submissions**, nobody can start a new one — the start page
shows a not-accepting notice instead of the form ⚠ (the notice is worded for Journal
Managers, whoever reads it — Known deviations), while drafts begun before the switch
stay editable and submittable (Settings). Access to an *existing* wizard also
requires access to that specific submission — another author's draft is never
reachable. <sup>a</sup>

| Action | Who may — and when |
|--------|--------------------|
| **Open the start page & begin a submission** | • Any logged-in user — the start screen itself is open to all logged-in visitors, and merely viewing it never enrols anyone<br>• Users with no submitting role are offered the journal's self-registering Author role and enrolled in it on "Begin Submission" — only an Author role with self-registration counts (a self-registering Reviewer or Reader role does not); without one the page says "Not Allowed": "You are not allowed to submit to this journal because authors must be registered by the editorial staff." ⚠ (the underlying service is more permissive than the page — Known deviations) <sup>b</sup> |
| **Choose which role to submit as** | • Anyone with two or more submitting roles — a "Submit As" choice appears; with exactly one, no choice is shown and that role is used<br>• Journal Managers also read a hint that picking an editorial role lets them edit and publish it themselves<br>• Site Administrators — even when the admin also holds an Author role, it is not offered; with a journal's default roles that leaves at most one candidate, so they see no "Submit As" choice at all ⚠ (Known deviations)<br>• Nobody may submit in a Section Editor role — a Section Editor who begins a submission is enrolled as an Author instead, without being told ⚠ (Known deviations) <sup>c</sup> |
| **Open / resume an in-progress wizard** (edit any step, upload files) | • The submitting user and anyone else with an Author assignment on it<br>• Journal Managers — any in-progress submission<br>• Site Administrators — any in-progress submission opens fully, but for an admin holding no role in the journal the wizard is look-and-cancel only: every save and the submit are refused behind the scenes and the buttons fail silently ⚠ (Known deviations)<br>• A Section Editor — when assigned to it<br>• Assistants, Reviewers, Readers — never: even for a submission they work on or review elsewhere, the wizard turns them away (though the start page itself remains open to them) <sup>d</sup> |
| **Change section / language mid-flight** ("Change Submission Settings") | • Anyone who can open the wizard — via the "Change" control beside the "Submitting…" note under the page heading (note and control absent when the journal has only one open section and one submission language) <sup>e</sup> |
| **Save for later** | • Anyone who can open the wizard — a "Save for Later" button in the page heading and another in every step's footer, disabled while the connection is down<br>• Except a Site Administrator with no role in the journal — the buttons show but every save is refused, with nothing telling them ⚠ (Known deviations) <sup>f</sup> |
| **Cancel the submission** (deletes it) | • Journal Managers and Site Administrators — any in-progress submission<br>• The submitter — their own draft, whatever role they submitted in (author-role and manager-role submitters alike see the footer "Cancel"), and any Author assigned to it<br>• Anyone who neither created the draft nor manages the journal — refused <sup>g</sup> |
| **Submit** | • Journal Managers, Section Editors and Authors with access to the submission — via the Review step's "Submit" button; Assistants can never submit<br>• A Site Administrator with no role in the journal reaches the Review step, but their "Submit" is refused without any message ⚠ (Known deviations) <sup>h</sup> |
| **View the "Submission complete" page** | • Anyone who can open the submission's wizard address after it was submitted — the wizard address thereafter shows the completion screen instead of the steps (rule 2's ⚠ covers the one exception) <sup>i</sup> |

<sup>a</sup> PKPSubmissionHandler::authorize() (UserRequiredPolicy when starting; SubmissionAccessPolicy otherwise); PKPSubmissionController::add() `disableSubmissions` guard; live-probed 2026-07-10 (P18: start page swaps form for the notice; create service refuses "not accepting"; a pre-toggle draft still edited and submitted) ·
<sup>b</sup> PKPSubmissionHandler::getSubmitUserGroups() (fallback filters `withRoleIds([ROLE_ID_AUTHOR])->permitSelfRegistration(true)`); PKPSubmissionHandler::start() notAllowed error page; PKPSubmissionController::add() (author-group fallback + auto-enrol); live-probed 2026-07-10 (P1: form vs "Not Allowed" flips instantly with the setting; viewing left the user with zero groups · P2: API created + auto-enrolled regardless of the setting) ·
<sup>c</sup> StartSubmission::addUserGroups() (field renders only with 2+ candidates; manager hint); PKPSubmissionHandler::getSubmitUserGroups() (site-admin branch limits to manager/site-admin groups with first-stage access); PKPSubmissionController::add() (explicit section-editor group → 400 "You are not allowed to submit in this user role."; none acceptable → auto-enrol Author); live-probed 2026-07-10 (P3: admin enrolled as Author saw no Submit As field where an identical non-admin saw [Journal editor, Author] · P4: pure Section Editor auto-enrolled as Author on begin, DB-verified) ·
<sup>d</sup> PKPSubmissionHandler::__construct() addRoleAssignment (Author, Sub-editor, Manager, Site Admin); SubmissionAccessPolicy; live-probed 2026-07-10 (P17: assigned Copyeditor and accepted Reviewer both got the start form, and both were redirected to authorizationDenied on their submissions' wizards; the submitter opened the same id fine); a Journal Manager opening another user's in-progress wizard live-confirmed 2026-07-10 (page rendered fully, steps editable); ⚠ pure Site Administrator: the page handler grants SITE_ADMIN but the saveForLater/edit/submit API routes' roleAuthorizer omits it and even GET /api/v1/submissions/{id} is refused — page 200, every write 401 roleBasedAccessDenied, DELETE 200; live-confirmed 2026-07-10 (ledger row 177) ·
<sup>e</sup> SubmissionHandler::getReconfigureForm(); SubmissionHandler::getSubmittingTo() (empty string hides the control); live-probed 2026-07-10 (P6) ·
<sup>f</sup> wizard template saveForLater buttons (`isDisconnected` disable); live-probed 2026-07-10 (P19: exactly two "Save for Later" buttons per step — page heading + footer; footer order first step "Cancel / Save for Later / Continue", final step "Back / Cancel / Save for Later / Submit"); PUT …/saveForLater roleAuthorizer omits SITE_ADMIN → 401 for a role-less admin while the page renders — live-confirmed 2026-07-10 (ledger row 177) ·
<sup>g</sup> PKPSubmissionHandler::showWizard() `canCancelSubmission`; Repository::canCurrentUserDelete(); PKPBackendSubmissionsController::bulkDeleteIncompleteSubmissions() (route gate Site Admin/Manager/Author); live-probed 2026-07-10 (P4: Section Editor–, Author– and Journal Manager–begun drafts all showed Cancel and deleted cleanly — the section editor via the auto-enrolled Author role; a section editor deleting someone else's draft → 401 roleBasedAccessDenied); the refusal's shape differs by role (live-probed 2026-07-10): an author-role user not on the draft gets 404 not-found (canCurrentUserDelete's ownership filter simply matches nothing), while roles outside the route gate get the 401 not-allowed error ·
<sup>h</sup> PKPSubmissionController::getGroupRoutes() submit route roles (Manager, Sub-editor, Author — SITE_ADMIN omitted: a role-less admin's submit → 401 while the page renders, live-confirmed 2026-07-10, ledger row 177); submit-as in a section-editor role is refused — see footnote c ·
<sup>i</sup> PKPSubmissionHandler::index() router; PKPSubmissionHandler::complete(); live-probed 2026-07-10 (P13)

## Fields & validation

**The start form** (page heading "Make a Submission", button "Begin Submission").
Every field below except Title appears only when the journal's configuration calls
for it:

| Field (UI label) | Required? | Rules |
|------------------|-----------|-------|
| **Before you begin** | — | Read-only introduction; shown only when the journal wrote one <sup>a</sup> |
| **Title** | Yes | One line of rich text; stored as the manuscript title in the chosen submission language once the record is created <sup>b</sup> |
| **Section** | Yes | Radio choice of the sections open to this submitter; picking a section reveals that section's policy text; hidden (auto-set) when only one section is open <sup>c</sup> |
| **Submission Language** | Yes | Radio choice; only when the journal accepts submissions in two or more languages <sup>d</sup> |
| **Submission Requirements** | Yes | The journal's checklist with one confirmation: "Yes, my submission meets all of these requirements."; only when a checklist is configured ⚠ checked in the browser only (rule 8) <sup>e</sup> |
| **Privacy Consent** | Yes | Consent checkbox linking the privacy statement — the journal's own or, when a server-level install option says so, one statement for the whole site (that option belongs to a system administrator; it is not on any journal settings page); only when a statement exists ⚠ checked in the browser only (rule 8) <sup>f</sup> |
| **Submit As** | Yes | Radio choice of the user's submitting roles; only when they have two or more (Site Administrators and Section Editors are special cases — see Actors) <sup>g</sup> |

<sup>a</sup> StartSubmission::addIntroduction() (`beginSubmissionHelp`) ·
<sup>b</sup> StartSubmission::addTitle(); StartSubmissionForm.vue success() (saves title to the first version after create) ·
<sup>c</sup> APP\components\forms\submission\StartSubmission::__construct() (`sectionId`; hidden field when one section — live-probed 2026-07-10, P6; per-section policy `showWhen` — reveal live-probed 2026-07-10: checking a section's radio shows the section name + its policy paragraph below the radios) ·
<sup>d</sup> StartSubmission::addLanguage() ·
<sup>e</sup> StartSubmission::addSubmissionChecklist() (`submissionRequirements` — not a stored submission property) ·
<sup>f</sup> StartSubmission::addPrivacyConsent() (`privacyConsent` — not a stored submission property; site-wide switch `sitewide_privacy_statement`) ·
<sup>g</sup> StartSubmission::addUserGroups() (`userGroupId`)

**Inside the wizard**, each step's fields (this spec's steps only — the For the
Editors metadata fields are specified in *submission-wizard-metadata*):

| Field (UI label) | Required? | Rules |
|------------------|-----------|-------|
| **Upload Files** ("What kind of file is this?") | Per journal | Drag-and-drop upload; every file must be labelled with one of the journal's file kinds (article text, data set, …); kinds meant only as attachments to other files are not offered here; file kinds the journal marks as required must be present before submitting (rule 7) <sup>h</sup> |
| **Title** (Details step) | Yes | Same title, editable in every accepted language; must be filled in the submission language to submit <sup>i</sup> |
| **Keywords** (Details step) | Per journal | Type-ahead multi-entry; appears when the journal requests or requires keywords; required only in the "require" mode <sup>j</sup> |
| **Abstract** (Details step) | Per section | Rich text per language; required unless the chosen section waives abstracts; the section's word limit is enforced, with the count shown while typing <sup>k</sup> |
| **Plain Language Summary** (Details step) | Per journal | Rich text per language; appears when the journal requests or requires it; shares the section's abstract word limit <sup>l</sup> |
| **Comments for the Editor** (For the Editors step) | No | Free rich text "cover note" to the editorial team; after submission the field disappears from the wizard, and what was written reappears as a discussion with the editorial team (rule 9; the discussion itself belongs to *tasks-discussions*) <sup>m</sup> |
| **Copyright agreement** (Review step, "Confirmation" section — "Please confirm the following before you submit.") | Yes (UI) | "Yes, I agree to the copyright statement." beneath the journal's copyright notice; appears only when a notice is configured; the "Submit" button stays disabled until every remaining problem is fixed *and* this box — the only checkbox the Confirmation section ever holds — is ticked; unticking disables it again ⚠ browser-side gate only (rule 8) <sup>n</sup> |

<sup>h</sup> PKPSubmissionHandler::getSubmissionFilesListPanel() (genre list, dependent genres removed); Repository::validateSubmit() required-genre check ·
<sup>i</sup> Details (extends TitleAbstractForm; prefix/subtitle removed in the wizard); Repository::validateSubmit() title-in-locale ·
<sup>j</sup> Details::__construct() keywords field (`request`/`require` modes) ·
<sup>k</sup> SubmissionHandler::getDetailsForm() (word count + required flag from the section); APP\submission\Repository::validateSubmit() abstract checks ·
<sup>l</sup> TitleAbstractForm::addPlainLanguageSummary(); APP\submission\Repository::validateSubmit() summary word-count check ·
<sup>m</sup> CommentsForTheEditors; PKP\submission\Repository::validate() (rejected once submitted) ·
<sup>n</sup> ConfirmSubmission::__construct(); SubmissionWizardPage.vue isConfirmed()/canSubmit(); live-probed 2026-07-10 (P5: full truth table — enabled only with zero errors AND box ticked, reversible; checkbox `confirmCopyright` · P8: never enforced server-side)

Contributors are edited on their own step; their fields and rules belong to the
contributors feature — the wizard only enforces at submit time that every
contributor's name is filled in the submission language (rule 7). Affiliations count
too, but only hand-typed ones: an affiliation picked from the built-in registry of
research organisations is shown with a link to its registry record beside the name
and needs nothing more, while one typed in by hand is plain text whose name must
likewise be filled in the submission language.

## Rules & state

**Lifecycle**
1. A submission is **in progress** from the moment "Begin Submission" is pressed
   until it is submitted: the record (with its first version) is created immediately,
   the submitter is assigned to it in the chosen role, and — when submitting in an
   Author role — an author entry is created from their user profile and given the
   contributor list's "Primary Contact" marker. Nothing appears different on the
   editorial side except that dashboards list the submission with an "Incomplete"
   marker ⚠ (though the record already carries a submission date from the moment
   it is begun — Known deviations). <sup>a</sup>
2. **Progress is a step marker, not a percentage**: the submission remembers the
   step where work was last *saved* — a "Save for Later" or an autosave that had
   something to store — and the wizard reopens on that step; merely walking
   between steps with nothing new to save leaves the marker where it was (the
   address bar tracks steps too, so the browser Back button walks the wizard).
   Submitting clears the marker, the wizard address then shows the "Submission
   complete" screen, and trying to submit again is refused with a pointer to the
   dashboard. ⚠ But the marker is not cleared for good: a save-for-later request
   replayed against an already-submitted submission — this cannot be reached
   from any screen and is not manually testable — succeeds for a Journal
   Manager, Section Editor or Author with access to the submission, rewrites
   the marker, and makes the wizard render again with the submitted date still
   on the record, a hybrid state; and because the refusal of a second submit
   keys on the very marker just rewritten, re-submitting then passes every role
   and state gate, leaving only the ordinary completeness checks in its way
   (Known deviations; the intended lock is an Open question). ⚠ Saving on the
   Reviewer Suggestions step records a step name the system's own rulebook
   doesn't include; nothing visibly breaks today (Known deviations). <sup>b</sup>
3. The one wizard address routes by state: no submission yet → the start form; in
   progress → the steps; submitted → "Submission complete". Links in the older,
   pre-3.4 address format — still found in old emails and bookmarks — forward to
   the current address (both address forms are in the reference table). The
   completion screen offers three next steps: "Review this submission" — for an
   author it opens their submission's tracking view under My Submissions; for a
   manager-role submitter, the editorial workflow — plus "Create a new submission"
   and "Return to your dashboard". The address is also journal-bound: a draft
   opened through a *different* journal's submission address is treated as
   nonexistent — the same bare, unthemed Not Found line as an unknown id, even for
   the draft's own submitter — unlike someone else's draft in the *same* journal,
   which turns the visitor away with the not-allowed page. ⚠ Its closing text
   tells every submitter a confirmation was emailed to them for their records,
   which is untrue whenever no acknowledgement goes out (Known
   deviations). <sup>c</sup>
4. **Steps, in order**: Upload Files → Details → Contributors → For the Editors →
   Reviewer Suggestions (only when the journal enables author suggestions) → Review.
   Each step's name appears in the step rail and in the page heading ("Make a
   Submission: {step}"); the last step is named "Review" in both places, while its
   own content opens under a "Review and Submit" heading — two labels, one step.
   The Details step additionally shows a References box when the journal asks
   authors for references, and a Data Citations panel when data citations are
   requested or required; the For the Editors step stacks the metadata form (if any
   fields are on), the Data Availability statement (if requested/required) and the
   Comments for the Editor box. Each step shows the journal's own help text for that
   step when one is configured. Every step's footer offers "Cancel" and "Save for
   Later" beside the navigation buttons — "Continue" (with "Back" after the first
   step), and "Submit" in place of "Continue" on the final step. <sup>d</sup>

**Saving**
5. **Autosave**: form entries are saved automatically as the author moves between
   steps, and a "Last saved X ago" note sits in the footer. If the connection drops,
   the footer switches to a reconnecting notice, Save for Later and Submit are
   disabled, and entries pile up in the browser's local storage; when the author
   returns, a dialog offers to restore or discard the unsaved changes. If the server
   rejects an autosave because the login expired, the author is asked to sign in
   again. <sup>e</sup>
6. **Save for Later** stores the current step, sends the author a resume link by
   email, and lands on a "Saved for Later" page showing the submission's link and
   "We have emailed a copy of this link to you at {email}". (The email, the
   incomplete-submissions listing and resuming from it belong to
   *submission-drafts*.) The saved page is only reachable for a specific
   submission the visitor may access — with no submission (or an unknown one) it is
   Not Found ⚠ shown as a bare error line, not a journal-styled page (Known
   deviations). ⚠ And the saved page never notices that the submission has since
   been *submitted*: opened then, it still renders its full not-yet-submitted
   copy — "…it has not yet been submitted for consideration…" and "We have
   emailed a copy of this link to you" (viewing sends nothing) — stale on every
   sentence; only its link lands on "Submission complete" (Known
   deviations). <sup>f</sup>

**Validation & submit**
7. Opening the Review step runs the full completeness check (a "Checking your
   submission" note shows while it runs); problems appear as a warning — "There are
   one or more problems that need to be fixed before you can submit. Please review
   the information below and make the requested changes." — with each offending
   panel showing its own error next to that panel's Edit link (for example the Files
   panel: "You must upload at least one Article Text file."); clean panels show
   none ⚠ (the Details panel's abstract error appears above the field labels,
   unlabeled — Known deviations). The same check re-runs server-side on Submit. It
   requires, in the submission language: the title, the abstract (unless the
   section waives it), every contributor's name (for an organisation listed as a
   contributor, its organisation name; for a hand-typed affiliation — one not
   picked from the organisation registry — the affiliation name) — though
   a submission with no contributors at all passes ⚠ (Known deviations) — plus:
   section word limits on abstract and plain language summary, any metadata the
   journal marked "required" during submission, a plain language summary when
   required, and at least one file of every required file kind. A closed section
   (deactivated, or restricted to editors while the submitter is not one) blocks
   submission with the "Section Closed" message (rule 11). <sup>g</sup>
8. **The three consents are browser-side gates** ⚠: the Submission Requirements
   checklist and Privacy Consent must be ticked before "Begin Submission" activates,
   and the copyright agreement before "Submit" activates — but none of the three is
   re-checked by the server, so a request that skips the wizard can start and submit
   without them, while everything else in the completeness check is still enforced
   (Known deviations). When the copyright box *is* ticked, the agreement (with the
   notice's wording) is recorded in the submission's activity log. <sup>h</sup>
9. **Submitting** asks for confirmation — "The submission, {title}, will be
   submitted to {journal} for editorial review…" — then: stamps the submission date,
   clears the progress marker, converts any Comments for the Editor into a
   discussion with the editorial team, writes a "submission submitted" entry in the
   activity log, creates the editorial tasks the journal's task templates add
   automatically for the first stage — new items in the submission's "Tasks &
   Discussions" panel (Side effects) — triggers the editor-alert and
   acknowledgement fan-out (Side effects),
   and — for the authors — resets their permission to edit the submission's
   metadata to whatever their role's configuration says (during the wizard they can
   always edit it). <sup>i</sup>

**Mid-flight changes**
10. A note under the page heading reflects the start-form choices, and appears only
    for the dimensions where the journal offers a choice: with several open sections
    it reads "Submitting to the {section} section."; with several submission
    languages, "Submitting in {language}."; when both dimensions offer a choice the
    two combine into one sentence, "Submitting to the {section} section in
    {language}." The note ends with the "Change" link, which
    opens **Change Submission Settings** — offering only the dimension(s) that have
    more than one option. Saving reloads the wizard: abstract requirement and word
    limit follow the new section, and the new language becomes the one all required
    entries must be written in. In a one-section, one-language journal neither the
    note nor "Change" appears at all. <sup>j</sup>
11. If the chosen section closes while the submission is still in progress
    (deactivated, or restricted to editors while the submitter is not one), the
    wizard refuses to open: a "Section Closed" page explains the journal "is not
    accepting submissions to the {section} section" and asks the author to contact
    the journal's contact (named with their email address) to recover the
    submission — the wizard offers no way to move the stranded draft to another
    section, and submitting is refused with the same message. <sup>k</sup>
12. **Cancelling** (footer "Cancel", shown per the permissions table) warns —
    "Are you sure you wish to cancel this submission? This will delete the
    submission and all associated data. This action cannot be undone." — then
    deletes the submission entirely and lands on "Submission cancelled":
    "Submission has been cancelled, and all associated data has been deleted.",
    with "Create a new submission" and "Return to your dashboard" links. The
    cancelled landing page itself is a plain notice any logged-in visitor can
    open directly, even with no submissions at all. A deleted draft then behaves
    exactly like one that never existed: its old wizard, saved and cancelled
    addresses all answer with the same bare, unthemed Not Found line as an
    unknown id. <sup>l</sup>

<sup>a</sup> PKPSubmissionController::add(); PKP\submission\Repository::add() (status queued — the record carries the "queued for review" editorial status for the whole in-progress period, an internal value with no on-screen surface; locale default); Repo::stageAssignment()->build() (metadata edit forced on while in progress); Repo::author()->newAuthorFromUser() + `primaryContactId`; dateSubmitted-at-creation live-probed 2026-07-10 (agents A + C) ·
<sup>b</sup> submission schema `submissionProgress` (default `start`, cleared on submit, write-protected in the API; allowed values miss `reviewerSuggestions`); SubmissionWizardPage.vue created()/openUrlHash(); Repository::validateSubmit() already-submitted guard — its refusal arrives mixed with ordinary completeness errors in the one validation response (live-probed 2026-07-10); marker moves only on a save: live-probed 2026-07-10 (Continue from Files to Details with nothing to save left the marker at the start; reopening landed on Files); live-probed 2026-07-10 (P9: save on Reviewer Suggestions → progress `reviewerSuggestions`; resume reopened at that step, H1 "Make a Submission: Reviewer Suggestions"; later Details autosaves all clean — no schema 400 on this path); ⚠ PKPSubmissionController::saveForLater() applies SubmissionAccessPolicy only (SubmissionIncompletePolicy exists but is unused here): PUT …/saveForLater on a submitted submission → 200, progress rewritten (dateSubmitted retained), wizard renders again, re-submit blocked only by field validation — code-derived + live-confirmed 2026-07-10 (ledger row 176) ·
<sup>c</sup> PKPSubmissionHandler::index(); PKPSubmissionHandler::wizard() (deprecated redirect); PKPSubmissionHandler::complete(); PKPSubmissionHandler::getWorkflowUrl() (author vs editorial destination); live-probed 2026-07-10 (P10: old wizard URL 302 → current address, with and without an id · P13: author → dashboard/mySubmissions tracking view; manager-role submitter → dashboard/editorial; both headed "Submission complete" with "Review this submission"); cross-journal id live-probed 2026-07-10 (own draft via another journal's `submission?id=` → bare unthemed 404, identical to an unknown id; same-journal foreign draft → authorizationDenied redirect, P17) ·
<sup>d</sup> PKPSubmissionHandler::getSteps(), getDetailsStep() (citations/data-citations sections), getEditorsStep(); `reviewerSuggestionEnabled`; footer order live-probed 2026-07-10 (P19) ·
<sup>e</sup> autosave mixin (500ms queue, local-storage recovery); SubmissionWizardPage.vue autosaveErrored(), addAutosaves(); wizard template footer status line; flush on step change / save-for-later observed 2026-07-10 (P9) ·
<sup>f</sup> SubmissionWizardPage.vue saveForLater(); PKPSubmissionController::saveForLater() (step recorded, mail sent); PKPSubmissionHandler::saved() (checks access but not submitted state; static template copy); live-probed 2026-07-10 (P11: no id and unknown id both → bare 23-byte "404 Not Found" body, unthemed; the themed not-yet-submitted page rendered in full for a submitted submission — ledger row 178) ·
<sup>g</sup> SubmissionWizardPage.vue validate() (validate-only submit call on entering Review); PKP\submission\Repository::validateSubmit(); APP\submission\Repository::validateSubmit() (abstract + word limits); PKPSubmissionController::submit() section-closed re-check; live-probed 2026-07-10 (P7: banner + per-panel errors, all cleared after fixing; the only global list is screen-reader-only · P16: empty contributor list submitted fine) ·
<sup>h</sup> Form-level `isRequired` only — `submissionRequirements`/`privacyConsent` absent from the submission schema; PKPSubmissionController::submit() `confirmCopyright` optional, logs SUBMISSION_LOG_COPYRIGHT_AGREED; live-probed 2026-07-10 (P8: create with no consents 200; submit without confirmCopyright 200; with it, the copyright-agreed log row is the only difference) ·
<sup>i</sup> SubmissionWizardPage.vue submit() confirm dialog; PKP\submission\Repository::submit() (date, progress, cover-note discussion, stage-one task templates); LogSubmissionSubmitted; UpdateAuthorStageAssignments / RestrictAuthorAssignment (metadata permission reset) ·
<sup>j</sup> SubmissionHandler::getSubmittingTo(); ReconfigureSubmission (PKP locale field + OJS section field); SubmissionWizardPage.vue reconfigureSubmission() (saves then reloads); live-probed 2026-07-10 (P6: 2 sections × 1 language → "Submitting to the Articles section. Change", modal has Section radios only; 1 × 2 languages → "Submitting in English. Change", modal has Submission Language radios only; 1 × 1 → no note, no control, hidden section field); combined 2 × 2 form live-verified 2026-07-10 by the feature test run ("Submitting to the Essays section in French (Canada).", one sentence) ·
<sup>k</sup> PKPSubmissionHandler::showWizard() section-closed guard (error-page render); PKPSubmissionController::submit() same guard; live-probed 2026-07-10 (P15: deactivated and editor-restricted both → "Section Closed" page naming the journal contact email; submit refused with the same message keyed on the section) ·
<sup>l</sup> SubmissionWizardPage.vue cancelSubmission(); PKPBackendSubmissionsController::bulkDeleteIncompleteSubmissions(); PKPSubmissionHandler::cancelled() (only UserRequiredPolicy when no id); live-probed 2026-07-10 (P4: dialog "Cancel submission" + deletion for author-, manager- and section-editor-begun drafts · P12: cancelled page rendered for a visitor with zero submissions); deleted-id probe live 2026-07-10 (a deleted draft's wizard, saved and cancelled addresses → the same bare unthemed 404 body as an unknown id)

## Side effects

All of these fire at the moment of submission (none fire while the wizard is in
progress):

- **Acknowledgement emails to authors**: per the journal's acknowledgement setting,
  a "Thank you for your submission" email goes to every user holding an Author
  assignment on the submission (normally the submitter), and — in "all authors" mode
  — a separate variant goes to each contributor listed on the manuscript who has no
  user account on the journal (account holders already receive the main email
  above). The journal can BCC its primary contact
  and/or a fixed copy address. With the setting off, no author email is sent. ⚠ A
  manager-role submitter holds no Author assignment, so no acknowledgement is
  addressed to anyone — while the completion screen still claims a confirmation was
  emailed (Known deviations). <sup>a</sup>
- **Editor auto-assignment — inoperative as built** ⚠: everyone configured as an
  assigned editor for the chosen section (and any chosen categories) is *meant* to
  be assigned to the submission, with an in-app *submission submitted* notice and an
  "editor assigned" email. As built, the matching step silently discards every
  candidate, so no editor is auto-assigned and neither alert goes out — submissions
  fall through to the needs-an-editor fallback below (Known deviations; the intended
  behavior is recorded there and in Open questions, not asserted here). Even if an
  in-app *submission submitted* notice were created, it would have nowhere to appear:
  the header bell lists only task-level notices, and this build has no page listing
  the rest ⚠ (Known deviations). <sup>b</sup>
- **Needs-an-editor fallback**: when nobody was auto-assigned — as built, every
  time — every Journal Manager gets a task-level *editor assignment required* notice
  in the header Tasks bell plus an email that "A new submission needs an editor to
  be assigned". Each manager's own opt-outs apply per channel — set on their own
  profile's Notifications tab, where every notification type has an in-app and an
  email checkbox, grouped under "Submission Events": unticking the in-app one
  stops the bell task while the email still arrives under its separate
  checkbox. <sup>c</sup>
- **Cover-note discussion**: a non-empty Comments for the Editor becomes a
  discussion on the submission stage (owned by *tasks-discussions* — including the
  known quirk that the opening message is stored as a reply, leaving the discussion
  with no editable head message). <sup>d</sup>
- **Activity log**: a "submission submitted" entry always; a "copyright agreed"
  entry when the copyright box was ticked (it stores the notice's wording). <sup>e</sup>
- **Auto-created editorial tasks**: the tasks the journal's task templates add
  automatically for the first stage appear in the submission's "Tasks &
  Discussions" panel (templates are configured under Workflow → Tasks and
  Discussions Templates; owned by *tasks-discussions*). <sup>f</sup>
- **Author editing rights**: the authors' ability to keep editing the submission's
  metadata after submission is reset to their role's "permit metadata edit"
  configuration. <sup>g</sup>

<sup>a</sup> SendSubmissionAcknowledgement::handle() (`submissionAcknowledgement` gate; recipients = author-assigned users; other-authors variant; BCC via `copySubmissionAckPrimaryContact` / `copySubmissionAckAddress`); SubmissionAcknowledgement (SUBMISSION_ACK); SubmissionAcknowledgementOtherAuthors (SUBMISSION_ACK_NOT_USER); live-probed 2026-07-10 (P16, allAuthors mode: author submitter → acknowledgement in the mailbox; manager submitter with zero author assignments → none to anyone) ·
<sup>b</sup> AssignEditors::handle(); SubEditorsDAO::assignEditors() — ⚠ filters candidates with `$userGroups->keys()` (collection indexes 0..n, not group ids) since the Eloquent refactor (commit 714d5d5aa4, pkp/pkp-lib#10506), silently dropping every candidate wherever group ids ≠ indexes; NOTIFICATION_TYPE_SUBMISSION_SUBMITTED is NORMAL-level with no surface (bell is TASK-filtered; the notification-listing page 404s in this build); live-probed 2026-07-10 (P14: section's sub-editor got no assignment and no notification; a DB-inserted NORMAL-level row surfaced nowhere) ·
<sup>c</sup> AssignEditors::handle() manager fallback (NOTIFICATION_TYPE_EDITOR_ASSIGNMENT_REQUIRED at task level; SubmissionNeedsEditor mailable); live-probed 2026-07-10 (P14: blocking the in-app type suppressed that manager's bell task; the email still arrived under its untouched preference) ·
<sup>d</sup> PKP\submission\Repository::submit(); Repo::editorialTask()->addCommentsForEditorsQuery() ·
<sup>e</sup> LogSubmissionSubmitted::handle() (SUBMISSION_LOG_SUBMISSION_SUBMIT); PKPSubmissionController::submit() (SUBMISSION_LOG_COPYRIGHT_AGREED with `copyrightNotice`) ·
<sup>f</sup> PKP\submission\Repository::submit() → autoCreateFromTemplates ·
<sup>g</sup> UpdateAuthorStageAssignments::handle(); RestrictAuthorAssignment::handle() (both registered — see Open questions #4)

## Settings that modify behavior

- **Workflow → Submission → Disable Submissions**: *disable submissions* replaces
  the start page with a not-accepting notice ⚠ (worded for Journal Managers even
  when an author reads it — Known deviations) and refuses new submissions outright,
  while drafts begun before the switch stay fully editable and
  submittable. <sup>a</sup>
- **Workflow → Submission → Author Guidance**: the *Submission Checklist* text
  creates the start form's Submission Requirements confirmation; *Before you begin*
  and the per-step help texts feed the wizard's guidance blocks; the *Copyright
  Notice* creates the Review step's Confirmation section. <sup>a</sup>
- **Workflow → Submission → Metadata**: *keywords / references / data citations /
  plain language summary / data availability* in request-or-require mode add their
  fields or panels (require = must be filled to submit); *submit with categories*
  adds category choice to the For the Editors step (owned by the metadata spec);
  other "For the Editors" metadata toggles are owned by
  *submission-wizard-metadata*. <sup>a</sup>
- **Website → Setup → Privacy Statement**: the journal's *privacy statement*
  creates the start form's Privacy Consent box. A server-level install option can
  substitute one site-wide statement for every journal's own — that variant is a
  system administrator's job, not on any journal settings page. <sup>b</sup>
- **Users & Roles → Roles**: *Allow user self-registration* on an Author role is
  what lets role-less users submit (self-registration on a Reviewer or Reader role
  does not); a role's *Stages* checkboxes are what make it a submitting role
  (Actors). <sup>b</sup>
- **Workflow → Review → Setup**: *Reviewer Suggestion at Submission* adds the
  Reviewer Suggestions step. <sup>b</sup>
- **Journal → Sections** (the sections manager): a section's *inactive* flag or
  *items only by editor* restriction removes it from the start form and closes
  in-flight submissions to it (rules 7, 11); *abstracts not required* waives the
  abstract; *word count* caps the abstract and the plain language summary; a
  section's *assigned editors* are meant to drive auto-assignment ⚠ (inoperative
  as built — Known deviations). <sup>c</sup>
- **Workflow → Submission → Components** (the file kinds list): the journal's list
  of file kinds is what authors pick from when uploading; kinds marked *required to
  submit* block submission when missing; *supplementary* kinds are offered under
  "Other"; *dependent* kinds are excluded from the wizard. <sup>d</sup>
- **Workflow → Emails**: the *Submission Confirmation* setting (do not send / the
  submitting author only / all authors) selects the acknowledgement audience; the
  two copy-address settings beneath it add BCCs; the acknowledgement templates are
  editable in the same place. Recipients' own notification opt-outs gate the
  editor-side notices (Side effects). <sup>e</sup>
- **Website → Setup → Languages**: each language's *Submissions* tick decides the
  journal's submission languages — they drive the Submission Language choice, the
  reconfigure form, and which languages the multilingual fields offer. <sup>f</sup>
- No server configuration variables alter these rules beyond the site-wide privacy
  statement option above.

<sup>a</sup> context settings `disableSubmissions` (PKPDisableSubmissionsForm), `submissionChecklist`, `beginSubmissionHelp`, per-step `*Help`, `copyrightNotice` (SubmissionGuidanceSettings), `keywords`, `citations`, `dataCitations`, `plainLanguageSummary`, `dataAvailability`, `submitWithCategories` (PKPMetadataSettingsForm); tab labels from templates/management/workflow.tpl; live-probed 2026-07-10 (P18: pre-toggle draft edited and submitted while the journal was closed) ·
<sup>b</sup> `privacyStatement` (PKPPrivacyForm; + `sitewide_privacy_statement` in config.inc.php), user-group `permitSelfRegistration` + stage assignments (userGroupForm.tpl), `reviewerSuggestionEnabled` (PKPReviewSetupForm); live-probed 2026-07-10 (P1) ·
<sup>c</sup> Section flags `isInactive`, `editorRestricted`, `abstractsNotRequired`, `wordCount`; SubEditorsDAO ·
<sup>d</sup> GenreDAO::getEnabledByContextId(), getRequiredToSubmit(); genre flags `required`, `supplementary`, `dependent` ·
<sup>e</sup> `submissionAcknowledgement`, `copySubmissionAckPrimaryContact`, `copySubmissionAckAddress`; Mail\Repository::isMailableEnabled() ·
<sup>f</sup> Context::getSupportedSubmissionLocales()

## Cross-feature interactions

- **submission-wizard-metadata** — owns the For the Editors metadata form (keywords
  are the exception: they sit on the Details step and are specified here), the
  request-vs-require settings semantics, and the category picker.
- **reviewer-suggestions** — owns the Reviewer Suggestions step's content and rules;
  this spec only places the step in the sequence.
- **submission-drafts** — owns the incomplete-submissions list, resuming, the
  saved-for-later email, and the deletion endpoint the wizard's Cancel button calls;
  this spec owns the wizard's Save for Later / Cancel affordances and the saved /
  cancelled pages.
- **contributors** — owns the Contributors step's add/edit rules; this spec owns
  the submit-time name-in-language checks.
- **submission-files** — owns file storage, genre administration and the workflow
  file managers (including the legacy file-upload wizard those managers use); this
  spec owns the wizard's upload step behaviour and required-kind enforcement.
- **tasks-discussions** — owns the cover-note discussion and stage-entry task
  templates that submission triggers.
- **author-dashboard / editorial-dashboards** — own where in-progress and submitted
  submissions are listed afterwards, and the "incomplete" badge semantics.
- **publication-title-abstract-body** — owns the editor-side Title & Abstract form
  the wizard's Details form is derived from.

## Canonical scenarios

1. **Author submits end-to-end** — an author: from the journal's "Make a Submission"
   page, fills Title, picks a section (its policy text appears), ticks "Yes, my
   submission meets all of these requirements." and the privacy consent, and presses
   "Begin Submission". They walk the steps: upload an article-text file (answering
   "What kind of file is this?"), fill Details, confirm themselves under
   Contributors, write a Comment for the Editor, and on the final "Review" step
   (headed "Make a Submission: Review", its content under "Review and Submit") see
   all panels filled. Pressing "Submit" opens "The submission … will be submitted to …"
   — confirming lands on "Submission complete", and the author has a thank-you email
   in their inbox. On the editorial side the submission now shows as submitted, with
   the cover note as a discussion. <sup>s1</sup>
2. **User without an author role** — a logged-in user with no roles in the journal
   opens "Make a Submission": with "Allow user self-registration" ticked on the
   journal's Author role (its role form under Users & Roles → Roles) they see the
   start form and, after "Begin Submission", are enrolled as an Author
   automatically; with that option off the page instead reads "Not
   Allowed" — "You are not allowed to submit to this journal because authors must
   be registered by the editorial staff." <sup>s2</sup>
3. **Completeness check on Review** — an author skips the abstract and uploads no
   file of a kind the journal marks required to submit (its file kinds list,
   Workflow → Submission → Components), then opens the "Review" step: the warning
   "There are one or more problems that need to be fixed before you can submit"
   appears, the Details panel shows the missing-abstract error ("This field is
   required.") and the Files panel names the missing kind ("You must upload at
   least one Article Text file."); "Submit" stays unavailable. After fixing both
   via the panels' Edit links, the warning disappears and Submit activates.
4. **Save for later and the saved page** — an author on the Contributors step
   presses "Save for Later": they land on "Saved for Later" with a link to the
   submission and "We have emailed a copy of this link to you at {their email}".
   Following the link reopens the wizard on the step where they left off.
5. **Cancel a submission** — an author in the wizard presses the footer "Cancel"
   link: a "Cancel submission" warning asks "Are you sure you wish to cancel this
   submission? This will delete the submission and all associated data. This action
   cannot be undone." Confirming lands on "Submission cancelled"; the draft is gone
   from My Submissions, and its old wizard link no longer works.
6. **Change section and language mid-flight** — in a journal with two open sections
   (Journal → Sections) and two submission languages (ticked under Website → Setup
   → Languages), an author who began in section A / English uses
   the "Change" link on the "Submitting…" note under the page heading: the "Change
   Submission Settings" window offers Section and Submission Language. Switching to
   section B (which requires no abstracts) and French reloads the wizard: the note
   updates, the abstract stops being required, and the required entries must now be
   in French.
7. **Section closes under a draft** — a Journal Manager deactivates the section an
   author's draft was started in (the sections manager, Journal → Sections); the
   author reopening their wizard link gets
   "Section Closed" — the journal "is not accepting submissions to the {section}
   section", with the journal contact's email to ask for help — and cannot reach
   the steps or submit. <sup>s7</sup>
8. **A Journal Manager submits on someone's behalf** — a Journal Manager who also
   holds an Author role starts a submission: the "Submit As" choice lists both
   roles with the hint about editorial roles. Submitting as Journal Manager, they
   complete the wizard; the footer shows Cancel (managers always may); after
   "Submit", "Review this submission" opens the editorial workflow (not the
   author's tracking view), and no acknowledgement email is sent to anyone — even
   though the completion screen says one was ⚠. <sup>s8</sup>
9. **Copyright agreement** — in a journal with a copyright notice (Workflow →
   Submission → Author Guidance), the Review step
   ends with a "Confirmation" section quoting the notice; "Submit" stays disabled
   until "Yes, I agree to the copyright statement." is ticked, and disables again
   if it is unticked. After submitting, the submission's Activity Log — opened
   with the "Activity Log" button on the submission's workflow page — lists the
   copyright-agreed entry alongside the submitted entry ("Article submitted").
10. **Acknowledgement audience settings** — with the acknowledgement setting on
    "all authors", an author submits a manuscript naming a co-author who has no
    account: the submitter gets the thank-you email and the co-author gets the
    separate named-on-a-submission variant; the journal's copy address receives a
    blind copy (to check this the tester must control that mailbox — the copy is
    invisible to its named recipients). With the setting off, the same flow sends
    neither. <sup>s10</sup>
11. **The editorial team learns of a submission** — an author submits in a journal
    whose section has an assigned Section Editor (set on the section, Journal →
    Sections): ⚠ as built, that Section Editor
    is *not* assigned and hears nothing (Known deviations); instead every Journal
    Manager finds an editor-assignment task in the header Tasks bell and receives
    the "A new submission needs an editor to be assigned" email — exactly as they
    would for a section with nobody assigned. A manager who beforehand unticked
    that notification type's in-app checkbox — on their own profile's
    Notifications tab, under "Submission Events" — sees no bell task but still
    gets the email. <sup>s11</sup>
12. **Submitted means submitted** — after submitting, the author reopens the wizard
    address: the steps are gone, replaced by "Submission complete" with its three
    next-step links. With the steps gone there is no Submit button either, so a
    repeat submit cannot be attempted from any screen; that a replayed submit
    request is refused with a message pointing to the submissions dashboard holds
    all the same, but is covered by automated checks only.

<sup>s1</sup> The section-policy reveal is live-probed 2026-07-10: checking a section's radio shows the section name and its policy paragraph below the radios ·
<sup>s2</sup> Seed: disable/enable `permitSelfRegistration` on the journal's Author group; use a user with no journal roles; live-probed 2026-07-10 (P1) ·
<sup>s7</sup> Seed: start a draft, then set the section inactive in Settings → Journal → Sections; live-probed 2026-07-10 (P15, both inactive and editor-restricted variants) ·
<sup>s8</sup> Requires a manager account also enrolled as Author; live-probed 2026-07-10 (P13: editorial destination · P16: no acknowledgement, allAuthors mode) ·
<sup>s10</sup> Setting: Workflow → Emails → submission acknowledgement (`submissionAcknowledgement`); copy addresses in the same panel ·
<sup>s11</sup> live-probed 2026-07-10 (P14) — the section-editor auto-assignment leg is broken (SubEditorsDAO::assignEditors() keys() bug); the manager fallback plus per-channel blocking is the reliably testable behavior

## Known deviations (as-built ≠ intent)

- ⚠ **The three consents are client-side only** (rule 8; P8, live-probed
  2026-07-10): the start form's `submissionRequirements` and `privacyConsent` are
  not submission properties — POST /submissions ignores them — and PUT …/submit
  accepts a submit without `confirmCopyright` even when a copyright notice is
  configured; the flag's only server effect is the SUBMISSION_LOG_COPYRIGHT_AGREED
  event-log entry (PKPSubmissionController::submit()). Metadata validation still
  applies on submit (a title-less draft 400s) — the consents are the only
  unenforced part. Suspected intent: the server should refuse to create/submit
  without the configured consents. Ledger row 165.
- ⚠ **Page and API disagree about who may start a submission** (P1/P2, live-probed
  2026-07-10): the start page requires a submitting group or a self-registering
  Author group (PKPSubmissionHandler::getSubmitUserGroups()), while
  PKPSubmissionController::add() succeeds *regardless of self-registration*,
  auto-enrolling the user into the `first()` of ALL author-role groups — no
  self-registration filter and no deterministic ordering (one probe run enrolled
  the user as "Translator"); the create route also lacks the roleAuthorizer
  middleware its sibling routes have; add() further skips the submission-stage
  filter on manager groups (commented out pending pkp/pkp-lib#10929), accepting
  submit-as groups the start form would never offer. Backend more permissive than
  UI. Ledger row 166.
- ⚠ **Beginning a submission silently converts a Section Editor into an Author**
  (P4, live-probed 2026-07-10): the create service accepts only manager- or
  author-role submit-as groups; an explicit section-editor group is refused
  ("You are not allowed to submit in this user role.", 400); with no acceptable
  group the user is auto-enrolled into the journal's first author-role group (the
  same nondeterministic fallback as above) and the draft proceeds as an author
  submission — nothing tells the user. The earlier draft's "a Section Editor cannot
  cancel a draft they started" rule was **wrong**: all realizable submitters
  (author-role, manager-role, and auto-enrolled section editors) see Cancel and can
  delete their own draft; the only real denial is a user who didn't create the
  draft and isn't a Journal Manager / Site Administrator — and its shape differs
  by role (live-probed 2026-07-10): an unassigned author-role user gets 404
  not-found (the ownership filter matches nothing), roles outside the route's
  gate get 401 not-allowed. Suspected intent: offer the enrolment explicitly, or
  refuse the start.
- ⚠ **Site Administrators get no "Submit As" at all — and the API attributes
  differently** (P3, live-probed 2026-07-10): the page's admin branch
  (PKPSubmissionHandler::getSubmitUserGroups()) restricts candidates to
  manager/site-admin groups with first-stage access and drops Author memberships;
  the control renders only with ≥2 candidates (StartSubmission::addUserGroups()),
  so under default groups an admin sees no "Submit As" field and the form defaults
  silently — their Author enrolment is unusable on the page. The API's add()
  computes submit-as groups *without* the admin special-case and sorts Author
  first, so the same admin's API-created submission may be attributed to their
  Author role — page and API disagree. Adjacent detail (code-derived): the two
  branches don't even overlap cleanly — PKPSubmissionController::add() accepts
  only manager- or author-role group ids as an explicit submit-as, while the
  page's admin branch offers manager/site-admin groups, so a site-admin group id
  posted to the create call is refused. Ledger row 173; see Open questions.
- ⚠ **Section-editor auto-assignment on submit is broken** (P14, live-probed
  2026-07-10 — the intended behavior is NOT reproducible in this build):
  SubEditorsDAO::assignEditors() filters candidate groups with
  `$userGroups->keys()` — collection indexes 0..n, not group ids — since the
  Eloquent refactor (commit 714d5d5aa4, pkp/pkp-lib#10506). Wherever real group ids
  don't coincide with the indexes, every candidate is silently dropped: no stage
  assignment, no *submission submitted* notification or "editor assigned" email,
  and managers get the needs-an-editor fallback for every submission. It works
  only "by accident" on installs whose group ids happen to be small. Likely a
  genuine upstream regression — ledger row 164 + upstream issue.
- ⚠ **The in-app "submission submitted" notice has no surface** (P14): it is
  created at NORMAL level, but the header bell shows TASK-level items only and
  this build has no notifications-listing page (`{journal}/notification` → 404) —
  even with auto-assignment fixed, the in-app notice would appear nowhere; only
  the email side is observable. Same family as the tasks-discussions ledger row 50
  (NORMAL-level notices invisible to the TASK-filtered bell).
- ⚠ **`submissionProgress` whitelist misses the reviewer-suggestions step**
  (rule 2; P9, live-probed 2026-07-10): schema allows
  `in:,start,details,files,contributors,editors,review`, but the wizard stores a
  `reviewerSuggestions` step id via save-for-later (which bypasses schema
  validation — direct edit + alphanumeric check only). Live probing found save,
  resume and subsequent Details autosaves all clean (publication writes don't
  re-validate the submission record), so the risk is latent: a future
  schema-validated write to such a submission would fail on an untouched property.
  Ledger row 174.
- ⚠ **A draft is stamped "submitted" at creation** (probe by-catch, agents A + C,
  live 2026-07-10): `date_submitted` is set the moment the record is created
  through the create service the wizard's Begin Submission uses (while
  `submission_progress` is still `start`), then re-stamped on actual submit;
  scenario-seeded drafts have it NULL until submit. Anything reading the date as
  "was submitted" (reports, exports, sorting) is misled for in-progress drafts.
  Ledger row 167.
- ⚠ **The completion screen claims an email that may not exist** (P13/P16,
  live-probed 2026-07-10): static copy on both completion destinations says
  "…you've been emailed a confirmation for your records" — false for a
  manager-role submitter, where no acknowledgement is addressed to anyone (Side
  effects). Ledger row 168.
- ⚠ **The "not accepting submissions" notice is worded for managers** (P18,
  live-probed 2026-07-10): the start page renders the manager-oriented string
  unconditionally (`manager.setup.disableSubmissions.notAccepting` in start.tpl) —
  an author reads "This journal is not accepting submissions at this time. Visit
  the workflow settings to allow submissions.", pointing at settings they cannot
  see. Ledger row 169.
- ⚠ **Nothing requires a contributor** (P16 by-catch, live-probed 2026-07-10): the
  submit-time checks validate each *listed* contributor, but a submission with an
  empty contributor list passes and submits (probed with a manager-role submitter,
  where no author entry is auto-created). Ledger row 170.
- ⚠ **The Review step's abstract error is unlabeled and misplaced** (P7,
  live-probed 2026-07-10): the Details panel renders "This field is required."
  above the field labels, where it visually reads as belonging to the panel's
  first field (e.g. Keywords); only the screen-reader-only "Go to Abstract" link
  names the field. Ledger row 171 (low, a11y/cosmetic).
- ⚠ **The saved page's Not Found is a bare server stub** (P11, live-probed
  2026-07-10): `submission/saved` without an accessible submission returns a
  plain unthemed "404 Not Found" body (23 bytes), identical for a missing and an
  unknown id, instead of the journal's error page. Cosmetic; no ledger row
  proposed. The same bare stub answers for a *deleted* draft's id on the wizard,
  saved and cancelled addresses (indistinguishable from never-existed), and for
  a real draft opened through a *different* journal's submission address — even
  its own submitter gets the 404 there, while a same-journal foreign draft gets
  the authorizationDenied redirect instead (rules 3 and 12; live-probed
  2026-07-10).
- ⚠ **The saved page renders its not-yet-submitted copy for submissions that
  HAVE been submitted** (rule 6; ledger row 178, live-probed 2026-07-10):
  `submission/saved?id=N` for a submitted submission renders the full themed
  page — "…it has not yet been submitted for consideration…" plus "We have
  emailed a copy of this link to you" (the view sends no email) — every sentence
  stale; the embedded wizard link at least lands on "Submission complete"
  (PKPSubmissionHandler::saved() checks access but not submitted state; static
  template copy). Suspected intent: route submitted ids to the completion
  screen, or swap the copy.
- ⚠ **Save-for-later reopens a SUBMITTED submission's wizard** (rule 2; ledger
  row 176, code-derived + live-confirmed 2026-07-10):
  PKPSubmissionController::saveForLater() applies SubmissionAccessPolicy only —
  SubmissionIncompletePolicy exists but is used solely by the
  reviewer-suggestions endpoints — so `PUT …/saveForLater {"step":…}` on a
  submitted submission returns 200, rewrites `submissionProgress` to the given
  step (`dateSubmitted` retained — hybrid state) and the wizard page renders
  again instead of "Submission complete"; a re-submit then passes every
  role/state gate (validateSubmit's already-submitted guard keys on the marker
  just rewritten) and only ordinary metadata validation happened to block it in
  the probe. Works for anyone the route accepts (manager/editor/author);
  API-only — no UI path found. Suspected intent: the wizard stays locked after
  submit — add the incomplete-submission policy (or an already-submitted guard)
  to save-for-later and edit (Open questions).
- ⚠ **A pure Site Administrator's wizard is read-only-plus-cancel** (ledger row
  177, code-derived + live-confirmed 2026-07-10): the wizard PAGE grants
  SITE_ADMIN (any in-progress submission renders fully, 200) and the
  cancel/delete route accepts the role (DELETE 200), but the
  saveForLater/edit/submit API routes' roleAuthorizer lists only
  Manager/Sub-editor/Author — and even `GET /api/v1/submissions/{id}` is
  refused — so for an admin holding no journal role every write returns 401
  roleBasedAccessDenied and the wizard's buttons fail silently. Page/API
  divergence family. Test-infra caveat: the journal scenario auto-enrols the
  admin as manager in scratch journals, masking this — probes must strip that
  role first. Suspected intent: align the API gates with the page, or bar
  admins from the wizard page.
- ⚠ **Two listeners reset author metadata-edit permission on submit**
  (RestrictAuthorAssignment and UpdateAuthorStageAssignments both handle the
  submitted event and write `canChangeMetadata`); one is stage-filtered and
  change-checked, the other unconditional. Redundant double-write; cleanup
  candidate (see Open questions #4).
- **A never-sent acknowledgement mailable**: SubmissionAcknowledgementNotAuthor
  (template SUBMISSION_ACK_NOT_USER) exists only as the *configurable* face of the
  other-authors email in Workflow → Emails — the runtime sender is
  SubmissionAcknowledgementOtherAuthors, which shares the template key. Not a
  user-facing bug; confusing twin worth a code comment.

## Open questions

1. Should the server enforce the submission checklist, privacy consent and
   copyright agreement (Known deviations #1), or is client-side gating the accepted
   product rule for API clients?
2. Is the add-endpoint's author-group fallback (enrol into any Author group even
   without self-registration; probe-confirmed, and the target group is a
   nondeterministic `first()` — one run picked "Translator") intended for
   invited/legacy flows, or should it match the start page's self-registration
   requirement and pick a designated group?
3. Should beginning a submission silently enrol a Section Editor (or any user
   without a submitting role) as an Author with no notice — or should the wizard
   tell them, or refuse?
4. Are both submit-time stage-assignment listeners meant to run (one unconditional,
   one filtered), or is RestrictAuthorAssignment a leftover superseded by
   UpdateAuthorStageAssignments?
5. Should `reviewerSuggestions` be added to the submission-progress whitelist, or
   should the step record a value from the existing list?
6. The submit response also refreshes the "approve submission" notification family,
   which appears to be an OPS/production concern — is this a no-op leftover in the
   OJS wizard (PKPSubmissionController::submit(), NOTIFICATION_TYPE_APPROVE_SUBMISSION)?
7. When a manager-role submitter is the only "author-side" user, no acknowledgement
   is sent at all (probe-confirmed, P16) — intended? If so, the completion screen's
   "you've been emailed a confirmation" copy needs to become conditional (Known
   deviations #9).
8. Confirm the intended editor auto-assignment rule (Known deviations #5): every
   section/category-assigned editor auto-assigned on submit with an in-app notice
   and email — and, once fixed upstream, where should the NORMAL-level in-app
   notice surface, given the bell is TASK-only and no listing page exists (Known
   deviations #6)?
9. Page vs API attribution for Site Administrators (Known deviations #4): should an
   admin be able to submit in their Author role (as the API allows and even
   prefers), or is the page's manager-roles-only rule the intent?
10. Is a submitted submission's wizard meant to be locked absolutely (ledger row
    176)? The save-for-later route currently reopens it for anyone it accepts —
    should it refuse completed submissions, or is API reopening an intended
    staff escape hatch?

---

<!-- REFERENCE MATERIAL — provenance and campaign bookkeeping, not product-owner
     narrative. The PO-facing "where do I find this" is in Purpose. -->

## Reference — entry points & surfaces

| Entry | Path | Atom |
|-------|------|------|
| Start page / wizard router | `{journal}/submission` (`?id=N` for in-progress/submitted; locale-prefixed URLs redirect to the locale-less one) → start form, wizard, or complete screen | PAGE-submission-index |
| Deprecated wizard URL | `{journal}/submission/wizard[?submissionId=N]` → redirect to `submission?id=N` (probed 2026-07-10, P10) | PAGE-submission-wizard |
| Saved-for-later page | `{journal}/submission/saved?id=N` (bare 404 without an accessible id — P11) | PAGE-submission-saved |
| Cancelled page | `{journal}/submission/cancelled` (renders for any logged-in user — P12) | PAGE-submission-cancelled |
| Start form component | StartSubmissionForm.vue over the StartSubmission form (PKP base + OJS section field) | VUE-start-submission-form, FORM-start-submission-pkp/-ojs |
| Reconfigure modal | "Change" → ReconfigureSubmissionModal.vue over ReconfigureSubmission (PKP locale + OJS section) | VUE-reconfigure-submission-modal, FORM-reconfigure-submission-pkp/-ojs |
| Wizard page component | SubmissionWizardPage.vue (steps state from PKPSubmissionHandler::showWizard()) | — (component not atomised; steps carry FORM-details, FORM-comments-for-the-editors, FORM-confirm-submission) |
| Create submission API | `POST /api/v1/submissions` (responds 200, not 201; stamps date_submitted at creation — Known deviations) | API-submission-add |
| Submit API | `PUT /api/v1/submissions/{submissionId}/submit` (`_validateOnly` for the Review check) | API-submission-submit |
| Save-for-later API | `PUT /api/v1/submissions/{submissionId}/saveForLater` (no completed-submission guard — ledger row 176) | (submission-drafts) |
| Cancel API | `DELETE /api/v1/_submissions?ids=N` | (submission-drafts: API-backend-submissions-bulk-delete-incomplete) |
| Wizard-state guards | SubmissionIncompletePolicy / SubmissionCompletePolicy (in-progress-only vs complete-only endpoints) | AUTHZ-submission-incomplete-policy, AUTHZ-submission-complete-policy |
| Acknowledgement emails | SUBMISSION_ACK / SUBMISSION_ACK_NOT_USER on submit | MAIL-submission-acknowledgement, MAIL-submission-acknowledgement-other-authors, MAIL-submission-acknowledgement-not-author |
| Editor notification | NOTIFICATION_TYPE_SUBMISSION_SUBMITTED to auto-assigned editors — never fires as built (Known deviations #5/#6) | NOTIF-submission-submitted |
| Event log | SUBMISSION_LOG_SUBMISSION_SUBMIT, SUBMISSION_LOG_COPYRIGHT_AGREED | EVLOG-SUBM-SUBMIT, EVLOG-SUBM-COPY-AGR |
| Storage | `submissions` table (`submission_progress`, `date_submitted`, `status`) | DB-submissions |

## Reference — code anchors

- pages/submission/SubmissionHandler.php + lib/pkp/pages/submission/PKPSubmissionHandler.php —
  router, start/wizard/complete/saved/cancelled screens, step assembly, submit-user-group and
  submit-section logic, cancel affordance
- lib/pkp/classes/components/forms/submission/{StartSubmission,ReconfigureSubmission,ConfirmSubmission,CommentsForTheEditors}.php
  (+ OJS overrides in classes/components/forms/submission/) — start, reconfigure, confirm, cover-note forms
- lib/pkp/classes/components/forms/publication/{Details,TitleAbstractForm}.php — Details step form
- lib/pkp/api/v1/submissions/PKPSubmissionController.php — add (:632; auto-enrol fallback :699-715), saveForLater (:822), submit (:876; confirmCopyright :919-935), routes/policies
- lib/pkp/classes/submission/Repository.php + classes/submission/Repository.php —
  validateSubmit, add, submit (event fan-out, cover-note discussion, task templates)
- lib/pkp/classes/observers/listeners/{SendSubmissionAcknowledgement,AssignEditors,LogSubmissionSubmitted,UpdateAuthorStageAssignments,RestrictAuthorAssignment}.php
  (+ OJS SendSubmissionAcknowledgement subscriber) — submitted-event listeners
- lib/pkp/classes/context/SubEditorsDAO.php assignEditors() (:211-216) — auto-assignment, SUBMISSION_SUBMITTED notification, EditorAssigned email; ⚠ broken keys()-as-group-ids filter (Known deviations)
- lib/pkp/classes/mail/mailables/{SubmissionAcknowledgement,SubmissionAcknowledgementOtherAuthors,SubmissionAcknowledgementNotAuthor,SubmissionSavedForLater}.php
- lib/ui-library/src/components/Container/SubmissionWizardPage.vue; lib/ui-library/src/components/Form/submission/StartSubmissionForm.vue;
  lib/ui-library/src/pages/submissionWizard/ReconfigureSubmissionModal.vue; lib/ui-library/src/mixins/autosave.js
- lib/pkp/templates/submission/{start,wizard,complete,saved,cancelled}.tpl + review-*.tpl — screens and Review-step panels; start.tpl not-accepting string; complete.tpl "emailed a confirmation" copy
- lib/pkp/schemas/submission.json (+ OJS schemas/submission.json) — submissionProgress, commentsForTheEditors, sectionId
