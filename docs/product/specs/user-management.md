---
name: user-management
scope: A journal manager (or site admin) administers other people's accounts from Settings → Users & Roles — search the journal's users, create/edit an account, disable/enable it, remove a role or remove the user from the journal, email one user or mass-notify a role, toggle masthead display, merge two accounts, and export the user report
shared: pkp-lib          # UserGridHandler + its forms, PKPUserController (/users REST API), UserApiHandler, PKPNotifyUsersForm and Repo::user()->mergeUsers all live in lib/pkp; OJS adds only the subscription/payment transfer in its mergeUsers override
status: verified         # adversarial verifier passed 2026-07-05 (live re-probed)
e2e-plans: [user-management]
atlas-claims:
  - GRID-lib-pkp-grid-settings-user-user-grid-handler
  - GRID-lib-pkp-api-user-user-api-handler
  - API-user-get-many
  - API-user-get
  - API-user-get-reviewers
  - API-user-get-report
  - API-user-end-role
  - API-user-masthead
  - VUE-notify-users-form
  - FORM-pkp-notify-users-form
  - PAGE-management-settings-user
  - DB-user_user_groups
  - MAIL-user-created
  - MAIL-user-role-end-notify
---

# User management (manager-side user administration)

## Purpose

Everything a user does to their *own* account lives in `registration-login` and `user-profile`. This feature is the
other side: a **journal manager** (or a **site admin**) administering *other people's* accounts from **Settings →
Users & Roles → Users**. From the users list they **search/browse** the journal's people, **create** an account,
**edit** someone's details, **disable/enable** an account (with a reason), **remove a single role** or **remove the
user from the journal entirely**, **email** one user or **mass-notify** everyone in a role, **toggle** whether a
user's role shows on the public masthead, **merge** one account into another (folding all their work across), **log in
as** them, and **export** a users report. It owns the user-administration surfaces — the searchable users list
(`GET /users`), the legacy `UserGridHandler` that still backs the create/email/disable/remove/merge actions, the
role-end + masthead + report REST endpoints, the add/edit/disable/email forms, the mass-notify form, and the
role-membership rows (`user_user_groups`). It does **not** own the role/group *definitions* (`roles-permissions`), the
*invitation* flow that 3.6 uses to create and edit users (`user-invitations`), impersonation itself (`login-as`), or
the account/table *creation* point (`registration-login`).

**3.6 surface reality (both-live).** The **Users** tab renders a Vue **User Access Manager**
(`<user-access-manager>`, owned by `roles-permissions`) that lists users from `GET /users` and offers per-row actions.
Those actions **delegate**: **Email / Disable / Remove / Merge** open the **legacy `UserGridHandler`** AJAX modals (this
feature); **Edit** *redirects* to the **invitation edit-user page** (`user-invitations`), which is where **role-end** and
**masthead** toggles live; **Log in as** goes to `login-as`. **Creating** a user in the journal-manager UI is now the
**invitation** flow (`<user-invitation-manager>`); the classic **add-user form** (`UserDetailsForm`, which sends the
welcome email) is reached from the **site-admin** journal-settings user grid and remains the create surface this feature
documents. The spec documents both paths and flags which is primary per action.

## Actors & permissions

**Who reaches this at all.** Settings → Users & Roles is open to a **journal manager** with settings access and to a
**site admin**; a manager whose settings access has been withdrawn cannot open it. The user list and its REST feed
(`GET /users`, `/users/{id}`, `/users/reviewers`) are additionally readable by a **section editor** (sub-editor), because
the `/users` API route allows `[site admin, manager, sub-editor]` — but the management *page* and the mutating grid ops
are manager/admin only. Every "who may" below therefore means **manager (this journal) or site admin**, except where a
row says otherwise.

