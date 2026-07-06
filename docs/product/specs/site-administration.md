---
name: site-administration
scope: The site administrator's management of the journals hosted on the installation — the Administration index, the Hosted Journals grid (create / edit / reorder / delete / enable), the per-journal Settings Wizard, and multi-journal navigation (site index listing + the backend journal switcher)
shared: pkp-lib   # AdminHandler, ContextGridHandler, PKPContextForm, the /contexts API and PKPContextService live in lib/pkp; OJS contributes ContextForm (abbreviation + enabled), ContextService's journal cascades (sections/issues/subscriptions/submissions/tombstones) and JournalDAO
status: verified
e2e-plans: [site-administration]
atlas-claims:
  - PAGE-admin-index
  - PAGE-admin-contexts
  - PAGE-admin-wizard
  - GRID-lib-pkp-grid-admin-context-context-grid-handler
  - VUE-add-context-form
  - FORM-context-form
  - FORM-pkp-context-form
  - DB-journals
  - API-context-get-many
  - API-context-get
  - API-context-add
  - API-context-edit
  - API-context-delete
---

# Site administration (hosted journals)

## Purpose

An OJS installation hosts one or more journals, and only the **site administrator**
decides which journals exist. From the user menu's **Administration** entry (site
admins only) the admin lands on the Administration index — a panel page linking to
**Hosted Journals** and Site Settings plus a set of system-maintenance actions — and
from **Hosted Journals** manages the journal roster: create a journal (a modal form
that provisions a fully working journal and drops the admin into its **Settings
Wizard**), edit its identity/path/visibility, drag-reorder how journals appear on the
installation's front page, and permanently delete a journal with everything in it.
This spec owns the journal-roster lifecycle and the multi-journal navigation it feeds
(the public site index list and the backend journal switcher); the Site Settings forms
on the neighboring page belong to `site-settings`, and the system-maintenance panels on
the same index belong to `site-maintenance`.

## Actors & permissions

Only two actors matter: the **site administrator** (everything below) and **everyone
else** (no access to any Administration page — the entire `admin` area is
admin-only and additionally refuses any URL that carries a journal path; it also sits
behind the optional re-confirm-password gate owned by `login-as`). Journal managers
manage their own journal's *settings* (other specs) but never the roster; their one
API-only leak into admin-only journal properties is ledger row 118 (Known deviations).

| Action | Who may — and when |
|--------|--------------------|
| **Open Administration** (index, Hosted Journals, Settings Wizard) | • Site admin — user menu / left-nav "Administration", only with no journal in the URL<br>• Everyone else, incl. journal managers — refused ("The current role does not have access to this operation."; the nav entry never renders for them) <sup>a</sup> |
| **Create a journal** | • Site admin — "Create Journal" on the Hosted Journals grid (modal form) <sup>b</sup> |
| **Edit a journal's identity / path / Enable flag** | • Site admin — grid row → Edit (modal) or Settings Wizard → Journal form; changes apply immediately<br>• ⚠ Journal managers — no UI control anywhere, but the journal-scoped API accepts any admin-only property from them (`enabled`, `seq`, `urlPath` — row 118, API-only) <sup>c</sup> |
| **Reorder journals** (front-page order) | • Site admin — grid "Order" mode, drag rows, Done <sup>d</sup> |
| **Delete a journal** | • Site admin — grid row → Remove, after a confirmation naming the journal; permanent <sup>e</sup> |
| **Switch between journals** (backend header "Journals" button) | • Site admin — sees every hosted journal, enabled or disabled, except the current one<br>• Any other backend user — sees the journals where they hold an active role: enabled ones for any role, disabled ones only where they are a manager; the button disappears when there is nothing to switch to <sup>f</sup> |
| **List / read journals via the site-level API** | • Site admin only — despite a nominal manager allowance on the route group, managers are refused on every site-level `contexts` call (even the enabled-only list); the journal-scoped twin serves them their own journal (settings specs) <sup>g</sup> |

