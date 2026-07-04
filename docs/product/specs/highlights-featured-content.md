---
name: highlights-featured-content
scope: How a journal manager (or a site admin, site-wide) curates an ordered set of "highlights" — small featured cards, each a title + short text + optional image + a labelled link button — that the reader theme shows as a carousel across the top of the home page
shared: pkp-lib   # The whole feature lives in lib/pkp and is shared verbatim with OMP/OPS: the highlights/highlight_settings tables (HighlightsMigration), the Highlight entity + Repository + Collector + DAO, the highlight schema, the HighlightForm + HighlightsListPanel Vue surface, and the /highlights REST controller. OJS adds nothing of its own except that its active theme (DefaultThemePlugin) renders the carousel — the reader render is owned by journal-homepage, not here. Tagged pkp-lib to flag the shared code for a future extraction; OJS documents the management (config) side.
status: verified
e2e-plans: [journal-homepage]
atlas-claims:
  - VUE-highlights-list-panel
  - FORM-highlight-form
  - SCHEMA-highlight
  - DB-highlights
  - DB-highlight_settings
  - API-highlight-get-many
  - API-highlight-get
  - API-highlight-add
  - API-highlight-edit
  - API-highlight-order
  - API-highlight-delete
---

# Highlights (featured content) — the management side

## Purpose

A **highlight** is a small featured card a journal manager composes to promote something — a call for
papers, a new issue, an award, an external resource. Each highlight is a **title**, a short **description**,
an optional **image**, and a **link button** (a URL plus its button label, e.g. *"Read more"*). A manager
curates an **ordered list** of them on the journal's Website settings, and the reader theme renders that list
as a **carousel** across the top of the journal home page. This spec owns the **management (config) side** —
the panel where a manager **adds, edits, deletes and reorders** highlights, the fields of a highlight, the
entity that stores them, and the CRUD API behind the panel. It does **not** own the reader-facing carousel
render, which is the home page's job (`journal-homepage`, rule 6).

Highlights also exist at the **site level** (`contextId` null) for the multi-journal front page; those are
managed by a **site administrator** through the equivalent panel on Site Settings, and are otherwise the same
entity and API. Highlights are purely promotional — they carry no publication state, trigger no
notifications, and are visible to whoever the theme shows the home page to.

## Actors & permissions

