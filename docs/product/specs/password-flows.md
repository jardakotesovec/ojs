---
name: password-flows
scope: A user who has lost, been forced to change, or simply wants to change their password gets back into their account — the forgotten-password email reset, the forced first-login change, and the standalone change form
shared: pkp-lib          # LoginHandler + ResetPasswordForm + LoginChangePasswordForm + Validation's reset-hash machinery + the PasswordResetRequested mailable all live in lib/pkp; OJS supplies only the journal context (email template + support address)
status: verified         # adversarial verifier: permission + state rules re-confirmed (code + live 2026-07-05); rows 110/111 appended to the ledger
e2e-plans: [password-flows]
atlas-claims:
  - PAGE-login-lostpassword
  - PAGE-login-requestresetpassword
  - PAGE-login-resetpassword
  - PAGE-login-updateresetpassword
  - PAGE-login-changepassword
  - PAGE-login-savepassword
  - MAIL-password-reset-requested
---

# Password flows (forgot / reset, forced change, standalone change)

## Purpose

This is the "I can't get in" (and "I must change this") half of the front door. It covers three journeys, all
served by the shared `LoginHandler` at `/login`:

1. **Forgot password.** An anonymous visitor who cannot remember their password opens **Reset Password**
   (`/login/lostPassword`), types their **registered email**, and is emailed a **reset link**. The link carries a
   signed, time-limited hash; opening it presents a **new-password** form that sets the password and lets them log in.
2. **Forced change on first login.** When an account is flagged **must change password** (e.g. a manager created it, or
   an admin reset it), the very next login is **intercepted**: the session is refused and the user is bounced to a
   **change-password** screen (`/login/changePassword/<username>`) where they must set a new password before they can
   proceed. `registration-login` owns the login-side *trigger*; the interception screen and its save are here.
3. **Standalone change.** The same `/login/changePassword` form is reachable directly and lets a user set a new password
   by supplying their **username + current password + new password** — the form used by the forced-change flow, also
   usable on its own.

The everyday "change my password while logged in" that a user reaches from **Profile → Password** is a *separate*,
session-bound surface owned by `user-profile` (it reuses these same password rules — see Cross-feature). This spec owns
the lost-password + reset machinery, the reset email, the reset-hash security, the forced-change interception screen,
and the standalone `LoginHandler` change form.

## Actors & permissions

All six operations live on the anonymous `LoginHandler` — **none carries a role policy** (`LoginHandler::authorize()`
adds a policy only for `signInAsUser`). Access is therefore governed by *knowledge*, not by a session: the reset by
possession of the emailed **hash**, the change by knowledge of the account's **current password**. Two ops send a
logged-in visitor **home** instead of showing the form (`lostPassword`, `resetPassword`); the other four run for anyone.
A **disabled** account (manager-disabled or pending-validation) is refused a reset. "Registered email" = the email on
the `users` row. <sup>a</sup>

| Action | Who may — and when |
|--------|--------------------|
| **Request a password reset** | • Any anonymous visitor — enters a registered email on the Reset Password form; a reset link is emailed to that address<br>• An **unknown** email — the form shows the **same** "confirmation sent" page and sends **nothing** (no account enumeration)<br>• A **disabled** account's email — refused with an "account disabled" message (with reason if set); no mail<br>• An already-logged-in visitor — the Reset Password page sends them home instead <sup>b</sup> |
| **Set a new password via the reset link** | • Anyone holding a **valid, unexpired** reset hash for the username in the link — sees the new-password form and can set it<br>• A tampered / expired hash — rejected with an "invalid or expired link" error page<br>• An unknown username in the link — redirected back to Reset Password<br>• A logged-in visitor opening the *link page* — sent home (the save endpoint does not re-check this) <sup>c</sup> |
| **Be forced to change on first login** | • An account flagged **must change password** — its next login is intercepted (no session granted) and it is sent to the change-password screen; it stays locked out of everything until a new password is saved (⚠ the trigger, in `registration-login`) <sup>d</sup> |
| **Change a password (standalone / forced screen)** | • Anyone who supplies a **username + that account's current password** — may set a new password with no session (this is by design: the forced-change screen runs *after* the interception has already logged the session out)<br>• A wrong current password — rejected ("the current password you entered was incorrect")<br>• ⚠ reachable and operable **anonymously for any username** — see Known deviations & Open questions <sup>e</sup> |

