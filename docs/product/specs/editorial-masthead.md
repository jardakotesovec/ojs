---
name: editorial-masthead
scope: A journal manager configures the public editorial masthead — the display ORDER of the masthead-eligible role groups shown on the /about/editorialMasthead page (reviewers auto-listed in their own fixed section), and, per person, whether each user's role assignment appears on that masthead (the per-assignment display flag), with the user emailed when their visibility changes
shared: pkp-lib   # PKPAppearanceMastheadForm, the mastheadUserGroupIds context setting, the per-assignment masthead flag on user_user_groups, and the UserRoleMastheadUpdateNotify mailable all live in lib/pkp; OJS adds nothing masthead-specific (the OJS MastheadForm it sits beside is the journal-IDENTITY form, owned by journal-masthead-settings)
status: verified
e2e-plans: [editorial-masthead]
atlas-claims:
  - FORM-pkp-appearance-masthead-form
  - MAIL-user-role-masthead-update-notify
---

# Editorial masthead (the public-roster configuration)

## Purpose

The **public Editorial Masthead** (`/{journalPath}/about/editorialMasthead`) presents a journal's editorial
team grouped by role, followed by an auto-generated Peer Reviewers list. That **page render** is owned by
`about-pages`; **this feature owns the two knobs that decide what it shows**: (1) the **display order** of the
masthead role groups, configured on **Settings → Website → Editorial Masthead** (the appearance tab); and
(2) the **per-user display flag** — for each person, whether a given role assignment appears on the masthead
at all. A user carrying the flag on an active assignment in a masthead-eligible group appears under that
group's heading; a user without it does not. When a person's masthead visibility **changes**, they are
**emailed** a notice. That is the whole feature: the manager arranges the roster's role order and reviewer
note; the per-user flags (driven from the edit-user page and the users REST API) fill the rows; the email
tells each person when their line changes.

It does **not** own: the public **pages** that render this config (`/about/editorialMasthead` +
`/about/editorialHistory` — `about-pages`); the **per-user masthead PUT endpoint**
(`API-user-masthead` — `user-management`, driven from the `user-invitations` edit-user page); **which groups
are eligible** for the masthead at all (the per-group `masthead` toggle — `roles-permissions`); the
**Editorial History** content and the **journal-IDENTITY "Masthead" tab** (journal name/acronym/publisher/
ISSN — `journal-masthead-settings`, whose tab confusingly shares the word "Masthead").

## Actors & permissions

**Two distinct configuration surfaces.** The **appearance order** lives in journal **Settings → Website**,
gated like every settings page by `CanAccessSettingsPolicy` — a **manager with settings access** or a **site
admin**. The **per-user flag** is set from the **edit-user page** (`user-invitations`) and its backing
**per-user PUT** (`API-user-masthead`, owned by `user-management`); this spec references those surfaces and
does not re-implement their gates. Site-wide baselines: an **anonymous** visitor reaches neither config (only
the public page); a plain user cannot set their **own** masthead flag — the self-service profile exposes **no**
masthead control (contrast the Roles tab, which handles only self-registerable roles + interests). Rows read
*"who may configure — and where."* <sup>a</sup>

| Action | Who may — and when |
|--------|--------------------|
| **Set the masthead role display order** (+ read the reviewer note) | • Manager with settings access, site admin — on **Settings → Website → Editorial Masthead**; drag to reorder the eligible non-reviewer groups. Reorder **only** — groups can't be added/removed here <sup>a</sup> |
| **Flag a user onto / off the masthead** (per role assignment) | • Manager, site admin — from the **edit-user page** (`user-invitations`); reviewer assignments **cannot** be toggled. Changing it emails the user<br>• ⚠ the backing **per-user PUT** also admits **section editors** and runs **no** administration-scope check — an API-permits/UI-hides gap owned & documented by `user-management` (ledger row 114); referenced here, not re-narrated <sup>b</sup> |
| **Set your OWN masthead visibility** | • Nobody via self-service — the Profile page has **no** masthead field; a user's line is controlled only by a manager/the edit-user page <sup>c</sup> |
| **Decide whether a GROUP may appear on the masthead at all** | • Manager, site admin — the per-group **Show on masthead** toggle on **Settings → Users & Roles → Roles** (owned by `roles-permissions`); this is the eligibility gate the order form draws its list from <sup>d</sup> |
| **View the public masthead** | • Any visitor, no login — the render is owned by `about-pages` <sup>e</sup> |

