---
name: user-invitations
scope: A manager (or site admin) invites a new email or an existing user to one or more roles by email; the invitee accepts through a multi-step wizard (a new person creates their account there) or declines through the link — the 3.6 invitation framework for role assignment, plus the pending-invitation list and the expiry job
shared: pkp-lib          # the whole invitation framework — Invitation/InvitationModel, InvitationController (/invitations REST), InvitationHandler + InitializeInvitationUIHandler pages, the UserRoleAssignmentInvite type, the accept/send Vue wizards and the RemoveExpiredInvitations job — lives in lib/pkp; OJS only supplies the journal context and its user groups
status: verified         # adversarial verifier 2026-07-05: live-re-confirmed (retained spec green); magic-link claim corrected (accept link grants no browsable session), row 115 + empty-body + expiry re-verified
e2e-plans: []            # no retained round-1 plan maps to the 3.6 invitation wizard yet
atlas-claims:
  - PAGE-invitation-accept
  - PAGE-invitation-decline
  - PAGE-invitation-confirmdecline
  - PAGE-invitation-create
  - PAGE-invitation-edit
  - VUE-accept-invitation-page
  - VUE-user-invitation-page
  - VUE-user-invitation-manager
  - API-invitation-get-many
  - API-invitation-get
  - API-invitation-add
  - API-invitation-populate
  - API-invitation-invite
  - API-invitation-get-mailable
  - API-invitation-cancel
  - API-invitation-receive
  - API-invitation-finalize
  - API-invitation-refine
  - API-invitation-decline
  - DB-invitations
  - MAIL-user-role-assignment-invitation-notify
  - JOB-removeexpiredinvitationsjob
  - FORM-accept-user-details-form
  - FORM-user-details-form
---

# User invitations (invite to a role; accept/decline wizard; expiry)

## Purpose

3.6 replaced "a manager types out a new user's account" with an **invitation** handshake. A manager (or site
admin) — and, as-built, a **section editor** or **production assistant** — opens the **invite wizard**, enters a
person's **email** (a brand-new address *or* an existing user), picks one or more **roles** (with an optional start/end
date and masthead flag), composes the **invitation email**, and sends it. The invitee gets a **"You are invited to new
roles"** email carrying an **accept** link and a **decline** link. Following the accept link runs a **multi-step
accept wizard**: a **new person** fills in a username, password and their name/affiliation/country and **their account
is created, enabled and role-assigned in one step**; an **existing user** simply **reviews and accepts**, which **adds
the new role(s)**. Accepting does **not** log the invitee in — after accepting they are sent to the **login page** to
sign in (the account is ready to use immediately with the credentials they just chose). Declining (with a confirm step)
closes the invitation. The manager watches a **pending-invitation list** on the Users & Roles page where they can
**edit**, **re-send** or **cancel** an outstanding invite. Every invitation carries a bcrypt-hashed key and a **3-day
expiry**; a **daily job** deletes expired ones.

This spec owns the **invitation framework itself** — the `invitations` table, the invitation REST API, the accept/
decline/create/edit pages and the two Vue wizards — and the **role-assignment invitation type** (`userRoleAssignment`).
It does **not** own the two other invitation *types* that reuse the same framework: account **activation**
(`RegistrationAccessInvite`, owned by `registration-login`) and **email-change confirmation**
(`ChangeProfileEmailInvite`, used by `user-profile`). It does not own the **direct** create/edit/disable/merge of users
(`user-management`), the **role/user-group definitions** (`roles-permissions`), or **login** (`registration-login`).

## Actors & permissions

**Where it lives.** Settings → Users & Roles → **Users** renders two Vue managers: the users list
(`<user-access-manager>`, `roles-permissions`) and — this feature — the **pending-invitation manager**
(`<user-invitation-manager>`), whose **Invite** action opens the send wizard. **Reaching the Users & Roles page** needs
manager/admin settings access; but the **invite wizard page and the create-side API themselves** are gated only to
`[site admin, manager, section editor (sub-editor), assistant]` (no per-route narrowing), so an editor/assistant who
navigates straight to the wizard URL reaches it even without the Users & Roles nav link. **Accept and decline are
public** — anyone holding the emailed link (the secret key) may act, no login required. Terms: the **inviter** is who
creates/sends; the **invitee** is the email/user being invited; an **existing user** is an invitee who already has an
account, a **new invitee** is an email with no account yet. <sup>a</sup>