<sup>a</sup> `AdminHandler::__construct()` (all ops `ROLE_ID_SITE_ADMIN`), `AdminHandler::authorize()` (`PKPSiteAccessPolicy`, `return false` when `$request->getContext()`, `ReauthenticationRequiredPolicy` — owned by `login-as`); `PKPTemplateManager::setupBackendPage()` (`$menu['admin']` only for site admins) · live 2026-07-06: manager `dbarnes` → `roleBasedAccessDenied` on `admin/contexts` AND `admin/wizard/3` ·
<sup>b</sup> `ContextGridHandler::createContext()/editContext()`; `PKPContextController::getGroupRoutes()` (`POST contexts` in the SITE_ADMIN-only group) · live: manager POST → 401 ·
<sup>c</sup> `ContextGridHandler::editContext()` (modal posts to the journal-scoped `PUT contexts/{id}`); `AdminHandler::wizard()` (APP `ContextForm`); ledger row 118 (`PKPContextController::edit()` — no per-field authority check) ·
<sup>d</sup> `ContextGridHandler::initFeatures()` (`OrderGridItemsFeature`) / `saveSequence()` → `setDataElementSequence()` ·
<sup>e</sup> `ContextGridRow::initialize()` (`RemoteActionConfirmationModal`, `admin.contexts.confirmDelete`); `ContextGridHandler::deleteContext()` (CSRF-checked); `DELETE contexts/{id}` (SITE_ADMIN-only route group) · live: manager DELETE → 401 ·
<sup>f</sup> `PKPTemplateManager::setupBackendPage()` (context-switcher block: `$isAdmin ? [] : ['userId' => …]`); `PKPContextQueryBuilder::getQuery()` (user filter: `role_id = MANAGER OR enabled = 1`, active date-bounded `user_user_groups`) · live 2026-07-06: all four states driven (admin sees disabled journal; dbarnes sees managed-disabled `adm7`; dbarnes with one journal → no button) ·
<sup>g</sup> `PKPContextController::authorize()` (`CanAccessSettingsPolicy` — at site level only an admin passes) · live: `dbarnes` GET/GET?isEnabled=1/POST/DELETE on `/index/api/v1/contexts` → all 401; GET `/publicknowledge/api/v1/contexts/1` → 200 ·

## Fields & validation

The **Create Journal** modal and the **Edit** modal/wizard *Journal* form are the same
form (create adds the language block; edit shows current values). Multilingual fields
offer one entry per form language. "Required" marks are client-side; the server-side
required contract is broken at creation (⚠ row 120, rule 5).

| Field (UI label) | Required? | Rules | Anchor |
|------------------|-----------|-------|--------|
| Journal title | Yes | Text, per language (primary locale enforced in-browser). | `PKPContextForm` (`name`); schema-required |
| Journal initials | Yes (client-side only) | Text, per language. Schema-optional — the same acronym gap as ledger row 119. | `PKPContextForm` (`acronym`) |
| Journal Abbreviation | No | Text, per language (OJS-added field). | APP `ContextForm` (`abbreviation`) |
| Principal Contact Name / Email | Yes | Plain text / email format. Not per-language. | `PKPContextForm` (`contactName`, `contactEmail`); `context.json` (`email_or_localhost`) |
| Country | No (per the UI) | Select of real countries with **no blank entry**. ⚠ Leaving it untouched blocks creation with "Country: This is not a valid string." — and once picked it can never be un-set (row 153). | `PKPContextForm` (`country`); `context.json` (`country`, no `nullable`) |
| Journal description | No | Rich text, per language. Shown under the journal on the installation's front page. | `PKPContextForm` (`description`); `indexSite.tpl` |
| Path | Yes | The journal's URL slug, shown behind the site's base URL. Letters/digits with `-`/`_` separators; must be unique across the installation; the literal `0` is refused. Changing it on edit re-homes every public URL instantly (rule 6). | `PKPContextForm` (`urlPath`); `PKPContextService::validate()` (`pathAlphaNumeric`, `pathExists`, `'0'` after-hooks) |
| Languages / Primary locale | Yes (create only) | Only on create, and only when the site has 2+ locales: checkboxes limited to the site's locales, plus a primary-locale radio that must be one of the checked languages (the form self-clears the error once it is). Single-locale sites skip the block and inherit the site locale. On edit, languages are managed on the wizard's Languages tab instead. | `PKPContextForm` (`supportedLocales`/`primaryLocale`, `!$context && count($locales) > 1`); `AddContextForm.vue` (watcher); `PKPContextController::add()` (single-locale fallback) |
| Enable ("Enable this journal to appear publicly on the site") | No | Checkbox, **unchecked by default on create** — a new journal starts hidden until the admin enables it (rule 7). ⚠ The API/DB default is the opposite: a POST that omits `enabled` creates a *live* journal (row 120 evidence; DB default `1`). | APP `ContextForm` (`enabled`, `value: … : false`); `JournalsMigration` (`enabled` default 1) |