The panel and every one of its API routes are gated to **journal managers and site administrators only**
(`HighlightsController::getRouteGroupMiddleware()` → `roleAuthorizer([ROLE_ID_MANAGER, ROLE_ID_SITE_ADMIN])`,
plus `has.user`). All six routes share that one middleware group, so **view / add / edit / delete / reorder
carry the identical permission** — there is no finer-grained split. "Manager" below means a user holding the
**Journal manager** role in the journal whose highlights are being managed; a **site admin** qualifies both in
a journal context and (uniquely) for **site-level** highlights. When there is **no journal in context**
(the site front page's highlights), the role set is narrowed to **site admin only**
(`getSiteRoleAssignments()` drops the manager assignment). Editors (sub-editors), assistants, authors,
reviewers and readers have **no** access — they see no Highlights tab and every API call returns
*not authorized*. <sup>a</sup>

| Action | Who may — and when |
|--------|--------------------|
| **See / open the Highlights panel** (Settings → Website → Setup → Highlights) | • Journal managers — for their journal, any time<br>• Site admins — for any journal, and for the **site** front page (Administration → Site Settings → Highlights, shown only on a **multi-journal** site) <sup>a</sup> |
| **Add a highlight** | • Journal managers / site admins — as above <sup>b</sup> |
| **Edit a highlight** | • Journal managers / site admins — as above; the highlight's **journal cannot be changed** via edit <sup>c</sup> |
| **Delete a highlight** | • Journal managers / site admins — as above; a confirm dialog guards it <sup>d</sup> |
| **Reorder highlights** | • Journal managers / site admins — as above; reordering rewrites the whole list's sequence <sup>e</sup> |
| **See the highlights carousel** (reader) | • Any visitor — governed off-page by the home page + active theme, **not** by this feature (`journal-homepage`, rule 6) <sup>f</sup> |

<sup>a</sup> `HighlightsController::getRouteGroupMiddleware()` (`ROLE_ID_MANAGER`, `ROLE_ID_SITE_ADMIN`); `getSiteRoleAssignments()` (no-context → site-admin only); panel mount `management/website.tpl` (`setup` tab → `highlights` side-tab), site variant `admin/settings.tpl` (`{if $componentAvailability['highlights']}`, `= $isMultiContextSite`) · live-verified 2026-07-04: `dbarnes` (manager) 200 on all routes; `dbuskins` (section editor) 401 `roleBasedAccessDenied` on GET+POST.
<sup>b</sup> `HighlightsController::add()` → `Repo::highlight()->add()`.
<sup>c</sup> `HighlightsController::edit()` (`unset($params['contextId'])`) · live-verified 2026-07-04: PUT with `contextId:999` kept `contextId:1`.
<sup>d</sup> `HighlightsController::delete()`; Vue `openDeleteModal()` (`manager.highlights.confirmDelete`).
<sup>e</sup> `HighlightsController::order()`; Vue `saveOrder()`.
<sup>f</sup> Owned by `journal-homepage` (`PKPIndexHandler::getHighlights()`, `frontend/components/highlights.tpl`); named here only to place the seam.

## Fields & validation

The Add/Edit form (`HighlightForm`) presents five fields. **Title**, **URL** and **Button Label** are
**required**; **Description** and **Image** are optional. Title, Description and Button Label are
**multilingual** (one value per journal form-locale; the required check applies to the **primary locale**);
URL is a **single** value. There is **no character-limit or format validation surfaced to the user** beyond
required-ness — in particular the URL is stored **as typed** (see rule 6). `sequence` is not a user field;
the server assigns it (rule 3). <sup>live-verified 2026-07-04: `POST {}` → *This field is required* on title, url, urlText only; a title-only POST still flagged url + urlText; a full POST (no description, no image) succeeded.</sup>

| Field (UI label) | Required? | Rules | Anchor |
|------------------|-----------|-------|--------|
| **Title** | Yes (primary locale) | Multilingual rich-text (single line). The list panel shows the localized title as each row's identity. | `HighlightForm` `title` (`FieldRichText`, `isMultilingual`); `highlight.json` `title` (`required`, `multilingual`) |
| **Description** | No | Multilingual rich **textarea** (large). Short body text under the title in the carousel card. | `HighlightForm` `description` (`FieldRichTextarea`); `highlight.json` `description` (`nullable`, `multilingual`) |
| **URL** | Yes | Single (non-multilingual) text. The destination the card's button links to. Field help: *"The full URL, including https://…"* — but **any string is accepted** (rule 6). | `HighlightForm` `url` (`FieldText`); `highlight.json` `url` (`required`, `format: uri` — *not enforced*) |
| **Button Label** (`urlText`) | Yes (primary locale) | Multilingual text. The label on the link button, e.g. *"Read More"*. | `HighlightForm` `urlText` (`FieldText`, `isMultilingual`); `highlight.json` `urlText` (`required`, `multilingual`) |
| **Image** | No | Single image upload (not multilingual). Carousel card image; carries **alt text**. Uploaded via the temporary-file mechanism and moved into the journal's public files on save. | `HighlightForm` `image` (`FieldUploadImage`); `highlight.json` `image` (`nullable`, object w/ `temporaryFileId`, `altText`, `uploadName`) |

## Rules & state

Highlights are a flat, per-context (or site-level) **ordered list**. Each highlight is one row in
`highlights` (with `context_id`, `sequence`, `url`) plus localized `title` / `description` / `urlText` and the
`image` object in `highlight_settings`. There is **no lifecycle/state machine** — a highlight simply exists
and has a position; it is never "published" or "draft". The manager works entirely through the
**HighlightsListPanel** and its side-modal form; every mutation is a REST call to `/highlights`.

**Where it is reached & how the panel works**

1. **The manager reaches highlights at Settings → Website → Setup → Highlights.** On the journal Website
   settings page the top-level **Setup** tab contains a **Highlights** side-tab (label *"Highlights"*) that
   mounts the `HighlightsListPanel`. The panel lists existing highlights (each row: localized **title** + an
   **Edit** and a **Delete** button), with an **Add Highlight** button and an **Order** button in its header.
   The **site-level** equivalent is Administration → Site Settings → **Highlights**, shown **only on a
   multi-journal site** (`componentAvailability['highlights'] = $isMultiContextSite`, i.e. the install has
   ≠1 context). *(anchor: `management/website.tpl` (`<tab id="setup">` → `<tab id="highlights">` →
   `<highlights-list-panel>`); `ManagementHandler::getHighlightsListPanel()`; `admin/settings.tpl` +
   `AdminHandler::getHighlightsListPanel()` + `AdminHandler` `componentAvailability`; live-verified
   2026-07-04 — the Website settings page for `publicknowledge` carries the Highlights tab and panel config.)*
2. **Add / Edit open a side-modal form; the panel is pre-loaded, not lazily fetched.** The panel is seeded
   server-side with the current list (`getHighlightsListPanel()` passes `items` = the context's highlights,
   summarized). **Add** opens the `HighlightForm` as a `POST` to `/highlights`; **Edit** clones the form,
   pre-fills each field from the already-loaded row, and switches it to a `PUT` to `/highlights/{id}`. On
   success the panel refetches (add) or swaps the row in place (edit). *(anchor:
   `HighlightsListPanel.vue` `openAddModal()` / `openEditModal()` / `formSuccess()`; the panel never calls
   `GET /highlights/{id}` — see rule 8.)*

**The highlight entity & CRUD**

3. **Adding a highlight appends it to the end of the list.** When `sequence` is not supplied the server sets
   it to **last + 1** (or **1** for the first highlight) so a new highlight sorts last. `contextId` is stamped
   from the request context (null at site level). The list is always returned/ordered by `sequence` ascending.
   *(anchor: `HighlightsController::add()` (`$params['sequence'] = getNextSequence()`);
   `Repository::getNextSequence()` / `DAO::getLastSequence()`; `Collector::getQueryBuilder()`
   (`orderBy('h.sequence','asc')`); live-verified 2026-07-04 — first add got `sequence:1`, second `sequence:2`.)*
4. **Editing merges the submitted fields; the journal cannot be reassigned.** `edit()` validates and merges
   the posted props over the existing highlight, then re-reads and returns it. Any `contextId` in the payload
   is **stripped** — a highlight can never be moved between journals (or between a journal and the site) via
   the API. *(anchor: `HighlightsController::edit()` (`unset($params['contextId'])`); `Repository::edit()`;
   live-verified 2026-07-04 — `contextId:999` in a PUT was ignored, stayed `1`.)*
5. **Deleting removes the row, its settings, and its image.** `delete()` reads the highlight, deletes it, and
   returns the deleted props. The repository also removes the stored **image file** (if any) before deleting
   the DB rows; `highlight_settings` cascades on the FK. A missing id returns *highlight not found* (404).
   *(anchor: `HighlightsController::delete()`; `Repository::delete()` (`deleteImage()` + `dao->delete()`);
   `HighlightsMigration` (`highlight_settings` FK `onDelete('cascade')`); live-verified 2026-07-04 — deletes
   returned 200 and both tables returned to 0 rows.)*
6. **The URL is stored exactly as typed — it is not format-validated.** The `url` prop declares
   `format: uri` in the schema and the field help says *"The full URL, including https://…"*, but OJS's
   validator only applies a property's explicit `validation` array (here just `nullable` + the required
   check), and **ignores the JSON-schema `format` keyword entirely**. So a manager can save a highlight
   whose URL is an arbitrary non-URL string and it persists without complaint; the carousel button will link
   to whatever was entered. This matches how OJS handles URL fields generally (no format enforcement) — it is
   **not** a highlights-specific contradiction, so it is documented as a plain rule, not a ⚠. *(anchor:
   `PKPSchemaService::getValidationRules()` (uses `propSchema->validation` only; no `format` handling);
   `highlight.json` `url` (`validation: ["nullable"]`); live-verified 2026-07-04 — `url:"not a url"` saved,
   HTTP 200.)*

