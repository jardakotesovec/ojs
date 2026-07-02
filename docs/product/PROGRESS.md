# Big-Bang Progress — live state

**Live state for the spec+test build loop. Read with `RUNBOOK.md`.** Updated + committed
after every feature. A feature is `done` only when its row says so AND it's committed.

## Totals

- Features: **1 done · 0 parked · 91 pending** (of 92)
- Tests used: **6 / 700**
- Last full-suite runtime: **— / 25 min** (fresh DB; not yet run — submission-wizard file alone: ~24 s)
- Last updated: 2026-07-02 · Last commit: submission-wizard (root + lib/pkp)

Status legend — Spec: pending → draft → verified · Tests: pending → written → green(x2) ·
Verified: — / yes (adversarial + live affordance probes done)

## Features

| # | Area | Feature | Spec | Tests | #tests | Verified | Findings/notes |
|---|------|---------|------|-------|--------|----------|----------------|
| 1 | Area 1 — Author submission & intake | `submission-wizard` | verified | green(x2) | 6 | yes | 28→30 atoms; verifier live-probed all 4 unverified affordances + corrected Submit-As and Open/Cancel permission cells; ledger §2 row 61 added; tests green ×3 (2 agent + 1 orchestrator, 24 s) |
| 2 | Area 1 — Author submission & intake | `submission-wizard-metadata` | pending | pending | 0 | — | — |
| 3 | Area 1 — Author submission & intake | `reviewer-suggestions` | pending | pending | 0 | — | — |
| 4 | Area 1 — Author submission & intake | `submission-drafts` | pending | pending | 0 | — | — |
| 5 | Area 1 — Author submission & intake | `author-dashboard` | pending | pending | 0 | — | — |
| 6 | Area 2 — Editorial workflow & peer review | `editorial-dashboards` | pending | pending | 0 | — | — |
| 7 | Area 2 — Editorial workflow & peer review | `workflow-stage-navigation` | pending | pending | 0 | — | — |
| 8 | Area 2 — Editorial workflow & peer review | `editorial-decisions` | pending | pending | 0 | — | — |
| 9 | Area 2 — Editorial workflow & peer review | `stage-participants` | pending | pending | 0 | — | — |
| 10 | Area 2 — Editorial workflow & peer review | `send-to-review` | pending | pending | 0 | — | — |
| 11 | Area 2 — Editorial workflow & peer review | `assign-and-manage-reviewers` | pending | pending | 0 | — | — |
| 12 | Area 2 — Editorial workflow & peer review | `reviewer-response` | pending | pending | 0 | — | — |
| 13 | Area 2 — Editorial workflow & peer review | `review-forms` | pending | pending | 0 | — | — |
| 14 | Area 2 — Editorial workflow & peer review | `review-rounds-and-revisions` | pending | pending | 0 | — | — |
| 15 | Area 2 — Editorial workflow & peer review | `recommend-only-editors` | pending | pending | 0 | — | — |
| 16 | Area 2 — Editorial workflow & peer review | `review-anonymity` | pending | pending | 0 | — | — |
| 17 | Area 2 — Editorial workflow & peer review | `copyediting-stage` | pending | pending | 0 | — | — |
| 18 | Area 2 — Editorial workflow & peer review | `production-stage` | pending | pending | 0 | — | — |
| 19 | Area 2 — Editorial workflow & peer review | `tasks-discussions` | pending | pending | 0 | — | — |
| 20 | Area 2 — Editorial workflow & peer review | `submission-files` | pending | pending | 0 | — | — |
| 21 | Area 2 — Editorial workflow & peer review | `editorial-activity-log` | pending | pending | 0 | — | — |
| 22 | Area 2 — Editorial workflow & peer review | `document-library` | pending | pending | 0 | — | — |
| 23 | Area 3 — Publication record, issues & scheduling | `publication-title-abstract-body` | pending | pending | 0 | — | — |
| 24 | Area 3 — Publication record, issues & scheduling | `contributors` | pending | pending | 0 | — | — |
| 25 | Area 3 — Publication record, issues & scheduling | `publication-metadata-references` | pending | pending | 0 | — | — |
| 26 | Area 3 — Publication record, issues & scheduling | `galleys` | pending | pending | 0 | — | — |
| 27 | Area 3 — Publication record, issues & scheduling | `media-files` | pending | pending | 0 | — | — |
| 28 | Area 3 — Publication record, issues & scheduling | `publication-identifiers` | pending | pending | 0 | — | — |
| 29 | Area 3 — Publication record, issues & scheduling | `publication-license` | pending | pending | 0 | — | — |
| 30 | Area 3 — Publication record, issues & scheduling | `publication-issue-assignment` | pending | pending | 0 | — | — |
| 31 | Area 3 — Publication record, issues & scheduling | `publication-versioning` | pending | pending | 0 | — | — |
| 32 | Area 3 — Publication record, issues & scheduling | `publication-publish-flow` | pending | pending | 0 | — | — |
| 33 | Area 3 — Publication record, issues & scheduling | `publication-amendments` | pending | pending | 0 | — | — |
| 34 | Area 3 — Publication record, issues & scheduling | `data-availability-citations` | pending | pending | 0 | — | — |
| 35 | Area 3 — Publication record, issues & scheduling | `issue-management` | pending | pending | 0 | — | — |
| 36 | Area 4 — Reader front end | `journal-homepage` | pending | pending | 0 | — | — |
| 37 | Area 4 — Reader front end | `highlights-featured-content` | pending | pending | 0 | — | — |
| 38 | Area 4 — Reader front end | `article-landing` | pending | pending | 0 | — | — |
| 39 | Area 4 — Reader front end | `article-recommendations` | pending | pending | 0 | — | — |
| 40 | Area 4 — Reader front end | `issue-archive-toc` | pending | pending | 0 | — | — |
| 41 | Area 4 — Reader front end | `site-search` | pending | pending | 0 | — | — |
| 42 | Area 4 — Reader front end | `browse-category-section` | pending | pending | 0 | — | — |
| 43 | Area 4 — Reader front end | `public-comments` | pending | pending | 0 | — | — |
| 44 | Area 4 — Reader front end | `about-pages` | pending | pending | 0 | — | — |
| 45 | Area 4 — Reader front end | `oai-pmh` | pending | pending | 0 | — | — |
| 46 | Area 4 — Reader front end | `web-feeds-syndication` | pending | pending | 0 | — | — |
| 47 | Area 5 — Users, roles & access | `registration-login` | pending | pending | 0 | — | — |
| 48 | Area 5 — Users, roles & access | `password-flows` | pending | pending | 0 | — | — |
| 49 | Area 5 — Users, roles & access | `user-profile` | pending | pending | 0 | — | — |
| 50 | Area 5 — Users, roles & access | `user-management` | pending | pending | 0 | — | — |
| 51 | Area 5 — Users, roles & access | `user-invitations` | pending | pending | 0 | — | — |
| 52 | Area 5 — Users, roles & access | `roles-permissions` | pending | pending | 0 | — | — |
| 53 | Area 5 — Users, roles & access | `login-as` | pending | pending | 0 | — | — |
| 54 | Area 5 — Users, roles & access | `editorial-masthead` | pending | pending | 0 | — | — |
| 55 | Area 5 — Users, roles & access | `site-access-restrictions` | pending | pending | 0 | — | — |
| 56 | Area 6 — Journal & site settings | `journal-masthead-settings` | pending | pending | 0 | — | — |
| 57 | Area 6 — Journal & site settings | `website-appearance-settings` | pending | pending | 0 | — | — |
| 58 | Area 6 — Journal & site settings | `workflow-settings` | pending | pending | 0 | — | — |
| 59 | Area 6 — Journal & site settings | `distribution-settings` | pending | pending | 0 | — | — |
| 60 | Area 6 — Journal & site settings | `email-templates-management` | pending | pending | 0 | — | — |
| 61 | Area 6 — Journal & site settings | `navigation-menus` | pending | pending | 0 | — | — |
| 62 | Area 6 — Journal & site settings | `sections` | pending | pending | 0 | — | — |
| 63 | Area 6 — Journal & site settings | `categories` | pending | pending | 0 | — | — |
| 64 | Area 6 — Journal & site settings | `announcements` | pending | pending | 0 | — | — |
| 65 | Area 6 — Journal & site settings | `languages-locales` | pending | pending | 0 | — | — |
| 66 | Area 6 — Journal & site settings | `site-settings` | pending | pending | 0 | — | — |
| 67 | Area 6 — Journal & site settings | `site-administration` | pending | pending | 0 | — | — |
| 68 | Area 7 — Integrations, identifiers & monetization | `plugin-management` | pending | pending | 0 | — | — |
| 69 | Area 7 — Integrations, identifiers & monetization | `doi-management` | pending | pending | 0 | — | — |
| 70 | Area 7 — Integrations, identifiers & monetization | `doi-deposit` | pending | pending | 0 | — | — |
| 71 | Area 7 — Integrations, identifiers & monetization | `open-peer-review-display` | pending | pending | 0 | — | — |
| 72 | Area 7 — Integrations, identifiers & monetization | `orcid` | pending | pending | 0 | — | — |
| 73 | Area 7 — Integrations, identifiers & monetization | `citation-style-language` | pending | pending | 0 | — | — |
| 74 | Area 7 — Integrations, identifiers & monetization | `indexing-meta-tags` | pending | pending | 0 | — | — |
| 75 | Area 7 — Integrations, identifiers & monetization | `subscriptions-management` | pending | pending | 0 | — | — |
| 76 | Area 7 — Integrations, identifiers & monetization | `subscription-access` | pending | pending | 0 | — | — |
| 77 | Area 7 — Integrations, identifiers & monetization | `payments` | pending | pending | 0 | — | — |
| 78 | Area 7 — Integrations, identifiers & monetization | `institutions` | pending | pending | 0 | — | — |
| 79 | Area 8 — System, communications & administration | `email-delivery` | pending | pending | 0 | — | — |
| 80 | Area 8 — System, communications & administration | `notifications` | pending | pending | 0 | — | — |
| 81 | Area 8 — System, communications & administration | `jobs-queue` | pending | pending | 0 | — | — |
| 82 | Area 8 — System, communications & administration | `scheduled-tasks` | pending | pending | 0 | — | — |
| 83 | Area 8 — System, communications & administration | `rest-api` | pending | pending | 0 | — | — |
| 84 | Area 8 — System, communications & administration | `native-xml-import-export` | pending | pending | 0 | — | — |
| 85 | Area 8 — System, communications & administration | `user-import-export` | pending | pending | 0 | — | — |
| 86 | Area 8 — System, communications & administration | `pubmed-export` | pending | pending | 0 | — | — |
| 87 | Area 8 — System, communications & administration | `usage-statistics` | pending | pending | 0 | — | — |
| 88 | Area 8 — System, communications & administration | `counter-sushi` | pending | pending | 0 | — | — |
| 89 | Area 8 — System, communications & administration | `editorial-statistics` | pending | pending | 0 | — | — |
| 90 | Area 8 — System, communications & administration | `csv-reports` | pending | pending | 0 | — | — |
| 91 | Area 8 — System, communications & administration | `site-maintenance` | pending | pending | 0 | — | — |
| 92 | Area 8 — System, communications & administration | `installation-upgrade` | pending | pending | 0 | — | — |
## Parked (needs maintainer)

_(none yet)_

## Run log

_(loop appends one line per feature: date · feature · outcome · #tests · runtime delta)_

- 2026-07-02 · submission-wizard · done (spec verified, adversarial + live affordance probes) · 6 tests · file runtime ~24 s