**Administration scope — the recurring guard** (`Validation::getAdministrationLevel($targetId, $actorId, $contextId)`):
before any edit/disable/remove/merge, OJS decides whether the actor may administer the target. **Full** = edit profile,
disable, merge, remove. **Partial** = may only change the target's *role assignments in the current journal* (the
edit-user form loads in role-only mode). **Prohibited** = the action is refused ("You do not have administrative rights
over this user"). The rules: acting on **yourself** → full; the target is a **site admin** → **prohibited for everyone**
(even another site admin — site admins cannot administer each other here); the actor is a **site admin** and the target is
not → full; a **manager** → full only when *all* the target's roles fall inside journals the manager manages, **partial**
when the target also has roles in an unmanaged journal but the current journal is one they manage, else **prohibited**.
This scope is stated once here and referenced by each action below. It runs on the **legacy grid ops** (edit / disable /
remove / merge); ⚠ the REST `endRole`/`masthead` PUTs do **not** invoke it (Known deviations — ledger row 114). <sup>a</sup>

| Action | Who may — and when |
|--------|--------------------|
| **Search / browse the users list** | • Manager, site admin — the full users list of the journal (all statuses)<br>• Section editor — may read the same `GET /users` feed (used e.g. by the reviewer picker), but has no management page <sup>b</sup> |
| **Create a user** | • Manager, site admin — **primary in 3.6: invite** the person (`user-invitations`); the classic **add-user form** (creates the account + optional welcome email) is reached from the **site-admin** journal-settings user grid<br>• The new account defaults to **must-change-password on first login** <sup>c</sup> |
| **Edit a user's details** | • Manager, site admin — with **full** administration scope over the target; **partial** scope restricts the edit to role assignments only. The 3.6 **Edit** action opens the **invitation edit-user page** (`user-invitations`); the legacy `UserDetailsForm` edit is the site-admin path <sup>d</sup> |
| **Disable / enable an account** | • Manager, site admin — with **full** scope; supplies a free-text **reason**. A disabled account **cannot log in** and its other sessions are ended <sup>e</sup> |
| **Remove a single role (end role)** | • Manager, site admin — from the edit-user page; end-dates that one role assignment and **emails the user** a "removed from a role" notice <sup>f</sup> |
| **Remove the user from the journal (all roles)** | • Manager, site admin — with non-prohibited scope; end-dates **every** active role in this journal at once (offered only when the user has an active role). **No email** <sup>g</sup> |
| **Email a single user** | • Manager, site admin — a one-off direct message (subject + body) sent from the actor's own address. ⚠ throws an error on a **disabled** target — see Known deviations <sup>h</sup> |
| **Notify users (mass email)** | • Manager, site admin — only when **bulk emails are enabled** for the journal (a site-admin setting); emails everyone in the chosen role(s) <sup>i</sup> |
| **Toggle masthead display** | • Manager, site admin — per user-role, from the edit-user page; **reviewer** roles cannot be toggled. Emails the user when the flag changes <sup>j</sup> |
| **Merge one account into another** | • Manager, site admin — with **full** scope over the *source* account; reassigns all the source's work to the target and **deletes the source**. Destructive; two-step confirm <sup>k</sup> |
| **Export the users report (CSV)** | • ⚠ Manager, site admin at the API (`GET /users/report`) — but **no UI control** exists in 3.6; API-only. See Known deviations <sup>l</sup> |
| **Log in as the user** | • Per `login-as` — offered as a row action when permitted; impersonation itself is that feature <sup>m</sup> |
| **View / edit the private "gossip" note** | • Manager, site admin who can administer the target — a private editorial note **never** visible to the user themselves <sup>n</sup> |

<sup>a</sup> `Validation::getAdministrationLevel()` (self→FULL; target site-admin→PROHIBITED; actor site-admin→FULL; manager→FULL/PARTIAL/PROHIBITED by managed-context overlap); enforced in `UserGridHandler::editUser()/updateUser()/disableUser()/removeUser()/mergeUsers()` ·
<sup>b</sup> `PKPUserController::getRouteGroupMiddleware()` (`roleAuthorizer([SITE_ADMIN, MANAGER, SUB_EDITOR])`); `UserGridHandler::__construct()` (`ROLE_ID_MANAGER, ROLE_ID_SITE_ADMIN`) + `authorize()` (`CanAccessSettingsPolicy`); live: dbarnes (manager) `GET /users?searchPhrase=barnes` → 200 ·
<sup>c</sup> `access.tpl` (`<user-invitation-manager>`); `UserGridHandler::addUser()`→`UserDetailsForm`; `UserDetailsForm::initData()` (`mustChangePassword=true` default); live: `update-user` create returned the role-assignment form + a "Journal Registration" welcome mail ·
<sup>d</sup> `useUserAccessManagerStore.editUser()` (redirect `management/settings/user/<id>`) → `ManagementHandler::editUser()` (builds a `userRoleAssignment` invitation); `UserGridHandler::editUser()` (site-admin grid; PARTIAL→`applyUserGroupUpdateOnly`) ·
<sup>e</sup> `UserGridHandler::disableUser()` → `UserDisableForm::execute()` (`setDisabled`, `setDisabledReason`, `invalidateOtherSessions`); login refusal in `registration-login` ·
<sup>f</sup> `PKPUserController::endRole()` (`Repo::userGroup()->endAssignments` + `UserRoleEndNotify`); live: PUT `/users/81/endRole/2500` → role end-dated + "You have been removed from a role" mail ·
<sup>g</sup> `UserGridHandler::removeUser()` (ends every active `UserUserGroup` for the context; no mailable); live: `remove-user` end-dated all active roles, no mail ·
<sup>h</sup> `UserGridHandler::editEmail()/sendEmail()` → `UserEmailForm::execute()` (bare `Mailable`, `from`=actor); ⚠ live: `send-email` to a disabled user → HTTP 500 ·
<sup>i</sup> `ManagementHandler::access()` (`enableBulkEmails` gate → `PKPNotifyUsersForm`); posts to `ROUTE_API .../_email`; live: Notify tab **absent** on the stock journal ·
<sup>j</sup> `PKPUserController::masthead()` (reviewer→`api.400.reviewerMastheadCannotBeChanged`; else `setUserUserGroupMasthead` + `UserRoleMastheadUpdateNotify`); live: PUT masthead on Author→200+mail, on Reviewer→400 ·
<sup>k</sup> `UserGridHandler::mergeUsers()` (two-step) → `Repo::user()->mergeUsers()` (reassign + delete source); live: two-step merge deleted the source (404 after) ·
<sup>l</sup> `PKPUserController::getReport()` (streams CSV); no template/manager references `/users/report` in 3.6; live: API returns the CSV, no button ·
<sup>m</sup> `useUserAccessManagerActions.loginAs()` (redirect `login/signInAsUser/<id>`, gated on `canLoginAs`) ·
<sup>n</sup> `Repository::canCurrentUserGossip()` (never self, never logged-out); `UserDetailsForm::execute()` (`setGossip` only when allowed)

## Fields & validation

**Add / edit user form** (`UserDetailsForm`, `userDetailsForm.tpl`) — the classic create/edit form. On **create** all
login fields are required; on **edit** the password is optional (blank = unchanged). Name/affiliation/signature/bio are
multilingual (the **site** primary locale is the required default locale).

| Field (UI label) | Required? | Rules | Anchor |
|------------------|-----------|-------|--------|
| **Username** | Yes* (create only) | Unique, **alphanumeric**; not editable after creation. | `UserDetailsForm::attachValidationChecks()` (`FormValidatorUsername` + uniqueness) |
| **Password** / **Repeat** | Yes* on create (unless *Generate*) | ≥ site minimum length; must match repeat. On edit, blank = leave unchanged. | `attachValidationChecks()` (length + `password2` match) |
| **Generate password** | No | Auto-generates a random password **and forces** the welcome email (which carries the password). | `execute()` (`generatePassword`→`Validation::generatePassword()`, `sendNotify=true`) |
| **Send notification email** | No | When ticked (or when Generate is on), sends the **User Created** welcome email with login details. | `execute()` (`sendNotify` gate on `UserCreated`) |
| **Must change password** | No — **defaults on for new users** | Forces a password change at the user's first login (see `password-flows`). | `initData()` (`mustChangePassword=true`); `execute()` (`setMustChangePassword`) |
| **First Name** | Yes* | Required in the **site primary locale**; multilingual. | `attachValidationChecks()` (`FormValidatorLocale givenName`) |
| **Last Name** | No | Optional; locale-consistent with first name. | `attachValidationChecks()` (`FormValidatorCustom familyName`) |
| **Preferred Public Name / Email / Affiliation / Country / Signature / Phone / Mailing Address / Homepage URL / Biography / Reviewing interests / Working languages** | Email + Country required | Email must be valid and **unique**; URL validated when present; the rest as on the self-profile. | `execute()` (mirrors `user-profile` identity/contact fields) |
| **Gossip** (private note) | No | An admin-only private note about the user; only shown/saved when the actor may gossip (never to the user). | `initData()`/`execute()` (`canCurrentUserGossip`) |

**Disable/enable form** (`UserDisableForm`, `userDisableForm.tpl`):

| Field (UI label) | Required? | Rules | Anchor |
|------------------|-----------|-------|--------|
| **Reason** (`disableReason`) | No | Free text stored on the account; surfaced when a disabled user's login is refused. Kept even after re-enable. | `UserDisableForm::execute()` (`setDisabledReason`) |

**Email-a-user form** (`UserEmailForm`, `userEmailForm.tpl`):

| Field (UI label) | Required? | Rules | Anchor |
|------------------|-----------|-------|--------|
| **Subject** | Yes | Non-empty. | `UserEmailForm::__construct()` (`subject required`) |
| **Message** | Yes | Non-empty; sent as the body of a plain email from the actor's address to the user. | `__construct()` (`message required`) |

**Notify-users form** (`PKPNotifyUsersForm` → `NotifyUsersForm.vue`, on the Notify tab):

| Field (UI label) | Required? | Rules | Anchor |
|------------------|-----------|-------|--------|
| **Roles** (`userGroupIds`) | Yes | Which role group(s) to notify; the form shows recipient counts. | `PKPNotifyUsersForm` (`FieldOptions userGroupIds`) |
| **Subject** (`subject`) | Yes | The email subject. | `PKPNotifyUsersForm` (`FieldText`) |
| **Message** (`body`) | Yes | Rich-text body sent to every user in the chosen role(s). | `PKPNotifyUsersForm` (`FieldRichTextarea`) |
| **Send me a copy** (`copy`) | No | Also emails the sending manager a copy. | `PKPNotifyUsersForm` (`FieldOptions copy`) |

## Rules & state

1. **The users list + search/filter.** Settings → Users & Roles → **Users** renders the Vue **User Access Manager**,
   which fetches `GET /users` (paginated, `status=all`, `includePermissions=true`) and shows **Name, Email, Roles, Start
   date, Affiliation** plus a per-row actions menu. The Vue list offers a single **search box** (name/email/username
   phrase); it does **not** expose the role/status filters. The underlying API *does* filter by **role** (`roleIds`),
   **status** (`all` / `active` / `disabled`), assignment and order, and the legacy site-admin grid additionally offers a
   field/match + role dropdown. Each user carries permission flags (`canLoginAs`, `canMergeUsers`, `disabled`) that
   decide which row actions render. **Live-verified**: `GET /users?searchPhrase=barnes` → the one match with its role
   group and flags; `roleIds=4096` → 8 reviewers; `status=disabled` → the disabled set. <sup>a</sup>
2. **Row actions delegate across features.** For any user other than the actor, the actions menu shows **Edit, Email**,
   and (when applicable) **Log in as** (`canLoginAs`), **Remove** (only if the user has an active role), **Disable/Enable**,
   and **Merge** (`canMergeUsers`). **Edit** *redirects* to the invitation edit-user page (`user-invitations`); **Email /
   Disable / Remove / Merge** open **legacy `UserGridHandler`** AJAX modals (this feature); **Log in as** goes to
   `login-as`. The actor never sees management actions on **their own** row. <sup>b</sup>
3. **Create a user + the welcome email.** In the 3.6 journal-manager UI a new user is **invited** (`user-invitations`).
   The classic **add-user form** (`UserDetailsForm`, reached from the site-admin journal-settings user grid, or via the
   manager-gated grid op) creates the account: it validates a unique alphanumeric **username**, a **password** (or
   auto-**generates** one), the required **first name** (site primary locale) and unique **email**, saves the user,
   assigns the chosen role(s) in a **second step** (`UserRoleForm`), and — when **Send notification** is ticked (always,
   if the password was generated) — sends the **User Created** welcome email (`USER_REGISTER`) carrying the login/password,
   reply-to the journal contact. New accounts default to **must-change-password**. **Live-verified**: driving `update-user`
   as a manager created the account, returned the role-assignment form, and delivered a **"Journal Registration"** welcome
   mail from the manager's address. <sup>c</sup>
4. **Edit a user's details.** Editing loads `UserDetailsForm` on the target. With **full** administration scope the whole
   profile is editable (identity, contact, interests, locales, the private **gossip** note, must-change-password); with
   **partial** scope the form is restricted to **role assignments only** (`applyUserGroupUpdateOnly`). Changing the target's
   password invalidates the target's **other** sessions. A successful edit flashes an "edited user" notice. The 3.6 **Edit**
   action instead opens the **invitation edit-user page**, where roles, role-end and masthead are managed. <sup>d</sup>
5. **Disable / enable + reason.** Disabling sets the account **disabled** with a free-text **reason** and **ends the
   target's other sessions**; the account then **cannot log in** (the reason is shown on the refusal — `registration-login`).
   Enabling clears the disabled flag (the stored reason is retained). The disabled state is filterable
   (`status=disabled`). **Live-verified**: disabling a throwaway user persisted and it appeared under `status=disabled`;
   the reason is stored on the row. <sup>e</sup>
6. **Remove a single role → the removal email.** From the edit-user page, `PUT /users/{id}/endRole/{userGroupId}`
   **end-dates that one role assignment** (it must currently be active) and sends the user a **"You have been removed from
   a role"** email (`UserRoleEndNotify`, `USER_ROLE_END`) from the acting manager. Other roles are untouched.
   **Live-verified**: ending a reviewer role stamped its `date_end`, left the author role active, and delivered the removal
   mail. <sup>f</sup>
7. **Remove the user from the journal (all roles), no email.** The grid **Remove** action (offered only when the user has
   at least one active role in the journal) **end-dates every** active role assignment for the context in one step and
   sends **no** email — distinct from the single-role endRole. The user's account survives; they simply hold no active role
   in this journal. **Live-verified**: `remove-user` end-dated all remaining active roles at once and sent nothing.
   <sup>g</sup>
8. **Email a single user (direct).** The **Email** action opens a subject+message modal and sends a **plain email** from
   the **acting manager's own address** to the user — not a template mailable, **no email-log entry**, and it does **not**
   respect notification opt-outs (it is a person-to-person message). ⚠ For a **disabled** target it **fails with a server
   error**, because the form loads the recipient without allowing disabled users (Known deviations). **Live-verified**:
   to an enabled user the message was delivered from the manager's address; to a disabled user it returned HTTP 500.
   <sup>h</sup>
9. **Notify users (mass email to a role).** When **bulk emails are enabled** for the journal (`enableBulkEmails`, a
   site-admin toggle), a **Notify** tab appears on Users & Roles carrying the **Notify Users** form: pick one or more
   **roles**, write a **subject** and **body** (optionally copy yourself), and it emails **every user in those roles**.
   The send posts to the context **`_email`** bulk endpoint (the bulk-send job + composer are owned by `email-delivery`)
   and the tab then shows a "queued" state. On the stock journal the toggle is **off**, so the tab is **hidden**.
   **Live-verified**: Users & Roles rendered **Users / Roles / Site Access Options / ORCID** with **no Notify tab**.
   <sup>i</sup>
10. **Toggle masthead display.** From the edit-user page, `PUT /users/{id}/masthead/{userUserGroupId}` sets whether that
    user's **specific role assignment** shows on the public editorial masthead, and — when the value actually changes —
    emails the user a **"masthead visibility updated"** notice (`UserRoleMastheadUpdateNotify`). **Reviewer** roles are
    rejected (their masthead flag cannot be changed). The masthead *roster* (which groups appear, in what order) is
    `editorial-masthead`; this endpoint sets the per-user display bit. **Live-verified**: toggling an Author assignment
    returned the updated user + the mail; a Reviewer assignment was refused with a 400. <sup>j</sup>
11. **Merge two accounts (destructive).** **Merge** is a two-step action: first the grid re-renders as a picker titled
    "merge into user" to choose the **target**; confirming runs `Repo::user()->mergeUsers(source, target)`, which
    **reassigns everything** the source owns to the target — uploaded submission files, notes, editorial decisions, review
    assignments, submission comments, the email log and event log, notifications, **role assignments** (skipping duplicates,
    preserving their masthead flag), stage assignments, and (OJS) individual/institutional subscriptions and completed
    payments — then **deletes the source account** and ends its other sessions. It is irreversible. **Live-verified**: a
    throwaway source merged into a target and the source then returned **404**. <sup>k</sup>
12. **The users report (CSV) — API-only.** `GET /users/report` streams a CSV (`user-report-<date>.csv`) of every user in
    the journal with a **Yes/No column per role group** plus contact fields. It is reachable at the API (manager/admin/
    sub-editor) but **no button surfaces it** in the 3.6 UI. **Live-verified**: the endpoint returned a well-formed CSV;
    no template or manager references `/users/report`. <sup>l</sup>
13. **Who the API accepts.** The `/users` route group admits **site admin, manager, and sub-editor** — one `roleAuthorizer`
    on the whole group, with **no per-route override**. The read routes (`getMany`, `get`, `getReviewers`, `getReport`)
    power the list and the reviewer picker; ⚠ the **mutating** `endRole`/`masthead` PUTs are admitted for a **sub-editor**
    at the API too, even though the edit-user *page* that drives them is manager-gated and offers section editors no such
    control — and, unlike the legacy grid ops, these PUTs run **no administration-scope check** at all (Known deviations,
    ledger row 114). The legacy grid ops are **manager/admin** only and each enforces the **administration-scope** guard
    (`getAdministrationLevel`, Actors & permissions); `PKPUserController` invokes that guard **nowhere**. **Live-verified**:
    a section editor got `GET /users` → 200 and reached the endRole/masthead PUTs (404 target-check — i.e. past
    authorization), while a reviewer was refused (401). <sup>m</sup>

<sup>a</sup> `useUserAccessManagerStore` (`useUrl('users')`, `status:'all'`, `includePermissions:true`), `useUserAccessManagerConfig.getColumns()`; `PKPUserController::getMany()` (`roleIds`/`status`/`searchPhrase` params); `UserGridHandler::loadData()`/`renderFilter()` (field/match + role dropdown); live counts ·
<sup>b</sup> `useUserAccessManagerConfig.getItemActions()` (self-exclusion, `canLoginAs`/`canMergeUsers`/active-group gating); `useUserAccessManagerActions` (`openLegacyModal` for email/disable/remove/merge; `redirectToPage` for edit/loginAs) ·
<sup>c</sup> `UserGridHandler::addUser()`/`updateUser()` (new→`UserRoleForm`); `UserDetailsForm::execute()` (`UserCreated` when `sendNotify`); live create + welcome mail ·
<sup>d</sup> `UserGridHandler::editUser()`/`updateUser()` (`getAdministrationLevel`→PARTIAL `applyUserGroupUpdateOnly`); `UserDetailsForm::execute()` (`invalidateOtherSessions` on password change); `notification.editedUser`; `useUserAccessManagerStore.editUser()` ·
<sup>e</sup> `UserGridHandler::disableUser()`; `UserDisableForm::execute()` (`setDisabled`/`setDisabledReason`/`invalidateOtherSessions`); live disabled + status filter ·
<sup>f</sup> `PKPUserController::endRole()` (`endAssignments`, `UserRoleEndNotify`); `UserInvitationUserGroupsTable.vue` (`useUrl('users/<id>/endRole/<roleId>')`); live end-date + mail ·
<sup>g</sup> `UserGridHandler::removeUser()` (CSRF; `UserUserGroup::withActive()->update(date_end=now)`; `userNoRoles` when none); live all-roles end, no mail ·
<sup>h</sup> `UserEmailForm::execute()` (`new Mailable()->from(actor)->to(user)`); `fetch()`/`execute()` use `Repo::user()->get($id)` (no `allowDisabled`); live enabled-ok / disabled-500 ·
<sup>i</sup> `ManagementHandler::access()` (`enableBulkEmails` → `PKPNotifyUsersForm($notifyUrl)`, `_email`); `access.tpl` (`{if $enableBulkEmails}` Notify tab); live: no Notify tab ·
<sup>j</sup> `PKPUserController::masthead()` (reviewer 400; `setUserUserGroupMasthead`; `UserRoleMastheadUpdateNotify`; no-op if unchanged); `UserInvitationUserGroupsTable.vue` (masthead field); live toggle + reject ·
<sup>k</sup> `UserGridHandler::mergeUsers()` (picker then `Repo::user()->mergeUsers`); `PKP\user\Repository::mergeUsers()` (reassign chain + `$this->delete`) + OJS `Repository::mergeUsers()` (subscriptions/payments); live source 404 ·
<sup>l</sup> `PKPUserController::getReport()` (`Repo::user()->getReport`→CSV stream); no UI reference; live CSV ·
<sup>m</sup> `PKPUserController::getRouteGroupMiddleware()` (`SITE_ADMIN, MANAGER, SUB_EDITOR`, whole-group), `getGroupRoutes()` (endRole/masthead PUTs — no per-route gate), `endRole()`/`masthead()` (call **no** `getAdministrationLevel`); `UserGridHandler::__construct()` (MANAGER, SITE_ADMIN) + grid ops call `Validation::getAdministrationLevel()`; ledger row 114 · live 2026-07-05: sub-editor `dbuskins` `GET /users`→200, endRole/masthead PUTs→404 (past auth), reviewer `jjanssen` `GET /users`→401

## Side effects

- **`user_user_groups`** — the role-membership rows this feature edits: **create/edit** assigns groups (second-step
  `UserRoleForm`), **end role** and **remove-from-journal** stamp `date_end`, **masthead** flips a row's masthead bit,
  **merge** transfers the source's rows to the target (skipping duplicates, preserving masthead) then deletes the source's.
- **`users` row** (owned by `registration-login`) — **create** inserts one (bcrypt password, `date_registered`,
  `must_change_password`); **edit** rewrites profile columns; **disable/enable** flips `disabled` + writes `disabled_reason`;
  **merge** deletes the source row.
- **Emails.** (1) **User Created** welcome (`USER_REGISTER`, `MAIL-user-created`) on create-with-notify — carries login +
  password. (2) **Removed from a role** (`USER_ROLE_END`, `MAIL-user-role-end-notify`) on `endRole`. (3) **Masthead
  visibility updated** (`USER_ROLE_MASTHEAD_UPDATE`, owned by `editorial-masthead`) on a masthead change. (4) A **direct
  plain email** from the manager on the Email action (no template, no log). (5) The **mass Notify Users** bulk send (owned by
  `email-delivery`). Remove-from-journal and disable/enable send **nothing**.
- **Sessions** — disabling a user and changing a user's password each **invalidate the target's other sessions**; merge
  invalidates the source's other sessions before deleting it.
- **Notifications** — a successful edit creates a trivial "edited user" in-app notice; a welcome-email transport failure
  raises an error notice to the acting manager.
- **Merge cross-entity reassignment** — see Rule 11 for the full list of entities transferred from source to target.
- **No event-log entry** is written for user-admin actions themselves (merge *relabels* existing event-log rows from the
  source to the target user).

## Settings that modify behavior

- **`enableBulkEmails`** (per journal, set by a **site admin**) — gates the **Notify Users** tab and the mass-email
  capability; off by default, so the tab is hidden (Rule 9). The site admin can also restrict which roles may be bulk-mailed
  (owned by `email-templates-management`).
- **Manager settings access** (`CanAccessSettingsPolicy`) — a manager without settings access cannot open Users & Roles.
- **Site minimum password length** (`Site::getMinPasswordLength()`) — floor for the add-user password (Rule 3).
- **Journal contact email/name** — the reply-to on the welcome email.
- **Bulk-email throttling / queue** (`email-delivery`) — how the Notify Users send is dispatched.

## Cross-feature interactions

- **registration-login** (feature 47) — owns **self-registration**, the **`users` table** (`DB-users`, creation point),
  and the login refusal that reads the disabled reason. The **User Created welcome mailable** (`MAIL-user-created`) is
  claimed **here** because its trigger is the manager add-user form; `registration-login` documents it only as a
  cross-reference. Both touch the User entity — creation there, admin lifecycle here.
- **user-profile** (feature 49) — owns the account owner's **self-service** edits and the editable **`SCHEMA-user`** field
  schema; this feature edits the *same* fields on **other** users (plus the admin-only **gossip** and **disabled** fields).
  The `/users` REST API is manager/editor-gated and lives here; `user-profile` deliberately claims none of it.
- **password-flows** (feature 48) — a manager-created account defaults to **must-change-password**, tripping that feature's
  forced-change on first login; an admin can also **reset** a user's password. This feature owns the create/must-change
  *trigger*; the change/reset machinery is there.
- **user-invitations** (feature 51) — the **primary create path** in the 3.6 journal-manager UI, and the **edit-user page**
  (`<user-invitation-manager>` / `UserInvitationUserGroupsTable`) that hosts the **role-end** and **masthead** toggles this
  feature's REST endpoints back. Seam: this feature owns the `/users` endpoints and the direct CRUD grid; `user-invitations`
  owns the invite wizard and the edit-user page UI.
- **roles-permissions** (feature 52) — owns the **role/user-group definitions**, the **Roles** tab, and the Vue
  **`<user-access-manager>`** shell that renders this feature's user list. This feature owns **assigning** those roles to
  users (`user_user_groups`) and the row-action operations, not the group definitions.
- **login-as** (feature 53) — owns **impersonation**; this feature surfaces the **Log in as** row action (gated on
  `canLoginAs`) that launches it.
- **editorial-masthead** — owns the masthead **roster** config and the masthead-update mailable; this feature owns the
  per-user **masthead display** endpoint (`API-user-masthead`) that sets an individual assignment's visibility bit.
- **notifications / email-delivery** — `email-delivery` owns the **bulk-send job + composer + the `_email` endpoint** the
  Notify Users form posts to; this feature owns the **Notify Users form surface** on the Users & Roles page.
- **assign-and-manage-reviewers** — consumes `GET /users/reviewers` (the reviewer picker) that this feature owns as part of
  the `/users` REST surface.
- **user-import-export** (Area 8) — the separate bulk **XML** import/export of user accounts (its own plugin + grid);
  distinct from this feature's CSV report and per-user CRUD.

## Canonical scenarios

1. **Search the users list** — A manager opens Settings → Users & Roles → Users, types a name or email in the search box,
   and the list narrows to matching accounts showing each user's roles, email, start date and affiliation. (Live-verified:
   `searchPhrase` narrowed the feed; role/status filters exist at the API.)