**Ordering**

7. **Reordering is an explicit mode that rewrites the whole list's sequence.** The panel's **Order** button
   switches the list into ordering mode, replacing Edit/Delete with up/down arrows; **Save Order** posts the
   full ordered list to `PUT /highlights/order` as `[{id, sequence}, …]`. The server looks up every id in the
   payload, **rejects the whole request if any id is unknown** (400 *order highlight not found*) or if the
   list is empty (400 *no order data*), then writes each highlight's new `sequence` and returns the reordered
   collection. The panel renumbers sequences **0-based** on save; the add path starts at **1** — so exact
   sequence integers are an internal detail (only their relative order is meaningful). *(anchor:
   `HighlightsController::order()` (all-or-nothing id check, then per-item `edit(['sequence'])`);
   `HighlightsListPanel.vue` `saveOrder()` (0-based renumber, `X-Http-Method-Override: PUT`);
   live-verified 2026-07-04 — reorder of `[{8,0},{7,1}]` returned the list with 8 first; a bogus id and an
   empty list each returned 400 with the respective message.)*

**Scoping**

8. **⚠ Fetching a single highlight by id is broken whenever a journal is in context (500).**
   `HighlightsController::get()` passes the **Context object** where the repository expects an **integer
   context id** (`Repo::highlight()->get($id, $this->getRequest()->getContext())`), whereas the sibling
   `edit()` and `delete()` correctly pass `$context?->getId()`. So `GET /highlights/{id}` throws a
   `TypeError` (500) for **any** id — existing or missing — as long as a journal is in scope. The management
   panel never calls this route (it edits from the pre-loaded list, rule 2), which is why the defect is
   invisible in normal use; the endpoint is effectively dead for context-scoped highlights. *(anchor:
   `HighlightsController::get()` (line 117 — `getContext()` vs `getId()`), contrast `edit()`/`delete()`;
   live-verified 2026-07-04 — `GET /highlights/7` and `/highlights/99999` both 500 with the TypeError;
   e2e ledger row 100.)*
