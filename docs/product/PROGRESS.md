# Progress — live state

**Pure state, nothing else.** One row per feature; the Note column is ONE line max —
detailed findings belong in the spec itself (Known deviations / Open questions) and
`docs/e2e/app-changes.md`, never here. Read together with `RUNBOOK.md` (the loop).
Style rules live in `TEMPLATE.md`; test rules in `docs/e2e/PRINCIPLES.md`; ops
lessons in `RUNBOOK.md` — do not accrete any of those here.

**RESET 2026-07-10 (maintainer decision):** the round-2 build produced 67 specs +
467 tests, but a silent model fallback meant most were authored by a weaker model
than intended, and a style audit showed heavy technical leakage into PO/QA-facing
text (~2,700 leaky lines; `lint-spec.sh`). All specs and feature tests were
scratched (git history has them — never read them back; regenerating without
anchoring to the old text is the point). Survivors: `specs/tasks-discussions.md` +
`playwright/tests/tasks-discussions.spec.js` (the maintainer-calibrated reference),
all test infrastructure (POMs, fixtures, support, scenario endpoints, serial
wiring), the atlas, FEATURE-MAP, UNASSIGNED, and both ledgers (their findings are
app facts, independent of the scratched specs).

**Current mode: DRESS REHEARSAL (maintainer decision 2026-07-10).** Calibration
feature 1 (`assign-and-manage-reviewers`) is signed off. The next session builds
exactly ONE feature — the first `pending` row in table order — end-to-end per the
RUNBOOK loop, with ZERO maintainer input mid-run and step 7 delegated per the
chunked-verification protocol, then STOPS for maintainer review. If that review
passes, the maintainer flips this banner to **AUTONOMOUS WAVES** (rules in
RUNBOOK); wave counter starts then at 0 since last sampling.

## Totals

- Features: **1 reference · 1 verified · 90 pending** (of 92; feature 39 folded into `article-landing`)
- Tests: **18 / 700** (tasks-discussions 6 + submission-wizard 12) · last full-suite timing: n/a since reset
- Budget tiers (maintainer-rebalanced 2026-07-02): H 10–13 · M 6–8 · L 3–4; allocation ≈ 639, headroom ~61

## Features

