# Cypress retirement cross-check — round-1 final audit

- **Date:** 2026-06-12, gaps resolved + verdict flipped 2026-07-01 (branch `e2e_revamp_fable`)
- **Auditor scope:** read-only verification that every legacy Cypress assertion maps to a
  current Playwright test or a recorded "intentionally dropped" reason, per
  `docs/e2e/PRINCIPLES.md` ("Absorbing the pre-revamp specs") and §4 of
  `docs/e2e-playwright-migration.md`.
- **Method:** enumerated every `*.cy.js` on disk under `cypress/tests/` (32 files) and
  `lib/pkp/cypress/tests/` (14 files); for each, followed the chain
  *Cypress file → §4 roadmap row → pre-revamp Playwright destination → current plan row +
  spec path* (the last hop via the **Absorbs** records in `docs/e2e/plans/*.md`, since many
  §4 destinations were renamed/merged during waves 2–12). 14 spot-checks opened the named
  Playwright spec and confirmed the assertion exists (log below).
- **Plan-status basis (at audit time):** 74/80 plans fully implemented; 6 plans carried
  residual `planned` rows (api-smoke 5–6, jobs-queue 3, native-xml-import-export 4,
  email-delivery 1–6, notifications 1–4, scheduled-tasks 1–4). Per the audit instruction,
  rows marked `implemented` were treated as done. None of the `planned` rows was the sole
  owner of a Cypress assertion. **Wave-12 update:** all six plans have since landed
  (80/80), and the formerly in-flight successors (api-smoke 5–6, jobs-queue 3, native-xml
  row 4) are implemented.

Legend: ✅ mapped to implemented test(s) · 📝 mapped + recorded drop for a sub-surface ·
⏳ recorded drop with an in-flight stronger successor · ❌ gap (see Gaps section).

## 1 · Shared Cypress — `lib/pkp/cypress/tests/integration/` (14 files)

| Cypress file | §4 row | Coverage now lives | Status |
|---|---|---|---|
| `Announcements.cy.js` | §4.1 → #1 | `announcements` plan rows 1–5 → `lib/pkp/playwright/tests/announcements.spec.js` | ✅ |
| `API.cy.js` | §4.1 → #47 | `api-smoke` rows 1–3 → `lib/pkp/playwright/tests/api-smoke.spec.js`; API-key lifecycle UI → `user-profile` row 6 → `lib/pkp/playwright/tests/user-profile.spec.js`. ApiToken *request* auth: recorded drop in §4.1 ("apiToken-UI flow intentionally retired in favour of session-auth path") with in-flight successor `api-smoke` row 5 (planned). | ⏳ recorded |
| `Categories.cy.js` | §4.1 → #15 | `categories` rows 1–4 → `lib/pkp/playwright/tests/categories.spec.js`; row 5 split → `playwright/tests/categories-publication.spec.js` | ✅ |
| `DataAvailabilityStatements.cy.js` | §4.1 → #40 | `submission-wizard-metadata` (absorbs the 2-test spec) → `lib/pkp/playwright/tests/data-availability.spec.js`. The 2 env-flag-gated reviewer-visibility tests: recorded drop (§4.1 — gated on a never-set env flag). | 📝 |
| `EditorialMasthead.cy.js` | §4.1 → #3 | `editorial-masthead` rows 1–2 → `lib/pkp/playwright/tests/editorial-masthead.spec.js` | ✅ |
| `emailTemplates/EmailTemplates.cy.js` | §4.1 → #4 | `email-templates-management` rows 1–6 → `lib/pkp/playwright/tests/email-templates.spec.js` | ✅ |
| `Filenames.cy.js` | §4.1 → #17 | `submission-files` row 1 → `lib/pkp/playwright/tests/filenames.spec.js` (plus the wider submission-files rows) | ✅ |
| `Jobs.cy.js` | §4.1 → #45 | `jobs-queue` rows 1–2 → `lib/pkp/playwright/tests/jobs-queue.spec.js`. Failed-job redispatch/details/delete lifecycle (Cypress test 2): recorded drop (§4.1 — `jobs.php` shell-out, covered by `lib/pkp/tests/jobs/` PHPUnit) with in-flight successor `jobs-queue` row 3 (planned, child_process drain). | ⏳ recorded |
| `Multilingual.cy.js` | §4.1 → #5 | `languages-locales` rows 1–3 → `lib/pkp/playwright/tests/multilingual.spec.js` | ✅ |
| `NativeXmlImportExportSubmission.cy.js` | §4.1 → #53 | `native-xml-import-export` row 1 → `playwright/tests/native-xml-submission.spec.js` | ✅ |
| `NavigationMenus.cy.js` | §4.1 → #2 | `navigation-menus` rows 1–4 → `lib/pkp/playwright/tests/navigation-menus.spec.js` | ✅ |
| `oai/DC.cy.js` | §4.1 → #39 | `oai-sitemap-feeds` rows 1–3 → `lib/pkp/playwright/tests/oai-dc.spec.js` (sitemap/feed rows 4–5 split → `playwright/tests/sitemap-feeds.spec.js`) | ✅ |
| `orcid/Orcid.cy.js` | §4.1 → #55 | `orcid` rows 1–7 → `lib/pkp/playwright/tests/orcid.spec.js` (config persist/clear, Connect button, registration prefill, verified + unverified badge, verification request, accept-decision emails) | ✅ |
| `publicComents/PublicComments.cy.js` (24 its) | §4.1 → #38/#61 | `public-comments` rows 1–5 → `lib/pkp/playwright/tests/public-comments.spec.js` + `lib/pkp/playwright/tests/user-comments-moderation.spec.js` (approve/hide via detail modal landed in wave 12 — the §3 row-61 deferral is closed). Recorded drops in the plan: report flows (~12 its), delete-own/others authorization, version-closes-commenting, TinyMCE textarea e2e. **G1 RESOLVED (wave 12):** the enable/disable toggle pair now lives as `public-comments` row 6 → `lib/pkp/playwright/tests/public-comments.spec.js` (Website → Content → Comments checkbox drives the section on AND off for anonymous readers, persistence via contexts API). | ✅ |

