---
name: public-comments
scope: Reader comments on a published article — logged-in readers post, moderators approve/hide/delete, readers report abuse — a new 3.6 feature, off by default
shared: pkp-lib          # the whole stack (UserCommentController, UserComment model, PkpComments island, UserComments moderation page, ContentCommentsForm) lives in lib/pkp; OJS only mounts the reader island on its ArticleHandler
status: verified         # adversarial verifier: rules/permissions/state re-driven live + code-traced; rows 104+105 re-confirmed; atoms audited
e2e-plans: []           # no retained e2e plan yet (new 3.6 feature)
atlas-claims:
  - VUE-pkp-comments
  - VUE-user-comments-page
  - VUE-user-comments-table
  - VUE-user-comment-reports-table
  - FORM-content-comments-form
  - PAGE-management-settings-usercomments
  - API-comment-get-many-public-comments
  - API-comment-submit
  - API-comment-delete
  - API-comment-submit-report
  - API-comment-get-many
  - API-comment-get
  - API-comment-set-approval
  - API-comment-delete-report
  - API-comment-get-report
  - API-comment-get-reports
  - API-comment-delete-reports
  - DB-user_comments
  - DB-user_comment_settings
  - DB-user_comment_reports
  - NOTIF-user-comment-posted
  - NOTIF-user-comment-reported
  - LOC-api-api-userComments
  - LOC-manager-manager-userComment
---

# Public comments (reader comments on articles)

## Purpose

New in 3.6: a journal can let its **logged-in readers leave public comments on a published article**, shown
in a "Comments on this publication" section on the article page. It is **off by default** — a manager turns it on
in Settings → Website → Content → Comments. Every comment is **moderated**: it is created hidden and only
becomes public after a **manager or site admin approves** it, and a reader can **report** an abusive comment to
the moderators. This spec owns the whole comment stack — the reader posting/reading island, the moderation
page (approve / hide / delete comments, review / delete reports), the comment + report REST API, the two
moderator notifications, and the enable setting. It does **not** own the article page the island mounts on
(that is `article-landing`, which renders `<pkp-comments>` when the setting is on).

## Actors & permissions

Two roles do the work of a **moderator**: a journal **Manager** (in the journal) and a **Site admin** (site-wide) —
together the "moderators" (`Repository::isModerator()`). A **reader** is any registered user logged into the site;
an **anonymous** visitor has no login. There is **one gate to post/report and one gate to see**: you must be
**logged in** to write, and a comment is **public only once approved**. Comments always attach to the article's
**current published version**; older versions are read-only. There is **no anonymous-posting setting** and **no
"require approval" toggle** — login and approval are both unconditional (see Rules 2, 4). <sup>a</sup>

