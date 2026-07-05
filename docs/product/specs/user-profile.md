---
name: user-profile
scope: A logged-in user maintains their own account — identity, contact details, public profile, self-service roles & reviewer interests, notification preferences, password, and API key — from the tabbed Profile page
shared: pkp-lib          # ProfileHandler/UserHandler + ProfileTabHandler + all the profile forms live in lib/pkp; OJS adds only the subscriptions landing page and two extra "public" notification types
status: verified         # adversarial verifier: permission + state rules re-confirmed (code + live 2026-07-05); notifications on-screen→email coupling corrected
e2e-plans: [user-profile]
atlas-claims:
  - PAGE-user-index
  - PAGE-user-profile
  - GRID-lib-pkp-tab-user-profile-tab-handler
  - SCHEMA-user
  - DB-user_settings
  - DB-user_interests
  - DB-notification_subscription_settings
  - API-interest-get-many
---

# User profile (self-service account management)

## Purpose

Once a visitor has an account (see `registration-login`), the **Profile** page is where they curate everything about
themselves: their **name**, how their name is **displayed publicly**, their **contact** details and interface
**languages**, a **public bio / homepage / photo**, which **self-registerable roles** they hold and their **reviewing
interests**, which **notifications** they receive (on-screen and by email), their **password**, and a personal **API
key** for programmatic access. It is reached from the user menu (**View Profile / Edit Profile**) at
`…/user/profile` and is available to **any logged-in user** — a reader, author, reviewer, editor or manager all see
the same page and can only edit **their own** account. Editing *other people's* accounts (disable, merge, change role
by an admin) is a different feature (`user-management`); this spec is strictly the account owner's self-service.

The page is a legacy **tabset** (`profile.tpl` → `ProfileTabHandler`): seven tabs, each an independent AJAX form.
There is **no REST endpoint** for self-editing a profile — every save posts to a `ProfileTabHandler` component
operation (the `/users` REST API is manager-only and belongs to `user-management`).

## Actors & permissions

Every profile operation is gated by exactly one rule: **you must be logged in** (`UserRequiredPolicy`), and every form
acts on **the session user** (`$request->getUser()`) — no operation takes a target-user argument, so a user can only
ever read and write **their own** profile. There is **no role check** beyond being authenticated: a plain reader has
the same seven tabs as a journal manager. "Self" below always means the logged-in account. Anonymous visitors are
bounced to login. <sup>a</sup>

| Action | Who may — and when |
|--------|--------------------|
| **Open the Profile page (all tabs)** | • Any logged-in user — on their own account; the bare `…/user` landing just redirects here<br>• Anonymous visitor — sent to login (`?source=…` returns them after)<br>• No user can open **another** user's profile — the tabs carry no user id and always load the session user <sup>a</sup> |
| **Edit Identity / Contact / Public profile / Roles** | • The logged-in user — on their own account, any time; each tab saves independently <sup>b</sup> |
| **Change email address** | • The logged-in user — but the change is **not applied immediately**: it is held pending a **confirmation link** emailed to the account's **current** address, and only takes effect when that link is accepted (see Rule 4). A pending change can be **cancelled** from the tab <sup>c</sup> |
| **Join / leave a self-registerable role** | • The logged-in user — may tick/untick **Reader / Reviewer / Author** groups (per journal) whose group permits self-registration, on the Roles tab; ticking enrols, unticking withdraws. Non-self-registerable roles (editor, manager, assistant…) are **not** shown and cannot be self-granted <sup>d</sup> |
| **Edit notification preferences** | • The logged-in user — toggles, per notification type, whether it appears on-screen and whether it is emailed <sup>e</sup> |
| **Change own password** | • The logged-in user — must supply their **current** password; the new password must differ from the old, meet the site minimum length, match its repeat, and (when enabled) pass the breach check. This is the **auth-gated** self-service change — distinct from the anonymous `/login/changePassword` owned by `password-flows` <sup>f</sup> |
| **Generate / reset own API key** | • The logged-in user — may generate a key or remove it; requires the site's **`api_key_secret`** to be configured, else the tab shows a warning and generates nothing <sup>g</sup> |
| **Edit / disable / merge *another* user** | • ⚠ Not here — a manager does that from the Users grid (`user-management`); the profile is self-only |