2. **Create a user (welcome email)** — A manager adds an account (username, name, email, a generated or typed password) with
   **Send notification** on; the account is created, a second step assigns its role(s), and the person receives a **Journal
   Registration** welcome email with their login and password. New accounts must change their password at first login.
   (Live-verified: create → role form + welcome mail from the manager's address.) In the 3.6 journal UI this is normally the
   **invitation** flow.
3. **Edit another user's details** — A manager opens a user's edit form and changes their profile (or, with partial scope
   over a cross-journal user, only their roles in this journal); changing the password ends the user's other sessions. The
   3.6 Edit action opens the invitation edit-user page.
4. **Disable then re-enable an account** — A manager disables a throwaway account with a **reason**; the account can no
   longer log in (the reason shows on the refusal) and its other sessions end. Re-enabling restores login. (Live-verified:
   disable persisted and showed under `status=disabled`.)
5. **Remove a role and notify** — On the edit-user page a manager **ends one role**; that assignment is end-dated, the
   user's other roles are untouched, and the user is emailed **"You have been removed from a role."** (Live-verified: role
   end-dated + removal mail.)
6. **Remove a user from the journal** — Using the grid **Remove** action, a manager ends **all** of a user's active roles
   in the journal at once; the account survives with no active role here and **no** email is sent. (Live-verified: all roles
   end-dated, zero mail — distinct from the single-role removal.)
