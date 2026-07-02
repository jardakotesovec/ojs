---
name: submission-drafts
scope: An author (or an editor/manager acting on their behalf) parks an in-progress submission with "Save for Later", finds it again in the Incomplete-submissions list, resumes it at the step they left, and — as author or manager — deletes drafts they no longer want, singly or in bulk
shared: pkp-lib
status: verified
e2e-plans: [submission-drafts.md, submission-wizard-core.md]
atlas-claims:
  - API-submission-save-for-later
  - API-backend-submissions-bulk-delete-incomplete-submissions
  - API-backend-submissions-delete
  - MAIL-submission-saved-for-later
  - LOC-submission-dashboard-submissions
---

# Submission drafts

## Purpose

A submission does not have to be finished in one sitting. From any step of the
"Make a Submission" wizard the author can click **Save for Later**: the wizard
remembers the step they were on, the draft drops out of the way, and OJS emails them
a one-click **resume link**. The saved draft is a real (but incomplete) submission —
it shows up in the author's **Incomplete submissions** list on their dashboard, with a
**Complete submission** action that reopens the wizard exactly where they left off.
Managers and site admins see the same incomplete drafts across the whole journal.
When a draft is abandoned, it can be deleted: an author can delete their *own*
incomplete drafts, and a manager or site admin can delete *any* of them — one at a
time or several at once through the **Delete Incomplete Submissions** bulk tool on the
dashboard. This spec owns the save-for-later action + its email, the resume behaviour,
how drafts are presented in the lists, and draft deletion from the lists. It does *not*
own the wizard steps themselves or the in-wizard **Cancel** button (both
`submission-wizard`).

## Actors & permissions

Baselines: everything here requires a logged-in account. **Site admins and journal
managers** act on any draft in the journal; everyone else acts only on drafts they are
assigned to. *The submitting author* is the user who started the draft (they hold an
author stage assignment on it). "Incomplete draft" = a submission still in the wizard —
operationally, one whose progress marker is non-empty (a normal draft also has no
submission date, but every list and delete gate keys on the marker alone — proven by
the row-65 un-submit state, which keeps its date yet behaves as a draft everywhere).
Who can *open the wizard* to save/resume is defined by `submission-wizard`; this table
adds the list-and-delete capabilities. The site-admin-rides-on-manager-enrolment caveat that
recurs across submission features applies here too (see `submission-wizard` Known
deviations) and is not re-narrated per row. <sup>a</sup>

