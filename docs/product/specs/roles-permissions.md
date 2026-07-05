---
name: roles-permissions
scope: A journal manager (or site admin) defines the journal's ROLES — the user groups that map each person's title (Journal manager, Section editor, Reviewer, Author, Reader…) to one of the six built-in role types, sets the per-group permission toggles and workflow-stage assignments that those roles carry, and (Tools → Permissions) resets article copyright/licence to the journal defaults. Also the home of the AUTHZ policy framework — the base role/stage/user gates every handler in the app builds on.
shared: pkp-lib          # UserGroupGridHandler + UserGroupForm, the /userGroups REST list, UserGroup entity + Repository, the userGroup schema, PKPToolsHandler (permissions/reset), and the base authorization policies (StageRolePolicy, RoleBasedHandlerOperationPolicy, UserRolesRequiredPolicy, AnonymousUserPolicy, UserRequiredPolicy) all live in lib/pkp; OJS adds only the Subscription Manager role group and the restrictArticleAccess field on the access form
status: verified
e2e-plans: []            # no retained round-1 plan maps to the 3.6 roles/user-group grid yet
atlas-claims:
  - PAGE-management-settings-access
  - PAGE-management-permissions
  - PAGE-management-resetpermissions
  - VUE-user-access-manager
  - GRID-lib-pkp-grid-settings-roles-user-group-grid-handler
  - API-user-group-get-many
  - DB-user_groups
  - DB-user_group_settings
  - DB-user_group_stage
  - SCHEMA-user-group
  - AUTHZ-stage-role-policy
  - AUTHZ-role-based-handler-operation-policy
  - AUTHZ-user-roles-required-policy
  - AUTHZ-anonymous-user-policy
  - AUTHZ-user-required-policy
---

# Roles & permissions (user-group definitions + the AUTHZ framework)

## Purpose

Everything about *assigning a person to a role* lives in `user-management` and `user-invitations`. This feature is the
layer beneath: **what the roles themselves are**. A **journal manager** (or **site admin**) opens **Settings → Users &
Roles → Roles** and sees the journal's **user groups** — the named titles (Journal manager, Journal editor, Section
editor, Copyeditor, Author, Reviewer, Reader, Subscription Manager, …) that each map to one of six built-in **role
types** (manager, sub-editor, assistant, reviewer, author, reader). From that grid a manager **creates** a new custom
group, **edits** a group's name/abbreviation and its **permission toggles** (self-registration, publication-metadata
editing, recommend-only, settings access, masthead display), toggles which **workflow stages** the group works in, and
**deletes** a custom group. Separately, under **Tools → Permissions**, the manager can **reset** every article's
copyright/licence to the journal defaults.

This feature also **owns the AUTHZ policy framework** — the base authorization primitives (`UserRolesRequiredPolicy`,
`RoleBasedHandlerOperationPolicy`, `StageRolePolicy`, `AnonymousUserPolicy`, `UserRequiredPolicy`) that *every* handler
and every per-feature policy in the app builds on. The per-group permission toggles defined here are the flags that
dozens of other features **reference** (self-registration in `registration-login`/`user-profile`, metadata-edit in the
submission/publication features, recommend-only across the editorial workflow, masthead in `editorial-masthead`,
settings access everywhere a manager reaches Settings).

It does **not** own assigning users to these groups (`user-management` / `user-invitations` — you DEFINE the groups,
they populate `user_user_groups`), the self-service role-join UI (`user-profile`), or the individual per-feature
policies that *use* the framework (each feature owns its own `…Policy`).

**3.6 surface reality.** The **Roles** tab is a **legacy AJAX grid** (`UserGroupGridHandler`), loaded into the Vue
Settings shell via `{load_url_in_div}` — it is the **only** live surface for defining/editing role groups (there is no
Vue "roles manager" in 3.6). The sibling **Users** tab hosts the Vue `<user-access-manager>` (the user *list* shell,
claimed here) plus `<user-invitation-manager>`. The read-only **`GET /userGroups`** REST list is consumed widely across
the UI (pickers, forms), but its response is a **thin projection** — `UserGroupResource` returns only
`{id, roleId, isDefault, name}`. It does **not** surface any of the five permission toggles or the stage assignments
(`stageIds`/`roleIds` are *query filters*, not response fields), so a reader relying on `/userGroups` cannot observe a
group's permissions; toggle/stage persistence is read back through the group's own **edit form** (`initData` reloads the
stored values), which is the real read-back path. All live-probed 2026-07-05 on `:8000`.

## Actors & permissions

**Recurring terms.** A **user group** is a named title bound to exactly one **role type** (`roleId`); several groups
can share a role (e.g. "Journal manager", "Journal editor" and "Production editor" are all *manager*-role groups). A
**default group** (`isDefault`) is one installed from the registry when the journal was created; a **custom group** is
one a manager added. **Settings access** = a manager whose group carries `permitSettings` (see Rule 6); a manager
without it, and every non-manager, cannot open Users & Roles. Site-wide baseline: a **site admin** reaches every
management surface here; an **anonymous** visitor reaches none. Every "who may" below means **manager-with-settings-
access (this journal) or site admin** unless a row says otherwise.