7. **Email one user** — A manager sends a subject+message directly to a user from their own address (no template, no log).
   (Live-verified to an enabled user; ⚠ a **disabled** target triggers a server error — Known deviations.)
8. **Notify users (mass email)** — With bulk emails enabled for the journal, a manager opens the **Notify** tab, picks a
   role (e.g. Reviewers), writes a subject+body, and every user in that role is emailed; the tab then shows a queued state.
   On the stock journal the tab is hidden. (Live-verified: no Notify tab when bulk emails are off.)
9. **Merge two accounts** — A manager merges a duplicate (source) account into the correct (target) one; all the source's
   files, reviews, decisions, roles, subscriptions and payments move to the target and the source account is **deleted**.
   Two-step and irreversible. (Live-verified end-to-end on throwaway users; source 404 after.)
10. **Toggle masthead display** — On the edit-user page a manager turns a user's **Author** (non-reviewer) role masthead
    display on; the user is emailed a masthead-updated notice. A **Reviewer** role's masthead cannot be toggled.
    (Live-verified: Author→200+mail, Reviewer→400.)
11. **Permission boundary** — A **manager** administers only users whose roles fall inside journals they manage (partial or
    prohibited otherwise) and can **never** administer a **site admin**; a **site admin** administers anyone but another
    admin. A section editor can read the users feed and the reviewer picker but has no management page. (Verified from
    `getAdministrationLevel` + the route/grid role gates; manager list access live-verified.)

