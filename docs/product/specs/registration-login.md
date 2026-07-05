---
name: registration-login
scope: A visitor creates their own OJS account (public self-registration), then logs in and out — the front door to every logged-in capability; the account may need email activation before it works
shared: pkp-lib          # RegistrationHandler, RegistrationForm, LoginHandler, Validation, the session middleware and the register/login templates all live in lib/pkp; OJS only supplies the journal context and its user groups
status: verified         # adversarial verifier passed 2026-07-05 (live re-probed)
e2e-plans: []            # no retained round-1 plan maps cleanly to public registration + login yet
atlas-claims:
  - PAGE-user-register
  - PAGE-user-registeruser
  - PAGE-user-activateuser
  - PAGE-login-index
  - PAGE-login-signin
  - PAGE-login-signout
  - MAIL-user-created
  - MAIL-validate-email-context
  - MAIL-validate-email-site
  - DB-users
  - DB-sessions
  - AUTHZ-pkp-start-session
  - AUTHZ-pkp-authenticate-session
  - AUTHZ-pkp-encrypt-cookies
---

# Registration & login (public sign-up, sign-in, sign-out, activation)

## Purpose

This is the front door. A visitor with no account fills in the **Register** form (name, email, username,
password, affiliation, country, optional reviewer sign-up) and gets a personal OJS account; from then on they
**log in** with username + password to reach anything gated behind authentication — submitting a manuscript,
reviewing, commenting on articles, editing their profile. **Log out** ends the session. If the site is configured
to require it, a new account is created **disabled** and the visitor must click an **activation link** emailed to
them before they can log in. This spec owns the whole public-account lifecycle at its two shared handlers —
`RegistrationHandler` (`/user/register`) and `LoginHandler` (`/login`) — plus the account row, the session, the
session/cookie middleware, and the registration-related emails. It does **not** own forgotten-password reset or the
forced first-login password change (both `password-flows`), profile editing (`user-profile`), or a manager creating
accounts for other people (`user-management`).

## Actors & permissions

Two front-facing surfaces: the **Register** page (anonymous self-service) and the **Login** page (anyone with an
account). An **anonymous visitor** has no session. A **registrant** is the anonymous visitor filling in the register
form. Registration is a journal-scoped switch — a journal is **open** (default) or **closed** (`disableUserReg`)
to self-registration; the site-wide register page is closed only when **every** journal is closed. A **disabled**
account (manager-disabled, or created-disabled-pending-validation) can hold credentials but **cannot log in**.
Manager-side account creation, impersonation and role management are other features (see Cross-feature). <sup>a</sup>

| Action | Who may — and when |
|--------|--------------------|
| **Self-register an account** | • Any anonymous visitor — on a journal whose registration is **open** (the default); the register form is public<br>• Anonymous visitor — **cannot** when the journal is registration-**closed** (sees a "registration disabled" error, back-link to login)<br>• An already-logged-in user visiting `/user/register` — is not re-registered; sees the "registration complete" page instead <sup>b</sup> |
| **Choose which role(s) to self-assign** | • The registrant — becomes a **Reader** by default **or** opts into **Reviewer** by ticking the reviewer checkbox (shown only when the journal has a reviewer group that permits self-registration): the two are **mutually exclusive** at sign-up — ticking reviewer routes role assignment through `saveRoleContent`, which skips the default-Reader enrolment, so a reviewer registrant gets **Reviewer only**, not Reader+Reviewer<br>• The registrant — is **not** offered an **Author** role at registration (author is acquired by submitting; the author group is self-registration-flagged in data but not wired to the form — see Open questions) <sup>c</sup> |
| **Log in** | • Anyone holding a valid username/email + password of an **enabled, validated** account<br>• A disabled or not-yet-validated account — **rejected** with an "account disabled" message<br>• An account flagged *must change password* — is bounced to the password-change screen before any session is granted (`password-flows`) <sup>d</sup> |
| **Activate a new account** | • The account owner — by opening the emailed **activation link** (only when the site requires email validation); confirming it enables the account. Anyone else without the link cannot activate it <sup>e</sup> |
| **Log out** | • Any logged-in user — ends their session and returns to the login/home page <sup>f</sup> |

