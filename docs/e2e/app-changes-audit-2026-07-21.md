# app-changes.md ledger audit — 2026-07-21

File-only audit of `docs/e2e/app-changes.md` against the campaign state in
`docs/product/PROGRESS.md`, the taxonomy in `docs/product/FEATURE-MAP.md`, and the
current test trees (`playwright/tests/`, `lib/pkp/playwright/tests/`). No files were
edited; §5 lists proposed markings only. Scope: §1 (8 rows), §2 rows 1–163
(pre-campaign set), §3 env notes. Campaign era = 2026-07-10 (dress rehearsal) onward;
"pre-reset re-verified" = live re-reproduction during the scratched round-2 build
(2026-07-02..06) — real evidence, but not by the current campaign.

## Summary

**§2 rows 1–163 by owning feature's status**

| Class | Rows |
|---|---|
| Owner **pending** (not yet rebuilt by campaign) | **129** |
| Owner **verified** (campaign feature green) | 25 |
| Owner **reference** (`tasks-discussions`) | 7 |
| No campaign owner (1 harness, 1 unmapped ui-library) | 2 |

**Evidence anchors (§2 rows 1–163)**

| Class | Rows |
|---|---|
| No spec cited (evidence = agent/probe/audit notes) | 141 |
| Cited .spec.js **deleted** (round-1 suite retired 2026-07-01 / reset 2026-07-10) | 21 |
| Cited name exists but is a **campaign rebuild**, not the cited test (row 52) | 1 |

**Re-validation since round 1 (§2 rows 1–163)**

| Class | Rows |
|---|---|
| Untouched | 147 |
| Pre-reset re-verified 2026-07-02..06 (rows 18, 22, 65, 79, 91, 94, 112, 126) | 8 |
| Current-campaign touched (rows 2 amended, 10 addendum+re-repro, 62 re-confirmed via new row 179, 159–163 campaign-filed) | 8 |

Key observations:
- **All 129 pending-owned rows are campaign-untouched** — the exposure list below IS
  the pending-owner set. Every campaign-touched row happens to belong to an
  already-verified feature.
- Rows **159–163 are campaign-era rows** (calibration f1, 2026-07-10) living inside the
  "old" 1–163 range — they should not be treated as round-1 legacy.
- Rows **18 and 34 are marked FIXED** in the ledger (34 graduated to §1 row 7).
- §1 row 8's "uncommitted" note is **stale** — the fix is committed (lib/pkp `bdcb41580c`).
- §3's `clearAll()` guard spec (`mailpit-harness.spec.js`) was deleted in the reset;
  the rule currently has no enforcing spec (surviving specs honor it by comment only).

### EXPOSURE LIST — pending-owned, campaign-untouched rows (only record of these findings)

Ordered by the owning feature's position in the PROGRESS table (= soonest re-validated
first under the current in-table-order directive). 129 rows across 62 pending features.

