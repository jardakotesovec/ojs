# The pile — unassigned atoms

Atoms that don't obviously belong to a feature land here instead of being force-fit
(charter invariant). Each entry: atom ID, why it didn't fit, date parked. Grooming
passes (every ~3 waves) cluster this list; an entry leaves the pile by being claimed
by a spec or marked out-of-scope in its sweep file with a reason.

| Atom | Why parked | Parked | Resolved |
|------|-----------|--------|----------|
| VUE-submissions-list-panel | FEATURE-MAP guessed an "author variant" under author-dashboard, but the author's My-Submissions rows are rendered by DashboardPage/DashboardTable cells, not `SubmissionsListPanel.vue`; its only live mounts are the export pickers in `plugins/importexport/native/templates/index.tpl` and `plugins/importexport/pubmed/templates/index.tpl` — belongs to a future native-xml-import-export / pubmed-export spec (author-dashboard spec + submission-drafts verifier, both checked live) | 2026-07-03 | |

## Dead-code candidates

Atoms judged unreachable in the current UI (charter: "Liveness before documentation").
Each entry needs evidence, not vibes — who would have linked to it and doesn't.
Especially watch legacy grids/handlers superseded by Vue managers. This list is a
maintainer deliverable (cleanup candidates), reviewed at campaign end.

| Atom | Evidence of unreachability | Superseded by | Date |
|------|---------------------------|---------------|------|
| GRID-grid-pub-ids-pub-id-export-issues-list-grid-handler | No component-path/extends/`new` reference anywhere in templates/, lib/pkp/templates/, lib/ui-library/src/, pages/, classes/, controllers/, plugins/ (checked via combined grep across those trees) | VUE-doi-list-panel-ojs | 2026-07-02 |
| GRID-grid-pub-ids-pub-id-export-representations-list-grid-handler | Same as above — no reference found in any tree | VUE-doi-list-panel-ojs | 2026-07-02 |
| GRID-grid-pub-ids-pub-id-export-submissions-list-grid-handler | Same as above — no reference found in any tree | VUE-doi-list-panel-ojs | 2026-07-02 |
| GRID-lib-pkp-grid-files-production-ready-production-ready-files-grid-handler | Concrete class extends `FileListGridHandler` but has no component-path reference, no subclass, and no `new` instantiation anywhere | VUE-file-manager | 2026-07-02 |
| GRID-lib-pkp-grid-files-review-workflow-review-revisions-grid-handler | Concrete class extends `FileListGridHandler` but has no component-path reference, no subclass, and no `new` instantiation anywhere | VUE-file-manager | 2026-07-02 |
| GRID-lib-pkp-grid-files-selectable-library-file-grid-handler | Extends `LibraryFileGridHandler` (a live-rooted base class) but is itself never extended, instantiated, or referenced by component path; unlike its sibling suspected-dead atoms, OMP/OPS-only usage can't be ruled out since that source isn't in this checkout (genuinely uncertain) | VUE-media-file-manager | 2026-07-02 |
| GRID-lib-pkp-grid-files-submission-editor-submission-details-files-grid-handler | Concrete class extends `FileListGridHandler` but has no component-path reference, no subclass, and no `new` instantiation anywhere. (The original note that its author-facing sibling was "live" was stale — the sibling is dead too, see the 2026-07-03 row below; corrected by author-dashboard verifier) | VUE-file-manager | 2026-07-02 |
| GRID-lib-pkp-grid-users-author-author-grid-handler | Abstract "base PKP class to handle author grid requests" with zero subclasses anywhere in the repo (unlike its sibling base classes, e.g. `LanguageGridHandler`, `FileListGridHandler`, which do have live subclasses) — no component-path reference either | VUE-contributor-manager | 2026-07-02 |
| PAGE-manager-legacy | `pages/manager/index.php` router is fully dead — every switch case has an empty body; real logic lives in `pages/payments/PaymentsHandler.php` (pages sweep) | PAGE-payments-* | 2026-07-02 |
| PAGE-dois-management | Declared in `addRoleAssignment` but never routed/implemented — would 404 if hit (pages sweep) | PAGE-dois-index → Vue DOI pages | 2026-07-02 |
| PAGE-reviewer-downloadfile | Declared in role list but never routed/implemented (pages sweep) | — | 2026-07-02 |
| PAGE-search-similardocuments | Routed in switch, no implementing method (pages sweep) | — | 2026-07-02 |
| PAGE-authordashboard-reviewroundinfo | Routed, no implementing method (pages sweep) | VUE workflow author views | 2026-07-02 |
| PAGE-manageissues-issuestabs | Routed, no implementing method (pages sweep) | — | 2026-07-02 |
| PAGE-management-statistics | Routed, unimplemented (pages sweep) | PAGE-stats-* | 2026-07-02 |
| NOTIF-configure-payment-method | Defined with URL/style-class switch cases but zero `createNotification` call sites repo-wide (notifications sweep) | — | 2026-07-02 |
| NOTIF-book-* (10 atoms) | All 10 `NOTIFICATION_TYPE_BOOK_*` constants in OJS's Notification.php have zero creation sites in `classes/` or `plugins/` — OMP-inherited dead code (notifications sweep) | — | 2026-07-02 |
| EVLOG-REV-DUE | `SUBMISSION_LOG_REVIEW_SET_DUE_DATE` — no live writer found; appears only in a v3.4.0 field-rename migration (event-log sweep) | — | 2026-07-02 |
| GRID-lib-pkp-grid-files-attachment-author-review-attachments-grid-handler | Only reference is `lib/pkp/templates/authorDashboard/reviewRoundInfo.tpl`, which nothing renders: `PKPAuthorDashboardHandler::submission()` redirects before any display (live-probed 302), the `reviewRoundInfo` op is routed-but-unimplemented (live-probed 404), and `setupTemplate()` has no caller — and would fatal on the undefined `$citationsForm` it references if one existed (author-dashboard spec). Verifier re-attack 2026-07-03: a hand-crafted component-router fetch still answers 200 for an authorized author — UI-orphaned, not unroutable | VUE-file-manager (author workflow view) | 2026-07-03 |
| GRID-lib-pkp-grid-files-review-author-review-revisions-grid-handler | Same dead template (`authorDashboard/reviewRoundInfo.tpl`); no other reference beyond the inert JS handler class in pkp.min.js (author-dashboard spec). Verifier re-attack 2026-07-03: direct component-router fetch answers 200 — UI-orphaned, not unroutable | VUE-file-manager (WORKFLOW_REVIEW_REVISIONS) | 2026-07-03 |
| GRID-lib-pkp-grid-files-submission-author-submission-details-files-grid-handler | Only reference is `lib/pkp/templates/controllers/tab/authorDashboard/submission.tpl`, itself included by nothing (the legacy author-dashboard tab path died with the 3.6 redirect) (author-dashboard spec). Verifier re-attack 2026-07-03: direct component-router fetch answers 200 — UI-orphaned, not unroutable | VUE-file-manager (SUBMISSION_FILES) | 2026-07-03 |
