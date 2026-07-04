---
name: issue-management
scope: The full editorial lifecycle of a journal issue — create/edit/delete issues, order the Future and Back issue lists, build and order an issue's table of contents, upload the issue cover and issue-level galleys, publish an issue (flipping its scheduled articles live and notifying readers), unpublish it, and choose which issue is "current"
shared: no               # Issues are an OJS-only concept. The Issues management page (ManageIssuesHandler), every issue grid (IssueGridHandler + Back/Future/Toc/IssueGalley), the Issue/IssueGalley entities, forms, the /api/v1/issues controller, the IssuePublishedNotifyUsers job and IssuePublishedNotify mailable all live in the OJS app (pages/, controllers/, classes/, api/v1/). The generic grid/notification/mail infrastructure they extend is pkp-lib, referenced. No OMP/OPS equivalent (monographs have no "issue").
status: verified
e2e-plans: [issue-assignment-scheduling]
atlas-claims:
  - PAGE-manageissues-index
  - GRID-grid-issues-back-issue-grid-handler
  - GRID-grid-issues-future-issue-grid-handler
  - GRID-grid-issue-galleys-issue-galley-grid-handler
  - GRID-grid-toc-toc-grid-handler
  - SCHEMA-issue
  - DB-issues
  - DB-issue_settings
  - DB-issue_files
  - DB-issue_galleys
  - DB-issue_galley_settings
  - DB-custom_issue_orders
  - API-issue-get-many
  - API-issue-get-current
  - API-issue-get
  - NOTIF-published-issue
  - JOB-issuepublishednotifyusers
  - MAIL-issue-published-notify
  - AUTHZ-ojs-issue-required-policy
  - AUTHZ-ojs-journal-must-publish-policy
  - AUTHZ-ojs-issue-galley-required-policy
---

# Issue management (the Issues page — create, build, publish issues)

## Purpose