| PROGRESS # | Owning feature | Rows | §2 row numbers |
|---|---|---|---|
| 9 | `stage-participants` | 4 | 9, 73, 74, 75 — all four re-validated 2026-07-21 (spec fold-in); no-drift re-confirmed 2026-07-22 (verification pass, chunk e) |
| 12 | `reviewer-response` | 4 | 16, 76, 77, 78 |
| 13 | `review-forms` | 2 | 39, 79 |
| 14 | `review-rounds-and-revisions` | 1 | 80 |
| 16 | `review-anonymity` | 1 | 81 |
| 17 | `copyediting-stage` | 2 | 8, 82 |
| 18 | `production-stage` | 1 | 83 |
| 20 | `submission-files` | 3 | 6, 17, 85 |
| 21 | `editorial-activity-log` | 3 | 14, 86, 87 |
| 22 | `document-library` | 2 | 88, 89 |
| 24 | `contributors` | 3 | 20, 21, 90 |
| 25 | `publication-metadata-references` | 2 | 91, 92 |
| 26 | `galleys` | 2 | 22, 24 |
| 27 | `media-files` | 1 | 29 |
| 28 | `publication-identifiers` | 1 | 19 |
| 30 | `publication-issue-assignment` | 2 | 26, 94 |
| 31 | `publication-versioning` | 1 | 54 |
| 32 | `publication-publish-flow` | 3 | 18, 23, 53 |
| 33 | `publication-amendments` | 1 | 96 |
| 34 | `data-availability-citations` | 2 | 97, 98 |
| 35 | `issue-management` | 2 | 27, 99 |
| 36 | `journal-homepage` | 1 | 25 |
| 37 | `highlights-featured-content` | 1 | 100 |
| 40 | `issue-archive-toc` | 2 | 28, 101 |
| 41 | `site-search` | 1 | 102 |
| 42 | `browse-category-section` | 1 | 103 |
| 43 | `public-comments` | 2 | 104, 105 |
| 45 | `oai-pmh` | 1 | 106 |
| 46 | `web-feeds-syndication` | 1 | 107 |
| 47 | `registration-login` | 2 | 108, 109 |
| 48 | `password-flows` | 2 | 110, 111 |
| 49 | `user-profile` | 3 | 30, 31, 32 |
| 50 | `user-management` | 5 | 36, 37, 112, 113, 114 |
| 51 | `user-invitations` | 3 | 33, 35, 115 |
| 52 | `roles-permissions` | 2 | 34, 116 |
| 53 | `login-as` | 1 | 117 |
| 55 | `site-access-restrictions` | 1 | 118 |
| 56 | `journal-masthead-settings` | 1 | 119 |
| 57 | `website-appearance-settings` | 5 | 38, 41, 121, 122, 123 |
| 58 | `workflow-settings` | 2 | 124, 125 |
| 59 | `distribution-settings` | 1 | 126 |
| 60 | `email-templates-management` | 3 | 127, 128, 129 |
| 61 | `navigation-menus` | 5 | 40, 130, 131, 132, 133 |
| 62 | `sections` | 3 | 135, 136, 137 |
| 63 | `categories` | 3 | 138, 139, 140 |
| 64 | `announcements` | 4 | 141, 142, 143, 144 |
| 65 | `languages-locales` | 5 | 134, 145, 146, 147, 148 |
| 66 | `site-settings` | 4 | 149, 150, 151, 152 |
| 67 | `site-administration` | 4 | 120, 153, 154, 155 |
| 68 | `plugin-management` | 3 | 156, 157, 158 |
| 70 | `doi-deposit` | 1 | 42 |
| 72 | `orcid` | 1 | 43 |
| 73 | `citation-style-language` | 1 | 47 |
| 76 | `subscription-access` | 1 | 44 |
| 77 | `payments` | 2 | 45, 48 |
| 79 | `email-delivery` | 1 | 49 |
| 80 | `notifications` | 1 | 55 |
| 81 | `jobs-queue` | 1 | 12 |
| 82 | `scheduled-tasks` | 2 | 50, 95 |
| 83 | `rest-api` | 1 | 51 |
| 86 | `pubmed-export` | 1 | 13 |
| 89 | `editorial-statistics` | 1 | 46 |

## 1. §1 production-code-change rows

| # | One-clause topic | Owning feature | Owner status | Evidence anchor | Commit state (working tree, 2026-07-21) |
|---|---|---|---|---|---|
| 1 | OAI date-range harvest 500s on Postgres (whereDate Expression) | `oai-pmh` | pending | no spec cited | committed (root `03516ef9c2`) |
| 2 | credit plugin PKP_STRICT_MODE guard so 3.6 core can boot | `contributors` (PLUGIN-generic-credit) | pending | no spec cited | **STILL UNCOMMITTED** (`plugins/generic/credit`: `M CreditPlugin.php`) |
| 3 | opis/json-schema require-dev for scenario-spec validation | harness (n/a) | n/a | no spec cited | committed (lib/pkp `a859b7f64f`) |
| 4 | journal sitemaps emitted zero article/galley URLs | `web-feeds-syndication` | pending | no spec cited | committed (root, wave 8) |
| 5 | webFeed settings.xml displayItems bool→string (wrong feed scope) | `web-feeds-syndication` | pending | no spec cited | **STILL UNCOMMITTED** (`plugins/generic/webFeed`: `M settings.xml`) |
| 6 | editorial masthead/history rendered zero role sections (positional keys) | `about-pages` (renders it; config side `editorial-masthead`) | pending | editorial-masthead.spec.js row 2 — **spec deleted** | committed (lib/pkp, wave 9) |
| 7 | roles grid: row at positional index 0 had no edit/delete actions | `roles-permissions` | pending | roles-permissions.spec.js rows 2/4 — **spec deleted** | committed (lib/pkp, wave 11) |
| 8 | login form maxlength=32 truncated long passwords client-side | `registration-login` | pending | no spec cited | **committed** in lib/pkp `bdcb41580c` — ledger's "uncommitted" note is STALE |

