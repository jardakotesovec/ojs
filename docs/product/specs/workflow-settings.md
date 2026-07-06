---
name: workflow-settings
scope: The manager's Settings → Workflow page — how the journal shapes intake and review; author guidance texts & submission checklist, disabling submissions, metadata collection modes, the file-components (genres) manager, review setup (default method, deadlines, reminder thresholds, reviewer file access, one-click access, reviewer suggestions toggle), reviewer guidance & competing interests, the reviewer-recommendation vocabulary, and the journal's email-notification configuration (signature, submission-acknowledgement routing, decision notifications, stats email, bounce address)
shared: pkp-lib
status: verified
e2e-plans: [submission-settings.md, review-settings.md]
atlas-claims:
  - PAGE-management-settings-workflow
  - FORM-submission-guidance-settings
  - FORM-pkp-disable-submissions-form
  - FORM-pkp-review-setup-form
  - FORM-pkp-review-guidance-form
  - FORM-review-guidance-form
  - FORM-reviewer-recommendation-form
  - FORM-pkp-email-setup-form
  - GRID-lib-pkp-grid-settings-genre-genre-grid-handler
  - DB-genres
  - DB-genre_settings
  - DB-reviewer_recommendations
  - DB-reviewer_recommendation_settings
  - API-genre-get-many
  - API-genre-get
  - API-reviewer-recommendation-get
  - API-reviewer-recommendation-get-many
  - API-reviewer-recommendation-add
  - API-reviewer-recommendation-edit
  - API-reviewer-recommendation-update-status
  - API-reviewer-recommendation-delete
  - AUTHZ-recommendation-access-policy
  - AUTHZ-recommendation-context-policy
  - AUTHZ-recommendation-required-policy
  - VUE-reviewer-recommendation-manager
  - LOC-default-default-genres
---

# Workflow settings

## Purpose