## 2 · OJS Cypress — `cypress/tests/integration/` (16 files on disk; §4.2 header's "18" is a stale count)

| Cypress file | §4 row | Coverage now lives | Status |
|---|---|---|---|
| `API.cy.js` | §4.2 → #47 | `api-smoke` row 4 (author lists own submission) → `lib/pkp/playwright/tests/api-smoke.spec.js`; key-management UI → `user-profile` row 6. ApiToken request auth: same recorded drop + in-flight row 5 as the shared file. | ⏳ recorded |
| `ChangeSubmissionLanguage.cy.js` | §4.2 → #33 | `publication-versioning` row 3 → `lib/pkp/playwright/tests/publication-language-change.spec.js` (moved from `playwright/tests/`, refit 2026-06-12) + row 4 (multi-version lockout) → `lib/pkp/playwright/tests/versioning-states.spec.js` | ✅ |
| `Discussions.cy.js` | §4.2 → #18 | Split on absorption: discussion CRUD → `discussions` row 1 → `lib/pkp/playwright/tests/discussions.spec.js`; task CRUD + role-scoped edit/delete → `editorial-tasks` rows 1–2 → `lib/pkp/playwright/tests/editorial-tasks.spec.js` | ✅ |
| `Doi.cy.js` | §4.2 → #31 | `doi-management` rows 1+3 → `playwright/tests/doi-assignment.spec.js` (config UI, auto-assign + reader render); rows 4–6 → `playwright/tests/doi-management.spec.js`. The two Cypress-side `.skip`'d tests (filters/mark-registered, marked-status behaviour, blocked on pkp-lib#10606) now have **live successors** (rows 4–6: status badges/filters, Mark Registered/Stale/Unregistered, manual Assign DOIs) — stronger than the source. | ✅ |
| `DoiCrossref.cy.js` | §4.2 → #32 | `crossref-deposit` rows 1–4 → `playwright/tests/doi-crossref.spec.js`. The formerly deferred export-XML round-trip (PHP max_execution_time on XSD fetch) landed in wave 11 via a locally cached schema tree (`lib/pkp/playwright/fixtures/dtd/crossref/`) — §3's ⚠️ row 32 is closed. | ✅ |
| `emailTemplates/EmailTemplates.cy.js` | §4.2 → #4 | `email-templates-management` rows 1–6 → `lib/pkp/playwright/tests/email-templates.spec.js` | ✅ |
| `MultipleContexts.cy.js` | §4.2 → #46 | Multi-context role scoping → `site-administration` (absorbs `playwright/tests/multiple-contexts.spec.js`). The file's actual single `it()` (disabled journal not publicly visible) → `site-access-restrictions` row 4 → `lib/pkp/playwright/tests/site-access-restrictions.spec.js` (disable via contexts-grid Edit modal, anonymous redirect-to-login, absent from index, admin retains access, re-enable restores) — the §4 "enable/disable grid out of scope" drop has been **superseded by real coverage**. | ✅ |
| `orcid/Orcid.cy.js` (1 it: verification request) | §4.2 → #55 | `orcid` row 5 → `lib/pkp/playwright/tests/orcid.spec.js` (FieldOrcid "Request verification" → confirm → button flip → Mailpit) | ✅ |
| `Pubmed.cy.js` | §4.2 → #37 | `native-xml-import-export` row 5 → `playwright/tests/pubmed-metadata.spec.js` (MEDLINE XML + anonymous rejection) | ✅ |
| `ReviewerRecommendation.cy.js` | §4.2 → #6 | `review-settings` row 5 → `lib/pkp/playwright/tests/reviewer-recommendations.spec.js` (5 tests: defaults, CRUD, active toggle, in-use lock, inactive filtered from reviewer form) | ✅ |
| `Statistics.cy.js` | §4.2 → #36 | `usage-statistics` rows 1, 4–5 → `lib/pkp/playwright/tests/usage-statistics.spec.js`. The metrics-seeding shell-out (`generateTestMetrics.php`) was replaced by the wave-1 `metrics` scenario passthrough; date-range filtering + report CSV are now asserted against seeded counts — §3's ⚠️ row 36 is closed. | ✅ |
| `SubmissionWizard.cy.js` (6 its) | §4.2 → #10–14, #16 | comments→discussion → `discussions` row 5 (seeded parity) + `submission-wizard-validation` row 7 (typed comments survive submit) → `lib/pkp/playwright/tests/submission-wizard-validation.spec.js`; section rules → validation rows 4–5; copyright gate (EN+FR) → validation row 3; required-data validation → validation rows 1–2; language change → `submission-wizard-language` rows 2–3 → `lib/pkp/playwright/tests/submission-wizard-language.spec.js`; field-config reset → `submission-wizard-metadata` rows 5–8 → `lib/pkp/playwright/tests/submission-wizard-metadata.spec.js` (the "reset to defaults" assertion: recorded drop — tautological on per-test scratch journals, §1 row 16). | ✅ |
| `Subscriptions.cy.js` (6 its) | §4.2 → #9/#52 | Types CRUD + policies + publishingMode → `subscriptions-management` rows 1–5 → `playwright/tests/subscription-config.spec.js` + `playwright/tests/subscription-management.spec.js`; Payments tab → `payments` row 1 (split of subscription-config); "Creates a subscription" → subscriptions-management rows 6–7 (individual + institutional grids); access gates (anonymous/editor/subscriber) → `subscription-access` rows 1–6 → `playwright/tests/subscription-access.spec.js`; open-access check → `distribution-settings`. | ✅ |
| `TaskTemplates.cy.js` | §4.2 → #25 | `editorial-tasks` rows 3–6 → `lib/pkp/playwright/tests/task-templates.spec.js` (config CRUD, auto-add toggle, validation, apply-in-workflow prefill) | ✅ |
| `Y_NativeXmlImportExportIssue.cy.js` | §4.2 → #54 | `native-xml-import-export` rows 2–3 → `playwright/tests/native-xml-issue.spec.js` (export identifiers round-trip; reimport into a fresh journal). The Tools-UI grid/download path is in-flight (row 4, planned) — all of the Cypress file's *assertions* map to implemented rows. | ✅ (row 4 in flight) |
| `Z_ArticleViewDCMetadata.cy.js` | §4.2 → #34 | `article-landing` (absorbs the 2-test spec) → `playwright/tests/article-dc-metadata.spec.js`. DC.Coverage / Type.localized / Description / Title.Alternative / Format / Identifier.DOI subsets: recorded drops (§4.2, dependency-bound, documented). | 📝 |