<sup>a</sup> `RegistrationHandler::validate()` (`disableUserReg` gate); `Validation::registerUserSession()` (disabled → refuse); `LoginHandler::authorize()` ·
<sup>b</sup> `RegistrationHandler::register()` (`Validation::isLoggedIn()` → `userRegisterComplete.tpl`; else `RegistrationForm`); `validate()` (`registrationDisabled` error + `exit`); live: anon GET `/user/register` → 200 form; a completed registration renders "Registration complete" ·
<sup>c</sup> `RegistrationForm::readInputData()` (reads `readerGroup`/`reviewerGroup`, not `authorGroup`); `execute()` (default Reader assignment); `UserFormHelper::saveRoleContent()` (`permitSelfRegistration` gate); `userRegister.tpl` (reviewer opt-in fieldset only); live: publicknowledge register form renders `reviewerGroup[16]`, no reader/author checkbox ·
<sup>d</sup> `LoginHandler::signIn()` → `Validation::login()` → `Auth::attempt()` + `registerUserSession()`; `getMustChangePassword()` → `changePassword` redirect; live: wrong password → invalid-credentials error, good password → session ·
<sup>e</sup> `ValidateRegisteredEmail::manageEmail()` (mails link only if `require_validation`); `RegistrationAccessInvite::finalize()` (`setUserValid` → enable + stamp `dateValidated`); `RegistrationHandler::activateUser()` ·
<sup>f</sup> `LoginHandler::signOut()` → `Validation::logout()`; live: signOut → `/login`, header shows Login/Register again

## Fields & validation