| Action | Who may — and when |
|--------|--------------------|
| **View the Roles list / group definitions** | • Manager (settings access), site admin — the full Roles grid (create/edit/delete)<br>• Section editor, assistant, reviewer, author — may read the **`GET /userGroups`** list feed (a read-only list used by pickers/forms), but reach **no** Roles grid and cannot change definitions <sup>a</sup> |
| **Create a custom user group** | • Manager, site admin — pick a **role type** + name + abbreviation + toggles; the **Site Administrator** role cannot be created here <sup>b</sup> |
| **Edit a group** (name, abbrev, toggles, stages) | • Manager, site admin — the group's **role type is locked** after creation (the role select is disabled on edit) <sup>c</sup> |
| **Assign / unassign a workflow stage** | • Manager, site admin — per-stage on/off toggles in the grid; forbidden stages for a role show no toggle, and manager-role stages are always-on <sup>d</sup> |
| **Delete a group** | • Manager, site admin — only a **custom** group (not `isDefault`) with **no users** currently assigned; otherwise the delete is refused with a notice <sup>e</sup> |
| **Reset article permissions** (Tools → Permissions) | • Manager, site admin — resets **every submission's copyright/licence** to the journal defaults; ⚠ despite the "Permissions" label this does **not** reset role permissions — see Known deviations <sup>f</sup> |
| **(framework) Gate a handler by role / stage / login** | • Not a user action — the base AUTHZ policies (Rule 12) that every handler and per-feature policy composes <sup>g</sup> |

<sup>a</sup> `UserGroupGridHandler::__construct()` (`addRoleAssignment([ROLE_ID_MANAGER, ROLE_ID_SITE_ADMIN], …)`) + `authorize()` (`ContextAccessPolicy` + `CanAccessSettingsPolicy`); `UserGroupController::getGroupRoutes()` (`roleAuthorizer([SITE_ADMIN, MANAGER, SUB_EDITOR, ASSISTANT, REVIEWER, AUTHOR])`, read-only); live 2026-07-05: reviewer `jjanssen` roles-grid fetch → `status:false "The current role does not have access to this operation."`, but `GET /userGroups` → 200 ·
<sup>b</sup> `UserGroupForm::execute()` (new-group branch; `throw` when `roleId == ROLE_ID_SITE_ADMIN`); live: created "Data Curator" (author role) on a scratch journal ·
<sup>c</sup> `UserGroupForm::fetch()` (`disableRoleSelect = userGroupId > 0`); `getUserGroupId() == null` gates the `roleId` required-check; live: edit form for the new group showed the role select **disabled** ·
<sup>d</sup> `UserGroupGridHandler::assignStage()`/`unassignStage()` → `UserGroupStage::create()`/`delete()`; `UserGroupGridCellProvider` (renders a toggle only when the stage is not in `RoleDAO::getForbiddenStages($roleId)`); `RoleDAO::getAlwaysActiveStages()` = `[ROLE_ID_MANAGER]` ·
<sup>e</sup> `UserGroupGridHandler::removeUserGroup()` (blocks when `isDefault` → `cantRemoveDefaultUserGroup`; blocks when `userUserGroups()->count() > 0` → `cantRemoveUserGroup`; else `delete()`); live: custom empty group deleted; default "Author" group survived the delete attempt ·
<sup>f</sup> `PKPToolsHandler::__construct()` (`addRoleAssignment([MANAGER, SITE_ADMIN], ['tools','importexport','permissions'])`); `PKPToolsHandler::resetPermissions()` → `Repo::submission()->resetPermissions($contextId)`; `PKPTemplateManager` (`$menu['tools']` gated to `[MANAGER, SITE_ADMIN]`); live: Tools index rendered Import/Export + Permissions links ·
<sup>g</sup> `UserRolesRequiredPolicy`, `RoleBasedHandlerOperationPolicy`, `StageRolePolicy`, `AnonymousUserPolicy`, `UserRequiredPolicy` (Rule 12)

## Fields & validation