## Known deviations (as-built ≠ intent)

- ⚠ **Emailing a disabled user throws a server error — and the same `allowDisabled` gap 404s the single-user GET** (ledger
  row 112). The **Email** row action is offered on disabled accounts too (the Vue config pushes it unconditionally, and
  disabled users appear in the list), but `UserEmailForm` loads the recipient with `Repo::user()->get($userId)` (no
  `allowDisabled` flag), which returns **null** for a disabled user — so both opening the modal (`fetch()` → `getFullName()`
  on null) and sending (`execute()` → `getEmail()` on null) throw an uncaught error (HTTP 500). The **same missing
  `allowDisabled`** afflicts the single-user read endpoint: `PKPUserController::get()` also loads via `Repo::user()->get($userId)`,
  so **`GET /users/{disabledId}` returns 404** for a disabled account — the root cause is the missing `allowDisabled` across
  **both** read paths (the email form AND the single GET); contrast `endRole()`/`masthead()`, which correctly pass
  `get($userId, true)`. Impact **LOW–MEDIUM** (no data loss, but a manager clicking a visible affordance hits a 500, and a
  disabled user is unreadable via the single GET). **Live-verified**: `send-email` to a disabled throwaway user → HTTP 500
  (`Call to a member function getEmail() on null`), enabled delivered normally; the `get()` null-deref and the
  `get($id)`-vs-`get($id, true)` asymmetry re-confirmed in code 2026-07-05. Suspected intent: fetch the recipient with
  `allowDisabled=true` (as the disable/edit forms do), or hide the Email action for disabled users.