| Action | Who may — and when |
|--------|--------------------|
| **Save for Later** | • Anyone who can open the draft's wizard — the "Save for Later" control sits in the wizard header and footer (owned by `submission-wizard`; disabled while the connection is down). This spec owns what it does: record the step + send the resume email. Live-probed the write endpoint by role on fresh drafts: author-on-own **200**, manager (dbarnes) on another's draft **200**, *assigned* section editor (dbuskins) on the draft they are on **200**, *unassigned* section editor **401** `roleBasedAccessDenied`, assigned assistant (mfritz) **401**, reviewer (jjanssen) **401** <sup>b</sup> |
| **Resume a draft** | • The submitting author — via the **Complete submission** action on their Incomplete-submissions row, or the resume link in the saved-for-later email (live-probed both: the email link, opened logged-out, redirects through login and lands on the wizard at the saved step)<br>• Managers, site admins and assigned editorial participants — by opening the draft's wizard URL (wizard access per `submission-wizard`) <sup>c</sup> |
| **See a draft in the list** | • The submitting author — own drafts under **Incomplete submissions** on the My-Submissions dashboard (live-probed: view titled "Incomplete submissions (30)", 30 rows each "Incomplete / Complete submission" for `atester`)<br>• Managers and site admins — every incomplete draft in the journal, mixed into the editorial **Active** view and reachable via the **Incomplete** filter (live-probed: `_submissions?isIncomplete=true` returned 31 for dbarnes; drafts show "Incomplete / Complete submission" inline in Active)<br>• Assigned sub-editors / assistants — incomplete drafts they are assigned to, in their Active view (live-probed: assigned assistant mfritz's `_submissions/assigned` returned exactly the one draft they were assigned to)<br>• Reviewers — never; the reviewer has no draft-list route (live-probed: reviewer `_submissions` and `_submissions/assigned` both **401**) <sup>d</sup> |
| **Delete a draft** | • The submitting author — their *own* incomplete drafts only (live-probed: author bulk-deleted own drafts; refused another user's with **404**)<br>• Managers and site admins — any incomplete draft in the journal (live-probed: dbarnes bulk-deleted author `atester`'s draft)<br>• Assigned sub-editors, assistants, reviewers — no delete affordance and the endpoint refuses them at the door: the DELETE route roles are SITE_ADMIN/MANAGER/AUTHOR only, so even an **assigned** section editor is refused before any per-submission check (live-probed: assigned section editor dbuskins, assigned assistant mfritz, and reviewer jjanssen all **401** "The current role does not have access to this operation.")<br>• Nobody may delete a *submitted* submission this way — the tool only accepts incomplete drafts (live-probed: author single-DELETE of a submitted submission → **403** "You do not have permission to delete this submission."; a submitted id in a bulk batch → **404**) <sup>e</sup> |
| **Bulk-delete incomplete drafts** | • Managers and site admins — the **Delete Incomplete Submissions** item in the dashboard's **More Actions** menu (editorial dashboard; live-probed as dbarnes: menu item present in Active, greyed out in the all-complete Published view)<br>• The submitting author — the same item on their My-Submissions dashboard, scoped to their own drafts (live-probed as atester end-to-end: enable selection → tick a draft → Delete → confirm → count 30→29)<br>• Enabled only when the current view holds at least one draft the user may delete (the menu item and Delete button are disabled otherwise — live-probed: disabled in the all-complete Published view) <sup>f</sup> |

<sup>a</sup> PKPBackendSubmissionsController::authorize() (SubmissionAccessPolicy on delete); Repository::canCurrentUserDelete(); PKPDashboardHandler role assignments ·
<sup>b</sup> PKPSubmissionController::saveForLater(); templates/submission/wizard.tpl (`saveForLater`) — control ownership in submission-wizard ·
<sup>c</sup> DashboardCellSubmissionActivity (`openSubmissionWizard`, `submission.list.completeSubmission`); dashboardPageStore.openSubmissionWizard() (`submission?id=N`); SubmissionSavedForLater email `submissionWizardUrl` ·
<sup>d</sup> Repository::mapDashboardViews() TYPE_INCOMPLETE_SUBMISSIONS ([ROLE_ID_AUTHOR]); TYPE_ACTIVE (manager/editor, STATUS_QUEUED incl. drafts); PKPSubmissionsListPanel `isIncomplete` filter; Collector::filterByIncomplete() (`submission_progress <> ''`) ·
<sup>e</sup> PKPBackendSubmissionsController::bulkDeleteIncompleteSubmissions() (`filterByIncomplete`, `canCurrentUserDelete`, route roles SITE_ADMIN/MANAGER/AUTHOR); Repository::canCurrentUserDelete() ·
<sup>f</sup> useDashboardBulkDelete.js (`bulkDeleteIsAvailableForUser`, `canBeDeleted`); DashboardControlBulkActions.vue / DashboardControlBulkDeleteButton.vue

## Fields & validation

This feature is almost field-free — it acts on whole submissions, not form fields.

| Field (UI label) | Required? | Rules | Anchor |
|------------------|-----------|-------|--------|
| **(saved step)** | server-set | Not user-editable. Save for Later stamps the draft with the last-started wizard step so resume reopens there; empty means "start" | PKPSubmissionController::saveForLater() (`step`); SubmissionWizardPage.vue `startedSteps` |
| **Save-for-later email** | N/A | The resume email has no user-entered content — subject/body come from the journal's editable `SUBMISSION_SAVED_FOR_LATER` template (Side effects) | SubmissionSavedForLater |
| **Bulk-delete selection** | at least one | The Delete button stays disabled until ≥1 deletable draft is checked; only rows the user may delete render a checkbox | DashboardCellBulkDelete.vue; useDashboardBulkDelete.js |

## Rules & state

A submission is a **draft** while its progress marker (`submissionProgress`) is
non-empty and it has no submission date; final submit clears the marker and stamps the
date (owned by `submission-wizard`). This spec is the canonical home for what the
progress marker records and how drafts behave in the lists.

1. **Save for Later records the step and mails a resume link.** From the wizard, Save
   for Later flushes pending autosaves, writes the last-started step into the draft's
   progress marker, sends the submitter the "Resume your submission" email, and lands
   on the **Saved for Later** page (which repeats the link and shows the email address
   used). Live-probed end-to-end: saving on the Details step wrote `details`, the page
   said "We have emailed a copy of this link to you at atester@mailinator.com", and the
   email arrived. <sup>a</sup>
2. **The progress marker is one of a fixed set of step ids — but Save for Later can
   write outside it.** The submission schema declares
   `submissionProgress ∈ {'', start, details, files, contributors, editors, review}`
   (default `start`; empty = submitted). Normal edits are validated against that list.
   **Save for Later is not**: it accepts any alphanumeric/`-`/`_` token (only a
   `ctype_alnum` check after stripping `-`/`_`, rejecting other characters with a 400
   "This may only contain letters, numbers, dashes and underscores.") and writes it
   straight to the draft, bypassing the schema whitelist. This is why the
   reviewer-suggestions step can persist `submissionProgress='reviewerSuggestions'`
   (a value absent from the list) and resume there anyway — benign, but a real seam
   (see Known deviations; canonical home for this seam is now this spec). Live-probed
   all three shapes: `reviewerSuggestions` and a made-up `foo-bar_9` both saved 200 and
   persisted verbatim; `foo!` was rejected 400. <sup>b</sup>
3. **Resume reopens the wizard at the saved step; an unknown token falls back to
   step 1.** Opening a draft (via the list's **Complete submission** action, the
   saved-for-later page link, or the email link) routes to `/submission?id=N`, which the
   wizard opens at the step whose id matches the progress marker — reflected in the URL
   hash and page title. If the stored token matches no current step id, the wizard
   silently opens the first step. Live-probed: the resume **email link opened logged-out**
   redirected through login and reopened the draft at `#details` ("Make a Submission:
   Details"); a draft carrying `reviewerSuggestions` reopened at `#reviewerSuggestions`;
   a draft carrying the bogus `zzz-unknown` fell back to `#files` (step 1 of that draft);
   the list's Complete-submission action opens the same URL. If the draft's section
   closed after it was started, resume lands on the **Section Closed** error page instead
   of the steps (an *inactive* section blocks everyone; *editor-restricted* is relaxed
   only for editors) — owned by `submission-wizard` rule 3, not re-narrated here.
   <sup>c</sup>
4. **A draft is presented as its own stage — "Incomplete".** In every submissions
   table a draft shows the stage label **Incomplete** (not "Submission"), and its
   Editorial-Activity cell shows a **Complete submission** action instead of the normal
   stage activity; the row's **View** (workflow) button is suppressed because a draft
   has no workflow yet. Live-probed on the author's Incomplete view: each row read
   "Incomplete / Complete submission". <sup>d</sup>
5. **The author's Incomplete-submissions list is a dedicated view; managers meet drafts
   inside Active.** The My-Submissions dashboard has an **Incomplete submissions** view
   (author-only) listing exactly the author's drafts. The editorial dashboard has *no*
   incomplete view — managers/site admins see drafts folded into the **Active** view
   (drafts are queued submissions) and can isolate them with the **Incomplete** filter
   in the panel. Both are backed by the same incomplete filter
   (`submission_progress <> ''`). Live-probed: author view titled "Incomplete
   submissions (30)" (author dashboard fetches `_submissions/assigned?isIncomplete=true`
   scoped to the AUTHOR role); manager `_submissions?isIncomplete=true` returned 31. The
   editorial dashboard exposes the Incomplete filter in its Filters side panel alongside
   the "Days since last activity" slider (both live-probed present). <sup>e</sup>
6. **Who may delete a draft is decided per submission, not just by route role.** A
   delete is allowed when the current user is a manager (in this journal) or a site
   admin, **or** the submission is incomplete *and* the user holds an author stage
   assignment on it. So an author can clear their own abandoned drafts but not anyone
   else's; a manager can clear any. The dashboard mirrors this exactly — only rows the
   user may delete get a checkbox. Live-probed: author deleted own drafts; manager
   deleted an author's drafts; a section editor was refused. <sup>f</sup>
7. **The bulk-delete tool deletes only the selected drafts that are incomplete and
   deletable — there is no age threshold.** Enabling **Delete Incomplete Submissions**
   turns each eligible row into a checkbox; confirming "Confirm Delete of Incomplete
   Submissions" → "Are you sure you want to delete the selected items? This action
   cannot be undone. Please confirm to proceed." deletes them. The backend re-filters
   the selected ids to *incomplete* submissions, scopes non-managers to their own
   assigned drafts, verifies each is in-context and deletable, and refuses the whole
   batch (404) if any selected id is not an eligible incomplete draft (so a mixed batch
   of a draft + a submitted/foreign id deletes nothing — live-probed: author's
   own-draft + own-submitted batch → 404, both survive). There is **no** inactivity/age
   gate on deletion — the dashboard's "days since last activity" slider is a *list
   filter*, not a delete criterion. Live-probed end-to-end via the UI: author enabled
   selection, ticked one draft, confirmed, count dropped 30→29; the endpoint is
   `DELETE /_submissions?ids[]=…`. **But the verification query hard-caps at 30 rows**,
   so selecting more than 30 drafts always 404s the whole batch — see ⚠ Known deviation
   2. <sup>g</sup>
8. **Deleting a draft is permanent and cascades.** Delete removes the submission and
   all its associated data (files, contributors, the author's stage assignment); there
   is no undo and no trash. The old wizard URL 404s afterwards (the Cancel path, owned
   by `submission-wizard`, is the in-wizard equivalent and hits the same delete). No
   email, notification or activity-log entry is raised by the deletion itself.
   <sup>h</sup>
9. **The resume email fires on *every* save and always goes to the person who saved,
   from the journal contact.** The "Resume your submission to {journal}" email is
   addressed to the **current user** — whoever clicked Save for Later, not necessarily
   the submitting author — and sent from the journal's contact name/address. There is no
   once-only guard: each Save for Later sends one email (live-probed: four saves on the
   same draft produced four emails to the saver). When a manager or assigned editor
   saves someone else's draft, *they* (not the author) receive the resume link
   (live-probed: dbarnes saving atester's draft → email to dbarnes only; dbuskins saving
   → email to dbuskins only; atester got nothing). If the journal has deleted the
   `SUBMISSION_SAVED_FOR_LATER` template, OJS falls back to a built-in default
   subject/body rather than failing. Live-probed: email to atester@mailinator.com, from
   "Ramiro Vaca <rvaca@mailinator.com>" (the journal contact); body greets "Dear Author
   Tester", names the draft title, and carries the wizard link
   `…/submission?id=N`. <sup>i</sup>

<sup>a</sup> PKPSubmissionController::saveForLater(); SubmissionWizardPage.vue saveForLater() (`startedSteps`, `submissionSavedUrl`); PKPSubmissionHandler::saved(); templates/submission/saved.tpl; live probe 2026-07-02 ·
<sup>b</sup> schemas/submission.json `submissionProgress` (`in:,start,details,files,contributors,editors,review`, default `start`); PKPSubmissionController::saveForLater() (`ctype_alnum` check then `Repo::submission()->edit(['submissionProgress'=>$step])`, no schema validation); reviewer-suggestions live-probe (resume at `reviewerSuggestions`) ·
<sup>c</sup> PKPSubmissionHandler::index() (state routing); SubmissionWizardPage.vue created() (`steps.find(id===submissionProgress)` else `steps[0]` — unknown-token fallback); dashboardPageStore.openSubmissionWizard(); SubmissionSavedForLater `submissionWizardUrl`; live probes 2026-07-02, re-verified 2026-07-03 (logged-out email link; reviewerSuggestions + bogus-token resume) ·
<sup>d</sup> useSubmission.js getExtendedStage() (`submissionProgress ? INCOMPLETE : SUBMISSION`); DashboardCellSubmissionActivity useDashboardConfigEditorialActivity.js (`openSubmissionWizard`/`completeSubmission`); DashboardCellSubmissionActions.vue `showButton` (`submissionProgress` → false); live probe 2026-07-02 ·
<sup>e</sup> Repository::mapDashboardViews() TYPE_INCOMPLETE_SUBMISSIONS (author) / TYPE_ACTIVE (STATUS_QUEUED); Collector::filterByIncomplete() (`submission_progress <> ''`); PKPSubmissionsListPanel `isIncomplete` filter; live probes 2026-07-02 ·
<sup>f</sup> Repository::canCurrentUserDelete() (manager/admin OR `submissionProgress` + author stage assignment); useDashboardBulkDelete.js canBeDeleted(); live probes 2026-07-02 ·
<sup>g</sup> PKPBackendSubmissionsController::bulkDeleteIncompleteSubmissions() (`filterBySubmissionIds`→`filterByIncomplete`, `assignedTo` for non-managers, per-submission context + `canCurrentUserDelete` checks, array_diff → 404; verification query inherits `getSubmissionCollector` `->limit(30)` → the >30-batch 404, deviation 2); useDashboardBulkDelete.js apiCall()/bulkDeleteActionDelete(); locale `dashboard.submissions.incomplete.bulkDelete.*`; live probes 2026-07-02, re-verified end-to-end via UI 2026-07-03 (count 30→29; mixed-batch 404; >30 404) ·
<sup>h</sup> Repository::delete() (`Submission::delete` hooks → DAO cascade); PKPSubmissionHandler::getSubmissionCancelUrl() (Cancel hits the same DELETE); live probe (submission-wizard: post-cancel 404) ·
<sup>i</sup> PKPSubmissionController::saveForLater() (`from(contactEmail, contactName)`, `recipients([$request->getUser()])`, template-missing fallback to `emails.submissionSavedForLater.subject/body`); SubmissionSavedForLater (`toRoleIds = [ROLE_ID_AUTHOR]`); live probe 2026-07-02

## Side effects

- **Save-for-later email** (live-probed): "Resume your submission to {journal}"
  (template `SUBMISSION_SAVED_FOR_LATER`) to the user who saved, from the journal
  contact. Body greets the saver by name and contains the draft's title as a link to the
  wizard (`submissionWizardUrl`). The template is journal-editable in Settings → Workflow
  → Emails (subject/body per locale, via Manage Emails — the "Submission Saved for Later"
  mailable with Add/Edit-template affordances, live-probed); resetting/deleting it falls
  back to built-in text and the save is not blocked. **The send is unconditional**:
  `saveForLater()` calls `Mail::send()` on every save with no journal on/off setting and
  no once-per-draft guard — there is no way to turn this email off from settings (the
  mailable declares `canDisable=true`, but nothing in the send path or the Manage Emails
  UI honors it — see Open question 5). Not logged in the submission's email log (the log
  is populated by the submit-time acknowledgements, owned by `submission-wizard`).
  <sup>a</sup>
- **No other effects on save**: Save for Later raises no notification and writes no
  activity-log entry — it only stamps the progress marker and sends the one email.
  <sup>b</sup>
- **No effects on delete**: deleting a draft (single or bulk) is a bare cascade delete —
  no email, no notification, no event-log entry. <sup>c</sup>

<sup>a</sup> PKPSubmissionController::saveForLater() (unconditional `Mail::send`, no enabled-check); SubmissionSavedForLater (`canDisable=true`, unconsulted); mail Repository::isMailableEnabled() (no case for this mailable → always listed, no off switch); emails.po `emails.submissionSavedForLater.*` ·
<sup>b</sup> PKPSubmissionController::saveForLater() (no Notification/EventLog usage) ·
<sup>c</sup> Repository::delete() (hooks only; no mail/notification/log)

## Settings that modify behavior

- **Saved-for-later email template** (Settings → Workflow → Emails → Manage Emails): the
  `SUBMISSION_SAVED_FOR_LATER` template's subject/body are editable per journal and per
  locale; deleting/resetting it falls back to the stock text. No on/off journal setting
  gates save-for-later itself — the email sends on every save regardless (Side effects).
- **Journal contact** (Settings → Contact): supplies the From name/address on the
  resume email.
- **Days since last activity** filter (dashboard submissions panel, default 30): a
  *list* filter for finding stale drafts; it does **not** gate bulk deletion (rule 7).
- **Don't accept submissions** (Settings → Workflow): blocks *starting* new drafts
  (owned by `submission-wizard`); it does not remove existing drafts or their
  save/resume/delete affordances.

## Cross-feature interactions

- **submission-wizard** — owns the wizard shell, the Save-for-Later *control*, autosave,
  the state-routing that reopens a draft at its step, and the in-wizard **Cancel**
  button (which deletes the current draft through the same bulk-delete endpoint this
  spec claims). This spec owns save-for-later's *effects* (step record + email), the
  list presentation of drafts, resume, and list-side deletion.
- **DB-submissions** — the `submissions` table (incl. `submission_progress`,
  `date_submitted`) is a **shared** atom claimed by `submission-wizard`; this spec
  reads its `submission_progress`/incomplete aspect but does not re-claim it.
- **reviewer-suggestions** — its Save-for-Later on the Reviewer Suggestions step is the
  concrete case of the whitelist seam (rule 2); that spec points here as the seam's
  canonical home.
- **author-dashboard** — owns the general My-Submissions list UX and the
  `VUE-submissions-list-panel` / dashboard-table author variant; this spec owns only
  the draft-specific semantics of those rows (the "Incomplete" stage, Complete-submission
  action, who may delete).
- **editorial-dashboards** — owns the editorial dashboard views/filters as a page; this
  spec owns only how incomplete drafts appear there (Active view + Incomplete filter)
  and the manager bulk-delete affordance.

## Canonical scenarios

1. **Save for Later, get the email, resume where you left off** — atester on
   `publicknowledge`: starts a submission, advances to Details, clicks **Save for
   Later**; lands on **Saved for Later** ("We have emailed a copy of this link to you
   at atester@mailinator.com") with the draft link. Mailpit shows "Resume your
   submission to Journal of Public Knowledge" from the journal contact, carrying the
   resume link. Clicking the link reopens the wizard at the **Details** step.
2. **The draft waits in the Incomplete list and reopens from there** — atester opens
   **Incomplete submissions** on the My-Submissions dashboard; the draft is listed with
   the stage **Incomplete** and a **Complete submission** action (no View button);
   clicking it reopens the wizard at the saved step.
3. **Author deletes their own abandoned draft (bulk tool)** — atester opens **More
   Actions → Delete Incomplete Submissions**, ticks one draft's checkbox (only own
   drafts are checkable), clicks **Delete Incomplete Submissions**, confirms "…This
   action cannot be undone.", and the row disappears (count drops by one).
4. **Manager clears any draft; section editor cannot** — dbarnes (manager-level editor)
   sees incomplete drafts in the editorial **Active** view / Incomplete filter and
   deletes another user's draft successfully; dbuskins (plain section editor) is refused
   the delete endpoint outright ("The current role does not have access to this
   operation.").
5. **Resume-at-saved-step across steps** — a draft saved on the Reviewer Suggestions
   step (value outside the schema whitelist) still reopens on that step when resumed,
   demonstrating the save-for-later step record and its whitelist bypass (rule 2).
6. **Submitted submissions are out of reach** — a completed submission is not offered
   in any incomplete list, shows no Complete-submission action, and the bulk-delete tool
   refuses it (the selected id is "not found" among incomplete drafts), so a real
   submission can't be deleted through this path.

## Known deviations (as-built ≠ intent)

- ⚠ **Save for Later can "un-submit" a completed submission via the API**
  (docs/e2e/app-changes.md §2 row 65; re-verified live end-to-end on a fresh submission
  2026-07-03): `saveForLater` adds no completeness guard and writes `submissionProgress`
  directly, so a hand-crafted `PUT /submissions/{id}/saveForLater` on an
  *already-submitted* submission rewrites its progress marker — pulling it back out of
  the workflow into an editable, list-visible, author-deletable draft, contradicting
  `submission-wizard` rule 9 ("there is no un-submit"). Note `dateSubmitted` is **not**
  cleared, yet the submission behaves as a draft everywhere (Incomplete list, resume,
  delete) — confirming every draft gate keys on the progress marker alone. API-only: the
  UI routes a submitted submission to the "Submission complete" screen and never renders
  Save for Later, so no normal user reaches this. Suspected intent: `saveForLater` should
  refuse completed submissions (as the reviewer-suggestion controller guards its writes
  with an incomplete policy).
- ⚠ **Bulk delete of more than 30 selected drafts always 404s the whole batch**
  (docs/e2e/app-changes.md §2 row 66; live-probed 2026-07-03): the backend verification
  query in `bulkDeleteIncompleteSubmissions()` runs through `getSubmissionCollector()`,
  which hard-defaults `->limit(30)`, and the dashboard's delete call sends only `ids`,
  never a `count`. So when more than 30 drafts are selected, the re-fetch returns at most
  30 rows, `array_diff` flags the rest as "missing", and the entire batch is refused with
  404 "The requested resource was not found." — deleting nothing. This is UI-reachable:
  the dashboard pages at 30 rows but the checkbox selection *persists across page
  changes* (`bulkDeleteSelectedItems` only resets on delete/cancel — live-probed: the
  Delete button stayed enabled on page 2 with a page-1 selection), so a user with 31+
  drafts can accumulate a >30 selection and hit a Delete that fails claiming their real
  drafts don't exist. Live-probed: author DELETE of 31 valid own incomplete ids → 404,
  all 31 survive. Suspected intent: the verification query should lift its limit (or the
  UI should pass `count`).
- **`submissionProgress` whitelist bypass** (benign; canonical home for the seam;
  cross-ref `submission-wizard` Open question 4 and `reviewer-suggestions` Known
  deviations): Save for Later validates the step token only with `ctype_alnum` and
  persists it via a direct edit, bypassing the schema's
  `in:,start,details,files,contributors,editors,review` list — so it can store
  `reviewerSuggestions` (resume works) or, in principle, any alphanumeric token, while a
  normal submission edit with the same value would be rejected. Fix is to add the
  reviewer-suggestions value to the schema list and/or validate the step against the
  whitelist in `saveForLater`.

## Open questions

1. Should `saveForLater` refuse already-submitted submissions (deviation 1), or is the
   API's lack of a completeness guard acceptable given the UI never exposes it?
2. Should the step token written by `saveForLater` be validated against the submission
   schema's `submissionProgress` whitelist (which currently omits `reviewerSuggestions`),
   rather than accepting any alphanumeric token?
3. **Atom placement — `VUE-submissions-list-panel`.** FEATURE-MAP lists this atom under
   both `submission-drafts` (drafts aspect) and `author-dashboard`. Live-checked: the
   draft rows this spec describes are rendered by the dashboard's `DashboardTable`
   cells, **not** by `SubmissionsListPanel.vue` — whose only live mount is the native
   import/export plugin's export picker (`plugins/importexport/native/templates/index.tpl`
   `<submissions-list-panel>`). Left unclaimed here to avoid a force-fit; belongs to
   `author-dashboard` or an import/export spec. Confirm at grooming.
4. **The single-submission backend delete** (`DELETE /_submissions/{submissionId}`,
   atom `API-backend-submissions-delete`) — **RESOLVED: live, and now claimed here.**
   It is the target of the editorial workflow's **Delete** button
   (`useWorkflowActions.js workflowDeleteSubmission()` → `useUrl('_submissions/${id}')`
   DELETE), which appears on a **declined** submission's workflow header for managers /
   site admins (`workflowConfigEditorialOJS.js`, gated on `DECISION_REVERT_*` being
   available + an assigned MANAGER/SITE_ADMIN role). Live-probed end-to-end 2026-07-03:
   dbarnes on a declined submission clicked **Delete** → "Are you sure you want to
   permanently delete this submission?" → Confirm → `POST /_submissions/65` (method
   override DELETE) 200, the submission was gone. Unlike the bulk endpoint this route is
   *not* incomplete-scoped — it deletes a completed (declined) submission, guarded only
   by `SubmissionAccessPolicy` + `canCurrentUserDelete()` (author of an incomplete draft
   or manager/admin). So the atom belongs to the editorial workflow's delete affordance,
   not exclusively to drafts; claimed here for now with a grooming note to hand it to a
   workflow/decisions spec if one takes the "Delete submission" action. (Note: the same
   `canCurrentUserDelete()` means an author *could* single-DELETE their own incomplete
   draft via this route too — but no draft-side UI calls it; the incomplete lists all use
   the bulk endpoint.)
