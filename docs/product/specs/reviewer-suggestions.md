---
name: reviewer-suggestions
scope: Authors propose potential reviewers while submitting; the editorial team sees the proposals at review time and can assign a reviewer straight from one
shared: pkp-lib
status: verified
atlas-claims:
  - API-reviewer-suggestion-get
  - API-reviewer-suggestion-get-many
  - API-reviewer-suggestion-add
  - API-reviewer-suggestion-edit
  - API-reviewer-suggestion-delete
  - VUE-reviewer-suggestion-manager
  - VUE-reviewer-suggestions-list-panel
  - FORM-reviewer-suggestions-form
  - DB-reviewer_suggestions
  - DB-reviewer_suggestion_settings
---

# Reviewer suggestions

## Purpose

Authors often know best who is qualified to review their work. When a journal turns
on **Reviewer Suggestion at Submission** (a review-settings checkbox), the submission
wizard gains a **Reviewer Suggestions** step where the submitting author proposes any
number of potential reviewers — name, email, affiliation and a written reason — before
completing the submission. The proposals are frozen at the moment of submission and
become input for the editorial team: a **"Reviewers Suggested by Author"** panel on
the submission and review stages of the workflow page, and a **"Select a Reviewer
from Reviewer Suggestions"** block at the top of the Add Reviewer picker. Assigning a
suggested person — from the suggestion or independently — marks the suggestion as
used, and it drops out of the to-consider lists. Suggestions never generate emails or
notifications; they are a quiet, structured hand-off from author to editor.

## Actors & permissions

Terms: a **draft** is a submission whose wizard has not yet been completed (not
submitted); a suggestion is **open** until an assignment consumes it, then **used**
(neither word ever appears on screen — rule 4 says what is actually visible).
Two baselines apply to every row: **Site Administrators** act with full managerial
reach on any journal; **anonymous visitors, Readers and Reviewers** have no access to
suggestions anywhere — a suggested (or assigned) reviewer is never shown that they
were suggested, or by whom. <sup>a</sup>

| Action | Who may — and when |
|--------|--------------------|
| **Add / edit / delete a suggestion** | • The submitting Author — on their own draft, in the wizard's Reviewer Suggestions step, until they press Submit<br>• Journal Manager, Site Administrator — on any draft in the journal, through the same wizard step (verified by opening another author's draft's wizard directly: add, edit and delete all work; finding drafts to open is the editorial-dashboards spec's business)<br>• A Section Editor assigned to the draft — likewise<br>• **No one** — once the submission is submitted: every screen drops the controls and the server refuses changes for every role, managers included (rule 3) <sup>b</sup> |
| **View during the wizard** | • The same people who can edit the draft — as the step's list and again in the final Review recap <sup>c</sup> |
| **View after submission** | • Journal Manager, Site Administrator — the workflow-page panels and the Add Reviewer block<br>• Section Editor — the same, when assigned to the submission<br>• Assistant — ⚠ no workflow panel, and an error dialog to dismiss first: on a suggestions-enabled journal the workflow page greets an assigned Assistant with a blocking error dialog ("The current role does not have access to this operation.") and the suggestions panel never appears for them; once the dialog is dismissed, Add Reviewer works normally and its picker block does list the open suggestions — though that block will not refresh for them without a full page reload (Known deviations)<br>• The Author — nowhere: their tracking view has no suggestions area, so the author never sees the list again after submitting <sup>d</sup> |
| **Assign a reviewer from a suggestion** | • Whoever may add reviewers on the review stage (that permission matrix is owned by assign-and-manage-reviewers); the panel's per-row action additionally appears only while the submission currently sits in review <sup>e</sup> |