| # | Area | Feature | Budget | Spec | Tests | Note |
|---|------|---------|--------|------|-------|------|
| 1 | Area 1 — Author submission & intake | `submission-wizard` | H·12 | verified | green(x2) | dress rehearsal: 12 tests, 26 atoms, ledger rows 164–178; 1 verifier chunk all-opus (kept per policy); awaiting maintainer review |
| 2 | Area 1 — Author submission & intake | `submission-wizard-metadata` | M·7 | pending | pending | |
| 3 | Area 1 — Author submission & intake | `reviewer-suggestions` | M·6 | pending | pending | |
| 4 | Area 1 — Author submission & intake | `submission-drafts` | M·6 | pending | pending | |
| 5 | Area 1 — Author submission & intake | `author-dashboard` | M·6 | pending | pending | |
| 6 | Area 2 — Editorial workflow & peer review | `editorial-dashboards` | H·10 | pending | pending | |
| 7 | Area 2 — Editorial workflow & peer review | `workflow-stage-navigation` | M·6 | pending | pending | |
| 8 | Area 2 — Editorial workflow & peer review | `editorial-decisions` | H·13 | pending | pending | |
| 9 | Area 2 — Editorial workflow & peer review | `stage-participants` | M·8 | pending | pending | |
| 10 | Area 2 — Editorial workflow & peer review | `send-to-review` | M·7 | pending | pending | |
| 11 | Area 2 — Editorial workflow & peer review | `assign-and-manage-reviewers` | H·12 | verified | green(x2) | calibration f1: 13 tests, 33 atoms, 5 proposed ledger rows; maintainer signed off 2026-07-10 (scenario rewording applied) |
| 12 | Area 2 — Editorial workflow & peer review | `reviewer-response` | H·10 | pending | pending | |
| 13 | Area 2 — Editorial workflow & peer review | `review-forms` | M·7 | pending | pending | |
| 14 | Area 2 — Editorial workflow & peer review | `review-rounds-and-revisions` | H·12 | pending | pending | |
| 15 | Area 2 — Editorial workflow & peer review | `recommend-only-editors` | M·6 | pending | pending | |
| 16 | Area 2 — Editorial workflow & peer review | `review-anonymity` | H·10 | pending | pending | |
| 17 | Area 2 — Editorial workflow & peer review | `copyediting-stage` | M·7 | pending | pending | |
| 18 | Area 2 — Editorial workflow & peer review | `production-stage` | M·7 | pending | pending | |
| 19 | Area 2 — Editorial workflow & peer review | `tasks-discussions` | H·10 | verified | kept (6) | REFERENCE — the calibration exemplar; spec + tests survived the 2026-07-10 reset |
| 20 | Area 2 — Editorial workflow & peer review | `submission-files` | H·10 | pending | pending | |
| 21 | Area 2 — Editorial workflow & peer review | `editorial-activity-log` | L·4 | pending | pending | |
| 22 | Area 2 — Editorial workflow & peer review | `document-library` | L·4 | pending | pending | |
| 23 | Area 3 — Publication record, issues & scheduling | `publication-title-abstract-body` | M·6 | pending | pending | |
| 24 | Area 3 — Publication record, issues & scheduling | `contributors` | H·10 | pending | pending | |
| 25 | Area 3 — Publication record, issues & scheduling | `publication-metadata-references` | M·7 | pending | pending | |
| 26 | Area 3 — Publication record, issues & scheduling | `galleys` | H·10 | pending | pending | |
| 27 | Area 3 — Publication record, issues & scheduling | `media-files` | M·6 | pending | pending | |
| 28 | Area 3 — Publication record, issues & scheduling | `publication-identifiers` | M·6 | pending | pending | |
| 29 | Area 3 — Publication record, issues & scheduling | `publication-license` | M·6 | pending | pending | |
| 30 | Area 3 — Publication record, issues & scheduling | `publication-issue-assignment` | M·6 | pending | pending | |
| 31 | Area 3 — Publication record, issues & scheduling | `publication-versioning` | H·10 | pending | pending | |
| 32 | Area 3 — Publication record, issues & scheduling | `publication-publish-flow` | H·11 | pending | pending | |
| 33 | Area 3 — Publication record, issues & scheduling | `publication-amendments` | M·7 | pending | pending | |
| 34 | Area 3 — Publication record, issues & scheduling | `data-availability-citations` | L·4 | pending | pending | |
| 35 | Area 3 — Publication record, issues & scheduling | `issue-management` | H·11 | pending | pending | |
| 36 | Area 4 — Reader front end | `journal-homepage` | M·7 | pending | pending | |
| 37 | Area 4 — Reader front end | `highlights-featured-content` | L·4 | pending | pending | |
| 38 | Area 4 — Reader front end | `article-landing` | H·10 | pending | pending | |
| 39 | Area 4 — Reader front end | ~~`article-recommendations`~~ **FOLDED into 38** | ~~L·3~~ | pending | pending | |
| 40 | Area 4 — Reader front end | `issue-archive-toc` | M·6 | pending | pending | |
| 41 | Area 4 — Reader front end | `site-search` | M·7 | pending | pending | |
| 42 | Area 4 — Reader front end | `browse-category-section` | M·6 | pending | pending | |
| 43 | Area 4 — Reader front end | `public-comments` | M·6 | pending | pending | |
| 44 | Area 4 — Reader front end | `about-pages` | L·3 | pending | pending | |
| 45 | Area 4 — Reader front end | `oai-pmh` | M·8 | pending | pending | |
| 46 | Area 4 — Reader front end | `web-feeds-syndication` | L·4 | pending | pending | |
| 47 | Area 5 — Users, roles & access | `registration-login` | H·10 | pending | pending | |
| 48 | Area 5 — Users, roles & access | `password-flows` | M·6 | pending | pending | |
| 49 | Area 5 — Users, roles & access | `user-profile` | M·7 | pending | pending | |
| 50 | Area 5 — Users, roles & access | `user-management` | H·10 | pending | pending | |
| 51 | Area 5 — Users, roles & access | `user-invitations` | M·8 | pending | pending | |
| 52 | Area 5 — Users, roles & access | `roles-permissions` | H·11 | pending | pending | |
| 53 | Area 5 — Users, roles & access | `login-as` | M·6 | pending | pending | |
| 54 | Area 5 — Users, roles & access | `editorial-masthead` | L·4 | pending | pending | |
| 55 | Area 5 — Users, roles & access | `site-access-restrictions` | M·6 | pending | pending | |
| 56 | Area 6 — Journal & site settings | `journal-masthead-settings` | L·4 | pending | pending | |
| 57 | Area 6 — Journal & site settings | `website-appearance-settings` | M·7 | pending | pending | |
| 58 | Area 6 — Journal & site settings | `workflow-settings` | M·7 | pending | pending | |
| 59 | Area 6 — Journal & site settings | `distribution-settings` | M·6 | pending | pending | |
| 60 | Area 6 — Journal & site settings | `email-templates-management` | M·7 | pending | pending | |
| 61 | Area 6 — Journal & site settings | `navigation-menus` | M·7 | pending | pending | |
| 62 | Area 6 — Journal & site settings | `sections` | M·7 | pending | pending | |
| 63 | Area 6 — Journal & site settings | `categories` | L·4 | pending | pending | |
| 64 | Area 6 — Journal & site settings | `announcements` | M·6 | pending | pending | |
| 65 | Area 6 — Journal & site settings | `languages-locales` | M·7 | pending | pending | |
| 66 | Area 6 — Journal & site settings | `site-settings` | L·4 | pending | pending | |
| 67 | Area 6 — Journal & site settings | `site-administration` | M·7 | pending | pending | |
| 68 | Area 7 — Integrations, identifiers & monetization | `plugin-management` | M·6 | pending | pending | |
| 69 | Area 7 — Integrations, identifiers & monetization | `doi-management` | H·10 | pending | pending | |
| 70 | Area 7 — Integrations, identifiers & monetization | `doi-deposit` | M·7 | pending | pending | |
| 71 | Area 7 — Integrations, identifiers & monetization | `open-peer-review-display` | L·4 | pending | pending | |
| 72 | Area 7 — Integrations, identifiers & monetization | `orcid` | M·7 | pending | pending | |
| 73 | Area 7 — Integrations, identifiers & monetization | `citation-style-language` | L·4 | pending | pending | |
| 74 | Area 7 — Integrations, identifiers & monetization | `indexing-meta-tags` | L·4 | pending | pending | |
| 75 | Area 7 — Integrations, identifiers & monetization | `subscriptions-management` | H·10 | pending | pending | |
| 76 | Area 7 — Integrations, identifiers & monetization | `subscription-access` | H·10 | pending | pending | |
| 77 | Area 7 — Integrations, identifiers & monetization | `payments` | M·8 | pending | pending | |
| 78 | Area 7 — Integrations, identifiers & monetization | `institutions` | L·4 | pending | pending | |
| 79 | Area 8 — System, communications & administration | `email-delivery` | M·6 | pending | pending | |
| 80 | Area 8 — System, communications & administration | `notifications` | M·7 | pending | pending | |
| 81 | Area 8 — System, communications & administration | `jobs-queue` | L·4 | pending | pending | |
| 82 | Area 8 — System, communications & administration | `scheduled-tasks` | L·4 | pending | pending | |
| 83 | Area 8 — System, communications & administration | `rest-api` | H·10 | pending | pending | |
| 84 | Area 8 — System, communications & administration | `native-xml-import-export` | H·10 | pending | pending | |
| 85 | Area 8 — System, communications & administration | `user-import-export` | M·6 | pending | pending | |
| 86 | Area 8 — System, communications & administration | `pubmed-export` | L·4 | pending | pending | |
| 87 | Area 8 — System, communications & administration | `usage-statistics` | M·7 | pending | pending | |
| 88 | Area 8 — System, communications & administration | `counter-sushi` | M·6 | pending | pending | |
| 89 | Area 8 — System, communications & administration | `editorial-statistics` | L·4 | pending | pending | |
| 90 | Area 8 — System, communications & administration | `csv-reports` | L·4 | pending | pending | |
| 91 | Area 8 — System, communications & administration | `site-maintenance` | L·4 | pending | pending | |
| 92 | Area 8 — System, communications & administration | `installation-upgrade` | L·4 | pending | pending | |

