---
name: submission-wizard
scope: An author starts, fills in and submits a manuscript through the multi-step "Make a Submission" wizard — start form, files, details, contributors, comments for the editors, review/confirm — including the acknowledgement email, cancellation, and mid-flight reconfiguration (section/language)
shared: pkp-lib
status: verified
e2e-plans: [submission-wizard-core.md, submission-wizard-language.md, submission-wizard-validation.md]
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
  - FORM-confirm-submission
  - FORM-details
  - FORM-comments-for-the-editors
  - GRID-lib-pkp-wizard-file-upload-file-upload-wizard-handler
  - DB-submissions
  - MAIL-submission-acknowledgement
  - MAIL-submission-acknowledgement-not-author
  - MAIL-submission-acknowledgement-other-authors
  - NOTIF-submission-submitted
  - API-submission-add
  - API-submission-submit
  - AUTHZ-submission-complete-policy
  - AUTHZ-submission-incomplete-policy
  - EVLOG-SUBM-SUBMIT
  - EVLOG-SUBM-COPY-AGR
  - LOC-submission-submission-wizard
  - LOC-submission-submission-submit
---

# Submission wizard

## Purpose

The submission wizard is how a manuscript enters the journal. Any logged-in user can
open **Make a Submission** (`/submission`, also linked from the dashboards' "New
Submission" button and the reader-facing "Make a Submission" links), fill in a short
start form (title, language, section, checklist, privacy consent) and land in a
multi-step wizard: upload files, enter details (title/abstract), name contributors,
answer the journal's "For the Editors" questions, optionally suggest reviewers, then
review everything and submit. Work is autosaved continuously; a draft can be saved for
later, resumed, reconfigured (different section or language) or cancelled outright.
Completing the wizard turns the draft into a real submission in the editorial workflow:
the author gets an acknowledgement email, the section's editors are assigned and
notified, and the author is redirected to a "Submission complete" screen.

## Actors & permissions

Baselines: **anonymous users** are sent to login — every page here requires an account.
**Site admins and journal managers** act on any submission in the journal; everyone
else can act only on submissions they are assigned to. *The submitting author* below
means the user who started the draft (they hold an author assignment on it).
"Eligible section" = active and not restricted to editors (restricted sections are open
to managers, sub-editors and site admins only). <sup>a</sup>

| Action | Who may — and when |
|--------|--------------------|
| **Start a submission** | • Any logged-in user, regardless of role — a user with no submitting role is auto-enrolled as an Author when the journal has an author role permitting self-registration (live-probed: a reviewer-only account gets the full start form)<br>• Blocked for everyone (managers included) when the journal has stopped accepting submissions (live-probed)<br>• Blocked with a "Not Allowed" page when the user has no way to submit — no eligible group and the author group's self-registration is off (live-probed) — and with the same page carrying a "no section" message when every section is inactive/restricted (live-probed) <sup>b</sup> |
| **Choose "Submit As" role** | • Only users who hold 2+ groups with submission-stage access see the picker (single-group users submit as that group implicitly — live-probed: a plain manager/admin, whose only group is the stage-less "Journal manager" group, sees no picker and submits as manager)<br>• When the picker does appear it can offer a group the save rejects ⚠ — live-probed: a user holding *author + section-editor* is offered both "Author" and "Section editor", but choosing "Section editor" fails the save with "You are not allowed to submit in this user role" (see Known deviations) <sup>c</sup> |
| **Open / edit an in-progress draft (the wizard)** | • The submitting author<br>• Managers and site admins — any draft (in practice a site admin acts through the manager role auto-granted at journal creation; a manager-less site-admin account is a known scope edge — see Known deviations)<br>• **Assigned** editorial participants (a sub-editor or assistant with a stage assignment) — access via their assignment (live-probed: an assigned section editor opens the wizard and can Save for Later, but sees no Cancel)<br>• Everyone else, including *unassigned* sub-editors and reviewers — no access (live-probed: they land on an access-error page) <sup>d</sup> |
| **Save for later** | • Anyone who can open the wizard ("Save for Later" in the header and footer); disabled while the connection is down <sup>e</sup> |
| **Submit** | • Anyone who can open the wizard, once every completion requirement passes and every confirmation box on the Review step is ticked — until then the Submit button is disabled (live-probed) <sup>f</sup> |
| **Cancel a draft** | • The submitting author, managers and site admins — the footer "Cancel" appears only for them (live-probed: owner and manager see it) and only while the submission is incomplete<br>• Assigned non-author participants — no cancel affordance <sup>g</sup> |
| **Reconfigure (the "Change" link)** | • Anyone who can open the wizard — but the "Submitting to …" line with its Change control exists only when the journal offers more than one eligible section or more than one submission language (live-probed: absent on a single-section, single-language journal, so reconfiguration is unreachable there) <sup>h</sup> |
| **Submit to an editor-restricted section** | • Managers, sub-editors and site admins — the section appears in their pickers (live-probed) and passes the final-submit check<br>• Plain authors — the section is hidden from the start form and reconfigure modal, and re-checked at final submit <sup>i</sup> |
| **View the "Submission complete" screen** | • Anyone with access to the submission who visits its wizard URL after submission (the submitter is redirected there on submit) <sup>j</sup> |

<sup>a</sup> PKPSubmissionHandler::authorize(); SubmissionAccessPolicy; PKPSubmissionHandler::getSubmitSections(), isEditor(); Section::getEditorRestrictedRoles() ·
<sup>b</sup> PKPSubmissionHandler::authorize() (UserRequiredPolicy + markRoleAssignmentsChecked when no id); SubmissionHandler::start() (OJS); PKPSubmissionHandler::getSubmitUserGroups(); PKPSubmissionController::add() (`disableSubmissions` check, author auto-enrol); templates/submission/start.tpl ·
<sup>c</sup> StartSubmission::addUserGroups() (lib/pkp); PKPSubmissionController::add() `userGroupId` validation ·
<sup>d</sup> SubmissionAccessPolicy (via PKPSubmissionHandler::authorize()); PKPSubmissionHandler::__construct() role assignment ·
<sup>e</sup> templates/submission/wizard.tpl (`saveForLater`, `:is-disabled="isDisconnected"`); PKPSubmissionController::saveForLater() ·
<sup>f</sup> SubmissionWizardPage.vue `canSubmit`/`isConfirmed`/`isValid`; PKPSubmissionController::submit(); Repository::validateSubmit() ·
<sup>g</sup> PKPSubmissionHandler::showWizard() (`canCancelSubmission`); Repository::canCurrentUserDelete(); PKPBackendSubmissionsController::bulkDeleteIncompleteSubmissions() ·
<sup>h</sup> SubmissionHandler::getSubmittingTo() (OJS, empty when 1 section and 1 language); templates/submission/wizard.tpl (`{if $submittingTo}`) ·
<sup>i</sup> SubmissionHandler::getSubmitSections(); PKPSubmissionController::add() and submit() section checks ·
<sup>j</sup> PKPSubmissionHandler::index() → complete()

## Fields & validation

**Start form** ("Make a Submission", before the wizard). Conditional fields simply do
not appear when their journal setting is empty (live-probed both shapes). Submitting
the empty form flags every missing field inline with a "Please correct N errors"
summary. <sup>a</sup>

| Field (UI label) | Required? | Rules |
|------------------|-----------|-------|
| **Before you begin** | — | Informational text from journal settings; shown only when configured |
| **Submission Language** | Yes | Radio; shown only when the journal accepts submissions in 2+ languages |
| **Title** | Yes | One-line rich text, in the chosen submission language |
| **Section** | Yes | Radio over eligible sections; shown only when there are 2+ of them (a single eligible section is applied silently); a section's policy text appears beneath it when selected |
| **Submission Checklist** | Yes | Single confirmation checkbox below the journal's checklist text; shown only when a checklist is configured |
| **Submit As** | Yes | Radio; shown only for users with 2+ eligible groups (see permissions) |
| **Privacy Consent** | Yes | Confirmation checkbox linking the privacy statement; shown only when a privacy statement is configured (the site-wide statement when the site is configured that way) |

<sup>a</sup> StartSubmission (lib/pkp: addIntroduction/addLanguage/addTitle/addSubmissionChecklist/addUserGroups/addPrivacyConsent) + StartSubmission (OJS: `sectionId` radio/hidden, per-section FieldHTML policy); live probe 2026-07-02

**Wizard steps** (publicknowledge shape live-probed: *1 Upload Files · 2 Details ·
3 Contributors · 4 For the Editors · 5 Reviewer Suggestions · 6 Review*; a journal with
default settings shows 5 steps, without Reviewer Suggestions). Multilingual fields
show the submission language first plus an entry per other supported language; only
the submission-language value is required. <sup>b</sup>

| Step | Fields (UI labels) | Rules |
|------|--------------------|-------|
| **Upload Files** | Files list, "Add File" upload | After upload, "What kind of file is this?" offers the primary genre (e.g. *Article Text*) and *Other* (full genre list). Dependent-file genres are not offered. Genres marked "required to submit" gate final submission <sup>c</sup> |
| **Details** | **Title** (required, multilingual), **Keywords** (when enabled), **Abstract** (multilingual; required and word-limited per section), **References** (when citations are collected), **Plain-language summary** / data citations (when enabled) | Abstract requirement/word limit come from the chosen section; keywords/citations/data rules belong to their own specs (Cross-feature) <sup>d</sup> |
| **Contributors** | Contributors list panel | The submitter is pre-added as a contributor and primary contact (from their profile) when submitting as an author. Every contributor needs a name in the submission language to pass final validation. Form details belong to the contributors spec <sup>e</sup> |
| **For the Editors** | Journal-configured metadata (owned by submission-wizard-metadata), **Categories** (when the journal lets authors pick categories), **Data availability** (when collected), **Comments for the Editor** (rich text, optional) | Comments for the Editor can only be entered while the submission is in the wizard (rejected afterwards, rule 13) <sup>f</sup> |
| **Reviewer Suggestions** | Suggestion list panel | Present only when enabled; an empty list shows a warning on Review but does not block submission (live-probed). Owned by the reviewer-suggestions spec <sup>g</sup> |
| **Review** | Read-only panels per step with **Edit** links; **Confirmation** section with "Yes, I agree to the copyright statement." | The copyright checkbox exists only when the journal has a copyright notice; while unticked, Submit is disabled even for a fully valid submission (live-probed on a scratch journal) <sup>h</sup> |

<sup>b</sup> PKPSubmissionHandler::getSteps(); getLocalizedForm(); live probes 2026-07-02 ·
<sup>c</sup> PKPSubmissionHandler::getSubmissionFilesListPanel() (dependent genres filtered); GenreDAO::getRequiredToSubmit(); Repository::validateSubmit() 'files' ·
<sup>d</sup> Details (OJS handler passes section `wordCount`, `abstractsNotRequired`); TitleAbstractForm; PKPSubmissionHandler::getDetailsStep() (citations/data-citations sections) ·
<sup>e</sup> PKPSubmissionController::add() (newAuthorFromUser, primaryContactId); Repository::validateSubmit() 'contributors' ·
<sup>f</sup> PKPSubmissionHandler::getEditorsStep(); CommentsForTheEditors; ForTheEditors ·
<sup>g</sup> PKPSubmissionHandler::getReviewerSuggestionsStep() (`reviewerSuggestionEnabled`) ·
<sup>h</sup> PKPSubmissionHandler::getConfirmStep(); ConfirmSubmission (`confirmCopyright`); SubmissionWizardPage.vue `isConfirmed`

## Rules & state

**Routing & lifecycle** — a submission is *in the wizard* until it is submitted; the
wizard remembers which step was last worked on.

1. `/submission` routes on state: no submission → the start form; an in-progress
   submission (`?id=N`) → the wizard, opened at the last-saved step; a submitted one →
   the "Submission complete" screen. The pre-3.4 `/submission/wizard` URL redirects to
   the current one. <sup>a</sup>
2. **Starting** creates a real (but incomplete) submission immediately: the draft gets
   the chosen language, section and title; the submitter gets a stage assignment in
   their chosen/derived group; if that group is an author group, a contributor record
   is created from their profile and made primary contact. Metadata editing is always
   allowed while in the wizard, regardless of the group's usual permission. A user
   with no eligible group at all is enrolled into the journal's author role on save.
   <sup>b</sup>
3. **Section eligibility** is enforced at three points: sections that are inactive, or
   editor-restricted for non-editors, are (1) hidden from the start form and
   reconfigure modal, (2) rejected when the draft is created, and (3) re-checked at
   final submit — so a section closed *after* the draft was started still blocks it.
   If the draft's section has closed, opening the wizard itself shows a "Section
   Closed" error page instead of the steps (live-probed: deactivating an in-flight
   draft's section makes both the submitting author *and* an assigned section editor
   land on the "Section Closed" page — an *inactive* section blocks everyone, since the
   `isEditor` exemption only relaxes the *editor-restricted* flag, not inactivity).
   <sup>c</sup>