<sup>a</sup> `ManagementHandler::website()` (builds `PKPAppearanceMastheadForm`, `CanAccessSettingsPolicy` on the settings page); `PKPAppearanceMastheadForm::__construct()` (`FieldOptions mastheadUserGroupIds`, `isOrderable`+`allowOnlySorting`, `excludeRoleIds(ROLE_ID_REVIEWER)`); `website.tpl` (`appearance-masthead` tab, label `common.editorialMasthead`); form `method=PUT` → context API; live 2026-07-05: manager/admin page carried the `appearanceMasthead` form with `value:[3,5,19]` ·
<sup>b</sup> `PKPUserController::masthead()` (reviewer→`api.400.reviewerMastheadCannotBeChanged`; owned by `user-management`, ledger row 114 for the sub-editor/no-scope gap); `UserInvitationUserGroupsTable.vue` (masthead field on the edit-user page — `user-invitations`) ·
<sup>c</sup> `RolesForm`/`UserFormHelper::saveRoleContent()` handle only `permitSelfRegistration` groups + interests — no `masthead` write anywhere in the profile tabset (grep-confirmed 2026-07-05) ·
<sup>d</sup> `UserGroupForm::execute()` (`masthead = (bool) getData('masthead')`, any role) — `roles-permissions`; live: `publicknowledge` masthead-eligible groups = Journal editor (16), Section editor (17), **Reviewer (4096)**, Editorial Board Member (4097) ·
<sup>e</sup> `AboutContextHandler::editorialMasthead()` → `frontend/pages/editorialMasthead.tpl` — `about-pages`

## Fields & validation

**Editorial Masthead appearance form** (`PKPAppearanceMastheadForm`, the `appearance-masthead` tab). Exactly
**two** fields, and only the first is editable:

| Field (UI label) | Required? | Rules | Anchor |
|------------------|-----------|-------|--------|
| **Editorial Masthead** (`mastheadUserGroupIds`) | No | An **orderable** list of **every masthead-eligible non-reviewer group** (each group whose per-group `masthead` flag is on, minus the Reviewer role). The manager **drag-sorts** it; the saved order is the sequence of role headings on the public page. **Sorting only** — you cannot check/uncheck a group here (`allowOnlySorting`); a group's *presence* is governed by its per-group eligibility flag (`roles-permissions`), not this form. Saved to the journal's `mastheadUserGroupIds` context setting. | `PKPAppearanceMastheadForm` (`FieldOptions`, `isOrderable:true`, `allowOnlySorting:true`, `value = array_column(options,'value')`); `context.json mastheadUserGroupIds` (array of ints, nullable) |
| **Reviewers** (`reviewer`) | N/A — display-only | A **fixed informational note** (*"Reviewers will be displayed in a standardized format…"*). **Not editable, not persisted, carries no value** — it merely tells the manager reviewers are auto-listed. There is **no reviewer opt-in and no past-year toggle** to configure (see Rule 4 + Known deviations). | `PKPAppearanceMastheadForm` (`FieldHTML 'reviewer'`, label `user.role.reviewers`, description `manager.setup.editorialMasthead.order.reviewers.description`) |

**Per-user masthead flag** — set on the edit-user page, not this form:

| Field (UI label) | Required? | Rules | Anchor |
|------------------|-----------|-------|--------|
| **Appear on masthead** (per role assignment) | No | A boolean on each of a user's active role assignments. Set from the edit-user page or the per-user PUT; a **Reviewer** assignment is rejected. Stored on the `user_user_groups.masthead` bit. | `UserInvitationUserGroupsTable.vue` (`masthead`) → `PKPUserController::masthead()` (`setUserUserGroupMasthead`); *owned by `user-management`/`user-invitations`, driven by this feature's roster* |