| Action | Who may — and when |
|--------|--------------------|
| **Invite a person to role(s)** (open the send wizard, `add`/`populate`/`invite`) | • Site admin, manager — any time<br>• Section editor, production assistant — **also permitted** as-built (the create-side routes admit them); no nav button on the manager-gated Users & Roles page, but the wizard URL + API are reachable. ⚠ they can grant **any** role, including **Journal manager** — see Known deviations <sup>b</sup> |
| **Choose the invitee** | • Inviter — a **new email** (no account yet) **or** an **existing user** (picked in the wizard's search step); the two are mutually exclusive on one invitation <sup>c</sup> |
| **Manage pending invitations** (list, edit, re-send, cancel) | • The same four roles — the pending list, the per-row **edit** (re-opens the wizard) and **cancel** live behind the create-side gate <sup>d</sup> |
| **Accept an invitation** | • The **invitee via the emailed link** — anonymous for a new invitee (must **not** be logged in as someone else); for an existing-user invitee the receive request **authenticates as that user for that request only** (on the emailed key, so `refine`/`finalize` act as them) and only that same user may accept (a *different* logged-in user is refused). Following the link does **not** grant a browsable session — it is not a magic-link (Rule 5) <sup>e</sup> |
| **Decline an invitation** | • The **invitee via the emailed decline link** — a two-step confirm (a POST); only while the invitation is still pending <sup>f</sup> |
| **Directly create/edit/disable/merge a user** | • Not here — that is `user-management` (manager/admin only). The invite path is the 3.6 *create* route but is **wider** (more roles may invite; any role may be granted) — see Known deviations |

<sup>a</sup> `InvitationController::getGroupRoutes()` (`roleAuthorizer([SITE_ADMIN, MANAGER, SUB_EDITOR, ASSISTANT])` on the create-side group; the receive routes sit **outside** the group + `PublicAccessPolicy`); `access.tpl` (`<user-invitation-manager>`); `UserInvitationManagerStore.createNewInvitation()` (`invitation/create/userRoleAssignment`) ·
<sup>b</sup> `InitializeInvitationUIHandler::__construct()`/`authorize()` (same four roles for `create`/`edit`; `ContextAccessPolicy`); live 2026-07-05: section editor `dbuskins` reached the create page (200) and drove `add`/`populate`/`invite` (200); reviewer `jjanssen` refused (401). ⚠ ledger row 115 ·
<sup>c</sup> `InvitationController::add()` (`userId` **xor** `inviteeEmail`, `Rule::prohibitedIf`); `Invitation::initialize()` (if `userId` set, `email` nulled) ·
<sup>d</sup> `UserInvitationManagerStore` (`invitations/userRoleAssignment` list, `invitation/edit/{id}`, `invitations/{id}/cancel`); `UserRoleAssignmentCreateController::getMany()`/`cancel()` ·
<sup>e</sup> `UserRoleAssignmentReceiveController::authorize()` (new invitee → `AnonymousUserPolicy`; existing → `Validation::registerUserSession($user)` **for that request only** + `UserRequiredPolicy`; a *different* logged-in user → `AuthorizationPolicy` deny). The per-request registration does **not** persist as a browsable session — **live-verified 2026-07-05**: after loading an existing-user accept link the invitee's `GET /users/{self}` → 401 and `/user/profile` bounces to login ·
<sup>f</sup> `InvitationHandler::confirmDecline()` (POST + CSRF); `InvitationActionRedirectController::declineHandle()` / `UserRoleAssignmentInviteRedirectController::confirmDecline()` (`GoneHttpException` unless `PENDING`)

## Fields & validation

**Send wizard** (`UserInvitationPage.vue`; steps built by `SendInvitationStep`). Step 1 **Search user** (only when
inviting from scratch) picks a new email or an existing user; step 2 **Enter details** (`UserDetailsForm`) captures the
identity + roles; step 3 **Send email** (`UserInvitationEmailComposerStep`) composes the message.

| Field (UI label) | Required? | Rules | Anchor |
|------------------|-----------|-------|--------|
| **Email** (`inviteeEmail`) | Yes (new invitee) | Valid email. For an existing-user invite the user is chosen instead (userId), and email/name/affiliation are **prohibited** on the payload. | `UserDetailsForm` (`FieldText inviteeEmail isRequired`); `InvitationController::add()` (email/userId xor) |
| **ORCID** | No | Shown only when ORCID is enabled; filled by the OAuth widget, not typed. | `UserDetailsForm` (`OrcidManager::isEnabled()` → `FieldHTML orcid`) |
| **First / Last name** (`givenName`,`familyName`) | No (optional at invite) | Multilingual; shown for the context primary locale **plus** the site primary locale (so the fallback name isn't left blank). Prohibited for an existing-user invite. | `UserDetailsForm` (`FieldText …isMultilingual`); `UserRoleAssignmentInvitePayload::getValidationRules()` (`ProhibitedIncludingNull` when `userId` set) |
| **Roles to assign** (`userGroupsToAdd[]`) | Yes (at send) | One or more **user groups** in the context, each with a **start date** (required), optional **end date**, and a **masthead** on/off flag. A role the user already holds is rejected; the group must exist in the context. | `UserRoleAssignmentInvitePayload` (`userGroupsToAdd.*` — `userGroupId` `UserGroupExistsRule`+`AddUserGroupRule`, `dateStart` required date, `masthead` required bool); required at `VALIDATION_CONTEXT_INVITE` |
| **Email subject / body** (`emailComposer`) | Pre-filled | Seeded from the `USER_ROLE_ASSIGNMENT_INVITATION` template (which embeds the accept/decline URLs) and editable before send. | `SendInvitationStep::invitationInvitedEmail()`; `UserRoleAssignmentInvite::getMailable()` (`emailComposer.subject/body` override the template) |

**Accept wizard — new invitee only** (`AcceptInvitationPage.vue`; steps by `AcceptInvitationStep`). An existing-user
invitee skips the account/details steps and sees only the review (and an ORCID step if enabled). A new invitee fills:

| Field (UI label) | Required? | Rules | Anchor |
|------------------|-----------|-------|--------|
| **Username** | Yes | Unique; ≤32; paired with password (one requires the other). | `UserRoleAssignmentInvitePayload` (`username` `UsernameExistsRule`, `required_with:password`, `max:32`); required at `FINALIZE` for a new user |
| **Password** | Yes | ≥ site minimum length; **not a breached password** (uncompromised check). | `UserRoleAssignmentInvitePayload` (`password` `Password::min($site->getMinPasswordLength())->uncompromised()`) |
| **Privacy consent** | Yes | The account-details step validates a privacy-statement acceptance. | `AcceptInvitationStep::userAccountDetailsStep()` (`validateFields` incl. `privacyStatement`) |
| **First name / Country** | Yes | Given name required in the context primary locale; country required. Last name + affiliation optional, multilingual. | `AcceptUserDetailsForm`; `UserRoleAssignmentInvitePayload` (`givenName.{primaryLocale}` + `userCountry` required at `REFINE`/`FINALIZE`) |

## Rules & state

1. **Two actors, one record, five states.** An invitation is a row in **`invitations`** (type, key hash, invitee
   `user_id` **or** `email`, `inviter_id`, context, JSON **payload**, **expiry date**, **status**). Its status walks
   **Yet-to-send → Sent → Accepted / Declined / Cancelled** (internally `INITIALIZED → PENDING → ACCEPTED / DECLINED /
   CANCELLED`). The create side (`get`/`populate`/`invite`/`getMailable`) is allowed **only while INITIALIZED**; the
   receive side (`receive`/`finalize`/`refine`/`decline`) **only while PENDING** — the controller rejects an action
   whose status doesn't match. **Live-verified**: the whole path INITIALIZED→PENDING→ACCEPTED driven end-to-end.
   <sup>a</sup>
2. **Creating an invitation is add → populate → invite.** The wizard first **adds** an INITIALIZED shell for a
   **new email XOR an existing userId** (supplying both is rejected), **populates** the payload (roles, name, the
   email composer) across the wizard steps, then **invites**: this validates the invite (at least one role,
   `userGroupsToAdd` required), **generates a random key**, stores its **bcrypt hash**, stamps the **expiry** (now + 3
   days), **sends the email**, and flips the status to **Sent/PENDING**. Sending also **deletes any other pending
   invitation** of the same type for the same user/email+context (so a re-send supersedes). **Live-verified**: a new-email
   invite returned `PENDING` with `expiryDate = now+3d`. <sup>b</sup>
3. **The invitation email.** On invite, a **"You are invited to new roles"** message
   (`UserRoleAssignmentInvitationNotify`, template `USER_ROLE_ASSIGNMENT_INVITATION`) is sent **from the inviter's
   address** to the invitee (their existing email, or the new email). It lists the **roles being added** (and, for an
   existing user, their **current roles**) and carries an **Accept** link and a **Decline** link, each of the form
   `…/invitation/accept?id={id}&key={key}` / `…/invitation/decline?…` — the only place the raw key is exposed (only its
   hash is stored). **Live-verified**: the mail arrived from `dbarnes@…` with both URLs. <sup>c</sup>
4. **Accept — a NEW invitee: account created, enabled, role-assigned (then sent to login).** Following the accept link loads the
   **accept wizard** (`acceptInvitation.tpl` → `AcceptInvitationPage`). A new invitee walks **(ORCID verify, if
   enabled) → account details (username/password/consent) → your details (name/affiliation/country) → review**, each
   step **refining** the stored payload. **Finalize** then **creates the user** — username, name, email (the invited
   address), country, affiliation, `date_registered = now`, inline help on, the **chosen password** — **assigns every
   role** in `userGroupsToAdd` (honouring its start/end date and masthead flag), and marks the invitation **Accepted**.
   The account is **usable immediately** — no email-validation step and no forced password change (the invitee just set
   their own password) — **but accepting does not log them in**: the accept flow ends on a success dialog that redirects
   to the journal (a login-gated page), so a new invitee lands on the **login page** and signs in with the credentials
   they just chose. The new-invitee receive path is anonymous (`AnonymousUserPolicy`); `registerUserSession` is **not**
   called for them and `finalize` creates the account without a session. **Live-verified 2026-07-05**: refine+finalize
   created an **enabled** account (id 288) holding the Reviewer role with no activation step, and the invitee's browser
   was **not** authenticated afterward (`GET /users/{self}` → 401, `/user/profile` → login, `window.pkp.currentUser`
   null). <sup>d</sup>
5. **Accept — an EXISTING user: roles added, no new account, and NOT a magic-link.** If the invitee already has an
   account (or an invited *new* email that has since become an account — the link **rebinds** to that user), the wizard
   shows only the **review** step (plus ORCID if unverified). To authorize the receive-side API calls, the receive
   request **registers that user in the session for the duration of that request** (on the strength of the emailed key),
   so `refine`/`finalize` act as them; a *different* already-logged-in user is refused. Crucially this is **not** a
   magic-link — it does **not** establish a browsable login: following the accept link leaves the holder **anonymous**
   (they can accept the invitation but cannot browse as the account, and are sent to login afterward). **Finalize** skips
   account creation and just **adds the invited role(s)** to the existing user. **Live-verified**: inviting existing user
   187 to the Author role and accepting left 187 with **both** Reviewer and Author, with no account re-creation — and the
   accept link granted **no** session (`GET /users/{self}` → 401, `/user/profile` → login). <sup>e</sup>
6. **Decline is a two-step confirm.** The **decline** link shows a confirmation page (`declineInvitation.tpl`) with a
   **Decline** button that **POSTs** (CSRF-checked) to **confirm-decline**; confirming marks the invitation **Declined**
   and redirects to login. Both the decline page and the confirm are refused (**Gone**) once the invitation is no longer
   pending. **Live-verified**: decline page → confirm → API decline returned 200; status Declined. <sup>f</sup>
7. **The manager's pending-invitation list.** `<user-invitation-manager>` lists the context's **still-active** invitations
   (PENDING **and** not expired), paginated (5/page). Per row the manager may **Edit** (re-open the wizard at
   `invitation/edit/{id}` to change roles/details and re-send) or **Cancel** (marks the invitation **Cancelled**). A
   cancelled/accepted/declined/expired invitation drops off the list. There is no one-click "resend" — re-sending is
   editing then inviting again (which supersedes the prior send, Rule 2). **Live-verified**: cancelling the sole pending
   invite dropped the list to zero; accepted/declined/cancelled never appeared. <sup>g</sup>
8. **The key, the expiry window, and the payload.** The invite **key** is a generated password hashed with **bcrypt**
   (`password_hash`), verified on the accept/decline link. The **expiry** is **now + 3 days** by default, configurable
   via `config.inc.php [invitations] expiration_days`, and is fixed at send time (it cannot change afterward). The
   **payload** JSON carries everything gathered in the wizard (roles, name, ORCID, the email composer, and — for a new
   invitee — the username and **bcrypt-encrypted** password, which is sealed before storage). Some payload fields are
   **stage-locked**: username/password/ORCID cannot be set *before* send, and the role list cannot change *after* send.
   **Live-verified**: `expiryDate` = create-day + 3. <sup>h</sup>
9. **Expiry is swept daily.** A scheduled task **RemoveExpiredInvitations** — wired **daily** in the app scheduler —
   dispatches **RemoveExpiredInvitationsJob**, which **deletes** every expired invitation (`expiry_date` in the past).
   Because the "expired" scope also matches a **null** expiry, INITIALIZED drafts (which have no expiry until sent) are
   swept too — i.e. abandoned, never-sent invitation shells are garbage-collected by the same job. The job is live and
   scheduled (contrast a dead scheduled task). <sup>i</sup>
10. **A used / expired / invalid link is a friendly dead end, not a 404.** Opening an accept/decline link whose
    invitation is **already handled or expired** — the key still verifies against the stored hash but the row is no
    longer actionable — shows an **"invitation no longer available"** landing page (with login/register links) rather
    than an error. A link whose id/key don't match any invitation is a plain **404**. The public receive API rejects a
    non-pending invitation outright. **Live-verified**: an accepted invitation's link → the "no longer available" page;
    the receive API for it → 401. <sup>j</sup>

<sup>a</sup> `InvitationsMigration` (columns); `InvitationModel` (casts, `status`); `InvitationController::authorize()` (`actionsInvite`→INITIALIZED, `actionsReceive`→PENDING guards); `InvitationStatus` enum ·
<sup>b</sup> `InvitationController::add()` (userId/email xor → `Invitation::initialize()`, which deletes prior INITIALIZED dupes); `UserRoleAssignmentCreateController::populate()`/`invite()`; `Invitation::invite()` (`validate(INVITE)`, `checkForKey()`, `setExpiryDate(now+getExpiryDays())`, `Mail::send`, status PENDING, delete other PENDING dupes) ·
<sup>c</sup> `UserRoleAssignmentInvite::getMailable()` (`sender($inviter)`, recipient, subject/body from template or `emailComposer`); `UserRoleAssignmentInvitationNotify` (`USER_ROLE_ASSIGNMENT_INVITATION`; `acceptUrl`/`declineUrl`/`rolesAdded`/`existingRoles`); `InvitationHandler::getActionUrl()` (`invitation/{accept|decline}?id&key`); `Invitation::makeKeyHash()` (bcrypt) ·
<sup>d</sup> `UserRoleAssignmentInviteRedirectController::acceptHandle()` (`AcceptInvitationStep`, `acceptInvitation.tpl`); `UserRoleAssignmentReceiveController::refine()`/`finalize()` (new user → `Repo::user()->newDataObject()` + `add()`; `assignUserToGroup(dateStart,dateEnd,masthead)`; `markAs(ACCEPTED)`); `AcceptInvitationStep::getSteps()` (new-user branch: verifyOrcid?, userAccountDetails, userDetails, review) ·
<sup>e</sup> `UserRoleAssignmentReceiveController::authorize()` (`getExistingUser` → `registerUserSession` **for that request only** (not a browsable login) / same-user-only); `UserRoleAssignmentInvite::changeInvitationUserIdUsingUserEmail()` (rebind email→userId); `finalize()` (existing-user branch skips create, adds groups); `AcceptInvitationStep::getSteps()` (user!=null → review only) ·
<sup>f</sup> `InvitationHandler::decline()`→`declineHandle()` (`declineInvitation.tpl` + confirm-decline URL); `InvitationHandler::confirmDecline()` (POST+CSRF)→`UserRoleAssignmentInviteRedirectController::confirmDecline()` (`GoneHttpException` unless PENDING → `Invitation::decline()` `markAs(DECLINED)` → redirect login) ·
<sup>g</sup> `UserInvitationManagerStore` (list `invitations/userRoleAssignment` count 5, `editInvite`→`invitation/edit/{id}`, `cancel`→`invitations/{id}/cancel`); `UserRoleAssignmentCreateController::getMany()` (over `InvitationModel::stillActive()`)/`cancel()` (`markAs(CANCELLED)`); `InvitationController::getMany()` (`stillActive()` = notExpired ∧ notHandled) ·
<sup>h</sup> `Invitation::checkForKey()` (`Validation::generatePassword()` + bcrypt hash), `setExpiryDate()`/`getExpiryDays()` (`DEFAULT_EXPIRY_DAYS = 3`, `Config invitations.expiration_days`); `UserRoleAssignmentInvite::updatePayload()` (`Validation::encryptCredentials` seals the password), `notAccessibleBeforeInvite`=[orcid,username,password] / `notAccessibleAfterInvite`=[userGroupsToAdd] ·
<sup>i</sup> `PKPScheduler` (`->call(new RemoveExpiredInvitations()->execute())->daily()`); `RemoveExpiredInvitations::executeActions()` (`dispatch(new RemoveExpiredInvitationsJob())`); `RemoveExpiredInvitationsJob::handle()` (`InvitationModel::expired()->delete()`); `InvitationModel::scopeExpired()` (`expiry_date < now` **or** null) ·
<sup>j</sup> `InvitationHandler::getInvitationByKey()` (miss → if id+key verify a stored hash → `displayInvitationNotAvailablePage()` `invitation/invitationUnavailable.tpl`; else `NotFoundHttpException`); `InvitationController::authorize()` (receive requires PENDING); live accepted-link → unavailable page, receive → 401

## Side effects

- **`invitations` row** — one per invitation: created **INITIALIZED** on `add`; payload rewritten on `populate`/`refine`;
  on `invite` the **key hash** + **expiry** are stamped and status → **PENDING**; `finalize` → **ACCEPTED**, `decline` →
  **DECLINED**, `cancel` → **CANCELLED**. Superseded pending dupes are **deleted** on invite; expired rows are **deleted**
  by the daily job. Foreign keys cascade-delete the row when the invitee, inviter, or context is deleted.
- **`users` row + `user_user_groups`** (owned by `registration-login` / `user-management`) — accepting a **new-invitee**
  invitation **creates** a `users` row (enabled, `date_registered`, inline help, bcrypt password) and assigns the invited
  role(s); accepting an **existing-user** invitation only **adds** the role assignments (start/end date, masthead flag).
- **Session** — accepting does **not** establish a browsable login for **either** invitee type. For an existing user the
  receive-side API request registers the user in the session **for that request only** (`registerUserSession`, so
  `finalize` can act as them via the key); a new invitee is created but never logged in. In both cases the invitee is
  redirected to **login** after accepting and must sign in. (Live-verified: post-accept the invitee's browser is
  unauthenticated — `/users/{self}` → 401, `/user/profile` → login, `window.pkp.currentUser` null.)
- **Email** — exactly one mail per send: the **role-assignment invitation** (`USER_ROLE_ASSIGNMENT_INVITATION`) from the
  inviter's address. Accepting/declining/cancelling/expiring send **no** email.
- **No event-log / no in-app notification** is written by the invitation lifecycle itself.

## Settings that modify behavior

- **`[invitations] expiration_days`** (`config.inc.php`, default **3**) — the accept window; the expiry is set from this
  at send time and the daily job deletes anything past it.
- **ORCID enabled** (per journal) — adds an ORCID field to the send form and an **ORCID-verify** step to the accept
  wizard.
- **Site minimum password length** + **compromised-password (breach) check** — enforced on the new invitee's chosen
  password at finalize (`Password::min()->uncompromised()`).
- **Journal supported/primary locales + site primary locale** — which name locales the wizard offers; the site primary
  locale is always offered and back-filled so the fallback name is never blank.
- **The daily scheduler must run** (web task-runner or cron) for expiry cleanup to actually happen.

## Cross-feature interactions

- **user-management** (feature 50) — owns the manager's **direct** user CRUD (add-user form, disable, merge, remove-role,
  the `/users` list + REST) and the **edit-user page** (`ManagementHandler::editUser`) whose role/masthead panel is
  rendered by this feature's `UserRoleAssignmentInviteUIController` in "edit-user" mode. **Seam:** creating a user in the
  3.6 journal UI is *this* invite flow; direct create is theirs. The invite path is **wider** than direct create (more
  roles may invite; any role may be granted) — see Known deviations.
- **registration-login** (feature 47) — owns **login**, **self-registration**, and the **`users`/`sessions`** tables.
  The invitation framework's **`RegistrationAccessInvite`** carries the account-**activation** link that registration
  documents; conversely, **accepting a new-invitee role invitation** is the *other* place an account is **created and
  activated** (here, with no email-validation step). Seam: they own account creation/activation as a table + login; this
  owns the invitation that triggers a create-on-accept.
- **user-profile** (feature 49) — its **email-change** confirmation reuses this framework via
  **`ChangeProfileEmailInvite`** (a different invitation *type*). This owns the framework + the **role-assignment** type;
  the email-change type is user-profile's use, the activation type is registration-login's.
- **password-flows** (feature 48) — the new invitee **sets their own password** in the accept wizard (min length + breach
  check), so an invited account is **not** flagged must-change-password (contrast the manager add-user form). No
  reset/forced-change surface here.
- **roles-permissions** (feature 52) — owns the **user-group definitions** the invite assigns **to**, the Users & Roles
  page shell, and (reassigned here) the generic **AnonymousUserPolicy** the new-invitee accept gate uses. This owns
  assigning those groups via an invitation, not defining them.
- **notifications / email-delivery** — the invitation email is a standard mailable rendered from the
  `USER_ROLE_ASSIGNMENT_INVITATION` **email template** (editable in email-templates management); no notification object is
  created.
- **scheduled-tasks** — owns the **scheduler entry** that fires `RemoveExpiredInvitations` daily; this feature owns the
  **job** it dispatches.

## Canonical scenarios

1. **Invite a new user → account created on accept** — A manager opens the invite wizard, enters a **new email**, picks a
   role (e.g. Reviewer) with a start date, composes and sends the email. The invitee opens the **accept** link, sets a
   **username/password**, accepts the privacy statement, fills **name/country**, reviews, and accepts — their account is
   **created, enabled and role-assigned**. Accepting does **not** log them in: they are sent to the **login page** and
   sign in with the credentials they just chose. (Live-verified end-to-end: an enabled account created with the Reviewer
   role, no activation step; the invitee's browser was unauthenticated after accepting.)
2. **Invite an existing user → role added on accept** — A manager invites an **existing user** to a new role. The invitee
   opens the link, reviews, and accepts — the role is **added** to their account with **no** account re-creation. The link
   does **not** log them in (it is not a magic-link — Rule 5). (Live-verified: an existing user invited to a new role
   ended holding both, with no re-creation; the accept link granted no browsable session.)
3. **Compose & send the invitation email** — In the wizard's send step the manager sees the invitation email pre-filled
   from the template (with accept/decline links), edits subject/body, and sends; the invitee receives **"You are invited
   to new roles"** from the **inviter's own address** carrying both links. (Live-verified: mail from `dbarnes@…` with
   both URLs.)
4. **Decline an invitation** — The invitee opens the **decline** link, is shown a confirmation page, and confirms
   (a POST); the invitation is marked **Declined** and they are sent to login. A decline attempt on an
   already-handled invitation is refused. (Live-verified: decline → confirm → 200, status Declined.)
5. **Manage pending invitations: cancel** — On the Users & Roles page the manager sees the **pending-invitation list**,
   opens the menu for one, and **Cancels** it; it is marked Cancelled and drops off the list. Editing a pending invite
   re-opens the wizard and re-sends (superseding the prior send). (Live-verified: cancel dropped the list to zero.)
6. **A used / expired link lands softly** — The invitee (or anyone) re-opens an **already-accepted** (or cancelled/
   declined/expired) link and sees a friendly **"this invitation is no longer available"** page with login/register
   links — not a 404 or a stack trace. (Live-verified: accepted link → unavailable page; receive API → 401.)
7. **Expiry** — An invitation sent today expires **3 days** later; the **daily** RemoveExpiredInvitations task deletes it
   after that (and also sweeps never-sent draft shells). After expiry the accept link lands on the "no longer available"
   page. (Verified: `expiryDate = send + 3d` live; the task is wired daily in the scheduler.)
8. **Permission boundary** — A **reviewer** cannot invite anyone (refused). A **manager/site admin** can. As-built a
   **section editor / assistant** can **also** invite — and can grant **any** role, including **Journal manager**, minting
   a manager account, which the direct-create path (manager/admin-only) would never allow. (Live-verified: `dbuskins`
   sent a Journal-manager invite; `jjanssen` refused — ⚠ Known deviations.)

## Known deviations (as-built ≠ intent)

- ⚠ **The invite path lets a section editor / assistant mint a brand-new account holding any role, including Journal
  manager, with no inviter-authority check** (ledger row 115, MEDIUM–HIGH). The create-side invitation routes and the
  wizard pages are gated to `[site admin, manager, section editor, assistant]` with no per-route narrowing, and the
  role-to-assign is validated only for *existence* and *non-duplication* — **nothing checks the inviter may grant that
  role**. So a section editor or production assistant — who **cannot create a user at all** via the manager/admin-only
  direct add-user form — can invite a fresh email to the **Journal manager** group and, on accept, a new manager account
  is created. This is a privilege escalation and is strictly **wider** than the direct-create path (both in who may create
  and which role may be granted). **Live-verified 2026-07-05**: as section editor `dbuskins`, `add`→`populate`(Journal
  manager, group 2)→`invite` all returned 200 and the manager list showed the pending Journal-manager invite (cancelled
  after the probe); reviewer `jjanssen` was refused (401). Suspected intent: restrict grantable roles to at/below the
  inviter's own authority, and/or gate the create-side routes to manager/admin, so invite cannot exceed direct-create.

## Open questions

1. **Is editor/assistant invite breadth — and manager-role granting in particular — intended?** (ledger row 115). One
   sentence settles whether the invite path should be narrowed to match the manager/admin-only direct-create path and to
   forbid granting a role above the inviter's own authority.
2. **The accept link is NOT a magic-link — RESOLVED.** An earlier draft worried an existing-user accept link might
   auto-authenticate a browsable session (a leaked-link risk). Verified live 2026-07-05: it does **not**. The
   `registerUserSession` in the receive path is scoped to that single API request (so `finalize` can act as the invitee
   via the emailed key), and the invitee's browser is left unauthenticated afterward (`GET /users/{self}` → 401,
   `/user/profile` → login, `window.pkp.currentUser` null); a new invitee is never session-registered at all. A leaked
   link therefore lets the holder **accept or decline** the invitation, but is **not** a session into the account —
   *safer* than the pattern the draft feared. No action needed; Rules 4/5 + Side-effects corrected accordingly.
