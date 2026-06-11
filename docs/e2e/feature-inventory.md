# OJS e2e Feature Inventory — Round 1

Source of truth for coverage scope and test budget. Read `docs/e2e/PRINCIPLES.md` first.
Each feature row maps 1:1 to a plan file in `docs/e2e/plans/<feature>.md`; the Status column
is a rollup of that plan's row statuses (`planned` until every row is `implemented`/`dropped`,
then `done`). Budgets are firm within ±1 per feature; rebalancing requires updating this file.

Compiled 2026-06-11 from codebase exploration (handlers, Vue pages, settings forms) plus the
existing spec inventory (`docs/e2e/spec-inventory.md`).

## Budget summary

| Area | Features | Round-1 tests |
|------|----------|---------------|
| 1. Submission intake | 7 | 59 |
| 2. Editorial workflow | 17 | 128 |
| 3. Publishing & issues | 9 | 68 |
| 4. Reader front end | 8 | 41 |
| 5. Users, roles & access | 9 | 48 |
| 6. Settings & administration | 14 | 68 |
| 7. Plugins (key set) | 9 | 57 |
| 8. System & communications | 7 | 36 |
| **Total** | **80** | **505** |

Post-review totals (adversarial review removed duplicate-coverage rows and double-counted
absorptions); on 2026-06-11 the maintainer added two recently-landed 3.6 features the
original exploration missed (media-files, publication-amendments: +14 rows, consuming the
reserved headroom and landing at 505 ≈ the ~500 target). Promote round-2 rows only with an
inventory update here.

## 1. Submission intake (author experience)

| Plan file | Scope | Placement | Imp | Budget | Status |
|-----------|-------|-----------|-----|--------|--------|
| submission-wizard-core | Full wizard happy path: start, files+genres, details, contributors, confirm, submit; ack email | lib/pkp | H | 14 | done |
| submission-wizard-metadata | For-the-Editors fields (keywords, subjects, disciplines, agencies, coverage, type, citations, data availability), request vs require modes, categories in wizard | lib/pkp | H | 13 | planned |
| submission-wizard-validation | Validation errors per step, checklist/copyright/privacy consent, section rules (inactive, editor-restricted), comments for the editors | lib/pkp | H | 10 | done |
| submission-wizard-language | Multilingual submission, locale picker, reconfigure modal (change section/locale mid-wizard) | lib/pkp | M | 6 | done |
| submission-drafts | Save-for-later, resume draft, delete draft, incomplete submissions list | lib/pkp | M | 6 | done |
| author-dashboard | My-submissions list, status/stage display, activity view of own submission | lib/pkp | H | 6 | done |
| reviewer-suggestions | Author suggests reviewers in wizard; editor sees suggestions at assignment | lib/pkp | M | 4 | done |

## 2. Editorial workflow

