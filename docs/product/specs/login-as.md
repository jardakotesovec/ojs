---
name: login-as
scope: A journal manager (or site admin) impersonates another user — "Log In As" them from the Users grid (or a submission's participants), acts in the app AS that user, then returns to their own account; plus the separate site-administration re-authentication gate that (when configured) makes a site admin re-confirm their password before entering the Administration area
shared: pkp-lib          # LoginHandler::signInAsUser/signOutAsUser, PKPSessionGuard::signInAs/signOutAs + the elevated-session helpers, AdminHandler::confirmAccess/confirmAccessSubmit, ReauthenticationRequiredPolicy, ConfirmPasswordForm and Validation::getAdministrationLevel/canUserLoginAs all live in lib/pkp; OJS adds nothing of its own
status: verified
e2e-plans: []
atlas-claims:
  - PAGE-login-signinasuser
  - PAGE-login-signoutasuser
  - PAGE-admin-confirmaccess
  - PAGE-admin-confirmaccesssubmit
  - AUTHZ-reauthentication-required-policy
---

# Log in as (admin/manager impersonation) + the Administration re-authentication gate

## Purpose

Sometimes a manager or site admin needs to see the application exactly as another user sees it — to reproduce a
bug an author reports, to check what a reviewer's screen shows, to finish a task on someone's behalf. **Log In As**
does that: from the **Users** list (Settings → Users & Roles → Users) or from a submission's **participants** panel,
the manager picks a user and is dropped into a live session **as that user** — their dashboard, their submissions,
their profile. The application stashes the original admin account so a single control in the header — the menu item
**"Logout as {username}"** (which, despite its wording, restores *your* account) — brings it back. Impersonation is
the highest-trust user-administration action in OJS: whoever you impersonate,
you can now do anything they can do, so the flow is fenced by an **administration-scope guard** — a site admin may
impersonate almost anyone, a manager only users who belong wholly to journals they manage, and **nobody** may
impersonate a **site administrator**.

This spec also documents the **re-authentication gate** (`admin/confirmAccess`) — a *separate* security control that
guards the **site-administration area**, not impersonation. When a site is configured with a password timeout, a site
admin who opens any Administration page after their elevated window lapses is asked to **re-enter their password**
before continuing. It is grouped here because the feature map paired the two "sensitive admin op" surfaces, but the
two flows are functionally independent — see Rule 6 and Known deviations.

It does **not** own the **Users grid** or the "Log In As" *row action* (`user-management` — this feature owns the
flow it triggers), the **administration-scope guard definition** (`roles-permissions` owns `getAdministrationLevel` —
this feature *uses* it), the **base login/logout session** (`registration-login` owns `DB-sessions` — this feature
only *stashes* the original user inside that session), the **password-validation mechanism** (`password-flows` owns
credential checking — this feature owns the reauth *gate*), or the **Administration pages themselves**
(`site-administration` owns `PAGE-admin-index` and the rest of the area the reauth gate protects).

## Actors & permissions

**Recurring terms.** **Impersonate / "Log In As"** = start a session as another user (`signInAsUser`). The gate is the
**administration-scope guard** `Validation::getAdministrationLevel(targetId, actorId)` (defined in `roles-permissions`),
which returns **FULL / PARTIAL / PROHIBITED**; impersonation requires **FULL** — stricter than the edit/disable ops in
`user-management`, which accept PARTIAL. The handler runs the guard with **no context** (a strict **cross-journal**
check), so a manager gets FULL only when **every** journal the target holds a role in is one the manager manages.
Baselines that apply to every row: **you can never impersonate yourself** (a no-op, and the affordance is hidden); a
**site administrator target is PROHIBITED for everyone**, including another site admin; only a **manager or site
admin** can reach the impersonation handler at all (a reviewer/author/anonymous request is refused).

| Action | Who may — and when |
|--------|--------------------|
| **Start impersonation ("Log In As")** | • Site admin — any user **except** another site admin and except themselves<br>• Manager — a user over whom they have **FULL** administration: *all* of the target's roles fall inside journals the manager manages. **Not** a site admin, **not** a user who also holds a role in a journal the manager does not manage (out-of-scope → PARTIAL/PROHIBITED, refused), **not** themselves<br>• Anyone else (reviewer, author, anonymous) — no access to the handler at all <sup>a</sup> |
| **Return from impersonation** (the header menu item labelled **"Logout as {username}"**, showing the *impersonated* user's name) | • The impersonating manager/admin — always available while impersonating; restores the original account. Harmless (a no-op redirect home) if called when not impersonating <sup>b</sup> |
| **Re-confirm password to enter the Administration area** (the reauth gate) | • Site admin only — asked **only** when the site is configured with a password timeout and the admin's elevated window has lapsed; **not** triggered by impersonation, and off entirely on a default install <sup>c</sup> |

<sup>a</sup> `LoginHandler::authorize()` (`RoleBasedHandlerOperationPolicy([ROLE_ID_MANAGER, ROLE_ID_SITE_ADMIN], ['signInAsUser'])`); `LoginHandler::signInAsUser()` (`getAdministrationLevel($userId, actorId) !== ADMINISTRATION_FULL` → error `manager.people.noAdministrativeRights`; `actorId != target` guard); affordance from `user/maps/Schema::getPropertyCanLoginAs()` (self=false, site-admin actor=true, else `Repository::permissionMapForManager()`) · live 2026-07-05: admin→jjanssen allowed; manager dbarnes→jjanssen allowed, dbarnes→admin **blocked** ("you do not have administrative rights over this user … the user is a site administrator")
<sup>b</sup> `LoginHandler::signOutAsUser()` (reads `signedInAs`; `PKPSessionGuard::signOutAs()`); no role policy — self-gating on the `signedInAs` session var; `useUserAuth.getLogoutUrl()` swaps the header logout to `signOutAsUser` while impersonating · live: returned to admin
<sup>c</sup> `AdminHandler::authorize()` (`ReauthenticationRequiredPolicy` on every op except `confirmAccess`/`confirmAccessSubmit`); `ReauthenticationRequiredPolicy::effect()` (deny→redirect unless `isElevatedSessionActive()`); gated by `Validation::isReauthenticationRequired()` = `security.password_timeout > 0`; `PKPSessionGuard::isElevatedSessionActive()` restricts to site admins · live: default config, admin opened `/admin` with **no** prompt

## Fields & validation

Impersonation itself takes **no form input** — the "Log In As" control issues a `GET login/signInAsUser/{userId}`
(optionally `?redirectUrl=…`), and the handler reads only the target user id from the path. The only user-entered
field in this feature is the **re-authentication password** on the `admin/confirmAccess` page (a control that belongs
to the Administration-area gate, not to impersonation):

| Field (UI label) | Required? | Rules | Anchor |
|------------------|-----------|-------|--------|
| **Password** | Yes | The **current admin's own** password, re-entered to prove presence. Validated against the logged-in user's credentials (not a new password); max length 32; a wrong password re-renders the form with the standard login error. The form is CSRF- and POST-guarded. | `ConfirmPasswordForm` (`FormValidatorCustom password` → `Validation::checkCredentials(currentUsername, password)`, `FormValidatorPost`, `FormValidatorCSRF`); `confirmPassword.tpl` |

## Rules & state

1. **Starting impersonation — the affordance and the handler gate.** In the Vue **Users** list a per-row **Log In As**
   action appears **only when** the user's `canLoginAs` flag is set; clicking it navigates to
   `login/signInAsUser/{userId}` (the same URL is offered on a submission's **participants** panel, built by
   `useUserAuth.getDashboardLoginAsUrl()`). `LoginHandler::signInAsUser()` then **re-checks** authority server-side:
   only a **manager or site admin** reaches the handler (`RoleBasedHandlerOperationPolicy`), and the target must yield
   **`ADMINISTRATION_FULL`** from `getAdministrationLevel($userId, actorId)` (run with **no context** — the strict
   cross-journal variant). If the level is not FULL, the handler renders an **error page** ("Sorry, you do not have
   administrative rights over this user … the user is a site administrator … or is active in journals you do not
   manage") with a link back to the users list — the impersonation does not happen. Impersonating **yourself** is a
   no-op (guarded by `actorId != target->getId()`). The **affordance matches the handler**: `canLoginAs` is computed
   by the same rule (`getPropertyCanLoginAs` → site-admin actor always true except self; manager via
   `permissionMapForManager`, which marks a target *false* if it holds any role in a context the manager does not
   manage), so the button is shown exactly when the handler would allow it. **Live-verified**: manager dbarnes's users
   feed reported `canLoginAs=true` for reviewer jjanssen and `false` for the site admin, matching the handler's
   allow/block. <sup>a</sup>
2. **The session stash — how impersonation is tracked.** On a permitted call, `PKPSessionGuard::signInAs($target)`
   records the **original** user id in the session variable **`signedInAs`**, swaps the session's stored
   password-hash and identity to the **target**, and **migrates** the session id. It deliberately calls
   `migrate(true)` rather than `regenerate(true)` so the CSRF `_token` is preserved across the auth-state switch (a
   fix for pre-opened tabs, pkp-lib#12606). It also **stops any elevated session** (Rule 6) — an admin who was
   elevated loses that elevation when they drop into someone else's account. After the swap the handler redirects to
   the request's `redirectUrl` (e.g. the impersonated user's dashboard) or home. The single `signedInAs` var is the
   *entire* impersonation state — there is no stack, so impersonation cannot be nested. **Live-verified**: after
   `signInAsUser/7`, the session was reporting user id 7 (jjanssen) with the header still exposing the original admin.
   <sup>b</sup>
3. **Who can impersonate whom — the scope guard and the prohibited targets.** Impersonation authority is exactly
   `getAdministrationLevel == FULL` (defined in `roles-permissions`; only its outcome is used here):
   - **A site administrator target is PROHIBITED for everyone** — even another site admin cannot impersonate them
     (the guard returns PROHIBITED as soon as the target holds the site-admin role).
   - **A site admin actor** gets FULL over any non-admin target → may impersonate **anyone but another admin** (and
     not self).
   - **A manager actor** gets FULL **only** when every context the target holds a role in is a journal the manager
     manages; if the target also has a role in an **unmanaged** journal the level drops to **PARTIAL/PROHIBITED** and
     impersonation is **refused** (PARTIAL is enough to *edit roles* in `user-management`, but **not** enough to
     impersonate — login-as demands FULL). **Live-verified**: manager dbarnes could impersonate the in-scope reviewer
     jjanssen but was blocked from impersonating the site admin. <sup>c</sup>
4. **The affordance while impersonating + the return control.** Once impersonating, the backend exposes
   `isUserLoggedInAs = true` and a `loggedInAsUser` (the original admin's username + initials) to the frontend via
   `PKPTemplateManager`, and the header renders **both identities** — the original admin *and* the user being
   impersonated. The header **logout** control is swapped: `useUserAuth.getLogoutUrl()` returns `login/signOutAsUser`
   (instead of `login/signOut`) while impersonating, and its **label** is relabelled from **Log Out** to
   **"Logout as {username}"** (locale key `user.logOutAs`, `TopNavActions.vue`) — where the interpolated name is the
   **currently-acting (impersonated) user's** username, e.g. *"Logout as jjanssen"*, not the admin's. So the control
   that **returns you to your own account** is, counter-intuitively, labelled with the *target's* name; on a submission
   page it carries a `redirectUrl` back to the same submission. **Live-verified**: while admin impersonated jjanssen,
   the header showed **"AA / admin"** alongside **"JJ / jjanssen"**, and the user-menu logout item read
   **"Logout as jjanssen"** routing to `signOutAsUser`. <sup>d</sup>
5. **Returning to your own account.** `LoginHandler::signOutAsUser()` reads `signedInAs`; if present it loads the
   **original** user and `PKPSessionGuard::signOutAs()` **forgets `signedInAs`**, restores the original user's
   password-hash and identity, and migrates the session — you are the admin again. There is **no role policy** on this
   op (it is self-gating: with no `signedInAs` it just redirects home), and it does **not** restore any elevated
   session that impersonation cleared, so a returning admin who re-enters the Administration area will be asked to
   re-authenticate again (when the reauth gate is enabled). **Live-verified**: `signOutAsUser` returned the session to
   the admin (`isUserLoggedInAs=false`, `loggedInAsUser=null`) and redirected to the editorial dashboard. <sup>e</sup>
6. **The re-authentication gate — a separate Administration-area control, NOT an impersonation gate.**
   `admin/confirmAccess` + `confirmAccessSubmit` and `ReauthenticationRequiredPolicy` protect the **site-administration
   area**, not login-as. `AdminHandler::authorize()` attaches `ReauthenticationRequiredPolicy` to **every** admin op
   *except* the two confirm ops; the policy **permits** if an **elevated session is active**, otherwise **denies** and
   redirects to `admin/confirmAccess?source=…`. `confirmAccess` shows the `ConfirmPasswordForm` (re-enter your own
   password); `confirmAccessSubmit` validates it and calls `startElevatedSession()`, which stamps a
   **`reauthenticated_at`** timestamp. `isElevatedSessionActive()` is true for a **site admin** while that timestamp
   is within a **sliding window** of `security.password_timeout` minutes (each admin-area request re-stamps it). The
   whole gate is **config-gated**: `isReauthenticationRequired()` is `security.password_timeout > 0`; the default
   config ships it **commented out / 0**, so on a stock install the admin area **never** prompts. Crucially,
   `signInAsUser` carries **no** `ReauthenticationRequiredPolicy` — **impersonation asks for no password**, whatever
   the timeout is set to. **Live-verified**: (a) impersonating a user showed **no** confirm-password page; (b) with
   the default config the admin opened `/admin` (heading "Administration") with **no** reauth prompt. <sup>f</sup>
7. **A POST that trips the gate cannot be replayed.** If the request that triggered reauth was an action
   (POST/PUT/DELETE/PATCH), `ReauthenticationRequiredPolicy::callOnDeny()` sets `isActionRequest`, and after a
   successful re-auth `confirmAccessSubmit()` redirects to the *referer/base* page (a GET) and raises a **trivial
   error notification** ("Your last action was not completed") so the admin knows to redo it — the original mutation
   is **not** auto-resubmitted. `confirmAccess`/`confirmAccessSubmit` also **short-circuit** (redirect to `/admin`)
   if an elevated session is already active, and honour `force_login_ssl`. <sup>g</sup>
8. **Impersonation and cached auth state.** Because `signInAs`/`signOutAs` migrate the session id and swap the stored
   identity, any **cached storage-state** for the original account is invalidated by an impersonation round-trip — a
   test (or a tool) that relies on a saved session must re-establish it afterwards (noted in the Playwright users
   companion). This is a consequence of the session migration in Rules 2 and 5, not a separate mechanism. <sup>b</sup>

<sup>a</sup> `LoginHandler::signInAsUser()` (`RoleBasedHandlerOperationPolicy`; `getAdministrationLevel(...) !== ADMINISTRATION_FULL` → `frontend/pages/error.tpl` with `manager.people.noAdministrativeRights`); `useUserAccessManagerActions.loginAs()` (`useUrl('login/signInAsUser/'+id)`); `useUserAuth.getDashboardLoginAsUrl()`; `user/maps/Schema::getPropertyCanLoginAs()` + `Repository::permissionMapForManager()`; live feed flags + allow/block ·
<sup>b</sup> `PKPSessionGuard::signInAs()` (`put('signedInAs', getUserId())`, swap `password_hash_*` + `setUserDataToSession`/`updateUser`/`updateSession`, `stopElevatedSession()`); `PKPSessionGuard::updateSession()` (`migrate(true)` not `regenerate(true)`, pkp-lib#12606); `Validation::loggedInAs()` reads `signedInAs`; live session id 7 after sign-in-as ·
<sup>c</sup> `Validation::getAdministrationLevel()` (target site-admin→PROHIBITED; actor site-admin→FULL; manager→FULL only when no conflicting contexts, else PARTIAL/PROHIBITED) — the guard is defined + documented in `roles-permissions`; `Validation::canUserLoginAs()` (self=false, else FULL) is the reusable predicate; live dbarnes→jjanssen ok / dbarnes→admin blocked ·
<sup>d</sup> `PKPTemplateManager` (`isUserLoggedInAs`, `loggedInAsUser` on `pkp.currentUser`); `useCurrentUser.isUserLoggedInAs()`/`loggedInAsUser()`; `useUserAuth.getLogoutUrl()`/`getDashboardLogoutAsUrl()` (→ `signOutAsUser` while impersonating); label `user.logOutAs` = "Logout as {$username}" in `TopNavActions.vue` (and `ParticipantManager.vue`'s `isUserLoggedInAs` branch), interpolating `currentUser.username` (the impersonated target); live header "AA/admin" + "JJ/jjanssen", menu item "Logout as jjanssen" ·
<sup>e</sup> `LoginHandler::signOutAsUser()` (`session.get('signedInAs')` → `PKPSessionGuard::signOutAs()` = `forget('signedInAs')` + restore identity + `updateSession`); `_redirectByURL()` (redirectUrl or home); live back to admin ·
<sup>f</sup> `AdminHandler::authorize()` (`ReauthenticationRequiredPolicy` on all ops except `confirmAccess`/`confirmAccessSubmit`); `ReauthenticationRequiredPolicy::effect()`/`callOnDeny()` (redirect `admin/confirmAccess`); `AdminHandler::confirmAccess()`/`confirmAccessSubmit()` (`startElevatedSession()`); `PKPSessionGuard::isElevatedSessionActive()`/`startElevatedSession()`/`stopElevatedSession()` (site-admin-only, `reauthenticated_at`, sliding window); `Validation::isReauthenticationRequired()` = `security.password_timeout > 0`; `config.TEMPLATE.inc.php` (`;password_timeout = 0`); live no-prompt on both paths ·
<sup>g</sup> `ReauthenticationRequiredPolicy::callOnDeny()` (`isActionRequest` on non-GET/csrfToken); `AdminHandler::confirmAccessSubmit()` (`user.lastAction.incomplete` trivial notification; source-URL validation; `force_login_ssl`); short-circuit `isElevatedSessionActive()` → redirect `/admin`

## Side effects

- **Session mutation only.** Impersonation writes the `signedInAs` variable and rewrites the session's identity +
  password-hash, and **migrates the session id** (both on sign-in-as and sign-out-as). No new session row is
  *created* — the base `sessions` table is `registration-login`'s; impersonation only re-keys the existing session.
- **No emails, no notifications, no event-log entry** are produced by starting or ending an impersonation. Anything
  the impersonated user *does* while you are in their session is attributed to **them** (this feature adds no audit
  trail of who impersonated whom — see Open questions).
- **Elevated-session side effects.** `signInAs` **clears** any elevated (re-authenticated) admin session; `signOutAs`
  does **not** restore it. The reauth gate's `confirmAccessSubmit` **stamps** `reauthenticated_at` (starting the
  elevated window) and, for a tripped action request, raises a **trivial error notification** to the admin.
- **The Administration reauth gate** does not touch any user data — it only writes/reads the elevated-session
  timestamp and redirects.

## Settings that modify behavior

- **`security.password_timeout`** (`config.inc.php`) — the master switch for the **Administration re-authentication
  gate**. `0` or unset (the default, shipped commented out) → the gate is **off**, a site admin always has elevated
  access, no confirm-password page ever appears. `> 0` → after that many minutes without Administration-area
  activity, the next admin page requires re-entering the password; the window slides on each request. **This setting
  does not affect impersonation** — `signInAsUser` is never gated by it.
- **`security.force_login_ssl`** — when on, the confirm-access submit (and login) is forced to HTTPS.
- **The administration-scope guard has no configurable knobs** — who-can-impersonate-whom is derived entirely from
  the actor's and target's role assignments (`roles-permissions`).

## Cross-feature interactions

- **user-management** (feature 50) — owns the **Users list** and the **"Log In As" row action** (gated on the
  `canLoginAs` flag) that launches this flow. Seam: they surface the control; this feature owns the impersonation
  handler and the scope enforcement behind it.
- **roles-permissions** (feature 52) — **defines** the administration-scope guard `getAdministrationLevel` (FULL /
  PARTIAL / PROHIBITED) and the AUTHZ framework. This feature **uses** the guard's FULL outcome for
  who-can-impersonate-whom; the rule and its edge cases are documented there, referenced here.
- **registration-login** (feature 47) — owns **`DB-sessions`** (the base session created at login) and login/logout.
  This feature **stashes** the original user (`signedInAs`) inside that session and re-keys it; the header logout
  control routes to `signOut` vs `signOutAsUser` depending on whether an impersonation is active. Seam: they own the
  session table + base auth; this feature owns the impersonation overlay on it (DB-sessions is **referenced, not
  claimed** — see atom notes).
- **password-flows** (feature 48) — owns password **validation** (`Validation::checkCredentials`) reused by the reauth
  `ConfirmPasswordForm`. This feature owns the reauth **gate/flow**; the credential check itself is theirs.
- **user-profile** (feature 49) — while impersonating, you see and can edit the **impersonated user's** profile as
  them; that surface is theirs, reached here by acting as the target.
- **site-administration** — owns the **Administration pages** (`PAGE-admin-index`, contexts, systemInfo, jobs,
  expire-sessions, cache clears, …) that the **reauth gate** actually protects. The reauth atoms
  (`confirmAccess`/`confirmAccessSubmit`/`ReauthenticationRequiredPolicy`) are claimed here per the feature map, but
  functionally guard that area — see Known deviations / Open questions on ownership.
- **assign-and-manage-reviewers / editorial workflow** — the submission **participants** panel offers the same
  "Log In As" on a submission's users (`submission/maps/Schema` computes `canLoginAs` via `canUserLoginAs`), a second
  entry point into this same `signInAsUser` flow.

## Canonical scenarios

1. **Admin impersonates a user and returns (round-trip)** — A **site admin** opens Settings → Users & Roles → Users,
   clicks **Log In As** on a reviewer, and lands on that reviewer's dashboard **as them** (their review assignments,
   their profile); the header shows both identities. Using the header menu item **"Logout as {reviewer}"** (which
   despite its wording returns you to your own account), the admin is restored to their own session. No password is
   asked at any point. (Live-verified: admin → jjanssen → dashboard, then `signOutAsUser` → back to admin.)
2. **Manager impersonates an in-scope user** — A **journal manager** (dbarnes) impersonates a reviewer whose roles are
   all within journals the manager manages; the impersonation is permitted and the manager is dropped into the
   reviewer's session. (Live-verified: dbarnes → jjanssen allowed, session became user 7.)
3. **Manager cannot impersonate a site administrator** — The same manager attempts to Log In As a **site admin**. The
   "Log In As" affordance is **hidden** for that target (`canLoginAs=false`), and hitting the handler URL directly
   yields the **"you do not have administrative rights over this user … the user is a site administrator"** error
   page — impersonation is refused. (Live-verified: dbarnes → admin blocked; feed flag false.)
4. **Manager cannot impersonate an out-of-scope (cross-journal) user** — A user who holds a role in a journal the
   manager does **not** manage yields only PARTIAL/PROHIBITED scope (not FULL); the "Log In As" affordance is hidden
   and the handler refuses with the same error, even though the manager could still *edit that user's roles* in the
   current journal (which only needs PARTIAL). (Verified from `getAdministrationLevel`/`permissionMapForManager` **and
   driven end-to-end** by the retained `login-as.spec.js` scenario 4, which seeds **two** scratch journals — A managed
   by dbarnes + B holding a cross-journal user — and confirms the "…active in journals you do not manage" refusal with
   no session switch; the seeded single-journal `publicknowledge` alone has no such user.)
5. **The impersonation affordance and return control** — While impersonating, the header displays the **original
   admin's** avatar/initials next to the **impersonated user's**, and the normal **Log Out** menu item becomes
   **"Logout as {username}"** (the impersonated user's name; routing to `signOutAsUser`, carrying the current submission
   when on a workflow page). Calling `signOutAsUser` when *not* impersonating is a harmless redirect home. (Live-verified:
   header "AA/admin" + "JJ/jjanssen"; the "Logout as jjanssen" item restored the session.)
6. **The re-authentication gate is an Administration-area protection, not an impersonation gate** — Impersonation asks
   for **no** password. Separately, when a site is configured with `password_timeout > 0`, a site admin who opens an
   Administration page after their elevated window lapses is redirected to **confirm access** by re-entering their
   password; on a default install (`password_timeout` unset/0) the Administration area opens with no prompt. A tripped
   POST is not auto-replayed — the admin is told to redo it. (Live-verified: no prompt on login-as; no prompt on
   `/admin` with the default config.)

## Known deviations (as-built ≠ intent)

- ⚠ **The re-authentication gate does not apply to impersonation, though the atlas/feature-map frame it as the
  "login-as confirmation."** The atlas describes `confirmAccess`/`confirmAccessSubmit` as "Confirm login-as-user
  request page" / "Submit login-as-user confirmation," and the feature map says an admin must "re-confirm their
  password before impersonating." **As-built, `signInAsUser` carries no `ReauthenticationRequiredPolicy` and asks for
  no password** — the reauth gate is attached only to `AdminHandler` and guards the **site-administration area**
  (config comment: "admins must re-authenticate to access the administration area"). So a manager/admin with an
  active session can impersonate any in-scope user with a **single click, no re-authentication**. This is an
  **as-built fact** (live-verified), and the mismatch is with the campaign's own atlas labels + the feature-map
  assumption, not necessarily with product intent — but it would surprise a reader who expected a password prompt on
  Log In As. Rated **LOW–MEDIUM** (no data loss, and the impersonation scope guard still fully gates *who* can be
  impersonated; but a manager/admin can silently act as any in-scope user with no password re-entry and no audit record).
  Suspected intent / decisions for the maintainer: (a) correct the atlas descriptions of the two confirm ops (they
  are the Administration-area reauth, not a login-as confirmation — done in the atlas + this spec); (b) decide whether
  impersonation — a maximum-trust action — *should* require re-authentication and/or leave an audit trail (see Open
  questions). *(Ledger row 117.)*

## Open questions

1. **Should impersonation require re-authentication (or leave any audit trail)?** As-built, Log In As needs only an
   existing manager/admin session — no password re-entry — and writes **no** event-log/notification recording who
   impersonated whom or when. Confirm whether a re-auth prompt and/or an audit record should gate this
   maximum-privilege action (a common expectation for "act as user" features), or whether the scope guard alone is the
   intended control.
2. **Atom ownership of the reauth gate.** `PAGE-admin-confirmaccess`, `PAGE-admin-confirmaccesssubmit` and
   `AUTHZ-reauthentication-required-policy` are claimed here per the feature map, but they functionally protect the
   **site-administration area** (their only consumer is `AdminHandler`) and have nothing to do with impersonation.
   Confirm whether they should move to a `site-administration` spec when that is written (the atlas already hints
   `site-administration` for the policy), leaving this spec owning only the impersonation atoms.
3. **DB-sessions split.** This spec **references** `DB-sessions` (owned by `registration-login` as the base session)
   for the impersonation stash (`signedInAs`) + the session-id migration, and does **not** claim it. Confirm this
   split (mirrors the `DB-users` reference already agreed with `registration-login`); the atlas owner cell was
   corrected from `login-as` to `registration-login` to match.
4. **Is the FULL-only requirement for impersonation (vs PARTIAL for role edits) intended?** A manager can *edit the
   roles* of a cross-journal (PARTIAL) user but **cannot impersonate** them (login-as demands FULL). This is a
   deliberate tightening, but worth confirming it is the intended asymmetry.
5. **Cross-journal impersonation — RESOLVED.** The seeded single-journal `publicknowledge` has no user with a role in
   an unmanaged second journal, but the retained `login-as.spec.js` scenario 4 **drives the PROHIBITED-refusal path
   end-to-end** by seeding two scratch journals (A managed by dbarnes + B holding a cross-journal reviewer) via the
   scenario endpoints, then confirming the "…active in journals you do not manage" error with no session switch. The
   multi-journal fixture the earlier draft asked for already exists in the round-1 retained suite; no further work.

---

## Reference — entry points & surfaces

| Entry | Path | Atom |
|-------|------|------|
| Start impersonation | `GET …/login/signInAsUser/{userId}?redirectUrl=…` → `LoginHandler::signInAsUser` (from Users grid "Log In As" or a submission's participants) | PAGE-login-signinasuser |
| Return from impersonation | `GET …/login/signOutAsUser?redirectUrl=…` → `LoginHandler::signOutAsUser` (header menu item "Logout as {username}") | PAGE-login-signoutasuser |
| Administration reauth — form | `…/admin/confirmAccess?source=…` → `AdminHandler::confirmAccess` → `confirmPassword.tpl` | PAGE-admin-confirmaccess |
| Administration reauth — submit | `POST …/admin/confirmAccessSubmit` → `AdminHandler::confirmAccessSubmit` (`startElevatedSession`) | PAGE-admin-confirmaccesssubmit |
| The reauth policy | `ReauthenticationRequiredPolicy` on every `AdminHandler` op except the two confirm ops | AUTHZ-reauthentication-required-policy |
| Impersonation session stash | `sessions.signedInAs` (owned by `registration-login` as `DB-sessions`; referenced here) | DB-sessions (referenced, not claimed) |

## Reference — code anchors

- **Impersonation handler**: `lib/pkp/pages/login/LoginHandler.php` — `authorize()` (`RoleBasedHandlerOperationPolicy`
  for `signInAsUser`), `signInAsUser()` (FULL-scope check + error page), `signOutAsUser()`, `_redirectByURL()`.
- **Session guard**: `lib/pkp/classes/core/PKPSessionGuard.php` — `signInAs()` (stash `signedInAs`, swap identity,
  `stopElevatedSession`), `signOutAs()` (restore), `updateSession()` (`migrate(true)` vs `regenerate(true)`,
  pkp-lib#12606), `isElevatedSessionActive()` / `startElevatedSession()` / `stopElevatedSession()`.
- **Scope guard (defined in roles-permissions)**: `lib/pkp/classes/security/Validation.php` —
  `getAdministrationLevel()` (ADMINISTRATION_FULL/PARTIAL/PROHIBITED), `canUserLoginAs()`, `loggedInAs()`,
  `isReauthenticationRequired()`.
- **Affordance (Vue)**: `lib/ui-library/src/managers/UserAccessManager/useUserAccessManagerActions.js` (`loginAs`);
  `lib/ui-library/src/composables/useUserAuth.js` (`getDashboardLoginAsUrl`, `getLogoutAsUrl`, `getLogoutUrl`);
  `lib/ui-library/src/composables/useCurrentUser.js` (`isUserLoggedInAs`, `loggedInAsUser`);
  `lib/pkp/classes/user/maps/Schema.php` (`getPropertyCanLoginAs`) + `lib/pkp/classes/user/Repository.php`
  (`permissionMapForManager`); `lib/pkp/classes/submission/maps/Schema.php` (participants `canLoginAs`);
  `lib/pkp/classes/template/PKPTemplateManager.php` (`isUserLoggedInAs`/`loggedInAsUser` exposure).
- **Reauthentication gate**: `lib/pkp/pages/admin/AdminHandler.php` — `authorize()` (attach policy),
  `confirmAccess()`, `confirmAccessSubmit()`; `lib/pkp/classes/security/authorization/ReauthenticationRequiredPolicy.php`
  (`effect()`, `callOnDeny()`); `lib/pkp/classes/user/form/ConfirmPasswordForm.php`;
  `lib/pkp/templates/user/confirmPassword.tpl`; config `security.password_timeout` (`config.TEMPLATE.inc.php`).
- **Liveness note**: probed 2026-07-05 against `:8000` (`ojs_test`) with fresh browser contexts (impersonation
  invalidates cached storage-state). **Admin (id 1)**: impersonated reviewer **jjanssen (id 7)** →
  `login/signInAsUser/7` redirected to the reviewer's dashboard, `pkp.currentUser` = `{id:7, isUserLoggedInAs:true,
  loggedInAsUser:{username:'admin', initials:'AA'}}`, **no** confirm-password page; the header showed both
  **AA/admin** and **JJ/jjanssen**; `login/signOutAsUser` restored `{id:1, isUserLoggedInAs:false}`. **Manager
  dbarnes (id 3, ROLE_ID_MANAGER)**: `login/signInAsUser/7` (jjanssen) **allowed** (session became id 7);
  `login/signInAsUser/1` (site admin) **blocked** with the "no administrative rights over this user … site
  administrator" error page. `/users` feed `canLoginAs`: jjanssen **true** (admin + manager), site admin **false**
  (both) — affordance matches handler. **Reauth**: admin opened `/admin` (heading "Administration") on the default
  config with **no** confirm-access prompt (`password_timeout` unset/0). No seeded user mutated; impersonation is
  session-only.
- **Verifier re-confirmation (2026-07-05)**: independently re-drove the whole flow with fresh curl/browser sessions on
  `:8000`/`ojs_test`. Admin round-trip reproduced (`currentUser`=`{jjanssen,JJ,isUserLoggedInAs:true,loggedInAsUser:{admin,AA}}`
  during, `{admin,AA,isUserLoggedInAs:false,loggedInAsUser:null}` after `signOutAsUser`), no confirm-password page.
  **Manager dbarnes** must be driven **in the `publicknowledge` context** (`/publicknowledge/login/signInAsUser/…`) — at
  the site-level `/index/` URL he fails the `RoleBasedHandlerOperationPolicy` (`roleBasedAccessDenied`, no manager role in
  the site context), a reachability nuance: in-context, `signInAsUser/7` (jjanssen) → the reviewer dashboard
  (`loggedInAsUser:{dbarnes,DB}`), `signInAsUser/1` (admin) → the "…administrative rights over this user" refusal page.
  `/users?includePermissions` `canLoginAs`: jjanssen **true**, admin **false**. `/index/admin` → HTTP 200 "Administration",
  no reauth. **Affordance-label correction (rule-11)**: the return control's *actual* rendered text is
  `user.logOutAs` = **"Logout as {username}"** (the impersonated user's name, `TopNavActions.vue`), not the paraphrase
  "return to your account" the earlier draft used — corrected throughout. `getAdministrationLevel`/`getPropertyCanLoginAs`/
  `permissionMapForManager` re-read: affordance = handler (self→false, site-admin actor→true, else the manager map that
  marks false any target with a role in an unmanaged context). No app-code changed; retained `login-as.spec.js` untouched.