<sup>a</sup> `ProfileHandler::authorize()` (`PKPSiteAccessPolicy` + `UserRequiredPolicy`), `ProfileTabHandler::authorize()` (`UserRequiredPolicy`); every op reads `$request->getUser()`; `PKPUserHandler::index()` (`redirect(...,'profile')`) ·
<sup>b</sup> `ProfileTabHandler::saveIdentity()`/`saveContact()`/`savePublicProfile()`/`saveRoles()` (each: new form on the session user → `validate` → `execute`) ·
<sup>c</sup> `ContactForm::execute()` (defers email to `functionArgs['emailUpdated']`), `BaseProfileForm::execute()` (builds `ChangeProfileEmailInvite`), `ContactForm::cancelPendingEmail()` ·
<sup>d</sup> `RolesForm::execute()` → `UserFormHelper::saveRoleContent()` (per-group `permitSelfRegistration` gate; assign vs `endAssignments`) ·
<sup>e</sup> `PKPNotificationSettingsForm::execute()` (writes `blocked_notification` / `blocked_emailed_notification`) ·
<sup>f</sup> `ChangePasswordForm::__construct()` (old-password `checkCredentials`, `passwordSameAsOld`, `FormValidatorPassword`) ·
<sup>g</sup> `APIProfileForm::execute()` / `fetch()` (`Config security.api_key_secret` guard)

## Fields & validation

The seven tabs, in on-screen order (`profile.tpl`). Name, public name, signature, affiliation, biography are stored
**multilingual** (per supported site/UI locale); the rest are single-valued.

**Identity tab** (`IdentityForm`, `identityForm.tpl`):

| Field (UI label) | Required? | Rules | Anchor |
|------------------|-----------|-------|--------|
| **First Name** (`givenName`) | Yes* | Non-empty in the **site primary locale**; multilingual. | `IdentityForm::__construct()` (`FormValidatorLocale givenName required`) |
| **Last Name** (`familyName`) | No | Optional; but if given in a locale, First Name must also be present in **that** locale. Multilingual. | `__construct()` (`FormValidatorCustom`) |
| **Preferred Public Name** (`preferredPublicName`) | No | How the name is shown publicly (e.g. author byline); overrides given+family for display. Multilingual. | `initData()`/`execute()` (`setPreferredPublicName`) |
| **Preferred Avatar Initials** (`preferredAvatarInitials`) | No | Upper-cased on save; used for the initials avatar. | `execute()` (`Str::upper`) |
| **ORCID iD** (`orcid`) | No | Only shown **in a journal context with ORCID enabled**; connected/removed via the ORCID OAuth widget, not typed. `removeOrcidId=true` disconnects (clears the iD + token). | `fetch()` (`OrcidManager::isEnabled`), `execute()` (`removeOrcidId` branch) |

**Contact tab** (`ContactForm`, `contactForm.tpl`):

| Field (UI label) | Required? | Rules | Anchor |
|------------------|-----------|-------|--------|
| **Email** (`email`) | Yes* | Valid email; must **not** be used by another account (own address allowed). Changing it triggers the **confirm-by-email** flow, not an immediate write (Rule 4). Shown **read-only** while a change is pending. | `ContactForm::__construct()` (`FormValidatorEmail` + uniqueness `FormValidatorCustom`) |
| **Country** (`country`) | Yes* | From the country dropdown. | `__construct()` (`FormValidator country required`) |
| **Phone** (`phone`) | No | Free text. | `initData()` (`getPhone`) |
| **Affiliation** (`affiliation`) | No | Multilingual free text. | `execute()` (`setAffiliation`) |
| **Mailing Address** (`mailingAddress`) | No | Free text. | `execute()` (`setMailingAddress`) |
| **Signature** (`signature`) | No | Rich-text; multilingual; used in emails the user sends. | `execute()` (`setSignature`) |
| **Working languages** (`locales[]`) | No | Checkboxes of the **site's supported locales**; each value is re-validated against the supported set on save; the user's chosen UI languages. | `execute()` (filter by `isLocaleValid` ∧ supported) |

**Roles tab** (`RolesForm`, `rolesForm.tpl` → `userGroups.tpl`):

| Field (UI label) | Required? | Rules | Anchor |
|------------------|-----------|-------|--------|
| **Roles** (`reviewerGroup[]`,`authorGroup[]`,`readerGroup[]`) | No | Checkboxes, one per **self-registration-permitted** user group per open-registration journal, grouped by role. Ticked = enrol, unticked = withdraw (Rule 5). | `UserFormHelper::assignRoleContent()`/`saveRoleContent()` |
| **Reviewing interests** (`interests[]`) | No | Free-text keyword tags (tag-it widget) with an **autocomplete** off the site-wide interest vocabulary; **not** multilingual (stored with empty locale). Section hidden on OPS. | `RolesForm::execute()` (`Repo::userInterest()->setInterestsForUser`); autocomplete → `GET /vocabs/interests` |

**Public profile tab** (`PublicProfileForm`, `publicProfileForm.tpl`):