| Action | Who may — and when |
|--------|--------------------|
| **See the comments section** | • Anyone (incl. anonymous) — on a **published** article when the journal has comments enabled; the section renders even with zero comments <sup>b</sup> |
| **Read a comment** | • Anyone — but only **approved** comments<br>• The **comment's own author** — additionally their **own** unapproved comment, marked "awaiting approval"<br>• Moderators — every comment, approved or not, via the moderation page <sup>c</sup> |
| **Post a comment** | • Any **logged-in** reader — on the article's **current** published version only<br>• Anonymous visitor — **cannot**; sees a "Log in to comment" button instead of a compose box (⚠ the feature-map's "anonymous gating" is just this login gate — there is no setting to permit anonymous posting) <sup>d</sup> |
| **Approve / Hide (un-approve) a comment** | • Moderators only — from the moderation page's comment detail; approving makes it public, hiding removes it from public view <sup>e</sup> |
| **Delete a comment** | • The comment's **own author** — their own comment (a "Delete" item on the reader card)<br>• Moderators — **any** comment (from the moderation table) <sup>f</sup> |
| **Report a comment** | • Any **logged-in** reader other than the author — on an **approved** comment (a "Report" item on the reader card, with a reason)<br>• Moderators — may report any comment incl. unapproved<br>• A reader **cannot** report their **own** comment (Report is offered only on others') <sup>g</sup> |
| **Review / delete reports** | • Moderators only — the reports for a comment are listed in its detail modal; a report (or the whole comment) can be deleted <sup>h</sup> |
| **Enable / configure comments** | • Manager (and site admin) — the **Enable Public Comments** checkbox in Settings → Website → Content → **Comments**; reachable even without the "settings" access privilege <sup>i</sup> |

<sup>a</sup> `Repository::isModerator()` (`hasRole(MANAGER, contextId) || hasRole(SITE_ADMIN, SITE_CONTEXT_ID)`); `UserCommentController::getGroupRoutes()` middleware tiers ·
<sup>b</sup> `ArticleHandler::view()` (`enablePublicComments` → `UserCommentComponent`); `article_details.tpl` `{if $enablePublicComments}` `<pkp-comments>`; live: section renders on the seeded published article ·
<sup>c</sup> `UserCommentController::getManyPublicComments()` (`withIsApproved(true)` + `orWhere(user_id = me, is_approved=false)`); `UserCommentResource` moderator-only `approvedAt/approvedByUserName`; `PkpCommentsNotificationMessageNeedsApproval.vue` ·
<sup>d</sup> `UserCommentController::submit()` (behind `has.user`); `AddComment::after()` (current-publication check); `PkpCommentsNew.vue` `v-if isLatestPublication && getCurrentUser()`; `PkpCommentsLogInto.vue`; live: anon POST → **403**, article page shows "Log in to comment" ·
<sup>e</sup> `UserCommentController::setApproval()` (moderator route); `UserCommentDetailModal.vue` approve/hide buttons; live: `setApproval{approved:true/false}` flips public visibility ·
<sup>f</sup> `UserCommentController::delete()` (`isModerator || comment.userId === me`, else 403); reader `usePkpCommentsStore.commentDelete()`; live: owner delete → 200 ·
<sup>g</sup> `UserCommentController::submitReport()` + `AddReport::passedValidation()` (`!isModerator && !comment.isApproved` → 403); `usePkpCommentsStore.getCommentActions()` offers Report only when `currentUser.id !== comment.userId` ·
<sup>h</sup> `UserCommentController::getReports()`/`deleteReport()`/`deleteReports()` (moderator routes); `UserCommentReportsTable.vue` inside `UserCommentDetailModal.vue` ·
<sup>i</sup> `ContentCommentsForm` (`enablePublicComments` checkbox); `website.tpl` tab `publicComments`; `ManagementHandler::authorize()` exempts `['userComments']` (and `['announcements']`) from `CanAccessSettingsPolicy`

## Fields & validation

| Field (UI label) | Required? | Rules | Anchor |
|------------------|-----------|-------|--------|
| **Add your comment** (the reader textarea) | Yes | Free text; **unsafe HTML stripped** on save; must target the article's **current** published publication (else "cannot comment on this version"). Not multilingual. | `AddComment::rules()` (`commentText` required string) + `AddComment::validated()` (`PKPString::stripUnsafeHtml`) + `AddComment::after()` |
| **Reason** (the report reason textarea) | Yes | Free text; **unsafe HTML stripped** on save. Stored as the report `note`. | `AddReport::rules()` (`note` required string) + `AddReport::validated()` |
| **Enable Public Comments** (settings checkbox, inside the **Comments** field group) | No | Boolean; **default off**. When off, the whole feature (reader section + moderation menu) disappears. | `ContentCommentsForm` field `enablePublicComments` (option label `manager.userComment.enableComments`); `context.json` `default: false` |

The publication a comment targets (`publicationId`) is submitted by the island but is not a user-visible field; the
server sets the author, context, `isApproved=false`, and (on approval) the approver + timestamp. The report's target
comment comes from the URL, not a field.

## Rules & state

1. **Off by default; one enable switch, no sub-options.** `enablePublicComments` is a journal setting defaulting
   **false** (`context.json`). Turning it on (Settings → Website → Content → **Comments**) does three things: the
   reader **"Comments on this publication"** section appears on published article pages, a **"Comments"** item
   appears in the manager's backoffice content menu (→ the moderation page), and the comment API starts accepting
   writes. There is **no** "require approval", "allow anonymous", or per-section option — the one checkbox is the
   entire configuration. **Live-verified**: bare schema default is off; the `publicknowledge` test fixture turns it
   on (`bootstrap.js enablePublicComments:true`). <sup>a</sup>
2. **Posting requires login; anonymous is offered only a login link.** The write routes sit behind the `has.user`
   middleware, so an anonymous `POST /comments` is **rejected (403)**. In the UI, an anonymous reader sees the
   comments section and any approved comments but, in place of the compose box, a **"Log in to comment"** button
   that sends them to login and back to `#public-comments`. Any logged-in user (reader, author, editor, manager…)
   may post — **no role is required beyond being authenticated**. There is no setting anywhere that enables
   anonymous posting; the feature-map's "anonymous gating" is only this login requirement. **Live-verified**: anon
   `POST /comments` → **403**; the rendered island shows "Log in to comment", not a textarea. <sup>b</sup>
3. **A comment attaches to the article's CURRENT published version only.** The submit validator resolves the
   target publication's submission and rejects it unless that publication **is the submission's current
   publication** ("cannot comment on this publication version"). The reader island shows one accordion panel **per
   published version** but only renders the compose box on the **latest** panel; older-version panels show a
   **"discussion closed"** notice and are read-only. So comments accrue only on the live version, though past
   versions' approved comments remain readable. <sup>c</sup>
4. **Every comment is born hidden — moderation is mandatory.** `submit()` always creates the row with
   `isApproved=false`, regardless of who posts (a manager's own comment is unapproved too). There is **no bypass and
   no toggle** to auto-publish. The comment is invisible to the public until a moderator approves it. **Live-verified**:
   a `POST /comments` by a logged-in user returns `isApproved:false`. <sup>d</sup>
5. **Public visibility = approved; the author sees their own pending one; moderators see all.** The public read
   endpoint (`GET /comments/public`, no login needed) returns only `is_approved=true` comments — **plus**, for a
   logged-in caller, that caller's **own** unapproved comments (so the author sees their pending comment tagged
   **"awaiting approval"**, but nobody else does). Moderators read every comment through the separate authenticated
   `GET /comments`. **Live-verified**: anonymous `GET /comments/public` returned only the approved comment and hid
   the pending one; the manager `GET /comments` returned both. <sup>e</sup>
6. **Moderation queue: approve and hide.** From the moderation page a moderator opens a comment and **Approves** it
   (`setApproval {approved:true}` → `isApproved=true`, records `approvedAt=now` and `approvedByUserId`) or **Hides**
   it (`setApproval {approved:false}` → `isApproved=false`). The page's tabs are status filters over the same
   table — **All**, **Approved**, **Hidden or needs approval** (`isApproved=false`), and **Reported**
   (`isReported=true`) — each backed by a `GET /comments` query param. **Live-verified**: approving a queued comment
   made it appear in `GET /comments/public`; hiding an approved one removed it. ⚠ **Hiding does not clear the prior
   approval stamp** — see Known deviations (row 104). <sup>f</sup>
7. **Reporting abuse.** A logged-in reader (not the author) reports an **approved** comment with a required
   **reason**; a moderator may report any comment including an unapproved one. The gate is: `isModerator` **or** the
   comment is approved — a non-moderator reporting an unapproved comment is **403**. A report writes a
   `user_comment_reports` row (`note`, reporter, timestamp) and **notifies the moderators**. A comment with ≥1
   report reads `isReported=true` and surfaces in the **Reported** tab. **Live-verified**: `POST /comments/{id}/reports`
   created the report, flipped `isReported`, and the comment appeared under `isReported=true`. <sup>g</sup>
8. **Deleting a comment.** The **author** may delete their **own** comment (a Delete action on the reader card,
   with a confirm); a **moderator** may delete **any** comment (from the moderation table). Anyone else is **403**.
   Deleting a comment **cascades**: its reports are removed (DB FK `onDelete cascade`) and the comment's + reports'
   **notifications are deleted**. **Live-verified**: the author deleting their own comment → 200, gone from the
   moderation list. <sup>h</sup>
9. **Report moderation.** A comment's reports are listed **inside its detail modal** (reporter, reason, date), each
   with **View** and **Delete report**; deleting a report also deletes that report's notification. There is no
   top-level "reports" tab — reports are always viewed in the context of their comment. ⚠ The bulk
   `DELETE /comments/{id}/reports` endpoint (delete **all** of a comment's reports at once) **is broken for a comment
   with 2+ reports and has no UI affordance** — see Known deviations (row 105). <sup>i</sup>
10. **Reader render.** The island (`<pkp-comments>`) shows, per published version, an accordion whose header is the
    version label + comment count (e.g. "Version of Record 1.0 (1)"). Each comment shows the **commenter's name,
    ORCID (verified/unverified icon + link when present), affiliation, and post date/time**, with the text rendered
    through an unsafe-HTML strip; there is **no avatar and no reply/threading**. A **"Show more"** button pages
    through comments (accumulating, `itemsPerPage` from the context). A sidebar block (`<pkp-scroll-to-comments>`)
    shows the total approved count and a jump link. <sup>j</sup>
11. **Moderation page reachability & shape.** The page is `ManagementHandler::userComments` at
    `…/management/settings/userComments`, rendering the `UserCommentsPage` Vue app (the four status tabs + table +
    the comment/report detail modals). It is reachable **only when comments are enabled** (the content-menu item is
    added conditionally) and is exempted from the settings-access gate, so a manager without full settings access can
    still moderate. **Not live-driven in a browser this pass** — the tabs/actions are read from the Vue components;
    the underlying `GET /comments` filters and the approve/hide/delete/report endpoints they call were all
    live-verified via the API. <sup>k</sup>
12. **API surface & auth tiers.** All routes live under `/api/v1/comments` (`has.context`) in **three tiers**:
    **public** — `GET /comments/public` (the only unauthenticated route, deliberately outside `has.user` so anon
    readers can read); **logged-in** — `POST /comments` (post), `DELETE /comments/{id}` (delete own/any),
    `POST /comments/{id}/reports` (report); **moderator-only** (`SITE_ADMIN`/`MANAGER`) — `GET /comments`,
    `GET /comments/{id}`, `PUT /comments/{id}/setApproval`, and the report reads/deletes
    (`GET|DELETE /comments/{id}/reports[/{reportId}]`). **Live-verified**: anon → `GET /comments` 401, `POST` 403;
    moderator session reached all tiers. <sup>l</sup>

<sup>a</sup> `context.json` `enablePublicComments` (`default:false`); `ContentCommentsForm`; `TemplateManager` content submenu (`if enablePublicComments` → `userComments`); `ArticleHandler::view()` ·
<sup>b</sup> `UserCommentController::getGroupRoutes()` (`has.user` group); `PkpCommentsNew.vue`/`PkpCommentsLogInto.vue`; `UserCommentComponent::getLoginUrl()`; live anon POST 403 ·
<sup>c</sup> `AddComment::after()` (`submission->getCurrentPublication()->getId() !== publicationId` → error); `PkpCommentsNew.vue` `v-if isLatestPublication`; `PkpCommentsNotificationNotLatest.vue` (`userComment.discussionClosed`) ·
<sup>d</sup> `UserCommentController::submit()` (`isApproved => false`); live `isApproved:false` on post ·
<sup>e</sup> `UserCommentController::getManyPublicComments()` (`withIsApproved(true)` + own-unapproved `orWhere`); `UserCommentComponent::__construct()` count logic; live anon vs manager read ·
<sup>f</sup> `UserCommentController::setApproval()` (`approvedAt`/`approvedByUserId`); `userCommentStore.commentsUrl` tab→`isApproved`/`isReported` params; `UserCommentDetailModal.vue`; live approve/hide toggles public visibility ·
<sup>g</sup> `UserCommentController::submitReport()` + `AddReport::passedValidation()`; `Repository::addReport()`; `UserComment::scopeWithIsReported()` (`whereHas('reports')`); live report create + `isReported` filter ·
<sup>h</sup> `UserCommentController::delete()` (owner/moderator gate; `Notification::whereIn(...)->delete()`); FK `onDelete('cascade')` in `UserCommentsMigration`; live owner delete ·
<sup>i</sup> `UserCommentController::getReports()`/`deleteReport()`/`deleteReports()`; `UserCommentReportsTable.vue`; live 500 on 2-report bulk delete ·
<sup>j</sup> `PkpComments.vue` (accordion per publication, `userComment.versionWithCount`), `PkpCommentsShowMore.vue`; `UserCommentResource` (name/ORCID/affiliation/dates); `article_details.tpl` `<pkp-scroll-to-comments>`; live reader render "Version of Record 1.0 (1)" + comment ·
<sup>k</sup> `ManagementHandler::userComments()` (`management/userComments.tpl`, `UserCommentsPage`); `ManagementHandler::authorize()` `['userComments']` exemption; `UserCommentsPage.vue` tabs ·
<sup>l</sup> `UserCommentController::getGroupRoutes()` (`Route::get('public')` outside `has.user`; moderator subgroup `roleAuthorizer([SITE_ADMIN, MANAGER])`); `authorize()` adds `PublicAccessPolicy`; live 401/403/200 tiers

## Side effects

- **`user_comments` rows** — one per posted comment (`isApproved=false` until approved). Approval writes `approvedAt`
  + `approvedByUserId` into **`user_comment_settings`** (the model's two settings). `user_comment_reports` rows hold
  each report's `note`/reporter. All three tables cascade-delete off `user_comments` / `publications` / `users` /
  the context.
- **Two moderator notifications, TASK level** — on **post**, `NOTIFICATION_TYPE_USER_COMMENT_POSTED`
  ("A public comment was submitted…") is created **for every manager + site admin** in the journal; on **report**,
  `NOTIFICATION_TYPE_USER_COMMENT_REPORTED` ("A public comment was reported…") likewise. Both link to the moderation
  page focused on the comment/report (`?commentId=…` / `?reportId=…`). **Live-verified**: post created a POSTED
  notification per moderator (level 3 = TASK), report created a REPORTED one. **No emails.** Deleting a comment or a
  report deletes its associated notifications.
- **No usage/stats events, no event-log entries** — commenting is not metered.

## Settings that modify behavior

- **Enable Public Comments** (`enablePublicComments`, the sole checkbox in the **Comments** field group at
  Settings → Website → Content → **Comments**, `ContentCommentsForm`) — the single on/off switch, **off by default**. Off ⇒ no reader section, no moderation menu, writes rejected upstream
  by the article page never mounting the island.
- **Items per page** (`itemsPerPage`, the context list setting) — drives both the reader "Show more" page size and
  the moderation table pagination (`Repository::getPerPage()`).
- No `config.inc.php` var, plugin, or per-section toggle affects comments.

## Cross-feature interactions

- **article-landing** (feature) — owns the **article page** that hosts the comments island; `ArticleHandler::view()`
  builds the `UserCommentComponent` config and `article_details.tpl` renders `<pkp-comments>` + `<pkp-scroll-to-comments>`
  when the setting is on. This spec owns the island + everything behind it; article-landing references it (its rule/
  footnote f). The seam: the island mounts in the article page's main entry, keyed to the article's publications.
- **registration-login** (feature 47, not yet written) — owns **who can log in**; this spec owns the
  **post/report-requires-login** gate that sits on top (the "Log in to comment" button routes to that feature's login
  and back to `#public-comments`). No role beyond "authenticated" is needed to post.
- **review-anonymity** (feature 20) — **not related** to public comments despite the feature-map's "anonymous gating"
  phrasing: review-anonymity governs *reviewer identity in peer review*, whereas the only anonymity concept here is
  "must be logged in to post" (Rule 2). No shared rule; referenced only to disclaim the overlap.
- **notifications** — the two `NOTIF-user-comment-*` types are **owned here** (no separate notifications feature owns
  them); their titling/URL is assembled in the shared `PKPNotificationManager` (`getNotificationUrl()` /
  `getNotificationMessage()` cases), which this spec anchors but does not own as a feature.
- **user-profile / orcid** — the reader card shows each commenter's **ORCID badge** (verified/unverified) and
  affiliation from their user record; the badge logic is owned by `orcid`, consumed here read-only via `UserCommentResource`.

## Canonical scenarios

1. **Logged-in reader posts a comment → moderation queue** — A logged-in reader opens a published article, types in
   the "Add your comment" box on the current version, and submits. The comment is saved **hidden**; the reader sees it
   with an **"awaiting approval"** note while every other visitor does not, and each manager/site-admin gets a
   task notification. (Live-verified: post → `isApproved:false`; moderators notified.)
2. **Anonymous reader is gated** — An anonymous visitor sees the "Comments on this publication" section and the
   already-approved comments, but in place of the compose box a **"Log in to comment"** button; attempting to post
   via the API is rejected. (Live-verified: article page shows "Log in to comment"; anon `POST /comments` → 403.)
3. **Manager approves then hides a comment** — A manager opens the Comments moderation page, filters the **Hidden or
   needs approval** tab, opens the queued comment and **Approves** it — it now appears publicly with the approver +
   date recorded; later they **Hide** it and it disappears from the public view again. (Live-verified: approve →
   visible in `/comments/public`; hide → removed.)
4. **Reader reports an abusive comment** — A logged-in reader clicks **Report** on someone else's approved comment,
   enters a **reason**, and submits; a `user_comment_reports` row is written, moderators are notified, and the comment
   surfaces under the moderation **Reported** tab with `isReported=true`. (Live-verified end-to-end.)
5. **Manager moderates the reports** — A manager opens the reported comment's detail, reviews the **reporter + reason +
   date** in the reports table, and resolves it by **deleting the report** (dismiss) or **deleting the comment**
   (which cascades away its reports + notifications). (Live-verified: single-report delete → 200; comment delete
   cascades.)
6. **Author deletes their own comment; a stranger cannot** — The comment's author deletes it from the reader card
   (confirm dialog) and it is removed; a different non-moderator user attempting to delete it is refused. (Live-verified:
   owner delete → 200; the delete route enforces owner-or-moderator, else 403.)
7. **Enabling and disabling comments** — With comments **off** (the default) an article page shows **no** comments
   section and the manager has **no** Comments menu item; a manager ticks **Enable Public Comments** in Settings → Website →
   Content → Comments and both the reader section and the moderation page appear; unticking it hides them again.
   (Live-verified: schema default off; fixture-on shows the section + API.)

## Known deviations (as-built ≠ intent)

- ⚠ **Hiding (un-approving) a comment leaves a stale "approved by X on <date>" stamp** (propose **ledger row 104**).
  `setApproval {approved:false}` sets the model's `approvedAt`/`approvedByUserId` to `null`, but those are
  **non-multilingual settings**, and the shared settings writer (`EntityUpdate::updateSettings()`, the
  `SettingsBuilder` branch) **refuses to clear a non-multilingual setting via null** — it neither upserts nor deletes
  the row, so the previous approval stamp survives in `user_comment_settings` and is returned by the moderator API
  (`UserCommentResource`). **Live-verified**: after hiding comment 1, `GET /comments/1` still reported
  `approvedAt:2026-07-05 01:34:54`, `approvedByUserName:"admin admin"` though `isApproved:false`. Impact is **latent**
  — the moderation modal only shows the approver line when `isApproved` is true, so a moderator does not currently see
  the stale value; but the data is wrong and the API leaks it. Suspected intent: hiding should clear the approval
  attribution (root cause is shared settings-infra, not comment-specific).
- ⚠ **Bulk "delete all reports for a comment" (`DELETE /comments/{id}/reports`) is broken for 2+ reports and has no UI**
  (propose **ledger row 105**). `UserCommentController::deleteReports()` passes an already-flat array **double-wrapped**
  to `UserCommentReport::withReportIds([$reportIds])`, producing a nested array in `whereIn`. **Live-verified**: with
  one report it happens to coerce and 200s; with **two** reports it throws **HTTP 500 "Nested arrays may not be passed
  to whereIn method"** and deletes nothing. The moderation UI never calls this endpoint (it deletes reports
  individually via `deleteReport`), so it is an **API-only, effectively-dead route**. Suspected intent: pass the flat
  `$reportIds` (as the very next line's notification cleanup correctly does).

## Open questions

1. **Is comments meant to ship off by default, or is the stock default a packaging oversight?** The schema default is
   `false` and only the test fixture turns it on; a maintainer should confirm off-by-default is intended for 3.6
   releases (does not gate verification).
2. **Should un-approving clear the approval stamp (row 104), and is the stale value ever surfaced elsewhere** (e.g. an
   export, a future UI, or a report)? One sentence from the maintainer settles whether row 104 is cosmetic or a real leak.
3. **Is the bulk `deleteReports` endpoint (row 105) intended to exist at all**, given the UI deletes reports one-by-one?
   If it is dead, it could be removed rather than fixed.
4. **Should older-version comments be visible at all?** New comments are correctly barred from non-current versions, but
   a past version's approved comments remain readable in a read-only ("discussion closed") panel — confirm this is the
   intended lifecycle for versioned articles.

---

## Reference — entry points & surfaces

| Entry | Path | Atom |
|-------|------|------|
| Reader comments island | `article/view/{id}` → `ArticleHandler::view` (`enablePublicComments`) → `article_details.tpl` `<pkp-comments>` | VUE-pkp-comments |
| Moderation page | `…/management/settings/userComments` → `ManagementHandler::userComments` → `management/userComments.tpl` (`UserCommentsPage`) | PAGE-management-settings-usercomments, VUE-user-comments-page |
| Moderation comments table | inside `UserCommentsPage` (tabs: all / approved / needsApproval / reported) | VUE-user-comments-table |
| Reports table (per comment) | inside the comment detail modal | VUE-user-comment-reports-table |
| Enable setting | Settings → Website → Content → Comments (`website.tpl` tab `publicComments`) → `ContentCommentsForm` | FORM-content-comments-form |
| Public read (unauth) | `GET /api/v1/comments/public?publicationIds=…` | API-comment-get-many-public-comments |
| Post / delete / report (logged-in) | `POST /comments` · `DELETE /comments/{id}` · `POST /comments/{id}/reports` | API-comment-submit, API-comment-delete, API-comment-submit-report |
| Moderator reads | `GET /comments` · `GET /comments/{id}` · `GET /comments/{id}/reports[/{reportId}]` | API-comment-get-many, API-comment-get, API-comment-get-reports, API-comment-get-report |
| Moderator mutations | `PUT /comments/{id}/setApproval` · `DELETE /comments/{id}/reports/{reportId}` · `DELETE /comments/{id}/reports` (⚠ broken) | API-comment-set-approval, API-comment-delete-report, API-comment-delete-reports |
| Moderator notifications | on post / report → the moderation page (`?commentId`/`?reportId`) | NOTIF-user-comment-posted, NOTIF-user-comment-reported |
| Tables | `user_comments`, `user_comment_settings` (`approvedAt`/`approvedByUserId`), `user_comment_reports` | DB-user_comments, DB-user_comment_settings, DB-user_comment_reports |
| Locale | `api.userComments.*` (9 keys), `manager.userComment.*` (34 keys), `userComment.*` (reader keys) | LOC-api-api-userComments, LOC-manager-manager-userComment |

## Reference — code anchors

- **API controller**: `lib/pkp/api/v1/comments/UserCommentController.php` — `getGroupRoutes()` (the three auth tiers),
  `getManyPublicComments()`, `getMany()`, `get()`, `submit()`, `delete()`, `setApproval()`, `submitReport()`,
  `deleteReport()`, `deleteReports()` (⚠ nested-array bug), `getReport()`, `getReports()`, `notifyModerators()`.
- **Validators**: `formRequests/AddComment.php` (`rules()`, `after()` current-publication check, `validated()`
  strip-unsafe-html), `formRequests/AddReport.php` (`rules()`, `passedValidation()` report gate, `validated()`).
- **Resources**: `resources/UserCommentResource.php` (moderator-only approvedAt/approvedByUserName; `isReported`),
  `resources/UserCommentReportResource.php`.
- **Model + repo**: `lib/pkp/classes/userComment/UserComment.php` (scopes; settings `approvedAt`/`approvedByUserId`),
  `relationships/UserCommentReport.php` (`withReportIds`/`withCommentIds` scopes), `Repository.php` (`isModerator()`,
  `addReport()`, `getPaginatedData()`, `getPerPage()`).
- **Migration**: `lib/pkp/classes/migration/install/UserCommentsMigration.php` (the three tables + cascade FKs).
- **Setting + moderation page**: `lib/pkp/classes/components/forms/context/ContentCommentsForm.php`,
  `lib/pkp/schemas/context.json` (`enablePublicComments` default false), `lib/pkp/pages/management/ManagementHandler.php`
  (`userComments()`, `authorize()` `['userComments']` exemption, settings assembly), `lib/pkp/templates/management/website.tpl`
  (tab `publicComments`), `classes/template/TemplateManager.php` (content submenu gate).
- **Reader mount**: `pages/article/ArticleHandler.php` (`view()` → `UserCommentComponent`),
  `templates/frontend/objects/article_details.tpl` (`<pkp-comments>` + `<pkp-scroll-to-comments>`),
  `lib/pkp/classes/components/UserCommentComponent.php` (`getConfig()`, `getLoginUrl()`, count logic).
- **Notifications**: `lib/pkp/classes/notification/Notification.php` (`NOTIFICATION_TYPE_USER_COMMENT_POSTED/REPORTED`),
  `lib/pkp/classes/notification/PKPNotificationManager.php` (`getNotificationUrl()`/`getNotificationMessage()` comment cases),
  `lib/pkp/classes/core/PKPApplication.php` (`ASSOC_TYPE_COMMENT`/`ASSOC_TYPE_COMMENT_REPORT`).
- **Vue (reader)**: `lib/ui-library/src/frontend/components/PkpComments/` — `PkpComments.vue`, `PkpCommentsNew*.vue`
  (login+latest gate), `PkpCommentsLogInto.vue`, `PkpCommentReportDialog*.vue`, `usePkpCommentsStore.js`
  (`addComment`/`commentReport`/`commentDelete`/`loadComments`).
- **Vue (moderation)**: `lib/ui-library/src/pages/userComments/` — `UserCommentsPage.vue` (status tabs),
  `UserCommentsTable.vue`, `UserCommentReportsTable.vue`, `UserCommentDetailModal.vue` (approve/hide), `userCommentStore.js`.
- **Stale-setting root cause (⚠ row 104)**: `lib/pkp/classes/core/traits/EntityUpdate.php` `updateSettings()`
  (the `SettingsBuilder` branch skips clearing a non-multilingual null setting).
- **Liveness note**: probed 2026-07-05 against the running `:8000` server (DB `ojs_test`) — seeded a published
  submission (367 / publication 374) with `userComments`, then drove the full flow via the REST API + a browser view
  of the article page: off-by-default confirmed from schema; section renders + hydrates for anonymous ("Log in to
  comment", approved comment shown); anon POST 403 / moderator reads 200; post → unapproved; approve → public; hide →
  hidden (+ stale stamp ⚠); report → notified + Reported tab; owner delete → 200; bulk deleteReports → 500 on 2 reports ⚠.