| Plan file | Scope | Placement | Imp | Budget | Status |
|-----------|-------|-----------|-----|--------|--------|
| editorial-dashboards | Dashboard views/filters/search per role (active, needs-editor, archived, my-assigned) | lib/pkp | H | 10 | done |
| submission-stage-actions | Assign editor, send to review, accept-and-skip-review, decline, delete/archive at stage 1 | lib/pkp | H | 9 | done |
| reviewer-assignment | Assign reviewer (search, due dates, anonymity mode, reviewer type), unassign/cancel, resend request | lib/pkp | H | 10 | done |
| reviewer-response | Reviewer accepts/declines invitation, completes review (recommendations, comments, attachments), one-click access, thank reviewer | lib/pkp | H | 12 | done |
| review-rounds-revisions | New round, round status indicators, request-revisions → author uploads → editor sees, resubmit-for-review cycle, round history | lib/pkp | H | 12 | planned |
| review-decisions | Accept, decline post-review, revert decline, notify-author emails with attachments, decision recording | lib/pkp | H | 8 | planned |
| copyediting-stage | Copyeditor assignment, copyedited files, author check, send-to-production decision | lib/pkp | H | 8 | planned |
| production-stage | Layout editor assignment, production-ready files, schedule-for-publication handoff | lib/pkp | H | 6 | planned |
| stage-participants | Add/remove participants, role-based access effects, assistant permissions | lib/pkp | H | 7 | planned |
| discussions | Discussion create/reply/close per stage, participant scoping | lib/pkp | M | 6 | planned |
| editorial-tasks | Task create/assign/complete/due dates, templates applied in workflow | lib/pkp | M | 7 | planned |
| submission-files | Per-stage file upload, revisions, dependent files, non-ASCII filenames, downloads | lib/pkp | H | 8 | planned |
| activity-log | Event log entries for key actions, round history modal | lib/pkp | M | 4 | planned |
| editor-metadata-editing | Editor/section-editor edits publication metadata pre-publication; author-edit-published permission gate | lib/pkp | M | 6 | planned |
| review-forms | Manager creates review form with elements; reviewer fills it; editor reads responses | lib/pkp | M | 6 | planned |
| review-anonymity | Double-anonymous vs anonymous vs open: what reviewer/author can see | lib/pkp | M | 5 | planned |
| recommend-only-editors | Recommend-only section editor records recommendation; editor sees and decides | lib/pkp | M | 4 | planned |

## 3. Publishing & issues

| Plan file | Scope | Placement | Imp | Budget | Status |
|-----------|-------|-----------|-----|--------|--------|
| publication-publish-flow | Publish/unpublish/schedule preconditions and actions, republish, front-end visibility flip | ojs | H | 8 | planned |
| publication-versioning | Create new version, edit version, version history, language change rules across versions | lib/pkp | M | 8 | planned |
| publication-identifiers-license | Identifiers tab, license/permissions overrides, references, per-locale title/abstract on publication tabs | lib/pkp | M | 8 | planned |
| contributors | Contributor CRUD, ordering, primary contact, affiliations on publication | lib/pkp | H | 6 | planned |
| galleys | Galley create/edit/delete, file vs remote URL, labels, ordering | ojs | H | 8 | planned |
| issue-management | Issue CRUD, TOC ordering, cover, publish issue + reader notification, current issue, unpublish/delete, issue galleys, back/future lists | ojs | H | 11 | planned |
| issue-assignment-scheduling | Assign article to issue, schedule into future issue, publishes with issue | ojs | H | 5 | planned |
| media-files | Media section: batch upload, web/high-res variant linking, metadata sync, sharing across galleys, author read-only (new in 3.6, Feb 2026) | lib/pkp | H | 8 | planned |
| publication-amendments | Summary of Changes + update type: author submits with revisions, editor inserts into publication, versioned update types (new in 3.6, May 2026) | lib/pkp | M | 6 | planned |

## 4. Reader front end

| Plan file | Scope | Placement | Imp | Budget | Status |
|-----------|-------|-----------|-----|--------|--------|
| journal-homepage | Current issue display, sidebar blocks, announcements block | ojs | H | 5 | planned |
| article-landing | Metadata display, galley view/download incl. pdfJsViewer smoke, license display, DC meta tags, multilingual rendering | ojs | H | 8 | planned |
| issue-archive-toc | Archive listing, issue TOC page, section grouping | ojs | M | 4 | planned |
| site-search | Front-end search, filters, no-result behavior | ojs | H | 6 | planned |
| browse-category-section | Category browse pages, section policies display | ojs | L | 4 | planned |
| oai-sitemap-feeds | OAI-PMH ListRecords/GetRecord (DC), sitemap.xml, web feed presence | ojs | M | 5 | planned |
| public-pages | Editorial masthead public page, about/contact, privacy statement | lib/pkp | M | 4 | planned |
| public-comments | Reader comments: post, moderate, approve, anonymous gating | lib/pkp | M | 5 | planned |

## 5. Users, roles & access