<sup>a</sup> `LoginHandler::authorize()` (only `signInAsUser` gated); `LoginHandler::changePassword()`/`savePassword()`/`requestResetPassword()`/`updateResetPassword()` (no `isLoggedIn` guard) ·
<sup>b</sup> `LoginHandler::lostPassword()` (`isLoggedIn → sendHome`), `requestResetPassword()` (`getByEmail`; unknown → same `message.tpl` `confirmationSent`; `getDisabled()` → error; sends `PasswordResetRequested` only when a live enabled user matches) ·
<sup>c</sup> `LoginHandler::resetPassword()` (`isLoggedIn → sendHome`; unknown username → redirect `lostPassword`; `ResetPasswordForm::validatePasswordResetHash()` → form or `displayInvalidHashErrorMessage`); `updateResetPassword()` (no `isLoggedIn` guard) ·
<sup>d</sup> `LoginHandler::signIn()` (`getMustChangePassword()` → `Validation::logout()` + redirect `changePassword`, claimed by `registration-login`) ·
<sup>e</sup> `LoginHandler::changePassword()`/`savePassword()` (no policy); `LoginChangePasswordForm` `oldPassword` check via `Validation::checkCredentials($username, …)`

## Fields & validation

**Reset Password form** (`userLostPassword.tpl`, `LoginHandler::lostPassword`):

| Field (UI label) | Required? | Rules | Anchor |
|------------------|-----------|-------|--------|
| **Registered email** (`email`) | Yes* | The email of the account to reset. Any syntactically-present value is accepted at the form; a match is looked up server-side, and a non-match still shows success (Rule 2). | `requestResetPassword()` (`Repo::user()->getByEmail`) |

**New-password form** (`userPasswordReset.tpl`, `ResetPasswordForm`) — reached via the reset link:

| Field (UI label) | Required? | Rules | Anchor |
|------------------|-----------|-------|--------|
| **New password** (`password`) | Yes* | Required; **≥ site minimum length** (6 by default); must **match** the repeat field; **rejects known-breached passwords** when the compromised-password setting is on (default off). ≤32. | `ResetPasswordForm::__construct()` (`FormValidatorPassword` w/ `password2`) |
| **Repeat new password** (`password2`) | Yes* | Must equal New password. | as above |
| *username, hash* (hidden) | — | Carried from the link; the hash is re-validated on submit (Rule 4). | `readInputData()` (`username`,`hash`) |

**Change-password form** (`loginChangePassword.tpl`, `LoginChangePasswordForm`) — the forced-change screen and standalone `/login/changePassword`:

| Field (UI label) | Required? | Rules | Anchor |
|------------------|-----------|-------|--------|
| **Username** (`username`) | Yes* | The account to change; a **visible, editable** text field (pre-filled from the URL on the forced-change redirect, empty on the bare `/login/changePassword`). | `loginChangePassword.tpl`; `changePassword()` (`setData('username', $args[0])`) |
| **Current password** (`oldPassword`) | Yes* | Must be the account's current password, else "the current password you entered was incorrect". | `LoginChangePasswordForm::__construct()` (`FormValidatorCustom` → `Validation::checkCredentials`) |
| **New password** (`password`) | Yes* | Required; **≥ site minimum length** (6). ≤32. **No breach check** on this form even when the compromised-password setting is on — ⚠ Known deviations. | `__construct()` (`FormValidatorLength >= getMinPasswordLength` + `FormValidator required`) |
| **Repeat new password** (`password2`) | Yes* | Must equal New password. | `__construct()` (`FormValidatorCustom` `password == password2`) |

## Rules & state

1. **Lost password → a reset email.** The Reset Password page (anonymous; logged-in visitors are sent home) collects a
   registered email and POSTs to `requestResetPassword`, which looks the user up by email. For a **live, enabled**
   account it composes the **Password Reset Confirmation** mail (`PASSWORD_RESET_CONFIRM`) and sends it; then — for
   *every* outcome — it renders the generic **"a confirmation email has been sent"** message. **Live-verified**: a real
   email POST produced the mail and the confirmation page. <sup>a</sup>