5. The `SUBMISSION_SAVED_FOR_LATER` mailable declares `canDisable=true`, but nothing in
   OJS honors it: `saveForLater()` sends unconditionally, mail
   `Repository::isMailableEnabled()` has no case for it (so it is always "enabled" and
   always listed), and the Manage Emails UI exposes no disable/enable toggle. Is the
   unwired `canDisable` flag intended (a latent capability), or should this email gain a
   real off switch — or should `saveForLater` consult `isMailableEnabled` before sending?

---

## Reference — entry points & surfaces

| Entry | Path | Atom |
|-------|------|------|
| Save for later | `PUT api/v1/submissions/{id}/saveForLater` (wizard header/footer control) | API-submission-save-for-later |
| Resume email | `SUBMISSION_SAVED_FOR_LATER` → "Resume your submission" (resume link) | MAIL-submission-saved-for-later |
| Saved-for-later page | `/{journal}/submission/saved?id=N` | — (PAGE-submission-saved, owned by submission-wizard) |
| Author draft list | `/{journal}/dashboard/mySubmissions?currentViewId=incomplete-submissions` | — (dashboard page owned by author-dashboard; incomplete view = Repository TYPE_INCOMPLETE_SUBMISSIONS) |
| Editor draft view | `/{journal}/dashboard/editorial?currentViewId=active` + Incomplete filter | — (dashboard page owned by editorial-dashboards) |
| Resume from list | Row **Complete submission** → `/{journal}/submission?id=N` (opens at saved step) | — (routing owned by submission-wizard) |
| Bulk-delete incomplete | `DELETE api/v1/_submissions?ids[]=…` (dashboard More Actions → Delete Incomplete Submissions) | API-backend-submissions-bulk-delete-incomplete-submissions |
| Single delete (workflow **Delete** button on a declined submission — not draft-only) | `DELETE api/v1/_submissions/{submissionId}` | API-backend-submissions-delete |
| Bulk-delete locale keys | `dashboard.submissions.incomplete.bulkDelete.*` (button/confirm/body/column) | LOC-submission-dashboard-submissions |
| Draft storage | `submissions.submission_progress` (non-empty = draft) | — (DB-submissions, shared; owned by submission-wizard) |