**Add / edit user-group form** (`UserGroupForm`, `userGroupForm.tpl`) — the modal opened from the Roles grid's **Add
Role** button (create) or a row's **Edit** action. Name and abbreviation are multilingual (the journal's supported
locales). Each permission toggle is **only offered — and only honoured — for the role types listed below**; toggling it
for any other role is silently dropped on save (the value is `&&`-gated against the role's allow-list in `execute()`).

| Field (UI label) | Required? | Rules | Anchor |
|------------------|-----------|-------|--------|
| **Role** (from) | Yes (create only) | One of the six context role types (Application role-name list — Site Administrator excluded). **Locked after creation** — cannot be changed on edit. | `UserGroupForm` (`roleId` required when `getUserGroupId()==null`; `disableRoleSelect` on edit); `Application::getRoleNames(true)` |
| **Name** | Yes | Multilingual; the title shown in the grid, pickers and (if masthead) the public masthead. | `UserGroupForm::__construct()` (`FormValidatorLocale name required`) |
| **Abbreviation** | Yes | Multilingual; short form. | `UserGroupForm::__construct()` (`FormValidatorLocale abbrev required`) |
| **Self-registration** (`permitSelfRegistration`) | No | Users may pick this group when registering. Offered/honoured only for **Reviewer, Author, Reader**. | `UserGroupForm::getPermitSelfRegistrationRoles()` = `[REVIEWER, AUTHOR, READER]` |
| **Can edit publication metadata** (`permitMetadataEdit`) | No | Grants assignees metadata-edit rights on assigned submissions. **Forced ON and non-editable for the Manager role**; freely toggled for every other non-manager role. | `UserGroupForm::execute()` (`NOT_CHANGE_METADATA_EDIT_PERMISSION_ROLES = [MANAGER]` → forced `true`) |
| **Recommend only** (`recommendOnly`) | No | Assignees of this group may only *recommend* an editorial decision, not take it. Offered only for **Manager, Section editor**. | `UserGroupForm::getRecommendOnlyRoles()` = `[MANAGER, SUB_EDITOR]` |
| **Permit settings access** (`permitSettings`) | No | This manager group may open Settings. Offered/honoured only for the **Manager** role. | `UserGroupForm::getPermitSettingsRoles()` = `[MANAGER]` |
| **Show on masthead** (`masthead`) | No | This group is eligible to appear on the public editorial masthead. Free boolean (any role). | `UserGroupForm::execute()` (`masthead = (bool) getData('masthead')`) |
| **Workflow stages** (`assignedStages[]`) | No | Which of Submission / Review / Copyediting / Production the group works in. Forbidden stages per role are dropped; manager-role groups are forced onto **all** stages. | `UserGroupForm::_assignStagesToUserGroup()` (`RoleDAO::getForbiddenStages`/`getAlwaysActiveStages`) |

> There is **no `showTitle` field** on a user group in 3.6 (the toggle list is exactly the five above). Masthead
> ordering/title display is `editorial-masthead`'s roster config, not a per-group flag.

## Rules & state

### The grid, the groups, create/edit/delete

1. **The Roles list = the user-group grid.** Settings → Users & Roles → **Roles** loads the legacy
   `UserGroupGridHandler` grid (into `#roleGridContainer` via `{load_url_in_div}`). Each row is one **user group**;
   columns are **Role name**, **From** (the mapped role type), then one column per workflow **stage** (Submission,
   Review, Copyediting, Production) rendered as a per-stage toggle. A grid-level **Add Role** action opens the create
   modal; each row carries **Edit** and **Remove** actions. Rows are paged and keyed by real group id (a fixed bug once
   made the first row lose its actions under 0-based keys). **Live-verified**: the grid rendered 18 rows with the role
   "From" column, 4 stage columns, and add/edit/remove + assign/unassign-stage actions. <sup>a</sup>
2. **The seeded groups + the six role types.** A fresh journal installs a default set of groups from the registry, each
   `isDefault`. On `publicknowledge` (18 groups): *Journal manager / Journal editor / Production editor* → **manager**
   (roleId 16); *Section editor / Guest editor* → **sub-editor** (17); *Copyeditor / Designer / Funding coordinator /
   Indexer / Layout Editor / Marketing and sales coordinator / Proofreader / Editorial Board Member* → **assistant**
   (4097); *Author / Translator* → **author** (65536); *Reviewer* → **reviewer** (4096); *Reader* → **reader**
   (1048576); *Subscription Manager* → **subscription manager** (2097152, OJS-only). ⚠ Note the naming trap: the
   "**Journal editor**" group is a **manager**-role group, not a sub-editor — a person in it passes manager-level gates.
   **Live-verified** via `GET /userGroups`. <sup>b</sup>
3. **Create a custom group.** **Add Role** opens the form: choose a **role type** (Site Administrator is rejected on
   save), enter multilingual **name** + **abbreviation**, set the **toggles** and **stages**, save. A new group is
   `isDefault = false`, `contextId` = the journal, and its toggles are stored after being filtered against the role's
   allow-lists (Rule 4). **Live-verified**: created "Data Curator" (author role) with self-registration + masthead on,
   metadata-edit off — it appeared in the list and the saved toggles re-loaded correctly. <sup>c</sup>
4. **The five per-group permission toggles — what each gates.** Each is stored on the group and honoured **only** for
   the role types below; for any other role the checkbox is ignored on save (`&&`-gated in `execute()`):
   - **`permitSelfRegistration`** (Reviewer / Author / Reader) — the group appears as a self-selectable role on the
     public **registration** form and on the self-service **role-join** UI. *(Consumed by `registration-login`,
     `user-profile`.)*
   - **`permitMetadataEdit`** (every non-manager role; **forced true** for Manager) — assignees of this group may edit
     the **publication metadata** of submissions they're assigned to. When this flag changes on an existing group, the
     change is **propagated** to that group's existing **stage assignments** (`canChangeMetadata`). *(Consumed by the
     submission/publication metadata features.)*
   - **`recommendOnly`** (Manager / Section editor) — the group's editors may only **recommend** a decision, not record
     it. The flag seeds each new stage assignment's `recommendOnly`, which `StageRolePolicy` enforces (Rule 12).
     *(Consumed across the editorial-decision workflow.)*
   - **`permitSettings`** (Manager only) — a manager in this group may open **Settings**; `CanAccessSettingsPolicy`
     permits only when the user has a **manager** group with `permitSettings` set. A manager whose only manager group
     has it off is locked out of Settings entirely (including this page).
   - **`masthead`** (any role) — the group is **eligible** for the public editorial masthead; the actual roster/order
     is `editorial-masthead`, and a user's individual display bit is `user-management`'s masthead toggle.
   **Live-verified**: the create-form handler advertised exactly `selfRegistrationRoleIds:[4096,65536,1048576]`,
   `permitSettingsRoleIds:[16]`, `recommendOnlyRoleIds:[16,17]`. <sup>d</sup>
5. **Edit a group — role locked, metadata-edit propagates.** Editing loads the same form on an existing group with the
   **role select disabled** (the role type can never change post-creation). Name/abbrev/toggles/stages are all editable
   (subject to the role allow-lists). If **`permitMetadataEdit`** is flipped, every existing `stage_assignments` row for
   the group is updated so assignees immediately gain/lose metadata-edit rights on in-flight submissions. A successful
   save flashes a trivial success notice and fires a `userGroupUpdated` event to refresh the grid. **Live-verified**:
   edit form role select disabled; toggles round-tripped. <sup>e</sup>