2. **No account enumeration.** An **unknown** email produces the *identical* "confirmation sent" page and sends **no**
   mail; a **disabled** account's email produces an "account disabled" error (with the disabled reason if present) and
   no mail. So a caller cannot distinguish "no such account" from "email sent". **Live-verified**: an unknown address
   returned the confirmation page with **zero** mail delivered. <sup>b</sup>
3. **The reset link & its from-address.** The mail's `passwordResetUrl` is
   `/{journal}/login/resetPassword/<username>?confirm=<hash>` where `<hash>` = `<hmac>:<expiry-unix-timestamp>` (the
   `:` is URL-encoded `%3A`). The URL is emitted as a **raw string** in the template, not an `<a>` anchor. The mail is
   sent **from the site contact address** (not the journal's) even inside a journal context, though the *template* is
   resolved per-context. **Live-verified**: link shape `…/login/resetPassword/pwprobe_a?confirm=<64-hex>%3A<ts>`, from
   `admin@test.local` (site contact). <sup>c</sup>
4. **The reset hash: signed, self-invalidating, time-boxed.** `generatePasswordResetHash(userId)` builds
   `HMAC(username + current-password-hash + last-login + expiry, site-salt) : expiry`, where **expiry = now +
   `reset_seconds`** (default **7200 s / 2 h**). `verifyPasswordResetHash` splits off the expiry, rejects if
   `expiry < now`, and re-derives the HMAC with that same expiry — a match means the hash is authentic *and* unexpired.
   Because the **current password hash** and **last-login time** are in the payload, the link **stops working the moment
   the password is changed or the user logs in** — i.e. it is effectively **single-use** and invalidated by any
   intervening login. Opening `resetPassword` with a valid hash shows the new-password form; a tampered or past-expiry
   hash shows the **"could not be validated … may have expired or is not valid"** error page (back-link to
   lostPassword); an **unknown username** in the link 302s to lostPassword. **Live-verified**: valid hash → form;
   `deadbeef:<ts>` and `<goodhmac>:100` → the same error page; unknown user → redirect. <sup>d</sup>
5. **Setting the new password (updateResetPassword).** On submit the hash is **re-validated** (invalid → the error
   page), then the form validates (length + match + breach-when-enabled). On success it encrypts the new password,
   **clears `must_change_password`**, updates the session user, **logs the account out of all other devices**
   (`Auth::logoutOtherDevices`), and saves; the user sees a **"password updated"** message with a login link. The old
   password no longer works and the used link is now dead (Rule 4). **Live-verified**: valid submit changed the
   password — the new password logged in, the old one was rejected, and re-opening the same link returned the
   "expired/invalid" page. <sup>e</sup>
6. **Forced change intercepts the first login.** When `signIn` authenticates an account flagged **must change
   password**, it immediately **logs the session back out** and redirects to `/login/changePassword/<username>` — so the
   account gets **no working session** until it sets a new password. **Live-verified**: logging in as a `mustChangePassword`
   user 302'd to `…/login/changePassword/<username>` and `/user/profile` then bounced to `/login` (no session). The login
   trigger itself is `registration-login`'s (Rule 10 there); this spec owns the screen it lands on. <sup>f</sup>
7. **Changing the password (savePassword).** The change form validates **current password** (`checkCredentials`),
   **new-password length**, **new≠repeat**, CSRF + POST. On success it encrypts the new password, **clears
   `must_change_password`**, **logs the account out of other devices**, saves, then **logs the user in** with the new
   password and sends them home — so the forced-change user emerges logged in and unblocked. A wrong current password
   re-renders the form with "the current password you entered was incorrect"; a too-short or mismatched new password
   re-renders with the length / "passwords do not match" error and **changes nothing**. **Live-verified**: a valid
   change 302'd (logged in), and a subsequent login for the ex-`mustChangePassword` user went to the dashboard (flag
   cleared, no re-interception); wrong-old / short / mismatch each re-rendered with the right error and left the
   password intact. <sup>g</sup>
8. **The standalone change form is anonymous and username-driven.** `/login/changePassword` renders for **anyone**
   (200, no session), and `savePassword` acts on whatever **username** is typed, gated only by that account's current
   password. This is *required* for the forced-change case (the interception has already destroyed the session), but it
   also means the form is a general, session-less "change any account's password given its current password" surface —
   ⚠ Known deviations / Open questions. **Live-verified**: anon GET `/login/changePassword` → 200 with
   username/oldPassword/password/password2 fields; an anon `savePassword` with a valid username+current-password changed
   that account's password. <sup>h</sup>