## 3 · OJS ApplicationSetup — `cypress/tests/data/10-ApplicationSetup/` (6 files)

| Cypress file | §4 row | Coverage now lives | Status |
|---|---|---|---|
| `10-Installation.cy.js` | §4.3 | Recorded drop: installer UI replaced by programmatic bootstrap (`lib/pkp/playwright/fixtures/bootstrap.js` + setup project); "no successor row by design". | 📝 |
| `20-CreateContext.cy.js` | §4.3 → #59 | `site-administration` → `playwright/tests/admin-add-journal.spec.js` (validation arms + happy path + wizard redirect) + `playwright/tests/site-administration.spec.js` rows 2–3 (Settings-Wizard UI) | ✅ |
| `40-CreateUsers.cy.js` | §4.3 → #57/#58/#60 | Baseline users seeded programmatically (`lib/pkp/playwright/data/users.js`); invite flows → `user-invitations` rows 1–6 → `lib/pkp/playwright/tests/user-invitation.spec.js` + `user-role-assignment.spec.js`; self-registration → `registration-login` → `lib/pkp/playwright/tests/user-registration.spec.js`; admin-side user ops → `user-management` rows 1–8 → `lib/pkp/playwright/tests/user-management.spec.js` | ✅ |
| `50-CreateCategories.cy.js` | §4.3 → #15 | `categories` rows 1–4 → `lib/pkp/playwright/tests/categories.spec.js` (incl. nesting/breadcrumbs) | ✅ |
| `50-CreateIssues.cy.js` | §4.3 → #7 | `issue-management` rows 1–4 → `playwright/tests/issues.spec.js` (+ rows 5–11 → `playwright/tests/issue-management.spec.js`) | ✅ |
| `50-CreateSections.cy.js` | §4.3 → #8 | `sections` rows 1–6 → `playwright/tests/sections.spec.js` | ✅ |