9. **Highlights are scoped to a journal or to the site; a context sees only its own.** The list API filters by
   the current context's id; with **no** context it returns **site-only** highlights
   (`context_id` null, coalesced to 0). Site and journal highlights never mix in one list. The `MAX_COUNT` cap
   is 100 highlights per fetch. *(anchor: `HighlightsController::getMany()` (`filterByContextIds` vs
   `withSiteHighlights(SITE_ONLY)`); `Collector::getQueryBuilder()` (`COALESCE(context_id,0)`);
   `HighlightsController::MAX_COUNT = 100`.)*

## Side effects

- **Data written.** Each add creates one `highlights` row plus `highlight_settings` rows for the localized
  title / description / urlText; edit updates them; delete removes them (settings cascade on FK). Reorder
  updates the `sequence` column across the affected rows.
- **Image files.** When an image is supplied, the uploaded temporary file is **moved into the journal's (or
  site's) public files** under a `highlights/` subdirectory, named `{highlightId}.{ext}`, and its metadata
  (upload name, alt text, date) stored on the highlight. Replacing an image deletes the previous file; deleting
  a highlight deletes its image. *(anchor: `Repository::handleImageUpload()` / `storeTemporaryFile()` /
  `deleteImage()`, subdir `getImageSubdirectory() = 'highlights'`.)*