| Plan file | Scope | Placement | Imp | Budget | Status |
|-----------|-------|-----------|-----|--------|--------|
| registration-login | Public registration (roles, consent), login, logout, failed login | lib/pkp | H | 8 | planned |
| password-flows | Reset via email, forced change, change in profile | lib/pkp | H | 5 | planned |
| user-profile | Identity/contact/public profile, notification prefs, API key, reviewer interests | lib/pkp | M | 6 | planned |
| user-management | Manager user CRUD, search/filter, disable/enable, remove role, email user, merge users | lib/pkp | H | 8 | planned |
| user-invitations | Invite new user to role, invite existing user, accept-invitation flows | lib/pkp | H | 6 | planned |
| roles-permissions | Role settings grid, custom role creation, stage assignment effects, settings-URL access gates | lib/pkp | M | 7 | planned |
| login-as | Admin impersonation and return to own session | lib/pkp | M | 2 | planned |
| site-access-restrictions | Login-wall site access, registration disabled, disabled journal visibility | lib/pkp | M | 4 | planned |
| editorial-masthead | Masthead configuration reflects on public page; reviewer display opt-in | lib/pkp | M | 2 | planned |

## 6. Settings & administration

| Plan file | Scope | Placement | Imp | Budget | Status |
|-----------|-------|-----------|-----|--------|--------|
| site-administration | Hosted journals CRUD + wizard, multi-context user navigation, admin maintenance pages smoke | lib/pkp | H | 8 | planned |
| site-settings | Site setup, site languages, site-level appearance | lib/pkp | M | 3 | planned |
| journal-setup | Masthead/contact context settings forms persist and surface publicly | ojs | H | 4 | planned |
| website-appearance | Theme options, logo upload, homepage image, date/time formats | lib/pkp | M | 6 | planned |
| navigation-menus | Menu CRUD, custom items, assignment to areas, front-end rendering | lib/pkp | M | 4 | planned |
| sections | Section CRUD, ordering, editor restrictions, inactivation, wizard/front-end effects | ojs | H | 6 | planned |
| categories | Category CRUD incl. nesting, wizard exposure, front-end browse hook | lib/pkp | M | 5 | planned |
| submission-settings | Workflow>Submission settings forms: checklist, author guidelines, components/genres (metadata toggles owned by submission-wizard-metadata) | lib/pkp | M | 3 | planned |
| review-settings | Review mode default, deadlines, reminder config, reviewer guidance | lib/pkp | M | 5 | planned |
| email-templates-management | Manage Emails UI: edit/add/reset templates; edited template text used in sent mail | lib/pkp | H | 6 | planned |
| announcements | Announcement CRUD, expiry, enable toggle, reader page + sitemap | lib/pkp | M | 5 | planned |
| languages-locales | Enable locales for UI/forms/submissions, multilingual form entry, persistence | lib/pkp | M | 6 | planned |
| distribution-settings | License defaults, indexing metadata, archiving display, payments enable, publishing mode (open vs subscription) | ojs | M | 5 | planned |
| institutions | Institution CRUD (stats/subscription support) | lib/pkp | L | 2 | planned |

## 7. Plugins (key set)

| Plan file | Scope | Placement | Imp | Budget | Status |
|-----------|-------|-----------|-----|--------|--------|
| plugin-management | Installed plugins grid enable/disable + settings modal, site vs journal scope | lib/pkp | H | 5 | planned |
| doi-management | DOI settings (prefix/pattern/auto-assign), assignment on publish, versioned DOI, management page statuses/filters | ojs | H | 9 | planned |
| crossref-deposit | Crossref settings, export XML, manual deposit status marking (no live API) | ojs | H | 4 | planned |
| orcid | ORCID settings, author request email, verified/unverified badge, registration prefill | lib/pkp | M | 7 | planned |
| citation-style-language | CSL settings (styles offered, primary), how-to-cite render, downloads (BibTeX/RIS) | ojs | M | 6 | planned |
| subscriptions-management | Subscription types CRUD, policies, individual/institutional subscriptions CRUD | ojs | H | 9 | planned |
| subscription-access | Access enforcement: anonymous vs subscriber vs editor bypass; delayed open access | ojs | H | 6 | planned |
| payments | Enable payments, manual payment record flow, payments grid, paypal config surface (no external calls) | ojs | M | 5 | planned |
| usage-statistics | Stats pages (publications, editorial activity, users): render, date filter, CSV download; minimal metrics seeding | lib/pkp | M | 6 | planned |

