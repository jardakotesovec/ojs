# Product spec inventory

Feature list with status. One row per spec in `specs/`. Status: `pilot` (calibrating
the template), `planned`, `draft`, `verified`. The authoritative completeness metric
is the atlas unclaimed-atom count (see `CHARTER.md`), not this table's length —
features are added here as atom clusters get named.

| Spec | Scope | Shared | Status | Atoms claimed |
|------|-------|--------|--------|---------------|
| tasks-discussions | Editorial tasks & discussions on submissions | pkp-lib | verified (pilot) | 57 |
| publication-versioning | Publication versions: create, publish, unpublish, reader display | pkp-lib | verified (pilot) | 18 |
| submission-wizard | Make-a-Submission wizard: start form, steps, submit, acknowledgement, cancel, reconfigure | pkp-lib | verified | 30 |
| submission-wizard-metadata | For-the-Editors metadata questions: per-field collect/ask/require modes, vocab chips, the Metadata settings panel | pkp-lib | verified | 10 |
| reviewer-suggestions | Author suggests reviewers in a wizard step; editors consume them at assignment (prefill + approval); journal toggle + guidance | pkp-lib | verified | 10 |
| submission-drafts | Save-for-Later + resume email, the Incomplete-submissions list, resume-at-step, and draft deletion (single + bulk) | pkp-lib | verified | 5 |
| author-dashboard | My Submissions list (state views, search, filters, per-state rows) + the author's read-mostly tracking view of one submission; legacy authorDashboard redirect + readSubmissionEmail | pkp-lib | verified | 5 |
| editorial-dashboards | Editor Dashboard (role-scoped state views, counts, filters, search, sort, table + row actions) + reviewer My-Assignments dashboard, shared DashboardPage machinery, legacy submissions/dashboard redirects | pkp-lib | verified | 16 |
| workflow-stage-navigation | The workflow-modal shell for editorial roles: header/stage bubble, stage + publication menu (round sub-items), default-pane-per-state, stage-access matrix, workflowMenuKey deep links, legacy workflow/* redirect shims | pkp-lib | verified | 12 |
| editorial-decisions | The decision engine: Record-Decision wizard, notify-author/reviewer/other-authors emails, attach-files, the decision→stage/status/round transition machine, decline & revert, request-revisions vs resubmit, recommend-only flow, Done-stage transitions | pkp-lib | verified | 41 |
| stage-participants | The per-stage Participants panel: add/edit/remove a participant (user + role, recommend-only/metadata flags, optional notify), assignment-grants-access effect, assistant read-only scoping, submission-time auto-assignment from subeditor_submission_group | pkp-lib | verified | 8 |
| send-to-review | The Submission-stage (stage 1) workspace: incoming submission files, Desk Review discussions, participants, the "before any reviewer" state, and the three stage-1 exits (Send for Review / Accept and Skip Review / Decline) with the stage-1 UX + which files carry forward; decisions themselves referenced from editorial-decisions | pkp-lib | verified | 1 |
| assign-and-manage-reviewers | The editor's reviewer-management surface on the review stage: Reviewers grid + live statuses, Add-Reviewer picker/form, and the per-reviewer actions (unassign/cancel, reinstate, resend, thank, edit, details, history) with their 5 emails | pkp-lib | verified | 19 |
| reviewer-response | The reviewer's own side of peer review: reach the assignment (dashboard or one-click email key), accept/decline, the four-step review wizard (request/guidelines/download-&-review/completion), comments-or-review-form + recommendation + attachments, submit; the accept/decline/complete emails, reviewer-comment notification, and per-assignment access gate | pkp-lib | verified | 17 |
| review-forms | The manager's review-form builder (Settings → Workflow → Review): create/edit/copy/delete a form, add/order question elements (six item types + possible-responses list for choice types), required/author-visible flags, activate/deactivate + the in-use lock, and how an active form becomes selectable at assignment | pkp-lib | verified | 9 |
| review-rounds-and-revisions | The review-round lifecycle on External Review: what a round is, the 16-value round-status machine (computed on read), the per-round panel, the author revision-upload → resubmit cycle, the 3.6 editor-requests → author-submits written-response flow, and prior-round history; decisions themselves referenced from editorial-decisions | pkp-lib | verified | 22 |
| recommend-only-editors | The recommend-only editorial role: what the recommend_only flag does — review-pane swaps decision buttons for Recommend Accept/Decline/Revisions, the deciding-editor requirement, where a recommendation surfaces to the decider, retained reviewer/participant management. Recommendation ACT owned by editorial-decisions, flag by stage-participants, reviewer-recommendation-OPTIONS config by workflow-settings | pkp-lib | verified | 0 (role spec — all surfaces owned elsewhere; seam resolved) |
| review-anonymity | The three peer-review methods (double-anonymous/anonymous/open) and the single cross-party visibility matrix — who sees whom (reviewer↔author, reviewer↔reviewer, editor, public reader) under each method, and where the code enforces each redaction; the single home the sibling review specs reference | pkp-lib | verified | 1 |
| copyediting-stage | The Copyediting (stage 4) workspace: Draft Files / Copyedited Files grids + file stages, the assign-copyeditor/awaiting-copyedits editor status prompt, the copyeditor's & author's stage-4 panes, the copyedit-specific notify (Request Copyedit) + email-log corpus, and the two exits (Send To Production / Move to Review) referenced from editorial-decisions | pkp-lib | verified | 16 |
| production-stage | The Production (stage 5) workspace: the Production Ready Files grid (the copyedited/draft files promoted from copyediting) + file stage, the assign-production-user/awaiting-galleys editor status prompt, the layout-editor role + Ready-for-Production notify + layout/proof/index email-log corpus, the galley milestone (galleys/proofing owned by galleys feat. 26), and the two exits (Schedule For Publication nav → publication-publish-flow, Move To Copyediting → editorial-decisions) | pkp-lib | verified | 21 |
| submission-files | The cross-stage file-management machinery every editorial stage shares: the Vue FileManager (list/upload/revise/edit-metadata/delete/download per stage), the multi-step upload wizard, file revisions, dependent files, genres-in-use, non-ASCII filenames, single + download-all downloads, and the file attacher pinning files onto emails/discussions; plus the submission-file model/schema/access-policies and the file event log | pkp-lib | verified | 40 |
| editorial-activity-log | The read surface for a submission's editorial audit trail: the per-submission "Activity Log & Notes" history modal (workflow header, History + Notes tabs, emails merged into History — no separate Email tab) and the per-file Information Center (Notes/History), plus the event-log entity/schema/DB the log is written to and the note-adding UI. Owns the surface + render + note-adding; each event type is co-claimed by the feature that fires it | pkp-lib | verified | 8 |
| document-library | The Document Library: reusable non-scholarly documents (marketing/permissions/reports/other) at two levels — the journal-wide context library (Settings → Workflow → Library) and the per-submission library (workflow Library button), plus upload/edit/delete/download, the Public-Access public URL, and the `_library` email-attach API. Verifier confirmed a ⚠ unauthenticated-disclosure security hole on the legacy download page op (app-changes #88) | pkp-lib | verified | 12 |
| publication-title-abstract-body | The workflow Publication → Title & Abstract tab (prefix/title/subtitle/abstract + optional plain-language summary, multilingual, re-edited post-submission behind the versioning edit gate) plus the Body Text tab: the bundled SciFlow full-text editor + in-browser Pandoc (Word/Markdown → HTML) importer. Verifier retracted all 3 code-read ⚠ candidates against the OJS as-built (the OJS `getPublicationTitleAbstractForm()` override surfaces the abstract's required marker + word-count meter; the Body Text tab shows the published warning banner; author-in-route is API-only/policy-gated) — no ledger rows | pkp-lib | verified | 7 |
| contributors | The Contributors manager (workflow Publication → Contributors tab + reused as the wizard's Contributors step): add/edit/delete/reorder contributors, primary-contact, affiliations, journal-configured contributor roles (Author/Translator) vs NISO CRediT roles+degrees (both in `credit_contributor_roles` under an XOR), the ContributorRoleManager settings. Verifier refuted the "delete/reorder skip the published-lock" ⚠ (all four writes are gated by `PublicationWritePolicy` → `PublicationCanBeEditedPolicy`, same `canEditPublication` check — OQ1 resolved) and downgraded the credit-plugin duplicate-field ⚠ (benign, off by default); confirmed a new ⚠ (refused role-delete → generic network-error modal, ledger §2 row 90) and fixed two atlas mis-tags (author-reviewer + author-submission-details-files grids off `contributors`) | pkp-lib | verified | 28 |
| publication-metadata-references | The workflow Publication → Metadata tab (keywords/subjects/disciplines/agencies chips + coverage/rights/source/type/funding, multilingual, base `PKPMetadataForm` used directly — no OJS override) and the References tab (the `CitationManager`: add raw refs → parsed rows, raw/structured per-citation edit driven by `citationsMetadataLookup`, delete, reprocess), both behind the `canEditPublication` gate. Verifier re-confirmed the ⚠ single-citation API authorization hole (row 91, the campaign's 2nd) — an unassigned author GETs/PUTs any submission's citation → 200 — and made it precise: only the single-citation routes are ungated; the bulk routes enforce assignment + the published-lock (inline `canEditPublication()` guard) live. Also confirmed the ⚠ initial-import DOI drop (row 92), the no-category-field scope correction (categories are on the Issue tab), and no base-vs-override false alarm | pkp-lib | verified | 17 |

Pilot outcome (2026-07-02): both specs adversarially verified with live probes; verifier
refuted 3 permission cells + 1 state rule in tasks-discussions pre-fix (all corrected),
confirmed 6 new REAL deviations → e2e ledger §2 rows 53–60; unclaimed atoms: 1,436 of
1,511 (75 claimed). Dead-code candidates so far: 19 (UNASSIGNED.md).

## Atlas sweeps (Phase 0 — completed 2026-07-02)

Total: **1,511 atoms** across 13 modalities. Every sweep file records its own Gaps
section; the liveness audit (Phase 0.5) appends verdicts to `atlas/grids.md` and seeds
`UNASSIGNED.md` §Dead-code candidates.

| Sweep | File | Atoms | Notable gaps/oddities |
|-------|------|-------|-----------------------|
| Page handlers | atlas/pages.md | 164 | pages/manager router fully dead; 6 routed-but-unimplemented ops |
| API endpoints | atlas/api.md | 284 | `_test/` excluded; Route::prefix paths recovered manually |
| Legacy component handlers | atlas/grids.md | 87 | ~18 handlers are base classes; liveness audit appended |
| Vue surfaces | atlas/vue.md | 75 | frontend/components included; OMP-only managers skipped; empty pages/doi dir |
| Forms & schemas | atlas/forms-schemas.md | 121 | Field* widgets excluded; context.json = 131 props from ~15 forms |
| Plugins | atlas/plugins.md | 51 | gateways/ category empty; pflPlugin has no e2e plan |
| Mailables | atlas/mail.md | 69 | two mailables share SUBMISSION_ACK_NOT_USER template |
| Notification types | atlas/notifications.md | 65 | CONFIGURE_PAYMENT_METHOD + 10 BOOK_* never created; 4 editing-status types at wrong level |
| Jobs & scheduled tasks | atlas/jobs-tasks.md | 57 | no OJS scheduledTasks registry; test jobs in production tree |
| Authorization & middleware | atlas/authorization.md | 90 | zero unused policies; ~35 granular sub-policy fragments |
| Event-log types | atlas/event-log.md | 57 | 2 constants with no live writer; 1 duplicate hex value |
| DB entities | atlas/db-entities.md | 149 | highlights table has no e2e plan; 83 tables unhinted |
| Locale prefixes | atlas/locale.md | 242 | coarse net (2-segment prefixes, count≥4) for the completeness critic |