Uncommitted working-tree patches remaining: **rows 2 and 5** (each inside its own
plugin repo; revert paths documented in the ledger). Note both §1 regression tests
cited by rows 6–7 are gone; those fixes currently have no automated guard.

## 2. §2 rows 1–163 classification

Columns: owning feature = best FEATURE-MAP fit for the surface; owner status per
PROGRESS 2026-07-21; anchor = state of any cited .spec.js in today's test tree;
re-validated = touched by the current campaign (2026-07-10+) or noted otherwise.

| Row | Topic | Owning feature | Owner status | Evidence anchor | Re-validated by campaign? |
|---|---|---|---|---|---|
| 1 | wizard comments-for-editors lost on submit autosave race | `submission-wizard` | verified | no spec cited | untouched |
| 2 | reviewerAssignments endpoint ignores searchPhrase and pagination params | `editorial-dashboards` | verified | no spec cited | amended 2026-07-16 |
| 3 | POST /submissions rejects editor user groups; managers cannot self-submit | `submission-wizard` | verified | no spec cited | untouched |
| 4 | side-modal wrapper computes visibility:hidden while content interactive | `unmapped` | unmapped (n/a) | no spec cited | untouched |
| 5 | submission search ORs space-tokenized LIKE matches; drafts sort last | `editorial-dashboards` | verified | no spec cited | untouched |
| 6 | FileAttacherUpload off-by-one enables attach during in-flight upload | `submission-files` | pending | no spec cited | untouched |
| 7 | cancel review round cascade-deletes its own decision record | `editorial-decisions` | verified | review-rounds-revisions.spec.js: spec deleted | untouched |
| 8 | skip-review accept never surfaces assign-copyeditor prompt | `copyediting-stage` | pending | copyediting-stage.spec.js: spec deleted | amended 2026-07-22 (stage-participants verify chunk e — every-viewer extension, live re-reproduction) |
| 9 | editing/production status flips only via notify message, not assignment | `stage-participants` | verified | no spec cited | re-validated + amended 2026-07-21 (stage-participants probe D); no-drift re-confirmed 2026-07-22 (verify chunk e; adjacent row-8 amendment) |
| 10 | back-from-copyediting mislabeled "Move to Review" without review round | `editorial-decisions` | verified | copyediting-stage.spec.js: spec deleted | addendum 2026-07-16; re-reproduced 2026-07-21 |
| 11 | author dashboard crashes on early Submit Response click | `author-dashboard` | verified | no spec cited | untouched |
| 12 | shared HTTP client lacks timeout; outbound hangs fatal job runner | `jobs-queue` | pending | no spec cited | untouched |
| 13 | PubMed export fetches remote NLM DTD; offline exports 500 | `pubmed-export` | pending | pubmed-metadata.spec.js: spec deleted | untouched |
| 14 | activity log renders literal userGroupName placeholder on participant added | `editorial-activity-log` | pending | no spec cited | untouched |
| 15 | discussions stage heading stale after in-place stage switch | `tasks-discussions` | reference | discussions.spec.js: spec deleted | untouched |
| 16 | reviewer Submit Review confirm dies after two rejected cycles | `reviewer-response` | pending | review-forms.spec.js: spec deleted | untouched |
| 17 | download-all zip filename double dash; locale claim retracted | `submission-files` | pending | no spec cited | untouched |
| 18 | FIXED: UI-scheduled articles got PUBLISHED status while publication SCHEDULED | `publication-publish-flow` | pending | no spec cited | untouched (pre-reset re-verified 2026-07-04) |
| 19 | unset urnCheckNo TypeError silently empties Identifiers form | `publication-identifiers` | pending | no spec cited | untouched |
| 20 | contributor double-refresh swallows clicks and reverts optimistic reorder | `contributors` | pending | no spec cited | untouched |
| 21 | contributors list never displays affiliations (dead binding) | `contributors` | pending | no spec cited | untouched |
| 22 | remote galley chains upload wizard; published galleys editable via View | `galleys` | pending | galleys.spec.js: spec deleted | untouched (pre-reset re-confirmed 2026-07-04) |
| 23 | publish-flow: declined schedulable, pre-validation persistence, issue radio overwrite | `publication-publish-flow` | pending | no spec cited | untouched |
| 24 | minor: galley seq zero, unnamed reorder buttons, harness default title | `galleys` | pending | no spec cited | untouched |
| 25 | homepage latest publications ordered by date submitted, not published | `journal-homepage` | pending | no spec cited | untouched |
| 26 | publication settings form blocks any save without issue assignment | `publication-issue-assignment` | pending | no spec cited | untouched |
| 27 | legacy category grids lost styling via pre-namespace class check | `issue-management` | pending | no spec cited | untouched |
| 28 | issue TOC within-section article order undefined (seq never stamped) | `issue-archive-toc` | pending | no spec cited | untouched |
| 29 | minor: version form flag, galley link labels, media variant exposure | `media-files` | pending | no spec cited | untouched |
| 30 | profile email change confirms via old address, never verifies new | `user-profile` | pending | no spec cited | untouched |
| 31 | API keys derived from sha1(time()), predictable and colliding | `user-profile` | pending | no spec cited | untouched |
| 32 | minor cosmetics: profile label, category empty state, feeds Array, search a11y | `user-profile` | pending | no spec cited | untouched |
| 33 | API-driven role invitations send empty email body | `user-invitations` | pending | no spec cited | untouched |
| 34 | FIXED (graduated to S1 row 7): roles grid row at index 0 lacked actions | `roles-permissions` | pending | no spec cited | untouched |
| 35 | invitation accept doesn't persist browser session; login bounce | `user-invitations` | pending | no spec cited | untouched |
| 36 | user list keeps role-less users; row actions mismatch backend | `user-management` | pending | no spec cited | untouched |
| 37 | minor: missing translations, invitation warnings, email validation, invisible journal default | `user-management` | pending | no spec cited | untouched |
| 38 | per-journal theme save clears global template/CSS caches | `website-appearance-settings` | pending | no spec cited | untouched |
| 39 | legacy grid LinkAction clicks lost during post-save refresh | `review-forms` | pending | no spec cited | untouched |
| 40 | navigation menu editor DnD-only; drops silently nest items | `navigation-menus` | pending | no spec cited | untouched |
| 41 | minor: missing common.help locale, institution title param, dead dateFormatLong | `website-appearance-settings` | pending | no spec cited | untouched |
| 42 | Crossref issue export 400s when journal abbreviation is empty | `doi-deposit` | pending | no spec cited | untouched |
| 43 | ORCID author email fires at accept decision, not publication | `orcid` | pending | no spec cited | untouched |
| 44 | Subscription gate redirects readers to homepage without payments plugin | `subscription-access` | pending | no spec cited | untouched |
| 45 | Payments settings API boolean input silently disables payments | `payments` | pending | no spec cited | untouched |
| 46 | Publication stats All Dates view empty on young journals | `editorial-statistics` | pending | no spec cited | untouched |
| 47 | CSL RIS export renders malformed strftime dates | `citation-style-language` | pending | no spec cited | untouched |
| 48 | Minor batch: payment label swaps, dead settings, stubs, UI lags | `payments` | pending | no spec cited | untouched |
| 49 | Email attachments always delivered as application/octet-stream | `email-delivery` | pending | no spec cited | untouched |
| 50 | Editorial reminder in-app notification created at wrong level | `scheduled-tasks` | pending | no spec cited | untouched |
| 51 | API auth failures return unconventional 401/400 status codes | `rest-api` | pending | no spec cited | untouched |
| 52 | Add Reviewer suggestion list bad aria label, stale refresh | `reviewer-suggestions` | verified | reviewer-suggestions.spec.js: same-name campaign rebuild (cited round-1 test deleted) | untouched |
| 53 | Publish/unpublish API authorizes roles the UI hides buttons from | `publication-publish-flow` | pending | no spec cited | untouched |
| 54 | POST version validation gaps: ignored stage, 500 TypeError | `publication-versioning` | pending | no spec cited | untouched |
| 55 | Editing/production status notifications default to wrong level | `notifications` | pending | no spec cited | untouched |
| 56 | Site-admin task/discussion exemptions dead due journal-scoped role check | `tasks-discussions` | reference | no spec cited | untouched |
| 57 | Vestigial task note DELETE endpoint always 401s | `tasks-discussions` | reference | no spec cited | untouched |
| 58 | Overdue tasks un-editable until due date bumped | `tasks-discussions` | reference | no spec cited | untouched |
| 59 | Headnote-less tasks/discussions 500 on edit, render wrongly | `tasks-discussions` | reference | no spec cited | untouched |
| 60 | Tasks/discussions minor batch: self-notify, stale access, dead guards | `tasks-discussions` | reference | no spec cited | untouched |
| 61 | Submission create API bypasses author self-registration policy | `submission-wizard` | verified | no spec cited | untouched |
| 62 | Keyword autosuggest journal scoping broken, cross-journal term leak | `submission-wizard-metadata` | verified | no spec cited | re-confirmed by campaign row 179 (2026-07-11); old row unamended |
| 63 | Wizard step nav lacks aria-current on active step | `submission-wizard` | verified | no spec cited | untouched |
| 64 | Author API reads expose reviewer-suggestion uptake, anonymity leak | `reviewer-suggestions` | verified | no spec cited | untouched |
| 65 | saveForLater API can un-submit a completed submission | `submission-drafts` | verified | no spec cited | untouched (pre-reset re-verified 2026-07-03) |
| 66 | Bulk delete of over 30 incomplete drafts fails 404 | `submission-drafts` | verified | no spec cited | untouched |
| 67 | Legacy submissions/tasks page 500s; four ghost ops 404 | `editorial-dashboards` | verified | no spec cited | untouched |
| 68 | Reviewer dashboard search/filter/sort/pager controls are inert | `editorial-dashboards` | verified | no spec cited | untouched |
| 69 | Dashboard conflict-of-interest guard fails without Author enrolment | `editorial-dashboards` | verified | no spec cited | untouched |
| 70 | Legacy workflow/index without stage segment crashes 500 | `workflow-stage-navigation` | verified | no spec cited | untouched |
| 71 | Workflow modal opens incomplete drafts, bypassing completeness gate | `workflow-stage-navigation` | verified | no spec cited | untouched |
| 72 | Workflow shell and API doors disagree on revoked-role access | `workflow-stage-navigation` | verified | no spec cited | untouched |
| 73 | EDITOR_ASSIGN task notification dead after template rename | `stage-participants` | verified | no spec cited | re-validated 2026-07-21 (stage-participants probe C); no-drift re-confirmed 2026-07-22 (verify chunk e) |
| 74 | Re-assigning existing participant silently discards modal flags | `stage-participants` | verified | no spec cited | re-validated + amended 2026-07-21 (stage-participants probe C; UI path corrected — picker exclusion spans all stages); no-drift re-confirmed 2026-07-22 (verify chunk e) |
| 75 | Recommend-only assign-modal guards enforced on Edit, skipped on Add | `stage-participants` | verified | no spec cited | re-validated 2026-07-21 (stage-participants probe C, end-to-end); no-drift re-confirmed 2026-07-22 (verify chunk e) |
| 76 | Completed review's recommendation select stays enabled, cosmetic | `reviewer-response` | pending | no spec cited | untouched |
| 77 | OJS locale shadows "For editor only" label wording | `reviewer-response` | pending | no spec cited | untouched |
| 78 | Free-text review submittable empty despite client-side hint | `reviewer-response` | pending | no spec cited | untouched |
| 79 | In-use review form deactivatable despite activate-confirm promise | `review-forms` | pending | review-forms.spec.js: spec deleted | untouched (pre-reset re-verified, round-1 spec green) |
| 80 | Author sees editor phrasing in review-round status card | `review-rounds-and-revisions` | pending | no spec cited | untouched |
| 81 | Submission API participants array leaks author identity to reviewers | `review-anonymity` | pending | no spec cited | untouched |
| 82 | Copyediting assign-copyeditor prompt keyed on discussion, goes stale | `copyediting-stage` | pending | no spec cited | untouched |
| 83 | Production Awaiting Galleys prompt stale when galley created off grid path | `production-stage` | pending | production-stage.spec.js: spec deleted | untouched |
| 84 | Discussion template prefill drops server-computed participants and clears assignee | `tasks-discussions` | reference | no spec cited | untouched |
| 85 | File metadata edit missing from submission-level Activity Log | `submission-files` | pending | no spec cited | untouched |
| 86 | Activity Log button hidden but backend admits unassigned managers | `editorial-activity-log` | pending | no spec cited | untouched |
| 87 | File Information Center History tab always errors for assistants | `editorial-activity-log` | pending | no spec cited | untouched |
| 88 | Unauthenticated download of non-public journal library files via legacy page route | `document-library` | pending | no spec cited | untouched |
| 89 | Library file description marked required but never validated | `document-library` | pending | no spec cited | untouched |
| 90 | Contributor-role delete refusal shows generic network-error modal | `contributors` | pending | no spec cited | untouched |
| 91 | Single-citation API lacks assignment and published-lock authorization | `publication-metadata-references` | pending | no spec cited | untouched (pre-reset re-confirmed 2026-07-04) |
| 92 | DOI extracted on initial citation import never persisted | `publication-metadata-references` | pending | no spec cited | untouched |
| 93 | Media-files scenario seeder referenced removed VariantGroup constant, fixed | `harness` | harness (n/a) | media-files.spec.js: spec deleted | untouched |
| 94 | Future-issue assignment options unfulfillable for section editors, picker 403s | `publication-issue-assignment` | pending | no spec cited | untouched (pre-reset re-confirmed 2026-07-04) |
| 95 | PublishSubmissions auto-publish task registered in no scheduler | `scheduled-tasks` | pending | no spec cited | untouched |
| 96 | Summary of Changes amendment notice never rendered to readers | `publication-amendments` | pending | publication-amendments.spec.js: spec deleted | untouched |
| 97 | Data Citations manager controls ungated on published locked version | `data-availability-citations` | pending | no spec cited | untouched |
| 98 | Data citations never rendered on any reader page | `data-availability-citations` | pending | no spec cited | untouched |
| 99 | Publishing any issue unconditionally becomes journal's current issue | `issue-management` | pending | no spec cited | untouched |
| 100 | Single-highlight GET endpoint 500s passing Context object as id | `highlights-featured-content` | pending | no spec cited | untouched |
| 101 | Issue archive order undefined without custom issue ordering | `issue-archive-toc` | pending | no spec cited | untouched |
| 102 | Search orderBy=datePublished 500s on PostgreSQL grouping error | `site-search` | pending | no spec cited | untouched |
| 103 | Category Sort-by setting ignored on reader category page | `browse-category-section` | pending | browse-category-section.spec.js: spec deleted | untouched |
| 104 | Unapproving comment leaves stale approver data in database and API | `public-comments` | pending | no spec cited | untouched |
| 105 | Bulk delete comment reports endpoint 500s with two-plus reports | `public-comments` | pending | no spec cited | untouched |
| 106 | OAI advertises second granularity but filters from/until by day | `oai-pmh` | pending | no spec cited | untouched |
| 107 | announcementFeed Atom and RSS 1.0 emit malformed timestamps | `web-feeds-syndication` | pending | no spec cited | untouched |
| 108 | Registration affiliation required in UI, unenforced server-side | `registration-login` | pending | registration-login.spec.js: spec deleted | untouched |
| 109 | Login remember-me checkbox ships pre-ticked via literal checked attribute | `registration-login` | pending | registration-login.spec.js: spec deleted | untouched |
| 110 | Forced password change form skips compromised-password breach check | `password-flows` | pending | password-flows.spec.js: spec deleted | untouched |
| 111 | Anonymous username-driven change-password surface at /login/changePassword | `password-flows` | pending | password-flows.spec.js: spec deleted | untouched |
| 112 | Emailing or fetching disabled users fails, missing allowDisabled flag | `user-management` | pending | no spec cited | untouched (pre-reset re-confirmed 2026-07-05) |
| 113 | Users report CSV endpoint live but has no UI control | `user-management` | pending | no spec cited | untouched |
| 114 | Section editors reach endRole/masthead PUTs without administration-scope guard | `user-management` | pending | no spec cited | untouched |
| 115 | Section editors and assistants can invite new accounts into any role | `user-invitations` | pending | no spec cited | untouched |
| 116 | Tools Permissions mislabelled, bulk-resets every article's copyright and licence | `roles-permissions` | pending | roles-permissions.spec.js: spec deleted | untouched |
| 117 | Log In As one-click without reauthentication or audit trail | `login-as` | pending | no spec cited | untouched |
| 118 | Managers can edit admin-only context properties including enabled flag | `site-access-restrictions` | pending | no spec cited | untouched |
| 119 | Journal initials and support contact required in UI, clearable via API | `journal-masthead-settings` | pending | journal-setup.spec.js: spec deleted | untouched |
| 120 | POST contexts skips schema-required enforcement at journal creation | `site-administration` | pending | no spec cited | untouched |
| 121 | Custom block deletion 500s on PostgreSQL, plugin_Name column typo | `website-appearance-settings` | pending | no spec cited | untouched |
| 122 | Make a Submission block shipped default never installs, block starts disabled | `website-appearance-settings` | pending | no spec cited | untouched |
| 123 | journal stylesheet clear leaves orphaned public CSS file served forever | `website-appearance-settings` | pending | website-appearance-settings.spec.js: spec deleted | untouched |
| 124 | reviewer-recommendation settings API writable by section editors, no settings gate | `workflow-settings` | pending | no spec cited | untouched |
| 125 | review-reminder day bounds enforced client-side only, API stores any value | `workflow-settings` | pending | no spec cited | untouched |
| 126 | delayed open-access duration unbounded via API, negative makes issues open | `distribution-settings` | pending | no spec cited | untouched (pre-reset re-driven 2026-07-06) |
| 127 | decision wizard template search box always 401s for section editors | `email-templates-management` | pending | no spec cited | untouched |
| 128 | template save without access fields wipes role-access settings | `email-templates-management` | pending | no spec cited | untouched |
| 129 | Manage Emails wrong Add-modal title and hardcoded English Edit label | `email-templates-management` | pending | no spec cited | untouched |
| 130 | navigation-menus API skips settings gate for stripped managers | `navigation-menus` | pending | no spec cited | untouched |
| 131 | OJS menu-item types invisible to API, missing conditional warnings | `navigation-menus` | pending | no spec cited | untouched |
| 132 | menu editor wrong warnings and raw 500 on preview | `navigation-menus` | pending | no spec cited | untouched |
| 133 | menu nesting depth limit client-side only, deep levels unrendered | `navigation-menus` | pending | no spec cited | untouched |
| 134 | missing common.help locale key breaks Help button accessible label | `languages-locales` | pending | no spec cited | untouched |
| 135 | section editor auto-assignment silently dead on non-first journals | `sections` | pending | no spec cited | untouched |
| 136 | section form indexing/peer-review checkboxes are inert | `sections` | pending | no spec cited | untouched |
| 137 | section and category delete orphan subeditor assignment rows | `sections` | pending | no spec cited | untouched |
| 138 | titleless category POST bricks entire Categories manager with 500s | `categories` | pending | no spec cited | untouched |
| 139 | categoryFormComponent API route has no handler, always 500 | `categories` | pending | no spec cited | untouched |
| 140 | category tree toggle accessible label static and swapped | `categories` | pending | no spec cited | untouched |
| 141 | announcement type delete silently cascades to announcements without warning | `announcements` | pending | no spec cited | untouched |
| 142 | failed image upload on announcement edit deletes the announcement | `announcements` | pending | no spec cited | untouched |
| 143 | inert Send Email checkbox, broken fullTitle, stale notifications | `announcements` | pending | no spec cited | untouched |
| 144 | dangling image temporaryFileId causes 500 and garbage image setting | `announcements` | pending | no spec cited | untouched |
| 145 | frontend language switch dumps reader on site index on host mismatch | `languages-locales` | pending | no spec cited | untouched |
| 146 | Reload defaults invokable by managers though UI is admin-only | `languages-locales` | pending | no spec cited | untouched |
| 147 | fr_CA primary-locale error shows literal spaced placeholder | `languages-locales` | pending | languages-locales.spec.js: spec deleted | untouched |
| 148 | contexts API lets supportedLocales exclude the primary locale | `languages-locales` | pending | no spec cited | untouched |
| 149 | site API validates required fields against publication schema | `site-settings` | pending | no spec cited | untouched |
| 150 | single-journal installs hide the journal-redirect setting UI | `site-settings` | pending | no spec cited | untouched |
| 151 | getTheme missing return causes 500; duplicate setup tab ids | `site-settings` | pending | no spec cited | untouched |
| 152 | clearing site stylesheet leaves orphaned public file served | `site-settings` | pending | site-settings.spec.js: spec deleted | untouched |
| 153 | Create Journal blocks on untouched optional Country select | `site-administration` | pending | no spec cited | untouched |
| 154 | journal delete orphans contributor_roles rows | `site-administration` | pending | no spec cited | untouched |
| 155 | journal urlPath accepts reserved routes; index-pathed journal unreachable | `site-administration` | pending | no spec cited | untouched |
| 156 | Plugin Gallery tab 500s when gallery feed unreachable | `plugin-management` | pending | no spec cited | untouched |
| 157 | non-manager admin sees plugin toggles refused with raw locale key | `plugin-management` | pending | no spec cited | untouched |
| 158 | plugin settings REST admits pure admins the legacy grid refuses | `plugin-management` | pending | no spec cited | untouched |
| 159 | Send Review To ORCID action status-blind and role-blind | `assign-and-manage-reviewers` | verified | no spec cited | campaign-filed 2026-07-10 (calibration f1) |
| 160 | Log Response offered to Assistants, server refuses silently | `assign-and-manage-reviewers` | verified | no spec cited | campaign-filed 2026-07-10 (calibration f1) |
| 161 | Request Resent cell shows review due under response-due label | `assign-and-manage-reviewers` | verified | no spec cited | campaign-filed 2026-07-10 (calibration f1) |
| 162 | Request Sent response-due line dropped by undeclared message prop | `assign-and-manage-reviewers` | verified | no spec cited | campaign-filed 2026-07-10 (calibration f1) |
| 163 | review-confirmed event log fires on wrong confirmations | `assign-and-manage-reviewers` | verified | no spec cited | campaign-filed 2026-07-10 (calibration f1) |