## 4 · OJS submission-fixture chains — `cypress/tests/data/60-content/` (20 files on disk; §4.4 header's "26" is a stale count)

Retired wholesale per migration Principle #6; the fixture halves are replaced by scenario
seeding (`test-infrastructure` rows 2–5 self-test the seeding pipeline). Embedded
assertions map as follows:

| Cypress file | Embedded coverage | Coverage now lives | Status |
|---|---|---|---|
| `AmwandengaSubmission.cy.js` (13 its) | publication editing, author permission gates, publish/unpublish, versioning + reader switch, recommend-only gates, login-as | `editor-metadata-editing` (→ `lib/pkp/playwright/tests/publication-metadata-editing.spec.js`, `section-editor-metadata.spec.js`, `author-edit-published.spec.js`); `publication-publish-flow` (→ `playwright/tests/publish-unpublish.spec.js`, `publication-publish-flow.spec.js`); `publication-versioning` (→ `lib/pkp/playwright/tests/versioning.spec.js`, `versioning-states.spec.js`); `galleys` (→ `playwright/tests/galleys.spec.js`); `recommend-only-editors` (→ `lib/pkp/playwright/tests/recommend-only-editor.spec.js`, `recommend-only-gates.spec.js`); `login-as` rows 1–2 (→ `lib/pkp/playwright/tests/login-as.spec.js`); registration arc → `registration-login`. The §3 row-27/29 deferrals (Permissions + Issue panel saves) are **closed**: license/permissions overrides → `publication-identifiers-license` rows 1+7 (→ `lib/pkp/playwright/tests/publication-identifiers-license.spec.js`); issue (re)assignment/scheduling → `issue-assignment-scheduling` rows 1–5 (→ `playwright/tests/issue-assignment.spec.js` + scheduling rows). Login-as `workflowSubmissionId` redirect: recorded drop (§1 row 44). | ✅ |
| `CcorinoSubmission.cy.js` | section-editor recommends Accept | `recommend-only-editors` → `lib/pkp/playwright/tests/section-editor-recommendation.spec.js`; keyword-selection folded into wizard-metadata (recorded, §4.4) | ✅ |
| `CkwantesSubmission.cy.js` | send to review, assign reviewers, accept | `submission-stage-actions` row 1 (→ `lib/pkp/playwright/tests/submission-stage-actions.spec.js`); `reviewer-assignment` (→ `lib/pkp/playwright/tests/reviewer-assignment.spec.js`); `review-decisions` (→ `lib/pkp/playwright/tests/review-decisions.spec.js`) | ✅ |
| `CmontgomerieSubmission.cy.js` | pure fixture | scenario seeding (`test-infrastructure` rows 2–5) — no assertions to map | ✅ |
| `DdioufSubmission.cy.js` | stage participants across stages | `stage-participants` rows 1–2+ → `lib/pkp/playwright/tests/stage-participants.spec.js`; copyeditor/layout flows → `copyediting-stage` / `production-stage` specs | ✅ |
| `DphillipsSubmission.cy.js` | review/copyedit/production assignments | rows folded → `submission-stage-actions`, `reviewer-assignment`, `copyediting-stage` (absorbed `decision-send-to-production.spec.js` as row 6), `production-stage` | ✅ |
| `DsokoloffSubmission.cy.js` | review with decline recommendation | `reviewer-response` (→ `lib/pkp/playwright/tests/reviewer-response.spec.js`) + `submission-stage-actions` | ✅ |
| `EostromSubmission.cy.js` | pure fixture | scenario seeding | ✅ |
| `FpaglieriSubmission.cy.js` | full assignments incl. proofreader | `submission-stage-actions`, `reviewer-assignment`, `copyediting-stage`, `production-stage`, `stage-participants` | ✅ |
| `JnovakSubmission.cy.js` | send to review + two reviews | `submission-stage-actions` + `reviewer-response` | ✅ |
| `KalkhafajiSubmission.cy.js` | pure fixture | scenario seeding | ✅ |
| `LchristopherSubmission.cy.js` | send to review + two reviewers | `submission-stage-actions` + `reviewer-assignment` | ✅ |
| `LkumiegaSubmission.cy.js` | request revisions + author upload | `review-rounds-revisions` row 1 (absorbed `decision-request-revisions.spec.js`) → `lib/pkp/playwright/tests/review-rounds-revisions.spec.js` | ✅ |
| `PdanielSubmission.cy.js` | pure fixture | scenario seeding | ✅ |
| `RbaiyewuSubmission.cy.js` | full assignments | as Fpaglieri | ✅ |
| `RrossiSubmission.cy.js` | pure fixture | scenario seeding | ✅ |
| `VkarbasizaedSubmission.cy.js` | schedule/publish/unpublish issue, TOC removal | `issue-management` rows (→ `playwright/tests/issues.spec.js`, `issue-management.spec.js`); `publication-publish-flow`; `issue-assignment-scheduling` rows 2–5 | ✅ |
| `VwilliamsonSubmission.cy.js` | decline decision | `submission-stage-actions` row 3 (stage-1 decline) + `review-decisions` (post-review decline) | ✅ |
| `ZwoodsSubmission.cy.js` | review + copyedit assignments | `submission-stage-actions`, `reviewer-assignment`, `copyediting-stage` | ✅ |
| `ZzeddSubmission.cy.js` (12 its) | reviewer suggestions: author entry, manager panel, approve into Add Reviewer (new/existing) | `reviewer-suggestions` rows 1–4 → `lib/pkp/playwright/tests/reviewer-suggestions.spec.js` — closes §4.5's recorded ❌. **G2 RESOLVED (wave 12):** the Add-Reviewer-list entry path + no-role existing-user enrollment branch now live as `reviewer-suggestions` row 5 → same spec (standalone Add Reviewer button → suggestions section → Select → enroll form → assignment + approvedAt/reviewerId via API). | ✅ |