6. **Settings access is itself a per-group permission.** The whole Users & Roles page (and every Settings page) is gated
   by `CanAccessSettingsPolicy`, which walks the user's **manager** groups and permits only if one has `permitSettings`.
   This is the mechanism behind "manager with settings access" cited throughout the sibling specs. The create/edit form
   guards against self-lockout: it passes the current user's settings-bearing group ids to the client so a manager
   **cannot disable the only `permitSettings` group they belong to**. <sup>f</sup>
7. **Delete a group — custom + empty only.** **Remove** (CSRF-checked) deletes a group **only** when it is **not**
   `isDefault` **and** has **zero** currently-assigned users; a default group yields a "can't remove default" warning
   and an in-use group yields a "N users still assigned" warning (neither deletes). Deleting a stage-bearing custom
   group also drops its `user_group_stage` rows (cascade). **Live-verified**: an empty custom group deleted; the default
   "Author" group survived a delete attempt. <sup>g</sup>

### Stage assignments

8. **Which stages a group works in, and the per-role guard-rails.** A group's **stage assignments** (`user_group_stage`)
   decide which workflow stages it participates in. They are set two ways — the form's `assignedStages[]` checkboxes (on
   create/edit) and the grid's per-cell **assign/unassign** toggles — both routed through the same guard-rails in
   `RoleDAO`:
   - **Manager** role → **always all stages** (`getAlwaysActiveStages`); the checkboxes/toggles are locked on and any
     submitted selection is overridden to the full set.
   - **Reviewer** → only the **review** stage (submission/copyediting/production are forbidden).
   - **Reader** → **no** stages (all forbidden).
   - Author / Assistant / Section editor → freely assignable across stages.
   Forbidden stages render **no toggle** in the grid and are dropped on form save, so a manager can't put a role where it
   doesn't belong. **Live-verified**: the grid showed assign links only on allowed stage cells (53 assign / 25 unassign
   toggles across the 18 rows). <sup>h</sup>

### The reset-permissions tool

9. **"Permissions" resets *article* copyright/licence, not role permissions.** Under **Tools → Permissions** (a
   manager/admin-gated page linked from the Tools index) a single **Reset Article Permissions** button — with a
   confirm prompt — POSTs to `management/tools/resetPermissions`, which calls
   `Repo::submission()->resetPermissions($contextId)`: for **every** submission in the journal it rewrites each
   publication's **copyright year**, **copyright holder** and **licence URL** to the **journal defaults**. It touches
   **no** user group, role, or per-group toggle. ⚠ The tool's "Permissions"/"reset permissions" naming reads like a
   role-permission reset but is a bulk **licence** operation — flagged so a reader doesn't confuse the two (Known
   deviations / Open questions). **Live-verified**: the Tools index links "Permissions"; the tool page carries the
   `resetPermissionsForm`; the reset method resets copyright/licence fields. <sup>i</sup>

### The AUTHZ policy framework

10. **Every handler declares role→operation assignments.** A page/grid/controller declares, via `addRoleAssignment(
    [roleIds], [operations])`, which role types may run which operations; the framework's role policy consults the
    user's authorized roles and, on a match, calls `markRoleAssignmentsChecked()` to release the request. This is the
    baseline gate on essentially every backend surface (the Roles grid itself uses `[MANAGER, SITE_ADMIN]`).
    <sup>j</sup>
11. **The user's roles are assembled once, up front.** `UserRolesRequiredPolicy` loads the user's **active** group
    memberships for the current context (+ the site context), derives the set of **role ids**, and stashes both the
    role-id list (`ASSOC_TYPE_USER_ROLES`) and the `UserGroup` objects (`ASSOC_TYPE_USER_GROUP`) on the request. It
    **permits even when the user has no roles** (it is a *builder*, not a gate) — later policies read what it stashed.
    <sup>k</sup>