## Rules & state

The masthead is a **two-level opt-in**: a **group** must be masthead-eligible (`roles-permissions`) *and* a
**user's active assignment** in that group must carry the display flag. This feature owns the **order** among
eligible groups and the **per-user flag → roster** mapping; the page render is `about-pages`.

1. **The appearance form orders the eligible role groups; it cannot add or remove them.** Settings → Website →
   **Editorial Masthead** shows one drag-sortable list of **every non-reviewer group whose per-group `masthead`
   flag is on**, seeded in the journal's saved order. The manager reorders it and saves; the form **PUTs the
   context** and persists `mastheadUserGroupIds` (the ordered id list). Because the field is
   `allowOnlySorting`, a manager cannot hide an eligible group from here — eligibility is the per-group toggle
   in `roles-permissions`. **Live-verified**: on `publicknowledge` the form's value is `[3,5,19]` (Journal
   editor, Section editor, Editorial Board Member) — exactly the masthead-eligible groups minus Reviewer.
   *(anchor: `PKPAppearanceMastheadForm::__construct()` (`UserGroup::masthead(true)->excludeRoleIds(REVIEWER)->orderByRoleId()`, sorted by the saved order); `ManagementHandler::website()`)*
2. **The saved order drives the public page's role sequence.** The public masthead sorts its role headings by
   the position of each group id in `mastheadUserGroupIds`; changing the order changes the on-page order.
   **Live-verified** on a scratch journal with two flagged users: order `[Journal editor, Section editor]` →
   headings render *Journal editor* then *Section editor*; reversing the setting to `[Section editor, Journal
   editor]` → the headings flip. *(anchor: `AboutContextHandler::getSortedMastheadUserGroups()`
   (`sortBy(array_search($ug->id, $savedOrder))`) — the method is `about-pages`', reading this feature's
   setting)*
3. **A user appears on the masthead only when their ACTIVE assignment carries the display flag.** For each
   ordered group the page lists the users whose assignment in that group is **active** and **masthead-flagged**
   (shown with full name, service **start year**, affiliation, ORCID icon). A group heading renders only if it
   has ≥1 such user — so a masthead with eligible-but-empty groups renders blank. **This is exactly why the
   seed is empty** (`about-pages`' finding): `publicknowledge`'s groups are eligible and ordered, but **no
   non-reviewer user carries the per-assignment flag**. **Setting the flag populates the roster.**
   **Live-verified**: on a scratch journal, an editor with no flag → the page listed **no** editors; after
   `PUT …/masthead/{uug}` set the flag, the same page listed that editor under **Journal editor** with their
   affiliation and start year. *(anchor: `AboutContextHandler::editorialMasthead()`
   (`getMastheadUserIdsByRoleIds()`; `UserUserGroup::withActive()->withMasthead()`) — render owned by
   `about-pages`; the flag write is `user_user_groups.masthead`)*
4. **Reviewers are auto-listed in a fixed section — there is no reviewer opt-in to configure.** Below the
   ordered role groups the page shows a **Peer Reviewers** section: the **external** reviewers who **completed a
   review in the previous calendar year**, ordered by family name. This list is **computed, not configured** —
   the Reviewer group is deliberately **excluded** from the order form (and from the per-user masthead PUT,
   which 400s a reviewer assignment), and the appearance form's `reviewer` field is a **display-only note**, not
   a toggle. The "previous year" is hard-coded (`date('Y') - 1`); there is no setting for the window or for
   whether reviewers appear. *(anchor: `AboutContextHandler::editorialMasthead()`
   (`getExternalReviewerIdsByCompletedYear($contextId, date('Y')-1)`); `PKPUserController::masthead()`
   (`ROLE_ID_REVIEWER` → 400); `PKPAppearanceMastheadForm` (`FieldHTML 'reviewer'`); render owned by
   `about-pages`)*
5. **Changing a user's masthead flag emails them; a no-op change does not.** When the per-user PUT actually
   **flips** the flag, an **"Your journal masthead visibility has been updated"** email
   (`UserRoleMastheadUpdateNotify`, template `USER_ROLE_MASTHEAD_UPDATE`) is sent to the user, naming the role
   (with service dates, if any) and whether they now **appear** or are **hidden**. If the submitted value
   **equals** the current one, the endpoint returns the user unchanged and sends **nothing**. **Live-verified**:
   flipping a throwaway editor's flag delivered the update email to their address; re-PUTing the same value
   returned 200 and sent **no** additional mail. *(anchor: `PKPUserController::masthead()` (early-return on
   `$userUserGroup->masthead == $masthead`; else `Mail::send(new UserRoleMastheadUpdateNotify(...))`);
   `UserRoleMastheadUpdateNotify::setData()` (`roleNameAndDates`, `appearOnMasthead`))*
6. **The Editorial History page reuses this feature's role order but a different flag set.**
   `/about/editorialHistory` groups **ended** masthead assignments by the same role order, showing each past
   contributor's service date range. The order it uses is this feature's `mastheadUserGroupIds`; the history
   **content/intro** and its "editorial history" description live in `journal-masthead-settings`. Render + the
   history page are `about-pages`'. *(anchor: `AboutContextHandler::editorialHistory()`
   (`getMastheadUserIdsByRoleIds(…, STATUS_ENDED)`); cross-refs below)*