- **Reader carousel.** Adding/removing highlights changes what the **home-page carousel** shows on the next
  reader visit — but that render is owned by `journal-homepage` (no cache invalidation is this feature's
  concern). *(live cross-check 2026-07-04 — with one highlight seeded, the `publicknowledge` home page emitted
  the Swiper markup; after cleanup, gone.)*
- **Plugin hooks.** `Highlight::validate`, `Highlight::add`, `Highlight::edit`, `Highlight::delete(::before)`
  and `Highlight::Collector` fire, letting plugins extend or observe highlight handling.
- **No emails, no notifications, no event-log entries.** Curating highlights is a pure settings action.

## Settings that modify behavior

- **Active theme (reader render).** Curating highlights only produces a visible carousel **if the active
  theme renders highlights** — the default OJS theme loads the Swiper carousel and renders
  `frontend/components/highlights.tpl`; a theme that ignores highlights would leave curated highlights with no
  reader effect. *Owner: `website-appearance-settings` (theme) / `journal-homepage` (render).*
- **Multi-journal install (site-level panel).** The **site** Highlights panel appears only when the install has
  more than one context (`$isMultiContextSite`); on a single-journal install site-level highlights are not
  manageable through the admin UI. *Owner: this feature (site variant) / `site-settings`.*
- **Journal form locales.** Which locale inputs the Title / Description / Button Label fields offer is the
  journal's supported form locales (site locales at site level). *Owner: `languages-locales`.*

## Cross-feature interactions

- **journal-homepage** (feature, verified) — owns the **reader carousel render** (its rule 6:
  `PKPIndexHandler::getHighlights()` + `frontend/components/highlights.tpl` Swiper). This spec owns the
  **management** panel and CRUD. **Atom transfer:** `VUE-highlights-list-panel` was interim-held by
  journal-homepage (which flagged it as "the management panel, not reader-rendered"); it is **now owned here**,
  and journal-homepage retains only the render (it has no atom of its own for the Smarty carousel template).
- **website-appearance-settings** (feature 57, not written) — owns the **Website settings page** that hosts
  the Highlights tab and owns the **theme** that decides whether/how the carousel renders. This feature owns
  the **Highlights tab's content** (the panel + form) specifically; the broader Website/Setup tab scaffolding
  and theme options belong there.
- **announcements** (feature 64, not written) — a **parallel** config-CRUD-with-reader-display surface living
  as a **sibling side-tab** under the same Setup group; a **distinct entity** (announcements have dates,
  types, a dedicated reader page). No shared data; noted only as the nearest shape analogue.
- **site-settings** — owns the multi-journal **site front page** that renders site-level highlights and the
  admin Site Settings shell hosting the site Highlights panel.

## Canonical scenarios

1. **A manager adds a highlight** — Journal manager: Settings → Website → **Setup** → **Highlights** →
   *Add Highlight*. Enters a **Title**, a **URL** and a **Button Label** (required), optionally a
   **Description** and an **Image**, and saves. The highlight appears at the **end** of the list (server-assigned
   sequence), and on the next reader visit the home-page carousel shows it (render owned by `journal-homepage`).
   Omitting Title, URL or Button Label blocks the save with *"This field is required."* *(fields + rule 3 +
   validation; live-verified 2026-07-04 via the API as `dbarnes`.)*
2. **A manager edits a highlight** — The manager clicks **Edit** on a row; the side-modal opens pre-filled from
   the already-loaded highlight; changing the title (or any field) and saving updates the row in place. The
   highlight's journal cannot be changed. *(rule 4; live-verified 2026-07-04 — title edit persisted, a planted
   `contextId` was ignored.)*
3. **A manager reorders highlights** — With ≥2 highlights, the manager clicks **Order**, moves a highlight up
   or down with the arrows, and clicks **Save Order**; the list persists in the new order and the carousel
   follows. Saving an order that references a non-existent highlight, or an empty order, is rejected. *(rule 7;
   live-verified 2026-07-04 — reorder succeeded; bogus-id and empty-list orders each returned an error.)*