Settings → Workflow is where a journal manager configures how submissions come in and
how peer review runs — without touching any individual submission. One page, five
top-level tabs: **Submission** (disable submissions, author guidance texts, metadata
collection modes, file components, contributor roles), **Review** (setup, reviewer
guidance, review forms, reviewer recommendations), **Publisher Library**, **Emails**
(the journal's notification-email configuration), and **Tasks and Discussions**
(templates). This spec owns the page itself plus the settings surfaces that have no
other home: the author-guidance form, disable-submissions, the **file-components
(genres) manager**, the review setup and reviewer-guidance forms, the
**reviewer-recommendation vocabulary manager**, and the **Emails setup form**. Tabs that
are their own features are referenced, not re-specified (see Cross-feature
interactions). Every setting here is consumed elsewhere — the spec verifies the wiring
with one live effect-link per group and defers the downstream behaviour to its owner.

## Actors & permissions

Baseline — the Area 6 settings gate, canonically verified in `journal-masthead-settings`
and not re-proven here: the page (`management/settings/workflow`) and the settings
endpoint (`PUT contexts/{id}`, which saves every form on this page except the
reviewer-recommendation manager) are open to **site admins** and to **managers whose
manager group has the "permit settings" flag**; everyone else (section editors,
assistants, authors, reviewers, anonymous) is denied the page and gets an
authorization error on the endpoint (live: section editor → page
`roleBasedAccessDenied`, `PUT contexts/{id}` → denied). All grids/managers below sit on
that page, but each brings its own backend gate — and they are not equally tight.

| Action | Who may — and when |
|--------|--------------------|
| **Open Settings → Workflow / save the settings forms** (guidance, disable submissions, metadata, review setup, reviewer guidance, emails) | • Site admins and managers with settings access — the one settings gate above <sup>a</sup> |
| **Manage file components** (add/edit/delete/reorder/restore genres) | • Site admins and managers with settings access — same double gate (role list + settings flag) on every grid operation; a section editor calling a grid URL directly gets a role-denial payload (live) <sup>b</sup> |
| **Look up the component list** (read-only) | • Any editorial-side logged-in user of the journal — site admin, manager, section editor, assistant, author — via the genres lookup the wizard and file managers use <sup>c</sup> |
| **Manage the reviewer-recommendation vocabulary** (add/edit/activate/deactivate/delete options) | • Site admins and managers — through the manager on the Review tab (UI reachable only with settings access)<br>• ⚠ Section editors — **API-only, no UI control**: the recommendations endpoints admit the section-editor role and never check the settings flag, so a section editor whom the page turns away can still **create, edit, deactivate, and delete** the journal's options by direct call — the full write set, not just create (live: page denied, then `POST` → 200 create, `PUT` → 200 edit, `PUT …/status` → 200 deactivate, `DELETE` → 200, all as a section editor). The hole is **specific to the section-editor role**: an assistant/copyeditor is *not* admitted (live: GET and POST → 401). Ledger row 124; detail in Known deviations <sup>d</sup> |
| **See the effects** (checklist/guidance in the wizard, component choices at upload, review defaults at assignment, recommendation options at review completion, ack emails) | • Authors, reviewers, editors in their own features — owned by the downstream specs; this spec only verifies the wiring <sup>e</sup> |

<sup>a</sup> ManagementHandler::authorize() (`CanAccessSettingsPolicy` on the `settings` op) · SettingsHandler::workflow() · PKPContextController `edit()` route gate — verified in journal-masthead-settings
<sup>b</sup> GenreGridHandler::__construct() (roles MANAGER+SITE_ADMIN) · SetupGridHandler::authorize() (`CanAccessSettingsPolicy` + `ContextAccessPolicy`)
<sup>c</sup> GenreController::getGroupRoutes() (roleAuthorizer incl. SUB_EDITOR, ASSISTANT, AUTHOR; GET only)
<sup>d</sup> ReviewerRecommendationController::getRouteGroupMiddleware() (roleAuthorizer SITE_ADMIN+MANAGER+**SUB_EDITOR**; no `CanAccessSettingsPolicy`) · RecommendationAccessPolicy (item routes: same-journal + exists only)
<sup>e</sup> see Cross-feature interactions

## Fields & validation

All forms below save to the journal's settings via the single settings endpoint; rich-text
fields are multilingual (one value per journal language) and none of them is required.
"Save" per form; a green "Saved" toast confirms (live).

### Submission → Disable Submissions

| Field (UI label) | Required? | Rules | Anchor |
|------------------|-----------|-------|--------|
| Disable Submissions (checkbox) | No | Off by default. On: authors can no longer start submissions (rule 3). The helper text links to per-section disabling on the Journal settings page (owned by `sections`) | PKPDisableSubmissionsForm (`disableSubmissions`) |

### Submission → Author Guidance (one form, ten rich-text fields)

| Field (UI label) | Required? | Rules | Anchor |
|------------------|-----------|-------|--------|
| Author Guidelines | No | Shown on the public About → Submissions page (live) | SubmissionGuidanceSettings (`authorGuidelines`) |
| Before you begin | No | Shown at the top of the wizard's start page (live) | `beginSubmissionHelp` |
| Submission Checklist | No | Free HTML (not a list of separate items). Rendered on the wizard start page above a single mandatory "Yes, my submission meets all of these requirements" confirmation, and on About → Submissions (live) | `submissionChecklist` |
| Upload Files / Contributors / Details / For the Editors / Review and Submit | No | Per-step helper texts shown in the corresponding wizard step (Upload Files text live-verified) | `uploadFilesHelp`, `contributorsHelp`, `detailsHelp`, `forTheEditorsHelp`, `reviewHelp` |
| Copyright Notice | No | Shown/agreed at submission; consumption owned by `submission-wizard` / `publication-license` | `copyrightNotice` |
| For Reviewer Suggestion | No | Wizard reviewer-suggestions step helper; the field only exists because OJS enables reviewer suggestions (schema-conditional) | SubmissionGuidanceSettings::addReviewSuggestionGuidanceDetail() (`reviewerSuggestionsHelp`, OJS `schemas/context.json`) |

### Submission → Metadata

Owned by `submission-wizard-metadata` (per-field Enable + don't-ask/ask/require matrix,
16 fields incl. the OJS-only Publisher ID and Article Number extras, competing-interest
requirement, submit-with-categories). Referenced here because it sits on this page;
live re-checked only as an effect-link (scenario 2).

### Submission → Components — the genre form (modal)

| Field (UI label) | Required? | Rules | Anchor |
|------------------|-----------|-------|--------|
| Name | Yes (primary locale) | Multilingual; "nameRequired" on empty | GenreForm (`name`, FormValidatorLocale) |
| File Type: "dependent files" (checkbox) | No | Dependent components (e.g. images inside an HTML galley) are hidden from the wizard's file-type list (live: Multimedia/Image/Style Sheet absent) and not displayed with published content | `dependent` |
| File Type: "supplementary files" (checkbox) | No | Displayed separately from the main publication files; drives the galley/landing grouping owned by `galleys`/`article-landing` | `supplementary` |
| File Variants (checkbox) | No | Marks the component as supporting web/high-resolution variants (used by `media-files`; default only on Image) | `supportsFileVariants` |
| File Metadata (select: Document / Artwork / Supplementary Content) | Yes (defaults Document) | Which metadata set files of this component get | `category` (GENRE_CATEGORY_{DOCUMENT,ARTWORK,SUPPLEMENTARY}) |
| Require with Submissions (radio Yes/No) | Yes (defaults No) | Yes = every new submission must contain at least one file of this component before it can be submitted (rule 7, live) | `required` |
| Key | No | Optional symbolic identifier, ≤30 chars, alphanumeric with `-`/`_`; must be unique within the journal — duplicate → "The key already exists." (live, incl. against soft-deleted components); **read-only for the 12 factory components** (live: input rendered readonly) | GenreForm (`key`, FormValidatorRegExp `/^[a-z0-9]+([\-_][a-z0-9]+)*$/i`, GenreDAO::keyExists(), `keyReadOnly` = Genre::isDefault()) |

### Review → Setup

| Field (UI label) | Required? | Rules | Anchor |
|------------------|-----------|-------|--------|
| Default Review Mode (radio: Anonymous Reviewer/Anonymous Author · Anonymous Reviewer/Disclosed Author · Open) | Defaults to double-anonymous | Pre-selects the review type on every new reviewer assignment (rule 8, live); other values rejected (API `in:1,2,3` → 400, live) | PKPReviewSetupForm (`defaultReviewMode`), `lib/pkp/schemas/context.json` |
| "Make reviewer comments publicly visible with published content" (checkbox) | No (off) | Seeds the per-assignment public-visibility default when a reviewer is assigned; display of public reviews is owned elsewhere | `defaultReviewPublicVisibility`, EditorAction::assignReviewer(), ReviewerForm::initData() |
| Restrict file access (checkbox) | No (off) | Reviewers see review files only after agreeing to review | `restrictReviewerFileAccess`, ReviewerReviewFilesGridDataProvider / SubmissionFileAssignedReviewerAccessPolicy |
| One-click access (checkbox) | No (off) | Review invitation emails carry a secure direct link (no login) | `reviewerAccessKeysEnabled`, OneClickReviewerAccess / ReviewerAccessInvite |
| "Allow authors to suggest potential reviewers…" (checkbox) | No (OJS bootstrap on) | Toggles the wizard's reviewer-suggestions step — the suggestions feature is owned by `reviewer-suggestions`; OJS-only schema field | `reviewerSuggestionEnabled` (OJS `schemas/context.json`) |
| Default Response Deadline (weeks) | No (default 4) | Integer ≥ 0; negative → 400 "must be at least 0" (live). Pre-fills the response-due date on new assignments (today + N weeks, live) | `numWeeksPerResponse` |
| Default Completion Deadline (weeks) | No (default 4) | Same validation; pre-fills the review-due date (live) | `numWeeksPerReview` |
| Minimum Confirmed Reviews Required | No (default 0) | Integer ≥ 0; 0 means "use the application default of 1" at the consuming side (`editorial-dashboards`' "Needs reviews" view, verified there) | `numReviewsPerSubmission`, Context::getNumReviewsPerSubmission(), Submission Repository dashboard-view filter |
| Automated reminder sliders ×4 (Response before/after due, Submission before/after due) | No | UI slider **0–14 days** (live: `aria-valuemin=0`, `aria-valuemax=14`); 0 renders as "disabled" (no reminder). Server accepts any integer ≥ 0 — 99 saves fine via API (live; row 125). Sending is the scheduled `ReviewReminder` task — off in the test env; seam to feature `scheduled-tasks` | PKPReviewSetupForm::addReminderFields() (MIN/MAX_REMINDER_NOTIFICATION_SEND_IN_DAYS), `numDays{Before,After}Review{Response,Submit}ReminderDue` |

### Review → Reviewer Guidance

| Field (UI label) | Required? | Rules | Anchor |
|------------------|-----------|-------|--------|
| Review Guidelines | No | Rendered verbatim as reviewer step 2 "Guidelines" (live) | PKPReviewGuidanceForm (`reviewGuidelines`) |
| Competing Interests | No | When non-empty, reviewer step 1 adds a competing-interests declaration (radio "I do not have any…" / "I may have…" + statement box) with the policy text behind a "review this policy" link (live) | `competingInterests`, PKPReviewerReviewStep1Form |
| "Present a link to how to ensure all files are anonymized…" (checkbox) | No | Shows the anonymity-instructions link on upload surfaces; the instructions content is owned by `review-anonymity` | `showEnsuringLink`, PKPSubmissionFilesUploadBaseForm |

### Review → Reviewer Recommendations — the option form (modal)

| Field (UI label) | Required? | Rules | Anchor |
|------------------|-----------|-------|--------|
| Review Recommendations (title) | Yes (primary locale) | Multilingual text; missing → 422 (live) | ReviewerRecommendationForm (`title`), AddReviewerRecommendation::rules() |
| Recommendation type (select: Approved / Not Approved / Revisions Requested / With Comments) | Yes | The machine-readable class behind the label (drives downstream interpretation of the recommendation); other values → 422 (live) | `type`, ReviewerRecommendationType enum |
| Active Upon Saving / Deactivate (select) | Yes (defaults active) | Inactive options are hidden from reviewers (rule 12) | `status` |

### Emails tab (one form, five groups)

| Field (UI label) | Required? | Rules | Anchor |
|------------------|-----------|-------|--------|
| Email Templates (pointer) | — | Read-only pointer to Manage Emails (owned by `email-templates-management`) | PKPEmailSetupForm::addEmailTemplatesField() |
| Signature | No | Rich text + insertable variables. It renders through the journal-signature template variable, so it appears **only in emails whose template body includes that variable** — in the stock set that is the two submission-acknowledgement templates (the submitting-author ack and the co-author notice; live: marker in the submission-ack body). It is *not* injected into every automated email; the per-sender `{$signature}` variable carried by ~17 other stock templates is a **different** value (the sending user's own profile signature), not this journal setting | `emailSignature` → ContextEmailVariable CONTEXT_SIGNATURE (`{$contextSignature}`); contrast SenderEmailVariable SENDER_CONTACT_SIGNATURE (`{$signature}`); `emails.submissionAck.body`/`emails.submissionAckNotAuthor.body` |
| Submission Confirmation (radio: all authors · submitting author only · do not send) | Defaults "all authors" | Who receives the submission-acknowledgement email; only the three listed values accepted (bogus → 400, live) | `submissionAcknowledgement` (SUBMISSION_ACKNOWLEDGEMENT_* constants), SendSubmissionAcknowledgement listener |
| Notify Primary Contact (radio Yes/No) | No | Only offered when the journal has a principal-contact email (else an inline note links to the Contact form); shown only while a confirmation email is sent at all | `copySubmissionAckPrimaryContact` (showWhen `submissionAcknowledgement`) |
| Notify Anyone (text) | No | Free-text address(es) blind-copied on the acknowledgement (live: delivered as **Bcc**); no email-format validation on the setting | `copySubmissionAckAddress` |
| Notify All Authors (radio: all authors · assigned authors only) | Defaults "all authors" | Recipient scope of editorial-decision notifications — consumed by `editorial-decisions` | `notifyAllAuthors` |
| Editorial statistics (radio on/off) | Defaults on | Monthly editorial-stats email to editors (scheduled task; editors can also unsubscribe in their profile) | `editorialStatsEmail` |
| Bounce Address | Config-gated | Rendered as an input only when `config.inc.php` `allow_envelope_sender` is on; otherwise an explanatory note (live: note shown in this env). Value must be an email when enabled | PKPEmailSetupForm::addEnveloperSenderField(), `envelopeSender` (`email_or_localhost`) |

## Rules & state

1. **Page assembly.** The Workflow page always shows Submission, Publisher Library,
   Emails, and Tasks and Discussions tabs; the **Review tab appears only for apps with a
   review stage** (always true in OJS). Submission side-tabs: Disable Submissions,
   Author Guidance, Metadata, Components, Contributor Roles. Review side-tabs: Setup,
   Reviewer Guidance, Review Forms, and Reviewer Recommendations (the last only where
   the app supports a customizable vocabulary — true in OJS). All verified live.
   (`templates/management/workflow.tpl`, ManagementHandler::workflow(),
   SettingsHandler::workflow(), Application::hasCustomizableReviewerRecommendation())

2. **One endpoint, per-form saves.** Every form on this page except the
   reviewer-recommendation manager PUTs the journal's settings endpoint with only its
   own fields; the multilingual merge/validation semantics are the ones verified in
   `journal-masthead-settings` (per-(setting,locale) merge, primary-locale required
   enforcement only where declared). Saves produce a "Saved" toast, no email, no
   notification, no event-log entry. (FormComponent `action` = `PUT contexts/{id}`)

3. **Disabling submissions.** With the box ticked: the Workflow page itself shows a
   standing banner "This journal is not accepting submissions at this time…" (live);
   an author opening the wizard URL is bounced to a page with the same message and no
   way to start (live); the public About → Submissions page shows the not-accepting
   notice in place of the start-submission call-to-action (live). Navigation-entry
   removal on the public site is owned by `submission-wizard`/`journal-homepage`
   (verified there). The gate is **only on starting a new submission** (verified by
   code): a *draft already in progress* is untouched — the author can still reopen it,
   edit each step, and complete the final Submit, because the disable check lives solely
   on the create-submission call, not on the wizard's resume/step-save/submit paths.
   Existing submitted submissions are likewise untouched. (PKPDisableSubmissionsForm;
   workflow.tpl `disableSubmissions` banner; PKPSubmissionController::add() — the only
   `disableSubmissions` guard; `submit()`/edit paths have none)

4. **Guidance texts flow verbatim.** Checklist + before-you-begin render on the wizard
   start page; the checklist additionally gates the start behind a single mandatory
   "meets all requirements" checkbox (live — the checklist is one HTML block, not
   per-item checkboxes); author guidelines + checklist render on About → Submissions
   (live). Empty fields simply don't render. (SubmissionGuidanceSettings; wizard start
   template; about-pages' Submissions page)

5. **Components are per-journal with 12 factory defaults.** Every new journal gets the
   12 components from the registry (Article Text — the only *required* one — plus 8
   supplementary and 3 dependent ones), localized into the journal's languages (live
   on a fresh scratch journal). Order is manager-sortable ("Order" action, drag rows).
   (`registry/genres.xml`, GenreDAO::installDefaults())

6. **Component deletion is soft, and gated by use.** Deleting a component that has at
   least one submission file attached anywhere in the journal is refused with an alert
   ("Before this component can be deleted, you must associate all related submission
   files with a different component." — live against Article Text). Deleting an unused
   one removes it from the grid and all pickers but only *disables* the row —
   the key stays reserved (a new component with that key → "key already exists"), and
   Restore Defaults can resurrect factory ones. (GenreGridHandler::deleteGenre() +
   `Repo::submissionFile()` count guard; GenreDAO::deleteById() sets `enabled=0`;
   GenreDAO::keyExists() ignores `enabled`)

7. **Restore Defaults is a factory reset of the factory set only.** It re-installs the
   12 registry components: soft-deleted defaults come back, renamed defaults revert to
   their locale-file names, sequence resets — while **custom components survive
   untouched** (live: renamed+deleted "Transcripts" came back pristine, custom "Video
   Abstract" kept). The confirm dialog warns first. **Require with Submissions** is
   enforced at the wizard's Review step: no file of a required component → "You must
   upload at least one Article Text file." error and Submit disabled (live).
   (GenreGridHandler::restoreGenres(), GenreDAO::installDefaults() keyed by `entry_key`;
   wizard Review-step file validation)

8. **Review setup values are defaults, not constraints.** New reviewer assignments are
   born with the journal's default review method pre-selected and response/completion
   due dates of today + the configured weeks (live: Open + 2w/5w → assignment created
   with method 3, dates +14/+35 days); editors can override per assignment
   (`assign-and-manage-reviewers`). Changing the journal defaults never rewrites
   existing assignments. The double-anonymous factory default is the
   `review-anonymity` baseline. (ReviewerForm::initData(), EditorAction::assignReviewer())

9. **Reminder thresholds are day offsets around the two due dates**, 0–14 by slider, 0 =
   that reminder disabled. They only parameterize the scheduled review-reminder task
   (owned by `scheduled-tasks`; the runner is off in the test env, so sending is
   untestable here — code-anchored only). (PKPReviewSetupForm::addReminderFields(),
   ReviewReminder task)

10. **Reviewer-recommendation vocabulary: six seeded options.** Journal creation seeds
    Accept Submission, Revisions Required, Resubmit for Review, Resubmit Elsewhere,
    Decline Submission, See Comments — all active, each mapped to a machine-readable
    type, titles copied per journal language from the locale files (live on scratch;
    a journal language added later back-fills titles only if the stored title still
    equals the stock translation). (Repository::addDefaultRecommendations(),
    ::setLocalizedDataOnNewLocaleAdd(), ReviewerRecommendationsMigration)

11. **In-use options are locked.** An option referenced by any review assignment in the
    journal loses its row menu entirely (live: the completed review's "Accept
    Submission" row has no kebab while all others do), and the backend refuses edit and
    delete with a not-acceptable error (live: PUT/DELETE → 406). Deactivation remains
    allowed even in use (live: status PUT → 200). Unused options — including the seeded
    defaults — can be renamed, retyped, or **hard-deleted** (live: "Resubmit Elsewhere"
    deleted, DB row gone — unlike soft-deleted components).
    (ReviewerRecommendation::removable() — existence check against review assignments;
    ReviewerRecommendationController::edit()/delete(); ReviewerRecommendationManager.vue
    `v-if="item.removable"`)

12. **Reviewers see exactly the active options.** The recommendation dropdown at review
    completion offers the active options only (live: custom "Fast-Track Accept" present;
    deactivated "See Comments" and deleted "Resubmit Elsewhere" absent). A review
    already completed with a since-deactivated option keeps displaying it (the option
    is added back for that assignment). (Repository::getRecommendationOptions(),
    PKPReviewerReviewStep3Form; `reviewer-response` owns the completion step)

13. **Acknowledgement routing.** Submission Confirmation = all authors / submitting
    author / off selects the recipient set of the submission-ack email;
    "Notify Anyone" is delivered as a **Bcc** on that email, and the primary-contact
    copy rides the same message — so with confirmation off, neither copy is sent (the
    two copy fields are hidden in the UI when "do not send" is selected). The journal
    signature is appended to this ack (live: marker in body) — and, more generally, to
    any email whose template carries the journal-signature variable, which in the stock
    set is just the two acknowledgement templates (see the Signature field row). It is
    *not* on every automated email. (SendSubmissionAcknowledgement, PKPEmailSetupForm
    `showWhen`, ContextEmailVariable CONTEXT_SIGNATURE = `{$contextSignature}`)

## Side effects

None of the saves on this page sends mail, raises a notification, or writes an event-log
entry — the observable side effects are all *downstream* consumptions of the stored
settings (wizard rendering, assignment defaults, ack-email routing), listed per rule
above and owned by the features in Cross-feature interactions.

## Settings that modify behavior

- `config.inc.php` `allow_envelope_sender` — turns the Emails tab's Bounce Address from
  an explanatory note into an editable field (rule: Fields table; live: note variant).
- Scheduled-task runner (`task_runner`/cron) — without it the reminder thresholds and
  the editorial-stats email configure nothing observable (`scheduled-tasks`).
- Journal languages (`languages` feature) — define the locale columns of every
  multilingual field here, and drive the back-fill rule for seeded recommendation
  titles (rule 10).
- This page IS the settings surface — its own fields are the "settings that modify
  behavior" of half a dozen other features.

## Cross-feature interactions

- **submission-wizard / submission-wizard-metadata** — consume checklist, guidance
  texts, disableSubmissions, and the entire Metadata tab (the metadata matrix and its
  two settings-form atoms are owned by `submission-wizard-metadata`; feature 2 verified
  the require-recheck semantics). This spec verified one require-flip end-to-end.
- **submission-files / galleys / media-files / article-landing** — consume components:
  wizard file-type list (non-dependent only), primary-vs-supplementary display, file
  variants. The read-only genres API claimed here is their lookup.
- **review-forms** — the Review Forms side-tab (feature 13, verified); shares nothing
  with the setup form beyond the page.
- **assign-and-manage-reviewers / editorial-dashboards** — consume review-setup
  defaults (method, deadlines, minimum-reviews fallback 0→1 verified by feature 6).
- **review-anonymity** — owns anonymity semantics; the factory double-anonymous default
  and the ensuring-anonymity link content live there.
- **reviewer-suggestions** — owns the suggestions feature its toggle (on this form)
  enables.
- **reviewer-response / recommend-only-editors** — reviewer recommendation *usage*;
  the OPTIONS vocabulary is owned here (seam confirmed by feature 15's spec).
- **email-templates-management (feature 60)** — owns Manage Emails (templates +
  mailables). Boundary: the Workflow → Emails tab (this spec) holds the journal's
  notification *configuration* (signature, ack routing, decision recipients, stats,
  bounce); the Manage Emails page holds the *templates*. The tab's first field is just
  a pointer there.
- **tasks-discussions** — owns the Tasks and Discussions templates tab.
- **contributors** — owns the Contributor Roles tab (CRediT manager).
- **document-library** — owns the Publisher Library tab.
- **journal-masthead-settings** — canonical home of the settings gate + settings-PUT
  validation semantics referenced throughout.
- **scheduled-tasks** — executes reminders and the stats email configured here.

## Canonical scenarios

1. **Author guidance reaches the author** — Manager: edits Author Guidelines,
   Before-you-begin and Submission Checklist (Author Guidance tab), saves. An author
   starting a submission sees the new texts on the wizard start page and must tick the
   checklist confirmation; the public About → Submissions page shows the guidelines and
   checklist. (Live 2026-07-06, scratch `j-wfs2`.)

2. **Metadata require-flip bites in the wizard** — Manager: sets Keywords to
   "Require…" on the Metadata tab. The author's Details step marks Keywords required
   and the Review step blocks submit with "This field is required." until a keyword is
   entered (full matrix owned by `submission-wizard-metadata`). (Live.)

3. **Component lifecycle** — Manager: adds "Video Abstract" (supplementary, custom key;
   duplicate key rejected), renames a factory component (key read-only), deletes an
   unused one (soft), is refused on an in-use one (alert), then Restore Defaults —
   factory set reverts, the custom component survives. The author's next upload offers
   Video Abstract among the file types; a submission whose only file is Video Abstract
   is blocked for the missing required Article Text. (Live.)

4. **Review defaults flow into a new assignment** — Manager: sets Open review, 2-week
   response, 5-week completion; saves (negative weeks and out-of-range mode are
   rejected). Add Reviewer on a review-stage submission opens pre-set to Open with due
   dates +2w/+5w; the created assignment carries them. (Live.)

5. **Reviewer guidance reaches the reviewer** — Manager: writes Review Guidelines and a
   Competing Interests policy. The reviewer's step 1 now demands a CI declaration (policy
   readable from the link) and step 2 shows the guidelines verbatim. (Live.)

6. **Recommendation vocabulary round-trip** — Manager: on a journal with the six seeded
   options and one already-used one ("Accept Submission" — no row menu), adds
   "Fast-Track Accept" (Approved), deactivates "See Comments", deletes "Resubmit
   Elsewhere"; the in-use option refuses edit/delete (406) but toggles status. A
   reviewer completing a review picks from exactly: the four remaining defaults plus
   Fast-Track Accept. (Live.)

7. **Acknowledgement routing and signature** — Manager: sets Submission Confirmation to
   "all authors", a Notify-Anyone address, and a signature. A real submission produces
   one ack email to the author with the extra address in Bcc and the signature in the
   body. Bounce Address stays a note unless the site config allows envelope senders.
   (Live via Mailpit.)

8. **Permission boundary** — Section editor: Settings → Workflow → denied; a genre-grid
   URL → role denial; `PUT contexts/{id}` → denied. ⚠ But `POST
   reviewers/recommendations` → 200 and the option appears in the manager's list —
   the API-only hole of Known deviations (row 124). Manager-without-settings-flag
   behaves per the verified Area 6 gate. (Live.)

## Known deviations (as-built ≠ intent)

- ⚠ **Reviewer-recommendation options are mutable by section editors, API-only, and
  skip the settings gate** (`docs/e2e/app-changes.md` row 124). The endpoints admit
  ROLE_ID_SUB_EDITOR and add no `CanAccessSettingsPolicy`, so (a) a section editor who
  cannot open any settings page can create/edit/delete/deactivate the journal-wide
  vocabulary by direct call — verified as a **full write set**, not just create (live
  re-verify 2026-07-06 on scratch `wfv`: section editor `POST` → 200, `PUT` → 200,
  `PUT …/status` → 200, `DELETE` → 200), and (b) by the same gap a manager stripped of
  the settings flag retains API access. The over-permission is **section-editor-specific**:
  an assistant is *not* in the role list (live: GET/POST → 401), and the sibling genre
  API is read-only (no write route at all), so this is the one settings-config resource
  with a write hole. The **in-use lock is orthogonal and holds server-side for every
  role**: editing or deleting an option referenced by a review assignment returns
  not-acceptable even for a section editor (live: SE `DELETE`/`PUT` on an in-use option
  → 406), so the hole does not let a section editor destroy in-use vocabulary — it is a
  config-write over-permission, not an integrity bypass. No UI offers any of this.
  Suspected copy of the per-submission reviewer-suggestions controller's role list onto
  a journal-settings resource. Same shape as row 114 (user-management).
- ⚠ **Reminder-threshold bounds are client-side only** (row 125). The sliders enforce
  0–14 days but the schema only enforces ≥ 0 — an API client can store 99 (live), which
  the UI can then neither display nor reproduce. LOW; recorded for symmetry with rows
  119/123.

**Verifier re-confirmation (2026-07-06).** Independently re-drove the two ledger rows on
fresh scratch `wfv` journals and attacked the permission/state claims. **Row 124** re-verified
and its scope tightened: the section-editor hole is the **full CRUD write set** (POST/PUT/
PUT-status/DELETE all → 200), **not** just create; an **assistant is denied** (GET/POST → 401),
so the hole is section-editor-specific; the sibling **genre API has no write route** (GET-only;
a POST → 500/no-route), so recommendations is the lone settings resource with a config-write
hole — contrast the properly double-gated genre grid. The **in-use lock is server-enforced for
every role** (section editor DELETE/PUT on an in-use option → 406), so the over-permission is a
config-write concern, not a data-integrity bypass — no new higher-severity ledger row warranted.
**Row 125** re-verified (reminder `99` stored → 200; `-1` → 400 "at least 0"). Two spec
corrections from the attack, both now folded in: (i) the **journal signature is NOT on every
automated email** — it renders through `{$contextSignature}`, present in only the two stock
acknowledgement templates; the 17 `{$signature}` templates carry the *sender's own* profile
signature, a different variable (Fields Signature row + rule 13 corrected); (ii) **disableSubmissions
gates only new-submission creation** — an in-progress draft can still be resumed, edited, and
submitted (the guard lives solely on `PKPSubmissionController::add()`; rule 3 corrected). Rule 8's
default-review-mode flow holds for **all three** modes, not just the tested Open: `ReviewerForm::initData()`
reads `defaultReviewMode` generically (fallback double-anonymous = the schema default 2). Atlas: all
**26 claimed atoms** single-owned by this spec, no double-claim; `FORM-access-form` hint correctly
points to `distribution-settings` (feature 59) and is unclaimed (no orphan); `FORM-pkp-email-setup-form`
single-owned here, but the **FEATURE-MAP entry for `email-templates-management` still listed
`pkp-email-setup`** among its atoms — corrected so feature 60 does not collide. Scratch residue:
several `wfv…` journals; `publicknowledge` untouched (endpoints refuse the anonymous verifier key,
no seed mutated). No finding contradicts the retained `workflow-settings.spec.js` (not modified).

## Open questions

1. Is section-editor access to the reviewer-recommendation endpoints intended for some
   planned UI, or a role-list slip (row 124)? One-word answer decides whether the spec's
   permission row becomes a plain rule.
2. Restore Defaults silently overwrites manager renames/re-flagging of factory
   components (rule 7) with only a generic confirm ("restore the default… settings?").
   Intended factory-reset semantics, or should the confirm enumerate what will be lost?
3. The genre soft-delete keeps the key reserved forever (rule 6) — deliberate (stable
   keys for import/export) or an artifact worth a "reuse key of deleted component"
   allowance?
4. `copySubmissionAckAddress` takes free text with no email validation and is delivered
   as Bcc — is multi-address input (comma list) supported intent? (Single address
   live-verified only.)

---

## Reference — entry points & surfaces

| Entry | Path | Atom |
|-------|------|------|
| Workflow settings page | `{journal}/management/settings/workflow` (Settings → Workflow) | PAGE-management-settings-workflow |
| Author guidance form | Workflow → Submission → Author Guidance | FORM-submission-guidance-settings |
| Disable submissions form | Workflow → Submission → Disable Submissions | FORM-pkp-disable-submissions-form |
| Components grid | Workflow → Submission → Components (`grid.settings.genre.GenreGridHandler` ops fetchGrid/addGenre/editGenre/updateGenre/deleteGenre/restoreGenres/saveSequence) | GRID-lib-pkp-grid-settings-genre-genre-grid-handler |
| Genre lookup API | `GET api/v1/{journal}/genres`, `GET …/genres/{genreId}` | API-genre-get-many, API-genre-get |
| Review setup form | Workflow → Review → Setup | FORM-pkp-review-setup-form |
| Reviewer guidance form | Workflow → Review → Reviewer Guidance (OJS subclass adds nothing) | FORM-pkp-review-guidance-form, FORM-review-guidance-form |
| Reviewer recommendations manager | Workflow → Review → Reviewer Recommendations (Vue) | VUE-reviewer-recommendation-manager |
| Recommendation option form | Add/Edit Recommendation modal | FORM-reviewer-recommendation-form |
| Recommendations API | `GET/POST api/v1/{journal}/reviewers/recommendations`, `GET/PUT/DELETE …/{id}`, `PUT …/{id}/status` | API-reviewer-recommendation-{get,get-many,add,edit,update-status,delete} |
| Recommendations API guards | RecommendationAccessPolicy → RecommendationRequiredPolicy + RecommendationContextPolicy | AUTHZ-recommendation-{access,required,context}-policy |
| Emails setup form | Workflow → Emails | FORM-pkp-email-setup-form |
| Storage — components | `genres` + `genre_settings` | DB-genres, DB-genre_settings |
| Storage — recommendation options | `reviewer_recommendations` + `reviewer_recommendation_settings` | DB-reviewer_recommendations, DB-reviewer_recommendation_settings |
| Factory component names | `default.genres.*` locale keys | LOC-default-default-genres |

Referenced, owned elsewhere: Metadata settings forms (`submission-wizard-metadata`),
Review Forms grid (`review-forms`), Publisher Library grid (`document-library`),
Contributor Roles manager (`contributors`), Task templates manager
(`tasks-discussions`), `DB-review_assignment_settings` (`assign-and-manage-reviewers`),
`FORM-access-form` (mounts on Settings → Distribution — `distribution-settings`,
FEATURE-MAP hint corrected).

## Reference — code anchors

- `pages/management/SettingsHandler.php` — OJS `workflow()` (adds review forms +
  recommendations panel) over `lib/pkp/pages/management/ManagementHandler.php`
  `workflow()` / `addReviewFormWorkflowSupport()`.
- `lib/pkp/templates/management/workflow.tpl` — tab map + hooks
  (`Template::Settings::workflow*`).
- Forms: `lib/pkp/classes/components/forms/submission/SubmissionGuidanceSettings.php`,
  `…/context/PKPDisableSubmissionsForm.php`, `…/PKPReviewSetupForm.php`,
  `…/PKPReviewGuidanceForm.php` (+ OJS `ReviewGuidanceForm`),
  `…/PKPEmailSetupForm.php`; schema `lib/pkp/schemas/context.json` +
  OJS `schemas/context.json`.
- Components: `lib/pkp/controllers/grid/settings/genre/GenreGridHandler.php`,
  `…/form/GenreForm.php`, `lib/pkp/classes/submission/GenreDAO.php`,
  `lib/pkp/classes/submission/Genre.php`, `registry/genres.xml`,
  `lib/pkp/api/v1/genres/GenreController.php`.
- Recommendations: `api/v1/reviewers/recommendations/ReviewerRecommendationController.php`
  (+ formRequests + resource), `classes/components/forms/context/ReviewerRecommendationForm.php`,
  `classes/components/listPanels/ReviewerRecommendationsListPanel.php`,
  `lib/pkp/classes/submission/reviewer/recommendation/{ReviewerRecommendation,Repository}.php`,
  `lib/ui-library/src/managers/ReviewerRecommendationManager/ReviewerRecommendationManager.vue`,
  `classes/migration/install/ReviewerRecommendationsMigration.php`.