| Field (UI label) | Required? | Rules | Anchor |
|------------------|-----------|-------|--------|
| **Homepage URL** (`userUrl`) | No | If present, must be a **valid URL**. | `PublicProfileForm::__construct()` (`FormValidatorUrl optional`) |
| **Biography** (`biography`) | No | Rich-text, multilingual. | `execute()` (`setBiography`) |
| **Profile image** (`uploadedFile`) | No | Image upload, **≤ 150 × 150 px** (a larger/zero-dimension image is rejected and discarded); stored as a **public site file** `profileImage-<userId>.<ext>`. Deletable. Uploaded/deleted by dedicated ops, not the main Save. | `uploadProfileImage()` (`PROFILE_IMAGE_MAX_*`), `deleteProfileImage()` |

**Password tab** (`ChangePasswordForm`, `changePassword.tpl`) — **owned here** (contrast `password-flows`):

| Field (UI label) | Required? | Rules | Anchor |
|------------------|-----------|-------|--------|
| **Current password** (`oldPassword`) | Yes* | Must match the account's current password. | `__construct()` (`FormValidatorCustom` → `Validation::checkCredentials`) |
| **New password** (`password`) | Yes* | Required; **≥ site minimum length**; ≤32; must **differ from the current** password; when the site's compromised-password setting is on, must **not** be breached. | `__construct()` (`passwordSameAsOld` + `FormValidatorPassword`) |
| **Repeat new password** (`password2`) | Yes* | Must equal New password. | `__construct()` (`FormValidatorPassword` w/ `password2`) |

**Notifications tab** (`NotificationSettingsForm`, `notificationSettingsForm.tpl`) — two checkboxes per notification type:
an on-screen toggle (`notification<Type>`) and an email toggle (`emailNotification<Type>`) — the email toggle is
auto-disabled by the form's `enableDisablePairs` handler whenever its on-screen toggle is off (Rule 8). Types are grouped into
**Public** (New announcement; + OJS: Published issue, Open access), **Submissions** (Submission submitted, Editor
assignment required, New discussion, Discussion activity), **Reviewing** (Reviewer comment), and **Editors** (Editorial
reminder; Editorial report when the journal's stats-email setting is on). <sup>anchor: `PKPNotificationSettingsForm::getNotificationSettingCategories()`; `NotificationSettingsForm` adds the two OJS public types.</sup>

**API key tab** (`APIProfileForm`, `apiProfileForm.tpl`): a read-only **API key** display and a single **Generate /
Remove** button (`apiKeyAction`). No free input.

## Rules & state

1. **The tabset and its landing.** `…/user/profile` renders seven tabs — **Identity, Contact, Roles, Public profile,
   Password, Notifications, API key** — each loaded/saved as an independent AJAX form via `ProfileTabHandler`
   (`identity`/`saveIdentity`, `contact`/`saveContact`, `roles`/`saveRoles`, `publicProfile`/`savePublicProfile`,
   `changePassword`/`savePassword`, `notificationSettings`/`saveNotificationSettings`, `apiProfile`/`saveAPIProfile`).
   The bare `…/user` landing (`UserHandler::index`) **redirects** to `profile`. When there is no journal in the URL and
   the user belongs to exactly one journal, the page redirects into that journal's context first. **Live-verified**:
   all seven tab anchors render and each tab's form fetches. <sup>a</sup>
2. **Every tab saves the session user, and only them.** No operation accepts a user id; each instantiates its form on
   `$request->getUser()`. On a valid save the form writes the user and the handler flashes a **trivial success
   notification**; on a validation failure it re-renders the tab with inline errors. (Most save ops return the
   re-rendered form under a `true` status — the client detects errors from the form body; `saveRoles` is the one op
   that returns a `false` status on failure — a harmless internal inconsistency.) **Live-verified**: identity, contact,
   roles, public-profile and notification saves each persisted on re-fetch. <sup>b</sup>
3. **Identity edit.** First name is required in the site primary locale; last name is optional but locale-consistent
   with first name; preferred public name and avatar initials are free. Saving writes the multilingual name fields to
   the user. **Live-verified**: setting **Preferred Public Name** to a new value saved and reappeared on re-fetch.
   ORCID connect/disconnect is only offered in a journal context with ORCID enabled (absent on the stock journal). <sup>c</sup>
4. **Email change is confirmed out-of-band, not applied on Save.** Contact-tab Save writes country, phone, affiliation,
   mailing address, signature and locales **immediately** — but if the **email** differs from the stored one it is
   **not** written to the user. Instead a **`ChangeProfileEmailInvite`** is created carrying the new address, and a
   **"Confirm account contact email change request"** email is sent — to the account's **current** address — with
   accept/decline links; the email only becomes the account's when that link is **accepted** (`finalize()` →
   `setEmail(newEmail)`). Until then the Contact tab shows the email **read-only** with a "pending change to X" notice
   and a **Cancel** action that declines the pending invite. The email-change *invitation machinery + mailable* are
   owned by `user-invitations`; this tab is only the trigger. **Live-verified**: changing the email produced the
   pending state and delivered the confirmation mail to the **old** address; the stored email did not change. <sup>d</sup>