4. **A manager deletes a highlight** — The manager clicks **Delete**, confirms in the dialog, and the highlight
   (and its stored image, if any) is removed; it disappears from the list and from the carousel. *(rule 5;
   live-verified 2026-07-04 — deletes returned the removed highlight and the tables returned to empty.)*
5. **A non-manager cannot manage highlights** — A section editor (or assistant/author/reviewer) sees **no
   Highlights tab** and, calling the API directly, is refused (*not authorized*). Only journal managers and
   site admins reach the panel and the CRUD routes; site-level highlights are site-admin-only. *(permission
   boundary; live-verified 2026-07-04 — `dbuskins` GET and POST both 401 `roleBasedAccessDenied`.)*

## Known deviations (as-built ≠ intent)

- **⚠ `GET /highlights/{id}` returns 500 in a journal context (rule 8) — e2e ledger row 100 (new).**
  `HighlightsController::get()` passes the Context object where an integer context id is expected, so the
  single-fetch route throws a `TypeError` for every id whenever a journal is in scope. Sibling `edit()`/
  `delete()` do it correctly (`$context?->getId()`). The management UI never hits this route (it edits from the
  pre-loaded list), so the defect is masked in normal use — but the endpoint is unusable for context-scoped
  highlights, and the `_href` the API returns for each highlight points at it. Suspected intent: return the
  single highlight (200 / 404), as `edit`/`delete` resolve the context. One-line fix:
  `->get($id, $context?->getId())`. *(Verifier re-confirmed live 2026-07-04 as manager `dbarnes`: a
  freshly-added highlight (`GET /highlights/31`) and a missing one (`GET /highlights/99999`) **both** returned
  HTTP 500 — `PKP\highlight\Repository::get(): Argument #2 ($contextId) must be of type ?int, APP\journal\Journal
  given … HighlightsController.php on line 117`; the added highlight's `_href` was `…/api/v1/highlights/31`,
  the dead route. `getMany`/`add`/`delete` on the same session returned 200; the panel's `openEditModal()`
  edits from the pre-loaded `items` and never calls this route.)*
- **Not a deviation — URL not format-validated (rule 6).** The `url` schema declares `format: uri` but OJS
  never enforces JSON-schema `format` (only the explicit `validation` array). Every OJS URL field behaves this
  way, so this is a documented plain rule, not an internal contradiction — kept below the ⚠ bar per the
  charter's calibration.

## Open questions

1. **Is the single-highlight GET (rule 8 / ledger 100) meant to work?** As-built it 500s in a journal context.
   Confirm it should resolve the context id and return the highlight (the `_href` on every highlight advertises
   this route), vs. being intentionally unused — in which case the route and `_href` could be dropped.