12. **The five base policies — the primitives per-feature policies compose.** All live in
    `classes/security/authorization/` and are the building blocks every feature-specific policy layers on:
    - **`RoleBasedHandlerOperationPolicy`** — the workhorse role gate: permit if the user holds **any** of a set of
      roles (or **all**, with `allRoles=true`) for the listed operations, else deny `roleBasedAccessDenied`.
    - **`StageRolePolicy`** — permit if the user holds one of the required roles **on a specific submission stage**;
      optionally deny **recommend-only** assignments (`allowRecommendOnly=false`); a **manager not otherwise assigned**
      to the submission is granted (the "manager sees everything" fallback). This is where the group-level
      **`recommendOnly`** flag (via each assignment's `recommendOnly`) actually bites.
    - **`AnonymousUserPolicy`** — permit only when **no** user session is present (deny if logged in); the "must be
      anonymous" gate (its sole live consumer is the new-invitee accept flow in `user-invitations`).
    - **`UserRequiredPolicy`** — the mirror: permit only when a user **is** logged in (the base "must be a signed-in
      context user" gate — used by the profile handler and the invitation receive flow).
    - **The base-vs-override lesson.** A per-feature policy (e.g. `PublicationWritePolicy` composes `StageRolePolicy`;
      `SubmissionFileAccessPolicy` composes `AssignedStageRoleHandlerOperationPolicy`) sets its **baseline** from these
      primitives and then **overrides** with feature specifics. When a feature's access looks surprisingly permissive or
      strict, check the **base** policy first — the framework's role/stage/manager-fallback rule is usually doing the
      work, and the feature policy only trims it. Document the base rule **once** (here) and let feature specs describe
      only their delta. <sup>l</sup>

<sup>a</sup> `access.tpl` (Roles tab → `{load_url_in_div component=grid.settings.roles.UserGroupGridHandler op=fetchGrid}`); `UserGroupGridHandler::initialize()` (columns: `settings.roles.roleName`, `settings.roles.from`, one `selectStatusCell` per stage) + `loadData()` (`keyBy('user_group_id')`); live grid render (18 rows) ·
<sup>b</sup> `Repository::installSettings()` (registry XML → `isDefault=true` groups); `registry/userGroups.xml`; `Role.php` role constants; live `GET /userGroups` (18 groups, roleIds as listed) ·
<sup>c</sup> `UserGroupGridHandler::addUserGroup()`→`editUserGroup()`/`updateUserGroup()`; `UserGroupForm::execute()` (new branch: `isDefault=false`, toggle allow-list gating, `save()`); live create "Data Curator" ·
<sup>d</sup> `UserGroupForm::getPermitSelfRegistrationRoles()`/`getRecommendOnlyRoles()`/`getPermitSettingsRoles()`; `Repository::NOT_CHANGE_METADATA_EDIT_PERMISSION_ROLES`; `CanAccessSettingsPolicy::effect()` (`roleId==MANAGER && permitSettings`); `UserFormHelper` (self-reg role options); `UserGroupForm::execute()` (metadata-edit → `StageAssignment::canChangeMetadata` propagation); live form-handler role-id lists ·
<sup>e</sup> `UserGroupForm::fetch()` (`disableRoleSelect = userGroupId>0`); `UserGroupForm::execute()` (edit branch; `permitMetadataEdit` change → loop `StageAssignment->save()`); `UserGroupGridHandler::updateUserGroup()` (`setGlobalEvent('userGroupUpdated')`); live disabled role select ·
<sup>f</sup> `CanAccessSettingsPolicy::effect()` (manager group with `permitSettings`); `UserGroupForm::initData()` (`mySettingsAccessUserGroupIds` self-lockout guard); `ManagementHandler::authorize()` (`CanAccessSettingsPolicy` on the `settings` op) ·
<sup>g</sup> `UserGroupGridHandler::removeUserGroup()` (`checkCSRF`; `isDefault`→`cantRemoveDefaultUserGroup`; `userUserGroups()->count()>0`→`cantRemoveUserGroup`; else `delete()`); live delete + blocked-default ·
<sup>h</sup> `UserGroupForm::_assignStagesToUserGroup()` (`getForbiddenStages($roleId)` skip; `getAlwaysActiveStages` → all stages); `UserGroupGridHandler::_toggleAssignment()` (`UserGroupStage::create`/`delete`); `RoleDAO::getForbiddenStages()` (manager=all, reviewer=non-review, reader=all) / `getAlwaysActiveStages()`=`[MANAGER]`; `UserGroupGridCellProvider` (toggle only when not forbidden); live 53/25 toggles ·
<sup>i</sup> `PKPToolsHandler::permissions()` (`fetchJson('management/tools/permissions.tpl')`)/`resetPermissions()` (`Repo::submission()->resetPermissions`); `submission/Repository::resetPermissions()` (copyrightYear/copyrightHolder/licenseUrl → context defaults, per publication); `management/tools/index.tpl` (Permissions link); live Tools index + reset form ·
<sup>j</sup> `PKPHandler::addRoleAssignment()`; `RoleBasedHandlerOperationPolicy::effect()` (`markRoleAssignmentsChecked()`); `UserGroupGridHandler::__construct()` (`[MANAGER, SITE_ADMIN]`) ·
<sup>k</sup> `UserRolesRequiredPolicy::effect()` (active `UserGroup` memberships → `ASSOC_TYPE_USER_ROLES` + `ASSOC_TYPE_USER_GROUP`; permits with no roles) ·
<sup>l</sup> `RoleBasedHandlerOperationPolicy` (any/all-of role check, `roleBasedAccessDenied`), `StageRolePolicy` (stage role + `allowRecommendOnly` + manager fallback), `AnonymousUserPolicy` (deny-if-session), `UserRequiredPolicy` (deny-if-anonymous); consumers: `PublicationWritePolicy` (StageRolePolicy), `SubmissionFileAccessPolicy` (AssignedStageRoleHandlerOperationPolicy), `UserRoleAssignmentReceiveController` (Anonymous/UserRequired)

## Side effects

- **`user_groups` row** — create inserts one (`context_id`, `role_id`, `is_default=false`, the five permission
  columns); edit rewrites its columns; delete removes it (custom + unused only).
- **`user_group_settings`** — the multilingual **name** / **abbreviation** (and the `nameLocaleKey`/`abbrevLocaleKey`
  for default groups); rewritten on every save.
- **`user_group_stage`** — the group's stage assignments; rewritten wholesale on form save (delete-then-insert filtered
  by the role guard-rails) and toggled per-cell by the grid assign/unassign ops; cascade-deleted with the group.
- **`stage_assignments`** (owned by the workflow) — **flipping `permitMetadataEdit`** on an existing group updates the
  `can_change_metadata` bit on every current assignment of that group, changing who can edit in-flight metadata.
- **Publications** (owned by the submission/publication features) — the **reset-permissions** tool rewrites
  copyright/licence fields on **every** publication of **every** submission in the journal.
- **In-app notifications only** — create/edit/delete/stage-toggle and the reset each raise a trivial success (or a
  warning on a blocked delete) notification to the acting manager. **No emails**, **no event-log entries**, and **no
  notification objects** are produced by role/group management. **Editorial masthead cache** is cleared when a
  masthead-eligible group's membership changes (via the `user-management`/`editorial-masthead` paths, not the group
  edit itself).

## Settings that modify behavior