## 8. System & communications

| Plan file | Scope | Placement | Imp | Budget | Status |
|-----------|-------|-----------|-----|--------|--------|
| email-delivery | Template variable rendering in real sends, email log per submission, notify-composer with attachments | lib/pkp | H | 6 | planned |
| notifications | In-app bell/inbox, mark read, per-user notification opt-outs take effect | lib/pkp | M | 4 | planned |
| jobs-queue | Jobs page, failed jobs, requeue | lib/pkp | M | 3 | planned |
| scheduled-tasks | Review reminders + editorial reminders: trigger task, assert reminder email | lib/pkp | M | 4 | planned |
| api-smoke | Token auth, key public endpoints (submissions, issues, users), permission rejections | lib/pkp | M | 6 | planned |
| native-xml-import-export | Submission and issue XML export/import round-trips; PubMed export | ojs | L | 5 | planned |
| test-infrastructure | Scenario seeding self-tests (stages, default files, decision comments), scratch journal, Mailpit harness, reduced-motion | lib/pkp | H | 8 | planned |

## Bootstrap enrichment decisions (apply at start of wave 1)

Richer `publicknowledge` defaults so tests run against representative configuration.
Validate each against existing absorbed specs when applied; anything that forces broad
test churn gets reverted to scratch-journal-only.

- **Enable (request, not require)** in submission wizard: keywords, citations, categories
  (`submitWithCategories`). Keep disciplines/coverage/type/agencies/rights/source OFF —
  exercised via scratch journal in submission-wizard-metadata.
- **Reviewer suggestions step**: ON (optional step; typical modern config).
- **Announcements**: ON with nav item (reader page becomes part of default surface).
- **Public comments**: ON (comment surface is per-submission, safe on shared journal).
- **DOIs**: ON for publications with default pattern + automatic assignment on publish;
  Crossref plugin configured but deposits never live.
- **Citation Style Language plugin**: ON (how-to-cite block on article pages by default).
- **Review defaults**: double-anonymous mode, response/review deadlines set, reminders configured.
- **Keep OFF in publicknowledge** (scratch-journal territory): subscriptions/payments
  (journal stays open access), site login wall, registration disabled, bulk emails,
  geo/institution usage stats.

## Wave 1 — infrastructure work items (adjudicated by adversarial review)

**Status: DONE (2026-06-11).** All eight endpoint builds and the harness/schema fixes landed
with parity-audit entries (`docs/scenario-processor-audit.md` §4); bootstrap enrichment
applied to `publicknowledge` (which resolved the scheduled-task reminder-threshold
conditional — the context passthrough stays unbuilt); full suite green under CI retry
semantics: 141 passed in ~6 min, within the 20-minute budget. New seed capabilities are
documented in the `ojs-playwright-tests` skill (scenarios.md).

**Added 2026-06-11 (maintainer review — approved build for the wave that implements media-files):**
- `publications[].mediaFiles[]` seeding in PublicationsProcessor beside `seedGalleys` —
  SUBMISSION_FILE_MEDIA rows + `variant_groups` at `MediaFilesController`/`VariantGroup`
  parity; needed by media-files plan rows 3–8. Parity-audit entry required.

**Follow-ups surfaced during the wave (unscheduled):**
- Stale gitignored build artifacts (`styles/build.css`, `js/build.js`) silently re-enable
  UI animations and caused 3 false test failures — add a bootstrap-time guard asserting the
  served CSS contains a `prefers-reduced-motion` block, or rebuild assets whenever the
  ui-library submodule pointer moves.