9. **Password minimum length & breach-checking (asymmetric).** The floor is the **site** `minPasswordLength` (default
   6; site setting, min 4). The **reset** form and the **profile** change form validate through `FormValidatorPassword`
   → Laravel `Password::min(len)->uncompromised()`, so they *also* reject **known-breached** passwords — but only when
   the site's **compromised-password** toggle is on (`passwordUncompromisedEnabled`, default **off**; when off,
   `ValidationServiceProvider` swaps in a no-op verifier so `uncompromised()` always passes). The **LoginHandler change**
   form (`LoginChangePasswordForm`) uses a plain `FormValidatorLength` and therefore enforces **length only, never the
   breach check** — a gap when the toggle is enabled (⚠ Known deviations). **Live-verified**: the reset & change forms
   rejected a 2-char password ("must be at least 6 characters") and a mismatch; breach-checking off by default. <sup>i</sup>
10. **Rate-limiting & spam-blocking (off by default).** When site **login rate-limiting** is on
    (`rateLimitEnabled`, default off), repeated reset requests per IP/email are throttled and the form shows the generic
    "confirmation sent" page without sending (no reveal). The lost-password form also supports an **ALTCHA** spam
    challenge (`altcha_on_lost_password`, off by default). Neither reCAPTCHA nor the reset CSRF token is *enforced* on
    `requestResetPassword` (the handler reads the email directly; the reset/change *forms* do check CSRF). <sup>j</sup>

<sup>a</sup> `LoginHandler::requestResetPassword()` (`getByEmail`, build `PasswordResetRequested`, `Mail::send`, `message.tpl` confirmationSent) ·
<sup>b</sup> same (unknown → confirmationSent branch, no send; `getDisabled()` → `confirmationSentFailedWithReason`); live Mailpit count 0 for unknown recipient ·
<sup>c</sup> `PasswordResetUrl::setPasswordResetUrl()` (`dispatcher->url(... 'login','resetPassword',[username],['confirm'=>generatePasswordResetHash])`); `requestResetPassword()` (`->from($site->getLocalizedContactEmail(), …)`); `PasswordResetRequested` (`PASSWORD_RESET_CONFIRM`, `GROUP_OTHER`, `FROM_SYSTEM`) ·
<sup>d</sup> `Validation::generatePasswordResetHash()` (payload = username+password+dateLastLogin+expiry, `hash_hmac` w/ `security.salt`, `:expiry`), `verifyPasswordResetHash()` (expiry check + re-derive); `Config security.reset_seconds` (7200); `ResetPasswordForm::validatePasswordResetHash()`/`displayInvalidHashErrorMessage()` (`user.login.lostPassword.invalidHash`); `resetPassword()` (unknown user → redirect) ·
<sup>e</sup> `ResetPasswordForm::execute()` (`encryptCredentials`, `setMustChangePassword(0)`, `getSessionGuard()->updateUser`, `Auth::logoutOtherDevices`, `Repo::user()->edit`); `updateResetPassword()` (re-validate hash → `message.tpl` passwordUpdated) ·
<sup>f</sup> `LoginHandler::signIn()` (`getMustChangePassword()` → `Validation::logout()` + `redirect(…,'changePassword',[username])`) ·
<sup>g</sup> `LoginHandler::savePassword()` (`validate` → `execute` → `Validation::login(username,password)` → `sendHome`; else `display`); `LoginChangePasswordForm::__construct()` (the four checks) + `::execute()` (encrypt, `setMustChangePassword(0)`, `logoutOtherDevices`, edit) ·
<sup>h</sup> `LoginHandler::changePassword()` (no policy, `_isBackendPage`, `LoginChangePasswordForm`); live anon 200 + anon savePassword success ·
<sup>i</sup> `Site::getMinPasswordLength()` (schema `site.json` `min:4`; installer default 6); `FormValidatorPassword::getValidationRules()` (`Password::min()->uncompromised()`); `ValidationServiceProvider::register()` (no-op `UncompromisedVerifier` when `passwordUncompromisedEnabled` off); `LoginChangePasswordForm` (`FormValidatorLength` only) ·
<sup>j</sup> `requestResetPassword()` (`RateLimitingService::isPasswordResetLimited`, `_validateAltchasResponse('altcha_on_lost_password')`); `Config captcha.altcha`, `security.rateLimitEnabled`