5. **Self-service roles: join or leave any self-registerable group.** The Roles tab lists **Reader / Reviewer / Author**
   groups (across every journal whose registration is open) whose user group has **permit self-registration** on.
   Ticking a box the user is not in **enrols** them (`assignUserToGroup`); unticking a box they are in **withdraws**
   them (`endAssignments`). Groups without `permitSelfRegistration` (editor, manager, assistant, etc.) never appear, so
   privileged roles cannot be self-granted. Note this is **broader than registration**: the register form offers only
   Reader-or-Reviewer and never Author, but the profile Roles tab **does** expose the self-registerable **Author** group
   — so a user can add the Author role to themselves here (resolving `registration-login`'s author-self-registration
   open question: the plumbing is reachable, just from the profile, not the register form). **Live-verified**: the tab
   renders reader/reviewer/author group checkboxes. <sup>e</sup>
6. **Reviewer interests.** The Roles tab stores free-text **reviewing interests** as the user's interest keywords, with
   type-ahead suggestions from the **site-wide interest vocabulary** (`GET /vocabs/interests`, a public unauthenticated
   endpoint). Interests are site-wide and non-multilingual. These are the same interests a reviewer is matched on in the
   editorial workflow (owned by the reviewer features) and the ones the register form seeds. **Live-verified**: adding
   interest tags persisted on re-fetch; the autocomplete endpoint is wired in `interestsInput.tpl`. <sup>f</sup>
7. **Public profile + image.** Homepage URL (validated when non-empty) and a multilingual biography save to the user.
   The **profile image** is handled by separate upload/delete ops: an upload is accepted only if it is a real image
   **≤ 150×150 px** (otherwise rejected and any prior record cleared), and is stored as a **public site file**
   keyed to the user id; delete removes the file and clears the record. **Live-verified**: biography + homepage URL
   saved and persisted; an **invalid URL was rejected** (not saved, error re-rendered). <sup>g</sup>
8. **Notification preferences.** For each notification type the user controls two switches — show it **on-screen** and
   send it **by email** — but they are **not fully independent in the UI**: the form handler (`enableDisablePairs`)
   **disables the email box whenever its on-screen box is unticked**, so "blocked on-screen yet still emailed" is
   **unreachable from the tab**. (The backend derives the two sets independently and would accept that combination from
   an off-UI POST — this is a UI-only guard whose disabled box matches its own affordance, so a plain rule, not a ⚠.)
   Saving rewrites the user's **blocked-notification** and **blocked-emailed-notification** subscription sets (an
   unchecked on-screen box blocks that type; a checked email box opts into emails). The **Public** category
   (announcements; + OJS published-issue and open-access) is the same set the register form's *email-consent* checkbox
   pre-blocks. **Live-verified**: an email opt-in (on-screen kept) and an on-screen block both persisted on re-fetch. <sup>h</sup>
9. **Password change (the auth-gated self-service change).** The Password tab requires the **current** password, a new
   password that is **different from the current one**, meets the **site minimum length**, matches its repeat, and —
   when the site compromised-password setting is on — is **not breached** (via `FormValidatorPassword`). On success it
   encrypts and stores the new password, **updates the current session**, and **logs the account out of all other
   devices**. Because the whole form runs on the **already-authenticated** session user (no free-text username), it is
   safer than the anonymous `/login/changePassword`: it additionally forbids **reusing the old password** and applies
   the **breach check**. **Live-verified**: a wrong current password → "current password … incorrect"; a new password
   equal to the old → rejected; a valid change succeeded and the **new** password then logged in. <sup>i</sup>
10. **API key generate / reset.** The API-key tab shows the user's key and one button that **generates** a fresh key
    (32 random bytes, `apiKeyEnabled=1`) or **removes** it (`apiKeyEnabled` and key cleared). The displayed value is the
    stored key **JWT-encoded** with the site's `api_key_secret`; that is the token pasted into `Authorization`/
    `?apiToken=` for REST calls. If **`api_key_secret` is not configured**, the tab shows a warning notification and
    generates nothing (the key would be unusable). **Live-verified**: with the secret set, Generate produced a
    JWT-encoded key on re-fetch. <sup>j</sup>

