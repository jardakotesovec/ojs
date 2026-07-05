---
name: site-access-restrictions
scope: A journal manager decides who can see the journal at all — login-walling the whole site, closing self-registration, login-gating full-text galleys — plus what a disabled journal shows the public and the install-level HTTPS / allowed-hosts request gates
shared: pkp-lib          # PKPUserAccessForm + all four policies live in lib/pkp; OJS adds the restrictArticleAccess field (UserAccessForm) and the galley gates in ArticleHandler/IssueHandler
status: verified
e2e-plans: [site-access-restrictions]
atlas-claims:
  - FORM-pkp-user-access-form
  - FORM-user-access-form
  - PAGE-management-access
  - AUTHZ-restricted-site-access-policy
  - AUTHZ-pkp-site-access-policy
  - AUTHZ-https-policy
  - AUTHZ-allowed-hosts-policy
---

# Site access restrictions (login wall, closed registration, gated full text, disabled journals)

## Purpose

A journal doesn't have to be public. On **Settings → Users & Roles → Site Access Options** a **journal manager** flips
three journal-level switches: **Site Access** ("users must be registered and log in to view the journal site" — a
login wall over the entire reader site), **View Article Content** ("users must be registered and log in to view open
access content" — abstracts stay public, full-text galleys require an account), and **User Registration** (visitors
can self-register, or only staff create accounts). This spec owns those three toggles and their enforcement, plus two
adjacent visibility rules: what a **disabled journal** shows (anonymous visitors are turned away; the journal vanishes
from the site's journal list) and the install-level request gates every page shares (**force HTTPS**, **allowed
hosts**). It does *not* own the publishing-mode/subscription paywall (`distribution-settings` / `subscription-access`)
or the admin controls that enable/disable a journal (`site-administration`).

## Actors & permissions

**Recurring terms.** "**Any logged-in account**" means literally any authenticated user of the installation —
including one with **no roles at all** in the journal concerned; every wall in this feature tests *login*, never role.
A **manager** is a journal manager whose group has settings access (the `roles-permissions` baseline); a **site
admin** passes every management gate. **Exempt pages** are the handful of journal pages that stay reachable through
the login wall (Rule 4).