## 3. §3 environment notes — current vs tied to deleted tests

Still describe the CURRENT environment (mitigations live in surviving infra):
- 5-worker parallel-load flakes + `retries: 1` on the app project — `lib/pkp/playwright/config-factory.js` exists; causes environmental, tests-agnostic.
- Scenario plain-string `metadata.title` 500 + proxy firewall + `task_runner Off` + offline DTD catalog — `seed-test-config.js`, `start-php-server.js`, `fixtures/dtd/` all exist.
- Stale gitignored build artifacts; rotating flake tail; pre-2026-06-05 DB schema drift; `.auth` tear; per-agent `--reporter=list` rule; worker-token search collisions (ties to §2 row 5); Crossref offline catalog; TZ-skew rule; deterministic-tag rule (its model file `versioning-states.spec.js` is deleted, rule stands).
- `pkpMail.inboxFor`/`latestTo` scoping — fixed in surviving `lib/pkp/playwright/support/mail.js`.
- Legacy grid click-swallow retry — `ReviewFormSettingsPage.openCreateElementForm` still exists (POM survived the reset; its consuming spec did not).
- JobRunner-drains-jobs-under-Mail::fake hazard — mechanism current; the "safe lifecycle" it relies on (serial project) currently has no serial specs.
- All 11 campaign-era harness lessons dated 2026-07-11 (French affiliations, seeded-assignment/suggestion parity, draft `date_submitted`, sr-only checkboxes, keyup search, `pkpApi.login()` no-op, titleless drafts, published-status parity, `date_start` skew, genre-first upload, typed search events) — current.