## 5 · Spot-check log (14 checks; all passed)

1. **Wizard happy path + ack email** — `lib/pkp/playwright/tests/submission-wizard-core.spec.js:161-232`: full submit, `heading "Submission complete"`, acknowledgement email asserted via `pkpMail.find` scoped by recipient + tag. Matches the `cy.register → submit` arc bundled into the 60-content fixtures.
2. **Wizard required-field validation** — `lib/pkp/playwright/tests/submission-wizard-validation.spec.js:275-327`: errors banner + per-field "This field is required." at Review; restore clears (Cypress SubmissionWizard test 4).
3. **Copyright gate EN+FR** — same spec `:877-1003`+: scratch-journal `copyrightNotice` rendered in confirm section; checkbox gates Submit through tick/untick; FR variant with "Droit d'auteur" notice (Cypress test 3).
4. **Reviewer completes review** — `lib/pkp/playwright/tests/reviewer-response.spec.js:45-98`: accept → comments → recommendation → confirm → "Review Submitted"; recommendation id resolved via `/api/v1/reviewers/recommendations/{id}` to "Accept Submission" (parity with `cy.performReview`).
5. **Request revisions → author upload** — `lib/pkp/playwright/tests/review-rounds-revisions.spec.js:178-236`: Request Revisions radio modal → decision recorded → author's "Upload revisions" plupload wizard → file lands as `fileStages[]=15` (REVIEW_REVISION). Round-2 lifecycle at `:405+` (Lkumiega test 2 + round chaining).
6. **Publish round-trip** — `playwright/tests/publish-unpublish.spec.js:36-130,201`: publish → anonymous 200 → unpublish → anonymous **404** → republish → 200; `STATUS_PUBLISHED`/`STATUS_QUEUED` asserted via REST (Amwandenga tests 6–7).
7. **Versioning reader-side** — `lib/pkp/playwright/tests/versioning.spec.js:53-138,297-352`: v2 publish; `.versions` picker lists "Version of Record 1.0" as a link; following it shows the "outdated version" notice; unpublishing v2 restores v1 (Amwandenga tests 8–10).
8. **Subscription gate** — `playwright/tests/subscription-access.spec.js:86-258,524-548`: anonymous PDF galley link carries `.restricted`; manager bypass; subscriber (phudson, granted via the IndividualSubscriptions grid) sees unrestricted link + abstract (Subscriptions.cy.js second half).
9. **Subscription management** — `playwright/tests/subscription-management.spec.js:101-264`: "Create New Subscription" AjaxModal individual lifecycle; institutional subscription with institution + IP range via Settings → Institutions (Subscriptions.cy.js "Creates a subscription" + first half).
10. **DOI status transitions + manual assign** — `playwright/tests/doi-management.spec.js:36-136`: Unregistered badge + tag-scoped filter membership; bulk Mark Registered → Needs Sync (stale) → Unregistered; `doiCreationTime=never` → "Needs DOI" → bulk Assign DOIs mints under prefix (supersedes both Cypress-`.skip`'d Doi.cy.js tests).
11. **Crossref export XML** — `playwright/tests/doi-crossref.spec.js:447-452`: downloaded deposit XML asserted to contain `<doi_batch`, the minted `<doi>`, `<depositor_name>`/`<email_address>` from settings, and the tagged title (DoiCrossref "Check Crossref Export", formerly deferred — now landed).
12. **User invitation round-trip** — `lib/pkp/playwright/tests/user-invitation.spec.js:260-409`: "Invitation Sent" dialog → accept URL extracted from Mailpit HTML → 3-step accept wizard → "Accept And Continue" → REST shows Reviewer group on the new user (40-CreateUsers `createUserByInvitation`).
13. **Reviewer suggestions** — `lib/pkp/playwright/tests/reviewer-suggestions.spec.js:157-508`: wizard step add/edit/delete + review panel; suggestions reach editor's `[data-cy="reviewer-suggestion-manager"]`; approve → Add Reviewer dialog in create-new mode prefilled; existing-reviewer email routes to advanced-search/selection (Zzedd core arcs — §4.5's gap row delivered).
14. **Comments moderation** — `lib/pkp/playwright/tests/user-comments-moderation.spec.js:130-191`: seeded unapproved comment listed under Hidden/Needs Approval; Approve via More Actions → View Comment detail modal → renders in `#public-comments` for an anonymous reader; Hide reverses (closes §3 row 61's deferral).

## 6 · Gaps

**Both gaps RESOLVED in wave 12 (2026-07-01)** — implemented rows landed and verified
green twice; the original findings are kept below for the audit trail.

### Blocking (resolved)

- **G1 — Public-comments enable/disable toggle UI** (`lib/pkp/cypress/tests/integration/publicComents/PublicComments.cy.js:30` "should enable public commenting", `:533` "should disable public commenting"). The Cypress tests drive Website Settings → **Comments** tab (`[name="enablePublicComments"]` check/uncheck + Save) and assert the reader-side comments container disappears after disabling. Every Playwright row seeded `enablePublicComments` through the ContextBuilder passthrough; the plan was silent on the toggle UI and the disable-direction reader assertion. **Resolution: `public-comments` row 6** — toggle on a comments-off scratch journal drives the section on and back off for anonymous readers.
- **G2 — Reviewer-suggestion Add-Reviewer-list entry path + no-role enrollment** (`cypress/tests/data/60-content/ZzeddSubmission.cy.js:430,492,520,543,577,623,662` — 6 of 12 its: suggestions surfacing inside the standalone **Add Reviewer** list, the "existing user **without** reviewer role" enrollment branch, and the pre-existing-list match). Rows 3–4 entered only via the suggestion-manager panel; `reviewer-assignment` circularly deferred the surface back here. **Resolution: `reviewer-suggestions` row 5** — standalone Add Reviewer entry, suggestion listed and selectable, no-role existing user enrolled + assigned (server response, post-reload manager state, approvedAt/reviewerId via API). Two product quirks found while building it are pinned in the app-changes ledger §2: the suggestions-list select buttons expose accessible name "Select undefined", and a successful enroll pops the dialog back to the selection step without live-refreshing the reviewer manager.

### In-flight at audit time (all landed in wave 12)

- **ApiToken request auth**: successor `api-smoke` row 5 — implemented (token auth 200, tampered token 400, unknown-key token 401).
- **Failed-jobs lifecycle** (`Jobs.cy.js` test 2): successor `jobs-queue` row 3 — implemented (CLI drain via `jobs.php`).
- **Native-XML Tools-UI export path**: `native-xml-import-export` row 4 — implemented (Tools UI journey + real download event).
- `email-delivery`, `notifications`, `scheduled-tasks` — implemented wave 12; they absorbed no Cypress coverage and never gated retirement.

### Documentation discrepancies (informational, no coverage impact)

- §4.2 header claims "18 files" (16 on disk); §4.4 claims "26 files" (20 on disk); `spec-inventory.md` §3 claims "21 files" under 60-content (20 on disk). All on-disk files are mapped; the counts are stale.
- `docs/e2e/feature-inventory.md` area-8 rollups are stale: `test-infrastructure` is listed `planned` but all 8 plan rows are `implemented`; `jobs-queue`/`api-smoke`/`native-xml-import-export` are partially implemented, not purely planned.

## 7 · Verdict

**RETIRE** (flipped from HOLD on 2026-07-01). The two blocking gaps are closed with
implemented, twice-green rows (`public-comments` row 6, `reviewer-suggestions` row 5), and
every formerly in-flight successor has landed. Every Cypress assertion across all 46 spec
files (32 OJS + 14 shared) now maps to an implemented Playwright test or a recorded drop,
and 14 spot-checks on the highest-value flows verified the claimed assertions exist in the
named specs. `cypress/` and `lib/pkp/cypress/` can be deleted, along with the Cypress
plumbing that exists solely to serve them.

## 8 · Disposition of `docs/e2e/spec-inventory.md`

Every row is accounted for. All 22 OJS pre-revamp specs (§1) and 47 shared specs (§2) are
either (a) still on disk and claimed by exactly one plan via **Absorbs** (splits recorded
on both sides per the N-test rule — verified for publication-metadata-editing,
subscription-config, mailpit, journal-homepage, oai-dc, discussion-manager), or (b)
deleted with the absorption/move recorded (decision-accept/decline/send-to-review/
send-to-production/request-revisions, review-round, reviewer-completes-review,
wizard-validation/copyright/section-rules/language, wizard-config-reset,
article-statistics, discussion-manager, submission.spec.js stub). Its §3/§4 legacy-Cypress
summaries are superseded by this report. The file's own deletion condition ("once round 1
absorption is complete") is met: **safe to delete** — recommend doing so in the same
commit that resolves G1/G2 and flips this verdict to RETIRE, so the retirement commit is
self-contained.