## Reference — code anchors

- lib/pkp/api/v1/submissions/PKPSubmissionController.php (`saveForLater` — step record, resume email, template fallback; `authorize` — no completeness guard)
- lib/pkp/api/v1/_submissions/PKPBackendSubmissionsController.php (`bulkDeleteIncompleteSubmissions` — note `getSubmissionCollector` default `->limit(30)` caps the verification query → >30-batch 404; `delete` — single, workflow Delete button target; `getSubmissionCollector` `isIncomplete`/`daysInactive`; route role lists SITE_ADMIN/MANAGER/AUTHOR; `authorize` SubmissionAccessPolicy on delete)
- lib/ui-library/src/pages/workflow/composables/useWorkflowActions.js (`workflowDeleteSubmission` → single `DELETE _submissions/{id}`); useWorkflowConfig/workflowConfigEditorialOJS.js (Delete button on declined submission, MANAGER/SITE_ADMIN)
- lib/pkp/classes/submission/Repository.php (`canCurrentUserDelete`, `delete`, `mapDashboardViews` TYPE_INCOMPLETE_SUBMISSIONS / TYPE_ACTIVE)
- lib/pkp/classes/submission/Collector.php (`filterByIncomplete` → `submission_progress <> ''`)
- lib/pkp/classes/mail/mailables/SubmissionSavedForLater.php; lib/pkp/locale/en/emails.po (`emails.submissionSavedForLater.*`)
- lib/pkp/schemas/submission.json (`submissionProgress` whitelist + `default`)
- lib/pkp/classes/components/listPanels/PKPSubmissionsListPanel.php (Incomplete filter); classes/components/listPanels/SubmissionsListPanel.php (OJS)
- lib/ui-library/src/pages/dashboard/composables/useDashboardBulkDelete.js (permissions + confirm dialog + apiCall); components/DashboardControlBulkActions.vue, DashboardControlBulkDeleteButton.vue, DashboardTable/DashboardCellBulkDelete.vue
- lib/ui-library/src/pages/dashboard/composables/useDashboardConfigEditorialActivity.js (`completeSubmission` / `openSubmissionWizard`); components/DashboardTable/DashboardCellSubmissionActions.vue (View suppressed for drafts); composables/useSubmission.js (`INCOMPLETE` extended stage)
- lib/pkp/pages/submission/PKPSubmissionHandler.php (`index` state routing, `saved` page); templates/submission/saved.tpl