3. **Should a never-sent draft (INITIALIZED, null expiry) really be deleted by the "expired" sweep?** The daily job's
   "expired" scope also matches null-expiry rows, so abandoned draft shells are garbage-collected alongside genuinely
   expired invitations — plausibly intended cleanup, but worth confirming the null-expiry-is-expired semantics.
4. **AnonymousUserPolicy ownership.** Reassigned from user-invitations to `roles-permissions` (the AUTHZ-framework owner),
   mirroring the `AUTHZ-user-required-policy` decision; the invitation new-invitee accept gate is its only current
   consumer. Confirm the framework-owner placement.
5. **The empty invitation-body edge case (Observation, not ⚠).** `UserRoleAssignmentInvite::getMailable()` only assigns
   the email **body** when the payload's `emailComposer` is set; if an invite is sent with `emailComposer` unset the body
   is empty (the template body is computed but not used). The UI always populates the composer step, so this is not
   UI-reachable — but a code path (or API caller) that skips it sends a bodyless email. Confirm the mailable should fall
   back to the template body when the composer is absent.

---

## Reference — entry points & surfaces

| Entry | Path | Atom |
|-------|------|------|
| Pending-invitation manager (list + Invite button) | Users & Roles → Users → `<user-invitation-manager>` (`access.tpl`) | VUE-user-invitation-manager |
| Send/invite wizard (create) | `…/invitation/create/userRoleAssignment` → `InitializeInvitationUIHandler::create` → `userInvitation.tpl` → `UserInvitationPage` | PAGE-invitation-create, VUE-user-invitation-page |
| Edit a pending invitation | `…/invitation/edit/{invitationId}` → `InitializeInvitationUIHandler::edit` | PAGE-invitation-edit |
| Accept wizard | `…/invitation/accept?id={id}&key={key}` → `InvitationHandler::accept` → `acceptInvitation.tpl` → `AcceptInvitationPage` | PAGE-invitation-accept, VUE-accept-invitation-page |
| Decline (confirmation) | `…/invitation/decline?id={id}&key={key}` → `InvitationHandler::decline` → `declineInvitation.tpl` | PAGE-invitation-decline |
| Confirm decline (POST) | `…/invitation/confirmDecline?id&key` (POST) → `InvitationHandler::confirmDecline` | PAGE-invitation-confirmdecline |
| List pending (manager) | `GET api/v1/invitations/{type}` | API-invitation-get-many |
| Get one (INITIALIZED) | `GET api/v1/invitations/{id}` | API-invitation-get |
| Create shell | `POST api/v1/invitations/add/{type}` (userId xor inviteeEmail) | API-invitation-add |
| Populate payload | `PUT api/v1/invitations/{id}/populate` | API-invitation-populate |
| Send | `PUT api/v1/invitations/{id}/invite` | API-invitation-invite |
| Preview composed mail | `GET api/v1/invitations/{id}/getMailable` | API-invitation-get-mailable |
| Cancel | `PUT api/v1/invitations/{id}/cancel` | API-invitation-cancel |
| Receive (public) | `GET api/v1/invitations/{id}/key/{key}` | API-invitation-receive |
| Refine (public, wizard step) | `PUT api/v1/invitations/{id}/key/{key}/refine` | API-invitation-refine |
| Finalize / accept (public) | `PUT api/v1/invitations/{id}/key/{key}/finalize` | API-invitation-finalize |
| Decline (public) | `PUT api/v1/invitations/{id}/key/{key}/decline` | API-invitation-decline |
| Invitation record | `invitations` table | DB-invitations |
| Invitation email | `USER_ROLE_ASSIGNMENT_INVITATION` (from the inviter) | MAIL-user-role-assignment-invitation-notify |
| Expiry cleanup | `RemoveExpiredInvitations` (daily) → `RemoveExpiredInvitationsJob` | JOB-removeexpiredinvitationsjob |
| Send/accept detail forms | `UserDetailsForm` (send) · `AcceptUserDetailsForm` (accept) | FORM-user-details-form, FORM-accept-user-details-form |

