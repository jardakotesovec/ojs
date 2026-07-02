# Big-Bang Progress — live state

**Live state for the spec+test build loop. Read with `RUNBOOK.md`.** Updated + committed
after every feature. A feature is `done` only when its row says so AND it's committed.

## Totals

- Features: **2 done · 0 parked · 90 pending** (of 92)
- Tests used: **13 / 700** (tier allocation ≈ 639 · headroom 61 for end-of-run top-ups)
- Last full-suite runtime: **— / 25 min** (fresh DB; not yet run — both wizard files together: ~39 s)
- Last updated: 2026-07-02 · Last commit: submission-wizard-metadata (root + lib/pkp)

Status legend — Spec: pending → draft → verified · Tests: pending → written → green(x2) ·
Verified: — / yes (adversarial + live affordance probes done) · Budget: tier·target where
H 10–13 (core workflows/permission matrices/state machines), M 6–8 (standard), L 3–4
(simple CRUD/read-only). Tiers assigned 2026-07-02 per maintainer request to rebalance by
complexity/importance — **provisional; maintainer red-pen welcome on any not-yet-built row**.
The target steers the spec's canonical-scenario count; ±1–2 by author judgment is fine.

## Features

| # | Area | Feature | Spec | Tests | Budget | #tests | Verified | Findings/notes |
|---|------|---------|------|-------|--------|--------|----------|----------------|
| 1 | Area 1 — Author submission & intake | `submission-wizard` | verified | green(x2) | H·12 | 6 | yes | 28→30 atoms; verifier live-probed all 4 unverified affordances + corrected Submit-As and Open/Cancel permission cells; ledger §2 row 61 added; tests green ×3 (2 agent + 1 orchestrator, 24 s) |
| 2 | Area 1 — Author submission & intake | `submission-wizard-metadata` | verified | green(x2) | M·7 | 7 | yes | 10 atoms; verifier live-probed all 4 unverified affordances (all held: rights/source/funding rendering, collect-only on workflow Metadata tab, data-availability require block, /vocabs reviewer exclusion) + assistant/site-admin panel access + both mid-flight flip directions (rule 4 sharpened: require-check re-binds on every Review entry); ledger row 62 re-verified; tests green ×2 (author + verifier, 33 s) |
| 3 | Area 1 — Author submission & intake | `reviewer-suggestions` | pending | pending | M·6 | 0 | — | — |
| 4 | Area 1 — Author submission & intake | `submission-drafts` | pending | pending | M·6 | 0 | — | — |
| 5 | Area 1 — Author submission & intake | `author-dashboard` | pending | pending | M·6 | 0 | — | — |
| 6 | Area 2 — Editorial workflow & peer review | `editorial-dashboards` | pending | pending | H·10 | 0 | — | — |
| 7 | Area 2 — Editorial workflow & peer review | `workflow-stage-navigation` | pending | pending | M·6 | 0 | — | — |
| 8 | Area 2 — Editorial workflow & peer review | `editorial-decisions` | pending | pending | H·13 | 0 | — | — |
| 9 | Area 2 — Editorial workflow & peer review | `stage-participants` | pending | pending | M·8 | 0 | — | — |
| 10 | Area 2 — Editorial workflow & peer review | `send-to-review` | pending | pending | M·7 | 0 | — | — |
| 11 | Area 2 — Editorial workflow & peer review | `assign-and-manage-reviewers` | pending | pending | H·12 | 0 | — | — |
| 12 | Area 2 — Editorial workflow & peer review | `reviewer-response` | pending | pending | H·10 | 0 | — | — |
| 13 | Area 2 — Editorial workflow & peer review | `review-forms` | pending | pending | M·7 | 0 | — | — |
| 14 | Area 2 — Editorial workflow & peer review | `review-rounds-and-revisions` | pending | pending | H·12 | 0 | — | — |
| 15 | Area 2 — Editorial workflow & peer review | `recommend-only-editors` | pending | pending | M·6 | 0 | — | — |
| 16 | Area 2 — Editorial workflow & peer review | `review-anonymity` | pending | pending | H·10 | 0 | — | — |
| 17 | Area 2 — Editorial workflow & peer review | `copyediting-stage` | pending | pending | M·7 | 0 | — | — |
| 18 | Area 2 — Editorial workflow & peer review | `production-stage` | pending | pending | M·7 | 0 | — | — |
| 19 | Area 2 — Editorial workflow & peer review | `tasks-discussions` | pending | pending | H·10 | 0 | — | — |
| 20 | Area 2 — Editorial workflow & peer review | `submission-files` | pending | pending | H·10 | 0 | — | — |
| 21 | Area 2 — Editorial workflow & peer review | `editorial-activity-log` | pending | pending | L·4 | 0 | — | — |
| 22 | Area 2 — Editorial workflow & peer review | `document-library` | pending | pending | L·4 | 0 | — | — |
| 23 | Area 3 — Publication record, issues & scheduling | `publication-title-abstract-body` | pending | pending | M·6 | 0 | — | — |
| 24 | Area 3 — Publication record, issues & scheduling | `contributors` | pending | pending | H·10 | 0 | — | — |
| 25 | Area 3 — Publication record, issues & scheduling | `publication-metadata-references` | pending | pending | M·7 | 0 | — | — |
| 26 | Area 3 — Publication record, issues & scheduling | `galleys` | pending | pending | H·10 | 0 | — | — |
| 27 | Area 3 — Publication record, issues & scheduling | `media-files` | pending | pending | M·6 | 0 | — | — |
| 28 | Area 3 — Publication record, issues & scheduling | `publication-identifiers` | pending | pending | M·6 | 0 | — | — |
| 29 | Area 3 — Publication record, issues & scheduling | `publication-license` | pending | pending | M·6 | 0 | — | — |
| 30 | Area 3 — Publication record, issues & scheduling | `publication-issue-assignment` | pending | pending | M·6 | 0 | — | — |
| 31 | Area 3 — Publication record, issues & scheduling | `publication-versioning` | pending | pending | H·10 | 0 | — | — |
| 32 | Area 3 — Publication record, issues & scheduling | `publication-publish-flow` | pending | pending | H·11 | 0 | — | — |
| 33 | Area 3 — Publication record, issues & scheduling | `publication-amendments` | pending | pending | M·7 | 0 | — | — |
| 34 | Area 3 — Publication record, issues & scheduling | `data-availability-citations` | pending | pending | L·4 | 0 | — | — |
| 35 | Area 3 — Publication record, issues & scheduling | `issue-management` | pending | pending | H·11 | 0 | — | — |
| 36 | Area 4 — Reader front end | `journal-homepage` | pending | pending | M·7 | 0 | — | — |
| 37 | Area 4 — Reader front end | `highlights-featured-content` | pending | pending | L·4 | 0 | — | — |
| 38 | Area 4 — Reader front end | `article-landing` | pending | pending | H·10 | 0 | — | — |
| 39 | Area 4 — Reader front end | `article-recommendations` | pending | pending | L·3 | 0 | — | — |
| 40 | Area 4 — Reader front end | `issue-archive-toc` | pending | pending | M·6 | 0 | — | — |
| 41 | Area 4 — Reader front end | `site-search` | pending | pending | M·7 | 0 | — | — |
| 42 | Area 4 — Reader front end | `browse-category-section` | pending | pending | M·6 | 0 | — | — |
| 43 | Area 4 — Reader front end | `public-comments` | pending | pending | M·6 | 0 | — | — |
| 44 | Area 4 — Reader front end | `about-pages` | pending | pending | L·3 | 0 | — | — |
| 45 | Area 4 — Reader front end | `oai-pmh` | pending | pending | M·8 | 0 | — | — |
| 46 | Area 4 — Reader front end | `web-feeds-syndication` | pending | pending | L·4 | 0 | — | — |
| 47 | Area 5 — Users, roles & access | `registration-login` | pending | pending | H·10 | 0 | — | — |
| 48 | Area 5 — Users, roles & access | `password-flows` | pending | pending | M·6 | 0 | — | — |
| 49 | Area 5 — Users, roles & access | `user-profile` | pending | pending | M·7 | 0 | — | — |
| 50 | Area 5 — Users, roles & access | `user-management` | pending | pending | H·10 | 0 | — | — |
| 51 | Area 5 — Users, roles & access | `user-invitations` | pending | pending | M·8 | 0 | — | — |
| 52 | Area 5 — Users, roles & access | `roles-permissions` | pending | pending | H·11 | 0 | — | — |
| 53 | Area 5 — Users, roles & access | `login-as` | pending | pending | M·6 | 0 | — | — |
| 54 | Area 5 — Users, roles & access | `editorial-masthead` | pending | pending | L·4 | 0 | — | — |
| 55 | Area 5 — Users, roles & access | `site-access-restrictions` | pending | pending | M·6 | 0 | — | — |
| 56 | Area 6 — Journal & site settings | `journal-masthead-settings` | pending | pending | L·4 | 0 | — | — |
| 57 | Area 6 — Journal & site settings | `website-appearance-settings` | pending | pending | M·7 | 0 | — | — |
| 58 | Area 6 — Journal & site settings | `workflow-settings` | pending | pending | M·7 | 0 | — | — |
| 59 | Area 6 — Journal & site settings | `distribution-settings` | pending | pending | M·6 | 0 | — | — |
| 60 | Area 6 — Journal & site settings | `email-templates-management` | pending | pending | M·7 | 0 | — | — |
| 61 | Area 6 — Journal & site settings | `navigation-menus` | pending | pending | M·7 | 0 | — | — |
| 62 | Area 6 — Journal & site settings | `sections` | pending | pending | M·7 | 0 | — | — |
| 63 | Area 6 — Journal & site settings | `categories` | pending | pending | L·4 | 0 | — | — |
| 64 | Area 6 — Journal & site settings | `announcements` | pending | pending | M·6 | 0 | — | — |
| 65 | Area 6 — Journal & site settings | `languages-locales` | pending | pending | M·7 | 0 | — | — |
| 66 | Area 6 — Journal & site settings | `site-settings` | pending | pending | L·4 | 0 | — | — |
| 67 | Area 6 — Journal & site settings | `site-administration` | pending | pending | M·7 | 0 | — | — |
| 68 | Area 7 — Integrations, identifiers & monetization | `plugin-management` | pending | pending | M·6 | 0 | — | — |
| 69 | Area 7 — Integrations, identifiers & monetization | `doi-management` | pending | pending | H·10 | 0 | — | — |
| 70 | Area 7 — Integrations, identifiers & monetization | `doi-deposit` | pending | pending | M·7 | 0 | — | — |
| 71 | Area 7 — Integrations, identifiers & monetization | `open-peer-review-display` | pending | pending | L·4 | 0 | — | — |
| 72 | Area 7 — Integrations, identifiers & monetization | `orcid` | pending | pending | M·7 | 0 | — | — |
| 73 | Area 7 — Integrations, identifiers & monetization | `citation-style-language` | pending | pending | L·4 | 0 | — | — |
| 74 | Area 7 — Integrations, identifiers & monetization | `indexing-meta-tags` | pending | pending | L·4 | 0 | — | — |
| 75 | Area 7 — Integrations, identifiers & monetization | `subscriptions-management` | pending | pending | H·10 | 0 | — | — |
| 76 | Area 7 — Integrations, identifiers & monetization | `subscription-access` | pending | pending | H·10 | 0 | — | — |
| 77 | Area 7 — Integrations, identifiers & monetization | `payments` | pending | pending | M·8 | 0 | — | — |
| 78 | Area 7 — Integrations, identifiers & monetization | `institutions` | pending | pending | L·4 | 0 | — | — |
| 79 | Area 8 — System, communications & administration | `email-delivery` | pending | pending | M·6 | 0 | — | — |
| 80 | Area 8 — System, communications & administration | `notifications` | pending | pending | M·7 | 0 | — | — |
| 81 | Area 8 — System, communications & administration | `jobs-queue` | pending | pending | L·4 | 0 | — | — |
| 82 | Area 8 — System, communications & administration | `scheduled-tasks` | pending | pending | L·4 | 0 | — | — |
| 83 | Area 8 — System, communications & administration | `rest-api` | pending | pending | H·10 | 0 | — | — |
| 84 | Area 8 — System, communications & administration | `native-xml-import-export` | pending | pending | H·10 | 0 | — | — |
| 85 | Area 8 — System, communications & administration | `user-import-export` | pending | pending | M·6 | 0 | — | — |
| 86 | Area 8 — System, communications & administration | `pubmed-export` | pending | pending | L·4 | 0 | — | — |
| 87 | Area 8 — System, communications & administration | `usage-statistics` | pending | pending | M·7 | 0 | — | — |
| 88 | Area 8 — System, communications & administration | `counter-sushi` | pending | pending | M·6 | 0 | — | — |
| 89 | Area 8 — System, communications & administration | `editorial-statistics` | pending | pending | L·4 | 0 | — | — |
| 90 | Area 8 — System, communications & administration | `csv-reports` | pending | pending | L·4 | 0 | — | — |
| 91 | Area 8 — System, communications & administration | `site-maintenance` | pending | pending | L·4 | 0 | — | — |
| 92 | Area 8 — System, communications & administration | `installation-upgrade` | pending | pending | L·4 | 0 | — | — |
## Parked (needs maintainer)

_(none yet)_

## Run log

_(loop appends one line per feature: date · feature · outcome · #tests · runtime delta)_

- 2026-07-02 · submission-wizard · done (spec verified, adversarial + live affordance probes) · 6 tests · file runtime ~24 s
- 2026-07-02 · submission-wizard-metadata · done (spec verified; all 4 deferred affordances held on live probe; ledger row 62: vocab journal-scoping bug) · 7 tests · both wizard files ~39 s