## Side effects

- **`mastheadUserGroupIds`** (journal context setting) — the appearance form's Save writes the ordered group-id
  list via a **`PUT contexts/{id}`**; the public masthead + history pages read it. No other field on the form
  persists (the `reviewer` note carries no value).
- **`user_user_groups.masthead`** (the per-assignment display bit) — flipped by the per-user PUT
  (`setUserUserGroupMasthead`, which also **clears the editorial-masthead cache**); this is the row the public
  roster keys on. (The **write path** is `user-management`/`user-invitations`; this feature owns the
  **config→display** meaning of the bit.)
- **Email** — a **flip** of the flag sends **`UserRoleMastheadUpdateNotify`** (`USER_ROLE_MASTHEAD_UPDATE`) to
  the affected user, from the acting user; recipients are the non-reviewer editorial roles (sub-editor,
  assistant, author, reader, subscription manager). A **no-op** sends nothing; a **reviewer** assignment is
  refused before any send. No in-app notification or event-log entry is raised by masthead config.
- **Cache** — the editorial-masthead role cache is invalidated whenever a masthead-eligible group's membership
  or a per-user flag changes (via the `roles-permissions`/`user-management` paths), so the public page reflects
  edits immediately.

## Settings that modify behavior

- **`mastheadUserGroupIds`** (this feature's setting) — the ordered non-reviewer group list; empty/unset → the
  eligible groups render in an unspecified order until the manager saves one.
- **Per-group `masthead` eligibility flag** (`roles-permissions`) — decides which groups the order form even
  lists; a group with the flag off never appears on the masthead regardless of user flags.
- **Per-user `masthead` assignment flag** (`user-management`/`user-invitations`) — the row-level opt-in the
  public roster requires; empty by default (hence the empty seed).
- **Completed reviews in the prior calendar year** — the sole input to the auto Peer Reviewers section
  (Rule 4); not a configurable setting.
- **`USER_ROLE_MASTHEAD_UPDATE` email template** — the journal's editable template body/subject for the
  visibility-change notice (the handler throws if it is missing, i.e. the `I11800` migration hasn't run).

## Cross-feature interactions

- **about-pages** — owns the public **`/about/editorialMasthead`** and **`/about/editorialHistory`** page
  **render** (`PAGE-about-editorialmasthead`, `PAGE-about-editorialhistory`) and found the seed renders empty.
  Seam: they render; **this feature owns the config** (role order + the per-user-flag→roster mapping) that
  populates them.
- **user-management** — owns the **per-user masthead PUT** (`API-user-masthead`: `PUT
  /users/{id}/masthead/{userUserGroupId}`) that flips the display bit, and documents the **ledger-row-114**
  gap (the PUT admits section editors and runs no administration-scope check). This feature owns the
  **appearance config + the update-notify mailable**; `user-management` **fires** that mailable from the PUT.
- **user-invitations** — owns the **edit-user page** UI (`UserInvitationUserGroupsTable`) whose per-assignment
  **masthead** checkbox is the primary way a manager sets the flag.
- **user-profile** — the self-service profile has **no** masthead control; a user cannot set their own line
  (correcting the assumed seam — the profile Roles tab handles only self-registerable roles + interests).
- **roles-permissions** — owns the per-group **`masthead` eligibility** toggle (whether a group *can* appear)
  and the `SCHEMA-user-group` `masthead` prop; this feature only **orders** the eligible groups.
- **journal-masthead-settings** (feature 56, not yet written) — owns the journal-**IDENTITY** "Masthead" tab
  (`FORM-masthead-form` / `FORM-pkp-masthead-form`: name/acronym/publisher/ISSN) and the **Editorial History**
  content/description. **Seam (not a deviation):** the public masthead page **also renders editorialHistory**,
  configured *there* — cross-reference; the two "Masthead" tabs (Website appearance vs. Journal identity) are
  **distinct** (the shared label is Open question 3, not a ⚠).

## Canonical scenarios

1. **Configure the masthead role order** — A manager opens **Settings → Website → Editorial Masthead**, drag-
   sorts the list of eligible role groups (e.g. Editorial Board Member above Section editor), and saves; the
   `mastheadUserGroupIds` order persists and the public page's role headings follow it. The list can only be
   reordered — groups are added/removed via the per-group masthead toggle in Roles. *(Live-verified 2026-07-05:
   the `appearanceMasthead` form rendered with `value:[3,5,19]`, `allowOnlySorting`, + the reviewer note.)*
2. **Flag a user onto the masthead → they appear on the public page + are emailed** — A manager turns a user's
   role assignment's **Appear on masthead** on (edit-user page / per-user PUT); the user is now listed under
   that role's heading on `/about/editorialMasthead` (with start year + affiliation), and receives a *"Your
   journal masthead visibility has been updated"* email. *(Live-verified: a scratch-journal editor absent from
   the empty page appeared under **Journal editor** after `PUT …/masthead/{uug}`; the update email was
   delivered to their address.)*
3. **Reorder the groups → the public page order changes** — With two flagged users in two groups, a manager
   swaps the masthead order; the public page's role sections re-sequence to match. *(Live-verified: setting
   `[Journal editor, Section editor]` then `[Section editor, Journal editor]` flipped the on-page heading
   order.)*