4. **Step order** is Upload Files → Details → Contributors → For the Editors →
   Reviewer Suggestions (when enabled) → Review. Movement is free: Continue/Back
   walk sequentially, the stepper header jumps to any already-visited step, and any
   step is reachable by its URL hash (`#details`, `#review`, …) — there is no
   per-step completion gate; all requirements are checked together on Review. The
   browser tab title tracks the step, and browser back/forward moves between visited
   steps. <sup>d</sup>
5. **Autosave**: form changes are saved automatically as the user moves through the
   wizard; the footer shows "Saving / Last saved X ago", flips to a "Reconnecting"
   state when the server is unreachable (disabling Save for Later and Submit), and
   unsaved changes parked in the browser are offered for restore when the page is
   reopened. Failed autosaves that indicate an expired session prompt a re-login.
   <sup>e</sup>
6. **Save for Later** stores the last-started step, emails the submitter a resume link
   ("Resume your submission…", live-probed), and lands on the **Saved for Later**
   page, which repeats the link and the email address used. The draft-side experience
   (incomplete list, resuming, deleting from the list) belongs to submission-drafts.
   <sup>f</sup>
7. **What blocks Submit** (checked server-side; the Review step runs the same check on
   entry and paints the failures onto the step panels, with a summary banner —
   live-probed): a title in the submission language; a name for every contributor in
   the submission language (and affiliation names unless ROR-linked); an abstract in
   the submission language when the section requires one; abstract / plain-language
   summary within the section's word limit; one file for every genre marked "required
   to submit" ("You must upload at least one Article Text file."); every metadata
   field the journal set to *require* (owned by submission-wizard-metadata); and the
   submission must still be in the wizard with normal queue status ("already
   submitted" error otherwise). Fixing the gaps and revisiting Review clears the
   banner and enables Submit. <sup>g</sup>
8. **Confirmation boxes gate the button separately**: even a fully valid submission
   keeps Submit disabled until every checkbox in the Review step's Confirmation
   section (the copyright agreement) is ticked. Journals without a copyright notice
   have no Confirmation section and skip this gate entirely (both shapes
   live-probed). <sup>h</sup>
9. **Final submit** asks "The submission … will be submitted to … Are you sure?"
   before acting. On confirm the submission leaves the wizard permanently (its
   in-wizard progress marker is cleared and the submission date stamped — there is no
   un-submit), and the user is redirected to the acknowledgement screen with three
   links: review this submission (their submission's workflow view), create a new
   submission, return to the dashboard. Side effects are listed below. <sup>i</sup>
10. **After submit, author editing rights shrink back**: the always-may-edit-metadata
    grant from rule 2 reverts to whatever the author's group setting ("permit
    metadata edit") says. <sup>j</sup>
11. **Incomplete submissions are not in the workflow**: until submitted, a draft has
    no workflow presence — editorial decisions, publication forms and similar
    workflow endpoints refuse incomplete submissions, and pre-publication preview is
    refused. Conversely, wizard-only material (e.g. reviewer suggestions) is editable
    only while the submission is incomplete. <sup>k</sup>
12. **Cancel** (footer link, shown per the permissions table) warns "This will delete
    the submission and all associated data. This action cannot be undone.", then
    deletes the draft and lands on the **Submission cancelled** page. The deletion
    only works on incomplete submissions; the old wizard URL is gone afterwards
    (live-probed: 404). <sup>l</sup>
13. **Reconfigure**: the "Change" link beside "Submitting to the *section* section in
    *language*." opens the **Change Submission Settings** modal with a Submission
    Language radio and a Section radio (each present only when there are 2+ options).
    Saving stores the changes and reloads the wizard; the header line and all
    section-derived rules re-derive immediately (live-probed: switching Articles →
    Reviews dropped the abstract's Required flag). Language changes affect which
    locale the forms require — values already entered in other languages are kept.
    <sup>m</sup>
14. **Comments for the Editor is wizard-only**: the field is accepted while the
    submission is in progress and rejected as a disallowed change once submitted. On
    submit, a non-empty comment becomes a discussion with the editorial team (rules
    owned by tasks-discussions). <sup>n</sup>

<sup>a</sup> PKPSubmissionHandler::index(); wizard() (@deprecated redirect); SubmissionWizardPage.vue created() (`submissionProgress` step resume) ·
<sup>b</sup> PKPSubmissionController::add(); Repo::stageAssignment()->build() (`submissionProgress ? true : permitMetadataEdit`); Repo::author()->newAuthorFromUser(); Repo::userGroup()->assignUserToGroup() ·
<sup>c</sup> SubmissionHandler::getSubmitSections(); PKPSubmissionController::add() section errors (`inactiveSection`, `sectionRestrictedToEditors`); submit() section check; PKPSubmissionHandler::showWizard() (`sectionClosed` error page) ·
<sup>d</sup> PKPSubmissionHandler::getSteps(); Steps.vue (started-steps-only buttons); Page.vue (`window.onhashchange`); SubmissionWizardPage.vue nextStep()/previousStep(), addHistory() ·
<sup>e</sup> SubmissionWizardPage.vue autosave mixin usage, addAutosaves(), autosaveErrored(), restoreStoredAutosave(); wizard.tpl `submissionWizard__lastSaved` ·
<sup>f</sup> PKPSubmissionController::saveForLater() (SubmissionSavedForLater mail); PKPSubmissionHandler::saved(); templates/submission/saved.tpl ·
<sup>g</sup> Repository::validateSubmit() (lib/pkp: progress/status, title, contributors, required metadata, required genres) + Repository::validateSubmit() (OJS: abstract required per section, word limits); PKPSubmissionController::submit() `_validateOnly`; SubmissionWizardPage.vue validate(), errors watcher ·
<sup>h</sup> SubmissionWizardPage.vue `isConfirmed`, `canSubmit`; PKPSubmissionHandler::getConfirmStep() (section omitted when form has no fields) ·
<sup>i</sup> SubmissionWizardPage.vue submit() (`i18nConfirmSubmit`); Repository::submit() (clears `submissionProgress`, stamps `dateSubmitted`); templates/submission/complete.tpl; PKPSubmissionHandler::getWorkflowUrl() ·
<sup>j</sup> UpdateAuthorStageAssignments::handle(); RestrictAuthorAssignment::handle() ·
<sup>k</sup> SubmissionCompletePolicy (used by decisions/publication form endpoints); SubmissionIncompletePolicy (reviewer-suggestion endpoints); Repository::canPreview() ·
<sup>l</sup> SubmissionWizardPage.vue cancelSubmission(); PKPSubmissionHandler::getSubmissionCancelUrl() (`DELETE _submissions?ids=`); PKPBackendSubmissionsController::bulkDeleteIncompleteSubmissions() (`filterByIncomplete`, canCurrentUserDelete); PKPSubmissionHandler::cancelled() ·
<sup>m</sup> ReconfigureSubmissionModal.vue; SubmissionWizardPage.vue reconfigureSubmission(); SubmissionHandler::getReconfigureSubmissionProps() (`locale`) / getReconfigurePublicationProps() (`sectionId`); ReconfigureSubmission (OJS + lib/pkp) ·
<sup>n</sup> Repository::validate() (`commentsForTheEditors` disallowed once submitted); Repository::submit() → EditorialTask Repository::addCommentsForEditorsQuery()

## Side effects

All of these fire at final submit (they are event-driven off the submission event):

- **Acknowledgement emails** (live-probed): every user holding an author assignment on
  the submission gets "Thank you for your submission…" (template `SUBMISSION_ACK`),
  from the journal's contact. The journal can BCC its primary contact and/or a fixed
  copy address. When the journal's acknowledgement setting is *all authors*,
  contributors who are not submitting users get a separate email (template
  `SUBMISSION_ACK_NOT_USER`) naming the submitter; setting it to *submitting author
  only* skips that second mail, and *don't send* suppresses both. Both mails land in
  the submission's email log. The templates are journal-editable and can be disabled
  in Settings → Workflow → Emails. <sup>a</sup>
- **Editor auto-assignment + notification**: editors pre-assigned to the chosen
  section (or the chosen categories) are added as participants; each gets an in-app
  *submission submitted* notification (bell) and a "You have been assigned as an
  editor…" email (skipped for users who opted out of that notification's emails;
  logged in the email log). Live-probed: the Articles-section editors received both.
  If nobody could be auto-assigned, every journal manager instead gets a
  needs-an-editor task notification and email. <sup>b</sup>
- **Cover-note discussion**: a non-empty "Comments for the Editor" becomes a
  submission-stage discussion among the editorial team and the author, with its own
  notification/email behaviour — owned by tasks-discussions (live-probed: the
  "Comments for the Editor" email reached the author and assigned editors).
  <sup>c</sup>
- **Auto-created editorial tasks**: task/discussion templates flagged "add
  automatically" for the submission stage are instantiated now (rules owned by
  tasks-discussions; imports intentionally skip this). <sup>d</sup>
- **Event log**: an "Author submits manuscript" entry is recorded; if the copyright
  box was ticked, a separate "copyright agreed" entry stores the copyright notice
  text that was agreed to. <sup>e</sup>
- **Save for Later** (not submit) sends the "Resume your submission" email
  (`SUBMISSION_SAVED_FOR_LATER`) to the person saving. <sup>f</sup>

<sup>a</sup> SendSubmissionAcknowledgement::handle() (lib/pkp + OJS subscriber); SubmissionAcknowledgement; SubmissionAcknowledgementOtherAuthors; context settings `submissionAcknowledgement` (default `allAuthors`), `copySubmissionAckPrimaryContact`, `copySubmissionAckAddress`; SubmissionEmailLogEventType::AUTHOR_SUBMISSION_ACK ·
<sup>b</sup> AssignEditors::handle(); SubEditorsDAO::assignEditors() (NOTIFICATION_TYPE_SUBMISSION_SUBMITTED; EditorAssigned mailable; blocked_emailed_notification check); SubmissionNeedsEditor; NOTIFICATION_TYPE_EDITOR_ASSIGNMENT_REQUIRED ·
<sup>c</sup> Repository::submit() → EditorialTask Repository::addCommentsForEditorsQuery() ·
<sup>d</sup> Repository::submit() → EditorialTask Repository::autoCreateFromTemplates() ·
<sup>e</sup> LogSubmissionSubmitted::handle() (SUBMISSION_LOG_SUBMISSION_SUBMIT); PKPSubmissionController::submit() (SUBMISSION_LOG_COPYRIGHT_AGREED, stores `copyrightNotice`) ·
<sup>f</sup> PKPSubmissionController::saveForLater(); SubmissionSavedForLater

## Settings that modify behavior

- **Don't accept submissions** (Settings → Workflow): start page shows a "not
  accepting submissions" notice instead of the form (no Begin button), and creating a
  draft is refused. Live-probed on a scratch journal: with the setting on, both an
  enrolled author and the journal's manager/admin saw the notice, and `POST /submissions`
  returned 403 "This journal is not accepting submissions at this time." for both — the
  block is unconditional, applying even to managers. <sup>a</sup>
- **Sections** (Settings → Journal): *inactive* and *editor-restricted* flags drive
  eligibility (rule 3); per-section *abstracts not required*, *abstract word count*
  and *policy* drive the Details step and final validation (rules 7, 13).
- **Submission checklist / privacy statement / copyright notice** (Settings →
  Workflow): each conditionally creates its start-form or Review-step consent field
  (Fields tables). `config.inc.php` `sitewide_privacy_statement` swaps the journal's
  privacy statement for the site's. <sup>b</sup>
- **Submission languages** (Settings → Website → Languages): 2+ enabled submission
  locales add the Submission Language radio, per-language form entries, and the
  language half of the reconfigure modal.
- **Metadata collection modes** (Settings → Workflow → Metadata): keywords /
  citations / data-citations toggles add their Details-step fields; the For-the-
  Editors set is owned by submission-wizard-metadata. **Submit with categories** adds
  the Categories picker to For the Editors.
- **Reviewer suggestions enabled** adds the whole step (owned by
  reviewer-suggestions).
- **Genres** (Settings → Workflow → Components): "required to submit" flags feed the
  file requirement; dependent genres never appear in the wizard's upload.
- **Submission acknowledgement / copy addresses** (Settings → Workflow → Emails +
  Submission): who gets acknowledgement email(s), per Side effects.
- **Guidance texts** (`beginSubmissionHelp`, `uploadFilesHelp`, `detailsHelp`,
  `contributorsHelp`, `forTheEditorsHelp`, `reviewHelp`): shown atop the start form
  and each step; editing them is owned by submission-settings.

<sup>a</sup> templates/submission/start.tpl (`disableSubmissions` notice); PKPSubmissionController::add() 403 ·
<sup>b</sup> StartSubmission::addPrivacyConsent() (`sitewide_privacy_statement`); ConfirmSubmission::__construct()

## Cross-feature interactions

- **submission-wizard-metadata** — the For-the-Editors metadata fields and their
  request/require modes; this spec only places the step and its completion gate.
- **reviewer-suggestions** — the Reviewer Suggestions step content; this spec owns
  only its presence and the (non-blocking) empty warning on Review.
- **submission-drafts** — save-for-later semantics beyond the page itself, the
  incomplete-submissions list, resuming and list-side deletion; the cancel endpoint
  (`API-backend-submissions-bulk-delete-incomplete`) is claimed there.
- **contributors** — the contributor form opened from the Contributors step.
- **submission-files** — file/genre semantics behind the Upload Files step.
- **tasks-discussions** — the cover-note discussion and auto-created tasks fired at
  submit.
- **author-dashboard / editorial-dashboards** — where the submitter tracks the
  submission afterwards and where editors meet it ("New Submission" buttons live
  there too).
- **email-templates-management** — editing/disabling the acknowledgement templates.

## Canonical scenarios

1. **First-time end-to-end submit with acknowledgement** — atester on
   `publicknowledge`: opens `/submission`, fills Title, picks English + Articles,
   ticks checklist + privacy consent, Begin Submission. Uploads a PDF and marks it
   *Article Text*, fills the Abstract, types a Comments-for-the-Editor note, walks to
   Review — banner clears, Submit enables — confirms the "will be submitted to…"
   dialog. Lands on **Submission complete**; Mailpit shows "Thank you for your
   submission…" to atester and "You have been assigned as an editor…" to the Articles
   section editors; the author's dashboard lists the submission.
2. **Incomplete submission is blocked at Review** — same start, but jump straight to
   Review with nothing done: the warning banner appears with per-panel errors ("You
   must upload at least one Article Text file.", required abstract) and Submit is
   disabled; supplying the file and abstract and re-entering Review clears them and
   enables Submit.
3. **Copyright consent gates Submit** — on a scratch journal seeded with a copyright
   notice: a fully valid draft still shows Submit disabled on Review until "Yes, I
   agree to the copyright statement." is ticked; ticking it enables Submit, and the
   submission's activity log records the copyright agreement.
4. **Only the right people can open or cancel a draft** — atester's in-progress draft:
   dbarnes (manager-level editor) opens the wizard and sees the footer Cancel;
   dbuskins (unassigned section editor) and phudson (reviewer) get an access error;
   a reviewer-only account can nonetheless start its *own* new submission from
   `/submission`.
5. **Cancel deletes the draft** — the submitting author clicks the footer Cancel,
   accepts "…delete the submission and all associated data. This action cannot be
   undone.", lands on **Submission cancelled**, and the old wizard URL is a 404; the
   draft is gone from the incomplete list.
6. **Reconfigure mid-flight** — on a 2-section, 2-language journal: "Submitting to
   the Articles section in English. *Change*" opens **Change Submission Settings**;
   switching Section to Reviews reloads the wizard, the header line updates, and the
   Details Abstract is no longer marked Required (Reviews doesn't require abstracts).
   On a single-section, single-language journal the line and Change control are
   absent.

## Known deviations (as-built ≠ intent)

- ⚠ **The "Submit As" picker can offer groups the save rejects** (live-probed;
  docs/e2e/app-changes.md §2 row 3 + pkp/pkp-lib#10929): the start form offers every
  group of the user's that has submission-stage access (sub-editor and assistant
  groups included), but the create call accepts only manager/author groups. Live-probed
  on a scratch journal with a user holding *author + section-editor*: the picker
  offered both "Author" and "Section editor"; choosing "Section editor" answered
  `POST /submissions` 400 "You are not allowed to submit in this user role"
  (`api.submissions.400.invalidSubmitAs`) and painted the error banner, while "Author"
  saved. A stage filter on the accepted-groups side is commented out pending
  pkp/pkp-lib#10929, so the two lists are built from different criteria
  (StartSubmission::addUserGroups() vs PKPSubmissionController::add()). Practical
  impact is narrow (needs a user holding both a submitting role and 2+ stage-access
  groups); a plain manager, whose only group is the stage-less "Journal manager"
  group, sees no picker and submits as manager fine.
- ⚠ **Two different "no role" fallbacks** (live-probed; docs/e2e/app-changes.md §2
  row 61): the start *page* admits a role-less user only when an author group permits
  self-registration (PKPSubmissionHandler::getSubmitUserGroups()), while the create API
  auto-enrols them into the journal's first author group with **no** self-registration
  check (PKPSubmissionController::add()). Live-probed on a scratch journal with author
  self-registration turned off and a reviewer-only user: the start page showed the
  "Not Allowed" page, yet `POST /submissions` still enrolled that user into the author
  group (role 65536 appeared on their account) and proceeded to create the draft
  (returning only a `sectionId` validation error, not an authorization refusal).
  API-only authorization-policy bypass; suspected intent is the page's stricter rule.
- **Vestigial mailable class** (not user-facing): `SubmissionAcknowledgementNotAuthor`
  is registered (and listed in Settings → Emails) but never dispatched; the mail
  actually sent to co-authors is `SubmissionAcknowledgementOtherAuthors`, sharing the
  same `SUBMISSION_ACK_NOT_USER` template. Cleanup candidate, no behaviour change.
- ⚠ **Site-admin access to the wizard rides on the manager auto-enrolment**
  (cross-cutting; docs/e2e/app-changes.md §2 row 56 — the systemic site-admin scope
  issue): the wizard's page grant and `SubmissionAccessPolicy` both list
  `ROLE_ID_SITE_ADMIN`, so "site admins act on any draft" holds *in normal use*
  because journal creation auto-enrols the creating admin as a **manager**
  (PKPContextService::add()) — and that manager role is what actually clears the
  context-scoped policies (verified: the seeded `admin`, a manager on every journal,
  opens and cancels any draft). A site-admin account with **no** manager enrolment on
  the journal is the row-56 edge and was not independently re-verified here (a
  manually-constructed pure-site-admin account failed to authenticate as a site admin
  cleanly, so its wizard denial is not a reliable live result). Treated as the same
  systemic caveat, not a new finding.

## Open questions

1. Is the "Submit As" offers-vs-accepts mismatch (deviation 1) just the unfinished
   pkp/pkp-lib#10929, i.e. should the API accept any submission-stage group?
2. Should the create API respect the author group's "permit self-registration" flag
   the way the start page does (deviation 2)?
3. `GRID-lib-pkp-wizard-file-upload-file-upload-wizard-handler` is claimed here per
   FEATURE-MAP, but its only live reference today is the Galley Manager's upload
   flow — the wizard's file step uses the files API/list panel instead. Move the atom
   to galleys/submission-files at the next grooming pass?
4. The submission schema's allowed wizard-progress values
   (`in:,start,details,files,contributors,editors,review`) don't include
   `reviewerSuggestions`, yet Save for Later on that step writes it unvalidated
   (PKPSubmissionController::saveForLater() bypasses schema validation) while a
   direct submission edit with the same value would be rejected. Add the value or is
   the omission intentional?
5. PKPSubmissionController::submit() refreshes an "approve submission" notification
   (`NOTIFICATION_TYPE_APPROVE_SUBMISSION`) — an OPS posting-approval concept. Does
   this have any observable effect in OJS, or is it a shared-code leftover?
6. **Unclaimed side-effect atoms fired at submit.** The editor auto-assignment
   effects — `MAIL-editor-assigned` (EditorAssigned), `MAIL-submission-needs-editor`
   (SubmissionNeedsEditor) and `NOTIF-editor-assignment-required` — all fire from the
   `AssignEditors` listener on the wizard's `SubmissionSubmitted` event and are
   documented in this spec's Side effects, yet the atlas leaves them unclaimed (hint
   column: email-delivery / editorial-tasks). Likewise `API-submission-save-for-later`
   and `MAIL-submission-saved-for-later` are unclaimed (this spec describes the button
   and email but defers save-for-later ownership to submission-drafts). Assign each to
   one owner at the next grooming pass — either here (as the sole trigger point) or in
   the email-delivery / editorial-dashboards / submission-drafts specs.

---

## Reference — entry points & surfaces

| Entry | Path | Atom |
|-------|------|------|
| Start page / wizard / complete screen | `/{journal}/submission[?id=N]` (state-routed, rule 1); linked from dashboards' "New Submission" and public "Make a Submission" | PAGE-submission-index |
| Deprecated wizard URL | `/{journal}/submission/wizard[?submissionId=N]` → redirect | PAGE-submission-wizard |
| Saved-for-later page | `/{journal}/submission/saved?id=N` | PAGE-submission-saved |
| Cancelled page | `/{journal}/submission/cancelled` | PAGE-submission-cancelled |
| Start form (Vue) | `StartSubmissionPage` → `StartSubmissionForm` | VUE-start-submission-form |
| Start form (config) | StartSubmission form, PKP base + OJS section field | FORM-start-submission-pkp, FORM-start-submission-ojs |
| Wizard page (Vue) | `SubmissionWizardPage` (lib/ui-library Container) | — (no atom swept for the page component) |
| Reconfigure modal | "Change" → `ReconfigureSubmissionModal` | VUE-reconfigure-submission-modal, FORM-reconfigure-submission-pkp, FORM-reconfigure-submission-ojs |
| Details step forms | Details (OJS wizard) / TitleAbstractForm (base) | FORM-details (the base `FORM-title-abstract-form` is owned by `publication-title-abstract-body` — the post-submission Title & Abstract tab; the wizard's Details step subclasses it) |
| Comments for the editors | For-the-Editors step section | FORM-comments-for-the-editors |
| Confirm step | Review step Confirmation section | FORM-confirm-submission |
| Create draft API | `POST api/v1/submissions` | API-submission-add |
| Final submit API | `PUT api/v1/submissions/{id}/submit` (`_validateOnly` for the Review check) | API-submission-submit |
| Cancel API | `DELETE api/v1/_submissions?ids={id}` | — (API-backend-submissions-bulk-delete-incomplete, owned by submission-drafts) |
| Wizard-state policies | complete-only workflow / incomplete-only wizard guards | AUTHZ-submission-complete-policy, AUTHZ-submission-incomplete-policy |
| Acknowledgement emails | SUBMISSION_ACK / SUBMISSION_ACK_NOT_USER | MAIL-submission-acknowledgement, MAIL-submission-acknowledgement-not-author, MAIL-submission-acknowledgement-other-authors |
| Editor bell notification | NOTIFICATION_TYPE_SUBMISSION_SUBMITTED | NOTIF-submission-submitted |
| Event log | submit + copyright-agreed entries | EVLOG-SUBM-SUBMIT, EVLOG-SUBM-COPY-AGR |
| Storage | `submissions` table (incl. `submission_progress`, `date_submitted`) | DB-submissions |
| Legacy file-upload wizard | `wizard.fileUpload.FileUploadWizardHandler` (live via Galley Manager; see Open questions #3) | GRID-lib-pkp-wizard-file-upload-file-upload-wizard-handler |
| Locale keys | `submission.wizard.*`, `submission.submit.*` | LOC-submission-submission-wizard, LOC-submission-submission-submit |

## Reference — code anchors

- pages/submission/SubmissionHandler.php (OJS: start-form assembly, Details/ForTheEditors/Reconfigure factories, submitting-to line)
- lib/pkp/pages/submission/PKPSubmissionHandler.php (routing, steps, wizard state, cancel/saved/cancelled pages, section eligibility)
- lib/pkp/api/v1/submissions/PKPSubmissionController.php (add / edit / saveForLater / submit; route role lists)
- lib/pkp/classes/submission/Repository.php + classes/submission/Repository.php (validate, validateSubmit, submit, canCurrentUserDelete)
- classes/components/forms/submission/{StartSubmission,ReconfigureSubmission}.php and lib/pkp equivalents; lib/pkp/classes/components/forms/submission/{ConfirmSubmission,CommentsForTheEditors}.php; lib/pkp/classes/components/forms/publication/{Details,TitleAbstractForm}.php
- lib/ui-library/src/components/Container/SubmissionWizardPage.vue, StartSubmissionPage.vue; lib/ui-library/src/pages/submissionWizard/ReconfigureSubmissionModal.vue; lib/pkp/templates/submission/{start,wizard,complete,saved,cancelled}.tpl
- lib/pkp/classes/observers/listeners/{SendSubmissionAcknowledgement,AssignEditors,LogSubmissionSubmitted,UpdateAuthorStageAssignments,RestrictAuthorAssignment}.php; classes/observers/listeners/SendSubmissionAcknowledgement.php
- lib/pkp/api/v1/_submissions/PKPBackendSubmissionsController.php (bulkDeleteIncompleteSubmissions — the wizard's Cancel target)