Tied to deleted tests / stale anchors:
- **`clearAll()` confinement**: `lib/pkp/playwright/tests/serial/mailpit-harness.spec.js` NO LONGER EXISTS (reset casualty; no serial/ dir at all). The Mail::fake leak check and the "only permitted clearAll caller" enforcement are gone; surviving specs merely promise "never clearAll" in comments.
- **doi-crossref flake candidate** ("configures Crossref via Settings UI") — that spec is deleted; note is unactionable until `doi-management`/`doi-deposit` rebuild.
- Historical anchors inside otherwise-current notes (wave-1 false failures, wave-11 failing specs, wave-7 article-landing/galleys helpers, old `mailpit.spec.js`) refer to deleted tests but only as provenance.

## 4. Proposed markings (NOT applied)

1. §1 row 8: replace "lib/pkp (roster migration, uncommitted)" with "lib/pkp `bdcb41580c` (roster migration)".
2. §1 header: add a line "Uncommitted as of 2026-07-21: rows 2 and 5 only."
3. §2: add a legend under the §2 header: "Era markers: [R1] round-1 finding (tests deleted 2026-07-01), [R2] round-2 pre-reset finding (specs scratched 2026-07-10, finding stands), [C] current-campaign row. Rows 1–163 anchors citing .spec.js files refer to deleted tests unless noted."
4. §2 rows citing deleted specs (7, 8, 10, 13, 15, 16, 22, 79, 83, 93, 96, 103, 108, 109, 110, 111, 116, 119, 123, 147, 152): append "(anchor spec deleted — finding stands as app fact)" to the Evidence cell. Row 22 additionally: strike "the retained playwright/tests/galleys.spec.js" — that spec did not survive the 2026-07-10 reset.
5. §2 row 52: annotate that today's `reviewer-suggestions.spec.js` is the campaign rebuild, not the cited round-1 test.
6. §2 row 62: cross-link "re-confirmed by campaign row 179 (2026-07-11)"; row 179: back-link "supersedes row 62".
7. §2 rows 159–163: tag "[C] campaign row (calibration f1, 2026-07-10)" so they are not mistaken for round-1 legacy.
8. §3 clearAll bullet: append "2026-07-21 audit: mailpit-harness.spec.js was scratched in the reset — the leak check and sole-caller enforcement need re-authoring when the serial project returns."
9. §3 doi-crossref bullet: append "(spec deleted in reset; revisit at doi-management rebuild)".