## Reference — code anchors

- **REST controller**: `lib/pkp/api/v1/invitations/InvitationController.php` — `getGroupRoutes()` (create-side group
  `[SITE_ADMIN, MANAGER, SUB_EDITOR, ASSISTANT]`; receive routes outside the group), `authorize()` (INITIALIZED vs PENDING
  status gates, `publicActions` + `PublicAccessPolicy`), `add()`/`getMany()`/`cancel()`/`getMailable()` and the delegating
  `get`/`populate`/`invite`/`receive`/`refine`/`finalize`/`decline`.
- **Pages**: `lib/pkp/pages/invitation/index.php` (op → handler), `InvitationHandler.php` (`accept`/`decline`/
  `confirmDecline`/`getInvitationByKey`/`displayInvitationNotAvailablePage`/`getActionUrl`),
  `InitializeInvitationUIHandler.php` (`create`/`edit` + role gate).
- **Framework core**: `lib/pkp/classes/invitation/core/Invitation.php` (`initialize`/`invite`/`checkForKey`/
  `setExpiryDate`/`getExpiryDays`/`decline`/`makeKeyHash`), `InvitationModel.php` (table, casts, `scopeStillActive`/
  `scopeExpired`/`markAs`), `InvitationStatus` enum, `InvitationActionRedirectController.php` (`declineHandle`),
  `InvitationUIActionRedirectController.php`, `ReceiveInvitationController.php` / `CreateInvitationController.php`.