## Rules & state

1. **One flat roster, ordered by sequence.** The Hosted Journals grid lists every
   journal — enabled and disabled alike — with Name and Path columns; each row expands
   to Edit / Remove / Settings wizard. The public site index lists **enabled** journals
   only, in the same admin-chosen sequence. *(anchor: `ContextGridHandler::loadData()`
   (`getAll()`), `ContextDAO::getAll()` (`ORDER BY seq`, `enabledOnly`);
   `IndexHandler::index()` (`getAll(true)`) — live: disabled scratch absent from the
   index, present in the grid)*

2. **Create lands the admin in the new journal's Settings Wizard.** Saving the Create
   Journal modal posts to the site-level API and, on success, the browser jumps
   straight to `admin/wizard/{id}` to finish setup. *(anchor:
   `ContextGridHandler::editContext()` (`editContextUrl` with `__id__`);
   `AddContextForm.vue` `success()` — live: redirect observed)*

3. **Creating a journal provisions a complete working journal**, not a bare row:
   default settings texts rendered in each supported language (schema defaults),
   a default **Articles** section, the default genre set, the full default role-group
   roster, front/user navigation menus, alternate email templates, the Author and
   Translator contributor roles, the reviewer-recommendation set, and the journal's
   file directories; all installed plugins get to hook in their own defaults. The
   **creating admin is automatically enrolled as the journal's Journal manager**
   (skipped if already assigned). *(anchor: `PKPContextService::add()`;
   `ContextService::afterAddContext()` (section, reviewer recommendations) — live on a
   fresh create: sections 1 ("Articles"), genres 12, user_groups 18, navigation_menus 2,
   contributor_roles 2, alternate email templates 6, reviewer_recommendations 6,
   `user_user_groups` row for the admin in the default manager group)*

4. **Path and locale validation is real at creation** — duplicate or malformed paths,
   the literal `0`, a primary locale outside the chosen languages, or languages the site
   doesn't support are all refused. But the validator carries **no reserved-word list**,
   so a `urlPath` that collides with a framework route (`index`, `api`, `admin`) is
   accepted; ⚠ a journal pathed `index` is then permanently unreachable (shadowed by the
   site context) — row 155. *(anchor: `PKPContextService::validate()` after-hooks
   (`pathAlphaNumeric`, `pathExists`, `'0'`; no reserved-word check);
   `PKPApplication::SITE_CONTEXT_PATH` = `'index'` — live 2026-07-06: `_`→400, `0`→400,
   duplicate→400, but `index`/`api`/`admin`→200; the admin area stayed reachable, the
   `index`-pathed journal did not)*