## Side effects

- **Password rewritten** (`users.password`) — bcrypt hash via `Validation::encryptCredentials` (cost-12 `PASSWORD_BCRYPT`), on both the reset and the change paths.
- **`must_change_password` cleared** — every successful reset (`ResetPasswordForm::execute`) and change (`LoginChangePasswordForm::execute`) sets it to 0, releasing the forced-change lock.
- **Other sessions invalidated** — `Auth::logoutOtherDevices(newPassword)` runs on every successful reset/change, so all of the account's *other* logged-in devices are signed out (a password change kicks everyone else off).
- **Session** — the reset ends on a "password updated" message (no auto-login; the user follows the login link); the change path **auto-logs-in** the user with the new password (`savePassword → Validation::login → sendHome`); the forced-change interception first **logged the session out** (`Validation::logout`).
- **Email** — exactly one mailable: **Password Reset Confirmation** (`PASSWORD_RESET_CONFIRM`), sent by `requestResetPassword` only when a live enabled account matches the email, **from the site contact address**. No mail on the change/reset-submit paths, none for unknown/disabled emails.
- **No notification / no event-log** entry is written by these flows.

## Settings that modify behavior

- **`reset_seconds`** (`config.inc.php [security]`, default **7200** = 2 h) — how long a reset hash stays valid (Rule 4).
- **`salt`** (`config.inc.php [security]`) — the HMAC key for the reset hash; changing it invalidates all outstanding links.
- **`minPasswordLength`** (site setting, default **6**, min 4) — the length floor for every new-password field (Rule 9).
- **`passwordUncompromisedEnabled`** (site security setting, default **off**) — when on, the reset & profile-change forms reject known-breached passwords via HIBP / a local blocklist; the LoginHandler change form does **not** honour it (⚠).
- **`rateLimitEnabled`** (site setting, default off) — throttles reset requests per IP/email (Rule 10).
- **`altcha` + `altcha_on_lost_password`** (`config.inc.php [captcha]`, default off) — adds an ALTCHA challenge to the lost-password form.
- **`force_login_ssl`** — forces the login/reset pages onto HTTPS (inherited from the shared LoginHandler).

## Cross-feature interactions

- **registration-login** (feature 47) — owns login/logout/registration and the **forced-change trigger**: `signIn`'s
  `mustChangePassword` check that logs the session out and redirects here (Rule 6 there). It also renders the
  "reset your password" links to `/login/lostPassword`. This spec owns the reset/change *machinery* those links reach.
- **user-profile** (feature 49) — owns the **Profile → Password** tab, the everyday session-bound self-service change
  (`ProfileTabHandler::changePassword`/`savePassword` + `ChangePasswordForm`, `changePassword.tpl`, atom
  `GRID-profile-tab-handler`). That form is **stronger and safer** than this spec's LoginHandler change form: it acts on
  the **logged-in user** (no free-text username), applies the **breach check** (`FormValidatorPassword`), and additionally
  forbids reusing the old password (`passwordSameAsOld`). password-flows owns the *rules* (length/match/old-password) they
  share; the profile *surface* is user-profile's.
- **user-management** (feature 50) — owns a manager **creating** an account (which can set `mustChangePassword`, tripping
  the forced-change here) and an **admin resetting** a user's password. This spec owns only the **self / email** reset.
- **notifications / email-delivery** — the reset mail is a normal mailable; its template (`PASSWORD_RESET_CONFIRM`) is
  editable via email-templates-management. This spec is its only trigger.
- **roles-permissions** — the site security form (`PKPSiteSecurityForm`) hosts `minPasswordLength`,
  `passwordUncompromisedEnabled`, and `rateLimitEnabled` that tune these rules.

## Canonical scenarios

1. **Lost-password round trip** — An anonymous user opens Reset Password, enters their registered email, and receives a
   **Password Reset Confirmation** email with a reset link. They open the link, set a new password (≥ 6 chars, matching
   repeat), and are told the password was updated. The **old** password no longer logs them in, the **new** one does, and
   the used link is now dead. (Live-verified end-to-end on a throwaway user.)