**Register form** (`RegistrationForm`, `registrationForm.tpl` + `userRegister.tpl`) — an asterisk in the table = shown
required in the UI. Name/affiliation are stored multilingual (saved in the current UI locale and copied into the
site's primary locale).

| Field (UI label) | Required? | Rules | Anchor |
|------------------|-----------|-------|--------|
| **First Name** (`givenName`) | Yes* | Non-empty; ≤255 chars. Multilingual. | `RegistrationForm::__construct()` (`FormValidator givenName required`) |
| **Last Name** (`familyName`) | No | Optional; ≤255. Multilingual. | `readInputData()` (`familyName`; no validator) |
| **Affiliation** (`affiliation`) | Yes* (UI only) | Marked required in the form, but **no server-side validator** — an off-UI POST with an empty affiliation is accepted. ⚠ see Known deviations. | `registrationForm.tpl` (`required`); `RegistrationForm` (no affiliation check) |
| **Country** (`country`) | Yes* | Required; must be a value from the country dropdown. | `__construct()` (`FormValidator country required`) |
| **Email** (`email`) | Yes* | Required; must be a **valid** email and **not already used** by another account; ≤90. | `__construct()` (`FormValidatorEmail` + `FormValidatorCustom` on `Repo::user()->getByEmail`) |
| **Username** (`username`) | Yes* | Required; **alphanumeric** (plus `-`/`_`), lower-cased; **unique**; ≤32. | `__construct()` (`FormValidatorUsername` + `FormValidatorCustom` on `getByUsername`) |
| **Password** (`password`) | Yes* | Required; at least the site **minimum length**; ≤32; must **match** the repeat field. | `__construct()` (`FormValidatorPassword` with `password2` comparator); `Site::getMinPasswordLength()` |
| **Repeat Password** (`password2`) | Yes* | Must equal Password. | as above |
| **Privacy consent** (`privacyConsent`) | Conditional | Required **only** when the journal (in-context) or site (site-wide form) has a privacy statement configured; a checkbox the registrant must tick. | `__construct()` (`privacyConsent required` when `context->privacyStatement`); `RegistrationForm::validate()` (site-wide array case) |
| **Email consent** (`emailConsent`) | No | Opt-**in** to public email notifications; if left unticked the new user is **opted out** of the public notification types. | `execute()` (`blocked_emailed_notification` when `!emailConsent`) |
| **Reviewer sign-up** (`reviewerGroup[<id>]`) | No | Opt-in checkbox(es); one per reviewer user group that permits self-registration. Ticking it enrols the new user in that reviewer group. | `userRegister.tpl` (`permitSelfRegistration` loop); `saveRoleContent()` |
| **Reviewing interests** (`interests`) | No | Free-text keywords; stored as the user's reviewer interests. Shown next to the reviewer opt-in (in-context) or standalone (site-wide). | `execute()` (`Repo::userInterest()->setInterestsForUser`) |
| **ORCID** (`orcid`) | No | Only on an in-context register page with ORCID enabled; filled by the ORCID OAuth widget, not typed. | `RegistrationForm::fetch()`/`execute()` (`OrcidManager::isEnabled()`) |

**Login form** (`userLogin.tpl`):

| Field (UI label) | Required? | Rules | Anchor |
|------------------|-----------|-------|--------|
| **Username** (`username`) | Yes | The account username (email also accepted by the auth layer). | `LoginHandler::signIn()` |
| **Password** (`password`) | Yes | Checked against the stored bcrypt hash. | `Validation::login()` → `Auth::attempt()` |
| **Keep me logged in** (`remember`) | No | When ticked, issues a persistent "remember" cookie so the session survives browser close. **Ships pre-ticked** on the login page (a template quirk → the persistent cookie is opted in by default; see Known deviations). | `signIn()` (`!!getUserVar('remember')` → `Validation::login(..., $remember)`); `userLogin.tpl` (`checked="$remember"`) |
| **source** (hidden) | No | Internal redirect target; if it looks like a site-relative path the user is returned there after login/registration (how login-gated reader pages come back). | `signIn()`/`register()` (`preg_match('#^/\w#', $source)`) |

## Rules & state

1. **Registration is open by default; a journal can close it.** A journal's **Allow user registration** switch
   (`disableUserReg`) has no default, i.e. registration is **open**. When a journal closes it, `/user/register`
   renders a "registration disabled" error and stops. On the **site-wide** register page (no journal in the URL),
   registration is closed only when **every** journal has `disableUserReg` set; if at least one journal is open the
   site register page is available. **Live-verified**: anon GET `/publicknowledge/user/register` → 200 form.
   <sup>a</sup>
2. **The register form and its validation.** The form collects name/affiliation/country + login credentials
   (Fields table). Server-side it requires **givenName, country, email, username, password** (and the password
   repeat + minimum length); the email and username must be **unique** and well-formed, and the username must be
   **alphanumeric**. Affiliation and last name are **not** server-validated (last name is intentionally optional;
   affiliation is a UI-only "required" — Known deviations). A CSRF token and POST method are enforced. **Live-verified**:
   a well-formed POST created the account; a mismatched/duplicate email or username is rejected with a field error.
   <sup>b</sup>
3. **Self-registerable roles: Reader by default OR Reviewer on request (mutually exclusive) — not Author.** In a journal
   context the register form assigns exactly one of two role sets, keyed on whether any reviewer box is ticked
   (`RegistrationForm::execute()`): with **no** reviewer box ticked, the registrant is enrolled in the default **Reader**
   group; if **any** reviewer box is ticked, role assignment instead routes through `saveRoleContent()`, which enrols the
   user in the ticked **Reviewer** group(s) **only** — the default-Reader branch does not run, so a reviewer registrant is
   **not** also a Reader. The form renders a **Reviewer** opt-in — one checkbox per reviewer group whose user group has
   **permit self-registration** turned on. It does **not** offer an **Author** checkbox and does not read an `authorGroup`
   input, so a visitor cannot self-register as an author even though the default author group carries
   `permitSelfRegistration` in the registry (author is instead acquired implicitly by submitting). Which reviewer/reader
   groups are self-registerable is governed by `roles-permissions` (the `permitSelfRegistration` user-group flag).
   **Live-verified**: the publicknowledge register form shows exactly one reviewer opt-in (`reviewerGroup[16]`) and no
   reader/author checkbox; a plain registration produced an account with **Reader only** (role id 1048576), and a reviewer
   opt-in produced **Reviewer only** (role id 4096, no Reader). <sup>c</sup>
4. **Consent and notification preferences.** When the journal (or, for the site form, the site) has a **privacy
   statement**, the registrant must tick the **privacy consent** box or the form fails with a "consent required"
   error. A separate **email consent** box is opt-in for public email notifications; leaving it unticked writes
   *blocked* entries for the public notification types so the user does not receive them. <sup>d</sup>
5. **Creating the account.** On a valid submission the handler builds a new user: username, multilingual
   name/affiliation, email, country, `dateRegistered = now`, inline help on, and the **bcrypt-encrypted password**;
   it saves the row, assigns the chosen role group(s), stores reviewer interests, and (if email consent was declined)
   the notification opt-outs. `registerUser` is a **backwards-compatible alias** that simply calls `register` — the
   same handler op, kept for third-party themes that post to the old URL. <sup>e</sup>
6. **Email validation is off by default; when on, the account is born disabled.** With `require_validation` **off**
   (the shipped default) a new account is immediately usable: the handler logs the registrant straight in and shows the
   **"Registration complete"** page (or returns them to their `source`). With `require_validation` **on**, `execute()`
   creates the account **disabled** (disabled reason = "account not validated"), **no auto-login** occurs, and the
   registrant is shown a **"pending validation"** message telling them to check their email. **Live-verified**: default
   registration created an enabled account, auto-logged-in ("Registration complete"), and **sent no email**. <sup>f</sup>
7. **The validation email and the activation link (validation on only).** When validation is required, a listener
   sends the registrant a **Validate Email** message — the **context** variant (`USER_VALIDATE_CONTEXT`, from the
   journal's support address) for a journal registration, or the **site** variant (`USER_VALIDATE_SITE`) for a
   site-level one. The link is generated through the **invitation framework**: a `RegistrationAccessInvite` is
   created and its accept-URL becomes the email's `activateUrl`. No email is sent when validation is off. <sup>g</sup>
8. **Activating the account is a two-step confirm.** Opening the emailed link lands on the invitation **accept**
   handler, which shows a **confirmation page** with an "activate" button; that button targets
   `RegistrationHandler::activateUser/<username>` (carrying the invitation id + key). `activateUser` **finalizes** the
   invitation — enabling the account, clearing the disabled reason, and stamping **`dateValidated = now`** — then shows
   an **"account activated"** message; the user can now log in. An already-validated or missing account is redirected to
   login. A legacy `activateUser/<username>/<accessKey>` (MD5 access-key) branch is retained for backwards
   compatibility. <sup>h</sup>
9. **Logging in.** `signIn` verifies the CSRF token, then authenticates username + password (email is also accepted).
   A successful credential check that lands on an **enabled** account starts a session, records **last-login**, and —
   if **Keep me logged in** was ticked — issues a persistent remember cookie. Redirect after login: if the user holds an
   **editorial-type role** in the current journal and gave no `source`, they go to the **dashboard**; otherwise they are
   sent to `source` (if it is a site-relative path) or to the journal/site **home**. **Live-verified**: a plain reader
   logged in and landed on the journal home (not the dashboard) with a `remember_web_*` cookie set. <sup>i</sup>
10. **Forced password change intercepts login.** If the account is flagged **must change password**, `signIn`
    authenticates then immediately **logs the session back out** and redirects to the password-change screen — the user
    gets **no** working session until they set a new password. The change screen itself is owned by `password-flows`
    (this rule is only the login-side trigger). <sup>j</sup>
11. **Failed login outcomes.** Wrong username or password → generic **"invalid username/email or password"** error, form
    redisplayed. A **disabled** account (manager-disabled, or created-disabled-pending-validation) → **"account disabled"**
    (with the disabled reason if one is set) — this is how an unvalidated account is refused. When login **rate-limiting**
    is enabled (a site setting, off by default) and too many attempts have come from the username/IP, the form shows the
    **same generic** login error (the throttle is not revealed) and adds an artificial delay. **Live-verified**: wrong
    password redisplayed the invalid-credentials error and granted no session. <sup>k</sup>
12. **Logging out.** `signOut` ends the session (Laravel logout + session invalidate + CSRF-token regeneration), but
    **re-stashes the username/email** into the fresh session so the login form can pre-fill it next time. The user is
    redirected to `source` if given, else back to the login/home page. **Live-verified**: signOut returned to `/login`
    with Login/Register links visible again. <sup>l</sup>
13. **The session.** Sessions are **database-backed** (`sessions` table: id, `user_id`, ip, user-agent, last-activity,
    payload; deleted when the user is deleted). Three middleware layers run per request: **start session**
    (cookie/session before auth), **encrypt cookies** (when cookie encryption is on), and **authenticate session**
    (guards the logged-in state, invalidating on password change / concurrent-session rules). "Keep me logged in" is the
    Laravel **remember** cookie. Impersonation (`login-as`) migrates the session id — which is why cached login state can
    go stale after an impersonation test. <sup>m</sup>

<sup>a</sup> `RegistrationHandler::validate()` (site-index loops all contexts, closed only if none open; else `disableUserReg`); `context.json` `disableUserReg` (no default) ·
<sup>b</sup> `RegistrationForm::__construct()` (the addCheck chain), `readInputData()`, `FormValidatorPost`/`FormValidatorCSRF`; live POST create + duplicate-email/username rejection ·
<sup>c</sup> `RegistrationForm::execute()` (`if context && !reviewerGroup → default Reader`); `UserFormHelper::saveRoleContent()` (reviewer/author/reader loops gated on `permitSelfRegistration`, but `authorGroup` never read); `registry/userGroups.xml` (`reader`/`externalReviewer`/`author` `permitSelfRegistration="true"`); `userRegister.tpl`; live `reviewerGroup[16]` only ·
<sup>d</sup> `RegistrationForm::__construct()`/`validate()` (privacy consent); `execute()` (`blocked_emailed_notification` via `NotificationSubscriptionSettingsDAO`) ·
<sup>e</sup> `RegistrationForm::execute()` (build/`Repo::user()->add`, `Validation::encryptCredentials`, interests, notifications); `RegistrationHandler::registerUser()` (alias → `register`) ·
<sup>f</sup> `RegistrationHandler::register()` (`require_validation` branch → `message.tpl` pending; else `Validation::login` + redirect); `RegistrationForm::execute()` (`setDisabled(true)` + `setDisabledReason` when validation on); `config.TEMPLATE.inc.php` `require_validation = Off`; live: enabled + auto-login + no mail ·
<sup>g</sup> `ValidateRegisteredEmail::manageEmail()` (`emailValidationRequired()` guard; Context vs Site mailable; `RegistrationAccessInvite->updateMailableWithUrl` → `activateUrl`); `ValidateEmailContext`/`ValidateEmailSite` (`USER_VALIDATE_CONTEXT`/`USER_VALIDATE_SITE`) ·
<sup>h</sup> `RegistrationAccessInviteRedirectController::acceptHandle()` (`userConfirmActivation.tpl`, builds `user/activateUser/<username>` URL); `RegistrationHandler::activateUser()` (`getByIdAndKey` → `finalize()`); `RegistrationAccessInvite::finalize()`/`setUserValid()` (`setDisabled(false)`, `setDateValidated(now)`) ·
<sup>i</sup> `LoginHandler::signIn()` + `_redirectAfterLogin()` (editorial-role intersection → dashboard, else `redirectHome`); `Validation::login()` (`Auth::attempt(..., $remember)`) → `registerUserSession()` (`setDateLastLogin`); live reader → home + `remember_web_*` cookie ·
<sup>j</sup> `LoginHandler::signIn()` (`getMustChangePassword()` → `Validation::logout()` + redirect `changePassword`) ·
<sup>k</sup> `signIn()` (rate-limit branch → generic `user.login.loginError`; `reason` → `accountDisabled[WithReason]`); `Validation::registerUserSession()` (disabled → set `reason`, return false); `RateLimitingService::isLoginLimited()`; live wrong-password error ·
<sup>l</sup> `LoginHandler::signOut()` → `Validation::logout()` (`Auth::logout`, `session->invalidate()`, `regenerateToken()`, re-put `username`/`email`); live → `/login` ·
<sup>m</sup> `SessionsMigration` (table columns + `onDelete cascade`); `PKPStartSession`/`PKPEncryptCookies`/`PKPAuthenticateSession` middleware; `Validation::login(..., $remember)` (remember cookie)

## Side effects

- **`users` row** — one per successful registration: username, email, country, multilingual name/affiliation,
  `date_registered`, `inline_help = 1`, bcrypt password, and `date_validated` = now (validation off) or **null until
  activated** (validation on); `disabled = 1` + disabled reason while pending validation. Login stamps
  `date_last_login`; activation flips `disabled → 0`, clears the reason, and sets `date_validated`.
- **Role enrolment** (`user_user_groups`) — the default **Reader** group when no reviewer box is ticked, otherwise the
  ticked **Reviewer** group(s) only (the two paths are mutually exclusive — see Rule 3). Reviewer **interests** land in
  `user_interests`; declined email consent writes `blocked_emailed_notification` rows in the notification settings.
- **`sessions` row** — created/updated on login; carries the user id, ip, user-agent, last-activity and payload;
  a "remember" cookie is set when requested; the row is destroyed on logout / cascade-deleted with the user.
- **`invitations` row** (validation on only) — a `RegistrationAccessInvite` is created to carry the activation link and
  is marked **accepted** when the user activates.
- **Emails.** During **self-registration** the *only* possible email is the **Validate Email** (context or site), and
  **only when `require_validation` is on**; with validation off, self-registration sends **no email**. The **User
  Created** welcome-with-password email (`USER_REGISTER`) is **not** part of self-registration — it is sent when a
  **manager creates an account for someone** from the Users grid (owned by `user-management`); it is claimed here as the
  registration-family mailable but its trigger lives in that feature.
- **No manager notification** — a public self-registration does not notify editors/managers (unlike, e.g., a new
  comment).

## Settings that modify behavior

- **Allow user registration** (`disableUserReg`, per journal) — closes self-registration for that journal (Rule 1).
- **`require_validation`** (`config.inc.php [email]`, default **Off**) — makes new accounts start disabled and require
  the emailed activation link before login (Rules 6–8, 11).
- **reCAPTCHA / ALTCHA** (`config.inc.php [captcha]`: `recaptcha`, `altcha`, both default **off**; the per-page toggles
  `captcha_on_register` / `captcha_on_login` / `altcha_on_*` only take effect when the parent switch is on) — adds a
  human-verification challenge to the register and/or login forms. **Live-verified**: neither widget rendered on the
  stock register/login pages.
- **Login rate-limiting** (`rateLimitEnabled`, site setting, default **off**) — throttles repeated failed logins (and
  password-reset requests) per username/IP, showing a generic error and adding delay (Rule 11).
- **Privacy statement** (journal `privacyStatement`, or site + `sitewide_privacy_statement`) — turns the privacy-consent
  checkbox into a required field (Rule 4).
- **Minimum password length** (`Site::getMinPasswordLength()`) — floor for the register password validator.
- **`force_login_ssl`** (`config.inc.php [security]`, default Off) — forces the register/login forms and POSTs to HTTPS.
- **Self-registration user groups** (`permitSelfRegistration` on a user group, owned by `roles-permissions`) — which
  reviewer/reader groups appear as opt-in roles (Rule 3).
- **ORCID** (per journal) — when enabled, the in-context register page shows the ORCID sign-in widget.

## Cross-feature interactions

- **password-flows** (feature 48) — owns **forgotten-password reset** (`/login/lostPassword`,
  `requestResetPassword`, `resetPassword`, `updateResetPassword`) and the **forced first-login password change**
  (`changePassword` / `savePassword`). Those handler ops live in the same `LoginHandler` but are **not** claimed here.
  The seam: login **triggers** the forced change (Rule 10, `mustChangePassword`) and the register/login pages link to
  "reset your password", but the reset/change machinery and the password-reset email are that feature's.
- **user-profile** (feature 49) — owns editing an existing account (identity, contact, notification prefs, API key,
  reviewer interests). Registration seeds the **initial** identity, affiliation and interests; the register page's
  "log in" link points at the profile **roles** tab. Ongoing edits are theirs.
- **user-management** (feature 50) — owns a **manager creating / disabling / merging** accounts and the **User Created**
  welcome email. This spec owns only **self**-registration. Both touch `users`; the schema is documented here (as the
  creation point), the CRUD rules there.
- **login-as** (feature) — owns admin **impersonation** (`signInAsUser` / `signOutAsUser`), which shares the `sessions`
  table and migrates the session id. Documented here for the session schema; the impersonation behavior is theirs.
- **roles-permissions** — owns user groups and the **`permitSelfRegistration`** flag that decides which roles the
  register form offers (Rule 3).
- **user-invitations** — provides the **invitation framework** the activation link now rides on
  (`RegistrationAccessInvite` + the invitation accept handler). This spec consumes it for account activation.
- **submission-wizard / public-comments / other login-gated reader flows** — the **login gate** this feature provides.
  A login-gated page sends the visitor to `/login?source=…`; after a successful login (or registration) the `source`
  redirect returns them to where they started (e.g. the "Log in to comment" button on an article).

## Canonical scenarios

1. **Register as a reader (default account)** — An anonymous visitor opens `/user/register` on an open journal, fills
   in name, affiliation, country, email, username and password, accepts the privacy statement, and submits. A Reader
   account is created and — validation being off — they are logged straight in and shown "Registration complete".
   (Live-verified: account created enabled, auto-logged-in, no email.)
2. **Register and opt into reviewing** — The registrant additionally ticks the **reviewer** sign-up box and types a few
   reviewing interests; the new account is enrolled in the ticked **reviewer** group and the interests are stored.
   As-built, ticking reviewer routes role assignment through `saveRoleContent` (which enrols only the ticked group), so
   the default-**Reader** enrolment — which runs *only* when no reviewer box is ticked — does **not** also apply: a
   reviewer registrant gets **Reviewer, not Reader+Reviewer**. Reader and Reviewer are the only self-selectable roles and
   are mutually exclusive at sign-up; author is not offered. (Live-verified: reviewer opt-in → Reviewer role only, id 4096.)
3. **Registration blocked when the journal is closed** — With **Allow user registration** turned off, an anonymous
   visitor opening `/user/register` gets a "registration disabled" error with a link back to login, and cannot create
   an account.
4. **Privacy consent is enforced** — On a journal that has a privacy statement, submitting the register form **without**
   ticking the consent box fails with a "consent required" error; ticking it lets the registration through. (The
   consent box only appears/binds when a statement is configured.)
5. **Duplicate email or username is rejected** — The registrant submits an email or username already held by another
   account; the form redisplays with a field error and no account is created. (Live-verified: unique-email/username
   validators.)
6. **Email validation + activation** — With `require_validation` on, registration creates a **disabled** account, sends
   no session, and emails a **Validate Email** link. The user opens it, confirms on the activation page, and the account
   is enabled with `date_validated` stamped; they can now log in. Before activation, a login attempt is refused as
   "account disabled".
7. **Log in and land in the right place** — A reader logs in and is returned to the journal **home** (or their `source`
   page); an editor/manager logging in with no `source` lands on the **dashboard**. (Live-verified: reader → home.)
8. **Keep me logged in** — Logging in with **Keep me logged in** ticked issues a persistent remember cookie so the
   session survives a browser restart. (Live-verified: `remember_web_*` cookie set.)
9. **Failed login** — A wrong password shows the generic "invalid username/email or password" error and grants no
   session; the username the user typed is preserved in the form. (Live-verified.)
10. **Log out** — A logged-in user signs out; the session is destroyed, and the login/register links reappear (the
    username is pre-filled if they return to the login form). (Live-verified: signOut → `/login`.)

## Known deviations (as-built ≠ intent)

- ⚠ **Affiliation is required in the register UI but not enforced on the server** (propose **ledger row 108**). The
  register template marks the affiliation field required (asterisk + HTML5 `required`), but `RegistrationForm` adds
  **no** affiliation validator — so a normal browser user is blocked from submitting without it, while a scripted /
  no-JS / API POST that omits affiliation **creates the account anyway**. Impact is LOW (no data loss; only reachable
  off the stock UI), but it is an internal UI-vs-backend inconsistency that would surprise a manager who believes
  affiliation is mandatory. Suspected intent: either add a server-side `FormValidator affiliation required` or drop the
  UI-required marker to match.
- ⚠ **The login "Keep me logged in" checkbox ships pre-ticked** (propose **ledger row 109**). `userLogin.tpl` renders the
  checkbox as `<input type="checkbox" name="remember" … checked="$remember">`, but `$remember` is never assigned by
  `LoginHandler::index()` and a bare `$remember` is not interpolated inside the attribute — so Smarty emits the literal
  `checked="$remember"`, and HTML treats the mere presence of the `checked` boolean attribute as checked. Every fresh
  login page therefore arrives with "keep me logged in" **already ticked**, so a user who signs in without noticing gets
  the persistent Laravel `remember_web_*` cookie (a long-lived auto-login) they never opted into. Impact is LOW (the user
  can untick it), but it **contradicts the opt-in affordance** and is a genuine privacy/security default-on concern on
  shared/public computers. **Live-verified**: GET `/login` returns `checked="$remember"`; a login left at the default set
  a `remember_web_*` cookie, and only un-ticking suppressed it (retained `registration-login.spec.js` asserts both
  directions). Suspected intent: render the box **unchecked** by default — drop the `checked="$remember"` attribute or
  bind it to an actual, default-false template var.
- **Observation (not flagged ⚠): the Author group is self-registration-flagged but unreachable from the register
  form.** `registry/userGroups.xml` ships the default **author** group with `permitSelfRegistration="true"`, and
  `UserFormHelper::saveRoleContent()` includes an `authorGroup` branch — but `RegistrationForm::readInputData()` never
  reads `authorGroup` and the template renders no author checkbox, so self-registering as an author is impossible via
  the UI (author is acquired by submitting). This is most likely **intended** (hence no ⚠), but the dangling
  `permitSelfRegistration` + `authorGroup` handling is dead relative to the form — see Open questions.

## Open questions

1. **Is author self-registration meant to be disabled at the form?** The author group is `permitSelfRegistration=true`
   and the save-helper handles an `authorGroup`, yet the form neither renders nor reads it. Confirm author-by-submission
   is the intended path and the author self-registration plumbing is deliberately dormant (or should be removed).
2. **Should affiliation be server-required (row 108)?** One sentence settles whether to add the validator or remove the
   UI-required marker.
3. **Is email validation (`require_validation`) expected to ship off?** The stock default creates immediately-usable
   accounts with no confirmation email; confirm off-by-default is intended for production installs.
4. **Does the legacy `activateUser/<username>/<accessKey>` (MD5 access-key) branch still have live callers**, or is it
   fully superseded by the invitation-based activation and safe to treat as dead code?
5. **Is the login "Keep me logged in" box meant to default to ticked?** As-built it ships pre-ticked (row 109), silently
   opting every user into a persistent session cookie; confirm whether persistent-session-by-default is intended, or the
   checkbox should default off to match its opt-in affordance.

---

## Reference — entry points & surfaces

| Entry | Path | Atom |
|-------|------|------|
| Register form (GET) | `…/user/register` → `RegistrationHandler::register` → `userRegister.tpl` | PAGE-user-register |
| Register submit (POST) | `…/user/register` (POST) → `register`; legacy alias `…/user/registerUser` → `registerUser` | PAGE-user-registeruser |
| Activate account | `…/user/activateUser/<username>?invitationId=…&invitationKey=…` → `activateUser` | PAGE-user-activateuser |
| Login form | `…/login` → `LoginHandler::index` → `userLogin.tpl` | PAGE-login-index |
| Login submit | `…/login/signIn` → `signIn` | PAGE-login-signin |
| Logout | `…/login/signOut` → `signOut` | PAGE-login-signout |
| Validate-email mail (context) | sent on registration when `require_validation` on, from the journal support address | MAIL-validate-email-context |
| Validate-email mail (site) | as above, for a site-level registration | MAIL-validate-email-site |
| User-created welcome mail | sent when a **manager** adds a user (Users grid — not self-registration) | MAIL-user-created |
| Account row | `users` (created on register; enabled/validated per config) | DB-users |
| Session row | `sessions` (created on login; remember cookie optional) | DB-sessions |
| Session middleware | start-session / authenticate-session / encrypt-cookies (per request) | AUTHZ-pkp-start-session, AUTHZ-pkp-authenticate-session, AUTHZ-pkp-encrypt-cookies |

## Reference — code anchors

- **Registration handler**: `lib/pkp/pages/user/RegistrationHandler.php` — `register()` (form + validation + validation-vs-login
  branch + `source` redirect), `registerUser()` (alias), `activateUser()` (invitation finalize + legacy access-key), `validate()`
  (`disableUserReg` gate).
- **Registration form**: `lib/pkp/classes/user/form/RegistrationForm.php` — `__construct()` (validators), `readInputData()`,
  `validate()` (site-wide consent), `execute()` (build user, roles, interests, notification opt-outs, disabled-on-validation);
  `lib/pkp/classes/user/form/UserFormHelper.php` — `assignRoleContent()` / `saveRoleContent()` (`permitSelfRegistration`).
- **Register templates**: `lib/pkp/templates/frontend/pages/userRegister.tpl` (reviewer opt-in, consent),
  `…/components/registrationForm.tpl` (identity + login fields), `…/pages/userRegisterComplete.tpl` (success),
  `…/pages/userConfirmActivation.tpl` (activation confirm), `…/pages/message.tpl` (pending/activated).
- **Login handler**: `lib/pkp/pages/login/LoginHandler.php` — `index()`, `signIn()` (rate-limit, captcha, auth, must-change,
  redirect), `signOut()`, `_redirectAfterLogin()`, `authorize()`. (`lostPassword`/`requestResetPassword`/`resetPassword`/
  `updateResetPassword`/`changePassword`/`savePassword` and `signInAsUser`/`signOutAsUser` are in this file but belong to
  `password-flows` / `login-as`.)
- **Auth core**: `lib/pkp/classes/security/Validation.php` — `login()` (CSRF + `Auth::attempt` + remember),
  `registerUserSession()` (disabled gate, last-login), `logout()` (invalidate + re-stash username/email), `encryptCredentials()`,
  `verifyPassword()`; `lib/pkp/classes/security/RateLimitingService.php` (`isRateLimitEnabled`, `isLoginLimited`).
- **Activation / invitation**: `lib/pkp/classes/observers/listeners/ValidateRegisteredEmail.php` (mails link if validation on),
  `lib/pkp/classes/observers/events/UserRegisteredContext.php` / `UserRegisteredSite.php`,
  `lib/pkp/classes/invitation/invitations/registrationAccess/RegistrationAccessInvite.php` (`updateMailableWithUrl`, `finalize`,
  `setUserValid`) + `…/handlers/RegistrationAccessInviteRedirectController.php` (`acceptHandle`).
- **Mailables**: `lib/pkp/classes/mail/mailables/ValidateEmailContext.php` (`USER_VALIDATE_CONTEXT`),
  `ValidateEmailSite.php` (`USER_VALIDATE_SITE`), `UserCreated.php` (`USER_REGISTER`; dispatched from
  `lib/pkp/controllers/grid/settings/user/form/UserDetailsForm.php` — user-management).
- **Session / middleware / schema**: `lib/pkp/classes/migration/install/SessionsMigration.php` (`sessions` table),
  `lib/pkp/classes/middleware/PKPStartSession.php`, `PKPAuthenticateSession.php`, `PKPEncryptCookies.php`;
  `lib/pkp/classes/migration/install/CommonMigration.php` (`users` table).
- **Settings**: `config.TEMPLATE.inc.php` (`require_validation`, `recaptcha`/`altcha` + per-page toggles, `force_login_ssl`,
  `sitewide_privacy_statement`); `lib/pkp/schemas/context.json` (`disableUserReg`); `registry/userGroups.xml`
  (`permitSelfRegistration`).
- **Liveness note**: probed 2026-07-05 against the running `:8000` server (DB `ojs_test`, PostgreSQL). Anon GET
  `/publicknowledge/user/register` → 200, form renders name/affiliation/country/email/username/password + one reviewer
  opt-in (`reviewerGroup[16]`), no reader/author checkbox, no reCAPTCHA/ALTCHA widget. A real POST created an enabled
  account, auto-logged the registrant in ("Registration complete"), and sent **no** email (Mailpit unchanged) — confirming
  `require_validation` off by default. Login probes: wrong password → "invalid username/email or password" (no session);
  correct password + remember → session + `remember_web_*` cookie, reader redirected to the journal home; `signOut` →
  `/login` with Login/Register visible. `disableUserReg` (registration-closed) and the disabled-account login refusal were
  read from code (publicknowledge is read-only — not toggled live), but both are additionally exercised by the retained
  tests (a scratch `disableUserReg` journal for the closed case; the serial activation test for the disabled/unvalidated
  refusal). **Verifier re-confirmed 2026-07-05** (`:8000`/`ojs_test`, anon curl + admin API): the **row-108** off-UI POST
  omitting affiliation was force-driven live (→ 302 → "Registration complete", auto-logged-in, profile reachable, **no**
  mail) — the empty-affiliation account was created; a **reviewer opt-in** registration yielded **Reviewer only** (role id
  4096, no Reader) and a plain registration **Reader only** (1048576), confirming the mutually-exclusive role branch
  (Rule 3, Scenario 2); the login page ships the remember-me box **pre-ticked** (`checked="$remember"` in the served HTML —
  ⚠ Known deviations / ledger row 109); admin login redirected to the **editorial dashboard**, matching the reader → home
  observation (Rule 9).
</content>
</invoke>
