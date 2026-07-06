---
name: email-templates-management
scope: The manager's Manage Emails catalogue — browse every email the journal sends, edit/reset a mailable's default template, add/remove alternate templates, scope templates to roles — plus the site-admin bulk-email setup (per-journal enable + which roles may be bulk-emailed)
shared: pkp-lib
status: verified
e2e-plans: [email-templates-management]
atlas-claims:
  - PAGE-management-settings-manageemails
  - VUE-edit-mailable-modal
  - VUE-edit-template-modal
  - FORM-email-template-form
  - SCHEMA-email-template
  - FORM-pkp-restrict-bulk-emails-form
  - FORM-pkp-site-bulk-emails-form
  - API-email-template-get-many
  - API-email-template-get
  - API-email-template-add
  - API-email-template-edit
  - API-email-template-restore-defaults
  - API-email-template-delete
  - API-mailable-get-many
  - API-mailable-get
  - DB-email_templates
  - DB-email_templates_settings
  - DB-email_templates_default_data
  - DB-email_template_user_group_access
  - LOC-manager-emailTemplate-variable
  - LOC-manager-manager-emails
---

# Email templates management

## Purpose

Every email OJS sends — review invitations, decision notices, discussion
notifications, password resets — is a **mailable** with an editable **template**
(subject + body per locale). **Settings → Workflow → Emails → "Edit Templates"**
(or the direct `management/settings/manageEmails` URL) opens the **Manage Emails**
catalogue, where a journal manager can see every email the journal sends (name,
description, filterable by workflow stage and sender/recipient role), rewrite any
template, reset it to the shipped default, add **alternate templates** a sender can
pick in the email composer, and scope a template to specific roles (e.g. a
copyeditor-only variant). A separate, site-admin-only corner of the same story is
**bulk email**: the site admin decides per journal whether mass "Notify Users" email
is available at all, and which roles may never be bulk-emailed. This spec owns the
template/mailable management surface and the bulk-email *setup*; what each individual
email says and when it fires belongs to the feature that sends it, and the composer /
send pipeline belongs to `email-delivery`.

## Actors & permissions

Baselines: the page and every template write sit behind the one Area-6 **settings
gate** — site admin, or a manager whose manager role has settings access
(`CanAccessSettingsPolicy`; live: section editor → `authorizationDenied`).
"Composer users" below means the editorial roles that reach an email composer in
their own features (editors/section editors on decisions and reviewer assignment,
managers/sub-editors/assistants on participant notify) — those surfaces are owned
elsewhere; this spec owns which *templates* they are offered.