<sup>a</sup> `profile.tpl` (seven `ProfileTabHandler` tab links); `ProfileHandler::profile()` (single-context redirect, anchor redirect); `PKPUserHandler::index()` (→ profile); live: 7 anchors + tab fetches ·
<sup>b</sup> `ProfileTabHandler::save*()` (`createTrivialNotification` on success; `JSONMessage(true, fetch)` on failure, except `saveRoles` → `JSONMessage(false, …)`) ·
<sup>c</sup> `IdentityForm::__construct()`/`execute()`; `fetch()` ORCID branch (`OrcidManager::isEnabled`); live preferredPublicName persisted ·
<sup>d</sup> `ContactForm::execute()` (email → `emailUpdated`, other fields written), `BaseProfileForm::execute()` (`ChangeProfileEmailInvite->invite()`, `invalidateOtherSessions`), `ContactForm::cancelPendingEmail()`; `ChangeProfileEmailInvite::getMailable()` (recipient = current user) / `finalize()` (`setEmail`); `contactForm.tpl` (`readonly=$changeEmailPending`); live pending + mail to old address, stored email unchanged ·
<sup>e</sup> `UserFormHelper::saveRoleContent()` (`permitSelfRegistration`; `assignUserToGroup` vs `endAssignments`), `assignRoleContent()` (reader/reviewer/author groups of open-registration contexts); live reader/reviewer/author checkboxes ·
<sup>f</sup> `RolesForm::execute()` (`Repo::userInterest()->setInterestsForUser`); `PKPInterestController::getMany()` (`PublicAccessPolicy`, no auth); `interestsInput.tpl` (`endpoint='vocabs/interests'`); live interests persisted ·
<sup>g</sup> `PublicProfileForm::execute()` (`setUrl`,`setBiography`), `uploadProfileImage()`/`deleteProfileImage()` (`PublicFileManager`, `PROFILE_IMAGE_MAX_WIDTH/HEIGHT`, `profileImage-<id>`); live bio/url persisted, invalid URL rejected ·
<sup>h</sup> `PKPNotificationSettingsForm::execute()` (`updateNotificationSubscriptionSettings` BLOCKED_NOTIFICATION / BLOCKED_EMAIL_NOTIFICATION), `getNotificationSettingCategories()`; live save `status:true` ·
<sup>i</sup> `ChangePasswordForm::__construct()` (`checkCredentials`, `passwordSameAsOld`, `FormValidatorPassword`) + `execute()` (`encryptCredentials`, `updateUser`, `Auth::logoutOtherDevices`, `Repo::user()->edit`); live wrong-old / same-as-old rejected, valid change → new password logs in ·
<sup>j</sup> `APIProfileForm::execute()` (`bin2hex(random_bytes(32))`, `apiKeyEnabled`), `fetch()` (`JWT::encode(apiKey, api_key_secret)`; `handleOnMissingAPISecret`); live JWT key generated

## Side effects

- **`users` row + `user_settings`** — the account's core columns (email, url, phone, country, mailing address, locales,
  password, api key) and its multilingual/extra settings (given/family/preferred name, affiliation, biography,
  signature, avatar initials, `apiKey`, `apiKeyEnabled`, `profileImage`, ORCID) are rewritten by the relevant tab's
  `Repo::user()->edit()`. **Email is the exception** — it is *not* written on Save; it changes only when the
  confirmation invite is accepted.
- **`user_interests`** (controlled-vocab) — rewritten wholesale on a Roles save to the submitted interest set.
- **`user_user_groups`** — a Roles save enrols into / ends assignments in self-registerable groups (Rule 5).
- **`notification_subscription_settings`** — a Notifications save rewrites the user's `blocked_notification` and
  `blocked_emailed_notification` rows (keyed by user + context). (This is the **prefs** table — distinct from
  `notification_settings`, which holds per-notification-object metadata on the delivery side and is **not** touched
  here.)
- **Profile image file** — an uploaded avatar is written to the **public site files** directory as
  `profileImage-<userId>.<ext>`; delete removes it.
- **Sessions** — a **password** change logs the account out of **other** devices (keeps the current session); an
  **email** change invalidates the account's **other** sessions and refreshes the current one.
- **Email** — the only mail this feature triggers is the **email-change confirmation**
  (`ChangeProfileEmailInvite` → "Confirm account contact email change request"), sent to the current address; owned by
  `user-invitations`. No other tab sends mail.
- **Notifications** — every successful save creates an in-app **trivial success** notification for the user; a missing
  `api_key_secret` creates a **warning** notification on the API-key tab.
- **No event-log** entries are written by profile edits.

## Settings that modify behavior

- **`api_key_secret`** (`config.inc.php [security]`) — must be set for the API-key tab to generate a usable key;
  unset → warning, no key (Rule 10). The test install sets it.
