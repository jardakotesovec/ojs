---
name: announcements
scope: Journal news items — a manager enables the feature, posts/edits/expires announcements (optionally categorized by announcement types and optionally emailed to the journal's users), and readers see them on a public listing/detail page, the home page, the nav bar and the announcement feed
shared: pkp-lib          # entity, API, forms, reader pages, notify job/mailable all in lib/pkp; OJS contributes only routing/templates glue. Site-level twin (Administration → Site Settings) included.
status: verified
e2e-plans: [announcements]
atlas-claims: [VUE-announcements-list-panel, GRID-lib-pkp-grid-announcements-announcement-type-grid-handler, FORM-pkp-announcement-form, FORM-pkp-announcement-settings-form, SCHEMA-announcement, DB-announcements, DB-announcement_settings, DB-announcement_types, DB-announcement_type_settings, PAGE-management-settings-announcements, PAGE-announcement-index, PAGE-announcement-view, API-announcement-get-many, API-announcement-get, API-announcement-add, API-announcement-edit, API-announcement-delete, NOTIF-new-announcement, JOB-newannouncementnotifyusers, MAIL-announcement-notify, LOC-manager-manager-announcements, LOC-manager-manager-announcementTypes]
---

# Announcements

## Purpose

Announcements are a journal's news channel: calls for papers, event notices, issue
releases. A journal manager switches the feature on (Settings → Website → Setup →
**Announcements** tab), after which an **Announcements** entry appears in the backend
left menu leading to the management area — a list panel for the announcements
themselves plus a grid for **announcement types** (an optional per-journal category
label). Each announcement has a title, two rich-text bodies (summary + full text), an
optional image, an optional expiry date and an optional type; on creation the manager
may also tick "Send Email" to email the journal's users. Readers get a public
**Announcements** page (`/{journal}/announcement`) with a per-announcement detail page,
an announcements section on the journal home page (owned by `journal-homepage`), a
conditional nav-menu link (owned by `navigation-menus`) and an opt-in announcement feed
(owned by `web-feeds-syndication`). A parallel site-level surface exists for
multi-journal sites (Administration → Site Settings → Announcements).

## Actors & permissions

Baselines: **site admins** can do everything a journal manager can, on every journal
and at site level. **Anonymous visitors and all non-manager roles** have no access to
any management surface or to the REST API — including its read (GET) routes, which are
manager-gated too (live: anonymous GET → 401; anonymous POST/PUT/DELETE are refused
even earlier, by the session CSRF wall — 403 `form.csrfInvalid` — before
authentication is consulted; the ordering is cosmetic — with a valid CSRF token in
hand, an anonymous caller is still stopped by authentication and an enrolled
non-manager by the role gate, live-probed both ways 2026-07-06). The REST API at
`/{journal}/api/v1/announcements` is the write path the Vue panel uses; without a
journal in the URL it manages **site-level** announcements and then admits site admins
only.

| Action | Who may — and when |
|--------|--------------------|
| **Enable/configure announcements** (toggle, introduction, homepage count) | • Journal manager with settings access, site admin — Settings → Website → Setup → Announcements tab (the form is part of the settings-gated Website page) <sup>a</sup> |
| **Create / edit / delete announcements** | • Journal manager, site admin — via the Announcements area; **deliberately exempt** from the "Permit settings" role restriction (the area was moved out of settings; a manager barred from settings still manages announcements)<br>• Works even while the feature is disabled — the left-menu link hides, but the area's direct URL stays functional (live-verified; readers see nothing until the toggle is on) <sup>b</sup> |
| **Manage announcement types** | • Journal manager, site admin — second tab of the same area (legacy grid) <sup>c</sup> |
| **Read announcements over the API** | • Journal manager, site admin only — ⚠ there is **no public API read**; all five routes sit behind the manager role gate (see Known deviations note) <sup>d</sup> |
| **View the reader listing & detail pages** | • Anyone, anonymously — only while announcements are **enabled** (else both 404) and only **non-expired** announcements <sup>e</sup> |
| **Receive the new-announcement notification/email** | • Every user holding any active role in the journal (any role incl. reader), minus per-user opt-outs; email additionally requires the creator to have ticked "Send Email" <sup>f</sup> |
| **Manage site-level announcements** | • Site admin — Administration → Site Settings → Announcements (Settings / Announcements / Announcement Types sub-tabs); content sub-tabs refuse with "You must enable announcements." until the site-level toggle is on <sup>g</sup> |

<sup>a</sup> `ManagementHandler::website()` (`PKPAnnouncementSettingsForm` on the settings-gated Website page); `ManagementHandler::authorize()` `CanAccessSettingsPolicy`
<sup>b</sup> `ManagementHandler::authorize()` — explicit exemption: `$requestedArgs != ['announcements']` skips `CanAccessSettingsPolicy`; `PKPTemplateManager::setupBackendPage()` (menu item only when `enableAnnouncements`, roles MANAGER/SITE_ADMIN); live 2026-07-06 scratch `ann2`
<sup>c</sup> `AnnouncementTypeGridHandler::__construct()` (ROLE_ID_MANAGER, ROLE_ID_SITE_ADMIN), `authorize()` `ContextAccessPolicy`
<sup>d</sup> `PKPAnnouncementController::getRouteGroupMiddleware()` (`has.user` + `roleAuthorizer([SITE_ADMIN, MANAGER])`), `getSiteRoleAssignments()` (site-level: admin only); live 401 anon GET
<sup>e</sup> `AnnouncementHandler::index()/view()` (`isAnnouncementsEnabled()` else `NotFoundHttpException`; `withActiveByDate()`)
<sup>f</sup> `PKPAnnouncementController::notifyUsers()` → `NotificationSubscriptionSettingsDAO::getSubscribedUserIds()` (all users with an active user-group in the context, minus blockers)
<sup>g</sup> `templates/admin/settings.tpl` (announcements tab, `v-if="announcementsEnabled"` + `manager.announcements.notEnabled`); live 2026-07-06

## Fields & validation

**Announcement form** (side modal from "Add Announcement" / "Edit"; identical on edit):

| Field (UI label) | Required? | Rules | Anchor |
|------------------|-----------|-------|--------|
| Title | Yes (primary locale) | Plain text, multilingual | `PKPAnnouncementForm` `title`; `announcement.json` required |
| Short Description | No | Rich text, multilingual; "brief description … to display along with the announcement title"; shown on the reader list and used as the email's summary variable; the detail page falls back to it when Description is empty | `descriptionShort` |
| Description | No | Rich text, multilingual; the full text on the detail page | `description` |
| Image | No | Image upload with alt text; the file must really be an image and its extension must match its content — a bad file aborts the save (⚠ on **edit** it destroys the announcement, Known deviations row 142; a *dangling* upload reference instead errors out with the record kept, row 144) | `image`; `Announcement::isValidImage()` |
| Expiry Date | No | Plain text field, format `YYYY-MM-DD` (no date picker); help text: "The announcement will be displayed to readers until this date." As-built the announcement is hidden from the **start** of that date — the last day it shows is the day before (rule 5) | `dateExpire`; `announcement.json` `date_format:Y-m-d` |
| *(type name)* | No | Radio group listing the journal's announcement types — **only rendered when at least one type exists**; no "none" option, so once picked a type cannot be cleared from the UI (OQ 4) | `PKPAnnouncementForm::getAnnouncementTypeOptions()` `typeId` |
| Send Email ("Send an email about this to all registered users.") | No | Checkbox; honored on **create only** — it also appears on the edit modal but editing never notifies anyone (⚠ Known deviations row 143a) | `sendEmail`; `PKPAnnouncementController::add()` vs `edit()` |

**Announcement type form** (modal in the Types grid): **Name** — required in the
primary locale, multilingual, the only field. *(anchor:
`AnnouncementTypeForm::__construct()` `FormValidatorLocale('name', 'required')`)*

**Announcement settings form** (Website → Setup → Announcements):

| Field (UI label) | Required? | Rules | Anchor |
|------------------|-----------|-------|--------|
| Enable announcements | No | Master toggle; the two fields below only appear while it is checked (revealed instantly, no save needed) | `PKPAnnouncementSettingsForm` `enableAnnouncements`, `showWhen` |
| Introduction | No | Rich text, multilingual; rendered above the list on the reader Announcements page | `announcementsIntroduction` |
| Display on Homepage | No | Integer ≥ 0; "How many announcements to display on the homepage. Leave this empty to display none." Consumed by the home page (feature 36's two-part gate) | `numAnnouncementsHomepage`; `context.json` `min:0` |

## Rules & state

1. **The enable toggle gates readers, not managers.** While announcements are
   disabled: the reader listing and every detail URL return 404; the backend left-menu
   entry is absent; the nav-menu item hides (feature 61); the home-page section and the
   feed are off (features 36/46). But the management area itself keeps working via
   direct URL, and announcements/types can be created, edited and deleted there — they
   simply have no audience yet. All states live-verified 2026-07-06 (scratch `ann1`/`ann2`).
   *(anchors: `AnnouncementHandler::isAnnouncementsEnabled()`;
   `PKPTemplateManager::setupBackendPage()`; `ManagementHandler::announcements()` — no
   enable check)*
2. **One management area, two tabs.** The Announcements area
   (`/management/settings/announcements`) holds the Vue list panel (search by
   title/description, paginate by 30, Add/Edit in a side modal, Delete with a
   confirm, View linking to the reader page) and the legacy **Announcement Types**
   grid. The panel talks to the REST API; the grid to the legacy component router —
   both live, panel primary for announcements, grid the only path for types.
   *(anchors: `management/announcements.tpl`; `PKPAnnouncementsListPanel`;
   `AnnouncementsListPanel.vue`; `Announcement::scopeWithSearchPhrase()`)*
3. **Newest first, everywhere.** Manager panel, reader list, home-page section and API
   all order by posted date descending. The posted date is stamped at creation and
   never editable. *(anchors: `PKPAnnouncementController::getMany()` /
   `AnnouncementHandler::index()` `orderBy(Announcement::CREATED_AT, 'desc')`;
   `announcement.json` `datePosted` `writeDisabledInApi`)*
4. **An announcement belongs to exactly one journal** (or to the site, `assocId`
   null). The API refuses to read, edit or delete another journal's announcement
   through the wrong journal's endpoint. *(anchors: `PKPAnnouncementController::get()/edit()/delete()`
   `assocId !== context id` guards)*
5. **Expiry hides, never deletes.** An announcement is *active* while it has no expiry
   date or the expiry lies in the future; expiry is stored as a bare date, so the
   announcement is shown through the end of the day **before** the expiry date and
   hidden from the expiry date itself onward (the "until this date" help text is
   off-by-one against as-built; OQ 2). An expired announcement disappears from the
   reader list, the home-page section and the feed; its detail URL redirects to the
   reader list; it **stays** in the manager panel and API, where it can be edited or
   have its expiry pushed back out. Past dates are accepted on entry (that is how the
   e2e suite seeds expired items). Live-verified end-to-end 2026-07-06. *(anchors:
   `Announcement::scopeWithActiveByDate()` (`date_expire > now` OR null);
   `AnnouncementHandler::view()` (`now lte dateExpire` else redirect);
   `ManagementHandler::announcements()` — no active filter)*
6. **Types are an optional label vocabulary.** Types are per-journal names (CRUD in
   the legacy grid); when at least one exists the announcement form offers a radio to
   pick one. As-built the chosen type is **displayed nowhere on the reader side** —
   list, detail, emails and the announcement feed all show the bare title (the
   "Type: Title" composer is dead code behind an always-false guard, so even the
   feed — the one surface that asks for the full title — safely gets the plain
   one; Known deviations row 143b). *(anchors: `AnnouncementTypeGridHandler`;
   `PKPAnnouncementForm` (conditional `typeId` field); `announcement_summary.tpl`
   / `announcement_full.tpl` — title only; `Announcement::fullTitle()`)*
7. ⚠ **Deleting a type silently deletes every announcement carrying it.** The DAO
   cascades type deletion to the announcements themselves (not just clearing the
   label — the DB column is set-null on delete, but that FK never fires because the
   code deletes the announcements *before* dropping the type row), and the grid asks only
   the generic "Are you sure you wish to delete this item?" — the dedicated warning
   string that spells out the cascade exists in the locale files but nothing uses it.
   Live-verified 2026-07-06: deleting the only type removed the typed announcement,
   rows and settings. Known deviations row 141. *(anchors:
   `AnnouncementTypeDAO::deleteById()` (`Announcement::withTypeIds([$typeId])->delete()`);
   `AnnouncementTypeGridRow` (`common.confirmDelete`); unused
   `manager.announcementTypes.confirmDelete`; `AnnouncementsMigration` `onDelete('set null')`)*
8. **Creating an announcement always notifies in-app; email is opt-in per
   announcement.** On every create (journal-level only), a background job batch fans
   out to **all users holding any active role in the journal** (readers included):
   each gets an in-app notification record; when "Send Email" was ticked they also get
   the **ANNOUNCEMENT** email (subject = announcement title, body links the detail
   page, sender = the creating user, unsubscribe footer link). Disabled accounts are
   skipped at send time (the job re-loads each recipient and drops missing/disabled
   users); users enrolled in other journals only — including a site admin with no
   role here — get nothing. Per-user opt-outs from
   the profile Notifications tab apply: blocking the on-screen notification suppresses
   **both** legs; blocking only the email suppresses just the email. Editing an
   announcement never re-notifies (the edit modal's checkbox is inert — row 143a).
   Site-level creates notify no one (there is no site-level subscriber list — code
   comment). Live-verified 2026-07-06 incl. the opt-out matrix and Mailpit delivery.
   *(anchors: `PKPAnnouncementController::add()` → `notifyUsers()` (`Bus::batch`,
   chunked); `NewAnnouncementNotifyUsers::handle()`;
   `AnnouncementNotificationManager::notify()`; `AnnouncementNotify` mailable;
   `NotificationSubscriptionSettingsDAO::getSubscribedUserIds()`)*
9. ⚠ **A failed image upload during *edit* deletes the announcement.** Create is safe
   (the half-created record is rolled back and a field error shown), but on edit the
   same failure path destroys the existing announcement while the user only sees
   "There was an error uploading this image." on the still-open form. The blast
   radius is **image-only**: every other validation failure on edit (empty title,
   malformed expiry date) is rejected up front and leaves the record untouched, and
   any file failing the image check — wrong content, corrupt bytes, mismatched
   extension — triggers the deletion. Re-verified independently 2026-07-06
   (announcement + all its settings gone after a PUT with a non-image file AND after
   a PUT with a corrupt `.png`; empty-title and bad-date edits 400 harmlessly; a
   *dangling* temporary-file id is a separate, milder failure — row 144). Known
   deviations row 142. *(anchors: `PKPAnnouncementController::edit()`
   `catch (StoreTemporaryFileException) { $announcement->delete(); }` — with an
   in-code TODO doubting itself; contrast `add()` `Announcement::destroy()` of the
   new id; `Repository::validate()` runs before `update()`, so only the image path
   can fail post-validation)*
10. **Site level mirrors journal level, smaller.** The site twin (Administration →
    Site Settings → Announcements) has the same three-field settings form, list panel
    and types grid, but the two content sub-tabs display "You must enable
    announcements." until the site toggle is on (a courtesy the journal-level area
    does not have — it shows working tabs regardless, rule 1). The site reader page is
    `/index/announcement` (404 while disabled, live-verified); site announcements are
    those with no journal. *(anchors: `templates/admin/settings.tpl`;
    `AnnouncementHandler::index()` `SITE_CONTEXT_ID` branch;
    `Announcement::scopeWithContextIds()` `orWhereNull('assoc_id')`)*
11. **Reader pages fall back to the primary locale; foreign and missing ids bounce
    to the list.** On a multilingual journal, an announcement translated only in the
    primary locale still shows on the other locales' reader pages with its
    primary-locale title/body (fallback, not hidden — live 2026-07-06, fr_CA-only
    announcement visible on the `en` pages). A detail URL for a non-existent id or
    for another journal's announcement redirects to this journal's reader list, same
    as the expired case (rule 5). *(anchors: `ModelWithSettings::getLocalizedData()`
    fallback; `AnnouncementHandler::view()` `assocId == context id` guard)*

## Side effects

- **On create (journal-level)** — one `NewAnnouncementNotifyUsers` job batch
  (recipients chunked); each job writes one in-app notification row per recipient
  (type "new announcement", NORMAL level) and, for the email cohort, sends one
  **ANNOUNCEMENT**-template email per recipient with an unsubscribe link tied to that
  notification. With the default `job_runner = On` the batch drains within moments on
  the next web requests. *(rule 8)*
- **In-app surfacing is unclear** — the notification rows are written, but no 3.6
  backend surface was found that renders them (dashboard, bell/tasks and the general
  notification poll all show nothing; OQ 1 — framework side belongs to feature 80,
  `notifications`).
- **On delete** — the announcement's image file is removed from the journal's public
  files; already-written notification rows are **not** cleaned up — they carry no
  reference to the announcement at all (only the journal and a title snapshot), so
  cleanup is impossible as-built; the emailed detail links land on
  the reader list via the expired/missing redirect. Deleting a **type** cascades to
  its announcements via a bulk query that skips the per-announcement cleanup — those
  image files are orphaned on disk (row 141 note).
  *(anchors: `Announcement::delete()`/`deleteImage()`; `AnnouncementTypeDAO::deleteById()`)*
- **Reader surfaces react immediately** — list/detail (this spec), home-page section
  (feature 36), nav item (feature 61), announcement feed + sitemap announcement URLs
  (feature 46). No event-log entries anywhere in this feature.

## Settings that modify behavior

- **Enable announcements** (`enableAnnouncements`, journal) — the reader-side master
  gate (rule 1). Bootstrapped `publicknowledge` has it on (with no homepage count) —
  do not assume it means announcements are visible on the home page (36's gate).
- **Introduction** (`announcementsIntroduction`, journal) — prose above the reader list.
- **Display on Homepage** (`numAnnouncementsHomepage`, journal) — cap for the
  home-page section; empty/0 = no section (owned by feature 36, rule 9 there).
- **Site equivalents** (`enableAnnouncements` etc. on the site) — gate the site-level
  surfaces (rule 10).
- **Per-user notification opt-outs** (profile → Notifications, "New announcement"
  on-screen + email checkboxes) — rule 8; UI owned by `user-profile`.
- **`[queues] job_runner`** — whether notify jobs drain on web requests or need a
  worker (deployment-level, not announcement-specific).

## Cross-feature interactions

- **journal-homepage (36)** — owns the home-page announcements section and its
  two-part gate (`enableAnnouncements` AND `numAnnouncementsHomepage` > 0); this spec
  owns the entity and the enable toggle itself.
- **web-feeds-syndication (46)** — owns the announcementFeed plugin (off by default;
  additionally gated on the enable toggle) and the sitemap's announcement URLs; ⚠ its
  Atom/RSS-1.0 date malformation is **ledger row 107**, owned there.
- **navigation-menus (61)** — owns the conditional "Announcements" nav-menu item
  (flips with the toggle; verified there).
- **notifications (80, unwritten)** — owns the notification framework (rendering,
  unsubscribe endpoint, subscription storage); this spec owns the announcement-side
  firing (rule 8) and hands OQ 1 (no visible in-app surface) to that spec.
- **user-profile** — owns the Notifications settings tab where users opt out.
- **website-appearance-settings** — owns the Website settings page shell hosting the
  Announcements settings tab.

## Canonical scenarios

1. **Enable and configure** — A manager opens Settings → Website → Setup →
   Announcements: only the enable checkbox shows; ticking it reveals Introduction and
   Display on Homepage in place; saving stores all three. The backend left menu gains
   **Announcements**, the reader page starts serving, and the nav item appears. On a
   journal left disabled, the reader list and detail URLs 404 and the menu entry is
   absent — yet the management area's direct URL still opens with a working Add
   button.
2. **Announcement CRUD with reader effect-links** — The manager adds an announcement
   (title only suffices); it tops the panel and, immediately, the reader list
   (introduction above it), its detail page, and the home-page section (count set).
   Edit updates in place; Delete (confirm dialog) removes it from panel and reader
   side; the panel search finds it by title or description text.
3. **Expiry lifecycle** — Setting an announcement's Expiry Date to a past date drops
   it from the reader list and home page and turns its detail URL into a redirect to
   the reader list — while the manager panel and API keep listing it; clearing or
   advancing the date resurrects it.
4. **Types: label vocabulary with a destructive delete** — With no types, the
   announcement form has no type field. The manager creates type "Call for Papers" in
   the Types grid → a radio appears on the form; an announcement created with it
   renders to readers with its plain title (no type prefix). Deleting the type shows
   only the generic "delete this item?" confirm — and takes the typed announcement
   with it (⚠ row 141); the untyped announcement survives.
5. **Notify on create** — Creating with "Send Email" ticked: every user with a role in
   the journal gets an in-app notification row, and each of them also gets the
   ANNOUNCEMENT email (subject = title, link to the detail page, unsubscribe footer) —
   except: a user who blocked the on-screen notification gets neither leg; a user who
   blocked only the email keeps the in-app row. Creating with the box unticked writes
   the in-app rows but sends no mail; editing an announcement never notifies at all.
6. **Permission boundary** — Anonymous: reader pages only (when enabled); the API's
   GET routes answer 401 and the write verbs 403 (the CSRF wall fires first — either
   way, no route is reachable). A section editor/author/reader sees no
   Announcements menu and is refused by API and grid. A journal manager manages
   announcements even when their role is barred from Settings (the area is exempt);
   another journal's manager cannot touch this journal's announcements through their
   own journal's API.

## Known deviations (as-built ≠ intent)

- ⚠ **Row 141 (new)** — Deleting an announcement type silently deletes all its
  announcements behind a generic confirm; the specific warning string
  (`manager.announcementTypes.confirmDelete` — "Warning! All announcements with this
  announcement type will also be deleted.") exists but is wired to nothing, which is
  strong evidence the generic-confirm state is unintended. The bulk delete also skips
  image-file cleanup. Suspected intent: either set-null (as the DB schema does) or at
  minimum the warning text. *(rule 7)*
- ⚠ **Row 142 (new)** — A failed image upload during **edit** deletes the whole
  announcement while showing only an image-field error; the code carries a TODO
  questioning the deletion. Data loss contradicting the form affordance. Suspected
  intent: keep the record, reject the image (as create effectively does). *(rule 9)*
- ⚠ **Row 143 (trio of blemishes)** — (a) the "Send Email" checkbox renders on
  the **edit** modal but the edit path never notifies; (b) the "full title" composer
  that should prefix the type name is **doubly broken and inert**: its type-check
  reads the camelCase `typeId` key from the raw snake_case attribute bag, so the
  compose branch never runs and `fullTitle` always equals the bare title — which is
  lucky, because the announcementFeed's Atom/RSS item titles DO consume `fullTitle`
  (the only live consumer) and would otherwise emit `Array: <title>` (verifier
  correction 2026-07-06: no PHP warning fires, and "no consumer" was wrong — the
  feed is one, safely); (c) in-app notification rows are never cleaned up when their
  announcement is deleted — they carry no announcement reference (journal + title
  snapshot only), so as-built cleanup has nothing to key on. All LOW.
  *(fields table; rules 6, 8; Side effects)*
- ⚠ **Row 144 (new)** — a **dangling** image `temporaryFileId` (unknown, another
  user's, or purged by the temp-file cleanup before Save) escapes the invalid-image
  handling entirely: the request dies with an unhandled error (500), the
  announcement **survives** (contrast row 142), but a garbage `image` setting is
  persisted — inert downstream (API serves `image: null`, reader pages render
  normally). API-shaped input; the UI can reach it only via the purged-before-save
  window. LOW. *(anchors: `Announcement::handleImageUpload()` — no null check after
  `TemporaryFileManager::getFile()`; `PKPAnnouncementController::edit()` catch is
  `StoreTemporaryFileException`-only)*
- **API reads are manager-only** — the five REST routes (GET included) all sit behind
  the manager gate, so there is no anonymous machine-readable announcement API (the
  feed is the public machine surface). Plausibly intended (the API exists for the
  panel); noted as OQ 5 rather than ⚠.
- **Row 107 (existing, owned by web-feeds-syndication)** — announcementFeed Atom/RSS
  1.0 emit malformed dates. Referenced, not re-claimed.

## Open questions

1. **Where should the in-app "new announcement" notification appear?** Rows are
   written for every journal user on each create, but we found no 3.6 backend surface
   rendering NORMAL-level announcement notifications (dashboard, bell/tasks, general
   poll all empty). Is the in-app leg vestigial until the notifications rework, or is
   there a surface we missed? (Seam: feature 80.)
2. **Expiry boundary** — the help text says "displayed … until this date", but the
   announcement is hidden from 00:00 of that date (last shown the day before). Which
   is intended?
3. **Journal vs site asymmetry while disabled** — the site-level content sub-tabs
   refuse with "You must enable announcements." but the journal-level area works fully
   while disabled. Intended (URL-stability for the moved-out-of-settings area), or
   should the journal area show the same message?
4. **Clearing a type** — once an announcement has a type there is no UI way to unset
   it (radio with no "none" option). Intended?
5. **Manager-only API reads** — should GET `announcements` (list/one) be public for
   enabled journals, mirroring the reader pages, or stay panel-private as-built?
6. **Session-vs-URL context resolution on the announcements GET list** — `HasRoles`
   scopes its role check to the request context (`PKP\middleware\HasRoles` line 63:
   `hasRole($roleId, $context->getId())`), so a manager of journal B reading journal
   A's `GET /{A}/api/v1/announcements` should be denied (no role in A). Yet a probe
   where the actor was authenticated through a **request-context** session pinned to
   their own journal returned **200** on another journal's list, while a **browser**
   session scoped (via asUser) to a journal where the actor holds no manager role
   returned the expected **401**. This may be a Playwright request-context artifact
   (the request context's session resolving `$context` from the session rather than the
   URL path) or a genuine cross-context read — it needs a dedicated curl-level probe to
   settle before any ledger claim. The cross-journal *write* guards (400 "not part of
   this journal" on the item route, 403 on PUT/DELETE) are unaffected and hold. The
   retained test asserts only those write guards, not this ambiguous list read.

---

## Reference — entry points & surfaces

| Entry | Path | Atom |
|-------|------|------|
| Announcements management area | `/{journal}/management/settings/announcements` (left menu **Announcements** when enabled) | PAGE-management-settings-announcements |
| Announcements list panel (Vue) | tab 1 of the area | VUE-announcements-list-panel |
| Announcement add/edit form | side modal in the panel | FORM-pkp-announcement-form |
| Announcement types grid | tab 2 of the area | GRID-lib-pkp-grid-announcements-announcement-type-grid-handler |
| Announcement settings form | Settings → Website → Setup → Announcements | FORM-pkp-announcement-settings-form |
| Reader listing | `/{journal}/announcement` (site: `/index/announcement`) | PAGE-announcement-index |
| Reader detail | `/{journal}/announcement/view/{id}` | PAGE-announcement-view |
| API: list | `GET /api/v1/announcements` | API-announcement-get-many |
| API: one | `GET /api/v1/announcements/{announcementId}` | API-announcement-get |
| API: create | `POST /api/v1/announcements` | API-announcement-add |
| API: edit | `PUT /api/v1/announcements/{announcementId}` | API-announcement-edit |
| API: delete | `DELETE /api/v1/announcements/{announcementId}` | API-announcement-delete |
| Notify job | queued on create | JOB-newannouncementnotifyusers |
| Email | ANNOUNCEMENT template (`AnnouncementNotify`) | MAIL-announcement-notify |
| In-app notification | type new-announcement, NORMAL | NOTIF-new-announcement |
| Entity/schema | `announcement.json`; tables `announcements`, `announcement_settings`, `announcement_types`, `announcement_type_settings` | SCHEMA-announcement, DB-announcements, DB-announcement_settings, DB-announcement_types, DB-announcement_type_settings |
| Locale | `manager.announcements.*` (30), `manager.announcementTypes.*` (12) | LOC-manager-manager-announcements, LOC-manager-manager-announcementTypes |

## Reference — code anchors

- `lib/pkp/api/v1/announcements/PKPAnnouncementController.php` — routes, role gate, `add()`/`edit()`/`delete()`, `notifyUsers()`
- `lib/pkp/classes/announcement/Announcement.php` — Eloquent model, scopes (`withContextIds`, `withActiveByDate`, `withSearchPhrase`, `withTypeIds`), image handling, `fullTitle` accessor
- `lib/pkp/classes/announcement/Repository.php` — `validate()`; `maps/Schema.php` — API shape (`url` composed reader link)
- `lib/pkp/classes/announcement/AnnouncementTypeDAO.php` — type CRUD + the delete cascade
- `lib/pkp/pages/announcement/AnnouncementHandler.php` — reader `index()`/`view()`
- `lib/pkp/pages/management/ManagementHandler.php` — `announcements()`, `website()`, the settings-gate exemption in `authorize()`
- `lib/pkp/classes/components/forms/announcement/PKPAnnouncementForm.php`, `.../context/PKPAnnouncementSettingsForm.php`
- `lib/pkp/controllers/grid/announcements/AnnouncementTypeGridHandler.php` + `form/AnnouncementTypeForm.php` + `AnnouncementTypeGridRow.php`
- `lib/pkp/jobs/notifications/NewAnnouncementNotifyUsers.php`; `lib/pkp/classes/mail/mailables/AnnouncementNotify.php`; `lib/pkp/classes/notification/managerDelegate/AnnouncementNotificationManager.php`
- `lib/pkp/templates/frontend/pages/announcements.tpl` / `announcement.tpl`; `frontend/objects/announcement_summary.tpl` / `announcement_full.tpl`
- `lib/pkp/templates/management/announcements.tpl`; `lib/pkp/templates/admin/settings.tpl` (site twin)
- `lib/pkp/classes/migration/install/AnnouncementsMigration.php`

## Verification (2026-07-06, adversarial pass)

Verified on scratch journals `annv1f62ac5` (39, en; dbarnes/dbuskins/scratch reader),
`annv229cf75` (40, fr_CA+en) and `annv30fa6d0` (41, en + announcementFeed enabled), all
on port 8000 / `ojs_test` (PostgreSQL); `publicknowledge` untouched (re-checked after
probes: `enableAnnouncements=1`, zero announcements). Every permission and state claim
survived; two ledger corrections and one new LOW row came out of the attack; status →
`verified`.

**Row 141 re-driven independently — MEDIUM stands, bounds sharpened.** The *code*
cascade wins, not the FK: `AnnouncementTypeDAO::deleteById()` bulk-deletes
`Announcement::withTypeIds([$typeId])` *before* dropping the type row, so the
migration's `set null` FK never has anything to act on. Live: a type carrying TWO
announcements took both down (rows + settings hard-deleted, not orphaned with a null
type), the untyped sibling survived, and deleting a type with NO announcements is
clean. The bulk query-builder delete bypasses `Announcement::delete()` — verified the
announcement's image file (`51.png`) left orphaned in the journal's public files.

**Row 142 re-driven independently — MEDIUM stands, blast radius confirmed NARROW
(image-only).** `Repository::validate()` runs before `update()`, so empty-title and
malformed-date edits 400 with the record intact (live); only the image path can throw
post-validation. Both a `.txt`-as-image and a corrupt `.png` destroyed the edited
announcement behind a 400 image-field error (API 404 + DB rows gone); the create path
rolled back cleanly (400, no residual row). NEW adjacent finding → **row 144**: a
*dangling* `temporaryFileId` (unknown/foreign/purged) bypasses the catch entirely —
500 `TypeError`, record survives, inert `image = 'Array'` settings row persisted.

**Row 143 re-verified with a mechanism correction.** (a) edit-with-Send-Email-ticked:
zero new notification rows/jobs after the edit (live count ledger closed exactly).
(b) CORRECTED: the fullTitle composer never executes — `isset($attributes['typeId'])`
tests a camelCase key against the raw snake_case bag (`type_id`), always false — so no
PHP warning fires and fullTitle always equals the bare title; and "no live consumer"
was wrong: the announcementFeed atom/rss/rss2 item titles consume `fullTitle` (live on
`annv30fa6d0`: typed announcement, feed titles plain — the dead guard is what saves
the feed from `Array:`). (c) rows survive deletion trivially; sharpened: they carry no
announcement reference at all (null assoc, journal + title snapshot only).

**Permission attacks refuted — announcements is CLEAN (categories pattern, no
nav-menus row-130 hole).** Section editor enrolled in the journal, with a genuine
CSRF token: POST/PUT/DELETE all **401 roleBasedAccessDenied** (the earlier 403s are
purely the CSRF wall ordering). Anonymous with a valid CSRF token scraped from the
login form: 401 at `has.user` on POST and DELETE — no CSRF-bearing anonymous write
path. The disabled-feature manager carve-out is **intended**: the
`ManagementHandler::authorize()` comment says the area "moved out of settings without
changing their URL" (also covers `userComments`).

**State/liveness attacks.** Expiry boundary pinned live: `dateExpire = today` is
hidden from the reader list AND its detail 302s on the expiry date itself, while the
manager API keeps serving it (rule 5 / OQ 2 exact). Notify recipient set bounded
live: exactly the four enrolled users (manager, section editor, reader, admin-as-
manager) got one row per create, nobody else; a **disabled** account is skipped at
job time (`Repo::user()->get()` defaults `allowDisabled=false`) — spec rule 8
sharpened. fr_CA-only announcement is visible on the `en` reader pages via
primary-locale fallback (new rule 11); cross-journal and non-existent detail ids
bounce to the visited journal's list; a *disabled journal* walls off its announcement
pages behind the journal login (owned by journal access, not this spec). Site reader
page `/index/announcement` 404s while the site toggle is off (rule 10 re-verified).

**Atom/seam audit clean.** All 22 claims single-owner in the sweeps.
`NOTIF-new-announcement`, `JOB-newannouncementnotifyusers`, `MAIL-announcement-notify`
correctly claimed HERE (the firing side); the framework atoms feature 80 will need
(`PAGE-notification-unsubscribe`, the trivial/flash NOTIF-* rows) remain unclaimed —
no re-claim conflict. `PLUGIN-generic-announcementFeed` stays with web-feeds-
syndication (46, row 107 referenced not claimed); home section → 36; nav item → 61;
`PAGE-management-settings-website` → website-appearance-settings with the
Announcements tab noted. Note: `announcements.spec.js` test-4 comment calls fullTitle
"broken and unused" — assertions unaffected (they test the reader-facing plain title),
comment merely stale against the row-143b correction; file deliberately not touched.
Scratch residue: journals 39/40/41 (`annv*`) with a handful of announcements, types
and notification rows; temp uploads 3-4 consumed/left; no cleanup performed.