- **Role-assignment type**: `lib/pkp/classes/invitation/invitations/userRoleAssignment/UserRoleAssignmentInvite.php`
  (`INVITATION_TYPE='userRoleAssignment'`, `getMailable`, stage-locked fields, `changeInvitationUserIdUsingUserEmail`,
  `updatePayload` password seal); `handlers/api/UserRoleAssignmentCreateController.php` (`add`/`populate`/`invite`/
  `getMany`/`cancel`/`getMailable` + `authorize` = `UserRolesRequiredPolicy`+`ContextAccessPolicy`);
  `handlers/api/UserRoleAssignmentReceiveController.php` (`authorize` = per-request session-register (existing) /
  anonymous (new) gate — **not** a persistent login, `receive`/`refine`/`finalize`/`decline`); `handlers/UserRoleAssignmentInviteRedirectController.php` (`acceptHandle`/`confirmDecline`);
  `handlers/UserRoleAssignmentInviteUIController.php` (`createHandle`/`editHandle` — also the edit-user mode);
  `payload/UserRoleAssignmentInvitePayload.php` (validation rules per context); `rules/AddUserGroupRule.php` +
  `UserGroupExistsRule.php` (role validation — no inviter-authority check).
- **Wizard steps / forms**: `lib/pkp/classes/invitation/stepTypes/SendInvitationStep.php` (search/details/email),
  `AcceptInvitationStep.php` (new vs existing branch); `lib/pkp/classes/components/forms/invitation/UserDetailsForm.php`
  (send) + `AcceptUserDetailsForm.php` (accept); Vue `lib/ui-library/src/pages/userInvitation/UserInvitationPage.vue`,
  `pages/acceptInvitation/AcceptInvitationPage.vue`, `managers/UserInvitationManager/UserInvitationManager.vue` +
  `UserInvitationManagerStore.js`.