- **`minPasswordLength`** (site setting, default 6, min 4) — floor for the Password tab's new password (Rule 9).
- **`passwordUncompromisedEnabled`** (site security setting, default off) — when on, the Password tab rejects
  known-breached passwords (Rule 9). Unlike the `password-flows` `/login/changePassword` form, the profile Password tab
  **does** honour this.
- **ORCID enabled** (per journal) — shows the ORCID connect/disconnect widget on the Identity tab (Rule 3).
- **`disableUserReg`** (per journal) — a journal with registration disabled contributes **no** self-registerable role
  checkboxes to the Roles tab (Rule 5).
- **`editorialStatsEmail`** (per journal) — adds the **Editorial report** row to the Notifications tab.
- **Application = OPS** — hides the reviewing-interests section (Rule 6); not applicable to OJS but present in the
  shared form.

## Cross-feature interactions

- **registration-login** (feature 47) — creates the account and seeds the initial identity/affiliation/interests/role;
  this spec owns every *subsequent* self-edit. Both touch the User entity: `registration-login` claims the `users`
  **table** (`DB-users`, creation point), this spec claims the User **field schema** (`SCHEMA-user`) as the place its
  editable fields live. Resolves that spec's author-self-registration open question (Rule 5).
- **password-flows** (feature 48) — owns the **anonymous** `/login/changePassword` + `savePassword` and the whole
  lost-password reset. **The seam:** the everyday **auth-gated** change from *Profile → Password* is **this** feature
  (`ProfileTabHandler::savePassword` + `ChangePasswordForm`), and it is the **stronger** of the two sibling forms
  (session-bound, forbids reusing the old password, applies the breach check). `password-flows` owns the shared
  length/match/old-password *rules*; the profile surface is ours.
- **user-management** (feature 50) — owns a **manager** editing / disabling / merging / role-ending **other** users
  (the `/users` REST API and Users grid). This spec is self-only; it claims no `API-user-*` atom (those endpoints are
  manager/editor-gated).
- **user-invitations** — owns the **invitation framework** the email-change confirmation rides on
  (`ChangeProfileEmailInvite`, the accept/decline handler, the confirmation mailable). This tab only initiates it.
- **notifications** — owns the notification *types* and their delivery (and the `notification_settings` object-metadata
  table); this spec owns the user's **preferences** over them (`DB-notification_subscription_settings` — the
  blocked/emailed opt-out rows the Notifications tab writes and delivery reads).
- **controlled-vocabularies / reviewer features** — own the interest vocabulary as a shared primitive and its use in
  reviewer matching; this spec owns the profile **reviewing-interests field** and its autocomplete endpoint claim.
- **ORCID** (`docs/e2e/plans/orcid.md`) — owns the OAuth integration; the Identity tab is where a user connects/
  disconnects their iD.
- **subscriptions** — `UserHandler` (OJS) also serves the reader **subscriptions** page (`…/user/subscriptions`); that
  is a subscription feature, not part of the profile tabset.

## Canonical scenarios

1. **Edit identity** — A logged-in user opens Profile → Identity, changes their **Preferred Public Name** (and avatar
   initials), and saves; the new public name persists and a success notice appears. First name is required in the
   primary locale. (Live-verified: preferredPublicName saved and re-read.)
2. **Edit contact details** — On the Contact tab the user updates **affiliation, country, phone, mailing address,
   signature** and their **working languages**, and saves; all persist immediately. (Live-verified.)
3. **Change email (confirmed out-of-band)** — The user edits their **email** and saves; instead of changing at once, the
   address is held **pending**, the email field goes read-only with a "pending change" notice, and a **"Confirm account
   contact email change request"** email is sent to their **current** address. Only after they accept the link does the
   account's email change; a **Cancel** discards the pending change. (Live-verified: pending state + confirmation mail
   to the old address, stored email unchanged.)
4. **Public profile & photo** — The user writes a **biography**, sets a **homepage URL**, and uploads a **profile
   image** (≤150×150). Biography and URL persist; an **invalid URL is rejected**; an oversize image is refused.
   (Live-verified: bio + URL persisted, invalid URL rejected.)
5. **Reviewer interests & self-service roles** — On the Roles tab the user adds **reviewing-interest** tags (with
   autocomplete) and ticks a self-registerable role such as **Reviewer** (or **Author**) to enrol, or unticks one to
   withdraw. Interests and role enrolments persist; privileged roles are never offered. (Live-verified: interests saved;
   reader/reviewer/author checkboxes present.)
6. **Notification preferences** — On the Notifications tab the user turns a notification type's **on-screen** and/or
   **email** delivery off or on and saves; the blocked/emailed subscription sets are rewritten accordingly. The email
   box is auto-disabled while its on-screen box is off, so a type can't be blocked on-screen yet still emailed.
   (Live-verified: an email opt-in and an on-screen block both persisted.)