| Action | Who may — and when |
|--------|--------------------|
| **Open the Site Access Options tab** (see the three toggles) | • Manager (settings access), site admin — Settings → Users & Roles, "Site Access Options" tab<br>• Every other role — refused (bounced to "authorization denied"); anonymous — sent to login<br>• Site admin only — an extra direct URL (`management/access`) renders the same page; no menu links to it <sup>a</sup> |
| **Save the toggles** | • Manager (this journal), site admin — the form saves through the journal-settings API<br>• Everyone else — refused (probed: a reviewer's save attempt is rejected, nothing changes) <sup>b</sup> |
| **Visit a login-walled journal** (Site Access on) | • Any logged-in account — the whole reader site, regardless of roles<br>• Anonymous — only the exempt pages (login, lost password, register…); everything else bounces to the journal's login with a return-to <sup>c</sup> |
| **Self-register on a registration-closed journal** | • No one — the register page shows "not accepting user registrations" (no form) and the Register link leaves the navbar <sup>d</sup> |
| **Read full text under View Article Content** (open-access journal) | • Any logged-in account — galleys open normally<br>• Anonymous — abstract and issue TOC only; a galley view/download bounces to login with a return-to<br>• Editorial users/authors who may preview, and institution-subscribed visitors — pass without login (the standing galley-gate bypasses) <sup>e</sup> |
| **See a disabled journal** | • Any logged-in account — the full reader site (no role needed) ⚠ see Open questions<br>• Site admin / its manager — additionally the backend<br>• Anonymous — every page (register included) redirects to the journal's login; the journal is missing from the site's journal list for everyone <sup>f</sup> |

<sup>a</sup> `SettingsHandler::__construct()` (`ROLE_ID_SITE_ADMIN` → `['access','settings']`, `ROLE_ID_MANAGER` → `['settings']` only); `ManagementHandler::authorize()` (`CanAccessSettingsPolicy` on the `settings` op); `ManagementHandler::access()`; live 2026-07-05: dbarnes `settings/access` → 200 (3 fields), dbarnes direct `management/access` → authorizationDenied redirect, admin → 200; reviewer/author → denied ·
<sup>b</sup> `PKPContextController::getGroupRoutes()` (`roleAuthorizer([SITE_ADMIN, MANAGER])` on `PUT contexts/{id}`) + `edit()`; live: manager PUT → 200 saved; reviewer PUT → refused, setting unchanged ·
<sup>c</sup> `RestrictedSiteAccessPolicy::effect()` (`isLoggedIn() || exempt page`); `Validation::redirectLogin()` (`source` = requested URI); live probe matrix below ·
<sup>d</sup> `RegistrationHandler::validate()` (`disableUserReg` → `registrationDisabled` error page); `PKPNavigationMenuService::getDisplayStatus()` (`NMI_TYPE_USER_REGISTER` hidden when `disableUserReg`); live ·
<sup>e</sup> `ArticleHandler::userCanViewGalley()` (`restrictArticleAccess` branch fires only `isset($galleyId)`; `canPreview` + `subscribedDomain` bypass first); `IssueHandler::userCanViewGalley()` (same for issue galleys); live ·
<sup>f</sup> `PKPPageRouter::route()` (disabled context + no user → redirect `login`); `IndexHandler::index()` (`JournalDAO::getAll(true)` — enabled only); live: jjanssen (no role in the journal) browsed a disabled journal freely

## Fields & validation

**Site Access Options form** (`userAccess`, on the Users & Roles page) — one form, three settings, all optional; a
fresh journal has none of them set, which means: fully public site, open registration, public full text.
OJS inserts the middle field between the two shared ones.

| Field (UI label) | Required? | Rules | Anchor |
|------------------|-----------|-------|--------|
| **Site Access** — checkbox "Users must be registered and log in to view the journal site." | No (off by default) | Boolean. On = the whole reader site is login-walled (Rules 3–7). | `PKPUserAccessForm::__construct()` (`restrictSiteAccess`) |
| **View Article Content** — checkbox "Users must be registered and log in to view open access content." | No (off by default) | Boolean. OJS-only field. On = full-text galleys require login; abstracts/TOCs stay public (Rule 9). Independent of publishing mode — it bites on open-access journals (its very label). | `UserAccessForm::__construct()` (`restrictArticleAccess`, positioned after `restrictSiteAccess`) |
| **User Registration** — radio "Visitors can register a user account with the journal." / "The Journal Manager will register all user accounts. Editors or Section Editors may register user accounts for reviewers." | No (defaults to *visitors can register*) | Boolean (second option = closed). Closed = the register page refuses and the Register nav link disappears (Rule 8). | `PKPUserAccessForm::__construct()` (`disableUserReg`); `context.json` (`disableUserReg` nullable) |

## Rules & state

### The form

1. **Where the toggles live.** Settings → **Users & Roles** carries a "**Site Access Options**" tab (alongside Users /
   Roles / Notify / ORCID) rendering the `userAccess` form; saving PUTs the journal-settings API like every other
   settings form. The page shell is `roles-permissions`' atom; the tab's form and toggle semantics are owned here. All
   three settings are per-**journal** (context settings) — there is no site-level equivalent; the policy reads the
   journal of the current request (Rule 5). **Live-verified**: manager saw exactly the three fields (labels "Site
   Access", "View Article Content", "User Registration"). <sup>a</sup>
2. **Who can change them.** The page is reachable by a settings-access manager or site admin (everyone else is bounced
   to "authorization denied"), and the save endpoint accepts only manager/site-admin for that journal. **Live-verified**
   both ways: manager PUT saved each toggle and the response echoed the new value; a reviewer's PUT was refused and the
   setting stayed put. A site-admin-only *direct* URL (`…/management/access`) renders the same page; nothing in the UI
   links it (the nav always uses `settings/access`) — an alias kept for the admin role assignment, not a separate
   surface. <sup>b</sup>

### The login wall (Site Access)

3. **Everything bounces to login.** With Site Access on, **every** page request on that journal is checked before the
   handler runs: a logged-in user of any kind passes; an anonymous visitor is redirected to the journal's **login**
   page with a return-to, so after signing in they land where they were headed. **Live-verified** (scratch journal):
   home, about, search, issue TOC, article landing, information pages, announcements — all `302 → /login?source=<the
   page>`; after login (a user with *no* roles in the journal) the same pages rendered. The wall also covers the
   journal's **machine endpoints** — OAI-PMH, the sitemap and the LOCKSS/CLOCKSS **gateway** all redirect to login
   too, so a restricted journal is not harvestable. The REST API adds the same policy to its routes as well, but its
   endpoints already require authentication (anonymous callers get the same refusal walled or not), so the wall makes
   no *observable* difference there — the harvestability change is entirely in the OAI/sitemap/gateway page routes.
   <sup>c</sup>
4. **The exempt pages.** The wall white-lists whole page groups: **user** (register, profile ops), **login** (sign
   in/out, lost password), **help**, **header**/**sidebar** (legacy component fetches), **payment** (payment-return
   callbacks), **invitation** (accept/decline links keep working for invitees), and plugins can extend the list via
   hook; the ORCID OAuth pages opt out of the wall on their own. **Live-verified**: `/login`, `/login/lostPassword`
   and `/user/register` (full form) all 200 on the walled journal. (`/help` 404s — OJS 3.6 has no help page; the
   exemption is vestigial.) <sup>d</sup>
5. **Per-journal, not site-wide.** The policy applies only when the *requested journal* has the setting; the site-level
   pages and every other journal on the installation are untouched. **Live-verified**: `publicknowledge` stayed public
   throughout the probes. <sup>e</sup>
6. **An open register page pierces the wall.** Because `user/register` is exempt and any logged-in account passes the
   wall, a stranger can self-register on a login-walled journal and immediately read everything. Site Access controls
   *anonymous* visibility, not *membership* — a journal that wants to be genuinely private must **also** set User
   Registration to closed (the two toggles sit on the same form). As-built and consistent with the labels; stated here
   so QA doesn't read the wall as an invitation-only gate. <sup>f</sup>
7. **Caching and indexing follow the wall.** For a restricted journal the public HTTP page-cacheability that search,
   about and information pages normally declare is suppressed, and the DRIVER OAI plugin excludes journals with either
   restriction from its exposed set. <sup>g</sup>

### Closed registration (User Registration)

8. **The register page refuses; the link disappears.** With registration closed, `/user/register` renders "**This
   journal is currently not accepting user registrations.**" with a Login link and no form, and the front-end
   **Register** navigation item is hidden (its display rule checks the toggle). On the **site-wide** register page the
   closed journal's role opt-ins (reader/reviewer checkboxes) are dropped — though the journal's *name* still appears
   in the journal list there with nothing under it (cosmetic; noted in Known deviations). The site-wide register page
   itself closes only when *every* journal is closed — that rule is `registration-login`'s (its Rule 1); re-opening
   registration restores form, link and opt-ins. **Live-verified** end to end on a scratch journal. <sup>h</sup>

### Gated full text (View Article Content)

9. **Login-only galleys — even on an open-access journal.** With View Article Content on, the reader-facing gate fires
   only when a **galley** is addressed: the article landing page (abstract) and issue TOC stay public, while a galley
   view or download bounces an anonymous visitor to login with a return-to; any logged-in account then passes. The
   same rule guards **issue galleys**. It applies regardless of publishing mode — on an **open-access** journal it is
   the *only* thing between an anonymous reader and the PDF (**live-verified**: abstract 200 / galley view + download
   302→login / logged-in 200). Standing bypasses of the shared galley gate apply before it: editorial users and
   authors who may preview the submission, and institution-(IP/domain-)subscribed visitors. On a **subscription**
   journal the toggle is merely the login-first precursor inside the same gate — the subscription / paywall decision
   that follows belongs to `subscription-access`, and the publishing mode itself to `distribution-settings`.
   <sup>i</sup>

### Disabled journals

10. **Anonymous visitors are turned away; any account gets in.** A journal whose *enabled* flag is off (an admin
    control owned by `site-administration`) turns the public away at the **router**, before any page logic: every
    request from a visitor with no session — register included, there are no exemptions — redirects to the journal's
    login page (no return-to). **Any logged-in account** — including one with zero roles in that journal — browses the
    full reader site as if nothing happened (the code frames disabled as "not *publicly* enabled"; whether
    any-account visibility is intended is an Open question). The **site index journal list omits** disabled journals
    for everyone (admins included — they use the admin area's hosted-journals list instead). **Live-verified**: anon
    home/article/register 302→login, login page 200; `jjanssen` (no role there) got home + article 200; site index
    listed `publicknowledge` but not the disabled scratch journal; ⚠ the *API* also let the journal's **manager** flip
    the admin-only enabled flag — see Known deviations (row 118). <sup>j</sup>

### Install-level request gates (config, all journals)

11. **Force HTTPS.** With `force_ssl` on (`config.inc.php [security]`), every page and API handler demands HTTPS and
    answers an HTTP request by redirecting to the same URL on `https://`. Code-verified only (the test env is
    HTTP-only); config-level, no UI. <sup>k</sup>
12. **Allowed hosts.** With `allowed_hosts` set (`config.inc.php [general]`, a JSON array of hostnames), a request
    whose Host header isn't on the list is answered `400 "Server host not allowed"` (and logged). Explicitly skipped
    when `APPLICATION_ENV=test`, so code-verified only. <sup>l</sup>
13. **The "must be signed in" composite (framework atom).** `PKPSiteAccessPolicy` — despite the name, not the login
    wall — is the framework's reusable "**a user must be logged in** (+ role/operation set)" policy: it denies when no
    user is in the session, then runs a role-based (or public-access) policy set. Consumers include the payments,
    dashboard, profile, manage-issues and announcement-type surfaces; each consumer's feature owns its own gate — the
    primitive is documented once, here, beside its AUTHZ siblings in `roles-permissions`. <sup>m</sup>

<sup>a</sup> `access.tpl` (tab `id="access"`, label `manager.siteAccessOptions.siteAccessOptions`); `ManagementHandler::access()` (builds `UserAccessForm` on the context API URL); `PKPUserAccessForm`/`UserAccessForm` `__construct()`; live field/label render ·
<sup>b</sup> `SettingsHandler::__construct()` (admin `access`+`settings`; manager `settings` only) + `ManagementHandler::authorize()` (`CanAccessSettingsPolicy`); `PKPContextController::getGroupRoutes()` (`roleAuthorizer([SITE_ADMIN, MANAGER])`) / `edit()`; `PKPTemplateManager::setupBackendPage()` (nav uses `settings/access`); live: manager PUT 200, reviewer PUT refused, dbarnes direct-op denied / admin 200 ·
<sup>c</sup> `PKPHandler::authorize()` + `PKPBaseController::authorize()` (both add `RestrictedSiteAccessPolicy` unless the handler opts out); `RestrictedSiteAccessPolicy::applies()`/`effect()`; `PKPPageRouter::handleAuthorizationFailure()` → `Validation::redirectLogin()` (`source`); live matrix incl. `oai?verb=Identify` + `sitemap` + `gateway/lockss` → 302 ·
<sup>d</sup> `RestrictedSiteAccessPolicy::_getLoginExemptions()` (`['user','login','help','header','sidebar','payment','invitation']` + hook); `OrcidHandler::__construct()` (`setEnforceRestrictedSite(false)`); live exempt-page probes; `/help` → 404 ·
<sup>e</sup> `RestrictedSiteAccessPolicy::applies()` (`$context?->getData('restrictSiteAccess') ?? false`); live publicknowledge unaffected ·
<sup>f</sup> live: anon GET walled `/user/register` → 200 full form (registration open at the time) ·
<sup>g</sup> `SearchHandler::setupTemplate()`, `AboutContextHandler::authorize()`, `InformationHandler::authorize()`/`setupTemplate()` (public cacheability only when not restricted); `DRIVERPlugin` (`restrictSiteAccess == 1 || restrictArticleAccess == 1` → excluded) ·
<sup>h</sup> `RegistrationHandler::validate()`; `PKPNavigationMenuService::getDisplayStatus()` (`NMI_TYPE_USER_REGISTER`); `UserFormHelper::assignRoleContent()` (skips `disableUserReg` contexts for opt-in groups, but assigns the full `contexts` list); live: message page, navbar Register gone, site-wide page opt-ins for publicknowledge only ·
<sup>i</sup> `ArticleHandler::userCanViewGalley()` (published + `!subscribedDomain` + `!isLoggedIn` + `restrictArticleAccess` + `galleyId` → `redirectLogin`; called from `view()` with a galley and `download()`); `IssueHandler::userCanViewGalley()` (same for issue galleys); `Repo::submission()->canPreview()` / `IssueAction::allowedIssuePrePublicationAccess()` bypasses; live probes ·
<sup>j</sup> `PKPPageRouter::route()` ("Redirect requests from logged-out users to a context which is not publicly enabled"); `IndexHandler::index()` (`getAll(true)`); live probes as listed ·
<sup>k</sup> `HttpsPolicy::applies()` (`force_ssl`) / `effect()` + advice `redirectSSL`; `PKPHandler::requireSSL()` (default true) ·
<sup>l</sup> `AllowedHostsPolicy::applies()` (`allowed_hosts != ''`; test-mode skip) / `callOnDeny()` (400 + log) ·
<sup>m</sup> `PKPSiteAccessPolicy::__construct()`/`effect()`; consumers: `PaymentsHandler`, `PKPDashboardHandler`, `ProfileHandler`, `ManageIssuesHandler`, `AnnouncementTypeGridHandler`, `UserApiHandler`

## Side effects

- **Journal settings rows** — saving the form writes the three booleans to the journal's settings (via the shared
  journal-settings API); no email, no notification, no event-log entry is produced by changing them.
- **Enforcement is side-effect-free** — a blocked anonymous request produces only the login redirect (with `source`
  return-to for the wall and the galley gate; without it for disabled journals). Nothing is logged per denial
  (`allowed_hosts` violations are the exception: PHP error-log line + 400 body).
- **Caching / exposure** — restricted journals stop declaring public page-cacheability (search/about/information) and
  drop out of the DRIVER OAI set (Rule 7); OAI + sitemap answer with redirects while walled (Rule 3).

## Settings that modify behavior

- **The three toggles themselves** are the feature (journal-level; all default off/open).
- **`force_ssl`** (`config.inc.php [security]`) — HTTPS-only enforcement + redirect (Rule 11). (`force_login_ssl` is
  the login/registration-scoped variant, owned by `registration-login`.)
- **`allowed_hosts`** (`config.inc.php [general]`) — Host-header allow-list, 400 on mismatch (Rule 12); inert under
  `APPLICATION_ENV=test`.
- **Journal `enabled` flag** (admin-owned, `site-administration`) — drives Rule 10.
- **Hook `RestrictedSiteAccessPolicy::_getLoginExemptions`** — plugins can extend the wall's exempt-page list.

## Cross-feature interactions

- **roles-permissions** (52) — owns the Users & Roles **page shell** (`PAGE-management-settings-access`) and the
  settings-access baseline (`CanAccessSettingsPolicy`); this spec owns the Site Access Options **tab's form + toggle
  semantics** (the two form atoms were reassigned here 2026-07-05). `PKPSiteAccessPolicy` (Rule 13) sits beside the
  five base policies owned there.
- **registration-login** (47) — owns the register form/flow and the site-wide "closed only when **all** journals are
  closed" rule; this spec owns the `disableUserReg` toggle and the closed-journal behaviours (message, nav link,
  opt-in filtering).
- **distribution-settings** (59, pending) — owns the **publishing mode** (open access vs subscription; the Distribution
  → *Access* tab / `AccessForm` — a different form from this feature's `UserAccessForm` despite the name). Seam:
  `restrictArticleAccess` is publishing-mode-independent (it login-gates galleys even on open access); on subscription
  journals it is the login-first step *inside* the same galley gate whose subscription decision is below.
- **subscription-access** (76) — owns `subscriptionRequired` / subscribed-user / subscribed-domain / purchase-paywall —
  the continuation of `userCanViewGalley()` after this spec's login check (Rule 9).
- **site-administration / hosted journals** — owns creating, enabling and disabling journals (the admin UI for the
  `enabled` flag); this spec owns only what a disabled journal *looks like* (Rule 10). Ledger row 118 (a manager can
  flip `enabled` via API) is recorded here but is their surface to fix.
- **user-invitations** (51) — the wall's `invitation` exemption keeps invitation accept/decline reachable on walled
  journals.
- **article-landing / galleys / issue-archive-toc** — the public pages whose reachability the wall and the galley gate
  modulate; they own the pages, this spec owns the two gates.

## Canonical scenarios

1. **Configure Site Access Options** — A journal manager opens Settings → Users & Roles → **Site Access Options**,
   sees the three fields (Site Access, View Article Content, User Registration), turns one on and saves; the saved
   value reads back. A reviewer can neither open the tab (authorization denied) nor save the setting through the
   backend (refused, value unchanged). (Live-verified both sides.)
2. **The login wall** — With Site Access on, an anonymous visitor is redirected from home/about/search/issue/article
   (and OAI/sitemap) to the journal's login with a return-to, and lands back on the requested page after signing in;
   login and lost-password stay reachable. Any logged-in account — no roles in the journal — browses freely.
   (Live-verified.)
3. **Self-registration pierces the wall** — On a login-walled journal with registration open, an anonymous visitor
   still reaches `/user/register` (exempt), creates an account and immediately reads the walled site. Closing User
   Registration seals this path. (Live-verified reachability; register-then-read is the documented interplay of
   Rules 4+6.)
4. **Registration closed** — With User Registration set to "the Journal Manager will register all user accounts", the
   register page shows "not accepting user registrations" with a Login link and no form, the navbar Register link
   disappears, and the site-wide register page stops offering that journal's reader/reviewer opt-ins. Re-enabling
   restores all three. (Live-verified.)
5. **Login-only full text on an open-access journal** — With View Article Content on, an anonymous reader still sees
   the abstract and issue TOC, but a galley view or download bounces to login (with return-to); after signing in —
   any account — the galley opens. (Live-verified: abstract 200, galley 302, logged-in 200.)
6. **Disabled journal visibility** — Admin disables a journal: anonymous visitors are redirected to its login from
   every page (register included) and the journal drops off the site's journal list; any logged-in account still
   browses it fully, and the admin retains the backend. Re-enabling restores public access. (Live-verified, including
   the any-account visibility.)

## Known deviations (as-built ≠ intent)

- ⚠ **A journal manager can disable — and re-enable — their own journal through the settings API; the UI reserves that
  flag for site admins** (proposed **ledger row 118**, added to [app-changes.md §2](../../e2e/app-changes.md)). The
  journal-settings endpoint the Site Access form posts to accepts *any* journal-schema property and applies no
  field-level authority check, so a manager's PUT with `enabled:false` (or `true`) is accepted — even **re-enabling a
  journal a site admin took offline**, a plain escalation over the admin-only Hosted Journals control. No manager-facing
  UI offers the flag (their Settings pages never render it), making this an API-permits/UI-hides mutating divergence in
  the family of rows 114/115. **Live-proven 2026-07-05** on a scratch journal: manager `dbarnes` PUT `enabled:false` →
  200 + journal hidden; after an **admin** disable, dbarnes PUT `enabled:true` → 200 + journal public again. The same
  hole is not confined to `enabled`: the verifier confirmed (2026-07-05) a manager can also PUT the two other
  admin-only Hosted-Journals-grid properties — **`seq`** (the journal's order in the site index) and even the journal
  **`urlPath`** (which changes every public URL for the journal) — through the same endpoint, so the precise scope is
  *"any admin-only context property, not just `enabled`"*. The *visibility* rules here are unaffected; the whole
  `enabled`/`seq`/`urlPath` control surface belongs to `site-administration`. Suspected intent: server-side, restrict
  the admin-only context props (`enabled`, `seq`, `urlPath`, …) to site admins on the edit endpoint.
- **Observation (not ⚠): the wall's `help` exemption is vestigial** — OJS 3.6 has no `/help` page (404), so the
  exemption names a dead page. Harmless; tidy-up candidate.
- **Observation (not ⚠): the site-wide register page still lists a registration-closed journal by name** — its role
  opt-ins are correctly dropped, but the journal heading renders with nothing under it (an empty section). Cosmetic;
  the register form is `registration-login`'s surface.

## Open questions

1. **Is "disabled journal readable by any logged-in account" intended?** The router only turns away visitors with no
   session ("not *publicly* enabled"), so a reader registered on *any* journal of the install can fully browse a
   journal an admin took offline. Confirm this is the intended meaning of disabled (vs. manager/admin-only visibility).
2. **Is the register-pierces-the-wall interplay (Rule 6) worth a UI hint?** Site Access + open registration means the
   wall only costs a visitor a sign-up. If walled journals are commonly meant to be private, should the form warn when
   Site Access is on while registration stays open?
3. **Should OAI/sitemap/gateway be exempt from the wall?** As-built a restricted journal is unharvestable (OAI,
   sitemap and the LOCKSS/CLOCKSS gateway all redirect to login) and DRIVER excludes it — consistent, but confirm
   harvesters/preservation crawlers going dark is intended for walled-but-public-ish journals.
4. **Is the site-admin-only direct `management/access` op still wanted?** Nothing links it; managers and admins both
   use `settings/access`. Keep as alias or retire?
5. **Should the vestigial `help` exemption be dropped** from `_getLoginExemptions()`?

---

## Reference — entry points & surfaces

| Entry | Path | Atom |
|-------|------|------|
| Site Access Options form (shared fields) | Settings → Users & Roles → "Site Access Options" tab → `userAccess` form (`restrictSiteAccess`, `disableUserReg`) | FORM-pkp-user-access-form |
| Site Access Options form (OJS field) | same form, `restrictArticleAccess` inserted after Site Access | FORM-user-access-form |
| Direct admin-only page op | `…/management/access` → `SettingsHandler` (`access` op, site-admin role assignment; same render as `settings/access`) | PAGE-management-access |
| The login wall | attached pre-handler to every page + API request | AUTHZ-restricted-site-access-policy |
| "Must be signed in" composite policy | consumed by payments/dashboard/profile/manage-issues/announcement-type/user-API handlers | AUTHZ-pkp-site-access-policy |
| HTTPS enforcement | every handler when `force_ssl` is on | AUTHZ-https-policy |
| Host allow-list | every handler when `allowed_hosts` is set (skipped in test mode) | AUTHZ-allowed-hosts-policy |
| Save endpoint | `PUT …/api/v1/contexts/{id}` (journal-settings API; shared with the other settings forms — endpoint atoms owned by the settings features) | — |

## Reference — code anchors

- **Form**: `lib/pkp/classes/components/forms/context/PKPUserAccessForm.php` (`restrictSiteAccess` checkbox,
  `disableUserReg` radio); `classes/components/forms/context/UserAccessForm.php` (`restrictArticleAccess`, positioned
  after `restrictSiteAccess`); `lib/pkp/templates/management/access.tpl` (tab `access`, label
  `manager.siteAccessOptions.siteAccessOptions`); `lib/pkp/pages/management/ManagementHandler.php::access()`;
  `pages/management/SettingsHandler.php::__construct()` (role assignments); schema `lib/pkp/schemas/context.json`
  (`restrictSiteAccess`, `disableUserReg`) + `schemas/context.json` (`restrictArticleAccess`).
- **Save path**: `lib/pkp/api/v1/contexts/PKPContextController.php` (`getGroupRoutes()` roleAuthorizer, `edit()` — no
  per-field authority check: ledger row 118).
- **Login wall**: `lib/pkp/classes/security/authorization/RestrictedSiteAccessPolicy.php` (`applies`, `effect`,
  `_getLoginExemptions` + hook); wired in `lib/pkp/classes/handler/PKPHandler.php::authorize()` and
  `lib/pkp/classes/core/PKPBaseController.php::authorize()` (`_enforceRestrictedSite`, opt-out
  `setEnforceRestrictedSite(false)` — used by `lib/pkp/pages/orcid/OrcidHandler.php`); denial →
  `PKPPageRouter::handleAuthorizationFailure()` / `Validation::redirectLogin()`.
- **Galley gate**: `pages/article/ArticleHandler.php::userCanViewGalley()` (+ callers `view()`/`download()`);
  `pages/issue/IssueHandler.php::userCanViewGalley()`.
- **Registration-closed**: `lib/pkp/pages/user/RegistrationHandler.php::validate()`;
  `lib/pkp/classes/services/PKPNavigationMenuService.php::getDisplayStatus()` (`NMI_TYPE_USER_REGISTER`);
  `lib/pkp/classes/user/form/UserFormHelper.php::assignRoleContent()`.
- **Disabled journal**: `lib/pkp/classes/core/PKPPageRouter.php::route()` (logged-out redirect);
  `pages/index/IndexHandler.php::index()` (`JournalDAO::getAll(true)`).
- **Config gates**: `lib/pkp/classes/security/authorization/HttpsPolicy.php`, `AllowedHostsPolicy.php`;
  `PKPHandler::requireSSL()`.
- **Framework composite**: `lib/pkp/classes/security/authorization/PKPSiteAccessPolicy.php`.
- **Ancillary**: `lib/pkp/pages/search/SearchHandler.php::setupTemplate()`,
  `lib/pkp/pages/about/AboutContextHandler.php::authorize()`, `pages/information/InformationHandler.php` (cacheability);
  `plugins/generic/driver/DRIVERPlugin.php` (restricted-journal exclusion).
- **Liveness note**: probed 2026-07-05 against `:8000` (`ojs_test`, PostgreSQL, `APPLICATION_ENV=test`). All mutation on
  a throwaway **scratch journal `j-sarprobe`** (id 2, via `/api/v1/_test/scenarios/journal`; one published probe
  article w/ PDF galley via the submission scenario); `publicknowledge` read-only throughout (its three toggles
  confirmed unset before/after). Probe matrix: **(a)** form fields/labels + page gating (manager 200 / reviewer+author
  denied / direct op admin-only); **(b)** wall ON: 7 public paths + OAI + sitemap → 302 `login?source=…`; exempt
  login/lostPassword/register → 200; roleless logged-in user → 200s; **(c)** registration closed: message page + no
  form, navbar Register gone, site-wide register kept publicknowledge's opt-ins (`readerGroup[17]`,
  `reviewerGroup[16]`) and offered none for the closed journal; **(d)** article restriction on the open-access scratch:
  abstract + TOC 200, galley view/download 302→login, logged-in galley 200; **(e)** disabled: anon → login redirects +
  absent from site index, roleless account browsed fully, admin 200. Permission probes: manager PUTs saved each toggle
  (200); reviewer PUT → 401 refused, unchanged. **Row 118**: manager `enabled:false` → 200; admin disable then manager
  `enabled:true` → 200 (journal public again). Every flipped setting restored (`enabled:true`, all three toggles
  false); scratch journal `j-sarprobe` remains.
- **Adversarial verification (2026-07-05, verifier)**: independently re-drove the permission matrix and every gate on
  fresh scratch journals `j-sarv1/2/3` (ids 21–23; all settings restored, journals remain). **Permission edges
  (contexts PUT):** the save endpoint is genuinely **manager/admin-only** — a **section editor** (`dbuskins`, role in
  the journal), a production **assistant** (`mfritz`, copyeditor role), and a **reviewer** (`jjanssen`) each got **401**
  on `PUT contexts/{id}` `{restrictSiteAccess:true}`; the setting stayed put. This is a *narrower* group than the
  `/users` and `/invitations` route groups (ledger rows 114/115, which admit `SUB_EDITOR`/`ASSISTANT`) — the row-114
  API-admits-what-UI-hides pattern does **not** extend to this feature's PUT. The **access page** likewise denies
  section-editor + assistant + reviewer (`user.authorization.roleBasedAccessDenied`), and the **`management/access`
  direct op is site-admin-only** (manager `dbarnes` → authorizationDenied, admin → 200). **Row 118 re-verified
  independently** on `j-sarv2`: manager `enabled:false`→200 (anon home→login), `enabled:true`→200; **escalation** half
  reproduced (admin disable → manager `enabled:true`→200, journal public by a non-admin). **Scope-bounded**: the same
  endpoint also let the manager change admin-only **`seq`** (99→restored) and **`urlPath`** (`j-sarv2`→`j-sarv2x`→
  restored) — folded into row 118. **Galley gate (uncovered by the retained tests):** with `restrictArticleAccess` on
  and an article carrying a **PDF *and* an HTML galley**, anonymous view+download of **both** galley types → 302 login,
  the **versioned** URLs (`article/view|download/5/version/5/5`) → 302 login too, while abstract + issue TOC stayed 200;
  a roleless logged-in account (`jjanssen`) read both galleys and downloaded the PDF (`application/pdf`, `%PDF-`).
  `IssueHandler::userCanViewGalley()` confirmed to mirror `ArticleHandler` (same `restrictArticleAccess` branch).
  **Wall machine endpoints:** OAI (`/oai`, `/oai?verb=Identify`), `/sitemap` and `/gateway/lockss` all → 302
  `login?source=…`; `/user/register` + `/login` exempt (200); `/help`→404 (vestigial, confirmed). The REST API returns
  **401 walled *and* unwalled** (reader endpoints require auth regardless — the wall adds no observable API difference;
  spec Rule 3 corrected to say so). **Disabled journal:** every anon path (home/about/register/article/galley/OAI/
  sitemap/gateway) → login with **no** `source=`; API→401; login page itself 200; re-enable restored public access.
  **Config gates:** `HttpsPolicy` (`force_ssl`, Off in test) and `AllowedHostsPolicy` (explicit `APPLICATION_ENV=test`
  skip in `applies()`) code+config-verified only — genuinely unreachable in a stock test install, correctly calibrated
  as config-gated (no config edited). **Atlas audit:** all 7 claimed atoms are single-owned by this spec (the
  `roles-permissions.md` mention is the 2026-07-05 reassignment note, not a competing claim). No app code changed; the
  retained `site-access-restrictions.spec.js` was not touched.