A journal publishes its articles inside **issues**. This spec owns the **editorial issue
lifecycle**: the **Issues** management page (Editorial menu → **Issues**), where a journal
manager creates an issue (its volume / number / year / title), lists **Future Issues** (not yet
published) and **Back Issues** (published), builds each issue's **Table of Contents** (which
articles, in which order, under which sections), uploads the issue **cover image** and any
issue-level **galleys** (a full-issue PDF), and then **publishes** the issue — the single act
that turns every article scheduled into it live on the reader site, makes the issue the
journal's **current** issue, and (optionally) emails the readership. It also owns
**unpublishing**, **deleting**, and explicitly **setting the current** issue. It does **not**
own assigning an *individual article* to an issue (that is `publication-issue-assignment`, done
on the article's Publication → Issue tab), publishing an *individual article* (`publication-
publish-flow`), the *reader-facing* issue archive / TOC page (`issue-archive-toc`), or the
current-issue block on the journal home page (`journal-homepage`).

The entire surface is **legacy grid UI** — jQuery grids and AjaxModal dialogs, not the modern
Vue workflow — reached only by managers and site admins.

## Actors & permissions

Recurring terms and baselines, stated once. **Manager** = journal manager (`ROLE_ID_MANAGER`).
**Site admin** = `ROLE_ID_SITE_ADMIN`, who acts as a manager on any journal. The **one gate that
governs almost every row below**: the Issues page and *every* issue grid (`IssueGridHandler` and
its Back / Future subclasses, `TocGridHandler`, `IssueGalleyGridHandler`) assign their operations
**only to Manager + Site admin**; a section editor / assistant / reviewer / author holds none of
those grid roles, so issue management is **manager/site-admin only** end to end. This is a
deliberate contrast with `publication-issue-assignment`: an assigned **section editor** *can*
place an article into an already-**published** issue from the article's own Publication tab, but
**cannot** create, edit, publish or even open the issue-management surface, and cannot list
**unpublished** issues (the same manager/admin gate produces the row-94 cross-surface boundary).
The behaviour below was **live-verified 2026-07-04**: admin (site admin) reaches every surface;
`dbuskins` (section editor) is bounced from the page to `authorizationDenied
(user.authorization.roleBasedAccessDenied)` and every grid op returns the JSON refusal *"The
current role does not have access to this operation."* <sup>a</sup>

| Action | Who may — and when |
|--------|--------------------|
| **Open the Issues page (Future + Back lists)** | • Managers, site admins — always<br>• Section editors, assistants, reviewers, authors — **never** (bounced to *access denied*; live-verified) <sup>a</sup> |
| **Create an issue** / **Edit an issue's data, cover, identifiers, access, TOC, galleys** | • Managers, site admins — any issue of their journal<br>• Everyone else — **never** <sup>b</sup> |
| **Publish an issue** (→ scheduled articles go live, issue becomes current, readers optionally emailed) | • Managers, site admins — any **unpublished** issue<br>• Everyone else — **never** <sup>c</sup> |
| **Unpublish an issue** / **Set an issue as current** | • Managers, site admins — Unpublish on a published issue; Set-current on a published, non-current issue<br>• Everyone else — **never** <sup>d</sup> |
| **Delete an issue** (its articles return to the editing queue) | • Managers, site admins — any issue<br>• Everyone else — **never** <sup>e</sup> |
| **Manage the TOC** (reorder articles/sections, remove an article, per-article access status) | • Managers, site admins — via the Table of Contents tab<br>• Everyone else — **never** <sup>f</sup> |
| **Add / edit / upload / reorder / delete an issue galley** (a full-issue file) | • Managers, site admins — via the Issue Galleys tab<br>• Everyone else — **never** <sup>g</sup> |
| **Read issues over the API** (`GET /issues`, `/issues/current`, `/issues/{id}`) | • Managers, sub-editors, assistants, reviewers, authors — **published** issues (any journal role)<br>• **Unpublished** issues — managers / site admins **only** (others get *"You do not have permission to view unpublished issues."*, live 403)<br>• Any role — blocked entirely on a journal set to *do not publish online* <sup>h</sup> |

<sup>a</sup> `ManageIssuesHandler::__construct()` (`addRoleAssignment([MANAGER, SITE_ADMIN], ['index'])`) + `authorize()` (`PKPSiteAccessPolicy`); `IssueGridHandler::__construct()` (all ops → `[MANAGER, SITE_ADMIN]`) + `authorize()` (`ContextAccessPolicy` + `OjsIssueRequiredPolicy` when `issueId` present); grids loaded by `templates/manageIssues/issues.tpl` (`FutureIssueGridHandler` / `BackIssueGridHandler`); live 2026-07-04 (admin 200; dbuskins → `authorizationDenied` + grid JSON *"current role does not have access"*) ·
<sup>b</sup> `IssueGridHandler` ops `addIssue`/`editIssue`/`editIssueData`/`updateIssue`/`uploadFile`/`deleteCoverImage`/`access`/`updateAccess`/`identifiers`/`updateIdentifiers`; `IssueForm`; `IssueAccessForm` ·
<sup>c</sup> `IssueGridHandler::publishIssue()` (op gated MANAGER/SITE_ADMIN) ·
<sup>d</sup> `IssueGridHandler::unpublishIssue()` / `setCurrentIssue()`; `IssueGridRow::initialize()` (which row buttons appear) ·
<sup>e</sup> `IssueGridHandler::deleteIssue()` ·
<sup>f</sup> `TocGridHandler::__construct()` (`[MANAGER, SITE_ADMIN]`, ops `fetchGrid`/`fetchCategory`/`fetchRow`/`saveSequence`/`removeArticle`/`setAccessStatus`) ·
<sup>g</sup> `IssueGalleyGridHandler::__construct()` (`[MANAGER, SITE_ADMIN]`, ops `add`/`edit`/`upload`/`download`/`update`/`delete`/`saveSequence`) + `OjsIssueGalleyRequiredPolicy` ·
<sup>h</sup> `api/v1/issues/IssueController::getRouteGroupMiddleware()` (roles Manager|SubEditor|Assistant|Reviewer|Author) + `authorize()` (`OjsJournalMustPublishPolicy`); `getMany()` (`$isAdmin` = MANAGER/SITE_ADMIN → 403 `api.submissions.403.unpublishedIssues` on `isPublished=0`, else silently forces `filterByPublished(true)`); live 2026-07-04 (admin `isPublished=0` → 200; dbuskins → 403)

## Fields & validation

The **issue-data form** (`IssueForm`, the "Issue Data" tab; new-issue is the same form with an
empty issue). Fields below are what a manager sees; multilingual fields carry one value per
supported journal locale. **Issue identification is the load-bearing rule**: volume, number,
year and title are each individually optional, but the form refuses to save unless **at least one
of the four "Show …" toggles is on**, and any field whose toggle is on becomes **required**.
**On a *new* issue all four toggles default *on*** — `IssueForm::initData()` seeds every `show*`
= 1 (not just three) — so a brand-new issue must fill *every* identification part (Volume, Number,
Year **and** Title) unless the manager first **unchecks** the toggles for the parts being left
blank; in particular an empty **Title** on a new issue is refused with *"Title is required for the
issue."* until *Show Title* is unchecked or a title is entered (as-built; live-verified via the
retained suite).

| Field (UI label) | Required? | Rules | Anchor |
|------------------|-----------|-------|--------|
| **Volume** | Only if *Show Volume* is on | Digits only. Stored as integer; blank saved as null | `IssueForm` (`volume`, `FormValidatorRegExp /^[0-9]+$/`; `showVolume` custom check) |
| **Number** | Only if *Show Number* is on | Free string (e.g. "2", "S1") | `IssueForm` (`number`; `showNumber` custom check) |
| **Year** | Only if *Show Year* is on | Stored as integer | `IssueForm` (`year`; `showYear` custom check) |
| **Title** | Only if *Show Title* is on | Multilingual; required only when *Show Title* is on. New issues default *Show Title* **on** — together with the other three (`initData()` seeds all four `show*` = 1) — so an empty Title on a new issue is refused (*"Title is required for the issue."*) unless *Show Title* is unchecked | `IssueForm` (`title`; `showTitle` custom check; `initData()` else-branch = all four on) |
| **Show Volume / Number / Year / Title** (checkboxes) | **≥1 must be on** | Control which identification parts render; the combined check *"Issue identification is required…"* blocks a save with all four off. **All four default *on* on a new issue** (`initData()` else-branch), so each part is required until its toggle is unchecked | `IssueForm::readInputData()` (`issueForm` custom check → `editor.issues.issueIdentificationRequired`); `initData()` (new-issue defaults) |
| **Description** | No | Multilingual rich text shown on the issue page | `IssueForm` (`description`) |
| **Cover Image** | No | One uploaded image per locale + **Cover Image Alt Text**; upload validated as an image; a delete link removes it. Two-step: upload to a temp file, then the save copies it to `cover_issue_{id}_{locale}` | `IssueForm::validate()`/`execute()` (`temporaryFileId`, `coverImageAltText`; `editor.issues.invalidCoverImageFormat`); `IssueGridHandler::uploadFile()`/`deleteCoverImage()` |
| **URL Path** | No | Optional slug used in the issue URL instead of the id; alphanumeric with `.-_` separators, **not all-digits**, and **unique** among the journal's issues | `IssueForm::validate()` (`urlPath` regex; `publication.urlPath.numberInvalid` / `publication.urlPath.duplicate`) |
| **Date Published** | Only if the issue **is published** | `Y-m-d`. Optional for a future issue; **required once published** (and stamped automatically at publish if left blank). Set it manually to back-date | `IssueForm::validate()` (`date_format:Y-m-d`; `editor.issues.datePublished.requiredWhenPublished`) |

**Access tab** (`IssueAccessForm`, shown **only on subscription journals**): **Access Status**
(Open Access / Subscription) and an **Open Access Date** (when a subscription issue becomes open).
A new issue's access status is seeded from the journal's publishing mode (subscription/none →
Subscription, open → Open). *(anchor: `IssueAccessForm`; `IssueForm::execute()` new-issue
`accessStatus` seed; `Issue::ISSUE_ACCESS_OPEN`/`ISSUE_ACCESS_SUBSCRIPTION`)*

**Issue-galley form** (`IssueGalleyForm`, per issue galley): a **Label** (e.g. "PDF", required),
a **Language** (when the journal is multilingual), an optional **public galley id**, and **either
an uploaded file** (the full-issue file, stored via `IssueFileManager`) — the entity is
`issue_galleys` + `issue_galley_settings`. Distinct from an article galley (owned by `galleys`).

## Rules & state

An **issue** is one row in `issues` (+ localized `issue_settings`, cover files in `issue_files`)
belonging to one journal. Its lifecycle is a single boolean **`published`** (0 = *Future issue*,
1 = *Back issue*) plus the journal's single **`currentIssueId`** pointer. Articles are not stored
on the issue; each *publication* carries its own `issueId` (owned by `publication-issue-
assignment`), and the issue's TOC is computed by querying publications with that `issueId`.
<sup>a</sup>

**The Issues page & the two lists**

1. **The page is two legacy-grid tabs.** Editorial menu → **Issues** renders
   `manageIssues/issues.tpl` with a **Future Issues** tab (the `FutureIssueGridHandler` grid) and
   a **Back Issues** tab (the `BackIssueGridHandler` grid). Both extend the shared
   `IssueGridHandler`; the page handler itself only sets the title. There is **no Vue** manager
   for issues — this whole feature is legacy grids + AjaxModals (liveness: confirmed both-live in
   the atlas and live-fetched 2026-07-04). *(anchor: `ManageIssuesHandler::index()`;
   `issues.tpl`)*
2. **Future Issues = unpublished; Back Issues = published.** The Future grid loads issues
   `filterByPublished(false)` and carries the **Create Issue** button; the Back grid loads
   `filterByPublished(true)`, adds a **Published** date column, and is **hand-orderable**. *(anchor:
   `FutureIssueGridHandler::loadData()`/`initialize()` (addIssue action);
   `BackIssueGridHandler::loadData()`/`_addCenterColumns()`)*
3. **Back-issue ordering is a custom, draggable order.** Dragging rows in the Back Issues list
   writes a per-journal **custom issue order** (`custom_issue_orders`); absent a custom position an
   issue sorts by its published date, with the **current** issue pinned to the top. *(anchor:
   `BackIssueGridHandler::setDataElementSequence()`→`dao->moveCustomIssueOrder()`,
   `getDataElementSequence()` (custom order, else current=0, else datePublished); `OrderGridItemsFeature`)*
4. **Row actions depend on the issue's state.** Every row offers **Edit**, **View** (published) /
   **Preview** (unpublished), and **Delete**. An **unpublished** row adds **Publish Issue**; a
   **published** row adds **Unpublish Issue**, and — when it is not already current — **Current
   Issue** (set-current). *(anchor: `IssueGridRow::initialize()`)*

**Create / edit / delete**

5. **Create and edit share one form; new issues start unpublished.** *Create Issue* (and *Edit*)
   open the `IssueForm` in an AjaxModal. Saving a **new** issue inserts it with `published = 0` and
   an access status derived from the journal's publishing mode; editing updates in place. A
   cover-image upload is copied to the public files area only after the issue has an id. A trivial
   "saved" notification confirms. *(anchor: `IssueGridHandler::addIssue()`/`editIssueData()`/
   `updateIssue()`; `IssueForm::execute()`)*
6. **The edit modal is a tabset.** Editing an issue shows tabs **Table of Contents**, **Issue
   Data**, **Issue Galleys**, plus **Identifiers** (only when publisher-ids or a pub-id plugin are
   enabled) and **Access** (only on a subscription journal). *(anchor:
   `IssueGridHandler::editIssue()` → `controllers/grid/issues/issue.tpl`)*
7. **Deleting an issue returns its articles to the editing queue.** Delete (a confirm dialog)
   first walks every submission whose publication is in the issue and resets that publication to
   `issueId = null`, status **Queued** (then recomputes submission status), so the articles are
   **un-published back into the workflow** rather than lost; it then deletes the issue and all its
   galleys, issue files, cover image and custom-order rows. If the deleted issue was **current**,
   the most-recently-published remaining issue becomes current. *(anchor:
   `IssueGridHandler::deleteIssue()`; `Repo::issue()->delete()`)*

**Publish an issue**

8. **Publishing is a two-step confirm.** *Publish Issue* first opens an **Assign Public
   Identifiers** modal that (a) lets the manager assign the issue's DOI/pub-ids, (b) states the
   confirmation *"Are you sure you want to publish the new issue?"*, and (c) offers a **"Send an
   email about this issue"** checkbox (**checked by default**). Confirming submits the publish.
   *(anchor: `IssueGridHandler::publishIssue()` (`AssignPublicIdentifiersForm`, `confirmed` gate);
   `editor.issues.confirmPublish`; live-verified 2026-07-04 — modal carries the checked
   `sendIssueNotification` box)*
9. **Publishing flips the issue live, stamps its date, and makes it current.** On confirm the
   issue's `published` becomes 1; if it had no **Date Published** the current date is stamped; the
   issue's DOI is created/updated; and the issue is set as the journal's **current** issue
   (unconditionally — see rule 16). On a subscription journal with a delayed-open-access duration,
   the issue's open-access date is computed from the delay policy. *(anchor:
   `IssueGridHandler::publishIssue()` → `setPublished(1)`, `setDatePublished(Core::getCurrentDate())`,
   `Repo::issue()->createDoi()`/`Repo::doi()->issueUpdated()`, `Repo::issue()->updateCurrent()`;
   live 2026-07-04 — issue 3 `published:true`, `datePublished` stamped today, became current)*
10. **Publishing an issue publishes its scheduled articles.** Every submission in the issue whose
    current publication is **Scheduled** is published in place (its status becomes **Published**),
    each firing a *Metadata updated* activity event. This is the OJS mechanism by which
    date-scheduled articles go live — there is no date-based auto-publish task in OJS (see
    `publication-publish-flow` rule 15). Already-published publications (e.g. a second version in a
    different issue) are left untouched. *(anchor: `IssueGridHandler::publishIssue()` — collector
    `filterByCurrentPublicationStatus([SCHEDULED, PUBLISHED])`, `Repo::publication()->publish()` per
    Scheduled pub + `event(MetadataChanged)`)*
11. **Publishing optionally notifies the readership.** When the *Send an email* box is checked
    **and** the journal actually publishes online (`publishingMode != NONE`), OJS queues
    `IssuePublishedNotifyUsers` jobs for readers **subscribed to the "issue published" notification**
    (an opt-out default): each gets a **bell notification** (`NOTIFICATION_TYPE_PUBLISHED_ISSUE`,
    linking to *Current Issue*), and those additionally subscribed to **emails** get the
    **ISSUE_PUBLISH_NOTIFY** email. Recipients are chunked into batched jobs. *(anchor:
    `IssueGridHandler::publishIssue()` (`sendIssueNotification` + mode check;
    `NotificationSubscriptionSettingsDAO::getSubscribedUserIds()`; `Bus::batch()` of
    `IssuePublishedNotifyUsers`); live-verified 2026-07-04 — see Side effects)*

**Unpublish / current**

12. **Unpublishing hides the issue and re-schedules its articles.** *Unpublish Issue* (a confirm
    dialog) sets `published = 0`, recomputes the journal's current issue (the issue is no longer
    eligible), and updates the issue DOI. For each **Published** publication in the issue it runs an
    **unpublish then re-publish** so the publication lands back at **Scheduled** (not Queued) — i.e.
    the articles return to *scheduled-into-this-future-issue* — and OAI article tombstones are
    inserted for the now-hidden articles. The issue's assignment on each article is **kept**.
    *(anchor: `IssueGridHandler::unpublishIssue()`)*
13. **Setting the current issue is an explicit choice too.** *Current Issue* on a published,
    non-current issue points the journal's `currentIssueId` at it. Only one issue is current at a
    time. *(anchor: `IssueGridHandler::setCurrentIssue()` → `Repo::issue()->updateCurrent()`;
    `Repo::issue()->getCurrent()` reads `journal.currentIssueId`)*

**The table of contents (editorial)**

14. **The TOC groups the issue's articles by section and is fully re-orderable.** The Table of
    Contents tab renders a category grid: sections are the categories, the issue's articles the
    rows. A manager can **reorder articles** within a section (writing the publication's sequence),
    **reorder sections** within the issue (a custom section order), and **remove an article** from
    the issue — removal unpublishes that article's in-issue publication and clears its sequence, and
    drops the section from the custom order if it was the section's last article. *(anchor:
    `TocGridHandler::loadData()`/`setDataElementInCategorySequence()` (publication `seq`),
    `setDataElementSequence()` (`Repo::section()->upsertCustomSectionOrder()` — the section-order
    table is owned by `journal-sections`), `removeArticle()`)* Note this section/article ordering
    is **separate** from the back-issue-list ordering of rule 3 (`custom_issue_orders`).
15. **On a subscription issue the TOC exposes per-article access.** When the journal is
    subscription-based and the issue's access status is Subscription, each TOC row gains an **access
    status** selector — *open access* vs *use the issue's setting* — written to the publication's
    `accessStatus`. *(anchor: `TocGridHandler::initialize()` (access column gated on
    subscription+issue access), `setAccessStatus()`; the field itself is owned by
    `publication-publish-flow` rule 13 / `subscriptions`)*

**Notable state consequence**

16. **Publishing *any* issue makes it current.** `publishIssue` calls `updateCurrent()` with the
    just-published issue **unconditionally**, so publishing a back-dated or out-of-order issue also
    re-points the journal's current issue at it. This is normal when issues are published newest-
    first; publishing an *older* issue after a newer one would move "current" backwards until a
    manager re-sets it. Documented as a plain rule (see Open questions). *(anchor:
    `IssueGridHandler::publishIssue()` — `updateCurrent($contextId, $issue)`)*

## Side effects

**Publishing an issue** (with *Send an email* checked, journal publishing online):
- **Articles:** every **Scheduled** publication in the issue is published (status → Published,
  reader pages go live, issue TOC entry appears); each fires a **Metadata updated** activity event
  (rule 10). *(cross-entity mutation owned in effect by `publication-publish-flow`)*
- **Issue:** `published = 1`, `datePublished` stamped if empty, issue **DOI** created/updated,
  issue set **current** (rule 9, 16).
- **Notification (bell):** a `NOTIFICATION_TYPE_PUBLISHED_ISSUE` notification per subscribed
  reader, message *"A new issue has been published…"* linking to the journal's **current issue**
  page. *(anchor: `NotificationManager::getNotificationSettingsMap()` (`notificationPublishedIssue`),
  `getNotificationUrl()` (→ `issue/current`))*
- **Email:** the **ISSUE_PUBLISH_NOTIFY** mailable (`IssuePublishedNotify` — from a sub-editor
  identity, to readers, with an **unsubscribe footer**) to each reader also subscribed to emails,
  sent via batched `IssuePublishedNotifyUsers` jobs. **Live-verified 2026-07-04**: publishing the
  scratch issue produced the email *"Just published: Vol. 9 No. 9 (2099): Probe Future Issue of
  Issue Mgmt Probe"* (body links to the issue view page, includes the unsubscribe footer) in
  Mailpit. *(anchor: `IssuePublishedNotifyUsers::handle()`/`createMailable()`; `IssuePublishedNotify`)*

**Unpublishing an issue:** `published = 0`; current issue recomputed; issue DOI updated; each
Published publication returned to **Scheduled** (unpublish+republish); **OAI article tombstones**
inserted for the hidden articles (rule 12).

**Deleting an issue:** its publications reset to `issueId = null` / **Queued** + submission-status
recompute (articles back in the workflow queue); issue galleys, issue files, cover image and
custom-order rows removed; a replacement current issue chosen if needed (rule 7).

**No email or notification** is sent by create, edit, unpublish, delete, set-current, TOC or
galley operations — only the *publish-issue* action notifies, and only when opted in.

## Settings that modify behavior

- **Publishing mode** (`journal-setup` → *"the way this journal will be published"*): **Do not
  publish online** (`NONE`) suppresses the reader notification at publish (rule 11) **and** blocks
  the `/issues` read API entirely (`OjsJournalMustPublishPolicy`). **Subscription** mode adds the
  issue **Access** tab, seeds new issues as *Subscription*, exposes the per-article TOC access
  selector (rule 15), and drives the delayed-open-access date at publish (rule 9). **Open** seeds
  new issues as *Open Access*.
- **Publisher IDs enabled / a pub-id (DOI) plugin** — add the **Identifiers** tab to the issue
  edit modal (rule 6) and the pub-id assignment step to the publish modal (rule 8). The identifier
  rules themselves are owned by `publication-identifiers` / `doi-management`.
- **Notification opt-out** (each user's Notifications settings): a reader who unsubscribes from
  *"A new issue has been published"* (or its email variant) is excluded from rule 11's recipients.
  *(anchor: `NotificationSettingsForm` `notificationPublishedIssue`)*
- **Journal is multilingual** — the issue-galley grid shows a Language column and localized issue
  title/description/cover per supported locale.

## Cross-feature interactions

- **publication-issue-assignment** (feature 34, verified) — owns assigning an *individual article*
  to an issue (the article's Publication → Issue tab) and the assignment-options endpoint
  (`API-issue-get-assignment-options`); it **reads** the `/issues` list this spec owns. This spec
  owns the **issue entity** it assigns *to* and the manager-only unpublished-issue gate that
  produces its row-11 / ledger-row-94 boundary.
- **publication-publish-flow** (feature 32, verified) — owns publishing an *individual article*;
  this spec owns publishing the **issue**, which transitively publishes the issue's **Scheduled**
  articles (its rule 15 ↔ this rule 10). The scheduled-article status machinery and OAI tombstones
  are that spec's; this spec is the trigger.
- **issue-archive-toc** (feature 40, not written) — owns the **reader-facing** issue archive,
  current-issue and single-issue TOC pages and the reader issue-galley download. This spec owns the
  **editorial** TOC grid (article/section ordering, remove, access status) and the issue-galley
  *management*. Seam: the reader pages *display* what this spec *builds*.
- **journal-homepage** (feature 36, not written) — owns the current-issue block on the journal
  home page. This spec owns *setting which issue is current* (rules 9, 13, 16); that spec renders it.
- **journal-sections** — owns the section entity and the **custom section order** table this spec's
  TOC writes into (rule 14); this spec only reorders sections *within an issue*.
- **subscriptions** — owns subscription gating; this spec owns the issue **Access** tab and the
  per-article TOC access selector that feed it (rules 6, 15).
- **doi-management / publication-identifiers** — own issue DOIs / pub-ids assigned at publish and
  on the Identifiers tab (rules 6, 8).
- **galleys** — owns *article* galleys; this spec owns the distinct **issue** galleys
  (`issue_galleys`), which that spec explicitly defers here.

## Canonical scenarios

1. **Create a future issue** — Manager: Editorial → **Issues** → Future Issues → **Create Issue**.
   The new form opens with **all four *Show* toggles on**, so the manager enters Volume 10 / Number 1
   / Year 2027 and **either adds a Title or unchecks *Show Title*** before saving; the issue then
   appears in the Future Issues list, unpublished. Leaving *Show Title* on with an empty Title is
   refused (*"Title is required for the issue."*); unchecking **all four** toggles is refused
   (*"Issue identification is required…"*).
2. **Edit issue data & cover** — Manager: opens an issue's **Issue Data** tab, sets a multilingual
   Title (turning *Show Title* on), a Description and a **Cover Image** (with alt text), and a
   custom **URL Path** ("winter-2027"); saves. An all-digit or duplicate URL path is refused.
3. **Order the Back Issues list** — Manager: drags a back issue above another in the **Back
   Issues** list; the custom order persists (`custom_issue_orders`) and overrides date order, with
   the current issue pinned to the top.
4. **Build the table of contents** — Manager: on an issue's **Table of Contents** tab, reorders two
   articles within a section, moves one section above another, and **removes** an article from the
   issue — the removed article's publication is unpublished and its sequence cleared, and it drops
   off the issue.
5. **Publish an issue — scheduled articles go live & readers are emailed** — Manager: *Publish
   Issue* → the confirm modal (*"Are you sure…?"*, *Send an email* checked) → confirm. The issue
   flips to a **Back issue** with today's date, becomes the **current** issue, every **Scheduled**
   article in it becomes **Published** and reader-visible, and subscribed readers get the
   *"Just published: …"* email + a bell notification (**live-verified**: issue published, email in
   Mailpit with unsubscribe footer).
6. **Continuous publish without notifying** — Manager: unchecks *Send an email* before confirming;
   the issue and its articles publish exactly as in scenario 5 but **no** reader email/notification
   is sent.
7. **Unpublish an issue** — Manager: *Unpublish Issue* on a back issue → it returns to Future
   Issues, its Published articles return to **Scheduled** (still assigned to the issue), OAI
   tombstones are inserted, and the journal's current issue is recomputed.
8. **Delete an issue — articles return to the queue** — Manager: *Delete* on an issue → its
   articles are reset to **no issue / Queued** and reappear in the editing workflow, and the issue,
   its galleys/files/cover are removed; if it was current, the newest remaining issue becomes
   current.
9. **Set the current issue** — Manager: *Current Issue* on an older published, non-current issue →
   the journal's current issue pointer moves to it (the reader home/current pages now show it).
10. **Add an issue galley** — Manager: on the **Issue Galleys** tab, *Add*, labels it "PDF",
    uploads a full-issue PDF, saves; the galley is stored (`issue_galleys`) and can be reordered or
    deleted. (Distinct from an article galley.)
11. **Permission boundary — managers only** — A **section editor** who can assign an article to a
    published issue nonetheless **cannot** open the Issues page (bounced to *access denied*), cannot
    run any issue/TOC/galley grid op (*"The current role does not have access to this operation."*),
    and cannot list unpublished issues over the API (**403**) — all **live-verified 2026-07-04**;
    only managers and site admins manage issues.

## Known deviations (as-built ≠ intent)

- **None flagged ⚠.** The surface is internally consistent and its restrictions are intended, not
  bugs:
  - **Manager/site-admin-only issue management** is by design (issue creation/publishing is a
    manager responsibility). The *consequence* that a section editor can assign to a published
    issue but not see the unpublished-issue list is the **cross-surface boundary already ledgered by
    `publication-issue-assignment` (row 94)**; it is that spec's ⚠, referenced here, not a new one.
  - **Delete returns articles to the queue** (rather than orphaning or hard-deleting them) is a
    deliberate safety behaviour, not data loss.
  - **Publish makes the issue current unconditionally** (rule 16) is standard newest-first
    publishing; the out-of-order edge (publishing an older/back-dated issue silently steals
    "current") is a could-surprise-a-manager edge but is trivially reversible via *Set Current
    Issue* and reads as intended for the common case — so it is documented as a plain rule + an
    Open question, and ledgered **LOW/intent-call** as [app-changes §2 row 99](../../e2e/app-changes.md)
    for the maintainer's end-review, **not** asserted here as a bug (⚠).
- **Dead routed op:** `manageIssues/index.php` routes an `issuesTabs` op to `ManageIssuesHandler`,
  which has **no `issuesTabs` method** — hitting it errors. Recorded as a dead-code candidate
  (`PAGE-manageissues-issuestabs`), consistent with the atlas pages-sweep note. Not user-reachable.
- **Authenticated-but-unauthorized → access-denied page / 403, not 401** — a section editor hitting
  the page is redirected to the *access-denied* page and grid ops return an in-band JSON refusal
  (HTTP 200 body `status:false`); the API returns **403**. This matches the campaign's role-gate
  baselines (page/grid vs API), not an issue-management defect.

## Open questions

1. **Is "publish always makes current" (rule 16) intended for out-of-order publishing?** As-built,
   publishing any issue — including an older, back-dated one — re-points the journal's current issue
   at it (`updateCurrent` is called unconditionally). Newest-first publishing hides this; publishing
   an older issue after a newer one moves "current" backwards until re-set. As-built confirmed
   (live: publishing the future issue made it current); intent adjudication only — ledgered
   LOW/intent-call as [app-changes §2 row 99](../../e2e/app-changes.md) so it reaches the
   maintainer's end-of-campaign review.
2. **Should unpublishing an issue keep each article assigned to it (returning them to *Scheduled*)
   rather than to *Queued*?** As-built (rule 12) it deliberately re-publishes then leaves them
   Scheduled-in-this-issue; delete (rule 7) instead clears the assignment to Queued. The two hide-
   an-issue paths therefore leave articles in different states — confirm both are intended.
3. **Atom seam — `API-issue-get-assignment-options`.** It sits in the `/issues` controller but
   exists solely to drive the *publication* issue-assignment radio and is claimed by
   `publication-issue-assignment`; this spec claims the issue **read** endpoints (`get-many`,
   `current`, `get`) and leaves assignment-options there. Confirm at grooming (resolves that spec's
   Open question 2).
4. **Atom seam — the editorial TOC grid vs the reader TOC.** `GRID-grid-toc-toc-grid-handler` is the
   **editorial** ordering/removal grid and is claimed here; the atlas previously coloured it
   `issue-archive-toc` (the reader page). When `issue-archive-toc` is written, confirm the reader
   surface (`PAGE-issue-*`, `SCHEMA-issue` reader aspect) stays there while this grid stays here.

---

<!-- REFERENCE MATERIAL — provenance and campaign bookkeeping, not product-owner narrative. -->

## Reference — entry points & surfaces

| Entry | Path | Atom |
|-------|------|------|
| Issues management page (Future + Back tabs) | Editorial menu → **Issues**; `GET /{journal}/manageIssues` → `manageIssues/issues.tpl` | PAGE-manageissues-index |
| Future Issues grid (+ Create Issue) | Component `grid.issues.FutureIssueGridHandler` (`fetchGrid`, `addIssue`) | GRID-grid-issues-future-issue-grid-handler |
| Back Issues grid (+ custom order) | Component `grid.issues.BackIssueGridHandler` (`fetchGrid`, `saveSequence`) | GRID-grid-issues-back-issue-grid-handler |
| Issue CRUD / publish / unpublish / current / cover / identifiers | Base `IssueGridHandler` ops (`editIssueData`, `updateIssue`, `publishIssue`, `unpublishIssue`, `setCurrentIssue`, `deleteIssue`, `uploadFile`, `deleteCoverImage`, `issueToc`, `issueGalleys`, `access`) | *(ops of the Back/Future grid atoms)* |
| Table of Contents grid (editorial) | Component `grid.toc.TocGridHandler` (`saveSequence`, `removeArticle`, `setAccessStatus`) | GRID-grid-toc-toc-grid-handler |
| Issue Galleys grid | Component `grid.issueGalleys.IssueGalleyGridHandler` (`add`/`edit`/`upload`/`download`/`update`/`delete`) | GRID-grid-issue-galleys-issue-galley-grid-handler |
| Issue list / single / current API | `GET /api/v1/issues`, `/issues/{id}`, `/issues/current` | API-issue-get-many, API-issue-get, API-issue-get-current |
| Reader "issue published" email | ISSUE_PUBLISH_NOTIFY, queued by `IssuePublishedNotifyUsers` | MAIL-issue-published-notify, JOB-issuepublishednotifyusers |
| Reader "issue published" bell notification | `NOTIFICATION_TYPE_PUBLISHED_ISSUE` → journal *Current Issue* page | NOTIF-published-issue |
| Issue / issue-galley entities | `issues` (+ `issue_settings`, `issue_files`), `issue_galleys` (+ `issue_galley_settings`), `custom_issue_orders`; `schemas/issue.json` | DB-issues, DB-issue_settings, DB-issue_files, DB-issue_galleys, DB-issue_galley_settings, DB-custom_issue_orders, SCHEMA-issue |
| Issue / issue-galley / must-publish access policies | `OjsIssueRequiredPolicy`, `OjsIssueGalleyRequiredPolicy`, `OjsJournalMustPublishPolicy` | AUTHZ-ojs-issue-required-policy, AUTHZ-ojs-issue-galley-required-policy, AUTHZ-ojs-journal-must-publish-policy |

## Reference — code anchors

- **Page**: `pages/manageIssues/ManageIssuesHandler.php` (`index()`, roles MANAGER/SITE_ADMIN,
  `PKPSiteAccessPolicy`); `pages/manageIssues/index.php` (routes `index`; dead `issuesTabs`);
  `templates/manageIssues/issues.tpl` (Future/Back tabs).
- **Issue grids**: `classes/controllers/grid/issues/IssueGridHandler.php` (base — all CRUD +
  `publishIssue()`, `unpublishIssue()`, `setCurrentIssue()`, `deleteIssue()`, `issueToc()`,
  `issueGalleys()`, `uploadFile()`/`deleteCoverImage()`, `access()`/`updateAccess()`,
  `identifiers()`); `controllers/grid/issues/BackIssueGridHandler.php` (published,
  `moveCustomIssueOrder`); `controllers/grid/issues/FutureIssueGridHandler.php` (unpublished,
  Create Issue); `controllers/grid/issues/IssueGridRow.php` (row actions).
- **Forms**: `controllers/grid/issues/form/IssueForm.php` (identification checks, urlPath,
  datePublished, cover); `IssueAccessForm.php`; `IssueGalleyForm.php`.
- **TOC + issue galleys**: `controllers/grid/toc/TocGridHandler.php` (category grid, seq,
  `removeArticle()`, `setAccessStatus()`); `controllers/grid/issueGalleys/IssueGalleyGridHandler.php`
  (`IssueFileManager`, `IssueGalleyDAO`).
- **Entity + API**: `classes/issue/Repository.php` (`add`/`edit`/`delete`, `getCurrent`/
  `updateCurrent`, `createDoi`); `classes/issue/DAO.php` (custom issue order);
  `api/v1/issues/IssueController.php` (`getMany`/`getCurrent`/`get`; unpublished-issue gate;
  `OjsJournalMustPublishPolicy`); `schemas/issue.json`; `classes/migration/install/OJSMigration.php`
  (`issues`, `issue_settings`, `issue_files`, `issue_galleys`, `issue_galley_settings`,
  `custom_issue_orders`).
- **Notification + email**: `jobs/notifications/IssuePublishedNotifyUsers.php` (bell notif per
  recipient + optional email); `classes/mail/mailables/IssuePublishedNotify.php` (ISSUE_PUBLISH_NOTIFY,
  from SUB_EDITOR / to READER, unsubscribe footer); `classes/notification/NotificationManager.php`
  (`NOTIFICATION_TYPE_PUBLISHED_ISSUE` url → `issue/current`, settings map
  `notificationPublishedIssue`/`emailNotificationPublishedIssue`); `classes/notification/Notification.php`
  (`NOTIFICATION_TYPE_PUBLISHED_ISSUE = 0x10000015`).