2. **Should the highlight URL be validated as a real URL?** As-built (rule 6) any string is accepted despite
   the field help promising a full `https://…` URL. Confirm whether URL-format validation is wanted here (it
   would diverge from OJS's general no-format-validation convention) or the free-text behaviour is intended.
3. **Is site-level highlight management meant to be hidden on single-journal installs?** The site Highlights
   panel shows only when the install has >1 context (`$isMultiContextSite`); on a one-journal site there is no
   UI to curate site-front-page highlights even though the entity supports them. Confirm this is intended.

---

<!-- REFERENCE MATERIAL — provenance and campaign bookkeeping, not product-owner narrative. -->

## Reference — entry points & surfaces

| Entry | Path | Atom |
|-------|------|------|
| Highlights management panel (journal) | Settings → Website → **Setup** → **Highlights** → `management/website.tpl` → `<highlights-list-panel>` (config from `ManagementHandler::getHighlightsListPanel()`) | VUE-highlights-list-panel |
| Highlights management panel (site) | Administration → Site Settings → **Highlights** (multi-journal only) → `admin/settings.tpl` → `AdminHandler::getHighlightsListPanel()` | VUE-highlights-list-panel |
| Add/Edit highlight form | `HighlightForm` (title, description, url, urlText, image) rendered in the panel's side-modal | FORM-highlight-form |
| Highlight entity (schema) | `lib/pkp/schemas/highlight.json` | SCHEMA-highlight |
| Highlights table | `highlights` (`context_id`, `sequence`, `url`) | DB-highlights |
| Highlight settings table | `highlight_settings` (localized title / description / urlText, image object) | DB-highlight_settings |
| List highlights | `GET /api/v1/highlights` → `HighlightsController::getMany()` | API-highlight-get-many |
| Get one highlight (**500 in context — rule 8**) | `GET /api/v1/highlights/{id}` → `HighlightsController::get()` | API-highlight-get |
| Add highlight | `POST /api/v1/highlights` → `HighlightsController::add()` | API-highlight-add |
| Edit highlight | `PUT /api/v1/highlights/{id}` → `HighlightsController::edit()` | API-highlight-edit |
| Reorder highlights | `PUT /api/v1/highlights/order` → `HighlightsController::order()` | API-highlight-order |
| Delete highlight | `DELETE /api/v1/highlights/{id}` → `HighlightsController::delete()` | API-highlight-delete |

## Reference — code anchors

- **API**: `lib/pkp/api/v1/highlights/HighlightsController.php` (`getRouteGroupMiddleware()` role gate,
  `getGroupRoutes()`, `authorize()` + `getSiteRoleAssignments()`, `getMany`/`get`/`add`/`edit`/`order`/`delete`,
  `MAX_COUNT`).
- **Entity / persistence**: `lib/pkp/classes/highlight/` — `Highlight.php` (model), `Repository.php`
  (`validate()`, `add()`/`edit()`/`delete()`, `getNextSequence()`, image handling), `Collector.php`
  (`filterByContextIds`/`withSiteHighlights`, `orderBy sequence`), `DAO.php` (`get()`, `getLastSequence()`,
  `schema = SCHEMA_HIGHLIGHT`, `parentKeyColumn = context_id`), `maps/Schema.php` (schema mapping / `_href`).
- **Schema / migration**: `lib/pkp/schemas/highlight.json` (required title/url/urlText/sequence; multilingual
  title/description/urlText; nullable image/description; `format: uri` on url — unenforced);
  `lib/pkp/classes/migration/install/HighlightsMigration.php` (`highlights` + `highlight_settings`).
- **Form / panel**: `lib/pkp/classes/components/forms/highlight/HighlightForm.php`;
  `lib/pkp/classes/components/listPanels/HighlightsListPanel.php` (config + i18n keys);
  `lib/ui-library/src/components/ListPanel/highlights/HighlightsListPanel.vue` (add/edit/delete/order UI);
  mounts `lib/pkp/templates/management/website.tpl` (`setup`→`highlights`) and
  `lib/pkp/templates/admin/settings.tpl` (`componentAvailability['highlights']`).
- **Handlers wiring**: `lib/pkp/pages/management/ManagementHandler.php` `getHighlightsListPanel()`;
  `lib/pkp/pages/admin/AdminHandler.php` `getHighlightsListPanel()` + `componentAvailability` (`$isMultiContextSite`).
- **Locale keys**: `common.highlights` / `common.title` / `common.description` / `common.url` / `common.order`;
  `manager.highlights.{add,edit,delete,confirmDelete,image,url.description,urlText,urlText.description}`;
  `api.highlights.{400.noOrderData,400.orderHighlightNotFound,404.highlightNotFound}`.
- **Test infra**: `lib/pkp/classes/testing/bootstrap/Processor/HighlightProcessor.php` (seed context highlights:
  `{title, url, urlText?, description?, sequence?}`, image-less); `lib/pkp/classes/testing/scenario/schema/context.json`
  (`highlights[]` passthrough — "presence drives the reader home page's highlights carousel").