- ⚠ **The users report (CSV) has no UI control** (ledger row 113, LOW). `GET /users/report` streams a complete
  users CSV (per-role Yes/No columns) and is fully live at the API, but **no button or menu item** surfaces it anywhere in
  the 3.6 interface (the download link present in earlier versions was not carried into the Vue user manager). So an
  ability that clearly exists is reachable only by hand-crafting the API URL — API-only. **Live-verified**: the endpoint
  returns a valid CSV; a repo-wide search finds no template/manager reference to `/users/report`. Suspected intent: either
  restore a "Download report" action on the users list or retire the endpoint.
- ⚠ **The `/users` API admits section editors to the mutating `endRole`/`masthead` PUTs, and neither PUT applies the
  administration-scope guard** (ledger row 114, MEDIUM). The route group's single `roleAuthorizer([SITE_ADMIN, MANAGER,
  SUB_EDITOR])` covers *all* `/users` routes with **no per-route override**, so a **section editor** can end a role (emails
  the user "removed from a role") or flip a masthead bit (emails the user + changes public masthead) by calling the API
  directly — mutating, manager-level user-administration actions the edit-user page hides from them (an API-permits /
  UI-hides divergence, cf. the versioning "section editors publish via API but see no button" finding). And unlike the
  legacy grid ops (which **all** call `Validation::getAdministrationLevel()`), `PKPUserController` invokes that scope guard
  **nowhere**, so these two PUTs run with **no** actor-vs-target scope check at all: a section editor (or manager) can end a
  role / toggle masthead for **any** user holding that assignment in the context, including targets the grid would mark
  PROHIBITED (e.g. a site admin's context role). **Live-verified 2026-07-05**: as a section editor (`dbuskins`), `GET /users`
  → 200 and `PUT …/endRole/999999` & `…/masthead/999999` → **404** (the handler's own target check — i.e. past
  authorization; a reviewer got **401** `roleBasedAccessDenied` on the same group). Suspected intent: gate the mutating
  `endRole`/`masthead` routes to manager/admin, and/or add the `getAdministrationLevel` check to these PUTs so the API
  honours the same target-scope protection as the grid.

## Open questions

1. **Should the Email action work on disabled users?** As-built it 500s (ledger row 112). Confirm whether to fetch the
   recipient with `allowDisabled` (so a manager can email a disabled user) or to hide the action for disabled accounts.
2. **Is the users report meant to have no UI download in 3.6?** The `GET /users/report` CSV is live but unreachable from the
   interface. Confirm whether a download control should be restored on the users list or the endpoint retired.
3. **Should section editors reach `endRole`/`masthead` via the `/users` API, and should those PUTs enforce the
   administration-scope guard?** The route admits `SUB_EDITOR` on those mutating PUTs though the UI is manager-only, and
   neither PUT calls `getAdministrationLevel` (⚠ ledger row 114) — confirm whether to tighten the routes to manager/admin
   and/or add the scope check for the mutating routes.
4. **DB-users / MAIL-user-created ownership.** This spec references **`DB-users`** (owned by `registration-login`, the
   creation point) and claims **`MAIL-user-created`** (the manager add-user welcome, whose trigger is here). Confirm this
   split, matching the `SCHEMA-user`/`DB-users` split already agreed with `user-profile`/`registration-login`.
5. **Is a manager expected to be *prohibited* from administering a user who also has a role in another journal**, dropping to
   role-only (partial) edits? The administration-scope guard is strict by design, but worth confirming it is the intended
   multi-journal safety rule.

---

## Reference — entry points & surfaces

| Entry | Path | Atom |
|-------|------|------|
| Users & Roles → Users (list) | `…/management/settings/access` → `access.tpl` → `<user-access-manager>` (feeds from `GET /users`) | GRID-lib-pkp-grid-settings-user-user-grid-handler |
| Users list REST feed | `GET api/v1/users` (`searchPhrase`, `roleIds`, `status`, `includePermissions`) | API-user-get-many |
| Single user | `GET api/v1/users/{userId}` | API-user-get |
| Reviewer picker feed | `GET api/v1/users/reviewers` (consumed by assign-and-manage-reviewers) | API-user-get-reviewers |
| Users report (CSV) | `GET api/v1/users/report` — API-only, no UI control | API-user-get-report |
| End one role (+ email) | `PUT api/v1/users/{userId}/endRole/{userGroupId}` | API-user-end-role |
| Toggle masthead display (+ email) | `PUT api/v1/users/{userId}/masthead/{userUserGroupId}` | API-user-masthead |
| Add/edit/disable/email/remove/merge (legacy modals) | `…/$$$call$$$/grid/settings/user/user-grid/<op>` (`add-user`, `update-user`, `edit-disable-user`, `disable-user`, `remove-user`, `edit-email`, `send-email`, `merge-users`) | GRID-lib-pkp-grid-settings-user-user-grid-handler |
| Username suggestion (add-user helper) | `…/$$$call$$$/api/user/user-api/suggest-username` | GRID-lib-pkp-api-user-user-api-handler |
| Edit-user page (invitation) | `…/management/settings/user/{userId}` → `ManagementHandler::editUser` → invitation edit page | PAGE-management-settings-user |
| Notify Users (mass email) | Users & Roles → Notify tab (when `enableBulkEmails`) → `NotifyUsersForm` → `POST …/_email` | VUE-notify-users-form, FORM-pkp-notify-users-form |
| Role-membership rows | `user_user_groups` (assign / end / masthead / merge) | DB-user_user_groups |
| Welcome / role-end emails | `USER_REGISTER` (create-with-notify) · `USER_ROLE_END` (endRole) | MAIL-user-created, MAIL-user-role-end-notify |

## Reference — code anchors

- **Grid handler**: `lib/pkp/controllers/grid/settings/user/UserGridHandler.php` — `addUser()`/`editUser()`/`updateUser()`/
  `updateUserRoles()` (create/edit + role step), `editDisableUser()`/`disableUser()`, `removeUser()` (all context roles),
  `editEmail()`/`sendEmail()`, `mergeUsers()` (two-step); `UserGridRow.php` (row actions); `authorize()` =
  `ContextAccessPolicy` + `CanAccessSettingsPolicy`.
- **Forms**: `controllers/grid/settings/user/form/UserDetailsForm.php` (create/edit + `UserCreated`), `UserForm.php` (role
  assignment), `UserRoleForm.php` (second-step roles), `UserDisableForm.php` (reason), `UserEmailForm.php` (direct email);
  `lib/pkp/classes/components/forms/context/PKPNotifyUsersForm.php` (mass notify).
- **REST API**: `lib/pkp/api/v1/users/PKPUserController.php` — `getMany()`, `get()`, `getReviewers()`, `getReport()`,
  `endRole()` (`UserRoleEndNotify`), `masthead()` (`UserRoleMastheadUpdateNotify`); route group middleware
  `[SITE_ADMIN, MANAGER, SUB_EDITOR]`. `lib/pkp/controllers/api/user/UserApiHandler.php` — `suggestUsername()`.
- **Merge**: `lib/pkp/classes/user/Repository.php::mergeUsers()` (reassign chain + `delete` source);
  `classes/user/Repository.php::mergeUsers()` (OJS override — subscriptions + completed payments).
- **Vue surface**: `lib/ui-library/src/managers/UserAccessManager/` — `UserAccessManagerStore.js` (fetch `users`,
  `editUser` redirect), `useUserAccessManagerActions.js` (legacy-modal delegation for email/disable/remove/merge, loginAs),
  `useUserAccessManagerConfig.js` (columns + item actions); `lib/ui-library/src/pages/userInvitation/UserInvitationUserGroupsTable.vue`
  (`endRole`, masthead toggles); `lib/ui-library/src/components/Form/context/NotifyUsersForm.vue`.
- **Page**: `lib/pkp/pages/management/ManagementHandler.php` — `access()` (Users & Roles page + notify form),
  `editUser()` (invitation edit page); `lib/pkp/templates/management/access.tpl` + `accessUsers.tpl`.
- **Scope guard**: `lib/pkp/classes/security/Validation.php::getAdministrationLevel()`;
  `Repository::canCurrentUserGossip()`.
- **Mailables**: `lib/pkp/classes/mail/mailables/UserCreated.php` (`USER_REGISTER`), `UserRoleEndNotify.php`
  (`USER_ROLE_END`); `UserRoleMastheadUpdateNotify.php` (`USER_ROLE_MASTHEAD_UPDATE`, owned by editorial-masthead).
- **Liveness note**: probed 2026-07-05 against `:8000` (`ojs_test`, PostgreSQL). Manager **dbarnes** (Journal editor →
  ROLE_ID_MANAGER) drove the read surface on `publicknowledge`: Users & Roles rendered **Users / Roles / Site Access
  Options / ORCID** with **no Notify tab** (bulk emails off); `GET /users` returned users with role groups + permission
  flags; `roleIds`/`status` filters and `GET /users/{id}`, `/users/reviewers` worked; **`GET /users/report`** streamed a
  valid CSV (per-role Yes/No columns) with no UI trigger. All **destructive** ops were driven on a **throwaway scratch
  journal** (`j-umprobe`, via `/api/v1/_test/scenarios/journal`) with throwaway users, so no seeded user was touched:
  **create** (`update-user`) → account + role form + **"Journal Registration"** welcome mail; **disable+reason** →
  persisted + `status=disabled`; **endRole** (`PUT /users/81/endRole/2500`) → role end-dated + **"You have been removed
  from a role"** mail (other role kept); **remove-user** → all active roles end-dated, **no** mail; **masthead** PUT →
  Author toggled + **"masthead visibility updated"** mail, Reviewer **400**; **email** → delivered from the manager's own
  address to an enabled user, but **HTTP 500** to a **disabled** user (⚠ Known deviations); **merge** (two-step) →
  reassigned + **deleted** the source (404 after). Scratch journal `j-umprobe` remains (isolated from `publicknowledge`).
**Adversarial verifier re-probe (2026-07-05, `:8000`/`ojs_test`)**: re-confirmed the `/users` route gate live via session auth —
section editor **dbuskins** got `GET /users` → **200** (38 users) and reached the mutating PUTs `PUT /users/1/endRole/999999`
& `PUT /users/1/masthead/999999` → **404** (the handler's own target check, i.e. *past* authorization; non-mutating bogus
ids), while reviewer **jjanssen** was refused `GET /users` → **401** `roleBasedAccessDenied` — so section editors ARE admitted
to the two mutating PUTs, which invoke **no** `getAdministrationLevel` (grep-confirmed zero in `PKPUserController`): upgraded the
former Observation to ⚠ (**new ledger row 114**). Re-confirmed **`GET /users/report`** streams a valid `application/force-download`
CSV (`user-report-2026-07-05.csv`, BOM+header) with no UI trigger (row 113), and code-re-confirmed the `allowDisabled` gap
spans **both** `UserEmailForm` (500) **and** `PKPUserController::get()` (404 for a disabled user) — row 112 extended.
Atom audit clean: all 14 claimed atoms single-owner; `MAIL-user-created` no longer in `registration-login`'s frontmatter;
`DB-users` referenced not claimed; the 4 mis-attributed atoms (export grids, user-select, user-required-policy) sit with their
correct owners.
</content>
</invoke>