- **Journal supported/primary locales** — which locales the name/abbrev fields require and accept.
- **Enabled workflow stages** — which stage columns appear in the grid and which `assignedStages` are offered (a journal
  with internal review disabled shows Submission / Review / Copyediting / Production, as on `publicknowledge`).
- **The registry `userGroups.xml`** — the default group set (names, role mappings, default toggles and stages) installed
  when a journal is created; the source of the `isDefault` groups a manager sees on day one.
- **`config.inc.php` role/security** — none specific to this feature; the AUTHZ policies read live request/session state.
- **The reset tool has no configurable behaviour** — it always resets to the journal's **default** copyright/licence
  fields (configured under `distribution-settings`).

## Cross-feature interactions

- **user-management** (feature 50) — **assigns** users to the groups defined here (`user_user_groups`), renders the
  Vue `<user-access-manager>` **list** (the shell atom is claimed here; the list *behaviour* and row actions are theirs),
  and owns the per-user masthead-display toggle. Seam: you DEFINE groups + their `masthead`/`permitSettings` flags; they
  populate memberships.
- **user-invitations** (feature 51) — **invites** users into the groups defined here; its new-invitee accept gate is the
  sole live consumer of the framework's **`AnonymousUserPolicy`** (reassigned here). It noted the row-115 escalation
  (editor/assistant can invite into *any* group, including a manager group) — an **inviter-authority** gap in *their*
  flow, referenced not owned here.
- **registration-login** (feature 47) / **user-profile** (feature 49) — the **`permitSelfRegistration`** flag defined
  here is what makes a group appear as a self-selectable role on the registration form (47) and the self-service
  role-join UI (49). `UserRequiredPolicy` (reassigned here) is the profile handler's core gate.
- **editorial-masthead** — owns the masthead **roster/order** and reads the group **`masthead`** eligibility flag
  defined here.
- **submission-wizard-metadata / publication / editorial-decisions and many workflow features** — **reference** the
  per-group flags this feature defines: **`permitMetadataEdit`** (who can edit publication metadata) and
  **`recommendOnly`** (editors who may only recommend). They own the *use*; you own the *definition*.
- **site-access-restrictions** (Area 5) — owns the **Site Access Options** tab's toggles (`restrictSiteAccess`,
  `disableUserReg`, `restrictArticleAccess`) that render on this feature's access page; the two access-form atoms are
  **reassigned** to it (see atom notes). This feature owns the page shell; it owns the toggle semantics.
- **every feature with a `…Policy`** — composes the **base policies** owned here; each feature spec documents only its
  policy's delta over the framework baseline.

## Canonical scenarios