- **Mailable**: `lib/pkp/classes/mail/mailables/UserRoleAssignmentInvitationNotify.php` (`USER_ROLE_ASSIGNMENT_INVITATION`;
  `acceptUrl`/`declineUrl`/`rolesAdded`/`existingRoles`).
- **Expiry**: `lib/pkp/classes/task/RemoveExpiredInvitations.php` (scheduled task) → `lib/pkp/jobs/invitations/
  RemoveExpiredInvitationsJob.php` (`InvitationModel::expired()->delete()`); wired daily in
  `lib/pkp/classes/scheduledTask/PKPScheduler.php`.
- **Schema / config**: `lib/pkp/classes/migration/install/InvitationsMigration.php` (`invitations` table);
  `config.TEMPLATE.inc.php` `[invitations] expiration_days = 3`.
- **Templates**: `lib/pkp/templates/invitation/{userInvitation,acceptInvitation,declineInvitation,invitationUnavailable}.tpl`.
- **Liveness note**: probed 2026-07-05 against `:8000` (`ojs_test`, PostgreSQL) with **throwaway** emails/users only (no
  seeded user's roles touched). Manager **dbarnes** (session auth) drove the create side: **add** (new email) →
  INITIALIZED; **populate** (Author role + name) → payload saved; **invite** → **PENDING**, `expiryDate = now+3d`, and a
  **"You are invited to new roles"** email from `dbarnes@…` carrying `/invitation/accept?id&key` + `/decline`. The
  **anonymous accept** path was driven end-to-end for a NEW invitee: **receive** (200) → **refine** (username/password/
  name/country) → **finalize** → an **enabled** account (user 187) holding the Reviewer role, no activation/must-change.
  An **existing-user** invite (user 187 → Author) accepted with **no** account re-creation (187 → Reviewer + Author).
  **Decline** driven via the decline page → confirm-decline → API decline (200, Declined). A **used** (accepted)
  invitation link → the **"no longer available"** landing page; its receive API → **401**. **Cancel** marked an invite
  Cancelled and it dropped off the manager list (`itemsMax` → 0); the list shows only active-PENDING. **Permissions**:
  reviewer `jjanssen` refused on `add` (401); **section editor `dbuskins`** reached the create page (200) and drove
  `add`/`populate`/`invite` (200) — and successfully sent a **Journal-manager** invite to a new email (⚠ ledger row 115,
  cancelled after the probe). One probe artifact: sending an invite via the API **without** the email-composer step
  produced an empty email body (the UI always fills the composer) — recorded as an Observation (Open question 5), not a
  deviation. Residual footprints on `publicknowledge`: throwaway users 187 (`invprobe2_*`) and the accounts created by the
  probes remain; a couple of INITIALIZED draft shells will be swept by the expiry job.
- **Verifier re-confirmation 2026-07-05** (`:8000`/`ojs_test`): the retained `user-invitations.spec.js` (7 tests) re-ran
  **green** live — re-driving the row-115 escalation (section editor `dbuskins` minted a Journal-manager invite → PENDING;
  reviewer `jjanssen` → 401; anon → login/403), the new + existing accept wizards, decline, cancel, the 3-day expiry
  window, and the used/handled soft-landing. **Correction landed:** the accept link is **not** a magic-link and grants
  **no** browsable session for *either* invitee type — a throwaway probe drove a full new-invitee accept (enabled account
  id 288 created) and found the invitee's browser unauthenticated afterward (`GET /users/{self}` → 401, `/user/profile`
  → login, `window.pkp.currentUser` null); the existing-user case is the same (retained test 2). The prior "logged
  straight in" / "auto-logged-in" claims (Rules 4/5, Purpose, Scenarios 1/2, Side-effects) were corrected and OQ2 marked
  resolved. Empty-body (OQ5) and the null-expiry sweep (OQ3) re-confirmed as Observations, not ⚠.