7. **Change password (auth-gated)** — On the Password tab the user supplies their **current** password plus a new one;
   a wrong current password, a new password equal to the old, a too-short new password, or a mismatched repeat each
   re-renders with the right error and changes nothing; a valid change succeeds, logs other devices out, and the **new**
   password then logs in. (Live-verified both directions.)
8. **Generate / reset an API key** — On the API-key tab the user **generates** a key and the JWT-encoded token appears
   for use with the REST API; pressing the button again **removes** it. With `api_key_secret` unset the tab warns and
   generates nothing. (Live-verified: JWT key generated with the secret configured.)

## Known deviations (as-built ≠ intent)

- No behaviour rose to a ⚠ during authoring or verification: the profile tabs are internally consistent and lose no
  data. Three minor as-built notes are recorded as Observations/Open questions rather than deviations — (1) the
  `saveRoles`-vs-others status inconsistency (Rule 2, cosmetic); (2) the email-change confirmation going to the
  **current** rather than the **new** address (Rule 4, plausibly an intentional "authorise from the trusted address"
  design; see Open questions); and (3) the Notifications tab's on-screen→email **coupling** (`enableDisablePairs`) that
  makes "blocked on-screen yet emailed" unreachable from the UI (Rule 8) — a sensible UX guard whose disabled email box
  matches its own affordance, and which the *backend* would still accept off-UI, so a plain rule, not a deviation.

## Open questions

1. **Email-change confirmation target.** The confirmation link is sent to the account's **current** address, so the
   change is *authorised* by the existing owner but the **new** address is never verified for reachability — a typo that
   still parses as an email would, on accept, set an address the user can't receive at. Is confirm-from-current the
   intended design, or should the link (also) go to the new address to prove it works?
2. **Author role via the profile but not registration.** The Roles tab exposes the self-registerable **Author** group
   while the register form does not (Rule 5). Is post-registration author self-enrolment intended, or should the two
   surfaces agree?
3. **SCHEMA-user ownership.** This spec claims `SCHEMA-user` as the home of the user's *editable* field schema, with
   `registration-login` owning the `users` table (creation) and a future `user-management` owning admin-lifecycle fields
   (disabled, merge, gossip). Confirm this split, or move the schema atom to `user-management`.

---

## Reference — entry points & surfaces

| Entry | Path | Atom |
|-------|------|------|
| Profile page (tabset) | `…/user/profile` → `ProfileHandler::profile` → `profile.tpl` | PAGE-user-profile |
| User landing (redirect) | `…/user` → `UserHandler::index` → redirect to profile | PAGE-user-index |
| Tab load / save ops | `…/$$$call$$$/tab/user/profile-tab/<op>` → `ProfileTabHandler` (identity, contact, roles, public-profile, change-password, notification-settings, api-profile + their `save-*`, plus `upload-profile-image` / `delete-profile-image`) | GRID-lib-pkp-tab-user-profile-tab-handler |
| Interest autocomplete | `GET api/v1/vocabs/interests?term=…` → `PKPInterestController::getMany` (public) | API-interest-get-many |
| User entity schema | `lib/pkp/schemas/user.json` (editable identity/contact/public/api-key/locale props) | SCHEMA-user |
| User settings / interests / notification prefs | `user_settings`, `user_interests`, `notification_subscription_settings` | DB-user_settings, DB-user_interests, DB-notification_subscription_settings |

## Reference — code anchors

- **Page handlers**: `lib/pkp/pages/user/ProfileHandler.php` (`profile()` — tabset + single-context/anchor redirects,
  `PKPSiteAccessPolicy` + `UserRequiredPolicy`); `lib/pkp/pages/user/PKPUserHandler.php` (`index()` → profile);
  `pages/user/UserHandler.php` (OJS — adds the subscriptions page, unrelated to the tabset).
- **Tab handler**: `lib/pkp/controllers/tab/user/ProfileTabHandler.php` — one `X()`/`saveX()` pair per tab, plus
  `uploadProfileImage()` / `deleteProfileImage()`; all gated by `UserRequiredPolicy`, all on `$request->getUser()`.
- **Forms**: `lib/pkp/classes/user/form/BaseProfileForm.php` (common `execute` → `Repo::user()->edit` + the
  `emailUpdated` invite), `IdentityForm.php`, `ContactForm.php`, `RolesForm.php` (+ `UserFormHelper.php` role save),
  `PublicProfileForm.php`, `ChangePasswordForm.php` (the auth-gated change), `APIProfileForm.php`;
  `classes/notification/form/NotificationSettingsForm.php` + `lib/pkp/classes/notification/form/PKPNotificationSettingsForm.php`.