<sup>a</sup> ReviewerSuggestionController::getRouteGroupMiddleware() (roles: SITE_ADMIN, MANAGER, SUB_EDITOR, AUTHOR — no REVIEWER/ASSISTANT/READER); SubmissionAccessPolicy; live-probed 2026-07-11 (Reviewer: no suggestion surface on the reviewer page or dashboard; the editorial workflow URL redirects to authorizationDenied; API list/get/add all 401 roleBasedAccessDenied) ·
<sup>b</sup> ReviewerSuggestionController::authorize() — SubmissionIncompletePolicy on add/edit/delete only; SubmissionAccessPolicy (author = own submission; sub-editor = assigned; manager/admin = all); live-probed 2026-07-11 (Journal Manager full CRUD on another author's incomplete draft via UI and API, suggestingUserId recorded as the manager; post-submit add/edit/delete → 401 `user.authorization.submission.complete.reviewerSuggestionRestrict` for author and manager alike) ·
<sup>c</sup> PKPSubmissionHandler::getReviewerSuggestionsStep(); templates/submission/review-reviewer-suggestions.tpl; live-probed 2026-07-11 ·
<sup>d</sup> workflowConfigEditorialOJS.js getSecondaryItems() (submission + review stages); PKPSelectReviewerListPanel::getConfig() (block data embedded server-side); no suggestions surface in the author workflow config; live-probed 2026-07-11 (manager panel renders read-only; the author tracking view has no panel; the author's wizard URL on a submitted submission shows "Submission complete" with no wizard; the author's API *read* access survives with no UI surface — GET list 200 post-submit; Assistant evidence in Known deviations, RS-A — arbitrated 2026-07-11) ·
<sup>e</sup> reviewerSuggestionManagerStore.js atActiveReviewStage(); useReviewerSuggestionManagerActions.js; live-probed 2026-07-11

## Fields & validation

The wizard step shows a **Reviewer Suggestions** list with an **"Add Reviewer
Suggestion"** button; adding or editing opens a side panel with this form and a
"Save" button. The name, affiliation and reason fields are multilingual: each shows
a box for the journal's primary language — the language the journal's settings mark
as its default — with the other accepted languages' boxes collapsed by default
behind the field's language button. Only the primary language is enforced: a
required field left empty answers "This field is required." on its primary-language
box only, and a primary-language-only save succeeds (the other languages' boxes stay
optional). An error summary above the form offers a "Go to …" link per failed
field. <sup>g</sup>

| Field (UI label) | Required? | Rules |
|------------------|-----------|-------|
| **Given Name** | Yes | Free text <sup>h</sup> |
| **Family Name** | No | Free text — the one name field with no required marker and no empty-save error <sup>i</sup> |
| **Email** | Yes | Must be a valid email address, and no two suggestions on the same submission may share one (the same person can be suggested on different submissions). ⚠ A duplicate is refused on the Email field with the raw framework wording "The email has already been taken." (Known deviations) <sup>j</sup> |
| **ORCID iD** | No | Only offered when the journal has ORCID functionality enabled (turning that on is the orcid spec's business) — it then appears between Email and Affiliation. An invalid value is refused with: The ORCID iD you specified is invalid. Please include the full URI (e.g. "https://orcid.org/0000-0002-1825-0097"). ⚠ Collected but never shown or reused anywhere afterwards — the create-a-new-reviewer form it could feed has no ORCID field at all (Open questions) <sup>k</sup> |
| **Affiliation** | Yes | Free text <sup>l</sup> |
| **Reasons for suggesting reviewer** | Yes | Rich text; the field's help text asks the author to explain the recommendation and disclose any potential conflict of interest <sup>m</sup> |

There is no minimum or maximum count — the step may be left empty (see rule 2).
The system records who made each suggestion and on which submission, though no
screen ever shows it (not verifiable from the screens — this spec uses that marker
for behavior the system records or enforces but never displays; such claims were
checked below the UI, through the service interface, with the specifics in each
claim's footnote). The person's existing user account, if their email matches one,
is detected automatically and steers the editor's assign action later (rule 8).

<sup>g</sup> ReviewerSuggestionsForm (fields, `isMultilingual`); AddReviewerSuggestion (HasMultilingualRule; allowed locales = supported form locales + site primary); live-probed 2026-07-11 (empty save on a bilingual journal: errors on the primary-locale boxes of the four required fields only; secondary-locale boxes error-free and collapsed by default behind each field's language expander; primary-only save accepted; summary "Go to <field>: This field is required." + "Jump to next error"; "* Required" markers on the four required fields) ·
<sup>h</sup> `givenName` required; live-probed 2026-07-11 ·
<sup>i</sup> `familyName` 'sometimes'; live-probed 2026-07-11 (no marker, no empty-save error) ·
<sup>j</sup> `email` required|email|unique per submission_id (AddReviewerSuggestion::rules(), EditReviewerSuggestion::rules() ignores own id); live-probed 2026-07-11 (duplicate on the same submission → verbatim "The email has already been taken.") ·
<sup>k</sup> `orcidId` nullable|'orcid' rule; field added only if OrcidManager::isEnabled(); CreateReviewerForm has no ORCID input; not rendered by any panel; live-probed 2026-07-11 (both branches: orcidEnabled=0 → no field; orcidEnabled=1 → "ORCID iD" between Email and Affiliation, optional, invalid-value message verbatim as quoted) ·
<sup>l</sup> `affiliation` required; live-probed 2026-07-11 ·
<sup>m</sup> `suggestionReason` required; FieldRichTextarea; label/description keys reviewerSuggestion.suggestionReason(.description); live-probed 2026-07-11

## Rules & state

**The wizard step**

1. When the journal setting is on, the wizard runs **Upload Files → Details →
   Contributors → For the Editors → Reviewer Suggestions → Review** — the step sits
   between For the Editors and Review, titled "Reviewer Suggestions" (the page is
   headed "Make a Submission: Reviewer Suggestions"). The submission-wizard spec owns
   the wizard shell; this step's content is: on the left, the step title over the
   journal's configurable help text (Settings section); on the right, a list panel
   titled "Reviewer Suggestions" with the add button, reading "No items found." until
   the first entry. Each saved entry shows the person's name with their affiliation
   beside it and their email underneath, with **Edit** and **Delete** buttons.
   Deleting opens a confirmation dialog titled "Delete Reviewer Suggestion" — "Are
   you sure you want to remove this suggestion? This action can not be undone." —
   whose confirm button repeats "Delete Reviewer Suggestion" (styled as destructive)
   beside "Cancel". <sup>a</sup>
2. **The step is optional.** Zero suggestions is accepted: the final Review step then
   shows a warning notice — "No reviewers have been suggested for this submission." —
   but pressing Submit still completes the submission. With suggestions present, the
   Review recap's "Reviewer Suggestions" panel (with an Edit button leading back to
   the step) lists each person's name, email and affiliation — not the
   reason. <sup>b</sup>
3. **Submission freezes the list.** From the moment the wizard is completed, no role
   can add, change or remove a suggestion: the wizard itself is gone — revisiting its
   address now just reports "Submission complete" (bookmark the wizard's address
   before submitting if you want to check this) — and the editorial screens that show
   suggestions are display-only. The refusal wording, "Add, update or delete of
   reviewer suggestion for completed submission is restricted.", appears on no
   screen: with every control gone there is nothing left to click, so the message
   guards only direct service calls — for the author and for managers alike (not
   verifiable from the screens). The frozen list stays readable to the editorial
   team as a snapshot of what the author proposed. (The submission-wizard spec's save-for-later
   loophole — reopening a submitted wizard — is ledger row 176 and could reopen this
   window too; and the step-progress marker it stores for this step is off-list,
   ledger row 174 — both owned there.) <sup>c</sup>

**Suggestion lifecycle**

4. A suggestion has exactly two states: **open** and **used** — words that never
   appear on any screen. The only visible signal is presence on or absence from the
   review-stage panel and the Add Reviewer block; the submission-stage panel always
   shows every suggestion identically, used or not (⚠ Known deviations). A suggestion
   becomes used the moment a reviewer assignment consumes it (rules 9–10); the used
   mark records when, by whom, and which reviewer account resulted, and can never be
   cleared or overwritten afterwards — none of that recorded detail is shown anywhere
   (not verifiable from the screens). Used is permanent even when the work is undone:
   cancelling or unassigning the review assignment that consumed the suggestion does
   not reopen it — it stays used, and beyond the row staying absent from the open
   lists, that permanence too is not verifiable from the screens. There is no
   decline/dismiss state — an open suggestion the editors ignore simply stays open
   forever (Open questions). <sup>d</sup>
5. Suggestions are deleted together with their submission; deleting a user account
   involved with one (the suggester, the approver, the resulting reviewer) leaves the
   suggestion in place with that link blanked — cleanup that is not verifiable from
   the screens, since none of those links is ever displayed (rule 4). <sup>e</sup>

**What the editorial team sees**

6. **Workflow panels** — a "Reviewers Suggested by Author" panel appears in the side
   column of the workflow page, directly below the Participants panel, on two stages,
   whenever the journal setting is on and there is something to show (the panel hides
   entirely when its list is empty):
   - **Submission stage**: every suggestion, used or not — each row shows initials
     avatar, full name, affiliation and the author's reason. Read-only.
   - **Review stage**: shown only once a review round is selected — clicking the bare
     stage name shows no panel, which is the screen working as designed, not a
     missing panel: the list is scoped to a round, so pick one first. It lists only
     suggestions not yet used; each row gains a "…" actions menu whose single item
     is **Add Reviewer** — but only while
     the submission's current stage is the review stage being viewed. Looking back at
     a round from copyediting shows the same open suggestions with the action menus
     gone. <sup>f</sup>
7. **Add Reviewer picker block** — while assigning a reviewer (assign-and-manage-
   reviewers owns the picker itself), a list titled "Select a Reviewer from Reviewer
   Suggestions" sits above the "Locate a Reviewer" search, showing each open
   suggestion's name, affiliation and reason with a **Select Reviewer** button. Used
   suggestions disappear from the block. A suggested person who is already assigned
   to this review round is shown locked with the notice "This reviewer has already
   been assigned to this review round." instead of the button — the same sentence the
   regular candidate list uses. <sup>g</sup>
8. **The suggested email steers the assign action.** Both entry points (rules 6–7)
   route by whether the suggestion's email matches an existing user:
   - matches a user who already holds the Reviewer role → the normal assignment form
     opens with that person already shown as the "Selected Reviewer" and no search
     list to pick from;
   - matches a user without the Reviewer role → the "Enroll an Existing User as
     Reviewer" form opens with that user prefilled and the enroll-as role preset to
     Reviewer;
   - matches no account → the "Create New Reviewer" form opens with the suggestion's
     given name, family name, email and affiliation prefilled (⚠ never the ORCID iD —
     the form has no such field).
   The forms themselves — dates, message, review type, and the rest — behave exactly
   as assign-and-manage-reviewers specifies; a suggestion only chooses the variant
   and prefills identity. A suggestion that is already used refuses to open a form —
   ⚠ but from a stale screen (e.g. the same review stage open in two windows: assign
   the suggested person in one, then act on the other window's not-yet-refreshed
   row) this refusal surfaces as the generic failure dialog "An unexpected error has
   occurred. Please reload the page and try again." followed by
   an empty Add Reviewer window left open behind it (Known deviations). <sup>h</sup>

**Becoming "used"**

9. Completing the assignment marks the suggestion used and records the resulting
   reviewer; the row disappears from the review-stage panel and the picker block
   immediately, without a page reload. This works across all three variants of rule
   8 — including create-and-assign, where the brand-new account is recognized as the
   suggested person. <sup>i</sup>
10. **Independent assignments count too.** The match is by email, not by which button
    the editor pressed: assigning a reviewer through the ordinary search (or any
    other path) whose email equals an open suggestion's email marks that suggestion
    used as well. ⚠ One edge escapes: this match cares about the email's
    letter-case even though the system's account detection does not — a suggestion
    whose email differs from the account's only by capitalization still steers the
    assign action to the right person (rule 8), but is never marked used when that
    person is assigned through the ordinary search, so it stays open forever (Known
    deviations). <sup>j</sup>

**Visibility boundaries**

11. Reviewers can never see reviewer suggestions — not the panel, not the block, not
    who suggested them (they have no access to any suggestion surface). What a
    reviewer may learn about authors and other reviewers once assigned is
    review-anonymity's matrix; nothing in this feature leaks the suggestion to
    them. <sup>k</sup>

<sup>a</sup> PKPSubmissionHandler::getSteps(), getReviewerSuggestionsStep() (step id/name; `reviewerSuggestionsHelp` description), getReviewerSuggestionsListPanel(); ReviewerSuggestionsListPanel.vue (add/edit/delete, dialog grid.action.deleteReviewerSuggestion.confirmationMessage); ReviewerSuggestionsEditModal.vue; live-probed 2026-07-11 (rail order, page heading, list layout — name + affiliation badge + email subtitle, "No items found." empty state — and the delete dialog's title, message and button labels verbatim) ·
<sup>b</sup> no reviewer-suggestion check in Repository::validateSubmit(); review-reviewer-suggestions.tpl (submission.wizard.noReviewerSuggestions warning; name/email/affiliation columns); live-probed 2026-07-11 (warning verbatim; zero-suggestion submit succeeds; recap shows name/email/affiliation, no reason) ·
<sup>c</sup> SubmissionIncompletePolicy on add/edit/delete (ReviewerSuggestionController::authorize()); wizard spec ledger rows 174/176; live-probed 2026-07-11 (post-submit add/edit/delete refused 401 for author and Journal Manager, errorMessage as quoted; GET list still 200 for manager and author; author wizard URL renders "Submission complete") ·
<sup>d</sup> ReviewerSuggestion::isApproved(), approvedAt()/reviewerId() set-once attributes, approveAndAttachReviewer(); live-probed 2026-07-11 (used vs open visually indistinguishable on the submission-stage panel; approval metadata rendered nowhere; cancel/unassign permanence live-verified 2026-07-11 — cancelling the consuming review assignment leaves the suggestion used, absent from the review-stage panel and picker block, approval metadata intact) ·
<sup>e</sup> reviewer_suggestions FKs: submission_id cascade; suggesting_user_id/approver_id/reviewer_id set-null (ReviewerSuggestionsMigration); adversarially re-verified 2026-07-11 ·
<sup>f</sup> workflowConfigEditorialOJS.js getSecondaryItems() (`isReviewerSuggestionEnabled`; review stage requires a selected round); ReviewerSuggestionManager.vue (v-if list length; heading editor.submission.reviewerSuggestions); reviewerSuggestionManagerStore.js (approved=false + used filter with a round; atActiveReviewStage() gates actions); live-probed 2026-07-11 (panel directly below Participants; row = avatar + name + affiliation + rendered reason; submission stage zero buttons; empty → panel absent; review stage "…" menu aria "<Full Name> More Actions" with single item "Add Reviewer"; look-back from copyediting on Review Round 1 → list shown, menus gone; bare "Review" click → no panel) ·
<sup>g</sup> PKPSelectReviewerListPanel::getConfig() (`reviewerSuggestionEnabled` gate; open suggestions only; title editor.submission.findAndSelectReviewerFromSuggestions); SelectReviewerListPanel.vue; SelectReviewerSuggestionListItem.vue (currentlyAssigned lock, reviewer.list.currentlyAssigned); live-probed 2026-07-11 (block above "Locate a Reviewer"; reason rendered per row; used rows absent; lock message verbatim) ·
<sup>h</sup> useReviewerSuggestionManagerActions.js + SelectReviewerSuggestionListItem.vue select() (selectionType by existingUserId/hasExistingReviewerRole); AdvancedSearchReviewerForm::initData(); EnrollExistingReviewerForm::initData(); CreateReviewerForm::initData() (no ORCID field on the form); PKPReviewerGridHandler::getReviewerForm() (throws on approved/invalid suggestion id → empty-body 500, fired twice); live-probed 2026-07-11 (all three variants observed with the quoted form titles and prefills; stale used-suggestion action → generic error dialog + stranded empty modal shell, stale row persists until reload) ·
<sup>i</sup> ReviewerForm::execute() → ReviewerSuggestion::approveAndAttachReviewer() (timestamp, approver = acting user, reviewer id); existing-user + role check passes post-create/enroll; live-probed 2026-07-11 (row drops from review-stage panel and picker block live, no reload; stays on submission-stage panel) ·
<sup>j</sup> ReviewerForm::execute() fallback lookup withEmail(reviewer email), withApproved(false), scoped to the submission; consumption additionally requires the suggested email to resolve to the very account being assigned AND that account to hold the Reviewer role at that moment (guard: hasExistingReviewerRole && existingUser->getId() == $reviewerId) — editing the email inside the Enroll/Create form breaks the match, so no consumption (code-verified 2026-07-11); scopeWithEmail() is an exact where('email', …) — case-sensitive on this Postgres database — while existingUser resolves via Repo::user()->getByEmail(), case-insensitive (RS-G); upgrade I11673_AddMissingApprovalToReviewerSuggestion retroactively applies the same email-match rule to pre-existing data; live-probed 2026-07-11 (ordinary-search assignment of a suggested email → suggestion vanishes live, approvedAt + reviewerId stamped; case-variant email → suggestion stays open, live-refuted 2026-07-11) ·
<sup>k</sup> ReviewerSuggestionController::getRouteGroupMiddleware() (no REVIEWER role); review-anonymity spec; live-probed 2026-07-11 (no reviewer-facing surface; API 401)

## Side effects

- **None of the usual machinery fires.** Creating, editing, deleting, or using a
  suggestion sends no email, raises no notification, and writes no activity-log
  entry — the feature is deliberately silent (the no-email half was verified with
  the test environment's mail trap; from the screens you can only check the
  notification bell and the Activity Log). (The assignment that consumes a
  suggestion has its own emails/logs, all owned by
  assign-and-manage-reviewers.) <sup>a</sup>
- **Cross-entity**: completing a reviewer assignment can flip a matching suggestion
  to used (rules 9–10); deleting the submission removes its suggestions; deleting an
  involved user blanks that link but keeps the suggestion (rule 5 — not verifiable
  from the screens).

<sup>a</sup> ReviewerSuggestionController — no Mail/Notification/event-log calls anywhere in the controller or model; adversarially re-verified 2026-07-11

## Settings that modify behavior

- **"Reviewer Suggestion at Submission"** (Settings → Workflow → Review tab, Setup —
  a section of that name between "One-click Reviewer Access" and "Default Response
  Deadline", explained as "Author can suggest several potential reviewers before
  completing the submission which can streamline the review process and provide
  valuable input for editorial team.") — the checkbox **"Allow authors to suggest
  potential reviewers at submission process"** is the feature's master switch, off by
  default. On: the wizard step, the two workflow panels, and the picker block all
  appear. Off: all of them vanish — including for submissions and drafts that already
  carry suggestions, whose data stays stored but is no longer shown anywhere;
  re-enabling brings the same names, affiliations and reasons back into view, action
  menus included. ⚠ The switch governs only what is shown: with it off, the service
  still accepts adding, editing and deleting suggestions on drafts for everyone
  ordinarily permitted — nothing checks the switch on the way in. With the wizard
  step gone there is no screen to attempt this from, so the gap is not verifiable
  from the screens (Known deviations). The setting's home is the workflow-settings
  spec; this spec owns what it turns on. <sup>a</sup>
- **Step help text** (Settings → Workflow → Submission tab, Author Guidance — the
  multilingual rich-text field labeled "For Reviewer Suggestion") — the instructions
  shown at the top of the wizard step. Ships with a default explaining the value of
  suggesting reviewers; quoted as shipped, it reads "… provide valueable input for
  the editorial team …" — ⚠ the misspelling is in the shipped text, and the field's
  manager-facing explanation describes the wrong step (both in Known deviations).
  Home: workflow-settings. <sup>b</sup>
- **ORCID enablement** — with the journal's ORCID functionality on (enabling it is
  the orcid spec's business), the suggestion form gains the optional ORCID iD field
  (Fields table). <sup>c</sup>
- No config.inc.php variables alter these rules.

<sup>a</sup> `reviewerSuggestionEnabled` (context schema, default absent/false; PKPReviewSetupForm; consumed by PKPSubmissionHandler::getSteps(), workflowConfigEditorialOJS.js, PKPSelectReviewerListPanel::getConfig()); live-probed 2026-07-11 (dial location, section description and checkbox label verbatim; off mid-stream → panel, block and wizard step gone even on a draft carrying suggestions; back on → data intact, menus back) ·
<sup>b</sup> `reviewerSuggestionsHelp` (context schema, defaultLocaleKey default.submission.step.reviewerSuggestions; SubmissionGuidanceSettings); live-probed 2026-07-11 (field location + label; shipped default contains "valueable") ·
<sup>c</sup> OrcidManager::isEnabled() (ReviewerSuggestionsForm); live-probed 2026-07-11 (A/B on orcidEnabled)

## Cross-feature interactions

- **submission-wizard** — owns the wizard shell, step sequencing, autosave,
  save-for-later and the submit gate; this spec owns the Reviewer Suggestions step's
  content. The wizard spec also owns two adjacent ledger items: the step-progress
  marker this step stores is missing from the system's own allowed list (row 174),
  and save-for-later can reopen a submitted wizard (row 176) — the one path that
  could unfreeze rule 3.
- **assign-and-manage-reviewers** — owns the Add Reviewer picker, the three
  assignment-form variants and everything that happens on assignment; it defers the
  suggestion block, the prefills and the used-marking to this spec (its ledger row 52
  records two block quirks — see Known deviations). ⚠ Its Assistant scenario
  (an Assistant opens Add Reviewer) is unaffected by the suggestions dial — the
  button works with suggestions on or off; what the dial adds for an assigned
  Assistant is a blocking error dialog on workflow-page load that must be dismissed
  first (Known deviations, arbitrated correction 2026-07-11).
- **review-anonymity** — owns who sees whom once a review assignment exists; this
  spec only guarantees suggestions themselves are never shown to reviewers (rule 11).
- **workflow-settings** — owns the settings forms where the master switch and the
  step help text live.

## Canonical scenarios

1. **Author suggests two reviewers in the wizard** — an author starts a submission
   in a journal that allows reviewer suggestions. After "For the Editors" comes a
   step "Reviewer Suggestions". They click "Add Reviewer Suggestion" and save the
   form empty: the required fields — Given Name, Email, Affiliation, Reasons for
   suggesting reviewer — each show "This field is required."; Family Name shows no
   error. They fill everything and save; the person appears in the list with their
   affiliation beside the name and their email underneath. They add a second
   suggestion using the email of an existing user who already holds the Reviewer
   role at this journal (scenario 4 depends on that) — it is accepted and listed the
   same way. On the final Review step, both names appear under "Reviewer
   Suggestions" with email and affiliation.
2. **Housekeeping and the duplicate guard** — still in the wizard, the author edits
   the first suggestion (the side panel reopens prefilled; the changed affiliation
   shows in the list after saving). Adding a third suggestion that reuses the first
   one's email is refused with "The email has already been taken." on the Email
   field. Deleting the second suggestion opens a dialog titled "Delete Reviewer
   Suggestion" asking "Are you sure you want to remove this suggestion? This action
   can not be undone."; confirming with the "Delete Reviewer Suggestion" button
   removes the row. If the author empties the whole list, the Review step shows the
   warning "No reviewers have been suggested for this submission." — a warning only;
   Submit is not blocked (rule 2). Before submitting, the author re-adds three
   suggestions: two colleagues who each already hold reviewer-role accounts at the
   journal (the first being the colleague from scenario 1), and one person whose
   email matches no account at the journal — so scenario 3 opens on a submission
   carrying all three.
3. **The editor's first look, and the freeze** — the author submits with suggestions
   in place. In the author's own My Submissions tracking view there is no reviewer
   suggestions area — the author can no longer see or change the list. A Journal
   Manager opens the submission's workflow page: in the side column, directly below
   the Participants panel, a panel "Reviewers Suggested by Author" lists each person
   with avatar initials, name, affiliation and the author's reason — with no edit,
   delete or add controls anywhere. On a submission whose author suggested no one,
   the panel does not appear at all.
4. **Assigning from a suggestion (existing reviewer)** — a Section Editor assigned to
   the submission sends it to review and opens the review stage with Review Round 1
   selected. The "Reviewers Suggested by Author" panel now shows the suggestions,
   each with a "…" menu containing a single action, **Add Reviewer**. Choosing it for
   the first of the two reviewer-account colleagues opens the normal
   reviewer-request form with that person already shown as the "Selected Reviewer"
   (no search list); the editor completes the assignment, filling the request form
   per the assign-and-manage-reviewers spec. Without reloading the page, that
   suggestion is gone from the review-stage panel — and from the
   "Select a Reviewer from Reviewer Suggestions" block inside Add Reviewer — while
   the submission-stage panel still lists it, looking no different from the
   still-open ones.
5. **Suggesting someone new to the journal** — for the suggestion whose email matches
   no account, the editor instead uses Add Reviewer: above the "Locate a Reviewer"
   search sits "Select a Reviewer from Reviewer Suggestions" with the person's name,
   affiliation and reason. Clicking **Select Reviewer** opens the "Create New
   Reviewer" form with given name, family name, email and affiliation already filled
   (the editor adds a username and completes the form's remaining required fields
   per the assign-and-manage-reviewers spec). Completing it creates the account,
   assigns the review, and the suggestion drops out of the block and the
   review-stage panel.
6. **An independent assignment still consumes the suggestion** — the second
   reviewer-account colleague's suggestion is still open. The editor ignores it
   entirely and assigns that person through the ordinary picker search instead.
   Precondition: the account's email must equal the suggestion's email exactly,
   capitalization included — a case-mismatch is never consumed (Known deviations,
   RS-G). Because the emails match, that suggestion nonetheless disappears from the
   review-stage panel and the picker block afterwards: the editorial team is never
   re-prompted to consider a person who is already on the job. <sup>s6</sup>
7. **The journal dial** — a Journal Manager opens Settings → Workflow → Review,
   unticks "Allow authors to suggest potential reviewers at submission process" under
   "Reviewer Suggestion at Submission", and saves. A new submission's wizard goes
   straight from "For the Editors" to "Review" with no Reviewer Suggestions step; on
   the earlier submission the workflow panels and the picker block are gone, though
   nothing was deleted. Re-enabling the setting brings the same suggestions back
   into view; switching to the review stage and selecting the review round shows
   each row's "…" action menu back as well.

<sup>s6</sup> Test-authoring note (live-probed 2026-07-11): a review assignment seeded by script/fixture does NOT consume a matching suggestion — consumption runs only in the assignment form's execute path, so the test must drive the on-screen Add Reviewer flow to observe it.

## Known deviations (as-built ≠ intent)

- ⚠ **RS-A (headline; proposed ledger row; ARBITRATED 2026-07-11 — supersedes this
  spec's earlier claim that the Add Reviewer button itself disappears) — enabling
  suggestions throws a blocking error dialog at assigned Assistants**: on a
  suggestions-enabled journal, an Assistant assigned to a submission gets a blocking
  error dialog the moment the workflow page loads — "Error / The current role does
  not have access to this operation. / OK" — because the suggestions panel's data
  fetch is refused for their role, and the panel never renders for them. The Add
  Reviewer button is NOT affected: it was in the DOM the whole time (the earlier A/B
  probe measured while the blocking dialog held the page — role-based queries exclude
  aria-hidden content — and its dialog detector used wrong selectors), and after
  dismissing the dialog it works normally; the picker even lists the open
  suggestions, whose data arrives with the page and is gated only by the journal
  dial — though the block's live refresh fails for Assistants the same way the
  panel's fetch does. The dial gates the DIALOG, not the button. Root cause: two
  inconsistent audiences over the same data — the suggestion service admits
  managers, editors and authors but not Assistants, while the assignment screens
  admit Assistants but not authors. <sup>p</sup> Separately (ordinary stage access,
  not this feature): an Assistant assigned to only some stages has no Add Reviewer
  button on stages outside their assignment (code-verified). Suspected intent: one
  consistent audience for all suggestion surfaces, with the UI degrading quietly for
  roles outside it.
- ⚠ **RS-B (proposed ledger row) — stale "Add Reviewer" on a used suggestion strands
  the user** (live-probed 2026-07-11). To stage the stale row: open the same review
  stage in two windows, assign the suggested person in one, then act on the other
  window's not-yet-refreshed row. Doing so → the server throws
  (PKPReviewerGridHandler::getReviewerForm(), "Not allowed to add reviewer
  suggestion as reviewer that has already been approved") as an HTTP 500 with an
  EMPTY body, fired twice; the exception text never reaches the user. The UI shows
  the generic dialog "An unexpected error has occurred. Please reload the page and
  try again." and then leaves an EMPTY "Add Reviewer" modal shell open that must be
  closed manually — the pass/fail tell: the shell's header shows the literal
  placeholder text "##common.help##" where its help link should be <sup>q</sup>; the
  stale row persists until reload.
- ⚠ **RS-C (proposed ledger row) — duplicate-email error is raw framework wording**
  (live-probed 2026-07-11): "The email has already been taken." — untranslated
  default Laravel phrasing, unlike the form's other messages. Cosmetic.
- ⚠ **RS-D (proposed ledger row) — the help-text field's manager-facing description
  is mis-copied from the Contributors step** (live-probed 2026-07-11): Settings →
  Workflow → Submission → Author Guidance, field "For Reviewer Suggestion", describes
  "…what information the author should provide about themselves, co-authors, and any
  other contributors." (manager.po:1414).
- ⚠ **RS-E (proposed ledger row) — shipped typo in the default step help text**
  (live-probed 2026-07-11): the default for the wizard step's guidance
  (default.submission.step.reviewerSuggestions) reads "…provide valueable input for
  the editorial team…" — "valueable".
- ⚠ **RS-F (proposed ledger row, minor) — used and open suggestions are visually
  indistinguishable** (live-probed 2026-07-11): the submission-stage panel shows both
  with no annotation, and the recorded approval metadata (when, by whom, resulting
  reviewer — rule 4) surfaces on no screen; only the API carries it.
- ⚠ **RS-G (proposed ledger row) — a letter-case difference lets a suggestion escape
  being marked used** (live-refuted rule-10 edge, 2026-07-11): the system recognizes
  the account behind a suggested email regardless of letter-case — the assign action
  is steered to the right person (rule 8) — but the used-marking match is exact: as
  shipped, on installations like this one the two emails must match letter for
  letter, so treat a case-mismatch as never-consuming. A suggestion whose email
  differs from the account's only by capitalization is therefore never consumed
  when that person is assigned
  through the ordinary search: it stays open forever in the review-stage panel and
  the picker block, re-offering a person already on the job. Assigning from the
  suggestion row itself still consumes it. <sup>r</sup>
- ⚠ **RS-H (proposed ledger row) — the master switch is enforced only by the
  screens** (live-confirmed 2026-07-11): with "Reviewer Suggestion at Submission"
  switched off, the suggestion service still accepts adding, editing and deleting
  suggestions on drafts for everyone ordinarily permitted (Actors table, first
  row) — nothing on the server consults the switch; turning it off only removes the
  wizard step, the workflow panels and the picker block. Suggestions written this
  way sit stored but invisible until the switch comes back on. Not verifiable from
  the screens: with those surfaces gone there is no UI to attempt it from — the gap
  shows only to direct service calls. <sup>s</sup>
- ⚠ **Existing ledger row 52** (assign-and-manage-reviewers spec): the picker block's
  buttons carry "Select undefined" accessible names (re-observed live 2026-07-11,
  visible label "Select Reviewer" + sr-only "Select undefined"), and the block does
  not live-refresh after an enroll-and-assign completes from a suggestion —
  cross-referenced here because the block is this spec's surface; not re-proposed.
  Same probe also noted a cosmetic CSS class typo, "reviewer-sugestions-list".
- The delete-confirmation string takes no name parameter although the screen passes
  one (ReviewerSuggestionsListPanel.vue openDeleteModal() hands `name` = the raw
  multilingual family-name object to a message with no placeholder) — live-probed
  2026-07-11: nothing odd renders, the dialog is clean. Harmless; a one-line code
  cleanup at most, no ledger row.

<sup>p</sup> Panel mount fetch GET api/v1/submissions/{id}/reviewers/suggestions?approved=false → 401 roleBasedAccessDenied for Assistant (ReviewerSuggestionController::getRouteGroupMiddleware(): SITE_ADMIN, MANAGER, SUB_EDITOR, AUTHOR — no ASSISTANT), surfaced as the blocking dialog; the picker block's suggestion data is embedded server-side (PKPSelectReviewerListPanel::getConfig(), gated by `reviewerSuggestionEnabled` only), so the block renders for Assistants but its refresh request fails; the assignment grid (PKPReviewerGridHandler) admits Assistants but not authors — the two inconsistent audiences. Arbitration 2026-07-11: the original A/B probe's role-based queries ran while the dialog held the page (aria-hidden content is excluded from role queries) and its dialog detector used wrong selectors; re-probed after dismissal — button in the DOM throughout, Add Reviewer opens, open suggestions listed in the picker ·
<sup>q</sup> the stranded modal header renders the literal missing-locale-key marker ##common.help##; live-probed 2026-07-11 ·
<sup>r</sup> ReviewerSuggestion::scopeWithEmail() — exact where('email', …), case-sensitive on this Postgres install — vs existingUser = Repo::user()->getByEmail() (case-insensitive); consumption guard in ReviewerForm::execute(); live-refuted 2026-07-11 (case-variant suggestion stayed open after ordinary-search assignment of the same person); from-suggestion consumption of a case-variant passes the guard because existingUser is case-insensitive (code-verified 2026-07-11) ·
<sup>s</sup> POST/PUT/DELETE api/v1/submissions/{id}/reviewers/suggestions on an incomplete draft with reviewerSuggestionEnabled=false → accepted (200) for permitted roles; ReviewerSuggestionController::authorize()/getRouteGroupMiddleware() check roles + SubmissionIncompletePolicy only, never the context setting; live-confirmed 2026-07-11

## Open questions

1. **Is the collected ORCID iD meant to be used?** The wizard validates and stores
   it, but no editor-facing surface displays it and the "Create New Reviewer" form
   has no ORCID field at all (live-probed), so it is structurally impossible for the
   value to flow anywhere — should it feed the reviewer account / assignment screens,
   or be dropped from the form?
2. **Should editors be able to dismiss a suggestion?** There is no
   decline/hide/reject affordance, so an unusable suggestion stays in the
   review-stage panel and picker block for every future round of the submission. Is
   "open forever until used" the intended product rule?
3. **What is the intended Assistant experience** (RS-A)? As built, enabling
   suggestions greets an assigned Assistant with a blocking error dialog on every
   workflow-page load (their copy of the panel's data is refused, and the panel
   never renders), while Add Reviewer keeps working and its picker still shows them
   the open suggestions it received with the page. Should Assistants be added to the
   suggestion read audience (panel and live refresh like Section Editors), or
   excluded cleanly (no dialog, and no suggestion surfaces at all)?
4. **Used-marking matches by email across the whole submission** (rule 10),
   regardless of round or of who suggested — including when the "reviewer" being
   assigned was suggested by the author but is assigned to a *later* round years
   apart. Intended breadth, or should the match be scoped (e.g. to first
   assignment)?
5. **Should "used" be visible?** (RS-F) The submission-stage panel keeps showing
   consumed suggestions with no mark, and the stored when/by-whom/which-reviewer
   trail renders nowhere — and if the consuming assignment is later cancelled, the
   suggestion neither reopens nor shows any trace of that either (rule 4). Is an
   on-screen "used" state (or the metadata) wanted, or is silent bookkeeping the
   intent?

---

<!-- REFERENCE MATERIAL — provenance and campaign bookkeeping, not product-owner
     narrative. The PO-facing "where do I find this" is in Purpose. -->

## Reference — entry points & surfaces

| Entry | Path | Atom |
|-------|------|------|
| Wizard step "Reviewer Suggestions" | Make a Submission → step between For the Editors and Review (only when `reviewerSuggestionEnabled`); step wiring PKPSubmissionHandler::getSteps()/getReviewerSuggestionsStep(); panel config getReviewerSuggestionsListPanel() | VUE-reviewer-suggestions-list-panel, FORM-reviewer-suggestions-form |
| Wizard Review recap | Final wizard step; lib/pkp/templates/submission/review-reviewer-suggestions.tpl | — |
| Workflow side panel "Reviewers Suggested by Author" | Dashboard → submission workflow page, Submission + Review stage secondary column, below Participants (editorial view only); workflowConfigEditorialOJS.js | VUE-reviewer-suggestion-manager |
| Add Reviewer picker block | Review stage → Add Reviewer → "Select a Reviewer from Reviewer Suggestions" above the search; PKPSelectReviewerListPanel::getConfig() + SelectReviewerSuggestionListItem.vue (panel atom owned by assign-and-manage-reviewers) | — |
| Suggestion CRUD API | `GET/POST api/v1/submissions/{submissionId}/reviewers/suggestions`, `GET/PUT/DELETE …/{suggestionId}` (writes gated by SubmissionIncompletePolicy; `?approved=` filter on the list) | API-reviewer-suggestion-get, -get-many, -add, -edit, -delete |
| Assign-from-suggestion handoff | Legacy reviewer grid `showReviewerForm` with `reviewerSuggestionId` param → prefilled Advanced Search / Enroll Existing / Create form | — |
| Storage | reviewer_suggestions + reviewer_suggestion_settings (multilingual name/affiliation/reason) | DB-reviewer_suggestions, DB-reviewer_suggestion_settings |

## Reference — code anchors

- lib/pkp/api/v1/reviewers/suggestions/ReviewerSuggestionController.php — routes, role
  gate, SubmissionIncompletePolicy on writes
- lib/pkp/api/v1/reviewers/suggestions/formRequests/{AddReviewerSuggestion,EditReviewerSuggestion}.php — validation (multilingual, per-submission unique email, orcid)
- lib/pkp/api/v1/reviewers/suggestions/resources/ReviewerSuggestionResource.php —
  API shape incl. existingUserId / hasExistingReviewerRole / approvedAt
- lib/pkp/classes/submission/reviewer/suggestion/ReviewerSuggestion.php — model:
  settings fields, set-once approvedAt/reviewerId, approveAndAttachReviewer(),
  existingUser/hasExistingReviewerRole attributes
- lib/pkp/classes/migration/install/ReviewerSuggestionsMigration.php — tables + FKs;
  upgrade I4787_InstallReviewerSuggestion, I11673_AddMissingApprovalToReviewerSuggestion
- lib/pkp/pages/submission/PKPSubmissionHandler.php — step + panel wiring
  (`reviewerSuggestionEnabled`), SECTION_TYPE_REVIEWER_SUGGESTIONS
- lib/pkp/classes/components/forms/submission/ReviewerSuggestionsForm.php;
  lib/pkp/classes/components/listPanels/ReviewerSuggestionsListPanel.php — wizard form/panel config
- lib/ui-library/src/components/ListPanel/reviewerSuggestions/ — wizard panel + modal
- lib/ui-library/src/managers/ReviewerSuggestionManager/ — workflow panel (store,
  actions: approved=false fetch, atActiveReviewStage gate, legacy-modal handoff)
- lib/pkp/classes/components/listPanels/PKPSelectReviewerListPanel.php;
  lib/ui-library/src/components/ListPanel/users/SelectReviewerSuggestionListItem.vue —
  picker block
- lib/pkp/controllers/grid/users/reviewer/PKPReviewerGridHandler.php::getReviewerForm();
  lib/pkp/controllers/grid/users/reviewer/form/{ReviewerForm,AdvancedSearchReviewerForm,EnrollExistingReviewerForm,CreateReviewerForm}.php —
  prefill + auto-approve (ReviewerForm::execute())
- lib/pkp/classes/components/forms/context/PKPReviewSetupForm.php (master switch);
  lib/pkp/classes/components/forms/submission/SubmissionGuidanceSettings.php (help text);
  schemas/context.json (`reviewerSuggestionEnabled`, `reviewerSuggestionsHelp`)