4. **The reviewer section is automatic (no opt-in)** — A reader viewing the masthead sees a **Peer Reviewers**
   section listing external reviewers who completed a review in the previous calendar year — with **no**
   manager configuration behind it: the appearance form's reviewer entry is a display-only note, the Reviewer
   group is excluded from the order list, and a reviewer assignment cannot be masthead-toggled. *(Reviewer-flag
   400 + the excluded order list verified in code + on `publicknowledge`; the empty-seed reviewer section
   verified by `about-pages`.)*
5. **The update-notify email boundary** — Changing a user's masthead flag emails them once; **re-saving the
   same value** sends nothing, and a **Reviewer** assignment is refused before any send. *(Live-verified: flip →
   one email; identical re-PUT → 200 with no new mail; reviewer → 400 per `user-management`.)*

## Known deviations (as-built ≠ intent)

- **Observation (not ⚠): the FEATURE-MAP's "reviewer display opt-in … / list-reviewers-for-the-past-year
  toggle" does not exist as configuration.** As-built, the appearance form's `reviewer` field is a **display-
  only note**; reviewers are **auto-listed** (external, prior-calendar-year completed reviews, family-name
  order) with no opt-in and no window setting, and a reviewer *role* cannot be masthead-toggled at all. This is a
  scope correction of the map's phrasing (cf. `about-pages`' "section policies" correction), **not** an app
  defect — nothing is inconsistent or lost. Recorded so a reader doesn't hunt for a reviewer toggle. *(Open
  question 1.)*