- **Templates**: `lib/pkp/templates/user/profile.tpl` (tabset), `identityForm.tpl`, `contactForm.tpl`, `rolesForm.tpl`
  (+ `userGroups.tpl`, `form/interestsInput.tpl`), `publicProfileForm.tpl`, `changePassword.tpl`,
  `notificationSettingsForm.tpl`, `apiProfileForm.tpl`.
- **Interests / email-change**: `lib/pkp/api/v1/vocabs/PKPInterestController.php` (public `/vocabs/interests`);
  `lib/pkp/classes/invitation/invitations/changeProfileEmail/ChangeProfileEmailInvite.php` (+ payload + redirect
  controller) and `ChangeProfileEmailInvitationNotify` mailable (owned by `user-invitations`).
- **Schema / storage**: `lib/pkp/schemas/user.json`; `lib/pkp/classes/migration/install/CommonMigration.php`
  (`users`, `user_settings`, `notification_subscription_settings`); `.../ControlledVocabMigration.php` (`user_interests`);
  prefs written via `NotificationSubscriptionSettingsDAO` (`blocked_notification` / `blocked_emailed_notification`).
- **Liveness note**: probed 2026-07-05 against the running `:8000` server (DB `ojs_test`, PostgreSQL). Because
  `publicknowledge`'s seeded users are read-only, a **throwaway** account (`profprobe1`) was self-registered via the
  public register form (auto-logged-in, `require_validation` off) and all writes were driven on it — no seeded user was
  touched. Verified live: (1) `/user/profile` renders all **seven** tab anchors — identity, contact, roles,
  publicProfile, changePassword, notificationSettings, apiSettings — and each tab's form fetches with its expected
  fields; (2) **identity** save set a new preferredPublicName that persisted; (3) **contact** email change entered the
  **pending** state and delivered a "Confirm account contact email change request" mail to the **current** address, the
  stored email unchanged; (4) **roles** interest tags persisted and reader/reviewer/author self-registration checkboxes
  render; (5) **public-profile** biography + homepage URL persisted, an invalid URL was rejected; (6) **notification
  settings** save returned success; (7) **Password** tab: wrong current password and new-equals-old were rejected, a
  valid change succeeded and the **new** password then logged in (distinct from `password-flows`' `/login/changePassword`);
  (8) **API key** generate produced a JWT-encoded key (`api_key_secret` is set in the test config). The self-service
  path is entirely `ProfileTabHandler` component forms — there is **no** self-service `/users` REST endpoint (the
  `/users` API is manager/editor-gated). One residual footprint: the throwaway `profprobe1` reader account remains in
  `publicknowledge`.
- **Verifier re-confirmed 2026-07-05** (`:8000`/`ojs_test`). Every permission + state rule re-checked against code —
  `ProfileTabHandler::authorize()` adds **`UserRequiredPolicy` only** and every op instantiates its form on
  `$request->getUser()` (no target-user arg → strictly self); `ChangePasswordForm` is session-bound
  (`Validation::checkCredentials($user->getUsername(), …)`, `passwordSameAsOld` vs the entered old password,
  `FormValidatorPassword`→`Password::min()->uncompromised()`); `ContactForm::execute()` defers the email
  (`functionArgs['emailUpdated']`, never `setEmail`) and `BaseProfileForm::execute()` builds the
  `ChangeProfileEmailInvite` whose `getMailableReceiver()` resolves to the user's **current** `getEmail()` (finalize →
  `setEmail(newEmail)`); `UserFormHelper::saveRoleContent()` assigns/`endAssignments` only groups with
  `permitSelfRegistration` in open-registration contexts (reviewer/author/reader); `PKPNotificationSettingsForm::execute()`
  writes `notification_subscription_settings` (`BLOCKED_NOTIFICATION`/`BLOCKED_EMAIL_NOTIFICATION`), and its template
  couples the email box to the on-screen box via `enableDisablePairs` (Rule 8 correction). The retained
  `user-profile.spec.js` (**7 tests**) was **re-run green live** — all seven tabs driven end-to-end: identity persisted;
  contact non-email fields persisted while the **email change deferred** with the confirmation mail delivered to the
  **old** address (Mailpit) and the stored email unchanged; public-profile bio/URL persisted, an invalid URL rejected,
  a ≤150×150 image uploaded; the **Author** role self-granted here and confirmed through the users REST API
  (`user_user_groups`); a notification email-opt-in and an on-screen block both persisted; a wrong current password and
  a new==old password were both rejected inline and a valid change then logged in with the **new** password; the API-key
  Generate produced a JWT token that Delete cleared. No app-code changed.