2. **Invalid / expired reset link** — Opening a reset link whose hash has been tampered with, or whose 2-hour window has
   passed, shows the "could not be validated … may have expired or is not valid" error page with a link back to Reset
   Password; a link naming an unknown username redirects straight to Reset Password. No password is changed.
   (Live-verified: tampered and past-expiry hashes both hit the error page.)
3. **No account enumeration** — Requesting a reset for an email that belongs to **no** account shows the *same*
   "confirmation email has been sent" page as a real one, and sends **no** email — a caller cannot tell whether the
   address exists. (Live-verified: unknown recipient, zero mail.)
4. **Forced change on first login** — An account flagged **must change password** logs in with the correct credentials
   and is immediately bounced to the change-password screen with **no** working session; the dashboard and profile stay
   unreachable until they set a new password. After saving, they are logged in, the flag is cleared, and a later login
   proceeds normally. (Live-verified: interception redirect + locked-out session + cleared flag on re-login.)
5. **Change with the wrong current password is refused** — On the change form, entering an incorrect **current**
   password is rejected with "the current password you entered was incorrect" and nothing changes; supplying the correct
   current password plus a valid new/repeat pair succeeds, and afterwards only the new password logs in.
   (Live-verified both directions.)
6. **Password rules on the reset & change forms** — A new password shorter than the site minimum (6) is rejected ("must
   be at least 6 characters"), and a new/repeat mismatch is rejected ("passwords do not match"); in both cases the
   password is left unchanged. (Live-verified on both the reset and the change forms.)

## Known deviations (as-built ≠ intent)

- ⚠ **The forced/standalone change form skips the compromised-password (breach) check that the reset and profile-change
  forms apply** (**ledger row 110**). `ResetPasswordForm` and the profile `ChangePasswordForm` validate the new
  password with `FormValidatorPassword` (Laravel `Password::min()->uncompromised()`), so — once an admin turns on the
  site **compromised-password** setting — they reject known-breached passwords. `LoginChangePasswordForm` (the forced
  first-login screen and the standalone `/login/changePassword`) instead uses a plain `FormValidatorLength`, enforcing
  **length only**. Net effect: exactly the users an admin is *forcing* to pick a fresh password can still choose a
  known-breached one, even with breach-protection enabled. Impact **LOW** (only when the non-default setting is on; no
  data loss), but it is an internal inconsistency across the three sibling forms. Suspected intent: route
  `LoginChangePasswordForm`'s new-password check through `FormValidatorPassword` like its siblings.
- ⚠ **`/login/changePassword` + `savePassword` are anonymous and username-driven** (**ledger row 111**, LOW).
  The change screen renders (200) and operates for an **anonymous** visitor and acts on any **typed username**, gated
  only by that account's current password — there is no session check and no check that the username is the caller's own.
  This is *needed* for the forced-change case (the interception deliberately logs the session out first), so the
  anonymous reachability is plausibly by design; but it also exposes a general session-less "change any account's password
  given its current password" surface distinct from the auth-gated profile tab. It grants no capability beyond what
  knowing the current password already allows (that knowledge already permits login), hence LOW — but it is worth a
  maintainer decision (see Open questions). **Live-verified**: anon GET → 200 form; anon `savePassword` changed a target
  account's password.

## Open questions

1. **Should `LoginChangePasswordForm` honour the compromised-password setting** (row 110), or is length-only intended for
   the forced/standalone change path?
2. **Is the standalone anonymous `/login/changePassword` intended as a general self-service surface** (row 111), or should
   only the forced-change redirect reach it, with ordinary self-service confined to the auth-gated Profile → Password tab?
   One sentence settles whether to add a session/self guard to the standalone entry.
3. **Is sending the reset mail from the *site* contact address (not the journal's) intended** even for a journal-context
   request? The template is per-context but the From is always the site contact.
4. **Should `requestResetPassword` enforce CSRF?** The lost-password template emits a `{csrf}` token but the handler does
   not validate it (it only triggers an email to the account owner, so the risk is low) — confirm this is deliberate.

---

## Reference — entry points & surfaces

| Entry | Path | Atom |
|-------|------|------|
| Reset Password (forgot) form | `…/login/lostPassword` → `LoginHandler::lostPassword` → `userLostPassword.tpl` | PAGE-login-lostpassword |
| Reset request submit | `…/login/requestResetPassword` (POST email) → sends `PASSWORD_RESET_CONFIRM` | PAGE-login-requestresetpassword |
| Reset link (new-password form) | `…/login/resetPassword/<username>?confirm=<hmac>:<expiry>` → `ResetPasswordForm` | PAGE-login-resetpassword |
| Reset submit (set new password) | `…/login/updateResetPassword` (POST) → `ResetPasswordForm::execute` | PAGE-login-updateresetpassword |
| Change-password screen (forced + standalone) | `…/login/changePassword[/<username>]` → `LoginChangePasswordForm` | PAGE-login-changepassword |
| Change submit | `…/login/savePassword` (POST) → `LoginChangePasswordForm::execute` → login + home | PAGE-login-savepassword |
| Reset email | `PASSWORD_RESET_CONFIRM`, from the site contact, carries the reset link | MAIL-password-reset-requested |

## Reference — code anchors

- **Handler**: `lib/pkp/pages/login/LoginHandler.php` — `lostPassword()`, `requestResetPassword()`, `resetPassword()`,
  `updateResetPassword()`, `changePassword()`, `savePassword()` (all un-role-gated); `signIn()` carries the
  `mustChangePassword` interception (owned by registration-login).
- **Forms**: `lib/pkp/classes/user/form/ResetPasswordForm.php` (hash validation + execute),
  `lib/pkp/classes/user/form/LoginChangePasswordForm.php` (current-password + length-only checks + execute);
  contrast `…/ChangePasswordForm.php` (the profile tab's, breach-checked + `passwordSameAsOld`, owned by user-profile).
- **Templates**: `lib/pkp/templates/frontend/pages/userLostPassword.tpl`, `…/templates/user/userPasswordReset.tpl`,
  `…/templates/user/loginChangePassword.tpl`, success/error via `…/frontend/pages/message.tpl` / `error.tpl`.
- **Hash & credentials**: `lib/pkp/classes/security/Validation.php` — `generatePasswordResetHash()`,
  `verifyPasswordResetHash()`, `checkCredentials()`, `encryptCredentials()`;
  `lib/pkp/classes/mail/traits/PasswordResetUrl.php` (`setPasswordResetUrl`).
- **Mailable**: `lib/pkp/classes/mail/mailables/PasswordResetRequested.php` (`PASSWORD_RESET_CONFIRM`).
- **Password validators**: `lib/pkp/classes/form/validation/FormValidatorPassword.php`
  (`Password::min()->uncompromised()`), `…/FormValidatorLength.php`;
  `lib/pkp/classes/core/ValidationServiceProvider.php` (no-op verifier unless `passwordUncompromisedEnabled`).
- **Settings**: `config.TEMPLATE.inc.php` (`reset_seconds`, `salt`, `rateLimitEnabled`, `altcha*`);
  `lib/pkp/schemas/site.json` (`minPasswordLength`, `passwordUncompromisedEnabled`, `rateLimitEnabled`);
  `lib/pkp/classes/security/RateLimitingService.php` (`isPasswordResetLimited`).
- **Liveness note**: probed 2026-07-05 against `:8000` (`ojs_test`, PostgreSQL) using a seeded scratch journal
  (`/api/v1/_test/scenarios/journal`, tag `pwflows-probe`) with two **throwaway** users — `pwprobe_a` and `pwprobe_mc`
  (`mustChangePassword: true`) — so no seeded/shared user's password was touched. Verified live: (1) lost-password POST
  → **Password Reset Confirmation** mail from `admin@test.local` with link `…/login/resetPassword/pwprobe_a?confirm=<64-hex>%3A<ts>`;
  (2) unknown email → same confirmation page, **0** mail; (3) valid hash → form, tampered/expired hash → "expired or is
  not valid" error page, unknown username → 302 lostPassword; (4) `updateResetPassword` set a new password (new logs in,
  old rejected) and the used link then failed hash validation (single-use); (5) `mustChangePassword` login → 302
  `…/login/changePassword/<username>` with no session (profile bounced to login), and after `savePassword` the flag was
  cleared (later login reached `/index`, no re-interception); (6) `/login/changePassword` renders and `savePassword`
  operates **anonymously** — wrong current password → "current password … incorrect", short/mismatch → length / "do not
  match", valid → password changed; (7) `minPasswordLength` = **6** (form hint), breach-checking off by default. All six
  PAGE atoms and the mailable are **live** (no dead code).