The settings gate is airtight here — unlike the reviewer-recommendations resource
(ledger row 124, which admits sub-editors to its writes), the templates controller
adds `CanAccessSettingsPolicy` to *every* route, so a section editor or assistant is
denied on the write verbs too (verifier live: SE/assistant PUT/POST/DELETE →
401, not merely blocked by the write-route role list). A manager whose manager role
lacks settings access is likewise bounced from the page and every API verb (verifier
live: page → access denied, `GET`/`PUT emailTemplates` → 401 with the scratch
journal's manager group `permit_settings` flipped off).

| Action | Who may — and when |
|--------|--------------------|
| **Open Manage Emails** (catalogue, filters, search) | • Site admin, manager with settings access — always<br>• Everyone else — no menu entry and direct URL is bounced (live: section editor → access denied) <sup>a</sup> |
| **Edit / reset a template, add / remove an alternate, Reset All** | • Site admin, manager with settings access — any template, any time <sup>b</sup> |
| **List / read templates over the API** (backs the composer's "Find Template" search) | • Site admin, manager — yes<br>• ⚠ Section editors and assistants are named in the endpoint's role list but the settings gate denies them anyway (401) — and the decision composer still shows them the search box; see Known deviations (row 127) <sup>c</sup> |
| **Be offered a template in a composer** | • Managers and site admins — always see every template of the mailable<br>• Other composer users — only templates marked "unrestricted" plus those assigned to one of their role groups (live: restricted alternate vanished from a section editor's Add-Reviewer picker, stayed for the manager) <sup>d</sup> |
| **Enable bulk email for a journal** | • Site admin only — Administration → Site Settings → Bulk Emails (per-journal checklist) <sup>e</sup> |
| **Restrict which roles may be bulk-emailed** | • Site admin only — Administration → Hosted Journals → journal Settings wizard → "Restrict Bulk Emails" tab (form shown only while the journal is bulk-enabled; otherwise the tab shows a pointer note)<br>• Managers — cannot, even over the API (server rejects: "Only an administrator is allowed to modify this setting.", live 400) <sup>f</sup> |

<sup>a</sup> `SettingsHandler::__construct()` (admin+manager on `settings`); `ManagementHandler::authorize()` + `CanAccessSettingsPolicy::effect()` ·
<sup>b</sup> `PKPEmailTemplateController::getGroupRoutes()` (write group: admin+manager) ·
<sup>c</sup> `PKPEmailTemplateController::getGroupRoutes()` (read group lists SUB_EDITOR/ASSISTANT) vs `PKPEmailTemplateController::authorize()` (`CanAccessSettingsPolicy`); `PKPMailableController::getRouteGroupMiddleware()` (mailables API: admin+manager only, live 401 for section editor) ·
<sup>d</sup> `Repository::isTemplateAccessibleToUser()`, `Repository::filterTemplatesByUserAccess()`; consumers: `ReviewerForm::getEmailTemplates()`, `AdvancedSearchReviewerForm`, `decision\steps\Email::getEmailTemplates()`, `PKPStageParticipantNotifyForm::fetch()` ·
<sup>e</sup> `AdminHandler::settings()` → `PKPSiteBulkEmailsForm`; `siteSettingsAvailability()` (`bulkEmails => true` even single-journal) ·
<sup>f</sup> `AdminHandler::wizard()` (form only when journal in site's enable list); `admin/contextSettings.tpl` (`{if $bulkEmailsEnabled}` else pointer note); `PKPContextService::validate()` (site-admin check on `disableBulkEmailUserGroups`)

## Fields & validation

Template editor (the "Edit Template" side modal; same form for edit and add):

| Field (UI label) | Required? | Rules | Anchor |
|------------------|-----------|-------|--------|
| Name | Yes (primary locale) | Per-locale text, max 255. For a *new* alternate the URL-safe key is derived from it (live: "ETM Friendly Request" → key `e-t-m-friendly-request`); the key is never shown or editable in the UI | `EmailTemplateForm` `name`; `DAO::getUniqueKey()` |
| Subject | Yes (primary locale) | Per-locale one-line text; template variables allowed | `subject` |
| Body | Yes (primary locale) | Per-locale rich text with an **Insert Content** palette listing exactly the variables this mailable supports, with descriptions | `body` (`FieldPreparedContent`); `Mailable::getDataDescriptions()`; `ManageEmailsPage.setCurrentTemplateForm()` |
| Mark as unrestricted / Limit access to specific roles | Yes (radio, default unrestricted) | Only shown for mailables whose templates are role-assignable (see rule 6); choosing "Limit access" reveals one checkbox per journal role group (all 18 stock groups, site admin never listed; live) | `isUnrestricted`; `EmailTemplateForm` (site-admin group excluded) |
| (role checkboxes) | No | Assigned groups must belong to this journal; unchecking all is accepted (template then reachable by managers only) | `assignedUserGroupIds`; `Repository::validate()` |

Missing required fields → inline "This field is required." per locale (live 400 on all
three). Multilingual: name/subject/body are entered per **form locale**; only the
journal's primary locale is enforced <sup>g</sup>.

Bulk-email setup forms (one field each):

| Field (UI label) | Where | Rules | Anchor |
|------------------|-------|-------|--------|
| "Enable the bulk emails feature for the selected journals" (journal checklist) | Site Settings → Bulk Emails | Site-wide list of journal IDs; a journal absent from the list has no Notify tab and its bulk endpoint refuses (live 403 "…has not been enabled for this journal.") | `PKPSiteBulkEmailsForm` (`enableBulkEmails`, site setting); `PKPEmailController::create()` |
| "Disable bulk emails to the following roles" (role checklist) | Hosted Journals → wizard → Restrict Bulk Emails | Journal setting; site-admin-only write (rule 12); checked groups disappear from the Notify form's role options and the send endpoint rejects them (live 400) | `PKPRestrictBulkEmailsForm` (`disableBulkEmailUserGroups`); `PKPNotifyUsersForm`; `PKPEmailController::create()` |

<sup>g</sup> `Repository::validate()` (`ValidatorFactory::required()` with `supportedFormLocales` / `primaryLocale`)

## Rules & state

1. **The catalogue lists every active mailable** — 66 in OJS (55 shared + 11
   OJS-specific such as subscription and payment notices), each with name,
   description, and one entry per mailable, sorted by name. Sidebar filters:
   workflow group (Submission / Review / Copyediting / Production / Other), Sent From
   (Editor, Reviewer, Assistant, Reader, Subscription Manager, System), Sent To (same
   minus System, plus Author); the search box matches name/description client-side.
   (Live: all filters and search present as manager on a scratch journal.)
   (`PKP\mail\Repository::map()` + `APP\mail\Repository::map()`;
   `ManagementHandler::manageEmails()` `getEmail{Group,From,To}Filters()`;
   `SettingsHandler::getEmail{From,To}Filters()` adds Subscription Manager;
   `manageEmails.tpl`; `ManageEmailsPage.currentMailables`)
2. **A mailable disappears from the catalogue while its journal setting disables
   it** — there is no on/off switch on this page. Statistics Report follows the
   Workflow → Emails "editorial statistics" toggle (live: 66 → 65 mailables after
   turning it off); the two submission acknowledgements follow the Submission
   Confirmation routing; Decision Notify Other Authors follows the notify-all-authors
   setting. Those switches are owned by `workflow-settings`. Existing template
   customizations survive the off period; while off, the mailable's key is also
   rejected as a target for new alternates (live 400, rule 5).
   (`Repository::isMailableEnabled()`; `Repo::mailable()->getMany()` called with
   include-disabled false from both the page and the API)
3. **Two kinds of edit flow.** Mailables that support extra templates (29) open a
   mailable modal — description, a Templates list with the default badged
   "Default", and an **Add Template** button; the other 37 (single-template
   mailables) jump straight into the template editor (live: Discussion (Submission)
   → modal with default + "Assign Editor" alternate; Password Reset Confirm →
   editor directly). (`Mailable::$supportsTemplates`;
   `ManageEmailsPage.openMailable()`; `EditMailableModal.vue`)
4. **Default templates are edited in place and reset, never deleted.** Every
   mailable ships a default template (installed per locale from the registry).
   Saving an edit stores a journal-local override that shadows the default from then
   on (live: subject/body override with marker, `id` assigned); **Reset** (offered
   only once modified) deletes the override and the shipped text returns instantly
   (live round-trip; a pristine default has no Reset button and a direct delete call
   answers 404). Resetting does *not* touch the template's role-access settings.
   (`email_templates_default_data` vs `email_templates` + settings;
   `DAO::fromRow()` merge; `PKPEmailTemplateController::delete()` (404 without
   `id`); `EditMailableModal.vue` Reset-vs-Remove buttons)
5. **Alternate templates.** "Add Template" creates a named extra template attached
   to the mailable; the composer then offers it alongside the default (live: new
   alternate appeared in the Add-Reviewer template picker for manager and section
   editor). The attachment target must be the default-template key of a currently
   *enabled* mailable (live: unknown key, disabled-mailable key, and another
   *alternate's* key — e.g. the stock COPYEDIT_REQUEST, which is itself an alternate,
   not a mailable default — all → 400 "This is not a default email template for a
   known email"). The check only verifies the target IS some mailable's default key,
   not that the mailable *supports* alternates: a hand-crafted API call can attach an
   alternate to a single-template mailable such as Password Reset Confirm (live 200),
   producing an inert orphan the UI never surfaces (single-template mailables open
   their editor directly and never list alternates) — API-only, harmless, Open
   question 5. Two alternates named identically get distinct auto-derived keys (the
   second suffixed, live `…-d-u-p` / `…-d-u-p0`) — no collision. Alternates are
   removable ("Remove", with a confirm naming the template) — removal also drops
   their role-access data. Six stock alternates ship with every journal, all
   attached to the four Discussion mailables: Copyedit Request, Assign Editor
   (submission/review/production variants), Layout Request, Layout Complete —
   they behave exactly like user-created alternates (editable, removable).
   (`alternateTo` + `Repository::validate()`; `registry/emailTemplates.xml`
   `alternateTo` entries; `DAO::installAlternateEmailTemplates()`;
   `PKPEmailTemplateController::delete()` + `deleteTemplateGroupAccess()`)
6. **Role-scoped template access.** Each template is either **unrestricted**
   (default; every composer user may load it) or **limited** to chosen role groups.
   Managers and site admins always see everything, so restriction only affects the
   other composer users (rule and both directions live-verified in the
   Add-Reviewer picker: alternate limited to Authors → gone for the section editor,
   still listed for the manager; adding the Section-editor group brought it back).
   The access radio/checkboxes appear only for mailables whose sender is a real role
   and whose group is a workflow stage — system-sent or "Other" mailables (e.g.
   Password Reset) hide them. All shipped templates start unrestricted (live: fresh
   journal seeds one unrestricted marker per registry template).
   (`email_template_user_group_access` — unrestricted = a NULL-group row:
   `Repository::isTemplateUnrestricted()` / `markTemplateAsUnrestricted()`;
   `Repository::isGroupsAssignableToTemplates()` (not FROM_SYSTEM, not
   GROUP_OTHER); `ManageEmailsPage.setCurrentTemplateForm()` strips the two fields;
   `DAO::installEmailTemplates()` `recordTemplateGroupAccess`)
7. ⚠ **Saving a template without the access fields silently wipes its access
   settings.** The save treats "no access fields submitted" as "assign to nobody":
   the unrestricted marker and any group assignments are deleted, leaving the
   template visible to managers/admins only. For role-assignable mailables the UI
   always submits the radio, so the wipe is API-only there — but for the
   non-assignable mailables of rule 6 the editor omits the fields by design, so
   *every UI edit* of e.g. Password Reset Confirm wipes its unrestricted marker
   (verifier drove the **real** Manage-Emails modal: the access radio is absent, and
   a body-only save deleted the NULL marker 1→0 live). It carries no user-facing
   symptom because those mailables have no non-manager composer consumers and the
   send loads by key without an access check (rule 9). The consequential wipe — an
   *assignable* template flipping to manager-only, changing who may compose it — is
   **not reachable through the UI**: editing a role-restricted alternate's body in
   the real editor keeps the radio + group checkboxes populated, so the restriction
   survives (verifier live: Author restriction intact after a UI body edit). It is
   reachable only by an API PUT that omits the fields. Ledger row 128.
   (`PKPEmailTemplateController::edit()`
   (`assignedUserGroupIds ?: []`); `Repository::updateTemplateAccessGroups()`
   (`whereNotIn` with empty list deletes every row incl. the NULL marker))
8. **Reset All** (button on the catalogue header, warning dialog "…all
   modifications to the email templates will be lost") deletes **every**
   journal-local template row: default-template overrides revert to shipped text,
   role-access customizations revert to shipped defaults, the six stock alternates
   are deleted and immediately re-installed fresh — and **user-created alternates
   are permanently deleted**, not reset (live: returned key list contained the two
   edited defaults, the six stock alternates and the custom template; afterwards the
   custom answered 404, overrides were gone, a previously wiped unrestricted marker
   was healed). A custom alternate that is *in use* — restricted to a role group — is
   deleted regardless, and its access rows go with it (verifier live: role-restricted
   custom → 404 after Reset All, its `email_template_user_group_access` rows 1→0), so
   the restriction is silently discarded but leaves no dangling reference.
   (`Repository::restoreDefaults()`;
   `DAO::setTemplateDefaultUnrestirctedSetting()`;
   `ManageEmailsPage.confirmResetAll()`)
9. **Composer effect-links** (the point of the whole page): the composer surfaces
   pre-load the mailable's default template body and offer the default + accessible
   alternates in a picker. Live: an edited Review Request body showed up verbatim in
   the Add-Reviewer form; the sent-mail side (edited Submission Accepted marker
   arriving in the author's inbox with variables rendered) is pinned by the retained
   e2e test. Send-time code loads templates by key without access checks — access
   only filters what the picker *offers*. (`ReviewerForm::getEmailTemplates()`;
   `decision\steps\Email::getEmailTemplates()`; `ReviewerAction::getResponseEmail()`
   `getByKey()`; e2e `lib/pkp/playwright/tests/email-templates.spec.js` test 5)
10. **Template search over the API** (subject/body/key match, paginated, max 100)
    backs the composer's "Find Template" box — in practice for managers only, see
    ⚠ row 127. The catalogue page itself never uses it (client-side search, rule 1).
    (`PKPEmailTemplateController::getMany()`; `Collector::searchPhrase()` —
    defaults UNION customs)
11. **Bulk-email availability is a two-level gate.** Level 1 (site): a journal must
    be checked on Site Settings → Bulk Emails for its Users & Roles page to grow the
    Notify tab and for the bulk-send endpoint to accept anything (live: form config
    absent + 403 with it unchecked; present + accepted after checking). Level 2
    (journal, site-admin-set): roles listed in "Restrict Bulk Emails" are removed
    from the Notify form's recipient options and refused server-side (live: Reader
    group checked → dropped from the 17 offered options, direct send → 400 "You are
    not allowed to send an email to users in one or more of the selected roles.").
    The Notify *flow* is `user-management`'s; the job/composer are
    `email-delivery`'s. (`ManagementHandler::access()`; `PKPNotifyUsersForm`;
    `PKPEmailController::create()`; `AdminHandler::wizard()`)
12. **Only a site admin may change the bulk-email restriction** — the wizard tab
    lives on the admin-only Hosted Journals wizard, and the underlying journal
    setting rejects non-admin writers regardless of transport (live: manager PUT →
    400 "Only an administrator is allowed to modify this setting."; admin PUT →
    stored). While a journal is not bulk-enabled the tab still shows, with a note
    linking to Site Settings instead of the form. (`PKPContextService::validate()`;
    `admin/contextSettings.tpl`)

## Side effects

- Template edits/resets have **no side effects of their own** — no notification, no
  email, no event-log entry; they simply change what every subsequent composer
  prefill and send renders (rule 9).
- Reset All permanently discards user-created alternates (rule 8) — the only
  destructive path in the feature.
- Enabling bulk email for a journal changes that journal's Users & Roles page
  (Notify tab appears) and unlocks the `_email` bulk endpoint; the send itself
  (job batches, Mailpit-visible mail) belongs to `email-delivery`.

## Settings that modify behavior

- **Workflow → Emails toggles** (`editorialStatsEmail`, `submissionAcknowledgement`,
  `notifyAllAuthors`, owned by `workflow-settings`) — hide/show their mailables in
  this catalogue and gate their sends (rule 2).
- **Site `enableBulkEmails`** (Site Settings → Bulk Emails) — per-journal gate for
  the whole bulk-email feature (rules 11–12).
- **Journal `disableBulkEmailUserGroups`** — per-role bulk-email exclusion
  (rules 11–12).
- Journal **form locales** decide which locale tabs the template editor offers
  (Fields).

## Cross-feature interactions

- **workflow-settings (58)** — owns the Workflow → Emails tab, including the
  "Email Templates → Edit Templates" pointer into this page, the signature setting
  (`{$contextSignature}` vs sender `{$signature}` — documented there) and the
  enable/disable toggles of rule 2.
- **Individual mailables** — each MAIL-* atom (what the email says, when it fires,
  its recipients) is owned by the feature that sends it (editorial-decisions,
  assign-and-manage-reviewers, user-management, …). This spec owns only the
  CRUD-over-templates surface that all of them share.
- **email-delivery (66)** — the composer component, variable rendering at send time,
  the `_email` bulk-send job and the email log.
- **user-management (50)** — the Notify Users flow (form + tab) that the bulk-email
  gate reveals; documented there, gate + restriction owned here.
- **site-administration / site-settings** — host the two admin surfaces (Site
  Settings page, Hosted Journals wizard) on which the bulk forms mount; the forms
  themselves are claimed here.
- **languages-locales** — multilingual template entry per form locale.

## Canonical scenarios

1. **Browse the email catalogue** — Manager: opens Manage Emails, sees all
   66 mailables with descriptions, narrows by "Review" group + Sent From "System",
   searches by name; a section editor hitting the same URL is bounced to access
   denied. (Live-verified.)
2. **Rewrite a default template and see it used** — Manager: edits Review Request's
   subject/body (marker text), saves; the Add-Reviewer composer now prefills the
   marker body, and a recorded Accept decision delivers the edited text with
   variables rendered (e2e test 5). (Composer link live-verified.)
3. **Reset a modified template** — Manager: opens the modified template's mailable,
   uses Reset (confirm dialog), and the shipped subject/body are back immediately;
   the Reset button disappears again. (Live-verified via the delete-reset API
   round-trip + UI buttons.)
4. **Offer an alternate template** — Manager: Add Template on Review Request, names
   it, writes a body, saves unrestricted; a section editor's Add-Reviewer picker now
   lists it next to the default; Remove deletes it after a confirm. (Live-verified.)
5. **Limit a template to specific roles** — Manager: flips the alternate to "Limit
   access", checks only Authors; the section editor's picker loses it while the
   manager keeps seeing it; adding the Section-editor group restores it for them.
   (Live-verified.)
6. **Reset all templates** — Manager: Reset All → warning → every override reverts,
   the stock alternates are re-installed pristine, and the custom alternate from
   scenario 4 is gone for good. (Live-verified.)
7. **Set up bulk email** — Site admin: checks a journal on Site Settings → Bulk
   Emails; that journal's Users & Roles grows the Notify tab, and the Hosted-Journals
   wizard's Restrict Bulk Emails tab now shows the role form; admin excludes
   Readers → the Notify form stops offering Readers and a direct send to them is
   refused; the journal's manager can neither reach the wizard nor store the
   restriction (400 admin-only). Unchecking the journal returns the bulk endpoint to
   403-disabled. (Live-verified end to end.)

## Known deviations (as-built ≠ intent)

- ⚠ **Row 127 (new)** — The decision wizard's email step shows section editors a
  "Find Template" search box whose backing endpoint always denies them: typing fires
  `GET /emailTemplates?searchPhrase=…` → 401 and an "Error — You are not authorized
  to access the requested resource." modal (live-driven in the browser as a section
  editor recording Accept). Root: the read routes name sub-editors/assistants, but
  the controller's `CanAccessSettingsPolicy` vetoes them — the role-list entries are
  dead letter, and every Composer search box backed by this endpoint (decision
  wizard, request-author-response page) breaks for non-managers while the preloaded
  templates keep working. **Bound (verifier 2026-07-06):** both section editors and
  assistants get 401 from `GET /emailTemplates` and `GET /mailables`, but the broken
  search box is section-editor-facing only — it renders on the decision wizard and
  the request-author-response page (both fed `emailTemplatesApiUrl` by
  `DecisionHandler`/`RequestReviewResponsePage`, surfaces assistants don't reach);
  the assistant's role-list entry is thus dead letter with no UI surface at all.
- ⚠ **Row 128 (new)** — Rule 7's access-wipe on save: template edits that omit the
  access fields delete the unrestricted marker + group assignments (API-only for
  role-assignable mailables; every UI edit for non-assignable ones). Reset All heals
  it; single reset does not. **Severity LOW confirmed (verifier 2026-07-06):** the
  only UI-reachable wipe is on non-assignable mailables, which have no non-manager
  composer consumers → no functional effect; the consequential wipe (an assignable
  template becoming manager-only) is API-only — a real-UI body edit of a
  role-restricted alternate leaves the restriction intact. The hypothesis that a
  routine UI body-edit silently breaks who-may-compose is refuted for the templates
  where it would matter.
- **Row 129 (new, cosmetic)** — (a) "Add Template" opens a modal titled "Edit
  Template" (the add-title branch is unreachable — live). (b) The catalogue's Edit
  buttons show hardcoded English "Edit" (template literal, only the screen-reader
  label is localized).
- **Dead code (not a ledger row)** — the templates DAO still maps an `enabled`
  column that no longer exists on `email_templates` (removed with the 3.4→3.5
  mailable refactor; `Mailable::$canDisable` likewise has no consumer). Harmless:
  the schema has no such property. (`DAO::$primaryTableColumns`;
  `Mailable::canDisable()`)

## Open questions

1. Row 127: is the intent for sub-editors/assistants to *read* templates (then the
   settings policy should exempt the read routes) or manager-only (then the composer
   should hide the search box for them)? One-line answer decides the fix side.
2. Rule 7 / row 128: for non-assignable mailables, should template access filtering
   apply at all? (`isGroupsAssignableToTemplates` gates only the UI fields and the
   reported group list, while the access *check* applies to every template.)
3. Should the Reset All confirm call out that user-created alternates are
   **deleted permanently** (current copy says only "all modifications … will be
   lost")?
4. The templates API is context-bound (`ContextRequiredPolicy`), yet the data model
   supports site-level templates (`fromRow()` handles the site context) — is a
   site-level Manage Emails ever planned, or is that path dead?
5. `Repository::validate()` accepts an `alternateTo` that names any mailable's
   default key, including single-template mailables that do not support alternates
   (live: an alternate attached to Password Reset Confirm is created but never
   surfaces). Should the validator also require `Mailable::getSupportsTemplates()`,
   to reject the inert orphan? (API-only, harmless today.)

---

## Reference — entry points & surfaces

| Entry | Path | Atom |
|-------|------|------|
| Manage Emails page | Settings → Workflow → Emails → "Edit Templates" link → `{journal}/management/settings/manageEmails` | PAGE-management-settings-manageemails |
| Mailable modal / template editor | side modals on that page | VUE-edit-mailable-modal, VUE-edit-template-modal |
| Template form | `EmailTemplateForm` (`editEmailTemplate`) | FORM-email-template-form, SCHEMA-email-template |
| Templates API | `GET/POST /api/v1/emailTemplates`, `GET/PUT/DELETE /emailTemplates/{key}`, `DELETE /emailTemplates/restoreDefaults` | API-email-template-{get-many,get,add,edit,delete,restore-defaults} |
| Mailables API | `GET /api/v1/mailables`, `GET /mailables/{key}` | API-mailable-{get-many,get} |
| Storage | overrides/customs + settings, shipped defaults, role access | DB-email_templates, DB-email_templates_settings, DB-email_templates_default_data, DB-email_template_user_group_access |
| Site bulk-email gate | Administration → Site Settings → Bulk Emails (`admin/settings#setup/bulkEmails`) | FORM-pkp-site-bulk-emails-form |
| Per-journal restriction | Administration → Hosted Journals → Settings wizard → Restrict Bulk Emails (`admin/wizard/{id}`) | FORM-pkp-restrict-bulk-emails-form |
| UI strings | `manager.emails.*`, `emailTemplate.variable.*` (the Insert Content palette descriptions) | LOC-manager-manager-emails, LOC-manager-emailTemplate-variable |

## Reference — code anchors

- Page: `lib/pkp/pages/management/ManagementHandler.php` `manageEmails()` +
  `getEmailTemplateForm()` + filter getters; `pages/management/SettingsHandler.php`
  (role assignment, subscription-manager filter rows);
  `lib/pkp/templates/management/manageEmails.tpl`.
- Vue: `lib/ui-library/src/components/Container/ManageEmailsPage.vue` (list, search,
  reset-all/reset/remove dialogs, form wiring);
  `lib/ui-library/src/pages/manageEmails/EditMailableModal.vue`, `EditTemplateModal.vue`.
- Model: `lib/pkp/classes/emailTemplate/` `Repository.php` (validate, access
  model, restoreDefaults), `DAO.php` (default-data merge, alternate install, unique
  key), `Collector.php` (defaults-UNION-customs, isModified, alternateTo),
  `EmailTemplateAccessGroup.php`, `maps/Schema.php`; `lib/pkp/schemas/emailTemplate.json`.
- Mailables: `lib/pkp/classes/mail/Repository.php` (map, isMailableEnabled,
  summarize/describe, isGroupsAssignableToTemplates), `classes/mail/Repository.php`
  (OJS additions), `lib/pkp/classes/mail/Mailable.php`, `traits/Configurable.php`.
- API: `lib/pkp/api/v1/emailTemplates/PKPEmailTemplateController.php`,
  `lib/pkp/api/v1/mailables/PKPMailableController.php`.
- Bulk email: `lib/pkp/classes/components/forms/site/PKPSiteBulkEmailsForm.php`,
  `…/context/PKPRestrictBulkEmailsForm.php`, `lib/pkp/pages/admin/AdminHandler.php`
  (`settings()`, `wizard()`), `lib/pkp/classes/services/PKPContextService.php`
  (admin-only validation), `lib/pkp/api/v1/_email/PKPEmailController.php`
  (enforcement), `lib/pkp/classes/components/forms/context/PKPNotifyUsersForm.php`
  (option exclusion).
- Registry/install: `registry/emailTemplates.xml` (74 defaults, 6 `alternateTo`
  entries), `lib/pkp/classes/migration/install/CommonMigration.php` +
  `EmailTemplateUserGroupAccessMigration.php`.