5. ⚠ **The schema's required properties are NOT enforced at creation.** The API
   accepts a journal with no name, no contacts — anything absent passes — because the
   add-time branch of the required check can never run; the result is a nameless,
   contact-less journal that (per the `enabled` DB default) is immediately **live and
   listed as a blank entry on the public site index**. The UI is protected only by the
   modal's client-side marks. On *edit*, required props are enforced when sent
   present-and-empty. Re-verified live 2026-07-06 and owned here → row 120 (Known
   deviations). *(anchor: `PKPContextService::validate()` (passes the `'add'` action
   string into `ValidatorFactory::required()`'s null-on-add `$object` slot))*

6. **Renaming the path re-homes the journal instantly**: the old URL stops resolving
   and every public/backing URL lives under the new slug. *(live: grid Edit `adm1` →
   `adm1x`; old path 404, new path serving)*

7. **The Enable flag is the journal's public switch** (admin-only UI: the grid
   Edit modal and the wizard's Journal form). Disabled → the journal drops off the
   public site index and anonymous visitors to any of its pages are bounced to its
   login page; it stays in the admin grid and switcher, and its managers keep backend
   access (semantics owned by `site-access-restrictions`). Enabling reverses this.
   Disabling also raises OAI "deleted record" tombstones for all published articles
   (and enabling clears them). *(anchor: APP `ContextForm` (`enabled`);
   `ContextService::afterEditContext()` (`ArticleTombstoneManager`);
   `IndexHandler`/`PKPContextQueryBuilder` — live: disable → index count 0, anon 302 →
   login; enable → listed. Manager-side API hole = row 118, stated once in Known
   deviations)*

8. **Delete is permanent and cascades through the journal's world**: after the
   "permanently delete X and all of its contents?" confirmation, OJS removes the
   journal's submissions, issues, sections, role groups **and every user's assignment
   in them** (site-wide accounts survive untouched), genres, review forms and
   assignments, announcements (+types), highlights, institutions, subscriptions
   (individual/institutional/types), email-template overrides, plugin settings,
   navigation menus, reviewer recommendations, its settings rows and its entire files
   directory; published articles get OAI tombstones first. ⚠ The two contributor-role
   rows provisioned at create are the one thing left behind → row 154.
   *(anchor: `PKPContextService::delete()`; `ContextService::beforeDeleteContext()/
   afterDeleteContext()` — live: all listed tables at 0 rows for the deleted id, files
   tree gone, user count unchanged (17), contributor_roles rows surviving)*

9. **The Settings Wizard is the admin's per-journal setup hub** at
   `admin/wizard/{id}` (row action "Settings wizard" / the post-create landing):
   **Journal Settings** (side tabs: *Journal* — this spec's form incl. Enable;
   *Appearance* — the journal theme form; *Languages* — the journal language grids;
   *Search Indexing*; *Restrict Bulk Emails* — the form when the site's Bulk Emails
   setting includes this journal, otherwise a pointer to Site Settings), **Plugins**
   (installed grid + gallery when plugin installation is allowed) and **Users** (the
   journal's Current Users grid with Add User — where the admin staffs the journal he
   was just enrolled in). Each tab's content rules belong to the feature owning that
   form/grid; unknown/absent journal ids 404. *(anchor: `AdminHandler::wizard()`;
   `contextSettings.tpl` — live: tab set + Users roster showing the auto-enrolled
   admin)*

10. **Multi-journal navigation.** The backend header's "Journals" button lists the
    switchable journals (roster per the permissions table): site admins are deep-linked
    to the **same page** in the other journal on switch-safe pages (dashboard, issues,
    management, payments, stats), everyone else (and admins elsewhere) to the journal's
    submission lists. On the public side, the installation front page lists enabled
    journals by sequence — unless the site redirect (owned by `site-settings`) or the
    single-journal auto-redirect sends visitors straight to a journal; **with zero
    journals a visiting site admin is redirected to Hosted Journals** to create the
    first one. Grid create/delete refresh the switcher immediately. *(anchor:
    `PKPTemplateManager::setupBackendPage()` (`$isSwitchable` page list);
    `IndexHandler::index()` (`getTargetContext`, `hasNoContexts` → `admin/contexts`);
    `ContextGridHandler::getPublishChangeEvents()` (`updateHeader`) — live: same-page
    admin links + `submissions` links for dbarnes)*

## Side effects

- **No emails, notifications or event-log entries** on create, edit, reorder or
  delete — the roster changes silently (contrast: staffing the new journal through
  its Users grid does notify, owned by `user-management`/`user-invitations`).
- **Create** builds the provisioning bundle of rule 3 (DB rows + file directories) and
  enrolls the creating admin as manager.
- **Disable/delete raise OAI tombstones** for published articles (delete via
  `beforeDeleteContext`); enable clears them. *(anchor: `ArticleTombstoneManager`)*
- **Delete removes the journal's files tree** (`files/journals/{id}`) and public files
  (`public/journals/{id}`).
- **The backend header/switcher refreshes** on grid create/delete (`updateHeader`
  publish event).

## Settings that modify behavior

- **Site → Bulk Emails** (`enableBulkEmails`, owned by `site-settings`/
  `email-templates-management`): whether the wizard shows the Restrict Bulk Emails
  form or a pointer. *(anchor: `AdminHandler::wizard()` (`$bulkEmailsEnabled`))*
- **`config.inc.php` `allow_plugin_install`**: gates the wizard's Plugin gallery tab.
  *(anchor: `PluginHelper::isGalleryAllowed()`)*
- **`security.password_timeout` > 0**: the whole Administration area demands password
  re-confirmation (owned by `login-as`).
- **`general.show_upgrade_warning`**: the "new version available" banner on the admin
  index/contexts pages.
- **Site redirect / single-journal state** (owned by `site-settings`): bypasses the
  multi-journal front page this feature otherwise feeds.

## Cross-feature interactions

- **site-settings (f66)** — the other half of the Administration area: the Site
  Settings page and its forms; the site-index *render* rules for name/about; the
  Journal-redirect field whose select this feature's Enable flag filters.
- **site-maintenance (f91)** — the admin index's system panels (System Information,
  Expire User Sessions, Delete Caches, Task Logs, Jobs); the index PAGE atom lives
  here, those panels' behavior there.
- **login-as** — the `ReauthenticationRequiredPolicy` gate on all admin pages.
- **journal-masthead-settings** — owns `SCHEMA-context-pkp`/`SCHEMA-context-ojs` and
  the manager-facing identity forms that share this feature's schema and `PUT
  contexts/{id}` endpoint (API-context-edit claimed here as the admin/create-side
  owner; their row 119 acronym gap recurs on this form's Journal initials).
- **site-access-restrictions** — disabled-journal access semantics (who can still
  browse/login) and ledger row 118's manager-side API hole; this spec owns the
  admin-side `enabled` control.
- **website-appearance-settings** — the wizard's Appearance/theme tab + theme API
  atoms; **languages-locales** — the wizard's Languages grids; **plugin-management** —
  the wizard's Plugins tab; **user-management** — the wizard's Users tab (grid, Add
  User, and the roles shown there).
- **user-invitations** — row 115: sub-editors/assistants can mint manager accounts via
  invitations — the same over-grant family as row 118, relevant to who ends up running
  a hosted journal.
- **journal-homepage** — what the new journal's public pages show once enabled
  (`DB-journals` is claimed here as the entity's create/delete home; journal-homepage
  reads it).
- **navigation-menus** — the two menus provisioned per journal at create.

## Canonical scenarios

1. **Admin reaches the roster; a manager is refused** — site admin: user menu →
   Administration → index panels → Hosted Journals; the grid lists every journal with
   Edit / Remove / Settings wizard row actions and Create Journal / Order top actions.
   A journal manager gets the access-denied page on every admin URL (index, contexts,
   wizard) and 401 on every site-level contexts API call, and never sees the
   Administration nav entry.

2. **Create a journal end-to-end** — site admin: Create Journal modal; filling every
   *-marked field and saving lands (after also picking a Country — row 153's as-built
   toll) on the new journal's Settings Wizard; the journal exists fully provisioned
   (Articles section, default roles/genres/menus/templates) with the admin enrolled as
   its manager — but, Enable unchecked, it is absent from the public site index and
   anonymous visitors are bounced to its login page.

3. **Enable and staff the new journal** — site admin: wizard → Journal form → tick
   Enable → the journal appears on the installation front page; wizard → Users tab
   shows the admin as the first user and Add User staffs the journal; the backend
   Journals switcher now offers it (deep-linking admins to the same page).

4. **Edit identity and path** — site admin: grid row → Edit; renaming the Path
   applies immediately — the old URL 404s, the journal serves under the new slug; the
   same modal flips Enable off, dropping the journal from the index while it stays
   manageable in the grid.

5. **Reorder the front page** — site admin: Order → drag a journal above another →
   Done; the site index re-lists in the new order (sequence persisted).

6. **Delete a journal** — site admin: grid row → Remove → confirmation names the
   journal and warns "and all of its contents"; after OK the journal, its content
   tables, role assignments and files are gone while user accounts survive; the grid,
   site index and switcher no longer show it (row 154's contributor-role rows are the
   as-built residue).

7. **Multi-journal navigation boundaries** — a manager holding roles in several
   journals sees exactly those in the Journals switcher (a disabled journal only where
   they are its manager, linked to its submissions); with roles in a single journal the
   button doesn't render; a site admin's switcher lists everything including disabled
   journals. Row 120's API-only nameless-journal path is the standing validation
   boundary probe.

## Known deviations (as-built ≠ intent)

- ⚠ **Row 153 (NEW)** — the Create Journal form **cannot be submitted without picking
  a Country**, although the field carries no required mark: the untouched select's
  empty value fails the schema's non-nullable `country` rule with "Country: This is
  not a valid string.", and the roster has no blank option to return to. UI-blocking
  friction with a cryptic message on the primary create path; API POSTs that *omit*
  the property pass. Live 2026-07-06.
- ⚠ **Row 120** (found by the journal-masthead-settings verifier, **owned here**) —
  `POST contexts` enforces none of the schema's required properties: the add-time
  required check is dead code (`PKPContextService::validate()` hands the `'add'`
  action string to `ValidatorFactory::required()` where null-on-add is expected), so
  an API client can mint a nameless journal — which the `enabled` DB default then
  publishes as a blank site-index entry. Re-verified live 2026-07-06 (nameless id 4,
  `enabled:true`, blank public listing; deleted). The admin UI blocks only
  client-side. Related asymmetry: the UI's new-journal default is *disabled*, the
  API/DB default is *enabled* (Open question 1).
- ⚠ **Row 154 (NEW)** — deleting a journal orphans its two provisioned
  contributor-role rows (+ settings): `PKPContextService::delete()` mirrors every
  other `add()` provisioning except `ContributorRole`, and no FK cascades. Low —
  silent residue only. Live 2026-07-06 across five scratch deletes.
- ⚠ **Row 155 (NEW)** — the Create/Edit journal form and `POST/PUT contexts` accept a
  `urlPath` colliding with a reserved framework route (`index`, `api`, `admin`); the
  validator has no reserved-word list. Only `index` is genuinely harmful — a journal
  pathed `index` is shadowed by the site context (`SITE_CONTEXT_PATH = 'index'`) and can
  never be visited, though it sits in the grid; `admin`/`api` resolve as ordinary
  journal contexts and do **not** shadow the admin area or the API (both live under the
  `index` site context). LOW — obscure admin foot-gun, no data loss, recoverable by
  editing the path. Live 2026-07-06.
- ⚠ **Row 118** (found and filed by `site-access-restrictions`; the admin-side control
  surface is this spec's) — managers can PUT the admin-only journal properties
  (`enabled`, `seq`, `urlPath`) through their journal-scoped contexts endpoint with no
  UI affordance, including re-publishing a journal an admin took offline. Not
  re-driven here; referenced once.
- **Dead op (candidate)** — `ContextGridHandler::users` (fetches
  `management/accessUsers.tpl`) is referenced by no template, JS or row action; the
  wizard's Users tab uses `UserGridHandler` directly. Recorded for
  `UNASSIGNED.md` §Dead-code candidates (Open question 3).

## Open questions

1. Should a journal created through the API with `enabled` omitted default to
   **enabled** (current DB default) when the UI's create form deliberately defaults to
   disabled? Aligning the schema/API default to `false` would also defuse half of
   row 120's blast radius.
2. Managers are 401'd on every site-level `contexts` call — including the enabled-only
   list — because `CanAccessSettingsPolicy` outranks the route group's nominal
   `MANAGER` allowance; the manager-reachable branches of `getMany()`/`get()` are
   journal-scoped only. Is the site-level manager allowance vestigial (candidate for
   tightening to SITE_ADMIN), or is a manager-facing site-level listing intended?
3. `ContextGridHandler::users` + its `accessUsers.tpl` fetch appear unreachable from
   any live surface — retire the op?
4. Should the context `urlPath` validator reject the framework's reserved path segments
   (`index`, `api`, `admin`, …)? Today only `index` is genuinely harmful (unreachable
   journal); `admin`/`api` merely confuse (row 155).

## Verification

Adversarially verified 2026-07-06 (live on `:8000` as `admin`, `ojs_test` PostgreSQL;
every mutating probe on scratch `adv…` journals via the admin site-level API, all
deleted + their orphan rows purged afterward → DB back to 1 journal `publicknowledge`,
untouched and enabled). Confirmed `verified`:
- **Rows 153/120/154 re-verified.** Row 153: `POST contexts` with `country:""` → 400
  `["This is not a valid string.","This is not a valid country."]`, `country` absent →
  200 — the trap is unique to the sole `FieldSelect` (`country`) that always serializes
  an empty value against a non-`nullable` schema rule; no other create-form field shares
  it. Row 120: nameless `POST` (only `urlPath`) → 200, `enabled:true` (DB default),
  `name:{en:""}`, `contactName:null`, `primaryLocale` auto-`en`; the blank entry rendered
  (linked by path) on the anon site index (HTTP 200, not broken) and vanished on delete.
- **Row 154 blast-radius bounded to one table family.** Snapshotting every
  `context_id`/`journal_id` table before/after a real `DELETE contexts/{id}`: all
  provisioned rows (`user_groups` 18, `user_group_stage` 31, `email_templates` 6,
  `email_template_user_group_access` 74, `genres` 12, `navigation_menus`/`_items` 2/17,
  `plugin_settings` 22, `reviewer_recommendations` 6, `sections` 1, `journal_settings`
  65) drop to **0 except `contributor_roles` (2) + `contributor_role_settings` (2)**.
  `reviewer_recommendations` and `navigation_menus` do NOT orphan (refuting the "maybe
  broader" hypothesis); `user_group_stage`/`email_template_user_group_access`, though
  never named in `delete()`, cascade cleanly via FK. Row 154 is one-table, as claimed.
- **Admin-vs-manager contexts-API boundary reconciled.** It is ONE route registration.
  `POST`/`DELETE contexts` sit in the `SITE_ADMIN`-only group; `GET`/`PUT contexts/{id}`
  in the `[SITE_ADMIN, MANAGER]` group — but `CanAccessSettingsPolicy` (added in
  `authorize()` ahead of the role set) draws the real line by request context: at the
  **site level** (`/index/api/...`, no journal) a manager holds no settings-access group
  → DENY (401 on GET/enabled-GET/POST/DELETE — footnote g); at the **journal level**
  (`/{path}/api/...`) the manager's `permitSettings` group PERMITs, so their `PUT
  contexts/{id}` reaches `edit()` which applies no per-field guard → row 118. An extra
  belt confirms the split: a **site-level PUT is 403 `requiresContext` for everyone incl.
  the admin** (verified live) — all edits, admin or manager, run journal-scoped. So
  footnote g (site-level admin-only) and row 118 (journal-level manager-can) are the two
  faces of the same routes, not a contradiction.
- **Create-path validation attacked.** Duplicate `urlPath` → 400, `_` → 400
  pathAlphaNumeric, `0` → 400; but reserved paths `index`/`api`/`admin` → 200 (new ledger
  row 155 — only `index` genuinely broken, the admin area stayed reachable).
- **Seam/atom audit.** All 13 claimed atoms single-owner; no collision with site-settings
  (66, which owns `DB-site`/`DB-site_settings`) or journal-masthead-settings (56, which
  owns `SCHEMA-context-pkp/-ojs` + `FORM-*masthead*`, referenced here). One stale
  double-claim fixed: `DB-journals` was still claimed by the verified `journal-homepage`
  spec — dropped there (frontmatter + rule 5 + reference table) now that the atlas
  reassigned it to this feature.

---

## Reference — entry points & surfaces

| Entry | Path | Atom |
|-------|------|------|
| Administration index | `/index/admin` (`AdminHandler::index()` → `admin/index.tpl`) | PAGE-admin-index |
| Hosted Journals page | `/index/admin/contexts` (`AdminHandler::contexts()` → `admin/contexts.tpl`) | PAGE-admin-contexts |
| Journal Settings Wizard | `/index/admin/wizard/{id}` (`AdminHandler::wizard()` → `admin/contextSettings.tpl`) | PAGE-admin-wizard |
| Hosted Journals grid | component `grid.admin.context.ContextGridHandler` (fetchGrid/fetchRow/createContext/editContext/updateContext/deleteContext/saveSequence; `users` dead-op candidate) | GRID-lib-pkp-grid-admin-context-context-grid-handler |
| Create/Edit journal form | `PKPContextForm` + APP `ContextForm` (modal via `admin/editContext.tpl`, wizard Journal tab) | FORM-pkp-context-form, FORM-context-form |
| Create-form Vue wrapper (post-create redirect) | `AddContextForm.vue` (`AddContextContainer` mount) | VUE-add-context-form |
| Contexts API | GET/POST `api/v1/contexts`, GET/PUT/DELETE `api/v1/contexts/{contextId}` (site-level for add/delete; journal-scoped for edit) | API-context-get-many, API-context-get, API-context-add, API-context-edit, API-context-delete |
| Journal storage | `journals` table (`journal_settings` owned by `journal-masthead-settings`) | DB-journals |
| Referenced, not claimed | `SCHEMA-context-pkp`/`SCHEMA-context-ojs` (journal-masthead-settings); `API-context-{get,edit}-theme` (website-appearance-settings); `API-context-edit-doi-registration-agency-plugin` (doi-management); site index render (`IndexHandler::index()`, site-settings/journal-homepage) | — |

## Reference — code anchors

- `lib/pkp/pages/admin/AdminHandler.php` — `index()`, `contexts()`, `wizard()`,
  `authorize()` (admin-only + no-context + reauth); the other ops belong to
  `site-settings` (settings) and `site-maintenance` (systemInfo/caches/sessions/jobs)
- `lib/pkp/controllers/grid/admin/context/ContextGridHandler.php` (+ `ContextGridRow`,
  `ContextGridCellProvider`) — the grid, its actions and ordering
- `lib/pkp/classes/components/forms/context/PKPContextForm.php`,
  `classes/components/forms/context/ContextForm.php` (OJS: abbreviation + enabled),
  `lib/ui-library/src/components/Form/context/AddContextForm.vue`
- `lib/pkp/api/v1/contexts/PKPContextController.php` — routes, per-op guards, the
  site-wide-only add/delete and context-only edit rules
- `lib/pkp/classes/services/PKPContextService.php` — `validate()` (row 120), `add()`
  (provisioning + manager enrollment), `delete()` (cascade; row 154)
- `classes/services/ContextService.php` (OJS) — default section, tombstones on
  enable/disable/delete, sections/issues/subscriptions/submissions cascade
- `classes/journal/JournalDAO.php`, `lib/pkp/classes/context/ContextDAO.php` — storage,
  `getAll()` ordering, resequencing
- `lib/pkp/classes/template/PKPTemplateManager.php` `setupBackendPage()` — the
  Journals switcher and the admin nav entry
- `pages/index/IndexHandler.php` (OJS) — the multi-journal front page and the
  zero-journals admin redirect