1. **Browse the Roles list** — A manager opens Settings → Users & Roles → **Roles** and sees the journal's user groups,
   each showing its **role type** ("From" column) and which **workflow stages** it works in; a grid **Add Role** button
   plus per-row **Edit**/**Remove** actions are present. (Live-verified: 18-row grid with role + 4 stage columns.)
2. **Create a custom user group** — A manager clicks **Add Role**, picks a role type (e.g. Author), enters a
   name/abbreviation, sets toggles, and saves; the new group appears in the list as a non-default group. (Live-verified:
   "Data Curator" created on a scratch journal.)
3. **Self-registration toggle** — A manager turns **Self-registration** on for a Reviewer/Author/Reader group; that
   group then appears as a self-selectable role on the public registration form. The toggle is absent for editor/
   assistant roles. (Verified from the role allow-list; live: `selfRegistrationRoleIds:[4096,65536,1048576]`.)
4. **Recommend-only editors** — A manager enables **Recommend only** on a Section-editor group; assignees of that group
   can only *recommend* editorial decisions, not record them (enforced by `StageRolePolicy`). The toggle is offered only
   for manager/section-editor roles. (Verified from `getRecommendOnlyRoles` + StageRolePolicy.)
5. **Metadata-edit toggle propagates** — A manager turns **Can edit publication metadata** off for an assistant group;
   assignees immediately lose metadata-edit rights on their in-flight submissions (the change rewrites existing stage
   assignments). The flag is forced on and greyed out for the Manager role. (Verified from `execute()` propagation +
   `NOT_CHANGE_METADATA_EDIT_PERMISSION_ROLES`.)
6. **Stage assignments + guard-rails** — A manager toggles which stages an Author group works in; a **Reviewer** group
   can only be put on the **Review** stage and a **Manager** group is locked onto **all** stages. (Live-verified: grid
   renders toggles only on allowed stage cells.)
7. **Edit a group — role locked** — A manager edits a group's name and toggles; the **role type select is disabled** —
   the mapping can never change after creation. (Live-verified: edit form role select disabled.)
8. **Delete a group** — A manager removes a **custom, unused** group and it disappears; attempting to delete a
   **default** group (or one with users assigned) is refused with a notice. (Live-verified: custom delete succeeded;
   default "Author" survived.)
9. **Settings-access permission** — Only a manager whose group carries **Permit settings access** can open Users & Roles
   (and Settings at large); the form stops a manager from disabling the *only* settings group they belong to.
   (Verified from `CanAccessSettingsPolicy` + the `mySettingsAccessUserGroupIds` self-lockout guard.)
10. **Reset article permissions** — Under Tools → **Permissions**, a manager confirms **Reset Article Permissions**;
    every article's copyright/licence is reset to the journal defaults. This does **not** touch roles. (Live-verified:
    tool present + gated to manager/admin; resets copyright/licence fields.)
11. **The AUTHZ role gate (base policy)** — A handler declares its allowed roles; the framework builds the user's roles
    (`UserRolesRequiredPolicy`) and a role/stage policy permits or denies. A per-feature policy composes these
    primitives and overrides only its specifics. (Verified from the base-policy sources.)
12. **Permission boundary** — A **reviewer** hitting the Roles grid is refused ("the current role does not have access to
    this operation"); a **manager/site admin** is allowed. The read-only **`GET /userGroups`** list is deliberately wider
    (also section editor / assistant / reviewer / author). (Live-verified: reviewer grid `status:false`, `GET
    /userGroups` → 200; manager grid full render.)

## Known deviations (as-built ≠ intent)

- ⚠ **The "Permissions" tool resets article licences, not role permissions** (destructive + misleading label, MEDIUM —
  [app-changes.md §2 row 116](../../e2e/app-changes.md)). The Tools → **Permissions** page and its **Reset Permissions**
  button (`manager.setup.resetPermissions*`) read as a role/permission reset, but the action is
  `Repo::submission()->resetPermissions()`, which bulk-rewrites **every publication's copyright/licence** to the journal
  defaults. The copyright-reset behaviour itself is legitimate and intended; the deviation is that its **label collides**
  with "Users & **Roles**" — the feature-map even framed it as "reset role permissions to defaults" (WRONG) — so a
  manager (or a QA author reading this atlas) can, past a single confirm dialog, irreversibly overwrite bespoke
  per-article copyright/licence across the whole journal while expecting a role reset. Rated MEDIUM (destructive **and**
  a UI-affordance/behaviour mismatch), not because the action is a bug — it is the intended bulk-licence reset, just
  badly named. **Live-verified**: the reset method touches only copyright/licence fields, no user-group code path exists
  (retained `roles-permissions.spec.js` scenario 10 proves the article reset while the role matrix survives). Suspected
  intent: rename the tool to "Reset article permissions/licences" to disambiguate from role management.
- **Observation (not ⚠): the user-group schema's `roleId` validation is unreachable and has a truncated value.**
  `userGroup.json` validates `roleId` with `in:16,1,17,65536,4096,4097,1048576,209715` — the last entry `209715` is a
  truncated **`2097152`** (Subscription Manager), so this list would *reject* a subscription-manager group even though
  one is seeded and live. But `Repository::validate()` (the only consumer of that rule) is **not called by any reachable
  3.6 path** — the live create/edit surface is the grid `UserGroupForm`, which validates `roleId` only as *required* and
  never runs the schema rule. So the typo is **dead validation**, not a live defect. Recorded as an Open question rather
  than a ⚠ (nothing user-reachable trips it).

## Open questions

1. **Should the "Permissions" tool be renamed?** As-built it resets **article copyright/licence** for all submissions,
   not role permissions — confirm whether the label should change to avoid the collision with "Users & **Roles**".
2. **Is the dead `userGroup.json` `roleId` validation (with the truncated `209715` → `2097152`) meant to be live?**
   Nothing reachable calls `Repository::validate()` for user groups in 3.6. Confirm whether a create-via-API path is
   planned (in which case the truncated Subscription-Manager id is a real bug) or the schema rule should be dropped.
3. **AUTHZ-framework ownership.** This spec claims the five base policies (`StageRolePolicy`,
   `RoleBasedHandlerOperationPolicy`, `UserRolesRequiredPolicy`, plus the reassigned `AnonymousUserPolicy` /
   `UserRequiredPolicy`). Confirm the framework-owner placement, and that per-feature policies (`PublicationWritePolicy`,
   `SubmissionFileAccessPolicy`, `AssignedStageRoleHandlerOperationPolicy`, …) stay with their features.
4. **Access-form atom reassignment.** The two Site-Access-Options form atoms (`FORM-user-access-form`,
   `FORM-pkp-user-access-form`) are reassigned from here to **site-access-restrictions** (the toggle owner). Confirm the
   split — this feature owns the access *page shell*, that feature owns the `restrictSiteAccess`/`disableUserReg`/
   `restrictArticleAccess` semantics.
5. **Is "Journal editor" intended to be a manager-role group?** The seeded "Journal editor" group maps to
   **ROLE_ID_MANAGER**, not sub-editor — a naming that already tripped the test harness (users.md caveat). Confirm this
   is the intended default and not a mislabel.

---

## Reference — entry points & surfaces

| Entry | Path | Atom |
|-------|------|------|
| Users & Roles page (Roles tab) | `…/management/settings/access` → `ManagementHandler::access` → `access.tpl` (Roles tab) | PAGE-management-settings-access |
| User-group grid (list/create/edit/delete/stage) | `…/$$$call$$$/grid/settings/roles/user-group-grid/<op>` (`fetch-grid`, `add-user-group`, `edit-user-group`, `update-user-group`, `remove-user-group`, `assign-stage`, `unassign-stage`) | GRID-lib-pkp-grid-settings-roles-user-group-grid-handler |
| User-group list (REST, read-only) | `GET api/v1/userGroups` (query filters `roleIds`/`stageIds`; response is the thin `UserGroupResource` = `{id, roleId, isDefault, name}` — no toggles/stages) | API-user-group-get-many |
| Users tab list shell (Vue) | Users & Roles → Users → `<user-access-manager>` (feeds `GET /users`) | VUE-user-access-manager |
| Permissions tool page | `…/management/tools/permissions` → `PKPToolsHandler::permissions` → `permissions.tpl` | PAGE-management-permissions |
| Reset article permissions (POST) | `…/management/tools/resetPermissions` → `PKPToolsHandler::resetPermissions` | PAGE-management-resetpermissions |
| User-group entity/schema | `user_groups` (+ `user_group_settings`, `user_group_stage`); `schemas/userGroup.json` | DB-user_groups, DB-user_group_settings, DB-user_group_stage, SCHEMA-user-group |
| Base AUTHZ policies | `classes/security/authorization/{StageRolePolicy,RoleBasedHandlerOperationPolicy,UserRolesRequiredPolicy,AnonymousUserPolicy,UserRequiredPolicy}.php` | AUTHZ-stage-role-policy, AUTHZ-role-based-handler-operation-policy, AUTHZ-user-roles-required-policy, AUTHZ-anonymous-user-policy, AUTHZ-user-required-policy |

## Reference — code anchors

- **Roles grid**: `lib/pkp/controllers/grid/settings/roles/UserGroupGridHandler.php` (`__construct` role gate
  `[MANAGER, SITE_ADMIN]`, `authorize` = `ContextAccessPolicy`+`CanAccessSettingsPolicy`, `loadData` `keyBy(user_group_id)`,
  `removeUserGroup`, `assignStage`/`unassignStage`→`_toggleAssignment`); `UserGroupGridCellProvider.php` (role-name +
  per-stage toggle, forbidden-stage suppression); `UserGroupGridRow.php`.
- **Form**: `lib/pkp/controllers/grid/settings/roles/form/UserGroupForm.php` (`initData`/`readInputData`/`fetch`/
  `execute`; `getPermitSelfRegistrationRoles`/`getPermitSettingsRoles`/`getRecommendOnlyRoles`;
  `_assignStagesToUserGroup`; `disableRoleSelect`; metadata-edit→stage-assignment propagation);
  `templates/controllers/grid/settings/roles/form/userGroupForm.tpl`.
- **Entity + repo**: `lib/pkp/classes/userGroup/UserGroup.php`, `lib/pkp/classes/userGroup/Repository.php`
  (`NOT_CHANGE_METADATA_EDIT_PERMISSION_ROLES`, `installSettings` from registry XML, `assignUserToGroup`,
  `getAssignedStagesByUserGroupId`, masthead-cache clearing); `lib/pkp/classes/userGroup/relationships/UserGroupStage.php`;
  `lib/pkp/schemas/userGroup.json`.
- **REST list**: `lib/pkp/api/v1/userGroups/UserGroupController.php` (`getMany`; route group `[SITE_ADMIN, MANAGER,
  SUB_EDITOR, ASSISTANT, REVIEWER, AUTHOR]`, `UserRolesRequiredPolicy`+`ContextAccessPolicy`).
- **Roles/stages helper**: `lib/pkp/classes/security/RoleDAO.php` (`getForbiddenStages`, `getAlwaysActiveStages`);
  `lib/pkp/classes/security/Role.php` (role constants); `Application::getRoleNames()`; `registry/userGroups.xml`.
- **Access page + tools**: `lib/pkp/pages/management/ManagementHandler.php` (`authorize` settings gate, `access` — Users
  & Roles page, tabs Users/Roles/Notify/Access/ORCID); `lib/pkp/pages/management/PKPToolsHandler.php` (`permissions`,
  `resetPermissions`); `lib/pkp/templates/management/{access.tpl,accessUsers.tpl,tools/index.tpl,tools/permissions.tpl}`;
  `lib/pkp/classes/submission/Repository.php::resetPermissions()`.
- **AUTHZ framework**: `lib/pkp/classes/security/authorization/StageRolePolicy.php`,
  `RoleBasedHandlerOperationPolicy.php`, `UserRolesRequiredPolicy.php`, `AnonymousUserPolicy.php`,
  `UserRequiredPolicy.php`, `CanAccessSettingsPolicy.php`; `PKPHandler::addRoleAssignment()` /
  `markRoleAssignmentsChecked()`.
- **Vue (Users list shell)**: `lib/ui-library/src/managers/UserAccessManager/UserAccessManager.vue` +
  `UserAccessManagerStore.js` (the shell atom; list behaviour is `user-management`).
- **Liveness note**: probed 2026-07-05 against `:8000` (`ojs_test`, PostgreSQL). **Read** on `publicknowledge` as
  manager **dbarnes** (session auth): the **Roles grid** rendered live (18 rows, role "From" column + Submission/Review/
  Copyediting/Production stage columns, Add-Role + per-row Edit/Remove + 53 assign / 25 unassign stage toggles);
  `GET /userGroups` returned the 18 seeded groups with role mappings; the **Tools index** rendered Import/Export +
  Permissions links; the "Tools" menu is gated to `[MANAGER, SITE_ADMIN]`. **Mutations** driven on a **throwaway scratch
  journal** (`j-rpprobe`, id 2, via `/api/v1/_test/scenarios/journal`) as **admin** (site admin manages any journal):
  **create** ("Data Curator", author role, self-reg + masthead on, metadata-edit off) → group id 38 created, event
  `userGroupUpdated`; the edit form re-loaded the saved toggles exactly and showed the **role select disabled**;
  **delete** of the custom empty group → removed; **delete** of the default "Author" group (id 32) → **blocked** (group
  survived). The create-form handler advertised `selfRegistrationRoleIds:[4096,65536,1048576]`, `permitSettingsRoleIds:
  [16]`, `recommendOnlyRoleIds:[16,17]`. **Permission boundary**: reviewer **jjanssen** roles-grid fetch → `status:false
  "The current role does not have access to this operation."`, while `GET /userGroups` → **200** (broad read); manager
  grid fetch → full 127 KB render. Scratch journal `j-rpprobe` remains (isolated from `publicknowledge`); the "Data
  Curator" group was deleted after the probe.