## Model-fallback log

One row per **completed subagent**, appended by
`docs/product/log-model-mix.sh <agent.jsonl> <feature> <authoring|verification|probe> <label>`
(the RUNBOOK completion spot-check). Clean rows are logged too — they are the
denominators for per-class flip rates. `FLIPPED@N/M` = the first Opus assistant
message was the Nth of M. **This section stays LAST in this file** (the script
appends to end-of-file). Per-class rates:
`awk -F'|' '/^\| 20/{c=$4; n[c]++; if($9!~/clean/) f[c]++} END{for(k in n) printf "%s: %d/%d flipped\n", k, f[k], n[k]}' docs/product/PROGRESS.md`

| Date | Feature | Class | Agent | Fable | Opus | Other | Status |
|------|---------|-------|-------|-------|------|-------|--------|
| 2026-07-10 | assign-and-manage-reviewers | authoring | spec-author | 192 | 0 | 0 | clean |
| 2026-07-10 | assign-and-manage-reviewers | authoring | test-author | 211 | 0 | 0 | clean |
| 2026-07-10 | assign-and-manage-reviewers | authoring | readability-verifier | 59 | 0 | 0 | clean |
| 2026-07-10 | assign-and-manage-reviewers | authoring | roster-migration | 148 | 0 | 0 | clean |
| 2026-07-10 | assign-and-manage-reviewers | verification | verify-adversarial | 73 | 141 | 0 | FLIPPED@74/214 |
| 2026-07-10 | assign-and-manage-reviewers | verification | verify-retry | 41 | 19 | 0 | FLIPPED@42/60 |
| 2026-07-10 | assign-and-manage-reviewers | verification | verify-qa-review | 57 | 26 | 0 | FLIPPED@58/83 |
| 2026-07-10 | submission-wizard | authoring | spec-author-att1 | 182 | 22 | 0 | FLIPPED@183/204 |
| 2026-07-10 | submission-wizard | authoring | spec-author-att2 | 111 | 44 | 0 | FLIPPED@112/155 |
| 2026-07-10 | submission-wizard | authoring | spec-author | 114 | 0 | 0 | clean |
| 2026-07-10 | submission-wizard | probe | probe-api-url-seams | 105 | 0 | 0 | clean |
| 2026-07-10 | submission-wizard | probe | probe-start-page-access | 161 | 0 | 0 | clean |
| 2026-07-10 | submission-wizard | probe | probe-wizard-ui-states | 118 | 0 | 0 | clean |
| 2026-07-10 | submission-wizard | probe | probe-submit-fanout-cancel | 188 | 0 | 0 | clean |
| 2026-07-10 | submission-wizard | authoring | spec-finalizer | 27 | 0 | 0 | clean |
| 2026-07-10 | submission-wizard | authoring | test-author | 157 | 0 | 0 | clean |
| 2026-07-10 | submission-wizard | verification | verify-permissions-code | 38 | 0 | 0 | clean |
| 2026-07-10 | submission-wizard | verification | verify-positive-controls | 73 | 0 | 0 | clean |
| 2026-07-10 | submission-wizard | verification | verify-denial-probes | 0 | 68 | 0 | all-opus |
| 2026-07-10 | submission-wizard | verification | verify-state-edges | 33 | 0 | 0 | clean |
| 2026-07-10 | submission-wizard | verification | verify-deviation-repro | 53 | 0 | 0 | clean |
| 2026-07-10 | submission-wizard | verification | verify-atlas-coverage | 23 | 0 | 0 | clean |
| 2026-07-10 | submission-wizard | probe | probe-admin-reopen-holes | 30 | 0 | 0 | clean |
| 2026-07-10 | submission-wizard | authoring | readability-verifier | 7 | 0 | 0 | clean |
| 2026-07-10 | submission-wizard | authoring | readability-fix | 128 | 0 | 0 | clean |
| 2026-07-10 | submission-wizard | authoring | verification-merge | 53 | 0 | 0 | clean |