- Rotating parallel-load flake tail: ~1–2 random specs per local full run time out on
  dialogs/API calls and pass on retry (`retries: isCI ? 1 : 0`). Pre-existing; likely PHP
  server saturation. Investigate together with the audit-§3 wizard-comments flake (now
  confirmed environment-independent; DB-state accumulation is the strongest lead).

Original adjudication follows. Every Processor change requires a parity-audit entry in
`docs/scenario-processor-audit.md` (charter principle 2).

**Approved scenario-endpoint builds:**
1. `publications[].galleys[]` in PublicationsProcessor (`Repo::galley()->add()` + PROOF-stage
   file at galley-grid parity) — strongest cross-plan demand: article-landing, galleys,
   subscription-access, payments, crossref fixture preset.
2. Context `reviewForms[]` — new thin processor beside SectionProcessor writing
   `review_forms`/`review_form_elements` at grid parity (review-forms rows 2–6).
3. `reviewRounds[].reviewers[].reviewFormId` — one createParams key in
   ReviewRoundProcessor::assignReviewer (review-forms rows 4–6).
4. `subscriptions[]` hung off JournalScenarioController::afterContextCreated (OJS-only,
   like IssueProcessor; not in the shared schema) — subscription-access rows 4–5,
   subscriptions-management row 9.
5. `reviewerSuggestions` passthrough in SubmissionBuilderProcessor at submit parity
   (reviewer-suggestions rows 3–4).
6. Seeded user comments, narrow scope: approved/unapproved rows only, same INSERT as the
   REST controller — no report seeding (public-comments row 5).
7. OJS-only minimal metrics seed matching the usage-aggregation pipeline's writes
   (usage-statistics rows 4–5; replaces the dropped Cypress shell-out, roadmap row #36).
8. `publications[].metadata.datePublished` passthrough — one-line METADATA_FIELDS addition;
   matches the real editor capability to set publication dates (journal-homepage row 4).

**Declined — UI-fallback recorded in the owning plans:** site-access toggles
(restrictSiteAccess/disableUserReg/restrictArticleAccess), masthead opt-in on `users[]`,
review-revision files (round 1), `publications[].categories`, Crossref-valid publication
(fixture preset instead), scheduled-task reminder thresholds (conditional on the bootstrap
enrichment below; build the two-scalar passthrough only if enrichment is declined).

**Harness & schema fixes:**
- Scenario schema validation is dead code: `opis/json-schema` is not installed, so
  `validateAgainstSchema` silently no-ops. Install/enforce it and sync `context.json` with
  the Processor whitelists (e.g. `enableAnnouncements`).
- Seed `api_key_secret` in `lib/pkp/playwright/scripts/seed-test-config.js` (api-smoke row 5).
- New dedicated **serial Playwright project** for globally-scanning operations: the
  scheduled-tasks plan, site-level plugin toggles (plugin-management row 3), cache
  clears/expire-sessions (site-administration), and the only permitted `clearAll()` infra
  test (charter principles 8–9).
- A `pkpMail` scoped-query helper (recipient + tag) so principle 8 is the path of least
  resistance.

## Round 2 backlog (out of scope this round)

- Long-tail plugins: htmlArticleGalley, lensGalley, pdfJsViewer (beyond the article-landing
  viewer smoke row), jatsTemplate, webFeed (beyond presence check), staticPages,
  customBlockManager, credit, announcementFeed, googleScholar (used as the safe toggle
  candidate in plugin-management), dublinCoreMeta, datacite, doaj, driver, recommendBy*,
  URN, Google Analytics.
- Usage statistics pipeline (log processing/compilation), geo/institution stats, SUSHI/COUNTER.
- JATS metadata editing; PubMed export beyond the absorbed specs.
- Captcha/SSL/rate-limiting login variants (config-driven, flake-prone).
- Theme variations beyond default theme options.
- Email digest frequency variants; bulk email tool.
- Subscription expiry reminder task; payment gateway live flows.