- **Note — the public masthead can render entirely empty for a fully-staffed journal** (the seed state). A
  name shows only when its **active** assignment is masthead-flagged; `publicknowledge` flags the *groups* but
  **no non-reviewer users**, so the page shows headings-worth of nothing. This is the intended two-level opt-in,
  **not** a defect (the flag is populatable — Rule 3, live-verified) — the canonical statement of this is in
  `about-pages` (Open question 1 there); referenced, not re-flagged.

## Open questions

1. **Should reviewers on the masthead be configurable?** As-built there is no reviewer opt-in and the past-year
   window is hard-coded (Rule 4) — confirm whether the auto Peer Reviewers section (and its fixed prior-year
   window) is the intended design, or whether the FEATURE-MAP's implied reviewer/past-year toggles were planned.
2. **Should a seeded journal ship at least one masthead-flagged editor** so the public page demonstrates a
   roster out of the box? (Shared with `about-pages` Open question 1 — the empty seed is a seed-data choice, not
   a code defect.)
3. **Should the two "Masthead" tabs be disambiguated?** Settings → **Website** → "Editorial Masthead" (this
   feature, the roster order) and Settings → **Journal** → "Masthead" (`journal-masthead-settings`, journal
   identity) share a label and both feed the public masthead/history pages — confirm whether the naming
   collision is intended.

---

<!-- REFERENCE MATERIAL — provenance and campaign bookkeeping, not product-owner narrative. -->

## Reference — entry points & surfaces

| Entry | Path | Atom |
|-------|------|------|
| Editorial Masthead appearance tab | Settings → Website → **Editorial Masthead** → `PKPAppearanceMastheadForm` → **`PUT api/v1/contexts/{id}`** (`mastheadUserGroupIds`) | FORM-pkp-appearance-masthead-form |
| Masthead-visibility-updated email | `UserRoleMastheadUpdateNotify` (`USER_ROLE_MASTHEAD_UPDATE`), sent on a per-user masthead flip | MAIL-user-role-masthead-update-notify |
| Per-user masthead flag (PUT) *(not this feature)* | `PUT api/v1/users/{userId}/masthead/{userUserGroupId}` → `PKPUserController::masthead()` | API-user-masthead *(owned by `user-management`)* |
| Public masthead / history pages *(not this feature)* | `GET /{journalPath}/about/editorialMasthead` · `…/editorialHistory` | PAGE-about-editorialmasthead, PAGE-about-editorialhistory *(owned by `about-pages`)* |
| Per-group masthead eligibility *(not this feature)* | Settings → Users & Roles → Roles → `UserGroupForm` (`masthead`) | SCHEMA-user-group *(owned by `roles-permissions`)* |
| Journal-identity "Masthead" tab *(not this feature)* | Settings → Journal → **Masthead** → `MastheadForm`/`PKPMastheadForm` | FORM-masthead-form, FORM-pkp-masthead-form *(owned by `journal-masthead-settings`)* |

## Reference — code anchors

- **Appearance form**: `lib/pkp/classes/components/forms/context/PKPAppearanceMastheadForm.php` (`__construct()`
  — `FieldOptions mastheadUserGroupIds` (`isOrderable`, `allowOnlySorting`, `excludeRoleIds(ROLE_ID_REVIEWER)`,
  saved-order sort) + `FieldHTML 'reviewer'`); instantiated in
  `lib/pkp/pages/management/ManagementHandler.php::website()`; rendered in
  `lib/pkp/templates/management/website.tpl` (`appearance-masthead` tab).
- **Setting**: `lib/pkp/schemas/context.json` (`mastheadUserGroupIds`, array of ints, nullable) — written by
  the context `PUT`; schema atom owned by `journal-masthead-settings`.
- **Config → display mapping** (render owned by `about-pages`):
  `lib/pkp/pages/about/AboutContextHandler.php` — `getSortedMastheadUserGroups()`
  (`UserGroup::masthead(true)->excludeRoles([REVIEWER])`, `sortBy(array_search(id, mastheadUserGroupIds))`),
  `editorialMasthead()` (`Repo::userGroup()->getMastheadUserIdsByRoleIds()`,
  `UserUserGroup::withActive()->withMasthead()`, `getExternalReviewerIdsByCompletedYear($ctx, date('Y')-1)`),
  `editorialHistory()` (`…STATUS_ENDED`, `UserUserGroup::withEnded()->withMasthead()`);
  `lib/pkp/templates/frontend/pages/{editorialMasthead,editorialHistory}.tpl`.
- **Per-user flag write** (owned by `user-management`/`user-invitations`):
  `lib/pkp/api/v1/users/PKPUserController.php::masthead()` (reviewer 400; no-op early-return;
  `Repo::userGroup()->setUserUserGroupMasthead()`; `Mail::send(UserRoleMastheadUpdateNotify)`);
  `lib/pkp/classes/userGroup/Repository.php` (`setUserUserGroupMasthead()`,
  `updateActiveUserUserGroupMasthead()`, `getMastheadUserIdsByRoleIds()`); `user_user_groups.masthead`;
  `lib/ui-library/src/pages/userInvitation/UserInvitationUserGroupsTable.vue`.
- **Mailable** (this feature): `lib/pkp/classes/mail/mailables/UserRoleMastheadUpdateNotify.php`
  (`emailTemplateKey = USER_ROLE_MASTHEAD_UPDATE`; `toRoleIds` = sub-editor/assistant/author/reader/subscription
  manager, **no reviewer**; `setData()` builds `roleNameAndDates` + `appearOnMasthead`); template seeded by
  `lib/pkp/classes/migration/upgrade/v3_5_0/I11800_AddUserRoleMastheadUpdateEmail.php`; locale
  `emails.userRoleMastheadUpdateNotify.subject` = *"Your journal masthead visibility has been updated."*
- **Liveness note** — probed 2026-07-05 against `:8000` (`ojs_test`, PostgreSQL). Read on `publicknowledge` as
  admin (session auth): Settings → Website carried the **`appearanceMasthead`** form → `PUT
  …/contexts/1`, field `mastheadUserGroupIds` `field-options`, `isOrderable:true`, `allowOnlySorting:true`,
  `value:[3,5,19]` (Journal editor / Section editor / Editorial Board Member — the masthead-eligible non-reviewer
  groups; the Reviewer group (4096) carries `masthead=1` but is excluded from the list), plus the display-only
  **Reviewers** note. **Mutations** driven on **throwaway scratch journals** (`j-emprobe2` id 307, `j-emprobe3`
  id 308, via `/api/v1/_test/scenarios/journal`) with throwaway users — no seeded user touched: (1) an editor
  absent from the **empty** public masthead was made to **appear** under *Journal editor* (with affiliation +
  2026 start year) by `PUT …/users/142/masthead/821 {masthead:true}` → 200; (2) that flip delivered the *"Your
  journal masthead visibility has been updated"* email (Mailpit, scoped to the throwaway recipient); (3) a
  **no-op** re-PUT of the same value → 200 with **no** additional mail; (4) with two flagged users, setting
  `mastheadUserGroupIds=[5558,5560]` then `[5560,5558]` **reordered** the public page's role headings to match.
  Reviewer-assignment 400 + the sub-editor/no-scope PUT gap are `user-management`'s live findings (referenced).
  Residual footprint: scratch journals `j-emprobe1/2/3` remain (isolated from `publicknowledge`).
